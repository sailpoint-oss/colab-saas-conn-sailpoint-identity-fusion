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
import { SourcesV2025ApiUpdateSourceRequest } from 'sailpoint-api-client'
import { SourceService } from '../sourceService'
import { COMPOUND_KEY_UNIQUE_ID_ATTRIBUTE, FUSION_STATE_CONFIG_PATH } from './constants'
import { AttributeMappingConfig } from './types'
import { isUniqueAttribute, processAttributeMapping, buildAttributeMappingConfig } from './helpers'
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
    private stateWrapper?: StateWrapper
    private forceAttributeRefresh: boolean
    private readonly attributeMaps?: AttributeMap[]
    private readonly attributeMerge: 'first' | 'list' | 'concatenate'
    private readonly sourceConfigs: SourceConfig[]
    private readonly maxAttempts?: number

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------

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
        this.forceAttributeRefresh = config.forceAttributeRefresh
        // Clone attribute definitions into an internal array so we never touch
        // config.attributeDefinitions after construction, and always have a values Set.
        this.attributeDefinitionConfig =
            config.attributeDefinitions?.map((x) => ({
                ...x,
                values: new Set<string>(),
            })) ?? []

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
                    op: 'replace',
                    path: FUSION_STATE_CONFIG_PATH,
                    value: stateObject,
                },
            ],
        }
        await this.sourceService.patchSourceConfig(fusionSourceId, requestParameters)
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
     * Set state wrapper for counter-based attributes
     * Injects lock service for thread-safe counter operations in parallel processing
     */
    public setStateWrapper(state: any): void {
        this.stateWrapper = new StateWrapper(state, this.locks)
    }

    public enableAttributeRefresh(): void {
        this.forceAttributeRefresh = true
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
     * Map attributes from source accounts to fusion account
     * Processes _sourceAttributeMap in established source order if refresh is needed,
     * using _previousAttributes as default.
     * Uses schema attributes merged with attributeMaps to determine processing configuration.
     */
    public mapAttributes(fusionAccount: FusionAccount): void {
        const { attributeBag, needsRefresh } = fusionAccount

        // Start with current attributes as default
        const attributes = { ...attributeBag.current }

        if (fusionAccount.type === 'identity') {
            return
        }

        const sourceAttributeMap = new Map(attributeBag.sources.entries())
        const sourceOrder = this.sourceConfigs.map((sc) => sc.name)

        for (const source of fusionAccount.sources) {
            sourceAttributeMap.set(source, attributeBag.sources.get(source) ?? [])
        }

        // If refresh is needed, process source attributes in established order
        if ((needsRefresh || this.forceAttributeRefresh) && sourceAttributeMap.size > 0) {
            const schemaAttributes = this.schemas.listSchemaAttributeNames()
            // Process each schema attribute
            for (const attribute of schemaAttributes) {
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
     * Refresh all attributes for a fusion account
     */
    public async refreshAttributes(fusionAccount: FusionAccount, force: boolean = false): Promise<void> {
        const allDefinitions = this.attributeDefinitionConfig
        if (force) {
            await this.unregisterUniqueAttributes(fusionAccount)
            allDefinitions.forEach((def) => {
                delete fusionAccount.attributes[def.name]
            })
        }
        await this._refreshAttributes(fusionAccount, allDefinitions)
    }

    /**
     * Refresh non-unique attributes for a fusion account
     */
    public async refreshNonUniqueAttributes(fusionAccount: FusionAccount): Promise<void> {
        if (!fusionAccount.needsRefresh && !this.forceAttributeRefresh) return
        this.log.debug(
            `Refreshing non-unique attributes for account: ${fusionAccount.name} (${fusionAccount.sourceName})`
        )

        const allDefinitions = this.attributeDefinitionConfig
        const nonUniqueAttributeDefinitions = allDefinitions.filter((x) => !isUniqueAttribute(x))

        await this._refreshAttributes(fusionAccount, nonUniqueAttributeDefinitions)
    }

    /**
     * Refresh unique attributes for a fusion account
     * Unique attributes (including counter) should only be generated for new accounts.
     * For existing accounts, shouldSkipAttributeGeneration will skip generation if the attribute already exists.
     */
    public async refreshUniqueAttributes(fusionAccount: FusionAccount): Promise<void> {
        if (!fusionAccount.needsRefresh && !this.forceAttributeRefresh) return
        this.log.debug(`Refreshing unique attributes for account: ${fusionAccount.name} (${fusionAccount.sourceName})`)

        const allDefinitions = this.attributeDefinitionConfig
        const uniqueAttributeDefinitions = allDefinitions.filter(isUniqueAttribute)
        uniqueAttributeDefinitions.forEach((def) => {
            def.refresh = true
        })

        await this._refreshAttributes(fusionAccount, uniqueAttributeDefinitions)
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
            if (value !== undefined && value !== null && value !== '') {
                const valueStr = String(value)
                const lockKey = `${def.type}:${def.name}`
                await this.locks.withLock(lockKey, async () => {
                    const defConfig = this.getAttributeDefinition(def.name)
                    if (!defConfig || !defConfig.values) {
                        return
                    }
                    if (operation === 'register') {
                        assert(defConfig, `Attribute ${def.name} not found in attribute definition config`)
                        defConfig.values.add(valueStr)
                    } else {
                        if (defConfig.values.delete(valueStr)) {
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
     * Register unique attribute values for a fusion account
     */
    public async registerUniqueAttributes(fusionAccount: FusionAccount): Promise<void> {
        await this.processUniqueAttributes(fusionAccount, 'register')
    }

    /**
     * Unregister unique attribute values for a fusion account
     * (used when a fusion account is being removed or its unique values should no longer be reserved)
     */
    public async unregisterUniqueAttributes(fusionAccount: FusionAccount): Promise<void> {
        await this.processUniqueAttributes(fusionAccount, 'unregister')
    }

    // ------------------------------------------------------------------------
    // Public Key Generation Methods
    // ------------------------------------------------------------------------

    /**
     * Generate a simple key for a fusion account
     */
    public getSimpleKey(fusionAccount: FusionAccount): SimpleKeyType {
        const { fusionIdentityAttribute } = this.schemas
        const uniqueId = (fusionAccount.attributes[fusionIdentityAttribute] as string) ?? fusionAccount.nativeIdentity
        assert(uniqueId, `Unique ID is required for simple key`)

        return SimpleKey(uniqueId)
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
        return this.attributeDefinitionConfig.find((d) => d.name === name)
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

        return context
    }

    // ------------------------------------------------------------------------
    // Private Attribute Generation Methods
    // ------------------------------------------------------------------------

    /**
     * Generate attribute value by evaluating the template expression
     */
    private generateAttributeValue(definition: AttributeDefinition, attributes: RenderContext): string | undefined {
        if (!definition.expression) {
            this.log.error(`Expression is required for attribute ${definition.name}`)
            return undefined
        }

        let value = evaluateVelocityTemplate(definition.expression, attributes, definition.maxLength)
        if (value) {
            this.log.debug(`Template evaluation result - attributeName: ${definition.name}, rawValue: ${value}`)

            if (definition.case) {
                value = switchCase(value, definition.case)
            }
            if (definition.spaces) {
                value = removeSpaces(value)
            }
            if (definition.normalize) {
                value = normalize(value)
            }
            this.log.debug(
                `Final attribute value after transformations - attributeName: ${definition.name}, finalValue: ${value}, transformations: case=${definition.case}, spaces=${definition.spaces}, normalize=${definition.normalize}`
            )
        } else {
            this.log.error(`Failed to evaluate velocity template for attribute ${definition.name}`)
            return undefined
        }

        return value
    }

    /**
     * Generate a normal attribute value from a definition
     */
    private async generateNormalAttribute(
        definition: AttributeDefinition,
        fusionAccount: FusionAccount
    ): Promise<string | undefined> {
        const context = this.buildVelocityContext(fusionAccount)
        return this.generateAttributeValue(definition, context)
    }

    /**
     * Generate a counter-based attribute value
     * Counters are initialized in accountList via initializeCounters() before use
     */
    private async generateCounterAttribute(
        definition: AttributeDefinition,
        fusionAccount: FusionAccount
    ): Promise<string | undefined> {
        const stateWrapper = this.getStateWrapper()
        const context = this.buildVelocityContext(fusionAccount)
        const counterFn = stateWrapper.getCounter(definition.name)
        const digits = definition.digits ?? 1
        const counterValue = await counterFn()
        context.counter = padNumber(counterValue, digits)

        // Counter attributes don't need uniqueness checking, just generate the value
        return this.generateAttributeValue(definition, context)
    }

    /**
     * Generate a unique attribute value with thread-safe generation and registration
     * The entire process (fetch values -> generate -> check -> register) is protected by a lock
     */
    private async generateUniqueAttribute(
        definition: AttributeDefinition,
        fusionAccount: FusionAccount
    ): Promise<string | undefined> {
        const context = this.buildVelocityContext(fusionAccount)
        const lockKey = `${definition.type}:${definition.name}`
        return await this.locks.withLock(lockKey, async () => {
            return this.generateUniqueValueWithCounter(definition, context)
        })
    }

    /**
     * Generate a unique value by iterating with a counter until uniqueness is achieved
     */
    private generateUniqueValueWithCounter(
        definition: AttributeDefinition,
        context: RenderContext
    ): string | undefined {
        const registeredValues = definition.values!
        const counter = StateWrapper.getCounter()
        const maxAttempts = this.maxAttempts ?? 100

        this.ensureExpressionHasCounter(definition)
        context.counter = ''

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const generatedValue = this.generateAttributeValue(definition, context)
            if (!generatedValue) {
                return undefined
            }

            if (this.isValueUnique(generatedValue, registeredValues, definition.name)) {
                registeredValues.add(generatedValue)
                this.log.debug(
                    `Generated and registered unique value for attribute ${definition.name}: ${generatedValue}`
                )
                return generatedValue
            }

            // Value exists - increment counter and try again
            this.incrementCounterForNextAttempt(definition, context, counter, attempt + 1)
        }

        this.log.error(
            `Failed to generate unique value for attribute ${definition.name} after ${maxAttempts} attempts`
        )
        return undefined
    }

    /**
     * Ensure the attribute definition expression includes a counter variable
     */
    private ensureExpressionHasCounter(definition: AttributeDefinition): void {
        if (!definition.expression) {
            return
        }
        const hasCounter =
            definition.expression.includes('$counter') || definition.expression.includes('${counter}')
        if (!hasCounter) {
            definition.expression = `${definition.expression}$counter`
        }
    }

    /**
     * Check if a value is unique against registered values
     */
    private isValueUnique(value: string, registeredValues: Set<string>, attributeName: string): boolean {
        if (!registeredValues.has(value)) {
            return true
        }
        // Value already exists - log for debugging
        this.log.debug(`Value ${value} already exists for unique attribute: ${attributeName}`)
        return false
    }

    /**
     * Increment the counter in context for the next generation attempt
     */
    private incrementCounterForNextAttempt(
        definition: AttributeDefinition,
        context: RenderContext,
        counter: () => number,
        attemptNumber: number
    ): void {
        const digits = definition.digits ?? 1
        const counterValue = counter()
        context.counter = padNumber(counterValue, digits)
        this.log.debug(
            `Regenerating unique attribute: ${definition.name} (attempt ${attemptNumber})`
        )
    }

    /**
     * Generate a UUID attribute value with thread-safe generation and registration
     * UUIDs don't use counters - just keep generating new UUIDs until we find one that's unique
     * The entire process (fetch values -> generate -> check -> register) is protected by a lock
     */
    private async generateUUIDAttribute(definition: AttributeDefinition): Promise<string | undefined> {
        const lockKey = `${definition.type}:${definition.name}`
        return await this.locks.withLock(lockKey, async () => {
            return this.generateUniqueUUID(definition)
        })
    }

    /**
     * Generate a unique UUID by iterating until uniqueness is achieved
     */
    private generateUniqueUUID(definition: AttributeDefinition): string | undefined {
        const registeredValues = definition.values!
        const maxAttempts = this.maxAttempts ?? 100

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const generatedValue = uuidv4()
            if (!generatedValue) {
                return undefined
            }

            if (!registeredValues.has(generatedValue)) {
                registeredValues.add(generatedValue)
                this.log.debug(
                    `Generated and registered uuid value for attribute ${definition.name}: ${generatedValue}`
                )
                return generatedValue
            }

            // UUID collision detected (extremely rare) - regenerate
            this.log.debug(
                `UUID collision detected for attribute ${definition.name}, regenerating (attempt ${attempt}): ${generatedValue}`
            )
        }

        this.log.error(
            `Failed to generate unique uuid value for attribute ${definition.name} after ${maxAttempts} attempts`
        )
        return undefined
    }

    // ------------------------------------------------------------------------
    // Private Attribute Generation Orchestration
    // ------------------------------------------------------------------------

    /**
     * Generate attribute value for a single attribute definition and update fusionAccount.attributeBag.current
     * For unique/uuid attributes, the entire generation process (fetch values, generate, check, register) is protected by a lock
     */
    private async generateAttribute(definition: AttributeDefinition, fusionAccount: FusionAccount): Promise<void> {
        const { name, refresh } = definition

        if (this.shouldSkipAttributeGeneration(name, refresh, fusionAccount)) {
            return
        }

        const adjustedDefinition = this.adjustDefinitionForContext(definition, fusionAccount)
        if (!adjustedDefinition) {
            return // Early return handled in adjustDefinitionForContext
        }

        const value = await this.generateAttributeByType(adjustedDefinition, fusionAccount)

        if (value !== undefined) {
            fusionAccount.attributes[name] = value
        }
    }

    /**
     * Check if attribute generation should be skipped
     */
    private shouldSkipAttributeGeneration(
        attributeName: string,
        refresh: boolean | undefined,
        fusionAccount: FusionAccount
    ): boolean {
        // If forceAttributeRefresh is enabled, never skip generation
        if (this.forceAttributeRefresh) {
            return false
        }

        const hasAttribute = fusionAccount.attributes[attributeName] !== undefined

        return !!(hasAttribute && !refresh)
    }

    /**
     * Adjust attribute definition based on context (command type, special attributes)
     */
    private adjustDefinitionForContext(
        definition: AttributeDefinition,
        fusionAccount: FusionAccount
    ): AttributeDefinition | null {
        const { name } = definition
        const { fusionIdentityAttribute, fusionDisplayAttribute } = this.schemas
        const isAccountList = this.commandType === StandardCommand.StdAccountList

        // Handle special case for display attribute
        if (name === fusionDisplayAttribute && isUniqueAttribute(definition) && !isAccountList) {
            fusionAccount.attributes[name] = fusionAccount.name!
            return null // Signal to skip further processing
        }

        // Handle special case for identity attribute - convert to UUID
        if (name === fusionIdentityAttribute && isUniqueAttribute(definition) && !isAccountList) {
            return {
                name,
                type: 'uuid',
                normalize: false,
                spaces: false,
                refresh: false,
            }
        }

        return definition
    }

    /**
     * Generate attribute value based on its type
     */
    private async generateAttributeByType(
        definition: AttributeDefinition,
        fusionAccount: FusionAccount
    ): Promise<string | undefined> {
        switch (definition.type) {
            case 'counter':
                return await this.generateCounterAttribute(definition, fusionAccount)
            case 'unique':
                return await this.generateUniqueAttribute(definition, fusionAccount)
            case 'uuid':
                return await this.generateUUIDAttribute(definition)
            default:
                return await this.generateNormalAttribute(definition, fusionAccount)
        }
    }

    /**
     * Refresh attributes for a fusion account based on the provided definitions
     */
    private async _refreshAttributes(
        fusionAccount: FusionAccount,
        attributeDefinitions: AttributeDefinition[]
    ): Promise<void> {
        // Generate each attribute definition
        for (const definition of attributeDefinitions) {
            try {
                await this.generateAttribute(definition, fusionAccount)
            } catch (error) {
                this.log.error(`Error generating attribute ${definition.name} for account: ${fusionAccount.name} (${fusionAccount.sourceName})`, (error as any).message)
                if (isUniqueAttribute(definition)) {
                    throw error
                }
            }
        }
    }
}
