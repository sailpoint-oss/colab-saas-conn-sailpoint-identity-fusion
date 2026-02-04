# Configuring Proxy Mode

Proxy mode allows the Identity Fusion NG connector to **delegate all processing** to an external endpoint. The connector running in ISC (client) forwards commands and configuration to your external service (proxy server), which executes the real logic and returns results. This comprehensive guide covers setup, security, troubleshooting, and best practices for proxy mode.

---

## Overview and architecture

### What is proxy mode?

**Proxy mode** is a deployment pattern where:
- **Client (ISC):** Lightweight connector that forwards requests
- **Server (your infrastructure):** Full connector implementation that processes requests

| Component | Role | Location | Responsibilities |
|-----------|------|----------|------------------|
| **Proxy client** | Request forwarder | ISC SaaS Connector | Receives commands from ISC; sends to proxy server; streams back results |
| **Proxy server** | Request processor | Your infrastructure | Implements connector logic; processes accounts; returns results |

**Diagram placeholder:** Proxy mode architecture.

![Proxy mode flow - Architecture](../assets/images/proxy-mode-flow.png)
<!-- PLACEHOLDER: Diagram: ISC connector (client) → Proxy URL → Your server. Save as docs/assets/images/proxy-mode-flow.png -->

### When to use proxy mode

| Use case | Why proxy mode? | Example |
|----------|----------------|---------|
| **Network restrictions** | ISC cannot directly reach your sources; server can | ISC blocked by firewall; server has VPN access |
| **On-premises data** | Sources only accessible from internal network | Active Directory, on-prem databases |
| **Custom logic** | Need custom processing not available in standard connector | Industry-specific data transformations, external API calls |
| **Data sovereignty** | Data must not leave your infrastructure | Regulatory requirements (GDPR, HIPAA, etc.) |
| **Performance optimization** | Reduce ISC API calls; process locally | Large datasets; complex transformations |
| **Development/testing** | Test connector changes locally | Develop without deploying to ISC |

### When NOT to use proxy mode

| Scenario | Better approach | Rationale |
|----------|----------------|-----------|
| Standard ISC deployment | Direct connection | Simpler; no additional infrastructure |
| ISC can reach sources | Standard connector | Less complexity |
| No special requirements | Direct mode | Easier to manage and troubleshoot |

---

## How proxy mode works

### Request flow

```
1. ISC triggers operation (e.g., account aggregation)
   ↓
2. Proxy client (ISC) receives command
   ↓
3. Client POSTs to Proxy URL (the connector **automatically sets** `proxyEnabled: false` in the config when forwarding to prevent the server from re-forwarding):
   {
     "type": "std:account:list",
     "input": { ... },
     "config": { ...connector config, proxyEnabled: false... }
   }
   ↓
4. Proxy server receives request
   ↓
5. Server validates proxy password
   ↓
6. Server executes connector logic
   ↓
7. Server returns results (NDJSON or JSON array)
   ↓
8. Client streams results back to ISC
   ↓
9. ISC processes results (creates/updates accounts, etc.)
```

### Request payload

The client sends a JSON body to the proxy server:

```json
{
  "type": "<commandType>",
  "input": {
    // Command-specific input
  },
  "config": {
    // Full connector configuration
    // with proxyEnabled: false to prevent loop
  }
}
```

**Command types:**

| Command | Value | Purpose |
|---------|-------|---------|
| Test connection | `std:test-connection` | Verify connectivity |
| Account list | `std:account:list` | Aggregate accounts |
| Account read | `std:account:read` | Read single account |
| Account enable | `std:account:enable` | Enable account |
| Account disable | `std:account:disable` | Disable account |
| Account create | `std:account:create` | Create account |
| Account update | `std:account:update` | Update account |
| Discover schema | `std:account:discover-schema` | Get account schema |
| Entitlement list | `std:entitlement:list` | Aggregate entitlements |

### Response format

The proxy server must return results in one of these formats:

| Format | Structure | Use when |
|--------|-----------|----------|
| **NDJSON** (Newline-delimited JSON) | One JSON object per line, separated by `\n` | Streaming large result sets |
| **JSON array** | `[{...}, {...}, ...]` | Small result sets; easier debugging |

**NDJSON example:**

```
{"id":"account1","name":"John Smith"}
{"id":"account2","name":"Jane Doe"}
{"id":"account3","name":"Bob Johnson"}
```

**JSON array example:**

```json
[
  {"id":"account1","name":"John Smith"},
  {"id":"account2","name":"Jane Doe"},
  {"id":"account3","name":"Bob Johnson"}
]
```

---

## Client configuration (ISC side)

### Enabling proxy mode

