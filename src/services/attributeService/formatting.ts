import { transliterate } from 'transliteration'
import velocityjs from 'velocityjs'
import { RenderContext } from 'velocityjs/dist/src/type'
import { logger } from '@sailpoint/connector-sdk'
import { contextHelpers } from './contextHelpers'

// Cache for compiled Velocity templates to avoid repeated parsing
// Key: template expression, Value: compiled template
const templateCache = new Map<string, any>()

/**
 * Normalize string by transliterating and removing special characters
 */
export const normalize = (str: string): string => {
    let result = transliterate(str)
    result = result.replace(/'/g, '')

    return result
}

/**
 * Remove all spaces from a string
 */
export const removeSpaces = (str: string): string => {
    return str.replace(/\s/g, '')
}

/**
 * Transform string case based on caseType
 */
export const switchCase = (str: string, caseType: 'lower' | 'upper' | 'capitalize' | 'same'): string => {
    switch (caseType) {
        case 'lower':
            return str.toLowerCase()
        case 'upper':
            return str.toUpperCase()
        case 'capitalize':
            return str
                .split(' ')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
        default:
            return str
    }
}

/**
 * Evaluate Velocity template expression with extended context (Math, Date, Datefns)
 * Uses template caching to avoid repeated parsing and compilation
 */
export const evaluateVelocityTemplate = (
    expression: string,
    context: RenderContext,
    maxLength?: number
): string | undefined => {
    const extendedContext: RenderContext = { ...context, ...contextHelpers }
    logger.debug(`Evaluating velocity template - expression: ${expression}`)

    // Check cache for compiled template
    let velocity = templateCache.get(expression)
    if (!velocity) {
        // Parse and compile template, then cache it
        const template = velocityjs.parse(expression)
        velocity = new velocityjs.Compile(template)
        templateCache.set(expression, velocity)
        logger.debug(`Compiled and cached new velocity template: ${expression}`)
    }

    let result = velocity.render(extendedContext)

    if (maxLength && result.length > maxLength) {
        result = truncateResultToMaxLength(result, expression, extendedContext, maxLength)
    }

    if (result === '') {
        logger.debug('Velocity template evaluated to empty string (e.g. Normalize helper returned undefined), returning undefined')
        return undefined
    }

    logger.debug(`Velocity template evaluation result: ${result}`)
    return result
}

/**
 * Truncate result to maxLength, preserving counter if present
 */
const truncateResultToMaxLength = (
    result: string,
    expression: string,
    context: RenderContext,
    maxLength: number
): string => {
    // If counter is present and at the end of expression, preserve it
    if (hasCounterAtEnd(context, expression)) {
        return truncateWithCounterPreserved(result, context, maxLength, expression)
    }

    // Simple truncation if no counter or counter is not at the end
    if (context.counter && context.counter !== '') {
        logger.error(
            `Counter variable is not found at the end of the expression: ${expression}. Cannot truncate the result to the maximum length.`
        )
    }

    return result.substring(0, maxLength)
}

/**
 * Check if counter exists in context and is at the end of expression
 */
const hasCounterAtEnd = (context: RenderContext, expression: string): boolean => {
    const hasCounter = context.counter && context.counter !== ''
    const counterAtEnd = expression.endsWith('$counter') || expression.endsWith('${counter}')
    return hasCounter && counterAtEnd
}

/**
 * Truncate result preserving counter at the end
 */
const truncateWithCounterPreserved = (
    result: string,
    context: RenderContext,
    maxLength: number,
    expression: string
): string => {
    const originalCounter = context.counter!
    const originalCounterLength = originalCounter.toString().length
    const availableLength = maxLength - originalCounterLength

    if (availableLength < 0) {
        logger.error(
            `Maximum length ${maxLength} is less than counter length ${originalCounterLength} for expression: ${expression}`
        )
        return result.substring(0, maxLength)
    }

    const truncatedBase = result.substring(0, availableLength)
    return truncatedBase + originalCounter
}

/**
 * Pad a number with leading zeros to reach the specified length
 */
export const padNumber = (number: number, length: number): string => {
    const numStr = number.toString()
    return numStr.length < length ? numStr.padStart(length, '0') : numStr
}
