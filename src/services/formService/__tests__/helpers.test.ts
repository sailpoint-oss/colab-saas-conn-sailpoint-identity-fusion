import { buildFormName, calculateExpirationDate } from '../helpers'

describe('formService helpers', () => {
    describe('buildFormName', () => {
        it('should build form name from fusion account', () => {
            const fusionAccount = {
                name: 'John Doe',
                displayName: 'John Doe',
                sourceName: 'HR Source',
            } as any
            const result = buildFormName(fusionAccount, 'Fusion Review')
            expect(result).toBe('Fusion Review - John Doe [HR Source]')
        })

        it('should use displayName when name is missing', () => {
            const fusionAccount = {
                displayName: 'Jane Smith',
                sourceName: 'IT',
            } as any
            const result = buildFormName(fusionAccount, 'Review')
            expect(result).toBe('Review - Jane Smith [IT]')
        })

        it('should use Unknown when both name and displayName missing', () => {
            const fusionAccount = { sourceName: 'S' } as any
            const result = buildFormName(fusionAccount, 'F')
            expect(result).toBe('F - Unknown [S]')
        })
    })

    describe('calculateExpirationDate', () => {
        it('should add days to current date', () => {
            const base = new Date('2024-01-15')
            jest.useFakeTimers()
            jest.setSystemTime(base)

            const result = calculateExpirationDate(10)
            const expected = new Date(base)
            expected.setDate(expected.getDate() + 10)
            expect(new Date(result).toDateString()).toBe(expected.toDateString())

            jest.useRealTimers()
        })
    })
})
