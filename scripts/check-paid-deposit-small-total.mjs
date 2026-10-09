#!/usr/bin/env node
/**
 * check-paid-deposit-small-total.mjs — 총액 €100 이하 + 이미 입금된 계약금 검사기 (2026-10-09)
 *
 * 왜 필요한가: getEffectiveBookingDeposit_ 가 총액 ≤ €100 이면 입금 여부와 상관없이 0 을 돌려줬다.
 *   '€100 이하 → 계약금 없음'은 *청구* 규칙인데, 굿샤인 적용·상품변경(@1016)으로 입금 뒤 총액이 100 이하로
 *   내려간 행(Studio Basic €50 입금 → Profile Basic 55 = 계약금 50·잔금 5)에서 받은 돈이 0 으로 보였다.
 *   그 결과 ① 어드민 '표시 정리'(cleanupBookingDepositFlags_)가 입금여부·입금일·입금금액을 **지웠고**
 *   ② force 재확인이 '예약금이 있는 예약만'으로 거부됐고 ③ 장부·현금장부·환불 상한이 입금금액 칸이 빈 행에서
 *   받은 계약금을 0 으로 셌고 ④ 결제검토가 잔금 칸이 빈 행에 총액 전액을 받을 돈으로 올렸다.
 *   지켜야 할 것: 입금여부가 정확히 'Y' 인 행만 계약금을 살린다 — 독촉·자동취소·보류 메일 경로는 전부 'Y' 를
 *   입금으로 보므로, 'Y' 가 아닌 표기('완료' 등)를 살리면 그 행이 10일째 자동취소된다.
 *
 * 어떻게: Code.gs 를 GAS 스텁 + 메모리 예약 시트와 통째로 로드해 진짜 함수를 돌린다.
 * 사용법:  node scripts/check-paid-deposit-small-total.mjs       (불일치 시 exit 1)
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
const dir = mkdtempSync(join(tmpdir(), 'paiddep-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${gs}
function getSettingsMap_(){return {};}
function assertAdmin_(){}
var __MAIL__=[];
function sendDepositReminderEmail_(r){__MAIL__.push('reminder:'+r);}
function autoCancelBookingForMissingDeposit_(r){__MAIL__.push('cancel:'+r);}
function sendDepositConfirmationEmail_(r){__MAIL__.push('confirm:'+r);return{sent:true};}
var __BOOK__=[];
var __SHEET__={
  getLastRow:function(){return __BOOK__.length;},
  getDataRange:function(){return{getValues:function(){return __BOOK__.map(function(r){return r.slice();});}};},
  getRange:function(r,c,nr,nc){return{
    getValues:function(){const out=[];for(let i=0;i<(nr||1);i++) out.push(__BOOK__[r-1+i].slice(c-1,c-1+(nc||1)));return out;},
    getValue:function(){return __BOOK__[r-1][c-1];},
    setValue:function(v){__BOOK__[r-1][c-1]=v;}};}};
function getDbSheet(){return __SHEET__;}
function ensureSheets_(){return {bookingSheet:__SHEET__};}
module.exports={getEffectiveBookingDeposit_,cleanupBookingDepositFlags_,confirmBookingDepositAdmin,
  getEffectiveBookingPayment_,flagAndCancelOverdueDepositBookings_,BOOKING_COL,
  __load__:function(rows){const blank=function(){return new Array(CONFIG.BOOKING_HEADERS.length).fill('');};
    __BOOK__=[blank().fill('h')].concat(rows.map(function(cells){const row=blank();
      Object.keys(cells).forEach(function(k){ if(BOOKING_COL[k]==null) throw new Error('없는 열: '+k); row[BOOKING_COL[k]]=cells[k]; });
      return row;}));
    __MAIL__=[];},
  __row__:function(r){return __BOOK__[r-1];},__mail__:function(){return __MAIL__.slice();}};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};
const row = (cells) => { const r = new Array(200).fill(''); Object.keys(cells).forEach((k) => { r[M.BOOKING_COL[k]] = cells[k]; }); return r; };
const cell = (r, k) => M.__row__(r)[M.BOOKING_COL[k]];
const daysAgo = (n) => fmt(Date.now() - n * 86400000, '', 'yyyy-MM-dd HH:mm:ss');
// 상품변경 @1016 결과 행 — Studio Basic €50 입금 → Profile Basic 55
const paidSmall = { '상태': '확정됨', '고객명': '테스트', '예약일시': '2026-10-14 10:00', '총결제액': 55, '계약금': 50, '잔금': 5, '계약금입금여부': 'Y' };

// ── ① 함수 진리표 ──────────────────────────────────────────────────────────────────
const dep = (cells) => M.getEffectiveBookingDeposit_(row(cells));
ok(dep(paidSmall) === 50, '총액 55 · 계약금 50 입금(Y) → 50 (받은 돈)', dep(paidSmall));
ok(dep({ '총결제액': 55, '계약금': 50 }) === 0, '총액 55 · 계약금 50 미입금 → 0 (€100 이하 청구 없음)', dep({ '총결제액': 55, '계약금': 50 }));
ok(dep({ '총결제액': 55, '계약금': 50, '계약금입금여부': '완료' }) === 0,
  "입금여부 '완료'(Y 아님) → 0 — 살리면 독촉·자동취소 경로('Y' 만 입금으로 봄)에 걸린다");
ok(dep({ '총결제액': 170, '계약금': 50 }) === 50, '총액 170 · 계약금 50 미입금 → 50 (종전 그대로)');
ok(dep({ '총결제액': 30, '계약금': '0|DB|2026-01-08', '계약금입금여부': 'Y' }) === 0, '레거시 계약금 셀 "0|DB|날짜" 입금 → 0');

// ── ② 어드민 '표시 정리'가 입금 기록을 지우지 않는다 ────────────────────────────────────
M.__load__([
  { ...paidSmall, '계약금입금일': '2026-10-01', '계약금입금금액': 50 },
  { '상태': '확정됨', '고객명': '정리대상', '예약일시': '2026-10-14 11:00', '총결제액': 30, '계약금': 0, '계약금입금여부': 'Y', '계약금입금일': '2026-10-01', '계약금입금금액': 30 },
]);
const cl = M.cleanupBookingDepositFlags_();
ok(cell(2, '계약금입금여부') === 'Y' && cell(2, '계약금입금일') === '2026-10-01' && cell(2, '계약금입금금액') === 50,
  '표시 정리: 총액 55 입금 계약금 50 행의 입금여부·입금일·입금금액 보존 (종전엔 지워짐)', [cell(2, '계약금입금여부'), cell(2, '계약금입금일'), cell(2, '계약금입금금액')]);
ok(cell(3, '계약금입금여부') === '' && cl.cleanedDepositPaidMarkers === 1, '표시 정리: 계약금 0 행의 잘못된 입금표시는 여전히 정리', cl);

// ── ③ force 재확인 ────────────────────────────────────────────────────────────────
M.__load__([{ ...paidSmall, '계약금입금일': '2026-10-01', '계약금입금금액': 50 }]);
let err = '';
try { M.confirmBookingDepositAdmin('t', 2, 50, { payMethod: '현금' }); } catch (e) { err = e.message; }
ok(/이미 예약금 입금이 확인된/.test(err), 'force 없는 재확인 → "이미 확인된" 거부', err);
let res = null; err = '';
try { res = M.confirmBookingDepositAdmin('t', 2, 50, { force: true, payMethod: '현금', paidDate: '2026-10-02' }); } catch (e) { err = e.message; }
ok(res && res.ok && cell(2, '계약금입금일') === '2026-10-02' && cell(2, '계약금입금금액') === 50 && !M.__mail__().length,
  'force 재확인 → 입금일 정정, 메일 없음 (종전 "예약금이 있는 예약만" 거부)', err || [cell(2, '계약금입금일'), M.__mail__()]);

// ── ④ 실수령액 — 입금금액 칸이 빈 입금 행 ───────────────────────────────────────────────
const pay = M.getEffectiveBookingPayment_(row(paidSmall));
ok(pay.depositPaidAmount === 50 && pay.paid === 50, '입금금액 칸 빈 입금 행: 받은 계약금 50 (종전 0 → 환불 상한·취소 보유금 0)', pay);
const payFull = M.getEffectiveBookingPayment_(row({ ...paidSmall, '잔금결제여부': 'Y' }));
ok(payFull.depositPaidAmount === 50 && payFull.balancePaidAmount === 5 && payFull.paid === 55, '완납: 계약금 50 + 잔금 5 = 55', payFull);

// ── ⑤ 독촉·자동취소 — 살아난 계약금이 미입금 경로를 타지 않는다 ─────────────────────────────
M.__load__([
  { ...paidSmall, '확정일시': daysAgo(20), '입금경고일시': daysAgo(12) },
  { ...paidSmall, '고객명': '완료표기', '계약금입금여부': '완료', '확정일시': daysAgo(20), '입금경고일시': daysAgo(12) },
  { '상태': '확정됨', '고객명': '대조군', '예약일시': '2026-10-14 12:00', '총결제액': 170, '계약금': 50, '잔금': 120, '확정일시': daysAgo(20), '입금경고일시': daysAgo(12) },
]);
M.flagAndCancelOverdueDepositBookings_();
ok(JSON.stringify(M.__mail__()) === JSON.stringify(['cancel:4']),
  '20일 경과: 입금(Y)·"완료" 표기 소액 행은 독촉·자동취소 없음, 미입금 대조군(170)만 자동취소', M.__mail__());

if (fail) {
  console.error(`✗ 소액 입금 계약금 — ${fail}건 실패`);
  process.exit(1);
}
console.log('✓ 소액 입금 계약금 — €100 이하라도 입금(Y) 계약금 유지: 표시 정리 보존·force 재확인·실수령액, 미입금·비 Y 는 0, 독촉·자동취소 무영향');
