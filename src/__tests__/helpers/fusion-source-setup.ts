import axios from 'axios'
import env from 'dotenv'
import { Configuration } from '../test-config'

env.config()

// Global storage for the spConnectorInstanceId
let cachedSpConnectorInstanceId: string | null = null

export interface FusionSourceInfo {
    token: string
    spConnectorInstanceId: string
    fusionSourceId: string
}

export interface FusionTestConfig {
    clientId: string
    clientSecret: string
    baseurl: string
    spConnectorInstanceId: string
    sources: string[]
    cloudDisplayName: string
    merging_map: any[]
    global_merging_score: boolean
    merging_score: number
    merging_isEnabled: boolean
    merging_attributes: string[]
    merging_expirationDays: number
    attributeMerge: string
    global_merging_identical: boolean
    reset: boolean
    uid_template: string
    uid_scope: string
}

/**
 * Get the Fusion test configuration using the globally cached spConnectorInstanceId
 */
export function getFusionTestConfig(): FusionTestConfig {
    if (!cachedSpConnectorInstanceId) {
        throw new Error('spConnectorInstanceId not set. Please call setupFusionSource() first.')
    }
    
    return {
        clientId: process.env.SAIL_CLIENT_ID!,
        clientSecret: process.env.SAIL_CLIENT_SECRET!,
        baseurl: process.env.SAIL_BASE_URL!,
        spConnectorInstanceId: cachedSpConnectorInstanceId,
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
        attributeMerge: 'first',
        global_merging_identical: false,
        reset: true,
        uid_template: '#set($initial = $firstname.substring(0, 1))$initial$lastname$counter',
        uid_scope: 'source',
    }
}

/**
 * Get the Fusion test configuration with automatic spConnectorInstanceId lookup
 * @param sourceName - Name of the fusion source (defaults to 'Fusion Integration Test Source')
 * @returns FusionTestConfig with automatically found spConnectorInstanceId
 */
export async function getAutoFusionTestConfig(sourceName: string = 'Fusion Integration Test Source'): Promise<FusionTestConfig> {
    // Get SailPoint token
    const config = new Configuration()
    const token = await config.getToken(
        process.env.SAIL_BASE_URL!,
        process.env.SAIL_CLIENT_ID!,
        process.env.SAIL_CLIENT_SECRET!
    )

    // Fetch the fusion connector instance ID by searching for the source
    const sourcesUrl = `${process.env.SAIL_BASE_URL}/v2025/sources?filters=name eq "${sourceName}"`
    
    try {
        const response = await axios.get(sourcesUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        })

        if (response.data && response.data.length > 0) {
            const spConnectorInstanceId = response.data[0].connectorAttributes.spConnectorInstanceId
            console.log(`Found connector instance ID: ${spConnectorInstanceId}`)
            // Cache the spConnectorInstanceId
            cachedSpConnectorInstanceId = spConnectorInstanceId
            return getFusionTestConfig()
        } else {
            throw new Error(`Source "${sourceName}" not found`)
        }
    } catch (error) {
        console.error('Failed to fetch connector instance ID:', error)
        throw error
    }
}

/**
 * Update the Fusion source configuration by patching the connector attributes
 * @param token - SailPoint authentication token
 * @param fusionSourceId - ID of the fusion source to update
 * @param fusionConfig - Fusion test configuration to apply
 */
