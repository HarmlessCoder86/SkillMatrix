"""Skill Matrix API — FastAPI backend."""

import csv
import io
import json
import os
import time
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

import asyncpg
from fastapi import FastAPI, HTTPException, Depends, Query, Response, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db import get_pool, close_pool
from auth import (
    get_current_user, require_role,
    hash_password, verify_password, create_token,
    can_create_role, can_confirm, get_user_scope, role_level,
    ADMIN_ROLES, LOG_ROLES,
)
from activity import log_activity

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("skillmatrix.api")


# ── Lifespan ─────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="Skill Matrix API", lifespan=lifespan)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return Response(
        content='{"detail":"Too many requests. Please try again later."}',
        status_code=429,
        media_type="application/json",
    )

# CORS
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost:3001").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# Request logging middleware
from starlette.middleware.base import BaseHTTPMiddleware

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration = round((time.time() - start) * 1000, 1)
        if not request.url.path.startswith("/api/health"):
            logger.info(
                "%s %s %s %sms",
                request.method, request.url.path, response.status_code, duration,
            )
        return response

app.add_middleware(RequestLoggingMiddleware)


# ── Request/Response Models ──────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class AssessmentUpdate(BaseModel):
    level: int
    notes: str | None = None

class SkillCreate(BaseModel):
    category_id: int
    parent_skill_id: int | None = None
    name: str
    description: str | None = None
    sort_order: int = 0
    retrain_days: int | None = None
    requires_cert: bool = False

class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    sort_order: int | None = None
    retrain_days: int | None = None
    category_id: int | None = None
    parent_skill_id: int | None = None
    requires_cert: bool | None = None

class SkillRequirementsUpdate(BaseModel):
    level_3_required: int = 0
    level_4_required: int = 0

class RoleRequirementUpdate(BaseModel):
    role_name: str
    skill_id: int
    required_level: int

class RetrainDateUpdate(BaseModel):
    retrain_due_date: str | None = None
    last_trained_date: str | None = None

class EmployeeRoleCreate(BaseModel):
    name: str
    department: str | None = None
    description: str | None = None

class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    role: str | None = None
    department: str | None = None
    team_id: int | None = None
    supervisor_id: int | None = None

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    role: str = "operator"
    department: str | None = None
    team_id: int | None = None
    job_title: str | None = None

class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    role: str | None = None
    department: str | None = None
    team_id: int | None = None
    job_title: str | None = None

class PasswordChange(BaseModel):
    password: str

class AssignmentCreate(BaseModel):
    employee_id: int
    supervisor_id: int
    is_primary: bool = False

class ConfirmAction(BaseModel):
    pass

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    department: str | None = None
    job_title: str | None = None

class SavedSearchCreate(BaseModel):
    name: str
    config: dict


# ── Health ───────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.fetchval("SELECT 1")
    return {"status": "ok", "db": result == 1}


# ══════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ══════════════════════════════════════════════════════════════

