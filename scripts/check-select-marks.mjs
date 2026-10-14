#!/usr/bin/env node
/**
 * check-select-marks.mjs — 셀렉 보정 위치 표시(동그라미) 저장·표시 규칙
 *
 * 왜(2026-10-12 사장님 확정 "동그라미로"): 고객이 사진 위에 그린 동그라미는 선택사진 JSON 의 photo.marks 에 저장되고,
 *   메모 끝에 '◎① 글 (위치)' 줄이 붙어 메일·어드민·작업지시서가 그대로 읽는다. 화면은 그 줄을 떼고 marks 로 다시 그린다.
 *   ① 서버 정규화(최대 12개·좌표 0~100·반지름 1~50·글 120자) ② 옛 ◎ 줄은 떼고 다시 붙임(수정 제출마다 겹쳐 쌓이지 않게)
 *   ③ 화면은 ◎ 줄을 떼고, 표시가 있으면 요청사항이 비어도 완성 행 — 셋 중 하나가 깨지면 메모가 중복되거나 표시가 사라진다.
 *   ④ (2026-10-14) 표시 컷엔 서버가 세션 폴더에서 찾은 Drive 파일 ID 를 붙인다 — 어드민이 사진 위에 동그라미를 다시 그리고 메일이 썸네일을
 *      싣는 근거. 클라이언트가 보낸 fileId 는 버리고, 표시가 없으면 Drive 를 부르지 않는다(제출은 락 안).
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
const adminHtml = readFileSync(join(ROOT, 'appscript', 'AdminV2.html'), 'utf8');
const listCalls = [];
const M = new Function('listCalls', `${gs}
function getPrintInfo_(id){return {label:''};}
// 세션 폴더 목록 스텁 — 두 쪽(커서)으로 나눠 준다
function listSelectPhotosPublic_(sid,o){ listCalls.push(String((o&&o.cursor)||'')); const page=String((o&&o.cursor)||'')==='' ? {ok:true,photos:[{id:'abcdefghij12',name:'0031.JPG'}],nextCursor:'c2'} : {ok:true,photos:[{id:'kkkkkkkkkkkk',name:'0050.jpg'}],nextCursor:''}; return page; }
return {enrichSelectPhoto_,normalizeSelectMarks_,selectNoteWithMarks_,buildSelectPhotoLineHtml_,attachSelectMarkFileIds_,selectMarkThumbUrl_};`)(listCalls);
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

// ④ 표시 컷의 Drive 파일 ID — 서버가 찾고, 클라이언트 값은 버린다
const att = M.attachSelectMarkFileIds_([
  { num: '0031', marks: [{ x: 50, y: 40, r: 10, t: '' }], fileId: 'client-spoof-id' },
  { num: '0040', marks: [], fileId: 'client-spoof-id' },
  { num: '0050.JPG', marks: [{ x: 1, y: 1, r: 3, t: '' }] },
], 'sess-1');
ok(att[0].fileId === 'abcdefghij12' && att[2].fileId === 'kkkkkkkkkkkk', '표시 컷: 사진번호=파일명(확장자 제외)으로 세션 폴더에서 파일 ID', att.map((p) => p.fileId));
ok(!('fileId' in att[1]), '표시 없는 컷의 클라이언트 fileId 는 버린다', att[1]);
ok(listCalls.length === 2 && listCalls[1] === 'c2', '첫 쪽에 다 못 찾으면 커서를 따라간다', listCalls);
listCalls.length = 0;
M.attachSelectMarkFileIds_([{ num: '0031', marks: [], fileId: 'x' }], 'sess-1');
ok(listCalls.length === 0, '표시가 하나도 없으면 Drive 목록을 부르지 않는다(락 안 비용 0)');
ok(M.selectMarkThumbUrl_({ fileId: 'abcdefghij12' }, 480) === 'https://drive.google.com/thumbnail?id=abcdefghij12&sz=w480' && M.selectMarkThumbUrl_({ fileId: 'bad id' }) === '', '썸네일 URL 은 형식 맞는 ID 만');
const marked = M.enrichSelectPhoto_({ num: '0031', note: '', marks: [{ x: 50, y: 40, r: 10, t: '턱선' }] }); marked.fileId = 'abcdefghij12';
ok(/<img src="https:\/\/drive\.google\.com\/thumbnail\?id=abcdefghij12&sz=w480"/.test(M.buildSelectPhotoLineHtml_(marked, true, 'ko')), '메일 사진 줄: 표시 컷은 썸네일을 싣는다');
ok(!/<img/.test(M.buildSelectPhotoLineHtml_(p, true, 'ko')), '파일 ID 없으면(옛 제출) 썸네일 없이 ◎ 줄만');
ok(/\$\{marksLinkHtml\}\$\{captureOneHtml\}/.test(gs) && /\?p=admin&sel=\$\{encodeURIComponent\(String\(row\[SELECT_COL\['예약장부행'\]\]/.test(gs), '관리자 알림: 표시 컷 있으면 ERP 딥링크(?sel=예약행)');
ok((gs.match(/attachSelectMarkFileIds_\(photos,sessionId\);/g) || []).length === 2, '제출·수정 두 경로 모두 파일 ID 를 붙인다');

// 어드민: 사진 위에 동그라미(셀렉 화면과 같은 % 좌표)
const fnSrc = adminHtml.match(/function renderSelectMarksOverlay\(photo\)\{[\s\S]*?\n\}\n/);
ok(!!fnSrc, '어드민 renderSelectMarksOverlay 존재');
if (fnSrc) {
  const render = new Function(`function escHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}\n${fnSrc[0]}\nreturn renderSelectMarksOverlay;`)();
  const html = render({ fileId: 'abcdefghij12', marks: [{ x: 50, y: 40, r: 10, t: '턱선' }, { x: 20, y: 80, r: 4, t: '' }] });
  ok(/left:50%;top:40%;width:20%;aspect-ratio:1\/1/.test(html) && /left:20%;top:80%;width:8%/.test(html) && />①</.test(html) && />②</.test(html), '동그라미 = 중심 % · 지름 2r% · 번호 ①②(◎ 줄과 같은 순서)', html.slice(0, 300));
  ok(/thumbnail\?id=abcdefghij12&sz=w960/.test(html) && /file\/d\/abcdefghij12\/view/.test(html), '사진은 w960 썸네일, 클릭 = 원본');
  ok(/<img [^>]*referrerpolicy="no-referrer"/.test(html), 'Drive 썸네일은 no-referrer(구글 외 Referer 면 429 — 셀렉 화면과 동일)');
  ok(render({ fileId: 'bad id', marks: [{ x: 1, y: 1, r: 1 }] }) === '' && render({ fileId: 'abcdefghij12', marks: [] }) === '', '형식 틀린 ID·표시 없음이면 그림 없음');
  ok(/<span title="&lt;b&gt;"/.test(render({ fileId: 'abcdefghij12', marks: [{ x: 1, y: 1, r: 1, t: '<b>' }] })), '표시 글은 escape');
}
ok(/const marksHtml=renderSelectMarksOverlay\(p\);/.test(adminHtml) && /\$\{marksHtml\}<\/div><\/div>`;/.test(adminHtml), '제출 모달 사진 줄에 겹쳐 그린다');
ok(/google\.script\.url\.getLocation\(function\(loc\)\{ const want=parseInt\(\(loc&&loc\.parameter\|\|\{\}\)\.sel,10\)/.test(adminHtml) && /if\(pendingSelectView\)\{ const want=pendingSelectView; pendingSelectView=null;/.test(adminHtml), '메일 링크 ?sel=예약행 → 셀렉 목록 로드 뒤 그 제출 모달');

// 화면 배선(소스 구조)
ok(/note: stripMarkLines\(String\(photo\?\.note \|\| ''\)\),/.test(selectJs) && /marks: normalizeMarks\(photo\?\.marks\),/.test(selectJs), '화면: 복원 때 ◎ 줄을 떼고 marks 로 다시 그린다');
ok(/const MARK_LINE_RE = \/\^◎\[①-⑫\]\/;/.test(selectJs), '화면 ◎ 줄 판별 = 서버와 같은 접두어');
ok(/return !!String\(photo\?\.num \|\| ''\)\.trim\(\) && photoHasRequest\(photo\);/.test(selectJs), '표시 글이 있으면 요청사항이 비어도 완성 행');
ok(/marks: normalizeMarks\(photo\.marks\),/.test(selectJs) && /JSON\.stringify\(p\.marks \|\| \[\]\)\]/.test(selectJs), '제출 payload·요청 서명에 marks');
ok(/const MARK_MAX = 12;/.test(selectJs) && /SELECT_MARK_MAX_=12;/.test(gs), '최대 개수 화면=서버');

if (fail) { console.error(`\n✗ 셀렉 동그라미 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 셀렉 보정 위치 표시 — 정규화·메모 합성(멱등)·알림 표시·화면 배선 일치·파일 ID 부착·어드민 겹쳐 그리기·메일 딥링크');
