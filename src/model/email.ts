import { FormInstanceResponseBeta, IdentityDocument, Source, TestWorkflowRequestBeta } from 'sailpoint-api-client'
import { capitalizeFirstLetter, md } from '../utils'
import { AccountAnalysis } from './account'

export class ReviewEmail implements TestWorkflowRequestBeta {
    input: object
    constructor(recipient: IdentityDocument, formName: string, instance: FormInstanceResponseBeta) {
        const subject = formName
        let body = ''
        body += md.render(`Dear ${recipient.displayName},`)
        body += md.render(
            'The system has detected a potential match on one or more existing identities that needs your review. If this is not a match please select "This is a New Identity".'
        )

        body += md.render(`Click [here](${instance.standAloneFormUrl!}) to review the identities.`)

        body += md.render('Thank you,')
        body += md.render('IAM/Security Team')

        this.input = {
            recipients: [recipient.attributes!.email],
            subject,
            body,
        }
    }
}

export class EditEmail implements TestWorkflowRequestBeta {
    input: object
    constructor(recipient: IdentityDocument, formName: string, instance: FormInstanceResponseBeta) {
        const subject = formName
        const name = (instance.formInput!['account.name'] as any).value as string
        let body = ''
        body += md.render(`Dear ${recipient.displayName},`)
        body += md.render(
            `You have, or someone on your behalf, has recently requested for you to edit ${name} account.`
        )

        body += md.render(`Click [here](${instance.standAloneFormUrl!}) to edit the account.`)

        body += md.render('Thank you,')
        body += md.render('IAM/Security Team')

        this.input = {
            recipients: [recipient.attributes!.email],
            subject,
            body,
        }
    }
}

export class ErrorEmail implements TestWorkflowRequestBeta {
    input: object
    constructor(source: Source, recipient: string, error: string) {
        const subject = `Identity Fusion [${source.name}] error report`
        const body = error
        this.input = {
            recipients: [recipient],
            subject,
            body,
        }
    }
}

export class ReportEmail implements TestWorkflowRequestBeta {
    input: object
    constructor(analyses: AccountAnalysis[], attributes: string[], recipient: IdentityDocument) {
        const subject = `Identity Fusion report`

        let body = '\n'
        const attributeNames = attributes.map((x) => capitalizeFirstLetter(x))

        // Start Table
        body += `<table style="border-collapse: collapse;width: 100%;border: 1px solid #ccc;font-family: Arial, sans-serif;">`;

        // Build Header
        const header = ['ID', 'Name', 'Source name', ...attributeNames, 'Result'].map(attr => `<th style="padding: 12px 15px;text-align: left;border-bottom: 1px solid #ddd;background-color: #4285f4; /* Blueish header color */color: white;">${attr}</th>`).join("");
        body += `<tr>${header}</tr>`;

        // Build Rows
        for (const analysis of analyses) {
            const attributeValues = attributes.map((x) => analysis.account.attributes![x]);
            const { nativeIdentity, name, sourceName } = analysis.account;
            const result = analysis.results.map((x) => `- ${x}`).join('<br/>');
            const record = [nativeIdentity, name, sourceName, ...attributeValues, result].map(str => `<td style="padding: 12px 15px;text-align: left;border-bottom: 1px solid #ddd;">${(str) ? str : ""}</td>`).join("");

            body += `<tr>${record}</tr>`;
        }

        // End Table
        body += `</table>`;

        this.input = {
            recipients: [recipient.attributes!.email],
            subject,
            body
        }
    }
}
