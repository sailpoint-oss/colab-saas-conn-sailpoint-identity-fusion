/**
 * Lightweight UK geographic data
 * Part of the replacement for the heavy 'country-state-city' library (17MB)
 * 
 * Coverage:
 * - UK: Major regions across England, Scotland, Wales, Northern Ireland
 * - 70+ major cities covering all major metropolitan areas
 * 
 * This lightweight implementation is ~12KB for UK data alone
 */

export interface UKRegion {
    name: string
    isoCode: string
    country: 'England' | 'Scotland' | 'Wales' | 'Northern Ireland'
}

export interface UKCity {
    name: string
    regionCode: string
    country: 'England' | 'Scotland' | 'Wales' | 'Northern Ireland'
}

/**
 * UK Regions/Counties (major regions across England, Scotland, Wales, Northern Ireland)
 */
export const UK_REGIONS: UKRegion[] = [
    // England - Major Counties
    { name: 'Greater London', isoCode: 'LND', country: 'England' },
    { name: 'Greater Manchester', isoCode: 'MAN', country: 'England' },
    { name: 'West Midlands', isoCode: 'WMD', country: 'England' },
    { name: 'West Yorkshire', isoCode: 'WYK', country: 'England' },
    { name: 'South Yorkshire', isoCode: 'SYK', country: 'England' },
    { name: 'Tyne and Wear', isoCode: 'TWR', country: 'England' },
    { name: 'Merseyside', isoCode: 'MSY', country: 'England' },
    { name: 'Essex', isoCode: 'ESX', country: 'England' },
    { name: 'Kent', isoCode: 'KEN', country: 'England' },
    { name: 'Hampshire', isoCode: 'HAM', country: 'England' },
    { name: 'Surrey', isoCode: 'SRY', country: 'England' },
    { name: 'Hertfordshire', isoCode: 'HRT', country: 'England' },
    { name: 'Lancashire', isoCode: 'LAN', country: 'England' },
    { name: 'Nottinghamshire', isoCode: 'NTT', country: 'England' },
    { name: 'Leicestershire', isoCode: 'LEC', country: 'England' },
    { name: 'Staffordshire', isoCode: 'STS', country: 'England' },
    { name: 'Derbyshire', isoCode: 'DBY', country: 'England' },
    { name: 'Norfolk', isoCode: 'NFK', country: 'England' },
    { name: 'Suffolk', isoCode: 'SFK', country: 'England' },
    { name: 'Cambridgeshire', isoCode: 'CAM', country: 'England' },
    { name: 'Oxfordshire', isoCode: 'OXF', country: 'England' },
    { name: 'Devon', isoCode: 'DEV', country: 'England' },
    { name: 'Cornwall', isoCode: 'CON', country: 'England' },
    { name: 'Somerset', isoCode: 'SOM', country: 'England' },
    { name: 'Dorset', isoCode: 'DOR', country: 'England' },
    { name: 'Gloucestershire', isoCode: 'GLS', country: 'England' },
    { name: 'Bristol', isoCode: 'BST', country: 'England' },
    { name: 'Berkshire', isoCode: 'BRK', country: 'England' },
    { name: 'Buckinghamshire', isoCode: 'BKM', country: 'England' },
    { name: 'East Sussex', isoCode: 'ESX', country: 'England' },
    { name: 'West Sussex', isoCode: 'WSX', country: 'England' },

    // Scotland
    { name: 'City of Edinburgh', isoCode: 'EDH', country: 'Scotland' },
    { name: 'Glasgow City', isoCode: 'GLG', country: 'Scotland' },
    { name: 'Aberdeen City', isoCode: 'ABD', country: 'Scotland' },
    { name: 'Dundee City', isoCode: 'DND', country: 'Scotland' },
    { name: 'Highland', isoCode: 'HLD', country: 'Scotland' },
    { name: 'Fife', isoCode: 'FIF', country: 'Scotland' },
    { name: 'Aberdeenshire', isoCode: 'ABE', country: 'Scotland' },
    { name: 'Perth and Kinross', isoCode: 'PKN', country: 'Scotland' },

    // Wales
    { name: 'Cardiff', isoCode: 'CRF', country: 'Wales' },
    { name: 'Swansea', isoCode: 'SWA', country: 'Wales' },
    { name: 'Rhondda Cynon Taf', isoCode: 'RCT', country: 'Wales' },
    { name: 'Carmarthenshire', isoCode: 'CMN', country: 'Wales' },
    { name: 'Caerphilly', isoCode: 'CAY', country: 'Wales' },
    { name: 'Gwynedd', isoCode: 'GWN', country: 'Wales' },

    // Northern Ireland
    { name: 'Belfast', isoCode: 'BFS', country: 'Northern Ireland' },
    { name: 'Derry and Strabane', isoCode: 'DRS', country: 'Northern Ireland' },
    { name: 'Armagh, Banbridge and Craigavon', isoCode: 'ABC', country: 'Northern Ireland' },
    { name: 'Newry, Mourne and Down', isoCode: 'NMD', country: 'Northern Ireland' },
]

