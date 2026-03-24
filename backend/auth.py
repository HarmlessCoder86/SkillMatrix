"""Authentication & authorization for Skill Matrix API."""

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request

from db import get_pool

logger = logging.getLogger("skillmatrix.auth")

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required. Generate one with: openssl rand -hex 32")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

# Role hierarchy — higher index = more privileged
ROLE_HIERARCHY = ["operator", "lead", "trainer", "supervisor", "manager", "admin"]

# What roles each role can create
CREATION_PERMISSIONS = {
    "admin": {"admin", "manager", "supervisor", "trainer", "lead", "operator"},
    "manager": {"supervisor", "trainer", "lead", "operator"},
    "supervisor": {"trainer", "lead", "operator"},
    "trainer": set(),
    "lead": set(),
    "operator": set(),
}

# What roles can confirm assessments
CONFIRM_ROLES = {"admin", "manager", "supervisor"}

# What roles can access admin panel
ADMIN_ROLES = {"admin", "manager", "supervisor"}

# What roles can see activity log
LOG_ROLES = {"admin", "manager", "supervisor"}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user_id: int, employee_id: int, role: str) -> str:
    payload = {
        "user_id": user_id,
        "employee_id": employee_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


async def get_current_user(request: Request) -> dict:
    """FastAPI dependency — extracts and validates JWT from Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid authorization header")

    token = auth_header.split(" ", 1)[1]
    payload = decode_token(token)

    return {
        "user_id": payload["user_id"],
        "employee_id": payload["employee_id"],
        "role": payload["role"],
    }


async def get_optional_user(request: Request) -> Optional[dict]:
    """Like get_current_user but returns None instead of raising."""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


def require_role(*roles: str):
    """Factory for FastAPI dependency that checks role membership."""
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires one of: {', '.join(roles)}")
        return user
    return checker


def role_level(role: str) -> int:
    """Return numeric level for role comparison."""
    try:
        return ROLE_HIERARCHY.index(role)
    except ValueError:
        return -1


def can_create_role(creator_role: str, target_role: str) -> bool:
    return target_role in CREATION_PERMISSIONS.get(creator_role, set())


def can_confirm(role: str) -> bool:
    return role in CONFIRM_ROLES


async def get_user_scope(conn, employee_id: int, role: str) -> list[int]:
    """Return list of employee IDs this user can see based on role and reporting chain.

    - Admin: all employees
    - Manager: employees in their department
    - Supervisor: direct reports + reports through their leads
    - Trainer/Lead: directly assigned employees
    - Operator: only themselves
    """
    if role == "admin":
        rows = await conn.fetch("SELECT id FROM employees WHERE is_active = TRUE")
        return [r["id"] for r in rows]

    if role == "manager":
        # Managers scoped to their department
        mgr = await conn.fetchrow("SELECT department FROM employees WHERE id = $1", employee_id)
        if mgr and mgr["department"]:
            rows = await conn.fetch(
                "SELECT id FROM employees WHERE is_active = TRUE AND department = $1",
                mgr["department"],
            )
            return [r["id"] for r in rows]
        return [employee_id]

    if role == "supervisor":
        # Direct reports + reports of leads who report to this supervisor
        rows = await conn.fetch("""
            WITH direct AS (
                SELECT employee_id FROM employee_supervisors WHERE supervisor_id = $1
            ),
            through_leads AS (
                SELECT es2.employee_id
                FROM employee_supervisors es1
                JOIN employee_supervisors es2 ON es2.supervisor_id = es1.employee_id
                WHERE es1.supervisor_id = $1
            )
            SELECT employee_id FROM direct
            UNION
            SELECT employee_id FROM through_leads
            UNION
            SELECT $1 AS employee_id
        """, employee_id)
        return [r["employee_id"] for r in rows]

    if role in ("trainer", "lead"):
        rows = await conn.fetch("""
            SELECT employee_id FROM employee_supervisors WHERE supervisor_id = $1
            UNION SELECT $1 AS employee_id
        """, employee_id)
        return [r["employee_id"] for r in rows]

    # Operator — only self
    return [employee_id]
