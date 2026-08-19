import Handlebars from 'handlebars'
import type { TemplateDelegate as HandlebarsTemplateDelegate } from 'handlebars'
import { ConnectorError, ConnectorErrorType } from '@sailpoint/connector-sdk'
import { SourceType } from '../../model/config'

export { registerHandlebarsHelpers } from './messagingHandlebarsRegistration'

// ============================================================================
// Template Compilation
// ============================================================================

const DEFAULT_FUSION_REPORT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color:#1f2937; margin:0; padding:0; max-width:100%; overflow-x:hidden; background:#f3f6fb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%; border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0; background:#ffffff; border:1px solid #e6ebf5; border-radius:14px; box-shadow:0 12px 30px rgba(16,24,40,0.12);">
                <tr>
                  <td style="padding:14px 24px 14px 14px;">
        <h1 style="margin:0; color:#0b5cab; font-size:26px; letter-spacing:-0.2px;">{{reportTitle}}</h1>
        {{#if headerSubtitle}}
        <div style="color:#0b5cab; font-size:15px; font-weight:700; margin-top:8px;">{{headerSubtitle}}</div>
        {{/if}}
        <div style="color:#5f6b7a; font-size:13px; margin-top:8px; line-height:1.5;">A curated view of potential matches and the scoring evidence behind them.</div>

        {{#if stats}}
        <div style="margin-top: 18px;">
          <div style="font-size: 12px; color: #0b5cab; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">Processing Statistics</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; table-layout:fixed;">
            {{#each (chunk (processingStatsCards reportDate stats) 3)}}
            <tr>
              {{#each this}}
              <td width="33.33%" style="width:33.33%; vertical-align:top; padding:6px 6px;">
                {{#if this}}
                <div style="border: 1px solid #e6ebf5; border-radius: 10px; padding: 10px; background:#fbfcff;">
                  <div style="font-size: 11px; color: #5f6b7a; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">{{label}}</div>
                  <div style="font-size: 16px; color: #0f172a; font-weight: 700;">{{value}}</div>
                </div>
                {{/if}}
              </td>
              {{/each}}
            </tr>
            {{/each}}
          </table>
        </div>
        {{#if stats.phaseTiming}}
        <div style="margin-top: 18px;">
          <div style="font-size: 12px; color: #0b5cab; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">Phase timing</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; table-layout:fixed;">
            {{#each (chunk (orderedPhaseTimingEntries stats) 3)}}
            <tr>
              {{#each this}}
              <td width="33.33%" style="width:33.33%; vertical-align:top; padding:6px 6px;">
                {{#if this}}
                <div style="border: 1px solid #e6ebf5; border-radius: 10px; padding: 10px; background:#fbfcff;">
                  <div style="font-size: 11px; color: #5f6b7a; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">{{phase}}</div>
                  <div style="font-size: 16px; color: #0f172a; font-weight: 700;">{{elapsed}}</div>
                </div>
                {{/if}}
              </td>
              {{/each}}
            </tr>
            {{/each}}
          </table>
        </div>
        {{/if}}
        {{/if}}

        {{#if (gt stats.aggregationWarnings 0)}}
        <div style="margin-top: 10px; padding: 10px 12px; border: 1px solid #fde68a; border-left: 6px solid #f59e0b; border-radius: 10px; background: #fffbeb;">
          <div style="font-size: 11px; color: #92400e; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">Aggregation Warnings ({{stats.aggregationWarnings}})</div>
          {{#if stats.warningSamples}}
          <div style="font-size: 12px; color: #78350f; line-height: 1.4;">
            {{#each stats.warningSamples}}
            <div style="margin-bottom: 4px;">- {{this}}</div>
            {{/each}}
          </div>
          {{/if}}
        </div>
        {{/if}}
        {{#if (gt stats.aggregationErrors 0)}}
        <div style="margin-top: 10px; padding: 10px 12px; border: 1px solid #fecaca; border-left: 6px solid #ef4444; border-radius: 10px; background: #fef2f2;">
          <div style="font-size: 11px; color: #991b1b; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">Aggregation Errors ({{stats.aggregationErrors}})</div>
          {{#if stats.errorSamples}}
          <div style="font-size: 12px; color: #7f1d1d; line-height: 1.4;">
            {{#each stats.errorSamples}}
            <div style="margin-bottom: 4px;">- {{this}}</div>
            {{/each}}
          </div>
          {{/if}}
        </div>
        {{/if}}

        {{#if fusionReviewDecisions}}
          {{#if (gt fusionReviewDecisions.length 0)}}
          <div style="margin-top: 18px;">
            <div style="font-size: 12px; color: #0b5cab; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">Fusion Review Decisions</div>
            {{#each fusionReviewDecisions}}
            <div style="margin-top: 10px; border: 1px solid #e6ebf5; border-radius: 10px; padding: 12px; background: #fbfcff;">
              <div style="font-size:14px; font-weight:900; color:#0f172a; line-height:1.3;">
                {{decisionLabel}}
                {{#if sourceType}}
                <span style="display:inline-block; margin-left:6px; margin-top:3px; padding:1px 6px; border-radius:6px; background:#eef2f7; color:#5f6b7a; border:1px solid #b0bec5; font-size:10px; font-weight:700; text-transform:uppercase; vertical-align:middle; white-space:nowrap;">{{sourceTypeLabel sourceType}}</span>
                {{/if}}
                {{#if automaticAssignment}}
                <span style="display:inline-block; margin-left:6px; padding:2px 8px; border-radius:6px; background:#e0f2fe; color:#0b5cab; border:1px solid #7dd3fc; font-size:11px; font-weight:700; text-transform:uppercase; vertical-align:middle;">AUTO</span>
                {{/if}}
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px; border-collapse:collapse;">
                <tr>
                  <td style="padding:3px 0; font-size:12px; color:#5f6b7a; font-weight:700; width:140px;">Reviewer</td>
                  <td style="padding:3px 0; font-size:12px; color:#0f172a;">
                    {{#if reviewerUrl}}
                    <a href="{{reviewerUrl}}" style="color:#0b5cab; text-decoration:underline;">{{reviewerName}}</a>
                    {{else}}
                    {{reviewerName}}
                    {{/if}}
                    {{#if reviewerEmail}} ({{reviewerEmail}}){{/if}}
                  </td>
                </tr>
                <tr>
                  <td style="padding:3px 0; font-size:12px; color:#5f6b7a; font-weight:700;">Account</td>
                  <td style="padding:3px 0; font-size:12px; color:#0f172a;">
                    {{#if accountUrl}}
                    <a href="{{accountUrl}}" style="color:#0b5cab; text-decoration:underline;">{{accountName}} [{{accountSource}}]</a>
                    {{else}}
                    {{accountName}} [{{accountSource}}]
                    {{/if}}
                  </td>
                </tr>
                {{#if selectedIdentityId}}
                <tr>
                  <td style="padding:3px 0; font-size:12px; color:#5f6b7a; font-weight:700;">Selected Identity</td>
                  <td style="padding:3px 0; font-size:12px; color:#0f172a;">
                    {{#if selectedIdentityUrl}}
                    <a href="{{selectedIdentityUrl}}" style="color:#0b5cab; text-decoration:underline;">{{selectedIdentityName}}</a>
                    {{else}}
                    {{selectedIdentityName}}
                    {{/if}}
                  </td>
                </tr>
                {{/if}}
                {{#if comments}}
                <tr>
                  <td style="padding:3px 0; font-size:12px; color:#5f6b7a; font-weight:700;">Comments</td>
                  <td style="padding:3px 0; font-size:12px; color:#0f172a;">{{comments}}</td>
                </tr>
                {{/if}}
              </table>
            </div>
            {{/each}}
          </div>
          {{/if}}
        {{/if}}

        {{#if accounts}}
          <div style="margin-top: 18px; font-size: 12px; color: #0b5cab; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">New Fusion Reviews</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 14px 0 14px; max-width:100%; min-width:0; width:100%; vertical-align:top; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch;">
          <div style="display:block; width:auto; min-width:100%; box-sizing:border-box; white-space:nowrap;">
          {{#each accounts}}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table; vertical-align:top; white-space:normal; margin-top:14px; margin-bottom:14px; border:1px solid #e6ebf5; border-radius:10px; background:#ffffff; border-collapse:separate; border-spacing:0; width:auto; min-width:100%; box-sizing:border-box;">
            <tr>
              <td style="padding:12px; vertical-align:top;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border-spacing:0; width:auto; min-width:100%;">
                <tr>
                  <td style="width:324px; min-width:324px; max-width:324px; vertical-align:top; padding-right:10px; border-right:1px solid #eef2f7;">
                    <div style="color:#0b5cab; font-size:18px; font-weight:800; margin:0 0 6px 0;">
                      {{#if accountUrl}}
                      <a href="{{accountUrl}}" style="color:#0b5cab; text-decoration:underline; word-break:break-word; overflow-wrap:anywhere;">{{accountName}}</a>
                      {{else}}
                      {{accountName}}
                      {{/if}}
                    </div>
                    <div style="font-size:12px; color:#5f6b7a; margin-bottom:10px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                        <tr>
                          <td style="font-weight:800; white-space:nowrap; padding:2px 8px 2px 0;">Source:</td>
                          <td style="padding:2px 8px; line-height:1.4;">{{accountSource}} {{#if sourceType}}<span style="display:inline-block; margin-left:4px; margin-top:3px; padding:1px 6px; border-radius:6px; background:#eef2f7; color:#5f6b7a; border:1px solid #b0bec5; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap;">{{sourceTypeLabel sourceType}}</span>{{/if}}</td>
                        </tr>
                        {{#if accountEmail}}
                        <tr>
                          <td style="font-weight:800; white-space:nowrap; padding:2px 8px 2px 0;">Email:</td>
                          <td style="padding:2px 8px; width:150px; max-width:150px; min-width:0; overflow:hidden;"><div style="display:block; width:100%; max-width:150px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="{{accountEmail}}">{{accountEmail}}</div></td>
                        </tr>
                        {{/if}}
                      </table>
                    </div>

                    {{#if accountAttributes}}
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; table-layout:auto; margin-top:8px;">
                      {{#each accountAttributes}}
                      <tr>
                        <td style="padding:6px 8px; font-size:12px; color:#5f6b7a; font-weight:700; border:1px solid #eef2f7; background:#f8fbff; width:1%; white-space:nowrap; word-break:keep-all; overflow-wrap:normal;">{{@key}}</td>
                        <td style="padding:6px 8px; font-size:12px; color:#0f172a; border:1px solid #eef2f7; word-break:break-word; overflow-wrap:anywhere;">{{{formatAccountAttributeValue @key this}}}</td>
                      </tr>
                      {{/each}}
                    </table>
                    {{/if}}
                  </td>
                  <td style="width:34px; min-width:34px; max-width:34px; vertical-align:middle; padding:8px 4px; border-right:1px solid #eef2f7; text-align:center;">
                    <div style="display:inline-block; font-size:11px; line-height:1.05; color:#5f6b7a; font-weight:800; letter-spacing:0.15px; text-transform:uppercase;">
                      M<br>A<br>T<br>C<br>H<br>E<br>S
                    </div>
                  </td>
                  <td style="vertical-align:top; padding-left:14px; width:100%;">
                    {{#if error}}
                    <div style="padding:16px 18px; background:#fef2f2; border:1px solid #fecaca; border-left:6px solid #ef4444; border-radius:10px;">
                      <div style="font-size:12px; color:#991b1b; font-weight:900; letter-spacing:0.35px; text-transform:uppercase; margin-bottom:6px;">Error</div>
                      <div style="font-size:13px; color:#7f1d1d; line-height:1.5;">{{error}}</div>
                    </div>
                    {{else}}
                    {{#if matches}}
                    {{#if (gt matches.length 0)}}
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; margin-bottom:12px;">
                        <tr>
                        {{#each matches}}
                        <td valign="top" style="width:auto; vertical-align:top; padding:4px;">
                          <div style="padding:6px 8px 8px 8px;">
                            <div style="display:block; width:100%; min-width:0;">
                              <div style="vertical-align:middle; font-size:13px; font-weight:800; color:#0b5cab; line-height:1.3; white-space:normal; word-break:break-word; overflow-wrap:anywhere;">
                                {{#if identityUrl}}
                                <a href="{{identityUrl}}" style="color:#0b5cab; text-decoration:underline; white-space:normal; word-break:break-word; overflow-wrap:anywhere;">{{identityName}}</a>
                                {{else}}
                                {{identityName}}
                                {{/if}}
                                {{#if exact}}
                                <span style="display:inline-block; vertical-align:middle; margin-right:6px; padding:2px 8px; border-radius:6px; background:#e0f2fe; color:#0b5cab; border:1px solid #7dd3fc; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap;">Exact</span>
                                {{/if}}
                                {{#if auto}}
                                <span style="display:inline-block; vertical-align:middle; margin-left:6px; padding:2px 8px; border-radius:6px; background:#dcfce7; color:#166534; border:1px solid #86efac; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap;">AUTO</span>
                                {{/if}}
                                {{#if manual}}
                                <span style="display:inline-block; vertical-align:middle; margin-left:6px; padding:2px 8px; border-radius:6px; background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap;">MANUAL</span>
                                {{/if}}
                                {{#if ../deferred}}
                                <span style="display:inline-block; vertical-align:middle; margin-left:6px; padding:2px 8px; border-radius:6px; background:#fffbeb; color:#92400e; border:1px solid #fde68a; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap;">Deferred</span>
                                {{/if}}
                              </div>
                            </div>
                          </div>
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table; width:auto; border-collapse:collapse; table-layout:auto; vertical-align:top;">
                            {{#if scores}}
                            <tr>
                              <th style="white-space:nowrap; text-align:left; padding:4px 6px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:9px; font-weight:600;">Attribute</th>
                              <th style="white-space:nowrap; text-align:left; padding:4px 6px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:9px; font-weight:600;">Algorithm</th>
                              <th style="white-space:nowrap; text-align:right; padding:4px 6px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:9px; font-weight:600;">Threshold</th>
                              <th style="white-space:nowrap; text-align:right; padding:4px 6px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:9px; font-weight:600;">Value</th>
                              <th style="white-space:nowrap; text-align:right; padding:4px 6px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:9px; font-weight:600;">Score</th>
                            </tr>
                            {{#each scores}}
                            <tr style="background:{{#if (isAverageScoreRow attribute algorithm)}}#e0f2fe{{else}}{{#if isMatch}}#f0fdf4{{else}}#fef2f2{{/if}}{{/if}};">
                              <td style="white-space:nowrap; padding:4px 6px; border:1px solid #eef2f7; color:#0f172a; font-size:9px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{attribute}}</td>
                              <td style="white-space:nowrap; padding:4px 6px; border:1px solid #eef2f7; color:#0f172a; font-size:9px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{algorithmLabel algorithm}}</td>
                              <td style="white-space:nowrap; padding:4px 6px; border:1px solid #eef2f7; color:#0f172a; text-align:right; font-size:9px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{formatPercent fusionScore}}%</td>
                              <td style="white-space:nowrap; padding:4px 6px; border:1px solid #eef2f7; color:#0f172a; text-align:right; font-size:9px;">{{#if skipped}}—{{else}}{{#if (isAverageScoreRow attribute algorithm)}}—{{else}}{{formatPercent score}}%{{/if}}{{/if}}</td>
                              <td style="white-space:nowrap; padding:4px 6px; border:1px solid #eef2f7; color:#0f172a; text-align:right; font-weight:900; font-size:9px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{#if skipped}}—{{else}}{{#if (isAverageScoreRow attribute algorithm)}}{{formatPercent score}}%{{else}}{{#if (isFiniteNumber weightedScore)}}{{formatPercent weightedScore}}%{{else}}—{{/if}}{{/if}}{{/if}}</td>
                            </tr>
                            {{/each}}
                            {{/if}}
                          </table>
                        </td>
                        {{/each}}
                        </tr>
                      </table>
                    {{else}}
                    <div style="color:#999; font-style:italic; padding:20px; background-color:#f8f9fa; border-radius:4px; text-align:center;">No match found</div>
                    {{/if}}
                    {{else}}
                    <div style="color:#999; font-style:italic; padding:20px; background-color:#f8f9fa; border-radius:4px; text-align:center;">No match found</div>
                    {{/if}}
                    {{/if}}
                  </td>
                </tr>
              </table>
              </td>
            </tr>
          </table>
          <span style="display:inline-block; width:14px; min-width:14px; height:1px; line-height:1px; font-size:1px;">&nbsp;</span><br>
          {{/each}}
          </div>
                  </td>
                </tr>
        {{else}}
          <p style="margin: 18px 0 0 0; color: #6b7280;">No accounts included in this report.</p>
                  </td>
                </tr>
        {{/if}}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

const DEFAULT_FUSION_REVIEW_TEMPLATE = `<!DOCTYPE html>
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
            max-width: 100%;
            margin: 0;
            padding: 0;
            background: linear-gradient(180deg, #f3f6fb 0%, #ffffff 100%);
            overflow-x: hidden;
        }

        /* Wide review content: inner frames grow with tables; horizontal scroll on body row only */
        .review-body-wrap {
            display: table;
            width: auto;
            min-width: 100%;
            box-sizing: border-box;
            white-space: nowrap;
        }
        .review-account-card {
            box-sizing: border-box;
            border-collapse: separate;
            border-spacing: 0;
            display: inline-table;
            width: auto;
            min-width: 100%;
            vertical-align: top;
            white-space: normal;
        }

        /* Title row: stack CTA under heading on small screens */
        @media only screen and (max-width:600px) {
            .main-col {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
            }
            .header-cta-col {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                text-align: left !important;
                padding: 10px 0 0 0 !important;
            }
            .header-title-col {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
            }
        }
    </style>
</head>
<body style="margin:0; padding:0; max-width:100%; overflow-x:hidden; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; background:#f3f6fb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%; border-collapse:collapse;">
        <tr>
            <td align="center" style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                    <tr>
                        <td style="padding:12px; max-width:100%;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0; background:#ffffff; border:1px solid #e6ebf5; border-radius:14px; box-shadow:0 12px 30px rgba(16,24,40,0.12);">
                                <tr>
                                    <td style="padding:14px 24px 0 14px; max-width:100%; vertical-align:top;">
                                        <div style="padding-bottom:18px; margin-bottom:22px; border-bottom:1px solid #e6ebf5;">
                                            <div style="margin-bottom:12px;">
                                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; margin:0; padding:0;">
                                                    <tr>
                                                        <td class="header-title-col" valign="top" style="width:100%; min-width:0; vertical-align:top; padding:0;">
                                                            <h1 style="margin:0; color:#0b5cab; font-size:26px; letter-spacing:-0.2px; line-height:1.25;">Identity Fusion Review Required</h1>
                                                        </td>
                                                        {{#if formUrl}}
                                                        <td class="header-cta-col" valign="top" align="right" style="white-space:nowrap; vertical-align:top; padding:10px 0 0 16px;">
                                                            <a href="{{formUrl}}" style="display:inline-block; padding:10px 14px; border-radius:10px; background:#0b5cab; color:#ffffff; font-weight:900; font-size:13px; text-decoration:none;">Open Review Form</a>
                                                        </td>
                                                        {{/if}}
                                                    </tr>
                                                </table>
                                                {{#if headerSubtitle}}
                                                <div style="color:#0b5cab; font-size:15px; font-weight:700; margin-top:8px;">{{headerSubtitle}}</div>
                                                {{/if}}
                                                <div style="color:#5f6b7a; font-size:13px; margin-top:6px;">
                                                    Please review the potential match and take appropriate action.
                                                </div>
                                                {{#each accounts}}
                                                {{#if accountSource}}
                                                <div style="color:#5f6b7a; font-size:12px; margin-top:8px; font-weight:600;">
                                                    Source: <span style="color:#0b5cab;">{{accountSource}}</span>
                                                    {{#if sourceType}}<span style="display:inline-block; margin-left:6px; margin-top:3px; padding:1px 6px; border-radius:6px; background:#eef2f7; color:#5f6b7a; border:1px solid #b0bec5; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap;">{{sourceTypeLabel sourceType}}</span>{{/if}}
                                                </div>
                                                {{/if}}
                                                {{/each}}
                                            </div>
                                            <!-- No "potential matches" count in review email -->
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:0 14px 0 14px; max-width:100%; min-width:0; width:100%; vertical-align:top; overflow-x:auto; overflow-y:visible; -webkit-overflow-scrolling:touch;">
                                        <div class="review-body-wrap" style="display:block; width:auto; min-width:100%; box-sizing:border-box; white-space:nowrap;">
                                        {{#each accounts}}
                                        <table role="presentation" class="review-account-card" cellpadding="0" cellspacing="0" border="0" style="display:inline-table; vertical-align:top; white-space:normal; margin-bottom:20px; border:1px solid #e6ebf5; border-radius:14px; background:#ffffff; box-shadow:0 6px 14px rgba(16,24,40,0.08); border-collapse:separate; border-spacing:0; width:auto; min-width:100%; box-sizing:border-box;">
                                            <tr>
                                                <td style="padding:12px; vertical-align:top;">
                                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; width:auto; min-width:100%;">
                                                    <tr>
                                                    <!-- Left: candidate account summary -->
                                                    <td class="main-col" valign="top" style="width:324px; min-width:324px; max-width:324px; vertical-align:top; padding:8px 6px; border-right:1px solid #eef2f7;">
                                                        <div style="color:#0b5cab; font-size:18px; font-weight:800; margin:0 0 6px 0;">
                                                            {{#if accountUrl}}
                                                            <a href="{{accountUrl}}" style="color:#0b5cab; text-decoration:underline; word-break:break-word; overflow-wrap:anywhere;">{{accountName}}</a>
                                                            {{else}}
                                                            {{accountName}}
                                                            {{/if}}
                                                        </div>
                                                        <div style="font-size:12px; color:#5f6b7a; margin-bottom:10px;">
                                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                                                                <tr>
                                                                    <td style="font-weight:800; white-space:nowrap; padding:2px 8px 2px 0;">Source:</td>
                                                                    <td style="padding:2px 8px; line-height:1.4;">{{accountSource}} {{#if sourceType}}<span style="display:inline-block; margin-left:4px; margin-top:3px; padding:1px 6px; border-radius:6px; background:#eef2f7; color:#5f6b7a; border:1px solid #b0bec5; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap;">{{sourceTypeLabel sourceType}}</span>{{/if}}</td>
                                                                </tr>
                                                                {{#if accountEmail}}
                                                                <tr>
                                                                    <td style="font-weight:800; white-space:nowrap; padding:2px 8px 2px 0;">Email:</td>
                                                                    <td style="padding:2px 8px; width:150px; max-width:150px; min-width:0; overflow:hidden;"><div style="display:block; width:100%; max-width:150px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="{{accountEmail}}">{{accountEmail}}</div></td>
                                                                </tr>
                                                                {{/if}}
                                                            </table>
                                                        </div>

                                                        {{#if accountAttributes}}
                                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; table-layout:auto; margin-top:8px;">
                                                            {{#each accountAttributes}}
                                                            <tr>
                                                                <td style="padding:6px 8px; font-size:12px; color:#5f6b7a; font-weight:700; border:1px solid #eef2f7; background:#f8fbff; width:1%; white-space:nowrap; word-break:keep-all; overflow-wrap:normal;">{{@key}}</td>
                                                                <td style="padding:6px 8px; font-size:12px; color:#0f172a; border:1px solid #eef2f7; word-break:break-word; overflow-wrap:anywhere;">{{{formatAccountAttributeValue @key this}}}</td>
                                                            </tr>
                                                            {{/each}}
                                                        </table>
                                                        {{/if}}
                                                    </td>
                                                    <td valign="top" style="width:34px; min-width:34px; max-width:34px; vertical-align:middle; padding:8px 4px; border-right:1px solid #eef2f7; text-align:center;">
                                                        <div style="display:inline-block; font-size:11px; line-height:1.05; color:#5f6b7a; font-weight:800; letter-spacing:0.15px; text-transform:uppercase;">
                                                            M<br>A<br>T<br>C<br>H<br>E<br>S
                                                        </div>
                                                    </td>

                                                    <!-- Right: matches (report-style) -->
                                                    <td class="main-col" valign="top" style="vertical-align:top; padding:8px; width:100%;">
                                                        {{#if matches}}
                                                        {{#if (gt matches.length 0)}}
                                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; width:auto; margin-bottom:12px;">
                                                                <tr>
                                                                {{#each matches}}
                                                                <td valign="top" style="width:auto; vertical-align:top; padding:3px;">
                                                                    <div style="padding:6px 8px 8px 8px;">
                                                                        <div style="display:block; width:100%; min-width:0;">
                                                                            <div style="vertical-align:middle; font-size:13px; font-weight:800; color:#0b5cab; line-height:1.3; white-space:normal; word-break:break-word; overflow-wrap:anywhere;">
                                                                                {{#if identityUrl}}
                                                                                <a href="{{identityUrl}}" style="color:#0b5cab; text-decoration:underline; white-space:normal; word-break:break-word; overflow-wrap:anywhere;">{{identityName}}</a>
                                                                                {{else}}
                                                                                {{identityName}}
                                                                                {{/if}}
                                                                                {{#if exact}}
                                                                                <span style="display:inline-block; vertical-align:middle; margin:4px 0 0 6px; padding:2px 8px; border-radius:6px; background:#e0f2fe; color:#0b5cab; border:1px solid #7dd3fc; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap;">Exact</span>
                                                                                {{/if}}
                                                                                {{#if auto}}
                                                                                <span style="display:inline-block; vertical-align:middle; margin-left:6px; padding:2px 8px; border-radius:6px; background:#dcfce7; color:#166534; border:1px solid #86efac; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap;">AUTO</span>
                                                                                {{/if}}
                                                                                {{#if manual}}
                                                                                <span style="display:inline-block; vertical-align:middle; margin-left:6px; padding:2px 8px; border-radius:6px; background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap;">MANUAL</span>
                                                                                {{/if}}
                                                                                {{#if ../deferred}}
                                                                                <span style="display:inline-block; vertical-align:middle; margin-left:6px; padding:2px 8px; border-radius:6px; background:#fffbeb; color:#92400e; border:1px solid #fde68a; font-size:10px; font-weight:700; text-transform:uppercase; white-space:nowrap;">Deferred</span>
                                                                                {{/if}}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table; width:auto; border-collapse:collapse; table-layout:auto; vertical-align:top;">
                                                                        {{#if scores}}
                                                                        <tr>
                                                                            <th style="white-space:nowrap; text-align:left; padding:4px 6px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:9px; font-weight:600;">Attribute</th>
                                                                            <th style="white-space:nowrap; text-align:left; padding:4px 6px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:9px; font-weight:600;">Algorithm</th>
                                                                            <th style="white-space:nowrap; text-align:right; padding:4px 6px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:9px; font-weight:600;">Threshold</th>
                                                                            <th style="white-space:nowrap; text-align:right; padding:4px 6px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:9px; font-weight:600;">Value</th>
                                                                            <th style="white-space:nowrap; text-align:right; padding:4px 6px; border:1px solid #eef2f7; background:#f6f8ff; color:#5f6b7a; font-size:9px; font-weight:600;">Score</th>
                                                                        </tr>
                                                                        {{#each scores}}
                                                                        <tr style="background:{{#if (isAverageScoreRow attribute algorithm)}}#e0f2fe{{else}}{{#if isMatch}}#f0fdf4{{else}}#fef2f2{{/if}}{{/if}};">
                                                                            <td style="white-space:nowrap; padding:4px 6px; border:1px solid #eef2f7; color:#0f172a; font-size:9px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{attribute}}</td>
                                                                            <td style="white-space:nowrap; padding:4px 6px; border:1px solid #eef2f7; color:#0f172a; font-size:9px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{algorithmLabel algorithm}}</td>
                                                                            <td style="white-space:nowrap; padding:4px 6px; border:1px solid #eef2f7; color:#0f172a; text-align:right; font-size:9px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{formatPercent fusionScore}}%</td>
                                                                            <td style="white-space:nowrap; padding:4px 6px; border:1px solid #eef2f7; color:#0f172a; text-align:right; font-size:9px;">{{#if skipped}}—{{else}}{{#if (isAverageScoreRow attribute algorithm)}}—{{else}}{{formatPercent score}}%{{/if}}{{/if}}</td>
                                                                            <td style="white-space:nowrap; padding:4px 6px; border:1px solid #eef2f7; color:#0f172a; text-align:right; font-weight:900; font-size:9px; {{#if (isAverageScoreRow attribute algorithm)}}font-weight:900;{{/if}}">{{#if skipped}}—{{else}}{{#if (isAverageScoreRow attribute algorithm)}}{{formatPercent score}}%{{else}}{{#if (isFiniteNumber weightedScore)}}{{formatPercent weightedScore}}%{{else}}—{{/if}}{{/if}}{{/if}}</td>
                                                                        </tr>
                                                                        {{/each}}
                                                                        {{/if}}
                                                                    </table>
                                                                </td>
                                                                {{/each}}
                                                        </tr>
                                                    </table>
                                                        {{else}}
                                                        <div style="color:#999; font-style:italic; padding:14px; background-color:#f8f9fa; border-radius:4px; text-align:center;">
                                                            No match found
                                                        </div>
                                                        {{/if}}
                                                        {{else}}
                                                        <div style="color:#999; font-style:italic; padding:14px; background-color:#f8f9fa; border-radius:4px; text-align:center;">
                                                            No match found
                                                        </div>
                                                        {{/if}}
                                                    </td>
                                                    </tr>
                                                </table>
                                                </td>
                                            </tr>
                                        </table>
                                        <span style="display:inline-block; width:14px; min-width:14px; height:1px; line-height:1px; font-size:1px;">&nbsp;</span><br>
                                        {{/each}}
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:0 24px 14px 14px; max-width:100%;">
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
</html>`

export const compileEmailTemplates = (): Map<string, HandlebarsTemplateDelegate> => {
    const templates = new Map<string, HandlebarsTemplateDelegate>()

    // Runtime source of truth: always use in-code templates to avoid
    // runtime path issues in ISC packaging. Keep src/services/messagingService/templates/*.hbs
    // behaviorally in sync as human-readable references.
    templates.set('fusion-report', Handlebars.compile(DEFAULT_FUSION_REPORT_TEMPLATE))
    templates.set('fusion-review', Handlebars.compile(DEFAULT_FUSION_REVIEW_TEMPLATE))
    return templates
}

// ============================================================================
// Template Rendering Types
// ============================================================================

/**
 * Review email uses the same data shape as the report (single-account report),
 * plus the standalone form URL for actioning the review.
 */
export type FusionReviewEmailData = {
    accounts: FusionReportEmailData['accounts']
    totalAccounts: number
    matches: number
    reportDate: Date | string
    formInstanceId?: string
    formUrl?: string
    /** Tenant host and fusion source, e.g. "acme.identitynow.com - My Fusion Source" */
    headerSubtitle?: string
}

export type EditRequestEmailData = {
    accountName: string
    accountSource: string
    accountAttributes: Record<string, any>
    formInstanceId?: string
}

export type FusionReportEmailData = {
    reportTitle: string
    /** Tenant host and fusion source, e.g. "acme.identitynow.com - My Fusion Source" */
    headerSubtitle?: string
    accounts: Array<{
        accountName: string
        accountUrl?: string
        accountSource: string
        sourceType?: SourceType
        deferred?: boolean
        accountId?: string
        accountEmail?: string
        accountAttributes?: Record<string, any>
        error?: string
        matches: Array<{
            identityName: string
            identityId?: string
            identityUrl?: string
            isMatch: boolean
            exact?: boolean
            scores?: Array<{
                attribute: string
                algorithm?: string
                score: number
                fusionScore?: number
                isMatch: boolean
                comment?: string
            }>
        }>
    }>
    totalAccounts: number
    matches: number
    reportDate: Date | string
    fusionReviewDecisions?: Array<{
        reviewerId: string
        reviewerName: string
        reviewerUrl?: string
        reviewerEmail?: string
        accountId: string
        accountName: string
        accountUrl?: string
        accountSource: string
        sourceType?: SourceType
        decision: 'assign-existing-identity' | 'create-new-identity' | 'confirm-no-match'
        decisionLabel: string
        selectedIdentityId?: string
        selectedIdentityName?: string
        selectedIdentityUrl?: string
        comments?: string
        formUrl?: string
        automaticAssignment?: boolean
    }>
    stats?: {
        totalFusionAccounts?: number
        fusionAccountsFound?: number
        fusionReviewsCreated?: number
        fusionReviewAssignments?: number
        fusionReviewsFound?: number
        fusionReviewInstancesFound?: number
        fusionAutomaticMatches?: number
        fusionReviewsProcessed?: number
        fusionReviewNewIdentities?: number
        fusionReviewNonMatches?: number
        fusionReviewDecisionsAuthoritative?: number
        fusionReviewDecisionsRecord?: number
        fusionReviewDecisionsOrphan?: number
        fusionReviewNewIdentitiesAuthoritative?: number
        fusionReviewNoMatchesRecord?: number
        fusionReviewNoMatchesOrphan?: number
        identitiesFound?: number
        identitiesProcessed?: number
        managedAccountsFound?: number
        managedAccountsFoundAuthoritative?: number
        managedAccountsFoundRecord?: number
        managedAccountsFoundOrphan?: number
        managedAccountsProcessed?: number
        managedAccountsProcessedAuthoritative?: number
        managedAccountsProcessedRecord?: number
        managedAccountsProcessedOrphan?: number
        totalProcessingTime?: string
        usedMemory?: string
        phaseTiming?: Array<{ phase: string; elapsed: string }>
    }
}

// ============================================================================
// Template Rendering Functions
// ============================================================================

/**
 * Render fusion review email template
 */
export const renderFusionReviewEmail = (
    templates: Map<string, HandlebarsTemplateDelegate>,
    data: FusionReviewEmailData
): string => {
    const template = templates.get('fusion-review')
    if (!template) {
        throw new ConnectorError(
            'Fusion review email template not found. Email templates may not have been compiled correctly.',
            ConnectorErrorType.Generic
        )
    }
    return template(data)
}

/**
 * Render edit request email template
 */
export const renderEditRequestEmail = (
    templates: Map<string, HandlebarsTemplateDelegate>,
    data: EditRequestEmailData
): string => {
    const template = templates.get('edit-request')
    if (!template) {
        throw new ConnectorError(
            'Edit request email template not found. Email templates may not have been compiled correctly.',
            ConnectorErrorType.Generic
        )
    }
    return template(data)
}

/**
 * Render fusion report email template
 */
export const renderFusionReport = (
    templates: Map<string, HandlebarsTemplateDelegate>,
    data: FusionReportEmailData
): string => {
    const template = templates.get('fusion-report')
    if (!template) {
        throw new ConnectorError(
            'Fusion report email template not found. Email templates may not have been compiled correctly.',
            ConnectorErrorType.Generic
        )
    }
    return template(data)
}
