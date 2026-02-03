import { FusionAccount } from '../../model/account'
import { MatchingConfig } from '../../model/config'

// ============================================================================
// Type Definitions
// ============================================================================

export type ScoreReport = MatchingConfig & {
    score: number
    isMatch: boolean
    comment?: string
}

export type FusionMatch = {
    fusionIdentity: FusionAccount
    scores: ScoreReport[]
}
