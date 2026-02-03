/**
 * Collection utility functions for common Map, Set, and Array operations.
 * These helpers provide a consistent interface for data manipulation across the codebase.
 */

// ============================================================================
// Set Operations
// ============================================================================

/**
 * Converts a Set to an Array
 */
export function setToArray<T>(set: Set<T>): T[] {
    return Array.from(set)
}

/**
 * Converts an Array to a Set
 */
export function arrayToSet<T>(array: T[]): Set<T> {
    return new Set(array)
}

/**
 * Safely gets a value from a Set by converting it to an array and returning the first match
 * Useful when you need to find a specific item in a Set
 */
export function setFind<T>(set: Set<T>, predicate: (value: T) => boolean): T | undefined {
    for (const item of set) {
        if (predicate(item)) {
            return item
        }
    }
    return undefined
}

/**
 * Filters a Set and returns a new Set with matching items
 */
export function setFilter<T>(set: Set<T>, predicate: (value: T) => boolean): Set<T> {
    const result = new Set<T>()
    for (const item of set) {
        if (predicate(item)) {
            result.add(item)
        }
    }
    return result
}

// ============================================================================
// Map Operations
// ============================================================================

/**
 * Converts a Map to an Array of its values
 */
export function mapValuesToArray<K, V>(map: Map<K, V>): V[] {
    return Array.from(map.values())
}

/**
 * Converts a Map to an Array of its keys
 */
export function mapKeysToArray<K, V>(map: Map<K, V>): K[] {
    return Array.from(map.keys())
}

/**
 * Converts a Map to an Array of [key, value] pairs
 */
export function mapEntriesToArray<K, V>(map: Map<K, V>): [K, V][] {
    return Array.from(map.entries())
}

/**
 * Creates a Map from an array using a key selector function
 */
export function arrayToMap<T, K>(array: T[], keySelector: (item: T) => K): Map<K, T> {
    return new Map(array.map((item) => [keySelector(item), item]))
}

/**
 * Creates a Map from an array using both key and value selector functions
 */
export function arrayToMapWithValue<T, K, V>(
    array: T[],
    keySelector: (item: T) => K,
    valueSelector: (item: T) => V
): Map<K, V> {
    return new Map(array.map((item) => [keySelector(item), valueSelector(item)]))
}

/**
 * Safely gets a value from a Map, returning undefined if not found
 * (This is the same as Map.get but provides a consistent interface)
 */
export function mapGet<K, V>(map: Map<K, V>, key: K): V | undefined {
    return map.get(key)
}

/**
 * Gets a value from a Map or returns a default value if not found
 */
export function mapGetOrDefault<K, V>(map: Map<K, V>, key: K, defaultValue: V): V {
    return map.get(key) ?? defaultValue
}

/**
 * Gets a value from a Map or creates and sets a default value if not found
 */
export function mapGetOrCreate<K, V>(map: Map<K, V>, key: K, createFn: () => V): V {
    const existing = map.get(key)
    if (existing !== undefined) {
        return existing
    }
    const newValue = createFn()
    map.set(key, newValue)
    return newValue
}

// ============================================================================
// Array Operations
// ============================================================================

/**
 * Groups an array by a key selector function
 */
export function groupBy<T, K>(array: T[], keySelector: (item: T) => K): Map<K, T[]> {
    const result = new Map<K, T[]>()
    for (const item of array) {
        const key = keySelector(item)
        const group = result.get(key) ?? []
        group.push(item)
        result.set(key, group)
    }
    return result
}

/**
 * Partitions an array into two arrays based on a predicate
 * Returns [matching, nonMatching]
 */
export function partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
    const matching: T[] = []
    const nonMatching: T[] = []
    for (const item of array) {
        if (predicate(item)) {
            matching.push(item)
        } else {
            nonMatching.push(item)
        }
    }
    return [matching, nonMatching]
}

/**
 * Removes duplicates from an array based on a key selector
 */
export function uniqueBy<T, K>(array: T[], keySelector: (item: T) => K): T[] {
    const seen = new Set<K>()
    const result: T[] = []
    for (const item of array) {
        const key = keySelector(item)
        if (!seen.has(key)) {
            seen.add(key)
            result.push(item)
        }
    }
    return result
}

/**
 * Flattens an array of arrays into a single array
 */
export function flatten<T>(arrays: T[][]): T[] {
    return arrays.flat()
}

/**
 * Safely gets the first item from an array or undefined
 */
export function first<T>(array: T[]): T | undefined {
    return array[0]
}

/**
 * Safely gets the last item from an array or undefined
 */
export function last<T>(array: T[]): T | undefined {
    return array[array.length - 1]
}

// ============================================================================
// Type Guards and Helpers
// ============================================================================

/**
 * Filters out null and undefined values from an array
 */
export function compact<T>(array: (T | null | undefined)[]): T[] {
    return array.filter((item): item is T => item !== null && item !== undefined)
}

/**
 * Checks if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined
}

/**
 * Checks if a string is non-empty
 */
export function isNonEmptyString(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0
}
