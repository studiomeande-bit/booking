#!/usr/bin/env node
/**
 * check-change-product-context.mjs — 상품변경(booking-change-product) 재견적 검사기 (2026-10-08)
 *
 * 왜 필요한가: 상품변경이 예약행 맥락 없이 calculateQuote_ 를 불러 새 총액에서 할인이 조용히 사라졌다.
 *   키즈+재방문 프로필 Basic(40.5) → Business 가 95(정답 76.5), 굿샤인 €55 로 0 이 된 Basic → Business 가 95(정답 40).
 *   보드 '상품·인원 변경' 화면은 이 액션의 dryRun 값을 그대로 보여 주고 그 값이 장부에 써진다 — 깨지면 현장에서 더 받는다.
 *   지켜야 할 것: ① 연령(키즈·시니어)·재방문·웨딩 마케팅동의·얼리버드(예약 시점)·사업자 송장을 새 견적에 넘긴다
 *   ② 적용된 굿샤인 차감액을 새 총액에서 다시 빼고, 계약금은 굿샤인 규칙(차감 뒤 €100 이하+미입금 → 0)
 *   ③ 굿샤인이 새 총액보다 크면 거부(차액 소멸) ④ 옵션 열을 덮어써도 연령 표기가 남아 다음 재견적이 같은 할인
 *   ⑤ 감사줄이 실제로 쓴 총액을 적는다 ⑥ notify:false 면 메일 0.
 *   ⑦ 입금된 계약금은 받은 금액(계약금입금금액, 없으면 계약금 셀) 그대로, 잔금 = 새 총액 − 그 금액 — 새 상품 규칙값으로 덮지 않는다.
 *      받은 계약금 > 새 총액이면 거부(환불은 어드민, 사장님 결정 2026-10-09).
 *
 * 어떻게: Code.gs 를 GAS 스텁 + 메모리 예약 시트와 통째로 로드해 진짜 changeBookingProductForAgent_ 를 돌린다.
 *   카탈로그 단가는 라이브 '상품설정'(2026-10 products-list) 값을 입력으로, 기대 금액은 사업 사실로 고정한다
 *   (키즈 −€10, 재방문 10 %, 시니어 평일 Basic 무료·Business −€50, 웨딩 얼리버드 10 %+마케팅 5 %·계약금 20 %, 그 외 계약금 €50/€100 이하 0).
 * 사용법:  node scripts/check-change-product-context.mjs       (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(process.env.CHECK_CODE_GS || join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const fmt = (d, tz, p) => {
  const q = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return p.replace('yyyy', q.year).replace('MM', q.month).replace('dd', q.day).replace('HH', q.hour).replace('mm', q.minute).replace('ss', q.second);
};
const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁`); } });
Object.assign(globalThis, {
  Utilities: { formatDate: fmt, sleep() {} }, SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'),
  CalendarApp: nope('CalendarApp'), MailApp: nope('MailApp'), GmailApp: nope('GmailApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});
const dir = mkdtempSync(join(tmpdir(), 'chgprod-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${gs}
var __CAT__=[
  {id:'pass',g:'pass',t:'passport',p:30,d:15,prep:0,nameKo:'여권/비자'},
  {id:'pb',g:'prof',t:'single',p:55,d:15,prep:15,nameKo:'프로필 Basic'},
  {id:'pbus',g:'prof',t:'single',p:95,d:30,prep:15,nameKo:'프로필 Business'},
  {id:'pp',g:'prof',t:'single',p:130,d:60,prep:15,nameKo:'프로필 Professional'},
  {id:'sb',g:'stud',t:'group',p:170,d:30,prep:15,nameKo:'스튜디오 Basic'},
  {id:'sp',g:'stud',t:'group',p:240,d:60,prep:15,nameKo:'스튜디오 Plus'},
  {id:'wp',g:'wed',t:'single',p:650,d:240,prep:60,nameKo:'프리웨딩 Plus'},
  {id:'wprm',g:'wed',t:'single',p:1100,d:360,prep:60,nameKo:'프리웨딩 Premium'}
];
function getCachedProducts_(){return __CAT__;}
function getPromoProducts_(){return [];}
function getTfpProducts_(){return [];}
function getProductById_(id){const p=__CAT__.find(function(x){return x.id===id;}); if(!p) throw new Error('유효하지 않은 상품'); return p;}
function getSettingsMap_(){return {return_discount:'10',express_rate:'20'};}
function assertAdmin_(){}
function bumpCalCacheVer_(){}
function ensureBookingCalendarEventForRow_(){throw new Error('캘린더 없는 행인데 캘린더 동기화를 불렀다');}
var __MAIL__=0;
function sendBookingChangeNoticeEmail_(){__MAIL__++;return{sent:true};}
var __BOOK__=[];
function getDbSheet(){return{
  getLastRow:function(){return __BOOK__.length;},
  getRange:function(r,c,nr,nc){return{
    getValues:function(){return [__BOOK__[r-1].slice(c-1,c-1+(nc||1))];},
    getValue:function(){return __BOOK__[r-1][c-1];},
    setValue:function(v){__BOOK__[r-1][c-1]=v;}};}};}
module.exports={changeBookingProductForAgent_,parseBookingAgeGroupFromRow_,BOOKING_COL,
  __load__:function(cells){const row=new Array(CONFIG.BOOKING_HEADERS.length).fill('');
    Object.keys(cells).forEach(function(k){ if(BOOKING_COL[k]==null) throw new Error('없는 열: '+k); row[BOOKING_COL[k]]=cells[k]; });
    __BOOK__=[new Array(CONFIG.BOOKING_HEADERS.length).fill('h'),row]; __MAIL__=0; return 2;},
  __row__:function(){return __BOOK__[1];},__mail__:function(){return __MAIL__;}};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};
const cell = (k) => M.__row__()[M.BOOKING_COL[k]];
const base = { '상태': '확정됨', '고객명': '테스트', '인원': 1, '예약일시': '2026-10-14 10:00', '결제수단': '카드' };   // 수요일(토요일 할증 없음)
/** 행을 깔고 dryRun → 실제 쓰기. 둘 다 [총액, 계약금, 잔금] 이 기대와 같아야 한다 */
const change = (label, cells, payload, [total, deposit, balance]) => {
  const run = (dry) => {
    const rowIndex = M.__load__({ ...base, ...cells });
    try { return M.changeBookingProductForAgent_('t', { rowIndex, notify: false, dryRun: dry, ...payload }); }
    catch (e) { return { error: e.message }; }
  };
  const d = run(true);
  ok(d.total === total && d.deposit === deposit && d.balance === balance, `${label} (dryRun)`, d.error || [d.total, d.deposit, d.balance]);
  const w = run(false);
  ok(w.total === total && cell('총결제액') === total && cell('계약금') === deposit && cell('잔금') === balance,
    `${label} (장부 쓰기)`, w.error || [cell('총결제액'), cell('계약금'), cell('잔금')]);
  ok(M.__mail__() === 0, `${label}: notify:false 인데 메일`, M.__mail__());
  return w;
};

