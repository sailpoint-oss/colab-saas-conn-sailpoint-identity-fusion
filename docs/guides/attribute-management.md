# Effective Use of Attribute Management

Attribute management in Identity Fusion NG covers **mapping** source attributes into the Fusion account, **merging** values when multiple sources contribute, and **defining** generated attributes (Velocity, unique, UUID, counters). This comprehensive guide provides best practices, common patterns, and detailed configuration guidance.

---

## Overview and scope

Attribute management consists of two interconnected components:

| Component | Purpose | When to use | Configuration location |
|-----------|---------|-------------|----------------------|
| **Attribute Mapping** | Map and merge source account attributes into Fusion account schema | When you have one or more sources | Attribute Mapping Settings |
| **Attribute Definition** | Generate new attributes using expressions, unique IDs, UUIDs, counters | Always (identity-only or with sources) | Attribute Definition Settings |

**Use both:** When using sources, first map source attributes (Attribute Mapping), then generate additional attributes (Attribute Definition) on top of the mapped schema.

**Use Definition only:** For identity-only attribute generation (no sources), skip Attribute Mapping and use Attribute Definition to generate attributes from identity attributes.

**Screenshot placeholder:** Configuration interface showing both sections.

![Attribute configuration overview - Mapping and Definition](../assets/images/attribute-management-overview.png)
<!-- PLACEHOLDER: Screenshot of Configuration with Attribute Mapping and Attribute Definition. Save as docs/assets/images/attribute-management-overview.png -->

---

## Part 1: Attribute Mapping

Attribute Mapping controls **how source account attributes** are combined into the Fusion account schema when multiple sources contribute.

### When to use Attribute Mapping

| Scenario | Use Attribute Mapping? | Example |
|----------|----------------------|---------|
| Identity-only attribute generation (no sources) | No | Generate unique IDs from identity attributes |
| One source (no merging needed) | Optional | Map single source if you want to rename/consolidate attributes |
| Multiple sources (merging required) | Yes | Merge `jobTitle` from Workday and `title` from Active Directory |
| Normalize from multiple names | Yes | Map `[title, jobTitle, position]` → `jobTitle` |

### Default merge behavior

The **Default attribute merge from multiple sources** setting applies globally to all mapped attributes (unless overridden per attribute).

| Merge strategy | Behavior | Result format | Use when | Example |
|---------------|----------|---------------|----------|---------|
| **First found** | Uses first non-null value by source order | Single value (string) | One source is preferred/authoritative | HR first, then AD; prefer HR value |
| **Keep a list of values** | Array of all distinct non-null values | Array of strings | Need all values (roles, groups, entitlements) | Collect all roles from SAP, Salesforce, Workday → `["Admin", "Manager", "Developer"]` |
| **Concatenate different values** | Distinct values in brackets, space-separated | Single string | Human-readable combined view | Departments: `[Engineering] [IT Operations]` |

**Screenshot placeholder:** Attribute Mapping with merge strategies.

![Attribute mapping and merge - Configuration](../assets/images/attribute-management-mapping-merge.png)
<!-- PLACEHOLDER: Screenshot of Attribute Mapping with merge options. Save as docs/assets/images/attribute-management-mapping-merge.png -->

**Source ordering matters:** With "First found", the **order** of sources in **Source Settings → Authoritative account sources** determines precedence. First source has highest priority.

```
Example: Source order is [Workday, Active Directory]
- Workday has jobTitle = "Senior Engineer"
- Active Directory has title = "Engineer"
- Merge: First found
→ Result: "Senior Engineer" (Workday wins)
```

### Per-attribute mapping configuration

For each attribute you want to expose on the Fusion account, add an **Attribute Mapping**:

| Field | Purpose | Example |
|-------|---------|---------|
| **New attribute** | Name on Fusion account schema | `jobTitle`, `department`, `manager`, `roles` |
| **Existing attributes** | List of source attribute names (from all sources) that feed this attribute | `[title, jobTitle, position]` |
| **Default attribute merge** (override) | Override global merge for this specific attribute | Use "Source name" to prefer Workday for `jobTitle` |
| **Source name** | Specific source to use when merge = "Source name" | `Workday` |

**Per-attribute merge options:**

| Option | Effect | Use case |
|--------|--------|----------|
| (Use default) | Inherits global default merge | Most attributes |
| **First found** | Override global to use first found | This attribute has preferred source order |
| **Keep a list of values** | Override global to keep all values | Multi-valued attribute (roles, groups) |
| **Concatenate different values** | Override global to concatenate | Human-readable combined view |
| **Source name** | Use value from specific source only | One source is authoritative for this attribute |

### Common mapping patterns

#### Pattern 1: Preferred source for critical attributes

**Goal:** Use HR data for job titles; fall back to AD only if HR missing.

```
Attribute Mapping:
- New attribute: jobTitle
- Existing attributes: [title, jobTitle, position]
- Merge: Source name = "Workday"

Source order: [Workday, Active Directory]
→ Always uses Workday's value if present; ignores AD even if different
```

#### Pattern 2: Collect all roles from all systems

**Goal:** Build a master list of all roles across SAP, Salesforce, Workday.

```
Attribute Mapping:
- New attribute: allRoles
- Existing attributes: [roles, groups, memberOf, entitlements]
- Merge: Keep a list of values

Result: ["SAP_Admin", "Salesforce_Sales", "Workday_Manager"]
→ Array with all distinct values
```

#### Pattern 3: Human-readable concatenation

**Goal:** Show all departments as `[Engineering] [IT]` for easy reading.

```
Attribute Mapping:
- New attribute: departments
- Existing attributes: [department, dept, organizationalUnit]
- Merge: Concatenate different values

Workday has department = "Engineering"
AD has organizationalUnit = "IT Operations"
→ Result: "[Engineering] [IT Operations]"
```

**Screenshot placeholder:** Concatenate merge result on account.

![Concatenated attribute result - Example](../assets/images/attribute-management-concatenate-result.png)
<!-- PLACEHOLDER: Screenshot showing concatenated values in an account. Save as docs/assets/images/attribute-management-concatenate-result.png -->

#### Pattern 4: Consolidate attribute names

**Goal:** Different sources use different names for same concept; standardize.

```
Attribute Mapping:
- New attribute: email (standardized name)
- Existing attributes: [mail, emailAddress, email, primaryEmail]
- Merge: First found (or Source name if one source is authoritative)

→ Single "email" attribute on Fusion account regardless of source naming
```

#### Pattern 5: Per-attribute override

**Goal:** Most attributes use "First found", but roles need all values collected.

```
Global default: First found

Mapping 1:
- New attribute: jobTitle
- Existing attributes: [title, jobTitle]
- Merge: (use default) → First found

Mapping 2:
- New attribute: roles
- Existing attributes: [roles, groups, memberOf]
- Merge: Keep a list of values (override)
→ roles get all values; other attributes use first found
```

### Multi-valued attributes and ISC schema

When using **Keep a list of values** or **Concatenate**, consider the ISC schema implications:

| Merge strategy | ISC schema type | Identity profile mapping | Use case |
|---------------|----------------|-------------------------|----------|
| **First found** | Single-valued (string) | Direct mapping | Most attributes (name, email, department) |
| **Keep a list of values** | Multi-valued (array) | Use index transform or join | Entitlements, roles, groups |
| **Concatenate** | Single-valued (string) | Direct mapping | Human-readable display; search |

**Note:** After **Discover Schema**, ISC may show multi-valued attributes as entitlement-type (multi-valued) fields. Your identity profile transforms must handle arrays appropriately.

---

## Part 2: Attribute Definition

Attribute Definition controls **how attributes are generated** using Apache Velocity expressions, unique identifiers, UUIDs, or counters.

