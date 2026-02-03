import {
    FormInstanceResponseV2025,
    FormDefinitionInputV2025,
} from 'sailpoint-api-client'
import { FusionDecision } from '../../model/form'
import { IdentityService } from '../identityService'
import { assert } from '../../utils/assert'

// ============================================================================
// Form Processing Functions
// ============================================================================

/**
 * Get reviewer information from identity ID
 */
export const getReviewerInfo = (
    identityId: string,
    identities?: IdentityService
): { id: string; email: string; name: string } | undefined => {
    if (!identities) {
        return {
            id: identityId,
            email: '',
            name: '',
        }
    }

    const identity = identities.getIdentityById(identityId)
    if (!identity) {
        return {
            id: identityId,
            email: '',
            name: identityId,
        }
    }

    return {
        id: identityId,
        email: identity.attributes?.email || '',
        name: identity.name || identity.attributes?.displayName || identityId,
    }
}


/**
 * Extract account information from form input
 * Handles both flat structure { account: "...", name: "...", source: "..." }
 * and dictionary structure where formInput is an object with input objects keyed by id
 */
const extractAccountInfo = (formInput: any): { id: string; name: string; sourceName: string } | null => {
    let accountId: string | undefined
    let accountName: string | undefined
    let accountSource: string | undefined

    // Try flat structure first (as sent in createFormInstance)
    if (typeof formInput.account === 'string') {
        accountId = formInput.account
        accountName = formInput.name
        accountSource = formInput.source
    } else if (formInput.account && typeof formInput.account === 'object' && formInput.account.value) {
        // Account is an object with value property
        accountId = formInput.account.value
        accountName = formInput.account.displayName || formInput.name
        accountSource = formInput.account.sourceName || formInput.source
    } else {
        // Try dictionary structure (formInput is an object with input objects)
        const formInputs = formInput as FormDefinitionInputV2025 | undefined
        const accountInput = Object.values(formInputs ?? {}).find(
            (x) => x && x.id === 'account' && (x.value?.length ?? 0) > 0
        )
        if (accountInput?.value) {
            accountId = accountInput.value
            const nameInput = Object.values(formInputs ?? {}).find((x) => x && x.id === 'name')
            accountName = nameInput?.value || nameInput?.description
            const sourceInput = Object.values(formInputs ?? {}).find((x) => x && x.id === 'source')
            accountSource = sourceInput?.value || sourceInput?.description
        }
    }

    if (!accountId) {
        return null
    }

    return {
        id: accountId,
        name: accountName || accountId,
        sourceName: accountSource || '',
    }
}

/**
 * Create fusion decision from completed form instance
 * accountInfoOverride allows overriding account info from managedAccountsById before it's deleted
 * Returns null if decision cannot be created
 */
export const createFusionDecision = (
    formInstance: FormInstanceResponseV2025,
    identities?: IdentityService,
    accountInfoOverride?: { id: string; name: string; sourceName: string }
): FusionDecision | null => {
    assert(formInstance, 'Form instance is required')
    assert(formInstance.id, 'Form instance ID is required')

    const finished = formInstance.state === 'COMPLETED' || formInstance.state === 'IN_PROGRESS'

    const { formData, formInput, recipients } = formInstance

    if (!formInput || !recipients || recipients.length === 0) {
        return null
    }

    // Use accountInfoOverride if provided (from managedAccountsById), otherwise extract from formInput
    const accountInfo = accountInfoOverride || extractAccountInfo(formInput)
    if (!accountInfo) {
        return null
    }

    const isNewIdentity = formData?.newIdentity ?? true
    // SELECT elements with dataSource return arrays, extract the first element
    const identitiesValue = formData?.identities
    const existingIdentity = isNewIdentity
        ? undefined
        : Array.isArray(identitiesValue)
            ? identitiesValue[0]
            : identitiesValue

    const reviewerIdentityId = recipients[0].id
    if (!reviewerIdentityId) {
        return null
    }

    const reviewer = getReviewerInfo(reviewerIdentityId, identities)
    if (!reviewer) {
        return null
    }

    return {
        submitter: reviewer,
        account: accountInfo,
        newIdentity: isNewIdentity,
        identityId: existingIdentity,
        comments: formData?.comments || '',
        finished,
        formUrl: formInstance.standAloneFormUrl ?? undefined,
    }
}