// ── ① 행 맥락 ───────────────────────────────────────────────────────────────────────
const kidsReturn = change('키즈+재방문 Basic 40.5 → Business = (95−10)×0.9 = 76.5',
  { '촬영종류': 'prof', '상품': '프로필 Basic', '추가항목': '촬영대상: 키즈', '재방문': '재방문', '총결제액': 40.5, '계약금': 0, '잔금': 40.5 },
  { itemId: 'pbus' }, [76.5, 0, 76.5]);
ok(/\[상품변경 \d{4}-\d{2}-\d{2}\] 프로필 Basic→프로필 Business, 40\.50→76\.50€ \(agent\)$/.test(cell('요청사항')),
  '감사줄 = 실제 쓴 총액(40.50→76.50)', cell('요청사항'));
change('웨딩 Plus → Premium, 마케팅동의 Y·예약 2026-08-01(촬영 7개월 전): 1100 −10 % −5 % = 935, 계약금 20 % 187',
  { '촬영종류': 'wed', '상품': '프리웨딩 Plus', '예약일시': '2027-03-01 10:00', '마케팅동의': 'Y', '동의시각': '2026-08-01 10:00:00',
    '총결제액': 552.5, '계약금': 110.5, '잔금': 442 },
  { itemId: 'wprm' }, [935, 187, 748]);
