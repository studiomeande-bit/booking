#!/usr/bin/env node
/**
 * check-retouch-slots.mjs — 프로필 다인 컷 보정 슬롯 계산 검증기
 *
 * 사장님 결정 2026-09-23: 프로필(prof)은 1인 기준 가격이라 한 컷에 여러 명이 나오면
 * 포함 보정 슬롯을 인원수만큼 쓴다(1인=1 · 2인=2 · 3인 이상=3). 초과분은 기존 추가보정
 * 단가(€10/슬롯). 스튜디오·스냅·웨딩·마이리얼트립은 종전대로 장 단위.
 *
 * 청구 정본은 서버이므로 재구현이 아니라 Code.gs **원본 소스를 떼어내** 돌린다.
 *   node scripts/check-retouch-slots.mjs        (불일치 시 exit 1)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript/Code.gs'), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} 을 찾지 못했습니다.`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`${name} 본문 끝을 찾지 못했습니다.`);
}

const FNS = ['normalizeSelectPersons_', 'selectPhotoRetouchSlots_', 'isSelectPerPersonRetouchGroup_', 'computeSelectExtraRetouch_'];
const SRC = FNS.map((n) => extractFn(gs, n)).join('\n');
// eslint-disable-next-line no-new-func
const api = new Function(`${SRC}\nreturn {${FNS.join(',')}};`)();
const { computeSelectExtraRetouch_: extra, isSelectPerPersonRetouchGroup_: perPersonOf, normalizeSelectPersons_: norm } = api;

const P = (persons, opts = {}) => ({ num: String(opts.num || '0001'), note: opts.note || '', persons, ...opts });
const caps = (group, o = {}) => ({
  perPerson: perPersonOf(group),
  marketingAgreed: !!o.marketingAgreed,
  bonusCap: o.bonusCap || 0,
  serviceCap: o.serviceCap || 0
});

let failed = 0;
const eq = (label, actual, expected) => {
  if (actual === expected) { console.log(`  ✓ ${label} → ${actual}`); return; }
  failed += 1;
  console.error(`  ✗ ${label} → ${actual} (기대 ${expected})`);
};

console.log('■ 인원 정규화 (상한 3 · 하한 1)');
[[undefined, 1], [null, 1], [0, 1], [1, 1], ['2', 2], [3, 3], [9, 3], [-4, 1], ['abc', 1]]
  .forEach(([input, want]) => eq(`persons=${JSON.stringify(input)}`, norm(input), want));

console.log('\n■ prof — 1인 기준 가격이라 인원수만큼 슬롯 차감');
// pp(Professional) 기본 3장
eq('pp 3장 모두 1인 → 추가 0', extra([P(1), P(1), P(1)], 3, caps('prof')), 0);
eq('pp 1인+2인 (3슬롯) → 추가 0', extra([P(1), P(2)], 3, caps('prof')), 0);
eq('pp 2인+2인 (4슬롯) → 추가 1', extra([P(2), P(2)], 3, caps('prof')), 1);
eq('pp 3인 컷 1장 (3슬롯) → 추가 0', extra([P(3)], 3, caps('prof')), 0);
eq('pp 3인+3인 (6슬롯) → 추가 3', extra([P(3), P(3)], 3, caps('prof')), 3);
// pb(Basic) 기본 1장 — 사장님이 든 대표 사례
eq('pb 2인 컷 1장 → 추가 1 (€10)', extra([P(2)], 1, caps('prof')), 1);
eq('pb 3인 이상 컷 1장 → 추가 2 (€20)', extra([P(3)], 1, caps('prof')), 2);
eq('pb 1인 컷 1장 → 추가 0', extra([P(1)], 1, caps('prof')), 0);
// pbus(Business) 기본 2장
eq('pbus 2인 컷 1장 → 추가 0', extra([P(2)], 2, caps('prof')), 0);

console.log('\n■ 다른 촬영군은 장 단위 그대로 (인원값이 있어도 무시)');
['stud', 'snap', 'wed', '마이리얼트립'].forEach((g) => {
  eq(`${g}: 3인 컷 2장 · 기본 3 → 추가 0`, extra([P(3), P(3)], 3, caps(g)), 0);
});
eq('stud Basic(3장): 4장 선택 → 추가 1', extra([P(1), P(1), P(1), P(1)], 3, caps('stud')), 1);

console.log('\n■ 무료 슬롯(보너스·서비스컷)과의 상호작용');
// 빈 placeholder 는 슬롯을 소비하지 않는다 (memory: select-free-slot-placeholders)
eq('빈 보너스행은 슬롯 소비 없음', extra(
  [P(1), { num: '', note: '', isBonus: true }], 1, caps('prof', { marketingAgreed: true, bonusCap: 2 })), 0);
// 남는 보너스는 일반 초과분을 흡수한다 (2026-08-25 강예슬 규칙) — 인원 기준에서도 유지
eq('pb + 보너스2 미사용: 3인 컷 → 추가 0', extra(
  [P(3)], 1, caps('prof', { marketingAgreed: true, bonusCap: 2 })), 0);
eq('pb + 보너스2 미사용: 3인+2인(5슬롯) → 추가 2', extra(
  [P(3), P(2)], 1, caps('prof', { marketingAgreed: true, bonusCap: 2 })), 2);
// 미동의면 보너스 캡은 0
eq('마케팅 미동의면 보너스 흡수 없음 → 추가 2', extra(
  [P(3)], 1, caps('prof', { marketingAgreed: false, bonusCap: 2 })), 2);
// 서비스컷: 잔여가 그 컷의 인원수보다 적으면 통째로 유료 후보로 내려간다
eq('서비스컷 1 잔여에 2인 서비스컷 → 유료 2슬롯(기본 0)', extra(
  [P(2, { isService: true, isBonus: true })], 0, caps('prof', { serviceCap: 1 })), 2);
eq('서비스컷 2 잔여에 2인 서비스컷 → 추가 0', extra(
  [P(2, { isService: true, isBonus: true })], 0, caps('prof', { serviceCap: 2 })), 0);

console.log('\n■ 보정 0장(출력만) 경로는 그대로 (memory: select-prints-only-no-retouch)');
eq('사진 없음 → 추가 0', extra([], 1, caps('prof')), 0);

/* ── 화면(select.js) 미러가 서버와 같은 답을 내는지 ───────────────────────────────
 * 고객은 화면에서 본 금액을 기준으로 제출하고 청구는 서버가 한다. 두 규칙이 갈리면
 * "화면엔 0€ 였는데 메일엔 20€" 가 된다 — 인원 기준 과금에서 특히 어긋나기 쉽다. */
