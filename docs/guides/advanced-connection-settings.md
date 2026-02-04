# Effective Use of Advanced Connection Settings

Advanced Settings provide fine-grained control over API behavior, resilience, performance, and observability for the Identity Fusion NG connector. This comprehensive guide covers **Developer Settings**, **Advanced Connection Settings**, and how they integrate with base **Connection Settings** for optimal connector operation.

---

## Overview and structure

Advanced Settings are organized into three sections:

| Section | Purpose | When to configure |
|---------|---------|-------------------|
| **Developer Settings** | Reset accounts, external logging | Testing, troubleshooting, centralized monitoring |
| **Advanced Connection Settings** | API behavior: queue, retry, batching, timeouts, concurrency | Production tuning, rate limit management, performance optimization |
| **Proxy Settings** | Delegate processing to external server | Custom deployment requirements (see [Proxy mode](proxy-mode.md)) |

**Screenshot placeholder:** Advanced Settings menu interface.

![Advanced Settings menu - Overview](../assets/images/advanced-settings-menu.png)
<!-- PLACEHOLDER: Screenshot of Advanced Settings with Developer and Advanced Connection sections. Save as docs/assets/images/advanced-settings-menu.png -->

---

## Part 1: Developer Settings

Developer Settings provide tools for testing, troubleshooting, and monitoring.

### Configuration fields

| Field | Type | Purpose | Default | Risk level |
|-------|------|---------|---------|------------|
| **Reset accounts?** | Boolean | Force rebuild of all Fusion accounts from scratch | No | ⚠️ **HIGH** — Deletes all Fusion account data |
| **Enable external logging?** | Boolean | Send connector logs to external endpoint | No | Low |
| **External logging URL** | URL | Endpoint for external log aggregation | None | Low (if endpoint secured) |
| **External logging level** | Dropdown | Minimum log level to send | None | Low |

**Screenshot placeholder:** Developer Settings interface.

![Developer Settings - Configuration](../assets/images/advanced-settings-developer.png)
<!-- PLACEHOLDER: Screenshot of Developer Settings. Save as docs/assets/images/advanced-settings-developer.png -->

### Reset accounts

**Purpose:** Force complete rebuild of Fusion account data.

**What it does:**
- Deletes all existing Fusion account state (attributes, history, processing flags)
- Next aggregation rebuilds accounts from scratch using current configuration
- Does NOT delete source accounts or identities

**When to use:**

| Scenario | Use Reset? | Alternative |
|----------|-----------|-------------|
| Testing major config changes | Yes (once) | Test with small batch first |
| Schema changes (attribute mapping/definition) | Maybe | Discover Schema usually sufficient |
| Stuck processing state | No | Use "Reset processing flag" in Source Settings |
| Production environment | ⚠️ **Rarely** | High impact; requires careful planning |

**Workflow:**

```
1. Enable "Reset accounts?" = Yes
2. Save configuration
3. Run account aggregation (rebuilds all accounts)
4. Verify accounts rebuilt correctly
5. IMMEDIATELY disable "Reset accounts?" = No
6. Save configuration
→ Prevents accidental reset on next run
```

**⚠️ Warnings:**
- **Data loss:** All Fusion account history, processing state, and custom attributes are deleted
- **Performance:** Full rebuild can take hours for large datasets (10k+ accounts)
- **Identity impact:** If Fusion is authoritative, identities may be temporarily impacted
- **Coordination:** Notify stakeholders before resetting in production

### External logging

**Purpose:** Send connector logs to external logging service for centralized monitoring, analysis, and alerting.

**Configuration:**

| Field | Value | Notes |
|-------|-------|-------|
| **Enable external logging?** | Yes | Activates external logging |
| **External logging URL** | `https://logs.example.com/fusion` | Your log aggregation endpoint (e.g., Splunk HEC, Datadog, ELK) |
| **External logging level** | Info | Error, Warn, Info, or Debug |

