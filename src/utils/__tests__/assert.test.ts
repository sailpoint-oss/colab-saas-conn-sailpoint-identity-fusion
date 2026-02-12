import { assert, softAssert } from '../assert'
import { ServiceRegistry } from '../../services/serviceRegistry'
import { ConnectorError } from '@sailpoint/connector-sdk'

describe('assert', () => {
    const mockLog = {
        crash: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    }

    beforeEach(() => {
        jest.clearAllMocks()
        ServiceRegistry.clear()
    })

    afterEach(() => {
        ServiceRegistry.clear()
    })

    describe('assert - success cases', () => {
        it('should not throw when value is truthy', () => {
            expect(() => assert('valid', 'msg')).not.toThrow()
            expect(() => assert(1, 'msg')).not.toThrow()
            expect(() => assert(true, 'msg')).not.toThrow()
        })

        it('should not throw when condition is true', () => {
            expect(() => assert(1 === 1, 'msg')).not.toThrow()
        })
    })

    describe('assert - failure cases', () => {
        it('should throw when value is null and registry has no log', () => {
            ;(ServiceRegistry as any).current = { log: null }
            expect(() => assert(null, 'expected error')).toThrow(ConnectorError)
            expect(() => assert(null, 'expected error')).toThrow(/expected error/)
        })

        it('should throw when value is undefined', () => {
            ;(ServiceRegistry as any).current = { log: null }
            expect(() => assert(undefined, 'msg')).toThrow()
        })

        it('should throw when condition is false', () => {
            ;(ServiceRegistry as any).current = { log: null }
            expect(() => assert(false, 'condition failed')).toThrow(/condition failed/)
        })

        it('should call log.crash when registry has log', () => {
            mockLog.crash.mockImplementation(() => {
                throw new ConnectorError('crash message', 'generic' as any)
            })
            ;(ServiceRegistry as any).current = { log: mockLog }
            expect(() => assert(null, 'crash message')).toThrow(ConnectorError)
            expect(mockLog.crash).toHaveBeenCalledWith('crash message')
        })
    })

    describe('softAssert', () => {
        it('should return true when value is valid', () => {
            expect(softAssert('x', 'msg')).toBe(true)
            expect(softAssert(1, 'msg')).toBe(true)
        })

        it('should return false when value is null', () => {
            ;(ServiceRegistry as any).current = { log: mockLog }
            expect(softAssert(null, 'msg')).toBe(false)
            expect(mockLog.warn).toHaveBeenCalledWith('msg')
        })

        it('should use error level when specified', () => {
            ;(ServiceRegistry as any).current = { log: mockLog }
            softAssert(null, 'error msg', 'error')
            expect(mockLog.error).toHaveBeenCalledWith('error msg')
        })
    })
})
