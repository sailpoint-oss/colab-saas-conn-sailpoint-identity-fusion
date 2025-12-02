import { Account } from 'sailpoint-api-client'
import velocityjs from 'velocityjs'
import { buildAccountAttributesObject, lm } from '.'
import { transliterate } from 'transliteration'
import { Config } from '../model/config'
import * as datefns from 'date-fns'

/**
 * Builds a unique ID for an account, optimized to handle large sets of IDs efficiently.
 * Instead of incrementally checking each counter value, it determines the highest existing
 * counter value and starts from there.
 * Uses a cache to store maxCounter values per baseId to avoid repeated searches.
 */

export class UniqueIdentifierGenerator {
    // Cache to store the maximum counter value for each baseId
    private maxCounterCache: Map<string, number>
    // Cache for compiled VLT templates to avoid re-parsing and re-compilation
    private templateCache: Map<string, any>
    public ids: Set<string>

    constructor() {
        this.maxCounterCache = new Map<string, number>()
        this.templateCache = new Map<string, any>()
        this.ids = new Set<string>()
    }

    buildUniqueID = async (account: Account, config: Config, buildContext: boolean): Promise<string> => {
        const c = 'buildUniqueID'

        // Check if we have a cached compiled template
        let velocity = this.templateCache.get(config.uid_template)
        if (!velocity) {
            // Parse and compile template only once, then cache it
            let template = velocityjs.parse(config.uid_template)
            if (!template.find((x: any) => x.id === 'counter')) {
                template = velocityjs.parse(config.uid_template + '$counter')
            }
            velocity = new velocityjs.Compile(template)
            this.templateCache.set(config.uid_template, velocity)
        }

        // Generate the base ID (without a counter)
        //logger.debug(lm('Building context for base ID', c, 2))
        let context
        if (buildContext) {
            const attributes = buildAccountAttributesObject(account, config.merging_map)
            context = { ...account.attributes, ...attributes }
        } else {
            context = { ...account.attributes }
        }

        context = { ...context, Math, Date, datefns, counter: '' }

        // First try with an empty counter
        //context.counter = ''
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
        if (!this.ids.has(baseId)) {
            //logger.debug(lm(`Final ID: ${baseId}`, c, 2))
            return baseId
        }

        // The base ID already exists, so we need to add a counter
        // Check if we already have the max counter for this baseId in our cache
        let maxCounter = this.maxCounterCache.get(baseId) || 0

        // If not in cache, find the highest counter value for this base ID prefix
        if (maxCounter === 0) {
            const baseIdRegex = new RegExp(`^${baseId}(\\d+)$`)

            for (const id of this.ids) {
                const match = id.match(baseIdRegex)
                if (match) {
                    const counterValue = parseInt(match[1], 10)
                    maxCounter = Math.max(maxCounter, counterValue)
                }
            }

            // Store the result in our cache
            this.maxCounterCache.set(baseId, maxCounter)
        }

        // Start with the next counter value
        const nextCounter = maxCounter + 1

        // Update the cache with the new max counter value
        this.maxCounterCache.set(baseId, nextCounter)
        const paddedCounter = '0'.repeat(Math.max(0, config.uid_digits - nextCounter.toString().length)) + nextCounter
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
}
