#!/usr/bin/env node
/**
 * build-print-guide.mjs — 고객용 「추가 보정 · 인화 안내」 생성기 (KO / EN / DE)
 *
 * 출력: 2026년 가격표/추가보정-인화안내/guide-ko.html · guide-en.html · guide-de.html  (자체 완결 HTML, **생성물 — 직접 고치지 말 것**)
 *
 * 왜 생성하는가: 이 안내문은 손으로 관리되다 가격이 어긋난 채 살아 있었다(2026-09-10, A3+ 원본 €60 vs 정본 €48).
 *   2026-09-17 사장님 지시로 디자인을 새로 하고 액자·대형 규격·영어판을 더하면서, 숫자뿐 아니라 **문서 전체**를
 *   정본에서 그린다. 손으로 만든 옛 파일(price-ko/de.html + base.css)은 보존하고 build-retouch-card.mjs 가 계속 지킨다.
 *
 * 권위:
 *   단가          appscript/Code.gs  PRINT_LABELS                       (check-print-prices.mjs 가 6곳 대조)
 *   추가보정 단가  appscript/Code.gs  getDefaultSelectRetouchPrice_
 *   여러 장 할인   appscript/Code.gs  SELECT_VOLUME_TIER_DEFAULTS_        (설정 시트가 덮어쓸 수 있는 '기본값')
 *   규격(cm)·이름  frontend/shared/print-catalog.js
 *   등급·액자·대형·인화방식 문구  frontend/shared/print-tier-copy.js    🔴 UWG 검수 원문 — 여기서 다듬지 않고 통째로 싣는다
 *
 * 디자인 근거: CI v1 §4 인쇄 기본 = Warm Ivory + Ink Black · Taupe/Sand 보조 · Copper 액센트 한 역할(픽업 전용 표시),
 *   디스플레이 Cormorant Garamond, 본문 Noto Sans KR. 이 문서만의 요소 = **같은 축척으로 그린 규격 사다리**(종이는 물건이다).
 *
 * 사용법:
 *   node scripts/build-print-guide.mjs           3개 파일을 다시 쓴다 (→ PNG 도 다시 내보낼 것)
 *   node scripts/build-print-guide.mjs --check   쓰지 않고 디스크의 파일과 대조 (다르면 exit 1)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, '..', '..', '2026년 가격표', '추가보정-인화안내');
const CHECK = process.argv.includes('--check');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const die = (msg) => { console.error('❌ ' + msg); process.exit(1); };

/* ── 정본 읽기 ─────────────────────────────────────────────────────────── */
const gs = read('appscript/Code.gs');
const prices = {};
for (const m of gs.matchAll(/'([a-z0-9_]+)':\{label:'[^']*',summaryLabel:'[^']*',price:([\d.]+),retouchedPrice:([\d.]+)\}/g)) {
  prices[m[1]] = { orig: +m[2], ret: +m[3] };
}
if (!Object.keys(prices).length) die('PRINT_LABELS 를 파싱하지 못했습니다.');

const retouchFn = gs.match(/function getDefaultSelectRetouchPrice_\([\s\S]*?\n\}/);
if (!retouchFn) die('getDefaultSelectRetouchPrice_ 를 찾지 못했습니다.');
const retouchVals = [...retouchFn[0].matchAll(/return\s+(\d+)\s*;/g)].map((m) => +m[1]);
const RETOUCH = { low: Math.min(...retouchVals), high: Math.max(...retouchVals) };
if (!(RETOUCH.low > 0)) die('추가보정 단가를 읽지 못했습니다.');
/* 단가 '그룹'은 문구(T.rLowK / rHighK)로 적혀 있다 — 코드의 그룹 규칙이 바뀌면 문구도 바꿔야 하므로 여기서 멈춘다.
   현재 규칙(2026-09-17 사장님 결정): €20 = 프리웨딩·웨딩만, 암트 예식·돌잔치·가족파티는 €10.
   ⚠ 실제 세션 단가는 getRetouchInfo_ 가 정한다(wed 그룹만 20) — 두 함수가 같은 말을 하는지도 함께 본다. */
