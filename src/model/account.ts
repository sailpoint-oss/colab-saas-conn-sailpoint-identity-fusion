import { Account, IdentityDocument } from 'sailpoint-api-client'
import { getDateFromISOString } from '../utils/date'
import { toSetFromAttribute as attributeToSet } from '../utils/attributes'
import { FusionDecision } from './form'
import { FusionConfig, SourceConfig } from './config'
import { Attributes, ConnectorError, ConnectorErrorType, SimpleKeyType } from '@sailpoint/connector-sdk'
import { FusionMatch } from '../services/scoringService'
import { attrConcat, attrSplit } from '../services/attributeService/helpers'

/**
 * Container for all attribute layers associated with a fusion account.
 * Tracks current and previous attribute values, identity attributes,
 * and per-source account attribute arrays for merge operations.
 */
type AttributeBag = {
    /** Attributes from the previous aggregation run (used for change detection) */
    previous: Attributes
    /** Current computed attributes (result of mapping + generation) */
    current: Attributes
    /** Attributes from the correlated ISC identity */
    identity: Attributes
    /** Flat list of attribute objects from all managed source accounts */
    accounts: Attributes[]
    /** Attribute objects grouped by source name (supports multi-account-per-source scenarios) */
    sources: Map<string, Attributes[]>
}

/**
 * Core domain model representing a fusion account in the Identity Fusion connector.
 *
 * A FusionAccount aggregates data from multiple sources (identity, managed accounts,
 * review decisions) into a single unified representation. It is created through factory
 * methods and enriched through a layered approach:
 *
 * 1. Factory method creates the base account (fromFusionAccount, fromIdentity, etc.)
 * 2. Identity layer adds correlated identity data
 * 3. Managed account layer processes source accounts from the work queue
 * 4. Fusion decision layer applies reviewer decisions
 *
 * The class uses a private constructor with static factory methods to enforce
 * proper initialization and ensure the static config is set before use.
 */
// TODO: Limit the size of the history array
export class FusionAccount {
    private static config?: FusionConfig

    /**
     * Sets the shared configuration for all FusionAccount instances.
     * Must be called once before any factory method is used.
     *
     * @param config - The fusion configuration
     */
    public static configure(config: FusionConfig): void {
        FusionAccount.config = config
    }
    // ============================================================================
    // Private Fields - All state is encapsulated
    // ============================================================================

    // Core identity fields
    private _type: 'fusion' | 'identity' | 'managed' | 'decision' = 'fusion'
    private _identityId?: string
    private _nativeIdentity?: string
    private _managedAccountId?: string
    private _key?: SimpleKeyType

    // Basic account information
    private _email?: string
    private _name?: string
    private _displayName?: string
    private _sourceName = ''
    private _originSource?: string

    // State flags
    private _uncorrelated = false
    private _disabled = false
    private _needsRefresh = false
    private _needsReset = false
    private _isMatch = false

    // Collections
    private _accountIds: Set<string> = new Set()
    private _missingAccountIds: Set<string> = new Set()
    private _statuses: Set<string> = new Set()
    private _actions: Set<string> = new Set()
    private _reviews: Set<string> = new Set()
    private _sources: Set<string> = new Set()
    private _previousAccountIds: Set<string> = new Set()
    private _correlationPromises: Array<Promise<unknown>> = []
    private _pendingReviewUrls: Set<string> = new Set()
    private _reviewPromises: Array<Promise<string | undefined>> = []
    private _fusionMatches: FusionMatch[] = []
    private _history: string[] = []

    // Attribute management
    // Note: previous is initialized lazily only when needed to save memory for new accounts
    private _sourceAttributeMapCache?: Map<string, { [key: string]: any }>
    private _attributeBag: AttributeBag = {
        previous: {},
        current: {},
        identity: {},
        accounts: [],
        sources: new Map(),
    }

    // Timestamps
    private _modified: Date = new Date()

    // Read-only configuration (set in constructor)
    private readonly sourceConfigs: SourceConfig[]
    private readonly fusionAccountRefreshThresholdInSeconds: number
    private readonly maxHistoryMessages: number

    // ============================================================================
    // Construction
    // ============================================================================

    private constructor() {
        const config = FusionAccount.config
        if (!config) {
            throw new ConnectorError(
                'FusionAccount is not configured. Call FusionAccount.configure(config) before creating accounts.',
                ConnectorErrorType.Generic
            )
        }
        this.sourceConfigs = config.sources
        this.fusionAccountRefreshThresholdInSeconds = config.fusionAccountRefreshThresholdInSeconds
        this.maxHistoryMessages = config.maxHistoryMessages
    }

    // ============================================================================
    // Factory Methods - Must be first to ensure proper initialization order
    // ============================================================================

