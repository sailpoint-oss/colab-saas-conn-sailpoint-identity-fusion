import { Status } from '../model/status'
import { Action } from '../model/action'
import { statuses } from '../data/status'
import { actions } from '../data/action'
import { SourceService } from './sourceService'

/**
 * Service for building status and action entitlements.
 */
export class EntitlementService {
    /**
     * @param sources - Source service for accessing managed source names (used for reviewer entitlements)
     */
    constructor(private sources: SourceService) {}

    /**
     * Builds the list of status entitlements from the static status definitions.
     *
     * @returns Array of Status entitlement objects
     */
    public listStatusEntitlements(): Status[] {
        return statuses.map((x) => new Status(x))
    }

    /**
     * Builds the list of action entitlements, including static actions (report, fusion, correlate)
     * and dynamic per-source reviewer entitlements.
     *
     * @returns Array of Action entitlement objects
     */
    public listActionEntitlements(): Action[] {
        const sources = this.sources.managedSources
        const actionEntitlements = actions.map((x) => new Action(x))

        // Create source-specific reviewer entitlements
        const sourceInput = sources.map(({ id, name }) => ({
            id: `reviewer:${id!}`,
            name: `${name} reviewer`,
            description: `Reviewer for potentially duplicated identities from ${name} source`,
        }))

        const sourceEntitlements = sourceInput.map((x) => new Action(x))
        return [...actionEntitlements, ...sourceEntitlements]
    }
}
