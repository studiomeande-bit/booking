#!/usr/bin/env node
/**
 * check-deposit-hold.mjs — 계약금 안내 보류(deposit_hold_from/until) 검증기
 *
 * 왜: 사장님 엘턴겔트 수급월(2026-10-21~11-20)에 계약금이 들어오면 수급기간 소득이 된다. 그래서 그 창엔
 *   확정 메일이 계좌를 싣지 않고, L2 가 리마인더·자동취소를 멈추고, until 아침에 보류분에 계좌 메일을 보낸다.
 *   틀리면 두 방향 다 실제 사고다 — 창 안에 계좌가 나가거나(수급 소득), 해제 다음 날 보류분이 일괄 자동취소된다.
 *
 * 검사 (Code.gs 를 GAS 스텁 위에 통째로 올리고 시계·시트·메일만 가짜로 — 로직 복제 없음):
 *   1) getDepositHold_ 창 판정 [from,until) · 해제 시점 · 잘못된 설정은 꺼짐 · 창 전 기한 당김(payByCap)·cutoff 보류
 *   2) L2 시나리오: 보류 전 정상 리마인더 → 보류 중 무동작 → until 아침 계좌 메일(1회) → +7일 리마인더 → +10일 자동취소
 *   3) 보류분 선정: 입금완료·현장결제 예외·촬영 지난 건·until 이후 확정분 제외
 *   4) 메일 문구: 확정 메일 대체 안내엔 계좌 없음 · 해제 메일엔 계좌+기한 · 감사줄은 고객 표시에서 제거
 *   5) 에이전트: set 은 dryRun 기본 · 형식 검증 · release 는 confirm:'SEND' 없으면 dryRun · 디스패치 등록
 *   6) 소스 배선: sendConfirmEmail_ 계좌 블록·.ics depositAmount · 브리핑 '보류(MM/DD 안내)'
 *
 * 사용법:  node scripts/check-deposit-hold.mjs          (불일치 시 exit 1)
 *          node scripts/check-deposit-hold.mjs --show   (KO/EN/DE 메일 문구 출력)
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.TZ = 'Europe/Berlin';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const SHOW = process.argv.includes('--show');

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};

const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁 — 이 검사는 실서비스에 닿으면 안 된다`); } });
const pad = (n) => String(n).padStart(2, '0');
Object.assign(globalThis, {
  Utilities: {
    formatDate: (d, _tz, fmt) => {
      const x = new Date(d);
      const ymd = `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
      const hm = `${pad(x.getHours())}:${pad(x.getMinutes())}`;
      return fmt === 'HH:mm' ? hm : fmt && fmt.includes('HH:mm:ss') ? `${ymd} ${hm}:00` : fmt && fmt.includes('HH:mm') ? `${ymd} ${hm}` : ymd;
    },
    computeDigest: () => [0], DigestAlgorithm: { MD5: 'MD5' },
  },
  SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'), CalendarApp: nope('CalendarApp'),
  MailApp: nope('MailApp'), GmailApp: nope('GmailApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});

/* 가짜 시계·설정·시트·메일 — 뒤에 선언한 function 이 Code.gs 의 같은 이름을 덮는다 */
const dir = mkdtempSync(join(tmpdir(), 'dephold-'));
const file = join(dir, 'code.cjs');
writeFileSync(file, `const __RealDate=globalThis.Date; let __NOW__=0;
class Date extends __RealDate { constructor(...a){ if(a.length) super(...a); else super(__NOW__); } static now(){ return __NOW__; } }
${src}
const __T__={settings:{},rows:[],sent:[],reminded:[],cancelled:[]};
function getSettingsMap_(){ return __T__.settings; }
function upsertSetting_(k,v){ __T__.settings[k]=v; }
function assertAdmin_(){ return true; }
function getDbSheet(){ return {getDataRange:()=>({getValues:()=>__T__.rows}),
  getRange:(r,c)=>({setValue:(v)=>{ __T__.rows[r-1][c-1]=v; }})}; }
function ensureSheets_(){ return {bookingSheet:getDbSheet()}; }
function sendTrackedEmail_(o){ __T__.sent.push(o); }
function sendDepositReminderEmail_(r){ __T__.reminded.push(r); }
function autoCancelBookingForMissingDeposit_(r){ __T__.cancelled.push(r); __T__.rows[r-1][BOOKING_COL['자동취소일시']]='x'; }
module.exports={__T__,setNow:(s)=>{ __NOW__=new __RealDate(s).getTime(); },CONFIG,BOOKING_COL,
  getDepositHold_,flagAndCancelOverdueDepositBookings_,depositHoldNoteHtml_,buildDepositHoldReleaseMail_,
  depositHoldForAgent_,customerVisibleMemo_,preserveAuditMemoLines_,DEPOSIT_ONSITE_EXCEPTION_MARKER,isDepositHeldFor_,depositPayByText_};`);
