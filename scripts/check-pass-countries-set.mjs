#!/usr/bin/env node
/**
 * check-pass-countries-set.mjs — 여권 국가 구성 편집(보드 '국가 변경', booking-pass-countries-set) 검사기
 *
 * 왜 필요한가(2026-10-06 사장님): 보드의 '국가 추가'는 한 그룹에 더하기만 해서 그날 두 건을 현장에서 못 고쳤다.
 *   김종덕 [1명:한국+독일, 1명:한국, 1명:한국] → 셋 다 독일 105€ 카드 → 한 명 미국 +5€ 다른 카드
 *   정진호 [4명:한국+독일] → 2명 독일만 · 2명 한국+독일 = 140→130€
 *   새 액션은 돈을 움직인다 — ① 엔진 차액(±)만 더해 수기 할인 보존 ② 완납 뒤 증가는 받은 돈을 원래 날짜·수단의
 *   [부분수납] 줄로 되돌려 차액만 받을 돈으로 ③ 받은 돈 아래로는 거부 ④ 마감대조가 두 번의 카드 수납을 각각 센다.
 *   이 넷 중 하나라도 깨지면 현장에서 덜/더 받거나 일마감이 어긋난다.
 *
 * 어떻게: Code.gs 를 GAS 스텁 + 메모리 시트와 함께 통째로 로드해 진짜 setPassCountriesForAgent_·calculateQuote_·
 *   confirmBookingBalanceAdmin·_partialBalanceReceiptsFromMemo_·buildTodayBoard_ 의 dueOnSite 공식을 돌린다.
 *   여권 1인 €30 은 라이브에선 '상품설정' 시트가 정본이라 여기선 시나리오 입력, 기대 금액은 사업 사실로 고정.
 * 사용법:  node scripts/check-pass-countries-set.mjs       (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const appSwift = readFileSync(join(ROOT, '..', 'dashboard', 'mac', 'src', 'TodayBoardApp.swift'), 'utf8');

const fmt = (d, tz, p) => {
  const q = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return p.replace('yyyy', q.year).replace('MM', q.month).replace('dd', q.day).replace('HH', q.hour).replace('mm', q.minute).replace('ss', q.second);
};
const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁`); } });
let LOCKS = 0;
Object.assign(globalThis, {
  Utilities: { formatDate: fmt, sleep() {} }, SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'),
  CalendarApp: nope('CalendarApp'), MailApp: nope('MailApp'), GmailApp: nope('GmailApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => { LOCKS++; return true; }, releaseLock() { LOCKS--; } }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});
const dir = mkdtempSync(join(tmpdir(), 'passset-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${gs}
function getProductById_(id){ return {id:'pass',g:'pass',t:'passport',p:30,d:15,prep:0,nameKo:'여권/비자'}; }
function getSettingsMap_(){ return {}; }
function assertAdmin_(){}
function invalidateTodayBoardCache_(){}
var __ROWS__={};
function getDbSheet(){ return { getLastRow:function(){return 999;},
  getRange:function(r,c,nr,nc){ return {
    getValues:function(){ return [nc?__ROWS__[r].slice(c-1,c-1+nc):[__ROWS__[r][c-1]]]; },
    setValue:function(v){ __ROWS__[r][c-1]=v; } }; } }; }
function __setRow__(r,cells){ const row=new Array(CONFIG.BOOKING_HEADERS.length).fill('');
  Object.keys(cells).forEach(function(k){ row[BOOKING_COL[k]]=cells[k]; }); __ROWS__[r]=row; }
function __get__(r,k){ return __ROWS__[r][BOOKING_COL[k]]; }
var __DAY__=[];
function ensureSheets_(){ return { bookingSheet:{ getLastRow:function(){return __DAY__.length+1;},
  getRange:function(r,c,n,w){ return { getValues:function(){ return __DAY__.map(function(i){return __ROWS__[i].slice(0,w);}); } }; } } }; }
function __dayRows__(list){ __DAY__=list; }
module.exports={setPassCountriesForAgent_,correctBookingBalancePaidForAgent_,confirmBookingBalanceAdmin,_partialBalanceReceiptsFromMemo_,buildDayClose_,__setRow__,__get__,__dayRows__};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};
const TODAY = fmt(new Date(), '', 'yyyy-MM-dd');
const YESTERDAY = fmt(new Date(Date.now() - 86400000), '', 'yyyy-MM-dd');
/** 그날 일마감(buildDayClose_)에서 이 행의 ① 받을 예정·② 수납 기록 */
const dayClose = (r, day = TODAY) => { M.__dayRows__([r]); const d = M.buildDayClose_(day);
  return { expected: d.expected.map((e) => e.amount), ledger: d.ledger.map((l) => [l.amount, l.payMethod]) }; };
