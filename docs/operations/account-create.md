# Account Create Operation

## Description

The Account Create operation creates a new fusion account for a specific identity. It loads the identity's data, registers any unique attributes to prevent collisions, processes the identity to form a fusion account, executes any requested initial actions (like reporting or correlation), and returns the resulting ISC account.

## Process Flow

1.  **Input Validation**:
    - Verifies that the `identity` (ID) and `schema` are provided in the input.
    - Loads the fusion account schema.
    - Determines the `identityName` from `input.attributes.name` or the `identity` ID.
    - Verifies that the `fusionDisplayAttribute` is present in the schema.
    - Resolves the final `identityName` using the display attribute if available.

2.  **Identity Fetching**:
    - Fetches the authoritative identity information from ISC using the resolved `identityName`.
    - Ensures the identity exists and has a valid ID.

3.  **Fusion Account Pre-processing**:
    - Fetches all existing fusion accounts from sources.
    - Initializes attribute counters for unique value generation.
    - Pre-processes all existing fusion accounts to register their unique attribute values, ensuring new accounts don't collide with existing ones.

4.  **Identity Processing**:
    - Processes the fetched identity to create an in-memory fusion identity.
    - Refreshes unique attributes for this new fusion identity, generating new unique values if necessary (e.g., email aliases).

5.  **Action Execution**:
    - Checks for any actions specified in `input.attributes.actions`.
    - Executes supported actions sequentially:
        - **Report**: Generates a fusion report (if configured).
        - **Fusion**: Marks the account as a fusion account (adds the 'fusion' tag/attribute).
        - **Correlate**: Triggers correlation logic to link missing source accounts to this identity.

6.  **Response Generation**:
    - Converts the internal fusion identity into an ISC account object.
    - Returns the new account to ISC.

## Behavior Notes

-   **nativeIdentity immutability**: The `nativeIdentity` (account identifier) is determined at creation time and is never changed afterwards. This prevents disconnection between the existing Fusion account and the platform during subsequent updates, reads, or enable/disable cycles.
-   **Account name immutability**: The account `name` (display attribute) is also locked at creation. It always reflects the hosting identity's name. This prevents destruction of the identity linkage if an attribute definition would otherwise overwrite it.
-   **Unique attributes**: Unique attribute values (e.g. generated usernames) are freshly calculated during creation with collision detection against all existing Fusion accounts. These values remain stable unless the account is disabled and re-enabled (which triggers a unique attribute reset).
