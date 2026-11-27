# 自助登记（Self-Registration）改造方案 — IdentityBindings V4

拟定：2026-11-26（用户拍板方向：发模板推 → 链接交自己 Agent 审核 → 一致即上链 → 删推无影响）
2026-11-26 用户追加拍板：**绑定只留自助一个通道**——见证（登记员）通道下线，
巡查在切换当天停用；普通钱包的签名路径保留（本质同为自助：本人签名、本人付费、
项目方零参与）。V4 因此不带 `registerByAttestation`，登记环节零人工、零登记员
把关；登记员在 V4 里只剩一个事后纠错权：撤销自助登记（见 §3.4）。
状态：待用户确认本方案后开工。

## 0. 一句话

给绑定系统新增第三条登记通道「自助登记」：持有人发模板验证推后，把推文链接交给
**自己的 Agent**，Agent 按 Skill 章节自动审核（作者、模板、Proof 复算），审核通过
即由持有人的 Agentic 钱包直接调用合约登记，全程无登记员、无轮询，**发推后约
1–2 分钟绑好**。登记时推文 ID 一并上链存证，声明从此公开可证伪；登记员保留对
自助登记的撤销权作为滥用兜底。

## 1. 牵连面（2026-11-26 代码核查实况）

| 部件 | 引用方式 | 换 V4 时要动什么 |
|---|---|---|
| OneIDCampaignsV11（主网 0x4858…d598） | 构造时注入 `bindings` 地址且 **immutable**，条件 0 只调 `isBindingValid(address)` | 地址焊死，必须部署 **V12**（同一份已审计源码，仅构造参数换成 V4 地址，字节码除构造参数外不变）。主网活动数 = 0，无状态可丢，**现在是全程最便宜的切换窗口**；API 七剑活动一旦建出来，切换成本陡增 |
| BeCounted 原语 / IdentityProfile / CheckIn | 不引用绑定合约（Profile 仅注释提及） | 不动 |
| 前端 app.js | 常量 `BINDINGS`（现指 V3 主网 0xe90F…E165）+ BINDINGS_ABI；用到 `bindingOf / isBindingValid / proofTypeOf` 三个读函数（绑定页、名片页、活动条件预检） | 换地址；ABI 增加 `proofRefOf`；proofType 显示文案加第 2 类 |
| 参与 Skill（becounted-skill.md） | §8 绑定章现写「Agent 不能代办绑定」；§7 条件 0 预检已是动态读活动合约的 `bindings()` | §8 改写 + 新增自助登记执行章（见 §4）；预检逻辑天然兼容 V12 |
| register-auto.js / registrar-watch.js（见证巡查） | 目标地址读 mainnet-address.json | 见证通道下线后整条管线退役（脚本留仓库作历史）；巡查切换当天停用 |
| mainnet-address.json / flip-mainnet.js | 记录四合约地址 | 新增 bindingsV4、campaignsV12 两条；flip 增加对应替换 |

## 2. 存量迁移

- 见证登记（type 1）只能由登记员钥匙发出，迄今主网仅用户本人：登记 2 次
  （v1 已撤销、v2 现行）→ V4 上线后用户用自助通道重新登记即可，成为 V4 第一条
  真实记录（顺带就是自助通道的主网实测）。
- 签名登记（type 0）：2026-11-26 已做事件全量扫描核实（部署块 135587492 →
  135780695，三类事件全查）——`BindingRegistered` 事件为 **0 条**，从未有人用过。
- **结论：主网 V3 存量有效绑定有且仅有用户本人 1 条（type 1 v2），迁移成本为零，
  V4 可干净切换，无需通知任何第三方。**
- V3 合约不删、不停，永久可读；网站切换后只读 V4。V3 上的历史记录作为
  历史存档存在，不影响任何人（活动条件只查 V12→V4）。

## 3. 合约改动（IdentityBindingsV4 = V3 + 以下增量，其余逐字保留）

1. **新证明类型**：`proofType 2 = 自助登记（self-registered, tweet-referenced）`。
   V4 内只有两类、如实标注（type 1 见证只存在于旧版 V3 的历史记录里）：
   - 0 签名：地址侧强证明（本人签名）；账号侧自称。
   - 2 自助：地址侧由「只能本人钱包发出此调用」证明；账号侧为声明 + 推文 ID
     上链存证，公开可证伪、可举报撤销。
2. **新函数** `registerSelf(string handle, uint256 tweetId)`：
   - 按 `msg.sender` 登记（绑定主体 = 调用者，结构上无法替别人登记）；
   - `_validateHandle` 同 V3；`tweetId == 0` 拒绝（BadEvidence）；
   - 不得覆盖 type 0（同 V3 的 ProofDowngrade）；可覆盖自己旧的 type 2
     （改号/换推纠错）；V4 无 type 1（见证通道不迁移）；
   - 存 `proofRef = tweetId`，发事件 `SelfBindingRegistered(who, handle, tweetId)`。
3. **存储**：Binding 结构体加 `uint256 proofRef`（type 0/1 恒为 0）；新增只读
   `proofRefOf(address)`。`bindingOf` 签名不变，前端旧调用不受影响。
