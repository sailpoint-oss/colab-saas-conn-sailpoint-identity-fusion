import { AttributeChangeOp } from '@sailpoint/connector-sdk'
import { FusionAccount } from '../../model/account'
import { ServiceRegistry } from '../../services/serviceRegistry'
import { generateReport } from '../helpers/generateReport'

/**
 * Report action handler - generates and sends a fusion report.
 * @param serviceRegistry - Request-scoped registry (required for concurrent updates to avoid global state)
 */
export const reportAction = async (
    fusionAccount: FusionAccount,
    op: AttributeChangeOp,
    serviceRegistry: ServiceRegistry
): Promise<void> => {
    if (op === AttributeChangeOp.Add) {
        await generateReport(fusionAccount, true, serviceRegistry)
    }
}
