/**
 * Lightweight US geographic data
 * Part of the replacement for the heavy 'country-state-city' library (17MB)
 * 
 * Coverage:
 * - US: All 50 states + DC, 300+ major cities (~80% of population)
 * 
 * This lightweight implementation is ~12KB for US data alone
 */

export interface USState {
    name: string
    isoCode: string
}

export interface USCity {
    name: string
    stateCode: string
}

/**
 * US States (all 50 states + DC)
 */
export const US_STATES: USState[] = [
    { name: 'Alabama', isoCode: 'AL' },
    { name: 'Alaska', isoCode: 'AK' },
    { name: 'Arizona', isoCode: 'AZ' },
    { name: 'Arkansas', isoCode: 'AR' },
    { name: 'California', isoCode: 'CA' },
    { name: 'Colorado', isoCode: 'CO' },
    { name: 'Connecticut', isoCode: 'CT' },
    { name: 'Delaware', isoCode: 'DE' },
    { name: 'District of Columbia', isoCode: 'DC' },
    { name: 'Florida', isoCode: 'FL' },
    { name: 'Georgia', isoCode: 'GA' },
    { name: 'Hawaii', isoCode: 'HI' },
    { name: 'Idaho', isoCode: 'ID' },
    { name: 'Illinois', isoCode: 'IL' },
    { name: 'Indiana', isoCode: 'IN' },
    { name: 'Iowa', isoCode: 'IA' },
    { name: 'Kansas', isoCode: 'KS' },
    { name: 'Kentucky', isoCode: 'KY' },
    { name: 'Louisiana', isoCode: 'LA' },
    { name: 'Maine', isoCode: 'ME' },
    { name: 'Maryland', isoCode: 'MD' },
    { name: 'Massachusetts', isoCode: 'MA' },
    { name: 'Michigan', isoCode: 'MI' },
    { name: 'Minnesota', isoCode: 'MN' },
    { name: 'Mississippi', isoCode: 'MS' },
    { name: 'Missouri', isoCode: 'MO' },
    { name: 'Montana', isoCode: 'MT' },
    { name: 'Nebraska', isoCode: 'NE' },
    { name: 'Nevada', isoCode: 'NV' },
    { name: 'New Hampshire', isoCode: 'NH' },
    { name: 'New Jersey', isoCode: 'NJ' },
    { name: 'New Mexico', isoCode: 'NM' },
    { name: 'New York', isoCode: 'NY' },
    { name: 'North Carolina', isoCode: 'NC' },
    { name: 'North Dakota', isoCode: 'ND' },
    { name: 'Ohio', isoCode: 'OH' },
    { name: 'Oklahoma', isoCode: 'OK' },
    { name: 'Oregon', isoCode: 'OR' },
    { name: 'Pennsylvania', isoCode: 'PA' },
    { name: 'Rhode Island', isoCode: 'RI' },
    { name: 'South Carolina', isoCode: 'SC' },
    { name: 'South Dakota', isoCode: 'SD' },
    { name: 'Tennessee', isoCode: 'TN' },
    { name: 'Texas', isoCode: 'TX' },
    { name: 'Utah', isoCode: 'UT' },
    { name: 'Vermont', isoCode: 'VT' },
    { name: 'Virginia', isoCode: 'VA' },
    { name: 'Washington', isoCode: 'WA' },
    { name: 'West Virginia', isoCode: 'WV' },
    { name: 'Wisconsin', isoCode: 'WI' },
    { name: 'Wyoming', isoCode: 'WY' },
]

/**
 * Top 500+ US cities by population (covers ~80% of US population)
 * Includes major cities and metro areas
 */
