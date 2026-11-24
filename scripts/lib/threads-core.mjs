// Threads 자동 게시 — 순수 로직(세션 묶기·다음 게시 고르기·문구 고르기)과 Threads API 클라이언트.
// CLI 는 scripts/threads-post.mjs, 검사는 scripts/check-threads-post.mjs, 설명은 docs/threads-autopost.md.

import { TEMPLATES } from './threads-templates.mjs';

export const SITE = 'https://studio-mean.com';
export const GALLERY_URL = `${SITE}/assets/gallery/1440/`;
export const MAX_TEXT = 500; // Threads 글자 수 한도
export const MAX_IMAGES = 10; // 캐러셀은 20장까지 되지만 넘겨 보기 좋은 선에서 자른다
export const DE_DELAY_HOURS = 20; // 영어 글 뒤 독일어 글까지 최소 간격 — 같은 사진이 피드에 연달아 뜨지 않게
export const DUPLICATE_WINDOW_HOURS = 24; // 최근 이 시간 안에 같은 글이 있으면 이미 올라간 것으로 본다
export const LANGS = ['en', 'de'];

const NAME_RE = /^(sm_(\d{6})_([0-9a-f]{6}))_(\d{2})\.jpg$/i;

/** 파일명 → 세션 키(sm_<촬영일>_<해시>). 형식이 다르면 null. */
export function sessionKeyOf(name) {
  const m = NAME_RE.exec(name || '');
  return m ? m[1] : null;
}

/**
 * portfolio-data.json → 세션 목록. JSON 순서를 유지한다(homepage_share.py 가 새 세션을 맨 앞에 붙이므로 최신이 앞).
 * 각 세션: { key, date, hash, category, photos: [{name, w, h, index}] }
 */
export function buildSessions(data) {
  const map = new Map();
  for (const p of data?.photos || []) {
    const m = NAME_RE.exec(p.name || '');
    if (!m) continue;
    const [, key, date, hash, nn] = m;
    if (!map.has(key)) map.set(key, { key, date, hash: hash.toLowerCase(), photos: [], cats: new Map() });
    const s = map.get(key);
    s.photos.push({ name: p.name, w: Number(p.w) || 0, h: Number(p.h) || 0, index: Number(nn) });
    s.cats.set(p.category, (s.cats.get(p.category) || 0) + 1);
  }
  return [...map.values()].map((s) => {
    // 가장 많은 분야(동률이면 먼저 나온 것)
    let category = null;
    let best = -1;
    for (const [c, n] of s.cats) if (n > best) { best = n; category = c; }
    return { key: s.key, date: s.date, hash: s.hash, category, photos: orderPhotos(s.photos) };
  });
}

/** 번호 순으로 두되, 첫 장(대표 이미지)은 세로 사진으로. 최대 MAX_IMAGES 장. */
export function orderPhotos(photos) {
  const sorted = [...photos].sort((a, b) => a.index - b.index);
  const cover = sorted.findIndex((p) => p.h >= p.w);
  if (cover > 0) sorted.unshift(sorted.splice(cover, 1)[0]);
  return sorted.slice(0, MAX_IMAGES);
}

/** '1a5419' · 'sm_260724_1a5419' · '260724_1a5419' 모두 받는다. */
export function findSession(sessions, query) {
  const q = String(query || '').trim().toLowerCase().replace(/\.jpg$/, '').replace(/_\d{2}$/, '');
  if (!q) return null;
  return (
    sessions.find((s) => s.key.toLowerCase() === q) ||
    sessions.find((s) => s.hash === q) ||
    sessions.find((s) => s.key.toLowerCase().endsWith(q)) ||
    null
  );
}

export function emptyState() {
  return { version: 1, baseline: [], counters: {}, sessions: {} };
}

/** 베를린 기준 월(1~12) — 시즌 문구용 */
export function berlinMonth(now) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', month: 'numeric' }).format(now));
}

/**
 * 다음에 올릴 것 하나를 고른다. 반환: { session, lang } 또는 { skip: '이유' }.
 * - force.session 이 있으면 그 세션(베이스라인이어도). force.lang 이 없으면 아직 안 올린 언어 순서대로(간격 무시).
 * - 자동: 베이스라인이 아닌 세션 중 오래된 것부터. 독일어 차례가 된 세션(영어 뒤 DE_DELAY_HOURS 경과)이 먼저,
 *   없으면 영어를 아직 안 올린 세션.
 */
