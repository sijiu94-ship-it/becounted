# 少数派投票 · 规则说明（中文）

## 这是什么

BeCounted「少数派投票」：一场只对真人开放的链上投票。参加者用持有 Agent ID 的地址投票，一人一票，投完不能改。**得票最少的一方获胜**——和你的选择站在一起的人越少，你赢的机会越大，所以请投你真正认为对的那个选项，而不是跟风猜大家会选什么。

## 规则

- **一人一票**：每个持有币安 Agent ID 的地址只能投一票，合约在链上强制执行，重复投票会被拒绝。没有 Agent ID 的地址无法参加。
- **少数派获胜**：投票截止后，得票最少的选项为获胜方，该选项的全部投票者为获奖者。
- **平票规则**：若多个选项并列得票最少，这些选项的投票者**合并**为获胜方，一起平分奖金。
- **奖金平分**：奖金总额 **15 USDC**，由获胜方全部投票者平均分配（按整数最小单位计算，除不尽的零头留在组织方账上并在结算时公示）。
- **发奖方式**：本投票的奖金不经过合约托管。投票截止后 **48 小时内**，组织方按结算名单逐一手动转账发放，并**公示完整获奖名单与每一笔发奖交易哈希**。
- **任何人可复算**：全部投票都记录在 BNB Chain 链上（OneIDCampaignsV5 合约的 `Voted` 事件）。任何人都可以用开源脚本 `scripts/settle-vote.js` 独立重算票数、获胜方与每人金额，结果必须与公示的结算文件 `vote-payout-<活动编号>.json` 完全一致。对结果有异议，请附上你的复算结果联系我们。

## 注意事项

- 本活动为社区互动投票，奖金为固定总额、一次性分配，不构成任何收益承诺，参与不收取任何费用。
- 投票一旦提交无法修改或撤回，请确认选项后再提交（提交需支付少量链上 gas）。
- 若获胜方某选项得票为 0（无人投票），该选项没有可发放的投票者；结算时将如实公示该情况。

---

# Minority Vote · Rules (English)

## What this is

BeCounted's **Minority Vote**: an on-chain vote open only to verified humans. You vote from the address that holds your Agent ID — one address, one vote, no changes after voting. **The option with the FEWEST votes wins.** The fewer people stand on your side, the better your chances — so vote for what you actually believe, not for what you guess the crowd will pick.

## Rules

- **One human, one vote**: each address holding a Binance Agent ID can vote exactly once; the contract enforces this on-chain and rejects repeat votes. Addresses without an Agent ID cannot take part.
- **Minority side wins**: after the vote closes, the option with the fewest votes is the winning side, and every voter on that option is a winner.
- **Tie rule**: if several options tie for the fewest votes, the voters of **all** tied options are combined into the winning side and share the prize together.
- **Equal split**: the total prize is **15 USDC**, split equally among all winning-side voters (computed in the token's smallest unit; any indivisible remainder stays with the organiser and is disclosed in the settlement).
- **Manual payout**: the prize for this vote is not escrowed in the contract. Within **48 hours** after the vote closes, the organiser pays each winner manually according to the settlement list, and **publishes the full winner list together with every payout transaction hash**.
- **Anyone can recompute**: every vote is recorded on BNB Chain (the `Voted` events of the OneIDCampaignsV5 contract). Anyone can independently recompute the tallies, the winning side, and the per-voter amounts with the open-source script `scripts/settle-vote.js`; the result must match the published settlement file `vote-payout-<campaignId>.json` exactly. If your recompute disagrees, send it to us and we will answer publicly.

## Notes

- This is a community vote with a fixed, one-time prize pool. It is not a promise of returns, and taking part costs nothing beyond the small on-chain gas fee for submitting your vote.
- A vote cannot be changed or withdrawn once submitted — double-check your option first.
- If a winning-side option received 0 votes (nobody voted for it), there is nobody to pay on that option; the settlement will disclose this as-is.
