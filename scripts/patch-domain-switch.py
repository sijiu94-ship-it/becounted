#!/usr/bin/env python3
"""Switch the site address from the github.io path to https://becounted.9nosing.com/.
Every replacement is asserted; a failed assert aborts before any later file is written."""
import os, sys

ROOT = os.path.expanduser("~/workspace/agentid-hackathon")
OLD = "https://sijiu94-ship-it.github.io/becounted/"
NEW = "https://becounted.9nosing.com/"

def patch(relpath, pairs):
    p = os.path.join(ROOT, relpath)
    with open(p, encoding="utf-8") as fh:
        s = fh.read()
    for old, new, count in pairs:
        n = s.count(old)
        assert n == count, f"{relpath}: expected {count}x {old!r}, found {n}"
        s = s.replace(old, new)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("patched:", relpath)

# 1. app.js SITE_URL
patch("web/assets/app.js", [
    (f'const SITE_URL = "{OLD}";', f'const SITE_URL = "{NEW}";', 1),
])

# 2. embed.js: usage comment + link target
patch("web/embed.js", [
    (f'<script src="{OLD}embed.js"></script>', f'<script src="{NEW}embed.js"></script>', 1),
    (f'link.href = "{OLD}";', f'link.href = "{NEW}";', 1),
])

# 3. builders.html embed snippet
patch("web/builders.html", [
    (f"&lt;script src=\"{OLD}embed.js\"&gt;", f"&lt;script src=\"{NEW}embed.js\"&gt;", 1),
    ('<meta property="og:image" content="assets/og.png">',
     f'<meta property="og:image" content="{NEW}assets/og.png">\n<meta property="og:url" content="{NEW}">', 1),
])

# 4. remaining 11 pages: og:image -> absolute + og:url
pages = ["index", "campaigns", "create", "how", "card", "mine", "creator",
         "campaign", "bind", "whitepaper", "expedition"]
for name in pages:
    patch(f"web/{name}.html", [
        ('<meta property="og:image" content="assets/og.png">',
         f'<meta property="og:image" content="{NEW}assets/og.png">\n<meta property="og:url" content="{NEW}">', 1),
    ])

# 5. docs
patch("docs/submission-draft.md", [
    (f"- **官网**：{OLD}", f"- **官网**：{NEW}", 1),
])
patch("docs/adoption-pitch.md", [
    (OLD, NEW, 1),
])

# 6. check script demo-profile link
patch("scripts/check-frontend-config.js", [
    (OLD, NEW, 1),
])

# 7. LAUNCH-RUNBOOK: domain decision + PAT line now settled facts
patch("LAUNCH-RUNBOOK.md", [
    ("""- [ ] **域名 / SITE_URL 决策定死**（推送前端前必须定，中途不换——分享文案与 og:image 都印它）：
  - 方案 A（默认）：维持 GitHub Pages 地址 `https://sijiu94-ship-it.github.io/becounted/`，SITE_URL 不变。
  - 方案 B：自定义域名（becounted.com / .net / .xyz 均已被注册，可选 getbecounted.com、becounted.app 等）。需用户购买后：仓库加 CNAME 文件、DNS 解析指向 GitHub Pages、等 HTTPS 证书签发完成，再把 SITE_URL 改为新域名。证书没签发完不要切换。""",
     """- [x] **域名 / SITE_URL 已定死并切换完成**（2026-11-23）：自定义域名 `https://becounted.9nosing.com/`（根域名 9nosing.com 子域名；用户曾虑长度，最终拍板沿用）。Cloudflare CNAME（becounted → sijiu94-ship-it.github.io、代理关闭）与 GitHub Pages 自定义域名均已设置，HTTPS 证书已签发、强制 HTTPS 已开，均经实测。本地 web/ 已切换：SITE_URL、embed.js、开发者页示例、全部页面 og:image（绝对地址）+ og:url、CNAME 文件均指向新域名。推送时随其他文件一并上线，推送后实测新域名内容为最新版即可。""", 1),
    ("""- [ ] **GitHub PAT 就位**：推送 Pages 需要用户的细粒度 PAT（名 becounted-push，仅 `sijiu94-ship-it/becounted` 仓库 Contents 读写，有效期至 2026-12-21）。令牌不存本机，上线日向用户索取。""",
     """- [ ] **GitHub PAT 就位**：推送 Pages 需要用户的细粒度 PAT（名 humangate-push，仅 `sijiu94-ship-it/humangate` 仓库 Contents 读写，有效期至 2026-12-21）。仓库改名 becounted 未做（自定义域名已生效，站点地址不受影响，可选）。令牌不存本机，推送时向用户索取。""", 1),
])

# 8. CNAME file for the repo root (= web/ contents)
cname = os.path.join(ROOT, "web", "CNAME")
with open(cname, "w", encoding="utf-8") as fh:
    fh.write("becounted.9nosing.com\n")
print("wrote:", cname)

# 9. PLAN.md history note
with open(os.path.join(ROOT, "PLAN.md"), "a", encoding="utf-8") as fh:
    fh.write("""
## 域名绑定与全站地址切换（2026-11-23）

- 用户完成 Cloudflare CNAME（becounted → sijiu94-ship-it.github.io，代理关闭）+ GitHub Pages 自定义域名设置；Muse 实测：DNS 解析正确、HTTPS 200、HTTP 自动跳 HTTPS。
- 用户曾问 becounted.9nosing.com 是否过长；核查 becounted.app / becounted.io 均未注册可作平替，用户最终拍板沿用 becounted.9nosing.com（根域名是人、子域名是项目的结构优先）。
- 本地 web/ 已全量切换：app.js SITE_URL、embed.js 两处、builders.html 示例、12 页 og:image 改绝对地址并新增 og:url、新增 web/CNAME；docs/submission-draft.md 与 adoption-pitch.md 的官网地址、LAUNCH-RUNBOOK 的域名/PAT 条目、check-frontend-config.js 的演示资料链接均已同步。gh_push.py 已补 becounted-skill.md、CNAME 与全套图标文件（PNG/ICO 走 base64 blob）。以上随下一次 PAT 推送一并上线。
""")
print("appended: PLAN.md")
print("ALL PATCHES OK")
