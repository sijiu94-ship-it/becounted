import glob

# ---------- bind.html: attestation section ----------
p = 'web/bind.html'
s = open(p, encoding='utf-8').read()
anchor = '''    <div class="sec-head" style="margin-top:40px"><h2 style="font-size:22px" data-i18n="bind_verify_h"></h2></div>'''
section = '''    <div class="sec-head" style="margin-top:40px"><h2 style="font-size:22px" data-i18n="bind_attest_h"></h2></div>
    <p style="color:var(--muted);max-width:640px;line-height:1.7" data-i18n="bind_attest_sub"></p>
    <div class="form" style="max-width:640px;margin-top:14px">
      <div class="f-row"><label>X</label><input type="text" id="aHandle" data-i18n-ph="bind_handle_ph" autocomplete="off"></div>
      <div class="f-row"><label>Address</label><input type="text" id="aAddr" data-i18n-ph="bind_agentic_ph" autocomplete="off"></div>
      <button class="btn" onclick="makeAttestation()" data-i18n="bind_attest_make"></button>
      <div id="attestOut" style="margin-top:16px"></div>
      <div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn ghost" onclick="attestStatus()" data-i18n="bind_attest_check"></button>
        <span id="attestStatusOut" style="font-size:13px;color:var(--gold)"></span>
      </div>
    </div>
'''
assert anchor in s
s = s.replace(anchor, section + anchor)
open(p, 'w', encoding='utf-8').write(s)
print('bind.html patched')

# ---------- app.js ----------
p = 'web/assets/app.js'
s = open(p, encoding='utf-8').read()

s = s.replace('const APPS_TESTNET = "0x1ebff25f093c798ea301008b13c54fbc00348aec";',
              'const APPS_TESTNET = "0x9dac1ccb350a3568a7858f3874b06a69a61aa426";')
s = s.replace('const BINDINGS_TESTNET = "0x6e17c5ddc3be1cb4443b6cbb64c1b520fd80d5f2";',
              'const BINDINGS_TESTNET = "0x3b5a6cd4ae21cf100da21197a58be6d6d406f843";')
s = s.replace('const APPS_DEPLOY_BLOCK = 144329082;', 'const APPS_DEPLOY_BLOCK = 144360363;')

s = s.replace('"function registerBinding(string,bytes)"',
              '"function registerBinding(string,bytes)", "function proofTypeOf(address) view returns (uint8)", "function registerByAttestation(address,string)"')

en_anchor = 'bind_onchain: "Binding also registered on-chain",'
assert en_anchor in s
s = s.replace(en_anchor, en_anchor + '''
  bind_attest_h:"Bind an Agentic Wallet address (post attestation)", bind_attest_sub:"An Agentic Wallet cannot sign messages, so it cannot use the signature flow above. Post one public tweet from your X account naming your Agentic address; the project verifies it and registers the binding on-chain, labelled as attested. Weaker than a signature — and labelled as such, permanently.", bind_attest_make:"Generate my verification tweet", bind_attest_post:"Post it on X", bind_attest_note:"After posting, send the tweet link to the project (X DM or the community thread). The registrar completes the registration — you make no contract call. Then check the status here.", bind_attest_check:"Check registration status", bind_attest_none:"No binding registered for this address yet.", bind_attest_sig:"Registered — signature proof.", bind_attest_proof:"Registered — public-post attestation.", bind_attested_tag:"attested", bind_agentic_ph:"0x… (Agentic Wallet address)",''')

zh_anchor = 'bind_onchain: "\\u8be5\\u7ed1\\u5b9a\\u5df2\\u5728\\u94fe\\u4e0a\\u767b\\u8bb0",'
assert zh_anchor in s, "zh anchor"
s = s.replace(zh_anchor, zh_anchor + '''
  bind_attest_h:"绑定 Agentic Wallet 地址（帖文见证）", bind_attest_sub:"Agentic Wallet 不能签消息，走不了上面的签名流程。改用公开证明：用你的 X 账号发一条写明 Agentic 地址的推文，项目方核对后上链登记，并永久标注为见证。它比签名弱——这一点如实标明。", bind_attest_make:"生成我的验证推文", bind_attest_post:"去 X 发推", bind_attest_note:"发完把推文链接发给项目方（X 私信或社群帖）。登记由登记员完成，你不需要调合约；之后在这里查状态。", bind_attest_check:"查登记状态", bind_attest_none:"这个地址还没有登记绑定。", bind_attest_sig:"已登记——签名证明。", bind_attest_proof:"已登记——公开帖文见证。", bind_attested_tag:"见证", bind_agentic_ph:"0x…（Agentic Wallet 地址）",''')

