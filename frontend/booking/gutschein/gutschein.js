import { fetchGutscheinTicket } from '../../shared/api-booking.js';
import { CONFIG } from '../../shared/config.js';
import { escapeHtml } from '../../shared/utils.js';

const COPY = {
  loading: 'Das mobile Ticket wird vorbereitet.',
  eyebrow: 'Studio mean mobiles Ticket',
  heroTitle: 'Mobiles Gutschein-Ticket',
  heroLead: 'Bitte zeigen Sie im Studio den QR-Code oder den Code vor. Wir prüfen ihn direkt bei Ihrer Buchung.',
  invalidTitle: 'Das Ticket konnte nicht geladen werden.',
  invalidBody: 'Bitte prüfen Sie den Link oder den Gutscheincode erneut.',
  ticketEyebrow: 'Gutschein',
  codeLabel: 'Code',
  validLabel: 'Gültig bis',
  issuedLabel: 'Ausgestellt am',
  guideTitle: 'Einlösung',
  guideCopy: 'Bitte zeigen Sie im Studio den QR-Code oder den Code vor. Unser Team prüft den Gutschein und verrechnet ihn bei der Buchung.',
  guideNotes: [
    /* PDF 약관과 같은 문구를 유지한다 — SPV 분류의 근거(독일 내 제공·개인 전용)가 고객 대면물에
       빠지면 분류 근거가 약해진다. '발행일로부터 3년'은 실제 유효기한(발행연도+3년의 12/31,
       §§195·199 BGB)과 달라서 삭제 — 구체적 날짜는 위 GÜLTIG BIS 로 이미 표시된다. */
    'Gültig für Fotografie-Leistungen von Studio mean, erbracht in Deutschland.',
    'Nur für private Nutzung, nicht für unternehmerische Zwecke.',
    'Keine Barauszahlung, nicht mit anderen Aktionen kombinierbar.',
    'Restguthaben wird bei Teileinlösung als neuer Gutscheincode übertragen.'
  ],
  copyButton: 'Code kopieren',
  copied: 'Code kopiert.',
  fallbackCopy: 'Kopieren ist auf diesem Gerät nicht verfügbar.',
  noName: 'Nicht angegeben',
  noMessage: 'Keine Nachricht hinterlegt.',
  subAmount: 'Studio mean Wertgutschein',
  subProduct(amount) { return `Produktgutschein · Wert ${formatMoney(amount)}`; },
  states: {
    active: { badge: 'Einlösbar', lead: 'Dieses mobile Ticket ist aktuell gültig.' },
    used: { badge: 'Eingelöst', lead: 'Dieses Ticket wurde bereits eingelöst.' },
    expired: { badge: 'Abgelaufen', lead: 'Die Gültigkeit dieses Tickets ist abgelaufen.' },
    inactive: { badge: 'Noch nicht aktiviert', lead: 'Dieses Ticket wurde noch nicht über den Verkauf aktiviert.' },
    cancelled: { badge: 'Storniert', lead: 'Dieses Ticket wurde storniert.' },
    invalid: { badge: 'Nicht verfügbar', lead: 'Der Ticketstatus konnte nicht geprüft werden.' }
  }
};

const state = {
  ticket: null,
  error: ''
};

const els = {};

function formatMoney(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatDate(dateStr) {
  const raw = String(dateStr || '').trim().slice(0, 10);
  if (!raw) return '-';
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) return raw;
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function getQueryCode() {
  const params = new URLSearchParams(globalThis.location.search);
  return String(params.get('code') || '').trim();
}

function maskBlank(value, fallback) {
  return String(value || '').trim() || fallback;
}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  globalThis.clearTimeout(showToast._timer);
  showToast._timer = globalThis.setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 2000);
}

async function copyCode() {
  const code = state.ticket?.code || '';
  if (!code) return;
  try {
    await globalThis.navigator?.clipboard?.writeText(code);
    showToast(COPY.copied);
  } catch {
    showToast(COPY.fallbackCopy);
  }
}

