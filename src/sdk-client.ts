import axios, { AxiosInstance } from 'axios'
import axiosRetry from 'axios-retry'
import {
    logger,
} from '@sailpoint/connector-sdk'
import axiosThrottle from 'axios-request-throttle'
import {
    Configuration,
    CreateFormDefinitionRequestBeta,
    CreateFormInstanceRequestBeta,
    CustomFormsBetaApi,
    CustomFormsBetaApiFactory,
    FormDefinitionResponseBeta,
    FormInstanceCreatedByBeta,
    FormInstanceRecipientBeta,
    FormInstanceResponseBeta,
    FormInstanceResponseBetaStateEnum,
    Paginator,
    Search,
    SearchApi,
    SourcesApi,
    Account,
    WorkflowsBetaApi,
    WorkflowsBetaApiCreateWorkflowRequest,
    WorkflowBeta,
    TestWorkflowRequestBeta,
    PostExternalExecuteWorkflowRequestBeta,
    WorkflowOAuthClientBeta,
    EntitlementsBetaApi,
    EntitlementBeta,
    IdentityBeta,
    IdentitiesBetaApi,
    WorkgroupDtoBeta,
    GovernanceGroupsBetaApi,
    ListWorkgroupMembers200ResponseInnerBeta,
    AccountsApi,
    AccountsApiGetAccountRequest,
    AccountsApiListAccountsRequest,
    IdentityDocument,
    JsonPatchOperation,
    ProvisioningPolicyDto,
    SearchDocument,
    SourcesApiCreateProvisioningPolicyRequest,
    SourcesApiGetProvisioningPolicyRequest,
    Transform,
    TransformsApi,
    UsageType,
    SourcesBetaApi,
    TaskManagementBetaApi,
    TransformRead,
} from 'sailpoint-api-client'
import { URL } from 'url'
import { RETRIES, TASKRESULTRETRIES, TASKRESULTWAIT, TOKEN_URL_PATH } from './constants'
import { retriesConfig, throttleConfig } from './axios'

const sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generic async pagination utility that fetches data in parallel batches
 * @param fetchFunction - The function to call for each batch
 * @param batchSize - Size of each batch (default: 250)
 * @param maxParallelRequests - Maximum number of parallel requests (default: 8)
 * @returns - Array of all fetched items
 */