**Log levels:**

| Level | What gets logged | Use when |
|-------|-----------------|----------|
| **Error** | Critical errors only | Production; minimal logging |
| **Warn** | Errors + warnings | Production; monitor issues |
| **Info** | Errors + warnings + informational messages | Production; standard monitoring |
| **Debug** | All logs including debug details | Troubleshooting; verbose |

**Use cases:**

| Use case | Configuration | Benefit |
|----------|---------------|---------|
| **Production monitoring** | Enable, Info level | Track aggregation runs, errors, performance |
| **Troubleshooting** | Enable, Debug level | Detailed logs for issue diagnosis |
| **Compliance/audit** | Enable, Info level | Centralized audit trail |
| **Performance analysis** | Enable, Info level | Track timing, throughput, bottlenecks |

**External logging endpoint requirements:**
- Accepts HTTP POST with JSON body
- Handles log volume (can be high with Debug level)
- Secured with HTTPS and authentication (recommended)

**Log payload contract:** Each log entry is a JSON object. Implementations should accept at least these fields (and may receive additional fields in the future):

| Field       | Type   | Required | Description                          |
|------------|--------|----------|--------------------------------------|
| `level`    | string | Yes      | One of: `error`, `warn`, `info`, `debug` |
| `timestamp`| string | Yes      | ISO 8601 date-time (e.g. `2024-01-15T14:30:45.123Z`) |
| `message`  | string | Yes      | Log message text                     |
| `context`  | object | No       | Additional key-value context (e.g. `sourceId`, `accountCount`) |

**Example log structure:**

```json
{
  "level": "info",
  "timestamp": "2024-01-15T14:30:45.123Z",
  "message": "Account aggregation started",
  "context": {
    "sourceId": "fusion-source-123",
    "accountCount": 5420
  }
}
```

---

## Part 2: Advanced Connection Settings

Advanced Connection Settings control API behavior, resilience, and performance.

### Configuration overview

| Category | Fields | Purpose |
|----------|--------|---------|
| **Provisioning & timing** | Provisioning timeout, Processing wait time | Max wait times for operations |
| **Queue** | Enable queue, Max concurrent requests, Requests per second | Rate limiting and concurrency control |
| **Retry** | Enable retry, API request retries, Retry delay | Automatic retry for failed requests |
| **Batching** | Enable batching, Batch size | Group requests for efficiency |
| **Priority** | Enable priority processing | Prioritize important requests |

**Screenshot placeholder:** Advanced Connection Settings interface.

![Advanced Connection Settings - Configuration](../assets/images/advanced-settings-connection.png)
<!-- PLACEHOLDER: Screenshot of Advanced Connection Settings. Save as docs/assets/images/advanced-settings-connection.png -->

### Provisioning and timing

| Field | Default | Range | Purpose |
|-------|---------|-------|---------|
| **Provisioning timeout (seconds)** | 300 | 60–3600 | Max wait for provisioning operations (enable/disable, create/update) |
| **Processing wait time (seconds)** | 60 | 0–600 | Reserved for future scheduling features; currently a constant |

**Provisioning timeout tuning:**

| Account volume | Recommended timeout | Rationale |
|---------------|-------------------|-----------|
| <1,000 accounts | 300 (default) | Standard operations complete quickly |
| 1,000–10,000 | 600 (10 min) | Bulk operations take longer |
| 10,000+ | 1200–3600 (20–60 min) | Very large batches need extended timeout |
| Slow ISC API | +50% increase | Adjust for tenant-specific performance |

**Symptoms of timeout too low:**
- Provisioning operations fail with timeout errors
- Accounts stuck in processing state
- Intermittent aggregation failures

### Queue (rate limiting and concurrency)

**Enable queue?** = Yes activates queue management with rate limiting and concurrency control.

