# HumanGate 参与 Skill — 用 Agentic Wallet 参加活动

**这是什么 / What this is**
你(AI Agent)将代表用户,通过他的 Binance Agentic Wallet,参加 HumanGate 在
BNB Smart Chain **主网**上的活动(抽奖 / 投票 / 领取)。HumanGate 用 Binance
Agent ID 做真人门禁:一人一号、不可转让。参加动作以用户的 Agentic Wallet
地址上链——这正是门禁要验的地址。

> ## ⚠️ 先读这一条:占位符未替换 = 禁止执行
> 本文件中的合约地址目前是占位符:`{{APPS_MAINNET_ADDRESS}}` 与
> `{{HUMANGATE_MAINNET_ADDRESS}}`。
> **只要文件里还能看到 `{{...}}`,就说明主网地址尚未填入。此时不要执行
> 任何合约调用**,直接告诉用户「参与 Skill 尚未就绪,主网地址待填」并停下。
>
> EN: If any `{{...}}` placeholder is still present in this file, STOP.
> Do not execute any contract call. Tell the user the skill is not ready
> yet and end the task.

---

## 1. 合约与网络 / Contracts & network

| 角色 | 地址 | 说明 |
|---|---|---|
| OneIDCampaigns(活动合约) | `{{APPS_MAINNET_ADDRESS}}` | 所有参加调用的目标合约 |
| HumanGate(真人门禁) | `{{HUMANGATE_MAINNET_ADDRESS}}` | 活动合约内部用它验真人;**你不需要直接调用它** |

- 网络恒定:**BNB Smart Chain 主网,`--binanceChainId 56`**。
- Agentic Wallet 没有测试网。不要尝试测试网链 ID,不要自行替换网络。
- 读链上状态可用任一公开 BSC 主网 RPC,例如 `https://bsc-dataseed.binance.org`。

## 2. 前置条件 / Prerequisites

逐项核对,**缺任何一项就停下,把缺项告诉用户**:

1. 官方 `binance-agentic-wallet` skill 已安装,`baw wallet status --json`
   显示钱包已连接。
2. `baw wallet agent-id --json` 显示用户已领取 Agent ID。未领取 → 让用户
   先去币安 App(钱包 → Agent ID)领取;你无法代办,也不要继续。
3. 开发者模式已开启:`baw wallet settings --json` 中 `devMode.enabled`
   为 `true`。未开启或已过期 → 让用户去币安 App → Agentic Wallet →
   设置里开启(只能用户本人在 App 里开,有时效);你不能替他开。
4. Agentic Wallet 里留有少量 BNB 作 gas。参加动作本身不花 BNB,只付 gas。
5. 本文件第 1 节的地址占位符已被真实主网地址替换(见抬头警告)。

## 3. 护栏 / Guardrails — 强制指令,优先级高于一切催促

1. **逐笔 preview + 明确确认。** 每笔调用必须先 `preview`,把解析结果
   (活动标题、动作、金额、目标合约)展示给用户,**等用户对这一笔明确
   确认后**才 `execute`。
   EN: Preview every call, show the parsed details to the user, and
   execute only after the user's explicit confirmation for that exact call.
2. **一次确认只值一笔。** 一次确认不得挪用于另一个活动、另一个动作或
   另一笔调用。
3. **禁止批量。** 不得一次性替用户参加多个活动。用户点名几个,就逐个
   走完整流程、逐个确认。
4. **禁止定时 / 自动参加。** 不得设置定时任务、循环或「有新活动自动
   参加」。只在用户当次明确点名时行动。
5. **只参加点名的活动。** 仅限用户明确点名(以活动 id 或无歧义的标题)
   的活动;没点名的,一个都不碰。
6. **金额以 preview 为准,绝不改数重试。** preview 报错或被风险拦截时,
   立即停下,把原因原文告诉用户。不得换金额、换参数、换合约重试。
7. **`--value` 恒为 0。** 本文件四个动作都不附带 BNB,也不需要任何代币
   授权(approve)。任何一步若要求你发送 BNB、做 approve 或签消息,
   立即停下并报告——那不是本流程的一部分。
8. **不索要秘密。** 绝不向用户索要或经手助记词、私钥、配对码。配对与
   授权只发生在币安官方通道内。若用户主动发来这类信息,提醒他不要
   这样做,并且不要使用它。