const E = (await import(pathToFileURL(file).href)).default;
rmSync(dir, { recursive: true, force: true });
const T = E.__T__;
const C = E.BOOKING_COL;

const HOLD = { deposit_hold_from: '2026-10-21', deposit_hold_until: '2026-11-21' };
const at = (s) => E.setNow(s);

/* ── 1) 창 판정 ───────────────────────────────────────────────────────────────── */
T.settings = {};
at('2026-10-25T08:00:00');
ok(!E.getDepositHold_().armed && !E.getDepositHold_().active, '설정 없음 = 꺼짐');
T.settings = { ...HOLD };
at('2026-10-20T23:59:00'); ok(!E.getDepositHold_().active && !E.getDepositHold_().started, 'from 전날 = 비활성');
at('2026-10-21T00:01:00'); ok(E.getDepositHold_().active, 'from 당일 = 활성');
at('2026-11-20T23:59:00'); ok(E.getDepositHold_().active && !E.getDepositHold_().releaseDue, 'until 전날 = 활성');
at('2026-11-21T08:00:00'); ok(!E.getDepositHold_().active && E.getDepositHold_().releaseDue, 'until 당일 = 해제');
// 촬영별 판정 — cutoff(창 3일 전) 전엔 보류 없음(계좌+당긴 기한), cutoff~창 전엔 휴직 뒤 촬영만, 창 안엔 전부, until 부터는 없음
const H = () => E.getDepositHold_();
at('2026-10-05T10:00:00');
ok(!E.isDepositHeldFor_(H(), '2026-12-05') && H().payByCap === '', '10/05 확정: 보류 없음 · 10일 기한(10/15)이 창 전이라 그대로', H().payByCap);
at('2026-10-10T10:00:00'); ok(H().payByCap === '', '10/10 확정: 10일 기한 = 10/20 → 당김 없음', H().payByCap);
at('2026-10-11T10:00:00'); ok(H().payByCap === '2026-10-20' && !E.isDepositHeldFor_(H(), '2026-12-05'), '10/11 확정: 기한 10/20 으로 당김·계좌는 준다', H().payByCap);
at('2026-10-17T10:00:00'); ok(!E.isDepositHeldFor_(H(), '2026-12-05') && H().payByCap === '2026-10-20', '10/17 확정: 기한 3일 — 아직 계좌');
at('2026-10-18T10:00:00');
ok(E.isDepositHeldFor_(H(), '2026-12-05') && !E.isDepositHeldFor_(H(), '2026-10-19'), '10/18(cutoff) 확정: 휴직 뒤 촬영만 보류, 휴직 전 촬영은 계좌');
ok(E.isDepositHeldFor_(H(), '2026-11-21') && !E.isDepositHeldFor_(H(), '2026-11-20'), 'cutoff 이후: 경계 = until 당일 촬영부터');
at('2026-10-21T10:00:00'); ok(H().payByCap === '', '창 안: 당김 없음(보류가 대신)', H().payByCap);
at('2026-10-25T10:00:00'); ok(E.isDepositHeldFor_(E.getDepositHold_(), '2026-10-30'), '창 안: 촬영일 무관 보류');
at('2026-11-21T08:00:00'); ok(!E.isDepositHeldFor_(E.getDepositHold_(), '2026-12-05'), 'until 부터: 보류 없음(확정 메일에 계좌)');
ok(!E.isDepositHeldFor_({ armed: false }, '2026-12-05') && !E.isDepositHeldFor_(null, '2026-12-05'), '설정 없음: 보류 없음');
T.settings = { deposit_hold_from: '2026-11-21', deposit_hold_until: '2026-10-21' };
ok(!E.getDepositHold_().armed, 'from ≥ until 이면 꺼짐');
T.settings = { deposit_hold_from: '21.10.2026', deposit_hold_until: '2026-11-21' };
ok(!E.getDepositHold_().armed, '형식이 틀리면 꺼짐');

