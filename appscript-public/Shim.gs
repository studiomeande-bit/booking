/* public-api 셔틀 — 예약·셀렉 페이지 **조회**(api=init · quote · calendar-batch · slots · select-session · select-photos)만 제공하는 경량 웹앱.
 *
 * 왜: 메인 Code.gs(2.3MB)는 /exec 요청마다 3~5초 로드 바닥이 붙고, 예약 첫 방문은 그 요청이 3번(init→달력→슬롯)이다.
 * board-api 가 증명했듯 작은 프로젝트는 1~3초에 답한다(감사 2026-09-20 perf-1). 제출(api=booking)과 그 fresh 가용성
 * 가드(slotAvailable_)는 메인에 그대로 — 이중예약 보호는 여기 영향 없음.
 *
 * 읽기 전용은 코드로 보장한다(Public.gs 에 setValue/appendRow/insertSheet 없음 — 생성기가 스캔, doPost 거절). readonly 스코프는
 *   SpreadsheetApp.openById 가 거부해(2026-09-20 setup 실측 "Specified permissions are not sufficient") 메인과 같은 calendar·spreadsheets 스코프.
 *   Drive 만 drive.readonly — 셀렉 사진 목록의 폴더 공유 넓히기(setSharing)는 여기서 실패하고, Code.gs 가 PUBLIC_API_READONLY_ 를 보고
 *   ok:false 를 돌려 프런트가 메인으로 넘어간다(이미 공개된 폴더는 쓰기 없이 통과).
 * Public.gs 는 생성 파일(정본 appscript/Code.gs, 재생성 node scripts/build-public-api.mjs). 이 파일이 대신하는 것:
 *   ensureSheets_ · ensureHeaderSheet_ · ensurePartnerSheet_ (읽기 전용) · getCalCacheVer_ (설정 시트 cal_cache_ver,
 *   메인 bumpCalCacheVer_ 가 같은 키를 갱신) · bumpCalCacheVer_ (no-op) · 라우팅 · 워밍 트리거.
 * 프런트(frontend/shared/api-booking.js)는 셔틀이 실패하면(미승인 HTML·타임아웃) 메인으로 되돌아간다. */

const PUBLIC_DB_ID_DEFAULT_ = '1STWAMt30xku--NnFDHp1WOgpdGNQCH8T9Y0mZP6H8fI';   // docs/current-status.md 의 예약 DB
// 월 이벤트 캐시 TTL(초) — 5분 워밍 트리거가 항상 덮도록 7분(Code.gs _monthEventsTtlSec_ 가 읽는다). 메인은 120초.
const PUBLIC_MONTH_EVENT_TTL_SEC_ = 420;
// Code.gs 의 쓰기 분기가 "여기는 셔틀" 임을 아는 표식(listDriveFolderPhotosPublic_ 의 setSharing 실패 → ok:false).
const PUBLIC_API_READONLY_ = true;
let _publicSheetsCache_ = null;
function ensureSheets_() {
  if (_publicSheetsCache_) return _publicSheetsCache_;
  const props = PropertiesService.getScriptProperties();
  const id = String(props.getProperty('PUBLIC_DB_ID') || '').trim() || PUBLIC_DB_ID_DEFAULT_;
  const ss = SpreadsheetApp.openById(id);
  const bk = ss.getSheetByName(CONFIG.BOOKING_SHEET);
  if (!bk || String(bk.getRange(1, 1).getValue()).trim() !== CONFIG.BOOKING_HEADERS[0]) throw new Error('예약 DB 가 아닙니다: ' + id);
  const settingsSheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  const productsSheet = ss.getSheetByName(CONFIG.PRODUCTS_SHEET);
  if (!settingsSheet || !productsSheet) throw new Error('설정/상품설정 시트가 없습니다.');
  _publicSheetsCache_ = { ss: ss, bookingSheet: bk, settingsSheet: settingsSheet, productsSheet: productsSheet };
  return _publicSheetsCache_;
}
// 메인의 ensureHeaderSheet_ 는 없으면 만들고 헤더를 늘린다(쓰기) — 여기서는 있으면 돌려주고 없으면 실패한다.
function ensureHeaderSheet_(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('시트 없음: ' + sheetName);
  return sh;
}
function ensurePartnerSheet_(ss) { return ensureHeaderSheet_(ss, CONFIG.PARTNER_SHEET); }
// 가용성 캐시 버전 — 메인이 예약·셀렉 제출 때마다 설정 시트 cal_cache_ver 를 올린다(브리지). 없으면 '1'.
function getCalCacheVer_() {
  try { return String(getSettingsMap_().cal_cache_ver || '1'); } catch (e) { return '1'; }
}
function bumpCalCacheVer_() {}

