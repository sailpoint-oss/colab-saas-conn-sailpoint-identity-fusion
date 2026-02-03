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

/**
 * Delete all records from a specific Airtable table
 * @param airtableClient - Airtable base client
 * @param tableName - Name of the table to clear (e.g., 'Users')
 * @returns Number of records deleted
 */
export async function deleteAllRecordsFromTable(
    airtableClient: Airtable.Base,
    tableName: string
): Promise<number> {
    console.log(`Deleting all records from table: ${tableName}`)
    
    try {
        // Fetch all record IDs from the table
        const recordIds: string[] = []
        
        await airtableClient(tableName)
            .select({
                fields: [], // We only need IDs, not field data
            })
            .eachPage((records, fetchNextPage) => {
                records.forEach((record) => {
                    recordIds.push(record.id)
                })
                fetchNextPage()
            })

        if (recordIds.length === 0) {
            console.log(`No records found in table ${tableName}`)
            return 0
        }

        console.log(`Found ${recordIds.length} records to delete from ${tableName}`)

        // Airtable allows batch deletion of up to 10 records at a time
        const batchSize = 10
        let deletedCount = 0

        for (let i = 0; i < recordIds.length; i += batchSize) {
            const batch = recordIds.slice(i, i + batchSize)
            await airtableClient(tableName).destroy(batch)
            deletedCount += batch.length
            console.log(`Deleted ${deletedCount}/${recordIds.length} records from ${tableName}`)
        }

        console.log(`Successfully deleted all ${deletedCount} records from ${tableName}`)
        return deletedCount
    } catch (error) {
        console.error(`Failed to delete records from table ${tableName}:`, error)
        throw new Error(`Failed to delete all records from ${tableName}: ${error}`)
    }
}

/**
 * Delete all records from multiple Airtable tables
 * @param airtableClient - Airtable base client
 * @param tableNames - Array of table names to clear (defaults to ['Users'])
 * @returns Object with table names and count of deleted records
 */
export async function deleteAllRecords(
    airtableClient: Airtable.Base,
    tableNames: string[] = ['Users']
): Promise<Record<string, number>> {
    console.log(`Starting cleanup of ${tableNames.length} table(s)...`)
    
    const results: Record<string, number> = {}

    for (const tableName of tableNames) {
        try {
            const deletedCount = await deleteAllRecordsFromTable(airtableClient, tableName)
            results[tableName] = deletedCount
        } catch (error) {
            console.error(`Failed to clean up table ${tableName}:`, error)
            results[tableName] = 0
        }
    }

    const totalDeleted = Object.values(results).reduce((sum, count) => sum + count, 0)
    console.log(`Cleanup complete. Total records deleted: ${totalDeleted}`)
    
    return results
}

