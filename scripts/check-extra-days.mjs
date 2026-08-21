#!/usr/bin/env node
/**
 * 추가일정(다일정) 회귀 잠금 — booking-set-extra-days / kind 처리 / 자가치유 제목 규칙.
 *
 * Code.gs 에서 해당 함수들의 **원본 소스를 그대로 뽑아** 스텁 환경에서 돌린다(재구현 금지 —
 * 재구현하면 테스트는 통과하는데 라이브는 깨지는 상태가 만들어진다).
 *
 *   node scripts/check-extra-days.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');

/* 함수 1개를 이름으로 잘라낸다. 문자열·주석 안의 중괄호는 건너뛰고 깊이를 센다
   (정규식 리터럴 안의 {4}{2} 같은 건 짝이 맞아서 그대로 세도 안전). */
function extractFn(name) {
  const start = SRC.indexOf(`\nfunction ${name}(`);
  if (start < 0) throw new Error(`함수를 찾을 수 없습니다: ${name}`);
  let i = SRC.indexOf('{', start), depth = 0;
  for (; i < SRC.length; i++) {
    const c = SRC[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < SRC.length && SRC[i] !== q) { if (SRC[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '/' && SRC[i + 1] === '/') { i = SRC.indexOf('\n', i); continue; }
    if (c === '/' && SRC[i + 1] === '*') { i = SRC.indexOf('*/', i) + 1; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return SRC.slice(start + 1, i + 1);
  }
  throw new Error(`중괄호 짝이 안 맞습니다: ${name}`);
}
function extractConst(name) {
  const m = SRC.match(new RegExp(`^const ${name}=.*$`, 'm'));
  if (!m) throw new Error(`상수를 찾을 수 없습니다: ${name}`);
  return m[0];
}

// ── 가짜 캘린더 ──────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

class FakeCal {
  constructor() { this.events = new Map(); this.seq = 0; this.log = []; }
  add(title, start, end, opts) {
    const id = `ev${++this.seq}@google.com`;
    const ev = {
      _id: id, _title: title, _s: start, _e: end, _desc: (opts && opts.description) || '', _dead: false,
      getId: () => id, getTitle() { return this._title; }, getStartTime() { return this._s; },
      getEndTime() { return this._e; }, getDescription() { return this._desc; },
      isAllDayEvent: () => false, deleteEvent() { this._dead = true; },
    };
    this.events.set(id, ev);
    return ev;
  }
  createEvent(title, s, e, opts) { this.log.push(['create', title, ymd(s), hm(s)]); return this.add(title, s, e, opts); }
  getEventById(id) { const ev = this.events.get(id); return ev && !ev._dead ? ev : null; }
  getEvents(from, to) {
    return [...this.events.values()].filter((ev) => !ev._dead && ev._s >= from && ev._s <= to);
  }
  live() { return [...this.events.values()].filter((ev) => !ev._dead); }
}

const HEADERS = ['예약일시', '상태', '고객명', '상품', '촬영종류', '캘린더ID', '인원', '총결제액', '추가일정JSON', 'shooting_location'];
const COL = {}; HEADERS.forEach((h, i) => { COL[h] = i; });

function makeCtx({ cal, row, conflictDates = [], otherRows = [] }) {
  const written = {};
  // 흡수 금지 목록 스캔은 열 단위로 읽는다 — 장부의 다른 행들도 흉내내야 한다
  const grid = [row].concat(otherRows.map((o) => {
    const r = new Array(HEADERS.length).fill('');
    r[COL['캘린더ID']] = o.calId || '';
    r[COL['추가일정JSON']] = o.extraJson || '';
    return r;
  }));
  const sheet = {
    getLastRow: () => 300,
    getRange: (r, c, nRows) => ({
      getValues: () => (nRows > 1 ? grid.map((gr) => [gr[c - 1]]) : [row.slice()]),
      getValue: () => row[c - 1],
      setValue: (v) => { written[c - 1] = v; row[c - 1] = v; },
    }),
  };
  const ctx = {
    CONFIG: { TIMEZONE: 'Europe/Berlin', MAIN_CALENDAR_ID: 'main', BOOKING_HEADERS: HEADERS },
    BOOKING_COL: COL,
    CalendarApp: { getCalendarById: () => cal, getDefaultCalendar: () => cal },
    Utilities: {
      formatDate: (d, _tz, fmt) => (fmt === 'HH:mm' ? hm(d) : fmt === 'yyyy-MM-dd' ? ymd(d) : `${ymd(d)} ${hm(d)}`),
    },
    Logger: { log() {} },
    assertAdmin_: () => {},
    getDbSheet: () => sheet,
    assertBookingRowName_: (r, expect) => {
      const en = String(expect || '').trim();
      if (en && en !== String(row[COL['고객명']] || '').trim()) throw new Error('행 고객명 불일치');
    },
    isBookingCancelledStatus_: (st) => /취소/.test(String(st || '')),
    agentBoolFlag_: (v) => v === true || /^(true|1|yes)$/i.test(String(v == null ? '' : v).trim()),
    parseDateSafe_: (v) => ({ str: String(v || '') }),
    parseBookingExtraDays_: (r) => { try { const a = JSON.parse(String(r[COL['추가일정JSON']] || '[]')); return Array.isArray(a) ? a.filter((d) => d && d.date) : []; } catch { return []; } },
    buildBookingCalendarTitleFromRow_: (r) => `${r[COL['상품']]} | ${r[COL['고객명']]} | ${r[COL['인원']]}인 | ${r[COL['총결제액']]}€`,
    checkBookingTimeConflict_: (date) => ({ readFailed: false, conflict: conflictDates.includes(date) }),
    deleteBookingCalendarEventById_: (id) => { const ev = cal.getEventById(String(id)); if (ev) ev.deleteEvent(); return true; },
    bumpCalCacheVer_: () => {},
    _written: written,
  };
  vm.createContext(ctx);
  for (const src of [extractConst('EXTRA_DAY_TRAVEL_NOTE_'),
    extractFn('normalizeExtraDayKind_'), extractFn('buildExtraDayEventFields_'),
    extractFn('createExtraDayEvent_'), extractFn('createBookingExtraDayEvents_'),
    extractFn('findAdoptableExtraDayEvent_'), extractFn('setBookingExtraDaysForAgent_')]) {
    vm.runInContext(src, ctx);
  }
  return ctx;
}

function newRow(extraJson = '') {
  const r = new Array(HEADERS.length).fill('');
  r[COL['예약일시']] = '2027-06-12 14:00';
  r[COL['상태']] = '대기중';
  r[COL['고객명']] = 'Jin Hee Choi';
  r[COL['상품']] = '웨딩 리포타주';
  r[COL['촬영종류']] = 'wed';
  r[COL['캘린더ID']] = 'day1@google.com';
  r[COL['인원']] = 2;
  r[COL['총결제액']] = 1950;
  r[COL['추가일정JSON']] = extraJson;
  r[COL['shooting_location']] = '함부르크';
  return r;
}
const D = (s, t) => new Date(`${s}T${t}:00`);
const TRAVEL = [
  { date: '2027-06-11', time: '09:00', durationMin: 600, kind: 'travel', note: '오버우어젤→함부르크' },
  { date: '2027-06-13', time: '09:00', durationMin: 600, kind: 'travel', note: '함부르크→복귀' },
];
const run = (ctx, payload) => vm.runInContext(`setBookingExtraDaysForAgent_('t',${JSON.stringify(payload)})`, ctx);
const json = (ctx) => JSON.parse(ctx._written[COL['추가일정JSON']]);
// vm 컨텍스트에서 나온 값은 프로토타입이 달라 deepEqual 이 실패한다 — 평범한 값으로 옮긴다
const plain = (v) => JSON.parse(JSON.stringify(v));

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };

console.log('추가일정 회귀 검사');

// ── 1) 기존 다일정 경로 회귀: 전부 shoot 이면 제목·설명이 종전과 완전히 동일해야 한다
test('createBookingExtraDayEvents_ — 전부 촬영일이면 종전 제목 (N/M일차) 유지', () => {
  const cal = new FakeCal();
  const ctx = makeCtx({ cal, row: newRow() });
  const out = vm.runInContext(
    `createBookingExtraDayEvents_('휘슬러 | ACME | 3000€','설명줄','베를린',` +
    `[{date:'2026-07-30',time:'09:00',durationMin:480},{date:'2026-07-31',time:'09:00',durationMin:480}])`, ctx);
  const titles = cal.live().map((e) => e.getTitle());
  assert.deepEqual(titles, ['휘슬러 | ACME | 3000€ (2/3일차)', '휘슬러 | ACME | 3000€ (3/3일차)']);
  assert.equal(cal.live()[0].getDescription(), '설명줄');           // 설명에 군더더기 없음
  assert.equal(out.length, 2);
  assert.equal(out[0].kind, 'shoot');
});

// ── 2) kind:travel — 제목 [이동], 설명에 '촬영 없음' 경고, 일차 번호는 촬영일만 센다
test('kind travel — [이동] 제목 + 촬영금지 설명, 일차 번호에서 제외', () => {
  const cal = new FakeCal();
  const ctx = makeCtx({ cal, row: newRow() });
  vm.runInContext(
    `createBookingExtraDayEvents_('웨딩 | Choi | 1950€','본문','함부르크',` +
    `[{date:'2027-06-11',kind:'travel',note:'출발'},{date:'2027-06-13',kind:'shoot'}])`, ctx);
  const [t1, t2] = cal.live();
  assert.equal(t1.getTitle(), '[이동] 웨딩 | Choi | 1950€');
  assert.match(t1.getDescription(), /촬영 없음 · 다른 촬영 잡지 말 것/);
  assert.match(t1.getDescription(), /출발/);
  assert.equal(t2.getTitle(), '웨딩 | Choi | 1950€ (2/2일차)');    // 촬영 2일 = 1일차 + 이 날
  assert.doesNotMatch(t2.getDescription(), /촬영 없음/);
});

// ── 3) 흡수: 같은 날짜에 손으로 만든 이벤트가 있으면 새로 만들지 않는다 (중복 0)
test('기존 수동 이벤트 흡수 — 중복 생성 0, 실제 시간 되읽기', () => {
  const cal = new FakeCal();
  cal.add('[이동] Jin Hee Choi 웨딩 출장 (오버우어젤→함부르크)', D('2027-06-11', '08:00'), D('2027-06-11', '20:00'));
  cal.add('[이동] Jin Hee Choi 웨딩 출장 (함부르크→복귀)', D('2027-06-13', '10:00'), D('2027-06-13', '18:00'));
  const before = cal.live().length;
  const ctx = makeCtx({ cal, row: newRow() });
  const res = run(ctx, { rowIndex: 251, expectName: 'Jin Hee Choi', extraDays: TRAVEL, replace: true });
  assert.equal(res.adopted, 2);
  assert.equal(res.created, 0);
  assert.equal(cal.live().length, before, '이벤트가 늘어나면 중복이다');
  assert.equal(cal.log.filter((l) => l[0] === 'create').length, 0);
  const saved = json(ctx);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].time, '08:00');            // 페이로드 09:00 이 아니라 캘린더 실측
  assert.equal(saved[0].durationMin, 720);
  assert.equal(saved[0].kind, 'travel');
  assert.equal(saved[0].note, '오버우어젤→함부르크');
  assert.ok(saved[0].eventId);
  // 흡수한 이벤트의 제목·설명은 건드리지 않는다
  assert.match(cal.getEventById(saved[0].eventId).getTitle(), /웨딩 출장/);
});

