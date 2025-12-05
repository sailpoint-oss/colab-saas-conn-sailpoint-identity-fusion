import { IAxiosRetryConfig } from 'axios-retry'
import { REQUESTSPERSECOND, RETRIES } from './constants'
import { logger } from '@sailpoint/connector-sdk'
import { AxiosResponseHeaders } from 'axios'
import axiosRetry from 'axios-retry'

export const retriesConfig: IAxiosRetryConfig = {
    retries: RETRIES,
    retryDelay: (retryCount, error) => {
        // Check if response and headers exist before accessing retry-after
        if (error.response?.headers) {
            type NewType = AxiosResponseHeaders
            const headers = error.response.headers as NewType
            const retryAfter = headers.get('retry-after')
            
            if (retryAfter) {
                // Convert retry-after from seconds to milliseconds
                const retryAfterMs = Number(retryAfter) * 1000
                logger.debug(`Using retry-after header: ${retryAfter}s (${retryAfterMs}ms)`)
                return retryAfterMs
            }
        }
        
        // Exponential backoff: 2^retryCount * 1000ms (1s, 2s, 4s, 8s, etc., max 60s)
        const exponentialDelay = Math.min(Math.pow(2, retryCount) * 1000, 60 * 1000)
        logger.debug(`Using exponential backoff: ${exponentialDelay}ms for retry ${retryCount}`)
        return exponentialDelay
    },
    retryCondition: (error) => {
        return axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error) || error.response?.status === 429
    },
    onRetry: (retryCount, error, requestConfig) => {
        logger.debug(
            `Retrying API [${requestConfig.url}] due to request error: [${error}]. Retry number [${retryCount}]`
        )
        logger.error(error)
    },
}

export const throttleConfig = { requestsPerSecond: REQUESTSPERSECOND }
