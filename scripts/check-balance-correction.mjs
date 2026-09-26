#!/usr/bin/env node
/**
 * check-balance-correction.mjs — 확인된 잔금의 정정 · 분할 수령 · 조용한 불일치 방지 검증기
 *
 * 2026-09-09 나용민 워크인 실사고: 현금 €60 을 받았는데 내역은 본인 여권 €30 + 부인 여권 €30 선불
 * (별도 예약행)이었다. row273 총액을 60→30 으로 정정했는데도 9/9 현금장부가 €185(실물 €155).
 * 원인은 현금 파생행이 **잔금결제금액 셀을 우선**으로 보는데(getCashLedgerAdmin),
 *   ① confirmBookingBalanceAdmin 이 '이미 확인됨'이면 무조건 throw — 되돌릴 경로가 없고,
 *   ② setBookingAmountForAgent_ 은 총액·잔금만 갱신하며 잔금결제금액을 건드리지 않아
 *   ③ 잔금결제금액 60 이 고착 → 시트를 직접 열지 않으면 복구 불가.
 * 그리고 애초에 **잔금을 나눠 받는 일**(€30 선불 + €5 당일)을 기록할 방법이 없었다.
 *
 * 이 검사가 못박는 것:
 *   A 정정(force) — expectName 필수 · 이전값→새값 감사 스탬프 · 현금 파생행이 즉시 새 금액
 *   B 분할 수령 — 수령 이벤트마다 **그 날짜로** 현금행(레거시 행은 첫 이벤트로 씨딩)
 *   C 총액 하향 시 잔금결제금액 > 새 잔금이면 경고(조용한 어긋남 금지)
 *   R 기존 정상 건 무변동(이벤트 없는 행 · 카드 건 · 파이프 표기 잔금 · 기간 밖)
 *
 * 재구현이 아니라 Code.gs **원본 소스를 떼어내** 가짜 시트 위에서 돌린다. 현금 파생도 베껴 쓰지
 * 않고 파생 블록 원문을 추출해 평가하므로, 파생 규칙이 바뀌면 이 검사가 같이 움직인다.
 *
 * 사용법:  node scripts/check-balance-correction.mjs        (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
function extractLine(src, needle) {
  const line = src.split('\n').find((l) => l.includes(needle));
  if (!line) throw new Error(`${needle} 선언을 찾지 못했습니다.`);
  return line.trim();
}
// 현금장부의 잔금 파생 블록 — 원문 그대로 떼어낸다(베껴 쓰면 드리프트한다)
function extractBetween(src, startNeedle, endNeedle) {
  const a = src.indexOf(startNeedle);
  if (a < 0) throw new Error(`파생 블록 시작을 찾지 못했습니다: ${startNeedle}`);
  const b = src.indexOf(endNeedle, a);
  if (b < 0) throw new Error(`파생 블록 끝을 찾지 못했습니다: ${endNeedle}`);
  return src.slice(a, b);
}
const BALANCE_BLOCK = extractBetween(
  gs,
  "    const balancePaidAt=(parseDateSafe_(row[BOOKING_COL['잔금입금일']]).str||bookingDate).slice(0,10);",
  '    // 현금 환불 —'
);
if (!BALANCE_BLOCK.includes('bookingBalanceReceipts_(row,balancePaidAt)')) {
  throw new Error('현금장부 잔금 파생이 수령 이벤트를 쓰지 않습니다 — 블록이 바뀌었습니다.');
}

const bookingHeadersLine = extractLine(gs, "BOOKING_HEADERS: ['예약일시'").replace(/,$/, '');

const MODULE = [
  `const CONFIG={TIMEZONE:'Europe/Berlin',${bookingHeadersLine}};`,
  `const BOOKING_COL=CONFIG.BOOKING_HEADERS.reduce((a,h,i)=>{a[h]=i;return a;},{});`,
  extractLine(gs, 'const BOOKING_STATUS_CANCELLED'),
  extractLine(gs, 'const BOOKING_STATUS_POSTPONED'),
  `const Utilities={formatDate:(d,tz,f)=>{
     const p=(n)=>String(n).padStart(2,'0');
     const s=\`\${d.getFullYear()}-\${p(d.getMonth()+1)}-\${p(d.getDate())} \${p(d.getHours())}:\${p(d.getMinutes())}:\${p(d.getSeconds())}\`;
     return f.includes('HH')?s:s.slice(0,10);
   }};`,
  `const Logger={log:()=>{}};`,
  `class FakeSheet {
     constructor(headers,rows){ this.rows=[headers.slice()].concat(rows.map(r=>r.slice())); this.width=headers.length; }
     getLastRow(){ return this.rows.length; }
     getLastColumn(){ return this.width; }
     getDataRange(){ const self=this; return { getValues(){ return self.rows.map(r=>r.slice()); } }; }
     getRange(r,c,nr,nc){
       const self=this; const numRows=nr||1; const numCols=nc||1;
       return {
         getValues(){
           const out=[];
           for(let i=0;i<numRows;i++){
             const row=self.rows[r-1+i]||[];
             const line=[];
             for(let j=0;j<numCols;j++) line.push(row[c-1+j]!==undefined?row[c-1+j]:'');
             out.push(line);
           }
           return out;
         },
         getValue(){ const row=self.rows[r-1]||[]; return row[c-1]!==undefined?row[c-1]:''; },
         setValue(v){
           if(!self.rows[r-1]) self.rows[r-1]=new Array(self.width).fill('');
           self.rows[r-1][c-1]=v;
         }
       };
     }
   }`,
  extractFn(gs, 'normalizeBookingStatus_'),
  extractFn(gs, 'isBookingCancelledStatus_'),
  extractFn(gs, 'parseMoneyValue_'),
  extractFn(gs, 'roundCurrency_'),
  extractFn(gs, 'formatEuroAmount_'),
  extractFn(gs, 'isPaymentConfirmedValue_'),
  extractFn(gs, 'getEffectiveBookingDeposit_'),
  extractFn(gs, 'isCashPayMethod_'),
  extractFn(gs, 'makeCashLedgerEntry_'),
  extractFn(gs, 'agentBoolFlag_'),
  extractLine(gs, 'let _fastDateFmtOk_'),
  `const Session={getScriptTimeZone:()=>CONFIG.TIMEZONE};`,
  extractFn(gs, '_canFormatDateFast_'),
  extractFn(gs, 'formatDateMinuteFast_'),
  extractFn(gs, 'formatDateMinute_'),
  extractFn(gs, 'parseDateSafe_'),
  // 검증 대상 원본
  extractFn(gs, 'parseBookingBalanceReceipts_'),
  extractFn(gs, 'bookingBalanceReceipts_'),
  extractFn(gs, 'bookingBalanceReceiptsForWrite_'),
  extractFn(gs, 'writeBookingBalanceReceipts_'),
  extractFn(gs, 'assertBookingRowName_'),
  extractFn(gs, 'confirmBookingBalanceAdmin'),
  extractFn(gs, 'addBookingBalancePaymentAdmin'),
  extractFn(gs, 'setBookingAmountForAgent_'),
  // 시트/권한/캐시는 스텁 — 판정 로직은 원본 그대로 돈다
  `let __SHEET__=null;`,
  `function getDbSheet(){ return __SHEET__; }`,
  `function assertAdmin_(){ return true; }`,
  `function invalidateTodayBoardCache_(){}`,
  `function bumpCalCacheVer_(){}`,
  // 현금장부 잔금 파생 — Code.gs 원문 블록을 그대로 평가
  `function cashLedgerBalanceEntries_(row,r,bookingDate,inRange){
     const entries=[];
     const status=String(row[BOOKING_COL['상태']]||'').trim();
     const name=String(row[BOOKING_COL['고객명']]||'').trim();
     const product=String(row[BOOKING_COL['상품']]||'').trim();
     const total=parseMoneyValue_(row[BOOKING_COL['총결제액']]);
     const depositDue=getEffectiveBookingDeposit_(row);
${BALANCE_BLOCK}
     return entries;
   }`,
  `export {FakeSheet, CONFIG, BOOKING_COL, confirmBookingBalanceAdmin, addBookingBalancePaymentAdmin,
     setBookingAmountForAgent_, bookingBalanceReceipts_, cashLedgerBalanceEntries_};`,
  `export function __setSheet(s){ __SHEET__=s; }`,
].join('\n\n');

async function load(src) {
  const dir = mkdtempSync(join(tmpdir(), 'balcorr-'));
  const file = join(dir, 'mod.mjs');
  writeFileSync(file, src);
  try { return { mod: await import(pathToFileURL(file).href), dir }; }
  catch (e) { rmSync(dir, { recursive: true, force: true }); throw e; }
}

const failures = [];
function check(name, actual, expected) {
  const a = JSON.stringify(actual); const b = JSON.stringify(expected);
  if (a !== b) failures.push(`${name}\n    기대: ${b}\n    실제: ${a}`);
}
function threw(fn) { try { fn(); return ''; } catch (e) { return String(e.message || e); } }

const { mod: M, dir } = await load(MODULE);
try {
  const H = M.CONFIG.BOOKING_HEADERS;
  const C = M.BOOKING_COL;

  function makeRow(over) {
    const r = new Array(H.length).fill('');
    r[C['예약일시']] = '2026-09-09 10:00';
    r[C['상태']] = '촬영완료';
    r[C['고객명']] = '나용민';
    r[C['상품']] = '여권사진';
    r[C['총결제액']] = 30;
    r[C['계약금']] = 0;
    r[C['잔금']] = 30;
    r[C['결제수단']] = '현금';
    Object.keys(over || {}).forEach((k) => { r[C[k]] = over[k]; });
    return r;
  }
  function sheetOf(over) {
    const sh = new M.FakeSheet(H, [makeRow(over)]);
    M.__setSheet(sh);
    return sh;
  }
  // 현금장부 파생 — 실제 파생 블록 원문으로 (기간 전체)
  function cash(sh, from, to) {
    const row = sh.rows[1];
    const bookingDate = '2026-09-09';
    const inRange = (d) => (!from || d >= from) && (!to || d <= to);
    return M.cashLedgerBalanceEntries_(row, 1, bookingDate, inRange)
      .map((e) => ({ id: e.id, date: e.date, cashIn: e.cashIn }));
  }

  // ── A. 확인된 잔금의 정정 ────────────────────────────────────────────────
  // A-0 재현: 총 60 · 잔금결제금액 60 으로 확인된 행 (사고 당시 row273 상태)
  {
    const sh = sheetOf({ 총결제액: 60, 잔금: 60, 인원: 2 });
    M.confirmBookingBalanceAdmin('t', 2, { paidDate: '2026-09-09', amount: 60, payMethod: '현금' });
    check('A-0-1 첫 확인 결과 셀', [sh.rows[1][C['잔금결제여부']], sh.rows[1][C['잔금결제금액']], sh.rows[1][C['잔금입금일']]],
      ['Y', 60, '2026-09-09']);
    check('A-0-2 현금장부 €60', cash(sh), [{ id: 'booking-balance-2', date: '2026-09-09', cashIn: 60 }]);

    // 총액 정정 60 → 30 : C 요구사항 — 조용히 어긋나지 않는다
    const amt = M.setBookingAmountForAgent_('t', { rowIndex: 2, total: 30, expectName: '나용민', reason: '부인분 분리' });
    check('C-1 경고 1건', amt.warnings.length, 1);
    check('C-2 경고에 두 금액이 다 보인다', /60/.test(amt.warnings[0]) && /30/.test(amt.warnings[0]), true);
    check('C-3 감사메모에도 남는다', /⚠️ 잔금결제금액 60€ 미정정/.test(amt.auditLine), true);
    check('C-4 정정 전이라 현금장부는 아직 €60', cash(sh), [{ id: 'booking-balance-2', date: '2026-09-09', cashIn: 60 }]);

    // A-1 force 없이는 못 고친다(종전 동작 유지)
    check('A-1 force 없으면 차단', /이미 잔금 결제가 확인된/.test(
      threw(() => M.confirmBookingBalanceAdmin('t', 2, { paidDate: '2026-09-09', amount: 30 }))), true);
    // A-2 expectName 필수
    check('A-2 force+expectName 없음 차단', /expectName 이 필수/.test(
      threw(() => M.confirmBookingBalanceAdmin('t', 2, { paidDate: '2026-09-09', amount: 30, force: true }))), true);
    // A-3 이름 불일치 차단
    check('A-3 이름 불일치 차단', /행 고객명 불일치/.test(
      threw(() => M.confirmBookingBalanceAdmin('t', 2, { paidDate: '2026-09-09', amount: 30, force: true, expectName: '성원경' }))), true);

    // A-4 정정 성공
    const res = M.confirmBookingBalanceAdmin('t', 2, {
      paidDate: '2026-09-09', amount: 30, payMethod: '현금', force: 'true', expectName: '나용민', reason: '부인 여권 €30 은 별도 행'
    });
    check('A-4-1 잔금결제금액 60→30', sh.rows[1][C['잔금결제금액']], 30);
    check('A-4-2 응답 corrected/previousAmount', [res.corrected, res.previousAmount], [true, 60]);
    check('A-4-3 감사 스탬프', /^\[잔금정정 \d{4}-\d{2}-\d{2}\] 60→30€.* 사유: 부인 여권 €30 은 별도 행 \(agent\)$/.test(res.auditLine), true);
    check('A-4-4 요청사항에 남는다', String(sh.rows[1][C['요청사항']]).includes(res.auditLine), true);
    check('A-5 현금장부 즉시 €30', cash(sh), [{ id: 'booking-balance-2', date: '2026-09-09', cashIn: 30 }]);

    // C-5 정정 후 총액을 다시 손대도 경고 없음
    const amt2 = M.setBookingAmountForAgent_('t', { rowIndex: 2, total: 30, expectName: '나용민' });
    check('C-5 어긋남 없으면 무경고', [amt2.warnings.length, /⚠️/.test(amt2.auditLine)], [0, false]);
  }

  // ── B. 분할 수령 ─────────────────────────────────────────────────────────
  // B-0 재현: 성원경 여권 €35 — 9/9 €30 선불 + 9/11 €5 잔여
  {
    const sh = sheetOf({ 고객명: '성원경', 예약일시: '2026-09-11 10:00', 총결제액: 35, 잔금: 35 });
    M.confirmBookingBalanceAdmin('t', 2, { paidDate: '2026-09-09', amount: 30, payMethod: '현금' });
    const add = M.addBookingBalancePaymentAdmin('t', 2, {
      expectName: '성원경', paidDate: '2026-09-11', amount: 5, payMethod: '현금', reason: '촬영당일 잔여 수령'
    });
    check('B-1 잔금결제금액 누계 35', sh.rows[1][C['잔금결제금액']], 35);
    check('B-2 잔금입금일은 마지막 수령일', sh.rows[1][C['잔금입금일']], '2026-09-11');
    check('B-3 응답 누계', [add.previousBalancePaidAmount, add.added, add.balancePaidAmount], [30, 5, 35]);
    check('B-4 현금장부가 날짜별로 쪼개진다', cash(sh), [
      { id: 'booking-balance-2', date: '2026-09-09', cashIn: 30 },
      { id: 'booking-balance-2-2', date: '2026-09-11', cashIn: 5 },
    ]);
    check('B-5 9/9 만 보면 €30', cash(sh, '2026-09-09', '2026-09-09'), [{ id: 'booking-balance-2', date: '2026-09-09', cashIn: 30 }]);
    check('B-6 9/11 만 보면 €5', cash(sh, '2026-09-11', '2026-09-11'), [{ id: 'booking-balance-2-2', date: '2026-09-11', cashIn: 5 }]);
    check('B-7 감사메모 누적 스탬프', /^\[잔금추가수령 \d{4}-\d{2}-\d{2}\] \+5€ \(2026-09-11 · 현금\) 누계 30→35€/.test(add.auditLine), true);
    check('B-8 초과수령 아님', add.warnings.length, 0);
    check('B-9 expectName 필수', /expectName 이 필수/.test(
      threw(() => M.addBookingBalancePaymentAdmin('t', 2, { paidDate: '2026-09-11', amount: 5 }))), true);
  }
  // B-10 레거시 행(이벤트 없음, 셀만 있음)에 추가 수령 → 첫 이벤트로 씨딩되어 날짜가 안 끌려간다
  {
    const sh = sheetOf({ 고객명: '성원경', 총결제액: 35, 잔금: 35, 잔금결제여부: 'Y', 잔금결제금액: 30, 잔금입금일: '2026-09-09' });
    M.addBookingBalancePaymentAdmin('t', 2, { expectName: '성원경', paidDate: '2026-09-11', amount: 5 });
    check('B-10 레거시 씨딩 합계', sh.rows[1][C['잔금결제금액']], 35);
    check('B-11 레거시 첫 수령이 9/9 에 남는다', cash(sh), [
      { id: 'booking-balance-2', date: '2026-09-09', cashIn: 30 },
      { id: 'booking-balance-2-2', date: '2026-09-11', cashIn: 5 },
    ]);
  }
  // B-12 수단이 섞이면 현금 회차만 현금장부에
  {
    const sh = sheetOf({ 총결제액: 35, 잔금: 35 });
    M.confirmBookingBalanceAdmin('t', 2, { paidDate: '2026-09-09', amount: 30, payMethod: '현금' });
    M.addBookingBalancePaymentAdmin('t', 2, { expectName: '나용민', paidDate: '2026-09-11', amount: 5, payMethod: '카드' });
    check('B-12 카드 회차는 제외', cash(sh), [{ id: 'booking-balance-2', date: '2026-09-09', cashIn: 30 }]);
    check('B-13 합계는 그대로 35', sh.rows[1][C['잔금결제금액']], 35);
  }
  // B-14 총결제액 초과 수령이면 경고
  {
    const sh = sheetOf({ 총결제액: 30, 잔금: 30 });
    M.confirmBookingBalanceAdmin('t', 2, { paidDate: '2026-09-09', amount: 30, payMethod: '현금' });
    const add = M.addBookingBalancePaymentAdmin('t', 2, { expectName: '나용민', paidDate: '2026-09-11', amount: 5 });
    check('B-14 초과수령 경고', add.warnings.length, 1);
  }

  // ── R. 기존 정상 건 회귀 ─────────────────────────────────────────────────
  // R-1 김혜수형: 이벤트 없이 확인만 된 현금 건 — 종전 단일 파생 그대로
  {
    const sh = sheetOf({ 고객명: '김혜수', 예약일시: '2026-08-29 11:00', 상태: '촬영완료', 총결제액: 310,
      계약금: 50, 잔금: 260, 잔금결제여부: 'Y', 잔금결제금액: 260, 잔금입금일: '2026-08-29', 결제수단: '현금' });
    check('R-1 단일 현금행', cash(sh), [{ id: 'booking-balance-2', date: '2026-08-29', cashIn: 260 }]);
  }
  // R-2 잔금결제금액 공란 + 촬영완료 → 잔금 폴백(종전 동작)
  {
    const sh = sheetOf({ 상태: '촬영완료', 총결제액: 310, 계약금: 50, 잔금: 260, 잔금입금일: '2026-08-29' });
    check('R-2 잔금 셀 폴백', cash(sh), [{ id: 'booking-balance-2', date: '2026-08-29', cashIn: 260 }]);
  }
  // R-3 잔금 셀이 '260|CARD|…' 파이프 표기면 총액−계약금 폴백(종전 동작)
  {
    const sh = sheetOf({ 상태: '촬영완료', 총결제액: 310, 계약금: 50, 잔금: '260|CASH|2026-08-29', 잔금입금일: '2026-08-29' });
    check('R-3 파이프 표기 폴백', cash(sh), [{ id: 'booking-balance-2', date: '2026-08-29', cashIn: 260 }]);
  }
  // R-4 카드 건은 현금장부 미편입
  {
    const sh = sheetOf({ 결제수단: 'CARD', 잔금결제여부: 'Y', 잔금결제금액: 30, 잔금입금일: '2026-09-09' });
    check('R-4 카드 미편입', cash(sh), []);
  }
  // R-5 기간 밖 미편입
  {
    const sh = sheetOf({ 잔금결제여부: 'Y', 잔금결제금액: 30, 잔금입금일: '2026-09-09' });
    check('R-5 기간 밖', cash(sh, '2026-09-10', '2026-09-30'), []);
  }
  // R-6 미확인·미완료 상태는 파생 없음
  {
    const sh = sheetOf({ 상태: '확정됨', 잔금결제여부: '', 잔금결제금액: '' });
    check('R-6 미확인 무파생', cash(sh), []);
  }
  // R-7 취소 예약은 정정·추가 수령 모두 차단
  {
    sheetOf({ 상태: '취소됨', 잔금결제여부: 'Y', 잔금결제금액: 30 });
    check('R-7-1 정정 차단', /취소된 예약/.test(
      threw(() => M.confirmBookingBalanceAdmin('t', 2, { paidDate: '2026-09-09', amount: 30, force: true, expectName: '나용민' }))), true);
    check('R-7-2 추가수령 차단', /취소된 예약/.test(
      threw(() => M.addBookingBalancePaymentAdmin('t', 2, { expectName: '나용민', paidDate: '2026-09-09', amount: 5 }))), true);
  }
  // R-8 날짜·금액 형식 가드는 종전대로
  {
    sheetOf({});
    check('R-8-1 날짜 형식', /결제일 형식/.test(
      threw(() => M.confirmBookingBalanceAdmin('t', 2, { paidDate: '09/09/2026', amount: 30 }))), true);
    check('R-8-2 추가수령 금액 0 차단', /0보다 커야/.test(
      threw(() => M.addBookingBalancePaymentAdmin('t', 2, { expectName: '나용민', paidDate: '2026-09-09', amount: 0 }))), true);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`❌ ${failures.length}건 불일치\n\n  ` + failures.join('\n\n  '));
  process.exit(1);
}
console.log('✅ 잔금 정정·분할 수령·불일치 경고 검증 통과');
