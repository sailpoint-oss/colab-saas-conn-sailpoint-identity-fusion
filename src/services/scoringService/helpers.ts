import { doubleMetaphone } from 'double-metaphone'
import { MatchingConfig } from '../../model/config'
import { ScoreReport } from './types'
import { jaroWinkler, diceCoefficient } from './stringComparison'
import { match as nameMatch } from './nameMatching'

// ============================================================================
// Helper Functions
// ============================================================================

export const scoreDice = (accountAttribute: string, identityAttribute: string, matching: MatchingConfig): ScoreReport => {
    const similarity = diceCoefficient.similarity(accountAttribute, identityAttribute)
    const score = Math.round(similarity * 100)

    const threshold = matching.fusionScore ?? 0
    const isMatch = score >= threshold

    return {
        ...matching,
        score,
        isMatch,
    }
}

export const scoreDoubleMetaphone = (
    accountAttribute: string,
    identityAttribute: string,
    matching: MatchingConfig
): ScoreReport => {
    const accountCodes = doubleMetaphone(accountAttribute)
    const identityCodes = doubleMetaphone(identityAttribute)

    let score = 0
    let comment = ''

    if (accountCodes[0] === identityCodes[0] && accountCodes[0]) {
        score = 100
        comment = 'Primary codes match'
    } else if (accountCodes[1] === identityCodes[1] && accountCodes[1]) {
        score = 80
        comment = 'Secondary codes match'
    } else if (accountCodes[0] === identityCodes[1] || accountCodes[1] === identityCodes[0]) {
        score = 70
        comment = 'Cross-match between primary and secondary codes'
    } else {
        score = 0
        comment = 'No phonetic match'
    }

    const threshold = matching.fusionScore ?? 0
    const isMatch = score >= threshold

    return {
        ...matching,
        score,
        isMatch,
        comment,
    }
}

export const scoreJaroWinkler = (
    accountAttribute: string,
    identityAttribute: string,
    matching: MatchingConfig
): ScoreReport => {
    const similarity = jaroWinkler.similarity(accountAttribute, identityAttribute)
    const score = Math.round(similarity * 100)

    const threshold = matching.fusionScore ?? 0
    const isMatch = score >= threshold

    return {
        ...matching,
        score,
        isMatch,
    }
}

export const scoreNameMatcher = (
    accountAttribute: string,
    identityAttribute: string,
    matching: MatchingConfig
): ScoreReport => {
    const similarity = nameMatch(accountAttribute, identityAttribute)
    // nameMatch returns a normalized score (0-1), convert to 0-100
    const score = Math.round(similarity * 100)

    const threshold = matching.fusionScore ?? 0
    const isMatch = score >= threshold

    return {
        ...matching,
        score,
        isMatch,
    }
}

/**
 * LIG3 (Levenshtein with Intelligent Gapping - v3) Algorithm
 *
 * An advanced string similarity algorithm optimized for identity matching that combines:
 * - Levenshtein distance for edit operations
 * - Intelligent gap penalties for missing/extra characters
 * - Token-based preprocessing for multi-word fields
 * - Case-insensitive comparison with accent normalization
 * - Positional weighting (prefix matches score higher)
 *
 * This algorithm is particularly effective for:
 * - Names with middle initials or missing components
 * - Fields with extra whitespace or formatting differences
 * - Strings with minor typos or transpositions
 * - Multi-word attributes where order matters but gaps are common
 */
export const scoreLIG3 = (
    accountAttribute: string,
    identityAttribute: string,
    matching: MatchingConfig
): ScoreReport => {
    const normalize = (str: string): string => {
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
            .trim()
            .replace(/\s+/g, ' ') // Normalize whitespace
    }

    const s1 = normalize(accountAttribute)
    const s2 = normalize(identityAttribute)

    if (s1 === s2) {
        return {
            ...matching,
            score: 100,
            isMatch: true,
            comment: 'Exact match',
        }
    }

    if (s1.length === 0 || s2.length === 0) {
        return {
            ...matching,
            score: 0,
            isMatch: false,
            comment: 'Empty string comparison',
        }
    }

    const baseScore = calculateLIG3Similarity(s1, s2)
    const tokenBonus = calculateTokenBonus(s1, s2)
    const prefixBonus = calculatePrefixBonus(s1, s2)
    const rawScore = baseScore * 0.7 + tokenBonus * 0.2 + prefixBonus * 0.1
    const score = Math.round(Math.min(100, rawScore))

    const threshold = matching.fusionScore ?? 0
    const isMatch = score >= threshold

    let comment = ''
    if (score >= 95) {
        comment = 'Very high similarity'
    } else if (score >= 80) {
        comment = 'High similarity with minor differences'
    } else if (score >= 60) {
        comment = 'Moderate similarity detected'
    } else if (score >= 40) {
        comment = 'Low similarity, possible match'
    } else {
        comment = 'Low similarity'
    }

    return {
        ...matching,
        score,
        isMatch,
        comment,
    }
}

function calculateLIG3Similarity(s1: string, s2: string): number {
    const len1 = s1.length
    const len2 = s2.length
    const maxLen = Math.max(len1, len2)

    const matrix: number[][] = Array(len1 + 1)
        .fill(null)
        .map(() => Array(len2 + 1).fill(0))

    for (let i = 0; i <= len1; i++) {
        matrix[i][0] = i * 0.8
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j * 0.8
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
            const substitution = matrix[i - 1][j - 1] + cost
            const insertion = matrix[i][j - 1] + 0.9
            const deletion = matrix[i - 1][j] + 0.9
            matrix[i][j] = Math.min(substitution, insertion, deletion)

            if (
                i > 1 &&
                j > 1 &&
                s1[i - 1] === s2[j - 2] &&
                s1[i - 2] === s2[j - 1]
            ) {
                matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 0.5)
            }
        }
    }

    const distance = matrix[len1][len2]
    const similarity = ((maxLen - distance) / maxLen) * 100
    return Math.max(0, similarity)
}

function calculateTokenBonus(s1: string, s2: string): number {
    const tokens1 = s1.split(' ').filter((t) => t.length > 0)
    const tokens2 = s2.split(' ').filter((t) => t.length > 0)

    if (tokens1.length <= 1 && tokens2.length <= 1) {
        return 0
    }

    let matchedTokens = 0
    const used = new Set<number>()
    for (const token1 of tokens1) {
        for (let j = 0; j < tokens2.length; j++) {
            if (!used.has(j)) {
                const token2 = tokens2[j]
                if (token1 === token2 || (token1.length > 2 && token2.startsWith(token1.substring(0, 2)))) {
                    matchedTokens++
                    used.add(j)
                    break
                }
            }
        }
    }
    const maxTokens = Math.max(tokens1.length, tokens2.length)
    return (matchedTokens / maxTokens) * 100
}

function calculatePrefixBonus(s1: string, s2: string): number {
    let commonPrefix = 0
    const minLen = Math.min(s1.length, s2.length)
    for (let i = 0; i < minLen; i++) {
        if (s1[i] === s2[i]) {
            commonPrefix++
        } else {
            break
        }
    }
    const prefixWeight = Math.min(commonPrefix, 5)
    return (prefixWeight / 5) * 100
}
