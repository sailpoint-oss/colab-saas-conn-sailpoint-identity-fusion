import {
    FormInstanceResponseV2025,
    WorkflowV2025,
    TestWorkflowRequestV2025,
    WorkflowsV2025ApiTestWorkflowRequest,
    CreateWorkflowRequestV2025,
} from 'sailpoint-api-client'
import type { TemplateDelegate as HandlebarsTemplateDelegate } from 'handlebars'
import { FusionConfig } from '../../model/config'
import { ClientService } from '../clientService'
import { LogService } from '../logService'
import { EmailWorkflow } from '../../model/emailWorkflow'
import { assert, softAssert } from '../../utils/assert'
import { pickAttributes } from '../../utils/attributes'
import { createUrlContext, UrlContext } from '../../utils/url'
import { normalizeEmailValue, sanitizeRecipients } from './email'
import { IdentityService } from '../identityService'
import { SourceService } from '../sourceService'
import type { FusionAccount } from '../../model/account'
import { FusionReport } from '../fusionService/types'
import {
    registerHandlebarsHelpers,
    compileEmailTemplates,
    renderFusionReviewEmail,
    renderFusionReport,
    type FusionReviewEmailData,
    type FusionReportEmailData,
} from './helpers'

// ============================================================================
// MessagingService Class
// ============================================================================

/**
 * Service for sending emails to reviewers via workflows.
 * Handles workflow creation, email composition, and notification delivery.
 */
export class MessagingService {
    private workflow: WorkflowV2025 | undefined
    private templates: Map<string, HandlebarsTemplateDelegate> = new Map()
    private readonly workflowName: string
    private readonly cloudDisplayName: string
    private readonly urlContext: UrlContext
    private readonly reportAttributes: string[]

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------

    constructor(
        config: FusionConfig,
        private log: LogService,
        private client: ClientService,
        private sources: SourceService,
        private identities?: IdentityService
    ) {
        this.workflowName = config.workflowName
        this.cloudDisplayName = config.cloudDisplayName
        this.reportAttributes = config.fusionFormAttributes ?? []
        this.urlContext = createUrlContext(config.baseurl)
        registerHandlebarsHelpers()
        this.templates = compileEmailTemplates()
    }

    // ------------------------------------------------------------------------
    // Public Methods
    // ------------------------------------------------------------------------

    /**
     * Prepare the email sender workflow by checking for existence and creating if needed.
     * This should be called before sending any emails to ensure the workflow is ready.
     */
    public async fetchSender(): Promise<void> {
        if (this.workflow) {
            this.log.debug('Email workflow already prepared')
            return
        }

        assert(this.workflowName, 'Workflow name is required')
        assert(this.cloudDisplayName, 'Cloud display name is required')

        const workflowName = `${this.workflowName} (${this.cloudDisplayName})`
        this.log.debug(`Preparing email sender workflow: ${workflowName}`)

        const owner = this.sources.fusionSourceOwner
        assert(owner, 'Fusion source owner is required')
        assert(owner.id, 'Fusion source owner ID is required')

        // First, check if the workflow already exists
        const existingWorkflow = await this.findWorkflowByName(workflowName)
        if (existingWorkflow) {
            this.workflow = existingWorkflow
            this.log.info(`Found existing workflow: ${workflowName} (ID: ${this.workflow.id})`)

            // The Workflows v2025 test endpoint rejects enabled workflows (400).
            // We rely on testWorkflow for delivery in this connector, so keep it disabled.
            await this.disableWorkflowIfEnabled(this.workflow)
            return
        }

        // Workflow doesn't exist, create it
        try {
            const emailWorkflow = new EmailWorkflow(workflowName, owner)
            assert(emailWorkflow, 'Failed to create email workflow object')

                // Ensure the workflow is disabled so we can call testWorkflow safely.
                ; (emailWorkflow as any).enabled = false

            this.workflow = await this.createWorkflow(emailWorkflow)
            assert(this.workflow, 'Failed to create workflow')
            assert(this.workflow.id, 'Workflow ID is required')

            this.log.info(`Created workflow: ${workflowName} (ID: ${this.workflow.id})`)
        } catch (error) {
            this.log.error(`Failed to create workflow: ${error}`)
            throw new Error(`Workflow preparation failed. Unable to create workflow "${workflowName}": ${error}`)
        }
    }

