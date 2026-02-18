# Account Read Operation

## Description

The Account Read operation retrieves the current state of a specific fusion account. Crucially, it **rebuilds** the fusion account from its constituent parts (source accounts and identity data) to ensuring the returned data is fresh and reflects the latest configuration.

## Process Flow

1.  **Input Validation**:
    - Verifies that the `identity` (ID) is provided.
    - Loads all sources and the fusion account schema.

2.  **Fusion Account Rebuild**:
    - Calls the `rebuildFusionAccount` helper.
    - **Fetch**: Loads the stored fusion account definition, the authoritative identity, and all linked managed accounts (from source systems).
    - **Process**: Re-runs the fusion logic to map attributes, apply transforms, and generate values.
    - **Configuration**:
        - `refreshMapping`: True (re-evaluates attribute mappings).
        - `refreshDefinition`: True (updates the internal fusion definition).
        - `resetDefinition`: False (does NOT clear existing values before processing, preserving manual overrides if any).

3.  **Output Generation**:
    - Converts the rebuilt fusion account into an ISC account object.
    - Returns the fresh account state to ISC.
