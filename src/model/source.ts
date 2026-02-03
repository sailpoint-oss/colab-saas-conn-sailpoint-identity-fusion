import { OwnerDto, Source as ApiSource } from 'sailpoint-api-client'
import { getDateFromISOString } from '../utils/date'

export class FusionSource {
    public id: string
    public spConnectorInstanceId: string
    public owner: OwnerDto
    public modified: Date
    constructor(source: ApiSource) {
        const attributes = source.connectorAttributes as any
        this.id = source.id!
        this.spConnectorInstanceId = attributes.spConnectorInstanceId!
        this.modified = getDateFromISOString(source.modified)
        this.owner = {
            type: 'IDENTITY',
            id: source.owner!.id!,
        }
    }
}
