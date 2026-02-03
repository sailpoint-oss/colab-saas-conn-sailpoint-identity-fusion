// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Candidate identity structure for form building
 */
export type Candidate = {
    id: string
    name: string
    attributes: Record<string, any>
    scores: any[]
}