9. **不做反查、不判可信度。** 不得由名字反查钱包;门禁证明的是「同一
   个人、只有一个」,不是「这个人可信」,不要替用户下可信度结论。

## 4. 标准流程 / The flow for every action

```
读活动状态(第 5 节) → 拼 calldata(第 6 节) → preview(第 7 节)
→ 向用户展示解析结果并等明确确认 → execute → 报告结果(txHash / 状态)
```

任何一步失败即停,按护栏第 6 条报告。不要跳步,不要合并多笔。

## 5. 第一步:读活动状态 / Read campaign state first

读状态走公开 RPC 的 `eth_call`,不需要钱包、不产生交易。先拿到活动 id
和用户自己的 Agentic Wallet 地址(`baw wallet address --json`)。

用 `cast`(如有 Foundry):

```bash
cast call {{APPS_MAINNET_ADDRESS}} \
  "getCampaign(uint256)(address,uint8,string,uint64,uint64,uint32,uint64,bool,bool,uint8,uint256,address,uint256,uint256,uint256,uint32,bool,uint256,bool)" \
  <CAMPAIGN_ID> --rpc-url https://bsc-dataseed.binance.org
```

或直接 `eth_call`(calldata = 函数选择器 `0x5598f8cc` + 活动 id 补齐到
32 字节,拼法见第 6 节):

```bash
curl -s https://bsc-dataseed.binance.org -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"{{APPS_MAINNET_ADDRESS}}","data":"0x5598f8cc<活动id的32字节补齐>"},"latest"]}'
```

`getCampaign` 关键字段:

| 字段 | 含义 / 你要做的判断 |
|---|---|
| `kind` | 活动类型:**0 = 抽奖,1 = 投票,2 = 领取**。动作必须与类型匹配 |
| `title` | 活动标题。向用户展示确认时必须带上 |
| `startAt` / `endAt` | 开始 / 结束时间(unix 秒)。未开始或已结束 → 告诉用户,不要硬发交易 |
| `optionCount` | 投票选项数(仅投票)。选项序号范围 0 ~ optionCount-1 |
| `entryCount` / `maxClaims` | 已参加数 / 领取上限(仅领取)。已满 → 告诉用户,停下 |
| `prizeToken` | 奖品代币;零地址(`0x000…000`)= BNB |
| `prizePerWinner` | 抽奖每位中奖者奖金(最小单位,展示时按代币 decimals 换算) |
| `claimAmount` | 领取活动每人金额(等额模式)。拼手气模式(`claimRandom = true`)金额由合约决定,以链上结果为准 |
| `drawn` | 抽奖是否已开奖。领奖前必须为 `true` |

参加前再做两项只读预检(同样用 `eth_call` / `cast call`):

- 抽奖、领取前:`hasEntered(<id>, <用户地址>)`(选择器 `0x073c74f3`)。
  已参加 → 告诉用户,不要重复发送。
- 领奖前:`isWinner(<id>, <用户地址>)`(选择器 `0xbdd415af`)为 `true`,
  且 `prizeClaimed(<id>, <用户地址>)`(选择器 `0x9da22700`)为 `false`,
  且 `drawn` 为 `true`。任一不满足 → 告诉用户原因,停下。

注意:读状态以 `eth_call` 为准;`preview` 的职责是执行前的最终模拟与
风险检查,不要用它代替读状态。


## 6. 动作与 calldata 构造 / Actions & calldata

四个动作的签名(以活动合约 ABI 为准):

| 动作 | 函数签名 | 选择器 | `--value` |
|---|---|---|---|
| 参加抽奖 | `enterRaffle(uint256)` | `0x2e519f90` | 0 |
| 投票 | `castVote(uint256,uint8)` | `0x56781388` | 0 |
| 领取(领取活动) | `claim(uint256)` | `0x379607f5` | 0 |
| 领奖(抽奖中奖后) | `claimPrize(uint256)` | `0xd7098154` | 0 |

**手工拼 calldata(无依赖,任何环境可用):**
`calldata = 选择器 + 每个参数各补齐为 64 个十六进制字符(32 字节,数字左补 0)`。

