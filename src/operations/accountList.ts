import { ConnectorError, Response, StdAccountListInput, StdAccountListOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'
import { softAssert } from '../utils/assert'
import { generateReport } from './helpers/generateReport'
import { FusionAccount } from '../model/account'

/**
 * Account list operation - Main entry point for identity fusion processing.
 *
 * Processing Flow (Work Queue Pattern):
 * 1. SETUP: Load sources, schema, and initialize attribute counters
 * 2. FETCH: Load fusion accounts, identities, managed accounts in parallel
 * 3. DEPLETION: Process and remove accounts from the work queue
 *    a. fetchFormData - Load pending forms + extract decisions
 *    b. processFusionAccounts - Process existing fusion accounts (work-queue depletion)
 *    c. processIdentities - Process identities (create missing fusion identities)
 *    d. processFusionIdentityDecisions - Process "new identity" decisions
 *    e. processManagedAccounts - Process remaining uncorrelated accounts (deduplication)
 *    f. reconcilePendingFormState - Recalculate transient form-derived entitlements (candidate + reviews)
 *    g. refreshUniqueAttributes - Generate unique attributes for new non-managed accounts
 * 4. REPORT: Generate fusion report (conditional)
 * 5. OUTPUT: Send final fusion account list to platform
 * 6. CLEANUP: Clear caches and save state
 *
 * Memory Optimizations:
 * - No map copies/snapshots during processing (direct reference only)
 * - Identity cache cleared after fusion/identity processing
 * - Account caches cleared after output is sent
 * - Report arrays cleared after report generation (in generateReport)
 * - Conditional previous attributes (only stored for existing fusion accounts)
 * - newNonManagedFusionAccounts drained by splice during refresh (releases refs per batch)
 *
 * Work Queue (sources.managedAccountsById):
 * - Starts with all managed accounts from all sources
 * - Gets depleted as accounts are matched and processed
 * - By step 3e (processManagedAccounts), only unmatched accounts remain
 * - Physical deletion from map ensures no duplicate processing
 */
export const accountList = async (
    serviceRegistry: ServiceRegistry,
    input: StdAccountListInput,
    res: Response<StdAccountListOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log, fusion, forms, identities, schemas, sources, attributes, messaging, config } = serviceRegistry

    let processLockAcquired = false

    try {
        log.info('Starting aggregation')
        const timer = log.timer()
        const abortController = new AbortController()
        let phase = 1

        await sources.fetchAllSources()
        log.info(`Loaded ${sources.managedSources.length} managed source(s)`)

        // Set process lock to prevent concurrent aggregations.
        // Must be called after fetchAllSources (which resolves fusionSourceId).
        // If the flag is already active, setProcessLock resets it and throws,
        // so the next retry will succeed without manual intervention.
        await sources.setProcessLock()
        processLockAcquired = true

        if (fusion.isReset()) {
            log.info('Reset flag detected, disabling reset and exiting')
            await forms.deleteExistingForms()
            await fusion.disableReset()
            await fusion.resetState()
            await sources.resetBatchCumulativeCount()
            return
        }

        await schemas.setFusionAccountSchema(input.schema)
        log.info('Fusion account schema set successfully')

        await sources.aggregateManagedSources()
        log.info('Managed sources aggregated')

        await attributes.initializeCounters()
        log.info('Attribute counters initialized')
        timer.phase(`PHASE ${phase++}: Setup and initialization`)

        log.info('Fetching fusion accounts, identities, managed accounts, and sender')
        const fetchPromises = [
            sources.fetchFusionAccounts(),
            identities.fetchIdentities(),
            sources.fetchManagedAccounts(abortController.signal),
            messaging.fetchSender(),
        ]

        await Promise.all(fetchPromises)
        // Use count getters to avoid creating temporary arrays just for .length
        log.info(`Loaded ${sources.fusionAccountCount} fusion account(s), ${identities.identityCount} identities, ${sources.managedAccountsById.size} managed account(s)`)
        const fusionOwner = sources.fusionSourceOwner
        if (fusion.fusionReportOnAggregation) {
            const fusionOwnerIdentity = identities.getIdentityById(fusionOwner.id)
            if (!fusionOwnerIdentity) {
                log.info(`Fusion owner identity missing. Fetching identity: ${fusionOwner.id}`)
                await identities.fetchIdentityById(fusionOwner.id!)
            }
        }
        timer.phase(`PHASE ${phase++}: Fetching data in parallel`)

        log.info(`Step ${phase}.0: Processing fusion forms and instances`)
        await forms.fetchFormData()
        log.info('Form data loaded')

        log.info(`Step ${phase}.1: Processing existing fusion accounts`)
        await fusion.processFusionAccounts()

        const newNonManagedFusionAccounts: FusionAccount[] = []
        log.info(`Step ${phase}.2: Processing identities`)
        newNonManagedFusionAccounts.push(...await fusion.processIdentities())

        // Memory optimization: identities are no longer needed past this point
        identities.clear()
        log.info('Identities cache cleared from memory')

        log.info(`Step ${phase}.3: Processing fusion identity decisions (new identity)`)
        newNonManagedFusionAccounts.push(...await fusion.processFusionIdentityDecisions())

        log.info(`Step ${phase}.4: Processing managed accounts (deduplication)`)
        await fusion.processManagedAccounts()

        log.info(`Step ${phase}.5: Reconciling pending form state (candidates + reviewer links)`)
        // Reconcile transient form-derived entitlements (candidate + pending reviews).
        // Must run after processManagedAccounts because new pending forms may be created there
        // and candidates flagged during form creation need to be preserved for this run.
        fusion.reconcilePendingFormState()

        log.info(`Step ${phase}.6: Refresh non-managed accounts unique attributes`)
        // Memory: splice drains the array so refs are released per batch; bounded concurrency
        const refreshBatchSize = config.managedAccountsBatchSize ?? 50
        while (newNonManagedFusionAccounts.length > 0) {
            const batch = newNonManagedFusionAccounts.splice(0, refreshBatchSize)
            await Promise.all(batch.map((account) => attributes.refreshUniqueAttributes(account)))
        }

        log.info(`Work queue processing complete - ${sources.managedAccountsById.size} unprocessed account(s) remaining`)
        timer.phase(`PHASE ${phase++}: Work queue depletion and form reconciliation`)

        if (fusion.fusionReportOnAggregation) {
            const fusionOwnerAccount = fusion.getFusionIdentity(fusionOwner.id!)
            softAssert(fusionOwnerAccount, 'Fusion owner account not found')
            if (fusionOwnerAccount) {
                await generateReport(fusionOwnerAccount, false, serviceRegistry)
            }
            timer.phase(`PHASE ${phase++}: Generating fusion report`)
        }

        await attributes.saveState()
        log.info('Attribute state saved')
        await sources.saveBatchCumulativeCount()
        log.info('Batch cumulative count saved')

        timer.phase(`PHASE ${phase++}: Saving state and clearing memory`)

        // Memory optimization: clear analyzed account arrays regardless of report flag.
        // generateReport() clears them internally, but if reporting is disabled they would
        // persist for the lifetime of the operation.
        fusion.clearAnalyzedAccounts()
        sources.clearManagedAccounts()
        await forms.cleanUpForms()
        log.info('Form cleanup completed')

        log.info('Sending accounts to platform')
        const count = await fusion.forEachISCAccount((account) => res.send(account))
        log.info(`Sent ${count} account(s) to platform`)
        timer.phase(`PHASE ${phase++}: Finalizing and sending accounts`)

        sources.clearFusionAccounts()
        log.info('Account caches cleared from memory')

        timer.end(`✓ Account list operation completed successfully - ${count} account(s) processed`)
    } catch (error) {
        if (error instanceof ConnectorError) throw error
        log.crash('Failed to list accounts', error)
    } finally {
        // Only release the lock if we successfully acquired it.
        // If setProcessLock threw (flag was already active), it already reset the flag itself.
        if (processLockAcquired) {
            await sources.releaseProcessLock()
        }
    }
}
