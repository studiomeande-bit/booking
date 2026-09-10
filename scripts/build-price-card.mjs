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
  header{ text-align:center; margin-bottom:7mm; }
  .logo{
    font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-weight:600;
    font-size:26pt; letter-spacing:.01em; margin:0;
  }
  .tag{ margin:2mm 0 0; font-size:7.5pt; letter-spacing:.32em; text-transform:uppercase; color:var(--taupe); }
  h1{
    font-family:'Cormorant Garamond',Georgia,serif; font-weight:400; font-size:19pt;
    margin:6mm 0 1mm; letter-spacing:.02em;
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
  td{ padding:2.1mm 0; vertical-align:middle; }
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

  .notes{ margin-top:auto; padding-top:6mm; }
  .note{
    display:flex; gap:4mm; align-items:baseline; padding:2.2mm 0;
    border-top:1px solid rgba(32,28,31,.10); font-size:8.2pt; line-height:1.55;
  }
  .note:first-child{ border-top:none; }
  .note .k{ flex:0 0 30mm; color:var(--taupe); font-size:7.6pt; letter-spacing:.05em; }
  .note .v .de{ display:block; color:var(--taupe); font-size:7.4pt; margin-top:.6mm; }
  footer{
    margin-top:5mm; padding-top:2.5mm; border-top:1px solid rgba(32,28,31,.16);
    display:flex; justify-content:space-between; font-size:7pt; color:var(--taupe); letter-spacing:.04em;
  }
  @media print{ html,body{ background:var(--ivory); } .sheet{ margin:0; } }
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

  <div class="notes">
    <div class="note">
      <span class="k">보정본 · 원본</span>
      <span class="v">보정을 마친 사진은 보정본 가격으로, 보정하지 않은 촬영 원본은 원본 가격으로 인화합니다.
        <span class="de">Bereits retuschierte Bilder zum Preis „retuschiert“, unbearbeitete Aufnahmen zum Preis „unbearbeitet“.</span></span>
    </div>${discountLine ? `
    <div class="note">
      <span class="k">여러 장 주문</span>
      <span class="v">유료 인화 ${discountLine}
        <span class="de">Mengenrabatt auf kostenpflichtige Drucke: ${discountLineDe}</span></span>
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
      <span class="k">수령</span>
      <span class="v">촬영 고객은 우편 발송비를 따로 받지 않습니다. 인화만 주문하시는 경우 스튜디오 픽업으로 안내드립니다.
        <span class="de">Für Shooting-Kunden ist der Versand inklusive. Reine Druckbestellungen holen Sie im Studio ab.</span></span>
    </div>
  </div>

  <footer>
    <span>모든 가격은 부가세 포함 · Alle Preise inkl. MwSt.</span>
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