/* ── 2)·3) L2 시나리오 ──────────────────────────────────────────────────────────── */
const W = E.CONFIG.BOOKING_HEADERS.length;
function mk(o) {
  const r = new Array(W).fill('');
  r[C['상태']] = o.status || '확정됨'; r[C['고객명']] = o.name; r[C['이메일']] = o.email ?? `${o.name}@x.de`;
  r[C['언어']] = o.lang || 'ko'; r[C['상품']] = '야외 스냅 Basic'; r[C['총결제액']] = 300; r[C['계약금']] = 50;
  r[C['예약일시']] = o.shoot || '2026-12-12 10:00'; r[C['확정일시']] = o.confirmed; r[C['계약금입금여부']] = o.paid || '';
  r[C['입금경고일시']] = o.warned || ''; r[C['요청사항']] = o.memo || ''; r[C['계약금수단']] = o.method || '';
  return r;
}
function reset() {
  T.settings = { ...HOLD }; T.sent = []; T.reminded = []; T.cancelled = [];
  T.rows = [E.CONFIG.BOOKING_HEADERS.slice(),
    mk({ name: 'PRE', confirmed: '2026-10-12 10:00' }),                               // 2 보류 전 확정·미입금(경고 전)
    mk({ name: 'WARNED', confirmed: '2026-10-10 10:00', warned: '2026-10-17 08:00' }), // 3 보류 전 이미 경고됨
    mk({ name: 'IN', confirmed: '2026-10-25 10:00', lang: 'de' }),                    // 4 보류 중 확정
    mk({ name: 'PAID', confirmed: '2026-10-26 10:00', paid: 'Y' }),                   // 5 창 안에 입금(평소 경로)
    mk({ name: 'ONSITE', confirmed: '2026-10-27 10:00', method: E.DEPOSIT_ONSITE_EXCEPTION_MARKER }), // 6 현장결제 예외
    mk({ name: 'PAST', confirmed: '2026-10-22 10:00', shoot: '2026-10-29 10:00' }),   // 7 촬영일 지남
    mk({ name: 'AFTER', confirmed: '2026-11-21 09:00' }),                              // 8 until 이후 확정(계좌 이미 받음)
    mk({ name: 'NOMAIL', confirmed: '2026-10-28 10:00', email: '수기' }),             // 9 이메일 없음
    mk({ name: 'EARLY', confirmed: '2026-10-12 10:00', shoot: '2026-10-20 10:00' }),  // 10 보류 전 확정·휴직 전 촬영(계좌 받음)
  ];
}
const row = (n) => T.rows.findIndex((r) => r[C['고객명']] === n) + 1;

reset();
T.settings = {};                              // 보류 설정 전 — 평소 동작
at('2026-10-19T11:00:00'); E.flagAndCancelOverdueDepositBookings_();
ok(T.reminded.includes(row('PRE')), '보류 전: 7일차 리마인더 정상', T.reminded);
ok(T.cancelled.includes(row('WARNED')) === false, '보류 전: WARNED 는 9일차 — 아직 취소 아님', T.cancelled);

