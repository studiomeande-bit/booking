#!/usr/bin/env node
/**
 * check-mrt-payout.mjs — booking-set-mrt-payout(MRT 정산 지급일 → 잔금입금일) 검증기
 *
 * 왜: 회계장부는 잔금입금일이 있으면 그 날짜로 매출을 귀속하는데, MRT 동기화는 그 칸을 선결제 **통지일**로
 * 채운다. §20 UStG(Ist-Versteuerung, 2026-09-25 결정) 수취시점은 정산금이 신한계좌에 들어온 날이라 이 액션이
 * 그 칸만 고친다. 세무 귀속일을 바꾸는 쓰기 경로이므로 가드(MRT 행만·미래 거부·일괄 all-or-nothing·재실행 안전)를 못박는다.
 *
 * 재구현이 아니라 Code.gs **원본 소스를 떼어내** 가짜 시트 위에서 돌린다.
 * 사용법:  node scripts/check-mrt-payout.mjs        (불일치 시 exit 1)
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
// 디스패치 등록 여부 — 함수만 있고 라우트가 빠지면 CLI 에서 INVALID_ACTION 이다
if (!gs.includes("action==='booking-set-mrt-payout'")) throw new Error('booking-set-mrt-payout 디스패치가 없습니다.');

const bookingHeadersLine = extractLine(gs, "BOOKING_HEADERS: ['예약일시'").replace(/,$/, '');
const MODULE = [
  `const CONFIG={TIMEZONE:'Europe/Berlin',${bookingHeadersLine}};`,
  `const BOOKING_COL=CONFIG.BOOKING_HEADERS.reduce((a,h,i)=>{a[h]=i;return a;},{});`,
  extractLine(gs, 'const BOOKING_STATUS_CANCELLED'),
  extractLine(gs, 'const BOOKING_STATUS_POSTPONED'),
  `const Utilities={formatDate:(d,tz,f)=>{
     const p=(n)=>String(n).padStart(2,'0');
     const s=\`\${d.getFullYear()}-\${p(d.getMonth()+1)}-\${p(d.getDate())} \${p(d.getHours())}:\${p(d.getMinutes())}\`;
     return f.includes('HH')?s:s.slice(0,10);
   }};`,
  `function _canFormatDateFast_(){ return true; }`,
  `class FakeSheet {
     constructor(headers,rows){ this.rows=[headers.slice()].concat(rows.map(r=>r.slice())); this.width=headers.length; this.writes=0; }
     getLastRow(){ return this.rows.length; }
     getRange(r,c,nr,nc){
       const self=this; const numRows=nr||1; const numCols=nc||1;
       return {
         getValues(){ const out=[]; for(let i=0;i<numRows;i++){ const row=self.rows[r-1+i]||[]; const line=[]; for(let j=0;j<numCols;j++) line.push(row[c-1+j]!==undefined?row[c-1+j]:''); out.push(line);} return out; },
         setValue(v){ self.writes++; self.rows[r-1][c-1]=v; }
       };
     }
   }`,
  extractFn(gs, 'normalizeBookingStatus_'),
  extractFn(gs, 'isBookingCancelledStatus_'),
  extractFn(gs, 'agentBoolFlag_'),
  extractFn(gs, 'formatDateMinuteFast_'),
  extractFn(gs, 'formatDateMinute_'),
  extractFn(gs, 'parseDateSafe_'),
  extractFn(gs, '_bookingRowSearchText_'),
  extractFn(gs, 'isMyRealTripBookingRow_'),
  `let __SHEET__=null;`,
  `function getDbSheet(){ return __SHEET__; }`,
  `function assertAdmin_(){ return true; }`,
  extractFn(gs, 'setMyRealTripPayoutDateForAgent_'),
  `export {FakeSheet, CONFIG, BOOKING_COL, setMyRealTripPayoutDateForAgent_ as act};`,
  `export function __setSheet(s){ __SHEET__=s; }`,
].join('\n\n');

async function load(src) {
  const dir = mkdtempSync(join(tmpdir(), 'mrtpayout-'));
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
function throws(name, fn, re) {
  try { fn(); failures.push(`${name}\n    기대: throw ${re}\n    실제: 정상 반환`); }
  catch (e) { if (!re.test(String(e.message))) failures.push(`${name}\n    기대: ${re}\n    실제: ${e.message}`); }
}

const { mod: M, dir } = await load(MODULE);
try {
  const H = M.CONFIG.BOOKING_HEADERS;
  const C = M.BOOKING_COL;
  // row187 유성현 재현 — MRT 동기화가 잔금입금일을 통지일(06-12)로 채운 상태
  function mrtRow(over) {
    const r = new Array(H.length).fill('');
    r[C['예약일시']] = '2026-06-17 15:00';
    r[C['상태']] = '작업완료';
    r[C['고객명']] = '유성현';
    r[C['결제수단']] = '마이리얼트립';
    r[C['총결제액']] = 89.59;
    r[C['잔금입금일']] = '2026-06-12';
    r[C['잔금결제여부']] = 'Y';
    r[C['요청사항']] = '[촬영장소:Frankfurt Römer]\n마이리얼트립 원화결제 158,000원';
    Object.keys(over || {}).forEach((k) => { r[C[k]] = over[k]; });
    return r;
  }
  function plainRow() { // 일반 현금 고객 — MRT 아님
    const r = new Array(H.length).fill('');
    r[C['예약일시']] = '2026-06-18 10:00'; r[C['상태']] = '작업완료'; r[C['고객명']] = '김일반';
    r[C['결제수단']] = '현금'; r[C['잔금입금일']] = '2026-06-18'; r[C['잔금결제여부']] = 'Y';
    return r;
  }
  function sheet(rows) { const sh = new M.FakeSheet(H, rows); M.__setSheet(sh); return sh; }

  // ① 단건 정정 — 잔금입금일 교체 + 요청사항에 감사 한 줄(기존 메모 보존)
  {
    const sh = sheet([mrtRow()]);
    const res = M.act('tok', { rowIndex: 2, expectName: '유성현', payoutDate: '2026-07-15', memo: '6월 여행분' });
    check('①-1 잔금입금일', sh.rows[1][C['잔금입금일']], '2026-07-15');
    check('①-2 응답', [res.ok, res.updated, res.count, res.rows[0].previous, res.rows[0].unchanged, res.rows[0].balancePaid], [true, 1, 1, '2026-06-12', false, true]);
    const memo = sh.rows[1][C['요청사항']].split('\n');
    check('①-3 메모 줄 수(기존 2 + 감사 1)', memo.length, 3);
    check('①-4 감사 줄 내용', /^\[MRT 정산 \d{4}-\d{2}-\d{2}\] 잔금입금일 2026-06-12 → 2026-07-15 .*· 6월 여행분$/.test(memo[2]), true);
    check('①-5 다른 칸 불변(잔금결제여부·총결제액)', [sh.rows[1][C['잔금결제여부']], sh.rows[1][C['총결제액']]], ['Y', 89.59]);
    // 재실행 — 같은 날짜면 쓰기 0, 메모 중복 없음
    const w = sh.writes;
    const again = M.act('tok', { rowIndex: 2, payoutDate: '2026-07-15' });
    check('①-6 재실행 unchanged', [again.updated, again.rows[0].unchanged, sh.writes - w], [0, true, 0]);
    check('①-7 재실행 메모 중복 없음', sh.rows[1][C['요청사항']].split('\n').length, 3);
  }
  // ② 시트가 날짜셀을 Date 로 굳힌 경우 — previous 가 'Mon Jun 12…' 가 아니라 yyyy-MM-dd
  {
    sheet([mrtRow({ '잔금입금일': new Date(2026, 5, 12) })]);
    const res = M.act('tok', { rowIndex: 2, payoutDate: '2026-07-15' });
    check('② Date 셀 previous', res.rows[0].previous, '2026-06-12');
  }
  // ③ 가드 — MRT 아님 · 미래 · 형식 · 넘침 날짜 · 고객명 불일치 · 취소 · 없는 행 · 일괄+expectName
  {
    sheet([mrtRow(), plainRow()]);
    throws('③-1 MRT 아님', () => M.act('tok', { rowIndex: 3, payoutDate: '2026-07-15' }), /마이리얼트립 예약 행이 아닙니다: 3/);
    const fut = new Date(Date.now() + 3 * 86400000); const p = (n) => String(n).padStart(2, '0');
    throws('③-2 미래 거부', () => M.act('tok', { rowIndex: 2, payoutDate: `${fut.getFullYear()}-${p(fut.getMonth() + 1)}-${p(fut.getDate())}` }), /미래/);
    throws('③-3 형식', () => M.act('tok', { rowIndex: 2, payoutDate: '15.07.2026' }), /형식/);
    throws('③-4 넘침 날짜', () => M.act('tok', { rowIndex: 2, payoutDate: '2026-02-30' }), /형식/);
    throws('③-5 고객명 불일치', () => M.act('tok', { rowIndex: 2, expectName: '김제윤', payoutDate: '2026-07-15' }), /고객명 불일치/);
    throws('③-6 없는 행', () => M.act('tok', { rowIndex: 9, payoutDate: '2026-07-15' }), /존재하지 않는 행/);
    throws('③-7 rowIndex 누락', () => M.act('tok', { payoutDate: '2026-07-15' }), /rowIndex/);
    throws('③-8 일괄+expectName', () => M.act('tok', { rowIndexes: [2, 2], expectName: '유성현', payoutDate: '2026-07-15' }), /단건/);
    sheet([mrtRow({ '상태': '취소됨' })]);
    throws('③-9 취소 예약', () => M.act('tok', { rowIndex: 2, payoutDate: '2026-07-15' }), /취소된 예약/);
  }
  // ④ 일괄 — 같은 지급일 여러 건 / 하나라도 막히면 아무 행도 안 바뀐다(all-or-nothing)
  {
    const sh = sheet([mrtRow(), mrtRow({ '고객명': '김제윤', '예약일시': '2026-07-20 11:00', '잔금입금일': '2026-07-10' }), plainRow()]);
    throws('④-1 섞인 일괄 거부', () => M.act('tok', { rowIndexes: [2, 3, 4], payoutDate: '2026-08-18' }), /아닙니다: 4/);
    check('④-2 거부 시 쓰기 0', [sh.writes, sh.rows[1][C['잔금입금일']], sh.rows[2][C['잔금입금일']]], [0, '2026-06-12', '2026-07-10']);
    const res = M.act('tok', { rowIndexes: ['2', 3], payoutDate: '2026-08-18' });
    check('④-3 일괄 반영', [res.updated, sh.rows[1][C['잔금입금일']], sh.rows[2][C['잔금입금일']], res.rows.map((r) => r.name)], [2, '2026-08-18', '2026-08-18', ['유성현', '김제윤']]);
  }
  // ⑤ dryRun — 판별·현재값만, 쓰기 0
  {
    const sh = sheet([mrtRow()]);
    const res = M.act('tok', { rowIndex: 2, payoutDate: '2026-07-15', dryRun: true });
    check('⑤ dryRun', [res.dryRun, res.updated, sh.writes, res.rows[0].previous, sh.rows[1][C['잔금입금일']]], [true, 0, 0, '2026-06-12', '2026-06-12']);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`❌ check-mrt-payout: ${failures.length}건 불일치\n` + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('✅ check-mrt-payout: 단건·Date셀·가드 9종·일괄 all-or-nothing·dryRun 전부 통과');