if (/암트|돌잔치|가족파티|standesamt|familienfeier/i.test(retouchFn[0].replace(/\/\*[\s\S]*?\*\//g, ''))) die('getDefaultSelectRetouchPrice_ 의 €20 그룹이 바뀌었습니다 — T.rLowK/rHighK 문구를 맞춘 뒤 이 가드를 고칠 것.');
const infoFn = gs.match(/function getRetouchInfo_\([\s\S]*?\n\}/);
if (!infoFn || [...infoFn[0].matchAll(/price:(\d+)/g)].filter((m) => +m[1] === RETOUCH.high).length !== 1 || !/itemGroup==='wed'\)return\{[^}]*price:20/.test(infoFn[0])) die('getRetouchInfo_ 의 단가 규칙이 바뀌었습니다(€20 은 wed 그룹 한 곳이어야 한다) — 안내문 문구와 대조할 것.');

const tierDefaults = gs.match(/const SELECT_VOLUME_TIER_DEFAULTS_=\{retouch:'([^']*)',print:'([^']*)'\}/);
if (!tierDefaults) die('SELECT_VOLUME_TIER_DEFAULTS_ 를 읽지 못했습니다.');
const parseTiers = (raw) => raw.split(',').map((t) => t.split(':').map(Number)).filter(([c, p]) => c > 0 && p > 0);
const TIERS = { retouch: parseTiers(tierDefaults[1]), print: parseTiers(tierDefaults[2]) };
const SAME_LADDER = tierDefaults[1] === tierDefaults[2];

/* 프런트 ES 모듈은 package.json 에 "type" 이 없어 node 가 import 하지 못한다 — 원문을 읽어 평가한다(값은 그대로). */
const evalModule = (path, names) => {
  const src = read(path).replace(/^import .*$/gm, '').replace(/export\s+/g, '');
  return new Function(`${src}; return {${names.join(',')}};`)();
};
const { PRINT_TIERS, PRINT_METHOD_POINTS, PRINT_MICROCOPY } =
  evalModule('frontend/shared/print-tier-copy.js', ['PRINT_TIERS', 'PRINT_METHOD_POINTS', 'PRINT_MICROCOPY']);
const { PRINT_CATALOG } = evalModule('frontend/shared/print-catalog.js', ['PRINT_CATALOG']);
const cat = Object.fromEntries(PRINT_CATALOG.map((c) => [c.id, c]));

const SKUS = ['basic_10x15', 'basic_a4', 'premium_10x15', 'premium_a4', 'premium_a3', 'premium_a3plus',
  'photocard_single', 'photocard_double', 'frame_a4', 'frame_a3', 'wallart_custom'];
const missing = SKUS.filter((id) => !prices[id] || !cat[id]);
if (missing.length) die(`정본에 없는 SKU: ${missing.join(', ')}`);
/* 픽업 전용 목록은 서버 정규식이 정본이다 — 문서에 손으로 적지 않는다. */
const pickupRe = gs.match(/const SELECT_PICKUP_ONLY_RE_=\/(.+?)\/;/);
if (!pickupRe) die('SELECT_PICKUP_ONLY_RE_ 를 찾지 못했습니다.');
const isPickupOnly = (id) => new RegExp(pickupRe[1]).test(id);

const logo = 'data:image/svg+xml;base64,' + readFileSync(join(OUT_DIR, 'studio-mean-logo.svg')).toString('base64');

/* ── 문구: 검수 원문에 없는 것만 여기 둔다(사실 서술만 — 보존·내구·결과 보장 주장 금지, print-tier-copy.js ①~⑦) ── */
const T = {
  ko: {
    htmlLang: 'ko', title: '추가 보정 · 인화 안내', titleLatin: 'Retouching & Prints',
    lede: '패키지에 포함된 보정·인화를 넘어서 더 원하실 때의 비용입니다. 포함된 수량 안에서는 추가 비용이 없습니다.',
    secRetouch: '추가 보정', secRetouchLatin: 'Retouching', retouchSub: '포함 장수를 넘겨 고르신 사진에만 붙습니다',
    perPhoto: '/ 장',
    rLowK: '프로필 · 스튜디오 · 야외/홈스냅 · 암트 예식 · 돌잔치 · 가족파티', rLowN: '포함 보정 장수를 넘긴 사진 한 장당',
    rHighK: '프리웨딩 · 웨딩', rHighN: '촬영 규모에 따른 별도 단가',
    rNote: '고객님 촬영에 확정된 단가는 셀렉 안내 메일에 적혀 있습니다. 셀렉 화면에서도 고르실 때마다 금액이 함께 표시됩니다.',
    secPrints: '인화', secPrintsLatin: 'Prints',
    colSize: '규격', colRet: '보정본', colOrig: '원본',
    keyRet: '보정을 마친 사진을 인화할 때', keyOrig: '보정하지 않은 원본 사진을 인화할 때',
    ladderCap: '모든 규격을 같은 축척으로 그렸습니다. A4 는 일반 복사용지 크기입니다.',
    cardName: '포토카드', cardSpec: 'PVC 카드에 인쇄하는 수제작 카드 — 종이 인화가 아닙니다',
    cardBody: '사진을 PVC 카드에 인쇄해 스튜디오에서 한 장씩 만듭니다. 표면에는 긁힘 방지 필름을 코팅하고, 지갑에 넣는 카드 크기로 재단해 드립니다. 매일 들고 다니는 사진 — 지갑, 다이어리, 폰케이스 안쪽에.',
    single: '단면', double: '양면',
    secFrames: '액자 · 대형 규격', secFramesLatin: 'Frames & Large format',
    frameFor: { frame_a4: 'A4 인화용', frame_a3: 'A3 인화용' }, frameOuter: '프레임 외곽',
    frameAdd: (ex) => `액자는 인화 가격에 더해지는 금액입니다 (예: ${ex}).`,
    frameEx: (p, f, s) => `파인아트 A3 보정본 ${p} + 액자 ${f} = ${s}`,
    quote: '견적', largeHow: '셀렉 화면의 출력 선택에서 ‘대형·특별 규격 (견적)’을 고르고 원하시는 크기를 적어 주시면, 견적을 보내드립니다.',
    pickupMark: '스튜디오 픽업 전용', pickupLine: (names) => `${names}은 스튜디오 픽업으로만 받으실 수 있습니다.`,
    pickupNames: 'A3+, 액자, 대형·특별 규격',
    secVolume: '여러 장 주문 할인', secVolumeLatin: 'Volume discount',
    tierItem: (n, c, p) => `${n(c)}장부터 ${n('−' + p + '%')}`,
    volNote: '유료 추가 보정과 유료 추가 인화, 각각의 장수 기준입니다. 패키지에 포함된 수량과 액자·대형 규격은 세지 않습니다. 셀렉 화면에서 담을 때마다 할인이 바로 계산돼 보입니다.',
    volRetouch: '추가 보정', volPrint: '추가 인화',
    secIncluded: '패키지에 포함된 인화', secIncludedLatin: 'Included prints',
    incZero: (z) => `포함된 수량 안에서는 ${z}입니다.`,
    incPrewed: '프리웨딩 패키지의 포함 A3 1장은 파인아트 인화입니다.',
    incShown: '포함 여부와 남은 수량은 셀렉 화면에 그때그때 표시됩니다.',
    cropCap: ['10 × 15 — 거의 그대로', 'A4 · A3 — 긴 변에서 약 6%', 'A3+ — 약 2%'], cropLegend: '잘리는 부분',
    foot1: '모든 가격은 19% MwSt.가 포함된 금액입니다 · 2026년 기준',
  },
  en: {
    htmlLang: 'en', title: 'Extra Retouching & Prints', titleLatin: '',
    lede: 'What it costs when you would like more than the retouching and prints included in your package. Within the included quantity there is no extra charge.',
    secRetouch: 'Extra retouching', secRetouchLatin: '', retouchSub: 'Applies only to photos beyond the included number',
    perPhoto: '/ photo',
    rLowK: 'Profile · Studio · Outdoor / Home · Civil ceremony · First-birthday party (Dol) · Family party', rLowN: 'For each photo beyond the included number',
    rHighK: 'Pre-wedding · Wedding', rHighN: 'A separate rate for larger shoots',
    rNote: 'The rate confirmed for your shoot is stated in your selection email. The selection page also shows the amount each time you add a photo.',
    secPrints: 'Prints', secPrintsLatin: '',
    colSize: 'Size', colRet: 'Retouched', colOrig: 'Original',
    keyRet: 'a print of a photo we have retouched', keyOrig: 'a print of an unretouched original',
    ladderCap: 'All sizes drawn to the same scale. A4 is the size of ordinary copy paper.',
    cardName: 'Photocard', cardSpec: 'A hand-made card printed on PVC — not a paper print',
    cardBody: 'We print the photo onto a PVC card and make each one by hand in the studio. The surface is laminated with a scratch-protection film and the card is trimmed to wallet size. The photo you carry every day — in your wallet, your planner, inside your phone case.',
    single: 'single-sided', double: 'double-sided',
    secFrames: 'Frames & large format', secFramesLatin: '',
    frameFor: { frame_a4: 'for an A4 print', frame_a3: 'for an A3 print' }, frameOuter: 'outer frame size',
    frameAdd: (ex) => `The frame is added to the price of the print (e.g. ${ex}).`,
    frameEx: (p, f, s) => `Fine Art A3, retouched ${p} + frame ${f} = ${s}`,
    quote: 'Quote', largeHow: 'On the selection page, choose ‘Large format (quote)’ under print selection and tell us the size you have in mind — we will send you a quote.',
    pickupMark: 'Studio pickup only', pickupLine: (names) => `${names} are available for studio pickup only.`,
    pickupNames: 'A3+, frames and large-format pieces',
    secVolume: 'Volume discount', secVolumeLatin: '',
    tierItem: (n, c, p) => `${n(c)} or more ${n('−' + p + '%')}`,
    volNote: 'Counted separately for paid extra retouching and paid extra prints. Quantities included in your package, frames and large-format pieces do not count. The discount is shown on the selection page as you add items.',
    volRetouch: 'Extra retouching', volPrint: 'Extra prints',
    secIncluded: 'Prints included in your package', secIncludedLatin: '',
    incZero: (z) => `Within the included quantity: ${z}.`,
    incPrewed: 'In the pre-wedding package, the one included A3 is a Fine Art print.',
    incShown: 'What is included and what remains is shown on the selection page as you go.',
    cropCap: ['10 × 15 — almost nothing', 'A4 · A3 — about 6% of the long edge', 'A3+ — about 2%'], cropLegend: 'trimmed area',
    foot1: 'All prices include 19% VAT (MwSt.) · as of 2026',
  },
  de: {
    htmlLang: 'de', title: 'Zusätzliche Retusche & Abzüge', titleLatin: '',
    lede: 'Die Preise für alles, was über die in Ihrem Paket enthaltenen Bearbeitungen und Abzüge hinausgeht. Innerhalb der enthaltenen Menge entstehen keine Zusatzkosten.',
    secRetouch: 'Zusätzliche Retusche', secRetouchLatin: '', retouchSub: 'Gilt nur für Fotos über die enthaltene Anzahl hinaus',
    perPhoto: '/ Foto',
    rLowK: 'Profil · Studio · Outdoor / Home · Standesamt · Familienfeier (Dol)', rLowN: 'Je Foto über die enthaltene Anzahl hinaus',
    rHighK: 'Pre-Wedding · Hochzeit', rHighN: 'Eigener Preis je nach Umfang des Shootings',
    rNote: 'Der für Ihr Shooting festgelegte Preis steht in der Auswahl-E-Mail. Auf der Auswahl-Seite wird der Betrag bei jeder Auswahl mit angezeigt.',
    secPrints: 'Abzüge', secPrintsLatin: '',
    colSize: 'Format', colRet: 'Bearbeitet', colOrig: 'Original',
    keyRet: 'Abzug eines von uns bearbeiteten Fotos', keyOrig: 'Abzug eines unbearbeiteten Originals',
    ladderCap: 'Alle Formate im gleichen Maßstab gezeichnet. A4 entspricht normalem Kopierpapier.',
    cardName: 'Fotokarte', cardSpec: 'Bedruckte PVC-Karte — kein Papierabzug',
    cardBody: 'Wir bedrucken eine PVC-Karte und fertigen jede Karte einzeln bei uns im Studio. Die Oberfläche beschichten wir mit einer Schutzfolie gegen Kratzer, zugeschnitten auf Scheckkartenformat. Das Bild, das täglich mitgeht — im Portemonnaie, im Kalender, in der Handyhülle.',
    single: 'einseitig', double: 'beidseitig',
    secFrames: 'Rahmen & Großformat', secFramesLatin: '',
    frameFor: { frame_a4: 'für einen A4-Druck', frame_a3: 'für einen A3-Druck' }, frameOuter: 'Außenmaß',
    frameAdd: (ex) => `Der Rahmen kommt zum Preis des Drucks hinzu (z. B. ${ex}).`,
    frameEx: (p, f, s) => `FineArt A3, bearbeitet ${p} + Rahmen ${f} = ${s}`,
    quote: 'Angebot', largeHow: 'Wählen Sie auf der Auswahl-Seite unter Druckauswahl „Großformat (Angebot)“ und nennen Sie uns das gewünschte Format — wir senden Ihnen ein Angebot.',
    pickupMark: 'Nur Abholung im Studio', pickupLine: (names) => `${names} sind nur zur Abholung im Studio erhältlich.`,
    pickupNames: 'A3+, Rahmen und Großformate',
    secVolume: 'Mengenrabatt', secVolumeLatin: '',
    tierItem: (n, c, p) => `ab ${n(c)} Stk. ${n('−' + p + ' %')}`,
    volNote: 'Gezählt werden kostenpflichtige Retuschen und kostenpflichtige Abzüge jeweils für sich. Im Paket enthaltene Stückzahlen, Rahmen und Großformate zählen nicht mit. Der Rabatt wird auf der Auswahl-Seite direkt angezeigt.',
    volRetouch: 'Zusätzliche Retusche', volPrint: 'Zusätzliche Abzüge',
    secIncluded: 'Im Paket enthaltene Abzüge', secIncludedLatin: '',
    incZero: (z) => `Innerhalb der enthaltenen Menge: ${z}.`,
    incPrewed: 'Im Pre-Wedding-Paket ist das eine enthaltene A3 ein FineArt-Druck.',
    incShown: 'Was enthalten ist und was noch offen ist, sehen Sie jeweils auf der Auswahl-Seite.',
    cropCap: ['10 × 15 — fast nichts', 'A4 · A3 — rund 6 % der langen Seite', 'A3+ — rund 2 %'], cropLegend: 'beschnittener Bereich',
    foot1: 'Alle Preise inkl. 19 % MwSt. · Stand 2026',
  },
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (lang) => (n) => (lang === 'de' ? `${n} €` : `€${n}`);
const cmText = (lang, cm) => (lang === 'de' ? cm.replace(/\./g, ',') : cm);

/* ── 같은 축척 규격 사다리 (1 cm = S px). 크기는 카탈로그 cm 에서 읽는다 — 그림도 정본을 따른다. ── */
const S = 6;
const dims = (id) => { const m = cat[id].cm.match(/([\d.]+)\s*×\s*([\d.]+)/); return m ? [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])] : null; };
function ladderSvg(lang) {
  const t = T[lang];
  const base = 322, x0 = 2;
  const steps = [
    ['premium_a3plus', 'A3+'], ['premium_a3', 'A3'], ['basic_a4', 'A4'], ['basic_10x15', '10 × 15 cm'], ['photocard_single', t.cardName],
  ];
  const maxW = dims('premium_a3plus')[0] * S;
  const labelX = x0 + maxW + 18;
  let out = '';
  steps.forEach(([id, name]) => {
    const [w, h] = dims(id).map((v) => v * S);
    const y = base - h;
    out += `<rect x="${x0}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${id === 'photocard_single' ? '#EDE3D6' : 'none'}" stroke="#201C1F" stroke-width="1"/>`;
    out += `<line x1="${(x0 + w).toFixed(1)}" y1="${y.toFixed(1)}" x2="${labelX - 6}" y2="${y.toFixed(1)}" stroke="#B9AC9C" stroke-width="1" stroke-dasharray="2 3"/>`;
    const dot = isPickupOnly(id) ? `<circle cx="${labelX + 3}" cy="${(y + 17).toFixed(1)}" r="3" fill="#C58D66"/>` : '';
    out += `<text x="${labelX}" y="${(y + 4.5).toFixed(1)}" class="lb">${esc(name)}</text>`;
    // 이름이 곧 규격인 줄(10 × 15)은 cm 를 한 번 더 찍지 않는다
    const cmLabel = cmText(lang, cat[id].cm);
    if (cmLabel.replace(/\s|cm/g, '') !== name.replace(/\s|cm/g, '')) out += `<text x="${labelX + (dot ? 11 : 0)}" y="${(y + 21).toFixed(1)}" class="ls">${esc(cmLabel)}</text>`;
    out += dot;
  });
  /* 액자: 외곽(카탈로그 cm) 안에 그 액자가 담는 인화 규격을 같은 축척으로 넣는다 → 마운트 폭이 눈에 보인다. */
  let fx = labelX + 138;
  [['frame_a4', 'basic_a4'], ['frame_a3', 'premium_a3']].forEach(([fid, pid]) => {
    const [fw, fh] = dims(fid).map((v) => v * S);
    const [pw, ph] = dims(pid).map((v) => v * S);
    const fy = base - fh;
    out += `<rect x="${fx}" y="${fy.toFixed(1)}" width="${fw}" height="${fh}" fill="#201C1F"/>`;
    out += `<rect x="${fx + 7}" y="${(fy + 7).toFixed(1)}" width="${fw - 14}" height="${fh - 14}" fill="#FBF8F2"/>`;
    out += `<rect x="${(fx + (fw - pw) / 2).toFixed(1)}" y="${(fy + (fh - ph) / 2).toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" fill="#EDE3D6" stroke="#B9AC9C" stroke-width="1"/>`;
    out += `<text x="${fx}" y="${base + 24}" class="lb">${esc(PRINT_TIERS.frame.name[lang])} · ${esc(t.frameFor[fid])}</text>`;
    out += `<circle cx="${fx + 3}" cy="${base + 38}" r="3" fill="#C58D66"/><text x="${fx + 11}" y="${base + 42}" class="ls">${esc(t.frameOuter)} ${esc(cmText(lang, cat[fid].cm))}</text>`;
    fx += fw + 26;
  });
  return `<svg viewBox="0 0 840 ${base + 52}" width="840" height="${base + 52}" role="img" aria-label="${esc(t.ladderCap)}" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="${base + 0.5}" x2="840" y2="${base + 0.5}" stroke="#201C1F" stroke-width="1"/>${out}</svg>`;
}

/* ── 잘림 그림: 3:2 원본 위에 규격이 덮지 못하는 띠를 실제 비율로 칠한다 ── */
function cropSvg(lang) {
  const t = T[lang];
  const ids = ['basic_10x15', 'basic_a4', 'premium_a3plus'];
  let out = '';
  ids.forEach((id, i) => {
    const [w, h] = dims(id);
    const lost = Math.max(0, 1 - (h / w) / 1.5);            // 긴 변에서 잘리는 비율 (A4·A3 5.71%, A3+ 2.13%, 10×15 0)
    const pw = 100, ph = 150, x = i * 262, band = (ph * lost) / 2;
    out += `<rect x="${x}" y="0" width="${pw}" height="${ph}" fill="#EDE3D6" stroke="#201C1F" stroke-width="1"/>`;
    if (band > 0.2) {
      out += `<rect x="${x}" y="0" width="${pw}" height="${band.toFixed(2)}" fill="#C58D66" opacity=".55"/><rect x="${x}" y="${(ph - band).toFixed(2)}" width="${pw}" height="${band.toFixed(2)}" fill="#C58D66" opacity=".55"/>`;
    }
    out += `<text x="${x + pw + 14}" y="18" class="ls" style="fill:#201C1F">${esc(t.cropCap[i].split(' — ')[0])}</text><text x="${x + pw + 14}" y="36" class="ls">${esc(t.cropCap[i].split(' — ')[1])}</text>`;
  });
  return `<svg viewBox="0 0 800 152" width="800" height="152" role="img" aria-label="${esc(t.cropLegend)}" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}

/* ── 페이지 ─────────────────────────────────────────────────────────────── */
const CSS = `
:root{--ivory:#F8F3EB;--paper:#FBF8F2;--ink:#201C1F;--taupe:#6D5A49;--mute:#8C7D6E;--sand:#EDE3D6;--line:#DCD0C0;--copper:#C58D66;
  --display:"Cormorant Garamond","Cormorant",Georgia,"Times New Roman",serif;--body:"Noto Sans KR","Apple SD Gothic Neo",-apple-system,"Helvetica Neue",Arial,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
html{background:var(--ivory)}
body{width:1000px;background:var(--ivory);color:var(--ink);font-family:var(--body);font-weight:300;font-size:15px;line-height:1.75;-webkit-font-smoothing:antialiased;word-break:keep-all;overflow-wrap:break-word}
.sheet{padding:78px 80px 60px}
header{display:grid;grid-template-columns:1fr auto;align-items:end;gap:24px;padding-bottom:30px;border-bottom:1px solid var(--ink)}
header img{width:214px;height:70px;display:block}
header .place{font-size:10.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--mute);text-align:right;line-height:1.9}
h1{font-family:var(--display);font-weight:500;font-size:54px;line-height:1.12;letter-spacing:-.01em;margin-top:44px;text-wrap:balance}
h1.ko{font-family:var(--body);font-weight:300;font-size:40px;letter-spacing:-.025em}
.latin{font-family:var(--display);font-style:italic;font-weight:400;color:var(--taupe)}
h1+.latin{display:block;font-size:26px;margin-top:6px}
.lede{margin-top:20px;max-width:700px;color:var(--taupe);font-size:15.5px;text-wrap:pretty}
section{margin-top:58px}
.sec{display:flex;align-items:baseline;gap:14px;padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:24px}
.sec h2{font-family:var(--display);font-weight:500;font-size:30px;line-height:1.2;letter-spacing:-.005em}
.sec h2.ko{font-family:var(--body);font-weight:500;font-size:21px;letter-spacing:-.02em}
.sec .latin{font-size:19px}
.sec p{margin-left:auto;font-size:12.5px;color:var(--mute);text-align:right}
.num{font-family:var(--display);font-weight:500;font-variant-numeric:lining-nums tabular-nums;letter-spacing:-.005em}
.rates{display:grid;grid-template-columns:1fr 1fr;gap:0 48px}
.rate .k{font-size:13.5px;color:var(--taupe);min-height:48px}
.rate .v{font-size:52px;line-height:1.05;margin-top:4px}
.rate .v small{font-family:var(--body);font-weight:300;font-size:13px;color:var(--mute);margin-left:8px;letter-spacing:0}
.rate .n{font-size:12.5px;color:var(--mute);margin-top:6px}
.note{margin-top:22px;padding:14px 18px;background:var(--sand);font-size:13px;color:var(--taupe);line-height:1.7}
.ladder{margin:4px 0 8px}
.ladder text,.crop text{font-family:var(--body)}
.lb{font-size:13px;font-weight:500;fill:#201C1F}
.ls{font-size:11.5px;font-weight:300;fill:#8C7D6E}
.cap{font-size:12px;color:var(--mute);margin-top:6px}
.grade{margin-top:34px}
.ghead{display:flex;align-items:baseline;gap:12px}
.ghead h3{font-size:16px;font-weight:500;letter-spacing:-.01em;flex:none}
.ghead h3.lat{font-family:var(--display);font-size:22px;font-weight:500;letter-spacing:0}
.ghead span{font-size:12.5px;color:var(--mute);line-height:1.5}
.gnote{font-size:13px;color:var(--taupe);margin-top:6px;max-width:700px}
table{width:100%;border-collapse:collapse;margin-top:10px}
th,td{text-align:left;padding:9px 0;border-bottom:1px solid var(--line);font-size:14.5px;font-weight:400}
thead th{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--mute);font-weight:400;padding-bottom:6px}
tbody tr:last-child td{border-bottom:0}
td.cm{color:var(--mute);font-size:13px;width:170px;font-weight:300}
th.p,td.p{text-align:right;width:112px}
td.p{font-size:23px;line-height:1.1}
td.p.sub{color:var(--taupe);font-size:19px}
td.p.add{font-size:23px}
td.p.q{font-family:var(--body);font-size:13px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--taupe)}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--copper);margin-left:8px;vertical-align:middle}
.key{display:flex;gap:26px;flex-wrap:wrap;margin-top:16px;font-size:12.5px;color:var(--mute)}
.key b{font-weight:500;color:var(--ink);margin-right:6px}
.key .dot{margin:0 7px 0 0}
.tiers{display:flex;flex-wrap:wrap;gap:6px 34px;align-items:baseline}
.tiers .tier{font-size:15px;color:var(--taupe);white-space:nowrap}
.tiers .num{font-size:32px;color:var(--ink);margin:0 2px}
.tiers .who{font-size:12.5px;color:var(--mute);min-width:112px}
.plain{list-style:none}
.plain li{position:relative;padding-left:18px;margin-top:9px;font-size:14px;color:var(--taupe)}
.plain li:first-child{margin-top:0;color:var(--ink);font-weight:400}
.plain li::before{content:"";position:absolute;left:0;top:12px;width:8px;height:1px;background:var(--taupe)}
.method{display:grid;grid-template-columns:1fr 1fr;gap:26px 48px}
.method .wide{grid-column:1 / -1}
.method h4{font-size:14.5px;font-weight:500;margin-bottom:6px}
.method p{font-size:13.5px;color:var(--taupe);line-height:1.8}
.method p+p{margin-top:8px}
.crop{margin-top:16px}
footer{margin-top:64px;padding-top:20px;border-top:1px solid var(--ink);font-size:12px;color:var(--mute);line-height:1.8;display:flex;justify-content:space-between;gap:30px}
footer .r{text-align:right}
@media print{@page{size:A4;margin:0}body{width:210mm;zoom:.794}section,.grade{break-inside:avoid}}
`;

function page(lang) {
  const t = T[lang], eur = money(lang), ko = lang === 'ko';
  const h2 = (txt, latin) => `<h2${ko ? ' class="ko"' : ''}>${esc(txt)}</h2>${latin ? `<span class="latin">${esc(latin)}</span>` : ''}`;
  const tierName = (k) => PRINT_TIERS[k].name[lang];
  const row = (id, label) => {
    const p = prices[id];
    const cm = cmText(lang, cat[id].cm);
    return `<tr><td>${esc(label)}${isPickupOnly(id) ? '<span class="dot"></span>' : ''}</td><td class="cm">${cm.replace(/\s/g, '') === String(label).replace(/\s/g, '') ? '' : esc(cm)}</td><td class="p num">${eur(p.ret)}</td><td class="p sub num">${eur(p.orig)}</td></tr>`;
  };
  const thead = `<thead><tr><th>${esc(t.colSize)}</th><th></th><th class="p">${esc(t.colRet)}</th><th class="p">${esc(t.colOrig)}</th></tr></thead>`;
  const grade = (key, rows) => {
    const g = PRINT_TIERS[key];
    return `<div class="grade"><div class="ghead"><h3${ko ? '' : ' class="lat"'}>${esc(g.name[lang])}</h3><span>${esc(g.paperSpec[lang])}</span></div>
      <p class="gnote">${esc(g.character[lang])} ${esc(g.bestFor[lang])}</p>
      <table>${thead}<tbody>${rows}</tbody></table></div>`;
  };
  const sizeLabel = (id) => ({ basic_10x15: '10 × 15 cm', premium_10x15: '10 × 15 cm', basic_a4: 'A4', premium_a4: 'A4', premium_a3: 'A3', premium_a3plus: 'A3+' }[id]);
  const crop = PRINT_METHOD_POINTS[lang].points.find((p) => /잘리|crop|Zuschnitt/.test(p.head));
  const colour = PRINT_METHOD_POINTS[lang].points[0];
  const checked = PRINT_METHOD_POINTS[lang].points[3];
  if (!crop || !colour || !checked) die(`[${lang}] 인화 방식 원문 구조가 바뀌었습니다.`);
  const [cropWhat, cropOurs] = crop.body.split('<br>');
  const a3 = prices.premium_a3.ret, fr = prices.frame_a3.ret;
  const numSpan = (v) => `<span class="num">${esc(v)}</span>`;
  const tiersLine = (arr) => arr.map(([c, p]) => `<span class="tier">${t.tierItem(numSpan, c, p)}</span>`).join('');
  const volume = SAME_LADDER
    ? `<div class="tiers">${tiersLine(TIERS.print)}</div>`
    : `<div class="tiers"><span class="who">${esc(t.volRetouch)}</span>${tiersLine(TIERS.retouch)}</div><div class="tiers"><span class="who">${esc(t.volPrint)}</span>${tiersLine(TIERS.print)}</div>`;

  return `<!doctype html>