    /** Attribute keys that can be extracted into collection sets. 'accounts' -> _missingAccountIds. */
    private static readonly COLLECTION_KEYS = ['accounts', 'reviews', 'statuses', 'actions'] as const

    /**
     * Common initialization logic for factory methods.
     * Handles default values internally to avoid repetitive null coalescing in callers.
     * Use explicit undefined checks for booleans so `disabled: false` / `needsRefresh: false` apply.
     * When `attributes` and `collectionKeys` are provided, extracts sets from attributes into the corresponding fields.
     */
    private initializeBasicProperties(config: {
        type?: 'fusion' | 'identity' | 'managed' | 'decision'
        nativeIdentity?: string
        name?: string | null
        sourceName?: string | null
        displayName?: string | null
        disabled?: boolean
        needsRefresh?: boolean
        sources?: string[] | Set<string>
        attributes?: Attributes | null
        /** Extract these attribute keys into collection sets; 'accounts' -> _missingAccountIds, others -> _* */
        collectionKeys?: (typeof FusionAccount.COLLECTION_KEYS)[number][]
        identityId?: string | null
        managedAccountId?: string | null
        modified?: Date
    }): void {
        if (config.type) this._type = config.type
        if (config.name) this._name = config.name
        if (config.nativeIdentity) this._nativeIdentity = config.nativeIdentity
        if (config.sourceName) this._sourceName = config.sourceName
        if (config.displayName) this._displayName = config.displayName
        if (config.disabled !== undefined) this._disabled = config.disabled
        if (config.needsRefresh !== undefined) this._needsRefresh = config.needsRefresh
        if (config.identityId != null) this._identityId = config.identityId
        if (config.managedAccountId != null) this._managedAccountId = config.managedAccountId
        if (config.modified) this._modified = config.modified
        if (config.sources) {
            this._sources = Array.isArray(config.sources) ? new Set(config.sources) : config.sources
        }
        if (config.attributes) {
            this._attributeBag.current = { ...config.attributes }
            // Only store previous for existing fusion accounts to save memory
            if (config.type === 'fusion' && config.nativeIdentity) {
                this._attributeBag.previous = { ...config.attributes }
            }
        }
        if (config.attributes && config.collectionKeys?.length) {
            const attrs = config.attributes
            for (const key of config.collectionKeys) {
                const set = attributeToSet(attrs, key)
                switch (key) {
                    case 'accounts':
                        this._missingAccountIds = set
                        break
                    case 'reviews':
                        this._reviews = set
                        break
                    case 'statuses':
                        this._statuses = set
                        break
                    case 'actions':
                        this._actions = set
                        break
                }
            }
        }
    }

    /**
     * Creates a FusionAccount from an existing fusion source account (ISC Account object).
     * Used during aggregation to reconstruct fusion accounts from the previous run.
     * Restores all persisted state including attributes, collections, history, and origin source.
     *
     * @param account - The ISC Account object from the fusion source
     * @returns A fully initialized FusionAccount with restored state
     */
    public static fromFusionAccount(account: Account): FusionAccount {
        const fusionAccount = new FusionAccount()
        const sourceSet = new Set<string>()
        const statuses = attributeToSet(account.attributes, 'statuses')
        if (statuses.has('baseline')) sourceSet.add('Identities')

        fusionAccount.initializeBasicProperties({
            type: 'fusion',
            nativeIdentity: account.nativeIdentity as string,
            name: account.name,
            sourceName: account.sourceName,
            displayName: account.name,
            disabled: account.disabled,
            sources: sourceSet,
            attributes: account.attributes ?? undefined,
            collectionKeys: ['accounts', 'reviews', 'statuses', 'actions'],
            identityId: account.identityId ?? undefined,
            modified: getDateFromISOString(account.modified),
        })
        // Restore persisted originSource; fallback for legacy accounts without it
        fusionAccount._originSource = account.attributes?.originSource
            ?? (statuses.has('baseline') ? 'Identities' : undefined)
        // Capture the previously stored account IDs so we can later rebuild
        // the current and missing account sets based on which managed accounts
        // still exist in configured sources.
        fusionAccount._previousAccountIds = attributeToSet(account.attributes, 'accounts')
        // Load history from platform so accountUpdate/accountRead don't send back empty history.
        const historyAttr = account.attributes?.history
        if (Array.isArray(historyAttr) && historyAttr.length > 0) {
            fusionAccount.importHistory(historyAttr)
        }
        return fusionAccount
    }

