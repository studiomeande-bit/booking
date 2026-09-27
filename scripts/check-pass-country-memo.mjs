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
 * 금액은 **진짜 calculateQuote_** 를 GAS 스텁 위에서 돌려 계산한다(공식 복제 없음). 예약 화면 미리보기가
 * 서버와 같은 규칙(기타 포함·요금 상수)인지도 함께 본다.
 *
 * 사용법:  node scripts/check-pass-country-memo.mjs       (불일치 시 exit 1)
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/* 금액은 **진짜 견적 엔진 calculateQuote_** 로 계산한다 — 하네스 안에 공식을 복제하지 않는다.
   이력: ① 9/23 판은 요금·할인율을 하드코딩해 Code.gs 를 바꿔도 초록이었고 ② 9/25 오전 판은 상수를 소스에서
   읽었지만, **엔진은 그 상수가 아니라 숫자 5 를 직접** 쓰고 있어 여전히 엔진을 지키지 못했다(결함주입으로 적발).
   그래서 Code.gs 를 GAS 스텁과 함께 통째로 로드해 원본 함수를 부른다(check-contract-b2c 와 같은 방식).
   시트에서 읽는 상품·설정만 스텁한다 — 여권 1인 기준가 €30 은 라이브에선 '상품설정' 시트가 정본이라
   여기서는 시나리오 입력이다. 기대값(140€·157.50€ …)은 사업 사실로 독립 고정한다(엔진에서 뽑으면 순환). */
const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁 — 여권 견적은 시트·드라이브에 닿으면 안 된다`); } });
Object.assign(globalThis, {
  Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 10) },
  SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'), CalendarApp: nope('CalendarApp'),
  MailApp: nope('MailApp'), GmailApp: nope('GmailApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});
const engineDir = mkdtempSync(join(tmpdir(), 'passq-'));
const enginePath = join(engineDir, 'code.cjs');
// 같은 이름 함수는 뒤 선언이 앞 선언을 덮는다(호이스팅) — 시트 조회 두 개만 스텁으로 바꾼다
writeFileSync(enginePath, `${src}
function getProductById_(id){ return {id:'pass',g:'pass',t:'passport',p:30,dur:15,prep:0,nameKo:'여권/비자',nameEn:'Passport',nameDe:'Passbild'}; }
function getSettingsMap_(){ return {}; }
var __ROWS__={};
function getDbSheet(){ return { getLastRow:()=>999, getRange:(r)=>({ getValues:()=>[__ROWS__[r]] }) }; }
function __setRow__(r,cells){ const row=new Array(CONFIG.BOOKING_HEADERS.length).fill('');
  Object.keys(cells).forEach(function(k){ row[BOOKING_COL[k]]=cells[k]; }); __ROWS__[r]=row; }
