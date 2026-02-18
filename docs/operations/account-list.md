# Account List Operation

## Description

The Account List operation is the main entry point for identity fusion. It performs a full aggregation of all fusion accounts, identities, and managed accounts. It uses a "Work Queue" pattern to process accounts efficiently, deduplicate data, and handle complex logic like unique attribute generation, form state reconciliation, and reporting.

## Process Flow

1.  **Setup & Initialization**:
    - Loads all managed sources.
    - Acquires a **process lock** to prevent concurrent aggregations.
    - Checks for a "Reset" flag; if detected, it clears existing forms and resets state instead of performing aggregation.
    - Sets the fusion account schema.
    - Aggregates all managed sources to build the initial pool of accounts.
    - Initializes attribute counters.

2.  **Data Fetching (Parallel)**:
    - Fetches the following data in parallel to optimize performance:
        - Existing fusion accounts.
        - Identities (from ISC).
        - Managed accounts (from source systems).
        - Message sender configuration.
        - Pending form data.

3.  **Fusion Account Processing** (attribute mapping + normal definitions):
    - Processes all _existing_ fusion accounts. This step "depletes" the matching managed accounts from the work queue (the map of all managed accounts).
    - For each account: attribute mapping is applied first, then **normal** attribute definitions are evaluated. Normal attribute values feed into the Velocity context and are available for Fusion matching/scoring.

4.  **Identity Processing** (attribute mapping + normal definitions):
    - Processes all _identities_. This creates new fusion identities for identities that don't yet have a fusion account but should.
    - Same attribute mapping + normal definition evaluation as step 3.
    - Clears the identity cache to free up memory as it's no longer needed.

5.  **New Identity Decisions**:
    - Processes "decisions" related to new identities, handling cases where a new identity was discovered or manually approved.

6.  **Managed Account Processing (Deduplication)**:
    - Processes any remaining managed accounts in the work queue.
    - These are accounts that were _not_ matched to an existing fusion account or an identity.
    - This step handles deduplication and creating "standalone" accounts if configured.

7.  **Form & Entitlement Reconciliation**:
    - Reconciles pending form states.
    - Calculates transient entitlements derived from forms (e.g., "candidate" status or pending reviews).

8.  **Unique Attribute Refresh** (unique definitions — runs after all matching):
    - Performs a global refresh of **unique** attributes for all fusion accounts (both existing and newly created).
    - Unique definitions run _after_ Fusion matching has completed, so they can reference normal attribute values produced in steps 3–6.
    - Ensures uniqueness constraints are met across the entire dataset.

9.  **Reporting (Conditional)**:
    - If `fusionReportOnAggregation` is enabled, generates a fusion report for the fusion owner.

10. **State Saving & Cleanup**:
    - Saves attribute generation state (counters).
    - Saves batch cumulative counts.
    - Clears analyzed account caches and manages form cleanup.

11. **Output Generation**:
    - Iterates through all processed fusion accounts and sends them to ISC.
    - Accounts whose fusion identity attribute is empty are omitted when "Skip accounts with a missing identifier" is enabled (see Behavior Notes).
    - Releases the process lock.

## Behavior Notes

### Attribute evaluation order

Normal attributes are created **before** Fusion matching occurs (steps 3–6). Unique attributes are evaluated **after** all matching is complete (step 8). Attribute definitions can access previously defined attributes via the shared Velocity context, so definition order matters. Unique attributes can reference normal attribute values, but normal attributes cannot reference unique attributes because of the order in which they are calculated.

### Attribute mapping and unique definition synergy

Attribute mapping can be used in conjunction with unique attribute definitions to preload attributes from existing managed accounts, identities, and Fusion accounts into the Velocity context. The unique attribute definition then runs and sets a value guaranteed to be different from any other account or identity.

### Preventing Fusion account creation (empty nativeIdentity skip pattern)

One can purposely generate an empty `nativeIdentity` (by designing attribute definitions that produce an empty fusion identity attribute) in conjunction with the "Skip accounts with a missing identifier" processing option. When the fusion identity attribute evaluates to empty and the skip option is enabled, the account is omitted from the output, effectively preventing specific managed accounts or identities from generating Fusion accounts.
