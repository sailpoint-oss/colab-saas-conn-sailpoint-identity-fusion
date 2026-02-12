import { AccountsApiUpdateAccountRequest, IdentityDocument, Search } from 'sailpoint-api-client'
import { ConnectorError, ConnectorErrorType } from '@sailpoint/connector-sdk'
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

    /**
     * @param config - Fusion configuration containing identity scope settings
     * @param log - Logger instance
     * @param client - API client for ISC search and account operations
     */
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
     * Get all identities as an array.
     * Note: Creates a new array on each access. Use identityCount for size checks
     * and identityValues() for iteration when no array is needed.
     */
    public get identities(): IdentityDocument[] {
        assert(this.identitiesById, 'Identities not fetched')
        return Array.from(this.identitiesById.values())
    }

    /**
     * Get the number of cached identities without creating an intermediate array.
     */
    public get identityCount(): number {
        return this.identitiesById.size
    }

    /**
     * Returns an iterator over cached identity documents.
     * Avoids creating a temporary array when only iteration is needed.
     */
    public identityValues(): IterableIterator<IdentityDocument> {
        return this.identitiesById.values()
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

            try {
                const identities = await this.client.paginateSearchApi<IdentityDocument>(
                    query,
                    undefined,
                    'IdentityService>fetchIdentities searchPost'
                )
                this.identitiesById = new Map(
                    identities.map((identity) => [identity.protected ? '-' : identity.id, identity])
                )
                this.identitiesById.delete('-')
            } catch (error) {
                if (error instanceof ConnectorError) throw error
                const detail = error instanceof Error ? error.message : String(error)
                throw new ConnectorError(
                    `Failed to fetch identities using scope query "${this.identityScopeQuery}": ${detail}`,
                    ConnectorErrorType.Generic
                )
            }
        } else {
            this.log.info('No identity scope query defined, skipping identity fetch.')
            this.identitiesById = new Map()
        }
    }

    /**
     * Fetches a single identity by ID and adds it to the cache.
     *
     * @param id - The ISC identity ID to fetch
     * @returns The fetched identity document
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

        try {
            const identities = await this.client.paginateSearchApi<IdentityDocument>(
                query,
                undefined,
                'IdentityService>fetchIdentityById searchPost'
            )
            identities.forEach((identity) => this.identitiesById.set(identity.id, identity))
            return identities[0]
        } catch (error) {
            if (error instanceof ConnectorError) throw error
            const detail = error instanceof Error ? error.message : String(error)
            throw new ConnectorError(
                `Failed to fetch identity by ID "${id}": ${detail}`,
                ConnectorErrorType.Generic
            )
        }
    }

    /**
     * Fetches a single identity by exact name match and adds it to the cache.
     *
     * @param name - The identity name to search for
     * @returns The fetched identity document
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

        try {
            const identities = await this.client.paginateSearchApi<IdentityDocument>(
                query,
                undefined,
                'IdentityService>fetchIdentityByName searchPost'
            )
            identities.forEach((identity) => this.identitiesById.set(identity.id, identity))
            return identities[0]
        } catch (error) {
            if (error instanceof ConnectorError) throw error
            const detail = error instanceof Error ? error.message : String(error)
            throw new ConnectorError(
                `Failed to fetch identity by name "${name}": ${detail}`,
                ConnectorErrorType.Generic
            )
        }
    }

    // ------------------------------------------------------------------------
    // Public Lookup Methods
    // ------------------------------------------------------------------------

    /**
     * Retrieves an identity from the local cache by ID.
     *
     * @param id - The identity ID to look up
     * @returns The cached identity document, or undefined if not found
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
     * Triggers asynchronous correlation of all missing accounts to the fusion account's identity.
     * Correlation promises are tracked on the fusion account and resolved later during
     * {@link FusionAccount.resolvePendingOperations}.
     *
     * @param fusionAccount - The fusion account with missing accounts to correlate
     * @returns true if correlation was initiated, false if no identity ID is available
     */
    public async correlateAccounts(fusionAccount: FusionAccount): Promise<boolean> {
        const { missingAccountIds, identityId } = fusionAccount
        const { accountsApi } = this.client

        if (!identityId) {
            this.log.warn(`Cannot correlate accounts for fusion account ${fusionAccount.name}: no identity ID`)
            return false
        }

        if (missingAccountIds.length === 0) {
            this.log.info(`No missing accounts to correlate for fusion account ${fusionAccount.name}`)
            return true
        }

        this.log.info(
            `Triggering correlation for ${missingAccountIds.length} missing account(s) for fusion account ${fusionAccount.name}`
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
