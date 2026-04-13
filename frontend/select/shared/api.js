import { CONFIG } from './config.js';

function buildUrl(route, params = {}) {
  const base = new URL(CONFIG.apiBaseUrl);
  base.searchParams.set('api', route);
  base.searchParams.set('_ts', String(Date.now()));
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    base.searchParams.set(key, value);
  });
  return base.toString();
}

function buildPayloadUrl(route, data = {}, extraParams = {}) {
  return buildUrl(route, {
    ...extraParams,
    payload: JSON.stringify({ ...extraParams, data })
  });
}

async function parseJsonResponse(response) {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Invalid API response: ${text.slice(0, 200)}`);
  }
  if (!payload.ok) {
    throw new Error(payload.error?.message || 'API request failed');
  }
  return payload.data;
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

export async function submitSelect(sessionId, submission, requestId) {
  const response = await fetch(buildPayloadUrl('select-submit', { sessionId, submission }, { requestId }), {
    cache: 'no-store'
  });
  return parseJsonResponse(response);
}

export async function updateSelect(sessionId, submission, requestId) {
  const response = await fetch(buildPayloadUrl('select-update', { sessionId, submission }, { requestId }), {
    cache: 'no-store'
  });
  return parseJsonResponse(response);
}