change('여권 법인 송장 4→5명: 가족할인 없음 5×30 = 150',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 4, '사업자송장필요': 'Y', '총결제액': 120, '잔금': 120 },
  { itemId: 'pass', people: 5 }, [150, 0, 150]);
change('여권 개인 4→5명: 가족할인 10 % → 135',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 4, '총결제액': 120, '잔금': 120 },
  { itemId: 'pass', people: 5 }, [135, 0, 135]);
change('시니어 평일 Business(45) → Basic: 평일 무료 €0 은 정당 — 거부하지 않는다',
  { '촬영종류': 'prof', '상품': '프로필 Business', '추가항목': '촬영대상: 시니어', '총결제액': 45, '잔금': 45 },
  { itemId: 'pb' }, [0, 0, 0]);

// ── ④ 어드민 포맷(연령이 옵션 열에만) — 상품변경이 옵션을 다시 써도 다음 재견적이 키즈를 본다 ────────────
{
  const rowIndex = M.__load__({ ...base, '촬영종류': 'prof', '상품': '프로필 Basic', '옵션': '촬영대상: 키즈 | 할인: 키즈 할인 -10€ 적용', '총결제액': 45, '잔금': 45 });
  const a = M.changeBookingProductForAgent_('t', { rowIndex, itemId: 'pbus', notify: false });
  ok(a.total === 85 && M.parseBookingAgeGroupFromRow_(M.__row__()) === 'kids', '어드민 키즈(옵션 열) Basic → Business 85, 옵션에 연령 유지',
    [a.total, cell('옵션')]);
  const b = M.changeBookingProductForAgent_('t', { rowIndex, itemId: 'pp', notify: false });
  ok(b.total === 120 && cell('계약금') === 50 && cell('잔금') === 70, '이어서 Business → Professional: 130−10 = 120 (계약금 50·잔금 70)',
    [b.total, cell('계약금'), cell('잔금'), cell('옵션')]);
}

// ── ② 굿샤인 ────────────────────────────────────────────────────────────────────────
const gs55 = change('굿샤인 €55 로 0 이 된 Basic → Business: 95 − 55 = 40',
  { '촬영종류': 'prof', '상품': '프로필 Basic', '총결제액': 0, '계약금': 0, '잔금': 0,
    '굿샤인코드': 'GS-TEST', '굿샤인차감금액': 55, '적용전총액': 55, '적용후총액': 0 },
  { itemId: 'pbus' }, [40, 0, 40]);
ok(gs55.gutscheinDiscount === 55 && cell('적용전총액') === 95 && cell('적용후총액') === 40 && cell('굿샤인차감금액') === 55,
  '굿샤인 적용 전/후 총액 = 새 상품 기준(95/40), 차감액 유지', [gs55.gutscheinDiscount, cell('적용전총액'), cell('적용후총액')]);
ok(/0→40€ \(agent, 굿샤인 −55€ 반영\)$/.test(cell('요청사항')), '감사줄에 굿샤인 반영 표기', cell('요청사항'));
change('굿샤인 €100 Studio Basic(70, 계약금 0) → Plus: 240 − 100 = 140, 계약금 50 · 잔금 90',
  { '촬영종류': 'stud', '상품': '스튜디오 Basic', '총결제액': 70, '계약금': 0, '잔금': 70, '굿샤인코드': 'GS-TEST', '굿샤인차감금액': 100 },
  { itemId: 'sp' }, [140, 50, 90]);
change('굿샤인 €100 Studio Plus(140, 계약금 50 미입금) → Basic: 170 − 100 = 70 ≤ 100 → 계약금 0 · 잔금 70',
  { '촬영종류': 'stud', '상품': '스튜디오 Plus', '총결제액': 140, '계약금': 50, '잔금': 90, '굿샤인코드': 'GS-TEST', '굿샤인차감금액': 100 },
  { itemId: 'sb' }, [70, 0, 70]);
