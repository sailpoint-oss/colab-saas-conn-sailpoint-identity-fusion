import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { SDKClient } from '../sdk-client'
import { RETRIES } from '../constants'

// Mock the logger to avoid console output during tests
jest.mock('@sailpoint/connector-sdk', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    },
}))

// Helper function to fail tests with a message
const fail = (message: string) => {
    throw new Error(message)
}

describe('SDKClient Retry Tests', () => {
    let mockAxios: MockAdapter
    let sdkClient: SDKClient

    beforeEach(() => {
        // Create a new mock adapter for axios
        mockAxios = new MockAdapter(axios)

        // Mock the token endpoint to return a fake token
        mockAxios.onPost(/oauth\/token/).reply(200, {
            access_token: 'fake-test-token',
            token_type: 'Bearer',
            expires_in: 3600,
        })

        // Create SDK client with test configuration
        sdkClient = new SDKClient({
            baseurl: 'https://test.identitynow.com',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
        })
    })

    afterEach(() => {
        mockAxios.restore()
        jest.clearAllMocks()
    })

    it('should retry on 429 rate limit errors', async () => {
        let attemptCount = 0

        // Mock the search endpoint to fail twice with 429, then succeed
        mockAxios.onPost(/v3\/search/).reply(() => {
            attemptCount++
            if (attemptCount <= 2) {
                return [
                    429,
                    { message: 'Too Many Requests' },
                    {
                        'retry-after': '1',
                    },
                ]
            }
            return [
                200,
                [],  // Empty array for successful response
            ]
        })

        // Make a search call that should retry
        try {
            await sdkClient.listIdentities(['id', 'name'])
            // If we get here, retries worked
            expect(attemptCount).toBe(3) // 2 failures + 1 success
        } catch (error) {
            fail('Should have succeeded after retries')
        }
    }, 30000) // Increase timeout for retry delays

    // Note: Testing true network errors with axios-mock-adapter is challenging
    // because it doesn't trigger axios-retry's isNetworkError() detection properly.
    // The other tests (429, 5xx) validate that retry mechanism works correctly.
    it.skip('should retry on network errors', async () => {
        // This test is skipped because simulating true network errors
        // that axios-retry recognizes is difficult with axios-mock-adapter
    })

    it('should eventually fail after max retries', async () => {
        let attemptCount = 0

        // Mock to always return 429
        mockAxios.onPost(/v3\/search/).reply(() => {
            attemptCount++
            return [
                429,
                { message: 'Too Many Requests' },
                {
                    'retry-after': '1',
                },
            ]
        })

        try {
            await sdkClient.listIdentities(['id', 'name'])
            fail('Should have thrown an error after max retries')
        } catch (error) {
            // Should have attempted RETRIES + 1 times (initial attempt + retries)
            expect(attemptCount).toBe(RETRIES + 1)
        }
    }, 60000) // Longer timeout since this will retry multiple times

    it('should not retry on 4xx errors (except 429)', async () => {
        let attemptCount = 0

        // Mock to return 400 Bad Request
        mockAxios.onPost(/v3\/search/).reply(() => {
            attemptCount++
            return [400, { message: 'Bad Request' }]
        })

        try {
            await sdkClient.listIdentities(['id', 'name'])
            fail('Should have thrown an error')
        } catch (error) {
            // Should only attempt once (no retries for 400)
            expect(attemptCount).toBe(1)
        }
    })

    it('should retry on 5xx server errors', async () => {
        let attemptCount = 0

        // Mock to return 503 Service Unavailable, then succeed
        mockAxios.onPost(/v3\/search/).reply(() => {
            attemptCount++
            if (attemptCount <= 1) {
                return [503, { message: 'Service Unavailable' }]
            }
            return [200, []]
        })

        try {
            await sdkClient.listIdentities(['id', 'name'])
            expect(attemptCount).toBeGreaterThanOrEqual(2)
        } catch (error) {
            fail('Should have succeeded after retries')
        }
    }, 30000)

    it('should have retriesConfig set on the configuration', () => {
        // Access the private config property using bracket notation for testing
        const config = (sdkClient as any).config

        expect(config.retriesConfig).toBeDefined()
        expect(config.retriesConfig.retries).toBe(RETRIES)
        expect(config.retriesConfig.retryCondition).toBeDefined()
        expect(config.retriesConfig.retryDelay).toBeDefined()
        expect(config.retriesConfig.onRetry).toBeDefined()
    })
})

