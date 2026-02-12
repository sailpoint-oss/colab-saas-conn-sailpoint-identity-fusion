import {
    isAccountSchema,
    attributeDefinitionToSchemaAttribute,
    apiSchemaToAccountSchema,
} from '../helpers'

describe('schemaService helpers', () => {
    describe('isAccountSchema', () => {
        it('should return true for User nativeObjectType', () => {
            expect(isAccountSchema({ nativeObjectType: 'User' } as any)).toBe(true)
        })

        it('should return true for account nativeObjectType', () => {
            expect(isAccountSchema({ nativeObjectType: 'account' } as any)).toBe(true)
        })

        it('should return true for account name', () => {
            expect(isAccountSchema({ name: 'account' } as any)).toBe(true)
        })

        it('should return false for other types', () => {
            expect(isAccountSchema({ nativeObjectType: 'Group' } as any)).toBe(false)
        })
    })

    describe('attributeDefinitionToSchemaAttribute', () => {
        it('should convert attribute definition', () => {
            const def = {
                name: 'displayName',
                description: 'Display name',
                type: 'STRING',
                isMulti: false,
                isEntitlement: false,
            }
            const result = attributeDefinitionToSchemaAttribute(def as any)
            expect(result).toEqual({
                name: 'displayName',
                description: 'Display name',
                type: 'string',
                multi: false,
                entitlement: false,
            })
        })

        it('should use empty defaults for missing fields', () => {
            const result = attributeDefinitionToSchemaAttribute({} as any)
            expect(result.name).toBe('')
            expect(result.type).toBe('string')
        })
    })

    describe('apiSchemaToAccountSchema', () => {
        it('should convert API schema to AccountSchema', () => {
            const apiSchema = {
                displayAttribute: 'displayName',
                identityAttribute: 'id',
                attributes: [
                    { name: 'displayName', type: 'STRING', isMulti: false, isEntitlement: false },
                ],
            }
            const result = apiSchemaToAccountSchema(apiSchema as any)
            expect(result.displayAttribute).toBe('displayName')
            expect(result.identityAttribute).toBe('id')
            expect(result.attributes).toHaveLength(1)
            expect(result.attributes[0].name).toBe('displayName')
        })
    })
})
