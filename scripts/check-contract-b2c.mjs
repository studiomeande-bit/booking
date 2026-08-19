#!/usr/bin/env node
/**
 * check-contract-b2c.mjs — 소비자(B2C) Fotografenvertrag 분기 + B2B 하위호환 검증기
 *
 * 왜 필요한가: 계약서는 서명 시 시트 행에서 **다시 렌더**된다. 조항 코드를 잘못 건드리면
 * 이미 발송·서명된 B2B Drehvertrag 의 본문이 조용히 달라진다. 그래서 기존 B2B 표본 5건의
 * **조항해시(골든값)** 를 여기에 못박는다 — B2B 본문이 한 글자라도 바뀌면 여기서 터진다.
 * 반대로 소비자 계약은 § 9 Datenschutz · § 10 스토노 본문 · § 12 관할합의 삭제 ·
 * § 13 Widerrufsbelehrung + 별지가 **반드시** 들어가야 한다(누락 시 철회기간 12개월+14일).
 *
 * 어떻게: appscript/Code.gs 를 GAS 스텁과 함께 통째로 로드해 실제 렌더 함수를 호출한다(재구현 아님).
 *
 * 사용법:  node scripts/check-contract-b2c.mjs        (불일치 시 exit 1)
 * 스펙:    docs/fotografenvertrag-b2c-spec.md
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pad = (n) => String(n).padStart(2, '0');

/* ── GAS 전역 최소 스텁 — 계약서 렌더에 닿는 것만 ── */
globalThis.Utilities = {
  formatDate(d, tz, fmt) {
    const x = d instanceof Date ? d : new Date(d);
    const ymd = `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
    if (fmt === 'yyMMdd') return String(x.getFullYear()).slice(2) + pad(x.getMonth() + 1) + pad(x.getDate());
    if (fmt === 'yyyy-MM-dd HH:mm') return `${ymd} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
    if (fmt === 'yyyy-MM-dd HH:mm:ss') return `${ymd} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`;
    return ymd;
  },
  DigestAlgorithm: { MD5: 'MD5' }, Charset: { UTF_8: 'UTF_8' },
  computeDigest: (alg, raw) => [...createHash('md5').update(String(raw), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
};
const nope = (name) => new Proxy({}, { get: () => () => { throw new Error(`${name} stub`); } });
globalThis.DriveApp = Object.assign(nope('DriveApp'), { Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 } });
globalThis.SpreadsheetApp = nope('SpreadsheetApp');
globalThis.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) };
globalThis.ScriptApp = { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/STUB/exec' }) };
globalThis.HtmlService = { createHtmlOutput: () => ({ getBlob: () => ({ getAs: () => ({ setName() { return this; } }) }), setTitle() { return this; } }) };
globalThis.MimeType = { PDF: 'application/pdf' };
globalThis.Logger = { log() {} };
globalThis.CacheService = { getScriptCache: () => ({ get: () => null, put() {} }) };
globalThis.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
globalThis.Session = { getScriptTimeZone: () => 'Europe/Berlin', getActiveUser: () => ({ getEmail: () => 'stub@example.com' }) };
globalThis.CalendarApp = nope('CalendarApp');
globalThis.MailApp = nope('MailApp');
globalThis.GmailApp = nope('GmailApp');
globalThis.UrlFetchApp = nope('UrlFetchApp');

const EXPORTS = ['buildDrehvertragHtml_', 'buildDrehvertragBodyHtml_', 'buildWiderrufsformularHtml_', '_contractClauseHash_',
  'isB2cContract_', 'resolveContractType_', 'formatEuroDe_', 'formatEuroAmount_', '_contractShootWithin14Days_',
  '_contractScopeFromQuoteItems_', '_contractSpecialTermsFromQuote_'];
const dir = mkdtempSync(join(tmpdir(), 'smcontract-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8')}\nmodule.exports={${EXPORTS.join(',')}};\n`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fails = 0;
const check = (label, cond, detail) => {
  if (!cond) { fails += 1; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`); } else console.log(`  ✅ ${label}`);
};