const throws = (fn, re, label) => { try { fn(); ok(false, label, '예외 없음'); } catch (e) { ok(re.test(e.message), label, e.message); } };
const set = (r, name, perPerson, extra = {}) => M.setPassCountriesForAgent_('t', { rowIndex: r, expectName: name, perPerson, ...extra });
const memo = (r) => String(M.__get__(r, '요청사항'));
const num = (v) => Number(String(v).split('|')[0]) || 0;
/** 보드 dueOnSite 와 같은 공식(buildTodayBoard_) — 완납이면 0, 아니면 잔금−부분누적(+미입금 계약금) */
const due = (r) => (String(M.__get__(r, '잔금결제여부')) === 'Y' ? 0
  : Math.max(0, num(M.__get__(r, '잔금')) - num(M.__get__(r, '잔금결제금액'))) + (String(M.__get__(r, '계약금입금여부')) === 'Y' ? 0 : num(M.__get__(r, '계약금'))));

// ── 1) 김종덕 — 셋 다 독일 → 105 카드 → 한 명 미국 +5 → 다른 카드 5 ─────────────────
{
  M.__setRow__(309, { '고객명': 'JONGDEOK KIM', '촬영종류': 'pass', '상품': '여권/비자', '인원': 3, '상태': '확정됨',
    '예약일시': `${TODAY} 16:45`, '총결제액': 95, '잔금': 95, '결제수단': '미결제', '사업자송장필요': true,
    '요청사항': '[국가별 신청] 1명:한국+독일, 1명:한국, 1명:한국\n[현장추가 10-06 17:24] 국가 +독일 · +5€ → 총 95€' });
  const look = M.setPassCountriesForAgent_('t', { rowIndex: 309, expectName: 'JONGDEOK KIM' });
  ok(look.dryRun && JSON.stringify(look.perPerson) === '[["KR","DE"],["KR"],["KR"]]', 'perPerson 없이 부르면 현재 구성만(쓰기 없음)', look);
  const a = set(309, 'JONGDEOK KIM', [['KR', 'DE'], ['KR', 'DE'], ['KR', 'DE']], { expectTotal: 95 });
  ok(a.changed && a.delta === 10 && a.total === 105 && num(M.__get__(309, '총결제액')) === 105 && num(M.__get__(309, '잔금')) === 105,
    '셋 다 독일: 95 → 105(+10, 엔진 차액)', a);
  ok(/\[국가별 신청\] 3명:한국\+독일/.test(memo(309)), '토큰 = 3명:한국+독일', memo(309));
  ok(/\[현장추가 [^\]]+\] 국가 변경 1명:한국\+독일, 1명:한국, 1명:한국 → 3명:한국\+독일 · \+10€ → 총 105€/.test(memo(309)), '감사줄(전→후·차액)', memo(309));
  ok(due(309) === 105, '보드 받을 돈 105', due(309));
  M.confirmBookingBalanceAdmin('t', 309, { amount: 105, payMethod: '카드', paidDate: TODAY });
  ok(M.__get__(309, '잔금결제여부') === 'Y' && due(309) === 0, '105 카드 수납 → 완납', [M.__get__(309, '잔금결제여부'), due(309)]);
  const b = set(309, 'JONGDEOK KIM', [['KR', 'DE'], ['KR', 'DE'], ['KR', 'DE', 'US']], { expectTotal: 105 });
  ok(b.delta === 5 && b.total === 110 && b.reopened && b.due === 5, '완납 뒤 미국 추가: 110, 차액 5 받을 돈', b);
  ok(M.__get__(309, '잔금결제여부') === '' && num(M.__get__(309, '잔금결제금액')) === 105 && M.__get__(309, '결제수단') === '미결제',
    '완납 → 부분수납 105(플래그 비움 · 수단 미결제)', [M.__get__(309, '잔금결제여부'), M.__get__(309, '잔금결제금액'), M.__get__(309, '결제수단')]);
  ok(new RegExp(`\\[부분수납 ${TODAY}\\] 105€ 카드 \\(누적 105 \\/ 잔금 110€\\)`).test(memo(309)), '받은 105 는 원래 날짜·수단의 [부분수납] 줄로', memo(309));
  ok(due(309) === 5, '보드 받을 돈 = 5', due(309));
  ok(JSON.stringify(dayClose(309).expected) === '[5]', "일마감 '받을 예정' = 5(이미 받은 105 는 미수 아님)", dayClose(309));
  ok(/2명:한국\+독일, 1명:한국\+독일\+미국/.test(memo(309)), '토큰 = 2명:한국+독일, 1명:한국+독일+미국', memo(309));
  const again = set(309, 'JONGDEOK KIM', [['KR', 'DE'], ['KR', 'DE'], ['KR', 'DE', 'US']]);
  ok(!again.changed && num(M.__get__(309, '총결제액')) === 110, '같은 구성 재전송(더블탭) → 변화 없음', again);
  M.confirmBookingBalanceAdmin('t', 309, { amount: 5, payMethod: '카드', paidDate: TODAY });
  ok(M.__get__(309, '잔금결제여부') === 'Y' && num(M.__get__(309, '잔금결제금액')) === 110 && due(309) === 0, '다른 카드 5 → 완납 110', [M.__get__(309, '잔금결제금액')]);
  // 마감대조(buildDayClose_)와 같은 셈: 부분수납 줄 + 완납일엔 누적−회차합
  const parts = M._partialBalanceReceiptsFromMemo_(memo(309));
  const completion = num(M.__get__(309, '잔금결제금액')) - parts.reduce((s, p) => s + p.amount, 0);
  ok(parts.length === 1 && parts[0].amount === 105 && parts[0].method === '카드' && parts[0].date === TODAY && completion === 5,
    '부분수납 줄: 카드 105 · 완납 회차 5', { parts, completion });
  ok(JSON.stringify(dayClose(309)) === '{"expected":[],"ledger":[[105,"카드"],[5,"카드"]]}', '일마감(진짜 buildDayClose_): 카드 105 + 카드 5', dayClose(309));
  // 두 번째 되돌림(+일본) — 되돌림 줄은 아직 줄로 안 적힌 몫(5)만. 누적 전체(110)를 다시 적으면 일마감이 두 번 센다
  const c = set(309, 'JONGDEOK KIM', [['KR', 'DE'], ['KR', 'DE'], ['KR', 'DE', 'JP', 'US']], { expectTotal: 110 });
  ok(c.reopened && c.due === 5 && new RegExp(`\\[부분수납 ${TODAY}\\] 5€ 카드 \\(누적 110 \\/ 잔금 115€\\)`).test(memo(309)), '두 번째 되돌림 줄 = 5(누적 110 − 기존 줄 105)', memo(309));
  M.confirmBookingBalanceAdmin('t', 309, { amount: 5, payMethod: '카드', paidDate: TODAY });
  const dc = dayClose(309);
  ok(dc.ledger.reduce((a, l) => a + l[0], 0) === 115 && dc.ledger.length === 3, '일마감 합 = 실수령 115(105+5+5)', dc);
  throws(() => set(309, 'JONGDEOK KIM', [['DE'], ['DE'], ['DE']]), /이미 받은 금액\(115€\) 아래로/, '받은 돈(115) 아래로 줄이기 → 거부(환불 경로)');
  ok(LOCKS === 0, '잠금 해제(예외 경로 포함)', LOCKS);
}

