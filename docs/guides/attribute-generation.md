# Identity Fusion for Attribute Generation

This comprehensive guide explains how to use Identity Fusion NG to **generate or combine attributes** for your identities. In this use case, the Identity Fusion source is **rarely configured as authoritative**—Fusion acts as an additional source that provides unique IDs, calculated attributes, or consolidated attributes. Adding managed account sources is optional and depends on your attribute management requirements. You can use identities only, sources only, or both.

---

## When to use this use case

Use Identity Fusion for attribute generation when you need:

| Need | Description | Example |
|------|-------------|---------|
| **Unique identifiers** | Template-based IDs with disambiguation counters or immutable UUIDs | Usernames like `jsmith`, `jsmith1`, `jsmith2`; stable employee IDs |
| **Computed attributes** | Dynamic attributes from Apache Velocity expressions | Full name from first+last, formatted dates, address parsing |
| **Multi-source consolidation** | Combine attributes from multiple sources into single attributes | Merge job titles from HR and AD; collect all roles from multiple systems |
| **Attribute normalization** | Standardize formats (dates, phones, addresses, names) | Convert various date formats to ISO; standardize phone numbers |
| **Counter-based sequences** | Sequential numbering for accounts or identities | Employee numbers starting from 1000, badge IDs |

**Key advantage:** You are **not** primarily focused on duplicate detection—you want a single place to define, compute, and standardize attributes.

**Authoritative vs non-authoritative:** When Fusion is used only for attribute generation, it is rarely marked **Authoritative** in ISC. In that mode, Fusion does not own the identity list; it contributes account attributes (unique IDs, computed or merged values) to identities that may be owned by other sources. When you need **deduplication**, Fusion should be authoritative so it can determine which incoming accounts create new identities and which correlate to existing ones—see [Identity Fusion for deduplication](deduplication.md).

---

## Configuration strategy decision matrix

Choose your configuration approach based on your data sources and goals:

| Your goal | Include identities? | Add sources? | Configuration focus |
|-----------|-------------------|--------------|---------------------|
| **Generate unique IDs for existing identities** | Yes | No (or minimal) | Identity Scope Query; Attribute Definitions for unique/UUID types |
| **Combine attributes from multiple source accounts** | Optional | Yes (all contributing sources) | Authoritative account sources; Attribute Mapping for merge strategies |
| **Both: unique IDs + multi-source merge** | Yes | Yes | Identity Scope Query + sources; both Attribute Mapping and Definitions |
| **Normalize/compute attributes from one source** | Optional | Yes (single source) | Single source; Attribute Definitions with Velocity expressions |

---

## Step 1: Configure Source Settings (Scope and Sources)

### Identity scope configuration

Configure **Source Settings → Scope** to determine which identities participate.

| Field | Value | When to use | Example |
|-------|-------|-------------|---------|
| **Include identities in the scope?** | Yes | You want to process existing identities (for unique IDs or to provide a baseline) | Generate usernames for all active employees |
| **Include identities in the scope?** | No | You only care about source accounts, not existing identities | Merge attributes from AD and HR accounts without identity baseline |
| **Identity Scope Query** | `*` | Process all identities in ISC | All users across all sources |
| **Identity Scope Query** | `attributes.cloudLifecycleState:active` | Only active identities | Skip terminated employees |
| **Identity Scope Query** | `source.name:"Workday"` | Identities from specific source | Only HR-sourced identities |
| **Identity Scope Query** | `attributes.department:"Engineering"` | Subset by attribute | Engineering department only |

**Screenshot placeholder:** Source Settings showing Identity Scope Query and identity inclusion toggle.

![Source Settings - Scope configuration](../assets/images/attribute-generation-source-settings.png)
<!-- PLACEHOLDER: Screenshot of Source Settings (Scope + Sources). Save as docs/assets/images/attribute-generation-source-settings.png -->

### Sources configuration

Configure **Source Settings → Sources** to specify which sources contribute account data.

| Configuration | Purpose | Use case |
|--------------|---------|----------|
| **Empty sources list** | Identity-only attribute generation | Generate unique IDs from identity attributes only |
| **One source** | Single-source normalization | Compute attributes from HR data (e.g. parse addresses, format names) |
| **Multiple sources** | Multi-source consolidation | Merge job titles from Workday + Active Directory |

**Per-source fields:**

