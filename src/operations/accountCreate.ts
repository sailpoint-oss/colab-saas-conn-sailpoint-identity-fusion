import { AttributeChangeOp, ConnectorError, Response, StdAccountCreateInput, StdAccountCreateOutput } from '@sailpoint/connector-sdk'
import { ServiceRegistry } from '../services/serviceRegistry'
import { assert } from '../utils/assert'
import { reportAction } from './actions/reportAction'
import { fusionAction } from './actions/fusionAction'
import { correlateAction } from './actions/correlateAction'

/**
 * Account create operation - Creates a new fusion account for an identity.
 *
 * Processing Flow:
 * 1. SETUP: Load sources, schema, and initialize attribute counters
 * 2. IDENTITY: Fetch the target identity by name and locate its fusion identity
 * 3. ACTIONS: Execute requested actions (report, fusion, correlate) against the fusion identity
 * 4. OUTPUT: Generate and return the ISC account representation
 *
 * @param serviceRegistry - Service registry providing access to all connector services
 * @param input - SDK input containing the identity name and requested actions
 * @param res - SDK response object for sending the created account back to the platform
 */
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

        log.info(`Creating account for identity: ${identityName}`)
        const timer = log.timer()

        await sources.fetchFusionAccounts()
        await attributes.initializeCounters()
        await fusion.preProcessFusionAccounts()
        timer.phase('Step 1: Loading fusion accounts and initializing', 'debug')

        const identity = await identities.fetchIdentityByName(identityName)
        assert(identity, `Identity not found: ${identityName}`)
        assert(identity.id, `Identity ID is missing for: ${identityName}`)

        const fusionIdentity = fusion.getFusionIdentity(identity.id)
        assert(fusionIdentity, `Fusion identity not found for identity ID: ${identity.id}`)
        log.debug(`Found fusion identity: ${fusionIdentity.nativeIdentity}`)
        timer.phase('Step 2: Fetching identity information', 'debug')

        const actions = [...(input.attributes.actions ?? [])]
        log.info(`Processing ${actions.length} action(s)`)

        for (const action of actions) {
            log.debug(`Executing action: ${action}`)
            switch (action) {
                case 'report':
                    await reportAction(fusionIdentity, AttributeChangeOp.Add, serviceRegistry)
                    log.debug('Report action completed')
                    break
                case 'fusion':
                    await fusionAction(fusionIdentity, AttributeChangeOp.Add, serviceRegistry)
                    log.debug('Fusion action completed')
                    break
                case 'correlate':
                    await correlateAction(fusionIdentity, AttributeChangeOp.Add, serviceRegistry)
                    log.debug('Correlate action completed')
                    break
                default:
                    log.crash(`Unsupported action: ${action}`)
            }
        }
        timer.phase(`Step 3: Processing ${actions.length} action(s)`, 'debug')

        const iscAccount = await fusion.getISCAccount(fusionIdentity)
        assert(iscAccount, 'Failed to generate ISC account from fusion identity')
        timer.phase('Step 4: Generating ISC account', 'debug')

        res.send(iscAccount)
        timer.end(`✓ Account creation completed for ${identityName}`)
    } catch (error) {
        if (error instanceof ConnectorError) throw error
        log.crash(`Failed to create account ${identityName}`, error)
    }
}
