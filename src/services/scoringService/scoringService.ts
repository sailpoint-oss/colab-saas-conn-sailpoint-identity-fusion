import { FusionAccount } from '../../model/account'
import { MatchingConfig, FusionConfig } from '../../model/config'
import { LogService } from '../logService'
import { FusionMatch, ScoreReport } from './types'
import { scoreDice, scoreDoubleMetaphone, scoreJaroWinkler, scoreLIG3, scoreNameMatcher } from './helpers'

/**
 * Service for calculating and managing similarity scores for identity matching.
 * Handles score calculation, threshold checking, and score formatting.
 */
export class ScoringService {
    private readonly matchingConfigs: MatchingConfig[]
    private readonly fusionUseAverageScore: boolean
    private readonly fusionAverageScore: number
    private reportMode: boolean = false

    constructor(
        config: FusionConfig,
        private log: LogService
    ) {
        this.matchingConfigs = config.matchingConfigs ?? []
        this.fusionUseAverageScore = config.fusionUseAverageScore ?? false
        this.fusionAverageScore = config.fusionAverageScore ?? 0
    }

    public enableReportMode(): void {
        this.reportMode = true
    }

    public scoreFusionAccount(fusionAccount: FusionAccount, fusionIdentities: FusionAccount[]): void {
        // Use for...of instead of forEach for better performance in hot path
        for (const fusionIdentity of fusionIdentities) {
            this.compareFusionAccounts(fusionAccount, fusionIdentity)
        }
    }

    private compareFusionAccounts(
        fusionAccount: FusionAccount,
        fusionIdentity: FusionAccount
    ): void {
        const fullRun = this.reportMode || this.fusionUseAverageScore
        const scores: ScoreReport[] = []
        let isMatch = false

        for (const matching of this.matchingConfigs) {
            const accountAttribute = fusionAccount.attributes[matching.attribute]
            const identityAttribute = fusionIdentity.attributes[matching.attribute]
            if (accountAttribute && identityAttribute) {
                const scoreReport: ScoreReport = this.scoreAttribute(
                    accountAttribute.toString(),
                    identityAttribute.toString(),
                    matching
                )
                if (!scoreReport.isMatch && matching.mandatory && !fullRun) {
                    return
                }
                isMatch = isMatch || scoreReport.isMatch
                scores.push(scoreReport)
            }
        }

        if (this.fusionUseAverageScore) {
            const score = scores.reduce((acc, score) => acc + score.score, 0) / scores.length
            const match = score >= this.fusionAverageScore

            const scoreReport: ScoreReport = {
                attribute: 'Average Score',
                algorithm: 'average',
                fusionScore: this.fusionAverageScore,
                mandatory: true,
                score,
                isMatch: match,
                comment: match ? 'Average score is above threshold' : 'Average score is below threshold',
            }
            scores.push(scoreReport)
            isMatch = match
        } else {
            let hasMandatory = false
            let hasFailedMatch = false
            for (const score of scores) {
                if (score.mandatory) {
                    hasMandatory = true
                }
                if (!score.isMatch) {
                    hasFailedMatch = true
                }
                if (score.mandatory && !score.isMatch) {
                    break
                }
            }
            if (hasMandatory) {
                isMatch = true
            } else if (!hasFailedMatch) {
                isMatch = true
            }
        }

        const fusionMatch: FusionMatch = {
            fusionIdentity,
            scores,
        }
        if (isMatch) {
            fusionAccount.addFusionMatch(fusionMatch)
        }
    }

    private scoreAttribute(
        accountAttribute: string,
        identityAttribute: string,
        matchingConfig: MatchingConfig
    ): ScoreReport {
        switch (matchingConfig.algorithm) {
            case 'name-matcher':
                return scoreNameMatcher(accountAttribute, identityAttribute, matchingConfig)
            case 'jaro-winkler':
                return scoreJaroWinkler(accountAttribute, identityAttribute, matchingConfig)
            case 'dice':
                return scoreDice(accountAttribute, identityAttribute, matchingConfig)
            case 'double-metaphone':
                return scoreDoubleMetaphone(accountAttribute, identityAttribute, matchingConfig)
            case 'lig3':
                return scoreLIG3(accountAttribute, identityAttribute, matchingConfig)
            case 'custom':
                this.log.crash('Custom algorithm not implemented')
        }
        return { ...matchingConfig, score: 0, isMatch: false }
    }
}