    /**
     * Creates a FusionAccount from an ISC identity (authoritative mode).
     * The identity becomes the baseline for the fusion account, with its
     * attributes and correlated accounts forming the initial state.
     *
     * @param identity - The ISC identity document
     * @returns A new FusionAccount with baseline status and identity attributes
     */
    public static fromIdentity(identity: IdentityDocument): FusionAccount {
        const fusionAccount = new FusionAccount()
        fusionAccount.initializeBasicProperties({
            type: 'identity',
            nativeIdentity: identity.id,
            name: identity.attributes?.displayName ?? identity.name,
            sourceName: 'Identities',
            disabled: identity.disabled,
            needsRefresh: true,
            sources: ['Identities'],
            attributes: identity.attributes ?? undefined,
            identityId: identity.id ?? undefined,
        })
        fusionAccount._originSource = 'Identities'
        fusionAccount.setBaseline()
        return fusionAccount
    }

    /**
     * Creates a FusionAccount from an uncorrelated managed source account.
     * Used when a source account doesn't match any existing fusion identity
     * and needs to enter the deduplication workflow.
     *
     * @param account - The uncorrelated ISC Account from a managed source
     * @returns A new FusionAccount with uncorrelated status
     */
    public static fromManagedAccount(account: Account): FusionAccount {
        const fusionAccount = new FusionAccount()
        const sourcesAttr = account.attributes?.sources
        const sourceSet = sourcesAttr ? new Set(attrSplit(String(sourcesAttr))) : new Set<string>()

        fusionAccount.initializeBasicProperties({
            type: 'managed',
            nativeIdentity: account.id,
            name: account.name,
            sourceName: account.sourceName,
            disabled: account.disabled,
            needsRefresh: true,
            sources: sourceSet,
            attributes: account.attributes ?? undefined,
            collectionKeys: ['accounts', 'statuses', 'actions', 'reviews'],
            managedAccountId: account.id ?? undefined,
        })
        fusionAccount._originSource = account.sourceName ?? undefined
        fusionAccount.setUncorrelated()
        fusionAccount.setUncorrelatedAccount(account.id!)
        fusionAccount.setManagedAccount(account)
        fusionAccount.setNeedsReset(true)
        return fusionAccount
    }

    /**
     * Creates a FusionAccount from a reviewer's fusion decision.
     * Used when processing form responses where a reviewer has decided
     * whether an account should create a new identity or merge with an existing one.
     *
     * @param decision - The fusion decision from the review form
     * @returns A new FusionAccount seeded from the decision's account data
     */
    public static fromFusionDecision(decision: FusionDecision): FusionAccount {
        const fusionAccount = new FusionAccount()
        const { account } = decision
        fusionAccount.initializeBasicProperties({
            type: 'decision',
            nativeIdentity: account.id,
            name: account.name,
            sourceName: account.sourceName,
            needsRefresh: true,
            managedAccountId: account.id ?? undefined,
        })
        fusionAccount._originSource = account.sourceName ?? undefined
        fusionAccount.setUncorrelated()
        fusionAccount.setUncorrelatedAccount(account.id)
        return fusionAccount
    }

    // ============================================================================
    // Accessors - Core Properties
    // ============================================================================

    /** The origin type of this fusion account (fusion, identity, managed, or decision). */
    public get type(): 'fusion' | 'identity' | 'managed' | 'decision' {
        return this._type
    }

    /** The correlated ISC identity ID, if known. */
    public get identityId(): string | undefined {
        return this._identityId
    }

    /** The native identity (unique key) for this fusion account. Asserts non-null. */
    public get nativeIdentity(): string {
        return this._nativeIdentity!
    }

    /**
     * Safe nativeIdentity accessor (may be undefined until key is set)
     */
    public get nativeIdentityOrUndefined(): string | undefined {
        return this._nativeIdentity
    }

    /**
     * Stable ISC account id for this source account (may be undefined for non-account FusionAccount types)
     */
    public get managedAccountId(): string | undefined {
        return this._managedAccountId
    }

    /** The SDK simple key used for account output. Asserts non-null. */
    public get key(): SimpleKeyType | undefined {
        return this._key
    }

    // ============================================================================
    // Accessors - Account Information
    // ============================================================================

    /** Email address from the correlated identity. */
    public get email(): string | undefined {
        return this._email
    }

    /** Account name (typically the identity display name). */
    public get name(): string | undefined {
        return this._name
    }

    /** Display name for UI rendering. */
    public get displayName(): string | undefined {
        return this._displayName
    }

    /** The fusion source name this account belongs to. */
    public get sourceName(): string {
        return this._sourceName
    }

    /** The original source that created this fusion account (e.g. "Identities" or a managed source name). */
    public get originSource(): string | undefined {
        return this._originSource
    }

    // ============================================================================
    // Accessors - State Flags
    // ============================================================================

    /** Whether this account has uncorrelated (unmatched) source accounts. */
    public get uncorrelated(): boolean {
        return this._uncorrelated
    }

    /** Whether this is a managed account. */
    public get isManaged(): boolean {
        return this._type === 'managed'
    }

    /** Whether this fusion account is associated to an ISC identity. */
    public get isIdentity(): boolean {
        return this._identityId !== undefined
    }