// ── 워밍 ─────────────────────────────────────────────────────────
// 메인 warmupCacheTrigger 와 같은 몸통: 3개월 이벤트 캐시(TTL 120초)를 5분마다 데워 첫 클릭을 빠르게 한다.
function warmupPublicCache() {
  const now = new Date();
  for (let offset = 0; offset < 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    try {
      getCachedMonthEvents_(d.getFullYear(), d.getMonth(), false);
      getCachedMonthEvents_(d.getFullYear(), d.getMonth(), true);
    } catch (e) { Logger.log('warmup ' + d.getFullYear() + '-' + (d.getMonth() + 1) + ': ' + e.message); }
  }
}
/* 에디터에서 **한 번** 실행: 권한 승인(캘린더·시트 읽기, 외부요청, 트리거) + 5분 워밍 트리거 설치.
   웹앱은 승인 전엔 HTML 승인 페이지를 돌려주고, 프런트는 그동안 메인으로 폴백한다. */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'warmupPublicCache'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('warmupPublicCache').timeBased().everyMinutes(5).create();
  warmupPublicCache();
  return 'ok: ' + ensureSheets_().ss.getName();
}

// ── 라우팅 (메인 handlePublicApiRequest_ 의 세 분기와 동일한 검증) ────
function _pub_(e) {
  const p = (e && e.parameter) || {};
  const route = String(p.api || '').trim().toLowerCase();
  const t0 = Date.now();
  try {
    if (route === 'ping' || route === 'warmup') return jsonOk_({ pong: true, at: new Date().toISOString() });
    if (route === 'diag') {
      // 메인과의 드리프트 확인용(민감정보 없음): 캘린더 수·ICS 설정 유무·캐시 버전
      const props = PropertiesService.getScriptProperties();
      return jsonOk_({
        calendars: getBusyCalendarMeta_().length,
        icsConfigured: !!(props.getProperty('ICLOUD_ICS_URL') || props.getProperty('ICLOUD_CAL_URL')),
        calCacheVer: getCalCacheVer_(),
        ms: Date.now() - t0
      });
    }
    if (route === 'init') return jsonOk_(sanitizeInitDataForApi_(getInitDataCustomer()));
    if (route === 'quote') {   // 견적(가격 계산)도 읽기 전용 — 메인 handlePublicApiRequest_ 의 quote 분기와 동일
      const request = getPublicPayloadFromRequest_(e);
      const payload = request.payload;
      if (!payload || !payload.itemId) return jsonError_('INVALID_ARGUMENT', 'Missing quote parameters');
      if (!isPublicBookingProduct_(getProductById_(payload.itemId))) return jsonError_('INVALID_ARGUMENT', 'Unavailable product');
      return jsonOk_(calculateQuote_(payload));
    }
    if (route === 'calendar-batch') {
      const year = asNumber_(p.year);
      const month = asNumber_(p.month);
      const totalDur = asNumber_(p.totalDur);
      const itemGroup = String(p.itemGroup || '').trim();
      if (!itemGroup || !isFinite(year) || !isFinite(month) || !isFinite(totalDur)) return jsonError_('INVALID_ARGUMENT', 'Missing calendar batch parameters');
      if (!isPublicBookingItemGroup_(itemGroup)) return jsonError_('INVALID_ARGUMENT', 'Unavailable item group');
      return jsonOk_(getPublicCalendarBatch_(year, month, totalDur, itemGroup));
    }
    if (route === 'slots') {
      const date = String(p.date || '').trim();
      const totalDur = asNumber_(p.totalDur);
      const itemGroup = String(p.itemGroup || '').trim();
      if (!date || !itemGroup || !isFinite(totalDur)) return jsonError_('INVALID_ARGUMENT', 'Missing slot parameters');
      if (!isPublicBookingItemGroup_(itemGroup)) return jsonError_('INVALID_ARGUMENT', 'Unavailable item group');
      return jsonOk_(getPublicSlots_(date, totalDur, itemGroup));
    }
    // 셀렉 조회 2종 — 메인 handlePublicApiRequest_ 의 select-session / select-photos 분기와 동일. 제출·별점 저장은 메인.
    if (route === 'select-session') {
      const sessionId = String(p.id || '').trim();
      if (!sessionId) return jsonError_('INVALID_SESSION', 'Missing session id');
      return jsonOk_(getSelectSession(sessionId));
    }
    if (route === 'select-photos') {
      const sessionId = String(p.id || '').trim();
      if (!sessionId) return jsonError_('INVALID_SESSION', 'Missing session id');
      const recursive = String(p.recursive || '1').trim().toLowerCase();
      return jsonOk_(listSelectPhotosPublic_(sessionId, { limit: p.limit, recursive: recursive !== '0' && recursive !== 'false', cursor: p.cursor }));
    }
    return jsonError_('NOT_FOUND', 'public-api: init · quote · calendar-batch · slots · select-session · select-photos 만 제공합니다.');
  } catch (err) {
    return jsonError_('PUBLIC_API_ERROR', String((err && err.message) || err));
  }
}
function doGet(e) { return _pub_(e); }

