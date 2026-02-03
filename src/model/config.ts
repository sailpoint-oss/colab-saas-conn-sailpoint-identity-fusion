export interface BaseConfig {
    beforeProvisioningRule: string | null
    cloudCacheUpdate: number
    cloudDisplayName: string
    cloudExternalId: string
    commandType: string
    connectionType: string
    connectorName: string
    deleteThresholdPercentage: number
    deleteEmpty: boolean
    formPath: string | null
    healthy: boolean
    idnProxyType: string
    invocationId: string
    since: string
    sourceDescription: string
    spConnectorInstanceId: string
    spConnectorSpecId: string
    spConnectorSupportsCustomSchemas: boolean
    status: string
    templateApplication: string
    version: number
    spConnDebugLoggingEnabled: boolean
}

export interface AttributeMap {
    newAttribute: string
    existingAttributes: string[]
    attributeMerge?: 'first' | 'list' | 'concatenate' | 'source'
    source?: string
}

export interface AttributeDefinition {
    name: string
    expression?: string
    case?: 'same' | 'lower' | 'upper' | 'capitalize'
    type?: 'normal' | 'unique' | 'uuid' | 'counter'
    counterStart?: number
    digits?: number
    maxLength?: number
    normalize: boolean
    spaces: boolean
    refresh: boolean
    values?: Set<string>
}

export interface MatchingConfig {
    attribute: string
    algorithm?: 'name-matcher' | 'jaro-winkler' | 'lig3' | 'dice' | 'double-metaphone' | 'average' | 'custom'
    fusionScore?: number
    mandatory?: boolean
}

// ============================================================================
// Connection Settings Menu
// ============================================================================

// Connection Settings Section
export interface ConnectionSettingsSection {
    baseurl: string
    clientId: string
    clientSecret: string
}

// Connection Settings Menu
export type ConnectionSettingsMenu = ConnectionSettingsSection

// ============================================================================
// Source Settings Menu
// ============================================================================

// Scope Section
export interface ScopeSection {
    includeIdentities?: boolean
    identityScopeQuery?: string
}

// Source Configuration
export interface SourceConfig {
    name: string
    forceAggregation?: boolean
    accountFilter?: string
    accountLimit?: number
}

// Sources Section
export interface SourcesSection {
    sources: SourceConfig[]
    /**
     * Number of times to poll the aggregation task result when force aggregation is enabled.
     */
    taskResultRetries: number
    /**
     * Wait time (in milliseconds) between task status polls when force aggregation is enabled.
     */
    taskResultWait: number
}

// Processing Control Section
export interface ProcessingControlSection {
    deleteEmpty: boolean
    correlateOnAggregation: boolean
    resetProcessingFlag: boolean
    forceAttributeRefresh: boolean
    maxHistoryMessages: number
}

// Source Settings Menu
export interface SourceSettingsMenu extends ScopeSection, SourcesSection, ProcessingControlSection { }

// ============================================================================
// Attribute Mapping Settings Menu
// ============================================================================

// Attribute Mapping Definitions Section
export interface AttributeMappingDefinitionsSection {
    attributeMerge: 'first' | 'list' | 'concatenate'
    attributeMaps?: AttributeMap[]
}

// Attribute Mapping Settings Menu
export type AttributeMappingSettingsMenu = AttributeMappingDefinitionsSection

// ============================================================================
// Attribute Definition Settings Menu
// ============================================================================

// Attribute Definition Settings Section
export interface AttributeDefinitionSettingsSection {
    attributeDefinitions: AttributeDefinition[]
    /**
     * Maximum number of attempts to generate a unique attribute value before giving up.
     * Prevents infinite loops when generating unique or UUID attributes.
     */
    maxAttempts?: number
}

// Attribute Definition Settings Menu
export type AttributeDefinitionSettingsMenu = AttributeDefinitionSettingsSection

// ============================================================================
// Fusion Settings Menu
// ============================================================================

// Matching Settings Section
export interface MatchingSettingsSection {
    matchingConfigs?: MatchingConfig[]
    fusionUseAverageScore: boolean
    fusionAverageScore?: number
    fusionMergingIdentical: boolean
}

