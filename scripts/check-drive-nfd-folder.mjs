#!/usr/bin/env node
/**
 * check-drive-nfd-folder.mjs — 한글 Drive 폴더명 NFD 함정 + 빈 보정본 폴더 가드
 *
 * 왜 필요한가(2026-09-29 신경숙 row 300): macOS 에서 올라간 폴더 '재보정본' 은 NFD(자모 분리)로 저장돼 있었다.
 *   getFoldersByName 은 바이트 정확일치라 NFC 리터럴로는 못 찾고 booking-final-send 가 RETOUCH_FOLDER_NOT_FOUND —
 *   사장님은 이미 올린 보정본을 다시 올리라는 안내를 받았다. 같은 자리에서 빈 '보정본' 폴더는 그대로 통과해
 *   빈 링크가 고객 메일로 나갈 뻔했고, select-retouch-send 는 못 찾으면 조용히 원본 폴더 링크로 대체했다.
 *
 * 어떻게: Code.gs 를 통째로 올리고 DriveApp 을 **바이트 정확일치** 가짜로 바꿔(진짜 Drive 와 같은 성질)
 *   findChildFolderByName_ · resolveRetouchSubfolder_ · sendFinalDeliveryAdmin(dryRun) · sendRetouchCompleteAdmin 을 돌린다.
 *
 * 사용법:  node scripts/check-drive-nfd-folder.mjs       (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');

/* ── 가짜 Drive: getFoldersByName 은 진짜처럼 바이트 비교 ── */
const registry = new Map();
const shared = [];
const iter = (arr) => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
/* 진짜 Drive ID 는 33자 — _extractDriveFolderId_ 가 짧은 ID 를 거르므로 픽스처도 길게 */
const fid = (k) => (k + '_'.repeat(33)).slice(0, 33);
function folder(key, name, children = [], files = []) {
  const id = fid(key);
  const f = {
    getId: () => id, getName: () => name, getUrl: () => `https://drive.google.com/drive/folders/${id}`,
    getFoldersByName: (n) => iter(children.filter((c) => c.getName() === n)),
    getFolders: () => iter(children), getFiles: () => iter(files),
    setSharing: () => { shared.push(id); },
  };
  registry.set(id, f);
  return f;
}
const jpg = (name) => ({ getName: () => name, getMimeType: () => 'image/jpeg', getSize: () => 1000 });
const NFD = (s) => s.normalize('NFD');
const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁 — 닿으면 안 되는 경로`); } });

Object.assign(globalThis, {
  DriveApp: {
    getFolderById: (id) => { const f = registry.get(id); if (!f) throw new Error('no folder ' + id); return f; },
    Access: { ANYONE_WITH_LINK: 'A' }, Permission: { VIEW: 'V' },
  },
  Utilities: { formatDate: () => '2026-09-29 12:00', sleep() {} },
  SpreadsheetApp: nope('SpreadsheetApp'), CalendarApp: nope('CalendarApp'), MailApp: nope('MailApp'),
  GmailApp: nope('GmailApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});

const dir = mkdtempSync(join(tmpdir(), 'nfd-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${gs}
var __ROW__=[],__SEL__=null,__SENT__=[],__ORIG__='';
function assertAdmin_(){}
function getDbSheet(){return {getLastColumn:function(){return __ROW__.length;},getRange:function(){return {getValues:function(){return [__ROW__];},setValue:function(){}};}};}
function resolveSelectDeliveryFolder_(){return {ok:true,url:__ORIG__};}
function ensureSheets_(){return {ss:{}};}
function ensureSelectSheet_(){return {getRange:function(){return {setValue:function(){}};}};}
function getActiveSelectRowForBooking_(){return __SEL__;}
function createHtmlActionLink_(){return 'https://x/action';}
function sendTrackedEmail_(m){__SENT__.push(m);return true;}
function sendSms_(){}
module.exports={findChildFolderByName_,resolveRetouchSubfolder_,sendFinalDeliveryAdmin,sendRetouchCompleteAdmin,BOOKING_COL,SELECT_COL,
  __set:function(o){if('row' in o)__ROW__=o.row;if('sel' in o)__SEL__=o.sel;if('orig' in o)__ORIG__=o.orig;},
  __sent:function(){var s=__SENT__;__SENT__=[];return s;}};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) { console.log(`  ✓ ${label}`); return; }
  fail++;
  console.log(`  ✗ ${label}${got === undefined ? '' : ' — got ' + JSON.stringify(got)}`);
};

/* ── 픽스처: row 300 과 같은 모양 ── */
const shots = [1, 2, 3, 4, 5].map((n) => jpg(`_DSF${n}.jpg`));
const reRetouch = folder('reRet', NFD('재보정본'), [], shots);                    // 실측 바이트 e1848c… (NFD)
const sinParent = folder('sinParent', NFD('260929_신경숙'), [reRetouch]);
const ret3 = folder('ret3', NFD('보정본'), [], shots.slice(0, 3));
const pA = folder('parentA', 'A', [ret3]);
const empty = folder('empty', NFD('보정본'));
const pEmpty = folder('parentEmpty', 'E', [empty]);
const pNone = folder('parentNone', 'N', [folder('other', 'Selects')]);
const nested = folder('nested', NFD('보정본'), [folder('n1', '1차', [], [jpg('a.jpg')])]);
const pNested = folder('parentNested', 'Q', [nested]);
const spaced = folder('spaced', NFD('보정본') + ' ');
const pSpaced = folder('parentSpaced', 'S', [spaced]);
const url = (key) => `https://drive.google.com/drive/folders/${fid(key)}`;

