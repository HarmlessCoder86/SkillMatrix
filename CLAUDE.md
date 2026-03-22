# Skill Matrix — Claude Project Guide

## What This Is
A web-based employee proficiency tracking application for **Simpson Strong-Tie** (manufacturing). Visualizes employee competency levels across departments using Harvey Ball indicators (5 levels), manages assessment workflows with manager approval, and identifies training gaps at individual and staffing-coverage levels.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | FastAPI + asyncpg (fully async) |
| Database | PostgreSQL 16 |
| Auth | JWT (PyJWT) + bcrypt, 24h token expiry |
| Rate Limiting | slowapi (5/min on login) |
| Proxy | Caddy (auto-SSL) + Nginx (frontend) |
| Deployment | Docker Compose (db, api, frontend, caddy) |

## Directory Structure
```
skill-matrix/
├── backend/
│   ├── main.py              # All API endpoints (~1800 lines)
│   ├── auth.py              # JWT auth + RBAC (role hierarchy, scoping)
│   ├── db.py                # asyncpg connection pool (min=2, max=20)
│   ├── activity.py          # Activity logging helper
│   ├── schema.sql           # Full DDL + views + indexes + seed data
│   ├── requirements.txt     # Python deps
│   └── Dockerfile           # Python 3.12-slim, non-root user
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # React Router v7 routes
│   │   ├── main.jsx         # Entry point
│   │   ├── index.css        # Tailwind + custom animations
│   │   ├── lib/
│   │   │   ├── api.js       # REST client (fetch wrapper, token injection, 401 redirect)
│   │   │   └── auth.jsx     # AuthProvider context
│   │   ├── components/
│   │   │   ├── HarveyBall.jsx    # 5-level SVG wedge (gap=red, unconfirmed=amber, overdue=red dot)
│   │   │   ├── MatrixGrid.jsx    # Main grid (sticky columns, collapsible tree)
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
│   │       ├── EmployeeProfile.jsx # Individual employee skill view + inline editing via DetailPanel
│   │       ├── TalentFinder.jsx  # Search employees by skill/level criteria
│   │       ├── Login.jsx         # Email/password form
│   │       ├── ActivityLog.jsx   # Audit trail viewer + CSV export
│   │       └── admin/
│   │           ├── Users.jsx     # User CRUD + role management
│   │           ├── Skills.jsx    # Skill tree CRUD + employee role management + requirements
│   │           └── Assignments.jsx # Supervisor reporting relationships
│   ├── nginx.conf           # Gzip, security headers, cache, SPA fallback
│   ├── vite.config.js       # Port 5173, /api proxy to :8000
│   ├── tailwind.config.js   # Custom colors (harvest-0 to harvest-4)
│   └── Dockerfile           # Node 20 multi-stage build
├── docker-compose.yml       # 4 services: db, api, frontend, caddy
├── Caddyfile                # Reverse proxy + auto-SSL + security headers
├── deploy.sh                # One-click Ubuntu 24.04 deployment
├── .env.example             # Template for all env vars
├── SPEC.md                  # Data model + feature specification
├── PROMPT.md                # Skill tree + implementation context
└── PROMPT-2.md              # Extended implementation guide
```

## Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `teams` | Organizational grouping |
| `skill_categories` | Top-level groupings (Operations, Sales, etc.) |
| `skills` | Hierarchical tree (category → skill → sub-skill via parent_skill_id) |
| `employees` | Worker records (name, role, department, team, supervisor, hire_date) |
| `users` | Auth accounts (email, password_hash, role, linked to employee) |
| `assessments` | Proficiency records (1 per employee × skill, level 0-4) |
| `assessment_submissions` | Individual submissions (self/peer/manager type) |
| `assessment_audit` | Change history (old_level → new_level, change_type) |
| `employee_supervisors` | Matrix reporting relationships (employee → supervisor, is_primary) |
| `skill_requirements` | Staffing gap thresholds (level_3_required, level_4_required per skill) |
| `role_skill_requirements` | Individual gap definition (role_name × skill → required_level) |
| `employee_roles` | Job title catalog (CNC Operator, Bender, etc.) — separate from auth roles |
| `peer_assignments` | Manager-controlled assessor permissions |
| `training_owners` | Skill training responsibility |
| `saved_searches` | Stored filter configs (JSONB) |
| `activity_log` | Immutable audit trail |

### Key Views
- `v_skill_tree` — Recursive CTE with depth & materialized path
- `v_skill_matrix` — Full cross-join (employees × skills) with assessment + requirement data
- `v_employee_completion` — Aggregated % complete per employee
- `v_category_completion` — % complete per employee per category

### Two Separate Role Systems
1. **Auth roles** (in `users.role`): operator, lead, trainer, supervisor, manager, admin — controls system access
2. **Employee roles** (in `employee_roles` table, referenced by `employees.role`): job titles like "CNC Operator", "Bender" — used for skill requirements

These are completely different concepts. Auth roles control permissions. Employee roles define job titles and drive role-skill requirement mappings.

## Authentication & Authorization

### Role Hierarchy (auth.py)
```
operator (0) → lead (1) → trainer (2) → supervisor (3) → manager (4) → admin (5)
```

### Access Scoping (`get_user_scope`)
- **Admin/Manager**: all employees
- **Supervisor**: direct reports + reports through their leads + self
- **Trainer/Lead**: directly assigned employees + self
- **Operator**: only self

### Permission Constants
- `CONFIRM_ROLES = {admin, manager, supervisor}` — can approve assessments
- `ADMIN_ROLES = {admin, manager, supervisor}` — can access admin panels
- `CREATION_PERMISSIONS` — matrix of who can create which auth roles

