import { Response, StdAccountEnableInput, StdAccountEnableOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'
import { rebuildFusionAccount } from './helpers/rebuildFusionAccount'
import { assert } from '../utils/assert'
import { AttributeOperations } from '../services/attributeService/types'

/**
 * Account enable operation - Re-enables a previously disabled fusion account.
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
    const { log, fusion, sources, schemas } = serviceRegistry

    try {
        log.info(`Enabling account: ${input.identity}`)
        assert(input.identity, 'Account identity is required')

        log.debug('Step 1: Loading sources and schema')
        await sources.fetchAllSources()
        await schemas.setFusionAccountSchema(input.schema)

        log.debug('Step 2: Pre-processing all fusion accounts to collect unique values')
        await sources.fetchFusionAccounts()
        await fusion.preProcessFusionAccounts()

        log.debug('Step 3: Rebuilding target fusion account with fresh attributes')
        const attributeOperations: AttributeOperations = {
            refreshMapping: true,
            refreshDefinition: true,
            resetDefinition: true,
        }
        const fusionAccount = await rebuildFusionAccount(input.identity, attributeOperations, serviceRegistry)
        assert(fusionAccount, `Fusion account not found for identity: ${input.identity}`)
        log.debug(`Found fusion account: ${fusionAccount.name || fusionAccount.nativeIdentity}`)

        log.debug('Step 4: Enabling fusion account')
        fusionAccount.enable()

        log.debug('Step 5: Generating ISC account')
        const iscAccount = await fusion.getISCAccount(fusionAccount)
        assert(iscAccount, 'Failed to generate ISC account from fusion account')

        res.send(iscAccount)
        log.info(`✓ Account enable completed for ${input.identity}`)
    } catch (error) {
        log.crash(`Failed to enable account ${input.identity}`, error)
    }
}
