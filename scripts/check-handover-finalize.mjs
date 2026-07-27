#!/usr/bin/env node
/**
 * check-handover-finalize.mjs — 수령 기록 → 최종작업완료 마감 규칙 검증기
 *
 * 왜 필요한가: 이 규칙은 **되돌리기 어려운 상태 전이**다. 한 번 마감되면 셀렉 행이 어드민 탭에서
 * 사라지고, 고객 셀렉 페이지가 잠기고, 상태를 트리거로 삼는 후속 메일이 켜진다. 실제 시트로
 * 전수 검증하려면 인화완료 기록에 스튜디오 PIN 이 필요해 사장님 것을 건드려야 하므로,
 * Code.gs 의 markSelectHandoverCore_ **원본 소스를 그대로 떼어내** 가짜 시트 위에서 돌린다.
 * (재구현이 아니라 원본 실행이라 규칙이 바뀌면 여기서 즉시 깨진다.)
 *
 * 사용법:  node scripts/check-handover-finalize.mjs        (불일치 시 exit 1)
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript/Code.gs'), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} 을 찾지 못했습니다 — 함수명이 바뀌었을 수 있습니다.`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`${name} 의 본문 끝을 찾지 못했습니다.`);
}
function extractLine(src, prefix) {
  const line = src.split('\n').find((l) => l.trimStart().startsWith(prefix));
  if (!line) throw new Error(`${prefix} 선언을 찾지 못했습니다.`);
  return line;
}

/* 원본 조각 + 가짜 환경. 시트는 (행,열) 쓰기를 기록하는 스텁으로 대체한다. */
const MODULE = [
  extractLine(gs, 'const SELECT_HEADERS='),
  'const SELECT_COL=SELECT_HEADERS.reduce((a,h,i)=>{a[h]=i;return a;},{});',
  "const BOOKING_COL={'상태':1};",
  "const CONFIG={TIMEZONE:'Europe/Berlin'};",
  // GAS 런타임 대체 — 시간은 고정값으로 두어 결과가 재현 가능하게
  `const Utilities={formatDate:(d,tz,f)=>'2026-07-27 12:00'};`,
  `const Logger={log:()=>{}};`,
  extractFn(gs, 'parseDateSafe_'),
  extractFn(gs, 'isSelectFinalLockedStatus_'),
  // isBookingCancelledStatus_ 의 의존성. 빠뜨리면 ReferenceError 가 Core 의 try/catch 에 삼켜져
  // 예약장부 쓰기가 통째로 조용히 건너뛰어진다(검증기가 처음 그 함정에 빠졌다).
  extractLine(gs, 'const BOOKING_STATUS_CANCELLED'),
  extractLine(gs, 'const BOOKING_STATUS_POSTPONED'),
  extractFn(gs, 'normalizeBookingStatus_'),
  extractFn(gs, 'isBookingCancelledStatus_'),
  extractFn(gs, 'isSelectHandoverOpen_'),
  extractLine(gs, 'var HANDOVER_METHODS_='),
  extractLine(gs, 'var HANDOVER_FINALIZE_METHODS_='),
  extractFn(gs, 'finalizeSelectRowCore_'),   // 마감 3종 세트 공용 헬퍼 (Core·우편 D+7 이 공유)
  extractFn(gs, 'markSelectHandoverCore_'),
  // 하네스가 주입: 예약장부 스텁 + '다른 활성 셀렉 행' 여부
  `let __booking={status:'셀렉완료',writes:[]};`,
  `let __otherOpen=false;`,
  `function hasOtherOpenSelectRowForBooking_(){ return __otherOpen; }`,
  `function ensureSheets_(){ return {bookingSheet:{getRange:(r,c)=>({
     getValue:()=>__booking.status,
     setValue:(v)=>{__booking.status=v;__booking.writes.push(v);}
   })}}; }`,
  `export function run(fx){
     __booking={status:fx.bookingStatus,writes:[]};
     __otherOpen=!!fx.otherOpenRow;
     const row=new Array(SELECT_HEADERS.length).fill('');
     row[SELECT_COL['상태']]=fx.status;
     row[SELECT_COL['수령방식']]=fx.deliveryMethod;
     row[SELECT_COL['출력완료일시']]=fx.printDoneAt||'';
     row[SELECT_COL['예약장부행']]=fx.bookingRow||10;
     row[SELECT_COL['고객명']]='테스트';
     const written={};
     const selSh={getRange:(r,c)=>({
       setValue:(v)=>{ written[SELECT_HEADERS[c-1]]=v; },
       getValue:()=>row[c-1]
     })};
     const res=markSelectHandoverCore_(selSh,row,2,'SID',fx.info||{});
     return {res,written,bookingStatus:__booking.status,bookingWrites:__booking.writes};
   }`
].join('\n\n');

