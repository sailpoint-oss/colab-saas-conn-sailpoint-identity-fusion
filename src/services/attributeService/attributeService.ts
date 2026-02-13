import { FusionConfig, AttributeMap, AttributeDefinition, SourceConfig } from '../../model/config'
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
import { isUniqueAttribute, processAttributeMapping, buildAttributeMappingConfig } from './helpers'
import { isValidAttributeValue } from '../../utils/attributes'
import { StateWrapper } from './stateWrapper'

// ============================================================================
// AttributeService Class
// ============================================================================

/**
 * Service for attribute mapping, attribute definition, and UUID management.
 * Combines functionality for mapping attributes from source accounts and generating unique IDs.
 */
export class AttributeService {
    private _attributeMappingConfig?: Map<string, AttributeMappingConfig>
    private attributeDefinitionConfig: AttributeDefinition[] = []
    // Map of attribute name -> Set of registered unique values (shared; attributeDefinitionConfig references these)
    private uniqueValuesByAttribute: Map<string, Set<string>> = new Map()
    // O(1) lookup index for attribute definitions by name (built in constructor)
    private attributeDefinitionByName: Map<string, AttributeDefinition> = new Map()
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
        // Clone attribute definitions into an internal array so we never touch
        // config.attributeDefinitions after construction. Unique values are stored in uniqueValuesByAttribute.
        this.attributeDefinitionConfig = config.attributeDefinitions ? [...config.attributeDefinitions] : []

