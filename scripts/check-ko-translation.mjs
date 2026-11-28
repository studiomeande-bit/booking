#!/usr/bin/env node
/* check-ko-translation.mjs — 외국어 보정·재수정 요청을 사장님용 한국어로(2026-11-28)
 * ① 한글 비율 판정(◎ 위치 낱말 제외) ② 번역 실패·동일문은 빈 값 ③ 셀렉 메모 noteKo(같은 메모 1회 호출)
 * ④ 사장님 메일에만 번역(고객 영수증 lang 지정 시 없음) ⑤ 재수정 이력이 noteKo 를 보존 ⑥ ERP 표시 배선. */
process.env.TZ = 'Europe/Berlin';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const admin = readFileSync(join(ROOT, 'appscript', 'AdminV2.html'), 'utf8');
const nope = new Proxy({}, { get: () => () => { throw new Error('stub'); } });
let calls = 0; let mode = 'ok';
Object.assign(globalThis, { SpreadsheetApp: nope, CalendarApp: nope, MailApp: nope, UrlFetchApp: nope, DriveApp: nope, Logger: { log() {} },
  LanguageApp: { translate: (t, f, to) => { calls++; if (mode === 'throw') throw new Error('quota'); if (mode === 'same') return t; return '[KO]' + t; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) }, CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  Utilities: { formatDate: () => '2026-11-28' }, Session: { getScriptTimeZone: () => 'Europe/Berlin' }, ScriptApp: { getService: () => ({ getUrl: () => '' }) }, HtmlService: {}, MimeType: {}, LockService: {} });
const M = new Function(`${gs}
function getPrintInfo_(id){return {label:''};}
return {textNeedsKoTranslation_,translateToKo_,attachSelectNoteTranslations_,buildSelectPhotoLineHtml_,parseRevisionHistory_,selectSurveyHtml_};`)();
let fail = 0; const ok = (c, l, g) => { if (!c) { fail++; console.error('  ✗ ' + l + (g === undefined ? '' : ' — ' + JSON.stringify(g))); } };
ok(M.textNeedsKoTranslation_('Bitte die Haut glätten') && M.textNeedsKoTranslation_('Please remove the mole'), '독일어·영어 = 번역 대상');
ok(!M.textNeedsKoTranslation_('턱선 정리해 주세요') && !M.textNeedsKoTranslation_('턱선을 살짝 정리해 주세요 OK'), '한글 위주 = 번역 안 함');
ok(!M.textNeedsKoTranslation_('◎① (가운데)\n◎② (왼쪽 위)') && M.textNeedsKoTranslation_('Smooth skin\n◎① Kinn (가운데)'), '◎ 위치 낱말은 비율에서 제외');
ok(!M.textNeedsKoTranslation_('0283') && !M.textNeedsKoTranslation_(''), '숫자·빈칸은 번역 안 함');
calls = 0; ok(M.translateToKo_('Smooth skin') === '[KO]Smooth skin' && calls === 1, '번역 호출');
calls = 0; ok(M.translateToKo_('턱선 정리') === '' && calls === 0, '한국어는 호출 자체를 안 한다');
mode = 'throw'; ok(M.translateToKo_('Smooth skin') === '', '실패하면 빈 값(원문만 남음)'); mode = 'same';
ok(M.translateToKo_('OK OK') === '', '번역문이 원문과 같으면 빈 값'); mode = 'ok';
calls = 0;
const ph = M.attachSelectNoteTranslations_([{ num: '1', note: 'Smooth skin', noteKo: 'spoof' }, { num: '2', note: 'Smooth skin' }, { num: '3', note: '피부 정리', noteKo: 'spoof' }, { num: '4', note: '' }]);
ok(ph[0].noteKo === '[KO]Smooth skin' && ph[1].noteKo === '[KO]Smooth skin' && calls === 1, '같은 메모는 한 번만 번역', calls);
ok(!('noteKo' in ph[2]) && !('noteKo' in ph[3]), '한국어·빈 메모: 클라이언트가 보낸 noteKo 도 지운다');
const adminLine = M.buildSelectPhotoLineHtml_({ num: '1', note: 'Smooth skin', noteKo: '피부 매끈하게' }, false);
const custLine = M.buildSelectPhotoLineHtml_({ num: '1', note: 'Smooth skin', noteKo: '피부 매끈하게' }, false, 'en');
ok(/🇰🇷 번역<\/b> 피부 매끈하게/.test(adminLine) && !/번역/.test(custLine), '사장님 알림에만 번역(고객 영수증엔 없음)');
ok(/&lt;b&gt;/.test(M.buildSelectPhotoLineHtml_({ num: '1', note: 'x', noteKo: '<b>' }, false)), '번역문 escape');
const hist = M.parseRevisionHistory_(JSON.stringify([{ count: 1, requestedAt: 'x', note: 'Bitte heller', noteKo: '더 밝게', addendum: true }]));
ok(hist[0].noteKo === '더 밝게' && hist[0].addendum === true, '재수정 이력이 noteKo·addendum 보존', hist[0]);
calls = 0;
ok(/🇰🇷 번역/.test(M.selectSurveyHtml_({ skin: 4, note: 'like last time' }, 'ko', true)) && !/번역/.test(M.selectSurveyHtml_({ skin: 4, note: 'like last time' }, 'en')), '설문 한마디: 사장님 알림에만 번역');
ok((gs.match(/attachSelectNoteTranslations_\(photos\);/g) || []).length === 2, '셀렉 제출·수정 두 경로');
ok(/const noteKo=translateToKo_\(note\);/.test(gs) && /\$\{koTranslationHtml_\(noteKo\)\}/.test(gs) && /const noteKoAdd=translateToKo_\(note\);/.test(gs) && /\$\{koTranslationHtml_\(noteKoAdd\)\}/.test(gs), '재수정 새 요청·추가 코멘트 메일에 번역');
ok(/p&&p\.noteKo\?/.test(admin) && /item\.noteKo\?/.test(admin), 'ERP 제출 모달·재수정 이력에 번역');
if (fail) { console.error(`\n✗ 한국어 번역 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 외국어 요청 → 사장님용 한국어 번역(셀렉 메모·설문 한마디·재수정) — 판정·실패 폴백·고객 미노출·이력 보존');
