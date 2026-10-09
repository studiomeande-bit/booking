#!/usr/bin/env node
/**
 * check-invoice-sync-noop.mjs — 인보이스 발행 → 예약 동기화가 "안 바뀐 예약" 의 돈 열을 다시 쓰지 않는지 (2026-10-08)
 *
 * 왜 필요한가: 어드민 인보이스 창은 '장부 자동 반영' 이 켜져 있으면 늘 bookingUpdate 를 보낸다. syncBookingFromInvoiceRecord_ 는
 *   계약금을 계산기 값(계산기 총액 = 인보이스 총액일 때만) 아니면 규칙값(€50·웨딩 20%)으로 다시 썼다. 굿샤인 예약은 총결제액이
 *   이미 줄어 있고 계약금은 일부러 0 이라(_formatBookingDepositCellAfterGutschein_) 계산기 총액과 어긋나 → 계약금 €50 이 되살아나고
 *   잔금이 바뀌었다. 상품·옵션 문구도 계산기 문구로 덮였다.
 *   지켜야 할 것: ① 같은 상품·인원·총액 → 계약금·잔금·총결제액·인원·상품·옵션 안 씀(메모 반영 줄은 씀)
 *   ② 상품·인원·총액을 실제로 바꾼 발행은 예전처럼 다시 계산 ③ 같은 값의 옵션 교체는 옵션만 씀(돈 열은 그대로).
 *
 * 어떻게: Code.gs 를 GAS 스텁과 함께 통째로 로드해 진짜 syncBookingFromInvoiceRecord_ 를 메모리 시트 한 행에 돌린다.
 * 사용법:  node scripts/check-invoice-sync-noop.mjs [Code.gs 경로]   (불일치 시 exit 1 — 경로는 스크래치 사본 검사용)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁`); } });
Object.assign(globalThis, {
  Utilities: { formatDate: () => '2026-10-08 12:00', sleep() {} }, SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'),
  CalendarApp: nope('CalendarApp'), MailApp: nope('MailApp'), GmailApp: nope('GmailApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});
const dir = mkdtempSync(join(tmpdir(), 'invsync-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${gs}
var __CAT__=[
  {id:'sb',g:'stud',t:'group',p:170,d:60,prep:15,nameKo:'스튜디오 Basic',nameEn:'Studio Basic',nameDe:'Studio-Shooting Basic'},
  {id:'ob',g:'snap',t:'snap',p:150,d:60,prep:0,nameKo:'야외/홈스냅 Basic',nameEn:'Outdoor Basic',nameDe:'Outdoor-Shooting Basic'},
  {id:'wp',g:'wed',t:'single',p:650,d:120,prep:0,nameKo:'프리웨딩 Plus',nameEn:'Pre-Wedding Plus',nameDe:'Pre-Wedding Plus'}
];
function getCachedProducts_(){return __CAT__;}
function getPromoProducts_(){return [];}
function getTfpProducts_(){return [];}
function getProductById_(id){const p=__CAT__.find(function(x){return x.id===id;}); if(!p) throw new Error('유효하지 않은 상품'); return p;}
function buildInvoicePricingPreview_(){throw new Error('미리보기 스텁');}   // 동기화는 try 로 감싸 둔다 — 계산기 문구는 bookingUpdate 쪽에서 온다
function ensureBookingCalendarEventForRow_(){}
module.exports={syncBookingFromInvoiceRecord_,BOOKING_COL,CONFIG};`);
const m = await import(pathToFileURL(modPath).href);
rmSync(dir, { recursive: true, force: true });
const { syncBookingFromInvoiceRecord_: sync, BOOKING_COL, CONFIG } = m.default || m;
const NAME = Object.fromEntries(Object.entries(BOOKING_COL).map(([k, v]) => [v + 1, k]));

function run(cells, inv, bookingUpdate) {
  const row = new Array(CONFIG.BOOKING_HEADERS.length).fill('');
  Object.entries({ 고객명: '테스트', 요청사항: '', ...cells }).forEach(([k, v]) => { row[BOOKING_COL[k]] = v; });
  const written = {};
  const sheet = { getRange: (r, c) => ({ getValues: () => [row.slice()], setValue: (v) => { written[NAME[c]] = v; row[c - 1] = v; } }) };
  const res = sync(sheet, 5, { number: 'STMIN-T1', type: '예약', ...inv }, bookingUpdate === undefined ? {} : { syncBooking: true, bookingUpdate });
  const cell = (k) => row[BOOKING_COL[k]];
  return { res, written, cell };
}
const lump = (desc, gross) => [{ description: desc, qty: 1, unitGross: gross, unitNet: Math.round(gross / 1.19 * 100) / 100, priceInputMode: 'brutto' }];
const MONEY = ['인원', '총결제액', '계약금', '잔금'];
const COMPOSITION = ['촬영종류', '상품', '옵션'];

let failed = 0;
const check = (label, ok, detail) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ' — ' + detail}`); if (!ok) failed++; };
const untouched = (r, keys) => keys.filter((k) => k in r.written);

/* 1. 굿샤인 스튜디오 예약(170 − 50 → 총결제액 120·계약금 0), 어드민이 창을 열고 그대로 발행 — 계산기 총액 170 ≠ 인보이스 120 */
{
  const r = run({ 촬영종류: 'stud', 상품: '스튜디오 Basic', 인원: 1, 총결제액: 120, 계약금: 0, 잔금: 120, 옵션: '', 굿샤인차감금액: 50 },
    { total: 120, items: lump('Studio-Shooting Basic', 120) },
    { itemId: 'sb', people: 1, optionKeys: [], calculatedTotal: 170, depositAmount: 50, balanceAmount: 120, invoiceTotal: 120, productName: '스튜디오 Basic', optionText: '인원 1명' });
  check('굿샤인 예약: 계약금 0 유지', r.cell('계약금') === 0, `계약금=${r.cell('계약금')}`);
  check('굿샤인 예약: 잔금 120 유지', r.cell('잔금') === 120, `잔금=${r.cell('잔금')}`);
  check('굿샤인 예약: 돈·구성 열 안 씀', !untouched(r, MONEY.concat(COMPOSITION)).length, `쓴 열=${untouched(r, MONEY.concat(COMPOSITION))}`);
  check('굿샤인 예약: 메모 반영 줄은 씀', /인보이스 STMIN-T1 반영: 총액 120/.test(String(r.cell('요청사항'))), `요청사항=${r.cell('요청사항')}`);
  check('굿샤인 예약: 결과 ok·장부 값 보고', r.res.ok && r.res.depositAmount === 0 && r.res.balanceAmount === 120, JSON.stringify(r.res));
}
/* 2. 굿샤인 웨딩(650 − 50 → 600·계약금 0) — 옛 규칙값 20% = 120 이 되살아나면 안 된다 */
{
  const r = run({ 촬영종류: 'wed', 상품: '프리웨딩 Plus', 인원: 2, 총결제액: 600, 계약금: 0, 잔금: 600, 옵션: '인원 2명' },
    { total: 600, items: lump('Pre-Wedding Plus', 600) },
    { itemId: 'wp', people: 2, optionKeys: [], calculatedTotal: 650, depositAmount: 130, invoiceTotal: 600, optionText: '인원 2명' });
  check('굿샤인 웨딩: 계약금 0 유지', r.cell('계약금') === 0 && !untouched(r, MONEY).length, `계약금=${r.cell('계약금')} 쓴 열=${untouched(r, MONEY)}`);
}
/* 3. bookingUpdate 없는 발행(보드·에이전트) — 총액이 같으면 돈 열 그대로 */
{
  const r = run({ 촬영종류: 'stud', 상품: '스튜디오 Basic', 인원: 1, 총결제액: 120, 계약금: 0, 잔금: 120 },
    { total: 120, product: 'Studio-Shooting Basic', items: lump('Studio-Shooting Basic', 120) }, undefined);
  check('bookingUpdate 없음: 계약금·상품 그대로', r.cell('계약금') === 0 && r.cell('상품') === '스튜디오 Basic' && !untouched(r, MONEY.concat(COMPOSITION)).length,
    `계약금=${r.cell('계약금')} 상품=${r.cell('상품')} 쓴 열=${untouched(r, MONEY.concat(COMPOSITION))}`);
}
/* 4. 같은 값의 옵션 교체(배경 → 의상, 둘 다 €20) — 옵션 열만 바뀌고 돈 열은 그대로 */
{
  const r = run({ 촬영종류: 'stud', 상품: '스튜디오 Basic', 인원: 1, 총결제액: 140, 계약금: 0, 잔금: 140, 옵션: '추가 배경' },
    { total: 140, items: lump('Studio-Shooting Basic', 140) },
    { itemId: 'sb', people: 1, optionKeys: ['outfit'], calculatedTotal: 190, depositAmount: 50, invoiceTotal: 140, optionText: '인원 1명 | 추가 의상' });
  check('옵션 교체: 옵션 씀·돈 열 안 씀', r.written['옵션'] === '인원 1명 | 추가 의상' && r.cell('계약금') === 0 && !untouched(r, MONEY).length,
    `옵션=${r.written['옵션']} 계약금=${r.cell('계약금')} 쓴 열=${untouched(r, MONEY)}`);
}
/* 5. 상품 변경(스튜디오 → 야외 €150) — 예전 동작 그대로: 상품·총액·계약금(계산기 값)·잔금 다시 씀 */
{
  const r = run({ 촬영종류: 'stud', 상품: '스튜디오 Basic', 인원: 1, 총결제액: 170, 계약금: 50, 잔금: 120 },
    { total: 150, items: lump('Outdoor-Shooting Basic', 150) },
    { itemId: 'ob', people: 1, optionKeys: [], calculatedTotal: 150, depositAmount: 50, invoiceTotal: 150, productName: '야외/홈스냅 Basic', optionText: '인원 1명' });
  check('상품 변경: 다시 계산', r.cell('촬영종류') === 'snap' && r.cell('상품') === '야외/홈스냅 Basic' && r.cell('총결제액') === 150 && r.cell('계약금') === 50 && r.cell('잔금') === 100,
    `촬영종류=${r.cell('촬영종류')} 상품=${r.cell('상품')} 총=${r.cell('총결제액')} 계약금=${r.cell('계약금')} 잔금=${r.cell('잔금')}`);
}
/* 6. 인원 변경(1 → 2) — 예전 동작 그대로 */
{
  const r = run({ 촬영종류: 'stud', 상품: '스튜디오 Basic', 인원: 1, 총결제액: 170, 계약금: 50, 잔금: 120 },
    { total: 200, items: lump('Studio-Shooting Basic', 200) },
    { itemId: 'sb', people: 2, optionKeys: [], calculatedTotal: 200, depositAmount: 50, invoiceTotal: 200, optionText: '인원 2명' });
  check('인원 변경: 다시 계산', r.cell('인원') === 2 && r.cell('총결제액') === 200 && r.cell('계약금') === 50 && r.cell('잔금') === 150,
    `인원=${r.cell('인원')} 총=${r.cell('총결제액')} 계약금=${r.cell('계약금')} 잔금=${r.cell('잔금')}`);
}
/* 7. 총액만 변경(어드민이 단가를 120 → 100 으로 고침) — 예전 동작 그대로: 규칙값(≤100 → 계약금 0) */
{
  const r = run({ 촬영종류: 'stud', 상품: '스튜디오 Basic', 인원: 1, 총결제액: 120, 계약금: 50, 잔금: 70 },
    { total: 100, items: lump('Studio-Shooting Basic', 100) },
    { itemId: 'sb', people: 1, optionKeys: [], calculatedTotal: 170, depositAmount: 50, invoiceTotal: 100, optionText: '인원 1명' });
  check('총액 변경: 다시 계산', r.cell('총결제액') === 100 && r.cell('계약금') === 0 && r.cell('잔금') === 100,
    `총=${r.cell('총결제액')} 계약금=${r.cell('계약금')} 잔금=${r.cell('잔금')}`);
}
/* 8. 인원만 변경, 총액 같음(스튜디오 2인까지 같은 값) — 인원 열은 써야 한다 */
{
  const r = run({ 촬영종류: 'stud', 상품: '스튜디오 Basic', 인원: 1, 총결제액: 170, 계약금: 50, 잔금: 120 },
    { total: 170, items: lump('Studio-Shooting Basic', 170) },
    { itemId: 'sb', people: 2, optionKeys: [], calculatedTotal: 170, depositAmount: 50, invoiceTotal: 170, optionText: '인원 2명' });
  check('인원만 변경: 인원 씀', r.cell('인원') === 2 && '인원' in r.written, `인원=${r.cell('인원')}`);
}
/* 9. 상품만 변경, 총액 같음(야외 150 → 스튜디오를 150 에) — 상품·촬영종류는 써야 한다 */
{
  const r = run({ 촬영종류: 'snap', 상품: '야외/홈스냅 Basic', 인원: 1, 총결제액: 150, 계약금: 50, 잔금: 100 },
    { total: 150, items: lump('Studio-Shooting Basic', 150) },
    { itemId: 'sb', people: 1, optionKeys: [], calculatedTotal: 170, depositAmount: 50, invoiceTotal: 150, productName: '스튜디오 Basic', optionText: '인원 1명' });
  check('상품만 변경: 상품·촬영종류 씀', r.cell('상품') === '스튜디오 Basic' && r.cell('촬영종류') === 'stud', `상품=${r.cell('상품')} 촬영종류=${r.cell('촬영종류')}`);
}

console.log(failed ? `\n${failed}건 실패` : '\n전부 통과');
process.exit(failed ? 1 : 0);
