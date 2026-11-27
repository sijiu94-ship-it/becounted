# Slither 扫描分诊（Slither 0.11.6，solc 0.8.24，2026-11-27）

原始报告：同目录 `slither-*.json`（5 个在审合约逐个扫描）。
总计 32 条：High 5、Medium 5、Low 21、Informational 1（BeCounted 与 IdentityProfile 为 0 条）。
以下为项目方逐条分诊结论，供审核方去重与参考；分诊不替代独立判断。

## OneIDCampaignsV16（23 条）

### High
- **weak-prng ×3**（draw #848、_randomShare #791、_drawWeighted #892）→ **已知设计**。
  区块哈希种子机制，定位娱乐级、事前不可知、事后可复算，已在 README §4 与 KNOWN_ISSUES #1/#2 声明。
- **arbitrary-send-eth ×1**（_pay #393）→ **误报（模式匹配）**。
  `_pay` 的收款方只能是合约状态中记录的中奖者或活动创建者，金额来自该活动托管账目；调用者无法指定任意地址。
- **reentrancy-balance ×1**（_fund #374）→ **已知并已评估**（KNOWN_ISSUES #5）。
  读余额→transferFrom→比增量是手续费代币的入账校验本身；重入需奖品代币自身作恶，且每活动的账目独立、增量校验在本活动记录前完成，无跨活动挪用路径。合约关键外部函数另有 nonReentrant（如 reclaim）。

### Medium
- **divide-before-multiply ×1**（_randomShare #791）→ **设计内**。avg=remaining/slotsLeft、cap=avg*2 是拼手气分配算法本身，整数舍入由最后一槽兜底，总额守恒（已由测试与内部审查验证）。
- **incorrect-equality ×1**（_pay 中 `amount == 0`）→ **误报**。对金额零值的提前返回，非余额/授权的严格相等判断。
- **uninitialized-local ×1**（reclaim 的 `total` #956）→ **误报**。`total` 在各分支内必赋值后使用（已逐行核对源码 950–975 行）；Solidity 值类型零初始化。

### Low（21 条中的 V16 部分）
- **timestamp ×5** → KNOWN_ISSUES #15，设计内。
- **calls-loop ×1** → 已知（KNOWN_ISSUES #3）：加权开奖逐人读 weightOf 的 gas 上限问题。
- **reentrancy-benign ×4 / reentrancy-events ×4** → 外部调用后的状态/事件顺序问题；领取路径的防重复标记已经四轮审查与攻击探针（含重复领取尝试）覆盖，未发现可利用序列。若审核方能构造具体重入获利序列，欢迎按高危提交。
- **low-level-calls（Informational）×1** → `_pay` 使用 `.call{value}` 为有意选择（兼容合约钱包收款），返回值有检查。

## IdentityBindingsV4（3 条）
- **uninitialized-local（Medium）×1**（_uintToString 的 `digits` #284）→ **误报**：循环计数累加器，零初始化即预期语义（已核对源码）。
- **timestamp（Low）×1** → 24 小时冷却依赖时间戳，设计内。
- **assembly（Informational）×1** → 签名恢复使用内联汇编（ecrecover 标准写法）。

## CheckInV2（6 条）
- **incorrect-equality（Medium）×2**（`gap == 0`、`lastDay == todayIndex()`）→ **误报**：比较对象是「天序号」计数而非余额/授权，严格相等即业务语义。
- **timestamp（Low）×4** → 天序号由 block.timestamp 按北京时间日切推导，设计内（KNOWN_ISSUES #15）。

## BeCounted / IdentityProfile
- **0 条**。两合约分别为只读查询与自写名片，无资金、无外部调用面。

---
注：Aderyn（Cyfrin）的官方独立二进制下载已被其官方撤下，本包以 Slither 为自动扫描基线；如审核方惯用 Aderyn，可通过其 VS Code 扩展或 GitHub Action 对公开仓库运行。