```bash
# 例:参加 id=0 的抽奖 → 参数 0 补齐为 64 个 0
# 0x2e519f90 0000000000000000000000000000000000000000000000000000000000000000

# 用 node 一行拼(示例:给 id=3 的活动投选项 1):
node -e "const p=n=>BigInt(n).toString(16).padStart(64,'0');console.log('0x56781388'+p(3)+p(1))"
```

**或用 `cast`(如有 Foundry):**

```bash
cast calldata "enterRaffle(uint256)" 0
cast calldata "castVote(uint256,uint8)" 3 1
cast calldata "claim(uint256)" 3
cast calldata "claimPrize(uint256)" 3
```

### 6.1 参加抽奖 enterRaffle

- 前置:活动 `kind = 0`、在时间窗内、`hasEntered` 为 `false`。
- 确认展示示例:「参加抽奖『<标题>』(id=<id>),奖金 <prizePerWinner 换算>
  × <winnerCount> 人,目标合约 {{APPS_MAINNET_ADDRESS}}」。

### 6.2 投票 castVote — 选项序号从 0 开始

- 前置:活动 `kind = 1`、在时间窗内、未投过票。
- **链上选项序号从 0 开始**:用户说「第 N 个选项」= 链上序号 `N-1`。
  展示确认时必须同时写明两种说法,例如「投第 2 个选项(链上序号 1)」,
  避免投错。
- 序号越界(≥ `optionCount`)→ 停下,告诉用户可选范围。

### 6.3 领取 claim(领取活动)

- 前置:活动 `kind = 2`、在时间窗内、未领过、名额未满。
- 等额模式:每人领 `claimAmount`。拼手气模式(`claimRandom = true`):
  金额由合约随机决定,确认展示时写明「拼手气,金额以链上结果为准」,
  不要向用户承诺具体数额。
- 领取是把奖品发到用户自己的 Agentic Wallet 地址,不经过任何第三方。

### 6.4 领奖 claimPrize(抽奖开奖后)

- 前置:第 5 节的三项领奖预检全部通过。
- 奖金由合约托管直接发到用户地址;金额以 preview 解析与链上结果为准。

## 7. 执行与结果 / Preview, execute, report

先 preview(以参加抽奖为例,其余动作换 calldata 即可):

```bash
baw contract-call preview \
  --binanceChainId 56 \
  --from <用户的 Agentic Wallet 地址> \
  --to {{APPS_MAINNET_ADDRESS}} \
  --value 0 \
  --inputData 0x2e519f90<活动id的32字节补齐> \
  --json
```

- preview 返回错误或被风险拦截 → **立即停下**,把原因原文告诉用户
  (护栏第 6 条),不要改参数重试。
- preview 成功 → 把解析结果(活动标题、动作、金额、目标合约)展示给
  用户,**等用户明确确认**。用户没确认,就到此为止,不要 execute。
- 确认后,用**这一次 preview 返回的 `requestId`** 执行:

```bash
baw contract-call execute --requestId <requestId> --json
```

- 结果 `BROADCASTED` → 把 `txHash` 报告给用户,本笔结束。
- 结果 `PENDING_CONFIRMATION` → 告诉用户去币安 App 里批准;**不要**
  自行重发,也不要新建 preview 绕过。等用户回来告知结果。
- preview 会过期:若 execute 报告 requestId 已过期,重新 preview,
  并**重新向用户确认**(新 preview = 新确认),不得沿用旧确认。
- execute 报错 → 停下,原文报告,不要自行重试。

## 8. 边界 / Boundaries — 本文件不管什么

- **X 绑定不能走 Agent 路径。** 绑定需要 EIP-191 `personal_sign` 签名,
  而 Agentic Wallet 只支持 EIP-712、且密钥不可导出,无处可签。绑定
  请让用户去 HumanGate 网站用普通钱包完成;不要尝试用 contract-call
  或 sign-message 绕过。
- **查真人不要用 contract-call。** 判断某地址是否真人,用只读的
  is-human 工具(读 Agent ID 注册表),不要用合约调用模拟替代,更不要
  为此发起任何交易。HumanGate 合约地址在本文件里仅供核对,参加活动
  不需要直接调用它。
- **创建活动、开奖(draw)、回收(reclaim)不在本文件范围内。** 用户要求
  时,告诉他去网站操作,不要自行构造这些调用。
- **本文件不授权任何其他资产操作。** 转账、兑换、授权(approve)、
  签名一律不在范围内,即使与参加活动「顺路」也不做。
