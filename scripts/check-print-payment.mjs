#!/usr/bin/env node
/**
 * check-print-payment.mjs — 셀렉 추가금 수납·인화장부 행 동기화 검증기
 *
 * 셀렉 추가금 행은 syncSelectPrintOrder_ 가 '미결제/대기중'으로 만든다. 범용 행 편집으로 개별
 * 수정은 가능했지만 미수 집계·수납일 기록이 없어 사실상 방치되던 지점. 수납 기록을 붙이면서
 * 두 개의 숨은 함정이 같이 열린다:
 *   1) 메모에 스탬프를 찍으면 findSelectPrintOrderRow_ 의 '메모 전체 정확일치'가 깨져 중복 행이 생긴다
 *   2) 재동기화는 행 전체를 덮어써서 이미 받은 수납 기록과 매출날짜를 지운다
 * 그래서 재구현이 아니라 Code.gs **원본 소스를 떼어내** 가짜 시트 위에서 돌린다.
 *
 * 사용법:  node scripts/check-print-payment.mjs        (불일치 시 exit 1)
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

const printHeadersLine = gs.split('\n').find((l) => l.includes("PRINT_HEADERS: ['주문일시'"));
if (!printHeadersLine) throw new Error('PRINT_HEADERS 를 찾지 못했습니다.');

// 가짜 시트 — getRange/getDataRange/appendRow/deleteRow 만 구현. 실제 SpreadsheetApp 의미와 동일하게
// 1-based 행/열, getValues()는 복사본이 아니라 참조 스냅샷이 아님(복사본)에 주의해 setValues 로만 쓴다.
const FAKE_SHEET = `
class FakeSheet {
  constructor(headers, rows){ this.rows=[headers.slice()].concat(rows.map(r=>r.slice())); this.width=headers.length; }
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
  appendRow(row){ this.rows.push(row.slice()); }
  deleteRow(r){ this.rows.splice(r-1,1); }
}
`;

const MODULE = [
  `const CONFIG={TIMEZONE:'Europe/Berlin',${printHeadersLine.trim().replace(/,$/, '')}};`,
  `const PRINT_COL=CONFIG.PRINT_HEADERS.reduce((a,h,i)=>{a[h]=i;return a;},{});`,
  `const SELECT_COL={'고객명':0,'연락처':1};`,
  `let __NOW__=new Date('2026-07-27T10:00:00');`,
  `const Utilities={formatDate:(d,tz,f)=>{
     const p=(n)=>String(n).padStart(2,'0');
     const s=\`\${d.getFullYear()}-\${p(d.getMonth()+1)}-\${p(d.getDate())} \${p(d.getHours())}:\${p(d.getMinutes())}:\${p(d.getSeconds())}\`;
     return f.includes('HH')?s:s.slice(0,10);
   }};`,
  `const Logger={log:()=>{}};`,
  FAKE_SHEET,
  extractFn(gs, 'roundCurrency_'),
  `function formatDateMinute_(d){ return Utilities.formatDate(d,CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm'); }`,
  extractFn(gs, 'parseDateSafe_'),
  extractFn(gs, 'getPrintSheetColMap_'),
  extractFn(gs, 'buildPrintSheetRow_'),
  extractFn(gs, 'isPrintRowUnpaid_'),
  extractFn(gs, 'printRowPaidDate_'),
  extractFn(gs, 'normalizePrintRow_'),
  extractFn(gs, 'selectPrintMemoTag_'),
  extractFn(gs, 'findSelectPrintOrderRow_'),
  extractFn(gs, 'syncSelectPrintOrder_'),
  extractLine(gs, 'var PRINT_PAY_METHODS_='),
  // ensureSheets_/assertAdmin_ 는 시트 주입 스텁으로 대체 — 판정 로직은 원본 그대로 돈다
  `let __SHEET__=null;`,
  `function ensureSheets_(){ return {printSheet:__SHEET__}; }`,
  `function assertAdmin_(){ return true; }`,
  extractFn(gs, 'listUnpaidSelectExtras_'),
  extractFn(gs, 'listUnpaidSelectExtrasAdmin'),
  extractFn(gs, 'markSelectExtraPaidAdmin'),
  `export {FakeSheet, isPrintRowUnpaid_, printRowPaidDate_, selectPrintMemoTag_, findSelectPrintOrderRow_,
    syncSelectPrintOrder_, listUnpaidSelectExtras_, markSelectExtraPaidAdmin,
    normalizePrintRow_, getPrintSheetColMap_};`,
  `export function __setSheet(s){ __SHEET__=s; }`,
].join('\n\n');

// 추출된 원본 함수들이 실제 new Date() 를 쓰므로, '오늘' 기대값은 하드코딩하지 않고 실행 시점에 계산한다
const TODAY = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();

const H = ['주문일시', '고객명', '연락처', '인화항목', '보정항목', '총수량', '금액', '결제수단', '메모', '상태', '매출날짜'];
const row = (o) => H.map((h) => (o[h] !== undefined ? o[h] : ''));

// 셀렉장부 행 스텁 — syncSelectPrintOrder_ 는 SELECT_COL['고객명'/'연락처'] 만 읽는다
const SELROW = ['김민지', '+4917612345678'];

async function load(src) {
  const dir = mkdtempSync(join(tmpdir(), 'printpay-'));
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

async function runScenarios(M, rec) {
  const { FakeSheet } = M;

  // ── 1) 미수 판정 ────────────────────────────────────────────────────────────
  // 빈칸은 미수가 아니다 — 옛 행/워크인 행의 결제수단 칸은 자주 비어 있고, 그걸 미수로 치면
  // 이미 받은 돈이 전부 미수금으로 되살아난다(예약 행 explicitlyUnpaid 와 같은 규칙).
  rec('미수판정: 빈 결제수단 → 미수 아님', M.isPrintRowUnpaid_({ payMethod: '' }), false);
  rec('미수판정: 공백만 있는 결제수단 → 미수 아님', M.isPrintRowUnpaid_({ payMethod: '   ' }), false);
  rec('미수판정: 미결제 → 미수', M.isPrintRowUnpaid_({ payMethod: '미결제' }), true);
  rec('미수판정: 현금 → 수납됨', M.isPrintRowUnpaid_({ payMethod: '현금' }), false);
  rec('미수판정: 카드 → 수납됨', M.isPrintRowUnpaid_({ payMethod: '카드' }), false);
  rec('미수판정: offen(독어) → 미수', M.isPrintRowUnpaid_({ payMethod: 'offen' }), true);

  // ── 2) 메모 태그 추출 ──────────────────────────────────────────────────────
  rec('태그: 순수 태그', M.selectPrintMemoTag_('셀렉:abc123'), 'abc123');
  rec('태그: 수납 스탬프가 붙어도 추출', M.selectPrintMemoTag_('셀렉:abc123 [수납] 2026-07-27 현금'), 'abc123');
  rec('태그: 공백 변형 허용', M.selectPrintMemoTag_(' 셀렉 : abc123'), 'abc123');
  rec('태그: 무관한 메모', M.selectPrintMemoTag_('현장 추가주문'), '');
  rec('태그: 메모 중간의 셀렉 표기는 태그 아님', M.selectPrintMemoTag_('참고 셀렉:zzz'), '');

  // ── 2b) 수납일 스탬프 되읽기 (현금 시재가 이 날짜를 쓴다) ─────────────────
  rec('수납일: 스탬프에서 추출', M.printRowPaidDate_('셀렉:s1 [수납] 2026-07-27 현금'), '2026-07-27');
  rec('수납일: 스탬프 없음', M.printRowPaidDate_('셀렉:s1'), '');
  rec('수납일: 메모가 붙어도 추출', M.printRowPaidDate_('셀렉:s1 [수납] 2026-03-05 카드 · 현장수령'), '2026-03-05');
  // 수납→재주문(수납해제)→재수납 사이클: 메모는 덧붙기만 하므로 반드시 **마지막** 스탬프가 실제 수납일
  rec('수납일: 재수납 사이클은 마지막 스탬프',
    M.printRowPaidDate_('셀렉:s1 [수납] 2026-07-01 현금 [수납해제] €30→€60 재주문 (기수납 현금) [수납] 2026-07-15 카드'),
    '2026-07-15');

  // ── 3) 행 찾기 — 스탬프가 찍힌 뒤에도 같은 행을 찾아야 한다(중복행 방지) ──
  {
    const sh = new FakeSheet(H, [
      row({ 고객명: '김민지', 금액: 30, 결제수단: '미결제', 메모: '셀렉:sess-AAA', 상태: '대기중' }),
      row({ 고객명: '박서준', 금액: 20, 결제수단: '현금', 메모: '셀렉:sess-BBB [수납] 2026-07-20 현금', 상태: '완료' }),
    ]);
    rec('행찾기: 순수 태그 행', M.findSelectPrintOrderRow_(sh, 'sess-AAA'), 2);
    rec('행찾기: 스탬프 붙은 행도 찾음', M.findSelectPrintOrderRow_(sh, 'sess-BBB'), 3);
    rec('행찾기: 없는 세션', M.findSelectPrintOrderRow_(sh, 'sess-ZZZ'), 0);
    rec('행찾기: 빈 세션ID', M.findSelectPrintOrderRow_(sh, ''), 0);
  }

  // ── 4) 재동기화 — 수납 기록 보존 ───────────────────────────────────────────
  {
    const sh = new FakeSheet(H, [
      row({ 주문일시: '2026-06-30 12:00', 고객명: '김민지', 금액: 30, 결제수단: '현금',
            메모: '셀렉:sess-AAA [수납] 2026-06-30 현금', 상태: '완료', 매출날짜: '2026-06-30' }),
    ]);
    // 금액 동일 재동기화 (고객이 같은 주문을 다시 제출)
    M.syncSelectPrintOrder_(sh, 'sess-AAA', SELROW, [{ photoNum: 1, label: '10x15', qty: 1, price: 30 }],
      0, 0, 30, '2026-07-27 10:00', []);
    const cm = M.getPrintSheetColMap_(sh);
    const r = M.normalizePrintRow_(sh.getDataRange().getValues()[1], 2, cm);
    rec('재동기화(금액동일): 결제수단 보존', r.payMethod, '현금');
    rec('재동기화(금액동일): 상태 보존', r.status, '완료');
    rec('재동기화(금액동일): 매출날짜 보존(분기 이동 금지)',
      String(sh.getDataRange().getValues()[1][cm['매출날짜']]), '2026-06-30');
    rec('재동기화(금액동일): 메모 스탬프 보존', r.memo, '셀렉:sess-AAA [수납] 2026-06-30 현금');
    rec('재동기화(금액동일): 행 추가 안 됨', sh.rows.length, 2);
  }

  // ── 5) 재동기화 — 수납 후 금액이 바뀌면 미수로 되돌린다 ────────────────────
  {
    const sh = new FakeSheet(H, [
      row({ 고객명: '김민지', 금액: 30, 결제수단: '현금',
            메모: '셀렉:sess-AAA [수납] 2026-06-30 현금', 상태: '완료', 매출날짜: '2026-06-30' }),
    ]);
    M.syncSelectPrintOrder_(sh, 'sess-AAA', SELROW, [{ photoNum: 1, label: '10x15', qty: 2, price: 30 }],
      0, 0, 60, '2026-07-27 10:00', []);
    const cm = M.getPrintSheetColMap_(sh);
    const r = M.normalizePrintRow_(sh.getDataRange().getValues()[1], 2, cm);
    rec('재동기화(금액변경): 미결제로 환원', r.payMethod, '미결제');
    rec('재동기화(금액변경): 상태 대기중', r.status, '대기중');
    rec('재동기화(금액변경): 금액 갱신', r.total, 60);
    rec('재동기화(금액변경): 수납해제 흔적', /\[수납해제\] €30→€60/.test(r.memo), true);
    rec('재동기화(금액변경): 태그 유지', M.selectPrintMemoTag_(r.memo), 'sess-AAA');
    // 금액이 바뀌면 그 시점이 새 주문 — 옛 매출날짜를 유지하면 이미 신고한 분기 금액이 조용히 달라진다
    rec('재동기화(금액변경): 매출날짜 오늘로 이동',
      String(sh.getDataRange().getValues()[1][cm['매출날짜']]), TODAY);
  }

  // ── 5b) 총액 0 인데 이미 수납된 행 — 지우면 받은 돈이 증발한다 ─────────────
  {
    const sh = new FakeSheet(H, [
      row({ 고객명: '김민지', 금액: 60, 결제수단: '계좌이체',
            메모: '셀렉:sess-AAA [수납] 2026-07-20 계좌이체', 상태: '완료', 매출날짜: '2026-07-18' }),
    ]);
    M.syncSelectPrintOrder_(sh, 'sess-AAA', SELROW, [], 0, 0, 0, '2026-07-27 10:00', []);
    const cm = M.getPrintSheetColMap_(sh);
    rec('총액0(기수납): 행을 지우지 않는다', sh.rows.length, 2);
    rec('총액0(기수납): 금액 보존', Number(sh.rows[1][cm['금액']]), 60);
    rec('총액0(기수납): 결제수단 보존', String(sh.rows[1][cm['결제수단']]), '계좌이체');
    rec('총액0(기수납): 환불 확인 필요 표시', /\[주문취소·기수납\]/.test(String(sh.rows[1][cm['메모']])), true);
    // 두 번 동기화해도 표시가 중복되지 않는다
    M.syncSelectPrintOrder_(sh, 'sess-AAA', SELROW, [], 0, 0, 0, '2026-07-27 11:00', []);
    rec('총액0(기수납): 표시 중복 안 됨',
      String(sh.rows[1][cm['메모']]).split('[주문취소·기수납]').length - 1, 1);
  }

  // ── 6) 재동기화 — 미수 행은 그대로 미수 ────────────────────────────────────
  {
    const sh = new FakeSheet(H, [
      row({ 고객명: '김민지', 금액: 30, 결제수단: '미결제', 메모: '셀렉:sess-AAA', 상태: '대기중', 매출날짜: '2026-07-01' }),
    ]);
    M.syncSelectPrintOrder_(sh, 'sess-AAA', SELROW, [{ photoNum: 1, label: '10x15', qty: 1, price: 45 }],
      0, 0, 45, '2026-07-27 10:00', []);
    const cm = M.getPrintSheetColMap_(sh);
    const r = M.normalizePrintRow_(sh.getDataRange().getValues()[1], 2, cm);
    rec('재동기화(미수 유지): 결제수단', r.payMethod, '미결제');
    rec('재동기화(미수 유지): 금액 갱신', r.total, 45);
    rec('재동기화(미수 유지): 수납해제 흔적 없음', /수납해제/.test(r.memo), false);
  }

  // ── 7) 신규 행 생성 ────────────────────────────────────────────────────────
  {
    const sh = new FakeSheet(H, []);
    M.syncSelectPrintOrder_(sh, 'sess-NEW', SELROW, [{ photoNum: 3, label: '13x18', qty: 1, price: 12 }],
      2, 9, 30, '2026-07-27 10:00', []);
    const cm = M.getPrintSheetColMap_(sh);
    const r = M.normalizePrintRow_(sh.getDataRange().getValues()[1], 2, cm);
    rec('신규행: 미결제로 생성', r.payMethod, '미결제');
    rec('신규행: 대기중으로 생성', r.status, '대기중');
    rec('신규행: 메모 태그', r.memo, '셀렉:sess-NEW');
    rec('신규행: 매출날짜 오늘', String(sh.getDataRange().getValues()[1][cm['매출날짜']]), TODAY);
    rec('신규행: 총수량 = 인화 + 추가보정', r.qty, 3);
  }

  // ── 8) 총액 0 → 미수 행은 삭제 ─────────────────────────────────────────────
  {
    const sh = new FakeSheet(H, [row({ 고객명: '김민지', 금액: 30, 결제수단: '미결제', 메모: '셀렉:sess-AAA' })]);
    M.syncSelectPrintOrder_(sh, 'sess-AAA', SELROW, [], 0, 0, 0, '2026-07-27 10:00', []);
    rec('총액0(미수): 행 삭제', sh.rows.length, 1);
  }

  // ── 9) 미수 목록 ───────────────────────────────────────────────────────────
  {
    const sh = new FakeSheet(H, [
      row({ 고객명: '김민지', 금액: 30, 결제수단: '미결제', 메모: '셀렉:s1', 상태: '대기중', 매출날짜: '2026-07-10' }),
      row({ 고객명: '박서준', 금액: 20, 결제수단: '현금', 메모: '셀렉:s2', 상태: '완료', 매출날짜: '2026-07-11' }),
      row({ 고객명: '이하늘', 금액: 45, 결제수단: '', 메모: '현장 추가주문', 상태: '', 매출날짜: '2026-07-05' }),
      row({ 고객명: '최유진', 금액: 15, 결제수단: '미결제', 메모: '셀렉:s4', 상태: '취소', 매출날짜: '2026-07-12' }),
      row({ 고객명: '정우성', 금액: 0, 결제수단: '미결제', 메모: '셀렉:s5', 상태: '대기중', 매출날짜: '2026-07-13' }),
    ]);
    M.__setSheet(sh);
    const res = M.listUnpaidSelectExtras_({ limit: 30 });
    rec('미수목록: 건수(취소·0원·빈칸결제수단 제외)', res.count, 1);
    rec('미수목록: 합계', res.total, 30);
    rec('미수목록: 빈칸 결제수단 행은 미수 아님', res.items.map((i) => i.name), ['김민지']);
    rec('미수목록: 세션ID 추출', res.items.map((i) => i.sessionId), ['s1']);
    rec('미수목록: 매출날짜', res.items.map((i) => i.salesDate), ['2026-07-10']);
  }

  // ── 9b) 정렬은 자르기 전에 — 시트 순서와 날짜 순서가 다를 때 ────────────────
  {
    const sh = new FakeSheet(H, [
      row({ 고객명: '신규', 금액: 10, 결제수단: '미결제', 메모: '셀렉:n1', 상태: '대기중', 매출날짜: '2026-07-20' }),
      row({ 고객명: '중간', 금액: 20, 결제수단: '미결제', 메모: '셀렉:n2', 상태: '대기중', 매출날짜: '2026-07-15' }),
      row({ 고객명: '최고참', 금액: 30, 결제수단: '미결제', 메모: '셀렉:n3', 상태: '대기중', 매출날짜: '2026-07-01' }),
    ]);
    M.__setSheet(sh);
    const r = M.listUnpaidSelectExtras_({ limit: 2 });
    rec('미수목록(limit=2): 가장 오래된 것부터 남는다', r.items.map((i) => i.name), ['최고참', '중간']);
    rec('미수목록(limit=2): count 는 전체', r.count, 3);
    rec('미수목록(limit=2): total 은 전체', r.total, 60);
    rec('미수목록(limit=2): shown 은 잘린 수', r.shown, 2);
  }

  // ── 9c) 날짜 윈도 — 창 밖은 버리지 않고 따로 보고한다 ──────────────────────
  {
    const sh = new FakeSheet(H, [
      row({ 고객명: '최근', 금액: 30, 결제수단: '미결제', 메모: '셀렉:r1', 상태: '대기중', 매출날짜: '2026-07-20' }),
      row({ 고객명: '작년', 금액: 80, 결제수단: '미결제', 메모: '셀렉:r2', 상태: '대기중', 매출날짜: '2025-03-02' }),
      row({ 고객명: '재작년', 금액: 40, 결제수단: '미결제', 메모: '셀렉:r3', 상태: '대기중', 매출날짜: '2024-11-11' }),
    ]);
    M.__setSheet(sh);
    const w = M.listUnpaidSelectExtras_({ limit: 30, sinceDays: 60 });
    rec('윈도(60일): 창 안 건수', w.count, 1);
    rec('윈도(60일): 창 안 합계', w.total, 30);
    rec('윈도(60일): 창 밖 건수 별도 보고', w.olderCount, 2);
    rec('윈도(60일): 창 밖 합계 별도 보고', w.olderTotal, 120);
    const nofloor = M.listUnpaidSelectExtras_({ limit: 30 });
    rec('윈도 없음(어드민): 전부 보인다', nofloor.count, 3);
    rec('윈도 없음(어드민): olderCount 0', nofloor.olderCount, 0);
  }

  // ── 10) 수납 기록 ──────────────────────────────────────────────────────────
  {
    const mk = () => new FakeSheet(H, [
      row({ 고객명: '김민지', 금액: 30, 결제수단: '미결제', 메모: '셀렉:s1', 상태: '대기중', 매출날짜: '2026-07-10' }),
      row({ 고객명: '박서준', 금액: 20, 결제수단: '미결제', 메모: '셀렉:s2', 상태: '출력완료', 매출날짜: '2026-07-11' }),
      row({ 고객명: '이하늘', 금액: 45, 결제수단: '카드', 메모: '셀렉:s3', 상태: '완료', 매출날짜: '2026-07-05' }),
    ]);

    let sh = mk(); M.__setSheet(sh);
    const r1 = M.markSelectExtraPaidAdmin('tok', { printRowIndex: 2, payMethod: '현금' });
    const cm = M.getPrintSheetColMap_(sh);
    rec('수납: ok', r1.ok, true);
    rec('수납: 결제수단 기록', String(sh.rows[1][cm['결제수단']]), '현금');
    rec('수납: 대기중 → 완료', String(sh.rows[1][cm['상태']]), '완료');
    rec('수납: 메모 스탬프', new RegExp('^셀렉:s1 \\[수납\\] ' + TODAY + ' 현금$').test(String(sh.rows[1][cm['메모']])), true);
    rec('수납 후에도 행을 찾을 수 있다', M.findSelectPrintOrderRow_(sh, 's1'), 2);

    sh = mk(); M.__setSheet(sh);
    M.markSelectExtraPaidAdmin('tok', { printRowIndex: 3, payMethod: '카드' });
    const cm2 = M.getPrintSheetColMap_(sh);
    rec('수납: 진행중 상태(출력완료)는 되돌리지 않음', String(sh.rows[2][cm2['상태']]), '출력완료');

    sh = mk(); M.__setSheet(sh);
    const r3 = M.markSelectExtraPaidAdmin('tok', { printRowIndex: 4, payMethod: '현금' });
    rec('수납: 이미 수납된 건 → alreadyPaid', r3.alreadyPaid, true);
    rec('수납: 이미 수납된 건 → 결제수단 안 바뀜', String(sh.rows[3][M.getPrintSheetColMap_(sh)['결제수단']]), '카드');

    sh = mk(); M.__setSheet(sh);
    const r4 = M.markSelectExtraPaidAdmin('tok', { sessionId: 's2', payMethod: '계좌이체' });
    rec('수납: sessionId 로 조회', r4.rowIndex, 3);
    rec('수납: sessionId 조회 후 결제수단', String(sh.rows[2][M.getPrintSheetColMap_(sh)['결제수단']]), '계좌이체');

    sh = mk(); M.__setSheet(sh);
    let threw = '';
    try { M.markSelectExtraPaidAdmin('tok', { printRowIndex: 2, expectName: '박서준', payMethod: '현금' }); }
    catch (e) { threw = e.message; }
    rec('수납: 고객명 불일치 시 거부', /불일치/.test(threw), true);
    rec('수납: 거부 시 시트 무변경', String(sh.rows[1][M.getPrintSheetColMap_(sh)['결제수단']]), '미결제');

    sh = mk(); M.__setSheet(sh);
    threw = '';
    try { M.markSelectExtraPaidAdmin('tok', { printRowIndex: 2, payMethod: '미결제' }); }
    catch (e) { threw = e.message; }
    rec("수납: '미결제'를 수납수단으로 쓸 수 없음", /미결제/.test(threw), true);

    sh = mk(); M.__setSheet(sh);
    threw = '';
    try { M.markSelectExtraPaidAdmin('tok', { sessionId: 'nope', payMethod: '현금' }); }
    catch (e) { threw = e.message; }
    rec('수납: 없는 세션 거부', /찾을 수 없습니다/.test(threw), true);

    // 금액 대조 — 같은 고객이 추가금 행을 둘 가질 때 이름만으론 행 밀림을 못 잡는다
    sh = mk(); M.__setSheet(sh);
    threw = '';
    try { M.markSelectExtraPaidAdmin('tok', { printRowIndex: 2, expectName: '김민지', expectAmount: 999, payMethod: '현금' }); }
    catch (e) { threw = e.message; }
    rec('수납: 금액 불일치 시 거부', /금액 불일치/.test(threw), true);
    rec('수납: 금액 거부 시 시트 무변경', String(sh.rows[1][M.getPrintSheetColMap_(sh)['결제수단']]), '미결제');

    sh = mk(); M.__setSheet(sh);
    const rAmt = M.markSelectExtraPaidAdmin('tok', { printRowIndex: 2, expectName: '김민지', expectAmount: 30, payMethod: '현금' });
    rec('수납: 금액 일치 시 통과', rAmt.ok, true);

    /* 행 밀림 재현 — 같은 고객(김민지)의 다른 추가금 행이 그 자리로 올라온다.
       세션ID를 1순위로 쓰면 밀려도 정확한 행을 찾는다. */
    {
      const shifted = new FakeSheet(H, [
        row({ 고객명: '박서준', 금액: 80, 결제수단: '미결제', 메모: '셀렉:x0', 상태: '대기중', 매출날짜: '2026-07-01' }),
        row({ 고객명: '김민지', 금액: 30, 결제수단: '미결제', 메모: '셀렉:s1', 상태: '대기중', 매출날짜: '2026-07-10' }),
        row({ 고객명: '김민지', 금액: 20, 결제수단: '미결제', 메모: '셀렉:s2', 상태: '대기중', 매출날짜: '2026-07-11' }),
      ]);
      shifted.deleteRow(2); // 목록을 본 뒤 다른 창에서 박서준 행이 삭제됨 → 김민지 30€ 가 2행으로
      M.__setSheet(shifted);
      // 사용자가 본 것: 3행 · 김민지 · 30€ (세션 s1)
      const rr = M.markSelectExtraPaidAdmin('tok', { sessionId: 's1', printRowIndex: 3, expectName: '김민지', expectAmount: 30, payMethod: '현금' });
      const cmS = M.getPrintSheetColMap_(shifted);
      rec('행밀림: 세션ID로 올바른 행을 찾음', rr.rowIndex, 2);
      rec('행밀림: 30€ 행이 수납됨', String(shifted.rows[1][cmS['결제수단']]), '현금');
      rec('행밀림: 20€ 행은 그대로 미결제', String(shifted.rows[2][cmS['결제수단']]), '미결제');
    }

    sh = mk(); M.__setSheet(sh);
    threw = '';
    try { M.markSelectExtraPaidAdmin('tok', { printRowIndex: 99, payMethod: '현금' }); }
    catch (e) { threw = e.message; }
    rec('수납: 범위 밖 행 거부', /잘못된 인화장부 행/.test(threw), true);

    sh = mk(); M.__setSheet(sh);
    const r5 = M.markSelectExtraPaidAdmin('tok', { printRowIndex: 2, payMethod: '엉뚱한수단' });
    rec('수납: 화이트리스트 밖 결제수단 → 현금 폴백', r5.payMethod, '현금');

    // 수납 → 재동기화(금액 동일) → 수납 상태가 살아남는가 (실전 순서 그대로)
    sh = mk(); M.__setSheet(sh);
    M.markSelectExtraPaidAdmin('tok', { printRowIndex: 2, payMethod: '현금' });
    M.syncSelectPrintOrder_(sh, 's1', SELROW, [{ photoNum: 1, label: '10x15', qty: 1, price: 30 }],
      0, 0, 30, '2026-07-27 11:00', []);
    const after = M.normalizePrintRow_(sh.getDataRange().getValues()[1], 2, M.getPrintSheetColMap_(sh));
    rec('E2E: 수납 후 재동기화해도 수납 유지', after.payMethod, '현금');
    rec('E2E: 수납 후 재동기화해도 중복행 없음', sh.rows.length, 4);
    M.__setSheet(sh);
    rec('E2E: 수납 후 미수목록에서 사라짐',
      M.listUnpaidSelectExtras_({ limit: 30 }).items.map((i) => i.name), ['박서준']);
  }
}

