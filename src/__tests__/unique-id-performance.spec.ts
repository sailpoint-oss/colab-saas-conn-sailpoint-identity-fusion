import { buildUniqueID } from '../utils/unique'
import { Account } from 'sailpoint-api-client'
import { Config } from '../model/config'
import { jest } from '@jest/globals'

describe('buildUniqueID', () => {
  const mockConfig = {
    uid_template: '#set($initial = $firstname.substring(0, 1))$initial$lastname$counter',
    uid_normalize: true,
    uid_spaces: true,
    uid_digits: 1,
    uid_scope: 'source' as 'source' | 'platform',
    uid_case: 'lower' as 'same' | 'lower' | 'upper',
    merging_map: [],
    getScore: () => 0
  } as unknown as Config

  const mockAccount = {
    id: '123',
    attributes: {
      firstname: 'John',
      lastname: 'Doe'
    }
  } as unknown as Account

  // This test is intentionally slow to demonstrate performance issues
  test('performance test with 100k duplicate IDs', async () => {
    // Mock the logger to avoid verbose output during tests
    jest.spyOn(console, 'debug').mockImplementation(() => {})
    
    // Create a set with 100k duplicate IDs to simulate existing IDs
    const currentIDs = new Set<string>()
    
    // First create and add the base ID that will match initially
    currentIDs.add('jdoe')
    
    // Then add 100k more IDs with counters to force iteration
    for (let i = 1; i <= 100000; i++) {
      const paddedCounter = '0'.repeat(Math.max(0, mockConfig.uid_digits - i.toString().length)) + i
      currentIDs.add(`jdoe${paddedCounter}`)
    }
    
    const startTime = Date.now()
    
    // Run the function that should have to try 100,001 times before finding a unique ID
    const uniqueID = await buildUniqueID(mockAccount, currentIDs, mockConfig, true)
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`buildUniqueID execution time: ${duration}ms for 100k duplicates`)
    
    // The result should be jdoe100001 (since we added jdoe and jdoe1 through jdoe100000)
    expect(uniqueID).toBe('jdoe100001')
    
    // Note: This test was originally intended to demonstrate performance issues,
    // but since we've now implemented the optimized version directly in unique.ts,
    // this assertion is no longer valid as the function is now fast
    console.log('Note: Original performance test now uses the optimized algorithm')
  })
})