import { READ, buildPayloadUrl, buildUrl, postPayload, requestJson } from './api-core.js';

/* 고객이 자유입력을 담아 보내는 '제출' 계열은 전부 POST 다(booking·walkin-intake·consultation·waitlist-join).
   GET + ?payload= 는 URL 길이 한계에 걸린다 — 실측 2026-08-27: URL 약 12,000자 초과 시 구글이 HTTP 400.
   한글은 URL 인코딩에서 1자가 9자가 되므로 요청사항 한글 1,300자 남짓이면 넘긴다. 상세 = api-core.js 주석.
   조회 계열(quote·contact-lookup·address-lookup·gutschein-validate 등)은 payload 가 짧아 GET 을 유지한다.
   requestJson / READ(25초 + 1회 재시도)는 api-core.js 에 있다 — 셀렉 조회와 공유. */

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
  return requestJson(buildUrl('partners'), READ);
}

export function fetchInitData() {
  return requestJson(buildUrl('init'), READ);
}

export function fetchCalendarBatch({ year, month, totalDur, itemGroup }) {
  return requestJson(buildUrl('calendar-batch', { year, month, totalDur, itemGroup }), READ);
}

export function fetchSlots({ date, totalDur, itemGroup }) {
  return requestJson(buildUrl('slots', { date, totalDur, itemGroup }), READ);
}

export function fetchQuote(data) {
  return requestJson(buildPayloadUrl('quote', data), READ);
}

export function fetchReturnEligibility(data) {
  return requestJson(buildPayloadUrl('return-check', data), READ);
}

export function submitBooking(data, requestId) {
  return postPayload('booking', data, { requestId });
}

export function submitWalkinIntake(data, requestId) {
  return postPayload('walkin-intake', data, { requestId });
}

export function fetchWalkinToken() {
  return requestJson(buildUrl('walkin-token'), READ);
}

export function submitConsultation(data, requestId) {
  return postPayload('consultation', data, { requestId });
}

export function joinWaitlist(data, requestId) {
  return postPayload('waitlist-join', data, { requestId });
}

export function lookupContact(data) {
  return requestJson(buildPayloadUrl('contact-lookup', data), READ);
}

export function lookupAddress(data) {
  return requestJson(buildPayloadUrl('address-lookup', data), READ);
}

export function fetchGutscheinTicket(code) {
  return requestJson(buildUrl('gutschein-ticket', { code }), READ);
}

export function validateGutschein(data) {
  return requestJson(buildPayloadUrl('gutschein-validate', data), READ);
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
