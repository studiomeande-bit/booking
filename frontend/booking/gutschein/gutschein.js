import { fetchGutscheinTicket } from '../../shared/api-booking.js';
import { escapeHtml } from '../../shared/utils.js';

const LANG_STORAGE_KEY = 'studio-mean-lang';
const SUPPORTED_LANGS = new Set(['ko', 'en', 'de']);

const COPY = {
  ko: {
    loading: '모바일 티켓을 준비하고 있습니다.',
    eyebrow: 'Studio mean mobile voucher',
    heroTitle: '굿샤인 모바일 티켓',
    heroLead: '현장에서 QR 또는 코드를 보여주시면 확인 후 적용해 드립니다.',
    invalidTitle: '티켓을 불러올 수 없습니다.',
    invalidBody: '링크 또는 코드 정보를 다시 확인해 주세요.',
    ticketEyebrow: 'Gift Voucher',
    codeLabel: '코드',
    validLabel: '유효기한',
    issuedLabel: '발행일',
    recipientLabel: '받는 분',
    fromLabel: '보내는 분',
    messageLabel: '메시지',
    guideTitle: '사용 안내',
    guideCopy: '현장에서 모바일 티켓의 QR 또는 코드를 보여주시면 예약 장부에서 확인 후 적용해 드립니다.',
    copyButton: '코드 복사',
    copied: '코드를 복사했습니다.',
    fallbackCopy: '복사 기능을 사용할 수 없습니다.',
    noName: '미입력',
    noMessage: '메시지가 없습니다.',
    subAmount: 'Studio mean 금액권',
    subProduct(amount) { return `상품권 · €${formatMoney(amount, 'ko')}`; },
    states: {
      active: { badge: '사용 가능', lead: '현재 사용 가능한 모바일 티켓입니다.' },
      used: { badge: '사용 완료', lead: '이미 사용 처리된 티켓입니다.' },
      expired: { badge: '만료', lead: '유효기한이 지나 사용이 불가합니다.' },
      inactive: { badge: '판매 대기', lead: '아직 구매자 등록이 완료되지 않은 티켓입니다.' },
      cancelled: { badge: '취소', lead: '취소된 티켓입니다.' },
      invalid: { badge: '확인 불가', lead: '티켓 상태를 확인할 수 없습니다.' }
    }
  },
  en: {
    loading: 'Preparing your mobile ticket.',
    eyebrow: 'Studio mean mobile voucher',
    heroTitle: 'Mobile voucher ticket',
    heroLead: 'Show this QR or code at the studio and we will verify it for your booking.',
    invalidTitle: 'Unable to load the ticket.',
    invalidBody: 'Please check the link or voucher code again.',
    ticketEyebrow: 'Gift Voucher',
    codeLabel: 'Code',
    validLabel: 'Valid until',
    issuedLabel: 'Issued on',
    recipientLabel: 'For',
    fromLabel: 'From',
    messageLabel: 'Message',
    guideTitle: 'How to use',
    guideCopy: 'Please show the QR or code at the studio. Our team will verify and apply it in the booking ledger.',
    copyButton: 'Copy code',
    copied: 'Code copied.',
    fallbackCopy: 'Copy is not available on this device.',
    noName: 'Not provided',
    noMessage: 'No message added.',
    subAmount: 'Studio mean value voucher',
    subProduct(amount) { return `Service voucher · ${formatMoney(amount, 'en')}`; },
    states: {
      active: { badge: 'Ready to use', lead: 'This mobile ticket is currently valid.' },
      used: { badge: 'Redeemed', lead: 'This ticket has already been redeemed.' },
      expired: { badge: 'Expired', lead: 'The validity period has ended.' },
      inactive: { badge: 'Inactive', lead: 'This ticket has not been activated by sale registration yet.' },
      cancelled: { badge: 'Cancelled', lead: 'This ticket has been cancelled.' },
      invalid: { badge: 'Unavailable', lead: 'The ticket status could not be verified.' }
    }
  },
  de: {
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
    subProduct(amount) { return `Produktgutschein · ${formatMoney(amount, 'de')}`; },
    states: {
      active: { badge: 'Einlösbar', lead: 'Dieses mobile Ticket ist aktuell gültig.' },
      used: { badge: 'Eingelöst', lead: 'Dieses Ticket wurde bereits eingelöst.' },
      expired: { badge: 'Abgelaufen', lead: 'Die Gültigkeit dieses Tickets ist abgelaufen.' },
      inactive: { badge: 'Noch nicht aktiviert', lead: 'Dieses Ticket wurde noch nicht über den Verkauf aktiviert.' },
      cancelled: { badge: 'Storniert', lead: 'Dieses Ticket wurde storniert.' },
      invalid: { badge: 'Nicht verfügbar', lead: 'Der Ticketstatus konnte nicht geprüft werden.' }
    }
  }
};

const state = {
  lang: readStoredLang(),
  ticket: null,
  loading: true,
  error: ''
};

const els = {};

