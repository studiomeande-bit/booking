from pathlib import Path
from shutil import copy2

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf"
ARCHIVE_DIR = OUT_DIR / "archive"
TMP_DIR = ROOT / "tmp" / "pdfs"

SOURCE_PREVIEW = OUT_DIR / "studio-mean-gutschein-a3-poster-preview.png"
SOURCE_PDF = OUT_DIR / "studio-mean-gutschein-a3-poster-print.pdf"
SOURCE_WEB = OUT_DIR / "studio-mean-gutschein-a3-poster-web.png"

ARCHIVE_PREVIEW = ARCHIVE_DIR / "studio-mean-gutschein-a3-poster-purchase-preview.png"
ARCHIVE_PDF = ARCHIVE_DIR / "studio-mean-gutschein-a3-poster-purchase-print.pdf"
ARCHIVE_WEB = ARCHIVE_DIR / "studio-mean-gutschein-a3-poster-purchase-web.png"

DISPLAY_PREVIEW = OUT_DIR / "studio-mean-gutschein-a3-display-poster-preview.png"
DISPLAY_PDF = OUT_DIR / "studio-mean-gutschein-a3-display-poster-print.pdf"
DISPLAY_WEB = OUT_DIR / "studio-mean-gutschein-a3-display-poster-web.png"
DISPLAY_CMYK = TMP_DIR / "studio-mean-gutschein-a3-display-poster-cmyk.jpg"

MAIN_PREVIEW = SOURCE_PREVIEW
MAIN_PDF = SOURCE_PDF
MAIN_WEB = SOURCE_WEB
MAIN_CMYK = TMP_DIR / "studio-mean-gutschein-a3-poster-cmyk.jpg"


BG = (246, 242, 235)
CARD = (255, 253, 248)
TINT = (236, 228, 216)
BROWN = (126, 78, 47)
TEXT = (40, 38, 35)
MUTED = (118, 109, 100)
LINE = (214, 202, 185)

FONT_KR = "/System/Library/Fonts/AppleSDGothicNeo.ttc"


def font(size, weight="regular"):
    indexes = {
        "regular": 0,
        "medium": 2,
        "semibold": 4,
        "bold": 6,
        "light": 8,
    }
    return ImageFont.truetype(FONT_KR, size, index=indexes.get(weight, 0))


F = {
    "label": font(44, "semibold"),
    "heading": font(64, "bold"),
    "title": font(54, "bold"),
    "body": font(44, "regular"),
    "body_bold": font(44, "bold"),
    "small": font(36, "regular"),
    "small_bold": font(36, "bold"),
    "tiny": font(29, "regular"),
    "tiny_bold": font(29, "bold"),
    "micro": font(26, "regular"),
    "micro_bold": font(26, "bold"),
}


def multiline(draw, xy, lines, fill=TEXT, leading=1.28):
    x, y = xy
    for text, ft, color in lines:
        draw.text((x, y), text, font=ft, fill=color or fill)
        y += int(getattr(ft, "size", 34) * leading)
    return y


def rounded_panel(draw, box, radius=42, fill=CARD, outline=LINE, width=5):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def bullet(draw, x, y, title, ko, de, row_right=None):
    if row_right:
        draw.rounded_rectangle((x - 42, y - 38, row_right, y + 184), radius=24, fill=(250, 247, 241))
    draw.rounded_rectangle((x, y + 12, x + 28, y + 40), radius=7, fill=BROWN)
    tx = x + 82
    draw.text((tx, y), title, font=F["body_bold"], fill=TEXT)
    draw.text((tx, y + 58), ko, font=F["small"], fill=MUTED)
    draw.text((tx, y + 103), de, font=F["small"], fill=MUTED)


def step(draw, box, number, ko, de):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=22, fill=(250, 247, 241), outline=(224, 213, 198), width=3)
    draw.ellipse((x1 + 24, y1 + 24, x1 + 80, y1 + 80), fill=BROWN)
    draw.text((x1 + 43, y1 + 31), number, font=F["micro_bold"], fill=CARD)
    draw.text((x1 + 104, y1 + 22), ko, font=F["small_bold"], fill=TEXT)
    draw.text((x1 + 104, y1 + 70), de, font=F["tiny"], fill=MUTED)


def backup_purchase_version():
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    for src, dst in [
        (SOURCE_PREVIEW, ARCHIVE_PREVIEW),
        (SOURCE_PDF, ARCHIVE_PDF),
        (SOURCE_WEB, ARCHIVE_WEB),
    ]:
        if src.exists() and not dst.exists():
            copy2(src, dst)


def create_pdf(image_path, pdf_path):
    page_w = 303 * mm
    page_h = 426 * mm
    c = canvas.Canvas(str(pdf_path), pagesize=(page_w, page_h))
    c.setTitle("Studio mean Gutschein A3 Display Poster")
    c.drawImage(str(image_path), 0, 0, width=page_w, height=page_h)
    c.showPage()
    c.save()


