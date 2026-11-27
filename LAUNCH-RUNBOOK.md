# BeCounted 主网上线手册（Launch Runbook）

> **历史文档（2026-11-27 注）**：本手册为上线前计划，多处安排已变更——QuestPass 主网赛季已经用户决定冻结、未部署；现行合约为 OneIDCampaignsV16 + CheckInV2（共十二个主网合约、全部完成 BscScan 源码验证）。现行事实以 `docs/submission-draft.md` 与 `mainnet-address.json` 为准，本文仅作过程记录保留。

> 目标：主网部署 + 验证 + 前端切换 + 自检，赛季 2026-11-25 12:00 开季（集印至 12-02 12:00、终章 12-03 开奖），12-07 提交（截止 2026-12-09 16:00 CST）。上线日已定：**2026-11-25**（2026-11-23 用户拍板由 11-27 提前）。
> 本手册按执行顺序写，逐项打勾。背景与决策依据见 PLAN.md；红线纪律见 PLAN.md「红线纪律」。
> 部署脚本：`scripts/deploy-mainnet.js`（默认 dry-run 硬锁，见第 2 节）。部署结果的唯一事实来源：脚本写出的 `mainnet-address.json`，第 3、4 节的所有地址都从它抄，不凭记忆填。

待部署合约（依赖顺序，脚本自动按序执行）：
1. **BeCounted** — 构造参数：真实 Agent ID 注册表
2. **IdentityBindingsV3** — 无构造参数（registrar = 部署者，V3 起可轮换）
3. **OneIDCampaignsV11** — 构造参数：步骤 1 的 BeCounted + 步骤 2 的 IdentityBindingsV3（两个参数，顺序不可反；Bindings 必须先于 apps 部署）。V11 = V10 + 资金安全修复批（2026-11-23 深审后升版）：claimPrize 加 reclaimed/超期双检查（C1）、开奖改锁种模式（create 去 seedBlock、结束后 lockDraw 锁种、过期可重锁、无兜底种子）、_fund 到账恰等校验；构造签名与 V9/V10 相同
4. **QuestPass** — 构造参数见第 2 节；构造函数经 transferFrom 从部署者托管 **59 USDC**（印记池 14 + 终章 45），脚本先 approve 预测地址再部署
5. **IdentityProfile** — 无构造参数；**已定同批部署**（用户 2026-11-23 拍板），执行时带 `INCLUDE_PROFILE=1`

关键固定值（全程不变）：
- 链：BSC 主网，chainId 56
- Agent ID 注册表（构造参数，非我们部署）：`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`
- 主网 USDC（QuestPass 奖池代币）：`0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`（BSC 上 18 位小数，脚本运行时链上复核）
- 部署者钱包：`0x09385E06bDFa5772B90f7542d1d9FDD1B1d0DF38`（私钥在 `keys/deployer.key`，只读、绝不打印、绝不外发）
- 自检样本地址（9nosing.ai）：`0x119B2Bf71856155b234f818476ae0610634A2aB9`

---

## 1. 前置条件（上线日前一晚全部确认完）

- [ ] **BscScan 免费 API Key 到手**（用户办）。用途：第 3 节验证合约。保管：只通过环境变量使用（`ETHERSCAN_API_KEY`），**不写进任何文件、不提交 git**。
- [ ] **部署者主网资金到位**（脚本 LIVE 模式会自己复核，不足直接中止、一笔不发）：
  - BNB（gas）：当前约 0.0031 BNB，**需在 11-25 10:00 前补至约 0.013 BNB**。2026-11-23 晚（V11 发射包）dry-run 实测全批总 gas 估算 ≈ 9,233,294（不含 Profile；含 Profile ≈ 9,963,872），低 gas 价时成本仅约 0.0005 BNB——补足是为留够主网 gas 价波动、验证与重试的余量，不要卡着硬线部署。脚本的硬线：余额 < 估算总成本 × 1.5 即中止。
  - **USDC 59 个，转到部署者地址**（当前为 0，必须补；**资金到位截止 11-25 10:00**，赶在 12:00 开季前）。这是 QuestPass 的赛季托管（印记池 2 USDC/天 × 7 天 + 终章 45 USDC），部署时由构造函数一次性从部署者转入合约。少 1 个都部署不了。
  - 注意区分：创世抽奖的 **20 USDC** 不走部署者——上线后由**用户钱包**在网站创建活动时 approve + 托管（第 6 节）。
