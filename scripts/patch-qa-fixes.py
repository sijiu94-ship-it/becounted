#!/usr/bin/env python3
"""Visual-QA fixes (2026-11-23):
1) index.html: literal \\u2298 / \\u00b7 text in the demo section -> real characters.
2) app.js: getLogsChunked rewritten (per-chunk RPC rotation + 20s timeout race +
   up to 6 attempts); loadFeed routed through it; loadPlatformStats in-flight guard;
   demo batch reads chunked 20-per-batch (dataseed rejects 100-item batches).
3) style.css: .stats grid (expedition), create two-column layout + checkbox width
   fix, demo list dark scrollbar.
4) create.html: form + preview into a two-column grid (preview sticky right).
5) card.html: move the stray </div> so guide/record sections sit inside .wrap.
"""
import os

ROOT = os.path.expanduser("~/workspace/agentid-hackathon")

def patch(relpath, pairs):
    p = os.path.join(ROOT, relpath)
    with open(p, encoding="utf-8") as fh:
        s = fh.read()
    for old, new, count in pairs:
        n = s.count(old)
        assert n == count, f"{relpath}: expected {count}x {old[:70]!r}, found {n}"
        s = s.replace(old, new)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("patched:", relpath)

# ---------- 1. index.html literal escapes ----------
patch("web/index.html", [
    ("\\u2298", "⊘", 1),
    ("BNB MAINNET \\u00b7 LIVE", "BNB MAINNET · LIVE", 1),
])

# ---------- 2a. app.js getLogsChunked ----------
old_glc = """async function getLogsChunked(base, from, to){
  const out = [];
  for (let s = from; s <= to; s += 45000){
    const e = Math.min(to, s + 44999);
    let logs = null, lastErr = null;
    for (let attempt = 0; attempt < 3 && !logs; attempt++){
      try{ logs = await providerTest.getLogs({ ...base, fromBlock: s, toBlock: e }); }
      catch(err){ lastErr = err; await new Promise(r => setTimeout(r, 900 * (attempt + 1))); }
    }
    if (!logs) throw lastErr;
    out.push(...logs);
  }
  return out;
}"""
new_glc = """const _logProviders = {};
function logsProvider(url){
  if (!_logProviders[url]) _logProviders[url] = new ethers.JsonRpcProvider(url, NETWORK.appsChainId, { staticNetwork: true });
  return _logProviders[url];
}
async function getLogsChunked(base, from, to){
  const out = [];
  const urls = NETWORK.appsRpcs;
  for (let s = from; s <= to; s += 45000){
    const e = Math.min(to, s + 44999);
    let logs = null, lastErr = null;
    for (let attempt = 0; attempt < 6 && !logs; attempt++){
      const p = logsProvider(urls[attempt % urls.length]);
      try{
        logs = await Promise.race([
          p.getLogs({ ...base, fromBlock: s, toBlock: e }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("logs timeout")), 20000))
        ]);
      }catch(err){ lastErr = err; await new Promise(r => setTimeout(r, 800 * (attempt + 1))); }
    }
    if (!logs) throw lastErr;
    out.push(...logs);
  }
  return out;
}"""
patch("web/assets/app.js", [(old_glc, new_glc, 1)])

# ---------- 2b. loadFeed through getLogsChunked ----------
patch("web/assets/app.js", [
    ("""    const logs = await providerTest.getLogs({ address: APPS_TESTNET, fromBlock: Math.max(0, latest - 30000), toBlock: latest });""",
     """    const logs = await getLogsChunked({ address: APPS_TESTNET }, Math.max(0, latest - 30000), latest);""", 1),
])

# ---------- 2c. loadPlatformStats in-flight guard ----------
old_lps = """async function loadPlatformStats(){
  if(!$("statHumans")) return;
  chain();
  try{"""
new_lps = """let _statsLoading = false;
async function loadPlatformStats(){
  if(!$("statHumans") || _statsLoading) return;
  _statsLoading = true;
  chain();
  try{"""
patch("web/assets/app.js", [(old_lps, new_lps, 1)])
old_lps_end = """    $("statHumans").textContent = humans.size;
    if($("statPayouts")) $("statPayouts").textContent = payouts;
  }catch(e){ /* keep last rendered values */ }
}"""
new_lps_end = """    $("statHumans").textContent = humans.size;
    if($("statPayouts")) $("statPayouts").textContent = payouts;
  }catch(e){ /* keep last rendered values */ }
  _statsLoading = false;
}"""
patch("web/assets/app.js", [(old_lps_end, new_lps_end, 1)])

