import axios from 'axios'
import env from 'dotenv'
import { Configuration } from './test-config'
import { fail } from 'assert'
// @ts-expect-error - airtable types not available
import Airtable from 'airtable/lib/airtable'
import { StdAccountCreateInput } from '@sailpoint/connector-sdk'
import { AirtableAccount } from '../../airtableTemp/models/AirtableAccount'
import crypto from 'crypto'

env.config()

// Test configuration for Fusion Integration Test
const getFusionIntegrationTestConfig = (spConnectorInstanceId: string) => ({
    tag: 'latest',
    type: 'std:account:list',
    config: {
        clientId: process.env.SAIL_CLIENT_ID,
        clientSecret: process.env.SAIL_CLIENT_SECRET,
        baseurl: process.env.SAIL_BASE_URL,
        spConnectorInstanceId,
        sources: ['Fusion Integration Test Primary'],
        cloudDisplayName: 'fusion-connector-integration-test',
        merging_map: [
            {
                identity: 'email',
                account: ['email', 'Email'],
                uidOnly: true,
            },
        ],
        global_merging_score: true,
        merging_score: 90,
        merging_isEnabled: true,
        merging_attributes: ['email'],
        merging_expirationDays: 5,
    },
    input: {},
})

interface AirtableTestRecord {
    airtableRecordId: string
    accountId: string
}

describe('Fusion Connector Integration Tests', () => {
    let token: string
    let spConnectorInstanceId: string
    let airtableClient: Airtable.Base
    const createdRecords: AirtableTestRecord[] = []

    beforeAll(async () => {
        // Get SailPoint token
        const config = new Configuration()
        token = await config.getToken(
            process.env.SAIL_BASE_URL!,
            process.env.SAIL_CLIENT_ID!,
            process.env.SAIL_CLIENT_SECRET!
        )

        // Fetch the fusion connector instance ID by searching for "Employees" source
        const sourcesUrl = `${process.env.SAIL_BASE_URL}/v2025/sources?filters=name eq "Employees"`
        
        try {
            const response = await axios.get(sourcesUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            })

            if (response.data && response.data.length > 0) {
                spConnectorInstanceId = response.data[0].id
                console.log(`Found connector instance ID: ${spConnectorInstanceId}`)
            } else {
                throw new Error('Source "Employees" not found')
            }
        } catch (error) {
            console.error('Failed to fetch connector instance ID:', error)
            throw error
        }

        // Configure Airtable client
        if (!process.env.AIRTABLE_TOKEN) {
            throw new Error('AIRTABLE_TOKEN environment variable is required')
        }
        if (!process.env.AIRTABLE_PRIMARY_BASE) {
            throw new Error('AIRTABLE_PRIMARY_BASE environment variable is required')
        }

        Airtable.configure({ apiKey: process.env.AIRTABLE_TOKEN })
        airtableClient = Airtable.base(process.env.AIRTABLE_PRIMARY_BASE)
    })

    afterAll(async () => {
        // Clean up all created records
        console.log(`Cleaning up ${createdRecords.length} test records...`)
        for (const record of createdRecords) {
            try {
                await airtableClient('Users').destroy(record.airtableRecordId)
                console.log(`Deleted record: ${record.accountId}`)
            } catch (error) {
                console.error(`Failed to delete record ${record.accountId}:`, error)
            }
        }
    })

    it('should create a new account in Airtable and verify fusion connector can retrieve it', async () => {
        // Generate unique test data
        const timestamp = Date.now()
        const uniqueId = `test-user-${timestamp}`
        const testEmail = `test.user.${timestamp}@example.com`

        // Create test account input
        const accountInput: StdAccountCreateInput = {
            identity: uniqueId,
            attributes: {
                id: uniqueId,
                displayName: `Test User ${timestamp}`,
                email: testEmail,
                firstName: 'Test',
                lastName: `User${timestamp}`,
                department: 'Engineering',
                password: crypto.randomBytes(20).toString('hex'),
                enabled: 'true',
                locked: 'false',
                entitlements: 'admin,user',
            },
        }

        // Create the account model from input
        const account = AirtableAccount.createWithStdAccountCreateInput(accountInput)

        console.log(`Creating test account in Airtable: ${uniqueId}`)

        // Create the record in Airtable
        try {
            const record = await airtableClient('Users').create({
                displayName: account.displayName,
                email: account.email,
                id: account.id,
                enabled: account.enabled ? 'true' : 'false',
                department: account.department,
                firstName: account.firstName,
                lastName: account.lastName,
                locked: account.locked ? 'true' : 'false',
                password: account.password ? account.password : crypto.randomBytes(20).toString('hex'),
                entitlements: account.entitlments.join(','),
            })

            // Store the record ID for cleanup
            createdRecords.push({
                airtableRecordId: record.id,
                accountId: account.id,
            })

            console.log(`Successfully created Airtable record: ${record.id}`)

            // Verify the record was created
            expect(record.id).toBeDefined()
            expect(record.get('id')).toBe(uniqueId)
            expect(record.get('email')).toBe(testEmail)
        } catch (error) {
            fail(`Failed to create account in Airtable: ${error}`)
        }

        // Now invoke the fusion connector to verify it can retrieve the account
        const fusionConfig = getFusionIntegrationTestConfig(spConnectorInstanceId)
        const data = JSON.stringify(fusionConfig)

        const invokeConfig = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${process.env.SAIL_BASE_URL}/v2024/platform-connectors/${process.env.STACK}/invoke`,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-SailPoint-Experimental': 'true',
                Authorization: `Bearer ${token}`,
            },
            data: data,
        }

        try {
            console.log('Invoking fusion connector...')
            const response = await axios.request(invokeConfig)
            
            expect(response.status).toBe(200)
            expect(response.data).toBeDefined()

            // Verify the created account is in the response
            const accounts = response.data
            const foundAccount = accounts.find((acc: any) => acc.identity === uniqueId || acc.key?.simple?.id === uniqueId)

            expect(foundAccount).toBeDefined()
            if (foundAccount) {
                console.log(`Successfully found account in fusion connector response: ${uniqueId}`)
                // Verify account attributes
                expect(foundAccount.attributes?.email || foundAccount.email).toBe(testEmail)
            }
        } catch (error) {
            fail(`Fusion connector invocation failed: ${error}`)
        }
    })

})

