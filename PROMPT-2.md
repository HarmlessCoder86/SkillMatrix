# Skill Matrix — Full Implementation Prompt

> Hand this file to Claude Code along with the project scaffold.
> It contains everything needed to build the complete application.

---

## PROJECT OVERVIEW

Build a web-based skill matrix application for a manufacturing and operations company.
The app tracks employee proficiency across all departments using Harvey ball visualizations
(5 levels), identifies training gaps at individual and staffing-coverage levels, manages an
assessment workflow with manager confirmation, and drives action through overdue alerts and
gap dashboards.

**Tech Stack:**
- Frontend: React 18 + Vite + Tailwind CSS
- Backend: FastAPI + asyncpg
- Database: PostgreSQL 16
- Deployment: Docker Compose on DigitalOcean ($24/mo droplet, Ubuntu 24.04)
- Reverse Proxy: Caddy (auto-SSL via Let's Encrypt)
- Domain: Subdomain on existing domain (e.g., skills.company.com)

**Design Reference:** See the React preview artifact already generated in this project —
it shows the exact visual style, Harvey ball rendering, matrix layout, legend bar,
staffing coverage column, and detail panel. Match that aesthetic.

---

## 1. PROFICIENCY LEVELS

Five levels using Harvey ball (filled circle) visualization:

| Level | Label        | Harvey Ball  | Definition |
|-------|--------------|--------------|------------|
| 0     | Untrained    | empty        | Not familiar with the process. No TWI received. |
| 1     | Level 1      | quarter      | Received JSA & TWI Job Instruction on the process, parts, key points. Performed teach-back. |
| 2     | Level 2      | half         | Can perform the process with minimal supervision. Demonstrated proper sequence and knowledge of cycle time. |
| 3     | Level 3      | three-quarter | Can perform without assistance or supervision. Meets standard work targets for each component. |
| 4     | Level 4      | full         | Mastery. Exceeds standard work targets. Can train others, initiate optimization, and fix errors. |

Harvey balls are rendered as SVG circles with a filled wedge. See frontend/src/components/HarveyBall.jsx for the existing implementation.

---

## 2. COMPLETE SKILL TREE

The matrix left axis uses a collapsible hierarchy. Top level = department/category.
Operations has an extra nesting layer (area > station > skill).
Other departments have skills directly under them.

IMPORTANT: Seed ALL of these into the database. This is the starting data set.
Users can add/remove skills later, but the app should launch with a populated matrix.

```
Sales
  Product Knowledge
  Quoting & Estimating
  CRM Usage (Salesforce / HubSpot)
  Prospecting & Lead Generation
  Negotiation & Closing
  Account Management
  Territory Planning
  Presentation & Demo Skills
  Contract & Pricing Review
  Sales Reporting & Forecasting

Inside Sales (Customer Service)
  Order Entry & Processing
  Customer Inquiry Handling
  ERP / Order System (SAP)
  RFQ Response & Follow-Up
  Product Configuration Support
  Shipping & Delivery Coordination
  Complaint Resolution & Escalation
  Cross-Sell / Up-Sell Identification
  Phone & Email Etiquette
  Returns & Credit Processing

Engineering
  CAD / CAM Software (SolidWorks, AutoCAD)
  Blueprint Reading & GD&T
  Tolerance Stack-Up Analysis
  Design for Manufacturability (DFM)
  Bill of Materials (BOM) Management
  ECN / Revision Control Process
  Material Selection & Specifications
  Prototyping & Testing
  Root Cause Analysis (8D, 5-Why)
  Project Management (Timelines, Milestones)

HR
  Recruiting & Interviewing
  Onboarding & Orientation
  Benefits Administration
  Payroll Processing
  Employee Relations & Conflict Resolution
  HRIS / HR System Management
  Compliance & Labor Law
  Performance Review Administration
  Training Program Coordination
  Workers Comp & Safety Reporting

Finance
  Accounts Payable
  Accounts Receivable
  General Ledger & Journal Entries
  Month-End / Year-End Close
  Budgeting & Forecasting
  Cost Accounting
  Financial Reporting
  ERP Financial Module (SAP)
  Tax Compliance
  Audit Preparation

Operations
  Fabrication
    CNC (Amada Laser / Punch)
      Machine Safety & Lockout/Tagout
      Machine Startup & Shutdown Procedures
      Blueprint Reading & Interpretation
      Program Loading & Selection
      Material Loading & Alignment
      Nesting & Sheet Optimization
      Tooling Setup & Changeover
      First Article Inspection
      In-Process Quality Checks (Calipers, Micrometers)
      Scrap & Material Tracking
      Basic Troubleshooting (Alarms, Jams)
      Preventive Maintenance (Daily Checks)
      SPC Data Recording

    Bender (Amada Press Brake 60/100T)
      Press Brake Safety & Pinch Point Awareness
      Machine Startup & Shutdown Procedures
      Blueprint Reading - Bend Allowances & K-Factor
      Tooling Selection (Punch & Die Profiles)
      Tooling Installation & Changeover
      Back Gauge Setup & Positioning
      Program Loading (AMNC 3i Controller)
      First Piece Inspection & Angle Verification
      Measuring & Verifying Bend Angles (Protractor, Digi-Pro)
      Part Measurement (Calipers, Tape, Height Gauge)
      Springback Compensation Adjustment
      Multi-Bend Sequencing
      Material Handling (Sheet Positioning & Ergonomics)
      Crowning Adjustment
      Preventive Maintenance (Daily Checks)

    Welder
      Welding Safety & PPE (Helmet, Gloves, Ventilation)
      MIG Welding (GMAW) - Carbon Steel
      MIG Welding (GMAW) - Stainless Steel
      TIG Welding (GTAW)
      Blueprint Reading - Weld Symbols & Joint Types
      Joint Preparation & Fit-Up
      Machine Setup (Wire Feed, Gas Flow, Voltage/Amperage)
      Material Identification (Steel, Stainless, Aluminum)
      Visual Weld Inspection (Porosity, Undercut, Spatter)
      Grinding & Surface Finishing
      Weld Defect Identification & Rework
      Fixture & Jig Usage

  Warehouse
    Forklift Operation (Sit-Down)
    Forklift Operation (Stand-Up / Reach)
    Forklift Daily Pre-Shift Inspection
    SAP - Warehouse Module (Receiving)
    SAP - Warehouse Module (Shipping)
    SAP - Inventory Transactions & Transfers
    RF Scanner / Barcode Scanning
    Order Picking & Staging
    Packing & Crating
    Shipping Label & BOL Preparation
    Truck Loading & Load Securement
    Receiving & Dock Operations
    Cycle Counting & Inventory Audit
    FIFO / Stock Rotation
    Hazardous Material Handling & Storage
    Warehouse Safety & Housekeeping
```

### Certification Tags

Some skills require periodic recertification. Mark these with a CERT badge in the UI
and set retrain_interval_days in the database:

- Machine Safety & Lockout/Tagout (all instances): 365 days
- Press Brake Safety & Pinch Point Awareness: 365 days
- Welding Safety & PPE: 365 days
- Forklift Operation (both types): 1095 days (3 years)
- Forklift Daily Pre-Shift Inspection: 365 days
- Hazardous Material Handling & Storage: 365 days
- Warehouse Safety & Housekeeping: 365 days
- Compliance & Labor Law (HR): 365 days

---

## 3. DATABASE SCHEMA

The existing backend/schema.sql has most of this. Key addition needed:

Add to assessments table:
  is_confirmed  BOOLEAN NOT NULL DEFAULT FALSE

When is_confirmed = FALSE, the Harvey ball shows the new level BUT with a pulsing amber border.
When a manager confirms, is_confirmed = TRUE, approved_by and approved_at are set.

Key tables: employees, skill_categories, skills, assessments, assessment_submissions,
assessment_audit, skill_requirements, role_skill_requirements, training_owners,
peer_assignments, saved_searches, teams.

Key views: v_employee_scores, v_staffing_coverage, v_skill_level_distribution,
v_overdue_retraining, v_individual_gaps, v_category_completion.

See schema.sql for full details.

---

## 4. AUTHENTICATION & USER MANAGEMENT

### v1: Simple User Selector

No full auth for v1. Instead:
- Dropdown in the app header: "Acting as: [Employee Name]"
- Persisted in localStorage
- The selected user determines permissions:

| Role | Permissions |
|------|-------------|
| Lead / Manager | Full access. Changes auto-confirmed. Can confirm others. Can assign peers. Can add/remove skills and employees. |
| Technician | Can self-assess. Can submit peer assessments if assigned. Changes require manager confirmation. |
| Operator | Can self-assess. Changes require manager confirmation. |

### Future v2: Real Auth
- users table with email, password_hash, role
- JWT authentication
- Login page

---

## 5. ASSESSMENT WORKFLOW & CONFIRMATION

### Level Change Flow

1. User clicks Harvey ball -> inline popover shows 5 levels (L0-L4)
2. User selects new level -> level updates in database
3. Confirmation logic:
   - Current user is employee's supervisor/manager -> is_confirmed = TRUE automatically
   - Current user is employee themselves -> is_confirmed = FALSE (self-assessment)
   - Current user is assigned peer -> is_confirmed = FALSE (peer assessment)
   - New assessment_submission row created recording who submitted what
4. Unconfirmed assessments show pulsing amber border on Harvey ball
5. Manager sees confirmation queue (badge count in header)
6. Manager clicks confirm -> is_confirmed = TRUE, approved_by set, audit log created
7. Manager clicks reject -> level reverts to previous, is_confirmed = TRUE

### Visual States on Harvey Balls (CRITICAL - must be visually distinct)

| State | Border Style | Description |
|-------|-------------|-------------|
| Confirmed, meets requirement | Solid gray 1.5px | Normal |
| Confirmed, below required | Dashed red 2px (static) | Gap indicator |
| Unconfirmed change | Solid amber 2px (pulsing animation) | Awaiting sign-off |
| Unconfirmed + below required | Dashed amber 2px (pulsing) | Both states |
| Overdue retraining | Red dot overlay top-right | Stacks with any border |

Pulse animation: opacity 0.6 to 1.0, 2s ease-in-out infinite.

### Confirmation Queue

Accessible from badge/bell icon in header:
- Count of unconfirmed assessments
- Grouped by employee or by skill (toggle)
- Each item: employee, skill, old level -> new level, who changed, when
- Actions: Confirm (green), Reject (red)
- Bulk confirm option

---

## 6. MATRIX UI - MAIN VIEW

### Layout
- Header: app name, "Acting as" dropdown, confirmation queue badge
- Legend bar: all 5 Harvey ball levels + gap indicator + overdue indicator
- Filter bar: search, department filter, team filter
- Matrix grid: skills (sticky left) x employees (scrollable) x Harvey balls
- Staffing coverage column (right)

### Skill Column (Left, Sticky)
- Collapsible tree with indentation
- CERT badge on certified skills
- "+" button at bottom of each category for inline quick-add

### Employee Column Headers
- Avatar circle with initials (color by role)
- First name, role label, total score
- "+" button at end to add employee

### Matrix Cells
- Harvey ball per employee x skill
- Click -> inline level picker (5 balls in a row)
- Shift+click -> full detail panel
- Hover tooltip: level, date, assessor, confirmed status

### Staffing Coverage Column
- "L3+: actual/required" and "L4: actual/required"
- Green when met, red when gap

### Category Summary Row
- Completion % per employee after each category block

---

## 7. DETAIL PANEL (Slide-Out)

Opens from right on shift+click or double-click:
- Header: employee name, skill name, current Harvey ball
- Level selector: 5 clickable Harvey balls
- Gap status indicator
- Overdue status indicator
- Confirmation status
- Training dates (editable): last trained, retrain due
- Notes text area
- Submission history (self/peer/manager submissions)
- Audit history (all level changes over time)
- Save/Cancel footer

---

## 8. ADMIN PANEL

Separate route (/admin). Only accessible to Lead/Manager role.

### 8a. Skills Management (/admin/skills)
- Full tree view, editable
- Add skill with confirmation dialog
- Edit skill inline or modal
- Deactivate skill with confirmation dialog (sets is_active=FALSE)
- Reorder via drag-and-drop
- Set training owner per skill
- Set staffing requirements (L3/L4 counts)

### 8b. Employee Management (/admin/employees)
- Table with all employees
- Add with confirmation dialog
- Edit via click
- Deactivate with confirmation dialog
- Bulk CSV import with preview

### 8c. Role Requirements (/admin/roles)
- Mini matrix: roles x skills
- Set required level (0-4) per role per skill
- Feeds individual gap analysis

### 8d. Peer Assignments (/admin/peers)
- Manager assigns assessor -> assessee pairs
- Optional skill scope or blanket all skills
- Table view of all assignments

### 8e. Training Dashboard (/admin/training)
- Overdue retraining table (sorted by most overdue)
- Upcoming retraining (next 30/60/90 days)
- "Mark as retrained" quick action
- Training owners list
- Certification status grid

---

## 9. GAP ANALYSIS - DRIVING ACTION

### 9a. Staffing Coverage (in matrix view)
Per-skill: L3+ actual/required, L4 actual/required, color-coded

### 9b. Individual Gap Report (/reports/gaps)
Table: employee, role, skill, current, required, gap size, last trained, retrain due
Sorted by gap severity. Filterable by department, team, employee.

### 9c. Action Items Dashboard (/dashboard)
Summary view driving daily action:

Section 1 - Overdue Retraining (red): count, top 5 with quick-action
Section 2 - Unconfirmed Assessments (amber): count, link to queue
Section 3 - Critical Staffing Gaps (red): skills where L3+ < required
Section 4 - Training Priorities (blue): top 10 training needs by gap severity

---

## 10. API ENDPOINTS

### Matrix
GET  /api/matrix?department=&team_id=&supervisor_id=

### Assessments
GET  /api/assessments/{employee_id}/{skill_id}
PUT  /api/assessments/{employee_id}/{skill_id}
POST /api/assessments/{employee_id}/{skill_id}/confirm
POST /api/assessments/{employee_id}/{skill_id}/reject
GET  /api/assessments/unconfirmed?manager_id=

### Employees
GET  /api/employees?team_id=&department=&active=
POST /api/employees
PUT  /api/employees/{id}
PATCH /api/employees/{id}/deactivate
POST /api/employees/bulk-import

### Skills
GET  /api/skills
POST /api/skills
PUT  /api/skills/{id}
PATCH /api/skills/{id}/deactivate
PUT  /api/skills/{id}/reorder

### Gap Analysis
GET /api/gaps/staffing?department=
GET /api/gaps/individual?employee_id=&department=
GET /api/gaps/dashboard

### Training
GET  /api/training/overdue
GET  /api/training/upcoming?days=30
POST /api/training/{assessment_id}/mark-retrained
GET  /api/training/owners

### Admin
GET  /api/roles
GET  /api/role-requirements?role=
PUT  /api/role-requirements/{role}/{skill_id}
GET  /api/skill-requirements/{skill_id}
PUT  /api/skill-requirements/{skill_id}
GET  /api/peer-assignments?manager_id=
POST /api/peer-assignments
DELETE /api/peer-assignments/{id}
GET  /api/teams
POST /api/teams
GET  /api/saved-searches?owner_id=
POST /api/saved-searches
DELETE /api/saved-searches/{id}

---

## 11. FRONTEND ROUTING

/                     -> Matrix view (default: Operations department)
/dashboard            -> Action items dashboard
/reports/gaps         -> Individual gap report
/admin/skills         -> Skills management (tree editor)
/admin/employees      -> Employee management (table + forms)
/admin/roles          -> Role requirements editor
/admin/peers          -> Peer assignment management
/admin/training       -> Training dashboard

Use React Router v6. Sidebar navigation for admin pages.

---

## 12. CONFIRMATION DIALOGS

Every destructive or consequential action requires a confirmation dialog:

1. Add skill - "Add [Name]? Creates Level 0 for all employees."
2. Remove skill - "Deactivate [Name]? Hidden from matrix. History preserved."
3. Add employee - "Add [Name]? Starts at Level 0 for all skills."
4. Remove employee - "Deactivate [Name]? Hidden from matrix. History preserved."
5. Reject assessment - "Reject? Level reverts from [New] to [Old]."
6. Bulk confirm - "Confirm all [N] pending changes for [Employee]?"
7. Mark retrained - "Mark [Employee] retrained on [Skill]? Updates dates."
8. CSV import - Preview shown first, then "Import [N] employees?"

Red button for destructive, blue for constructive. Always have Cancel option.

---

## 13. SEED EMPLOYEES

Create 15-20 employees across departments with varied levels:

Operations Fabrication (Team: Fab Shop):
- Carlos Beck, Operator (strong CNC, mid bender)
- Elena Dixon, Operator (newer, lower levels)
- Holly Harrington, Operator (strong bender, learning CNC)
- Mark Hull, Operator (well-rounded mid-level)
- Pedro Jensen, Technician (high levels, some overdue certs)
- Timothy Mack, Lead (maxed out, training owner)

Operations Warehouse (Team: Warehouse):
- Hannah Maxwell, Operator (experienced forklift, learning SAP)
- Joey Rivera, Operator (SAP proficient, newer to forklift)
- Gilbert Ross, Operator (mid-level)

Sales (Team: Sales):
- Tammy Sanchez, Sales Rep

Inside Sales (Team: Inside Sales):
- Kurt Lyons, Inside Sales Rep

Engineering (Team: Engineering):
- Beth Austin, Engineer Lead

HR (Team: HR):
- Grace Joseph, HR Coordinator

Finance (Team: Finance):
- Sarah Kim, Accountant

Ensure some assessments have is_confirmed = FALSE (amber borders).
Ensure some retrain_due_dates are past (red dots).
Ensure some employees are below role requirements (dashed red borders).

---

## 14. BUILD ORDER

Phase 1: Database + API Foundation
Phase 2: Core Matrix View with Harvey Balls
Phase 3: Level Editing + Confirmation Workflow
Phase 4: Detail Panel
Phase 5: Admin Panel (Skills, Employees, Roles, Peers)
Phase 6: Gap Analysis & Dashboards
Phase 7: Polish (search, export, responsive)

---

## 15. EXISTING PROJECT FILES

The scaffold has working starting points. Key notes:

- backend/main.py: NEEDS FULL REWRITE to match this spec
- backend/schema.sql: NEEDS UPDATE (add is_confirmed, expand seed data)
- frontend/src/components/HarveyBall.jsx: SOLID FOUNDATION (add amber state)
- frontend/src/components/MatrixGrid.jsx: GOOD START (update to match preview)
- frontend/src/components/DetailPanel.jsx: GOOD START (add submissions, audit)
- docker-compose.yml, Caddyfile, deploy.sh: READY TO USE
