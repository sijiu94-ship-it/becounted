#!/usr/bin/env python3
"""Add whitepaper section 08 'The Mark' (brand emblem story, EN+ZH)."""
import os

WEB = "/home/hatch/workspace/agentid-hackathon/web"

EN_OLD = 'wp7_p:"Currently live on BSC testnet. Mainnet addresses replace these at launch, verified on BscScan."'
EN_NEW = EN_OLD + (', wp8_h:"The Mark", '
  'wp8_1:"At the center stands the human. BeCounted verifies one thing — that a participant is a unique real human — so the human stands in front, and everything else serves them.", '
  'wp8_2:"Behind the human, two keys are crossed like a swordsman\'s blades: the two-key principle. One key answers \'is this a unique human?\' — checked on every entry. The other answers \'has this human been counted in this campaign?\' — once per campaign, never twice. Together they guard the fairness of every campaign: one human, one entry, no bot farms.", '
  'wp8_3:"The disc is a golden seal. To be counted is to be stamped — the same stamp a participant earns each day of the Genesis Expedition. Gold is the color of the ecosystem we build on; the circle means no one missing, no one counted twice."')

ZH_OLD = 'wp7_p:"当前运行于 BSC 测试网；主网地址将在上线时替换此处，并已在 BscScan 验证。"'
ZH_NEW = ZH_OLD + (', wp8_h:"标志", '
  'wp8_1:"中央是真人。BeCounted 验的始终只有一件事——参加者是不是独一无二的真人；所以人站在最前面，其余一切为他服务。", '
  'wp8_2:"人身后交叉着两把钥匙，如侠客背后的双剑，即两键原则。一把回答「是不是真人」，每次参加都查；一把回答「这个人算没算过」，每场活动只数一次。两把钥匙守的是公平：一人一次，机器人进不来。", '
  'wp8_3:"金盘是一枚印。被数上，即为印记——与真人远征中每日盖下的印记同一枚。金色是所建生态的颜色；圆，取一个不多、一个不少之意。"')

app_p = os.path.join(WEB, "assets", "app.js")
s = open(app_p, encoding="utf-8").read()
assert s.count(EN_OLD) == 1 and s.count(ZH_OLD) == 1
s = s.replace(EN_OLD, EN_NEW).replace(ZH_OLD, ZH_NEW)
open(app_p, "w", encoding="utf-8").write(s)
print("patched app.js (wp8 keys EN+ZH)")

SECTION = """<section>
  <div class="wrap">
    <div class="sec-head"><span class="sec-no">08</span><h2 data-i18n="wp8_h"></h2></div>
    <img src="assets/icon-512.png" alt="BeCounted emblem" style="width:168px;height:168px;border-radius:28px;display:block;margin:4px 0 18px">
    <p style="color:var(--muted);font-size:16.5px;line-height:1.75;max-width:800px;margin-bottom:14px" data-i18n="wp8_1"></p>
    <p style="color:var(--muted);font-size:16.5px;line-height:1.75;max-width:800px;margin-bottom:14px" data-i18n="wp8_2"></p>
    <p style="color:var(--muted);font-size:16.5px;line-height:1.75;max-width:800px;margin-bottom:14px" data-i18n="wp8_3"></p>

  </div>
</section>

<footer>"""

wp_p = os.path.join(WEB, "whitepaper.html")
h = open(wp_p, encoding="utf-8").read()
assert h.count("\n<footer>") == 1 and "wp8_h" not in h
h = h.replace("\n<footer>", "\n" + SECTION, 1)
open(wp_p, "w", encoding="utf-8").write(h)
print("patched whitepaper.html (section 08)")
print("DONE")
