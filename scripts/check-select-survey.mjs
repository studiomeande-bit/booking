#!/usr/bin/env node
/**
 * check-select-survey.mjs — 셀렉 보정 방향 설문(1~5) + 동그라미 구운 사진 저장 규칙
 *
 * 왜(2026-10-15 사장님 확정 "전체에 한 번 1~5로 묻고, 사진별 요구사항·표시"): 설문은 '보정설문JSON' 열 하나에 저장되고 메일·어드민·세션 복원이 읽는다.
 *   ① 정규화(축 4개 1~5, 기본 3 · keep 허용 목록 · note 120자) ② 전부 기본이면 빈 칸(= 표준, 메일에 줄 없음) ③ 제출·수정 두 경로 저장 + 메모리 row 갱신(메일이 읽는다)
 *   ④ 구운 사진: data:image/jpeg 만, 표시 없는 컷·클라이언트 markImageId 는 버림, base64 는 JSON 에 절대 남지 않음(셀 5만 자) ⑤ 화면 규칙 = 서버 규칙.
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const selectJs = readFileSync(join(ROOT, 'frontend', 'select', 'v2', 'select.js'), 'utf8');
const i18n = readFileSync(join(ROOT, 'frontend', 'select', 'v2', 'i18n.js'), 'utf8');
const html = readFileSync(join(ROOT, 'frontend', 'select', 'v2', 'index.html'), 'utf8');
const adminHtml = readFileSync(join(ROOT, 'appscript', 'AdminV2.html'), 'utf8');
const nope = new Proxy({}, { get: () => () => { throw new Error('stub'); } });
// Drive 스텁 — 세션 폴더 → '보정표시' 하위 폴더 → createFile
const created = []; const trashed = [];
const fakeFolder = (name) => ({ getName: () => name, getFolders: () => ({ hasNext: () => false }), createFolder: (n) => fakeFolder(n),
  getFilesByName: () => ({ hasNext: () => trashed.length === 0 && false, next: () => null }),
  createFile: (blob) => { created.push(blob.getName()); return { getId: () => 'newfile' + created.length + 'xxxxxxx' }; } });
Object.assign(globalThis, { SpreadsheetApp: nope, CalendarApp: nope, MailApp: nope, UrlFetchApp: nope, Logger: { log() {} },
  DriveApp: { getFolderById: () => fakeFolder('root') },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  Utilities: { formatDate: () => '2026-10-15', base64Decode: (s) => s, newBlob: (b, m, n) => ({ getName: () => n }) }, Session: { getScriptTimeZone: () => 'Europe/Berlin' },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://x/exec' }) }, HtmlService: {}, MimeType: {}, LockService: {} });
const M = new Function(`${gs}
function getPrintInfo_(id){return {label:''};}
function findChildFolderByName_(parent,name){ return null; }
return {normalizeSelectSurvey_,selectSurveyCell_,parseSelectSurveyCell_,selectSurveyText_,selectSurveyHtml_,saveSelectMarkImages_,buildSelectPhotoLineHtml_,enrichSelectPhoto_,SELECT_HEADERS,SELECT_COL,SELECT_SURVEY_AXES_,SELECT_SURVEY_KEEP_};`)();
let fail = 0;
const ok = (c, label, got) => { if (c) return; fail++; console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`); };

// ① 정규화
const n = M.normalizeSelectSurvey_({ skin: '5', face: 0, body: 'x', tone: 2.7, keep: ['moles', 'junk', 'moles', 'gray'], note: '  지난번  처럼 ' + 'x'.repeat(200) });
ok(n.skin === 5 && n.face === 3 && n.body === 3 && n.tone === 2 && n.keep.join() === 'moles,gray' && n.note.startsWith('지난번 처럼 x') && n.note.length === 120, '정규화: 1~5 밖·비숫자는 3, keep 허용목록·중복 제거, note 120자', n);
ok(M.SELECT_HEADERS[M.SELECT_HEADERS.length - 1] === '보정설문JSON' && M.SELECT_COL['보정설문JSON'] === M.SELECT_HEADERS.length - 1, "'보정설문JSON' 은 마지막 열(append-only)");
// ② 기본이면 빈 칸
ok(M.selectSurveyCell_({ skin: 3, face: 3, body: 3, tone: 3, keep: [], note: '' }) === '' && M.selectSurveyCell_(undefined) === '' && M.selectSurveyCell_({}) === '', '전부 기본값 = 빈 칸(표준 보정)');
const cell = M.selectSurveyCell_({ skin: 4, keep: ['scars'] });
ok(JSON.parse(cell).skin === 4 && JSON.parse(cell).face === 3, '기본 아닌 값은 JSON 저장', cell);
ok(M.parseSelectSurveyCell_('') === null && M.parseSelectSurveyCell_('{bad') === null && M.parseSelectSurveyCell_(cell).skin === 4, '셀 파싱: 빈·깨진 값은 null');
ok(M.selectSurveyText_(M.parseSelectSurveyCell_(cell), 'ko') === '피부 4 · 얼굴형·눈 3 · 체형 3 · 톤 3 · 지켜 주세요: 흉터·자국', '한 줄 요약(ko)', M.selectSurveyText_(M.parseSelectSurveyCell_(cell), 'ko'));
ok(/^Skin 4 · Face & eyes 3/.test(M.selectSurveyText_(M.parseSelectSurveyCell_(cell), 'en')) && /^Haut 4 · Gesicht & Augen 3/.test(M.selectSurveyText_(M.parseSelectSurveyCell_(cell), 'de')), '영·독 라벨');
ok(M.selectSurveyHtml_(null, 'ko') === '' && /<b>보정 방향:<\/b> 피부 4/.test(M.selectSurveyHtml_(M.parseSelectSurveyCell_(cell), 'ko')), '메일 블록: 표준이면 없음, 아니면 "보정 방향:"');
ok(/&lt;b&gt;/.test(M.selectSurveyHtml_({ note: '<b>' }, 'ko')), '한마디는 escape');
// ③ 두 경로 저장 + 메모리 row 갱신 + 메일 삽입
ok((gs.match(/selSh\.getRange\(rowNum,SELECT_COL\['보정설문JSON'\]\+1\)\.setValue\(_sv\); row\[SELECT_COL\['보정설문JSON'\]\]=_sv;/g) || []).length === 2, '제출·수정 두 경로 모두 저장하고 메모리 row 도 갱신(메일이 읽는다)');
ok((gs.match(/\$\{selectSurveyHtml_\(parseSelectSurveyCell_\(/g) || []).length === 2 && /const surveyHtml=selectSurveyHtml_\(parseSelectSurveyCell_\(/.test(gs) && /\$\{marksLinkHtml\}\$\{surveyHtml\}\$\{captureOneHtml\}/.test(gs), '관리자 제출·수정 알림 + 고객 접수확인에 설문 줄');
ok(/existingSurvey:parseSelectSurveyCell_\(/.test(gs) && /retouchSurvey:SELECT_COL\['보정설문JSON'\]/.test(gs), '세션 복원(existingSurvey)·대시보드(retouchSurvey)');
ok((gs.match(/saveSelectMarkImages_\(photos,row\);/g) || []).length === 2 && (gs.match(/\$\{selectMarksLinkHtml_\(row,photos\)\}/g) || []).length === 1 && /const marksLinkHtml=selectMarksLinkHtml_\(row,photos\);/.test(gs), '구운 사진 저장 두 경로 · 수정 알림에도 ERP 딥링크');
// ④ 구운 사진
const good = 'data:image/jpeg;base64,' + 'A'.repeat(100);
const photos = M.saveSelectMarkImages_([
  { num: '0031.JPG', marks: [{ x: 1, y: 1, r: 3, t: '' }], markImage: good, markImageId: 'client-spoof-id' },
  { num: '0040', marks: [], markImage: good, markImageId: 'client-spoof-id' },
  { num: '0050', marks: [{ x: 1, y: 1, r: 3, t: '' }], markImage: 'data:image/png;base64,AAAA' },
  { num: '0060', marks: [{ x: 1, y: 1, r: 3, t: '' }], markImage: 'data:image/jpeg;base64,' + 'A'.repeat(1600001) },
], { [M.SELECT_COL['드라이브링크']]: 'https://drive.google.com/drive/folders/1abcdefghijklmnop' });
ok(/^newfile1/.test(photos[0].markImageId) && created[0] === '0031_표시.jpg', '표시 컷 + jpeg data URL → 보정표시/<번호>_표시.jpg 저장, ID 기록', { id: photos[0].markImageId, created });
ok(!('markImageId' in photos[1]) && !('markImageId' in photos[2]) && !('markImageId' in photos[3]), '표시 없는 컷·png·1.2MB 초과는 저장 안 함 + 클라이언트 markImageId 제거');
ok(photos.every((p) => !('markImage' in p)), 'base64 는 JSON 에 절대 남지 않는다(시트 셀 5만 자)');
ok(created.length === 1, 'Drive 쓰기는 유효한 컷만');
const line = M.buildSelectPhotoLineHtml_({ num: '0031', note: '', marks: [{ x: 1, y: 1, r: 3, t: '' }], fileId: 'origfileid001', markImageId: 'bakedfileid01' }, false, 'ko');
ok(/thumbnail\?id=bakedfileid01&sz=w480/.test(line) && !/origfileid001/.test(line), '메일 사진 줄: 구운 사진 우선');
ok(/thumbnail\?id=origfileid001/.test(M.buildSelectPhotoLineHtml_({ num: '0031', note: '', marks: [{ x: 1, y: 1, r: 3, t: '' }], fileId: 'origfileid001' }, false, 'ko')), '구운 사진 없으면 원본 썸네일');
ok(/const baked=String\(\(photo&&photo\.markImageId\)\|\|''\);/.test(adminHtml) && /const circles=fileId===baked\?'':marks/.test(adminHtml), '어드민: 구운 사진이 있으면 그대로(겹쳐 그리기 없음)');
ok(/selectSurveyText\(sel\.retouchSurvey\)/.test(adminHtml), '어드민 제출 모달에 보정 방향 줄');
// ⑤ 화면 = 서버
const axesJs = selectJs.match(/const SURVEY_AXES = \[([^\]]+)\]/)[1].replace(/['\s]/g, '');
const keepJs = selectJs.match(/const SURVEY_KEEP = \[([^\]]+)\]/)[1].replace(/['\s]/g, '');
ok(axesJs === M.SELECT_SURVEY_AXES_.join(',') && keepJs === M.SELECT_SURVEY_KEEP_.join(','), '축·keep 키 화면=서버', { axesJs, keepJs });
ok(/survey: normalizeSurvey\(state\.survey\),/.test(selectJs) && /JSON\.stringify\(normalizeSurvey\(state\.survey\)\)\n  \]\);/.test(selectJs), '제출 payload·요청 서명에 설문');
ok(/state\.survey = normalizeSurvey\(state\.editMode \? session\.existingSurvey : null\);/.test(selectJs), '수정 모드 복원');
ok(/await buildMarkImages\(\);/.test(selectJs) && /markImage: photo\.marks\?\.length \? \(photo\._markImage \|\| ''\) : '',/.test(selectJs) && /img\.crossOrigin = 'anonymous'/.test(selectJs) && /lh3\.googleusercontent\.com\/d\//.test(selectJs), '제출 직전 구운 JPEG(crossOrigin, lh3)');
ok(/toDataURL\('image\/jpeg'/.test(selectJs), 'JPEG 로만 보낸다(서버 허용 형식)');
for (const lang of ['ko', 'en', 'de']) ok(new RegExp(`${lang}: \\{[\\s\\S]*?surveyAxes: \\{[\\s\\S]*?skin: \\{ label:[\\s\\S]*?tone: \\{ label:`).test(i18n), `i18n ${lang} 설문 축 라벨`);
ok(/id="surveyBox"/.test(html) && /id="surveyAxes"/.test(html) && /id="surveyKeep"/.test(html) && /id="surveyNote"/.test(html) && /id="reviewSurvey"/.test(html), '화면 요소(설문 박스·검토 줄)');
ok(/box\.classList\.toggle\('hidden', isReprintSession\(\)\)/.test(selectJs), '재주문 세션엔 설문 없음');

if (fail) { console.error(`\n✗ 셀렉 보정 설문 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 셀렉 보정 방향 설문(1~5) — 정규화·빈칸=표준·두 경로 저장·메일/어드민/복원·구운 사진 저장 규칙·화면=서버');
