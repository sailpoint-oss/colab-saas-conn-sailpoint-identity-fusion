# Effective Use of Matching Algorithms

Identity Fusion NG uses **similarity scoring** to detect potential duplicate identities. This comprehensive guide helps you choose, configure, and tune the **matching algorithms** used in **Fusion Settings → Matching Settings** for optimal deduplication results.

---

## Overview: Matching in deduplication

Matching algorithms calculate **similarity scores** (0–100) between attribute values from different identities. These scores determine whether two identities are potential duplicates.

| Component | Purpose | Configuration location |
|-----------|---------|----------------------|
| **Fusion attribute matches** | Define which attributes to compare | Fusion Settings → Matching Settings |
| **Matching algorithm** | How to calculate similarity | Per attribute (Enhanced Name Matcher, Jaro-Winkler, Dice, Double Metaphone, Custom) |
| **Similarity score threshold** | Minimum score to flag as duplicate | Per attribute or overall |
| **Mandatory match** | Require attribute to participate | Per attribute (Yes/No) |
| **Overall vs per-attribute** | Scoring mode | Use overall fusion similarity score? (Yes/No) |

**Screenshot placeholder:** Fusion attribute matches configuration.

![Fusion attribute matches - Configuration interface](../assets/images/matching-algorithms-config.png)
<!-- PLACEHOLDER: Screenshot of Fusion Settings > Fusion attribute matches. Save as docs/assets/images/matching-algorithms-config.png -->

---

## Algorithm selection guide

### Algorithm comparison matrix

| Algorithm | Best for | Strengths | Weaknesses | Computational cost |
|-----------|----------|-----------|------------|-------------------|
| **Enhanced Name Matcher** | Person names (full, first, last) | Handles order variations, titles, suffixes, cultural naming, nicknames | May be overly permissive for non-name fields | Medium |
| **Jaro-Winkler** | Short strings, codes, emails, usernames | Emphasizes prefix matching; good for typos at start; fast | Less effective for long text; suffix typos score lower | Low |
| **Dice** | Longer text (addresses, job titles, descriptions) | Robust for substring matching; handles reordering well | Can miss phonetic variations; requires adequate text length | Medium |
| **Double Metaphone** | Names with spelling variations, phonetic matching | Catches "Catherine"/"Katherine", "John"/"Jon", "Smith"/"Smyth" | May generate false positives for short names; language-dependent | Low |
| **Custom** | Domain-specific requirements | Your own logic via SaaS customizer | Requires development and testing | Variable |

### Decision tree: Which algorithm to use?

```
What type of attribute are you comparing?

├─ Person name (full, first, last)
│  ├─ Standard spellings expected → Enhanced Name Matcher
│  └─ Phonetic variations expected → Double Metaphone or Enhanced Name Matcher
│
├─ Email address
│  ├─ Domain matters → Jaro-Winkler (emphasizes prefix before @)
│  └─ Typo tolerance → Jaro-Winkler
│
├─ Username / employee ID / short code
│  └─ High precision needed → Jaro-Winkler (high threshold: 95–100)
│
├─ Address / job title / longer text
│  └─ Substring/phrase matching → Dice
│
├─ Phone number
│  └─ After normalization → Jaro-Winkler
│
└─ Custom business logic
   └─ Custom (from SaaS customizer)
```

---

## Algorithm deep dive

### Enhanced Name Matcher

**Purpose:** Specialized algorithm for person names with cultural awareness and variation handling.

**How it works:**
- Tokenizes names into components (first, middle, last, titles, suffixes)
- Normalizes order (handles "Smith, John" vs "John Smith")
- Recognizes titles (Dr., Mr., Mrs., Prof.) and suffixes (Jr., Sr., III)
- Handles cultural naming patterns (e.g., Asian name order, Hispanic compound surnames)
- Matches nicknames (e.g., "William" matches "Bill", "Robert" matches "Bob")