<!-- 생성물 — 직접 고치지 말 것. 원본: reservation/scripts/build-print-guide.mjs (정본: Code.gs PRINT_LABELS · print-catalog.js · print-tier-copy.js) -->
<html lang="${t.htmlLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=1000">
<title>${esc(t.title)} — Studio mean</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Noto+Sans+KR:wght@300;400;500&display=swap">
<style>${CSS}</style></head>
<body><div class="sheet">

<header><img src="${logo}" alt="Studio mean"><div class="place">Oberursel (Taunus)<br>2026</div></header>

<h1${ko ? ' class="ko"' : ''}>${esc(t.title)}</h1>${t.titleLatin ? `<span class="latin">${esc(t.titleLatin)}</span>` : ''}
<p class="lede">${esc(t.lede)}</p>

<section>
  <div class="sec">${h2(t.secRetouch, t.secRetouchLatin)}<p>${esc(t.retouchSub)}</p></div>
  <div class="rates">
    <div class="rate"><div class="k">${esc(t.rLowK)}</div><div class="v num">${eur(RETOUCH.low)}<small>${esc(t.perPhoto)}</small></div><div class="n">${esc(t.rLowN)}</div></div>
    <div class="rate"><div class="k">${esc(t.rHighK)}</div><div class="v num">${eur(RETOUCH.high)}<small>${esc(t.perPhoto)}</small></div><div class="n">${esc(t.rHighN)}</div></div>
  </div>
  <p class="note">${esc(t.rNote)}</p>
