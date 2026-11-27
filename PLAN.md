# Agent ID 黑客松 · 创新奖参赛方案 v2（2026-11-21 定稿）

> 活动：币安钱包 × BNB 链 Agent ID 黑客松（总奖池 60,000 USDC）
> 目标奖项：创新奖（前 10 名：10,000 / 6,000 / 4,000 / 3,000 / 2,000 / 800×5 USDC）
> 硬截止：2026-12-09 16:00（东八区）；本方案按 12-08 提交倒排
> 公告：https://www.binance.com/zh-CN/support/announcement/detail/95f5dbe0ea674a48a739b59e046648bf
> 设计地基：玖肆构想文档（结构性唯一 / 两键原则 / 三条边界），原件存 user/files/upload.md

---

## 1. 产品结构（四层，一主线）

**主线叙事（只讲一个故事）**：抗女巫。Agent ID 是 BNB Chain 上唯一把「人」从「地址和平台」里抽出来的锚点——一人一个是 KYC 结构定的，不是规则定的。我们把这个锚点做成任何人可直接调用的一层。

**① 本体：HumanGate 原语合约**
- `isHuman(address) -> bool`：读 Agent ID 注册合约（0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F）`balanceOf`，>0 即真人。
- **两键原则**：「是不是真人」用地址问、每次调用问；「这人算过没」用 Agent ID 去重、状态归调用方自己的合约记。原语本身无状态。
- 性质（评审可在 BscScan 当场验）：只读、无 owner、不可升级、一次定型。
- 三条边界写进合约文档与官网：不做按名反查钱包、不判断人品、不识别小号（只让第二个地址过不了门）。

**② 参考应用：抽奖 + 投票（同一合约 OneIDCampaigns）**
- 存在的理由有两个：证明原语真能用；产生真实链上交易，满足创新奖「≥30 个 Agent ID 地址交互」门槛（view 调用不上链、不计数——这是 v1 方案的致命盲点，v2 已修）。
- 抽奖：凭 ID 报名（一 ID 一票）、种子区块创建时写死、结果上链可复算；奖品 20 USDC，X 发帖开奖（玖肆定）。
- 投票：一 ID 一票、结果上链可查。
- 两个应用都在自己的合约里按 Agent ID 去重——就是两键原则的活演示。

**③ 名片页（只读）+ 参与凭证**
- 名片：输入地址 → 显示是否持 ID、name.ai、本人自愿公开的自述/链接（明确标注 self-asserted，不背书真伪）。只允许「地址 → 是不是真人」，绝不做「名字 → 钱包」反查（公告红线）。
- 参与凭证（原「护照」降级版）：不做签到刷分（避开与 AgentPulse 撞车），只沉淀「在接入原语的应用里参加过什么」的可验证记录，是原语的副产品。

**④ Agent 可调用接口（v2 新增，冲应用深度）**
- 把 `isHuman` 包装成 Skill / 只读 API：AI Agent 干活前可自查「对方是不是唯一真人」。对齐币安 Agent OS 的 Skill Hub 方向。
- v1 实现：一个开源小工具（CLI + SKILL.md 说明），读 BSC 注册合约返回结论；不签发任何信任，证据在链上、任何人可复核。
- 社交绑定只做 `tweet` 签名档（公开可复核）；self-asserted 只展示不背书；oauth 不签发（理由：会把证据从链上搬进我们的数据库，与构想前提相反）。其余写进文档当路线图，不开发。

## 2. 竞品情报（2026-11-21 扒过参赛圈）

- 签到类严重同质化（AgentStreak、Agent Check-In、Agent Roll Call 等）；AgentPulse 做签到信誉分；Agent Quest Board 做任务托管市场；Forecast League 做 ID 限定预测赛。
- 差异化共识：满场是「门禁的壳」，没人把设计原理讲深——玖肆的构想文档就是最大差异化。
- 全场都在愁 30 个交互门槛，已有参赛者在公开互助（26/30 求签到）→ 见 §5 互助战术。
- 实用性证据：Ptah 的 Proof of Agent、一批第三方 Mint 已在用注册合约做一人一份——「模式已被真实项目验证、我们把它产品化」写进提交材料。

## 3. 排期（11-21 → 12-08）

| 日期 | 事项 |
|---|---|
| 11-21 ~ 11-22 | 合约（HumanGate + OneIDCampaigns）写完，本地测试通过，BSC 测试网部署跑通 |
| 11-23 ~ 11-25 | 前端（活动列表 / 报名投票 / 名片页）+ Agent 接口小工具；测试网联调，3–5 个 ID 地址试跑 |
| 11-26 | 主网部署 + BscScan 验证 + GitHub 开源（**生死线：没上线就放弃**） |
| 11-27 ~ 12-05 | 运营期：自开抽奖（20U）+ 投票各至少一场；X 发帖拉人；参赛圈互助导流；目标 ≥60 个 ID 交互（门槛 30，留一倍余量） |（⚠️ 已被 2026-11-23 改期决策取代：运营期改为 11-25 ~ 12-03，见文末「上线提前至 11-25」记录）
| 12-03 | 检查点：主网交互 <20 立刻加码（追加活动 + 求转发 + 互助圈总动员） |
| 12-06 ~ 12-07 | 材料：项目名、官网、合约地址、Agent ID 使用说明（含两键原则与已验证行为证据）、交互数据 |
| 12-08 | 提交（不压线） |

## 4. 分工与成本

- **Muse**：合约、前端、接口工具、测试网部署、开源仓库、材料与文案初稿。
- **玖肆**：① 币安 App 领 Agent ID；② 备 BSC 钱包充少量 BNB（主网部署 gas，总计 0.05 BNB 以内；测试网阶段 Muse 用独立测试钱包，不碰你的钱）；③ BscScan 免费 API key；④ 发帖与互助圈露脸。
- **现金成本**：gas 约几十美元 + 抽奖奖品 20 USDC（已定）+ 域名可选。

## 5. 凑交互打法

1. 自有受众：粉丝里领过 Agent ID 的现成人群（「比特币」Mint 那波），发布帖 + 开奖帖两波。
2. **互助战术（v2 新增）**：主动去参赛圈（The Colony、X 参赛帖）与其它项目互相体验、互相导流——他们缺交互、我们也缺，是天然同盟。
3. 找 2–3 个小项目方试用抽奖/投票开真实活动（B 端证据，评审加分）。

## 6. 风险与止损

- 评审主观：按自评 74/100 预期管理——目标前 10（800 档），冲前 3 靠 traction 超预期。
- 多 KYC 地基问题：材料只借官方口径（「按币安官方规则，一个 KYC 仅能领取一个」），不把「唯一真人」说成绝对真理。
- 币安自研风险：叙事只说「最先把锚点做成可用接口」，不自称标准。
- 范围锁死：新想法一律进二期清单。

## 7. 提交材料清单

- [ ] 项目名称、官网链接
- [ ] 主网合约地址（BscScan 已验证、已开源）：HumanGate + OneIDCampaigns
- [ ] Agent ID 使用说明：三层用法（门/去重键/名片锚）+ 两键原则 + 已验证行为证据（Ptah 等）
- [ ] 活动期内 Agent ID 交互地址数（链上可查，≥30，目标 ≥60）
- [ ] Agent 接口工具仓库链接（Skill/CLI）

---

## v3 增补（2026-11-21 用户拍板「全做」）

用户反馈功能太单调、断头路多，拍板全做三项（合约升级为 OneIDCampaignsV2）：

1. **奖品托管自动发放**：创建抽奖时可托管奖品（BNB 或任意 ERC20，托管额 = 每份 × 中奖人数，BNB 走 msg.value、ERC20 走 approve+transferFrom）；开奖后中奖者自助 claimPrize 领奖；未领奖品 30 天后创作者可 reclaim。
2. **新增领取型活动（kind=2）**：创作者托管奖池并切成 maxClaims 等份，凭 Agent ID 一人领一份、即时到账；结束后创作者回收剩余（含除法尘埃）。
3. **闭环**：身份卡加「参与战绩」（Entered/Voted/Claimed 事件聚合 + 中奖标记，只做可验证记录、不做信誉评分，避开 AgentPulse）；新增「我的活动」创作者页（开奖、复制中奖名单、回收、已发放金额）。

状态（2026-11-21 13:00）：
- 合约 OneIDCampaignsV2.sol 已写、本地 4 项测试全过（托管抽奖/ERC20 领取/名额上限/未托管兼容）。
- 测试网已部署：**0xb8e544739b9c79c3180a287d865a7b8a2317311f**（gate 仍为 0x4858…598）。真实试跑全过：带奖抽奖 0.01 tBNB 开奖后领奖到账分毫不差；领取活动每份 0.002 到账分毫不差。
- 前端 v3 已同步（本地文件 7 页 + 托管版更新中）。主网（11-26）直接部署 V2，不再用 V1。
- 注意：publicnode 的 eth_getLogs 单次上限 5 万区块，战绩/我的活动查询已做分段（45k/段）。

## v3 增补（2026-11-21 用户提议）
领取活动新增**拼手气随机金额模式**（用户原话：固定金额领取和随机金额领取，随机就是拼手气）：二倍均值法（每次在保底 1 单位与剩余均值 2 倍之间随机，最后一位拿走剩余，总额守恒），随机源为 blockhash 伪随机——合约与页面均明示只适合小额娱乐局。合约升级 OneIDCampaignsV3（createClaim 加 random 参数、getCampaign 加 claimRandom 字段），测试网 **0x3ba2420457b1254fa632d03190b5189bfa2fffb1**，本地 3 项新测试 + V2 回归全过；真实试跑：0.006 奖池首抽 0.0035（固定为 0.002、上限 0.004）。领取卡片带「手气最佳」标记。主网部署改用 V3。

## 主网上线清单（2026-11-26 执行，逐项打勾）
1. 用户：BscScan 免费 API key 到手（合约验证要用）。
2. 部署 HumanGate（构造参数 = 真实注册表 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F）+ OneIDCampaignsV3 到 BSC 主网；部署钱包留足 gas。
3. BscScan 验证两个合约源码（constructor 参数如实填写）。
4. 前端只改 app.js 顶部配置区：APPS_TESTNET→主网应用地址（变量改名备忘）、NETWORK（appsChainId 56 / appsChainHex "0x38" / appsRpcs 换主网三节点）、APPS_DEPLOY_BLOCK→主网部署区块、TOKEN_PRESETS 换主网 USDT 0x55d398326f99059fF775485246999027B3197955 / USDC 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d、SITE_URL→正式站地址；builders 页地址表同步。
5. 正式站部署本地 web/ 到静态托管（GitHub Pages 优先，仓库已本地备好：README/LICENSE/.gitignore 齐、私钥目录已排除；推送远程需用户 GitHub 账号）。
6. 上线自检：主页查 9nosing.ai 应为真人；建演示抽奖（20 USDC 托管）+ 一场投票 + 一场拼手气领取；各走一遍参加/开奖/领奖。
7. 部署钱包主网 BNB 余款（当初 0.0031 BNB 减实际 gas）退回用户指定地址，附交易哈希对账。
8. 用户发 X 招募帖（双话题），进入运营期（目标 ≥60 交互，12-03 检查点）。

## 优化轮记录（2026-11-21 下午，用户定调「完善、优化优先」）
- 修复：本地 app.js 应用地址曾滞留 V1（ABI 已是 V3）——已改 V3 并新增「用 app.js 自身常量端到端读链」回归检查；X 绑定验证变量名错误（registryMain/chainMain 不存在）已修。
- 可靠性：读写均改三节点 FallbackProvider（quorum 1）；网络配置收敛到 app.js 顶部 NETWORK 一处。
- 性能：事件扫描起点改为 V3 部署区块 143980859；活动列表改并行加载；领取记录查询同改部署区块起点。
- 细节：移动端导航由「隐藏全部链接」改为横向滑动；全站加 og/twitter 分享 meta；筛选卡片补齐 data 属性（此前缺失、筛选实际无效，已修）。
- 回归：合约测试 7/7 + V1 流程脚本通过；前端端到端（测试网 V3 数据 + 主网注册表 9nosing.ai=1）通过。

