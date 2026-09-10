#!/usr/bin/env node
/**
 * build-retouch-card.mjs — 고객 안내문(추가 보정 · 인화)의 **금액을 정본에서 다시 쓴다**
 *
 * 대상: 2026년 가격표/추가보정-인화안내/price-ko.html · price-de.html
 *
 * 왜 필요한가: 이 두 파일은 손으로 관리되다 **가격이 어긋난 채 살아 있었다**(2026-09-10 실측).
 *   파인아트 A3 원본 50(정본 38) · A3+ 원본 60(정본 48) · 포토카드 5/5·8/8(정본 6/5·9/7)
 *   → A3+ 한 장에 €12 를 더 받는 안내문이 고객에게 나갈 뻔했다.
 *   인화 가격 정의처는 이미 6곳이고 검사기가 지킨다. 손으로 쓴 안내문은 **7번째·8번째**가 되는데,
 *   종이·이미지로 나가면 어긋나도 검사기가 못 잡는다.
 *
 * 무엇을 하는가: **숫자만** 기계가 소유한다. 디자인·문구·레이아웃은 손편집 그대로 둔다.
 *   행은 순서가 아니라 **라벨로 매칭**한다 — 순서에 기대면 행을 하나 끼워 넣는 순간 값이 밀린다.
 *   매칭 못 한 SKU 가 하나라도 있으면 **실패로 끝낸다**(조용히 건너뛰지 않는다).
 *
 * 권위:
 *   인화 단가   → appscript/Code.gs  PRINT_LABELS      (check-print-prices.mjs 가 6곳 대조)
 *   추가보정 단가 → appscript/Code.gs  getDefaultSelectRetouchPrice_
 *                  (wed / 암트·돌잔치·가족파티·웨딩 계열 → 20, 그 외 → 10)
 *                  ⚠ 세션별로 '리터칭단가' 컬럼이 덮어쓸 수 있다 — 안내문엔 **기본값**임을 명시할 것.
 *
 * 사용법:
 *   node scripts/build-retouch-card.mjs           금액을 정본으로 다시 쓴다
 *   node scripts/build-retouch-card.mjs --check   쓰지 않고 대조만 (어긋나면 exit 1)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARD_DIR = join(ROOT, '..', '..', '2026년 가격표', '추가보정-인화안내');
const CHECK = process.argv.includes('--check');

/* ── 정본 읽기 ─────────────────────────────────────────────────────────── */
const gs = readFileSync(join(ROOT, 'appscript/Code.gs'), 'utf8');

const prices = {};
for (const m of gs.matchAll(
  /'([a-z0-9_]+)':\{label:'[^']*',summaryLabel:'[^']*',price:([\d.]+),retouchedPrice:([\d.]+)\}/g
)) {
  prices[m[1]] = { orig: +m[2], ret: +m[3] };
}
if (!Object.keys(prices).length) {
  console.error('❌ PRINT_LABELS 를 파싱하지 못했습니다 — Code.gs 구조가 바뀌었을 수 있습니다.');
  process.exit(1);
}

/* 추가보정 기본 단가 — 함수 본문에서 두 값을 읽는다(하드코딩하면 9번째 정의처가 된다). */
const retouchFn = gs.match(/function getDefaultSelectRetouchPrice_\([\s\S]*?\n\}/);
if (!retouchFn) { console.error('❌ getDefaultSelectRetouchPrice_ 를 찾지 못했습니다.'); process.exit(1); }
const retouchVals = [...retouchFn[0].matchAll(/return\s+(\d+)\s*;/g)].map((m) => +m[1]);
const RETOUCH_HIGH = Math.max(...retouchVals);   // wed·암트·돌잔치 계열
const RETOUCH_LOW = Math.min(...retouchVals);    // 프로필·스튜디오·야외/홈스냅
if (!(RETOUCH_LOW > 0 && RETOUCH_HIGH > 0)) { console.error('❌ 추가보정 단가를 읽지 못했습니다.'); process.exit(1); }

