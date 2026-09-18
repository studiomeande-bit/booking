import { buildPayloadUrl, buildUrl, parseJsonResponse, postPayload } from './api-core.js';

/* 고객이 자유입력을 담아 보내는 '제출' 계열은 전부 POST 다(booking·walkin-intake·consultation·waitlist-join).
   GET + ?payload= 는 URL 길이 한계에 걸린다 — 실측 2026-08-27: URL 약 12,000자 초과 시 구글이 HTTP 400.
   한글은 URL 인코딩에서 1자가 9자가 되므로 요청사항 한글 1,300자 남짓이면 넘긴다. 상세 = api-core.js 주석.
   조회 계열(quote·contact-lookup·address-lookup·gutschein-validate 등)은 payload 가 짧아 GET 을 유지한다. */

async function requestJson(url, { timeoutMs = 0, retries = 0 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const controller = timeoutMs && typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let response;
    try {
      response = await fetch(url, { cache: 'no-store', signal: controller ? controller.signal : undefined });
    } catch (error) {
      if (attempt < retries) continue;   // 조회는 부작용이 없어 한 번 더 보내도 안전하다
      if (error?.name === 'AbortError') {
        throw new Error('서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.');
      }
      /* URL 이 너무 길면 브라우저가 요청 자체를 못 보내고 'Failed to fetch' 로 죽는다.
         그 문구가 그대로 화면에 뜨면 고객은 원인을 알 수 없다(2026-08-27 실제 신고). */
      if (error?.message === 'Failed to fetch') {
        throw new Error('서버 연결에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
    return parseJsonResponse(response);
  }
}

/* 조회(페이지 준비·달력·시간·견적)는 시간 제한 + 1회 재시도를 건다.
   Apps Script 는 평소 요청당 3~5초인데, 가끔 한 요청이 수십 초 멈춘다(2026-09-18 실측: 같은 계정의
   작은 스크립트가 98초). 제한이 없으면 고객 화면은 그동안 '불러오는 중'에서 멈춰 보인다 — 끊고 다시 보낸다.
   25초 = 평소 최장(콜드 스타트 18초 실측) 위. 제출·홀드처럼 부작용 있는 요청에는 걸지 않는다. */
const READ = { timeoutMs: 25000, retries: 1 };

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
