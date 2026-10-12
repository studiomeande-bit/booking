#!/usr/bin/env node
/**
 * check-select-marks.mjs — 셀렉 보정 위치 표시(동그라미) 저장·표시 규칙
 *
 * 왜(2026-10-12 사장님 확정 "동그라미로"): 고객이 사진 위에 그린 동그라미는 선택사진 JSON 의 photo.marks 에 저장되고,
 *   메모 끝에 '◎① 글 (위치)' 줄이 붙어 메일·어드민·작업지시서가 그대로 읽는다. 화면은 그 줄을 떼고 marks 로 다시 그린다.
 *   ① 서버 정규화(최대 12개·좌표 0~100·반지름 1~50·글 120자) ② 옛 ◎ 줄은 떼고 다시 붙임(수정 제출마다 겹쳐 쌓이지 않게)
 *   ③ 화면은 ◎ 줄을 떼고, 표시가 있으면 요청사항이 비어도 완성 행 — 셋 중 하나가 깨지면 메모가 중복되거나 표시가 사라진다.
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const selectJs = readFileSync(join(ROOT, 'frontend', 'select', 'v2', 'select.js'), 'utf8');
const nope = new Proxy({}, { get: () => () => { throw new Error('stub'); } });
Object.assign(globalThis, { SpreadsheetApp: nope, CalendarApp: nope, MailApp: nope, UrlFetchApp: nope, DriveApp: nope, Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  Utilities: { formatDate: () => '2026-10-12' }, Session: { getScriptTimeZone: () => 'Europe/Berlin' },
  ScriptApp: { getService: () => ({ getUrl: () => '' }) }, HtmlService: {}, MimeType: {}, LockService: {} });
const M = new Function(`${gs}
function getPrintInfo_(id){return {label:''};}
return {enrichSelectPhoto_,normalizeSelectMarks_,selectNoteWithMarks_,buildSelectPhotoLineHtml_};`)();
let fail = 0;
const ok = (c, label, got) => { if (c) return; fail++; console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`); };

const marks = M.normalizeSelectMarks_([{ x: 50, y: 40, r: 10, t: ' 턱선  정리 ' }, { x: 999, y: -5, r: 0.2, t: 'x'.repeat(200) }, 'junk', { x: 'a', y: 'b' }]);
ok(marks.length === 3 && marks[0].t === '턱선 정리' && marks[1].x === 100 && marks[1].y === 0 && marks[1].r === 1 && marks[1].t.length === 120 && marks[2].x === 0 && marks[2].r === 5, '정규화: 좌표 0~100·반지름 1~50·글 120자·공백 정리·쓰레기 제거', marks);
ok(M.normalizeSelectMarks_(Array.from({ length: 20 }, () => ({ x: 1, y: 1, r: 3 }))).length === 12, '한 장 최대 12개');
ok(M.normalizeSelectMarks_(null).length === 0 && M.normalizeSelectMarks_('x').length === 0, '배열 아니면 빈 목록');

const p = M.enrichSelectPhoto_({ num: '0031', note: '전체적으로 자연스럽게\n◎① 옛 줄 (위)\n◎② 또 옛 줄 (아래)', marks: [{ x: 50, y: 40, r: 10, t: '턱선 정리' }, { x: 20, y: 80, r: 4, t: '배경 얼룩 제거' }] });
ok(p.note === '전체적으로 자연스럽게\n◎① 턱선 정리 (가운데)\n◎② 배경 얼룩 제거 (왼쪽 아래)', '메모 = 고객 글 + ◎ 줄(옛 ◎ 줄은 먼저 뗀다 — 수정 제출마다 겹치지 않게)', p.note);
ok(Array.isArray(p.marks) && p.marks.length === 2, 'marks 는 JSON 에 그대로 남는다(화면이 다시 그린다)');
const twice = M.enrichSelectPhoto_(p);
ok(twice.note === p.note, '두 번 거쳐도 같은 메모(멱등)', twice.note);
ok(M.enrichSelectPhoto_({ num: '1', note: '', marks: [{ x: 10, y: 10, r: 5, t: '' }] }).note === '◎① (왼쪽 위)', '글 없는 동그라미는 위치만');
ok(M.enrichSelectPhoto_({ num: '1', note: '그냥 글', marks: [] }).note === '그냥 글', '표시 없으면 메모 그대로');
ok(/◎① 턱선 정리 \(가운데\)/.test(M.buildSelectPhotoLineHtml_(p, true, 'ko')), '관리자 알림·영수증의 사진 줄에 ◎ 줄이 실린다');

// 화면 배선(소스 구조)
ok(/note: stripMarkLines\(String\(photo\?\.note \|\| ''\)\),/.test(selectJs) && /marks: normalizeMarks\(photo\?\.marks\),/.test(selectJs), '화면: 복원 때 ◎ 줄을 떼고 marks 로 다시 그린다');
ok(/const MARK_LINE_RE = \/\^◎\[①-⑫\]\/;/.test(selectJs), '화면 ◎ 줄 판별 = 서버와 같은 접두어');
ok(/return !!String\(photo\?\.num \|\| ''\)\.trim\(\) && photoHasRequest\(photo\);/.test(selectJs), '표시 글이 있으면 요청사항이 비어도 완성 행');
ok(/marks: normalizeMarks\(photo\.marks\),/.test(selectJs) && /JSON\.stringify\(p\.marks \|\| \[\]\)\]/.test(selectJs), '제출 payload·요청 서명에 marks');
ok(/const MARK_MAX = 12;/.test(selectJs) && /SELECT_MARK_MAX_=12;/.test(gs), '최대 개수 화면=서버');

if (fail) { console.error(`\n✗ 셀렉 동그라미 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 셀렉 보정 위치 표시 — 정규화·메모 합성(멱등)·알림 표시·화면 배선 일치');
