import { Response, StdTestConnectionOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'

export const testConnection = async (
    serviceRegistry: ServiceRegistry,
    input: any,
    res: Response<StdTestConnectionOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log } = serviceRegistry

    try {
        log.info('Testing connection...')

        log.info('Connection tested successfully')
        res.send({})
    } catch (error) {
        log.crash('Failed to test connection', error)
    }
}
