import { AccountSchema, Attributes, SchemaAttribute } from '@sailpoint/connector-sdk'
import { AttributeMap, FusionConfig, AttributeDefinition } from '../../model/config'
import { LogService } from '../logService'
import { SourceService } from '../sourceService'
import { assert } from '../../utils/assert'
import { fusionAccountSchemaAttributes } from '../../data/schema'
import { isAccountSchema, apiSchemaToAccountSchema } from './helpers'

/**
 * Service for managing account schema, dynamic schema building.
 */
export class SchemaService {
    private _fusionAccountSchema?: AccountSchema
    private attributeMap: Map<string, AttributeMap> = new Map()
    private _fusionSchemaAttributeNames: string[] = []
    private _fusionSchemaAttributeMap: Map<string, SchemaAttribute> = new Map()
    private readonly attributeMerge: 'first' | 'list' | 'concatenate'
    private readonly attributeDefinitions?: AttributeDefinition[] // Local type from config

    /**
     * @param config - Fusion configuration containing attribute merge strategy and definitions
     * @param log - Logger instance
     * @param sources - Source service for fetching source schemas
     */
    constructor(
        config: FusionConfig,
        private log: LogService,
        private sources: SourceService
    ) {
        this.attributeMerge = config.attributeMerge
        this.attributeDefinitions = config.attributeDefinitions
        this.attributeMap = new Map(config.attributeMaps?.map((x) => [x.newAttribute, x]) ?? [])
    }

    /**
     * Filters an attribute bag down to only the attributes defined in the fusion account schema,
     * casting each value to match its schema-defined type and cardinality.
     *
     * @param attributes - The full attribute bag to filter, or null
     * @returns A new object containing only schema-defined attributes with properly cast values
     */
    public getFusionAttributeSubset(attributes: Attributes | null): Attributes {
        if (!attributes) return {}

        const fusionAttributes: Attributes = {}
        for (const attribute of this._fusionSchemaAttributeNames) {
            const value = attributes?.[attribute]
            const schemaDef = this._fusionSchemaAttributeMap.get(attribute)
            fusionAttributes[attribute] = schemaDef ? this.castAttributeValue(value, schemaDef) : value
        }
        return fusionAttributes
    }

    /**
     * Cast an attribute value to match its schema-defined type and cardinality.
     * - For single-valued attributes (`multi` is false/undefined): arrays are joined with ", ".
     * - For multi-valued attributes (`multi` is true): scalar values are wrapped in an array.
     * - Values are cast to the target type (`string`, `boolean`, `int`/`long`).
     */
    private castAttributeValue(
        value: boolean | string | string[] | number | number[] | null | undefined,
        schemaDef: SchemaAttribute
    ): boolean | string | string[] | number | number[] | null {
        if (value === null || value === undefined) return null

        const isMulti = schemaDef.multi === true
        const type = (schemaDef.type ?? 'string').toLowerCase()

        if (isMulti) {
            // Multi-valued: ensure the value is an array, then cast each element
            const arr = Array.isArray(value) ? value : [value]
            return arr.map((v) => this.castScalar(v, type)) as string[] | number[]
        } else {
            // Single-valued: if value is an array, join it into a string
            const scalar = Array.isArray(value) ? value.join(', ') : value
            return this.castScalar(scalar, type)
        }
    }

    /**
     * Cast a single scalar value to the target schema type.
     */
    private castScalar(value: boolean | string | number, type: string): boolean | string | number {
        switch (type) {
            case 'boolean':
                if (typeof value === 'boolean') return value
                if (typeof value === 'string') return value.toLowerCase() === 'true'
                return value !== 0
            case 'int':
            case 'long':
                if (typeof value === 'number') return value
                if (typeof value === 'boolean') return value ? 1 : 0
                const num = Number(value)
                return isNaN(num) ? 0 : num
            case 'string':
            default:
                return String(value)
        }
    }

