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
                return retryAfterMs
            }
        }
        
        // Exponential backoff: 2^retryCount * 1000ms (1s, 2s, 4s, 8s, etc., max 60s)
        const exponentialDelay = Math.min(Math.pow(2, retryCount) * 1000, 60 * 1000)
        return exponentialDelay
    },
    retryCondition: (error) => {
        return axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error) || error.response?.status === 429
    },
    onRetry: (retryCount, error, requestConfig) => {
        const status = error.response?.status || 'Network Error'
        const delay = error.response?.headers ? 
            (error.response.headers as AxiosResponseHeaders).get('retry-after') : 
            Math.min(Math.pow(2, retryCount) * 1000, 60 * 1000) / 1000
        const delayType = error.response?.headers?.['retry-after'] ? 'server-specified' : 'exponential backoff'
        
        logger.warn(
            `Request to [${requestConfig.url}] failed with status [${status}]. ` +
            `Waiting ${delay}s (${delayType}) before retry attempt ${retryCount}/${RETRIES}`
        )
    },
}

export const throttleConfig = { requestsPerSecond: REQUESTSPERSECOND }
