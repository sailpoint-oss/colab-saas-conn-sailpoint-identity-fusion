declare module 'name-match' {
    export function match(name1: string, name2: string): number
    export function isMatch(name1: string, name2: string, threshold?: number): boolean
    export class EnhancedNaturalMatcher {
        match(name1: string, name2: string): number
        isMatch(name1: string, name2: string, threshold?: number): boolean
    }
    export class EnhancedMatcher {
        match(name1: string, name2: string): number
        isMatch(name1: string, name2: string, threshold?: number): boolean
    }
    export class NameNormalizer {
        normalize(name: string): string
    }
    export function matchGroup(names: string[], threshold?: number): string[][]
}