export async function updateFusionSourceConfig(
    token: string,
    fusionSourceId: string,
    fusionConfig: FusionTestConfig
): Promise<void> {
    console.log(`Patching Fusion source ${fusionSourceId} with test configuration`)
    
    // Create JSON Patch operations for the connector attributes
    const patchOperations = [
        {
            op: 'add',
            path: '/connectorAttributes/clientId',
            value: fusionConfig.clientId,
        },
        {
            op: 'add',
            path: '/connectorAttributes/clientSecret',
            value: fusionConfig.clientSecret,
        },
        {
            op: 'add',
            path: '/connectorAttributes/baseurl',
            value: fusionConfig.baseurl,
        },
        {
            op: 'add',
            path: '/connectorAttributes/spConnectorInstanceId',
            value: fusionConfig.spConnectorInstanceId,
        },
        {
            op: 'add',
            path: '/connectorAttributes/sources',
            value: fusionConfig.sources,
        },
        {
            op: 'add',
            path: '/connectorAttributes/cloudDisplayName',
            value: fusionConfig.cloudDisplayName,
        },
        {
            op: 'add',
            path: '/connectorAttributes/merging_map',
            value: fusionConfig.merging_map,
        },
        {
            op: 'add',
            path: '/connectorAttributes/global_merging_score',
            value: fusionConfig.global_merging_score,
        },
        {
            op: 'add',
            path: '/connectorAttributes/merging_score',
            value: fusionConfig.merging_score.toString(),
        },
        {
            op: 'add',
            path: '/connectorAttributes/merging_isEnabled',
            value: fusionConfig.merging_isEnabled,
        },
        {
            op: 'add',
            path: '/connectorAttributes/merging_attributes',
            value: fusionConfig.merging_attributes,
        },
        {
            op: 'add',
            path: '/connectorAttributes/merging_expirationDays',
            value: fusionConfig.merging_expirationDays.toString(),
        },
        {
            op: 'add',
            path: '/connectorAttributes/attributeMerge',
            value: fusionConfig.attributeMerge,
        },
        {
            op: 'add',
            path: '/connectorAttributes/global_merging_identical',
            value: fusionConfig.global_merging_identical,
        },
        {
            op: 'add',
            path: '/connectorAttributes/reset',
            value: fusionConfig.reset,
        },
        {
            op: 'add',
            path: '/connectorAttributes/uid_template',
            value: fusionConfig.uid_template,
        },
        {
            op: 'add',
            path: '/connectorAttributes/uid_scope',
            value: fusionConfig.uid_scope,
        },
    ]

    try {
        await axios.patch(
            `${process.env.SAIL_BASE_URL}/v2025/sources/${fusionSourceId}`,
            patchOperations,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json-patch+json',
                    Accept: 'application/json',
                },
            }
        )
        console.log('Successfully patched Fusion source with test configuration')
    } catch (error: any) {
        console.error('Failed to patch Fusion source:', error.response?.data || error.message)
        throw new Error(`Failed to patch Fusion source: ${error.response?.data?.message || error.message}`)
    }
}

/**
 * Setup Fusion source for testing:
 * 1. Authenticate with SailPoint
 * 2. Find the Fusion Integration Test Source
 * 3. Patch it with test configuration
 */
export async function setupFusionSource(sourceName: string = 'Fusion Integration Test Source'): Promise<FusionSourceInfo> {
    // Get SailPoint token
    const config = new Configuration()
    const token = await config.getToken(
        process.env.SAIL_BASE_URL!,
        process.env.SAIL_CLIENT_ID!,
        process.env.SAIL_CLIENT_SECRET!
    )

    // Fetch the fusion connector instance ID and source ID by searching for the source
    const sourcesUrl = `${process.env.SAIL_BASE_URL}/v2025/sources?filters=name eq "${sourceName}"`
    
    let spConnectorInstanceId: string
    let fusionSourceId: string

    try {
        const response = await axios.get(sourcesUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        })

        if (response.data && response.data.length > 0) {
            spConnectorInstanceId = response.data[0].connectorAttributes.spConnectorInstanceId
            fusionSourceId = response.data[0].id
            console.log(`Found connector instance ID: ${spConnectorInstanceId} and fusion source ID: ${fusionSourceId}`)
            // Cache the spConnectorInstanceId globally
            cachedSpConnectorInstanceId = spConnectorInstanceId
        } else {
            throw new Error(`Source "${sourceName}" not found`)
        }
    } catch (error) {
        console.error('Failed to fetch connector instance ID:', error)
        throw error
    }

    // Get test configuration and update the fusion source
    const testConfig = getFusionTestConfig()
    await updateFusionSourceConfig(token, fusionSourceId, testConfig)

    return {
        token,
        spConnectorInstanceId,
        fusionSourceId,
    }
}