</section>

<section>
  <div class="sec">${h2(t.secPrints, t.secPrintsLatin)}<p>${esc(PRINT_MICROCOPY.selectStepNote[lang])}</p></div>
  <div class="ladder">${ladderSvg(lang)}</div>
  <p class="cap">${esc(t.ladderCap)}</p>
  ${grade('signature', ['basic_10x15', 'basic_a4'].map((id) => row(id, sizeLabel(id))).join(''))}
  ${grade('fineart', ['premium_10x15', 'premium_a4', 'premium_a3', 'premium_a3plus'].map((id) => row(id, sizeLabel(id))).join(''))}
  <div class="grade"><div class="ghead"><h3${ko ? '' : ' class="lat"'}>${esc(tierName('photocard'))}</h3><span>${esc(t.cardSpec)}</span></div>
    <p class="gnote">${esc(t.cardBody)}</p>
    <table>${thead}<tbody>${row('photocard_single', t.single)}${row('photocard_double', t.double)}</tbody></table></div>
  <div class="key"><span><b>${esc(t.colRet)}</b>${esc(t.keyRet)}</span><span><b>${esc(t.colOrig)}</b>${esc(t.keyOrig)}</span><span><span class="dot"></span>${esc(t.pickupMark)}</span></div>
</section>

<section>
  <div class="sec">${h2(t.secFrames, t.secFramesLatin)}</div>
  <div class="grade" style="margin-top:0"><div class="ghead"><h3${ko ? '' : ' class="lat"'}>${esc(tierName('frame'))}</h3><span>${esc(PRINT_TIERS.frame.paper[lang])}</span></div>
    <table><tbody>
      ${['frame_a4', 'frame_a3'].map((id) => `<tr><td>${esc(t.frameFor[id])}<span class="dot"></span></td><td class="cm">${esc(t.frameOuter)} ${esc(cmText(lang, cat[id].cm))}</td><td class="p add num" colspan="2">+ ${eur(prices[id].ret)}</td></tr>`).join('')}
    </tbody></table>
    <p class="gnote">${esc(t.frameAdd(t.frameEx(eur(a3), eur(fr), eur(a3 + fr))))}</p></div>
  <div class="grade"><div class="ghead"><h3${ko ? '' : ' class="lat"'}>${esc(tierName('wallart'))}</h3><span>${esc(PRINT_TIERS.wallart.paper[lang])}</span></div>
    <table><tbody><tr><td>${esc(PRINT_TIERS.wallart.texture[lang])}<span class="dot"></span></td><td class="cm"></td><td class="p q" colspan="2">${esc(t.quote)}</td></tr></tbody></table>
    <p class="gnote">${esc(t.largeHow)}</p></div>
  <p class="note">${esc(t.pickupLine(t.pickupNames))}</p>