/* ── 1) B2B 하위호환 — 조항해시 골든값 (2026-08-19 분기 도입 직전 코드에서 채취) ── */
const B2B = [
  ['ko-studio-deposit', 'f90a1530de', { contractId: 'DV-260802-BDM2', lang: 'ko', contractType: '촬영대행', name: 'Alice Kim', companyName: '', email: 'a@b.c', schedule: '2026-09-12 11:00', scopeText: '본식 촬영', deliverables: '사진 200장\n하이라이트 영상', deliveryFormat: 'Google Drive', deliveryDeadline: '', usageScope: '', copyrightOwner: '스튜디오', net: 1092.44, vat: 207.56, total: 1300, deposit: 300, balance: 1000, paymentTerms: '', contractEnd: '', specialTerms: '추가 1시간 €150', clauseVersion: 'DV-v1 (2026-08-02)', clauseHash: 'abc1234567', createdAt: '2026-08-02 10:00:00' }],
  ['de-b2b-vat0', 'c2537df749', { contractId: 'DV-260810-XYZ1', lang: 'de_ko', contractType: '촬영대행', name: 'Su-ji Seo', companyName: '휘슬러 코리아 (Fissler Korea)', email: 's@f.com', schedule: '2026-10-19 ~ 10-20', scopeText: '독일 미식투어 촬영', deliverables: 'Foto- und Videoproduktion\nVideoschnitt', deliveryFormat: '', deliveryDeadline: '', usageScope: 'Website, Social Media', copyrightOwner: '스튜디오', net: 2800, vat: 0, total: 2800, deposit: 300, balance: 2500, paymentTerms: '', contractEnd: '', specialTerms: '', clauseVersion: 'DV-v1 (2026-08-02)', clauseHash: 'def1234567', createdAt: '2026-08-11 09:00:00' }],
  ['en-client-copyright-nodeposit', 'a22b4c294e', { contractId: 'DV-260803-QQQ2', lang: 'en', contractType: '촬영대행', name: 'John Doe', companyName: 'Acme GmbH', email: 'j@d.com', schedule: '', scopeText: 'Brand shoot', deliverables: '', deliveryFormat: '', deliveryDeadline: '2026-12-01', usageScope: '', copyrightOwner: '고객', net: 840.34, vat: 159.66, total: 1000, deposit: 0, balance: 1000, paymentTerms: 'Net 30', contractEnd: '2026-12-31', specialTerms: '', clauseVersion: 'DV-v1 (2026-08-02)', clauseHash: '0123456789', createdAt: '2026-08-03 12:00:00' }],
  ['de-signed', 'bbf9a36ce9', { contractId: 'DV-260802-6BYD', lang: 'de', contractType: '촬영대행', name: 'Anna Müller', companyName: '', email: 'a@m.de', schedule: '2026-09-01 10:00', scopeText: 'Firmenevent', deliverables: 'ca. 150 Bilder', deliveryFormat: 'Google Drive', deliveryDeadline: '', usageScope: '', copyrightOwner: '스튜디오', net: 630.25, vat: 119.75, total: 750, deposit: 200, balance: 550, paymentTerms: '', contractEnd: '', specialTerms: 'Zusatzstunde 150 €', clauseVersion: 'DV-v1 (2026-08-02)', clauseHash: 'aaaabbbbcc', createdAt: '2026-08-02 08:00:00', sentAt: '2026-08-02 09:00:00', signedAt: '2026-08-03 14:22:10', signerName: 'Anna Müller' }],
  ['legacy-empty-type', 'fabe7ac2ab', { contractId: 'DV-260801-AAAA', lang: 'ko', contractType: '', name: '박민수', companyName: '', email: 'p@m.kr', schedule: '2026-08-20 15:00', scopeText: '가족 촬영', deliverables: '사진 30장', deliveryFormat: '', deliveryDeadline: '', usageScope: '', copyrightOwner: '스튜디오', net: 504.2, vat: 95.8, total: 600, deposit: 100, balance: 500, paymentTerms: '', contractEnd: '', specialTerms: '', clauseVersion: 'DV-v1 (2026-08-02)', clauseHash: 'zzzz111122', createdAt: '2026-08-01 10:00:00' }],
];
console.log('── B2B Drehvertrag 하위호환 (조항해시 골든값) ──');
for (const [label, golden, c] of B2B) {
  const got = M._contractClauseHash_(c);
  check(`${label} 조항해시 ${golden}`, got === golden, `현재 ${got} — B2B 본문이 바뀌었습니다`);
}
const b2bDoc = M.buildDrehvertragHtml_(B2B[0][2]);
check('B2B 에 소비자 조항이 새지 않음', !/Widerrufsbelehrung|Fotografenvertrag|Muster-Widerrufsformular/.test(b2bDoc));
check('B2B 금액 표기 종전 유지 (€ 1300)', b2bDoc.includes('€ 1300') && !b2bDoc.includes('1.300,00 €'));
check("계약종류 '촬영대행'·빈값·자유값은 B2B 경로", ['촬영대행', '', '영상제작', 'Drehvertrag'].every((t) => !M.isB2cContract_({ contractType: t })));

