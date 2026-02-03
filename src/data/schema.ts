import { SchemaAttribute } from '@sailpoint/connector-sdk'

export const fusionAccountSchemaAttributes: SchemaAttribute[] = [
    {
        name: 'name',
        description: 'Name',
        type: 'string',
        required: true,
    },
    {
        name: 'id',
        description: 'ID',
        type: 'string',
        required: true,
    },
    {
        name: 'history',
        description: 'History',
        type: 'string',
        multi: true,
    },
    {
        name: 'statuses',
        description: 'Statuses',
        type: 'string',
        multi: true,
        entitlement: true,
        managed: false,
        schemaObjectType: 'status',
    },
    {
        name: 'actions',
        description: 'Actions',
        type: 'string',
        multi: true,
        entitlement: true,
        managed: true,
        schemaObjectType: 'action',
    },
    {
        name: 'accounts',
        description: 'Account IDs',
        type: 'string',
        multi: true,
        entitlement: false,
    },
    {
        name: 'missing-accounts',
        description: 'Missing account IDs',
        type: 'string',
        multi: true,
        entitlement: false,
    },
    {
        name: 'reviews',
        description: 'Forms pending review',
        type: 'string',
        multi: true,
        entitlement: false,
    },
    {
        name: 'sources',
        description: 'Managed sources',
        type: 'string',
        multi: false,
        entitlement: false,
    },
]
