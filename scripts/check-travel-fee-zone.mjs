#!/usr/bin/env node
/**
 * check-travel-fee-zone.mjs — 출장비 존 판정 회귀 검사
 *
 * 2026-08-26 하이델베르크 문의에 €30(존2)으로 답했는데 정책은 €70(존3) — €40 손실.
 * 존 표가 코드와 문서 두 곳으로 갈라지면 같은 사고가 다시 난다. 그래서
 *   (1) Code.gs 의 TRAVEL_FEE_ZONES_ · TRAVEL_KM_TABLE_ · 판정 함수를 **원본 그대로** 떼어내 돌리고
 *   (2) docs/travel-fee-policy.md 에 적힌 존 금액(30/70)과 도시 거리표가 코드와 같은지 대조한다.
 * 규칙이 바뀌면 여기서 깨진다(재구현 아님).
 *
 * 사용법:  node scripts/check-travel-fee-zone.mjs      (불일치 시 exit 1)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript/Code.gs'), 'utf8');
const doc = readFileSync(join(ROOT, 'docs/travel-fee-policy.md'), 'utf8');

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
function extractConst(src, name) {
  const start = src.indexOf(`const ${name}=`);
  if (start < 0) throw new Error(`${name} 을 찾지 못했습니다.`);
  const end = src.indexOf('\n];', start);
  if (end < 0) { // 한 줄짜리 상수
    return src.slice(start, src.indexOf('\n', start));
  }
  return src.slice(start, end + 3);
}

const MODULE = [
  extractConst(gs, 'TRAVEL_FEE_ZONES_'),
  extractConst(gs, 'TRAVEL_KM_TABLE_'),
  gs.split('\n').find((l) => l.startsWith('const TRAVEL_FEE_BORDERLINE_KM_=')),
  gs.split('\n').find((l) => l.startsWith('const TRAVEL_LOCATION_VAGUE_RE_=')),
  extractFn(gs, 'travelFeeZoneForKm_'),
  extractFn(gs, 'travelFeeBorderlineNote_'),
  extractFn(gs, 'travelKmLookup_'),
].join('\n');

const api = new Function(`${MODULE}\nreturn {TRAVEL_FEE_ZONES_,TRAVEL_KM_TABLE_,TRAVEL_FEE_BORDERLINE_KM_,TRAVEL_LOCATION_VAGUE_RE_,travelFeeZoneForKm_,travelFeeBorderlineNote_,travelKmLookup_};`)();

let failed = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { failed += 1; console.error(`  ✗ ${label}\n      기대: ${JSON.stringify(expected)}\n      실제: ${JSON.stringify(actual)}`); }
  else console.log(`  ✓ ${label}`);
};

console.log('■ 존 경계 (정책: ~30km 무료 / 30–60 €30 / 60–100 €70 / 100+ 상담)');
[
  [0, 1, 0], [17, 1, 0], [29.9, 1, 0], [30, 1, 0],
  [30.1, 2, 30], [46, 2, 30], [60, 2, 30],
  [60.1, 3, 70], [92.4, 3, 70], [100, 3, 70],
  [100.1, 4, null], [170, 4, null], [1000, 4, null],
].forEach(([km, zone, fee]) => {
  const z = api.travelFeeZoneForKm_(km);
  check(`${km}km → 존${zone} / ${fee === null ? '상담' : '€' + fee}`, [z.zone, z.fee], [zone, fee]);
});
check('음수 km → 판정 불가(null)', api.travelFeeZoneForKm_(-1), null);
check('숫자 아님 → 판정 불가(null)', api.travelFeeZoneForKm_('abc'), null);

console.log('■ 경계 ±10km 는 단정하지 않는다');
[
  [92.4, '존3/존4 경계 — 실제 주소로 확인 필요'],   // 하이델베르크 — €40 손실을 낸 그 케이스
  [100, '존3/존4 경계 — 실제 주소로 확인 필요'],
  [25, '존1/존2 경계 — 실제 주소로 확인 필요'],
  [55, '존2/존3 경계 — 실제 주소로 확인 필요'],
  [46, ''],                                        // 비스바덴 — 경계 아님
  [17, ''],                                        // 프랑크푸르트 — 경계 아님
  [170, ''],                                       // 쾰른 — 경계 아님
].forEach(([km, note]) => check(`${km}km 경계문구`, api.travelFeeBorderlineNote_(km), note));

console.log('■ 뭉뚱그린 주소는 저신뢰 처리 대상으로 잡힌다');
[
  ['프랑크푸르트 시내', true],
  ['협의 후 결정', true],
  ['프랑크푸르트 근교- 미팅 진행하고 결정하려고 합니다', true],
  ['뢰머광장 + 마인강변 또는 알테오퍼 중 택 1', true],
  ['프랑크푸르트 시내(뢰머광장 등)', true],
  ['Heidelberg, Deutschland', false],
  ['Mainz', false],
  ['Schloss Vollrads 1, 65375 Oestrich-Winkel', false],
  ['Bansastraße 29, 63263 Neu-Isenburg', false],
  ['뢰머광장 (Römerberg, Frankfurt)', false],
].forEach(([loc, vague]) => check(`"${loc}" → ${vague ? '모호' : '구체적'}`, api.TRAVEL_LOCATION_VAGUE_RE_.test(loc), vague));

console.log('■ 도시 폴백표 ↔ 정책 문서 거리표');
[
  ['하이델베르크', 'Heidelberg', 100, 3],
  ['비스바덴', 'Wiesbaden', 46, 2],
  ['쾰른', 'Köln', 170, 4],
  ['프랑크푸르트', 'Frankfurt am Main', 17, 1],
  ['코블렌츠', 'Koblenz', 125, 4],
  ['풀다', 'Fulda', 105, 4],
  // 한글 표기 — 예약 메모의 촬영장소는 대개 한글이라 이게 폴백의 실사용 경로다
  ['하이델베르크(한글)', '하이델베르크 근처 어딘가', 100, 3],
  ['프랑크푸르트(한글)', '프랑크푸르트 시내', 17, 1],
  ['프랑크푸르트 공항이 시내보다 먼저', '프랑크푸르트 공항 근처', 25, 1],
  ['비스바덴(한글)', '비스바덴 일대', 46, 2],
  ['쾰른(한글)', '쾰른 시내', 170, 4],
].forEach(([city, query, km, zone]) => {
  const hit = api.travelKmLookup_(query);
  check(`${city}(${query}) → ${km}km / 존${zone}`, [hit && hit.km, hit && api.travelFeeZoneForKm_(hit.km).zone], [km, zone]);
});

console.log('■ 코드 상수 ↔ docs/travel-fee-policy.md 금액 일치');
check('존2 금액이 문서에 €30 으로 적혀 있다', /\|\s*2\s*\|[^|]*\|\s*\*\*\+€30\*\*/.test(doc), true);
check('존3 금액이 문서에 €70 으로 적혀 있다', /\|\s*3\s*\|[^|]*\|\s*\*\*\+€70\*\*/.test(doc), true);
check('코드 존 금액 = [0, 30, 70, null]', api.TRAVEL_FEE_ZONES_.map((z) => z.fee), [0, 30, 70, null]);
check('코드 존 경계 = [30, 60, 100, ∞]', api.TRAVEL_FEE_ZONES_.map((z) => z.toKm), [30, 60, 100, null]);
check('경계 유예 = ±10km', api.TRAVEL_FEE_BORDERLINE_KM_, 10);