        // Build O(1) lookup index for getAttributeDefinition
        this.attributeDefinitionByName = new Map(
            this.attributeDefinitionConfig.map((d) => [d.name, d])
        )

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
        // Wait for all pending counter increments to complete before reading state
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
     * Initialize all counter-based attributes from configuration
     * Should be called once after setStateWrapper to ensure all counters are initialized
     */
    public async initializeCounters(): Promise<void> {
        const stateWrapper = this.getStateWrapper()
        const counterDefinitions = this.attributeDefinitionConfig.filter((def) => def.type === 'counter')

        if (counterDefinitions.length === 0) {
            return
        }

        if (this.log) {
            this.log.debug(`Initializing ${counterDefinitions.length} counter-based attributes`)
            // Log existing counter values before initialization
            const existingCounters = Object.fromEntries(
                Array.from(stateWrapper.state.entries()).filter(([key]) =>
                    counterDefinitions.some((def) => def.name === key)
                )
            )
            if (Object.keys(existingCounters).length > 0) {
                this.log.debug(`Preserving existing counter values: ${JSON.stringify(existingCounters)}`)
            }
        }

        // Initialize all counters in parallel (each initCounter handles its own locking)
        await Promise.all(
            counterDefinitions.map((def) => {
                const start = def.counterStart ?? 1
                return stateWrapper.initCounter(def.name, start)
            })
        )

        if (this.log) {
            // Log final counter values after initialization
            const finalCounters: { [key: string]: number } = {}
            counterDefinitions.forEach((def) => {
                const value = stateWrapper.state.get(def.name)
                if (value !== undefined) {
                    finalCounters[def.name] = value
                }
            })
            this.log.debug(`All counter-based attributes initialized. Current values: ${JSON.stringify(finalCounters)}`)
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
            // Process each schema attribute
            for (const attribute of schemaAttributes) {
                // Skip mapping for attributes that overlap with isUnique attribute definitions
                // when there's an existing current value (preserve generated unique values)
                const definition = this.getAttributeDefinition(attribute)
                if (definition && isUniqueAttribute(definition) && attributeBag.current[attribute] !== undefined) {
                    continue
                }

                // Build processing configuration (merges schema with attributeMaps)
                const processingConfig = this.attributeMappingConfig.get(attribute)!

                // Process the attribute based on its configuration
                const processedValue = processAttributeMapping(processingConfig, sourceAttributeMap, sourceOrder)

                // Set the processed value if found
                if (processedValue !== undefined) {
                    attributes[attribute] = processedValue
                    if (attribute === 'history') {
                        const history = processedValue as string[]
                        // Only overwrite fusion account _history when we have actual content from sources.
                        // Empty array would wipe fusion audit log (e.g. "Set X as unmatched").
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

        // Set the mapped attributes
        attributeBag.current = attributes
    }

    // ------------------------------------------------------------------------
    // Public Attribute Refresh Methods
    // ------------------------------------------------------------------------

    /**
     * Refreshes all attribute definitions for a fusion account.
     *
     * @param fusionAccount - The fusion account to refresh attributes for
     */
    public async refreshAllAttributes(fusionAccount: FusionAccount): Promise<void> {
        const allDefinitions = this.attributeDefinitionConfig
        await this.applyAttributeDefinitions(fusionAccount, allDefinitions)
    }

    /**
     * Refreshes only non-unique attribute definitions (normal type).
     * Skips processing if the account doesn't need a refresh.
     *
     * @param fusionAccount - The fusion account to refresh non-unique attributes for
     */
    public async refreshNonUniqueAttributes(fusionAccount: FusionAccount): Promise<void> {
        if (!fusionAccount.needsRefresh && !this.forceAttributeRefresh) return
        this.log.debug(
            `Refreshing non-unique attributes for account: ${fusionAccount.name} (${fusionAccount.sourceName})`
        )

        const allDefinitions = this.attributeDefinitionConfig
        const nonUniqueAttributeDefinitions = allDefinitions.filter((x) => !isUniqueAttribute(x))

        await this.applyAttributeDefinitions(fusionAccount, nonUniqueAttributeDefinitions)
    }

    /**
     * Refreshes only unique attribute definitions (unique, uuid, counter types).
     * Unique attributes are only generated for new accounts; existing values are preserved
     * unless needsReset is set.
     *
     * @param fusionAccount - The fusion account to refresh unique attributes for
     */
    public async refreshUniqueAttributes(fusionAccount: FusionAccount): Promise<void> {
        if (!fusionAccount.needsRefresh && !fusionAccount.needsReset) return
        this.log.debug(`Refreshing unique attributes for account: ${fusionAccount.name} (${fusionAccount.sourceName})`)

        const allDefinitions = this.attributeDefinitionConfig
        const uniqueAttributeDefinitions = allDefinitions.filter(isUniqueAttribute)
        if (fusionAccount.needsReset) {
            await this.unregisterUniqueAttributes(fusionAccount)
        }

        await this.applyAttributeDefinitions(fusionAccount, uniqueAttributeDefinitions)
    }

    /**
     * Process unique attribute values for a fusion account (register or unregister)
     */
    private async processUniqueAttributes(
        fusionAccount: FusionAccount,
        operation: 'register' | 'unregister'
    ): Promise<void> {
        const logMessage = operation === 'register' ? 'Registering' : 'Unregistering'
        this.log.debug(`${logMessage} unique attributes for account: ${fusionAccount.nativeIdentity}`)

        const uniqueDefinitions = this.attributeDefinitionConfig.filter(
            (def) => def.type === 'unique' || def.type === 'uuid'
        )

        for (const def of uniqueDefinitions) {
            const value = fusionAccount.attributes[def.name]
            const isEmpty = value === undefined || value === null || value === ''
            const needsReset = fusionAccount.needsReset
            if (isEmpty || needsReset) {
                const valueStr = String(value)
                const lockKey = `${def.type}:${def.name}`
                await this.locks.withLock(lockKey, async () => {
                    const valuesSet = this.getUniqueValues(def.name)
                    if (operation === 'register') {
                        assert(this.getAttributeDefinition(def.name), `Attribute ${def.name} not found in attribute definition config`)
                        valuesSet.add(valueStr)
                    } else {
                        if (valuesSet.delete(valueStr)) {
                            this.log.debug(
                                `Unregistered unique value '${valueStr}' for attribute ${def.name} (type=${def.type})`
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
        await this.processUniqueAttributes(fusionAccount, 'register')
    }

    /**
     * Unregisters all unique attribute values for a fusion account, releasing them
     * for reassignment. Used when an account is being removed or re-enabled.
     *
     * @param fusionAccount - The fusion account whose unique values to release
     */
    public async unregisterUniqueAttributes(fusionAccount: FusionAccount): Promise<void> {
        await this.processUniqueAttributes(fusionAccount, 'unregister')
    }

    // ------------------------------------------------------------------------
    // Public Key Generation Methods
    // ------------------------------------------------------------------------

    /**
     * Generate a simple key for a fusion account
     * @returns SimpleKeyType if successful, undefined if skipAccountsWithMissingId is enabled and the ID is missing
     */
    public getSimpleKey(fusionAccount: FusionAccount): SimpleKeyType | undefined {
        const { fusionIdentityAttribute } = this.schemas

        const uniqueId = fusionAccount.attributes[fusionIdentityAttribute] as string | undefined

        // If skipAccountsWithMissingId is enabled and the unique ID is missing, return undefined
        if (this.skipAccountsWithMissingId && !uniqueId) {
            this.log.warn(
                `Skipping account ${fusionAccount.name} (${fusionAccount.nativeIdentity}): ` +
                `Missing value for fusion identity attribute '${fusionIdentityAttribute}'`
            )
            return undefined
        }

        // Default behavior: fall back to nativeIdentity if fusionIdentityAttribute is not present
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

    private getAttributeDefinition(name: string): AttributeDefinition | undefined {
        return this.attributeDefinitionByName.get(name)
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
     * Register an array of existing values for a unique/uuid attribute.
     * Use when loading existing accounts or bulk-initializing to prevent duplicate value generation.
     *
     * @param attributeName - The attribute name (must match an attribute definition)
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
        // Start with current attributes - these are directly available in Velocity context
        const context: { [key: string]: any } = { ...fusionAccount.attributeBag.current }

        // Add referenceable objects from attributeBag
        context.identity = fusionAccount.attributeBag.identity
        context.accounts = fusionAccount.attributeBag.accounts
        context.previous = fusionAccount.attributeBag.previous
        context.sources = fusionAccount.attributeBag.sources

        // Ensure originSource is always available in Velocity context even for new accounts
        // (syncCollectionAttributesToBag runs after attribute definitions are evaluated)
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
    private evaluateTemplate(definition: AttributeDefinition, context: RenderContext, accountName?: string): string | undefined {
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

        // Apply transformations
        if (definition.trim) value = value.trim()
        if (definition.case) value = switchCase(value, definition.case)
        if (definition.spaces) value = removeSpaces(value)
        if (definition.normalize) value = normalize(value)

        this.log.debug(`[${accountName}] ${definition.name} = ${value}`)

        return value
    }

    /**
     * Generate a normal attribute value
     */
    private async generateNormalAttribute(
        definition: AttributeDefinition,
        fusionAccount: FusionAccount,
        context: { [key: string]: any }
    ): Promise<string | undefined> {
        return this.evaluateTemplate(definition, context, fusionAccount.name)
    }

    /**
     * Generate a counter-based attribute value
     */
    private async generateCounterAttribute(
        definition: AttributeDefinition,
        fusionAccount: FusionAccount,
        context: { [key: string]: any }
    ): Promise<string | undefined> {
        const stateWrapper = this.getStateWrapper()
        const counterFn = stateWrapper.getCounter(definition.name)
        const digits = definition.digits ?? 1
        const counterValue = await counterFn()
        context.counter = padNumber(counterValue, digits)

        return this.evaluateTemplate(definition, context, fusionAccount.name)
    }

    /**
     * Generate a unique attribute value with retry logic
     */
    private async generateUniqueAttribute(
        definition: AttributeDefinition,
        fusionAccount: FusionAccount,
        context: { [key: string]: any }
    ): Promise<string | undefined> {
        const lockKey = `${definition.type}:${definition.name}`

        return await this.locks.withLock(lockKey, async () => {
            const registeredValues = this.getUniqueValues(definition.name)
            const counter = StateWrapper.getCounter()
            const maxAttempts = this.maxAttempts ?? 100

            // Ensure expression has counter variable
            if (definition.expression && !definition.expression.includes('$counter') && !definition.expression.includes('${counter}')) {
                definition.expression = `${definition.expression}$counter`
            }
            context.counter = ''

            // Try to generate unique value
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const value = this.evaluateTemplate(definition, context, fusionAccount.name)
                if (!value) return undefined

                // Check uniqueness
                if (!registeredValues.has(value)) {
                    registeredValues.add(value)
                    this.log.debug(`Generated unique value for attribute ${definition.name}: ${value}`)
                    return value
                }

                // Collision - increment counter and retry
                this.log.debug(`Value ${value} already exists for unique attribute: ${definition.name}`)
                const digits = definition.digits ?? 1
                context.counter = padNumber(counter(), digits)
                this.log.debug(`Regenerating unique attribute: ${definition.name} (attempt ${attempt + 1})`)
            }

            this.log.error(`Failed to generate unique value for attribute ${definition.name} after ${maxAttempts} attempts`)
            return undefined
        })
    }

    /**
     * Generate a UUID attribute value
     */
    private async generateUUIDAttribute(definition: AttributeDefinition): Promise<string | undefined> {
        const lockKey = `${definition.type}:${definition.name}`

        return await this.locks.withLock(lockKey, async () => {
            const registeredValues = this.getUniqueValues(definition.name)
            const maxAttempts = this.maxAttempts ?? 100

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const value = uuidv4()
                if (!value) return undefined

                if (!registeredValues.has(value)) {
                    registeredValues.add(value)
                    this.log.debug(`Generated uuid value for attribute ${definition.name}: ${value}`)
                    return value
                }

                // UUID collision (extremely rare)
                this.log.debug(`UUID collision for attribute ${definition.name}, regenerating (attempt ${attempt}): ${value}`)
            }

            this.log.error(`Failed to generate unique uuid for attribute ${definition.name} after ${maxAttempts} attempts`)
            return undefined
        })
    }

    // ------------------------------------------------------------------------
    // Private Attribute Processing Flow
    // ------------------------------------------------------------------------

    /**
     * Apply attribute definitions to a fusion account.
     *
     * Performance Optimization:
     * Builds the Velocity context once per account and reuses it across all attribute
     * definitions. When an attribute value is generated, it is also set on the shared
     * context so subsequent definitions can reference it (preserving the original
     * behavior where each generator saw the latest attributeBag.current).
     * This avoids N spread-copy operations of attributeBag.current (one per definition).
     */
    private async applyAttributeDefinitions(
        fusionAccount: FusionAccount,
        attributeDefinitions: AttributeDefinition[]
    ): Promise<void> {
        // Build context once per account - reused across all definitions
        const context = this.buildVelocityContext(fusionAccount)

        for (const definition of attributeDefinitions) {
            try {
                await this.generateAttributeForAccount(definition, fusionAccount, context)
            } catch (error) {
                this.log.error(
                    `Error generating attribute ${definition.name} for account: ${fusionAccount.name} (${fusionAccount.sourceName})`,
                    (error as any).message
                )
                // Re-throw for unique attributes to prevent duplicate values
                if (isUniqueAttribute(definition)) {
                    throw error
                }
            }
        }
    }

    /**
     * Generate a single attribute for an account
     */
    private async generateAttributeForAccount(
        definition: AttributeDefinition,
        fusionAccount: FusionAccount,
        context: { [key: string]: any }
    ): Promise<void> {
        const { name, refresh } = definition
        const needsRefresh = fusionAccount.needsRefresh || fusionAccount.needsReset || refresh
        const needsReset = fusionAccount.needsReset
        const hasValue = isValidAttributeValue(fusionAccount.attributes[name])
        const isUnique = isUniqueAttribute(definition)

        // Skip if attribute is unique and exists and reset is not requested.
        // Register the existing value so generators know it's taken and avoid collisions.
        if (hasValue && isUnique && !needsReset) {
            const existingValue = String(fusionAccount.attributes[name])
            if (existingValue) {
                this.getUniqueValues(name).add(existingValue)
            }
            return
        }

        // Skip if attribute exists and refresh is not requested
        if (hasValue && !needsRefresh) {
            return
        }

        // Handle special attributes
        const adjustedDef = this.prepareDefinitionForGeneration(definition, fusionAccount)
        if (!adjustedDef) {
            return // Attribute was handled directly
        }

        // Generate value based on type, passing the shared context
        const value = await this.generateValueByType(adjustedDef, fusionAccount, context)

        if (value !== undefined) {
            fusionAccount.attributes[name] = value
            // Keep the shared context in sync so subsequent definitions
            // can reference attributes generated by earlier ones
            context[name] = value
        }
    }

    /**
     * Prepare definition for generation, handling special cases
     */
    private prepareDefinitionForGeneration(
        definition: AttributeDefinition,
        fusionAccount: FusionAccount
    ): AttributeDefinition | null {
        const { name } = definition
        const { fusionIdentityAttribute, fusionDisplayAttribute } = this.schemas
        const isAccountList = this.commandType === StandardCommand.StdAccountList

        // Display attribute: use account name directly (non-list commands only)
        if (name === fusionDisplayAttribute && isUniqueAttribute(definition) && !isAccountList) {
            fusionAccount.attributes[name] = fusionAccount.name!
            return null
        }

        // Identity attribute: force UUID generation (non-list commands only)
        if (name === fusionIdentityAttribute && isUniqueAttribute(definition) && !isAccountList) {
            return {
                name,
                type: 'uuid',
                normalize: false,
                spaces: false,
                refresh: false,
                trim: false,
            }
        }

        return definition
    }

    /**
     * Generate attribute value based on type
     */
    private async generateValueByType(
        definition: AttributeDefinition,
        fusionAccount: FusionAccount,
        context: { [key: string]: any }
    ): Promise<string | undefined> {
        switch (definition.type) {
            case 'counter':
                return await this.generateCounterAttribute(definition, fusionAccount, context)
            case 'unique':
                return await this.generateUniqueAttribute(definition, fusionAccount, context)
            case 'uuid':
                return await this.generateUUIDAttribute(definition)
            default:
                return await this.generateNormalAttribute(definition, fusionAccount, context)
        }
    }
}
