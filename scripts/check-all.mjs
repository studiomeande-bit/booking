#!/usr/bin/env node
/**
 * check-all.mjs — 검사 게이트 단일 러너
 *
 * 왜 필요한가: 이 저장소에는 테스트 러너가 없고 `scripts/check-*.mjs` 26개가 그 자리를 대신한다.
 *   그런데 **아무도 전부 돌리지 않아서** 여러 게이트가 몇 주씩 빨간 채로 방치됐다
 *   (2026-09-23 점검: 26개 중 5개 실패, 전부 하네스 드리프트). 게이트가 빨간 걸 아무도 모르면
 *   게이트가 없는 것과 같다. 배포 전에 이 한 줄이면 전부 돌아간다.
 *
 * 사용법
 *   node scripts/check-all.mjs                 # 전부(오프라인). 하나라도 실패하면 exit 1
 *   node scripts/check-all.mjs --online        # verify-release-gate 의 라이브 항목까지 포함
 *   node scripts/check-all.mjs --future 120    # 시계를 120일 앞으로 — 날짜 픽스처 부패 조기 발견
 *   node scripts/check-all.mjs --only select   # 이름에 'select' 가 든 게이트만
 *   node scripts/check-all.mjs --quiet         # 실패한 게이트 출력만
 *
 * 배포 흐름: `docs/ops-checklist.md` — clasp push 전에 이걸 돌린다.
 */
import { readdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name, fallback) => {
  const i = argv.indexOf(name);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const ONLINE = flag('--online');
const QUIET = flag('--quiet');
const ONLY = value('--only', '');
const FUTURE = Number(value('--future', 0)) || 0;

const gates = readdirSync(HERE)
  .filter((f) => f.startsWith('check-') && f.endsWith('.mjs') && f !== 'check-all.mjs')
  .sort()
  .map((f) => ({ name: f.replace(/^check-|\.mjs$/g, ''), file: join(HERE, f), args: [] }));
// 릴리스 게이트는 라이브 API 도 본다 — 기본은 --offline(네트워크 없는 곳에서도 돌아가게)
if (existsSync(join(HERE, 'verify-release-gate.mjs'))) {
  gates.push({ name: 'release-gate', file: join(HERE, 'verify-release-gate.mjs'), args: ONLINE ? [] : ['--offline'] });
}
const targets = ONLY ? gates.filter((g) => g.name.includes(ONLY)) : gates;
if (!targets.length) {
  console.error(`--only "${ONLY}" 에 맞는 게이트가 없습니다. 있는 것: ${gates.map((g) => g.name).join(', ')}`);
  process.exit(2);
}

const preload = FUTURE ? ['--import', join(HERE, 'lib', 'shift-clock.mjs')] : [];
const env = FUTURE ? { ...process.env, CHECK_CLOCK_SHIFT_DAYS: String(FUTURE) } : process.env;

/* 게이트 하나가 멎으면 배포 단계가 통째로 멈춘다 — 전부 0.5초면 끝나는 것들이라 넉넉히 잡아도 충분하다.
   (`--online` 은 라이브 API 를 기다리므로 더 길게.) */
const TIMEOUT_MS = Number(value('--timeout', ONLINE ? 120000 : 60000));

function run(gate) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [...preload, gate.file, ...gate.args],
      { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let done = false;
    const finish = (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ...gate, code, out, ms: Date.now() - started });
    };
    const timer = setTimeout(() => {
      out += `\n⏱️ ${TIMEOUT_MS / 1000}초 안에 끝나지 않아 중단했습니다 — 무한 루프이거나 네트워크를 기다리는 중일 수 있습니다.`;
      child.kill('SIGKILL');
      finish(124);
    }, TIMEOUT_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (e) => { out += String(e.message); finish(-1); });
    child.on('close', (code) => finish(code));
  });
}

/** 동시 실행 — 게이트는 서로 독립이고 전부 읽기 전용이다. */
async function pool(items, limit) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await run(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** 한 줄 요약. 실패 게이트는 마지막 줄이 'Node.js v24…' 배너라 쓸모없다 — 실패 사유 줄을 찾아 쓴다. */
function summaryLine(out, failed) {
  const lines = out.trimEnd().split('\n').map((l) => l.trim()).filter(Boolean);
  if (failed) {
    const hit = lines.find((l) => /(^|\s)(Error|✗|❌|FAIL|실패|불일치|기대)/i.test(l) && !/^at\s/.test(l));
    if (hit) return hit.replace(/\s+/g, ' ').slice(0, 88);
  }
  const tail = [...lines].reverse().find((l) => !/^Node\.js v/.test(l)) || '';
  return tail.replace(/\s+/g, ' ').slice(0, 88);
}
const started = Date.now();
if (FUTURE) console.log(`⏩ 시계를 ${FUTURE}일 앞으로 밀고 실행합니다 (날짜 픽스처 부패 탐지)\n`);
const results = await pool(targets, Math.max(2, availableParallelism() - 1));

const failed = results.filter((r) => r.code !== 0);
if (!QUIET) {
  for (const r of results) {
    const mark = r.code === 0 ? '✅' : '❌';
    console.log(`${mark} ${r.name.padEnd(26)} ${String((r.ms / 1000).toFixed(1) + 's').padStart(6)}  ${summaryLine(r.out, r.code !== 0)}`);
  }
}
for (const r of failed) {
  console.log(`\n${'─'.repeat(72)}\n❌ ${r.name} (exit ${r.code})\n${'─'.repeat(72)}\n${r.out.trimEnd()}`);
}
const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n${failed.length ? '❌' : '✅'} 게이트 ${results.length}개 · 통과 ${results.length - failed.length} · 실패 ${failed.length} · ${secs}s`);
/* 오프라인 기본값 때문에 "전부 통과" 가 라이브 항목까지 봤다는 뜻으로 읽히면 안 된다(2026-09-25 적발:
   내부 단가 노출·select 루트 301 검사가 배포 흐름에서 한 번도 돌지 않았다). 배포 전에는 --online. */
if (!ONLINE && targets.some((g) => g.name === 'release-gate')) {
  console.log('⏭️ 라이브 항목 미검사(release-gate --offline): 내부 단가 노출 · 상품군 생존 · select 루트 301.'
    + ' **배포 전에는 `node scripts/check-all.mjs --online`**');
}
if (failed.length) {
  console.log(`실패: ${failed.map((r) => r.name).join(', ')}`);
  if (FUTURE) console.log(`⚠️ --future 실행이라 "지금은 초록, ${FUTURE}일 뒤 빨강" 일 수 있습니다 — 옵션 없이 한 번 더 돌려 구분하세요.`);
  process.exit(1);
}
