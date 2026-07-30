#!/usr/bin/env node
/**
 * check-quote-convert.mjs — 견적→예약 전환의 메모·촬영장소 확정 규칙 검증기
 *
 * 모달이 견적서 내용을 채워 보여주고(장소·메모) 사장님이 편집하면 그 값이 예약에 반영된다.
 * 위험 포인트 2개를 소스에서 못박는다:
 *   1) 메모: 모달은 전체 편집본을 memoReplace:true 로 보낸다 — 안 그러면 서버가 견적 메모 + 편집본을
 *      **이어붙여 중복**된다(견적 메모가 두 번 들어감). 에이전트/구경로는 append 유지.
 *   2) 장소: 모달이 채운 값이 authority(locationProvided) — 사장님이 비우면 '없음'으로 존중해야지,
 *      서버가 견적 메모에서 도로 추출하면 편집이 무시된다.
 *
 * 재구현이 아니라 Code.gs 원본 함수를 떼어내 돌린다.
 * 사용법:  node scripts/check-quote-convert.mjs        (불일치 시 exit 1)
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript/Code.gs'), 'utf8');
const html = readFileSync(join(ROOT, 'appscript/AdminV2.html'), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} 을 찾지 못했습니다.`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`${name} 본문 끝을 찾지 못했습니다.`);
}

const MODULE = [
  extractFn(gs, 'extractBookingLocationFromText_'),
  extractFn(gs, 'resolveQuoteConvertMemoLocation_'),
  'export { resolveQuoteConvertMemoLocation_, extractBookingLocationFromText_ };',
].join('\n\n');

async function load(src) {
  const dir = mkdtempSync(join(tmpdir(), 'qconv-'));
  const file = join(dir, 'mod.mjs');
  writeFileSync(file, src);
  const mod = await import(pathToFileURL(file).href + `?t=${Math.random()}`);
  return { mod, dir };
}

async function runScenarios(M, rec) {
  const R = M.resolveQuoteConvertMemoLocation_;

  // ── 메모 ─────────────────────────────────────────────────────────────────
  // 모달 경로: 전체 편집본 replace — 견적 메모가 이미 편집본에 포함돼 있으니 중복 금지
  rec('memoReplace: 편집본 그대로', R({ memo: '원본 메모' }, { memo: '원본 메모 + 추가', memoReplace: true }).memoOut, '원본 메모 + 추가');
  rec('memoReplace: 비우면 빈 메모', R({ memo: '원본 메모' }, { memo: '', memoReplace: true }).memoOut, '');
  // 에이전트/구경로: append 유지(견적 메모 + 추가 메모)
  rec('append: 견적+추가 이어붙임', R({ memo: '견적 메모' }, { memo: '추가' }).memoOut, '견적 메모\n추가');
  rec('append: 추가 없으면 견적만', R({ memo: '견적 메모' }, {}).memoOut, '견적 메모');
  rec('append: 견적 없으면 추가만', R({ memo: '' }, { memo: '추가' }).memoOut, '추가');

  // ── 장소 ─────────────────────────────────────────────────────────────────
  const quoteWithLoc = { memo: '요청사항\n[촬영장소:프랑크푸르트 팔멘가르텐]' };
  // 모달이 추출값을 채워 보냄 → 그대로 authority
  rec('장소: 모달 제공값 사용', R(quoteWithLoc, { location: '팔멘가르텐 정문', locationProvided: true }).location, '팔멘가르텐 정문');
  // 사장님이 비움 → '없음'으로 존중(서버가 메모에서 도로 추출하면 안 됨)
  rec('장소: 비우면 없음으로 존중', R(quoteWithLoc, { location: '', locationProvided: true }).location, '');
  // 구경로(플래그 없음): 서버가 견적 메모에서 추출
  rec('장소: 플래그 없으면 메모에서 추출', R(quoteWithLoc, {}).location, '프랑크푸르트 팔멘가르텐');
  rec('장소: 플래그 없어도 명시값 우선', R(quoteWithLoc, { location: '직접 지정' }).location, '직접 지정');
  rec('장소: 라벨형 메모도 추출', R({ memo: 'Location: Rooftop Bar' }, {}).location, 'Rooftop Bar');
  rec('장소: 없으면 빈값', R({ memo: '장소 정보 없음 문장' }, {}).location, '');
}

// ── 구조 검증 — 전환 본체와 모달이 이 규칙을 실제로 쓰는지 못박는다 ────────────
const STRUCTURE = [
  ['전환 본체가 helper 로 메모·장소를 확정한다', () => /const resolved=resolveQuoteConvertMemoLocation_\(q,o\);/.test(gs)],
  ['전환 본체가 resolved.location 을 쓴다', () => /const quoteMeetingLocation=resolved\.location;/.test(gs)],
  ['전환 본체가 resolved.memoOut 을 쓴다', () => /const memoOut=resolved\.memoOut;/.test(gs)],
  ['옛 인라인 메모 concat 이 남아있지 않다', () => !/const memoOut=\[String\(q\.memo/.test(gs)],
  ['모달 opener 가 장소를 채운다', () => /qcv_location'\)\.value=extractQuoteLocationText\(q\.memo\)/.test(html)],
  ['모달 opener 가 메모를 채운다', () => /qcv_memo'\)\.value=String\(q\.memo\|\|''\)/.test(html)],
  ['모달 submit 가 memoReplace 를 보낸다', () => /o\.memoReplace=true;/.test(html)],
  ['모달 submit 가 locationProvided 를 보낸다', () => /o\.locationProvided=true;/.test(html)],
  ['모달 메모가 textarea 로 노출된다', () => /<textarea id="qcv_memo"/.test(html)],
];

const FAULTS = [
  ['memoReplace 무시(견적 메모와 편집본이 중복)',
    /const memoOut=\(o\.memoReplace===true\)\n\s*\? String\(o\.memo\|\|''\)\.trim\(\)/,
    "const memoOut=(false)\n    ? String(o.memo||'').trim()"],
  ['장소 authority 무시(비워도 메모에서 도로 추출)',
    /const location=\(o\.locationProvided===true\)\n\s*\? explicit/,
    "const location=(false)\n    ? explicit"],
];

let failures = 0;
const { mod: M, dir } = await load(MODULE);
let count = 0;
await runScenarios(M, (name, actual, expected) => {
  count += 1;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures += 1;
    console.error(`❌ ${name}\n   기대: ${JSON.stringify(expected)}\n   실제: ${JSON.stringify(actual)}`);
  }
});
rmSync(dir, { recursive: true, force: true });

let structureCount = 0;
STRUCTURE.forEach(([label, fn]) => {
  structureCount += 1;
  if (!fn()) { failures += 1; console.error(`❌ 구조 검증 실패: ${label}`); }
});

if (failures) { console.error(`\n총 ${failures}건 불일치 — 견적 전환 규칙이 깨졌습니다.`); process.exit(1); }
console.log(`행동 시나리오 ${count}건 + 구조 검증 ${structureCount}건`);
console.log('✅ 메모 append/replace · 장소 authority 모두 정확.');

for (const [label, pattern, replacement] of FAULTS) {
  if (!pattern.test(MODULE)) { console.error(`\n❌ 결함주입 대상 패턴을 못 찾음: ${label}`); process.exit(1); }
  const broken = MODULE.replace(pattern, replacement);
  const { mod: bm, dir: bd } = await load(broken);
  const diffs = [];
  try {
    await runScenarios(bm, (name, actual, expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) diffs.push(name);
    });
  } catch (e) { diffs.push('예외: ' + e.message); }
  rmSync(bd, { recursive: true, force: true });
  if (!diffs.length) { console.error(`\n❌ 결함을 심었는데 통과: ${label}`); process.exit(1); }
  console.log(`   결함 감지 OK — ${label} (${diffs.length}개 실패)`);
}
console.log(`✅ 결함 주입 ${FAULTS.length}/${FAULTS.length} 모두 감지`);
