import { AttributeChangeOp } from '@sailpoint/connector-sdk'
import { FusionAccount } from '../../model/account'
import { ServiceRegistry } from '../../services/serviceRegistry'

/**
 * Fusion action handler - manages fusion account creation/removal.
 * @param serviceRegistry - Request-scoped registry (required for concurrent updates to avoid global state)
 */
export const fusionAction = async (
    fusionAccount: FusionAccount,
    op: AttributeChangeOp,
    serviceRegistry: ServiceRegistry
): Promise<void> => {
    const { log } = serviceRegistry

    log.debug(`Fusion action called for account ${fusionAccount.name} with operation ${op}`)

    if (op === AttributeChangeOp.Add) {
        fusionAccount.addAction('fusion')
    } else if (op === AttributeChangeOp.Remove) {
        fusionAccount.removeAction('fusion')
    }
}