reset();
at('2026-10-19T11:00:00'); E.flagAndCancelOverdueDepositBookings_();
ok(T.reminded.includes(row('EARLY')) && T.reminded.includes(row('PRE')), '창 전: 시계는 확정일 기준 — 휴직 뒤 촬영도 평소대로 리마인더(돈이 먼저)', T.reminded);
at('2026-10-20T11:00:00'); E.flagAndCancelOverdueDepositBookings_();
ok(T.cancelled.includes(row('WARNED')), '창 전: 10일차 자동취소도 평소대로', T.cancelled);
reset(); T.rows[row('WARNED') - 1][C['확정일시']] = '2026-10-11 10:00';
at('2026-10-21T11:00:00'); E.flagAndCancelOverdueDepositBookings_();
ok(!T.cancelled.includes(row('WARNED')), '창 전 확정이라도 10일째가 창 안이면 자동취소 멈춤(11/21 메일로 넘어감)', T.cancelled);

reset();
for (const d of ['2026-10-21', '2026-10-25', '2026-11-05', '2026-11-20']) { at(`${d}T08:00:00`); E.flagAndCancelOverdueDepositBookings_(); }
ok(!T.reminded.length && !T.cancelled.length && !T.sent.length, '보류 중: 리마인더·자동취소·메일 0', { r: T.reminded, c: T.cancelled, s: T.sent.length });

at('2026-11-21T08:00:00'); E.flagAndCancelOverdueDepositBookings_();
const sentTo = T.sent.map((m) => m.to).sort();
ok(JSON.stringify(sentTo) === JSON.stringify(['IN@x.de', 'PRE@x.de', 'WARNED@x.de']),
  'until 아침: 보류분(보류 전 미입금 포함)에만 계좌 메일 — 입금·예외·지난 촬영·until 이후·이메일없음 제외', sentTo);
ok(T.rows[row('IN') - 1][C['요청사항']].includes('[계약금안내 2026-11-21] 보류 해제 · 계좌 메일 발송(기한 2026-11-28)'), '행 감사줄 기록', T.rows[row('IN') - 1][C['요청사항']]);
ok(!T.reminded.length && !T.cancelled.length, '해제 당일: 시계가 until 부터라 자동취소 0', { r: T.reminded, c: T.cancelled });
const de = T.sent.find((m) => m.to === 'IN@x.de');
ok(de && de.subject.includes('Anzahlung') && de.htmlBody.includes('28.11.2026') && de.htmlBody.includes('IBAN'), 'DE 해제 메일: 기한·계좌', de && de.subject);

at('2026-11-22T08:00:00'); E.flagAndCancelOverdueDepositBookings_();
ok(T.sent.length === 3, '다음 날 재실행: 재발송 없음(감사줄 멱등)', T.sent.length);

at('2026-11-28T08:00:00'); E.flagAndCancelOverdueDepositBookings_();
ok(T.reminded.includes(row('PRE')) && T.reminded.includes(row('IN')) && !T.reminded.includes(row('WARNED')), '+7일: 미경고 보류분 리마인더', T.reminded);
ok(!T.cancelled.length, '+7일: 아직 취소 없음', T.cancelled);
ok(!T.reminded.includes(row('AFTER')), 'until 이후 확정분은 자기 확정일 시계(7일 = 11/28)… 09:00 확정이라 아직 6일', T.reminded);

at('2026-12-01T08:00:00'); E.flagAndCancelOverdueDepositBookings_();
ok(T.cancelled.includes(row('WARNED')) && T.cancelled.includes(row('PRE')) && T.cancelled.includes(row('IN')), '+10일: 미입금 보류분 자동취소', T.cancelled);
ok(!T.cancelled.includes(row('PAID')), '입금한 건은 끝까지 안전', T.cancelled);