async function asyncBatchPaginate<T, P = any>(
    fetchFunction: (params: P) => Promise<{ data: T[] }>,
    params: P = {} as P,
    batchSize = 250,
    maxParallelRequests = 8
): Promise<T[]> {
    // Collection to store all fetched items
    let allItems: T[] = []

    // Make initial request to get first batch and potentially total count
    const initialParams = {
        ...params,
        limit: batchSize,
        offset: 0,
    } as P

    const initialResponse = await fetchFunction(initialParams)
    const initialBatch = initialResponse.data || []
    allItems = [...initialBatch]

    // If the first batch is smaller than batchSize, we already have all data
    if (initialBatch.length < batchSize) {
        return allItems
    }

    // Start with offset after the first batch
    let offset = batchSize
    let hasMoreData = true

    // Continue fetching batches in parallel until no more data
    while (hasMoreData) {
        // Create an array of promises for parallel requests
        const batchPromises = []

        for (let i = 0; i < maxParallelRequests; i++) {
            const currentOffset = offset + i * batchSize

            // Create a promise for each batch request
            const batchParams = {
                ...params,
                limit: batchSize,
                offset: currentOffset,
            } as P

            // Function to handle retries with exponential backoff
            const executeWithRetry = async (params: P, retryCount = 0): Promise<{ data: T[] }> => {
                try {
                    return await fetchFunction(params)
                } catch (error: any) {
                    // Check if it's a 429 error or other retryable error
                    if ((error.response?.status === 429 || axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error)) 
                        && retryCount < RETRIES) {
                        
                        let waitTime = 1000 * Math.pow(2, retryCount) // Exponential backoff
                        
                        // If it's a 429, use the retry-after header if available
                        if (error.response?.status === 429 && error.response.headers['retry-after']) {
                            waitTime = parseInt(error.response.headers['retry-after']) * 1000
                        }
                        
                        logger.info(`Retry ${retryCount + 1}/${RETRIES} for batch request after waiting ${waitTime}ms`)
                        
                        // Wait and then retry
                        await new Promise(resolve => setTimeout(resolve, waitTime))
                        return executeWithRetry(params, retryCount + 1)
                    }
                    
                    // If we've exhausted retries or it's not a retryable error, rethrow
                    logger.error(`Request failed after ${retryCount} retries: ${error.message}`)
                    throw error
                }
            }
            
            // Use our retry-enabled function
            const batchPromise = executeWithRetry(batchParams)
            batchPromises.push(batchPromise)
        }

        // Wait for all parallel requests to complete, handling any failures
        const batchResults = await Promise.allSettled(batchPromises)
        const batchResponses = batchResults
            .filter(result => result.status === 'fulfilled')
            .map(result => (result as PromiseFulfilledResult<{ data: T[] }>).value)
        
        // Log failed requests
        const failedCount = batchResults.filter(result => result.status === 'rejected').length
        if (failedCount > 0) {
            logger.warn(`${failedCount} batch requests failed after retries`)
        }
        
        logger.info(`Fetched ${batchResponses.length} batches with items total: ${allItems.length + batchResponses.reduce((sum, r) => sum + (r.data?.length || 0), 0)}`) 
        // Process all responses
        hasMoreData = false

        for (const response of batchResponses) {
            const batchData = response.data || []

            // Add the batch to our collected items
            allItems = [...allItems, ...batchData]

            // Check if this batch indicates more data available
            if (batchData.length === batchSize) {
                hasMoreData = true
            }
        }

        // Update offset for next parallel batch
        offset += batchSize * maxParallelRequests

        // If no batch was full size, we've reached the end
        if (!hasMoreData) {
            break
        }
    }

    return allItems
}

async function asyncBatchProcess<T, R = any>(
    items: T[],
    processFunction: (item: T) => Promise<R>,
    batchSize = 250,
    maxParallelRequests = 8
): Promise<R[]> {
    // Collection to store all processed results
    let allResults: R[] = []
    
    // Start processing from the beginning
    let offset = 0
    let hasMoreItems = true

    // Continue processing batches in parallel until all items are done
    while (hasMoreItems && offset < items.length) {
        // Create an array of promises for parallel requests
        const batchPromises = []

        for (let i = 0; i < maxParallelRequests && offset + i * batchSize < items.length; i++) {
            const currentOffset = offset + i * batchSize
            const batchItems = items.slice(currentOffset, currentOffset + batchSize)
            
            if (batchItems.length === 0) break

            // Function to handle retries with exponential backoff
            const executeWithRetry = async (items: T[], retryCount = 0): Promise<R[]> => {
                try {
                    // Process all items in this batch concurrently
                    const batchResults = await Promise.all(
                        items.map(item => processFunction(item))
                    )
                    return batchResults
                } catch (error: any) {
                    // Check if it's a retryable error
                    if (retryCount < RETRIES) {
                        const waitTime = 1000 * Math.pow(2, retryCount) // Exponential backoff
                        
                        logger.info(`Retry ${retryCount + 1}/${RETRIES} for batch after waiting ${waitTime}ms`)
                        
                        // Wait and then retry
                        await new Promise(resolve => setTimeout(resolve, waitTime))
                        return executeWithRetry(items, retryCount + 1)
                    }
                    
                    // If we've exhausted retries, rethrow
                    logger.error(`Batch processing failed after ${retryCount} retries: ${error.message}`)
                    throw error
                }
            }
            
            // Use our retry-enabled function
            const batchPromise = executeWithRetry(batchItems)
            batchPromises.push(batchPromise)
        }

        // Wait for all parallel requests to complete, handling any failures
        const batchResults = await Promise.allSettled(batchPromises)
        const batchResponses = batchResults
            .filter(result => result.status === 'fulfilled')
            .map(result => (result as PromiseFulfilledResult<R[]>).value)
        
        // Log failed requests
        const failedCount = batchResults.filter(result => result.status === 'rejected').length
        if (failedCount > 0) {
            logger.warn(`${failedCount} batch requests failed after retries`)
        }
        
        logger.info(`Processed ${batchResponses.length} batches with results total: ${allResults.length + batchResponses.reduce((sum, r) => sum + r.length, 0)}`)
        
        // Process all responses
        for (const response of batchResponses) {
            // Add the batch results to our collected results
            allResults = [...allResults, ...response]
        }

        // Update offset for next parallel batch
        offset += batchSize * maxParallelRequests

        // Check if we've processed all items
        if (offset >= items.length) {
            hasMoreItems = false
        }
    }

    return allResults
}

