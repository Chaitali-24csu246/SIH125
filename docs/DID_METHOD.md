# Prototype did:sih method

This document specifies the method implemented by this prototype. It is an experimental application-specific method, not an assertion of registration in an external DID registry or interoperability certification.

## Identifier

`did:sih:<decimal-chain-id>:<lowercase-stable-identity-address>`

Example with a placeholder address: `did:sih:26125:0x1111111111111111111111111111111111111111`.

An identifier's network configuration includes the canonical IdentityRegistry contract address. This prototype resolver obtains that address from the deployed configuration. **Chain ID alone cannot globally distinguish two private networks that both use 26125**. Therefore resolution is scoped to this configured network; a production method would need an unambiguous network/registry namespace and published method governance.

## Create

A wallet invokes `IdentityRegistry.register(guardian)` and signs the transaction. The stable identity starts as the wallet's address. A key already used by an identity cannot be reused to register an overlapping identity. Registration grants no organisational role. The constructor registers the bootstrap Admin, with its role assigned in AssetPlatform deployment.

## Read

The resolver reads current controller, activity and version directly from IdentityRegistry and returns a DID document. Authentication and assertion references identify the current controller's EVM account using an `eip155` blockchain account identifier. The resolver returns `application/did+json` representation metadata. The API resolver is authenticated; the same public registry state can be inspected directly through authorised network access.

## Update

The active controller signs `rotate(nextController)` or `setGuardian(guardian)`. Rotation increments the identity version and removes authority from the old controller. A new controller cannot already be bound to another identity. Token ownership and roles stay attached to the stable identity.

The guardian can request recovery to a new controller. Completion requires the configured 24-hour delay and the guardian's signature. The existing controller can cancel the pending request. Changing the guardian cancels any old pending recovery.

## Deactivate

The controller deactivates its identity, permanently preventing future authenticated use. Asset and audit history remains. Active platform Admins cannot deactivate until their role is demoted; the final Admin cannot be demoted. Organisation suspension is separately administered in AssetPlatform.

## Limits and security

- A DID proves cryptographic control, not a person's civil identity or employment status. Organisation onboarding is an Admin governance decision.
- The deployer fixes the governance contract once. The deployment script performs that binding before normal use.
- A compromised current controller can act until rotation, recovery or organisational suspension takes effect.
- A compromised guardian can request takeover after the delay. Monitoring and cancellation are essential; no automatic external notification service is included.
- A lost controller with no available guardian may be unrecoverable.
- No verifiable-credential issuance protocol, selective disclosure or zero-knowledge proof implementation is claimed.

Reference: [W3C DID Core](https://www.w3.org/TR/did-core/). The earlier architectural discussion of [ERC-1056](https://eips.ethereum.org/EIPS/eip-1056) informed the stable-identity/controller distinction; this code is not an ERC-1056 registry or a did:ethr implementation.