// ── 2) 정진호 — 2명 독일만 · 2명 한국+독일 (140→130, 수납 전) ───────────────────
{
  M.__setRow__(305, { '고객명': '정진호', '촬영종류': 'pass', '상품': '여권/비자', '인원': 4, '상태': '확정됨',
    '예약일시': '2026-10-06 17:15', '총결제액': 140, '잔금': 140, '결제수단': '미결제',
    '요청사항': '[국가별 신청] 4명:한국+독일\n자녀 2명 여권 갱신용 사진 필요하며 추가로 가족4명 모두 독일 체류비자 연장용 사진 필요합니다.' });
  const r = set(305, '정진호', [['KR', 'DE'], ['KR', 'DE'], ['DE'], ['DE']], { expectTotal: 140 });
  ok(r.delta === -10 && r.total === 130 && num(M.__get__(305, '잔금')) === 130 && due(305) === 130, '140 → 130(−10)', r);
  ok(/\[국가별 신청\] 2명:한국\+독일, 2명:독일\n자녀 2명/.test(memo(305)), '토큰 교체 · 고객 원문 메모 보존', memo(305));
  ok(/ · -10€ → 총 130€/.test(memo(305)), '감소 감사줄', memo(305));
  throws(() => set(305, '정진호', [['DE'], ['DE'], ['DE'], ['DE']], { expectTotal: 140 }), /장부 금액이 바뀌었습니다/, '화면 총액(expectTotal)이 옛 값 → 거부');
  throws(() => set(305, '정진호', [['DE'], ['DE'], ['DE']]), /예약 인원\(4명\)과 다릅니다/, '사람 수 ≠ 인원 → 거부(인원은 상품·인원 창)');
  throws(() => set(305, '정진호', [['DE'], [], ['DE'], ['DE']]), /2번째 사람의 국가가 비었습니다/, '국가 없는 사람 → 거부');
  throws(() => set(305, '홍길동', [['DE'], ['DE'], ['DE'], ['DE']]), /고객명 불일치/, '행 고객명 불일치 → 거부');
  const before = JSON.stringify([M.__get__(305, '총결제액'), memo(305)]);
  const d = set(305, '정진호', [['DE'], ['DE'], ['DE'], ['DE']], { dryRun: true });
  ok(d.dryRun && d.total === 120 && JSON.stringify([M.__get__(305, '총결제액'), memo(305)]) === before, 'dryRun → 계산만, 쓰기 없음', d);
}

