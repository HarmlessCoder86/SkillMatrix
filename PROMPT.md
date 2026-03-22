# Skill Matrix — Implementation Prompt

## Context

You are building a web-based skill matrix application for a manufacturing/operations company.
The application tracks employee proficiency across departments using Harvey ball visualizations
(5 levels: 0-4), supports gap analysis at both individual and staffing-coverage levels, and
includes an assessment workflow with manager confirmation.

Tech stack: React + Vite + Tailwind (frontend), FastAPI + asyncpg (backend), PostgreSQL (database).
Deployed via Docker Compose on a DigitalOcean droplet with Caddy reverse proxy.

The existing scaffold includes: database schema, API shell, React component stubs, and Docker
deployment configs. See the project files for current state.

---

## 1. Skill Tree Structure

The left sidebar of the matrix uses a collapsible tree. Top-level items are **departments**.
Within Operations, there are **areas** (Fabrication, Warehouse), and within areas there are
**stations/machines**, and within those are **individual skills**.

Other departments (Sales, Inside Sales, Engineering, HR, Finance) have skills directly under them
without the extra nesting layer.

### Full Skill Tree with Pre-Populated Skills

```
├── Sales
│   ├── Product Knowledge
│   ├── Quoting & Estimating
│   ├── CRM Usage (Salesforce / HubSpot)
│   ├── Prospecting & Lead Generation
│   ├── Negotiation & Closing
│   ├── Account Management
│   ├── Territory Planning
│   ├── Presentation & Demo Skills
│   ├── Contract & Pricing Review
│   └── Sales Reporting & Forecasting
│
├── Inside Sales (Customer Service)
│   ├── Order Entry & Processing
│   ├── Customer Inquiry Handling
│   ├── ERP / Order Management System (SAP)
│   ├── RFQ Response & Follow-Up
│   ├── Product Configuration Support
│   ├── Shipping & Delivery Coordination
│   ├── Complaint Resolution & Escalation
│   ├── Cross-Sell / Up-Sell Identification
│   ├── Phone & Email Etiquette
│   └── Returns & Credit Processing
│
├── Engineering
│   ├── CAD / CAM Software (SolidWorks, AutoCAD)
│   ├── Blueprint Reading & GD&T
│   ├── Tolerance Stack-Up Analysis
│   ├── Design for Manufacturability (DFM)
│   ├── Bill of Materials (BOM) Management
│   ├── ECN / Revision Control Process
│   ├── Material Selection & Specifications
│   ├── Prototyping & Testing
│   ├── Root Cause Analysis (8D, 5-Why)
│   └── Project Management (Timelines, Milestones)
│
├── HR
│   ├── Recruiting & Interviewing
│   ├── Onboarding & Orientation
│   ├── Benefits Administration
│   ├── Payroll Processing
│   ├── Employee Relations & Conflict Resolution
│   ├── HRIS / HR System Management
│   ├── Compliance & Labor Law
│   ├── Performance Review Administration
│   ├── Training Program Coordination
│   └── Workers' Comp & Safety Reporting
│
├── Finance
│   ├── Accounts Payable
│   ├── Accounts Receivable
│   ├── General Ledger & Journal Entries
│   ├── Month-End / Year-End Close
│   ├── Budgeting & Forecasting
│   ├── Cost Accounting
│   ├── Financial Reporting
│   ├── ERP Financial Module (SAP)
│   ├── Tax Compliance
│   └── Audit Preparation
│
└── Operations
    ├── Fabrication
    │   ├── CNC (Amada Laser / Punch)
    │   │   ├── Machine Safety & Lockout/Tagout
    │   │   ├── Machine Startup & Shutdown Procedures
    │   │   ├── Blueprint Reading & Interpretation
    │   │   ├── Program Loading & Selection
    │   │   ├── Material Loading & Alignment
    │   │   ├── Nesting & Sheet Optimization
    │   │   ├── Tooling Setup & Changeover
    │   │   ├── First Article Inspection
    │   │   ├── In-Process Quality Checks (Calipers, Micrometers)
    │   │   ├── Scrap & Material Tracking
    │   │   ├── Basic Troubleshooting (Alarms, Jams)
    │   │   ├── Preventive Maintenance (Daily Checks)
    │   │   └── SPC Data Recording
    │   │
    │   ├── Bender (Amada Press Brake — 60/100 Ton)
    │   │   ├── Press Brake Safety & Pinch Point Awareness
    │   │   ├── Machine Startup & Shutdown Procedures
    │   │   ├── Blueprint Reading — Bend Allowances & K-Factor
    │   │   ├── Tooling Selection (Punch & Die Profiles)
    │   │   ├── Tooling Installation & Changeover
    │   │   ├── Back Gauge Setup & Positioning
    │   │   ├── Program Loading (AMNC 3i Controller)
    │   │   ├── First Piece Inspection & Angle Verification
    │   │   ├── Measuring & Verifying Bend Angles (Protractor, Digi-Pro)
    │   │   ├── Part Measurement (Calipers, Tape, Height Gauge)
    │   │   ├── Springback Compensation Adjustment
    │   │   ├── Multi-Bend Sequencing
    │   │   ├── Material Handling (Sheet Positioning)
    │   │   ├── Crowning Adjustment
    │   │   └── Preventive Maintenance (Daily Checks)
    │   │
    │   └── Welder
    │       ├── Welding Safety & PPE (Helmet, Gloves, Ventilation)
    │       ├── MIG Welding (GMAW)
    │       ├── TIG Welding (GTAW)
    │       ├── Blueprint Reading — Weld Symbols
    │       ├── Joint Preparation & Fit-Up
    │       ├── Machine Setup (Wire Feed, Gas Flow, Voltage)
    │       ├── Material Identification (Steel, Stainless, Aluminum)
    │       ├── Visual Weld Inspection
    │       ├── Grinding & Finishing
    │       └── Weld Defect Identification & Rework
    │
    └── Warehouse
        ├── Forklift Operation (Sit-Down)
        ├── Forklift Operation (Stand-Up / Reach)
        ├── Forklift Daily Pre-Shift Inspection
        ├── SAP — Warehouse Module (Receiving)
        ├── SAP — Warehouse Module (Shipping)
        ├── SAP — Inventory Transactions & Transfers
        ├── RF Scanner / Barcode Scanning
        ├── Order Picking & Staging
        ├── Packing & Crating
        ├── Shipping Label & BOL Preparation
        ├── Truck Loading & Load Securement
        ├── Receiving & Dock Operations
        ├── Cycle Counting & Inventory Audit
        ├── FIFO / Stock Rotation
        ├── Hazardous Material Handling
        └── Warehouse Safety & Housekeeping
```