| Field | Description | Recommended value | Notes |
|-------|-------------|-------------------|-------|
| **Source name** | Exact name of ISC source | Must match ISC source name (case-sensitive) | Verify in Admin → Connections → Sources |
| **Force aggregation before processing?** | Run fresh aggregation before each Fusion run | No for performance; Yes for real-time accuracy | Increases runtime. Designed for deduplication; also useful when generating unique identifiers for an **authoritative** source—Fusion’s run can be synchronized with that source’s aggregation so new authoritative data gets identifiers as soon as it comes in. |
| **Account filter** | Limit accounts from this source | Leave empty initially | Example: `attributes.accountType:"employee"` |
| **Aggregation batch size** | Max accounts per run | Leave empty for all accounts | Use for phased rollout (e.g. 1000 accounts initially) |

**Example configurations:**

```
Scenario: Generate unique IDs for all active identities
- Include identities: Yes
- Identity Scope Query: attributes.cloudLifecycleState:active
- Sources: Empty (or minimal, if you need source account attributes in expressions)

Scenario: Merge department attribute from HR and AD
- Include identities: Optional (Yes if you want existing identity baseline)
- Sources:
  1. Source name: Workday, Force aggregation: No
  2. Source name: Active Directory, Force aggregation: No
```

---

## Step 2: Configure Attribute Mapping (for multi-source scenarios)

**Skip this step** if you're doing identity-only attribute generation with no sources.

When you have **one or more sources**, Attribute Mapping determines how source account attributes combine into the Fusion account schema.

### Default merge behavior

Choose the global **Default attribute merge from multiple sources**:

| Merge strategy | Behavior | Use when | Example result |
|---------------|----------|----------|----------------|
| **First found** | Uses first value by source order | One source is preferred/authoritative | HR is first; if HR has value, use it; else check AD |
| **Keep a list of values** | Array of all distinct values | You need all values for entitlements or multi-valued fields | Roles: `["Manager", "Developer", "Admin"]` |
| **Concatenate different values** | Single string with distinct values in brackets | You want human-readable combined view | Departments: `[Engineering] [IT Operations]` |

**Screenshot placeholder:** Attribute Mapping Settings showing default merge dropdown.

![Attribute Mapping Settings - Default merge](../assets/images/attribute-generation-attribute-mapping.png)
<!-- PLACEHOLDER: Screenshot of Attribute Mapping definitions. Save as docs/assets/images/attribute-generation-attribute-mapping.png -->

### Per-attribute mapping configuration

For each attribute you want to expose on the Fusion account, add an **Attribute Mapping**:

| Field | Purpose | Example |
|-------|---------|---------|
| **New attribute** | Name on Fusion account schema | `jobTitle`, `department`, `primaryEmail` |
| **Existing attributes** | Source attribute name(s) that feed this | `[title, jobTitle]` (from different sources) |
| **Merge override** | Override default for this attribute | Use "Source name" to prefer HR for `jobTitle` |
| **Source name** | Specific source to use (when merge=source) | `Workday` (HR is authoritative for job title) |

**Common mapping patterns:**

```
Pattern: Preferred source for critical attributes
- New attribute: jobTitle
- Existing attributes: [title, jobTitle, position]
- Merge: Source name = "Workday"
→ Always use Workday's value if present

Pattern: Collect all values
- New attribute: roles
- Existing attributes: [role, memberOf, groups]
- Merge: Keep a list of values
→ All roles from all sources

Pattern: Human-readable concatenation
- New attribute: allDepartments
- Existing attributes: [department, dept, ou]
- Merge: Concatenate different values
→ "[Engineering] [IT]"
```

---

## Step 3: Configure Attribute Definition (generate and normalize)

**Attribute Definition Settings** is where you **generate** new attributes using Apache Velocity templates, unique identifiers, UUIDs, or counters.

### Global settings

| Field | Purpose | Recommended value |
|-------|---------|-------------------|
| **Maximum attempts for unique attribute generation** | Cap on retries for unique/UUID values | 100 (default); increase for large account sets with high collision risk |

### Per-attribute definition configuration

For each attribute you want to generate, add an **Attribute Definition**:

