#!/usr/bin/env node
/* board-api 생성기 — appscript/Code.gs 에서 오늘촬영 보드 읽기 경로만 추출해
   appscript-board/Board.gs 를 만든다.

   왜 별도 프로젝트인가: 메인 Code.gs 는 2MB 라 /exec 요청마다 4.5~8초의 로드 고정비가 붙는다
   (시트 작업이 전혀 없는 warmup 라우트 실측 2026-08-31). 보드는 1분 폴링이라 이 비용이 가장 크다.
   읽기 전용 경로만 작은 프로젝트로 떼면 왕복이 ~1-2초로 준다.

   왜 생성기인가: 손 복사본은 하루 만에 어긋난다(셀렉 v1/v2 전례). 정본은 Code.gs 하나로 두고,
   Code.gs 의 보드 경로를 고치면 이 스크립트를 다시 돌려 재생성한다:

     node scripts/build-board-api.mjs        # 재생성
     cd appscript-board && clasp push -f && clasp deploy -i <deploymentId>

   추출 규칙: 이 파일 포맷 전제 — 최상위 함수는 `function NAME(` 로 시작해 컬럼 0 의 `}` 로 끝나고,
   최상위 const 는 한 줄이거나 컬럼 0 의 `};` 로 끝난다. 중괄호 카운팅을 안 쓰는 이유는
   정규식/템플릿 리터럴 안의 중괄호 오파싱을 피하기 위해서다.
   ponytail: 포맷 전제 기반 추출 — Code.gs 포맷터가 바뀌면 이 스크립트도 손봐야 한다 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'appscript', 'Code.gs');
const OUT = path.join(ROOT, 'appscript-board', 'Board.gs');

const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split('\n');

// ── 인덱싱: 최상위 함수/상수 정의 위치 ──────────────────────────────
const fnDefs = new Map();   // name -> {start, end}  (라인 인덱스, end 포함)
const constDefs = new Map();
for (let i = 0; i < lines.length; i++) {
  let m = lines[i].match(/^function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
  if (m) {
    let end = i;
    if (!/^\}/.test(lines[i]) && !/\}\s*$/.test(lines[i].replace(/\{[^}]*\}/g, ''))) {
      // 한 줄 함수(`function X(){...}`)면 그 줄이 끝. 아니면 컬럼 0 의 `}` 를 찾는다.
      const oneLine = /^function[^{]*\{.*\}\s*;?\s*$/.test(lines[i]);
      if (!oneLine) {
        end = -1;
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\}/.test(lines[j])) { end = j; break; }
          if (/^function\s/.test(lines[j])) break; // 다음 함수를 만나면 포맷 전제 위반
        }
        if (end < 0) continue; // 추출 불가 — 목록에 없으면 나중에 경고로 드러난다
      }
    }
    fnDefs.set(m[1], { start: i, end });
    continue;
  }
  m = lines[i].match(/^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/);
  if (m) {
    let end = i;
    if (!/;\s*$/.test(lines[i])) {
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

// ── 클로저 계산 ─────────────────────────────────────────────────────
// 루트: 보드 캐시 진입점. Shim.gs 가 제공하는 것들은 추출에서 제외한다.
const ROOTS = ['buildTodayBoardCached_', 'buildTodayBoard_'];
const EXCLUDE_FN = new Set(['ensureSheets_']); // Shim.gs 가 제공
const wantFns = new Set();
const wantConsts = new Set();
const queue = [...ROOTS];

const bodyOf = (def) => lines.slice(def.start, def.end + 1).join('\n');

while (queue.length) {
  const name = queue.shift();
  if (wantFns.has(name) || EXCLUDE_FN.has(name)) continue;
  const def = fnDefs.get(name);
  if (!def) { console.error(`⚠️  함수 추출 실패: ${name} — Code.gs 포맷 확인 필요`); process.exitCode = 1; continue; }
  wantFns.add(name);
  const body = bodyOf(def);
  // 호출되는 최상위 함수 (`.foo(` 형태의 메서드 호출은 제외)
  for (const mm of body.matchAll(/(?<![.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
    const callee = mm[1];
    if (fnDefs.has(callee) && !wantFns.has(callee) && !EXCLUDE_FN.has(callee)) queue.push(callee);
  }
  // 참조되는 최상위 const
  for (const mm of body.matchAll(/(?<![.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\b/g)) {
    if (constDefs.has(mm[1])) wantConsts.add(mm[1]);
  }
}
// const 초기화식이 다른 const/함수를 참조하는 경우(BOOKING_COL=CONFIG..., PREP_COL=PREP_HEADERS...)
let grew = true;
while (grew) {
  grew = false;
  for (const c of [...wantConsts]) {
    const body = bodyOf(constDefs.get(c));
    for (const mm of body.matchAll(/(?<![.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\b/g)) {
      if (constDefs.has(mm[1]) && !wantConsts.has(mm[1])) { wantConsts.add(mm[1]); grew = true; }
      if (fnDefs.has(mm[1]) && !wantFns.has(mm[1]) && !EXCLUDE_FN.has(mm[1])) {
        // const 초기화식에서 함수를 부르는 경우는 이 코드베이스에 없다 — 생기면 경고만
        console.error(`⚠️  const ${c} 가 함수 ${mm[1]} 를 참조 — 수동 확인 필요`);
      }
    }
  }
}

// ── 조립 (원본 파일 순서 유지) ──────────────────────────────────────
const pieces = [];
for (const [name, def] of constDefs) if (wantConsts.has(name)) pieces.push(def);
for (const [name, def] of fnDefs) if (wantFns.has(name)) pieces.push(def);
pieces.sort((a, b) => a.start - b.start);

const header = `/* ⚠️ 생성 파일 — 직접 수정 금지.
 * 정본: appscript/Code.gs (보드 경로). 재생성: node scripts/build-board-api.mjs
 * 생성 시각: ${new Date().toISOString()}
 * 포함 함수 ${wantFns.size}개 / 상수 ${wantConsts.size}개. 라우팅·인증·시트 해석은 Shim.gs 에 있다. */
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, header + pieces.map(bodyOf).join('\n\n') + '\n');

console.log(`Board.gs 생성: 함수 ${wantFns.size}개, 상수 ${wantConsts.size}개, ${pieces.length}블록`);
console.log('함수:', [...wantFns].sort().join(', '));
console.log('상수:', [...wantConsts].sort().join(', '));
