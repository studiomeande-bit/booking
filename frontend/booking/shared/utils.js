export function createRequestId(prefix = 'req') {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function formatMonthLabel(year, monthIndex) {
  return `${year}년 ${monthIndex + 1}월`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