console.log('① 사전 확인 — 바이트가 정말 다르다');
ok(NFD('재보정본') !== '재보정본', 'NFD ≠ NFC (가짜 Drive 의 정확일치가 진짜처럼 실패해야 의미가 있다)');
ok(Buffer.from(NFD('재보정본')).toString('hex') === 'e1848ce185a2e18487e185a9e1848ce185a5e186bce18487e185a9e186ab', '실측 NFD 바이트와 동일');
ok(!sinParent.getFoldersByName('재보정본').hasNext(), '옛 코드 경로(getFoldersByName NFC)는 못 찾는다 — 버그 재현');

console.log('② findChildFolderByName_');
ok(M.findChildFolderByName_(sinParent, '재보정본') === reRetouch, 'NFC 이름으로 NFD 폴더를 찾는다');
ok(M.findChildFolderByName_(pA, '보정본') === ret3, '기본 보정본(NFD)');
ok(M.findChildFolderByName_(pSpaced, '보정본') === spaced, '끝 공백 붙은 폴더는 스캔으로 잡는다');
ok(M.findChildFolderByName_(pSpaced, '보정본', 0) === null, 'scanCap 0 은 스캔 생략(루트용)');
ok(M.findChildFolderByName_(pNone, '보정본') === null, '없으면 null');
const root = folder('driveRoot', 'Studio_mean', [sinParent]);
ok(M.findChildFolderByName_(root, '260929_신경숙', 0) === sinParent, '루트(scanCap 0 — 셀렉 재발송)도 NFD 고객 폴더를 찾는다');

console.log('③ resolveRetouchSubfolder_');
let r = M.resolveRetouchSubfolder_(url('sinParent'), '재보정본');
ok(r.ok && r.photos === 5 && r.name === '재보정본', 'row 300 재현: NFC 재보정본 → 5장, 이름은 NFC 로', r);
r = M.resolveRetouchSubfolder_(url('parentEmpty'));
ok(!r.ok && r.code === 'RETOUCH_FOLDER_EMPTY', '빈 보정본 → RETOUCH_FOLDER_EMPTY', r);
ok(M.resolveRetouchSubfolder_(url('parentEmpty'), '', { allowEmpty: true }).ok, 'allowEmpty 로만 통과');
r = M.resolveRetouchSubfolder_(url('parentNone'));
ok(!r.ok && r.code === 'RETOUCH_FOLDER_NOT_FOUND', '서브폴더 없음 → NOT_FOUND', r);
r = M.resolveRetouchSubfolder_('');
ok(!r.ok && r.code === 'RETOUCH_FOLDER_NOT_FOUND', '원본 링크 없음 → NOT_FOUND(빈 href 메일 금지)', r);
r = M.resolveRetouchSubfolder_(url('parentNested'));
ok(r.ok && r.photos === 1, '하위 폴더 안 사진도 센다(빈 폴더 오판 금지)', r);

