import {
    jaroWinklerSimilarity,
    diceCoefficientSimilarity,
    jaroWinkler,
    diceCoefficient,
} from '../stringComparison'

describe('stringComparison', () => {
    describe('jaroWinklerSimilarity', () => {
        it('should return 1 for identical strings', () => {
            expect(jaroWinklerSimilarity('hello', 'hello')).toBe(1.0)
        })

        it('should return 0 for empty strings', () => {
            expect(jaroWinklerSimilarity('', 'hello')).toBe(0)
            expect(jaroWinklerSimilarity('hello', '')).toBe(0)
        })

        it('should return high similarity for similar strings', () => {
            const sim = jaroWinklerSimilarity('martha', 'marhta')
            expect(sim).toBeGreaterThan(0.9)
        })

        it('should return lower similarity for different strings', () => {
            const sim = jaroWinklerSimilarity('hello', 'world')
            expect(sim).toBeLessThan(0.5)
        })

        it('should boost score for common prefix', () => {
            const withPrefix = jaroWinklerSimilarity('abcd', 'abcx')
            const withoutPrefix = jaroWinklerSimilarity('xbcd', 'xbcx')
            expect(withPrefix).toBeGreaterThanOrEqual(withoutPrefix)
        })
    })

    describe('jaroWinkler object', () => {
        it('should expose similarity method', () => {
            expect(jaroWinkler.similarity('test', 'test')).toBe(1.0)
        })
    })

    describe('diceCoefficientSimilarity', () => {
        it('should return 1 for identical strings', () => {
            expect(diceCoefficientSimilarity('hello', 'hello')).toBe(1.0)
        })

        it('should return 0 for strings shorter than 2 chars', () => {
            expect(diceCoefficientSimilarity('a', 'ab')).toBe(0)
            expect(diceCoefficientSimilarity('', 'ab')).toBe(0)
        })

        it('should return high similarity for similar strings', () => {
            const sim = diceCoefficientSimilarity('night', 'nacht')
            expect(sim).toBeGreaterThan(0)
            expect(sim).toBeLessThanOrEqual(1)
        })

        it('should return 0 for completely different strings', () => {
            const sim = diceCoefficientSimilarity('abc', 'xyz')
            expect(sim).toBe(0)
        })
    })

    describe('diceCoefficient object', () => {
        it('should expose similarity method', () => {
            expect(diceCoefficient.similarity('test', 'test')).toBe(1.0)
        })
    })
})
