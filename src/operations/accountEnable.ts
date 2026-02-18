import { ConnectorError, Response, StdAccountEnableInput, StdAccountEnableOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'
import { rebuildFusionAccount } from './helpers/rebuildFusionAccount'
import { assert } from '../utils/assert'
import { AttributeOperations } from '../services/attributeService/types'

/**
 * Account enable operation - Re-enables a previously disabled fusion account.
 *
 * Enabling triggers a full unique attribute reset (`resetDefinition: true`).
 * All unique attribute values (e.g. usernames, generated IDs) are unregistered
 * and regenerated to guarantee collision-free values. Use regular unique attribute
 * schemas to define changeable attributes that should be refreshed on
 * enable/disable cycles. The nativeIdentity and account name are never changed
 * (see {@link processNormalDefinition} and {@link processUniqueDefinition}).
 *
 * Unlike disable, enable requires pre-processing all fusion accounts to collect
 * unique attribute values before rebuilding, since re-enabling may require
 * reassigning unique identifiers that were released during disable.
 *
 * Processing Flow:
 * 1. SETUP: Load sources and schema
 * 2. PRE-PROCESS: Fetch and pre-process all fusion accounts to collect unique values
 * 3. REBUILD: Reconstruct the target fusion account with refreshed and reset attributes
 * 4. ENABLE: Mark the fusion account as enabled
 * 5. OUTPUT: Generate and return the updated ISC account representation
 *
 * @param serviceRegistry - Service registry providing access to all connector services
 * @param input - SDK input containing the account identity to enable
 * @param res - SDK response object for sending the enabled account back to the platform
 */
export const accountEnable = async (
    serviceRegistry: ServiceRegistry,
    input: StdAccountEnableInput,
    res: Response<StdAccountEnableOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log, fusion, sources, schemas, attributes } = serviceRegistry

    try {
        log.info(`Enabling account: ${input.identity}`)
        assert(input.identity, 'Account identity is required')
        const timer = log.timer()

        await attributes.initializeCounters()
        await sources.fetchAllSources()
        await schemas.setFusionAccountSchema(input.schema)
        timer.phase('Step 1: Loading sources and schema')

        await sources.fetchFusionAccounts()
        const fusionAccounts = await fusion.preProcessFusionAccounts()
        for (const fusionAccount of fusionAccounts) {
            await attributes.registerUniqueAttributes(fusionAccount)
        }
        timer.phase('Step 2: Pre-processing all fusion accounts to collect unique values')

        const attributeOperations: AttributeOperations = {
            refreshMapping: true,
            refreshDefinition: true,
            resetDefinition: true,
        }
        const fusionAccount = await rebuildFusionAccount(input.identity, attributeOperations, serviceRegistry)
        assert(fusionAccount, `Fusion account not found for identity: ${input.identity}`)
        log.debug(`Found fusion account: ${fusionAccount.name || fusionAccount.nativeIdentity}`)

        await attributes.refreshUniqueAttributes(fusionAccount)
        timer.phase('Step 3: Rebuilding target fusion account with fresh attributes')

        fusionAccount.enable()
        timer.phase('Step 4: Enabling fusion account')

        const iscAccount = await fusion.getISCAccount(fusionAccount)
        assert(iscAccount, 'Failed to generate ISC account from fusion account')
        timer.phase('Step 5: Generating ISC account')

        res.send(iscAccount)
        timer.end(`✓ Account enable completed for ${input.identity}`)
    } catch (error) {
        if (error instanceof ConnectorError) throw error
        log.crash(`Failed to enable account ${input.identity}`, error)
    }
}
