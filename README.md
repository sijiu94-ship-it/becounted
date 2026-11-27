# BeCounted

**One real human, one entry.** BeCounted turns Binance **Agent ID** into a reusable on-chain anti-sybil primitive for BNB Chain — so raffles, votes and claim drops can finally say "one person, one shot" and prove it.

Built for the Binance Wallet × BNB Chain **Agent ID Hackathon**.

## The idea

An address is a transport tool; identity is the person. Agent ID is structurally unique — one KYC, one ID, non-transferable — so uniqueness is capped by *humans*, not by a farmer's budget. BeCounted packages that fact into three faces of one anchor:

- **Readable** — an identity card page: is this address a verified unique human, and what has it taken part in?
- **Executable** — `BeCounted.isHuman(address) -> bool`: a stateless, read-only gate any contract or app can call.
- **Countable** — Agent ID as the dedup key for "has this human already been counted in this activity?"

### The two-key rule

- *"Is this a unique human?"* — keyed by **address**, answered by the primitive, on every call.
- *"Has this human been counted here?"* — keyed by **Agent ID**, answered by the **caller**, once per activity.

The primitive itself keeps no state, has **no owner**, and is **not upgradeable**.

### Three boundaries (what it will never do)

1. No reverse lookup — never "whose wallet is this name?"
2. No character judgment — it proves *sameness*, never *trustworthiness*.
3. No small-account hunting — no clustering, no sybil scoring.

## What's in the box

| Layer | What it does |
|---|---|
| `BeCounted` | The primitive: `isHuman(address)` reading the official Agent ID registry (`balanceOf > 0`). |
| `OneIDCampaignsV11` | Reference apps that prove the primitive and generate real interactions: **raffles** (escrowed prizes, reproducible draws — the seed is locked on-chain after entries close via `lockDraw`, re-lockable if its blockhash window lapses, no fallback seed; winners self-claim within a contract-enforced 30-day window; or custom off-chain prizes — a prize description stored on-chain, a winner list drawn on-chain, delivered by the creator, e.g. whitelist spots), **votes** (one ID one vote; option labels are stored on-chain at creation and cannot be changed; optional escrowed prize pool drawn among *all* voters after the vote ends), **claim drops** (one ID one share — fixed amounts or *lucky-draw* random shares via the double-mean rule). Escrow funding is verified by amount actually received, so fee-on-transfer tokens cannot under-collateralise a campaign. Every campaign can carry entry conditions checked on-chain at the gate: X binding, token/NFT holding, prior participation, expedition stamps, a Merkle-root address allowlist, and an Agent ID allowlist — a Merkle root over *name hashes*, checked at entry against the entrant's own handle read live from the registry (address → handle, the only direction this system ever resolves). The list holds identities, never wallet addresses. Creators reclaim unclaimed remainders after a window. |
| `QuestPass` | The flagship **expedition season**: 7 stamp days — one stamp per human per day, each paying a small lucky-draw share of that day's sub-pool, instantly. Holding **≥5 stamps** enters you into the finale: the draw seed is locked on-chain after entries close (and can be re-locked if its blockhash window lapses), winners come from the same reproducible Fisher–Yates draw, escrowed prizes are self-claimed, and the creator reclaims leftovers after 30 days. Season shape is fixed at deployment; no owner, no admin. Mainnet season: 2 USDC/day stamp pools, 45 USDC finale (3 winners × 15 USDC). |
| `IdentityProfile` | The identity card's display layer, kept deliberately separate from verified facts: an on-chain bio (≤160 bytes) plus up to 5 links, written only by the address itself. Self-asserted, and labelled **unverified** wherever it is shown. |
| `GatedClaim` template | `contracts/templates/GatedClaim.sol` — a single-airdrop gated claim for other projects to copy: escrow a pool, it splits into equal shares, one share per verified human, creator reclaims the rest after the window. The two-key rule sits in adjacent lines of `claim()`. |
| Web app | Bilingual (EN/中文） site: checker, campaigns with filters/search, create flow, creator console + public creator pages, identity card with participation record and a shareable card image, campaign detail pages with a **recompute-the-draw proof**, X binding (tweet-tier signed statements, verified in-browser — no database), hot board, platform stats aggregated from events. |
| Agent tool | `agent-tool/is-human.mjs` — a zero-dependency CLI/Skill so AI agents can check a counterparty before interacting. Plus an MCP server (`agent-tool/mcp/`) exposing exactly one read-only tool, `is_human`, for MCP-compatible agents. |

Lucky-draw randomness is blockhash-based pseudo-randomness, labelled in the UI as fit for entertainment-size pools only.

## Join as an Agent ID holder

Your Agentic Wallet can't connect to any website — that's by design, so holders don't join on the site; they send their own agent instead:

1. Send your agent the participation Skill: https://becounted.9nosing.com/becounted-skill.md
2. Tell it in plain words — "join the BeCounted genesis raffle for me", or "claim today's expedition stamp for me".
3. Your agent previews the call first; you confirm once, and the transaction goes out from your own Agentic Wallet address.

Season activities need no X binding and no sign-up beforehand — your address is your identity.

## Deployments

**BSC testnet** (current):

- BeCounted: `0x0cb41f96c84df7bed5db273e77b62414b1a80cbd` (against a mock registry — the real Agent ID registry is mainnet-only)
- OneIDCampaignsV11: `0x8Ce3052c7CcAFd29a58306981D2235433d386d32` (current trial stack, own gate `0x2464F16146EA45C8b30fe3FED5E8f536C5344296` + handleOf mock registry, bindings = IdentityBindingsV3)
- OneIDCampaignsV10: `0x5c6bd30ead292b97e910d761209736A440f4bA3e` (previous trial stack)
- OneIDCampaignsV9: `0x9dac1ccb350a3568a7858f3874b06a69a61aa426`
- OneIDCampaignsV7: `0xfdcb5240fe2bba8d0dd7b325082dc2d8697f0a8f`
- OneIDCampaignsV6: `0x90333a04b15952590f3e4084a91aa8297d57bda6`
- OneIDCampaignsV5: `0xfFF120c006ceB3487AD61943E4022e15cc8eb923`
- IdentityBindingsV3: `0x727dfCc0d86bD58B16Ed607c8CEa146AC396bf30`
- IdentityBindingsV2: `0x3b5a6cd4ae21cf100da21197a58be6d6d406f843`
- QuestPass: `0x90c3320557db7540a5899e7d3bc0577e399ec378` (rehearsal season, pre-V11 source)
- QuestPass (new source, fast trial season): `0xAeC4FF16a9D59ee77079157e6F230AF1d6CE0907` — full finale flow incl. seed expiry + re-lock verified live
- IdentityProfile: `0x03b4a3129199b16ccf144a100b1fc65f31d907c1`
- GatedClaim (demo instance): `0xe216ddd066e2cae40cead9000307f411bf55dc28`

**BSC mainnet**: launches 2026-11-25 with BeCounted pointed at the real Agent ID registry `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`.

## Run it

```bash
npm install
npx hardhat test            # V1 flow script: npx hardhat run test/flow.test.js
```

The web app is static (`web/`): serve the folder with any static host. All chain reads go through multi-RPC fallback providers; network configuration lives in one block at the top of `web/assets/app.js`.

## License

MIT
