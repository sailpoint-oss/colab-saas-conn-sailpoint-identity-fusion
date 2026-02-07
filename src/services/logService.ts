import { ConnectorError, ConnectorErrorType, logger } from '@sailpoint/connector-sdk'

type Logger = typeof logger

/**
 * Log levels in order of priority (lowest to highest)
 * debug < info < warn < error
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
}

type LogConfig = {
    spConnDebugLoggingEnabled: boolean
    logLevel?: LogLevel
    // External logging configuration
    externalLoggingEnabled?: boolean
    externalLoggingUrl?: string
    externalLoggingLevel?: LogLevel
}


/**
 * Known operation function names
 */
const OPERATION_NAMES = new Set([
    'accountList',
    'accountCreate', 
    'accountRead',
    'accountUpdate',
    'accountDelete',
    'accountEnable',
    'accountDisable',
    'entitlementList',
    'accountDiscoverSchema',
    'testConnection',
])

/**
 * Extracts the caller service and method name from the stack trace
 * @param skipFrames Number of stack frames to skip (default: 2 to skip this function and the logging method)
 * @returns An object with origin (formatted string) and isOperation (boolean)
 */
export function getCallerInfo(skipFrames: number = 2): { origin: string; isOperation: boolean } {
    try {
        const stack = new Error().stack
        if (!stack) return { origin: 'unknown', isOperation: false }

        const lines = stack.split('\n')
        // Skip Error constructor, this function, and the logging method
        const callerLine = lines[skipFrames + 1]
        if (!callerLine) return { origin: 'unknown', isOperation: false }

        // Check if this is from an operations file (works in dev/source)
        // or check the full stack for operations path (works in compiled code)
        const isOperationByPath = callerLine.includes('/operations/') || stack.includes('/operations/')
        
        // Match various function name patterns and extract both class and method when available:
        // - "    at ClassName.methodName (file:line:col)"
        // - "    at Object.methodName (file:line:col)"
        // - "    at functionName (file:line:col)"
        
        // Try to match ClassName.methodName first (most specific)
        const classMethodMatch = callerLine.match(/at\s+(\w+)\.(\w+)\s*\(/)
        if (classMethodMatch) {
            const className = classMethodMatch[1]
            const methodName = classMethodMatch[2]
            // Skip generic Object prefix, keep meaningful class names
            if (className !== 'Object') {
                return { 
                    origin: `${className}>${methodName}`, 
                    isOperation: false 
                }
            }
            return { origin: methodName, isOperation: isOperationByPath }
        }

        // Try to match standalone function name
        const functionMatch = callerLine.match(/at\s+(?:new\s+)?(\w+)\s*\(/)
        if (functionMatch) {
            const functionName = functionMatch[1]
            // Check if it's an operation by name or path
            const isOperation = OPERATION_NAMES.has(functionName) || isOperationByPath
            // Format operations with brackets
            if (isOperation) {
                return { origin: `[${functionName}]`, isOperation: true }
            }
            return { origin: functionName, isOperation: false }
        }

        // If no match, try to extract from the file path
        const fileMatch = callerLine.match(/[/\\]([^/\\]+)\.(?:ts|js|tsx|jsx)/)
        if (fileMatch) {
            const fileName = fileMatch[1]
            const isOperation = OPERATION_NAMES.has(fileName) || isOperationByPath
            if (isOperation) {
                return { origin: `[${fileName}]`, isOperation: true }
            }
            return { origin: fileName, isOperation: false }
        }

        return { origin: 'unknown', isOperation: false }
    } catch {
        return { origin: 'unknown', isOperation: false }
    }
}

/**
 * Legacy function for backwards compatibility
 */
export function getCallerFunctionName(skipFrames: number = 2): string | undefined {
    return getCallerInfo(skipFrames).origin
}

/**
 * Structured logging service wrapping the SailPoint SDK logger.
 *
 * Features:
 * - Configurable log levels (debug, info, warn, error)
 * - Automatic caller origin detection via stack trace analysis
 * - Optional external logging to a remote HTTP endpoint
 * - Assertion-style logging (similar to `console.assert`)
 * - Crash method that logs and throws a ConnectorError
 * - Flush support for serverless environments
 */
export class LogService {
    private logger: Logger
    private configuredLevel: LogLevel
    // External logging settings
    private externalLoggingEnabled: boolean
    private externalLoggingUrl?: string
    private externalLoggingLevel: LogLevel
    // Track pending external log promises so they can be flushed before process exit.
    // Uses a Set for O(1) add/delete instead of array indexOf which is O(n).
    private pendingExternalLogs: Set<Promise<void>> = new Set()

    /**
     * @param config - Logging configuration including level, debug flag, and external logging settings
     */
    constructor(config: LogConfig) {
        this.logger = logger
        // Determine configured log level: explicit logLevel > debug flag > default 'info'
        if (config.logLevel) {
            this.configuredLevel = config.logLevel
        } else if (config.spConnDebugLoggingEnabled) {
            this.configuredLevel = 'debug'
        } else {
            this.configuredLevel = 'info'
        }

        // External logging configuration
        this.externalLoggingEnabled = config.externalLoggingEnabled ?? false
        this.externalLoggingUrl = config.externalLoggingUrl
        this.externalLoggingLevel = config.externalLoggingLevel ?? 'error'

        // Also set the underlying logger level
        logger.level = this.configuredLevel
    }

    /**
     * Checks if a message at the given level should be sent to the external service.
     * Returns true if external logging is enabled and the message level is
     * at or above (less verbose than) the configured external logging level.
     */
    private shouldSendExternal(messageLevel: LogLevel): boolean {
        if (!this.externalLoggingEnabled || !this.externalLoggingUrl) {
            return false
        }
        return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[this.externalLoggingLevel]
    }

    /**
     * Pads log level to ensure alignment (7 characters including brackets)
     * Used for external logging service
     */
    private padLogLevel(level: LogLevel): string {
        const levelMap: Record<LogLevel, string> = {
            debug: '[DEBUG]',
            info: '[INFO] ',
            warn: '[WARN] ',
            error: '[ERROR]',
        }
        return levelMap[level]
    }

    /**
     * Sends a log message to the external logging service in plain text.
     * This is fire-and-forget to avoid blocking the main execution.
     * Sends plain text: HH:MM:SS [LEVEL] origin: message
     * The log server will handle colorization for console display.
     */
    private sendToExternalService(
        level: LogLevel, 
        message: string, 
        data?: any, 
        origin?: string
    ): void {
        if (!this.externalLoggingUrl) return

        // Format timestamp as HH:MM:SS
        const now = new Date()
        const timestamp = now.toTimeString().split(' ')[0]

        // Build the log message with padding (no colors - log server handles that)
        const paddedLevel = this.padLogLevel(level)
        const fn = origin || 'unknown'
        
        let logMessage = `${timestamp} ${paddedLevel} ${fn}: ${message}`

        // Append data if present
        if (data !== undefined && data !== null) {
            if (data instanceof Error) {
                logMessage += ` [Error: ${data.name}: ${data.message}]`
            } else if (typeof data === 'object') {
                try {
                    logMessage += ` ${JSON.stringify(data)}`
                } catch {
                    logMessage += ` ${String(data)}`
                }
            } else {
                logMessage += ` ${String(data)}`
            }
        }

        // Track the promise so it can be flushed before the process exits.
        // In cloud/serverless environments, fire-and-forget fetches get killed
        // when the container is recycled after the handler returns.
        const pending: Promise<void> = fetch(this.externalLoggingUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: logMessage,
        }).then(() => {
            // Discard response - we only care about delivery
        }).catch(() => {
            // Silently ignore errors to avoid infinite logging loops
            // and to not disrupt the main application flow
        }).finally(() => {
            // O(1) removal from Set (was O(n) indexOf on array)
            this.pendingExternalLogs.delete(pending)
        })
        this.pendingExternalLogs.add(pending)
    }

    /**
     * Formats a log message with caller origin and optional data payload.
     * Handles Error objects, primitives, and JSON-serializable objects.
     *
     * @param message - The base log message
     * @param data - Optional data to append (Error, primitive, or object)
     * @param origin - The caller origin string (e.g. "FusionService>processFusionAccount")
     * @returns The formatted log string
     */
    private formatMessage(
        message: string, 
        data?: any, 
        origin?: string
    ): string {
        const fn = origin || 'unknown'

        if (data === undefined || data === null) {
            return `${fn}: ${message}`
        }

        // Handle Error objects
        if (data instanceof Error) {
            return `${fn}: ${message} [Error: ${data.name}: ${data.message}${data.stack ? ' | Stack: ' + data.stack : ''}]`
        }

        // Handle primitives (string, number, boolean, bigint, symbol)
        if (['string', 'number', 'boolean', 'bigint', 'symbol'].includes(typeof data)) {
            return `${fn}: ${message} ${String(data)}`
        }

        // Handle objects and arrays
        try {
            return `${fn}: ${message} ${JSON.stringify(data)}`
        } catch (e) {
            // If data is not serializable
            return `${fn}: ${message} [Unserializable data: ${JSON.stringify(data)}] ${e}`
        }
    }

    /**
     * Internal log method that handles both regular and external logging.
     *
     * Performance Optimization:
     * Stack trace capture (getCallerInfo) is one of the most expensive operations in V8.
     * We only pay that cost when caller origin is actually needed: when external logging
     * is enabled for this level, or when debug-level logging is configured.
     */
    private log(level: LogLevel, message: string, data?: any): void {
        const needsOrigin = this.shouldSendExternal(level) || this.configuredLevel === 'debug'
        const origin = needsOrigin ? getCallerInfo(3).origin : undefined

        const output = this.formatMessage(message, data, origin)

        // Use SDK logger - it handles timestamp and level formatting
        this.logger[level](output)

        // Send to external service if enabled and level threshold is met
        if (this.shouldSendExternal(level)) {
            this.sendToExternalService(level, message, data, origin)
        }
    }

    /**
     * Logs an informational message. Used for significant operational milestones.
     * @param message - The log message
     * @param data - Optional structured data to attach
     */
    info(message: string, data?: any): void {
        this.log('info', message, data)
    }

    /**
     * Logs a debug message. Only output when log level is "debug".
     * Used for detailed diagnostic information during development.
     * @param message - The log message
     * @param data - Optional structured data to attach
     */
    debug(message: string, data?: any): void {
        this.log('debug', message, data)
    }

    /**
     * Logs a warning message. Used for recoverable issues that deserve attention.
     * @param message - The log message
     * @param data - Optional structured data to attach
     */
    warn(message: string, data?: any): void {
        this.log('warn', message, data)
    }

    /**
     * Logs an error message. Used for failures that don't warrant an exception.
     * @param message - The log message
     * @param data - Optional structured data to attach
     */
    error(message: string, data?: any): void {
        this.log('error', message, data)
    }

    /**
     * Logs a message at the specified level only if the condition is false.
     * Also sends to external service if enabled and level threshold is met.
     * Similar to console.assert()
     * @param condition If false, the message will be logged
     * @param message The message to log
     * @param data Optional data to include
     * @param level The log level to use (default: 'error')
     */
    assert(condition: boolean, message: string, data?: any, level: LogLevel = 'error'): void {
        if (!condition) {
            const callerInfo = getCallerInfo(2)
            const { origin } = callerInfo
            const assertMessage = `Assertion failed: ${message}`
            const output = this.formatMessage(assertMessage, data, origin)

            // Use SDK logger - it handles timestamp and level formatting
            this.logger[level](output)

            // Send to external service if enabled and level threshold is met
            if (this.shouldSendExternal(level)) {
                this.sendToExternalService(level, assertMessage, data, origin)
            }
        }
    }

    /**
     * Logs an error message and immediately throws a {@link ConnectorError}.
     * Used for unrecoverable failures that should halt the current operation.
     *
     * @param message - The error message (also used as the ConnectorError message)
     * @param data - Optional error or structured data to attach
     * @throws {ConnectorError} Always thrown after logging
     */
    crash(message: string, data?: any): void {
        const callerInfo = getCallerInfo(2)
        const { origin } = callerInfo
        const output = this.formatMessage(message, data, origin)

        // Use SDK logger - it handles timestamp and level formatting
        this.logger.error(output)

        // Send to external service (crash is always error level)
        if (this.shouldSendExternal('error')) {
            this.sendToExternalService('error', message, data, origin)
        }

        throw new ConnectorError(message, ConnectorErrorType.Generic)
    }

    /**
     * Gets the currently configured log level
     */
    getLogLevel(): LogLevel {
        return this.configuredLevel
    }

    /**
     * Sets the log level at runtime
     */
    setLogLevel(level: LogLevel): void {
        this.configuredLevel = level
        this.logger.level = level
    }

    /**
     * Gets the external logging level threshold
     */
    getExternalLogLevel(): LogLevel {
        return this.externalLoggingLevel
    }

    /**
     * Sets the external logging level threshold at runtime
     */
    setExternalLogLevel(level: LogLevel): void {
        this.externalLoggingLevel = level
    }

    /**
     * Checks if external logging is enabled
     */
    isExternalLoggingEnabled(): boolean {
        return this.externalLoggingEnabled && !!this.externalLoggingUrl
    }

    /**
     * Awaits all pending external log fetch calls.
     * Must be called before the operation handler returns to ensure all log
     * messages are delivered in cloud/serverless environments where the
     * container is recycled immediately after the handler completes.
     * @param timeoutMs Maximum time to wait for pending logs (default: 5000ms)
     */
    async flush(timeoutMs: number = 5000): Promise<void> {
        if (this.pendingExternalLogs.size === 0) return
        const pending = [...this.pendingExternalLogs]
        await Promise.race([
            Promise.allSettled(pending),
            new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
        ])
        // Clear any stragglers that didn't settle in time
        this.pendingExternalLogs.clear()
    }
}