// Review Settings Section
export interface ReviewSettingsSection {
    fusionFormAttributes?: string[]
    fusionFormExpirationDays: number
    fusionOwnerIsGlobalReviewer?: boolean
    fusionReportOnAggregation?: boolean
}

// Fusion Settings Menu
export interface FusionSettingsMenu extends MatchingSettingsSection, ReviewSettingsSection { }

// ============================================================================
// Advanced Settings Menu
// ============================================================================

// Developer Settings Section
export interface DeveloperSettingsSection {
    reset: boolean
    externalLoggingEnabled: boolean
    externalLoggingUrl?: string
    externalLoggingLevel?: 'error' | 'warn' | 'info' | 'debug'
}

// Advanced Connection Settings Section
export interface AdvancedConnectionSettingsSection {
    /**
     * Maximum time in seconds to wait for provisioning operations to complete.
     */
    provisioningTimeout?: number

    /**
     * Enable queue management for API requests.
     */
    enableQueue: boolean

    /**
     * Enable retry logic for failed API requests.
     */
    enableRetry: boolean

    /**
     * The number of times to retry a failed API request.
     */
    maxRetries?: number

    /**
     * Maximum number of requests to send per second.
     */
    requestsPerSecond?: number

    /**
     * Maximum number of API requests to run concurrently.
     * Used for queueConfig.maxConcurrentRequests.
     */
    maxConcurrentRequests?: number

    /**
     * Wait time (in milliseconds) for processing operations.
     * Reserved for future scheduling features.
     */
    processingWait?: number

    /**
     * Base delay (in milliseconds) between retry attempts for failed requests.
     * For HTTP 429 responses, the retry delay is automatically calculated from the retry-after header.
     */
    retryDelay?: number

    /**
     * Enable batching of requests in the queue for better efficiency.
     */
    enableBatching?: boolean

    /**
     * Number of requests to include in a single processing batch.
     */
    batchSize?: number

    /**
     * Enable priority processing in the queue, allowing more important requests to be handled first.
     * Enabled by default when queue is enabled.
     */
    enablePriority?: boolean
}

// Proxy Settings Section
export interface ProxySettingsSection {
    /**
     * Enable proxy mode to delegate all processing to an external endpoint.
     */
    proxyEnabled?: boolean

    /**
     * URL of the external endpoint that will handle processing when proxy mode is enabled.
     */
    proxyUrl?: string

    /**
     * Password or secret used by the external endpoint when proxy mode is enabled.
     */
    proxyPassword?: string
}

// Advanced Settings Menu
export interface AdvancedSettingsMenu
    extends DeveloperSettingsSection,
    AdvancedConnectionSettingsSection,
    ProxySettingsSection { }

// ============================================================================
// Internal/Computed fields
// ============================================================================

export interface InternalConfig {
    readonly fusionScoreMap?: Map<string, number>
    readonly requestsPerSecondConstant: number
    readonly tokenUrlPath: string
    readonly processingWaitConstant: number
    readonly retriesConstant: number
    readonly workflowName: string
    readonly padding: string
    readonly msDay: number
    readonly identityNotFoundWait: number
    readonly identityNotFoundRetries: number
    readonly separator: string
    readonly fusionFormNamePattern: string
    readonly nonAggregableTypes: readonly string[]
    readonly pageSize: number
    readonly fusionAccountRefreshThresholdInSeconds: number
    readonly concurrency: {
        readonly uncorrelatedAccounts: number
        readonly processAccounts: number
        readonly correlateAccounts: number
    }
    readonly fusionState?: Record<string, any>
}

// ============================================================================
// Source Config - Combination of all menus
// ============================================================================

export interface FusionConfig
    extends BaseConfig,
    ConnectionSettingsMenu,
    SourceSettingsMenu,
    AttributeMappingSettingsMenu,
    AttributeDefinitionSettingsMenu,
    FusionSettingsMenu,
    AdvancedSettingsMenu,
    InternalConfig { }