## v4 增补（2026-11-21 用户提议）
用户指出「分享」与「去 X 讨论」功能重复，改为**发行人帖子链接**：合约 V4 新增 `postUrl`（仅发行人可 setPostUrl、可随时更新，https 前缀、≤200 字符，链上存储人人可读）。活动卡片/详情页在已设置时显示「发行人的帖子」按钮直达该推文串；发布页选填、创建后自动挂上；「我的活动」页可补填/修改。讨论按钮取消。V4 测试网 **0x5f31132bb1ba7d8c119b28b18de6e8f93053ea02**（部署区块 143986149），flow4 两项测试通过，试跑活动 #0 已挂示例链接并完成一笔拼手气领取。主网部署改用 V4。

## v5 增补（2026-11-21 晚 · 第一波：身份与系列）
用户批准头脑风暴六点全做、分三波。第一波已完成：
- **IdentityBindings**（独立合约，刻意与无状态原语分开）：绑定登记上链——合约内重建规范声明（v2：地址小写）并 ecrecover 验签，签名不对/句柄非法都登记不了；`isBindingValid` 供展示前复核。测试网 0xC76847F54Fe3C2ca6eB61e5dd998e11Bd7e5988C。
- **OneIDCampaignsV5**：新增 `series` 系列标签（发行人可设，≤60 字节）+ setSeries/SeriesSet。测试网 0xfFF120c006ceB3487AD61943E4022e15cc8eb923（部署区块 143989951）。主网部署 V5 + Bindings。
- 前端：活动卡片/创作者页/名片页显示已绑定发行人的 @账号 ✓；活动卡加金色系列 chip + 活动页系列筛选；创建页/我的活动可设系列；绑定页新增「登记到链上」；名片页支持 ?a= 公开链接 + 复制链接 + 绑定徽章；详情页新增分享按钮与「生成海报」（1600×900 canvas，含系列/发行人@账号）。
- 合约测试 14 项全过；前端用 app.js 自身常量对三合约端到端复核通过（含合约 statementFor 与前端规范串逐字一致）。
- 注意：规范声明已从 v1（地址大小写敏感）改为 v2（地址小写）——此前任何用旧版绑定的签名都需重签（尚无真实用户绑定，无影响）。
- 第二波（运营期）：MCP + 空投门禁模板。第三波（12-06~07）：白皮书页、Agent 主网演示、90 秒视频。
- 主网上线清单修订：第 2 步部署三个合约（HumanGate / OneIDCampaignsV5 / IdentityBindings）；第 4 步前端配置增加 BINDINGS_TESTNET 主网地址。

## UI 优化轮（2026-11-21 晚 · 用户批准三项最优解）
- **卡片瘦身**：卡片正文从多行 meta 改为一行关键数字（奖品×人数 / 奖池·已领进度 / 选项·票数）+ 发行人/倒计时小字行；主行动（参加/领取/领奖/开奖）改为整行金色大按钮，投票选项改为整行描边按钮组；分享/帖子/详情降为底部分隔线下的小按钮行；已结束卡片整体降饱和（hover 恢复），进行中状态 chip 加绿色呼吸点。顺带删掉卡片上逐个扫 Claimed 日志的「最近手气」块（详情页有完整名单），列表加载更快。
- **首页行动优先**：hero 内新增双大按钮（参加活动 / 创建活动，金色实心 + 描边），实时统计条从跑马灯下方移到 hero 底部（第一屏可见）。
- **名片页名片化**：idcard 改为头像+大名版式——头像由地址哈希生成的 5×5 对称几何图（金色系，确定性生成），大名优先显示已绑定 @handle，否则短地址；全地址与绑定徽章在下方。
- 红线纪律（规则复审结论，长期有效）：① Skill/MCP 永远只读，写操作不进 Agent 通道；② Agent 演示只用项目方自有钱包且明说，不得包装成替用户自动操作；③ 拉人只用真实 Agent ID 持有者，不脚本互刷、不借号凑数。

## 导航重构（2026-11-21 晚）
- 顶部导航由 7 个入口减为 5 个：活动 / 发布活动 / 我的活动 / 身份卡 / 了解▾。
- 「绑定 X」撤出导航：入口移至身份卡页 idcard 下方绑定区（显示当前查看地址的绑定状态 @handle ✓ 或未绑定，按钮进 bind.html 管理）；bind.html 本身保留。
- 「原理」「开发者」合并为「了解」下拉：桌面悬停展开、点按切换（手机端菜单 fixed 于导航下方避开横滑容器裁剪），点外部/Esc 关闭；位于两页之一时父级按钮亮金（子项 .on 传递）。

## 个人主页分工（2026-11-21 晚 · 用户采纳替代方案，未合并两页）
- 讨论结论：不把「我的活动」改成资料页——身份卡已是公开个人主页（名片面），我的活动是创作者操作台（开奖/编辑/回收），展示与操作分开；解决「我的东西太散」靠升格身份卡 + 摘要带，而非合并。
- 身份卡页：连接钱包或打开时静默认出已授权钱包后，若无 ?a= 参数，默认自动加载自己的卡（个人主页化）。
- 我的活动页：顶部加个人摘要带——identicon 头像（与身份卡同算法）、@绑定名或短地址、真人徽章（主网注册表核验）、发行/参加/中奖三计数（链上事件扫描：CampaignCreated / Entered+Voted+Claimed / 已开奖且 isWinner；扫描改串行防公共 RPC 限流）、「查看我的公开主页」按钮（card.html?a=自己）。
- 链上实测（部署者地址，V5）：发行 1、领取 1、参加抽奖 0，与试跑记录一致。

## GitHub 部署记录(2026-11-21 晚)
- GitHub 账号:sijiu94-ship-it;仓库:github.com/sijiu94-ship-it/humangate(公开)。
- 网站已推送:13 个 web/ 文件 + 项目 README(种子提交),main = 43b7192(部署提交)。
- GitHub Pages 已启用(main 分支根目录),网址:https://sijiu94-ship-it.github.io/humangate/ —— 已验证 200,app.js 字节数与本地一致、含 V5 地址。这是测试网配置版,供用户连真实钱包点测;11-26 主网上线时切配置后用同一仓库重新推送。
- 推送方式:VM 的 SSH 出口被代理封死(22 与 443 均 reset),git push 走不通;用细粒度 PAT + Git Data API(curl)推送。PAT 名 humangate-push,仅 humangate 一个仓库 Contents 读写,有效期至 2026-12-21;已重新生成过一次(旧令牌作废)。令牌不存本机,后续推送时向用户索取或走安全提交页。
- 注意:令牌经聊天传递过,赛后建议用户在 GitHub 设置里吊销。
- Mac 上留有 ~/humangate-site/ 文件副本(网页上传方案的中转,已弃用,可删)。

## Wave 2 增补二:名片资料扩展(极简版,2026-11-21 晚用户确认)
- 起因:用户提出让身份卡拥有 Linkter/Linktree 类个人链接主页功能;已核实该品类功能全集(链接聚合、简介、主题、二维码、统计、预约、收款),砍掉统计(中心化埋点,与只读原语冲突)、预约、收款等商业功能,只取极简版。
- 内容:独立小合约(与 IdentityBindings 同理,单独部署,不碰已冻结的 HumanGate / OneIDCampaignsV5 / IdentityBindings):本人登记一句话简介 + 最多 5 条链接(标题 + URL),可改可删;卡页展示时与「已验证」信息分开、明确标注为自述层;入口仍只能从地址进入,不做按名反查。
- 纯前端顺手项(不依赖该合约,可随手做):名片二维码、分享图带二维码、保存联系人 vCard。
- 时机:11-26 主网上线之后、运营期内单独部署,部署后补入提交材料(截止 12-09 16:00 前)。主网三合约清单不变。

## Wave 2 增补三:Agent 参与 Skill(2026-11-21 晚用户确认列入)
- 依据(2026-11-21 已查币安 Web3 官方开发者文档核实):Agentic Wallet 的「开发者模式」支持任意合约调用(baw contract-call preview/execute,binanceChainId 56),--from 即用户 Agentic Wallet 地址(服务器验证所有权),链上调用者就是 Agent ID 地址,能过 HumanGate 且计入交互;开发者模式只能用户本人在币安 App 开启(有时效、有独立每日额度),每笔调用被钱包层强制拆为 preview(解析+模拟+风险提示)→ 用户明确确认 → execute,部分操作还需 App 内批准。币安 MCP(CEX 子账户)无链上权限,已排除。实证:ZAPLO、Horror Protocol、DEEP SWARM 等 Agent 独占门禁铸造已在主网用同一模式跑通,ZAPLO 用 skill 文件分发参与说明。
- 形态:发布 humangate-skill.md(托管在站点),用户把链接发给自己的 Agent,Agent 按文件步骤参加指定活动(enter / vote / claim / claimPrize 均为纯合约调用)。
- 合规护栏(写死进 skill 文件):逐笔 preview、逐笔等用户明确确认后才 execute;一次确认只做一笔;禁止批量参加、禁止定时/自动参加、禁止跳过确认、禁止参加用户未点名的活动;金额以 preview 为准,不重试改数;不收集助记词/私钥/配对码——授权与配对全程在币安官方通道内完成,我们的网站不承载任何登录/配对(红线一不沾)。
- 与既有纪律的关系(重要,勿混淆):纪律①「我们自己的 is-human 校验 Skill/MCP 永久只读」不变;本项是给用户自己的 Agent 看的参与说明文件,执行走币安官方 baw 通道且确认由钱包层强制,不由我们持有会话、不由我们代签——是用户 2026-11-21 明确批准的细化,不是纪律松动。演示口径仍守纪律②:演示只用项目自己的钱包与活动,并明说。
- 已知限制:Agentic Wallet 签消息只支持 EIP-712、不支持 EIP-191,所以 X 绑定走不了 Agent 路径(绑定维持网站端);Agent 路径仅主网(无测试网),无法提前彩排。
- 时机:11-26 主网上线后做;用户本人用 9nosing.ai 先走一遍,该实录同时充当 Wave 3 的 Agent 演示素材。

## Wave 2 排期修订(2026-11-21 晚,用户质询后改)
- 用户问「为什么不能先提前做好」——复盘结论:没有硬性理由。原排序是保守冻结策略(怕新工件干扰三合约与上线清单、且当时 Wave 2 只有 MCP+模板两件低优先项),但四件里三件半与上线合约完全独立,压到运营期的代价是占掉一周运营时间,账不划算。
- 新排期:11-22→11-25 预制——MCP 包装、空投门模板、名片资料合约在测试网写好测好部署好,参与 Skill 写完草稿(占位主网地址);11-26 上线日只做主网部署与填地址;11-27 用户用 9nosing.ai 做 Agent 实测。Wave 2 预计 11-28 前收尾。
- 冻结纪律不变:预制全是独立新工件,不碰 HumanGate / OneIDCampaignsV5 / IdentityBindings 与主网上线清单;上线准备若出问题,预制让路。
- 硬限制仍只有两条:Agentic Wallet 无测试网(参与 Skill 不能提前实测);主网地址 11-26 才存在(填地址与主网部署只能上线日做)。

