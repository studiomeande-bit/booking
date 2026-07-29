#!/usr/bin/env node
/**
 * check-refund-rules.mjs — 환불 이벤트 기록·규정 제안 규칙 검증기
 *
 * 환불은 돈이 나가는 되돌리기 어려운 기록이고, 장부(ELSTER 분기 숫자의 참조점)까지 닿는다.
 * Code.gs 의 recordBookingRefund_ / calcCancellationRefundQuote_ / getEffectiveBookingPayment_
 * **원본 소스를 그대로 떼어내** 가짜 시트 위에서 돌린다(재구현 아님 — 규칙이 바뀌면 여기서 깨진다).
 *
 * 사용법:  node scripts/check-refund-rules.mjs        (불일치 시 exit 1)
 */
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
function extractLine(src, prefix) {
  const line = src.split('\n').find((l) => l.trimStart().startsWith(prefix));
  if (!line) throw new Error(`${prefix} 선언을 찾지 못했습니다.`);
  return line;
}
// BOOKING_HEADERS 는 CONFIG 리터럴 안의 한 줄
const headersLine = gs.split('\n').find((l) => l.includes("BOOKING_HEADERS: ['예약일시'"));
if (!headersLine) throw new Error('BOOKING_HEADERS 를 찾지 못했습니다.');

const MODULE = [
  `const CONFIG={TIMEZONE:'Europe/Berlin',${headersLine.trim().replace(/,$/, '')}};`,
  `const BOOKING_COL=CONFIG.BOOKING_HEADERS.reduce((a,h,i)=>{a[h]=i;return a;},{});`,
  `const Utilities={formatDate:(d,tz,f)=>{
     const p=(n)=>String(n).padStart(2,'0');
     const s=\`\${d.getFullYear()}-\${p(d.getMonth()+1)}-\${p(d.getDate())} \${p(d.getHours())}:\${p(d.getMinutes())}:\${p(d.getSeconds())}\`;
     return f.includes('HH')?s:s.slice(0,10);
   }};`,
  `const Logger={log:()=>{}};`,
  extractFn(gs, 'roundCurrency_'),
  extractFn(gs, 'formatEuroAmount_'),
  extractFn(gs, 'parseMoneyValue_'),
  extractFn(gs, 'isPaymentConfirmedValue_'),
  // parseDateSafe_ 의존 — GAS 전용 fast-path 는 스텁으로 대체
  `function formatDateMinute_(d){ return Utilities.formatDate(d,CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm'); }`,
  extractFn(gs, 'parseDateSafe_'),
  // getEffectiveBookingDeposit_ 의존 — 단순 스텁: 계약금 컬럼 그대로
  `function getEffectiveBookingDeposit_(row){ return parseMoneyValue_(row[BOOKING_COL['계약금']]); }`,
  extractLine(gs, 'var BOOKING_REFUND_METHODS_='),
  extractFn(gs, 'parseBookingRefunds_'),
  extractFn(gs, 'bookingRefundTotal_'),
  extractFn(gs, 'getEffectiveBookingPayment_'),
  extractFn(gs, 'recordBookingRefund_'),
  extractFn(gs, 'calcCancellationRefundQuote_'),
  // 환불 취소(무효화) — ensureSheets_/LockService/assertAdmin_ 는 스텁, 판정 로직은 원본
  `function assertAdmin_(){ return true; }
   const LockService={ getScriptLock:()=>({ tryLock:()=>true, releaseLock:()=>{} }) };
   let __VROW__=null;
   function ensureSheets_(){ return { bookingSheet:{
     getLastRow:()=>2,
     getRange:(r,c)=>({ getValues:()=>[__VROW__], setValue:(v)=>{ __VROW__[c-1]=v; } })
   } }; }`,
  extractFn(gs, 'voidBookingRefundAdmin'),
  `export function runVoid(rowObj,payload){
     __VROW__=makeRow(rowObj);
     try{ const res=voidBookingRefundAdmin('tok',2,payload||{}); return {ok:true,res,json:__VROW__[BOOKING_COL['환불내역JSON']],cum:__VROW__[BOOKING_COL['환불누계금액']]}; }
     catch(e){ return {ok:false,error:e.message}; }
   }`,
  `export function makeRow(o){
     const row=new Array(CONFIG.BOOKING_HEADERS.length).fill('');
     for(const k in o) row[BOOKING_COL[k]]=o[k];
     return row;
   }`,
  `export function runRefund(rowObj,event){
     const row=makeRow(rowObj);
     const written={};
     const sheets={bookingSheet:{getRange:(r,c,nr,nc)=>({
       getValues:()=>[row],
       setValue:(v)=>{ written[CONFIG.BOOKING_HEADERS[c-1]]=v; }
     })}};
     try{
       const res=recordBookingRefund_(sheets,2,event);
       return {ok:true,res,written};
     }catch(e){ return {ok:false,error:e.message,written}; }
   }`,
  `export function runQuote(rowObj){ return calcCancellationRefundQuote_(makeRow(rowObj)); }`,
  // SumUp 환불 대조 — 가짜 예약 시트 위에서 원본 매처를 돌린다
  extractFn(gs, 'parseDateOnly_'),   // daysBetweenDates_ 의존
  extractFn(gs, 'daysBetweenDates_'),
  extractFn(gs, 'matchSumupRefundToRefundEvents_'),
  `export function runMatch(rowObjs,tx){
     const rows=[new Array(CONFIG.BOOKING_HEADERS.length).fill('')].concat(rowObjs.map(makeRow));
     const sh={getDataRange:()=>({getValues:()=>rows})};
     return matchSumupRefundToRefundEvents_(tx,sh);
   }`
].join('\n\n');

