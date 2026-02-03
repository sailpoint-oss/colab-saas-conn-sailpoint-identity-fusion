import { ApiQueue } from './queue'
import { QueueConfig, QueuePriority, QueueStats } from './types'
import { LogService } from '../logService'
import { FusionConfig } from '../../model/config'
import {
    Configuration,
    Search,
    AccountsApi,
    IdentitiesV2025Api,
    CustomFormsV2025Api,
    EntitlementsV2025Api,
    GovernanceGroupsV2025Api,
    TaskManagementV2025Api,
    SearchApi,
    TransformsApi,
    SourcesV2025Api,
    WorkflowsV2025Api,
} from 'sailpoint-api-client'
import { createRetriesConfig } from './helpers'
import { STATS_LOGGING_INTERVAL_MS } from './constants'

/**
 * ClientService provides a lean, centralized client for API operations.
 *
 * Responsibilities:
 * - Configuration and queue management
 * - Generic execution helpers (execute, paginate, paginateSearchApi)
 * - Lazy API instance provisioning
 *
 * Domain-specific operations should live in their respective services
 * (SourceService, IdentityService, etc.) which use this client.
 */
export class ClientService {
    protected readonly queue: ApiQueue | null
    public readonly config: Configuration
    protected readonly enableQueue: boolean
    private readonly pageSize: number
    private readonly requestTimeoutMs?: number

    // Lazy-loaded API instances
    private _accountsApi?: AccountsApi
    private _identitiesApi?: IdentitiesV2025Api
    private _searchApi?: SearchApi
    private _sourcesApi?: SourcesV2025Api
    private _customFormsApi?: CustomFormsV2025Api
    private _workflowsApi?: WorkflowsV2025Api
    private _entitlementsApi?: EntitlementsV2025Api
    private _transformsApi?: TransformsApi
    private _governanceGroupsApi?: GovernanceGroupsV2025Api
    private _taskManagementApi?: TaskManagementV2025Api

    constructor(
        fusionConfig: FusionConfig,
        protected log: LogService
    ) {
        const tokenUrl = new URL(fusionConfig.baseurl).origin + fusionConfig.tokenUrlPath

        // Determine if queue and retry are enabled
        this.enableQueue = fusionConfig.enableQueue ?? false
        const enableRetry = fusionConfig.enableRetry ?? false

        // Only enable retry in axios config if enableRetry is true
        const maxRetries = enableRetry ? (fusionConfig.maxRetries ?? fusionConfig.retriesConstant) : 0
        const retriesConfig = createRetriesConfig(maxRetries)
        this.config = new Configuration({ ...fusionConfig, tokenUrl })
        this.config.retriesConfig = retriesConfig

        // Apply a hard timeout at the client layer to avoid indefinite hangs.
        // Use provisioningTimeout (seconds) as the global per-request timeout.
        // If not set or <= 0, no timeout wrapper is applied.
        this.requestTimeoutMs =
            fusionConfig.provisioningTimeout && fusionConfig.provisioningTimeout > 0
                ? fusionConfig.provisioningTimeout * 1000
                : undefined

        // Store pageSize for pagination
        this.pageSize = fusionConfig.pageSize

        // Only initialize the queue if enableQueue is true
        if (this.enableQueue) {
            const requestsPerSecond = fusionConfig.requestsPerSecond ?? fusionConfig.requestsPerSecondConstant
            const maxConcurrentRequests = fusionConfig.maxConcurrentRequests ?? Math.max(10, requestsPerSecond * 2)

            const queueConfig: QueueConfig = {
                requestsPerSecond: fusionConfig.requestsPerSecond ?? 10,
                maxConcurrentRequests,
                maxRetries: enableRetry ? maxRetries : 0,
                // Retry delay is calculated from HTTP 429 retry-after header (with jitter) or exponential backoff with 1s base
            }

            this.queue = new ApiQueue(queueConfig)
            this.startStatsLogging()
            this.log.info(
                `ClientService initialized with queue: ${queueConfig.requestsPerSecond} req/s, ` +
                `max concurrent: ${queueConfig.maxConcurrentRequests}, max retries: ${queueConfig.maxRetries}`
            )
        } else {
            this.queue = null
            this.log.info('ClientService initialized with queue disabled (direct API calls)')
        }
    }

    // -------------------------------------------------------------------------
    // API Instance Getters (Lazy Initialization)
    // -------------------------------------------------------------------------

    public get accountsApi(): AccountsApi {
        if (!this._accountsApi) {
            this._accountsApi = new AccountsApi(this.config)
        }
        return this._accountsApi
    }

    public get identitiesApi(): IdentitiesV2025Api {
        if (!this._identitiesApi) {
            this._identitiesApi = new IdentitiesV2025Api(this.config)
        }
        return this._identitiesApi
    }

    public get searchApi(): SearchApi {
        if (!this._searchApi) {
            this._searchApi = new SearchApi(this.config)
        }
        return this._searchApi
    }

