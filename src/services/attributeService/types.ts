// ============================================================================
// Type Definitions
// ============================================================================

export type AttributeMappingConfig = {
    attributeName: string
    sourceAttributes: string[] // Attributes to look for in source accounts
    attributeMerge: 'first' | 'list' | 'concatenate' | 'source'
    source?: string // Specific source to use (for 'source' merge strategy)
}
