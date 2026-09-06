# PostgreSQL Setup & Migration

## Overview

The V1 prototype originally used SQLite for local development. This document describes the migration to PostgreSQL while preserving the existing V1 functionality.

The PostgreSQL database is used for:

- Users
- Assets
- Asset transfers
- Audit logs

The blockchain functionality is not part of this migration.

---

## 1. PostgreSQL Installation

Install PostgreSQL locally along with pgAdmin.

The development PostgreSQL server used for this project runs on:

- Host: `localhost`
- Port: `5433`

Verify the PostgreSQL server is running before starting the backend.

---

## 2. Create the Database

Create a PostgreSQL database named:

```text
sih26125