#!/usr/bin/env node
/* 시트 날짜셀 비교 린터 — String(<셀>).slice(0,10|16) 를 parseDateSafe_ 없이 쓰면 잡는다.
   근거: appendRow 한 'yyyy-MM-dd' 문자열을 시트가 Date 객체로 자동 변환해 String(cell) 이
   'Wed Sep 03 …' 이 되고 비교가 영원히 불일치한다(2026-09-03 dayops '촬영 종료 자동 초기화',
   그 전엔 매출날짜). 셀은 반드시 parseDateSafe_(cell).str 로 정규화한 뒤 slice 할 것.
   사용: node scripts/check-sheet-date-compare.mjs  (위반 있으면 exit 1) */
import { readFileSync } from 'node:fs';
const files = ['appscript/Code.gs', 'appscript-board/Shim.gs'];
const re = /String\(\s*[A-Za-z_$][\w$]*(?:\[[^\]]+\])+\s*(?:\|\|\s*'')?\s*\)\s*\.slice\(0,\s*(?:10|16)\)/g;
let bad = 0;
for (const f of files) {
  const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('\n');
  src.forEach((line, i) => {
    if (re.test(line) && !line.includes('parseDateSafe_')) { bad++; console.log(`${f}:${i + 1}: ${line.trim().slice(0, 110)}`); }
    re.lastIndex = 0;
  });
}
console.log(bad ? `✗ 날짜셀 비교 위반 ${bad}건 — parseDateSafe_ 로 정규화할 것` : '✓ 날짜셀 비교 위반 없음');
process.exit(bad ? 1 : 0);
