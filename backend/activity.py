"""Activity logging for Skill Matrix."""

import json
import logging

logger = logging.getLogger("skillmatrix.activity")


async def log_activity(
    conn,
    actor_id: int | None,
    action_type: str,
    entity_type: str,
    entity_id: int | None,
    description: str,
    old_value: dict | None = None,
    new_value: dict | None = None,
):
    """Insert a row into activity_log."""
    await conn.execute(
        """
        INSERT INTO activity_log (actor_id, action_type, entity_type, entity_id, description, old_value, new_value)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
        """,
        actor_id,
        action_type,
        entity_type,
        entity_id,
        description,
        json.dumps(old_value) if old_value else None,
        json.dumps(new_value) if new_value else None,
    )
    logger.info(f"Activity: {action_type} {entity_type}#{entity_id} by employee#{actor_id}: {description}")