/* ── 브리핑 출장비 누락 경고 — _scanTravelFeeGaps_ 를 원본 그대로 떼어내 가짜 시트 위에서 돌린다.
   경고가 **뜨는 것**과 **안 뜨는 것**을 둘 다 못박는다. 오탐이 하나라도 있으면 이 섹션은
   그날로 무시당하므로, 제외 조건이 하나 풀리면 여기서 깨져야 한다. */
const HEADERS_LINE = gs.split('\n').find((l) => l.includes("BOOKING_HEADERS: ['예약일시'"));
if (!HEADERS_LINE) throw new Error('BOOKING_HEADERS 를 찾지 못했습니다.');

const SCAN_MODULE = [
  `const CONFIG={TIMEZONE:'Europe/Berlin',${HEADERS_LINE.trim().replace(/,$/, '')}};`,
  'const BOOKING_COL=CONFIG.BOOKING_HEADERS.reduce((a,h,i)=>{a[h]=i;return a;},{});',
  gs.split('\n').find((l) => l.startsWith('const TRAVEL_HEADERS=')),
  'const TRAVEL_COL=TRAVEL_HEADERS.reduce((a,h,i)=>{a[h]=i;return a;},{});',
  extractConst(gs, 'TRAVEL_FEE_ZONES_'),
  gs.split('\n').find((l) => l.startsWith('const TRAVEL_FEE_BORDERLINE_KM_=')),
  gs.split('\n').find((l) => l.startsWith('const TRAVEL_LOCATION_VAGUE_RE_=')),
  gs.split('\n').find((l) => l.startsWith('const TRAVEL_FEE_MENTION_RE_=')),
  extractFn(gs, 'travelFeeZoneForKm_'),
  extractFn(gs, 'isTravelBookingTypeRow_'),
  extractFn(gs, 'getWeekendSurcharge_'),
  extractFn(gs, 'isMyRealTripProduct_'),
  extractFn(gs, 'parseYmdDateAtNoon_'),
  extractFn(gs, 'parseMoneyValue_'),
  extractFn(gs, '_scanTravelFeeGaps_'),
  // 시트·GAS 계층만 가짜로 세운다 (판정 로직은 전부 원본)
  "const Utilities={formatDate:(d)=>d.toISOString().slice(0,10)};",
  "function parseDateSafe_(v){return {obj:new Date(v),str:String(v)};}",
  'let FAKE_LEDGER=[];let FAKE_PRODUCTS=[];',
  'function getCachedProducts_(){return FAKE_PRODUCTS;}',
  'function ensureTravelSheet_(){return null;}',
  `function ensureSheets_(){return {ss:null,travelSheet:{
     getLastRow:()=>FAKE_LEDGER.length+1,
     getRange:()=>({getValues:()=>FAKE_LEDGER})}};}`,
  'function setFixtures(l,p){FAKE_LEDGER=l;FAKE_PRODUCTS=p;}',
].join('\n');

