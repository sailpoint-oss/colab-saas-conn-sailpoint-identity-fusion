type Attributes = { [key: string]: any }

type Account = {
    id: string
    name: string
    sourceName: string
    attributes: Attributes
    score?: Score
}

/**
 * Minimal account type for FusionDecision - only includes fields actually used.
 * Attributes are not needed since they're never accessed from FusionDecision.
 */
type FusionDecisionAccount = {
    id: string
    name: string
    sourceName: string
}

type User = {
    id: string
    email: string
    name: string
}

type Score = {
    attributes: { attribute: string; score: number; threshold: number }[]
    score: number
    threshold: number
}

export type FusionDecision = {
    submitter: User
    account: FusionDecisionAccount
    newIdentity: boolean
    identityId?: string
    comments: string
    /**
     * Indicates whether the reviewer has finished the decision.
     * Unfinished decisions are kept for reviewer context but skipped by fusion processing.
     */
    finished: boolean
    /**
     * Optional URL of the underlying form instance (standalone form).
     * Used to populate reviewer review links without refetching form instances.
     */
    formUrl?: string
}
export type FusionRequest = {
    title: string
    recipient: User
    account: Account
    candidates: Account[]
}
