#!/usr/bin/env node
/**
 * check-invoice-itemized.mjs — 인보이스 품목 분할 검사기 (사장님 규칙 2026-10-08)
 *
 * 왜 필요한가: "여권 프로필 및 모든 내용은 분할해서 인보이스 발행" — 보드 '인보이스' 버튼이 정진호(row305)에게
 *   'Passfoto/Visum ×1 €130' 한 줄을 냈고 고객이 35×2 / 30×2 로 나눠 달라고 했다(발행취소·재발행).
 *   이제 예약행을 견적 엔진으로 다시 계산해 줄을 만든다. 돈 문서라 깨지면 안 되는 것:
 *   ① 줄 합계 = 예약 총액(어긋나면 인보이스가 매출과 다르다) ② 엔진과 같은 단가(drift 줄 0)
 *   ③ 수기 정정·굿샤인·3회차 같은 엔진 밖 차이는 이름 붙은 한 줄 ④ 자동 품목은 예약을 되돌려 쓰지 않는다(상품명·계약금)
 *   ⑤ 사람이 나눈 품목·셀렉추가금·금액 지정은 건드리지 않는다 ⑥ 할인(음수) 줄이 1센트 새지 않는다.
 *
 * 어떻게: Code.gs 를 GAS 스텁 + 메모리 시트와 함께 통째로 로드해 진짜 buildBookingInvoiceItems_·calculateQuote_·
 *   _createInvoiceRecordCore_·getInvoiceItemUnitGross_ 를 돌린다. 카탈로그 단가는 라이브 '상품설정' 시트 값(2026-10)을
 *   시나리오 입력으로 쓰고, 기대 금액은 사업 사실로 고정한다.
 * 사용법:  node scripts/check-invoice-itemized.mjs       (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const adminHtml = readFileSync(join(ROOT, 'appscript', 'AdminV2.html'), 'utf8');
const fmt = (d, tz, p) => {
  const q = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return p.replace('yyyy', q.year).replace('MM', q.month).replace('dd', q.day).replace('HH', q.hour).replace('mm', q.minute).replace('ss', q.second);
};
const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁`); } });
Object.assign(globalThis, {
  Utilities: { formatDate: fmt, sleep() {} }, SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'),
  CalendarApp: nope('CalendarApp'), MailApp: nope('MailApp'), GmailApp: nope('GmailApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});
const dir = mkdtempSync(join(tmpdir(), 'invitem-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${gs}
var __CAT__=[
  {id:'pass',g:'pass',t:'passport',p:30,d:15,prep:0,nameKo:'여권/비자',nameEn:'Passport / Visa',nameDe:'Passfoto/Visum'},
  {id:'pb',g:'prof',t:'single',p:55,d:30,prep:15,nameKo:'프로필 Basic',nameEn:'Profile Basic',nameDe:'Profilfotos Basic'},
  {id:'pbus',g:'prof',t:'single',p:95,d:45,prep:15,nameKo:'프로필 Business',nameEn:'Profile Business',nameDe:'Profilfotos Business'},
  {id:'pp',g:'prof',t:'single',p:130,d:60,prep:15,nameKo:'프로필 Professional',nameEn:'Profile Professional',nameDe:'Profilfotos Professional'},
  {id:'sb',g:'stud',t:'group',p:170,d:60,prep:15,nameKo:'스튜디오 Basic',nameEn:'Studio Basic',nameDe:'Studio-Shooting Basic'},
  {id:'ob',g:'snap',t:'snap',p:150,d:60,prep:0,nameKo:'야외/홈스냅 Basic',nameEn:'Outdoor Basic',nameDe:'Outdoor-Shooting Basic'},
  {id:'oprm',g:'snap',t:'snap',p:350,d:120,prep:0,nameKo:'야외/홈스냅 Premium',nameEn:'Outdoor Premium',nameDe:'Outdoor-Shooting Premium'},
  {id:'wp',g:'wed',t:'single',p:650,d:120,prep:0,nameKo:'프리웨딩 Plus',nameEn:'Pre-Wedding Plus',nameDe:'Pre-Wedding Plus'},
  {id:'biz',g:'biz',t:'custom',p:0,d:60,prep:0,nameKo:'행사/이벤트 상담',nameEn:'Event',nameDe:'Event'}
];
function getCachedProducts_(){return __CAT__;}
function getPromoProducts_(){return [];}
function getTfpProducts_(){return [];}
function getProductById_(id){const p=__CAT__.find(function(x){return x.id===id;}); if(!p) throw new Error('유효하지 않은 상품'); return p;}
var __SETX__={};
function getSettingsMap_(){return Object.assign({return_discount:'10',express_rate:'20'},__SETX__);}
var __QUOTE__=null;
function _findQuoteRow_(sh,no){return __QUOTE__&&__QUOTE__.number===no?{rowIndex:2,row:__QUOTE__}:{rowIndex:-1};}
function quoteRowToObject_(row){return row;}
var __INV__=[], __BOOK__=[], __SYNC__=0, __WRITES__=[];
function ensureSheets_(){return {quoteSheet:{},
  bookingSheet:{getDataRange:function(){return{getValues:function(){return __BOOK__;}};},
    getRange:function(r,c){return{setValue:function(v){__WRITES__.push([r,c,v]);}};}},
  invoiceSheet:{getLastRow:function(){return __INV__.length+1;},
    getDataRange:function(){return{getValues:function(){return [new Array(40).fill('h')].concat(__INV__);}};},
    appendRow:function(r){__INV__.push(r);},
    getRange:function(){return{setValue:function(){}};}}};}
function generateInvoiceNumber_(){return 'STMIN-T'+(__INV__.length+1);}
function createInvoicePdf_(){return{fileId:'f',url:'u'};}
function buildInvoiceEmailDefaults_(){return{subject:'s',body:'b'};}
function syncBookingFromInvoiceRecord_(){__SYNC__++;return{requested:true,ok:true};}
function __row__(cells){const row=new Array(CONFIG.BOOKING_HEADERS.length).fill('');
  Object.keys(cells).forEach(function(k){row[BOOKING_COL[k]]=cells[k];}); return row;}
function __reset__(rows,quote){__INV__=[];__SYNC__=0;__WRITES__=[];__BOOK__=[new Array(CONFIG.BOOKING_HEADERS.length).fill('')].concat(rows);__QUOTE__=quote||null;}
module.exports={_invoiceRecordedAdjustments_,getInvoiceItemsNetTotal_,BOOKING_COL,__writes__:function(){return __WRITES__;},parseBookingOptionKeysFromText_,__setQuote__:function(q){__QUOTE__=q;},__setSettings__:function(x){__SETX__=x||{};},buildBookingInvoiceItems_,_createInvoiceRecordCore_,getInvoiceItemUnitGross_,getInvoiceGrossTotalForOutput_,
  normalizeInvoiceItemForStorage_,INVOICE_COL,__row__,__reset__,__inv__:function(){return __INV__;},__sync__:function(){return __SYNC__;}};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};
const r = (cells) => M.__row__({ '상태': '확정됨', '인원': 1, '예약일시': '2026-10-07 10:00', '결제수단': '카드', ...cells });
const build = (cells) => M.buildBookingInvoiceItems_(r(cells));
const sum = (items) => Math.round(items.reduce((a, i) => a + i.qty * i.unitGross, 0) * 100) / 100;
const show = (b) => b.items.map((i) => `${i.description} ×${i.qty} @${i.unitGross}`);
/** 기대 줄 [[문구, 수량, 단가]] 와 정확히 같고, 합 = 총액, 엔진 drift 없음 */
const expect = (label, cells, lines, total) => {
  const b = build(cells);
  const got = b.items.map((i) => [i.description, i.qty, i.unitGross]);
  ok(JSON.stringify(got) === JSON.stringify(lines) && sum(b.items) === total && !b.items.some((i) => i.description === 'Preisanpassung'),
    label, { got: show(b), sum: sum(b.items), total });
  return b;
};

