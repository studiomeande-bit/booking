from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "output" / "illustrator" / "assets"
OUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"
PACKAGE_DIR = OUT_DIR / "studio-mean-gutschein-a3-bold-poster-package"

PRINT_PNG = OUT_DIR / "studio-mean-gutschein-a3-bold-poster-print.png"
PRINT_PDF = OUT_DIR / "studio-mean-gutschein-a3-bold-poster-print.pdf"
WEB_PNG = OUT_DIR / "studio-mean-gutschein-a3-bold-poster-web.png"
CMYK_JPG = TMP_DIR / "studio-mean-gutschein-a3-bold-poster-cmyk.jpg"
PACKAGE_PNG = PACKAGE_DIR / PRINT_PNG.name
PACKAGE_PDF = PACKAGE_DIR / PRINT_PDF.name
PACKAGE_WEB = PACKAGE_DIR / WEB_PNG.name
PACKAGE_README = PACKAGE_DIR / "README_PRINT.md"

DPI = 300
MM_TO_PX = DPI / 25.4
PAGE_W_MM = 303
PAGE_H_MM = 426
TRIM_BLEED_MM = 3

W = round(PAGE_W_MM * MM_TO_PX)
H = round(PAGE_H_MM * MM_TO_PX)

FONT_KR = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
FONT_DIN = "/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf"
FONT_DIN_ALT = "/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf"
FONT_ARIAL_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"

DARK = (17, 34, 28)
INK = (22, 25, 23)
CREAM = (250, 245, 235)
WARM = (243, 235, 221)
WHITE = (255, 253, 248)
CORAL = (255, 92, 54)
CORAL_DARK = (214, 64, 38)
MINT = (195, 230, 211)
MUTED = (98, 91, 82)
LINE = (218, 206, 187)


def px(value_mm):
    return round(value_mm * MM_TO_PX)


def font_kr(size, weight="regular"):
    indexes = {
        "regular": 0,
        "medium": 2,
        "semibold": 4,
        "bold": 6,
        "light": 8,
    }
    return ImageFont.truetype(FONT_KR, size, index=indexes.get(weight, 0))


def font_file(path, size):
    return ImageFont.truetype(path, size)


def fit_font(text, path, max_width, start_size, min_size=10, ttc_index=None):
    size = start_size
    while size >= min_size:
        if ttc_index is None:
            candidate = font_file(path, size)
        else:
            candidate = ImageFont.truetype(path, size, index=ttc_index)
        bbox = ImageDraw.Draw(Image.new("RGB", (10, 10))).textbbox((0, 0), text, font=candidate)
        if bbox[2] - bbox[0] <= max_width:
            return candidate
        size -= 2
    if ttc_index is None:
        return font_file(path, min_size)
    return ImageFont.truetype(path, min_size, index=ttc_index)


F = {
    "label": font_file(FONT_DIN_ALT, px(3.1)),
    "label_kr": font_kr(px(3.4), "semibold"),
    "hero": font_file(FONT_DIN, px(38)),
    "hero_kr": font_kr(px(12.2), "bold"),
    "hero_de": font_file(FONT_ARIAL, px(4.35)),
    "pill": font_kr(px(3.55), "bold"),
    "cta": font_kr(px(11.0), "bold"),
    "cta_de": font_file(FONT_ARIAL, px(4.25)),
    "section": font_kr(px(6.9), "bold"),
    "num": font_file(FONT_DIN, px(10.4)),
    "option_title": font_kr(px(5.35), "bold"),
    "option_de": font_file(FONT_ARIAL, px(3.45)),
    "option_body": font_kr(px(3.9), "regular"),
    "note": font_kr(px(3.0), "regular"),
    "note_bold": font_kr(px(3.25), "bold"),
    "footer": font_file(FONT_ARIAL, px(2.65)),
    "footer_bold": font_file(FONT_ARIAL_BLACK, px(2.7)),
}


def rounded_rect(draw, box, radius_mm, fill, outline=None, width=1):
    draw.rounded_rectangle(
        tuple(px(v) if isinstance(v, (int, float)) else v for v in box),
        radius=px(radius_mm),
        fill=fill,
        outline=outline,
        width=width,
    )


def draw_text(draw, xy_mm, text, ft, fill, anchor=None):
    kwargs = {"font": ft, "fill": fill}
    if anchor:
        kwargs["anchor"] = anchor
    draw.text((px(xy_mm[0]), px(xy_mm[1])), text, **kwargs)


def draw_center(draw, x_mm, y_mm, text, ft, fill):
    draw_text(draw, (x_mm, y_mm), text, ft, fill, anchor="mm")


