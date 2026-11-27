# BeCounted 合约安全审核包

**项目**：BeCounted —— 基于 Binance Agent ID（SPACE ID 注册表）的「真人唯一性」原语与参考应用，
参加币安钱包 × BNB Chain Agent ID 黑客松（提交截止 2026-12-09）。
**本包版本**：2026-11-27，对应 BSC 主网现行部署。
**源码仓库（公开）**：https://github.com/sijiu94-ship-it/becounted

审核为**纯只读**工作：你只需要本包与下方链接。项目方不会向审核方索取、也不需要审核方提供任何私钥/助记词/API 密钥。

---

## 1. 在审范围（BSC 主网，源码均已在 BscScan 验证）

| 合约 | 源码文件 | 主网地址 | 行数 | 职责 |
|---|---|---|---|---|
| BeCounted | `contracts/BeCounted.sol` | 0xdA585A4aE5b73Ee2728AadA3e877A3A1F84027cd | 66 | 只读原语：`isHuman(address)`（查 Agent ID 注册表 balanceOf）。无 owner、不可升级、无状态写入 |
| OneIDCampaignsV16 | `contracts/OneIDCampaignsV16.sol` | 0x59Ea103C1f9d1DBBd91F1Ec9FC22C4eBD58c3B5C | 1069 | 抽奖/投票/领取三类活动 + 奖金托管与发放。**资金面核心** |
| CheckInV2 | `contracts/CheckInV2.sol` | 0x577b0439F66c3ddd05eec47f3bF31FD7451ACe47 | 146 | 每日签到与权重（1 + 近 14 天签到天数），位图滑窗 |
| IdentityBindingsV4 | `contracts/IdentityBindingsV4.sol` | 0x5FC906B394BA23Dd1B546aea8F217101DEc07F85 | 297 | X 账号 ↔ 地址绑定登记（签名路径 + 自助登记），登记员仅有「撤销自助登记」一权 |
| IdentityProfile | `contracts/IdentityProfile.sol` | 0x42C9f4BFa02e0b4365D9701F962B4dcD4bf39a07 | 97 | 链上名片（简介 ≤160 字节 + ≤5 链接），仅本人可写 |

BscScan 链接格式：`https://bscscan.com/address/<地址>#code`（已验证源码与部署字节码一致）。

编译器：solc **v0.8.24+commit.e11b9ed9**。测试：Hardhat，`npx hardhat test`，当前 **243 项全过**（含攻击探针：重复领取、越权、条件绕过等）。

## 2. 不在审范围

- 历史版本合约（OneIDCampaigns V11–V15、CheckIn V1、IdentityBindingsV3）：仍在主网可读，但现行前端与活动只用上表版本。
- QuestPass：**未部署主网**，不在范围。
- 前端（web/）、链下工具（scripts/ 的抽奖复算/结算/计数脚本）：不在本次合约审核范围。

## 3. 请重点看的地方（项目方自认的高风险面）

1. **托管资金守恒**（V16）：三类活动的注资（`_fund` 余额增量校验）、领取、开奖后回收（reclaim）之间，任何路径下不得多付、不得跨活动挪用。
2. **领取唯一性**：claimPrize / claimShare / claimVotePrize 的防重复领取标记与窗口期。
3. **开奖种子**：lockDraw 取 `blockhash(当前块+2)`、draw 必须在 256 块窗口内执行、过期重锁定的逻辑。
4. **条件引擎**：参加条件 0–5 的校验顺序与失败不消耗名额；特别是条件 5（按 Agent ID 名单的默克尔叶 = keccak256(keccak256(handle))，合约用注册表 `handleOf(调用者)` 实时取本人名字验根）。
5. **BindingsV4**：自助登记的覆盖规则（不得覆盖签名绑定）、24 小时冷却、登记员撤销的范围限定。
6. **CheckInV2**：32 位滑窗位图在跨窗/同日重复/乱序调用下的权重计算（weightOf 在读取时按当前日重新锚定）。

## 4. 已声明的设计取舍（请按此模型评估，不要按未声明的更强模型报错）

- **开奖随机性是区块哈希伪随机**，定位为中小奖池「娱乐级公平」：种子块在报名截止后才锁定、哈希事前不可知、开奖后任何人可复算。项目从未声称 Chainlink VRF 级别。Slither 的 weak-prng 三条即指此机制（见分诊）。
- **签到权重在开奖时读取**（非报名截止时冻结），网站与文档均按此表述。
- **自助登记（proofType 2）**的账号侧强度为「声明 + 公开可证伪 + 登记员可撤销」，弱于签名路径——这是已公开的信任模型。
- **奖品代币**：合约层 permissionless；前端仅对预设 USDT/USDC 之外的托管代币显示风险警告。非标准 ERC20（手续费/重基）的托管偏差只伤活动创建者自己的活动（见已知问题）。

## 5. 内部审查历史（供去重）

- 2026-11-23 起共四轮内部审查（逐行人工 + 独立复核 + 攻击探针）。曾发现并已修复一个 Critical（旧版本中奖可重复领取、跨活动挪用托管）——修复版经测试网复证后才上主网。
- 截至本包：**无未修复的 Critical / High / Medium**。已知 Low / Info 全部列于 `KNOWN_ISSUES.md`，请勿重复报告（或请指出其影响被我们低估的理由）。
- 本包附 Slither 0.11.6 全量报告（`reports/slither-*.json`）与逐条分诊（`reports/SLITHER_TRIAGE.md`）。

## 6. 提交发现的方式

请把发现发回项目方（玖肆），每条包含：合约与函数、问题说明、可复现的调用序列或 PoC、影响评估（资金/权限/数据）、修复建议。严重问题请勿公开披露，先私下沟通。