export class SDKClient {
    private config: Configuration

    constructor(config: any) {
        const tokenUrl = new URL(config.baseurl).origin + TOKEN_URL_PATH
        this.config = new Configuration({ ...config, tokenUrl, retriesConfig })
        axiosRetry(axios as any, retriesConfig)
        //axiosThrottle.use(axios as any, throttleConfig)
    }

    async listIdentities(attributes: string[]): Promise<IdentityDocument[]> {
        const api = new SearchApi(this.config)
        const search: Search = {
            indices: ['identities'],
            query: {
                query: '*',
            },
            sort: ['id'],
            includeNested: true,
            queryResultFilter: {
                includes: attributes,
            },
        }

        const response = await Paginator.paginateSearchApi(api, search, 10000)
        return response.data as IdentityDocument[]
    }

    async getIdentityByUID(uid: string): Promise<IdentityDocument | undefined> {
        const api = new SearchApi(this.config)

        const search: Search = {
            indices: ['identities'],
            query: {
                query: `attributes.uid.exact:"${uid}"`,
            },
            includeNested: true,
        }

        const response = await api.searchPost({ search, limit: 1 })

        if (response.data.length > 0) {
            return response.data[0] as IdentityDocument
        } else {
            return undefined
        }
    }

    async listIdentitiesByEntitlements(entitlements: string[]): Promise<IdentityDocument[]> {
        const api = new SearchApi(this.config)

        const query = entitlements.map((x) => `@access(value.exact:"${x}")`).join(' OR ')

        const search: Search = {
            indices: ['identities'],
            query: {
                query,
            },
            includeNested: true,
        }

        const response = await api.searchPost({ search })

        return response.data as IdentityDocument[]
    }

    async listIdentitiesBySource(id: string): Promise<IdentityDocument[]> {
        const api = new SearchApi(this.config)
        const search: Search = {
            indices: ['identities'],
            query: {
                query: `@accounts(source.id.exact:"${id}")`,
            },
            includeNested: true,
        }

        const response = await api.searchPost({ search })

        return response.data as IdentityDocument[]
    }

    async getIdentityBySearch(id: string): Promise<IdentityDocument | undefined> {
        const api = new SearchApi(this.config)
        const search: Search = {
            indices: ['identities'],
            query: {
                query: `id:${id}`,
            },
            includeNested: true,
        }

        const response = await api.searchPost({ search })

        return response.data[0] as IdentityDocument | undefined
    }

    async getIdentity(id: string): Promise<IdentityBeta | undefined> {
        const api = new IdentitiesBetaApi(this.config)

        const response = await api.getIdentity({ id })

        return response.data
    }

    async getAccountsByIdentity(id: string): Promise<Account[]> {
        const api = new AccountsApi(this.config)
        const filters = `identityId eq "${id}"`

        const response = await api.listAccounts({ filters })

        return response.data
    }

