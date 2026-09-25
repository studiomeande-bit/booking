#!/usr/bin/env node
/**
 * check-pass-country-memo.mjs — 여권 1인당 국가 구성(요청사항 `[국가별 신청]` 토큰) 왕복 검사기
 *
 * 왜 필요한가: 여권 금액은 **사람마다** `30€ + (국가수-1)×5€` 이고 5인부터 가족할인이다.
 *   1인당 국가 구성은 시트 컬럼이 아니라 요청사항 메모의 `[국가별 신청] 4명:한국+독일` 토큰에만 있다.
 *   2026-09-23 실측: 보드의 인원 변경이 이 토큰을 안 읽어 4명 140€ 가 120€ 로 계산됐다(현장에서 €20 덜 받을 뻔).
 *   고쳤으니 이제는 **파싱 → 펼치기 → 다시 토큰** 왕복에서 금액이 흔들리지 않는지가 핵심이다.
 *   (특히 "추가 인원은 기본가" 로 저장한 뒤 다음 인원 변경에서 상속이 끼어들면 요금이 슬며시 붙는다.)
 *
 * 검사 대상: appscript/Code.gs 의 _parsePassCountryMemo_ / _expandPassPersonCountries_ /
 *            _passCountriesToMemoToken_ / _passCountryCode_ / _passCountryLabel_ / _formatPassCountryMemo_
 *            를 그대로 떼어내 실행한다(복사본 아님 — 소스에서 추출).
 * 금액 공식은 calculateQuote_ 의 passport 블록과 같은 식을 여기서 한 번 더 쓴다(공식이 바뀌면 이 파일도 고칠 것).
 *
 * 사용법:  node scripts/check-pass-country-memo.mjs       (불일치 시 exit 1)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');

/** Code.gs 에서 `function NAME(` 부터 짝이 맞는 중괄호까지 떼어낸다. */
function grab(name) {
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`${name} 을 Code.gs 에서 찾지 못했습니다 — 이름이 바뀌었나요?`);
  let depth = 0, i = src.indexOf('{', at);
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(at, j + 1);
  }
  throw new Error(`${name} 의 본문이 닫히지 않았습니다`);
}
const labelsLine = src.match(/const PASS_COUNTRY_LABELS_=\{[^}]*\};/);
if (!labelsLine) throw new Error('PASS_COUNTRY_LABELS_ 를 찾지 못했습니다');

const fns = ['_passCountryLabel_', '_parsePassCountryMemo_', '_formatPassCountryMemo_',
             '_passCountriesToMemoToken_', '_expandPassPersonCountries_', '_passCountryCode_',
             'buildInvoicePassPersonCountries_', 'resolvePassPersonCountriesForRow_'];
// resolvePassPersonCountriesForRow_ 는 열 인덱스로 행을 읽는다 — 검사에서는 [요청사항, 옵션] 두 칸짜리 가짜 행을 쓴다
const ctx = new Function(`const BOOKING_COL={'요청사항':0,'옵션':1};\n${labelsLine[0]}\n${fns.map(grab).join('\n')}\nreturn {${fns.join(',')}};`)();
const row = (memo, option) => [memo || '', option || ''];

/* 금액 상수는 **Code.gs 에서 읽는다**. 하드코딩했다가 2026-09-25 결함주입 실험에서 들켰다:
   `PASS_EXTRA_COUNTRY_FEE_` 를 5→4 로, 가족할인 기본값을 10→12 로 바꿔도 이 게이트가 초록이었다
   (하네스가 자기 숫자로 계산하니 Code.gs 와 어긋나도 모른다 — 헤더는 "금액 전부 일치" 라고 주장하면서).
   BASE(1인 €30)만은 예외로 시나리오 입력이다 — 라이브 상품가는 Code.gs 가 아니라 '상품설정' 시트가 정본이라
   여기서 단정할 수 없다(메모리 product-catalog-source-of-truth). 나머지는 소스가 바뀌면 이 게이트가 빨개진다. */