    /** Whether this fusion account is disabled. */
    public get disabled(): boolean {
        return this._disabled
    }

    /** Whether this account's attributes need to be refreshed (source data changed). */
    public get needsRefresh(): boolean {
        return this._needsRefresh
    }

    /** Whether this account's generated attributes need a full reset. */
    public get needsReset(): boolean {
        return this._needsReset
    }

    /** Whether this account matched any existing fusion identity during scoring. */
    public get isMatch(): boolean {
        return this._isMatch
    }

    /**
     * Converts the fusion account to a standard SDK Account object for output.
     */
    public toISCAccount(): any {
        return {
            identity: this.nativeIdentity,
            uuid: this.nativeIdentity,
            attributes: this.attributes,
            disabled: this.disabled,
            key: this.key
        }
    }

    // ============================================================================
    // Accessors - Collections (return arrays for immutability)
    // ============================================================================

    /** IDs of correlated managed source accounts (immutable copy). */
    public get accountIds(): string[] {
        return Array.from(this._accountIds)
    }

    /** IDs of source accounts that are known but not yet correlated (immutable copy). */
    public get missingAccountIds(): string[] {
        return Array.from(this._missingAccountIds)
    }

    /** Current status entitlements (e.g. "uncorrelated", "baseline", "orphan") (immutable copy). */
    public get statuses(): string[] {
        return Array.from(this._statuses)
    }

    /** Current action entitlements (e.g. "report", "fusion", "correlated") (immutable copy). */
    public get actions(): string[] {
        return Array.from(this._actions)
    }

    /** Review URLs for active fusion review forms (immutable copy). */
    public get reviews(): string[] {
        return Array.from(this._reviews)
    }

    /** Source names contributing to this fusion account (immutable copy). */
    public get sources(): string[] {
        return Array.from(this._sources)
    }

    /** Fusion match results from deduplication scoring (immutable copy). */
    public get fusionMatches(): FusionMatch[] {
        return [...this._fusionMatches]
    }

    /** Dated audit trail of operations performed on this account (immutable copy). */
    public get history(): string[] {
        return [...this._history]
    }

    // ============================================================================
    // Accessors - Attributes
    // ============================================================================

    public get attributes(): Attributes {
        return this._attributeBag.current
    }

    public get attributeBag(): AttributeBag {
        return this._attributeBag
    }

    public get currentAttributes(): Attributes {
        return this._attributeBag.current
    }

    public get previousAttributes(): Attributes {
        return this._attributeBag.previous
    }

    /**
     * Returns a Map of source name -> first attribute object for each source.
     * Result is cached and invalidated when sources change (via setManagedAccount).
     */
    public get sourceAttributeMap(): Map<string, { [key: string]: any }> {
        if (!this._sourceAttributeMapCache) {
            const map = new Map<string, { [key: string]: any }>()
            for (const [source, attrsArray] of this._attributeBag.sources.entries()) {
                if (attrsArray.length > 0) {
                    map.set(source, attrsArray[0])
                }
            }
            this._sourceAttributeMapCache = map
        }
        return this._sourceAttributeMapCache
    }

    // ============================================================================
    // Accessors - Internal State (for service layer use)
    // ============================================================================

    public get modified(): Date {
        return this._modified
    }

    public get correlationPromises(): Array<Promise<unknown>> {
        return [...this._correlationPromises]
    }

    public get pendingReviewUrls(): string[] {
        return Array.from(this._pendingReviewUrls)
    }

    // ============================================================================
    // Setters - Core Properties
    // ============================================================================

    /** Sets the SDK key and updates the native identity to match. */
    public setKey(key: SimpleKeyType): void {
        this._key = key
        this._nativeIdentity = key.simple.id
    }

    // ============================================================================
    // Setters - Account Information
    // ============================================================================

    public setEmail(email: string | undefined): void {
        this._email = email
    }

    public setName(name: string | undefined): void {
        this._name = name
    }

    public setDisplayName(displayName: string | undefined): void {
        this._displayName = displayName
    }

    public setSourceName(sourceName: string): void {
        this._sourceName = sourceName
    }

    // ============================================================================
    // Setters - State Flags
    // ============================================================================

    /** Enables this fusion account (clears the disabled flag). */
    public enable(): void {
        this._disabled = false
    }

    /** Disables this fusion account. */
    public disable(): void {
        this._disabled = true
    }

    /** Replaces the current attribute bag with freshly mapped attributes. */
    public setMappedAttributes(attributes: Attributes): void {
        this._attributeBag.current = attributes
    }

    // ============================================================================
    // Mutation Methods - Account IDs
    // ============================================================================

    /** Adds a managed account ID to the correlated set, with optional history message. */
    public addAccountId(id: string, message?: string): void {
        this.addToSet(this._accountIds, id, message)
    }

