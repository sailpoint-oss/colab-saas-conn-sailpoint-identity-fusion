/** Generic attribute bag for form data. */
type Attributes = { [key: string]: any }

/** Account representation used in fusion review forms, including optional match score. */
type Account = {
    id: string
    name: string
    sourceName: string
    attributes: Attributes
    /** Similarity scores if this account was matched against an identity */
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

/** User reference used in form submissions (reviewer or submitter). */
type User = {
    id: string
    email: string
    name: string
}

/** Aggregated similarity score with per-attribute breakdown, used in review forms. */
type Score = {
    /** Per-attribute score details */
    attributes: { attribute: string; score: number; threshold: number }[]
    /** Overall combined score */
    score: number
    /** Overall threshold that must be met */
    threshold: number
}

/**
 * A reviewer's decision on a fusion (deduplication) form.
 * Captures whether to create a new identity or merge into an existing one.
 */
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
/** Data payload for creating a new fusion review form instance. */
export type FusionRequest = {
    title: string
    recipient: User
    account: Account
    candidates: Account[]
}
