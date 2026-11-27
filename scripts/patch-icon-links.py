#!/usr/bin/env python3
"""Wire the BeCounted gold-disc icon into all 12 site pages.

- Adds favicon / apple-touch-icon / theme-color links to every <head>.
- Replaces the generic inline-SVG brand glyph in the nav with the emblem.
- Adds the .brand-ic sizing rule to style.css.
Every replacement is asserted to land exactly once per file.
"""
import glob, os, sys

WEB = "/home/hatch/workspace/agentid-hackathon/web"

ICON_LINKS = """<link rel="icon" href="assets/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="assets/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png">
<meta name="theme-color" content="#0a0a0b">
<link rel="stylesheet" href="assets/style.css">"""

OLD_SVG = ('<svg width="26" height="26" viewBox="0 0 26 26" fill="none">'
           '<rect x="1" y="1" width="24" height="24" rx="6" stroke="#f0b90b" stroke-width="2"/>'
           '<circle cx="13" cy="12" r="3.4" fill="#f0b90b"/>'
           '<rect x="11.9" y="14" width="2.2" height="5" rx="1.1" fill="#f0b90b"/></svg>')
NEW_IMG = '<img class="brand-ic" src="assets/icon-192.png" alt="BeCounted">'

pages = sorted(glob.glob(os.path.join(WEB, "*.html")))
assert len(pages) == 12, pages
for p in pages:
    s = open(p, encoding="utf-8").read()
    if "favicon-32.png" not in s:
        assert s.count('<link rel="stylesheet" href="assets/style.css">') == 1, p
        s = s.replace('<link rel="stylesheet" href="assets/style.css">', ICON_LINKS)
    assert s.count(OLD_SVG) == 1, (p, "brand svg")
    s = s.replace(OLD_SVG, NEW_IMG)
    open(p, "w", encoding="utf-8").write(s)
    print("patched", os.path.basename(p))

css_p = os.path.join(WEB, "assets", "style.css")
css = open(css_p, encoding="utf-8").read()
if ".brand-ic" not in css:
    anchor = ".brand{display:flex;align-items:center;gap:11px;text-decoration:none;flex-shrink:0}"
    assert css.count(anchor) == 1
    css = css.replace(anchor, anchor + "\n.brand-ic{width:26px;height:26px;border-radius:7px;display:block}")
    open(css_p, "w", encoding="utf-8").write(css)
    print("patched style.css")
print("DONE")
