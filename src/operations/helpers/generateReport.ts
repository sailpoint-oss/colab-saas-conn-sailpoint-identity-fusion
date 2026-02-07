import { ServiceRegistry } from '../../services/serviceRegistry'
import { FusionAccount } from '../../model/account'
import { StandardCommand } from '@sailpoint/connector-sdk'

/**
 * Generates and sends a fusion report for the given account.
 * When called outside of account list, fetches all required data first.
 */
export const generateReport = async (
    fusionAccount: FusionAccount,
    includeNonMatches: boolean = false,
    serviceRegistry?: ServiceRegistry
) => {
    if (!serviceRegistry) {
        serviceRegistry = ServiceRegistry.getCurrent()
    }
    const { fusion, identities, sources, messaging } = serviceRegistry

    if (fusion.commandType !== StandardCommand.StdAccountList) {
        const fetchPromises = [
            messaging.fetchSender(),
            sources.fetchFusionAccounts(),
            identities.fetchIdentities(),
            sources.fetchManagedAccounts(),
        ]

        await Promise.all(fetchPromises)

        await fusion.processFusionAccounts()
        await fusion.processIdentities()

        identities.clear()

        await fusion.analyzeManagedAccounts()
    }

    const report = fusion.generateReport(includeNonMatches)
    await messaging.sendReport(report, fusionAccount)
}
