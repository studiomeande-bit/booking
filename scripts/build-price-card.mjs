#!/usr/bin/env node
/**
 * build-price-card.mjs — 스튜디오 비치용 인화 가격표(A4) 생성기
 *
 * 왜 생성하는가: 인화 가격은 이미 정의처가 6곳이고 수동 동기화라 반복해서 어긋났다
 * (scripts/check-print-prices.mjs 참조). 가격표를 손으로 타이핑하면 **7번째 정의처**가 되고,
 * 그건 종이라서 어긋나도 검사기가 못 잡는다. 그래서 Code.gs PRINT_LABELS(과금 권위)에서
 * 직접 읽어 그린다. 단가를 고치면 이 스크립트를 다시 돌려 새로 뽑으면 된다.
 *
 * 디자인 근거: CI v1 §4 인쇄 기본 = Warm Ivory + Ink Black, 디스플레이 Cormorant Garamond,
 * 본문 Noto Sans KR. 여백 넓게·얇은 선·장식 최소. KO 중심 + DE 병기(독일 고객이 읽어야 한다).
 * 연락처는 넣지 않는다 — 카운터에 두는 카드라 불필요하고, 대표 이메일·전화 표기가
 * 아직 미확정이다(studio-mean-context §8: 추측 금지).
 *
 * 사용법:
 *   node scripts/build-price-card.mjs              → docs/price-card.html
 *   node scripts/build-price-card.mjs --no-frames  → 액자 행 제외
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const NO_FRAMES = process.argv.includes('--no-frames');

/* ── 과금 권위(Code.gs PRINT_LABELS)에서 단가를 읽는다.
      정규식은 check-print-prices.mjs 의 parseServerPrices 와 같은 형태로 맞춰 둔다. ── */