export function planNext({ sessions, state, now, force = {} }) {
  const done = (key, lang) => Boolean(state.sessions[key]?.[lang]);
  if (force.session) {
    const s = findSession(sessions, force.session);
    if (!s) return { skip: `세션 '${force.session}' 을 portfolio-data.json 에서 찾지 못했습니다.` };
    if (force.lang) {
      if (!LANGS.includes(force.lang)) return { skip: `lang 은 en 또는 de 여야 합니다: ${force.lang}` };
      return { session: s, lang: force.lang };
    }
    const lang = LANGS.find((l) => !done(s.key, l));
    return lang ? { session: s, lang } : { skip: `${s.key} 는 영어·독일어 모두 이미 올렸습니다.` };
  }

  const baseline = new Set(state.baseline);
  // JSON 은 최신이 앞 → 뒤집어서 오래된 것부터
  const pending = [...sessions].reverse().filter((s) => !baseline.has(s.key) && !(done(s.key, 'en') && done(s.key, 'de')));
  const dueDe = pending.find((s) => {
    const en = state.sessions[s.key]?.en;
    return en && !done(s.key, 'de') && now - Date.parse(en.postedAt) >= DE_DELAY_HOURS * 3600e3;
  });
  if (dueDe) return { session: dueDe, lang: 'de' };
  const nextEn = pending.find((s) => !done(s.key, 'en'));
  if (nextEn) return { session: nextEn, lang: 'en' };
  const waiting = pending.find((s) => done(s.key, 'en') && !done(s.key, 'de'));
  if (waiting) return { skip: `${waiting.key} 독일어 글은 영어 글 뒤 ${DE_DELAY_HOURS}시간이 지나야 올립니다.` };
  return { skip: '새로 올릴 세션이 없습니다.' };
}

/**
 * 세션 문구 고르기. 이미 고른 템플릿이 있으면(영어 뒤 독일어) 같은 id 를 쓴다.
 * 새로 고를 때는 분야별 카운터로 돌린다. 반환: { variant, isNew }
 */
export function pickVariant({ session, state, now }) {
  const pool = TEMPLATES[session.category];
  if (!pool) throw new Error(`'${session.category}' 분야 템플릿이 없습니다 (${session.key}). scripts/lib/threads-templates.mjs 에 추가하세요.`);
  const chosen = state.sessions[session.key]?.variant;
  if (chosen) {
    const v = pool.find((t) => t.id === chosen);
    if (v) return { variant: v, isNew: false };
  }
  const month = berlinMonth(now);
  const inSeason = pool.filter((t) => !t.months || t.months.includes(month));
  const n = state.counters[session.category] || 0;
  return { variant: inSeason[n % inSeason.length], isNew: true };
}

export function imageUrls(session) {
  return session.photos.map((p) => GALLERY_URL + p.name);
}

/** 게시 성공을 상태에 기록(그 자리에서 수정). */
export function recordPost({ state, session, lang, variant, isNew, result, now }) {
  const entry = (state.sessions[session.key] ||= {});
  entry.category = session.category;
  entry.variant = variant.id;
  entry[lang] = { id: result.id, permalink: result.permalink || null, postedAt: new Date(now).toISOString() };
  if (isNew) state.counters[session.category] = (state.counters[session.category] || 0) + 1;
  return state;
}

// ───────────────────────── Threads API ─────────────────────────

export class ThreadsError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * 최소 Threads Graph API 클라이언트. fetchImpl·sleep 은 검사에서 가짜로 바꿔 끼운다.
 * 토큰은 URL 이 아니라 POST 본문/쿼리에만 싣고, 에러 메시지에 URL 을 넣지 않는다(로그에 토큰이 남지 않게).
 */
