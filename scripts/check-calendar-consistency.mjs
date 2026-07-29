#!/usr/bin/env node
/**
 * check-calendar-consistency.mjs — 캘린더 fail-closed · 예약↔캘린더 정합 점검 검증기
 *
 * 가용성 판정은 캘린더만 읽는다. 그래서 두 가지가 목숨줄이다:
 *   1) 캘린더 읽기가 실패했을 때 '이벤트 0건 = 전부 가용'으로 fail-open 하지 않을 것
 *   2) '시트에는 있는데 캘린더에 없는' 활성 예약을 매일 찾아내 재생성할 것
 * Code.gs **원본 소스를 떼어내** 가짜 캘린더/시트 위에서 돌린다(재구현 아님).
 * 추가로, 함수 통째 추출이 불가능한 소비자 4곳(slotAvailable_/getPublicSlots_/
 * getUnavailableDays/getAvailableSlots)과 취소 3경로는 **구조 검증**으로 가드 존재를 못박는다.
 *
 * 사용법:  node scripts/check-calendar-consistency.mjs        (불일치 시 exit 1)
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

const headersLine = gs.split('\n').find((l) => l.includes("BOOKING_HEADERS: ['예약일시'"));
if (!headersLine) throw new Error('BOOKING_HEADERS 를 찾지 못했습니다.');

// getEventsForRange_ 는 'var CAL_READ_FAILED_' 선언과 함께 떼어낸다
const flagDecl = "var CAL_READ_FAILED_=false;";
if (!gs.includes(flagDecl)) throw new Error('CAL_READ_FAILED_ 선언을 찾지 못했습니다.');

const MODULE = [
  `const CONFIG={TIMEZONE:'Europe/Berlin',MAIN_CALENDAR_ID:'main-cal',${headersLine.trim().replace(/,$/, '')}};`,
  `const BOOKING_COL=CONFIG.BOOKING_HEADERS.reduce((a,h,i)=>{a[h]=i;return a;},{});`,
  `const Utilities={formatDate:(d,tz,f)=>{
     const p=(n)=>String(n).padStart(2,'0');
     const s=\`\${d.getFullYear()}-\${p(d.getMonth()+1)}-\${p(d.getDate())} \${p(d.getHours())}:\${p(d.getMinutes())}:\${p(d.getSeconds())}\`;
     return f.includes('ss')?s:(f.includes('HH')?s.slice(0,16):s.slice(0,10));
   }};`,
  `const Logger={log:()=>{}};`,
  `function formatDateMinute_(d){ return Utilities.formatDate(d,CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm'); }`,
  extractFn(gs, 'parseDateSafe_'),

  // ── 가짜 캘린더 세계 ─────────────────────────────────────────────────────
  `class FakeEvent {
     constructor(id,startMs,endMs,title,location,allDay){ this.id=id; this.s=startMs; this.e=endMs; this.t=title||''; this.l=location||''; this.allDay=!!allDay; this.deleted=false; }
     getId(){return this.id;} isAllDayEvent(){return this.allDay;}
     getStartTime(){return new Date(this.s);} getEndTime(){return new Date(this.e);}
     getTitle(){return this.t;} getLocation(){return this.l;}
     deleteEvent(){ if(this.throwOnDelete) throw new Error('delete fail'); this.deleted=true; }
   }
   let __EVSEQ__=0;
   class FakeCalendar {
     constructor(id){ this.id=id; this.events=[]; this.throwOnGetEvents=false; }
     getEvents(s,e){ if(this.throwOnGetEvents) throw new Error('quota'); return this.events.filter(ev=>!ev.deleted&&ev.s<e.getTime()&&ev.e>s.getTime()); }
     getEventById(id){ if(this.throwOnGetById) throw new Error('api err'); const ev=this.events.find(x=>x.id===id&&!x.deleted); return ev||null; }
     createEvent(title,s,e,opts){ const ev=new FakeEvent('new-'+(++__EVSEQ__),s.getTime(),e.getTime(),title); this.events.push(ev); return ev; }
   }
   const __CALS__={};
   const CalendarApp={ getCalendarById:(id)=>(__CALS__[id]&&__CALS__[id].nullOut)?null:(__CALS__[id]||null), getDefaultCalendar:()=>__CALS__['main-cal'] };`,

  // getEventsForRange_ 의존 스텁 — 판정 로직이 아닌 부속만 대체
  `let __META__=[{id:'main-cal',name:'Main',isPersonal:false}];
   function getBusyCalendarMeta_(){ return __META__; }
   function isStudioAutoOpenEventByFields_(){ return false; }
   const SELECT_PICKUP_EVENT_PREFIX='[픽업]';
   function isSelectPickupEventTitle_(t){ return String(t||'').indexOf(SELECT_PICKUP_EVENT_PREFIX)===0; }
   const SELECT_COL={'픽업캘린더ID':99};
   const QUOTE_COL={'가예약캘린더ID':99};
   function ensureSelectSheet_(){ return null; }
   function classifyEventType_(){ return 'B'; }
   const PropertiesService={ getScriptProperties:()=>({ getProperties:()=>({}), getProperty:()=>null, setProperty:()=>{} }) };`,
  flagDecl,
  extractFn(gs, 'getEventsForRange_'),

  // ── 정합 점검 의존: 실제 규칙 함수는 원본을, 부속은 스텁 ─────────────────
  `const BOOKING_CANCELLED=['취소됨','노쇼'];
   function normalizeBookingStatus_(s){return String(s||'').trim();}
   function isBookingCancelledStatus_(s){return BOOKING_CANCELLED.indexOf(normalizeBookingStatus_(s))>=0;}
   function isBookingPostponedStatus_(s){return normalizeBookingStatus_(s)==='촬영연기';}`,
  extractFn(gs, 'isBookingCalendarInactiveStatus_'),
  extractFn(gs, 'deleteBookingCalendarEventById_'),
  `function getBookingDurationMinFromRow_(row,fb){ // 규칙 대상 아님 — 픽스처가 인원 칸으로 길이를 지정
     const o=Number(row[BOOKING_COL['인원']])||0; return o>0?o:60; }
   let __BUMPS__=0;
   function bumpCalCacheVer_(){ __BUMPS__++; }
   let __ENSURE_CALLS__=[];
   let __ENSURE_RESULT__='new-ev-id';
   function ensureBookingCalendarEventForRow_(sheet,rowIndex,row){ __ENSURE_CALLS__.push(rowIndex); if(__ENSURE_RESULT__==='THROW') throw new Error('ensure boom'); return __ENSURE_RESULT__; }
   class FakeSheet {
     constructor(headers,rows){ this.rows=[headers.slice()].concat(rows.map(r=>r.slice())); }
     getDataRange(){ const s=this; return {getValues(){return s.rows.map(r=>r.slice());}}; }
     getRange(r,c){ const s=this; return { setValue(v){ s.rows[r-1][c-1]=v; }, getValues(){ return [s.rows[r-1].slice()]; } }; }
   }
   let __SHEET__=null;
   function ensureSheets_(){ return {bookingSheet:__SHEET__}; }
   function assertAdmin_(){ return true; }
   var ICLOUD_DETAIL_READ_FAILED_=false;
   let __APPLE__=[];
   let __APPLE_FAIL__=false;
   function fetchAppleCalendarDetailedEvents_(s,e){
     ICLOUD_DETAIL_READ_FAILED_=false;
     if(__APPLE_FAIL__){ ICLOUD_DETAIL_READ_FAILED_=true; return []; }
     return __APPLE__;
   }`,
  extractFn(gs, 'parseBookingExtraDays_'),
  extractFn(gs, 'cleanupBookingExtraDayEvents_'),
  extractFn(gs, 'auditBookingCalendarConsistency_'),
  extractFn(gs, 'checkBookingTimeConflict_'),
  `export {FakeEvent,FakeCalendar,FakeSheet,__CALS__,getEventsForRange_,auditBookingCalendarConsistency_,
     deleteBookingCalendarEventById_,checkBookingTimeConflict_};
   export function calReadFailed(){ return CAL_READ_FAILED_; }
   export function setMeta(m){ __META__=m; }
   export function setSheet(s){ __SHEET__=s; }
   export function ensureCalls(){ return __ENSURE_CALLS__; }
   export function resetEnsure(result){ __ENSURE_CALLS__=[]; __ENSURE_RESULT__=result===undefined?'new-ev-id':result; }
   export function resetCals(){ for(const k of Object.keys(__CALS__)) delete __CALS__[k]; }
   export function setApple(events,fail){ __APPLE__=events||[]; __APPLE_FAIL__=!!fail; }
   let __CONFLICT__=false;
   let __CONFLICT_ARGS__=null;
   function checkConflict_(events,s,e,g,l){ __CONFLICT_ARGS__={n:events.length,s:s,e:e,g:g,l:l}; return __CONFLICT__; }
   export function setConflict(v){ __CONFLICT__=!!v; __CONFLICT_ARGS__=null; }
   export function conflictArgs(){ return __CONFLICT_ARGS__; }`,
].join('\n\n');

const H = JSON.parse('[' + headersLine.trim().replace(/^BOOKING_HEADERS:\s*\[/, '').replace(/\],?$/, '') .replace(/'/g, '"') + ']');
const COL = H.reduce((a, h, i) => { a[h] = i; return a; }, {});
const mkRow = (o) => { const r = new Array(H.length).fill(''); Object.entries(o).forEach(([k, v]) => { r[COL[k]] = v; }); return r; };

async function load(src) {
  const dir = mkdtempSync(join(tmpdir(), 'calcheck-'));
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

// 오늘 기준 상대 날짜 (검증기는 실행 시점 기준으로 픽스처를 만든다)
function dayOffset(n, hm) {
  const d = new Date(); d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${hm}`;
}

async function runScenarios(M, rec) {
  const { FakeEvent, FakeCalendar, FakeSheet, __CALS__ } = M;

  // ── 1) getEventsForRange_ — 읽기 실패 플래그 (fail-closed 의 토대) ─────────
  {
    M.resetCals();
    const cal = new FakeCalendar('main-cal');
    cal.events.push(new FakeEvent('e1', Date.parse('2026-08-01T14:00:00'), Date.parse('2026-08-01T15:00:00'), '스튜디오 | 김민지 | 2인 | 170€'));
    __CALS__['main-cal'] = cal;
    M.setMeta([{ id: 'main-cal', name: 'Main', isPersonal: false }]);
    const evs = M.getEventsForRange_(new Date('2026-08-01T00:00:00'), new Date('2026-08-01T23:59:59'));
    rec('읽기정상: 이벤트 반환', evs.length, 1);
    rec('읽기정상: 플래그 false', M.calReadFailed(), false);

    cal.throwOnGetEvents = true;
    const evs2 = M.getEventsForRange_(new Date('2026-08-01T00:00:00'), new Date('2026-08-01T23:59:59'));
    rec('읽기실패(throw): 플래그 true', M.calReadFailed(), true);
    rec('읽기실패(throw): 불완전 목록', evs2.length, 0);

    cal.throwOnGetEvents = false;
    cal.nullOut = true; // getCalendarById 가 null (권한/공유 해제)
    M.getEventsForRange_(new Date('2026-08-01T00:00:00'), new Date('2026-08-01T23:59:59'));
    rec('읽기실패(null 캘린더): 플래그 true', M.calReadFailed(), true);
    cal.nullOut = false;

    // 두 캘린더 중 하나만 실패해도 플래그 — 부분 실패도 '전부 가용' 오염이긴 마찬가지
    const cal2 = new FakeCalendar('personal');
    cal2.throwOnGetEvents = true;
    __CALS__['personal'] = cal2;
    M.setMeta([{ id: 'main-cal', name: 'Main', isPersonal: false }, { id: 'personal', name: 'P', isPersonal: true }]);
    const evs3 = M.getEventsForRange_(new Date('2026-08-01T00:00:00'), new Date('2026-08-01T23:59:59'));
    rec('부분실패: 플래그 true', M.calReadFailed(), true);
    rec('부분실패: 성한 캘린더 이벤트는 유지', evs3.length, 1);
    M.setMeta([{ id: 'main-cal', name: 'Main', isPersonal: false }]);

    // 회복되면 플래그가 리셋된다 — 이전 실패가 눌어붙으면 영구 마감이 된다
    const evs4 = M.getEventsForRange_(new Date('2026-08-01T00:00:00'), new Date('2026-08-01T23:59:59'));
    rec('회복: 플래그 리셋', M.calReadFailed(), false);
    rec('회복: 정상 목록', evs4.length, 1);
  }

  // ── 2) 정합 점검 — 활성/취소/시간미정/겹침 ────────────────────────────────
  {
    M.resetCals(); M.resetEnsure();
    const cal = new FakeCalendar('main-cal');
    __CALS__['main-cal'] = cal;
    const t14 = dayOffset(3, '14:00'), t1430 = dayOffset(3, '14:30'), t16 = dayOffset(3, '16:00');
    const t10 = dayOffset(5, '10:00'), tTbd = dayOffset(6, '00:00');
    const far = dayOffset(90, '11:00'), past = dayOffset(-2, '11:00');
    // 살아있는 이벤트 (정상 케이스, 3일 뒤 16:00)
    cal.events.push(new FakeEvent('ev-ok', Date.parse(t16.replace(' ', 'T') + ':00'), Date.parse(t16.replace(' ', 'T') + ':00') + 3600000, 'ok'));
    // 옮겨진 이벤트 (장부 10:00 ↔ 캘린더 11:00)
    const movedMs = Date.parse(dayOffset(5, '11:00').replace(' ', 'T') + ':00');
    cal.events.push(new FakeEvent('ev-moved', movedMs, movedMs + 3600000, 'moved'));
    // 취소건 잔재 이벤트
    cal.events.push(new FakeEvent('ev-linger', Date.parse(t14.replace(' ', 'T') + ':00'), Date.parse(t14.replace(' ', 'T') + ':00') + 3600000, 'linger'));

    const sheet = new FakeSheet(H, [
      mkRow({ 예약일시: t16, 상태: '확정됨', 고객명: '정상건', 캘린더ID: 'ev-ok' }),          // 2행: 정상
      mkRow({ 예약일시: t14, 상태: '확정됨', 고객명: '이벤트증발', 캘린더ID: 'ev-gone' }),     // 3행: 이벤트 없음 → 재생성
      mkRow({ 예약일시: t1430, 상태: '확정됨', 고객명: '겹침상대', 캘린더ID: '' }),            // 4행: ID 자체가 없음 → 재생성 + 3행과 겹침
      mkRow({ 예약일시: t10, 상태: '확정됨', 고객명: '드래그이동', 캘린더ID: 'ev-moved' }),    // 5행: 시간 불일치 → 보고만
      mkRow({ 예약일시: t14, 상태: '취소됨', 고객명: '취소잔재', 캘린더ID: 'ev-linger' }),     // 6행: 취소인데 이벤트 남음 → 삭제 재시도
      mkRow({ 예약일시: tTbd, 상태: '확정됨', 고객명: 'MRT가등록', 캘린더ID: '' }),            // 7행: 00:00 → 제외
      mkRow({ 예약일시: far, 상태: '확정됨', 고객명: '수평선밖', 캘린더ID: '' }),              // 8행: +90일 → 제외
      mkRow({ 예약일시: past, 상태: '확정됨', 고객명: '과거건', 캘린더ID: '' }),               // 9행: 과거 → 제외
    ]);
    M.setSheet(sheet);
    const rep = M.auditBookingCalendarConsistency_();
    rec('점검: 활성 검사 수(미래·60일 창 내 5건 — 00:00 포함, 이벤트/겹침 검사만 제외)', rep.checked, 5);
    rec('점검: 증발 이벤트 재생성(healed) 2건', rep.healedCount, 2);
    rec('점검: ensure 호출 행 = 3,4', M.ensureCalls(), [3, 4]);
    rec('점검: 드래그 이동은 보고만(driftedCount 1)', rep.driftedCount, 1);
    rec('점검: 드래그 이동에 ensure 호출 안 함(자동 원위치 금지)', M.ensureCalls().indexOf(5) < 0, true);
    rec('점검: 취소 잔재 삭제 재시도 1건', rep.deleteRetriedCount, 1);
    rec('점검: 잔재 이벤트 실제 삭제됨', cal.events.find((e) => e.id === 'ev-linger').deleted, true);
    rec('점검: 잔재 행 ID 클리어', String(sheet.rows[5][COL['캘린더ID']]), '');
    rec('점검: 겹침 탐지(14:00~15:00 ↔ 14:30) 1건', rep.overlapsCount, 1);
    rec('점검: 문제 합계', rep.problemCount, 2 + 1 + 1 + 1);
  }

  // ── 3) 정합 점검 — 실패 경로들 ────────────────────────────────────────────
  {
    // 재생성 실패(ensure 가 '' 반환) → missing 으로 보고
    M.resetCals(); M.resetEnsure('');
    const cal = new FakeCalendar('main-cal'); __CALS__['main-cal'] = cal;
    const t = dayOffset(2, '13:00');
    const sheet = new FakeSheet(H, [mkRow({ 예약일시: t, 상태: '확정됨', 고객명: '복구실패', 캘린더ID: 'nope' })]);
    M.setSheet(sheet);
    const rep = M.auditBookingCalendarConsistency_();
    rec('복구실패: missing 1건', rep.missingCount, 1);
    rec('복구실패: healed 0건', rep.healedCount, 0);

    // 재생성 자체가 throw → missing (점검 전체가 죽지 않는다)
    M.resetEnsure('THROW');
    M.setSheet(new FakeSheet(H, [mkRow({ 예약일시: t, 상태: '확정됨', 고객명: '복구예외', 캘린더ID: 'nope' })]));
    const rep2 = M.auditBookingCalendarConsistency_();
    rec('복구예외: missing 으로 흡수', rep2.missingCount, 1);

    // 취소건 삭제가 실패하면 ID 를 지우지 않는다 (재시도 단서 보존)
    M.resetEnsure();
    const cal2 = new FakeCalendar('main-cal');
    const lingerMs = Date.parse(t.replace(' ', 'T') + ':00');
    const ev = new FakeEvent('ev-stuck', lingerMs, lingerMs + 3600000, 'stuck');
    ev.throwOnDelete = true;
    cal2.events.push(ev);
    M.resetCals(); __CALS__['main-cal'] = cal2;
    const sheet3 = new FakeSheet(H, [mkRow({ 예약일시: t, 상태: '취소됨', 고객명: '삭제불가', 캘린더ID: 'ev-stuck' })]);
    M.setSheet(sheet3);
    const rep3 = M.auditBookingCalendarConsistency_();
    rec('삭제불가: failures 보고', rep3.failures.length, 1);
    rec('삭제불가: ID 보존(재시도 단서)', String(sheet3.rows[1][COL['캘린더ID']]), 'ev-stuck');
  }

  // ── 3b) 취소건인데 이벤트가 이미 없음 — 멱등 삭제(true)로 ID 정리, 오탐 실패 금지 ──
  {
    M.resetCals(); M.resetEnsure();
    __CALS__['main-cal'] = new FakeCalendar('main-cal'); // 이벤트 자체가 없음
    const t = dayOffset(2, '13:00');
    const sheet = new FakeSheet(H, [mkRow({ 예약일시: t, 상태: '취소됨', 고객명: '손으로지움', 캘린더ID: 'already-gone' })]);
    M.setSheet(sheet);
    const rep = M.auditBookingCalendarConsistency_();
    rec('이미없음: 실패로 오탐하지 않음', rep.failures.length, 0);
    rec('이미없음: ID 정리됨(매일 반복 차단)', String(sheet.rows[1][COL['캘린더ID']]), '');
    rec('이미없음: deleteRetried 로 집계', rep.deleteRetriedCount, 1);
  }

  // ── 3c) 3중 겹침 — 긴 예약 위에 짧은 예약 둘: 인접쌍 비교면 A↔C 를 놓친다 ──
  {
    M.resetCals(); M.resetEnsure();
    const cal = new FakeCalendar('main-cal'); __CALS__['main-cal'] = cal;
    const mk = (hm, dur, name, id) => {
      const dt = dayOffset(7, hm);
      const ms = Date.parse(dt.replace(' ', 'T') + ':00');
      cal.events.push(new FakeEvent(id, ms, ms + dur * 60000, name));
      return mkRow({ 예약일시: dt, 상태: '확정됨', 고객명: name, 캘린더ID: id, 인원: dur });
    };
    const sheet = new FakeSheet(H, [
      mk('09:00', 240, '긴예약A', 'ov-a'),   // 09:00~13:00
      mk('09:30', 30, '짧은B', 'ov-b'),      // 09:30~10:00 (A와 겹침)
      mk('10:30', 30, '짧은C', 'ov-c'),      // 10:30~11:00 (B와는 안 겹치고 A와 겹침)
    ]);
    M.setSheet(sheet);
    const rep = M.auditBookingCalendarConsistency_();
    rec('3중겹침: A↔B, A↔C 둘 다 탐지', rep.overlapsCount, 2);
  }

  // ── 5) 애플 이원 운영 — 확정 후 애플 '사진 촬영' 캘린더로 이관 (2026-07-28 사장님 확인) ──
  {
    const mkApple = (dayOff, hm, durMin, title) => {
      const ms = Date.parse(dayOffset(dayOff, hm).replace(' ', 'T') + ':00');
      return { id: '', start: ms, end: ms + durMin * 60000, title, location: '', isPersonal: false };
    };
    const t = dayOffset(3, '14:00');

    // 5a) 이관: 구글엔 없고 애플에 있음 → 재생성 금지(중복 방지)
    M.resetCals(); M.resetEnsure();
    __CALS__['main-cal'] = new FakeCalendar('main-cal');
    M.setApple([mkApple(3, '14:00', 60, '스튜디오 | 이관고객 | 2인 | 170€')], false);
    M.setSheet(new FakeSheet(H, [mkRow({ 예약일시: t, 상태: '확정됨', 고객명: '이관고객', 캘린더ID: 'moved-away' })]));
    let rep = M.auditBookingCalendarConsistency_();
    rec('애플이관: 재생성하지 않음', M.ensureCalls().length, 0);
    rec('애플이관: missing 0', rep.missingCount, 0);
    rec('애플이관: appleMovedCount 1', rep.appleMovedCount, 1);
    rec('애플이관: 문제 0 (정상 운영)', rep.problemCount, 0);

    // 5b) 이관 + 시간 불일치 → 드리프트 보고만 (재생성 여전히 금지)
    M.resetEnsure();
    M.setApple([mkApple(3, '16:00', 60, '스튜디오 | 이관고객 | 2인 | 170€')], false);
    rep = M.auditBookingCalendarConsistency_();
    rec('애플드리프트: drift 1', rep.driftedCount, 1);
    rec('애플드리프트: 재생성 안 함', M.ensureCalls().length, 0);

    // 5c) 중복: 구글에도 있고 애플에도 있음 → dupBoth 보고
    M.resetEnsure();
    const cal = new FakeCalendar('main-cal');
    const ms = Date.parse(t.replace(' ', 'T') + ':00');
    cal.events.push(new FakeEvent('g-ev', ms, ms + 3600000, '스튜디오 | 이관고객 | 2인 | 170€'));
    M.resetCals(); __CALS__['main-cal'] = cal;
    M.setApple([mkApple(3, '14:00', 60, '스튜디오 | 이관고객 | 2인 | 170€')], false);
    M.setSheet(new FakeSheet(H, [mkRow({ 예약일시: t, 상태: '확정됨', 고객명: '이관고객', 캘린더ID: 'g-ev' })]));
    rep = M.auditBookingCalendarConsistency_();
    rec('중복: dupBoth 1', rep.dupBothCount, 1);

    // 5d) 취소건인데 애플에 일정 잔존 → 보고 (시스템은 애플에 못 쓴다)
    M.resetCals(); M.resetEnsure();
    __CALS__['main-cal'] = new FakeCalendar('main-cal');
    M.setApple([mkApple(3, '14:00', 60, '스튜디오 | 취소고객 | 2인 | 170€')], false);
    M.setSheet(new FakeSheet(H, [mkRow({ 예약일시: t, 상태: '취소됨', 고객명: '취소고객', 캘린더ID: '' })]));
    rep = M.auditBookingCalendarConsistency_();
    rec('애플잔존: appleLinger 1', rep.appleLingerCount, 1);
    rec('애플잔존: 문제 집계 포함', rep.problemCount >= 1, true);

    // 5e) 이관처(공유 캘린더) 조회 실패 → '증발/이관' 판정 불가 → 재생성 보류 + 실패 보고
    M.resetCals(); M.resetEnsure();
    __CALS__['main-cal'] = new FakeCalendar('main-cal');
    const sharedFail = new FakeCalendar('shared-cal'); sharedFail.throwOnGetEvents = true;
    __CALS__['shared-cal'] = sharedFail;
    M.setMeta([{ id: 'main-cal', name: 'Main', isPersonal: false }, { id: 'shared-cal', name: '사진촬영 일정', isPersonal: false }]);
    M.setApple([], false);
    M.setSheet(new FakeSheet(H, [mkRow({ 예약일시: t, 상태: '확정됨', 고객명: '판정불가', 캘린더ID: 'gone' })]));
    rep = M.auditBookingCalendarConsistency_();
    rec('이관처 조회실패: 재생성 보류(중복 폭탄 방지)', M.ensureCalls().length, 0);
    rec('이관처 조회실패: missing 0 (판정 보류)', rep.missingCount, 0);
    rec('이관처 조회실패: failures 보고', rep.failuresCount >= 1, true);
    M.setMeta([{ id: 'main-cal', name: 'Main', isPersonal: false }]); // 원복

    // 5f) 이관 판별이 구글 공유 캘린더(사진촬영 일정)를 직접 읽는다 — ICS 피드 없이도 동작
    M.resetCals(); M.resetEnsure();
    __CALS__['main-cal'] = new FakeCalendar('main-cal');
    const sharedCal = new FakeCalendar('shared-cal');
    const msS = Date.parse(t.replace(' ', 'T') + ':00');
    sharedCal.events.push(new FakeEvent('sh-1', msS, msS + 3600000, '스튜디오 | 공유이관고객 | 2인 | 170€'));
    __CALS__['shared-cal'] = sharedCal;
    M.setMeta([{ id: 'main-cal', name: 'Main', isPersonal: false }, { id: 'shared-cal', name: '사진촬영 일정', isPersonal: false }]);
    M.setApple([], false); // ICS 피드는 빈 상태 — 공유 캘린더만으로 판별돼야 한다
    M.setSheet(new FakeSheet(H, [mkRow({ 예약일시: t, 상태: '확정됨', 고객명: '공유이관고객', 캘린더ID: 'moved-x' })]));
    rep = M.auditBookingCalendarConsistency_();
    rec('공유캘린더 이관: 재생성하지 않음', M.ensureCalls().length, 0);
    rec('공유캘린더 이관: appleMovedCount 1', rep.appleMovedCount, 1);
    M.setMeta([{ id: 'main-cal', name: 'Main', isPersonal: false }]); // 원복

    M.setApple([], false); // 이후 섹션은 애플 미설정 상태로
  }

  // ── 6) 쓰기 경로 충돌검사 코어 — 수기등록·견적전환·일정변경이 공유하는 판정 ──
  {
    // 정상 조회 + 충돌 없음
    M.resetCals();
    const cal = new FakeCalendar('main-cal'); __CALS__['main-cal'] = cal;
    M.setConflict(false);
    let r = M.checkBookingTimeConflict_(dayOffset(5, '14:00').slice(0, 10), '14:00', 60, 'stud', '', '');
    rec('충돌검사: 정상+비충돌', JSON.stringify(r), JSON.stringify({ readFailed: false, conflict: false }));

    // 정상 조회 + 충돌
    M.setConflict(true);
    r = M.checkBookingTimeConflict_(dayOffset(5, '14:00').slice(0, 10), '14:00', 60, 'stud', '', '');
    rec('충돌검사: 정상+충돌', JSON.stringify(r), JSON.stringify({ readFailed: false, conflict: true }));

    // 캘린더 조회 실패 → 모른다 = 거부 신호 (fail-closed)
    M.resetCals();
    const calFail = new FakeCalendar('main-cal'); calFail.throwOnGetEvents = true;
    __CALS__['main-cal'] = calFail;
    M.setConflict(false);
    r = M.checkBookingTimeConflict_(dayOffset(5, '14:00').slice(0, 10), '14:00', 60, 'stud', '', '');
    rec('충돌검사: 조회실패 → readFailed+conflict', JSON.stringify(r), JSON.stringify({ readFailed: true, conflict: true }));

    // 자기 자신 이벤트 제외 (일정 이동 시 자기 시간과의 가짜 충돌 방지)
    M.resetCals();
    const cal2 = new FakeCalendar('main-cal'); __CALS__['main-cal'] = cal2;
    const ms5 = Date.parse(dayOffset(5, '14:00').replace(' ', 'T') + ':00');
    cal2.events.push(new FakeEvent('self-ev', ms5, ms5 + 3600000, '자기이벤트'));
    cal2.events.push(new FakeEvent('other-ev', ms5, ms5 + 3600000, '남의이벤트'));
    M.setConflict(false);
    M.checkBookingTimeConflict_(dayOffset(5, '14:00').slice(0, 10), '14:00', 60, 'stud', '', 'self-ev');
    rec('충돌검사: 자기 이벤트 제외 후 1개만 비교', M.conflictArgs().n, 1);
    M.checkBookingTimeConflict_(dayOffset(5, '14:00').slice(0, 10), '14:00', 60, 'stud', '', '');
    rec('충돌검사: 제외 없으면 2개 비교', M.conflictArgs().n, 2);
  }

  // ── 7) 역방향 고아 탐지 — 시트엔 없는데 캘린더엔 예약형 이벤트 ────────────────
  {
    M.resetCals(); M.resetEnsure();
    const cal = new FakeCalendar('main-cal'); __CALS__['main-cal'] = cal;
    const mk = (dayOff, hm, title, id) => {
      const ms = Date.parse(dayOffset(dayOff, hm).replace(' ', 'T') + ':00');
      cal.events.push(new FakeEvent(id, ms, ms + 3600000, title));
    };
    // 시트가 아는 이벤트 (행 존재)
    const known = mkRow({ 예약일시: dayOffset(4, '10:00'), 상태: '확정됨', 고객명: '정상고객', 캘린더ID: 'known-1' });
    mk(4, '10:00', '스튜디오 | 정상고객 | 2인', 'known-1');
    // 고아 1: 예약형 제목, 시트에 없음
    mk(5, '15:00', '여권/비자 | 유령손님 | 1인', 'orphan-1');
    // 고아 2: 파이프 패턴
    mk(6, '11:00', '프로필 Professional | 김유령 | 30€', 'orphan-2');
    // 제외 대상: 픽업 이벤트
    mk(7, '13:00', '[픽업] 홍길동 | 여권/비자', 'pickup-1'); // 파이프 있음 → 픽업 제외가 유일한 방어
    // 제외 대상: 가예약
    mk(8, '09:00', '[가예약] 기업고객 | AN-260010', 'hold-1');
    // 제외 대상: 개인 메모성(파이프·키워드 없음)
    mk(9, '16:00', '치과 예약', 'personal-1');
    // 제외 대상: 상담 이벤트(파이프+키워드 있지만 예약 아님)
    mk(10, '13:20', '[상담:원격] 이메일 상담 | Alice | 웨딩', 'consult-1');
    M.setSheet(new FakeSheet(H, [known]));
    const rep = M.auditBookingCalendarConsistency_();
    rec('고아: 예약형 미등록 이벤트 2건만 탐지', rep.orphansCount, 2);
    rec('고아: 픽업/가예약/상담/개인메모/정상은 제외', rep.orphansCount, 2);
    rec('고아: problemCount 에 반영', rep.problemCount >= 2, true);
  }

  // ── 7) 다일정(추가 촬영일, 2026-07-29 휘슬러 건) — knownIds·취소 정리·증발 복구 ──
  {
    const t1 = dayOffset(4, '10:00');
    const exDate = dayOffset(5, '09:00').slice(0, 10);
    const exJson = JSON.stringify([{ date: exDate, time: '09:00', durationMin: 480, eventId: 'x1' }]);

    // 7a) 활성행의 추가일정 이벤트는 고아가 아니다 (knownIds 수집)
    M.resetCals(); M.resetEnsure(); M.setApple([], false);
    const cal = new FakeCalendar('main-cal'); __CALS__['main-cal'] = cal;
    const ms1 = Date.parse(t1.replace(' ', 'T') + ':00');
    cal.events.push(new FakeEvent('d1', ms1, ms1 + 3600000, '행사 | 휘슬러 | 1000€'));
    const msX = Date.parse(exDate + 'T09:00:00');
    cal.events.push(new FakeEvent('x1', msX, msX + 3600000, '행사 | 휘슬러 | 1000€ (2/2일차)'));
    M.setSheet(new FakeSheet(H, [mkRow({ 예약일시: t1, 상태: '확정됨', 고객명: '휘슬러', 캘린더ID: 'd1', 추가일정JSON: exJson })]));
    let rep = M.auditBookingCalendarConsistency_();
    rec('다일정: 추가 이벤트 고아 아님', rep.orphansCount, 0);
    rec('다일정: 정상 상태 문제 0', rep.problemCount, 0);

    // 7b) 취소행 → 추가 이벤트 정리
    M.setSheet(new FakeSheet(H, [mkRow({ 예약일시: t1, 상태: '취소됨', 고객명: '휘슬러', 캘린더ID: '', 추가일정JSON: exJson })]));
    rep = M.auditBookingCalendarConsistency_();
    rec('다일정: 취소 시 추가 이벤트 삭제', cal.events.find(e => e.id === 'x1').deleted === true, true);
    rec('다일정: 정리 집계(deleteRetried)', rep.deleteRetriedCount >= 1, true);

    // 7c) 활성행 추가 이벤트 증발 → 재생성 + JSON eventId 갱신
    M.resetCals(); M.resetEnsure();
    const cal2 = new FakeCalendar('main-cal'); __CALS__['main-cal'] = cal2;
    cal2.events.push(new FakeEvent('d1', ms1, ms1 + 3600000, '행사 | 휘슬러'));
    const sh7 = new FakeSheet(H, [mkRow({ 예약일시: t1, 상태: '확정됨', 고객명: '휘슬러', 캘린더ID: 'd1', 추가일정JSON: JSON.stringify([{ date: exDate, time: '09:00', durationMin: 480, eventId: 'gone-x' }]) })]);
    M.setSheet(sh7);
    rep = M.auditBookingCalendarConsistency_();
    rec('다일정: 증발 복구 healed', rep.healedCount, 1);
    rec('다일정: 복구 이벤트 생성', cal2.events.some(e => String(e.t || '').indexOf('추가일정 복구') >= 0), true);
    const savedJson = JSON.parse(String(sh7.rows[1][COL['추가일정JSON']] || '[]'));
    rec('다일정: JSON eventId 갱신', !!(savedJson[0] && savedJson[0].eventId && savedJson[0].eventId !== 'gone-x'), true);
  }

  // ── 4) CAP — 목록은 잘려도 count 는 전체 ─────────────────────────────────
  {
    M.resetCals(); M.resetEnsure('');
    __CALS__['main-cal'] = new FakeCalendar('main-cal');
    const rows = [];
    for (let i = 0; i < 13; i++) rows.push(mkRow({ 예약일시: dayOffset(4, `0${9 + (i % 1)}:${String(i).padStart(2, '0')}`.slice(-5)), 상태: '확정됨', 고객명: '건' + i, 캘린더ID: 'x' + i }));
    // 시간 형식 보정: 09:00~09:12 로 13건
    for (let i = 0; i < 13; i++) rows[i][COL['예약일시']] = dayOffset(4, `09:${String(i).padStart(2, '0')}`);
    M.setSheet(new FakeSheet(H, rows));
    const rep = M.auditBookingCalendarConsistency_();
    rec('CAP: missingCount 는 전체 13', rep.missingCount, 13);
    rec('CAP: 목록은 10건까지', rep.missing.length, 10);
  }
}

// ── 구조 검증 — 통째 추출이 불가능한 소비자들의 가드 존재를 소스에서 못박는다 ──
const STRUCTURAL = [
  ['slotAvailable_ 가 읽기실패 시 false (제출 최후 방어선)',
    /if\(CAL_READ_FAILED_\) return false;\n\s*return!checkConflict_\(dayEvents/],
  ['processForm 이 읽기실패를 일시 오류로 구분 안내',
    /if\(CAL_READ_FAILED_\) throw new Error\('예약 시스템이 일정을 일시적으로 확인할 수 없습니다/],
  ['getPublicSlots_ 읽기실패 시 빈 슬롯 + 캐시 미적재',
    /if\(CAL_READ_FAILED_\)\{\n(.*\n)*?\s*return \[\];\n\s*\}\n\s*const slotStrings/],
  ['getUnavailableDays 읽기실패 시 전일 마감 + 캐시 미적재',
    /return \{unavail:allDays,closed:\[\],slotCounts:\{\},slotsByDate:\{\},calReadFailed:true\};/],
  ['getAvailableSlots 읽기실패 시 빈 슬롯',
    /if\(CAL_READ_FAILED_\) return \[\];/],
  ['상담 예약이 읽기실패 시 생성 거부',
    /if\(CAL_READ_FAILED_\) throw new Error\('일정 확인이 일시적으로 불가합니다/],
  ['고객 취소: 삭제 성공시에만 캘린더ID 클리어',
    /if\(deleteBookingCalendarEventById_\(eventId\)\)\{\n\s*if\(BOOKING_COL\['캘린더ID'\]!=null\) sh\.getRange\(idx\+2/],
  ['어드민 취소: 삭제 성공시에만 클리어',
    /if\(eventId&&deleteBookingCalendarEventById_\(eventId\)\)\{ \/\/ 실패 시 ID 보존/],
  ['자동취소: 삭제 성공시에만 클리어 + 캐시 무효화',
    /if\(eventId&&deleteBookingCalendarEventById_\(eventId\)\)\{ \/\/ 실패 시 ID 보존[\s\S]{0,300}bumpCalCacheVer_\(\);/],
  ['ensure 비활성 분기: 삭제 성공시에만 클리어',
    /const deletedOk=eventId\?deleteBookingCalendarEventById_\(eventId\):true;\n\s*if\(deletedOk&&eventCol!=null\)/],
  ['일괄삭제: 이벤트 정리 성공시에만 행 삭제(실패 행 보존) + 다일정 정리 + 참조보정 + 캐시 무효화',
    /if\(evId\) evCleared=deleteBookingCalendarEventById_\(evId\);[\s\S]{0,700}cleanupBookingExtraDayEvents_\(null,0,fakeRow\);[\s\S]{0,200}if\(evCleared\)\{\n\s*sh\.deleteRow\(i\.rowIndex\);[\s\S]{0,200}repairRefsAfterBookingRowDelete_\(sheetsForFix,i\.rowIndex\);[\s\S]{0,160}else skipped\.push\(i\.rowIndex\);[\s\S]{0,80}bumpCalCacheVer_\(\);/],
  ['수기등록: 충돌 가드 + MRT/시간미정 예외 + 다일정 검사 + 강행 스탬프',
    /if\(time!=='00:00'\)\{ \/\/ 시간미정 관행 행은 검사 무의미[\s\S]{0,1800}conflictStamp='\[충돌확인필요\] '/],
  ['수기등록: 스크립트 잠금(공개 예약과 직렬화)',
    /__wlock=LockService\.getScriptLock\(\);\n\s*if\(!__wlock\.tryLock\(10000\)\)/],
  ['견적전환: 충돌 가드',
    /if\(o\.allowConflict!==true\)\{\n\s*const cc=checkBookingTimeConflict_\(dateStr,timeStr,durationMin,bookingItemGroup/],
  ['일정변경 승인: 충돌 가드(자기 이벤트 제외) + 애플 이관 안내',
    /if\(allowConflict!==true\)\{\n\s*const cc=checkBookingTimeConflict_\([\s\S]{0,300}durationMin,String\(row\[6\]\|\|''\),parseBookingLocationFromRow_\(row\),eventId\);[\s\S]{0,2600}res\.appleNote=/],
  ['고객 일정변경 제출: 쓰기 전 충돌 재검증(3개국어 거부)',
    /const cc=checkBookingTimeConflict_\(\n\s*Utilities\.formatDate\(newDate,CONFIG\.TIMEZONE,'yyyy-MM-dd'\),[\s\S]{0,600}return\{ok:false,conflict:true,message:msgs\[lang2\]\|\|msgs\.ko\};/],
  ['에이전트 시간설정: 충돌 가드(force 강행)',
    /if\(payload\.force!==true&&m\[2\]!=='00:00'\)\{[\s\S]{0,600}return\{ok:false,conflict:true,message:'해당 시간\('/],
  ['브리핑이 정합 점검을 포함하고 실패를 표면화',
    /calendarAudit=auditBookingCalendarConsistency_\(\);[\s\S]{0,140}_briefFail_\(sectionFailures,'캘린더 정합'/],
  ['브리핑 액션 수에 정합 문제 반영',
    /\+\(\(b\.calendarAudit&&b\.calendarAudit\.problemCount\)\|\|0\)/],
];

// ── 본 검증 ──────────────────────────────────────────────────────────────────
const { mod, dir } = await load(MODULE);
const baseline = [];
await runScenarios(mod, (name, actual, expected) => { baseline.push(name); check(name, actual, expected); });
rmSync(dir, { recursive: true, force: true });

for (const [label, pattern] of STRUCTURAL) {
  if (!pattern.test(gs)) failures.push(`구조: ${label} — 패턴이 소스에 없습니다`);
}

console.log(`행동 시나리오 ${baseline.length}건 + 구조 검증 ${STRUCTURAL.length}건`);
if (failures.length) {
  console.error(`\n❌ 불일치 ${failures.length}건\n`);
  failures.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log('✅ 전부 일치');

// ── 결함 주입 — 검증기가 실제로 잡는지 증명 ──────────────────────────────────
const FAULTS = [
  ['읽기실패를 삼키고 플래그를 안 세움(fail-open 회귀)',
    /\}catch\(e\)\{CAL_READ_FAILED_=true;Logger\.log\('캘린더 오류: '\+e\.message\);\}/,
    "}catch(e){Logger.log('캘린더 오류: '+e.message);}"],
  ['충돌검사가 조회실패를 통과로 처리(fail-open)',
    /if\(CAL_READ_FAILED_\) return\{readFailed:true,conflict:true\};/,
    'if(CAL_READ_FAILED_) return{readFailed:false,conflict:false};'],
  ['충돌검사가 자기 이벤트를 제외하지 않음(이동 시 가짜 충돌)',
    /if\(exId\) events=events\.filter\(function\(ev\)\{return String\(ev\.id\|\|''\)!==exId;\}\);/,
    ''],
  ['역방향 고아 탐지 제거(장부에 없는 캘린더 일정 방치)',
    /push\('orphans',Utilities\.formatDate\(ev\.getStartTime\(\),CONFIG\.TIMEZONE,'yyyy-MM-dd HH:mm'\)\+' '\+String\(title\)\.slice\(0,40\)\);/,
    ''],
  ['고아 탐지가 픽업 이벤트를 오탐(제외 실패)',
    /if\(isSelectPickupEventTitle_\(title\)\) continue;\s*\/\/ 픽업/,
    ''],
  ['고아 탐지가 개인 메모까지 고아로 오탐(예약형 판정 무력화)',
    /const looksBooking=title\.indexOf\('\|'\)>=0\|\|/,
    'const looksBooking=true||title.indexOf("|")>=0||'],
  ['null 캘린더를 조용히 스킵',
    /if\(!cal\)\{CAL_READ_FAILED_=true;Logger\.log\('캘린더 접근 불가\(null\): '\+m\.id\);return;\}/,
    'if(!cal)return;'],
  ['플래그가 호출마다 리셋되지 않음(영구 마감)',
    /function getEventsForRange_\(start,end\)\{\n  CAL_READ_FAILED_=false;/,
    'function getEventsForRange_(start,end){'],
  ['정합점검: 증발 이벤트를 재생성하지 않음',
    /const healedId=ensureBookingCalendarEventForRow_\(bookingSheet,r\+1,row\);/,
    "const healedId='skip';"],
  ['정합점검: 드래그 이동을 자동 원위치(위험 동작)',
    /\}else if\(ev\)\{\n      const evStart=/,
    '}else if(ev){\n      ensureBookingCalendarEventForRow_(bookingSheet,r+1,row);\n      const evStart='],
  ['정합점검: 취소 잔재 삭제 실패에도 ID 클리어',
    /if\(deleteBookingCalendarEventById_\(eventId\)\)\{\n            bookingSheet\.getRange\(r\+1,BOOKING_COL\['캘린더ID'\]\+1\)\.setValue\(''\);/,
    "if(true){\n            deleteBookingCalendarEventById_(eventId);\n            bookingSheet.getRange(r+1,BOOKING_COL['캘린더ID']+1).setValue('');"],
  ['정합점검: 시간미정 00:00 을 겹침에 포함(가짜 경보)',
    /const isTbd=dtStr\.slice\(11,16\)==='00:00';/,
    'const isTbd=false;'],
  ['정합점검: CAP 초과분이 count 에서도 누락',
    /report\[listName\+'Count'\]\+\+;\n    if\(report\[listName\]\.length<CAP\) report\[listName\]\.push\(text\);/,
    "if(report[listName].length<CAP){report[listName+'Count']++;report[listName].push(text);}"],
  ['정합점검: 겹침 탐지 제거',
    /if\(maxEndIdx>=0&&active\[i\]\.startMs<active\[maxEndIdx\]\.endMs\)\{/,
    'if(false){'],
  ['정합점검: 인접쌍 비교로 회귀(3중 겹침 누락)',
    /let maxEndIdx=-1;\n  for\(let i=0;i<active\.length;i\+\+\)\{\n    if\(maxEndIdx>=0&&active\[i\]\.startMs<active\[maxEndIdx\]\.endMs\)\{\n      push\('overlaps',active\[maxEndIdx\]\.name\+' '\+active\[maxEndIdx\]\.dt\+' ↔ '\+active\[i\]\.name\+' '\+active\[i\]\.dt\);\n    \}\n    if\(maxEndIdx<0\|\|active\[i\]\.endMs>active\[maxEndIdx\]\.endMs\) maxEndIdx=i;\n  \}/,
    "for(let i=1;i<active.length;i++){\n    if(active[i].startMs<active[i-1].endMs){\n      push('overlaps',active[i-1].name+' '+active[i-1].dt+' ↔ '+active[i].name+' '+active[i].dt);\n    }\n  }"],
  ['멱등삭제 회귀: 이미 없는 이벤트를 실패로 취급(매일 오탐)',
    /if\(!ev\) return true; \/\/ 이미 없음 \(멱등 삭제\)/,
    'if(!ev) return false;'],
  ['애플 이관을 무시하고 재생성(구글+애플 중복 생성)',
    /if\(apple\)\{\n        \/\/ 확정 후 애플로 이관된 정상 상태/,
    'if(false){\n        // 확정 후 애플로 이관된 정상 상태'],
  ['애플 피드 실패에도 재생성 강행(중복 폭탄)',
    /\}else if\(appleFeedFailed\)\{/,
    '}else if(false){'],
  ['취소건 애플 잔존 미탐지(슬롯 영구 잠김 방치)',
    /if\(!appleFeedFailed&&appleSameDayMatch\(name,day\)\)\{\n        push\('appleLinger'/,
    "if(false){\n        push('appleLinger'"],
  ['구글·애플 중복 미탐지',
    /if\(apple\) push\('dupBoth',name/,
    "if(false) push('dupBoth',name"],
  ['다일정 knownIds 수집 제거(추가 이벤트 매일 고아 오탐)',
    /parseBookingExtraDays_\(row\)\.forEach\(function\(xd\)\{\n\s*const xid=String\(xd&&xd\.eventId\|\|''\)\.trim\(\);\n\s*if\(xid\) knownIds\.add\(xid\);\n\s*\}\);/,
    ''],
  ['다일정 취소 정리 제거(추가 날짜 영구 잠김)',
    /const exClean=cleanupBookingExtraDayEvents_\(bookingSheet,r\+1,row\);/,
    'const exClean={deleted:0,failed:0};'],
  ['다일정 증발 복구 제거',
    /if\(!isTbd&&BOOKING_COL\['추가일정JSON'\]!=null\)\{\n      const exDays=parseBookingExtraDays_\(row\);/,
    "if(false){\n      const exDays=parseBookingExtraDays_(row);"],
];

let caught = 0;
for (const [label, pattern, replacement] of FAULTS) {
  if (!pattern.test(MODULE)) {
    console.error(`\n❌ 결함주입 대상 패턴을 못 찾음: ${label} (원본 변경 시 검증기 동기화 필요)`);
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
    console.error(`\n❌ 결함을 심었는데 통과: ${label}`);
    process.exit(1);
  }
  caught += 1;
  console.log(`   결함 감지 OK — ${label} (${diffs.length}개 실패)`);
}
console.log(`✅ 결함 주입 ${caught}/${FAULTS.length} 모두 감지`);
