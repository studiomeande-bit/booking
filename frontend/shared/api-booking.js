import { buildPayloadUrl, buildUrl, parseJsonResponse, postPayload } from './api-core.js';

/* 고객이 자유입력을 담아 보내는 '제출' 계열은 전부 POST 다(booking·walkin-intake·consultation·waitlist-join).
   GET + ?payload= 는 URL 길이 한계에 걸린다 — 실측 2026-08-27: URL 약 12,000자 초과 시 구글이 HTTP 400.
   한글은 URL 인코딩에서 1자가 9자가 되므로 요청사항 한글 1,300자 남짓이면 넘긴다. 상세 = api-core.js 주석.
   조회 계열(quote·contact-lookup·address-lookup·gutschein-validate 등)은 payload 가 짧아 GET 을 유지한다. */

async function requestJson(url) {
  let response;
  try {
    response = await fetch(url, { cache: 'no-store' });
  } catch (error) {
    /* URL 이 너무 길면 브라우저가 요청 자체를 못 보내고 'Failed to fetch' 로 죽는다.
       그 문구가 그대로 화면에 뜨면 고객은 원인을 알 수 없다(2026-08-27 실제 신고). */
    if (error?.message === 'Failed to fetch') {
      throw new Error('서버 연결에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
    }
    throw error;
  }
  return parseJsonResponse(response);
}

/* 협력업체 클릭 집계 — 응답을 기다리지 않는다(링크는 이미 새 탭에서 열렸다).
   keepalive 로 페이지가 바뀌어도 전송이 살아남는다. 실패는 조용히 무시: 집계 때문에
   고객 흐름을 막지 않는다. 개인정보는 보내지 않는다(업체·출처·언어·상품군만). */
export function pingPartnerClick({ partnerId, source, lang, itemGroup, linkKind }) {
  if (!partnerId) return;
  try {
    fetch(buildUrl('partner-click', { p: partnerId, s: source || 'web', lang: lang || '', g: itemGroup || '', l: linkKind || '' }), {
      method: 'GET',
      keepalive: true,
      cache: 'no-store',
      mode: 'no-cors'
    }).catch(() => {});
  } catch { /* ignore */ }
}

export function fetchPartners() {
  return requestJson(buildUrl('partners'));
}

export function fetchInitData() {
  return requestJson(buildUrl('init'));
}

export function fetchCalendarBatch({ year, month, totalDur, itemGroup }) {
  return requestJson(buildUrl('calendar-batch', { year, month, totalDur, itemGroup }));
}

export function fetchSlots({ date, totalDur, itemGroup }) {
  return requestJson(buildUrl('slots', { date, totalDur, itemGroup }));
}

export function fetchQuote(data) {
  return requestJson(buildPayloadUrl('quote', data));
}

export function fetchReturnEligibility(data) {
  return requestJson(buildPayloadUrl('return-check', data));
}

export function submitBooking(data, requestId) {
  return postPayload('booking', data, { requestId });
}

export function submitWalkinIntake(data, requestId) {
  return postPayload('walkin-intake', data, { requestId });
}

export function fetchWalkinToken() {
  return requestJson(buildUrl('walkin-token'));
}

export function submitConsultation(data, requestId) {
  return postPayload('consultation', data, { requestId });
}

export function joinWaitlist(data, requestId) {
  return postPayload('waitlist-join', data, { requestId });
}

export function lookupContact(data) {
  return requestJson(buildPayloadUrl('contact-lookup', data));
}

export function lookupAddress(data) {
  return requestJson(buildPayloadUrl('address-lookup', data));
}

export function fetchGutscheinTicket(code) {
  return requestJson(buildUrl('gutschein-ticket', { code }));
}

export function validateGutschein(data) {
  return requestJson(buildPayloadUrl('gutschein-validate', data));
}

export function holdGutschein(data, requestId) {
  return requestJson(buildPayloadUrl('gutschein-hold', data, { requestId }));
}

export function releaseGutschein(data) {
  return requestJson(buildPayloadUrl('gutschein-release', data));
}

export function buildGutscheinReleaseUrl(data) {
  return buildPayloadUrl('gutschein-release', data);
}
