import { IAxiosRetryConfig } from 'axios-retry'
import { logger } from '@sailpoint/connector-sdk'
import axiosRetry from 'axios-retry'
import {
    DEFAULT_RETRIES,
    BASE_RETRY_DELAY_MS,
    MAX_RETRY_DELAY_MS,
    RETRY_JITTER_FACTOR,
    RATE_LIMIT_JITTER_FACTOR,
    DEFAULT_REQUESTS_PER_SECOND,
} from './constants'

/**
 * Creates an axios retry configuration from the provided parameters
 * @param retries - Maximum number of retry attempts (defaults to DEFAULT_RETRIES constant)
 * @returns IAxiosRetryConfig configuration object
 */
export function createRetriesConfig(retries?: number): IAxiosRetryConfig {
    return {
        retries: retries ?? DEFAULT_RETRIES,
        retryDelay: (retryCount, error) => {
            // Handle 429 rate limiting with retry-after header
            if (error?.response?.status === 429) {
                const retryAfter = error.response.headers?.['retry-after']
                if (retryAfter) {
                    const delay = parseInt(retryAfter, 10)
                    if (!isNaN(delay)) {
                        return delay * 1000 // Convert to milliseconds
                    }
                }
            }

            // Exponential backoff with jitter for other retryable errors
            const exponentialDelay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount)
            const jitter = Math.random() * RETRY_JITTER_FACTOR * exponentialDelay
            return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS)
        },
        retryCondition: (error) => {
            if (!error) return false

            // Network errors
            if (axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error)) {
                return true
            }

            // Rate limiting (429)
            if (error.response?.status === 429) {
                return true
            }

            // Server errors (5xx)
            const status = error.response?.status
            if (status && status >= 500 && status < 600) {
                return true
            }

            // Timeout errors
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return true
            }

            return false
        },
        onRetry: (retryCount, error, requestConfig) => {
            const url = requestConfig.url || 'unknown'
            const status = error?.response?.status || error?.code || 'unknown'
            logger.debug(
                `Retrying API [${url}] due to error [${status}]. Retry number [${retryCount}/${retries ?? DEFAULT_RETRIES}]`
            )

            // Only log error details at debug level to avoid spam
            if (logger.level === 'debug') {
                logger.debug(`Error details: ${error.message || error}`)
            }
        },
    }
}

/**
 * Creates an axios throttle configuration from the provided parameters
 * @param requestsPerSecond - Maximum number of requests per second (defaults to DEFAULT_REQUESTS_PER_SECOND constant)
 * @returns Throttle configuration object
 */
export function createThrottleConfig(requestsPerSecond?: number) {
    const rps = requestsPerSecond ?? DEFAULT_REQUESTS_PER_SECOND
    return {
        requestsPerSecond: rps,
        // Additional throttle options for better control
        maxConcurrentRequests: Math.max(10, rps * 2), // Allow some concurrency
        burstSize: Math.max(5, Math.floor(rps / 2)), // Allow small bursts
    }
}

/**
 * Determine if an error should trigger a retry
 */
export function shouldRetry(error: any): boolean {
    if (!error) return false

    // Network errors
    if (axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error)) {
        return true
    }

    // Rate limiting
    if (error.response?.status === 429) {
        return true
    }

    // Server errors (5xx)
    if (error.response?.status >= 500 && error.response?.status < 600) {
        return true
    }

    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return true
    }

    return false
}

/**
 * Calculate retry delay with exponential backoff and respect for retry-after headers.
 * For 429 responses, uses the retry-after header with jitter.
 * For other retryable errors, uses exponential backoff with a sensible base delay.
 */
export function calculateRetryDelay(retryCount: number, error: any): number {
    // If 429, check for retry-after header and add jitter
    if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after']
        if (retryAfter) {
            const delay = parseInt(retryAfter, 10)
            if (!isNaN(delay)) {
                const baseDelay = delay * 1000 // Convert to milliseconds
                // Add jitter to prevent thundering herd
                const jitter = Math.random() * RATE_LIMIT_JITTER_FACTOR * baseDelay
                return baseDelay + jitter
            }
        }
    }

    // Exponential backoff for other retryable errors: baseDelay * 2^(retryCount-1), with jitter
    const exponentialDelay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount - 1)
    const jitter = Math.random() * RETRY_JITTER_FACTOR * exponentialDelay
    return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS)
}