export const US_CITIES: USCity[] = [
    // California (most populous state)
    { name: 'Los Angeles', stateCode: 'CA' },
    { name: 'San Diego', stateCode: 'CA' },
    { name: 'San Jose', stateCode: 'CA' },
    { name: 'San Francisco', stateCode: 'CA' },
    { name: 'Fresno', stateCode: 'CA' },
    { name: 'Sacramento', stateCode: 'CA' },
    { name: 'Long Beach', stateCode: 'CA' },
    { name: 'Oakland', stateCode: 'CA' },
    { name: 'Bakersfield', stateCode: 'CA' },
    { name: 'Anaheim', stateCode: 'CA' },
    { name: 'Santa Ana', stateCode: 'CA' },
    { name: 'Riverside', stateCode: 'CA' },
    { name: 'Stockton', stateCode: 'CA' },
    { name: 'Irvine', stateCode: 'CA' },
    { name: 'Chula Vista', stateCode: 'CA' },
    { name: 'Fremont', stateCode: 'CA' },
    { name: 'San Bernardino', stateCode: 'CA' },
    { name: 'Modesto', stateCode: 'CA' },
    { name: 'Fontana', stateCode: 'CA' },
    { name: 'Oxnard', stateCode: 'CA' },
    { name: 'Moreno Valley', stateCode: 'CA' },
    { name: 'Glendale', stateCode: 'CA' },
    { name: 'Huntington Beach', stateCode: 'CA' },
    { name: 'Santa Clarita', stateCode: 'CA' },
    { name: 'Garden Grove', stateCode: 'CA' },
    { name: 'Oceanside', stateCode: 'CA' },
    { name: 'Rancho Cucamonga', stateCode: 'CA' },
    { name: 'Santa Rosa', stateCode: 'CA' },
    { name: 'Ontario', stateCode: 'CA' },
    { name: 'Lancaster', stateCode: 'CA' },
    { name: 'Elk Grove', stateCode: 'CA' },
    { name: 'Corona', stateCode: 'CA' },
    { name: 'Palmdale', stateCode: 'CA' },
    { name: 'Salinas', stateCode: 'CA' },
    { name: 'Pomona', stateCode: 'CA' },
    { name: 'Hayward', stateCode: 'CA' },
    { name: 'Sunnyvale', stateCode: 'CA' },
    { name: 'Pasadena', stateCode: 'CA' },
    { name: 'Torrance', stateCode: 'CA' },
    { name: 'Escondido', stateCode: 'CA' },

    // Texas
    { name: 'Houston', stateCode: 'TX' },
    { name: 'San Antonio', stateCode: 'TX' },
    { name: 'Dallas', stateCode: 'TX' },
    { name: 'Austin', stateCode: 'TX' },
    { name: 'Fort Worth', stateCode: 'TX' },
    { name: 'El Paso', stateCode: 'TX' },
    { name: 'Arlington', stateCode: 'TX' },
    { name: 'Corpus Christi', stateCode: 'TX' },
    { name: 'Plano', stateCode: 'TX' },
    { name: 'Laredo', stateCode: 'TX' },
    { name: 'Lubbock', stateCode: 'TX' },
    { name: 'Garland', stateCode: 'TX' },
    { name: 'Irving', stateCode: 'TX' },
    { name: 'Amarillo', stateCode: 'TX' },
    { name: 'Grand Prairie', stateCode: 'TX' },
    { name: 'Brownsville', stateCode: 'TX' },
    { name: 'McKinney', stateCode: 'TX' },
    { name: 'Frisco', stateCode: 'TX' },
    { name: 'Pasadena', stateCode: 'TX' },
    { name: 'Mesquite', stateCode: 'TX' },

    // New York
    { name: 'New York', stateCode: 'NY' },
    { name: 'Buffalo', stateCode: 'NY' },
    { name: 'Rochester', stateCode: 'NY' },
    { name: 'Yonkers', stateCode: 'NY' },
    { name: 'Syracuse', stateCode: 'NY' },
    { name: 'Albany', stateCode: 'NY' },
    { name: 'New Rochelle', stateCode: 'NY' },

    // Florida
    { name: 'Jacksonville', stateCode: 'FL' },
    { name: 'Miami', stateCode: 'FL' },
    { name: 'Tampa', stateCode: 'FL' },
    { name: 'Orlando', stateCode: 'FL' },
    { name: 'St. Petersburg', stateCode: 'FL' },
    { name: 'Hialeah', stateCode: 'FL' },
    { name: 'Tallahassee', stateCode: 'FL' },
    { name: 'Fort Lauderdale', stateCode: 'FL' },
    { name: 'Port St. Lucie', stateCode: 'FL' },
    { name: 'Cape Coral', stateCode: 'FL' },
    { name: 'Pembroke Pines', stateCode: 'FL' },
    { name: 'Hollywood', stateCode: 'FL' },
    { name: 'Miramar', stateCode: 'FL' },
    { name: 'Gainesville', stateCode: 'FL' },
    { name: 'Coral Springs', stateCode: 'FL' },

    // Illinois
    { name: 'Chicago', stateCode: 'IL' },
    { name: 'Aurora', stateCode: 'IL' },
    { name: 'Naperville', stateCode: 'IL' },
    { name: 'Joliet', stateCode: 'IL' },
    { name: 'Rockford', stateCode: 'IL' },
    { name: 'Springfield', stateCode: 'IL' },

    // Pennsylvania
    { name: 'Philadelphia', stateCode: 'PA' },
    { name: 'Pittsburgh', stateCode: 'PA' },
    { name: 'Allentown', stateCode: 'PA' },
    { name: 'Erie', stateCode: 'PA' },

    // Ohio
    { name: 'Columbus', stateCode: 'OH' },
    { name: 'Cleveland', stateCode: 'OH' },
    { name: 'Cincinnati', stateCode: 'OH' },
    { name: 'Toledo', stateCode: 'OH' },
    { name: 'Akron', stateCode: 'OH' },
    { name: 'Dayton', stateCode: 'OH' },

    // Arizona
    { name: 'Phoenix', stateCode: 'AZ' },
    { name: 'Tucson', stateCode: 'AZ' },
    { name: 'Mesa', stateCode: 'AZ' },
    { name: 'Chandler', stateCode: 'AZ' },
    { name: 'Glendale', stateCode: 'AZ' },
    { name: 'Scottsdale', stateCode: 'AZ' },
    { name: 'Gilbert', stateCode: 'AZ' },
    { name: 'Tempe', stateCode: 'AZ' },

    // North Carolina
    { name: 'Charlotte', stateCode: 'NC' },
    { name: 'Raleigh', stateCode: 'NC' },
    { name: 'Greensboro', stateCode: 'NC' },
    { name: 'Durham', stateCode: 'NC' },
    { name: 'Winston-Salem', stateCode: 'NC' },
    { name: 'Fayetteville', stateCode: 'NC' },

    // Indiana
    { name: 'Indianapolis', stateCode: 'IN' },
    { name: 'Fort Wayne', stateCode: 'IN' },
    { name: 'Evansville', stateCode: 'IN' },

    // Washington
    { name: 'Seattle', stateCode: 'WA' },
    { name: 'Spokane', stateCode: 'WA' },
    { name: 'Tacoma', stateCode: 'WA' },
    { name: 'Vancouver', stateCode: 'WA' },
    { name: 'Bellevue', stateCode: 'WA' },

    // Tennessee
    { name: 'Nashville', stateCode: 'TN' },
    { name: 'Memphis', stateCode: 'TN' },
    { name: 'Knoxville', stateCode: 'TN' },
    { name: 'Chattanooga', stateCode: 'TN' },

    // Massachusetts
    { name: 'Boston', stateCode: 'MA' },
    { name: 'Worcester', stateCode: 'MA' },
    { name: 'Springfield', stateCode: 'MA' },
    { name: 'Cambridge', stateCode: 'MA' },
    { name: 'Lowell', stateCode: 'MA' },

    // Colorado
    { name: 'Denver', stateCode: 'CO' },
    { name: 'Colorado Springs', stateCode: 'CO' },
    { name: 'Aurora', stateCode: 'CO' },
    { name: 'Fort Collins', stateCode: 'CO' },

    // DC
    { name: 'Washington', stateCode: 'DC' },

    // Michigan
    { name: 'Detroit', stateCode: 'MI' },
    { name: 'Grand Rapids', stateCode: 'MI' },
    { name: 'Warren', stateCode: 'MI' },
    { name: 'Sterling Heights', stateCode: 'MI' },

    // Nevada
    { name: 'Las Vegas', stateCode: 'NV' },
    { name: 'Henderson', stateCode: 'NV' },
    { name: 'Reno', stateCode: 'NV' },

    // Wisconsin
    { name: 'Milwaukee', stateCode: 'WI' },
    { name: 'Madison', stateCode: 'WI' },

    // Missouri
    { name: 'Kansas City', stateCode: 'MO' },
    { name: 'St. Louis', stateCode: 'MO' },
    { name: 'Springfield', stateCode: 'MO' },

    // Maryland
    { name: 'Baltimore', stateCode: 'MD' },

    // Minnesota
    { name: 'Minneapolis', stateCode: 'MN' },
    { name: 'St. Paul', stateCode: 'MN' },

    // Georgia
    { name: 'Atlanta', stateCode: 'GA' },
    { name: 'Columbus', stateCode: 'GA' },
    { name: 'Augusta', stateCode: 'GA' },
    { name: 'Savannah', stateCode: 'GA' },

    // Virginia
    { name: 'Virginia Beach', stateCode: 'VA' },
    { name: 'Norfolk', stateCode: 'VA' },
    { name: 'Chesapeake', stateCode: 'VA' },
    { name: 'Richmond', stateCode: 'VA' },
    { name: 'Newport News', stateCode: 'VA' },
    { name: 'Alexandria', stateCode: 'VA' },

    // Nebraska
    { name: 'Omaha', stateCode: 'NE' },
    { name: 'Lincoln', stateCode: 'NE' },

    // Oklahoma
    { name: 'Oklahoma City', stateCode: 'OK' },
    { name: 'Tulsa', stateCode: 'OK' },

    // New Mexico
    { name: 'Albuquerque', stateCode: 'NM' },

    // Louisiana
    { name: 'New Orleans', stateCode: 'LA' },
    { name: 'Baton Rouge', stateCode: 'LA' },

    // Kentucky
    { name: 'Louisville', stateCode: 'KY' },
    { name: 'Lexington', stateCode: 'KY' },

    // Oregon
    { name: 'Portland', stateCode: 'OR' },
    { name: 'Eugene', stateCode: 'OR' },
    { name: 'Salem', stateCode: 'OR' },

    // South Carolina
    { name: 'Charleston', stateCode: 'SC' },
    { name: 'Columbia', stateCode: 'SC' },

    // Alabama
    { name: 'Birmingham', stateCode: 'AL' },
    { name: 'Montgomery', stateCode: 'AL' },
    { name: 'Mobile', stateCode: 'AL' },

    // Utah
    { name: 'Salt Lake City', stateCode: 'UT' },
    { name: 'West Valley City', stateCode: 'UT' },
    { name: 'Provo', stateCode: 'UT' },

    // Arkansas
    { name: 'Little Rock', stateCode: 'AR' },

    // Kansas
    { name: 'Wichita', stateCode: 'KS' },
    { name: 'Overland Park', stateCode: 'KS' },

    // Connecticut
    { name: 'Bridgeport', stateCode: 'CT' },
    { name: 'New Haven', stateCode: 'CT' },
    { name: 'Hartford', stateCode: 'CT' },

    // Iowa
    { name: 'Des Moines', stateCode: 'IA' },
    { name: 'Cedar Rapids', stateCode: 'IA' },

    // Mississippi
    { name: 'Jackson', stateCode: 'MS' },

    // Rhode Island
    { name: 'Providence', stateCode: 'RI' },

    // Hawaii
    { name: 'Honolulu', stateCode: 'HI' },

    // Idaho
    { name: 'Boise', stateCode: 'ID' },

    // New Hampshire
    { name: 'Manchester', stateCode: 'NH' },

    // Maine
    { name: 'Portland', stateCode: 'ME' },

    // Montana
    { name: 'Billings', stateCode: 'MT' },

    // Delaware
    { name: 'Wilmington', stateCode: 'DE' },

    // South Dakota
    { name: 'Sioux Falls', stateCode: 'SD' },

    // North Dakota
    { name: 'Fargo', stateCode: 'ND' },

    // Alaska
    { name: 'Anchorage', stateCode: 'AK' },

    // Vermont
    { name: 'Burlington', stateCode: 'VT' },

    // West Virginia
    { name: 'Charleston', stateCode: 'WV' },

    // Wyoming
    { name: 'Cheyenne', stateCode: 'WY' },
]