/* ── 2) 계약종류 판정 ── */
console.log('\n── 계약종류 판정 (명시 > 사업자 신호 > itemGroup > 개인=소비자) ──');
for (const [label, c, want] of [
  ['개인 웨딩인데 itemGroup=biz (AN-260011 실사례)', { name: 'Jin Hee Choi', companyName: '', vatId: '', itemGroup: 'biz' }, 'Fotografenvertrag'],
  ['회사명 있음', { companyName: '휘슬러 코리아', itemGroup: 'biz' }, '촬영대행'],
  ['VAT번호만 있음', { vatId: 'DE123456789', itemGroup: 'wed' }, '촬영대행'],
  ['예약유형 기업', { bookingType: '기업', itemGroup: 'biz' }, '촬영대행'],
  ['개인 wed/pass', { itemGroup: 'wed' }, 'Fotografenvertrag'],
  ['명시 b2b 지정', { itemGroup: 'wed', contractKind: 'b2b' }, '촬영대행'],
  ['명시 b2c 지정 (회사 있어도)', { companyName: 'Acme', contractKind: 'b2c' }, 'Fotografenvertrag'],
  ['자유 계약종류 보존', { contractType: '영상제작' }, '영상제작'],
]) check(`${label} → ${want}`, M.resolveContractType_(c) === want, `실제 ${M.resolveContractType_(c)}`);

/* ── 3) 금액 표기 ── */
console.log('\n── 금액 표기 (소비자=독일식, B2B=종전) ──');
for (const [v, want] of [[1950, '1.950,00 €'], [1638.66, '1.638,66 €'], [0, '0,00 €'], [12345678.5, '12.345.678,50 €'], [-500, '-500,00 €']]) {
  check(`${v} → ${want}`, M.formatEuroDe_(v) === want, `실제 ${M.formatEuroDe_(v)}`);
}
check('B2B 표기는 그대로 (1950 / 1638.66)', M.formatEuroAmount_(1950) === '1950' && M.formatEuroAmount_(1638.66) === '1638.66');

/* ── 4) § 356 Abs. 4 조기이행 문단은 촬영일이 계약일+14일 이내일 때만 ── */
console.log('\n── § 356 Abs. 4 조기이행 문단 조건 ──');
for (const [label, c, want] of [
  ['촬영 5일 뒤', { createdAt: '2026-08-19 10:00:00', schedule: '2026-08-24' }, true],
  ['촬영 14일 뒤(경계)', { createdAt: '2026-08-19 10:00:00', schedule: '2026-09-02' }, true],
  ['촬영 15일 뒤', { createdAt: '2026-08-19 10:00:00', schedule: '2026-09-03' }, false],
  ['촬영일 없음', { createdAt: '2026-08-19 10:00:00', schedule: '' }, false],
  ['자유텍스트 일정', { createdAt: '2026-08-19 10:00:00', schedule: '2026-10-19 ~ 10-20' }, false],
]) check(`${label} → ${want}`, M._contractShootWithin14Days_(c) === want);

/* ── 5) 소비자 계약서 본문 ── */
const b2c = (over) => Object.assign({
  contractId: 'DV-260819-TEST', createdAt: '2026-08-19 09:00:00', lang: 'de', contractType: 'Fotografenvertrag',
  name: 'Jin Hee Choi', companyName: '', email: 'j@c.com', customerAddress: 'Musterstr. 1\n60313 Frankfurt am Main',
  schedule: '2027-06-12', scopeText: 'Hochzeitsreportage - Zollenspieker Faehrhaus, Hamburg',
  deliverables: 'Ganztagsbegleitung, 10 Stunden\n· ca. 40 bearbeitete Bilder\nReisepauschale Hamburg',
  net: 1638.66, vat: 311.34, total: 1950, deposit: 500, balance: 1450, copyrightOwner: '스튜디오',
  clauseVersion: 'FV-v1 (2026-08-19)', clauseHash: 'test123456', specialTerms: 'Jede weitere Stunde: 150,00 EUR/Std.',
}, over || {});
const de = M.buildDrehvertragHtml_(b2c());
console.log('\n── 소비자 계약서 (de) ──');
check('제목 Fotografenvertrag', /<h1>Fotografenvertrag<\/h1>/.test(de));
check('Drehvertrag·Videoproduktion 문구 없음', !/Drehvertrag|Videoproduktion/.test(de));
check('§ 9 Vertraulichkeit → Datenschutz(DSGVO)', de.includes('§ 9 Datenschutz') && de.includes('Art. 6 Abs. 1 lit. b DSGVO') && !de.includes('Vertraulichkeit'));
check('§ 10 스토노 스태플이 본문에', de.includes('§ 10 Stornierung und Terminverlegung') && de.includes('50 % der Gesamtvergütung') && de.includes('80 % der Gesamtvergütung'));
check('§ 10 사업자 전제(도산·강제집행) 제거', !/Zwangsvollstreckung|Insolvenz|Geschäftsaufgabe/.test(de));
check('§ 309 Nr. 5 대응 — 손해 감액 입증 유보', de.includes('bleibt der Nachweis vorbehalten'));
check('§ 12 관할합의 삭제 → 법정관할', de.includes('Es gelten die gesetzlichen Gerichtsstände.') && !/Gerichtsstand der Sitz des Auftragnehmers/.test(de));
check('§ 13 Widerrufsbelehrung 법정 문구', de.includes('binnen vierzehn Tagen ohne Angabe von Gründen') && de.includes('Folgen des Widerrufs'));
check('철회권이 스토노 규정에 우선함을 명시', de.includes('geht das gesetzliche Widerrufsrecht diesen Stornoregelungen vor'));
check('별지 Muster-Widerrufsformular + page-break', de.includes('Muster-Widerrufsformular') && de.includes('Unzutreffendes streichen') && de.includes('.anlage{page-break-before:always'));
check('금액 독일식 표기', de.includes('1.950,00 €') && de.includes('1.638,66 €') && !/€ 1950\b/.test(de));
check('성별 표기 통일 (Auftraggeber:in)', de.includes('Auftraggeber:in') && !/Auftraggeberin\b/.test(de));
check('당사자 주소 상속', de.includes('Musterstr. 1, 60313 Frankfurt am Main'));
check('조항해시가 별지까지 포함', M._contractClauseHash_(b2c()) !== M._contractClauseHash_(Object.assign(b2c(), { scopeText: 'x' })));

