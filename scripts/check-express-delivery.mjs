#!/usr/bin/env node
/**
 * check-express-delivery.mjs — 사진 전달 예정일 + 급행(유료) 검사기
 *
 * 왜 필요한가(2026-09-29 사장님 결정): 촬영 전 고객에게 원본·보정 날짜를 구체적으로 안내하고,
 *   급행(원본 3일·보정 3일, 상품가 20%)을 예약 때·셀렉 때 모두 판다. 돈이 걸린 기능이라
 *   ① 화면 금액 = 청구 금액 ② 할인이 급행비를 깎지 않음 ③ 두 번 팔지 않음 ④ 판 급행이 저장·수정·발행에서
 *   조용히 빠지지 않음 ⑤ 날짜가 휴무일(일·월·공휴일)을 피함 — 이 다섯 가지가 깨지면 사고다.
 *
 * 어떻게: Code.gs 전체를 GAS 스텁과 함께 로드해 **진짜 함수**(calculateQuote_·buildDeliveryEstimate_·
 *   getSelectExpressInfo_·computeSelectExpressAmt_·parseBookingOptionKeysFromText_ …)를 실행한다.
 *   화면(booking.js·select.js·AdminV2.html)은 같은 규칙을 쓰는지 소스 구조로 대조한다.
 *
 * 사용법:  node scripts/check-express-delivery.mjs       (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const bookingJs = readFileSync(join(ROOT, 'frontend', 'booking', 'booking.js'), 'utf8');
const selectJs = readFileSync(join(ROOT, 'frontend', 'select', 'v2', 'select.js'), 'utf8');
const adminHtml = readFileSync(join(ROOT, 'appscript', 'AdminV2.html'), 'utf8');

const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁 — 닿으면 안 되는 경로`); } });
const fmt = (d, tz, p) => {
  const q = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return p.replace('yyyy', q.year).replace('MM', q.month).replace('dd', q.day).replace('HH', q.hour).replace('mm', q.minute).replace('ss', q.second);
};
Object.assign(globalThis, {
  Utilities: { formatDate: fmt }, SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'),
  CalendarApp: nope('CalendarApp'), MailApp: nope('MailApp'), GmailApp: nope('GmailApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});
const dir = mkdtempSync(join(tmpdir(), 'expr-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${gs}
var __SETTINGS__={return_discount:'10'};
const __P__={
  sb:{id:'sb',g:'stud',t:'group',p:170,d:30,prep:0,nameKo:'스튜디오 Basic'},
  pb:{id:'pb',g:'prof',t:'single',p:55,d:15,prep:0,nameKo:'프로필 Basic'},
  sn:{id:'sn',g:'snap',t:'snap',p:150,d:60,prep:0,nameKo:'야외 스냅'},
  pw:{id:'pw',g:'wed',t:'wedding',p:650,d:240,prep:0,nameKo:'프리웨딩 Plus'},
  pass:{id:'pass',g:'pass',t:'passport',p:30,d:15,prep:0,nameKo:'여권/비자'},
  mrt1:{id:'mrt1',g:'snap',t:'snap',p:120,d:60,prep:0,nameKo:'마이리얼트립 스냅'},
  tfp:{id:'tfp',g:'stud',t:'group',p:0,d:30,prep:0,nameKo:'포트폴리오 협업'}
};
function getProductById_(id){return __P__[id];}
function getCachedProducts_(){return Object.values(__P__);}
function getPromoProducts_(){return [];}
function getSettingsMap_(){return __SETTINGS__;}
function __setSettings__(o){__SETTINGS__=o;}
module.exports={calculateQuote_,buildDeliveryEstimate_,deliveryDueDate_,retouchDueFromSubmission_,getExpressFeeForItem_,getExpressRate_,
  getSelectExpressInfo_,computeSelectExpressAmt_,buildSelectExpressCell_,parseSelectExpressCell_,parseBookingOptionKeysFromText_,
  passCountriesFromOptionCell_,buildDeliveryEstimateHtml_,buildInvoicePricingOptionText_,parseBookingOptionKeysFromRow_,deliveryBaseYmd_,BOOKING_COL,SELECT_HEADERS,SELECT_COL,__setSettings__};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};
const q = (o) => M.calculateQuote_(o);

// ── 1) 엔진 금액 ─────────────────────────────────────────────────────────
{
  const base = q({ itemId: 'sb', people: 2, date: '2026-10-09' });
  const exp = q({ itemId: 'sb', people: 2, date: '2026-10-09', optionKeys: ['express'] });
  ok(base.totalPrice === 170 && base.expressFee === 0 && base.expressFeeOffer === 34, '스튜디오 Basic 170 · 급행 제안 34', [base.totalPrice, base.expressFeeOffer]);
  ok(exp.totalPrice === 204 && exp.expressFee === 34 && exp.optionKeys.includes('express'), '급행 → 204(+34, 상품가 20%)', [exp.totalPrice, exp.expressFee]);
  const ret = q({ itemId: 'sb', people: 2, date: '2026-10-09', optionKeys: ['express'], isReturn: true });
  ok(ret.totalPrice === 187, '재방문 10% 는 급행비를 깎지 않는다: 170−17+34 = 187', ret.totalPrice);
  const pb = q({ itemId: 'pb', people: 1, date: '2026-10-08', optionKeys: ['express'] });
  const invText = M.buildInvoicePricingOptionText_(exp, { people: 2 });
  ok(/급행 작업 \+34/.test(invText) && M.parseBookingOptionKeysFromText_(invText).includes('express'), '인보이스 품목 설명에 급행 → 예약 동기화가 되읽어도 급행 유지', invText);
  ok(pb.expressFee === 11 && pb.totalPrice === 66 && pb.depositAmount === 0, '프로필 55 → 급행 11, 합계 66(≤100 계약금 0)', [pb.expressFee, pb.totalPrice, pb.depositAmount]);
  const pw = q({ itemId: 'pw', people: 2, date: '2027-05-20', optionKeys: ['express'] });
  ok(pw.expressFee === 130, '프리웨딩 650 → 급행 130', pw.expressFee);
  ok(pw.depositAmount === Math.round(pw.totalPrice * 0.20 * 100) / 100, '웨딩 계약금 20% 는 급행 포함 총액 기준', [pw.totalPrice, pw.depositAmount]);
  for (const id of ['pass', 'mrt1', 'tfp']) {
    const r = q({ itemId: id, people: 1, date: '2026-10-09', optionKeys: ['express'] });
    ok(r.expressFee === 0 && !r.optionKeys.includes('express'), `${id}: 판매 대상 아님 → 급행 키 제거·요금 0`, [r.expressFee, r.optionKeys]);
  }
  const lab = q({ itemId: 'sb', people: 2, date: '2026-10-09', optionKeys: ['Express delivery', '급행 작업'] });
  ok(lab.expressFee === 0 && lab.optionKeys.length === 0, "라벨 문자열 키('Express delivery'·'급행 작업')는 요금 없는 급행 → 버린다", lab.optionKeys);
  const dup = q({ itemId: 'pass', people: 1, date: '2026-10-09', optionKeys: ['express', 'express'] });
  ok(!dup.optionKeys.includes('express'), "중복 'express' 도 대상 아닌 상품에서 전부 빠진다", dup.optionKeys);
  M.__setSettings__({ return_discount: '10', express_rate: '0' });
  ok(q({ itemId: 'sb', people: 2, date: '2026-10-09', optionKeys: ['express'] }).expressFee === 0, 'express_rate 0 → 판매 중지');
  M.__setSettings__({ return_discount: '10', express_rate: '' });
  ok(M.getExpressRate_() === 20, "express_rate 빈칸 → 20(빈칸이 0 으로 읽히는 함정 방지)", M.getExpressRate_());
  M.__setSettings__({ return_discount: '10', express_rate: '25' });
  ok(q({ itemId: 'sb', people: 2, date: '2026-10-09', optionKeys: ['express'] }).expressFee === 42.5, 'express_rate 25 → 170×25% = 42.5');
  M.__setSettings__({ return_discount: '10' });
}

// ── 2) 날짜 — 달력일, 일·월·공휴일이면 다음 영업일 ──────────────────────────
{
  const e = q({ itemId: 'sb', people: 2, date: '2026-10-09' }).deliveryEstimate;   // 금요일 촬영
  ok(e.originalBy === '2026-10-16' && e.retouchFrom === '2026-10-30' && e.retouchTo === '2026-11-06', '금 10/9 촬영 → 원본 10/16 · 보정 10/30~11/6', e);
  const x = q({ itemId: 'sb', people: 2, date: '2026-10-09', optionKeys: ['express'] }).deliveryEstimate;
  ok(x.originalBy === '2026-10-13' && x.retouchBy === '2026-10-16', '급행: 10/12(월 휴무) → 원본 10/13(화) · 보정 10/16', x);
  ok(M.deliveryDueDate_('2026-10-08', 3) === '2026-10-13', '목+3 = 일요일 → 월 휴무 → 화 10/13', M.deliveryDueDate_('2026-10-08', 3));
  ok(M.deliveryDueDate_('2026-09-30', 3) === '2026-10-06', '수+3 = 10/3(토, 독일 통일의 날) → 일·월 → 화 10/6', M.deliveryDueDate_('2026-09-30', 3));
  ok(M.deliveryDueDate_('2026-12-19', 7) === '2026-12-29', '토 12/19+7 = 12/26(토, 둘째 성탄절) → 12/29(화)', M.deliveryDueDate_('2026-12-19', 7));
  M.__setSettings__({ return_discount: '10', public_holiday_open_dates: '2026-10-03' });
  ok(M.deliveryDueDate_('2026-09-30', 3) === '2026-10-03', '공휴일 영업 예외(public_holiday_open_dates) 존중', M.deliveryDueDate_('2026-09-30', 3));
  M.__setSettings__({ return_discount: '10', custom_holidays: '2026-10-16' });
  ok(M.deliveryDueDate_('2026-10-09', 7) === '2026-10-16', '사장님 부재일(custom_holidays)은 편집 불가가 아닐 수 있어 반영 안 함', M.deliveryDueDate_('2026-10-09', 7));
  M.__setSettings__({ return_discount: '10' });
  ok(q({ itemId: 'pass', people: 1, date: '2026-10-09' }).deliveryEstimate === null, '여권은 전달 예정일 안내 없음(당일 전달)');
  const r = M.retouchDueFromSubmission_('2026-10-15', false), rx = M.retouchDueFromSubmission_('2026-10-15', true);
  ok(r.retouchFrom === '2026-10-29' && r.retouchTo === '2026-11-05' && rx.retouchBy === '2026-10-20', '셀렉 제출(목 10/15) → 보정 10/29~11/5 · 급행 10/18(일)→10/20(화)', [r, rx]);
}

// ── 3) 셀렉 급행 판매 규칙 ─────────────────────────────────────────────────
{
  const C = M.SELECT_COL;
  const row = (group, product, express) => {
    const r = new Array(M.SELECT_HEADERS.length).fill('');
    r[C['촬영종류']] = group; r[C['상품']] = product; r[C['급행']] = express || ''; r[C['예약장부행']] = '';
    return r;
  };
  const photos = [{ num: '0031', note: '' }];
  const i1 = M.getSelectExpressInfo_(row('stud', '스튜디오 Basic'), '');
  ok(i1.offer && i1.fee === 34 && !i1.boughtAtBooking, '셀렉: 스튜디오 → 급행 판매(34)', i1);
  ok(M.computeSelectExpressAmt_(i1, { express: true }, photos) === 34, '요청 + 보정 사진 있음 → 34');
  ok(M.computeSelectExpressAmt_(i1, { express: false }, photos) === 0, '요청 안 함 → 0');
  ok(M.computeSelectExpressAmt_(i1, { express: 'true' }, photos) === 0, '문자열 "true" 는 요청으로 보지 않음(엄격)');
  ok(M.computeSelectExpressAmt_(i1, { express: true }, [{ num: '', note: '' }]) === 0, '보정할 사진이 없으면(인화만) → 0');
  const i2 = M.getSelectExpressInfo_(row('stud', '스튜디오 Basic'), 'express,dog | ');
  ok(!i2.offer && i2.boughtAtBooking && M.computeSelectExpressAmt_(i2, { express: true }, photos) === 0, '예약 때 이미 샀으면 셀렉에서 두 번 받지 않는다', i2);
  const i3 = M.getSelectExpressInfo_(row('pass', '여권/비자'), '');
  ok(!i3.offer && i3.fee === 0, '여권 세션: 판매 안 함', i3);
  const i4 = M.getSelectExpressInfo_(row('reprint', '재인화'), '');
  ok(!i4.offer, '재인화 세션: 판매 안 함', i4);
  // 수정 제출에서 급행 유지 → 처음 주문 시각을 지킨다
  const stored = JSON.stringify({ src: 'select', at: '2026-10-15 10:00', amt: 34 });
  const i5 = M.getSelectExpressInfo_(row('stud', '스튜디오 Basic', stored), '');
  const cell = JSON.parse(M.buildSelectExpressCell_(i5, 34, '2026-10-17 09:00'));
  ok(i5.boughtAtSelect && cell.at === '2026-10-15 10:00' && cell.amt === 34, '수정 제출: 급행 주문 시각 유지', cell);
  ok(M.buildSelectExpressCell_(i1, 0, '2026-10-17 09:00') === '', '급행 해제 → 셀 비움');
  M.__setSettings__({ return_discount: '10', express_rate: '0' });
  const i6 = M.getSelectExpressInfo_(row('stud', '스튜디오 Basic', stored), '');
  ok(M.computeSelectExpressAmt_(i6, { express: true }, photos) === 34, '셀렉 때 산 급행은 수정 제출에서 산 가격 그대로(요율이 바뀌어도)', M.computeSelectExpressAmt_(i6, { express: true }, photos));
  ok(M.computeSelectExpressAmt_(M.getSelectExpressInfo_(row('stud', '스튜디오 Basic'), ''), { express: true }, photos) === 0, '요율 0 → 새 판매 없음');
  M.__setSettings__({ return_discount: '10' });
  ok(M.SELECT_HEADERS.indexOf('급행') === 60, "셀렉 새 열 '급행' 은 맨 끝(인덱스 60)", M.SELECT_HEADERS.indexOf('급행'));
}

// ── 4) 옵션 키 파서·국가 누출 ──────────────────────────────────────────────
{
  const P = M.parseBookingOptionKeysFromText_;
  ok(P('express,dog').includes('express') && P('dog|express').includes('express'), '키 express 인식(쉼표·파이프)');
  ok(P('인원 2명 | 옵션: 급행 작업 +34€').includes('express'), "발행 동기화가 되쓴 라벨 '급행 작업' 인식");
  ok(!P('Express-Lieferung Anfrage').includes('express') && !P('긴급 납품 요청').includes('express'), '사업자 긴급 납품 옵션과 혼동 안 함');
  ok(!P('[셀렉2026-10-15]보정3장 급행(셀렉)').includes('express'), "셀렉 요약의 '급행(셀렉)' 을 예약 급행으로 오인 안 함");
  const brow = (opt, extra) => { const r = []; r[M.BOOKING_COL['옵션']] = opt; r[M.BOOKING_COL['추가항목']] = extra; return r; };
  ok(!M.parseBookingOptionKeysFromRow_(brow('', '요청사항: Is express delivery possible?, Express-Bearbeitung?')).includes('express'), '고객 요청사항의 "express delivery" 질문을 급행 구매로 읽지 않는다(옵션 열만)');
  ok(M.parseBookingOptionKeysFromRow_(brow('express', '')).includes('express') && M.parseBookingOptionKeysFromRow_(brow('', '반려동물')).includes('dog'), '옵션 열 급행·추가항목 반려동물은 그대로 읽는다');
  ok(M.deliveryBaseYmd_('2026-10-10', [{ date: '2026-10-17', kind: 'shoot' }, { date: '2026-10-18', kind: 'travel' }]) === '2026-10-17', '여러 날 촬영: 마지막 촬영일부터 센다(이동일 제외)');
  ok(JSON.stringify(M.passCountriesFromOptionCell_('dog,bg', 'stud')) === '[]', '스튜디오 확정 메일에 "(dog,bg)" 가 새지 않는다');
  ok(JSON.stringify(M.passCountriesFromOptionCell_('express|KR|DE', 'pass')) === '["KR","DE"]', '여권: express 는 국가가 아니다');
}

// ── 5) 고객 메일 블록(3개국어) ─────────────────────────────────────────────
{
  const est = M.buildDeliveryEstimate_('2026-10-09', { id: 'sb', g: 'stud', t: 'group', p: 170 }, false);
  const ko = M.buildDeliveryEstimateHtml_(est, 'ko', 34), de = M.buildDeliveryEstimateHtml_(est, 'de', 34), en = M.buildDeliveryEstimateHtml_(est, 'en', 34);
  ok(/2026년 10월 16일\(금\)까지/.test(ko) && /10월 30일\(금\) ~ 2026년 11월 6일\(금\)/.test(ko) && /급행\(\+34,00/.test(ko), 'ko: 원본·보정 날짜 + 급행 안내', ko.replace(/<[^>]+>/g, ' ').slice(0, 220));
  ok(/bis Fr, 16\.10\.2026/.test(de) && /Express \(\+34,00/.test(de), 'de: Datum + Express', de.replace(/<[^>]+>/g, ' ').slice(0, 200));
  ok(/by Fri, 2026-10-16/.test(en), 'en: date', en.replace(/<[^>]+>/g, ' ').slice(0, 160));
  ok(!/보정 전|unedited|unbearbeitet/.test(ko + en + de), '스냅·웨딩 원본은 색보정본 — "보정 전·unedited" 라고 쓰지 않는다');
  const exHtml = M.buildDeliveryEstimateHtml_(M.buildDeliveryEstimate_('2026-10-09', { id: 'sb', g: 'stud', p: 170 }, true), 'ko', 34);
  ok(/급행 작업으로 예약/.test(exHtml) && !/더 빨리 필요하시면/.test(exHtml), '급행 예약자에겐 급행 판매 문구 대신 급행 확정 문구');
  ok(!/더 빨리 필요하시면/.test(M.buildDeliveryEstimateHtml_(est, 'ko', 0)), '금액 숨김(요금 0)이면 급행 판매 문구 없음');
}

// ── 6) 서버 배선 — 판 급행이 조용히 빠지지 않는가(소스 구조) ─────────────────
{
  const body = (name) => { const i = gs.indexOf(`function ${name}(`); return i < 0 ? '' : gs.slice(i, gs.indexOf('\nfunction ', i + 10)); };
  for (const fn of ['submitPhotoSelection', 'updatePhotoSelection']) {
    const b = body(fn);
    ok(/const totalExtra=roundCurrency_\(extraRetouchAmt\+extraPrintsAmt\+expressAmt\)/.test(b), `${fn}: 총추가금액에 급행 포함`);
    ok(/SELECT_COL\['급행'\]\+1\)\.setValue\(buildSelectExpressCell_/.test(b), `${fn}: 급행 열 기록`);
    ok(/recordSelectEarlyStart_\([^)]*extraRetouch\+\(expressAmt>0\?1:0\)/.test(b), `${fn}: 급행도 조기 이행 요청 대상`);
    ok(/syncSelectPrintOrder_\([^)]*expressAmt>0\?\['급행 작업×1\('/.test(b), `${fn}: 인화주문(청구 정본)에 급행 줄`);
    ok(/getRange\(rowNum,SELECT_COL\['제출일시'\]\+1,1,9\)/.test(b), `${fn}: 9칸 연속 쓰기 범위 그대로(새 열은 끝에만)`);
  }
  ok(/if\(expressAmt>0\) items\.push\(\{description:'급행 작업/.test(body('submitPhotoSelection')), '사업자 인보이스에 급행 줄(합계 = 총추가금액)');
  ok(/\['급행',''\]/.test(gs), '추가금 정리(select-clear-extras)가 급행도 지운다');
  for (const fn of ['submitPhotoSelection', 'updatePhotoSelection']) ok(/const selSh=ensureSelectSheet_\(sheets\.ss\);/.test(body(fn)), `${fn}: 새 열이 그리드에 있게 ensureSelectSheet_ 로 연다`);
  ok(/if\(optionText\) bookingSheet\.getRange\(rowIndex,BOOKING_COL\['옵션'\]\+1\)/.test(body('syncBookingFromInvoiceRecord_')), '옵션을 안 보낸 인보이스 발행(보드 앱)이 옵션 열을 비우지 않는다');
  ok(/\(quote\.optionKeys\|\|optionKeys\)\.join\('\|'\)/.test(body('changeBookingProductForAgent_')), '상품 변경: 엔진이 거른 키 저장(대상 아닌 상품에 급행 키 잔류 금지)');
  ok(/quoteForEdit&&!\(Number\(quoteForEdit\.expressFee\)>0\)&&cleanOptionKeys\.indexOf\('express'\)>-1\) cleanOptionKeys\.splice\(cleanOptionKeys\.indexOf\('express'\),1\);/.test(body('updateBookingAdmin')), '어드민 수정: 급행비 0 이면 express 키도 뺀다');
  ok(/if\(!\(quote&&quote\.expressFee>0\)\) optionKeys=optionKeys\.filter/.test(body('addManualBookingAdmin')), '수기 예약: 급행비 0 이면 express 키 저장 안 함');
  ok((gs.match(/Math\.max\(0,currentTotal-getBookingRowExpressFee_\(row\)\)\*\(rate\/100\)/g) || []).length === 2, '당일 재예약 할인 소급(점검·보정 둘 다)은 급행비를 할인하지 않는다');
  ok(/buildDeliveryEstimate_\(deliveryBaseYmd,dItem,dExpress\),lang,0\)/.test(body('sendBookingReminders_')), '전날 리마인드는 날짜만(급행 금액·판매 문구 없음 — hidePrice 예약 보호)');
  ok(/keptExpress/.test(body('updateSelectManualAdmin')), '수기 셀렉 입력이 급행을 지우지 않는다');
  ok(/\['dog','bg','outfit','express'\]\.indexOf\(k\)!==-1/.test(gs), '어드민 예약 수정 서버 화이트리스트에 express');
  ok(/if\(payload\.dropExpress!==true&&optionKeys\.indexOf\('express'\)<0\s*&&parseBookingOptionKeysFromText_\(String\(row\[BOOKING_COL\['옵션'\]\]\|\|''\)\)\.indexOf\('express'\)>-1\) optionKeys\.push\('express'\)/.test(body('changeBookingProductForAgent_')), '보드·에이전트 상품 변경이 급행을 이어받는다');
  ok(/\}\)\.concat\(extraItems\|\|\[\]\)\.join\(', '\)/.test(body('syncSelectPrintOrder_')), '인화주문 행 인화항목에 급행 줄이 실제로 붙는다(extraItems)');
  ok(/급행 작업/.test(body('buildInvoiceBookingSyncOptionText_')), '인보이스→예약 동기화 옵션 문구에 급행');
  ok(/bookingRow\[BOOKING_COL\['옵션'\]\] = \(quote\.optionKeys\|\|\[\]\)\.join/.test(gs), '예약 저장은 서버가 거른 quote.optionKeys');
  ok(/deliveryHtml/.test(body('sendConfirmEmail_')) && /\$\{bookingDetailsHtml\}\$\{deliveryHtml\}/.test(gs), '확정 메일에 전달 예정일');
  ok((body('sendBookingReminders_').match(/\$\{deliveryHtml\}/g) || []).length === 3, '전날 리마인드 3개국어 모두 전달 예정일');
  ok(/expressDue/.test(body('buildOpsFlowGaps_')) && /flowGaps\.expressDue\.length/.test(gs), '브리핑: 급행 보정 마감 목록 + 액션 수 반영');
}

// ── 7) 화면 = 서버 규칙 ───────────────────────────────────────────────────
{
  const grp = (gs.match(/const DELIVERY_ESTIMATE_GROUPS_=\[([^\]]*)\]/) || [])[1];
  const feGrp = (bookingJs.match(/express: \{\s*groups: \[([^\]]*)\]/) || [])[1];
  ok(grp && feGrp && grp.replace(/[\s']/g, '') === feGrp.replace(/[\s']/g, ''), `예약 화면 급행 대상 그룹 = 서버(${grp})`, [grp, feGrp]);
  ok(/return roundCurrency\(p \* rate \/ 100\)/.test(bookingJs) && /return roundCurrency_\(p\*rate\/100\)/.test(gs), '급행 요금 식: 화면·서버 모두 상품가 × 요율%');
  ok(/raw === '' \? 20 : Number\(raw\)/.test(bookingJs), '화면: 요율 빈칸 → 20(서버와 같음)');
  ok(/if \(state\.init\?\.settings\?\.expressRate == null\) return 0;/.test(bookingJs), '화면: 급행을 모르는 서버(요율 미전송)면 급행을 팔지 않는다');
  const prev = bookingJs.slice(bookingJs.indexOf('function getPreviewQuote('), bookingJs.indexOf('function renderBabyTypeChips('));
  const iWed = prev.indexOf("if (item.g === 'wed') total = roundCurrency(total - earlyBirdDiscount - marketingDiscount);");
  const iExp = prev.indexOf("const expressFee = optionKeys.includes('express') ? getExpressFee(item) : 0;");
  const iPass = prev.indexOf('let passAddonDur = 0;');
  ok(iWed > -1 && iExp > iWed && iPass > iExp, '화면 미리보기: 급행은 할인 뒤·여권 콤보 전(서버와 같은 자리)', [iWed, iExp, iPass]);
  ok(/money2\(\(r\.raw - r\.vd\.discount\) \+ \(p\.raw - p\.vd\.discount\) \+ expressAmount\(\)\)/.test(selectJs), '셀렉 화면 합계에 급행 포함(볼륨 할인 밖)');
  ok(/function hasPaidRetouch\(\) \{ return calcRetouchDiscount\(\)\.raw > 0 \|\| expressAmount\(\) > 0; \}/.test(selectJs), '셀렉 화면: 급행도 조기 이행 체크 대상');
  ok(/express: expressAmount\(\) > 0,/.test(selectJs) && /expressAmount\(\) > 0\n  \]\);/.test(selectJs), '셀렉 제출 payload·요청 서명에 급행');
  ok(/state\.express = !!session\?\.express\?\.atSelect;/.test(selectJs), '수정 제출: 셀렉 때 산 급행이 켜진 채로 열린다');
  ok(/\{key:'express',label:/.test(adminHtml), '어드민 예약 수정 창에 급행(없으면 저장이 급행을 뺀다)');
  const man = adminHtml.slice(adminHtml.indexOf('function calcManualPrice('), adminHtml.indexOf('\n}', adminHtml.indexOf('function calcManualPrice(')));
  ok(/m_opt_express'\)\?\.checked[^\n]*\n[^\n]*_adminExpressRate[^\n]*\n\s*total \+= Math\.round\(basePrice\*expRate\/100\*100\)\/100;/.test(man), '어드민 수기 예약 금액에 급행(상품가 × 요율%)', man.length);
  ok(/if\(document\.getElementById\('m_opt_express'\)\?\.checked\) optParts\.push\('express'\);/.test(adminHtml), '어드민 수기 예약이 옵션에 express 저장(없으면 셀렉에서 또 판다)');
  ok(/id="inv_calcOptExpress"/.test(adminHtml) && /keys\.push\('express'\)/.test(adminHtml), '어드민 인보이스 계산기에 급행');
  const invRe = (adminHtml.match(/expEl\.checked=(\/[^\n]+?\/i)\.test\(optionText\)/) || [])[1];
  // 소스의 정규식 리터럴 문자열(/.../i)을 RegExp 로 — eval 없이 본문·플래그만 떼어 만든다
  const lit = invRe ? invRe.match(/^\/(.*)\/([a-z]*)$/) : null;
  const re = lit ? new RegExp(lit[1], lit[2]) : null;
  ok(re && re.test('express,dog') && re.test('옵션: 급행 작업 +34€') && !re.test('Express-Lieferung Anfrage'), '인보이스 계산기 자동 체크: express 는 잡고 Express-Lieferung 은 안 잡음', invRe);
}

if (fail) { console.error(`\n✗ 전달 예정일·급행 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 전달 예정일·급행 — 금액·할인 순서·판매 규칙·날짜(휴무일)·배선·화면=서버 전부 일치');
