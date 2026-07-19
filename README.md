# 🛡️ MedGuard

> **MedGuard** is an AI-powered medication safety and visit-preparation platform for chronic-condition patients and their family caregivers. Photograph prescriptions, get automatically warned of dangerous drug interactions, and keep caregivers synchronized in real-time.

---

## 🖼️ Application Showcase

Here is a visual walk-through of MedGuard's premium clinical interface:

| 🔐 1. 2-Step Verification (MFA) | 🔍 2. AI Clinical Extraction Review |
|:---:|:---:|
| ![MFA Login](docs/screenshots/mfa_screen.png) | ![Extraction Preview](docs/screenshots/extraction_preview.png) |
| Secure login requiring a 6-digit OTP with a resend utility and input contrast corrections. | Vision LLM extracts brand/generic mapping and dosage instructions with confidence metrics. |

| 📊 3. Unified Patient Dashboard | 💊 4. Active Prescription List |
|:---:|:---:|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Medicines List](docs/screenshots/medicines_list.png) |
| Dynamic overview containing medications, drug interactions, lab reports, and calendar events. | Mapped medication regimen displaying brand names, generic names, and dosage rules. |

---

## 🏗️ Architecture & Ports

| Service | Technology Stack | Default Port | Role |
|:---|:---|:---|:---|
| **ms1-core-api** | Express.js + pg + BullMQ | `4000` | Auth, DB connection, deterministic logic, async queues |
| **ms2-agent-service** | Python FastAPI + LangGraph | `8000` | Vision LLM extraction, brand resolution, brief generation |
| **frontend** | React + Vite + Vanilla CSS | `5173` | Patient & Caregiver web portal |
| **PostgreSQL** | PostgreSQL 16 | `5432` | System of record |
| **Redis** | Redis 7 | `6379` | Queue message broker |

---

## 🚀 Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js 20+](https://nodejs.org/) & [Python 3.11+](https://www.python.org/) (for local development)

### Boot Services with Docker
```bash
# 1. Copy environment template
cp .env.example .env

# 2. Boot all services
docker-compose up --build
```
Once booted, the app runs at `http://localhost`.

### Run Services Locally for Development
1. **ms1 — Express Backend**:
   ```bash
   cd ms1-core-api
   npm install
   npm start
   ```
   *Note: If no local PostgreSQL or Redis is running, the backend automatically falls back to an in-memory database store and queue simulation, keeping the SSE streams fully functional.*

2. **Frontend — React Client**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 🌐 Production Deployment Guide

As per the Milestone guidelines, the system is designed to deploy on **Vercel** (frontend SPA) and **AWS** (backends).

### 1. Frontend (Vercel)
Deploy the `frontend/` folder directly to Vercel. 
- **Vercel Client Routing**: Vite React Router requires rewrites to map all page requests back to `index.html`. We configure this using [vercel.json](frontend/vercel.json):
  ```json
  {
    "rewrites": [
      { "source": "/api/:path*", "destination": "http://<EC2_PUBLIC_IP>:4000/api/:path*" },
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```
  Replace `<EC2_PUBLIC_IP>` with your EC2 public IPv4 address.

### 2. Backends & Queue (AWS EC2)
Launch a standard Ubuntu `t3.micro` EC2 instance to run the backend components:
- Install Docker and Docker Compose.
- Spin up the containers for `ms1-core-api`, `ms2-agent-service`, and `Redis` on the EC2 instance using Docker Compose.
- Security Groups: Configure the EC2 instance security group to open port `80` (NGINX) publicly, while keeping ports `4000`, `8000`, and `6379` closed.

### 3. Database (AWS RDS)
Persist data using a managed **AWS RDS PostgreSQL** instance:
- Set up a PostgreSQL 16 database on RDS.
- Configure security groups on the RDS instance to only accept incoming connections from the EC2 instance's private IP (protecting against IDOR/unauthorized access).
- Inject the connection string as `DATABASE_URL` in the `.env` on EC2.

### 4. Upload Storage (AWS S3)
To ensure cost efficiency and clinical compliance:
- Configure an **AWS S3 Bucket** to store uploaded files.
- Enable **Intelligent-Tiering** for active patient files, which automatically transitions files to cheaper tiers after periods of inactivity.
- Configure a lifecycle policy to move files older than 90 days to **Glacier Deep Archive** for long-term storage.

### 5. Email Dispatch (AWS SES)
Configure **AWS SES** (Simple Email Service) to send OTP codes, verification links, and safety alerts:
- Verify your domain in AWS Route 53 with SPF, DKIM, and DMARC settings.
- Configure the SES credentials in `.env` for production email dispatch.
- Verification and password-reset links fallback to mock logs in development/testing modes.

---

## 🔐 Security & Hardening
- **MFA (2-Step Verification)** on user logins with secure session tokens.
- **Single-use Caregiver Link Codes** to enforce private caregiver boundaries.
- **IDOR Protection** validating patient ownership records before read/write.
- **Autofill Contrast Correction** fixing low-contrast blurred text in Chrome/Edge browsers.
- **Rate limiting** and sanitization to prevent injection and brute-force access.