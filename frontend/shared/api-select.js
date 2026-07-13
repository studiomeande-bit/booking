import { buildUrl, parseJsonResponse, postPayload } from './api-core.js';

const SELECT_PHOTOS_TIMEOUT_MS = 60000;
const SELECT_PHOTOS_BATCH_SIZE = 300;

async function fetchTextWithTimeout(url, timeoutMs = SELECT_PHOTOS_TIMEOUT_MS) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer = null;
  if (controller) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller?.signal
    });
    return await response.text();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('갤러리 로딩 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function assertSelectMutationResult(result, expectedPhotoCount = null) {
  if (result?.ok === false) {
    throw new Error(result.message || '셀렉 제출에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
  if (result?.saved !== true) {
    throw new Error('서버 저장 확인이 완료되지 않았습니다. 성공 화면이 보이지 않으면 잠시 후 다시 제출해 주세요.');
  }
  if (expectedPhotoCount !== null && Number(result?.selectedPhotoCount) !== Number(expectedPhotoCount)) {
    throw new Error('서버에 저장된 셀렉 장수가 제출 내용과 다릅니다. 다시 제출해 주세요.');
  }
  return result;
}

export async function fetchSelectSession(sessionId) {
  const response = await fetch(buildUrl('select-session', { id: sessionId }), { cache: 'no-store' });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Invalid API response: ${text.slice(0, 200)}`);
  }
  if (payload.ok) {
    if (payload.data?.ok === false && payload.data?.submitted) return payload.data;
    if (payload.data?.ok === false) throw new Error(payload.data?.message || 'API request failed');
    return payload.data;
  }
  if (payload.submitted) return payload;
  throw new Error(payload.error?.message || payload.message || 'API request failed');
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

export async function fetchSelectPickupCalendar(year, month) {
  const response = await fetch(buildUrl('select-pickup-calendar', { year, month }), { cache: 'no-store' });
  return parseJsonResponse(response);
}

export async function fetchSelectPickupSlots(date, ignoreEventId = '') {
  const response = await fetch(buildUrl('select-pickup-slots', { date, ignoreEventId }), { cache: 'no-store' });
  return parseJsonResponse(response);
}

export async function fetchSelectPhotos(sessionId, options = {}) {
  const text = await fetchTextWithTimeout(buildUrl('select-photos', {
    id: sessionId,
    limit: options.limit || SELECT_PHOTOS_BATCH_SIZE,
    recursive: options.recursive === false ? '0' : '1',
    cursor: options.cursor || ''
  }));
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('Invalid response'); }
  if (payload.ok) {
    if (payload.data?.ok === false) throw new Error(payload.data?.message || 'Listing failed');
    return payload.data;
  }
  throw new Error(payload.error?.message || payload.message || 'Listing failed');
}

export async function fetchSelectPreviewPhotos(folder, options = {}) {
  const query = { folder };
  query.recursive = options.recursive === false ? '0' : '1';
  query.limit = options.limit || SELECT_PHOTOS_BATCH_SIZE;
  if (options.cursor) query.cursor = options.cursor;
  const text = await fetchTextWithTimeout(buildUrl('select-photos-preview', query));
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('Invalid response'); }
  if (payload.ok) {
    if (payload.data?.ok === false) throw new Error(payload.data?.message || 'Listing failed');
    return payload.data;
  }
  throw new Error(payload.error?.message || payload.message || 'Listing failed');
}
