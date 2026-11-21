# HumanGate

**One real human, one entry.** HumanGate turns Binance **Agent ID** into a reusable on-chain anti-sybil primitive for BNB Chain — so raffles, votes and claim drops can finally say "one person, one shot" and prove it.

Built for the Binance Wallet × BNB Chain **Agent ID Hackathon**.

## The idea

An address is a transport tool; identity is the person. Agent ID is structurally unique — one KYC, one ID, non-transferable — so uniqueness is capped by *humans*, not by a farmer's budget. HumanGate packages that fact into three faces of one anchor:

- **Readable** — an identity card page: is this address a verified unique human, and what has it taken part in?
- **Executable** — `HumanGate.isHuman(address) -> bool`: a stateless, read-only gate any contract or app can call.
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
| `HumanGate` | The primitive: `isHuman(address)` reading the official Agent ID registry (`balanceOf > 0`). |
| `OneIDCampaignsV5` | Reference apps that prove the primitive and generate real interactions: **raffles** (escrowed prizes, reproducible draws, winners self-claim), **votes** (one ID one vote), **claim drops** (one ID one share — fixed amounts or *lucky-draw* random shares via the double-mean rule). Creators reclaim unclaimed remainders after a window. |
| Web app | Bilingual (EN/中文） site: checker, campaigns with filters/search, create flow, creator console + public creator pages, identity card with participation record and a shareable card image, campaign detail pages with a **recompute-the-draw proof**, X binding (tweet-tier signed statements, verified in-browser — no database), hot board, platform stats aggregated from events. |
| Agent tool | `agent-tool/is-human.mjs` — a zero-dependency CLI/Skill so AI agents can check a counterparty before interacting. |

Lucky-draw randomness is blockhash-based pseudo-randomness, labelled in the UI as fit for entertainment-size pools only.

## Deployments

**BSC testnet** (current):

- HumanGate: `0x4858c1c6a4428c65ee6f60aac21a3F404D85d598` (against a mock registry — the real Agent ID registry is mainnet-only)
- OneIDCampaignsV5: `0xfFF120c006ceB3487AD61943E4022e15cc8eb923`
- IdentityBindings: `0xC76847F54Fe3C2ca6eB61e5dd998e11Bd7e5988C`

**BSC mainnet**: launches 2026-11-26 with HumanGate pointed at the real Agent ID registry `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`.

## Run it

```bash
npm install
npx hardhat test            # V1 flow script: npx hardhat run test/flow.test.js
```

The web app is static (`web/`): serve the folder with any static host. All chain reads go through multi-RPC fallback providers; network configuration lives in one block at the top of `web/assets/app.js`.

## License

MIT