    /**
     * Send email notification for a fusion form (deduplication review)
     */
    public async sendFusionEmail(
        formInstance: FormInstanceResponseV2025,
        context?: {
            accountName: string
            accountSource: string
            accountId?: string
            accountEmail?: string
            accountAttributes: Record<string, any>
            candidates: Array<{ id: string; name: string; attributes: Record<string, any>; scores?: any[] }>
        }
    ): Promise<void> {
        assert(formInstance, 'Form instance is required')
        assert(formInstance.id, 'Form instance ID is required')

        const { formInput, recipients } = formInstance

        if (!recipients || recipients.length === 0) {
            this.log.warn(`No recipients found for form instance ${formInstance.id}`)
            return
        }

        const recipientId = recipients[0].id

        const recipientEmails = await this.getRecipientEmails([recipientId])
        if (recipientEmails.length === 0) {
            this.log.warn(`No valid email addresses found for form instance ${formInstance.id}`)
            return
        }

        const accountName =
            context?.accountName || String((formInput as any)?.name || (formInput as any)?.account || 'Unknown Account')
        const accountSource = context?.accountSource || String((formInput as any)?.source || 'Unknown')
        const pickedAccountAttributes = pickAttributes(context?.accountAttributes, this.reportAttributes)
        const accountId = context?.accountId || String((formInput as any)?.account || '')
        const accountEmail = context?.accountEmail

        const candidates =
            context?.candidates?.map((c) => ({
                ...c,
                identityUrl: this.urlContext.identity(c.id),
            })) ?? []

        const subject = `Identity Fusion Review Required: ${accountName} [${accountSource}]`
        const emailData: FusionReviewEmailData = {
            accounts: [
                {
                    accountName,
                    accountSource,
                    accountId: accountId || undefined,
                    accountEmail,
                    accountAttributes: pickedAccountAttributes,
                    matches: candidates.map((candidate: any) => ({
                        identityName: candidate.name || 'Unknown',
                        identityId: candidate.id || undefined,
                        identityUrl: candidate.identityUrl,
                        isMatch: true,
                        scores: (candidate.scores || []).map((s: any) => ({
                            attribute: s.attribute,
                            algorithm: s.algorithm,
                            score: s.score,
                            fusionScore: s.fusionScore,
                            isMatch: s.isMatch,
                            comment: s.comment,
                        })),
                    })),
                },
            ],
            totalAccounts: 1,
            potentialDuplicates: 1,
            reportDate: new Date(),
            formInstanceId: formInstance.id,
            formUrl: formInstance.standAloneFormUrl,
        }

        assert(this.templates, 'Email templates are required')
        const body = renderFusionReviewEmail(this.templates, emailData)
        assert(body, 'Failed to render fusion review email body')

        await this.sendEmail(recipientEmails, subject, body)
        this.log.info(`Sent fusion email to ${recipientEmails.length} recipient(s) for form ${formInstance.id}`)
    }

