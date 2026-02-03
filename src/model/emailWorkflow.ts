import {
    CreateWorkflowRequestV2025,
    WorkflowBodyOwnerV2025,
    WorkflowDefinitionV2025,
    WorkflowTriggerV2025,
} from 'sailpoint-api-client'

export class EmailWorkflow implements CreateWorkflowRequestV2025 {
    name: string
    owner: WorkflowBodyOwnerV2025
    definition: WorkflowDefinitionV2025
    trigger: WorkflowTriggerV2025

    constructor(name: string, owner: WorkflowBodyOwnerV2025) {
        this.name = name
        this.owner = owner
        this.definition = {
            start: 'Send Email',
            steps: {
                'End Step - Success': {
                    type: 'success',
                },
                'Send Email': {
                    actionId: 'sp:send-email',
                    attributes: {
                        'body.$': '$.trigger.body',
                        context: {},
                        'recipientEmailList.$': '$.trigger.recipients',
                        'subject.$': '$.trigger.subject',
                    },
                    nextStep: 'End Step - Success',
                    type: 'action',
                    versionNumber: 2,
                },
            },
        }
        // Type incorrectly requires a frequency property, but it causes an error if provided
        this.trigger = {
            type: 'EXTERNAL',
            attributes: {
                id: 'idn:external:id',
            },
        } as WorkflowTriggerV2025
    }
}
