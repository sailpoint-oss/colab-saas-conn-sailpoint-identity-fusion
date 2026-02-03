/**
 * Unified geographic data interface for US and UK
 * Replaces the heavy 'country-state-city' library (17MB)
 * 
 * This module provides a compatibility layer that combines:
 * - US data from usGeoData.ts
 * - UK data from ukGeoData.ts
 * 
 * Total size: ~28KB vs 17MB for the full library (~600x reduction)
 */

import * as US from './usGeoData'
import * as UK from './ukGeoData'

// Re-export US and UK modules for direct access
export { US, UK }

// Re-export types
export type { USState, USCity } from './usGeoData'
export type { UKRegion, UKCity } from './ukGeoData'

/**
 * Unified City API compatible with country-state-city library
 * Supports both 'US', 'GB', and 'UK' country codes
 */
export const City = {
    getCitiesOfCountry: (countryCode: string) => {
        if (countryCode === 'US') {
            return US.City.getCitiesOfCountry(countryCode)
        }
        if (countryCode === 'GB' || countryCode === 'UK') {
            return UK.UKCity.getCitiesOfCountry(countryCode)
        }
        return undefined
    },
}

/**
 * Unified State API compatible with country-state-city library
 * Supports both 'US', 'GB', and 'UK' country codes
 */
export const State = {
    getStateByCodeAndCountry: (stateCode: string, countryCode: string) => {
        if (countryCode === 'US') {
            return US.State.getStateByCodeAndCountry(stateCode, countryCode)
        }
        if (countryCode === 'GB' || countryCode === 'UK') {
            return UK.UKState.getStateByCodeAndCountry(stateCode, countryCode)
        }
        return undefined
    },
}
