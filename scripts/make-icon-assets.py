#!/usr/bin/env python3
"""Generate BeCounted icon assets from the approved gold-disc artwork.

Source: the AI-generated gold disc emblem (person + crossed keys on a gold
disc, black surround). Produces the favicon set and a fresh og.png
(1200x630) carrying the new brand. Run from anywhere; paths are absolute.
"""
from PIL import Image, ImageDraw, ImageFont
import os

SRC = "/home/hatch/workspace/imagine_media/media-generation-becounted-icon-golddisc-0-f3f7a570-3119-4ca3-a8fc-c1a6d2545eef.webp"
ASSETS = "/home/hatch/workspace/agentid-hackathon/web/assets"

GOLD = (240, 185, 11)
BG = (10, 10, 11)
WHITE = (245, 245, 244)
GRAY = (154, 154, 151)

src = Image.open(SRC).convert("RGB")
assert src.size == (1600, 1600), src.size
# Crush the artwork's near-black surround to the site's background tone so
# the square edge disappears on dark pages (silhouettes stay flat black).
src = src.point(lambda v: 10 if v < 40 else v)

def save_size(n, name):
    src.resize((n, n), Image.LANCZOS).save(os.path.join(ASSETS, name))
    print("wrote", name)

save_size(16, "favicon-16.png")
save_size(32, "favicon-32.png")
save_size(48, "favicon-48.png")
save_size(180, "apple-touch-icon.png")
save_size(192, "icon-192.png")
save_size(512, "icon-512.png")
src.resize((256, 256), Image.LANCZOS).save(
    os.path.join(ASSETS, "favicon.ico"), format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)])
print("wrote favicon.ico")

# ---- og.png 1200x630 ----
W, H = 1200, 630
og = Image.new("RGB", (W, H), BG)
disc = src.resize((452, 452), Image.LANCZOS)
og.paste(disc, (56, 89))
d = ImageDraw.Draw(og)

def font(paths, size):
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    raise FileNotFoundError(paths)

SANS_B = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
          "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]
SANS = ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"]
CJK_B = ["/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"]

x = 566
d.text((x, 148), "BeCounted", font=font(SANS_B, 96), fill=WHITE)
d.rectangle([x + 2, 268, x + 118, 276], fill=GOLD)
d.text((x, 300), "One Human. One Entry.", font=font(SANS_B, 45), fill=(232, 232, 230))
d.text((x, 372), "一人 · 双钥 · 一印", font=font(CJK_B, 43), fill=GOLD)
d.text((x, 452), "The anti-sybil primitive for Binance Agent ID",
       font=font(SANS, 27), fill=GRAY)
og.save(os.path.join(ASSETS, "og.png"))
print("wrote og.png", og.size)
