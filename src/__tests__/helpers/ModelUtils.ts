import { Collaborator, Attachment } from "airtable";
import axios from 'axios'
import env from 'dotenv'

env.config()

export interface AggregationResult {
    aggregationId: string
    status: string
    totalAccounts?: number
}

export class Util {
    public static ensureString(data: string | number | boolean | Collaborator | readonly Collaborator[] | readonly string[] | readonly Attachment[] | undefined): string {
        if (typeof data == 'string') {
            return data;
        } else {
            return ''
        }
    }

    public static stringToBoolean(data: string) {
        if (data.toUpperCase() == 'FALSE') {
            return false
        } else {
            return true
        }
    }

    public static ensureAttribute(attribute: any): string {
        if (attribute !== undefined && attribute !== null) {
            if (typeof attribute == 'string') {
                return attribute;
            } else {
                return ''
            }
        } else {
            return ''
        }
    }
}

/**
 * Trigger account aggregation for a source
 */
export async function triggerAggregation(
    token: string,
    sourceId: string
): Promise<string> {
    console.log(`Triggering account aggregation for source: ${sourceId}`)
    
    try {
        const response = await axios.post(
            `${process.env.SAIL_BASE_URL}/v2025/sources/${sourceId}/load-accounts`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            }
        )

        const aggregationId = response.data.task.id
        console.log(`Aggregation started with ID: ${aggregationId}`)
        return aggregationId
    } catch (error: any) {
        throw new Error(`Failed to trigger aggregation: ${error.response?.data || error.message}`)
    }
}

/**
 * Poll aggregation status until complete or timeout
 */
export async function pollAggregationStatus(
    token: string,
    aggregationId: string,
    maxAttempts: number = 20,
    pollIntervalMs: number = 30000
): Promise<AggregationResult> {
    console.log('Polling aggregation status...')
    let attempts = 0
    let aggregationComplete = false
    let aggregationStatus: any

    while (attempts < maxAttempts && !aggregationComplete) {
        attempts++
        
        // Wait before checking status (5 seconds on first attempt, then use pollIntervalMs)
        if (attempts > 1) {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
        } else {
            await new Promise((resolve) => setTimeout(resolve, 5000))
        }

        try {
            const statusResponse = await axios.get(
                `${process.env.SAIL_BASE_URL}/v2025/account-aggregations/${aggregationId}/status`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            )

            aggregationStatus = statusResponse.data
            console.log(`Aggregation status (attempt ${attempts}): ${aggregationStatus.status}`)

            // Check if aggregation is complete
            if (aggregationStatus.status === 'COMPLETED') {
                aggregationComplete = true
                console.log('Aggregation completed successfully')
            } else if (aggregationStatus.status === 'Failed' || aggregationStatus.status === 'Error') {
                throw new Error(`Aggregation failed with status: ${aggregationStatus.status}`)
            }
        } catch (error: any) {
            // If it's an aggregation failure, rethrow
            if (error.message.includes('Aggregation failed')) {
                throw error
            }
            // Otherwise log and continue polling
            console.error(`Failed to check aggregation status: ${error.response?.data || error.message}`)
        }
    }

    if (!aggregationComplete) {
        throw new Error(`Aggregation did not complete within ${maxAttempts * pollIntervalMs / 1000} seconds`)
    }

    return {
        aggregationId,
        status: aggregationStatus.status,
        totalAccounts: aggregationStatus.totalAccounts,
    }
}

/**
 * Trigger aggregation and wait for completion
 */
export async function runAggregationAndWait(
    token: string,
    sourceId: string,
    maxAttempts: number = 20,
    pollIntervalMs: number = 30000
): Promise<AggregationResult> {
    const aggregationId = await triggerAggregation(token, sourceId)
    const result = await pollAggregationStatus(token, aggregationId, maxAttempts, pollIntervalMs)
    
    console.log(`Aggregation completed. Total accounts: ${result.totalAccounts || 'N/A'}`)
    return result
}

/**
 * Verify an account was aggregated by searching for it
 * Searches through all accounts in the source to find one with matching attributes.id
 */
export async function verifyAccountAggregated(
    token: string,
    sourceId: string,
    nativeIdentity: string,
    expectedEmail?: string
): Promise<any> {
    console.log(`Verifying account with id ${nativeIdentity} was aggregated...`)
    
    try {
        // Get all accounts for the source
        const response = await axios.get(
            `${process.env.SAIL_BASE_URL}/v2025/accounts?filters=sourceId eq "${sourceId}"`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        )

        const allAccounts = response.data
        
        if (!allAccounts || allAccounts.length === 0) {
            throw new Error(`No accounts found for source ${sourceId}`)
        }
        
        console.log(`Found ${allAccounts.length} account(s) for source. Searching for id: ${nativeIdentity}`)
        
        // Loop through accounts to find the one with matching attributes.id
        const foundAccount = allAccounts.find((account: any) => {
            const accountId = account.attributes?.id
            return accountId === nativeIdentity
        })
        
        if (!foundAccount) {
            throw new Error(`Account with id ${nativeIdentity} was not found after aggregation`)
        }
        
        console.log(`Successfully found aggregated account with nativeIdentity: ${foundAccount.nativeIdentity}, attributes.id: ${foundAccount.attributes?.id}`)
        
        // Verify email if provided
        if (expectedEmail) {
            const accountEmail = foundAccount.attributes?.email || foundAccount.attributes?.Email
            if (accountEmail !== expectedEmail) {
                console.warn(`Email mismatch: expected ${expectedEmail}, got ${accountEmail}`)
            }
        }
        
        return foundAccount
    } catch (error: any) {
        throw new Error(`Failed to verify aggregated account: ${error.response?.data || error.message}`)
    }
}
