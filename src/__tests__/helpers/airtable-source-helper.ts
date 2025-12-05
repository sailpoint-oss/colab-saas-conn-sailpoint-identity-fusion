import axios from 'axios'
import env from 'dotenv'
import { Configuration } from '../test-config'
import { runAggregationAndWait, AggregationResult } from './ModelUtils'

env.config()

export interface AirtableSourceInfo {
    token: string
    sourceId: string
    sourceName: string
}

/**
 * Find Airtable source by name
 * @param token - SailPoint authentication token
 * @param sourceName - Name of the Airtable source to find
 * @returns AirtableSourceInfo with source details
 */
export async function findAirtableSource(
    token: string,
    sourceName: string
): Promise<AirtableSourceInfo> {
    console.log(`Searching for Airtable source: ${sourceName}`)
    
    const sourcesUrl = `${process.env.SAIL_BASE_URL}/v2025/sources?filters=name eq "${sourceName}"`
    
    try {
        const response = await axios.get(sourcesUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        })

        if (response.data && response.data.length > 0) {
            const sourceId = response.data[0].id
            console.log(`Found Airtable source: ${sourceName} with ID: ${sourceId}`)
            
            return {
                token,
                sourceId,
                sourceName,
            }
        } else {
            throw new Error(`Airtable source "${sourceName}" not found`)
        }
    } catch (error) {
        console.error(`Failed to find Airtable source ${sourceName}:`, error)
        throw error
    }
}

/**
 * Get authentication token for SailPoint
 * @returns Authentication token
 */
export async function getAuthToken(): Promise<string> {
    const config = new Configuration()
    const token = await config.getToken(
        process.env.SAIL_BASE_URL!,
        process.env.SAIL_CLIENT_ID!,
        process.env.SAIL_CLIENT_SECRET!
    )
    return token
}

/**
 * Setup Airtable source for aggregation
 * @param sourceName - Name of the Airtable source (e.g., 'Fusion Integration Test Primary')
 * @returns AirtableSourceInfo with authentication and source details
 */
export async function setupAirtableSource(
    sourceName: string = 'Fusion Integration Test Primary'
): Promise<AirtableSourceInfo> {
    // Get SailPoint token
    const token = await getAuthToken()
    
    // Find the Airtable source
    const sourceInfo = await findAirtableSource(token, sourceName)
    
    return sourceInfo
}

/**
 * Trigger aggregation on an Airtable source and wait for completion
 * @param sourceInfo - Airtable source information
 * @param maxAttempts - Maximum number of polling attempts (default: 20)
 * @param pollIntervalMs - Polling interval in milliseconds (default: 30000)
 * @returns Aggregation result with status and account count
 */
export async function aggregateAirtableSource(
    sourceInfo: AirtableSourceInfo,
    maxAttempts: number = 20,
    pollIntervalMs: number = 30000
): Promise<AggregationResult> {
    console.log(`Starting aggregation for Airtable source: ${sourceInfo.sourceName}`)
    
    const result = await runAggregationAndWait(
        sourceInfo.token,
        sourceInfo.sourceId,
        maxAttempts,
        pollIntervalMs
    )
    
    console.log(`Airtable source ${sourceInfo.sourceName} aggregation completed. Total accounts: ${result.totalAccounts || 'N/A'}`)
    return result
}