- [ ] **QUEST_START_AT 定死**：赛季第 0 天 = 上线日 2026-11-25，**12:00（北京时间）**开季，给上午留部署+自检时间。时间戳 = **1795579200**（`TZ=Asia/Shanghai date -d "2026-11-25 12:00" +%s` 的输出，部署当天再复跑一次命令核对）。写进第 2 节命令，全程不改——QuestPass 的 startAt 部署后不可变。
- [x] **IdentityProfile 同批上线已定**（用户 2026-11-23 拍板）：第 2 节命令带 `INCLUDE_PROFILE=1`，第 4 节前端切换时 PROFILE 地址按主网记录一并翻转。
- [x] **域名 / SITE_URL 已定死并切换完成**（2026-11-23）：自定义域名 `https://becounted.9nosing.com/`（根域名 9nosing.com 子域名；用户曾虑长度，最终拍板沿用）。Cloudflare CNAME（becounted → sijiu94-ship-it.github.io、代理关闭）与 GitHub Pages 自定义域名均已设置，HTTPS 证书已签发、强制 HTTPS 已开，均经实测。本地 web/ 已切换：SITE_URL、embed.js、开发者页示例、全部页面 og:image（绝对地址）+ og:url、CNAME 文件均指向新域名。推送时随其他文件一并上线，推送后实测新域名内容为最新版即可。
- [ ] **GitHub PAT 就位**：推送 Pages 需要用户的细粒度 PAT（名 humangate-push，Contents 读写，有效期至 2026-12-21）。仓库已于 2026-11-23 由用户改名为 **`sijiu94-ship-it/becounted`**，同一 PAT 已实测可继续用于新仓库名推送（改名当晚推送 1122k 成功，main 98716ad；gh_push.py 的 REPO 已同步为 becounted）。令牌不存本机，推送时向用户索取。
- [ ] **工具自检**：`npx hardhat compile` 通过；`node scripts/deploy-mainnet.js`（dry-run）跑通，输出里 BNB 与 USDC 两项 balance check 都是 OK。
- [ ] **用户侧备好**：币安 App 内 9nosing.ai 持有正常；用户钱包里备好主网 USDC ≥ 20（创世抽奖托管）+ 少量 BNB（在 App 内操作 gas）。

## 2. 部署（上线日上午）

```bash
cd ~/workspace/agentid-hackathon
# 第一步永远先 dry-run，逐项核对计划再放行：
QUEST_START_AT=<第 1 节定好的时间戳> node scripts/deploy-mainnet.js
# 核对无误后（Profile 已定同批，命令带 INCLUDE_PROFILE=1）：
CONFIRM_MAINNET=YES INCLUDE_PROFILE=1 QUEST_START_AT=<同一时间戳> node scripts/deploy-mainnet.js
```

dry-run 必须逐项核对（任何一项不对就停下查因，不要放行 LIVE）：
- [ ] 顺序与 nonce 偏移：BeCounted +0 → IdentityBindingsV3 +1 → OneIDCampaignsV11 +2 → USDC approve +3 → QuestPass +4（含 Profile 时 Profile 为 +5）
- [ ] QuestPass 构造参数逐字对：gate = 预测的 BeCounted 地址、token = 主网 USDC、startAt = 第 1 节时间戳、slotsPerDay 50、dayPool 2 USDC、minStamps 5、winnerCount 3、finalePool 45 USDC、entryWindow 86400，托管合计 **59 USDC**
- [ ] approve 的 spender = 预测的 QuestPass 地址（脚本 LIVE 时会用实时 nonce 重新预测并断言落地地址，漂移即中止）
- [ ] BNB 与 USDC 两项 balance check 都是 OK；两处 gas 显示 fallback 估算属正常——QuestPass（3,000,000，其构造函数含 transferFrom，approve 落地前无法模拟估算）与 OneIDCampaignsV11（4,700,000，按测试网同字节码部署实测 4,203,733 取整；其构造要读 gate.registry()，主网 gate 未部署前无法模拟）。LIVE 部署时脚本会在依赖落地后逐个重新估算。总 gas 与 BNB balance check 行恒显示（旧版在估算缺失时会整段跳过，已修）

