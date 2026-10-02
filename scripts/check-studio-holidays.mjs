#!/usr/bin/env node
/**
 * check-studio-holidays.mjs — 휴무 달력 검사기
 *
 * 왜 필요한가(2026-10-02 사장님 결정 2건):
 *   ① "공휴일이 토요일이면 휴일지정 해제" — 토요일 법정 공휴일은 평소 토요일처럼 예약을 받는다.
 *      엔진(getPublicHolidayDatesForYear_)과 어드민 휴무 달력(getHessenHolidayItemsClient)이 따로 계산하므로
 *      한쪽만 바뀌면 화면은 '휴무'인데 예약은 열리는(또는 그 반대) 사고가 난다.
 *   ② "스튜디오 휴일지정도 애플캘린더에 띄워줘" + "다른 색상으로" — 휴무를 전용 캘린더 '스튜디오 휴무'(빨강)의
 *      종일 일정으로 동기화(아이폰은 일정별 색을 안 보여 줘서 캘린더를 나눴다). @1005 때 메인에 넣은 건 치운다.
 *      실캘린더에 쓰는 코드라 멱등(두 번 돌려도 그대로)·사람이 만든 일정 불가침·해제 시 삭제가 깨지면 사고다.
 *
 * 어떻게: Code.gs 를 GAS 스텁과 함께 로드해 진짜 함수를 실행한다. 캘린더는 메모리 가짜(CalendarApp)로 대체.
 * 사용법:  node scripts/check-studio-holidays.mjs       (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const adminHtml = readFileSync(join(ROOT, 'appscript', 'AdminV2.html'), 'utf8');
const publicGs = readFileSync(join(ROOT, 'appscript-public', 'Public.gs'), 'utf8');

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (d, tz, p) => {
  const q = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return p.replace('yyyy', q.year).replace('MM', q.month).replace('dd', q.day).replace('HH', q.hour).replace('mm', q.minute).replace('ss', q.second);
};

const CACHE = { m: {}, get(k) { return this.m[k] ?? null; }, put(k, v) { this.m[k] = v; }, remove(k) { delete this.m[k]; } };
// 메모리 캘린더 2개(메인 + 전용) — 종일 일정과 시간 일정, 설명란, 삭제·제목변경
const MAIN_ID = 'studio.mean.de@gmail.com';
const PROPS = {};
let EVENTS = [];
const mkEvent = (o) => ({
  cal: MAIN_ID, ...o, reminders: true,
  isAllDayEvent() { return !!this.allDay; }, getDescription() { return this.desc || ''; }, getTitle() { return this.title; },
  getAllDayStartDate() { return this.start; }, setTitle(t) { this.title = t; }, deleteEvent() { EVENTS = EVENTS.filter((e) => e !== this); },
  removeAllReminders() { this.reminders = false; }, setColor(c) { this.color = c; },
});
const mkCal = (id, name) => ({
  id, name, getId() { return id; }, getName() { return name; },
  getEvents(s, e) { return EVENTS.filter((ev) => ev.cal === id && ev.start < e && ev.end > s); },
  createAllDayEvent(title, date, opts) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const ev = mkEvent({ cal: id, title, allDay: true, start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1), desc: opts && opts.description });
    EVENTS.push(ev); return ev;
  },
});
const CALS = { [MAIN_ID]: mkCal(MAIN_ID, MAIN_ID) };
let calCreates = 0;
const hol = () => CALS[PROPS.STUDIO_HOLIDAY_CALENDAR_ID];
Object.assign(globalThis, {
  Utilities: { formatDate: fmt, sleep() {} }, Logger: { log() {} }, Session: { getScriptTimeZone: () => 'Europe/Berlin' },
  CalendarApp: {
    getCalendarById: (id) => CALS[id] || null, getDefaultCalendar: () => CALS[MAIN_ID],
    getOwnedCalendarsByName: (n) => Object.values(CALS).filter((c) => c.name === n),
    createCalendar(n, o) { calCreates++; const id = `hol${calCreates}@group.calendar.google.com`; CALS[id] = mkCal(id, n); CALS[id].opts = o; return CALS[id]; },
    Color: { RED: '#D06B64' }, EventColor: { GRAY: 'gray' },
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => PROPS[k] ?? null, setProperty(k, v) { PROPS[k] = v; } }) },
  CacheService: { getScriptCache: () => CACHE },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});
const dir = mkdtempSync(join(tmpdir(), 'hol-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${gs}
var __SETTINGS__={};
function getSettingsMap_(){return __SETTINGS__;}
function __setSettings__(o){__SETTINGS__=o;}
module.exports={isWeekendOrHolidayBlocked_,getPublicHolidayDatesForYear_,getHessenHolidayItems,isDeliveryClosedDay_,
  buildStudioHolidayCalendarPlan_,syncStudioHolidayCalendar_,STUDIO_HOLIDAY_EVENT_MARKER_,__setSettings__};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};
const blocked = (d, g = 'stud') => M.isWeekendOrHolidayBlocked_(d, g);

// ── 1) 토요일 법정 공휴일 = 영업일 ───────────────────────────────────────
{
  M.__setSettings__({});
  ok(!blocked('2026-10-03'), '10/3(토, 통일의 날) — 예약 열림');
  ok(!blocked('2026-12-26'), '12/26(토, 둘째 성탄절) — 예약 열림');
  ok(!blocked('2026-10-03', 'pass') && !blocked('2026-10-03', 'prof'), '토요일 공휴일 — 여권·프로필도 열림');
  ok(blocked('2026-12-25'), '12/25(금, 성탄절) — 평일 공휴일은 그대로 휴무');
  ok(blocked('2026-04-03'), '4/3(금, 성금요일) — 부활절 계산 공휴일 휴무');
  ok(blocked('2026-10-04') && blocked('2026-10-05'), '일·월 정기휴무 불변');
  ok(!M.getPublicHolidayDatesForYear_(2026).includes('2026-10-03'), '공휴일 목록에서 토요일 법정 공휴일 제외', M.getPublicHolidayDatesForYear_(2026));
  // 연도 전체: 남은 공휴일 중 토요일 0, 빠진 건 정확히 토요일 법정 공휴일
  for (let y = 2026; y <= 2032; y++) {
    const all = M.getHessenHolidayItems(y).map((x) => x.date);
    const kept = M.getPublicHolidayDatesForYear_(y);
    const sat = (d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 6;
    ok(kept.every((d) => !sat(d)) && all.filter((d) => !kept.includes(d)).every(sat), `${y}년 — 토요일만 정확히 빠짐`, { all, kept });
  }
  // 직접 등록한 공휴일은 토요일이어도 존중(사장님이 일부러 넣은 것)
  M.__setSettings__({ custom_public_holidays: '2026-11-07' });
  ok(blocked('2026-11-07'), '직접 등록한 토요일 공휴일 — 휴무 유지');
  // 토요일을 닫는 길은 일반 휴무
  M.__setSettings__({ custom_holidays: '2026-10-03' });
  ok(blocked('2026-10-03') && blocked('2026-10-03', 'wed'), '10/3 을 일반 휴무로 지정하면 전 상품 차단');
  // 예전에 토요일 공휴일을 '영업 처리' 해 둔 값은 무해
  M.__setSettings__({ public_holiday_open_dates: '2026-10-03' });
  ok(!blocked('2026-10-03'), '옛 영업 처리 값(10/3)은 무해');
  M.__setSettings__({});
  ok(!M.isDeliveryClosedDay_('2026-10-03') && M.isDeliveryClosedDay_('2026-12-25'), '전달 예정일 달력도 같은 규칙');
}

// ── 2) 어드민 휴무 달력 = 엔진 (같은 규칙을 두 군데서 계산) ─────────────────
{
  const grab = (name) => {
    const i = adminHtml.indexOf(`function ${name}(`);
    let depth = 0, j = adminHtml.indexOf('{', i);
    for (; j < adminHtml.length; j++) { if (adminHtml[j] === '{') depth++; else if (adminHtml[j] === '}' && --depth === 0) break; }
    return adminHtml.slice(i, j + 1);
  };
  const client = new Function(`${grab('formatYmdLocal')}\n${grab('getHessenHolidayItemsClient')}\nreturn getHessenHolidayItemsClient;`)();
  M.__setSettings__({});
  for (let y = 2026; y <= 2032; y++) {
    const c = client(y).map((x) => x.date).join(','), e = M.getPublicHolidayDatesForYear_(y).join(',');
    ok(c === e, `${y}년 어드민 달력 공휴일 = 엔진`, { client: c, engine: e });
  }
  ok(/토요일과 겹치면 평소대로 영업/.test(adminHtml), '어드민 안내문에 토요일 규칙');
  ok(/getUTCDay\(\)!==6/.test(publicGs.slice(publicGs.indexOf('function getPublicHolidayDatesForYear_'))),
    '셔틀 Public.gs 재생성됨(토요일 규칙 포함) — node scripts/build-public-api.mjs');
}

// ── 3) 휴무 → 메인 캘린더 종일 일정 ─────────────────────────────────────
{
  const today = new Date(); const Y = today.getFullYear(); const N = Y + 1;
  const sat = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
  // 계획: 화~금 공휴일 + 일반 휴무, 일·월 공휴일·토요일 법정 공휴일·영업 처리일 제외
  M.__setSettings__({ custom_holidays: `${N}-03-10,${N}-03-11`, public_holiday_open_dates: '' });
  const plan = M.buildStudioHolidayCalendarPlan_(`${N}-01-01`, `${N}-12-31`);
  const pubs = M.getHessenHolidayItems(N);
  const karfreitag = pubs.find((x) => x.name === 'Karfreitag').date, ostermontag = pubs.find((x) => x.name === 'Ostermontag').date;
  ok(plan[karfreitag] === '스튜디오 휴무 · Karfreitag', '성금요일 → "스튜디오 휴무 · Karfreitag"', plan[karfreitag]);
  ok(!plan[ostermontag], '부활절 월요일(정기휴무 월요일) → 싣지 않음');
  ok(plan[`${N}-03-10`] === '스튜디오 휴무' && plan[`${N}-03-11`] === '스튜디오 휴무', '일반 휴무 → "스튜디오 휴무"');
  ok(Object.keys(plan).every((d) => ![0, 1].includes(sat(d)) || plan[d] === '스튜디오 휴무'), '일·월에는 일반 휴무만');
  ok(pubs.filter((x) => sat(x.date) === 6).every((x) => !plan[x.date]), '토요일 법정 공휴일 → 싣지 않음(영업일)');
  M.__setSettings__({ public_holiday_open_dates: karfreitag });
  ok(!M.buildStudioHolidayCalendarPlan_(`${N}-01-01`, `${N}-12-31`)[karfreitag], '영업 처리한 공휴일 → 싣지 않음');

  // 메인 캘린더(@1005 위치): 사람 일정·예약·지난 이력 + @1005 가 넣은 우리 일정(앞으로 날짜) 2건
  const human = mkEvent({ title: '가족 여행', allDay: true, start: new Date(N, 2, 10), end: new Date(N, 2, 11), desc: '' });
  const timed = mkEvent({ title: '프로필 | 홍길동 | 1인 | 55€', allDay: false, start: new Date(N, 2, 10, 10), end: new Date(N, 2, 10, 11) });
  const past = mkEvent({ title: '스튜디오 휴무', allDay: true, start: new Date(Y - 1, 5, 1), end: new Date(Y - 1, 5, 2), desc: M.STUDIO_HOLIDAY_EVENT_MARKER_ });
  const v1a = mkEvent({ title: '스튜디오 휴무', allDay: true, start: new Date(N, 2, 10), end: new Date(N, 2, 11), desc: M.STUDIO_HOLIDAY_EVENT_MARKER_ + ' 메인' });
  const v1b = mkEvent({ title: '스튜디오 휴무', allDay: true, start: new Date(N, 9, 20), end: new Date(N, 9, 21), desc: M.STUDIO_HOLIDAY_EVENT_MARKER_ + ' 메인' });
  EVENTS = [human, timed, past, v1a, v1b];
  M.__setSettings__({ custom_holidays: `${N}-03-10,${N}-03-11` });
  const d0 = M.syncStudioHolidayCalendar_({ dryRun: true });
  ok(calCreates === 0 && !PROPS.STUDIO_HOLIDAY_CALENDAR_ID && EVENTS.length === 5 && d0.removedFromMain === 2 && /새로 만들 예정/.test(d0.calendar),
    'dryRun — 캘린더를 만들지 않고 메인 정리 2건·생성 계획만 보고', d0);
  const r1 = M.syncStudioHolidayCalendar_({});
  const ours = () => EVENTS.filter((e) => e.cal === hol()?.id && e.desc && e.desc.includes(M.STUDIO_HOLIDAY_EVENT_MARKER_));
  ok(calCreates === 1 && hol() && hol().name === '스튜디오 휴무' && hol().opts.color === '#D06B64', "전용 캘린더 '스튜디오 휴무'(빨강) 1개 생성 · ID 저장", hol() && hol().opts);
  ok(r1.ok && r1.created.length === r1.planned && ours().length === r1.planned, '첫 동기화 — 전용 캘린더에 계획 수만큼 생성', r1);
  ok(r1.removedFromMain === 2 && !EVENTS.includes(v1a) && !EVENTS.includes(v1b), '@1005 가 메인에 넣은 휴무 일정 정리', r1);
  ok(EVENTS.filter((e) => e.cal === MAIN_ID && e.desc && e.desc.includes(M.STUDIO_HOLIDAY_EVENT_MARKER_) && e !== past).length === 0, '메인엔 우리 일정이 남지 않음(지난 이력 제외)');
  ok(ours().every((e) => e.allDay && e.reminders === false && e.color === undefined), '전부 종일 일정 · 알림 없음 · 일정별 색 없음(캘린더 색을 따름)');
  const r2 = M.syncStudioHolidayCalendar_({});
  ok(r2.created.length === 0 && r2.deleted.length === 0 && r2.retitled.length === 0 && r2.kept === r1.planned && r2.removedFromMain === 0 && calCreates === 1,
    '두 번째 동기화 — 변화 없음(멱등) · 캘린더 추가 생성 없음', r2);
  const savedId = PROPS.STUDIO_HOLIDAY_CALENDAR_ID; delete PROPS.STUDIO_HOLIDAY_CALENDAR_ID;
  M.syncStudioHolidayCalendar_({});
  ok(calCreates === 1 && PROPS.STUDIO_HOLIDAY_CALENDAR_ID === savedId, '속성이 지워져도 같은 이름의 캘린더를 찾아 재사용(두 번 만들지 않음)');
  M.__setSettings__({ custom_holidays: `${N}-03-10` });
  const r3 = M.syncStudioHolidayCalendar_({});
  ok(r3.deleted.join() === `${N}-03-11` && !ours().some((e) => ymd(e.start) === `${N}-03-11`), '휴무 해제 → 그 일정 삭제', r3);
  ok(EVENTS.includes(human) && EVENTS.includes(timed) && EVENTS.includes(past), '사람이 만든 일정·예약 일정·지난 이력은 그대로');
  hol().createAllDayEvent('스튜디오 휴무', new Date(N, 2, 10), { description: M.STUDIO_HOLIDAY_EVENT_MARKER_ });   // 중복
  const r4 = M.syncStudioHolidayCalendar_({});
  ok(r4.deleted.join() === `${N}-03-10` && ours().filter((e) => ymd(e.start) === `${N}-03-10`).length === 1, '같은 날 중복 → 하나만 남김', r4);
  // 생성 한 건이 실패해도 나머지는 만들고 실패를 보고(속도 제한 등) — 다음 동기화가 이어 만든다
  M.__setSettings__({ custom_holidays: `${N}-08-11,${N}-08-12` });   // 8월 = Hessen 공휴일 없음(부활절 계산 공휴일과 겹치지 않게)
  const realCreate = hol().createAllDayEvent;
  hol().createAllDayEvent = function (t, d, o) { if (d.getMonth() === 7 && d.getDate() === 11) throw new Error('rate limit'); return realCreate.call(this, t, d, o); };
  const r5 = M.syncStudioHolidayCalendar_({});
  hol().createAllDayEvent = realCreate;
  ok(!r5.ok && r5.failed.length === 1 && r5.created.includes(`${N}-08-12`), '생성 실패 1건 → 나머지 생성 · ok:false 보고', r5);
  const r6 = M.syncStudioHolidayCalendar_({});
  ok(r6.ok && r6.created.join() === `${N}-08-11`, '다음 동기화가 빠진 건만 이어 만듦', r6);
  M.__setSettings__({ custom_holidays: `${N}-03-10` });
  M.syncStudioHolidayCalendar_({});
  // 동시 실행: 진행 중이면 건너뛰되 끝난 뒤 한 번 더(그 사이 바뀐 설정 반영) — 중복 생성 없음
  M.__setSettings__({ custom_holidays: `${N}-03-10` });
  const realGet = hol().getEvents;
  let inner = null;
  hol().getEvents = function (a, b) {
    if (!inner) { inner = M.syncStudioHolidayCalendar_({}); M.__setSettings__({ custom_holidays: `${N}-03-10,${N}-06-02` }); }
    return realGet.call(this, a, b);
  };
  const r7 = M.syncStudioHolidayCalendar_({});
  hol().getEvents = realGet;
  ok(inner && inner.skipped === 'running', '진행 중 두 번째 요청 → 건너뜀', inner);
  ok(ours().filter((e) => ymd(e.start) === `${N}-06-02`).length === 1 && ours().filter((e) => ymd(e.start) === `${N}-03-10`).length === 1,
    '건너뛴 요청의 새 휴무(6/2)도 끝난 뒤 재실행으로 반영 · 중복 없음', r7);
  ok(!CACHE.get('holiday_sync_running') && !CACHE.get('holiday_sync_again'), '표식 정리');
  M.__setSettings__({ custom_holidays: `${N}-03-10` });
  M.syncStudioHolidayCalendar_({});
  const before = EVENTS.length;
  M.__setSettings__({});
  const dry = M.syncStudioHolidayCalendar_({ dryRun: true });
  ok(dry.dryRun && dry.deleted.includes(`${N}-03-10`) && EVENTS.length === before, 'dryRun — 계획만, 캘린더 불변', dry);
  CACHE.put('holiday_sync_running', '1');
  ok(M.syncStudioHolidayCalendar_({ dryRun: true }).dryRun === true, 'dryRun 은 진행 중 표식과 무관(읽기 전용)');
  CACHE.remove('holiday_sync_running'); CACHE.remove('holiday_sync_again');
}

if (fail) { console.error(`\n✗ 휴무 달력 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 휴무 달력 — 토요일 공휴일 영업·어드민=엔진=셔틀·전용 캘린더 동기화(빨강·메인 정리·멱등·해제 삭제·사람 일정 불가침)');
