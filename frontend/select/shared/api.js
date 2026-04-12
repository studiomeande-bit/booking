import { CONFIG } from './config.js';

let resolvedApiBaseUrl = '';

function setResolvedApiBaseUrl(url) {
  if (!url) return;
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    resolvedApiBaseUrl = parsed.toString();
  } catch {
    resolvedApiBaseUrl = '';
  }
}

function buildUrl(route, params = {}) {
  const base = new URL(resolvedApiBaseUrl || CONFIG.apiBaseUrl);
  base.searchParams.set('api', route);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    base.searchParams.set(key, value);
  });
  return base.toString();
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
  const response = await fetch(buildUrl('select-session', { id: sessionId }));
  setResolvedApiBaseUrl(response.url);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Invalid API response: ${text.slice(0, 200)}`);
  }
  if (payload.ok) return payload.data;
  if (payload.submitted) return payload;
  throw new Error(payload.error?.message || payload.message || 'API request failed');
}

export async function submitSelect(sessionId, submission, requestId) {
  const response = await fetch(buildUrl('select-submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, data: { sessionId, submission } })
  });
  return parseJsonResponse(response);
}

export async function updateSelect(sessionId, submission, requestId) {
  const response = await fetch(buildUrl('select-update'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, data: { sessionId, submission } })
  });
  return parseJsonResponse(response);
}