LIVE 完成后核对脚本输出：
- [ ] 每个合约都打印 runtime bytes 且与工件预期一致（脚本自动断言，不一致即中止）
- [ ] post-deploy checks 全过：BeCounted.registry() = 真实注册表、isHuman(9nosing.ai) = true、isHuman(部署者) = false、OneIDCampaignsV11.gate() 指向新 BeCounted、.bindings() 指向新 IdentityBindingsV3、.idRegistry() = 真实注册表、IdentityBindingsV3.registrar() = 部署者（脚本断言）、QuestPass 的 stampPool = 14 / finalePool = 45 / prizePerWinner = 15 USDC / winnerCount = 3（脚本断言，不再只打印）、QuestPass 的 USDC 余额 = 59
- [ ] `mainnet-address.json` 已生成（humanGate / appsV11（appsV9 为同值旧键别名）/ bindings / quest / profile 地址 + 交易哈希 + 区块高；appsBlock 是前端 APPS_DEPLOY_BLOCK 要填的值，单独圈出来）
- [ ] **失败处置**：某笔失败/revert/超时，**不要重跑整个脚本**（会把已成功的合约重复部署一遍，且 QuestPass 的 approve/预测地址会整体漂移）。脚本每步成功后都会**增量写** mainnet-address.json，中途失败时记录里已有实际落地的地址——先对着记录与 BscScan 部署者地址页确认实际进度，再只补未部署的部分（现场拆脚本处理）。部署后检查可单独重跑：`node scripts/deploy-mainnet.js --verify-only`（只读、不部署、不需要私钥）

## 3. BscScan 验证（部署后立刻做，趁上下文热）

统一编译环境（与本地一致）：Solidity **0.8.24**、Optimizer **开启 / runs 200**、EVM paris、License MIT。`hardhat-verify` 插件**已于 2026-11-23 安装并接线**（`hardhat.config.js` 已含 `etherscan: { apiKey: process.env.ETHERSCAN_API_KEY }`，Etherscan V2 单 Key 模式；Key 只走环境变量、不落文件——已复核 config 里没有存任何 Key）。三条路线任选，路线 A 优先：

**路线 A：hardhat-verify（CLI）**
逐个验证（地址全部从 `mainnet-address.json` 抄）：
```bash
export ETHERSCAN_API_KEY=<用户的 Key>
npx hardhat verify --network bsc <BeCounted 地址> 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
npx hardhat verify --network bsc <IdentityBindingsV3 地址>
npx hardhat verify --network bsc <OneIDCampaignsV11 地址> <BeCounted 地址> <IdentityBindingsV3 地址>
npx hardhat verify --network bsc <QuestPass 地址> <BeCounted 地址> 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d <QUEST_START_AT> 50 2000000000000000000 5 3 45000000000000000000 86400
npx hardhat verify --network bsc <IdentityProfile 地址>   # 仅当同批部署了 Profile
```
（QuestPass 构造参数顺序以合约为准：gate, token, startAt, slotsPerDay, dayPool, minStamps, winnerCount, finalePool, entryWindow；dayPool / finalePool 是 18 位小数的原始值。OneIDCampaignsV11 构造参数顺序：gate, bindings，两个都是地址。）

**路线 B：BscScan 网页 Standard-JSON（免装插件）**
1. 打开合约页 → Contract → Verify and Publish → Compiler Type 选 **Solidity (Standard-Json-Input)**。
2. 内容用 `artifacts/build-info/` 里与本次编译对应的那份 JSON 的 `input` 字段原文（就是完整的 solc 标准输入，编译器版本与优化参数都在里面，不要改）。注意各合约都有跨文件依赖（如 OneIDCampaignsV11 依赖 `BeCounted.sol` 与 IdentityBindingsV3 的接口、BeCounted 依赖 `contracts/interfaces/IAgentIdRegistry.sol`）——单文件粘贴源码必然失败，必须走 Standard JSON。
3. Constructor Arguments 留空时 BscScan 会尝试自动匹配；不通过就把部署交易详情页 Input Data 尾部的编码参数复制过来。