# creatorLabel: distinguish attested bindings
old_cb = '''        const b = await bindingsRead.bindingOf(addr);
        if(!b[0]) return null;
        return (await bindingsRead.isBindingValid(addr)) ? b[0] : null;'''
new_cb = '''        const b = await bindingsRead.bindingOf(addr);
        if(!b[0]) return null;
        if(!(await bindingsRead.isBindingValid(addr))) return null;
        let pt = 0; try{ pt = Number(await bindingsRead.proofTypeOf(addr)); }catch(e){}
        return { h: b[0], pt };'''
assert old_cb in s
s = s.replace(old_cb, new_cb)
old_cl = '''  const h = await creatorBinding(addr);
  return h
    ? `<a href="creator.html?a=${addr}" style="color:var(--gold);text-decoration:none">@${h} \\u2713</a>`
    : `<a href="creator.html?a=${addr}" style="color:inherit;text-decoration:none">${short(addr)}</a>`;'''
new_cl = '''  const cb = await creatorBinding(addr);
  if(!cb) return `<a href="creator.html?a=${addr}" style="color:inherit;text-decoration:none">${short(addr)}</a>`;
  const mark = cb.pt === 1 ? ` \\u00b7 ${t("bind_attested_tag")}` : " \\u2713";
  return `<a href="creator.html?a=${addr}" style="color:var(--gold);text-decoration:none">@${cb.h}${mark}</a>`;'''
assert old_cl in s, "creatorLabel anchor"
s = s.replace(old_cl, new_cl)

# attestation functions, inserted before verifyBinding
anchor_fn = 'window.verifyBinding = async () => {'
new_fns = '''window.makeAttestation = async () => {
  const out = $("attestOut"); if(out) out.innerHTML = "…";
  try{
    const handle = ($("aHandle").value || "").trim().replace(/^@/, "").toLowerCase();
    const address = ethers.getAddress(($("aAddr").value || "").trim());
    if(!handle) throw new Error("handle");
    const code = "BC-" + ethers.keccak256(ethers.toUtf8Bytes(address.toLowerCase() + "@" + handle)).slice(2, 8).toUpperCase();
    const tweet = `BeCounted binding verification\\nHandle: @${handle}\\nAddress: ${address}\\nCode: ${code}\\n#BeCountedBind`;
    const tweetUrl = "https://x.com/intent/tweet?text=" + encodeURIComponent(tweet);
    out.innerHTML = `<div class="rows"><div class="row"><span>X</span><b>@${handle}</b></div>
      <div class="row"><span>Address</span><b style="word-break:break-all;text-align:right;max-width:60%">${address}</b></div>
      <div class="row"><span>Code</span><b>${code}</b></div></div>
      <p style="margin-top:14px;color:var(--muted)">${t("bind_attest_note")}</p>
      <button class="btn sm" onclick="window.open('${tweetUrl}', '_blank')">${t("bind_attest_post")}</button>`;
  }catch(e){ if(out) out.innerHTML = `<span style="color:#ff7a7a">${t("tx_fail")}</span>`; }
};
window.attestStatus = async () => {
  const out = $("attestStatusOut"); if(out) out.textContent = "…";
  try{
    const address = ethers.getAddress(($("aAddr").value || "").trim());
    chain();
    const b = await bindingsRead.bindingOf(address);
    if(!b[0]){ out.textContent = t("bind_attest_none"); return; }
    const pt = Number(await bindingsRead.proofTypeOf(address));
    out.textContent = "@" + b[0] + " — " + (pt === 1 ? t("bind_attest_proof") : t("bind_attest_sig"));
  }catch(e){ if(out) out.textContent = t("tx_fail"); }
};
'''
assert anchor_fn in s
s = s.replace(anchor_fn, new_fns + anchor_fn)

s = s.replace('1122a', '1122b')
open(p, 'w', encoding='utf-8').write(s)
for f in glob.glob('web/*.html'):
    t = open(f, encoding='utf-8').read()
    if '1122a' in t: open(f, 'w', encoding='utf-8').write(t.replace('1122a', '1122b'))
print('app.js patched + version 1122b')