const gs = read('appscript/Code.gs');
const prices = {};
for (const m of gs.matchAll(
  /'([a-z0-9_]+)':\{label:'[^']*',summaryLabel:'([^']*)',price:([\d.]+),retouchedPrice:([\d.]+)\}/g
)) {
  prices[m[1]] = { summary: m[2], price: +m[3], retouched: +m[4] };
}
if (!Object.keys(prices).length) {
  console.error('❌ PRINT_LABELS 를 파싱하지 못했습니다 — Code.gs 구조가 바뀌었을 수 있습니다.');
  process.exit(1);
}

/* 볼륨 할인 구간도 상수에서 읽는다(설정 시트가 덮어쓸 수 있으므로 '기본' 으로 표기). */
const tierRaw = (gs.match(/const SELECT_VOLUME_TIER_DEFAULTS_=\{[^}]*print:'([^']*)'/) || [])[1] || '';
const tiers = tierRaw
  .split(',')
  .map((t) => t.split(':').map(Number))
  .filter(([c, p]) => c > 0 && p > 0);

/* 규격(cm)은 예약 안내용 카탈로그가 정본이다 — 고객에게 보여주는 숫자라 여기서 가져온다. */
const cat = read('frontend/shared/print-catalog.js');
const cm = {};
for (const m of cat.matchAll(/id:\s*'([a-z0-9_]+)',\s*cm:\s*'([^']*)'/g)) cm[m[1]] = m[2];

const eur = (n) => `€${Number(n) % 1 === 0 ? n : n.toFixed(2)}`;

/* ── 잘림·마감 문구는 **원문 그대로** 가져온다 ──────────────────────────────
   print-tier-copy.js 헤더가 "UWG 법률 검수를 통과한 원문, 임의로 다듬지 말 것" 이라고 못박고 있다.
   카드에 맞게 줄이지 않는다 — 대신 원문의 <br> 를 경계로 두 덩어리(무엇이 잘리나 / 우리가 뭘 하나)로
   나눠 각각 통째로 싣는다. 자르는 게 아니라 나누는 것이다. */
const tier = read('frontend/shared/print-tier-copy.js');
function cropCopy(lang) {
  const block = new RegExp(`${lang}:\\s*\\{\\s*title:[\\s\\S]*?points:\\s*\\[([\\s\\S]*?)\\]\\s*\\}`).exec(tier);
  if (!block) return null;
  for (const m of block[1].matchAll(/head:\s*'([^']*)',\s*body:\s*'((?:[^'\\]|\\.)*)'/g)) {
    if (/잘리|crop|Zuschnitt/.test(m[1])) {
      const [what, ours] = m[2].split('<br>');
      return { head: m[1], what: (what || '').trim(), ours: (ours || '').trim() };
    }
  }
  return null;
}
const CROP = { ko: cropCopy('ko'), de: cropCopy('de') };
if (!CROP.ko || !CROP.de) {
  console.error('❌ print-tier-copy.js 에서 잘림 안내 원문을 찾지 못했습니다 — 구조가 바뀌었을 수 있습니다.');
  process.exit(1);
}

/* 마감(꽉 채움 / 흰 테두리) 문구도 셀렉 i18n 원문에서 가져온다. */
const i18n = read('frontend/select/v2/i18n.js');
const pick = (key) => [...i18n.matchAll(new RegExp(`${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'g'))].map((m) => m[1]);
const FIN = {};
for (const k of ['finishFull', 'finishBorder', 'finishHelpFull', 'finishHelpBorder']) {
  const v = pick(k);            // 파일 순서가 ko, en, de 다
  if (v.length < 3) { console.error(`❌ i18n 에서 ${k} 3개국어를 찾지 못했습니다.`); process.exit(1); }
  FIN[k] = { ko: v[0], de: v[2] };
}

/* ── 표 구성 ─────────────────────────────────────────────────────────────── */
const ROWS = [
  { group: { ko: '시그니처', de: 'Signature' }, ids: ['basic_10x15', 'basic_a4'] },
  { group: { ko: '파인아트', de: 'FineArt' }, ids: ['premium_10x15', 'premium_a4', 'premium_a3', 'premium_a3plus'] },
  { group: { ko: '포토카드', de: 'Fotokarte' }, ids: ['photocard_single', 'photocard_double'] },
];
if (!NO_FRAMES) ROWS.push({ group: { ko: '액자', de: 'Rahmen' }, ids: ['frame_a4', 'frame_a3'], frame: true });

const SIZE_KO = {
  basic_10x15: '10 × 15 cm', basic_a4: 'A4',
  premium_10x15: '10 × 15 cm', premium_a4: 'A4', premium_a3: 'A3', premium_a3plus: 'A3+',
  photocard_single: '단면', photocard_double: '양면',
  frame_a4: 'A4 인화용', frame_a3: 'A3 인화용',
};
const SIZE_DE = {
  basic_10x15: '10 × 15 cm', basic_a4: 'A4',
  premium_10x15: '10 × 15 cm', premium_a4: 'A4', premium_a3: 'A3', premium_a3plus: 'A3+',
  photocard_single: 'einseitig', photocard_double: 'beidseitig',
  frame_a4: 'für A4-Druck', frame_a3: 'für A3-Druck',
};

const missing = ROWS.flatMap((r) => r.ids).filter((id) => !prices[id]);
if (missing.length) {
  console.error(`❌ PRINT_LABELS 에 없는 SKU: ${missing.join(', ')}`);
  process.exit(1);
}

function tableRows(row) {
  return row.ids
    .map((id, i) => {
      const p = prices[id];
      const first = i === 0;
      const groupCell = first
        ? `<td class="grp" rowspan="${row.ids.length}"><span class="grp-ko">${row.group.ko}</span><span class="grp-de">${row.group.de}</span></td>`
        : '';
      // 규격이 두 언어에서 같으면(10 × 15 cm, A4 …) 한 줄만 쓴다 — 같은 글자를 두 번 찍으면 노이즈다.
      const size = SIZE_KO[id] === SIZE_DE[id]
        ? `<span class="sz-ko">${SIZE_KO[id]}</span>`
        : `<span class="sz-ko">${SIZE_KO[id]}</span><span class="sz-de">${SIZE_DE[id]}</span>`;
      // 액자는 인화에 얹는 추가금이라 보정본/원본 구분이 없다 — 한 칸으로 합친다.
      const cells = row.frame
        ? `<td class="p add" colspan="2">+ ${eur(p.price)}</td>`
        : `<td class="p">${eur(p.retouched)}</td><td class="p muted">${eur(p.price)}</td>`;
      return `<tr${first ? ' class="grp-start"' : ''}>${groupCell}<td class="sz">${size}</td>${cells}</tr>`;
    })
    .join('\n');
}

const discountLine = tiers.length
  ? tiers.map(([c, p]) => `${c}장 −${p}%`).join(' · ')
  : '';
const discountLineDe = tiers.length
  ? tiers.map(([c, p]) => `ab ${c} Stk. −${p}%`).join(' · ')
  : '';

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>인화 가격표 — Studio mean</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Noto+Sans+KR:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  /* CI v1 §4 인쇄 기본 팔레트 */
  :root{
    --ink:#201C1F; --ivory:#F8F3EB; --taupe:#6D5A49; --sand:#EDE3D6; --copper:#C58D66;
  }
  /* A4 정확히 한 장. 넘치면 인쇄 시 2페이지가 되어 카운터에 둘 수 없다 —
     SKU 를 늘리면 실제 렌더 높이를 다시 재고 여백을 조일 것(2026-09-10: 317mm 였다). */
  @page{ size:A4; margin:0; }
  *{ box-sizing:border-box; }
  html,body{ margin:0; padding:0; background:#e9e4dc; }
  body{
    font-family:'Noto Sans KR','Avenir Next',system-ui,sans-serif; font-weight:300;
    color:var(--ink); -webkit-font-smoothing:antialiased;
  }
  .sheet{
    width:210mm; min-height:297mm; margin:0 auto; padding:15mm 20mm 11mm;
    background:var(--ivory); display:flex; flex-direction:column;
  }
  header{ text-align:center; margin-bottom:6mm; }
  .logo{
    font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-weight:600;
    font-size:26pt; letter-spacing:.01em; margin:0;
  }
  .tag{ margin:2mm 0 0; font-size:7.5pt; letter-spacing:.32em; text-transform:uppercase; color:var(--taupe); }
  h1{
    font-family:'Cormorant Garamond',Georgia,serif; font-weight:400; font-size:19pt;
    margin:5mm 0 1mm; letter-spacing:.02em;
  }
  h1 .de{ font-size:11pt; color:var(--taupe); font-style:italic; margin-left:3mm; }
  .rule{ height:1px; background:var(--ink); opacity:.22; margin:0 0 4.5mm; }

  table{ width:100%; border-collapse:collapse; }
  thead th{
    font-size:8pt; font-weight:500; letter-spacing:.06em; color:var(--taupe);
    padding:0 0 2.5mm; text-align:right; border-bottom:1px solid rgba(32,28,31,.22);
  }
  thead th.l{ text-align:left; }
  thead th .de{ display:block; font-size:6.8pt; letter-spacing:.04em; opacity:.75; font-weight:300; }
  tbody tr.grp-start td{ border-top:1px solid rgba(32,28,31,.12); }
  tbody tr:first-child td{ border-top:none; }
  td{ padding:1.7mm 0; vertical-align:middle; }
  td.grp{
    width:26%; font-size:10.5pt; font-weight:400; padding-right:4mm; vertical-align:top; padding-top:3.4mm;
  }
  td.grp .grp-ko{ display:block; }
  td.grp .grp-de{ display:block; font-size:7.4pt; color:var(--taupe); letter-spacing:.04em; margin-top:.6mm; }
  td.sz{ width:32%; font-size:9.5pt; }
  td.sz .sz-de{ display:block; font-size:7.2pt; color:var(--taupe); margin-top:.4mm; }
  td.p{
    width:21%; text-align:right; font-size:11pt; font-weight:400;
    font-variant-numeric:tabular-nums; letter-spacing:.01em;
  }
  td.p.muted{ color:var(--taupe); font-weight:300; }
  td.p.add{ color:var(--ink); }

  .vol-band{
    display:flex; align-items:baseline; gap:5mm; margin-top:4mm;
    padding:2.4mm 4mm; background:var(--sand); border-radius:2mm;
  }
  .vol-k{ font-size:8.4pt; letter-spacing:.04em; }
  .vol-k .de{ color:var(--taupe); font-size:7pt; font-style:italic; }
  .vol-v{ margin-left:auto; font-size:10pt; letter-spacing:.02em; font-variant-numeric:tabular-nums; }

  h2.sub{
    font-family:'Cormorant Garamond',Georgia,serif; font-weight:400; font-size:13pt;
    margin:7mm 0 1mm; letter-spacing:.02em;
  }
  h2.sub .de{ font-size:8.5pt; color:var(--taupe); font-style:italic; margin-left:2.5mm; }
  .crop{
    display:flex; gap:6mm; align-items:center;
    border-top:1px solid rgba(32,28,31,.22); padding-top:3.5mm;
  }
  .crop .fig{ flex:0 0 78mm; height:19mm; }
  .crop-text{ font-size:7.8pt; line-height:1.55; }
  .crop-text p{ margin:0; }
  .crop-text p.de{ color:var(--taupe); font-size:7pt; margin-top:1.2mm; }

  .notes{ margin-top:auto; padding-top:4mm; }
  .note{
    display:flex; gap:4mm; align-items:baseline; padding:2.2mm 0;
    border-top:1px solid rgba(32,28,31,.10); font-size:8pt; line-height:1.5;
  }
  .note:first-child{ border-top:none; }
  .note .k{ flex:0 0 30mm; color:var(--taupe); font-size:7.6pt; letter-spacing:.05em; }
  .note .v .de{ display:block; color:var(--taupe); font-size:7.4pt; margin-top:.6mm; }
  footer{
    margin-top:5mm; padding-top:2.5mm; border-top:1px solid rgba(32,28,31,.16);
    display:flex; justify-content:space-between; font-size:7pt; color:var(--taupe); letter-spacing:.04em;
  }
  .sheet.back{ margin-top:8mm; }
  .sheet.back h1{ margin-top:0; }
  .lead{ font-size:9pt; line-height:1.7; margin:0; }
  .lead.de{ color:var(--taupe); font-size:8pt; margin-top:2mm; }
  .fig{ width:100%; height:auto; margin:8mm 0 2mm; }
  .back-notes{ margin-top:auto; }

  @media print{
    html,body{ background:var(--ivory); }
    .sheet{ margin:0; }
    /* 양면 인쇄 — 앞면 가격, 뒷면 규격·잘림. */
    .sheet.back{ margin-top:0; page-break-before:always; break-before:page; }
  }
</style>
</head>
<body>
<div class="sheet">
  <header>
    <p class="logo">Studio mean</p>
    <p class="tag">make meaningful moment</p>
  </header>

  <h1>인화 가격<span class="de">Druckpreise</span></h1>
  <div class="rule"></div>

  <table>
    <thead>
      <tr>
        <th class="l" colspan="2">종류 · 규격<span class="de">Papier &amp; Format</span></th>
        <th>보정본<span class="de">retuschiert</span></th>
        <th>원본<span class="de">unbearbeitet</span></th>
      </tr>
    </thead>
    <tbody>
${ROWS.map(tableRows).join('\n')}
    </tbody>
  </table>

${discountLine ? `  <div class="vol-band">
    <span class="vol-k">여러 장 주문 할인 <span class="de">Mengenrabatt</span></span>
    <span class="vol-v">${discountLine}</span>
  </div>` : ''}

  <div class="notes">
    <div class="note">
      <span class="k">보정본 · 원본</span>
      <span class="v">보정을 마친 사진은 보정본 가격으로, 보정하지 않은 촬영 원본은 원본 가격으로 인화합니다.
        <span class="de">Bereits retuschierte Bilder zum Preis „retuschiert“, unbearbeitete Aufnahmen zum Preis „unbearbeitet“.</span></span>
    </div>${discountLine ? `
    <div class="note">
      <span class="k">할인 적용 대상</span>
      <span class="v">유료 인화 장수 기준입니다. 포함 인화·무료 컷과 액자는 장수에 넣지 않습니다.
        <span class="de">${discountLineDe} — gilt für kostenpflichtige Drucke; enthaltene Abzüge und Rahmen zählen nicht mit.</span></span>
    </div>` : ''}
    <div class="note">
      <span class="k">용지</span>
      <span class="v">시그니처는 반광 프로 사진용지, 파인아트는 매트 파이버 파인아트지입니다.
        <span class="de">Signature: Semigloss-Fotopapier. FineArt: mattes FineArt-Papier.</span></span>
    </div>${NO_FRAMES ? '' : `
    <div class="note">
      <span class="k">액자</span>
      <span class="v">마운트를 포함한 목재 프레임에 끼워 조립해 드립니다. 액자는 스튜디오 픽업만 가능합니다.
        <span class="de">Montage im Holzrahmen mit Passepartout. Rahmen nur zur Abholung.</span></span>
    </div>`}
    <div class="note">
      <span class="k">규격과 잘림</span>
      <span class="v">규격에 따라 사진 가장자리가 조금 잘립니다. 자세한 내용은 <b>뒷면</b>을 봐 주세요.
        <span class="de">Je nach Format wird der Rand etwas beschnitten — Details auf der <b>Rückseite</b>.</span></span>
    </div>
    <div class="note">
      <span class="k">수령</span>
      <span class="v">촬영 고객은 우편 발송비를 따로 받지 않습니다. 인화만 주문하시는 경우 스튜디오 픽업으로 안내드립니다.
        <span class="de">Für Shooting-Kunden ist der Versand inklusive. Reine Druckbestellungen holen Sie im Studio ab.</span></span>
    </div>
  </div>

  <footer>
    <span>모든 가격은 부가세 포함 · Alle Preise inkl. MwSt.</span>
    <span>뒷면 · 규격과 잘림 안내 / Rückseite: Format &amp; Beschnitt</span>
  </footer>
</div>

<div class="sheet back">
  <h1>규격과 잘림<span class="de">Format &amp; Beschnitt</span></h1>
  <div class="rule"></div>

  <p class="lead">${CROP.ko.what}</p>
  <p class="lead de">${CROP.de.what}</p>

  <svg class="fig" viewBox="0 0 340 132" role="img" aria-label="규격별 잘림 비교">
    <g transform="translate(4,8)">
      <rect x="0" y="0" width="62" height="93" fill="none" stroke="#201C1F" stroke-width="1.1" opacity=".5"/>
      <text x="31" y="48" text-anchor="middle" font-size="8" fill="#6D5A49">그대로</text>
      <text x="31" y="59" text-anchor="middle" font-size="6.5" fill="#6D5A49">unverändert</text>
      <text x="31" y="108" text-anchor="middle" font-size="8.5" fill="#201C1F">10 × 15</text>
      <text x="31" y="118" text-anchor="middle" font-size="6.5" fill="#6D5A49">3:2 · 카메라 원본</text>
    </g>
    <g transform="translate(110,8)">
      <rect x="0" y="0" width="62" height="93" fill="none" stroke="#201C1F" stroke-width="1" opacity=".26"/>
      <rect x="0" y="0" width="62" height="5.6" fill="#C58D66" opacity=".5"/>
      <rect x="0" y="87.4" width="62" height="5.6" fill="#C58D66" opacity=".5"/>
      <rect x="0" y="5.6" width="62" height="81.8" fill="none" stroke="#201C1F" stroke-width="1.1"/>
      <text x="31" y="48" text-anchor="middle" font-size="8" fill="#6D5A49">약 6%</text>
      <text x="31" y="59" text-anchor="middle" font-size="6.5" fill="#6D5A49">ca. 6 %</text>
      <text x="31" y="108" text-anchor="middle" font-size="8.5" fill="#201C1F">A4 · A3</text>
      <text x="31" y="118" text-anchor="middle" font-size="6.5" fill="#6D5A49">긴 변이 잘립니다</text>
    </g>
    <g transform="translate(216,8)">
      <rect x="0" y="0" width="62" height="93" fill="none" stroke="#201C1F" stroke-width="1" opacity=".26"/>
      <rect x="0" y="0" width="62" height="2" fill="#C58D66" opacity=".5"/>
      <rect x="0" y="91" width="62" height="2" fill="#C58D66" opacity=".5"/>
      <rect x="0" y="2" width="62" height="89" fill="none" stroke="#201C1F" stroke-width="1.1"/>
      <text x="31" y="48" text-anchor="middle" font-size="8" fill="#6D5A49">약 2%</text>
      <text x="31" y="59" text-anchor="middle" font-size="6.5" fill="#6D5A49">ca. 2 %</text>
      <text x="31" y="108" text-anchor="middle" font-size="8.5" fill="#201C1F">A3+</text>
      <text x="31" y="118" text-anchor="middle" font-size="6.5" fill="#6D5A49">잘림이 가장 적습니다</text>
    </g>
    <g transform="translate(292,40)">
      <rect x="0" y="0" width="9" height="5" fill="#C58D66" opacity=".5"/>
      <text x="13" y="4.6" font-size="6.8" fill="#6D5A49">잘리는 부분</text>
      <text x="13" y="13" font-size="6.2" fill="#6D5A49">Beschnitt</text>
      <text x="0" y="26" font-size="6.2" fill="#6D5A49">세로 사진 기준</text>
      <text x="0" y="34" font-size="6.2" fill="#6D5A49">Hochformat</text>
    </g>
  </svg>

  <div class="notes back-notes">
    <div class="note">
      <span class="k">${CROP.ko.head}</span>
      <span class="v">${CROP.ko.ours}
        <span class="de">${CROP.de.ours}</span></span>
    </div>
    <div class="note">
      <span class="k">${FIN.finishFull.ko}</span>
      <span class="v">${FIN.finishHelpFull.ko}
        <span class="de">${FIN.finishFull.de} — ${FIN.finishHelpFull.de}</span></span>
    </div>
    <div class="note">
      <span class="k">${FIN.finishBorder.ko}</span>
      <span class="v">${FIN.finishHelpBorder.ko}
        <span class="de">${FIN.finishBorder.de} — ${FIN.finishHelpBorder.de}</span></span>
    </div>
    <div class="note">
      <span class="k">휴대폰 사진</span>
      <span class="v">비율이 달라 조금 더 잘릴 수 있습니다. 원하시는 크롭이 있으면 말씀해 주세요.
        <span class="de">Handyfotos haben ein anderes Seitenverhältnis — hier wird etwas mehr beschnitten. Sagen Sie uns gern, welchen Ausschnitt Sie möchten.</span></span>
    </div>
  </div>

  <footer>
    <span>Studio mean</span>
    <span>${new Date().toISOString().slice(0, 10)}</span>
  </footer>
</div>
</body>
</html>
`;

const out = 'docs/price-card.html';
writeFileSync(join(ROOT, out), html);
const shown = ROWS.flatMap((r) => r.ids).length;
console.log(`✅ ${out} — SKU ${shown}종${NO_FRAMES ? ' (액자 제외)' : ''}`);
console.log(`   단가는 Code.gs PRINT_LABELS 에서 읽었습니다. 단가를 바꾸면 이 스크립트를 다시 돌리세요.`);
ROWS.forEach((r) => {
  console.log(`   ${r.group.ko}: ` + r.ids.map((id) => `${SIZE_KO[id]} ${r.frame ? '+' : ''}${eur(prices[id].retouched)}${r.frame ? '' : '/' + eur(prices[id].price)}`).join(' · '));
});
