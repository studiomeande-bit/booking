#!/usr/bin/env node
/**
 * check-invoice-relink.mjs — 발행취소 후 대체 인보이스 · 예약 사후 연결 회귀 검증기
 *
 * 사고(2026-09-14): KOTRA row252 — STMIN-260017·260018 을 발행취소했는데 중복 가드가 여전히
 * '이미 발행됨'으로 막아 대체본 260019 를 예약 없이 수기로 뽑아야 했다. 여기서 보는 것:
 *   · findExistingInvoiceForPayload_ — 발행취소는 건너뛰고, 살아 있는 발행본은 계속 막는다
 *   · updateInvoiceAdmin(bookingRowIndex) — 행 검증, 예약행번호만 기록, 예약 메모에 감사줄,
 *     PDF 재생성 없음, 살아 있는 인보이스가 있는 예약엔 연결 거부, null 로는 해제 안 됨
 * Code.gs 원본 함수를 떼어내 가짜 시트 위에서 돌린다.
 * 사용법:  node scripts/check-invoice-relink.mjs        (실패 시 exit 1)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript/Code.gs'), 'utf8');

function extractFn(name) {
  const start = gs.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} 을 찾지 못했습니다.`);
  let depth = 0;
  for (let i = gs.indexOf('{', start); i < gs.length; i += 1) {
    if (gs[i] === '{') depth += 1;
    else if (gs[i] === '}') { depth -= 1; if (depth === 0) return gs.slice(start, i + 1); }
  }
  throw new Error(`${name} 본문 끝을 찾지 못했습니다.`);
}
const line = (needle) => gs.split('\n').find((l) => l.includes(needle));

function fakeSheet(rows) {
  const cell = (r, c) => ({
    getValue: () => rows[r - 1][c - 1],
    setValue: (v) => { rows[r - 1][c - 1] = v; },
    getValues: () => [rows[r - 1].slice(c - 1)],
  });
  return {
    rows,
    getLastRow: () => rows.length,
    getLastColumn: () => rows[0].length,
    getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
    getRange: (r, c) => cell(r, c),
  };
}

const src = [
  line('const INVOICE_HEADERS='), line('const INVOICE_COL='), line('const INVOICE_VOID_STATUSES_='),
  extractFn('findExistingInvoiceForPayload_'), extractFn('updateInvoiceAdmin'),
].join('\n');

function setup() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.INVOICE_HEADERS=INVOICE_HEADERS;this.INVOICE_COL=INVOICE_COL;', ctx);
  const IC = ctx.INVOICE_COL;
  const inv = (no, status, bookingRow, type = '예약') => {
    const r = new Array(ctx.INVOICE_HEADERS.length).fill('');
    r[IC['인보이스번호']] = no; r[IC['상태']] = status; r[IC['예약행번호']] = bookingRow; r[IC['타입']] = type;
    r[IC['총금액(€)']] = 462.5; r[IC['고객명']] = 'KOTRA';
    return r;
  };
  const invoiceSheet = fakeSheet([ctx.INVOICE_HEADERS.slice(),
    inv('STMIN-260017', '발행취소', 252), inv('STMIN-260018', '발행취소', 252),
    inv('STMIN-260019', '발행', '', '수기'), inv('STMIN-260020', '발행', 300)]);
  // 예약: 고객명=2, 예약일시=0, 요청사항=15, 총결제액=10
  const b = (name, memo = '') => { const r = new Array(20).fill(''); r[0] = '2026-09-10'; r[2] = name; r[10] = 462.5; r[15] = memo; return r; };
  const bookingSheet = fakeSheet([new Array(20).fill('h'), ...Array.from({ length: 298 }, (_, i) => b(i === 250 ? 'KOTRA' : 'x')), b('Other')]);
  let pdfCalls = 0;
  Object.assign(ctx, {
    assertAdmin_() {},
    ensureSheets_: () => ({ invoiceSheet, bookingSheet }),
    CONFIG: { TIMEZONE: 'Europe/Berlin', BOOKING_HEADERS: new Array(20).fill('h') },
    BOOKING_COL: { 예약일시: 0, 고객명: 2, 총결제액: 10, 요청사항: 15 },
    Utilities: { formatDate: () => '2026-09-14' },
    parseMoneyValue_: (v) => Number(v) || 0,
    toNumberOrZero_: (v) => Number(v) || 0,
    normalizeInvoiceCustomerName_: (v) => v,
    normalizeInvoiceDateTimeText_: (v) => v,
    createInvoicePdf_() { pdfCalls += 1; return { fileId: 'x', url: 'x' }; },
    invoiceRowToObject_: (r, rowIndex) => ({
      rowIndex, number: r[IC['인보이스번호']], status: r[IC['상태']], type: r[IC['타입']],
      bookingRowIndex: parseInt(r[IC['예약행번호']], 10) || 0, total: Number(r[IC['총금액(€)']]) || 0, refund: 0,
    }),
  });
  return { ctx, invoiceSheet, bookingSheet, IC, pdf: () => pdfCalls };
}

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fail += 1; };
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

{
  const { ctx, invoiceSheet } = setup();
  ok(ctx.findExistingInvoiceForPayload_(invoiceSheet, { bookingRowIndex: 252, type: '예약' }) === null,
    '발행취소 2건만 있는 row252 → 새 인보이스 허용');
  ok(ctx.findExistingInvoiceForPayload_(invoiceSheet, { bookingRowIndex: 300, type: '예약' })?.number === 'STMIN-260020',
    '살아 있는 발행본이 있는 row300 → 계속 차단');
}
{
  const { ctx, invoiceSheet, bookingSheet, IC, pdf } = setup();
  const res = ctx.updateInvoiceAdmin('t', { invNumber: 'STMIN-260019', bookingRowIndex: 252, expectName: 'KOTRA' });
  ok(invoiceSheet.rows[3][IC['예약행번호']] === 252, '260019 예약행번호=252 기록');
  ok(res.pdfSkipped === true && pdf() === 0, '연결 전용 호출은 PDF 재생성 안 함');
  ok(/^\[인보이스연결 2026-09-14\] STMIN-260019 예약행 -→252$/.test(bookingSheet.rows[251][15]), '예약 메모에 감사줄');
  ok(res.bookingTotal === 462.5 && res.invoiceTotal === 462.5, '응답에 예약·인보이스 총액');
  ctx.updateInvoiceAdmin('t', { invNumber: 'STMIN-260019', bookingRowIndex: 252 });
  ok(bookingSheet.rows[251][15].split('\n').length === 1, '같은 행 재연결은 no-op(감사줄 중복 없음)');
  ok(throws(() => ctx.updateInvoiceAdmin('t', { invNumber: 'STMIN-260020', bookingRowIndex: 252 }), /이미 발행된 인보이스/),
    '살아 있는 인보이스가 있는 예약엔 연결 거부');
  ok(throws(() => ctx.updateInvoiceAdmin('t', { invNumber: 'STMIN-260019', bookingRowIndex: 9999 }), /존재하지 않는 예약 행/), '없는 행 거부');
  ok(throws(() => ctx.updateInvoiceAdmin('t', { invNumber: 'STMIN-260019', bookingRowIndex: 300, expectName: 'KOTRA' }), /고객명 불일치/), 'expectName 불일치 거부');
  ok(throws(() => ctx.updateInvoiceAdmin('t', { invNumber: 'STMIN-260019', bookingRowIndex: '' }), /행 번호여야/), "'' 로는 해제 안 됨");
  ctx.updateInvoiceAdmin('t', { invNumber: 'STMIN-260019', bookingRowIndex: null, status: '발행취소' });
  ok(invoiceSheet.rows[3][IC['예약행번호']] === 252, 'null 은 연결 필드 무시(해제 아님)');
}

console.log(fail ? `\n${fail}건 실패` : '\n전부 통과');
process.exit(fail ? 1 : 0);