    /** Removes a managed account ID from the correlated set, with optional history message. */
    public removeAccountId(id: string, message?: string): void {
        this.removeFromSet(this._accountIds, id, message)
    }

    /** Adds an account ID to the missing (uncorrelated) set. */
    public addMissingAccountId(id: string, message?: string): void {
        this.addToSet(this._missingAccountIds, id, message)
    }

    /** Removes an account ID from the missing set (i.e. it has been correlated). */
    public removeMissingAccountId(id: string, message?: string): void {
        this.removeFromSet(this._missingAccountIds, id, message)
    }

    // ============================================================================
    // Mutation Methods - Statuses
    // ============================================================================

    /** Adds a status entitlement to this fusion account. */
    public addStatus(status: string, message?: string): void {
        this.addToSet(this._statuses, status, message)
    }

    /** Removes a status entitlement from this fusion account. */
    public removeStatus(status: string, message?: string): void {
        this.removeFromSet(this._statuses, status, message)
    }

    /** Checks whether this fusion account has a given status. */
    public hasStatus(status: string): boolean {
        return this._statuses.has(status)
    }

    // ============================================================================
    // Mutation Methods - Actions
    // ============================================================================

    /** Adds an action entitlement to this fusion account. */
    public addAction(action: string, message?: string): void {
        this.addToSet(this._actions, action, message)
    }

    /** Removes an action entitlement from this fusion account. */
    public removeAction(action: string, message?: string): void {
        this.removeFromSet(this._actions, action, message)
    }

    /** Marks this fusion account's identity as a reviewer for the given source. */
    public setSourceReviewer(sourceId: string): void {
        this._actions.add(`reviewer:${sourceId}`)
        this.addStatus('reviewer')
    }

    /** Returns the source IDs this account's identity is configured to review. */
    public listReviewerSources(): string[] {
        const prefix = 'reviewer:'
        const sourceIds: string[] = []
        for (const action of this._actions) {
            if (action.startsWith(prefix)) {
                // Extract sourceId after 'reviewer:' without split() overhead
                sourceIds.push(action.slice(prefix.length))
            }
        }
        return sourceIds
    }

    // ============================================================================
    // Mutation Methods - Reviews
    // ============================================================================

    /** Adds a review URL to this fusion account. */
    public addReview(review: string, message?: string): void {
        this.addToSet(this._reviews, review, message)
    }

    /** Removes a review URL from this fusion account. */
    public removeReview(review: string, message?: string): void {
        this.removeFromSet(this._reviews, review, message)
    }

    /** Adds a fusion review URL and sets the "activeReviews" status. */
    public addFusionReview(reviewUrl: string): void {
        this._reviews.add(reviewUrl)
        this._statuses.add('activeReviews')
    }

    /** Removes a fusion review URL. Clears "activeReviews" status if no reviews remain. */
    public removeFusionReview(reviewUrl: string): void {
        this._reviews.delete(reviewUrl)
        if (this._reviews.size === 0) {
            this._statuses.delete('activeReviews')
        }
    }

    /**
     * Clear all fusion review URLs so they can be repopulated from the current run.
     * Used for reviewers so their reviews attribute reflects only current form instance URLs.
     */
    public clearFusionReviews(): void {
        this._reviews.clear()
        this._statuses.delete('activeReviews')
    }

    /**
     * Sync collection state (reviews, accounts, statuses, actions, etc.) into the attribute bag
     * so that getFusionAttributeSubset and downstream output include current values.
     */
    public syncCollectionAttributesToBag(): void {
        this._attributeBag.current['reviews'] = Array.from(this._reviews)
        this._attributeBag.current['accounts'] = Array.from(this._accountIds)
        this._attributeBag.current['statuses'] = Array.from(this._statuses)
        this._attributeBag.current['actions'] = Array.from(this._actions)
        this._attributeBag.current['missing-accounts'] = Array.from(this._missingAccountIds)
        this._attributeBag.current['sources'] = attrConcat(Array.from(this._sources))
        this._attributeBag.current['history'] = this._history
        if (this._originSource) {
            this._attributeBag.current['originSource'] = this._originSource
        }
    }

    /** Queues a review URL for deferred addition (resolved during getISCAccount). */
    public addPendingReviewUrl(reviewUrl: string): void {
        if (reviewUrl) {
            this._pendingReviewUrls.add(reviewUrl)
        }
    }

    /** Adds a promise that will resolve to a review URL once the form is created. */
    public addReviewPromise(promise: Promise<string | undefined>): void {
        if (promise) {
            this._reviewPromises.push(promise)
        }
    }

