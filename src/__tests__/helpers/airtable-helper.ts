import env from 'dotenv'
import Airtable from 'airtable/lib/airtable'
import { StdAccountCreateInput } from '@sailpoint/connector-sdk'
import { AirtableAccount } from './AirtableAccount'
import crypto from 'crypto'

env.config()

export interface AirtableTestRecord {
    airtableRecordId: string
    accountId: string
}

/**
 * Setup Airtable client
 */
export function setupAirtableClient(baseId?: string): Airtable.Base {
    const token = process.env.AIRTABLE_TOKEN
    const primaryBase = baseId || process.env.AIRTABLE_PRIMARY_BASE

    if (!token) {
        throw new Error('AIRTABLE_TOKEN environment variable is required')
    }
    if (!primaryBase) {
        throw new Error('AIRTABLE_PRIMARY_BASE environment variable is required')
    }

    Airtable.configure({ apiKey: token })
    return Airtable.base(primaryBase)
}

/**
 * Create a test account in Airtable
 */
export async function createTestAccount(
    airtableClient: Airtable.Base,
    accountData?: Partial<{
        id: string
        displayName: string
        email: string
        firstName: string
        lastName: string
        department: string
        enabled: string
        locked: string
        password: string
        entitlements: string
    }>
): Promise<AirtableTestRecord> {
    const timestamp = Date.now()
    const uniqueId = accountData?.id || `test-user-${timestamp}`
    const testEmail = accountData?.email || `test.user.${timestamp}@example.com`

    // Create test account input
    const accountInput: StdAccountCreateInput = {
        identity: uniqueId,
        attributes: {
            id: uniqueId,
            displayName: accountData?.displayName || `Test User ${timestamp}`,
            email: testEmail,
            firstName: accountData?.firstName || 'Test',
            lastName: accountData?.lastName || `User${timestamp}`,
            department: accountData?.department || 'Engineering',
            password: accountData?.password || crypto.randomBytes(20).toString('hex'),
            enabled: accountData?.enabled || 'true',
            locked: accountData?.locked || 'false',
            entitlements: accountData?.entitlements || 'admin,user',
        },
    }

    // Create the account model from input
    const account = AirtableAccount.createWithStdAccountCreateInput(accountInput)

    console.log(`Creating test account in Airtable: ${uniqueId}`)

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

        console.log(`Successfully created Airtable record: ${record.id}`)

        return {
            airtableRecordId: record.id,
            accountId: account.id,
        }
    } catch (error) {
        throw new Error(`Failed to create account in Airtable: ${error}`)
    }
}

/**
 * Delete a test account from Airtable
 */
export async function deleteTestAccount(
    airtableClient: Airtable.Base,
    record: AirtableTestRecord
): Promise<void> {
    try {
        await airtableClient('Users').destroy(record.airtableRecordId)
        console.log(`Deleted record: ${record.accountId}`)
    } catch (error) {
        console.error(`Failed to delete record ${record.accountId}:`, error)
        throw error
    }
}

/**
 * Clean up multiple test accounts
 */
export async function cleanupTestAccounts(
    airtableClient: Airtable.Base,
    records: AirtableTestRecord[]
): Promise<void> {
    console.log(`Cleaning up ${records.length} test records...`)
    
    for (const record of records) {
        try {
            await deleteTestAccount(airtableClient, record)
        } catch (error) {
            // Log but don't throw - continue cleaning up other records
            console.error(`Failed to delete record ${record.accountId}:`, error)
        }
    }
}

