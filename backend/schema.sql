-- Skill Matrix Database Schema
-- PostgreSQL 16
-- Merges SPEC.md data model + PROMPT.md confirmation workflow

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE teams (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skill_categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    department      VARCHAR(100),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skills (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL REFERENCES skill_categories(id),
    parent_skill_id INTEGER REFERENCES skills(id),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    retrain_days    INTEGER,            -- NULL = no retrain requirement
    requires_cert   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_id, parent_skill_id, name)
);

CREATE INDEX idx_skills_category ON skills(category_id);
CREATE INDEX idx_skills_parent ON skills(parent_skill_id);

CREATE TABLE employees (
    id                  SERIAL PRIMARY KEY,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    role                VARCHAR(100),
    department          VARCHAR(100),
    team_id             INTEGER REFERENCES teams(id),
    supervisor_id       INTEGER REFERENCES employees(id),
    avatar_url          TEXT,
    last_trained_date   DATE,           -- most recent training of any kind
    hire_date           DATE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_employees_supervisor ON employees(supervisor_id);
CREATE INDEX idx_employees_team ON employees(team_id);

CREATE TABLE assessments (
    id                  SERIAL PRIMARY KEY,
    employee_id         INTEGER NOT NULL REFERENCES employees(id),
    skill_id            INTEGER NOT NULL REFERENCES skills(id),
    level               SMALLINT NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 4),
    previous_level      SMALLINT CHECK (previous_level BETWEEN 0 AND 4),
    assessed_by         INTEGER REFERENCES employees(id),
    assessed_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_trained_date   DATE,           -- skill-specific
    retrain_due_date    DATE,           -- skill-specific, nullable
    is_confirmed        BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by         INTEGER REFERENCES employees(id),
    approved_at         TIMESTAMPTZ,
    notes               TEXT,
    UNIQUE(employee_id, skill_id)
);

CREATE INDEX idx_assessments_employee ON assessments(employee_id);
CREATE INDEX idx_assessments_skill ON assessments(skill_id);
CREATE INDEX idx_assessments_assessed_by ON assessments(assessed_by);
CREATE INDEX idx_assessments_unconfirmed ON assessments(is_confirmed) WHERE is_confirmed = FALSE;
CREATE INDEX idx_assessments_retrain ON assessments(retrain_due_date) WHERE retrain_due_date IS NOT NULL;

