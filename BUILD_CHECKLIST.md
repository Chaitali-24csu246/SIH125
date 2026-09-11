# Concrete build and refinement checklist

This checklist maps the delivered implementation to the problem statement. “Implemented” describes source functionality, not independent certification or completed Docker validation.

| Component | Status | Main implementation | Your verification task |
|---|---|---|---|
| Four-validator Besu QBFT network | Configured | `compose.yaml`, `scripts/init.mjs`, `infra/start-besu.sh` | Start on Docker, verify advancing blocks and matching heads |
| PostgreSQL persistent data | Implemented | `server/schema.sql`, database init script | Restart containers and confirm persistence |
| Decentralised identity and key control | Implemented | IdentityRegistry, DID resolver, signed challenges | Register fresh wallet, resolve DID and sign in |
| NFT asset registration | Implemented | AssetPlatform ERC-721 | Mint a synthetic document and inspect transaction |
| Admin-only mint and allocation | Implemented and regression-tested | Contract checks on both operations | Try Manager allocation in isolated suite |
| Four roles and configurable permissions | Implemented and regression-tested | Identity-bound roles and permission bits | Change and revoke roles while sessions remain open |
| Controlled ownership transfer | Implemented and regression-tested | Transfer override; approvals disabled | Check standard and safe-transfer attack paths |
| Immutable critical history | Implemented | Registry/platform events | Resolve transactions directly from chain |
| Encrypted file storage and access | Implemented and regression-tested | AES-GCM, live chain checks, content hash | Upload/download; expiry and revocation checks |
| Key rotation and guardian recovery | Implemented and regression-tested | Stable identity plus controller lifecycle | Rehearse with disposable identity |
| Audit explorer and failed receipts | Implemented | Audit and transaction APIs, React explorer | Inspect successful and reverted transactions |
| Pause, suspension and retirement | Implemented and regression-tested | Platform lifecycle controls | Restore pause/role state after demonstration |
| Tamper-evident application logs | Implemented and regression-tested | Hash-linked logs plus chain anchors | Anchor a checkpoint; inspect verification status |
| Research-inspired sequence testing | Implemented and executed on development chain | `experiments/run.mjs` | Repeat on Besu and retain raw samples |
| Database/chain read comparison | Implemented | Live experiment suite | Run with Docker DATABASE_URL and inspect methodology |
| Throughput and latency workloads | Implemented | `experiments/benchmark.mjs` | Run chosen sizes on your hardware |
| Validator outage experiment | Implemented, needs Docker validation | `experiments/resilience.*` | Run and restore stopped node |
| Reproducible setup and demo | Included | SETUP, DEMO, setup scripts | Complete a fresh-machine rehearsal |

## Recommended order for your next three days

**Day 1: validate integration.** Run setup, doctor, automated tests and the main demo. Fix environment-specific Docker/network issues first. Record exact software/image versions and machine resources. Create three sample assets. Do not modify the contracts until this baseline works.

**Day 2: refine and measure.** Run live attacks and performance workloads. Review the role matrix, identity lifecycle and failure messages. If you change code, rerun the relevant regression tests. Use model-test counterexamples as bugs to fix, not results to hide. Rehearse the single-validator outage.

**Day 3: presentation and stability.** Freeze source, back up state, capture three screenshots, prepare the six-slide PDF using the supplied template, and rehearse the narrative. Keep the final half-day for repeatability instead of adding a new feature.

## Deliberately outside the delivered security boundary

Hardware-protected keys, production HSMs, independent contract audit, external DID ecosystem certification, cross-organisation hosting, geographically independent validators, SSO/MFA federation, zero-knowledge credentials and formal verification are not claimed. These require additional engineering and review; no placeholder UI pretends they are implemented.