**路线 C：Sourcify（免 Key 兜底，已彩排）**
2026-11-23 已用同一套 Standard-JSON 输入把测试网三件核心合约（OneIDCampaignsV9、BeCounted、QuestPass）在 Sourcify 全部验成 **exact_match**，证明编译输入与参数无误。做法：从对应 `artifacts/build-info/*.json` 取 `input` + `solcLongVersion`，POST `https://sourcify.dev/server/v2/verify/<chainId>/<address>`，body 含 `stdJsonInput`、`compilerVersion`（**必须用长版本号**如 `0.8.24+commit.e11b9ed9`，短版本号会报 compiler_error）、`contractIdentifier`、`creatorTxHash`。注意：Sourcify 验证 ≠ BscScan 绿勾，比赛要求的是 BscScan——路线 C 只作兜底与输入正确性证明，绿勾仍走路线 A/B。

- [ ] 每个合约在 BscScan 上显示源码已验证（绿色对勾），把验证链接记入下方记录表（提交材料要用）
- [ ] QuestPass 页再复核一遍：USDC 余额 59、Read Contract 里 startAt 与计划一致

**上线记录表（部署日填）**

| 合约 | 主网地址 | 部署 tx | 部署区块 | BscScan 验证 |
|---|---|---|---|---|
| BeCounted | （填） | | | |
| IdentityBindingsV3 | （填） | | | |
| OneIDCampaignsV11 | （填） | | | |
| QuestPass | （填） | | | |
| IdentityProfile | （填或「未同批」） | | | |

另记：部署者退回 BNB 的 tx hash：（第 7 节填）

## 4. 前端配置切换（全部在 `web/` 内，逐项改、逐项 grep 复核）

> **执行工具（唯一）：`scripts/flip-mainnet.js`** —— 前端翻转只有一个权威工具（旧的 `scripts/switch-frontend-mainnet.js` 已合并进来并删除，不要再找它）。默认 dry-run 打印全部计划改动、全量校验通过后才落盘、落盘后自带断言（全站不得残留 `testnet.bscscan.com`、`{{…MAINNET…}}` 占位符、`<span>testnet</span>` 徽章）：
> ```bash
> node scripts/flip-mainnet.js            # dry-run，先核对计划
> node scripts/flip-mainnet.js --apply    # 校验全过才写
> ```
> 记录里 `profile` 为 null 时 flip 直接报错拒绝（不沿用老脚本的 `--keep-profile-testnet` 静默保留）——先按第 1 节决定部署 Profile 或修正记录。下面这份清单保留作**人工复核对照表**：flip 覆盖其中全部条目。原列为手工项的两件**已自动化、不要再手工做**：og:image/twitter:image 早已是绝对地址（2026-11-23 落地）；builders/whitepaper 的 QuestPass 行也已在表中（测试网彩排地址），flip 的 HTML 地址替换会自动换成主网地址——再手工加一行只会得到重复行。flip 另有标签扫描（写前 + 写后各一道）：app.js 残留 `— BSC testnet` / `— BSC 测试网` 标签串即中止（`f_chain_test` 键的裸链名豁免）。

地址来源：`mainnet-address.json`。改完把 app.js 的缓存后缀在全部页面统一递增（当前 `assets/app.js?v=1122m` → 新后缀），否则老用户拿到旧 JS。

**`web/assets/app.js` 顶部配置（第 2–12 行）**
- [ ] `APPS_TESTNET`（第 3 行）→ apps 地址（`mainnet-address.json` 的 appsV11 键；appsV9 是同值旧键别名，flip 优先读 appsV11）
- [ ] `BINDINGS_TESTNET`（第 4 行）→ `bindings` 地址
- [ ] `PROFILE_TESTNET`（第 5 行）→ `profile` 地址（仅当 Profile 同批部署；未部署则按第 1 节决定处理，不要指向主网不存在的地址）
- [ ] `GATE_TESTNET`（第 11 行）→ `humanGate` 地址
- [ ] `QUEST_TESTNET`（第 12 行）→ `quest` 地址
- [ ] `REGISTRY_MAINNET`（第 2 行）与 `SAMPLE_HOLDER`（9nosing.ai）本来就是主网值，不动

