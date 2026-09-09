#!/usr/bin/env node
/**
 * check-settlement-bundle.mjs — 합산결제 매칭(settlement-mark-bundle) 회귀 검증기
 *
 * 사고(2026-07-11): 최새진 카드 €230 = row203 잔금 210 + row212 Trinkgeld 20 을 한 번에 받았다.
 * apply-match(1:1 정확일치)·mark-split(정산행 N→예약 1)·mark-nonbooking(회계분류 틀어짐) 어느 것도
 * 못 잡아 영영 review 로 남았다. 여기서 보는 것:
 *   · 후보 탐색 — 같은 날·같은 고객명 조합만, 취소행·다른 날·다른 고객은 제외
 *   · 실행 — 합계 불일치 / 고객명 불일치 / 중복 행 / 1건 / 환불 거래 는 거부, 예약장부는 불변
 * 재구현이 아니라 Code.gs **원본 소스를 떼어내** 가짜 시트 위에서 돌린다.
 * 사용법:  node scripts/check-settlement-bundle.mjs        (불일치 시 exit 1)
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
  return line;
}

const bookingHeadersLine = extractLine(gs, "BOOKING_HEADERS: ['예약일시'").trim().replace(/,$/, '');

const FAKE_SHEET = `
class FakeSheet {
  constructor(headers, rows){ this.rows=[headers.slice()].concat(rows.map(r=>r.slice())); this.width=headers.length; }
  getLastColumn(){ return this.width; }
  getLastRow(){ return this.rows.length; }
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
      getValue(){ return (self.rows[r-1]||[])[c-1]; },
      setValue(v){
        if(!self.rows[r-1]) self.rows[r-1]=new Array(self.width).fill('');
        self.rows[r-1][c-1]=v;
      }
    };
  }
}
`;

const MODULE = [
  `const CONFIG={TIMEZONE:'Europe/Berlin',${bookingHeadersLine}};`,
  extractLine(gs, 'const BOOKING_COL=CONFIG.BOOKING_HEADERS.reduce'),
  extractLine(gs, "const SETTLEMENT_HEADERS=['가져온일시'"),
  extractLine(gs, 'const SETTLEMENT_COL=SETTLEMENT_HEADERS.reduce'),
  `const BOOKING_STATUS_CANCELLED='취소됨';`,
  `const Utilities={formatDate:(d,tz,f)=>{
     const p=(n)=>String(n).padStart(2,'0');
     return f.replace('yyyy',d.getFullYear()).replace('MM',p(d.getMonth()+1)).replace('dd',p(d.getDate()))
             .replace('HH',p(d.getHours())).replace('mm',p(d.getMinutes())).replace('ss',p(d.getSeconds()));
   }};`,
  `const Logger={log:()=>{}};`,
  FAKE_SHEET,
  extractFn(gs, 'roundCurrency_'),
  extractFn(gs, 'parseMoneyValue_'),
  extractFn(gs, 'normalizeAccountingName_'),
  extractFn(gs, 'parseDateSafe_'),
  `function formatDateMinute_(d){ return Utilities.formatDate(d,CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm'); }`,
  extractFn(gs, 'normalizeBookingStatus_'),
  extractFn(gs, 'isBookingCancelledStatus_'),
  extractFn(gs, 'settlementCandidateKindLabel_'),
  extractFn(gs, 'getEffectiveBookingDeposit_'),
  extractFn(gs, 'classifyBookingAccounting_'),
  extractFn(gs, 'createSettlementReviewReason_'),
  extractFn(gs, 'updateSettlementMatchRow_'),
  extractFn(gs, 'bookingKindAmount_'),
  extractFn(gs, 'settlementBundleLabel_'),
  extractFn(gs, 'findSettlementBundleCandidates_'),
  extractFn(gs, 'markSettlementBundleAdmin'),
  extractFn(gs, 'analyzeSettlementReviewReason_'),
  // 검토사유 분석의 다른 가지(환불·은행·정산입금)는 이 검증기 범위 밖 — 무력화
  `function matchSumupRefundToRefundEvents_(){ return null; }
   function linkSumupRefundEvent_(){}
   function isLikelySumupBankIn_(){ return false; }
   function classifyBankInPayment_(){ return null; }
   function getSettlementBookingCandidatesForTx_(){ return []; }`,
  `let __B__=null, __S__=null;`,
  `function ensureSheets_(){ return {bookingSheet:__B__, settlementSheet:__S__}; }`,
  `function assertAdmin_(){ return true; }`,
  // 정산행 읽기 스텁 — 실제 함수는 getSettlementTransactions_ 전체 파서를 끌고 오므로 필요한 필드만 만든다
  `function getSettlementTransactionByRow_(sh,rowIndex){
     const idx=Number(rowIndex||0);
     if(idx<2||idx>sh.getLastRow()) throw new Error('결제대조 행을 찾지 못했습니다.');
     const row=sh.getRange(idx,1,1,SETTLEMENT_HEADERS.length).getValues()[0];
     return {tx:{rowIndex:idx,date:String(row[SETTLEMENT_COL['거래일']]||''),gross:parseMoneyValue_(row[SETTLEMENT_COL['총액(Brutto)']]),
       source:String(row[SETTLEMENT_COL['소스']]||''),matchStatus:String(row[SETTLEMENT_COL['매칭상태']]||'')},row:row,rowIndex:idx};
   }`,
  `export {FakeSheet, CONFIG, BOOKING_COL, SETTLEMENT_HEADERS, SETTLEMENT_COL, bookingKindAmount_, findSettlementBundleCandidates_,
    markSettlementBundleAdmin, analyzeSettlementReviewReason_};`,
  `export function __setSheets(b,s){ __B__=b; __S__=s; }`,
].join('\n\n');

const dir = mkdtempSync(join(tmpdir(), 'bundle-check-'));
const modPath = join(dir, 'mod.mjs');
writeFileSync(modPath, MODULE);
const m = await import(pathToFileURL(modPath).href);
rmSync(dir, { recursive: true, force: true });

const { FakeSheet, CONFIG, SETTLEMENT_HEADERS, SETTLEMENT_COL } = m;
const H = CONFIG.BOOKING_HEADERS;
const brow = (o) => H.map((h) => (o[h] !== undefined ? o[h] : ''));
const srow = (o) => SETTLEMENT_HEADERS.map((h) => (o[h] !== undefined ? o[h] : ''));

// 실측 형태 그대로: 계약금 셀 '입금전(50€)' · 잔금 210 · 둘 다 카드·작업완료
const R203 = { '고객명': 'Sae-Jin Choi', '상태': '작업완료', '촬영종류': 'stud', '상품': '스튜디오 Basic', '총결제액': 260, '계약금': '입금전(50€)', '잔금': 210, '결제수단': '카드', '예약일시': '2026-07-11 15:15', '계약금입금여부': 'Y', '잔금결제여부': 'Y' };
const R212 = { '고객명': 'Sae-Jin Choi', '상태': '작업완료', '촬영종류': 'other', '상품': 'Trinkgeld (카드결제 팁)', '총결제액': 20, '계약금': '', '잔금': 20, '결제수단': '카드', '예약일시': '2026-07-11 15:15', '잔금결제여부': 'Y' };
const OTHER = { '고객명': 'Mina Park', '상태': '작업완료', '촬영종류': 'other', '상품': 'Trinkgeld', '총결제액': 20, '잔금': 20, '결제수단': '카드', '예약일시': '2026-07-11 16:00' };
const CANCELLED = { '고객명': 'Sae-Jin Choi', '상태': '취소됨', '촬영종류': 'stud', '상품': '취소건', '총결제액': 20, '잔금': 20, '예약일시': '2026-07-11 10:00' };
const OTHERDAY = { '고객명': 'Sae-Jin Choi', '상태': '확정됨', '촬영종류': 'pass', '상품': '여권', '총결제액': 20, '잔금': 20, '결제수단': '카드', '예약일시': '2026-07-20 10:00' };
const bookingRows = [R203, R212, OTHER, CANCELLED, OTHERDAY].map(brow); // 행 2..6

const settleRows = [
  srow({ '소스': 'sumup', '거래일': '2026-07-11', '총액(Brutto)': 230, '매칭상태': 'review', '결제참조': 'TAAA36EP7F7' }),   // 행2
  srow({ '소스': 'sumup', '거래일': '2026-07-12', '총액(Brutto)': 230, '매칭상태': 'review' }),                            // 행3
  srow({ '소스': 'sumup', '거래일': '2026-07-11', '총액(Brutto)': -20, '매칭상태': 'review' }),                            // 행4 환불
];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass += 1; console.log('  ✓ ' + name); }
  else { fail += 1; console.log('  ✗ ' + name + (extra !== undefined ? ' — ' + JSON.stringify(extra) : '')); }
}
function throwsWith(fn, re) { try { fn(); return { ok: false, msg: '(no throw)' }; } catch (e) { return { ok: re.test(String(e.message)), msg: e.message }; } }

const fresh = () => { const b = new FakeSheet(H, bookingRows); const s = new FakeSheet(SETTLEMENT_HEADERS, settleRows); m.__setSheets(b, s); return { b, s }; };

console.log('bookingKindAmount_');
{
  const r = brow(R203);
  check('deposit 셀 "입금전(50€)" → 50', m.bookingKindAmount_(r, 'deposit') === 50);
  check('balance → 210', m.bookingKindAmount_(r, 'balance') === 210);
  check('full → 260', m.bookingKindAmount_(r, 'full') === 260);
}

console.log('findSettlementBundleCandidates_');
{
  const { b } = fresh();
  const c = m.findSettlementBundleCandidates_({ rowIndex: 2, gross: 230, date: '2026-07-11' }, b);
  check('€230 · 07-11 → 후보 정확히 1개', c.length === 1, c.map((x) => x.label));
  const parts = c[0] ? c[0].parts : [];
  check('조합 = [행2 잔금 210, 행3 전액 20]', parts.map((p) => p.bookingRowIndex + ':' + p.kind + ':' + p.amount).join(',') === '2:balance:210,3:full:20', parts);
  check('label 형식', c[0] && c[0].label === '예약장부 합산(2 잔금 210 + 3 전액 20)', c[0] && c[0].label);
  check('payload 그대로 실행 가능', c[0] && JSON.stringify(c[0].payload) === JSON.stringify({ settlementRowIndex: 2, parts: [{ bookingRowIndex: 2, kind: 'balance' }, { bookingRowIndex: 3, kind: 'full' }], expectName: 'Sae-Jin Choi', confirm: 'MATCH' }), c[0] && c[0].payload);
  check('다른 고객(행4)·취소(행5)·다른 날(행6)은 제외', !parts.some((p) => [4, 5, 6].includes(p.bookingRowIndex)));
  check('다른 날(07-12) → 후보 0', m.findSettlementBundleCandidates_({ rowIndex: 3, gross: 230, date: '2026-07-12' }, b).length === 0);
  const c70 = m.findSettlementBundleCandidates_({ rowIndex: 2, gross: 70, date: '2026-07-11' }, b);
  check('€70 → 계약금 50 + 팁 20 (deposit 옵션 경로)', c70.length === 1 && c70[0].parts.map((p) => p.kind).join(',') === 'deposit,full', c70.map((x) => x.label));
  // 잔금입금일이 거래일과 같으면 예약일이 달라도 '같은 날' — 행6 이 합류해 2조합
  const rows2 = bookingRows.map((r) => r.slice()); rows2[4][m.BOOKING_COL['잔금입금일']] = '2026-07-11';
  const c2 = m.findSettlementBundleCandidates_({ rowIndex: 2, gross: 230, date: '2026-07-11' }, new FakeSheet(H, rows2));
  check('잔금입금일 일치 행 합류 → 조합 2개', c2.length === 2, c2.map((x) => x.label));
}

console.log('analyzeSettlementReviewReason_');
{
  const { b } = fresh();
  const near = [{ rowIndex: 2, name: 'Sae-Jin Choi', kind: 'balance', due: 210, amountDelta: 20, score: 36, alreadyPaid: true, bookingDate: '2026-07-11' }];
  const r1 = m.analyzeSettlementReviewReason_({ rowIndex: 2, gross: 230, date: '2026-07-11', source: 'sumup', type: 'PAYMENT · SUCCESSFUL' }, b, { candidates: near });
  check('정확일치 없음 + 조합 일치 → bundle_candidate', r1.reasonCode === 'bundle_candidate', r1.reasonCode);
  check('bundleCandidates 실림', Array.isArray(r1.bundleCandidates) && r1.bundleCandidates.length === 1);
  const r2 = m.analyzeSettlementReviewReason_({ rowIndex: 3, gross: 230, date: '2026-07-12', source: 'sumup', type: 'PAYMENT · SUCCESSFUL' }, b, { candidates: near });
  check('조합 없으면 종전대로 amount_delta', r2.reasonCode === 'amount_delta', r2.reasonCode);
  const r3 = m.analyzeSettlementReviewReason_({ rowIndex: 3, gross: 230, date: '2026-07-12', source: 'sumup', type: 'PAYMENT · SUCCESSFUL' }, b, { candidates: [] });
  check('후보 0 + 조합 없음 → no_booking_candidate', r3.reasonCode === 'no_booking_candidate', r3.reasonCode);
}

console.log('markSettlementBundleAdmin');
{
  const { b, s } = fresh();
  const snapB = JSON.stringify(b.rows);
  const P = [{ bookingRowIndex: 2, kind: 'balance' }, { bookingRowIndex: 3, kind: 'full' }];
  const dry = m.markSettlementBundleAdmin('t', { settlementRowIndex: 2, parts: P, expectName: 'Sae-Jin Choi' });
  check('confirm 없으면 dryRun', dry.dryRun === true && dry.sum === 230 && dry.target === '예약장부 합산(2 잔금 210 + 3 전액 20)', dry);
  check('dryRun 은 정산행 불변', s.rows[1][SETTLEMENT_COL['매칭상태']] === 'review');
  const dry2 = m.markSettlementBundleAdmin('t', { settlementRowIndex: 2, parts: P, expectName: 'sae-jin  choi' });
  check('expectName 은 대소문자·공백 무시', dry2.dryRun === true);

  let t = throwsWith(() => m.markSettlementBundleAdmin('t', { settlementRowIndex: 2, parts: [P[0]], confirm: 'MATCH' }), /최소 2개/);
  check('parts 1건 거부', t.ok, t.msg);
  t = throwsWith(() => m.markSettlementBundleAdmin('t', { settlementRowIndex: 2, parts: [{ bookingRowIndex: 2, kind: 'deposit' }, P[1]], confirm: 'MATCH' }), /AMOUNT_MISMATCH/);
  check('합계 불일치(50+20≠230) 거부', t.ok, t.msg);
  t = throwsWith(() => m.markSettlementBundleAdmin('t', { settlementRowIndex: 2, parts: [P[0], { bookingRowIndex: 4, kind: 'full' }], confirm: 'MATCH' }), /NAME_MISMATCH/);
  check('다른 고객 조합(210+20=230 이어도) 거부', t.ok, t.msg);
  t = throwsWith(() => m.markSettlementBundleAdmin('t', { settlementRowIndex: 2, parts: P, expectName: 'Someone Else', confirm: 'MATCH' }), /NAME_MISMATCH/);
  check('expectName 불일치 거부', t.ok, t.msg);
  t = throwsWith(() => m.markSettlementBundleAdmin('t', { settlementRowIndex: 2, parts: [P[0], { bookingRowIndex: 2, kind: 'deposit' }], confirm: 'MATCH' }), /두 번/);
  check('같은 예약행 중복 지목 거부', t.ok, t.msg);
  t = throwsWith(() => m.markSettlementBundleAdmin('t', { settlementRowIndex: 4, parts: P, confirm: 'MATCH' }), /입금 거래가 아닙니다/);
  check('환불(음수) 거래 거부', t.ok, t.msg);
  t = throwsWith(() => m.markSettlementBundleAdmin('t', { settlementRowIndex: 2, parts: [P[0], { bookingRowIndex: 3, kind: 'tip' }], confirm: 'MATCH' }), /kind 는/);
  check('kind 오타 거부', t.ok, t.msg);
  check('거부 경로 전부 정산행·예약장부 불변', s.rows[1][SETTLEMENT_COL['매칭상태']] === 'review' && JSON.stringify(b.rows) === snapB);

  const done = m.markSettlementBundleAdmin('t', { settlementRowIndex: 2, parts: P, expectName: 'Sae-Jin Choi', confirm: 'MATCH' });
  check('confirm:MATCH → ok', done.ok === true && done.dryRun === undefined, done);
  const row = s.rows[1];
  check('매칭상태 matched', row[SETTLEMENT_COL['매칭상태']] === 'matched');
  check('매칭대상 = 예약장부 합산(2 잔금 210 + 3 전액 20)', row[SETTLEMENT_COL['매칭대상']] === '예약장부 합산(2 잔금 210 + 3 전액 20)', row[SETTLEMENT_COL['매칭대상']]);
  check('매칭행 = 대표 행(첫 part) 2', row[SETTLEMENT_COL['매칭행']] === 2, row[SETTLEMENT_COL['매칭행']]);
  check('회계분류 = 스튜디오 매출(대표 행 기준)', row[SETTLEMENT_COL['회계분류']] === '스튜디오 매출', row[SETTLEMENT_COL['회계분류']]);
  const memo = String(row[SETTLEMENT_COL['메모']]);
  check('메모에 전체 조합', /합산결제 2행/.test(memo) && memo.includes('행2 잔금 210€ + 행3 전액 20€ = 230€') && /수동 확인 \d{4}-\d{2}-\d{2}/.test(memo), memo);
  check('예약장부는 읽기만 — 두 행 값 불변', JSON.stringify(b.rows) === snapB);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
