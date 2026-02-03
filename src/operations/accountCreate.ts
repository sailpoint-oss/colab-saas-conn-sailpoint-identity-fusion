import { AttributeChangeOp, Response, StdAccountCreateInput, StdAccountCreateOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'
import { assert } from '../utils/assert'
import { reportAction } from './actions/reportAction'
import { fusionAction } from './actions/fusionAction'
import { correlateAction } from './actions/correlateAction'

export const accountCreate = async (
    serviceRegistry: ServiceRegistry,
    input: StdAccountCreateInput,
    res: Response<StdAccountCreateOutput>
) => {
    ServiceRegistry.setCurrent(serviceRegistry)
    const { log, identities, sources, schemas, fusion, attributes } = serviceRegistry

    let identityName = input.attributes.name ?? input.identity
    try {
        assert(input.identity, 'Account identity is required')
        assert(input.schema, 'Account schema is required')

        await sources.fetchAllSources()
        await schemas.setFusionAccountSchema(input.schema)
        const { fusionDisplayAttribute } = schemas
        assert(fusionDisplayAttribute, 'Fusion display attribute not found in schema')

        identityName = input.attributes[fusionDisplayAttribute] ?? identityName
        assert(identityName, 'Identity name is required for account creation')

        log.info(`Creating account ${identityName}...`)

        await sources.fetchFusionAccounts()
        await attributes.initializeCounters()
        await fusion.preProcessFusionAccounts()
        const identity = await identities.fetchIdentityByName(identityName)
        assert(identity, `Identity not found: ${identityName}`)
        assert(identity.id, `Identity ID is missing for: ${identityName}`)

        const fusionIdentity = fusion.getFusionIdentity(identity.id)
        assert(fusionIdentity, `Fusion identity not found for identity ID: ${identity.id}`)

        const actions = [...(input.attributes.actions ?? [])]
        log.debug(`Processing ${actions.length} action(s) for account creation`)

        for (const action of actions) {
            log.debug(`Processing action: ${action}`)
            switch (action) {
                case 'report':
                    await reportAction(fusionIdentity, AttributeChangeOp.Add, serviceRegistry)
                    break
                case 'fusion':
                    await fusionAction(fusionIdentity, AttributeChangeOp.Add, serviceRegistry)
                    break
                case 'correlate':
                    await correlateAction(fusionIdentity, AttributeChangeOp.Add, serviceRegistry)
                    break
                default:
                    log.crash(`Unsupported action: ${action}`)
            }
        }

        const iscAccount = await fusion.getISCAccount(fusionIdentity)
        assert(iscAccount, 'Failed to generate ISC account from fusion identity')

        res.send(iscAccount)
        log.info(`Account ${identityName} creation completed successfully`)
    } catch (error) {
        log.crash(`Failed to create account ${identityName}`, error)
    }
}
