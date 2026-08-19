import { buildPayloadUrl, buildUrl, parseJsonResponse } from './api-core.js';

async function requestJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  return parseJsonResponse(response);
}

/* 협력업체 클릭 집계 — 응답을 기다리지 않는다(링크는 이미 새 탭에서 열렸다).
   keepalive 로 페이지가 바뀌어도 전송이 살아남는다. 실패는 조용히 무시: 집계 때문에
   고객 흐름을 막지 않는다. 개인정보는 보내지 않는다(업체·출처·언어·상품군만). */
export function pingPartnerClick({ partnerId, source, lang, itemGroup }) {
  if (!partnerId) return;
  try {
    fetch(buildUrl('partner-click', { p: partnerId, s: source || 'web', lang: lang || '', g: itemGroup || '' }), {
      method: 'GET',
      keepalive: true,
      cache: 'no-store',
      mode: 'no-cors'
    }).catch(() => {});
  } catch { /* ignore */ }
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
  return requestJson(buildPayloadUrl('booking', data, { requestId }));
}

export function submitWalkinIntake(data, requestId) {
  return requestJson(buildPayloadUrl('walkin-intake', data, { requestId }));
}

export function fetchWalkinToken() {
  return requestJson(buildUrl('walkin-token'));
}

export function submitConsultation(data, requestId) {
  return requestJson(buildPayloadUrl('consultation', data, { requestId }));
}

export function joinWaitlist(data, requestId) {
  return requestJson(buildPayloadUrl('waitlist-join', data, { requestId }));
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
