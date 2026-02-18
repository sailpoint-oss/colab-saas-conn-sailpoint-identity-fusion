# Account Enable Operation

## Description

The Account Enable operation re-enables a previously disabled fusion account. This process is more complex than a simple flag flip because re-enabling an account might require re-generating unique values (like email aliases) that were released when the account was disabled.

## Process Flow

1.  **Setup**:
    - Loads sources and schema.
    - Initializes attribute counters.

2.  **Global Pre-processing**:
    - **Crucial Step**: Fetches and pre-processes **ALL** fusion accounts.
    - Registers all currently used unique attribute values.
    - _Why?_ To ensure that when we re-enable this account, we don't assign it a unique value (e.g., `john.doe@example.com`) that has been taken by another account while this one was disabled.

3.  **Fusion Account Rebuild**:
    - Rebuilds the target fusion account.
    - **Configuration**:
        - `refreshMapping`: True.
        - `refreshDefinition`: True.
        - `resetDefinition`: **True** (forces a complete re-calculation of attributes to ensure uniqueness).

4.  **Enable**:
    - Sets the account's status to enabled.

5.  **Output Generation**:
    - Returns the updated, enabled ISC account.

## Behavior Notes

-   **Unique attribute reset**: Enabling a Fusion account sets `resetDefinition: true`, which unregisters the account's existing unique attribute values and regenerates them. This guarantees that the re-enabled account receives collision-free values even if its previous values were reassigned to other accounts while it was disabled.
-   **Changeable unique attributes**: Use regular unique attribute schemas (e.g. usernames, email aliases) to define attributes you want refreshed on enable/disable cycles. Disabling and then re-enabling a Fusion account is the mechanism that triggers this regeneration.
-   **nativeIdentity and name are preserved**: Even though unique attributes are reset, the `nativeIdentity` and account `name` are never changed. The attribute definition engine skips them for identity-linked accounts to prevent disconnection and identity destruction.
