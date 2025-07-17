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
 * Uses a cache to store maxCounter values per baseId to avoid repeated searches.
 */

// Cache to store the maximum counter value for each baseId
const maxCounterCache = new Map<string, number>();
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
    //logger.debug(lm('Building context for base ID', c, 2))
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
    //logger.debug(lm(`Template base ID: ${baseId}`, c, 2))
    
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
        //logger.debug(lm(`Final ID: ${baseId}`, c, 2))
        return baseId
    }

    // The base ID already exists, so we need to add a counter
    // Check if we already have the max counter for this baseId in our cache
    let maxCounter = maxCounterCache.get(baseId) || 0
    
    // If not in cache, find the highest counter value for this base ID prefix
    if (maxCounter === 0) {
        const baseIdRegex = new RegExp(`^${baseId}(\\d+)$`)
        
        for (const id of currentIDs) {
            const match = id.match(baseIdRegex)
            if (match) {
                const counterValue = parseInt(match[1], 10)
                maxCounter = Math.max(maxCounter, counterValue)
            }
        }
        
        // Store the result in our cache
        maxCounterCache.set(baseId, maxCounter)
    }

    // Start with the next counter value
    const nextCounter = maxCounter + 1
    
    // Update the cache with the new max counter value
    maxCounterCache.set(baseId, nextCounter)
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

    //logger.debug(lm(`Final ID with counter: ${uniqueId}`, c, 2))
    return uniqueId
}