console.log('④ sendFinalDeliveryAdmin (dryRun — 공유·발송 없음)');
const B = M.BOOKING_COL;
const row = []; row[B['고객명']] = '신경숙'; row[B['상태']] = '확정됨'; row[B['이메일']] = 'k@example.com';
row[B['언어']] = 'ko'; row[B['상품']] = '프로필'; row[B['예약일시']] = '2026-09-29 10:00';
for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
M.__set({ row, orig: url('sinParent') });
shared.length = 0;
r = M.sendFinalDeliveryAdmin('t', 300, { dryRun: true, retouchFolderName: '재보정본' });
ok(r.ok && r.dryRun && r.retouchUrl === url('reRet') && r.retouchPhotos === 5, 'NFC retouchFolderName 으로 통과(9/29 엔 NOT_FOUND 였다)', r);
ok(shared.length === 0, 'dryRun 은 공유 설정을 건드리지 않는다', shared);
M.__set({ orig: url('parentEmpty') });
r = M.sendFinalDeliveryAdmin('t', 300, { dryRun: true });
ok(!r.ok && r.code === 'RETOUCH_FOLDER_EMPTY' && r.originalUrl === url('parentEmpty'), '빈 보정본은 dryRun 에서부터 막힌다', r);
M.__set({ orig: url('parentNone') });
r = M.sendFinalDeliveryAdmin('t', 300, { dryRun: true, allowMissingRetouch: true });
ok(r.ok && r.retouchUrl === '', 'allowMissingRetouch 는 예전처럼 원본만', r);

console.log('⑤ sendRetouchCompleteAdmin (보정본 발송 메일)');
const S = M.SELECT_COL;
const sel = (link) => { const s = []; s[0] = 'sid'; s[2] = '신경숙'; s[3] = 'k@example.com'; s[10] = 'ko'; s[11] = link; s[S['제출일시']] = ''; s[S['재수정요청횟수']] = 0; return { rowIndex: 2, row: s }; };
M.__set({ sel: sel(url('parentA')) });
r = M.sendRetouchCompleteAdmin('t', 300, {});
let sent = M.__sent();
ok(r.ok && sent.length === 1 && sent[0].htmlBody.includes(url('ret3')) && !sent[0].htmlBody.includes(url('parentA')), 'NFD 보정본 링크로 발송(원본 링크 아님)', r);
M.__set({ sel: sel(url('parentNone')) });
r = M.sendRetouchCompleteAdmin('t', 300, {});
ok(!r.ok && r.code === 'RETOUCH_FOLDER_NOT_FOUND' && M.__sent().length === 0, '보정본 폴더 없으면 메일 안 나감(예전: 원본 링크로 조용히 대체)', r);
M.__set({ sel: sel(url('parentEmpty')) });
r = M.sendRetouchCompleteAdmin('t', 300, {});
ok(!r.ok && r.code === 'RETOUCH_FOLDER_EMPTY' && M.__sent().length === 0, '빈 보정본이면 메일 안 나감', r);
M.__set({ sel: sel('') });
r = M.sendRetouchCompleteAdmin('t', 300, {});
ok(!r.ok && M.__sent().length === 0, '원본 링크조차 없으면 빈 href 메일 안 나감', r);
M.__set({ sel: sel(url('parentNone')) });
r = M.sendRetouchCompleteAdmin('t', 300, { allowMissingRetouch: true });
sent = M.__sent();
ok(r.ok && sent.length === 1 && sent[0].htmlBody.includes(url('parentNone')), 'allowMissingRetouch 일 때만 원본 링크로', r);

console.log('⑥ 소스 — 한글 리터럴 정확일치 조회가 다시 생기지 않았나');
const bad = gs.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) =>
  /getFoldersByName\(\s*(subName|'보정본'|folderName)\s*\)/.test(l));
ok(bad.length === 0, "getFoldersByName('보정본'|subName|folderName) 직접 호출 없음", bad.map(([n]) => n));
ok(/select-retouch-send[\s\S]{0,300}retouchFolderName:payload\.retouchFolderName/.test(gs), '에이전트 select-retouch-send 가 retouchFolderName·override 를 넘긴다');

if (fail) { console.log(`\n❌ ${fail}건 실패`); process.exit(1); }
console.log('\n✅ NFD 폴더 조회·빈 보정본 가드 통과');
