#!/usr/bin/env node
// Threads 자동 게시 검사 (오프라인, 가짜 API).
// - 템플릿: 500자 이하, 해시태그 하나, 분야마다 en/de 모두, 포트폴리오에 있는 분야는 전부 템플릿이 있다
// - 세션 묶기·대표 사진·다음 게시 고르기·문구 회전·시즌 문구
// - API 호출 순서(단일/캐러셀), 중복 방지, 토큰이 에러 메시지에 안 남는지
//
// 실행: node scripts/check-threads-post.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES, CATEGORIES } from './lib/threads-templates.mjs';
import {
  buildSessions, orderPhotos, findSession, emptyState, planNext, pickVariant, recordPost,
  threadsClient, unreachableImages, sessionKeyOf, MAX_TEXT, MAX_IMAGES, DE_DELAY_HOURS, LANGS,
} from './lib/threads-core.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
let failed = 0;
const ok = (cond, msg) => {
  if (!cond) { failed++; console.error(`✗ ${msg}`); }
};
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}\n    기대: ${JSON.stringify(b)}\n    실제: ${JSON.stringify(a)}`);

// ── 템플릿 ──
const ids = new Set();
for (const [cat, list] of Object.entries(TEMPLATES)) {
  ok(list.filter((t) => !t.months).length >= 2, `${cat}: 시즌 아닌 템플릿이 2개 이상이어야 회전이 된다`);
  for (const t of list) {
    ok(!ids.has(t.id), `템플릿 id 중복: ${t.id}`);
    ids.add(t.id);
    for (const lang of LANGS) {
      const text = t[lang];
      ok(typeof text === 'string' && text.trim(), `${t.id}.${lang} 문구가 없다`);
      if (!text) continue;
      ok([...text].length <= MAX_TEXT, `${t.id}.${lang} ${[...text].length}자 — ${MAX_TEXT}자 한도 초과`);
      ok((text.match(/#/g) || []).length === 1, `${t.id}.${lang}: 해시태그는 정확히 하나`);
      ok(/Studio mean/.test(text), `${t.id}.${lang}: 스튜디오 이름이 들어가야 한다`);
      ok(/(comment|komment)/i.test(text), `${t.id}.${lang}: 댓글 유도 문구가 있어야 한다`);
      ok(!/Fotograf(in)?\b/.test(text), `${t.id}.${lang}: 성별 직업명(Fotograf/Fotografin) 금지`);
    }
    if (t.months) ok(t.months.every((m) => m >= 1 && m <= 12), `${t.id}: months 는 1~12`);
  }
}

// ── 실제 포트폴리오 데이터 ──
const data = JSON.parse(readFileSync(join(ROOT, 'frontend/portfolio/portfolio-data.json'), 'utf8'));
const real = buildSessions(data);
for (const p of data.photos) ok(sessionKeyOf(p.name), `파일명 형식이 sm_<6>_<6hex>_<NN>.jpg 가 아니다: ${p.name}`);
for (const s of real) ok(CATEGORIES.includes(s.category), `${s.key}: '${s.category}' 분야 템플릿이 없다`);
eq(real.reduce((n, s) => n + s.photos.length, 0), data.photos.length, '세션으로 묶은 사진 수 = JSON 사진 수 (10장 넘는 세션이 생기면 이 검사를 고칠 것)');
const fam = findSession(real, '1a5419');
ok(fam && fam.key === 'sm_260724_1a5419' && fam.category === 'family', '해시로 세션 찾기 (1a5419)');
eq(findSession(real, 'sm_260724_1a5419_02.jpg')?.key, 'sm_260724_1a5419', '파일명으로 세션 찾기');
eq(findSession(real, 'zzzzzz'), null, '없는 세션은 null');
// 대표 사진은 세로 — 1a5419 의 03 은 가로
ok(fam.photos[0].h >= fam.photos[0].w, '대표 사진은 세로 사진');

// ── 사진 순서 ──
eq(orderPhotos([{ index: 1, w: 1440, h: 960 }, { index: 2, w: 960, h: 1440 }, { index: 3, w: 960, h: 1440 }]).map((p) => p.index), [2, 1, 3], '첫 장이 가로면 첫 세로 사진을 앞으로');
eq(orderPhotos(Array.from({ length: 14 }, (_, i) => ({ index: i + 1, w: 960, h: 1440 }))).length, MAX_IMAGES, `최대 ${MAX_IMAGES}장`);

// ── 다음 게시 고르기 ──
const mk = (key, category = 'family') => ({ key, hash: key.slice(-6), category, photos: [{ name: `${key}_01.jpg`, w: 960, h: 1440, index: 1 }] });
// JSON 순서: 최신이 앞
const S = [mk('sm_261120_cccccc', 'snap'), mk('sm_261101_bbbbbb', 'kids'), mk('sm_261001_aaaaaa', 'portrait')];
const t0 = Date.parse('2026-11-24T09:00:00Z');
let st = emptyState();
st.baseline = ['sm_261001_aaaaaa'];
eq(planNext({ sessions: S, state: st, now: t0 }).session?.key, 'sm_261101_bbbbbb', '베이스라인 빼고 오래된 세션부터');
eq(planNext({ sessions: S, state: st, now: t0 }).lang, 'en', '영어 먼저');

const v1 = pickVariant({ session: S[1], state: st, now: t0 });
recordPost({ state: st, session: S[1], lang: 'en', variant: v1.variant, isNew: v1.isNew, result: { id: 'p1' }, now: t0 });
eq(planNext({ sessions: S, state: st, now: t0 + 3600e3 }).session?.key, 'sm_261120_cccccc', '독일어 간격 전이면 다음 세션 영어');
const v2 = pickVariant({ session: S[0], state: st, now: t0 });
recordPost({ state: st, session: S[0], lang: 'en', variant: v2.variant, isNew: v2.isNew, result: { id: 'p2' }, now: t0 + 3600e3 });
const waiting = planNext({ sessions: S, state: st, now: t0 + 2 * 3600e3 });
ok(waiting.skip && waiting.skip.includes('독일어'), '모두 영어만 올렸고 간격 전이면 기다린다');
const de = planNext({ sessions: S, state: st, now: t0 + DE_DELAY_HOURS * 3600e3 });
eq([de.session?.key, de.lang], ['sm_261101_bbbbbb', 'de'], `영어 뒤 ${DE_DELAY_HOURS}시간 지나면 독일어`);
const vde = pickVariant({ session: S[1], state: st, now: t0 });
eq([vde.variant.id, vde.isNew], [v1.variant.id, false], '독일어는 영어와 같은 템플릿');
recordPost({ state: st, session: S[1], lang: 'de', variant: vde.variant, isNew: vde.isNew, result: { id: 'p3' }, now: t0 + DE_DELAY_HOURS * 3600e3 });
eq(st.counters.kids, 1, '독일어는 카운터를 올리지 않는다');

// 강제
eq(planNext({ sessions: S, state: st, now: t0, force: { session: 'aaaaaa' } }).session?.key, 'sm_261001_aaaaaa', '베이스라인 세션도 강제 가능');
ok(planNext({ sessions: S, state: st, now: t0, force: { session: 'bbbbbb' } }).skip, '두 언어 다 올린 세션 강제 → 건너뜀');
eq(planNext({ sessions: S, state: st, now: t0, force: { session: 'bbbbbb', lang: 'de' } }).lang, 'de', 'lang 지정 강제는 재게시');
ok(planNext({ sessions: S, state: st, now: t0, force: { session: 'nope' } }).skip, '없는 세션 강제 → 건너뜀');

// 회전: 같은 분야 세 번 → 서로 다른 템플릿 (11월은 snap 시즌 문구 포함)
{
  const s2 = emptyState();
  const seen = [];
  const june = Date.parse('2026-06-10T10:00:00Z');
  for (let i = 0; i < 4; i++) {
    const sess = mk(`sm_2606${10 + i}_00000${i}`, 'snap');
    const v = pickVariant({ session: sess, state: s2, now: june });
    recordPost({ state: s2, session: sess, lang: 'en', variant: v.variant, isNew: v.isNew, result: { id: String(i) }, now: june });
    seen.push(v.variant.id);
  }
  eq(seen, ['snap-1', 'snap-2', 'snap-3', 'snap-1'], '6월 snap 회전 (시즌 문구 제외)');
  const nov = pickVariant({ session: mk('sm_261124_ffffff', 'snap'), state: { ...s2, counters: { snap: 3 } }, now: Date.parse('2026-11-24T10:00:00Z') });
  eq(nov.variant.id, 'snap-xmas', '11월에는 크리스마스 문구가 회전에 들어간다');
}
try {
  pickVariant({ session: mk('sm_261124_eeeeee', 'nope'), state: emptyState(), now: t0 });
  ok(false, '없는 분야는 에러');
} catch (e) { ok(/템플릿이 없습니다/.test(e.message), '없는 분야 에러 메시지'); }

// ── API (가짜) ──
function fakeApi({ posts = [], failCode } = {}) {
  const calls = [];
  const polled = {};
  let n = 0;
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const params = Object.fromEntries(init.body ? new URLSearchParams(init.body) : u.searchParams);
    calls.push({ method: init.method, path: u.pathname.replace('/v1.0', ''), params });
    const reply = (status, body) => ({ ok: status < 400, status, json: async () => body, headers: { get: () => 'image/jpeg' } });
    if (failCode) return reply(400, { error: { code: failCode, message: 'Invalid OAuth access token' } });
    if (init.method === 'HEAD') return reply(u.pathname.includes('missing') ? 404 : 200, {});
    if (u.pathname.endsWith('/me')) return reply(200, { id: '42', username: 'studio' });
    if (u.pathname.endsWith('/42/threads') && init.method === 'GET') return reply(200, { data: posts });
    if (u.pathname.endsWith('/42/threads')) return reply(200, { id: `c${++n}` });
    if (u.pathname.endsWith('/42/threads_publish')) return reply(200, { id: 'm1' });
    if (params.fields === 'status,error_message') {
      // 처음 한 번은 처리 중, 다음부터 완료
      const id = u.pathname.split('/').pop();
      polled[id] = (polled[id] || 0) + 1;
      return reply(200, { status: polled[id] > 1 ? 'FINISHED' : 'IN_PROGRESS' });
    }
    if (params.fields === 'permalink') return reply(200, { permalink: 'https://www.threads.net/@studio/post/x' });
    return reply(404, { error: { message: 'unexpected' } });
  };
  return { calls, fetchImpl };
}
const noSleep = async () => {};

{
  const api = fakeApi();
  const c = threadsClient({ token: 'SECRET', fetchImpl: api.fetchImpl, sleep: noSleep });
  const r = await c.publish({ text: 'hello', images: ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg'] });
  eq(r, { id: 'm1', permalink: 'https://www.threads.net/@studio/post/x' }, '캐러셀 게시 결과');
  const posts = api.calls.filter((c) => c.method === 'POST');
  eq(posts.map((c) => c.params.media_type || 'publish'), ['IMAGE', 'IMAGE', 'IMAGE', 'CAROUSEL', 'publish'], '캐러셀 호출 순서');
  ok(posts.slice(0, 3).every((c) => c.params.is_carousel_item === 'true' && !c.params.text), '캐러셀 아이템에는 글 없이 is_carousel_item');
  eq(posts[3].params.children, 'c1,c2,c3', '캐러셀 children');
  eq(posts[3].params.text, 'hello', '캐러셀에 글');
  eq(posts[4].params.creation_id, 'c4', 'publish 는 캐러셀 컨테이너');
  ok(api.calls.every((c) => c.params.access_token === 'SECRET'), '모든 호출에 토큰');
}
{
  const api = fakeApi();
  const c = threadsClient({ token: 'SECRET', userId: '42', fetchImpl: api.fetchImpl, sleep: noSleep });
  await c.publish({ text: 'solo', images: ['https://x/1.jpg'] });
  const posts = api.calls.filter((c) => c.method === 'POST');
  eq(posts.map((c) => c.params.media_type || 'publish'), ['IMAGE', 'publish'], '사진 1장이면 단일 이미지 글');
  eq(posts[0].params.text, 'solo', '단일 이미지에 글');
  ok(!api.calls.some((c) => c.path === '/me'), 'THREADS_USER_ID 가 있으면 /me 를 부르지 않는다');
}
{
  const now = Date.parse('2026-11-24T10:00:00Z');
  const api = fakeApi({ posts: [
    { id: 'old', text: 'same', timestamp: '2026-11-20T10:00:00+0000', permalink: 'p-old' },
    { id: 'new', text: 'same', timestamp: '2026-11-24T02:00:00+0000', permalink: 'p-new' },
  ] });
  const c = threadsClient({ token: 'T', fetchImpl: api.fetchImpl, sleep: noSleep });
  eq((await c.findRecentDuplicate('same', now))?.id, 'new', '24시간 안의 같은 글만 중복으로 본다');
  eq(await c.findRecentDuplicate('other', now), null, '다른 글은 중복 아님');
}
{
  const api = fakeApi({ failCode: 190 });
  const c = threadsClient({ token: 'SUPERSECRET', fetchImpl: api.fetchImpl, sleep: noSleep });
  try {
    await c.me();
    ok(false, '토큰 오류는 예외');
  } catch (e) {
    ok(/토큰 갱신/.test(e.message), '190 오류에 토큰 갱신 안내');
    ok(!e.message.includes('SUPERSECRET'), '에러 메시지에 토큰이 없다');
  }
}
{
  let threw = false;
  try { threadsClient({ token: '' }); } catch { threw = true; }
  ok(threw, '토큰 없으면 바로 에러');
}
{
  const api = fakeApi();
  eq((await unreachableImages(['https://x/ok.jpg', 'https://x/missing.jpg'], api.fetchImpl)).length, 1, '배포 안 된 사진 찾기');
}

// ── 상태 파일 ──
{
  const state = JSON.parse(readFileSync(join(ROOT, 'scripts/threads-state.json'), 'utf8'));
  ok(state.version === 1 && Array.isArray(state.baseline) && state.counters && state.sessions, 'threads-state.json 형식');
}

if (failed) {
  console.error(`\nthreads-post: ${failed}개 실패`);
  process.exit(1);
}
console.log('threads-post: OK');
