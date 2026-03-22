# Skill Matrix v1 — Feature Specification

## Overview

Frontline skills management tool for tracking employee proficiency across operations/processes,
identifying training gaps at both the individual and staffing-coverage level, and managing
assessment workflows with self, peer, and manager sign-off.

Single-site deployment. Global skill library.

---

## 1. Proficiency Levels (5 Levels)

| Level | Label       | Harvey Ball | Definition |
|-------|-------------|-------------|------------|
| 0     | Untrained   | ○ (empty)   | Not familiar with the process. No TWI received. |
| 1     | Level 1     | ◔ (quarter) | Received JSA & TWI Job Instruction. Reviewed key points. Performed teach-back. |
| 2     | Level 2     | ◑ (half)    | Can perform with minimal supervision. Demonstrated proper sequence and knowledge of cycle time. |
| 3     | Level 3     | ◕ (three-quarter) | Can perform independently. Meets standard work targets for each component. |
| 4     | Level 4     | ● (full)    | Mastery. Exceeds standard work targets. Can initiate optimization and fix errors. |

Harvey balls render as SVG circles with a filled wedge proportional to the level.

---

## 2. Data Model

### Core Entities

**employees**
- id, name, role, department, team_id, supervisor_id, avatar_url
- last_trained_date (most recent training of any kind)
- is_active

**skills** (hierarchical)
- id, category_id, parent_skill_id, name, description, sort_order
- Also referred to as "operations" or "processes" in manufacturing context

**skill_categories**
- id, name, sort_order (e.g., "Site Safety", "Machining", "Assembly")

**teams**
- id, name

### Assessment & Proficiency

**assessments** (one per employee × skill, stores current proficiency)
- id, employee_id, skill_id
- level (0-4 integer)
- assessed_date
- last_trained_date (skill-specific)
- retrain_due_date (skill-specific, nullable)
- is_overdue (computed or trigger-based)

**assessment_submissions** (individual inputs before final determination)
- id, assessment_id
- submitted_by (employee_id)
- submission_type: 'self' | 'peer' | 'manager'
- level (0-4)
- notes
- submitted_at

**assessment_audit** (history of level changes)
- id, assessment_id, changed_by
- old_level, new_level
- reason, result ('pass'|'fail'), notes
- changed_at

### Gap Analysis

**skill_requirements** (staffing coverage: how many people needed at each level per skill)
- id, skill_id
- level_3_required (integer — how many people needed at Level 3+)
- level_4_required (integer — how many people needed at Level 4)

**role_skill_requirements** (individual gap: what level each role needs per skill)
- id, role_name (varchar), skill_id
- required_level (0-4)

### Peer Assignment

**peer_assignments** (manager controls who can assess whom)
- id, assessor_id (employee), assessee_id (employee), skill_id (nullable = all skills)
- assigned_by (manager employee_id)
- created_at

### Training

**training_owners** (who is responsible for training on each skill)
- id, skill_id, owner_id (employee_id)

---

## 3. Matrix UI

### Main Grid Layout

```
                     │ Emp 1  │ Emp 2  │ Emp 3  │ ... │ Totals
─────────────────────┼────────┼────────┼────────┼─────┤
[Category Header]    │  83%   │  71%   │ 100%   │     │
─────────────────────┼────────┼────────┼────────┼─────┤
  Skill A            │   ◕    │   ◑    │   ●    │     │ L3:2 L4:1
  Skill B            │   ◔    │   ○    │   ◕    │     │ L3:1 L4:0
    └ Sub-skill B1   │   ◑    │   ◔    │   ◕    │     │
─────────────────────┼────────┼────────┼────────┼─────┤
Requirement (L3)     │        │        │        │     │ Need:3 Have:2 GAP:-1
Requirement (L4)     │        │        │        │     │ Need:1 Have:1 OK
─────────────────────┼────────┼────────┼────────┼─────┤
Employee Score       │  14    │   5    │  31    │     │
```

### Employee Column Header
- Avatar / initials
- Name
- Overall completion %
- Score (sum of all levels across skills)
- Last trained date
- Re-train due date (red if overdue)

### Skill Row
- Collapsible tree (categories > skills > sub-skills)
- Harvey ball in each cell
- Red ring/border on Harvey ball when actual < required for that employee's role
- Hover tooltip: level label, last assessed date, who assessed

