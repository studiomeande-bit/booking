/* board-api 셔틀 — 오늘촬영 보드 읽기 전용 경량 웹앱.
 *
 * 이 프로젝트가 존재하는 이유: 메인 Code.gs(2MB)는 /exec 요청마다 4.5~8초의 로드 고정비가
 * 붙는다(warmup 실측 2026-08-31). 보드는 1분 폴링이라 그 비용을 가장 크게 문다.
 * 여기는 Board.gs(생성본) + 이 셔틀뿐이라 왕복이 짧다.
 *
 * 읽기 전용이다 — 쓰기 액션(시작/지연/잔금)은 전부 메인 프로젝트로 간다.
 * Board.gs 는 생성 파일: 정본은 appscript/Code.gs, 재생성은 node scripts/build-board-api.mjs.
 */

/* ── 시트 해석 ────────────────────────────────────────────────────
 * 메인은 Script Properties 의 DB_SHEET_ID 를 쓰지만 속성은 프로젝트 간 공유가 안 된다.
 * 여기서는 이름(CONFIG.DB_NAME)으로 찾되, 일일 백업 사본과 헷갈리지 않도록
 * '예약장부' 시트가 있고 **가장 최근에 수정된** 파일을 고른다 — 라이브 DB 는 예약이
 * 들어올 때마다 수정되므로 항상 최신이고, 백업은 스냅샷이라 멈춰 있다.
 * 찾은 ID 는 속성에 캐시하고 열 때마다 검증한다(깨지면 재탐색).
 * ponytail: 이름+최신수정 휴리스틱 — 오판 사례가 나오면 메인처럼 스코어링 도입 */
let _boardSheetsCache_ = null;
function ensureSheets_() {
  if (_boardSheetsCache_) return _boardSheetsCache_;
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const cached = String(props.getProperty('BOARD_DB_ID') || '').trim();
  if (cached) {
    try {
      const cand = SpreadsheetApp.openById(cached);
      if (cand.getSheetByName(CONFIG.BOOKING_SHEET)) ss = cand;
    } catch (e) {}
  }
  if (!ss) {
    let best = null, bestTime = 0;
    const files = DriveApp.getFilesByName(CONFIG.DB_NAME);
    while (files.hasNext()) {
      const f = files.next();
      try {
        const cand = SpreadsheetApp.openById(f.getId());
        const bk = cand.getSheetByName(CONFIG.BOOKING_SHEET);
        if (!bk) continue;
        if (String(bk.getRange(1, 1).getValue()).trim() !== CONFIG.BOOKING_HEADERS[0]) continue;
        const t = f.getLastUpdated().getTime();
        if (t > bestTime) { bestTime = t; best = cand; }
      } catch (e) {}
    }
    if (!best) throw new Error('예약 DB 스프레드시트를 찾지 못했습니다: ' + CONFIG.DB_NAME);
    ss = best;
    props.setProperty('BOARD_DB_ID', ss.getId());
  }
  _boardSheetsCache_ = {
    ss: ss,
    bookingSheet: ss.getSheetByName(CONFIG.BOOKING_SHEET),
    productsSheet: ss.getSheetByName(CONFIG.PRODUCTS_SHEET)
  };
  return _boardSheetsCache_;
}

/* ── 인증 ─────────────────────────────────────────────────────────
 * 오늘촬영 앱이 이미 쓰는 자동화 키를 그대로 받되, 여기엔 **키의 SHA-256 다이제스트만**
 * 저장한다(읽기 전용 프로젝트가 풀-어드민 키 원문을 들고 있을 이유가 없다).
 * 최초 1회 신뢰(TOFU): 다이제스트가 비어 있으면 첫 요청의 키를 등록한다 —
 * 배포 직후 우리가 곧바로 첫 호출을 해서 창을 닫는다. 키 교체 시 BOARD_TOKEN_DIGEST
 * 속성을 지우고 새 키로 한 번 호출하면 된다. */
function _tokenDigest_(token) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}
function _checkToken_(token) {
  const t = String(token || '').trim();
  if (t.length < 24) return false;
  const props = PropertiesService.getScriptProperties();
  const stored = String(props.getProperty('BOARD_TOKEN_DIGEST') || '').trim();
  const digest = _tokenDigest_(t);
  if (!stored) { props.setProperty('BOARD_TOKEN_DIGEST', digest); return true; }
  return stored === digest;
}

// ── 라우팅 ─────────────────────────────────────────────────────────
function _json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function _handle_(e, method) {
  e = e || {}; const p = e.parameter || {};
  let body = {};
  try { if (e.postData && e.postData.contents) body = JSON.parse(e.postData.contents) || {}; } catch (err) {}
  const data = (body && typeof body.data === 'object' && body.data) || body || {};
  const api = String(p.api || data.api || '').trim();
  const action = String(data.agentAction || '').trim();
  if (api === 'ping') return _json_({ ok: true, data: { pong: true, at: new Date().toISOString() } });
  if (api !== 'today-board' && action !== 'today-board') {
    return _json_({ ok: false, error: { code: 'NOT_FOUND', message: 'board-api: today-board 만 제공합니다.' } });
  }
  const token = String(data.apiKey || data.token || p.token || '').trim();
  if (!_checkToken_(token)) {
    return _json_({ ok: false, error: { code: 'UNAUTHORIZED', message: '보드 토큰이 올바르지 않습니다.' } });
  }
  try {
    const date = String(data.date || p.date || '').trim();
    const fresh = String(data.fresh || p.fresh || '') === 'true' || data.fresh === true;
    const board = fresh ? buildTodayBoard_(date) : buildTodayBoardCached_(date);
    return _json_({ ok: true, data: board });
  } catch (err) {
    return _json_({ ok: false, error: { code: 'BOARD_ERROR', message: String(err && err.message || err) } });
  }
}
function doGet(e) { return _handle_(e, 'get'); }
function doPost(e) { return _handle_(e, 'post'); }