| Field | Description | Options / Example |
|-------|-------------|-------------------|
| **Attribute Name** | Name of generated attribute on Fusion account | `id`, `uuid`, `username`, `employeeNumber`, `formattedDate` |
| **Apache Velocity expression** | Template to compute value | `#set($initial = $firstname.substring(0, 1))$initial$lastname` |
| **Case selection** | Text case transformation | Do not change, Lower case, Upper case, Capitalize |
| **Attribute Type** | Generation behavior | **Normal**, **Unique**, **UUID**, **Counter-based** |
| **Counter start value** | Starting number for counter type | 1, 1000, 50000 |
| **Minimum counter digits** | Zero-padding for counter/unique | 3 → `001`, `002`; 5 → `00001` |
| **Maximum length** | Truncate to this length | 20 (counter/unique preserved at end) |
| **Normalize special characters?** | Remove special chars and quotes | Yes for usernames/IDs |
| **Remove spaces?** | Remove all whitespace | Yes for usernames/IDs |
| **Refresh on each aggregation?** | Recalculate every run (Normal type only) | Yes if attribute is dynamic; No if stable |

**Screenshot placeholder:** Attribute Definition Settings with examples.

![Attribute Definition Settings - Unique ID and UUID](../assets/images/attribute-generation-attribute-definition.png)
<!-- PLACEHOLDER: Screenshot of Attribute Definition with unique ID / UUID example. Save as docs/assets/images/attribute-generation-attribute-definition.png -->

### Attribute types explained

| Type | Behavior | Use case | Example |
|------|----------|----------|---------|
| **Normal** | Computed each run (optional refresh) | Derived/computed attributes | Full name: `$firstname $lastname` |
| **Unique** | Must be unique; adds counter on collision | Usernames | `jsmith` → `jsmith1`, `jsmith2` |
| **UUID** | Generates immutable UUID | Stable native identity | `a3f2e8b4-...` (never changes) |
| **Counter-based** | Sequential incrementing number | Employee IDs, badge numbers | 1000, 1001, 1002... |

**When to use each type:**

| Requirement | Type to use | Configuration |
|-------------|-------------|---------------|
| Stable reference that never changes | UUID | No expression needed; UUID auto-generated |
| Human-readable unique username | Unique | Expression: `#set($initial = $firstname.substring(0,1))$initial$lastname`; case: lower; normalize: yes |
| Sequential employee number | Counter-based | Counter start: 1000; digits: 5 |
| Computed full name (can change) | Normal | Expression: `$firstname $lastname`; refresh: yes |

**Video placeholder:** Unique identifier generation with disambiguation.

<!-- PLACEHOLDER: Video explaining unique identifier generation and collision handling. Save as docs/assets/videos/attribute-generation-unique-id.mp4 -->

### Velocity context and utilities

The Apache Velocity expression has access to:

| Utility | Methods | Use case | Example |
|---------|---------|----------|---------|
| **$Math** | Standard JavaScript Math | Calculations, rounding | `$Math.round($salary / 12)` |
| **$Datefns** | format, parse, addDays, addMonths, addYears, subDays, subMonths, subYears, isBefore, isAfter, isEqual, differenceInDays, startOfDay, endOfDay, now, isValid | Date manipulation | `$Datefns.format($hireDate, 'yyyy-MM-dd')` |
| **$AddressParse** | getCityState(city), getCityStateCode(city), parse(addressString) | Address normalization | `$AddressParse.getCityState("San Francisco")` → `"California"` |
| **$Normalize** | date(dateStr), phone(phoneNumber), name(name), fullName(name), ssn(ssn), address(addressString) | Data standardization | `$Normalize.phone($phoneNumber)` → `"+1-555-123-4567"` |
| **Mapped attributes** | All attributes from Attribute Mapping or identity | Attribute access | `$firstname`, `$department`, `$email` |

**Common Velocity patterns:**

```velocity
# Unique username: first initial + lastname (lowercase, no special chars)
#set($initial = $firstname.substring(0, 1))
$initial$lastname

# Full name with middle initial if present
#if($middlename && $middlename.length() > 0)
#set($mi = $middlename.substring(0, 1))
$firstname $mi. $lastname
#else
$firstname $lastname
#end

# Formatted hire date
$Datefns.format($hireDate, 'MMMM dd, yyyy')

# Years of service
$Math.floor($Datefns.differenceInDays($Datefns.now(), $hireDate) / 365)

# Normalized phone
$Normalize.phone($mobilePhone)

# Parsed city from address
$AddressParse.getCityState($city)
```