def make_rounded_image(path, size_mm, radius_mm, centering=(0.5, 0.5), overlay=None):
    w, h = px(size_mm[0]), px(size_mm[1])
    im = Image.open(path).convert("RGB")
    im = ImageOps.fit(im, (w, h), method=Image.Resampling.LANCZOS, centering=centering)
    im = ImageEnhance.Contrast(im).enhance(1.05)
    im = ImageEnhance.Color(im).enhance(0.98)
    if overlay:
        color, alpha = overlay
        layer = Image.new("RGB", (w, h), color)
        im = Image.blend(im, layer, alpha)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), radius=px(radius_mm), fill=255)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(im.convert("RGBA"), (0, 0), mask)
    return out


def paste_logo(im, draw):
    logo = Image.open(ASSET_DIR / "logo.png").convert("RGBA")
    alpha = logo.getchannel("A")
    white_logo = Image.new("RGBA", logo.size, WHITE + (0,))
    white_logo.putalpha(alpha)
    white_logo.thumbnail((px(68), px(25)), Image.Resampling.LANCZOS)
    im.paste(white_logo, (px(24), px(22)), white_logo)


def draw_crop_marks(draw):
    bleed = px(TRIM_BLEED_MM)
    trim_w = px(297)
    trim_h = px(420)
    mark = px(5)
    width = max(1, px(0.16))
    x0, y0 = bleed, bleed
    x1, y1 = bleed + trim_w, bleed + trim_h
    for x, y, sx, sy in [
        (x0, y0, -1, -1),
        (x1, y0, 1, -1),
        (x0, y1, -1, 1),
        (x1, y1, 1, 1),
    ]:
        draw.line((x, y, x + sx * mark, y), fill=(35, 35, 35), width=width)
        draw.line((x, y, x, y + sy * mark), fill=(35, 35, 35), width=width)


def option_row(draw, top_mm, number, title, ko, de):
    x, y, w, h = 24, top_mm, 255, 35
    rounded_rect(draw, (x, y, x + w, y + h), 3.4, WHITE, outline=LINE, width=px(0.35))
    rounded_rect(draw, (x + 5, y + 5, x + 25, y + 30), 2.1, CORAL)
    draw_center(draw, x + 15, y + 18, number, F["num"], WHITE)
    draw_text(draw, (x + 34, y + 5.6), title, F["option_title"], INK)
    draw_text(draw, (x + 34, y + 18.0), ko, F["option_body"], MUTED)
    draw_text(draw, (x + 34, y + 27.1), de, F["option_de"], MUTED)


def create_pdf(image_path, pdf_path):
    page_w = PAGE_W_MM * mm
    page_h = PAGE_H_MM * mm
    c = canvas.Canvas(str(pdf_path), pagesize=(page_w, page_h))
    c.setTitle("Studio mean Gutschein A3 Bold Poster")
    c.drawImage(str(image_path), 0, 0, width=page_w, height=page_h)
    c.showPage()
    c.save()


