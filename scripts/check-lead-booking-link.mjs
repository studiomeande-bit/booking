#!/usr/bin/env node
/* check-lead-booking-link.mjs — 홈페이지 문의 접수확인 메일에 예약 링크(사장님 2026-10-26 "기본적으로 접수답변 + 예약링크 안내")
 * 3개국어 모두 링크·버튼, 링크는 문의 언어(?lang=), 설정 BOOKING_SITE_URL 을 따른다, 고객 이름 escape 유지. */
process.env.TZ = 'Europe/Berlin';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const gs = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'appscript', 'Code.gs'), 'utf8');
const nope = new Proxy({}, { get: () => () => { throw new Error('stub'); } });
Object.assign(globalThis, { SpreadsheetApp: nope, CalendarApp: nope, MailApp: nope, UrlFetchApp: nope, DriveApp: nope, Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) }, CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  Utilities: { formatDate: () => '2026-10-26' }, Session: { getScriptTimeZone: () => 'Europe/Berlin' }, ScriptApp: { getService: () => ({ getUrl: () => '' }) }, HtmlService: {}, MimeType: {}, LockService: {} });
const sent = []; let settings = {};
const M = new Function('sent', 'S', `${gs}
function getSettingsMap_(){ return S(); }
function sendTrackedEmail_(m){ sent.push(m); }
function getSignatureHtml_(){ return ''; }
return {_sendPortfolioLeadCustomerEmail_};`)(sent, () => settings);
let fail = 0; const ok = (c, l, g) => { if (!c) { fail++; console.error('  ✗ ' + l + (g === undefined ? '' : ' — ' + JSON.stringify(g))); } };
const want = { ko: '온라인 예약하기', en: 'Book online', de: 'Online buchen' };
for (const lang of ['ko', 'en', 'de']) {
  sent.length = 0; M._sendPortfolioLeadCustomerEmail_({ name: '홍<b>', email: 'a@b.c', lang, projectType: 'x', message: 'm' });
  const h = sent[0]?.htmlBody || '';
  ok(h.includes(`href="https://booking.studio-mean.com/?lang=${lang}"`) && h.includes(want[lang] + ' →'), `${lang}: 예약 링크·버튼(문의 언어로)`, h.match(/href="[^"]+"/)?.[0]);
  ok(/홍&lt;b&gt;/.test(h), `${lang}: 고객 이름 escape`);
  ok(h.indexOf('?lang=') < h.indexOf(lang === 'ko' ? '보내주신 내용' : lang === 'en' ? 'What you sent us' : 'Ihre Angaben'), `${lang}: 링크가 문의 원문보다 위`);
}
settings = { BOOKING_SITE_URL: 'https://example.test/' }; sent.length = 0;
M._sendPortfolioLeadCustomerEmail_({ name: 'A', email: 'a@b.c', lang: 'ko', projectType: 'x', message: 'm' });
ok(sent[0].htmlBody.includes('href="https://example.test/?lang=ko"'), '설정 BOOKING_SITE_URL 을 따른다');
if (fail) { console.error(`\n✗ 문의 접수 예약 링크 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 홈페이지 문의 접수확인 — 3개국어 예약 링크(문의 언어·설정 URL)');
