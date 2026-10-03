# Urban Eye

**A Civic Issue Triage and Verification System for Sri Lankan Municipal Councils**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## About

Urban Eye addresses four critical challenges in Sri Lankan local governance:

1. **Unfair Prioritization** - Resources allocated based on political influence instead of community need
2. **False Closures** - Complaints marked Resolved without verifiable evidence
3. **Slow Emergency Response** - Life-threatening hazards stuck in the same queue as minor issues
4. **Fake Accounts and Duplicate Reports** - No identity verification

It establishes a **transparent, closed-loop pipeline** between citizens and local authorities.

---

## Key Features

- **NIC-Based Identity Verification** - One account per citizen
- **Two-Track Triage** - Emergency alerts bypass routine queue
- **Community-Verified Closure** - Officers upload proof; reporters confirm/dispute
- **Ward Announcements** - Prevent duplicate reports
- **Automated Background Tasks** - Auto-close stale tickets after 2 weeks
- **Dashboards and Analytics** - Data-driven governance
- **Trilingual** - Sinhala, Tamil, English

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MySQL |
| Real-Time | Socket.IO |
| Auth | JWT + bcrypt |
| Storage | Firebase Storage |
| Scheduled Jobs | Node-Cron |

---

## Project Structure

urban-eye/
- client/          # React frontend
- server/          # Node.js backend
- database/        # SQL schemas
- docs/            # Documentation
- .github/         # CI/CD

---

## Getting Started

### Prerequisites
- Node.js v18+
- MySQL 8+
- Git

### Installation

git clone https://github.com/YOUR-USERNAME/urban-eye.git
cd urban-eye
cd server && npm install
cd ../client && npm install

### Configure Environment

cp server/.env.example server/.env

### Run Development

Terminal 1 - Backend:
cd server && npm run dev

Terminal 2 - Frontend:
cd client && npm start

Access at http://localhost:3000

---

## Modules

1. **User Management** - Registration, auth, RBAC
2. **Civic Issue Management** - Submit, browse, categorize
3. **Voting and Prioritization** - Community consensus ranking
4. **Emergency Alert and Triage** - High-priority hazard routing
5. **Municipal Work and Resolution Proof** - Officer task management
6. **Verification and Auto-Closure** - Reporter confirmation + cron
7. **Ward Announcement** - Official council notices

---

## Team

**IS Group 02 - Sabaragamuwa University of Sri Lanka**

| Index No | Name |
|----------|------|
| 22FIS0460 | W.A.S.R. Peiris |
| 22FIS0461 | W.A.V. Amandi |
| 22FIS0462 | J.P.S.S. Jayakody |
| 22FIS0507 | G.E.M. Semini |
| 22FIS0551 | K.P.K. Kawshalya |
| 22FIS0559 | S.W.G.P. Samarasinghe |

**Internal Supervisor**: Mr. G.A.C.A. Herath (Senior Lecturer, Grade II)

---

## License

MIT License - see LICENSE for details.
