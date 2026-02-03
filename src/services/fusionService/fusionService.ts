import { Account, IdentityDocument, SourcesV2025ApiUpdateSourceRequest } from 'sailpoint-api-client'
import { StdAccountListOutput, StandardCommand } from '@sailpoint/connector-sdk'
import { FusionConfig } from '../../model/config'
import { LogService } from '../logService'
import { FormService } from '../formService'
import { IdentityService } from '../identityService'
import { SourceInfo, SourceService } from '../sourceService'
import { FusionAccount } from '../../model/account'
import { attrConcat, AttributeService } from '../attributeService'
import { assert } from '../../utils/assert'
import { pickAttributes } from '../../utils/attributes'
import { createUrlContext, UrlContext } from '../../utils/url'
import { mapValuesToArray } from './collections'
import { FusionDecision } from '../../model/form'
import { FusionMatch } from '../scoringService'
import { ScoringService } from '../scoringService'
import { SchemaService } from '../schemaService'
import { FusionReport, FusionReportAccount } from './types'

// ============================================================================
// FusionService Class
// ============================================================================

/**
 * Service for identity fusion logic.
 * Pure in-memory operations - no ClientService dependency.
 * All data structures are passed in as parameters.
 */
export class FusionService {
    private fusionIdentityMap: Map<string, FusionAccount> = new Map()
    private fusionAccountMap: Map<string, FusionAccount> = new Map()
    // Managed accounts that were flagged as potential duplicates (forms created)
    private potentialDuplicateAccounts: FusionAccount[] = []
    // All analyzed managed accounts (including non-matches)
    private analyzedManagedAccounts: FusionAccount[] = []
    private _reviewersBySourceId: Map<string, Set<FusionAccount>> = new Map()
    private readonly sourcesByName: Map<string, SourceInfo> = new Map()
    private readonly reset: boolean
    private readonly correlateOnAggregation: boolean
    private readonly reportAttributes: string[]
    private readonly urlContext: UrlContext
    private readonly deleteEmpty: boolean
    public readonly fusionOwnerIsGlobalReviewer: boolean
    public readonly fusionReportOnAggregation: boolean
    public newManagedAccountsCount: number = 0
    public readonly commandType?: StandardCommand

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------

    constructor(
        private config: FusionConfig,
        private log: LogService,
        private identities: IdentityService,
        private sources: SourceService,
        private forms: FormService,
        private attributes: AttributeService,
        private scoring: ScoringService,
        private schemas: SchemaService,
        commandType?: StandardCommand
    ) {
        FusionAccount.configure(config)
        this.reset = config.reset
        this.correlateOnAggregation = config.correlateOnAggregation
        this.fusionOwnerIsGlobalReviewer = config.fusionOwnerIsGlobalReviewer ?? false
        this.fusionReportOnAggregation = config.fusionReportOnAggregation ?? false
        this.reportAttributes = config.fusionFormAttributes ?? []
        this.urlContext = createUrlContext(config.baseurl)
        this.commandType = commandType
        this.deleteEmpty = config.deleteEmpty
    }

    // ------------------------------------------------------------------------
    // Public Reset/Configuration Methods
    // ------------------------------------------------------------------------

    /**
     * Check if reset is enabled
     */
    public isReset(): boolean {
        return this.reset
    }

    /**
     * Get fusion identity by identity ID
     */
    public getFusionIdentity(identityId: string): FusionAccount | undefined {
        return this.fusionIdentityMap.get(identityId)
    }

    /**
     * Disable the reset flag in the source configuration
     */
    public async disableReset(): Promise<void> {
        const fusionSourceId = this.sources.fusionSourceId
        const requestParameters: SourcesV2025ApiUpdateSourceRequest = {
            id: fusionSourceId,
            jsonPatchOperationV2025: [
                {
                    op: 'replace',
                    path: '/connectorAttributes/reset',
                    value: false,
                },
            ],
        }
        await this.sources.patchSourceConfig(fusionSourceId, requestParameters)
    }

    public async resetState(): Promise<void> {
        const fusionSourceId = this.sources.fusionSourceId
        const requestParameters: SourcesV2025ApiUpdateSourceRequest = {
            id: fusionSourceId,
            jsonPatchOperationV2025: [
                {
                    op: 'replace',
                    path: '/connectorAttributes/fusionState',
                    value: false,
                },
            ],
        }
        await this.sources.patchSourceConfig(fusionSourceId, requestParameters)
    }

