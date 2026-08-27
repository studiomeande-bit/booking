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
    if (error?.name === 'AbortError') {
      throw new Error('서버 응답이 너무 오래 걸립니다. 예약이 접수되었을 수 있으니 확인 메일을 먼저 확인해 주세요. 메일이 없으면 다시 제출해 주세요.');
    }
    if (error?.message === 'Failed to fetch') {
      throw new Error('서버 연결에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 제출해 주세요.');
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
  return parseJsonResponse(response);
}

export async function parseJsonResponse(response) {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    /* JSON 이 아니면 대개 구글이 스크립트에 닿기 전에 낸 오류 페이지다(길이 초과·일시 장애·점검).
       원문 HTML 을 그대로 보여 주면 고객은 무슨 일인지 알 수 없다 — 사람이 읽을 문장으로 바꾼다. */
    const status = response?.status || 0;
    if (status === 400 || status === 413 || status === 414) {
      throw new Error('입력 내용이 너무 길어 전송하지 못했습니다. 요청사항을 조금 줄여 다시 시도해 주세요.');
    }
    throw new Error('서버가 일시적으로 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  if (!payload.ok) throw new Error(payload.error?.message || 'API request failed');
  return payload.data;
}
