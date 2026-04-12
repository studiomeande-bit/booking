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

export async function fetchInitData() {
  const response = await fetch(buildUrl('init'), { cache: 'no-store' });
  return parseJsonResponse(response);
}

export async function fetchCalendarBatch({ year, month, totalDur, itemGroup }) {
  const response = await fetch(buildUrl('calendar-batch', { year, month, totalDur, itemGroup }), { cache: 'no-store' });
  return parseJsonResponse(response);
}

export async function fetchSlots({ date, totalDur, itemGroup }) {
  const response = await fetch(buildUrl('slots', { date, totalDur, itemGroup }), { cache: 'no-store' });
  return parseJsonResponse(response);
}

export async function fetchQuote(data) {
  const response = await fetch(buildPayloadUrl('quote', data), { cache: 'no-store' });
  return parseJsonResponse(response);
}

export async function fetchReturnEligibility(data) {
  const response = await fetch(buildPayloadUrl('return-check', data), { cache: 'no-store' });
  return parseJsonResponse(response);
}

export async function submitBooking(data, requestId) {
  const response = await fetch(buildPayloadUrl('booking', data, { requestId }), { cache: 'no-store' });
  return parseJsonResponse(response);
}