    /** Fetches the fusion account schema from the fusion source via the API. */
    private async fetchFusionAccountSchema(): Promise<void> {
        this._fusionAccountSchema = await this.fetchAccountSchema(this.sources.fusionSourceId!)
    }

    /** The identity attribute name from the fusion account schema (e.g. "id"). */
    public get fusionIdentityAttribute(): string {
        return this.fusionAccountSchema.identityAttribute
    }

    /** The display attribute name from the fusion account schema (e.g. "name"). */
    public get fusionDisplayAttribute(): string {
        return this.fusionAccountSchema.displayAttribute
    }

    /** Base fusion attribute names that must always be included in the subset (e.g. reviews for reviewers). */
    private static readonly BASE_FUSION_ATTRIBUTE_NAMES = fusionAccountSchemaAttributes.map((a) => a.name!).filter(Boolean)

    /**
     * Sets the fusion account schema, either from a provided schema object or by
     * fetching it from the fusion source. Also builds internal lookup maps for
     * attribute names and schema definitions.
     *
     * @param accountSchema - The schema to use, or undefined to fetch from the fusion source
     */
    public async setFusionAccountSchema(accountSchema: AccountSchema | undefined): Promise<void> {
        if (accountSchema) {
            this._fusionAccountSchema = accountSchema
        } else {
            await this.fetchFusionAccountSchema()
        }
        const fromSchema = this.fusionAccountSchema.attributes.map((x) => x.name!).filter(Boolean)
        this._fusionSchemaAttributeNames = [
            ...new Set([...fromSchema, ...SchemaService.BASE_FUSION_ATTRIBUTE_NAMES]),
        ].sort()

        // Build a lookup map from attribute name to its SchemaAttribute definition
        this._fusionSchemaAttributeMap = new Map()
        for (const attr of this.fusionAccountSchema.attributes) {
            if (attr.name) {
                this._fusionSchemaAttributeMap.set(attr.name, attr)
            }
        }
        // Also include base fusion attributes
        for (const attr of fusionAccountSchemaAttributes) {
            if (attr.name && !this._fusionSchemaAttributeMap.has(attr.name)) {
                this._fusionSchemaAttributeMap.set(attr.name, attr)
            }
        }
    }

    /**
     * Get schema - build dynamically if not loaded
     */
    private get fusionAccountSchema(): AccountSchema {
        assert(this._fusionAccountSchema, 'Fusion account schema must be set first')

        return this._fusionAccountSchema
    }

    /**
     * Fetches and converts the account schema for a given source.
     *
     * @param id - The source ID to fetch the schema for
     * @returns The converted AccountSchema
     */
    private async fetchAccountSchema(id: string): Promise<AccountSchema> {
        const sourceSchemas = await this.sources.listSourceSchemas(id)
        const apiAccountSchema = sourceSchemas.find(isAccountSchema)
        assert(apiAccountSchema, `Account schema not found for source ${id}`)
        const accountSchema = apiSchemaToAccountSchema(apiAccountSchema)

        return accountSchema
    }

    /**
     * Extracts schema attributes from a source's account schema, applying the configured
     * attribute merge strategy (first/list/concatenate) to set multi-value cardinality.
     *
     * @param schema - The source account schema
     * @param sourceName - The source name (used for default descriptions)
     * @returns Array of schema attributes with merge-aware cardinality
     */
    private getAccountSchemaAttributes(schema: AccountSchema, sourceName: string): SchemaAttribute[] {
        const attributes: SchemaAttribute[] = []
        for (const attribute of schema.attributes) {
            const attributeMap = this.attributeMap.get(attribute.name!)
            if (attributeMap) {
                if (attributeMap.attributeMerge === 'list') {
                    attribute.multi = true
                } else {
                    attribute.multi = false
                }
            } else {
                if (this.attributeMerge === 'list') {
                    attribute.multi = true
                } else {
                    attribute.multi = false
                }
            }
            attribute.description = attribute.description || `${attribute.name} from ${sourceName}`
            attributes.push(attribute)
        }

        return attributes
    }