### When to use Attribute Definition

| Goal | Use Attribute Definition | Example |
|------|-------------------------|---------|
| Generate unique usernames | Yes (Unique type) | `jsmith`, `jsmith1`, `jsmith2` |
| Assign stable UUIDs | Yes (UUID type) | `a3f2e8b4-7c2d-4f9e-8a1b-3c5d6e7f8g9h` |
| Sequential employee numbers | Yes (Counter type) | 1000, 1001, 1002... |
| Computed attributes | Yes (Normal type with expression) | Full name from first + last; formatted dates |
| Normalize/format values | Yes (Normal type with expression + utilities) | Parse address, format phone, proper case names |

### Global settings

| Field | Purpose | Recommended value |
|-------|---------|-------------------|
| **Maximum attempts for unique attribute generation** | Cap on retries for generating unique values | 100 (default); increase for large datasets with high collision risk (e.g. 200–500) |

**Why this matters:** For **Unique** type attributes, if the generated value already exists, the connector appends a counter and retries. This setting prevents infinite loops if the expression always produces the same value.

### Per-attribute definition configuration

For each attribute you want to generate, add an **Attribute Definition**:

| Field | Type | Purpose | Options / Example |
|-------|------|---------|-------------------|
| **Attribute Name** | String (required) | Name of generated attribute | `username`, `uuid`, `employeeNumber`, `fullName`, `formattedHireDate` |
| **Apache Velocity expression** | String (optional) | Template to compute value | `#set($i=$firstname.substring(0,1))$i$lastname` |
| **Case selection** | Dropdown (required) | Text case transformation | Do not change, Lower case, Upper case, Capitalize |
| **Attribute Type** | Dropdown (required) | Generation behavior | **Normal**, **Unique**, **UUID**, **Counter-based** |
| **Counter start value** | Integer | Starting number (Counter type) | 1, 1000, 50000 |
| **Minimum counter digits** | Integer | Zero-padding (Counter/Unique types) | 3 → `001`, `002`; 5 → `00001` |
| **Maximum length** | Integer (optional) | Truncate to this length | 20; counter preserved at end for Unique/Counter |
| **Normalize special characters?** | Boolean | Remove special chars/quotes | Yes for usernames/IDs |
| **Remove spaces?** | Boolean | Remove all whitespace | Yes for usernames/IDs |
| **Refresh on each aggregation?** | Boolean | Recalculate every run (Normal type only) | Yes if dynamic; No if stable |

**Screenshot placeholder:** Attribute Definition with examples.

![Attribute definition example - Unique ID and UUID](../assets/images/attribute-management-definition.png)
<!-- PLACEHOLDER: Screenshot of Attribute Definition (e.g. unique ID + UUID). Save as docs/assets/images/attribute-management-definition.png -->

### Attribute types explained in detail

#### Normal type

**Behavior:** Standard computed attribute; recalculated based on **Refresh on each aggregation?** setting.

| Refresh setting | Behavior | Use case |
|----------------|----------|----------|
| Yes | Recalculated every aggregation | Dynamic values that should update (full name, age, formatted dates) |
| No | Calculated once; persisted | Stable values (initial assignment, one-time calculations) |

**Examples:**

```velocity
# Full name (refresh: Yes)
$firstname $lastname

# Formatted hire date (refresh: No, unless hireDate changes)
$Datefns.format($hireDate, 'MMMM dd, yyyy')

# Years of service (refresh: Yes, dynamic)
$Math.floor($Datefns.differenceInDays($Datefns.now(), $hireDate) / 365)
```

#### Unique type

**Behavior:** Must be unique across all Fusion accounts; connector adds disambiguation counter on collision. Unique attributes are only computed when a Fusion account is **first created** or when an existing account is **activated** (an internal mechanism to reset unique attributes). They are not refreshed by **Force attribute refresh on each aggregation** (that setting applies only to Normal-type attributes).