/* ── 4) 문구 ───────────────────────────────────────────────────────────────────── */
const notes = { ko: E.depositHoldNoteHtml_('ko', '2026-11-21'), en: E.depositHoldNoteHtml_('en', '2026-11-21'), de: E.depositHoldNoteHtml_('de', '2026-11-21') };
ok(notes.ko.includes('11월 21일') && notes.en.includes('21 November 2026') && notes.de.includes('21.11.2026'), '대체 안내: 3개국어 날짜', notes);
ok(!Object.values(notes).some((h) => /IBAN|BIC|DE\d{2}/.test(h)), '대체 안내엔 계좌가 없다');
const cap = { ko: E.depositPayByText_('ko', '2026-10-20', true), en: E.depositPayByText_('en', '2026-10-20', true), de: E.depositPayByText_('de', '2026-10-20', false) };
ok(cap.ko.includes('10월 20일까지') && cap.en.includes('20 October 2026') && cap.de === 'Bitte überweisen Sie die Anzahlung bis zum 20.10.2026.', '당긴 기한 문구 3개국어', cap);
const koMail = E.buildDepositHoldReleaseMail_(mk({ name: '<b>김</b>', confirmed: '2026-10-25 10:00' }), 50, '2026-11-28');
ok(koMail.html.includes('11월 28일') && koMail.html.includes('€50.00') && koMail.html.includes('IBAN'), 'KO 해제 메일: 기한·금액·계좌');
ok(!koMail.html.includes('<b>김</b>'), '고객명은 이스케이프');
ok(E.customerVisibleMemo_('사진 밝게\n[계약금안내 2026-11-21] 보류 해제 · 계좌 메일 발송(기한 2026-11-28)') === '사진 밝게', '감사줄은 고객 표시에서 제거');
ok(E.preserveAuditMemoLines_('[계약금안내 2026-11-21] x', '새 메모').includes('[계약금안내 2026-11-21] x'), '감사줄은 메모 수정에도 보존(멱등 표식)');

/* ── 5) 에이전트 ──────────────────────────────────────────────────────────────── */
reset(); T.settings = {};
at('2026-10-01T10:00:00');
let r = E.depositHoldForAgent_('t', 'deposit-hold-set', { from: '2026-10-21', until: '2026-11-21' });
ok(r.dryRun === true && !T.settings.deposit_hold_from, 'set: dryRun 기본 — 쓰기 없음', r);
let threw = ''; try { E.depositHoldForAgent_('t', 'deposit-hold-set', { from: '2026-10-21', until: '2026-11-31', dryRun: false }); } catch (e) { threw = e.message; }
ok(/형식/.test(threw), 'set: 넘침 날짜 거부', threw);
threw = ''; try { E.depositHoldForAgent_('t', 'deposit-hold-set', { from: '2026-11-21', until: '2026-10-21', dryRun: false }); } catch (e) { threw = e.message; }
ok(/앞이어야/.test(threw), 'set: from ≥ until 거부', threw);
r = E.depositHoldForAgent_('t', 'deposit-hold-set', { from: '2026-10-21', until: '2026-11-21', dryRun: false });
ok(T.settings.deposit_hold_from === '2026-10-21' && T.settings.deposit_hold_until === '2026-11-21', 'set: 기록', T.settings);
at('2026-10-05T10:00:00');
r = E.depositHoldForAgent_('t', 'deposit-hold-status', {});
ok(r.held.map((h) => h.name).sort().join() === 'IN,NOMAIL,PRE,WARNED', 'status(창 전): 휴직 전 촬영(EARLY·PAST)은 보류분 아님', r.held.map((h) => h.name));
at('2026-10-30T10:00:00');
r = E.depositHoldForAgent_('t', 'deposit-hold-status', {});
ok(r.active && r.held.map((h) => h.name).sort().join() === 'IN,NOMAIL,PRE,WARNED', 'status: 보류분 목록', r.held && r.held.map((h) => h.name));
r = E.depositHoldForAgent_('t', 'deposit-hold-release', {});
ok(r.dryRun === true && T.sent.length === 0 && r.preview && r.preview.text.includes('IBAN'), 'release: confirm 없으면 dryRun + 미리보기', r.dryRun);
r = E.depositHoldForAgent_('t', 'deposit-hold-release', { confirm: 'SEND', dryRun: true });
ok(r.dryRun === true && T.sent.length === 0, 'release: confirm+dryRun:true 는 dryRun');
r = E.depositHoldForAgent_('t', 'deposit-hold-release', { confirm: 'SEND' });
ok(T.sent.length === 3 && r.skipped.length === 1 && r.skipped[0].name === 'NOMAIL', 'release: 발송 3 · 이메일없음 skip 1', { sent: T.sent.length, skipped: r.skipped });
ok(T.settings.deposit_hold_until === '2026-11-21', 'release 후에도 until 유지(시계 기준)', T.settings);
r = E.depositHoldForAgent_('t', 'deposit-hold-set', { from: '', until: '', dryRun: false });
ok(T.settings.deposit_hold_from === '' && T.settings.deposit_hold_until === '', 'set: 빈칸 = 끄기', T.settings);
for (const a of ['deposit-hold-status', 'deposit-hold-set', 'deposit-hold-release']) ok(src.includes(`action==='${a}'`), `디스패치 등록: ${a}`);

