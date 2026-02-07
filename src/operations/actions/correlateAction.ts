import { AttributeChangeOp } from '@sailpoint/connector-sdk'
import { FusionAccount } from '../../model/account'
import { ServiceRegistry } from '../../services/serviceRegistry'

/**
 * Correlate action handler - correlates missing source accounts.
 * @param serviceRegistry - Request-scoped registry (required for concurrent updates to avoid global state)
 */
export const correlateAction = async (
    fusionAccount: FusionAccount,
    op: AttributeChangeOp,
    serviceRegistry: ServiceRegistry
): Promise<void> => {
    const { log, identities } = serviceRegistry

    log.debug(`Correlate action called for account ${fusionAccount.name} with operation ${op}`)

    if (op === AttributeChangeOp.Add) {
        // Trigger correlation for all missing accounts
        await identities.correlateAccounts(fusionAccount)
    } else if (op === AttributeChangeOp.Remove) {
        // Removing the correlate action doesn't undo correlations, just removes the action
        log.debug(`Correlate action removed for account ${fusionAccount.name}`)
    }
}