    // ------------------------------------------------------------------------
    // Public Fusion Account Processing Methods
    // ------------------------------------------------------------------------

    /**
     * Pre-process all fusion accounts from sources
     */
    public async preProcessFusionAccounts(): Promise<void> {
        const fusionAccounts = this.sources.fusionAccounts
        await Promise.all(fusionAccounts.map((x: Account) => this.preProcessFusionAccount(x)))
    }

    /**
     * Process all fusion accounts from sources
     */
    public async processFusionAccounts(): Promise<void> {
        const fusionAccounts = this.sources.fusionAccounts
        this.log.info(`Processing ${fusionAccounts.length} fusion account(s)`)
        await Promise.all(fusionAccounts.map((x: Account) => this.processFusionAccount(x)))
        this.log.info('Fusion accounts processing completed')
    }

    /**
     * Pre-process a single fusion account
     */
    public async preProcessFusionAccount(account: Account): Promise<FusionAccount> {
        assert(
            !this.fusionIdentityMap.has(account.nativeIdentity),
            `Fusion account found for ${account.nativeIdentity}. Should not process Fusion accounts more than once.`
        )

        const fusionAccount = FusionAccount.fromFusionAccount(account)
        const key = this.attributes.getSimpleKey(fusionAccount)
        fusionAccount.setKey(key)

        this.setFusionAccount(fusionAccount)

        return fusionAccount
    }

    /**
     * Process a single fusion account
     */
    public async processFusionAccount(account: Account): Promise<FusionAccount> {
        const fusionAccount = await this.preProcessFusionAccount(account)
        const managedAccountsMap = this.sources.managedAccountsById
        assert(managedAccountsMap, 'Managed accounts have not been loaded')
        const identityId = account.identityId!

        // Use for...of instead of forEach for better performance
        for (const sourceId of fusionAccount.listReviewerSources()) {
            this.setReviewerForSource(fusionAccount, sourceId)
        }

        const identity = this.identities.getIdentityById(identityId)
        if (identity) {
            fusionAccount.addIdentityLayer(identity)

            const fusionDecision = this.forms.getFusionAssignmentDecision(identityId)
            if (fusionDecision) {
                fusionAccount.addFusionDecisionLayer(fusionDecision)
            }
        }

        // Pass the captured map reference directly
        fusionAccount.addManagedAccountLayer(managedAccountsMap)

        if (this.commandType === StandardCommand.StdAccountList) {
            await this.attributes.registerUniqueAttributes(fusionAccount)
        }
        this.attributes.mapAttributes(fusionAccount)
        await this.attributes.refreshNonUniqueAttributes(fusionAccount)

        // Correlate missing accounts if correlateOnAggregation is enabled and there are missing accounts
        // Status/action will be updated after correlation promises resolve in getISCAccount
        const correlate = this.correlateOnAggregation && this.commandType === StandardCommand.StdAccountList
        if (correlate && fusionAccount.missingAccountIds.length > 0) {
            await this.identities.correlateAccounts(fusionAccount)
        }

        return fusionAccount
    }

    // ------------------------------------------------------------------------
    // Public Identity Processing Methods
    // ------------------------------------------------------------------------

    /**
     * Process all identities
     */
    public async processIdentities(): Promise<void> {
        const { identities } = this.identities
        this.log.info(`Processing ${identities.length} identities`)
        await Promise.all(identities.map((x) => this.processIdentity(x)))
        const { managedSources } = this.sources
        managedSources.forEach((source) => {
            this.sourcesByName.set(source.name, source)
        })

        if (this.fusionOwnerIsGlobalReviewer) {
            const { fusionSourceOwner } = this.sources

            const globalReviewer = this.fusionIdentityMap.get(fusionSourceOwner.id!)
            if (globalReviewer) {
                managedSources.forEach((source) => {
                    this.setReviewerForSource(globalReviewer, source.id!)
                })
            }
        }
        this.log.info('Identities processing completed')
    }