| Field | Default | Range | Purpose |
|-------|---------|-------|---------|
| **Enable queue?** | Yes | Boolean | Activates queue system |
| **Maximum concurrent requests** | 10 | 1–50 | Max simultaneous API calls |
| **Requests per second** | 10 | 1–100 | Rate limit (throttle) |

**When to enable queue:**

| Scenario | Enable? | Configuration |
|----------|---------|---------------|
| Production (>500 accounts) | Yes | Max concurrent: 10; RPS: 10 |
| Large dataset (>5,000 accounts) | Yes | Max concurrent: 20; RPS: 20 |
| ISC API rate limits | Yes | RPS ≤ ISC limit; enable retry |
| HTTP 429 errors | Yes | Lower RPS; enable retry |
| Testing/development | Optional | Default settings usually fine |

**Tuning guidelines:**

| Metric | Initial value | Adjust if... |
|--------|--------------|--------------|
| **Max concurrent requests** | 10 | HTTP 429 errors → decrease to 5–8; slow aggregation and no errors → increase to 15–20 |
| **Requests per second** | 10 | HTTP 429 errors → decrease to 5–8; ISC tenant has higher limit → increase to match |

**Interaction with Connection Settings:**

The **Requests per second** field also appears in **Connection Settings**. They control the same setting:
- Set in either location (Connection Settings or Advanced Settings)
- Advanced Settings is the "main" location for queue configuration
- Connection Settings provides quick access for common tuning

**Queue behavior:**

```
Queue enabled:
1. API request added to queue
2. Queue checks: 
   - Current concurrent requests < max? 
   - Request rate < RPS limit?
3. If yes → execute request
4. If no → wait and retry
5. Repeat until executed or timeout
```

### Retry

**Enable retry?** = Yes activates automatic retry logic for failed API requests.

| Field | Default | Range | Purpose |
|-------|---------|-------|---------|
| **Enable retry?** | Yes (recommended) | Boolean | Activates retry logic |
| **API request retries** | 20 | 1–50 | Max retry attempts per request |
| **Retry delay (milliseconds)** | 1000 | 100–10000 | Base delay between retries |

**When to enable retry:**

| Scenario | Enable? | Configuration |
|----------|---------|---------------|
| Production | **Yes** | Retries: 20; Delay: 1000 |
| Transient network issues | **Yes** | Handles temporary failures |
| ISC API rate limits (429) | **Yes** | Automatic backoff; uses Retry-After header |
| Testing/development | Optional | Helps during setup |

**Retry behavior:**

```
Standard retry:
1. Request fails (network error, 5xx, etc.)
2. Wait: Retry delay (base)
3. Retry #1
4. If fails: wait (retry delay)
5. Retry #2
6. ...continue up to max retries

HTTP 429 retry (rate limit):
1. Request fails with HTTP 429
2. Check Retry-After header
3. Wait: max(Retry-After, retry delay)
4. Retry
5. Continue up to max retries
```

**Tuning guidelines:**

| Symptom | Adjustment |
|---------|------------|
| Transient failures | Enable retry; 10–20 retries |
| Frequent HTTP 429 | Enable retry; 20+ retries; lower RPS |
| Long-duration failures | Increase retry delay (2000–5000ms) |
| Quick failures (auth, etc.) | Lower retry count (5–10) |

**⚠️ Note:** Retry delay is the **base** delay. For HTTP 429, the connector uses the `Retry-After` header from the API response, which may be longer.

### Batching

**Enable batching?** = Yes groups requests for better throughput.

| Field | Default | Range | Purpose |
|-------|---------|-------|---------|
| **Enable batching?** | No | Boolean | Activates batching |
| **Batch size** | 250 | 10–1000 | Requests per batch |

**When to enable batching:**

| Scenario | Enable? | Batch size |
|----------|---------|------------|
| Large datasets (>5,000 accounts) | Yes | 250–500 |
| Many small API calls | Yes | 100–250 |
| Bulk operations | Yes | 500–1000 |
| Low latency priority | No | N/A |