### Summary Rows (per skill)
- Count of employees at each level (Untrained: X, L1: X, L2: X, L3: X, L4: X)
- Staffing gap: Required at L3 vs actual count at L3+, Required at L4 vs actual at L4
- Color-coded: green = met, red = gap

### Legend Bar
- Fixed bar (top or bottom) showing all 5 Harvey ball states with labels
- Always visible

### Overdue Indicators
- Re-train due date past today → red highlight on employee column header
- Cell-level: if a skill-specific retrain_due_date is past → red dot on Harvey ball

---

## 4. Gap Analysis Views

### View A: Staffing Coverage (per skill)
"Do we have enough people to run this operation?"
- Per skill row: required count at L3, required count at L4
- Actual count at L3+, actual at L4
- Delta shown as: ✓ Met (green) or -N Gap (red)
- Filterable by category, team

### View B: Individual Gap (per employee)
"What does this person need to be trained on?"
- Per employee: list of skills where actual_level < required_level for their role
- Sorted by gap severity (biggest gap first)
- Shows: skill name, current level, required level, last trained, retrain due
- Actionable: link to create training plan or assign peer assessor

---

## 5. Assessment Workflow

### Flow
1. **Manager assigns assessment** → selects employee + skill(s), optionally assigns peers
2. **Self-assessment** → employee submits their own level + notes
3. **Peer assessment** → assigned peers submit their level + notes
4. **Manager review** → sees all submissions side-by-side, sets final level, signs off
5. **Audit log** → records old level → new level, who approved, timestamp

### Peer Assignment Rules
- Manager explicitly assigns who can assess whom (per skill or blanket)
- Peers can only submit for employees they're assigned to
- Peer submissions are advisory — manager makes final call

---

## 6. Admin Panel

### Skills Management
- Full CRUD: add, edit, deactivate, delete skills
- Tree management: drag-and-drop reorder, nest/unnest
- Set training owner per skill
- Set staffing requirements (L3/L4 counts) per skill

### Employee Management
- Full CRUD: add, edit, deactivate
- Assign to team, set supervisor
- Bulk import (CSV)

### Role Requirements
- Define roles (Operator, Technician, Lead, etc.)
- Per role: set required proficiency level for each skill
- Used for individual gap analysis

### Peer Assignment
- Manager selects assessor → assessee pairs
- Bulk assign (e.g., "Tim can assess all of Floor A on Site Safety")

### Training Tracking
- Set retrain intervals per skill (e.g., "every 12 months")
- Override per employee if needed
- Dashboard of upcoming and overdue retraining

---

## 7. Inline Quick-Add (Matrix View)

### Add Employee (column)
- "+" button at end of employee header row
- Popover: name, role, team (minimal fields)
- Employee appears as new column immediately

### Add Skill (row)
- "+" button at end of skill list within a category
- Popover: skill name, parent skill (for nesting)
- Row appears immediately

### Quick Edit
- Click any Harvey ball → dropdown to set level (0-4)
- Shift+click → open full detail panel

---

## 8. Scoring

### Employee Score
- Sum of proficiency levels across all assessed skills
- e.g., Employee with L4+L3+L2+L1 across 4 skills = 4+3+2+1 = 10
- Displayed in employee header and as rightmost column

### Area/Trade Score
- Sum of all employee scores within a team/area
- Displayed as team-level summary

---

## 9. Technical Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: FastAPI + asyncpg
- **Database**: PostgreSQL
- **Auth**: TBD (out of scope for v1 scaffold, but schema supports user roles)

---

## 10. Build Phases

### Phase 1: Core Matrix + Harvey Balls
- Updated schema with 5 levels, requirements tables
- Harvey ball SVG component
- Matrix grid with collapsible tree, employee headers, gap indicators
- Legend bar

### Phase 2: Assessment Workflow
- Assessment submission flow (self → peer → manager)
- Detail panel with all submissions side-by-side
- Manager sign-off action
- Audit trail

### Phase 3: Gap Analysis
- Staffing coverage view (summary rows in matrix)
- Individual gap view (per-employee report)
- Role requirements admin

### Phase 4: Training Tracking
- Last trained / retrain due dates
- Overdue flagging (visual + filterable)
- Training owner assignment

### Phase 5: Admin Panel
- Skills CRUD + tree management
- Employee CRUD + bulk import
- Peer assignment management
- Scoring summaries

### Phase 6: Inline Quick-Add + Polish
- "+" buttons for fast employee/skill addition
- Click-to-edit Harvey balls
- CSV/Excel export
- Print-friendly view
