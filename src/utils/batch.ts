export async function batch<T, R = any>(
    items: T[],
    processFunction: (item: T) => Promise<R>,
    batchSize: number = 250,
    afterBatchMethod?: (processedCount: number, total: number) => void
) {
    let processed: number = 0
    const total: number = items.length
    const results: R[] = []
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        const promises = batch.map(async (item) => processFunction(item))
        const batchProcessed = await Promise.all(promises)

        results.push(...batchProcessed)

        // Opens the event loop to ensure keepAlive is sent.
        await new Promise((resolve) => setTimeout(resolve, 5))

        processed += batch.length
        if (afterBatchMethod) afterBatchMethod(processed, total)

        batch.length = 0
    }

    return results
}

export async function batchRetry<T, R>(
    items: T[],
    processFunction: (item: T) => Promise<R>,
    batchSize: number = 250,
    maxRetries: number = 20,
    afterBatchMethod?: (processedCount: number, total: number, duration: number) => void,
    retryMethod?: (attempt: number, maxRetries: number, wait: number) => void,
    ignoreResults?: boolean
) {
    let processed: number = 0
    const total: number = items.length
    let results: R[] = []

    for (let i = 0; i < items.length; i += batchSize) {
        const batchStartTime = performance.now()
        const batch = items.slice(i, i + batchSize)
        const promises = batch.map(async (item) => processItemWithRetry(item, processFunction, maxRetries, retryMethod))
        const batchProcessed = await Promise.all(promises)

        if (!ignoreResults) results.push(...batchProcessed)

        processed += batch.length
        const batchEndTime = performance.now()
        const batchDuration = batchEndTime - batchStartTime

        let delay = 5
        // Opens the event loop to ensure keepAlive is sent.
        await new Promise((resolve) => setTimeout(resolve, delay))

        if (afterBatchMethod) afterBatchMethod(processed, total, batchDuration + delay)

        batch.length = 0
    }

    return results
}

async function processItemWithRetry<T, R>(
    item: T,
    processFunction: (item: T) => Promise<R>,
    maxRetries: number,
    retryMethod?: (attempt: number, maxRetries: number, wait: number) => void
): Promise<R> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await processFunction(item)
        } catch (error: any) {
            if (attempt === maxRetries) throw error

            // Wait before retry with exponential backoff
            let delay = 1000 * Math.pow(2, attempt)

            if (error.response?.status === 429 && error.response.headers['retry-after']) {
                delay = parseInt(error.response.headers['retry-after']) * 1000
            }

            if (retryMethod) retryMethod(attempt, maxRetries, delay)

            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }
    throw new Error('Should not reach here')
}
