# Research and experimental methodology

## Research used

**SmartFuzz: Multi-Agent Collaborative Fuzzing with Continuous Reflection for Smart Contracts Vulnerability Detection**, Jie Chen and Liangmin Wang, November 2025 preprint. [Source](https://arxiv.org/abs/2511.12164).

The paper motivates testing meaningful transaction sequences because vulnerabilities may depend on earlier contract state. Our runner applies that general insight with a seeded, explicit permission/ownership reference model. It does not reproduce the paper's LLM agents, reflection mechanism or claimed benchmark improvements. Sequence testing itself is an established method; we make no claim to invent it.

**Endorsement-Driven Blockchain SSI Framework for Dynamic IoT Ecosystems**, Guntur Dharma Putra and Bagus Rakadyanto Oktavianto Putra, July 2025; listed as accepted to IEEE ICBC 2025 as a short paper. [Full text](https://arxiv.org/html/2507.09859v1).

The paper discusses decentralised identity registries and dynamic credential governance/revocation. It informed the attention to lifecycle and changing authority. Its endorsement-based trust scoring and open issuer model are not implemented, because BEL's statement requires controlled administrative asset issuance.

## Engineering references

- [W3C DID Core](https://www.w3.org/TR/did-core/): DID documents, verification relationships and identity lifecycle.
- [ERC-1056](https://eips.ethereum.org/EIPS/eip-1056): background on lightweight identity/controller registries; not our method implementation.
- [OpenZeppelin ERC-721](https://docs.openzeppelin.com/contracts/5.x/api/token/erc721): token implementation and extension points.
- [Besu QBFT network tutorial](https://docs.besu-eth.org/private-networks/tutorials/qbft): four-validator network and genesis structure.
- [Besu QBFT consensus](https://docs.besu-eth.org/private-networks/how-to/configure/consensus/qbft): validator quorum and failure behaviour.
- [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/): receipt, block and event retrieval.

## Experiments included

| Experiment | Method | Output |
|---|---|---|
| API identity and role attacks | Forge header, replay signature, sign with wrong controller | Observed HTTP status and result |
| Real failed transaction | Submit unauthorised transfer with explicit gas limit | Mined status-0 receipt and unchanged owner |
| Stateful policy model | Seed 26125; 40 role/pause/transfer transitions | Complete sequence, allowed/denied counts and owner checks |
| File access | Synthetic encrypted document; owner and non-owner retrieval | Exact content match and permission denial |
| Cache tampering | Change only newly-created synthetic cache row, compare, restore in finally block | Mismatch detected; blockchain owner unchanged |
| Owner-read cost | 30 serial cached SQL reads and contract eth_call reads | Mean, p50, p95 and raw samples |
| Workload benchmark | Isolated contract; configurable mint counts and batches of ten RPC reads | Latencies, throughput, gas and raw samples |
| One-validator outage | Stop Validator 4, inspect block advancement for ten seconds, restore | Before/after block numbers |
| Regression suite | Replay races, expiry, role transitions, key recovery, file tamper, log tamper | Test-run output |

## Run commands

```bash
docker compose --env-file generated/config.env run --rm tools npm run experiments
docker compose --env-file generated/config.env run --rm tools node experiments/benchmark.mjs
sh experiments/resilience.sh
```

For larger workloads:

```bash
docker compose --env-file generated/config.env run --rm -e BENCH_COUNTS=100,500,1000 tools node experiments/benchmark.mjs
```

These are serial writes and will take time under a two-second block period. They are not a saturation test. Keep the default sizes for an initial run and increase only when there is a question the extra load resolves.

## Interpretation

The SQL/eth_call comparison measures the latency of different sources for an ownership lookup. It does not measure blockchain consensus, because eth_call is a read. The write benchmark includes submission-to-receipt time. Do not combine those quantities into one “blockchain latency” number.

Report sample sizes, CPU/RAM, client/version, node count and whether everything ran on one host. Keep raw data even when a result is unfavourable. Small-sample p95/p99 values are descriptive and should not be presented as production service-level guarantees.

The test suite's success is evidence for the listed scenarios, not a universal attack-block percentage. A security matrix must include allowed actions as positive controls. Our state-sequence runner requires at least one permitted and one denied transfer.

Generated reports are submitted by an authorised operator and their fingerprints can be anchored. The anchor demonstrates that the report has not changed since anchoring; it does not make the report's measurements independently trustworthy.

## What would be a defensible research contribution

Present a narrow question: **Do identity and ownership permissions remain consistent after role revocation, suspension and asset transfer?** Show the model, tested sequences, observed results and counterexamples if any. That is a concrete engineering evaluation closely tied to the statement. Do not claim a new consensus protocol or novel cryptography.
