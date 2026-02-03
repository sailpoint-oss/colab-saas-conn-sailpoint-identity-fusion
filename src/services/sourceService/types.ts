import { OwnerDto } from 'sailpoint-api-client'
import { SourceConfig } from '../../model/config'

// ============================================================================
// Type Definitions
// ============================================================================

export type SourceInfo = {
    id: string
    name: string
    isManaged: boolean
    config?: SourceConfig // Only present for managed sources
    owner?: OwnerDto // Only present for fusion source
}
