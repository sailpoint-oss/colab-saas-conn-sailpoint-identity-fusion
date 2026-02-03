import { Response, StdAccountDisableInput, StdAccountDisableOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'
import { rebuildFusionAccount } from './helpers/rebuildFusionAccount'
import { assert } from '../utils/assert'

export const accountDisable = async (
    serviceRegistry: ServiceRegistry,
    input: StdAccountDisableInput,
    res: Response<StdAccountDisableOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log, fusion, sources, schemas } = serviceRegistry

    try {
        log.info(`Disabling account ${input.identity}...`)
        assert(input.identity, 'Account identity is required')

        await sources.fetchAllSources()
        await schemas.setFusionAccountSchema(input.schema)

        const fusionAccount = await rebuildFusionAccount(input.identity, serviceRegistry)
        assert(fusionAccount, `Fusion account not found for identity: ${input.identity}`)

        log.debug(`Disabling fusion account: ${fusionAccount.name || fusionAccount.nativeIdentity}`)
        fusionAccount.disable()

        const iscAccount = await fusion.getISCAccount(fusionAccount)
        assert(iscAccount, 'Failed to generate ISC account from fusion account')

        res.send(iscAccount)
        log.info(`Account ${input.identity} disable completed`)
    } catch (error) {
        log.crash(`Failed to disable account ${input.identity}`, error)
    }
}