**How it works:**
1. Generate value from expression
2. Check if value exists on any account
3. If unique → use value
4. If collision → append counter (starting at 1), check again
5. Repeat up to **Maximum attempts**

**Counter format:** `{base value}{counter}` (e.g. `jsmith1`, `jsmith2`)

**Zero-padding:** Use **Minimum counter digits** to pad counter (e.g. digits=3 → `jsmith001`)

**Examples:**

```
Expression: #set($i=$firstname.substring(0,1))$i$lastname
Case: Lower case
Normalize: Yes
Spaces: Yes

Firstname="John", Lastname="Smith"
→ Generate: "jsmith"
→ Check: Already exists
→ Append counter: "jsmith1"
→ Check: Unique
→ Result: "jsmith1"

Next John Smith:
→ Generate: "jsmith"
→ Check: Exists
→ Try: "jsmith1" → Exists
→ Try: "jsmith2" → Unique
→ Result: "jsmith2"
```

**Best practices:**
- Include variable parts in expression (firstname, lastname, not constants)
- Use case transformation (Lower case for usernames)
- Enable normalization and space removal for clean identifiers
- Set reasonable **Maximum length** (e.g. 20 for usernames)

#### UUID type

**Behavior:** Generates immutable universally unique identifier (v4 UUID).

**No expression needed:** UUID is auto-generated; any expression is ignored.

**Characteristics:**
- Globally unique (extremely low collision probability)
- Immutable (never changes once generated)
- Format: 36 characters (8-4-4-4-12 hex digits)
- Example: `a3f2e8b4-7c2d-4f9e-8a1b-3c5d6e7f8a9b`

**Use cases:**
- **Native identity** in ISC (stable reference that never changes)
- **Account name** when you need immutable identifier
- Cross-system correlation (UUID as common key)
- External system integration (pass UUID to other systems)

**Configuration:**

```
Attribute Name: uuid
Type: UUID
(All other fields: defaults)
→ Auto-generated UUID on account creation
```

**Why use UUID as native identity:**
- Native identity cannot be changed in ISC
- Template-based unique IDs can be reevaluated (e.g. when account is enabled)
- UUID provides stable reference even if other attributes change

#### Counter-based type

**Behavior:** Sequential incrementing number; each account gets next number in sequence.

**How it works:**
1. Check highest existing counter value
2. Next account gets: max + 1
3. Counter state persisted across aggregations

**Fields:**
- **Counter start value:** First number in sequence (e.g. 1, 1000, 50000)
- **Minimum counter digits:** Zero-padding (e.g. 5 → `00001`, `00002`)

**Examples:**

```
Configuration:
- Counter start: 1000
- Minimum digits: 5

Results:
- First account: 01000
- Second account: 01001
- Third account: 01002
...
- 10000th account: 11000
```

**Expression support:** Counter type supports Velocity expression with special `$counter` variable:

```velocity
# Employee number with prefix
EMP-$counter

Counter start: 1000, Digits: 5
→ EMP-01000, EMP-01001, EMP-01002
```

**Use cases:**
- Employee numbers
- Badge IDs
- Sequential customer IDs
- Any monotonically increasing identifier

---

## Part 3: Apache Velocity context

The **Apache Velocity expression** field provides a powerful templating language with access to utilities and data.

### Available data

| Source | What you can access | Example |
|--------|---------------------|---------|
| **Mapped account attributes** | All attributes from Attribute Mapping | `$jobTitle`, `$department`, `$email` |
| **Source account attributes** | Direct source attributes (if no mapping) | `$firstname`, `$lastname`, `$hireDate` |
| **Identity attributes** | When Include identities = Yes | Depends on identity schema |
| **Special variables** | `$counter` (Counter type only) | `$counter` in expression for Counter type |

### Available utilities

#### $Math (JavaScript Math object)

Standard mathematical operations.

