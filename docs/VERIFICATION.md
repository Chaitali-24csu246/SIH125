# Verification record

Verification performed during this build on 10 September 2026. This record separates executed checks from deployment configuration that still requires the user's Docker environment.

## Executed successfully

- Solidity compilation with solc 0.8.30, Paris EVM target and optimisation enabled.
- Production React/Vite build, including all application views and controls.
- **20 passing regression tests** covering contracts and the API.
- API tests use a real PostgreSQL engine compiled to WebAssembly (PGlite), not the earlier SQL mock. Contract tests use Ganache, not Besu.
- **9 passing end-to-end experiment checks** against the verification harness: header forgery, replay, wrong signer, encrypted ownership-based retrieval, contract governance attacks, a mined failed transfer, seeded state transitions, approval bypass attempts and file-access revocation.
- The stateful experiment executed **40 seeded transitions**, with both successful and rejected transfer attempts and ownership assertions.
- The experiment runner successfully imported its report into the API and anchored its fingerprint on-chain.
- Fresh production-only and full tooling npm installations on Linux. Corrected Ganache's bundled lockfile metadata so the macOS-only `fsevents` package does not block Linux `npm ci`.
- Clean production-only dependency audit: **0 reported vulnerabilities** at verification time. This is a point-in-time package scan, not an application audit.
- Network initialisation script executed in an isolated temporary directory. Generated QBFT extraData was decoded and matched against all four generated validator keys.
- Shell syntax, JavaScript syntax, Compose structure and loopback port bindings checked.

## Not executed here

- Docker image builds and the four running Besu validator containers: Docker was unavailable.
- PostgreSQL over a TCP connection in the Compose stack, including container initialisation and advisory-lock concurrency under multiple API workers. API SQL and binary handling were tested through PGlite.
- The live experiment's optional PostgreSQL cache-tamper and SQL-vs-RPC timing steps, which require the Compose database connection. Related cache-tamper behaviour is covered by the API regression suite.
- Live Besu performance workloads and the validator-stop resilience script. These are implemented and ready to run; no fabricated performance results are included.
- Browser-driven interaction or visual screenshot QA. The frontend was compiled successfully; follow DEMO.md to validate interactions and capture your screenshots.
- Independent contract audit, formal verification, production penetration testing or external DID interoperability certification.

## Evidence files

| File | Meaning |
|---|---|
| `verification/final-check.txt` | Compile/build/regression test output |
| `verification/build-output.txt` | Final UI build after copy refinements |
| `verification/development-chain-experiments.json` | Actual completed development-chain experiment report |
| `verification/development-chain-raw.json` | Transaction receipt reference and seeded sequence data |
| `verification/runtime-dependency-audit.json` | Clean production-only dependency scan |

The saved sample report identifies its Ganache client and omitted live-database experiments. It is reference evidence for development verification, not your final Besu result. Run the suite on your own stack and use those generated files in the presentation.

## Lockfile maintenance

If you deliberately change npm dependencies, run `node scripts/normalize-lock.mjs` afterwards and verify `npm ci` in a clean directory. The script marks only Ganache's nested bundle as development-only and its macOS watcher as optional. It does not suppress runtime vulnerability findings or modify package source.
