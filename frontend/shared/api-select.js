import { READ, READ_SHUTTLE, buildUrl, parseJsonResponse, postPayload, readJsonBody, readViaShuttle, requestJson, tagged } from './api-core.js';

const SELECT_PHOTOS_TIMEOUT_MS = 60000;
const SELECT_PHOTOS_BATCH_SIZE = 300;

/* 갤러리 목록은 크고 느리다(수백 장) — READ 의 25초·재시도 대신 60초 단발. 오류 코드(TIMEOUT·NETWORK·GATEWAY·SERVER)는 나머지 조회와 같다. */
async function parseSelectPhotos(response) {
  const data = await parseJsonResponse(response);
  if (data?.ok === false) throw tagged(data.message || 'Listing failed', 'SERVER');
  return data;
}
const SELECT_PHOTOS = { timeoutMs: SELECT_PHOTOS_TIMEOUT_MS, parse: parseSelectPhotos };

// 서버가 응답은 했지만 이 제출을 그대로 받지 않았다 — 안내대로 재제출하려면 새 시도여야 하므로 SERVER 로 태그한다.
function assertSelectMutationResult(result, expectedPhotoCount = null) {
  if (result?.ok === false) {
    throw tagged(result.message || '셀렉 제출에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'SERVER');
  }
  if (result?.saved !== true) {
    throw tagged('서버 저장 확인이 완료되지 않았습니다. 성공 화면이 보이지 않으면 잠시 후 다시 제출해 주세요.', 'SERVER');
  }
  if (expectedPhotoCount !== null && Number(result?.selectedPhotoCount) !== Number(expectedPhotoCount)) {
    throw tagged('서버에 저장된 셀렉 장수가 제출 내용과 다릅니다. 다시 제출해 주세요.', 'SERVER');
  }
  return result;
}

/* 세션 조회 — ok:false 여도 submitted 가 실리면 '이미 제출된 세션' 화면용으로 통과시킨다. 그래서 parseJsonResponse 대신 자체 해석. */
async function parseSelectSession(response) {
  const payload = await readJsonBody(response);
  if (payload.ok) {
    if (payload.data?.ok === false && payload.data?.submitted) return payload.data;
    if (payload.data?.ok === false) throw tagged(payload.data?.message || 'API request failed', 'SERVER');
    return payload.data;
  }
  if (payload.submitted) return payload;
  throw tagged(payload.error?.message || payload.message || 'API request failed', 'SERVER');
}

/* 세션·사진 목록은 셔틀(appscript-public) 먼저 — 브라우저 실측(2026-09-20) 메인 5.6초·8.7초. 실패·미공유 폴더(ok:false)면 메인.
   사진 목록은 Drive 열거 자체가 수 초라 셔틀에도 60초 단발을 준다 — 12초에 끊고 메인에서 다시 열거하면 더 늦다. */
export function fetchSelectSession(sessionId) {
  return readViaShuttle('select-session', { id: sessionId }, {
    shuttle: { ...READ_SHUTTLE, parse: parseSelectSession },
    main: { ...READ, parse: parseSelectSession }
  });
}

// 별점(찜) 영속화 — 디바운스 저장. 실패해도 조용히(다음 변경 때 재시도), 찜은 UX 보조 데이터다.
export async function saveSelectRatings(sessionId, ratings) {
  return postPayload('select-ratings-save', { sessionId, ratings });
}

export async function submitSelectSession(sessionId, submission, requestId) {
  return assertSelectMutationResult(
    await postPayload('select-submit', { sessionId, submission }, { requestId }),
    Array.isArray(submission?.photos) ? submission.photos.length : null
  );
}

export async function updateSelectSession(sessionId, submission, requestId) {
  return assertSelectMutationResult(
    await postPayload('select-update', { sessionId, submission }, { requestId }),
    Array.isArray(submission?.photos) ? submission.photos.length : null
  );
}

// 유료 추가 주문의 법정 문구 — 셀렉 미리보기(?preview=1) 전용. 실세션은 select-session 응답의 legal 로 받는다.
export function fetchWiderrufText() {
  return requestJson(buildUrl('widerruf-text', {}), READ);
}

export function fetchSelectPickupCalendar(year, month) {
  return requestJson(buildUrl('select-pickup-calendar', { year, month }), READ);
}

export function fetchSelectPickupSlots(date, ignoreEventId = '') {
  return requestJson(buildUrl('select-pickup-slots', { date, ignoreEventId }), READ);
}

export function fetchSelectPhotos(sessionId, options = {}) {
  return readViaShuttle('select-photos', {
    id: sessionId,
    limit: options.limit || SELECT_PHOTOS_BATCH_SIZE,
    recursive: options.recursive === false ? '0' : '1',
    cursor: options.cursor || ''
  }, { shuttle: SELECT_PHOTOS, main: SELECT_PHOTOS });
}

export function fetchSelectPreviewPhotos(folder, options = {}) {
  const query = { folder };
  query.recursive = options.recursive === false ? '0' : '1';
  query.limit = options.limit || SELECT_PHOTOS_BATCH_SIZE;
  if (options.cursor) query.cursor = options.cursor;
  return requestJson(buildUrl('select-photos-preview', query), SELECT_PHOTOS);
}
