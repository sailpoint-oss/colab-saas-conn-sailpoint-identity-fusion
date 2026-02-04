# Troubleshooting Identity Fusion NG

This comprehensive troubleshooting guide helps you diagnose and resolve common issues when using Identity Fusion NG. Issues are organized by category with symptoms, root causes, diagnostic steps, and solutions.

---

## Diagnostic approach

### General troubleshooting workflow

| Step | Action | Goal |
|------|--------|------|
| 1. **Identify symptom** | What is failing? When? How often? | Clear problem statement |
| 2. **Gather context** | Logs, configuration, recent changes | Evidence |
| 3. **Form hypothesis** | What might cause this? | Potential root cause |
| 4. **Test hypothesis** | Check specific setting/log/behavior | Validate or invalidate |
| 5. **Apply fix** | Change configuration/code/environment | Resolve issue |
| 6. **Verify** | Test end-to-end; confirm resolution | Ensure fixed |
| 7. **Document** | Record issue and solution | Future reference |

### Information to gather

| Category | What to collect | Where to find |
|----------|----------------|---------------|
| **Configuration** | Source settings, attribute mappings, fusion settings | ISC connector configuration |
| **Logs** | Connector logs, ISC logs, external logs (if enabled) | ISC → Admin → Dashboard → System → Application Logs; external log endpoint |
| **Recent changes** | Config changes, ISC upgrades, source changes | Change management records |
| **Environment** | ISC tenant, source versions, network config | Documentation |
| **Timing** | When did issue start? Frequency? Pattern? | Logs, monitoring |

---

## Category 1: Connection and authentication

### Issue 1.1: Test connection fails

**Symptom:** "Test Connection" in ISC fails or times out.

**Screenshot placeholder:** Test connection interface.

![Test connection - Interface](../assets/images/troubleshooting-test-connection.png)
<!-- PLACEHOLDER: Screenshot of Connection Settings and Review and Test. Save as docs/assets/images/troubleshooting-test-connection.png -->

**Possible causes:**

| Cause | Diagnostic | Solution |
|-------|-----------|----------|
| **Incorrect ISC API URL** | Check format: `https://<tenant>.api.identitynow.com` | Correct URL in Connection Settings |
| **Wrong PAT credentials** | Test PAT separately with API call (e.g., curl) | Regenerate PAT; update ID and secret |
| **PAT expired** | Check PAT creation date | Regenerate PAT |
| **PAT missing permissions** | Check PAT scopes in ISC | Grant required scopes: `sp:scim:read`, `sp:scim:write`, `sp:accounts:read`, `sp:accounts:write`, `sp:forms:manage` |
| **Network/firewall** | Try from different network; check firewall logs | Whitelist ISC API IPs; check network policy |
| **ISC API down** | Check ISC status page | Wait for ISC to recover; contact SailPoint support |

**Diagnostic steps:**

```bash
# Test PAT with curl
curl -X GET https://[tenant].api.identitynow.com/v3/sources \
  -H "Authorization: Bearer $(echo -n [clientId]:[clientSecret] | base64)"

# Expected: 200 OK with list of sources
# If 401: PAT invalid
# If 403: PAT lacks permissions
# If timeout: Network/firewall issue
```

### Issue 1.2: 401 Unauthorized errors

**Symptom:** Logs show "401 Unauthorized" from ISC API.

**Root cause:** PAT authentication failure.

