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
 *   doc-preview-text: 발송 전 검수 — 문서 PDF 에 실제로 인쇄되는 텍스트·쪽수 (읽기 전용)
 *     node scripts/erp-agent.mjs doc-preview-text --json '{"id":"AN-260012"}'
 *     kind 는 접두어로 자동 판별(AN-=quote / STMIN-=invoice / DV-=contract), 명시하려면 "kind":"quote".
 *     반환: pages(템플릿 쪽수) · estPhysicalPages(실제 인쇄 예상 쪽수) · memoPrinted ·
 *           perPage[{page,lang,chars,estHeightMm,text}] · warnings[].
 *     warnings 가 비어야 발송한다 — '내부 메모가 인쇄됨'(AN-260012 사고) / '빈 페이지 발생 가능'(본문 273mm 초과).
 *     "includeHtml":true 면 PDF 원본 HTML 도 반환 → 브라우저 인쇄 미리보기로 눈으로 확인 가능.
 *     회귀 검사: node scripts/check-doc-preview.mjs
 *
 * 국외 B2B 부가세 미부과(§3a Abs.2 UStG): quote-create/quote-update/invoice-create 의 data 에
 *   {"vatMode":"exempt_third_country","vatExemptCountry":"대한민국\n//\nRepublic of Korea"}
 *   단가(unitGross)는 그대로 brutto 로 넣는다 — 부가세 0 · 총액=netto 로 문서가 닫힌다.
 *   미지정/빈값은 'standard'(19%) — 기존 견적 전부 종전과 동일. 상세는 studio-erp SKILL.md.
 *   booking-search | booking-get | booking-set-time | booking-set-amount | booking-change-product
 *   booking-set-extra-days: 추가일정(이동일·다일차 촬영) 등록/교체 — 아래 참조
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
 * booking-set-extra-days: ✏️변경계 — 이미 만들어진 예약에 추가일정(이동일·다일차 촬영)을 붙인다.
 *   그동안 extraDays 는 quote-convert-booking 전환 시점에만 넣을 수 있었다. 캘린더에 손으로 만든
 *   이벤트는 '추가일정JSON' 에 없어 **자가치유(calendar-audit) 보호 밖**이다 — 지워지면 그 날 슬롯이
 *   조용히 열린다. 이 액션으로 등록하면 보호 대상이 된다. **고객 메일 미발송**(내부 스케줄).
 *   node scripts/erp-agent.mjs booking-set-extra-days --json '{"rowIndex":251,"expectName":"Jin Hee Choi",
 *     "extraDays":[{"date":"2027-06-11","time":"09:00","durationMin":600,"kind":"travel","note":"오버우어젤→함부르크"}],
 *     "replace":true}'
 *   kind: 'shoot'(기본)=촬영 있는 N일차, 제목 `상품 | 고객명 (N/M일차)` · 'travel'=이동/숙박 블록,
 *         제목 `[이동] …` + 설명에 "촬영 없음 · 다른 촬영 잡지 말 것". 일차 번호는 촬영일만 센다.
 *   replace: true=전체 교체(빠진 날짜의 이벤트 삭제) / 생략=병합 추가(같은 날짜는 입력이 이김).
 *   **기존 이벤트 흡수**: 같은 날짜에 제목이 고객명을 포함한 이벤트가 있으면 새로 만들지 않고 그
 *     eventId 를 연결한다(중복 0). 흡수 이벤트의 제목·설명은 보존, 시간은 캘린더 실측으로 되읽는다.
 *     특정 이벤트를 콕 집으려면 각 날짜에 "eventId":"…@google.com".
 *   allowConflict: 1일차와 동일 기준(checkBookingTimeConflict_)의 충돌 검사를 강행. dryRun: 계획만 확인.
 *   조회는 booking-get 의 extraDays 필드. 회귀 검사: node scripts/check-extra-days.mjs
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
