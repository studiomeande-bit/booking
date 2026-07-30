#!/usr/bin/env node
/**
 * check-settlement-dedupe.mjs — 정산장부·수수료지출 중복 방지 검증기
 *
 * 사고(2026-07): SumUp 카드거래 1건이 정산장부에 2~3행으로 쌓였다. 원인은 dedup 키(원본해시)의
 * base 에 **payout 이후에 채워지는 값**(입금예정일·수수료·순입금액)이 들어 있어, 같은 거래의 키가
 * 동기화 회차마다 달라진 것. 같은 해시를 수수료 지출 ID 로도 써서 지출장부까지 이중계상됐다
 * (실측 114행 중 57행 중복 · €47.02).
 *
 * 그래서 재구현이 아니라 Code.gs **원본 소스를 떼어내** 가짜 시트 위에서 돌린다.
 * 사용법:  node scripts/check-settlement-dedupe.mjs        (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';   // 날짜 파싱이 로컬 TZ 에 흔들리지 않게 GAS 와 동일 고정
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
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

const SETTLEMENT_HEADERS_LINE = extractLine(gs, "const SETTLEMENT_HEADERS=['가져온일시'");
const SETTLEMENT_COL_LINE = extractLine(gs, 'const SETTLEMENT_COL=SETTLEMENT_HEADERS.reduce');
const EXPENSE_HEADERS_LINE = extractLine(gs, "EXPENSE_HEADERS: ['지출일'");

const FNS = [
  'sha256Hex32_', 'settlementIdentityKey_', 'buildSettlementHash_', 'buildSettlementHashLegacy_',
  'settlementRefKey_', 'getSettlementIndex_', 'findSettlementRow_', 'registerSettlementRow_',
  'makeSettlementSeqCounter_', 'buildSettlementSheetRow_', 'dedupeSettlementRowsAdmin',
  'sumupFeeExpenseId_', 'sumupFeeExpenseDesc_', 'getSumupFeeExpenseMap_', 'findSumupFeeExpenseRow_',
  'upsertSumupFeeExpense_', 'parseDateSafe_', 'formatDateMinute_', '_canFormatDateFast_', 'formatDateMinuteFast_',
  'settlementMatchLedgerWindow_',
  'settlementEntryKey_', 'matchSettlementTransaction_', 'parseMoneyValue_', 'daysBetweenDates_', 'normalizeAccountingName_',
  'parseDateOnly_',
];

/* 매칭의 앞단(예약 결제기록 대조)은 예약시트를 훑는 별개 로직이라 여기선 무력화한다 —
   이 검증기가 보는 건 **장부 대조 경로의 선점(1건:1건)** 이다. */
const MATCH_STUBS = `
function findSumupPayoutMatch_(){ return null; }
function matchBankInBookingPayment_(){ return null; }
function matchSumupBookingPayment_(){ return null; }
`;

const HARNESS = `
class FakeSheet {
  constructor(headers, rows){ this.rows=[headers.slice()].concat((rows||[]).map(r=>r.slice())); this.width=headers.length; }
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
      setValues(vals){
        for(let i=0;i<vals.length;i++){
          if(!self.rows[r-1+i]) self.rows[r-1+i]=new Array(self.width).fill('');
          for(let j=0;j<vals[i].length;j++) self.rows[r-1+i][c-1+j]=vals[i][j];
        }
      },
      setValue(v){
        if(!self.rows[r-1]) self.rows[r-1]=new Array(self.width).fill('');
        self.rows[r-1][c-1]=v;
      }
    };
  }
  appendRow(values){ const row=new Array(this.width).fill(''); values.forEach((v,i)=>{ if(i<this.width) row[i]=v; }); this.rows.push(row); }
  deleteRow(r){ this.rows.splice(r-1,1); }
}
export { FakeSheet };

var __SHEETS__={settlementSheet:null,expenseSheet:null};
export function setSheets(s){ __SHEETS__=s; }
function ensureSheets_(){ return __SHEETS__; }
function assertAdmin_(){ return true; }

const Utilities={
  DigestAlgorithm:{SHA_256:'SHA_256'},
  computeDigest(alg,base){ return __sha256Bytes(base); },
  formatDate(d,tz,fmt){
    const p=function(n){return (n<10?'0':'')+n;};
    const day=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
    const f=String(fmt||'yyyy-MM-dd HH:mm');
    if(f.indexOf('HH:mm:ss')>-1) return day+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
    if(f.indexOf('HH:mm')>-1) return day+' '+p(d.getHours())+':'+p(d.getMinutes());
    return day;
  }
};
var _fastDateFmtOk_=null;
const CONFIG_TZ='Europe/Berlin';
`;

const MODULE = [
  HARNESS,
  SETTLEMENT_HEADERS_LINE,
  SETTLEMENT_COL_LINE,
  `const CONFIG={ TIMEZONE:'Europe/Berlin', ${EXPENSE_HEADERS_LINE.trim().replace(/,$/, '')} };`,
  MATCH_STUBS,
  ...FNS.map((n) => extractFn(gs, n)),
  `export { buildSettlementHash_, buildSettlementHashLegacy_, settlementIdentityKey_, settlementRefKey_,
    getSettlementIndex_, findSettlementRow_, registerSettlementRow_, makeSettlementSeqCounter_,
    buildSettlementSheetRow_, dedupeSettlementRowsAdmin, getSumupFeeExpenseMap_, upsertSumupFeeExpense_,
    sumupFeeExpenseId_, findSumupFeeExpenseRow_, settlementMatchLedgerWindow_,
    matchSettlementTransaction_, settlementEntryKey_ };`,
].join('\n\n');

