# ADR 0001: Patient-Facing Inline Confirmation for Low-Confidence Extractions

## Status
Proposed (Pending Milestone 2 Approval)

## Context
In the original product spec, low-confidence prescription extractions (confidence score `< 85%` or unresolved brand-to-generic mappings) were routed to an Admin Review Queue for clinical reviewers to correct before publication.

In Milestone 2 (v2), the Admin Review Queue is completely cut from scope (no admin routes, screens, or queue workflows are built). This leaves low-confidence extractions without a review system, which would either lead to siloing unmapped medications or publishing clinical-risk data automatically without verification.

## Decision
We will surface a "please confirm/correct these details" inline UI state directly to the patient during the Prescription Upload flow. 

When an uploaded prescription returns a confidence score under 85% or does not resolve to a generic active pharmaceutical ingredient:
1. The application displays a side-by-side view showing the uploaded raw prescription image and the best-guess fields.
2. The user is prompted to verify and correct key fields (brand name, dosage, frequency, generic name).
3. If the user corrects/confirms a brand name mapping, the frontend submits the correction, which is written to the append-only `brand_generic_map` database table under `source = 'user_confirmed'`.
4. The finalized medicine is then saved as `'active'` with a resolution status of `'manually_resolved'`.

## Consequences
- **Consolidated Flow**: Eliminates the need for any administrative backend/screens in Phase 1.
- **Patient Empowerment**: Puts control of data accuracy directly in the hands of the patient, who is highly motivated to get it right.
- **DPDP Compliance**: Follows DPDP-aligned consent principles by asking patients to explicitly verify the data being recorded.
- **Verification Risk**: Relies on patient accuracy rather than clinical reviewer oversight (mitigated by highlighting that they should review the original bottle/prescription).