In the Identity Fusion NG connector source in ISC:

1. Go to **Advanced Settings → Proxy Settings**
2. Configure:

| Field | Value | Notes |
|-------|-------|-------|
| **Enable proxy mode?** | Yes | Activates proxy mode |
| **Proxy URL** | `https://your-server.example.com/fusion` | Full URL to your proxy endpoint |
| **Proxy password** | `<strong-secret>` | Shared secret for authentication |

**Screenshot placeholder:** Proxy Settings in ISC.

![Proxy Settings - ISC configuration](../assets/images/proxy-mode-settings.png)
<!-- PLACEHOLDER: Screenshot of Advanced Settings > Proxy Settings. Save as docs/assets/images/proxy-mode-settings.png -->

### Proxy URL requirements

| Requirement | Details |
|-------------|---------|
| **Protocol** | HTTPS (recommended); HTTP (dev/testing only) |
| **Reachability** | Must be accessible from ISC's network (public internet or whitelisted) |
| **HTTP method** | POST |
| **Content-Type** | `application/json` |
| **Response** | NDJSON or JSON array |

**Example URLs:**

```
Production: https://fusion-proxy.company.com/connector
Development: https://dev-fusion.company.com:8443/fusion
Local testing: http://localhost:3000/fusion (not reachable from ISC)
```

### Proxy password

**Purpose:** Shared secret for authenticating requests between client (ISC) and server (your infrastructure).

**Requirements:**
- Strong secret (min 16 characters recommended)
- Alphanumeric + special characters
- Store securely; rotate periodically

**Setting password:**

| Location | Field/variable | Value |
|----------|---------------|-------|
| **ISC (client)** | Proxy password field | `<your-secret>` |
| **Proxy server** | `PROXY_PASSWORD` environment variable | `<same-secret>` |

⚠️ **Security:** Passwords must match exactly between client and server.

---

## Server configuration (your infrastructure)

### Server setup overview

The proxy server is the Identity Fusion NG connector run in "server mode."

### Prerequisites

| Requirement | Details |
|-------------|---------|
| **Connector code** | Same Identity Fusion NG connector codebase | Download/deploy the connector package |
| **Runtime environment** | Node.js (version specified in connector docs) | Typically Node.js 18+ |
| **Environment variable** | `PROXY_PASSWORD` set to same value as ISC | Required for server mode detection |
| **HTTP server** | Endpoint accepting POST requests | Express, Fastify, or similar |
| **Network access** | Access to ISC APIs and configured sources | VPN, firewall rules as needed |

### Server mode detection

The connector code detects server mode when:

```
proxyEnabled = true (in config)
AND
PROXY_PASSWORD environment variable is set
```

**Code logic:**

```typescript
// Simplified detection logic
const isProxyServer = 
  config.proxyEnabled === true && 
  process.env.PROXY_PASSWORD !== undefined;

if (isProxyServer) {
  // Run as server: implement HTTP endpoint
} else if (config.proxyEnabled && config.proxyUrl) {
  // Run as client: forward to proxy URL
} else {
  // Run normally: direct processing
}
```

### Implementing the proxy server

**Basic server structure:**

```javascript
// Example using Express
const express = require('express');
const { executeConnectorCommand } = require('./connector'); // Your connector logic

const app = express();
app.use(express.json());

// Proxy endpoint
app.post('/fusion', async (req, res) => {
  try {
    // 1. Validate proxy password
    const serverPassword = process.env.PROXY_PASSWORD;
    const clientPassword = req.body.config?.proxyPassword;
    
    if (serverPassword !== clientPassword) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 2. Extract command details
    const { type, input, config } = req.body;
    
    // 3. Disable proxy in config to prevent loop
    config.proxyEnabled = false;
    
    // 4. Execute connector command
    const results = await executeConnectorCommand(type, input, config);
    
    // 5. Return results (NDJSON or JSON array)
    if (Array.isArray(results)) {
      res.json(results); // JSON array
    } else {
      // Stream NDJSON
      for (const result of results) {
        res.write(JSON.stringify(result) + '\n');
      }
      res.end();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});
```

### Server deployment options

| Option | Pros | Cons | Use when |
|--------|------|------|----------|
| **Docker container** | Portable; easy scaling | Requires container orchestration | Production; cloud deployment |
| **Virtual machine** | Familiar; flexible | Manual management | On-premises; traditional infrastructure |
| **Kubernetes** | Auto-scaling; resilience | Complexity | Large scale; cloud-native |
| **Serverless (Lambda, Cloud Functions)** | No server management; auto-scale | Cold start latency; timeout limits | Low to moderate traffic |