</section>

<section>
  <div class="sec">${h2(t.secVolume, t.secVolumeLatin)}</div>
  ${volume}
  <p class="gnote" style="margin-top:14px">${esc(t.volNote)}</p>
</section>

<section>
  <div class="sec">${h2(t.secIncluded, t.secIncludedLatin)}</div>
  <ul class="plain">
    <li>${esc(t.incZero(eur(0)))}</li>
    <li>${esc(PRINT_MICROCOPY.quotaUpgradeNote[lang])}</li>
    <li>${esc(PRINT_MICROCOPY.bookingGradeNote[lang])} ${esc(t.incPrewed)}</li>
    <li>${esc(t.incShown)}</li>
  </ul>
</section>

<section>
  <div class="sec">${h2(PRINT_METHOD_POINTS[lang].title, ko ? 'How we print' : '')}</div>
  <div class="method">
    <div class="wide"><h4>${esc(crop.head)}</h4><p>${esc(cropWhat)}</p><p>${esc(cropOurs || '')}</p>
      <div class="crop">${cropSvg(lang)}</div></div>
    <div><h4>${esc(colour.head)}</h4><p>${esc(colour.body)}</p></div>
    <div><h4>${esc(checked.head)}</h4><p>${esc(checked.body)}</p></div>
  </div>