module.exports={calculateQuote_,buildInvoicePricingOptionText_,buildInvoicePricingPreview_,syncBookingFromInvoiceRecord_,__setRow__,BOOKING_COL,CONFIG};`);
const ENGINE = (await import(pathToFileURL(enginePath).href)).default;
rmSync(engineDir, { recursive: true, force: true });
/** 진짜 엔진으로 계산한 총액. business=true 면 법인 송장 건(가족할인 제외). */
function price(perPerson, people, business = false) {
  return ENGINE.calculateQuote_({ itemId: 'pass', people, date: '2026-10-06',
    passPersonCountries: perPerson, businessInvoiceNeeded: business ? 'Y' : '' }).totalPrice;
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
// '기타'(OTHER)도 한 나라 — 사장님 결정 2026-09-25("받는 쪽"). 예약 화면 안내 "추가 국가는 1개당 €5" 에 예외가 없다.
ok(price([['KR', 'OTHER']], 1) === 35, '한국+기타 = 35€ (기타도 2번째 국가면 €5)', price([['KR', 'OTHER']], 1));
ok(price([['OTHER']], 1) === 30, '기타 한 나라만 = 30€ (국가 1개는 기본가)', price([['OTHER']], 1));
ok(price([['OTHER', 'OTHER']], 1) === 35, '목록 밖 두 나라(예: 베트남+태국) = 35€', price([['OTHER', 'OTHER']], 1));
ok(price(Array(5).fill(['KR', 'OTHER']), 5) === 157.5, '5명 한국+기타 = 157.50€ (가족할인 적용)', price(Array(5).fill(['KR', 'OTHER']), 5));
{
  const vn2 = ctx._expandPassPersonCountries_('[국가별 신청] 2명:한국+베트남', 2, true);
  ok(price(vn2, 2) === 70, "메모 '2명:한국+베트남' = 70€ (베트남도 한 나라)", price(vn2, 2));
}

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

// 10b) 인보이스 품목 문구 — 고객 문서에 찍히는 국가 수가 청구 근거와 같아야 한다(기타 포함)
{
  const label = (pc, people) => ENGINE.buildInvoicePricingOptionText_(
    ENGINE.calculateQuote_({ itemId: 'pass', people, date: '2026-10-06', passPersonCountries: pc }), { people });
  ok(/1인당 국가 2개/.test(label([['KR', 'OTHER']], 1)), "인보이스: 한국+기타 → '1인당 국가 2개'", label([['KR', 'OTHER']], 1));
  ok(/1인당 국가 2개/.test(label(Array(4).fill(['KR', 'DE']), 4)), "인보이스: 4명 한국+독일 → '1인당 국가 2개'", label(Array(4).fill(['KR', 'DE']), 4));
  ok(/국가 구성 2개\/2개\/1개/.test(label([['KR', 'DE'], ['KR', 'OTHER'], ['OTHER']], 3)),
     "인보이스: 사람마다 다르면 '국가 구성 2개/2개/1개'", label([['KR', 'DE'], ['KR', 'OTHER'], ['OTHER']], 3));
}

// 10c) 어드민 '인보이스 발행' 가격 계산기 — 예약을 불러오면 국가 수 칸을 비우고(0) rowIndex 를 보낸다.
//      2026-09-25 감사: 1 로 고정해 보내 한국+독일 €35 예약이 €30 으로 계산되고, '장부 자동 반영' 이 켜져 있으면
//      총액까지 €30 으로 덮어썼다. 서버가 그 예약의 구성을 실제로 읽는지 진짜 buildInvoicePricingPreview_ 로 본다.
{
  ENGINE.__setRow__(301, { '요청사항': '[국가별 신청] 1명:한국+기타', '옵션': '' });
  ENGINE.__setRow__(302, { '요청사항': '현장 접수', '옵션': 'dog | 국가 2개/인' });
  const pv = (rowIndex, people, passCountryCount = 0) =>
    ENGINE.buildInvoicePricingPreview_({ itemId: 'pass', people, date: '2026-10-06', rowIndex, passCountryCount });
  const a = pv(301, 1);
  ok(a.quote && a.quote.totalPrice === 35, '발행 계산기: 한국+기타 예약 → €35 (국가 1개 가정 금지)', a.quote && a.quote.totalPrice);
  ok(/1인당 국가 2개/.test(a.optionText || ''), "발행 계산기 문구: '1인당 국가 2개'", a.optionText);
  const w = pv(302, 3);
  ok(w.quote && w.quote.totalPrice === 105, '발행 계산기: 창구 등록(국가 2개/인) 3명 → €105', w.quote && w.quote.totalPrice);
  const manual = pv(301, 1, 1);
  ok(manual.quote && manual.quote.totalPrice === 30, '직접 입력한 국가 수(1)는 그대로 우선', manual.quote && manual.quote.totalPrice);

  const admin = readFileSync(join(ROOT, 'appscript', 'AdminV2.html'), 'utf8');
  const payloadFn = admin.slice(admin.indexOf('function buildInvoicePricingPayload('), admin.indexOf('function setInvoiceCalcPreview('));
  ok(/passCountryCount:parseInt\([^)]*inv_calcPassportCountryCount[^)]*\)\?\.value,10\)\|\|0,/.test(payloadFn.replace(/\s+/g, ''))
     || /passCountryCount:\s*parseInt\(document\.getElementById\('inv_calcPassportCountryCount'\)\?\.value,10\)\|\|0,/.test(payloadFn),
     "어드민 계산기: 빈칸을 1 로 강제하지 않는다(0 = 예약 기준)");
  ok(/rowIndex:\s*parseInt\(document\.getElementById\('inv_rowIndex'\)/.test(payloadFn), '어드민 계산기: rowIndex 를 보낸다');
  const upd = admin.slice(admin.indexOf('function buildInvoiceBookingUpdatePayload('));
  ok(/passCountryCount:\(payload&&payload\.passCountryCount\)\|\|0,/.test(upd) && /rowIndex:\(payload&&payload\.rowIndex\)\|\|0,/.test(upd),
     '발행 페이로드가 국가 수를 1 로 되돌리지 않고 rowIndex 를 싣는다');
  // 발행 동기화를 **실제로 실행**해 옵션 열에 무엇이 써지는지 본다(선언 존재만 보는 단정은 되돌려도 초록이었다)
  {
    const C = ENGINE.BOOKING_COL;
    const row = new Array(ENGINE.CONFIG.BOOKING_HEADERS.length).fill('');
    row[C['고객명']] = '창구 손님'; row[C['촬영종류']] = 'pass'; row[C['인원']] = 2;
    row[C['옵션']] = 'dog | 국가 2개/인'; row[C['요청사항']] = '현장 접수';
    const writes = {};
    const sheet = { getRange: (r, c) => ({
      setValue: (v) => { writes[c - 1] = v; },
      getValues: () => [row.map((x, i) => (i in writes ? writes[i] : x))] }) };
    const res = ENGINE.syncBookingFromInvoiceRecord_(sheet, 302,
      { number: 'STMIN-TEST', total: 105, items: [{ description: '여권/비자', qty: 1, unitGross: 105 }] },
      { syncBooking: true, bookingUpdate: { itemId: 'pass', people: 3, optionText: '인원 3명 | 1인당 국가 2개' } });
    ok(res && res.ok, '발행 동기화 실행됨', JSON.stringify(res));
    ok(/국가 2개\/인/.test(String(writes[C['옵션']] || '')),
       "발행 동기화 후에도 옵션 열에 '국가 2개/인' 이 남는다(창구 등록의 유일한 국가 기록)", writes[C['옵션']]);
    ok(writes[C['총결제액']] === 105, '발행 동기화: 총결제액 = 인보이스 총액 €105', writes[C['총결제액']]);
  }
}

// 11) 예약 화면 미리보기(frontend/booking/booking.js getPreviewQuote)가 서버와 같은 규칙인가.
//     화면은 서버 견적을 기다리는 동안 자체 계산을 보여준다 — 한쪽만 바꾸면 "화면 €30 / 청구 €35" 분쟁이 난다.
{
  const fe = readFileSync(join(ROOT, 'frontend', 'booking', 'booking.js'), 'utf8');
  const at = fe.indexOf("if (item.t === 'passport') {", fe.indexOf('function getPreviewQuote('));
  const block = at > -1 ? fe.slice(at, fe.indexOf('\n  }', at)) : '';
  ok(block.length > 0, '예약 화면 여권 미리보기 블록을 찾음');
  ok(!/!==\s*'OTHER'/.test(block), "예약 화면도 '기타'를 한 나라로 센다 (OTHER 제외 없음)");
  const fee = (block.match(/\.length\s*-\s*1\)\s*\*\s*(\d+(?:\.\d+)?)/) || [])[1];
  const serverFee = (src.match(/const PASS_EXTRA_COUNTRY_FEE_=(\d+(?:\.\d+)?);/) || [])[1];
  ok(fee !== undefined && fee === serverFee, `예약 화면 국가 요금 €${fee} = 서버 PASS_EXTRA_COUNTRY_FEE_ €${serverFee}`);
  ok(/\)\s*\.length\s*-\s*1\)\s*\*\s*PASS_EXTRA_COUNTRY_FEE_/.test(src.slice(src.indexOf('function calculateQuote_('))),
     '서버 엔진이 숫자 대신 PASS_EXTRA_COUNTRY_FEE_ 상수를 쓴다(창구 국가 추가와 같은 값)');
}

if (fail) { console.error(`\n✗ 여권 국가 메모 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 여권 1인당 국가 메모 — 파싱·펼치기·왕복·금액 전부 일치');
