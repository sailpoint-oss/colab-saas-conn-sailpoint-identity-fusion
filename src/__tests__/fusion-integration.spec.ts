import env from 'dotenv'
import { fail } from 'assert'
import Airtable from 'airtable/lib/airtable'
import { setupFusionSource, FusionSourceInfo } from './helpers/fusion-source-setup'
import { runAggregationAndWait, verifyAccountAggregated } from './helpers/fusion-aggregation'
import {
    setupAirtableClient,
    createTestAccount,
    cleanupTestAccounts,
    AirtableTestRecord,
} from './helpers/airtable-helper'

env.config()

describe('Fusion Connector Integration Tests', () => {
    let fusionSource: FusionSourceInfo
    let airtableClient: Airtable.Base
    const createdRecords: AirtableTestRecord[] = []

    beforeAll(async () => {
        // Setup Fusion source (authenticate, find source, patch with test config)
        fusionSource = await setupFusionSource()

        // Setup Airtable client
        airtableClient = setupAirtableClient()
    })

    afterAll(async () => {
        // Clean up all created test records
        await cleanupTestAccounts(airtableClient, createdRecords)
    })

    it('should create a new account in Airtable and verify fusion connector can retrieve it', async () => {
        // Generate unique test data
        const timestamp = Date.now()
        const uniqueId = `test-user-${timestamp}`
        const testEmail = `test.user.${timestamp}@example.com`

        // Create test account in Airtable
        const record = await createTestAccount(airtableClient, {
            id: uniqueId,
            email: testEmail,
            displayName: `Test User ${timestamp}`,
            firstName: 'Test',
            lastName: `User${timestamp}`,
            department: 'Engineering',
        })

        // Store for cleanup
        createdRecords.push(record)

        // Trigger aggregation and wait for completion
        try {
            const aggregationResult = await runAggregationAndWait(
                fusionSource.token,
                fusionSource.fusionSourceId
            )

            expect(aggregationResult.status).toMatch(/COMPLETED/)
            console.log(`Aggregation completed. Total accounts: ${aggregationResult.totalAccounts || 'N/A'}`)
        } catch (error) {
            fail(`Aggregation failed: ${error}`)
        }

        // Verify the account was aggregated
        try {
            const foundAccount = await verifyAccountAggregated(
                fusionSource.token,
                fusionSource.fusionSourceId,
                uniqueId,
                testEmail
            )

            expect(foundAccount).toBeDefined()
            expect(foundAccount.nativeIdentity).toBe(uniqueId)
            
            // Verify account attributes
            const accountEmail = foundAccount.attributes?.email || foundAccount.attributes?.Email
            expect(accountEmail).toBe(testEmail)
            
            console.log(`Successfully verified account ${uniqueId} was aggregated`)
        } catch (error) {
            fail(`Account verification failed: ${error}`)
        }
    })
})
