#!/usr/bin/env node
/**
 * 셀렉 포함 인화 — 쿼터 테이블 정합 + 미리 채우기(seedIncludedPrints) 검증.
 *
 * 배경: 포함 쿼터가 '할인 근거'로만 쓰이고 주문 행으로 변환되지 않아, 고객이 손으로 넣지
 * 않으면 포함분이 통째로 소실됐다(스튜디오 Basic 세션에서 A4 1장만 넘어온 사고).
 * 프런트(product-delivery.js)와 백엔드(Code.gs) 쿼터가 어긋나면 화면과 청구가 갈라지므로
 * 그 정합을 먼저 보고, 그 다음 채우기 로직을 본다.
 *
 * new Function 입력은 이 저장소의 소스뿐이다(외부 입력 없음) — 다른 check-*.mjs 와 같은 로컬 하네스.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getProductIncludedPrintQuota, PRODUCT_DELIVERY_SPECS } from '../frontend/shared/product-delivery.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gs = fs.readFileSync(path.join(root, 'appscript/Code.gs'), 'utf8');
const selectSrc = fs.readFileSync(path.join(root, 'frontend/select/v2/select.js'), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};
const fmt = (list) => (list || []).map((q) => `${q.id}×${q.qty}`).join(' + ') || '(없음)';

/* select.js 의 getSessionIncludedPrintQuota 와 같은 필터 기준 — PRINT_OPTIONS 에 없는 id 는
   주문 SKU 가 아니라 버려진다(여권의 passport_country 가 그런 케이스). */
const PRINT_OPTION_IDS = new Set(
  [...selectSrc.match(/const PRINT_OPTIONS = \[([\s\S]*?)\n\];/)[1]
    .matchAll(/id:\s*(?:'([a-z0-9_]+)'|PRINT_NONE_ID)/g)]
    .map((m) => m[1] || 'print_none')
);
const sessionQuota = (productId) => getProductIncludedPrintQuota({ id: productId })
  .filter((q) => PRINT_OPTION_IDS.has(q.id) && Number(q.qty) > 0);

// ── 1. 프런트 ↔ 백엔드 쿼터 정합 ──────────────────────────────────────────
console.log('\n── 쿼터 테이블 정합 (프런트 ↔ Code.gs) ──');
const beBlock = gs.match(/const SELECT_INCLUDED_PRINT_QUOTA_BY_PRODUCT_=\{([\s\S]*?)\n\};/)[1];
const backend = {};
for (const line of beBlock.split('\n')) {
  const m = line.match(/^\s*([a-z0-9]+):\[(.*?)\],?\s*(?:\/\/.*)?$/);
  if (!m) continue;
  backend[m[1]] = [...m[2].matchAll(/id:'([a-z0-9_]+)',qty:(\d+)/g)]
    .map((x) => ({ id: x[1], qty: Number(x[2]) }));
}

for (const id of Object.keys(backend)) {
  const spec = PRODUCT_DELIVERY_SPECS.find((s) => s.id === id);
  if (!spec) { t(`${id} 프런트 스펙 존재`, false, '백엔드에만 있음'); continue; }
  const fe = getProductIncludedPrintQuota({ id });
  const be = backend[id];
  t(`${id.padEnd(5)} ${fmt(be)}`, JSON.stringify(fe) === JSON.stringify(be), `프런트=${fmt(fe)}`);
}

console.log('\n── 쿼터 id 가 실제 주문 SKU 인가 ──');
// PRINT_OPTIONS 에 없는 id 를 쿼터에 넣으면 화면에서 조용히 사라지고 미리 채우기도 건너뛴다
for (const [id, quota] of Object.entries(backend)) {
  const bad = quota.filter((q) => !PRINT_OPTION_IDS.has(q.id));
  if (quota.length) t(`${id.padEnd(5)} 전 항목이 선택 가능한 SKU`, bad.length === 0, fmt(bad));
}

console.log('\n── 사장님 확정값 (2026-08-07) ──');
t('야외 Plus = 10×15 ×7', JSON.stringify(backend.op) === JSON.stringify([{ id: 'basic_10x15', qty: 7 }]), fmt(backend.op));
t('야외 Premium = 10×15 ×10', JSON.stringify(backend.oprm) === JSON.stringify([{ id: 'basic_10x15', qty: 10 }]), fmt(backend.oprm));
t('야외 Basic 은 그대로 ×5', JSON.stringify(backend.ob) === JSON.stringify([{ id: 'basic_10x15', qty: 5 }]), fmt(backend.ob));

