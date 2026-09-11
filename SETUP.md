# Setup and troubleshooting

## 1. Prerequisites

- Docker Desktop or Docker Engine with Compose v2, running Linux containers.
- A current browser. A wallet extension is optional: encrypted JSON wallet import is built into the app.
- Free local ports 8080 and 8545.
- Network access for image/package downloads on the first build.
- Start with 6–8 GB available to Docker. Four Besu JVMs are configured with 768 MB maximum heap each; containers and build tools require additional memory.

Windows users should use the supplied PowerShell script or WSL2. The shell instructions assume a POSIX terminal. Paths in commands are relative to the extracted project root.

## 2. Automated first start

```bash
sh scripts/setup.sh
```

Or:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

The script builds the tooling image, generates random test accounts and validator keys, starts PostgreSQL and four validators, waits for advancing blocks, deploys contracts, registers five identities and their roles, then builds and starts the application.

It does not automatically reset existing state. If deployment partially failed, inspect logs and `generated/` before rerunning. A missing deployment file after a partially mined deployment can lead to another deployment; the old contracts remain on-chain. This is acceptable on a disposable local network, but preserve the new recorded addresses consistently.

## 3. Sign in

1. Open `http://localhost:8080` using that exact hostname.
2. Under encrypted local wallet, choose `generated/wallets/Admin.json`.
3. Enter the password from `generated/WALLET-PASSWORD.txt`.
4. Click **Unlock locally**, then **Sign in with a signed challenge**.
5. The browser decrypts the wallet locally. The server receives a signature, not the private key.

The generated files also include Manager, Auditor, Rahul and Priya wallets. Their addresses appear in `generated/public-accounts.json`. Role labels and shortened addresses appear in the UI; personal names are not written into on-chain identities.

Use separate browser windows/profiles for several roles. Each login has a 30-minute session. Refreshing the page clears the in-memory wallet and session by design. Browser extensions may keep their own wallet state.

## 4. Wallet extension option

Import a generated test account into your extension using its encrypted wallet or local private key. Keep it isolated from real accounts. Configure:

| Setting | Value |
|---|---|
| Network | LedgerGuard Local Besu |
| RPC | `http://localhost:8545` |
| Chain ID | `26125` |
| Currency symbol | `ETH` |
| Explorer | Leave blank; the app contains its own explorer |

The application asks the extension to add the network if necessary. Select the network and connect again. Never approve a request on a public chain. `localhost` wallet RPC is for a browser on the same computer; remote devices require a deliberate network/TLS design.

## 5. Run verification

```bash
docker compose --env-file generated/config.env run --rm tools npm test
docker compose --env-file generated/config.env run --rm tools node scripts/doctor.mjs
docker compose --env-file generated/config.env run --rm tools npm run experiments
```

`npm test` uses isolated development-chain instances and the PostgreSQL WASM engine, even when invoked in Docker. The experiment runner uses your **actual running Besu and PostgreSQL stack**. These are different kinds of evidence.

Keep the seeded app identities active with their initial roles before running the experiment suite. Asset operations must be unpaused. Its model tests deploy separate contracts and leave the main app's policies alone. It creates one synthetic document asset and imports a report into the main app; the asset is intentionally retained for inspection.

## 6. Update code during refinement

Frontend/API changes:

```bash
docker compose --env-file generated/config.env up -d --build app
docker compose --env-file generated/config.env build tools
```

Contract changes require recompilation and a deliberate new deployment. The contracts are **not upgradeable**. Do not overwrite deployed addresses while the app is serving an old chain. For hackathon development, use a fresh copy/network or follow `RESET.md`; the existing database's files and token numbers should not silently be reused against a different deployment.

## 7. Diagnostics

```bash
docker compose --env-file generated/config.env ps
docker compose --env-file generated/config.env logs --tail=80 app
docker compose --env-file generated/config.env logs --tail=80 besu1 besu2 besu3 besu4
docker compose --env-file generated/config.env logs --tail=80 postgres
```

| Symptom | Check |
|---|---|
| Wallet connects but sign-in fails | Correct chain and controller; identity active; organisation suspension; session expired or controller rotated |
| `Origin not allowed` | Use `http://localhost:8080`, not a different hostname; changing origin also requires the Besu CORS list |
| Blocks do not advance | All four validators initially up; static-node addresses match; Docker subnet conflict; sufficient RAM |
| Besu image unavailable | Check registry/network access and the pinned image tag. Confirm compatibility before changing it |
| Besu rejects a startup flag | Inspect `infra/start-besu.sh` against the exact installed Besu version; do not remove security restrictions silently |
| File staging works but mint fails | Admin role, unpaused platform, unique code and correct wallet network |
| File download fails | Live access policy, file integrity and `FILE_KEY`; changing that key makes existing ciphertext unreadable |
| Cache status `NOT_INDEXED` | Admin selects the asset and clicks **Rebuild verified cache**; cache is optional and not authoritative |
| No experiment results in UI | Wait for runner completion; sign in as Admin/Auditor and refresh Security Results |
| Tools cannot write `generated/` | Export host `LOCAL_UID` and `LOCAL_GID`, or rerun the platform-specific setup script |
| PostgreSQL password mismatch after editing secrets | Initialisation credentials apply only to a new database volume. Restore the correct original config or reset deliberately |
| Port already allocated | Stop the conflicting service or consistently change Compose, app origin and wallet RPC settings |

Besu containers communicate on `172.28.26.0/24`. If this conflicts with another Docker/VPN network, change the subnet, service IPs, generated enode addresses and startup p2p addresses together **before creating the chain**.

## 8. Optional native development

Use Node 22 LTS and npm. Run `npm ci`, `npm run compile`, `npm run build`. Keep Besu and PostgreSQL running and set `DATABASE_URL`, `FILE_KEY`, `RPC_URL`, and `APP_ORIGIN` before `npm start`.

For Vite development, set API `APP_ORIGIN=http://localhost:5173`, add that origin to Besu's CORS list and use `npm run dev`. The Vite proxy routes `/api` to port 8080. Restore the normal origin for the packaged app.

## 9. Minimal installation burden

The Docker setup installs Node dependencies and database/blockchain software inside containers. You do not need to separately install Solidity, Python, Java, PostgreSQL, a browser extension or a global Hardhat/Foundry installation.