// ── 3) 5인 가족할인·법인 제외는 엔진이 정한다(산술 ×5 아님) ───────────────────────
{
  const mk = (r, biz) => M.__setRow__(r, { '고객명': 'F' + r, '촬영종류': 'pass', '인원': 5, '상태': '확정됨', '예약일시': '2026-10-06 10:00',
    '총결제액': biz ? 150 : 135, '잔금': biz ? 150 : 135, '결제수단': '미결제', '사업자송장필요': biz, '요청사항': '[국가별 신청] 5명:독일' });
  mk(401, false); mk(402, true);
  const five = [['DE', 'KR'], ['DE'], ['DE'], ['DE'], ['DE']];
  ok(set(401, 'F401', five).delta === 4.5, '5인 가족: +한국 1명 = +4.50(10% 할인 반영)');
  ok(set(402, 'F402', five).delta === 5, '5인 법인 송장: 할인 없음 +5');
}

// ── 4) 수기 할인 보존 · 창구 등록(옵션 국가 수) · 표기 보존 · 계약금 합산 ──────────────
{
  M.__setRow__(410, { '고객명': 'D', '촬영종류': 'pass', '인원': 3, '상태': '확정됨', '예약일시': '2026-10-06 10:00',
    '총결제액': 100, '잔금': '100|CARD|2026-10-01', '결제수단': '미결제', '요청사항': '[국가별 신청] 3명:한국+독일\n[금액정정 2026-10-01] 105→100€' });
  const r = set(410, 'D', [['KR', 'DE'], ['KR', 'DE'], ['KR', 'DE', 'US']]);
  ok(r.total === 105 && String(M.__get__(410, '잔금')) === '105|CARD|2026-10-01', '수기 할인(−5) 보존: 100+5 = 105 · 잔금 꼬리 보존', [r.total, M.__get__(410, '잔금')]);

  M.__setRow__(411, { '고객명': 'O', '촬영종류': 'pass', '인원': 2, '상태': '확정됨', '예약일시': '2026-10-06 10:00',
    '총결제액': 70, '잔금': 70, '옵션': '국가 2개/인, 인화', '결제수단': '미결제', '요청사항': '' });
  const o = set(411, 'O', [['KR', 'DE'], ['KR', 'DE']]);
  ok(o.fromOption && o.changed && o.delta === 0 && /\[국가별 신청\] 2명:한국\+독일/.test(memo(411)) && M.__get__(411, '옵션') === '국가 2개/인, 인화',
    '창구 등록(국가 2개/인) → 실제 국가명 기록, 금액 그대로, 옵션 보존', [o, memo(411), M.__get__(411, '옵션')]);

  M.__setRow__(412, { '고객명': 'V', '촬영종류': 'pass', '인원': 2, '상태': '확정됨', '예약일시': '2026-10-06 10:00',
    '총결제액': 60, '잔금': 60, '결제수단': '미결제', '요청사항': '[국가별 신청] 1명:베트남, 1명:독일' });
  set(412, 'V', [['OTHER', 'DE'], ['DE']]);
  ok(/\[국가별 신청\] 1명:베트남\+독일, 1명:독일/.test(memo(412)), "목록 밖 국가 표기('베트남') 보존", memo(412));

  M.__setRow__(413, { '고객명': 'P', '촬영종류': 'pass', '인원': 4, '상태': '확정됨', '예약일시': '2026-10-06 10:00',
    '총결제액': 140, '계약금': 50, '잔금': 90, '결제수단': '미결제', '요청사항': '[국가별 신청] 4명:한국+독일' });
  const p = set(413, 'P', [['DE'], ['DE'], ['DE'], ['KR', 'DE']]);
  ok(p.total === 125 && num(M.__get__(413, '계약금')) === 50 && num(M.__get__(413, '잔금')) === 75 && due(413) === 125,
    '총액 125(>100) → 미입금 계약금 50 유지 · 잔금 75 · 받을 돈 125', [p.total, M.__get__(413, '계약금'), M.__get__(413, '잔금')]);
  M.__setRow__(414, { '고객명': 'Q', '촬영종류': 'pass', '인원': 3, '상태': '확정됨', '예약일시': '2026-10-06 10:00',
    '총결제액': 105, '계약금': 50, '잔금': 55, '결제수단': '미결제', '요청사항': '[국가별 신청] 3명:한국+독일' });
  const q = set(414, 'Q', [['DE'], ['DE'], ['DE']]);
  ok(q.total === 90 && num(M.__get__(414, '계약금')) === 0 && num(M.__get__(414, '잔금')) === 90 && due(414) === 90,
    '총액 90(≤100) → 미입금 계약금 잔금에 합산(계약금 0 · 잔금 90)', [q.total, M.__get__(414, '계약금'), M.__get__(414, '잔금')]);
}