4. **撤销权（登记员在 V4 的唯一权力）**：新增 `revokeSelfRegistration(address)`，
   登记员可撤销 type 2 自助登记，发事件 `SelfBindingRevoked(who)`；type 0
   签名绑定仍不可触碰。正当范围事前写死并公开：**仅限可客观证伪的盗绑**
   （链上存证的推文不存在、或作者与登记 handle 不符——任何人拿推文 ID 一查
   便知）；每次撤销都是链上交易、公开留痕、可审计。撤销只删绑定记录，不动
   对方的 Agent ID、签到与已参加活动的记录；被撤者可发真推重新自助登记。
5. **isBindingValid**：type 2 记录存在即有效，直到被撤销或本人删除。
   活动条件 0 因此自动认自助登记，无需改活动合约的校验逻辑。
6. **覆盖规则（单通道下简化）**：签名可覆盖自助（registerBinding 同 V3，
   可覆盖任意已有绑定）；自助不得覆盖签名（ProofDowngrade）；自助可覆盖
   自己旧的自助登记（改号/换推纠错）。规则在合约注释与白皮书中如实写明。
7. **登记冷却 24 小时（2026-11-26 用户拍板，防恶意重复绑定）**：
   `mapping(address => uint64) public lastRegisteredAt`——每次登记成功
   （registerSelf 与 registerBinding 两条路径共用）都刷新；
   `removeBinding` 和登记员撤销都**不**清零。两条路径登记前都检查：
   `lastRegisteredAt != 0 && block.timestamp < lastRegisteredAt + 24 hours`
   则 revert `CooldownActive()`（新增错误）；首次登记不限。效果：冒绑轮换
   与撤销后重绑骚扰都压到一天最多一次；代价是自助→签名升级也要等冷却
   走完（已知取舍，接受）。常量 `COOLDOWN = 24 hours` 写死并公开。
   前端/Skill 读 lastRegisteredAt 展示剩余时间。

## 4. Agent 执行章（Skill 新增，纪律与签到章同级）

触发：用户明确说「帮我绑定 X」或把验证推链接发给 Agent 并要求登记。

1. 从链接解析 status id；经公开接口（fxtwitter，备援 vxtwitter）抓取推文；
2. 四项全过才继续，任一不过立即停下报告、绝不登记：
   - 作者 == 用户声称的 handle；
   - 模板四行齐全（Handle 行 == 作者、Agent ID 行 == 本钱包的 Agent ID 名、
     Proof 行存在、#BeCountedBind 在）；
   - 用**本钱包地址**（baw wallet status）+ handle 按公开公式复算 Proof
     （keccak256(小写地址 + "@" + 小写handle) 取前 16 位十六进制、大写、
     加 `BC-` 前缀），与推文 Proof 行逐字相同；
   - 链上现绑定不是 type 0（签名绑定不可覆盖，是则告知用户、不重复登记），
     且不在 24 小时冷却内（在则报剩余时间，不登记）；
3. baw contract-call 预览 `registerSelf(handle, tweetId)`：把合约地址、handle、
   tweetId 展示给用户，**一次明确确认**后才执行；
4. 执行后回查 `proofTypeOf(自己) == 2 && isBindingValid(自己)`，报交易哈希。
   失败按错误选择子解释（BadHandle / BadEvidence / ProofDowngrade 等）。
5. 红线：只在用户明确要求时执行；不替用户发推；审核任一项不过绝不登记；
   不承诺定时/自动绑定（同签到章纪律）。

## 5. 上线顺序

1. 写 IdentityBindingsV4 + 测试（扩展 V3 测试集：自助登记全路径、覆盖规则、
   撤销 type 2、tweetId=0 拒绝、proofRefOf、isBindingValid、冷却五项：
   二次登记被拒 / 24h 后放行 / 删除不重置 / 撤销不重置 / 首次不限）；
2. OneIDCampaignsV12 = V11 源码原样，部署时构造参数指向 V4；测试网先行部署
   V4 + V12 并实测：自助登记 → 条件 0 放行、撤销 → 条件 0 拦截；
3. 安全自审一轮（身份基础设施，按深审标准过新函数与覆盖/撤销路径）；
4. 主网部署 V4 + V12 → BscScan 源码验证 → mainnet-address.json 与 flip 更新；
5. 前端切换（版本递增）：BINDINGS 指向 V4、活动合约指向 V12、proofType 2
   文案、自助登记引导上线、见证通道文案下线；托管空间同步 + 卡片；
6. 用户本人走自助通道完成 V4 主网首条登记（迁移与实测合一）；
7. 切换当天停掉 becounted-binding-watcher 定时任务，见证管线退役。

## 6. 文案与文档同步

- 绑定页：见证通道说明与「发完等登记」文案删除；自助步骤写明：发模板推 →
  链接交自己 Agent → 一两分钟绑好 → 登记后推文可自行删除；
- 白皮书 §06：证明类型改两类如实标注，补撤销权的范围与公开承诺（§3.4）；
- 提交稿：新增「持有人自助绑定（Agent 审核、实时上链、零人工）」作为
  Agent 原生证据点；
- PLAN.md：补记单通道决定与本方案链接。

## 7. 决策记录

- 已定（2026-11-26）：只留自助一个通道，见证下线、巡查切换当天停用、
  签名路径保留；覆盖规则按 §3.6；撤销权范围按 §3.4 事前公开；
  登记冷却 24 小时按 §3.7（两路径共用、删除与撤销不重置）。
- 待用户确认：① V4 + V12 成对部署、且排在 API 七剑活动创建之前（建议：是）；
  ② proofType 2 显示名：「自助登记（推文存证）」（建议：照此）。
...[truncated 2089 chars]