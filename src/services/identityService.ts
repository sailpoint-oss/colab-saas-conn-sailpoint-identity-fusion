import { AccountsApiUpdateAccountRequest, IdentityDocument, Search } from 'sailpoint-api-client'
import { FusionConfig } from '../model/config'
import { ClientService } from './clientService'
import { LogService } from './logService'
import { assert } from '../utils/assert'
import { FusionAccount } from '../model/account'

// ============================================================================
// IdentityService Class
// ============================================================================

/**
 * Service for managing identity documents, identity lookups, and reviewer management.
 */
export class IdentityService {
    private identitiesById: Map<string, IdentityDocument> = new Map()
    private readonly identityScopeQuery?: string
    private readonly includeIdentities: boolean

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------

    constructor(
        config: FusionConfig,
        private log: LogService,
        private client: ClientService
    ) {
        this.identityScopeQuery = config.identityScopeQuery
        this.includeIdentities = config.includeIdentities ?? true
    }

    // ------------------------------------------------------------------------
    // Public Properties/Getters
    // ------------------------------------------------------------------------

    /**
     * Get all identities
     */
    public get identities(): IdentityDocument[] {
        assert(this.identitiesById, 'Identities not fetched')
        return Array.from(this.identitiesById.values())
    }

    // ------------------------------------------------------------------------
    // Public Fetch Methods
    // ------------------------------------------------------------------------

    /**
     * Fetch identities and cache them
     */
    public async fetchIdentities(): Promise<void> {
        if (!this.includeIdentities) {
            this.log.info('Identity fetching disabled by configuration, skipping identity fetch.')
            return
        }

        if (this.identityScopeQuery) {
            this.log.info('Fetching identities.')

            //TODO: only fetch relevant attributes

            const query: Search = {
                indices: ['identities'],
                query: {
                    query: this.identityScopeQuery,
                },
                includeNested: true,
            }

            const identities = await this.client.paginateSearchApi<IdentityDocument>(query)
            this.identitiesById = new Map(
                identities.map((identity) => [identity.protected ? '-' : identity.id, identity])
            )
            this.identitiesById.delete('-')
        } else {
            this.log.info('No identity scope query defined, skipping identity fetch.')
            this.identitiesById = new Map()
        }
    }

    /**
     * Fetch a single identity by ID and cache it
     */
    public async fetchIdentityById(id: string): Promise<IdentityDocument> {
        this.log.info(`Fetching identity ${id}.`)

        //TODO: only fetch relevant attributes

        const query: Search = {
            indices: ['identities'],
            query: {
                query: `id:"${id}"`,
            },
            includeNested: true,
        }

        const identities = await this.client.paginateSearchApi<IdentityDocument>(query)
        identities.forEach((identity) => this.identitiesById.set(identity.id, identity))

        return identities[0]
    }

    /**
     * Fetch a single identity by ID and cache it
     */
    public async fetchIdentityByName(name: string): Promise<IdentityDocument> {
        this.log.info(`Fetching identity ${name}.`)

        //TODO: only fetch relevant attributes

        const query: Search = {
            indices: ['identities'],
            query: {
                query: `name.exact:"${name}"`,
            },
            includeNested: true,
        }

        const identities = await this.client.paginateSearchApi<IdentityDocument>(query)
        identities.forEach((identity) => this.identitiesById.set(identity.id, identity))

        return identities[0]
    }

    // ------------------------------------------------------------------------
    // Public Lookup Methods
    // ------------------------------------------------------------------------

    /**
     * Get identity by ID from cache
     */
    public getIdentityById(id?: string): IdentityDocument | undefined {
        if (id) {
            return this.identitiesById.get(id)
        }
    }

    // ------------------------------------------------------------------------
    // Public Correlation Methods
    // ------------------------------------------------------------------------

    /**
     * Correlate missing accounts to an identity
     * Processes all missing accounts asynchronously - promises are tracked and resolved later
     * The correlation happens in the background and getISCAccount will resolve the promises
     */
    public async correlateAccounts(fusionAccount: FusionAccount): Promise<boolean> {
        const { missingAccountIds, identityId } = fusionAccount
        const { accountsApi } = this.client

        if (!identityId) {
            this.log.warn(`Cannot correlate accounts for fusion account ${fusionAccount.name}: no identity ID`)
            return false
        }

        if (missingAccountIds.length === 0) {
            return true
        }

        this.log.debug(
            `Starting correlation for ${missingAccountIds.length} missing account(s) for fusion account ${fusionAccount.name}`
        )

        // Create correlation promises for all missing accounts (fire-and-forget)
        // Store a copy of missing account IDs since we'll be modifying the set during correlation
        const accountIdsToCorrelate = [...missingAccountIds]

        accountIdsToCorrelate.forEach((accountId) => {
            const requestParameters: AccountsApiUpdateAccountRequest = {
                id: accountId,
                requestBody: [
                    {
                        op: 'replace',
                        path: '/identityId',
                        value: identityId,
                    },
                ],
            }

            // Use client.execute to ensure proper queue handling if enabled
            const correlationPromise = this.client
                .execute(() => accountsApi.updateAccount(requestParameters))
                .then(() => {
                    // On success, mark account as correlated and remove from missing list
                    // This also adds history entry
                    fusionAccount.setCorrelatedAccount(accountId)
                    this.log.debug(`Successfully correlated account ${accountId} to identity ${identityId}`)
                })
                .catch((error) => {
                    this.log.error(`Failed to correlate account ${accountId}: ${error}`)
                    // Don't re-throw - we want Promise.allSettled to handle it gracefully
                })

            // Track the promise - it will be resolved in getISCAccount via resolvePendingOperations
            fusionAccount.addCorrelationPromise(accountId, correlationPromise)
        })

        // Return immediately - correlation happens asynchronously
        return true
    }

    // ------------------------------------------------------------------------
    // Public Utility Methods
    // ------------------------------------------------------------------------

    /**
     * Clear the identity cache
     */
    public clear(): void {
        this.identitiesById.clear()
    }
}
