import { logger } from '@sailpoint/connector-sdk'
import { Datefns } from './dateUtils'
import parse from 'any-date-parser'
import { CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js'
import { State, City } from './geoData'
// @ts-expect-error - no types available
import parseAddressString from 'parse-address-string'
import { capitalizeFirst } from '../../utils'

/**
 * Wraps a Normalize helper that may return undefined. When it does, logs and returns ''
 * so Velocity renders nothing instead of the raw expression.
 */
function withNormalizeFallback<T extends (...args: any[]) => string | undefined>(
    helperName: string,
    fn: T
): (...args: Parameters<T>) => string {
    return (...args: Parameters<T>): string => {
        const result = fn(...args)
        if (result === undefined) {
            logger.debug(`Normalize.${helperName} returned undefined for input: ${JSON.stringify(args[0])}`)
            return ''
        }
        return result
    }
}

interface ParsedAddress {
    street_address1?: string
    street_address2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
}

// ============================================================================
// Address Helpers (using city-state for US cities)
// ============================================================================

// Cache for US cities to avoid repeated filtering
// Key: lowercase city name, Value: { stateName, stateCode }
const usCityCache = new Map<string, { stateName?: string; stateCode: string } | null>()

// Pre-populate cache on first use
let usCitiesCached = false
const ensureUsCitiesCached = (): void => {
    if (usCitiesCached) return

    const usCities = City.getCitiesOfCountry('US')
    if (!usCities) return

    // Build a map of city name -> state info
    for (const city of usCities) {
        const key = city.name.toLowerCase()
        // Only store first occurrence of each city name
        if (!usCityCache.has(key)) {
            const state = State.getStateByCodeAndCountry(city.stateCode, 'US')
            usCityCache.set(key, {
                stateName: state?.name,
                stateCode: city.stateCode
            })
        }
    }

    usCitiesCached = true
}

/**
 * Get state code from city name (US only)
 * @param city - City name (e.g., 'Seattle')
 * @returns State code (e.g., 'WA') or undefined
 */
const getCityState = (city: string): string | undefined => {
    if (!city) return undefined

    ensureUsCitiesCached()

    const key = city.trim().toLowerCase()
    const cached = usCityCache.get(key)
    return cached?.stateName
}

const getCityStateCode = (city: string): string | undefined => {
    if (!city) return undefined

    ensureUsCitiesCached()

    const key = city.trim().toLowerCase()
    const cached = usCityCache.get(key)
    return cached?.stateCode
}

/**
 * Parse address string into components (synchronous)
 * @param addressString - Full address to parse
 * @returns Parsed address components or null if parsing fails
 */
const parseAddressSync = (addressString: string): ParsedAddress | null => {
    let result: ParsedAddress | null = null
    let error: Error | null = null

    // Call the callback-based function synchronously
    parseAddressString(addressString, (err: Error | null, parsed: ParsedAddress | null) => {
        error = err
        result = parsed
    })

    return error ? null : result
}

const normalizeDate = (date: string): string | undefined => {
    return parse.fromAny(date).toISOString()
}

const normalizePhoneNumber = (phone: string, defaultCountry: CountryCode = 'US'): string | undefined => {
    return parsePhoneNumberFromString(phone, defaultCountry)?.formatInternational()
}

/**
 * Properly capitalizes names, handling special cases like:
 * - O'Brien, O'Connor (apostrophes)
 * - McDonald, MacArthur (Mac/Mc prefixes)
 * - van der Berg, de la Cruz (particles)
 * - Mary-Jane (hyphens)
 */
const properCaseName = (name: string): string => {
    if (!name) return name

    // Split on spaces to handle each part separately
    return name
        .split(' ')
        .map((part) => {
            if (!part) return part

            // Handle hyphenated names (e.g., Mary-Jane)
            if (part.includes('-')) {
                return part
                    .split('-')
                    .map((p) => properCaseName(p))
                    .join('-')
            }

            // Handle apostrophes (e.g., O'Brien, D'Angelo)
            if (part.includes("'")) {
                const parts = part.split("'")
                return parts.map((p) => capitalizeFirst(p.toLowerCase())).join("'")
            }

            // Handle Mc/Mac prefixes (e.g., McDonald, MacArthur)
            const lower = part.toLowerCase()
            if (lower.startsWith('mc') && part.length > 2) {
                return 'Mc' + capitalizeFirst(lower.slice(2))
            }
            if (lower.startsWith('mac') && part.length > 3) {
                return 'Mac' + capitalizeFirst(lower.slice(3))
            }

            // Handle lowercase particles (van, von, de, del, etc.)
            if (['van', 'von', 'de', 'del', 'della', 'di', 'da', 'le', 'la'].includes(lower)) {
                return lower
            }

            // Default: capitalize first letter, lowercase the rest
            return capitalizeFirst(lower)
        })
        .join(' ')
}

const normalizeFullName = (name: string): string | undefined => {
    if (!name || !name.trim()) return undefined

    // Simple name parsing: split by spaces and take first and last
    const parts = name.trim().split(/\s+/)

    if (parts.length === 0) return undefined
    if (parts.length === 1) {
        // Only one name part, treat as last name
        return properCaseName(parts[0])
    }

    // First name is the first part, last name is the last part
    // Middle names/initials are included with the first name
    const firstName = parts.slice(0, -1).join(' ')
    const lastName = parts[parts.length - 1]

    const normalizedFirst = properCaseName(firstName)
    const normalizedLast = properCaseName(lastName)

    return `${normalizedFirst} ${normalizedLast}`
}

const normalizeSSN = (ssn: string): string | undefined => {
    if (!ssn) return undefined
    // Remove all non-digits
    const cleaned = ssn.replace(/\D/g, '')
    // Return standardized format (just digits) or undefined if invalid length
    return cleaned.length === 9 ? cleaned : undefined
}

/**
 * Normalize address using full parser, with fallback to regex
 * @param address - Full address string
 * @returns Normalized address or original if parsing fails
 */
const normalizeAddress = (address: string): string | undefined => {
    if (!address) return undefined

    // Try full address parser first
    const parsed = parseAddressSync(address)
    if (parsed) {
        const parts: string[] = []
        if (parsed.street_address1) parts.push(parsed.street_address1)
        if (parsed.street_address2) parts.push(parsed.street_address2)
        if (parsed.city) parts.push(parsed.city)
        if (parsed.state) parts.push(parsed.state)
        if (parsed.postal_code) parts.push(parsed.postal_code)

        if (parts.length > 0) {
            return parts.join(', ')
        }
    }

    // Fallback to regex pattern matching
    const cityStateMatch = address.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})?/i)
    if (cityStateMatch) {
        const [, city, stateInput, zip] = cityStateMatch
        // Try to get state by code or name
        const state = State.getStateByCodeAndCountry(stateInput.trim().toUpperCase(), 'US')
        const stateCode = state?.isoCode
        if (stateCode) {
            return zip
                ? `${city.trim()}, ${stateCode} ${zip.trim()}`
                : `${city.trim()}, ${stateCode}`
        }
    }

    return address.trim()
}

const AddressParse = {
    getCityState,
    getCityStateCode,
    parse: parseAddressSync
}

const Normalize = {
    date: withNormalizeFallback('date', normalizeDate),
    phone: withNormalizeFallback('phone', normalizePhoneNumber),
    name: withNormalizeFallback('name', properCaseName),
    fullName: withNormalizeFallback('fullName', normalizeFullName),
    ssn: withNormalizeFallback('ssn', normalizeSSN),
    address: withNormalizeFallback('address', normalizeAddress)
}

export const contextHelpers = { Datefns, Math, AddressParse, Normalize }