const num = (re, what) => {
  const m = src.match(re);
  if (!m) throw new Error(`${what} 를 Code.gs 에서 찾지 못했습니다 — 상수명이 바뀌었나요? (${re})`);
  return Number(m[1]);
};
const BASE = 30;
const EXTRA = num(/const PASS_EXTRA_COUNTRY_FEE_=(\d+(?:\.\d+)?);/, 'PASS_EXTRA_COUNTRY_FEE_');
const FAMILY_MIN = num(/const PASS_FAMILY_DISCOUNT_MIN_PEOPLE=(\d+);/, 'PASS_FAMILY_DISCOUNT_MIN_PEOPLE');
// 설정 시트에 행이 없을 때의 기본 할인율 — getPassportFamilyDiscountRate_ 의 폴백 `return N;`
const FAMILY_PCT = num(/function getPassportFamilyDiscountRate_\(\)\{[\s\S]*?String\(v\)\.trim\(\)===''\)\s*return (\d+(?:\.\d+)?);/, '가족할인 기본율');
const round = (n) => Math.round(n * 100) / 100;
/** calculateQuote_ passport 블록과 같은 식. */
function price(perPerson, people, business = false) {
  const filled = perPerson.filter((cs) => cs.length);
  let total = filled.reduce((sum, cs) =>
    sum + BASE + Math.max(0, cs.filter((c) => c && c !== 'OTHER').length - 1) * EXTRA, 0);
  total += BASE * Math.max(0, people - filled.length);
  if (people >= FAMILY_MIN && !business) total = round(total - round(total * (FAMILY_PCT / 100)));
  return round(total);
}

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};

// 1) 실사례(김여주 row 294): 4명 한국+독일 = 140€, 인원만 올려도 국가 요금이 유지된다
const memo4 = '[국가별 신청] 4명:한국+독일';
for (const [people, want] of [[2, 70], [4, 140], [5, 157.5], [6, 189]]) {
  const got = price(ctx._expandPassPersonCountries_(memo4, people, true), people);
  ok(got === want, `${people}명 상속 = ${want}€`, got);
}
// 2) 상속 끄면 추가 인원은 기본가만
ok(price(ctx._expandPassPersonCountries_(memo4, 5, false), 5) === 153, '5명 비상속 = 153€',
   price(ctx._expandPassPersonCountries_(memo4, 5, false), 5));

// 3) **왕복**: 저장한 토큰을 다시 펼쳐도(상속 ON 이어도) 금액이 같아야 한다 — 이게 없으면 €5 가 슬며시 붙는다
for (const [people, inherit] of [[5, false], [6, false], [5, true], [7, true]]) {
  const first = ctx._expandPassPersonCountries_(memo4, people, inherit);
  const token = ctx._passCountriesToMemoToken_(first);
  const again = ctx._expandPassPersonCountries_(token, people, true);
  ok(price(first, people) === price(again, people),
     `왕복 금액 고정 (${people}명 inherit=${inherit}) 토큰="${token}"`,
     [price(first, people), price(again, people)]);
}

// 4) 여러 그룹 메모: 사람마다 구성이 다른 경우 순서·금액·재그룹이 보존된다
const mixed = '[국가별 신청] 2명:한국+독일, 1명:한국';
const mx = ctx._expandPassPersonCountries_(mixed, 3, true);
ok(JSON.stringify(mx) === JSON.stringify([['KR', 'DE'], ['KR', 'DE'], ['KR']]), '다중그룹 펼치기', mx);
ok(price(mx, 3) === 100, '다중그룹 금액 = 100€ (2명 한국+독일 + 1명 한국)', price(mx, 3));
ok(ctx._passCountriesToMemoToken_(mx) === mixed, '다중그룹 토큰 복원', ctx._passCountriesToMemoToken_(mx));

// 5) 인원 축소: 토큰이 줄어든 인원으로 다시 써져야 한다(안 줄면 다음 견적이 옛 인원으로 계산된다)
ok(ctx._passCountriesToMemoToken_(ctx._expandPassPersonCountries_(memo4, 2, true))
   === '[국가별 신청] 2명:한국+독일', '축소 토큰 2명', ctx._passCountriesToMemoToken_(ctx._expandPassPersonCountries_(memo4, 2, true)));

