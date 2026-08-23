#!/usr/bin/env node
/**
 * check-select-amounts.mjs — 셀렉 인화 청구액 서버↔클라이언트 차등 검증기
 *
 * 왜 필요한가: 고객이 셀렉 화면에서 보는 금액(클라이언트 computePrintAnnotations)과
 * 실제로 청구되는 금액(서버 computeSelectDecoupledPrints_)은 **서로 다른 파일의 서로 다른 구현**이다.
 * 쿼터 차액 과금 / 2-pass 배정 / 포토카드 제외 / 서비스컷 크레딧을 양쪽에 각각 이식했고,
 * 한쪽만 고치면 "화면엔 €0인데 인보이스는 €7" 같은 고객 분쟁이 그대로 발생한다.
 *
 * 어떻게: 두 함수의 **실제 소스 텍스트를 파일에서 그대로 떼어내** 임시 모듈로 만들어 실행하고 총액을 대조한다.
 * (재구현이 아니라 원본 실행이므로, 한쪽만 수정하면 여기서 즉시 깨진다.)
 * 가격표·포함 쿼터표도 각 파일에서 따로 파싱하므로 단가 드리프트도 함께 잡힌다.
 *
 * 사용법:  node scripts/check-select-amounts.mjs        (불일치 시 exit 1)
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* ── 소스에서 함수 본문을 중괄호 매칭으로 그대로 잘라낸다 ───────────────── */
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} 을 찾지 못했습니다 — 함수명이 바뀌었을 수 있습니다.`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    const c = src[i];
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`${name} 의 본문 끝을 찾지 못했습니다.`);
}
function extractConst(src, decl, closer) {
  const start = src.indexOf(decl);
  if (start < 0) throw new Error(`${decl} 을 찾지 못했습니다.`);
  const end = src.indexOf(closer, start);
  if (end < 0) throw new Error(`${decl} 의 끝(${closer})을 찾지 못했습니다.`);
  return src.slice(start, end + closer.length);
}
function parseQuotaTable(src) {
  const body = extractConst(src, 'const SELECT_INCLUDED_PRINT_QUOTA_BY_PRODUCT_=', '};');
  const out = {};
  for (const m of body.matchAll(/(\w+):\[([^\]]*)\]/g)) {
    out[m[1]] = [...m[2].matchAll(/id:'([a-z0-9_]+)',qty:(\d+)/g)].map((q) => ({ id: q[1], qty: +q[2] }));
  }
  if (!Object.keys(out).length) throw new Error('포함 쿼터표를 파싱하지 못했습니다.');
  return out;
}

const gs = read('appscript/Code.gs');
const v2 = read('frontend/select/v2/select.js');

/* ── 서버 구현 모듈 (Code.gs 원본 조각) ────────────────────────────────── */
const SERVER_MODULE = [
  extractConst(gs, 'const PRINT_LABELS=', '};'),
  extractConst(gs, 'const SELECT_INCLUDED_PRINT_QUOTA_BY_PRODUCT_=', '};'),
  extractFn(gs, 'roundCurrency_'),
  extractFn(gs, 'getPrintInfo_'),
  extractFn(gs, 'selectQuotaCredit_'),
  extractFn(gs, 'selectPhotoNumKey_'),
  extractFn(gs, 'mergeSelectPrintItems_'),
  extractFn(gs, 'getDefaultSelectMarketingBonusCount_'),
  extractFn(gs, 'normalizeSelectMarketingBonusCount_'),
  extractFn(gs, 'computeSelectDecoupledPrints_'),
  // 하네스가 채우는 부분: 상품키는 fixture 가 직접 주고, 쿼터는 위 실제 표에서 읽는다.
  `const SELECT_COL={'촬영종류':0,'상품':1,'서비스컷수':2};`,
  `function getSelectIncludedPrintQuota_(key){
  const q=SELECT_INCLUDED_PRINT_QUOTA_BY_PRODUCT_[key];
  return q?q.map(function(i){return{id:i.id,qty:parseInt(i.qty,10)||0};}):null;
}`,
  `export function run(fx){
  const row=[fx.productKey,'(상품)',fx.serviceCutCount];
  const retouchSet={};
  (fx.retouchNums||[]).forEach(function(n){retouchSet[selectPhotoNumKey_(n)]=true;});
  return computeSelectDecoupledPrints_(fx.prints,row,retouchSet,fx.serviceNums||[]);
}`
].join('\n\n');

/* ── 클라이언트 구현 모듈 (select.js 원본 조각) ────────────────────────── */
const CLIENT_MODULE = [
  `const PRINT_NONE_ID='print_none';`,
  extractConst(v2, 'const PRINT_OPTIONS = [', '];'),
  `const QUOTA_TABLE=${JSON.stringify(parseQuotaTable(gs))};`,
  `function stripExt(s){return String(s||'').replace(/\\.[a-z0-9]+$/i,'');}`,
  extractFn(v2, 'normalizePrintTypeId'),
  extractFn(v2, 'getPrintOption'),
  extractFn(v2, 'printNumKey'),
  extractFn(v2, 'isRetouchedPhotoNum'),
  extractFn(v2, 'getServiceCutCount'),
  extractFn(v2, 'getQuotaCreditValue'),
  extractFn(v2, 'computePrintAnnotations'),
  `let state={photos:[],prints:[],session:{},lang:'ko'};`,
  // 실제 getSessionIncludedPrintQuota 의 필터 규칙(유효 SKU + qty>0)을 그대로 재현
  `function getSessionIncludedPrintQuota(){
  const valid=new Set(PRINT_OPTIONS.map(function(o){return o.id;}));
  return (QUOTA_TABLE[state.session.productKey]||[])
    .filter(function(i){return valid.has(i.id)&&Number(i.qty)>0;})
    .map(function(i){return{id:i.id,qty:Number(i.qty)||0};});
}`,
  `export function run(fx){
  state={
    lang:'ko',
    session:{productKey:fx.productKey,serviceCutCount:fx.serviceCutCount},
    // 보정 리스트: 보정 대상 번호(서비스컷도 보정 리스트에 들어간다)
    photos:(fx.retouchNums||[]).map(function(n){
      return {num:n,isService:(fx.serviceNums||[]).indexOf(n)>=0,isBonus:false};
    }),
    prints:fx.prints
  };
  const ann=computePrintAnnotations();
  return {amount:ann.reduce(function(s,a){return s+a.amount;},0),ann:ann};
}`
].join('\n\n');

const dir = mkdtempSync(join(tmpdir(), 'select-amounts-'));
let runServer;
let runClient;
try {
  writeFileSync(join(dir, 'server.mjs'), SERVER_MODULE);
  writeFileSync(join(dir, 'client.mjs'), CLIENT_MODULE);
  ({ run: runServer } = await import(pathToFileURL(join(dir, 'server.mjs')).href));
  ({ run: runClient } = await import(pathToFileURL(join(dir, 'client.mjs')).href));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

/* ── 시나리오 ──────────────────────────────────────────────────────────── */
const SKUS = ['basic_10x15', 'premium_10x15', 'basic_a4', 'premium_a4', 'premium_a3', 'premium_a3plus', 'photocard_single', 'photocard_double', 'print_none'];
const PRODUCTS = ['pb', 'pp', 'sb', 'sp', 'sprm', 'ob', 'op', 'wp', 'amtp'];

// 재현 가능한 의사난수(LCG) — 실패 케이스를 그대로 다시 돌릴 수 있어야 한다.
let seed = 20260727;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

function makeFixture(i) {
  const productKey = PRODUCTS[i % PRODUCTS.length];
  const retouchNums = Array.from({ length: 1 + Math.floor(rnd() * 5) }, (_, k) => `A${k + 1}`);
  const serviceCutCount = Math.floor(rnd() * 3);
  /* 서비스로 **표시된** 번호 수는 서비스컷수와 독립적으로 뽑는다.
     둘을 같게 맞추면 서버의 serviceCreditsRemaining 상한을 한 번도 밟지 못해,
     상한이 통째로 사라져도 검증기가 통과해 버린다(실측으로 확인한 커버리지 구멍). */
  const serviceNums = retouchNums.slice(0, Math.floor(rnd() * (retouchNums.length + 1)));
  const prints = Array.from({ length: Math.floor(rnd() * 6) }, () => ({
    // 출력 대상은 보정본(A#)일 수도, 원본(B#)일 수도 있다
    photoNum: rnd() < 0.6 ? pick(retouchNums) : `B${1 + Math.floor(rnd() * 3)}`,
    printId: pick(SKUS),
    qty: 1 + Math.floor(rnd() * 3),
    finish: rnd() < 0.5 ? 'border' : 'full'
  }));
  return { productKey, retouchNums, serviceCutCount, serviceNums, prints };
}

/* 손으로 고른 회귀 케이스 — 과거 실제로 깨졌던 조합을 고정해 둔다. */
const REGRESSIONS = [
  { name: '순서의존(파인아트10×15 먼저)', productKey: 'sb', retouchNums: ['A1', 'A2'], serviceCutCount: 0, serviceNums: [],
    prints: [{ photoNum: 'A1', printId: 'premium_10x15', qty: 1 }, { photoNum: 'A2', printId: 'basic_a4', qty: 1 }] },
  { name: '순서의존(시그니처A4 먼저)', productKey: 'sb', retouchNums: ['A1', 'A2'], serviceCutCount: 0, serviceNums: [],
    prints: [{ photoNum: 'A2', printId: 'basic_a4', qty: 1 }, { photoNum: 'A1', printId: 'premium_10x15', qty: 1 }] },
  { name: '포토카드는 쿼터 미소진', productKey: 'sb', retouchNums: ['A1'], serviceCutCount: 0, serviceNums: [],
    prints: [{ photoNum: 'A1', printId: 'photocard_double', qty: 2 }, { photoNum: 'A1', printId: 'basic_a4', qty: 1 }] },
  { name: '서비스컷 + 쿼터차액 중복', productKey: 'sb', retouchNums: ['A1', 'A2'], serviceCutCount: 2, serviceNums: ['A1', 'A2'],
    prints: [{ photoNum: 'A1', printId: 'premium_10x15', qty: 1 }] },
  { name: '쿼터 없는 상품(op)', productKey: 'op', retouchNums: ['A1'], serviceCutCount: 0, serviceNums: [],
    prints: [{ photoNum: 'A1', printId: 'basic_a4', qty: 2 }] },
  { name: '출력없음 행이 섞인 경우', productKey: 'sb', retouchNums: ['A1'], serviceCutCount: 0, serviceNums: [],
    prints: [{ photoNum: 'A1', printId: 'print_none', qty: 1 }, { photoNum: 'A1', printId: 'basic_a4', qty: 1 }] },
  { name: '출력없음이 쿼터를 삼키는지', productKey: 'sp', retouchNums: ['A1'], serviceCutCount: 0, serviceNums: [],
    prints: [{ photoNum: 'A1', printId: 'print_none', qty: 3 }] },
  { name: '수량 다중 + 쿼터 초과', productKey: 'pp', retouchNums: ['A1'], serviceCutCount: 0, serviceNums: [],
    prints: [{ photoNum: 'A1', printId: 'basic_10x15', qty: 5 }] },
  { name: '원본(보정 아님) 인화만', productKey: 'sb', retouchNums: ['A1'], serviceCutCount: 0, serviceNums: [],
    prints: [{ photoNum: 'B9', printId: 'premium_a4', qty: 1 }] },
  // 서비스로 표시된 번호가 서비스컷수를 초과 — 서버 상한(serviceCreditsRemaining)이 실제로 걸리는 경계
  { name: '서비스 표시 초과(2표시/1허용)', productKey: 'op', retouchNums: ['A1', 'A2'], serviceCutCount: 1, serviceNums: ['A1', 'A2'],
    prints: [{ photoNum: 'A1', printId: 'basic_10x15', qty: 1 }, { photoNum: 'A2', printId: 'basic_10x15', qty: 1 }] },
  { name: '서비스 표시 초과(3표시/0허용)', productKey: 'op', retouchNums: ['A1', 'A2', 'A3'], serviceCutCount: 0, serviceNums: ['A1', 'A2', 'A3'],
    prints: [{ photoNum: 'A1', printId: 'premium_a4', qty: 2 }, { photoNum: 'A3', printId: 'basic_10x15', qty: 1 }] }
];

const RANDOM_N = 4000;
const fixtures = [
  ...REGRESSIONS,
  ...Array.from({ length: RANDOM_N }, (_, i) => ({ name: `random#${i}`, ...makeFixture(i) }))
];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const groupKey = (photoNum, printId) => `${String(photoNum || '-')}|${String(printId || '').replace(/_(r|e)$/, '')}`;

