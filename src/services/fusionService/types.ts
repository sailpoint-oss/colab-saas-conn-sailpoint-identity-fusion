// ============================================================================
// Type Definitions
// ============================================================================

export type FusionReportScore = {
    attribute: string
    algorithm?: string
    score: number
    fusionScore?: number
    isMatch: boolean
    comment?: string
}

export type FusionReportMatch = {
    identityName: string
    identityId?: string
    identityUrl?: string
    isMatch: boolean
    scores?: FusionReportScore[]
}

export type FusionReportAccount = {
    accountName: string
    accountSource: string
    accountId?: string
    accountEmail?: string
    accountAttributes?: Record<string, any>
    matches: FusionReportMatch[]
}

export type FusionReport = {
    accounts: FusionReportAccount[]
    totalAccounts?: number
    potentialDuplicates?: number
    reportDate?: Date | string
}