## 预制进度(2026-11-21 晚)
- 名片资料合约 IdentityProfile 已部署测试网 0x03b4a3129199b16ccf144a100b1fc65f31d907c1(flow6 测试 7/7),前端接线待做。
- is-human MCP server 已完成(agent-tool/mcp/,零依赖 stdio,只读单工具 is_human):实测用户地址 true、零地址 false。
- 参与 Skill 草稿 web/humangate-skill.md 已完成(232 行,主网地址占位符 {{APPS_MAINNET_ADDRESS}} / {{HUMANGATE_MAINNET_ADDRESS}},函数名以 ABI 为准:enterRaffle/castVote/claim/claimPrize,选择器已实算核验)。
- 发现:注册表 balanceOf(0x0) 按 ERC-721 语义 revert,故 HumanGate.isHuman(0x0) 链上也会 revert 而非返回 false——集成方文档需注明;MCP server 对零地址本地短路返回 false,CLI 查零地址退出码 2,口径差异待日后统一(不阻塞)。
- 空投门模板 GatedClaim 已完成(contracts/templates/,flow7 测试 8 项、全套回归 29 passing):测试网演示实例 0x3647a06cec25a6c0152a7f617b7b9a40f1c841e8 已部署注资,部署者真实领取一份成功(claimedCount=1)。
- 至此 Wave 2 四件预制全部完成(资料合约 / MCP / 参与 Skill 草稿 / 模板),剩:资料合约前端接线、26 号主网部署与填地址、27 号 Agent 实测。
- 资料合约前端接线已完成并上线 GitHub Pages(正式站):身份卡页新增「个人主页」展示区(简介+链接按钮,标注自述·已上链·未验证)与本人编辑面板(连钱包且查看自己卡时出现,5 行链接,保存/删除上链)。用前端自身 ABI/地址做了链上 E2E:部署者 setProfile 写入并读回一致(tx 0x0ae1fc2f…),部署者卡现存示例资料可供点测。托管预览版同步中。
- Wave 2 预制全部收尾(四件 + 前端接线),余下仅:11-26 主网部署 IdentityProfile 并填地址(是否随三合约同日上线,25 号由用户定)、参与 Skill 填主网地址、11-27 Agent 实测。

## 钱包菜单修复(2026-11-22)
- 用户反馈:连接后点按钮只能退出、再点直接连回原钱包,无法换钱包。改法:连接后点地址按钮弹出菜单(当前地址 / 切换账号 / 退出连接)。切换账号走 wallet_requestPermissions 重新拉起钱包的账号选择;在钱包内直接换号也会被 accountsChanged 采纳并刷新页面(此前是直接踢下线)。退出连接时尽力 wallet_revokePermissions 撤销本站授权(MetaMask 支持),下次连接会重新询问授权,不再静默连回。
- 顺带修两个潜伏问题:①「登记到链上」按钮的接线原先误置于 connectWallet 内部、未连接时点不动,已移回页面初始化;生成名片图按钮原先重复接线两处,已去重。②切换语言时连接按钮文案会被重置,已接入统一的 renderConnectBtn 重渲染。

## 完善三件(2026-11-22,用户圈定)
- 参加前预检:enterRaffle/castVote/claim 先查 HumanGate.isHuman(与活动同一道门,测试网读 mock 门),非真人不发交易,直接提示+展开领 ID 指南(活动页/详情页已补指南区块);RPC 异常时放行由合约裁决。claimPrize 不预检(中奖者已在参加时过门)。
- 质感批次:withSigner 分段状态(校验中→等待签名→已发送等待上链)+ 操作期间锁定本卡按钮防重复提交;列表/详情骨架屏;活动页「只看进行中」快捷筛选 + 筛选条件会话内记忆;英文版式护栏(导航/按钮不换行、标题断词)。
- 顺带修真 bug:toggleGuide 函数此前缺失(只有调用无定义),导致正式站查真人结果被误报为读取失败、身份卡记录加载中断——已补定义,查真人与身份卡一并恢复。
- 首页查真人经核查早已在 hero 区(检查器+指南),原建议第 8 条作废,无需再做。

## 完善批次二(2026-11-22,用户授权「把你觉得该做的都做了」)
- 身份卡二维码:名片页新增二维码面板(扫码打开本卡),分享图 1200×630 右下角同步印二维码;qrcode-generator CDN 仅在 card 页加载,失败静默隐藏。
- 验奖证书图:抽奖已开奖的详情页新增「生成验奖图」,1600×900 黑金证书(标题/参与/中奖数/每人奖金/种子区块/中奖名单前 10/可复算说明),一键下载。
- 网页嵌入组件:web/embed.js 零依赖,任意站点两行代码嵌入查真人(直读主网注册表 balanceOf,多 RPC 兜底,中英自适应);开发者页新增演示区(当页可试)+ IdentityProfile 地址行。embed.js 与 humangate-skill.md 已随站发布(此前 skill 文件未上站,已补)。
- 白皮书页 whitepaper.html:论点/两键原则/三条边界/安全模型/六条红线合规对照/已知局限(持有者规模、多 KYC 边界、钱包迁移不确定性、「第一个可用接口非标准」定位)/合约地址表;导航「了解」菜单新增白皮书入口,全站 11 页已加。
- 仍需用户本人:第三方采用(文案包在 docs/adoption-pitch.md 备好)、Agent 实景演示(主网上线后)、BscScan Key、域名与上线日决定。

## 我的活动补「我参加的活动」(2026-11-22,用户反馈)
- 问题:mine 页此前只列我发起的活动,看不到我参加的。已补 loadJoined():按 Entered/Voted/Claimed 事件(参与者 topic 过滤)扫描当前地址的参与记录,逐活动读状态——抽奖:已参加/未中奖/中奖待领/奖金已领;投票:已投票+所选选项;领取:已领取+金额。自己发起的活动不重复出现(仍在上方管理区)。未参加时显示空状态。测试网实测:部署者地址扫到 Claimed 事件并被正确归类/过滤。

## 前端审计修复(2026-11-22)
- 审计结论:373 个 i18n 键无缺失、19 个内联处理函数齐全、无重复 id/死链、版本统一。
- 问题1:详情页按钮不看状态——已修:loadDetail 计算 myState(Entered/Voted/Claimed 事件 + hasEntered/isWinner/prizeClaimed),投票仅进行中可点且显示已投选项,抽奖已参加显示禁用态,领取已领显示禁用态,领奖按钮仅中奖未领时出现;移动端吸底条同规则。
- 问题2:零地址查真人误报读取失败——站点检查器与 embed.js 均已短路为「不是真人」(注册表 balanceOf(0x0) 会 revert)。
- 问题3:详情页参与者名单先显示 50 个 +「显示全部(N)」按钮展开。

## 竞品链上/公开调研(2026-11-22)
- **Agent ID 持有人总数 = 263,426**(2026-11-22 经 BscScan 注册表代币页实时核对,Transfers 263,428)。此前白皮书 §06 与提交稿「持有人只有数千」严重低估(差两个数量级),须修正:门禁不窄,30 人门槛瓶颈是触达而非供给。Dune 公开数据亦显示 10-27 累计铸造已超 12.4 万,与此吻合。
- 赛道图景:签到克隆海(Roll Call / AgentStreak ×2 / AgentQuest / AgentWall / AURA Hub / MintGuard,皆为签到+积分+徽章)。领跑者 Agent Roll Call 公开日志 Day 3 已达 35 个独立地址/53 次签到(已过线),路径 = The Colony build-in-public 板块每日日志 + 参赛者互相真实体验。AgentProof(合约安全背书)产品好但 3 天仅 2/30,证明全场瓶颈在触达。免费 mint 拉新最猛(MeoW Cards 1,783 铸造,持有人首铸免费)。AgentPay/AgentERC 做 ERC-8004 信誉桥接;AURA Hub 发代币买量。
- 值得借鉴:①上线后去 The Colony 连发 build-in-public 日志并真诚体验同行项目(符合纪律③);②首发领取活动用「创世/限量/持有人专属」框法;③文案学 AgentProof 一句话说清成本(约 1 美分 gas、不动资金)。不学:积分信誉分、发代币买量、按名解析支付。
- 注:各家合约参与人数因公共 RPC 限流未能逐一自查,别家数据取自其公开日志与官网;持有人总数为 BscScan 实时读数。

## 持有人数据修正(2026-11-22)
- 白皮书 wp6_1(中英)、提交稿「如实说明局限」、采用 pitch 的问答口径三处已统一改为:持有人超 26.3 万(2026-11 注册表数据)、供给不窄、真实局限是触达/冷启动。已推送正式站(GitHub 45c37100)并验证生效。

## 竞品借鉴与冲奖打法(2026-11-22,用户定调:为获奖而战)
- 从竞品学到的机制:①Roll Call 的节奏引擎——每日回访产生重复交易(增长奖按地址数+交易量/笔数加权),且靠 The Colony build-in-public 每日日志 + 参赛者互相真实体验过线(35 人);②AgentProof 的摩擦文案(约 1 美分、不动资金、无需授权);③免费 mint 簇的稀缺框法(限量/首发/持有人专属);④AgentWall 的 Founding 前 30 稀缺叙事;⑤公开点名 .ai 参与者的社会证明。
- 我们的打法:创新奖为主(原语+经济层+可复算开奖是全场独一份),增长奖顺带抢——上线运营期开「每日真人局」领取系列(系列功能现成)制造回访节奏 + 每周抽奖;The Colony 每日日志由 Muse 拟稿、用户发布,日志标题带计数器(真人参与数/已发放 USDC);各入口加一句话成本说明;上线后用户用 9nosing.ai 走同行互访圈(Roll Call/AgentProof/AgentWall 等,真实使用、符合纪律③);创世赛季参与者在名片上显示可验证的「创世参与」标记(属已验证事实陈述,非信誉分,主网活动 ID 定后前端小改)。
- 弹药提案(待用户拍板):每日局约 5 USDC/天 × 9 天 ≈ 45U + 抽奖 20U × 2 场 = 总计约 85 USDC + gas。
- 明确不学:积分/信誉分(撞 AgentPulse 且违背定位)、发代币买量、留言墙/打赏(支付方向,出界)、按名解析。

## 真人远征 QuestPass(2026-11-22,用户拍板按推荐方案)
- 用户否决「每日局只是带门禁的水龙头」的自我批评后,拍板旗舰方案:七日集邮 + 终章大抽奖 + 平行少数派投票,专用合约路线。
- QuestPass.sol 已完成:赛季形状构造时写死(7 天×24h 印记期、每日子池双均值拼手气、名额/日、≥minStamps 进终章、报名窗后 lockFinaleSeed 锁定种子块、Fisher-Yates 可复算开奖、奖品托管自助领取、入场窗+30 天后创作者回收余款);无 owner,创作者唯一权力是期末回收。测试 flow8 7/7,全套 36 passing(含链下复算与链上中奖一致)。
- 测试网已部署 0x45e5027047173b948baee49b3cda03e91b8eda25(块 144137802,彩排参数:BNB 池、minStamps 2、报名窗 1h),实测:第 0 天印记领取到账 0.001012 tBNB、同日重复领取被拒、计数/位图/日账一致。
- 前端:新增 expedition.html 远征页(赛季数据条、7 枚印记进度点、按阶段渲染的行动按钮、终章名单与中奖标记、玩法说明,中英双语),名片页加远征进度盒,导航下拉加「远征」入口;正式站已推送(GitHub 7a4132e9)并验证生效。
- 主网参数(已写入提交稿):印记池 2 USDC/天 ×7、终章 45 USDC(3×15)、少数派投票 15 USDC,总 74 USDC;QuestPass 加入主网部署批次(第 5 个合约),提交材料合约表已加行(占位符 {{QUEST_MAINNET_ADDRESS}})。

## 排期修订二 + 完善期(2026-11-22,用户定调)
- 用户定调:主网不着急,12 月前上线即可;现阶段把项目完善到最好,为了拿奖、不赶工程。原 11-26 生死线放宽。
- 时间账(已向用户说明):提交截止 12-09 16:00,赛季 9 天(7 印记日 + 报名 1 天 + 开奖),倒推上线最稳 11-27/28;11-29 为极限(终章开奖撞提交日),11-30 不可取。
- 完善期清单(按奖项价值排序):①主网发射包(部署脚本带 CONFIRM 锁 + 上线手册,五合约含 QuestPass 的 59 USDC 托管 approve 流程)——已派工在做;②五合约安全自审复查(对照六条红线);③少数派投票结算包(链上复算计票 + 发奖名单脚本 + 规则文案);④Colony build-in-public 日志前三天稿 + 上线帖定稿;⑤README 补全(QuestPass/Profile/MCP 尚未写入);⑥名片「创世参与」标记预制(主网赛季地址定后接线,先按测试网地址预制);⑦前端最后一轮通读(双语文案/空状态/移动端)。
- 关键路径提醒:BscScan API Key 已成关键路径(无 key 则上线当天合约验证只能手动慢办);域名与上线日(27/28)仍待用户定。

