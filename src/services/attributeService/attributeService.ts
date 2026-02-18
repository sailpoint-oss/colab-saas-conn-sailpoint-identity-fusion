import { FusionConfig, AttributeMap, NormalAttributeDefinition, UniqueAttributeDefinition, SourceConfig } from '../../model/config'
import { LogService } from '../logService'
import { FusionAccount } from '../../model/account'
import { SchemaService } from '../schemaService'
import { CompoundKey, CompoundKeyType, SimpleKey, SimpleKeyType, StandardCommand } from '@sailpoint/connector-sdk'
import { evaluateVelocityTemplate, normalize, padNumber, removeSpaces, switchCase } from './formatting'
import { LockService } from '../lockService'
import { RenderContext } from 'velocityjs/dist/src/type'
import { v4 as uuidv4 } from 'uuid'
import { assert } from '../../utils/assert'
import { JsonPatchOperationV2025OpV2025, SourcesV2025ApiUpdateSourceRequest } from 'sailpoint-api-client'
import { SourceService } from '../sourceService'
import { COMPOUND_KEY_UNIQUE_ID_ATTRIBUTE, FUSION_STATE_CONFIG_PATH } from './constants'
import { AttributeMappingConfig } from './types'
import { processAttributeMapping, buildAttributeMappingConfig } from './helpers'
import { isValidAttributeValue } from '../../utils/attributes'
import { StateWrapper } from './stateWrapper'

type AnyDefinition = NormalAttributeDefinition | UniqueAttributeDefinition

// ============================================================================
// AttributeService Class
// ============================================================================

/**
 * Service for attribute mapping, attribute definition, and UUID management.
 * Combines functionality for mapping attributes from source accounts and generating unique IDs.
 */
export class AttributeService {
    private _attributeMappingConfig?: Map<string, AttributeMappingConfig>
    private normalDefinitions: NormalAttributeDefinition[] = []
    private uniqueDefinitions: UniqueAttributeDefinition[] = []
    private uniqueAttributeNames: Set<string> = new Set()
    private uniqueValuesByAttribute: Map<string, Set<string>> = new Map()
    private normalDefinitionByName: Map<string, NormalAttributeDefinition> = new Map()
    private uniqueDefinitionByName: Map<string, UniqueAttributeDefinition> = new Map()
    private stateWrapper?: StateWrapper
    private readonly skipAccountsWithMissingId: boolean
    private readonly attributeMaps?: AttributeMap[]
    private readonly attributeMerge: 'first' | 'list' | 'concatenate'
    private readonly sourceConfigs: SourceConfig[]
    private readonly maxAttempts?: number
    private readonly forceAttributeRefresh: boolean

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------

    /**
     * @param config - Fusion configuration containing attribute maps, definitions, and merge strategy
     * @param schemas - Schema service for resolving attribute names and types
     * @param sourceService - Source service for persisting state to the fusion source config
     * @param log - Logger instance
     * @param locks - Lock service for thread-safe unique attribute generation
     * @param commandType - The current SDK command type (affects key generation behavior)
     */
    constructor(
        config: FusionConfig,
        private schemas: SchemaService,
        private sourceService: SourceService,
        private log: LogService,
        private locks: LockService,
        private commandType?: StandardCommand
    ) {
        this.attributeMaps = config.attributeMaps
        this.attributeMerge = config.attributeMerge
        this.sourceConfigs = config.sources
        this.maxAttempts = config.maxAttempts
        this.skipAccountsWithMissingId = config.skipAccountsWithMissingId
        this.forceAttributeRefresh = config.forceAttributeRefresh

        this.normalDefinitions = config.normalAttributeDefinitions ? [...config.normalAttributeDefinitions] : []
        this.uniqueDefinitions = config.uniqueAttributeDefinitions ? [...config.uniqueAttributeDefinitions] : []

        this.normalDefinitionByName = new Map(this.normalDefinitions.map((d) => [d.name, d]))
        this.uniqueDefinitionByName = new Map(this.uniqueDefinitions.map((d) => [d.name, d]))
        this.uniqueAttributeNames = new Set(this.uniqueDefinitions.map((d) => d.name))

        this.setStateWrapper(config.fusionState)
    }

