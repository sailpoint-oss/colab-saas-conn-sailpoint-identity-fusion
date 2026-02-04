# Migration from Previous Identity Fusion Versions

This guide describes how to migrate from an earlier Identity Fusion connector to **Identity Fusion NG** with minimal disruption. The approach uses the existing (old) Fusion source as a **managed source** in the new setup, validates new accounts, then migrates identities to a new profile before decommissioning the old one.

> **Video walkthrough:** A step-by-step migration demo is available on YouTube: [https://youtu.be/Gy4eiSgtq_0](https://youtu.be/Gy4eiSgtq_0).

---

## Overview

| Phase                                                               | Goal                                                                                                                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Add Identity Fusion NG with old source only**                  | New Fusion source uses the old Fusion as the **only** managed source; no identity scope, no attribute definitions, no reviewers, no automatic reports, no Fusion settings. |
| **2. Discover schema and aggregate once**                           | Ensure mappings are in place; run **Discover Schema** and select the correct ID and name attributes; run aggregation once to validate new Fusion accounts.                 |
| **3. Replace old source with originals; add attribute definitions** | Remove the old Fusion from the source list and add the original managed sources. Configure Attribute Definitions as needed (account ID/name, etc.); aggregate again.       |
| **4. New identity profile with higher priority**                    | Create a new identity profile for Identity Fusion NG with **higher priority** than the original Fusion identity profile.                                                   |
| **5. Identity refresh**                                             | Run an identity refresh so existing Fusion identities migrate to the new profile. Account migration complete.                                                              |
| **6. Finish Fusion settings**                                       | Configure Fusion settings (matching, review) and any other tweaks.                                                                                                         |
| **7. Decommission**                                                 | Once migration is verified, decommission the old identity profile and the old Fusion source.                                                                               |

---

## Prerequisites

- Identity Fusion NG connector available in your ISC tenant (uploaded via SailPoint CLI or your organization’s process).
- Existing Identity Fusion (legacy) source and identity profile in place.
- Access to modify sources, identity profiles, and to run aggregation and identity refresh.

---

## Phase 1: Add Identity Fusion NG with the old source only

1. **Create a new source** in ISC using the **Identity Fusion NG** connector.
    - Do **not** mark it Authoritative yet (you will use it in attribute-generation style first to onboard accounts from the old Fusion).
2. **Configure Connection Settings** (ISC API URL, Personal Access Token).
3. **Source Settings → Scope**
    - Set **Include identities in the scope?** to **No**. No identities in scope for this phase.
4. **Source Settings → Sources**
    - Add the **old Identity Fusion source** as the **only** **Authoritative account sources** entry.
    - Configure **Source name** to match the old Fusion source name in ISC exactly (case-sensitive).
    - Ensure **Attribute Mappings** are in place for the attributes you need.
5. **Do not configure** at this stage:
    - **Attribute Definitions** — leave these unconfigured for now.
    - **Fusion Settings** (Matching or Review).
    - Yourself as a reviewer or **Owner is global reviewer?**.
    - **Automatic reports**.

**Result:** Identity Fusion NG reads only from the old Fusion source, with mappings in place but no attribute definitions, reviewers, or Fusion settings.

---

## Phase 2: Discover schema and aggregate once

1. **Run Discover Schema** on the new Identity Fusion NG source.
2. **Select the correct ID and name attributes** for the account schema (e.g. native identity, display attribute).
3. **Run account aggregation** on the **Identity Fusion NG** source.
    - Ensure the old Fusion source has been aggregated recently (or run its aggregation first) so the new connector has up-to-date managed accounts to process.
4. **Verify in ISC**
    - Check that Fusion accounts are created on the new source.
    - Spot-check account attributes, links to managed accounts, and identifiers to ensure they look correct.

**Result:** New Fusion accounts exist and look good. You are ready to switch to the original sources and add attribute definitions.

---

## Phase 3: Replace old source with originals; add attribute definitions

1. **Update Source Settings → Sources**
    - **Remove** the old Fusion source from the source list.
    - **Add** the original managed account sources you used in production.
2. **Configure Attribute Definitions** as you see fit (e.g. for account ID, account name, or other attributes you wish to generate).
3. **Run aggregation again** on the Identity Fusion NG source.
4. **Verify** that the new accounts look good with the original sources and attribute definitions in place.

**Result:** Identity Fusion NG now uses the original managed sources and generates accounts with your chosen attribute definitions. Ready to migrate identities.

---

## Phase 4: New identity profile with higher priority

1. **Create a new identity profile** that uses the **Identity Fusion NG** source.
    - Configure lifecycle states, provisioning policies, and attribute mapping as required (aligned with how you use the old Fusion profile).
2. **Set this new identity profile’s priority higher than the original Fusion identity profile.**
    - In ISC, identity profile priority determines which profile owns an identity when multiple profiles could apply. By giving the new profile **higher priority**, a subsequent identity refresh will cause existing Fusion identities (currently on the old profile) to be evaluated against the new profile first and migrate to it when they match the new profile’s source/conditions.

**Result:** The new Identity Fusion NG profile exists and has higher priority than the old Fusion profile, so identities can move to it during refresh.

---

## Phase 5: Identity refresh to migrate identities

1. **Run an identity refresh** (organization-wide or scoped as appropriate).
    - Identities that match the new identity profile (and are now covered by its higher priority) will be **migrated to the new Identity Fusion NG profile**.
2. **Verify**
    - Confirm that identities that were previously on the old Fusion profile are now on the new profile and that their accounts and attributes are correct.
    - Check that no identities are left incorrectly on the old profile if they should have moved.

**Result:** Account migration is complete. Existing Fusion identities have been moved to the new Identity Fusion NG identity profile.

---

## Phase 6: Finish Fusion settings and tweaks

With account migration complete, configure the remaining settings:

1. **Configure Fusion Settings** (Matching and Review) as described in [Identity Fusion for deduplication](deduplication.md).
2. **Configure any other tweaks** you want to introduce (identity scope, review forms, automatic reports, etc.).
3. **Optional:** If the new source should own the identity list, mark the Identity Fusion NG source as **Authoritative** and adjust the identity profile as needed.

**Result:** Identity Fusion NG is fully configured and ready for production use.

---

## Phase 7: Decommission the old profile and old Fusion source

1. **Confirm migration**
    - No critical identities remain on the old Fusion identity profile (or only those you intend to handle separately).
    - Reporting, access, and provisioning behaviors that depended on the old Fusion are now satisfied by the new Fusion source and profile.
2. **Decommission the old identity profile**
    - Remove or deactivate the old Identity Fusion identity profile per your change process.
3. **Decommission the old Fusion source**
    - Remove or deactivate the old Identity Fusion source and connector when it is no longer needed.

**Result:** The previous Identity Fusion version is retired; Identity Fusion NG is the single Fusion source and profile in use.

---

## Summary

| Step | Action                                                                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Add Identity Fusion NG source; add old Fusion as the **only** managed source; mappings in place; **no** attribute definitions, reviewers, automatic reports, or Fusion settings. |
| 2    | Run **Discover Schema**; select correct ID and name attributes; run aggregation once; validate new Fusion accounts.                                                              |
| 3    | **Replace** old Fusion with original sources; configure **Attribute Definitions**; run aggregation again; verify accounts.                                                       |
| 4    | Create a new identity profile for Identity Fusion NG with **higher priority** than the old Fusion profile.                                                                       |
| 5    | Run **identity refresh** to migrate existing Fusion identities. Account migration complete.                                                                                      |
| 6    | Finish configuring **Fusion settings** (matching, review) and any other tweaks.                                                                                                  |
| 7    | After verification, decommission the old identity profile and old Fusion source.                                                                                                 |

**Next steps:**

- For attribute generation and mapping, see [Attribute generation](attribute-generation.md) and [Attribute management](attribute-management.md).
- For deduplication after migration, see [Identity Fusion for deduplication](deduplication.md).
- For connection and tuning, see [Advanced connection settings](advanced-connection-settings.md) and [Troubleshooting](troubleshooting.md).