## 上线日确定 + 条件引擎提案(2026-11-22)
- 用户拍板:主网上线日 = 2026-11-27。赛季时间轴:startAt 11-27 12:00 → 印记期 11-27~12-03 → 终章报名至 12-05 12:00 → 开奖 12-05 → 提交 12-08,缓冲 3 天。(⚠️ 本条已被 2026-11-23 决策取代:上线提前至 11-25,新时间线见文末记录;本条保留为历史。)
- 用户提出:推特抽奖常要求先关注发行人,我们的活动谁都能参加,能否设置参加条件以提升实用性。已向用户说明:「关注」是 X 服务器里的关系数据,链上无法验证,凡称能自动验关注者皆靠中心化服务器查 X 接口(与用户既定的无服务器证明路线冲突)。可做的真条件引擎(全部链上可验、进入时由合约检查):①必须已绑定 X(IdentityBindings 有登记且复核有效)——最接近推特抽奖玩法:参加者都有公开 @账号,关注与否任何人可在 X 公开核对,且进场前先绑定本身即给发行人带去真实关注路径;②持币门槛(任意 ERC20/ERC721 余额 ≥ 设定值);③参与过指定活动(本合约 hasEntered);④远征印记门槛(QuestPass stampCount ≥ N,跨合约读)。实现路径 = OneIDCampaignsV6:_join 在真人检查后逐条验条件,创建表单加条件区,卡片/详情显示条件徽章,参加前预检并说明不满足哪条。等待用户选范围(全上/只加绑定/暂缓)。

## 主网发射包完成(2026-11-22)
- scripts/deploy-mainnet.js + LAUNCH-RUNBOOK.md 已交付并验证:安全锁(CONFIRM_MAINNET 必须精确为 YES,否则只演练)、五合约顺序部署(HumanGate→V5→Bindings→QuestPass→Profile 可选)、QuestPass 59 USDC 托管的 approve-预测地址流程与 flow8 测试同款、部署后逐项断言、产出 mainnet-address.json。
- 演练模式实跑 3 次(只读):注册表与 9nosing.ai 主网状态正常、主网 USDC 精度实测 18 位、总 gas 估算约 0.00035 BNB,部署钱包 BNB(0.0031)足够。
- 发射前置条件(脚本标红):部署钱包 USDC 余额为 0,上线前需用户转入 59 USDC(远征托管);另创世抽奖 20 USDC 托管与投票发奖 15 USDC 为运营资金,可随后到位。
- 手册已按真实 grep 枚举全部前端切换点;新发现:builders/whitepaper 的合约地址表尚无 QuestPass 行,手册已列为上线动作;hardhat-verify 未装,手册给出 CLI 与标准 JSON 两条验证路线。

## 安全自审复查(2026-11-22,完善期第 2 项完成)
- 范围:五合约(HumanGate/V5/Bindings/Profile/QuestPass)+ GatedClaim 模板 + 全站文案 + 参与 Skill。QuestPass 为上次审计后新增,本次逐行复读;其余合约自上次审计未改动,做模式复扫。
- 结论:无违规、无高危。复扫确认:全仓无 MaxUint256/无限授权(前端授权仍为精确定额)、五合约无 Ownable/onlyOwner/owner()、全站与 Skill 无收益承诺类措辞、参与 Skill 护栏原文在位。
- QuestPass 逐项核过:领印记先记账后付款 + 重入锁;双均值边界(remaining ≥ slotsLeft 不变量成立、无下溢、cap 不为零);终章 n=0 时开奖优雅落空、奖金留待回收;种子锁定任何人可调但种子在出块前不可知,定时锁定无套利;claimPrize 先标记后付款;reclaim 创作者限定 + 一次性 + 报名截止 +30 天。
- 唯一补强:提交稿 2b 原未明说 QuestPass 的创作者期末回收权,已补一句完整披露(红线 4:owner 权力必须写明),本地提交。
- 已知口径(与 V5 相同,非缺陷):托管记账假设标准 ERC20;扣费型代币不在支持范围,主网用 USDC 无此问题。HumanGate.isHuman(零地址)会回滚(注册表 ERC-721 语义),前端与嵌入组件已短路处理。

## V6 条件引擎(2026-11-22,用户拍板四种条件全上)
- 合约 OneIDCampaignsV6 = V5 + 条件引擎:Conditions 结构体在创建时写死、之后不可改;_join 在真人校验后、去重标记前逐条检查,失败抛 ConditionFailed(0..3) 且不消耗名额。四种条件:0 必须绑定 X(bindings.isBindingValid)、1 持币门槛(任意 ERC20/ERC721 的 balanceOf ≥ gateMin)、2 参加过指定活动(同合约 hasEntered,创建时校验编号必须指向更早的活动)、3 远征印记(指定 QuestPass 的 stampCount ≥ minStamps,1..7)。构造多传 bindings 地址(可为零,则条件 0 不可用)。
- 「关注」不做条件(理由写进合约注释与提交稿):关注只在 X 服务器上,链上不可验;绑定条件是它的无信任半边。
- 测试:test/flow9.test.js 8/8(四条件各自的拒绝→满足→放行、失败不消耗名额、投票/领取同样受门、组合条件、创建参数校验),全套 44 项通过。
- 测试网部署 0x90333a04b15952590f3e4084a91aa8297d57bda6(tx 0xaef061f7…,运行时 15194 字节);真实试跑:开放场/绑定场/前置场参加成功,印记场(要求 2 枚、部署钱包只有 1 枚)被链上拒绝且名额未消耗。
- 前端:APPS 切到 V6;创建表单新增第 4 节条件区(四个开关 + 字段);卡片与详情页显示金色条件徽章;参加预检在真人校验后逐条查条件并点名差哪条(m_cond_0..3);缓存 v=1121n;GitHub 1fe32d03 已推送并验证上线。
- 发射包待同步:deploy-mainnet.js 部署顺序需调整为 HumanGate→Bindings→V6→QuestPass(→Profile),已派工更新并重跑演练。

## 发射包 V6 同步(2026-11-22)
- 应用合约由 OneIDCampaignsV5 换为 OneIDCampaignsV6(条件引擎版,测试网 0x90333a04b15952590f3e4084a91aa8297d57bda6)。V6 构造参数为两个:(gate, bindings),故主网部署顺序改为:① HumanGate(registry) → ② IdentityBindings(无参) → ③ OneIDCampaignsV6(gate, bindings) → ④ QuestPass(仍走 approve 预测地址 + 实时 nonce 重读机制,偏移不变:approve +3 / 部署 +4)→ ⑤ IdentityProfile(仅 INCLUDE_PROFILE=1,+5)。
- scripts/deploy-mainnet.js 已同步:新顺序与 nonce 编排、V6 双参数构造、post-deploy 新增断言 appsV6.gate() 与 appsV6.bindings() 均指向刚部署的地址;mainnet-address.json 字段 appsV5 改名为 appsV6(appsTx/appsBlock 不变)。CONFIRM_MAINNET=YES 安全锁与全部 pre-flight/post-deploy 断言保留。
- LAUNCH-RUNBOOK.md 已同步:合约清单与部署顺序、BscScan 验证命令(V6 改为双地址参数、验证顺序随部署顺序调整)、上线记录表、少数派投票与提交材料处的合约名、gas 估算数字刷新。前端配置切换一节按约定不动(apps 地址仍是同一个单点开关)。
- dry-run 复跑(2026-11-22,只读、未签名未广播):新顺序与预测地址正常打印;注册表样本余额 = 1、USDC 精度 = 18 复核通过;部署者 USDC = 0 仍被标红 INSUFFICIENT(59 USDC 托管待转入);BNB 检查 OK。全批 gas 估算 7,581,014(不含 Profile;含 Profile 8,311,580,V6 运行时 15,194 字节、部署估算约 337 万 gas,比 V5 大)。

## 创世参与标记 + 前端终审(2026-11-22,完善期第 6、7 项完成)
- 名片远征面板:印记 ≥1 或已报名终章的地址多一个金底黑字「创世参与」标(事实标记,非分数);分享图同步加一行金色 GENESIS EXPEDITION · n/7。数据来自 QuestPass 实时读取,主网只需随 QUEST 地址切换即生效,无新配置点。
- 前端终审(自动审计):434 个在用 i18n 键在中英词典中均有定义;全部内联处理函数有定义;无重复 id;无断链;12 页 app.js 版本统一 v=1121o;无 console.log/TODO 残留。第一轮审计报的 5 个「缺失键」经原文 grep 复核为提取误差,键都在。
- 至此完善期清单 1–7 全部完成(发射包、安全自审、投票结算包、Colony 稿、README、创世标记、前端通读)。剩余:少数派 0 票口径待用户拍板;用户侧 BscScan Key / 域名 / 59 USDC 前置。

## Etherscan V2 免费 key 实测(2026-11-22,上线前置关闭一项)
- 用户已在 etherscan.io 创建免费 API key 并交付(key 值不落盘、不入仓;存于用户 Etherscan 账户,随时可复制;上线时以环境变量 ETHERSCAN_API_KEY 注入)。
- 免费 key 对 chainid=56 实测(2026-11-22):contract 模块全通——getabi、getsourcecode 均返回 status 1;verifysourcecode 探针返回参数级错误「Missing OptimizationUsed」而非免费拒绝,证明验证接口本身接受免费 key 调 BSC。account 等数据查询接口返回「Free API access is not supported for this chain」——门是按接口族分的,不影响验证。
- 结论:上线日验证路线定为 hardhat-verify + Etherscan V2(chainid=56);BscScan 网页手动验证/Sourcify 仅作备份,不再是并列首选。

## 上线日奖池复核(2026-11-22 用户定)
- 用户要求:59 USDC 先不转,11-27 上线日当天再提醒,届时一起看奖池要不要改(远征 59=14+45、创世抽奖 20、少数派 15)。QuestPass 金额部署时写死,顺序必须是:先定金额 → 再改参数/文档 → 再部署。
- 已设定时提醒:2026-11-27 上午约 09:40(上海时间,cron humangate-launch-pool-reminder,归黑客松目标),赶在 12:00 开季之前。(⚠️ 上线已提前至 11-25:奖池复核与资金到位随之提前,资金截止 11-25 10:00;提醒 cron 需由主会话改至 11-25 约 09:40,见文末记录。)

## V7:白名单 + 投票奖池(2026-11-22 用户拍板,当日建成)
- 起源:用户提两想法——①抽奖加名单分支(发布者定名单,只有名单内能参加);②投票可带奖池(投票人随机得奖,发布者定发放人数)。Muse 评估后建议合并一个版本,用户批准「先把这两个做出来」。
- 合约 OneIDCampaignsV7(= V6 + 两项,contracts/OneIDCampaignsV7.sol):
  - 条件 4 名单制:Conditions 增 allowRoot(默克尔根,创建时写死);参加/投票/领取三入口签名增 bytes32[] proof 参数(无名单时传空数组);叶子=keccak256(地址打包)、节点排序拼接哈希、落单上提——合约/前端/试跑脚本同一构造。失败回滚 ConditionFailed(4),不消耗名额。
  - 投票奖池:createVote 增 (prizeToken, prizeTotal, prizeWinners, seedBlock) + payable;奖池托管进 pool 字段;开奖复用抽奖同一套种子区块 + Fisher–Yates(对象=全部投票人,与所投选项无关——口径:参与答谢,不是为某一边出价);每人份额开奖时定为 pool/实际中奖数;claimPrize/reclaim 扩展到带奖池投票(30 天窗口、尘埃归创作者回收)。纯投票(奖池 0)行为与 V6 一致,draw/reclaim 仍回滚。
  - 安全口径:两项都只复用已审计过的托管/开奖/领取零件;名单只是发布者自己的规则(两键原则下属调用方策略),不触三条边界。