    /** Converts all pending review URLs into active fusion reviews. */
    public resolvePendingReviewUrls(): void {
        if (this._pendingReviewUrls.size === 0) return

        for (const url of this._pendingReviewUrls) {
            this.addFusionReview(url)
        }
        this._pendingReviewUrls.clear()
    }

    /**
     * Resolve all pending operations (reviews and correlations)
     * @param awaitCorrelations - When false, correlation promises are left running
     *   in the background so the caller can proceed without waiting for the queue to drain.
     */
    public async resolvePendingOperations(awaitCorrelations = true): Promise<void> {
        await this.resolveReviewPromises()
        if (awaitCorrelations) {
            await this.resolveCorrelationPromises()
        }
        this.resolvePendingReviewUrls()
    }

    /**
     * Resolve all pending review promises
     */
    private async resolveReviewPromises(): Promise<void> {
        if (this._reviewPromises.length === 0) return

        const reviewResults = await Promise.allSettled(this._reviewPromises)
        this._reviewPromises = []

        for (const result of reviewResults) {
            if (result.status === 'fulfilled' && result.value) {
                this.addPendingReviewUrl(result.value)
            }
        }
    }

    /**
     * Resolve all pending correlation promises
     */
    private async resolveCorrelationPromises(): Promise<void> {
        if (this._correlationPromises.length === 0) return

        // Wait for all correlation promises to complete
        // setCorrelatedAccount is called in the promise handlers, which updates state
        await Promise.allSettled(this._correlationPromises)
        this._correlationPromises = []
    }

    // ============================================================================
    // Mutation Methods - Sources
    // ============================================================================

    /** Adds a source name to this fusion account's source set. */
    public addSource(source: string, message?: string): void {
        this.addToSet(this._sources, source, message)
    }

    /** Removes a source name from this fusion account's source set. */
    public removeSource(source: string, message?: string): void {
        this.removeFromSet(this._sources, source, message)
    }

    // ============================================================================
    // Mutation Methods - Fusion Matches
    // ============================================================================

    /** Records a deduplication match result and sets the isMatch flag. */
    public addFusionMatch(fusionMatch: FusionMatch): void {
        this._fusionMatches.push(fusionMatch)
        this._isMatch = true
    }

    /**
     * Clears fusionIdentity references from matches to reduce memory retention.
     * identityId and identityName are retained for report generation.
     */
    public clearFusionIdentityReferences(): void {
        for (const match of this._fusionMatches) {
            ; (match as { fusionIdentity?: FusionAccount }).fusionIdentity = undefined
        }
    }

    // ============================================================================
    // Mutation Methods - History
    // ============================================================================

    /**
     * Add a dated history entry
     */
    private addHistory(message: string): void {
        const now = new Date().toISOString().split('T')[0]
        const datedMessage = `[${now}] ${message}`
        this._history.push(datedMessage)

        // Enforce maximum history size by keeping only the most recent entries
        if (this._history.length > this.maxHistoryMessages) {
            this._history = this._history.slice(-this.maxHistoryMessages)
        }
    }

    /**
     * Import history from existing account, respecting max history limit
     */
    public importHistory(history: string[]): void {
        this._history = history.slice(-this.maxHistoryMessages)
    }

    /**
     * Helper method to add an item to a Set and optionally log history
     */
    private addToSet<T>(set: Set<T>, item: T, message?: string): void {
        set.add(item)
        if (message) {
            this.addHistory(message)
        }
    }

    /**
     * Helper method to remove an item from a Set and optionally log history
     * @returns true if the item was removed, false otherwise
     */
    private removeFromSet<T>(set: Set<T>, item: T, message?: string): boolean {
        const removed = set.delete(item)
        if (removed && message) {
            this.addHistory(message)
        }
        return removed
    }

    // ============================================================================
    // Layer Methods - Add data layers (must be called in order)
    // ============================================================================

    /**
     * Adds the identity layer by populating identity-sourced fields (email, name, display name)
     * and marking correlated accounts found in the identity's account list.
     *
     * @param identity - The correlated ISC identity document
     */
    public addIdentityLayer(identity: IdentityDocument): void {
        this._email = identity.attributes?.email as string
        this._name = identity.name ?? ''
        this._displayName = identity.attributes?.displayName as string
        this._attributeBag.identity = identity.attributes ?? {}
        this._identityId = identity.id ?? undefined

        const sourceNames = this.sourceConfigs.map((sc) => sc.name)
        identity.accounts?.forEach((account) => {
            if (sourceNames.includes(account.source?.name ?? '')) {
                this.setCorrelatedAccount(account.id!)
            }
        })
    }

