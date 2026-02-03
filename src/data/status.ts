import { StatusSource } from '../model/status'

export const statuses: StatusSource[] = [
    {
        id: 'authorized',
        name: 'Authorized',
        description: 'A managed account was manually correlated by a reviewer',
    },
    { id: 'auto', name: 'Auto', description: 'An identical match was found for managed account' },
    { id: 'baseline', name: 'Baseline', description: 'Pre-existing identity' },
    { id: 'manual', name: 'Manual', description: 'A new base account was manually approved by a reviewer' },
    { id: 'orphan', name: 'Orphan', description: 'No managed accounts left' },
    { id: 'unmatched', name: 'Unmatched', description: 'No match found for base account' },
    {
        id: 'edited',
        name: 'Edited',
        description: 'The account was manually edited and no longer gets updates from current source accounts',
    },
    { id: 'reviewer', name: 'Reviewer', description: 'An identity deduplication reviewer of any source' },
    { id: 'requested', name: 'Requested', description: 'Account was requested' },
    { id: 'uncorrelated', name: 'Uncorrelated', description: 'Account has sources accounts pending correlation' },
    { id: 'activeReviews', name: 'Active reviews', description: 'Account has active fusion reviews' },
]
