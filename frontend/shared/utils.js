export function createRequestId(prefix = 'req') {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function formatMonthLabel(year, monthIndex, lang = 'ko') {
  if (lang === 'en') {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' })
      .format(new Date(year, monthIndex, 1));
  }
  if (lang === 'de') {
    return new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: 'long' })
      .format(new Date(year, monthIndex, 1));
  }
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
