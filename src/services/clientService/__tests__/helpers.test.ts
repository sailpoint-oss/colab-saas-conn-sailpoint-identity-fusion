import {
    createRetriesConfig,
    createThrottleConfig,
    shouldRetry,
    calculateRetryDelay,
} from '../helpers'
import axiosRetry from 'axios-retry'

jest.mock('axios-retry', () => ({
    isNetworkError: jest.fn((err: any) => err?.isNetworkError === true),
    isRetryableError: jest.fn((err: any) => err?.isRetryable === true),
    default: {},
}))

describe('clientService helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('createRetriesConfig', () => {
        it('should return config with default retries', () => {
            const config = createRetriesConfig()
            expect(config.retries).toBeDefined()
            expect(config.retryDelay).toBeInstanceOf(Function)
            expect(config.retryCondition).toBeInstanceOf(Function)
        })

        it('should use custom retries when provided', () => {
            const config = createRetriesConfig(5)
            expect(config.retries).toBe(5)
        })

        it('should retry on 429', () => {
            const config = createRetriesConfig()
            const error = { response: { status: 429 } }
            expect(config.retryCondition!(error as any)).toBe(true)
        })

        it('should retry on 5xx', () => {
            const config = createRetriesConfig()
            expect(config.retryCondition!({ response: { status: 500 } } as any)).toBe(true)
            expect(config.retryCondition!({ response: { status: 503 } } as any)).toBe(true)
        })
    })

    describe('createThrottleConfig', () => {
        it('should return throttle config with requestsPerSecond', () => {
            const config = createThrottleConfig(10)
            expect(config.requestsPerSecond).toBe(10)
            expect(config.maxConcurrentRequests).toBeGreaterThanOrEqual(10)
        })

        it('should use default when not provided', () => {
            const config = createThrottleConfig()
            expect(config.requestsPerSecond).toBeDefined()
        })
    })

    describe('shouldRetry', () => {
        it('should return true for 429', () => {
            expect(shouldRetry({ response: { status: 429 } })).toBe(true)
        })

        it('should return true for 5xx', () => {
            expect(shouldRetry({ response: { status: 500 } })).toBe(true)
            expect(shouldRetry({ response: { status: 502 } })).toBe(true)
        })

        it('should return true for network errors', () => {
            ;(axiosRetry.isNetworkError as jest.Mock).mockReturnValue(true)
            expect(shouldRetry({ isNetworkError: true })).toBe(true)
        })

        it('should return true for timeout', () => {
            expect(shouldRetry({ code: 'ECONNABORTED' })).toBe(true)
            expect(shouldRetry({ code: 'ETIMEDOUT' })).toBe(true)
        })

        it('should return false for 4xx (except 429)', () => {
            ;(axiosRetry.isNetworkError as jest.Mock).mockReturnValue(false)
            ;(axiosRetry.isRetryableError as jest.Mock).mockReturnValue(false)
            expect(shouldRetry({ response: { status: 400 } })).toBe(false)
            expect(shouldRetry({ response: { status: 404 } })).toBe(false)
        })

        it('should return false for null/undefined', () => {
            expect(shouldRetry(null)).toBe(false)
            expect(shouldRetry(undefined)).toBe(false)
        })
    })

    describe('calculateRetryDelay', () => {
        it('should return positive delay for retry count', () => {
            const delay = calculateRetryDelay(1, { response: { status: 500 } })
            expect(delay).toBeGreaterThan(0)
        })

        it('should use retry-after for 429 when header present', () => {
            const delay = calculateRetryDelay(0, {
                response: { status: 429, headers: { 'retry-after': '5' } },
            })
            expect(delay).toBeGreaterThanOrEqual(5000)
        })
    })
})