/* ── 6) 소스 배선 ─────────────────────────────────────────────────────────────── */
ok(/const depositBox=\(dep>0&&!hidePrice\)\?\(depositHeld\?depositHoldNoteHtml_\(/.test(src), 'sendConfirmEmail_: 보류 중 계좌 블록 대신 안내');
ok(src.includes('const depositHeld=isDepositHeldFor_(depositHold,formattedTime.slice(0,10));'), 'sendConfirmEmail_: 촬영일로 보류 판정');
ok(src.includes('depositAmount:(hidePrice||depositHeld)?0:dep'), '.ics: 보류 중 계좌 줄 제외');
ok(src.includes("const depositPayBy=(!depositHeld&&depositHold)?depositHold.payByCap:'';")
   && src.includes(':depositPayBy?_depositBankBlockHtml_(lang||\'ko\',depositPayByText_(lang||\'ko\',depositPayBy,true))'), '확정 메일: 창 전 확정은 계좌 + 당긴 기한');
ok(src.includes("depositDueText:depositPayBy?depositPayByText_(lang||'ko',depositPayBy,false):''") && src.includes('lines.push(info.depositDueText||labels.depositDue);'), '.ics: 당긴 기한 문구');
ok(src.includes("heldUntil:isDepositHeldFor_(depHold,d10)?depHold.until:''") && src.includes('보류(${esc(d.heldUntil'), "브리핑: '보류(MM/DD 안내)' — 촬영일 판정");
ok(/DATE_SETTING_KEYS=\[[^\]]*'deposit_hold_from','deposit_hold_until'/.test(src), '설정 날짜셀 정규화 키 등록');

if (SHOW) {
  const strip = (h) => h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{2,}/g, '\n').trim();
  for (const L of ['ko', 'en', 'de']) {
    console.log(`\n── 확정 메일 계좌 블록 대체 (${L}) ──\n${strip(notes[L])}`);
    console.log(`\n── 창 전 확정(10/11~) 계좌 블록 끝줄 (${L}) ──\n${E.depositPayByText_(L, '2026-10-20', false)}`);
    const m = E.buildDepositHoldReleaseMail_(mk({ name: L === 'de' ? 'Anna Schmidt' : '홍길동', lang: L, confirmed: '2026-10-25 10:00', shoot: '2026-12-12 10:00' }), 50, '2026-11-28');
    console.log(`\n── 11/21 해제 메일 (${L}) ── 제목: ${m.subject}\n${strip(m.html)}`);
  }
}

if (fail) { console.error(`❌ check-deposit-hold: ${fail}건 실패`); process.exit(1); }
console.log('✅ check-deposit-hold: 보류 창·L2 시계·해제 메일(멱등)·문구·에이전트·배선 통과');
