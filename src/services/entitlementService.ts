import { LogService } from './logService'
import { Status } from '../model/status'
import { Action } from '../model/action'
import { statuses } from '../data/status'
import { actions } from '../data/action'
import { SourceService } from './sourceService'

/**
 * Service for building status and action entitlements.
 */
export class EntitlementService {
    constructor(
        private log: LogService,
        private sources: SourceService
    ) {}

    /**
     * Build status entitlements
     */
    public listStatusEntitlements(): Status[] {
        return statuses.map((x) => new Status(x))
    }

    /**
     * Build action entitlements
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
