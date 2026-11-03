#!/usr/bin/env node
/**
 * verify-gas-versions.mjs — 메인 Apps Script 배포 버전 수 경고
 *
 * 왜: Apps Script 프로젝트는 버전 200개가 한도다. 다 차면 `clasp deploy -i` 가 새 버전을 못 만들어
 *   /exec 웹앱 수정이 막힌다(휴무 중 긴급 수정 포함). 아무도 세지 않다가 2026-11-03 노션 정리 중
 *   실측 198/200 으로 발견. 삭제는 소유자만 — script.google.com 편집기 → 프로젝트 기록. clasp·API 엔 삭제가 없다.
 *
 * `node scripts/check-all.mjs --online` 이 돌린다(clasp 로그인·네트워크 필요). 단독 실행도 된다.
 * 사용량이 WARN_AT 이상이면 실패(exit 1) — 정리 전엔 긴급 수정만 남은 슬롯으로 배포.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');   // .clasp.json 이 있는 곳 = 메인 프로젝트
const LIMIT = 200;
const WARN_AT = 190;

let out;
try {
  out = execFileSync('clasp', ['versions'], { cwd: ROOT, encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  console.error(`❌ clasp versions 실패 — clasp 로그인·네트워크 확인: ${String(e.stderr || e.message).trim().slice(0, 200)}`);
  process.exit(1);
}
// clasp 출력: "Found 198 versions." + "1,031 - 설명" 줄들. 머리줄이 바뀌어도 줄 수로 센다.
const head = out.match(/Found (\d+) versions?/i);
const used = head ? Number(head[1]) : (out.match(/^\s*[\d,]+ - /gm) || []).length;
if (!used) {
  console.error(`❌ 버전 수를 읽지 못했습니다 — clasp 출력 형식 확인:\n${out.slice(0, 300)}`);
  process.exit(1);
}
const line = `Apps Script 배포 버전 ${used}/${LIMIT} · 남은 ${LIMIT - used}개`;
if (used >= WARN_AT) {
  console.log(`❌ ${line} — 실패: 옛 버전을 지우세요(script.google.com 편집기 → 프로젝트 기록, 소유자만).`
    + ' 정리 전엔 긴급 수정만 남은 슬롯으로 배포.');
  process.exit(1);
}
console.log(`✅ ${line}`);
