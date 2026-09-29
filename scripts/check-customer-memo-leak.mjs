#!/usr/bin/env node
/**
 * check-customer-memo-leak.mjs — 고객에게 나가는 요청사항에 내부 감사줄이 섞이는지 검사
 *
 * 왜 필요한가: 에이전트 조작(금액정정·부분수납·상품변경 …)은 요청사항 칸 끝에 감사줄을 붙이고,
 *   preserveAuditMemoLines_ 가 그 줄을 **일부러 되살린다**(멱등 가드). 그런데 확정 메일·.ics·고객 포털·
 *   인보이스는 그 칸을 그대로 인쇄했다 — 2026-09-28 300행(신경숙)에서
 *   `[금액정정 2026-09-28] 180→130€ (잔금 130→80€) 사유: … (agent)` 가 고객 메일에 실릴 뻔해
 *   메일을 손으로 다시 썼다(AN-260012 showMemo 사고와 같은 부류).
 *   수리는 customerVisibleMemo_ — 시트·캘린더 원문은 그대로 두고 **표시할 때만** 걷어낸다.
 *
 * 검사 대상 (Code.gs 를 GAS 스텁 위에 통째로 올려 **진짜 함수**를 부른다 — 로직 복제 없음):
 *   1) 접두어 집합 동기화 — preserveAuditMemoLines_ 가 되살리는 줄은 전부 customerVisibleMemo_ 가 지운다
 *   2) 고객 텍스트·비감사 토큰([배경:…] [국가별 신청] …)은 살아남는다
 *   3) buildBookingDetailsRows_ 는 기본이 고객용(감사줄 제거), 사장님 경로만 keepAuditMemo 로 원문
 *   4) 감사줄만 남은 메모는 요청사항 줄 자체가 사라진다(빈 라벨 인쇄 금지) — 메일·.ics 양쪽
 *   5) 소스 구조 — 고객 경로가 원문 메모를 그대로 넘기지 않는지(sendConfirmEmail_ / *ForCustomer_ /
 *      getInvoiceBookingExtraItem_), 사장님 경로는 keepAuditMemo 를 유지하는지
 *
 * 사용법:  node scripts/check-customer-memo-leak.mjs      (하나라도 새면 exit 1)
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};

/* ── Code.gs 를 그대로 올린다 (check-pass-country-memo 와 같은 방식) ───────────────── */
const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁 — 메모 렌더링은 시트·메일에 닿으면 안 된다`); } });
const pad = (n) => String(n).padStart(2, '0');
Object.assign(globalThis, {
  Utilities: {
    formatDate: (d, _tz, fmt) => {
      const x = new Date(d);
      const ymd = `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
      const hm = `${pad(x.getHours())}:${pad(x.getMinutes())}`;
      return fmt === 'HH:mm' ? hm : fmt && fmt.includes('HH:mm') ? `${ymd} ${hm}` : ymd;
    },
    computeDigest: () => [0], DigestAlgorithm: { MD5: 'MD5' },
  },
  SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'), CalendarApp: nope('CalendarApp'),
  MailApp: nope('MailApp'), GmailApp: nope('GmailApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});
const dir = mkdtempSync(join(tmpdir(), 'memoleak-'));
const file = join(dir, 'code.cjs');
writeFileSync(file, `${src}
module.exports={customerVisibleMemo_,preserveAuditMemoLines_,buildBookingDetailsRows_,
  buildConfirmCalendarMemo_,getConfirmCalendarLabels_,MEMO_AUDIT_PREFIXES_};`);
const E = (await import(pathToFileURL(file).href)).default;
rmSync(dir, { recursive: true, force: true });

/* ── 1) 접두어 집합 동기화 ─────────────────────────────────────────────────────────
   preserveAuditMemoLines_ 가 되살릴 줄은 반드시 customerVisibleMemo_ 가 지워야 한다.
   한쪽에만 접두어를 추가하면(= 새 에이전트 조작을 만들면서 표시 경로를 잊으면) 여기서 걸린다. */
const PREFIXES = String(E.MEMO_AUDIT_PREFIXES_ || '').split('|').filter(Boolean);
ok(PREFIXES.length >= 14, 'MEMO_AUDIT_PREFIXES_ 를 읽었다', PREFIXES.length);
for (const p of PREFIXES) {
  const line = `[${p} 2026-09-28] 180→130€ (잔금 130→80€) 사유: 3회차 혜택 (agent)`;
  ok(String(E.preserveAuditMemoLines_(line, '새 메모')).includes(line), `preserve 가 되살리는 줄: ${p}`);
  ok(E.customerVisibleMemo_(line) === '', `고객 표시에서 제거: ${p}`, E.customerVisibleMemo_(line));
}
// 등록 시점 충돌 스탬프도 고객이 볼 이유가 없다(preserve 대상은 아니다)
ok(E.customerVisibleMemo_('[충돌확인필요] 2026-09-28 14:00 등록 시점에 다른 일정과 겹침') === '',
   '[충돌확인필요] 스탬프 제거');

/* ── 2) 고객 텍스트·비감사 토큰은 살아남는다 ────────────────────────────────────── */
const REAL = [
  '아이가 낯을 많이 가려요. 배경은 밝은 톤으로 부탁드립니다.',
  '[배경:white] [국가별 신청] 4명:한국+독일',
  '[금액정정 2026-09-28] 180→130€ (잔금 130→80€) 사유: 3회차 혜택 (agent)',
  '[부분수납 2026-09-28] 50€ 수령 · 잔금 80€',
].join('\n');
const CLEAN = E.customerVisibleMemo_(REAL);
ok(CLEAN.includes('낯을 많이 가려요'), '고객이 쓴 요청사항은 남는다', CLEAN);
ok(CLEAN.includes('[배경:white]') && CLEAN.includes('[국가별 신청]'),
   '비감사 토큰([배경:…] · [국가별 신청])은 남는다 — 준비설문·여권견적이 읽는다', CLEAN);
ok(!/금액정정|부분수납|→130€|\(agent\)/.test(CLEAN), '감사줄은 한 줄도 남지 않는다', CLEAN);
ok(E.customerVisibleMemo_('') === '' && E.customerVisibleMemo_(null) === '' &&
   E.customerVisibleMemo_(undefined) === '', '빈 입력은 빈 문자열');
ok(E.customerVisibleMemo_('  앞뒤 공백  ') === '앞뒤 공백', '앞뒤 공백 정리');

/* ── 3)+4) 진짜 렌더러: 기본은 고객용, keepAuditMemo 만 원문 ──────────────────────── */
const detailData = { name: '검사', email: 'x@example.com', lang: 'ko', date: '2026-10-06', time: '11:00' };
const rowsOf = (memo, opts) =>
  E.buildBookingDetailsRows_(detailData, { itemGroup: 'stud', people: 2 },
    Object.assign({ lang: 'ko', memo, hideMoney: true }, opts || {}));
const requestRow = (rows) => rows.find((r) => r.label === '요청사항');

const mixed = requestRow(rowsOf(REAL));
ok(mixed && !/금액정정|부분수납|\(agent\)/.test(mixed.value),
   '확정 메일 세부내역: 기본 렌더가 감사줄을 인쇄하지 않는다', mixed && mixed.value);
ok(mixed && mixed.value.includes('낯을 많이 가려요'), '확정 메일 세부내역: 고객 요청은 남는다', mixed && mixed.value);

const ownerRow = requestRow(rowsOf(REAL, { keepAuditMemo: true }));
ok(ownerRow && /금액정정/.test(ownerRow.value),
   '사장님 경로(keepAuditMemo)는 원문 그대로 — 정정 이력을 잃으면 안 된다', ownerRow && ownerRow.value);

// 감사줄만 남은 메모 → 요청사항 줄 자체가 사라진다(빈 라벨 인쇄 금지)
const auditOnly = '[금액정정 2026-09-28] 180→130€ (잔금 130→80€) 사유: 재방문 (agent)';
ok(!requestRow(rowsOf(auditOnly)), '감사줄만 있으면 요청사항 줄을 아예 싣지 않는다',
   (requestRow(rowsOf(auditOnly)) || {}).value);
ok(!!requestRow(rowsOf(auditOnly, { keepAuditMemo: true })), '사장님 경로에서는 그 줄이 보인다');

// .ics — 캘린더 메모에도 감사줄이 없고, 비면 요청 블록이 통째로 빠진다
const icsLabels = E.getConfirmCalendarLabels_('ko');
const ics = (memo) => E.buildConfirmCalendarMemo_({
  lang: 'ko', start: new Date('2026-10-06T11:00:00'), end: new Date('2026-10-06T12:00:00'),
  product: '스튜디오 촬영', people: '2', hidePrice: true, depositAmount: 0,
  memo: E.customerVisibleMemo_(memo), extraItem: '', location: '', external: false,
});
ok(!/금액정정|\(agent\)/.test(ics(REAL)), '.ics 설명에 감사줄이 없다');
ok(ics(REAL).includes('낯을 많이 가려요'), '.ics 설명에 고객 요청은 남는다');
ok(!ics(auditOnly).includes(`${icsLabels.request}:`),
   '.ics — 감사줄만이면 요청 블록을 싣지 않는다(빈 라벨 금지)');

/* ── 5) 소스 구조 — 고객 경로가 원문을 그대로 넘기지 않는지 ───────────────────────── */
const lines = src.split('\n');
const starts = [];
lines.forEach((l, i) => { const m = /^function ([A-Za-z0-9_]+)\(/.exec(l); if (m) starts.push([i, m[1]]); });
const bodyOf = (name) => {
  const k = starts.findIndex(([, n]) => n === name);
  if (k < 0) { ok(false, `${name} 을 Code.gs 에서 찾지 못했다 — 이름이 바뀌었나요?`); return ''; }
  return lines.slice(starts[k][0], k + 1 < starts.length ? starts[k + 1][0] : lines.length).join('\n');
};

// 확정 메일 5경로(원클릭·어드민 확정·포털 재발송·수기 예약·견적→예약)가 전부 지나는 한 지점
const confirm = bodyOf('sendConfirmEmail_');
ok(/detail\.memo\s*=\s*customerVisibleMemo_\(/.test(confirm),
   'sendConfirmEmail_ 가 detail.memo 를 customerVisibleMemo_ 로 걷어낸다');
ok(/detail\.extraItem\s*=\s*customerVisibleMemo_\(/.test(confirm),
   'sendConfirmEmail_ 가 detail.extraItem(.ics 추가 줄)도 걷어낸다');

// 고객 응답을 만드는 함수(*ForCustomer_)는 요청사항을 날것으로 실으면 안 된다
for (const [i, name] of starts) {
  if (!name.endsWith('ForCustomer_')) continue;
  const body = lines.slice(i, (starts.find(([j]) => j > i) || [lines.length])[0]).join('\n');
  body.split('\n').forEach((l) => {
    if (!/요청사항/.test(l) || /^\s*(\/\/|\*|\/\*)/.test(l)) return;
    ok(/customerVisibleMemo_\(/.test(l),
       `${name}: 요청사항을 원문 그대로 고객에게 넘긴다 — customerVisibleMemo_ 로 감싸세요`, l.trim());
  });
}

// 인보이스 품목 설명의 원천(추가항목) — 옛 행엔 감사줄이 이미 박혀 있다
const invExtra = bodyOf('getInvoiceBookingExtraItem_');
ok((invExtra.match(/customerVisibleMemo_\(/g) || []).length >= 2,
   'getInvoiceBookingExtraItem_ 의 두 반환 경로(인자·시트)가 모두 걷어낸다',
   (invExtra.match(/customerVisibleMemo_\(/g) || []).length);
ok(!/return String\(sheet\.getRange/.test(invExtra),
   'getInvoiceBookingExtraItem_ 가 시트 값을 날것으로 반환하지 않는다');

// 사장님 경로는 원문을 유지해야 한다(정정 이력이 사장님 눈에서도 사라지면 그것도 회귀다)
ok(/keepAuditMemo:true/.test(bodyOf('buildCalendarDescription_')),
   '캘린더 본문은 keepAuditMemo:true 로 원문 유지');
ok(/keepAuditMemo:true/.test(bodyOf('sendAdminNotificationEmail_')),
   '새 예약 알림(사장님)은 keepAuditMemo:true 로 원문 유지');

if (fail) { console.error(`\n❌ 고객 메모 유출 검사 실패 ${fail}건`); process.exit(1); }
console.log('✅ 고객 메모 유출 검사 통과 — 감사줄은 시트·캘린더·사장님 메일에만 남는다');
