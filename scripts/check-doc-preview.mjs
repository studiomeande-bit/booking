#!/usr/bin/env node
/**
 * check-doc-preview.mjs — 발송 전 검수(doc-preview-text) + showMemo 기본값 회귀 검증기
 *
 * 왜 필요한가: 2026-08-21 견적 AN-260012 에서 **내부 작업 메모가 고객 PDF 비고란에 인쇄되어
 * 발송**됐다. 원인은 (1) pdfOptions.showMemo 기본값이 true, (2) 발송 전 PDF 내용을 볼 수단이 없음.
 * 두 가지를 고쳤으므로 여기서 못박는다 —
 *   · showMemo 는 **명시적 true 일 때만** 인쇄된다. 저장값(true/false)은 언제나 존중된다.
 *   · 나머지 표시옵션은 종전대로 기본 ON (명시적 false 만 제외) — 기존 견적 회귀 방지.
 *   · 인보이스 '메모' 열도 기본 미인쇄(내부 전용).
 *   · 쪽 분해(.page/.pbreak/.anlage)와 본문 높이 근사가 A4 초과를 잡아낸다.
 *
 * 어떻게: appscript/Code.gs 를 GAS 스텁과 함께 통째로 로드해 실제 렌더 함수를 호출한다(재구현 아님).
 *
 * 사용법:  node scripts/check-doc-preview.mjs        (불일치 시 exit 1)
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pad = (n) => String(n).padStart(2, '0');

/* ── GAS 전역 최소 스텁 — 문서 렌더에 닿는 것만 ── */
globalThis.Utilities = {
  formatDate(d, tz, fmt) {
    const x = d instanceof Date ? d : new Date(d);
    const ymd = `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
    if (fmt === 'yyyy-MM-dd HH:mm') return `${ymd} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
    return ymd;
  },
  DigestAlgorithm: { MD5: 'MD5' }, Charset: { UTF_8: 'UTF_8' },
  computeDigest: (alg, raw) => [...createHash('md5').update(String(raw), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
  newBlob: () => ({ getAs: () => ({ setName() { return this; } }) }),
};
const nope = (name) => new Proxy({}, { get: () => () => { throw new Error(`${name} stub`); } });
globalThis.DriveApp = Object.assign(nope('DriveApp'), { Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 } });
globalThis.SpreadsheetApp = nope('SpreadsheetApp');
globalThis.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) };
globalThis.ScriptApp = { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/STUB/exec' }) };
globalThis.HtmlService = { createHtmlOutput: () => ({ getBlob: () => ({ getAs: () => ({ setName() { return this; } }) }), setTitle() { return this; } }) };
globalThis.MimeType = { PDF: 'application/pdf' };
globalThis.Logger = { log() {} };
// 인보이스 품목 현지화가 상품시트를 읽는다 — 캐시에 빈 목록을 미리 넣어 시트 접근을 막는다
globalThis.CacheService = { getScriptCache: () => ({ get: () => '[]', put() {}, remove() {} }) };
globalThis.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
globalThis.Session = { getScriptTimeZone: () => 'Europe/Berlin', getActiveUser: () => ({ getEmail: () => 'stub@example.com' }) };
['CalendarApp', 'MailApp', 'GmailApp', 'UrlFetchApp'].forEach((k) => { globalThis[k] = nope(k); });

const EXPORTS = ['_normalizeQuotePdfOptions_', 'QUOTE_PDF_OPTION_KEYS', 'buildQuoteHtml_', 'buildInvoiceHtml_',
  '_splitDocPages_', '_htmlToPlainText_', '_estimateDocPageMm_', '_docMemoPrinted_', 'internalMemoGuard_',
  '_wrappedLineCount_', '_quoteLangList_'];
const dir = mkdtempSync(join(tmpdir(), 'smdocprev-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8')}\nmodule.exports={${EXPORTS.join(',')}};\n`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fails = 0;
const ok = (cond, label, detail) => {
  if (cond) { console.log(`  ✅ ${label}`); return; }
  fails += 1;
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
};

const MEMO = '내부단가 정합가 803~833 · 450은 약 45% 낮음 · 기준가로 굳지 않도록 주의';
const quoteFixture = (over) => Object.assign({
  number: 'AN-269999', issuedAt: '2026-08-21', validUntil: '2026-09-20', lang: 'de_ko',
  name: 'Muster GmbH', email: 'x@example.com', companyName: 'Muster GmbH', customerAddress: 'Musterstr. 1\n60313 Frankfurt',
  shootDate: '2026-09-10', product: 'Event', memo: MEMO, terms: '', discount: 0, depositAmount: 0, depositRate: 0,
  total: 535.5, vatMode: 'standard', vatExemptCountry: '',
  items: [{ description: 'Event-Fotografie vor Ort (4,5 Stunden)\n//\n현장 이벤트 촬영 (4.5시간)', qty: 1, unitGross: 535.5 }],
  pdfOptions: { showMemo: false },
}, over || {});

console.log('\n▶ showMemo 기본값 — 명시적 true 만 인쇄 (AN-260012 사고)');
{
  const empty = M._normalizeQuotePdfOptions_('');
  ok(empty.showMemo === false, '빈 표시옵션 → showMemo:false', JSON.stringify(empty.showMemo));
  const others = M.QUOTE_PDF_OPTION_KEYS.filter((k) => k !== 'showMemo');
  ok(others.every((k) => empty[k] === true), '나머지 옵션은 종전대로 기본 ON', others.filter((k) => empty[k] !== true).join(','));
  ok(M._normalizeQuotePdfOptions_('{"showMemo":true}').showMemo === true, '저장값 true 는 존중 (기존 문서 회귀 없음)');
  ok(M._normalizeQuotePdfOptions_('{"showMemo":false}').showMemo === false, '저장값 false 는 존중');
  ok(M._normalizeQuotePdfOptions_({ showMemo: true }).showMemo === true, '객체 입력도 동일');
  const partial = M._normalizeQuotePdfOptions_('{"showTerms":false}');
  ok(partial.showTerms === false && partial.showBank === true && partial.showMemo === false, '부분 지정 시 나머지 기본값 유지');
  ok(M._normalizeQuotePdfOptions_('{{broken').showMemo === false, '깨진 JSON → 안전측(미인쇄)');
}

console.log('\n▶ 견적 PDF 렌더 — 메모 인쇄 여부');
{
  const off = quoteFixture();
  const htmlOff = M.buildQuoteHtml_(off);
  ok(htmlOff.indexOf(MEMO) === -1, 'showMemo:false → 메모가 HTML 에 없음');
  ok(M._docMemoPrinted_('quote', off) === false, '_docMemoPrinted_ false');
  const on = quoteFixture({ pdfOptions: { showMemo: true } });
  const htmlOn = M.buildQuoteHtml_(on);
  ok(htmlOn.indexOf(MEMO) > -1, 'showMemo:true → 메모가 HTML 에 인쇄됨');
  ok(M._docMemoPrinted_('quote', on) === true, '_docMemoPrinted_ true');
  ok(M._docMemoPrinted_('quote', quoteFixture({ memo: '   ', pdfOptions: { showMemo: true } })) === false, '메모가 공백뿐이면 경고 없음');
}

console.log('\n▶ 발송 가드 — 내부 메모 인쇄 상태면 차단, force 로만 통과');
{
  const on = quoteFixture({ pdfOptions: { showMemo: true } });
  let blocked = false;
  try { M.internalMemoGuard_('quote', on, '견적서', false); } catch (e) { blocked = /내부 메모/.test(e.message); }
  ok(blocked, 'showMemo:true + 메모 → 발송 차단');
  let forced = true;
  try { M.internalMemoGuard_('quote', on, '견적서', true); } catch { forced = false; }
  ok(forced, 'force:true 는 통과');
  let clean = true;
  try { M.internalMemoGuard_('quote', quoteFixture(), '견적서', false); } catch { clean = false; }
  ok(clean, 'showMemo:false 는 그대로 통과');
}

console.log('\n▶ 인보이스 — 메모는 내부 전용(기본 미인쇄)');
{
  const inv = {
    number: 'STMIN-269999', issuedAt: '2026-08-21', type: '일반', name: 'Muster GmbH', lang: 'de',
    dateStr: '2026-09-10 09:00', product: 'Event', total: 535.5, deposit: 0, refund: 0,
    memo: '[등록 마이그레이션 2026-07-16 — 원본 PDF 경로]', customerAddress: 'Musterstr. 1',
    items: [{ description: 'Event', qty: 1, unitGross: 535.5 }], vatMode: 'standard', bookingRowIndex: 0,
  };
  ok(M.buildInvoiceHtml_(inv, 'de').indexOf('마이그레이션') === -1, '기본 → 내부 메모 미인쇄');
  ok(M._docMemoPrinted_('invoice', inv) === false, '_docMemoPrinted_ false');
  const shown = Object.assign({}, inv, { showMemo: true });
  ok(M.buildInvoiceHtml_(shown, 'de').indexOf('마이그레이션') > -1, 'showMemo:true → 인쇄');
  ok(M._docMemoPrinted_('invoice', shown) === true, '_docMemoPrinted_ true');
}

console.log('\n▶ 쪽 분해 + 텍스트 추출');
{
  ok(M._splitDocPages_(M.buildQuoteHtml_(quoteFixture())).length === 2, 'de_ko → 2쪽');
  ok(M._splitDocPages_(M.buildQuoteHtml_(quoteFixture({ lang: 'de' }))).length === 1, 'de → 1쪽');
  ok(M._splitDocPages_(M.buildQuoteHtml_(quoteFixture({ lang: 'de_ko_en' }))).length === 3, 'de_ko_en → 3쪽');
  const text = M._htmlToPlainText_(M._splitDocPages_(M.buildQuoteHtml_(quoteFixture()))[0]);
  ok(text.indexOf('font-family') === -1 && text.indexOf('<') === -1, 'CSS·태그가 텍스트에 섞이지 않음');
  ok(text.indexOf('AN-269999') > -1 && text.indexOf('Angebotnummer') > -1, '견적번호·라벨이 텍스트에 있음');
  ok(M._wrappedLineCount_('가나다라마바사아자차카타파하', 14) === 2, '한글은 라틴 2배 폭으로 줄바꿈 계산');
}

console.log('\n▶ 본문 높이 근사 — A4 273mm 초과 감지 (Chrome 실측 대조 ±5mm, 최대 +17mm 과대)');
{
  // AN-260012(KOTRA) 실측 재현: 독일어 쪽 283.1mm 초과 / 한국어 쪽 258.9mm 통과.
  // 약관 7줄 × 2언어 + 여러 줄짜리 품목 3개면 A4 한 쪽을 넘긴다.
  // 실제 약관 줄은 길어서 대부분 두 줄로 접힌다 — 그 폭(약 150자)을 그대로 재현한다
  const de7 = Array.from({ length: 7 }, (_, i) => `- Bedingung ${i + 1}: Lieferung per Google-Drive-Downloadlink innerhalb von drei Werktagen nach der Veranstaltung; der Link bleibt drei Monate abrufbar und Retusche ist nicht enthalten.`).join('\n');
  const ko7 = Array.from({ length: 7 }, (_, i) => `- 조건 ${i + 1}: 행사 후 3영업일 이내 구글 드라이브 다운로드 링크로 전달합니다.`).join('\n');
  const heavy = quoteFixture({
    terms: `${de7}\n//\n${ko7}`,
    items: [1, 2, 3].map((i) => ({
      description: `Position ${i} — Event-Fotografie vor Ort (4,5 Stunden)\n10.09.2026, 09:00–13:30 Uhr · Hilton Frankfurt City Centre\nPflichtmotive nach Absprache mit dem Auftraggeber\n//\n항목 ${i} — 현장 이벤트 촬영 (4.5시간)\n2026년 9월 10일 09:00–13:30 · Hilton Frankfurt City Centre`,
      qty: 1, unitGross: 178.5,
    })),
  });
  const deMm = M._estimateDocPageMm_('quote', heavy, 0);
  const koMm = M._estimateDocPageMm_('quote', heavy, 1);
  ok(deMm > 273, `약관 7줄 + 품목 3개(독일어) → 273mm 초과 감지 (${deMm}mm)`);
  ok(koMm < 273, `같은 내용 한국어 쪽은 한 쪽에 들어감 (${koMm}mm)`);
  const light = quoteFixture({ terms: '- Gültig 30 Tage.\n//\n- 30일간 유효합니다.' });
  ok(M._estimateDocPageMm_('quote', light, 0) < 273, '단출한 견적은 경고 없음');
  ok(M._estimateDocPageMm_('contract', {}, 0) === 0, '계약서는 높이 검사 대상 아님');
}

console.log(fails ? `\n❌ ${fails}건 불일치\n` : '\n✅ 전부 통과\n');
process.exit(fails ? 1 : 0);