- 测试:test/flow10.test.js 7/7(名单拒/错证明/纳、失败不消耗、三入口都受名单管、投票奖池 BNB 全流程 + 链下复算一致、人数少于名额时一人拿全池、创建校验、ERC20 奖池 + 30 天回收);全套 51 项全绿 + flow 脚本过。
- 测试网部署:0xfdcb5240fe2bba8d0dd7b325082dc2d8697f0a8f(runtime 16,540 B,tx 0x868db2c9…c90b2,v7-address.json)。
- 真实试跑两轮全过(scripts/trial-v7.js):名单抽奖 id 0/2(名单=[部署者, w1];w2 是真人但不在名单,静态调用回滚 ConditionFailed(4)、链上 hasEntered 恒 false;名单内凭证明进入)、奖池投票 id 1/3(池 0.0015 tBNB、2 名额、3 人投票 2:1,开奖每人 0.00075,首位中奖者领取到账、paidOut 对齐)。
- 前端:APPS_TESTNET 切 V7;发布表单新增名单制(粘贴名单→浏览器算根→创建后自动下载名单文件并本地存档)与投票奖池开关(代币/总额/名额);详情页加名单面板(导入名单、根值对照 ✓/✗、我的地址在不在名单内);卡片与详情页的投票奖池开奖/领奖按钮、条件筹「名单制」、预检 m_cond_4;双语键齐(453 键审计,唯一「缺失」是 m_cond_ 动态前缀误报)。app.js 抽查实测:前端默克尔根与链上 conditionsOf 根逐字一致。
- 参与 Skill 签名更新:enterRaffle(uint256,bytes32[]) 0xf328ecd3、castVote(uint256,uint8,bytes32[]) 0xd92202f8、claim(uint256,bytes32[]) 0x2f52ebb7、claimPrize 不变;新增 6.0 节名单证明构造说明(用户须提供名单,拿不到就停)。
- 发射包已同步 V7:deploy-mainnet.js 部署顺序不变,dry-run 实测总 gas ≈ 7,873,997(≈0.00039 BNB),predicted 地址随 nonce 不变性保持;RUNBOOK gas 行与少数派段落已改(本场少数派仍用无奖池纯投票 + 人工结算)。
- 提交稿/README 已同步 V7(测试网表新增 V7 行、V6 降为前代;测试数改 51 项)。
- 待办不变:GitHub Pages 推送需用户再给一次 PAT;主网批次合约自此为 V7(11-27 按发射包执行)。

- NFT 门槛体验修复(2026-11-22 晚,用户看截图后指出并拍板修):原「这是 NFT」勾选孤立无输入、勾了没动静。已改:勾 NFT 自动打开持币门槛、其下显示 cd_721_hint 说明小字(地址填 NFT 合约、数字填个数、参加时查 balanceOf)、数量框 placeholder 随 NFT 状态在 1/100 间切换。生产站已改(create.html + app.js,缓存版 v=1121q),托管空间同步中。口径备忘:持币门槛只支持 balanceOf 直返个数的 ERC721 类,ERC1155(需 token id)不支持——已在回复中如实告知用户。

## V8:投票选项文字上链(2026-11-22 晚)
- 起因:用户实测指出投票没法设置选项内容——表单只有「选项数量」,合约只存数量,选项文字无处可填,卡片/详情只能显示「选项 1/2」。设计漏项,已认。
- 合约 OneIDCampaignsV8(= V7 + createVote 增 string[] optionLabels 参数):数量须与 optionCount 一致、每项 1–60 字节、创建时存入 _optionLabels 且不可更改,新增 optionLabelsOf(id) 视图。编译踩坑三连:参数增至 10 个后 createVote 栈溢出(把 Campaign 入栈拆到 _pushVote、CampaignCreated 改由 helper 发出、标签校验/存储拆到 _storeLabels)、calldata 嵌套动态数组不能整表赋存储(改逐项 push)。运行时 17,242 字节。
- 测试:test/flow11.test.js 6/6(存取/数量不符/空与超长/60 字节边界/按下标计票/带奖池全流程/抽奖活动无标签);全套 57 项全绿。
- 测试网部署:0xc1673134d18ac881bd4c61ecf82e5e35a32c9a56(部署区块 144202589)。实测试跑两轮全过:带文字投票(支持/反对/再想想)计票 2/0/1;带奖池投票(红方/蓝方,0.001 tBNB)开奖+领取分毫不差(首跑开奖被试跑脚本的过期 now 坑了一次——种子区块未到误判 NotEnded,补跑 trial-v8-finish.js 通过,usedFallbackSeed=false)。
- 前端:APPS_TESTNET 切 V8、APPS_DEPLOY_BLOCK=144202589、缓存版 v=1121r;发布表单选项数量联动生成逐项文字框(validateCreate 校验非空/≤60 字节);活动卡、详情页、我参加的记录都显示真实选项文字(LABELS 缓存 + voteLabels/optText,读不到时回退「选项 N」)。前端自抽配置回归通过(实时读回两场试跑活动的文字与奖池状态)。
- 文档/发射包:submission-draft、README、LAUNCH-RUNBOOK、deploy-mainnet.js 全部同步 V8;dry-run 全批总 gas ≈ 8,026,812(V8 部署步 3,812,223)。主网发射批次自此改部署 V8。

## 改名：HumanGate → BeCounted（2026-11-22 晚，用户拍板）
- 起因：用户指出「Gate」在中文币圈语境里就是 Gate.io 交易所（芝麻开门），独立基础设施项目用它容易被误认成交易所生态产品；助理认同并主持改名轮。共验 22 个候选（HumanKey/HumanPass/TwoKey/TrueCount 等均撞名），最终选 **BeCounted**：源于两键原则的第二把钥匙「计数」——每个真人在每个活动里只被数一次；英文习语 "stand up and be counted"（算我一个）兼有情感含义。子域名随之改为 becounted.9nosing.com。
- 执行（同晚完成）：合约 HumanGate.sol → BeCounted.sol（isHuman 接口名不变）；IdentityBindings 规范声明首行改为「BeCounted X binding」；全仓文案/前端/文档/Skill 文件（humangate-skill.md → becounted-skill.md）/embed 属性（data-becounted-check）统一替换；57 项合约测试全绿 + flow 脚本通过。
- 测试网新栈（becounted-stack-address.json）：BeCounted 0x0cb41f96c84df7bed5db273e77b62414b1a80cbd、IdentityBindings 0x6e17c5ddc3be1cb4443b6cbb64c1b520fd80d5f2、OneIDCampaignsV8 0xf197907879833d4bb507963a9bae5f3172f550f3（部署块 144221089）、QuestPass 演练季 0x90c3320557db7540a5899e7d3bc0577e399ec378、GatedClaim 演示 0xe216ddd066e2cae40cead9000307f411bf55dc28。试跑全过：@becounted_demo 绑定有效、带标签投票计票 2/0/1、远征第 0 天印记、模板领取；部署者演示资料已改为「BeCounted demo account」。
- 发射包已同步：deploy-mainnet.js dry-run 显示 BeCounted 批次，总 gas 与之前一致（部署顺序 BeCounted → Bindings → V8 → QuestPass）。
- 遗留：GitHub 仓库改名（sijiu94-ship-it/humangate → becounted）与 ~/workspace/tools/gh_push.py 的仓库名在下次推送时一并改（需用户再贴 PAT）；托管空间 slug 仍为 humangate（平台 slug 不可改，仅预览用，内容已同步新品牌）；11-27 奖池提醒 cron 标题仍写 HumanGate（仅标题，不影响内容）。

## 品牌标志：金盘（2026-11-22 定稿）

- 选型过程：SVG 手绘概念（正字/划线/勾选）被否 → AI 多批（印章、点阵、举手人群、数字人「1」、吉祥物、双钥匙 3D、铜符、算筹等）均未定 → 用户给出方向：以 GitHub 章鱼猫式剪影画「双钥匙 + 一个人」→ 交叉双钥在人后的构图（带武侠气）被用户看好 → 按用户要求改外黑内白 → 再换币安黄。**定稿 = 金盘版**：黑底上币安黄（#F0B90B）圆盘，盘上黑色真人剪影，身后交叉双钥。
- 标志释义（用户确认版，白皮书 §08 与提交稿 §一已同步）：中央是真人——验的始终是人，人站在最前面；身后交叉双钥 = 两键原则（身份键验真人、计数键防重复），如侠客双剑守护每场活动的公平；金盘如印——被数上即为印记，与远征每日印记呼应，金色取所建生态之色，圆取「一个不多、一个不少」。一句话：一人、双钥、一印——算我一个。
- 落地（同晚完成）：源图 1600×1600 经 scripts/make-icon-assets.py 生成 favicon.ico / favicon-16/32/48 / apple-touch-icon 180 / icon-192 / icon-512 并重做 og.png（1200×630，金盘 + BeCounted + One Human. One Entry. + 一人·双钥·一印）；scripts/patch-icon-links.py 给 12 页统一加图标链接与 theme-color、导航品牌区换为标志图（.brand-ic）；scripts/patch-whitepaper-mark.py 给白皮书新增 §08「标志 / The Mark」（wp8_h/wp8_1..3 中英双语键 + 512 图）。og:image 仍为相对路径，上线时随域名改绝对地址（发射清单已有此项）。

## 域名绑定与全站地址切换（2026-11-23）

- 用户完成 Cloudflare CNAME（becounted → sijiu94-ship-it.github.io，代理关闭）+ GitHub Pages 自定义域名设置；Muse 实测：DNS 解析正确、HTTPS 200、HTTP 自动跳 HTTPS。
- 用户曾问 becounted.9nosing.com 是否过长；核查 becounted.app / becounted.io 均未注册可作平替，用户最终拍板沿用 becounted.9nosing.com（根域名是人、子域名是项目的结构优先）。
- 本地 web/ 已全量切换：app.js SITE_URL、embed.js 两处、builders.html 示例、12 页 og:image 改绝对地址并新增 og:url、新增 web/CNAME；docs/submission-draft.md 与 adoption-pitch.md 的官网地址、LAUNCH-RUNBOOK 的域名/PAT 条目、check-frontend-config.js 的演示资料链接均已同步。gh_push.py 已补 becounted-skill.md、CNAME 与全套图标文件（PNG/ICO 走 base64 blob）。以上随下一次 PAT 推送一并上线。

## 待办决定记录（2026-11-23）

- **浅色（白色）主题：暂不做**。用户问是否有必要加白主题，Muse 给出否定意见（受众为币圈深色习惯、金盘品牌为黑底设计、双主题维护成本在上线周不划算、无真实用户反馈），用户拍板「先不做，上线后再说」。站点颜色为 CSS 变量驱动，上线后如需补做成本可控。
- **少数派投票 0 票规则：保持字面规则**（2026-11-23 用户拍板，不采纳「只在有票选项里取最少」的建议）。得票最少（含 0 票）即为获胜方；若获胜选项为 0 票则无人可领、不改判给有票一方，结算时如实公示。结算脚本 settle-vote.js 本就按字面规则实现并带 zeroVoteEdgeCase 标记，规则文档 docs/minority-vote-rules.md 第 20 行已有披露，无需改动。

## 2026-11-23 视觉 QA 轮（真浏览器桌面端复核后修复）
- 首页演示：批量查询改 20 条分片（dataseed 对 100 条 batch 有硬限流 -32005，托管版先踩到）；修演示区字面 \u2298/\u00b7 未转义文本；演示列表加深色细滚动条。
- 日志扫描硬化：getLogsChunked 改为逐块轮换 RPC+20 秒超时赛跑+最多 6 次尝试（原 FallbackProvider 单点无超时，浏览器里出现统计后两项长期破折号、动态不可用）；loadFeed 改走同一通道；loadPlatformStats 加并发锁。本地复刻验证：humans=3、payouts=0。
- create 页：表单+预览改桌面双栏（预览右侧吸顶，≤900px 回单栏）；修 .f-row input{width:100%} 把复选框拉满整行的问题（checkbox/radio 宽度 auto+金色 accent）。
- expedition 页：.stats 此前根本没有 CSS 规则、四个数据竖排——补 4 列网格（手机 2 列）。
- card 页：.wrap 提前闭合导致指南/参与战绩区块脱离居中容器（与首页数据条同类 bug）——闭合标签移回 </section> 前。
- 未验：真浏览器工具无法调视口，390px 手机宽度未做真机复核（CSS 侧静态审计已过）；统计/动态在浏览器侧的最终确认以下一轮线上复验为准。
- 教训（2026-11-23 QA 复验）：style.css 此前无版本号，浏览器启发式缓存导致 CSS 修复对回访者不生效（真浏览器复验 create/expedition 两项因此误判未修）。已给全站 style.css 链接加 ?v= 版本号；今后每次发版 app.js 与 style.css 版本号必须同步递增。