---

## Step 4: Processing control

Configure **Source Settings → Processing Control** for account lifecycle management:

| Field | Recommended for attribute generation | Notes |
|-------|-------------------------------------|-------|
| **Maximum history messages** | 10 (default) | Limits history entries per Fusion account |
| **Delete accounts with no authoritative accounts left?** | No for identity-only; Yes for source-driven | Auto-cleanup when source accounts are removed |
| **Correlate missing source accounts on aggregation?** | Yes | Helps with incremental updates |
| **Force attribute refresh on each aggregation?** | No | Applies only to Normal-type attributes; Unique attributes are only computed on account creation or activation. Expensive for large datasets. |
| **Reset processing flag in case of unfinished processing?** | No (enable once if needed) | Use for recovery after failed runs |

---

## Common attribute generation patterns

### Pattern 1: Unique usernames for all employees

**Goal:** Generate `jsmith`, `jsmith1`, `jsmith2` style usernames.

```
Source Settings:
- Include identities: Yes
- Identity Scope Query: attributes.cloudLifecycleState:active
- Sources: Empty (using identity attributes only)

Attribute Definition:
- Attribute Name: username
- Expression: #set($initial = $firstname.substring(0,1))$initial$lastname
- Case: Lower case
- Type: Unique
- Minimum counter digits: 1
- Normalize special characters: Yes
- Remove spaces: Yes
```

### Pattern 2: Merge job titles from HR and AD

**Goal:** Prefer HR job title; fall back to AD if missing.

```
Source Settings:
- Sources:
  1. Workday (order 1)
  2. Active Directory (order 2)

Attribute Mapping:
- New attribute: jobTitle
- Existing attributes: [title, jobTitle, position]
- Merge: First found (uses source order: Workday first)
```

### Pattern 3: Collect all roles from multiple systems

**Goal:** Array of all roles from SAP, Salesforce, Workday.

```
Source Settings:
- Sources: SAP, Salesforce, Workday

Attribute Mapping:
- New attribute: allRoles
- Existing attributes: [roles, groups, memberOf]
- Merge: Keep a list of values
```

### Pattern 4: Sequential employee numbers starting at 50000

**Goal:** 50000, 50001, 50002...

```
Attribute Definition:
- Attribute Name: employeeNumber
- Type: Counter-based
- Counter start value: 50000
- Minimum counter digits: 5
```

### Pattern 5: Immutable UUID as native identity

**Goal:** Stable reference for ISC native identity and account name.

```
Attribute Definition:
- Attribute Name: uuid
- Type: UUID
(No expression needed; UUID auto-generated)

Then set Account Schema:
- Native identity: uuid
- Display attribute: uuid
```

---

## Validation and testing

After configuration, validate your setup:

| Step | Action | What to verify |
|------|--------|----------------|
| 1. Discover Schema | Run **Discover Schema** in ISC | Fusion account schema includes mapped + generated attributes |
| 2. Test aggregation | Run account aggregation | Accounts appear in Fusion source with expected attribute values |
| 3. Check attribute values | Review a Fusion account | Unique IDs have no collisions or expected counters; merged attributes show correct values |
| 4. Verify identity correlation | Check identity profiles | Fusion accounts correlate to identities as expected |
| 5. Test with subset | Use **Account filter** or **Aggregation batch size** | Validate with small batch before full rollout |

---

## Summary

| Component | Purpose | Key fields |
|-----------|---------|------------|
| **Source Settings (Scope)** | Which identities to process | Include identities, Identity Scope Query |
| **Source Settings (Sources)** | Which sources contribute account data | Source name, Force aggregation, Account filter |
| **Attribute Mapping** | How to merge source attributes | Default merge, New attribute, Existing attributes, Source name |
| **Attribute Definition** | How to generate attributes | Attribute Name, Expression, Type (Normal/Unique/UUID/Counter), Case, Normalize |
| **Processing Control** | Account lifecycle | Delete empty, Correlate on aggregation, Force refresh |

**Next steps:**
- For more on merging strategies and Velocity utilities, see [Effective use of attribute management](attribute-management.md).
- For deduplication instead of just attribute generation, see [Identity Fusion for deduplication](deduplication.md).
- For step-by-step ISC setup (connection, schema, identity profile), see the [main README](../../README.md#quick-start).