**Example Dockerfile:**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV PROXY_PASSWORD=""
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Security and authentication

### Connection security

| Security measure | Implementation | Priority |
|-----------------|----------------|----------|
| **HTTPS** | Use TLS certificate on proxy server | ⚠️ **CRITICAL** for production |
| **Proxy password** | Strong secret; rotate regularly | ⚠️ **CRITICAL** |
| **Network restrictions** | Firewall; IP whitelist | **HIGH** |
| **Request validation** | Validate payload structure | **MEDIUM** |
| **Rate limiting** | Limit requests per IP/client | **MEDIUM** |

### HTTPS setup

**Why HTTPS?**
- Encrypts traffic between ISC and your server
- Prevents eavesdropping (proxy password, account data)
- Required for production

**Options:**

| Option | Setup | Cost |
|--------|-------|------|
| **Let's Encrypt** | Free automated certificates | Free |
| **Cloud provider** | AWS Certificate Manager, Azure Key Vault, etc. | Usually free |
| **Commercial CA** | Buy certificate from CA | Paid |
| **Internal CA** | Enterprise PKI | Managed by IT |

### Authentication flow

```
1. Client sends request with proxy password in config
   POST /fusion
   Body: { "config": { "proxyPassword": "secret123" } }
   
2. Server reads PROXY_PASSWORD from environment
   
3. Server compares:
   if (clientPassword === serverPassword) {
     // OK: process request
   } else {
     // Unauthorized: return 401
   }
```

### Additional security considerations

| Consideration | Recommendation |
|--------------|----------------|
| **Password rotation** | Change proxy password quarterly; update in ISC and server |
| **Logging** | Log authentication failures; monitor for brute force |
| **Request size limits** | Limit payload size (e.g., 10MB) to prevent DoS |
| **Timeout** | Set request timeout (e.g., 5 minutes) to prevent hanging |
| **Monitoring** | Alert on unusual traffic patterns, error rates |

---

## Testing and validation

### Testing workflow

| Phase | Action | Goal |
|-------|--------|------|
| **1. Local testing** | Run server locally; test with curl or Postman | Verify server logic |
| **2. Network testing** | Deploy to accessible endpoint; test from external network | Verify reachability |
| **3. ISC integration** | Configure ISC connector; test connection | Verify client-server integration |
| **4. Functional testing** | Run aggregation, schema discovery, etc. | Verify all operations |
| **5. Performance testing** | Aggregate large dataset; monitor performance | Verify scalability |

### Local testing

**Start server:**

```bash
export PROXY_PASSWORD="test-secret"
export PORT=3000
node server.js
```

**Test with curl:**

```bash
curl -X POST http://localhost:3000/fusion \
  -H "Content-Type: application/json" \
  -d '{
    "type": "std:test-connection",
    "input": {},
    "config": {
      "proxyPassword": "test-secret",
      "proxyEnabled": false,
      "baseurl": "https://tenant.api.identitynow.com",
      "clientId": "...",
      "clientSecret": "..."
    }
  }'
```

**Expected response:**

```json
{"status":"success"}
```

### ISC integration testing

**Steps:**

1. Deploy server to accessible endpoint (e.g., `https://fusion-proxy.company.com/fusion`)
2. In ISC connector:
   - Enable proxy mode: Yes
   - Proxy URL: `https://fusion-proxy.company.com/fusion`
   - Proxy password: `<your-secret>`
3. Test connection: **Review and Test → Test Connection**
4. Expected: "Connection successful"
5. Run account aggregation: **Account Aggregation → Start Aggregation**
6. Check: Accounts appear in ISC

---

## Troubleshooting

### Common issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Connection refused** | "Failed to connect to proxy server" | Verify Proxy URL is correct and reachable from ISC; check firewall |
| **Timeout** | Request hangs; eventually times out | Increase timeout on server; check server processing time |
| **401 Unauthorized** | "Unauthorized" error | Verify proxy passwords match exactly (case-sensitive) |
| **Empty response** | No accounts returned; no error | Check server response format (NDJSON or JSON array); verify server logic |
| **Invalid JSON** | "Failed to parse JSON" | Validate server response format; check for syntax errors |
| **SSL/TLS error** | "SSL handshake failed" | Verify HTTPS certificate is valid; check certificate chain |
| **Server error (500)** | "Internal server error" | Check server logs; debug server-side logic |

### Debug checklist