## 2026-11-23 V9：自定义链下奖品 + 预设链名标注（用户截图反馈）
- 用户指出奖品下拉两问题：预设币没标哪条链；缺自定义奖品（如白名单）。已落地：
  - 预设标签动态标注链名（USDT · BSC 测试网（预设），主网切换后自动变 BSC 主网，随 NETWORK.appsChainId 走）。
  - OneIDCampaignsV9 = V8 + Campaign.prizeLabel（createRaffle 尾参，≤80 字节；与托管奖品互斥；claimPrize 对 0 奖品加守卫）：自定义奖品不上链托管，说明上链存证、中奖名单链上开奖、发起人链下发放。createRaffle 因加参爆栈，拆 _createRaffleCore 解决（字面量构造保留在 core 内）。全套测试 82 项全过（当时为 74 项，BindingsV2 批新增 8 项后为 82；新增 flow12 V9 标签套件克隆 + flow13 V7 套件克隆至 V9 + 自定义奖品 4 项）。
  - V9 已部署测试网 0x1ebff25f093c798ea301008b13c54fbc00348aec（块 144329082，运行时 17,666 字节）；试跑：带标签投票 id 0（2/0/1，7 天期）、自定义奖品演示抽奖 id 1（标签「白名单名额 ×1（演示）」读回一致、1 人参加）。前端配置/ABI 已切 V9，回归全过。
  - 发射包已切 V9：deploy-mainnet.js dry-run 总 gas ≈ 8,119,689（不含 Profile）；runbook/提交稿/白皮书/建造者页/README 地址与版本已同步。主网发射批次部署 V9（原 V8 计划作废）。
  - 顺手修 f_prize_hint 过时文案（原写「合约从不经手资金」，与 V2 起的托管设计相反）→ 改为托管+30 天回收口径。

## 2026-11-23 下午 · 第二轮找问题 + 修复批
用户再令「找问题、大胆说」后列出 7 条，按可立即执行的三件先做（USDC 备资用户明确说最后再说；拉人/公示/分享链接/手机真机在其侧）：
1. **终章演练**：查实演练季参数与主网不同——minStamps=2、报名窗仅 1 小时（11-29 21:28→22:28）。已写阶段机脚本 `scripts/rehearsal-quest.js`（按 phase() 自动领印/报名/锁种子/开奖/领奖，幂等），并设定时任务 `becounted-rehearsal-quest` 每日 21:40 CST 自动推进（goal-owned），预计 11-30 跑通终章全流程；跑通后由主会话删除该任务。部署者现 1 枚印记，今晚自动领第 2 枚即达标。
2. **验证彩排完成**：Sourcify v2 API 对测试网三件核心合约（OneIDCampaignsV9 0x1ebf…8aec、BeCounted 0x0cb4…0cbd、QuestPass 0x90c3…c378）全部 **exact_match**。教训：`compilerVersion` 必须用长版本号（0.8.24+commit.e11b9ed9），短号报 compiler_error。`hardhat-verify` 已安装接线（config 读 `ETHERSCAN_API_KEY` 环境变量；复核 config 内未存任何 Key——此前主会话「Key 存在本地配置」的说法不成立）。手册 §3 已更新为三路线（A hardhat-verify 优先拿 BscScan 绿勾；C Sourcify 兜底，注明其 ≠ BscScan 验证）。
3. **首页统计性能**：`loadPlatformStats` 原为从部署块全量扫日志（QA 实测约 30 秒且随链增长恶化），已改为直读合约（campaignCount/getCampaign/getEntries/getWinners/prizeClaimed 计算真人数与发放笔数），本地实测同口径结果一致（真人 3、发放 0）且约 1 秒完成。版本 1121x→1121y（12 页 + app.js），本地提交 08cf1aa；GitHub 推送待用户再贴 PAT，托管版同步进行中。遗留（已记未修）：名片记录页与详情页仍有从部署块起的定向日志扫描（按地址/活动过滤，量小，主网久跑后可能变慢，上线后视情况再优化）。
4. 查实：部署者主网 USDC 余额 = 0（BNB 0.0031 够 gas）；备资时点用户定为最后再说，11-27 09:40 奖池复核提醒不变。（⚠️ 后续修订：上线提前至 11-25，资金截止改 11-25 10:00，且 BNB 需补至约 0.013，见文末记录与 LAUNCH-RUNBOOK 第 1 节。）

## 2026-11-23 下午 · 币安 App 实测（用户真机）颠覆性发现
用户按建议在币安 App 内置浏览器打开正式站实测，结论（已据此改站/改手册）：
1. **App 内浏览器连接的永远是币安的私钥 Web3 钱包，不是 Agentic Wallet**；切链时网站（当前测试网配置）触发「添加测试网」；「切换钱包」无反应。Agentic Wallet 不向第三方网站开放连接——与比赛红线 1 的设计一致：**真实持有人在网站上永远连不上自己的 Agent ID 地址，网站 enter 流程对他们天然不通**。持有人参与的唯一通道 = Agent 参与 Skill（Agentic Wallet 无测试网，上线后才能首测）。
2. **参与 Skill 原只覆盖活动合约、完全没写 QuestPass**——旗舰远征对真实持有人原本不可达。已补 §6.5（claimStamp/enterFinale/claimPrize + 状态读，选择器齐备；锁种子/开奖仍归项目方，不在参与者 Agent 范围）。主网填址时新增 `{{QUEST_MAINNET_ADDRESS}}` 占位符。
3. **手机导航真 bug**：连接钱包按钮原在可横滑的 .nav-links 容器内，手机上被挤出屏幕需左滑才见。已把语言切换 + 连接按钮移出滚动区并钉住（12 页 + CSS），版本 1121z。
4. **误导文案已改**：guide_4 原「连接 Agentic Wallet 就能参加」是假承诺，中英已改为「通过 Agent 参与」口径。
5. **手册修正**：上线自检「闭环走一遍」原假设可在 App 浏览器里操作 Agentic Wallet——错误前提已改写为网站侧负向测试 + 发起人侧流程；Agent 实走由「上线次日」提为**发招募帖之前的上线闸门**（主网上唯一能验通持有人正向闭环的路径）。
6. 创世抽奖由用户钱包在网站创建不受影响（发起人不需要持 ID；其 Web3 钱包备 20 USDC + BNB 即可，手册第 1 节已列）。

## 2026-11-23 下午 · IdentityBindingsV2：帖文见证通道（用户拍板「按推荐改」）
背景：用户问「参加必须用 Agent，绑定推特岂不是用不上」——属实：V1 绑定要求被绑定地址 personal_sign，Agentic Wallet 签不了，条件 0 对真实持有人永远不可达。主网未部署、改版零成本，用户问「现在应该怎么做」后按推荐方案执行：
- **IdentityBindingsV2**（V1 保留存档）：签名通道原样保留（proofType 0）；新增登记员见证通道 `registerByAttestation`（proofType 1）：登记员核对本人 X 公开推文（账号=所绑 @、正文含地址+一次性验证码 BC-xxxxxx，验证码 = keccak(小写地址+"@"+handle) 前 6 位十六进制）后上链登记。护栏：见证不得覆盖签名绑定（ProofDowngrade）、登记员只能撤销见证绑定（NotAttested）、本人可自删、`proofTypeOf` 链上可查（255=无绑定）、显示端必须区分标注。`isBindingValid` 接口不变，V9 无需改动。
- **测试**：新增 bindings-v2.test.js 8 项（签名不变/见证登记/越权拒绝/防降级/签名可升级见证/撤销边界/自删/条件 0 集成），全套 **82 passing**。
- **测试网部署**：BindingsV2 0x3b5a6cd4ae21cf100da21197a58be6d6d406f843（块 144360355，registrar=部署者）；新 OneIDCampaignsV9 实例 0x9dac1ccb350a3568a7858f3874b06a69a61aa426（块 144360363，bindings 指 V2）。实测：见证登记 w1（@becounted_demo，全程未签名）proofType=1；条件 0 抽奖 id 2：见证者进入成功、无绑定者被 ConditionFailed(0) 拒绝；演示内容已重建（投票 2/0/1、自定义奖品抽奖、门禁抽奖共 3 个活动）。两新合约 Sourcify 均 exact_match。（部署小插曲：首版脚本 gas 估算公式低估 code deposit 而回滚一笔，改用固定 5M gas 后成功——主网脚本本来就是固定值，不受影响。）
- **前端**：配置切至新实例（APPS_DEPLOY_BLOCK 144360363，版本 1122b）；绑定页新增「帖文见证」区（生成验证推文→发推→查登记状态，中英双语）；发起人标签区分 签名✓ / 见证；登记员工具 scripts/register-attested.js（跑前强制核对清单+5 秒中止窗）。
- **发射包/文档**：deploy-mainnet.js 改部署 V2（dry-run 复验过）、手册部署顺序与验证段同步、提交稿条件段加两种证明如实标注、Skill §8 绑定边界改写、白皮书/建造者页/README 地址表更新。

## 2026-11-23 晚 · 上线提前至 11-25 + Agent 原生定位（用户拍板）
- 起因：冷评（以陌生评委身份按官方权重评项目现状）给出 67/100，扣分集中在三处可验证的空洞——主网未上线、持有人正向闭环从未实跑、第三方接入为零。用户回应：「那我们抓紧速度，在 25 号之前把它完成……有句话叫"求上得中，求中得下"，所以我们一定要求上，不然的话不会很稳。」据此两项拍板：
  1. **主网上线由 11-27 提前至 2026-11-25**（原 11-27 时间线全部 superseded，历史条目保留并已就地标注；奖池复核提醒 cron humangate-launch-pool-reminder 需由主会话从 11-27 改至 11-25 约 09:40，资金到位截止改 11-25 10:00，口径以 LAUNCH-RUNBOOK 第 1 节为准）。
  2. **定位翻为「Agent 原生」**：持有人经 Agent 通道参与（参与 Skill / is-human CLI / MCP 是产品本体），网站是发起人控制台 + 公开透明层（普通 EOA 钱包可连）；Agentic Wallet 不直连任何第三方网站是币安的设计与红线 1、全场共同约束，写进提交稿与白皮书正文，不再按「网站产品」叙事。提交稿已按此重写框架表述，BindingsV2 帖文见证列为创新展品段（分级证明 + 登记员信任点如实披露）。
- **新赛季时间线**：开季 2026-11-25 12:00 CST（QUEST_START_AT = 1795579200）→ 集印 7 天至 12-02 12:00 → 终章报名窗 24h 至 12-03 12:00、12-03 开奖 → 材料 12-04→12-06 → **12-07 提交**（截止 12-09 16:00，留 2 天缓冲）。原时间线（11-27 开季 / 12-05 开奖 / 12-08 提交）作废。
- **评审窗口常青活动（规格定稿，上线后执行）**：评审期 12-09→12-17 恰在赛季结束之后，评委打开站点时不能只看到一场已结束的赛季。规格：上线后由发起人（用户）钱包在主网 OneIDCampaignsV11 上创建一个**长期开放的领取型（claim）活动**，开放期覆盖整个评审与公示窗口（建议 11-25 创建、结束时间不早于 12-20）。选领取型的理由：无需等开奖，评委或新访客在任意时刻打开都能立即参与并当场验证门禁（一人一份、非真人被拒），摩擦最低、最能证明产品在评审当下是活的；小额拼手气或等额均可，金额上线时随奖池复核一并定。此活动同时持续积累与提交合约交互的 Agent ID 地址数。此为运营动作（网站创建即可），不涉及新合约。