/**
 * Major UK cities (top 70+ cities covering major population centers)
 */
export const UK_CITIES: UKCity[] = [
    // England - London
    { name: 'London', regionCode: 'LND', country: 'England' },

    // England - Major Cities
    { name: 'Birmingham', regionCode: 'WMD', country: 'England' },
    { name: 'Manchester', regionCode: 'MAN', country: 'England' },
    { name: 'Leeds', regionCode: 'WYK', country: 'England' },
    { name: 'Liverpool', regionCode: 'MSY', country: 'England' },
    { name: 'Sheffield', regionCode: 'SYK', country: 'England' },
    { name: 'Newcastle upon Tyne', regionCode: 'TWR', country: 'England' },
    { name: 'Bristol', regionCode: 'BST', country: 'England' },
    { name: 'Nottingham', regionCode: 'NTT', country: 'England' },
    { name: 'Leicester', regionCode: 'LEC', country: 'England' },
    { name: 'Coventry', regionCode: 'WMD', country: 'England' },
    { name: 'Bradford', regionCode: 'WYK', country: 'England' },
    { name: 'Southampton', regionCode: 'HAM', country: 'England' },
    { name: 'Portsmouth', regionCode: 'HAM', country: 'England' },
    { name: 'Derby', regionCode: 'DBY', country: 'England' },
    { name: 'Stoke-on-Trent', regionCode: 'STS', country: 'England' },
    { name: 'Wolverhampton', regionCode: 'WMD', country: 'England' },
    { name: 'Plymouth', regionCode: 'DEV', country: 'England' },
    { name: 'Reading', regionCode: 'BRK', country: 'England' },
    { name: 'Bolton', regionCode: 'MAN', country: 'England' },
    { name: 'Bournemouth', regionCode: 'DOR', country: 'England' },
    { name: 'Norwich', regionCode: 'NFK', country: 'England' },
    { name: 'Swindon', regionCode: 'SOM', country: 'England' },
    { name: 'Northampton', regionCode: 'NTT', country: 'England' },
    { name: 'Milton Keynes', regionCode: 'BKM', country: 'England' },
    { name: 'Luton', regionCode: 'HRT', country: 'England' },
    { name: 'Oxford', regionCode: 'OXF', country: 'England' },
    { name: 'Cambridge', regionCode: 'CAM', country: 'England' },
    { name: 'Brighton', regionCode: 'ESX', country: 'England' },
    { name: 'York', regionCode: 'WYK', country: 'England' },
    { name: 'Exeter', regionCode: 'DEV', country: 'England' },
    { name: 'Bath', regionCode: 'SOM', country: 'England' },
    { name: 'Canterbury', regionCode: 'KEN', country: 'England' },
    { name: 'Chelmsford', regionCode: 'ESX', country: 'England' },
    { name: 'Chester', regionCode: 'LAN', country: 'England' },
    { name: 'Durham', regionCode: 'TWR', country: 'England' },
    { name: 'Gloucester', regionCode: 'GLS', country: 'England' },
    { name: 'Ipswich', regionCode: 'SFK', country: 'England' },
    { name: 'Lancaster', regionCode: 'LAN', country: 'England' },
    { name: 'Lincoln', regionCode: 'LEC', country: 'England' },
    { name: 'Peterborough', regionCode: 'CAM', country: 'England' },
    { name: 'Preston', regionCode: 'LAN', country: 'England' },
    { name: 'Salford', regionCode: 'MAN', country: 'England' },
    { name: 'Salisbury', regionCode: 'HAM', country: 'England' },
    { name: 'Winchester', regionCode: 'HAM', country: 'England' },
    { name: 'Worcester', regionCode: 'WMD', country: 'England' },

    // Scotland
    { name: 'Edinburgh', regionCode: 'EDH', country: 'Scotland' },
    { name: 'Glasgow', regionCode: 'GLG', country: 'Scotland' },
    { name: 'Aberdeen', regionCode: 'ABD', country: 'Scotland' },
    { name: 'Dundee', regionCode: 'DND', country: 'Scotland' },
    { name: 'Inverness', regionCode: 'HLD', country: 'Scotland' },
    { name: 'Stirling', regionCode: 'FIF', country: 'Scotland' },
    { name: 'Perth', regionCode: 'PKN', country: 'Scotland' },

    // Wales
    { name: 'Cardiff', regionCode: 'CRF', country: 'Wales' },
    { name: 'Swansea', regionCode: 'SWA', country: 'Wales' },
    { name: 'Newport', regionCode: 'CRF', country: 'Wales' },
    { name: 'Wrexham', regionCode: 'GWN', country: 'Wales' },
    { name: 'Bangor', regionCode: 'GWN', country: 'Wales' },

    // Northern Ireland
    { name: 'Belfast', regionCode: 'BFS', country: 'Northern Ireland' },
    { name: 'Derry', regionCode: 'DRS', country: 'Northern Ireland' },
    { name: 'Londonderry', regionCode: 'DRS', country: 'Northern Ireland' },
    { name: 'Lisburn', regionCode: 'BFS', country: 'Northern Ireland' },
    { name: 'Newry', regionCode: 'NMD', country: 'Northern Ireland' },
]

