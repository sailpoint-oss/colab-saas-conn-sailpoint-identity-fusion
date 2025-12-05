import env from 'dotenv'
import { fail } from 'assert'
import Airtable from 'airtable/lib/airtable'
import { setupFusionSource, FusionSourceInfo, getFusionTestConfig, updateFusionSourceConfig } from './helpers/fusion-source-setup'
import { runAggregationAndWait, verifyAccountAggregated } from './helpers/fusion-aggregation'
import {
    setupAirtableClient,
    createTestAccount,
    cleanupTestAccounts,
    deleteAllRecords,
    AirtableTestRecord,
} from './helpers/airtable-helper'
import { setupAirtableSource, aggregateAirtableSource, AirtableSourceInfo } from './helpers/airtable-source-helper'

env.config()

describe('Fusion Connector Integration Tests', () => {
    let fusionSource: FusionSourceInfo
    let airtableSource: AirtableSourceInfo
    let airtableClient: Airtable.Base
    const createdRecords: AirtableTestRecord[] = []

    beforeAll(async () => {
        // Setup Fusion source (authenticate, find source, patch with test config)
        fusionSource = await setupFusionSource()

        // Setup Airtable source
        airtableSource = await setupAirtableSource('Fusion Integration Test Primary')

        // Setup Airtable client
        airtableClient = setupAirtableClient()

        // Delete all existing records from the Users table to ensure a clean state
        console.log('Cleaning up Airtable database before tests...')
        await deleteAllRecords(airtableClient, ['Users'])

        // Trigger aggregation and wait for completion to clean up any existing accounts
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

        // Trigger Airtable source aggregation to pick up the new account
        try {
            const airtableAggregationResult = await aggregateAirtableSource(airtableSource)
            expect(airtableAggregationResult.status).toMatch(/COMPLETED/)
            console.log(`Airtable aggregation completed. Total accounts: ${airtableAggregationResult.totalAccounts || 'N/A'}`)
        } catch (error) {
            fail(`Airtable aggregation failed: ${error}`)
        }

        // Trigger Fusion aggregation and wait for completion
        try {
            const fusionConfig = getFusionTestConfig();
            fusionConfig.reset = false;
            await updateFusionSourceConfig(fusionSource.token, fusionSource.fusionSourceId, fusionConfig);

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
            expect(foundAccount.attributes?.id).toBe(uniqueId)
            
            // Verify account attributes
            const accountEmail = foundAccount.attributes?.email || foundAccount.attributes?.Email
            expect(accountEmail).toBe(testEmail)
            
            console.log(`Successfully verified account ${uniqueId} was aggregated`)
        } catch (error) {
            fail(`Account verification failed: ${error}`)
        }
    })
})