def main():
    backup_purchase_version()
    base_path = ARCHIVE_PREVIEW if ARCHIVE_PREVIEW.exists() else SOURCE_PREVIEW
    im = Image.open(base_path).convert("RGB")
    draw = ImageDraw.Draw(im)
    left_x = 286
    left_right = 2028
    inner_x = 405

    # Product label: keep the studio tone, add German wording for in-studio display.
    draw.rectangle((250, 700, 1848, 948), fill=BG)
    draw.text(
        (left_x, 812),
        "STUDIO MEAN GIFT VOUCHER / GESCHENKGUTSCHEIN",
        font=F["label"],
        fill=BROWN,
    )
    draw.line((left_x, 907, 1760, 907), fill=LINE, width=5)

    # Main explanatory copy: remove the old one-language body copy and add Korean/German pairing.
    draw.rectangle((250, 1415, 1930, 1788), fill=BG)
    multiline(
        draw,
        (left_x, 1448),
        [
            ("사진관에서의 한 시간은 오래 남는 선물이 됩니다.", F["body"], MUTED),
            ("Zeit verschenken, die in Bildern bleibt.", F["small_bold"], BROWN),
            ("프로필, 가족사진, 커플/스냅, 특별한 날의 촬영권을 선물해 보세요.", F["small"], MUTED),
            ("Für Portraits, Familienfotos, Couple-Shootings und besondere Tage.", F["small"], MUTED),
        ],
        leading=1.18,
    )

    # Options card: rewrite as a bilingual studio-facing explanation.
    draw.rectangle((250, 1740, 2078, 3234), fill=BG)
    rounded_panel(draw, (left_x, 1782, left_right, 3220), radius=46, fill=CARD, outline=LINE, width=5)
    draw.text((inner_x, 1902), "선물 가능한 구성 / Gutschein-Optionen", font=F["title"], fill=TEXT)
    bullet(
        draw,
        410,
        2108,
        "금액권 · Wertgutschein",
        "원하는 금액으로 준비하는 가장 유연한 선물",
        "Flexible Gutscheinbeträge nach Wunsch",
        row_right=1908,
    )
    bullet(
        draw,
        410,
        2480,
        "촬영권 · Shooting-Gutschein",
        "프로필, 가족사진, 홈/야외스냅 등 상품 지정 가능",
        "Für Portrait, Familie, Home- oder Outdoor-Snap wählbar",
        row_right=1908,
    )
    bullet(
        draw,
        410,
        2852,
        "맞춤 상담 · Persönliche Beratung",
        "받는 분의 일정과 촬영 목적에 맞춰 안내",
        "Beratung passend zu Anlass, Person und Termin",
        row_right=1908,
    )

    # Replace QR/purchase link card with in-studio guidance.
    draw.rectangle((250, 3210, 2078, 4152), fill=BG)
    rounded_panel(draw, (left_x, 3270, left_right, 4132), radius=46, fill=TINT, outline=LINE, width=5)
    draw.rounded_rectangle((365, 3378, 850, 3863), radius=22, fill=CARD)
    draw.text((465, 3490), "GIFT", font=font(96, "bold"), fill=TEXT)
    draw.text((405, 3601), "VOUCHER", font=font(72, "bold"), fill=TEXT)
    draw.line((443, 3704, 778, 3704), fill=LINE, width=5)
    draw.text((500, 3747), "Studio mean", font=F["tiny_bold"], fill=BROWN)

    multiline(
        draw,
        (930, 3354),
        [
            ("스튜디오에서 바로 상담해 주세요", F["heading"], TEXT),
            ("Beratung und Ausstellung direkt im Studio", F["body_bold"], BROWN),
            ("금액, 받는 분, 메시지를 정해", F["small"], MUTED),
            ("선물용 바우처로 제작해드립니다.", F["small"], MUTED),
            ("Betrag, Empfänger und persönliche Nachricht", F["small"], MUTED),
            ("werden individuell festgelegt.", F["small"], MUTED),
            ("결제 및 발행은 직원에게 문의해 주세요.", F["small_bold"], TEXT),
            ("Zahlung und Ausstellung erfolgen persönlich im Studio.", F["small"], MUTED),
        ],
        leading=1.18,
    )
    step(draw, (930, 3902, 1268, 4052), "1", "상담", "Beratung")
    step(draw, (1294, 3902, 1632, 4052), "2", "발행", "Ausstellung")
    step(draw, (1658, 3902, 1986, 4052), "3", "예약", "Termin")

    # Usage note: bilingual, without a purchase URL.
    draw.rectangle((250, 4148, 2078, 4604), fill=BG)
    draw.text((left_x, 4188), "사용 안내 / Hinweise", font=F["body_bold"], fill=TEXT)
    multiline(
        draw,
        (left_x, 4302),
        [
            ("유효기간과 사용 조건은 발행 시 함께 안내됩니다.", F["small"], MUTED),
            ("Gültigkeit und Konditionen werden bei Ausstellung erklärt.", F["small"], MUTED),
            ("예약 상황에 따라 희망일 조율이 필요할 수 있습니다.", F["small"], MUTED),
            ("Wunschtermine sind je nach Verfügbarkeit abzustimmen.", F["small"], MUTED),
            ("문의: studio.mean.de@gmail.com", F["small"], MUTED),
        ],
        leading=1.2,
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    im.save(DISPLAY_PREVIEW, dpi=(300, 300))
    im.save(MAIN_PREVIEW, dpi=(300, 300))

    web = im.resize((1300, round(im.height * 1300 / im.width)), Image.Resampling.LANCZOS)
    web.save(DISPLAY_WEB, optimize=True)
    web.save(MAIN_WEB, optimize=True)

    cmyk = im.convert("CMYK")
    cmyk.save(DISPLAY_CMYK, quality=95, dpi=(300, 300))
    cmyk.save(MAIN_CMYK, quality=95, dpi=(300, 300))

    create_pdf(DISPLAY_PREVIEW, DISPLAY_PDF)
    create_pdf(MAIN_PREVIEW, MAIN_PDF)

    print(f"Wrote {DISPLAY_PDF}")
    print(f"Wrote {MAIN_PDF}")
    print(f"Archived purchase version in {ARCHIVE_DIR}")


if __name__ == "__main__":
    main()