    // ------------------------------------------------------------------------
    // Public State Management Methods
    // ------------------------------------------------------------------------

    /**
     * Save the current state to the source configuration
     */
    public async saveState(): Promise<void> {
        const fusionSourceId = this.sourceService.fusionSourceId
        const stateObject = await this.getStateObject()

        this.log.info(`Saving state object: ${JSON.stringify(stateObject)}`)
        const requestParameters: SourcesV2025ApiUpdateSourceRequest = {
            id: fusionSourceId,
            jsonPatchOperationV2025: [
                {
                    // Use 'add' for upsert semantics: creates path if missing, replaces if present (RFC 6902).
                    // 'replace' requires the path to exist and fails with 400 on first run.
                    op: 'add' as JsonPatchOperationV2025OpV2025,
                    path: FUSION_STATE_CONFIG_PATH,
                    value: stateObject,
                },
            ],
        }
        await this.sourceService.patchSourceConfig(fusionSourceId, requestParameters, 'AttributeService>saveState')
    }

    /**
     * Get the current state object
     */
    public async getStateObject(): Promise<{ [key: string]: number }> {
        if (this.locks && typeof this.locks.waitForAllPendingOperations === 'function') {
            await this.locks.waitForAllPendingOperations()
        }
        const stateWrapper = this.getStateWrapper()

        if (this.log) {
            this.log.debug(`Reading state - StateWrapper has ${stateWrapper.state.size} entries`)
        }

        const state = stateWrapper.getState()

        if (this.log) {
            this.log.debug(`getState() returned: ${JSON.stringify(state)}`)
        }

        return state
    }

    /**
     * Set state wrapper for counter-based attributes.
     * Injects lock service for thread-safe counter operations in parallel processing.
     *
     * @param state - Persisted counter state (attribute name -> numeric value); typically from config.fusionState
     */
    public setStateWrapper(state: Record<string, unknown> | undefined): void {
        this.stateWrapper = new StateWrapper(state, this.locks)
    }

    /**
     * Initialize incremental counters from unique attribute definitions.
     * Should be called once after setStateWrapper to ensure all counters are initialized.
     */
    public async initializeCounters(): Promise<void> {
        const stateWrapper = this.getStateWrapper()
        const counterDefinitions = this.uniqueDefinitions.filter((def) => def.useIncrementalCounter)

        if (counterDefinitions.length === 0) {
            return
        }

        if (this.log) {
            this.log.debug(`Initializing ${counterDefinitions.length} incremental counter attributes`)
            const existingCounters = Object.fromEntries(
                Array.from(stateWrapper.state.entries()).filter(([key]) =>
                    counterDefinitions.some((def) => def.name === key)
                )
            )
            if (Object.keys(existingCounters).length > 0) {
                this.log.debug(`Preserving existing counter values: ${JSON.stringify(existingCounters)}`)
            }
        }

        await Promise.all(
            counterDefinitions.map((def) => {
                const start = def.counterStart ?? 1
                return stateWrapper.initCounter(def.name, start)
            })
        )

        if (this.log) {
            const finalCounters: { [key: string]: number } = {}
            counterDefinitions.forEach((def) => {
                const value = stateWrapper.state.get(def.name)
                if (value !== undefined) {
                    finalCounters[def.name] = value
                }
            })
            this.log.debug(`All incremental counters initialized. Current values: ${JSON.stringify(finalCounters)}`)
        }
    }

    // ------------------------------------------------------------------------
    // Public Attribute Mapping Methods
    // ------------------------------------------------------------------------

