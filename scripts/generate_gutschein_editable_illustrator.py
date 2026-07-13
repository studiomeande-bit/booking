from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "illustrator"
ASSETS = OUT / "assets"
TMP = ROOT / "tmp" / "illustrator"

SOURCE = ROOT / "output" / "pdf" / "studio-mean-gutschein-a3-display-poster-preview.png"

AI_FILE = OUT / "studio-mean-gutschein-a3-display-poster-editable.ai"
PDF_FILE = OUT / "studio-mean-gutschein-a3-display-poster-editable.pdf"
PNG_CHECK = OUT / "studio-mean-gutschein-a3-display-poster-editable-check.png"
JSX_FILE = TMP / "build-gutschein-editable-ai.jsx"

PX_TO_PT = 72 / 300
PAGE_W_PX = 3579
PAGE_H_PX = 5031


def crop_assets() -> dict[str, Path]:
    im = Image.open(SOURCE).convert("RGBA")
    ASSETS.mkdir(parents=True, exist_ok=True)

    crops = {
        "logo": (260, 300, 900, 540),
        "photo_top": (2209, 450, 3297, 1576),
        "photo_family": (2209, 1634, 3297, 2850),
        "photo_couple": (2209, 2900, 3297, 4200),
    }

    written: dict[str, Path] = {}
    bg = (246, 242, 235)
    for name, box in crops.items():
        crop = im.crop(box)
        if name == "logo":
            # Make the off-white logo background transparent so it behaves like a real placed mark.
            pix = crop.load()
            for y in range(crop.height):
                for x in range(crop.width):
                    r, g, b, a = pix[x, y]
                    if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < 22:
                        pix[x, y] = (r, g, b, 0)
        path = ASSETS / f"{name}.png"
        crop.save(path)
        written[name] = path
    return written


def js_string(value: str | Path) -> str:
    return json.dumps(str(value), ensure_ascii=False)


