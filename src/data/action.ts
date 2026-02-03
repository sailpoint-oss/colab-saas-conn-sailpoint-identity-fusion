import { ActionSource } from '../model/action'

export const actions: ActionSource[] = [
    { id: 'report', name: 'Fusion report', description: 'Generate fusion report' },
    { id: 'fusion', name: 'Fusion account', description: 'Create a fusion account' },
    { id: 'correlated', name: 'Correlate accounts', description: 'Correlate missing source accounts' },
]
