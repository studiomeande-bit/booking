/* 포트폴리오 협업(TFP) 촬영 예약 — 전용 페이지.
 *
 * 판매 상품이 아니다. 샘플 사진을 만들기 위한 **상호 무페이** 촬영이라 가격·계약금이 없고,
 * 대신 **사용권 동의가 필수**다(양측 포트폴리오 사용). 상품은 서버의 tfp_portfolio 하나로 고정.
 *
 * 예약 흐름만 담는다 — 날짜/시간 선택 → 연락처 → 동의 → 제출. 상품 선택·견적·결제 단계가 없다.
 * 슬롯·달력·제출은 메인 예약과 같은 공개 API 를 쓴다(중복 예약 방지가 서버에서 동일하게 걸린다).
 */
import { fetchCalendarBatch, fetchInitData, fetchSlots, submitBooking } from '../../shared/api-booking.js';
import { createRequestId, escapeHtml, pad2 } from '../../shared/utils.js';

const ITEM_ID = 'tfp_portfolio';
const ITEM_GROUP = 'tfp';
const DEFAULT_DURATION = 60;      // 서버 상품값으로 덮어쓴다
const LANG_KEY = 'studio-mean-lang';
const LANGS = new Set(['ko', 'en', 'de']);

const COPY = {
  ko: {
    eyebrow: '포트폴리오 협업',
    heroTitle: '함께 만들 사진을 찾습니다',
    heroSub: '스튜디오의 새로운 샘플 작업을 위한 협업 촬영입니다. 비용은 서로 받지 않고, 결과물은 양측이 각자의 포트폴리오에 사용합니다.',
    termsTitle: '협업 조건',
    terms: [
      '촬영비 없음 · 모델료 없음 (상호 무페이)',
      '촬영 시간 60분 · Studio mean 스튜디오(오버우어젤)',
      '결과물은 보정본으로 전달드립니다 (장수는 촬영 시 안내)',
      'Studio mean 은 결과물을 웹사이트·인스타그램·포트폴리오에 사용합니다',
      '모델도 본인 포트폴리오·SNS 에 자유롭게 사용할 수 있습니다 (재판매 제외)',
      '원본(RAW)은 제공하지 않습니다'
    ],
    termsNote: '조건에 동의하시는 경우에만 신청해 주세요. 일정 확정은 회신 메일로 안내드립니다.',
    whenTitle: '날짜와 시간',
    whenNote: '일·월요일과 공휴일은 휴무입니다. 원하시는 날짜를 고르면 가능한 시간이 나타납니다.',
    slotTitle: '시간 선택',
    formTitle: '연락처',
    nameLabel: '성함',
    emailLabel: '이메일',
    phoneLabel: '연락처',
    linkLabel: '인스타그램 또는 포트폴리오 링크 (선택)',
    memoLabel: '하고 싶은 촬영이 있다면 알려주세요 (선택)',
    usageConsent: '결과물을 Studio mean 이 포트폴리오·웹사이트·SNS 에 사용하는 데 동의합니다. (필수)',
    gdprConsent: '개인정보 처리방침에 동의합니다. (필수)',
    aiConsent: 'AI 보정 도구 사용에 동의합니다. (선택)',
    submitLabel: '신청하기',
    submitNote: '신청 후 확인 메일이 발송됩니다. 비용은 청구되지 않습니다.',
    successTitle: '신청이 접수되었습니다',
    successNote: '메일함을 확인해 주세요. 일정이 맞지 않으면 회신으로 조정해 드립니다.',
    pickedLine: (d, t) => `선택하신 일정: ${d} ${t}`,
    warnPick: '날짜와 시간을 먼저 선택해 주세요.',
    warnName: '성함을 입력해 주세요.',
    warnEmail: '이메일을 정확히 입력해 주세요.',
    warnPhone: '연락처를 입력해 주세요.',
    warnUsage: '사용권 동의가 필요합니다.',
    warnGdpr: '개인정보 처리방침 동의가 필요합니다.',
    loading: '불러오는 중…',
    noSlots: '이 날짜에는 가능한 시간이 없습니다.',
    submitting: '보내는 중…',
    submitFail: '신청에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    notReady: '지금은 신청을 받을 수 없습니다. 잠시 후 다시 시도해 주세요.',
    weekdays: ['일', '월', '화', '수', '목', '금', '토'],
    monthLabel: (y, m) => `${y}년 ${m}월`
  },
  en: {
    eyebrow: 'Portfolio collaboration',
    heroTitle: 'Looking for people to create with',
    heroSub: 'A collaboration shoot for new studio sample work. Neither side charges the other, and both of us may use the images in our portfolios.',
    termsTitle: 'Terms',
    terms: [
      'No session fee · no model fee (TFP)',
      '60 minutes · at the Studio mean studio in Oberursel',
      'You receive retouched images (count confirmed on the day)',
      'Studio mean uses the images on its website, Instagram and portfolio',
      'You may use them freely for your own portfolio and social media (no resale)',
      'RAW files are not provided'
    ],
    termsNote: 'Please apply only if you agree with these terms. We confirm the date by email.',
    whenTitle: 'Date and time',
    whenNote: 'Closed Sundays, Mondays and public holidays. Pick a date to see available times.',
    slotTitle: 'Choose a time',
    formTitle: 'Contact',
    nameLabel: 'Name',
    emailLabel: 'Email',
    phoneLabel: 'Phone',
    linkLabel: 'Instagram or portfolio link (optional)',
    memoLabel: 'Anything you would like to shoot (optional)',
    usageConsent: 'I agree that Studio mean may use the resulting images on its website, Instagram and portfolio. (required)',
    gdprConsent: 'I agree to the privacy policy. (required)',
    aiConsent: 'I agree to the use of AI retouching tools. (optional)',
    submitLabel: 'Send request',
    submitNote: 'You will receive a confirmation email. Nothing will be charged.',
    successTitle: 'Request received',
    successNote: 'Please check your inbox. If the time does not work, just reply and we will adjust it.',
    pickedLine: (d, t) => `Selected: ${d} ${t}`,
    warnPick: 'Please select a date and time first.',
    warnName: 'Please enter your name.',
    warnEmail: 'Please enter a valid email.',
    warnPhone: 'Please enter a phone number.',
    warnUsage: 'The usage consent is required.',
    warnGdpr: 'The privacy consent is required.',
    loading: 'Loading…',
    noSlots: 'No times available on this date.',
    submitting: 'Sending…',
    submitFail: 'Could not send the request. Please try again shortly.',
    notReady: 'Requests are not being accepted right now. Please try again shortly.',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthLabel: (y, m) => `${['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1]} ${y}`
  },
  de: {
    eyebrow: 'Portfolio-Kollaboration',
    heroTitle: 'Wir suchen Menschen zum gemeinsamen Gestalten',
    heroSub: 'Ein Kollaborations-Shooting für neue Studioarbeiten. Keine Seite berechnet der anderen etwas, und beide dürfen die Bilder im Portfolio verwenden.',
    termsTitle: 'Bedingungen',
    terms: [
      'Kein Shooting-Honorar · kein Modelhonorar (TFP)',
      '60 Minuten · im Studio mean in Oberursel',
      'Sie erhalten bearbeitete Bilder (Anzahl wird am Tag besprochen)',
      'Studio mean verwendet die Bilder auf Website, Instagram und im Portfolio',
      'Sie dürfen sie frei für Ihr Portfolio und Ihre Social Media nutzen (kein Weiterverkauf)',
      'RAW-Dateien werden nicht herausgegeben'
    ],
    termsNote: 'Bitte bewerben Sie sich nur, wenn Sie mit diesen Bedingungen einverstanden sind. Die Terminbestätigung erfolgt per E-Mail.',
    whenTitle: 'Datum und Uhrzeit',
    whenNote: 'Sonntags, montags und an Feiertagen geschlossen. Wählen Sie ein Datum, um freie Zeiten zu sehen.',
    slotTitle: 'Uhrzeit wählen',
    formTitle: 'Kontakt',
    nameLabel: 'Name',
    emailLabel: 'E-Mail',
    phoneLabel: 'Telefon',
    linkLabel: 'Instagram oder Portfolio-Link (optional)',
    memoLabel: 'Wünsche zum Shooting (optional)',
    usageConsent: 'Ich bin damit einverstanden, dass Studio mean die entstandenen Bilder auf Website, Instagram und im Portfolio verwendet. (erforderlich)',
    gdprConsent: 'Ich stimme der Datenschutzerklärung zu. (erforderlich)',
    aiConsent: 'Ich stimme dem Einsatz von KI-Bearbeitungswerkzeugen zu. (optional)',
    submitLabel: 'Anfrage senden',
    submitNote: 'Sie erhalten eine Bestätigungs-E-Mail. Es entstehen keine Kosten.',
    successTitle: 'Anfrage eingegangen',
    successNote: 'Bitte prüfen Sie Ihr Postfach. Passt der Termin nicht, antworten Sie einfach — wir passen ihn an.',
    pickedLine: (d, t) => `Gewählt: ${d} ${t}`,
    warnPick: 'Bitte zuerst Datum und Uhrzeit wählen.',
    warnName: 'Bitte geben Sie Ihren Namen ein.',
    warnEmail: 'Bitte geben Sie eine gültige E-Mail an.',
    warnPhone: 'Bitte geben Sie eine Telefonnummer an.',
    warnUsage: 'Die Einwilligung zur Nutzung ist erforderlich.',
    warnGdpr: 'Die Datenschutz-Einwilligung ist erforderlich.',
    loading: 'Wird geladen…',
    noSlots: 'An diesem Tag sind keine Zeiten frei.',
    submitting: 'Wird gesendet…',
    submitFail: 'Anfrage konnte nicht gesendet werden. Bitte später erneut versuchen.',
    notReady: 'Aktuell können keine Anfragen entgegengenommen werden. Bitte später erneut versuchen.',
    weekdays: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    monthLabel: (y, m) => `${['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'][m - 1]} ${y}`
  }
};

