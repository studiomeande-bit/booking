#!/usr/bin/env node
/**
 * Studio mean 문의 분류 — 로컬 Ollama로 고객 메일/문의를 구조화
 *
 * 전부 로컬에서 돌아가므로 건당 비용 0. 수백 건 일괄 처리해도 요금이 없다.
 * 고객 개인정보가 외부로 나가지 않는다는 점도 GDPR 측면에서 유리.
 *
 * 사용법:
 *   node scripts/ollama-triage.mjs --text "<본문>"
 *   cat mail.txt | node scripts/ollama-triage.mjs
 *   node scripts/ollama-triage.mjs --file mail.txt
 *   node scripts/ollama-triage.mjs --jsonl inbox.jsonl        일괄 처리
 *
 * 옵션:
 *   --reply            감지된 언어로 회신 초안까지 생성
 *   --model <이름>     기본 gemma3:27b (추론이 필요하면 qwen3:30b)
 *   --pretty           사람이 읽기 좋은 형태로 출력 (기본은 JSON)
 *
 * --jsonl 입력 형식: 한 줄에 {"id":"...","text":"..."} (subject+body를 text에 합쳐 넣기)
 *   출력도 JSONL — 원본 필드 + 분류 결과가 합쳐져 나온다.
 *
 * 예:
 *   node scripts/ollama-triage.mjs --file mail.txt --reply --pretty
 *   node scripts/ollama-triage.mjs --jsonl tmp/inbox.jsonl > tmp/triaged.jsonl
 */
import { readFileSync, existsSync } from 'node:fs';

const OLLAMA = process.env.OLLAMA_HOST || 'http://localhost:11434';
const GEN_MODEL = 'gemma3:27b';

// Studio mean 실제 업무 흐름에 맞춘 분류 (docs/ 기준)
const CATEGORIES = [
  '예약문의',      // 신규 예약, 가능 일정 문의
  '견적요청',      // B2B/기업 출장, 행사 견적
  '일정변경',      // 날짜/시간 변경 요청
  '취소환불',      // 취소, 환불, 계약금 관련
  '결제입금',      // 입금 확인, 인보이스, 결제수단
  '사진선택',      // select 플로우 (원본 선택)
  '리터치보정',    // 보정 요청/수정 요청
  '인화배송',      // 인화, 픽업, 우편 발송
  '여권비자사진',  // 여권·비자·증명사진
  '구텐샤인',      // 상품권 구매/사용
  '협업제휴',      // 협업, 제휴, 촬영 의뢰(외부)
  '스팸',
  '기타',
];

// 카테고리 이름만으로는 모델이 경계를 헷갈린다 — 정의를 프롬프트에 같이 넣는다.
const CATEGORY_GUIDE = [
  '예약문의: 아직 촬영 전. 신규 예약 가능 여부·일정·상품 문의. 아래 전용 카테고리에 해당하면 그쪽을 우선.',
  '견적요청: 기업·법인·단체가 보낸 가격/견적 요청.',
  '일정변경: 이미 확정된 예약의 날짜·시간 변경.',
  '취소환불: 취소, 환불, 계약금 반환.',
  '결제입금: 입금 확인, 인보이스, 결제수단 문의.',
  '사진선택: 촬영이 끝난 뒤 원본을 고르는 select 단계. 선택 링크 오류·접속 불가도 여기.',
  '리터치보정: 보정 요청, 재보정 요청, 보정 결과 불만.',
  '인화배송: 인화물, 액자, 픽업, 우편 발송.',
  '여권비자사진: 여권·비자·증명사진 관련이면 예약 전이든 후든 무조건 여기.',
  '구텐샤인: 상품권(Gutschein) 구매·사용·잔액. 상품권을 직접 언급할 때만.',
  '협업제휴: 협업, 제휴, 외부 업체의 촬영 의뢰.',
  '스팸: 광고, 사기, 스튜디오와 무관한 대량 발송.',
  '기타: 위 어디에도 맞지 않음.',
].join('\n');

const SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: CATEGORIES },
    language: { type: 'string', enum: ['ko', 'de', 'en', 'other'] },
    urgency: { type: 'string', enum: ['높음', '보통', '낮음'] },
    summary: { type: 'string' },
    action: { type: 'string' },
    needsHuman: { type: 'boolean' },
  },
  required: ['category', 'language', 'urgency', 'summary', 'action', 'needsHuman'],
};

function fail(msg) { console.error('❌ ' + msg); process.exit(1); }