test('1일차 이벤트는 절대 흡수하지 않는다', () => {
  const cal = new FakeCal();
  const day1 = cal.add('웨딩 | Jin Hee Choi | 2인 | 1950€', D('2027-06-11', '14:00'), D('2027-06-11', '23:00'));
  const row = newRow(); row[COL['캘린더ID']] = day1.getId();
  const ctx = makeCtx({ cal, row });
  const res = run(ctx, { rowIndex: 251, extraDays: [{ date: '2027-06-11', kind: 'travel' }], replace: true });
  assert.equal(res.adopted, 0);
  assert.equal(res.created, 1);
  assert.notEqual(json(ctx)[0].eventId, day1.getId());
});

// ── 4) 멱등: 같은 payload 를 다시 보내면 아무것도 만들지도 지우지도 않는다
test('다른 예약이 쓰는 이벤트는 흡수하지 않는다(같은 고객 다른 예약 보호)', () => {
  const cal = new FakeCal();
  const other = cal.add('프로필 | Jin Hee Choi | 1인 | 55€', D('2027-06-11', '10:00'), D('2027-06-11', '11:00'));
  const otherExtra = cal.add('스냅 | Jin Hee Choi | 2인 | 150€ (2/2일차)', D('2027-06-13', '10:00'), D('2027-06-13', '12:00'));
  const ctx = makeCtx({
    cal, row: newRow(),
    otherRows: [{ calId: other.getId() }, { extraJson: JSON.stringify([{ date: '2027-06-13', eventId: otherExtra.getId() }]) }],
  });
  const res = run(ctx, { rowIndex: 251, extraDays: TRAVEL, replace: true });
  assert.equal(res.adopted, 0, '남의 예약 이벤트를 삼켰다');
  assert.equal(res.created, 2);
  const ids = json(ctx).map((d) => d.eventId);
  assert.ok(!ids.includes(other.getId()) && !ids.includes(otherExtra.getId()));
  assert.ok(cal.getEventById(other.getId()), '남의 예약 이벤트가 사라졌다');
});