function renderStaticCopy() {
  document.documentElement.lang = 'de';
  els.loadingCopy.textContent = COPY.loading;
  els.heroEyebrow.textContent = COPY.eyebrow;
  els.heroTitle.textContent = COPY.heroTitle;
  els.heroLead.textContent = COPY.heroLead;
  els.errorTitle.textContent = COPY.invalidTitle;
  els.errorBody.textContent = state.error || COPY.invalidBody;
  els.codeLabel.textContent = COPY.codeLabel;
  els.validLabel.textContent = COPY.validLabel;
  els.issuedLabel.textContent = COPY.issuedLabel;
  els.guideTitle.textContent = COPY.guideTitle;
  els.guideCopy.textContent = COPY.guideCopy;
  els.guideNotes.innerHTML = COPY.guideNotes
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join('');
  els.copyCodeBtn.textContent = COPY.copyButton;
  els.contactLabel.textContent = 'Studio mean';
}

function renderTicket() {
  renderStaticCopy();
  els.ticketPanel.classList.toggle('hidden', !state.ticket || !!state.error);
  els.errorPanel.classList.toggle('hidden', !!state.ticket && !state.error);
  if (!state.ticket) return;

  const ticket = state.ticket;
  const stateCopy = COPY.states[ticket.displayState] || COPY.states.invalid;
  els.heroLead.textContent = stateCopy.lead;
  els.ticketEyebrow.textContent = COPY.ticketEyebrow;
  els.ticketValue.textContent = ticket.voucherType === 'product'
    ? maskBlank(ticket.productSnapshot, 'Studio mean Gutschein')
    : formatMoney(ticket.amount);
  els.ticketSubValue.textContent = ticket.voucherType === 'product'
    ? COPY.subProduct(ticket.amount)
    : COPY.subAmount;
  els.stateBadge.textContent = stateCopy.badge;
  els.stateBadge.dataset.state = ticket.displayState;
  els.ticketCode.textContent = ticket.code || '-';
  els.ticketValidUntil.textContent = formatDate(ticket.validUntil);
  els.ticketIssuedAt.textContent = formatDate(ticket.issuedAt);
  els.contactBody.innerHTML = `${escapeHtml(ticket.studio?.address || '')}<br>${escapeHtml(ticket.studio?.phone || '')}<br>${escapeHtml(ticket.studio?.email || '')}`;
  if (ticket.qrDataUri) {
    els.ticketQrImage.src = ticket.qrDataUri;
    els.ticketQrImage.classList.remove('hidden');
  } else {
    els.ticketQrImage.removeAttribute('src');
    els.ticketQrImage.classList.add('hidden');
  }
}

async function loadTicket() {
  const code = getQueryCode();
  state.error = '';
  renderStaticCopy();
  if (!code) {
    state.ticket = null;
    state.error = COPY.invalidBody;
    els.loadingScreen.classList.add('hidden');
    renderTicket();
    return;
  }
  try {
    state.ticket = await fetchGutscheinTicket(code);
  } catch (error) {
    state.ticket = null;
    state.error = error?.message || COPY.invalidBody;
  } finally {
    els.loadingScreen.classList.add('hidden');
    renderTicket();
  }
}

function bindUi() {
  els.loadingCopy = document.querySelector('#loadingCopy');
  els.loadingScreen = document.querySelector('#loadingScreen');
  els.heroEyebrow = document.querySelector('#heroEyebrow');
  els.heroTitle = document.querySelector('#heroTitle');
  els.heroLead = document.querySelector('#heroLead');
  els.errorPanel = document.querySelector('#errorPanel');
  els.errorTitle = document.querySelector('#errorTitle');
  els.errorBody = document.querySelector('#errorBody');
  els.ticketPanel = document.querySelector('#ticketPanel');
  els.ticketEyebrow = document.querySelector('#ticketEyebrow');
  els.ticketValue = document.querySelector('#ticketValue');
  els.ticketSubValue = document.querySelector('#ticketSubValue');
  els.stateBadge = document.querySelector('#stateBadge');
  els.ticketQrImage = document.querySelector('#ticketQrImage');
  els.codeLabel = document.querySelector('#codeLabel');
  els.ticketCode = document.querySelector('#ticketCode');
  els.copyCodeBtn = document.querySelector('#copyCodeBtn');
  els.validLabel = document.querySelector('#validLabel');
  els.issuedLabel = document.querySelector('#issuedLabel');
  els.ticketValidUntil = document.querySelector('#ticketValidUntil');
  els.ticketIssuedAt = document.querySelector('#ticketIssuedAt');
  els.guideTitle = document.querySelector('#guideTitle');
  els.guideCopy = document.querySelector('#guideCopy');
  els.guideNotes = document.querySelector('#guideNotes');
  els.contactLabel = document.querySelector('#contactLabel');
  els.contactBody = document.querySelector('#contactBody');
  els.toast = document.querySelector('#toast');
  els.copyCodeBtn.addEventListener('click', copyCode);
}

