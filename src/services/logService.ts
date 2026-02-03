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
 * Payload sent to the external logging service
 */
interface ExternalLogPayload {
    timestamp: string
    level: LogLevel
    message: string
    data?: any
    functionName?: string
}

/**
 * Extracts the caller function name from the stack trace
 * @param skipFrames Number of stack frames to skip (default: 2 to skip this function and the logging method)
 * @returns The function name or undefined if not found
 */
export function getCallerFunctionName(skipFrames: number = 2): string | undefined {
    try {
        const stack = new Error().stack
        if (!stack) return undefined

        const lines = stack.split('\n')
        // Skip Error constructor, this function, and the logging method
        const callerLine = lines[skipFrames + 1]
        if (!callerLine) return undefined

        // Match various function name patterns:
        // - "    at functionName (file:line:col)"
        // - "    at ClassName.methodName (file:line:col)"
        // - "    at Object.methodName (file:line:col)"
        // - "    at /path/to/file:line:col" (anonymous)
        const patterns = [
            /at\s+(?:new\s+)?(\w+)\s*\(/, // functionName( or new ClassName(
            /at\s+(?:(\w+)\.)?(\w+)\s*\(/, // ClassName.methodName( or methodName(
            /at\s+Object\.(\w+)\s*\(/, // Object.methodName(
            /at\s+(\w+)\s*\(/, // functionName(
        ]

        for (const pattern of patterns) {
            const match = callerLine.match(pattern)
            if (match) {
                // For class methods, prefer method name over class name
                if (match[2]) return match[2]
                if (match[1]) return match[1]
            }
        }

        // If no match, try to extract from anonymous function context
        // Look for the module name in the file path
        const fileMatch = callerLine.match(/[/\\]([^/\\]+)\.(?:ts|js|tsx|jsx)/)
        if (fileMatch) {
            return fileMatch[1]
        }

        return undefined
    } catch {
        return undefined
    }
}

export class LogService {
    private logger: Logger
    private configuredLevel: LogLevel
    // External logging settings
    private externalLoggingEnabled: boolean
    private externalLoggingUrl?: string
    private externalLoggingLevel: LogLevel

    constructor(private config: LogConfig) {
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
     * Sends a log message to the external logging service.
     * This is fire-and-forget to avoid blocking the main execution.
     */
    private sendToExternalService(level: LogLevel, message: string, data?: any, functionName?: string): void {
        if (!this.externalLoggingUrl) return

        const payload: ExternalLogPayload = {
            timestamp: new Date().toISOString(),
            level,
            message,
            functionName,
        }

        // Only include data if it's defined and serializable
        if (data !== undefined && data !== null) {
            try {
                // Test if data is serializable
                JSON.stringify(data)
                payload.data = data
            } catch {
                // If not serializable, include a string representation
                payload.data = String(data)
            }
        }

        // Fire-and-forget: don't await, don't block execution
        fetch(this.externalLoggingUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        }).catch(() => {
            // Silently ignore errors to avoid infinite logging loops
            // and to not disrupt the main application flow
        })
    }

    private formatMessage(message: string, data?: any, functionName?: string): string {
        const fn = functionName || 'unknown'

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
     * Internal log method that handles both regular and external logging
     */
    private log(level: LogLevel, message: string, data?: any): void {
        const functionName = getCallerFunctionName(3) || 'unknown'
        const output = this.formatMessage(message, data, functionName)

        // Always do regular logging
        this.logger[level](output)

        // Send to external service if enabled and level threshold is met
        if (this.shouldSendExternal(level)) {
            this.sendToExternalService(level, message, data, functionName)
        }
    }

    info(message: string, data?: any): void {
        this.log('info', message, data)
    }

    debug(message: string, data?: any): void {
        this.log('debug', message, data)
    }

    warn(message: string, data?: any): void {
        this.log('warn', message, data)
    }

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
            const functionName = getCallerFunctionName(2) || 'unknown'
            const assertMessage = `Assertion failed: ${message}`
            const output = this.formatMessage(assertMessage, data, functionName)

            // Always do regular logging
            this.logger[level](output)

            // Send to external service if enabled and level threshold is met
            if (this.shouldSendExternal(level)) {
                this.sendToExternalService(level, assertMessage, data, functionName)
            }
        }
    }

    crash(message: string, data?: any): void {
        const functionName = getCallerFunctionName(2) || 'unknown'
        const output = this.formatMessage(message, data, functionName)

        // Always log the error
        this.logger.error(output)

        // Send to external service (crash is always error level)
        if (this.shouldSendExternal('error')) {
            this.sendToExternalService('error', message, data, functionName)
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
}