| Check | How to verify | Expected result |
|-------|--------------|-----------------|
| **Server running?** | `curl http://server:port/fusion` (or health endpoint) | Response (even if error) |
| **Proxy URL correct?** | Compare ISC config to actual server URL | Exact match |
| **Passwords match?** | Check ISC field and server `PROXY_PASSWORD` env var | Identical |
| **HTTPS cert valid?** | `openssl s_client -connect server:443` | Valid certificate; no errors |
| **Firewall allows traffic?** | Test from ISC network (if possible) or similar environment | Connection succeeds |
| **Server logs?** | Check server logs for errors, warnings | See incoming requests and processing |

### Debugging tools

| Tool | Purpose | Command/usage |
|------|---------|---------------|
| **curl** | Test HTTP requests | `curl -X POST <url> -d '{...}'` |
| **Postman** | Interactive API testing | GUI; import request; send |
| **openssl** | Test SSL/TLS | `openssl s_client -connect server:443` |
| **tcpdump** | Network packet capture | `tcpdump -i any port 443` |
| **Server logs** | Application logs | `tail -f /var/log/fusion-proxy.log` |

### Performance troubleshooting

| Symptom | Possible cause | Solution |
|---------|----------------|----------|
| **Slow aggregation** | Server processing slow; network latency | Optimize server logic; move server closer to sources |
| **High memory usage** | Large payloads; memory leaks | Stream results (NDJSON); fix memory leaks |
| **Timeouts** | Long-running operations | Increase timeout in ISC and server |
| **CPU spikes** | Inefficient processing | Profile code; optimize hot paths |

---

## Best practices

### Deployment

| Practice | Rationale |
|----------|-----------|
| **Use HTTPS in production** | Security; required for sensitive data |
| **Containerize (Docker)** | Portability; consistent environments |
| **Use orchestration (k8s)** | Scaling; resilience; health checks |
| **Health check endpoint** | Monitoring; load balancer health checks |
| **Logging** | Troubleshooting; audit trail |
| **Monitoring** | Alerts; performance tracking |

### Security

| Practice | Rationale |
|----------|-----------|
| **Strong proxy password** | Prevent unauthorized access |
| **Rotate passwords** | Limit exposure from compromised secrets |
| **Restrict network access** | IP whitelist; VPN; private network |
| **Use secrets manager** | Secure storage (AWS Secrets Manager, Azure Key Vault, etc.) |
| **Audit logs** | Compliance; security monitoring |

### Operations

| Practice | Rationale |
|----------|-----------|
| **Automate deployment** | CI/CD; reduce human error |
| **Version server code** | Track changes; rollback if needed |
| **Test before production** | Catch issues early |
| **Monitor metrics** | Request rate, error rate, latency, CPU, memory |
| **Set up alerts** | Proactive issue detection |

---

## Example configurations

### Basic production setup

```yaml
# Docker Compose example
version: '3.8'
services:
  fusion-proxy:
    image: fusion-proxy:latest
    environment:
      - PROXY_PASSWORD=${PROXY_PASSWORD}
      - PORT=3000
    ports:
      - "443:3000"
    volumes:
      - ./ssl:/ssl:ro  # SSL certificates
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Kubernetes deployment

```yaml
# Simplified k8s deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fusion-proxy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: fusion-proxy
  template:
    metadata:
      labels:
        app: fusion-proxy
    spec:
      containers:
      - name: fusion-proxy
        image: fusion-proxy:latest
        ports:
        - containerPort: 3000
        env:
        - name: PROXY_PASSWORD
          valueFrom:
            secretKeyRef:
              name: fusion-secrets
              key: proxy-password
        - name: PORT
          value: "3000"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: fusion-proxy-service
spec:
  type: LoadBalancer
  selector:
    app: fusion-proxy
  ports:
  - port: 443
    targetPort: 3000
```

---

## Summary

| Aspect | Key points |
|--------|------------|
| **Purpose** | Delegate processing to your infrastructure for network, security, or custom logic requirements |
| **Architecture** | Client (ISC) forwards requests → Server (your infrastructure) processes → Returns results |
| **Client config** | Enable proxy mode; set Proxy URL and password in ISC |
| **Server config** | Set `PROXY_PASSWORD` env var; implement HTTP POST endpoint; return NDJSON or JSON array |
| **Security** | HTTPS (required for production); strong proxy password; network restrictions |
| **Testing** | Local testing → network testing → ISC integration → functional → performance |
| **Troubleshooting** | Check URL, password, firewall, HTTPS cert; review server logs |

**When to use proxy mode:**
- Network restrictions (ISC cannot reach sources directly)
- On-premises sources (require VPN or internal network access)
- Custom logic requirements
- Data sovereignty compliance

**Next steps:**
- For general troubleshooting, see [Troubleshooting](troubleshooting.md).
- For connection settings and resilience, see [Advanced connection settings](advanced-connection-settings.md).