const dir = mkdtempSync(join(tmpdir(), 'refund-'));
let runRefund;
let runQuote;
let runMatch;
let runVoid;
try {
  writeFileSync(join(dir, 'core.mjs'), MODULE);
  ({ runRefund, runQuote, runMatch, runVoid } = await import(pathToFileURL(join(dir, 'core.mjs')).href));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const fails = [];
const check = (name, cond, detail) => { if (!cond) fails.push(`[${name}] ${detail}`); };

/* ── 기록 규칙 ── */
// 기본 케이스: 총 170, 계약금 170 입금(Y) → 실수령 170. 부분환불 50 성공.
const paidRow = { '총결제액': 170, '계약금': 170, '계약금입금여부': 'Y', '계약금입금금액': 170, '고객명': 'T', '이메일': 'x@y.z', '언어': 'ko' };
let r = runRefund(paidRow, { amount: 50, method: 'bank', reason: 't' });
check('부분환불 기록', r.ok === true, `실패: ${r.error}`);
check('부분환불 누계', r.ok && r.res.totalRefund === 50 && r.res.remaining === 120, r.ok ? `누계 ${r.res.totalRefund}/잔여 ${r.res.remaining}` : '');
check('JSON 기록', r.ok && String(r.written['환불내역JSON'] || '').includes('"amount":50'), 'JSON 미기록');
check('누계 컬럼', r.ok && r.written['환불누계금액'] === 50, `누계컬럼=${r.written['환불누계금액']}`);

// 상한: 실수령 170 인데 200 환불 → 거부
r = runRefund(paidRow, { amount: 200, method: 'bank' });
check('실수령 초과 거부', r.ok === false && /초과/.test(r.error || ''), `ok=${r.ok} err=${r.error}`);

// 누적 상한: 기환불 150 + 새 환불 50 → 거부
const partRefunded = { ...paidRow, '환불내역JSON': JSON.stringify([{ ts: 'x', payoutDate: '2026-07-01', amount: 150, method: 'bank', type: 'refund' }]) };
r = runRefund(partRefunded, { amount: 50 });
check('누적 상한 거부', r.ok === false, `기환불 150+50 이 통과됨`);
r = runRefund(partRefunded, { amount: 20 });
check('누적 잔여 내 허용', r.ok === true && r.res.totalRefund === 170, r.ok ? `누계 ${r.res.totalRefund}` : r.error);

// 결제 기록이 없으면(실수령 0) 환불 거부
r = runRefund({ '총결제액': 170, '계약금': 170, '고객명': 'T' }, { amount: 10 });
check('실수령 0 거부', r.ok === false, '결제 기록 없는데 환불 통과');

// 0원 환불 거부 / forfeit 은 0원 허용 + 누계 미포함
r = runRefund(paidRow, { amount: 0 });
check('0원 환불 거부', r.ok === false, '0원 환불 통과');
r = runRefund(paidRow, { amount: 0, type: 'forfeit' });
check('forfeit 기록', r.ok === true && r.res.totalRefund === 0, r.ok ? `forfeit 누계 ${r.res.totalRefund}` : r.error);

// 미지 수단 → bank 폴백
r = runRefund(paidRow, { amount: 10, method: '오타' });
check('미지 수단 폴백', r.ok === true && r.res.event.method === 'bank', r.ok ? r.res.event.method : r.error);

// 굿샤인 복원: 현금이 아니므로 실수령 0 이어도 기록되고, 누계에 안 잡힌다
r = runRefund({ '총결제액': 170, '계약금': 100, '고객명': 'T' }, { amount: 100, type: 'gutschein_restore', method: 'gutschein' });
check('복원 기록(캡 미적용)', r.ok === true, r.error || '');
check('복원 누계 제외', r.ok && r.res.totalRefund === 0 && r.written['환불누계금액'] === 0, r.ok ? `누계 ${r.res.totalRefund}` : '');
// 복원 이벤트가 있어도 현금 환불 상한은 그대로 실수령 기준
const withRestore = { ...paidRow, '환불내역JSON': JSON.stringify([{ ts: 'x', payoutDate: '2026-07-01', amount: 100, method: 'gutschein', type: 'gutschein_restore' }]) };
r = runRefund(withRestore, { amount: 170 });
check('복원 후 현금 상한 유지', r.ok === true && r.res.totalRefund === 170, r.ok ? `누계 ${r.res.totalRefund}` : r.error);
r = runRefund(withRestore, { amount: 171 });
check('복원 후 현금 초과 거부', r.ok === false, '171 통과됨');

// Y 플래그인데 금액 미기재 → due 폴백 (장부와 동일 규칙)
r = runRefund({ '총결제액': 170, '계약금': 100, '계약금입금여부': 'Y', '고객명': 'T' }, { amount: 100 });
check('Y+금액미기재 due 폴백', r.ok === true, r.error || '');
r = runRefund({ '총결제액': 170, '계약금': 100, '계약금입금여부': 'Y', '고객명': 'T' }, { amount: 101 });
check('due 폴백 상한', r.ok === false, '100 실수령인데 101 통과');

/* ── 규정 제안 ── */
const mk = (daysFromNow, extra) => {
  const d = new Date(Date.now() + daysFromNow * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return { '예약일시': `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 10:00`, '총결제액': 170, '계약금': 100, '계약금입금여부': 'Y', '계약금입금금액': 100, ...(extra || {}) };
};
const q = (days, extra) => runQuote(mk(days, extra));
check('일반 30일+ 100%', q(45).rate === 1, `rate=${q(45).rate}`);
check('일반 8~29일 50%', q(15).rate === 0.5 && q(15).suggested === 50, `rate=${q(15).rate} sug=${q(15).suggested}`);
check('일반 2~7일 25%', q(5).rate === 0.25, `rate=${q(5).rate}`);
check('일반 전일·당일 0%', q(1).rate === 0 && q(0).rate === 0, `rate1=${q(1).rate} rate0=${q(0).rate}`);
check('웨딩 60일+ 100%', q(70, { '촬영종류': 'wed' }).rate === 1, '');
check('웨딩 30~59일 70%', q(40, { '촬영종류': 'wed' }).rate === 0.7, `rate=${q(40, { '촬영종류': 'wed' }).rate}`);
check('웨딩 14~29일 50%', q(20, { '촬영종류': 'wed' }).rate === 0.5, '');
check('웨딩 7~13일 30%', q(10, { '촬영종류': 'wed' }).rate === 0.3, '');
check('웨딩 6일~당일 0%', q(3, { '촬영종류': 'wed' }).rate === 0, '');
// 잔금까지 냈으면 잔금분은 100% + 계약금분만 요율
const full = q(15, { '잔금결제여부': 'Y', '잔금결제금액': 70 });
check('잔금 100% + 계약금 요율', full.suggested === 120, `sug=${full.suggested} (기대 70+50)`);

/* ── SumUp 환불 거래 대조 ── */
const evRow = (events, name) => ({ '고객명': name || 'M', '환불내역JSON': JSON.stringify(events) });
const sumupEv = (over) => ({ ts: 't1', payoutDate: '2026-07-20', amount: 50, method: 'sumup', type: 'refund', ...(over || {}) });
const tx = (over) => ({ gross: -50, date: '2026-07-22', paymentRef: 'TXABC', ...(over || {}) });

let m = runMatch([evRow([sumupEv()])], tx());
check('대조: 정확 매칭', m && m.linked === false && m.rowIndex === 2, JSON.stringify(m));
m = runMatch([evRow([sumupEv({ amount: 49 })])], tx());
check('대조: 금액 불일치 제외', m === null, JSON.stringify(m));
m = runMatch([evRow([sumupEv({ payoutDate: '2026-07-01' })])], tx());
check('대조: ±10일 창 밖 제외', m === null, JSON.stringify(m));
m = runMatch([evRow([sumupEv({ method: 'bank' })])], tx());
check('대조: 수단 sumup 아니면 제외', m === null, JSON.stringify(m));
m = runMatch([evRow([sumupEv({ sumupTxRef: 'OTHER' })])], tx());
check('대조: 타 거래 연결 이벤트 제외', m === null, JSON.stringify(m));
m = runMatch([evRow([sumupEv({ ts: 'u1' })], 'A'), evRow([sumupEv({ ts: 'l1', sumupTxRef: 'TXABC' })], 'B')], tx());
check('대조: 같은 ref 연결이 미연결보다 우선', m && m.linked === true && m.eventTs === 'l1', JSON.stringify(m));
m = runMatch([evRow([sumupEv({ type: 'gutschein_restore' })])], tx());
check('대조: 복원 이벤트 제외', m === null, JSON.stringify(m));

/* ── 환불 취소(무효화) ── */
const oneRefund = (over) => ({ ...paidRow, '환불내역JSON': JSON.stringify([{ ts: 't1', payoutDate: '2026-07-28', amount: 15, method: 'bank', type: 'refund', reason: '오기록', ...(over || {}) }]) });
let v = runVoid(oneRefund(), { expectName: 'T', expectAmount: 15, reason: '실지급 안함' });
check('취소: 단건 무효화 성공', v.ok === true && v.res.voidedAmount === 15, v.ok ? '' : v.error);
check('취소: 누계 0 으로', v.ok && v.res.totalRefund === 0 && v.cum === 0, v.ok ? `누계 ${v.res.totalRefund}` : '');
check('취소: 실수령 전액 복원', v.ok && v.res.remaining === 170, v.ok ? `잔여 ${v.res.remaining}` : '');
check('취소: 이벤트 보존(감사흔적)', v.ok && /"type":"refund_voided"/.test(String(v.json || '')) && /"voidedAt"/.test(String(v.json || '')), '무효화 흔적 없음');
check('취소: 원 amount 는 남김', v.ok && /"amount":15/.test(String(v.json || '')), 'amount 삭제됨');

// 무효화된 환불은 집계에서 빠지므로 그만큼 다시 환불 가능
v = runVoid(oneRefund(), { expectAmount: 15 });
const afterVoidRow = { ...paidRow, '환불내역JSON': v.json };
r = runRefund(afterVoidRow, { amount: 170, method: 'bank' });
check('취소 후 전액 재환불 가능', r.ok === true && r.res.totalRefund === 170, r.ok ? `누계 ${r.res.totalRefund}` : r.error);

// 이름 불일치 거부
v = runVoid(oneRefund(), { expectName: '다른사람' });
check('취소: 이름 불일치 거부', v.ok === false && /불일치/.test(v.error || ''), `err=${v.error}`);
// 금액 불일치 거부 (엉뚱한 건 무효화 방지)
v = runVoid(oneRefund(), { expectAmount: 99 });
check('취소: 금액 불일치 거부', v.ok === false && /금액 불일치/.test(v.error || ''), `err=${v.error}`);
// 환불 이벤트 없음
v = runVoid(paidRow, {});
check('취소: 환불 없음 거부', v.ok === false && /환불 이벤트가 없/.test(v.error || ''), `err=${v.error}`);
// 인보이스 연결 건은 force 없이 거부, force 로 허용
v = runVoid(oneRefund({ invoiceNo: 'RE-2026-001' }), {});
check('취소: 인보이스 연결 시 거부', v.ok === false && /인보이스/.test(v.error || ''), `err=${v.error}`);
v = runVoid(oneRefund({ invoiceNo: 'RE-2026-001' }), { force: true });
check('취소: force 로 인보이스 건 허용', v.ok === true && v.res.voidedAmount === 15, v.ok ? '' : v.error);

// 다건이면 ts 지정 필수
const twoRefunds = { ...paidRow, '환불내역JSON': JSON.stringify([
  { ts: 't1', payoutDate: '2026-07-01', amount: 30, method: 'bank', type: 'refund' },
  { ts: 't2', payoutDate: '2026-07-10', amount: 20, method: 'bank', type: 'refund' },
]) };
v = runVoid(twoRefunds, {});
check('취소: 다건 ts 미지정 거부', v.ok === false && /eventTs/.test(v.error || ''), `err=${v.error}`);
v = runVoid(twoRefunds, { eventTs: 't2', expectAmount: 20 });
check('취소: ts 로 특정 건만 무효화', v.ok === true && v.res.totalRefund === 30, v.ok ? `누계 ${v.res.totalRefund}` : v.error);
if (v.ok) {
  const arr = JSON.parse(v.json);
  const e1 = arr.find((x) => x.ts === 't1');
  const e2 = arr.find((x) => x.ts === 't2');
  check('취소: 지정 건만 무효화(t2)', e2 && e2.type === 'refund_voided', `t2.type=${e2 && e2.type}`);
  check('취소: 지정 안 한 건 유지(t1)', e1 && e1.type === 'refund', `t1.type=${e1 && e1.type}`);
}

console.log('환불 규칙 검증');
if (fails.length) {
  console.error(`\n❌ ${fails.length}건 불일치\n`);
  fails.forEach((f) => console.error('  - ' + f));
  console.error('\n환불은 장부(ELSTER 참조점)까지 닿습니다. 고치기 전엔 배포하지 마세요.');
  process.exit(1);
}
console.log('\n✅ 기록 상한·누적·forfeit·수단 폴백·규정 스케줄(일반/웨딩) 모두 정확.');
