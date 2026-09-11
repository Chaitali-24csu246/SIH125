# Security model and remaining boundaries

## Protected properties

| Threat | Implemented control | Verification |
|---|---|---|
| Role-header forgery | Signed authentication; live identity-bound contract roles | API negative tests and live runner |
| Replayed login proof | Random nonce, origin/chain/registry binding, expiry, atomic consumption | Concurrent replay and expiry tests |
| Direct contract bypass | Contract checks on mint, allocation, transfer and governance | Direct calls and mined failed transaction |
| ERC-721 approval bypass | Operator approvals disabled; safe-transfer uses checked transfer | Contract regression tests |
| Stale role/session privileges | Live role, controller, identity-version and suspension checks | Existing-session revocation and rotation tests |
| Unauthorised file read | Per-token on-chain download policy | Owner/non-owner API tests |
| File tampering | AES-GCM authentication and on-chain content digest | Altered-ciphertext test |
| Database ownership rewriting | Contract is authoritative; explicit cache comparison | API test and live SQL experiment |
| Historical application-log changes | Hash links and on-chain head checkpoints | Modified-log and anchored-deletion tests |
| Lost signing key | Rotation and delayed guardian recovery | Delay, cancellation and completion tests |
| Operational incident | Suspension, pause and retirement | Contract tests |
| Request abuse | Body/file limits and PostgreSQL-backed fixed-window rate limits | Rate-limit regression test |
| Injection and cross-origin requests | Parameterised SQL, schema validation, React text escaping, origin checks and CSP | Input constraints and origin regression test |

## Deployment controls

The application container runs as a non-root user. Its PostgreSQL account cannot create databases, create roles or act as a database superuser. The database initialiser uses a separate owner account. The runtime app mounts only public contract artifacts/addresses from generated configuration; demo private keys are available to the local tooling workflow, not the server.

The API's encryption key is supplied through environment configuration. This is convenient for an isolated prototype, not a production secret manager. Generated credentials are randomly created per installation and omitted from the delivered archive. Never upload your generated directory to a public repository.

Request rate limits are per apparent source IP. Users behind the same proxy share a bucket unless a reviewed proxy configuration is added. No trust is placed in forwarded headers. The fixed window is a basic resource-abuse control, not a distributed denial-of-service mitigation service.

## Trust assumptions

- The configured blockchain RPC provides the canonical network view. This app does not independently verify QBFT quorum signatures in the browser.
- Validator administrators can access validator keys; production validators should be independently controlled and secured.
- Admins intentionally have authority to mint, allocate, change permissions and transfer under policy. A valid Admin misusing that authority is recorded, not automatically prevented.
- Guardian recovery assumes the guardian is trustworthy and compromise is noticed during the delay.
- The gateway is trusted to enforce document policy and keep `FILE_KEY` private. An attacker controlling both database ciphertext and the gateway key can decrypt documents outside the application.
- Session bearer tokens are secret. Identity-bound sessions are not hardware-bound and can be used if stolen before expiry, unless identity/session status changes.

## Limits to disclose

1. No independent security audit, formal proof or production readiness certification has been performed.
2. The default network uses one host, fixed validators and one application RPC endpoint. It is not geographic disaster recovery.
3. Private-network RPC exposes ledger metadata to local authorised network users. Application Auditor permissions do not hide blockchain state from node operators.
4. File access revocation only affects subsequent retrieval. Downloaded copies persist.
5. The NFT establishes token ownership under configured rules. File originality, legal ownership and physical possession require external processes.
6. The prototype DID method is network-scoped and not certified for external interoperability.
7. There is no cross-system atomic transaction between staging a PostgreSQL file and minting its NFT. Cancelled minting leaves an orphaned staged file. It grants no read access by itself.
8. Database migrations, automatic file-key rotation, production key escrow, independent monitoring and external recovery notifications are not implemented.
9. Catalogue/identity enumeration and full log verification are suitable for a hackathon-scale dataset. Large installations need indexed pagination, background indexing and checkpoint-aware verification.
10. Security logs become strongly tamper-evident relative to the chain only after anchoring. An attacker can rewrite an entirely unanchored chain of application logs.

## Handling an incident in the prototype

1. An unaffected Admin pauses asset operations.
2. Suspend the compromised non-Admin identity. For an Admin, first transfer/demote its role using a safe Admin account. The last Admin safeguard prevents accidentally removing all governance.
3. Preserve transaction receipts, security logs and database/chain snapshots.
4. Rotate the compromised key or use the guardian workflow. Do not reuse the compromised controller elsewhere.
5. Inspect file integrity and compare caches with chain state.
6. Resume only after verifying the repaired identity and permissions.

## Dependency scans

Run `npm audit` after installation and retain the output. The isolated development-chain test tool Ganache includes older bundled dependencies and can trigger advisories, including in some `--omit=dev` reports of the full lockfile. Ganache is a development dependency and is not copied into the production application installation. Run a clean production-only install when assessing runtime dependency exposure. Do not deploy the verification harness or expose its RPC publicly.
