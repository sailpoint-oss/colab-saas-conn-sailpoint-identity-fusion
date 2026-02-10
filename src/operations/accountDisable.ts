import { ConnectorError, Response, StdAccountDisableInput, StdAccountDisableOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'
import { rebuildFusionAccount } from './helpers/rebuildFusionAccount'
import { assert } from '../utils/assert'
import { AttributeOperations } from '../services/attributeService/types'

/**
 * Account disable operation - Disables a fusion account.
 *
 * Processing Flow:
 * 1. SETUP: Load sources and schema
 * 2. REBUILD: Reconstruct the fusion account with refreshed mapped and generated attributes
 * 3. DISABLE: Mark the fusion account as disabled
 * 4. OUTPUT: Generate and return the updated ISC account representation
 *
 * @param serviceRegistry - Service registry providing access to all connector services
 * @param input - SDK input containing the account identity to disable
 * @param res - SDK response object for sending the disabled account back to the platform
 */
export const accountDisable = async (
    serviceRegistry: ServiceRegistry,
    input: StdAccountDisableInput,
    res: Response<StdAccountDisableOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log, fusion, sources, schemas } = serviceRegistry

    try {
        log.info(`Disabling account: ${input.identity}`)
        assert(input.identity, 'Account identity is required')
        const timer = log.timer()

        await sources.fetchAllSources()
        await schemas.setFusionAccountSchema(input.schema)
        timer.phase('Step 1: Loading sources and schema', 'debug')

        const attributeOperations: AttributeOperations = {
            refreshMapping: true,
            refreshDefinition: true,
            resetDefinition: false,
        }
        const fusionAccount = await rebuildFusionAccount(input.identity, attributeOperations, serviceRegistry)
        assert(fusionAccount, `Fusion account not found for identity: ${input.identity}`)
        log.debug(`Found fusion account: ${fusionAccount.name || fusionAccount.nativeIdentity}`)
        timer.phase('Step 2: Rebuilding fusion account with fresh attributes', 'debug')

        fusionAccount.disable()
        timer.phase('Step 3: Disabling fusion account', 'debug')

        const iscAccount = await fusion.getISCAccount(fusionAccount)
        assert(iscAccount, 'Failed to generate ISC account from fusion account')
        timer.phase('Step 4: Generating ISC account', 'debug')

        res.send(iscAccount)
        timer.end(`✓ Account disable completed for ${input.identity}`)
    } catch (error) {
        if (error instanceof ConnectorError) throw error
        log.crash(`Failed to disable account ${input.identity}`, error)
    }
}