    /**
     * Maps attributes from source accounts to the fusion account.
     * Processes source attributes in the established source order if refresh is needed,
     * using the current attribute bag as a default. For identity-type accounts, returns
     * immediately without mapping. Ensures fusion account history is preserved and never
     * overwritten by empty arrays from source mapping.
     *
     * @param fusionAccount - The fusion account to map attributes for
     */
    public mapAttributes(fusionAccount: FusionAccount): void {
        const { attributeBag, needsRefresh } = fusionAccount

        // Start with current attributes as default
        const attributes = { ...attributeBag.current }

        if (fusionAccount.type === 'identity') {
            return
        }

        // Use attributeBag.sources directly instead of creating a copy.
        // Ensure all fusionAccount sources have an entry (default to [] if missing).
        const sourceAttributeMap = attributeBag.sources
        const sourceOrder = this.sourceConfigs.map((sc) => sc.name)

        for (const source of fusionAccount.sources) {
            if (!sourceAttributeMap.has(source)) {
                sourceAttributeMap.set(source, [])
            }
        }

        // If refresh is needed, process source attributes in established order
        if ((needsRefresh) && sourceAttributeMap.size > 0) {
            const schemaAttributes = this.schemas.listSchemaAttributeNames()
            for (const attribute of schemaAttributes) {
                // Preserve generated unique values
                if (this.uniqueAttributeNames.has(attribute) && attributeBag.current[attribute] !== undefined) {
                    continue
                }

                const processingConfig = this.attributeMappingConfig.get(attribute)!
                const processedValue = processAttributeMapping(processingConfig, sourceAttributeMap, sourceOrder)

                if (processedValue !== undefined) {
                    attributes[attribute] = processedValue
                    if (attribute === 'history') {
                        const history = processedValue as string[]
                        if (Array.isArray(history) && history.length > 0) {
                            fusionAccount.importHistory(history)
                        }
                    }
                }
            }
        }

        // Ensure fusion account history is never lost: for accounts that have their own audit log
        // (e.g. type 'managed' with setUnmatched), keep it in the bag so output is correct.
        if (fusionAccount.history.length > 0) {
            attributes['history'] = [...fusionAccount.history]
        }

        attributeBag.current = attributes
    }

    // ------------------------------------------------------------------------
    // Public Attribute Refresh Methods
    // ------------------------------------------------------------------------

    /**
     * Refreshes all attribute definitions for a fusion account (normal + unique).
     *
     * @param fusionAccount - The fusion account to refresh attributes for
     */
    public async refreshAllAttributes(fusionAccount: FusionAccount): Promise<void> {
        await this.applyNormalDefinitions(fusionAccount)
        await this.applyUniqueDefinitions(fusionAccount)
    }

    /**
     * Refreshes only normal attribute definitions.
     * Skips processing if the account doesn't need a refresh.
     *
     * @param fusionAccount - The fusion account to refresh normal attributes for
     */
    public async refreshNormalAttributes(fusionAccount: FusionAccount): Promise<void> {
        if (!fusionAccount.needsRefresh && !this.forceAttributeRefresh) return
        this.log.debug(
            `Refreshing normal attributes for account: ${fusionAccount.name} (${fusionAccount.sourceName})`
        )
        await this.applyNormalDefinitions(fusionAccount)
    }

    /**
     * Refreshes only unique attribute definitions.
     * Unique attributes are only generated for new accounts; existing values are preserved
     * unless needsReset is set (e.g. when re-enabling a previously disabled account).
     *
     * Disabling and then re-enabling a Fusion account triggers a full unique attribute
     * reset: the enable operation sets `needsReset = true`, which causes this method to
     * unregister existing values and regenerate them via {@link applyUniqueDefinitions}.
     * This ensures the re-enabled account receives fresh, collision-free unique values
     * (such as usernames) that may have been reassigned while it was disabled.
     *
     * @param fusionAccount - The fusion account to refresh unique attributes for
     */
    public async refreshUniqueAttributes(fusionAccount: FusionAccount): Promise<void> {
        if (!fusionAccount.needsRefresh && !fusionAccount.needsReset) return
        this.log.debug(`Refreshing unique attributes for account: ${fusionAccount.name} (${fusionAccount.sourceName})`)

        if (fusionAccount.needsReset) {
            await this.unregisterUniqueAttributes(fusionAccount)
        }

        await this.applyUniqueDefinitions(fusionAccount)
    }