test('멱등 — 같은 payload 재실행 시 keep 만, 생성·삭제 0', () => {
  const cal = new FakeCal();
  const ctx1 = makeCtx({ cal, row: newRow() });
  run(ctx1, { rowIndex: 251, extraDays: TRAVEL, replace: true });
  const saved1 = JSON.stringify(json(ctx1));
  const ctx2 = makeCtx({ cal, row: newRow(saved1) });
  const res = run(ctx2, { rowIndex: 251, extraDays: TRAVEL, replace: true });
  assert.equal(res.kept, 2);
  assert.equal(res.created, 0);
  assert.equal(res.removed, 0);
  assert.equal(JSON.stringify(json(ctx2)), saved1);
});

// ── 5) replace 병합/교체 의미
test('replace:false — 기존 유지 + 신규 추가(병합)', () => {
  const cal = new FakeCal();
  const ctx1 = makeCtx({ cal, row: newRow() });
  run(ctx1, { rowIndex: 251, extraDays: TRAVEL, replace: true });
  const ctx2 = makeCtx({ cal, row: newRow(JSON.stringify(json(ctx1))) });
  const res = run(ctx2, { rowIndex: 251, extraDays: [{ date: '2027-06-14', time: '10:00', durationMin: 300, kind: 'shoot' }] });
  assert.equal(res.kept, 2);
  assert.equal(res.created, 1);
  assert.equal(res.removed, 0);
  assert.deepEqual(json(ctx2).map((d) => d.date), ['2027-06-11', '2027-06-13', '2027-06-14']);
});

