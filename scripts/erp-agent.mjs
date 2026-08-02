#!/usr/bin/env node
/**
 * Studio mean ERP 자동화 CLI — Claude ERP 에이전트용
 *
 * 사용법:
 *   node scripts/erp-agent.mjs <action> [--json '<payload>'] [--file payload.json]
 *
 * action:
 *   quote-list | quote-get | quote-create | quote-update | quote-send
 *   quote-hold | quote-snooze | quote-release-hold | quote-extend
 *   invoice-list | invoice-create | invoice-send
 *   booking-search | booking-get | booking-set-time | booking-set-amount | booking-change-product
 *   booking-refund: 부분/전체 환불 이벤트 기록(상한=실수령, 장부에 지급일 음수 반영)
 *     node scripts/erp-agent.mjs booking-refund --json '{"rowIndex":218,"amount":50,"method":"bank","reason":"..."}'
 *   booking-refund-quote: 취소 환불 규정 제안액(실수령·기환불 포함) 조회
 *   booking-delete: 예약 행 삭제(expectName+confirm:'DELETE', 참조 보정 포함 — 합성행 전용, 실고객은 force)
 *
 * booking-set-amount: 예약 총결제액 정정(매출 소급 정정). 회계장부 gross는 총결제액에서 파생.
 *   node scripts/erp-agent.mjs booking-set-amount --json '{"rowIndex":218,"total":35,"reason":"여권 인화옵션 €5 누락분 반영"}'
 *   옵션: recomputeBalance(기본 true, 잔금=총결제액−계약금), expectName(행 고객명 안전확인).
 *
 * booking-change-product: 예약 상품 교체 + 재견적(총액·계약금·잔금·소요시간·캘린더 자동 반영). 고객 메일 미발송.
 *   가격은 calculateQuote_(수기등록과 동일 엔진) 재사용 — 별도 계산 없음.
 *   node scripts/erp-agent.mjs booking-change-product --json '{"rowIndex":218,"itemId":"pp","passAddon":true}'
 *   payload: itemId(필수), passAddon/passAddonPeople, people, optionKeys[], expectName(안전확인).
 *   변경 통지가 필요하면 이어서 booking-confirm-mail 로 사장님이 별도 발송.
 *
 * 인증: reservation/.secrets/erp-automation-key 파일의 키 사용
 *   (어드민 → 설정 → 자동화 API 키에서 발급)
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY_FILE = join(ROOT, '.secrets', 'erp-automation-key');
const API_BASE = 'https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec';

function fail(msg) { console.error('❌ ' + msg); process.exit(1); }

if (!existsSync(KEY_FILE)) {
  fail(`자동화 키 파일이 없습니다: ${KEY_FILE}\n어드민 → 설정 → "자동화 API 키" 발급 후 키를 이 파일에 저장하세요.`);
}
const apiKey = readFileSync(KEY_FILE, 'utf8').trim();
if (apiKey.length < 24) fail('키 파일 내용이 올바르지 않습니다.');

const [action, ...rest] = process.argv.slice(2);
if (!action) fail('action이 필요합니다. 예: node scripts/erp-agent.mjs quote-list');

let payload = {};
let saveB64To = '';
for (let i = 0; i < rest.length; i += 1) {
  if (rest[i] === '--json' && rest[i + 1]) payload = JSON.parse(rest[i + 1]);
  if (rest[i] === '--file' && rest[i + 1]) payload = JSON.parse(readFileSync(rest[i + 1], 'utf8'));
  // --upload <경로>: 파일을 base64로 실어 보냄 (expense-evidence-upload용)
  if (rest[i] === '--upload' && rest[i + 1]) {
    const fp = rest[i + 1];
    payload.fileBase64 = readFileSync(fp).toString('base64');
    if (!payload.fileName) payload.fileName = fp.split('/').pop();
    if (!payload.mimeType) payload.mimeType = fp.toLowerCase().endsWith('.pdf') ? 'application/pdf'
      : /\.(jpe?g)$/i.test(fp) ? 'image/jpeg' : /\.png$/i.test(fp) ? 'image/png' : 'application/octet-stream';
  }
  // --save-b64 <경로>: 응답의 fileBase64를 파일로 저장 (expense-inbox-file용)
  if (rest[i] === '--save-b64' && rest[i + 1]) saveB64To = rest[i + 1];
}

const body = JSON.stringify({ data: { ...payload, apiKey, agentAction: action } });
const url = `${API_BASE}?api=erp-agent&_ts=${Date.now()}`;

const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body,
  redirect: 'follow'
});
const text = await response.text();
let parsed;
try { parsed = JSON.parse(text); } catch { fail('API 응답이 JSON이 아닙니다:\n' + text.slice(0, 400)); }
if (!parsed.ok) fail('API 오류: ' + JSON.stringify(parsed.error || parsed, null, 2));
if (saveB64To && parsed.data && parsed.data.fileBase64) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(saveB64To, Buffer.from(parsed.data.fileBase64, 'base64'));
  const meta = { ...parsed.data, fileBase64: `(saved to ${saveB64To})` };
  console.log(JSON.stringify(meta, null, 2));
} else {
  console.log(JSON.stringify(parsed.data, null, 2));
}