| Method | Purpose | Example |
|--------|---------|---------|
| `$Math.round(x)` | Round to nearest integer | `$Math.round($salary / 12)` → monthly salary |
| `$Math.floor(x)` | Round down | `$Math.floor($Datefns.differenceInDays($Datefns.now(), $hireDate) / 365)` → years of service |
| `$Math.ceil(x)` | Round up | `$Math.ceil($hoursPerWeek / 8)` → days per week |
| `$Math.max(a, b)` | Maximum value | `$Math.max($bonus1, $bonus2)` |
| `$Math.min(a, b)` | Minimum value | `$Math.min($requestedVacation, $remainingVacation)` |
| `$Math.abs(x)` | Absolute value | `$Math.abs($difference)` |

#### $Datefns (date-fns library)

Advanced date formatting and manipulation.

| Method | Purpose | Example |
|--------|---------|---------|
| `$Datefns.format(date, format)` | Format date | `$Datefns.format($hireDate, 'yyyy-MM-dd')` → `2023-04-15` |
| `$Datefns.parse(dateStr, format)` | Parse date string | `$Datefns.parse("2023-04-15", "yyyy-MM-dd")` |
| `$Datefns.addDays(date, n)` | Add days | `$Datefns.addDays($hireDate, 90)` → 90 days after hire |
| `$Datefns.addMonths(date, n)` | Add months | `$Datefns.addMonths($hireDate, 3)` |
| `$Datefns.addYears(date, n)` | Add years | `$Datefns.addYears($hireDate, 1)` |
| `$Datefns.subDays(date, n)` | Subtract days | `$Datefns.subDays($Datefns.now(), 30)` → 30 days ago |
| `$Datefns.subMonths(date, n)` | Subtract months | Similar |
| `$Datefns.subYears(date, n)` | Subtract years | Similar |
| `$Datefns.isBefore(date1, date2)` | Date comparison | `$Datefns.isBefore($hireDate, $Datefns.now())` → true if hired in past |
| `$Datefns.isAfter(date1, date2)` | Date comparison | Similar |
| `$Datefns.isEqual(date1, date2)` | Date equality | Similar |
| `$Datefns.differenceInDays(date1, date2)` | Days between | `$Datefns.differenceInDays($Datefns.now(), $hireDate)` → tenure in days |
| `$Datefns.startOfDay(date)` | Start of day (midnight) | Useful for date-only comparisons |
| `$Datefns.endOfDay(date)` | End of day (23:59:59) | Similar |
| `$Datefns.now()` | Current date/time | `$Datefns.now()` |
| `$Datefns.isValid(date)` | Check if date is valid | `$Datefns.isValid($inputDate)` → true/false |

