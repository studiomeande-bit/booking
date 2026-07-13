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

export async function postPayload(route, data = {}, extraParams = {}) {
  let response;
  try {
    response = await fetch(buildUrl(route, extraParams), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ ...extraParams, data })
    });
  } catch (error) {
    if (error?.message === 'Failed to fetch') {
      throw new Error('서버 연결에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 제출해 주세요.');
    }
    throw error;
  }
  return parseJsonResponse(response);
}

export async function parseJsonResponse(response) {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Invalid API response: ${text.slice(0, 200)}`);
  }
  if (!payload.ok) throw new Error(payload.error?.message || 'API request failed');
  return payload.data;
}
