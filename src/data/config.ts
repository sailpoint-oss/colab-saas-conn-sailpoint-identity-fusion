import { ConnectorError, ConnectorErrorType, readConfig, logger } from '@sailpoint/connector-sdk'
import { FusionConfig, SourceConfig } from '../model/config'

/**
 * Hard assertion - throws an error if condition is false or value is null/undefined
 * Uses default SDK logger instead of ServiceRegistry
 *
 * Supports two patterns:
 * 1. Direct value: assert(value, 'message') - narrows value to non-null/non-undefined
 * 2. Boolean expression: assert(condition, 'message') - checks condition is true
 */
function assert<T>(value: T | null | undefined, message: string): asserts value is T
function assert(condition: boolean, message: string): asserts condition
function assert<T>(valueOrCondition: T | null | undefined | boolean, message: string): asserts valueOrCondition is T {
    // Check for null/undefined (for direct value pattern)
    const isNullish = valueOrCondition === null || valueOrCondition === undefined
    // Check for false (for boolean expression pattern)
    const isFalse = valueOrCondition === false

    if (isNullish || isFalse) {
        logger.error(`safeReadConfig: ${message}`)
        throw new ConnectorError(message, ConnectorErrorType.Generic)
    }
}

/**
 * Soft assertion - logs a warning/error but doesn't throw
 * Uses default SDK logger instead of ServiceRegistry
 * @returns true if assertion passed, false if it failed
 */
function softAssert<T>(
    valueOrCondition: T | null | undefined,
    message: string,
    level: 'warn' | 'error' = 'warn'
): valueOrCondition is NonNullable<T> {
    const isNullish = valueOrCondition === null || valueOrCondition === undefined
    const isFalse = valueOrCondition === false

    if (isNullish || isFalse) {
        if (level === 'error') {
            logger.error(`safeReadConfig: ${message}`)
        } else {
            logger.warn(`safeReadConfig: ${message}`)
        }
    }
    return !(isNullish || isFalse)
}

const internalConfig = {
    requestsPerSecondConstant: 100,
    pageSize: 250,
    tokenUrlPath: '/oauth/token',
    processingWaitConstant: 60 * 1000,
    retriesConstant: 20,
    workflowName: 'Fusion Email Sender',
    padding: '   ',
    msDay: 86400000,
    identityNotFoundWait: 5000,
    identityNotFoundRetries: 5,
    separator: ' | ',
    fusionFormNamePattern: 'Fusion Review',
    nonAggregableTypes: ['DelimitedFile'],
    concurrency: {
        uncorrelatedAccounts: 500,
        processAccounts: 50,
        correlateAccounts: 25,
    },
    fusionAccountRefreshThresholdInSeconds: 60,
}