    /**
     * Process unique attribute values for a fusion account (register or unregister)
     */
    private async processUniqueAttributeValues(
        fusionAccount: FusionAccount,
        operation: 'register' | 'unregister'
    ): Promise<void> {
        const logMessage = operation === 'register' ? 'Registering' : 'Unregistering'
        this.log.debug(`${logMessage} unique attributes for account: ${fusionAccount.nativeIdentity}`)

        for (const def of this.uniqueDefinitions) {
            const value = fusionAccount.attributes[def.name]
            const isEmpty = value === undefined || value === null || value === ''
            const needsReset = fusionAccount.needsReset
            if (isEmpty || needsReset) {
                const valueStr = String(value)
                const lockKey = `unique:${def.name}`
                await this.locks.withLock(lockKey, async () => {
                    const valuesSet = this.getUniqueValues(def.name)
                    if (operation === 'register') {
                        assert(
                            this.uniqueDefinitionByName.has(def.name),
                            `Attribute ${def.name} not found in unique attribute definition config`
                        )
                        valuesSet.add(valueStr)
                    } else {
                        if (valuesSet.delete(valueStr)) {
                            this.log.debug(
                                `Unregistered unique value '${valueStr}' for attribute ${def.name}`
                            )
                        }
                    }
                })
            }
        }
    }

    /**
     * Registers all unique attribute values for a fusion account, preventing them
     * from being assigned to other accounts.
     *
     * @param fusionAccount - The fusion account whose unique values to register
     */
    public async registerUniqueAttributes(fusionAccount: FusionAccount): Promise<void> {
        await this.processUniqueAttributeValues(fusionAccount, 'register')
    }

    /**
     * Unregisters all unique attribute values for a fusion account, releasing them
     * for reassignment. Used when an account is being removed or re-enabled.
     *
     * @param fusionAccount - The fusion account whose unique values to release
     */
    public async unregisterUniqueAttributes(fusionAccount: FusionAccount): Promise<void> {
        await this.processUniqueAttributeValues(fusionAccount, 'unregister')
    }

    // ------------------------------------------------------------------------
    // Public Key Generation Methods
    // ------------------------------------------------------------------------

    /**
     * Generate a simple key for a fusion account.
     *
     * The key is derived from the fusion identity attribute value (typically a unique
     * attribute such as a UUID or generated username). If the attribute is empty and
     * `skipAccountsWithMissingId` is enabled, the method returns `undefined`, which
     * causes {@link FusionService.getISCAccount} to omit the account from the output.
     *
     * This enables a deliberate pattern: generate an intentionally empty identity
     * attribute (via attribute definitions that resolve to an empty string) combined
     * with the "Skip accounts with a missing identifier" processing option to prevent
     * specific managed accounts or identities from producing Fusion accounts.
     *
     * @returns SimpleKeyType if successful, undefined if skipAccountsWithMissingId is enabled and the ID is missing
     */
    public getSimpleKey(fusionAccount: FusionAccount): SimpleKeyType | undefined {
        const { fusionIdentityAttribute } = this.schemas

        const uniqueId = fusionAccount.attributes[fusionIdentityAttribute] as string | undefined

        if (this.skipAccountsWithMissingId && !uniqueId) {
            this.log.warn(
                `Skipping account ${fusionAccount.name} (${fusionAccount.nativeIdentity}): ` +
                `Missing value for fusion identity attribute '${fusionIdentityAttribute}'`
            )
            return undefined
        }

        const finalId = uniqueId ?? fusionAccount.nativeIdentity
        assert(finalId, `Unique ID is required for simple key`)

        return SimpleKey(finalId)
    }