change('굿샤인 €100 Studio Plus(140, 계약금 50 입금) → Basic: 170 − 100 = 70, 입금된 계약금 50 유지 · 잔금 20',
  { '촬영종류': 'stud', '상품': '스튜디오 Plus', '총결제액': 140, '계약금': 50, '계약금입금여부': 'Y', '잔금': 90, '굿샤인코드': 'GS-TEST', '굿샤인차감금액': 100 },
  { itemId: 'sb' }, [70, 50, 20]);
{
  const rowIndex = M.__load__({ ...base, '촬영종류': 'prof', '상품': '프로필 Business', '총결제액': 0, '잔금': 0, '굿샤인코드': 'GS-TEST', '굿샤인차감금액': 95 });
  let err = '';
  try { M.changeBookingProductForAgent_('t', { rowIndex, itemId: 'pb', notify: false, dryRun: true }); } catch (e) { err = e.message; }
  ok(/굿샤인/.test(err) && cell('상품') === '프로필 Business', '굿샤인 €95 > 새 총액 €55 → 거부(차액 소멸 방지), 장부 그대로', err);
}

// ── ⑦ 입금된 계약금 ─────────────────────────────────────────────────────────────────
const paid50 = { '계약금입금여부': 'Y', '계약금입금금액': 50 };
change('Studio Basic 170(€50 입금) → Profile Basic 55: 계약금 50 유지 · 잔금 5 (종전 0/55 = €50 이중 청구)',
  { '촬영종류': 'stud', '상품': '스튜디오 Basic', '총결제액': 170, '계약금': 50, '잔금': 120, ...paid50 },
  { itemId: 'pb' }, [55, 50, 5]);
change('웨딩 Plus 650(20 % €130 입금) → Premium 1100: 계약금 130 유지 · 잔금 970 (종전 220/880 = €90 누락)',
  { '촬영종류': 'wed', '상품': '프리웨딩 Plus', '총결제액': 650, '계약금': 130, '잔금': 520, '계약금입금여부': 'Y', '계약금입금금액': 130 },
  { itemId: 'wprm' }, [1100, 130, 970]);
change('입금금액 칸이 빈 입금 건 → 계약금 셀(50)을 받은 금액으로: Studio Basic → Plus 240 = 50 / 190',
  { '촬영종류': 'stud', '상품': '스튜디오 Basic', '총결제액': 170, '계약금': 50, '잔금': 120, '계약금입금여부': 'Y' },
  { itemId: 'sp' }, [240, 50, 190]);
change('입금금액(70)이 계약금 셀(50)과 다르면 받은 금액이 정본: Studio Basic → Plus 240 = 70 / 170',
  { '촬영종류': 'stud', '상품': '스튜디오 Basic', '총결제액': 170, '계약금': 50, '잔금': 100, '계약금입금여부': 'Y', '계약금입금금액': 70 },
  { itemId: 'sp' }, [240, 70, 170]);
for (const dryRun of [true, false]) {
  const rowIndex = M.__load__({ ...base, '촬영종류': 'stud', '상품': '스튜디오 Basic', '총결제액': 170, '계약금': 50, '잔금': 120, ...paid50 });
  let err = '';
  try { M.changeBookingProductForAgent_('t', { rowIndex, itemId: 'pass', notify: false, dryRun }); } catch (e) { err = e.message; }
  ok(/받은 계약금 €50.*€30/.test(err) && cell('상품') === '스튜디오 Basic' && cell('계약금') === 50 && cell('잔금') === 120,
    `받은 계약금 €50 > 여권 €30 → 거부(환불은 어드민), 장부 그대로 (dryRun:${dryRun})`, err || [cell('상품'), cell('계약금'), cell('잔금')]);
}

if (fail) {
  console.error(`✗ 상품변경 재견적 — ${fail}건 실패`);
  process.exit(1);
}
console.log('✓ 상품변경 재견적 — 키즈·재방문·시니어·웨딩 마케팅/얼리버드(예약 시점)·법인 송장, 굿샤인 차감·계약금·초과 거부, 입금 계약금 유지·초과 거부, 옵션 연령 유지, 감사줄, 무발송');
