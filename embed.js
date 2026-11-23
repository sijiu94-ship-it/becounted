/* BeCounted embeddable human-check widget.
   Usage:
     <div data-becounted-check></div>
     <script src="https://becounted.9nosing.com/embed.js"></script>
   Optional: data-lang="zh" | "en" on the div (default: browser language).
   Read-only: one eth_call (balanceOf) to the Agent ID registry on BNB Chain.
   No keys, no signing, no tracking. */
(function () {
  var REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
  var RPCS = ["https://bsc-dataseed.binance.org", "https://bsc-dataseed1.bnbchain.org", "https://bsc-dataseed2.bnbchain.org"];
  var STR = {
    en: { label: "Is this address a unique human?", btn: "Check", reading: "Reading the registry...", yes: "Verified unique human - holds an Agent ID.", no: "No Agent ID found for this address.", invalid: "That does not look like an address.", err: "Could not read the registry. Try again.", by: "Powered by BeCounted" },
    zh: { label: "这个地址是真人吗？", btn: "查真人", reading: "正在读取注册表…", yes: "已验证真人——持有 Agent ID。", no: "这个地址没有 Agent ID。", invalid: "这不像一个地址。", err: "注册表读取失败，请重试。", by: "由 BeCounted 提供" }
  };
  function isAddr(a) { return /^0x[0-9a-fA-F]{40}$/.test(a); }
  function call(addr) {
    var data = "0x70a08231" + "000000000000000000000000" + addr.slice(2).toLowerCase();
    var body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: REGISTRY, data: data }, "latest"] });
    var i = 0;
    function attempt() {
      return fetch(RPCS[i], { method: "POST", headers: { "content-type": "application/json" }, body: body })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.result) throw new Error("bad response");
          return parseInt(j.result, 16) > 0;
        })
        .catch(function (e) { i++; if (i < RPCS.length) return attempt(); throw e; });
    }
    return attempt();
  }
  function render(box) {
    var lang = box.getAttribute("data-lang") || ((navigator.language || "en").toLowerCase().indexOf("zh") === 0 ? "zh" : "en");
    var s = STR[lang] || STR.en;
    box.innerHTML = "";
    box.style.cssText = "background:#101012;border:1px solid #26262b;border-radius:14px;padding:18px;max-width:520px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#ececec";
    var lab = document.createElement("div");
    lab.textContent = s.label;
    lab.style.cssText = "font-weight:700;font-size:15px;margin-bottom:10px";
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px";
    var inp = document.createElement("input");
    inp.placeholder = "0x\u2026"; inp.spellcheck = false;
    inp.style.cssText = "flex:1;background:#0a0a0b;border:1px solid #26262b;border-radius:9px;color:#ececec;padding:10px 12px;font-size:14px;outline:none;min-width:0";
    var btn = document.createElement("button");
    btn.textContent = s.btn;
    btn.style.cssText = "background:#f0b90b;border:0;border-radius:9px;color:#0a0a0b;font-weight:700;padding:10px 16px;font-size:14px;cursor:pointer;white-space:nowrap";
    var out = document.createElement("div");
    out.style.cssText = "margin-top:10px;font-size:13.5px;line-height:1.55;display:none";
    var by = document.createElement("div");
    by.style.cssText = "margin-top:10px;font-size:11.5px;color:#6d6d75";
    var link = document.createElement("a");
    link.href = "https://becounted.9nosing.com/";
    link.target = "_blank"; link.rel = "noopener";
    link.style.cssText = "color:#9a9aa3;text-decoration:none";
    link.textContent = s.by + " \u2197";
    by.appendChild(link);
    row.appendChild(inp); row.appendChild(btn);
    box.appendChild(lab); box.appendChild(row); box.appendChild(out); box.appendChild(by);
    function go() {
      var a = inp.value.trim();
      out.style.display = "";
      if (!isAddr(a)) { out.style.color = "#e5534b"; out.textContent = s.invalid; return; }
      if (a.toLowerCase() === "0x0000000000000000000000000000000000000000") { out.style.color = "#e5534b"; out.textContent = s.no; return; }
      out.style.color = "#9a9aa3"; out.textContent = s.reading;
      call(a).then(function (h) {
        out.style.color = h ? "#f0b90b" : "#e5534b";
        out.textContent = h ? "\u2713 " + s.yes : s.no;
      }).catch(function () { out.style.color = "#e5534b"; out.textContent = s.err; });
    }
    btn.addEventListener("click", go);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
  }
  function init() { document.querySelectorAll("[data-becounted-check]").forEach(render); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
