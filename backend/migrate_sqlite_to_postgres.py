import sqlite3
from datetime import datetime

from sqlalchemy import text

from app.core.database import get_connection


SQLITE_DB = "prototype.db"


# Read existing SQLite data
sqlite_conn = sqlite3.connect(SQLITE_DB)

assets = sqlite_conn.execute(
    "SELECT id, asset_code, name, serial_number, status, owner_id, created_at "
    "FROM assets ORDER BY id"
).fetchall()

audit_logs = sqlite_conn.execute(
    "SELECT id, actor_role, actor_name, action, asset_id, details, created_at "
    "FROM audit_logs ORDER BY id"
).fetchall()

sqlite_conn.close()


# Insert into PostgreSQL
pg_conn = get_connection()

try:
    for asset in assets:
        pg_conn.execute(
            text("""
                INSERT INTO assets
                    (id, asset_code, name, serial_number, status, owner_id, created_at)
                VALUES
                    (:id, :asset_code, :name, :serial_number, :status,
                     :owner_id, :created_at)
                ON CONFLICT (id) DO NOTHING
            """),
            {
                "id": asset[0],
                "asset_code": asset[1],
                "name": asset[2],
                "serial_number": asset[3],
                "status": asset[4],
                "owner_id": asset[5],
                "created_at": datetime.fromisoformat(asset[6]),
            },
        )

    for log in audit_logs:
        pg_conn.execute(
            text("""
                INSERT INTO audit_logs
                    (id, actor_role, actor_name, action, asset_id, details, created_at)
                VALUES
                    (:id, :actor_role, :actor_name, :action, :asset_id,
                     :details, :created_at)
                ON CONFLICT (id) DO NOTHING
            """),
            {
                "id": log[0],
                "actor_role": log[1],
                "actor_name": log[2],
                "action": log[3],
                "asset_id": log[4],
                "details": log[5],
                "created_at": datetime.fromisoformat(log[6]),
            },
        )

        # Reset PostgreSQL identity sequences after migrating explicit IDs
    pg_conn.execute(
        text("""
            SELECT setval(
                pg_get_serial_sequence('assets', 'id'),
                COALESCE((SELECT MAX(id) FROM assets), 1),
                (SELECT COUNT(*) > 0 FROM assets)
            )
        """)
    )

    pg_conn.execute(
        text("""
            SELECT setval(
                pg_get_serial_sequence('audit_logs', 'id'),
                COALESCE((SELECT MAX(id) FROM audit_logs), 1),
                (SELECT COUNT(*) > 0 FROM audit_logs)
            )
        """)
    )

    pg_conn.commit()

    print(f"Migrated {len(assets)} assets.")
    print(f"Migrated {len(audit_logs)} audit logs.")

finally:
    pg_conn.close()
