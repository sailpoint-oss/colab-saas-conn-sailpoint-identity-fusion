/** Base connector configuration provided by the ISC platform. */
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

/**
 * Configuration for mapping one or more source attributes into a single fusion attribute.
 * Controls how values are merged when multiple source accounts contribute the same attribute.
 */
export interface AttributeMap {
    /** The target fusion attribute name to create */
    newAttribute: string
    /** Source attribute names to read values from */
    existingAttributes: string[]
    /** Strategy for merging values: keep first, collect as list, concatenate strings, or pick from specific source */
    attributeMerge?: 'first' | 'list' | 'concatenate' | 'source'
    /** Specific source name to use (only applicable when attributeMerge is "source") */
    source?: string
}

/**
 * Configuration for a generated attribute whose value is computed via a Velocity template expression.
 * Supports multiple generation types: normal (template), unique (disambiguated), uuid, and counter.
 */
export interface AttributeDefinition {
    /** The target attribute name */
    name: string
    /** Apache Velocity template expression for value generation */
    expression?: string
    /** Case transformation to apply after generation */
    case?: 'same' | 'lower' | 'upper' | 'capitalize'
    /** Generation strategy: normal template, unique with disambiguation, UUID, or auto-increment counter */
    type?: 'normal' | 'unique' | 'uuid' | 'counter'
    /** Starting value for counter-type attributes */
    counterStart?: number
    /** Number of digits for counter-type attributes (zero-padded) */
    digits?: number
    /** Maximum character length for generated values */
    maxLength?: number
    /** Whether to normalize (transliterate) the generated value */
    normalize: boolean
    /** Whether to allow spaces in the generated value */
    spaces: boolean
    /** Whether to trim whitespace from the generated value */
    trim: boolean
    /** Whether to regenerate this attribute on every aggregation */
    refresh: boolean
    /** Set of already-used values for unique-type attributes (populated at runtime) */
    values?: Set<string>
}

/**
 * Configuration for a single attribute matching rule used in deduplication scoring.
 */
export interface MatchingConfig {
    /** The attribute name to compare between accounts */
    attribute: string
    /** The similarity algorithm to use for comparison */
    algorithm?: 'name-matcher' | 'jaro-winkler' | 'lig3' | 'dice' | 'double-metaphone' | 'average' | 'custom'
    /** Minimum similarity score (0-1) required to consider this attribute a match */
    fusionScore?: number
    /** If true, this rule must pass for the overall match to succeed (unless average scoring is used) */
    mandatory?: boolean
}

// ============================================================================
// Connection Settings Menu
// ============================================================================

/** ISC API connection credentials. */
export interface ConnectionSettingsSection {
    baseurl: string
    clientId: string
    clientSecret: string
}

export type ConnectionSettingsMenu = ConnectionSettingsSection

// ============================================================================
// Source Settings Menu
// ============================================================================

/** Controls which identities are included in fusion processing. */
export interface ScopeSection {
    includeIdentities?: boolean
    identityScopeQuery?: string
}

/** Configuration for a single managed source that feeds into fusion. */
export interface SourceConfig {
    name: string
    forceAggregation?: boolean
    accountFilter?: string
    accountLimit?: number
}

/** Configuration for all managed sources and aggregation behavior. */
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

/** Controls various processing behaviors during aggregation. */
export interface ProcessingControlSection {
    deleteEmpty: boolean
    correlateOnAggregation: boolean
    resetProcessingFlag: boolean
    forceAttributeRefresh: boolean
    skipAccountsWithMissingId: boolean
    maxHistoryMessages: number
}

/** Combined source settings: scope, sources, and processing controls. */
export interface SourceSettingsMenu extends ScopeSection, SourcesSection, ProcessingControlSection { }

// ============================================================================
// Attribute Mapping Settings Menu
// ============================================================================

/** Configuration for attribute mapping definitions and the default merge strategy. */
export interface AttributeMappingDefinitionsSection {
    attributeMerge: 'first' | 'list' | 'concatenate'
    attributeMaps?: AttributeMap[]
}

export type AttributeMappingSettingsMenu = AttributeMappingDefinitionsSection

// ============================================================================
// Attribute Definition Settings Menu
// ============================================================================

/** Configuration for generated attribute definitions (Velocity templates). */
export interface AttributeDefinitionSettingsSection {
    attributeDefinitions: AttributeDefinition[]
    /**
     * Maximum number of attempts to generate a unique attribute value before giving up.
     * Prevents infinite loops when generating unique or UUID attributes.
     */
    maxAttempts?: number
}

export type AttributeDefinitionSettingsMenu = AttributeDefinitionSettingsSection

// ============================================================================
// Fusion Settings Menu
// ============================================================================

/** Configuration for deduplication matching rules and scoring strategy. */
export interface MatchingSettingsSection {
    matchingConfigs?: MatchingConfig[]
    fusionUseAverageScore: boolean
    fusionAverageScore?: number
    fusionMergingIdentical: boolean
}

/** Configuration for the manual review workflow and fusion reports. */
export interface ReviewSettingsSection {
    fusionFormAttributes?: string[]
    fusionFormExpirationDays: number
    fusionOwnerIsGlobalReviewer?: boolean
    fusionReportOnAggregation?: boolean
}

/** Combined fusion settings: matching rules and review workflow. */
export interface FusionSettingsMenu extends MatchingSettingsSection, ReviewSettingsSection { }

// ============================================================================
// Advanced Settings Menu
// ============================================================================

/** Developer/debug settings including reset flag and external logging. */
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

/** Combined advanced settings: developer, connection tuning, and proxy. */
export interface AdvancedSettingsMenu
    extends DeveloperSettingsSection,
    AdvancedConnectionSettingsSection,
    ProxySettingsSection { }

// ============================================================================
// Internal/Computed fields
// ============================================================================

/** Internal constants and computed values not exposed through the UI configuration. */
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

/**
 * Complete fusion connector configuration. Combines all menu sections, the base
 * ISC platform config, and internal computed constants into a single interface.
 */
export interface FusionConfig
    extends BaseConfig,
    ConnectionSettingsMenu,
    SourceSettingsMenu,
    AttributeMappingSettingsMenu,
    AttributeDefinitionSettingsMenu,
    FusionSettingsMenu,
    AdvancedSettingsMenu,
    InternalConfig { }