**`web/assets/app.js` 网络与杂项**
- [ ] `SITE_URL`（第 66 行）→ 第 1 节定死的最终地址（方案 A 不变；方案 B 改新域名，结尾带 `/`）
- [ ] `NETWORK`（第 69–73 行）：`appsChainId: 97` → `56`；`appsChainHex: "0x61"` → `"0x38"`；`appsRpcs` 三个测试网 RPC → 主网 RPC（`https://bsc-rpc.publicnode.com`、`https://bsc-dataseed.binance.org`、`https://bsc-dataseed1.bnbchain.org`）；`mainRpcs` 本来就是主网，不动
- [ ] `APPS_DEPLOY_BLOCK`（第 74 行）`144405789`（当前 V11 测试网试验栈值）→ `appsBlock`（mainnet-address.json）
- [ ] `TOKEN_PRESETS`（第 78–81 行）：usdt → `0x55d398326f99059fF775485246999027B3197955`，usdc → `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`（第 76–77 行注释里已备好这两个地址；两者 BSC 均为 18 位小数）
- [ ] 钱包加链兜底参数（第 640 行 `wallet_addEthereumChain`）：chainName `"BNB Smart Chain Testnet"` → `"BNB Smart Chain"`；nativeCurrency 的 name/symbol `tBNB` → `BNB`；rpcUrls → 主网 RPC；blockExplorerUrls `https://testnet.bscscan.com` → `https://bscscan.com`
- [ ] 活动详情页信任行（第 1396 行）：两个 `testnet.bscscan.com/address/…` 链接域名 → `bscscan.com`（行内的合约地址是变量、自动跟随，只有域名是字面量）
- [ ] **i18n 文案里的测试网措辞**（`I18N` 的 en 与 zh 两部字典都要改，只改文案、不动键名）：`stat_campaigns`（"campaigns on testnet"）、`foot_r`（"testnet demo…"）、`kick_camp`（"Live on BNB testnet"）、`camp_sub`（提到 mock registry 的整句）、`loading` / `load_fail`、`m_connect_first`（提到 mock registry）、`m_connected`（"Connected on BSC testnet: "）、`m_wrongnet`（"not on BSC testnet"）、`a_gate` / `a_apps` / `a_bind`（"BSC testnet" 标签）、`wp7_p`（"Currently live on BSC testnet…"）、`feed_h`（"Live from the gate — BSC testnet"）。改完 grep `testnet` 应只剩 `*_TESTNET` 常量名与注释

**13 个页面（index / campaigns / campaign / create / creator / mine / card / bind / how / builders / whitepaper / expedition / skill）**
- [ ] 导航徽标（每页第 21 行）`<b>BeCounted</b><span>testnet</span>` → `<span>mainnet</span>`
- [ ] og:image 与 twitter:image 已是绝对地址（2026-11-23 落地，`<SITE_URL>assets/og.png`）——grep 复核仍为绝对地址即可，**不要再改**
- [ ] 每页的 `assets/app.js?v=…` 后缀统一改为新后缀（与 app.js 修改同批推送）

**`web/builders.html` 地址表（第 56–60 行）**
- [ ] gate 行（56）、apps 行（57）、bindings 行（58）、profile 行（60）：链接域名 `testnet.bscscan.com` → `bscscan.com`，地址与链接文字 → 对应主网地址（profile 行仅当 Profile 同批部署）
- [ ] 注册表行（59）本来就是主网，不动
- [ ] QuestPass 行**已在表中**（测试网彩排地址 `0x90c3320557db7540a5899e7d3bc0577e399ec378`）：flip 会按 app.js 当前 `QUEST_TESTNET` 常量值自动替换为主网地址——**不要再手工新增（会重复）**；落盘后 grep 复核该行已是主网地址