**Date format:** Format tokens follow the [date-fns format specification](https://date-fns.org/docs/format). Use these tokens (not Java SimpleDateFormat) in `$Datefns.format(date, format)` and `$Datefns.parse(dateStr, format)`.

**Date format patterns:**

| Pattern | Meaning | Example |
|---------|---------|---------|
| `yyyy` | 4-digit year | 2023 |
| `yy` | 2-digit year | 23 |
| `MM` | 2-digit month | 04 |
| `MMM` | Month abbr | Apr |
| `MMMM` | Month full | April |
| `dd` | 2-digit day | 15 |
| `HH` | Hour (24h) | 14 |
| `mm` | Minute | 30 |
| `ss` | Second | 45 |

#### $AddressParse (address parsing)

Parse and normalize US addresses.

| Method | Purpose | Example |
|--------|---------|---------|
| `$AddressParse.getCityState(city)` | Get state from city name | `$AddressParse.getCityState("San Francisco")` → `"California"` |
| `$AddressParse.getCityStateCode(city)` | Get state code from city | `$AddressParse.getCityStateCode("San Francisco")` → `"CA"` |
| `$AddressParse.parse(addressString)` | Parse full address into components | Returns object with `{street_address1, street_address2, city, state, postal_code, country}` |

**Examples:**

```velocity
# Parse address
#set($addr = $AddressParse.parse("123 Main St Apt 4B, San Francisco, CA 94102"))
Street: $addr.street_address1
Unit: $addr.street_address2
City: $addr.city
State: $addr.state
ZIP: $addr.postal_code

# Get state from city
$AddressParse.getCityState($city)
```

#### $Normalize (data normalization)

Standardize common data formats.

| Method | Purpose | Example |
|--------|---------|---------|
| `$Normalize.date(dateStr)` | Normalize date to ISO format | `$Normalize.date("04/15/2023")` → `"2023-04-15"` |
| `$Normalize.phone(phoneNumber)` | Normalize phone to international format | `$Normalize.phone("555-123-4567")` → `"+1-555-123-4567"` |
| `$Normalize.name(name)` | Proper case for name | `$Normalize.name("JOHN SMITH")` → `"John Smith"` |
| `$Normalize.fullName(name)` | Full name normalization | Similar to name |
| `$Normalize.ssn(ssn)` | Normalize SSN format | `$Normalize.ssn("123456789")` → `"123-45-6789"` |
| `$Normalize.address(addressString)` | Normalize address format | Standardizes address string |

### Velocity syntax patterns

#### Basic variable access

```velocity
$firstname
$lastname
$email
```

#### String concatenation

```velocity
$firstname $lastname
```

#### Variable assignment

```velocity
#set($initial = $firstname.substring(0, 1))
$initial$lastname
```

#### Conditional logic

```velocity
#if($middlename && $middlename.length() > 0)
#set($mi = $middlename.substring(0, 1))
$firstname $mi. $lastname
#else
$firstname $lastname
#end
```

#### String methods

```velocity
$firstname.substring(0, 1)          # First character
$firstname.toLowerCase()            # Lowercase
$firstname.toUpperCase()            # Uppercase
$email.replace("@", "_at_")         # Replace
$name.trim()                        # Remove whitespace
$name.length()                      # String length
```

#### Null checks

```velocity
#if($middlename)
  $middlename
#else
  N/A
#end
```

---

## Common attribute management patterns

### Pattern 1: Username with disambiguation

```
Attribute Definition:
- Attribute Name: username
- Expression: #set($i=$firstname.substring(0,1))$i$lastname
- Case: Lower case
- Type: Unique
- Minimum counter digits: 0 (no zero-padding)
- Normalize special characters: Yes
- Remove spaces: Yes

Result: jsmith, jsmith1, jsmith2...
```

### Pattern 2: Employee number with counter

```
Attribute Definition:
- Attribute Name: employeeNumber
- Expression: EMP-$counter
- Type: Counter-based
- Counter start value: 50000
- Minimum counter digits: 5

Result: EMP-50000, EMP-50001, EMP-50002...
```

### Pattern 3: Full name (dynamic)

```
Attribute Definition:
- Attribute Name: fullName
- Expression: $firstname $lastname
- Type: Normal
- Refresh on each aggregation: Yes

Result: Updates if firstname or lastname changes
```

### Pattern 4: Formatted hire date

```
Attribute Definition:
- Attribute Name: formattedHireDate
- Expression: $Datefns.format($hireDate, 'MMMM dd, yyyy')
- Type: Normal
- Refresh on each aggregation: No

Result: "April 15, 2023"
```

### Pattern 5: UUID as native identity

```
Attribute Definition:
- Attribute Name: uuid
- Type: UUID

Then in Account Schema (after Discover Schema):
- Identity attribute: uuid
- Display attribute: uuid (or another human-readable field)
```

### Pattern 6: Merge departments from all sources

```
Attribute Mapping:
- New attribute: allDepartments
- Existing attributes: [department, dept, ou, organizationalUnit]
- Merge: Concatenate different values

Result: "[Engineering] [IT Operations] [R&D]"
```

### Pattern 7: Conditional middle initial

```
Attribute Definition:
- Attribute Name: displayName
- Expression:
#if($middlename && $middlename.length() > 0)
#set($mi = $middlename.substring(0, 1))
$firstname $mi. $lastname
#else
$firstname $lastname
#end
- Type: Normal
- Refresh: Yes

Result: "John A. Smith" or "John Smith" (if no middle name)
```

---

## Order of operations

Understanding the sequence helps design correct configurations:

| Step | Component | Action | Example |
|------|-----------|--------|---------|
| 1 | **Account fetch** | Read accounts from configured sources | Workday: `{title: "Engineer"}`, AD: `{jobTitle: "Sr Engineer"}` |
| 2 | **Attribute Mapping** | Merge per mapping rules | Map `[title, jobTitle]` → `jobTitle`, merge: first found → "Engineer" |
| 3 | **Attribute Definition** | Generate attributes from mapped data | Generate `username` from `$firstname $lastname` → "jsmith" |
| 4 | **Schema** | Result is Fusion account schema | `{jobTitle: "Engineer", username: "jsmith", uuid: "a3f2..."}` |
| 5 | **Discover Schema** | ISC reads schema from connector | Schema includes mapped + generated attributes |

**Key insight:** Attribute Definition expressions can reference attributes created by Attribute Mapping. Ensure mapped attributes exist before referencing in expressions.

---

## Validation and testing

| Validation step | How to check | What to verify |
|----------------|--------------|----------------|
| **Schema discovery** | Run Discover Schema | Mapped + generated attributes appear in schema |
| **Attribute values** | View Fusion account in ISC | Values are correct, merging works as expected |
| **Unique ID collisions** | Check for counter suffixes | `username1`, `username2` indicate collisions (expected) |
| **Multi-valued attributes** | Check array attributes | List/concatenate merge produces expected format |
| **Expression errors** | Check aggregation logs | No Velocity syntax errors |
| **Performance** | Monitor aggregation time | Acceptable for dataset size |

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| **Attribute missing after mapping** | Source attribute name mismatch | Verify exact source attribute names (case-sensitive) |
| **Unique generation loops** | Expression always produces same value | Add variable parts (firstname, lastname, not constants) |
| **Velocity syntax error** | Invalid Velocity expression | Check syntax: `#set(...)`, `#if(...)#end`, `$variable` |
| **Multi-valued not working** | Wrong merge strategy | Use "Keep a list of values" for arrays |
| **UUID changing** | Using Normal type with UUID expression | Use UUID type (auto-generated, immutable) |
| **Counter not incrementing** | Not using Counter type | Use Counter-based type with counter start |
| **Null/empty values** | Source attribute doesn't exist | Check source account schema; add null checks in Velocity |

---

## Summary

| Component | Key configuration | Use case |
|-----------|------------------|----------|
| **Attribute Mapping** | Default merge (first/list/concatenate); per-attribute mappings | Merge source attributes into Fusion schema |
| **Attribute Definition** | Expression, Type (Normal/Unique/UUID/Counter), Case, Normalize | Generate unique IDs, UUIDs, counters, computed values |
| **Velocity utilities** | $Math, $Datefns, $AddressParse, $Normalize | Advanced attribute generation with date/address/normalization |

**Best practices:**
1. Use **Attribute Mapping** first to consolidate source attributes
2. Use **Attribute Definition** to generate additional attributes on top of mapped data
3. For usernames: **Unique** type with expression, lowercase, normalize, remove spaces
4. For stable reference: **UUID** type as native identity
5. For sequential IDs: **Counter-based** type with start value and padding
6. Test expressions with small batch before full rollout

**Next steps:**
- For identity-only attribute generation (no sources), see [Identity Fusion for attribute generation](attribute-generation.md).
- For deduplication with attribute merging, see [Identity Fusion for deduplication](deduplication.md).
- For Velocity expression examples and patterns, see this guide's patterns section above.
