import { fetchGutscheinTicket } from '../../shared/api-booking.js';
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
  recipientLabel: 'Für',
  fromLabel: 'Von',
  messageLabel: 'Nachricht',
  guideTitle: 'Einlösung',
  guideCopy: 'Bitte zeigen Sie im Studio den QR-Code oder den Code vor. Unser Team prüft den Gutschein und verrechnet ihn bei der Buchung.',
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
  els.recipientLabel.textContent = COPY.recipientLabel;
  els.fromLabel.textContent = COPY.fromLabel;
  els.messageLabel.textContent = COPY.messageLabel;
  els.guideTitle.textContent = COPY.guideTitle;
  els.guideCopy.textContent = COPY.guideCopy;
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
  els.ticketRecipient.textContent = maskBlank(ticket.recipientName, COPY.noName);
  els.ticketPurchaser.textContent = maskBlank(ticket.purchaserName, COPY.noName);
  els.ticketMessage.textContent = maskBlank(ticket.message, COPY.noMessage);
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
  els.recipientLabel = document.querySelector('#recipientLabel');
  els.fromLabel = document.querySelector('#fromLabel');
  els.messageLabel = document.querySelector('#messageLabel');
  els.ticketRecipient = document.querySelector('#ticketRecipient');
  els.ticketPurchaser = document.querySelector('#ticketPurchaser');
  els.ticketMessage = document.querySelector('#ticketMessage');
  els.guideTitle = document.querySelector('#guideTitle');
  els.guideCopy = document.querySelector('#guideCopy');
  els.contactLabel = document.querySelector('#contactLabel');
  els.contactBody = document.querySelector('#contactBody');
  els.toast = document.querySelector('#toast');
  els.copyCodeBtn.addEventListener('click', copyCode);
}

bindUi();
renderStaticCopy();
loadTicket();
