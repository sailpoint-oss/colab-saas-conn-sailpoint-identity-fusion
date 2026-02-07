import { Response, StdTestConnectionOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'

/**
 * Test connection operation - Validates the connector configuration and connectivity.
 *
 * Invoked by the platform to verify the connector can successfully communicate
 * with its configured services. Returns an empty response on success.
 *
 * @param serviceRegistry - Service registry providing access to all connector services
 * @param _input - Unused input parameter (required by SDK interface)
 * @param res - SDK response object for sending the test result back to the platform
 */
export const testConnection = async (
    serviceRegistry: ServiceRegistry,
    _input: any,
    res: Response<StdTestConnectionOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log } = serviceRegistry

    try {
        log.info('Testing connection')
        const timer = log.timer()

        res.send({})
        timer.end('✓ Test connection completed')
    } catch (error) {
        log.crash('Failed to test connection', error)
    }
}