| Check | How to verify | Fix |
|-------|--------------|-----|
| **PAT ID correct?** | Compare ISC config to PAT in ISC UI | Update PAT ID |
| **PAT secret correct?** | Regenerate PAT; update secret | Update PAT secret |
| **PAT not expired?** | Check PAT creation date (PATs don't expire by default, but can be revoked) | Regenerate if revoked |

### Issue 1.3: 403 Forbidden errors

**Symptom:** Logs show "403 Forbidden" from ISC API.

**Root cause:** PAT lacks required permissions (scopes).

**Required API scopes:**

| Scope | Purpose |
|-------|---------|
| `sp:scopes:all` | All operations (or use specific scopes below) |
| `sp:scim:read`, `sp:scim:write` | Identity/account operations |
| `sp:accounts:read`, `sp:accounts:write` | Account management |
| `sp:forms:manage` | Create/manage review forms (for deduplication) |
| `sp:workflow:execute` | Execute workflows (for notifications) |

**Solution:**
1. Go to ISC → Admin → Security → Personal Access Tokens
2. Find PAT or create new one
3. Grant required scopes
4. Update connector config with new PAT (if created new)

---

## Category 2: Aggregation issues

### Issue 2.1: Aggregation hangs or times out

**Symptom:** Account or entitlement aggregation never completes or times out after extended period.

**Possible causes:**

| Cause | Diagnostic | Solution |
|-------|-----------|----------|
| **Provisioning timeout too low** | Check timeout vs actual runtime | Increase **Provisioning timeout** in Advanced Settings (e.g., 600–1800 seconds) |
| **Force aggregation enabled** | Check if **Force aggregation before processing?** is Yes for sources | Disable force aggregation; or increase timeout |
| **API rate limits (429)** | Check logs for HTTP 429 errors | Enable retry; lower RPS in Advanced Settings |
| **Large dataset** | Number of accounts | Increase timeout; enable batching |
| **Slow source API** | Test source API response time | Optimize source; increase timeout |

**Diagnostic steps:**

```
1. Check aggregation history in ISC:
   - Duration of past runs
   - Number of accounts processed
   - Error messages

2. Review connector logs:
   - Look for "timeout" or "429" errors
   - Check processing stages (where is it slow?)

3. Calculate expected runtime:
   - Accounts / (RPS * 60) = approx minutes
   - Example: 10,000 accounts / (10 RPS * 60) = ~17 minutes
   - Add buffer for processing time

4. Adjust timeout accordingly
```

### Issue 2.2: No accounts or fewer accounts than expected

**Symptom:** After aggregation, Fusion source has zero accounts or significantly fewer than expected.

**Possible causes:**

| Cause | Diagnostic | Solution |
|-------|-----------|----------|
| **Source name mismatch** | Check exact source names in ISC vs config | Update source names in **Authoritative account sources** (case-sensitive) |
| **Identity Scope Query too strict** | Test query in ISC search | Relax query; or use `*` for all identities |
| **Account filter excludes accounts** | Review filter logic | Adjust or remove **Account filter** |
| **Sources not aggregated** | Check source aggregation history | Run aggregation on source systems first |
| **Stuck processing state** | Check account history for "processing" status | Enable **Reset processing flag** once; run aggregation |
| **Configuration error** | Review all configuration fields | Validate configuration |

**Screenshot placeholder:** Source configuration.

![Source configuration - Settings](../assets/images/troubleshooting-sources.png)
<!-- PLACEHOLDER: Screenshot of Source Settings showing source names. Save as docs/assets/images/troubleshooting-sources.png -->

**Diagnostic steps:**

```
1. Verify source names:
   Go to ISC → Admin → Connections → Sources
   Compare names exactly (case-sensitive) to config

2. Test Identity Scope Query:
   Go to ISC → Search
   Enter same query as Identity Scope Query
   Check: Does it return expected identities?

3. Check source accounts:
   Go to each configured source in ISC
   Verify accounts exist and are aggregated

4. Review Fusion accounts:
   Go to Fusion source → Accounts
   Check account attributes for clues
```

### Issue 2.3: Aggregation succeeds but accounts are disabled

**Symptom:** Fusion accounts exist but are in "disabled" state.

**Root cause:** By design; Fusion source disables new accounts initially.

**Why:** Fusion is authoritative; new accounts create new identities. Disabling allows identity profile to enable them (triggering correlation with source accounts) via provisioning plan.

**Solution:** Configure identity profile provisioning plan:

1. Go to ISC → Admin → Identities → Identity Profiles
2. Find Fusion identity profile
3. Go to **Lifecycle States → Provisioning Policies**
4. Create/edit provisioning plan:
   - Name: "Staging" or similar
   - Trigger: On identity creation
   - Action: **Enable Account** on Fusion source
5. Save
6. Next aggregation will enable accounts

**Alternative:** Manually enable accounts in ISC (not scalable).

---

## Category 3: Attribute and schema issues

### Issue 3.1: Unique attribute generation fails or loops

**Symptom:** Errors about unique attribute generation; aggregation hangs; logs show repeated collision attempts.

**Possible causes:**

| Cause | Diagnostic | Solution |
|-------|-----------|----------|
| **Expression always same value** | Check Velocity expression | Add variable parts (firstname, lastname) instead of fixed strings |
| **Max attempts too low** | Check **Maximum attempts for unique attribute generation** | Increase to 200–500 for large datasets |
| **High collision rate** | Many accounts with same firstname+lastname | Use more distinguishing expression (add middle initial, employee ID, etc.) |

**Example fix:**

```velocity
# BAD: Always produces "user" (fixed string)
user

# BAD: Always produces "user" + counter (no variability)
#set($prefix = "user")
$prefix

# GOOD: Uses firstname and lastname (varies per person)
#set($initial = $firstname.substring(0,1))
$initial$lastname
→ jsmith, ksmith, jjones, etc.
```

### Issue 3.2: Schema discovery shows wrong or missing attributes

**Symptom:** Discovered schema does not match configuration; attributes missing or have wrong type.

**Possible causes:**

| Cause | Diagnostic | Solution |
|-------|-----------|----------|
| **Config not saved** | Re-check config after schema discovery | Save config; run Discover Schema again |
| **Source attribute name wrong** | Check source schema in ISC | Correct **Existing attributes** names (case-sensitive) |
| **Attribute merge creates multi-valued** | Check merge strategy | If using "Keep a list of values", attribute becomes multi-valued (entitlement-type) |
| **Schema cached** | Old schema cached | Run Discover Schema again; wait 5 minutes; try again |

**Diagnostic steps:**

```
1. Check source schema:
   Go to source in ISC → Account Schema
   Verify attribute names (case-sensitive)

2. Re-run Discover Schema:
   Fusion source → Account Schema → Discover Schema

3. Compare:
   Expected attributes (from config)
   vs
   Discovered attributes (in ISC)

4. If mismatch persists:
   - Check logs for errors during schema discovery
   - Verify Attribute Mapping and Attribute Definition config
```

### Issue 3.3: Velocity expression errors

**Symptom:** Aggregation fails; logs show Velocity syntax errors or null pointer exceptions.

**Common errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Null pointer exception` | Referenced attribute is null | Add null check: `#if($attr)..#end` |
| `Syntax error` | Invalid Velocity syntax | Check syntax: `#set($var = value)`, `#if()...#end` |
| `Method not found` | Typo in method name | Correct: `$firstname.substring(0,1)` not `$firstname.substr(0,1)` |
| `Index out of bounds` | String too short for substring | Check length: `#if($firstname.length() > 0)..#end` |

**Best practices:**

```velocity
# Always check for null/empty
#if($firstname && $firstname.length() > 0)
  #set($initial = $firstname.substring(0,1))
  $initial$lastname
#else
  unknown
#end

# Use safe navigation
${firstname}${lastname}  ## Returns empty string if null
vs
$firstname$lastname      ## Throws error if null
```

---

## Category 4: Deduplication issues

### Issue 4.1: No potential duplicates found (expected some)

**Symptom:** No review forms generated even though duplicates are expected.

**Possible causes:**

| Cause | Diagnostic | Solution |
|-------|-----------|----------|
| **Thresholds too high** | Check **Similarity score** settings | Lower thresholds by 5–10 points (e.g., 90 → 80) |
| **No identity baseline** | Check **Include identities in the scope?** | Enable; set **Identity Scope Query** |
| **Identity Scope Query returns nothing** | Test query in ISC search | Fix query; or use `*` |
| **Algorithm mismatch** | Check algorithm for attribute type | Use appropriate algorithm (see [Matching algorithms](matching-algorithms.md)) |
| **Attributes missing** | Check if attributes exist on identities | Verify attributes populated on identities |
| **Mandatory match too strict** | Check **Mandatory match?** settings | Make some attributes optional |

**Diagnostic steps:**

```
1. Verify identity baseline:
   ISC → Search → Enter Identity Scope Query
   Expected: Returns identities
   If zero: Fix query

2. Check attribute values:
   View sample identity
   Verify attributes used in matching exist and have values

3. Test with lower thresholds:
   Temporarily lower all similarity scores by 10 points
   Run aggregation
   If matches found: Thresholds were too high
   If still no matches: Check algorithm, attributes

4. Review configuration:
   Fusion Settings → Matching Settings
   Ensure at least one Fusion attribute match configured
```

### Issue 4.2: Too many false positives (wrong matches)

**Symptom:** Many review forms for obviously non-duplicate identities.

**Possible causes:**

| Cause | Diagnostic | Solution |
|-------|-----------|----------|
| **Thresholds too low** | Review generated forms | Raise **Similarity score** thresholds by 5–10 points |
| **Wrong algorithm** | Check algorithm used | Switch to more appropriate algorithm |
| **Missing mandatory matches** | No critical attributes required | Add **Mandatory match?** for email or employee ID |
| **Poor data quality** | Many null/empty values; inconsistent formats | Improve data quality in sources |

**Solution approaches:**

| Approach | Configuration | Effect |
|----------|---------------|--------|
| **Raise thresholds** | Increase scores by 5–10 points | Fewer matches; stricter |
| **Add mandatory match** | Set **Mandatory match?** = Yes for critical attribute (email) | Only flag if email also matches |
| **Add more attributes** | Configure additional Fusion attribute matches | More criteria; fewer false positives |
| **Change algorithm** | Switch to stricter algorithm | Better fit for data type |

### Issue 4.3: Reviewers not receiving forms

**Symptom:** Potential duplicates detected but reviewers not notified.

**Possible causes:**

| Cause | Diagnostic | Solution |
|-------|-----------|----------|
| **Access profile not assigned** | Check reviewer's access profiles | Assign `<Source> reviewer` access profile |
| **Email notifications disabled** | Check ISC notification settings | Enable form notifications in ISC |
| **Forms expired** | Check **Manual review expiration days** | Increase expiration; create new forms |
| **No reviewers configured** | Check **Owner is global reviewer?** | Enable; or assign reviewer access profiles |

**Diagnostic steps:**

```
1. Check access profiles:
   ISC → Admin → Access Profiles
   Find "<Source Name> Reviewer" access profile
   Check: Is it assigned to reviewers?

2. Check forms:
   ISC → Admin → Forms
   Filter by Fusion source
   Check: Are forms created? Status?

3. Check notification settings:
   ISC → Admin → System → Notifications
   Ensure form notifications enabled

4. Test:
   Manually create test form
   Assign to yourself
   Expected: Receive email
```

---

## Category 5: Proxy mode issues

### Issue 5.1: Connection to proxy fails

**Symptom:** "Failed to connect to proxy server" or connection timeout.

**Possible causes:**

| Cause | Diagnostic | Solution |
|-------|-----------|----------|
| **Proxy URL wrong** | Compare config to actual server URL | Correct **Proxy URL** |
| **Server not running** | Check server status | Start proxy server |
| **Firewall blocks traffic** | Test from ISC network (if possible) | Whitelist ISC IPs; open firewall ports |
| **DNS not resolving** | `nslookup <proxy-domain>` | Fix DNS; use IP address temporarily |
| **Server port wrong** | Check port in URL vs server | Correct port in URL |

**Diagnostic steps:**

```bash
# Test from external network (simulates ISC)
curl -X POST https://your-proxy.com/fusion \
  -H "Content-Type: application/json" \
  -d '{"type":"std:test-connection","input":{},"config":{"proxyPassword":"..."}}'

# Expected: Response (even if 401 due to password)
# If timeout: Server not reachable
# If connection refused: Server not running on that port
```

### Issue 5.2: Proxy password mismatch

**Symptom:** "401 Unauthorized" from proxy server.

**Root cause:** Proxy passwords don't match between ISC (client) and server.

**Solution:**

```
1. Check ISC config:
   Advanced Settings → Proxy Settings → Proxy password
   Value: <secret-1>

2. Check server environment:
   echo $PROXY_PASSWORD
   Value: <secret-2>

3. If different:
   Option A: Update ISC to match server
   Option B: Update server PROXY_PASSWORD to match ISC
   
4. Restart server (if changed env var)

5. Test connection
```

### Issue 5.3: Empty or invalid response from proxy

**Symptom:** Connection succeeds but no accounts returned; or "Failed to parse JSON" error.

**Possible causes:**

| Cause | Diagnostic | Solution |
|-------|-----------|----------|
| **Server returns wrong format** | Check server response | Return NDJSON or JSON array (see [Proxy mode](proxy-mode.md)) |
| **Server error** | Check server logs | Fix server-side error |
| **Empty result set** | Expected: Verify data exists | Check source data; server logic |

**Valid response formats:**

```json
// JSON array (valid)
[
  {"id":"1","name":"John"},
  {"id":"2","name":"Jane"}
]

// NDJSON (valid)
{"id":"1","name":"John"}
{"id":"2","name":"Jane"}

// Invalid: single object (should be array)
{"id":"1","name":"John"}

// Invalid: wrapped in "data"
{"data":[{"id":"1","name":"John"}]}
```

---

## Category 6: Performance issues

### Issue 6.1: Aggregation very slow

**Symptom:** Aggregation takes hours; significantly longer than expected.

**Possible causes:**

| Cause | Diagnostic | Solution |
|-------|-----------|----------|
| **Force aggregation enabled** | Check **Force aggregation before processing?** | Disable if not needed |
| **Low concurrency** | Check **Maximum concurrent requests** | Increase (e.g., 10 → 20) if no rate limit issues |
| **Low RPS** | Check **Requests per second** | Increase if ISC API can handle |
| **No batching** | Check **Enable batching?** | Enable with batch size 250–500 |
| **Large dataset** | Number of accounts | Expected; may need hours for 50k+ accounts |
| **Slow source API** | Test source API response time | Optimize source; cache data |

**Performance tuning steps:**

```
1. Establish baseline:
   - Record current aggregation time
   - Note: accounts, errors, retries

2. Enable queue optimizations:
   - Enable queue: Yes
   - Max concurrent: 15–20
   - RPS: 15–20 (within ISC limits)
   - Enable batching: Yes
   - Batch size: 250

3. Test:
   - Run aggregation
   - Compare time to baseline

4. Iterate:
   - If no improvement: Check for bottleneck (logs)
   - If HTTP 429: Lower RPS
   - If CPU bound: Optimize expressions
```

### Issue 6.2: High memory usage

**Symptom:** Server (proxy mode) or process runs out of memory.

**Possible causes:**

| Cause | Solution |
|-------|----------|
| **Large result sets in memory** | Stream results (NDJSON) instead of building full array |
| **Memory leak** | Profile code; fix leaks |
| **Insufficient memory** | Increase memory allocation (Docker, k8s, etc.) |

---

## Category 7: Logs and debugging

### Viewing logs

| Log source | Location | Purpose |
|------------|----------|---------|
| **ISC connector logs** | ISC → Admin → Dashboard → System → Application Logs; filter by connector | Connector operations, errors |
| **ISC aggregation history** | Source → Aggregation History | Aggregation status, timing, counts |
| **External logs** | Your log aggregator (if configured) | Detailed connector logs (Debug level) |

### Enabling external logging

**Purpose:** Centralized logs for troubleshooting with Debug level detail.

**Configuration:**

```
Advanced Settings → Developer Settings:
- Enable external logging?: Yes
- External logging URL: https://logs.example.com/fusion
- External logging level: Debug (for troubleshooting; Info for production)
```

**Screenshot placeholder:** External logging configuration.

![External logging - Configuration](../assets/images/troubleshooting-external-logging.png)
<!-- PLACEHOLDER: Screenshot of Developer Settings with external logging. Save as docs/assets/images/troubleshooting-external-logging.png -->

### Log levels

| Level | What you see | Use when |
|-------|-------------|----------|
| **Error** | Critical errors only | Production; minimal |
| **Warn** | Errors + warnings | Production; catch issues |
| **Info** | Errors + warnings + info messages | Production; standard monitoring |
| **Debug** | All logs including detailed debug info | **Troubleshooting** |

**⚠️ Note:** Debug level generates high log volume; use temporarily for troubleshooting.

---

## Category 8: Reset and recovery

### Issue 8.1: Stuck or inconsistent state

**Symptom:** Accounts stuck in "processing" state; aggregation fails with state errors.

**Solution:**

```
1. Enable reset processing flag:
   Source Settings → Processing Control
   → Reset processing flag: Yes

2. Save configuration

3. Run account aggregation
   (This clears stuck processing state)

4. Verify accounts updated

5. Disable reset flag:
   → Reset processing flag: No
   (Prevents clearing state on every run)

6. Save configuration
```

### Issue 8.2: Need to rebuild all accounts

**Symptom:** Major configuration changes; accounts have wrong data; need fresh start.

**⚠️ WARNING:** This deletes all Fusion account data. Use with caution.

**Solution:**

```
1. Backup:
   - Export current accounts (if needed)
   - Document current state

2. Enable reset:
   Advanced Settings → Developer Settings
   → Reset accounts?: Yes

3. Save configuration

4. Run FULL account aggregation
   (Rebuilds all accounts from scratch)
   (This may take hours for large datasets)

5. Verify accounts rebuilt correctly

6. IMMEDIATELY disable reset:
   → Reset accounts?: No

7. Save configuration
   (Critical: prevents accidental reset on next run)
```

**Alternative (safer):** Test with small batch first using **Aggregation batch size** before full reset.

---

## Category 9: Getting more help

### Documentation

| Resource | URL/location | Purpose |
|----------|-------------|---------|
| **Usage guides** | This docs folder | Detailed feature guides |
| **SailPoint ISC docs** | [https://documentation.sailpoint.com/saas/](https://documentation.sailpoint.com/saas/) | General ISC documentation |
| **SailPoint API docs** | [https://developer.sailpoint.com/docs/](https://developer.sailpoint.com/docs/) | API reference |
| **Connector docs** | README.md | Overview, quick start |

### Support channels

| Channel | When to use | Response time |
|---------|-------------|---------------|
| **SailPoint Support** | Production issues; bugs; outages | Per SLA (hours to days) |
| **SailPoint CoLab** | Community questions; best practices | Variable (community-driven) |
| **GitHub Issues** | Feature requests; bug reports (if open source) | Variable |

### Information to provide when asking for help

| Category | What to include |
|----------|----------------|
| **Problem description** | Clear symptom; what you expect vs what happens |
| **Configuration** | Source settings (sanitize secrets); attribute mappings; fusion settings |
| **Logs** | Relevant log excerpts (with timestamps); error messages |
| **Steps to reproduce** | 1, 2, 3 steps that cause the issue |
| **Environment** | ISC tenant ID; connector version; source versions |
| **Recent changes** | What changed before issue started? |
| **Troubleshooting attempted** | What you've already tried |

---

## Quick reference: Common issues

| Symptom | Likely cause | Quick fix | Guide section |
|---------|-------------|-----------|---------------|
| Test connection fails | Wrong PAT or URL | Check PAT, URL | [1.1](#issue-11-test-connection-fails) |
| 401 Unauthorized | PAT invalid | Regenerate PAT | [1.2](#issue-12-401-unauthorized-errors) |
| 403 Forbidden | PAT lacks permissions | Grant scopes | [1.3](#issue-13-403-forbidden-errors) |
| Aggregation hangs | Timeout too low | Increase timeout | [2.1](#issue-21-aggregation-hangs-or-times-out) |
| No accounts | Source name mismatch | Fix source names | [2.2](#issue-22-no-accounts-or-fewer-accounts-than-expected) |
| Accounts disabled | By design | Configure provisioning plan | [2.3](#issue-23-aggregation-succeeds-but-accounts-are-disabled) |
| Unique generation fails | Expression always same | Add variable parts | [3.1](#issue-31-unique-attribute-generation-fails-or-loops) |
| Wrong schema | Config not saved | Save, re-discover | [3.2](#issue-32-schema-discovery-shows-wrong-or-missing-attributes) |
| Velocity error | Null value | Add null checks | [3.3](#issue-33-velocity-expression-errors) |
| No duplicates found | Threshold too high | Lower thresholds | [4.1](#issue-41-no-potential-duplicates-found-expected-some) |
| Too many false positives | Threshold too low | Raise thresholds; add mandatory | [4.2](#issue-42-too-many-false-positives-wrong-matches) |
| No review emails | Access profile not assigned | Assign reviewer access | [4.3](#issue-43-reviewers-not-receiving-forms) |
| Proxy connection fails | Server not reachable | Check URL, firewall | [5.1](#issue-51-connection-to-proxy-fails) |
| Proxy 401 | Password mismatch | Match passwords | [5.2](#issue-52-proxy-password-mismatch) |
| Empty proxy response | Wrong response format | Return NDJSON or JSON array | [5.3](#issue-53-empty-or-invalid-response-from-proxy) |
| Slow aggregation | Low concurrency; no batching | Increase concurrency; enable batching | [6.1](#issue-61-aggregation-very-slow) |
| Stuck state | Processing flag not cleared | Enable reset processing flag once | [8.1](#issue-81-stuck-or-inconsistent-state) |

---

## Summary

**Troubleshooting mindset:**
1. Gather evidence before making changes
2. Test one change at a time
3. Document what you try
4. Verify fix end-to-end

**Common patterns:**
- **Connection issues:** Check PAT, URL, permissions, network
- **Aggregation issues:** Check source names, identity scope, timeouts
- **Attribute issues:** Check Velocity syntax, null checks, schema discovery
- **Deduplication issues:** Check thresholds, algorithms, identity baseline
- **Proxy issues:** Check URL, passwords, response format
- **Performance issues:** Check concurrency, batching, RPS, timeouts

**When stuck:**
- Enable Debug logging in external log endpoint
- Review logs for error messages and stack traces
- Test with small batch (Aggregation batch size)
- Ask for help with detailed information

**Next steps:**
- For specific feature guidance, see the other usage guides (attribute generation, deduplication, matching, attribute management, advanced settings, proxy mode).
- For ISC general troubleshooting, see [SailPoint documentation](https://documentation.sailpoint.com/saas/).
