#!/usr/bin/env node
/**
 * check-passport-duration-sync.mjs — 여권 예약의 캘린더 길이 = 온라인 견적의 길이
 *
 * 왜 필요한가(2026-10-06 겹침 사고): 온라인 예약은 여권 3인을 30분으로 잡는데, 어드민 저장·확정·일정변경·정합 점검이
 *   예약행에서 캘린더를 다시 쓸 때는 상품 기본값(15분)만 써서 3인 블록이 16:30–16:45 로 줄었다. 비어 보인 16:45 에
 *   다른 3인 여권(30분)이 온라인으로 들어와 15분이 겹쳤다. 같은 결함으로 박화정 3인(10/17)·김대영 4인(12/12)도 15분이었다.
 *
 * 어떻게: Code.gs 를 통째로 올려 진짜 getBookingDurationMinFromRow_(행 기준)와 getPassportComboDurationMin_(견적 기준),
 *   calculateQuote_ 의 totalDuration 을 1~6인에서 대조한다. 보드 생성본(Board.gs)도 같은 함수를 담아야 한다.
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const board = readFileSync(join(ROOT, 'appscript-board', 'Board.gs'), 'utf8');

const nope = new Proxy({}, { get: () => () => { throw new Error('stub'); } });
Object.assign(globalThis, {
  SpreadsheetApp: nope, CalendarApp: nope, MailApp: nope, UrlFetchApp: nope, DriveApp: nope, Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  Utilities: { formatDate: () => '2026-10-05' }, Session: { getScriptTimeZone: () => 'Europe/Berlin' },
  ScriptApp: { getService: () => ({ getUrl: () => '' }) }, HtmlService: {}, MimeType: {}, LockService: {},
});
const PRODUCTS = [
  { id: 'pass', g: 'pass', t: 'passport', p: 30, d: 15, prep: 0, nameKo: '여권/비자', nameEn: 'Passport/Visa', nameDe: 'Passfoto/Visum' },
  { id: 'pb', g: 'prof', t: 'single', p: 55, d: 15, prep: 0, nameKo: '프로필 Basic' },
  { id: 'sb', g: 'stud', t: 'group', p: 170, d: 30, prep: 0, nameKo: '스튜디오 Basic' },
];
const M = new Function(`${gs}
function getCachedProducts_(){return ${JSON.stringify(PRODUCTS)};}
function getPromoProducts_(){return [];}
function getTfpProducts_(){return [];}
function getSettingsMap_(){return {return_discount:'10'};}
function getProductById_(id){return getCachedProducts_().find(function(p){return p.id===id;});}
return {getBookingDurationMinFromRow_,getPassportComboDurationMin_,calculateQuote_,BOOKING_COL};`)();

let fail = 0;
const ok = (c, label, got) => { if (c) return; fail++; console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`); };
const row = (group, product, people, extra) => {
  const r = new Array(Object.keys(M.BOOKING_COL).length).fill('');
  r[M.BOOKING_COL['촬영종류']] = group; r[M.BOOKING_COL['상품']] = product; r[M.BOOKING_COL['인원']] = people;
  r[M.BOOKING_COL['추가항목']] = extra || ''; r[M.BOOKING_COL['요청사항']] = '[국가별 신청] ' + people + '명:독일';
  return r;
};

for (const n of [1, 2, 3, 4, 5, 6]) {
  const fromRow = M.getBookingDurationMinFromRow_(row('pass', '여권/비자', String(n)), 60);
  const engine = M.getPassportComboDurationMin_(n);
  const quote = M.calculateQuote_({ itemId: 'pass', people: n, date: '2026-10-20' }).totalDuration;
  ok(fromRow === engine && engine === quote, `여권 ${n}인: 행 기준 캘린더 길이 = 견적 길이`, { fromRow, engine, quote });
}
// 사장님 확정표(2026-09-15): 1인 15 · 2인 20 · 3인 30 · 4인 40 · 5인+ 인당 +10 — 세 사본(서버·예약 화면·어드민)이 같아야 한다
const PINNED = { 1: 15, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60 };
Object.keys(PINNED).forEach((n) => ok(M.getPassportComboDurationMin_(Number(n)) === PINNED[n], `여권 ${n}인 = ${PINNED[n]}분(사장님 확정표)`, M.getPassportComboDurationMin_(Number(n))));
const tableOf = (src, name) => { const m = src.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]{0,700}?const table\\s*=\\s*\\[([^\\]]*)\\]')); return m ? m[1].replace(/\s/g, '') : ''; };
const serverTable = tableOf(gs, 'function getPassportComboDurationMin_(');
const bookingTable = tableOf(readFileSync(join(ROOT, 'frontend', 'booking', 'booking.js'), 'utf8'), 'function passportDurationMin(');
const adminTable = tableOf(readFileSync(join(ROOT, 'appscript', 'AdminV2.html'), 'utf8'), 'function passportDurationMin(');
ok(serverTable && serverTable === bookingTable && serverTable === adminTable, '여권 시간표 세 사본 일치(서버·booking.js·AdminV2)', { serverTable, bookingTable, adminTable });
ok(M.getBookingDurationMinFromRow_(row('pass', '여권/비자', ''), 60) === 15, '인원 비면 1인(15분)');
ok(M.getBookingDurationMinFromRow_(row('prof', '프로필 Basic', '1'), 60) === 15, '프로필: 상품 기본 길이 그대로');
ok(M.getBookingDurationMinFromRow_(row('prof', '프로필 Basic', '1', '여권콤보 2명'), 60) === 35, '프로필+여권콤보 2명: 15 + 20');
ok(M.getBookingDurationMinFromRow_(row('stud', '스튜디오 Basic', '3'), 60) === 30, '스튜디오: 인원과 무관하게 상품 길이');
ok(/if\(product\.t==='passport'\) return Math\.max\(15,getPassportComboDurationMin_\(row\[BOOKING_COL\['인원'\]\]\)\);/.test(board), '보드 생성본(Board.gs)에도 같은 규칙 — build-board-api 재생성 필요');

if (fail) { console.error(`\n✗ 여권 캘린더 길이 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 여권 캘린더 길이 — 행 기준 재동기화 = 온라인 견적(1~6인), 콤보·타 상품 불변, 보드 생성본 일치');