def build_jsx(assets: dict[str, Path]) -> str:
    ai = js_string(AI_FILE)
    pdf = js_string(PDF_FILE)
    png = js_string(PNG_CHECK)

    return f"""
var PAGE_W = {PAGE_W_PX * PX_TO_PT:.6f};
var PAGE_H = {PAGE_H_PX * PX_TO_PT:.6f};
var SCALE = {PX_TO_PT:.8f};

var saveAi = new File({ai});
var savePdf = new File({pdf});
var savePng = new File({png});
try {{ if (saveAi.exists) saveAi.remove(); }} catch(e) {{}}
try {{ if (savePdf.exists) savePdf.remove(); }} catch(e) {{}}
try {{ if (savePng.exists) savePng.remove(); }} catch(e) {{}}

function px(v) {{ return v * SCALE; }}
function py(v) {{ return PAGE_H - px(v); }}

function rgb(r, g, b) {{
  var c = new RGBColor();
  c.red = r; c.green = g; c.blue = b;
  return c;
}}

var BG = rgb(246, 242, 235);
var CARD = rgb(255, 253, 248);
var TINT = rgb(236, 228, 216);
var ROW = rgb(250, 247, 241);
var BROWN = rgb(126, 78, 47);
var TEXT = rgb(40, 38, 35);
var MUTED = rgb(118, 109, 100);
var LINE = rgb(214, 202, 185);

function font(name, fallback) {{
  try {{ return app.textFonts.getByName(name); }} catch(e) {{}}
  return app.textFonts.getByName(fallback || "AppleSDGothicNeo-Regular");
}}

var F_REG = font("AppleSDGothicNeo-Regular");
var F_MED = font("AppleSDGothicNeo-Medium", "AppleSDGothicNeo-Regular");
var F_SEMI = font("AppleSDGothicNeo-SemiBold", "AppleSDGothicNeo-Bold");
var F_BOLD = font("AppleSDGothicNeo-Bold", "AppleSDGothicNeo-Regular");

function layer(name) {{
  var l = doc.layers.add();
  l.name = name;
  return l;
}}

function rect(l, x, y, w, h, fill, stroke, sw) {{
  var p = l.pathItems.rectangle(py(y), px(x), px(w), px(h));
  p.filled = true;
  p.fillColor = fill;
  p.stroked = !!stroke;
  if (stroke) {{
    p.strokeColor = stroke;
    p.strokeWidth = px(sw || 4);
  }}
  return p;
}}

function roundRect(l, x, y, w, h, r, fill, stroke, sw) {{
  var p = l.pathItems.roundedRectangle(py(y), px(x), px(w), px(h), px(r), px(r));
  p.filled = true;
  p.fillColor = fill;
  p.stroked = !!stroke;
  if (stroke) {{
    p.strokeColor = stroke;
    p.strokeWidth = px(sw || 4);
  }}
  return p;
}}

function line(l, x1, y1, x2, y2, color, sw) {{
  var p = l.pathItems.add();
  p.setEntirePath([[px(x1), py(y1)], [px(x2), py(y2)]]);
  p.filled = false;
  p.stroked = true;
  p.strokeColor = color || TEXT;
  p.strokeWidth = px(sw || 3);
  return p;
}}

function text(l, value, x, y, size, color, tf, name) {{
  var t = l.textFrames.add();
  t.name = name || value.substr(0, 24);
  t.contents = value;
  t.position = [px(x), py(y)];
  var a = t.textRange.characterAttributes;
  a.size = px(size);
  a.fillColor = color || TEXT;
  a.textFont = tf || F_REG;
  return t;
}}

function place(l, filePath, x, y, w, h, name) {{
  var it = l.placedItems.add();
  it.file = new File(filePath);
  it.name = name;
  it.left = px(x);
  it.top = py(y);
  it.width = px(w);
  it.height = px(h);
  return it;
}}

var doc = app.documents.add(DocumentColorSpace.RGB, PAGE_W, PAGE_H);
doc.name = "studio-mean-gutschein-editable";
doc.artboards[0].artboardRect = [0, PAGE_H, PAGE_W, 0];

var bgLayer = doc.layers[0];
bgLayer.name = "01 Background and Bleed";
rect(bgLayer, 0, 0, {PAGE_W_PX}, {PAGE_H_PX}, BG, null, 0);

var photoLayer = layer("02 Photo Layers");
place(photoLayer, {js_string(assets["logo"])}, 283, 339, 567, 159, "Studio mean logo");
place(photoLayer, {js_string(assets["photo_top"])}, 2209, 450, 1088, 1126, "Portrait photo");
place(photoLayer, {js_string(assets["photo_family"])}, 2209, 1634, 1088, 1216, "Family photo");
place(photoLayer, {js_string(assets["photo_couple"])}, 2209, 2900, 1088, 1300, "Couple snap photo");

var header = layer("03 Editable Header Text");
text(header, "STUDIO MEAN GIFT VOUCHER / GESCHENKGUTSCHEIN", 286, 828, 44, BROWN, F_SEMI, "Kicker DE");
line(header, 286, 907, 1760, 907, LINE, 5);
text(header, "GUTSCHEIN", 286, 1128, 224, TEXT, F_BOLD, "Main title");
text(header, "사진으로 선물하는 시간", 286, 1426, 96, BROWN, F_BOLD, "Korean subtitle");
text(header, "사진관에서의 한 시간은 오래 남는 선물이 됩니다.", 286, 1498, 44, MUTED, F_REG, "Intro Korean");
text(header, "Zeit verschenken, die in Bildern bleibt.", 286, 1558, 36, BROWN, F_BOLD, "Intro German");
text(header, "프로필, 가족사진, 커플/스냅, 특별한 날의 촬영권을 선물해 보세요.", 286, 1610, 36, MUTED, F_REG, "Intro Korean detail");
text(header, "Für Portraits, Familienfotos, Couple-Shootings und besondere Tage.", 286, 1662, 36, MUTED, F_REG, "Intro German detail");

var options = layer("04 Editable Gutschein Options");
roundRect(options, 286, 1782, 1742, 1438, 46, CARD, LINE, 5);
text(options, "선물 가능한 구성 / Gutschein-Optionen", 405, 1940, 54, TEXT, F_BOLD, "Options heading");

function optionRow(y, title, ko, de) {{
  roundRect(options, 368, y - 38, 1540, 222, 24, ROW, null, 0);
  roundRect(options, 410, y + 12, 28, 28, 7, BROWN, null, 0);
  text(options, title, 492, y + 44, 44, TEXT, F_BOLD, title);
  text(options, ko, 492, y + 112, 36, MUTED, F_REG, ko);
  text(options, de, 492, y + 164, 36, MUTED, F_REG, de);
}}
optionRow(2108, "금액권 · Wertgutschein", "원하는 금액으로 준비하는 가장 유연한 선물", "Flexible Gutscheinbeträge nach Wunsch");
optionRow(2480, "촬영권 · Shooting-Gutschein", "프로필, 가족사진, 홈/야외스냅 등 상품 지정 가능", "Für Portrait, Familie, Home- oder Outdoor-Snap wählbar");
optionRow(2852, "맞춤 상담 · Persönliche Beratung", "받는 분의 일정과 촬영 목적에 맞춰 안내", "Beratung passend zu Anlass, Person und Termin");

var consult = layer("05 Editable Studio Consultation");
roundRect(consult, 286, 3270, 1742, 862, 46, TINT, LINE, 5);
roundRect(consult, 365, 3378, 485, 485, 22, CARD, null, 0);
text(consult, "GIFT", 465, 3560, 96, TEXT, F_BOLD, "Gift icon text 1");
text(consult, "VOUCHER", 405, 3674, 72, TEXT, F_BOLD, "Gift icon text 2");
line(consult, 443, 3750, 778, 3750, LINE, 5);
text(consult, "Studio mean", 500, 3836, 29, BROWN, F_BOLD, "Gift icon brand");
text(consult, "스튜디오에서 바로 상담해 주세요", 930, 3440, 64, TEXT, F_BOLD, "Consult heading KO");
text(consult, "Beratung und Ausstellung direkt im Studio", 930, 3518, 44, BROWN, F_BOLD, "Consult heading DE");
text(consult, "금액, 받는 분, 메시지를 정해", 930, 3586, 36, MUTED, F_REG, "Consult body KO 1");
text(consult, "선물용 바우처로 제작해드립니다.", 930, 3632, 36, MUTED, F_REG, "Consult body KO 2");
text(consult, "Betrag, Empfänger und persönliche Nachricht", 930, 3690, 36, MUTED, F_REG, "Consult body DE 1");
text(consult, "werden individuell festgelegt.", 930, 3736, 36, MUTED, F_REG, "Consult body DE 2");
text(consult, "결제 및 발행은 직원에게 문의해 주세요.", 930, 3810, 36, TEXT, F_BOLD, "Payment note KO");
text(consult, "Zahlung und Ausstellung erfolgen persönlich im Studio.", 930, 3860, 36, MUTED, F_REG, "Payment note DE");

function stepBox(x, no, ko, de) {{
  roundRect(consult, x, 3902, 338, 150, 22, CARD, LINE, 3);
  var c = consult.pathItems.ellipse(py(3926), px(x + 24), px(56), px(56));
  c.filled = true; c.fillColor = BROWN; c.stroked = false;
  text(consult, no, x + 43, 3972, 26, CARD, F_BOLD, "Step " + no);
  text(consult, ko, x + 104, 3970, 36, TEXT, F_BOLD, "Step " + no + " KO");
  text(consult, de, x + 104, 4018, 29, MUTED, F_REG, "Step " + no + " DE");
}}
stepBox(930, "1", "상담", "Beratung");
stepBox(1294, "2", "발행", "Ausstellung");
stepBox(1658, "3", "예약", "Termin");

var footer = layer("06 Editable Footer and Usage");
text(footer, "사용 안내 / Hinweise", 286, 4246, 44, TEXT, F_BOLD, "Usage heading");
text(footer, "유효기간과 사용 조건은 발행 시 함께 안내됩니다.", 286, 4372, 36, MUTED, F_REG, "Usage KO 1");
text(footer, "Gültigkeit und Konditionen werden bei Ausstellung erklärt.", 286, 4420, 36, MUTED, F_REG, "Usage DE 1");
text(footer, "예약 상황에 따라 희망일 조율이 필요할 수 있습니다.", 286, 4470, 36, MUTED, F_REG, "Usage KO 2");
text(footer, "Wunschtermine sind je nach Verfügbarkeit abzustimmen.", 286, 4520, 36, MUTED, F_REG, "Usage DE 2");
text(footer, "문의: studio.mean.de@gmail.com", 286, 4570, 36, MUTED, F_REG, "Contact email");
text(footer, "Fotostudio in Oberursel", 286, 4684, 62, TEXT, F_BOLD, "Footer title");
text(footer, "Holzwegpassage 3 · 61440 Oberursel · +49 176 6093 9400", 286, 4804, 42, MUTED, F_REG, "Footer address");
text(footer, "studio.mean.de@gmail.com · instagram.com/studio.mean", 286, 4894, 42, MUTED, F_REG, "Footer social");
text(footer, "PORTRAIT · FAMILY · WEDDING · SNAP", 2209, 4380, 44, BROWN, F_BOLD, "Right category label");
line(footer, 2209, 4480, 3297, 4480, LINE, 4);

var marks = layer("99 Crop Marks");
line(marks, 0, 50, 0, 0, TEXT, 2);
line(marks, 0, 0, 50, 0, TEXT, 2);
line(marks, {PAGE_W_PX}, 50, {PAGE_W_PX}, 0, TEXT, 2);
line(marks, {PAGE_W_PX - 50}, 0, {PAGE_W_PX}, 0, TEXT, 2);
line(marks, 0, {PAGE_H_PX - 50}, 0, {PAGE_H_PX}, TEXT, 2);
line(marks, 0, {PAGE_H_PX}, 50, {PAGE_H_PX}, TEXT, 2);
line(marks, {PAGE_W_PX}, {PAGE_H_PX - 50}, {PAGE_W_PX}, {PAGE_H_PX}, TEXT, 2);
line(marks, {PAGE_W_PX - 50}, {PAGE_H_PX}, {PAGE_W_PX}, {PAGE_H_PX}, TEXT, 2);

var aiOptions = new IllustratorSaveOptions();
aiOptions.pdfCompatible = true;
aiOptions.compressed = true;
doc.saveAs(saveAi, aiOptions);

var pdfOptions = new PDFSaveOptions();
pdfOptions.preserveEditability = true;
doc.saveAs(savePdf, pdfOptions);

var pngOptions = new ExportOptionsPNG24();
pngOptions.artBoardClipping = true;
pngOptions.antiAliasing = true;
pngOptions.transparency = false;
pngOptions.horizontalScale = 100;
pngOptions.verticalScale = 100;
doc.exportFile(savePng, ExportType.PNG24, pngOptions);

doc.close(SaveOptions.DONOTSAVECHANGES);
"""


def write_jsx(assets: dict[str, Path]) -> Path:
    TMP.mkdir(parents=True, exist_ok=True)
    JSX_FILE.write_text(build_jsx(assets), encoding="utf-8")
    return JSX_FILE


def run_illustrator(jsx: Path) -> None:
    cmd = [
        "osascript",
        "-e",
        f'tell application "Adobe Illustrator" to do javascript POSIX file "{jsx}"',
    ]
    subprocess.run(cmd, check=True, cwd=ROOT)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    assets = crop_assets()
    jsx = write_jsx(assets)
    run_illustrator(jsx)
    print(f"Wrote {AI_FILE}")
    print(f"Wrote {PDF_FILE}")
    print(f"Wrote {PNG_CHECK}")


if __name__ == "__main__":
    main()
