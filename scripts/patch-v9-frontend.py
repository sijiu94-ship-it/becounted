#!/usr/bin/env python3
"""V9 frontend: APPS address/ABI switch, chain-labelled token presets,
custom (off-chain) prize option end-to-end, escrow hint copy fix."""
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

APP = "web/assets/app.js"

# ---------- config + ABI ----------
patch(APP, [
    ('const APPS_TESTNET     = "0xf197907879833d4bb507963a9bae5f3172f550f3"; // OneIDCampaignsV8',
     'const APPS_TESTNET     = "0x1ebff25f093c798ea301008b13c54fbc00348aec"; // OneIDCampaignsV9', 1),
    ('const APPS_DEPLOY_BLOCK = 144221089; // V5 deployment block: event scans start here',
     'const APPS_DEPLOY_BLOCK = 144329082; // V9 deployment block: event scans start here', 1),
    ('"function createRaffle(string, uint64, uint64, uint32, uint64, address, uint256, tuple(bool requireBinding, address gateToken, uint256 gateMin, bool gateIs721, uint256 requireEnteredId, uint32 minStamps, address questRef, bytes32 allowRoot)) payable returns (uint256)"',
     '"function createRaffle(string, uint64, uint64, uint32, uint64, address, uint256, tuple(bool requireBinding, address gateToken, uint256 gateMin, bool gateIs721, uint256 requireEnteredId, uint32 minStamps, address questRef, bytes32 allowRoot), string) payable returns (uint256)"', 1),
    ('bool reclaimed))",',
     'bool reclaimed, string prizeLabel))",', 1),
])

# ---------- i18n EN ----------
patch(APP, [
    ('  f_tok_usdt:"USDT (preset)", f_tok_usdc:"USDC (preset)",',
     '  f_tok_usdt:"USDT \\u00b7 {chain} (preset)", f_tok_usdc:"USDC \\u00b7 {chain} (preset)", f_tok_custom:"Custom prize (off-chain)", f_chain_main:"BSC mainnet", f_chain_test:"BSC testnet",\n  f_prize_label:"Prize description (stored on-chain)", f_prize_label_ph:"e.g. Partner whitelist spot \\u00d71", f_custom_hint:"Off-chain prizes are NOT escrowed by the contract. Winners are drawn on-chain; you deliver the prize to the winner list yourself.", f_err_label:"Describe the custom prize (1\\u201380 bytes).", c_custom_tag:"off-chain prize", d_custom_note:"Off-chain prize \\u2014 delivered by the creator to the winners; nothing is escrowed on-chain.", d_custom_claim:"You won \\u2014 the creator delivers this off-chain prize.",', 1),
    ('  f_prize_hint:"Prizes are paid by you directly to the winners after the draw. The contract never holds funds.",',
     '  f_prize_hint:"The prize is escrowed in the contract in full when you create the campaign. Winners claim on-chain; anything unclaimed for 30 days can be reclaimed by you.",', 1),
])
# ---------- i18n ZH ----------
patch(APP, [
    ('  f_tok_usdt:"USDT（预设）", f_tok_usdc:"USDC（预设）",',
     '  f_tok_usdt:"USDT \\u00b7 {chain}（预设）", f_tok_usdc:"USDC \\u00b7 {chain}（预设）", f_tok_custom:"自定义奖品（链下发放）", f_chain_main:"BSC 主网", f_chain_test:"BSC 测试网",\n  f_prize_label:"奖品说明（存上链）", f_prize_label_ph:"如：合作方白名单名额 \\u00d71", f_custom_hint:"链下奖品不由合约托管。中奖名单在链上开奖产生，奖品由你按名单自行发放。", f_err_label:"请填写自定义奖品说明（1\\u201380 字节）。", c_custom_tag:"链下奖品", d_custom_note:"链下奖品\\u2014\\u2014由发起人按中奖名单发放，合约不托管。", d_custom_claim:"你中奖了\\u2014\\u2014奖品由发起人链下发放。",', 1),
    ('  f_prize_hint:"奖品由你在开奖后直接发给中奖者。合约从不经手资金。",',
     '  f_prize_hint:"奖品在创建时全额托管进合约，中奖者链上自助领取；30 天未领的部分可由你回收。",', 1),
])

