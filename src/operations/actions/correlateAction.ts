import { AttributeChangeOp } from '@sailpoint/connector-sdk'
import { FusionAccount } from '../../model/account'
import { ServiceRegistry } from '../../services/serviceRegistry'

/**
 * Correlate action handler
 * Correlates missing source accounts when the "correlate" action is added
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
        if (fusionAccount.missingAccountIds.length > 0) {
            log.info(
                `Triggering correlation for ${fusionAccount.missingAccountIds.length} missing account(s) for fusion account ${fusionAccount.name}`
            )
            await identities.correlateAccounts(fusionAccount)
        } else {
            log.debug(`No missing accounts to correlate for fusion account ${fusionAccount.name}`)
        }
    } else if (op === AttributeChangeOp.Remove) {
        // Removing the correlate action doesn't undo correlations, just removes the action
        log.debug(`Correlate action removed for account ${fusionAccount.name}`)
    }
}
