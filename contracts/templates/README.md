# GatedClaim — Agent-ID-Gated Airdrop Template

A deliberately small example contract showing how any project can run a
sybil-resistant claim on BNB Chain using the
[BeCounted](../BeCounted.sol) primitive.

One deployed instance is one drop:

1. A creator escrows a pool — BNB or any ERC20.
2. The pool is split into `maxClaims` **equal shares**.
3. Each address backed by a unique human (an **Agent ID** holder, checked
   on-chain through BeCounted) can claim **exactly one share**, paid out
   in the same transaction, first come first served.
4. When the window ends, the creator reclaims whatever was never claimed
   (leftover shares + integer-division dust).

No allowlist files to maintain, no Merkle tree, no farm of fresh wallets
splitting the pool: one KYC-anchored identity gets one share, enforced by
contract code, verifiable by anyone.

## The two-key principle, in this template

Sybil resistance is two different questions, and they use two different
keys. This template keeps them visibly separate:

| Question | Answered by | Where in the code |
| --- | --- | --- |
| "Is this address backed by a unique human?" | The **BeCounted primitive**, keyed by address, asked on **every** call | `gate.isHuman(msg.sender)` in `claim()` |
| "Has this human already been counted in **this** drop?" | **This contract's own bookkeeping** | the `claimed` mapping |

BeCounted is stateless and knows nothing about your drop. The dedup
state (`claimed`, `claimedCount`) lives in the caller — that separation
is the point of the design. Dedup by holding address *is* dedup by
Agent ID, because an Agent ID is non-transferable and lives in exactly
one wallet.

## Deploy parameters

`GatedClaim(gate, token, totalPool, maxClaims, startAt, endAt)`

| Parameter | Meaning |
| --- | --- |
| `gate` | BeCounted address. Testnet: `0x4858c1c6a4428c65ee6f60aac21a3f404d85d598`. Mainnet: the deployed BeCounted (see project README). |
| `token` | `address(0)` for a BNB pool, or the ERC20 contract address. |
| `totalPool` | Total escrow, in the token's smallest unit (wei for BNB). Must be at least `maxClaims`, so every share is at least 1 unit. |
| `maxClaims` | Number of equal shares. `share = totalPool / maxClaims` (integer division; dust is reclaimable by the creator after the deadline). |
| `startAt` / `endAt` | Claim window, unix seconds. Claims are open while `startAt <= now <= endAt`. |

### Funding (one extra step, on purpose)

Deployment and funding are separate so an ERC20 creator can approve the
deployed contract first:

- **BNB pool:** call `fund()` sending exactly `totalPool` wei.
- **ERC20 pool:** `approve(gatedClaimAddress, totalPool)` on the token,
  then call `fund()` with no value.

`fund()` is creator-only and can only succeed once. Claims revert with
`NotFunded` until the pool is escrowed.

## Make it yours

The template is a starting point, not a framework. Typical adaptations:

- **Whitelist / allowlist claim** — this already is one: the "list" is
  "holds an Agent ID", maintained by the registry instead of by you.
- **Per-user amounts** (e.g. snapshot-based allocations) — replace the
  single `share` with a `mapping(address => uint256)` of allocations
  written by the creator before `startAt`. Keep the gate check and the
  `claimed` dedup exactly as they are; they are the load-bearing parts.
- **NFT mint instead of a token payout** — replace `_pay(...)` in
  `claim()` with your mint call. The human check and the one-per-human
  bookkeeping do not change.
- **Multiple drops from one contract** — wrap the state (pool, window,
  `claimed`) in a struct keyed by a drop id, like
  [OneIDCampaignsV5](../OneIDCampaignsV5.sol) does for its campaign kinds.
- **Different gate** — anything exposing `isHuman(address) returns
  (bool)` can be substituted; the template only depends on that one call.

## Security notes

- **Powers are minimal and disclosed.** There is no owner. The creator's
  only privilege is `reclaim()` of the unclaimed remainder, and only
  after `endAt`. The creator cannot pause the drop, change its rules,
  redirect shares, or reclaim early. Rule changes are impossible by
  construction: every parameter is `immutable`.
- **Reentrancy.** `claim()` marks the claim before paying
  (checks-effects-interactions) and both `claim()` and `reclaim()` sit
  behind a hand-rolled reentrancy lock, so neither a malicious token nor
  a contract claimant can double-dip.
- **Token caveats.** The template expects a well-behaved ERC20 whose
  `transfer` / `transferFrom` return `true` on success. Fee-on-transfer
  tokens would break the pool accounting (the contract would receive
  less than `totalPool`); do not use them without adjusting `fund()`.
- **No randomness anywhere in this template.** Shares are equal by
  construction, so there is nothing to game and nothing to audit on
  that front. (If you add a lucky-draw mode, blockhash-based randomness
  is entertainment-grade only — see OneIDCampaignsV5 for an honestly
  labelled example.)
- **Dust.** `totalPool / maxClaims` rounds down. Choose a `totalPool`
  divisible by `maxClaims` if you want zero dust; otherwise the dust
  simply returns to the creator via `reclaim()`.
- **Deadline discipline.** `reclaim()` before or at `endAt` reverts.
  Claimants get the full announced window, always.