export function threadsClient({
  token,
  userId = '',
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  base = 'https://graph.threads.net/v1.0',
  pollMs = 3000,
  pollTries = 40,
}) {
  if (!token) throw new ThreadsError('THREADS_ACCESS_TOKEN 이 없습니다. docs/threads-autopost.md 의 설정 순서를 확인하세요.');
  let uid = userId;

  async function call(method, path, params = {}) {
    const all = new URLSearchParams({ ...params, access_token: token });
    const url = new URL(base + path);
    let res;
    if (method === 'GET') {
      for (const [k, v] of all) url.searchParams.set(k, v);
      res = await fetchImpl(url, { method });
    } else {
      res = await fetchImpl(url, { method, body: all });
    }
    let json = {};
    try { json = await res.json(); } catch { /* 빈 응답 */ }
    if (!res.ok || json.error) {
      const e = json.error || {};
      const code = e.code;
      const hint = code === 190 ? ' — 액세스 토큰이 만료됐거나 잘못됐습니다. docs/threads-autopost.md 의 "토큰 갱신" 을 따르세요.' : '';
      throw new ThreadsError(`Threads API ${method} ${path} 실패 (HTTP ${res.status}${code ? `, code ${code}` : ''}): ${e.message || 'unknown error'}${hint}`, { code, status: res.status });
    }
    return json;
  }

  async function me() {
    const r = await call('GET', '/me', { fields: 'id,username' });
    uid ||= r.id;
    return r;
  }

  async function userPath(suffix) {
    if (!uid) await me();
    return `/${uid}${suffix}`;
  }

  async function waitFinished(id) {
    for (let i = 0; i < pollTries; i++) {
      const r = await call('GET', `/${id}`, { fields: 'status,error_message' });
      if (r.status === 'FINISHED' || r.status === 'PUBLISHED') return;
      if (r.status === 'ERROR' || r.status === 'EXPIRED') throw new ThreadsError(`컨테이너 ${id} 처리 실패: ${r.status} ${r.error_message || ''}`.trim());
      await sleep(pollMs);
    }
    throw new ThreadsError(`컨테이너 ${id} 가 ${(pollMs * pollTries) / 1000}초 안에 준비되지 않았습니다.`);
  }

  /** 최근 글 중 같은 텍스트가 있으면 그 글을 돌려준다(이전 실행이 게시 후 상태 저장에 실패한 경우 대비). */
  async function findRecentDuplicate(text, now, windowHours = DUPLICATE_WINDOW_HOURS) {
    const r = await call('GET', await userPath('/threads'), { fields: 'id,text,timestamp,permalink', limit: '25' });
    return (r.data || []).find((p) => p.text === text && now - Date.parse(p.timestamp) <= windowHours * 3600e3) || null;
  }

  /** 이미지 1장이면 단일 이미지 글, 2장 이상이면 캐러셀. 반환: { id, permalink } */
  async function publish({ text, images }) {
    if (!images.length) throw new ThreadsError('올릴 사진이 없습니다.');
    const create = await userPath('/threads');
    let containerId;
    if (images.length === 1) {
      containerId = (await call('POST', create, { media_type: 'IMAGE', image_url: images[0], text })).id;
    } else {
      const children = [];
      for (const image_url of images) {
        children.push((await call('POST', create, { media_type: 'IMAGE', image_url, is_carousel_item: 'true' })).id);
      }
      for (const id of children) await waitFinished(id);
      containerId = (await call('POST', create, { media_type: 'CAROUSEL', children: children.join(','), text })).id;
    }
    await waitFinished(containerId);
    const published = await call('POST', await userPath('/threads_publish'), { creation_id: containerId });
    let permalink = null;
    try {
      permalink = (await call('GET', `/${published.id}`, { fields: 'permalink' })).permalink || null;
    } catch { /* 링크는 없어도 게시는 끝났다 */ }
    return { id: published.id, permalink };
  }

  async function refreshToken() {
    const url = new URL('https://graph.threads.net/refresh_access_token');
    url.searchParams.set('grant_type', 'th_refresh_token');
    url.searchParams.set('access_token', token);
    const res = await fetchImpl(url, { method: 'GET' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new ThreadsError(`토큰 갱신 실패 (HTTP ${res.status}): ${json.error?.message || 'unknown error'}`);
    return json; // { access_token, token_type, expires_in }
  }

  return { me, publish, findRecentDuplicate, refreshToken, call };
}

/** 사진이 실제로 사이트에 올라가 있는지(배포 전이면 Threads 가 못 가져간다). 실패한 URL 목록을 돌려준다. */
export async function unreachableImages(urls, fetchImpl = globalThis.fetch) {
  const bad = [];
  for (const url of urls) {
    try {
      const res = await fetchImpl(url, { method: 'HEAD' });
      const type = res.headers?.get?.('content-type') || '';
      if (!res.ok || !type.startsWith('image/')) bad.push(`${url} (HTTP ${res.status}${type ? `, ${type}` : ''})`);
    } catch (e) {
      bad.push(`${url} (${e.message})`);
    }
  }
  return bad;
}
