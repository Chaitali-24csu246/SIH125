# SIH 26125 Prototype v0.1

Minimal centralized prototype for identity/role-based access, asset assignment/transfer and audit history.

## Run backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend: http://127.0.0.1:8000  
Swagger: http://127.0.0.1:8000/docs

## Run frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

## Demo flow
1. Choose ADMIN and create an asset.
2. Assign it to Rahul or Priya.
3. Choose USER to see Rahul's assigned assets.
4. Choose MANAGER to transfer assets.
5. Choose AUDITOR and open Audit Trail.
6. Auditor/User cannot perform restricted actions.

This version intentionally does not contain blockchain. It is the centralized baseline before Besu/Solidity integration.