**`web/whitepaper.html` 合约表（第 103–107 行）**
- [ ] gate 行（103）、apps 行（104）、bindings 行（105）、profile 行（106）：同 builders，换主网地址 + bscscan.com（profile 行条件同上）
- [ ] 注册表行（107）本来就是主网，不动；QuestPass 行同样已在表中，flip 自动替换，勿手工新增

**`web/becounted-skill.md`（Agent 参与 Skill，上线时才填）**
- [ ] `{{APPS_MAINNET_ADDRESS}}` 共 **6 处** → apps 地址（记录的 appsV11 键）
- [ ] `{{BECOUNTED_MAINNET_ADDRESS}}` 共 **2 处** → `humanGate` 地址
- [ ] `{{QUEST_MAINNET_ADDRESS}}` 共 **3 处** → `quest` 地址
- [ ] 填完 `grep "{{" web/becounted-skill.md` 必须无残留——文件内有硬性警告：占位符未填完，任何 Agent 不得执行其中调用

**不用改的**
- `web/embed.js`：注册表地址与 RPC 本来就是主网，随推送原样发布即可

**收尾自检**
- [ ] `node --check web/assets/app.js` 通过；用 app.js 自身抽出的常量 + FallbackProvider 做一次读链回归（主网 V11 `campaignCount()`、Bindings、Quest 读数均正常返回）

## 5. 推送正式站（GitHub Pages）

```bash
GH_MSG="Mainnet launch: switch frontend config to BSC mainnet" python3 ~/workspace/tools/gh_push.py
# PAT 从标准输入喂入（向用户索取，不落文件）；脚本逐个 blob 推送 web/ 全部文件
```
- [ ] 推送后等 Pages 构建 1–3 分钟，curl 线上 `assets/app.js`（带新缓存后缀）grep 到主网 apps 地址与 `appsChainId: 56`、且不含任何测试网合约地址，再打开线上首页确认导航徽标为 mainnet
- [ ] 托管预览空间随后按固定工作流同步一次并在聊天里给卡片（公开分享链接停留在旧版，不用管）

## 6. 上线自检（推送后立刻做，全过才算上线）

- [ ] **真人检查器**：网站首页/名片页查 `0x119B2Bf71856155b234f818476ae0610634A2aB9`（9nosing.ai）→ 显示真人 ✓；对照查部署者地址 → 非真人（主网门禁读真实注册表，部署者没有 Agent ID）
- [ ] **远征页**：赛季状态与 QUEST_START_AT 一致（未开始/第 0 天），奖池读数 stampPool 14 + finalePool 45 USDC 正确——QuestPass 部署即托管到位、到点自动开始，不需要再建活动
- [ ] **创世抽奖**：用户在网站创建 20 USDC 托管抽奖，approve 必须是**定额**（核对授权额度正好是托管额、不是无限大）
- [ ] **投票**：创建一场投票活动（少数派正式局在运营期按第 8 节开，这里先建一场普通投票验流程）
- [ ] **闭环走一遍（分两半，缺一不可）**：
  - **网站侧（负向 + 发起人侧）**：2026-11-23 实测确认——币安 App 内置浏览器连接的永远是**私钥 Web3 钱包**，Agentic Wallet 不向任何第三方网站开放连接（比赛红线 1 的设计本意）。所以网站连接钱包只能验「拒绝」：用无 ID 的钱包 enter → 应被门禁拒绝并给出可读提示；发起人侧 create / draw / 回填帖子链接用任意钱包正常走通（draw 是 V11 两步：活动结束后先 lockDraw 锁种、种子块落地后立即 draw，同一会话连跑；锁若过期可重新 lockDraw，无兜底种子，别把两步拆到两天）。
  - **持有人侧（正向，唯一通道）**：真实持有人参加只能走 Agent 参与 Skill（Agentic Wallet 无测试网、网站连不上它）。见下一条上线闸门——这是主网上唯一能验通「持 ID 地址 enter → Entered 事件 → 已参加状态」的路径。
