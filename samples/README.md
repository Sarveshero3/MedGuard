# MedGuard — John Doe Clinical Test Case

## Overview
This directory contains synthetic clinical documents for end-to-end testing of MedGuard's extraction, interaction checking, and trend analysis pipelines.

**Patient Profile**: John Doe, 62M, Diabetic (Type 2) with cardiac comorbidities.

## Test Sequence

### Step 1: Upload `1.png` (Prescription)
- **Doctor**: Dr. A. K. Shastri, Endocrinology, Apollo Sugar Clinics
- **Medicines**: Glycomet 500mg (Metformin), Coumadin 5mg (Warfarin)
- **Expected**: Both medicines saved as `active`. Brand→Generic map resolves via seed data.
- **Interactions**: None expected (Metformin + Warfarin has no KB entry for `avoid_combination`).

### Step 2a: Upload `2a.png` (Prescription)
- **Doctor**: Dr. Sanjay Gupta, Cardiology, Fortis Escorts Heart Institute
- **Medicine**: Disprn 325mg (ambiguous spelling of Disprin → Aspirin)
- **Expected**: Low confidence on brand_name extraction due to the deliberately misspelled "Disprn". Follow-up question should ask user to confirm the brand name.
- **Interaction Alert**: Warfarin + Aspirin → `avoid_combination` severity (seeded in `interaction_kb`).

### Step 2b: Upload `2b.png` (Lab Report)
- **Lab**: SRL Diagnostics
- **Values**: HbA1c 7.2%, Creatinine 1.1 mg/dL, Potassium 4.2 mmol/L, BP 145/92
- **Expected**: All lab values saved. No trend flags (this is the first report).

### Step 3: Upload `3.png` (Follow-up Lab Report)
- **Lab**: SRL Diagnostics
- **Values**: HbA1c 7.6%, Creatinine 1.5 mg/dL, Potassium 5.3 mmol/L, BP 138/88
- **Expected Trends**:
  - HbA1c: 7.2 → 7.6 (absolute Δ = 0.4, ≥0.3 threshold) → **Rising flag**
  - Creatinine: 1.1 → 1.5 (relative Δ = 36%, ≥10% threshold) → **Rising flag**
  - Potassium: 4.2 → 5.3 (relative Δ = 26%, ≥10% threshold) → **Rising flag**

## Generating the Test Images

```bash
pip install Pillow
python scripts/generate_john_doe_history.py
```

## Verification Checklist
- [ ] Upload `1.png` → medicines saved, no interaction alerts
- [ ] Upload `2a.png` → follow-up question for brand name, interaction alert after confirmation
- [ ] Upload `2b.png` → lab values saved, no trends (first data point)
- [ ] Upload `3.png` → lab values saved, rising trends flagged for HbA1c, Creatinine, Potassium
- [ ] Generate Visit Brief → mentions active medicines, interaction warning, rising trends
