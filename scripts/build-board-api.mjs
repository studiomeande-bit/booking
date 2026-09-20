#!/usr/bin/env node
/* board-api 생성기 — appscript/Code.gs 에서 오늘촬영 보드 읽기 경로만 추출해 appscript-board/Board.gs 를 만든다.

   왜 별도 프로젝트인가: 메인 Code.gs 는 2MB 라 /exec 요청마다 4.5~8초의 로드 고정비가 붙는다
   (시트 작업이 전혀 없는 warmup 라우트 실측 2026-08-31). 보드는 1분 폴링이라 이 비용이 가장 크다.
   읽기 전용 경로만 작은 프로젝트로 떼면 왕복이 ~1-2초로 준다.

     node scripts/build-board-api.mjs        # 재생성
     cd appscript-board && clasp push -f && clasp deploy -i <deploymentId>

   추출기 본체는 scripts/gas-extract.mjs (public-api 생성기와 공유). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractClosure } from './gas-extract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = extractClosure({
  src: path.join(ROOT, 'appscript', 'Code.gs'),
  roots: ['buildTodayBoardCached_', 'buildTodayBoard_'],
  exclude: ['ensureSheets_'],                       // Shim.gs 가 제공
  out: path.join(ROOT, 'appscript-board', 'Board.gs'),
  label: 'node scripts/build-board-api.mjs',
  header: null,
});
if (r.failed) process.exitCode = 1;
console.log(`Board.gs 생성: 함수 ${r.fns.length}개, 상수 ${r.consts.length}개, ${r.blocks}블록`);
console.log('함수:', r.fns.join(', '));
console.log('상수:', r.consts.join(', '));