- [ ] **身份卡战绩**：查自己地址，参与记录出现刚参加的活动；名片 `?a=` 公开链接可打开
- [ ] BscScan 上抽查几笔交易（部署 / enter / draw / claim）的合约地址与 mainnet-address.json 一致
- [ ] **GO / NO-GO**：任一自检失败 → 停，不发招募帖、不退 BNB；先定位（配置 / 合约 / RPC），修好重验再继续
- [ ] 自检结果记入 PLAN.md（日期、活动 ID、交易哈希）
- [ ] **上线闸门（发招募帖之前必须过）**：用户用 9nosing.ai 通过 Agent 参与 Skill 完成一次真实参与（进创世抽奖或领远征第 1 枚印记），链上事件与页面状态核对无误后，才发第 7 节的招募帖。此项原排「上线后第二天」，2026-11-23 实测确认网站连接路径不通后提为闸门；实走记录兼作 Wave 3 演示素材与提交稿的 Agent 演示回填。**实走全程录屏**（从把 Skill 发给 Agent 到链上确认都录下来，文件留存，回填提交稿 4.1 的 `{{AGENT_DEMO_VIDEO_URL}}`）

## 7. 部署者余额归还

- [ ] 自检通过后，部署者钱包**保留 0.002 BNB 运营储备**，只把超出部分转回**用户当场指定的地址**（留出这笔转账自身的 gas；地址当面确认，不用聊天记录里出现过的旧地址推断）。留储备的原因：部署者整个赛季还要签名干活——12-03 终章用 `scripts/mainnet-quest.js` 锁种/开奖、登记员用 `scripts/register-attested.js` 做见证登记，钱包见底这两件事都会停摆。转账交易哈希发给用户对账，并记入第 3 节记录表与 PLAN.md；赛季全部收尾后（终章余款回收时一并）再把储备余款转回
- [ ] **USDC 如实说明**：部署者的 59 USDC 已全额托管进 QuestPass，部署者手里没有 USDC 可退。赛季里没发完的部分（未领完的每日印记池 + 未领的终章奖金）只能走 `QuestPass.reclaim()`，且要等**终章报名窗关闭后再过 30 天**（PRIZE_CLAIM_WINDOW）才解锁——按赛季节奏约在开季后第 38 天前后。reclaim 的钱回到**创建者 = 部署者地址**，届时再转给用户并附交易哈希。这笔钱在那之前谁也动不了（包括我们），对用户汇报照此口径，不要提前承诺到账日期

## 8. 运营备注（上线后照此执行）

- **少数派投票（15 USDC）是纯投票活动、没有托管**：本场少数派投票用的是无奖池纯投票（V7 的投票支持可选托管奖池，本场故意不用——少数派均分走人工结算），奖金不在合约里。流程：投票关闭 → 从链上 tally + Voted 事件算出少数派一方的全部投票地址 → **先公开发布中奖名单**（地址 + 每人应得份额，15 USDC 按人数均分）→ 从运营钱包逐笔手动发放 → 发布全部交易哈希。名单先行、哈希在后，任何人可复算，不要反过来。结算复算用 `scripts/settle-vote.js`（已切 OneIDCampaignsV11 ABI，地址/起始块/链全走环境变量；只读、不发交易）：
  ```bash
  APPS_ADDRESS=<mainnet-address.json 的 appsV11> DEPLOY_BLOCK=<appsBlock> CHAIN_ID=56 \
  RPC_URLS=https://bsc-rpc.publicnode.com,https://bsc-dataseed.binance.org,https://bsc-dataseed1.bnbchain.org \
  node scripts/settle-vote.js <少数派活动 id> 15000000000000000000
  ```
  （15 USDC = 15e18 raw。）脚本从 Voted 事件重算票数并与合约 `tally()` 交叉校验（不一致 exit 2、名单作废重查），按已定规则出名单：得票最少（含 0 票）的选项一方胜、并列合并、均分余数（dust）留组织者，产出 `vote-payout-<id>.json`。注意 0 票边际：若最少票选项无人投，中奖方为空、全额不发放，脚本会显式报告——如实公示，不要自选赢家。
