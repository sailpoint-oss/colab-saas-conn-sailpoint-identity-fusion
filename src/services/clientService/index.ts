// Main service export
export { ClientService } from './clientService'

// Queue exports
export { ApiQueue } from './queue'

// Type exports
export type { QueueItem, QueueStats, QueueConfig } from './types'
export { QueuePriority } from './types'

// Helper exports
export { createRetriesConfig, createThrottleConfig, shouldRetry, calculateRetryDelay } from './helpers'

// Constants exports (if needed externally)
export {
    DEFAULT_RETRIES,
    DEFAULT_REQUESTS_PER_SECOND,
    BASE_RETRY_DELAY_MS,
    MAX_RETRY_DELAY_MS,
    RETRY_JITTER_FACTOR,
    RATE_LIMIT_JITTER_FACTOR,
    STATS_LOGGING_INTERVAL_MS,
    MAX_STATS_SAMPLES,
    QUEUE_PROCESSING_INTERVAL_MS,
} from './constants'
