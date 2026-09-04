import os
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "prototype.db"))


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            role TEXT NOT NULL CHECK(role IN ('ADMIN','MANAGER','AUDITOR','USER'))
        );

        CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            owner_id INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_role TEXT NOT NULL,
            actor_name TEXT NOT NULL,
            action TEXT NOT NULL,
            asset_id INTEGER,
            details TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    demo_users = [
        ("Aditi Admin", "admin@bel.demo", "ADMIN"),
        ("Mohan Manager", "manager@bel.demo", "MANAGER"),
        ("Ananya Auditor", "auditor@bel.demo", "AUDITOR"),
        ("Rahul User", "user@bel.demo", "USER"),
        ("Priya User", "priya@bel.demo", "USER"),
    ]
    cur.executemany(
        "INSERT OR IGNORE INTO users (name, email, role) VALUES (?, ?, ?)",
        demo_users,
    )
    conn.commit()
    conn.close()