async function load(src) {
  const dir = mkdtempSync(join(tmpdir(), 'settle-'));
  const file = join(dir, 'mod.mjs');
  const shim = `
export function __sha256Bytes(base){
  const { createHash } = await0;
  return [];
}
`;
  // sha256 은 node 구현을 주입한다(GAS 는 부호있는 바이트를 준다 — 동일하게 흉내낸다)
  const prelude = `
import { createHash } from 'node:crypto';
function __sha256Bytes(base){
  const buf=createHash('sha256').update(String(base),'utf8').digest();
  return Array.from(buf).map(b=> b>127 ? b-256 : b);
}
`;
  writeFileSync(file, prelude + src);
  const mod = await import(pathToFileURL(file).href + `?t=${Math.random()}`);
  return { mod, dir };
}

// ── 시나리오 ────────────────────────────────────────────────────────────────
const SH = ['가져온일시', '소스', '파일명', '거래일', '입금예정일', '거래유형', '상대방', '설명', '총액(Brutto)', '수수료', '순입금액', '통화', '결제참조', '은행참조', '매칭상태', '매칭대상', '매칭행', '회계분류', '메모', '원본해시', '원본JSON'];
const EH = ['지출일', '거래처', '카테고리', '설명', '총액(Brutto)', '순액(Netto)', '부가세(Vorsteuer)', '결제수단', '메모', '증빙링크', '상태', '회계분류', 'LexwareVoucherId', 'LexwareSyncStatus', 'LexwareSyncedAt'];

function mkTx(over) {
  return Object.assign({
    source: 'sumup', filename: 'SumUp API', date: '2026-07-25', payoutDate: '', type: 'PAYMENT · SUCCESSFUL',
    counterparty: 'VISA ****1234', description: 'Studio · TAAA4EQ2BV6', gross: 43, fee: 0, net: 43,
    currency: 'EUR', paymentRef: 'TAAA4EQ2BV6', bankRef: '', matchStatus: 'review', accountingClass: 'Kartenzahlung',
  }, over || {});
}

/** 운영 루프(importPaymentCsvAdmin / syncRecentSumupTransactionsAdmin)의 dedup 판정을 그대로 옮긴 하네스.
 *  구조검증이 실제 루프가 같은 함수를 같은 순서로 부르는지 소스에서 못박는다. */