const fails = [];
for (const fx of fixtures) {
  let s;
  let c;
  try { s = runServer(fx); } catch (e) { fails.push({ fx, msg: `서버 실행 오류: ${e.message}` }); continue; }
  try { c = runClient(fx); } catch (e) { fails.push({ fx, msg: `클라이언트 실행 오류: ${e.message}` }); continue; }

  // ① 총액
  if (r2(s.amount) !== r2(c.amount)) {
    fails.push({ fx, msg: `총액 불일치 — 서버 €${r2(s.amount)} ≠ 화면 €${r2(c.amount)}` });
    continue;
  }
  /* ② 사진·SKU 단위 금액 — 총액만 보면 한 행을 더 받고 다른 행을 덜 받는 상쇄 오류를 놓친다.
        고객은 행별 금액을 보고 따지므로 여기까지 같아야 한다. */
  const sByKey = {};
  (s.items || []).forEach((it) => {
    const k = groupKey(it.photoNum, it.printId);
    sByKey[k] = r2((sByKey[k] || 0) + (Number(it.price) || 0) * (Number(it.qty) || 1));
  });
  const cByKey = {};
  c.ann.forEach((a, i) => {
    const p = fx.prints[i];
    const k = groupKey(p.photoNum, p.printId);
    cByKey[k] = r2((cByKey[k] || 0) + (Number(a.amount) || 0));
  });
  const keys = new Set([...Object.keys(sByKey), ...Object.keys(cByKey)]);
  for (const k of keys) {
    const sv = r2(sByKey[k] || 0);
    const cv = r2(cByKey[k] || 0);
    if (sv !== cv) { fails.push({ fx, msg: `행 금액 불일치 [${k}] — 서버 €${sv} ≠ 화면 €${cv}` }); break; }
  }
  /* ③ '출력 없음' 행은 포함 쿼터를 소진해서는 안 된다.
        서버는 print_none 을 아예 건너뛴다. 클라이언트가 단가 0 유닛으로 쿼터를 집어가면
        지금은 금액이 0이라 총액엔 안 드러나지만, 남은 포함 인화 표시가 서버와 어긋나게 된다. */
  c.ann.forEach((a, i) => {
    if (String(fx.prints[i].printId).replace(/_(r|e)$/, '') !== 'print_none') return;
    if (a.includedQty > 0) fails.push({ fx, msg: `'출력 없음' 행이 포함 쿼터 ${a.includedQty}장을 소진했습니다(서버는 0)` });
  });
}

console.log(`대조 완료: 회귀 고정 ${REGRESSIONS.length}건 + 무작위 ${RANDOM_N}건 = ${fixtures.length}건`);

if (fails.length) {
  console.error(`\n❌ 서버↔화면 청구액 불일치 ${fails.length}건 (상위 10건)\n`);
  fails.slice(0, 10).forEach((f) => {
    console.error(`  - [${f.fx.name}] ${f.msg}`);
    console.error(`    상품=${f.fx.productKey} 서비스컷=${f.fx.serviceCutCount}(${(f.fx.serviceNums || []).join(',') || '-'}) 보정=${(f.fx.retouchNums || []).join(',')}`);
    (f.fx.prints || []).forEach((p) => console.error(`      · ${p.photoNum} ${p.printId} ×${p.qty}`));
  });
  console.error('\n고객 화면 금액과 실제 청구액이 다릅니다. 배포하면 그대로 분쟁이 됩니다.');
  process.exit(1);
}
console.log('\n✅ 모든 시나리오에서 화면 표시 금액 = 서버 청구액.');
