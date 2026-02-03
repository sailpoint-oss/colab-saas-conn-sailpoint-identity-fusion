export const getDateFromISOString = (isoString?: string | undefined | null): Date => {
    if (!isoString || isoString === '') return new Date(0)
    return new Date(Date.parse(isoString))
}
