import { logger } from '@sailpoint/connector-sdk'
import { Account } from 'sailpoint-api-client'
import velocityjs from 'velocityjs'
import { buildAccountAttributesObject, lm } from '.'
import { transliterate } from 'transliteration'
import { Config } from '../model/config'

/**
 * Builds a unique ID for an account, optimized to handle large sets of IDs efficiently.
 * Instead of incrementally checking each counter value, it determines the highest existing 
 * counter value and starts from there.
 */
export const buildUniqueID = async (
    account: Account,
    currentIDs: Set<string>,
    config: Config,
    buildContext: boolean
): Promise<string> => {
    const c = 'buildUniqueID'

    let template = velocityjs.parse(config.uid_template)
    if (!template.find((x) => x.id === 'counter')) {
        template = velocityjs.parse(config.uid_template + '$counter')
    }
    const velocity = new velocityjs.Compile(template)

    // Generate the base ID (without a counter)
    logger.debug(lm('Building context for base ID', c, 2))
    let context
    if (buildContext) {
        const attributes = buildAccountAttributesObject(account, config.merging_map)
        context = { ...account.attributes, ...attributes }
    } else {
        context = { ...account.attributes }
    }

    // First try with an empty counter
    context.counter = ''
    let baseId = velocity.render(context)
    logger.debug(lm(`Template base ID: ${baseId}`, c, 2))
    
    if (baseId.length === 0) {
        throw new Error('No value returned by template')
    }

    // Apply formatting to the base ID
    if (config.uid_normalize) {
        baseId = transliterate(baseId)
        baseId = baseId.replace(/'/g, '')
    }

    if (config.uid_spaces) {
        baseId = baseId.replace(/\s/g, '')
    }

    switch (config.uid_case) {
        case 'lower':
            baseId = baseId.toLowerCase()
            break
        case 'upper':
            baseId = baseId.toUpperCase()
            break
        default:
            break
    }

    // If the base ID is unique, return it immediately
    if (!currentIDs.has(baseId)) {
        logger.debug(lm(`Final ID: ${baseId}`, c, 2))
        return baseId
    }

    // The base ID already exists, so we need to add a counter
    // Find the highest counter value for this base ID prefix
    const baseIdRegex = new RegExp(`^${baseId}(\\d+)$`)
    let maxCounter = 0

    for (const id of currentIDs) {
        const match = id.match(baseIdRegex)
        if (match) {
            const counterValue = parseInt(match[1], 10)
            maxCounter = Math.max(maxCounter, counterValue)
        }
    }

    // Start with the next counter value
    const nextCounter = maxCounter + 1
    const paddedCounter = '0'.repeat(
        Math.max(0, config.uid_digits - nextCounter.toString().length)
    ) + nextCounter
    context.counter = paddedCounter

    // Generate the ID with the new counter
    let uniqueId = velocity.render(context)
    
    // Apply formatting to the final ID
    if (config.uid_normalize) {
        uniqueId = transliterate(uniqueId)
        uniqueId = uniqueId.replace(/'/g, '')
    }

    if (config.uid_spaces) {
        uniqueId = uniqueId.replace(/\s/g, '')
    }

    switch (config.uid_case) {
        case 'lower':
            uniqueId = uniqueId.toLowerCase()
            break
        case 'upper':
            uniqueId = uniqueId.toUpperCase()
            break
        default:
            break
    }

    logger.debug(lm(`Final ID with counter: ${uniqueId}`, c, 2))
    return uniqueId
}

// export const buildUniqueAccount = async (
//     account: Account,
//     status: string,
//     msg: string | undefined,
//     identities: IdentityDocument[],
//     currentIDs: string[],
//     config: Config
// ): Promise<Account> => {
//     const c = 'buildUniqueAccount'
//     logger.debug(lm(`Processing ${account.name} (${account.id})`, c, 1))
//     let uniqueID: string

//     uniqueID = await buildUniqueID(account, currentIDs, config)

//     if (status !== 'reviewer') {
//         uniqueID = await buildUniqueID(account, currentIDs, config)
//     } else {
//         logger.debug(lm(`Taking identity uid as unique ID`, c, 1))
//         const identity = identities.find((x) => x.id === account.identityId) as IdentityDocument
//         uniqueID = identity?.attributes!.uid
//     }

//     const uniqueAccount: Account = { ...account }
//     uniqueAccount.attributes!.uniqueID = uniqueID
//     uniqueAccount.attributes!.accounts = [account.id]
//     uniqueAccount.attributes!.status = [status]
//     uniqueAccount.attributes!.reviews = []

//     if (msg) {
//         const message = datedMessage(msg, account)
//         uniqueAccount.attributes!.history = [message]
//     }
//     return uniqueAccount
// }

// export const buildUniqueAccountFromID = async (
//     id: string,
//     schema: AccountSchema,
//     source: Source,
//     identities: IdentityDocument[],
//     config: Config,
//     client: SDKClient
// ): Promise<UniqueAccount> => {
//     const c = 'buildUniqueAccountFromID'
//     logger.debug(lm(`Fetching original account`, c, 1))
//     const account = await client.getAccountBySourceAndNativeIdentity(source.id!, id)
//     const sourceAccounts: Account[] = []
//     if (account) {
//         const identity = await client.getIdentity(account.identityId!)
//         const accounts = await client.getAccountsByIdentity(identity!.id!)
//         const correlatedAccounts = accounts
//             .filter((x) => config.sources.includes(x.sourceName!))
//             .map((x) => x.id as string)
//         account.attributes!.accounts = combineArrays(correlatedAccounts, account.attributes!.accounts)

//         for (const acc of account.attributes!.accounts) {
//             logger.debug(lm(`Looking for ${acc} account`, c, 1))
//             const response = await client.getAccount(acc)
//             if (response) {
//                 logger.debug(lm(`Found linked account ${response.name} (${response.sourceName})`, c, 1))
//                 sourceAccounts.push(response)
//             } else {
//                 logger.error(lm(`Unable to find account ID ${acc}`, c, 1))
//             }
//         }

//         const uniqueAccount = await refreshAccount(account, sourceAccounts, schema, identities, config, client)
//         return uniqueAccount
//     } else {
//         throw new ConnectorError('Account not found', ConnectorErrorType.NotFound)
//     }
// }