/* ===== 스튜디오 전용: QR 스캔 → 그 자리에서 예약에 적용 =====
   고객 페이지에 사장님용 버튼을 얹는 구조라 노출 규칙이 전부다:
   - 자동화 키가 이 브라우저 localStorage 에 있을 때만 패널이 보인다(고객 폰에는 절대 안 뜸).
   - 키 등록은 ?studio=1 로 진입했을 때만 입력폼 노출. 키는 파일·코드에 안 박고 이 기기에만 저장
     (오늘촬영 보드와 같은 모델). 유출 의심 시 어드민에서 키 재발급하면 즉시 무효.
   - 서버 권한은 erp-agent 가 그대로 검증한다 — 이 UI 는 편의 껍데기일 뿐 새 권한이 아니다. */
const STUDIO_KEY = 'sm_studio_key';

function getStudioKey() {
  try { return String(globalThis.localStorage?.getItem(STUDIO_KEY) || '').trim(); } catch { return ''; }
}

async function agentCall(action, extra) {
  const key = getStudioKey();
  const res = await fetch(`${CONFIG.apiBaseUrl}?api=erp-agent&_ts=${Date.now()}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ data: { ...extra, apiKey: key, agentAction: action } })
  });
  const payload = await res.json();
  if (!payload.ok) throw new Error(payload.error?.message || '처리에 실패했습니다.');
  return payload.data || {};
}

const studio = { booking: null, preview: null };

function studioMsg(text, isError) {
  els.studioMsg.textContent = text || '';
  els.studioMsg.classList.toggle('is-error', !!isError);
}

function renderStudioResults(list) {
  els.studioResults.innerHTML = '';
  if (!list.length) { studioMsg('검색 결과가 없습니다. 이름 일부로 다시 검색해 보세요.', true); return; }
  list.forEach((b) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'studio-result';
    btn.innerHTML = `<b>${escapeHtml(b.name || '')}</b> · ${escapeHtml(String(b.dateTime || '').slice(0, 16))}<br>` +
      `<span>${escapeHtml(String(b.product || ''))} · 총 ${formatMoney(b.total)} · 행 ${b.rowIndex}</span>`;
    btn.addEventListener('click', () => pickBooking(b));
    els.studioResults.appendChild(btn);
  });
}

async function studioSearch() {
  const kw = String(els.studioSearchInput.value || '').trim();
  if (kw.length < 2) { studioMsg('고객명을 두 글자 이상 입력해 주세요.', true); return; }
  studioMsg('예약을 찾는 중…');
  els.studioPreview.classList.add('hidden');
  studio.booking = null;
  try {
    const r = await agentCall('booking-search', { query: { keyword: kw, limit: 5 } });
    renderStudioResults((r.bookings || []).filter((b) => !/취소/.test(String(b.status || ''))));
    if ((r.bookings || []).length) studioMsg('적용할 예약을 선택하세요.');
  } catch (e) { studioMsg(e.message, true); }
}

async function pickBooking(b) {
  studio.booking = b;
  studioMsg(`${b.name}님 예약에 적용 금액을 계산 중…`);
  try {
    const r = await agentCall('gutschein-apply-preview', { bookingRowIndex: b.rowIndex, code: state.ticket.code });
    const c = r.calculations || r;
    studio.preview = c;
    els.studioPreviewBody.innerHTML =
      `<b>${escapeHtml(b.name)}</b>님 · ${escapeHtml(String(b.product || ''))}<br>` +
      `차감 <b>${formatMoney(c.discountAmount)}</b> → 총액 ${formatMoney(c.adjustedTotal)}` +
      (Number(c.adjustedDeposit) ? ` · 계약금 ${formatMoney(c.adjustedDeposit)}` : '') +
      ` · 잔금 ${formatMoney(c.remainingBalanceAfterDeposit ?? c.finalBalance)}`;
    els.studioPreview.classList.remove('hidden');
    studioMsg('내용 확인 후 적용을 눌러 주세요.');
  } catch (e) { studioMsg(e.message, true); }
}

async function studioApply() {
  if (!studio.booking) return;
  els.studioApplyBtn.disabled = true;
  studioMsg('적용 중…');
  try {
    const r = await agentCall('gutschein-apply', {
      bookingRowIndex: studio.booking.rowIndex,
      code: state.ticket.code,
      expectName: studio.booking.name
    });
    let done = `✅ 적용 완료 — 차감 ${formatMoney(r.discountAmount)}, 적용 후 총액 ${formatMoney(r.adjustedTotal)}.`;
    if (r.residualCode) done += ` 잔액 ${formatMoney(r.residualAmount)}은 새 코드 ${r.residualCode} 로 이월되었습니다.`;
    studioMsg(done);
    els.studioPreview.classList.add('hidden');
    els.studioResults.innerHTML = '';
    await loadTicket();          // 상태 배지가 '사용됨'으로 바뀐다
    els.studioPanel.classList.remove('hidden');
  } catch (e) {
    studioMsg(e.message, true);
    els.studioApplyBtn.disabled = false;
  }
}

function saveStudioKey() {
  const v = String(els.studioKeyInput.value || '').trim();
  if (v.length < 10) { studioMsg('키가 너무 짧습니다.', true); return; }
  try { globalThis.localStorage.setItem(STUDIO_KEY, v); } catch {}
  els.studioSetup.classList.add('hidden');
  renderStudioPanel();
}

function clearStudioKey() {
  try { globalThis.localStorage.removeItem(STUDIO_KEY); } catch {}
  els.studioPanel.classList.add('hidden');
}

function renderStudioPanel() {
  const params = new URLSearchParams(globalThis.location.search);
  const wantSetup = params.get('studio') === '1';
  const hasKey = !!getStudioKey();
  if (wantSetup && !hasKey) { els.studioSetup.classList.remove('hidden'); return; }
  if (!hasKey) return;                                   // 고객 화면 — 아무것도 안 보임
  if (!state.ticket || state.ticket.displayState !== 'active') return;   // 사용가능일 때만
  els.studioPanel.classList.remove('hidden');
}

function bindStudioUi() {
  els.studioPanel = document.querySelector('#studioPanel');
  els.studioSetup = document.querySelector('#studioSetup');
  els.studioKeyInput = document.querySelector('#studioKeyInput');
  els.studioKeySave = document.querySelector('#studioKeySave');
  els.studioSearchInput = document.querySelector('#studioSearchInput');
  els.studioSearchBtn = document.querySelector('#studioSearchBtn');
  els.studioResults = document.querySelector('#studioResults');
  els.studioPreview = document.querySelector('#studioPreview');
  els.studioPreviewBody = document.querySelector('#studioPreviewBody');
  els.studioApplyBtn = document.querySelector('#studioApplyBtn');
  els.studioMsg = document.querySelector('#studioMsg');
  els.studioKeyClear = document.querySelector('#studioKeyClear');
  if (!els.studioPanel) return;
  els.studioKeySave.addEventListener('click', saveStudioKey);
  els.studioSearchBtn.addEventListener('click', studioSearch);
  els.studioSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') studioSearch(); });
  els.studioApplyBtn.addEventListener('click', studioApply);
  els.studioKeyClear.addEventListener('click', clearStudioKey);
}

bindUi();
bindStudioUi();
renderStaticCopy();
loadTicket().then(renderStudioPanel);