// ── 2. seedIncludedPrints 동작 ────────────────────────────────────────────
console.log('\n── 미리 채우기 (seedIncludedPrints) ──');
const fnSrc = (() => {
  const start = selectSrc.indexOf('function seedIncludedPrints()');
  if (start < 0) throw new Error('seedIncludedPrints 를 찾지 못했습니다');
  let i = selectSrc.indexOf('{', start), depth = 0;
  for (; i < selectSrc.length; i++) {
    if (selectSrc[i] === '{') depth++;
    else if (selectSrc[i] === '}' && --depth === 0) return selectSrc.slice(start, i + 1);
  }
  throw new Error('중괄호 불균형');
})();

function runSeed({ productId, photos, editMode = false, prints = [], hasOutput = true, seeded = false }) {
  const state = { editMode, prints: [...prints], printsSeeded: seeded, photos };
  const seed = new Function(
    'state', 'sessionHasIncludedDeliveryOutput', 'getSessionIncludedPrintQuota',
    `${fnSrc}; return seedIncludedPrints;`
  )(state, () => hasOutput, () => sessionQuota(productId));
  seed();
  return state;
}
const photosOf = (n) => Array.from({ length: n }, (_, i) => ({ num: `IMG_${1000 + i}` }));

{
  // 사고 재현 대상: 스튜디오 Basic — A4 1장 + 10×15 2장, 보정 3장
  const s = runSeed({ productId: 'sb', photos: photosOf(3) });
  t('sb 3행 생성', s.prints.length === 3, JSON.stringify(s.prints));
  t('sb 구성 = A4 1 + 10×15 2',
    s.prints.map((p) => p.printId).join(',') === 'basic_a4,basic_10x15,basic_10x15');
  t('sb 보정본 번호가 순서대로 배정',
    s.prints.map((p) => p.photoNum).join(',') === 'IMG_1000,IMG_1001,IMG_1002');
  t('sb 각 행 1장·여백없음', s.prints.every((p) => p.qty === 1 && p.finish === 'full'));
}
{
  const s = runSeed({ productId: 'op', photos: photosOf(10) });
  t('야외 Plus 7행 전부 10×15',
    s.prints.length === 7 && s.prints.every((p) => p.printId === 'basic_10x15'), `${s.prints.length}행`);
  t('야외 Plus 보정 10장 중 앞 7장 배정',
    s.prints.at(-1).photoNum === 'IMG_1006');
}
{
  const s = runSeed({ productId: 'oprm', photos: photosOf(20) });
  t('야외 Premium 10행', s.prints.length === 10, `${s.prints.length}행`);
}
{
  // 보정본이 쿼터보다 적으면 나머지는 빈칸 — 고객이 고르게 둔다(임의 배정 금지)
  const s = runSeed({ productId: 'oprm', photos: photosOf(3) });
  t('보정본 부족분은 빈 photoNum',
    s.prints.length === 10 && s.prints.filter((p) => p.photoNum).length === 3,
    JSON.stringify(s.prints.map((p) => p.photoNum)));
}
{
  const s = runSeed({ productId: 'wp', photos: photosOf(30) });
  t('프리웨딩 Plus = A3 1 + A4 2 + 10×15 3 (6행)',
    s.prints.map((p) => p.printId).join(',') === 'premium_a3,basic_a4,basic_a4,basic_10x15,basic_10x15,basic_10x15',
    JSON.stringify(s.prints.map((p) => p.printId)));
}

console.log('\n  — 안 채워야 하는 경우 —');
{
  t('수정 모드는 건드리지 않음',
    runSeed({ productId: 'sb', photos: photosOf(3), editMode: true }).prints.length === 0);
  t('이미 행이 있으면 추가 안 함',
    runSeed({ productId: 'sb', photos: photosOf(3), prints: [{ photoNum: 'X', printId: 'basic_a4', qty: 1 }] }).prints.length === 1);
  t('MRT·디지털 전용(실물 없음)은 안 채움',
    runSeed({ productId: 'sb', photos: photosOf(3), hasOutput: false }).prints.length === 0);
  // 여권은 프런트 스펙에 passport_country×1 이 있지만 주문 SKU 가 아니라 걸러진다
  t('여권(주문 SKU 아닌 쿼터)은 안 채움',
    runSeed({ productId: 'pass', photos: photosOf(3) }).prints.length === 0);
  const twice = runSeed({ productId: 'sb', photos: photosOf(3) });
  t('한 세션에 한 번만 (재진입해도 중복 없음)', twice.printsSeeded === true && twice.prints.length === 3);
}
{
  // 고객이 지운 행이 되살아나면 안 된다 — 플래그가 이미 서 있으면 재진입해도 그대로
  const s = runSeed({ productId: 'sb', photos: photosOf(3), seeded: true });
  t('고객이 전부 지운 뒤 재진입해도 다시 안 채움', s.prints.length === 0);
}

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