/* ── 행 라벨 → SKU. 라벨은 각 문서의 실제 표기 그대로다. ──────────────── */
const ROW_SKU = {
  ko: {
    '시그니처 10×15cm': 'basic_10x15', '시그니처 A4': 'basic_a4',
    '파인아트 10×15cm': 'premium_10x15', '파인아트 A4': 'premium_a4',
    '파인아트 A3': 'premium_a3', '파인아트 A3+': 'premium_a3plus',
    '포토카드 (단면)': 'photocard_single', '포토카드 (양면)': 'photocard_double',
  },
  de: {
    'Signature-Abzug 10×15cm': 'basic_10x15', 'Signature-Abzug A4': 'basic_a4',
    'FineArt-Druck 10×15cm': 'premium_10x15', 'FineArt-Druck A4': 'premium_a4',
    'FineArt-Druck A3': 'premium_a3', 'FineArt-Druck A3+': 'premium_a3plus',
    'Fotokarte (einseitig)': 'photocard_single', 'Fotokarte (beidseitig)': 'photocard_double',
  },
};
// KO 는 €3, DE 는 3 € 표기다. 문서의 관행을 바꾸지 않는다.
const fmt = { ko: (n) => `€${n}`, de: (n) => `${n} €` };

const ROW_RE = /(<tr><td>)([^<]+)(<\/td><td class="cm">)([^<]*)(<\/td>\s*<td class="n p">)([^<]*)(<\/td><td class="n p sub">)([^<]*)(<\/td><\/tr>)/g;
/* 추가보정 밴드는 <div class="v">€10<small>/ 장</small></div> 형태다 —
   금액 뒤에 <small> 이 붙어 있어 </div> 까지 잡으면 매칭이 0 이 된다(2026-09-10). 첫 '<' 앞까지만 본다. */
const BAND_RE = /(<div class="v">)([^<]*)/g;

let problems = 0;
let changed = 0;

for (const lang of ['ko', 'de']) {
  const file = join(CARD_DIR, `price-${lang}.html`);
  let src;
  try { src = readFileSync(file, 'utf8'); }
  catch { console.error(`❌ ${file} 를 열지 못했습니다.`); problems += 1; continue; }

  const seen = new Set();
  const diffs = [];

  let out = src.replace(ROW_RE, (full, a, label, c, cm, e, retCell, g, origCell, i) => {
    const sku = ROW_SKU[lang][label.trim()];
    if (!sku) {
      console.error(`❌ [${lang}] 표에 정본과 짝지을 수 없는 행: "${label.trim()}"`);
      problems += 1;
      return full;
    }
    seen.add(sku);
    const want = { ret: fmt[lang](prices[sku].ret), orig: fmt[lang](prices[sku].orig) };
    if (retCell.trim() !== want.ret) diffs.push(`${label.trim()} 보정본 ${retCell.trim()} → ${want.ret}`);
    if (origCell.trim() !== want.orig) diffs.push(`${label.trim()} 원본 ${origCell.trim()} → ${want.orig}`);
    return a + label + c + cm + e + want.ret + g + want.orig + i;
  });

  // 추가보정 밴드 — 문서 순서가 (낮은 단가, 높은 단가) 다.
  const bandWant = [fmt[lang](RETOUCH_LOW), fmt[lang](RETOUCH_HIGH)];
  let bandIdx = 0;
  out = out.replace(BAND_RE, (full, a, val) => {
    const want = bandWant[bandIdx];
    bandIdx += 1;
    if (want === undefined) return full;
    if (val.trim() !== want) diffs.push(`추가보정 ${val.trim()} → ${want}`);
    return a + want;
  });
  if (bandIdx !== 2) {
    console.error(`❌ [${lang}] 추가보정 단가 밴드가 2개가 아닙니다(${bandIdx}개) — 구조가 바뀌었습니다.`);
    problems += 1;
  }

  const missing = Object.values(ROW_SKU[lang]).filter((s) => !seen.has(s));
  if (missing.length) {
    console.error(`❌ [${lang}] 표에서 못 찾은 SKU: ${missing.join(', ')}`);
    problems += 1;
  }

  if (diffs.length) {
    console.log(`\n[${lang}] 정본과 다른 값 ${diffs.length}건`);
    diffs.forEach((d) => console.log('  · ' + d));
    if (!CHECK) { writeFileSync(file, out); changed += 1; }
    problems += CHECK ? 1 : 0;
  } else {
    console.log(`[${lang}] ✅ 정본과 일치`);
  }
}

if (problems) {
  console.error(CHECK
    ? '\n✗ 안내문 금액이 정본과 다릅니다 — node scripts/build-retouch-card.mjs 로 갱신하세요.'
    : '\n✗ 구조 문제가 있습니다 — 위 오류를 먼저 해결하세요.');
  process.exit(1);
}
console.log(changed ? `\n✅ ${changed}개 파일을 정본 금액으로 갱신했습니다. PNG 는 다시 내보내야 합니다.` : '\n✅ 전부 정본과 일치합니다.');
