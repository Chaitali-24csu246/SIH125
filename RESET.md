# Backup and deliberate reset

## Preserve state

Stop application writes before backing up. Preserve **all** of the following together:

- `generated/`: genesis, validator keys, encryption key, wallets, artifacts and deployed addresses.
- PostgreSQL data, including encrypted files, metadata and evidence logs.
- Besu node data volumes, or a documented ability to resynchronise from another retained node.
- Source and lockfile corresponding to the deployment.

Database backup example:

```bash
docker compose --env-file generated/config.env stop app
docker compose --env-file generated/config.env exec -T postgres pg_dump -U ledger_owner ledgerguard > ledgerguard-backup.sql
```

Copy `generated/` to a protected location and back up the node volumes while validators are stopped for a consistent local snapshot. Keep encryption keys separately protected; database ciphertext is unusable without `FILE_KEY`. Start the stack again after backup.

## Start over only when intended

The commands below delete the current local chain and database. They are intentionally **not** part of normal setup or an automatic repair.

1. Back up anything you need.
2. Run `docker compose --env-file generated/config.env down -v` to remove this project's named data volumes.
3. Move `generated/` into a dated backup directory and create an empty replacement directory.
4. Run the setup script again.

Do not combine a new genesis/deployment with old database records. Token IDs may be reused on a new chain, and old file metadata must not silently appear to belong to the new deployment.

The application encryption key cannot be rotated by simply editing `FILE_KEY`. A real rotation requires decrypting each file with the old key, re-encrypting with the new key and coordinating the change. That migration is not automated in this prototype.