    async listAccountsBySource(id: string): Promise<Account[]> {
        const api = new AccountsApi(this.config)
        const filters = `sourceId eq "${id}"`

        // Using async pagination with parallel requests
        const fetchFunction = async (params: { limit: number; offset: number }) => {
            const response = await api.listAccounts({
                ...params,
                filters,
            })
            return response
        }

        // Get all accounts using parallel batch pagination
        const accounts = await asyncBatchPaginate<Account>(fetchFunction)
        return accounts
    }

    async getAccountBySourceAndNativeIdentity(id: string, nativeIdentity: string): Promise<Account | undefined> {
        const api = new AccountsApi(this.config)
        const filters = `sourceId eq "${id}" and nativeIdentity eq "${nativeIdentity}"`
        const response = await api.listAccounts({ filters })

        return response.data.length > 0 ? response.data[0] : undefined
    }

    async listUncorrelatedAccounts(sourceIds?: string[]): Promise<Account[]> {
        const api = new AccountsApi(this.config)
        let filters = 'uncorrelated eq true'
        if (sourceIds) {
            const sourceValues = sourceIds.map((x) => `"${x}"`).join(', ')
            filters += ` and sourceId in (${sourceValues})`
        }
        const search = async (requestParameters?: AccountsApiListAccountsRequest | undefined) => {
            return await api.listAccounts({ ...requestParameters, filters })
        }

        const response = await Paginator.paginate(api, search)

        return response.data
    }

    async listCorrelatedAccounts(sourceIds?: string[]): Promise<Account[]> {
        const api = new AccountsApi(this.config)
        let filters = 'uncorrelated eq false'
        if (sourceIds) {
            const sourceValues = sourceIds.map((x) => `"${x}"`).join(', ')
            filters += ` and sourceId in (${sourceValues})`
        }
        const search = async (requestParameters?: AccountsApiListAccountsRequest | undefined) => {
            return await api.listAccounts({ ...requestParameters, filters })
        }

        const response = await Paginator.paginate(api, search)

        return response.data
    }

    async listAccounts(sourceIds?: string[]): Promise<Account[]> {
        const api = new AccountsApi(this.config)
        let filters: string | undefined
        if (sourceIds) {
            const sourceValues = sourceIds.map((x) => `"${x}"`).join(', ')
            filters = `sourceId in (${sourceValues})`
        }

        // Using async pagination with parallel requests
        const fetchFunction = async (params: { limit: number; offset: number }) => {
            const response = await api.listAccounts({
                ...params,
                filters,
            })
            return response
        }

        // Get all accounts using parallel batch pagination
        const accounts = await asyncBatchPaginate<Account>(fetchFunction)
        return accounts
    }

    async getAccount(id: string): Promise<Account | undefined> {
        const api = new AccountsApi(this.config)
        const requestParameters: AccountsApiGetAccountRequest = { id }

        try {
            const response = await api.getAccount(requestParameters)
            return response.data
        } catch (e) {
            return undefined
        }
    }

    async getAccountByIdentityID(identityId: string, sourceId: string): Promise<Account | undefined> {
        const api = new AccountsApi(this.config)
        const requestParameters: AccountsApiListAccountsRequest = {
            limit: 1,
            filters: `identityId eq "${identityId}" and sourceId eq "${sourceId}"`,
        }

        const response = await api.listAccounts(requestParameters)

        return response.data.length > 0 ? response.data[0] : undefined
    }

    async listWorkgroups(): Promise<WorkgroupDtoBeta[]> {
        const api = new GovernanceGroupsBetaApi(this.config)

        const response = await Paginator.paginate(api, api.listWorkgroups)

        return response.data
    }

    async listWorkgroupMembers(workgroupId: string): Promise<ListWorkgroupMembers200ResponseInnerBeta[]> {
        const api = new GovernanceGroupsBetaApi(this.config)
        const response = await api.listWorkgroupMembers({ workgroupId })

        return response.data
    }

    async listSources() {
        const api = new SourcesApi(this.config)

        const response = await Paginator.paginate(api, api.listSources)

        return response.data
    }

