#!/usr/bin/env node
/* public-api 생성기 — 예약·셀렉 페이지의 **조회**(api=init · quote · calendar-batch · slots · select-session · select-photos)를 Code.gs 에서 떼어
   appscript-public/Public.gs 를 만든다. 제출(api=booking)과 그 fresh 가용성 가드는 메인에 그대로 둔다.

   왜: 메인 2.3MB 의 요청당 3~5초 바닥이 예약 첫 방문에 3번(init→달력→슬롯) 붙는다. board-api 가 증명한 대로
   작은 프로젝트는 1~3초에 답한다(감사 2026-09-20 perf-1).

     node scripts/build-public-api.mjs
     cd appscript-public && clasp push -f && clasp deploy -i <deploymentId>

   Shim.gs 가 제공하는 것: ensureSheets_(읽기 전용 번들), getCalCacheVer_(설정 시트 cal_cache_ver — 메인의
   bumpCalCacheVer_ 가 같은 키를 쓴다), bumpCalCacheVer_(no-op), 라우팅. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractClosure } from './gas-extract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = extractClosure({
  src: path.join(ROOT, 'appscript', 'Code.gs'),
  roots: ['getInitDataCustomer', 'sanitizeInitDataForApi_', 'getPublicCalendarBatch_', 'getPublicSlots_',
          'isPublicBookingItemGroup_', 'asNumber_', 'jsonOk_', 'jsonError_',
          'calculateQuote_', 'isPublicBookingProduct_', 'getProductById_', 'getPublicPayloadFromRequest_',   // quote 도 셔틀(2026-09-20 브라우저 실측: 메인 5.7초)
          'getSelectSession', 'listSelectPhotosPublic_'],   // 셀렉 조회 2종(2026-09-20 브라우저 실측: 메인 5.6초·8.7초)
  exclude: ['ensureSheets_', 'getCalCacheVer_', 'bumpCalCacheVer_', 'ensureHeaderSheet_', 'ensurePartnerSheet_'],   // 전부 Shim.gs 가 읽기 전용으로 대체
  out: path.join(ROOT, 'appscript-public', 'Public.gs'),
  label: 'node scripts/build-public-api.mjs',
  header: null,
});
if (r.failed) process.exitCode = 1;
console.log(`Public.gs 생성: 함수 ${r.fns.length}개, 상수 ${r.consts.length}개, ${r.blocks}블록`);
console.log('함수:', r.fns.join(', '));
console.log('상수:', r.consts.join(', '));
// 서비스 사용 스캔 — Shim 이 무엇을 대신해야 하는지
const code = r.code;
const scan = (re) => [...new Set([...code.matchAll(re)].map(m => m[0]))];
console.log('ensureSheets_ 멤버:', scan(/ensureSheets_\(\)\.[A-Za-z_]+/g).join(', '));
console.log('Properties:', scan(/getProperty\('([A-Z_]+)'\)/g).join(', '));
console.log('서비스:', ['CalendarApp','CacheService','UrlFetchApp','DriveApp','MailApp','LockService','PropertiesService','ScriptApp','SpreadsheetApp'].filter(s => code.includes(s)).join(', '));
// 쓰기 가드 — 시트/속성 쓰기가 섞이면 실패. Drive 의 setSharing 만 예외(drive.readonly 스코프가 막고 Code.gs 가 ok:false 로 폴백).
const writes = scan(/\.(setValue|setValues|appendRow|insertSheet|deleteRow|deleteRows|setProperty|deleteProperty|createFile|createFolder|setTrashed)\(/g);
if (writes.length) { console.error('❌ 쓰기 호출 포함 — 셔틀은 조회 전용:', writes.join(', ')); process.exitCode = 1; }
