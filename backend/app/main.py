from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text

from app.core.database import get_connection, init_db


Role = Literal["ADMIN", "MANAGER", "AUDITOR", "USER"]


class AssetCreate(BaseModel):
    asset_code: str
    name: str
    serial_number: str


class TransferRequest(BaseModel):
    new_owner_id: int


def require_role(current_role: str, allowed: set[str]):
    if current_role not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Role {current_role} is not allowed to perform this action",
        )


def get_actor(role: str):
    with get_connection() as conn:
        row = conn.execute(
            text(
                "SELECT * FROM users "
                "WHERE role = :role "
                "ORDER BY id LIMIT 1"
            ),
            {"role": role},
        ).mappings().fetchone()

    if not row:
        return {"name": role.title(), "role": role}

    return dict(row)


def log_event(
    role: str,
    action: str,
    asset_id: Optional[int],
    details: str,
):
    actor = get_actor(role)

    with get_connection() as conn:
        conn.execute(
            text(
                """
                INSERT INTO audit_logs
                    (actor_role, actor_name, action, asset_id, details)
                VALUES
                    (:actor_role, :actor_name, :action, :asset_id, :details)
                """
            ),
            {
                "actor_role": role,
                "actor_name": actor["name"],
                "action": action,
                "asset_id": asset_id,
                "details": details,
            },
        )
        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="SIH 26125 Secure Asset Prototype",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "running", "version": "0.1.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/users")
def list_users():
    with get_connection() as conn:
        rows = conn.execute(
            text(
                "SELECT id, name, email, role "
                "FROM users ORDER BY id"
            )
        ).mappings().fetchall()

    return [dict(row) for row in rows]


@app.get("/assets")
def list_assets():
    with get_connection() as conn:
        rows = conn.execute(
            text(
                """
                SELECT a.id,
                       a.asset_code,
                       a.name,
                       a.serial_number,
                       a.status,
                       a.owner_id,
                       u.name AS owner_name
                FROM assets a
                LEFT JOIN users u ON u.id = a.owner_id
                ORDER BY a.id DESC
                """
            )
        ).mappings().fetchall()

    return [dict(row) for row in rows]


@app.post("/assets", status_code=201)
def create_asset(
    asset: AssetCreate,
    x_role: Role = Header(...),
):
    require_role(x_role, {"ADMIN"})

    with get_connection() as conn:
        try:
            result = conn.execute(
                text(
                    """
                    INSERT INTO assets
                        (asset_code, name, serial_number)
                    VALUES
                        (:asset_code, :name, :serial_number)
                    RETURNING id
                    """
                ),
                {
                    "asset_code": asset.asset_code.strip(),
                    "name": asset.name.strip(),
                    "serial_number": asset.serial_number.strip(),
                },
            )

            asset_id = result.scalar_one()
            conn.commit()

        except Exception as exc:
            conn.rollback()
            raise HTTPException(
                status_code=400,
                detail="Asset code must be unique and all fields are required",
            ) from exc

    log_event(
        x_role,
        "ASSET_CREATED",
        asset_id,
        f"Created asset {asset.asset_code}",
    )

    return {"id": asset_id, "message": "Asset created"}


@app.post("/assets/{asset_id}/transfer")
def transfer_asset(
    asset_id: int,
    transfer: TransferRequest,
    x_role: Role = Header(...),
):
    require_role(x_role, {"ADMIN", "MANAGER"})

    with get_connection() as conn:
        asset = conn.execute(
            text("SELECT * FROM assets WHERE id = :asset_id"),
            {"asset_id": asset_id},
        ).mappings().fetchone()

        if not asset:
            raise HTTPException(
                status_code=404,
                detail="Asset not found",
            )

        new_owner = conn.execute(
            text("SELECT * FROM users WHERE id = :user_id"),
            {"user_id": transfer.new_owner_id},
        ).mappings().fetchone()

        if not new_owner:
            raise HTTPException(
                status_code=404,
                detail="New owner not found",
            )

        old_owner = None

        if asset["owner_id"]:
            old = conn.execute(
                text("SELECT name FROM users WHERE id = :user_id"),
                {"user_id": asset["owner_id"]},
            ).mappings().fetchone()

            old_owner = old["name"] if old else None

        conn.execute(
            text(
                """
                UPDATE assets
                SET owner_id = :owner_id
                WHERE id = :asset_id
                """
            ),
            {
                "owner_id": transfer.new_owner_id,
                "asset_id": asset_id,
            },
        )

        conn.execute(
            text(
                """
                INSERT INTO transfers
                    (
                        asset_id,
                        from_owner_id,
                        to_owner_id,
                        transferred_by_role,
                        transferred_by_name
                    )
                VALUES
                    (
                        :asset_id,
                        :from_owner_id,
                        :to_owner_id,
                        :transferred_by_role,
                        :transferred_by_name
                    )
                """
            ),
            {
                "asset_id": asset_id,
                "from_owner_id": asset["owner_id"],
                "to_owner_id": transfer.new_owner_id,
                "transferred_by_role": x_role,
                "transferred_by_name": get_actor(x_role)["name"],
            },
        )

        conn.commit()

    log_event(
        x_role,
        "ASSET_TRANSFERRED",
        asset_id,
        f"{asset['asset_code']} transferred from "
        f"{old_owner or 'Unassigned'} to {new_owner['name']}",
    )

    return {"message": "Asset transferred"}


@app.get("/audit")
def audit_log(x_role: Role = Header(...)):
    require_role(x_role, {"ADMIN", "AUDITOR"})

    with get_connection() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id,
                       actor_role,
                       actor_name,
                       action,
                       asset_id,
                       details,
                       created_at
                FROM audit_logs
                ORDER BY id DESC
                """
            )
        ).mappings().fetchall()

    return [dict(row) for row in rows]