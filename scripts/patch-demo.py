#!/usr/bin/env python3
"""Add the no-wallet anti-sybil live demo to the homepage:
100 locally generated bot addresses + 1 sample human, all checked LIVE against
the BNB mainnet Agent ID registry (batch eth_call). i18n EN+ZH, site styling."""
import os

ROOT = os.path.expanduser("~/workspace/agentid-hackathon")

def patch(relpath, pairs):
    p = os.path.join(ROOT, relpath)
    with open(p, encoding="utf-8") as fh:
        s = fh.read()
    for old, new, count in pairs:
        n = s.count(old)
        assert n == count, f"{relpath}: expected {count}x {old[:60]!r}, found {n}"
        s = s.replace(old, new)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("patched:", relpath)

# ---------- 1. index.html: demo section before the "soon" section ----------
demo_html = """<section style="padding-top:10px">
  <div class="wrap">
    <div class="sec-head"><span class="sec-no">\\u2298</span><h2 data-i18n="demo_h"></h2><p data-i18n="demo_sub"></p></div>
    <div class="demo">
      <div class="demo-side">
        <div class="demo-btns">
          <button class="btn big ghost" id="demoBots" data-i18n="demo_btn_bots"></button>
          <button class="btn big" id="demoHuman" data-i18n="demo_btn_human"></button>
        </div>
        <button class="btn ghost sm" id="demoReset" data-i18n="demo_btn_reset"></button>
        <div class="demo-counts">
          <div><b id="demoTried">0</b><span data-i18n="demo_c_try"></span></div>
          <div><b id="demoPassed">0</b><span data-i18n="demo_c_pass"></span></div>
          <div><b id="demoRejected">0</b><span data-i18n="demo_c_reject"></span></div>
        </div>
        <p class="demo-cap" id="demoCap" data-i18n="demo_cap0"></p>
        <p class="demo-note" data-i18n="demo_note"></p>
      </div>
      <div class="demo-stage">
        <div class="demo-stage-head"><span data-i18n="demo_stage"></span><span class="demo-live">BNB MAINNET \\u00b7 LIVE</span></div>
        <ul class="demo-list" id="demoList"><li class="demo-empty" data-i18n="demo_empty"></li></ul>
      </div>
    </div>
  </div>
</section>
<section style="padding-top:34px">"""
_idx = os.path.join(ROOT, "web", "index.html")
if "demoList" in open(_idx, encoding="utf-8").read():
    print("index.html already has the demo section, skipping")
else:
    patch("web/index.html", [
        ('<section style="padding-top:34px">', demo_html, 1),
    ])

# ---------- 2. app.js: i18n keys ----------
en_keys = """  demo_h:"Watch the gate work \\u2014 no wallet needed", demo_sub:"A live-fire demo against the real Agent ID registry on BNB mainnet. Send a bot farm at the gate, then send one real human. Same entrance, same one-line check.",
  demo_btn_bots:"Send 100 bots", demo_btn_human:"Send 1 human", demo_btn_reset:"Reset",
  demo_c_try:"attempted", demo_c_pass:"passed", demo_c_reject:"rejected",
  demo_stage:"DEMO RAFFLE \\u2014 ENTRY GATE", demo_empty:"Nobody has tried the gate yet. Pick a side.",
  demo_checking:"checking registry\\u2026", demo_rejected:"REJECTED \\u00b7 not in registry", demo_passed:"PASSED \\u00b7 ticket #1 issued",
  demo_bot_tag:"BOT", demo_human_tag:"HUMAN \\u00b7 sample holder 9nosing.ai",
  demo_cap0:"Bots don\\u2019t lose on speed, budget or numbers \\u2014 they lose because the registry has never heard of them.",
  demo_cap_bots:"100 fresh addresses, 100 registry lookups, 0 found. On-chain, every one of these entries reverts NotHuman before it can touch the prize pool.",
  demo_cap_human:"One address, one lookup, found instantly. That is the whole trick: the gate asks the registry, not the crowd.",
  demo_note:"Live reads against the BNB mainnet Agent ID registry. Bot addresses are generated locally in your browser \\u2014 none of them has ever held an Agent ID.",
  demo_err:"Registry read failed (RPC busy) \\u2014 reset and try again.",
"""
zh_keys = """  demo_h:"不用连钱包，看闸门怎么工作", demo_sub:"对着 BNB 主网真实的 Agent ID 注册表实弹演示。先放一群机器人进场，再放一个真人\\u2014\\u2014同一个入口，同一行检查。",
  demo_btn_bots:"放 100 个机器人进场", demo_btn_human:"放 1 个真人进场", demo_btn_reset:"重置",
  demo_c_try:"尝试进场", demo_c_pass:"通过", demo_c_reject:"被拒",
  demo_stage:"演示抽奖 \\u2014 进场闸门", demo_empty:"还没有人试过这道门。选一边开始。",
  demo_checking:"查注册表中\\u2026", demo_rejected:"被拒 \\u00b7 注册表查无此人", demo_passed:"通过 \\u00b7 已发 1 号票",
  demo_bot_tag:"机器人", demo_human_tag:"真人 \\u00b7 样例持有人 9nosing.ai",
  demo_cap0:"机器人输的不是手速、预算或数量\\u2014\\u2014是注册表里根本没有它们。",
  demo_cap_bots:"100 个全新地址，100 次注册表查询，0 个查到。在链上，这每一次进场都会在碰到奖池之前就 revert NotHuman。",
  demo_cap_human:"一个地址，查一次，立刻查到。全部诀窍就在这里：闸门问的是注册表，不是人群。",
  demo_note:"本演示实时读取 BNB 主网 Agent ID 注册表；机器人地址由你的浏览器本地随机生成，从未持有过 Agent ID。",
  demo_err:"注册表读取失败（RPC 繁忙），请重置后重试。",
"""
patch("web/assets/app.js", [
    ('  t1_no:"01 / Campaigns"', en_keys + '  t1_no:"01 / Campaigns"', 1),
    ('  t1_no:"01 / 活动"', zh_keys + '  t1_no:"01 / 活动"', 1),
])