### Token Format
JWT payload: `{user_id, employee_id, role, exp, iat}`
Stored in localStorage as `skill-matrix-token`, sent via `Authorization: Bearer <token>`

## API Endpoints (all under /api)

### Auth
- `POST /auth/login` — rate limited 5/min
- `GET /auth/me`

### Matrix & Assessments
- `GET /matrix` — full grid (filter: department, category_id); excludes admin/manager auth-role users
- `GET /matrix/export` — CSV download; same admin/manager exclusion
- `PUT /assessments/{empId}/{skillId}` — update level + creates submission record (self/manager/peer)
- `GET /assessments/{empId}/{skillId}` — detail + submissions + audit
- `PUT /assessments/{empId}/{skillId}/retrain-date`
- `GET /confirmation-queue` — pending approvals
- `PUT /assessments/{id}/confirm` | `reject`

### Skills (admin/manager)
- `GET /categories` | `GET /skills`
- `POST /skills` | `PUT /skills/{id}` | `DELETE /skills/{id}`
- `PUT /skills/{skillId}/requirements` — staffing gap thresholds
- `GET /skill-requirements`

### Role Requirements
- `GET /role-requirements`
- `PUT /role-requirements`
- `DELETE /role-requirements/{id}`

### Employee Roles (job titles)
- `GET /employee-roles` — includes employee_count
- `POST /employee-roles` | `PUT /employee-roles/{id}` | `DELETE /employee-roles/{id}` (soft-delete)
- PUT cascades name changes to `employees.role` and `role_skill_requirements.role_name`

### Employees
- `GET /employees` (filter: department, supervisors_only) | `POST /employees` | `DELETE /employees/{id}`
- `GET /employees/{id}/profile` — full profile with assessments, summary stats

### Users (admin/manager)
- `GET /users` | `POST /users` | `PUT /users/{id}`
- `PUT /users/{id}/password` | `PUT /users/{id}/deactivate`
- `GET /users/archived` | `PUT /users/{id}/reactivate`

### Assignments (reporting relationships)
- `GET /assignments` | `POST /assignments` | `DELETE /assignments/{id}`

### Dashboard & Activity
- `GET /dashboard` — gap summaries, overdue alerts, team completion %
- `GET /activity-log` (filter: actor, action_type, entity_type, date range)
- `GET /activity-log/export` — CSV download (capped at 50k rows)

### Other
- `GET /teams` | `GET /health`

## Branding & Styling
- **Primary orange**: `#F26522` (Simpson Strong-Tie)
- **Dark orange**: `#C85413` (hover/accent)
- **Near-black**: `#1a1a1a` (headers, text)
- **Harvey Ball levels**: harvest-0 through harvest-4 (defined in tailwind.config.js)
- **Gap indicator**: red border on Harvey Ball
- **Unconfirmed**: amber pulsing border (CSS keyframe animation)
- **Overdue retrain**: red dot overlay
- All frontend styling uses inline styles + Tailwind, no separate CSS framework

## Docker Deployment

### Services
| Service | Image | Port | Notes |
|---------|-------|------|-------|
| db | postgres:16-alpine | 5432 (localhost) | Persistent volume, healthcheck |
| api | Python 3.12-slim | 8000 (localhost) | Non-root user, healthcheck |
| frontend | Node 20 → Nginx | 3001 (localhost) | Multi-stage build |
| caddy | caddy:2-alpine | 80, 443 | Auto-SSL, reverse proxy |

### Build & Deploy
```bash
docker compose up -d --build    # Always rebuild after code changes
docker compose ps               # Verify health
docker compose logs api         # Check API logs
```

### Required Environment Variables (.env)
```
POSTGRES_DB=skill_matrix
POSTGRES_USER=skillmatrix
POSTGRES_PASSWORD=<secure>
JWT_SECRET=<openssl rand -hex 32>
CORS_ORIGINS=http://localhost:5173,http://localhost:3001
DOMAIN=skills.yourdomain.com    # For Caddy SSL
```

### Database Migrations
Run directly against the running database container:
```bash
docker exec skill-matrix-db-1 psql -U skillmatrix -d skill_matrix -c "SQL HERE"
```

## Key Behaviors
- **Matrix view** excludes employees whose auth role is `admin` or `manager` (they are administrative users, not tracked in the training matrix)
- **Assessment submissions** are automatically recorded when levels are updated (type determined as self/manager/peer based on relationship)
- **Employee profiles** allow inline skill level editing via the DetailPanel slide-in
- **Assignments page** filters "Reports To" dropdown to only show supervisor/manager/admin auth-role users

## Known Issues
- Caddy port 443 may conflict if another service uses it — non-blocking, core 3 services work
- Proficiency/Experience/Assignment tab filtering is stubbed (UI exists, logic not implemented)
- Saved Searches button exists but no modal UI
- Search input exists but no client-side filtering
- No avatar upload, no bulk CSV import, no email notifications yet

## Coding Conventions
- Backend: Python type hints, docstrings, `logging.getLogger("skillmatrix.<module>")`
- Frontend: React functional components, hooks, inline styles (no CSS modules)
- All state changes logged to `activity_log` table
- Pydantic models for request validation
- asyncpg for all database queries (no ORM)
- `get_current_user` dependency on all authenticated endpoints
- `require_role("admin", "manager")` for admin-only endpoints

## Test Credentials
- Email: `timothy.mack@company.com` / Password: `password123` (admin role)
- Login response returns `{token, user}` (note: field is `token`, not `access_token`)