    /**
     * Process a single identity
     */
    public async processIdentity(identity: IdentityDocument): Promise<void> {
        const { fusionDisplayAttribute } = this.schemas
        const identityId = identity.id

        if (!this.fusionIdentityMap.has(identityId)) {
            const fusionAccount = FusionAccount.fromIdentity(identity)
            fusionAccount.addIdentityLayer(identity)

            const managedAccountsMap = this.sources.managedAccountsById
            assert(managedAccountsMap, 'Managed accounts have not been loaded')
            fusionAccount.addManagedAccountLayer(managedAccountsMap)

            this.attributes.mapAttributes(fusionAccount)
            await this.attributes.refreshAttributes(fusionAccount)

            const key = this.attributes.getSimpleKey(fusionAccount)
            fusionAccount.setKey(key)

            // Set display attribute using the attributes getter
            fusionAccount.attributes[fusionDisplayAttribute] = identity.name

            // Use setter method to add to appropriate map
            this.setFusionAccount(fusionAccount)
        }
    }

    /**
     * Process all identity fusion decisions
     */
    public async processFusionIdentityDecisions(): Promise<void> {
        const { fusionIdentityDecisions: identityFusionDecisions } = this.forms
        this.log.info(`Processing ${identityFusionDecisions.length} identity fusion decision(s)`)

        // Clear reviewer reviews so we repopulate only from current run (pending decisions + form instances).
        // This ensures reviewers' reviews attribute is updated with current fusion review instance URLs every run.
        const reviewerSet = new Set<FusionAccount>()
        for (const reviewers of this._reviewersBySourceId.values()) {
            for (const reviewer of reviewers) {
                reviewerSet.add(reviewer)
            }
        }
        for (const reviewer of reviewerSet) {
            reviewer.clearFusionReviews()
        }

        // Populate reviewer reviews from pending (unanswered) form instances kept during fetchFormData.
        // Each reviewer gets their current pending instance URLs by identityId.
        const pendingByReviewer = this.forms.pendingReviewUrlsByReviewerId
        let pendingReviews = 0
        for (const reviewer of reviewerSet) {
            const identityId = reviewer.identityId
            if (!identityId) continue
            const urls = pendingByReviewer.get(identityId)
            if (!urls?.length) continue
            for (const url of urls) {
                reviewer.addFusionReview(url)
                pendingReviews++
            }
        }
        this.log.debug(`Populated reviewer reviews from pending form instances - added ${pendingReviews} pending review(s)`)

        // Apply only finished decisions to fusion identities.
        await Promise.all(identityFusionDecisions.map((x) => this.processIdentityFusionDecision(x)))
        this.log.info('Identity fusion decisions processing completed')
    }

    /**
     * Process a single identity fusion decision
     */
    public async processIdentityFusionDecision(fusionDecision: FusionDecision): Promise<void> {
        // Skip unfinished decisions - they represent in-progress reviews and should not
        // yet affect fusion identity state.
        if (!fusionDecision.finished) {
            this.log.debug(
                `Skipping unfinished fusion decision for account ${fusionDecision.account.id} (identity: ${fusionDecision.identityId ?? 'new'})`
            )
            return
        }

        let fusionAccount: FusionAccount
        if (fusionDecision.newIdentity) {
            fusionAccount = FusionAccount.fromFusionDecision(fusionDecision)
        } else {
            fusionAccount = this.fusionIdentityMap.get(fusionDecision.identityId!)!
            assert(fusionAccount, 'Fusion account not found')
        }

        fusionAccount.addFusionDecisionLayer(fusionDecision)
        const managedAccountsMap = this.sources.managedAccountsById!
        fusionAccount.addManagedAccountLayer(managedAccountsMap)
        this.attributes.mapAttributes(fusionAccount)
        await this.attributes.refreshAttributes(fusionAccount)

        if (fusionDecision.newIdentity) {
            const key = this.attributes.getSimpleKey(fusionAccount)
            fusionAccount.setKey(key)

            this.setFusionAccount(fusionAccount)
        }
    }

    // ------------------------------------------------------------------------
    // Public Managed Account Processing Methods
    // ------------------------------------------------------------------------

