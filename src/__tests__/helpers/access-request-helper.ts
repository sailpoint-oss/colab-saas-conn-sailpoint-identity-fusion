import axios from 'axios'

/**
 * Find an access profile by name
 */
export async function getAccessProfileByName(
    token: string,
    baseUrl: string,
    accessProfileName: string
): Promise<any> {
    const url = `${baseUrl}/v2025/access-profiles`
    
    try {
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            params: {
                filters: `name eq "${accessProfileName}"`
            }
        })
        
        if (response.data && response.data.length > 0) {
            console.log(`Found access profile "${accessProfileName}":`, response.data[0].id)
            return response.data[0]
        } else {
            throw new Error(`Access profile with name "${accessProfileName}" not found`)
        }
    } catch (error: any) {
        console.error('Error fetching access profile:', error.response?.data || error.message)
        throw error
    }
}

/**
 * Get identity ID by public identifier (e.g., username)
 */
export async function getIdentityId(token: string, baseUrl: string, publicIdentifier: string): Promise<string> {
    const url = `${baseUrl}/v2025/identities?filters=name eq "${publicIdentifier}"`
    
    try {
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        
        if (response.data && response.data.length > 0) {
            console.log(`Found identity ID for ${publicIdentifier}: ${response.data[0].id}`)
            return response.data[0].id
        } else {
            throw new Error(`Identity with public identifier "${publicIdentifier}" not found`)
        }
    } catch (error: any) {
        console.error('Error getting identity ID:', error.response?.data || error.message)
        throw error
    }
}

/**
 * Create an access request for a specific access profile
 */
export async function createAccessRequest(
    token: string,
    baseUrl: string,
    accessProfileId: string,
    identityId: string
): Promise<any> {
    const url = `${baseUrl}/v2025/access-requests`
    
    const requestBody = {
        requestedFor: [identityId],
        requestType: 'GRANT_ACCESS',
        requestedItems: [
            {
                type: 'ACCESS_PROFILE',
                id: accessProfileId,
                comment: 'Requesting access via API for integration test'
            }
        ]
    }

    try {
        const response = await axios.post(url, requestBody, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        
        console.log('Access request created successfully:', response.data)
        return response.data
    } catch (error: any) {
        console.error('Error creating access request:', error.response?.data || error.message)
        throw error
    }
}

/**
 * Get access request status
 */
export async function getAccessRequestStatus(
    token: string,
    baseUrl: string,
    accessRequestId: string
): Promise<any> {
    const url = `${baseUrl}/v2025/access-request-status`

    try {
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            params: {
                filters: `accessRequestId eq "${accessRequestId}"`
            }
        })
        
        return response.data
    } catch (error: any) {
        console.error('Error getting access request status:', error.response?.data || error.message)
        throw error
    }
}

/**
 * Wait for access request to complete (reach FINISHED state)
 */
export async function waitForAccessRequestCompletion(
    token: string,
    baseUrl: string,
    accessRequestId: string,
    maxWaitTimeMs: number = 220000,
    pollIntervalMs: number = 5000
): Promise<any> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTimeMs) {
        const status = await getAccessRequestStatus(token, baseUrl, accessRequestId)
        
        if (status.length !== 0) {
            console.log(`Access request ${accessRequestId} status: ${status[0].state}`)
            
            if (status[0].state === 'REQUEST_COMPLETED') {
                console.log('Access request completed successfully')
                return status
            }
        }
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }
    
    throw new Error(`Access request ${accessRequestId} did not complete within ${maxWaitTimeMs}ms`)
}

