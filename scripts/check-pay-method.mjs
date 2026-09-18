#!/usr/bin/env node
/**
 * 결제수단 회귀 잠금 (2026-09-18 주여원 — 여권 수기등록이 '계좌이체'로 저장돼 확정메일에 "결제 계좌이체").
 *   ① 수기등록 기본값: 계약금 이체 대기 행만 '계좌이체', 나머지는 '미결제'
 *   ② 예약 세부내역 표: 미결제·현장결제(계약금 없음) 결제 줄 숨김, MRT·계약금 상품은 표시
 *   ③ booking-update payMethod: 미결제/계좌이체만, 수납된 행 거부, 결제메모 감사줄, 기본 무발송
 * Code.gs 원본 함수를 그대로 뽑아 스텁에서 돌린다(재구현 금지).
 *
 *   node scripts/check-pay-method.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'appscript', 'Code.gs'), 'utf8');

function extractFn(name) {
  const start = SRC.indexOf(`\nfunction ${name}(`);
  if (start < 0) throw new Error(`함수를 찾을 수 없습니다: ${name}`);
  let i = SRC.indexOf('{', start), depth = 0;
  for (; i < SRC.length; i++) {
    const c = SRC[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < SRC.length && SRC[i] !== q) { if (SRC[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '/' && SRC[i + 1] === '/') { i = SRC.indexOf('\n', i); continue; }
    if (c === '/' && SRC[i + 1] === '*') { i = SRC.indexOf('*/', i) + 1; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return SRC.slice(start + 1, i + 1);
  }
  throw new Error(`중괄호 짝이 안 맞습니다: ${name}`);
}

// ① 기본값 — addManualBookingAdmin 안의 식을 원문 그대로 뽑아 평가
const m = SRC.match(/const payMethodToSave = (useKrwMode \? '마이리얼트립'\s*:\s*\(String\(data\.payMethod\|\|''\)\.trim\(\) \|\| \(depositAmt>0 && !depositReceived \? '계좌이체' : '미결제'\)\));/);
assert.ok(m, 'addManualBookingAdmin 의 payMethodToSave 식이 바뀌었다 — 이 검사도 함께 갱신할 것');
const pmDefault = new Function('useKrwMode', 'data', 'depositAmt', 'depositReceived', `return ${m[1]};`);
assert.equal(pmDefault(false, {}, 0, false), '미결제', '여권(계약금 0) → 미결제');
assert.equal(pmDefault(false, {}, 50, false), '계좌이체', '계약금 이체 대기 → 계좌이체');
assert.equal(pmDefault(false, {}, 50, true), '미결제', '계약금 수령완료 → 미결제');
assert.equal(pmDefault(false, { payMethod: '현금' }, 0, false), '현금', '명시 payMethod 우선');
assert.equal(pmDefault(true, { payMethod: '현금' }, 0, false), '마이리얼트립', 'MRT 우선');

// ② 세부내역 표
const ctx = vm.createContext({});
vm.runInContext([
  'buildBookingDetailsRows_', '_bookingDetailLabels_', '_addBookingDetailRow_', 'getBookingAgeGroupLabel_',
  'getBookingAgeDiscountLabel_', '_bookingOptionText_', '_bookingSurveyText_', '_bookingList_',
  'getPassportFamilyDiscountLabel_', 'getBookingBabyTypeLabel_', '_bookingTruthyLabel_',
  'getPassportComboDurationMin_', 'formatEuroAmount_', 'parseMoneyValue_', 'isPublicTruthy_', 'roundCurrency_',
].map(extractFn).join('\n'), ctx);
const payRow = (deposit, pm, lang = 'ko') => {
  const rows = ctx.buildBookingDetailsRows_({ name: 'X' }, {}, { lang, totalPrice: 35, depositAmount: deposit, balanceAmount: 35, paymentMethod: pm });
  const L = ctx._bookingDetailLabels_(lang);
  const r = rows.find((x) => x.label === L.payment);
  return r ? r.value : null;
};
assert.equal(payRow(0, '계좌이체'), null, '여권 계좌이체 → 숨김(주여원 사례)');
assert.equal(payRow(0, '미결제', 'en'), null, '온라인 미결제 → 숨김(영문 메일에 한글 미결제 노출 방지)');
assert.equal(payRow(50, '미결제'), null, '계약금 상품이라도 미결제 → 숨김');
assert.equal(payRow(50, '계좌이체'), '계좌이체', '계약금 이체 대기 → 표시');
assert.equal(payRow(0, '마이리얼트립'), '마이리얼트립', 'MRT 선결제 → 표시');

// ③ booking-update payMethod
const HEADERS = ['예약일시', '상태', '고객명', '연락처', '이메일', '언어', '촬영종류', '상품', '옵션', '인원', '총결제액', '계약금', '잔금', '결제수단', '분위기', '요청사항', '캘린더ID', '계약금수단', '추가항목', '재방문', '잔금입금일', '잔금결제여부', '결제메모', '부가세모드'];
const COL = {}; HEADERS.forEach((h, i) => { COL[h] = i; });
function run(rowPatch, data) {
  const row = new Array(HEADERS.length).fill('');
  Object.assign(row, { 1: '확정됨', 2: '주여원', 9: 1, 10: 35, 12: 35, 13: '계좌이체', 15: '메모' });
  for (const [k, v] of Object.entries(rowPatch)) row[COL[k]] = v;
  const c = vm.createContext({
    CONFIG: { BOOKING_HEADERS: HEADERS, TIMEZONE: 'Europe/Berlin' }, BOOKING_COL: COL,
    Utilities: { formatDate: () => '2026-09-18' },
    assertAdmin_() {}, normalizeVatMode_: (v) => v,
    getDbSheet: () => ({ getLastRow: () => 300, getRange: () => ({ getValues: () => [row.slice()], setValue() {} }) }),
    updateBookingAdmin: (t, r, merged) => { c.captured = merged; return { ok: true, changeMail: { sent: false } }; },
  });
  vm.runInContext(extractFn('preserveAuditMemoLines_') + '\n' + extractFn('updateBookingFieldsForAgent_'), c);
  c.updateBookingFieldsForAgent_('t', 290, data);
  return c.captured;
}
let got = run({}, { payMethod: '미결제' });
assert.equal(got.payMethod, '미결제');
assert.equal(got.__silent, true, 'payMethod 정정은 기본 무발송');
assert.match(got.paymentMemo, /^\[정정\] 결제수단 계좌이체→미결제 2026-09-18/);
assert.equal(got.memo, '메모', '요청사항(고객 메일에 실림)엔 감사줄을 넣지 않는다');
got = run({ 결제메모: '기존' }, { payMethod: '미결제', notify: true });
assert.equal(got.__silent, false, 'notify:true 면 발송 허용');
assert.equal(got.paymentMemo.split('\n')[0], '기존', '기존 결제메모 보존');
assert.equal(run({}, { memo: 'x' }).payMethod, '계좌이체', 'payMethod 안 주면 현재값 유지');
assert.equal(run({}, { memo: 'x' }).__silent, false, 'payMethod 없으면 기존 기본(발송) 그대로');
assert.throws(() => run({}, { payMethod: '현금' }), /미결제.*계좌이체/, '현금은 수납 기록 경로로');
assert.throws(() => run({ 잔금결제여부: 'Y' }, { payMethod: '미결제' }), /이미 기록/, '수납된 행 거부');

console.log('check-pay-method: OK');
