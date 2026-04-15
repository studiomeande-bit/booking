import { buildPayloadUrl, buildUrl, parseJsonResponse } from './api-core.js';

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
  const response = await fetch(
    buildPayloadUrl('select-submit', { sessionId, submission }, { requestId }),
    { cache: 'no-store' }
  );
  return parseJsonResponse(response);
}

export async function updateSelectSession(sessionId, submission, requestId) {
  const response = await fetch(
    buildPayloadUrl('select-update', { sessionId, submission }, { requestId }),
    { cache: 'no-store' }
  );
  return parseJsonResponse(response);
}
