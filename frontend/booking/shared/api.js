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

export async function fetchInitData() {
  const response = await fetch(buildUrl('init'));
  setResolvedApiBaseUrl(response.url);
  return parseJsonResponse(response);
}

export async function fetchCalendarBatch({ year, month, totalDur, itemGroup }) {
  const response = await fetch(buildUrl('calendar-batch', { year, month, totalDur, itemGroup }));
  setResolvedApiBaseUrl(response.url);
  return parseJsonResponse(response);
}

export async function fetchQuote(data) {
  const response = await fetch(buildUrl('quote'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  return parseJsonResponse(response);
}

export async function fetchReturnEligibility(data) {
  const response = await fetch(buildUrl('return-check'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  return parseJsonResponse(response);
}

export async function submitBooking(data, requestId) {
  const response = await fetch(buildUrl('booking'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, data })
  });
  return parseJsonResponse(response);
}