    async getSource(id: string) {
        const api = new SourcesApi(this.config)

        const response = await api.getSource({ id })

        return response.data
    }

    async listSourceSchemas(sourceId: string) {
        const api = new SourcesApi(this.config)

        const response = await api.getSourceSchemas({ sourceId })

        return response.data
    }

    async listForms(): Promise<FormDefinitionResponseBeta[]> {
        const api = new CustomFormsBetaApi(this.config)

        const response = await api.searchFormDefinitionsByTenant()

        return response.data.results ? response.data.results : []
    }

    async deleteForm(formDefinitionID: string): Promise<void> {
        const api = new CustomFormsBetaApi(this.config)

        const response = await api.deleteFormDefinition({ formDefinitionID })
    }

    async listFormInstances(): Promise<FormInstanceResponseBeta[]> {
        const api = new CustomFormsBetaApi(this.config)

        const response = await api.searchFormInstancesByTenant()

        return response.data ? (response.data as FormInstanceResponseBeta[]) : []
    }

    async createTransform(transform: Transform): Promise<Transform> {
        const api = new TransformsApi(this.config)

        const response = await api.createTransform({ transform })

        return response.data
    }

    async listWorkflows(): Promise<WorkflowBeta[]> {
        const api = new WorkflowsBetaApi(this.config)

        const response = await api.listWorkflows()

        return response.data
    }

    async correlateAccount(identityId: string, id: string): Promise<object> {
        const api = new AccountsApi(this.config)
        const requestBody: JsonPatchOperation[] = [
            {
                op: 'replace',
                path: '/identityId',
                value: identityId,
            },
        ]
        try {
            const response = await api.updateAccount({ id, requestBody })
            return response.data
        } catch (error) {
            return {}
        }
    }

    async batchCreateForms(uniqueForms: CreateFormDefinitionRequestBeta[]): Promise<FormDefinitionResponseBeta[]> {
        const forms = await asyncBatchProcess(
            uniqueForms,
            this.createForm
        )
        return forms
    }

    async createForm(form: CreateFormDefinitionRequestBeta): Promise<FormDefinitionResponseBeta> {
        const api = new CustomFormsBetaApi(this.config)

        const response = await api.createFormDefinition({
            createFormDefinitionRequestBeta: form,
        })

        return response.data
    }

    async createFormInstance(
        formDefinitionId: string,
        formInput: { [key: string]: any },
        recipientList: string[],
        sourceId: string,
        expire: string
    ): Promise<FormInstanceResponseBeta> {
        const api = CustomFormsBetaApiFactory(this.config)

        const recipients: FormInstanceRecipientBeta[] = recipientList.map((x) => ({ id: x, type: 'IDENTITY' }))
        const createdBy: FormInstanceCreatedByBeta = {
            id: sourceId,
            type: 'SOURCE',
        }
        const body: CreateFormInstanceRequestBeta = {
            formDefinitionId,
            recipients,
            createdBy,
            expire,
            formInput,
            standAloneForm: true,
        }

        const response = await api.createFormInstance(body)

        return response.data
    }

    async setFormInstanceState(
        formInstanceId: string,
        state: FormInstanceResponseBetaStateEnum
    ): Promise<FormInstanceResponseBeta> {
        const api = CustomFormsBetaApiFactory(this.config)

        const body: { [key: string]: any }[] = [
            {
                op: 'replace',
                path: '/state',
                value: state,
            },
        ]
        const response = await api.patchFormInstance(formInstanceId, body)

        return response.data
    }

    async createWorkflow(workflow: WorkflowsBetaApiCreateWorkflowRequest): Promise<WorkflowBeta> {
        const api = new WorkflowsBetaApi(this.config)

        const response = await api.createWorkflow(workflow)

        return response.data
    }

    async createWorkflowExternalTrigger(id: string): Promise<WorkflowOAuthClientBeta> {
        const api = new WorkflowsBetaApi(this.config)

        const response = await api.postWorkflowExternalTrigger({ id })

        return response.data
    }

