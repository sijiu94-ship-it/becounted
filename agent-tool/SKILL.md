# Skill: is-human (Agent ID unique-human check)

**What it does** — Answers one question for an agent about to act:
"Is the address I'm dealing with backed by a unique human?"

It reads the Binance Agent ID registry on BNB Chain
(`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`). An address holding an
Agent ID is backed by exactly one KYC-verified human, because Agent IDs
are issued one-per-KYC and are non-transferable. The check is a public
on-chain read: the skill issues no trust of its own and keeps no data.

**When to use it**
- Before accepting a counterparty, entrant, voter, or claimer in any
  one-person-one-share flow (raffles, votes, whitelists, claims).
- As a pre-flight check before calling a contract that gates on
  `BeCounted.isHuman(address)`.

**How**
```bash
node is-human.mjs 0xAddress [0xAddress...]
```
Output is one JSON object per address: `isHuman`, `agentIdBalance`,
and a plain-language `meaning`. Exit code 0 = all human, 1 = at least
one not confirmed, 2 = error.

**What it does NOT mean**
- `isHuman: true` proves *uniqueness and continuity* ("same one person,
  only one of them"), never *trustworthiness*. A verified human can
  still misbehave; they just cannot multiply or shed the identity.
- There is deliberately no reverse lookup (name → wallet). The skill
  answers address → human?, nothing else.