## 2026-11-23 晚 · 前端翻转工具合并（flip-mainnet.js 为唯一工具）
- 老的 `scripts/switch-frontend-mainnet.js` 独有编辑组已全部移植进 `scripts/flip-mainnet.js`（保持其「计划 → 全量校验 → 内存计算 → 落盘 → 写后断言」架构）：Skill 三占位符（{{BECOUNTED_MAINNET_ADDRESS}} / {{APPS_MAINNET_ADDRESS}} / {{QUEST_MAINNET_ADDRESS}}，多次出现全替、已翻幂等、两者皆无则报错）、i18n 测试网→主网文案对照表 26 对 + 证书画布文案（逐条核对现行 app.js 全部存在、无缺失；一次性文案编辑同样幂等：只有主网形态在场时登记 no-op，两者皆无则报错）、wallet_addEthereumChain 主网参数块、testnet.bscscan.com → bscscan.com（app.js + 全部 HTML）、12 页导航徽章 testnet → mainnet、builders/whitepaper 地址表按 app.js 当前 *_TESTNET 常量值替换为主网记录值（新增地址碰撞防护：记录值撞上另一合约的现行测试网地址时拒绝执行）。
- 写后断言新增全站扫描：不得残留 testnet.bscscan.com、{{…MAINNET…}} 占位符、<span>testnet</span>。
- 老脚本的 `--keep-profile-testnet` 语义**不移植**：记录 profile 为 null 时 flip 按缺字段报错拒绝（与既有口径一致）。
- 未移植（仍属手工/运营项，手册 §4 清单保留对照）：og:image/twitter:image 绝对化、builders/whitepaper 新增 QuestPass 行、embed.js RPC（本来就是主网、不用改）。
- /tmp 拷贝演练通过：假记录（由测试网记录拼、chainId 56）dry-run 76 项计划 → apply 成功、残留扫描全 0、app.js 语法 OK；翻后拷贝再跑 dry-run 幂等（41 项 already at target，仅剩 12 项版本号递增）；profile=null 记录 apply 被拒且零写入；碰撞记录被拒且零写入。真实 web/ 未动。
- `git rm scripts/switch-frontend-mainnet.js`；手册 §4 已标注 flip-mainnet.js 为唯一翻转工具。


## 决策记录 2026-11-23（续）：IdentityProfile 同批上线

用户拍板：主网发射批次带 IdentityProfile，五合约齐发（BeCounted 原语 / IdentityBindingsV2 / OneIDCampaignsV9 / QuestPass / IdentityProfile），全批 gas 约 8.85M。部署命令固定带 INCLUDE_PROFILE=1；flip-mainnet.js 的 profile 字段必填口径与此一致，无需改动。

## 2026-11-23 晚 · 条件 5：Agent ID 名单（方案二，用户拍板「执行方案二」）
背景：用户指出地址名单（条件 4）只认地址、不能写 Agent ID，可用性与实用性打折；随即补上红线——活动规则明文不许提供「用 Agent ID 查地址」的功能，我们自己的三条边界第一条也是「不反查」。助理原方案（前端解析名字→地址并显示给发起人核对）被用户当场否决：显示解析结果就是提供反查。拍板方案二：名单本身换成身份，解析在全流程中根本不发生。
- **合约 OneIDCampaignsV10**（commit 5e0deb1）：Conditions 增 `idListRoot`（非零启用条件 5）；enterRaffle/castVote/claim 增第二个证明参数 `idProof`（与条件 4 的 proof 并存、各自独立校验）。身份叶 = keccak256(abi.encodePacked(keccak256(bytes(handle))))，handle 为裸小写标签（无 .ai 后缀）；校验时合约经 gate 同源注册表的 `handleOf(msg.sender)` 实时取本人 handle（地址 → 名字，唯一允许方向），sorted-pair 验根与条件 4 同构。无 handle 者永远过不了条件 5；失败回滚 ConditionFailed(5)、不消耗名额。名单绑身份不绑地址快照：改名即出名单（测试实测）。
- **测试**：新增 flow14.test.js 6 项，全套 **88 passing**。测试网独立试验栈（不碰主演示栈）：MockRegistryV2 0xf6a1700D…592bA（带 handleOf）→ gate 0x6033604a…AD78 → apps V10 0x5c6bd30e…4bA3e，bindings 沿用 V2；实测名单内 handle（trialone）进入、名单外（trialtwo）与无 handle 者均 ConditionFailed(5) 拒绝且名额未消耗；三合约 Sourcify exact_match。记录 v10-address.json。
- **前端切 V10**：APPS_TESTNET = 试验栈 apps、APPS_DEPLOY_BLOCK = 144378510、APPS_ABI 换 V10（conditionsOf/创建元组增 idListRoot、三入口双 proof、新增 gate()/idRegistry()）。创建页新增条件 5 输入（跟随条件 4 名单 UI：一行一个名字、带 .ai 或裸名、规范化 trim/小写/剥后缀、格式校验、只显示名字/数量/根短哈希、不显示任何地址；诚实提示「名字写错不会报错、只是永远没人能对上，请逐个核对」）。参加侧双 proof：名单分发严格跟随条件 4 机制（创建后自动下载名单文件 + localStorage 本地存档、详情页导入/根值对照），名单换成名字列表；用户叶由前端调 apps.idRegistry().handleOf(本人地址) 取 handle 本地算出（允许方向），查不到 handle 直接判条件 5 失败并给人话提示。详情页条件 5 面板只显示名字。试验栈补建演示：投票 id 1、领取 id 2、长期条件 5 抽奖 id 3（记录 v10-demo-frontend.json；一期 1 小时试验抽奖 id 0 已结束）。check-frontend-config.js 通过（artifact 引用同步 V10）。注意：试验栈自成一体（自有 gate + mock 注册表），站点独立 gate/远征/名片流程仍指主演示栈；活动合约内部的真人校验以 apps 自带 gate 为准，前端条件 5 的 handle 读取走 apps.idRegistry()，两栈各自自洽。
- **Skill**：becounted-skill.md 三动作签名/选择器更新为双 proof 版（enterRaffle 0x1959f37d / castVote 0x97176faa / claim 0xf50cd1da），新增 §6.0b 条件 5 参加法（读 idListRoot → idRegistry() + handleOf(本人地址) 取名 → 本地算叶与 proof → 双 proof 调用；强调不需要用户提供地址、不得反查他人）。
- **材料**：白皮书 §03 后增静态双语段（条件 5 与不反查边界）；提交稿条件引擎段五种→六种 + 卖点句「白名单里只有身份、没有地址——名单存的是名字的哈希，连发起人也不需要任何人的钱包地址」、合约名与测试网表更新为 V10、测试数 82 → 88；README 合约表与部署表同步。
- **发射包切 V10**：deploy-mainnet.js 改部署 OneIDCampaignsV10（构造签名与 V9 相同 (gate, bindings)；verifyAll 增 idRegistry == 注册表断言）；地址记录同时写 appsV9 与 appsV10 两键指向同一 V10 地址，flip-mainnet.js 零改动兼容（其取址逻辑读 appsV9 键）。顺手修发射脚本一处存量 bug：LIVE 流程按名取 bindings 步骤时误写 byName["IdentityBindings"]（计划中步骤名为 IdentityBindingsV2），原样会在 LIVE 部署第二步崩溃，已改正。LAUNCH-RUNBOOK 指名 apps 处 V9 → V10（历史实测记录保留原样）。flip 演练（/tmp 副本 + 含双键的假主网记录）：dry-run 78 项计划 → apply 成功 → 占位符/testnet.bscscan.com/徽章残留全 0、APPS 指向记录地址、重跑 dry-run 幂等。资产版本 1122i。

## 2026-11-23 晚 · 仓库改名 + 全站审计与修复批（决策/事件记录）

- **GitHub 仓库已改名**：用户在 GitHub 侧将仓库由 `sijiu94-ship-it/humangate` 改名为 **`sijiu94-ship-it/becounted`**；`~/workspace/tools/gh_push.py` 的 REPO 已同步为 `sijiu94-ship-it/becounted`。提交稿中的仓库链接（github.com/sijiu94-ship-it/becounted）随之自动变对，无需改文。
- **全站审计结论摘要**（五路并行审计：前端 / 合约 / 设计 / 文案 / 实站）：合约层**无高危**——资金闭环、权限清单、随机数口径均与披露一致，问题集中在规模天花板与一处披露缺口（兜底种子）；前端 3 个高危均为单行级（renderSoon 模板 `${id}` 误写、fmtWhen 引用未定义 `lang`、静默重连不设 signer）；设计与文案另有一批中低危（名单 textarea 无样式、`--faint` 对比度 2.99:1、`.panel` 类缺失、提交稿口径数处对不上等）。
- **Wave 2 清单**（合约层根治项，本轮不动，赛后/上线后排期）：
  1. draw 分页开奖——现 `draw()` 为 O(n) 内存数组，参与规模约 20 万时逼近块 gas 上限；材料口径先标注实用上限 ≤5 万。
  2. 兜底种子过期重锁——现兜底路径下调用者可逐块预演挑时；根治法为种子过期后改用未来块重新锁种。
  3. `isHuman(零地址)` 短路——真实注册表 balanceOf(0) 会 revert，原语加零地址直接返回 false。
  4. handleOf 返回格式假设（审计 L1）——条件 5 的身份叶直接由注册表返回的 handle 原文算出、合约不做规范化；现注册表返回小写裸标签故无碍，若 SPACE ID 日后改返回格式（大小写/后缀），已列名者会被 fail-closed 拒绝，需届时跟进。
  5. claimPrize 领奖截止专用错误——现 30 天窗口靠创作者 reclaim 扫走余额间接执行，迟领只撞 TransferFailed；Wave 2 加窗口判断与专用错误，前端先行标注领奖截止。
- **审计修复批落地范围**：前端 / 设计 / 材料 / 测试四路并行修复（材料路：Skill 补 prizeLabel 字段与护栏措辞、提交稿页数/清单/测试网表/附录/域名注脚/§2.4 表述/社区帖口径、补兜底种子披露、RUNBOOK 补终章运营纪律）。**唯一除外**：提交稿 §2b「总预算 74 USDC」句——用户已登记，因奖池尚未完全拍板，本轮一个字不动，待 **2026-11-25 奖池拍板后**随新总额一并修改（届时连同「见运营计划」悬空引用一并处理）。

## 2026-11-23 晚 · 第二轮审计与修复批（工具链路记录）

第二轮审计（五路：前端回归+跨翻转状态 / 发射工具链 / Agent 面 / 设计无障碍 / 实站流程）结论：第一轮 21 项前端修复逐项核过、全部真落地零回归；新挖出两个「11-25 当场炸」的红色项，均出在部署之后的翻转环节、且会连环触发。本节记工具链路的成因与修复（前端/设计/Agent 面三路的修复见各自 commit）。