check('촬영일 없으면 "nach Absprache"', M.buildDrehvertragBodyHtml_(b2c({ schedule: '' })).includes('nach Absprache'));
check('§ 356 Abs. 4 문단: 먼 촬영일엔 없음', !de.includes('§ 356 Abs. 4'));
check('§ 356 Abs. 4 문단: 14일 이내면 삽입', M.buildDrehvertragBodyHtml_(b2c({ schedule: '2026-08-25' })).includes('erlischt Ihr Widerrufsrecht mit vollständiger Erbringung'));
const exempt = M.buildDrehvertragBodyHtml_(b2c({ vatMode: 'exempt_third_country', vatExemptCountry: 'Republik Korea', vat: 0, net: 1950 }));
check('부가세 면제 모드 → 부가세 행 대신 면제 문구', exempt.includes('Nicht steuerbare sonstige Leistung') && exempt.includes('Republik Korea'));

const ko = M.buildDrehvertragHtml_(b2c({ lang: 'ko' }));
console.log('\n── 소비자 계약서 (ko / en) ──');
check('ko: 법정 독일어 원문 유지 + 원문 우선 안내', ko.includes('binnen vierzehn Tagen ohne Angabe von Gründen') && ko.includes('독일어 원문이 법적 효력을 가진다'));
check('ko: 제 12 조 법정 관할', ko.includes('관할은 법정 관할에 따른다'));
check('ko: 스토노 스태플 본문', ko.includes('총액의 50%') && ko.includes('총액의 80%'));
const en = M.buildDrehvertragHtml_(b2c({ lang: 'en' }));
check('en: 렌더 + 법정 독일어 원문 유지', en.includes('Photography Agreement') && en.includes('Right of withdrawal') && en.includes('binnen vierzehn Tagen'));

/* ── 6) 견적 연동 ── */
console.log('\n── 견적 연동 ──');
const items = [
  { description: 'Ganztagsbegleitung, 10 Stunden\nInklusive: ca. 40 Bilder\n//\n종일 동행 10시간\n포함: 약 40장', qty: 1, unitGross: 1250 },
  { description: 'Portfolio-Einverständnis\n//\n포트폴리오 동의', qty: 2, unitGross: 0 },
];
const deScope = M._contractScopeFromQuoteItems_(items, 'de_ko', 'de');
const koScope = M._contractScopeFromQuoteItems_(items, 'de_ko', 'ko');
check('첫 줄=Leistung, 나머지=하위 설명', deScope.startsWith('Ganztagsbegleitung, 10 Stunden\n· Inklusive: ca. 40 Bilder'));
check("다국어 '//' 는 계약 언어 쪽만", !deScope.includes('종일 동행') && koScope.includes('종일 동행') && !koScope.includes('Ganztagsbegleitung'));
check('€0 라인도 Leistungsumfang 에 포함', deScope.includes('Portfolio-Einverständnis'));
check('수량>1 표기', deScope.includes('Portfolio-Einverständnis × 2'));
const t = M._contractSpecialTermsFromQuote_('- Jede weitere Stunde: 150,00 EUR/Std.\n- Dieses Angebot ist freibleibend.\n- Dieses Angebot ist 30 Tage ab Ausstellungsdatum gültig.', 'de', 0);
check('견적 옵션·조건은 특약으로 이관', t.text.includes('Jede weitere Stunde'));
check('견적 전용 문구는 제외', !t.text.includes('freibleibend') && !t.text.includes('gültig') && t.dropped.length === 2);

console.log(fails ? `\n❌ 실패 ${fails}건` : '\n✅ 전부 통과');
process.exit(fails ? 1 : 0);