const state = {
  lang: 'ko',
  duration: DEFAULT_DURATION,
  view: null,            // {year, month}
  closedDates: new Set(),
  selectedDate: '',
  selectedSlot: '',
  submitting: false,
  monthLoading: false,
  serverReady: true
};

const els = {};
const copy = () => COPY[state.lang] || COPY.ko;

/* 베를린 기준 오늘 — 맥/폰 시간대가 달라도 달력이 어긋나지 않게 한다(메인 예약과 같은 규칙) */
function berlinToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
}

function readLang() {
  try {
    const url = new URLSearchParams(globalThis.location?.search || '').get('lang');
    if (url && LANGS.has(url)) return url;
    const saved = globalThis.localStorage?.getItem(LANG_KEY);
    return saved && LANGS.has(saved) ? saved : 'ko';
  } catch { return 'ko'; }
}

function persistLang(lang) {
  try { globalThis.localStorage?.setItem(LANG_KEY, lang); } catch { /* private mode */ }
}

function renderCopy() {
  const c = copy();
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-copy]').forEach((el) => {
    const key = el.getAttribute('data-copy');
    const value = c[key];
    if (typeof value === 'string') el.textContent = value;
  });
  els.termsList.innerHTML = c.terms.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  els.weekdayRow.innerHTML = c.weekdays.map((w) => `<span>${escapeHtml(w)}</span>`).join('');
  els.langSwitch.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.lang === state.lang);
  });
  renderPicked();
  renderMonthLabel();
}