-- Individual assessment submissions (self, peer, manager) before final determination
CREATE TABLE assessment_submissions (
    id                  SERIAL PRIMARY KEY,
    assessment_id       INTEGER NOT NULL REFERENCES assessments(id),
    submitted_by        INTEGER NOT NULL REFERENCES employees(id),
    submission_type     VARCHAR(20) NOT NULL CHECK (submission_type IN ('self', 'peer', 'manager')),
    level               SMALLINT NOT NULL CHECK (level BETWEEN 0 AND 4),
    notes               TEXT,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submissions_assessment ON assessment_submissions(assessment_id);

-- Audit trail of all level changes
CREATE TABLE assessment_audit (
    id              SERIAL PRIMARY KEY,
    assessment_id   INTEGER NOT NULL REFERENCES assessments(id),
    changed_by      INTEGER REFERENCES employees(id),
    old_level       SMALLINT,
    new_level       SMALLINT NOT NULL,
    change_type     VARCHAR(20) NOT NULL DEFAULT 'update',  -- 'update', 'confirm', 'reject'
    reason          TEXT,
    result          VARCHAR(10) CHECK (result IN ('pass', 'fail')),
    notes           TEXT,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_assessment ON assessment_audit(assessment_id);

-- Staffing coverage requirements: how many people needed at each level per skill
CREATE TABLE skill_requirements (
    id                  SERIAL PRIMARY KEY,
    skill_id            INTEGER NOT NULL REFERENCES skills(id) UNIQUE,
    level_3_required    INTEGER NOT NULL DEFAULT 0,  -- how many people needed at Level 3+
    level_4_required    INTEGER NOT NULL DEFAULT 0   -- how many people needed at Level 4
);

-- Canonical list of employee job roles (e.g. "CNC Operator", "Bender")
CREATE TABLE employee_roles (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    department      VARCHAR(100),
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual gap: what level each role needs per skill
CREATE TABLE role_skill_requirements (
    id              SERIAL PRIMARY KEY,
    role_name       VARCHAR(100) NOT NULL,
    skill_id        INTEGER NOT NULL REFERENCES skills(id),
    required_level  SMALLINT NOT NULL DEFAULT 1 CHECK (required_level BETWEEN 0 AND 4),
    UNIQUE(role_name, skill_id)
);

-- Manager controls who can assess whom
CREATE TABLE peer_assignments (
    id              SERIAL PRIMARY KEY,
    assessor_id     INTEGER NOT NULL REFERENCES employees(id),
    assessee_id     INTEGER NOT NULL REFERENCES employees(id),
    skill_id        INTEGER REFERENCES skills(id),  -- NULL = all skills
    assigned_by     INTEGER NOT NULL REFERENCES employees(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_peer_assessor ON peer_assignments(assessor_id);
CREATE INDEX idx_peer_assessee ON peer_assignments(assessee_id);

-- Who is responsible for training on each skill
CREATE TABLE training_owners (
    id              SERIAL PRIMARY KEY,
    skill_id        INTEGER NOT NULL REFERENCES skills(id),
    owner_id        INTEGER NOT NULL REFERENCES employees(id),
    UNIQUE(skill_id, owner_id)
);

-- Stored filter configurations
CREATE TABLE saved_searches (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    config          JSONB NOT NULL DEFAULT '{}',
    created_by      INTEGER REFERENCES employees(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUTH & ROLES
-- ============================================================

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    employee_id     INTEGER NOT NULL UNIQUE REFERENCES employees(id),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'operator'
                    CHECK (role IN ('admin','manager','supervisor','trainer','lead','operator')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_employee ON users(employee_id);

-- Many-to-many reporting relationships (matrix reporting)
CREATE TABLE employee_supervisors (
    id              SERIAL PRIMARY KEY,
    employee_id     INTEGER NOT NULL REFERENCES employees(id),
    supervisor_id   INTEGER NOT NULL REFERENCES employees(id),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_by     INTEGER REFERENCES employees(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, supervisor_id),
    CHECK (employee_id != supervisor_id)
);

CREATE INDEX idx_emp_supervisors_employee ON employee_supervisors(employee_id);
CREATE INDEX idx_emp_supervisors_supervisor ON employee_supervisors(supervisor_id);

-- Activity log for all state changes
CREATE TABLE activity_log (
    id              SERIAL PRIMARY KEY,
    actor_id        INTEGER REFERENCES employees(id),
    action_type     VARCHAR(50) NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       INTEGER,
    description     TEXT NOT NULL,
    old_value       JSONB,
    new_value       JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_log_actor ON activity_log(actor_id);
CREATE INDEX idx_activity_log_type ON activity_log(action_type);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);

-- ============================================================
-- VIEWS
-- ============================================================

-- Full skill tree with recursive hierarchy
CREATE OR REPLACE VIEW v_skill_tree AS
WITH RECURSIVE tree AS (
    SELECT
        s.id, s.category_id, s.parent_skill_id, s.name, s.sort_order,
        s.is_active, s.retrain_days,
        sc.name AS category_name, sc.sort_order AS category_sort,
        0 AS depth,
        ARRAY[sc.sort_order, s.sort_order] AS sort_path,
        s.name::TEXT AS path
    FROM skills s
    JOIN skill_categories sc ON sc.id = s.category_id
    WHERE s.parent_skill_id IS NULL AND s.is_active = TRUE AND sc.is_active = TRUE

    UNION ALL

    SELECT
        s.id, s.category_id, s.parent_skill_id, s.name, s.sort_order,
        s.is_active, s.retrain_days,
        t.category_name, t.category_sort,
        t.depth + 1,
        t.sort_path || s.sort_order,
        t.path || ' > ' || s.name
    FROM skills s
    JOIN tree t ON t.id = s.parent_skill_id
    WHERE s.is_active = TRUE
)
SELECT * FROM tree ORDER BY sort_path;

-- Full cross-join of employees × skills with assessment status
CREATE OR REPLACE VIEW v_skill_matrix AS
SELECT
    e.id AS employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.role,
    e.department,
    e.team_id,
    e.supervisor_id,
    s.id AS skill_id,
    s.name AS skill_name,
    sc.id AS category_id,
    sc.name AS category_name,
    COALESCE(a.level, 0) AS level,
    a.is_confirmed,
    a.assessed_date,
    a.last_trained_date,
    a.retrain_due_date,
    CASE
        WHEN a.retrain_due_date IS NOT NULL AND a.retrain_due_date < CURRENT_DATE THEN TRUE
        ELSE FALSE
    END AS is_overdue,
    r.required_level,
    CASE
        WHEN r.required_level IS NOT NULL AND COALESCE(a.level, 0) < r.required_level THEN TRUE
        ELSE FALSE
    END AS has_gap
FROM employees e
CROSS JOIN skills s
JOIN skill_categories sc ON sc.id = s.category_id
LEFT JOIN assessments a ON a.employee_id = e.id AND a.skill_id = s.id
LEFT JOIN role_skill_requirements r ON r.skill_id = s.id AND r.role_name = e.role
WHERE e.is_active = TRUE AND s.is_active = TRUE AND sc.is_active = TRUE;

-- Overall % complete per employee (leaf skills only)
CREATE OR REPLACE VIEW v_employee_completion AS
SELECT
    e.id AS employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.role,
    e.department,
    COUNT(s.id) AS total_skills,
    COUNT(CASE WHEN COALESCE(a.level, 0) > 0 THEN 1 END) AS assessed_skills,
    ROUND(
        COUNT(CASE WHEN COALESCE(a.level, 0) > 0 THEN 1 END) * 100.0 / NULLIF(COUNT(s.id), 0),
        1
    ) AS completion_pct,
    COALESCE(SUM(COALESCE(a.level, 0)), 0) AS total_score
FROM employees e
CROSS JOIN skills s
JOIN skill_categories sc ON sc.id = s.category_id
LEFT JOIN assessments a ON a.employee_id = e.id AND a.skill_id = s.id
WHERE e.is_active = TRUE
    AND s.is_active = TRUE
    AND sc.is_active = TRUE
    -- Leaf skills only (no children)
    AND NOT EXISTS (SELECT 1 FROM skills c WHERE c.parent_skill_id = s.id AND c.is_active = TRUE)
GROUP BY e.id, e.first_name, e.last_name, e.role, e.department;

-- % complete per employee per category
CREATE OR REPLACE VIEW v_category_completion AS
SELECT
    e.id AS employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    sc.id AS category_id,
    sc.name AS category_name,
    COUNT(s.id) AS total_skills,
    COUNT(CASE WHEN COALESCE(a.level, 0) > 0 THEN 1 END) AS assessed_skills,
    ROUND(
        COUNT(CASE WHEN COALESCE(a.level, 0) > 0 THEN 1 END) * 100.0 / NULLIF(COUNT(s.id), 0),
        1
    ) AS completion_pct,
    COALESCE(SUM(COALESCE(a.level, 0)), 0) AS category_score
FROM employees e
CROSS JOIN skills s
JOIN skill_categories sc ON sc.id = s.category_id
LEFT JOIN assessments a ON a.employee_id = e.id AND a.skill_id = s.id
WHERE e.is_active = TRUE
    AND s.is_active = TRUE
    AND sc.is_active = TRUE
    AND NOT EXISTS (SELECT 1 FROM skills c WHERE c.parent_skill_id = s.id AND c.is_active = TRUE)
GROUP BY e.id, e.first_name, e.last_name, sc.id, sc.name;

-- Individual gap analysis view
CREATE OR REPLACE VIEW v_gap_analysis AS
SELECT
    a.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.role,
    e.department,
    a.skill_id,
    s.name AS skill_name,
    sc.name AS category_name,
    a.level AS current_level,
    r.required_level,
    r.required_level - a.level AS gap,
    a.is_confirmed,
    a.last_trained_date,
    a.retrain_due_date
FROM assessments a
JOIN employees e ON e.id = a.employee_id
JOIN skills s ON s.id = a.skill_id
JOIN skill_categories sc ON sc.id = s.category_id
JOIN role_skill_requirements r
    ON r.skill_id = a.skill_id
    AND r.role_name = e.role
WHERE a.level < r.required_level
    AND e.is_active = TRUE
    AND s.is_active = TRUE;

-- ============================================================
-- SEED DATA: Teams
-- ============================================================

INSERT INTO teams (name) VALUES
    ('Sales Team'),
    ('Customer Service Team'),
    ('Engineering Team'),
    ('HR Team'),
    ('Finance Team'),
    ('Fabrication Team'),
    ('Warehouse Team');

-- ============================================================
-- SEED DATA: Skill Categories (Departments)
-- ============================================================

INSERT INTO skill_categories (name, sort_order) VALUES
    ('Sales', 1),
    ('Inside Sales', 2),
    ('Engineering', 3),
    ('HR', 4),
    ('Finance', 5),
    ('Operations', 6);

-- ============================================================
-- SEED DATA: Skills — Sales (category_id = 1)
-- ============================================================

INSERT INTO skills (category_id, parent_skill_id, name, sort_order) VALUES
    (1, NULL, 'Product Knowledge', 1),
    (1, NULL, 'Quoting & Estimating', 2),
    (1, NULL, 'CRM Usage (Salesforce / HubSpot)', 3),
    (1, NULL, 'Prospecting & Lead Generation', 4),
    (1, NULL, 'Negotiation & Closing', 5),
    (1, NULL, 'Account Management', 6),
    (1, NULL, 'Territory Planning', 7),
    (1, NULL, 'Presentation & Demo Skills', 8),
    (1, NULL, 'Contract & Pricing Review', 9),
    (1, NULL, 'Sales Reporting & Forecasting', 10);

-- ============================================================
-- SEED DATA: Skills — Inside Sales (category_id = 2)
-- ============================================================

INSERT INTO skills (category_id, parent_skill_id, name, sort_order) VALUES
    (2, NULL, 'Order Entry & Processing', 1),
    (2, NULL, 'Customer Inquiry Handling', 2),
    (2, NULL, 'ERP / Order Management System (SAP)', 3),
    (2, NULL, 'RFQ Response & Follow-Up', 4),
    (2, NULL, 'Product Configuration Support', 5),
    (2, NULL, 'Shipping & Delivery Coordination', 6),
    (2, NULL, 'Complaint Resolution & Escalation', 7),
    (2, NULL, 'Cross-Sell / Up-Sell Identification', 8),
    (2, NULL, 'Phone & Email Etiquette', 9),
    (2, NULL, 'Returns & Credit Processing', 10);

-- ============================================================
-- SEED DATA: Skills — Engineering (category_id = 3)
-- ============================================================

INSERT INTO skills (category_id, parent_skill_id, name, sort_order) VALUES
    (3, NULL, 'CAD / CAM Software (SolidWorks, AutoCAD)', 1),
    (3, NULL, 'Blueprint Reading & GD&T', 2),
    (3, NULL, 'Tolerance Stack-Up Analysis', 3),
    (3, NULL, 'Design for Manufacturability (DFM)', 4),
    (3, NULL, 'Bill of Materials (BOM) Management', 5),
    (3, NULL, 'ECN / Revision Control Process', 6),
    (3, NULL, 'Material Selection & Specifications', 7),
    (3, NULL, 'Prototyping & Testing', 8),
    (3, NULL, 'Root Cause Analysis (8D, 5-Why)', 9),
    (3, NULL, 'Project Management (Timelines, Milestones)', 10);

-- ============================================================
-- SEED DATA: Skills — HR (category_id = 4)
-- ============================================================

INSERT INTO skills (category_id, parent_skill_id, name, sort_order) VALUES
    (4, NULL, 'Recruiting & Interviewing', 1),
    (4, NULL, 'Onboarding & Orientation', 2),
    (4, NULL, 'Benefits Administration', 3),
    (4, NULL, 'Payroll Processing', 4),
    (4, NULL, 'Employee Relations & Conflict Resolution', 5),
    (4, NULL, 'HRIS / HR System Management', 6),
    (4, NULL, 'Compliance & Labor Law', 7),
    (4, NULL, 'Performance Review Administration', 8),
    (4, NULL, 'Training Program Coordination', 9),
    (4, NULL, 'Workers'' Comp & Safety Reporting', 10);

-- ============================================================
-- SEED DATA: Skills — Finance (category_id = 5)
-- ============================================================

INSERT INTO skills (category_id, parent_skill_id, name, sort_order) VALUES
    (5, NULL, 'Accounts Payable', 1),
    (5, NULL, 'Accounts Receivable', 2),
    (5, NULL, 'General Ledger & Journal Entries', 3),
    (5, NULL, 'Month-End / Year-End Close', 4),
    (5, NULL, 'Budgeting & Forecasting', 5),
    (5, NULL, 'Cost Accounting', 6),
    (5, NULL, 'Financial Reporting', 7),
    (5, NULL, 'ERP Financial Module (SAP)', 8),
    (5, NULL, 'Tax Compliance', 9),
    (5, NULL, 'Audit Preparation', 10);

-- ============================================================
-- SEED DATA: Skills — Operations (category_id = 6)
-- Nested: Operations > Area > Station > Skill
-- ============================================================

-- Areas under Operations
INSERT INTO skills (category_id, parent_skill_id, name, sort_order) VALUES
    (6, NULL, 'Fabrication', 1),
    (6, NULL, 'Warehouse', 2);

-- Stations under Fabrication
INSERT INTO skills (category_id, parent_skill_id, name, sort_order)
SELECT 6, id, 'CNC (Amada Laser / Punch)', 1 FROM skills WHERE name = 'Fabrication' AND category_id = 6;
INSERT INTO skills (category_id, parent_skill_id, name, sort_order)
SELECT 6, id, 'Bender (Amada Press Brake)', 2 FROM skills WHERE name = 'Fabrication' AND category_id = 6;
INSERT INTO skills (category_id, parent_skill_id, name, sort_order)
SELECT 6, id, 'Welder', 3 FROM skills WHERE name = 'Fabrication' AND category_id = 6;

-- CNC Skills
INSERT INTO skills (category_id, parent_skill_id, name, sort_order)
SELECT 6, id, unnest(ARRAY[
    'Machine Safety & Lockout/Tagout', 'Machine Startup & Shutdown Procedures',
    'Blueprint Reading & Interpretation', 'Program Loading & Selection',
    'Material Loading & Alignment', 'Nesting & Sheet Optimization',
    'Tooling Setup & Changeover', 'First Article Inspection',
    'In-Process Quality Checks (Calipers, Micrometers)', 'Scrap & Material Tracking',
    'Basic Troubleshooting (Alarms, Jams)', 'Preventive Maintenance (Daily Checks)',
    'SPC Data Recording'
]),
generate_series(1, 13)
FROM skills WHERE name = 'CNC (Amada Laser / Punch)' AND category_id = 6;

-- Bender Skills
INSERT INTO skills (category_id, parent_skill_id, name, sort_order)
SELECT 6, id, unnest(ARRAY[
    'Press Brake Safety & Pinch Point Awareness', 'Machine Startup & Shutdown Procedures',
    'Blueprint Reading — Bend Allowances & K-Factor', 'Tooling Selection (Punch & Die Profiles)',
    'Tooling Installation & Changeover', 'Back Gauge Setup & Positioning',
    'Program Loading (AMNC 3i Controller)', 'First Piece Inspection & Angle Verification',
    'Measuring & Verifying Bend Angles (Protractor, Digi-Pro)',
    'Part Measurement (Calipers, Tape, Height Gauge)',
    'Springback Compensation Adjustment', 'Multi-Bend Sequencing',
    'Material Handling (Sheet Positioning)', 'Crowning Adjustment',
    'Preventive Maintenance (Daily Checks)'
]),
generate_series(1, 15)
FROM skills WHERE name = 'Bender (Amada Press Brake)' AND category_id = 6;

-- Welder Skills
INSERT INTO skills (category_id, parent_skill_id, name, sort_order)
SELECT 6, id, unnest(ARRAY[
    'Welding Safety & PPE (Helmet, Gloves, Ventilation)', 'MIG Welding (GMAW)',
    'TIG Welding (GTAW)', 'Blueprint Reading — Weld Symbols',
    'Joint Preparation & Fit-Up', 'Machine Setup (Wire Feed, Gas Flow, Voltage)',
    'Material Identification (Steel, Stainless, Aluminum)', 'Visual Weld Inspection',
    'Grinding & Finishing', 'Weld Defect Identification & Rework'
]),
generate_series(1, 10)
FROM skills WHERE name = 'Welder' AND category_id = 6;

-- Warehouse Skills (direct children of Warehouse)
INSERT INTO skills (category_id, parent_skill_id, name, sort_order)
SELECT 6, id, unnest(ARRAY[
    'Forklift Operation (Sit-Down)', 'Forklift Operation (Stand-Up / Reach)',
    'Forklift Daily Pre-Shift Inspection', 'SAP — Warehouse Module (Receiving)',
    'SAP — Warehouse Module (Shipping)', 'SAP — Inventory Transactions & Transfers',
    'RF Scanner / Barcode Scanning', 'Order Picking & Staging',
    'Packing & Crating', 'Shipping Label & BOL Preparation',
    'Truck Loading & Load Securement', 'Receiving & Dock Operations',
    'Cycle Counting & Inventory Audit', 'FIFO / Stock Rotation',
    'Hazardous Material Handling', 'Warehouse Safety & Housekeeping'
]),
generate_series(1, 16)
FROM skills WHERE name = 'Warehouse' AND category_id = 6;

-- ============================================================
-- SEED DATA: Certification / Retrain Requirements
-- ============================================================

UPDATE skills SET retrain_days = 365 WHERE name = 'Machine Safety & Lockout/Tagout';
UPDATE skills SET retrain_days = 365 WHERE name = 'Press Brake Safety & Pinch Point Awareness';
UPDATE skills SET retrain_days = 365 WHERE name = 'Welding Safety & PPE (Helmet, Gloves, Ventilation)';
UPDATE skills SET retrain_days = 1095 WHERE name = 'Forklift Operation (Sit-Down)';
UPDATE skills SET retrain_days = 1095 WHERE name = 'Forklift Operation (Stand-Up / Reach)';
UPDATE skills SET retrain_days = 365 WHERE name = 'Forklift Daily Pre-Shift Inspection';
UPDATE skills SET retrain_days = 365 WHERE name = 'Hazardous Material Handling';
UPDATE skills SET retrain_days = 365 WHERE name = 'Warehouse Safety & Housekeeping';
UPDATE skills SET retrain_days = 365 WHERE name = 'Compliance & Labor Law';

-- ============================================================
-- SEED DATA: Role Skill Requirements (required level per role)
-- ============================================================

-- CNC Operator requirements
INSERT INTO role_skill_requirements (role_name, skill_id, required_level)
SELECT 'CNC Operator', id, (ARRAY[3, 3, 2, 3, 3, 2, 2, 2, 2, 2, 1, 2, 1])[row_number() OVER (ORDER BY sort_order)]
FROM skills WHERE parent_skill_id = (SELECT id FROM skills WHERE name = 'CNC (Amada Laser / Punch)' AND category_id = 6)
ORDER BY sort_order;

-- Press Brake Operator requirements
INSERT INTO role_skill_requirements (role_name, skill_id, required_level)
SELECT 'Press Brake Operator', id, (ARRAY[3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 1, 2])[row_number() OVER (ORDER BY sort_order)]
FROM skills WHERE parent_skill_id = (SELECT id FROM skills WHERE name = 'Bender (Amada Press Brake)' AND category_id = 6)
ORDER BY sort_order;

-- Welder requirements
INSERT INTO role_skill_requirements (role_name, skill_id, required_level)
SELECT 'Welder', id, (ARRAY[3, 3, 2, 2, 2, 2, 2, 2, 2, 1])[row_number() OVER (ORDER BY sort_order)]
FROM skills WHERE parent_skill_id = (SELECT id FROM skills WHERE name = 'Welder' AND category_id = 6)
ORDER BY sort_order;

-- Warehouse Lead requirements
INSERT INTO role_skill_requirements (role_name, skill_id, required_level)
SELECT 'Warehouse Lead', id, (ARRAY[3, 3, 3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 2, 2, 3])[row_number() OVER (ORDER BY sort_order)]
FROM skills WHERE parent_skill_id = (SELECT id FROM skills WHERE name = 'Warehouse' AND category_id = 6)
ORDER BY sort_order;

-- Warehouse Associate requirements
INSERT INTO role_skill_requirements (role_name, skill_id, required_level)
SELECT 'Warehouse Associate', id, (ARRAY[2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2])[row_number() OVER (ORDER BY sort_order)]
FROM skills WHERE parent_skill_id = (SELECT id FROM skills WHERE name = 'Warehouse' AND category_id = 6)
ORDER BY sort_order;

-- Operations Manager requirements (broad, high level across key ops skills)
INSERT INTO role_skill_requirements (role_name, skill_id, required_level) VALUES
    ('Operations Manager', (SELECT id FROM skills WHERE name = 'Machine Safety & Lockout/Tagout' AND category_id = 6), 3),
    ('Operations Manager', (SELECT id FROM skills WHERE name = 'Press Brake Safety & Pinch Point Awareness' AND category_id = 6), 3),
    ('Operations Manager', (SELECT id FROM skills WHERE name = 'Welding Safety & PPE (Helmet, Gloves, Ventilation)' AND category_id = 6), 3),
    ('Operations Manager', (SELECT id FROM skills WHERE name = 'Forklift Operation (Sit-Down)' AND category_id = 6), 3),
    ('Operations Manager', (SELECT id FROM skills WHERE name = 'Warehouse Safety & Housekeeping' AND category_id = 6), 3);

-- Sales Rep requirements (Sales skills 1-10)
INSERT INTO role_skill_requirements (role_name, skill_id, required_level) VALUES
    ('Sales Rep', 1, 3), ('Sales Rep', 2, 2), ('Sales Rep', 3, 3),
    ('Sales Rep', 4, 2), ('Sales Rep', 5, 2), ('Sales Rep', 6, 2),
    ('Sales Rep', 7, 1), ('Sales Rep', 8, 2), ('Sales Rep', 9, 2),
    ('Sales Rep', 10, 1);

-- Sales Manager requirements
INSERT INTO role_skill_requirements (role_name, skill_id, required_level) VALUES
    ('Sales Manager', 1, 4), ('Sales Manager', 2, 3), ('Sales Manager', 3, 3),
    ('Sales Manager', 4, 3), ('Sales Manager', 5, 3), ('Sales Manager', 6, 3),
    ('Sales Manager', 7, 3), ('Sales Manager', 8, 3), ('Sales Manager', 9, 3),
    ('Sales Manager', 10, 3);

-- CS Rep requirements (Inside Sales skills 11-20)
INSERT INTO role_skill_requirements (role_name, skill_id, required_level) VALUES
    ('CS Rep', 11, 3), ('CS Rep', 12, 3), ('CS Rep', 13, 2),
    ('CS Rep', 14, 2), ('CS Rep', 15, 2), ('CS Rep', 16, 2),
    ('CS Rep', 17, 2), ('CS Rep', 18, 1), ('CS Rep', 19, 3),
    ('CS Rep', 20, 2);

-- CS Manager requirements
INSERT INTO role_skill_requirements (role_name, skill_id, required_level) VALUES
    ('CS Manager', 11, 3), ('CS Manager', 12, 3), ('CS Manager', 13, 3),
    ('CS Manager', 14, 3), ('CS Manager', 15, 3), ('CS Manager', 16, 3),
    ('CS Manager', 17, 3), ('CS Manager', 18, 2), ('CS Manager', 19, 3),
    ('CS Manager', 20, 3);

-- Design Engineer requirements (Engineering skills 21-30)
INSERT INTO role_skill_requirements (role_name, skill_id, required_level) VALUES
    ('Design Engineer', 21, 3), ('Design Engineer', 22, 3), ('Design Engineer', 23, 2),
    ('Design Engineer', 24, 2), ('Design Engineer', 25, 2), ('Design Engineer', 26, 2),
    ('Design Engineer', 27, 2), ('Design Engineer', 28, 2), ('Design Engineer', 29, 2),
    ('Design Engineer', 30, 2);

-- Engineering Manager requirements
INSERT INTO role_skill_requirements (role_name, skill_id, required_level) VALUES
    ('Engineering Manager', 21, 3), ('Engineering Manager', 22, 3), ('Engineering Manager', 23, 3),
    ('Engineering Manager', 24, 3), ('Engineering Manager', 25, 3), ('Engineering Manager', 26, 3),
    ('Engineering Manager', 27, 3), ('Engineering Manager', 28, 3), ('Engineering Manager', 29, 3),
    ('Engineering Manager', 30, 3);

-- HR Coordinator requirements (HR skills 31-40)
INSERT INTO role_skill_requirements (role_name, skill_id, required_level) VALUES
    ('HR Coordinator', 31, 2), ('HR Coordinator', 32, 2), ('HR Coordinator', 33, 2),
    ('HR Coordinator', 34, 2), ('HR Coordinator', 35, 2), ('HR Coordinator', 36, 2),
    ('HR Coordinator', 37, 2), ('HR Coordinator', 38, 2), ('HR Coordinator', 39, 2),
    ('HR Coordinator', 40, 2);

-- HR Director requirements
INSERT INTO role_skill_requirements (role_name, skill_id, required_level) VALUES
    ('HR Director', 31, 3), ('HR Director', 32, 3), ('HR Director', 33, 3),
    ('HR Director', 34, 3), ('HR Director', 35, 3), ('HR Director', 36, 3),
    ('HR Director', 37, 3), ('HR Director', 38, 3), ('HR Director', 39, 3),
    ('HR Director', 40, 3);

-- Accountant requirements (Finance skills 41-50)
INSERT INTO role_skill_requirements (role_name, skill_id, required_level) VALUES
    ('Accountant', 41, 3), ('Accountant', 42, 3), ('Accountant', 43, 2),
    ('Accountant', 44, 2), ('Accountant', 45, 1), ('Accountant', 46, 2),
    ('Accountant', 47, 2), ('Accountant', 48, 2), ('Accountant', 49, 2),
    ('Accountant', 50, 1);

-- Finance Director requirements
INSERT INTO role_skill_requirements (role_name, skill_id, required_level) VALUES
    ('Finance Director', 41, 3), ('Finance Director', 42, 3), ('Finance Director', 43, 3),
    ('Finance Director', 44, 3), ('Finance Director', 45, 3), ('Finance Director', 46, 3),
    ('Finance Director', 47, 3), ('Finance Director', 48, 3), ('Finance Director', 49, 3),
    ('Finance Director', 50, 3);

-- ============================================================
-- SEED DATA: Staffing Requirements (Operations skills only)
-- How many people at L3+ and L4 needed per skill
-- ============================================================

-- CNC staffing requirements
INSERT INTO skill_requirements (skill_id, level_3_required, level_4_required)
SELECT id,
    (ARRAY[3, 3, 2, 3, 2, 2, 2, 2, 2, 2, 1, 2, 1])[row_number() OVER (ORDER BY sort_order)],
    (ARRAY[1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0])[row_number() OVER (ORDER BY sort_order)]
FROM skills WHERE parent_skill_id = (SELECT id FROM skills WHERE name = 'CNC (Amada Laser / Punch)' AND category_id = 6)
ORDER BY sort_order;

-- Bender staffing requirements
INSERT INTO skill_requirements (skill_id, level_3_required, level_4_required)
SELECT id,
    (ARRAY[2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])[row_number() OVER (ORDER BY sort_order)],
    (ARRAY[1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0])[row_number() OVER (ORDER BY sort_order)]
FROM skills WHERE parent_skill_id = (SELECT id FROM skills WHERE name = 'Bender (Amada Press Brake)' AND category_id = 6)
ORDER BY sort_order;

-- Welder staffing requirements
INSERT INTO skill_requirements (skill_id, level_3_required, level_4_required)
SELECT id,
    (ARRAY[2, 2, 1, 1, 1, 1, 1, 1, 1, 1])[row_number() OVER (ORDER BY sort_order)],
    (ARRAY[1, 1, 0, 0, 1, 0, 0, 0, 0, 0])[row_number() OVER (ORDER BY sort_order)]
FROM skills WHERE parent_skill_id = (SELECT id FROM skills WHERE name = 'Welder' AND category_id = 6)
ORDER BY sort_order;

-- Warehouse staffing requirements
INSERT INTO skill_requirements (skill_id, level_3_required, level_4_required)
SELECT id,
    (ARRAY[2, 1, 2, 2, 2, 1, 2, 2, 1, 2, 2, 2, 2, 1, 1, 2])[row_number() OVER (ORDER BY sort_order)],
    (ARRAY[1, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1])[row_number() OVER (ORDER BY sort_order)]
FROM skills WHERE parent_skill_id = (SELECT id FROM skills WHERE name = 'Warehouse' AND category_id = 6)
ORDER BY sort_order;

-- ============================================================
-- SEED DATA: Employees (from PROMPT-2.md Section 13)
-- ============================================================

-- Operations Fabrication team — insert Lead first so we can reference as supervisor
INSERT INTO employees (first_name, last_name, role, department, team_id) VALUES
    ('Timothy', 'Mack', 'Lead', 'Operations', (SELECT id FROM teams WHERE name = 'Fabrication Team'));

INSERT INTO employees (first_name, last_name, role, department, team_id, supervisor_id) VALUES
    ('Carlos', 'Beck', 'CNC Operator', 'Operations',
      (SELECT id FROM teams WHERE name = 'Fabrication Team'),
      (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')),
    ('Elena', 'Dixon', 'CNC Operator', 'Operations',
      (SELECT id FROM teams WHERE name = 'Fabrication Team'),
      (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')),
    ('Holly', 'Harrington', 'Press Brake Operator', 'Operations',
      (SELECT id FROM teams WHERE name = 'Fabrication Team'),
      (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')),
    ('Mark', 'Hull', 'CNC Operator', 'Operations',
      (SELECT id FROM teams WHERE name = 'Fabrication Team'),
      (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')),
    ('Pedro', 'Jensen', 'Welder', 'Operations',
      (SELECT id FROM teams WHERE name = 'Fabrication Team'),
      (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack'));

-- Operations Warehouse team
INSERT INTO employees (first_name, last_name, role, department, team_id) VALUES
    ('Hannah', 'Maxwell', 'Warehouse Associate', 'Operations',
      (SELECT id FROM teams WHERE name = 'Warehouse Team')),
    ('Joey', 'Rivera', 'Warehouse Associate', 'Operations',
      (SELECT id FROM teams WHERE name = 'Warehouse Team')),
    ('Gilbert', 'Ross', 'Warehouse Associate', 'Operations',
      (SELECT id FROM teams WHERE name = 'Warehouse Team'));

-- Other departments
INSERT INTO employees (first_name, last_name, role, department, team_id) VALUES
    ('Tammy', 'Sanchez', 'Sales Rep', 'Sales',
      (SELECT id FROM teams WHERE name = 'Sales Team')),
    ('Kurt', 'Lyons', 'CS Rep', 'Inside Sales',
      (SELECT id FROM teams WHERE name = 'Customer Service Team')),
    ('Beth', 'Austin', 'Design Engineer', 'Engineering',
      (SELECT id FROM teams WHERE name = 'Engineering Team')),
    ('Grace', 'Joseph', 'HR Coordinator', 'HR',
      (SELECT id FROM teams WHERE name = 'HR Team')),
    ('Sarah', 'Kim', 'Accountant', 'Finance',
      (SELECT id FROM teams WHERE name = 'Finance Team'));

-- ============================================================
-- SEED DATA: Assessments — Operations Fabrication
-- ============================================================

-- Timothy Mack (Lead) — maxed out L4 on all fab skills
-- CNC skills (13)
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack'),
  s.id, 4, TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s
WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'CNC (Amada Laser / Punch)' AND category_id = 6)
ORDER BY s.sort_order;

-- Bender skills (15)
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack'),
  s.id, 4, TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s
WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Bender (Amada Press Brake)' AND category_id = 6)
ORDER BY s.sort_order;

-- Welder skills (10)
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack'),
  s.id, 4, TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s
WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Welder' AND category_id = 6)
ORDER BY s.sort_order;

-- Carlos Beck (CNC Operator) — strong CNC (L3-L4), mid bender (L1-L2), some welder
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Carlos' AND last_name = 'Beck'),
  s.id, (ARRAY[4, 3, 3, 4, 3, 2, 3, 3, 3, 2, 2, 3, 2])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'CNC (Amada Laser / Punch)' AND category_id = 6) ORDER BY s.sort_order;

INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Carlos' AND last_name = 'Beck'),
  s.id, (ARRAY[2, 2, 1, 1, 1, 1, 1, 2, 1, 1, 0, 0, 1, 0, 1])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Bender (Amada Press Brake)' AND category_id = 6) ORDER BY s.sort_order;

INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Carlos' AND last_name = 'Beck'),
  s.id, (ARRAY[1, 1, 0, 1, 1, 0, 1, 1, 0, 0])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Welder' AND category_id = 6) ORDER BY s.sort_order;

-- Elena Dixon (CNC Operator) — newer, lower levels
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Elena' AND last_name = 'Dixon'),
  s.id, (ARRAY[1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'CNC (Amada Laser / Punch)' AND category_id = 6) ORDER BY s.sort_order;

INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Elena' AND last_name = 'Dixon'),
  s.id, (ARRAY[1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Bender (Amada Press Brake)' AND category_id = 6) ORDER BY s.sort_order;

-- Holly Harrington (Press Brake Operator) — strong bender, learning CNC
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Holly' AND last_name = 'Harrington'),
  s.id, (ARRAY[1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'CNC (Amada Laser / Punch)' AND category_id = 6) ORDER BY s.sort_order;

INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Holly' AND last_name = 'Harrington'),
  s.id, (ARRAY[4, 3, 3, 3, 3, 3, 3, 4, 3, 3, 2, 2, 3, 2, 3])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Bender (Amada Press Brake)' AND category_id = 6) ORDER BY s.sort_order;

INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Holly' AND last_name = 'Harrington'),
  s.id, (ARRAY[1, 0, 0, 0, 1, 0, 0, 1, 0, 0])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Welder' AND category_id = 6) ORDER BY s.sort_order;

-- Mark Hull (CNC Operator) — well-rounded mid-level
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Mark' AND last_name = 'Hull'),
  s.id, (ARRAY[3, 2, 2, 3, 2, 2, 2, 2, 2, 2, 1, 2, 1])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'CNC (Amada Laser / Punch)' AND category_id = 6) ORDER BY s.sort_order;

INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Mark' AND last_name = 'Hull'),
  s.id, (ARRAY[2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 1, 1, 2, 1, 2])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Bender (Amada Press Brake)' AND category_id = 6) ORDER BY s.sort_order;

INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Mark' AND last_name = 'Hull'),
  s.id, (ARRAY[2, 2, 1, 1, 2, 1, 2, 2, 1, 1])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Welder' AND category_id = 6) ORDER BY s.sort_order;

-- Pedro Jensen (Welder) — high levels, strong welder + decent CNC/bender
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Pedro' AND last_name = 'Jensen'),
  s.id, (ARRAY[3, 3, 2, 3, 3, 1, 2, 3, 2, 2, 1, 2, 1])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'CNC (Amada Laser / Punch)' AND category_id = 6) ORDER BY s.sort_order;

INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Pedro' AND last_name = 'Jensen'),
  s.id, (ARRAY[3, 2, 2, 2, 2, 2, 1, 3, 2, 2, 1, 1, 2, 1, 2])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Bender (Amada Press Brake)' AND category_id = 6) ORDER BY s.sort_order;

INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Pedro' AND last_name = 'Jensen'),
  s.id, (ARRAY[4, 4, 3, 3, 3, 3, 3, 4, 3, 3])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Welder' AND category_id = 6) ORDER BY s.sort_order;

-- ============================================================
-- SEED DATA: Assessments — Operations Warehouse
-- ============================================================

-- Hannah Maxwell — experienced forklift (L3-L4), learning SAP (L1)
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Hannah' AND last_name = 'Maxwell'),
  s.id, (ARRAY[4, 3, 3, 1, 1, 1, 2, 2, 2, 2, 2, 3, 2, 2, 3, 3])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Warehouse' AND category_id = 6) ORDER BY s.sort_order;

-- Joey Rivera — SAP proficient (L3), newer to forklift (L1)
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Joey' AND last_name = 'Rivera'),
  s.id, (ARRAY[1, 0, 1, 3, 3, 3, 3, 2, 2, 2, 1, 2, 1, 1, 1, 2])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Warehouse' AND category_id = 6) ORDER BY s.sort_order;

-- Gilbert Ross — mid-level warehouse (L2)
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Gilbert' AND last_name = 'Ross'),
  s.id, (ARRAY[2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')
FROM skills s WHERE s.parent_skill_id = (SELECT id FROM skills WHERE name = 'Warehouse' AND category_id = 6) ORDER BY s.sort_order;

-- ============================================================
-- SEED DATA: Assessments — Non-Operations Departments
-- ============================================================

-- Tammy Sanchez (Sales Rep) — Sales skills
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Tammy' AND last_name = 'Sanchez'),
  s.id, (ARRAY[3, 2, 3, 2, 2, 2, 1, 2, 2, 1])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Tammy' AND last_name = 'Sanchez')
FROM skills s WHERE s.category_id = (SELECT id FROM skill_categories WHERE name = 'Sales') AND s.parent_skill_id IS NULL ORDER BY s.sort_order;

-- Kurt Lyons (CS Rep) — Inside Sales skills
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Kurt' AND last_name = 'Lyons'),
  s.id, (ARRAY[3, 3, 2, 2, 2, 2, 2, 1, 3, 2])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Kurt' AND last_name = 'Lyons')
FROM skills s WHERE s.category_id = (SELECT id FROM skill_categories WHERE name = 'Inside Sales') AND s.parent_skill_id IS NULL ORDER BY s.sort_order;

-- Beth Austin (Design Engineer) — Engineering skills
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Beth' AND last_name = 'Austin'),
  s.id, (ARRAY[3, 3, 2, 2, 2, 2, 2, 2, 2, 2])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Beth' AND last_name = 'Austin')
FROM skills s WHERE s.category_id = (SELECT id FROM skill_categories WHERE name = 'Engineering') AND s.parent_skill_id IS NULL ORDER BY s.sort_order;

-- Grace Joseph (HR Coordinator) — HR skills
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Grace' AND last_name = 'Joseph'),
  s.id, (ARRAY[2, 2, 2, 2, 2, 2, 2, 2, 2, 2])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Grace' AND last_name = 'Joseph')
FROM skills s WHERE s.category_id = (SELECT id FROM skill_categories WHERE name = 'HR') AND s.parent_skill_id IS NULL ORDER BY s.sort_order;

-- Sarah Kim (Accountant) — Finance skills
INSERT INTO assessments (employee_id, skill_id, level, is_confirmed, assessed_by)
SELECT (SELECT id FROM employees WHERE first_name = 'Sarah' AND last_name = 'Kim'),
  s.id, (ARRAY[3, 3, 2, 2, 1, 2, 2, 2, 2, 1])[row_number() OVER (ORDER BY s.sort_order)], TRUE,
  (SELECT id FROM employees WHERE first_name = 'Sarah' AND last_name = 'Kim')
FROM skills s WHERE s.category_id = (SELECT id FROM skill_categories WHERE name = 'Finance') AND s.parent_skill_id IS NULL ORDER BY s.sort_order;

-- ============================================================
-- SEED DATA: Unconfirmed assessments (amber pulsing borders)
-- ============================================================

-- Elena recently self-assessed some CNC skills — awaiting Timothy's confirmation
UPDATE assessments SET is_confirmed = FALSE,
  assessed_by = (SELECT id FROM employees WHERE first_name = 'Elena' AND last_name = 'Dixon')
WHERE employee_id = (SELECT id FROM employees WHERE first_name = 'Elena' AND last_name = 'Dixon')
  AND skill_id IN (
    SELECT id FROM skills WHERE name IN (
      'Machine Startup & Shutdown Procedures',
      'Program Loading & Selection',
      'Material Loading & Alignment'
    ) AND category_id = 6
    AND parent_skill_id = (SELECT id FROM skills WHERE name = 'CNC (Amada Laser / Punch)' AND category_id = 6)
  );

-- Mark recently self-assessed some bender skills — unconfirmed
UPDATE assessments SET is_confirmed = FALSE,
  assessed_by = (SELECT id FROM employees WHERE first_name = 'Mark' AND last_name = 'Hull')
WHERE employee_id = (SELECT id FROM employees WHERE first_name = 'Mark' AND last_name = 'Hull')
  AND skill_id IN (
    SELECT id FROM skills WHERE name IN (
      'Tooling Selection (Punch & Die Profiles)',
      'Tooling Installation & Changeover',
      'Back Gauge Setup & Positioning'
    ) AND category_id = 6
    AND parent_skill_id = (SELECT id FROM skills WHERE name = 'Bender (Amada Press Brake)' AND category_id = 6)
  );

-- Hannah self-assessed SAP skills — unconfirmed
UPDATE assessments SET is_confirmed = FALSE,
  assessed_by = (SELECT id FROM employees WHERE first_name = 'Hannah' AND last_name = 'Maxwell')
WHERE employee_id = (SELECT id FROM employees WHERE first_name = 'Hannah' AND last_name = 'Maxwell')
  AND skill_id IN (
    SELECT id FROM skills WHERE name IN (
      'SAP — Warehouse Module (Receiving)',
      'SAP — Warehouse Module (Shipping)',
      'SAP — Inventory Transactions & Transfers'
    ) AND category_id = 6
    AND parent_skill_id = (SELECT id FROM skills WHERE name = 'Warehouse' AND category_id = 6)
  );

-- ============================================================
-- SEED DATA: Overdue retrain dates (red dots)
-- ============================================================

-- Pedro Jensen — overdue on safety certs
UPDATE assessments SET retrain_due_date = '2025-12-01', last_trained_date = '2024-12-01'
WHERE employee_id = (SELECT id FROM employees WHERE first_name = 'Pedro' AND last_name = 'Jensen')
  AND skill_id = (SELECT id FROM skills WHERE name = 'Machine Safety & Lockout/Tagout' AND category_id = 6);

UPDATE assessments SET retrain_due_date = '2026-01-15', last_trained_date = '2025-01-15'
WHERE employee_id = (SELECT id FROM employees WHERE first_name = 'Pedro' AND last_name = 'Jensen')
  AND skill_id = (SELECT id FROM skills WHERE name = 'Welding Safety & PPE (Helmet, Gloves, Ventilation)' AND category_id = 6);

-- Carlos — overdue on press brake safety
UPDATE assessments SET retrain_due_date = '2026-02-01', last_trained_date = '2025-02-01'
WHERE employee_id = (SELECT id FROM employees WHERE first_name = 'Carlos' AND last_name = 'Beck')
  AND skill_id = (SELECT id FROM skills WHERE name = 'Press Brake Safety & Pinch Point Awareness' AND category_id = 6);

-- Hannah — overdue on forklift inspection
UPDATE assessments SET retrain_due_date = '2026-01-01', last_trained_date = '2025-01-01'
WHERE employee_id = (SELECT id FROM employees WHERE first_name = 'Hannah' AND last_name = 'Maxwell')
  AND skill_id = (SELECT id FROM skills WHERE name = 'Forklift Daily Pre-Shift Inspection' AND category_id = 6);

-- Gilbert — overdue on hazmat
UPDATE assessments SET retrain_due_date = '2026-02-15', last_trained_date = '2025-02-15'
WHERE employee_id = (SELECT id FROM employees WHERE first_name = 'Gilbert' AND last_name = 'Ross')
  AND skill_id = (SELECT id FROM skills WHERE name = 'Hazardous Material Handling' AND category_id = 6);

-- Grace — overdue on compliance (HR skill, not Operations)
UPDATE assessments SET retrain_due_date = '2026-01-10', last_trained_date = '2025-01-10'
WHERE employee_id = (SELECT id FROM employees WHERE first_name = 'Grace' AND last_name = 'Joseph')
  AND skill_id = (SELECT id FROM skills WHERE name = 'Compliance & Labor Law'
    AND category_id = (SELECT id FROM skill_categories WHERE name = 'HR'));

-- ============================================================
-- SEED DATA: Users (auth accounts for all employees)
-- Password for all: password123
-- Hash: $2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S
-- ============================================================

INSERT INTO users (employee_id, email, password_hash, role) VALUES
    ((SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack'),
     'timothy.mack@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'admin'),
    ((SELECT id FROM employees WHERE first_name = 'Carlos' AND last_name = 'Beck'),
     'carlos.beck@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Elena' AND last_name = 'Dixon'),
     'elena.dixon@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Holly' AND last_name = 'Harrington'),
     'holly.harrington@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Mark' AND last_name = 'Hull'),
     'mark.hull@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Pedro' AND last_name = 'Jensen'),
     'pedro.jensen@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Hannah' AND last_name = 'Maxwell'),
     'hannah.maxwell@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Joey' AND last_name = 'Rivera'),
     'joey.rivera@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Gilbert' AND last_name = 'Ross'),
     'gilbert.ross@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Tammy' AND last_name = 'Sanchez'),
     'tammy.sanchez@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Kurt' AND last_name = 'Lyons'),
     'kurt.lyons@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Beth' AND last_name = 'Austin'),
     'beth.austin@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Grace' AND last_name = 'Joseph'),
     'grace.joseph@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator'),
    ((SELECT id FROM employees WHERE first_name = 'Sarah' AND last_name = 'Kim'),
     'sarah.kim@company.com', '$2b$12$9VtKw2qMrDNq/3afHvWqOuRWRN/TlOc0gpoXAMNzR5BHXTZGLmz5S', 'operator');

-- ============================================================
-- SEED DATA: Reporting Relationships (from existing supervisor_id)
-- ============================================================

-- Fab shop operators → Timothy Mack (Lead/Admin)
INSERT INTO employee_supervisors (employee_id, supervisor_id, is_primary, assigned_by) VALUES
    ((SELECT id FROM employees WHERE first_name = 'Carlos' AND last_name = 'Beck'),
     (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack'),
     TRUE, (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')),
    ((SELECT id FROM employees WHERE first_name = 'Elena' AND last_name = 'Dixon'),
     (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack'),
     TRUE, (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')),
    ((SELECT id FROM employees WHERE first_name = 'Holly' AND last_name = 'Harrington'),
     (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack'),
     TRUE, (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')),
    ((SELECT id FROM employees WHERE first_name = 'Mark' AND last_name = 'Hull'),
     (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack'),
     TRUE, (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack')),
    ((SELECT id FROM employees WHERE first_name = 'Pedro' AND last_name = 'Jensen'),
     (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack'),
     TRUE, (SELECT id FROM employees WHERE first_name = 'Timothy' AND last_name = 'Mack'));
