import { Response, StdAccountDiscoverSchemaOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'

export const accountDiscoverSchema = async (
    serviceRegistry: ServiceRegistry,
    res: Response<StdAccountDiscoverSchemaOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log, schemas, sources } = serviceRegistry

    try {
        log.info('Discovering account schema...')

        await sources.fetchAllSources()
        const accountSchema = await schemas.buildDynamicSchema()
        res.send(accountSchema)

        log.info('Account schema discovery completed')
    } catch (error) {
        log.crash('Failed to discover account schema', error)
    }
}
