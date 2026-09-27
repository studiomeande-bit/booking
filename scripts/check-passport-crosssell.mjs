#!/usr/bin/env node
/**
 * check-passport-crosssell.mjs — 여권 손님 감사메일의 '다른 촬영 안내' 한 줄 검사기
 *
 * 왜 필요한가: 고객에게 **자동으로** 나가는 촬영 후 감사메일(sendPostShootFollowupEmails_)에
 *   여권 손님에게만 프로필·가족·아이 촬영 안내 한 줄을 붙였다(2026-09-27 사장님 승인 — 여권 30€ 고수 대신).
 *   잘못되면 여권이 아닌 손님에게도 붙거나, 언어가 섞이거나, 링크가 엉뚱한 곳으로 간다.
 *   라이브에서 보려면 실제 고객에게 메일이 나가야 하므로, 진짜 발송 함수를 가짜 시트 위에서 돌리고
 *   메일은 가로챈다(check-pickup-dayprior-reminder 와 같은 방식).
 *
 * 사용법:  node scripts/check-passport-crosssell.mjs       (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');

function fmt(d, tz, pattern) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/Berlin', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return pattern.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day)
    .replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
}
const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁 — 이 경로는 닿으면 안 된다`); } });
Object.assign(globalThis, {
  Utilities: { formatDate: (d, tz, p) => fmt(new Date(d), tz, p) },
  MailApp: { getRemainingDailyQuota: () => 100, sendEmail: () => { throw new Error('MailApp.sendEmail 직접 호출 — 가로채기 실패'); } },
  GmailApp: nope('GmailApp'), SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'),
  CalendarApp: nope('CalendarApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});

const dir = mkdtempSync(join(tmpdir(), 'passxsell-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${src}
var __BOOK__=null, __SENT__=[];
function ensureSheets_(){ return { ss:{}, bookingSheet:__BOOK__ }; }
function getSettingsMap_(){ return {}; }
function sendTrackedEmail_(msg){ __SENT__.push(msg); return true; }
function __set__(book){ __BOOK__=book; __SENT__=[]; }
function __sent__(){ return __SENT__; }
module.exports={sendPostShootFollowupEmails_,CONFIG,BOOKING_COL,__set__,__sent__};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

const C = M.BOOKING_COL;
const yesterday = fmt(new Date(Date.now() - 86400000), 'Europe/Berlin', 'yyyy-MM-dd') + ' 10:00';
function row(o) {
  const r = new Array(M.CONFIG.BOOKING_HEADERS.length).fill('');
  r[C['예약일시']] = yesterday; r[C['상태']] = '작업완료'; r[C['고객명']] = o.name;
  r[C['이메일']] = `${o.name}@example.com`; r[C['언어']] = o.lang || 'ko';
  r[C['촬영종류']] = o.group ?? 'pass'; r[C['상품']] = o.product ?? '여권/비자 사진';
  if (o.corp) { r[C['사업자송장필요']] = 'Y'; r[C['사업자명']] = 'Kia Europe GmbH'; }
  return r;
}
function sheet(rows) {
  const data = [M.CONFIG.BOOKING_HEADERS.slice(), ...rows];
  return { getLastRow: () => data.length, getDataRange: () => ({ getValues: () => data }),
    getRange: (r, c) => ({ setValue: (v) => { data[r - 1][c - 1] = v; } }) };
}

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fail++; };

M.__set__(sheet([
  row({ name: 'passko' }),
  row({ name: 'passen', lang: 'en' }),
  row({ name: 'passde', lang: 'de' }),
  row({ name: 'passodd', lang: 'kr' }),                        // 알 수 없는 언어 → 한국어 본문(기존 폴백)
  row({ name: 'byproduct', group: '', product: 'E-Passbild' }), // 촬영종류가 비어도 상품명으로 여권 판정
  row({ name: 'studio', group: 'stud', product: '스튜디오 Basic' }),
  row({ name: 'profile', group: 'prof', product: '프로필 Basic', lang: 'de' }),
  row({ name: 'corp', corp: true }),                            // 법인 여권은 감사메일 자체가 없다(기존 규칙)
]));
M.sendPostShootFollowupEmails_();
const sent = Object.fromEntries(M.__sent__().map((m) => [m.to.split('@')[0], m.htmlBody]));
const LINK = 'utm_campaign=passport_crosssell';

ok(sent.passko?.includes('프로필 · 가족 · 아이 촬영') && sent.passko.includes('/?lang=ko&') && sent.passko.includes(LINK),
  '여권 KO: 안내 한 줄 + lang=ko 링크');
ok(sent.passen?.includes("portrait, family and children's sessions") && sent.passen.includes('/?lang=en&'), '여권 EN: 영어 문장 + lang=en');
ok(sent.passde?.includes('Familien- und Kindershootings') && sent.passde.includes('/?lang=de&'), '여권 DE: 독일어 문장 + lang=de');
ok(sent.passodd?.includes('프로필 · 가족 · 아이 촬영') && !sent.passodd.includes('Besides passport'), '알 수 없는 언어: 한국어 본문에 한국어 한 줄만');
ok(sent.byproduct?.includes(LINK), '촬영종류 공란이어도 상품명(E-Passbild)으로 여권 판정');
ok(sent.studio && !sent.studio.includes(LINK), '스튜디오 손님: 안내 없음');
ok(sent.profile && !sent.profile.includes(LINK), '프로필 손님: 안내 없음');
ok(!('corp' in sent), '법인 여권: 감사메일 자체가 없음(기존 규칙 유지)');
ok(sent.passko?.indexOf(LINK) < sent.passko?.indexOf('구글 리뷰'), '안내 줄은 리뷰 부탁 앞에 온다');
ok(M.__sent__().every((m) => (m.htmlBody.match(new RegExp(LINK, 'g')) || []).length <= 1), '한 메일에 안내는 한 번만');

if (fail) { console.error(`\n✗ ${fail}건 실패`); process.exit(1); }
console.log('\n✓ 여권 교차판매 한 줄 — 전부 통과');