**Recommended thresholds:**

| Use case | Threshold | Rationale |
|----------|-----------|-----------|
| Full name (e.g. "John A. Smith") | 75–85 | Allows middle initial variation, title differences |
| First name only | 80–90 | Less context; require closer match |
| Last name only | 85–92 | Critical identifier; be stricter |
| Display name (formatted) | 75–85 | May include titles, formatting differences |

**Examples:**

| String 1 | String 2 | Score | Match? (threshold 80) |
|----------|----------|-------|-----------------------|
| John Smith | John Smith | 100 | Yes |
| John Smith | J. Smith | 85 | Yes |
| John Smith | Smith, John | 95 | Yes |
| Dr. John Smith | John Smith Jr. | 88 | Yes |
| John Smith | Jane Smith | 50 | No |
| John A. Smith | John B. Smith | 92 | Yes |
| William Johnson | Bill Johnson | 90 | Yes (nickname match) |

**When to use:**
- Comparing `name`, `displayName`, `firstname`, `lastname` attributes
- You expect name variations (order, titles, middle initials)
- Cultural diversity in names

**When NOT to use:**
- Non-name fields (email, address, etc.) → use other algorithms
- You need exact or near-exact matches → use Jaro-Winkler with high threshold

### Jaro-Winkler

**Purpose:** General-purpose string similarity with emphasis on prefix matching.

**How it works:**
- Calculates Jaro distance (transpositions and character matches)
- Applies prefix weighting (first 4 characters heavily weighted)
- Results in score 0–100 (higher = more similar)

**Recommended thresholds:**

| Use case | Threshold | Rationale |
|----------|-----------|-----------|
| Email address | 90–95 | Should be nearly exact; prefix (before @) important |
| Username | 92–98 | Critical identifier; little tolerance for variation |
| Employee ID / badge number | 95–100 | Must be nearly exact |
| Phone number (normalized) | 85–92 | Some tolerance for formatting |
| Short text fields (5–15 chars) | 85–90 | Suitable for short strings |

**Prefix weighting example:**

| String 1 | String 2 | Score | Note |
|----------|----------|-------|------|
| john.smith@company.com | john.smyth@company.com | 95 | High due to strong prefix match |
| john.smith@company.com | jane.smith@company.com | 82 | Lower due to prefix mismatch (john vs jane) |
| smithj@company.com | smithjo@company.com | 97 | Very close; prefix nearly identical |

**When to use:**
- Email addresses (prefix before @ is critical)
- Usernames, employee IDs (should be nearly exact)
- Short text with potential typos
- When beginning of string is more important than end

**When NOT to use:**
- Long text (addresses, descriptions) → use Dice
- Phonetic matching needed → use Double Metaphone
- Name variations (order, titles) → use Enhanced Name Matcher

### Dice (Sørensen-Dice coefficient)

**Purpose:** Bigram-based similarity for longer text strings.

**How it works:**
- Breaks each string into bigrams (2-character sequences)
  - Example: "hello" → ["he", "el", "ll", "lo"]
- Calculates: `2 * (shared bigrams) / (total bigrams in both strings)`
- Converts to 0–100 scale

**Recommended thresholds:**

| Use case | Threshold | Rationale |
|----------|-----------|-----------|
| Address (street, city, full) | 70–80 | Allows reordering, abbreviations |
| Job title | 72–82 | Tolerates slight wording differences |
| Department name | 75–85 | Moderate strictness |
| Longer text fields (>20 chars) | 70–80 | Good for substring/phrase matching |

**Examples:**

| String 1 | String 2 | Score | Match? (threshold 75) |
|----------|----------|-------|-----------------------|
| 123 Main Street | 123 Main St | 88 | Yes |
| Senior Software Engineer | Software Engineer | 78 | Yes |
| Engineering Department | Engineering Dept | 85 | Yes |
| 123 Main Street Apt 4B | 123 Main St Unit 4B | 82 | Yes |
| New York | Los Angeles | 42 | No |