// ── 본 검증 ──────────────────────────────────────────────────────────────────
const { mod, dir } = await load(MODULE);
const baseline = [];
await runScenarios(mod, (name, actual, expected) => { baseline.push([name, actual, expected]); check(name, actual, expected); });
rmSync(dir, { recursive: true, force: true });

console.log(`시나리오 ${baseline.length}건 검증`);
if (failures.length) {
  console.error(`\n❌ 불일치 ${failures.length}건\n`);
  failures.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log('✅ 전부 일치');

// ── 결함 주입 — 검증기가 실제로 잡는지 증명한다(통과만 하는 검증기는 검증기가 아니다) ──
const FAULTS = [
  ['수납 스탬프가 행찾기를 깨뜨림(정확일치 회귀)',
    /const tag=selectPrintMemoTag_\(rows\[i\]\[memoIdx\]\);\n\s*if\(tag&&candidates\.has\(tag\)\) return i\+1;/,
    'const tag=String(rows[i][memoIdx]||"").trim();\n    if(candidates.has(tag)) return i+1;'],
  ['재동기화가 수납 기록을 덮어씀', /payMethod=String\(prev\.payMethod\|\|''\);/, 'payMethod="미결제";'],
  ['재동기화가 매출날짜를 오늘로 밀어버림',
    /if\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(prevSales\)\) salesDate=prevSales;/, ''],
  ['금액 변경 후에도 수납 상태 유지(차액 영구 미회수)',
    /memoOut\+=` \[수납해제\]/, 'payMethod=String(prev.payMethod||"");status=String(prev.status||"완료");memoOut+=` [무시]'],
  ['금액 변경인데 매출날짜를 옛 분기에 남김',
    /memoOut\+=` \[수납해제\] €\$\{prevAmt\}→€\$\{newAmt\} 재주문 \(기수납 \$\{String\(prev\.payMethod\|\|''\)\}\)`;\n\s*salesDate=Utilities\.formatDate\(new Date\(\),CONFIG\.TIMEZONE,'yyyy-MM-dd'\);/,
    "memoOut+=` [수납해제] €${prevAmt}→€${newAmt} 재주문 (기수납 ${String(prev.payMethod||'')})`;"],
  ['빈 결제수단을 미수로 오판(옛 행 전부 미수금화)', /if\(!pm\) return false;/, 'if(!pm) return true;'],
  ['수납된 행을 총액0에서 삭제(받은 돈 증발)',
    /if\(isPrintRowUnpaid_\(prev\)\|\|roundCurrency_\(Number\(prev\.total\)\|\|0\)<=0\)\{\n\s*sh\.deleteRow\(rowIdx\);/,
    'if(true){\n        sh.deleteRow(rowIdx);'],
  ['미수 목록 count 가 limit 에 잘림', /return\{ok:true,count:all\.length,/, 'return{ok:true,count:items.length,'],
  ['정렬 전에 잘라서 가장 오래된 건이 누락',
    /all\.sort\(function\(a,b\)\{return a\.salesDate<b\.salesDate\?-1:\(a\.salesDate>b\.salesDate\?1:0\);\}\);\n\s*const items=all\.slice\(0,limit\);/,
    'const items=all.slice(0,limit);\n  items.sort(function(a,b){return a.salesDate<b.salesDate?-1:(a.salesDate>b.salesDate?1:0);});'],
  ['날짜 윈도 밖 건을 조용히 버림(합계 미보고)',
    /if\(floor&&salesDate&&salesDate<floor\)\{olderCount\+\+;olderTotal\+=amt;continue;\}/,
    'if(floor&&salesDate&&salesDate<floor){continue;}'],
  ['수납이 진행 상태를 완료로 되돌림', /const raiseStatus=\(st==='대기중'\);/, 'const raiseStatus=true;'],
  ['이미 수납된 건을 덮어씀', /if\(!isPrintRowUnpaid_\(n\)\)\{\n\s*return\{ok:true,alreadyPaid:true/, 'if(false){\n    return{ok:true,alreadyPaid:true'],
  ['고객명 불일치 가드 제거', /if\(expectName&&String\(n\.name\|\|''\)\.trim\(\)!==expectName\)\{/, 'if(false){'],
  ['금액 대조 가드 제거', /if\(Math\.abs\(want-rowAmount\)>0\.005\)\{/, 'if(false){'],
  ['세션ID보다 행번호를 우선(행 밀림에 취약)',
    /const sid=String\(payload\.sessionId\|\|''\)\.trim\(\);\n  let rowIdx=0;\n  if\(sid\)\{/,
    "const sid=String(payload.sessionId||'').trim();\n  let rowIdx=parseInt(payload.printRowIndex,10)||0;\n  if(!rowIdx&&sid){"],
  ['취소 행이 미수로 집계됨', /if\(\/취소\|환불\|cancel\/i\.test\(String\(n\.status\|\|''\)\)\) continue;/, ''],
  ['수납일 스탬프를 못 읽음(현금 시재 날짜 오류)', /return m\?m\[1\]:'';\n\}/, "return '';\n}"],
  ['수납일이 첫 스탬프로 회귀(재수납 시 옛 결제일로 시재 오염)',
    /const m=all\[all\.length-1\]\.match/, 'const m=all[0].match'],
];

let faultsCaught = 0;
for (const [label, pattern, replacement] of FAULTS) {
  if (!pattern.test(MODULE)) {
    console.error(`\n❌ 결함주입 대상 패턴을 찾지 못했습니다: ${label}`);
    console.error('   (원본이 바뀌었는데 검증기가 안 따라온 상태 — 검증기를 고치세요)');
    process.exit(1);
  }
  const broken = MODULE.replace(pattern, replacement);
  const { mod: bm, dir: bd } = await load(broken);
  const diffs = [];
  try {
    await runScenarios(bm, (name, actual, expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) diffs.push(name);
    });
  } catch (e) { diffs.push('예외: ' + e.message); }
  rmSync(bd, { recursive: true, force: true });
  if (!diffs.length) {
    console.error(`\n❌ 결함을 심었는데 검증기가 통과시켰습니다: ${label}`);
    console.error('   → 이 시나리오 세트는 해당 규칙을 실제로 검증하지 못합니다.');
    process.exit(1);
  }
  faultsCaught += 1;
  console.log(`   결함 감지 OK — ${label} (${diffs.length}개 시나리오 실패)`);
}
console.log(`✅ 결함 주입 ${faultsCaught}/${FAULTS.length} 모두 감지`);