# ---------- 2d. demo batch chunking (20 per batch) ----------
old_batch = """async function mainnetBatchBalance(addrs){
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
}"""
new_batch = """async function mainnetBatchBalance(addrs){
  // dataseed rejects oversized JSON-RPC batches — read in slices of 20,
  // rotating endpoints per slice.
  const data = a => "0x70a08231" + "000000000000000000000000" + a.slice(2).toLowerCase();
  const out = new Array(addrs.length);
  for (let s = 0; s < addrs.length; s += 20){
    const slice = addrs.slice(s, s + 20);
    const payload = slice.map((a, i) => ({ jsonrpc: "2.0", id: i, method: "eth_call", params: [{ to: REGISTRY_MAINNET, data: data(a) }, "latest"] }));
    let done = false;
    for (let u = 0; u < NETWORK.mainRpcs.length && !done; u++){
      try{
        const r = await fetch(NETWORK.mainRpcs[(s / 20 + u) % NETWORK.mainRpcs.length], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const j = await r.json();
        if (!Array.isArray(j)) continue;
        const part = new Array(slice.length);
        for (const item of j){ if (item && typeof item.id === "number" && item.result) part[item.id] = BigInt(item.result); }
        if (part.every(v => v !== undefined)){ part.forEach((v, i) => { out[s + i] = v; }); done = true; }
      }catch(e){}
    }
    if (!done) throw new Error("registry batch read failed");
  }
  return out;
}"""
patch("web/assets/app.js", [(old_batch, new_batch, 1)])

# ---------- 3. style.css additions ----------
css_add = """
/* visual QA fixes (2026-11-23) */
.stats{display:grid;grid-template-columns:repeat(4,1fr)}
@media(max-width:760px){.stats{grid-template-columns:repeat(2,1fr)}}
.create-grid{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:22px;align-items:start}
.create-grid .form{max-width:none}
.create-side{position:sticky;top:84px}
.create-side .f-sec{margin-top:0}
@media(max-width:900px){.create-grid{grid-template-columns:1fr}.create-side{position:static}}
.f-row input[type="checkbox"],.f-row input[type="radio"]{width:auto;padding:0;accent-color:var(--gold);vertical-align:-2px}
.demo-list{scrollbar-width:thin;scrollbar-color:#2c2c31 transparent}
.demo-list::-webkit-scrollbar{width:8px}
.demo-list::-webkit-scrollbar-thumb{background:#2c2c31;border-radius:4px}
.demo-list::-webkit-scrollbar-track{background:transparent}
"""
p = os.path.join(ROOT, "web", "assets", "style.css")
with open(p, encoding="utf-8") as fh:
    s = fh.read()
assert "visual QA fixes (2026-11-23)" not in s
with open(p, "w", encoding="utf-8") as fh:
    fh.write(s.rstrip("\n") + "\n" + css_add)
print("patched: web/assets/style.css (appended QA fixes)")

# ---------- 4. create.html two-column ----------
patch("web/create.html", [
    ("""  <div class="wrap">
    <div class="form">""",
     """  <div class="wrap">
    <div class="create-grid">
    <div class="form">""", 1),
    ("""    </div>
    <div class="f-sec" data-i18n="f_preview"></div>
    <div id="createPreview" style="max-width:430px"></div>
  </div>""",
     """    </div>
    <aside class="create-side">
    <div class="f-sec" data-i18n="f_preview"></div>
    <div id="createPreview"></div>
    </aside>
    </div>
  </div>""", 1),
])

# ---------- 5. card.html wrap fix ----------
patch("web/card.html", [
    ("""  </div>


    <div class="guide claimGuide" style="display:none">""",
     """

    <div class="guide claimGuide" style="display:none">""", 1),
    ("""    <div id="recordBox"><div class="empty" data-i18n="rec_none"></div></div>
</section>""",
     """    <div id="recordBox"><div class="empty" data-i18n="rec_none"></div></div>
  </div>
</section>""", 1),
])
print("ALL QA FIXES OK")
