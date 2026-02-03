import { ServiceRegistry } from '../../services/serviceRegistry'
import { assert } from '../../utils/assert'
import { FusionAccount } from '../../model/account'

export const rebuildFusionAccount = async (
    nativeIdentity: string,
    serviceRegistry?: ServiceRegistry
): Promise<FusionAccount> => {
    if (!serviceRegistry) {
        serviceRegistry = ServiceRegistry.getCurrent()
    }
    const { fusion, identities, sources } = serviceRegistry

    await sources.fetchFusionAccount(nativeIdentity)
    const fusionAccountsMap = sources.fusionAccountsByNativeIdentity
    assert(fusionAccountsMap, 'Fusion accounts have not been loaded')
    const account = fusionAccountsMap.get(nativeIdentity)
    assert(account, 'Fusion account not found')
    assert(account.identityId, 'Identity ID not found')
    await identities.fetchIdentityById(account.identityId)
    const accountIds = account.attributes?.accounts ?? []
    await Promise.all(
        accountIds.map(async (id: string) => {
            await sources.fetchManagedAccount(id)
        })
    )
    return await fusion.processFusionAccount(account)
}