    public get sourcesApi(): SourcesV2025Api {
        if (!this._sourcesApi) {
            this._sourcesApi = new SourcesV2025Api(this.config)
        }
        return this._sourcesApi
    }

    public get customFormsApi(): CustomFormsV2025Api {
        if (!this._customFormsApi) {
            this._customFormsApi = new CustomFormsV2025Api(this.config)
        }
        return this._customFormsApi
    }

    public get workflowsApi(): WorkflowsV2025Api {
        if (!this._workflowsApi) {
            this._workflowsApi = new WorkflowsV2025Api(this.config)
        }
        return this._workflowsApi
    }

    public get entitlementsApi(): EntitlementsV2025Api {
        if (!this._entitlementsApi) {
            this._entitlementsApi = new EntitlementsV2025Api(this.config)
        }
        return this._entitlementsApi
    }

    public get transformsApi(): TransformsApi {
        if (!this._transformsApi) {
            this._transformsApi = new TransformsApi(this.config)
        }
        return this._transformsApi
    }

    public get governanceGroupsApi(): GovernanceGroupsV2025Api {
        if (!this._governanceGroupsApi) {
            this._governanceGroupsApi = new GovernanceGroupsV2025Api(this.config)
        }
        return this._governanceGroupsApi
    }

    public get taskManagementApi(): TaskManagementV2025Api {
        if (!this._taskManagementApi) {
            this._taskManagementApi = new TaskManagementV2025Api(this.config)
        }
        return this._taskManagementApi
    }

    // -------------------------------------------------------------------------
    // Generic Execution Helpers
    // -------------------------------------------------------------------------

