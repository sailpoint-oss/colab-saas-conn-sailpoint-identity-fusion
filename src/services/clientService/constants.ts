/**
 * Default number of retry attempts for API requests
 */
export const DEFAULT_RETRIES = 20

/**
 * Default requests per second for throttling
 */
export const DEFAULT_REQUESTS_PER_SECOND = 10

/**
 * Base delay for exponential backoff (in milliseconds)
 */
export const BASE_RETRY_DELAY_MS = 1000

/**
 * Maximum retry delay cap (in milliseconds)
 */
export const MAX_RETRY_DELAY_MS = 60000

/**
 * Jitter factor for retry delays (30% of exponential delay)
 */
export const RETRY_JITTER_FACTOR = 0.3

/**
 * Jitter factor for 429 retry-after header delays (10% of base delay)
 */
export const RATE_LIMIT_JITTER_FACTOR = 0.1

/**
 * Interval for stats logging (in milliseconds)
 */
export const STATS_LOGGING_INTERVAL_MS = 30000

/**
 * Maximum number of samples to keep for statistics
 */
export const MAX_STATS_SAMPLES = 1000

/**
 * Queue processing check interval (in milliseconds)
 */
export const QUEUE_PROCESSING_INTERVAL_MS = 10
