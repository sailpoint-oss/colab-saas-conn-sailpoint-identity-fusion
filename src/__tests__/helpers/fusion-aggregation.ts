/**
 * This file re-exports aggregation functions from ModelUtils for backward compatibility.
 * All aggregation functions have been moved to ModelUtils.ts to make them reusable
 * for both Fusion and Airtable sources.
 */

export {
    AggregationResult,
    triggerAggregation,
    pollAggregationStatus,
    runAggregationAndWait,
    verifyAccountAggregated,
} from './ModelUtils'

