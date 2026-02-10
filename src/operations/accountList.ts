import { ConnectorError, Response, StdAccountListInput, StdAccountListOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'
import { assert, softAssert } from '../utils/assert'
import { generateReport } from './helpers/generateReport'

/**
 * Account list operation - Main entry point for identity fusion processing.
 *
 * Processing Flow (Work Queue Pattern):
 * 1. SETUP: Load sources, schema, and initialize attribute counters
 * 2. FETCH: Load fusion accounts, identities, managed accounts in parallel
 * 3. DEPLETION: Process and remove accounts from the work queue
 *    a. fetchFormData - Remove accounts with pending form decisions
 *    b. processFusionAccounts - Remove accounts belonging to existing fusion accounts
 *    c. processIdentities - Remove accounts belonging to identities
 *    d. processFusionIdentityDecisions - Process fusion identity decisions
 *    e. processManagedAccounts - Process remaining uncorrelated accounts (deduplication)
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
 *
 * Work Queue (sources.managedAccountsById):
 * - Starts with all managed accounts from all sources
 * - Gets depleted as accounts are matched and processed
 * - By step 3e (processManagedAccounts), only uncorrelated accounts remain
 * - Physical deletion from map ensures no duplicate processing
 */
export const accountList = async (
    serviceRegistry: ServiceRegistry,
    input: StdAccountListInput,
    res: Response<StdAccountListOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log, fusion, forms, identities, schemas, sources, attributes, messaging } = serviceRegistry

    let processLockAcquired = false

    try {
        log.info('Starting account list operation')
        const timer = log.timer()

        await sources.fetchAllSources()
        log.debug(`Loaded ${sources.managedSources.length} managed source(s)`)

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
        log.debug('Fusion account schema set successfully')

        await sources.aggregateManagedSources()
        log.debug('Managed sources aggregated')

        await attributes.initializeCounters()
        log.debug('Attribute counters initialized')
        timer.phase('PHASE 1: Setup and initialization')

        log.debug('Fetching fusion accounts, identities, managed accounts, and sender')
        const fetchPromises = [
            sources.fetchFusionAccounts(),
            identities.fetchIdentities(),
            sources.fetchManagedAccounts(),
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
        timer.phase('PHASE 2: Fetching data in parallel')

        await forms.fetchFormData()
        log.debug('Form data loaded')

        log.debug('Step 3.1: Processing existing fusion accounts')
        await fusion.processFusionAccounts()

        log.debug('Step 3.2: Processing identities')
        await fusion.processIdentities()

        // Memory optimization: identities are no longer needed past this point
        identities.clear()
        log.debug('Identities cache cleared from memory')

        log.debug('Step 3.3: Processing fusion identity decisions')
        await fusion.processFusionIdentityDecisions()

        log.debug('Step 3.4: Processing managed accounts (deduplication)')
        await fusion.processManagedAccounts()
        log.info(`Work queue processing complete - ${sources.managedAccountsById.size} unprocessed account(s) remaining`)
        timer.phase('PHASE 3: Work queue depletion - processing accounts')

        if (fusion.fusionReportOnAggregation) {
            const fusionOwnerAccount = fusion.getFusionIdentity(fusionOwner.id!)
            softAssert(fusionOwnerAccount, 'Fusion owner account not found')
            if (fusionOwnerAccount) {
                await generateReport(fusionOwnerAccount, false, serviceRegistry)
            }
            timer.phase('PHASE 4: Generating fusion report')
        }

        // Memory optimization: clear analyzed account arrays regardless of report flag.
        // generateReport() clears them internally, but if reporting is disabled they would
        // persist for the lifetime of the operation.
        fusion.clearAnalyzedAccounts()

        const accounts = await fusion.listISCAccounts()
        assert(accounts, 'Failed to list ISC accounts')
        log.info(`Sending ${accounts.length} account(s) to platform`)
        accounts.forEach((x) => res.send(x))
        timer.phase('PHASE 5: Finalizing and sending accounts')

        await forms.cleanUpForms()
        log.debug('Form cleanup completed')

        await attributes.saveState()
        log.debug('Attribute state saved')

        await sources.saveBatchCumulativeCount()
        log.debug('Batch cumulative count saved')

        // Memory optimization: accounts have been sent and are no longer needed
        sources.clearManagedAccounts()
        sources.clearFusionAccounts()
        log.debug('Account caches cleared from memory')

        timer.end(`✓ Account list operation completed successfully - ${accounts.length} account(s) processed`)
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