    /**
     * Process all managed accounts
     */
    public async processManagedAccounts(): Promise<void> {
        const { managedAccounts } = this.sources
        this.newManagedAccountsCount = managedAccounts.length
        this.log.info(`Processing ${managedAccounts.length} managed account(s)`)
        await Promise.all(managedAccounts.map((x: Account) => this.processManagedAccount(x)))
        this.log.info('Managed accounts processing completed')
    }

    /**
     * Returns true when all attribute similarity scores in the match are 100 (perfect match).
     * Excludes the synthetic 'average' score when overall scoring is used.
     */
    private static hasAllAttributeScoresPerfect(match: FusionMatch): boolean {
        const attributeScores = match.scores.filter((s) => s.algorithm !== 'average')
        return attributeScores.length > 0 && attributeScores.every((s) => s.score === 100)
    }

    /**
     * Builds a synthetic fusion decision for auto-correlation when all attribute scores are 100.
     */
    private createAutoCorrelationDecision(
        fusionAccount: FusionAccount,
        account: Account,
        identityId: string
    ): FusionDecision {
        return {
            submitter: { id: 'system', email: '', name: 'System (auto-correlated)' },
            account: {
                id: fusionAccount.managedAccountId!,
                name: fusionAccount.name ?? account.name ?? '',
                sourceName: fusionAccount.sourceName,
            },
            newIdentity: false,
            identityId,
            comments: 'Auto-correlated: all attribute scores were 100',
            finished: true,
        }
    }

    /**
     * Process a single managed account
     */
    public async processManagedAccount(account: Account): Promise<void> {
        const fusionAccount = await this.analyzeManagedAccount(account)

        if (fusionAccount.isMatch) {
            const perfectMatch = fusionAccount.fusionMatches.find((m) =>
                FusionService.hasAllAttributeScoresPerfect(m)
            )
            const identityId = perfectMatch?.fusionIdentity.identityId
            if (this.config.fusionMergingIdentical && identityId) {
                // Perfect match
                this.log.debug(
                    `Account ${account.name} [${fusionAccount.sourceName}] has all scores 100, auto-correlating to identity ${identityId}`
                )
                const syntheticDecision = this.createAutoCorrelationDecision(
                    fusionAccount,
                    account,
                    identityId
                )
                await this.processIdentityFusionDecision(syntheticDecision)
            } else {
                // Match
                const sourceInfo = this.sourcesByName.get(fusionAccount.sourceName)
                assert(sourceInfo, 'Source info not found')
                const reviewers = this.reviewersBySourceId.get(sourceInfo.id!)
                await this.forms.createFusionForm(fusionAccount, reviewers)
            }
        } else {
            // Non-match
            this.log.debug(`Account ${account.name} is not a duplicate, adding to fusion accounts`)
            await this.attributes.refreshUniqueAttributes(fusionAccount)
            const key = this.attributes.getSimpleKey(fusionAccount)
            fusionAccount.setKey(key)
            fusionAccount.setUnmatched()

            // Use setter method to add to appropriate map
            this.setFusionAccount(fusionAccount)
        }
    }

    /**
     * Analyze all managed accounts
     */
    public async analyzeManagedAccounts(): Promise<void> {
        const { managedAccounts } = this.sources

        await Promise.all(managedAccounts.map((x: Account) => this.analyzeManagedAccount(x)))
    }

    /**
     * Analyze a single managed account
     */
    public async analyzeManagedAccount(account: Account): Promise<FusionAccount> {
        const { name, sourceName } = account
        const fusionAccount = await this.preProcessManagedAccount(account)
        this.scoring.scoreFusionAccount(fusionAccount, this.fusionIdentities)

        // Track all analyzed managed accounts for reporting
        this.analyzedManagedAccounts.push(fusionAccount)

        if (fusionAccount.isMatch) {
            this.log.debug(
                `Account ${name} [${sourceName}] is a potential duplicate, creating fusion form`
            )

            // Keep a reference for reporting (these accounts are not added to fusionAccountMap)
            this.potentialDuplicateAccounts.push(fusionAccount)
        }

        return fusionAccount
    }

    // ------------------------------------------------------------------------
    // Public Output/Listing Methods
    // ------------------------------------------------------------------------

