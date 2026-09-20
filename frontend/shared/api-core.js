import { CONFIG } from './config.js';

export function buildUrl(route, params = {}) {
  const base = new URL(CONFIG.apiBaseUrl);
  base.searchParams.set('api', route);
  base.searchParams.set('_ts', String(Date.now()));
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    base.searchParams.set(key, value);
  });
  return base.toString();
}

/* 조회 셔틀 URL — CONFIG.readApiBaseUrl 이 비어 있으면 메인과 같다 */
export function buildReadUrl(route, params = {}) {
  const base = new URL(CONFIG.readApiBaseUrl || CONFIG.apiBaseUrl);
  base.searchParams.set('api', route);
  base.searchParams.set('_ts', String(Date.now()));
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    base.searchParams.set(key, value);
  });
  return base.toString();
}

export function buildPayloadUrl(route, data = {}, extraParams = {}) {
  return buildUrl(route, {
    ...extraParams,
    payload: JSON.stringify({ ...extraParams, data })
  });
}

/* 제출은 반드시 POST 로 보낸다.
   ⚠️ GET + ?payload= 로 보내면 **구글이 URL 길이로 막는다** — 실측(2026-08-27): URL 이 약 12,000자를
   넘으면 Apps Script 에 닿지도 못하고 HTTP 400 + HTML 오류페이지가 돌아온다. 한글은 URL 인코딩에서
   한 글자가 9자로 부풀기 때문에, 요청사항에 한글 1,300자쯤만 써도 넘긴다. 그 경우 고객 화면에는
   `Invalid API response: <!DOCTYPE html>...` 이 떴다(= "예약이 안 넘어간다").
   POST 는 본문으로 가므로 길이 제한이 없다 — 셀렉 제출이 이미 이 경로로 돌고 있다.

   타임아웃: Apps Script 는 콜드 스타트가 30초를 넘기도 한다(실측 34.6초). 무한 대기를 막되
   성공한 제출을 끊지 않도록 넉넉히 잡는다. requestId 중복 제출 가드가 있어 재시도는 안전하다. */
const SUBMIT_TIMEOUT_MS = 120000;

export async function postPayload(route, data = {}, extraParams = {}) {
  let response;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS) : null;
  try {
    response = await fetch(buildUrl(route, extraParams), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ ...extraParams, data }),
      signal: controller ? controller.signal : undefined
    });
  } catch (error) {
    /* code 는 호출자가 "이 제출이 서버에 닿았을 수 있는가" 를 판단하는 근거다.
       TIMEOUT·NETWORK = 닿았을 수 있음(requestId 유지, 재시도는 서버 중복가드가 거른다)
       SERVER = 서버가 명시적으로 거절(성립 안 함 → 다음 시도는 새 requestId). */
    if (error?.name === 'AbortError') {
      throw tagged('서버 응답이 너무 오래 걸립니다. 예약이 접수되었을 수 있으니 확인 메일을 먼저 확인해 주세요. 메일이 없으면 다시 제출해 주세요.', 'TIMEOUT');
    }
    if (error instanceof TypeError) {   // 네트워크 실패 — 문구는 브라우저마다 다르다(requestJson 주석 참고)
      throw tagged('서버 연결에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 제출해 주세요.', 'NETWORK');
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
  return parseJsonResponse(response);
}

export function tagged(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/* 본문을 JSON 으로 읽는다. JSON 이 아니면 대개 구글이 스크립트에 닿기 전에 낸 오류 페이지다(길이 초과·일시 장애·점검).
   원문 HTML 을 그대로 보여 주면 고객은 무슨 일인지 알 수 없다 — 사람이 읽을 문장(GATEWAY)으로 바꾼다. */
export async function readJsonBody(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    const status = response?.status || 0;
    if (status === 400 || status === 413 || status === 414) {
      throw tagged('입력 내용이 너무 길어 전송하지 못했습니다. 요청사항을 조금 줄여 다시 시도해 주세요.', 'GATEWAY');
    }
    throw tagged('서버가 일시적으로 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'GATEWAY');
  }
}

export async function parseJsonResponse(response) {
  const payload = await readJsonBody(response);
  if (!payload.ok) {
    const err = tagged(payload.error?.message || 'API request failed', 'SERVER');
    err.apiCode = payload.error?.code || '';
    throw err;
  }
  return payload.data;
}

/* 조회(GET) 공용 — 시간 제한 + 재시도. 조회는 부작용이 없어 한 번 더 보내도 안전하다.
   parse 로 응답 해석을 바꿀 수 있다(셀렉 세션은 ok:false 여도 submitted 를 통과시킨다). */
export async function requestJson(url, { timeoutMs = 0, retries = 0, parse = parseJsonResponse } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const controller = timeoutMs && typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let response;
    try {
      response = await fetch(url, { cache: 'no-store', signal: controller ? controller.signal : undefined });
    } catch (error) {
      if (attempt < retries) continue;
      if (error?.name === 'AbortError') {
        throw tagged('서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.', 'TIMEOUT');
      }
      /* fetch 가 네트워크 단계에서 죽으면 TypeError 다 — 문구는 브라우저마다 다르다
         (Chrome 'Failed to fetch', Safari 'Load failed', Firefox 'NetworkError…'). 문구 비교로 잡으면 Safari 를 놓친다.
         URL 이 너무 길어 브라우저가 요청 자체를 못 보내는 경우도 여기로 온다(2026-08-27 실제 신고). */
      if (error instanceof TypeError) {
        throw tagged('서버 연결에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.', 'NETWORK');
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
    return parse(response);
  }
}

/* 조회(페이지 준비·달력·시간·견적·셀렉 세션)는 시간 제한 + 1회 재시도를 건다.
   Apps Script 는 평소 요청당 3~5초인데, 가끔 한 요청이 수십 초 멈춘다(2026-09-18 실측: 같은 계정의
   작은 스크립트가 98초). 제한이 없으면 고객 화면은 그동안 '불러오는 중'에서 멈춰 보인다 — 끊고 다시 보낸다.
   25초 = 평소 최장(콜드 스타트 18초 실측) 위. 제출·홀드처럼 부작용 있는 요청에는 걸지 않는다. */
export const READ = { timeoutMs: 25000, retries: 1 };