test('replace:true — 목록에서 빠진 날짜의 이벤트는 삭제된다', () => {
  const cal = new FakeCal();
  const ctx1 = makeCtx({ cal, row: newRow() });
  run(ctx1, { rowIndex: 251, extraDays: TRAVEL, replace: true });
  const saved1 = json(ctx1);
  const droppedId = saved1[1].eventId;
  const ctx2 = makeCtx({ cal, row: newRow(JSON.stringify(saved1)) });
  const res = run(ctx2, { rowIndex: 251, extraDays: [TRAVEL[0]], replace: true });
  assert.equal(res.removed, 1);
  assert.equal(res.removedOk, 1);
  assert.equal(json(ctx2).length, 1);
  assert.equal(cal.getEventById(droppedId), null, '빠진 날짜의 이벤트가 캘린더에 남았다');
});

test('시간 변경 — 옛 이벤트 삭제 후 재생성', () => {
  const cal = new FakeCal();
  const ctx1 = makeCtx({ cal, row: newRow() });
  run(ctx1, { rowIndex: 251, extraDays: [TRAVEL[0]], replace: true });
  const oldId = json(ctx1)[0].eventId;
  const ctx2 = makeCtx({ cal, row: newRow(JSON.stringify(json(ctx1))) });
  const res = run(ctx2, { rowIndex: 251, extraDays: [{ ...TRAVEL[0], time: '07:00' }], replace: true });
  assert.equal(res.created, 1);
  assert.equal(res.removed, 1);
  assert.equal(cal.getEventById(oldId), null);
  assert.equal(json(ctx2)[0].time, '07:00');
});

