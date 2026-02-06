import { Response, StdAccountReadInput, StdAccountReadOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'
import { rebuildFusionAccount } from './helpers/rebuildFusionAccount'
import { assert } from '../utils/assert'

export const accountRead = async (
    serviceRegistry: ServiceRegistry,
    input: StdAccountReadInput,
    res: Response<StdAccountReadOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log, fusion, schemas, sources, attributes } = serviceRegistry

    try {
        log.info(`Reading account: ${input.identity}`)
        assert(input.identity, 'Account identity is required')

        log.debug('Step 1: Loading sources and schema')
        await sources.fetchAllSources()
        await schemas.setFusionAccountSchema(input.schema)
        attributes.enableAttributeRefresh()

        log.debug('Step 2: Rebuilding fusion account with fresh attributes')
        const fusionAccount = await rebuildFusionAccount(input.identity, serviceRegistry)
        assert(fusionAccount, `Fusion account not found for identity: ${input.identity}`)
        log.debug(`Found fusion account: ${fusionAccount.name || fusionAccount.nativeIdentity}`)

        log.debug('Step 3: Generating ISC account')
        const iscAccount = await fusion.getISCAccount(fusionAccount)
        assert(iscAccount, 'Failed to generate ISC account from fusion account')

        res.send(iscAccount)
        log.info(`✓ Account read completed for ${input.identity}`)
    } catch (error) {
        log.crash(`Failed to read account ${input.identity}`, error)
    }
}