// ── 1) 여권 — 사람별 국가 구성 단위로 묶고 수량을 단다 ───────────────────────────────
expect('정진호 row305: 2명 한국+독일 ×2@35 · 2명 독일 ×2@30 = 130',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 4, '총결제액': 130, '요청사항': '[국가별 신청] 2명:한국+독일, 2명:독일' },
  [['Passfoto/Visum (Korea + Deutschland), pro Person', 2, 35], ['Passfoto/Visum (Deutschland), pro Person', 2, 30]], 130);
expect('김종덕 row309(법인): ×2@35 + 한국+독일+미국 ×1@40 = 110, 가족할인 없음',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 3, '총결제액': 110, '사업자송장필요': 'Y', '요청사항': '[국가별 신청] 2명:한국+독일, 1명:한국+독일+미국' },
  [['Passfoto/Visum (Korea + Deutschland), pro Person', 2, 35], ['Passfoto/Visum (Korea + Deutschland + USA), pro Person', 1, 40]], 110);
expect('5인 한국+독일(개인): ×5@35 − 가족할인 17.50 = 157.50',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 5, '총결제액': 157.5, '요청사항': '[국가별 신청] 5명:한국+독일' },
  [['Passfoto/Visum (Korea + Deutschland), pro Person', 5, 35], ['Familien-/Gruppenrabatt ab 5 Personen (10 %)', 1, -17.5]], 157.5);
expect('5인 독일(법인): ×5@30 = 150, 가족할인 없음',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 5, '총결제액': 150, '사업자송장필요': 'Y', '요청사항': '[국가별 신청] 5명:독일' },
  [['Passfoto/Visum (Deutschland), pro Person', 5, 30]], 150);
expect('창구 등록(옵션 국가 2개/인, 3명): 국가명 없이 "2 Länder" ×3@35',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 3, '총결제액': 105, '옵션': '국가 2개/인' },
  [['Passfoto/Visum (2 Länder), pro Person', 3, 35]], 105);
expect('국가 기록 없음 1명: Passfoto/Visum, pro Person ×1@30',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 1, '총결제액': 30 },
  [['Passfoto/Visum, pro Person', 1, 30]], 30);
{ // 수기 정정(+5 인화 옵션) — 엔진 30 · 총액 35 → 사유로 이름 붙인 줄
  const b = build({ '촬영종류': 'pass', '상품': '여권/비자', '인원': 1, '총결제액': 35, '요청사항': '[국가별 신청] 1명:독일\n[금액정정 2026-09-20] 30→35€ 사유: 인화옵션 5€ (agent)' });
  ok(sum(b.items) === 35 && b.residual === 5 && b.items.at(-1).description === 'Zusätzliche Ausdrucke' && b.items.at(-1).unitGross === 5,
    '여권 + 수기 +5(인화) → "Zusätzliche Ausdrucke" +5', show(b));
}

// ── 2) 프로필·스튜디오·스냅 — 기본가 + 인원·옵션·토요일·콤보·급행 ───────────────────────
expect('프로필 Professional = Grundpreis ×1@130',
  { '촬영종류': 'prof', '상품': '프로필 Professional', '총결제액': 130 },
  [['Profilfotos Professional – Grundpreis', 1, 130]], 130);
expect('프로필 Professional + 여권콤보 1명 = 130 + 30',
  { '촬영종류': 'prof', '상품': '프로필 Professional', '총결제액': 160, '요청사항': '[여권콤보:1명]' },
  [['Profilfotos Professional – Grundpreis', 1, 130], ['Passfoto/Visum (Kombi), pro Person', 1, 30]], 160);
expect('프로필 Professional + 배경·의상 + 콤보 = 200',
  { '촬영종류': 'prof', '상품': '프로필 Professional', '총결제액': 200, '옵션': 'bg,outfit', '요청사항': '[여권콤보:1명]' },
  [['Profilfotos Professional – Grundpreis', 1, 130], ['Zusätzlicher Hintergrund', 1, 20], ['Zusätzliches Outfit', 1, 20], ['Passfoto/Visum (Kombi), pro Person', 1, 30]], 200);