function readStoredLang() {
  try {
    const saved = globalThis.localStorage?.getItem(LANG_STORAGE_KEY) || 'ko';
    return SUPPORTED_LANGS.has(saved) ? saved : 'ko';
  } catch {
    return 'ko';
  }
}

function persistLang(lang) {
  try {
    globalThis.localStorage?.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore storage write failures.
  }
}

function formatMoney(value, lang) {
  const locale = lang === 'de' ? 'de-DE' : (lang === 'en' ? 'en-US' : 'ko-KR');
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(dateStr, lang) {
  const raw = String(dateStr || '').trim().slice(0, 10);
  if (!raw) return '-';
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) return raw;
  const date = new Date(year, month - 1, day);
  const locale = lang === 'de' ? 'de-DE' : (lang === 'en' ? 'en-US' : 'ko-KR');
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function getQueryCode() {
  const params = new URLSearchParams(globalThis.location.search);
  return String(params.get('code') || '').trim();
}

function resolveCopy() {
  return COPY[state.lang] || COPY.ko;
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
  const copy = resolveCopy();
  const code = state.ticket?.code || '';
  if (!code) return;
  try {
    await globalThis.navigator?.clipboard?.writeText(code);
    showToast(copy.copied);
  } catch {
    showToast(copy.fallbackCopy);
  }
}

function renderStaticCopy() {
  const copy = resolveCopy();
  document.documentElement.lang = state.lang;
  els.loadingCopy.textContent = copy.loading;
  els.heroEyebrow.textContent = copy.eyebrow;
  els.heroTitle.textContent = copy.heroTitle;
  els.heroLead.textContent = copy.heroLead;
  els.errorTitle.textContent = copy.invalidTitle;
  els.errorBody.textContent = state.error || copy.invalidBody;
  els.codeLabel.textContent = copy.codeLabel;
  els.validLabel.textContent = copy.validLabel;
  els.issuedLabel.textContent = copy.issuedLabel;
  els.recipientLabel.textContent = copy.recipientLabel;
  els.fromLabel.textContent = copy.fromLabel;
  els.messageLabel.textContent = copy.messageLabel;
  els.guideTitle.textContent = copy.guideTitle;
  els.copyCodeBtn.textContent = copy.copyButton;
  els.contactLabel.textContent = 'Studio mean';
  document.querySelectorAll('.lang-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === state.lang);
  });
}

function renderTicket() {
  const copy = resolveCopy();
  renderStaticCopy();
  els.ticketPanel.classList.toggle('hidden', !state.ticket || !!state.error);
  els.errorPanel.classList.toggle('hidden', !!state.ticket && !state.error);
  if (!state.ticket) return;

  const ticket = state.ticket;
  const stateCopy = copy.states[ticket.displayState] || copy.states.invalid;
  els.heroLead.textContent = stateCopy.lead;
  els.ticketEyebrow.textContent = copy.ticketEyebrow;
  els.ticketValue.textContent = ticket.voucherType === 'product'
    ? maskBlank(ticket.productSnapshot, 'Studio mean Gutschein')
    : formatMoney(ticket.amount, state.lang);
  els.ticketSubValue.textContent = ticket.voucherType === 'product'
    ? copy.subProduct(ticket.amount)
    : copy.subAmount;
  els.stateBadge.textContent = stateCopy.badge;
  els.stateBadge.dataset.state = ticket.displayState;
  els.ticketCode.textContent = ticket.code || '-';
  els.ticketValidUntil.textContent = formatDate(ticket.validUntil, state.lang);
  els.ticketIssuedAt.textContent = formatDate(ticket.issuedAt, state.lang);
  els.ticketRecipient.textContent = maskBlank(ticket.recipientName, copy.noName);
  els.ticketPurchaser.textContent = maskBlank(ticket.purchaserName, copy.noName);
  els.ticketMessage.textContent = maskBlank(ticket.message, copy.noMessage);
  els.guideCopy.textContent = copy.guideCopy;
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
  state.loading = true;
  state.error = '';
  renderStaticCopy();
  if (!code) {
    state.ticket = null;
    state.error = resolveCopy().invalidBody;
    state.loading = false;
    els.loadingScreen.classList.add('hidden');
    renderTicket();
    return;
  }
  try {
    const ticket = await fetchGutscheinTicket(code);
    state.ticket = ticket;
    if (!globalThis.localStorage?.getItem(LANG_STORAGE_KEY) && SUPPORTED_LANGS.has(ticket.lang)) {
      state.lang = ticket.lang;
    }
  } catch (error) {
    state.ticket = null;
    state.error = error?.message || resolveCopy().invalidBody;
  } finally {
    state.loading = false;
    els.loadingScreen.classList.add('hidden');
    renderTicket();
  }
}

function bindLanguageButtons() {
  document.querySelectorAll('.lang-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const lang = button.dataset.lang;
      if (!SUPPORTED_LANGS.has(lang)) return;
      state.lang = lang;
      persistLang(lang);
      renderTicket();
    });
  });
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
  bindLanguageButtons();
}

bindUi();
renderStaticCopy();
loadTicket();
