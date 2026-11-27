#!/usr/bin/env python3
"""Fix the homepage stats strip: the </header> close tag and the marquee block were
inserted between the first stat and the remaining three, breaking the grid.
Move the three stats back into .strip-in, close strip+header, marquee after."""
import os

ROOT = os.path.expanduser("~/workspace/agentid-hackathon")
p = os.path.join(ROOT, "web", "index.html")
with open(p, encoding="utf-8") as fh:
    s = fh.read()

old = """<div class="strip">
  <div class="wrap strip-in">
    <div class="stat"><b id="statCampaigns">–</b><span data-i18n="stat_campaigns"></span></div>
</header>
"""
new = """<div class="strip">
  <div class="wrap strip-in">
    <div class="stat"><b id="statCampaigns">–</b><span data-i18n="stat_campaigns"></span></div>
    <div class="stat"><b id="statEntries">–</b><span data-i18n="stat_entries"></span></div>
    <div class="stat"><b id="statHumans">–</b><span data-i18n="stat_humans"></span></div>
    <div class="stat"><b id="statPayouts">–</b><span data-i18n="stat_payouts"></span></div>
  </div>
</div>
</header>
"""
# Remove the stray tail FIRST: after the head replacement the same block would
# exist twice and the tail pattern would no longer be unique.
old_tail = """
    <div class="stat"><b id="statEntries">–</b><span data-i18n="stat_entries"></span></div>
    <div class="stat"><b id="statHumans">–</b><span data-i18n="stat_humans"></span></div>
    <div class="stat"><b id="statPayouts">–</b><span data-i18n="stat_payouts"></span></div>
  </div>
</div>
"""
assert s.count(old_tail) == 1, "stray stats tail block not found"
s = s.replace(old_tail, "\n")

assert s.count(old) == 1, "strip head block not found"
s = s.replace(old, new)

with open(p, "w", encoding="utf-8") as fh:
    fh.write(s)
print("index.html strip fixed")
