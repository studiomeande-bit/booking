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
  /* 서비스컷·보너스 번호 빌더 — 하네스가 직접 배열을 만들면 실제 호출부(priceSelectPrints_)의
     규칙(보너스에서 isService 를 뺀다)을 재현하지 못해 없는 불일치가 생긴다. 원본을 그대로 쓴다. */
  extractFn(gs, 'selectOrderHasFrame_'),
  extractFn(gs, 'selectPrintCreditExempt_'),
  extractFn(gs, 'buildSelectServiceCutNums_'),
  extractFn(gs, 'buildSelectMarketingBonusNums_'),
  /* 마케팅 보너스 크레딧 의존성 — 2026-08-07 에 computeSelectDecoupledPrints_ 안으로 들어왔는데
     이 하네스에 이식되지 않아, 서버 모듈이 통째로 ReferenceError 로 죽고 4011건 전부
     '불일치'로 찍히고 있었다(2026-09-09 발견). 검증기가 조용히 무의미해지는 전형적 실패다. */
  extractFn(gs, 'getDefaultSelectMarketingBonusCount_'),
  extractFn(gs, 'normalizeSelectMarketingBonusCount_'),
  extractFn(gs, 'computeSelectDecoupledPrints_'),
  // 하네스가 채우는 부분: 상품키는 fixture 가 직접 주고, 쿼터는 위 실제 표에서 읽는다.
  `const SELECT_COL={'촬영종류':0,'상품':1,'서비스컷수':2,'마케팅보너스수':3};`,
  `function getSelectIncludedPrintQuota_(key){
  const q=SELECT_INCLUDED_PRINT_QUOTA_BY_PRODUCT_[key];
  return q?q.map(function(i){return{id:i.id,qty:parseInt(i.qty,10)||0};}):null;
}`,
  /* 실제 제출 경로(priceSelectPrints_ Code.gs:25217~)와 같은 순서로 호출한다 —
     photos[] 하나에서 serviceNums·bonusNums 를 원본 빌더로 뽑고, 미동의면 보너스를 비운다. */
  /* 볼륨 할인 — submitPhotoSelection 이 computeSelectDecoupledPrints_ **뒤에** 거는 단계라
     이 하네스가 원래 덮지 않던 구멍이었다. 액자를 할인 대상에서 빼는 수정이 여기 없이 통과했다(2026-09-09). */
  extractConst(gs, 'const SELECT_VOLUME_TIER_DEFAULTS_=', '};'),
  extractFn(gs, 'getSelectVolumeTiers_'),
  extractFn(gs, 'computeSelectVolumeDiscount_'),
  `function getSettingsMap_(){return {};}`,
  `export function run(fx){
  const row=[fx.itemGroup||fx.productKey,'(상품)',fx.serviceCutCount,fx.marketingBonusCount];
  const retouchSet={};
  (fx.retouchNums||[]).forEach(function(n){retouchSet[selectPhotoNumKey_(n)]=true;});
  const photos=fx.photos||[];
  const serviceNums=buildSelectServiceCutNums_(photos);
  const bonusNums=fx.marketing==='Y'?buildSelectMarketingBonusNums_(photos):[];
  const pc=computeSelectDecoupledPrints_(fx.prints,row,retouchSet,serviceNums,bonusNums);
  // submitPhotoSelection(Code.gs:27383~) 과 같은 순서·같은 필터로 볼륨 할인을 건다.
  const volItems=(pc.items||[]).filter(function(p){return !selectOrderHasFrame_([p]);});
  const units=volItems.reduce(function(s,p){return s+((Number(p.price)||0)>0?Math.max(1,parseInt(p.qty,10)||1):0);},0);
  const base=volItems.reduce(function(s,p){return s+(Number(p.price)||0)*Math.max(1,parseInt(p.qty,10)||1);},0);
  const vd=computeSelectVolumeDiscount_('print',units,roundCurrency_(base));
  return Object.assign({},pc,{volUnits:units,volDiscount:vd.discount,volPercent:vd.percent,
    netAmount:roundCurrency_(Number(pc.amount||0)-Number(vd.discount||0))});
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
  extractFn(v2, 'isReprintSession'),
  extractFn(v2, 'printCreditExempt'),
  extractConst(v2, 'const VOLUME_TIER_DEFAULTS = {', '};'),
  extractFn(v2, 'getVolumeTiers'),
  extractFn(v2, 'computeVolumeDiscount'),
  extractFn(v2, 'calcPrintDiscount'),
  extractFn(v2, 'getMarketingBonusCount'),
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
    marketing:fx.marketing,
    session:{productKey:fx.productKey,itemGroup:fx.itemGroup||'',serviceCutCount:fx.serviceCutCount,marketingBonusCount:fx.marketingBonusCount},
    // 보정 리스트: 보정 대상 번호(서비스컷도 보정 리스트에 들어간다)
    photos:fx.photos||[],
    prints:fx.prints
  };
  const ann=computePrintAnnotations();
  const pd=calcPrintDiscount(ann);
  const amount=ann.reduce(function(s,a){return s+a.amount;},0);
  return {amount:amount,ann:ann,volUnits:pd.units,volDiscount:pd.vd.discount,volPercent:pd.vd.percent,
    netAmount:Math.round((amount-pd.vd.discount)*100)/100};
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
const SKUS = ['wallart_custom', 'basic_10x15', 'premium_10x15', 'basic_a4', 'premium_a4', 'premium_a3', 'premium_a3plus', 'photocard_single', 'photocard_double', 'frame_a4', 'frame_a3', 'print_none'];
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
  /* 마케팅 보너스 축도 흔든다 — 동의 여부·보너스 상한·보너스로 표시된 번호를 각각 독립으로 뽑아야
     '상한 캡'과 '서비스컷과 겹치지 않게 빼기' 두 규칙이 실제로 밟힌다. */
  const marketing = rnd() < 0.5 ? 'Y' : 'N';
  const marketingBonusCount = Math.floor(rnd() * 4);
  const bonusNums = retouchNums.slice(0, Math.floor(rnd() * (retouchNums.length + 1)));
  const prints = Array.from({ length: Math.floor(rnd() * 6) }, () => ({
    // 출력 대상은 보정본(A#)일 수도, 원본(B#)일 수도 있다
    photoNum: rnd() < 0.6 ? pick(retouchNums) : `B${1 + Math.floor(rnd() * 3)}`,
    printId: pick(SKUS),
    qty: 1 + Math.floor(rnd() * 3),
    finish: rnd() < 0.5 ? 'border' : 'full'
  }));
  const photos = retouchNums.map((n) => ({
    num: n, isService: serviceNums.indexOf(n) >= 0, isBonus: bonusNums.indexOf(n) >= 0
  }));
  return { productKey, retouchNums, serviceCutCount, serviceNums, marketing, marketingBonusCount, bonusNums, photos, prints };
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

/* 액자 회귀(2026-09-09 도입) — 액자는 ①포함 쿼터를 소진·상쇄하지 않고 ②서비스컷·보너스
   크레딧도 받지 않는다. 세 규칙 중 하나만 한쪽에 빠져도 여기서 깨진다. */
REGRESSIONS.push(
  // sb 쿼터=basic_a4×1+basic_10x15×2. 파인아트A3 보정본 32 − 최대크레딧(basic_a4 보정 10) = 22, 액자 35 는 그대로 → 57
  { name: '액자는 쿼터를 삼키지 않는다', productKey: 'sb', retouchNums: ['A1'], serviceCutCount: 0, serviceNums: [],
    expectTotal: 57,
    prints: [{ photoNum: 'A1', printId: 'frame_a3', qty: 1 }, { photoNum: 'A1', printId: 'premium_a3', qty: 1 }] },
  // 서비스컷이 있어도 액자에는 €3 이 붙지 않는다 → 29 그대로
  { name: '액자는 서비스컷 크레딧을 받지 않는다', productKey: 'sb', retouchNums: ['A1'], serviceCutCount: 1, serviceNums: ['A1'],
    expectTotal: 29,
    prints: [{ photoNum: 'A1', printId: 'frame_a4', qty: 1 }] },
  // op 쿼터 넉넉 → 10×15 는 무료로 흡수. 액자가 쿼터를 먹었다면 35-3=32 가 됐을 것 → 35 여야 한다
  { name: '액자는 보너스 크레딧도 받지 않는다', productKey: 'op', retouchNums: ['A1'], serviceCutCount: 0, serviceNums: [],
    marketing: 'Y', marketingBonusCount: 2, bonusNums: ['A1'], expectTotal: 35,
    prints: [{ photoNum: 'A1', printId: 'frame_a3', qty: 1 }, { photoNum: 'A1', printId: 'basic_10x15', qty: 1 }] }
);

/* 볼륨 할인 회귀 — pb 쿼터=basic_10x15×1. 파인아트A4 보정본 15 × 12장 중 한 장이 쿼터 크레딧 3 을 받아 12,
   나머지 11장 15 = 177. 액자 35 는 할인 대상 밖 → 총 212, 할인 12장 **15%**(구간 10:15) × 177 = 26,55, net 185,45.
   (액자가 할인에 끼면 13장·base 212 → -31,80 → net 180,20 이 된다 — 이 두 값이 갈리는지 보는 케이스다)
   ⚠ 기대치가 구간표에 묶여 있다. 구간을 바꾸면 여기도 같이 고쳐야 한다(2026-09-10 인화 구간 10→5 로 하향). */
REGRESSIONS.push({
  name: '액자는 볼륨 할인 대상이 아니다', productKey: 'pb', retouchNums: ['A1'], serviceCutCount: 0, serviceNums: [],
  expectTotal: 212, expectNet: 185.45, expectVolUnits: 12,
  prints: [{ photoNum: 'A1', printId: 'premium_a4', qty: 12 }, { photoNum: 'A1', printId: 'frame_a3', qty: 1 }]
});

/* 재주문(reprint) 회귀 — 보정 리스트가 비어 있어도 **보정본가**여야 한다.
   원본가로 새면 파인아트 A4 가 15 대신 20 이 되어 장당 €5 과다청구다.
   itemGroup 'reprint' 는 쿼터표에 없으므로 포함 쿼터도 0 이다. */
REGRESSIONS.push({
  name: '재주문은 보정 리스트가 비어도 보정본가', productKey: 'reprint', itemGroup: 'reprint',
  retouchNums: [], serviceCutCount: 0, serviceNums: [], expectTotal: 30, expectVolUnits: 2, expectNet: 30,
  prints: [{ photoNum: 'B1', printId: 'premium_a4', qty: 2 }]
});

/* 쿼터 업그레이드(차액) 장도 볼륨 할인 '장수' 에 들어간다는 규칙을 고정한다(사장님 확인 2026-09-10).
   sb 쿼터 = basic_a4×1 + basic_10x15×2. 파인아트A4 보정본 15 × 5장:
     1장은 basic_a4 크레딧 10 → 5 · 2장은 basic_10x15 크레딧 3 → 12 씩 · 나머지 2장은 정가 15
     = 5+12+12+15+15 = 59, 유료 장수 5(전부 price>0 이라 차액장도 센다).
   기준을 'price>0' 이 아니라 '정확일치 무료가 아닌 장' 같은 걸로 바꾸면 여기서 깨진다. */
REGRESSIONS.push({
  name: '쿼터 업그레이드 차액장도 볼륨 장수에 든다', productKey: 'sb', retouchNums: ['A1'],
  // 구간 하향(5:10) 이후 이 주문이 실제로 할인을 받는다 — 59 × 10% = 5,90 → net 53,10.
  serviceCutCount: 0, serviceNums: [], expectTotal: 59, expectVolUnits: 5, expectNet: 53.1,
  prints: [{ photoNum: 'A1', printId: 'premium_a4', qty: 5 }]
});

/* 견적형(wallart_custom)·액자는 **포함 쿼터 배정 자체에 들어가면 안 된다** (Phase 0, 2026-09-10).
   ⚠ 금액으로는 구별되지 않는다 — 쿼터 2-pass 가 단가 내림차순이라 0원 항목은 늘 마지막이고,
   슬롯을 먹어도 총액은 그대로다. 실제 피해는 **분류**다: matched 가 되면 그 줄이
   'included_print'(무료·기본 제공)로 작업지시서와 화면에 찍힌다 — 견적 대기 항목이 무료로 보인다.
   그래서 아래 expectNoIncluded 로 '포함 목록에 들어오지 않는다' 를 직접 본다. */
REGRESSIONS.push({
  name: '견적형은 포함 쿼터 배정에 끼지 않는다', productKey: 'sprm', retouchNums: ['A1'],
  serviceCutCount: 0, serviceNums: [], expectNoIncluded: /^(wallart_|frame_)/,
  prints: [{ photoNum: 'A1', printId: 'wallart_custom', qty: 1 }, { photoNum: 'A1', printId: 'frame_a3', qty: 1 }]
});

/* A3+ 는 **픽업 전용이지만 볼륨 할인은 받는다** (2026-09-10).
   픽업 전용 목록(SELECT_PICKUP_ONLY_RE_)과 할인 제외 목록(selectOrderHasFrame_)을 하나로 합치면
   A3+ 가 조용히 할인에서 빠진다 — 총액만 보면 눈치채기 어렵다. 그래서 값으로 고정한다.
   pb 쿼터=basic_10x15×1. 파인아트A3+ 보정본 41 × 6장 중 한 장이 쿼터 크레딧 3 → 38,
   나머지 5장 41 = 205 → 총 243. 6장이면 5:10 구간이라 −10% = 24,30 → net 218,70. */
REGRESSIONS.push({
  name: 'A3+ 는 픽업 전용이어도 볼륨 할인을 받는다', productKey: 'pb', retouchNums: ['A1'],
  serviceCutCount: 0, serviceNums: [], expectTotal: 243, expectVolUnits: 6, expectNet: 218.7,
  prints: [{ photoNum: 'A1', printId: 'premium_a3plus', qty: 6 }]
});

const RANDOM_N = 4000;
/* 회귀 케이스는 photos 없이 손으로 적혀 있다 — photos 를 정본으로 쓰는 하네스에 맞춰 채워 준다.
   (마케팅 축이 없던 시절 케이스라 기본은 미동의: 보너스 크레딧 0) */
const withPhotos = (fx) => (fx.photos ? fx : {
  ...fx,
  marketing: fx.marketing || 'N',
  marketingBonusCount: fx.marketingBonusCount ?? 0,
  photos: (fx.retouchNums || []).map((n) => ({
    num: n,
    isService: (fx.serviceNums || []).indexOf(n) >= 0,
    isBonus: (fx.bonusNums || []).indexOf(n) >= 0
  }))
});
const fixtures = [
  ...REGRESSIONS.map(withPhotos),
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

  /* ⓪-a 견적형·액자는 '포함(무료)' 목록에 절대 들어오지 않는다 — 모든 픽스처에 거는 불변식.
        금액이 아니라 분류를 보는 유일한 검사다(금액으론 구별이 안 된다). */
  {
    const leaked = (s.includedItems || [])
      .map((it) => String(it.printId || '').replace(/_(r|e)$/, ''))
      .filter((id) => /^(wallart_|frame_)/.test(id));
    if (leaked.length) {
      fails.push({ fx, msg: `쿼터 밖 SKU 가 '포함(무료)' 으로 분류됨 — ${[...new Set(leaked)].join(', ')}` });
      continue;
    }
  }
  if (fx.expectNoIncluded && (s.includedItems || []).some((it) => fx.expectNoIncluded.test(String(it.printId || '')))) {
    fails.push({ fx, msg: `기대 위반 — ${fx.expectNoIncluded} 가 포함 목록에 있다` });
    continue;
  }

  /* ⓪ 기대 총액이 명시된 케이스는 값 자체가 맞는지 본다 — 서버와 화면이 똑같이 틀릴 수도 있다. */
  if (fx.expectTotal !== undefined && r2(s.amount) !== r2(fx.expectTotal)) {
    fails.push({ fx, msg: `기대 총액 불일치 — 서버 €${r2(s.amount)} ≠ 기대 €${r2(fx.expectTotal)}` });
    continue;
  }
  if (fx.expectNet !== undefined && (r2(s.netAmount) !== r2(fx.expectNet) || (fx.expectVolUnits !== undefined && s.volUnits !== fx.expectVolUnits))) {
    fails.push({ fx, msg: `기대 할인후 금액 불일치 — 서버 ${s.volUnits}장/net €${r2(s.netAmount)} ≠ 기대 ${fx.expectVolUnits}장/net €${r2(fx.expectNet)}` });
    continue;
  }
  /* ①-b 볼륨 할인 후 금액 — 고객이 실제로 내는 값. 할인 전 총액만 맞고 할인이 갈리면
        "화면 €90인데 청구 €95" 가 그대로 나간다(액자가 할인 대상에 끼어 있던 게 이 경로였다). */
  if (r2(s.netAmount) !== r2(c.netAmount) || s.volUnits !== c.volUnits || r2(s.volDiscount) !== r2(c.volDiscount)) {
    fails.push({ fx, msg: `볼륨 할인 불일치 — 서버 ${s.volUnits}장/-€${r2(s.volDiscount)}/net €${r2(s.netAmount)} ≠ 화면 ${c.volUnits}장/-€${r2(c.volDiscount)}/net €${r2(c.netAmount)}` });
    continue;
  }
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