// ── 4b) 되돌림의 날짜 — 지난 날 완납은 거부(매출 날짜가 옮겨진다) · 어제 부분수납 + 오늘 완납은 오늘 몫만 ──────
{
  M.__setRow__(420, { '고객명': 'R', '촬영종류': 'pass', '인원': 1, '상태': '촬영완료', '예약일시': `${YESTERDAY} 10:00`,
    '총결제액': 30, '잔금': 30, '결제수단': '현금', '잔금결제여부': 'Y', '잔금입금일': YESTERDAY, '요청사항': '[국가별 신청] 1명:독일' });
  throws(() => set(420, 'R', [['KR', 'DE']]), /지난 날\(.+\) 수납이 끝난 예약은/, '지난 날 완납 뒤 증가 → 거부(어드민 추가청구)');
  ok(set(420, 'R', [['US']]).delta === 0 && M.__get__(420, '잔금결제여부') === 'Y', '지난 날 완납이라도 금액이 그대로인 변경(독일→미국)은 허용 · 완납 유지');

  M.__setRow__(421, { '고객명': 'S', '촬영종류': 'pass', '인원': 3, '상태': '확정됨', '예약일시': `${TODAY} 10:00`,
    '총결제액': 105, '잔금': 105, '결제수단': '카드', '잔금결제여부': 'Y', '잔금결제금액': 105, '잔금입금일': TODAY,
    '요청사항': `[국가별 신청] 3명:한국+독일\n[부분수납 ${YESTERDAY}] 50€ 현금 (누적 50 / 잔금 105€)` });
  const r = set(421, 'S', [['KR', 'DE'], ['KR', 'DE'], ['KR', 'DE', 'US']]);
  const lines = M._partialBalanceReceiptsFromMemo_(memo(421));
  ok(r.reopened && lines.length === 2 && lines[1].amount === 55 && lines[1].method === '카드' && lines[1].date === TODAY
     && lines.reduce((a, p) => a + p.amount, 0) === 105, '어제 현금 50 + 오늘 카드 55 완납 → 되돌림 줄은 오늘 카드 55 만(합 105 = 실수령)', lines);
}