const js = readFileSync(join(ROOT, 'frontend/select/v2/select.js'), 'utf8');
const UI_FNS = ['isPerPersonRetouchSession', 'normalizePersons', 'photoRetouchSlots',
  'getMarketingBonusCount', 'getRetouchFreeLimit', 'getRetouchUsedSlots', 'getRetouchExtraCount', 'photoPaidSlots'];
const UI_SRC = UI_FNS.map((n) => extractFn(js, n)).join('\n');
// eslint-disable-next-line no-new-func
const ui = new Function('state', `${UI_SRC}\nreturn {${UI_FNS.join(',')}};`);

console.log('\n■ 화면 미러(select.js) ↔ 서버(Code.gs) 일치');
const MIRROR = [
  ['pb 2인 컷', 'prof', 1, [P(2)], { marketing: 'N', bonusCount: 0 }],
  ['pb 3인 컷', 'prof', 1, [P(3)], { marketing: 'N', bonusCount: 0 }],
  ['pp 2인+2인', 'prof', 3, [P(2), P(2)], { marketing: 'N', bonusCount: 0 }],
  ['pp 3인+3인', 'prof', 3, [P(3), P(3)], { marketing: 'N', bonusCount: 0 }],
  ['pbus 1인×3', 'prof', 2, [P(1), P(1), P(1)], { marketing: 'N', bonusCount: 0 }],
  ['pb + 보너스2 미사용 3인', 'prof', 1, [P(3)], { marketing: 'Y', bonusCount: 2 }],
  ['pb + 보너스2 미사용 3인+2인', 'prof', 1, [P(3), P(2)], { marketing: 'Y', bonusCount: 2 }],
  ['stud 3인 컷 2장(장 단위)', 'stud', 3, [P(3), P(3)], { marketing: 'N', bonusCount: 0 }],
  ['snap 4장 초과', 'snap', 3, [P(1), P(1), P(1), P(1)], { marketing: 'N', bonusCount: 0 }]
];
MIRROR.forEach(([label, group, base, photos, opt]) => {
  const state = {
    marketing: opt.marketing,
    photos: photos.map((p) => ({ ...p })),
    session: { itemGroup: group, baseRetouchCount: base, marketingBonusCount: opt.bonusCount }
  };
  const client = ui(state).getRetouchExtraCount();
  const server = extra(photos, base, caps(group, { marketingAgreed: opt.marketing === 'Y', bonusCap: opt.bonusCount }));
  if (client === server) { console.log(`  ✓ ${label} → 양쪽 ${server}`); return; }
  failed += 1;
  console.error(`  ✗ ${label} → 화면 ${client} / 서버 ${server}`);
});

console.log('\n■ 유료 슬롯 분해 (한 컷이 반만 유료일 수 있다)');
{
  // pb(기본 1장) + 2인 컷 1장 → 그 컷의 2슬롯 중 1슬롯만 유료
  const state = { marketing: 'N', photos: [{ num: '1', persons: 2 }], session: { itemGroup: 'prof', baseRetouchCount: 1 } };
  eq('pb 2인 컷의 유료 슬롯', ui(state).photoPaidSlots(state.photos[0], 0), 1);
  const state2 = { marketing: 'N', photos: [{ num: '1', persons: 1 }, { num: '2', persons: 3 }], session: { itemGroup: 'prof', baseRetouchCount: 3 } };
  eq('pp 1인 컷(전액 무료)', ui(state2).photoPaidSlots(state2.photos[0], 0), 0);
  eq('pp 뒤따르는 3인 컷 유료 슬롯', ui(state2).photoPaidSlots(state2.photos[1], 1), 1);
}

if (failed) { console.error(`\n❌ ${failed}건 불일치`); process.exit(1); }
console.log('\n✅ 보정 슬롯 계산 전부 일치 (서버·화면 동일)');
