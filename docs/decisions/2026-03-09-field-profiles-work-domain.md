# Decision: Field Profiles Driven by Work Domain, Not Institution Type

**Date:** 2026-03-09
**Status:** Accepted
**Supersedes:** 2026-03-08-field-profiles-adaptive-ui (if it exists)
**Affects:** Onboarding flow, capture type selector, objects list, settings, AI prompt templates

## Context

Register supports 7 object types (Museum Object, Site, Incident, Conservation Record, Specimen, Environmental Sample, Architectural Element). Showing all 7 to every user creates confusion. A museum registrar does not need "Incident" and a human rights investigator does not need "Museum Object."

The March 8 concept proposed tying profiles to `institution_type`, which is already collected during onboarding. This fails for non-institutional users: solo NGO field workers, freelance conservators, independent researchers, journalists. These users skip the institution field entirely. If the profile depends on institution, they get no profile.

KoboToolbox/ODK (dominant humanitarian field data tool) solves this by having admins build custom forms so field workers never make architecture decisions. Register is a fixed-form app, not a form builder. But the principle applies: ask a simple human question, then get out of the way.

## Decision

One screen during onboarding asks: "What are you documenting?"

Visual cards with icons. User taps one:

| Profile | Visible Object Types |
|---|---|
| Museum & Gallery Collections | Museum Object, Conservation Record, Architectural Element |
| Cultural Heritage & Archaeology | Site, Specimen, Environmental Sample, Museum Object |
| Human Rights & Investigations | Incident, Site, Environmental Sample |
| Conservation & Restoration | Conservation Record, Museum Object, Architectural Element |
| Scientific & Natural History | Specimen, Environmental Sample, Museum Object |
| Architecture & Built Environment | Architectural Element, Site, Conservation Record |
| General Documentation | All 7 types (catch-all) |

Institution name is collected on the next screen as optional metadata. Not the profile driver.

## What This Single Tap Controls

1. Which object types are visible in capture flow and object list
2. Default terminology (field labels adapt per profile)
3. Gemini AI prompt template (when AI integration goes live)
4. Default privacy tier and export templates

## Architecture Constraints

- All 7 types remain in the schema. Profiles are a UI filter, not a data model change.
- Objects received via sync from other institutions with "hidden" types still render correctly.
- No data loss, no blocked imports. The filter is cosmetic, not structural.
- One settings key (`work_domain`) stores the active profile. One mapping function returns visible types.
- Stored on the institution record when institution exists, on the device/user when solo.

## Settings Escape Hatch

Profile is always changeable in Settings. For v1: one profile per device. For v2: alias support (one user, multiple profiles for different institutional contexts, switchable in Settings).

## Alternatives Considered

1. **Institution type as profile driver** (March 8 concept). Rejected: fails for non-institutional users.
2. **Separate field selector + institution selector** (Michael's original tab-based approach). Rejected: two parallel systems creates confusion and maintenance burden.
3. **No profiles, show everything always.** Rejected: violates The One Rule. Museum registrars do not need to see "Incident."

## Implementation

- One mapping table (profile -> visible types)
- One settings key (`work_domain`)
- Conditional filtering in: onboarding, capture type selector, objects list, settings
- Estimated scope: half a session, Opus-level (crosses 4+ screens)