    /**
     * Generate a compound key for a fusion account
     */
    public getCompoundKey(fusionAccount: FusionAccount): CompoundKeyType {
        const { fusionDisplayAttribute } = this.schemas

        const uniqueId = fusionAccount.attributes[COMPOUND_KEY_UNIQUE_ID_ATTRIBUTE] as string
        assert(uniqueId, `Unique ID is required for compound key`)
        const lookupId = (fusionAccount.attributes[fusionDisplayAttribute] as string) ?? uniqueId

        return CompoundKey(lookupId, uniqueId)
    }

    // ------------------------------------------------------------------------
    // Private Configuration Helper Methods
    // ------------------------------------------------------------------------

    private get attributeMappingConfig(): Map<string, AttributeMappingConfig> {
        if (!this._attributeMappingConfig) {
            this._attributeMappingConfig = new Map()
            const schemaAttributes = this.schemas.getSchemaAttributes()
            for (const schemaAttr of schemaAttributes) {
                const attrName = schemaAttr.name!
                this._attributeMappingConfig.set(
                    attrName,
                    buildAttributeMappingConfig(attrName, this.attributeMaps, this.attributeMerge)
                )
            }
        }
        return this._attributeMappingConfig
    }

    /**
     * Check whether an attribute name belongs to a unique definition.
     */
    public isUniqueAttribute(name: string): boolean {
        return this.uniqueAttributeNames.has(name)
    }

    /**
     * Get or create the Set of registered unique values for an attribute.
     * The Set is stored in uniqueValuesByAttribute and shared across attribute definitions.
     */
    private getUniqueValues(attributeName: string): Set<string> {
        let set = this.uniqueValuesByAttribute.get(attributeName)
        if (!set) {
            set = new Set<string>()
            this.uniqueValuesByAttribute.set(attributeName, set)
        }
        return set
    }

    /**
     * Register an array of existing values for a unique attribute.
     * Use when loading existing accounts or bulk-initializing to prevent duplicate value generation.
     *
     * @param attributeName - The attribute name (must match a unique attribute definition)
     * @param values - Array of values to register as already in use
     */
    public registerExistingValues(attributeName: string, values: string[]): void {
        if (values.length === 0) return
        const set = this.getUniqueValues(attributeName)
        for (const v of values) {
            if (v != null && v !== '') {
                set.add(String(v))
            }
        }
        this.log.debug(`Registered ${values.length} existing value(s) for attribute '${attributeName}'`)
    }


    private getStateWrapper(): StateWrapper {
        assert(this.stateWrapper, 'State wrapper is not set')
        return this.stateWrapper!
    }

    // ------------------------------------------------------------------------
    // Private Context Builder Methods
    // ------------------------------------------------------------------------

    /**
     * Build Velocity context from FusionAccount's attributeBag
     * The context includes current attributes plus referenceable objects from attributeBag
     */
    private buildVelocityContext(fusionAccount: FusionAccount): { [key: string]: any } {
        const context: { [key: string]: any } = { ...fusionAccount.attributeBag.current }

        context.identity = fusionAccount.attributeBag.identity
        context.accounts = fusionAccount.attributeBag.accounts
        context.previous = fusionAccount.attributeBag.previous
        context.sources = fusionAccount.attributeBag.sources

        if (fusionAccount.originSource) {
            context.originSource = fusionAccount.originSource
        }

        return context
    }

    // ------------------------------------------------------------------------
    // Private Attribute Generation Methods
    // ------------------------------------------------------------------------