const scan = new Function(`${SCAN_MODULE}\nreturn {_scanTravelFeeGaps_,setFixtures,TRAVEL_COL,BOOKING_COL,CONFIG,TRAVEL_HEADERS};`)();

const PRODUCTS = [
  { id: 'oprm', g: 'snap', nameKo: '야외/홈스냅 Premium', p: 350 },
  { id: 'op', g: 'snap', nameKo: '야외/홈스냅 Plus', p: 220 },
  { id: 'evp', g: 'biz', nameKo: '행사/이벤트 사진촬영 (상담 견적)', p: 0 },
];
const NOW = new Date('2026-08-26T09:00:00Z');
const bookingRow = (over) => {
  const r = new Array(scan.CONFIG.BOOKING_HEADERS.length).fill('');
  r[scan.BOOKING_COL['예약일시']] = '2026-10-12 14:00';
  r[scan.BOOKING_COL['상태']] = '확정됨';
  r[scan.BOOKING_COL['고객명']] = '테스트고객';
  r[scan.BOOKING_COL['촬영종류']] = 'snap';
  r[scan.BOOKING_COL['상품']] = '야외/홈스냅 Premium';
  r[scan.BOOKING_COL['총결제액']] = 350;
  Object.keys(over || {}).forEach((k) => { r[scan.BOOKING_COL[k]] = over[k]; });
  return r;
};
const ledgerRow = (bookingRowIndex, km, location, status = '계산완료') => {
  const r = new Array(scan.TRAVEL_HEADERS.length).fill('');
  r[scan.TRAVEL_COL['예약장부행']] = bookingRowIndex;
  r[scan.TRAVEL_COL['편도거리(km)']] = km;
  r[scan.TRAVEL_COL['촬영장소']] = location;
  r[scan.TRAVEL_COL['거리계산상태']] = status;
  return r;
};
// rows[0] 은 헤더, 예약은 rows[1] → 시트 행번호 2
const runScan = (over, ledger) => {
  scan.setFixtures(ledger, PRODUCTS);
  return scan._scanTravelFeeGaps_([[], bookingRow(over)], NOW);
};
const HEIDELBERG = [ledgerRow(2, 92.4, 'Heidelberg, Deutschland')];

