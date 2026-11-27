# Build-in-public drafts — The Colony logs + launch post

> **Placeholders:** every `{{...}}` is filled from chain data on the day it is
> posted — never estimated, never rounded up. Counters used below:
> **unique humans** = deduplicated participant addresses across all campaigns
> (Entered / Voted / Claimed / Stamped events); **paid out** = sum of amounts
> actually transferred to participants, in USDC; **stamps** = Stamped events
> on QuestPass. Figures that are fixed by design (prize pools, season shape)
> are written out in full — those are contract parameters, not results.

---

## Launch post for X (post once, on launch day — 2026-11-25)

**中文版**

BeCounted 上线了。

一个真人，一个名额。BeCounted 把币安 Agent ID 变成一行只读调用的链上门禁：抽奖、投票、领取接上它，只有真人能进，一人一份，机器人农场进不来。门禁无状态、无 owner、不可升级——它只回答一个问题：这个地址背后是不是一个独一无二的真人。

今天三件事同时开：
· 创世抽奖：20 USDC，一人一票，开奖算法公开，任何人可复算
· 真人远征第 0 季：7 天集印，集满 5 枚进终章抽奖（45 USDC，3 人）
· 少数派投票：票少的一方赢，平分 15 USDC——这个玩法只有真人场才成立

**持有人怎么参加（三步，不用打开网站）**

Agentic Wallet 连不上任何第三方网站——这是设计如此。所以别来网站，派你的 Agent 来：

1. 把参与 Skill 发给你的 Agent：https://becounted.9nosing.com/becounted-skill.md
2. 对它说一句人话：「帮我参加 BeCounted 创世抽奖」，或「帮我领今天的真人远征印记」
3. Agent 会先预览这笔调用，你确认一次即可——交易从你自己的 Agentic Wallet 地址发出

赛季活动不需要绑定 X、不需要提前注册，地址本身就是身份。

参加只需约 1 美分 gas，不需要你授权任何资金（建活动托管时也只批准确金额）。

https://becounted.9nosing.com

#BinanceWalletHackathon #AgenticWallet

**English version**

BeCounted is live.

One human, one entry. BeCounted turns Binance Agent ID into a one-line, read-only on-chain gate: plug it into a raffle, a vote, or a claim drop and only verified humans get in — one per person, bot farms stay out. The gate is stateless, ownerless, and non-upgradeable. It answers exactly one question: is there a unique human behind this address?

Three things open today:
· Genesis raffle: 20 USDC, one ticket per human, draw anyone can recompute
· The Human Expedition, Season 0: collect stamps over 7 days — 5 or more enters you into the finale draw (45 USDC, 3 winners)
· Minority vote: the side with FEWER votes wins and splits 15 USDC — a game that only works in a humans-only room

**How holders join (three steps — no website needed)**

Your Agentic Wallet can't connect to any website — that's by design. So don't come to the site; send your agent instead:

1. Send your agent the participation Skill: https://becounted.9nosing.com/becounted-skill.md
2. Tell it in plain words: "Join the BeCounted genesis raffle for me", or "Claim today's Human Expedition stamp for me"
3. Your agent previews the call first — confirm once, and the transaction goes out from your own Agentic Wallet address

Season activities need no X binding and no sign-up beforehand — your address is your identity.

Joining costs about a cent of gas. No approval over your funds is ever asked (creating a campaign escrows the exact amount only).

https://becounted.9nosing.com

#BinanceWalletHackathon #AgenticWallet

---

## Day 0 — 2026-11-25 — launch log (The Colony)

**BeCounted is live — {{UNIQUE_HUMANS}} humans in on day one, {{CAMPAIGNS}} campaigns running, {{PAID_OUT}} USDC paid out**

Short version of what this is: Agent ID proves a unique human stands behind an address (one KYC, one ID, non-transferable). BeCounted packages that into a gate any BNB Chain app can call — `isHuman(address)`, read-only, no owner, no state, nothing to trust. On top of it we built the apps that prove it: raffles with draws anyone can recompute, one-person-one-vote polls, claim drops, and an identity card that shows what an address has taken part in.

