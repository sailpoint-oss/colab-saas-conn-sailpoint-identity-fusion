import {
    format,
    parse,
    addDays,
    addMonths,
    addYears,
    subDays,
    subMonths,
    subYears,
    isBefore,
    isAfter,
    isEqual,
    differenceInDays,
    startOfDay,
    endOfDay,
    now,
    isValid,
} from '../dateUtils'

describe('attributeService dateUtils', () => {
    const testDate = new Date('2024-01-15T12:30:45.000Z')

    describe('format', () => {
        it('should format with yyyy-MM-dd', () => {
            expect(format(testDate, 'yyyy-MM-dd')).toBe('2024-01-15')
        })

        it('should format with yy', () => {
            expect(format(testDate, 'yy')).toBe('24')
        })

        it('should format with MM and dd', () => {
            expect(format(testDate, 'MM/dd')).toBe('01/15')
        })

        it('should return ISO when no format string', () => {
            const result = format(testDate)
            expect(result).toContain('2024')
        })

        it('should throw for invalid date', () => {
            expect(() => format('invalid')).toThrow('Invalid date')
        })
    })

    describe('parse', () => {
        it('should parse ISO string', () => {
            const d = parse('2024-01-15')
            expect(d.getFullYear()).toBe(2024)
        })

        it('should throw for invalid date', () => {
            expect(() => parse('not-a-date')).toThrow('Invalid date')
        })
    })

    describe('addDays', () => {
        it('should add days', () => {
            const result = addDays('2024-01-15', 10)
            expect(result.getDate()).toBe(25)
        })
    })

    describe('subDays', () => {
        it('should subtract days', () => {
            const result = subDays('2024-01-25', 10)
            expect(result.getDate()).toBe(15)
        })
    })

    describe('addMonths', () => {
        it('should add months', () => {
            const result = addMonths('2024-01-15', 3)
            expect(result.getMonth()).toBe(3)
        })
    })

    describe('addYears', () => {
        it('should add years', () => {
            const result = addYears('2024-01-15', 2)
            expect(result.getFullYear()).toBe(2026)
        })
    })

    describe('subMonths / subYears', () => {
        it('should subtract months', () => {
            const result = subMonths('2024-04-15', 2)
            expect(result.getMonth()).toBe(1)
        })

        it('should subtract years', () => {
            const result = subYears('2026-01-15', 2)
            expect(result.getFullYear()).toBe(2024)
        })
    })

    describe('isBefore / isAfter / isEqual', () => {
        it('should compare dates correctly', () => {
            expect(isBefore('2024-01-01', '2024-01-15')).toBe(true)
            expect(isAfter('2024-01-15', '2024-01-01')).toBe(true)
            expect(isEqual('2024-01-15', '2024-01-15')).toBe(true)
        })
    })

    describe('differenceInDays', () => {
        it('should calculate difference', () => {
            expect(differenceInDays('2024-01-25', '2024-01-15')).toBe(10)
        })
    })

    describe('startOfDay / endOfDay', () => {
        it('should set start of day', () => {
            const d = startOfDay('2024-01-15T12:30:00')
            expect(d.getHours()).toBe(0)
            expect(d.getMinutes()).toBe(0)
        })

        it('should set end of day', () => {
            const d = endOfDay('2024-01-15')
            expect(d.getHours()).toBe(23)
            expect(d.getMinutes()).toBe(59)
        })
    })

    describe('now', () => {
        it('should return current date', () => {
            const before = Date.now()
            const result = now()
            const after = Date.now()
            expect(result.getTime()).toBeGreaterThanOrEqual(before)
            expect(result.getTime()).toBeLessThanOrEqual(after + 1000)
        })
    })

    describe('isValid', () => {
        it('should return true for valid date', () => {
            expect(isValid('2024-01-15')).toBe(true)
        })

        it('should return false for invalid date', () => {
            expect(isValid('invalid')).toBe(false)
        })
    })
})
