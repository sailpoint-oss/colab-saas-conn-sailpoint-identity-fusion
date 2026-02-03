/**
 * Lightweight date utility functions
 * Replaces date-fns (38MB) with native Date methods
 * 
 * Provides common date functions for use in Velocity templates
 */

// Compile RegExp patterns once at module level for better performance
const TOKEN_PATTERNS: Record<string, RegExp> = {
    'yyyy': /yyyy/g,
    'yy': /yy/g,
    'MM': /MM/g,
    'M': /M/g,
    'dd': /dd/g,
    'd': /d/g,
    'HH': /HH/g,
    'H': /H/g,
    'mm': /mm/g,
    'm': /m/g,
    'ss': /ss/g,
    's': /s/g,
}

/**
 * Format a date to ISO string
 */
export function format(date: Date | string | number, formatStr?: string): string {
    const d = new Date(date)
    
    if (isNaN(d.getTime())) {
        throw new Error('Invalid date')
    }

    // If no format string, return ISO
    if (!formatStr) {
        return d.toISOString()
    }

    // Simple format string support (common patterns only)
    const tokens: Record<string, string> = {
        'yyyy': d.getFullYear().toString(),
        'yy': d.getFullYear().toString().slice(-2),
        'MM': String(d.getMonth() + 1).padStart(2, '0'),
        'M': String(d.getMonth() + 1),
        'dd': String(d.getDate()).padStart(2, '0'),
        'd': String(d.getDate()),
        'HH': String(d.getHours()).padStart(2, '0'),
        'H': String(d.getHours()),
        'mm': String(d.getMinutes()).padStart(2, '0'),
        'm': String(d.getMinutes()),
        'ss': String(d.getSeconds()).padStart(2, '0'),
        's': String(d.getSeconds()),
    }

    let result = formatStr
    // Use pre-compiled RegExp patterns for better performance
    for (const [token, value] of Object.entries(tokens)) {
        result = result.replace(TOKEN_PATTERNS[token], value)
    }

    return result
}

/**
 * Parse a date from various formats
 */
export function parse(dateStr: string | Date | number): Date {
    const d = new Date(dateStr)
    
    if (isNaN(d.getTime())) {
        throw new Error('Invalid date')
    }
    
    return d
}

/**
 * Add days to a date
 */
export function addDays(date: Date | string | number, days: number): Date {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
}

/**
 * Add months to a date
 */
export function addMonths(date: Date | string | number, months: number): Date {
    const d = new Date(date)
    d.setMonth(d.getMonth() + months)
    return d
}

/**
 * Add years to a date
 */
export function addYears(date: Date | string | number, years: number): Date {
    const d = new Date(date)
    d.setFullYear(d.getFullYear() + years)
    return d
}

/**
 * Subtract days from a date
 */
export function subDays(date: Date | string | number, days: number): Date {
    return addDays(date, -days)
}

/**
 * Subtract months from a date
 */
export function subMonths(date: Date | string | number, months: number): Date {
    return addMonths(date, -months)
}

/**
 * Subtract years from a date
 */
export function subYears(date: Date | string | number, years: number): Date {
    return addYears(date, -years)
}

/**
 * Check if date is before another date
 */
export function isBefore(date: Date | string | number, dateToCompare: Date | string | number): boolean {
    return new Date(date).getTime() < new Date(dateToCompare).getTime()
}

/**
 * Check if date is after another date
 */
export function isAfter(date: Date | string | number, dateToCompare: Date | string | number): boolean {
    return new Date(date).getTime() > new Date(dateToCompare).getTime()
}

/**
 * Check if dates are equal
 */
export function isEqual(date: Date | string | number, dateToCompare: Date | string | number): boolean {
    return new Date(date).getTime() === new Date(dateToCompare).getTime()
}

/**
 * Get the difference in days between two dates
 */
export function differenceInDays(dateLeft: Date | string | number, dateRight: Date | string | number): number {
    const left = new Date(dateLeft)
    const right = new Date(dateRight)
    const diff = left.getTime() - right.getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Get start of day
 */
export function startOfDay(date: Date | string | number): Date {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
}

/**
 * Get end of day
 */
export function endOfDay(date: Date | string | number): Date {
    const d = new Date(date)
    d.setHours(23, 59, 59, 999)
    return d
}

/**
 * Get current date/time
 */
export function now(): Date {
    return new Date()
}

/**
 * Check if a date is valid
 */
export function isValid(date: any): boolean {
    const d = new Date(date)
    return !isNaN(d.getTime())
}

/**
 * Export all functions as a namespace for Velocity context
 * This mimics the date-fns import pattern
 */
export const Datefns = {
    format,
    parse,
    addDays,
    addMonths,
    addYears,
    subDays,
    subMonths,
    subYears,
    isBefore,
    isAfter,
    isEqual,
    differenceInDays,
    startOfDay,
    endOfDay,
    now,
    isValid,
}