    /**
     * Send report email with potential duplicate accounts
     */
    public async sendReport(report: FusionReport, fusionAccount?: FusionAccount): Promise<void> {
        // Recipients:
        // - the initiating fusion account (if we can resolve an email)
        // - the fusion source owner (always)
        const recipientEmails = new Set<string>()

        if (fusionAccount?.email) {
            recipientEmails.add(fusionAccount.email)
        } else if (fusionAccount && this.identities && fusionAccount.identityId) {
            // Try to get email from identity (only if identityId exists)
            const identity = this.identities.getIdentityById(fusionAccount.identityId)
            if (identity?.attributes?.email) {
                recipientEmails.add(identity.attributes.email)
            }
        }

        // Always add the fusion source owner (resolved via IdentityService)
        let ownerId: string | undefined
        try {
            ownerId = this.sources.fusionSourceOwner?.id
        } catch {
            ownerId = undefined
        }
        if (ownerId && this.identities) {
            const ownerEmails = await this.getRecipientEmails([ownerId])
            for (const e of ownerEmails) recipientEmails.add(e)
        }

        if (recipientEmails.size === 0) {
            this.log.warn('No recipient email found for report')
            return
        }

        const subject = `Identity Fusion Report - ${report.potentialDuplicates || 0} Potential Duplicate(s) Found`
        const emailData: FusionReportEmailData = {
            ...report,
            totalAccounts: report.totalAccounts || report.accounts.length,
            potentialDuplicates:
                report.potentialDuplicates || report.accounts.filter((a) => a.matches.length > 0).length,
            reportDate: report.reportDate || new Date(),
        }
        const body = renderFusionReport(this.templates, emailData)

        const recipients = Array.from(recipientEmails)
        await this.sendEmail(recipients, subject, body)
        this.log.info(`Sent fusion report email to ${recipients.length} recipient(s)`)
    }

    // ------------------------------------------------------------------------
    // Private Helper Methods
    // ------------------------------------------------------------------------

    /**
     * Get the workflow, ensuring it's prepared first
     */
    private async getWorkflow(): Promise<WorkflowV2025> {
        if (!this.workflow) {
            await this.fetchSender()
        }
        if (!this.workflow) {
            throw new Error('Workflow not available after preparation')
        }
        return this.workflow
    }

    /**
     * Send an email using the workflow
     */
    private async sendEmail(recipients: string[], subject: string, body: string): Promise<void> {
        assert(recipients, 'Recipients array is required')
        const sanitizedRecipientList = sanitizeRecipients(recipients)
        assert(sanitizedRecipientList.length > 0, 'At least one recipient is required')
        assert(subject, 'Email subject is required')
        assert(body, 'Email body is required')

        const workflow = await this.getWorkflow()
        assert(workflow, 'Workflow is required')
        assert(workflow.id, 'Workflow ID is required')

        const testRequest: TestWorkflowRequestV2025 = {
            input: {
                subject,
                body,
                recipients: sanitizedRecipientList,
            },
        }
        const requestParameters: WorkflowsV2025ApiTestWorkflowRequest = {
            id: workflow.id,
            testWorkflowRequestV2025: testRequest,
        }

        this.log.debug(`Sending email to ${sanitizedRecipientList.length} recipient(s) via workflow ${workflow.id}`)
        try {
            const response = await this.testWorkflow(requestParameters)
            assert(response, 'Workflow response is required')
            softAssert(response.status === 200, `Failed to send email - received status ${response.status}`, 'error')
        } catch (e) {
            // Never crash aggregation because email delivery failed.
            this.log.error(`Failed to execute email workflow ${workflow.id}: ${e}`)
        }
    }

    /**
     * Get email addresses for recipient identity IDs
     */
    private async getRecipientEmails(identityIds: (string | undefined)[]): Promise<string[]> {
        const emails = new Set<string>()

        for (const identityId of identityIds) {
            if (!identityId) {
                continue
            }

            if (!this.identities) {
                this.log.warn('IdentityService not available, cannot fetch recipient emails')
                continue
            }

            let identity = this.identities.getIdentityById(identityId)
            if (!identity) {
                try {
                    identity = await this.identities.fetchIdentityById(identityId)
                } catch (e) {
                    this.log.warn(`Failed to fetch identity ${identityId}: ${e}`)
                }
            }

            const attrs: any = identity?.attributes ?? {}
            const emailValue = attrs.email ?? attrs.mail ?? attrs.emailAddress
            const normalized = normalizeEmailValue(emailValue)

            if (normalized.length > 0) {
                normalized.forEach((e) => emails.add(e))
            } else {
                this.log.warn(`No email found for identity ${identityId}`)
            }
        }

        return Array.from(emails)
    }