    /**
     * List all ISC accounts (fusion accounts and identity accounts)
     */
    public async listISCAccounts(): Promise<StdAccountListOutput[]> {
        let fusionIdentities = Array.from(this.fusionIdentityMap.values())
        let fusionAccounts = Array.from(this.fusionAccountMap.values())
        if (this.deleteEmpty && this.commandType === StandardCommand.StdAccountList) {
            fusionIdentities = fusionIdentities.filter((x) => !x.isOrphan())
            fusionAccounts = fusionAccounts.filter((x) => !x.isOrphan())
        }

        const accounts = [
            ...fusionAccounts,
            ...fusionIdentities,
        ]

        return await Promise.all(accounts.map((x) => this.getISCAccount(x)))
    }

    // ------------------------------------------------------------------------
    // Private Helper Methods
    // ------------------------------------------------------------------------

    /**
     * Set a reviewer for a specific source
     */
    private setReviewerForSource(fusionAccount: FusionAccount, sourceId: string): void {
        fusionAccount.setSourceReviewer(sourceId)
        const reviewers: Set<FusionAccount> = this.reviewersBySourceId.get(sourceId) ?? new Set()
        reviewers.add(fusionAccount)
        this.reviewersBySourceId.set(sourceId, reviewers)
    }

    /**
     * Pre-process a managed account before processing or analysis
     */
    private async preProcessManagedAccount(account: Account): Promise<FusionAccount> {
        const fusionAccount = FusionAccount.fromManagedAccount(account)

        assert(this.sources.managedAccountsById, 'Managed accounts have not been loaded')
        fusionAccount.addManagedAccountLayer(new Map([[account.id!, account]]))

        this.attributes.mapAttributes(fusionAccount)
        await this.attributes.refreshNonUniqueAttributes(fusionAccount)

        return fusionAccount
    }

    /**
     * Convert a fusion account to ISC account output format
     */
    public async getISCAccount(fusionAccount: FusionAccount): Promise<StdAccountListOutput> {
        await fusionAccount.resolvePendingOperations()
        // Update correlation status/action after all correlation promises have resolved
        fusionAccount.updateCorrelationStatus()
        // Sync collection state (reviews, accounts, statuses, actions) into the attribute bag
        // so that the subset and output include current values (e.g. reviewer review URLs).
        fusionAccount.syncCollectionAttributesToBag()
        const attributes = this.schemas.getFusionAttributeSubset(fusionAccount.attributes)
        const disabled = fusionAccount.disabled
        const key = fusionAccount.key
        attributes.sources = attrConcat(Array.from(fusionAccount.sources))
        attributes.accounts = Array.from(fusionAccount.accountIds)
        attributes.history = fusionAccount.history
        attributes['missing-accounts'] = Array.from(fusionAccount.missingAccountIds)
        attributes.reviews = Array.from(fusionAccount.reviews)
        attributes.statuses = Array.from(fusionAccount.statuses)
        attributes.actions = Array.from(fusionAccount.actions)

        return {
            key,
            attributes,
            disabled,
        }
    }

    public get fusionIdentities(): FusionAccount[] {
        return mapValuesToArray(this.fusionIdentityMap)
    }

    /**
     * Get all fusion accounts keyed by native identity
     */
    public get fusionAccounts(): FusionAccount[] {
        return mapValuesToArray(this.fusionAccountMap)
    }

    /**
     * Get reviewers by source ID map
     */
    public get reviewersBySourceId(): Map<string, Set<FusionAccount>> {
        return this._reviewersBySourceId
    }

    /**
     * Set a fusion account, automatically determining whether to add it as a fusion account
     * or fusion identity based on whether it has an identityId and is not uncorrelated.
     *
     * - If the account has an identityId and is not uncorrelated → added to fusionIdentityMap (keyed by identityId)
     * - Otherwise → added to fusionAccountMap (keyed by nativeIdentity)
     *
     * This matches the logic in preProcessFusionAccount where uncorrelated accounts go to
     * fusionAccountMap and correlated accounts go to fusionIdentityMap.
     */
    public setFusionAccount(fusionAccount: FusionAccount): void {
        const identityId = fusionAccount.identityId
        const hasIdentityId = identityId && identityId.trim() !== ''
        const isUncorrelated = fusionAccount.uncorrelated

        if (hasIdentityId && !isUncorrelated) {
            // Add to fusion identity map, keyed by identityId (correlated account)
            // identityId is guaranteed to be a string here due to hasIdentityId check
            this.fusionIdentityMap.set(identityId!, fusionAccount)
        } else {
            // Add to fusion account map, keyed by nativeIdentity (uncorrelated account)
            // This indicates a non-identity fusion account (no identityId)
            assert(
                fusionAccount.nativeIdentity,
                'Fusion account must have a nativeIdentity to be added to fusion account map'
            )
            this.fusionAccountMap.set(fusionAccount.nativeIdentity, fusionAccount)
        }
    }