**When to use:**
- Addresses (street, city, full address)
- Job titles
- Department names
- Any text field >15–20 characters
- When substring/phrase matching is important

**When NOT to use:**
- Names (cultural variations) → use Enhanced Name Matcher
- Short strings (<10 chars) → use Jaro-Winkler
- Phonetic matching → use Double Metaphone

### Double Metaphone

**Purpose:** Phonetic algorithm that generates pronunciation codes for strings.

**How it works:**
- Generates one or two phonetic codes for each string
- Codes represent pronunciation (not spelling)
- Compares codes for similarity
- Language rules: English-centric (handles some European languages)

**Recommended thresholds:**

| Use case | Threshold | Rationale |
|----------|-----------|-----------|
| First name (phonetic) | 75–85 | Allow phonetic variations |
| Last name (phonetic) | 80–88 | More critical; be slightly stricter |
| Full name (phonetic) | 75–85 | Combined phonetic matching |

**Examples:**

| String 1 | String 2 | Phonetic match? | Score (approx) |
|----------|----------|-----------------|----------------|
| Catherine | Katherine | Yes (both → "K0RN") | 90 |
| John | Jon | Yes (both → "JN") | 95 |
| Smith | Smyth | Yes (both → "SM0") | 92 |
| Stephen | Steven | Yes (both → "STFN") | 88 |
| Philip | Phillip | Yes (both → "FLP") | 90 |
| Garcia | Garsia | Yes | 85 |
| McDonald | MacDonald | Yes | 88 |

**When to use:**
- Names with known spelling variations
- International names with multiple spellings
- When pronunciation matters more than spelling
- Complementary to Enhanced Name Matcher for difficult cases

**When NOT to use:**
- Email addresses, IDs (spelling is exact)
- Non-name fields
- Very short strings (<4 characters) → less reliable
- Non-English names (algorithm is English-centric)

### Custom (from SaaS customizer)

