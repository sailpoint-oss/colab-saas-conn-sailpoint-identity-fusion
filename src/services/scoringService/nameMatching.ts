/**
 * Native name matching implementation
 * Replaces the heavy 'name-match' library (which pulls in 48MB of NLP dependencies)
 * 
 * This implementation uses a combination of techniques optimized for name matching:
 * - Token-based comparison (handles different name orderings)
 * - Phonetic matching (handles spelling variations)
 * - Jaro-Winkler similarity (good for typos and variations)
 */

import { jaroWinklerSimilarity } from './stringComparison'
import { doubleMetaphone } from 'double-metaphone'

/**
 * Match two names and return a similarity score between 0 and 1
 * 
 * This algorithm:
 * 1. Normalizes names (lowercase, trim, remove extra spaces)
 * 2. Compares individual name tokens
 * 3. Uses Jaro-Winkler for string similarity
 * 4. Applies phonetic matching for common misspellings
 * 
 * @param name1 - First name to compare
 * @param name2 - Second name to compare
 * @returns Similarity score from 0 (no match) to 1 (perfect match)
 */
export function match(name1: string, name2: string): number {
    // Handle edge cases
    if (!name1 || !name2) return 0

    // Convert to string if not already (defensive)
    const str1 = String(name1)
    const str2 = String(name2)

    const normalized1 = normalizeName(str1)
    const normalized2 = normalizeName(str2)

    // Empty after normalization
    if (!normalized1 || !normalized2) return 0

    if (normalized1 === normalized2) return 1.0

    // Split names into tokens and filter empty tokens
    const tokens1 = normalized1.split(/\s+/).filter(t => t.length > 0)
    const tokens2 = normalized2.split(/\s+/).filter(t => t.length > 0)

    // No valid tokens to compare
    if (tokens1.length === 0 || tokens2.length === 0) return 0

    // Calculate token-based similarity
    const tokenScore = calculateTokenSimilarity(tokens1, tokens2)

    // Calculate overall string similarity
    const stringSimilarity = jaroWinklerSimilarity(normalized1, normalized2)

    // Calculate phonetic similarity
    const phoneticScore = calculatePhoneticSimilarity(tokens1, tokens2)

    // Weighted combination
    // Token matching is most important for names, followed by phonetic, then string similarity
    return tokenScore * 0.5 + phoneticScore * 0.3 + stringSimilarity * 0.2
}

/**
 * Check if two names match based on a threshold
 * @param name1 - First name to compare
 * @param name2 - Second name to compare
 * @param threshold - Minimum similarity score (0-1) to consider a match (default: 0.85)
 * @returns true if names match above threshold
 */
export function isMatch(name1: string, name2: string, threshold: number = 0.85): boolean {
    return match(name1, name2) >= threshold
}

/**
 * Normalize a name for comparison
 */
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9\s]/g, '') // Remove special chars except spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
}

/**
 * Calculate similarity based on matching tokens
 * Handles cases where names are in different orders (e.g., "John Smith" vs "Smith, John")
 */
function calculateTokenSimilarity(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) return 0

    let matchedTokens = 0
    const used = new Set<number>()

    // For each token in first name, find best match in second name
    for (const token1 of tokens1) {
        let bestScore = 0
        let bestIndex = -1

        for (let j = 0; j < tokens2.length; j++) {
            if (used.has(j)) continue

            const token2 = tokens2[j]

            // Exact match
            if (token1 === token2) {
                bestScore = 1.0
                bestIndex = j
                break
            }

            // Check if one is a prefix/abbreviation of the other (e.g., "J" matches "John")
            if (token1.length === 1 || token2.length === 1) {
                if (token1[0] === token2[0]) {
                    const score = 0.8
                    if (score > bestScore) {
                        bestScore = score
                        bestIndex = j
                    }
                }
            } else {
                // Use Jaro-Winkler for partial matches
                const score = jaroWinklerSimilarity(token1, token2)
                if (score > bestScore && score > 0.8) {
                    bestScore = score
                    bestIndex = j
                }
            }
        }

        if (bestIndex >= 0) {
            matchedTokens += bestScore
            used.add(bestIndex)
        }
    }

    // Average score across all tokens
    const maxTokens = Math.max(tokens1.length, tokens2.length)
    return matchedTokens / maxTokens
}

/**
 * Calculate phonetic similarity between name tokens
 * Uses Double Metaphone for phonetic encoding
 */
function calculatePhoneticSimilarity(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) return 0

    // Filter out single-character tokens (initials) first
    const validTokens1 = tokens1.filter(t => t.length > 1)
    const validTokens2 = tokens2.filter(t => t.length > 1)

    if (validTokens1.length === 0 || validTokens2.length === 0) return 0

    // Compare phonetic codes for each token pair
    let phoneticMatches = 0

    for (const token1 of validTokens1) {
        const codes1 = doubleMetaphone(token1)

        for (const token2 of validTokens2) {
            const codes2 = doubleMetaphone(token2)

            // Check if any phonetic codes match
            if (codes1[0] === codes2[0] ||
                codes1[0] === codes2[1] ||
                codes1[1] === codes2[0] ||
                codes1[1] === codes2[1]) {
                phoneticMatches++
                break // Found a match for this token1, move to next
            }
        }
    }

    // Normalize by the maximum number of tokens to compare
    const maxTokens = Math.max(validTokens1.length, validTokens2.length)
    return maxTokens > 0 ? phoneticMatches / maxTokens : 0
}
