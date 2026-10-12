#!/usr/bin/env node
/**
 * check-site-events.mjs — 사이트 집계(예약 퍼널 · 협력업체 노출) 검사기
 *
 * 왜 필요한가: `api=site-event` 는 로그인 없이 누구나 부를 수 있는 **공개 쓰기**다. 형식 검증이 풀리면
 *   고객 DB 스프레드시트에 임의 문자열이 쌓이고, 점검 출처가 통계에 섞이면 사장님이 보는 전환율이 틀어진다.
 *   메일 쪽은 블록이 **실제로 실리는** 경로에서만 노출을 세야 한다(접수 메일은 블록을 만들고도 안 싣는다).
 *
 * 사용법:  node scripts/check-site-events.mjs       (불일치 시 exit 1)
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
const cache = new Map();
Object.assign(globalThis, {
  Utilities: { formatDate: (d, tz, p) => fmt(new Date(d), tz, p) },
  MailApp: nope('MailApp'), GmailApp: nope('GmailApp'), SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'),
  CalendarApp: nope('CalendarApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType: () => JSON.parse(s) }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});

const dir = mkdtempSync(join(tmpdir(), 'siteevt-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${src}
var __SHEETS__={};
var __PARTNERS__=[
  {id:'cozyjoo',name:'cozyjoo',groups:['wed','prof'],placements:['success','mail'],links:[{slot:'chat',kind:'kakao',url:'https://example.com/c'}]},
  {id:'laonblumen',name:'라온 블루멘',groups:['wed'],placements:['success','mail'],links:[{slot:'insta',kind:'instagram',url:'https://example.com/l'}]}
];
function ensureSheets_(){ return { ss:{} }; }
function ensureHeaderSheet_(ss,name,headers){
  var d=__SHEETS__[name]=__SHEETS__[name]||[headers.slice()];
  return { appendRow:function(r){d.push(r);}, getLastRow:function(){return d.length;},
    getRange:function(r,c,n,w){return {getValues:function(){return d.slice(r-1,r-1+n).map(function(x){return x.slice(0,w);});}};} };
}
function getPartners_(){ return __PARTNERS__; }
function __rows__(){ return (__SHEETS__[CONFIG.SITE_EVENT_SHEET]||[[]]).slice(1); }
function __reset__(){ __SHEETS__={}; }
module.exports={recordSiteEvent_,readSiteEvents_,buildSiteFunnelStats_,partnerMailBlockLogged_,buildPartnerMailBlockHtml_,
  partnerContextFrom_,handlePublicApiRequest_,__rows__,__reset__};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fail++; };
const hit = (parameter) => M.handlePublicApiRequest_('site-event', 'get', { parameter });

// 1) 기록 함수 — 허용 목록·형식 밖은 버린다
M.recordSiteEvent_('visit', 'booking', 'web', 'ko', '');
M.recordSiteEvent_('pageview', 'booking', 'web', 'ko', '');
M.recordSiteEvent_('partner_view', '=HYPERLINK("http://x")', 'web', 'ko', '');
ok(M.__rows__().length === 1 && M.__rows__()[0][1] === 'visit', '허용된 종류·형식만 적힌다(모르는 종류·수식 꼴 대상은 버림)');

// 2) 공개 라우트 — 대상 고정, partner_view 만 여러 대상
M.__reset__(); cache.clear();
hit({ k: 'visit', t: 'evil', s: 'web', lang: 'de' });
hit({ k: 'start', s: 'web', lang: 'de', g: 'prof' });
hit({ k: 'partner_view', t: 'cozyjoo,laonblumen', s: 'web', lang: 'ko', g: 'wed' });
const r2 = M.__rows__();
ok(r2.length === 4, `라우트: visit 1 + start 1 + partner_view 2 = 4행 (실제 ${r2.length})`);
ok(r2[0][2] === 'booking', 'visit 의 대상은 보낸 값과 무관하게 booking 고정');
ok(r2[2][2] === 'cozyjoo' && r2[3][2] === 'laonblumen', 'partner_view 는 업체별 1행');

// 3) 점검 출처는 통계에서 빠진다 + 퍼널 수치
hit({ k: 'visit', s: 'web', lang: 'ko' });
hit({ k: 'visit', s: 'web', lang: 'ko' });
hit({ k: 'submit', s: 'web', lang: 'ko', g: 'pass' });
hit({ k: 'visit', s: 'smoke' });
hit({ k: 'submit', s: 'smoke' });
const f = M.buildSiteFunnelStats_(30);
ok(f.visits === 3 && f.starts === 1 && f.submits === 1, `퍼널: 방문 3 · 상품선택 1 · 접수 1 (실제 ${f.visits}/${f.starts}/${f.submits})`);
ok(f.submitRatePct === 33.3 && f.startRatePct === 33.3, `전환율 33.3% (실제 ${f.submitRatePct}/${f.startRatePct})`);
ok(f.byLang.ko?.visit === 2 && f.byLang.de?.visit === 1 && f.byItemGroup.pass?.submit === 1, '언어·상품군별 분해');
ok(M.readSiteEvents_('').every((ev) => ev.source !== 'smoke'), 'smoke 출처는 조회에서 제외');

// 4) 분당 상한 — 공개 쓰기라 넘치면 버린다
M.__reset__(); cache.clear();
for (let i = 0; i < 90; i++) hit({ k: 'visit', s: 'web' });
ok(M.__rows__().length === 60, `분당 60건 상한 (실제 ${M.__rows__().length})`);

// 5) 메일 — 실제로 실리는 경로만 노출을 센다
M.__reset__();
const prof = M.partnerContextFrom_('prof', '프로필 Basic', [], '');
const pass = M.partnerContextFrom_('pass', '여권/비자 사진', [], '');
ok(M.buildPartnerMailBlockHtml_(prof, 'ko', 'mail').includes('cozyjoo') && M.__rows__().length === 0, '블록만 만드는 경로(접수 메일)는 노출을 세지 않는다');
const html = M.partnerMailBlockLogged_(prof, 'de', 'mail');
const r5 = M.__rows__();
ok(html.includes('cozyjoo') && r5.length === 1 && r5[0][1] === 'partner_view' && r5[0][2] === 'cozyjoo' && r5[0][3] === 'mail' && r5[0][5] === 'prof',
  '확정 메일 경로: 실린 업체마다 partner_view 1행(출처 mail)');
ok(M.partnerMailBlockLogged_(pass, 'ko', 'mail') === '' && M.__rows__().length === 1, '대상 업체가 없으면 블록도 기록도 없다');

if (fail) { console.error(`\n✗ ${fail}건 실패`); process.exit(1); }
console.log('\n✓ 사이트 집계 — 전부 통과');