**Purpose:** Domain-specific matching logic implemented in a [SailPoint SaaS Connectivity Customizer](https://developer.sailpoint.com/docs/connectivity/saas-connectivity/customizers).

**When to use:**
- None of the built-in algorithms fit your needs
- You have proprietary matching logic (e.g., industry-specific identifiers)
- You need to call external APIs for matching (e.g., third-party identity resolution service)
- Complex business rules (e.g., "match if first 3 chars + last 2 chars identical")

**Implementation:**
- Develop custom algorithm in a [Connectivity Customizer](https://developer.sailpoint.com/docs/connectivity/saas-connectivity/customizers)
- Return similarity score 0–100
- Configure as "Custom" in Fusion attribute match

**Examples:**
- Parse and compare structured employee IDs (e.g., "EMP-2024-001234")
- Call external identity verification service
- Apply industry-specific matching rules (healthcare NPI, financial institution codes)

---

## Configuring attribute matches

### Configuration fields

For each **Fusion attribute match**, configure:

| Field | Purpose | Options / Notes |
|-------|---------|-----------------|
| **Attribute** | Identity attribute name to compare | Must exist on identities in scope; examples: `name`, `email`, `firstname`, `lastname`, `displayName` |
| **Matching algorithm** | Algorithm to calculate similarity | Enhanced Name Matcher, Jaro-Winkler, Dice, Double Metaphone, Custom |
| **Similarity score [0-100]** | Minimum score for this attribute | Per-attribute threshold (optional if using overall score mode) |
| **Mandatory match?** | Require this attribute to match | Yes = this attribute must meet its threshold or match fails; when no attribute is mandatory, all attributes are treated as mandatory |

### Single attribute vs multi-attribute matching

| Strategy | Configuration | Use when |
|----------|---------------|----------|
| **Single attribute** | One Fusion attribute match (e.g., name only) | Simple matching; one strong identifier |
| **Multi-attribute (OR logic)** | Multiple matches, low overall threshold | Any attribute can indicate duplicate |
| **Multi-attribute (AND logic)** | Multiple matches, all with per-attribute thresholds or high overall threshold | All attributes must agree for high confidence |
| **Hybrid** | Some mandatory, some optional | Critical attribute (email) must match; others (name, phone) support decision |

**Example configurations:**

```
Configuration 1: Name-only matching (simple)
- Attribute: name
- Algorithm: Enhanced Name Matcher
- Score: 85
→ Only name used; must score ≥85

Configuration 2: Name + email (balanced)
- Attribute: name, Algorithm: Enhanced Name Matcher, Score: 80
- Attribute: email, Algorithm: Jaro-Winkler, Score: 90
- Overall score: No (per-attribute mode)
→ Both must pass their thresholds

Configuration 3: Strict email + supporting name
- Attribute: email, Algorithm: Jaro-Winkler, Score: 95, Mandatory: Yes
- Attribute: name, Algorithm: Enhanced Name Matcher, Score: 75, Mandatory: No
→ Email must match; name optional but helps

Configuration 4: Comprehensive (overall score)
- Attribute: firstname, Algorithm: Enhanced Name Matcher
- Attribute: lastname, Algorithm: Enhanced Name Matcher
- Attribute: email, Algorithm: Jaro-Winkler
- Use overall score: Yes, Threshold: 80
→ Average of all three must be ≥80
```

---

## Scoring modes: Overall vs per-attribute

### Per-attribute scoring (default)

**Configuration:** **Use overall fusion similarity score for all attributes?** = No

**Logic:**
- Each attribute match has its own **Similarity score [0-100]** threshold
- A **mandatory** attribute must always meet or exceed its threshold or the match fails
- Identity is flagged as potential duplicate if:
  - Every mandatory attribute meets its threshold, and
  - When no attribute is marked mandatory: **all** attributes are treated as mandatory (all must meet their thresholds)
  - When at least one attribute is mandatory: those must pass; non-mandatory attributes contribute to the match but their thresholds are also enforced for a pass

**Advantages:**
- Fine control per attribute
- Different thresholds for different attribute importance
- Explicit mandatory vs optional attributes

**Disadvantages:**
- More complex to configure
- Harder to reason about combined effect

**Example:**

```
Configuration:
- name: threshold 80, score 85 → Pass
- email: threshold 90, score 88 → Fail
Result: Not a match (email failed)

Configuration with mandatory:
- email: threshold 95, mandatory Yes, score 96 → Pass
- name: threshold 80, mandatory No, score 70 → Fail (but not mandatory)
Result: Match (email passed, name optional)
```

### Overall scoring

**Configuration:** **Use overall fusion similarity score for all attributes?** = Yes

**Logic:**
- Average of all attribute similarity scores → overall score
- Identity is flagged if overall score ≥ global **Similarity score [0-100]**
- When average is enabled, only the overall threshold must be met; individual (non-mandatory) attribute thresholds may not be met

**Advantages:**
- Simple to understand and configure
- One threshold to tune
- All attributes equally weighted

**Disadvantages:**
- Cannot prioritize certain attributes
- Low score on one attribute can be offset by high scores on others

**Example:**

```
Configuration:
- Overall threshold: 80

Scores:
- name: 85
- email: 90
- phone: 70
Overall: (85 + 90 + 70) / 3 = 81.67 → Pass (≥80)

Scores (different case):
- name: 95
- email: 95
- phone: 50
Overall: (95 + 95 + 50) / 3 = 80 → Pass (≥80)
→ Note: Phone is 50 (very low) but offset by name+email
```

### Which mode to use?

| Choose per-attribute if... | Choose overall if... |
|----------------------------|----------------------|
| Attributes have different importance | All attributes equally important |
| You want explicit mandatory matches | Simpler configuration preferred |
| Fine control needed | Starting out / testing |
| Some attributes are critical (email), others supporting (phone) | You want aggregate view of similarity |

---

## Tuning thresholds

### Initial thresholds (starting points)

| Attribute type | Algorithm | Starting threshold | Adjust if... |
|---------------|-----------|-------------------|--------------|
| Full name | Enhanced Name Matcher | 80 | Too many false positives → 85; missing duplicates → 75 |
| First name | Enhanced Name Matcher | 85 | Too strict → 80; too loose → 90 |
| Last name | Enhanced Name Matcher | 88 | Missing matches → 85; false positives → 92 |
| Email | Jaro-Winkler | 92 | Very strict domain → 95; relaxed → 88 |
| Username | Jaro-Winkler | 95 | Nearly exact needed → 98 |
| Phone | Jaro-Winkler | 88 | After normalization |
| Address | Dice | 75 | Strict → 80; relaxed → 70 |
| Job title | Dice | 78 | Strict → 82; relaxed → 73 |

### Tuning workflow

| Phase | Action | Goal | Metrics |
|-------|--------|------|---------|
| **1. Baseline** | Use starting thresholds from table above | Conservative; low false positive rate | Review 10–20 initial matches manually |
| **2. Test with sample** | Run on 100–500 accounts | Assess match quality | False positive rate, false negative rate |
| **3. Analyze results** | Review all generated forms | Identify patterns | Are false positives due to one attribute? |
| **4. Adjust thresholds** | Increase (stricter) or decrease (looser) | Balance precision vs recall | Target: <10% false positive rate |
| **5. Retest** | Run on same or different sample | Validate improvements | Compare metrics to phase 2 |
| **6. Production** | Remove sample limits | Full deployment | Monitor ongoing |

### Balancing precision and recall

| Scenario | Symptom | Adjustment |
|----------|---------|------------|
| **High false positives** | Many forms for obvious non-duplicates | Raise thresholds; add mandatory matches for critical attributes |
| **High false negatives** | Missing obvious duplicates | Lower thresholds; add more attributes; try different algorithms |
| **Borderline cases** | Many ambiguous matches | Enable **Automatically correlate if identical?** for obvious ones; manual review for borderline |

**Screenshot placeholder:** Review form showing per-attribute similarity scores.

![Similarity scores on review form - Detail view](../assets/images/matching-algorithms-scores-form.png)
<!-- PLACEHOLDER: Screenshot of review form showing per-attribute similarity scores. Save as docs/assets/images/matching-algorithms-scores-form.png -->

---

## Auto-correlation

### When to use

**Automatically correlate if identical?** = Yes

**Effect:** Identities that meet similarity criteria and are "effectively identical" are auto-correlated without manual review.

| Enable when... | Keep disabled when... |
|----------------|----------------------|
| Thresholds are well-tuned | Initial setup / testing |
| False positive rate is <5% | High-risk merges (finance, healthcare) |
| Review burden is high (>50 forms/week) | You want manual approval for all merges |
| Obvious duplicates are common | Data quality is poor |

**When auto-correlation runs:** When **Automatically correlate if identical?** is enabled, the connector skips the review form and performs the Fusion assignment directly when **all** attribute similarity scores for the best match are **100** (perfect match). No manual review is required in that case.

---

## Common matching patterns

### Pattern 1: Conservative (high confidence only)

**Goal:** Only flag very obvious duplicates; minimize false positives.

```
- Attribute: email, Algorithm: Jaro-Winkler, Score: 95, Mandatory: Yes
- Attribute: name, Algorithm: Enhanced Name Matcher, Score: 88
→ Email must nearly match; name must also be very close
```

**Use case:** High-risk environments (financial, healthcare); initial rollout.

### Pattern 2: Balanced (moderate confidence)

**Goal:** Balance between catching duplicates and avoiding false positives.

```
- Attribute: name, Algorithm: Enhanced Name Matcher, Score: 80
- Attribute: email, Algorithm: Jaro-Winkler, Score: 85
- Overall score: No (per-attribute mode)
→ Both must meet thresholds
```

**Use case:** General corporate environments; standard data quality.

### Pattern 3: Aggressive (catch more duplicates)

**Goal:** Flag potential duplicates even with lower confidence; accept some false positives.

```
- Attribute: firstname, Algorithm: Enhanced Name Matcher, Score: 75
- Attribute: lastname, Algorithm: Enhanced Name Matcher, Score: 78
- Attribute: email, Algorithm: Jaro-Winkler, Score: 70
- Overall score: Yes, Threshold: 75
→ Relaxed thresholds; overall average
```

**Use case:** Poor data quality; many known duplicates; strong review team.

### Pattern 4: Phonetic (spelling variations)

**Goal:** Catch names with different spellings but same pronunciation.

```
- Attribute: name, Algorithm: Double Metaphone, Score: 80
- Attribute: email, Algorithm: Jaro-Winkler, Score: 85, Mandatory: Yes
→ Phonetic name match + email confirmation
```

**Use case:** International names; known spelling variations; diverse workforce.

### Pattern 5: Hybrid (critical + supporting)

**Goal:** One critical mandatory attribute plus supporting optional attributes.

```
- Attribute: employeeId, Algorithm: Jaro-Winkler, Score: 98, Mandatory: Yes
- Attribute: name, Algorithm: Enhanced Name Matcher, Score: 75, Mandatory: No
- Attribute: email, Algorithm: Jaro-Winkler, Score: 80, Mandatory: No
→ Employee ID must match; name and email provide additional confidence
```

**Use case:** Strong business key exists; other attributes support verification.

---

## Troubleshooting matching issues

| Issue | Possible cause | Solution |
|-------|----------------|----------|
| **No matches found** | Thresholds too high | Lower by 5–10 points; check if attributes exist on identities |
| **Too many false positives** | Thresholds too low; wrong algorithm | Raise thresholds; add mandatory match for critical attribute; switch algorithm |
| **Name matches fail** | Title/order differences; wrong algorithm | Use Enhanced Name Matcher (not Jaro-Winkler) for names |
| **Email matches fail** | Case sensitivity; domain differences | Normalize email to lowercase; check domain importance |
| **Inconsistent results** | Missing or null attribute values | Verify attributes exist and are populated on all identities |
| **Algorithm seems wrong** | Mismatched algorithm for attribute type | Review algorithm selection guide above |

---

## Summary and decision guide

### Quick algorithm selection

| Attribute | Recommended algorithm | Threshold range |
|-----------|----------------------|-----------------|
| Full name, display name | Enhanced Name Matcher | 75–85 |
| First name, last name | Enhanced Name Matcher | 80–92 |
| Email | Jaro-Winkler | 90–95 |
| Username, employee ID | Jaro-Winkler | 95–100 |
| Phone (normalized) | Jaro-Winkler | 85–92 |
| Address | Dice | 70–80 |
| Job title, department | Dice | 72–85 |
| Name (phonetic) | Double Metaphone | 75–85 |

### Key principles

1. **Start conservative** — High thresholds initially; lower as you gain confidence
2. **Use appropriate algorithms** — Names (Enhanced Name Matcher), short text (Jaro-Winkler), long text (Dice), phonetic (Double Metaphone)
3. **Test with samples** — Don't run on full dataset until thresholds are tuned
4. **Monitor and adjust** — Track false positive/negative rates; iterate
5. **Balance precision and recall** — Lower thresholds catch more duplicates but increase false positives
6. **Consider auto-correlation** — Enable after tuning to reduce manual review burden

**Next steps:**
- For full deduplication setup, see [Identity Fusion for deduplication](deduplication.md).
- For attribute merging and mapping, see [Effective use of attribute management](attribute-management.md).
