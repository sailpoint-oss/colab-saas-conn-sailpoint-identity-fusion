import { Attributes } from '@sailpoint/connector-sdk'

/** Raw data for constructing an action entitlement. */
export type ActionSource = {
    id: string
    name: string
    description: string
}

/**
 * An action entitlement that can be assigned to a fusion account.
 * Actions trigger specific processing (e.g. report, fusion, correlate).
 */
export class Action {
    identity: string
    uuid: string
    type: string = 'action'
    attributes: Attributes

    constructor(object: ActionSource) {
        this.attributes = { ...object }
        this.identity = this.attributes.id as string
        this.uuid = this.attributes.name as string
    }
}
