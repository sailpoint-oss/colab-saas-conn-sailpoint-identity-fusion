import { AttributeDefinitionV2025, SchemaV2025 } from 'sailpoint-api-client'
import { AccountSchema, SchemaAttribute } from '@sailpoint/connector-sdk'

// ============================================================================
// Helper Functions
// ============================================================================

export const isAccountSchema = (schema: SchemaV2025): boolean => {
    return schema.nativeObjectType === 'User' || schema.nativeObjectType === 'account' || schema.name === 'account'
}

export const attributeDefinitionToSchemaAttribute = (attributeDefinition: AttributeDefinitionV2025): SchemaAttribute => {
    return {
        name: attributeDefinition.name ?? '',
        description: attributeDefinition.description ?? '',
        type: attributeDefinition.type ? attributeDefinition.type.toLowerCase() : 'string',
        multi: attributeDefinition.isMulti ?? false,
        entitlement: attributeDefinition.isEntitlement ?? false,
    }
}

export const apiSchemaToAccountSchema = (apiSchema: SchemaV2025): AccountSchema => {
    const attributes = (apiSchema.attributes ?? []).map((x) => attributeDefinitionToSchemaAttribute(x))
    const accountSchema: AccountSchema = {
        displayAttribute: apiSchema.displayAttribute!,
        identityAttribute: apiSchema.identityAttribute!,
        attributes,
        groupAttribute: '',
    }

    return accountSchema
}