function renderMonthLabel() {
  if (!state.view) return;
  els.monthLabel.textContent = copy().monthLabel(state.view.year, state.view.month);
}

function renderPicked() {
  if (state.selectedDate && state.selectedSlot) {
    els.pickedLine.textContent = copy().pickedLine(state.selectedDate, state.selectedSlot);
    els.pickedLine.classList.remove('hidden');
  } else {
    els.pickedLine.textContent = '';
    els.pickedLine.classList.add('hidden');
  }
}

async function loadMonth(year, month) {
  state.view = { year, month };
  state.monthLoading = true;
  renderMonthLabel();
  els.calStatus.textContent = copy().loading;
  els.calGrid.innerHTML = '';
  try {
    /* calendar-batch 의 month 는 JS getMonth() 와 같은 0-based 다(promo.js 와 동일).
       응답은 `${year}_${0based}` 로 한 겹 더 감싸여 있고, 키는 unavail/closed 다. */
    const m0 = month - 1;
    const res = await fetchCalendarBatch({ year, month: m0, totalDur: state.duration, itemGroup: ITEM_GROUP });
    const data = (res && res[`${year}_${m0}`]) || res || {};
    state.closedDates = new Set([...(data.closed || []), ...(data.unavail || [])].map(String));
    els.calStatus.textContent = '';
  } catch {
    state.closedDates = new Set();
    els.calStatus.textContent = '';
  } finally {
    state.monthLoading = false;
    renderCalendar();
  }
}