// 6) 라벨↔코드 왕복. 미등록 국가는 OTHER 로 떨어지고 국가 수에서 빠진다(기본가)
ok(ctx._passCountryCode_('한국') === 'KR' && ctx._passCountryCode_('KR') === 'KR', '라벨/코드 모두 KR');
ok(ctx._passCountryCode_('Ruritania') === 'OTHER', '미등록 국가 = OTHER', ctx._passCountryCode_('Ruritania'));
ok(price([['KR', 'OTHER']], 1) === 30, 'OTHER 는 추가요금 없음 = 30€', price([['KR', 'OTHER']], 1));

// 7) 토큰 없는 예약: 전원 기본가 (종전 동작 그대로)
ok(price(ctx._expandPassPersonCountries_('사전 문의 메모만 있음', 3, true), 3) === 90, '토큰 없음 = 90€');

// 8) 법인 인보이스 건은 가족할인 제외
ok(price(ctx._expandPassPersonCountries_(memo4, 5, true), 5, true) === 175, '법인 5명 = 175€(할인 없음)',
   price(ctx._expandPassPersonCountries_(memo4, 5, true), 5, true));

// 9) 표기 보존: 목록에 없는 국가는 '기타' 로 뭉개지 말고 원문 표기를 유지한다(어느 규격으로 인화할지의 근거)
{
  const vn = '[국가별 신청] 2명:베트남';
  const exp = ctx._expandPassPersonCountries_(vn, 3, true);
  ok(ctx._passCountriesToMemoToken_(exp, vn) === '[국가별 신청] 3명:베트남', "'베트남' 표기 유지",
     ctx._passCountriesToMemoToken_(exp, vn));
  ok(ctx._passCountriesToMemoToken_(exp) === '[국가별 신청] 3명:기타', '원문 없으면 코드→기타(폴백)',
     ctx._passCountriesToMemoToken_(exp));
  ok(price(exp, 3) === 90, '미등록 국가 1개는 기본가 3×30', price(exp, 3));
}

// 10) 창구 수기등록(메모 토큰 없음, 옵션에 `국가 2개/인`): 인원을 올려도 2번째 국가 요금이 유지된다
{
  const walkin = row('현장 접수', 'dog|bg | 국가 2개/인');
  const r2 = ctx.resolvePassPersonCountriesForRow_(walkin, 2, true);
  ok(r2.fromOption === true && r2.optionCount === 2, '옵션 국가수 인식', r2);
  ok(price(r2.countries, 2) === 70, '창구 2명 = 70€', price(r2.countries, 2));
  const r3 = ctx.resolvePassPersonCountriesForRow_(walkin, 3, true);
  ok(price(r3.countries, 3) === 105, '창구 3명 = 105€ (전원 기본가 90€ 가 아니다)', price(r3.countries, 3));
  // 국가명은 기록이 없으므로 메모에 지어내 쓰지 않는다 → fromOption 이면 토큰을 쓰지 않는 게 호출부 책임
  ok(r3.fromOption === true, '창구 건은 fromOption 유지(메모에 국가명 쓰지 않음)');
  // 메모 토큰이 있으면 그쪽이 1순위
  const both = row('[국가별 신청] 2명:한국+독일+일본', '국가 2개/인');
  ok(price(ctx.resolvePassPersonCountriesForRow_(both, 2, true).countries, 2) === 2 * 40,
     '메모 토큰이 옵션보다 우선 = 80€', price(ctx.resolvePassPersonCountriesForRow_(both, 2, true).countries, 2));
  ok(ctx.resolvePassPersonCountriesForRow_(row('메모없음', '국가 1개/인'), 3, true).fromOption === false,
     '국가 1개/인 은 폴백 불필요');
}

if (fail) { console.error(`\n✗ 여권 국가 메모 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 여권 1인당 국가 메모 — 파싱·펼치기·왕복·금액 전부 일치');