    /**
     * Evaluate template expression and apply transformations
     */
    private evaluateTemplate(definition: AnyDefinition, context: RenderContext, accountName?: string): string | undefined {
        if (!definition.expression) {
            this.log.error(`Expression is required for attribute ${definition.name}`)
            return undefined
        }

        let value = evaluateVelocityTemplate(definition.expression, context, definition.maxLength)
        if (!value) {
            this.log.error(`Failed to evaluate velocity template for attribute ${definition.name}`)
            return undefined
        } else if (value === definition.expression) {
            this.log.error(`Velocity template for attribute ${definition.name} returned the same expression`)
            return undefined
        }

        if (definition.trim) value = value.trim()
        if (definition.case) value = switchCase(value, definition.case)
        if (definition.spaces) value = removeSpaces(value)
        if (definition.normalize) value = normalize(value)

        this.log.debug(`[${accountName}] ${definition.name} = ${value}`)

        return value
    }

    /**
     * Generate a normal attribute value (template evaluation only)
     */
    private async generateNormalAttributeValue(
        definition: NormalAttributeDefinition,
        fusionAccount: FusionAccount,
        context: { [key: string]: any }
    ): Promise<string | undefined> {
        return this.evaluateTemplate(definition, context, fusionAccount.name)
    }

    /**
     * Generate a unique attribute value with uniqueness enforcement.
     *
     * Handles three modes via the same definition type:
     * - `$UUID` in expression: a v4 UUID is generated and injected into the Velocity context
     * - `useIncrementalCounter`: a persistent counter ($counter) increments on every use
     * - Default: collision-based disambiguation appends a non-persistent $counter on collision
     */
    private async generateUniqueAttributeValue(
        definition: UniqueAttributeDefinition,
        fusionAccount: FusionAccount,
        context: { [key: string]: any }
    ): Promise<string | undefined> {
        const lockKey = `unique:${definition.name}`

        return await this.locks.withLock(lockKey, async () => {
            const registeredValues = this.getUniqueValues(definition.name)
            const maxAttempts = this.maxAttempts ?? 100

            if (definition.useIncrementalCounter) {
                return await this.generateWithIncrementalCounter(
                    definition, fusionAccount, context, registeredValues, maxAttempts
                )
            }

            return await this.generateWithCollisionDisambiguation(
                definition, fusionAccount, context, registeredValues, maxAttempts
            )
        })
    }

    /**
     * Incremental counter mode: a persistent counter always increments (like old 'counter' type).
     */
    private async generateWithIncrementalCounter(
        definition: UniqueAttributeDefinition,
        fusionAccount: FusionAccount,
        context: { [key: string]: any },
        registeredValues: Set<string>,
        maxAttempts: number
    ): Promise<string | undefined> {
        const stateWrapper = this.getStateWrapper()
        const counterFn = stateWrapper.getCounter(definition.name)
        const digits = definition.digits ?? 1

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const counterValue = await counterFn()
            context.counter = padNumber(counterValue, digits)

            this.injectUUIDIfNeeded(definition, context)

            const value = this.evaluateTemplate(definition, context, fusionAccount.name)
            if (!value) return undefined

            if (!registeredValues.has(value)) {
                registeredValues.add(value)
                this.log.debug(`Generated unique value (incremental) for attribute ${definition.name}: ${value}`)
                return value
            }

            this.log.debug(`Collision on incremental counter for ${definition.name}, retrying (attempt ${attempt + 1})`)
        }

