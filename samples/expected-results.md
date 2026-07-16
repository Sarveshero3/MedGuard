# Expected Results — John Doe Test Case

## Step 1: Prescription `1.png`

| Field | Expected Value |
|---|---|
| brand_name | Glycomet 500mg |
| generic_name | Metformin |
| dosage | 500mg |
| frequency | Twice daily after meals |
| duration_text | 30 days |
| resolution_status | resolved |
| doctor_name | Dr. A. K. Shastri |
| specialty | Endocrinology |
| interaction_flags | None |

| Field | Expected Value |
|---|---|
| brand_name | Coumadin 5mg |
| generic_name | Warfarin |
| dosage | 5mg |
| frequency | Once daily at bedtime |
| duration_text | ongoing |
| resolution_status | resolved |
| interaction_flags | None (Metformin ↔ Warfarin not in KB) |

## Step 2a: Prescription `2a.png`

| Field | Expected Value |
|---|---|
| brand_name | Disprn 325mg (low confidence, likely follow-up) |
| generic_name | Aspirin (after user confirms Disprin) |
| dosage | 325mg |
| frequency | Once daily after breakfast |
| duration_text | 14 days |
| resolution_status | generic_unresolved → resolved after follow-up |

### Interaction Alert (triggered after confirmation)

| Field | Expected Value |
|---|---|
| generic_a | Warfarin |
| generic_b | Aspirin |
| severity | avoid_combination |
| explanation | Combining Warfarin and Aspirin significantly increases the risk of severe bleeding... |
| kb_entry_id | Matches seed row from init.sql |

## Step 2b: Lab Report `2b.png`

| Test | Value | Unit | Trend |
|---|---|---|---|
| HbA1c | 7.2 | % | N/A (first data point) |
| Creatinine | 1.1 | mg/dL | N/A |
| Potassium | 4.2 | mmol/L | N/A |
| Blood Pressure | 145/92 | mmHg | N/A |

## Step 3: Follow-up Lab `3.png`

| Test | Value | Previous | Absolute Δ | Relative Δ | Trend Flag |
|---|---|---|---|---|---|
| HbA1c | 7.6% | 7.2% | +0.4 | +5.6% | ✅ Rising (abs ≥ 0.3) |
| Creatinine | 1.5 mg/dL | 1.1 mg/dL | +0.4 | +36.4% | ✅ Rising (rel ≥ 10%) |
| Potassium | 5.3 mmol/L | 4.2 mmol/L | +1.1 | +26.2% | ✅ Rising (rel ≥ 10%) |
| Blood Pressure | 138/88 | 145/92 | -7/-4 | — | ❌ No flag (decreasing) |

## Interaction KB Seed Row (from init.sql)

```sql
INSERT INTO interaction_kb (generic_a, generic_b, severity, explanation, source, version, effective_date) VALUES
('Warfarin', 'Aspirin', 'avoid_combination',
 'Combining Warfarin and Aspirin significantly increases the risk of severe bleeding. Avoid combination unless specifically directed by your doctor.',
 'DDInter', 'v1', NOW()),
```
