import { LogService } from './logService'

export interface LockService {
    withLock<T>(key: string, fn: () => Promise<T>): Promise<T>
    /**
     * Wait for all pending operations to complete for all lock keys
     * This ensures the state is fully synchronized before reading it
     */
    waitForAllPendingOperations?(): Promise<void>
}

export class InMemoryLockService implements LockService {
    // Map from lock key to the last promise in the queue
    // Each promise represents a task waiting to acquire the lock
    // When a task completes, it resolves its promise, allowing the next task to proceed
    private queues = new Map<string, Promise<unknown>>()

    constructor(private log: LogService) {}

    async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
        this.log.debug(`Acquiring lock for key: ${key}`)

        // Create our promise that will be resolved when we're done
        let resolveNext: (value: unknown) => void
        const next = new Promise<unknown>((r) => {
            resolveNext = r
        })

        // CRITICAL: Get the previous promise and register ours in a way that
        // prevents any race condition. We must read, then write, then await.
        // Since JavaScript is single-threaded, synchronous operations are atomic,
        // but we must ensure the queue is updated BEFORE we start waiting.
        const prev = this.queues.get(key) ?? Promise.resolve()
        
        // Register our promise as the new tail BEFORE awaiting
        // This ensures any concurrent caller will wait for us
        this.queues.set(key, next)

        // Wait for the previous task to complete (if any)
        // This serializes all tasks for this key - only one can proceed past here
        await prev

        this.log.debug(`Lock acquired for key: ${key}`)

        try {
            // CRITICAL SECTION: Only one task can be here at a time per key
            // All state modifications must happen here - this is serialized by the await above
            const result = await fn()
            this.log.debug(`Lock released for key (success): ${key}`)
            return result
        } catch (error) {
            this.log.error?.(`Error in lock-protected function for key "${key}": ${(error as Error).message}`)
            throw error
        } finally {
            // ALWAYS resolve our promise, even if fn() threw an error
            // This allows the next waiter (if any) to proceed
            resolveNext!(undefined)

            // Clean up if we're still the tail (no new tasks queued after us)
            // This prevents memory leaks from unused queue entries
            if (this.queues.get(key) === next) {
                this.queues.delete(key)
                this.log.debug(`Cleaned up lock queue for key: ${key}`)
            }
        }
    }

    /**
     * Wait for all pending operations to complete for all lock keys
     * This ensures the state is fully synchronized before reading it
     */
    async waitForAllPendingOperations(): Promise<void> {
        // Wait for all pending promises in the queue
        const pendingPromises = Array.from(this.queues.values())
        if (pendingPromises.length > 0) {
            if (this.log) {
                this.log.debug(`Waiting for ${pendingPromises.length} pending lock operation(s) to complete`)
            }
            await Promise.all(pendingPromises)
            if (this.log) {
                this.log.debug('All pending lock operations completed')
            }
        }
    }
}
