# Entitlement List Operation

## Description

The Entitlement List operation returns available entitlements for the fusion connector. It supports two types of entitlements: "status" (static) and "action" (dynamic).

## Process Flow

1.  **Input Analysis**:
    - Checks the requested `type` of entitlement.

2.  **Status Entitlements**:
    - If `type` is "status":
    - Returns a static list of status values (e.g., "active", "disabled").

3.  **Action Entitlements**:
    - If `type` is "action":
    - Fetches all managed sources.
    - Returns a list of available actions (e.g., "fusion", "report", "correlate").
    - _Note_: Actions are modeled as entitlements so they can be requested via access requests in ISC.

4.  **Output**:
    - Returns the list of entitlements.
