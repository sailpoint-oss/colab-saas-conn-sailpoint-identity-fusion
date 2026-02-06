import { Response, StdAccountListInput, StdAccountListOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'
import { assert, softAssert } from '../utils/assert'
import { generateReport } from './helpers/generateReport'

/**
 * Account list operation - Main entry point for identity fusion processing.
 * 
 * Processing Flow (Work Queue Pattern):
 * 1. SETUP: Load all data (fusion accounts, identities, managed accounts)
 * 2. DEPLETION PHASE: Process accounts and remove them from work queue
 *    a. fetchFormData: Remove accounts with pending form decisions
 *    b. processFusionAccounts: Remove accounts belonging to existing fusion accounts
 *    c. processIdentities: Remove accounts belonging to identities
 *    d. processManagedAccounts: Process remaining uncorrelated accounts
 * 3. OUTPUT: Send final fusion account list to platform
 * 4. CLEANUP: Clear caches and save state
 * 
 * Memory Optimizations:
 * - No map copies/snapshots during processing (direct reference only)
 * - Identity cache cleared after fusion/identity processing (line 60)
 * - Account caches cleared after output sent (lines 81-83)
 * - Report arrays cleared after report generation (in generateReport)
 * - Conditional previous attributes (only stored for existing fusion accounts)
 * 
 * Work Queue (sources.managedAccountsById):
 * - Starts with all managed accounts from all sources
 * - Gets depleted as accounts are matched and processed
 * - By phase 4 (processManagedAccounts), only uncorrelated accounts remain
 * - Physical deletion from map ensures no duplicate processing
 */
export const accountList = async (
    serviceRegistry: ServiceRegistry,
    input: StdAccountListInput,
    res: Response<StdAccountListOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log, fusion, forms, identities, schemas, sources, attributes, messaging } = serviceRegistry

    try {
        log.info('Starting account list operation')
        log.info('PHASE 1: Setup and initialization')

        await sources.fetchAllSources()
        log.debug(`Loaded ${sources.managedSources.length} managed source(s)`)
        
        if (fusion.isReset()) {
            log.info('Reset flag detected, disabling reset and exiting')
            await forms.deleteExistingForms()
            await fusion.disableReset()
            await fusion.resetState()
            return
        }

        await schemas.setFusionAccountSchema(input.schema)
        log.debug('Fusion account schema set successfully')

        await sources.aggregateManagedSources()
        log.debug('Managed sources aggregated')

        await attributes.initializeCounters()
        log.debug('Attribute counters initialized')

        // Fetch all data in parallel for efficiency
        log.info('PHASE 2: Fetching data in parallel')
        log.debug('Fetching fusion accounts, identities, managed accounts, and sender')
        const fetchPromises = [
            sources.fetchFusionAccounts(),
            identities.fetchIdentities(),
            sources.fetchManagedAccounts(),
            messaging.fetchSender(),
        ]

        await Promise.all(fetchPromises)
        log.info(`Loaded ${sources.fusionAccounts.length} fusion account(s), ${identities.identities.length} identit(ies), ${sources.managedAccountsById.size} managed account(s)`)
        const fusionOwner = sources.fusionSourceOwner
        if (fusion.fusionReportOnAggregation) {
            const fusionOwnerIdentity = identities.getIdentityById(fusionOwner.id)
            if (!fusionOwnerIdentity) {
                log.info(`Fusion owner identity missing. Fetching identity: ${fusionOwner.id}`)
                await identities.fetchIdentityById(fusionOwner.id!)
            }
        }

        // WORK QUEUE DEPLETION PHASE BEGINS
        log.info('PHASE 3: Work queue depletion - processing accounts')
        await forms.fetchFormData()
        log.debug('Form data loaded')

        // Phase 2-3: Remove accounts belonging to fusion accounts and identities
        log.debug('Step 3.1: Processing existing fusion accounts')
        await fusion.processFusionAccounts()
        
        log.debug('Step 3.2: Processing identities')
        await fusion.processIdentities()

        // Memory optimization: Clear identity cache after processing
        // Identities are no longer needed and can be garbage collected
        identities.clear()
        log.debug('Identities cache cleared from memory')

        // Phase 4: Process remaining uncorrelated accounts (deduplication)
        log.debug('Step 3.3: Processing fusion identity decisions')
        await fusion.processFusionIdentityDecisions()
        
        log.debug('Step 3.4: Processing managed accounts (deduplication)')
        await fusion.processManagedAccounts()
        log.info(`Work queue processing complete - ${sources.managedAccountsById.size} unprocessed account(s) remaining`)

        if (fusion.fusionReportOnAggregation) {
            log.info('PHASE 4: Generating fusion report')
            const fusionOwnerAccount = fusion.getFusionIdentity(fusionOwner.id!)
            softAssert(fusionOwnerAccount, 'Fusion owner account not found')
            if (fusionOwnerAccount) {
                await generateReport(fusionOwnerAccount, false, serviceRegistry)
                log.info('Fusion report generated and sent successfully')
            }
        }

        log.info('PHASE 5: Finalizing and sending accounts')
        const accounts = await fusion.listISCAccounts()
        assert(accounts, 'Failed to list ISC accounts')
        log.info(`Sending ${accounts.length} account(s) to platform`)
        accounts.forEach((x) => res.send(x))

        log.info('PHASE 6: Cleanup')
        await forms.cleanUpForms()
        log.debug('Form cleanup completed')

        await attributes.saveState()
        log.debug('Attribute state saved')

        // Memory optimization: Clear account caches after all processing is complete
        // At this point, accounts have been sent to the platform and are no longer needed
        // This frees potentially thousands of account objects from memory
        sources.clearManagedAccounts()
        sources.clearFusionAccounts()
        log.debug('Account caches cleared from memory')

        log.info(`✓ Account list operation completed successfully - ${accounts.length} account(s) processed`)
    } catch (error) {
        log.crash('Failed to list accounts', error)
    }
}
