#!/usr/bin/env node
/**
 * threads-post.mjs — 포트폴리오에 새로 올라온 촬영 세션을 Threads 에 자동 게시한다.
 *
 * 흐름: homepage_share.py 가 마케팅 동의 건을 portfolio-data.json 에 붙여 main 에 푸시 → 포트폴리오 배포 →
 *       .github/workflows/threads-post.yml 이 하루 두 번 이 스크립트를 돌려 한 번에 글 하나씩 올린다
 *       (새 세션 영어 글 → DE_DELAY_HOURS 뒤 같은 세션 독일어 글). 무엇을 올렸는지는 scripts/threads-state.json.
 * 설정·토큰 갱신: docs/threads-autopost.md
 *
 * 사용법
 *   node scripts/threads-post.mjs                       # 다음 차례 하나 게시 (THREADS_ACCESS_TOKEN 필요)
 *   node scripts/threads-post.mjs --dry-run             # 무엇을 올릴지만 출력 (API 호출·상태 기록 없음)
 *   node scripts/threads-post.mjs --session 1a5419      # 특정 세션 강제(베이스라인 세션도 가능)
 *   node scripts/threads-post.mjs --session 1a5419 --lang de
 *   node scripts/threads-post.mjs --plan                # 대기열 보기
 *   node scripts/threads-post.mjs --pack 1a5419 --out ~/Desktop/threads   # 수동 게시용: 사진+문구 폴더로 내보내기
 *   node scripts/threads-post.mjs --baseline            # 지금 있는 세션 전부 "자동 게시 안 함" 으로 표시
 *   node scripts/threads-post.mjs --refresh-token       # 장기 토큰 갱신(로컬에서만 — 새 토큰이 화면에 찍힌다)
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSessions, findSession, emptyState, planNext, pickVariant, imageUrls, recordPost,
  threadsClient, unreachableImages, LANGS,
} from './lib/threads-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA = join(ROOT, 'frontend/portfolio/portfolio-data.json');
const GALLERY_DIR = join(ROOT, 'frontend/portfolio/assets/gallery/1440');
const STATE = join(HERE, 'threads-state.json');

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const value = (n) => {
  const i = argv.indexOf(n);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
};

const now = value('--now') ? Date.parse(value('--now')) : Date.now();
const sessions = buildSessions(JSON.parse(readFileSync(DATA, 'utf8')));
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : emptyState();
const saveState = () => writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');

function summary(md) {
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}

async function main() {
  if (flag('--refresh-token')) {
    const r = await threadsClient({ token: process.env.THREADS_ACCESS_TOKEN }).refreshToken();
    console.log(`새 토큰 (${Math.round(r.expires_in / 86400)}일 유효). GitHub 시크릿 THREADS_ACCESS_TOKEN 을 이 값으로 바꾸세요:\n${r.access_token}`);
    return;
  }

  if (flag('--baseline')) {
    const before = new Set(state.baseline);
    for (const s of sessions) before.add(s.key);
    state.baseline = [...before].sort();
    saveState();
    console.log(`베이스라인 ${state.baseline.length}개 세션 — 자동 게시 대상에서 뺐습니다(--session 으로는 올릴 수 있음).`);
    return;
  }

  if (flag('--plan')) {
    const baseline = new Set(state.baseline);
    const rows = [...sessions].reverse().filter((s) => !baseline.has(s.key));
    console.log(`세션 ${sessions.length}개 · 베이스라인 ${baseline.size}개 · 자동 대상 ${rows.length}개`);
    for (const s of rows) {
      const st = state.sessions[s.key] || {};
      console.log(`  ${s.key}  ${s.category.padEnd(9)} ${s.photos.length}장  en:${st.en ? '✓' : '·'} de:${st.de ? '✓' : '·'}`);
    }
    const next = planNext({ sessions, state, now });
    console.log(next.skip ? `다음: 없음 — ${next.skip}` : `다음: ${next.session.key} (${next.lang})`);
    return;
  }

  if (value('--pack')) {
    const s = findSession(sessions, value('--pack'));
    if (!s) throw new Error(`세션 '${value('--pack')}' 을 찾지 못했습니다.`);
    const out = resolve(value('--out') || join(ROOT, 'tmp', 'threads', s.hash));
    mkdirSync(out, { recursive: true });
    s.photos.forEach((p, i) => copyFileSync(join(GALLERY_DIR, p.name), join(out, `${String(i + 1).padStart(2, '0')}.jpg`)));
    const { variant } = pickVariant({ session: s, state, now });
    for (const lang of LANGS) writeFileSync(join(out, `${lang}.txt`), variant[lang] + '\n');
    console.log(`${s.key} (${s.category}, ${variant.id}) → ${out}\n  사진 ${s.photos.length}장 + en.txt + de.txt`);
    return;
  }

  const plan = planNext({ sessions, state, now, force: { session: value('--session'), lang: value('--lang') } });
  if (plan.skip) {
    summary(`ℹ️ ${plan.skip}`);
    if (value('--session')) process.exitCode = 1;
    return;
  }
  const { session, lang } = plan;
  const { variant, isNew } = pickVariant({ session, state, now });
  const text = variant[lang];
  const images = imageUrls(session);
  const head = `**${session.key}** · ${session.category} · ${lang.toUpperCase()} · 템플릿 ${variant.id} · 사진 ${images.length}장`;

  if (flag('--dry-run')) {
    summary(`🧪 DRY-RUN — 실제로 올리지 않습니다.\n\n${head}\n\n${images.map((u) => `- ${u}`).join('\n')}\n\n\`\`\`\n${text}\n\`\`\``);
    return;
  }

  const bad = await unreachableImages(images);
  if (bad.length) {
    // 배포가 아직 안 끝난 경우 — 실패가 아니라 다음 실행으로 미룬다
    summary(`⏳ ${session.key}: 사진이 아직 사이트에 없습니다(배포 대기). 다음 실행에서 다시 시도합니다.\n${bad.map((b) => `- ${b}`).join('\n')}`);
    return;
  }

  const client = threadsClient({ token: process.env.THREADS_ACCESS_TOKEN, userId: process.env.THREADS_USER_ID || '' });
  const dup = await client.findRecentDuplicate(text, now);
  const result = dup ? { id: dup.id, permalink: dup.permalink } : await client.publish({ text, images });
  recordPost({ state, session, lang, variant, isNew, result, now });
  saveState();
  summary(`${dup ? '♻️ 이미 올라가 있던 글을 기록만 했습니다' : '✅ 게시했습니다'}\n\n${head}\n\n${result.permalink || result.id}`);
}

main().catch((e) => {
  console.error(`::error::${e.message}`);
  process.exit(1);
});
