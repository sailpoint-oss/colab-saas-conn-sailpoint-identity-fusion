import {
    getUIOriginFromBaseUrl,
    buildIdentityUrl,
    buildIdentityAccountsUrl,
    buildSourceUrl,
    buildSourceAccountsUrl,
    buildAccountUrl,
    buildWorkflowUrl,
    buildFormDefinitionUrl,
    isValidUrl,
    removeTrailingSlash,
    ensureTrailingSlash,
    createUrlContext,
} from '../url'

describe('url', () => {
    const apiBase = 'https://acme.api.identitynow.com'
    const uiOrigin = 'https://acme.identitynow.com'

    describe('getUIOriginFromBaseUrl', () => {
        it('should convert api. subdomain to UI origin', () => {
            expect(getUIOriginFromBaseUrl(apiBase)).toBe(uiOrigin)
        })

        it('should handle api at start of host', () => {
            expect(getUIOriginFromBaseUrl('https://api.identitynow.com')).toBe('https://identitynow.com')
        })

        it('should return undefined for empty/undefined', () => {
            expect(getUIOriginFromBaseUrl(undefined)).toBeUndefined()
            expect(getUIOriginFromBaseUrl('')).toBeUndefined()
        })

        it('should return undefined for invalid URL', () => {
            expect(getUIOriginFromBaseUrl('not-a-url')).toBeUndefined()
        })
    })

    describe('buildIdentityUrl', () => {
        it('should build identity details URL', () => {
            const url = buildIdentityUrl(uiOrigin, 'id-123')
            expect(url).toBe(`${uiOrigin}/ui/a/admin/identities/id-123/details/attributes`)
        })

        it('should encode identity ID', () => {
            const url = buildIdentityUrl(uiOrigin, 'id/with?special=chars')
            expect(url).toContain(encodeURIComponent('id/with?special=chars'))
        })

        it('should return undefined for missing inputs', () => {
            expect(buildIdentityUrl(undefined, 'id')).toBeUndefined()
            expect(buildIdentityUrl(uiOrigin, undefined)).toBeUndefined()
        })
    })

    describe('buildIdentityAccountsUrl', () => {
        it('should build identity accounts URL', () => {
            const url = buildIdentityAccountsUrl(uiOrigin, 'id-456')
            expect(url).toBe(`${uiOrigin}/ui/a/admin/identities/id-456/accounts`)
        })
    })

    describe('buildSourceUrl', () => {
        it('should build source details URL', () => {
            const url = buildSourceUrl(uiOrigin, 'src-789')
            expect(url).toBe(`${uiOrigin}/ui/a/admin/connections/sources/src-789`)
        })
    })

    describe('buildSourceAccountsUrl', () => {
        it('should build source accounts URL', () => {
            const url = buildSourceAccountsUrl(uiOrigin, 'src-abc')
            expect(url).toBe(`${uiOrigin}/ui/a/admin/connections/sources/src-abc/accounts`)
        })
    })

    describe('buildAccountUrl', () => {
        it('should build account details URL', () => {
            const url = buildAccountUrl(uiOrigin, 'acc-1')
            expect(url).toBe(`${uiOrigin}/ui/a/admin/accounts/acc-1`)
        })
    })

    describe('buildWorkflowUrl', () => {
        it('should build workflow URL', () => {
            const url = buildWorkflowUrl(uiOrigin, 'wf-1')
            expect(url).toBe(`${uiOrigin}/ui/a/admin/workflows/wf-1`)
        })
    })

    describe('buildFormDefinitionUrl', () => {
        it('should build form definition URL', () => {
            const url = buildFormDefinitionUrl(uiOrigin, 'form-1')
            expect(url).toBe(`${uiOrigin}/ui/a/admin/forms/form-1`)
        })
    })

    describe('isValidUrl', () => {
        it('should return true for valid URLs', () => {
            expect(isValidUrl('https://example.com')).toBe(true)
            expect(isValidUrl('http://localhost:3000')).toBe(true)
        })

        it('should return false for invalid URLs', () => {
            expect(isValidUrl('not-a-url')).toBe(false)
            expect(isValidUrl('')).toBe(false)
            expect(isValidUrl(undefined)).toBe(false)
        })
    })

    describe('removeTrailingSlash', () => {
        it('should remove trailing slash', () => {
            expect(removeTrailingSlash('https://a.com/')).toBe('https://a.com')
        })

        it('should not change URL without trailing slash', () => {
            expect(removeTrailingSlash('https://a.com')).toBe('https://a.com')
        })
    })

    describe('ensureTrailingSlash', () => {
        it('should add trailing slash', () => {
            expect(ensureTrailingSlash('https://a.com')).toBe('https://a.com/')
        })

        it('should not double add', () => {
            expect(ensureTrailingSlash('https://a.com/')).toBe('https://a.com/')
        })
    })

    describe('createUrlContext', () => {
        it('should create context with all builders', () => {
            const ctx = createUrlContext(apiBase)
            expect(ctx.uiOrigin).toBe(uiOrigin)
            expect(ctx.identity('id1')).toBe(`${uiOrigin}/ui/a/admin/identities/id1/details/attributes`)
            expect(ctx.source('src1')).toBe(`${uiOrigin}/ui/a/admin/connections/sources/src1`)
            expect(ctx.account('acc1')).toBe(`${uiOrigin}/ui/a/admin/accounts/acc1`)
        })
    })
})