expect('스튜디오 Basic 6명 + 의상 = 170 + 4×30 + 20 = 310',
  { '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 6, '총결제액': 310, '옵션': 'outfit' },
  [['Studio-Shooting Basic – inkl. 2 Personen', 1, 170], ['Zusätzliche Person', 4, 30], ['Zusätzliches Outfit', 1, 20]], 310);
expect('스냅 Premium 토요일 2명 = 350 + 토요일 40',
  { '촬영종류': 'snap', '상품': '야외/홈스냅 Premium', '인원': 2, '총결제액': 390, '예약일시': '2026-09-26 11:00' },
  [['Outdoor-Shooting Premium – inkl. 2 Personen', 1, 350], ['Samstagszuschlag', 1, 40]], 390);
expect('스냅 Basic 1명 = 150 − 30',
  { '촬영종류': 'snap', '상품': '야외/홈스냅 Basic', '인원': 1, '총결제액': 120 },
  [['Outdoor-Shooting Basic – inkl. 2 Personen', 1, 150], ['Einzelperson (Preisnachlass)', 1, -30]], 120);
expect('굿샤인 전액: 스튜디오 2명 + 반려견 185 − 굿샤인 185 = 0',
  { '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 2, '총결제액': 0, '옵션': 'dog', '굿샤인코드': 'T9Z7-AAAA', '굿샤인차감금액': 185 },
  [['Studio-Shooting Basic – inkl. 2 Personen', 1, 170], ['Haustier im Shooting', 1, 15], ['Gutschein T9Z7-AAAA eingelöst', 1, -185]], 0);
expect('재방문 프로필 Business 95 − 10% = 85.50',
  { '촬영종류': 'prof', '상품': '프로필 Business', '총결제액': 85.5, '재방문': '재방문' },
  [['Profilfotos Business – Grundpreis', 1, 95], ['Stammkundenrabatt (10 %)', 1, -9.5]], 85.5);
expect('키즈 프로필 Basic 55 − 10 = 45',
  { '촬영종류': 'prof', '상품': '프로필 Basic', '총결제액': 45, '요청사항': '촬영대상: 키즈' },
  [['Profilfotos Basic – Grundpreis', 1, 55], ['Kinderrabatt', 1, -10]], 45);
expect('급행 프로필 Professional = 130 + 26',
  { '촬영종류': 'prof', '상품': '프로필 Professional', '총결제액': 156, '옵션': 'express' },
  [['Profilfotos Professional – Grundpreis', 1, 130], ['Expressbearbeitung', 1, 26]], 156);
{ // 3회차 혜택 −20(수기 정정) — 엔진 밖 차이는 사유로 이름 붙인 할인 줄
  const b = build({ '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 2, '총결제액': 150, '요청사항': '[금액정정 2026-09-05] 170→150€ 사유: [3회차혜택] -20€ (3회차) (agent)' });
  ok(sum(b.items) === 150 && b.items.at(-1).description === 'Treuerabatt (3. Besuch)' && b.items.at(-1).unitGross === -20 && b.items.at(-1).isDiscount,
    '3회차 혜택 → "Treuerabatt (3. Besuch)" −20', show(b));
}

// 상쇄 쌍 금지 — 차이가 할인·할증 한 줄을 정확히 되돌리면 그 줄을 뺀다(실데이터 행 154·171)
expect('재방문 표시인데 할인 미적용 정정(총 95) → 할인 줄 없이 95',
  { '촬영종류': 'prof', '상품': '프로필 Business', '총결제액': 95, '재방문': '재방문', '요청사항': '[금액정정 2026-09-02] 85.50→95€ 사유: 재방문할인(10%) 미적용' },
  [['Profilfotos Business – Grundpreis', 1, 95]], 95);
expect('5인 한국(가족할인 도입 전, 총 150) → 가족할인 줄 없이 ×5@30',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 5, '총결제액': 150, '요청사항': '[국가별 신청] 5명:한국' },
  [['Passfoto/Visum (Korea), pro Person', 5, 30]], 150);
expect('기록 없이 토요일 할증만큼 덜 받음(총 350) → 산 할증 줄은 지우지 않고 Rabatt',
  { '촬영종류': 'snap', '상품': '야외/홈스냅 Premium', '인원': 2, '총결제액': 350, '예약일시': '2026-09-26 11:00' },
  [['Outdoor-Shooting Premium – inkl. 2 Personen', 1, 350], ['Samstagszuschlag', 1, 40], ['Rabatt', 1, -40]], 350);
{
  const b = build({ '촬영종류': 'pass', '상품': '여권/비자', '인원': 1, '총결제액': 0, '요청사항': '[국가별 신청] 1명:독일\n[무료처리] 재촬영' });
  ok(b.items.length === 2 && b.items[0].unitGross === 30 && b.items[1].description === 'Kulanz (kostenfrei)' && sum(b.items) === 0,
    '무료(총 0) → 기본가 줄은 남기고 "Kulanz" −30(기본가 줄은 상쇄 대상 아님)', show(b));
}

// 검토 2026-10-08 — 여권도 공통 줄(옵션·이벤트·급행)로 내려간다 · 'Peter' 는 반려동물이 아니다
M.__setSettings__({ event_rate: '10', event_start: '2026-10-01', event_end: '2026-10-31' });
expect('여권 2명 한국+독일 + 이벤트 10% = 70 − 7 (drift 없음)',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 2, '총결제액': 63, '요청사항': '[국가별 신청] 2명:한국+독일' },
  [['Passfoto/Visum (Korea + Deutschland), pro Person', 2, 35], ['Aktionsrabatt', 1, -7]], 63);
M.__setSettings__({});
ok(JSON.stringify(['Peter Kim', 'competent', 'Petra', 'Kompetenz'].map((t) => M.parseBookingOptionKeysFromText_(t))) === '[[],[],[],[]]'
  && ['반려동물', 'pet', 'Pets', 'Haustier'].every((t) => M.parseBookingOptionKeysFromText_(t)[0] === 'dog'),
  '옵션 파서: 이름·단어 속 "pet" 은 반려동물이 아니다(\\b)', ['Peter Kim', 'pet'].map((t) => M.parseBookingOptionKeysFromText_(t)));
expect('추가항목 "Peter Kim" — 반려동물 옵션으로 읽지 않는다',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 1, '총결제액': 30, '추가항목': 'Peter Kim | competent', '요청사항': '[국가별 신청] 1명:독일' },
  [['Passfoto/Visum (Deutschland), pro Person', 1, 30]], 30);
expect('반려동물 옵션은 그대로(옵션 열 "반려동물")',
  { '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 2, '총결제액': 185, '옵션': '반려동물' },
  [['Studio-Shooting Basic – inkl. 2 Personen', 1, 170], ['Haustier im Shooting', 1, 15]], 185);
expect('토요일 스냅 + [현장할인] −20 → 할증 줄 유지 + "Rabatt (vor Ort)"(상쇄로 지우지 않는다)',
  { '촬영종류': 'snap', '상품': '야외/홈스냅 Basic', '인원': 2, '총결제액': 150, '예약일시': '2026-09-26 11:00', '요청사항': '[현장할인] 단골 -20€' },
  [['Outdoor-Shooting Basic – inkl. 2 Personen', 1, 150], ['Samstagszuschlag', 1, 20], ['Rabatt (vor Ort)', 1, -20]], 150);
expect('웨딩 얼리버드 — 발행 시점이 아니라 예약 시각(동의시각) 기준 −65',
  { '촬영종류': 'wed', '상품': '프리웨딩 Plus', '인원': 2, '총결제액': 585, '예약일시': '2026-10-16 11:00', '동의시각': '2026-03-01 10:00:00' },
  [['Pre-Wedding Plus – Grundpreis', 1, 650], ['Frühbucherrabatt', 1, -65]], 585);
{ // 견적 전환 예약 — 카탈로그 상품명과 겹쳐도 견적서 품목(€0 줄 포함)이 먼저
  M.__setQuote__({ number: 'AN-260010', items: [
    { description: 'Studio-Shooting Firmenteam (3 Std.)', qty: 1, unitGross: 400 },
    { description: 'Bildbearbeitung', qty: 10, unitGross: 10 },
    { description: 'Anfahrt (inklusive)', qty: 1, unitGross: 0 }] });
  const b = build({ '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 6, '총결제액': 500, '추가항목': '[견적: AN-260010] 팀 촬영' });
  ok(b.source === 'quote' && b.items.length === 3 && b.items[1].qty === 10 && b.items[2].unitGross === 0 && sum(b.items) === 500,
    '견적 AN 예약 → 견적서 3줄(€0 Anfahrt 포함) 그대로', [b.source, show(b)]);
  const c = build({ '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 2, '총결제액': 170, '추가항목': '[견적: AN-260010]' });
  ok(c.source === 'engine' && sum(c.items) === 170, '견적 합 ≠ 예약 총액이면 엔진으로', [c.source, show(c)]);
  M.__setQuote__(null);
}

// 검토 라운드 2 (2026-10-08)
expect('[예약 세부내역] 의 고객 질문 "추가 배경, 추가 의상도 가능할까요?" 는 산 옵션이 아니다',
  { '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 2, '총결제액': 170, '추가항목': '분위기: 깔끔/모던\n[예약 세부내역]\n요청사항: 추가 배경, 추가 의상도 현장에서 가능할까요?' },
  [['Studio-Shooting Basic – inkl. 2 Personen', 1, 170]], 170);
expect('어드민 수기 등록 여권콤보(추가항목 "여권콤보: 2명 / 추가 20분") → Kombi ×2',
  { '촬영종류': 'prof', '상품': '프로필 Professional', '총결제액': 190, '추가항목': '여권콤보: 2명 / 추가 20분 | 예약채널=직접예약', '요청사항': '수기등록: GDPR 동의' },
  [['Profilfotos Professional – Grundpreis', 1, 130], ['Passfoto/Visum (Kombi), pro Person', 2, 30]], 190);
{
  const mrt = build({ '촬영종류': 'snap', '상품': '야외/홈스냅 Basic', '인원': 2, '총결제액': 141.37, '예약일시': '2026-09-26 11:00', '결제수단': '마이리얼트립' });
  ok(mrt.source === 'none' && !mrt.items.length, '결제수단 마이리얼트립 행은 정가로 나누지 않는다(한 줄 유지)', [mrt.source, show(mrt)]);
  M.__setQuote__({ number: 'AN-260030', lang: 'de_ko', discount: 50, items: [
    { description: 'Studio-Shooting Firmenteam (3 Std.)\nInklusive Bildauswahl\n//\n기업 팀 스튜디오 촬영 (3시간)\n셀렉 포함', qty: 1, unitGross: 400 },
    { description: 'Bildbearbeitung\n//\n보정', qty: 10, unitGross: 10 }] });
  const qd = build({ '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 6, '총결제액': 450, '추가항목': '[견적: AN-260030]' });
  ok(qd.source === 'quote' && sum(qd.items) === 450 && qd.items.length === 3 && qd.items[2].description === 'Rabatt' && qd.items[2].unitGross === -50
    && !qd.items.some((i) => /\/\/|[가-힣]/.test(i.description)) && qd.items[0].description.startsWith('Studio-Shooting Firmenteam (3 Std.)'),
    '견적 머리 할인 → "Rabatt" 줄 · 다국어 견적은 독일어 부분만', [qd.source, show(qd)]);
  M.__setQuote__(null);
}
{
  const pbRow = r({ '고객명': '테스트', '촬영종류': 'prof', '상품': '프로필 Basic', '옵션': 'bg', '총결제액': 75, '추가항목': '아기와 함께' });
  const items = () => JSON.parse(M.__inv__().at(-1)[M.INVOICE_COL['품목JSON']]);
  const lump = [{ productId: 'pb', description: '프로필 Basic | 인원 1명 | 옵션: 추가 의상 +20€', qty: 1, unitGross: 75 }];
  M.__reset__([pbRow]);
  const sw = M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '예약', items: lump, bookingUpdate: { itemId: 'pb', people: 1, optionKeys: ['outfit'], ageGroup: 'adult' } });
  ok(!sw.itemized && items().length === 1, '어드민 계산기에서 같은 값 다른 구성(배경→의상) → 예약행으로 나누지 않고 어드민 줄 유지', [sw.itemized, items()]);
  M.__reset__([pbRow]);
  const same = M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '예약', items: lump, bookingUpdate: { itemId: 'pb', people: 1, optionKeys: ['bg'], ageGroup: 'adult' } });
  ok(same.itemized && items().length === 2, '구성이 같으면(영유아 표시 차이는 무시) 분할', [same.itemized, items()]);
  const bizRow = r({ '고객명': '테스트', '촬영종류': 'prof', '상품': '프로필 Basic', '총결제액': 55 });
  M.__reset__([bizRow]);
  M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '일반', businessInvoiceNeeded: true, businessCompanyName: 'ACME GmbH', businessVatId: 'DE123', businessInvoiceEmail: 'ap@acme.de' });
  const w = M.__writes__().filter((x) => x[0] === 2);
  ok(w.some((x) => x[1] === M.BOOKING_COL['사업자송장필요'] + 1 && x[2] === 'Y') && w.some((x) => x[1] === M.BOOKING_COL['사업자명'] + 1 && x[2] === 'ACME GmbH'),
    '자동 품목 + 사업자 송장 발행 → 예약에 사업자 표시는 남긴다', w);
  const gsRow = r({ '고객명': '테스트', '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 2, '총결제액': 0, '옵션': 'dog', '굿샤인코드': 'T9Z7-AAAA', '굿샤인차감금액': 185 });
  M.__reset__([gsRow]);
  M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '일반' });
  ok(M.getInvoiceItemsNetTotal_(items()) === 0, '굿샤인 전액(총 0) → 순액 합 0.00(전엔 0.01 · MwSt −0.01)', [M.getInvoiceItemsNetTotal_(items()), items().map((i) => i.unitNet)]);
}

// 검토 라운드 3 — 정정 여러 건은 사유마다 한 줄 · 상품변경 뒤 옛 할인 상태 · 견적 + 뒤 정정/굿샤인 · €0 줄 끝전
expect('3회차 −20 뒤 현장할인 −10 → 사유마다 한 줄',
  { '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 3, '총결제액': 170,
    '요청사항': '[금액정정 2026-10-01] 200→180€ 사유: [3회차혜택] -20€ (3회차) (agent)\n[금액정정 2026-10-01] 180→170€ 사유: [현장할인] 지인 -10€ (보드) (agent)' },
  [['Studio-Shooting Basic – inkl. 2 Personen', 1, 170], ['Zusätzliche Person', 1, 30], ['Treuerabatt (3. Besuch)', 1, -20], ['Rabatt (vor Ort)', 1, -10]], 170);
expect('인화 +15 뒤 현장할인 −20 → 산 인화가 사라지지 않는다',
  { '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 2, '총결제액': 165,
    '요청사항': '[금액정정 2026-10-01] 170→185€ 사유: 인화 A4 1장 추가 (agent)\n[금액정정 2026-10-01] 185→165€ 사유: [현장할인] 협력사 -20€ (보드) (agent)' },
  [['Studio-Shooting Basic – inkl. 2 Personen', 1, 170], ['Zusätzliche Ausdrucke', 1, 15], ['Rabatt (vor Ort)', 1, -20]], 165);
expect('받은 잔금 정정 줄·0 변화 줄은 총액 정정이 아니다',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 1, '총결제액': 35, '요청사항': '[국가별 신청] 1명:독일\n[금액정정 2026-09-20] 30→35€ 사유: 인화옵션 5€ (agent)\n[금액정정 2026-09-21] 35→35€\n[금액정정 2026-09-22] 받은 잔금 35→40€ 사유: 팁 (agent)' },
  [['Passfoto/Visum (Deutschland), pro Person', 1, 30], ['Zusätzliche Ausdrucke', 1, 5]], 35);
{
  const adj = M._invoiceRecordedAdjustments_(r({ '요청사항': '[금액정정 2026-09-01] 100→90€ 사유: 옛 정정\n[상품변경 2026-09-02] A→B, 90→120€ (agent)\n[금액정정 2026-09-22] 받은 잔금 120→125€ 사유: 팁 (agent)\n[금액정정 2026-09-23] 120→120€\n[재촬영할인 20% 적용 2026-09-24] 기존 120€ -> 96€ (-24€)\n[금액정정 2026-09-25] 96→91€ 사유: [현장할인] 지인 -5€ (보드) (agent)' }));
  ok(JSON.stringify(adj.map((a) => ({ delta: a.delta, label: a.label }))) === JSON.stringify([{ delta: -24, label: 'Rabatt (Nachshooting)' }, { delta: -5, label: 'Rabatt (vor Ort)' }]),
    '정정 파서: 상품변경 이전·받은 잔금·0 변화 줄은 빼고 재촬영·현장할인만', adj);
}
expect('현장에서 여권콤보 취소(상품변경 160→130, 추가항목엔 콤보 흔적) → Kombi·Rabatt 상쇄 쌍 없이 130',
  { '촬영종류': 'prof', '상품': '프로필 Professional', '총결제액': 130, '추가항목': '분위기: 전문/포멀 | 여권콤보: 1명 / 추가 15분',
    '요청사항': '[배경1:white]\n[상품변경 2026-10-08] 프로필 Professional→프로필 Professional, 160→130€ (agent)\n여권콤보 현장 취소' },
  [['Profilfotos Professional – Grundpreis', 1, 130]], 130);
// 검토 라운드 4 — 되돌린 정정·한 줄에 붙은 옛 메모·사유 있는 정정·산 품목 보호·동률
const sb2 = { '촬영종류': 'stud', '상품': '스튜디오 Basic', '인원': 2, '예약일시': '2026-10-14 10:00' };
expect('+20 뒤 −20 되돌림(사유 없음) → 정정 줄 없음',
  { ...sb2, '총결제액': 170, '요청사항': '[금액정정 2026-10-08] 170→190€ (잔금 120→140€) (agent)\n[금액정정 2026-10-08] 190→170€ (잔금 140→120€) (agent)' },
  [['Studio-Shooting Basic – inkl. 2 Personen', 1, 170]], 170);
expect('+30 출장비 뒤 −30 정정 → 되돌림이라 둘 다 없음',
  { ...sb2, '총결제액': 170, '요청사항': '[금액정정 2026-10-08] 170→200€ 사유: 출장비 (agent)\n[금액정정 2026-10-08] 200→170€ 사유: 정정 (agent)' },
  [['Studio-Shooting Basic – inkl. 2 Personen', 1, 170]], 170);
expect('+10 보정 뒤 −10 오타 정정 → 상쇄 쌍 없음',
  { ...sb2, '총결제액': 170, '요청사항': '[금액정정 2026-10-08] 170→180€ 사유: 추가 보정 1장 (agent)\n[금액정정 2026-10-08] 180→170€ 사유: 오타 정정 (agent)' },
  [['Studio-Shooting Basic – inkl. 2 Personen', 1, 170]], 170);
expect('토요일+배경 예약에 인화 +20 뒤 인화 취소 −20 → 토요일 할증 그대로',
  { '촬영종류': 'snap', '상품': '야외/홈스냅 Basic', '인원': 2, '옵션': 'bg', '예약일시': '2026-10-10 11:00', '총결제액': 190,
    '요청사항': '[금액정정 2026-10-08] 190→210€ 사유: 인화 A4 추가 (agent)\n[금액정정 2026-10-08] 210→190€ 사유: 인화 취소 (agent)' },
  [['Outdoor-Shooting Basic – inkl. 2 Personen', 1, 150], ['Samstagszuschlag', 1, 20], ['Zusätzlicher Hintergrund', 1, 20]], 190);
expect('옛 행: [제휴사할인] 이 앞 줄 끝에 붙음 + 인화 +5 → 둘 다 제 금액',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 1, '총결제액': 33,
    '요청사항': '[국가별 신청] 1명:독일\n[금액정정 2026-10-08] 30→35€ (잔금 30→35€) 사유: 인화옵션 5€ (agent) [제휴사할인 2026-10-08 11:28] 와이마트 -2€ / 기존 35€ -> 33€' },
  [['Passfoto/Visum (Deutschland), pro Person', 1, 30], ['Zusätzliche Ausdrucke', 1, 5], ['Partnerrabatt', 1, -2]], 33);
expect('사유 있는 +30(야외 장소 추가) → 1인 할인 줄 유지 + Zusatzleistung',
  { '촬영종류': 'snap', '상품': '야외/홈스냅 Basic', '인원': 1, '총결제액': 150, '요청사항': '[금액정정 2026-10-08] 120→150€ 사유: 야외 장소 추가 1곳 (agent)' },
  [['Outdoor-Shooting Basic – inkl. 2 Personen', 1, 150], ['Einzelperson (Preisnachlass)', 1, -30], ['Zusatzleistung', 1, 30]], 150);
expect('3회차 −20 뒤 기록 없는 −10(어드민 저장) → Treuerabatt −20 + Rabatt −10',
  { ...sb2, '총결제액': 140, '요청사항': '[금액정정 2026-10-08] 170→150€ (잔금 120→100€) 사유: [3회차혜택] -20€ (3회차) (agent)' },
  [['Studio-Shooting Basic – inkl. 2 Personen', 1, 170], ['Treuerabatt (3. Besuch)', 1, -20], ['Rabatt', 1, -10]], 140);
expect('여권콤보를 산 예약에 "지인 할인" −30 → 콤보 줄은 남기고 Rabatt',
  { '촬영종류': 'prof', '상품': '프로필 Basic', '총결제액': 55, '요청사항': '[여권콤보:1명]\n[금액정정 2026-10-08] 85→55€ 사유: 지인 할인 (agent)' },
  [['Profilfotos Basic – Grundpreis', 1, 55], ['Passfoto/Visum (Kombi), pro Person', 1, 30], ['Rabatt', 1, -30]], 55);
expect('토요일+배경에 "배경 추가 무료 서비스" −20 → 메모가 이름 댄 배경 줄만 뺀다',
  { '촬영종류': 'snap', '상품': '야외/홈스냅 Basic', '인원': 2, '옵션': 'bg', '예약일시': '2026-10-10 11:00', '총결제액': 170,
    '요청사항': '[금액정정 2026-10-08] 190→170€ 사유: 배경 추가 무료 서비스 (agent)' },
  [['Outdoor-Shooting Basic – inkl. 2 Personen', 1, 150], ['Samstagszuschlag', 1, 20]], 170);
expect('재방문 표시 + 3회차 −20 + [재촬영할인] −13 → 엔진의 옛 재방문 줄 대신 기록된 두 할인',
  { '촬영종류': 'snap', '상품': '야외/홈스냅 Basic', '인원': 2, '총결제액': 117, '재방문': '재방문',
    '요청사항': '[금액정정 2026-10-08] 150→130€ 사유: [3회차혜택] -20€ (3회차) (agent)\n[재촬영할인 10% 적용 2026-10-08 12:00] 기존 130€ -> 117€ (-13€)' },
  [['Outdoor-Shooting Basic – inkl. 2 Personen', 1, 150], ['Treuerabatt (3. Besuch)', 1, -20], ['Rabatt (Nachshooting)', 1, -13]], 117);
expect('사유 없는 +10 · +5 → 한 줄 Zusatzleistung +15',
  { ...sb2, '총결제액': 185, '요청사항': '[금액정정 2026-10-08] 170→180€ (agent)\n[금액정정 2026-10-08] 180→185€ (agent)' },
  [['Studio-Shooting Basic – inkl. 2 Personen', 1, 170], ['Zusatzleistung', 1, 15]], 185);
expect('메모가 토요일·배경 둘 다 이름 대고 −20 → 어느 줄인지 모호(동률)라 둘 다 두고 Rabatt',
  { '촬영종류': 'snap', '상품': '야외/홈스냅 Basic', '인원': 2, '옵션': 'bg', '예약일시': '2026-10-10 11:00', '총결제액': 170,
    '요청사항': '[금액정정 2026-10-08] 190→170€ 사유: 토요일·배경 서비스 (agent)' },
  [['Outdoor-Shooting Basic – inkl. 2 Personen', 1, 150], ['Samstagszuschlag', 1, 20], ['Zusätzlicher Hintergrund', 1, 20], ['Rabatt', 1, -20]], 170);
expect('국가 토큰 줄에 복사된 [제휴사할인] 사본은 한 번만',
  { '촬영종류': 'pass', '상품': '여권/비자', '인원': 1, '총결제액': 28,
    '요청사항': '[국가별 신청] 1명:독일\n[제휴사할인 2026-10-08 11:28] 와이마트 -2€ / 기존 30€ -> 28€\n[현장추가 2026-10-08] 메모 사본 [제휴사할인 2026-10-08 11:28] 와이마트 -2€ / 기존 30€ -> 28€' },
  [['Passfoto/Visum (Deutschland), pro Person', 1, 30], ['Partnerrabatt', 1, -2]], 28);
const kidsReturnChanged = { '촬영종류': 'prof', '상품': '프로필 Business', '총결제액': 95, '재방문': '재방문', '추가항목': '촬영대상: 키즈 | 할인: 키즈 할인 -10€ 적용',
  '요청사항': '[상품변경 2026-10-01] 프로필 Basic→프로필 Business, 40.5→95€ (agent)' };
expect('상품변경 뒤 옛 키즈·재방문 할인 두 줄 → 둘 다 빼고 실제 청구대로',
  kidsReturnChanged, [['Profilfotos Business – Grundpreis', 1, 95]], 95);
expect('상품변경 뒤 현장할인 −10 → 옛 할인 대신 "Rabatt (vor Ort)"',
  { ...kidsReturnChanged, '총결제액': 85, '요청사항': kidsReturnChanged['요청사항'] + '\n[금액정정 2026-10-01] 95→85€ 사유: [현장할인] 지인 -10€ (보드) (agent)' },
  [['Profilfotos Business – Grundpreis', 1, 95], ['Rabatt (vor Ort)', 1, -10]], 85);
{
  M.__setQuote__({ number: 'AN-260040', lang: 'de', discount: 0, items: [
    { description: 'Pre-Wedding Plus (4 Std.)', qty: 1, unitGross: 650 }, { description: 'Zusatzstunde', qty: 1, unitGross: 150 }] });
  const q1 = build({ '촬영종류': 'wed', '상품': '프리웨딩 Plus', '인원': 2, '총결제액': 780, '추가항목': '[견적: AN-260040]',
    '요청사항': '[금액정정 2026-10-01] 800→780€ 사유: [현장할인] 지인 -20€ (보드) (agent)' });
  ok(q1.source === 'quote' && JSON.stringify(q1.items.map((i) => [i.description, i.unitGross])) === JSON.stringify([['Pre-Wedding Plus (4 Std.)', 650], ['Zusatzstunde', 150], ['Rabatt (vor Ort)', -20]]),
    '견적 예약 + 뒤 현장할인 → 견적 줄 + "Rabatt (vor Ort)"', [q1.source, show(q1)]);
  const q2 = build({ '촬영종류': 'wed', '상품': '프리웨딩 Plus', '인원': 2, '총결제액': 700, '추가항목': '[견적: AN-260040]', '굿샤인코드': 'GS-1', '굿샤인차감금액': 100 });
  ok(q2.source === 'quote' && sum(q2.items) === 700 && q2.items.at(-1).description === 'Gutschein GS-1 eingelöst', '견적 예약 + 굿샤인 → 견적 줄 + 굿샤인 줄', [q2.source, show(q2)]);
  const zq = { number: 'AN-260050', lang: 'de', discount: 0, items: [
    { description: 'Businessporträts vor Ort', qty: 1, unitGross: 100 }, { description: 'Bildbearbeitung', qty: 1, unitGross: 100 }, { description: 'Anfahrt (inklusive)', qty: 1, unitGross: 0 }] };
  M.__reset__([r({ '고객명': '테스트', '촬영종류': 'biz', '상품': '행사/이벤트 상담', '총결제액': 200, '추가항목': '[견적: AN-260050]' })], zq);
  M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '일반' });
  const zi = JSON.parse(M.__inv__().at(-1)[M.INVOICE_COL['품목JSON']]);
  ok(zi.length === 3 && zi[2].unitNet === 0 && M.getInvoiceGrossTotalForOutput_({ items: zi }) === 200,
    '순액 끝전을 €0 줄에 싣지 않는다(PDF Endbetrag 200.00, 전엔 200.01)', zi.map((i) => [i.description, i.unitGross, i.unitNet]));
  M.__setQuote__(null);
}