- **远征终章需要人工推进两步**：报名窗关闭后，任何人可调 `lockFinaleSeed()` 与 `drawFinale()`（运营来点，网站远征页有按钮）；中奖者自助 claimPrize，不用运营发放。每日印记发放全自动，不用管。**运营纪律（12-03 终章日）**：用 `node scripts/mainnet-quest.js`（读 `mainnet-address.json` 的 quest 地址驱动主网 QuestPass）——该脚本已是**重锁感知 + 同程连跑**：一次运行内先查状态，无有效种子（未锁、或已锁但种子块已过 256 块窗口）就先 `lockFinaleSeed()`（重新）锁种，然后**在同一进程内等种子块落地、立即 `drawFinale()`**，锁种与开奖只差几秒。新版 QuestPass 的种子过期可重锁（旧彩排合约不能），所以主网终章的纪律口径是「**过期就重锁、重锁后立即开奖**」；合约内部兜底种子仅作最后保险，正常执行下 `usedFallbackSeed` 应为 false（脚本会打印该值，非 false 要查因）。彩排季的实际节奏与此不同，如实记录：彩排跑的是旧源码 QuestPass（种子不可重锁），由 `rehearsal-quest.js` 阶段机挂每日 cron 推进（一天一步），锁种与开奖分属相邻两次运行——即**锁种次日才开奖、走兜底种子路径**（彩排走兜底属预期内，验的是流程不是种子口径）；按此节奏彩排终章预计约 **12-01** 跑完（不是 11-30），仍早于主网终章 12-03，彩排 cron 不要在 11-30 提前撤。
- **每日节奏**：Colony build-in-public 日志 + 远征进度播报照 PLAN 的冲奖打法执行；目标 ≥60 个 Agent ID 地址交互（门槛 30），12-03 检查点（主网真人交互 < 20 → 加码推广并暂停 Wave 2 其余事项）
- **招募发帖（用户发）**：一句话讲清项目 + 创世抽奖/远征入口 + 正式站链接；**双话题 `#BinanceWalletHackathon` 与 `#AgenticWallet` 必须都有**（社区传播奖硬要求）；发帖后把链接用 `setPostUrl` 回填到对应活动。措辞只讲公平/防机器人，不承诺收益、不出现「躺赚/自动赚钱」类表述
- **社区传播奖表单登记（发帖后立刻做）**：招募帖发布后，必须把帖子链接提交到官方**社区传播奖表单**登记——不登记，帖子不计入社区传播奖（20 名 × 100 USDC），等于白发。之后任何带双话题的合格帖子（提交稿第五节的两条社区帖同样）都同理：发一条、登记一条，不要攒到最后补
- **评审窗口常青活动（上线日创建，排在创世抽奖之后）**：再在主网 OneIDCampaignsV11 上创建一个**长期开放的领取型（claim）活动**，结束时间不早于 **2026-12-20**，覆盖整个评审（12-09→12-17）与公示窗口——评委在窗口内任意时刻打开站点都能当场参加、验证门禁（一人一份、非真人被拒），而不是只看到一场已结束的赛季（规格见 PLAN.md「评审窗口常青活动」）。**奖金金额在上线日 09:00 奖池复核时一并拍板**（与远征 59 / 创世抽奖 20 / 少数派 15 同场定），定了再创建，不要先建后改。此活动同时持续积累与提交合约交互的 Agent ID 地址数
- **提交**：12-04→12-06 备齐材料（docs/submission-draft.md 的占位符回填 mainnet-address.json 的**全部**地址——BeCounted / OneIDCampaignsV11 / BindingsV3 / QuestPass / Profile 一个不能少；注册表地址是引用、非我们部署，清单里分开写；GatedClaim 模板未上主网就注明仅测试网演示），**12-07 提交**，截止 12-09 16:00 CST
- **演示视频（12-04→12-06 材料期产出）**：对主网最终版产品录制一条 **90 秒演示视频**，回填提交稿第六节清单的 `{{DEMO_VIDEO_URL}}`；素材优先用上线日 Agent 实走录屏 + 主网真实活动页面，不要拿测试网画面冒充主网
- 赛后提醒用户：聊天里传过的 GitHub PAT 可撤销（本身 2026-12-21 到期）
