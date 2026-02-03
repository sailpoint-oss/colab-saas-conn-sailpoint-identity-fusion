import { logger } from '@sailpoint/connector-sdk'
import { QueueItem, QueueStats, QueueConfig, QueuePriority } from './types'
import { shouldRetry, calculateRetryDelay } from './helpers'
import { MAX_STATS_SAMPLES, QUEUE_PROCESSING_INTERVAL_MS } from './constants'

/**
 * Advanced API call queue manager with throttling, retry, and concurrency control.
 * Note: Pagination is handled at the ClientService level, not in the queue.
 */
export class ApiQueue {
    private queue: QueueItem[] = []
    private activeRequests: number = 0
    private processing: boolean = false
    private stats: QueueStats = {
        totalProcessed: 0,
        totalFailed: 0,
        totalRetries: 0,
        averageWaitTime: 0,
        averageProcessingTime: 0,
        queueLength: 0,
        activeRequests: 0,
    }
    private waitTimes: number[] = []
    private processingTimes: number[] = []
    private lastRequestTime: number = 0
    private minRequestInterval: number

    constructor(private config: QueueConfig) {
        this.minRequestInterval = 1000 / config.requestsPerSecond
        this.startProcessing()
    }

    /**
     * Add a request to the queue
     */
    async enqueue<T>(
        execute: () => Promise<T>,
        options: {
            priority?: QueuePriority
            maxRetries?: number
            id?: string
        } = {}
    ): Promise<T> {
        const item: QueueItem<T> = {
            id: options.id || `req-${Date.now()}-${Math.random()}`,
            priority: options.priority ?? QueuePriority.NORMAL,
            execute,
            resolve: () => {},
            reject: () => {},
            retryCount: 0,
            maxRetries: options.maxRetries ?? this.config.maxRetries,
            createdAt: Date.now(),
        }

        return new Promise<T>((resolve, reject) => {
            item.resolve = resolve
            item.reject = reject

            // Insert based on priority (higher priority first)
            const insertIndex = this.queue.findIndex((q) => q.priority < item.priority)
            if (insertIndex === -1) {
                this.queue.push(item)
            } else {
                this.queue.splice(insertIndex, 0, item)
            }

            this.stats.queueLength = this.queue.length

            // Process immediately if not at capacity
            this.processQueue()
        })
    }

    /**
     * Start the queue processing loop
     */
    private startProcessing(): void {
        if (this.processing) return
        this.processing = true
        this.processQueue()
    }

    /**
     * Process the queue
     * Each request is executed individually, respecting concurrency and throttling limits.
     * Pagination is handled at the ClientService level, not here.
     */
    private async processQueue(): Promise<void> {
        if (!this.processing) return

        // Process requests up to the concurrency limit
        while (this.queue.length > 0 && this.activeRequests < this.config.maxConcurrentRequests) {
            const item = this.queue.shift()!
            this.stats.queueLength = this.queue.length

            // Execute the request immediately (it will handle its own throttling)
            // Don't await - let multiple requests run concurrently up to maxConcurrentRequests
            this.executeRequest(item).catch(() => {
                // Error already handled in executeRequest
            })
        }

        // Continue processing if there are items in queue and capacity available
        if (this.queue.length > 0 && this.activeRequests < this.config.maxConcurrentRequests) {
            setTimeout(() => this.processQueue(), QUEUE_PROCESSING_INTERVAL_MS)
        }
    }

    /**
     * Execute a single request with throttling and retry
     */
    private async executeRequest<T>(item: QueueItem<T>): Promise<void> {
        this.activeRequests++
        this.stats.activeRequests = this.activeRequests

        const waitTime = Date.now() - item.createdAt
        this.waitTimes.push(waitTime)
        if (this.waitTimes.length > MAX_STATS_SAMPLES) {
            this.waitTimes.shift()
        }

        // Throttle: ensure minimum time between requests
        const timeSinceLastRequest = Date.now() - this.lastRequestTime
        if (timeSinceLastRequest < this.minRequestInterval) {
            await this.sleep(this.minRequestInterval - timeSinceLastRequest)
        }

        const startTime = Date.now()
        this.lastRequestTime = Date.now()

        try {
            const result = await item.execute()
            const processingTime = Date.now() - startTime
            this.processingTimes.push(processingTime)
            if (this.processingTimes.length > MAX_STATS_SAMPLES) {
                this.processingTimes.shift()
            }

            this.stats.totalProcessed++
            this.updateStats()
            item.resolve(result)
        } catch (error: any) {
            const processingTime = Date.now() - startTime
            this.processingTimes.push(processingTime)
            if (this.processingTimes.length > MAX_STATS_SAMPLES) {
                this.processingTimes.shift()
            }

            // Check if we should retry
            if (shouldRetry(error) && item.retryCount < item.maxRetries) {
                item.retryCount++
                this.stats.totalRetries++
                this.updateStats()

                const delay = calculateRetryDelay(item.retryCount, error)
                logger.debug(
                    `Retrying request [${item.id}] (attempt ${item.retryCount}/${item.maxRetries}) after ${delay}ms`
                )

                await this.sleep(delay)

                // Re-queue with same priority (priority is always enabled)
                const insertIndex = this.queue.findIndex((q) => q.priority < item.priority)
                if (insertIndex === -1) {
                    this.queue.push(item)
                } else {
                    this.queue.splice(insertIndex, 0, item)
                }
                this.stats.queueLength = this.queue.length
            } else {
                this.stats.totalFailed++
                this.updateStats()
                item.reject(error)
            }
        } finally {
            this.activeRequests--
            this.stats.activeRequests = this.activeRequests

            // Continue processing
            setTimeout(() => this.processQueue(), 0)
        }
    }

    /**
     * Get current queue statistics
     */
    getStats(): QueueStats {
        return { ...this.stats }
    }

    /**
     * Update statistics
     */
    private updateStats(): void {
        if (this.waitTimes.length > 0) {
            this.stats.averageWaitTime = this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length
        }
        if (this.processingTimes.length > 0) {
            this.stats.averageProcessingTime =
                this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
        }
    }

    /**
     * Clear the queue
     */
    clear(): void {
        this.queue.forEach((item) => {
            item.reject(new Error('Queue cleared'))
        })
        this.queue = []
        this.stats.queueLength = 0
    }

    /**
     * Stop processing
     */
    stop(): void {
        this.processing = false
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
