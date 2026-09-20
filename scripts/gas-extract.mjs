/* Code.gs 에서 함수 폐쇄(closure)를 떼어 내는 공용 추출기 — build-board-api.mjs / build-public-api.mjs 가 쓴다.
   왜 생성기인가: 손 복사본은 하루 만에 어긋난다(셀렉 v1/v2 전례). 정본은 Code.gs 하나.
   추출 규칙(포맷 전제): 최상위 함수는 `function NAME(` 로 시작해 컬럼 0 의 `}` 로 끝나고, 최상위 const 는 한 줄이거나
   컬럼 0 의 `};` 로 끝난다. 중괄호 카운팅을 안 쓰는 이유는 정규식/템플릿 리터럴 안의 중괄호 오파싱을 피하기 위해서다.
   ponytail: 포맷 전제 기반 — Code.gs 포맷터가 바뀌면 여기를 손봐야 한다 */
import fs from 'node:fs';
import path from 'node:path';

export function extractClosure({ src, roots, exclude = [], out, label, header }) {
  const lines = fs.readFileSync(src, 'utf8').split('\n');
  const fnDefs = new Map();
  const constDefs = new Map();
  for (let i = 0; i < lines.length; i++) {
    let m = lines[i].match(/^function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
    if (m) {
      let end = i;
      if (!/^\}/.test(lines[i]) && !/\}\s*$/.test(lines[i].replace(/\{[^}]*\}/g, ''))) {
        const oneLine = /^function[^{]*\{.*\}\s*;?\s*$/.test(lines[i]);
        if (!oneLine) {
          end = -1;
          for (let j = i + 1; j < lines.length; j++) {
            if (/^\}/.test(lines[j])) { end = j; break; }
            if (/^function\s/.test(lines[j])) break;
          }
          if (end < 0) continue;
        }
      }
      fnDefs.set(m[1], { start: i, end });
      continue;
    }
    m = lines[i].match(/^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/);
    if (m) {
      let end = i;
      // 한 줄 const 뒤에 `// 주석` 이 붙으면 `;` 로 안 끝나 다중행으로 오판 → 끝을 못 찾아 통째로 빠졌다
      // (DAY_CHARS_·MORNING_BLOCK_CUTOFF_MIN, 2026-09-20). 꼬리 주석을 떼고 판정한다.
      if (!/;\s*$/.test(lines[i].replace(/\s*\/\/.*$/, ''))) {
        end = -1;
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\};?/.test(lines[j]) || /^\];?/.test(lines[j])) { end = j; break; }
          if (/^(function|const)\s/.test(lines[j])) break;
        }
        if (end < 0) continue;
      }
      constDefs.set(m[1], { start: i, end });
    }
  }
  const EXCLUDE_FN = new Set(exclude);
  const wantFns = new Set();
  const wantConsts = new Set();
  const queue = [...roots];
  const bodyOf = (def) => lines.slice(def.start, def.end + 1).join('\n');
  let failed = false;
  while (queue.length) {
    const name = queue.shift();
    if (wantFns.has(name) || EXCLUDE_FN.has(name)) continue;
    const def = fnDefs.get(name);
    if (!def) { console.error(`⚠️  함수 추출 실패: ${name} — Code.gs 포맷 확인 필요`); failed = true; continue; }
    wantFns.add(name);
    const body = bodyOf(def);
    /* 호출(`foo(`)뿐 아니라 이름만 넘기는 참조(`.map(parseTimeBlock_)`)도 따라간다 — 2026-09-20 public-api 첫 배포가
       'parseTimeBlock_ is not defined' 로 죽은 원인. 주석·문자열을 벗겨 내려다 정규식 리터럴·URL 의 따옴표/슬래시에
       걸려 코드가 통째로 지워졌다(formatHourMin_·DAY_CHARS_ 누락) — 원문 그대로 본다. 주석에 적힌 이름 때문에
       함수가 몇 개 더 들어오는 과포함은 무해하다(크기만 조금 큼); 누락은 런타임 사망이다. */
    for (const mm of body.matchAll(/(?<![.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\b/g)) {
      const callee = mm[1];
      if (fnDefs.has(callee) && !wantFns.has(callee) && !EXCLUDE_FN.has(callee)) queue.push(callee);
    }
    for (const mm of body.matchAll(/(?<![.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\b/g)) {
      if (constDefs.has(mm[1])) wantConsts.add(mm[1]);
    }
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of [...wantConsts]) {
      const body = bodyOf(constDefs.get(c));
      for (const mm of body.matchAll(/(?<![.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\b/g)) {
        if (constDefs.has(mm[1]) && !wantConsts.has(mm[1])) { wantConsts.add(mm[1]); grew = true; }
        if (fnDefs.has(mm[1]) && !wantFns.has(mm[1]) && !EXCLUDE_FN.has(mm[1])) {
          console.error(`⚠️  const ${c} 가 함수 ${mm[1]} 를 참조 — 수동 확인 필요`);
        }
      }
    }
  }
  const pieces = [];
  for (const [name, def] of constDefs) if (wantConsts.has(name)) pieces.push(def);
  for (const [name, def] of fnDefs) if (wantFns.has(name)) pieces.push(def);
  pieces.sort((a, b) => a.start - b.start);
  const head = header || `/* ⚠️ 생성 파일 — 직접 수정 금지.
 * 정본: appscript/Code.gs. 재생성: ${label}
 * 생성 시각: ${new Date().toISOString()}
 * 포함 함수 ${wantFns.size}개 / 상수 ${wantConsts.size}개. 라우팅·인증·시트 해석은 Shim.gs 에 있다. */
`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const code = head + pieces.map(bodyOf).join('\n\n') + '\n';
  fs.writeFileSync(out, code);
  // 정적 점검: 번들 안에서 호출되지만 어디에도(번들·Shim·플랫폼 전역) 정의되지 않은 이름
  const shimPath = path.join(path.dirname(out), 'Shim.gs');
  const shim = fs.existsSync(shimPath) ? fs.readFileSync(shimPath, 'utf8') : '';
  const defined = new Set([...wantFns, ...wantConsts, ...[...shim.matchAll(/^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1])]);
  const PLATFORM = new Set(['Utilities','CalendarApp','SpreadsheetApp','CacheService','PropertiesService','UrlFetchApp','ContentService','HtmlService','Logger','ScriptApp','LockService','MailApp','GmailApp','DriveApp','Session','Math','JSON','Date','String','Number','Array','Object','Boolean','RegExp','Error','Map','Set','parseInt','parseFloat','isFinite','isNaN','encodeURIComponent','decodeURIComponent','encodeURI','decodeURI','escape','unescape','Promise','Symbol','console','undefined','NaN','Infinity','arguments','this','new','typeof','instanceof','function','return','if','else','for','while','switch','case','break','continue','try','catch','finally','throw','var','let','const','in','of','do','void','delete','null','true','false','default','class','super','extends']);
  const undefinedCalls = new Set();
  const stripped = (code + '\n' + shim).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/`(?:\\.|[^`\\])*`/g, '""').replace(/'(?:\\.|[^'\\\n])*'/g, "''").replace(/"(?:\\.|[^"\\\n])*"/g, '""');
  for (const mm of stripped.matchAll(/(?<![.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
    const n = mm[1];
    if (!defined.has(n) && !PLATFORM.has(n) && !/^[A-Z][a-z]/.test(n) === false ? false : (!defined.has(n) && !PLATFORM.has(n))) undefinedCalls.add(n);
  }
  // 지역 함수/파라미터 이름은 오탐이 되므로 밑줄로 끝나는(내부 헬퍼 관례) 이름만 강하게 본다
  const suspicious = [...undefinedCalls].filter(n => /_$/.test(n) || /^[a-z]+[A-Z]/.test(n)).filter(n => !new RegExp('(?:function|const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b').test(stripped) && !new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\s*=\\s*function').test(stripped) && !new RegExp('\\(\\s*[^)]*\\b' + n.replace(/\$/g, '\\$') + '\\b[^)]*\\)\\s*(?:=>|\\{)').test(stripped));
  if (suspicious.length) console.error('⚠️  번들에 정의되지 않은 호출 의심:', suspicious.join(', '));
  return { fns: [...wantFns].sort(), consts: [...wantConsts].sort(), blocks: pieces.length, failed, code, suspicious };
}