def write_package_readme():
    PACKAGE_README.write_text(
        """# Studio mean Gutschein A3 Bold Poster

## Files

- `studio-mean-gutschein-a3-bold-poster-print.pdf`: print-ready A3 poster with 3 mm bleed
- `studio-mean-gutschein-a3-bold-poster-print.png`: 300 dpi source render
- `studio-mean-gutschein-a3-bold-poster-web.png`: smaller preview image

## Print Spec

- Page size: 303 x 426 mm
- Final trim: A3, 297 x 420 mm
- Bleed: 3 mm on all sides
- Concept: minimal, modern, high-contrast, bold typography
- Main colors: deep green, warm cream, coral accent

## Readability Intent

The poster is designed for a small studio space of roughly 25 m2.
The first reading layer is `GUTSCHEIN`, `사진을 선물하세요`, and `바로 상담 · 바로 발행`.
The second reading layer explains voucher options and studio consultation.
""",
        encoding="utf-8",
    )


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    PACKAGE_DIR.mkdir(parents=True, exist_ok=True)

    im = Image.new("RGB", (W, H), DARK)
    draw = ImageDraw.Draw(im)

    # High-visibility color fields.
    draw.rectangle((0, 0, W, H), fill=DARK)
    draw.rectangle((0, 0, px(8), H), fill=CORAL)
    draw.rectangle((px(258), 0, W, px(236)), fill=MINT)
    draw.rectangle((px(14), px(242), px(291), H), fill=CREAM)
    draw.rectangle((0, px(239), W, px(247)), fill=CORAL)
    draw.rectangle((px(258), px(247), W, H), fill=(235, 242, 232))

    paste_logo(im, draw)

    # Photo stack.
    rounded_rect(draw, (171, 28, 286, 179), 4, CORAL)
    hero_photo = make_rounded_image(ASSET_DIR / "photo_family.png", (104, 150), 4, centering=(0.5, 0.36))
    im.paste(hero_photo, (px(178), px(22)), hero_photo)
    draw_text(draw, (178, 185), "FAMILY / WEDDING / COUPLE / SNAP", font_file(FONT_DIN_ALT, px(3.2)), MINT)

    # Hero copy.
    draw_text(draw, (24, 61), "STUDIO MEAN · 굿샤인 안내", F["label_kr"], MINT)
    draw_text(draw, (24, 72), "GUTSCHEIN", F["hero"], WHITE)
    draw_text(draw, (24, 133.5), "사진을 선물하세요", F["hero_kr"], CORAL)
    draw_text(draw, (24, 154.5), "Geschenkgutschein für Fotoshootings", F["hero_de"], (223, 238, 228))
    rounded_rect(draw, (24, 167.5, 168, 184), 7.5, WHITE)
    draw_center(draw, 96, 175.7, "프로필 · 가족사진 · 커플 · 스냅 · 특별한 날", F["pill"], INK)

    # Main call-to-action.
    rounded_rect(draw, (24, 194, 279, 235), 4, CORAL)
    draw_text(draw, (36, 201.3), "바로 상담 · 바로 발행", F["cta"], WHITE)
    draw_text(draw, (36, 223.7), "Direkt im Studio: Beratung · Ausstellung · Terminplanung", F["cta_de"], (255, 242, 235))
    rounded_rect(draw, (223, 205.5, 266, 225.5), 9.5, DARK)
    draw_center(draw, 244.5, 215.5, "ASK US", font_file(FONT_ARIAL_BLACK, px(3.6)), WHITE)

    # Bottom information panel.
    draw_text(draw, (24, 257), "선물 가능한 구성", F["section"], INK)
    draw_text(draw, (24.5, 268.7), "Gutschein-Optionen", font_file(FONT_DIN_ALT, px(4.6)), CORAL_DARK)
    draw.line((px(24), px(277), px(279), px(277)), fill=LINE, width=px(0.4))

    option_row(draw, 283, "01", "금액권 · Wertgutschein", "원하는 금액으로 준비하는 가장 유연한 선물", "Flexible Beträge nach Wunsch")
    option_row(draw, 322, "02", "촬영권 · Shooting-Gutschein", "프로필, 가족사진, 커플/스냅 촬영 지정 가능", "Portrait, Familie, Couple, Snap")
    option_row(draw, 361, "03", "맞춤 안내 · Persönliche Beratung", "받는 분의 일정과 촬영 목적에 맞춰 상담", "Passend zu Anlass und Termin")

    draw.line((px(24), px(397), px(279), px(397)), fill=LINE, width=px(0.35))
    draw_text(draw, (24, 403.5), "안내", F["note_bold"], INK)
    draw_text(draw, (38, 403.7), "유효기간과 사용 조건은 발행 시 함께 안내됩니다. 예약 가능일은 스튜디오 일정에 따라 조율됩니다.", F["note"], MUTED)
    draw_text(draw, (38, 411.7), "Gültigkeit, Konditionen und Termine werden bei Ausstellung persönlich abgestimmt.", F["option_de"], MUTED)
    draw_text(draw, (24, 419.0), "Holzweg-Passage 3 · 61440 Oberursel", F["footer_bold"], INK)
    draw_text(draw, (134, 419.0), "+49 176 60939400 · studio.mean.de@gmail.com · @studio_mean", F["footer"], INK)

    draw_crop_marks(draw)

    im.save(PRINT_PNG, dpi=(DPI, DPI))
    web_w = 1500
    web = im.resize((web_w, round(H * web_w / W)), Image.Resampling.LANCZOS)
    web.save(WEB_PNG, optimize=True)
    im.convert("CMYK").save(CMYK_JPG, quality=95, dpi=(DPI, DPI))
    create_pdf(PRINT_PNG, PRINT_PDF)

    for src, dst in [
        (PRINT_PNG, PACKAGE_PNG),
        (PRINT_PDF, PACKAGE_PDF),
        (WEB_PNG, PACKAGE_WEB),
    ]:
        dst.write_bytes(src.read_bytes())
    write_package_readme()

    print(f"Wrote {PRINT_PDF}")
    print(f"Wrote {PRINT_PNG}")
    print(f"Wrote {WEB_PNG}")
    print(f"Wrote {PACKAGE_DIR}")


if __name__ == "__main__":
    main()