- **红色 1 · flip 的 i18n 锚点被第一轮修复弄失效**：第一轮文案修复把字典 `a_bind` 改为「IdentityBindingsV2 (testnet)」，而 `flip-mainnet.js` 的 I18N_PAIRS 还留着旧对 `["IdentityBindings (testnet)", "IdentityBindings"]`——翻转第一步即按设计 fail-loud 中止。时序最要命：flip 在部署完成、59 USDC 已托管之后才跑，等于钱已上链、前端切不过去。修复：旧对改为 V2 对、probe 特判同步改 V2；顺带补 `a_quest` 的 EN/ZH 两对（第一轮新增的键此前没有翻转对，翻后地址表会永远写着 testnet）；写前+写后各加一道**标签扫描**——app.js 残留 `— BSC testnet`/`— BSC 测试网` 标签串即中止（`f_chain_test` 裸链名豁免），以后任何新标签漏配翻转对都会在演练期暴露而不是上线日。改对后对最终代码（1122l）重跑三轮演练（干跑/apply/幂等复跑），结果见本批 commit 说明。
- **红色 2 · 手册 §2 的 LIVE 命令漏 INCLUDE_PROFILE=1**：手册散文三处都写「命令带 INCLUDE_PROFILE=1」，唯独命令块本身没有——照抄执行会漏部署 IdentityProfile，而 flip 对 profile=null 是硬拒，于是与红色 1 连环触发、上线日上午现场补救。修复：命令块补上 `INCLUDE_PROFILE=1`（与第 1 节已定口径一致）。
- **部署脚本加固（deploy-mainnet.js）**：① 记录改为**增量落盘**——每步部署成功后即写 mainnet-address.json，中途失败不再丢记录；post-deploy 检查可单独重跑 `node scripts/deploy-mainnet.js --verify-only`（只读、无需私钥）。② OneIDCampaignsV10 加兜底 gas 常量 4,500,000（其构造读 gate.registry()，主网 gate 未部署前估算必失败；数值按测试网同字节码部署实测 4,050,918 取整）——此前估算缺失会让干跑的总 gas 与 BNB balance check 整段跳过、LIVE 的 1.5× 硬线少算，现已恢复；LIVE 时每步在依赖落地后重新估算、优先用新鲜值。③ verifyAll 误用 V1 工件查 V2 合约（`artifact("IdentityBindings")`）已改 IdentityBindingsV2——此前能工作纯属两版 bindingOf 签名恰好相同。
- **结算工具切 V10（settle-vote.js）**：此前还接在 V5 测试网栈（ABI/默认地址/链 ID 97 写死、手册 §8 没给命令）。已换 OneIDCampaignsV10 ABI，地址/起始块/链/RPC 全走环境变量（默认 = V10 测试网试验栈）。实跑证明两份：(1) 对试验栈投票 id 1 按手册参数实跑——脚本正确读出活动并拒绝结算（该投票 2026-11-30 17:15 才结束、且当前 0 票，未结束拒绝即预期行为）；(2) 本地 hardhat 节点部署同字节码 V10 全栈，建无奖池投票（3 选项）投出 [2,1,1]，推进时间后实跑结算全程通过：事件重算票数与 tally() 交叉校验一致、少数派并列 {1,2} 合并、15 USDC 均分 7.5/7.5、dust 0、exit 0。手册 §8 已补主网结算确切命令。
- **终章推进脚本（rehearsal-quest.js 参数化 + 新增 mainnet-quest.js）**：阶段机逻辑一字未动，地址/RPC/chainId 改为环境变量注入（默认值 = 测试网彩排，cron 行为不变，已实跑验证 no-op 正常）；gas 改为逐笔估算×1.3（主网终章 draw 循环条目多，固定 50 万上限不够）、gasPrice 走链上 feeData。新增 `scripts/mainnet-quest.js`：读 mainnet-address.json 的 quest 地址驱动主网阶段机，供 12-03 终章日连跑（锁种后一两分钟内再跑一次开奖，赶 256 块窗口）。
- **彩排终章 ETA 更正（实话口径）**：彩排阶段机挂每日 cron、一天推进一个阶段，锁种与开奖分属相邻两次运行——即锁种次日才开奖、走兜底种子路径（彩排走兜底属预期内）。此前手册/口径称彩排「锁种后立即开奖、预计 11-30 跑通」与实际不符：按此节奏彩排终章预计约 **12-01** 跑完，仍早于主网终章 12-03；`becounted-rehearsal-quest` cron 不要在 11-30 提前撤。手册 §8 已改成实话。
- **register-attested.js 参数化**：目标解析三级（env BINDINGS_ADDRESS > mainnet-address.json 的 bindings（chainId 56）> bindings-v2-address.json 测试网默认）；验证码算法一行未动（diff 已核）。
- **手册其余订正**：§1 PAT 条改已改名 becounted 且实测可用；§4 人工对照表订正（APPS_DEPLOY_BLOCK 当前值 144378510、13 个页面含 skill、版本示例 1122l、apps 双键口径）；**删 §4 两个已作废的手工例外**（og 绝对地址、QuestPass 行——都已自动化，照做会重复加行）并注明；§8 补 settle-vote 命令与 mainnet-quest.js。

## 2026-11-23 晚 · V11 安全修复批 + 集成（合约 17a58e7 / 工具链与文档路记录）

用户令「把能修复的问题全部修复、保证绝对的安全」后执行的修复批。合约批（提交 17a58e7）与本路（工具链 + 文档 + 测试网重部署）分工，本节记本路落地：

- **深审结论（修复依据）**：逐行审 + 33+ 条对抗探针在 OneIDCampaignsV10 实证 **Critical C1**——claimPrize 不查 reclaimed/无期限，创建者合法回收后中奖者可再领一次、从其他活动托管付第二次（PoC：双活动池 300、受害活动被掏 50、其 200 中奖者领不出）。另 High 种子时机（创建时选种 + 兜底可磨块）、Medium 手续费代币名义记账（托管 1000 实收 900、900 永久锁死）。其余探针（双领/两路重入/越权回收/条件 0–5 绕过/Merkle 盗用/非中奖者领奖）全被挡；QuestPass 账目逐 wei 精确；信任面无 fail-open。
- **合约修复（17a58e7）**：OneIDCampaignsV11（claimPrize 加 reclaimed + ClaimExpired；_fund 到账恰等校验；开奖改锁种状态机——create 去 seedBlock、结束后 lockDraw 锁当前块 +2、过期可重锁、无兜底、SeedNotLocked/SeedExpired/SeedLocked）、QuestPass（终章种子可重锁、finaleReclaimed/SeasonClosed、_fund 校验）、IdentityBindingsV3（低 s 校验、registrar 可轮换）、BeCounted（构造校验注册表有代码）、GatedClaim（_fund 校验）。全套 **141 测试通过**，C1 探针期望反转并通过。
- **测试网新试验栈**（scripts/deploy-v11-stack.js，记录 v11-address.json，提交 113c9a9）：MockRegistryV2 0xd7617CB7…2782 → BeCounted 0x2464F161…4296 → IdentityBindingsV3 0x727dfCc0…bf30 → OneIDCampaignsV11 0x8Ce3052c…6d32（部署 gas 实测 4,203,733）。演示活动与 V10 栈对应（条件 5 抽奖 id 0 / 选项投票 id 1 / 领取 id 2 / 长线条件 5 抽奖 id 3，记录 v11-demo-frontend.json）；实跑：条件 5 名单内进入、名单外与无 handle 者 ConditionFailed(5)；资金流抽奖 id 4 全程——未锁先开奖 SeedNotLocked → lockDraw（seedBlock 144406218）→ draw（usedFallbackSeed=false）→ 中奖领取 0.001 tBNB 逐 wei 精确、非中奖者 NotWinner、双领 AlreadyCounted、窗口内回收 TooEarly。**C1 字面回归（回收后领奖）需 endAt+30 天真实时间、单会话内不可达**，由本地套件覆盖（security-probe-c1 反转 + security-fix），记录文件已注明。
- **新版 QuestPass 测试网试验**（scripts/deploy-quest-v11-trial.js）：新源码快速季 0xAeC4FF16…0907（不动彩排实例）：领印记（day 6）→ enterFinale → lockFinaleSeed（seedBlock 144407407）→ 故意等过期（>256 块）→ **重锁成功**（144407672）→ drawFinale（usedFallbackSeed=false）→ claimPrize 0.001 tBNB 精确。记录并入 v11-address.json 的 questNew / questTrial。前端远征页本轮仍指彩排实例，主网才切新版。
- **发射包切 V11**：deploy-mainnet.js 改部署 V11/V3；记录键 **appsV11 为主、appsV9 同值旧键别名**（兼容旧 flip 副本）；verifyAll 新增三断言（BindingsV3.registrar() == 部署者、QuestPass winnerCount == 3、prizePerWinner == finalePool/3 = 15 USDC）；APPS_GAS_FALLBACK 按实测改 4,700,000。dry-run 复验：五步齐全，总估算 9,233,294（不含 Profile）/ 9,963,872（含 Profile，+30% 缓冲 12,953,033）。settle-vote.js 切 V11 ABI + 新栈默认值并实跑（演示投票未结束、正确拒绝）。register-attested.js 目标解析改读 BindingsV3 记录（env > mainnet-address.json > v11-address.json > 旧 V2 记录；主网记录排测试网之前，防上线后误落测试网），验证码算法 diff 核对零改动。mainnet-quest.js 改为独立重锁感知驱动（无主网记录拒绝运行；同程连跑：无有效种子先（重）锁、等种子块落地立即开奖；rehearsal-quest.js 未动）。
- **flip-mainnet.js 切 V11**：I18N 对 IdentityBindingsV2 → **V3**（含 probe 特判——吸取第二轮审计锚点失效教训，前端 ceaec02 的 a_bind 已是 V3 形态）；取址优先 appsV11。对最终代码（前端 ceaec02，资产 1122m）在 /tmp 副本 + 假主网记录（含 profile、appsV11）三轮演练：干跑 76 项计划 → apply 成功（版本 1122n）→ 复跑内容项 43 处全部 already at target、仅剩设计内的版本递增，占位符/testnet 徽章残留 0。
- **文档**：提交稿（版本 V11/V3、§3.2 换新试验栈、测试数 96 → 141、兜底披露改写为锁种机制披露、新增「安全审计与修复」段——C1/High/Medium 与残余信任如实口径、§4.4 种子句改锁种）；LAUNCH-RUNBOOK（合约名、gas 更新为 V11 dry-run 实测、校验清单补 registrar/winnerCount/prizePerWinner 断言、终章纪律改「过期重锁后立即开奖」、settle-vote 改 V11 口径、APPS_DEPLOY_BLOCK 改 144405789、版本示例 1122m）；README（合约表与部署表同步、主网日期订正为 2026-11-25）。**白皮书源在 web/whitepaper.html（前端路范围）**：其第 87–88 行 EN/ZH 条件 5 段仍写 OneIDCampaignsV10，需前端路改 V11；开奖流程/种子描述在该页除 og meta 外无成段文字，无需改（本路未越界动 web/）。
- **残余（代码消不掉、已向用户明示）**：SPACE ID 注册表与 USDC 发行方为外部信任；即时拼手气随机可预测但影响封顶（约 0.04 USDC/天、总池不变）；条件 1 为快照语义、可被闪电贷冲门槛（封顶每人一次）。

## 2026-11-26 绑定认证改版（用户拍板：规则禁“提供”、不禁“内部使用”）
- 背景：创始人本人见证绑定因 X 账号与 Agent ID 同名、推文+链上登记造出公开配对而撤销（登记 tx 0x28f5…0ef9、撤销 tx 0x6eb1…bbb3，链上现态已清、历史事件不可删）。用户随即厘清规则口径：活动规则明文禁的是**提供**「用 Agent ID 查地址」的功能，不是禁止**内部使用**；且人工审核不扩展。
- 拍板新规（边界一实话版）：不提供反查功能、不向任何人展示解析结果；唯一内部使用 = 持有人本人申请绑定登记时，登记系统内部解析一次（经币安官方 baw resolve-domain，已实测 9nosing.ai 解析正确），不展示、不保存、无人工审核。
- 见证推文 v2：只写 X 账号 + Agent ID 名 + Proof 码（keccak(地址+"@"+账号) 取 16 位十六进制，前 6 位与旧码一致），**不写地址**；地址仅在绑定页本地算码用，页面明示不发不传。
- 落地：web 文案（b1/wp3/bind_sub/bind_attest_sub 中英 + 提交稿 §2.3 与见证段）已同步实话版；绑定页新增 Agent ID 输入；新脚本 scripts/register-auto.js（作者校验→内部解析→Proof 复算→登记，地址只在内存、只打印指纹）干跑实测 PASS（@9nosing/9nosing.ai，Proof 与本人自报地址算出的一致）；旧 register-attested.js 保留给旧格式。版本 1122w，本地提交；正式站推送待 GitHub 令牌（与 1122v 一并）。
- 创始人本人仍不绑定：其同名情形下链上事件配对可被专门翻出，按自设更严标准保持撤销状态。