// ── 3) 엔진으로 못 나누는 상품 — 견적서 품목(단가)이면 그대로, 아니면 빈 배열(한 줄 유지) ─────────
{
  const biz = build({ '촬영종류': 'biz', '상품': '행사/이벤트 상담', '총결제액': 462.5 });
  ok(biz.items.length === 0 && biz.source === 'none', '견적형(biz) 견적서 없음 → 분할 안 함(한 항목)', biz);
}
// ── 4) 인보이스 생성 경로 — 보드 버튼(품목 없음) · 어드민 한 줄 · 사람이 나눈 품목 · 셀렉추가금 · 금액 지정 ──
{
  const row305 = r({ '고객명': '정진호', '촬영종류': 'pass', '상품': '여권/비자', '인원': 4, '총결제액': 130, '계약금': '', '잔금': 130, '요청사항': '[국가별 신청] 2명:한국+독일, 2명:독일' });
  const items = () => JSON.parse(M.__inv__().at(-1)[M.INVOICE_COL['품목JSON']]);
  M.__reset__([row305]);
  const a = M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '일반' });
  ok(a.ok && a.itemized && items().length === 2 && items()[0].qty === 2 && items()[0].unitGross === 35 && M.__inv__().at(-1)[M.INVOICE_COL['총금액(€)']] === 130,
    '보드 버튼(품목 없음) → 2줄 분할 · 총액 130', [a, items()]);
  ok(M.__sync__() === 0 && M.__inv__().at(-1)[M.INVOICE_COL['상품']] === '여권/비자', '자동 품목은 예약을 되돌려 쓰지 않는다(동기화 0회 · 상품명 그대로)', M.__sync__());
  M.__reset__([row305]);
  M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '예약', items: [{ description: '여권/비자', qty: 1, unitGross: 130 }] });
  ok(items().length === 2, '어드민 기본값 한 줄(상품명 × 1 = 총액) → 분할', items());
  M.__reset__([row305]);
  M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '예약', items: [{ description: '여권/비자 | 인원 4명 | 국가 구성 2개/2개/1개/1개', qty: 1, unitGross: 130 }] });
  ok(items().length === 2, '어드민 계산기 한 줄("상품 | 인원 N명 | …") → 분할', items());
  M.__reset__([row305]);
  const own = [{ description: 'Pass- und Visumfotos (Reisepass Korea + Aufenthaltstitel Deutschland), pro Person', qty: 2, unitGross: 35 }, { description: 'Visumfotos (Aufenthaltstitel Deutschland), pro Person', qty: 2, unitGross: 30 }];
  M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '수기', items: own });
  ok(JSON.stringify(items().map((i) => [i.description, i.qty, i.unitGross])) === JSON.stringify(own.map((i) => [i.description, i.qty, i.unitGross])), '사람이 나눈 품목은 그대로', items());
  M.__reset__([row305]);
  M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '셀렉추가금', items: [{ description: '추가 보정 2장', qty: 1, unitGross: 30 }] });
  ok(items().length === 1 && items()[0].description === '추가 보정 2장', '셀렉추가금은 그대로', items());
  M.__reset__([row305]);
  const c = M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '일반', customAmount: 50 });
  ok(!c.itemized && items().length === 0, '금액 지정(customAmount) 발행은 분할 안 함', [c, items()]);
  M.__reset__([row305]);
  const n = M._createInvoiceRecordCore_({ bookingRowIndex: 2, type: '일반', itemize: false });
  ok(!n.itemized, 'itemize:false 면 종전 한 줄', n);
}