// Create lookup maps for O(1) access
const ukRegionByCode = new Map<string, UKRegion>()
const ukRegionByName = new Map<string, UKRegion>()
const ukCitiesByName = new Map<string, UKCity[]>()

// Initialize UK lookups
for (const region of UK_REGIONS) {
    ukRegionByCode.set(region.isoCode, region)
    ukRegionByName.set(region.name.toLowerCase(), region)
}

for (const city of UK_CITIES) {
    const cityName = city.name.toLowerCase()
    if (!ukCitiesByName.has(cityName)) {
        ukCitiesByName.set(cityName, [])
    }
    ukCitiesByName.get(cityName)!.push(city)
}

/**
 * Get UK region by ISO code
 */
export function getUKRegionByCode(code: string): UKRegion | undefined {
    return ukRegionByCode.get(code.toUpperCase())
}

/**
 * Get UK region by name
 */
export function getUKRegionByName(name: string): UKRegion | undefined {
    return ukRegionByName.get(name.toLowerCase())
}

/**
 * Get UK cities by name
 */
export function getUKCitiesByName(name: string): UKCity[] {
    return ukCitiesByName.get(name.toLowerCase()) || []
}

/**
 * Get all UK cities (returns the cached array)
 */
export function getAllUKCities(): UKCity[] {
    return UK_CITIES
}

/**
 * Get all UK regions
 */
export function getAllUKRegions(): UKRegion[] {
    return UK_REGIONS
}

/**
 * Compatibility layer with country-state-city API for UK
 */
export const UKCity = {
    getCitiesOfCountry: (countryCode: string) => {
        if (countryCode !== 'GB' && countryCode !== 'UK') return undefined
        return getAllUKCities().map(city => ({
            name: city.name,
            stateCode: city.regionCode,
            country: city.country,
        }))
    },
}

export const UKState = {
    getStateByCodeAndCountry: (stateCode: string, countryCode: string) => {
        if (countryCode !== 'GB' && countryCode !== 'UK') return undefined
        const region = getUKRegionByCode(stateCode)
        return region ? { name: region.name, isoCode: region.isoCode, country: region.country } : undefined
    },
}
