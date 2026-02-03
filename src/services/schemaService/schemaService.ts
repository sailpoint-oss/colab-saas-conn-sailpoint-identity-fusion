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
    private readonly attributeMaps?: AttributeMap[]
    private readonly attributeMerge: 'first' | 'list' | 'concatenate'
    private readonly attributeDefinitions?: AttributeDefinition[] // Local type from config

    constructor(
        config: FusionConfig,
        private log: LogService,
        private sources: SourceService
    ) {
        this.attributeMaps = config.attributeMaps
        this.attributeMerge = config.attributeMerge
        this.attributeDefinitions = config.attributeDefinitions
        this.attributeMap = new Map(config.attributeMaps?.map((x) => [x.newAttribute, x]) ?? [])
    }

    public getFusionAttributeSubset(attributes: Attributes | null): Attributes {
        if (!attributes) return {}

        const fusionAttributes: Attributes = {}
        for (const attribute of this._fusionSchemaAttributeNames) {
            fusionAttributes[attribute] = attributes?.[attribute]
        }
        return fusionAttributes
    }

    private async fetchFusionAccountSchema(): Promise<void> {
        this._fusionAccountSchema = await this.fetchAccountSchema(this.sources.fusionSourceId!)
    }

    public get fusionIdentityAttribute(): string {
        return this.fusionAccountSchema.identityAttribute
    }

    public get fusionDisplayAttribute(): string {
        return this.fusionAccountSchema.displayAttribute
    }

    /** Base fusion attribute names that must always be included in the subset (e.g. reviews for reviewers). */
    private static readonly BASE_FUSION_ATTRIBUTE_NAMES = fusionAccountSchemaAttributes.map((a) => a.name!).filter(Boolean)

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
    }

    /**
     * Get schema - build dynamically if not loaded
     */
    private get fusionAccountSchema(): AccountSchema {
        assert(this._fusionAccountSchema, 'Fusion account schema must be set first')

        return this._fusionAccountSchema
    }

    private async fetchAccountSchema(id: string): Promise<AccountSchema> {
        const sourceSchemas = await this.sources.listSourceSchemas(id)
        const apiAccountSchema = sourceSchemas.find(isAccountSchema)
        assert(apiAccountSchema, `Account schema not found for source ${id}`)
        const accountSchema = apiSchemaToAccountSchema(apiAccountSchema)

        return accountSchema
    }

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

    private listFusionAttributes(): SchemaAttribute[] {
        return fusionAccountSchemaAttributes
    }

    public listSchemaAttributeNames(): string[] {
        return this.fusionAccountSchema.attributes.map((x) => x.name!)
    }

    /**
     * Get all schema attributes
     */
    public getSchemaAttributes(): SchemaAttribute[] {
        return this.fusionAccountSchema.attributes
    }

    /**
     * Build dynamic schema from managed sources
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
