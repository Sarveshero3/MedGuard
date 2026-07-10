# MedGuard

An AI medication safety and visit-preparation platform that assists chronic-condition patients and their long-distance family caregivers in monitoring medication safety and tracking health trends across multiple doctors.

## Language

**Brand-to-Generic Resolution**:
The process of mapping a commercial brand name (e.g., "Dolo 650") to its underlying generic active pharmaceutical ingredient (e.g., "Paracetamol") prior to executing interaction safety checks.
_Avoid_: Brand mapping, molecule translation

**Interaction Knowledge Base (interaction_kb)**:
A versioned, append-only reference database of known drug-drug interaction pairs and severity ratings used to determine if a combination of active generics poses a clinical risk.
_Avoid_: Drug database, safety list

**Confidence Tiers**:
The classification scale used to route LLM-extracted medicine and dosage data (high confidence >=85% processed automatically, low confidence <85% routed to clinical review).
_Avoid_: Accuracy scores, rating levels

**Caregiver Permission Tiers**:
The access levels granted to a linked caregiver by a patient, specifying whether they can view the entire medical record (Full View) or only active interaction notifications (Alerts-Only).
_Avoid_: Caregiver roles, access modes

**Generic Unresolved Flag (generic_unresolved)**:
A status flag applied to an extracted medicine name when it cannot be successfully mapped to a known molecule in the brand-to-generic database, routing the entry to the admin review queue.
_Avoid_: Unmapped status, failed resolution

**DPDP-Aligned Consent**:
Explicit, affirmative opt-in agreement for health data collection and processing, logged with audit trials and accompanied by a clean deletion path, to satisfy the Digital Personal Data Protection Act requirements.
_Avoid_: User consent, terms and conditions agreement