# ---------- 3. app.js: demo logic + wiring ----------
demo_js = """
/* ---------- anti-sybil live demo (no wallet; live mainnet registry reads) ---------- */
const demoState = { tried: 0, passed: 0, rejected: 0, running: false, humanIn: false };
function demoCounts(){
  if ($("demoTried")) $("demoTried").textContent = demoState.tried;
  if ($("demoPassed")) $("demoPassed").textContent = demoState.passed;
  if ($("demoRejected")) $("demoRejected").textContent = demoState.rejected;
}
function demoRow(addr, tag){
  const li = document.createElement("li");
  li.className = "demo-row";
  li.innerHTML = `<span class="demo-addr">${addr.slice(0, 10)}\\u2026${addr.slice(-6)}</span><span class="demo-tag">${tag}</span><span class="demo-state">${t("demo_checking")}</span>`;
  return li;
}
function demoSetRow(li, ok, text){
  li.classList.add(ok ? "ok" : "no");
  li.querySelector(".demo-state").textContent = text;
}
async function mainnetBatchBalance(addrs){
  const data = a => "0x70a08231" + "000000000000000000000000" + a.slice(2).toLowerCase();
  const payload = addrs.map((a, i) => ({ jsonrpc: "2.0", id: i, method: "eth_call", params: [{ to: REGISTRY_MAINNET, data: data(a) }, "latest"] }));
  for (const url of NETWORK.mainRpcs){
    try{
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!Array.isArray(j)) continue;
      const out = new Array(addrs.length);
      for (const item of j){ if (item && typeof item.id === "number" && item.result) out[item.id] = BigInt(item.result); }
      if (out.every(v => v !== undefined)) return out;
    }catch(e){}
  }
  throw new Error("registry batch read failed");
}
window.demoBots = async () => {
  if (demoState.running) return;
  const list = $("demoList"); if (!list) return;
  demoState.running = true;
  $("demoBots").disabled = true; $("demoHuman").disabled = true;
  const empty = list.querySelector(".demo-empty"); if (empty) empty.remove();
  const addrs = [], rows = [];
  for (let i = 0; i < 100; i++){
    const b = new Uint8Array(20); crypto.getRandomValues(b);
    addrs.push("0x" + [...b].map(x => x.toString(16).padStart(2, "0")).join(""));
  }
  for (let i = 0; i < 100; i += 10){
    for (let k = i; k < Math.min(i + 10, 100); k++){ const li = demoRow(addrs[k], t("demo_bot_tag")); list.prepend(li); rows.push(li); demoState.tried++; }
    demoCounts();
    await new Promise(r => setTimeout(r, 70));
  }
  try{
    const bals = await mainnetBatchBalance(addrs);
    for (let i = 0; i < 100; i++){
      if (bals[i] > 0n){ demoSetRow(rows[i], true, t("demo_passed")); demoState.passed++; }
      else { demoSetRow(rows[i], false, t("demo_rejected")); demoState.rejected++; }
      if (i % 5 === 0){ demoCounts(); await new Promise(r => setTimeout(r, 30)); }
    }
    demoCounts();
    $("demoCap").textContent = t("demo_cap_bots");
  }catch(e){
    rows.forEach(li => demoSetRow(li, false, t("demo_err")));
    $("demoCap").textContent = t("demo_err");
  }
  demoState.running = false;
  $("demoBots").disabled = false; $("demoHuman").disabled = demoState.humanIn;
};
window.demoHuman = async () => {
  if (demoState.running || demoState.humanIn) return;
  const list = $("demoList"); if (!list) return;
  demoState.running = true;
  $("demoBots").disabled = true; $("demoHuman").disabled = true;
  const empty = list.querySelector(".demo-empty"); if (empty) empty.remove();
  const li = demoRow(SAMPLE_HOLDER, t("demo_human_tag"));
  list.prepend(li);
  demoState.tried++; demoCounts();
  try{
    chain();
    const bal = await registry.balanceOf(SAMPLE_HOLDER);
    if (bal > 0n){ demoSetRow(li, true, t("demo_passed")); demoState.passed++; demoState.humanIn = true; $("demoCap").textContent = t("demo_cap_human"); }
    else { demoSetRow(li, false, t("demo_rejected")); demoState.rejected++; }
  }catch(e){ demoSetRow(li, false, t("demo_err")); }
  demoCounts();
  demoState.running = false;
  $("demoBots").disabled = false; $("demoHuman").disabled = demoState.humanIn;
};
window.demoReset = () => {
  if (demoState.running) return;
  const list = $("demoList"); if (!list) return;
  demoState.tried = 0; demoState.passed = 0; demoState.rejected = 0; demoState.humanIn = false;
  list.innerHTML = `<li class="demo-empty" data-i18n="demo_empty">${t("demo_empty")}</li>`;
  $("demoCap").textContent = t("demo_cap0");
  $("demoHuman").disabled = false;
  demoCounts();
};
"""
wiring_anchor = '''  const ts = $("trySample");
  if (ts) ts.onclick = () => { $("checkInput").value = SAMPLE_HOLDER; cb.click(); };
'''
wiring_new = wiring_anchor + '''  const db = $("demoBots"); if (db) db.onclick = () => window.demoBots();
  const dh = $("demoHuman"); if (dh) dh.onclick = () => window.demoHuman();
  const dr = $("demoReset"); if (dr) dr.onclick = () => window.demoReset();
'''
patch("web/assets/app.js", [
    (wiring_anchor, wiring_new + demo_js, 1),
])

