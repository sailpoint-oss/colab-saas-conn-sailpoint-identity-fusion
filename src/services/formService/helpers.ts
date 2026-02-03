import { FusionAccount } from '../../model/account'
import { OwnerDto } from 'sailpoint-api-client'
import { SourceService } from '../sourceService'
import { assert } from '../../utils/assert'
import { Candidate } from './types'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build candidate list from fusion matches
 */
export const buildCandidateList = (fusionAccount: FusionAccount): Candidate[] => {
    assert(fusionAccount, 'Fusion account is required')
    assert(fusionAccount.fusionMatches, 'Fusion matches are required')

    const candidates = fusionAccount.fusionMatches.map((match) => {
        assert(match.fusionIdentity, 'Fusion identity is required in match')
        assert(match.fusionIdentity.identityId, 'Fusion identity ID is required')
        const attrs: Record<string, any> = match.fusionIdentity.attributes || {}
        return {
            id: match.fusionIdentity.identityId,
            // IMPORTANT: keep this aligned with the SELECT element's label path:
            // buildFormFields() uses SEARCH_V2 with label: 'attributes.displayName'
            name: match.fusionIdentity.displayName ?? '',
            attributes: attrs,
            scores: match.scores || [],
        }
    })

    return candidates
}

/**
 * Build form name from fusion account
 */
export const buildFormName = (fusionAccount: FusionAccount, fusionFormNamePattern: string): string => {
    const accountName = fusionAccount.name || fusionAccount.displayName || 'Unknown'
    return `${fusionFormNamePattern} - ${accountName} [${fusionAccount.sourceName}]`
}

/**
 * Calculate form expiration date
 */
export const calculateExpirationDate = (fusionFormExpirationDays: number): string => {
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + fusionFormExpirationDays)
    return expirationDate.toISOString()
}

/**
 * Get form owner from fusion source
 */
export const getFormOwner = (sources: SourceService): OwnerDto => {
    const owner = sources.fusionSourceOwner
    assert(owner, 'Fusion source owner not found')
    return owner
}