        this.log.error(`Failed to generate unique value for attribute ${definition.name} after ${maxAttempts} attempts`)
        return undefined
    }

    /**
     * Collision disambiguation mode: first attempt has empty $counter; on collision a
     * non-persistent counter increments (like old 'unique' type).
     */
    private async generateWithCollisionDisambiguation(
        definition: UniqueAttributeDefinition,
        fusionAccount: FusionAccount,
        context: { [key: string]: any },
        registeredValues: Set<string>,
        maxAttempts: number
    ): Promise<string | undefined> {
        const counter = StateWrapper.getCounter()
        const digits = definition.digits ?? 1

        // Ensure expression has $counter for disambiguation fallback
        if (definition.expression && !definition.expression.includes('$counter') && !definition.expression.includes('${counter}')) {
            definition.expression = `${definition.expression}$counter`
        }
        context.counter = ''

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            this.injectUUIDIfNeeded(definition, context)

            const value = this.evaluateTemplate(definition, context, fusionAccount.name)
            if (!value) return undefined

            if (!registeredValues.has(value)) {
                registeredValues.add(value)
                this.log.debug(`Generated unique value for attribute ${definition.name}: ${value}`)
                return value
            }

            this.log.debug(`Value ${value} already exists for unique attribute: ${definition.name}`)
            context.counter = padNumber(counter(), digits)
            this.log.debug(`Regenerating unique attribute: ${definition.name} (attempt ${attempt + 1})`)
        }

        this.log.error(`Failed to generate unique value for attribute ${definition.name} after ${maxAttempts} attempts`)
        return undefined
    }

    /**
     * If the expression references $UUID or ${UUID}, generate a fresh v4 UUID
     * and inject it into the Velocity context.
     */
    private injectUUIDIfNeeded(definition: UniqueAttributeDefinition, context: { [key: string]: any }): void {
        if (definition.expression && (definition.expression.includes('$UUID') || definition.expression.includes('${UUID}'))) {
            context.UUID = uuidv4()
        }
    }

    // ------------------------------------------------------------------------
    // Private Attribute Processing Flow
    // ------------------------------------------------------------------------

    /**
     * Apply normal attribute definitions to a fusion account.
     *
     * Normal definitions are evaluated **before** Fusion matching occurs (during
     * per-account processing in processFusionAccounts / processIdentities). This means
     * their output is available to the scoring/matching engine.
     *
     * Builds the Velocity context once per account and reuses it across all definitions.
     * When an attribute value is generated, it is also set on the shared context so
     * subsequent definitions can reference it. Definition order matters: later normal
     * definitions can reference values produced by earlier ones. Unique definitions
     * (applied separately via {@link applyUniqueDefinitions}) can reference normal
     * attribute values, but normal definitions cannot reference unique attributes
     * because unique evaluation happens after this phase.
     */
    private async applyNormalDefinitions(fusionAccount: FusionAccount): Promise<void> {
        if (this.normalDefinitions.length === 0) return
        const context = this.buildVelocityContext(fusionAccount)

        for (const definition of this.normalDefinitions) {
            try {
                await this.processNormalDefinition(definition, fusionAccount, context)
            } catch (error) {
                this.log.error(
                    `Error generating normal attribute ${definition.name} for account: ${fusionAccount.name} (${fusionAccount.sourceName})`,
                    (error as any).message
                )
            }
        }
    }

    /**
     * Apply unique attribute definitions to a fusion account.
     *
     * Unique definitions are evaluated **after** Fusion matching occurs (in the global
     * refreshUniqueAttributes pass that runs once all accounts have been processed and
     * scored). This ensures that unique value generation has access to normal attribute
     * values populated during the earlier per-account phase.
     *
     * Attribute mapping can be used in conjunction with unique definitions to preload
     * attributes from existing managed accounts, identities, and Fusion accounts into
     * the Velocity context. The unique definition then runs and sets a value guaranteed
     * to be different from any other account or identity.
     *
     * Builds the Velocity context once per account and reuses it across all definitions.
     * Re-throws errors to prevent duplicate values from being silently accepted.
     */
    private async applyUniqueDefinitions(fusionAccount: FusionAccount): Promise<void> {
        if (this.uniqueDefinitions.length === 0) return
        const context = this.buildVelocityContext(fusionAccount)

        for (const definition of this.uniqueDefinitions) {
            try {
                await this.processUniqueDefinition(definition, fusionAccount, context)
            } catch (error) {
                this.log.error(
                    `Error generating unique attribute ${definition.name} for account: ${fusionAccount.name} (${fusionAccount.sourceName})`,
                    (error as any).message
                )
                throw error
            }
        }
    }

    /**
     * Process a single normal attribute definition for an account.
     *
     * Immutability guards for identity-linked accounts:
     * - **nativeIdentity** (fusionIdentityAttribute): skipped entirely to prevent
     *   disconnection between the existing Fusion account and subsequent updates.
     * - **name** (fusionDisplayAttribute): locked to the hosting identity's name to
     *   prevent destruction of the identity linkage.
     *
     * Generated values are written to both the account's attribute bag and the shared
     * Velocity context, making them available to subsequent definitions in the same run.
     */
    private async processNormalDefinition(
        definition: NormalAttributeDefinition,
        fusionAccount: FusionAccount,
        context: { [key: string]: any }
    ): Promise<void> {
        const { name, refresh } = definition
        const { fusionIdentityAttribute, fusionDisplayAttribute } = this.schemas
        const needsRefresh = fusionAccount.needsRefresh || fusionAccount.needsReset || refresh
        const hasValue = isValidAttributeValue(fusionAccount.attributes[name])

        if (hasValue && !needsRefresh) {
            return
        }

        if (fusionAccount.isIdentity) {
            if (name === fusionIdentityAttribute) {
                this.log.warn(`Skipping change of nativeIdentity for account: ${fusionAccount.name}`)
                return
            }

            if (name === fusionDisplayAttribute) {
                this.log.warn(`Setting identity name for attribute: ${name} for account: ${fusionAccount.name}`)
                fusionAccount.attributes[name] = fusionAccount.name!
                return
            }
        }

        const value = await this.generateNormalAttributeValue(definition, fusionAccount, context)

        if (value !== undefined) {
            fusionAccount.attributes[name] = value
            context[name] = value
        }
    }

    /**
     * Process a single unique attribute definition for an account.
     *
     * Existing unique values are preserved unless `needsReset` is set (triggered by
     * re-enabling a disabled account). This prevents accidental regeneration of stable
     * identifiers. Use regular unique attribute schemas to define changeable attributes
     * (e.g. usernames) that should be regenerated on enable/disable cycles.
     *
     * Immutability guards for identity-linked accounts:
     * - **nativeIdentity** (fusionIdentityAttribute): skipped entirely to prevent
     *   disconnection between the existing Fusion account and subsequent updates.
     * - **name** (fusionDisplayAttribute): locked to the hosting identity's name to
     *   prevent destruction of the identity linkage.
     *
     * Generated values are written to both the account's attribute bag and the shared
     * Velocity context, making them available to subsequent unique definitions.
     */
    private async processUniqueDefinition(
        definition: UniqueAttributeDefinition,
        fusionAccount: FusionAccount,
        context: { [key: string]: any }
    ): Promise<void> {
        const { name } = definition
        const needsReset = fusionAccount.needsReset
        const hasValue = isValidAttributeValue(fusionAccount.attributes[name])
        const { fusionIdentityAttribute, fusionDisplayAttribute } = this.schemas

        // Preserve existing unique values unless reset is requested
        if (hasValue && !needsReset) {
            const existingValue = String(fusionAccount.attributes[name])
            if (existingValue) {
                this.getUniqueValues(name).add(existingValue)
            }
            return
        }

        if (fusionAccount.isIdentity) {
            if (name === fusionIdentityAttribute) {
                this.log.warn(`Skipping change of nativeIdentity for account: ${fusionAccount.name}`)
                return
            }

            if (name === fusionDisplayAttribute) {
                this.log.warn(`Setting identity name for attribute: ${name} for account: ${fusionAccount.name}`)
                fusionAccount.attributes[name] = fusionAccount.name!
                return
            }
        }

        const value = await this.generateUniqueAttributeValue(definition, fusionAccount, context)

        if (value !== undefined) {
            fusionAccount.attributes[name] = value
            context[name] = value
        }
    }
}