**Batching behavior:**

```
Batching enabled:
1. Accumulate requests in queue
2. When batch size reached OR timeout:
   - Process batch (up to max concurrent)
3. Move to next batch

Batching disabled:
- Process requests individually as they arrive
```

**Trade-offs:**

| Batching | Pros | Cons |
|----------|------|------|
| **Enabled** | Higher throughput; better for bulk operations | Slightly higher latency per request |
| **Disabled** | Lower latency per request | Lower overall throughput |

### Priority processing

**Enable priority processing?** = Yes prioritizes important requests in queue.

| Field | Default | Purpose |
|-------|---------|---------|
| **Enable priority processing?** | Yes (when queue enabled) | Prioritize critical operations |

**How priority works:**

```
Priority levels (internal):
- High: Critical operations (e.g., account enable/disable)
- Medium: Standard operations (e.g., account update)
- Low: Background operations (e.g., history updates)

Priority enabled:
1. Queue sorts by priority
2. High priority requests processed first
3. Within same priority: FIFO (first in, first out)

Priority disabled:
- All requests FIFO regardless of importance
```

**When to disable:**

| Scenario | Recommendation |
|----------|----------------|
| Standard operation | Keep enabled (default) |
| All operations equal priority | Disable |
| FIFO strictly required | Disable |

---

## Part 3: Configuration patterns

### Pattern 1: Production with many accounts (recommended)

**Scenario:** 5,000–50,000 accounts; normal ISC API performance.

```
Developer Settings:
- Reset accounts: No
- External logging: Yes
- External logging URL: [your log aggregator]
- External logging level: Info

Advanced Connection Settings:
- Provisioning timeout: 600 seconds
- Enable queue: Yes
- Max concurrent requests: 15
- Enable retry: Yes
- API request retries: 20
- Requests per second: 15
- Retry delay: 1000ms
- Enable batching: Yes
- Batch size: 250
- Enable priority: Yes
```

**Rationale:**
- Queue + retry handle rate limits and transient failures
- Batching improves throughput
- External logging provides visibility
- Moderate concurrency balances speed and API load

### Pattern 2: Large scale (50,000+ accounts)

**Scenario:** Very large dataset; need maximum throughput.

```
Advanced Connection Settings:
- Provisioning timeout: 1800 seconds (30 min)
- Enable queue: Yes
- Max concurrent requests: 25
- Enable retry: Yes
- API request retries: 30
- Requests per second: 25
- Retry delay: 2000ms
- Enable batching: Yes
- Batch size: 500
- Enable priority: Yes
```

**Rationale:**
- Extended timeout for bulk operations
- Higher concurrency and RPS (ensure ISC can handle)
- Larger batches for throughput
- More retries for resilience

### Pattern 3: Rate limit sensitive

**Scenario:** ISC tenant has strict rate limits; frequent HTTP 429 errors.

```
Advanced Connection Settings:
- Enable queue: Yes
- Max concurrent requests: 5
- Enable retry: Yes
- API request retries: 30
- Requests per second: 5
- Retry delay: 3000ms
- Enable batching: No (or small batch: 50)
- Enable priority: Yes
```

**Rationale:**
- Low concurrency and RPS respect rate limits
- Many retries with longer delay
- Priority ensures critical operations complete first

### Pattern 4: Development/testing

**Scenario:** Small dataset; testing configuration changes.

```
Developer Settings:
- Reset accounts: Yes (once, then disable)
- External logging: Yes (Debug level)
- External logging URL: [dev log endpoint]

Advanced Connection Settings:
- Provisioning timeout: 300
- Enable queue: No (or Yes with defaults)
- Enable retry: Yes
- API request retries: 10
- Retry delay: 1000ms
- Enable batching: No
```

**Rationale:**
- Reset accounts for clean slate
- Debug logging for troubleshooting
- Simpler settings (no queue/batching) for easier debugging