function renderCalendar() {
  if (!state.view) return;
  const { year, month } = state.view;
  const first = new Date(`${year}-${pad2(month)}-01T12:00:00`);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = berlinToday();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push('<span class="cal-cell empty"></span>');
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = `${year}-${pad2(month)}-${pad2(d)}`;
    const past = iso < today;
    const closed = state.closedDates.has(iso);
    const disabled = past || closed;
    const active = iso === state.selectedDate;
    cells.push(
      `<button type="button" class="cal-cell${disabled ? ' disabled' : ''}${active ? ' active' : ''}"` +
      ` data-date="${iso}"${disabled ? ' disabled' : ''}>${d}</button>`
    );
  }
  els.calGrid.innerHTML = cells.join('');
}

async function pickDate(iso) {
  state.selectedDate = iso;
  state.selectedSlot = '';
  renderCalendar();
  renderPicked();
  els.slotBox.classList.remove('hidden');
  els.slotGrid.innerHTML = '';
  els.slotStatus.textContent = copy().loading;
  try {
    const res = await fetchSlots({ date: iso, totalDur: state.duration, itemGroup: ITEM_GROUP });
    const slots = Array.isArray(res) ? res : (Array.isArray(res?.slots) ? res.slots : []);
    if (!slots.length) {
      els.slotStatus.textContent = copy().noSlots;
      return;
    }
    els.slotStatus.textContent = '';
    els.slotGrid.innerHTML = slots
      .map((s) => {
        const time = typeof s === 'string' ? s : (s.time || s.start || '');
        return time ? `<button type="button" class="slot" data-time="${escapeHtml(time)}">${escapeHtml(time)}</button>` : '';
      })
      .join('');
  } catch {
    els.slotStatus.textContent = copy().noSlots;
  }
}