    /**
     * Add managed account layer to this fusion account.
     *
     * Claims accounts from the shared work queue that belong to this fusion account.
     *
     * Two-phase matching:
     * 1. **Identity match** (indexed): Uses `accountsByIdentityId` to find correlated
     *    accounts in O(1) instead of scanning the full map.
     * 2. **Previous-run match** (scan): Iterates remaining accounts to find those
     *    previously associated with this fusion account (`_previousAccountIds`).
     *
     * Claimed accounts are deleted from both maps so subsequent processing
     * phases (fusion → identity → managed) only see unprocessed accounts.
     *
     * @param accountsById - Shared work queue of managed accounts
     * @param accountsByIdentityId - Secondary index: identityId → Set of account IDs
     */
    public addManagedAccountLayer(
        accountsById: Map<string, Account>,
        accountsByIdentityId: Map<string, Set<string>>
    ): void {
        // Phase 1: Identity-based matching via index (O(1) lookup)
        if (this._identityId !== undefined) {
            const matchedIds = accountsByIdentityId.get(this._identityId)
            if (matchedIds) {
                for (const id of matchedIds) {
                    const account = accountsById.get(id)
                    if (account) {
                        this.setCorrelatedAccount(id)
                        this.setManagedAccount(account)
                        accountsById.delete(id)
                    }
                }
                // Clean up the index entry since all accounts for this identity have been claimed
                accountsByIdentityId.delete(this._identityId)
            }
        }

        // Phase 2: Previous-run matching (scan remaining accounts)
        if (this._previousAccountIds.size > 0 || this._missingAccountIds.size > 0) {
            for (const [id, account] of accountsById) {
                if (this._previousAccountIds.has(id) || this._missingAccountIds.has(id)) {
                    this.setUncorrelatedAccount(id)
                    this.setManagedAccount(account)
                    accountsById.delete(id)
                    // Also clean up the identity index
                    if (account.identityId) {
                        const idSet = accountsByIdentityId.get(account.identityId)
                        if (idSet) {
                            idSet.delete(id)
                            if (idSet.size === 0) accountsByIdentityId.delete(account.identityId)
                        }
                    }
                }
            }
        }

        // Update orphan status based on final account state
        // An account is orphaned if it has no managed accounts and is not a baseline identity
        if (this._accountIds.size === 0 && !this._statuses.has('baseline')) {
            this._statuses.add('orphan')
            this._needsRefresh = false
        } else {
            this._statuses.delete('orphan')
        }
    }

    /**
     * Applies a reviewer's fusion decision to this account, setting it as either
     * "manual" (new identity) or "authorized" (merge into existing).
     *
     * @param decision - The fusion decision from the review form
     */
    public addFusionDecisionLayer(decision: FusionDecision): void {
        this.setUncorrelatedAccount(decision.account.id!)

        if (decision.newIdentity) {
            this.setManual(decision)
        } else {
            this.setAuthorized(decision)
        }
    }

    // ============================================================================
    // Internal Layer Helpers
    // ============================================================================

    /**
     * Processes a single managed source account into this fusion account.
     * Triggers refresh if the account is new or recently modified and adds
     * its attributes to the source attribute layers.
     *
     * ID-set membership (_accountIds / _missingAccountIds) is managed by the
     * caller (addManagedAccountLayer); this method only handles refresh logic
     * and source-attribute bookkeeping.
     *
     * @param account - The managed account to absorb
     */
    private setManagedAccount(account: Account): void {
        const accountId = account.id!
        const isNewAccount = !this._previousAccountIds.has(accountId)

        if (isNewAccount) {
            this.setNeedsRefresh(true)
        }

        if (!this._needsRefresh) {
            const modified = getDateFromISOString(account.modified)
            const thresholdMs = this.fusionAccountRefreshThresholdInSeconds * 1000
            if (modified.getTime() > this._modified.getTime() + thresholdMs) {
                this._needsRefresh = true
            }
        }

        if (account.sourceName) {
            const existingSourceAccounts = this._attributeBag.sources.get(account.sourceName) || []
            existingSourceAccounts.push(account.attributes ?? {})
            this._sources.delete('Identities')
            this._sources.add(account.sourceName)
            this._attributeBag.sources.set(account.sourceName, existingSourceAccounts)
            this._attributeBag.accounts.push(account.attributes ?? {})
            // Invalidate cached sourceAttributeMap since sources changed
            this._sourceAttributeMapCache = undefined
            this._type = 'managed'
        }
    }
    /** Sets whether this account's attributes need refreshing. */
    public setNeedsRefresh(refresh: boolean) {
        this._needsRefresh = refresh
    }

    /** Sets whether this account's generated attributes need a full reset. */
    public setNeedsReset(reset: boolean) {
        this._needsReset = reset
    }

    // ============================================================================
    // Status Setting Methods (private - called by factory methods and layer methods)
    // ============================================================================

    /**
     * Shared logic for setting uncorrelated status
     */
    private setUncorrelatedStatus(): void {
        this._uncorrelated = true
        this._statuses.add('uncorrelated')
        this._actions.delete('correlated')
    }

