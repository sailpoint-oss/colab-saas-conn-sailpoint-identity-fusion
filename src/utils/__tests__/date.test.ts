import { getDateFromISOString } from '../date'

describe('getDateFromISOString', () => {
    it('should parse valid ISO string', () => {
        const result = getDateFromISOString('2024-01-15T10:30:00.000Z')
        expect(result).toBeInstanceOf(Date)
        expect(result.getUTCFullYear()).toBe(2024)
        expect(result.getUTCMonth()).toBe(0)
        expect(result.getUTCDate()).toBe(15)
    })

    it('should return epoch date for empty string', () => {
        const result = getDateFromISOString('')
        expect(result.getTime()).toBe(0)
    })

    it('should return epoch date for undefined', () => {
        const result = getDateFromISOString(undefined)
        expect(result.getTime()).toBe(0)
    })

    it('should return epoch date for null', () => {
        const result = getDateFromISOString(null as any)
        expect(result.getTime()).toBe(0)
    })
})