/* ── 인자 ──────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const has = (n) => argv.includes('--' + n);

const model = flag('model', GEN_MODEL);
const wantReply = has('reply');
const pretty = has('pretty');

/* ── Ollama ────────────────────────────────────────────────── */
async function chat(prompt, format) {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    // 분류는 재현성이 중요하므로 0. (--reply 초안도 톤이 튀지 않는 편이 낫다)
    options: { temperature: 0 },
  };
  if (format) body.format = format;

  let res;
  try {
    res = await fetch(OLLAMA + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    fail(`Ollama에 연결할 수 없습니다 (${OLLAMA}). 'ollama serve' 확인.\n   ${e.message}`);
  }
  if (!res.ok) fail(`Ollama 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  // 추론 모델은 사고 과정이 message.thinking으로 분리된다 — content만 사용
  return (data.message?.content || '').trim();
}

/* ── 분류 ──────────────────────────────────────────────────── */
const CLASSIFY_PROMPT = (text) => `당신은 독일 오버우어젤의 사진 스튜디오 "Studio mean"의 문의 분류 담당입니다.
고객이 보낸 아래 메일/문의를 분석해 JSON으로만 답하세요.

category는 아래 정의에 따라 정확히 하나만 고르세요:
${CATEGORY_GUIDE}

나머지 필드:
- language: 고객이 쓴 언어 (ko=한국어, de=독일어, en=영어).
- urgency: 촬영일이 임박했거나 결제/취소 기한이 걸린 건은 "높음".
- summary: 한국어 한 문장. 고객명·날짜·금액 등 구체 정보가 있으면 반드시 포함.
- action: 스튜디오가 다음에 할 일을 한국어 한 문장 명령형으로.
- needsHuman: 아래 중 하나라도 해당하면 반드시 true.
  · B2B/기업 견적 (내부 단가표를 쓰므로 자동 응답 금지)
  · 금액 협상, 할인 요구, 환불·취소 수수료 다툼
  · 컴플레인, 불만, 법적 사안
  · 정가표에 없는 예외 요청 (출장 촬영, 특수 일정, 긴급 납기)
  · 판단이 애매하면 true 쪽으로.
  단, category가 "스팸"이면 항상 false (볼 필요가 없으므로).

=== 문의 본문 ===
${text}`;

const REPLY_PROMPT = (text, cls) => `당신은 독일 오버우어젤의 사진 스튜디오 "Studio mean"의 응대 담당입니다.
아래 고객 문의에 대한 회신 초안을 작성하세요.

조건:
- 반드시 고객이 사용한 언어(${cls.language})로 작성.
- 독일어면 정중한 Sie 존칭, 비즈니스 메일 톤.
- 확정되지 않은 가격·일정은 단정하지 말고 확인 후 안내하겠다고 쓰세요.
- 서명은 "Studio mean"으로 끝내세요.
- 회신 본문만 출력하고 다른 설명은 붙이지 마세요.

문의 분류: ${cls.category} / 긴급도 ${cls.urgency}

=== 고객 문의 ===
${text}`;

async function triage(text) {
  const raw = await chat(CLASSIFY_PROMPT(text), SCHEMA);
  let cls;
  try {
    cls = JSON.parse(raw);
  } catch {
    fail(`분류 결과가 JSON이 아닙니다:\n${raw.slice(0, 300)}`);
  }
  if (wantReply) cls.reply = await chat(REPLY_PROMPT(text, cls));
  return cls;
}

/* ── 입력 읽기 ─────────────────────────────────────────────── */
async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function show(cls) {
  if (!pretty) { console.log(JSON.stringify(cls, null, 2)); return; }
  const mark = cls.needsHuman ? '🔴 사장님 확인 필요' : '🟢 자동 처리 가능';
  console.log(`\n분류    ${cls.category}   (${cls.language} · 긴급도 ${cls.urgency})`);
  console.log(`요약    ${cls.summary}`);
  console.log(`할 일   ${cls.action}`);
  console.log(`판정    ${mark}`);
  if (cls.reply) console.log(`\n── 회신 초안 ──\n${cls.reply}`);
}

/* ── 실행 ──────────────────────────────────────────────────── */
const jsonlPath = flag('jsonl', '');

if (jsonlPath) {
  if (!existsSync(jsonlPath)) fail(`파일이 없습니다: ${jsonlPath}`);
  const lines = readFileSync(jsonlPath, 'utf8').split('\n').filter((l) => l.trim());
  let n = 0;
  for (const line of lines) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      process.stderr.write(`\n⚠️  JSON 파싱 실패, 건너뜀: ${line.slice(0, 80)}\n`);
      continue;
    }
    if (!row.text) {
      process.stderr.write(`\n⚠️  text 필드 없음, 건너뜀: ${row.id ?? '(id 없음)'}\n`);
      continue;
    }
    const cls = await triage(row.text);
    console.log(JSON.stringify({ ...row, ...cls }));
    n += 1;
    process.stderr.write(`\r  분류 ${n}/${lines.length}`);
  }
  process.stderr.write('\n');
} else {
  const text = flag('text', '')
    || (flag('file', '') ? readFileSync(flag('file', ''), 'utf8') : '')
    || await readStdin();
  if (!text.trim()) fail('입력이 없습니다. --text / --file / 파이프 중 하나를 쓰세요.');
  show(await triage(text));
}
