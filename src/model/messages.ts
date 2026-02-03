// ============================================================================
// Email Template Definitions
// ============================================================================

/**
 * Email template for fusion review notifications
 */
export const FUSION_REVIEW_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Identity Fusion Review Required</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: none;
            margin: 0;
            padding: 0;
            background: linear-gradient(180deg, #f3f6fb 0%, #ffffff 100%);
        }

        /* Responsive stacking for main columns only (keep match row horizontal) */
        @media only screen and (max-width:600px) {
            .main-col {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
            }
        }
    </style>
</head>
<body style="margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; background:#f3f6fb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%; border-collapse:collapse;">
        <tr>
            <td align="center" style="padding:0 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                    <tr>
                        <td style="padding:12px 0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:separate; border-spacing:0; background:#ffffff; border:1px solid #e6ebf5; border-radius:14px; box-shadow:0 12px 30px rgba(16,24,40,0.12);">
                                <tr>
                                    <td style="padding:20px;">
                                        <div style="padding-bottom:18px; margin-bottom:22px; border-bottom:1px solid #e6ebf5;">
                                            <div style="margin-bottom:12px;">
                                                <h1 style="margin:0; color:#0b5cab; font-size:26px; letter-spacing:-0.2px;">Identity Fusion Review Required</h1>
                                                <div style="color:#5f6b7a; font-size:13px; margin-top:6px;">
                                                    Please review the potential duplicate and take appropriate action.
                                                </div>
                                                {{#each accounts}}
                                                {{#if accountSource}}
                                                <div style="color:#5f6b7a; font-size:12px; margin-top:8px; font-weight:600;">
                                                    Source: <span style="color:#0b5cab;">{{accountSource}}</span>
                                                </div>
                                                {{/if}}
                                                {{/each}}
                                                {{#if formUrl}}
                                                <div style="margin-top:12px;">
                                                    <a href="{{formUrl}}" style="display:inline-block; padding:10px 14px; border-radius:10px; background:#0b5cab; color:#ffffff; font-weight:900; font-size:13px; text-decoration:none;">
                                                        Open Review Form
                                                    </a>
                                                </div>
                                                {{/if}}
                                            </div>
                                            <!-- No "potential duplicates" count in review email -->
                                        </div>

                                        {{#each accounts}}
                                        <div style="margin-bottom:28px; border:1px solid #e6ebf5; border-radius:14px; padding:18px; background:#ffffff; box-shadow:0 10px 24px rgba(16,24,40,0.08);">
                                            <div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch;">
                                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; width:auto; min-width:100%;">
                                                    <tr>
                                                    <!-- Left: duplicate account summary -->
                                                    <td class="main-col" valign="top" style="width:280px; min-width:280px; max-width:280px; vertical-align:top; padding:8px; border-right:1px solid #eef2f7;">
                                                        <div style="color:#0b5cab; font-size:18px; font-weight:800; margin:0 0 6px 0;">{{accountName}}</div>
                                                        <div style="font-size:12px; color:#5f6b7a; margin-bottom:10px;">
                                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                                                                <tr>
                                                                    <td style="font-weight:800; white-space:nowrap; padding:2px 8px 2px 0;">Source:</td>
                                                                    <td style="padding:2px 8px;">{{accountSource}}</td>
                                                                </tr>
                                                                {{#if accountId}}
                                                                <tr>
                                                                    <td style="font-weight:800; white-space:nowrap; padding:2px 8px 2px 0;">ID:</td>
                                                                    <td style="padding:2px 8px; white-space:nowrap; word-break:keep-all;">{{accountId}}</td>
                                                                </tr>
                                                                {{/if}}
                                                                {{#if accountEmail}}
                                                                <tr>
                                                                    <td style="font-weight:800; white-space:nowrap; padding:2px 8px 2px 0;">Email:</td>
                                                                    <td style="padding:2px 8px; word-break:break-all;">{{accountEmail}}</td>
                                                                </tr>
                                                                {{/if}}
                                                            </table>
                                                        </div>

                                                        {{#if accountAttributes}}
                                                        <div style="color:#0b5cab; font-size:12px; font-weight:900; letter-spacing:0.35px; text-transform:uppercase; margin:12px 0 8px 0;">Attributes</div>
                                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                                                            {{#each accountAttributes}}
                                                            <tr>
                                                                <td style="padding:6px 8px; font-size:12px; color:#5f6b7a; font-weight:700; border:1px solid #eef2f7; background:#f8fbff; width:40%;">{{@key}}</td>
                                                                <td style="padding:6px 8px; font-size:12px; color:#0f172a; border:1px solid #eef2f7;">{{formatAttribute this}}</td>
                                                            </tr>
                                                            {{/each}}
                                                        </table>
                                                        {{/if}}
                                                    </td>

                                                    <!-- Right: matches (report-style) -->
                                                    <td class="main-col" valign="top" style="vertical-align:top; padding:8px;">
                                                        {{#if matches}}
                                                        {{#if (gt matches.length 0)}}
                                                        <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
                                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; margin-bottom:12px;">
                                                                <tr>
                                                                {{#each matches}}
                                                                <td valign="top" width="280" style="width:280px; vertical-align:top; padding:4px;">
                                                                    <table role="presentation" width="280" cellpadding="0" cellspacing="0" border="0" style="width:280px; border-collapse:collapse;">
                                                                        <tr>
                                                                            <td colspan="4" style="font-weight:900; padding:6px 8px; border-bottom:1px solid #e0e0e0; color:#0b5cab; font-size:12px; letter-spacing:0.35px; text-transform:uppercase; white-space:nowrap;">
                                                                                Potential Matches
                                                                            </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td colspan="4" style="padding:6px 8px;">
                                                                                <div style="font-size:14px; font-weight:800; color:#0b5cab; line-height:1.3; word-wrap:break-word;">
                                                                                    {{#if identityUrl}}
                                                                                    <a href="{{identityUrl}}" style="color:#0b5cab; text-decoration:underline; word-wrap:break-word;">{{identityName}}</a>
                                                                                    {{else}}
                                                                                    {{identityName}}
                                                                                    {{/if}}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                        {{#if scores}}
                                                                        <tr>
                                                                            <th width="90" style="width:90px; text-align:left; padding:6px 4px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:10px; font-weight:600;">Attribute</th>
                                                                            <th width="110" style="width:110px; text-align:left; padding:6px 4px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:10px; font-weight:600;">Algorithm</th>
                                                                            <th width="40" style="width:40px; text-align:right; padding:6px 4px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:10px; font-weight:600;">Score</th>
                                                                            <th width="40" style="width:40px; text-align:right; padding:6px 4px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:10px; font-weight:600;">Threshold</th>
                                                                        </tr>
                                                                        {{#each scores}}
                                                                        <tr style="background:{{#if (isAverageScoreRow attribute algorithm)}}#e0f2fe{{else}}{{#if isMatch}}#f0fdf4{{else}}#fef2f2{{/if}}{{/if}};">
                                                                            <td width="90" style="width:90px; padding:6px 4px; border:1px solid #eef2f7; color:#0f172a; font-size:10px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{attribute}}</td>
                                                                            <td width="110" style="width:110px; padding:6px 4px; border:1px solid #eef2f7; color:#0f172a; font-size:10px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{algorithmLabel algorithm}}</td>
                                                                            <td width="40" style="width:40px; padding:6px 4px; border:1px solid #eef2f7; color:#0f172a; text-align:right; font-weight:900; font-size:10px;">{{formatPercent score}}%</td>
                                                                            <td width="40" style="width:40px; padding:6px 4px; border:1px solid #eef2f7; color:#0f172a; text-align:right; font-size:10px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{formatPercent fusionScore}}%</td>
                                                                        </tr>
                                                                        {{/each}}
                                                                        {{/if}}
                                                                    </table>
                                                                </td>
                                                                {{/each}}
                                                        </tr>
                                                    </table>
                                                </div>
                                                        {{else}}
                                                        <div style="color:#999; font-style:italic; padding:14px; background-color:#f8f9fa; border-radius:4px; text-align:center;">
                                                            No potential matches found for this account.
                                                        </div>
                                                        {{/if}}
                                                        {{else}}
                                                        <div style="color:#999; font-style:italic; padding:14px; background-color:#f8f9fa; border-radius:4px; text-align:center;">
                                                            No potential matches found for this account.
                                                        </div>
                                                        {{/if}}
                                                    </td>
                                                    </tr>
                                                </table>
                                            </div>
                                        </div>
                                        {{/each}}

                                        <div style="margin-top:28px; padding-top:18px; border-top:1px solid #e6ebf5; color:#5f6b7a; font-size:13px; text-align:center;">
                                            This review was generated by the Identity Fusion NG Connector.
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`

/**
 * Email template for edit request notifications
 */
/**
 * Email template for fusion report notifications
 */
export const FUSION_REPORT_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Identity Fusion Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: none;
            margin: 0;
            padding: 0;
            background: linear-gradient(180deg, #f3f6fb 0%, #ffffff 100%);
        }
        .container {
            background-color: #ffffff;
            border-radius: 14px;
            padding: 32px;
            box-shadow: 0 12px 30px rgba(16, 24, 40, 0.12);
            border: 1px solid #e6ebf5;
        }
        .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            padding-bottom: 18px;
            margin-bottom: 22px;
            border-bottom: 1px solid #e6ebf5;
        }
        .header h1 {
            color: #0b5cab;
            margin: 0;
            font-size: 26px;
            letter-spacing: -0.2px;
        }
        .header-subtitle {
            color: #5f6b7a;
            font-size: 13px;
            margin-top: 6px;
        }
        .pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            background: #eef6ff;
            color: #0b5cab;
            border: 1px solid #d6e8ff;
            white-space: nowrap;
        }
        .pill strong {
            font-size: 13px;
        }
        .summary {
            margin-bottom: 26px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
        }
        .summary-card {
            border: 1px solid #e6ebf5;
            border-radius: 12px;
            padding: 14px 14px 12px 14px;
            background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
            box-shadow: 0 6px 16px rgba(16, 24, 40, 0.06);
        }
        .summary-label {
            font-size: 12px;
            color: #5f6b7a;
            font-weight: 700;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            margin-bottom: 6px;
        }
        .summary-value {
            color: #0f172a;
            font-size: 16px;
            font-weight: 700;
        }
        .account-section {
            margin-bottom: 40px;
            border: 1px solid #e6ebf5;
            border-radius: 14px;
            padding: 22px;
            background-color: #ffffff;
            box-shadow: 0 10px 24px rgba(16, 24, 40, 0.08);
        }
        .account-header {
            border-bottom: 1px solid #e6ebf5;
            padding-bottom: 14px;
            margin-bottom: 18px;
        }
        .account-name {
            color: #0b5cab;
            font-size: 20px;
            font-weight: 600;
            margin: 0 0 10px 0;
        }
        .account-info {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            font-size: 14px;
            color: #5f6b7a;
        }
        .account-info-item {
            display: flex;
            gap: 5px;
        }
        .account-info-label {
            font-weight: 600;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            color: #0b5cab;
            font-size: 13px;
            font-weight: 800;
            margin-bottom: 12px;
            letter-spacing: 0.35px;
            text-transform: uppercase;
            padding-bottom: 10px;
            border-bottom: 1px solid #e6ebf5;
        }
        .match-item {
            background-color: #ffffff;
            border: 1px solid #e6ebf5;
            border-left: 6px solid #c7d2fe;
            padding: 18px;
            margin-bottom: 20px;
            border-radius: 12px;
            box-shadow: 0 8px 18px rgba(16, 24, 40, 0.06);
        }
        .match-item.match {
            border-left-color: #22c55e;
        }
        .match-item.no-match {
            border-left-color: #ef4444;
        }
        .match-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            gap: 12px;
            flex-wrap: wrap;
        }
        .match-name {
            font-size: 18px;
            font-weight: 600;
            color: #0b5cab;
        }
        .match-subtitle {
            font-size: 13px;
            color: #5f6b7a;
            margin-top: 4px;
        }
        .match-status {
            padding: 5px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .match-status.match {
            background-color: #dcfce7;
            color: #166534;
        }
        .match-status.no-match {
            background-color: #fee2e2;
            color: #991b1b;
        }
        .scores-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            /* Prevent narrow email clients from wrapping the table into unreadable multi-lines */
            display: block;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            border: 1px solid #e6ebf5;
            border-radius: 10px;
        }
        .scores-table th {
            background-color: #f6f8ff;
            padding: 10px;
            text-align: left;
            font-weight: 600;
            color: #5f6b7a;
            border-bottom: 1px solid #e6ebf5;
            white-space: nowrap;
        }
        .scores-table td {
            padding: 10px;
            border-bottom: 1px solid #eef2f7;
            white-space: nowrap;
        }
        .scores-table tr:hover {
            background-color: #f8fbff;
        }
        .score-value {
            font-weight: 600;
        }
        .score-value.high {
            color: #28a745;
        }
        .score-value.medium {
            color: #ffc107;
        }
        .score-value.low {
            color: #dc3545;
        }
        .match-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .match-badge.yes {
            background-color: #dcfce7;
            color: #166534;
        }
        .match-badge.no {
            background-color: #fee2e2;
            color: #991b1b;
        }
        .no-matches {
            color: #999;
            font-style: italic;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 4px;
            text-align: center;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e6ebf5;
            color: #5f6b7a;
            font-size: 14px;
            text-align: center;
        }
        .attributes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 15px;
        }
        .attribute-item {
            padding: 8px;
            background-color: #f8fbff;
            border-radius: 10px;
            font-size: 13px;
            border: 1px solid #eef2f7;
        }
        .attribute-label {
            font-weight: 600;
            color: #5f6b7a;
            margin-bottom: 3px;
        }
        .attribute-value {
            color: #0f172a;
        }

        /* Responsive stacking for main columns only (keep match row horizontal) */
        @media only screen and (max-width:600px) {
            .main-col {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
            }
        }
    </style>
</head>
<body style="margin:0; padding:0; overflow-x:auto; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; background:#f3f6fb;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse; width:auto; white-space:normal;">
        <tr>
            <td align="center" style="padding:0 16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; width:auto;">
                    <tr>
                        <td style="padding:12px 0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:separate; border-spacing:0; background:#ffffff; border:1px solid #e6ebf5; border-radius:14px; box-shadow:0 12px 30px rgba(16,24,40,0.12);">
                                <tr>
                                    <td style="padding:20px;">
        <div class="header" style="padding-bottom:18px; margin-bottom:22px; border-bottom:1px solid #e6ebf5;">
            <div style="margin-bottom:12px;">
                <h1 style="margin:0; color:#0b5cab; font-size:26px; letter-spacing:-0.2px;">Identity Fusion Report</h1>
                <div class="header-subtitle" style="color:#5f6b7a; font-size:13px; margin-top:6px;">
                    A curated view of potential duplicates and the scoring evidence behind them.
                </div>
            </div>
            <div class="pill" style="display:inline-block; padding:8px 12px; border-radius:999px; background:#eef6ff; color:#0b5cab; border:1px solid #d6e8ff; font-weight:700; font-size:12px;">
                Potential duplicates <strong style="font-size:13px;">{{potentialDuplicates}}</strong>
            </div>
        </div>

        <div class="summary" style="margin-bottom:18px;">
            <!-- Use an email-safe table so the summary uses horizontal space.
                 Potential duplicates count is already shown in the header pill. -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                <tr>
                    <td width="50%" style="width:50%; padding:6px;">
                        <div style="border:1px solid #e6ebf5; border-radius:12px; padding:12px; background:#fbfcff; box-shadow:0 6px 16px rgba(16,24,40,0.06);">
                            <div style="font-size:12px; color:#5f6b7a; font-weight:800; letter-spacing:0.3px; text-transform:uppercase; margin-bottom:6px;">Report Date</div>
                            <div style="color:#0f172a; font-size:16px; font-weight:900;">{{formatDate reportDate}}</div>
                        </div>
                    </td>
                    <td width="50%" style="width:50%; padding:6px;">
                        <div style="border:1px solid #e6ebf5; border-radius:12px; padding:12px; background:#fbfcff; box-shadow:0 6px 16px rgba(16,24,40,0.06);">
                            <div style="font-size:12px; color:#5f6b7a; font-weight:800; letter-spacing:0.3px; text-transform:uppercase; margin-bottom:6px;">Total Accounts Analyzed</div>
                            <div style="color:#0f172a; font-size:16px; font-weight:900;">{{totalAccounts}}</div>
                        </div>
                    </td>
                </tr>
            </table>
        </div>

        {{#each accounts}}
        <div class="account-section" style="margin-bottom:28px; border:1px solid #e6ebf5; border-radius:14px; padding:18px; background:#ffffff; box-shadow:0 10px 24px rgba(16,24,40,0.08);">
            <div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border-spacing:0; width:auto; min-width:100%;">
                    <tr>
                    <!-- Left: duplicate account summary -->
                    <td style="width:280px; min-width:280px; max-width:280px; vertical-align:top; padding-right:14px; border-right:1px solid #eef2f7;">
                        <div style="color:#0b5cab; font-size:18px; font-weight:800; margin:0 0 6px 0;">{{accountName}}</div>
                        <div style="font-size:12px; color:#5f6b7a; margin-bottom:10px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                                <tr>
                                    <td style="font-weight:800; white-space:nowrap; padding:2px 8px 2px 0;">Source:</td>
                                    <td style="padding:2px 8px;">{{accountSource}}</td>
                                </tr>
                                {{#if accountId}}
                                <tr>
                                    <td style="font-weight:800; white-space:nowrap; padding:2px 8px 2px 0;">ID:</td>
                                    <td style="padding:2px 8px; white-space:nowrap; word-break:keep-all;">{{accountId}}</td>
                                </tr>
                                {{/if}}
                                {{#if accountEmail}}
                                <tr>
                                    <td style="font-weight:800; white-space:nowrap; padding:2px 8px 2px 0;">Email:</td>
                                    <td style="padding:2px 8px; word-break:break-all;">{{accountEmail}}</td>
                                </tr>
                                {{/if}}
                            </table>
                        </div>

                        {{#if accountAttributes}}
                        <div style="color:#0b5cab; font-size:12px; font-weight:900; letter-spacing:0.35px; text-transform:uppercase; margin:12px 0 8px 0;">Attributes</div>
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                            {{#each accountAttributes}}
                            <tr>
                                <td style="padding:6px 8px; font-size:12px; color:#5f6b7a; font-weight:700; border:1px solid #eef2f7; background:#f8fbff; width:40%;">{{@key}}</td>
                                <td style="padding:6px 8px; font-size:12px; color:#0f172a; border:1px solid #eef2f7;">{{formatAttribute this}}</td>
                            </tr>
                            {{/each}}
                        </table>
                        {{/if}}
                    </td>

                    <!-- Right: candidates horizontally -->
                    <td style="vertical-align:top; padding-left:14px;">
                        {{#if matches}}
                        {{#if (gt matches.length 0)}}
                        <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; margin-bottom:12px;">
                                <tr>
                                {{#each matches}}
                                <td valign="top" width="280" style="width:280px; vertical-align:top; padding:6px;">
                                    <table role="presentation" width="280" cellpadding="0" cellspacing="0" border="0" style="width:280px; border-collapse:collapse;">
                                        <tr>
                                            <td colspan="4" style="font-weight:900; padding:6px 8px; border-bottom:1px solid #e0e0e0; color:#0b5cab; font-size:12px; letter-spacing:0.35px; text-transform:uppercase; white-space:nowrap;">
                                                Potential Matches
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colspan="4" style="padding:6px 8px;">
                                                <div style="font-size:14px; font-weight:800; color:#0b5cab; line-height:1.3; word-wrap:break-word;">
                                                    {{#if identityUrl}}
                                                    <a href="{{identityUrl}}" style="color:#0b5cab; text-decoration:underline; word-wrap:break-word;">{{identityName}}</a>
                                                    {{else}}
                                                    {{identityName}}
                                                    {{/if}}
                                                </div>
                                            </td>
                                        </tr>
                                        {{#if scores}}
                                        <tr>
                                            <th width="90" style="width:90px; text-align:left; padding:6px 4px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:10px; font-weight:600;">Attribute</th>
                                            <th width="110" style="width:110px; text-align:left; padding:6px 4px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:10px; font-weight:600;">Algorithm</th>
                                            <th width="40" style="width:40px; text-align:right; padding:6px 4px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:10px; font-weight:600;">Score</th>
                                            <th width="40" style="width:40px; text-align:right; padding:6px 4px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:10px; font-weight:600;">Threshold</th>
                                        </tr>
                                        {{#each scores}}
                                        <tr style="background:{{#if (isAverageScoreRow attribute algorithm)}}#e0f2fe{{else}}{{#if isMatch}}#f0fdf4{{else}}#fef2f2{{/if}}{{/if}};">
                                            <td width="90" style="width:90px; padding:6px 4px; border:1px solid #eef2f7; color:#0f172a; font-size:10px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{attribute}}</td>
                                            <td width="110" style="width:110px; padding:6px 4px; border:1px solid #eef2f7; color:#0f172a; font-size:10px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{algorithmLabel algorithm}}</td>
                                            <td width="40" style="width:40px; padding:6px 4px; border:1px solid #eef2f7; color:#0f172a; text-align:right; font-weight:900; font-size:10px;">{{formatPercent score}}%</td>
                                            <td width="40" style="width:40px; padding:6px 4px; border:1px solid #eef2f7; color:#0f172a; text-align:right; font-size:10px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{formatPercent fusionScore}}%</td>
                                        </tr>
                                        {{/each}}
                                        {{/if}}
                                    </table>
                                </td>
                                {{/each}}
                                </tr>
                            </table>
                        </div>
                        {{else}}
                        <div style="color:#999; font-style:italic; padding:20px; background-color:#f8f9fa; border-radius:4px; text-align:center;">No potential matches found for this account.</div>
                        {{/if}}
                        {{else}}
                        <div style="color:#999; font-style:italic; padding:20px; background-color:#f8f9fa; border-radius:4px; text-align:center;">No potential matches found for this account.</div>
                        {{/if}}
                    </td>
                    </tr>
                </table>
            </div>
        </div>
        {{/each}}

        {{#unless accounts}}
        <div class="no-matches" style="margin: 40px 0;">
            No accounts with potential duplicates found in this report.
        </div>
        {{/unless}}

        <div class="footer" style="margin-top:28px; padding-top:18px; border-top:1px solid #e6ebf5; color:#5f6b7a; font-size:13px; text-align:center;">
            <p style="margin: 0;">
                This report was generated by the Identity Fusion NG Connector.<br>
                Please review the potential duplicates and take appropriate action.
            </p>
        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`
