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
import {
    getAccessProfileByName,
    getIdentityId,
    createAccessRequest,
    waitForAccessRequestCompletion,
} from './helpers/access-request-helper'
import { cleanupIdentityMergingForms, getFormsByFilter } from './helpers/form-helper'

env.config()

describe('Fusion Connector Baseline Integration Tests', () => {
    let fusionSource: FusionSourceInfo
    let airtableSource: AirtableSourceInfo
    let airtableSourceSecondary: AirtableSourceInfo
    let airtableClient: Airtable.Base
    let airtableClientSecondary: Airtable.Base
    const createdRecords: AirtableTestRecord[] = []
    const createdRecordsSecondary: AirtableTestRecord[] = []

    beforeAll(async () => {
        // Setup Fusion source (authenticate, find source, patch with test config)
        fusionSource = await setupFusionSource()

        // Clean up any existing Identity Merging forms
        const baseUrl = process.env.SAIL_BASE_URL!
        console.log('Cleaning up Identity Merging forms before tests...')
        await cleanupIdentityMergingForms(fusionSource.token, baseUrl)

        // Setup Airtable sources (primary and secondary)
        airtableSource = await setupAirtableSource('Fusion Integration Test Primary')
        airtableSourceSecondary = await setupAirtableSource('Fusion Integration Test Secondary')

        // Setup Airtable clients
        airtableClient = setupAirtableClient()
        airtableClientSecondary = setupAirtableClient(process.env.AIRTABLE_SECONDARY_BASE)

        // Delete all existing records from the Users table to ensure a clean state
        console.log('Cleaning up Airtable databases before tests...')
        await deleteAllRecords(airtableClient, ['Users'])
        await deleteAllRecords(airtableClientSecondary, ['Users'])

        const fusionConfig = getFusionTestConfig();
        fusionConfig.reset = true;
        await updateFusionSourceConfig(fusionSource.token, fusionSource.fusionSourceId, fusionConfig);

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
        await cleanupTestAccounts(airtableClientSecondary, createdRecordsSecondary)
    })

    it('should create a baseline account and verify fusion connector properties (uniqueId, accounts, uuid, history)', async () => {
        // Generate unique test data
        const timestamp = Date.now()
        const uniqueId = `test-user-${timestamp}`
        const testEmail = `test.user.${timestamp}@example.com`
        let similarEmail = '' // Will be set when creating secondary account

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
            const accountEmail = foundAccount.attributes?.email
            expect(accountEmail).toBe(testEmail)
            
            console.log(`Successfully verified account ${uniqueId} was aggregated`)

            // Additional baseline verification checks
            
            // 1. Check uniqueId is properly populated (format: firstInitial + lastName + counter)
            const uniqueIdValue = foundAccount.attributes?.uniqueID
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
            expect(Array.isArray(history)).toBe(true)
            const historyContainsBaseline = history.some((entry: string) => entry.includes('Baseline account'))
            expect(historyContainsBaseline).toBe(true)
            console.log(`✓ history contains "Baseline account": ${history[0]}`)

            console.log(`All baseline verification checks passed for account ${uniqueId}`)
        } catch (error) {
            fail(`Account verification failed: ${error}`)
        }

        // Step 2: Request access profile for philip.ellis user
        console.log('\n=== Starting Access Request Test ===')
        
        try {
            const baseUrl = process.env.SAIL_BASE_URL!
            const targetUsername = 'philip ellis'
            const accessProfileName = 'fusion reviewer'
            
            // Get the access profile by name
            console.log(`Looking up access profile "${accessProfileName}"...`)
            const accessProfile = await getAccessProfileByName(fusionSource.token, baseUrl, accessProfileName)
            const accessProfileId = accessProfile.id
            
            expect(accessProfileId).toBeDefined()
            console.log(`✓ Found access profile ID: ${accessProfileId}`)
            
            // Get the identity ID for philip.ellis
            console.log(`Looking up identity ID for ${targetUsername}...`)
            const identityId = await getIdentityId(fusionSource.token, baseUrl, targetUsername)
            
            // Create access request
            console.log(`Creating access request for ${targetUsername} with access profile ${accessProfileId}...`)
            const accessRequest = await createAccessRequest(
                fusionSource.token,
                baseUrl,
                accessProfileId,
                identityId
            )
            
            expect(accessRequest).toBeDefined()
            
            // Extract the access request ID from the response structure
            const accessRequestId = accessRequest.newRequests[0].accessRequestIds[0]
            expect(accessRequestId).toBeDefined()
            console.log(`Access request created with ID: ${accessRequestId}`)
            
            // Wait for access request to complete
            console.log('Waiting for access request to complete...')
            const finalStatus = await waitForAccessRequestCompletion(
                fusionSource.token,
                baseUrl,
                accessRequestId
            )
            
            expect(finalStatus[0].state).toBe('REQUEST_COMPLETED')
            console.log('✓ Access request completed successfully')
            
            // Log the final status details
            console.log('Final access request status:', JSON.stringify(finalStatus, null, 2))
            
        } catch (error: any) {
            fail(`Access request test failed: ${error}`)
        }

        // Step 3: Create second account in secondary Airtable base with similar email (off by one character)
        console.log('\n=== Creating Second Account for Merge Testing ===')
        
        try {
            // Generate a similar email with one character different
            // Change the last character of the local part before @
            const originalEmail = testEmail
            const emailParts = originalEmail.split('@')
            const localPart = emailParts[0]
            const domain = emailParts[1]
            
            // Change just the last character (e.g., if it ends in '1', change to '2')
            const lastChar = localPart[localPart.length - 1]
            const newLastChar = lastChar === '1' ? '2' : '1'
            const modifiedLocalPart = localPart.slice(0, -1) + newLastChar
            similarEmail = `${modifiedLocalPart}@${domain}`
            
            console.log(`Original email: ${originalEmail}`)
            console.log(`Similar email (off by 1 char): ${similarEmail}`)
            
            const uniqueIdSecondary = `test-user-secondary-${timestamp}`
            
            // Create test account in secondary Airtable base
            const recordSecondary = await createTestAccount(airtableClientSecondary, {
                id: uniqueIdSecondary,
                email: similarEmail,
                displayName: `Test User Secondary ${timestamp}`,
                firstName: 'Test',
                lastName: `User${timestamp}`,
                department: 'Engineering',
            })
            
            // Store for cleanup
            createdRecordsSecondary.push(recordSecondary)
            console.log(`✓ Created account in secondary base: ${uniqueIdSecondary}`)
            
            // Trigger secondary Airtable source aggregation
            console.log('Triggering aggregation for secondary Airtable source...')
            const secondaryAggregationResult = await aggregateAirtableSource(airtableSourceSecondary)
            expect(secondaryAggregationResult.status).toMatch(/COMPLETED/)
            console.log(`✓ Secondary Airtable aggregation completed. Total accounts: ${secondaryAggregationResult.totalAccounts || 'N/A'}`)
            
            // Update Fusion config to include both sources for merge processing
            console.log('Updating Fusion config to include both sources...')
            const fusionConfigWithBothSources = getFusionTestConfig()
            fusionConfigWithBothSources.reset = false
            fusionConfigWithBothSources.sources = ['Fusion Integration Test Primary', 'Fusion Integration Test Secondary']
            await updateFusionSourceConfig(fusionSource.token, fusionSource.fusionSourceId, fusionConfigWithBothSources)
            console.log('✓ Fusion config updated with both sources')
            
            // Trigger Fusion aggregation to process the merge
            console.log('Triggering Fusion aggregation to process merge...')
            const fusionMergeAggregation = await runAggregationAndWait(
                fusionSource.token,
                fusionSource.fusionSourceId
            )
            
            expect(fusionMergeAggregation.status).toMatch(/COMPLETED/)
            console.log(`✓ Fusion aggregation completed. Total accounts: ${fusionMergeAggregation.totalAccounts || 'N/A'}`)
            
        } catch (error: any) {
            fail(`Secondary account creation and merge test failed: ${error}`)
        }

        // Step 4: Verify that the Identity Merging form was created
        console.log('\n=== Verifying Identity Merging Form Creation ===')
        
        try {
            const baseUrl = process.env.SAIL_BASE_URL!
            
            // Get all forms that start with "Identity Merging"
            console.log('Fetching Identity Merging forms...')
            const forms = await getFormsByFilter(fusionSource.token, baseUrl, 'name sw "Identity Merging"')
            
            // Verify exactly one form was created
            expect(forms).toBeDefined()
            expect(Array.isArray(forms)).toBe(true)
            expect(forms.length).toBe(1)
            console.log(`✓ Exactly one Identity Merging form was created`)
            
            // Verify form contents
            const form = forms[0]
            console.log('\n=== Identity Merging Form Details ===')
            console.log(`Form ID: ${form.object.id}`)
            console.log(`Form Name: ${form.object.name}`)
            
            // Verify formInput contains the expected email addresses
            const formInput = form.object.formInput
            expect(formInput).toBeDefined()
            expect(Array.isArray(formInput)).toBe(true)
            
            // Find the original and similar email entries
            const emailEntries = formInput.filter((input: any) => 
                input.id.includes('.email') || input.id === 'newidentity.email'
            )
            
            const emailDescriptions = emailEntries.map((e: any) => e.description)
            console.log(`\n✓ Found email entries in form:`)
            emailDescriptions.forEach((email: string) => console.log(`  - ${email}`))
            
            // Verify both emails are present in the form
            const hasOriginalEmail = emailDescriptions.some((desc: string) => desc === testEmail)
            const hasSimilarEmail = emailDescriptions.some((desc: string) => desc === similarEmail)
            
            expect(hasOriginalEmail).toBe(true)
            expect(hasSimilarEmail).toBe(true)
            console.log(`✓ Original email found in form: ${testEmail}`)
            console.log(`✓ Similar email found in form: ${similarEmail}`)
            
            // Verify the score is present and >= 90
            const scoreEntry = formInput.find((input: any) => input.id.includes('overall.score'))
            expect(scoreEntry).toBeDefined()
            const score = parseInt(scoreEntry.description, 10)
            expect(score).toBeGreaterThanOrEqual(90)
            console.log(`✓ Merge score is ${score} (>= 90)`)
            
            // Verify the threshold is 90
            const thresholdEntry = formInput.find((input: any) => input.id.includes('overall.threshold'))
            expect(thresholdEntry).toBeDefined()
            const threshold = parseInt(thresholdEntry.description, 10)
            expect(threshold).toBe(90)
            console.log(`✓ Merge threshold is ${threshold}`)
            
            // Verify the source is correct
            const sourceEntry = formInput.find((input: any) => input.id === 'source')
            expect(sourceEntry).toBeDefined()
            expect(sourceEntry.description).toBe('Fusion Integration Test Secondary')
            console.log(`✓ Source is correct: ${sourceEntry.description}`)
            
            console.log('\nComplete Form Object:')
            console.log(JSON.stringify(form, null, 2))
            
        } catch (error: any) {
            fail(`Form verification failed: ${error}`)
        }
    })
})
