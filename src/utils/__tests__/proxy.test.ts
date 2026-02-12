import { isProxyMode, isProxyService } from '../proxy'

describe('proxy utils', () => {
    const originalEnv = process.env

    beforeEach(() => {
        jest.resetModules()
        process.env = { ...originalEnv }
    })

    afterAll(() => {
        process.env = originalEnv
    })

    describe('isProxyMode', () => {
        it('should return true when proxy enabled, has URL, and not server', () => {
            delete process.env.PROXY_PASSWORD
            const config = { proxyEnabled: true, proxyUrl: 'http://proxy:3000' } as any
            expect(isProxyMode(config)).toBe(true)
        })

        it('should return false when PROXY_PASSWORD is set (server mode)', () => {
            process.env.PROXY_PASSWORD = 'secret'
            const config = { proxyEnabled: true, proxyUrl: 'http://proxy:3000' } as any
            expect(isProxyMode(config)).toBe(false)
        })

        it('should return false when proxy not enabled', () => {
            delete process.env.PROXY_PASSWORD
            const config = { proxyEnabled: false, proxyUrl: 'http://proxy:3000' } as any
            expect(isProxyMode(config)).toBe(false)
        })

        it('should return false when proxy URL is empty', () => {
            delete process.env.PROXY_PASSWORD
            const config = { proxyEnabled: true, proxyUrl: '' } as any
            expect(isProxyMode(config)).toBe(false)
        })

        it('should return false when proxy URL is undefined', () => {
            delete process.env.PROXY_PASSWORD
            const config = { proxyEnabled: true, proxyUrl: undefined } as any
            expect(isProxyMode(config)).toBe(false)
        })
    })

    describe('isProxyService', () => {
        it('should return true when proxy enabled and PROXY_PASSWORD set', () => {
            process.env.PROXY_PASSWORD = 'secret'
            const config = { proxyEnabled: true } as any
            expect(isProxyService(config)).toBe(true)
        })

        it('should return false when proxy not enabled', () => {
            process.env.PROXY_PASSWORD = 'secret'
            const config = { proxyEnabled: false } as any
            expect(isProxyService(config)).toBe(false)
        })

        it('should return false when PROXY_PASSWORD not set', () => {
            delete process.env.PROXY_PASSWORD
            const config = { proxyEnabled: true } as any
            expect(isProxyService(config)).toBe(false)
        })
    })
})
