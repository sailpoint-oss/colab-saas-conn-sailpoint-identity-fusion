import {
    scoreDice,
    scoreJaroWinkler,
    scoreDoubleMetaphone,
    scoreNameMatcher,
    scoreLIG3,
} from '../helpers'

const baseMatching = {
    attribute: 'displayName',
    fusionScore: 80,
}

describe('scoringService helpers', () => {
    describe('scoreDice', () => {
        it('should return 100 for identical strings', () => {
            const result = scoreDice('hello', 'hello', baseMatching)
            expect(result.score).toBe(100)
            expect(result.isMatch).toBe(true)
        })

        it('should respect fusionScore threshold', () => {
            const result = scoreDice('abc', 'xyz', { ...baseMatching, fusionScore: 80 })
            expect(result.isMatch).toBe(result.score >= 80)
        })
    })

    describe('scoreJaroWinkler', () => {
        it('should return 100 for identical strings', () => {
            const result = scoreJaroWinkler('matching', 'matching', baseMatching)
            expect(result.score).toBe(100)
        })
    })

    describe('scoreDoubleMetaphone', () => {
        it('should return 100 for primary code match', () => {
            const result = scoreDoubleMetaphone('Smith', 'Smith', baseMatching)
            expect(result.score).toBe(100)
            expect(result.comment).toContain('Primary')
        })

        it('should handle phonetically similar names', () => {
            const result = scoreDoubleMetaphone('Smith', 'Smyth', baseMatching)
            expect(result.score).toBeGreaterThan(0)
        })

        it('should return 0 and comment for no match', () => {
            const result = scoreDoubleMetaphone('Apple', 'Banana', baseMatching)
            expect(result.score).toBe(0)
            expect(result.comment).toContain('No phonetic match')
        })
    })

    describe('scoreNameMatcher', () => {
        it('should return 100 for identical names', () => {
            const result = scoreNameMatcher('John Smith', 'John Smith', baseMatching)
            expect(result.score).toBe(100)
        })

        it('should handle name order differences', () => {
            const result = scoreNameMatcher('John Smith', 'Smith John', baseMatching)
            expect(result.score).toBeGreaterThan(80)
        })
    })

    describe('scoreLIG3', () => {
        it('should return 100 for exact match', () => {
            const result = scoreLIG3('John Smith', 'John Smith', baseMatching)
            expect(result.score).toBe(100)
            expect(result.comment).toBe('Exact match')
        })

        it('should return 0 for empty comparison', () => {
            const result = scoreLIG3('', 'test', baseMatching)
            expect(result.score).toBe(0)
        })

        it('should handle typos with moderate score', () => {
            const result = scoreLIG3('John', 'Jhon', baseMatching)
            expect(result.score).toBeGreaterThan(0)
        })

        it('should be case insensitive', () => {
            const result = scoreLIG3('JOHN', 'john', baseMatching)
            expect(result.score).toBe(100)
        })
    })
})