    /**
     * Disable workflow when enabled to allow testWorkflow execution.
     */
    private async disableWorkflowIfEnabled(workflow: WorkflowV2025): Promise<void> {
        try {
            const enabled = (workflow as any)?.enabled
            if (enabled === false) return
            if (!workflow.id) return

            const { workflowsApi } = this.client
            const patchFnAny: any = (workflowsApi as any)?.patchWorkflow
            if (typeof patchFnAny !== 'function') {
                this.log.debug(`patchWorkflow not available in SDK; cannot disable workflow ${workflow.id}`)
                return
            }

            const requestParameters: any = {
                id: workflow.id,
                jsonPatchOperationV2025: [{ op: 'replace', path: '/enabled', value: false }],
            }

            const patchCall = async () => {
                const resp = await patchFnAny.call(workflowsApi, requestParameters)
                return (resp as any)?.data ?? resp
            }

            await this.client.execute(patchCall)
            this.log.info(`Disabled workflow ${workflow.id} to allow test execution`)
        } catch (e) {
            // If we can't disable it, testWorkflow may fail with 400.
            this.log.warn(`Failed to disable workflow ${workflow.id}: ${e}`)
        }
    }

    // ------------------------------------------------------------------------
    // Workflow API Operations
    // ------------------------------------------------------------------------

    /**
     * Find a workflow by name
     */
    private async findWorkflowByName(workflowName: string): Promise<WorkflowV2025 | undefined> {
        assert(workflowName, 'Workflow name is required')
        assert(this.client, 'Client service is required')

        const { workflowsApi } = this.client

        this.log.debug(`Searching for existing workflow: ${workflowName}`)
        const listWorkflows = async () => {
            const response = await workflowsApi.listWorkflows()
            return {
                data: response.data || [],
            }
        }

        const workflows = await this.client.execute(listWorkflows)

        assert(workflows, `Failed to list workflows: ${workflowName}`)

        const workflow = workflows.data.find((w) => w.name === workflowName)

        return workflow
    }

    /**
     * Create a workflow
     */
    private async createWorkflow(createWorkflowRequestV2025: CreateWorkflowRequestV2025): Promise<WorkflowV2025> {
        assert(createWorkflowRequestV2025, 'Workflow request is required')
        assert(this.client, 'Client service is required')

        const { workflowsApi } = this.client
        assert(workflowsApi, 'Workflows API is required')

        this.log.debug('Creating email workflow')
        const createWorkflowFn = async () => {
            const response = await workflowsApi.createWorkflow({ createWorkflowRequestV2025 })
            return response.data
        }
        const workflowData = await this.client.execute(createWorkflowFn)
        assert(workflowData, 'Failed to create workflow')
        assert(workflowData.id, 'Workflow ID is required')

        return workflowData
    }

    /**
     * Test/execute a workflow
     */
    private async testWorkflow(requestParameters: WorkflowsV2025ApiTestWorkflowRequest) {
        assert(requestParameters, 'Workflow request parameters are required')
        assert(requestParameters.id, 'Workflow ID is required')
        assert(requestParameters.testWorkflowRequestV2025, 'Test workflow request is required')
        assert(this.client, 'Client service is required')

        const { workflowsApi } = this.client
        assert(workflowsApi, 'Workflows API is required')

        this.log.debug(`Executing workflow ${requestParameters.id}`)
        const testWorkflowFn = async () => {
            const response = await workflowsApi.testWorkflow(requestParameters)
            return response
        }
        const response = await this.client.execute(testWorkflowFn)
        assert(response, 'Workflow response is required')
        this.log.debug(`Workflow executed. Response code ${response.status}`)
        return response
    }
}