/* ── 메인 → 셔틀 속성 동기화 (POST api=sync-props) ────────────────────────
 * iCloud/Apple 속성(ICLOUD_CAL_URL·ICLOUD_ICS_URL·APPLE_ID·APPLE_APP_PASSWORD)과 ACTION_SECRET 은 프로젝트별 저장이라 셔틀에는 없다.
 * 메인의 erp-agent 액션 `public-api-sync-props` 가 값을 **구글↔구글로만** 보낸다 — 사람·에이전트 터미널을 거치지 않는다.
 * 인증은 board-api 와 같은 TOFU: 자동화 키의 SHA-256 다이제스트만 저장(PUBLIC_SYNC_DIGEST), 첫 호출이 등록한다. */
function _tokenDigest_(token) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}
function _checkSyncToken_(token) {
  const t = String(token || '').trim();
  if (t.length < 24) return false;
  const props = PropertiesService.getScriptProperties();
  const stored = String(props.getProperty('PUBLIC_SYNC_DIGEST') || '').trim();
  const digest = _tokenDigest_(t);
  if (!stored) { props.setProperty('PUBLIC_SYNC_DIGEST', digest); return true; }
  return stored === digest;
}
const SYNC_PROP_ALLOWLIST_ = ['ICLOUD_CAL_URL', 'ICLOUD_ICS_URL', 'APPLE_ID', 'APPLE_APP_PASSWORD', 'PUBLIC_DB_ID', 'ACTION_SECRET'];   // ACTION_SECRET: 셀렉 철회 링크 서명 일치
function doPost(e) {
  let body = {};
  try { if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents) || {}; } catch (err) {}
  const api = String(((e && e.parameter) || {}).api || body.api || '').trim();
  if (api !== 'sync-props') return jsonError_('METHOD_NOT_ALLOWED', 'public-api 는 GET 조회 전용입니다.');
  if (!_checkSyncToken_(body.apiKey)) return jsonError_('UNAUTHORIZED', 'sync token invalid');
  const props = PropertiesService.getScriptProperties();
  const set = [];
  SYNC_PROP_ALLOWLIST_.forEach(function (k) {
    const v = body.props && body.props[k];
    if (typeof v === 'string' && v.trim()) { props.setProperty(k, v.trim()); set.push(k); }
  });
  try { CacheService.getScriptCache().remove('busy_cal_meta_v3'); } catch (err) {}   // 캘린더 메타 캐시 — ICS 유무가 바뀌었으니 다시 읽게
  return jsonOk_({ set: set });
}