    /**
     * Get a fusion account by native identity
     */
    public getFusionAccountByNativeIdentity(nativeIdentity: string): FusionAccount | undefined {
        return this.fusionAccountMap.get(nativeIdentity)
    }

    /**
     * Generate a fusion report with all accounts that have potential duplicates
     */
    public generateReport(includeNonMatches: boolean = false): FusionReport {
        const accounts: FusionReportAccount[] = []

        // Report on the managed accounts that were flagged as potential duplicates (forms created)
        for (const fusionAccount of this.potentialDuplicateAccounts) {
            const fusionMatches = fusionAccount.fusionMatches
            if (fusionMatches && fusionMatches.length > 0) {
                const matches = fusionMatches.map((match) => ({
                    identityName: match.fusionIdentity.name || match.fusionIdentity.displayName || 'Unknown',
                    identityId: match.fusionIdentity.identityId,
                    identityUrl: this.urlContext.identity(match.fusionIdentity.identityId),
                    isMatch: true,
                    scores: match.scores.map((score) => ({
                        attribute: score.attribute,
                        algorithm: score.algorithm,
                        score: score.score,
                        fusionScore: score.fusionScore,
                        isMatch: score.isMatch,
                        comment: score.comment,
                    })),
                }))

                accounts.push({
                    accountName: fusionAccount.name || fusionAccount.displayName || 'Unknown',
                    accountSource: fusionAccount.sourceName,
                    accountId: fusionAccount.managedAccountId ?? fusionAccount.nativeIdentityOrUndefined,
                    accountEmail: fusionAccount.email,
                    accountAttributes: pickAttributes(fusionAccount.attributes as any, this.reportAttributes),
                    matches,
                })
            }
        }

        // Include non-matches if requested
        const nonMatchAccounts: FusionReportAccount[] = includeNonMatches
            ? this.generateNonMatchAccounts()
            : []

        // Sort matches alphabetically by account name
        accounts.sort((a, b) => a.accountName.localeCompare(b.accountName))

        // Combine: matches first, then non-matches
        const allAccounts = [...accounts, ...nonMatchAccounts]

        const potentialDuplicates = accounts.length

        return {
            accounts: allAccounts,
            totalAccounts: this.newManagedAccountsCount,
            potentialDuplicates,
            reportDate: new Date(),
        }
    }

    /**
     * Generate non-match accounts for reporting
     */
    private generateNonMatchAccounts(): FusionReportAccount[] {
        // Filter out accounts that are already in potentialDuplicateAccounts (matches)
        const matchAccountIds = new Set(
            this.potentialDuplicateAccounts.map(
                (a) => a.managedAccountId ?? a.nativeIdentityOrUndefined
            )
        )

        const nonMatchAccounts: FusionReportAccount[] = []

        for (const fusionAccount of this.analyzedManagedAccounts) {
            const accountId = fusionAccount.managedAccountId ?? fusionAccount.nativeIdentityOrUndefined
            // Skip if this account is already included as a match
            if (!matchAccountIds.has(accountId)) {
                nonMatchAccounts.push({
                    accountName: fusionAccount.name || fusionAccount.displayName || 'Unknown',
                    accountSource: fusionAccount.sourceName,
                    accountId,
                    accountEmail: fusionAccount.email,
                    accountAttributes: pickAttributes(fusionAccount.attributes as any, this.reportAttributes),
                    matches: [], // Non-matches have no potential matches
                })
            }
        }

        // Sort non-matches alphabetically by account name
        nonMatchAccounts.sort((a, b) => a.accountName.localeCompare(b.accountName))

        return nonMatchAccounts
    }
}
