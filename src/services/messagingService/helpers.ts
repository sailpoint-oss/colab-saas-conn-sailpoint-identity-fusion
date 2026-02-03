import Handlebars from 'handlebars'
import type { TemplateDelegate as HandlebarsTemplateDelegate } from 'handlebars'
import { FUSION_REVIEW_TEMPLATE, FUSION_REPORT_TEMPLATE } from '../../model/messages'

// ============================================================================
// Handlebars Helpers
// ============================================================================

/**
 * Register Handlebars helpers for common operations
 */
export const registerHandlebarsHelpers = (): void => {
    const algorithmLabels: Record<string, string> = {
        'name-matcher': 'Name Matcher',
        'jaro-winkler': 'Jaro-Winkler',
        lig3: 'LIG3',
        dice: 'Dice',
        'double-metaphone': 'Double Metaphone',
        custom: 'Custom',
        average: 'Average Score',
    }

    // Format attribute values for display
    Handlebars.registerHelper('formatAttribute', (value: any) => {
        if (value === null || value === undefined) {
            return 'N/A'
        }
        if (typeof value === 'object') {
            return JSON.stringify(value)
        }
        return String(value)
    })

    // Format scores for display
    Handlebars.registerHelper('formatScores', (scores: any[]) => {
        if (!scores || scores.length === 0) {
            return 'N/A'
        }
        return scores
            .map((score) => `${score.attribute}: ${score.score}% (${score.isMatch ? 'Match' : 'No Match'})`)
            .join(', ')
    })

    // Format numeric percentages to 0 decimals
    Handlebars.registerHelper('formatPercent', (value: any) => {
        const num = typeof value === 'number' ? value : Number.parseFloat(String(value))
        if (Number.isNaN(num)) return '0'
        return String(Math.round(num))
    })

    // Simple numeric multiply helper (useful for width calculations)
    Handlebars.registerHelper('multiply', (a: any, b: any) => {
        const left = typeof a === 'number' ? a : Number.parseFloat(String(a))
        const right = typeof b === 'number' ? b : Number.parseFloat(String(b))
        if (Number.isNaN(left) || Number.isNaN(right)) return 0
        return Math.round(left * right)
    })

    // Check if value exists
    Handlebars.registerHelper('exists', (value: any) => {
        return value !== null && value !== undefined && value !== ''
    })

    // Greater than helper
    Handlebars.registerHelper('gt', (a: number, b: number) => {
        return a > b
    })

    // Greater than or equal helper
    Handlebars.registerHelper('gte', (a: number, b: number) => {
        return a >= b
    })

    // Format date
    Handlebars.registerHelper('formatDate', (date: string | Date) => {
        if (!date) {
            return 'N/A'
        }
        const d = typeof date === 'string' ? new Date(date) : date
        return d.toLocaleDateString()
    })

    // Friendly algorithm names (aligned with connector-spec.json)
    Handlebars.registerHelper('algorithmLabel', (algorithm?: string) => {
        if (!algorithm) return 'N/A'
        return algorithmLabels[String(algorithm)] ?? String(algorithm)
    })

    // Identify the "Average Score" rollup row
    Handlebars.registerHelper('isAverageScoreRow', (attribute?: string, algorithm?: string) => {
        const attr = String(attribute ?? '')
        const alg = String(algorithm ?? '')
        return attr === 'Average Score' || alg === 'average'
    })

    // Chunk an array into rows for table rendering
    Handlebars.registerHelper('chunk', (arr: any[], size: any) => {
        const n = Math.max(1, Number.parseInt(String(size), 10) || 1)
        if (!Array.isArray(arr) || arr.length === 0) return []
        const out: any[] = []
        for (let i = 0; i < arr.length; i += n) {
            const row = arr.slice(i, i + n)
            while (row.length < n) row.push(null)
            out.push(row)
        }
        return out
    })
}

// ============================================================================
// Template Compilation
// ============================================================================

/**
 * Compile all email templates
 */
export const compileEmailTemplates = (): Map<string, HandlebarsTemplateDelegate> => {
    const templates = new Map<string, HandlebarsTemplateDelegate>()
    templates.set('fusion-review', Handlebars.compile(FUSION_REVIEW_TEMPLATE))
    templates.set('fusion-report', Handlebars.compile(FUSION_REPORT_TEMPLATE))
    return templates
}

// ============================================================================
// Template Rendering Types
// ============================================================================

/**
 * Review email uses the same data shape as the report (single-account report),
 * plus the standalone form URL for actioning the review.
 */
export type FusionReviewEmailData = {
    accounts: FusionReportEmailData['accounts']
    totalAccounts: number
    potentialDuplicates: number
    reportDate: Date | string
    formInstanceId?: string
    formUrl?: string
}

export type EditRequestEmailData = {
    accountName: string
    accountSource: string
    accountAttributes: Record<string, any>
    formInstanceId?: string
}

export type FusionReportEmailData = {
    accounts: Array<{
        accountName: string
        accountSource: string
        accountId?: string
        accountEmail?: string
        accountAttributes?: Record<string, any>
        matches: Array<{
            identityName: string
            identityId?: string
            identityUrl?: string
            isMatch: boolean
            scores?: Array<{
                attribute: string
                algorithm?: string
                score: number
                fusionScore?: number
                isMatch: boolean
                comment?: string
            }>
        }>
    }>
    totalAccounts: number
    potentialDuplicates: number
    reportDate: Date | string
}

// ============================================================================
// Template Rendering Functions
// ============================================================================

/**
 * Render fusion review email template
 */
export const renderFusionReviewEmail = (
    templates: Map<string, HandlebarsTemplateDelegate>,
    data: FusionReviewEmailData
): string => {
    const template = templates.get('fusion-review')
    if (!template) {
        throw new Error('Fusion review template not found')
    }
    return template(data)
}

/**
 * Render edit request email template
 */
export const renderEditRequestEmail = (
    templates: Map<string, HandlebarsTemplateDelegate>,
    data: EditRequestEmailData
): string => {
    const template = templates.get('edit-request')
    if (!template) {
        throw new Error('Edit request template not found')
    }
    return template(data)
}

/**
 * Render fusion report email template
 */
export const renderFusionReport = (
    templates: Map<string, HandlebarsTemplateDelegate>,
    data: FusionReportEmailData
): string => {
    const template = templates.get('fusion-report')
    if (!template) {
        throw new Error('Fusion report template not found')
    }
    return template(data)
}