### Data Model Notes for Skill Tree
- "Operations" is a **department** (top-level category in `skill_categories`).
- "Fabrication" and "Warehouse" are **areas** — represented as parent skills under Operations.
- "CNC", "Bender", "Welder" are **stations/machines** — child skills under Fabrication.
- Individual skills (e.g., "Blueprint Reading") are leaf-level skills under their station.
- For non-Operations departments (Sales, HR, etc.), skills are direct children of the category
  (no intermediate nesting needed).

---

## 2. Confirmation Workflow (Unconfirmed Status)

This is a critical UX feature. When any person (self-assessment, peer, or even a manager making
a quick change) modifies a proficiency level, the change goes into an **unconfirmed** state
until the responsible manager explicitly confirms it.

### Schema Addition

Add to the `assessments` table:
```sql
is_confirmed    BOOLEAN NOT NULL DEFAULT FALSE
```

The `approved_by` and `approved_at` fields already exist. When `is_confirmed = FALSE`:
- The assessment level IS updated (so the Harvey ball shows the new level)
- But the Harvey ball gets a distinct **unconfirmed visual indicator**
- The manager sees it in a queue and can confirm or reject

When confirmed:
- `is_confirmed = TRUE`
- `approved_by` = manager's employee_id
- `approved_at` = timestamp

### Visual Indicators (3 distinct states on Harvey balls)

| Condition | Visual | Description |
|-----------|--------|-------------|
| Normal (confirmed) | Solid fill, solid border | Standard Harvey ball |
| Below required level | Solid fill, **dashed red border** | Gap indicator |
| Unconfirmed change | Solid fill, **pulsing amber/yellow border** | Awaiting manager sign-off |
| Unconfirmed + below required | Solid fill, **pulsing red dashed border** | Both states active |
| Overdue retraining | **Red dot** (top-right corner) | Stacks with any above |

The unconfirmed indicator should be visually distinct from the gap indicator:
- Gap = dashed red (static) — "this person is below where they should be"
- Unconfirmed = pulsing amber solid border — "someone changed this, manager hasn't approved"
- These can stack: a level can be both unconfirmed AND below required

### Workflow Rules