    /** Sets the account as uncorrelated (no identity match). */
    private setUncorrelated(): void {
        this.setUncorrelatedStatus()
    }

    /** Sets a specific account ID as uncorrelated and adds it to both account ID sets. */
    private setUncorrelatedAccount(accountId?: string): void {
        if (!accountId) return

        this.addAccountId(accountId)
        this.addMissingAccountId(accountId)
        this.setUncorrelatedStatus()
    }

    /** Marks this account with "baseline" status (created from an identity in authoritative mode). */
    private setBaseline(): void {
        this._statuses.add('baseline')
        this.addHistory(`Set ${this._name} [${this._sourceName}] as baseline`)
    }

    /** Marks this account as "unmatched" (no deduplication match found, pending review). */
    public setUnmatched(): void {
        this._statuses.add('unmatched')
        this.addHistory(`Set ${this._name} [${this._sourceName}] as unmatched`)
    }

    /**
     * Helper to create history message for decision actions
     */
    private createDecisionHistoryMessage(decision: FusionDecision, action: string): string {
        const submitterName = decision.submitter.name || decision.submitter.email
        const accountInfo = `${decision.account.name} [${decision.account.sourceName}]`

        if (action === 'manual') {
            return `Set ${accountInfo} as new account by ${submitterName}`
        } else {
            return `Set ${accountInfo} as authorized by ${submitterName}`
        }
    }

    /** Marks this account as "manual" (reviewer decided to create a new identity). */
    private setManual(decision: FusionDecision): void {
        this._statuses.add('manual')
        const message = this.createDecisionHistoryMessage(decision, 'manual')
        this.addHistory(message)
    }

    /** Marks this account as "authorized" (reviewer approved merging into an existing identity). */
    private setAuthorized(decision: FusionDecision): void {
        this._statuses.add('authorized')
        const message = this.createDecisionHistoryMessage(decision, 'authorized')
        this.addHistory(message)
    }

    // ============================================================================
    // Correlation Methods
    // ============================================================================

    /**
     * Update correlation status and action based on missing accounts
     * Should be called after all layers are added to ensure correct status/action
     */
    public updateCorrelationStatus(): void {
        const hasAllAccountsCorrelated = this._missingAccountIds.size === 0

        if (hasAllAccountsCorrelated) {
            this._statuses.delete('uncorrelated')
            this._actions.add('correlated')
            this._uncorrelated = false
        } else {
            this._statuses.add('uncorrelated')
            this._actions.delete('correlated')
            this._uncorrelated = true
        }
    }

    /**
     * Marks a managed account as correlated by adding it to the account IDs set
     * and removing it from the missing set. Optionally tracks a correlation promise.
     *
     * @param accountId - The account ID that has been correlated
     * @param promise - Optional promise from the correlation API call
     */
    public setCorrelatedAccount(accountId: string, promise?: Promise<unknown>): void {
        this.addAccountId(accountId)
        this.removeMissingAccountId(accountId)
        if (promise) {
            this.addCorrelationPromise(accountId, promise)
        }
    }

    /** Tracks a correlation promise for deferred resolution during getISCAccount. */
    public addCorrelationPromise(_accountId: string, promise: Promise<unknown>): void {
        if (!promise) return

        // Track the promise - it will be resolved in getISCAccount via resolvePendingOperations
        // The promise handler (in correlateAccounts) will call setCorrelatedAccount on success
        this._correlationPromises.push(promise)
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    /** Whether this account has lost all its managed source accounts. */
    public isOrphan(): boolean {
        return this._statuses.has('orphan')
    }

    /** Adds a fusion decision action entitlement with a history entry. */
    public addFusionDecision(decision: string): void {
        this.addAction(decision, `Fusion decision added: ${decision}`)
    }

    /**
     * Remove a source account and update orphan status if needed
     */
    public removeSourceAccount(id: string): void {
        const accounts = this._attributeBag.current.accounts as any

        if (accounts instanceof Set) {
            accounts.delete(id)

            if (accounts.size === 0) {
                this.markAsOrphan()
                this.addHistory(`Account became orphan after removing source account: ${id}`)
            }
        }

        this.addHistory(`Source account removed: ${id}`)
    }

    /**
     * Mark account as orphan by updating statuses
     */
    private markAsOrphan(): void {
        if (!this._attributeBag.current.statuses) {
            this._attributeBag.current.statuses = new Set<string>() as any
        }

        const statuses = this._attributeBag.current.statuses as any
        if (statuses instanceof Set) {
            statuses.add('orphan')
        }
    }

    /** Placeholder for future attribute generation logic. */
    public generateAttributes(): void {
        // Placeholder for future implementation
    }

    /** Placeholder for future account editing logic. */
    public async editAccount(): Promise<void> {
        // TODO: Edit the account
    }
}
