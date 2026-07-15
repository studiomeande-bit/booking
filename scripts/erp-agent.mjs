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