1. **Any level change** (up or down) sets `is_confirmed = FALSE`
2. **Manager confirmation** sets `is_confirmed = TRUE`
3. **Manager's own direct changes** are auto-confirmed (they ARE the approver)
4. **Confirmation is per-cell** — each employee × skill assessment is independently confirmed
5. **Add/remove skills**: requires a confirmation dialog ("Are you sure you want to add/remove
   this skill? This will affect all employees.")
6. **Add/remove employees**: requires a confirmation dialog ("Are you sure you want to
   add/remove this employee? This will affect all their assessments.")

### Manager Confirmation Queue

A dedicated view (or badge count in the header) showing:
- All unconfirmed assessments grouped by employee or by skill
- Who made the change (self, peer name, etc.)
- Previous level → new level
- One-click confirm or reject (reject reverts to previous level)

---

## 3. Inline Quick-Add with Confirmation

### Adding a Skill
1. User clicks "+" at the bottom of a category or sub-category
2. Popover appears: skill name input, optional parent selection
3. User clicks "Add"
4. **Confirmation dialog**: "Add '[Skill Name]' under [Category]? This will create an Untrained
   (Level 0) entry for all active employees."
5. On confirm: skill appears as new row, all employees get Level 0

### Removing a Skill
1. User right-clicks or uses a kebab menu on the skill row
2. Selects "Remove Skill"
3. **Confirmation dialog**: "Remove '[Skill Name]'? This will deactivate the skill and hide it
   from the matrix. Assessment history will be preserved."
4. On confirm: skill set to `is_active = FALSE`, row disappears

### Adding an Employee
1. User clicks "+" at the end of the employee header row
2. Popover: name, role, team (minimal fields)
3. **Confirmation dialog**: "Add '[Name]' as [Role] in [Team]? They will start with Untrained
   (Level 0) for all skills."
4. On confirm: new column appears

### Removing an Employee
1. Kebab menu on employee header
2. "Deactivate Employee"
3. **Confirmation dialog**: "Deactivate '[Name]'? They will be hidden from the matrix.
   Assessment history will be preserved."
4. On confirm: `is_active = FALSE`, column disappears

---

## 4. Quick Level Change

Clicking a Harvey ball in the matrix should open a **compact inline level picker** (not the
full detail panel). This is for fast day-to-day updates.

### Interaction
1. Click any Harvey ball cell
2. A small popover appears directly over/below the cell showing 5 Harvey balls (L0-L4) in a row
3. Click the desired level
4. Level updates immediately, cell goes to **unconfirmed** state (amber border)
5. Shift+click OR double-click opens the full detail panel (for notes, history, etc.)

### Rules
- If the current user is the employee's manager → change is auto-confirmed
- If the current user is the employee themselves → change is unconfirmed (self-assessment)
- If the current user is an assigned peer → change is unconfirmed (peer assessment)

---

## 5. Auth Considerations (v1 Simplification)

For v1, implement a simple user-selection dropdown in the header ("Acting as: [Employee Name]")
so the system knows who is making changes. This avoids building full auth for the prototype
while still enforcing the confirmation workflow correctly.

Later versions can add real auth (OAuth, SSO, etc.).

---

## 6. Summary of ALL Visual States on Harvey Balls

```
FILL LEVELS (the wedge):
  ○  Level 0 — Untrained (empty)
  ◔  Level 1 — Training Received (quarter fill)
  ◑  Level 2 — Minimal Supervision (half fill)
  ◕  Level 3 — Independent (three-quarter fill)
  ●  Level 4 — Mastery (full fill)

BORDER STATES (can stack):
  Solid gray border      — Normal, confirmed
  Dashed red border      — Below required level for this role (gap)
  Solid amber border     — Unconfirmed change (pulsing animation)
  Dashed red + pulsing   — Unconfirmed AND below required

OVERLAY INDICATORS:
  Red dot (top-right)    — Retraining overdue
```

---

## 7. Implementation Priorities

### Phase 1: Core Matrix with Full Skill Tree
- Seed database with complete skill tree from Section 1
- Render collapsible tree with department → area → station → skill hierarchy
- Harvey balls with all 5 levels
- Employee headers with scores
- Legend bar

### Phase 2: Level Editing + Confirmation
- Click-to-change Harvey ball (inline popover)
- `is_confirmed` field and visual indicator (amber border)
- Manager confirmation queue
- "Acting as" user selector
- Confirmation dialogs for add/remove

### Phase 3: Gap Analysis
- Role skill requirements seeded for each department
- Staffing coverage requirements for Operations skills
- Gap indicator (dashed red border)
- Individual gap report view
- Staffing coverage summary rows

### Phase 4: Training Tracking
- Retrain intervals per skill
- Overdue flagging (red dot)
- Training owner assignment
- Overdue dashboard

### Phase 5: Admin Panel
- Full CRUD for skills (tree management with drag-and-drop)
- Full CRUD for employees
- Role requirements editor
- Peer assignment management
- Bulk CSV import

### Phase 6: Polish
- Search/filter (skills and employees)
- Saved searches
- CSV/Excel export
- Print-friendly view
- Responsive layout for tablets

---

## 8. Files to Reference

- `SPEC.md` — Feature specification (assessment workflow, data model, UI layout)
- `backend/schema.sql` — PostgreSQL schema with all tables, views, and seed data
- `backend/main.py` — FastAPI API (needs updating to match current schema)
- `frontend/src/components/HarveyBall.jsx` — SVG Harvey ball component
- `frontend/src/components/MatrixGrid.jsx` — Main matrix table
- `frontend/src/components/DetailPanel.jsx` — Assessment detail slide-out
- `frontend/src/components/FilterBar.jsx` — Filter/search bar
- `frontend/src/lib/api.js` — API client
- `docker-compose.yml` — Deployment stack