function runImport(M, sh, txs, source, feeSheet) {
  const index = M.getSettlementIndex_(sh);
  const nextSeq = M.makeSettlementSeqCounter_();
  const feeMap = feeSheet ? M.getSumupFeeExpenseMap_(feeSheet) : null;
  let created = 0, updated = 0, feesCreated = 0, feesUpdated = 0;
  txs.forEach((raw) => {
    const tx = Object.assign({}, raw);
    tx.source = source;
    const s = nextSeq(source, tx);
    tx.seq = s.seq; tx.refSeq = s.refSeq;
    tx.hash = M.buildSettlementHash_(source, tx, null, tx.seq);
    const rowValues = M.buildSettlementSheetRow_(tx, '2026-07-30 12:00:00');
    const found = M.findSettlementRow_(index, tx);
    if (found.rowIndex) {
      sh.getRange(found.rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      M.registerSettlementRow_(index, tx, found.refKey, found.rowIndex);
      updated += 1;
    } else {
      sh.appendRow(rowValues);
      M.registerSettlementRow_(index, tx, found.refKey, sh.getLastRow());
      created += 1;
    }
    if (feeSheet && Number(tx.fee || 0) > 0) {
      const r = M.upsertSumupFeeExpense_(tx, feeSheet, feeMap);
      if (r.created) feesCreated += 1;
      if (r.updated) feesUpdated += 1;
    }
  });
  return { created, updated, feesCreated, feesUpdated, rows: sh.getLastRow() - 1 };
}

function legacyRow(M, tx, source) {
  // 구버전이 만들어 둔 행 — 원본해시가 옛 산식이다
  const t = Object.assign({}, tx, { source });
  t.hash = M.buildSettlementHashLegacy_(source, t);
  return M.buildSettlementSheetRow_(t, '2026-07-20 06:18:00');
}

async function runScenarios(M, rec) {
  // ── 1) payout 확정 전/후 2회 동기화 — 재현 사고 그 자체 ──────────────────
  {
    const sh = new M.FakeSheet(SH, []);
    const before = mkTx({ payoutDate: '', fee: 0, net: 43 });
    const r1 = runImport(M, sh, [before], 'sumup');
    // payout 확정: 입금예정일·수수료·순입금액이 뒤늦게 채워진다
    const after = mkTx({ payoutDate: '2026-07-26', fee: 0.86, net: 42.14 });
    const r2 = runImport(M, sh, [after], 'sumup');
    rec('payout전후: 1회차 생성 1', r1.created, 1);
    rec('payout전후: 2회차 created=0', r2.created, 0);
    rec('payout전후: 2회차 updated=1', r2.updated, 1);
    rec('payout전후: 총 1행', sh.getLastRow() - 1, 1);
    rec('payout전후: 최신값 반영', String(sh.rows[1][4]), '2026-07-26');
  }

  // ── 2) 같은 동기화 3회 반복 — created 는 계속 0 ─────────────────────────
  {
    const sh = new M.FakeSheet(SH, []);
    runImport(M, sh, [mkTx()], 'sumup');
    const a = runImport(M, sh, [mkTx({ payoutDate: '2026-07-26' })], 'sumup');
    const b = runImport(M, sh, [mkTx({ payoutDate: '2026-07-26', fee: 0.86 })], 'sumup');
    rec('반복동기화: created 0/0', [a.created, b.created], [0, 0]);
    rec('반복동기화: 총액 불변', Number(sh.rows[1][8]), 43);
  }

  // ── 3) 구버전 행(옛 해시) 위에서의 첫 동기화 — 신규 행을 만들면 안 된다 ──
  {
    const legacyTx = mkTx({ payoutDate: '2026-07-26', fee: 0.86, net: 42.14 });
    const sh = new M.FakeSheet(SH, [legacyRow(M, legacyTx, 'sumup')]);
    const r = runImport(M, sh, [legacyTx], 'sumup');
    rec('구버전행: created=0', r.created, 0);
    rec('구버전행: 1행 유지', sh.getLastRow() - 1, 1);
    // 참조 없는 소스(은행)는 legacy 해시 폴백으로만 찾을 수 있다
    const bankTx = { date: '2026-07-10', payoutDate: '2026-07-10', gross: -120, fee: 0, net: -120, paymentRef: 'DE0012345', bankRef: 'DE0012345', counterparty: 'Telekom', description: 'Rechnung', type: '은행출금' };
    const bsh = new M.FakeSheet(SH, [legacyRow(M, bankTx, 'deutschebank')]);
    const rb = runImport(M, bsh, [bankTx], 'deutschebank');
    rec('은행 구버전행: created=0', rb.created, 0);
  }

  // ── 4) 은행 CSV — 같은 IBAN(결제참조)의 서로 다른 이체는 절대 합치지 않는다 ──
  {
    const sh = new M.FakeSheet(SH, []);
    const a = { date: '2026-07-01', payoutDate: '2026-07-01', gross: -50, fee: 0, net: -50, paymentRef: 'DE99BANK', bankRef: 'DE99BANK', counterparty: 'Vermieter', description: 'Miete Juli', type: '은행출금' };
    const b = { date: '2026-07-02', payoutDate: '2026-07-02', gross: -30, fee: 0, net: -30, paymentRef: 'DE99BANK', bankRef: 'DE99BANK', counterparty: 'Vermieter', description: 'Nebenkosten', type: '은행출금' };
    const r = runImport(M, sh, [a, b], 'deutschebank');
    rec('은행 IBAN: 2건 유지', r.created, 2);
    const again = runImport(M, sh, [a, b], 'deutschebank');
    rec('은행 재임포트: created=0', again.created, 0);
    rec('은행 재임포트: 총 2행', sh.getLastRow() - 1, 2);
    // 월별로 나눠 임포트하면 같은 IBAN 이 서로 다른 배치에 온다 — ref 키가 허용되면 앞 거래를 덮어쓴다
    const split = new M.FakeSheet(SH, []);
    runImport(M, split, [a], 'deutschebank');
    runImport(M, split, [b], 'deutschebank');
    rec('은행 분할임포트: 2행 유지', split.getLastRow() - 1, 2);
    rec('은행 분할임포트: 첫 거래 보존', Number(split.rows[1][8]), -50);
  }

  // ── 5) 같은 CSV 파일 2회 임포트 — 행수·총액 불변 ────────────────────────
  {
    const sh = new M.FakeSheet(SH, []);
    const file = [
      mkTx({ paymentRef: 'T1', description: 'Erfolgreich · T1', gross: 30, fee: 0.49, filename: 'report.csv' }),
      mkTx({ paymentRef: 'T2', description: 'Erfolgreich · T2', gross: 43, fee: 0.7, filename: 'report.csv' }),
      // 참조가 비어 있는(구형 export) 동일 내용 2줄 — 정상적으로 2건이다
      mkTx({ paymentRef: '', description: 'Barzahlung', gross: 30, fee: 0, filename: 'report.csv' }),
      mkTx({ paymentRef: '', description: 'Barzahlung', gross: 30, fee: 0, filename: 'report.csv' }),
    ];
    const first = runImport(M, sh, file, 'sumup');
    const second = runImport(M, sh, file, 'sumup');
    rec('CSV 1회차: 4행', first.created, 4);
    rec('CSV 2회차: created=0', second.created, 0);
    rec('CSV 2회차: 총 4행', sh.getLastRow() - 1, 4);
    const total = sh.rows.slice(1).reduce((s, r) => s + Number(r[8] || 0), 0);
    rec('CSV 2회차: 총액 불변', total, 133);
  }

  // ── 5a) 같은 거래코드가 2줄(결제+팁 분리 export) — 참조만 보고 합치면 1건이 증발 ──
  {
    const sh = new M.FakeSheet(SH, []);
    const pay = mkTx({ paymentRef: 'TSPLIT', description: 'Zahlung · TSPLIT', gross: 40, fee: 0, filename: 'r.csv' });
    const tip = mkTx({ paymentRef: 'TSPLIT', description: 'Trinkgeld · TSPLIT', gross: 5, fee: 0, filename: 'r.csv' });
    const first = runImport(M, sh, [pay, tip], 'sumup');
    rec('동일참조 2줄: 2행 유지', first.created, 2);
    const again = runImport(M, sh, [pay, tip], 'sumup');
    rec('동일참조 2줄 재임포트: created=0', again.created, 0);
    rec('동일참조 2줄 재임포트: 총액 45', sh.rows.slice(1).reduce((s, r) => s + Number(r[8] || 0), 0), 45);
  }

  // ── 5b) 참조 없는 SumUp 행(구형 CSV export) — 해시만이 방어선이다 ────────
  {
    const sh = new M.FakeSheet(SH, []);
    const before = mkTx({ paymentRef: '', description: 'Barzahlung', gross: 30, fee: 0, net: 30, payoutDate: '', filename: 'a.csv' });
    runImport(M, sh, [before], 'sumup');
    // 같은 기간을 다시 내려받으면 payout 확정값이 채워져 있다 — 해시 base 에 사후값이 있으면 여기서 중복
    const after = mkTx({ paymentRef: '', description: 'Barzahlung', gross: 30, fee: 0.5, net: 29.5, payoutDate: '2026-07-26', filename: 'b.csv' });
    const r = runImport(M, sh, [after], 'sumup');
    rec('참조없음 payout전후: created=0', r.created, 0);
    rec('참조없음 payout전후: 1행', sh.getLastRow() - 1, 1);
  }

  // ── 6) 수수료 지출 — 해시가 흔들려도 1행, 구 ID 행도 재사용 ──────────────
  {
    const sh = new M.FakeSheet(SH, []);
    const esh = new M.FakeSheet(EH, []);
    const t1 = mkTx({ fee: 0.86, filename: 'SumUp API' });
    runImport(M, sh, [t1], 'sumup', esh);
    const t2 = mkTx({ fee: 0.86, payoutDate: '2026-07-26', net: 42.14, filename: 'SumUp API' });
    const r2 = runImport(M, sh, [t2], 'sumup', esh);
    rec('수수료: 2회차 생성 0', r2.feesCreated, 0);
    rec('수수료: 총 1행', esh.getLastRow() - 1, 1);
    rec('수수료: ID 는 참조 기반', String(esh.rows[1][12]), 'sumup_fee:ref:TAAA4EQ2BV6');

    // 구버전 ID(sumup_fee:<옛해시>)를 들고 있는 행 위에서도 새 행을 만들면 안 된다
    const esh2 = new M.FakeSheet(EH, []);
    const legacyFee = new Array(EH.length).fill('');
    legacyFee[0] = '2026-07-25'; legacyFee[3] = 'SumUp Kartenprovision · TAAA4EQ2BV6';
    legacyFee[4] = 0.86; legacyFee[12] = 'sumup_fee:' + M.buildSettlementHashLegacy_('sumup', t1);
    esh2.appendRow(legacyFee);
    const sh2 = new M.FakeSheet(SH, []);
    const r3 = runImport(M, sh2, [t2], 'sumup', esh2);
    rec('수수료 구ID: 생성 0', r3.feesCreated, 0);
    rec('수수료 구ID: 1행 유지', esh2.getLastRow() - 1, 1);
    rec('수수료 구ID: 신규 ID 로 이관', String(esh2.rows[1][12]), 'sumup_fee:ref:TAAA4EQ2BV6');
  }

  // ── 7) 정리 액션 — dryRun 은 아무것도 지우지 않고, 실행은 정본 1행만 남긴다 ──
  {
    const dupA = mkTx({ payoutDate: '', fee: 0, net: 43 });
    const dupB = mkTx({ payoutDate: '2026-07-26', fee: 0.86, net: 42.14 });
    const other = mkTx({ paymentRef: 'TOTHER', description: 'Erfolgreich · TOTHER', gross: 30 });
    const sh = new M.FakeSheet(SH, [legacyRow(M, dupA, 'sumup'), legacyRow(M, dupB, 'sumup'), legacyRow(M, other, 'sumup')]);
    const esh = new M.FakeSheet(EH, []);
    [1, 2].forEach(() => {
      const fee = new Array(EH.length).fill('');
      fee[0] = '2026-07-25'; fee[3] = 'SumUp Kartenprovision · TAAA4EQ2BV6'; fee[4] = 0.86; fee[12] = 'sumup_fee:x';
      esh.appendRow(fee);
    });
    M.setSheets({ settlementSheet: sh, expenseSheet: esh });

    const plan = M.dedupeSettlementRowsAdmin('tok', { dryRun: true });
    rec('정리 dryRun: 중복 1건 식별', plan.settlement.duplicateRows, 1);
    rec('정리 dryRun: 금액 43', plan.settlement.duplicateGross, 43);
    rec('정리 dryRun: 수수료 중복 1건', plan.feeExpense.duplicateRows, 1);
    rec('정리 dryRun: 삭제 0', [plan.settlement.deleted, plan.feeExpense.deleted], [0, 0]);
    rec('정리 dryRun: 시트 그대로', [sh.getLastRow() - 1, esh.getLastRow() - 1], [3, 2]);

    const applied = M.dedupeSettlementRowsAdmin('tok', { dryRun: false });
    rec('정리 실행: 정산 1행 삭제', applied.settlement.deleted, 1);
    rec('정리 실행: 수수료 1행 삭제', applied.feeExpense.deleted, 1);
    rec('정리 실행: 정산 2행 잔존', sh.getLastRow() - 1, 2);
    rec('정리 실행: 수수료 1행 잔존', esh.getLastRow() - 1, 1);
    // 정본은 payoutDate 가 채워진 행
    const kept = sh.rows.slice(1).find((r) => String(r[12]) === 'TAAA4EQ2BV6');
    rec('정리 실행: payout 채워진 행 보존', String(kept[4]), '2026-07-26');

    // 정리 직후 동기화가 다시 중복을 만들면 안 된다 (rehash 가 신규 산식으로 갱신됐는지)
    const after = runImport(M, sh, [dupB, other], 'sumup');
    rec('정리 후 동기화: created=0', after.created, 0);
    rec('정리 후 동기화: 2행 유지', sh.getLastRow() - 1, 2);
  }

  // ── 8) 정리 액션 안전장치 — 참조 없는 행/타 소스는 손대지 않는다 ─────────
  {
    const noRef = { date: '2026-07-01', payoutDate: '', gross: 30, fee: 0, net: 30, paymentRef: '', bankRef: '', counterparty: 'SumUp', description: 'Barzahlung', type: 'CASH' };
    const bank = { date: '2026-07-01', payoutDate: '2026-07-01', gross: -50, fee: 0, net: -50, paymentRef: 'DE99', bankRef: 'DE99', counterparty: 'V', description: 'Miete', type: '은행출금' };
    const sh = new M.FakeSheet(SH, [
      legacyRow(M, noRef, 'sumup'), legacyRow(M, noRef, 'sumup'),
      legacyRow(M, bank, 'deutschebank'), legacyRow(M, bank, 'deutschebank'),
    ]);
    M.setSheets({ settlementSheet: sh, expenseSheet: new M.FakeSheet(EH, []) });
    const applied = M.dedupeSettlementRowsAdmin('tok', { dryRun: false });
    rec('정리 안전: 참조없음·타소스 미삭제', applied.settlement.deleted, 0);
    rec('정리 안전: 4행 그대로', sh.getLastRow() - 1, 4);
    // 참조 없는 행도 해시는 신규 산식으로 갱신돼야 한다 — 안 하면 payout 채워진 뒤 임포트가 새 행을 만든다
    const later = Object.assign({}, noRef, { payoutDate: '2026-07-05', fee: 0.4, net: 29.6 });
    const after = runImport(M, sh, [later], 'sumup');
    rec('정리 후 참조없는 행: created=0', after.created, 0);
    rec('정리 후 참조없는 행: 4행 유지', sh.getLastRow() - 1, 4);
  }
}

// ── 9) 매칭 후보 장부 창 — 결제일과 촬영일이 어긋난 건이 경계에서 새면 안 된다 ──
async function runWindowScenarios(M, rec) {
  const w = M.settlementMatchLedgerWindow_('2026-07-24', '2026-07-30');
  rec('장부창: 시작 14일 앞', w.start, '2026-07-10');
  rec('장부창: 끝 14일 뒤', w.end, '2026-08-13');
  const empty = M.settlementMatchLedgerWindow_('', '');
  rec('장부창: 빈 기간은 그대로', [empty.start, empty.end], ['', '']);
  const dst = M.settlementMatchLedgerWindow_('2026-03-25', '2026-03-25');   // 서머타임 경계
  rec('장부창: DST 경계도 14일', [dst.start, dst.end], ['2026-03-11', '2026-04-08']);
}

// ── 10) 장부 대조 선점 — 장부 건 1개는 거래 1개만 가져간다 ──────────────────
/** refreshSettlementMatchesForPeriod_ 의 배정 루프를 그대로 옮긴 하네스(구조 검증이 원본을 못박는다) */
function assignMatches(M, txs, entries) {
  const claimed = {};
  const prelim = txs.map((tx) => ({ tx, match: M.matchSettlementTransaction_(tx, entries, txs, {}) }))
    .sort((a, b) => (Number(b.match && b.match.score || 0)) - (Number(a.match && a.match.score || 0)));
  const out = [];
  prelim.forEach((p) => {
    let match = p.match;
    if (match && match.entryKey && claimed[match.entryKey]) {
      match = M.matchSettlementTransaction_(p.tx, entries, txs, { claimedEntries: claimed });
    }
    if (match && match.entryKey) claimed[match.entryKey] = true;
    out.push({ ref: p.tx.paymentRef, status: match.status, row: match.rowIndex || '' });
  });
  return out;
}

async function runMatchScenarios(M, rec) {
  const entry = (over) => Object.assign({
    date: '2026-07-04', flow: 'income', gross: 30, payMethod: '카드', name: '김나윤',
    type: '촬영예약', source: 'booking', rowIndex: 180, accountingClass: '여권/비자 매출',
  }, over || {});
  const tx = (over) => Object.assign({
    source: 'sumup', date: '2026-07-04', gross: 30, counterparty: 'VISA', description: 'Zahlung',
    paymentRef: 'T1',
  }, over || {});

  // 같은 금액 카드결제 2건 + 예약 1건 — 날짜가 딱 맞는 쪽이 가져가고 나머지는 review
  {
    const got = assignMatches(M, [tx({ date: '2026-07-03', paymentRef: 'T03' }), tx({ date: '2026-07-04', paymentRef: 'T04' })], [entry()]);
    const byRef = Object.fromEntries(got.map((g) => [g.ref, g]));
    rec('선점: 당일 거래가 예약을 가져간다', [byRef.T04.status, byRef.T04.row], ['matched', 180]);
    rec('선점: 하루 어긋난 거래는 review', byRef.T03.status, 'review');
  }
  // 예약이 2건이면 둘 다 매칭되되 서로 다른 행을 문다
  {
    const got = assignMatches(M,
      [tx({ date: '2026-07-03', paymentRef: 'T03' }), tx({ date: '2026-07-04', paymentRef: 'T04' })],
      [entry(), entry({ date: '2026-07-03', rowIndex: 181, name: '다른손님' })]);
    const rows = got.map((g) => g.row).sort();
    rec('선점: 2건이면 1:1 배정', rows, [180, 181]);
    rec('선점: 둘 다 matched', got.every((g) => g.status === 'matched'), true);
  }
  // 시트가 달라 행번호가 겹쳐도 서로 다른 건으로 본다
  {
    rec('장부키: source 포함', M.settlementEntryKey_({ source: 'expense', rowIndex: 180 }), 'expense|180');
    rec('장부키: 예약과 지출이 안 겹침', M.settlementEntryKey_({ source: 'booking', rowIndex: 180 }) !== M.settlementEntryKey_({ source: 'expense', rowIndex: 180 }), true);
  }
}

// ── 구조 검증 — 실제 임포트 루프가 같은 함수를 쓰는지 소스에서 못박는다 ──────
const STRUCTURE = [
  ['CSV 임포트가 통합 인덱스를 쓴다', /const existingIndex=getSettlementIndex_\(sh\);/],
  ['CSV 임포트가 seq 카운터를 쓴다', /const nextSeq=makeSettlementSeqCounter_\(\);[\s\S]{0,4000}?tx\.hash=buildSettlementHash_\(source,tx,raw,tx\.seq\);/],
  ['CSV 임포트가 findSettlementRow_ 로 찾는다', /const found=findSettlementRow_\(existingIndex,tx\);/],
  ['CSV 임포트가 append 후 등록한다', /sh\.appendRow\(rowValues\);\n[^\n]*\n\s*registerSettlementRow_\(existingIndex,tx,found\.refKey,sh\.getLastRow\(\)\);/],
  ['SumUp API 동기화가 seq/해시를 새 산식으로 만든다', /tx\.hash=buildSettlementHash_\('sumup',tx,raw,tx\.seq\);/],
  ['SumUp API 동기화가 findSettlementRow_ 로 찾는다', /const found=findSettlementRow_\(existingIndex,tx\);[\s\S]{0,2000}?registerSettlementRow_\(existingIndex,tx,found\.refKey,sh\.getLastRow\(\)\)/],
  // 동기화의 기존-행 갱신은 매칭 컬럼을 **무조건 보존**해야 한다(강등도 승격도 금지). 그래야
  // created==0 틱에서 claimless 매칭이 1:1 배정을 덮어써 이중매칭을 되살리지 못한다.
  ['동기화가 기존 행의 매칭을 무조건 보존한다', () => {
    const body = extractFn(gs, 'syncRecentSumupTransactions_');
    // 조건부(review 일 때만) 보존이 아니라 prevStatus 존재 시 항상 보존하는 형태여야 한다
    if (/if\(tx\.matchStatus==='review'\)\{\s*\n\s*const prev=/.test(body)) return false; // 옛 조건부 가드가 남아있으면 실패
    return /if\(found\.rowIndex\)\{[\s\S]{0,900}?const prevStatus=String\(prev\[SETTLEMENT_COL\['매칭상태'\]\]\|\|''\)\.trim\(\);\s*\n\s*if\(prevStatus\)\{\s*\n\s*tx\.matchStatus=prevStatus;/.test(body);
  }],
  ['CSV 임포트도 ±14일 장부 창을 쓴다', /const ledgerWin=settlementMatchLedgerWindow_\(startDate,endDate\);\n\s*const accounting=getAccountingLedger\(token,ledgerWin\.start,ledgerWin\.end,false,sheets\);/],
  ['CSV 최종 재매칭도 같은 창을 쓴다', /\? getAccountingLedger\(token,ledgerWin\.start,ledgerWin\.end,false,sheets\)\n\s*: accounting;/],
  ['해시 base 에 사후값이 없다', /function buildSettlementHash_\(source,tx,raw,seq\)\{\n\s*return sha256Hex32_\(settlementIdentityKey_\(source,tx\)\+'\|'\+String\(seq\|\|0\)\);/],
  ['정체성 키에 payoutDate/fee/net 이 없다', (src) => {
    const body = extractFn(src, 'settlementIdentityKey_');
    return !/payoutDate|\btx\.fee\b|\btx\.net\b/.test(body);
  }],
  ['ref 키는 sumup 전용', /function settlementRefKey_\(source,ref\)\{[\s\S]{0,300}?if\(s!=='sumup'\) return '';/],
  ['은행 지출 upsert 가 구 해시도 조회한다', /importMap\[expenseId\] \|\| importMap\['bank_out:'\+buildSettlementHashLegacy_\('deutschebank',tx\)\]/],
  ['정리 액션 기본이 dryRun', /const dryRun=opts\.dryRun!==false;/],
  ['에이전트 액션 등록', /action==='settlement-dedupe'/],
  ['재매칭 에이전트 액션 등록', /action==='settlement-rematch'/],
  ['15분 동기화가 신규행 발생 시 재매칭한다', /if\(created>0\)\{[\s\S]{0,600}?refreshSettlementMatchesForPeriod_\(sheets,startDate,endDate,ledger\)/],
  ['재매칭 실패가 동기화를 죽이지 않는다', /rematched=\(refreshSettlementMatchesForPeriod_[\s\S]{0,200}?\}catch\(e\)\{/],
  ['동기화 응답에 rematched 를 싣는다', /\n    rematched,\n/],
  ['재매칭은 넓힌 장부 창을 쓴다', /const win=settlementMatchLedgerWindow_\(startDate,endDate\);\n\s*const ledger=buildAccountingLedger_\(win\.start,win\.end,false,sheets\);/],
  ['어드민 재매칭도 넓힌 창을 쓴다', /const win=settlementMatchLedgerWindow_\(startDate,endDate\);\n\s*const accounting=buildAccountingLedger_\(win\.start,win\.end,false,sheets\);/],
  ['배정 루프가 점수 내림차순으로 선점한다', /const prelim=txs\.map\(function\(tx\)\{[\s\S]{0,400}?\.sort\(function\(a,b\)\{\n\s*return \(Number\(b\.match&&b\.match\.score\|\|0\)\)-\(Number\(a\.match&&a\.match\.score\|\|0\)\);/],
  ['선점당한 거래는 남은 후보로 재탐색한다', /if\(match&&match\.entryKey&&claimed\[match\.entryKey\]\)\{[\s\S]{0,300}?claimedEntries:claimed/],
  ['배정 후 claimed 에 등록한다', /if\(match&&match\.entryKey\) claimed\[match\.entryKey\]=true;/],
  ['카드 결제기록 경로도 선점을 지킨다', /function matchSumupBookingPayment_[\s\S]{0,900}?if\(opts\.claimedEntries && opts\.claimedEntries\['booking\|'\+String\(candidate\.rowIndex\|\|''\)\]\) return null;/],
  ['은행 결제기록 경로도 선점을 지킨다', /function matchBankInBookingPayment_[\s\S]{0,1400}?if\(opts\.claimedEntries && opts\.claimedEntries\['booking\|'\+String\(candidate\.rowIndex\|\|''\)\]\) return null;/],
  ['결제기록 매칭도 entryKey/score 를 낸다', /entryKey:'booking\|'\+String\(candidate\.rowIndex\|\|''\),\n\s*score:Number\(candidate\.score\|\|0\),/],
  ['장부 본체가 무인증으로 분리됐다', /function getAccountingLedger\(token, startDate, endDate, forceRefresh, sheetsOpt\) \{\n\s*assertAdmin_\(token\);\n\s*return buildAccountingLedger_\(startDate, endDate, forceRefresh, sheetsOpt\);/],
];

// ── 결함 주입 — 고친 지점을 되돌리면 반드시 시나리오가 깨져야 한다 ──────────
const FAULTS = [
  ['해시에 payoutDate 복귀(회차마다 키가 바뀜)',
    /return sha256Hex32_\(settlementIdentityKey_\(source,tx\)\+'\|'\+String\(seq\|\|0\)\);/,
    "return sha256Hex32_(settlementIdentityKey_(source,tx)+'|'+String(tx.payoutDate||'')+'|'+String(seq||0));"],
  ['해시에 fee 복귀(payout 후 수수료가 채워지면 키가 바뀜)',
    /return sha256Hex32_\(settlementIdentityKey_\(source,tx\)\+'\|'\+String\(seq\|\|0\)\);/,
    "return sha256Hex32_(settlementIdentityKey_(source,tx)+'|'+String(tx.fee||0)+'|'+String(seq||0));"],
  ['ref 키 제거(해시만으로 dedup)',
    /if\(s!=='sumup'\) return '';/,
    "if(true) return '';"],
  ['ref 키를 은행까지 허용(서로 다른 이체가 한 행으로 뭉개짐)',
    /if\(s!=='sumup'\) return '';/,
    "if(!s) return '';"],
  ['legacy 해시 폴백 제거(배포 직후 전량 신규행)',
    /const legacy=tx\.source\+'\|'\+buildSettlementHashLegacy_\(tx\.source,tx\);\n\s*if\(index\.byHash\[legacy\]\) return \{rowIndex:index\.byHash\[legacy\],refKey:refKey\};/,
    ''],
  /* registerSettlementRow_ 는 여기서 결함주입 대상이 아니다 — seq 번호 매기기가 이미 배치 안 충돌을
     막고 있어 등록을 빼도 현재 시나리오로는 차이가 안 난다(보험성 코드). 구조 검증에서 호출 존재만
     못박는다. 없애도 되는 코드로 오해하지 말 것: seq 규칙이 바뀌면 즉시 필요해진다. */
  ['refSeq 무시(파일 안 동일참조 2줄이 한 행으로 겹침)',
    /const refKey=Number\(tx\.refSeq\|\|0\)>0 \? '' : settlementRefKey_\(tx\.source,tx\.paymentRef\);/,
    'const refKey=settlementRefKey_(tx.source,tx.paymentRef);'],
  ['seq 무시(파일 안 동일내용 2건이 1행으로 합쳐짐)',
    /const seq=\(idCount\[idKey\]=\(idCount\[idKey\]\|\|0\)\+1\)-1;/,
    'const seq=0;'],
  ['수수료 설명 인덱스 제거(구 ID 행을 못 찾아 이중계상)',
    /const byDesc=Number\(map\.byDesc\[sumupFeeExpenseDesc_\(tx\)\]\|\|0\);\n\s*if\(byDesc\) return byDesc;/,
    ''],
  ['수수료 ID 가 해시 기반으로 회귀',
    /if\(ref\) return 'sumup_fee:ref:'\+ref;/,
    ''],
  ['정리 액션이 참조 없는 행까지 삭제(같은 날 같은 금액의 별개 거래가 사라짐)',
    /if\(refKey\) \(groups\[refKey\]=groups\[refKey\]\|\|\[\]\)\.push\(entry\);/,
    "const gk=refKey||[source,entry.date,entry.gross].join('|'); (groups[gk]=groups[gk]||[]).push(entry);"],
  ['정리 액션이 dryRun 에서도 삭제',
    /if\(!dryRun\)\{\n\s*rehash\.forEach/,
    'if(true){\n      rehash.forEach'],
  ['정리 액션이 정본을 payout 없는 행으로 선택',
    /if\(!!b\.payout!==!!a\.payout\) return b\.payout\?1:-1;/,
    'if(!!b.payout!==!!a.payout) return b.payout?-1:1;'],
  ['장부 선점 제거(같은 금액 카드결제 2건이 같은 예약을 동시에 문다)',
    /if\(claimedEntries && claimedEntries\[settlementEntryKey_\(entry\)\]\) return false;/,
    ''],
  ['장부키에서 source 제거(예약행과 지출행이 같은 건으로 취급)',
    /return String\(entry&&entry\.source\|\|''\)\+'\|'\+String\(entry&&entry\.rowIndex\|\|''\);/,
    "return String(entry&&entry.rowIndex||'');"],
  ['장부 창 확대 제거(결제일·촬영일이 어긋난 경계 건이 영영 review)',
    /return \{start:startDate\?shift\(startDate,-14\):'', end:endDate\?shift\(endDate,14\):''\};/,
    "return {start:startDate,end:endDate};"],
  ['정리 후 rehash 생략(다음 동기화가 또 중복 생성)',
    /result\.settlement\.rehashed=rehash\.length;/,
    'result.settlement.rehashed=rehash.length; rehash.length=0;'],
];

// ── 실행 ────────────────────────────────────────────────────────────────────
let failures = 0;
const { mod: M, dir } = await load(MODULE);
let count = 0;
const check = (name, actual, expected) => {
  count += 1;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures += 1;
    console.error(`❌ ${name}\n   기대: ${JSON.stringify(expected)}\n   실제: ${JSON.stringify(actual)}`);
  }
};
await runScenarios(M, check);
await runWindowScenarios(M, check);
await runMatchScenarios(M, check);
rmSync(dir, { recursive: true, force: true });

let structureCount = 0;
STRUCTURE.forEach(([label, pattern]) => {
  structureCount += 1;
  const ok = typeof pattern === 'function' ? pattern(gs) : pattern.test(gs);
  if (!ok) { failures += 1; console.error(`❌ 구조 검증 실패: ${label}`); }
});

if (failures) {
  console.error(`\n총 ${failures}건 불일치 — 정산 dedup 이 깨졌습니다.`);
  process.exit(1);
}
console.log(`행동 시나리오 ${count}건 + 구조 검증 ${structureCount}건`);
console.log('✅ payout 전후 재동기화·재임포트·구버전행·은행 IBAN·수수료 ID·정리 액션 모두 정확.');

for (const [label, pattern, replacement] of FAULTS) {
  if (!pattern.test(MODULE)) {
    console.error(`\n❌ 결함주입 대상 패턴을 못 찾음: ${label} (원본 변경 시 검증기 동기화 필요)`);
    process.exit(1);
  }
  const broken = MODULE.replace(pattern, replacement);
  const { mod: bm, dir: bd } = await load(broken);
  const diffs = [];
  try {
    const collect = (name, actual, expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) diffs.push(name);
    };
    await runScenarios(bm, collect);
    await runWindowScenarios(bm, collect);
    await runMatchScenarios(bm, collect);
  } catch (e) { diffs.push('예외: ' + e.message); }
  rmSync(bd, { recursive: true, force: true });
  if (!diffs.length) {
    console.error(`\n❌ 결함을 심었는데 통과: ${label}`);
    process.exit(1);
  }
  console.log(`   결함 감지 OK — ${label} (${diffs.length}개 실패)`);
}
console.log(`✅ 결함 주입 ${FAULTS.length}/${FAULTS.length} 모두 감지`);
