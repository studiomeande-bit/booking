#!/usr/bin/env node
/**
 * check-print-prices.mjs — 인화 SKU 정의처 드리프트 검사기
 *
 * 왜 필요한가: 인화 가격·라벨이 **6곳**에 흩어져 있고 수동 동기화라 반복해서 어긋났다.
 *   - 리네이밍 때 AdminV2 PRINT_PRICES 누락(뒤늦게 4b7255d 로 수정)
 *   - AdminV2 basic_10x15 보정본가가 0 으로 남아 어드민 수동주문만 무료였던 드리프트
 *   - AdminV2 INVOICE_PRINT_LABELS 는 구 명칭 + premium_a3plus 누락 상태로 방치
 * 하나만 고치면 화면가와 청구가가 어긋나므로, 배포 전에 이 스크립트로 전수 대조한다.
 *
 * 검사 대상(정의처):
 *   1) appscript/Code.gs           PRINT_LABELS              ← 과금 권위(기준)
 *   2) appscript/AdminV2.html      PRINT_PRICES              (어드민 수동주문/견적)
 *   3) frontend/select/select.js   PRINT_OPTIONS             (셀렉 v1)
 *   4) frontend/select/v2/select.js PRINT_OPTIONS            (셀렉 v2)
 *   5) frontend/shared/print-catalog.js PRINT_CATALOG        (예약 안내 — 추가가만)
 *   6) 인보이스 라벨: Code.gs getInvoicePrintLabelCatalog_ ↔ AdminV2 INVOICE_PRINT_LABELS
 *   + frontend/shared/print-tier-copy.js PRINT_ID_TIER 커버리지(등급 매핑 누락 SKU)
 *
 * 사용법:  node scripts/check-print-prices.mjs       (불일치 시 exit 1)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* 의도된 예외를 여기 등록한다(빈 객체 = 예외 없음).
   예: { basic_10x15: { admin: { retouched: 0 } } } → 어드민만 0 인 것을 허용 */
const ALLOWED_EXCEPTIONS = {};

function parseServerPrices(src) {
  const out = {};
  const re = /'([a-z0-9_]+)':\{label:'[^']*',summaryLabel:'[^']*',price:([\d.]+),retouchedPrice:([\d.]+)\}/g;
  for (const m of src.matchAll(re)) out[m[1]] = { price: +m[2], retouched: +m[3] };
  return out;
}
function parseAdminPrices(src) {
  const out = {};
  const re = /'([a-z0-9_]+)':\{label:'[^']*',price:([\d.]+),priceRetouched:([\d.]+)\}/g;
  for (const m of src.matchAll(re)) out[m[1]] = { price: +m[2], retouched: +m[3] };
  return out;
}
function parseSelectOptions(src) {
  const out = {};
  const re = /id:\s*'([a-z0-9_]+)',\s*label:\s*'[^']*',\s*retouched:\s*([\d.]+),\s*additional:\s*([\d.]+)/g;
  for (const m of src.matchAll(re)) out[m[1]] = { retouched: +m[2], price: +m[3] };
  return out;
}
function parseCatalog(src) {
  const out = {};
  const re = /id:\s*'([a-z0-9_]+)',\s*cm:\s*'[^']*',\s*additional:\s*([\d.]+)/g;
  for (const m of src.matchAll(re)) out[m[1]] = { price: +m[2] };
  return out;
}
function parseI18nLabels(src, constName) {
  // { ko:'…', en:'…', de:'…' } 형태의 SKU 라벨 맵
  const block = src.split(constName)[1] || '';
  const body = block.slice(0, block.indexOf('};') + 1);
  const out = {};
  const re = /([a-z0-9_]+):\{ko:'([^']*)',en:'([^']*)',de:'([^']*)'\}/g;
  for (const m of body.matchAll(re)) out[m[1]] = { ko: m[2], en: m[3], de: m[4] };
  return out;
}
function parseTierIds(src) {
  const block = src.split('PRINT_ID_TIER')[1] || '';
  const body = block.slice(0, block.indexOf('};') + 1);
  return [...body.matchAll(/([a-z0-9_]+):\s*'(signature|fineart|photocard)'/g)].map((m) => m[1]);
}

