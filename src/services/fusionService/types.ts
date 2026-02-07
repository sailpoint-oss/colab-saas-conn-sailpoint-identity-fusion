// ============================================================================
// Type Definitions — Fusion Report
// ============================================================================

/** Individual attribute score within a fusion report match comparison. */
export type FusionReportScore = {
    /** The attribute name that was compared */
    attribute: string
    /** The algorithm used for comparison (e.g. "jaro-winkler", "name-matcher") */
    algorithm?: string
    /** The calculated similarity score (0-1) */
    score: number
    /** The configured threshold for this attribute */
    fusionScore?: number
    /** Whether the score met or exceeded the threshold */
    isMatch: boolean
    /** Human-readable explanation of the score result */
    comment?: string
}

/** A single identity match candidate within a fusion report account. */
export type FusionReportMatch = {
    /** Display name of the matched identity */
    identityName: string
    /** ISC identity ID */
    identityId?: string
    /** Direct URL to the identity in the ISC UI */
    identityUrl?: string
    /** Whether this candidate is considered a match overall */
    isMatch: boolean
    /** Per-attribute score breakdown */
    scores?: FusionReportScore[]
}

/** A single account entry in the fusion report, with its match candidates. */
export type FusionReportAccount = {
    /** Display name of the source account */
    accountName: string
    /** Name of the source the account belongs to */
    accountSource: string
    /** ISC account ID */
    accountId?: string
    /** Email address from the account attributes */
    accountEmail?: string
    /** Subset of account attributes included in the report */
    accountAttributes?: Record<string, any>
    /** List of identity match candidates with their scores */
    matches: FusionReportMatch[]
}

/**
 * Complete fusion report generated during aggregation or on-demand.
 * Contains all analyzed accounts and their deduplication match results.
 */
export type FusionReport = {
    /** Array of accounts analyzed in this report */
    accounts: FusionReportAccount[]
    /** Total number of accounts analyzed */
    totalAccounts?: number
    /** Number of accounts flagged as potential duplicates */
    potentialDuplicates?: number
    /** Timestamp when the report was generated */
    reportDate?: Date | string
}
