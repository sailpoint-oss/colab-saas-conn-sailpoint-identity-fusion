export async function batch<T, R = any>(
    items: T[],
    processFunction: (item: T) => Promise<R>,
    batchSize: number = 250,
    afterBatchMethod?: (processedCount: number, total: number) => void
) {
    let processed: number = 0
    const total: number = items.length
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        const promises = batch.map(async (item) => processFunction(item))
        await Promise.all(promises)

        // Opens the event loop to ensure keepAlive is sent.
        await new Promise(resolve => setTimeout(resolve, 5))

        processed += batch.length;
        if (afterBatchMethod) afterBatchMethod(processed, total)
    }
}