    /**
     * Execute a single API function, optionally through the queue depending on configuration.
     * Returns the result directly as returned by the function (queue preserves the return type).
     * Returns undefined and logs the error if the API call fails.
     */
    public async execute<TResponse>(
        apiFunction: () => Promise<TResponse>,
        priority: QueuePriority = QueuePriority.NORMAL
    ): Promise<TResponse | undefined> {
        const fn = () => {
            if (!this.requestTimeoutMs) {
                return apiFunction()
            }
            return Promise.race<TResponse>([
                apiFunction(),
                new Promise<TResponse>((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`API request timed out after ${this.requestTimeoutMs}ms`)),
                        this.requestTimeoutMs
                    )
                ),
            ])
        }

        try {
            if (this.queue) {
                return await this.queue.enqueue(() => fn(), { priority })
            }

            return await fn()
        } catch (error) {
            this.log.error(`API request failed: ${error instanceof Error ? error.message : String(error)}`)
            return undefined
        }
    }

    /**
     * Paginate API calls with optional queue support.
     * Each page request is routed through the queue (if enabled) for proper rate limiting and concurrency control.
     * The pageSize from config determines the page size.
     * Base parameters are merged with pagination parameters (limit/offset) automatically.
     * Pages are fetched sequentially to ensure correct detection of the end of data.
     *
     * @param callFunction - Function that accepts request parameters and returns a promise with { data: T[] }
     * @param baseParameters - Base request parameters (filters, etc.) that will be merged with pagination params
     * @param priority - Optional priority for the page requests (default: NORMAL, only used if queue is enabled)
     * @returns Promise resolving to all paginated data
     *
     * @example
     * ```typescript
     * const accounts = await client.paginate(
     *   (params) => client.accountsApi.listAccounts(params),
     *   { filters: 'sourceId eq "123"' }
     * )
     * ```
     */
    public async paginate<T, TRequestParams = any>(
        callFunction: (requestParameters: TRequestParams) => Promise<{ data: T[] }>,
        baseParameters: Partial<TRequestParams> = {},
        priority: QueuePriority = QueuePriority.NORMAL
    ): Promise<T[]> {
        const pageSize = this.pageSize // Paging size is driven by config
        const allItems: T[] = []
        // If limit is undefined, treat it as "no limit" and paginate through all results
        const baseLimit = (baseParameters as any).limit
        const hasExplicitLimit = baseLimit !== undefined && baseLimit !== null
        const initialLimit = hasExplicitLimit && baseLimit < pageSize ? baseLimit : pageSize

        // Build initial params
        const initialParams = {
            ...baseParameters,
            limit: initialLimit,
            offset: 0,
        } as TRequestParams
        // Remove limit if it was undefined to let API return all results on first page (if supported)
        if (!hasExplicitLimit) {
            delete (initialParams as any).limit
        }

        const initialResponse = await this.execute<{ data: T[] }>(() => callFunction(initialParams), priority)
        const initialPage = initialResponse?.data || []
        allItems.push(...initialPage)

        // If the first page is smaller than pageSize, we already have all data
        // Or if we have an explicit limit and we've reached it
        if (initialPage.length < pageSize || (hasExplicitLimit && allItems.length >= baseLimit)) {
            // If we have an explicit limit, trim to that limit
            if (hasExplicitLimit && allItems.length > baseLimit) {
                return allItems.slice(0, baseLimit)
            }
            return allItems
        }

        // Start with offset after the first page
        let offset = initialPage.length

        // Continue fetching pages sequentially until no more data
        // We use sequential fetching to ensure we correctly detect when we've reached the end
        while (true) {
            // Check if we've reached the explicit limit
            if (hasExplicitLimit && allItems.length >= baseLimit) {
                // Trim to the limit if we've exceeded it
                if (allItems.length > baseLimit) {
                    allItems.splice(baseLimit)
                }
                break
            }

            // Calculate how many items we still need
            const remainingLimit = hasExplicitLimit ? baseLimit - allItems.length : undefined
            const requestLimit = remainingLimit !== undefined && remainingLimit < pageSize ? remainingLimit : pageSize

            // Build page params
            const pageParams = {
                ...baseParameters,
                limit: requestLimit,
                offset,
            } as TRequestParams
            // Remove limit if it was undefined in base parameters
            if (!hasExplicitLimit) {
                delete (pageParams as any).limit
            }

            const pageResponse = await this.execute<{ data: T[] }>(() => callFunction(pageParams), priority)
            const pageData = pageResponse?.data || []

            // If we get an empty page, we've reached the end
            if (pageData.length === 0) {
                break
            }

            allItems.push(...pageData)

            // If the page has fewer items than requested, it's the last page
            if (pageData.length < requestLimit) {
                break
            }

            // Move to next page
            offset += requestLimit
        }

        // Final trim to explicit limit if we have one
        if (hasExplicitLimit && allItems.length > baseLimit) {
            allItems.splice(baseLimit)
        }

        return allItems
    }

    /**
     * Paginate SearchApi operations with optional queue support.
     * Each page request is routed through the queue (if enabled) for proper rate limiting and concurrency control.
     * Respects SailPoint search semantics:
     * - Query is sorted by id
     * - Pages are defined by the searchAfter property (not offset)
     * - The first call uses count=true so X-Total-Count is populated
     *
     * @param search - The search object
     * @param priority - Optional priority for the page requests (default: NORMAL, only used if queue is enabled)
     * @returns Promise resolving to all paginated data
     *
     * @example
     * ```typescript
     * const search: Search = {
     *   indices: ['identities'],
     *   query: { query: '*' }
     * }
     * const identities = await client.paginateSearchApi<IdentityDocument>(search)
     * ```
     */
    public async paginateSearchApi<T>(search: Search, priority: QueuePriority = QueuePriority.NORMAL): Promise<T[]> {
        const pageSize = this.pageSize
        const allItems: T[] = []

        // Ensure sort by id as required for searchAfter paging
        const baseSearch: Search = {
            ...search,
            sort: ['id'],
        }

        let searchAfter: any[] | undefined
        let isFirstPage = true
        let hasMore = true

        while (hasMore) {
            const response = await this.execute<any>(
                () =>
                    this.searchApi.searchPost({
                        search: searchAfter ? { ...baseSearch, searchAfter } : baseSearch,
                        limit: pageSize,
                        // Use count=true only on the first request to populate X-Total-Count
                        count: isFirstPage ? true : undefined,
                    }),
                priority
            )
            const items = ((response?.data as T[]) || []) as T[]
            allItems.push(...items)

            if (items.length < pageSize) {
                hasMore = false
            } else {
                // Prepare searchAfter for the next page using the last item's id
                const lastItem: any = items[items.length - 1]
                const lastId = lastItem?.id
                if (!lastId) {
                    hasMore = false
                } else {
                    searchAfter = [lastId]
                }
            }

            isFirstPage = false
        }

        return allItems
    }

    /**
     * Get queue statistics (returns empty stats if queue is disabled)
     */
    public getQueueStats(): QueueStats {
        if (!this.queue) {
            return {
                totalProcessed: 0,
                totalFailed: 0,
                totalRetries: 0,
                averageWaitTime: 0,
                averageProcessingTime: 0,
                queueLength: 0,
                activeRequests: 0,
            }
        }
        return this.queue.getStats()
    }

    /**
     * Start periodic stats logging (only called when queue is enabled)
     */
    protected startStatsLogging(): void {
        if (!this.queue) {
            return
        }

        setInterval(() => {
            const stats = this.queue!.getStats()
            if (stats.queueLength > 0 || stats.activeRequests > 0) {
                this.log.debug(
                    `Queue Stats: ${stats.activeRequests} active, ${stats.queueLength} queued, ` +
                    `${stats.totalProcessed} processed, ${stats.totalFailed} failed, ` +
                    `avg wait: ${stats.averageWaitTime.toFixed(0)}ms, ` +
                    `avg process: ${stats.averageProcessingTime.toFixed(0)}ms`
                )
            }
        }, STATS_LOGGING_INTERVAL_MS)
    }
}