@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest):
    pool = await get_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow("""
            SELECT u.id, u.employee_id, u.email, u.password_hash, u.role, u.is_active,
                   e.first_name, e.last_name, e.department
            FROM users u
            JOIN employees e ON e.id = u.employee_id
            WHERE LOWER(u.email) = LOWER($1)
        """, body.email)

        if not user or not verify_password(body.password, user["password_hash"]):
            raise HTTPException(401, "Invalid email or password")

        if not user["is_active"]:
            raise HTTPException(403, "Your account is pending approval by an administrator.")

        # Update last login
        await conn.execute("UPDATE users SET last_login = NOW() WHERE id = $1", user["id"])

        # Log activity
        await log_activity(conn, user["employee_id"], "user.login", "user", user["id"],
                          f"{user['first_name']} {user['last_name']} logged in")

    token = create_token(user["id"], user["employee_id"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "employee_id": user["employee_id"],
            "email": user["email"],
            "role": user["role"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "department": user["department"],
        },
    }


@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT u.id, u.employee_id, u.email, u.role,
                   e.first_name, e.last_name, e.department, e.team_id
            FROM users u
            JOIN employees e ON e.id = u.employee_id
            WHERE u.id = $1
        """, user["user_id"])
    if not row:
        raise HTTPException(404, "User not found")
    return dict(row)


@app.get("/api/auth/registration-options")
async def registration_options():
    """Return departments and job titles for the registration form (public)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        dept_rows = await conn.fetch(
            "SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND is_active = TRUE ORDER BY department"
        )
        role_rows = await conn.fetch(
            "SELECT id, name FROM employee_roles WHERE is_active = TRUE ORDER BY name"
        )
    return {
        "departments": [r["department"] for r in dept_rows],
        "employee_roles": [{"id": r["id"], "name": r["name"]} for r in role_rows],
    }


@app.post("/api/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest):
    """Self-registration: creates inactive employee + user pending admin approval."""
    if not body.first_name or not body.last_name or not body.email or not body.password:
        raise HTTPException(400, "First name, last name, email, and password are required.")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Check email uniqueness
        existing = await conn.fetchval(
            "SELECT id FROM users WHERE LOWER(email) = LOWER($1)", body.email
        )
        if existing:
            raise HTTPException(409, "An account with this email already exists.")

        # Create inactive employee
        emp_id = await conn.fetchval("""
            INSERT INTO employees (first_name, last_name, role, department, is_active)
            VALUES ($1, $2, $3, $4, FALSE)
            RETURNING id
        """, body.first_name, body.last_name, body.job_title, body.department)

        # Create inactive user
        pw_hash = hash_password(body.password)
        user_id = await conn.fetchval("""
            INSERT INTO users (employee_id, email, password_hash, role, is_active)
            VALUES ($1, $2, $3, 'operator', FALSE)
            RETURNING id
        """, emp_id, body.email, pw_hash)

        await log_activity(
            conn, emp_id, "user.registered", "user", user_id,
            f"{body.first_name} {body.last_name} self-registered (pending approval)"
        )

    return {"message": "Account created! An administrator will review and activate your account."}


# ══════════════════════════════════════════════════════════════
# USER MANAGEMENT (Admin Panel)
# ══════════════════════════════════════════════════════════════

@app.get("/api/users")
async def list_users(user: dict = Depends(require_role("admin", "manager"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        scope = await get_user_scope(conn, user["employee_id"], user["role"])
        rows = await conn.fetch("""
            SELECT u.id, u.employee_id, u.email, u.role, u.is_active, u.last_login, u.created_at,
                   e.first_name, e.last_name, e.department, e.team_id, e.role AS job_title,
                   t.name AS team_name
            FROM users u
            JOIN employees e ON e.id = u.employee_id
            LEFT JOIN teams t ON t.id = e.team_id
            WHERE u.employee_id = ANY($1) AND u.is_active = TRUE
            ORDER BY e.last_name, e.first_name
        """, scope)
    return [dict(r) for r in rows]


@app.post("/api/users", status_code=201)
async def create_user(body: UserCreate, user: dict = Depends(require_role("admin", "manager"))):
    if not can_create_role(user["role"], body.role):
        raise HTTPException(403, f"Cannot create users with role '{body.role}'")

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Normalize email to lowercase
        email = body.email.strip().lower()

        # Check email uniqueness
        existing = await conn.fetchval("SELECT id FROM users WHERE LOWER(email) = $1", email)
        if existing:
            raise HTTPException(409, "Email already in use")

        # Create employee first
        emp = await conn.fetchrow("""
            INSERT INTO employees (first_name, last_name, role, department, team_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        """, body.first_name, body.last_name, body.job_title, body.department, body.team_id)

        # Create user
        password_hash = hash_password(body.password)
        new_user = await conn.fetchrow("""
            INSERT INTO users (employee_id, email, password_hash, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, employee_id, email, role
        """, emp["id"], email, password_hash, body.role)

        await log_activity(conn, user["employee_id"], "user.created", "user", new_user["id"],
                          f"Created user {body.first_name} {body.last_name} ({body.role})",
                          new_value={"email": body.email, "role": body.role, "department": body.department})

    return dict(new_user)


@app.put("/api/users/{user_id}")
async def update_user(user_id: int, body: UserUpdate,
                      user: dict = Depends(require_role("admin", "manager"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow("""
            SELECT u.id, u.employee_id, u.email, u.role,
                   e.first_name, e.last_name, e.department, e.team_id, e.role AS job_title
            FROM users u JOIN employees e ON e.id = u.employee_id
            WHERE u.id = $1
        """, user_id)
        if not target:
            raise HTTPException(404, "User not found")

        # Protect admin users from non-admin editors
        if target["role"] == "admin" and user["role"] != "admin":
            raise HTTPException(403, "Only admins can modify admin users")

        # Check scope
        scope = await get_user_scope(conn, user["employee_id"], user["role"])
        if target["employee_id"] not in scope:
            raise HTTPException(403, "User not in your scope")

        # Check role change permission
        if body.role and body.role != target["role"]:
            if not can_create_role(user["role"], body.role):
                raise HTTPException(403, f"Cannot assign role '{body.role}'")
            # If downgrading from supervisor+, dissolve their supervisory relationships
            if role_level(target["role"]) >= role_level("supervisor") and role_level(body.role) < role_level("supervisor"):
                await conn.execute(
                    "DELETE FROM employee_supervisors WHERE supervisor_id = $1",
                    target["employee_id"]
                )

        old_values = {"email": target["email"], "role": target["role"],
                      "first_name": target["first_name"], "last_name": target["last_name"],
                      "department": target["department"]}

        # Update employee
        if body.first_name or body.last_name or body.department is not None or body.team_id is not None or body.job_title:
            await conn.execute("""
                UPDATE employees SET
                    first_name = COALESCE($1, first_name),
                    last_name = COALESCE($2, last_name),
                    department = COALESCE($3, department),
                    team_id = COALESCE($4, team_id),
                    role = COALESCE($5, role)
                WHERE id = $6
            """, body.first_name, body.last_name, body.department, body.team_id,
                body.job_title, target["employee_id"])

        # Update user
        update_email = body.email.strip().lower() if body.email else None
        if update_email or body.role:
            await conn.execute("""
                UPDATE users SET
                    email = COALESCE($1, email),
                    role = COALESCE($2, role)
                WHERE id = $3
            """, update_email, body.role, user_id)

        new_values = {
            "email": body.email or target["email"],
            "role": body.role or target["role"],
            "first_name": body.first_name or target["first_name"],
            "last_name": body.last_name or target["last_name"],
            "department": body.department if body.department is not None else target["department"],
        }

        await log_activity(conn, user["employee_id"], "user.updated", "user", user_id,
                          f"Updated user {new_values['first_name']} {new_values['last_name']}",
                          old_value=old_values, new_value=new_values)

    return {"status": "updated"}


@app.put("/api/users/{user_id}/password")
async def change_password(user_id: int, body: PasswordChange,
                          user: dict = Depends(require_role("admin"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow(
            "SELECT id, employee_id FROM users WHERE id = $1", user_id)
        if not target:
            raise HTTPException(404, "User not found")

        password_hash = hash_password(body.password)
        await conn.execute(
            "UPDATE users SET password_hash = $1 WHERE id = $2",
            password_hash, user_id)

        await log_activity(conn, user["employee_id"], "user.password_changed", "user", user_id,
                          "Password changed by admin")

    return {"status": "password_changed"}


@app.put("/api/users/{user_id}/deactivate")
async def deactivate_user(user_id: int,
                          user: dict = Depends(require_role("admin"))):
    if user_id == user["user_id"]:
        raise HTTPException(400, "Cannot deactivate your own account")

    pool = await get_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow("""
            SELECT u.id, u.employee_id, u.role, e.first_name, e.last_name
            FROM users u JOIN employees e ON e.id = u.employee_id WHERE u.id = $1
        """, user_id)
        if not target:
            raise HTTPException(404, "User not found")

        scope = await get_user_scope(conn, user["employee_id"], user["role"])
        if target["employee_id"] not in scope:
            raise HTTPException(403, "User not in your scope")

        await conn.execute("UPDATE users SET is_active = FALSE WHERE id = $1", user_id)
        await conn.execute("UPDATE employees SET is_active = FALSE WHERE id = $1", target["employee_id"])

        # Dissolve supervisory relationships
        await conn.execute(
            "DELETE FROM employee_supervisors WHERE supervisor_id = $1",
            target["employee_id"]
        )

        await log_activity(conn, user["employee_id"], "user.deactivated", "user", user_id,
                          f"Deactivated user {target['first_name']} {target['last_name']}")

    return {"status": "deactivated"}


@app.get("/api/users/archived")
async def list_archived_users(user: dict = Depends(require_role("admin", "manager"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT u.id, u.employee_id, u.email, u.role, u.is_active, u.last_login, u.created_at,
                   e.first_name, e.last_name, e.department, e.team_id, e.role AS job_title,
                   t.name AS team_name
            FROM users u
            JOIN employees e ON e.id = u.employee_id
            LEFT JOIN teams t ON t.id = e.team_id
            WHERE u.is_active = FALSE
            ORDER BY e.last_name, e.first_name
        """)
    return [dict(r) for r in rows]


@app.put("/api/users/{user_id}/reactivate")
async def reactivate_user(user_id: int,
                          user: dict = Depends(require_role("admin", "manager"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow("""
            SELECT u.id, u.employee_id, u.is_active, e.first_name, e.last_name
            FROM users u JOIN employees e ON e.id = u.employee_id WHERE u.id = $1
        """, user_id)
        if not target:
            raise HTTPException(404, "User not found")
        if target["is_active"]:
            raise HTTPException(400, "User is already active")

        await conn.execute("UPDATE users SET is_active = TRUE WHERE id = $1", user_id)
        await conn.execute("UPDATE employees SET is_active = TRUE WHERE id = $1", target["employee_id"])

        await log_activity(conn, user["employee_id"], "user.reactivated", "user", user_id,
                          f"Reactivated user {target['first_name']} {target['last_name']}")

    return {"status": "reactivated"}


# ══════════════════════════════════════════════════════════════
# ASSIGNMENT MANAGEMENT (Reporting Relationships)
# ══════════════════════════════════════════════════════════════

@app.get("/api/assignments")
async def list_assignments(user: dict = Depends(require_role("admin", "manager"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        scope = await get_user_scope(conn, user["employee_id"], user["role"])
        rows = await conn.fetch("""
            SELECT es.id, es.employee_id, es.supervisor_id, es.is_primary, es.created_at,
                   e.first_name || ' ' || e.last_name AS employee_name, e.role AS employee_role, e.department,
                   s.first_name || ' ' || s.last_name AS supervisor_name,
                   su.role AS supervisor_user_role
            FROM employee_supervisors es
            JOIN employees e ON e.id = es.employee_id
            JOIN employees s ON s.id = es.supervisor_id
            LEFT JOIN users su ON su.employee_id = s.id
            WHERE es.employee_id = ANY($1) OR es.supervisor_id = ANY($1)
            ORDER BY e.last_name, e.first_name
        """, scope)
    return [dict(r) for r in rows]


@app.post("/api/assignments", status_code=201)
async def create_assignment(body: AssignmentCreate,
                            user: dict = Depends(require_role("admin", "manager"))):
    if body.employee_id == body.supervisor_id:
        raise HTTPException(400, "Cannot assign someone as their own supervisor")

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Prevent circular reporting
        existing = await conn.fetchval(
            "SELECT id FROM employee_supervisors WHERE employee_id = $1 AND supervisor_id = $2",
            body.supervisor_id, body.employee_id
        )
        if existing:
            raise HTTPException(400, "Circular reporting: target is already a supervisor of the assignee")

        scope = await get_user_scope(conn, user["employee_id"], user["role"])
        if body.employee_id not in scope:
            raise HTTPException(403, "Employee not in your scope")

        try:
            row = await conn.fetchrow("""
                INSERT INTO employee_supervisors (employee_id, supervisor_id, is_primary, assigned_by)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            """, body.employee_id, body.supervisor_id, body.is_primary, user["employee_id"])
        except asyncpg.UniqueViolationError:
            raise HTTPException(409, "Assignment already exists")

        emp = await conn.fetchrow("SELECT first_name, last_name FROM employees WHERE id = $1", body.employee_id)
        sup = await conn.fetchrow("SELECT first_name, last_name FROM employees WHERE id = $1", body.supervisor_id)

        await log_activity(conn, user["employee_id"], "assignment.created", "assignment", row["id"],
                          f"Assigned {emp['first_name']} {emp['last_name']} to {sup['first_name']} {sup['last_name']}",
                          new_value={"employee_id": body.employee_id, "supervisor_id": body.supervisor_id})

    return {"id": row["id"], "status": "created"}


@app.delete("/api/assignments/{assignment_id}")
async def delete_assignment(assignment_id: int,
                            user: dict = Depends(require_role("admin", "manager"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT es.id, es.employee_id, es.supervisor_id,
                   e.first_name || ' ' || e.last_name AS employee_name,
                   s.first_name || ' ' || s.last_name AS supervisor_name
            FROM employee_supervisors es
            JOIN employees e ON e.id = es.employee_id
            JOIN employees s ON s.id = es.supervisor_id
            WHERE es.id = $1
        """, assignment_id)
        if not row:
            raise HTTPException(404, "Assignment not found")

        await conn.execute("DELETE FROM employee_supervisors WHERE id = $1", assignment_id)

        await log_activity(conn, user["employee_id"], "assignment.deleted", "assignment", assignment_id,
                          f"Removed {row['employee_name']} from {row['supervisor_name']}",
                          old_value={"employee_id": row["employee_id"], "supervisor_id": row["supervisor_id"]})

    return {"status": "deleted"}


# ══════════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════════

@app.get("/api/dashboard")
async def get_dashboard(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        scope = await get_user_scope(conn, user["employee_id"], user["role"])

        # 1. Overdue retraining
        overdue = await conn.fetch("""
            SELECT a.id, a.employee_id, a.skill_id, a.level, a.retrain_due_date, a.last_trained_date,
                   e.first_name || ' ' || e.last_name AS employee_name,
                   s.name AS skill_name,
                   CURRENT_DATE - a.retrain_due_date AS days_overdue
            FROM assessments a
            JOIN employees e ON e.id = a.employee_id
            JOIN skills s ON s.id = a.skill_id
            WHERE a.retrain_due_date < CURRENT_DATE
              AND e.is_active = TRUE AND s.is_active = TRUE
              AND a.employee_id = ANY($1)
            ORDER BY a.retrain_due_date ASC
            LIMIT 50
        """, scope)

        # 2. Pending confirmations
        pending = []
        if can_confirm(user["role"]):
            pending = await conn.fetch("""
                SELECT a.id, a.employee_id, a.skill_id, a.level, a.previous_level,
                       a.assessed_by, a.assessed_date, a.notes,
                       e.first_name || ' ' || e.last_name AS employee_name,
                       s.name AS skill_name,
                       ab.first_name || ' ' || ab.last_name AS assessed_by_name
                FROM assessments a
                JOIN employees e ON e.id = a.employee_id
                JOIN skills s ON s.id = a.skill_id
                LEFT JOIN employees ab ON ab.id = a.assessed_by
                WHERE a.is_confirmed = FALSE
                  AND e.is_active = TRUE AND s.is_active = TRUE
                  AND a.employee_id = ANY($1)
                ORDER BY a.assessed_date DESC
                LIMIT 50
            """, scope)
        else:
            # For non-confirming roles, show their own pending submissions
            pending = await conn.fetch("""
                SELECT a.id, a.employee_id, a.skill_id, a.level, a.previous_level,
                       a.assessed_date, s.name AS skill_name,
                       e.first_name || ' ' || e.last_name AS employee_name
                FROM assessments a
                JOIN employees e ON e.id = a.employee_id
                JOIN skills s ON s.id = a.skill_id
                WHERE a.is_confirmed = FALSE AND a.assessed_by = $1
                  AND e.is_active = TRUE AND s.is_active = TRUE
                ORDER BY a.assessed_date DESC
                LIMIT 20
            """, user["employee_id"])

        # 3. Staffing gaps (operations skills only)
        staffing_gaps = []
        if user["role"] not in ("operator",):
            staffing_gaps = await conn.fetch("""
                SELECT sr.skill_id, s.name AS skill_name,
                       sr.level_3_required, sr.level_4_required,
                       COUNT(CASE WHEN a.level >= 3 THEN 1 END) AS level_3_actual,
                       COUNT(CASE WHEN a.level >= 4 THEN 1 END) AS level_4_actual
                FROM skill_requirements sr
                JOIN skills s ON s.id = sr.skill_id
                LEFT JOIN assessments a ON a.skill_id = sr.skill_id
                    AND a.employee_id = ANY($1)
                GROUP BY sr.skill_id, s.name, sr.level_3_required, sr.level_4_required
                HAVING COUNT(CASE WHEN a.level >= 3 THEN 1 END) < sr.level_3_required
                    OR COUNT(CASE WHEN a.level >= 4 THEN 1 END) < sr.level_4_required
                ORDER BY (sr.level_3_required - COUNT(CASE WHEN a.level >= 3 THEN 1 END)) DESC
                LIMIT 20
            """, scope)

        # 4. Training priorities (gaps between current level and role requirements)
        training_priorities = await conn.fetch("""
            SELECT rsr.role_name, rsr.skill_id, rsr.required_level,
                   s.name AS skill_name,
                   a.employee_id, e.first_name || ' ' || e.last_name AS employee_name,
                   COALESCE(a.level, 0) AS current_level,
                   rsr.required_level - COALESCE(a.level, 0) AS gap_size
            FROM role_skill_requirements rsr
            JOIN skills s ON s.id = rsr.skill_id
            JOIN employees e ON e.role = rsr.role_name AND e.is_active = TRUE
            LEFT JOIN assessments a ON a.employee_id = e.id AND a.skill_id = rsr.skill_id
            WHERE COALESCE(a.level, 0) < rsr.required_level
              AND e.id = ANY($1)
            ORDER BY (rsr.required_level - COALESCE(a.level, 0)) DESC, e.last_name
            LIMIT 30
        """, scope)

        # 5. Recent activity
        recent = await conn.fetch("""
            SELECT al.id, al.action_type, al.entity_type, al.description, al.created_at,
                   e.first_name || ' ' || e.last_name AS actor_name
            FROM activity_log al
            LEFT JOIN employees e ON e.id = al.actor_id
            WHERE al.actor_id = ANY($1) OR al.entity_id = ANY($1)
            ORDER BY al.created_at DESC
            LIMIT 20
        """, scope)

        # 6. Expiring soon (within 30 days, not yet overdue)
        expiring_soon = await conn.fetch("""
            SELECT a.id, a.employee_id, a.skill_id, a.level, a.retrain_due_date,
                   e.first_name || ' ' || e.last_name AS employee_name,
                   s.name AS skill_name,
                   a.retrain_due_date - CURRENT_DATE AS days_remaining
            FROM assessments a
            JOIN employees e ON e.id = a.employee_id
            JOIN skills s ON s.id = a.skill_id
            WHERE a.retrain_due_date >= CURRENT_DATE
              AND a.retrain_due_date <= CURRENT_DATE + INTERVAL '30 days'
              AND e.is_active = TRUE AND s.is_active = TRUE
              AND a.employee_id = ANY($1)
            ORDER BY a.retrain_due_date ASC
            LIMIT 50
        """, scope)

    return {
        "overdue": [dict(r) for r in overdue],
        "expiring_soon": [dict(r) for r in expiring_soon],
        "pending": [dict(r) for r in pending],
        "staffing_gaps": [dict(r) for r in staffing_gaps],
        "training_priorities": [dict(r) for r in training_priorities],
        "recent_activity": [dict(r) for r in recent],
        "can_confirm": can_confirm(user["role"]),
    }


# ══════════════════════════════════════════════════════════════
# ACTIVITY LOG
# ══════════════════════════════════════════════════════════════

@app.get("/api/activity-log")
async def get_activity_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    action_type: str | None = None,
    actor_id: int | None = None,
    entity_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    user: dict = Depends(require_role(*LOG_ROLES)),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        scope = await get_user_scope(conn, user["employee_id"], user["role"])

        where = ["(al.actor_id = ANY($1) OR al.entity_id = ANY($1))"]
        params: list = [scope]
        idx = 2

        if action_type:
            where.append(f"al.action_type = ${idx}")
            params.append(action_type)
            idx += 1
        if actor_id:
            where.append(f"al.actor_id = ${idx}")
            params.append(actor_id)
            idx += 1
        if entity_type:
            where.append(f"al.entity_type = ${idx}")
            params.append(entity_type)
            idx += 1
        if date_from:
            where.append(f"al.created_at >= ${idx}::timestamptz")
            params.append(date_from)
            idx += 1
        if date_to:
            where.append(f"al.created_at <= ${idx}::timestamptz + interval '1 day'")
            params.append(date_to)
            idx += 1
        if search:
            where.append(f"al.description ILIKE ${idx}")
            params.append(f"%{search}%")
            idx += 1

        where_clause = " AND ".join(where)

        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM activity_log al WHERE {where_clause}", *params
        )

        offset = (page - 1) * per_page
        params.append(per_page)
        limit_idx = idx
        idx += 1
        params.append(offset)
        offset_idx = idx
        rows = await conn.fetch(f"""
            SELECT al.id, al.actor_id, al.action_type, al.entity_type, al.entity_id,
                   al.description, al.old_value, al.new_value, al.created_at,
                   e.first_name || ' ' || e.last_name AS actor_name
            FROM activity_log al
            LEFT JOIN employees e ON e.id = al.actor_id
            WHERE {where_clause}
            ORDER BY al.created_at DESC
            LIMIT ${limit_idx} OFFSET ${offset_idx}
        """, *params)

    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@app.get("/api/activity-log/export")
async def export_activity_log(
    action_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    user: dict = Depends(require_role(*LOG_ROLES)),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        scope = await get_user_scope(conn, user["employee_id"], user["role"])

        where = ["(al.actor_id = ANY($1) OR al.entity_id = ANY($1))"]
        params: list = [scope]
        idx = 2

        if action_type:
            where.append(f"al.action_type = ${idx}")
            params.append(action_type)
            idx += 1
        if date_from:
            where.append(f"al.created_at >= ${idx}::timestamptz")
            params.append(date_from)
            idx += 1
        if date_to:
            where.append(f"al.created_at <= ${idx}::timestamptz + interval '1 day'")
            params.append(date_to)
            idx += 1

        rows = await conn.fetch(f"""
            SELECT al.created_at, e.first_name || ' ' || e.last_name AS actor,
                   al.action_type, al.entity_type, al.description
            FROM activity_log al
            LEFT JOIN employees e ON e.id = al.actor_id
            WHERE {" AND ".join(where)}
            ORDER BY al.created_at DESC
            LIMIT 50000
        """, *params)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Actor", "Action", "Entity", "Description"])
    for r in rows:
        writer.writerow([r["created_at"], r["actor"], r["action_type"], r["entity_type"], r["description"]])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=activity_log.csv"},
    )


# ══════════════════════════════════════════════════════════════
# EMPLOYEE ROLES (job titles: CNC Operator, Bender, etc.)
# ══════════════════════════════════════════════════════════════

@app.get("/api/employee-roles")
async def list_employee_roles(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT er.id, er.name, er.department, er.description,
                   COUNT(e.id) AS employee_count
            FROM employee_roles er
            LEFT JOIN employees e ON e.role = er.name AND e.is_active = TRUE
            WHERE er.is_active = TRUE
            GROUP BY er.id
            ORDER BY er.name
        """)
    return [dict(r) for r in rows]


@app.post("/api/employee-roles", status_code=201)
async def create_employee_role(body: EmployeeRoleCreate, user: dict = Depends(require_role("admin", "manager"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                "INSERT INTO employee_roles (name, department, description) VALUES ($1, $2, $3) RETURNING id, name",
                body.name.strip(), body.department, body.description,
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(409, f"Role '{body.name}' already exists")

        await log_activity(conn, user["employee_id"], "role.created", "employee_role", row["id"],
                          f"Created employee role: {row['name']}")
    return dict(row)


@app.put("/api/employee-roles/{role_id}")
async def update_employee_role(role_id: int, body: EmployeeRoleCreate, user: dict = Depends(require_role("admin", "manager"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        old = await conn.fetchrow("SELECT name FROM employee_roles WHERE id = $1", role_id)
        if not old:
            raise HTTPException(404, "Role not found")

        async with conn.transaction():
            try:
                await conn.execute(
                    "UPDATE employee_roles SET name = $1, department = $2, description = $3 WHERE id = $4",
                    body.name.strip(), body.department, body.description, role_id,
                )
            except asyncpg.UniqueViolationError:
                raise HTTPException(409, f"Role '{body.name}' already exists")

            # Update employees and role_skill_requirements that reference the old name
            if old["name"] != body.name.strip():
                await conn.execute("UPDATE employees SET role = $1 WHERE role = $2", body.name.strip(), old["name"])
                await conn.execute("UPDATE role_skill_requirements SET role_name = $1 WHERE role_name = $2", body.name.strip(), old["name"])

            await log_activity(conn, user["employee_id"], "role.updated", "employee_role", role_id,
                              f"Updated employee role: {old['name']} → {body.name.strip()}",
                              old_value={"name": old["name"]}, new_value={"name": body.name.strip()})
    return {"ok": True}


@app.delete("/api/employee-roles/{role_id}")
async def delete_employee_role(role_id: int, user: dict = Depends(require_role("admin", "manager"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        old = await conn.fetchrow("SELECT name FROM employee_roles WHERE id = $1 AND is_active = TRUE", role_id)
        if not old:
            raise HTTPException(404, "Role not found")

        await conn.execute("UPDATE employee_roles SET is_active = FALSE WHERE id = $1", role_id)

        await log_activity(conn, user["employee_id"], "role.deleted", "employee_role", role_id,
                          f"Deleted employee role: {old['name']}")
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
# TEAMS
# ══════════════════════════════════════════════════════════════

@app.get("/api/teams")
async def list_teams(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, name FROM teams ORDER BY name")
    return [dict(r) for r in rows]


# ══════════════════════════════════════════════════════════════
# SKILL CATEGORIES
# ══════════════════════════════════════════════════════════════

@app.get("/api/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, name, department, sort_order FROM skill_categories WHERE is_active = TRUE ORDER BY sort_order"
        )
    return [dict(r) for r in rows]


@app.get("/api/departments")
async def list_departments(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND is_active = TRUE ORDER BY department"
        )
    return [r["department"] for r in rows]


# ══════════════════════════════════════════════════════════════
# SKILLS (tree)
# ══════════════════════════════════════════════════════════════

@app.get("/api/skills")
async def list_skills(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT s.id, s.category_id, s.parent_skill_id, s.name, s.description,
                   s.sort_order, s.retrain_days, s.requires_cert, sc.name AS category_name
            FROM skills s
            JOIN skill_categories sc ON sc.id = s.category_id
            WHERE s.is_active = TRUE AND sc.is_active = TRUE
            ORDER BY sc.sort_order, s.sort_order
        """)
    return [dict(r) for r in rows]


@app.post("/api/skills", status_code=201)
async def create_skill(skill: SkillCreate, user: dict = Depends(require_role("admin", "manager", "supervisor"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO skills (category_id, parent_skill_id, name, description, sort_order, retrain_days, requires_cert)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, category_id, parent_skill_id, name, description, sort_order, retrain_days, requires_cert
        """, skill.category_id, skill.parent_skill_id, skill.name, skill.description, skill.sort_order, skill.retrain_days, skill.requires_cert)

        await conn.execute("""
            INSERT INTO assessments (employee_id, skill_id, level, is_confirmed)
            SELECT id, $1, 0, TRUE FROM employees WHERE is_active = TRUE
        """, row["id"])

        await log_activity(conn, user["employee_id"], "skill.created", "skill", row["id"],
                          f"Created skill '{skill.name}'",
                          new_value={"name": skill.name, "category_id": skill.category_id})

    return dict(row)


@app.put("/api/skills/{skill_id}")
async def update_skill(skill_id: int, body: SkillUpdate,
                       user: dict = Depends(require_role("admin", "manager", "supervisor"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        skill = await conn.fetchrow("SELECT id, name FROM skills WHERE id = $1 AND is_active = TRUE", skill_id)
        if not skill:
            raise HTTPException(404, "Skill not found")

        await conn.execute("""
            UPDATE skills SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                sort_order = COALESCE($3, sort_order),
                retrain_days = $4,
                category_id = COALESCE($5, category_id),
                parent_skill_id = $6,
                requires_cert = COALESCE($7, requires_cert)
            WHERE id = $8
        """, body.name, body.description, body.sort_order, body.retrain_days, body.category_id, body.parent_skill_id, body.requires_cert, skill_id)

        await log_activity(conn, user["employee_id"], "skill.updated", "skill", skill_id,
                          f"Updated skill '{body.name or skill['name']}'")

    return {"status": "updated"}


@app.delete("/api/skills/{skill_id}")
async def deactivate_skill(skill_id: int, user: dict = Depends(require_role("admin", "manager", "supervisor"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        skill = await conn.fetchrow("SELECT id, name FROM skills WHERE id = $1 AND is_active = TRUE", skill_id)
        if not skill:
            raise HTTPException(404, "Skill not found")

        await conn.execute("UPDATE skills SET is_active = FALSE WHERE id = $1", skill_id)

        await log_activity(conn, user["employee_id"], "skill.deactivated", "skill", skill_id,
                          f"Deactivated skill '{skill['name']}'")

    return {"status": "deactivated"}


# ══════════════════════════════════════════════════════════════
# SKILL REQUIREMENTS (Staffing Targets)
# ══════════════════════════════════════════════════════════════

@app.get("/api/skill-requirements")
async def list_skill_requirements(user: dict = Depends(require_role("admin", "manager", "supervisor"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT sr.id, sr.skill_id, sr.level_3_required, sr.level_4_required,
                   s.name AS skill_name
            FROM skill_requirements sr
            JOIN skills s ON s.id = sr.skill_id
            WHERE s.is_active = TRUE
            ORDER BY s.name
        """)
    return [dict(r) for r in rows]


@app.put("/api/skills/{skill_id}/requirements")
async def update_skill_requirements(skill_id: int, body: SkillRequirementsUpdate,
                                     user: dict = Depends(require_role("admin", "manager"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        skill = await conn.fetchrow("SELECT id, name FROM skills WHERE id = $1", skill_id)
        if not skill:
            raise HTTPException(404, "Skill not found")

        await conn.execute("""
            INSERT INTO skill_requirements (skill_id, level_3_required, level_4_required)
            VALUES ($1, $2, $3)
            ON CONFLICT (skill_id) DO UPDATE SET
                level_3_required = EXCLUDED.level_3_required,
                level_4_required = EXCLUDED.level_4_required
        """, skill_id, body.level_3_required, body.level_4_required)

        await log_activity(conn, user["employee_id"], "skill.requirements_updated", "skill", skill_id,
                          f"Updated staffing requirements for '{skill['name']}': L3={body.level_3_required}, L4={body.level_4_required}")

    return {"status": "updated"}


# ══════════════════════════════════════════════════════════════
# ROLE REQUIREMENTS (Per-Role Skill Levels)
# ══════════════════════════════════════════════════════════════

@app.get("/api/role-requirements")
async def list_role_requirements(user: dict = Depends(require_role("admin", "manager", "supervisor"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT rsr.id, rsr.role_name, rsr.skill_id, rsr.required_level,
                   s.name AS skill_name
            FROM role_skill_requirements rsr
            JOIN skills s ON s.id = rsr.skill_id
            WHERE s.is_active = TRUE
            ORDER BY rsr.role_name, s.name
        """)
    return [dict(r) for r in rows]


@app.put("/api/role-requirements")
async def upsert_role_requirement(body: RoleRequirementUpdate,
                                   user: dict = Depends(require_role("admin", "manager"))):
    if body.required_level < 0 or body.required_level > 4:
        raise HTTPException(400, "Required level must be 0-4")

    pool = await get_pool()
    async with pool.acquire() as conn:
        skill = await conn.fetchrow("SELECT id, name FROM skills WHERE id = $1", body.skill_id)
        if not skill:
            raise HTTPException(404, "Skill not found")

        if body.required_level == 0:
            # Remove requirement
            await conn.execute(
                "DELETE FROM role_skill_requirements WHERE role_name = $1 AND skill_id = $2",
                body.role_name, body.skill_id)
        else:
            await conn.execute("""
                INSERT INTO role_skill_requirements (role_name, skill_id, required_level)
                VALUES ($1, $2, $3)
                ON CONFLICT (role_name, skill_id) DO UPDATE SET required_level = EXCLUDED.required_level
            """, body.role_name, body.skill_id, body.required_level)

        await log_activity(conn, user["employee_id"], "role_requirement.updated", "skill", body.skill_id,
                          f"Set {body.role_name} requirement for '{skill['name']}' to L{body.required_level}")

    return {"status": "updated"}


@app.delete("/api/role-requirements/{req_id}")
async def delete_role_requirement(req_id: int,
                                   user: dict = Depends(require_role("admin", "manager"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, role_name, skill_id FROM role_skill_requirements WHERE id = $1", req_id)
        if not row:
            raise HTTPException(404, "Requirement not found")
        await conn.execute("DELETE FROM role_skill_requirements WHERE id = $1", req_id)
    return {"status": "deleted"}


# ══════════════════════════════════════════════════════════════
# EMPLOYEES
# ══════════════════════════════════════════════════════════════

@app.get("/api/employees")
async def list_employees(department: str | None = None, team_id: int | None = None,
                         supervisor_id: int | None = None,
                         supervisors_only: bool = False,
                         user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = """
            SELECT id, first_name, last_name, role, department, team_id,
                   supervisor_id, avatar_url, last_trained_date, hire_date
            FROM employees WHERE is_active = TRUE
        """
        params = []
        idx = 1
        if department:
            query += f" AND department = ${idx}"
            params.append(department)
            idx += 1
        if team_id:
            query += f" AND team_id = ${idx}"
            params.append(team_id)
            idx += 1
        if supervisor_id:
            query += f" AND supervisor_id = ${idx}"
            params.append(supervisor_id)
            idx += 1
        if supervisors_only:
            query += " AND id IN (SELECT employee_id FROM users WHERE role IN ('supervisor', 'manager', 'admin'))"
        query += " ORDER BY department, last_name, first_name"
        rows = await conn.fetch(query, *params)
    return [dict(r) for r in rows]


@app.post("/api/employees", status_code=201)
async def create_employee(emp: EmployeeCreate, user: dict = Depends(require_role("admin", "manager", "supervisor"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO employees (first_name, last_name, role, department, team_id, supervisor_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, first_name, last_name, role, department, team_id, supervisor_id
        """, emp.first_name, emp.last_name, emp.role, emp.department, emp.team_id, emp.supervisor_id)

        await log_activity(conn, user["employee_id"], "employee.created", "employee", row["id"],
                          f"Created employee {emp.first_name} {emp.last_name}")

    return dict(row)


@app.delete("/api/employees/{employee_id}")
async def deactivate_employee(employee_id: int, user: dict = Depends(require_role("admin", "manager", "supervisor"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        emp = await conn.fetchrow("SELECT first_name, last_name FROM employees WHERE id = $1 AND is_active = TRUE", employee_id)
        if not emp:
            raise HTTPException(404, "Employee not found")

        await conn.execute("UPDATE employees SET is_active = FALSE WHERE id = $1", employee_id)

        await log_activity(conn, user["employee_id"], "employee.deactivated", "employee", employee_id,
                          f"Deactivated employee {emp['first_name']} {emp['last_name']}")

    return {"status": "deactivated"}


# ══════════════════════════════════════════════════════════════
# MATRIX DATA
# ══════════════════════════════════════════════════════════════

@app.get("/api/matrix")
async def get_matrix(department: str | None = None, category_id: int | None = None,
                     team_id: int | None = None, supervisor_id: int | None = None,
                     user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Build employee query
        emp_query = """
            SELECT id, first_name, last_name, role, department, team_id, supervisor_id
            FROM employees WHERE is_active = TRUE
            AND id NOT IN (SELECT employee_id FROM users WHERE role IN ('admin', 'manager'))
        """
        emp_params = []
        idx = 1

        # Apply scope filtering if authenticated
        if user:
            scope = await get_user_scope(conn, user["employee_id"], user["role"])
            emp_query += f" AND id = ANY(${idx})"
            emp_params.append(scope)
            idx += 1

        if department:
            emp_query += f" AND department = ${idx}"
            emp_params.append(department)
            idx += 1
        if team_id:
            emp_query += f" AND team_id = ${idx}"
            emp_params.append(team_id)
            idx += 1
        if supervisor_id:
            emp_query += f" AND supervisor_id = ${idx}"
            emp_params.append(supervisor_id)
            idx += 1
        emp_query += " ORDER BY department, last_name, first_name"
        employees = [dict(r) for r in await conn.fetch(emp_query, *emp_params)]

        # Get skills
        skill_query = """
            SELECT s.id, s.category_id, s.parent_skill_id, s.name, s.sort_order,
                   s.retrain_days, s.requires_cert, sc.name AS category_name, sc.sort_order AS category_sort
            FROM skills s
            JOIN skill_categories sc ON sc.id = s.category_id
            WHERE s.is_active = TRUE AND sc.is_active = TRUE
        """
        skill_params = []
        if category_id:
            skill_query += " AND s.category_id = $1"
            skill_params.append(category_id)
        skill_query += " ORDER BY sc.sort_order, s.sort_order"
        skills = [dict(r) for r in await conn.fetch(skill_query, *skill_params)]

        # Get assessments
        emp_ids = [e["id"] for e in employees]
        skill_ids = [s["id"] for s in skills]

        assessments = {}
        if emp_ids and skill_ids:
            rows = await conn.fetch("""
                SELECT a.id, a.employee_id, a.skill_id, a.level, a.previous_level,
                       a.is_confirmed, a.assessed_by, a.approved_by, a.approved_at,
                       a.assessed_date, a.last_trained_date, a.retrain_due_date, a.notes,
                       CASE WHEN a.retrain_due_date IS NOT NULL AND a.retrain_due_date < CURRENT_DATE
                            THEN TRUE ELSE FALSE END AS is_overdue
                FROM assessments a
                WHERE a.employee_id = ANY($1) AND a.skill_id = ANY($2)
            """, emp_ids, skill_ids)
            for r in rows:
                key = f"{r['employee_id']}_{r['skill_id']}"
                assessments[key] = dict(r)

        # Get role requirements for gap analysis
        requirements = {}
        req_rows = await conn.fetch("""
            SELECT role_name, skill_id, required_level
            FROM role_skill_requirements
            WHERE skill_id = ANY($1)
        """, skill_ids)
        for r in req_rows:
            key = f"{r['role_name']}_{r['skill_id']}"
            requirements[key] = r["required_level"]

        # Get staffing requirements
        staffing = {}
        staff_rows = await conn.fetch("""
            SELECT skill_id, level_3_required, level_4_required
            FROM skill_requirements
            WHERE skill_id = ANY($1)
        """, skill_ids)
        for r in staff_rows:
            staffing[str(r["skill_id"])] = {
                "level_3_required": r["level_3_required"],
                "level_4_required": r["level_4_required"],
            }

    return {
        "employees": employees,
        "skills": skills,
        "assessments": assessments,
        "requirements": requirements,
        "staffing": staffing,
    }


# ══════════════════════════════════════════════════════════════
# EMPLOYEE PROFILE
# ══════════════════════════════════════════════════════════════

@app.get("/api/employees/{employee_id}/profile")
async def get_employee_profile(employee_id: int, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        emp = await conn.fetchrow("""
            SELECT id, first_name, last_name, role, department, team_id
            FROM employees WHERE id = $1 AND is_active = TRUE
        """, employee_id)
        if not emp:
            raise HTTPException(404, "Employee not found")

        assessments = await conn.fetch("""
            SELECT a.skill_id, s.name AS skill_name, sc.name AS category_name,
                   sc.sort_order AS category_sort, s.sort_order AS skill_sort,
                   a.level, a.is_confirmed, a.retrain_due_date, a.last_trained_date,
                   s.requires_cert, s.retrain_days,
                   rsr.required_level
            FROM assessments a
            JOIN skills s ON s.id = a.skill_id
            JOIN skill_categories sc ON sc.id = s.category_id
            LEFT JOIN role_skill_requirements rsr
                ON rsr.skill_id = a.skill_id AND rsr.role_name = $2
            WHERE a.employee_id = $1 AND s.is_active = TRUE AND sc.is_active = TRUE
            ORDER BY sc.sort_order, s.sort_order
        """, employee_id, emp["role"])

        rows = [dict(r) for r in assessments]
        assessed = [r for r in rows if r["level"] > 0]
        gaps = [r for r in rows if r["required_level"] and r["level"] < r["required_level"]]
        overdue = [r for r in rows if r["retrain_due_date"] and r["retrain_due_date"] < datetime.now().date()]

    return {
        "employee": dict(emp),
        "assessments": rows,
        "summary": {
            "total_skills": len(rows),
            "assessed_count": len(assessed),
            "avg_level": round(sum(r["level"] for r in assessed) / len(assessed), 1) if assessed else 0,
            "gaps_count": len(gaps),
            "overdue_count": len(overdue),
        },
    }


# ══════════════════════════════════════════════════════════════
# TALENT SEARCH
# ══════════════════════════════════════════════════════════════

@app.get("/api/talent-search")
async def talent_search(skill_id: int = Query(...), min_level: int = Query(1, ge=1, le=4),
                        user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT a.employee_id, a.level, a.is_confirmed,
                   e.first_name, e.last_name, e.role, e.department
            FROM assessments a
            JOIN employees e ON e.id = a.employee_id
            WHERE a.skill_id = $1 AND a.level >= $2 AND e.is_active = TRUE
            ORDER BY a.level DESC, e.last_name
        """, skill_id, min_level)
    return [dict(r) for r in rows]


# ══════════════════════════════════════════════════════════════
# MATRIX EXPORT (CSV)
# ══════════════════════════════════════════════════════════════

@app.get("/api/matrix/export")
async def export_matrix(department: str | None = None, category_id: int | None = None,
                        user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Get employees
        emp_query = "SELECT id, first_name, last_name, role, department FROM employees WHERE is_active = TRUE AND id NOT IN (SELECT employee_id FROM users WHERE role IN ('admin', 'manager'))"
        emp_params = []
        idx = 1
        if department:
            emp_query += f" AND department = ${idx}"
            emp_params.append(department)
            idx += 1
        emp_query += " ORDER BY last_name, first_name"
        employees = [dict(r) for r in await conn.fetch(emp_query, *emp_params)]

        # Get skills
        skill_query = """
            SELECT s.id, s.name, sc.name AS category_name
            FROM skills s JOIN skill_categories sc ON sc.id = s.category_id
            WHERE s.is_active = TRUE AND sc.is_active = TRUE
        """
        skill_params = []
        if category_id:
            skill_query += " AND s.category_id = $1"
            skill_params.append(category_id)
        skill_query += " ORDER BY sc.sort_order, s.sort_order"
        skills = [dict(r) for r in await conn.fetch(skill_query, *skill_params)]

        # Get assessments
        emp_ids = [e["id"] for e in employees]
        skill_ids = [s["id"] for s in skills]
        assessments = {}
        if emp_ids and skill_ids:
            rows = await conn.fetch("""
                SELECT employee_id, skill_id, level FROM assessments
                WHERE employee_id = ANY($1) AND skill_id = ANY($2)
            """, emp_ids, skill_ids)
            for r in rows:
                assessments[f"{r['employee_id']}_{r['skill_id']}"] = r["level"]

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)
    header = ["Employee", "Role", "Department"] + [f"{s['category_name']} - {s['name']}" for s in skills]
    writer.writerow(header)
    for emp in employees:
        row = [f"{emp['first_name']} {emp['last_name']}", emp["role"] or "", emp["department"] or ""]
        for s in skills:
            level = assessments.get(f"{emp['id']}_{s['id']}", 0)
            row.append(level)
        writer.writerow(row)

    from starlette.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=skill-matrix-export.csv"},
    )


# ══════════════════════════════════════════════════════════════
# ASSESSMENT DETAIL + AUDIT HISTORY
# ══════════════════════════════════════════════════════════════

@app.get("/api/assessments/{employee_id}/{skill_id}")
async def get_assessment_detail(employee_id: int, skill_id: int, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        assessment = await conn.fetchrow("""
            SELECT a.*, e.first_name || ' ' || e.last_name AS employee_name,
                   s.name AS skill_name
            FROM assessments a
            JOIN employees e ON e.id = a.employee_id
            JOIN skills s ON s.id = a.skill_id
            WHERE a.employee_id = $1 AND a.skill_id = $2
        """, employee_id, skill_id)

        if not assessment:
            return {"assessment": None, "audit": [], "submissions": []}

        audit = await conn.fetch("""
            SELECT aa.*, e.first_name || ' ' || e.last_name AS changed_by_name
            FROM assessment_audit aa
            LEFT JOIN employees e ON e.id = aa.changed_by
            WHERE aa.assessment_id = $1
            ORDER BY aa.changed_at DESC
        """, assessment["id"])

        submissions = await conn.fetch("""
            SELECT s.*, e.first_name || ' ' || e.last_name AS submitted_by_name
            FROM assessment_submissions s
            LEFT JOIN employees e ON e.id = s.submitted_by
            WHERE s.assessment_id = $1
            ORDER BY s.submitted_at DESC
        """, assessment["id"])

    return {
        "assessment": dict(assessment),
        "audit": [dict(r) for r in audit],
        "submissions": [dict(r) for r in submissions],
    }


# ══════════════════════════════════════════════════════════════
# UPDATE ASSESSMENT
# ══════════════════════════════════════════════════════════════

@app.put("/api/assessments/{employee_id}/{skill_id}")
async def update_assessment(employee_id: int, skill_id: int, body: AssessmentUpdate,
                            user: dict = Depends(get_current_user)):
    if not 0 <= body.level <= 4:
        raise HTTPException(400, "Level must be between 0 and 4")

    pool = await get_pool()
    async with pool.acquire() as conn:
        emp = await conn.fetchrow(
            "SELECT id, supervisor_id, first_name, last_name FROM employees WHERE id = $1 AND is_active = TRUE",
            employee_id
        )
        if not emp:
            raise HTTPException(404, "Employee not found")

        # Check scope — user must be able to see this employee
        scope = await get_user_scope(conn, user["employee_id"], user["role"])
        if employee_id not in scope:
            raise HTTPException(403, "Employee not in your scope")

        # Auto-confirm if user is supervisor/manager/admin
        is_supervisor_of = await conn.fetchval(
            "SELECT id FROM employee_supervisors WHERE employee_id = $1 AND supervisor_id = $2",
            employee_id, user["employee_id"]
        )
        auto_confirm = can_confirm(user["role"]) or (is_supervisor_of is not None)

        assessed_by = user["employee_id"]

        # Determine submission type
        if user["employee_id"] == employee_id:
            submission_type = "self"
        elif is_supervisor_of is not None:
            submission_type = "manager"
        else:
            submission_type = "peer"

        existing = await conn.fetchrow(
            "SELECT id, level FROM assessments WHERE employee_id = $1 AND skill_id = $2",
            employee_id, skill_id
        )

        skill = await conn.fetchrow("SELECT name, retrain_days FROM skills WHERE id = $1", skill_id)

        # Calculate retrain dates if skill has retrain_days
        retrain_due = None
        last_trained = None
        if body.level > 0 and skill["retrain_days"]:
            last_trained = datetime.now().date()
            retrain_due = last_trained + timedelta(days=skill["retrain_days"])

        async with conn.transaction():
            if existing:
                await conn.execute("""
                    UPDATE assessments
                    SET level = $1, previous_level = $2, assessed_by = $3,
                        is_confirmed = $4, approved_by = $5, approved_at = $6,
                        notes = $7, assessed_date = NOW(),
                        last_trained_date = COALESCE($10, last_trained_date),
                        retrain_due_date = CASE WHEN $1::smallint = 0 THEN NULL ELSE COALESCE($11, retrain_due_date) END
                    WHERE employee_id = $8 AND skill_id = $9
                """,
                    body.level, existing["level"], assessed_by,
                    auto_confirm,
                    assessed_by if auto_confirm else None,
                    datetime.now() if auto_confirm else None,
                    body.notes, employee_id, skill_id,
                    last_trained, retrain_due
                )

                await conn.execute("""
                    INSERT INTO assessment_audit
                        (assessment_id, changed_by, old_level, new_level, change_type, notes)
                    VALUES ($1, $2, $3, $4, 'update', $5)
                """, existing["id"], assessed_by, existing["level"], body.level, body.notes)

                await conn.execute("""
                    INSERT INTO assessment_submissions
                        (assessment_id, submitted_by, submission_type, level, notes, submitted_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                """, existing["id"], assessed_by, submission_type, body.level, body.notes)

                await log_activity(conn, assessed_by, "assessment.updated", "assessment", existing["id"],
                                  f"Updated {emp['first_name']} {emp['last_name']} - {skill['name']}: L{existing['level']} → L{body.level}",
                                  old_value={"level": existing["level"]},
                                  new_value={"level": body.level})

                return {"status": "updated", "is_confirmed": auto_confirm}
            else:
                row = await conn.fetchrow("""
                    INSERT INTO assessments
                        (employee_id, skill_id, level, assessed_by, is_confirmed, approved_by, approved_at, notes,
                         last_trained_date, retrain_due_date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id
                """,
                    employee_id, skill_id, body.level, assessed_by,
                    auto_confirm,
                    assessed_by if auto_confirm else None,
                    datetime.now() if auto_confirm else None,
                    body.notes,
                    last_trained, retrain_due
                )

                await conn.execute("""
                    INSERT INTO assessment_audit
                        (assessment_id, changed_by, old_level, new_level, change_type, notes)
                    VALUES ($1, $2, NULL, $3, 'update', $4)
                """, row["id"], assessed_by, body.level, body.notes)

                await conn.execute("""
                    INSERT INTO assessment_submissions
                        (assessment_id, submitted_by, submission_type, level, notes, submitted_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                """, row["id"], assessed_by, submission_type, body.level, body.notes)

                await log_activity(conn, assessed_by, "assessment.created", "assessment", row["id"],
                                  f"Assessed {emp['first_name']} {emp['last_name']} - {skill['name']}: L{body.level}")

            return {"status": "created", "is_confirmed": auto_confirm}


@app.put("/api/assessments/{employee_id}/{skill_id}/retrain-date")
async def set_retrain_date(employee_id: int, skill_id: int, body: RetrainDateUpdate,
                           user: dict = Depends(require_role("admin", "manager", "supervisor"))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        assessment = await conn.fetchrow(
            "SELECT id FROM assessments WHERE employee_id = $1 AND skill_id = $2",
            employee_id, skill_id)
        if not assessment:
            raise HTTPException(404, "Assessment not found")

        updates = []
        params = []
        idx = 1

        if body.retrain_due_date is not None:
            updates.append(f"retrain_due_date = ${idx}")
            params.append(datetime.strptime(body.retrain_due_date, "%Y-%m-%d").date() if body.retrain_due_date else None)
            idx += 1
        if body.last_trained_date is not None:
            updates.append(f"last_trained_date = ${idx}")
            params.append(datetime.strptime(body.last_trained_date, "%Y-%m-%d").date() if body.last_trained_date else None)
            idx += 1

        if not updates:
            return {"status": "no_changes"}

        params.append(assessment["id"])
        await conn.execute(
            f"UPDATE assessments SET {', '.join(updates)} WHERE id = ${idx}",
            *params)

        await log_activity(conn, user["employee_id"], "assessment.retrain_date_set", "assessment",
                          assessment["id"], f"Updated retrain dates for employee {employee_id}, skill {skill_id}")

    return {"status": "updated"}


# ══════════════════════════════════════════════════════════════
# CONFIRMATION QUEUE
# ══════════════════════════════════════════════════════════════

@app.get("/api/confirmation-queue")
async def confirmation_queue(user: dict = Depends(get_current_user)):
    if not can_confirm(user["role"]):
        return []

    pool = await get_pool()
    async with pool.acquire() as conn:
        scope = await get_user_scope(conn, user["employee_id"], user["role"])
        rows = await conn.fetch("""
            SELECT a.id, a.employee_id, a.skill_id, a.level, a.previous_level,
                   a.assessed_by, a.notes, a.assessed_date,
                   e.first_name || ' ' || e.last_name AS employee_name,
                   e.department,
                   s.name AS skill_name,
                   sc.name AS category_name,
                   ab.first_name || ' ' || ab.last_name AS assessed_by_name
            FROM assessments a
            JOIN employees e ON e.id = a.employee_id
            JOIN skills s ON s.id = a.skill_id
            JOIN skill_categories sc ON sc.id = s.category_id
            LEFT JOIN employees ab ON ab.id = a.assessed_by
            WHERE a.is_confirmed = FALSE AND e.is_active = TRUE AND s.is_active = TRUE
              AND a.employee_id = ANY($1)
            ORDER BY a.assessed_date DESC
        """, scope)
    return [dict(r) for r in rows]


@app.put("/api/assessments/{assessment_id}/confirm")
async def confirm_assessment(assessment_id: int, body: ConfirmAction,
                             user: dict = Depends(get_current_user)):
    if not can_confirm(user["role"]):
        raise HTTPException(403, "Your role cannot confirm assessments")

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT a.id, a.employee_id, a.skill_id, a.level,
                   e.first_name || ' ' || e.last_name AS employee_name,
                   s.name AS skill_name
            FROM assessments a
            JOIN employees e ON e.id = a.employee_id
            JOIN skills s ON s.id = a.skill_id
            WHERE a.id = $1
        """, assessment_id)
        if not row:
            raise HTTPException(404, "Assessment not found")

        approved_by = user["employee_id"]

        async with conn.transaction():
            await conn.execute("""
                UPDATE assessments
                SET is_confirmed = TRUE, approved_by = $1, approved_at = NOW()
                WHERE id = $2
            """, approved_by, assessment_id)

            await conn.execute("""
                INSERT INTO assessment_audit
                    (assessment_id, changed_by, old_level, new_level, change_type)
                VALUES ($1, $2, $3, $3, 'confirm')
            """, row["id"], approved_by, row["level"])

            await log_activity(conn, approved_by, "assessment.confirmed", "assessment", assessment_id,
                              f"Confirmed {row['employee_name']} - {row['skill_name']} at L{row['level']}")

    return {"status": "confirmed"}


@app.put("/api/assessments/{assessment_id}/reject")
async def reject_assessment(assessment_id: int, body: ConfirmAction,
                            user: dict = Depends(get_current_user)):
    if not can_confirm(user["role"]):
        raise HTTPException(403, "Your role cannot reject assessments")

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT a.id, a.employee_id, a.skill_id, a.level, a.previous_level,
                   e.first_name || ' ' || e.last_name AS employee_name,
                   s.name AS skill_name
            FROM assessments a
            JOIN employees e ON e.id = a.employee_id
            JOIN skills s ON s.id = a.skill_id
            WHERE a.id = $1
        """, assessment_id)
        if not row:
            raise HTTPException(404, "Assessment not found")

        revert_level = row["previous_level"] if row["previous_level"] is not None else 0
        approved_by = user["employee_id"]

        async with conn.transaction():
            await conn.execute("""
                UPDATE assessments
                SET level = $1, is_confirmed = TRUE, approved_by = $2, approved_at = NOW()
                WHERE id = $3
            """, revert_level, approved_by, assessment_id)

            await conn.execute("""
                INSERT INTO assessment_audit
                    (assessment_id, changed_by, old_level, new_level, change_type)
                VALUES ($1, $2, $3, $4, 'reject')
            """, row["id"], approved_by, row["level"], revert_level)

            await log_activity(conn, approved_by, "assessment.rejected", "assessment", assessment_id,
                              f"Rejected {row['employee_name']} - {row['skill_name']}: L{row['level']} → L{revert_level}")

    return {"status": "rejected", "reverted_to": revert_level}


# ══════════════════════════════════════════════════════════════
# SAVED SEARCHES
# ══════════════════════════════════════════════════════════════

@app.get("/api/saved-searches")
async def list_saved_searches(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, name, config, created_by, created_at FROM saved_searches ORDER BY created_at DESC"
        )
    return [dict(r) for r in rows]


@app.post("/api/saved-searches", status_code=201)
async def create_saved_search(body: SavedSearchCreate, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO saved_searches (name, config)
            VALUES ($1, $2::jsonb)
            RETURNING id, name, config, created_at
        """, body.name, json.dumps(body.config))
    return dict(row)