// ── 5) 할인(음수) 줄 1센트 표류 수리 — 저장된 브루토가 정본 ─────────────────────────────
{
  const d = M.normalizeInvoiceItemForStorage_({ description: 'Rabatt', qty: 1, unitGross: -16, isDiscount: true }, 'brutto');
  ok(M.getInvoiceItemUnitGross_(d) === -16, '할인 −16.00 저장 후 브루토 −16.00(전엔 −16.01)', [d, M.getInvoiceItemUnitGross_(d)]);
  const items = [M.normalizeInvoiceItemForStorage_({ description: 'Passfoto/Visum (Deutschland), pro Person', qty: 5, unitGross: 32 }, 'brutto'), d];
  ok(M.getInvoiceGrossTotalForOutput_({ items }) === 144, '5×32 − 16 = PDF Endbetrag 144.00(전엔 143.99)', M.getInvoiceGrossTotalForOutput_({ items }));
  ok(/if\(unitGross!==0\|\|!hasNet\) return unitGross;/.test(adminHtml), '어드민 invoiceItemUnitGross 도 같은 규칙');
  // XRechnung(어드민 내보내기) — 진짜 AdminV2 함수를 떼어 돌린다: 단가 음수 금지(BR-27) · 줄 순액 합 = 헤더 순액(BR-CO-10)
  const grab = (name) => { const i = adminHtml.indexOf('function ' + name + '('); if (i < 0) throw new Error('AdminV2 에 ' + name + ' 없음');
    let k = adminHtml.indexOf('{', i), d = 0; for (; k < adminHtml.length; k++) { if (adminHtml[k] === '{') d++; else if (adminHtml[k] === '}' && !--d) break; } return adminHtml.slice(i, k + 1); };
  const xr = new Function(`const INVOICE_VAT_MULTIPLIER=1.19;function getInvoicePriceInputMode(){return 'brutto';}function escapeXmlText(s){return String(s);}
    function findReferencedInvoiceForCreditNote(){return null;}function addDaysToIsoDate(d){return d;}const STUDIO_BUSINESS_INFO={iban:'',name:'',bic:''};
    function ensureXRechnungExportReady(inv){return {buyerReference:'R',items:inv.items.map(item=>({description:item.description,qty:item.qty,unitGross:invoiceItemUnitGross(item),unitNet:invoiceItemUnitNet(item)}))};}
    ${['adminMoneyValue', 'roundInvoiceMoney', 'getInvoiceItemPriceMode', 'hasInvoiceItemUnitNet', 'invoiceItemQty', 'invoiceItemUnitGross', 'invoiceItemUnitNet', 'buildXRechnungCreditNoteXml', 'buildXRechnungInvoiceXml'].map(grab).join('\n')}
    return {buildXRechnungCreditNoteXml,buildXRechnungInvoiceXml};`)();
  const xItems = [M.normalizeInvoiceItemForStorage_({ description: 'Profilfotos Business – Grundpreis', qty: 1, unitGross: 95 }, 'brutto'),
    M.normalizeInvoiceItemForStorage_({ description: 'Passfoto/Visum (Kombi), pro Person', qty: 3, unitGross: 30 }, 'brutto'),
    M.normalizeInvoiceItemForStorage_({ description: 'Stammkundenrabatt (10 %)', qty: 1, unitGross: -9.5, isDiscount: true }, 'brutto')];
  const xInv = { issuedAt: '2026-10-08', number: 'STMIN-T', product: '프로필 Business', total: 175.5, refund: 100, items: xItems };
  // 김종덕(row309) 법인 여권 110 전액 환불 — 줄 순액 58.82+33.61=92.43 ≠ 110/1.19=92.44: 헤더를 총액에서 따로 계산하면 BR-CO-10 위반
  const xRefund = { issuedAt: '2026-10-08', number: 'STMIN-R', type: '취소/환불', total: 110, refund: 110, items: [
    M.normalizeInvoiceItemForStorage_({ description: 'Passfoto/Visum (Korea + Deutschland), pro Person', qty: 2, unitGross: 35 }, 'brutto'),
    M.normalizeInvoiceItemForStorage_({ description: 'Passfoto/Visum (Korea + Deutschland + USA), pro Person', qty: 1, unitGross: 40 }, 'brutto'),
  ] };
  for (const [kind, xml, n] of [['Invoice', xr.buildXRechnungInvoiceXml(xInv, {}), 3], ['CreditNote', xr.buildXRechnungCreditNoteXml({ ...xInv, type: '취소/환불' }, {}), 3],
    ['CreditNote', xr.buildXRechnungCreditNoteXml(xRefund, {}), 2]]) {
    const hdr = +xml.match(/<cac:LegalMonetaryTotal>\s*<cbc:LineExtensionAmount currencyID="EUR">([-\d.]+)/)[1];
    const lineNets = [...xml.matchAll(new RegExp(`<cac:${kind}Line>[\\s\\S]*?<cbc:LineExtensionAmount currencyID="EUR">([-\\d.]+)`, 'g'))].map((m) => +m[1]);
    const prices = [...xml.matchAll(/<cbc:PriceAmount currencyID="EUR">([-\d.]+)/g)].map((m) => +m[1]);
    const qtys = [...xml.matchAll(/<cbc:(?:Invoiced|Credited)Quantity unitCode="C62">([-\d.]+)/g)].map((m) => +m[1]);
    ok(lineNets.length === n && prices.every((p) => p >= 0) && (n < 3 || qtys[2] < 0) && Math.abs(lineNets.reduce((a, b) => a + b, 0) - hdr) < 0.005,
      `XRechnung ${kind}: 할인 줄 음수 수량·양수 단가, 줄 합 = 헤더`, { hdr, lineNets, prices, qtys });
  }
  ok(/inv\.product \|\|\s*row\[BOOKING_COL\['상품'\]\] \|\|\s*firstItem\.description/.test(gs), '예약 동기화: 첫 줄 문구보다 상품명이 먼저');
}

if (fail) { console.error(`\n✗ 인보이스 품목 분할 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 인보이스 품목 분할 — 여권 국가 구성·가족할인·법인·창구, 프로필/스튜디오/스냅 옵션·인원·토요일·콤보·급행·할인, 굿샤인, 수기 차이, 발행 경로 6종, 할인 줄 센트');
