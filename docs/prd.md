# MedGuard Product Requirements Document (PRD)
## Sections 1-5

### 1. Executive Summary

Most people managing an ongoing health condition — especially the elderly — don't see one doctor, they see several: a cardiologist, an endocrinologist, a general physician, maybe a specialist. None of these doctors see what the others have prescribed. As a result, patients accumulate medicines from multiple independent sources with nobody checking whether any of them are dangerous in combination. Layered on top of this, every visit exists in isolation — lab reports and prescriptions stay scattered across time, so a patient walks into each new appointment with no memory of what changed since the last one.

This project is an AI-powered medication safety and visit-preparation platform. A user photographs each new prescription as it arrives. A vision-LLM agent extracts the medicine name, dosage, and frequency, asks a clarifying question when the handwriting or brand name is ambiguous, resolves the Indian brand name to its underlying generic drug, and the system checks the new medicine against everything already on the patient's running list using a versioned drug-interaction knowledge base — surfacing any dangerous combination in plain language, in seconds, to both the patient and a linked family caregiver.

In its second phase, the same running record is extended to lab reports and test results: the system tracks values over time, flags what has genuinely changed, and generates a one-page brief with questions to bring to the next doctor visit — always framed as "discuss this with your doctor," never a diagnosis.

As a student project, this is a production-grade build on the mandated stack: two Dockerised microservices (Express.js + FastAPI with LangGraph), a React frontend, PostgreSQL, custom JWT auth, AWS SES, EC2 deployment with NGINX and HTTPS, CI/CD via GitHub Actions, and OpenTelemetry. Section 9 maps every requirement to a concrete use case.

---

### 2. Problem Statement

#### 2.1 Target Users

*   **Patients** managing chronic conditions (diabetes, hypertension, thyroid, heart disease) who see 2 or more independent doctors and take 4+ medicines regularly — a population that is large and growing, with India's elderly population alone projected to reach over 220 million by 2036.
*   **Family caregivers**, often living in a different city, who are responsible for the patient's wellbeing but have no visibility into day-to-day medicine safety.
*   **Platform operators / Clinical content reviewers** (e.g., Dr. Sana), who keep the interaction knowledge base accurate and review low-confidence flags before they reach a user.

#### 2.2 Pain Points

*   **No one is checking the combination:** Each doctor prescribes in isolation, confident in their own medicine, with no visibility into what the others have already prescribed. Genuinely dangerous overlaps go unnoticed until something goes wrong.
*   **Memory resets every visit:** Lab values, prescriptions, and test results live on paper or across disconnected apps. A patient can't easily tell if a number has been quietly trending in the wrong direction over months.
*   **Family caregivers are blind:** An adult child living elsewhere has no reliable way to know whether a parent is taking the right medicines correctly, or whether a new prescription conflicts with an existing one — short of constant phone calls.
*   **Existing tools solve half the problem:** Reminder apps tell you to take a pill on time but never check if it's safe alongside everything else. Interaction checkers exist but are built for doctors, require manually typing in every drug name, and were never designed to sit quietly in the background of an ordinary person's life.
*   **Brand names break the whole chain:** A real Indian prescription says "Dolo 650" or "Glycomet," never "Paracetamol" or "Metformin." Any interaction checker that only understands generic molecule names will silently fail on a real photo, even with perfect OCR, unless something sits in front of it to resolve the brand name first.
*   **Appointments are unprepared:** Without a running timeline, patients forget what's changed, forget what to ask, and doctors have to reconstruct history from memory or scattered paperwork each time.

---

### 3. Product Vision

> "Photograph every prescription and every report — get warned before a dangerous combination reaches you and walk into every appointment already knowing what's changed."

The product combines two connected capabilities:
1.  **Medication Safety**: Photo upload → structured medicine entry → brand-to-generic resolution → interaction check against a versioned clinical knowledge base → plain-language alert, shared live with a caregiver.
2.  **Longitudinal Visit Preparation**: Report upload → trend detection over time → a one-page, non-diagnostic brief with questions for the next visit.

Together, they turn a set of disconnected, one-off medical encounters into a single, continuously updating health record.

---

### 4. Suggested Product Names

| Name | Rationale |
| :--- | :--- |
| **MedGuard** | Direct, safety-first, easy to say in any language |
| **DawaiDost** | "Dawai" (medicine) + "Dost" (friend) — warm, approachable, Hindi-English blend |
| **RxSafe** | Short, clinical-sounding, easy as a domain |
| **PillPilot** | "Someone's flying the medicine list for you" |
| **HealthLoop** | The "one continuous record" framing |

---

### 5. User Personas

#### 5.1 Persona A — "The Multi-Doctor Patient"
*   **Profile**: Ramesh, 64, retired, lives in Pune. Manages diabetes and hypertension, sees an endocrinologist and a cardiologist independently, currently on 6 different medicines.
*   **Goal**: Know that a new prescription won't clash with what he's already taking, without having to understand medical jargon himself.
*   **Frustration**: Neither doctor asks what the other has prescribed; he's not confident he'd notice if something felt "off."

#### 5.2 Persona B — "The Long-Distance Caregiver"
*   **Profile**: Priya, 34, Ramesh's daughter, lives in Bengaluru. Manages her father's health remotely, calls weekly, worries about things she can't see.
*   **Goal**: A live view of her father's medicines and any flagged risks, without depending on him to remember and report everything correctly.
*   **Frustration**: Currently has zero visibility until something goes wrong.

#### 5.3 Persona C — "The Clinical Content Reviewer" (Admin)
*   **Profile**: Dr. Sana, part-time clinical reviewer for the platform. Reviews prescription extractions the system flagged as low-confidence, checks interaction alerts the system wasn't fully sure about, and maintains the versioned drug-interaction database and brand-to-generic mapping table as new data becomes available.
*   **Goal**: Keep false alarms low enough that users trust the alerts and keep the knowledge base and brand mappings current.
*   **Frustration**: Needs the system to show its extraction and reasoning clearly, not just a bare verdict, so she can trust or correct it quickly.