function pickSlot(time) {
  state.selectedSlot = time;
  els.slotGrid.querySelectorAll('.slot').forEach((b) => b.classList.toggle('active', b.dataset.time === time));
  renderPicked();
  els.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function validate() {
  const c = copy();
  const f = els.form.elements;
  if (!state.selectedDate || !state.selectedSlot) return c.warnPick;
  if (!String(f.name.value || '').trim()) return c.warnName;
  const email = String(f.email.value || '').trim();
  if (!email || email.indexOf('@') < 1) return c.warnEmail;
  if (!String(f.phone.value || '').trim()) return c.warnPhone;
  if (!f.usageConsent.checked) return c.warnUsage;
  if (!f.gdprConsent.checked) return c.warnGdpr;
  return '';
}

function buildPayload() {
  const c = copy();
  const f = els.form.elements;
  const link = String(f.link.value || '').trim();
  const userMemo = String(f.memo.value || '').trim();
  /* 메모에 TFP 토큰을 남긴다 — 장부·보드에서 이 건이 무페이 협업임을 한눈에 알 수 있어야 한다.
     사용권 동의도 같이 박아 둔다(나중에 게시 근거를 되짚을 때 필요). */
  const memo = [
    '[포트폴리오 협업 · TFP] 상호 무페이 · 사용권 동의함',
    link ? `링크: ${link}` : '',
    userMemo ? `요청: ${userMemo}` : ''
  ].filter(Boolean).join('\n');
  const phone = String(f.phone.value || '').trim();
  return {
    itemId: ITEM_ID,
    people: 1,
    date: state.selectedDate,
    time: state.selectedSlot,
    name: String(f.name.value || '').trim(),
    phone,
    phoneCountry: /^\s*0?10[-\s.]?\d/.test(phone) ? '+82' : '+49',
    email: String(f.email.value || '').trim(),
    address: '',
    memo,
    gdprConsent: !!f.gdprConsent.checked,
    privacy_terms_accepted: !!f.gdprConsent.checked,
    contract_terms_accepted: !!f.usageConsent.checked,
    aiConsent: !!f.aiConsent.checked,
    // TFP 는 결과물 게시가 전제다 — 사용권 동의가 곧 마케팅 사용 동의
    marketing: !!f.usageConsent.checked,
    lang: state.lang,
    optionKeys: [],
    surveyKeys: [],
    meta: { tfp: true, link }
  };
}

async function onSubmit(event) {
  event.preventDefault();
  if (state.submitting) return;
  const warn = validate();
  if (warn) {
    els.formWarn.textContent = warn;
    els.formWarn.classList.remove('hidden');
    return;
  }
  els.formWarn.classList.add('hidden');
  state.submitting = true;
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = copy().submitting;
  try {
    await submitBooking(buildPayload(), createRequestId('tfp'));
    els.form.closest('.card').classList.add('hidden');
    els.successCard.classList.remove('hidden');
    els.successBody.textContent = copy().pickedLine(state.selectedDate, state.selectedSlot);
    els.successCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    els.formWarn.textContent = (error && error.message) || copy().submitFail;
    els.formWarn.classList.remove('hidden');
  } finally {
    state.submitting = false;
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = copy().submitLabel;
  }
}

function shiftMonth(delta) {
  if (!state.view || state.monthLoading) return;
  let { year, month } = state.view;
  month += delta;
  if (month < 1) { month = 12; year -= 1; }
  if (month > 12) { month = 1; year += 1; }
  const today = berlinToday();
  const firstOfMonth = `${year}-${pad2(month)}-01`;
  const thisMonth = today.slice(0, 7);
  if (`${year}-${pad2(month)}` < thisMonth) return;   // 지난 달로는 못 간다
  void firstOfMonth;
  loadMonth(year, month);
}

async function boot() {
  els.langSwitch = document.getElementById('langSwitch');
  els.termsList = document.getElementById('termsList');
  els.weekdayRow = document.getElementById('weekdayRow');
  els.calGrid = document.getElementById('calGrid');
  els.calStatus = document.getElementById('calStatus');
  els.monthLabel = document.getElementById('monthLabel');
  els.slotBox = document.getElementById('slotBox');
  els.slotGrid = document.getElementById('slotGrid');
  els.slotStatus = document.getElementById('slotStatus');
  els.form = document.getElementById('bookingForm');
  els.formCard = document.getElementById('formCard');
  els.formWarn = document.getElementById('formWarn');
  els.submitBtn = document.getElementById('submitBtn');
  els.pickedLine = document.getElementById('pickedLine');
  els.successCard = document.getElementById('successCard');
  els.successBody = document.getElementById('successBody');

  state.lang = readLang();
  renderCopy();

  els.langSwitch.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-lang]');
    if (!btn) return;
    state.lang = btn.dataset.lang;
    persistLang(state.lang);
    renderCopy();
    renderCalendar();
  });
  document.getElementById('prevMonth').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => shiftMonth(1));
  els.calGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-date]');
    if (!btn || btn.disabled) return;
    pickDate(btn.dataset.date);
  });
  els.slotGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-time]');
    if (!btn) return;
    pickSlot(btn.dataset.time);
  });
  els.form.addEventListener('submit', onSubmit);

  /* 소요시간은 서버 상품값이 정본. 서버가 이 상품을 아직 모르면(배포 전) 제출이 반드시 실패하므로
     폼을 잠그고 안내를 띄운다 — 링크가 먼저 돌아도 신청자가 오류를 보지 않게. */
  try {
    const init = await fetchInitData();
    const item = (init?.tfpProducts || []).find((p) => p.id === ITEM_ID);
    if (item) {
      state.duration = (Number(item.d) || DEFAULT_DURATION) + (Number(item.prep) || 0);
    } else {
      state.serverReady = false;
    }
  } catch { /* 통신 실패는 일시적일 수 있다 — 잠그지 않는다 */ }

  if (state.serverReady === false) {
    els.formWarn.textContent = copy().notReady;
    els.formWarn.classList.remove('hidden');
    els.submitBtn.disabled = true;
  }

  const today = berlinToday();
  loadMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
}

boot();
