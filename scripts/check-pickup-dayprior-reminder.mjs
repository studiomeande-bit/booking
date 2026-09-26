#!/usr/bin/env node
/**
 * check-pickup-dayprior-reminder.mjs — C7 픽업 전날 리마인드 검사기
 *
 * 왜 필요한가: 고객에게 **자동으로** 나가는 메일이다(2026-09-26 사장님 요청). 잘못되면 두 방향 모두 사고다 —
 *   이미 찾아간 손님·우편으로 바꾼 손님·취소된 예약에 "내일 픽업" 이 가거나, 같은 약속에 매일 다시 가거나,
 *   일정을 바꾼 손님에게 옛 시간이 안내된다. 라이브에서 확인하려면 실제 고객에게 메일을 보내야 하므로
 *   (금지 — 메모리 outbound-mail-conventions), 여기서 **진짜 발송 함수** 를 가짜 시트 위에서 돌리고
 *   메일은 가로채서 한 통도 나가지 않게 한 채 대상·본문·멱등을 단정한다.
 *
 * 어떻게: Code.gs 전체를 GAS 스텁과 함께 로드(check-contract-b2c·check-pass-country-memo 와 같은 방식)하고,
 *   시트·메일 접근 함수만 뒤 선언으로 덮는다(같은 이름 함수는 뒤 선언이 이긴다).
 *
 * 사용법:  node scripts/check-pickup-dayprior-reminder.mjs       (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';   // parseDateSafe_ 가 '2026-09-26 11:00' 을 로컬시간으로 읽는다 — GAS 스크립트 시간대와 맞춘다
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');

/* ── GAS 스텁 ─────────────────────────────────────────────────────────── */
function fmt(d, tz, pattern) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/Berlin', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return pattern.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day)
    .replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
}
const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁 — 이 경로는 닿으면 안 된다`); } });
const MAIL = { quota: 100 };
/* 가짜 메인 캘린더 — 그날 이벤트 { id, start }. fail=true 면 읽기가 던진다(쿼터·권한 실패 흉내). */
const CAL = { events: [], fail: false };
const fakeCal = {
  getEvents: (from, to) => {
    if (CAL.fail) throw new Error('Calendar 서비스 일시 오류');
    return CAL.events.filter((e) => e.start >= from && e.start <= to)
      .map((e) => ({ getId: () => e.id, getStartTime: () => e.start }));
  },
};
Object.assign(globalThis, {
  Utilities: { formatDate: (d, tz, p) => fmt(new Date(d), tz, p) },
  MailApp: { getRemainingDailyQuota: () => MAIL.quota, sendEmail: () => { throw new Error('MailApp.sendEmail 직접 호출 — 가로채기 실패'); } },
  GmailApp: nope('GmailApp'), SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'),
  CalendarApp: { getCalendarById: () => fakeCal, getDefaultCalendar: () => fakeCal }, UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});

const dir = mkdtempSync(join(tmpdir(), 'pickupc7-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${src}
var __SEL__=null, __BOOK__=null, __SENT__=[], __UNPAID__={};
function ensureSheets_(){ return { ss:{}, bookingSheet:__BOOK__ }; }
function ensureSelectSheet_(){ return __SEL__; }
function sendTrackedEmail_(msg,meta){ __SENT__.push({msg:msg,meta:meta||{}}); return true; }
function getUnpaidExtraForSession_(sid){ return __UNPAID__[sid]||0; }
function __set__(sel,book,unpaid){ __SEL__=sel; __BOOK__=book; __UNPAID__=unpaid||{}; __SENT__=[]; }
function __sent__(){ return __SENT__; }
function assertAdmin_(){ return true; }
module.exports={sendSelectPickupDayBeforeReminders_,runSelectPickupDayBeforeRemindersAdmin,SELECT_HEADERS,SELECT_COL,BOOKING_COL,__set__,__sent__};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

/* ── 가짜 시트 ────────────────────────────────────────────────────────── */
const C = M.SELECT_COL;
function selRow(o) {
  const r = new Array(M.SELECT_HEADERS.length).fill('');
  r[C['세션ID']] = o.sid; r[C['고객명']] = o.name || o.sid; r[C['이메일']] = o.email ?? `${o.sid}@example.com`;
  r[C['언어']] = o.lang || 'ko'; r[C['수령방식']] = o.mode ?? 'pickup'; r[C['픽업일시']] = o.pickup ?? '';
  r[C['상태']] = o.status || '보정본확인완료'; r[C['예약장부행']] = o.bri || '';
  r[C['수령완료일시']] = o.handedAt || ''; r[C['출력완료일시']] = o.printedAt ?? '2026-09-20 10:00';   // 기본: 인화 완료
  r[C['픽업전날알림']] = o.stamp ?? '';
  r[C['픽업캘린더ID']] = o.ev ?? (o.sid ? `ev-${o.sid}` : '');
  return r;
}
/* 행마다 [픽업] 이벤트를 만든다 — calAt 로 다른 시각(캘린더에서 옮김), calAt:null 이면 이벤트 없음(캘린더에서 지움) */
const toDate = (v) => (v instanceof Date ? v : new Date(String(v).replace(' ', 'T') + ':00+02:00'));
function eventsFor(list) {
  return list.filter((o) => o.sid && o.pickup && o.calAt !== null && (o.ev ?? 'x') !== '')
    .map((o) => ({ id: o.ev ?? `ev-${o.sid}`, start: toDate(o.calAt ?? o.pickup) }));
}
function selectSheet(rows) {
  const data = [M.SELECT_HEADERS.slice(), ...rows];
  const writes = [];
  return {
    data, writes,
    getDataRange: () => ({ getValues: () => data.map((r) => r.slice()) }),
    getRange: (r, c) => ({
      getValue: () => data[r - 1][c - 1],
      setValue: (v) => { writes.push({ row: r, col: c - 1, v }); data[r - 1][c - 1] = v; },
    }),
  };
}
function bookingSheet(statusByRow) {
  const last = Math.max(1, ...Object.keys(statusByRow).map(Number));
  return {
    getLastRow: () => last,
    getRange: (r, c, n) => ({ getValues: () => Array.from({ length: n }, (_, i) => [statusByRow[r + i] || '확정됨']) }),
  };
}

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};

/* 기준 시각: 2026-09-25(금) 08:00 베를린 → "내일" = 2026-09-26(토) */
const NOW = new Date('2026-09-25T08:00:00+02:00');
const T = '2026-09-26';
const rows = [
  { sid: 'A', pickup: `${T} 11:00` },                                              // 보낸다(ko)
  { sid: 'B', pickup: `${T} 11:30`, mode: 'mail' },                                // 우편으로 바꿈
  { sid: 'C', pickup: `${T} 12:00`, handedAt: '2026-09-24 16:00', printedAt: '2026-09-20 10:00' },   // 이미 수령
  { sid: 'D', pickup: `${T} 12:30`, stamp: `${T} 12:30` },                         // 이 약속엔 이미 알림
  { sid: 'E', pickup: `${T} 15:00`, stamp: '2026-09-23 15:00', lang: 'de' },       // 일정 변경 → 새 약속 기준으로 다시(de)
  { sid: 'F', pickup: '2026-09-27 11:00' },                                        // 모레
  { sid: 'G', pickup: '2026-09-25 15:30' },                                        // 오늘
  { sid: 'H', pickup: `${T} 13:00`, email: '수기등록' },                           // 메일 없음
  { sid: 'I', pickup: `${T} 13:30`, bri: 5 },                                      // 예약 취소됨
  { sid: 'J', pickup: `${T} 14:00`, status: '최종작업완료' },                        // 마감
  { sid: 'K', pickup: `${T} 14:30`, stamp: new Date('2026-09-26T14:30:00+02:00') },// 시트가 알림값을 Date 로 바꿔 저장해도 멱등
  { sid: 'L', pickup: new Date('2026-09-26T10:00:00+02:00'), lang: 'en' },         // 픽업일시가 Date 로 저장된 행(en)
  { sid: 'N', pickup: `${T} 15:30`, handedAt: '2026-09-10 12:00', printedAt: '2026-09-20 09:00' },   // 재인화 → 다시 열림
  { sid: '', pickup: `${T} 16:00` },                                               // 빈 행
  { sid: 'P', pickup: '' },                                                        // 픽업 미예약(C4 몫)
  { sid: 'Q', pickup: `${T} 16:00`, calAt: null },                                 // 캘린더에서 지움 → 보류
  { sid: 'S', pickup: `${T} 16:30`, calAt: `${T} 17:00` },                         // 캘린더에서 옮김 → 보류(옛 시간 안내 금지)
  { sid: 'U', pickup: `${T} 17:30`, ev: '' },                                      // 이벤트 id 없음 → 보류
  { sid: 'W', pickup: `${T} 11:15`, handedAt: '2026-09-24 10:00', printedAt: '2026-09-24 10:05', calAt: null },   // 일찍 수령→재인화로 다시 열림, 이벤트는 수령 때 삭제 → 보류
  { sid: 'V', pickup: `${T} 18:00`, printedAt: '' },                               // 인화 전 약속 → 보내되 '다른 시간 고르기' 문구 없이
];
const WANT = ['A', 'E', 'L', 'N', 'V'];
const WANT_HELD = ['Q', 'S', 'U', 'W'];
CAL.events = eventsFor(rows);
const unpaid = { A: 12 };

// 1) dryRun — 대상만 계산, 메일·기록 0
{
  const sel = selectSheet(rows.map(selRow));
  M.__set__(sel, bookingSheet({ 5: '취소됨' }), unpaid);
  const r = M.sendSelectPickupDayBeforeReminders_({ dryRun: true, now: NOW });
  ok(JSON.stringify(r.targets.map((t) => t.sessionId)) === JSON.stringify(WANT), `dryRun 대상 = ${WANT.join(',')}`, r.targets.map((t) => t.sessionId));
  ok(M.__sent__().length === 0, 'dryRun 은 메일을 보내지 않는다', M.__sent__().length);
  ok(sel.writes.length === 0, 'dryRun 은 시트에 쓰지 않는다', sel.writes.length);
  ok(r.date === T, `"내일" = ${T} (베를린 기준)`, r.date);
  ok(JSON.stringify(r.held.map((h) => h.sessionId)) === JSON.stringify(WANT_HELD), `캘린더와 안 맞는 약속은 보류 = ${WANT_HELD.join(',')}`, r.held);
  const reason = (sid) => (r.held.find((h) => h.sessionId === sid) || {}).reason;
  ok(reason('Q') === '캘린더에서 삭제됨' && reason('S') === '캘린더 시간 불일치' && reason('U') === '캘린더 이벤트 없음',
     '보류 사유가 운영 로그에 구분돼 남는다', r.held.map((h) => `${h.sessionId}:${h.reason}`));
  ok(/보류 4건/.test(r.summary), '요약(운영 로그)에 보류 건수', r.summary);
}

// 2) 실제 실행 — 정확히 대상에게만, 알림값 = 그 약속
const sel = selectSheet(rows.map(selRow));
M.__set__(sel, bookingSheet({ 5: '취소됨' }), unpaid);
const run1 = M.sendSelectPickupDayBeforeReminders_({ now: NOW });
const sent = M.__sent__();
ok(run1.count === 5, '실행 1회: 5건 발송', run1.count);
ok(JSON.stringify(sent.map((s) => s.meta.ref)) === JSON.stringify(WANT), `수신 세션 = ${WANT.join(',')}`, sent.map((s) => s.meta.ref));
ok(sent.every((s) => /@example\.com$/.test(s.msg.to)), '수신자는 각 세션의 이메일', sent.map((s) => s.msg.to));
const stampOf = (sid) => {
  const idx = sel.data.findIndex((r) => r[C['세션ID']] === sid);
  return sel.data[idx][C['픽업전날알림']];
};
ok(stampOf('A') === `${T} 11:00` && stampOf('E') === `${T} 15:00` && stampOf('L') === `${T} 10:00`,
   '알림값 = 알린 약속의 픽업일시', { A: stampOf('A'), E: stampOf('E'), L: stampOf('L') });
ok(sel.writes.every((w) => w.col === C['픽업전날알림']), '쓰는 칸은 픽업전날알림 하나뿐', [...new Set(sel.writes.map((w) => w.col))]);

// 3) 본문 — 언어·일시·요일·주소·추가금·변경 링크
const mailOf = (sid) => sent.find((s) => s.meta.ref === sid).msg;
{
  const a = mailOf('A');
  ok(/내일 픽업 안내/.test(a.subject) && /2026년 9월 26일\(토\) 11:00/.test(a.subject), 'ko 제목: 내일 픽업 · 날짜(요일) 시간', a.subject);
  ok(/2026년 9월 26일\(토\) 11:00/.test(a.htmlBody), 'ko 본문: 날짜(요일) 시간', null);
  ok(/Holzweg|61440|Oberursel/.test(a.htmlBody), '본문에 스튜디오 주소');
  ok(/12,00/.test(a.htmlBody) && /수령하실 때/.test(a.htmlBody), '남은 추가금 €12 안내(수령 시 결제)');
  ok(/\?id=A"/.test(a.htmlBody) || /\?id=A</.test(a.htmlBody), '일정 변경/우편 전환 링크가 이 세션을 가리킨다');
  const e = mailOf('E');
  ok(/Erinnerung: Abholung morgen/.test(e.subject) && /Sa, 26\.09\.2026 um 15:00 Uhr/.test(e.subject), 'de 제목: Sa, 26.09.2026 um 15:00 Uhr', e.subject);
  ok(!/Zusatzbestellung/.test(e.htmlBody), '추가금 없으면 결제 문구 없음');
  const l = mailOf('L');
  ok(/Pickup reminder — tomorrow, Sat, 2026-09-26 at 10:00/.test(l.subject), 'en 제목 + Date 로 저장된 픽업일시도 정규화', l.subject);
  ok(sent.every((s) => s.meta.type === '사진셀렉' && s.meta.email === s.msg.to), '발송 기록 메타(유형·이메일) — 메일 로그에 남는다');
  // 인화 전 약속: 픽업 페이지가 '시간 변경' 버튼을 숨긴다 → 메일도 그 약속을 하지 않는다
  ok(/다른 시간을 고르시거나/.test(a.htmlBody) && /일정 변경 \/ 우편 전환/.test(a.htmlBody), '인화 완료 건: 시간 변경 안내 + 버튼');
  const v = mailOf('V');
  ok(!/다른 시간을 고르시거나/.test(v.htmlBody) && /답장해 주세요/.test(v.htmlBody) && /우편 발송으로 바꾸기/.test(v.htmlBody),
     '인화 전 건: 시간 변경 약속 없이 답장·우편 전환만', v.htmlBody.replace(/<[^>]+>/g, ' ').slice(0, 200));
}

// 4) 멱등 — 같은 날 다시 돌려도 0건
{
  const before = M.__sent__().length;
  const r = M.sendSelectPickupDayBeforeReminders_({ now: NOW });
  ok(r.count === 0 && M.__sent__().length === before, '두 번째 실행은 0건(같은 약속엔 한 번만)', r.count);
}

// 5) 일정 변경 뒤 — 새 약속이 다시 '내일' 이 되면 다시 알린다
{
  const idx = sel.data.findIndex((r) => r[C['세션ID']] === 'A');
  sel.data[idx][C['픽업일시']] = '2026-09-29 11:00';                              // 화요일로 변경
  CAL.events.push({ id: 'ev-A', start: toDate('2026-09-29 11:00') });
  const mon = new Date('2026-09-28T08:00:00+02:00');                               // 월요일(휴무)에도 보낸다
  const before = M.__sent__().length;
  const r = M.sendSelectPickupDayBeforeReminders_({ now: mon });
  ok(r.count === 1 && M.__sent__().length === before + 1 && M.__sent__().at(-1).meta.ref === 'A',
     '일정을 바꾸면 새 약속 전날(월요일 휴무일 포함) 다시 알림', r.targets);
}

// 6) 메일 쿼터 부족 — 보내지 않는다
{
  MAIL.quota = 10;
  M.__set__(selectSheet(rows.map(selRow)), bookingSheet({ 5: '취소됨' }), unpaid);
  const r = M.sendSelectPickupDayBeforeReminders_({ now: NOW });
  ok(r.count === 0 && M.__sent__().length === 0, '메일 쿼터 부족 시 0건', r.summary);
  MAIL.quota = 100;
}

// 7) 폭주 방지 — 한 번에 15건까지
{
  const manyO = Array.from({ length: 22 }, (_, i) => ({ sid: `Z${i}`, pickup: `${T} 10:${String(i).padStart(2, '0')}` }));
  CAL.events = eventsFor(manyO);
  const many = manyO.map(selRow);
  M.__set__(selectSheet(many), bookingSheet({}), {});
  const r = M.sendSelectPickupDayBeforeReminders_({ now: NOW });
  ok(r.count === 15 && M.__sent__().length === 15, '실행당 최대 15건', r.count);
}

// 8) 발송 직전 재조회 — 그 사이 수령이 기록됐으면 보내지 않는다
{
  CAL.events = eventsFor([{ sid: 'R', pickup: `${T} 11:00` }]);
  const s2 = selectSheet([selRow({ sid: 'R', pickup: `${T} 11:00` })]);
  const orig = s2.getRange;
  s2.getRange = (r, c) => {
    const g = orig(r, c);
    if (c - 1 === C['수령완료일시']) return { ...g, getValue: () => '2026-09-25 08:00' };   // 방금 전달 기록됨
    return g;
  };
  M.__set__(s2, bookingSheet({}), {});
  const r = M.sendSelectPickupDayBeforeReminders_({ now: NOW });
  ok(r.count === 0 && M.__sent__().length === 0, '발송 직전에 수령이 기록되면 보내지 않는다', r.count);
}

// 8b) 캘린더를 못 읽으면 아무에게도 보내지 않는다(틀린 안내보다 안 보내는 게 낫다) — 보류로 남긴다
{
  CAL.events = eventsFor(rows); CAL.fail = true;
  M.__set__(selectSheet(rows.map(selRow)), bookingSheet({ 5: '취소됨' }), unpaid);
  const r = M.sendSelectPickupDayBeforeReminders_({ now: NOW });
  ok(r.count === 0 && M.__sent__().length === 0, '캘린더 읽기 실패 → 0건 발송', r.count);
  ok(r.held.length === WANT.length + WANT_HELD.length && r.held.every((h) => h.reason === '캘린더 확인 실패'),
     "캘린더 읽기 실패 → 전부 '캘린더 확인 실패' 로 보류", r.held.map((h) => h.reason));
  CAL.fail = false;
}

// 8c) 관리자 실행: dryRun 을 문자열 "true" 로 넘겨도 보내지 않는다(메일 액션은 애매하면 안 보낸다)
{
  CAL.events = eventsFor(rows);
  M.__set__(selectSheet(rows.map(selRow)), bookingSheet({ 5: '취소됨' }), unpaid);
  const r = M.runSelectPickupDayBeforeRemindersAdmin('tok', { dryRun: 'true' });
  ok(r.ok && r.dryRun === true && M.__sent__().length === 0, '관리자 실행 dryRun:"true" → 발송 0', { dryRun: r.dryRun, sent: M.__sent__().length });
}

// 9) 운영 등록 — 매일 08:00 dailyTasks 에 들어 있고, 운영 보드에도 보인다
{
  const daily = src.slice(src.indexOf('function dailyTasks('), src.indexOf('function dailyTasks(') + 6000);
  ok(/\['C7 픽업 전날 리마인드',sendSelectPickupDayBeforeReminders_\]/.test(daily), 'dailyTasks 에 C7 등록');
  const names = (src.match(/const AUTOMATION_JOB_NAMES_=\[[\s\S]*?\];/) || [''])[0];
  ok(/'C7 픽업 전날 리마인드'/.test(names), '운영 보드 작업명에 C7');
  ok(/if\(action==='select-pickup-dayprior-run'\)/.test(src), '에이전트 액션 select-pickup-dayprior-run (dryRun 로 대상 확인)');
  // '맨 끝' 으로 단정하면 다음 열이 붙을 때 거짓으로 빨개진다 — 도입 때 인덱스(59)를 고정한다(앞에 끼어들면 기존 데이터가 밀린다)
  ok(M.SELECT_HEADERS.indexOf('픽업전날알림') === 59, "새 열 '픽업전날알림' 위치 고정(인덱스 59, 추가보정조기이행요청 바로 뒤)",
     M.SELECT_HEADERS.indexOf('픽업전날알림'));
}

if (fail) { console.error(`\n✗ 픽업 전날 리마인드 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 픽업 전날 리마인드 — 대상·캘린더 대조·본문(3개국어·인화 전)·멱등·일정변경·쿼터·상한·재조회 전부 일치');