### Pattern 5: Troubleshooting performance

**Scenario:** Aggregation is slow; need to diagnose bottleneck.

```
Developer Settings:
- External logging: Yes
- External logging level: Debug

Advanced Connection Settings:
- (Start with defaults)
- Monitor logs for:
  - API call timings
  - Queue wait times
  - Retry attempts
- Adjust based on findings
```

---

## Monitoring and optimization

### Key metrics

| Metric | How to track | Target |
|--------|--------------|--------|
| **Aggregation duration** | ISC aggregation history | <1 hour for <5k accounts; scale proportionally |
| **API errors (rate limit)** | External logs; ISC logs | 0 HTTP 429 errors |
| **API errors (other)** | External logs; ISC logs | <1% error rate |
| **Retry rate** | External logs (Debug level) | <5% of requests retried |
| **Queue wait time** | External logs (Debug level) | <10% of total request time |

### Optimization workflow

| Step | Action | Goal |
|------|--------|------|
| 1. Baseline | Run aggregation with default settings; record metrics | Establish baseline |
| 2. Identify bottleneck | Check: HTTP 429? Slow API? High queue wait? | Find constraint |
| 3. Adjust | Lower RPS if 429; increase concurrency if slow; add batching if many small calls | Relieve bottleneck |
| 4. Test | Run aggregation with new settings; compare metrics | Measure improvement |
| 5. Iterate | Repeat steps 2–4 until satisfactory | Optimize |

---

## Troubleshooting

| Issue | Possible cause | Solution |
|-------|----------------|----------|
| **HTTP 429 (rate limit)** | RPS too high | Lower RPS; ensure retry enabled |
| **Aggregation timeout** | Provisioning timeout too low; slow API | Increase timeout; check ISC performance |
| **Slow aggregation** | Low concurrency; no batching | Increase max concurrent requests; enable batching |
| **Accounts stuck processing** | Timeout; unfinished run | Increase timeout; enable "Reset processing flag" |
| **External logs not appearing** | Wrong URL; endpoint down | Verify URL; check endpoint availability |
| **Reset not working** | Didn't disable after reset | Reset works once; must disable to prevent repeat |

---

## Integration with Connection Settings

Some settings appear in both **Connection Settings** and **Advanced Settings**:

| Setting | Connection Settings | Advanced Settings | Recommendation |
|---------|-------------------|------------------|----------------|
| **API request retries** | ✓ | ✓ (field: API request retries) | Use Advanced Settings for full control |
| **Requests per second** | ✓ | ✓ (field: Requests per second) | Either; they control same setting |

**Why duplicated?**
- **Connection Settings:** Quick access for common tuning
- **Advanced Settings:** Comprehensive configuration with all related fields

---

## Summary

| Setting category | Key fields | Use for |
|-----------------|------------|---------|
| **Developer Settings** | Reset accounts, External logging | Testing, troubleshooting, monitoring |
| **Provisioning & timing** | Provisioning timeout, Processing wait | Operation timeouts |
| **Queue** | Enable queue, Max concurrent, RPS | Rate limiting, concurrency control |
| **Retry** | Enable retry, Retries, Delay | Resilience, handling transient failures |
| **Batching** | Enable batching, Batch size | Throughput optimization |
| **Priority** | Enable priority processing | Critical operation prioritization |

**Best practices:**
1. **Production:** Enable queue, retry, batching; configure external logging
2. **Rate limits:** Lower RPS and concurrency; enable retry with longer delay
3. **Performance:** Increase concurrency and batch size (within rate limits)
4. **Testing:** Use Debug logging; enable reset once then disable
5. **Monitoring:** Track metrics; adjust based on observed behavior

**Next steps:**
- For proxy mode (delegating to external server), see [Configuring proxy mode](proxy-mode.md).
- For connection and configuration issues, see [Troubleshooting](troubleshooting.md).