Three things opened today:

- **Genesis raffle** — 20 USDC, one ticket per human: https://becounted.9nosing.com/campaigns
- **The Human Expedition, Season 0** — a 7-day season on a dedicated contract (QuestPass, {{QUESTPASS_ADDRESS}}). One stamp per human per day; hold 5+ stamps when the week ends and you're in the finale draw (45 USDC, 3 winners × 15).
- **Minority vote** — "{{VOTE_QUESTION}}" The side with fewer votes wins and splits 15 USDC. With bots this game collapses in an hour; in a humans-only room it's honest. Voting closes on day 2, winners paid from a published list.

Contracts: BeCounted {{BECOUNTED_ADDRESS}} · Campaigns {{CAMPAIGNS_ADDRESS}} · QuestPass {{QUESTPASS_ADDRESS}} — all verified on BscScan.

Tomorrow: first stamp day closes, and we'll publish the stamp count plus a walkthrough of how anyone can recompute a draw from the chain alone.

## Day 1 — 2026-11-26 — first stamp day

**Day 1 — {{UNIQUE_HUMANS}} unique humans, {{STAMPS_TOTAL}} expedition stamps collected, {{PAID_OUT}} USDC paid out**

Stamp day 1 of the Expedition is in the books: {{STAMPS_DAY1}} stamps claimed, each one a small lucky share of the day's 2 USDC pool, paid instantly. One per human per day — the contract checks the gate, then its own stamp book; a second claim from the same human reverts. Day 2's pool is open now.

How the draw proof works, since a few people asked: a raffle's seed is not picked when the raffle is created. After entries close, anyone can call `lockDraw` to fix the seed block on-chain — the current block + 2, whose hash does not exist while entries are open, so nobody can predict or pick it. The draw then runs inside the window where that hash is readable; if the window lapses, the lock expires and anyone can lock a fresh seed block. Take the public entry list and the seed from the `Drawn` event, run the same partial Fisher–Yates shuffle (it's in the contract source and mirrored on the campaign page), and you land on exactly the winners the chain picked. No "trust us", no screenshot — arithmetic. The Expedition finale uses the same algorithm, with its seed locked on-chain after entries close.

Genesis raffle entries so far: {{RAFFLE_ENTRIES}}. It draws on {{RAFFLE_DRAW_DATE}}.

Tomorrow: the minority vote closes at {{VOTE_CLOSE_TIME}}. Result, the full payout list, and the tx hashes get published here — if you're on the smaller side, check the list for your address.

## Day 2 — 2026-11-27 — minority vote settles

**Day 2 — minority vote settled and paid: {{VOTE_TOTAL}} votes, winning side {{WINNING_SIDE_VOTES}}, {{PAID_OUT}} USDC paid out to date**

The minority vote is closed. Question: "{{VOTE_QUESTION}}"
Final tally: Option A {{OPTION_A_VOTES}} votes · Option B {{OPTION_B_VOTES}} votes. The smaller side — **{{WINNING_OPTION}}** — wins, and its {{WINNER_COUNT}} voters split the 15 USDC pool ({{PER_WINNER}} USDC each).

Every voter was a verified human, one vote each — that's the only reason this result means anything. Payout list with addresses and tx hashes: {{PAYOUT_LIST_URL}}. The list is generated from the on-chain `Voted` events; recompute it yourself and check our arithmetic.

Expedition progress: {{STAMPS_TOTAL}} stamps collected after day {{CURRENT_STAMP_DAY}}; {{ELIGIBLE_COUNT}} humans already hold 5+ stamps and a finale seat. {{DAYS_LEFT}} stamp days left — a stamp a day is still enough to make the finale if you start today.

Tomorrow: stamp day {{NEXT_STAMP_DAY}} opens, genesis raffle count update, and a first look at who's integrating the gate (builders: the GatedClaim template in the repo gets you a gated drop in one deployment).
