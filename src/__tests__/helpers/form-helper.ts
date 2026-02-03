import axios from 'axios'

/**
 * Get all forms that match a filter
 * @param token - SailPoint authentication token
 * @param baseUrl - Base URL for the SailPoint API
 * @param filterQuery - Filter query string (e.g., 'name sw "Identity Merging"')
 * @returns Array of form definitions
 */
export async function getFormsByFilter(
    token: string,
    baseUrl: string,
    filterQuery: string
): Promise<any[]> {
    const url = `${baseUrl}/v2025/form-definitions/export`
    
    try {
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            params: {
                filters: filterQuery
            }
        })
        
        if (response.data && Array.isArray(response.data)) {
            console.log(`Found ${response.data.length} form(s) matching filter: ${filterQuery}`)
            return response.data
        } else {
            console.log('No forms found matching the filter')
            return []
        }
    } catch (error: any) {
        console.error('Error fetching forms:', error.response?.data || error.message)
        throw error
    }
}

/**
 * Delete a form definition by ID
 * @param token - SailPoint authentication token
 * @param baseUrl - Base URL for the SailPoint API
 * @param formDefinitionId - ID of the form definition to delete
 */
export async function deleteFormDefinition(
    token: string,
    baseUrl: string,
    formDefinitionId: string
): Promise<void> {
    const url = `${baseUrl}/v2025/form-definitions/${formDefinitionId}`
    
    try {
        await axios.delete(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        
        console.log(`✓ Deleted form definition: ${formDefinitionId}`)
    } catch (error: any) {
        console.error(`Error deleting form ${formDefinitionId}:`, error.response?.data || error.message)
        throw error
    }
}

/**
 * Clean up all forms that start with "Identity Merging"
 * @param token - SailPoint authentication token
 * @param baseUrl - Base URL for the SailPoint API
 * @returns Number of forms deleted
 */
export async function cleanupIdentityMergingForms(
    token: string,
    baseUrl: string
): Promise<number> {
    console.log('Cleaning up Identity Merging forms...')
    
    try {
        // Get all forms that start with "Identity Merging"
        const forms = await getFormsByFilter(token, baseUrl, 'name sw "Identity Merging"')
        
        if (forms.length === 0) {
            console.log('No Identity Merging forms to clean up')
            return 0
        }
        
        // Delete each form
        let deletedCount = 0
        for (const form of forms) {
            try {
                await deleteFormDefinition(token, baseUrl, form.object.id)
                deletedCount++
            } catch (error) {
                console.error(`Failed to delete form ${form.object.id}, continuing...`)
            }
        }
        
        console.log(`Successfully cleaned up ${deletedCount} Identity Merging form(s)`)
        return deletedCount
    } catch (error: any) {
        console.error('Error during form cleanup:', error.message)
        throw error
    }
}

