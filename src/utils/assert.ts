import { ServiceRegistry } from '../services/serviceRegistry'
import { ConnectorError, ConnectorErrorType } from '@sailpoint/connector-sdk'
import { getCallerFunctionName } from '../services/logService'

/**
 * Hard assertion - throws an error if condition is false or value is null/undefined
 * Automatically detects the caller function name for logging context
 *
 * Supports two patterns:
 * 1. Direct value: assert(value, 'message') - narrows value to non-null/non-undefined
 * 2. Boolean expression: assert(condition, 'message') - checks condition is true
 */
export function assert<T>(value: T | null | undefined, message: string): asserts value is T
export function assert(condition: boolean, message: string): asserts condition
export function assert<T>(
    valueOrCondition: T | null | undefined | boolean,
    message: string
): asserts valueOrCondition is T {
    // Check for null/undefined (for direct value pattern)
    const isNullish = valueOrCondition === null || valueOrCondition === undefined
    // Check for false (for boolean expression pattern)
    const isFalse = valueOrCondition === false

    if (isNullish || isFalse) {
        const serviceRegistry = ServiceRegistry.getCurrent()

        if (serviceRegistry?.log) {
            serviceRegistry.log.crash(message)
        } else {
            // Fallback if service registry not available
            const functionName = getCallerFunctionName(2) || 'unknown'
            throw new ConnectorError(`${functionName}: ${message}`, ConnectorErrorType.Generic)
        }
    }
}

/**
 * Soft assertion - logs a warning/error but doesn't throw
 * Automatically detects the caller function name for logging context
 * @returns true if assertion passed, false if it failed
 */
export function softAssert<T>(
    valueOrCondition: T | null | undefined,
    message: string,
    level: 'warn' | 'error' = 'warn'
): valueOrCondition is NonNullable<T> {
    const isNullish = valueOrCondition === null || valueOrCondition === undefined
    const isFalse = valueOrCondition === false

    if (isNullish || isFalse) {
        const serviceRegistry = ServiceRegistry.getCurrent()

        if (serviceRegistry?.log) {
            if (level === 'error') {
                serviceRegistry.log.error(message)
            } else {
                serviceRegistry.log.warn(message)
            }
        } else {
            // Fallback if service registry not available
            const functionName = getCallerFunctionName(2) || 'unknown'
            console.warn(`${functionName}: ${message}`)
        }
    }
    return !(isNullish || isFalse)
}
