# Entitlement List Operation

## Description

The Entitlement List operation returns available entitlements for the fusion connector. It supports two types of entitlements: "status" (static) and "action" (dynamic).

## Process Flow

1.  **Input Analysis**:
    - Checks the requested `type` of entitlement.

2.  **Status Entitlements**:
    - If `type` is "status":
    - Returns a static list of status values (e.g., "active", "disabled").
    - _Note_: Status entitlements are static and **not** requestable.

3.  **Action Entitlements**:
    - If `type` is "action":
    - Fetches all managed sources.
    - Returns a list of available actions (e.g., "fusion", "report", "correlate").
    - **Report Entitlement**:
        - Can be requested to generate a report of the potential aggregated results without actually aggregating the source.
        - This entitlement must be made available to users through an access profile. The connector deliberately omits this entitlement from the target account so it can be requested multiple times.
    - _Note_: Actions are modeled as entitlements so they can be requested via access requests in ISC. All Action entitlements are requestable.

4.  **Output**:
    - Returns the list of entitlements.