# ---------- create flow ----------
patch(APP, [
    # prizeTokenAddr: custom behaves like none (no token)
    ("""function prizeTokenAddr(){
  const sel = $("fTokenSel").value;
  if (sel === "none") return null;""",
     """function prizeTokenAddr(){
  const sel = $("fTokenSel").value;
  if (sel === "none" || sel === "custom") return null;""", 1),
    # switchCreateTab: reset custom when leaving raffle kind
    ("""function switchCreateTab(k){
  createKind = k;""",
     """function switchCreateTab(k){
  createKind = k;
  const _tsel0 = $("fTokenSel"); if (_tsel0 && k !== 0 && _tsel0.value === "custom") _tsel0.value = "none";""", 1),
    # per-winner row excludes custom; label row visibility
    ('  $("fPerWinnerRow").style.display = (k===0 && $("fTokenSel").value !== "none") ? "" : "none";',
     '  $("fPerWinnerRow").style.display = (k===0 && $("fTokenSel").value !== "none" && $("fTokenSel").value !== "custom") ? "" : "none";\n  if ($("fPrizeLabelRow")) $("fPrizeLabelRow").style.display = (k===0 && $("fTokenSel").value === "custom") ? "" : "none";', 1),
    # token select change listener
    ("""    const tsel = $("fTokenSel");
    if (tsel) tsel.addEventListener("change", () => {
      $("fTokenAddrRow").style.display = tsel.value === "erc20" ? "" : "none";
      $("fPerWinnerRow").style.display = (tsel.value !== "none" && createKind === 0) ? "" : "none";
    });""",
     """    const tsel = $("fTokenSel");
    if (tsel) tsel.addEventListener("change", () => {
      $("fTokenAddrRow").style.display = tsel.value === "erc20" ? "" : "none";
      $("fPerWinnerRow").style.display = (tsel.value !== "none" && tsel.value !== "custom" && createKind === 0) ? "" : "none";
      if ($("fPrizeLabelRow")) $("fPrizeLabelRow").style.display = (tsel.value === "custom" && createKind === 0) ? "" : "none";
      renderPreview();
    });""", 1),
    # validation: amount check skips custom; label required 1..80 bytes
    ('    if (sel !== "none" && markErr("fPerWinner", !(parseFloat($("fPerWinner")?.value || "0") > 0))) errs.push(t("e_prize"));',
     '    if (sel !== "none" && sel !== "custom" && markErr("fPerWinner", !(parseFloat($("fPerWinner")?.value || "0") > 0))) errs.push(t("e_prize"));\n    if (sel === "custom"){ const _lb = ($("fPrizeLabel")?.value || "").trim(); const _bl = new TextEncoder().encode(_lb).length; if (markErr("fPrizeLabel", !(_bl >= 1 && _bl <= 80))) errs.push(t("f_err_label")); }', 1),
    # submit: pass the label
    ('      await (await apps.createRaffle(title, startAt, endAt, winners, seedBlock, token, per, cond, { value })).wait();',
     '      const prizeLabel = ($("fTokenSel").value === "custom") ? ($("fPrizeLabel").value || "").trim() : "";\n      await (await apps.createRaffle(title, startAt, endAt, winners, seedBlock, token, per, cond, prizeLabel, { value })).wait();', 1),
    # preview keyline for custom
    ("""    keyline = sel !== "none" && parseFloat($("fPerWinner")?.value || "0") > 0
      ? `<b>${$("fPerWinner").value} ${sel === "bnb" ? "BNB" : sel.toUpperCase()}</b> \\u00d7 ${w}`
      : `${w} ${t("c_winners")}`;""",
     """    keyline = sel === "custom"
      ? `<b>${(($("fPrizeLabel")?.value || "").trim() || t("f_prize_label")).replace(/</g, "&lt;")}</b> \\u00b7 ${t("c_custom_tag")} \\u00d7 ${w}`
      : sel !== "none" && parseFloat($("fPerWinner")?.value || "0") > 0
      ? `<b>${$("fPerWinner").value} ${sel === "bnb" ? "BNB" : sel.toUpperCase()}</b> \\u00d7 ${w}`
      : `${w} ${t("c_winners")}`;""", 1),
])

# ---------- preset chain relabel ----------
patch(APP, [
    ('window.onLangChange = () => { renderConnectBtn(); if ($("campGrid")) loadCampaigns(); if ($("feedList")) loadFeed(); if ($("mineGrid")) loadMine(); if ($("questBox")) loadQuest(); };',
     'window.onLangChange = () => { renderConnectBtn(); labelPresetOptions(); if ($("campGrid")) loadCampaigns(); if ($("feedList")) loadFeed(); if ($("mineGrid")) loadMine(); if ($("questBox")) loadQuest(); };\nfunction labelPresetOptions(){\n  const sel = $("fTokenSel"); if (!sel) return;\n  const chain = t(NETWORK.appsChainId === 56 ? "f_chain_main" : "f_chain_test");\n  for (const v of ["usdt", "usdc"]){\n    const opt = sel.querySelector(`option[value="${v}"]`);\n    if (opt) opt.textContent = t(v === "usdt" ? "f_tok_usdt" : "f_tok_usdc").replace("{chain}", chain);\n  }\n}', 1),
    ("""    switchCreateTab(0);
  }
});""",
     """    labelPresetOptions();
    switchCreateTab(0);
  }
});""", 1),
])

