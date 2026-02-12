import {
    pickAttributes,
    getAttributeValue,
    setAttributeValue,
    isValidAttributeValue,
    toLowerFirstChar,
    toUpperFirstChar,
    capitalizeFirst,
    mergeAttributes,
    copyAttributes,
    extractString,
    extractStringOrDefault,
    extractBoolean,
    extractNumber,
    extractArray,
    toSetFromAttribute,
    getDisplayName,
    getFirstValidAttribute,
    buildAccountIdentifier,
} from '../attributes'

describe('attributes', () => {
    describe('pickAttributes', () => {
        it('should pick only whitelisted attributes', () => {
            const attrs = { firstName: 'John', lastName: 'Doe', age: 30 }
            const result = pickAttributes(attrs, ['firstName', 'lastName'])
            expect(result).toEqual({ firstName: 'John', lastName: 'Doe' })
        })

        it('should return undefined for null/undefined attributes', () => {
            expect(pickAttributes(undefined, ['a'])).toBeUndefined()
            expect(pickAttributes(null as any, ['a'])).toBeUndefined()
        })

        it('should return undefined for empty whitelist', () => {
            expect(pickAttributes({ a: 1 }, [])).toBeUndefined()
            expect(pickAttributes({ a: 1 }, undefined)).toBeUndefined()
        })

        it('should return undefined when no whitelisted attributes exist', () => {
            expect(pickAttributes({ a: 1 }, ['b', 'c'])).toBeUndefined()
        })

        it('should skip invalid values (null, undefined, empty string)', () => {
            const attrs = { a: 'valid', b: '', c: null, d: undefined }
            const result = pickAttributes(attrs, ['a', 'b', 'c', 'd'])
            expect(result).toEqual({ a: 'valid' })
        })

        it('should get attributes with lowercase first char fallback', () => {
            const attrs = { FirstName: 'John' }
            const result = pickAttributes(attrs, ['FirstName'])
            expect(result).toEqual({ FirstName: 'John' })
        })
    })

    describe('getAttributeValue', () => {
        it('should return direct match', () => {
            const attrs = { firstName: 'John' }
            expect(getAttributeValue(attrs, 'firstName')).toBe('John')
        })

        it('should fallback to lowercase first char when direct match fails', () => {
            const attrs = { firstName: 'John' }
            expect(getAttributeValue(attrs, 'FirstName')).toBe('John')
        })

        it('should return undefined for missing attribute', () => {
            const attrs = { a: 1 }
            expect(getAttributeValue(attrs, 'b')).toBeUndefined()
        })
    })

    describe('setAttributeValue', () => {
        it('should set attribute value', () => {
            const attrs: Record<string, any> = {}
            setAttributeValue(attrs, 'name', 'test')
            expect(attrs.name).toBe('test')
        })

        it('should set both cases when setBothCases is true', () => {
            const attrs: Record<string, any> = {}
            setAttributeValue(attrs, 'Name', 'test', true)
            expect(attrs.Name).toBe('test')
            expect(attrs.name).toBe('test')
        })
    })

    describe('isValidAttributeValue', () => {
        it('should return true for valid values', () => {
            expect(isValidAttributeValue('hello')).toBe(true)
            expect(isValidAttributeValue(0)).toBe(true)
            expect(isValidAttributeValue(false)).toBe(true)
        })

        it('should return false for null, undefined, empty string', () => {
            expect(isValidAttributeValue(null)).toBe(false)
            expect(isValidAttributeValue(undefined)).toBe(false)
            expect(isValidAttributeValue('')).toBe(false)
        })
    })

    describe('toLowerFirstChar', () => {
        it('should lowercase first character', () => {
            expect(toLowerFirstChar('Hello')).toBe('hello')
        })

        it('should handle empty string', () => {
            expect(toLowerFirstChar('')).toBe('')
        })

        it('should handle null/undefined', () => {
            expect(toLowerFirstChar(null)).toBe('')
            expect(toLowerFirstChar(undefined)).toBe('')
        })
    })

    describe('toUpperFirstChar / capitalizeFirst', () => {
        it('should uppercase first character', () => {
            expect(toUpperFirstChar('hello')).toBe('Hello')
        })

        it('should handle empty and null', () => {
            expect(toUpperFirstChar('')).toBe('')
            expect(capitalizeFirst('test')).toBe('Test')
        })
    })

    describe('mergeAttributes', () => {
        it('should merge with later sources taking precedence', () => {
            const a = { x: 1, y: 2 }
            const b = { y: 20, z: 3 }
            expect(mergeAttributes(a, b)).toEqual({ x: 1, y: 20, z: 3 })
        })

        it('should skip null and undefined values', () => {
            const a = { x: 1, y: null }
            const b = { y: 2, z: undefined }
            expect(mergeAttributes(a, b)).toEqual({ x: 1, y: 2 })
        })

        it('should ignore undefined sources', () => {
            expect(mergeAttributes({ a: 1 }, undefined, { b: 2 })).toEqual({ a: 1, b: 2 })
        })
    })

    describe('copyAttributes', () => {
        it('should copy all attributes when no exclude', () => {
            const attrs = { a: 1, b: 2 }
            expect(copyAttributes(attrs)).toEqual({ a: 1, b: 2 })
        })

        it('should exclude specified keys', () => {
            const attrs = { a: 1, b: 2, c: 3 }
            expect(copyAttributes(attrs, ['b'])).toEqual({ a: 1, c: 3 })
        })
    })

    describe('extractString', () => {
        it('should return string value', () => {
            expect(extractString({ name: 'John' }, 'name')).toBe('John')
        })

        it('should return undefined for non-string', () => {
            expect(extractString({ n: 123 }, 'n')).toBeUndefined()
        })
    })

    describe('extractStringOrDefault', () => {
        it('should return value when present', () => {
            expect(extractStringOrDefault({ a: 'x' }, 'a', 'default')).toBe('x')
        })

        it('should return default when missing', () => {
            expect(extractStringOrDefault({}, 'a', 'default')).toBe('default')
        })
    })

    describe('extractBoolean', () => {
        it('should handle boolean values', () => {
            expect(extractBoolean({ flag: true }, 'flag')).toBe(true)
            expect(extractBoolean({ flag: false }, 'flag')).toBe(false)
        })

        it('should handle string representations', () => {
            expect(extractBoolean({ flag: 'true' }, 'flag')).toBe(true)
            expect(extractBoolean({ flag: 'false' }, 'flag')).toBe(false)
        })

        it('should return undefined for invalid', () => {
            expect(extractBoolean({ flag: 'yes' }, 'flag')).toBeUndefined()
        })
    })

    describe('extractNumber', () => {
        it('should return number directly', () => {
            expect(extractNumber({ n: 42 }, 'n')).toBe(42)
        })

        it('should parse numeric strings', () => {
            expect(extractNumber({ n: '3.14' }, 'n')).toBe(3.14)
        })

        it('should return undefined for non-numeric', () => {
            expect(extractNumber({ n: 'abc' }, 'n')).toBeUndefined()
        })
    })

    describe('extractArray', () => {
        it('should return array when present', () => {
            expect(extractArray({ ids: [1, 2] }, 'ids')).toEqual([1, 2])
        })

        it('should return empty array when not array', () => {
            expect(extractArray({}, 'ids')).toEqual([])
            expect(extractArray({ ids: 'not-array' }, 'ids')).toEqual([])
        })
    })

    describe('toSetFromAttribute', () => {
        it('should convert array to Set', () => {
            const set = toSetFromAttribute({ tags: ['a', 'b', 'c'] }, 'tags')
            expect(set).toEqual(new Set(['a', 'b', 'c']))
        })

        it('should return empty Set for missing attribute', () => {
            expect(toSetFromAttribute({}, 'tags')).toEqual(new Set())
        })

        it('should return empty Set for null attributes', () => {
            expect(toSetFromAttribute(null, 'tags')).toEqual(new Set())
        })
    })

    describe('getDisplayName', () => {
        it('should prefer displayName', () => {
            expect(getDisplayName({ displayName: 'A', name: 'B' })).toBe('A')
        })

        it('should fallback to display_name and name', () => {
            expect(getDisplayName({ display_name: 'X' })).toBe('X')
            expect(getDisplayName({ name: 'Y' })).toBe('Y')
        })

        it('should return undefined for empty object', () => {
            expect(getDisplayName({})).toBeUndefined()
        })
    })

    describe('getFirstValidAttribute', () => {
        it('should return first valid value', () => {
            const attrs = { a: '', b: 'valid', c: 'also' }
            expect(getFirstValidAttribute(attrs, 'a', 'b', 'c')).toBe('valid')
        })

        it('should return undefined when none valid', () => {
            expect(getFirstValidAttribute({ a: '', b: null }, 'a', 'b')).toBeUndefined()
        })
    })

    describe('buildAccountIdentifier', () => {
        it('should prefer managedAccountId', () => {
            expect(buildAccountIdentifier('managed1', 'native1')).toBe('managed1')
        })

        it('should fallback through sources', () => {
            expect(buildAccountIdentifier(undefined, 'native1')).toBe('native1')
            expect(buildAccountIdentifier(undefined, undefined, { id: 'attr-id' })).toBe('attr-id')
            expect(buildAccountIdentifier(undefined, undefined, { uuid: 'attr-uuid' })).toBe('attr-uuid')
            expect(buildAccountIdentifier(undefined, undefined, undefined, 'identity-id')).toBe('identity-id')
        })

        it('should use fallback when all empty', () => {
            expect(buildAccountIdentifier(undefined, undefined, undefined, undefined, 'unknown')).toBe('unknown')
        })
    })
})
