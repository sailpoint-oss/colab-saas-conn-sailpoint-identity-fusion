import { FusionAccount } from '../../model/account'
import { MatchingConfig } from '../../model/config'

// ============================================================================
// Type Definitions — Scoring
// ============================================================================

/**
 * Result of scoring a single attribute comparison. Extends the matching config
 * with the calculated score and match result.
 */
export type ScoreReport = MatchingConfig & {
    /** The calculated similarity score (0-1) */
    score: number
    /** Whether the score met or exceeded the configured threshold */
    isMatch: boolean
    /** Human-readable description of the score result */
    comment?: string
}

/**
 * A match between a fusion account and an existing fusion identity,
 * including the per-attribute score breakdown that led to the match.
 *
 * Memory: identityId and identityName are stored so fusionIdentity can be cleared
 * after form creation, reducing retention of full FusionAccount references.
 */
export type FusionMatch = {
    /** The existing fusion identity (cleared after form creation to reduce retention) */
    fusionIdentity?: FusionAccount
    /** Identity ID for report and lookups - always present */
    identityId: string
    /** Display name for report - always present */
    identityName: string
    /** Score reports for each matching rule evaluated */
    scores: ScoreReport[]
}