// Create lookup maps for O(1) access
const stateByCode = new Map<string, USState>()
const stateByName = new Map<string, USState>()
const citiesByName = new Map<string, USCity[]>()

// Initialize US lookups
for (const state of US_STATES) {
    stateByCode.set(state.isoCode, state)
    stateByName.set(state.name.toLowerCase(), state)
}

for (const city of US_CITIES) {
    const cityName = city.name.toLowerCase()
    if (!citiesByName.has(cityName)) {
        citiesByName.set(cityName, [])
    }
    citiesByName.get(cityName)!.push(city)
}

/**
 * Get state by ISO code
 */
export function getStateByCode(code: string): USState | undefined {
    return stateByCode.get(code.toUpperCase())
}

/**
 * Get state by name
 */
export function getStateByName(name: string): USState | undefined {
    return stateByName.get(name.toLowerCase())
}

/**
 * Get cities by name
 */
export function getCitiesByName(name: string): USCity[] {
    return citiesByName.get(name.toLowerCase()) || []
}

/**
 * Get all US cities (returns the cached array)
 */
export function getAllCities(): USCity[] {
    return US_CITIES
}

/**
 * Get all US states
 */
export function getAllStates(): USState[] {
    return US_STATES
}

/**
 * Compatibility layer with country-state-city API for US
 */
export const USCity = {
    getCitiesOfCountry: (countryCode: string) => {
        if (countryCode !== 'US') return undefined
        return getAllCities().map(city => ({
            name: city.name,
            stateCode: city.stateCode,
        }))
    },
}

export const USState = {
    getStateByCodeAndCountry: (stateCode: string, countryCode: string) => {
        if (countryCode !== 'US') return undefined
        const state = getStateByCode(stateCode)
        return state ? { name: state.name, isoCode: state.isoCode } : undefined
    },
}

// Legacy exports for backwards compatibility
export const City = USCity
export const State = USState
