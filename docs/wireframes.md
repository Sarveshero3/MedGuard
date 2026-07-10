# MedGuard UI Wireframes

This document contains wireframe mockups for the 6 core screens of MedGuard.

---

## 1. Login / Signup

The authentication screen with DPDP consent checkbox for new signups.

![Login and Signup Screen](wireframes/01-login-signup.png)

**Key elements:**
- Login/Sign Up toggle tabs
- DPDP consent checkbox (required for registration)
- Role selection (Patient / Caregiver)
- JWT-based authentication

---

## 2. Patient Dashboard

The main landing page after login, showing a summary of the patient's medication safety status.

![Patient Dashboard](wireframes/02-patient-dashboard.png)

**Key elements:**
- Active medicines count
- Interaction alerts count with severity indicator
- Quick-access upload card
- Upcoming visits calendar

---

## 3. Prescription Upload

The prescription photo upload flow, including the AI follow-up question for ambiguous handwriting.

![Prescription Upload Flow](wireframes/03-prescription-upload.png)

**Key elements:**
- Camera/file upload area (8MB limit)
- Real-time preview
- Follow-up question for ambiguous fields (≤1 question)
- Extraction result with confidence scores

---

## 4. Medicine List + Interaction Alerts

Combined view of the active medicine list and interaction warnings.

![Medicine List and Alerts](wireframes/04-medicine-list-alerts.png)

**Key elements:**
- Active/discontinued medicine table
- Severity-coded interaction alert cards
- Plain-language explanations
- Timeline view

---

## 5. Caregiver Dashboard

Read-only view for linked caregivers monitoring a patient's medication safety.

![Caregiver Dashboard](wireframes/05-caregiver-dashboard.png)

**Key elements:**
- Patient link with permission tier indicator
- Read-only medicine list
- Alert acknowledgment actions
- Lab value trend charts

---

## 6. Admin Review Queue

Clinical reviewer interface for correcting low-confidence extractions and managing the knowledge base.

![Admin Review Queue](wireframes/06-admin-review-queue.png)

**Key elements:**
- Side-by-side: raw photo vs. extracted fields
- Confidence score indicators
- Editable extraction fields
- Confirm / Flag for re-review actions
- Pending review queue table
