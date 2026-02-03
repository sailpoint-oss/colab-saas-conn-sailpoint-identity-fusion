import {
    ConnectorError,
    ConnectorErrorType,
    Response,
    StdEntitlementListInput,
    StdEntitlementListOutput,
} from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'

export const entitlementList = async (
    serviceRegistry: ServiceRegistry,
    input: StdEntitlementListInput,
    res: Response<StdEntitlementListOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log, sources, entitlements } = serviceRegistry

    try {
        log.info(`Listing entitlements for type ${input.type}...`)

        switch (input.type) {
            case 'status':
                entitlements.listStatusEntitlements().forEach((x) => res.send(x))
                break
            case 'action':
                await sources.fetchAllSources()
                entitlements.listActionEntitlements().forEach((x) => res.send(x))
                break
            default:
                throw new ConnectorError(`Invalid entitlement type ${input.type}`, ConnectorErrorType.Generic)
        }

        // TODO: Implement entitlement listing logic

        log.info(`Entitlement listing for type ${input.type} completed`)
    } catch (error) {
        log.crash(`Failed to list entitlements for type ${input.type}`, error)
    }
}
