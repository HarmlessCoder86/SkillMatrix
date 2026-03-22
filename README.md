# Skill Matrix

Employee proficiency tracking application for **Simpson Strong-Tie** (manufacturing). Visualizes competency levels across departments using Harvey Ball indicators (5 levels), manages assessment workflows with manager approval, and identifies training gaps.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | FastAPI + asyncpg (fully async) |
| Database | PostgreSQL 16 |
| Auth | JWT (PyJWT) + bcrypt, role-based access control |
| Proxy | Caddy (auto-SSL) + Nginx (frontend static) |
| Deployment | Docker Compose |

## Architecture

```
skill-matrix/
├── backend/
│   ├── main.py              # All API endpoints (~1800 lines)
│   ├── auth.py              # JWT auth + RBAC (6-level role hierarchy)
│   ├── db.py                # asyncpg connection pool
│   ├── activity.py          # Activity logging helper
│   ├── schema.sql           # Full DDL + views + indexes + seed data
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # React Router v7 routes
│   │   ├── lib/
│   │   │   ├── api.js       # REST client (fetch wrapper, token injection)
│   │   │   └── auth.jsx     # AuthProvider context
│   │   ├── components/
│   │   │   ├── HarveyBall.jsx    # 5-level SVG proficiency indicator
│   │   │   ├── MatrixGrid.jsx    # Main grid (sticky headers, collapsible tree)
│   │   │   ├── DetailPanel.jsx   # Slide-in assessment editor + audit trail
│   │   │   ├── NavBar.jsx        # Top nav with role badge
│   │   │   ├── ConfirmDialog.jsx # Modal confirmation
│   │   │   ├── FilterBar.jsx     # Tab toggles
│   │   │   ├── LevelPicker.jsx   # 0-4 level dropdown
│   │   │   ├── Legend.jsx        # Level indicator legend
│   │   │   ├── SkillTree.jsx     # Collapsed hierarchy
│   │   │   └── UserSelector.jsx  # Employee/team filter
│   │   └── pages/
│   │       ├── MatrixView.jsx    # Main grid + filters
│   │       ├── Dashboard.jsx     # Gap analysis + overdue alerts
│   │       ├── EmployeeProfile.jsx # Individual employee skill view + editing
│   │       ├── TalentFinder.jsx  # Search employees by skill/level
│   │       ├── Login.jsx         # Email/password form
│   │       ├── ActivityLog.jsx   # Audit trail viewer + CSV export
│   │       └── admin/
│   │           ├── Users.jsx     # User CRUD + role management
│   │           ├── Skills.jsx    # Skill tree CRUD + role requirements
│   │           └── Assignments.jsx # Supervisor reporting relationships
│   ├── nginx.conf
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
├── docker-compose.yml       # 4 services: db, api, frontend, caddy
├── Caddyfile                # Reverse proxy + auto-SSL
├── deploy.sh                # One-click Ubuntu 24.04 deployment
└── .env.example
```

## Features

- **Skills Matrix** — grid view of all employees × skills with Harvey Ball proficiency indicators
- **Harvey Ball Levels** — L0 (Not Trained), L1 (Training Received), L2 (Practicing), L3 (Competent), L4 (Expert)
- **Assessment Workflow** — self/peer/manager submissions with supervisor confirmation queue
- **Gap Analysis** — role-based skill requirements with visual gap indicators (red borders)
- **Retrain Tracking** — configurable retrain intervals per skill with overdue alerts
- **Employee Profiles** — individual skill view with inline editing via slide-in panel
- **Talent Finder** — search for employees by skill and proficiency level
- **Dashboard** — gap summaries, overdue certifications, team completion percentages
- **Activity Log** — full audit trail with filtering and CSV export
- **Admin Panel** — manage users, skills (hierarchical tree), employee roles, and supervisor assignments
- **Two Role Systems** — auth roles (operator→admin) for permissions, employee roles (job titles) for skill requirements
- **CSV Export** — download matrix data and activity logs

## Setup

### Docker (recommended)

```bash
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, JWT_SECRET, DOMAIN

docker compose up -d --build
```

App runs at `http://localhost:3001`. API at `http://localhost:8000`.

### Local Development

```bash
# Database
createdb skill_matrix
psql -d skill_matrix -f backend/schema.sql

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Vite proxies `/api` → `localhost:8000`. Open `http://localhost:5173`.

### Environment Variables

```
POSTGRES_DB=skill_matrix
POSTGRES_USER=skillmatrix
POSTGRES_PASSWORD=<secure>
JWT_SECRET=<openssl rand -hex 32>
CORS_ORIGINS=http://localhost:5173,http://localhost:3001
DOMAIN=skills.yourdomain.com    # For Caddy SSL
```

## Auth Roles

```
operator (0) → lead (1) → trainer (2) → supervisor (3) → manager (4) → admin (5)
```

- **Admin/Manager**: full access, excluded from matrix view (administrative users)
- **Supervisor**: manage direct reports, approve assessments
- **Trainer/Lead**: assess assigned employees
- **Operator**: self-assessment only

## Data Model

| Table | Purpose |
|-------|---------|
| `employees` | Worker records (name, role, department, team) |
| `users` | Auth accounts (email, password_hash, auth role, linked to employee) |
| `skill_categories` | Top-level groupings (Operations, Sales, etc.) |
| `skills` | Hierarchical tree (category → skill → sub-skill) |
| `assessments` | Proficiency records (1 per employee × skill, level 0-4) |
| `assessment_submissions` | Individual submissions (self/peer/manager type) |
| `assessment_audit` | Change history (immutable log) |
| `employee_supervisors` | Matrix reporting relationships |
| `role_skill_requirements` | Required level per job title × skill |
| `skill_requirements` | Staffing gap thresholds per skill |
| `employee_roles` | Job title catalog (separate from auth roles) |
| `activity_log` | Immutable audit trail |

## Deployment (DigitalOcean)

```bash
ssh root@your-droplet-ip
git clone https://github.com/YOU/skill-matrix.git /opt/skill-matrix
cd /opt/skill-matrix
chmod +x deploy.sh && ./deploy.sh
cp .env.example .env && nano .env
docker compose up -d
```

Caddy auto-provisions SSL. Live at `https://skills.yourdomain.com`.

```
Internet → Caddy (:443) → /api/*  → FastAPI (:8000) → Postgres (:5432)
                         → /*     → Nginx (:80, static React build)
```

### Common Commands

```bash
docker compose up -d --build                    # Rebuild & restart
docker compose logs -f api                      # API logs
docker compose exec db psql -U skillmatrix skill_matrix   # DB shell
docker compose exec db pg_dump -U skillmatrix skill_matrix > backup.sql  # Backup
```

## Branding

- **Primary orange**: `#F26522` (Simpson Strong-Tie)
- **Dark orange**: `#C85413` (hover/accent)
- Harvey Ball colors defined in `tailwind.config.js` (harvest-0 through harvest-4)
