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

describe('Fusion Connector Baseline Integration Tests', () => {
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

    it('should create a baseline account and verify fusion connector properties (uniqueId, accounts, uuid, history)', async () => {
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

            // Additional baseline verification checks
            
            // 1. Check uniqueId is properly populated (format: firstInitial + lastName + counter)
            const uniqueIdValue = foundAccount.attributes?.uniqueId
            expect(uniqueIdValue).toBeDefined()
            expect(uniqueIdValue).toBeTruthy()
            // Expected format: T (first initial) + User{timestamp} + counter
            expect(uniqueIdValue).toMatch(/^T.*\d+$/)
            console.log(`✓ uniqueId is properly populated: ${uniqueIdValue}`)

            // 2. Check accounts array length is 1
            const accounts = foundAccount.attributes?.accounts
            expect(accounts).toBeDefined()
            expect(Array.isArray(accounts)).toBe(true)
            expect(accounts.length).toBe(1)
            console.log(`✓ accounts array contains ${accounts.length} account(s)`)

            // 3. Ensure uuid is populated
            const uuid = foundAccount.uuid
            expect(uuid).toBeDefined()
            expect(uuid).toBeTruthy()
            console.log(`✓ uuid is populated: ${uuid}`)

            // 4. Check history contains "Baseline account" string
            const history = foundAccount.attributes?.history
            expect(history).toBeDefined()
            expect(history).toContain('Baseline account')
            console.log(`✓ history contains "Baseline account"`)

            console.log(`All baseline verification checks passed for account ${uniqueId}`)
        } catch (error) {
            fail(`Account verification failed: ${error}`)
        }
    })
})
