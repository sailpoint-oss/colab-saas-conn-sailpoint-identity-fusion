/**
 * Email utility functions for normalization and validation.
 * Handles the various formats email addresses can be stored in ISC.
 */

// ============================================================================
// Email Normalization
// ============================================================================

/**
 * Normalizes an identity email attribute value into an array of valid email strings.
 * ISC tenants sometimes store email as a string, array, or nested object.
 *
 * @param value - The email value which could be string, array, or object
 * @returns Array of normalized email strings (empty array if none found)
 *
 * @example
 * normalizeEmailValue('user@example.com')
 * // Returns: ['user@example.com']
 *
 * normalizeEmailValue(['user@example.com', 'admin@example.com'])
 * // Returns: ['user@example.com', 'admin@example.com']
 *
 * normalizeEmailValue({ value: 'user@example.com' })
 * // Returns: ['user@example.com']
 */
export function normalizeEmailValue(value: any): string[] {
    if (!value) return []

    // Handle string values
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length > 0 ? [trimmed] : []
    }

    // Handle array values (recursively normalize each element)
    if (Array.isArray(value)) {
        const result: string[] = []
        for (const item of value) {
            result.push(...normalizeEmailValue(item))
        }
        return result
    }

    // Handle object values (check common email property names)
    if (typeof value === 'object') {
        const maybe = value.value ?? value.email ?? value.mail ?? value.emailAddress
        return normalizeEmailValue(maybe)
    }

    return []
}

/**
 * Extracts email addresses from an identity's attributes.
 * Checks common email attribute names: email, mail, emailAddress.
 *
 * @param attributes - The identity attributes object
 * @returns Array of unique email addresses
 */
export function extractEmailsFromAttributes(attributes: Record<string, any> | undefined): string[] {
    if (!attributes) return []

    const emails = new Set<string>()

    // Check common email attribute names
    const emailKeys = ['email', 'mail', 'emailAddress', 'Email', 'Mail', 'EmailAddress']
    for (const key of emailKeys) {
        if (key in attributes) {
            const normalized = normalizeEmailValue(attributes[key])
            normalized.forEach((email) => emails.add(email))
        }
    }

    return Array.from(emails)
}

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Basic email format validation using a simple regex.
 * This is not a comprehensive validation but catches obvious issues.
 */
export function isValidEmailFormat(email: string | undefined): boolean {
    if (!email) return false

    // Basic email regex - checks for presence of @ and proper structure
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
}

/**
 * Filters an array of strings to only include valid email addresses.
 */
export function filterValidEmails(emails: string[]): string[] {
    return emails.filter(isValidEmailFormat)
}

// ============================================================================
// Email Recipients
// ============================================================================

/**
 * Sanitizes an array of recipient email addresses.
 * - Filters out non-strings
 * - Trims whitespace
 * - Removes empty strings
 * - Removes duplicates
 *
 * @param recipients - Array of potential email addresses
 * @returns Sanitized array of unique email addresses
 */
export function sanitizeRecipients(recipients: (string | undefined | null)[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []

    for (const recipient of recipients) {
        if (typeof recipient !== 'string') continue

        const trimmed = recipient.trim()
        if (trimmed.length === 0) continue

        // Case-insensitive deduplication (emails are case-insensitive in the local part technically,
        // but we normalize to lowercase for deduplication)
        const normalized = trimmed.toLowerCase()
        if (!seen.has(normalized)) {
            seen.add(normalized)
            result.push(trimmed) // Keep original casing
        }
    }

    return result
}

/**
 * Merges multiple email sources into a single deduplicated array.
 * Useful when gathering recipients from multiple sources.
 */
export function mergeEmailSources(...sources: (string | string[] | undefined | null)[]): string[] {
    const emails = new Set<string>()

    for (const source of sources) {
        if (!source) continue

        if (typeof source === 'string') {
            const trimmed = source.trim()
            if (trimmed.length > 0) {
                emails.add(trimmed)
            }
        } else if (Array.isArray(source)) {
            for (const email of source) {
                if (typeof email === 'string') {
                    const trimmed = email.trim()
                    if (trimmed.length > 0) {
                        emails.add(trimmed)
                    }
                }
            }
        }
    }

    return Array.from(emails)
}