// ── 4c) 기준 구성 = 총액을 매긴 상속 · 목록 밖 국가 여러 개 ──────────────────────────
{
  // 어드민 모달이 인원 4→5 로 늘리며 상속 가격(5×35 −10% = 157.50)을 냈지만 토큰은 4명 그대로인 행
  M.__setRow__(430, { '고객명': 'H', '촬영종류': 'pass', '인원': 5, '상태': '확정됨', '예약일시': `${TODAY} 10:00`,
    '총결제액': 157.5, '잔금': 157.5, '결제수단': '미결제', '요청사항': '[국가별 신청] 4명:한국+독일' });
  const look = M.setPassCountriesForAgent_('t', { rowIndex: 430, expectName: 'H' });
  ok(JSON.stringify(look.perPerson) === JSON.stringify(Array(5).fill(['KR', 'DE'])), '늘어난 5번째도 상속 구성(한국+독일)으로 보인다', look.perPerson);
  const same = set(430, 'H', Array(5).fill(['KR', 'DE']));
  ok(!same.changed && num(M.__get__(430, '총결제액')) === 157.5, '실제 구성(전원 한국+독일)을 확인만 → 금액 그대로(이중 청구 없음)', same);
  ok(set(430, 'H', [['KR', 'DE'], ['KR', 'DE'], ['KR', 'DE'], ['KR', 'DE'], ['DE']]).total === 153, '5번째 독일만 → −4.50 = 153');

  M.__setRow__(431, { '고객명': 'T', '촬영종류': 'pass', '인원': 2, '상태': '확정됨', '예약일시': `${TODAY} 10:00`,
    '총결제액': 65, '잔금': 65, '결제수단': '미결제', '요청사항': '[국가별 신청] 1명:베트남+태국, 1명:독일' });
  const t = set(431, 'T', [['OTHER', 'OTHER'], ['DE', 'US']]);
  ok(t.delta === 5 && t.total === 70 && /\[국가별 신청\] 1명:베트남\+태국, 1명:독일\+미국/.test(memo(431)),
    '베트남+태국(목록 밖 두 나라) 유지 · 2번에 미국 +5 = 70', [t, memo(431)]);
}