// NOTE: Don't add defaults from connector-spec.json here. Instead, add them to the connector-spec.json file.
export const safeReadConfig = async (): Promise<FusionConfig> => {
    logger.debug('Reading connector configuration')
    const sourceConfig = await readConfig()
    assert(sourceConfig, 'Failed to read source configuration')

    const config = {
        ...sourceConfig,
        ...internalConfig, // Internal constants always take precedence
    }

    // Validate required connection settings
    assert(config.baseurl, 'Base URL is required in configuration')
    assert(config.clientId, 'Client ID is required in configuration')
    assert(config.clientSecret, 'Client secret is required in configuration')
    assert(config.spConnectorInstanceId, 'Connector instance ID is required in configuration')

    logger.debug('Configuration loaded, applying defaults')

    // ============================================================================
    // Array defaults - ensure arrays are never undefined
    // ============================================================================
    config.attributeMaps = config.attributeMaps ?? []
    config.attributeDefinitions = config.attributeDefinitions ?? []
    config.sources = config.sources ?? []
    config.fusionFormAttributes = config.fusionFormAttributes ?? []
    config.matchingConfigs = config.matchingConfigs ?? []

    // ============================================================================
    // Source Settings defaults
    // ============================================================================
    // Set defaults for each source configuration
    config.sources = config.sources.map((sourceConfig: SourceConfig) => {
        assert(sourceConfig, 'Source configuration is required')
        assert(sourceConfig.name, 'Source name is required')
        return {
            ...sourceConfig,
            forceAggregation: sourceConfig.forceAggregation ?? false,
            accountFilter: sourceConfig.accountFilter ?? undefined,
        }
    })

    softAssert(config.sources.length > 0, 'No sources configured - no deduplication will be performed', 'warn')
    // Global aggregation task polling defaults (used for all sources with force aggregation enabled)
    config.taskResultRetries = config.taskResultRetries ?? 5
    // taskResultWait is configured in seconds in connector-spec.json; convert to milliseconds for internal use
    const taskResultWaitSeconds = config.taskResultWait ?? 1
    config.taskResultWait = taskResultWaitSeconds * 1000
    config.correlateOnAggregation = config.correlateOnAggregation ?? false
    config.resetProcessingFlag = config.resetProcessingFlag ?? false
    config.deleteEmpty = config.deleteEmpty ?? false
    config.forceAttributeRefresh = config.forceAttributeRefresh ?? false
    config.maxHistoryMessages = config.maxHistoryMessages ?? 10

    // ============================================================================
    // Attribute Definition Settings defaults
    // ============================================================================
    config.maxAttempts = config.maxAttempts ?? 100

    // ============================================================================
    // Fusion Settings defaults
    // ============================================================================
    // Default from connector-spec.json: fusionExpirationDays: 7
    config.fusionFormExpirationDays = config.fusionFormExpirationDays ?? 7
    config.fusionMergingIdentical = config.fusionMergingIdentical ?? false
    config.fusionUseAverageScore = config.fusionUseAverageScore ?? false
    // fusionAverageScore is only used when fusionUseAverageScore is true
    // Default to 80 (80% similarity threshold) if not specified
    config.fusionAverageScore = config.fusionAverageScore ?? 80

    // ============================================================================
    // Advanced Connection Settings defaults
    // ============================================================================
    config.enableQueue = config.enableQueue ?? false
    config.enableRetry = config.enableRetry ?? false

    // Defaults from connector-spec.json: maxRetries: 20, requestsPerSecond: 10, maxConcurrentRequests: 10
    config.maxRetries = config.maxRetries ?? internalConfig.retriesConstant
    config.requestsPerSecond = config.requestsPerSecond ?? 10
    config.maxConcurrentRequests = config.maxConcurrentRequests ?? 10
    // retryDelay is configured in milliseconds in connector-spec.json
    config.retryDelay = config.retryDelay ?? 1000 // 1 second base delay (only used as fallback, 429 responses use retry-after header)
    config.pageSize = config.batchSize ?? 250 // Paging size is 250 for all calls
    config.enableBatching = config.enableBatching ?? false
    config.enablePriority = config.enablePriority ?? false
    // processingWait is configured in seconds in connector-spec.json; convert to milliseconds for internal use
    const processingWaitSeconds =
        config.processingWait !== undefined ? config.processingWait : internalConfig.processingWaitConstant / 1000
    config.processingWait = processingWaitSeconds * 1000

    // ============================================================================
    // Developer Settings defaults
    // ============================================================================
    config.reset = config.reset ?? false
    // Default from connector-spec.json: provisioningTimeout: 300
    config.provisioningTimeout = config.provisioningTimeout ?? 300
    config.externalLoggingEnabled = config.externalLoggingEnabled ?? false
    config.externalLoggingUrl = config.externalLoggingUrl ?? undefined
    // Default to 'info' level for external logging if enabled but level not specified
    config.externalLoggingLevel = config.externalLoggingLevel ?? 'info'

    if (config.fusionUseAverageScore) {
        assert(
            config.fusionAverageScore !== undefined,
            'Fusion average score is required when using average score mode'
        )
        assert(
            config.fusionAverageScore >= 0 && config.fusionAverageScore <= 100,
            'Fusion average score must be between 0 and 100'
        )

        config.getScore = (): number => {
            return config.fusionAverageScore!
        }
        logger.debug(`Using average fusion score: ${config.fusionAverageScore}`)
    } else {
        softAssert(
            config.matchingConfigs.length > 0,
            'No matching configurations defined - fusion matching may not work correctly',
            'warn'
        )

        config.fusionScoreMap = new Map<string, number>()
        for (const matchingConfig of config.matchingConfigs) {
            assert(matchingConfig.attribute, 'Matching config attribute is required')
            if (matchingConfig.fusionScore !== undefined) {
                assert(
                    matchingConfig.fusionScore >= 0 && matchingConfig.fusionScore <= 100,
                    `Fusion score for attribute ${matchingConfig.attribute} must be between 0 and 100`
                )
                config.fusionScoreMap.set(matchingConfig.attribute, matchingConfig.fusionScore)
            }
        }

        config.getScore = (attribute?: string): number => {
            assert(attribute, 'Attribute is required to get fusion score')
            const score = config.fusionScoreMap!.get(attribute)
            if (!score) {
                throw new ConnectorError(
                    `Fusion score not found for attribute: ${attribute}`,
                    ConnectorErrorType.NotFound
                )
            }
            return score
        }
        logger.debug(`Using per-attribute fusion scores for ${config.fusionScoreMap.size} attribute(s)`)
    }

    // Validate external logging configuration if enabled
    if (config.externalLoggingEnabled) {
        assert(config.externalLoggingUrl, 'External logging URL is required when external logging is enabled')
        assert(
            ['error', 'warn', 'info', 'debug'].includes(config.externalLoggingLevel || ''),
            'External logging level must be one of: error, warn, info, debug'
        )
    }

    logger.info('Configuration validation completed successfully')
    return config
}
