import axios from 'axios'
import env from 'dotenv'
import { Configuration } from '../test-config'

env.config()

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
 * Get the Fusion test configuration
 */
export function getFusionTestConfig(spConnectorInstanceId: string): FusionTestConfig {
    return {
        clientId: process.env.SAIL_CLIENT_ID!,
        clientSecret: process.env.SAIL_CLIENT_SECRET!,
        baseurl: process.env.SAIL_BASE_URL!,
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
        attributeMerge: 'first',
        global_merging_identical: false,
        reset: true,
        uid_template: '#set($initial = $firstname.substring(0, 1))$initial$lastname$counter',
        uid_scope: 'source',
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

    // Fetch the fusion connector instance ID by searching for the source
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
        } else {
            throw new Error(`Source "${sourceName}" not found`)
        }
    } catch (error) {
        console.error('Failed to fetch connector instance ID:', error)
        throw error
    }

    // Patch the existing Fusion source with test configuration
    console.log(`Patching Fusion source ${fusionSourceId} with test configuration`)
    
    const testConfig = getFusionTestConfig(spConnectorInstanceId)
    
    // Create JSON Patch operations for the connector attributes
    const patchOperations = [
        {
            op: 'add',
            path: '/connectorAttributes/clientId',
            value: testConfig.clientId,
        },
        {
            op: 'add',
            path: '/connectorAttributes/clientSecret',
            value: testConfig.clientSecret,
        },
        {
            op: 'add',
            path: '/connectorAttributes/baseurl',
            value: testConfig.baseurl,
        },
        {
            op: 'add',
            path: '/connectorAttributes/spConnectorInstanceId',
            value: testConfig.spConnectorInstanceId,
        },
        {
            op: 'add',
            path: '/connectorAttributes/sources',
            value: testConfig.sources,
        },
        {
            op: 'add',
            path: '/connectorAttributes/cloudDisplayName',
            value: testConfig.cloudDisplayName,
        },
        {
            op: 'add',
            path: '/connectorAttributes/merging_map',
            value: testConfig.merging_map,
        },
        {
            op: 'add',
            path: '/connectorAttributes/global_merging_score',
            value: testConfig.global_merging_score,
        },
        {
            op: 'add',
            path: '/connectorAttributes/merging_score',
            value: testConfig.merging_score.toString(),
        },
        {
            op: 'add',
            path: '/connectorAttributes/merging_isEnabled',
            value: testConfig.merging_isEnabled,
        },
        {
            op: 'add',
            path: '/connectorAttributes/merging_attributes',
            value: testConfig.merging_attributes,
        },
        {
            op: 'add',
            path: '/connectorAttributes/merging_expirationDays',
            value: testConfig.merging_expirationDays.toString(),
        },
        {
            op: 'add',
            path: '/connectorAttributes/attributeMerge',
            value: testConfig.attributeMerge,
        },
        {
            op: 'add',
            path: '/connectorAttributes/global_merging_identical',
            value: testConfig.global_merging_identical,
        },
        {
            op: 'add',
            path: '/connectorAttributes/reset',
            value: testConfig.reset,
        },
        {
            op: 'add',
            path: '/connectorAttributes/uid_template',
            value: testConfig.uid_template,
        },
        {
            op: 'add',
            path: '/connectorAttributes/uid_scope',
            value: testConfig.uid_scope,
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

    return {
        token,
        spConnectorInstanceId,
        fusionSourceId,
    }
}

