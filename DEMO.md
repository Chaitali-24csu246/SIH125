# Demonstration guide

Use synthetic files and the five generated identities. Keep `generated/public-accounts.json` available to map names to addresses. A short main demonstration takes approximately 6–8 minutes after setup; this is a suggested presentation duration, not a measured runtime guarantee.

## Prepare once

1. Start the stack and run `scripts/doctor.mjs`.
2. Create two small local text or PDF documents with invented content.
3. Sign in as Admin and confirm the network is unpaused.
4. Run the live experiment suite before rehearsing, so Security Results contains measured evidence.
5. Verify all four validators in Audit Explorer. A node being reachable is not proof of consensus participation; demonstrate advancing blocks too.

## Main demonstration

| Step | Action | Evidence to show |
|---|---|---|
| 1 | Unlock the Admin wallet and sign the login challenge | Controller proof, current Admin role, no role-selection login |
| 2 | Open Identities; resolve Rahul's DID | Stable identity, controller and version in a real resolver response |
| 3 | In Assets, register a document with code `BEL-DOC-001` | Wallet-signed NFT mint, real transaction hash and unallocated token |
| 4 | Open the asset and allocate it to Rahul | Admin-authorised allocation and the owner DID |
| 5 | Sign in as Rahul; download the document | Contract-approved access and content-integrity verification |
| 6 | Sign in as Manager; transfer the asset from Rahul to Priya | Manager policy permits transfer; token retains its identity |
| 7 | Sign in as Rahul and refresh | Former owner's access disappears unless separately granted again |
| 8 | Sign in as Auditor; open Audit Explorer | Mint/allocation/transfer events with block, actor and transaction details |
| 9 | Open Security Results | Actual test report, pass/fail details and anchored evidence |

The UI hides operations a role cannot use, but this is only a convenience. The separate experiment suite proves that direct requests are rejected too.

## Security demonstration

**Direct attack evidence:** Run `docker compose --env-file generated/config.env run --rm tools npm run experiments`. Show the output, then the imported report. One attack is submitted with an explicit gas limit so it is actually mined and fails. Copy its transaction hash from the raw results and inspect it under Audit Explorer's transaction receipt form. Show `REVERTED` with no retained contract logs.

**Revocation:** Admin grants Auditor privileges to a second identity, that identity signs in and opens audit data, then Admin revokes the role. Refresh the original session: the API checks the current contract policy, so the old session cannot retain audit privileges. Restore the initial role for later experiments.

**Time-limited access:** Admin opens an asset, grants Manager access for one hour, and Manager downloads it. Admin revokes access; Manager's next request fails. Automated contract tests cover actual expiry by advancing development-chain time. Besu does not use this simulator time-travel command; do not claim an hour passed in a live Besu demo.

**Database tampering:** Admin rebuilds a selected asset's cache. Auditor compares it with chain state and sees `MATCH`. The live experiment changes only its own newly-created synthetic cache row, observes `MISMATCH`, then restores the row. Ownership on-chain stays unchanged. Read the raw test description rather than modifying production records manually.

**Emergency pause:** Admin opens Access Policies and pauses operations. Show that document retrieval and transfers stop. Resume operations afterwards.

**Key rotation:** Use a disposable non-Admin identity. Prepare another funded wallet that has never registered its own identity. In Your Identity, rotate to its controller address. Sign in with the new wallet and resolve the same stable DID; assets remain attached to that DID. The old controller cannot authenticate. Do this last: changing a seeded account breaks future demo scripts until you restore/reset the demonstration network.

**Guardian recovery:** Show the configured guardian and 24-hour waiting rule. Automated tests verify request, cancellation and delayed completion. For a short live presentation, show a new request and cancel it from the current controller. Do not shorten the contract delay just for the presentation.

## Validator resilience

On macOS/Linux:

```bash
sh experiments/resilience.sh
```

The script stops Validator 4, records whether the chain advances over ten seconds and restarts it even if the measurement fails. Keep Validators 1–3 running. On Windows execute the stop, measurement and restart commands separately, always restarting the node:

```powershell
docker compose --env-file generated/config.env stop besu4
docker compose --env-file generated/config.env run --rm tools node experiments/resilience.mjs
docker compose --env-file generated/config.env start besu4
```

Show the changing head block and the unavailable fourth node in Audit Explorer. This demonstrates process-level validator resilience; all containers still share a single host.

## Screenshots for the six-slide submission

1. **Assets:** selected allocated document, owner DID, content fingerprint and verified status. Keep the content synthetic.
2. **Audit Explorer:** current ledger head plus expanded allocation/transfer event. Include readable block/transaction evidence.
3. **Security Results:** the live Besu run's report, showing both successful permitted actions and rejected attacks.

Use a wide desktop viewport and crop to the relevant panel. Hide wallet passwords, private keys and unrelated browser content. `docs/SLIDE_PLAN.md` maps these to the supplied template.

## Accurate claims

- Say “contract-enforced ownership and permission changes.”
- Say “tamper evidence relative to the ledger and anchored checkpoints.”
- Say “prototype DID method with implemented cryptographic controller proof.”
- Do not say “unhackable”, “fully trustless”, “formally verified”, or “all cyberattacks prevented”.
- NFTs establish registered token history; they cannot prove that an external physical object is authentic or prevent every duplicate representation.
- Download revocation cannot erase a previously downloaded copy.
