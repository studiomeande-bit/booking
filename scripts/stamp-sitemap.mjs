#!/usr/bin/env node
/* 사이트맵 lastmod 를 파일의 실제 최종 수정일(git)로 맞춘다.
 *
 * 왜: lastmod 를 손으로 관리하다 8개 URL 이 실제보다 2~3개월 과거로 남아 있었다(2026-09-22 감사).
 * 틀린 lastmod 는 구글이 재크롤을 미루는 신호가 된다. 손으로 쓰지 말고 이걸 돌린다.
 *
 *   node scripts/stamp-sitemap.mjs           # 사이트맵 갱신
 *   node scripts/stamp-sitemap.mjs --check   # 어긋난 게 있으면 비정상 종료(배포 게이트용)
 *
 * 작업트리에 커밋 안 된 변경이 있는 파일은 오늘 날짜로 본다(곧 배포될 것이므로).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'frontend/portfolio');
const SITEMAP = join(SITE, 'sitemap.xml');
const CHECK = process.argv.includes('--check');
const TODAY = new Date().toISOString().slice(0, 10);

const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();

function fileFor(loc) {
  const path = new URL(loc).pathname.replace(/^\/|\/$/g, '');
  const f = join(SITE, path, 'index.html');
  return existsSync(f) ? f : null;
}

function lastmodFor(file) {
  const rel = file.slice(ROOT.length + 1);
  if (sh(`git status --porcelain -- "${rel}"`)) return TODAY;   // 아직 커밋 안 된 변경
  const d = sh(`git log -1 --format=%ad --date=short -- "${rel}"`);
  return d || TODAY;
}

let xml = readFileSync(SITEMAP, 'utf8');
const drift = [];
xml = xml.replace(/<loc>([^<]+)<\/loc>(\s*)<lastmod>([^<]+)<\/lastmod>/g, (all, loc, gap, old) => {
  const file = fileFor(loc);
  if (!file) { drift.push(`${loc} — 파일을 못 찾음(경로 확인 필요)`); return all; }
  const now = lastmodFor(file);
  if (now !== old) drift.push(`${loc}  ${old} → ${now}`);
  return `<loc>${loc}</loc>${gap}<lastmod>${now}</lastmod>`;
});

if (!drift.length) { console.log('sitemap lastmod: 이미 맞음'); process.exit(0); }
drift.forEach((d) => console.log('  ' + d));
if (CHECK) { console.error(`sitemap lastmod 어긋남 ${drift.length}건 — node scripts/stamp-sitemap.mjs 실행할 것`); process.exit(1); }
writeFileSync(SITEMAP, xml);
console.log(`sitemap lastmod ${drift.length}건 갱신`);
