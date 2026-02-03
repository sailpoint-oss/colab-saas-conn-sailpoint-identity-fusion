/**
 * FormService constants
 */

/**
 * Friendly algorithm names (aligned with connector-spec.json)
 */
export const ALGORITHM_LABELS: Record<string, string> = {
    'name-matcher': 'Enhanced Name Matcher',
    'jaro-winkler': 'Jaro-Winkler',
    lig3: 'LIG3',
    dice: 'Dice',
    'double-metaphone': 'Double Metaphone',
    custom: 'Custom Algorithm (from SaaS customizer)',
    average: 'Average Score',
}

export const MAX_CANDIDATES_FOR_FORM = 15