console.log('■ 경고가 떠야 하는 경우');
const hit = runScan({}, HEIDELBERG);
check('존3 €70 미반영 → 경고 1건', hit.count, 1);
check('  경고 내용 (존/금액/km)', hit.items[0] && [hit.items[0].zone, hit.items[0].fee, hit.items[0].oneWayKm], [3, 70, 92.4]);
check('마인츠 50.6km 정가 그대로 → 존2 €30 경고',
  runScan({ 총결제액: 350 }, [ledgerRow(2, 50.6, 'Mainz')]).items.map((x) => [x.zone, x.fee]), [[2, 30]]);
check('쾰른 170km → 존4 경고(금액 없음 = 상담)',
  runScan({}, [ledgerRow(2, 170, 'Köln')]).items.map((x) => [x.zone, x.fee]), [[4, null]]);
check('토요일 할증 €40 만 얹힌 총액 €390 → 여전히 경고',
  runScan({ 예약일시: '2026-10-17 14:00', 총결제액: 390 }, [ledgerRow(2, 92.4, 'Heidelberg')]).count, 1);

console.log('■ 침묵해야 하는 경우 (오탐 방지 — 하나라도 뚫리면 섹션 전체가 무시당한다)');
const silent = (label, over, ledger) => check(label, runScan(over, ledger).count, 0);
silent('존1(프랑크푸르트 26.6km) — 무료', {}, [ledgerRow(2, 26.6, 'Frankfurt')]);
silent('존1/존2 하단 경계(31.3km, Neu-Isenburg) — 무료일 수 있다', {}, [ledgerRow(2, 31.32, 'Bansastraße 29, 63263 Neu-Isenburg')]);
silent('존2/존3 하단 경계(65km)', {}, [ledgerRow(2, 65, 'Aschaffenburg')]);
silent('출장장부에 행이 없다 — 거리 미상', {}, []);
silent('거리계산 실패 행', {}, [ledgerRow(2, 92.4, 'Heidelberg', '계산실패: 경로를 찾지 못했습니다.')]);
silent('촬영장소가 모호하다', {}, [ledgerRow(2, 92.4, '하이델베르크 근교 협의 후 결정')]);
silent('총액이 정가보다 크다 — 뭐가 붙었는지 알 수 없다', { 총결제액: 380 }, HEIDELBERG);
silent('추가항목에 출장비 표기가 있다', { 추가항목: '출장비 €70' }, HEIDELBERG);
silent('요청사항에 Anfahrt 표기가 있다', { 요청사항: 'Anfahrtspauschale inkl.' }, HEIDELBERG);
silent('굿샤인 적용 건 — 할인으로 총액이 내려간다', { 굿샤인코드: 'ABCD-1234-EFGH' }, HEIDELBERG);
silent('마이리얼트립 — 계약 상품(정책 제외)', { 촬영종류: '마이리얼트립' }, HEIDELBERG);
silent('상담견적 상품(정가 0) — 판정 불가', { 상품: '행사/이벤트 사진촬영 (상담 견적)', 촬영종류: 'biz', 총결제액: 2800 }, HEIDELBERG);
silent('상품시트에 없는 커스텀 상품명(견적 파생)', { 상품: '웨딩 리포타주 — 10시간', 촬영종류: 'wed', 총결제액: 1950 }, HEIDELBERG);
silent('과거 예약 — 이미 지난 촬영', { 예약일시: '2026-08-10 14:00' }, HEIDELBERG);
silent('취소된 예약', { 상태: '취소됨' }, HEIDELBERG);
silent('촬영완료 예약', { 상태: '촬영완료' }, HEIDELBERG);
silent('총결제액 미입력', { 총결제액: '' }, HEIDELBERG);
silent('출장 성격이 아닌 촬영종류(여권)', { 촬영종류: 'pass', 상품: '여권/비자' }, HEIDELBERG);
check('대기중 예약도 대상이다', runScan({ 상태: '대기중' }, HEIDELBERG).count, 1);
check('출장장부가 비면 ledgerRows=0 으로 드러난다', runScan({}, []).ledgerRows, 0);

if (failed) { console.error(`\n❌ ${failed}건 불일치`); process.exit(1); }
console.log('\n✅ 존 판정 + 브리핑 경고 전 항목 통과');