# ---------- 4. style.css: demo styles (append) ----------
css = """
/* anti-sybil live demo */
.demo{display:grid;grid-template-columns:340px 1fr;gap:22px;align-items:start}
.demo-btns{display:flex;flex-direction:column;gap:10px}
.demo-btns .btn{width:100%}
#demoReset{margin-top:12px}
.demo-counts{display:flex;gap:26px;margin:22px 0 6px}
.demo-counts b{font-size:26px;font-weight:800;display:block;font-family:var(--mono)}
.demo-counts span{font-size:12.5px;color:var(--faint)}
.demo-cap{font-size:14.5px;line-height:1.65;margin-top:12px;min-height:48px}
.demo-note{font-size:12px;color:var(--faint);line-height:1.6;margin-top:10px}
.demo-stage{border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.015);overflow:hidden}
.demo-stage-head{display:flex;justify-content:space-between;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:var(--faint)}
.demo-live{color:var(--gold)}
.demo-list{list-style:none;margin:0;padding:8px;height:308px;overflow-y:auto;display:flex;flex-direction:column;gap:4px}
.demo-empty{color:var(--faint);font-size:13.5px;padding:18px 10px}
.demo-row{display:flex;gap:10px;align-items:center;font-family:var(--mono);font-size:12px;padding:6px 10px;border:1px solid var(--line);border-radius:8px}
.demo-tag{color:var(--faint);font-size:11px}
.demo-state{margin-left:auto;color:var(--faint);text-align:right}
.demo-row.ok{border-color:rgba(74,222,128,.45)}
.demo-row.ok .demo-state{color:var(--ok)}
.demo-row.no{opacity:.62}
.demo-row.no .demo-state{color:var(--bad)}
@media(max-width:760px){.demo{grid-template-columns:1fr}.demo-list{height:260px}}
"""
p = os.path.join(ROOT, "web", "assets", "style.css")
with open(p, encoding="utf-8") as fh:
    s = fh.read()
assert "anti-sybil live demo" not in s
with open(p, "w", encoding="utf-8") as fh:
    fh.write(s.rstrip("\n") + "\n" + css)
print("patched: web/assets/style.css (appended demo styles)")
print("ALL DEMO PATCHES OK")