    /** Builds schema attributes for configured attribute mappings. */
    private getAttributeMappingAttributes(): SchemaAttribute[] {
        const attributes: SchemaAttribute[] = []
        for (const attributeMap of this.attributeMap.values()) {
            if (attributeMap.attributeMerge === 'list') {
                attributes.push({
                    name: attributeMap.newAttribute,
                    description: `Created from ${attributeMap.existingAttributes.join(', ')}`,
                    type: 'string',
                    multi: true,
                    entitlement: false,
                })
            } else {
                attributes.push({
                    name: attributeMap.newAttribute,
                    description: `Created from ${attributeMap.existingAttributes.join(', ')}`,
                    type: 'string',
                    multi: false,
                    entitlement: false,
                })
            }
        }

        return attributes
    }

    /** Builds schema attributes for configured attribute definitions (Velocity expressions). */
    private getAttributeDefinitionAttributes(): SchemaAttribute[] {
        const attributes: SchemaAttribute[] = this.attributeDefinitions!
            .filter((x) => x.name) // Filter out any definitions without names
            .map((x) => {
                return {
                    name: x.name!,
                    description: x.expression ? `Created from expression: ${x.expression}` : '',
                    type: 'string',
                    multi: false,
                    entitlement: false,
                }
            })

        return attributes
    }

    /** Returns the static base fusion schema attributes (status, actions, reviews, etc.). */
    private listFusionAttributes(): SchemaAttribute[] {
        return fusionAccountSchemaAttributes
    }

    /**
     * Lists all attribute names defined in the current fusion account schema.
     *
     * @returns Array of attribute name strings
     */
    public listSchemaAttributeNames(): string[] {
        return this.fusionAccountSchema.attributes.map((x) => x.name!)
    }

    /**
     * Returns all schema attributes from the fusion account schema (identity, display,
     * and attribute definitions).
     *
     * @returns Array of SchemaAttribute objects
     */
    public getSchemaAttributes(): SchemaAttribute[] {
        return this.fusionAccountSchema.attributes
    }

    /**
     * Builds the fusion account schema from managed sources, attribute mappings,
     * and attribute definitions. Used for schema discovery.
     *
     * @returns The dynamically built AccountSchema
     */
    public async buildDynamicSchema(): Promise<AccountSchema> {
        this.log.debug('Building dynamic schema.')
        const attributes: SchemaAttribute[] = []
        const schema: AccountSchema = {
            displayAttribute: 'name',
            identityAttribute: 'id',
            groupAttribute: 'actions',
            attributes,
        }

        // Define static attributes
        const fusionAttributes = this.listFusionAttributes()

        // Define attribute map attributes
        const attributeMappingAttributes = this.getAttributeMappingAttributes()

        // Define attribute definition attributes
        const attributeDefinitionAttributes = this.getAttributeDefinitionAttributes()

        // Define account schema attributes
        const { managedSources } = this.sources

        const accountSchemaAttributes: SchemaAttribute[] = []
        for (const source of managedSources.reverse()) {
            const accountSchema = await this.fetchAccountSchema(source.id)
            const attributes = this.getAccountSchemaAttributes(accountSchema, source.name)
            accountSchemaAttributes.push(...attributes)
        }

        const attributeMap = new Map<string, SchemaAttribute>()
        fusionAttributes.forEach((attribute) => {
            attributeMap.set(String(attribute.name!).toLowerCase(), attribute)
        })
        accountSchemaAttributes.forEach((attribute) => {
            attributeMap.set(String(attribute.name!).toLowerCase(), attribute)
        })
        attributeMappingAttributes.forEach((attribute) => {
            attributeMap.set(String(attribute.name!).toLowerCase(), attribute)
        })
        attributeDefinitionAttributes.forEach((attribute) => {
            attributeMap.set(String(attribute.name!).toLowerCase(), attribute)
        })

        attributes.push(...Array.from(attributeMap.values()))

        return schema
    }
}
