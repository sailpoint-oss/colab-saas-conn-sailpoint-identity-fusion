import { logger } from '@sailpoint/connector-sdk'
import { LockService } from '../lockService'

// ============================================================================
// StateWrapper Class
// ============================================================================

/**
 * Wrapper for managing counter state across connector runs
 */
export class StateWrapper {
    state: Map<string, number> = new Map()
    private locks?: LockService

    constructor(state?: any, locks?: LockService) {
        this.locks = locks
        logger.info(`Initializing StateWrapper with state: ${JSON.stringify(state)}`)
        try {
            // Handle undefined, null, or empty state
            if (state && typeof state === 'object' && Object.keys(state).length > 0) {
                this.state = new Map(Object.entries(state))
                logger.debug(`Loaded ${this.state.size} counter values from state`)
            } else {
                this.state = new Map()
                logger.debug('Initializing with empty state (no previous counter values)')
            }
        } catch (error) {
            logger.error(`Failed to convert state object to Map: ${error}. Initializing with empty Map`)
            this.state = new Map()
        }
    }

    /**
     * Get a non-persistent counter function (for unique attributes)
     */
    static getCounter(): () => number {
        let counter = 0
        return () => {
            counter++
            return counter
        }
    }

    /**
     * Get a persistent counter function (for counter-based attributes)
     * Returns an async function that uses locks for thread safety in parallel processing
     * Counters must be initialized via initializeCounters() before use
     */
    getCounter(key: string): () => Promise<number> {
        logger.debug(`Getting counter for key: ${key}`)
        return async () => {
            const lockKey = `counter:${key}`

            return await this.locks!.withLock(lockKey, async () => {
                // Ensure counter exists (should have been initialized, but check for safety)
                if (!this.state.has(key)) {
                    const error = new Error(`Counter ${key} was not initialized. Call initializeCounters() first.`)
                    logger.error(error.message)
                    throw error
                }

                const currentValue = this.state.get(key)!
                const nextValue = currentValue + 1
                this.state.set(key, nextValue)
                // Verify the state was actually updated
                const verifyValue = this.state.get(key)
                if (verifyValue !== nextValue) {
                    throw new Error(
                        `State update failed! Set ${key} to ${nextValue} but got ${verifyValue} when reading back`
                    )
                }
                logger.debug(
                    `Persistent counter for key ${key} incremented from ${currentValue} to: ${nextValue} (verified: ${verifyValue})`
                )
                return nextValue
            })
        }
    }

    /**
     * Initialize a counter with a start value if it doesn't exist
     * Sets the counter to (start - 1) so that the first increment returns 'start'
     * Uses locks for thread safety in parallel processing
     */
    async initCounter(key: string, start: number): Promise<void> {
        const lockKey = `counter:${key}`

        if (this.locks) {
            await this.locks.withLock(lockKey, async () => {
                if (!this.state.has(key)) {
                    // Set to start - 1 so first increment returns 'start'
                    this.state.set(key, start - 1)
                    logger.debug(`Initialized counter ${key} to ${start - 1} (first value will be ${start})`)
                }
            })
        } else {
            // Fallback to non-locked operation (not thread-safe)
            if (!this.state.has(key)) {
                // Set to start - 1 so first increment returns 'start'
                this.state.set(key, start - 1)
                logger.debug(`Initialized counter ${key} to ${start - 1} (first value will be ${start})`)
            }
        }
    }

    /**
     * Get the state as a plain object for saving
     */
    getState(): { [key: string]: number } {
        return Object.fromEntries(this.state)
    }
}
