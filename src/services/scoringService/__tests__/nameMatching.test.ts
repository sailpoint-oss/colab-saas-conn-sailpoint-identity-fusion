import { match, isMatch } from '../nameMatching'

describe('nameMatching', () => {
    describe('match', () => {
        it('should return 1 for identical names', () => {
            expect(match('John Smith', 'John Smith')).toBe(1.0)
        })

        it('should return 0 for empty names', () => {
            expect(match('', 'John')).toBe(0)
            expect(match('John', '')).toBe(0)
        })

        it('should be case insensitive', () => {
            const score = match('JOHN SMITH', 'john smith')
            expect(score).toBe(1.0)
        })

        it('should handle different name order', () => {
            const score = match('John Smith', 'Smith John')
            expect(score).toBeGreaterThan(0.8)
        })

        it('should return lower score for different names', () => {
            const score = match('John Smith', 'Jane Doe')
            expect(score).toBeLessThan(0.5)
        })

        it('should handle typos with reasonable score', () => {
            const score = match('Smith', 'Smyth')
            expect(score).toBeGreaterThan(0.5)
        })

        it('should handle non-string input', () => {
            const score = match('John' as any, 123 as any)
            expect(typeof score).toBe('number')
            expect(score).toBeGreaterThanOrEqual(0)
        })
    })

    describe('isMatch', () => {
        it('should return true when score exceeds threshold', () => {
            expect(isMatch('John Smith', 'John Smith', 0.85)).toBe(true)
        })

        it('should return false when score below threshold', () => {
            expect(isMatch('John Smith', 'Jane Doe', 0.95)).toBe(false)
        })

        it('should use default threshold of 0.85', () => {
            expect(isMatch('John Smith', 'John Smith')).toBe(true)
        })

        it('should accept custom threshold', () => {
            expect(isMatch('John', 'Johnny', 0.5)).toBe(true)
        })
    })
})