</section>

<footer><div>${esc(t.foot1)}<br>Studio mean · Holzweg-Passage 3, 61440 Oberursel (Taunus)</div>
  <div class="r">studio.mean.de@gmail.com · +49 176 60939400<br>@studio_mean · booking.studio-mean.com</div></footer>

</div></body></html>
`;
}

let drift = 0;
for (const lang of ['ko', 'en', 'de']) {
  const file = join(OUT_DIR, `guide-${lang}.html`);
  const html = page(lang);
  if (CHECK) {
    const cur = existsSync(file) ? readFileSync(file, 'utf8') : '';
    if (cur !== html) { console.error(`✗ [${lang}] 디스크의 guide-${lang}.html 이 정본과 다릅니다.`); drift += 1; } else console.log(`[${lang}] ✅ 정본과 일치`);
  } else {
    writeFileSync(file, html);
    console.log(`[${lang}] ${file.split('/').slice(-1)[0]} (${(html.length / 1024).toFixed(0)} KB)`);
  }
}
if (drift) { console.error('\n✗ node scripts/build-print-guide.mjs 로 재생성하고 PNG 를 다시 내보내세요.'); process.exit(1); }
console.log(CHECK ? '\n✅ 전부 정본과 일치합니다.' : '\n✅ 3개 언어 생성 완료 — PNG 를 다시 내보낼 것.');
