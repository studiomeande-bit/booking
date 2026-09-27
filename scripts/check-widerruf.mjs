#!/usr/bin/env node
/**
 * check-widerruf.mjs — 소비자 철회(Widerruf) 검증기 (docs/widerruf-function-plan.md)
 *
 * ① 정본 문구 두 벌 — appscript/Code.gs 의 WIDERRUF_TEXT_ 와 frontend/booking/widerruf/widerruf-text.js —
 *    이 한 글자라도 다르면 실패. 한쪽만 고치면 예약 화면과 확정 메일이 다른 법정 문구를 싣게 된다.
 * ② 독일어가 공식 서식(Anlage 1·2 EGBGB, 2026-09-18 gesetze-im-internet.de) 문장을 그대로 담는지.
 * ③ Code.gs 를 GAS 스텁과 함께 통째로 로드해 실제 함수를 돌린다(재구현 아님):
 *    조기 이행 창 · 확정 메일 블록 · 환불 상자 한 줄 · 온라인 철회 접수(검증·예약 매칭·수신확인 내용·중복).
 *
 * 사용법:  node scripts/check-widerruf.mjs        (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, createHmac } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gsSrc = readFileSync(join(ROOT, 'appscript/Code.gs'), 'utf8');
const feSrc = readFileSync(join(ROOT, 'frontend/booking/widerruf/widerruf-text.js'), 'utf8');

let fails = 0;
const check = (label, cond, detail) => {
  if (!cond) { fails += 1; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`); } else console.log(`  ✅ ${label}`);
};

/* ── ① 두 벌 대조 ── */
console.log('── 정본 두 벌 (Code.gs ↔ widerruf-text.js) ──');
const literal = (src, where) => {
  const m = src.match(/\/\* WIDERRUF_TEXT:BEGIN \*\/([\s\S]*?)\/\* WIDERRUF_TEXT:END \*\//);
  if (!m) throw new Error(`${where}: WIDERRUF_TEXT:BEGIN/END 표시를 찾지 못했습니다.`);
  return m[1].trim();
};
const gsLit = literal(gsSrc, 'Code.gs');
const feLit = literal(feSrc, 'widerruf-text.js');
const firstDiff = (a, b) => {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  return i >= Math.max(a.length, b.length) ? '' : `${i}번째 글자부터 다름: Code.gs "${a.slice(i, i + 40)}" / 프런트 "${b.slice(i, i + 40)}"`;
};
check('한 글자도 다르지 않다', gsLit === feLit, firstDiff(gsLit, feLit));
const W = JSON.parse(gsLit); // JSON 이라야 두 런타임이 같은 값을 읽는다

/* ── ② 공식 서식 문장 ── */
console.log('\n── 독일어 = 공식 서식 원문 ──');
const deText = W.de.sections.flatMap((s) => s.ps).join('\n');
const OFFICIAL = [
  ['Widerrufsrecht 첫 문장', 'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.'],
  ['기간 기산 = 계약 체결일 (Gestaltungshinweis 1a)', 'Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.'],
  ['의사표시 방법 (현행 "oder eine E-Mail")', 'mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.'],
  ['온라인 철회 기능 (Gestaltungshinweis 3, 2026-06-19~)', `Sie können Ihr Widerrufsrecht auch online unter ${W.url} ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.`],
  ['기간 준수', 'Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.'],
  ['반환', 'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.'],
  ['Wertersatz (Gestaltungshinweis 6 — 없으면 § 357a Abs. 2 대가 0)', 'Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.'],
];
OFFICIAL.forEach(([label, s]) => check(label, deText.includes(s)));
check('연락처(이름·주소·전화·이메일)', deText.includes('Studio mean, Inhaber Taewoong Min, Holzweg-Passage 3, 61440 Oberursel, Telefon: +49 176 6093 9400, E-Mail: studio.mean.de@gmail.com'));
check('서식(Anlage 2) 줄 그대로', JSON.stringify(W.de.form.slice(1)) === JSON.stringify([
  '– Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)',
  '– Bestellt am (*)/erhalten am (*)', '– Name des/der Verbraucher(s)', '– Anschrift des/der Verbraucher(s)',
  '– Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)', '– Datum', '(*) Unzutreffendes streichen.']));
check('ko/en 번역이 같은 구조(단락 수)', ['ko', 'en'].every((l) => JSON.stringify(W[l].sections.map((s) => s.ps.length)) === JSON.stringify(W.de.sections.map((s) => s.ps.length))));
check('세 언어 모두 버튼 문구에 법문 표현 포함', ['de', 'ko', 'en'].every((l) => W[l].withdrawLabel.includes('Vertrag widerrufen') && W[l].confirmLabel.includes('Widerruf bestätigen')));
check('주문·예약 버튼 = § 312j Abs. 3 문구(독일어 법문 · 지침 영어판)', W.de.orderButton === 'Zahlungspflichtig bestellen' && W.de.bookButton === 'Zahlungspflichtig buchen'
  && W.en.orderButton === 'Order with obligation to pay' && W.en.bookButton === 'Book with obligation to pay' && !!W.ko.orderButton && !!W.ko.bookButton);
check('셀렉 문구 세 언어 모두 있음(보정용 조기 이행·인화 철회권 없음·부가세·철회 페이지 계약명)', ['de', 'ko', 'en'].every((l) => ['earlyStartRetouch', 'printNoWiderruf', 'vatIncluded', 'selectContract'].every((k) => String(W[l][k] || '').length > 3)));
check('인화 고지는 § 312g Abs. 2 Nr. 1 근거', W.de.printNoWiderruf.includes('§ 312g Abs. 2 Nr. 1 BGB') && W.en.printNoWiderruf.includes('312g(2) no. 1') && W.ko.printNoWiderruf.includes('제312g조'));
check('보정용 조기 이행 문장 = 요청 + 대가 + 완전 이행 시 소멸', W.de.earlyStartRetouch.includes('ausdrücklich') && W.de.earlyStartRetouch.includes('angemessenen Betrag') && W.de.earlyStartRetouch.includes('vollständiger Vertragserfüllung'));

/* ── ③ Code.gs 로드 (GAS 스텁) ── */
const pad = (n) => String(n).padStart(2, '0');
const partsIn = (d, tz) => {
  const o = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map((p) => [p.type, p.value]));
  return { yyyy: o.year, yy: o.year.slice(2), MM: o.month, dd: o.day, HH: o.hour, mm: o.minute, ss: o.second };
};
const toBytes = (buf) => [...buf].map((b) => (b > 127 ? b - 256 : b));
globalThis.Utilities = {
  formatDate: (d, tz, fmt) => { const p = partsIn(d instanceof Date ? d : new Date(d), tz); return fmt.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, (t) => p[t]); },
  DigestAlgorithm: { MD5: 'md5', SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
  computeDigest: (alg, raw) => toBytes(createHash(alg).update(String(raw), 'utf8').digest()),
  computeHmacSha256Signature: (v, key) => toBytes(createHmac('sha256', String(key)).update(String(v), 'utf8').digest()),
  base64EncodeWebSafe: (bytes) => Buffer.from(bytes.map((b) => b & 0xff)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
};
const nope = (name) => new Proxy({}, { get: () => () => { throw new Error(`${name} stub`); } });
const cacheMap = new Map();
const sent = [];
globalThis.CacheService = { getScriptCache: () => ({ get: (k) => cacheMap.get(k) ?? null, put: (k, v) => cacheMap.set(k, v), remove: (k) => cacheMap.delete(k) }) };
globalThis.LockService = { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) };
globalThis.MailApp = { sendEmail: (o) => sent.push(o) };
globalThis.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => (k === 'ACTION_SECRET' ? 'check-secret' : null), setProperty() {} }) };
globalThis.ScriptApp = { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/STUB/exec' }) };
globalThis.Session = { getScriptTimeZone: () => 'Europe/Berlin', getActiveUser: () => ({ getEmail: () => 'stub@example.com' }) };
globalThis.Logger = { log() {} };
for (const n of ['DriveApp', 'SpreadsheetApp', 'CalendarApp', 'GmailApp', 'UrlFetchApp', 'HtmlService', 'ContentService']) globalThis[n] = nope(n);

const EXPORTS = ['CONFIG', 'WIDERRUF_TEXT_', 'EMAIL_I18N', 'submitBookingWithdrawal_', 'buildWiderrufMailHtml_', 'buildPassReservationNoteHtml_',
  'withWiderrufStornoNote_', 'bookingNeedsEarlyStart_', 'bookingNeedsWiderrufNotice_', 'getWiderrufMailContext_', 'createBookingRowActionRef_',
  'buildSelectLegalPayload_', 'buildSelectExtraLegalHtml_', 'buildSelectWithdrawUrl_', 'selectEarlyStartAlertRow_', 'recordSelectEarlyStart_',
  'SELECT_HEADERS', 'SELECT_SHEET_NAME'];
const dir = mkdtempSync(join(tmpdir(), 'smwiderruf-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${gsSrc}
getDbSheet=function(){return globalThis.__sheet;};
ensureSheets_=function(){return {bookingSheet:globalThis.__sheet,messageLogSheet:globalThis.__log};};
ensureSelectSheet_=function(){return globalThis.__select;};
module.exports={${EXPORTS.join(',')}};\n`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

check('서버 WIDERRUF_TEXT_ 가 대조한 리터럴과 같은 값', JSON.stringify(M.WIDERRUF_TEXT_) === JSON.stringify(W));

/* 가짜 예약장부 — 머리행 + 행 객체({열이름: 값}) */
const H = M.CONFIG.BOOKING_HEADERS;
const makeSheet = (rows) => {
  const data = [H.slice(), ...rows.map((o) => H.map((h) => (o[h] ?? '')))];
  return {
    data,
    getDataRange: () => ({ getValues: () => data.map((r) => r.slice()) }),
    getRange: (r, c) => ({ getValue: () => data[r - 1][c - 1], setValue: (v) => { data[r - 1][c - 1] = v; } }),
    getLastRow: () => data.length,
  };
};
const col = (sheet, rowIndex, name) => sheet.data[rowIndex - 1][H.indexOf(name)];
const base = { 연락처: '+491701234567', 동의시각: '2026-09-18 10:00:00', accepted_at: '2026-09-18 10:00:00', 상태: '확정됨', 촬영종류: 'stud', 상품: '스튜디오 Basic', 예약일시: '2026-10-10 11:00', 총결제액: 170, 계약금: 50, 계약금입금여부: 'Y', 계약금입금금액: 50 };
const rows = [
  { ...base, 고객명: 'Anna Beispiel', 이메일: 'anna@example.com', 캘린더ID: 'ev-anna', 확정일시: '2026-09-18 11:00:00', early_start_requested: 'Y' }, // 행 2
  { ...base, 고객명: 'Dup One', 이메일: 'dup@example.com', 캘린더ID: 'ev-dup1' },                                                         // 행 3
  { ...base, 고객명: 'Dup Two', 이메일: 'dup@example.com', 캘린더ID: 'ev-dup2' },                                                         // 행 4
  { ...base, 고객명: 'Gone', 이메일: 'gone@example.com', 캘린더ID: 'ev-gone', 상태: '취소됨' },                                           // 행 5
  { ...base, 고객명: 'Old Kunde', 이메일: 'old@example.com', 캘린더ID: 'ev-old', 확정일시: '2026-08-01 09:00:00' },                        // 행 6
];
globalThis.__sheet = makeSheet(rows);
globalThis.__log = { rows: [], appendRow(r) { this.rows.push(r); } };
const S = globalThis.__sheet;

/* 조기 이행 창 */
console.log('\n── 조기 이행 요청 창 (21일) ──');
const ymd = (n) => M_ymd(n);
function M_ymd(n) { return Utilities.formatDate(new Date(Date.now() + n * 86400000), 'Europe/Berlin', 'yyyy-MM-dd'); }
check('촬영 21일 뒤 → 요청 필요', M.bookingNeedsEarlyStart_('stud', ymd(21)));
check('촬영 22일 뒤 → 불필요', !M.bookingNeedsEarlyStart_('stud', ymd(22)));
check('당일 촬영 → 요청 필요', M.bookingNeedsEarlyStart_('prof', ymd(0)));
check('여권은 무구속 예약 → 불필요', !M.bookingNeedsEarlyStart_('pass', ymd(1)) && !M.bookingNeedsWiderrufNotice_('pass'));
check('마이리얼트립은 그쪽 계약 → 안내 없음', !M.bookingNeedsWiderrufNotice_('마이리얼트립'));
check('날짜 없음 → 불필요', !M.bookingNeedsEarlyStart_('stud', ''));

/* 확정 메일 블록 */
console.log('\n── 확정 메일 철회 안내 ──');
const ctx = M.getWiderrufMailContext_('ev-anna');
check('포털 서명 ref 가 붙은 철회 링크', ctx.withdrawUrl === `${W.url}?ref=${encodeURIComponent(M.createBookingRowActionRef_(2, S.data[1]))}`, ctx.withdrawUrl);
check('조기 이행 요청·시각을 행에서 읽는다', ctx.earlyStartRequested === true && ctx.acceptedAt === '2026-09-18 10:00', JSON.stringify(ctx));
const koMail = M.buildWiderrufMailHtml_('ko', ctx);
check('ko: 번역 + 원문(정본) + 서식 + 링크', koMail.includes(W.ko.bindingNote) && koMail.includes('Widerrufsbelehrung') && koMail.includes('Folgen des Widerrufs') && koMail.includes('철회의 효과')
  && koMail.includes('Unzutreffendes streichen') && koMail.includes(ctx.withdrawUrl.replace(/&/g, '&amp;')));
check('ko: 조기 이행 요청 문장 인용(증빙)', koMail.includes('명시적으로 요청하셨습니다') && koMail.includes('2026-09-18 10:00'));
const deMail = M.buildWiderrufMailHtml_('de', { withdrawUrl: W.url });
check('de: 번역 없음, 요청 없으면 인용 없음', !deMail.includes(W.ko.bindingNote) && !deMail.includes('ausdrücklich erklärt') && deMail.includes('Vertrag widerrufen'));
check('여권 고지: 번역 + 독일어', M.buildPassReservationNoteHtml_('en').includes(W.en.passNote) && M.buildPassReservationNoteHtml_('en').includes(W.de.passNote));
const boxed = M.withWiderrufStornoNote_(M.EMAIL_I18N.de.refund_policy, 'de');
check('환불 상자: 철회권 한 줄이 상자 안 <span> 으로(계약서 § 10 은 span 을 걷어내 인용 불변)', /<span[^>]*>[^<]*gesetzliche Widerrufsrecht[^<]*<\/span><\/div>$/.test(boxed));
check('빈 상자는 그대로', M.withWiderrufStornoNote_('', 'ko') === '');

/* 온라인 철회 접수 */
console.log('\n── 온라인 철회 접수 (§ 356a) ──');
const rejects = (payload, code) => { try { M.submitBookingWithdrawal_(payload); return false; } catch (e) { return e.message === code; } };
check('이름 없음 → NAME_REQUIRED', rejects({ name: ' ', contract: 'x', email: 'a@b.de' }, 'NAME_REQUIRED'));
check('계약 식별 없음 → CONTRACT_REQUIRED', rejects({ name: 'Anna', contract: '', email: 'a@b.de' }, 'CONTRACT_REQUIRED'));
check('이메일 형식 → EMAIL_INVALID', rejects({ name: 'Anna', contract: 'x', email: 'kein-mail' }, 'EMAIL_INVALID'));
check('허니팟 → SPAM', rejects({ name: 'Anna', contract: 'x', email: 'a@b.de', website: 'http://spam' }, 'SPAM'));
check('거절 건은 메일을 보내지 않는다', sent.length === 0);

const adminMail = () => sent.find((m) => String(m.subject || '').startsWith('[철회 접수'));
const receiptMail = () => sent.find((m) => !String(m.subject || '').startsWith('[철회 접수'));

const ref = M.createBookingRowActionRef_(2, S.data[1]);
const r1 = M.submitBookingWithdrawal_({ name: 'Anna Beispiel', contract: 'Studio Basic, 10.10.2026 11:00', email: 'Anna@Example.com', ref, lang: 'ko' });
const [receipt, admin] = sent;
check('접수 결과: ok + 접수 시각 + 수신확인 발송', r1.ok && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r1.receivedAt) && r1.receiptSent === true, JSON.stringify(r1));
check('응답에 예약 매칭 여부를 싣지 않는다(이메일로 예약 존재 탐색 방지)', !('matched' in r1));
check('수신확인은 입력한 이메일로', receipt && receipt.to === 'anna@example.com');
check('수신확인 = 의사표시 내용 + 날짜·시각(§ 356a Abs. 4), ko + 독일어', receipt.htmlBody.includes(W.ko.statement) && receipt.htmlBody.includes(W.de.statement)
  && receipt.htmlBody.includes('Studio Basic, 10.10.2026 11:00') && receipt.htmlBody.includes(r1.receivedAt) && receipt.htmlBody.includes('Eingegangen am'));
check('수신확인에 장부 값(상품·촬영일)이 새지 않는다', !receipt.htmlBody.includes('스튜디오 Basic') && !receipt.htmlBody.includes('2026-10-10'));
check('관리자: 연결 예약·받은 금액·원클릭 취소', admin && admin.to === M.CONFIG.ADMIN_EMAIL && admin.htmlBody.includes('행 2') && admin.htmlBody.includes('포털 서명 링크')
  && admin.htmlBody.includes('€ 50') && admin.htmlBody.includes('예약 바로 취소') && admin.htmlBody.includes('action=cancel'));
const due = Utilities.formatDate(new Date(Date.parse(`${r1.receivedAt.slice(0, 10)}T12:00:00Z`) + 14 * 86400000), 'UTC', 'yyyy-MM-dd');
check(`관리자: 환불 기한 = 접수 + 14일 (${due})`, admin.htmlBody.includes(`${due}까지`));
check('관리자: 안내 후 확정 → 기한 확정일+14일 판정', admin.htmlBody.includes('철회기한 2026-10-02') && admin.htmlBody.includes('있음 — 철회 전 촬영분'));
check('예약 메모에 한 줄', String(col(S, 2, '요청사항')).includes('법정 철회 접수(온라인 철회 버튼)'));
check('메시지로그 유형 철회 + 원문', globalThis.__log.rows.some((r) => r[3] === '철회' && r[1] === 'booking-page' && String(r[12]).includes(W.de.statement)));
check('상태는 건드리지 않는다(자동 취소 없음)', col(S, 2, '상태') === '확정됨');

const before = sent.length;
const r2 = M.submitBookingWithdrawal_({ name: 'Anna Beispiel', contract: 'Studio Basic, 10.10.2026 11:00', email: 'anna@example.com', ref, lang: 'ko' });
check('같은 내용 재전송 → 첫 접수 반환, 메일 재발송 없음', r2.duplicate === true && r2.receivedAt === r1.receivedAt && sent.length === before);

sent.length = 0;
M.submitBookingWithdrawal_({ name: 'Old Kunde', contract: 'Familie', email: 'old@example.com', lang: 'de' });
check('ref 없음 + 같은 이메일 1건 → 자동 연결', adminMail().htmlBody.includes('행 6') && sent[1].htmlBody.includes('같은 이메일 예약 1건'));
check('안내 도입 전 확정 → 12개월+14일 경고', adminMail().htmlBody.includes('12개월+14일'));
check('de: 수신확인은 독일어 한 벌만', receiptMail().subject === '[Studio mean] Eingangsbestätigung Ihres Widerrufs' && !receiptMail().htmlBody.includes('의사표시'));

sent.length = 0;
M.submitBookingWithdrawal_({ name: 'Dup', contract: 'irgendwas', email: 'dup@example.com', lang: 'en' });
check('같은 이메일 2건 → 자동 연결 안 함, 후보 행 안내', adminMail().htmlBody.includes('후보 행: 3, 4') && !String(col(S, 3, '요청사항')).includes('철회') && !adminMail().htmlBody.includes('예약 바로 취소'));
// 감사 2026-09-20 — 이메일만 아는 제3자가 남의 예약에 수신확인을 띄우지 못한다
check('자동 연결 실패 → 고객 수신확인 미발송 + 사장님 메일에 그 사실 표기',
  sent.length === 1 && !receiptMail() && adminMail().htmlBody.includes('미발송'));

sent.length = 0;
M.submitBookingWithdrawal_({ name: 'Gone', contract: 'x', email: 'gone@example.com', lang: 'en' });
check('취소된 예약은 연결하지 않는다', adminMail().htmlBody.includes('같은 이메일 예약 없음'));

sent.length = 0;
M.submitBookingWithdrawal_({ name: 'Mallory', contract: 'x', email: 'mallory@example.com', ref: 'row:2:forgedtoken123', lang: 'en' });
check('위조 ref 는 매칭되지 않는다', adminMail().htmlBody.includes('자동 연결 못 함'));

/* ── 셀렉 유료 추가 주문 (docs/select-widerruf-plan.md) ── */
console.log('\n── 셀렉 유료 추가 주문 ──');
const LP = M.buildSelectLegalPayload_();
check('세션 응답 legal = 서버 정본 부분집합(세 언어)', ['ko', 'en', 'de'].every((l) => LP[l].earlyStartRetouch === W[l].earlyStartRetouch && LP[l].orderButton === W[l].orderButton
  && LP[l].printNoWiderruf === W[l].printNoWiderruf && LP[l].vatIncluded === W[l].vatIncluded) && LP.url === W.url);
const wUrl = M.buildSelectWithdrawUrl_(2, S.data[1]);
check('셀렉 철회 링크 = 서명 ref + what=select / 예약행 없으면 what=select 만', wUrl.startsWith(`${W.url}?ref=`) && wUrl.endsWith('&what=select') && M.buildSelectWithdrawUrl_(0, null) === `${W.url}?what=select`);
const legalBoth = M.buildSelectExtraLegalHtml_('ko', { paidRetouch: true, paidPrints: true, earlyStartAt: '2026-09-18 10:00 | WB-2026-09', withdrawUrl: wUrl });
check('접수 메일: 유료 보정 → 확정 문장 + 철회 안내 + 보정용 요청 인용 + 셀렉 철회 링크', legalBoth.includes('추가 주문') && legalBoth.includes('Widerrufsbelehrung')
  && legalBoth.includes(W.ko.earlyStartRetouch) && legalBoth.includes('주문하실 때') && legalBoth.includes(wUrl.replace(/&/g, '&amp;')));
check('접수 메일: 유료 인화 → 철회권 없음(번역 + 독일어)', legalBoth.includes(W.ko.printNoWiderruf) && legalBoth.includes(W.de.printNoWiderruf));
const legalPrints = M.buildSelectExtraLegalHtml_('de', { paidRetouch: false, paidPrints: true, withdrawUrl: wUrl });
check('인화만 → 철회 안내 전문 없음, 인화 고지만', legalPrints.includes(W.de.printNoWiderruf) && !legalPrints.includes('Folgen des Widerrufs') && !legalPrints.includes(wUrl));
check('0원 → 안내 없음', M.buildSelectExtraLegalHtml_('ko', { paidRetouch: false, paidPrints: false }) === '');
const tdS = (l, v) => `<tr><td>${l}</td><td>${v}</td></tr>`;
check('관리자 알림 철회권 줄: 유료 보정 없으면 없음 · 요청 ✔ · 없음 ⚠', M.selectEarlyStartAlertRow_(tdS, 0, '') === ''
  && M.selectEarlyStartAlertRow_(tdS, 2, '2026-09-18 10:00 | WB-2026-09').includes('✔') && M.selectEarlyStartAlertRow_(tdS, 2, '').includes('⚠'));

/* 가짜 셀렉 시트 — 예약행 2 에 연결된 제출 세션 */
const SH = M.SELECT_HEADERS;
const selData = [SH.slice(), SH.map((h) => ({ 세션ID: 'sessTEST1', 예약장부행: 2, 제출일시: '2026-09-18 10:00', 상태: '작업대기', 셀렉마감일: '2026-12-01', 페이지버전: 'v2' }[h] ?? ''))];
globalThis.__select = {
  data: selData,
  getLastRow: () => selData.length,
  getLastColumn: () => SH.length,
  getRange: (r, c, nr, nc) => (nr ? { getValues: () => selData.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)) }
    : { getValue: () => selData[r - 1][c - 1], setValue: (v) => { selData[r - 1][c - 1] = v; } }),
};
S.getParent = () => ({ getSheetByName: (n) => (n === M.SELECT_SHEET_NAME ? globalThis.__select : null) });
const colEarly = SH.indexOf('추가보정조기이행요청');
/* 의도는 "끝에 붙였다 = 기존 열 위치가 안 바뀐다" 이다(열은 인덱스로 읽는다 — 가운데 끼우면 기존 데이터가 한 칸씩 밀린다).
   예전엔 '맨 끝인가' 로 적어, 뒤에 새 열이 붙을 때마다(2026-09-26 픽업전날알림) 거짓으로 빨개졌다. 도입 때 인덱스를 고정한다. */
check('셀렉 시트 조기이행 열 위치 고정(59번째, 인덱스 58) — 앞에 열이 끼어들지 않았다', colEarly === 58);
check('유료 보정 + 체크 → 시각·문구 버전 기록', M.recordSelectEarlyStart_(null, globalThis.__select, 2, { earlyStartRetouch: true }, 2, '2026-09-18 10:00') === '2026-09-18 10:00 | WB-2026-09'
  && selData[1][colEarly] === '2026-09-18 10:00 | WB-2026-09');
check('유료 보정 없음(수정으로 빠짐) → 지운다', M.recordSelectEarlyStart_(null, globalThis.__select, 2, { earlyStartRetouch: true }, 0, '2026-09-18 11:00') === '' && selData[1][colEarly] === '');
check('체크 안 함 → 비움', M.recordSelectEarlyStart_(null, globalThis.__select, 2, {}, 3, '2026-09-18 12:00') === '');

sent.length = 0;
const refS = M.createBookingRowActionRef_(2, S.data[1]);
M.submitBookingWithdrawal_({ name: 'Anna Beispiel', contract: '셀렉 추가 주문(추가 보정·인화) — 스튜디오 Basic · 2026-10-10', email: 'anna@example.com', ref: refS, what: 'select', lang: 'ko' });
const adminSel = adminMail();
check('셀렉 철회 알림: 제목·대상 줄·품목별 안내', adminSel.subject.includes('셀렉 추가 주문') && adminSel.htmlBody.includes('<b>셀렉 추가 주문</b>') && adminSel.htmlBody.includes('select-clear-extras'));
check('셀렉 철회기간 = 셀렉 제출일 기준(예약 확정일 아님)', adminSel.htmlBody.includes('셀렉 제출 2026-09-18 10:00 → 철회기한 2026-10-02') && !adminSel.htmlBody.includes('확정 2026-09-18 11:00'));
check('셀렉 철회엔 예약 취소 버튼을 주지 않는다', !adminSel.htmlBody.includes('예약 바로 취소') && !adminSel.htmlBody.includes('action=cancel'));
check('셀렉 철회 메모 표기', String(col(S, 2, '요청사항')).includes('법정 철회 접수(셀렉 추가 주문'));

console.log(fails ? `\n❌ ${fails}건 실패` : '\n✅ 전부 통과');
process.exit(fails ? 1 : 0);