const gs = read('appscript/Code.gs');
const adminSrc = read('appscript/AdminV2.html');

const server = parseServerPrices(gs);
const admin = parseAdminPrices(adminSrc);
const v1 = parseSelectOptions(read('frontend/select/select.js'));
const v2 = parseSelectOptions(read('frontend/select/v2/select.js'));
const catalog = parseCatalog(read('frontend/shared/print-catalog.js'));
const invServer = parseI18nLabels(gs, 'function getInvoicePrintLabelCatalog_');
const invAdmin = parseI18nLabels(adminSrc, 'const INVOICE_PRINT_LABELS=');
const tierIds = parseTierIds(read('frontend/shared/print-tier-copy.js'));

const problems = [];
const skus = Object.keys(server).filter((id) => id !== 'print_none');

if (!skus.length) problems.push('Code.gs PRINT_LABELS 를 파싱하지 못했습니다 — 스크립트의 정규식이 낡았을 수 있습니다.');

const allow = (id, where, field) => ALLOWED_EXCEPTIONS[id]?.[where]?.[field] !== undefined;

for (const id of skus) {
  const base = server[id];
  const check = (where, got) => {
    if (!got) { problems.push(`${id}: ${where} 에 SKU 가 없습니다`); return; }
    for (const field of ['price', 'retouched']) {
      if (got[field] === undefined) continue;
      if (got[field] !== base[field] && !allow(id, where, field)) {
        problems.push(`${id}: ${where}.${field}=${got[field]} ≠ 서버(권위) ${base[field]}`);
      }
    }
  };
  check('admin', admin[id]);
  check('v1', v1[id]);
  check('v2', v2[id]);
  check('catalog', catalog[id]);
  if (!tierIds.includes(id)) problems.push(`${id}: print-tier-copy.js PRINT_ID_TIER 에 등급 매핑이 없습니다`);
  // 인보이스 라벨: 서버에 있으면 어드민에도 같은 문자열로 있어야 한다
  if (invServer[id]) {
    const a = invAdmin[id];
    if (!a) problems.push(`${id}: AdminV2 INVOICE_PRINT_LABELS 에 없습니다(인보이스 라벨 누락)`);
    else for (const lang of ['ko', 'en', 'de']) {
      if (a[lang] !== invServer[id][lang]) {
        problems.push(`${id}: 인보이스 라벨 불일치(${lang}) admin="${a[lang]}" ≠ server="${invServer[id][lang]}"`);
      }
    }
  }
}

// 구 등급 명칭이 남아있는지(리네이밍 누락 탐지)
const STALE = /기본 10×15|기본 A4|프리미엄 10×15|프리미엄 A4|프리미엄 A3/;
for (const [label, src] of [['Code.gs', gs], ['AdminV2.html', adminSrc]]) {
  if (STALE.test(src)) problems.push(`${label}: 구 등급 명칭(기본/프리미엄)이 남아 있습니다 — 리네이밍 누락 가능`);
}

const count = (o) => Object.keys(o).length;
console.log(`정의처 파싱: server=${count(server)} admin=${count(admin)} v1=${count(v1)} v2=${count(v2)} catalog=${count(catalog)} invServer=${count(invServer)} invAdmin=${count(invAdmin)} tier=${tierIds.length}`);

if (problems.length) {
  console.error(`\n❌ 인화 SKU 드리프트 ${problems.length}건\n`);
  problems.forEach((p) => console.error('  - ' + p));
  console.error('\n하나만 고치면 화면가와 청구가가 어긋납니다. 위 정의처를 모두 맞춘 뒤 배포하세요.');
  process.exit(1);
}
console.log(`\n✅ 인화 SKU ${skus.length}종이 6개 정의처에서 모두 일치합니다.`);
