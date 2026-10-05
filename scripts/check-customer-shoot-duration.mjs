#!/usr/bin/env node
/**
 * check-customer-shoot-duration.mjs — 고객에게 안내되는 시간은 촬영시간만(준비 버퍼 제외)
 *
 * 왜(2026-10-05 사장님 지적): 예약 세부내역의 시간 줄이 슬롯 창(촬영 + prep 15분, 웨딩 60분)을 그대로 실어
 *   30분 촬영이 "45분" 으로 확정 메일·.ics 에 나갔다. 슬롯 계산용 totalDuration 은 그대로 두고, 표시만 shootDuration.
 * 어떻게: Code.gs 를 통째로 올려 진짜 calculateQuote_·buildBookingDetailsRows_ 를 돌린다.
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const nope = new Proxy({}, { get: () => () => { throw new Error('stub'); } });
Object.assign(globalThis, { SpreadsheetApp: nope, CalendarApp: nope, MailApp: nope, UrlFetchApp: nope, DriveApp: nope, Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  Utilities: { formatDate: () => '2026-10-05' }, Session: { getScriptTimeZone: () => 'Europe/Berlin' },
  ScriptApp: { getService: () => ({ getUrl: () => '' }) }, HtmlService: {}, MimeType: {}, LockService: {} });
const PRODUCTS = [
  { id: 'pass', g: 'pass', t: 'passport', p: 30, d: 15, prep: 0, nameKo: '여권/비자' },
  { id: 'sb', g: 'stud', t: 'group', p: 170, d: 30, prep: 15, nameKo: '스튜디오 Basic' },
  { id: 'pb', g: 'prof', t: 'single', p: 55, d: 15, prep: 15, nameKo: '프로필 Basic' },
  { id: 'wp', g: 'wed', t: 'wedding', p: 650, d: 240, prep: 60, nameKo: '프리웨딩 Plus' },
];
// 소스는 저장소의 Code.gs(신뢰 입력) — 게이트 하네스 공통 패턴
const M = new Function(`${gs}
function getCachedProducts_(){return ${JSON.stringify(PRODUCTS)};}
function getPromoProducts_(){return [];} function getTfpProducts_(){return [];}
function getSettingsMap_(){return {return_discount:'10'};}
function getProductById_(id){return getCachedProducts_().find(function(p){return p.id===id;});}
return {calculateQuote_,buildBookingDetailsRows_};`)();
let fail = 0;
const ok = (c, label, got) => { if (c) return; fail++; console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`); };
const timeRow = (rows) => { const r = (rows || []).find((x) => /촬영 시간|Shoot time|Aufnahmedauer/.test(String(x[0] || x.label || ''))); return r ? String(r[1] || r.value || '') : ''; };
for (const [id, shoot, slot, extra] of [['sb', 30, 45], ['pb', 15, 30], ['wp', 240, 300], ['pass', 15, 15], ['pb', 35, 50, { passAddon: true, passAddonPeople: 2 }]]) {
  const q = M.calculateQuote_(Object.assign({ itemId: id, people: id === 'wp' ? 2 : 1, date: '2027-05-20' }, extra || {}));
  ok(q.shootDuration === shoot && q.totalDuration === slot, `${id}: 촬영 ${shoot}분 · 슬롯 창 ${slot}분(슬롯 계산은 그대로)`, [q.shootDuration, q.totalDuration]);
  const shown = timeRow(M.buildBookingDetailsRows_({ name: 'T', date: '2027-05-20', time: '10:00' }, q, {}));
  ok(shown === `${shoot}분`, `${id}: 고객 세부내역엔 촬영시간 ${shoot}분만`, shown);
}
ok(timeRow(M.buildBookingDetailsRows_({ name: 'T' }, { totalDuration: 45, prep: 15 }, {})) === '30분', 'shootDuration 없는 견적 객체는 prep 을 뺀다');
ok(timeRow(M.buildBookingDetailsRows_({ name: 'T' }, { totalDuration: 30 }, { lang: 'en' })).replace(/\s/g, '') === '30min', '행 기준 값(이미 촬영시간)은 그대로');
if (fail) { console.error(`\n✗ 고객 촬영시간 안내 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 고객 안내 시간 — 촬영시간만(준비 버퍼 제외), 슬롯 창 계산은 불변');
