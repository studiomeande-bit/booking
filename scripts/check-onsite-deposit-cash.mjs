#!/usr/bin/env node
/**
 * check-onsite-deposit-cash.mjs — 현장수령 계약금의 수단 기록 · 현금장부 편입 · 메일 억제 검증기
 *
 * 2026-08-29 김혜수(row 239) 실사고: 계약금 €50 을 현장 지급으로 돌려 `[계약금예외]` 로 잡아두고
 * 촬영 당일 €310 전액을 현금으로 받았는데, 매출장부는 €310 · 현금장부는 €260 만 잡혔다.
 * 원인은 입금확인이 계약금수단을 '현장결제' 한 덩어리로 굳히는 것 — `isCashPayMethod_` 의
 * `/현금|cash|bar/` 에 안 걸려 **정상 경로를 밟아도 계약금이 현금장부에 영영 안 들어간다**.
 *
 * 고치는 방향이 함정이다. 정규식에 '현장결제'를 더하면 **카드 현장결제까지 현금으로 새서**
 * 현금장부 과대 + SumUp 이중계상이라는 반대편 오류가 난다. 그래서 수단 자체를 기록하도록 고쳤고,
 * 이 검증기는 그 갈림길(현금은 들어오고 카드는 안 들어온다)을 못박는다.
 *
 * 재구현이 아니라 Code.gs **원본 소스를 떼어내** 가짜 시트 위에서 돌린다. 현금장부 편입 판정도
 * 베껴 쓰지 않고 파생 조건문 원문을 추출해 평가하므로, 조건이 바뀌면 이 검사가 같이 움직인다.
 *
 * 사용법:  node scripts/check-onsite-deposit-cash.mjs        (불일치 시 exit 1)
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
function extractLine(src, needle) {
  const line = src.split('\n').find((l) => l.includes(needle));
  if (!line) throw new Error(`${needle} 선언을 찾지 못했습니다.`);
  return line.trim();
}

// 현금장부 계약금 파생 조건 — 원문 그대로 떼어내 술어로 만든다(베껴 쓰면 드리프트한다)
const gateRaw = extractLine(gs, "if(isCashPayMethod_(row[BOOKING_COL['계약금수단']])");
const gateExpr = gateRaw.replace(/^if\(/, '').replace(/\)\{$/, '');
if (gateExpr === gateRaw) throw new Error('현금장부 계약금 조건문 형태가 바뀌었습니다: ' + gateRaw);

const bookingHeadersLine = extractLine(gs, "BOOKING_HEADERS: ['예약일시'").replace(/,$/, '');

const MODULE = [
  `const CONFIG={TIMEZONE:'Europe/Berlin',${bookingHeadersLine}};`,
  `const BOOKING_COL=CONFIG.BOOKING_HEADERS.reduce((a,h,i)=>{a[h]=i;return a;},{});`,
  extractLine(gs, 'const BOOKING_STATUS_CANCELLED'),
  extractLine(gs, 'const BOOKING_STATUS_POSTPONED'),
  extractLine(gs, 'const DEPOSIT_ONSITE_EXCEPTION_MARKER'),
  extractLine(gs, 'const DEPOSIT_ONSITE_EXCEPTION_STATUS'),
  // 원본 함수들이 실제 new Date() 를 쓰므로 '오늘'은 실행 시점에 계산해 비교한다
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
  extractFn(gs, 'isPaymentConfirmedValue_'),
  extractFn(gs, 'getEffectiveBookingDeposit_'),
  extractFn(gs, 'agentBoolFlag_'),
  extractFn(gs, 'isCashPayMethod_'),
  extractFn(gs, '_dayCloseBucket_'),
  extractFn(gs, 'normalizeDepositPayMethod_'),
  // 시트/권한/메일은 스텁 — 판정 로직은 원본 그대로 돈다. 메일은 '나갔는지'를 기록만 한다.
  `let __SHEET__=null;`,
  `let __MAILS__=[];`,
  `function getDbSheet(){ return __SHEET__; }`,
  `function assertAdmin_(){ return true; }`,
  `function sendDepositConfirmationEmail_(rIdx,row,paidAmount,paidAt){
     __MAILS__.push({rowIndex:rIdx,paidAmount:paidAmount,paidAt:paidAt});
     return {requested:true,sent:true};
   }`,
  extractFn(gs, 'confirmBookingDepositAdmin'),
  // 현금장부 계약금 파생 조건 — Code.gs 원문 표현식을 그대로 평가
  `function cashLedgerDepositGate_(row,depositPaidAmount,depositPaidAt,inRange){ return !!(${gateExpr}); }`,
  `export {FakeSheet, CONFIG, BOOKING_COL, confirmBookingDepositAdmin, normalizeDepositPayMethod_,
     isCashPayMethod_, _dayCloseBucket_, cashLedgerDepositGate_};`,
  `export function __setSheet(s){ __SHEET__=s; __MAILS__=[]; }`,
  `export function __mails(){ return __MAILS__; }`,
].join('\n\n');

async function load(src) {
  const dir = mkdtempSync(join(tmpdir(), 'onsitedep-'));
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

const TODAY = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();

const { mod: M, dir } = await load(MODULE);
try {
  const H = M.CONFIG.BOOKING_HEADERS;
  const C = M.BOOKING_COL;

  // 김혜수 재현 — 스튜디오 Basic €310, 계약금 €50 현장 지급 전환(계약금예외)
  function makeRow(over) {
    const r = new Array(H.length).fill('');
    r[C['예약일시']] = '2026-08-29 11:00';
    r[C['상태']] = '확정됨';
    r[C['고객명']] = '김혜수';
    r[C['이메일']] = 'test@example.com';
    r[C['상품']] = '스튜디오 Basic';
    r[C['총결제액']] = 310;
    r[C['계약금']] = '입금전(50€)';
    r[C['잔금']] = 260;
    r[C['계약금수단']] = '현장결제예외';
    Object.keys(over || {}).forEach((k) => { r[C[k]] = over[k]; });
    return r;
  }
  function run(over, amount, options) {
    const sh = new M.FakeSheet(H, [makeRow(over)]);
    M.__setSheet(sh);
    const res = M.confirmBookingDepositAdmin('tok', 2, amount, options);
    return { res, row: sh.rows[1], mails: M.__mails() };
  }
  // 현금장부에 실제로 들어가는가 — 확인 후 행을 원문 조건에 그대로 태운다
  function inLedger(row, inRangeOk) {
    const amt = row[C['계약금입금금액']];
    const at = String(row[C['계약금입금일']] || '').slice(0, 10);
    return M.cashLedgerDepositGate_(row, amt, at, () => inRangeOk !== false);
  }

  // ── ① 현장결제 + 현금 → 현금장부에 들어간다 (사고의 핵심)
  {
    const { res, row, mails } = run(null, 50, { payMethod: '현금', paidDate: '2026-08-29' });
    check('①-1 계약금수단에 수단이 남는다', row[C['계약금수단']], '현장결제(현금)');
    check('①-2 응답 depositMethod', res.depositMethod, '현장결제(현금)');
    check('①-3 현금장부 편입', inLedger(row), true);
    check('①-4 일마감 버킷', M._dayCloseBucket_(row[C['계약금수단']]), 'cash');
    check('①-5 금액·날짜', [row[C['계약금입금금액']], row[C['계약금입금일']]], [50, '2026-08-29']);
    check('①-6 입금여부', row[C['계약금입금여부']], 'Y');
    check('①-7 표시용 계약금 셀 정리', row[C['계약금']], 50);
    check('①-8 기본값은 메일 발송', mails.length, 1);
  }

  // ── ② 현장결제 + 카드 → 현금장부에 안 들어간다 (반대편 오류 방지)
  {
    const { row } = run(null, 50, { payMethod: '카드', paidDate: '2026-08-29' });
    check('②-1 계약금수단', row[C['계약금수단']], '현장결제(카드)');
    check('②-2 현금장부 미편입', inLedger(row), false);
    check('②-3 일마감 버킷', M._dayCloseBucket_(row[C['계약금수단']]), 'card');
  }

  // ── ③ 현장결제 + 계좌이체 → 은행 버킷
  {
    const { row } = run(null, 50, { payMethod: '계좌이체', paidDate: '2026-08-29' });
    check('③-1 계약금수단', row[C['계약금수단']], '현장결제(계좌이체)');
    check('③-2 현금장부 미편입', inLedger(row), false);
    check('③-3 일마감 버킷', M._dayCloseBucket_(row[C['계약금수단']]), 'bank');
  }

  // ── ④ payMethod 미지정 → 종전 그대로 (하위호환)
  {
    const { row } = run(null, 50, { paidDate: '2026-08-29' });
    check('④-1 계약금수단 종전값', row[C['계약금수단']], '현장결제');
    check('④-2 현금장부 미편입(종전 동작)', inLedger(row), false);
  }

  // ── ⑤ 메일 억제
  {
    const a = run(null, 50, { payMethod: '현금', notify: false });
    check('⑤-1 notify:false 미발송', a.mails.length, 0);
    check('⑤-2 skippedReason', a.res.mailResult.skippedReason, 'SUPPRESSED_BY_CALLER');
    check('⑤-3 requested/sent', [a.res.mailResult.requested, a.res.mailResult.sent], [false, false]);
    check('⑤-4 억제해도 장부는 기록된다', inLedger(a.row), true);

    const b = run(null, 50, { payMethod: '현금', notify: 'false' });   // JSON payload 경유
    check('⑤-5 notify:"false" 문자열도 억제', b.mails.length, 0);

    const c = run(null, 50, { payMethod: '현금', skipMail: true });
    check('⑤-6 skipMail:true 억제', c.mails.length, 0);

    const d = run(null, 50, { payMethod: '현금' });
    check('⑤-7 미지정이면 종전대로 발송', [d.mails.length, d.res.mailResult.sent], [1, true]);

    const e = run(null, 50, { payMethod: '현금', notify: true });
    check('⑤-8 notify:true 발송', e.mails.length, 1);
  }

  // ── ⑥ 이미 입금완료 건 — 종전 스킵 사유 유지
  {
    const { res, mails } = run({ 계약금입금여부: 'Y', 계약금수단: '계좌이체' }, 50, {});
    check('⑥-1 ALREADY_CONFIRMED', res.mailResult.skippedReason, 'ALREADY_CONFIRMED');
    check('⑥-2 미발송', mails.length, 0);
  }

  // ── ⑦ 현장결제 예외가 아닌 일반 건
  {
    const a = run({ 계약금수단: '계좌이체' }, 50, { payMethod: '현금' });
    check('⑦-1 명시 수단은 그대로 기록(괄호 없음)', a.row[C['계약금수단']], '현금');
    check('⑦-2 현금장부 편입', inLedger(a.row), true);

    const b = run({ 계약금수단: '계좌이체' }, 50, {});
    check('⑦-3 미지정이면 건드리지 않는다', b.row[C['계약금수단']], '계좌이체');

    const c = run({ 계약금수단: '' }, 50, {});
    check('⑦-4 빈 값도 건드리지 않는다', c.row[C['계약금수단']], '');
  }

  // ── ⑧ 입금일 기본값 / 금액 기본값
  {
    const { row } = run(null, null, { payMethod: '현금' });
    check('⑧-1 paidDate 미지정 시 오늘', String(row[C['계약금입금일']]), TODAY);
    check('⑧-2 amount 미지정 시 계약금 전액', row[C['계약금입금금액']], 50);
    check('⑧-3 기간 밖이면 현금장부 미편입', inLedger(row, false), false);
  }

  // ── ⑨ payMethod 정규화 · 잘못된 값 차단
  {
    const norm = (v) => M.normalizeDepositPayMethod_(v);
    check('⑨-1 현금 계열', ['현금', 'cash', 'Barzahlung', 'CASH'].map(norm), ['현금', '현금', '현금', '현금']);
    check('⑨-2 카드 계열', ['카드', 'card', 'SumUp', 'EC-Karte', 'Kreditkarte'].map(norm),
      ['카드', '카드', '카드', '카드', '카드']);
    check('⑨-3 이체 계열', ['계좌이체', '이체', 'Überweisung', 'bank transfer'].map(norm),
      ['계좌이체', '계좌이체', '계좌이체', '계좌이체']);
    check('⑨-4 빈 값은 무지정', norm(''), '');
    let threw = '';
    try { norm('상품권'); } catch (e) { threw = 'THREW'; }
    check('⑨-5 알 수 없는 수단은 거부', threw, 'THREW');

    let threw2 = '';
    try { run(null, 50, { payMethod: '비트코인' }); } catch (e) { threw2 = 'THREW'; }
    check('⑨-6 잘못된 payMethod 는 확인 자체를 막는다', threw2, 'THREW');
  }

  // ── ⑩ isCashPayMethod_ 회귀 — 기존 판정이 그대로여야 한다
  {
    const cash = ['현금', 'cash', 'Cash', 'Barzahlung', 'BAR', '현금결제'];
    const notCash = ['카드', 'card', 'SumUp', 'EC-Karte', '계좌이체', '이체', 'Überweisung',
      '현장결제', '현장결제(카드)', '현장결제(계좌이체)', '현장결제예외', '', '-'];
    check('⑩-1 현금으로 잡혀야 하는 값', cash.filter((v) => !M.isCashPayMethod_(v)), []);
    check('⑩-2 현금이 아니어야 하는 값', notCash.filter((v) => M.isCashPayMethod_(v)), []);
    check('⑩-3 현장결제(현금)만 현금', M.isCashPayMethod_('현장결제(현금)'), true);
  }

  // ── ⑪ 가드 유지 — 취소건·계약금 없는 건
  {
    let a = ''; try { run({ 상태: '취소됨' }, 50, { payMethod: '현금' }); } catch (e) { a = 'THREW'; }
    check('⑪-1 취소건은 입금확인 불가', a, 'THREW');
    let b = ''; try { run({ 총결제액: 30, 계약금: 0 }, 0, { payMethod: '현금' }); } catch (e) { b = 'THREW'; }
    check('⑪-2 계약금 없는 건은 입금확인 불가', b, 'THREW');
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`❌ 현장수령 계약금 검증 실패 ${failures.length}건\n`);
  failures.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log('✅ 현장수령 계약금 — 수단 기록 · 현금장부 편입 · 메일 억제 모두 정상');
