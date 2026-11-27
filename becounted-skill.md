# BeCounted 参与 Skill — 用 Agentic Wallet 参加活动

**这是什么 / What this is**
你(AI Agent)将代表用户,通过他的 Binance Agentic Wallet,参加 BeCounted 在
BNB Smart Chain **主网**上的活动(抽奖 / 投票 / 领取)。BeCounted 用 Binance
Agent ID 做真人门禁:一人一号、不可转让。参加动作以用户的 Agentic Wallet
地址上链——这正是门禁要验的地址。

> ## ⚠️ 先读这一条:占位符未替换 = 禁止执行
> 本文件中的合约地址均已填入主网真实地址。
> **只要文件里还能看到 `{{...}}` 占位符,就说明有地址尚未填入。此时不要执行
> 任何合约调用**,直接告诉用户「参与 Skill 尚未就绪,主网地址待填」并停下。
>
> EN: If any `{{...}}` placeholder is still present in this file, STOP.
> Do not execute any contract call. Tell the user the skill is not ready
> yet and end the task.

---

## 1. 合约与网络 / Contracts & network

| 角色 | 地址 | 说明 |
|---|---|---|
| OneIDCampaigns(活动合约,现行 V18) | `0x3Ba2420457b1254FA632D03190b5189Bfa2ffFb1` | 新活动都在这里;参加调用的目标合约(以活动页给出的合约为准) |
| OneIDCampaigns V15 / V14(历史活动) | `0x6abA2aa96076DFB6eb4c038475D4495d3Ae97D2C` / `0x119541Cafa25118cd54F5548Df2A7D1aeE99B0f8` | 早期活动(V14 上的 #0 等)仍在这些合约上;参加这类活动时把目标合约换成它,调用方法完全相同 |
| BeCounted(真人门禁) | `0xda585a4ae5b73ee2728aada3e877a3a1f84027cd` | 活动合约内部用它验真人;**你不需要直接调用它** |
| IdentityBindingsV4(绑定登记) | `0x5FC906B394BA23Dd1B546aea8F217101DEc07F85` | X 绑定登记合约;只有第 8 节的自助登记调它,**不要**拿它参加活动 |
| CheckInV2(每日签到,现行) | `0x577b0439F66c3ddd05eec47f3bF31FD7451ACe47` | 每日签到合约(权重窗口 14 天);只有第 9 节的签到动作调它,**不要**拿它参加活动。旧 CheckIn V1(`0x74b413451a5244bc0630c176badaddab981366e8`)已停用,不要再向它签到 |

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
   立即停下,先按第 7.1 节对照表给人话结论,原文附在后面。不得换金额、
   换参数、换合约重试。
7. **`--value` 恒为 0。** 本文件的全部动作都不附带 BNB,也不需要任何代币
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

**活动 id 从哪来(三级路径,按顺序试):**

1. **用户直接给 id** —— 最佳,直接用。
2. **用户只给了标题** —— 不要猜 id。请用户在官网打开那个活动的详情
   页,把链接发给你:链接形如 `campaign?id=N`,其中的 `N` 就是
   活动 id。用户发来链接后,从链接里取 id 再继续。
3. **Agent 自查(前两条都拿不到时)** —— 用 `eth_getLogs` 扫活动合约
   的 `CampaignCreated` 事件,按 `title` 字段匹配用户点名的标题:
   事件签名(topic0)为
   `0xc3746a89664fadf8955c57845515461ecffa90466ca6abccc52ba5976dc43a91`
   (`CampaignCreated(uint256,address,uint8,string,uint64,uint64)`,
   第一个 indexed 参数就是活动 id)。**分段扫**:公开 RPC 单次
   `eth_getLogs` 的区间上限约 5 万块,按每段 ≤ 45,000 块分段、从近
   到远扫,命中标题完全一致的事件后取其 id;同名活动有多个时,把
   候选(标题 + id + 起止时间)列给用户确认,不要自行挑一个。

用 `cast`(如有 Foundry):

```bash
cast call 0x119541cafa25118cd54f5548df2a7d1aee99b0f8 \
  "getCampaign(uint256)(address,uint8,string,uint64,uint64,uint32,uint64,bool,bool,uint8,uint256,address,uint256,uint256,uint256,uint32,bool,uint256,bool,string)" \
  <CAMPAIGN_ID> --rpc-url https://bsc-dataseed.binance.org
```

或直接 `eth_call`(calldata = 函数选择器 `0x5598f8cc` + 活动 id 补齐到
32 字节,拼法见第 6 节):

```bash
curl -s https://bsc-dataseed.binance.org -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x119541cafa25118cd54f5548df2a7d1aee99b0f8","data":"0x5598f8cc<活动id的32字节补齐>"},"latest"]}'
```

`getCampaign` 关键字段(序号 = 返回元组中的位置,从 0 数;`cast` 的
输出是纯位置型的,对号入座靠序号):

| 字段(序号) | 含义 / 你要做的判断 |
|---|---|
| `kind`(1) | 活动类型:**0 = 抽奖,1 = 投票,2 = 领取**。动作必须与类型匹配 |
| `title`(2) | 活动标题。向用户展示确认时必须带上 |
| `startAt`(3) / `endAt`(4) | 开始 / 结束时间(unix 秒)。未开始或已结束 → 告诉用户,不要硬发交易 |
| `winnerCount`(5) | 抽奖的中奖人数。6.1 确认话术里「× N 人」就取这个字段,不要自己数元组猜 |
| `drawn`(7) | 抽奖是否已开奖。领奖前必须为 `true` |
| `optionCount`(9) | 投票选项数(仅投票)。选项序号范围 0 ~ optionCount-1 |
| `entryCount`(10) / `maxClaims`(15) | 已参加数 / 领取上限(仅领取)。已满 → 告诉用户,停下 |
| `prizeToken`(11) | 奖品代币;零地址(`0x000…000`)= BNB。换算金额前先读 decimals:对 `prizeToken` 调 `decimals()`(选择器 `0x313ce567`)取位数;零地址(BNB)按 18 位。BSC 上的 USDC、USDT 也都是 18 位 |
| `prizePerWinner`(12) | 抽奖每位中奖者奖金(最小单位,展示时按上面读到的 decimals 换算) |
| `claimAmount`(14) | 领取活动每人金额(等额模式)。拼手气模式(`claimRandom = true`)金额由合约决定,以链上结果为准 |
| `prizeLabel`(19) | 自定义链下奖品说明(仅抽奖)。非空 = 本场奖品不是代币,而是白名单、实物等链下奖品,由发起人按链上中奖名单发放;向用户确认时必须**原文展示**这段说明,**不得显示「奖金 0」**,也不要按 `prizePerWinner` 换算 |

参加前再做只读预检(同样用 `eth_call` / `cast call`):

- 抽奖、领取前:`hasEntered(<id>, <用户地址>)`(选择器 `0x073c74f3`)。
  已参加 → 告诉用户,不要重复发送。
- 领奖前:`isWinner(<id>, <用户地址>)`(选择器 `0xbdd415af`)为 `true`,
  且 `prizeClaimed(<id>, <用户地址>)`(选择器 `0x9da22700`)为 `false`,
  且 `drawn` 为 `true`。任一不满足 → 告诉用户原因,停下。
- 投票前:读 `optionLabelsOf(<id>)`(选择器 `0x64282e78`),返回选项
  文字数组(顺序与链上序号一一对应)。6.2 的确认话术必须带上用户要
  投的那个选项的**文字**,不要只报序号。

**条件预检:读 `conditionsOf(<id>)`(选择器 `0x3c5da3e1`)查条件 0–3。**

活动可以带参加条件;不预检就硬发交易,只会撞上 `ConditionFailed(n)`
白付 gas。`conditionsOf` 返回元组按序号解读:

| 序号 | 字段 | 启用判据 |
|---|---|---|
| 0 | `requireBinding` | = `true` → 条件 0 启用 |
| 1 | `gateToken` | ≠ 零地址 → 条件 1 启用 |
| 2 | `gateMin` | 条件 1 的最低持仓量 |
| 3 | `gateIs721` | 条件 1 的代币是否为 NFT(见下) |
| 4 | `requireEnteredId` | ≠ `uint256` 最大值(`0xffff…ffff`)→ 条件 2 启用 |
| 5 | `minStamps` | > 0 → 条件 3 启用 |
| 6 | `questRef` | 条件 3 读印记数用的合约地址 |
| 7 | `allowRoot` | ≠ 零值 → 条件 4 启用(见 6.0 节) |
| 8 | `idListRoot` | ≠ 零值 → 条件 5 启用(见 6.0b 节) |

逐项核对启用的条件,**任一不满足就停下**,按对应话术告诉用户,不要
硬发交易:

- **条件 0(X 绑定)**:先读活动合约的 `bindings()`(选择器
  `0xc8f5a5f1`)拿到绑定合约地址,再对它调
  `isBindingValid(<用户地址>)`(选择器 `0x00263058`)。为 `false` →
  停下:「本场要求先完成 X 绑定,你还没绑。可以现在按第 8 节自助登记
  完成绑定(需要你先发一条验证推文),绑好后回来参加。」
- **条件 1(持币门槛)**:对 `gateToken` 调 `balanceOf(<用户地址>)`
  (选择器 `0x70a08231`),与 `gateMin` 比对。不足 → 停下:「本场要求
  持有至少 <gateMin 按 decimals 换算> 的该代币,你的余额不足。」注意:
  `gateIs721 = true` 时 `gateMin` 是 NFT 的**个数**(`balanceOf` 返回
  件数);本门槛只支持 `balanceOf` 直返个数的代币(ERC20 与 ERC721),
  **ERC1155 不支持**——若读数明显对不上或调用失败,如实告诉用户本场
  门槛无法核验,停下,不要猜。
- **条件 2(前置参与)**:`hasEntered(<requireEnteredId>, <用户地址>)`
  (选择器 `0x073c74f3`)。为 `false` → 停下:「本场要求先参加过活动
  #<requireEnteredId>,你还没有参加记录。先去参加那一场,再回来。」
- **条件 3(印记数)**:对 `questRef` 调 `stampCount(<用户地址>)`
  (选择器 `0xb5353221`)。小于 `minStamps` → 停下:「本场要求至少
  <minStamps> 枚印记,你目前有 <读到的枚数> 枚。本站当前没有领印
  途径,如实告诉用户差额,不要编造领取方法。」

注意:读状态以 `eth_call` 为准;`preview` 的职责是执行前的最终模拟与
风险检查,不要用它代替读状态。


## 6. 动作与 calldata 构造 / Actions & calldata

四个动作的签名(以活动合约 ABI 为准):

| 动作 | 函数签名 | 选择器 | `--value` |
|---|---|---|---|
| 参加抽奖 | `enterRaffle(uint256,bytes32[],bytes32[])` | `0x1959f37d` | 0 |
| 投票 | `castVote(uint256,uint8,bytes32[],bytes32[])` | `0x97176faa` | 0 |
| 领取(领取活动) | `claim(uint256,bytes32[],bytes32[])` | `0xf50cd1da` | 0 |
| 领奖(抽奖中奖后) | `claimPrize(uint256)` | `0xd7098154` | 0 |

三个参加动作都带**两个**证明参数:`proof`(条件 4 地址名单)与
`idProof`(条件 5 Agent ID 名单)。活动没启用对应名单时,该参数传
空数组。两个名单同时启用时,两个证明都要带(见 6.0 与 6.0b 节)。

**手工拼 calldata(无依赖,任何环境可用):**
`calldata = 选择器 + 每个参数各补齐为 64 个十六进制字符(32 字节,数字左补 0)`。
两个 `bytes32[]` 参数都是动态类型:编码为「偏移量 + 长度 + 各元素」。
非名单制活动两个证明都为空数组:参加/领取的两个偏移量是 `0x60`、
`0x80`,投票是 `0x80`、`0xa0`,后面各跟长度 `0`。名单制活动的构造
见 6.0 节(条件 4)与 6.0b 节(条件 5)。

```bash
# 例:参加 id=0 的抽奖(非名单制,两个 proof 均为空数组):
# 0x1959f37d <id=0 补齐> <偏移量 0x60 补齐> <偏移量 0x80 补齐> <长度 0 补齐> <长度 0 补齐>

# 用 node 一行拼(示例:给 id=3 的活动投选项 1,两个 proof 为空):
node -e "const p=n=>BigInt(n).toString(16).padStart(64,'0');console.log('0x97176faa'+p(3)+p(1)+p(128)+p(160)+p(0)+p(0))"
```

**或用 `cast`(如有 Foundry):**

```bash
cast calldata "enterRaffle(uint256,bytes32[],bytes32[])" 0 "[]" "[]"
cast calldata "castVote(uint256,uint8,bytes32[],bytes32[])" 3 1 "[]" "[]"
cast calldata "claim(uint256,bytes32[],bytes32[])" 3 "[]" "[]"
cast calldata "claimPrize(uint256)" 3
```

### 6.0 名单制活动(条件 4):proof 怎么来

先读活动的 `conditionsOf(id)`:若 `allowRoot` 不是零值,这个活动是
名单制——参加/投票/领取都必须带上你地址的默克尔证明,否则链上会
以 `ConditionFailed(4)` 拒绝。

- 名单由发行人分发。**请用户提供名单文件**(地址数组);用户拿不到
  名单时停下并说明,不要猜、不要用别人的证明。
- 证明构造(与合约、官网同一算法,可本地复算验证):
  叶子 = `keccak256(地址的 20 字节打包)`;相邻两节点排序后拼接再
  `keccak256`;落单节点原样上提;从叶子层起逐层收集兄弟节点即 proof。
- 拼 calldata 时 proof 放在长度之后逐个补齐;先在本地用名单复算根
  值,与 `allowRoot` 对照一致后再 preview。proof 是第一个证明参数;
  活动未启用条件 5 时,第二个证明参数 `idProof` 传空数组。

### 6.0b Agent ID 名单制活动(条件 5):idProof 怎么来

先读活动的 `conditionsOf(id)`(返回值最后一个字段 `idListRoot`):
若不是零值,这个活动是 **Agent ID 名单制**——名单里是 Agent ID
名字,不是钱包地址。参加/投票/领取都必须带上你身份叶的默克尔证明
(第二个证明参数 `idProof`),否则链上会以 `ConditionFailed(5)` 拒绝。

- 名单由发行人分发(**名字**数组)。请用户提供名单;用户拿不到名单
  时停下并说明,不要猜、不要用别人的证明。
- 你自己的名字这样取(只读 `eth_call`,不需要交易):先调活动合约的
  `idRegistry()`(选择器 `0x0aa13b8c`)拿到 Agent ID 注册表地址,再调
  注册表的 `handleOf(<你的 Agentic Wallet 地址>)`(选择器
  `0xc50a1514`)。这是「地址 → 本人名字」的读取,是允许的方向。
  返回的字符串就是合约认的名字(裸标签,无 `.ai` 后缀);返回空字符
  串 = 你的地址没有 Agent ID 名字,不可能在任何身份名单上,停下并
  告诉用户。
- 身份叶构造(与合约、官网同一算法,可本地复算验证):
  `labelhash = keccak256(名字的 UTF-8 字节)`;
  叶子 = `keccak256(labelhash 的 32 字节打包)`。建树与证明收集与
  6.0 节相同(相邻节点排序后拼接再 `keccak256`,落单节点原样上提)。
  先在本地用名单复算根值,与 `idListRoot` 对照一致、且你的叶确实在
  名单内,再 preview。
- **红线:绝不做「名字 → 地址」解析。** 整个流程不需要用户提供任何
  地址——你的 Agentic 地址由 `baw` 给出;不得查询、推断或记录名单
  上其他人的地址。活动未启用条件 4 时,第一个证明参数 `proof` 传
  空数组。

### 6.1 参加抽奖 enterRaffle

- 前置:活动 `kind = 0`、在时间窗内、`hasEntered` 为 `false`。
- 确认展示示例:「参加抽奖『<标题>』(id=<id>),奖金 <prizePerWinner 换算>
  × <winnerCount> 人,目标合约 0x119541cafa25118cd54f5548df2a7d1aee99b0f8」。
- **加权抽奖(V16 引入,V17 改为锁定快照)**:活动带 `weighted = true`(`getCampaign` 最后一
  个字段)时,开奖不是等概率——报名截止、锁定开奖种子时合约快照冻结每位参加者的签到
  权重(1 + 近 14 天签到天数),开奖只读这份快照,锁定之后再签到也不改变本活动的权重。权重越高概率按比例越大。参加动作本身
  完全不变;用户问起时如实解释,并可读他当前的 `weightOf`(第 9 节)
  告诉他现在的权重。不要承诺中奖。现行 V18 开奖时还会发出 `DrawWeights` 事件,公开每位中奖者的快照权重,可供复算。
- **代领(V18)**:托管奖品的中奖者若一直没来领取,任何人都可以调用
  `claimPrizeFor(id, 中奖者地址)` 替他触发领取——奖金只会打给中奖者本人,
  触发者拿不到任何部分。用户是中奖者时,照常优先用他自己的 `claimPrize`。

### 6.2 投票 castVote — 选项序号从 0 开始

- 前置:活动 `kind = 1`、在时间窗内、未投过票。
- **链上选项序号从 0 开始**:用户说「第 N 个选项」= 链上序号 `N-1`。
  展示确认时必须带上选项文字(第 5 节预检读到的 `optionLabelsOf`
  结果),并同时写明两种说法,例如「投『<选项文字>』(第 2 个,链上
  序号 1)」,让用户对着文字核对,避免投错。
- 序号越界(≥ `optionCount`)→ 停下,告诉用户可选范围。

### 6.3 领取 claim(领取活动)

- 前置:活动 `kind = 2`、在时间窗内、未领过、名额未满。
- 等额模式:每人领 `claimAmount`。拼手气模式(`claimRandom = true`):
  金额由合约随机决定,确认展示时写明「拼手气,金额以链上结果为准」,
  不要向用户承诺具体数额。
- 领取是把奖品发到用户自己的 Agentic Wallet 地址,不经过任何第三方。
- **登记型领取(V15 新增)**:活动带 `prizeLabel`(如「周边礼盒」)且奖池为 0
  时,这是链下实物/权益的记名领取——`claim()` 照常调用,链上只记录领取
  人、不付款;确认展示时写明「领取即占位登记,奖品由发起人线下发放」,
  不要说成有代币到账。名额先到先得,满额后合约以 `NoSlots` 拒绝。

### 6.4 领奖 claimPrize(抽奖开奖后)

- 前置:第 5 节的三项领奖预检全部通过。
- **领取期限:开奖后须在活动结束(`endAt`)起 30 天内领取。** 预检时
  若已超过这个期限,直接告诉用户奖金已过期,不要发交易——链上会以
  `ClaimExpired` 拒绝(见 7.1),过期奖金转入创建者可回收的余款。
- 奖金由合约托管直接发到用户地址;金额以 preview 解析与链上结果为准。

### 6.5 中奖后填信息(链下奖品)

- 若奖品是链下奖品(`prizeLabel` 非空),中奖后可能还要一步:只读调用
  活动合约 `winnerInfoUrl(id)` 与 `winnerInfoNote(id)`。返回的链接是
  发起人自己的信息收集表单,中奖人要在浏览器里打开、按说明填写
  领奖信息(例如 API 账号邮箱),发起人按链上中奖名单核对后发放。
- 你的动作到「把链接和说明原样交给用户」为止:不要替用户打开表单、
  不要代填、更不要向用户索取或经手任何个人信息。链接为空则没有
  这一步,不必提。
- 交给用户时顺带提醒一句:任何表单都不会向你索要助记词、私钥或
  密码——开口要的都是骗局。链接由发起人在开奖前设定、开奖后在
  合约层冻结(`setWinnerInfo` 开奖后调用会以 `WinnerInfoLocked`
  回滚),你读到的就是开奖那一刻定格的链接。


## 7. 执行与结果 / Preview, execute, report

先 preview(以参加抽奖为例,其余动作换 calldata 即可):

```bash
baw contract-call preview \
  --binanceChainId 56 \
  --from <用户的 Agentic Wallet 地址> \
  --to 0x119541cafa25118cd54f5548df2a7d1aee99b0f8 \
  --value 0 \
  --inputData 0x1959f37d<活动id的32字节补齐><偏移量0x60的32字节补齐><偏移量0x80的32字节补齐><长度0的32字节补齐><长度0的32字节补齐> \
  --json
```

- preview 返回错误或被风险拦截 → **立即停下**,先按 7.1 对照表给
  人话结论、原文附在后面(护栏第 6 条),不要改参数重试。
- preview 成功 → 把解析结果(活动标题、动作、金额、目标合约)展示给
  用户,**等用户明确确认**。用户没确认,就到此为止,不要 execute。
- 确认后,用**这一次 preview 返回的 `requestId`** 执行:

```bash
baw contract-call execute --requestId <requestId> --json
```

- 结果 `BROADCASTED` → 先记下 `txHash`,但**不要立刻报成功**:
  广播成功 ≠ 执行成功(名额可能在确认间隙被抢完、时间窗可能刚过,
  交易照样会上链失败),先做下一步复核。
- **执行后复核(报成功前必做)**:只读复核这笔是否真的生效——参加
  抽奖 / 投票 / 领取后,`hasEntered(<id>, <用户地址>)` 应为 `true`;
  领奖后,`prizeClaimed` 应为 `true`;也可以查这笔交易的
  收据 `status` 应为成功。复核通过 → 向用户报告成功(带 txHash)。
  复核不符 → 如实告诉用户这笔没有生效,附 txHash 与链上实际状态,
  **不要报成功,也不要自行重发**(护栏第 4、6 条)。
- 结果 `PENDING_CONFIRMATION` → 告诉用户去币安 App 里批准;**不要**
  自行重发,也不要新建 preview 绕过。等用户回来告知结果。
- preview 会过期:若 execute 报告 requestId 已过期,重新 preview,
  并**重新向用户确认**(新 preview = 新确认),不得沿用旧确认。
- execute 报错 → 停下,先按 7.1 对照表给人话结论、原文附在后面,
  不要自行重试。

### 7.1 错误对照表 / Error table — 先给人话结论,原文附后

preview / execute 报错时,错误数据以 4 字节**选择器**开头,对照下表
给用户**人话结论 + 下一步**,然后把原文附在后面。`ConditionFailed`
的选择器后面还跟一个 32 字节参数,就是条件编号。

| 错误(选择器) | 人话结论 | 下一步 |
|---|---|---|
| `ConditionFailed(0)`(`0x075c760f` + 参数 0) | 本场要求先完成 X 绑定,你还没绑 | 按第 8 节先完成绑定,再回来参加 |
| `ConditionFailed(1)`(参数 1) | 持币门槛没达到 | 把第 5 节预检读到的门槛与余额告诉用户;不要替用户买币 |
| `ConditionFailed(2)`(参数 2) | 本场要求先参加过指定活动,你还没参加 | 告诉用户先去参加那一场,再回来 |
| `ConditionFailed(3)`(参数 3) | 印记数不够 | 告诉用户还差几枚;本站当前没有领印途径,如实告知 |
| `ConditionFailed(4)`(参数 4) | 你的地址不在本场地址名单里(或名单证明不对) | 请用户提供发行人分发的名单核对;拿不到名单就停下,不要猜 |
| `ConditionFailed(5)`(参数 5) | 你的 Agent ID 名字不在本场身份名单里(或名单证明不对) | 请用户提供发行人分发的名字名单核对;拿不到就停下 |
| `NotHuman`(`0xb54e834c`) | 这个钱包没有 Agent ID,过不了真人门禁 | 让用户确认用的是 Agentic Wallet 地址、且已在币安 App 领取 Agent ID |
| `AlreadyCounted`(`0x41852f58`) | 你已经参加过了 | 不用重复操作,告诉用户已参加 |
| `NotOpen`(`0xddafad98`) | 不在开放时间(活动未开始 / 已结束) | 把第 5 节读到的时间窗告诉用户 |
| `NoSlots`(`0x093fe961`) | 名额已满(领取上限已满) | 告诉用户已满 |
| `NotWinner`(`0x618c7242`) | 你没有中奖 | 如实告诉用户,不要安慰性编造 |
| `BadOption`(`0xb28dea74`) | 选项序号超出范围 | 按 `optionCount` 与选项文字重新向用户确认要投哪个 |
| `ClaimExpired`(`0x82a49d9e`) | 领奖已过期:开奖后超过 30 天(以活动 `endAt` + 30 天为界),这份奖金不能再领了 | 如实告诉用户已过期,不要重试;未领奖金之后由创建者回收 |
| `InsufficientReceived`(`0x864dd2f8`) | 存入的奖品代币实际到账比应存金额少——多半是带转账税(fee-on-transfer)的代币 | 这是**创建活动存奖品时**才会出现的错误,不在参加流程内;若用户在创建时遇到,告诉他换标准代币或 BNB |
| 表里没有的错误 | 无法归类 | 如实说无法判断,附原文,停下,不要重试 |

## 8. X 绑定自助登记 / X binding self-registration

绑定目标合约是 IdentityBindingsV4 `0x5FC906B394BA23Dd1B546aea8F217101DEc07F85`
(**不是**活动合约)。原理:用户用自己的 X 发一条固定模板的验证推文
(只写 X 账号、Agent ID 名与 Proof 码,**不含钱包地址**),你审核通过后,
用用户的 Agentic 钱包调 `registerSelf(handle, tweetId)` 登记——绑定按
调用者地址记,只能给本钱包登记;推文的 status id 会存上链作存证。

### 8.1 触发与审核(只读,不产生交易)

只在用户明确要求登记绑定、并给出验证推文链接时执行。先从链接解析
status id,经公开接口抓取推文原文与作者
(`https://api.fxtwitter.com/status/<id>`,备援
`https://api.vxtwitter.com/Twitter/status/<id>`)。以下四项**全过才继续,
任一不过立即停下、按原文报告哪一项不过,绝不登记**:

1. **作者**:推文作者 == 用户声称的 X 账号(handle,小写、不带 @)。
2. **模板**:推文含且只按此格式(四行 + 标签):
   `BeCounted binding verification` / `Handle: @<handle>` /
   `Agent ID: <名字>.ai` / `Proof: BC-<16 位大写十六进制>` /
   `#BeCountedBind`;其中 Agent ID 行的名字必须 == 本钱包的 Agent ID 名
   (`baw wallet status` 或注册表 `handleOf(本钱包地址)`)。
3. **Proof 复算**:用**本钱包地址**(baw wallet status 的地址)按公式
   `BC-` + 大写(keccak256(UTF-8(小写地址 + "@" + 小写 handle)) 的前
   16 位十六进制),与推文 Proof 行逐字比对,必须完全相同。
4. **现状态**:对绑定合约读 `proofTypeOf(本钱包地址)`(选择器
   `0xbfe5568d`):为 `0`(签名绑定)时停下——签名绑定不可被自助登记
   覆盖,告知用户已绑好且等级更高;再读
   `lastRegisteredAt(本钱包地址)`(选择器 `0x7bebcc6f`):距上次登记
   不足 24 小时时停下,告知剩余冷却时间,不登记。

### 8.2 调用与确认

审核全过后,拼 `registerSelf(string,uint256)`(选择器 `0x3ae21ee1`)
的 calldata(参数:handle 小写字符串、tweetId 十进制转 uint256),
走第 4 节的标准流程:`baw contract-call preview` 把**绑定合约地址、
handle、tweetId** 展示给用户,**一次明确确认**后才 `execute`;
执行后回查 `proofTypeOf(本钱包地址) == 2` 且
`isBindingValid(本钱包地址) == true`(选择器 `0x00263058`),
把交易哈希报给用户。gas 由用户钱包自付(极小)。

### 8.3 纪律与错误对照

- 只在用户当次明确要求时登记;不替用户发推;不承诺定时或自动绑定。
- 审核不过**绝不**放宽任何一项(作者、模板、Proof、冷却)去迁就。
- 错误选择子:`0xc9491d4a` BadHandle(handle 格式不对,让用户核对
  账号名);`0x57aa51ca` BadEvidence(tweetId 为 0,链接解析有误);
  `0xaa9a98df` CooldownActive(24 小时冷却中,报剩余时间);
  `0x21d531f2` ProofDowngrade(已有签名绑定,无需再绑)。

### 8.4 其余边界 / What stays out of scope
- **查真人不要用 contract-call。** 判断某地址是否真人,用只读的
  is-human 工具(读 Agent ID 注册表),不要用合约调用模拟替代,更不要
  为此发起任何交易。BeCounted 合约地址在本文件里仅供核对,参加活动
  不需要直接调用它。
- **创建活动、开奖(先 `lockDraw` 锁定种子、再 `draw`)、回收(reclaim)不在本文件范围内。** 用户要求
  时,告诉他去网站操作,不要自行构造这些调用。
- **本文件不授权任何其他资产操作。** 转账、兑换、授权(approve)、
  签名一律不在范围内,即使与参加活动「顺路」也不做。

## 9. 每日签到 / Daily check-in

签到是独立于活动的日常动作,目标合约是 CheckInV2 合约
`0x577b0439F66c3ddd05eec47f3bF31FD7451ACe47`(**不是**活动合约)。规则:只有 Agent ID 持有人
能签;每人每天一次,天界按北京时间(UTC+8)零点;签到天数计入
「活跃权重」——权重 = 1 + 近 14 天签到天数(合约 `weightOf` 可查,
`CheckedIn` 事件可复算)。旧 CheckIn V1 的签到记录不计入现行权重,
不要再向 V1 签到。

> 若本节地址仍写作 `{{CHECKIN_ADDRESS}}`(占位符未替换),说明签到合约主网地址
> 尚未填入:不要执行任何签到调用,告诉用户「签到功能尚未就绪」并
> 停下(抬头警告同样适用)。

### 9.1 先读状态(只读,不产生交易)

用 `eth_call` / `cast call` 读 CheckIn 合约(地址同上):

| 读什么 | 函数(选择器) | 判断 |
|---|---|---|
| 今天签了吗 | `hasCheckedInToday(<用户地址>)`(`0x3504f52b`) | `true` → 今天已签,告诉用户,不要再发交易 |
| 累计天数 | `totalCheckInsOf(<用户地址>)`(`0x4bceea1e`) | 报告时用 |
| 当前权重 | `weightOf(<用户地址>)`(`0xdd4bc101`) | 报告时用 |

### 9.2 调用与确认

calldata 恒为选择器 `0x183ff085`(`checkIn()` 无参数),`--value`
恒为 0,不需要任何 approve。流程与第 7 节完全一致:

```
读状态(9.1) → preview → 向用户展示解析结果并等明确确认 → execute → 复核 → 报告
```

- preview 的 `--to` 是 CheckInV2 合约地址,`--from` 是用户的
  Agentic Wallet 地址。
- 确认展示示例:「每日签到:向 CheckIn 合约发送 checkIn(),为你的
  Agentic Wallet 地址记今天的签到。目标合约 0x577b0439F66c3ddd05eec47f3bF31FD7451ACe47」。
- **一次确认只值这一笔签到**(护栏第 2 条同样适用),不得挪用到
  第二天或任何其他动作。

### 9.3 纪律:签到永远是「当次点名、当次确认」

- **不得承诺、设置或暗示「全自动每日签到」。** 不得建定时任务、
  循环或任何让签到在用户不在场时自动发生的安排(护栏第 4 条)。
  签到只在用户当天明确要求时执行:用户哪天说签,你哪天走一遍
  9.1–9.2 的完整流程。
- 用户说「以后每天自动帮我签」→ 明确拒绝并说明:签到必须逐笔
  preview + 确认,这是本 Skill 的强制护栏,不能绕过;他每天说
  一声,你每次都照流程跑一遍。

### 9.4 执行后复核与错误话术

execute 返回 `BROADCASTED` 后,先复核
`hasCheckedInToday(<用户地址>)` 应为 `true`,再报告成功,并带上
累计天数与当前权重(9.1 的读数)。复核不符 → 如实报告,不要报
成功,也不要自行重发。

| 错误(选择器) | 人话结论 | 下一步 |
|---|---|---|
| `AlreadyCheckedIn`(`0xbcb28303`) | 今天已经签过到了 | 不用重复操作;把累计天数与当前权重告诉用户 |
| `NotHuman`(`0x5d8122cb`) | 这个钱包没有 Agent ID,过不了真人门禁 | 让用户确认用的是 Agentic Wallet 地址、且已在币安 App 领取 Agent ID |
| 表里没有的错误 | 无法归类 | 如实说无法判断,附原文,停下,不要重试 |
