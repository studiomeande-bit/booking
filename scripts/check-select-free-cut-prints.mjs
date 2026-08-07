#!/usr/bin/env node
/**
 * 무료 컷(서비스 컷 · 마케팅 보너스 컷)의 시그니처 10×15 인화 포함 검증.
 *
 * 사장님 확정 2026-08-07: 두 종류 모두 슬롯당 10×15 인화 1장 포함(큰 사이즈는 차액).
 * 서비스 컷은 기존에 크레딧이 있었고, 마케팅 보너스는 이번에 신설했다.
 *
 * 돈이 걸린 경로라 **서버 computeSelectDecoupledPrints_ 를 실제로 실행**해 검증한다
 * (클라이언트 표시는 참고용, 서버가 최종 청구). 의존 함수는 Code.gs 원본을 그대로 뽑아 쓰고,
 * 상품 쿼터 조회만 테스트가 지정한 값으로 스텁한다.
 *
 * new Function 입력은 이 저장소의 Code.gs 뿐이다(외부 입력 없음).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'appscript/Code.gs'), 'utf8');

function grabFn(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`not found: ${name}`);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced: ${name}`);
}

// SELECT_HEADERS 를 소스에서 읽어 컬럼 인덱스를 만든다(하드코딩하면 헤더가 바뀔 때 조용히 어긋난다)
const HEADERS = JSON.parse('[' + src.match(/const SELECT_HEADERS=\[([\s\S]*?)\];/)[1].replace(/'/g, '"') + ']');
const SELECT_COL = Object.fromEntries(HEADERS.map((h, i) => [h, i]));

// 실제 단가 (PRINT_OPTIONS / PRINT_LABELS 와 같은 값)
const PRINT_LABELS = {
  basic_10x15: { label: '시그니처 10×15cm', price: 4, retouchedPrice: 3 },
  premium_10x15: { label: '파인아트 10×15cm', price: 8, retouchedPrice: 6 },
  basic_a4: { label: '시그니처 A4', price: 15, retouchedPrice: 10 },
  premium_a3: { label: '파인아트 A3', price: 50, retouchedPrice: 35 },
};

const ctx = {
  SELECT_COL,
  PRINT_LABELS,
  roundCurrency_: (n) => Math.round((Number(n) || 0) * 100) / 100,
};
// getSelectIncludedPrintQuota_ 는 테스트별 쿼터로 엔진 안에서 선언한다(상품 조회 체인은 스텁)

function buildEngine(quota) {
  const names = ['selectPhotoNumKey_', 'buildRetouchNumSet_', 'buildSelectServiceCutNums_',
    'buildSelectMarketingBonusNums_', 'selectQuotaCredit_', 'getPrintInfo_',
    'mergeSelectPrintItems_', 'normalizeSelectMarketingBonusCount_',
    'getDefaultSelectMarketingBonusCount_', 'computeSelectDecoupledPrints_'];
  const body = names.map(grabFn).join('\n');
  const keys = Object.keys(ctx);
  return new Function(...keys, 'QUOTA',
    `const getSelectIncludedPrintQuota_ = () => QUOTA.map(q => ({...q}));
     ${body}
     return {computeSelectDecoupledPrints_, buildSelectServiceCutNums_, buildSelectMarketingBonusNums_, buildRetouchNumSet_};`
  )(...keys.map((k) => ctx[k]), quota);
}

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

function price({ quota = [], photos, prints, serviceCutCount = 0, bonusCount = 0, marketing = 'Y' }) {
  const eng = buildEngine(quota);
  const row = [];
  row[SELECT_COL['촬영종류']] = 'stud';
  row[SELECT_COL['상품']] = '스튜디오 Basic';
  row[SELECT_COL['서비스컷수']] = serviceCutCount;
  row[SELECT_COL['마케팅보너스수']] = bonusCount;
  row[SELECT_COL['마케팅동의']] = marketing;
  const retouchSet = eng.buildRetouchNumSet_(photos);
  const serviceNums = eng.buildSelectServiceCutNums_(photos);
  // priceSelectPrints_ 와 같은 게이트: 동의 없으면 보너스 번호를 아예 넘기지 않는다
  const bonusNums = /^y/i.test(marketing) ? eng.buildSelectMarketingBonusNums_(photos) : [];
  return eng.computeSelectDecoupledPrints_(prints, row, retouchSet, serviceNums, bonusNums);
}
const P = (num, extra = {}) => ({ num, ...extra });
const PR = (photoNum, printId = 'basic_10x15') => ({ photoNum, printId, qty: 1 });

console.log('\n── 번호 맵: 서비스와 보너스가 겹치지 않는가 ──');
{
  const eng = buildEngine([]);
  // 서비스 슬롯은 isBonus 도 true 로 만들어진다 — 안 걸러내면 한 장이 크레딧을 두 번 받는다
  const photos = [P('A', { isBonus: true, source: 'bonus' }), P('B', { isService: true, isBonus: true, source: 'service' })];
  t('서비스 번호 = [b]', JSON.stringify(eng.buildSelectServiceCutNums_(photos)) === '["b"]');
  t('보너스 번호 = [a] (서비스 제외)', JSON.stringify(eng.buildSelectMarketingBonusNums_(photos)) === '["a"]');
}

console.log('\n── 마케팅 보너스 컷 10×15 포함 (신설) ──');
{
  const photos = [P('R1'), P('B1', { isBonus: true, source: 'bonus' }), P('B2', { isBonus: true, source: 'bonus' })];
  const r = price({ photos, prints: [PR('B1'), PR('B2')], bonusCount: 2 });
  t('보너스 2장 인화 €0', r.amount === 0, `€${r.amount}`);
  t('라벨에 보너스 무료 표기', r.items.every((i) => /보너스 컷 무료/.test(i.label)), JSON.stringify(r.items.map((i) => i.label)));
}
{
  // 상한 초과분은 정가 — 보너스 3장을 주문해도 캡이 2면 1장은 €3
  const photos = [P('B1', { isBonus: true }), P('B2', { isBonus: true }), P('B3', { isBonus: true })];
  const r = price({ photos, prints: [PR('B1'), PR('B2'), PR('B3')], bonusCount: 2 });
  t('상한 초과 1장은 정가 €3', r.amount === 3, `€${r.amount}`);
}
{
  // 큰 사이즈는 차액만 — A4 보정본가 €10 − €3 = €7
  const photos = [P('B1', { isBonus: true })];
  const r = price({ photos, prints: [PR('B1', 'basic_a4')], bonusCount: 1 });
  t('보너스 컷 A4 는 차액 €7', r.amount === 7, `€${r.amount}`);
  t('라벨에 차액 표기', /보너스 컷 차액/.test(r.items[0].label), r.items[0].label);
}
{
  // 마케팅 미동의면 크레딧 없음
  const photos = [P('B1', { isBonus: true })];
  const r = price({ photos, prints: [PR('B1')], bonusCount: 2, marketing: 'N' });
  t('마케팅 미동의는 크레딧 0 (정가 €3)', r.amount === 3, `€${r.amount}`);
}

console.log('\n── 서비스 컷은 기존대로 ──');
{
  const photos = [P('S1', { isService: true, isBonus: true })];
  t('서비스 컷 10×15 €0', price({ photos, prints: [PR('S1')], serviceCutCount: 1 }).amount === 0);
  t('서비스 컷 A4 차액 €7', price({ photos, prints: [PR('S1', 'basic_a4')], serviceCutCount: 1 }).amount === 7);
}

console.log('\n── 이중 크레딧이 없어야 한다 ──');
{
  // 서비스 슬롯 1장에 인화 2장을 걸면 1장만 무료(크레딧은 슬롯당 1장)
  const photos = [P('S1', { isService: true, isBonus: true })];
  const r = price({ photos, prints: [PR('S1'), PR('S1')], serviceCutCount: 1, bonusCount: 2 });
  t('서비스 1슬롯 = 인화 1장만 무료, 2장째 €3', r.amount === 3, `€${r.amount}`);
  t('서비스 컷이 보너스 크레딧까지 받지 않음', r.amount === 3, `€${r.amount}`);
}

console.log('\n── 상품 쿼터와 함께 (스튜디오 Basic + 보너스 2 + 서비스 1) ──');
{
  const quota = [{ id: 'basic_a4', qty: 1 }, { id: 'basic_10x15', qty: 2 }];
  const photos = [P('R1'), P('R2'), P('R3'),
    P('B1', { isBonus: true }), P('B2', { isBonus: true }),
    P('S1', { isService: true, isBonus: true })];
  const prints = [PR('R1', 'basic_a4'), PR('R2'), PR('R3'), PR('B1'), PR('B2'), PR('S1')];
  const r = price({ quota, photos, prints, bonusCount: 2, serviceCutCount: 1 });
  t('전부 무료 (쿼터 3 + 보너스 2 + 서비스 1 = 6장)', r.amount === 0, `€${r.amount}`);
  const all = (r.includedItems || []).concat(r.items || []);
  t('작업 지시서에 6장 모두 실림', all.reduce((n, i) => n + (Number(i.qty) || 1), 0) === 6,
    JSON.stringify(all.map((i) => `${i.photoNum}:${i.printId}:${i.price}`)));
}
{
  // 쿼터가 없는 상품(야외 Plus 이전 상태)이어도 무료 컷 인화는 나가야 한다
  const photos = [P('B1', { isBonus: true }), P('S1', { isService: true, isBonus: true })];
  const r = price({ quota: [], photos, prints: [PR('B1'), PR('S1')], bonusCount: 1, serviceCutCount: 1 });
  t('쿼터 없어도 보너스·서비스 인화는 무료', r.amount === 0, `€${r.amount}`);
}

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
