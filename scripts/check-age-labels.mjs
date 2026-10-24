#!/usr/bin/env node
/**
 * check-age-labels.mjs — 촬영대상 명시 표기가 고객 메모 낱말을 이긴다 + 표기·여권콤보 갈아끼우기
 *
 * 왜(2026-10-24 박민아): 온라인 폼에 영유아가 없어 키즈로 고른 고객이 메모에 "키즈로 선택했는데" 라고 썼다.
 *   판정이 낱말 '키즈' 를 먼저 봐서, 촬영대상을 영유아로 고쳐도 재견적마다 키즈 할인이 되살아났다.
 *   상품변경은 옛 [여권콤보:4명] 토큰을 그대로 둬서 2명으로 바꿔도 캘린더·인보이스가 4명 기준이었다.
 * 사용법: node scripts/check-age-labels.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'appscript', 'Code.gs'), 'utf8');
const pick = (n) => { const i = src.indexOf('function ' + n + '('); assert(i > -1, n + ' 없음');
  let d = 0; for (let k = src.indexOf('{', i); ; k++) { if (src[k] === '{') d++; if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const BOOKING_COL = { '옵션': 8, '요청사항': 15, '추가항목': 18 };
const f = new Function('BOOKING_COL', ['getBookingAgeGroupLabel_', 'getPassportComboDurationMin_', 'parseBookingAgeGroupFromRow_',
  'rewriteBookingAgeLabels_', 'rewriteBookingPassComboLabels_'].map(pick).join('\n') +
  '\nreturn {parseBookingAgeGroupFromRow_,rewriteBookingAgeLabels_,rewriteBookingPassComboLabels_};')(BOOKING_COL);
const row = (opt, extra, memo) => { const r = []; r[8] = opt; r[18] = extra; r[15] = memo; return r; };

assert.equal(f.parseBookingAgeGroupFromRow_(row('촬영대상: 영유아', '', '영유아가 없어 키즈로 선택했는데')), 'baby');
assert.equal(f.parseBookingAgeGroupFromRow_(row('', '', '키즈 프로필')), 'kids');      // 표기 없으면 낱말 추정 유지
assert.equal(f.parseBookingAgeGroupFromRow_(row('', '', '')), 'adult');

const t = (x, y) => assert.equal(f.rewriteBookingAgeLabels_(x, 'baby'), y);
t('촬영대상: 키즈 | 할인: 키즈 할인 -10€ 적용', '촬영대상: 영유아');
t('촬영대상: 키즈 | 할인: 키즈 할인 -10€ 적용 | 분위기: y\n촬영대상: 키즈\n할인/조정: 키즈 할인 -10€ 적용\n총금액: 1',
  '촬영대상: 영유아 | 분위기: y\n촬영대상: 영유아\n총금액: 1');
t('할인/조정: 키즈 할인 -10€ 적용 | 재촬영 할인 -12€\n총', '할인/조정: 재촬영 할인 -12€\n총');
t('dog|bg | 국가 2개/인', 'dog|bg | 국가 2개/인');

assert.equal(f.rewriteBookingPassComboLabels_('[여권콤보:4명] x | 여권콤보: 4명 / 추가 40분\n여권 콤보: 4명 / 추가 40분', 2),
  '[여권콤보:2명] x | 여권콤보: 2명 / 추가 20분\n여권 콤보: 2명 / 추가 20분');
console.log('✅ check-age-labels: 명시 표기 우선 · 표기/여권콤보 갈아끼우기');
