#!/usr/bin/env python3
"""studio-mean.com 공유 이미지(og:image) 3개국어 생성 — 1200×627 JPG.

SNS(링크드인·카카오톡·왓츠앱)는 SVG og:image 를 못 읽어서 래스터로 만든다.
디자인은 링크드인 회사 커버(마케팅/링크드인/banner_company_1128x191.png)와 같은 톤:
Soft Cream 배경 + 공식 로고(.ai 원본 PNG) + 짧은 문구. 사람 사진은 쓰지 않는다.

    python3 scripts/make-og-images.py   # → frontend/portfolio/assets/og/og-{de,en,ko}.jpg
"""
import pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend/portfolio/assets/og"
LOGO = pathlib.Path.home() / "Desktop/Studio_mean/스튜디오자료/로고/4x/studio-mean-logo.png.png"
W, H = 1200, 627
CREAM, INK, MUTED, LINE = "#F7F2EA", "#201C1F", "#6B6158", "#CBBFAF"

SERIF = (str(pathlib.Path.home() / "Library/Fonts/CormorantGaramond-LightItalic.ttf"), 0)
SANS = ("/System/Library/Fonts/HelveticaNeue.ttc", 10)       # Medium
KO = ("/System/Library/Fonts/AppleSDGothicNeo.ttc", 8)        # Light
KO_MED = ("/System/Library/Fonts/AppleSDGothicNeo.ttc", 2)    # Medium

COPY = {
    "de": ("Foto & Film in Oberursel bei Frankfurt", SERIF, 44,
           "PORTRAITS · BEWERBUNGSFOTOS · PASSBILDER · FAMILIE · HOCHZEIT", SANS, 15, 0.18),
    "en": ("Photo & Film in Oberursel near Frankfurt", SERIF, 44,
           "PORTRAITS · HEADSHOTS · PASSPORT PHOTOS · FAMILY · WEDDINGS", SANS, 15, 0.18),
    "ko": ("프랑크푸르트 근교 오버우어젤 사진·영상 스튜디오", KO, 32,
           "프로필 · 증명사진 · 여권사진 · 가족사진 · 웨딩", KO_MED, 19, 0.08),
}


def font(spec, size):
    return ImageFont.truetype(spec[0], size, index=spec[1])


def tracked(draw, cx, y, text, fnt, tracking, fill):
    """가운데 정렬 + 자간(em 비율)."""
    gap = fnt.size * tracking
    widths = [draw.textlength(ch, font=fnt) for ch in text]
    x = cx - (sum(widths) + gap * (len(text) - 1)) / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += w + gap


def make(lang):
    tagline, tfont, tsize, caps, cfont, csize, ctrack = COPY[lang]
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    logo = Image.open(LOGO).convert("RGBA")
    logo = logo.crop(logo.getbbox())
    lw = 520
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    ink = Image.new("RGBA", logo.size, INK)
    ink.putalpha(logo.getchannel("A"))

    tf, cf = font(tfont, tsize), font(cfont, csize)
    t_box = draw.textbbox((0, 0), tagline, font=tf)
    c_box = draw.textbbox((0, 0), caps, font=cf)
    gap_logo, gap_line, gap_caps = 46, 40, 26
    block = logo.height + gap_logo + 1 + gap_line + (t_box[3] - t_box[1]) + gap_caps + (c_box[3] - c_box[1])
    y = (H - block) // 2

    img.paste(ink, ((W - lw) // 2, y), ink)
    y += logo.height + gap_logo
    draw.line([(W // 2 - 36, y), (W // 2 + 36, y)], fill=LINE, width=1)
    y += 1 + gap_line
    draw.text(((W - (t_box[2] - t_box[0])) / 2 - t_box[0], y - t_box[1]), tagline, font=tf, fill=INK)
    y += (t_box[3] - t_box[1]) + gap_caps
    tracked(draw, W / 2, y - c_box[1], caps, cf, ctrack, MUTED)

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"og-{lang}.jpg"
    img.save(path, "JPEG", quality=90, optimize=True, progressive=True)
    return path


if __name__ == "__main__":
    for lang in COPY:
        p = make(lang)
        with Image.open(p) as im:
            assert im.size == (W, H), im.size
        print(p.relative_to(ROOT), p.stat().st_size // 1024, "KB")