// ── 4d) 팁 분리 — 완납 행의 받은 잔금 정정(booking-balance-paid-correct) ─────────────────────────
{
  // 김민상 10/6: 여권 35 + 팁 5 = 카드 40 을 보드가 40 으로 기록. 팁은 같은 이름의 Trinkgeld 행(최새진 7/11 선례)
  M.__setRow__(440, { '고객명': '김민상', '촬영종류': 'pass', '인원': 1, '상태': '작업완료', '예약일시': `${TODAY} 09:30`,
    '총결제액': 35, '잔금': 35, '결제수단': '카드', '잔금결제여부': 'Y', '잔금결제금액': 40, '잔금입금일': TODAY, '요청사항': '[국가별 신청] 1명:독일+한국' });
  M.__setRow__(441, { '고객명': '김민상', '촬영종류': 'other', '상품': 'Trinkgeld (카드결제 팁)', '인원': 1, '상태': '작업완료', '예약일시': `${TODAY} 09:30`,
    '총결제액': 5, '잔금': 5, '결제수단': '카드', '잔금결제여부': 'Y', '잔금결제금액': 5, '잔금입금일': TODAY, '요청사항': '행440 결제 시 팁' });
  const sumDay = () => { M.__dayRows__([440, 441]); return M.buildDayClose_(TODAY).ledger.reduce((a, l) => a + l.amount, 0); };
  ok(sumDay() === 45, '정정 전: 일마감 45(원래 행 40 + 팁 행 5) — SumUp 40 과 어긋남', sumDay());
  const fix = (extra) => M.correctBookingBalancePaidForAgent_('t', { rowIndex: 440, expectName: '김민상', amount: 35, reason: '카드 40 중 5 는 팁', ...extra });
  throws(() => fix({ reason: '' }), /reason/, '사유 없으면 거부');
  throws(() => fix({ amount: 30 }), /받을 잔금\(35€\) 아래로는/, '받을 잔금 아래로는 거부');
  throws(() => M.correctBookingBalancePaidForAgent_('t', { rowIndex: 440, expectName: '홍길동', amount: 35, reason: 'x' }), /고객명 불일치/, '고객명 불일치 거부');
  const r = fix();
  ok(r.changed && num(M.__get__(440, '잔금결제금액')) === 35 && M.__get__(440, '잔금결제여부') === 'Y' && M.__get__(440, '잔금입금일') === TODAY && M.__get__(440, '결제수단') === '카드',
    '받은 잔금 40→35 · 완납·수납일·수단 그대로', r);
  ok(/\[금액정정 [^\]]+\] 받은 잔금 40→35€ 사유: 카드 40 중 5 는 팁 \(agent\)/.test(memo(440)), '감사줄 [금액정정]', memo(440));
  ok(sumDay() === 40, '정정 후: 일마감 35 + 팁 5 = 40 = SumUp', sumDay());
  ok(!fix().changed, '같은 값 재실행 → 변화 없음');
  M.__setRow__(442, { '고객명': 'U', '촬영종류': 'pass', '인원': 1, '상태': '확정됨', '예약일시': `${TODAY} 10:00`, '총결제액': 30, '잔금': 30, '결제수단': '미결제' });
  throws(() => M.correctBookingBalancePaidForAgent_('t', { rowIndex: 442, expectName: 'U', amount: 30, reason: 'x' }), /완납\(잔금결제여부 Y\) 예약만/, '완납 전 행은 거부');
}

// ── 5) 앱 배선 — 보드 '국가 변경' 창이 새 액션을 쓰고, 정시 종료가 예정 종료 시각을 보낸다 ─────
{
  ok(/"booking-pass-countries-set"/.test(appSwift), "앱이 booking-pass-countries-set 호출");
  ok(/case [^\n]*passCountries/.test(appSwift), '앱이 보드 응답의 passCountries 를 디코딩');
  ok(/endShoot\(row: shoot\.rowIndex, at: /.test(appSwift), '정시 종료 = 예정 종료 시각으로 endShoot');
  ok(/\bpassCountries:String\(row\[BOOKING_COL\['촬영종류'\]\]/.test(gs), '서버 보드 응답에 passCountries');
  const boardGs = readFileSync(join(ROOT, 'appscript-board', 'Board.gs'), 'utf8');
  ok(/\bpassCountries:String\(row\[BOOKING_COL\['촬영종류'\]\]/.test(boardGs), 'board-api(Board.gs) 재생성됨 — 앱은 board-api 를 먼저 읽는다(node scripts/build-board-api.mjs)');
  ok(/fetchPassCountries\(/.test(appSwift), '보드 응답에 구성이 없으면 창이 서버에서 현재 구성을 받아 온다(빈칸 시작 금지)');
}

if (fail) { console.error(`\n✗ 여권 국가 구성 편집 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 여권 국가 구성 편집 — 엔진 차액(±)·수기할인 보존·완납 뒤 증가는 부분수납으로 되돌림·받은 돈 아래 거부·일마감 회차·표기 보존');
