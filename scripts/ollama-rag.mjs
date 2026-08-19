#!/usr/bin/env node
/**
 * Studio mean 로컬 RAG — 프로젝트 문서를 Ollama로 임베딩해 검색·질의
 *
 * 전부 로컬(localhost:11434)에서 돌아가므로 API 비용 0, 외부 전송 없음.
 *
 * 사용법:
 *   node scripts/ollama-rag.mjs index [--rebuild]      인덱스 생성(변경된 파일만 재임베딩)
 *   node scripts/ollama-rag.mjs search <질문> [--k 6]   검색만 (빠름, LLM 미사용)
 *   node scripts/ollama-rag.mjs ask <질문> [--k 6] [--model gemma3:27b]
 *                                                      검색 + 답변 생성
 *
 * 예:
 *   node scripts/ollama-rag.mjs index
 *   node scripts/ollama-rag.mjs search 여행비 정책
 *   node scripts/ollama-rag.mjs ask 구텐샤인 V2에서 부분사용은 어떻게 처리하나?
 *   node scripts/ollama-rag.mjs ask 계약금 미입금 시 자동취소 며칠 뒤? --model qwen3:30b
 *
 * 인덱스 대상: docs/*.md + README.md + 회계 인덱스(00_README_인덱스.md)
 *   Code.gs(25k줄)는 제외 — 코드 탐색은 Serena MCP가 담당.
 *
 * 인덱스 파일: tmp/rag-index.json (gitignore됨)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_FILE = join(ROOT, 'tmp', 'rag-index.json');
const OLLAMA = process.env.OLLAMA_HOST || 'http://localhost:11434';
const EMBED_MODEL = 'bge-m3';
const GEN_MODEL = 'gemma3:27b';

// 저장소 밖이지만 같이 검색하면 좋은 문서
const EXTRA_SOURCES = [
  join(homedir(), 'Desktop/Studio_mean/스튜디오자료/2026년 kontoauszug/00_README_인덱스.md'),
];

function fail(msg) { console.error('❌ ' + msg); process.exit(1); }

/* ── 인자 파싱 ─────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const cmd = argv[0];
if (!cmd) fail('명령이 필요합니다: index | search | ask');

function flag(name, fallback) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const hasFlag = (name) => argv.includes('--' + name);

// 플래그와 그 값을 뺀 나머지가 질문
const FLAGS_WITH_VALUE = new Set(['k', 'model']);
function positional() {
  const out = [];
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      if (FLAGS_WITH_VALUE.has(a.slice(2))) i += 1;
      continue;
    }
    out.push(a);
  }
  return out.join(' ').trim();
}

/* ── Ollama ────────────────────────────────────────────────── */
async function ollama(path, body) {
  let res;
  try {
    res = await fetch(OLLAMA + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    fail(`Ollama에 연결할 수 없습니다 (${OLLAMA}). 'ollama serve'가 떠 있는지 확인하세요.\n   ${e.message}`);
  }
  if (!res.ok) fail(`Ollama ${path} 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function embed(texts) {
  const out = [];
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const data = await ollama('/api/embed', { model: EMBED_MODEL, input: batch });
    if (!data.embeddings || data.embeddings.length !== batch.length) {
      fail(`임베딩 응답이 올바르지 않습니다 (기대 ${batch.length}, 수신 ${data.embeddings?.length}).`);
    }
    for (const v of data.embeddings) out.push(normalize(v));
    process.stderr.write(`\r  임베딩 ${Math.min(i + BATCH, texts.length)}/${texts.length}`);
  }
  if (texts.length) process.stderr.write('\n');
  return out;
}

// 미리 정규화해두면 검색 시 내적만으로 코사인 유사도가 나온다
function normalize(v) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

/* ── 청킹 ──────────────────────────────────────────────────── */
const TARGET = 900;  // 목표 청크 크기(문자)
const MAX = 1500;    // 이보다 길면 문단 단위로 쪼갬

function chunkMarkdown(text) {
  // 1) 헤딩 기준으로 섹션 분리 (헤딩 텍스트는 청크에 같이 실어 문맥 유지)
  const sections = [];
  let cur = { heading: '', body: [] };
  for (const line of text.split('\n')) {
    const m = /^(#{1,4})\s+(.+)$/.exec(line);
    if (m) {
      if (cur.body.join('\n').trim()) sections.push(cur);
      cur = { heading: m[2].trim(), body: [] };
    } else {
      cur.body.push(line);
    }
  }
  if (cur.body.join('\n').trim()) sections.push(cur);

  // 2) 섹션이 길면 빈 줄 기준 문단으로 다시 묶기
  const chunks = [];
  for (const s of sections) {
    const body = s.body.join('\n').trim();
    if (!body) continue;
    if (body.length <= MAX) {
      chunks.push({ heading: s.heading, text: body });
      continue;
    }
    const paras = body.split(/\n{2,}/);
    let buf = '';
    for (const p of paras) {
      if (buf && (buf.length + p.length + 2) > TARGET) {
        chunks.push({ heading: s.heading, text: buf.trim() });
        buf = '';
      }
      // 문단 하나가 MAX를 넘으면 그대로 넣는다(표·코드블록 보존)
      buf = buf ? buf + '\n\n' + p : p;
    }
    if (buf.trim()) chunks.push({ heading: s.heading, text: buf.trim() });
  }
  return chunks.filter((c) => c.text.length > 30);
}

/* ── 소스 수집 ─────────────────────────────────────────────── */
function collectSources() {
  const out = [];
  const docsDir = join(ROOT, 'docs');
  if (existsSync(docsDir)) {
    for (const f of readdirSync(docsDir).filter((f) => f.endsWith('.md')).sort()) {
      out.push(join(docsDir, f));
    }
  }
  const readme = join(ROOT, 'README.md');
  if (existsSync(readme)) out.push(readme);
  for (const p of EXTRA_SOURCES) if (existsSync(p)) out.push(p);
  return out;
}

const label = (p) => (p.startsWith(ROOT) ? relative(ROOT, p) : p.replace(homedir(), '~'));
const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16);

/* ── index ─────────────────────────────────────────────────── */
async function cmdIndex() {
  const rebuild = hasFlag('rebuild');
  const sources = collectSources();
  if (!sources.length) fail('인덱싱할 문서를 찾지 못했습니다.');

  let prev = { chunks: [] };
  if (!rebuild && existsSync(INDEX_FILE)) {
    try {
      prev = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
      if (prev.embedModel !== EMBED_MODEL) prev = { chunks: [] }; // 모델이 바뀌면 전체 재생성
    } catch { prev = { chunks: [] }; }
  }
  const prevByFile = new Map();
  for (const c of prev.chunks || []) {
    if (!prevByFile.has(c.file)) prevByFile.set(c.file, []);
    prevByFile.get(c.file).push(c);
  }

  const kept = [];
  const fresh = [];
  for (const path of sources) {
    const raw = readFileSync(path, 'utf8');
    const h = hash(raw);
    const name = label(path);
    const cached = prevByFile.get(name);
    if (cached && cached.length && cached[0].fileHash === h) {
      kept.push(...cached);
      continue;
    }
    for (const c of chunkMarkdown(raw)) {
      fresh.push({ file: name, fileHash: h, heading: c.heading, text: c.text });
    }
  }

  console.log(`📚 문서 ${sources.length}개 | 재사용 청크 ${kept.length} | 신규 청크 ${fresh.length}`);
  if (fresh.length) {
    const vecs = await embed(fresh.map((c) => (c.heading ? c.heading + '\n' + c.text : c.text)));
    fresh.forEach((c, i) => { c.vec = vecs[i]; });
  }

  const chunks = [...kept, ...fresh];
  if (!chunks.length) fail('생성된 청크가 없습니다.');

  mkdirSync(dirname(INDEX_FILE), { recursive: true });
  writeFileSync(INDEX_FILE, JSON.stringify({
    embedModel: EMBED_MODEL,
    dim: chunks[0].vec.length,
    builtAt: new Date().toISOString(),
    sources: sources.map(label),
    chunks,
  }));
  console.log(`✅ 인덱스 저장: ${label(INDEX_FILE)} (청크 ${chunks.length}개, ${chunks[0].vec.length}차원)`);
}

/* ── 검색 ──────────────────────────────────────────────────── */
function loadIndex() {
  if (!existsSync(INDEX_FILE)) {
    fail(`인덱스가 없습니다. 먼저 실행하세요:\n   node scripts/ollama-rag.mjs index`);
  }
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

async function retrieve(query, k) {
  const idx = loadIndex();
  const [qv] = await embed([query]);
  return idx.chunks
    .map((c) => ({ ...c, score: dot(qv, c.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

async function cmdSearch() {
  const query = positional();
  if (!query) fail('질문이 필요합니다. 예: node scripts/ollama-rag.mjs search 여행비 정책');
  const hits = await retrieve(query, Number(flag('k', 6)));
  for (const [i, h] of hits.entries()) {
    const head = h.heading ? ` › ${h.heading}` : '';
    console.log(`\n[${i + 1}] ${h.score.toFixed(3)}  ${h.file}${head}`);
    console.log(h.text.length > 400 ? h.text.slice(0, 400) + ' …' : h.text);
  }
}

/* ── 질의응답 ──────────────────────────────────────────────── */
async function cmdAsk() {
  const query = positional();
  if (!query) fail('질문이 필요합니다. 예: node scripts/ollama-rag.mjs ask 계약금 정책이 뭐야?');
  const model = flag('model', GEN_MODEL);
  const hits = await retrieve(query, Number(flag('k', 6)));

  const context = hits
    .map((h, i) => `[${i + 1}] ${h.file}${h.heading ? ' › ' + h.heading : ''}\n${h.text}`)
    .join('\n\n---\n\n');

  const prompt = `당신은 Studio mean(독일 오버우어젤 사진 스튜디오)의 내부 문서 어시스턴트입니다.
아래 발췌 문서만 근거로 한국어로 답하세요.

규칙:
- 문서에 없는 내용은 지어내지 말고 "문서에서 확인되지 않음"이라고 쓰세요.
- 근거로 쓴 발췌는 문장 끝에 [1], [2] 형태로 표시하세요.
- 간결하게, 실무자가 바로 쓸 수 있게 답하세요.

=== 발췌 문서 ===
${context}

=== 질문 ===
${query}`;

  process.stderr.write(`🤖 ${model} 생성 중…\n`);
  const data = await ollama('/api/chat', {
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    options: { temperature: 0.2 },
  });
  // qwen3 등 추론 모델은 사고 과정을 message.thinking으로 분리해 보낸다 — content만 쓴다.
  // (주의: think:false를 주면 사고 과정이 content로 새므로 플래그를 넘기지 않는다)
  const answer = (data.message?.content || '').trim();
  console.log('\n' + (answer || '(빈 응답)'));
  console.log('\n── 참고 ──');
  for (const [i, h] of hits.entries()) {
    console.log(`[${i + 1}] ${h.file}${h.heading ? ' › ' + h.heading : ''} (${h.score.toFixed(3)})`);
  }
}

/* ── 라우팅 ────────────────────────────────────────────────── */
const commands = { index: cmdIndex, search: cmdSearch, ask: cmdAsk };
if (!commands[cmd]) fail(`알 수 없는 명령: ${cmd} (index | search | ask)`);
await commands[cmd]();