# ---------- display: card / detail / cert ----------
patch(APP, [
    ("""        const hasPrize = isRaffle && c.prizePerWinner > 0n;
        if(isRaffle){
          keyline = hasPrize
            ? `<b>${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)}</b> \\u00d7 ${c.winnerCount} \\u00b7 ${c.entryCount} ${t("c_entries")}`
            : `${c.winnerCount} ${t("c_winners")} \\u00b7 ${c.entryCount} ${t("c_entries")}`;""",
     """        const hasPrize = isRaffle && c.prizePerWinner > 0n;
        const hasCustom = isRaffle && !hasPrize && !!c.prizeLabel;
        if(isRaffle){
          keyline = hasPrize
            ? `<b>${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)}</b> \\u00d7 ${c.winnerCount} \\u00b7 ${c.entryCount} ${t("c_entries")}`
            : hasCustom
            ? `<b>${String(c.prizeLabel).replace(/</g, "&lt;")}</b> \\u00b7 ${t("c_custom_tag")} \\u00b7 ${c.entryCount} ${t("c_entries")}`
            : `${c.winnerCount} ${t("c_winners")} \\u00b7 ${c.entryCount} ${t("c_entries")}`;""", 1),
    # detail foot: winner note for custom prizes
    ("""      if (c.drawn && c.prizePerWinner > 0n){
        if (!myAddr || (myState.winner && !myState.prizeClaimed)) foot += ` <button class="btn ghost" onclick="claimPrize(${id})">${t("c_claim_prize")}</button>`;
        else if (myState.prizeClaimed) foot += ` <span class="count">${t("j_won_claimed")}</span>`;
      }""",
     """      if (c.drawn && c.prizePerWinner > 0n){
        if (!myAddr || (myState.winner && !myState.prizeClaimed)) foot += ` <button class="btn ghost" onclick="claimPrize(${id})">${t("c_claim_prize")}</button>`;
        else if (myState.prizeClaimed) foot += ` <span class="count">${t("j_won_claimed")}</span>`;
      }
      if (c.drawn && c.prizePerWinner === 0n && c.prizeLabel && myState.winner) foot += ` <span class="count">${t("d_custom_claim")}</span>`;""", 1),
    # trust row: three-way
    ('${(c.prizePerWinner > 0n || c.pool > 0n) ? t("d_escrow") : t("d_escrow_no")}</div>`;',
     '${(c.prizePerWinner > 0n || c.pool > 0n) ? t("d_escrow") : (c.prizeLabel ? t("d_custom_note") : t("d_escrow_no"))}</div>`;', 1),
    # sticky bar: custom label as info when entering
    ('      if (kind === 0 && live && !myState.entered){ sAct = `<button class="btn" onclick="enterRaffle(${id})">${t("c_enter")}</button>`; sInfo = c.prizePerWinner > 0n ? `${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)}` : String(c.title).replace(/</g, "&lt;"); }',
     '      if (kind === 0 && live && !myState.entered){ sAct = `<button class="btn" onclick="enterRaffle(${id})">${t("c_enter")}</button>`; sInfo = c.prizePerWinner > 0n ? `${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)}` : (c.prizeLabel ? String(c.prizeLabel).replace(/</g, "&lt;") : String(c.title).replace(/</g, "&lt;")); }', 1),
    # cert line: custom label
    ('    if (c.prizePerWinner > 0n) key += `  \\u00b7  ${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)} ${t("cert_each")}`;',
     '    if (c.prizePerWinner > 0n) key += `  \\u00b7  ${fmtAmt(c.prizePerWinner)} ${tokenLabel(c.prizeToken)} ${t("cert_each")}`;\n    else if (c.prizeLabel) key += `  \\u00b7  ${String(c.prizeLabel)} (${t("c_custom_tag")})`;', 1),
])

# ---------- create.html: option + label row ----------
patch("web/create.html", [
    ('          <option value="erc20" data-i18n="f_tok_erc20"></option>',
     '          <option value="erc20" data-i18n="f_tok_erc20"></option>\n          <option value="custom" data-i18n="f_tok_custom"></option>', 1),
    ("""      <div class="f-row" id="fTokenAddrRow" style="display:none">
        <label data-i18n="f_token_addr"></label>
        <input id="fTokenAddr" placeholder="0x…" spellcheck="false">
      </div>""",
     """      <div class="f-row" id="fTokenAddrRow" style="display:none">
        <label data-i18n="f_token_addr"></label>
        <input id="fTokenAddr" placeholder="0x…" spellcheck="false">
      </div>
      <div class="f-row" id="fPrizeLabelRow" style="display:none">
        <label data-i18n="f_prize_label"></label>
        <input id="fPrizeLabel" data-i18n-ph="f_prize_label_ph" maxlength="80" autocomplete="off">
        <div class="hint" data-i18n="f_custom_hint"></div>
      </div>""", 1),
])
print("ALL V9 FRONTEND PATCHES OK")