const dir = mkdtempSync(join(tmpdir(), 'handover-'));
let run;
try {
  writeFileSync(join(dir, 'core.mjs'), MODULE);
  ({ run } = await import(pathToFileURL(join(dir, 'core.mjs')).href));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const PRINTED = '2026-07-20 15:00';
const CASES = [
  { name: '방문수령 + 인화완료 → 마감',
    fx: { status: '출력', deliveryMethod: 'pickup', printDoneAt: PRINTED, bookingStatus: '셀렉완료', info: { method: '방문수령' } },
    expect: { statusWritten: '최종작업완료', booking: '작업완료', prevCol: '출력>최종작업완료|셀렉완료' } },

  { name: '대리수령 + 인화완료 → 마감',
    fx: { status: '출력', deliveryMethod: 'pickup', printDoneAt: PRINTED, bookingStatus: '셀렉완료', info: { method: '대리수령' } },
    expect: { statusWritten: '최종작업완료', booking: '작업완료' } },

  { name: '인화 전 방문수령 → 마감 안 함 (휴대폰 큐 오터치 방어)',
    fx: { status: '작업대기', deliveryMethod: 'pickup', printDoneAt: '', bookingStatus: '셀렉완료', info: { method: '방문수령' } },
    expect: { statusWritten: '', booking: '셀렉완료' } },

  { name: '우편발송 → 마감 안 하고 상태만 우편발송',
    fx: { status: '출력', deliveryMethod: 'mail', printDoneAt: PRINTED, bookingStatus: '셀렉완료', info: { method: '우편발송' } },
    expect: { statusWritten: '우편발송', booking: '셀렉완료', prevCol: '출력>우편발송' } },

  { name: '기타(수령포기·폐기) → 마감 안 함',
    fx: { status: '출력', deliveryMethod: 'pickup', printDoneAt: PRINTED, bookingStatus: '셀렉완료', info: { method: '기타' } },
    expect: { statusWritten: '', booking: '셀렉완료' } },

  { name: '미지 method → 기타로 폴백, 마감 안 함 (화이트리스트 fail-safe)',
    fx: { status: '출력', deliveryMethod: 'pickup', printDoneAt: PRINTED, bookingStatus: '셀렉완료', info: { method: '오타값' } },
    expect: { statusWritten: '', booking: '셀렉완료' } },

  { name: 'skipFinalize:true → 마감 안 함',
    fx: { status: '출력', deliveryMethod: 'pickup', printDoneAt: PRINTED, bookingStatus: '셀렉완료', info: { method: '방문수령', skipFinalize: true } },
    expect: { statusWritten: '', booking: '셀렉완료' } },

  { name: '취소된 예약 → 예약장부 안 건드림',
    fx: { status: '출력', deliveryMethod: 'pickup', printDoneAt: PRINTED, bookingStatus: '취소됨', info: { method: '방문수령' } },
    expect: { statusWritten: '최종작업완료', booking: '취소됨', prevCol: '출력>최종작업완료' } },

  { name: '예약장부가 이미 작업완료 → 다시 안 씀 (undo 가 남의 마감을 풀지 않도록)',
    fx: { status: '출력', deliveryMethod: 'pickup', printDoneAt: PRINTED, bookingStatus: '작업완료', info: { method: '방문수령' } },
    expect: { statusWritten: '최종작업완료', booking: '작업완료', prevCol: '출력>최종작업완료', bookingWriteCount: 0 } },

  { name: '같은 예약에 다른 활성 셀렉 행 → 예약장부 보류',
    fx: { status: '출력', deliveryMethod: 'pickup', printDoneAt: PRINTED, bookingStatus: '셀렉완료', otherOpenRow: true, info: { method: '방문수령' } },
    expect: { statusWritten: '최종작업완료', booking: '셀렉완료', prevCol: '출력>최종작업완료' } },

  { name: '이미 최종작업완료인 행에 수령 기록 → 상태 재기록 없음',
    fx: { status: '최종작업완료', deliveryMethod: 'pickup', printDoneAt: PRINTED, bookingStatus: '작업완료', info: { method: '방문수령' } },
    expect: { statusWritten: '', booking: '작업완료' } },

  { name: '우편 세션에 방문수령(사장님이 직접 건넴) → 마감',
    fx: { status: '출력', deliveryMethod: 'mail', printDoneAt: PRINTED, bookingStatus: '셀렉완료', info: { method: '방문수령' } },
    expect: { statusWritten: '최종작업완료', booking: '작업완료' } },

  { name: '픽업 세션에 우편발송 → 방향 불일치로 거부',
    fx: { status: '출력', deliveryMethod: 'pickup', printDoneAt: PRINTED, bookingStatus: '셀렉완료', info: { method: '우편발송' } },
    expect: { rejected: true } }
];

const fails = [];
for (const c of CASES) {
  let out;
  try { out = run(c.fx); } catch (e) { fails.push(`[${c.name}] 실행 오류: ${e.message}`); continue; }
  const e = c.expect;
  if (e.rejected) {
    if (out.res.ok !== false) fails.push(`[${c.name}] 거부되어야 하는데 ok=${out.res.ok}`);
    continue;
  }
  if (out.res.ok !== true) { fails.push(`[${c.name}] ok=false (${out.res.message})`); continue; }
  if (out.res.statusWritten !== e.statusWritten) {
    fails.push(`[${c.name}] statusWritten="${out.res.statusWritten}" ≠ 기대 "${e.statusWritten}"`);
  }
  if (out.bookingStatus !== e.booking) {
    fails.push(`[${c.name}] 예약장부="${out.bookingStatus}" ≠ 기대 "${e.booking}"`);
  }
  if (e.prevCol !== undefined && out.written['수령직전상태'] !== e.prevCol) {
    fails.push(`[${c.name}] 수령직전상태="${out.written['수령직전상태']}" ≠ 기대 "${e.prevCol}"`);
  }
  if (e.bookingWriteCount !== undefined && out.bookingWrites.length !== e.bookingWriteCount) {
    fails.push(`[${c.name}] 예약장부 쓰기 ${out.bookingWrites.length}회 ≠ 기대 ${e.bookingWriteCount}회`);
  }
}

console.log(`수령 마감 규칙 ${CASES.length}개 시나리오 검증`);
if (fails.length) {
  console.error(`\n❌ ${fails.length}건 불일치\n`);
  fails.forEach((f) => console.error('  - ' + f));
  console.error('\n마감은 되돌리기 어려운 상태 전이입니다. 고치기 전엔 배포하지 마세요.');
  process.exit(1);
}
console.log('\n✅ 방문/대리수령만 마감 · 인화 전 마감 없음 · 취소/타행 예약장부 보호 · 되돌리기 기록 정확.');
