import { Attributes } from '@sailpoint/connector-sdk'

/** Raw data for constructing a status entitlement. */
export type StatusSource = {
    id: string
    name: string
    description: string
}

/**
 * A status entitlement representing a fusion account's processing state.
 * Statuses include: uncorrelated, baseline, unmatched, manual, authorized, etc.
 */
export class Status {
    identity: string
    uuid: string
    type: string = 'status'
    attributes: Attributes

    constructor(object: StatusSource) {
        this.attributes = { ...object }
        this.identity = this.attributes.id as string
        this.uuid = this.attributes.name as string
    }
}
