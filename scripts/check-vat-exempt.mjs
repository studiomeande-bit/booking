#!/usr/bin/env node
/**
 * check-vat-exempt.mjs — 국외 B2B 부가세 미부과(§3a Abs.2 UStG) 합계·문구 검증기
 *
 * 왜 필요한가: 견적/인보이스 합계는 "unitGross = 19% 포함 brutto" 라는 전제 위에 서 있다.
 * 면제 모드는 그 전제를 건드리지 않고 **부가세만 0, 총액만 netto** 로 바꾼다 — 잘못 손대면
 * 기존 견적 수천 유로가 조용히 틀어진다. 그래서 (a) 면제 계산, (b) 기존 19% 계산의 무변화를
 * 같은 파일에서 한 번에 못박는다.
 *
 * 어떻게: Code.gs 의 실제 함수 소스를 그대로 떼어 임시 모듈로 실행한다(재구현 아님).
 *
 * 사용법:  node scripts/check-vat-exempt.mjs        (불일치 시 exit 1)
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} 을 찾지 못했습니다 — 함수명이 바뀌었을 수 있습니다.`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    const c = src[i];
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`${name} 의 본문 끝을 찾지 못했습니다.`);
}

const MODULE = [
  `const CONFIG={QUOTE_VAT_RATE:0.19};`,
  `const VAT_MODE_STANDARD='standard';`,
  `const VAT_MODE_EXEMPT_THIRD_COUNTRY='exempt_third_country';`,
  extractFn(gs, 'normalizeVatMode_'),
  extractFn(gs, 'isVatExempt_'),
  extractFn(gs, 'readVatModeFromPayload_'),
  extractFn(gs, 'vatExemptNoteText_'),
  extractFn(gs, '_calcQuoteTotals_'),
  `export {normalizeVatMode_,isVatExempt_,readVatModeFromPayload_,vatExemptNoteText_,_calcQuoteTotals_};`,
].join('\n\n');

const dir = mkdtempSync(join(tmpdir(), 'vat-exempt-'));
let mod;
try {
  const file = join(dir, 'vat.mjs');
  writeFileSync(file, MODULE);
  mod = await import(pathToFileURL(file).href);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
const { _calcQuoteTotals_, isVatExempt_, readVatModeFromPayload_, vatExemptNoteText_ } = mod;

// AN-260010 휘슬러 코리아 실 품목 (brutto 단가)
const fissler = [
  { qty: 1, unitGross: 1904 },
  { qty: 1, unitGross: 357 },
  { qty: 1, unitGross: 714 },
  { qty: 1, unitGross: 357 },
];

// 1) 하위호환: 3번째 인자 없음 = 종전과 완전히 동일해야 한다
const legacy = _calcQuoteTotals_(fissler, 0);
assert.deepEqual(legacy, { subtotal: 3332, discount: 0, netto: 2800, vat: 532, total: 3332 });

// 2) 'standard' 명시·빈 문자열도 동일 (기존 시트 행은 값이 비어 있다)
assert.deepEqual(_calcQuoteTotals_(fissler, 0, 'standard'), legacy);
assert.deepEqual(_calcQuoteTotals_(fissler, 0, ''), legacy);

// 3) 면제: netto 산식은 그대로, 부가세 0, 총액 = netto
assert.deepEqual(_calcQuoteTotals_(fissler, 0, 'exempt_third_country'),
  { subtotal: 3332, discount: 0, netto: 2800, vat: 0, total: 2800 });

// 4) 할인이 있어도 면제 건은 netto 로 닫히고, 같은 입력의 표준 모드는 종전 그대로
const disc = _calcQuoteTotals_(fissler, 119, 'exempt_third_country');
assert.equal(disc.vat, 0);
assert.equal(disc.total, disc.netto);
assert.equal(disc.netto, Math.round(((3332 - 119) / 1.19) * 100) / 100);
assert.equal(_calcQuoteTotals_(fissler, 119).total, 3213);

// 5) 모드 정규화 — 빈값/미지정은 반드시 standard (기존 행 전부가 여기 해당)
['', null, undefined, 'standard', '아무값'].forEach((v) => assert.equal(isVatExempt_(v), false, `${v} → standard 여야 함`));
['exempt_third_country', 'exempt', 'Drittland', 'Y', 'true'].forEach((v) => assert.equal(isVatExempt_(v), true, `${v} → exempt 여야 함`));

// 6) payload 읽기 — 미지정이면 기존 값 유지(부분 수정에서 모드가 날아가면 안 된다)
assert.equal(readVatModeFromPayload_({}, 'exempt_third_country'), 'exempt_third_country');
assert.equal(readVatModeFromPayload_({ vatMode: 'standard' }, 'exempt_third_country'), 'standard');
assert.equal(readVatModeFromPayload_({ vatExempt: true }, ''), 'exempt_third_country');
assert.equal(readVatModeFromPayload_({ vatExempt: false }, 'exempt_third_country'), 'standard');

// 7) 면제 문구 — 3개 언어 전부, §3a 근거 포함. 국가명은 값으로 채우고 없으면 일반 문구.
['ko', 'de', 'en'].forEach((lang) => {
  const withCountry = vatExemptNoteText_(lang, 'quote', '대한민국');
  assert.ok(withCountry.includes('대한민국'), `${lang}: 국가명 미반영`);
  assert.ok(/3a/.test(withCountry), `${lang}: §3a 근거 누락`);
  assert.ok(vatExemptNoteText_(lang, 'quote', '').length > 30, `${lang}: 국가명 없을 때 문구가 비었음`);
});
assert.ok(vatExemptNoteText_('ko', 'invoice', '대한민국').includes('본 인보이스의'));
assert.ok(vatExemptNoteText_('ko', 'quote', '대한민국').includes('본 견적의'));

console.log('✅ 부가세 면제 로직 OK — 하위호환(3332/532) · 면제(2800/0/2800) · 문구 3개 언어');
