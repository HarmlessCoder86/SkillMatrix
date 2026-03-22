"""Database connection pool using asyncpg."""

import os
import asyncpg
import logging

logger = logging.getLogger("skillmatrix.db")

pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        dsn = os.getenv("DATABASE_URL", "postgresql://skillmatrix:skillmatrix_dev@localhost:5432/skillmatrix")
        pool = await asyncpg.create_pool(
            dsn, min_size=2, max_size=20,
            command_timeout=30,
            server_settings={'statement_timeout': '30000'},
        )
        logger.info("Database connection pool created")
    return pool


async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None
        logger.info("Database connection pool closed")
