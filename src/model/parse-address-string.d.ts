declare module 'parse-address-string' {
    export interface ParsedAddress {
        street_address1?: string
        street_address2?: string
        city?: string
        state?: string
        postal_code?: string
        country?: string
    }

    function parseAddressString(
        addressString: string,
        callback: (err: Error | null, parsed: ParsedAddress | null) => void
    ): void

    export default parseAddressString
}

export type { ParsedAddress } from 'parse-address-string'
