import { buildPayloadUrl, buildUrl, parseJsonResponse } from './api-core.js';

async function requestJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  return parseJsonResponse(response);
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
