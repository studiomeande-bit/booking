#!/usr/bin/env node
/* 시트 날짜셀 린터 — String(<셀>).slice(0,10|16) 을 parseDateSafe_ 없이 쓰면 잡는다.
   근거: appendRow 한 'yyyy-MM-dd' 문자열을 시트가 Date 객체로 자동 변환해 String(cell) 이
   'Wed Sep 03 …' 이 되고, slice(0,10) 하면 'Wed Sep 03' 이 된다. 비교는 영원히 불일치하고
   화면에 그대로 찍히면 고객이 그 문자열을 본다.
   전례: 매출날짜 → dayops '촬영 종료 자동 초기화'(2026-09-03) → 셀렉 재발송
        → **셀렉 세션 촬영일**(2026-09-10, 모든 고객 화면에 'Sat Sep 05' 로 표시되고 있었다).
   셀은 반드시 parseDateSafe_(cell).str 로 정규화한 뒤 slice 할 것.

   ⚠ 2026-09-10: 종전 정규식이 `row[SELECT_COL['촬영일']]` 같은 **중첩 대괄호**를 못 잡았다.
   `\[[^\]]+\]` 가 안쪽 `]` 에서 끊겨 매칭이 실패했고, 정작 이 코드베이스의 지배적 패턴이 그것이라
   린터는 통과하는데 버그는 살아 있었다. 그래서 정규식 대신 괄호 균형으로 판정한다.

   사용: node scripts/check-sheet-date-compare.mjs  (위반 있으면 exit 1) */
import { readFileSync } from 'node:fs';

const files = ['appscript/Code.gs', 'appscript-board/Shim.gs'];

/* String( … ) 의 닫는 괄호를 균형으로 찾는다. 문자열 리터럴 안의 괄호는 세지 않는다. */
function matchParen(line, openIdx) {
  let depth = 0, quote = '';
  for (let i = openIdx; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '(') depth += 1;
    else if (ch === ')') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

/* 셀 접근인가 — ident[...] 형태. 중첩 대괄호를 허용한다. */
const CELL = /^[A-Za-z_$][\w$]*\s*\[/;

let bad = 0;
for (const f of files) {
  let src;
  try { src = readFileSync(new URL('../' + f, import.meta.url), 'utf8'); }
  catch { continue; }   // 선택적 파일(보드 Shim)은 없으면 건너뛴다
  src.split('\n').forEach((line, i) => {
    if (line.includes('parseDateSafe_')) return;           // 이미 정규화한 줄
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;           // 주석
    let from = 0;
    for (;;) {
      const at = line.indexOf('String(', from);
      if (at < 0) break;
      const close = matchParen(line, at + 'String'.length);
      if (close < 0) break;
      const inner = line.slice(at + 'String('.length, close).trim();
      const after = line.slice(close + 1);
      if (CELL.test(inner) && /^\s*\.slice\(\s*0\s*,\s*(10|16)\s*\)/.test(after)) {
        bad += 1;
        console.log(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
      }
      from = close + 1;
    }
  });
}

console.log(bad ? `✗ 날짜셀 위반 ${bad}건 — parseDateSafe_ 로 정규화할 것` : '✓ 날짜셀 위반 없음');
process.exit(bad ? 1 : 0);