// ── 6) 가드
test('충돌 — allowConflict 없으면 거부하고 아무것도 안 쓴다', () => {
  const cal = new FakeCal();
  const ctx = makeCtx({ cal, row: newRow(), conflictDates: ['2027-06-11'] });
  assert.throws(() => run(ctx, { rowIndex: 251, extraDays: [TRAVEL[0]], replace: true }), /이미 다른 일정/);
  assert.equal(cal.live().length, 0);
  assert.equal(ctx._written[COL['추가일정JSON']], undefined, '거부됐는데 시트를 썼다');
  const ctx2 = makeCtx({ cal, row: newRow(), conflictDates: ['2027-06-11'] });
  const res = run(ctx2, { rowIndex: 251, extraDays: [TRAVEL[0]], replace: true, allowConflict: true });
  assert.equal(res.created, 1);
  assert.deepEqual(plain(res.conflicts), ['2027-06-11 09:00']);
});

test('expectName 불일치 / 1일차 날짜 / 중복 날짜 / 취소건 거부', () => {
  const mk = (row) => makeCtx({ cal: new FakeCal(), row });
  assert.throws(() => run(mk(newRow()), { rowIndex: 251, expectName: '다른사람', extraDays: TRAVEL, replace: true }), /고객명 불일치/);
  assert.throws(() => run(mk(newRow()), { rowIndex: 251, extraDays: [{ date: '2027-06-12' }], replace: true }), /1일차와 같은 날짜/);
  assert.throws(() => run(mk(newRow()), { rowIndex: 251, extraDays: [TRAVEL[0], TRAVEL[0]], replace: true }), /같은 날짜가 두 번/);
  assert.throws(() => run(mk(newRow()), { rowIndex: 251, extraDays: [{ date: '2027/06/11' }], replace: true }), /date 형식/);
  const cancelled = newRow(); cancelled[COL['상태']] = '취소됨';
  assert.throws(() => run(mk(cancelled), { rowIndex: 251, extraDays: TRAVEL, replace: true }), /취소/);
  assert.throws(() => run(mk(newRow()), { rowIndex: 251, extraDays: [] }), /비어 있습니다/);
});

test('dryRun — 계획만 반환하고 캘린더·시트 불변', () => {
  const cal = new FakeCal();
  cal.add('[이동] Jin Hee Choi 출장', D('2027-06-11', '08:00'), D('2027-06-11', '20:00'));
  const ctx = makeCtx({ cal, row: newRow() });
  const res = run(ctx, { rowIndex: 251, extraDays: TRAVEL, replace: true, dryRun: true });
  assert.equal(res.dryRun, true);
  assert.deepEqual(plain(res.plan).map((p) => p.op), ['adopt', 'create']);
  assert.equal(cal.live().length, 1, 'dryRun 이 이벤트를 만들었다');
  assert.equal(ctx._written[COL['추가일정JSON']], undefined, 'dryRun 이 시트를 썼다');
});

// ── 7) 자가치유 복구 제목이 kind 를 보존하는지 (calendar-audit 이 쓰는 그 함수)
test('자가치유 복구 — 이동일은 [이동] 제목·촬영금지 설명으로 되살아난다', () => {
  const ctx = makeCtx({ cal: new FakeCal(), row: newRow() });
  const t = vm.runInContext(
    `buildExtraDayEventFields_('웨딩 | Choi','다일정 자동 복구 — 예약장부 행 251',{kind:'travel',note:'복귀'},2,2)`, ctx);
  assert.equal(t.title, '[이동] 웨딩 | Choi');
  assert.match(t.description, /촬영 없음 · 다른 촬영 잡지 말 것/);
  assert.match(t.description, /자동 복구/);
  const s = vm.runInContext(`buildExtraDayEventFields_('웨딩 | Choi','복구',{},2,3)`, ctx);
  assert.equal(s.title, '웨딩 | Choi (2/3일차)');
  assert.equal(s.kind, 'shoot');
});

// calendar-audit 복구 블록이 실제로 이 함수를 쓰는지 (소스 확인 — 제목 하드코딩 재발 방지)
test('calendar-audit 복구 블록이 buildExtraDayEventFields_ 를 쓴다', () => {
  assert.ok(!SRC.includes("+' (추가일정 복구)'"), '복구 제목 하드코딩이 되살아났다');
  assert.ok(SRC.includes('const xf=buildExtraDayEventFields_('), '복구 블록이 공용 제목 함수를 안 쓴다');
});

console.log(`\n✅ ${n}개 검사 통과`);
