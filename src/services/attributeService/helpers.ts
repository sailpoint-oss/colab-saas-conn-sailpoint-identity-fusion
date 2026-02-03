import { AttributeDefinition } from '../../model/config'
import { Attributes } from '@sailpoint/connector-sdk'
import { AttributeMappingConfig } from './types'
import { UNIQUE_ATTRIBUTE_TYPES } from './constants'

// ============================================================================
// Helper Functions
// ============================================================================

export const isUniqueAttribute = (definition: AttributeDefinition): boolean => {
    return definition.type !== undefined && UNIQUE_ATTRIBUTE_TYPES.includes(definition.type as any)
}

// Pre-compiled regex for better performance
const BRACKET_REGEX = /\[([^ ].+?)\]/g

/**
 * Split attribute value that may contain bracketed values like [value1] [value2]
 * Optimized to use pre-compiled regex and matchAll for better performance
 */
export const attrSplit = (text: string): string[] => {
    const set = new Set<string>()
    
    // Use matchAll for cleaner and potentially faster iteration
    const matches = text.matchAll(BRACKET_REGEX)
    for (const match of matches) {
        if (match[1]) {
            set.add(match[1])
        }
    }

    return set.size === 0 ? [text] : [...set]
}

/**
 * Concatenate array of strings into bracketed format: [value1] [value2]
 * Optimized to avoid unnecessary array operations and early return for empty lists
 * 
 * @param list - Array of strings to concatenate
 * @param alreadyProcessed - If true, assumes list is already deduplicated and sorted (for performance)
 */
export const attrConcat = (list: string[], alreadyProcessed: boolean = false): string => {
    if (list.length === 0) {
        return ''
    }
    
    // If already deduplicated and sorted (e.g., from processAttributeMapping), skip redundant work
    const unique = alreadyProcessed 
        ? list 
        : Array.from(new Set(list)).sort()
    
    return unique.map((x) => `[${x}]`).join(' ')
}

/**
 * Process a single attribute from source accounts based on processing configuration
 */
export const processAttributeMapping = (
    config: AttributeMappingConfig,
    sourceAttributeMap: Map<string, Attributes[]>,
    sourceOrder: string[]
): any => {
    const { attributeMerge } = config

    // Handle single-value merge strategies with early return
    if (attributeMerge === 'first' || attributeMerge === 'source') {
        return processSingleValueMerge(config, sourceAttributeMap, sourceOrder)
    }

    // Handle multi-value merge strategies
    return processMultiValueMerge(config, sourceAttributeMap, sourceOrder)
}

/**
 * Process attribute mapping for single-value merge strategies ('first' or 'source')
 * Returns the first matching value found or undefined
 */
const processSingleValueMerge = (
    config: AttributeMappingConfig,
    sourceAttributeMap: Map<string, Attributes[]>,
    sourceOrder: string[]
): any => {
    const { sourceAttributes, attributeName, attributeMerge, source: specifiedSource } = config
    const attributeNames = Array.from(new Set([...sourceAttributes, attributeName]))

    for (const sourceName of sourceOrder) {
        // For 'source' merge strategy, only process the specified source
        if (attributeMerge === 'source' && specifiedSource && sourceName !== specifiedSource) {
            continue
        }

        const accounts = sourceAttributeMap.get(sourceName)
        if (!accounts || accounts.length === 0) {
            continue
        }

        const firstValue = findFirstAttributeValue(accounts, attributeNames)
        if (firstValue !== undefined) {
            return firstValue
        }
    }

    return undefined
}

/**
 * Find the first attribute value from a list of accounts
 */
const findFirstAttributeValue = (accounts: Attributes[], attributeNames: string[]): any => {
    for (const account of accounts) {
        for (const attribute of attributeNames) {
            const value = account[attribute]
            if (value !== undefined && value !== null && value !== '') {
                const splitValues = typeof value === 'string' ? attrSplit(value) : [value]
                return splitValues[0]
            }
        }
    }
    return undefined
}

/**
 * Process attribute mapping for multi-value merge strategies ('list' or 'concatenate')
 * Returns a list of unique sorted values or a concatenated string
 */
const processMultiValueMerge = (
    config: AttributeMappingConfig,
    sourceAttributeMap: Map<string, Attributes[]>,
    sourceOrder: string[]
): any => {
    const { sourceAttributes, attributeName, attributeMerge } = config
    const attributeNames = Array.from(new Set([...sourceAttributes, attributeName]))
    const allValues = collectAllAttributeValues(sourceAttributeMap, sourceOrder, attributeNames)

    if (allValues.length === 0) {
        return undefined
    }

    // Deduplicate and sort once for both 'list' and 'concatenate' strategies
    const uniqueSorted = [...new Set(allValues)].sort()

    if (attributeMerge === 'list') {
        return uniqueSorted
    } else if (attributeMerge === 'concatenate') {
        // Pass true to skip redundant deduplication/sorting since we already did it above
        return attrConcat(uniqueSorted, true)
    }

    return undefined
}

/**
 * Collect all attribute values from sources in order
 */
const collectAllAttributeValues = (
    sourceAttributeMap: Map<string, Attributes[]>,
    sourceOrder: string[],
    attributeNames: string[]
): string[] => {
    const allValues: string[] = []

    for (const sourceName of sourceOrder) {
        const accounts = sourceAttributeMap.get(sourceName)
        if (!accounts || accounts.length === 0) {
            continue
        }

        const sourceValues = extractValuesFromAccounts(accounts, attributeNames)
        allValues.push(...sourceValues)
    }

    return allValues
}

/**
 * Extract and split all attribute values from a list of accounts
 */
const extractValuesFromAccounts = (accounts: Attributes[], attributeNames: string[]): string[] => {
    const values: string[] = []

    for (const account of accounts) {
        for (const attribute of attributeNames) {
            const value = account[attribute]
            if (value !== undefined && value !== null && value !== '') {
                let splitValues: string[]
                if (typeof value === 'string') {
                    splitValues = attrSplit(value)
                } else {
                    // Convert non-string values to strings
                    splitValues = [String(value)]
                }
                values.push(...splitValues)
            }
        }
    }

    return values
}

/**
 * Build processing configuration for an attribute by merging schema with attributeMaps
 */
export const buildAttributeMappingConfig = (
    attributeName: string,
    attributeMaps: any[] | undefined,
    defaultAttributeMerge: 'first' | 'list' | 'concatenate'
): AttributeMappingConfig => {
    // Check if attribute has specific configuration in attributeMaps
    const attributeMap = attributeMaps?.find((am) => am.newAttribute === attributeName)

    if (attributeMap) {
        // Use attributeMap configuration
        return {
            attributeName,
            sourceAttributes: attributeMap.existingAttributes || [attributeName],
            attributeMerge: attributeMap.attributeMerge || defaultAttributeMerge,
            source: attributeMap.source,
        }
    } else {
        // Use global attributeMerge policy with direct attribute name
        return {
            attributeName,
            sourceAttributes: [attributeName],
            attributeMerge: defaultAttributeMerge,
        }
    }
}
