/**
 * URL utility functions for building ISC UI URLs and API endpoints.
 * Centralizes URL construction logic used across the codebase.
 */

// ============================================================================
// UI Origin Helpers
// ============================================================================

/**
 * Extracts the UI origin from an API base URL.
 * ISC API URLs typically use 'api.' subdomain which needs to be removed for UI URLs.
 *
 * @param baseUrl - The API base URL (e.g., 'https://tenant.api.identitynow.com')
 * @returns The UI origin (e.g., 'https://tenant.identitynow.com') or undefined if invalid
 *
 * @example
 * getUIOriginFromBaseUrl('https://acme.api.identitynow.com')
 * // Returns: 'https://acme.identitynow.com'
 */
export function getUIOriginFromBaseUrl(baseUrl: string | undefined): string | undefined {
    if (!baseUrl) return undefined

    try {
        const url = new URL(baseUrl)
        // Remove the api subdomain segment used by the API host
        // Handles both '.api.' in the middle and 'api.' at the start
        const host = url.host.replace('.api.', '.').replace(/^api\./, '')
        return `${url.protocol}//${host}`
    } catch {
        return undefined
    }
}

// ============================================================================
// Identity URL Builders
// ============================================================================

/**
 * Builds a URL to an identity's details page in the ISC UI.
 *
 * @param uiOrigin - The UI origin (from getUIOriginFromBaseUrl)
 * @param identityId - The identity ID
 * @returns The full URL to the identity details page, or undefined if inputs are invalid
 */
export function buildIdentityUrl(uiOrigin: string | undefined, identityId: string | undefined): string | undefined {
    if (!uiOrigin || !identityId) return undefined

    const encodedId = encodeURIComponent(identityId)
    return `${uiOrigin}/ui/a/admin/identities/${encodedId}/details/attributes`
}

/**
 * Builds a URL to an identity's accounts page in the ISC UI.
 */
export function buildIdentityAccountsUrl(
    uiOrigin: string | undefined,
    identityId: string | undefined
): string | undefined {
    if (!uiOrigin || !identityId) return undefined

    const encodedId = encodeURIComponent(identityId)
    return `${uiOrigin}/ui/a/admin/identities/${encodedId}/accounts`
}

// ============================================================================
// Source URL Builders
// ============================================================================

/**
 * Builds a URL to a source's details page in the ISC UI.
 */
export function buildSourceUrl(uiOrigin: string | undefined, sourceId: string | undefined): string | undefined {
    if (!uiOrigin || !sourceId) return undefined

    const encodedId = encodeURIComponent(sourceId)
    return `${uiOrigin}/ui/a/admin/connections/sources/${encodedId}`
}

/**
 * Builds a URL to a source's accounts page in the ISC UI.
 */
export function buildSourceAccountsUrl(uiOrigin: string | undefined, sourceId: string | undefined): string | undefined {
    if (!uiOrigin || !sourceId) return undefined

    const encodedId = encodeURIComponent(sourceId)
    return `${uiOrigin}/ui/a/admin/connections/sources/${encodedId}/accounts`
}

// ============================================================================
// Account URL Builders
// ============================================================================

/**
 * Builds a URL to an account's details page in the ISC UI.
 */
export function buildAccountUrl(uiOrigin: string | undefined, accountId: string | undefined): string | undefined {
    if (!uiOrigin || !accountId) return undefined

    const encodedId = encodeURIComponent(accountId)
    return `${uiOrigin}/ui/a/admin/accounts/${encodedId}`
}

// ============================================================================
// Workflow URL Builders
// ============================================================================

/**
 * Builds a URL to a workflow's details page in the ISC UI.
 */
export function buildWorkflowUrl(uiOrigin: string | undefined, workflowId: string | undefined): string | undefined {
    if (!uiOrigin || !workflowId) return undefined

    const encodedId = encodeURIComponent(workflowId)
    return `${uiOrigin}/ui/a/admin/workflows/${encodedId}`
}

// ============================================================================
// Form URL Builders
// ============================================================================

/**
 * Builds a URL to a form definition's details page in the ISC UI.
 */
export function buildFormDefinitionUrl(uiOrigin: string | undefined, formId: string | undefined): string | undefined {
    if (!uiOrigin || !formId) return undefined

    const encodedId = encodeURIComponent(formId)
    return `${uiOrigin}/ui/a/admin/forms/${encodedId}`
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validates that a string is a valid URL.
 */
export function isValidUrl(url: string | undefined): boolean {
    if (!url) return false
    try {
        new URL(url)
        return true
    } catch {
        return false
    }
}

/**
 * Ensures a URL ends without a trailing slash.
 */
export function removeTrailingSlash(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url
}

/**
 * Ensures a URL ends with a trailing slash.
 */
export function ensureTrailingSlash(url: string): string {
    return url.endsWith('/') ? url : `${url}/`
}

// ============================================================================
// URL Context Builder
// ============================================================================

/**
 * Creates a URL builder context that caches the UI origin and provides
 * convenient methods for building various URLs.
 *
 * @example
 * const urls = createUrlContext('https://tenant.api.identitynow.com')
 * const identityUrl = urls.identity('abc123')
 * const sourceUrl = urls.source('def456')
 */
export interface UrlContext {
    readonly uiOrigin: string | undefined
    identity: (id: string | undefined) => string | undefined
    identityAccounts: (id: string | undefined) => string | undefined
    source: (id: string | undefined) => string | undefined
    sourceAccounts: (id: string | undefined) => string | undefined
    account: (id: string | undefined) => string | undefined
    workflow: (id: string | undefined) => string | undefined
    form: (id: string | undefined) => string | undefined
}

export function createUrlContext(baseUrl: string | undefined): UrlContext {
    const uiOrigin = getUIOriginFromBaseUrl(baseUrl)

    return {
        uiOrigin,
        identity: (id) => buildIdentityUrl(uiOrigin, id),
        identityAccounts: (id) => buildIdentityAccountsUrl(uiOrigin, id),
        source: (id) => buildSourceUrl(uiOrigin, id),
        sourceAccounts: (id) => buildSourceAccountsUrl(uiOrigin, id),
        account: (id) => buildAccountUrl(uiOrigin, id),
        workflow: (id) => buildWorkflowUrl(uiOrigin, id),
        form: (id) => buildFormDefinitionUrl(uiOrigin, id),
    }
}