    async testWorkflow(id: string, testWorkflowRequestBeta: TestWorkflowRequestBeta) {
        const api = new WorkflowsBetaApi(this.config)

        const response = await api.testWorkflow({
            id,
            testWorkflowRequestBeta,
        })
        logger.info(`workflow sent. Response code ${response.status}`)
    }

    async triggerWorkflowExternal(
        id: string,
        postExternalExecuteWorkflowRequestBeta: PostExternalExecuteWorkflowRequestBeta
    ) {
        const api = new WorkflowsBetaApi(this.config)

        const response = await api.postExternalExecuteWorkflow({
            id,
            postExternalExecuteWorkflowRequestBeta,
        })
    }

    async listEntitlementsBySource(id: string): Promise<EntitlementBeta[]> {
        const api = new EntitlementsBetaApi(this.config)

        const filters = `source.id eq "${id}"`

        const search = async (requestParameters?: AccountsApiListAccountsRequest | undefined) => {
            return await api.listEntitlements({ ...requestParameters, filters })
        }

        const response = await Paginator.paginate(api, search)

        return response.data
    }

    async getTransformByName(name: string): Promise<TransformRead | undefined> {
        const api = new TransformsApi(this.config)

        const response = await api.listTransforms()

        return response.data.find((x) => x.name === name)
    }

    async updateTransform(transform: Transform, id: string): Promise<Transform> {
        const api = new TransformsApi(this.config)
        const response = await api.updateTransform({ id: id, transform })
        return response.data
    }

    // async testTransform(
    //     identityId: string,
    //     identityAttributeConfig: IdentityAttributeConfigBeta
    // ): Promise<string | undefined> {
    //     const api = new IdentityProfilesBetaApi(this.config)

    //     const response = await api.showGenerateIdentityPreview({
    //         identityPreviewRequestBeta: { identityId, identityAttributeConfig },
    //     })
    //     const attributes = response.data.previewAttributes
    //     const testAttribute = attributes?.find((x) => x.name === 'uid')

    //     return testAttribute && testAttribute.value ? testAttribute.value.toString() : undefined
    // }

    async getLatestAccountAggregation(sourceName: string): Promise<SearchDocument | undefined> {
        const api = new SearchApi(this.config)

        const search: Search = {
            indices: ['events'],
            query: {
                query: `operation:AGGREGATE AND status:PASSED AND objects:ACCOUNT AND target.name.exact:"${sourceName} [source]"`,
            },
            sort: ['-created'],
        }
        const response = await api.searchPost({ search, limit: 1 })

        return response.data.length === 0 ? undefined : response.data[0]
    }

    async aggregateAccounts(id: string): Promise<void> {
        const sourceApi = new SourcesBetaApi(this.config)

        const response = await sourceApi.importAccounts({ id })
        const taskApi = new TaskManagementBetaApi(this.config)

        let count = TASKRESULTRETRIES
        while (--count > 0) {
            const result = await taskApi.getTaskStatus({ id: response.data.task!.id! })
            if (result.data.completed) {
                break
            } else {
                await sleep(TASKRESULTWAIT)
            }
        }
    }

    async getProvisioningPolicy(sourceId: string, usageType: UsageType) {
        const api = new SourcesApi(this.config)

        const requestParameters: SourcesApiGetProvisioningPolicyRequest = {
            sourceId,
            usageType,
        }

        const response = await api.getProvisioningPolicy(requestParameters)

        return response.data
    }

    async createProvisioningPolicy(sourceId: string, provisioningPolicyDto: ProvisioningPolicyDto) {
        const api = new SourcesApi(this.config)

        const requestParameters: SourcesApiCreateProvisioningPolicyRequest = {
            sourceId,
            provisioningPolicyDto,
        }

        const response = await api.createProvisioningPolicy(requestParameters)

        return response.data
    }
}
