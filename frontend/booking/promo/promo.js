import { fetchCalendarBatch, fetchInitData, fetchQuote, fetchSlots, submitBooking } from '../../shared/api-booking.js';
import { createRequestId, escapeHtml, formatMonthLabel, pad2 } from '../../shared/utils.js';

const LANG_STORAGE_KEY = 'studio-mean-lang';
const SUPPORTED_LANGS = new Set(['ko', 'en', 'de']);

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
    // Ignore storage errors and keep runtime language in memory.
  }
}

const PROMO_END_LIMIT = '2026-12-31';
const QUOTE_REFRESH_DEBOUNCE_MS = 180;

const COPY = {
  ko: {
    loading: '프로모션 예약 페이지를 준비하고 있습니다.',
    statusLoading: '프로모션 정보를 불러오는 중입니다.',
    statusReady: '프로모션 예약이 가능합니다.',
    statusClosed: '현재 프로모션 예약이 비활성화되어 있습니다.',
    closedTitle: '프로모션 예약이 현재 비활성화되어 있습니다.',
    closedBody: '운영 공지 후 다시 열릴 예정입니다.',
    eyebrow: '2026 Family Month Promotion',
    heroTitle: '가정의 달 이벤트 예약',
    heroLead: '아이와 가족의 지금을 오래 남는 사진으로 기록해 보세요.',
    periodLabel: '진행 기간',
    limitLabel: '모집 안내',
    limitValue: '각 이벤트 선착순 5팀',
    step1Title: '1. 이벤트 선택',
    step1Lead: '예약할 이벤트를 선택해 주세요.',
    step2Title: '2. 촬영 구성',
    step2Lead: '인원만 선택해 주세요.',
    step3Title: '3. 날짜 및 시간 선택',
    step4Title: '4. 예약 정보',
    step4Lead: '예약자 정보를 입력하고 신청을 완료해 주세요.',
    peopleLabel: '인원수',
    childAgeLabel: '아이 나이 (만 3세-13세)',
    familyInfoLabel: '가족 구성',
    nameLabel: '이름',
    phoneLabel: '연락처',
    emailLabel: '이메일',
    addressLabel: '주소 (인보이스용, 선택)',
    memoLabel: '요청사항',
    consentTitle: '이용 동의',
    consentLead: '개인정보 수집 및 이용 동의가 필요합니다.',
    gdprLabel: '[필수] 개인정보 수집 및 이용에 동의합니다.',
    gdprSub: '서비스 예약 확인 및 촬영물 전달을 위한 최소한의 정보 처리에 동의합니다.',
    aiLabel: '[필수] AI 보정 및 처리 안내에 동의합니다.',
    aiSub: '촬영본 보정과 결과물 제작 과정에서 AI 기반 도구가 보조적으로 활용될 수 있음을 안내합니다.',
    marketingLabel: '[선택] Studio mean 포트폴리오 및 SNS 활용에 동의합니다.',
    marketingSub: '촬영 결과물을 Studio mean의 웹사이트 및 SNS 홍보 용도로 활용하는 것에 동의합니다.',
    next: '다음',
    back: '이전',
    submit: '예약 신청',
    submitBusy: '제출 중...',
    restart: '새 예약 시작',
    periodValue(start, end) { return `${start.replaceAll('-', '.')} - ${end.replaceAll('-', '.')}`; },
    packageSummary: '포함 구성',
    dateHint: '예약 가능한 날짜와 시간을 선택해 주세요.',
    loadingCalendar: '달력을 불러오는 중입니다.',
    loadingSlots: '시간 정보를 불러오는 중입니다.',
    slotTitle: '예약 가능 시간',
    slotEmpty: '날짜를 선택하면 예약 가능한 시간이 표시됩니다.',
    slotNone: '예약 가능한 시간이 없습니다.',
    step1Warning: '이벤트를 선택해 주세요.',
    childAgeRequired: '아이 나이를 입력해 주세요.',
    familyInfoRequired: '가족 구성을 입력해 주세요.',
    step3WarningDate: '날짜를 먼저 선택해 주세요.',
    step3WarningTime: '시간을 먼저 선택해 주세요.',
    formRequired: '이름, 연락처, 이메일과 필수 동의를 확인해 주세요.',
    invalidEmail: '이메일 형식을 확인해 주세요.',
    successTitle: '예약 신청이 접수되었습니다.',
    successLead: '확인 메일을 보내드렸습니다. 순차적으로 안내드릴게요.',
    successGuide: '프로모션 기간과 선착순 마감 여부를 확인한 뒤 개별 안내드립니다.',
    bookingTime: '예약 일시',
    packageName: '상품',
    price: '예상 금액',
    customerName: '이름',
    customerEmail: '이메일',
    calendarHintProduct(name) { return `${name} · 예약 가능한 날짜와 시간을 선택해 주세요.`; },
    childAgePlaceholder: '예: 만 4세',
    familyInfoPlaceholder: '예: 부모 + 아이 2명',
    memoPlaceholder: '전달할 요청사항이 있다면 적어 주세요.',
    addressPlaceholder: '인보이스가 필요한 경우만 입력해 주세요',
    groups: {
      promo_kids_2026: {
        badge: 'Kids Profile Event',
        title: '키즈 프로필 이벤트',
        desc: ['30분 촬영', '보정본 2장', '배경 1컬러 / 의상 1벌', '프리미엄 인화 10x15cm 인원수만큼', '양면 포토카드 추가 증정'],
        note: '키즈 프로필 이벤트는 만 3세부터 만 13세까지 예약 가능합니다.'
      },
      promo_family_2026: {
        badge: 'Family Photo Event',
        title: '가족사진 이벤트',
        desc: ['30분 촬영', '보정본 3장', '배경 1컬러 / 의상 1벌', '프리미엄 인화 A4 1장 + 10x15cm 2장', '양면 포토카드 2장 포함'],
        note: '5인 이상은 1인 추가당 +20€가 적용되며, 인원 추가 시 10x15cm 인화 1장이 함께 추가됩니다.'
      }
    }
  },
  en: {
    loading: 'Preparing the promotion booking page.',
    statusLoading: 'Loading promotion information.',
    statusReady: 'Promotion booking is available.',
    statusClosed: 'Promotion booking is currently disabled.',
    closedTitle: 'Promotion booking is currently disabled.',
    closedBody: 'It will reopen after the next studio notice.',
    eyebrow: '2026 Family Month Promotion',
    heroTitle: 'Family Month Promotion Booking',
    heroLead: 'Capture your child and family as they are now with images that stay with you.',
    periodLabel: 'Promotion Period',
    limitLabel: 'Availability',
    limitValue: 'Limited to 5 teams per event',
    step1Title: '1. Choose your event',
    step1Lead: 'Select the event you want to book.',
    step2Title: '2. Session details',
    step2Lead: 'Choose the number of people.',
    step3Title: '3. Select date and time',
    step4Title: '4. Booking details',
    step4Lead: 'Enter your contact details and submit the request.',
    peopleLabel: 'Number of people',
    childAgeLabel: 'Child age (3-13 years)',
    familyInfoLabel: 'Family members',
    nameLabel: 'Name',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    addressLabel: 'Address (optional, for invoice)',
    memoLabel: 'Notes',
    consentTitle: 'Consent',
    consentLead: 'Personal data consent is required.',
    gdprLabel: '[Required] I agree to the collection and use of personal data.',
    gdprSub: 'I agree to the minimum data processing needed to confirm the booking and deliver the final images.',
    aiLabel: '[Required] I agree to the AI retouching and processing notice.',
    aiSub: 'AI-based tools may be used as supportive tools during retouching and production of the final images.',
    marketingLabel: '[Optional] I agree to the use of the photos for Studio mean portfolio and social channels.',
    marketingSub: 'I agree that the final images may be used on Studio mean website and social media for promotion.',
    next: 'Next',
    back: 'Back',
    submit: 'Submit booking',
    submitBusy: 'Submitting...',
    restart: 'Start another booking',
    periodValue(start, end) { return `${start} - ${end}`; },
    packageSummary: 'What is included',
    dateHint: 'Choose an available date and time.',
    loadingCalendar: 'Loading calendar...',
    loadingSlots: 'Loading available times...',
    slotTitle: 'Available times',
    slotEmpty: 'Select a date to view available times.',
    slotNone: 'No available time for this date.',
    step1Warning: 'Please choose an event first.',
    childAgeRequired: 'Please enter the child age.',
    familyInfoRequired: 'Please enter the family members.',
    step3WarningDate: 'Please choose a date first.',
    step3WarningTime: 'Please choose a time first.',
    formRequired: 'Please complete name, phone, email and required consent.',
    invalidEmail: 'Please check the email format.',
    successTitle: 'Your booking request has been received.',
    successLead: 'We have sent a confirmation email and will follow up shortly.',
    successGuide: 'We will confirm availability within the promotion period and the first-come-first-served limit.',
    bookingTime: 'Booking time',
    packageName: 'Package',
    price: 'Estimated price',
    customerName: 'Name',
    customerEmail: 'Email',
    calendarHintProduct(name) { return `${name} · Choose an available date and time.`; },
    childAgePlaceholder: 'e.g. 4 years old',
    familyInfoPlaceholder: 'e.g. parents + 2 children',
    memoPlaceholder: 'Share any requests or notes for the shoot.',
    addressPlaceholder: 'Enter only if you need an invoice',
    groups: {
      promo_kids_2026: {
        badge: 'Kids Profile Event',
        title: 'Kids Profile Event',
        desc: ['30 min session', '2 retouched photos', '1 background / 1 outfit', 'Premium 10x15cm print per person', 'Extra double-sided photocard included'],
        note: 'The kids profile event is available for children aged 3 to 13.'
      },
      promo_family_2026: {
        badge: 'Family Photo Event',
        title: 'Family Photo Event',
        desc: ['30 min session', '3 retouched photos', '1 background / 1 outfit', 'Premium A4 print + 2x 10x15cm prints', '2 double-sided photocards included'],
        note: 'For 5 or more people, +20€ applies per added person and one extra 10x15cm print is included.'
      }
    }
  },
  de: {
    loading: 'Die Aktionsbuchung wird vorbereitet.',
    statusLoading: 'Aktionsdaten werden geladen.',
    statusReady: 'Aktionsbuchung ist verfügbar.',
    statusClosed: 'Die Aktionsbuchung ist derzeit deaktiviert.',
    closedTitle: 'Die Aktionsbuchung ist derzeit deaktiviert.',
    closedBody: 'Sie wird nach der nächsten Studio-Mitteilung wieder geöffnet.',
    eyebrow: '2026 Familienmonat Aktion',
    heroTitle: 'Familienmonat Aktionsbuchung',
    heroLead: 'Halten Sie den jetzigen Moment Ihres Kindes und Ihrer Familie mit Bildern fest, die bleiben.',
    periodLabel: 'Aktionszeitraum',
    limitLabel: 'Verfügbarkeit',
    limitValue: 'Jeweils 5 Teams pro Event',
    step1Title: '1. Event wählen',
    step1Lead: 'Wählen Sie das gewünschte Event aus.',
    step2Title: '2. Shooting-Konfiguration',
    step2Lead: 'Wählen Sie nur die Personenzahl aus.',
    step3Title: '3. Datum und Uhrzeit wählen',
    step4Title: '4. Buchungsdaten',
    step4Lead: 'Bitte Kontaktdaten eingeben und die Anfrage absenden.',
    peopleLabel: 'Personenzahl',
    childAgeLabel: 'Alter des Kindes (3-13 Jahre)',
    familyInfoLabel: 'Familienkonstellation',
    nameLabel: 'Name',
    phoneLabel: 'Telefon',
    emailLabel: 'E-Mail',
    addressLabel: 'Adresse (optional, für Rechnung)',
    memoLabel: 'Hinweise',
    consentTitle: 'Einwilligung',
    consentLead: 'Die Einwilligung zur Datenverarbeitung ist erforderlich.',
    gdprLabel: '[Pflicht] Ich stimme der Erhebung und Nutzung personenbezogener Daten zu.',
    gdprSub: 'Ich stimme der minimalen Datenverarbeitung zu, die für Buchungsbestätigung und Bildübergabe erforderlich ist.',
    aiLabel: '[Pflicht] Ich stimme dem Hinweis zur KI-gestützten Retusche und Verarbeitung zu.',
    aiSub: 'KI-basierte Tools können unterstützend bei Retusche und Erstellung der Ergebnisse eingesetzt werden.',
    marketingLabel: '[Optional] Ich stimme der Nutzung der Fotos für Portfolio und soziale Medien von Studio mean zu.',
    marketingSub: 'Ich bin einverstanden, dass die Ergebnisse zu Werbezwecken auf der Website und in sozialen Medien von Studio mean genutzt werden dürfen.',
    next: 'Weiter',
    back: 'Zurück',
    submit: 'Buchung senden',
    submitBusy: 'Wird gesendet...',
    restart: 'Neue Buchung starten',
    periodValue(start, end) { return `${start.split('-').reverse().join('.')} - ${end.split('-').reverse().join('.')}`; },
    packageSummary: 'Leistungsumfang',
    dateHint: 'Wählen Sie ein verfügbares Datum und eine Uhrzeit.',
    loadingCalendar: 'Kalender wird geladen...',
    loadingSlots: 'Verfügbare Zeiten werden geladen...',
    slotTitle: 'Verfügbare Zeiten',
    slotEmpty: 'Bitte wählen Sie ein Datum, um verfügbare Zeiten zu sehen.',
    slotNone: 'Für dieses Datum ist keine Uhrzeit verfügbar.',
    step1Warning: 'Bitte wählen Sie zuerst ein Event.',
    childAgeRequired: 'Bitte geben Sie das Alter des Kindes ein.',
    familyInfoRequired: 'Bitte geben Sie die Familienkonstellation ein.',
    step3WarningDate: 'Bitte wählen Sie zuerst ein Datum.',
    step3WarningTime: 'Bitte wählen Sie zuerst eine Uhrzeit.',
    formRequired: 'Bitte Name, Telefon, E-Mail und die Pflicht-Einwilligung ausfüllen.',
    invalidEmail: 'Bitte prüfen Sie das E-Mail-Format.',
    successTitle: 'Ihre Buchungsanfrage wurde empfangen.',
    successLead: 'Wir haben eine Bestätigungsmail gesendet und melden uns zeitnah.',
    successGuide: 'Wir prüfen die Verfügbarkeit innerhalb des Aktionszeitraums und der begrenzten Plätze.',
    bookingTime: 'Buchungszeit',
    packageName: 'Paket',
    price: 'Voraussichtlicher Preis',
    customerName: 'Name',
    customerEmail: 'E-Mail',
    calendarHintProduct(name) { return `${name} · Wählen Sie ein verfügbares Datum und eine Uhrzeit.`; },
    childAgePlaceholder: 'z. B. 4 Jahre',
    familyInfoPlaceholder: 'z. B. Eltern + 2 Kinder',
    memoPlaceholder: 'Notieren Sie Wünsche oder Hinweise zum Shooting.',
    addressPlaceholder: 'Nur eingeben, wenn eine Rechnung benötigt wird',
    groups: {
      promo_kids_2026: {
        badge: 'Kids Profile Event',
        title: 'Kinderprofil Aktion',
        desc: ['30 Min. Shooting', '2 bearbeitete Bilder', '1 Hintergrund / 1 Outfit', 'Premiumabzug 10x15cm pro Person', 'Zusätzliche doppelseitige Fotokarte inklusive'],
        note: 'Die Kinderprofil-Aktion ist für Kinder von 3 bis 13 Jahren verfügbar.'
      },
      promo_family_2026: {
        badge: 'Family Photo Event',
        title: 'Familienfoto Aktion',
        desc: ['30 Min. Shooting', '3 bearbeitete Bilder', '1 Hintergrund / 1 Outfit', 'Premiumabzug A4 + 2x 10x15cm', '2 doppelseitige Fotokarten inklusive'],
        note: 'Ab 5 Personen werden pro zusätzlicher Person +20€ berechnet, plus ein weiterer 10x15cm Abzug.'
      }
    }
  }
};

const state = {
  lang: readStoredLang(),
  promoEnabled: false,
  promoStart: '2026-04-20',
  promoEnd: '2026-05-10',
  promoContent: {},
  products: [],
  selectedProduct: null,
  people: 1,
  customPeople: '',
  childAge: '',
  familyInfo: '',
  selectedDate: '',
  selectedSlot: '',
  quote: null,
  quoteToken: 0,
  quoteRefreshTimer: null,
  quoteCache: new Map(),
  currentMonth: null,
  monthCache: {},
  slotCache: new Map(),
  slotRequestToken: 0,
  calendarLoading: false,
  slotsLoading: false,
  submitting: false
};

const els = {
  loadingScreen: document.getElementById('loadingScreen'),
  loadingCopy: document.getElementById('loadingCopy'),
  statusBanner: document.getElementById('statusBanner'),
  promoClosed: document.getElementById('promoClosed'),
  promoContent: document.getElementById('promoContent'),
  langBtns: Array.from(document.querySelectorAll('.lang-btn')),
  productGrid: document.getElementById('productGrid'),
  detailCard: document.getElementById('detailCard'),
  peopleSelect: document.getElementById('peopleSelect'),
  peopleCustom: document.getElementById('peopleCustom'),
  childAgeField: document.getElementById('childAgeField'),
  childAgeInput: document.getElementById('childAgeInput'),
  familyInfoField: document.getElementById('familyInfoField'),
  familyInfoInput: document.getElementById('familyInfoInput'),
  priceCard: document.getElementById('priceCard'),
  calendarHint: document.getElementById('calendarHint'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn'),
  monthLabel: document.getElementById('monthLabel'),
  calendarWeekdays: document.getElementById('calendarWeekdays'),
  calendarGrid: document.getElementById('calendarGrid'),
  slotGrid: document.getElementById('slotGrid'),
  slotTitle: document.getElementById('slotTitle'),
  slotHint: document.getElementById('slotHint'),
  reviewBox: document.getElementById('reviewBox'),
  form: document.getElementById('bookingForm'),
  successPanel: document.getElementById('successPanel'),
  successGrid: document.getElementById('successGrid'),
  successGuide: document.getElementById('successGuide'),
  restartBtn: document.getElementById('restartBtn'),
  step1: document.getElementById('step1'),
  step2: document.getElementById('step2'),
  step3: document.getElementById('step3'),
  step4: document.getElementById('step4'),
  step1Next: document.getElementById('step1Next'),
  step2Back: document.getElementById('step2Back'),
  step2Next: document.getElementById('step2Next'),
  step3Back: document.getElementById('step3Back'),
  step3Next: document.getElementById('step3Next'),
  step4Back: document.getElementById('step4Back'),
  submitBtn: document.getElementById('submitBtn'),
  step1Warning: document.getElementById('step1Warning'),
  step2Warning: document.getElementById('step2Warning'),
  step3Warning: document.getElementById('step3Warning'),
  step4Warning: document.getElementById('step4Warning')
};

let activeStep = 1;

function copy() {
  const base = COPY[state.lang] || COPY.ko;
  const override = state.promoContent?.[state.lang];
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base;
  const groups = { ...base.groups };
  Object.entries(override.groups || {}).forEach(([groupId, groupValue]) => {
    if (!groups[groupId] || !groupValue || typeof groupValue !== 'object' || Array.isArray(groupValue)) return;
    const nextGroup = { ...groups[groupId], ...groupValue };
    if (Array.isArray(groupValue.desc)) nextGroup.desc = groupValue.desc.map((item) => String(item)).filter(Boolean);
    groups[groupId] = nextGroup;
  });
  return { ...base, ...override, groups };
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateParts(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, monthIndex: month - 1, day };
}

function setStatus(message, type = 'ready') {
  els.statusBanner.textContent = message;
  els.statusBanner.className = `status-banner ${type}`;
}

function setStepWarning(step, message = '') {
  els[`step${step}Warning`].textContent = message;
}

function showStep(step) {
  activeStep = step;
  els.step1.classList.toggle('hidden', step !== 1);
  els.step2.classList.toggle('hidden', step !== 2);
  els.step3.classList.toggle('hidden', step !== 3);
  els.step4.classList.toggle('hidden', step !== 4);
  window.scrollTo({ top: 0 });
}

function setProductDefaults() {
  if (!state.selectedProduct) return;
  if (state.selectedProduct.id === 'promo_kids_2026') {
    state.people = 1;
  } else {
    state.people = 2;
  }
  state.customPeople = '';
  state.childAge = '';
  state.familyInfo = '';
  state.selectedDate = '';
  state.selectedSlot = '';
}

function getPeopleValue() {
  if (String(state.people) === 'custom') {
    return Math.max(6, Number(state.customPeople || 0) || 0);
  }
  return Number(state.people || 0) || 0;
}

function buildQuotePayload() {
  if (!state.selectedProduct) return null;
  return {
    itemId: state.selectedProduct.id,
    people: getPeopleValue() || undefined,
    surveyKeys: [],
    optionKeys: []
  };
}

function setLang(lang) {
  if (!SUPPORTED_LANGS.has(lang)) return;
  state.lang = lang;
  persistLang(lang);
  renderStaticCopy();
  renderProducts();
  renderDetailCard();
  renderPeopleOptions();
  renderPriceCard();
  updateReview();
  if (state.currentMonth) {
    renderCalendar(state.monthCache[monthKey(state.currentMonth.year, state.currentMonth.monthIndex)]);
  }
  updateStepButtons();
}

function getPromoPreviewQuote() {
  if (!state.selectedProduct) return null;
  const people = getPeopleValue();
  if (!people) return null;
  let totalPrice = null;
  if (state.selectedProduct.id === 'promo_kids_2026') {
    totalPrice = people === 1 ? 69 : people === 2 ? 89 : 109;
  } else if (state.selectedProduct.id === 'promo_family_2026') {
    if (people <= 2) totalPrice = 129;
    else if (people === 3) totalPrice = 149;
    else if (people === 4) totalPrice = 169;
    else totalPrice = 169 + ((people - 4) * 20);
  }
  if (totalPrice === null) return null;
  const duration = Number(state.selectedProduct?.d || 0);
  const prep = Number(state.selectedProduct?.prep || 0);
  return {
    itemId: state.selectedProduct.id,
    people,
    totalPrice,
    duration,
    prep,
    totalDuration: duration + prep
  };
}

function getCalendarDuration() {
  if (state.quote?.totalDuration !== undefined) return Number(state.quote.totalDuration) || 0;
  const shootDuration = Number(state.selectedProduct?.d || 0);
  const prepDuration = Number(state.selectedProduct?.prep || 0);
  return shootDuration + prepDuration || 30;
}

function getQuoteCacheKey(payload) {
  return JSON.stringify(payload);
}

function syncQuoteFromCache() {
  const payload = buildQuotePayload();
  state.quote = payload ? state.quoteCache.get(getQuoteCacheKey(payload)) || getPromoPreviewQuote() : null;
  renderPriceCard();
  updateReview();
  if (state.selectedProduct) {
    const warmup = state.currentMonth || parseDateParts(state.promoStart);
    prefetchMonth(warmup.year, warmup.monthIndex);
    prefetchAdjacentMonths(warmup.year, warmup.monthIndex);
  }
}

async function refreshQuote() {
  const payload = buildQuotePayload();
  if (!payload) return null;
  const cacheKey = getQuoteCacheKey(payload);
  const token = ++state.quoteToken;
  const cached = state.quoteCache.get(cacheKey);
  if (cached) {
    state.quote = cached;
    renderPriceCard();
    updateReview();
    return cached;
  }
  const preview = getPromoPreviewQuote();
  if (preview) {
    state.quote = preview;
    renderPriceCard();
    updateReview();
  }
  const nextQuote = await fetchQuote(payload);
  if (token !== state.quoteToken) return state.quote;
  state.quote = nextQuote;
  state.quoteCache.set(cacheKey, nextQuote);
  renderPriceCard();
  updateReview();
  const warmup = state.currentMonth || parseDateParts(state.promoStart);
  prefetchMonth(warmup.year, warmup.monthIndex);
  prefetchAdjacentMonths(warmup.year, warmup.monthIndex);
  return nextQuote;
}

function queueQuoteRefresh(delay = 0) {
  if (state.quoteRefreshTimer) clearTimeout(state.quoteRefreshTimer);
  state.quoteRefreshTimer = window.setTimeout(() => {
    state.quoteRefreshTimer = null;
    refreshQuote()
      .catch((error) => console.error(error))
      .finally(() => updateStepButtons());
  }, delay);
}

function renderStaticCopy() {
  const c = copy();
  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };
  document.documentElement.lang = state.lang;
  els.loadingCopy.textContent = c.loading;
  setText('heroEyebrow', c.eyebrow);
  setText('heroTitle', c.heroTitle);
  setText('heroLead', c.heroLead);
  setText('closedTitle', c.closedTitle);
  setText('closedBody', c.closedBody);
  setText('periodLabel', c.periodLabel);
  setText('limitLabel', c.limitLabel);
  setText('limitValue', c.limitValue);
  setText('step1Title', c.step1Title);
  setText('step1Lead', c.step1Lead);
  setText('step2Title', c.step2Title);
  setText('step2Lead', c.step2Lead);
  setText('step3Title', c.step3Title);
  setText('step4Title', c.step4Title);
  setText('step4Lead', c.step4Lead);
  setText('peopleLabel', c.peopleLabel);
  setText('childAgeLabel', c.childAgeLabel);
  setText('familyInfoLabel', c.familyInfoLabel);
  setText('nameLabel', c.nameLabel);
  setText('phoneLabel', c.phoneLabel);
  setText('emailLabel', c.emailLabel);
  setText('addressLabel', c.addressLabel);
  setText('memoLabel', c.memoLabel);
  setText('consentTitle', c.consentTitle);
  setText('consentLead', c.consentLead);
  setText('gdprLabel', c.gdprLabel);
  setText('gdprSub', c.gdprSub);
  setText('aiLabel', c.aiLabel);
  setText('aiSub', c.aiSub);
  setText('marketingLabel', c.marketingLabel);
  setText('marketingSub', c.marketingSub);
  els.step1Next.textContent = c.next;
  els.step2Back.textContent = c.back;
  els.step2Next.textContent = c.next;
  els.step3Back.textContent = c.back;
  els.step3Next.textContent = c.next;
  els.step4Back.textContent = c.back;
  els.submitBtn.textContent = state.submitting ? c.submitBusy : c.submit;
  els.restartBtn.textContent = c.restart;
  els.prevMonthBtn.textContent = c.back;
  els.nextMonthBtn.textContent = c.next;
  els.slotTitle.textContent = c.slotTitle;
  els.slotHint.textContent = c.slotEmpty;
  els.calendarGrid.textContent = c.loadingCalendar;
  els.slotGrid.textContent = c.loadingSlots;
  els.form.elements.address.placeholder = c.addressPlaceholder;
  els.form.elements.memo.placeholder = c.memoPlaceholder;
  els.childAgeInput.placeholder = c.childAgePlaceholder;
  els.familyInfoInput.placeholder = c.familyInfoPlaceholder;
  document.getElementById('successTitle').textContent = c.successTitle;
  document.getElementById('successLead').textContent = c.successLead;
  els.successGuide.textContent = c.successGuide;
  document.getElementById('periodValue').textContent = c.periodValue(state.promoStart, state.promoEnd);
  els.langBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.lang === state.lang));
}

function renderProducts() {
  const c = copy();
  els.productGrid.innerHTML = state.products.map((product) => {
    const meta = c.groups[product.id];
    const active = state.selectedProduct?.id === product.id ? ' active' : '';
    return `<button type="button" class="product-card${active}" data-product-id="${product.id}">
      <span class="card-badge">${escapeHtml(meta.badge)}</span>
      <strong>${escapeHtml(meta.title)}</strong>
      <ul class="feature-list compact">${meta.desc.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <div class="product-note">${escapeHtml(meta.note)}</div>
    </button>`;
  }).join('');
}

function renderDetailCard() {
  const c = copy();
  if (!state.selectedProduct) {
    els.detailCard.innerHTML = '';
    return;
  }
  const meta = c.groups[state.selectedProduct.id];
  els.detailCard.innerHTML = `
    <div class="card-badge">${escapeHtml(meta.badge)}</div>
    <h3>${escapeHtml(meta.title)}</h3>
    <div class="detail-grid">
      <div>
        <div class="meta-label">${escapeHtml(c.packageSummary)}</div>
        <ul class="feature-list">${meta.desc.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
      <div class="note-box">
        <strong>${escapeHtml(meta.badge)}</strong>
        <p>${escapeHtml(meta.note)}</p>
      </div>
    </div>`;
}

function renderPeopleOptions() {
  const c = copy();
  const base = state.selectedProduct?.id === 'promo_family_2026' ? 2 : 1;
  const options = [];
  for (let i = base; i <= 5; i += 1) {
    let label = `${i}${state.lang === 'de' ? ' Personen' : state.lang === 'en' ? ' people' : '인'}`;
    if (state.selectedProduct?.id === 'promo_family_2026' && i > 4) label += ' (+20€)';
    options.push(`<option value="${i}">${escapeHtml(label)}</option>`);
  }
  options.push(`<option value="custom">${escapeHtml(state.lang === 'de' ? '6+ direkt eingeben' : state.lang === 'en' ? '6+ custom input' : '6명 이상 직접입력')}</option>`);
  els.peopleSelect.innerHTML = options.join('');
  els.peopleSelect.value = String(state.people);
  els.peopleCustom.classList.toggle('hidden', String(state.people) !== 'custom');
}

function renderConditionalFields() {
  els.childAgeField.classList.add('hidden');
  els.familyInfoField.classList.add('hidden');
}

function renderPriceCard() {
  const c = copy();
  const quote = state.quote || getPromoPreviewQuote();
  if (!quote || !state.selectedProduct) {
    els.priceCard.innerHTML = '';
    return;
  }
  const meta = c.groups[state.selectedProduct.id];
  els.priceCard.innerHTML = `
    <div class="price-label">${escapeHtml(c.price)}</div>
    <div class="price-main">€${escapeHtml(quote.totalPrice)}</div>
    <div class="price-sub">${escapeHtml(meta.title)} · ${escapeHtml(`${getPeopleValue()}${state.lang === 'de' ? ' Personen' : state.lang === 'en' ? ' people' : '인'}`)}</div>
  `;
}

function monthKey(year, monthIndex) {
  return `${year}-${pad2(monthIndex + 1)}`;
}

function weekdayLabels() {
  if (state.lang === 'en') return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (state.lang === 'de') return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return ['일', '월', '화', '수', '목', '금', '토'];
}

function isDateAllowed(dateStr, unavailSet) {
  const today = todayDateStr();
  return dateStr >= today &&
    dateStr >= state.promoStart &&
    dateStr <= state.promoEnd &&
    dateStr <= PROMO_END_LIMIT &&
    !unavailSet.has(dateStr);
}

function renderCalendar(batchData) {
  const { year, monthIndex } = state.currentMonth;
  const key = monthKey(year, monthIndex);
  const unavail = new Set((batchData?.unavail || state.monthCache[key]?.unavail || []).map(String));
  els.monthLabel.textContent = formatMonthLabel(year, monthIndex, state.lang);
  els.calendarWeekdays.innerHTML = weekdayLabels().map((label) => `<span>${escapeHtml(label)}</span>`).join('');
  const first = new Date(year, monthIndex, 1);
  const startWeekday = first.getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push('<span class="day-spacer"></span>');
  for (let day = 1; day <= days; day += 1) {
    const dateStr = `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
    const allowed = isDateAllowed(dateStr, unavail);
    const active = state.selectedDate === dateStr ? ' active' : '';
    const disabled = allowed ? '' : ' disabled';
    cells.push(`<button type="button" class="day-btn${active}${disabled}" data-date="${dateStr}" ${allowed ? '' : 'disabled'}>${day}</button>`);
  }
  els.calendarGrid.classList.remove('loading-box');
  els.calendarGrid.innerHTML = cells.join('');
}

function renderSlotLoading() {
  els.slotGrid.className = 'slot-grid loading-box';
  els.slotGrid.textContent = copy().loadingSlots;
}

function renderSlots(slots) {
  const c = copy();
  els.slotGrid.className = 'slot-grid';
  if (!slots.length) {
    els.slotGrid.innerHTML = `<div class="slot-empty">${escapeHtml(c.slotNone)}</div>`;
    return;
  }
  els.slotGrid.innerHTML = slots.map((slot) => {
    const active = state.selectedSlot === slot ? ' active' : '';
    return `<button type="button" class="slot-btn${active}" data-slot="${slot}">${escapeHtml(slot)}</button>`;
  }).join('');
}

function getPrefetchDuration() {
  if (state.selectedProduct) return getCalendarDuration();
  const firstPromoProduct = state.products[0];
  const shootDuration = Number(firstPromoProduct?.d || 0);
  const prepDuration = Number(firstPromoProduct?.prep || 0);
  return shootDuration + prepDuration || 30;
}

async function fetchMonthData(year, monthIndex) {
  const key = monthKey(year, monthIndex);
  if (state.monthCache[key]) return state.monthCache[key];
  const response = await fetchCalendarBatch({
    year,
    month: monthIndex,
    totalDur: getPrefetchDuration(),
    itemGroup: 'promo'
  });
  const data = response?.[`${year}_${monthIndex}`] || response;
  state.monthCache[key] = data;
  return data;
}

function prefetchMonth(year, monthIndex) {
  const key = monthKey(year, monthIndex);
  if (state.monthCache[key]) return;
  fetchMonthData(year, monthIndex).catch((error) => console.error(error));
}

function prefetchAdjacentMonths(year, monthIndex) {
  const prev = new Date(year, monthIndex - 1, 1);
  const next = new Date(year, monthIndex + 1, 1);
  const minMonth = `${state.promoStart.slice(0, 7)}-01`;
  const maxMonth = `${PROMO_END_LIMIT.slice(0, 7)}-01`;
  const prevKey = `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}-01`;
  const nextKey = `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-01`;
  if (prevKey >= minMonth) prefetchMonth(prev.getFullYear(), prev.getMonth());
  if (nextKey <= maxMonth) prefetchMonth(next.getFullYear(), next.getMonth());
}

async function ensureMonthLoaded(year, monthIndex) {
  state.calendarLoading = true;
  els.calendarGrid.className = 'calendar-grid loading-box';
  els.calendarGrid.textContent = copy().loadingCalendar;
  const data = await fetchMonthData(year, monthIndex);
  renderCalendar(data);
  state.calendarLoading = false;
  prefetchAdjacentMonths(year, monthIndex);
  return data;
}

async function loadSlots(dateStr) {
  const token = ++state.slotRequestToken;
  const duration = getCalendarDuration();
  const cacheKey = `${dateStr}_${duration}`;
  state.selectedSlot = '';
  renderSlotLoading();
  const cached = state.slotCache.get(cacheKey);
  if (Array.isArray(cached)) {
    if (token !== state.slotRequestToken) return;
    renderSlots(cached);
    updateStepButtons();
    return;
  }
  const data = await fetchSlots({
    date: dateStr,
    totalDur: duration,
    itemGroup: 'promo'
  });
  if (token !== state.slotRequestToken) return;
  const slots = Array.isArray(data) ? data : Array.isArray(data?.slots) ? data.slots : [];
  state.slotCache.set(cacheKey, slots);
  renderSlots(slots);
  updateStepButtons();
}

function updateReview() {
  const c = copy();
  const quote = state.quote || getPromoPreviewQuote();
  if (!state.selectedProduct || !quote) {
    els.reviewBox.innerHTML = '';
    return;
  }
  const meta = c.groups[state.selectedProduct.id];
  const rows = [
    [c.packageName, meta.title],
    [c.price, `€${quote.totalPrice}`],
    [c.peopleLabel, `${getPeopleValue()}${state.lang === 'de' ? ' Personen' : state.lang === 'en' ? ' people' : '인'}`]
  ];
  if (state.selectedDate && state.selectedSlot) rows.push([c.bookingTime, `${state.selectedDate} ${state.selectedSlot}`]);
  els.reviewBox.innerHTML = rows.map(([label, value]) => `
    <div class="review-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('');
}

function validateStep(step) {
  const c = copy();
  if (step === 1) return state.selectedProduct ? '' : c.step1Warning;
  if (step === 2) {
    if (!state.selectedProduct) return c.step1Warning;
    return '';
  }
  if (step === 3) {
    if (!state.selectedDate) return c.step3WarningDate;
    if (!state.selectedSlot) return c.step3WarningTime;
    return '';
  }
  if (step === 4) {
    const email = String(els.form.elements.email.value || '').trim();
    const ok = String(els.form.elements.name.value || '').trim() &&
      String(els.form.elements.phone.value || '').trim() &&
      email &&
      !!els.form.elements.gdprConsent.checked &&
      !!els.form.elements.aiConsent?.checked;
    if (!ok) return c.formRequired;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.invalidEmail;
    return '';
  }
  return '';
}

function updateStepButtons() {
  setStepWarning(1, validateStep(1));
  setStepWarning(2, validateStep(2));
  setStepWarning(3, validateStep(3));
  setStepWarning(4, validateStep(4));
  els.step1Next.disabled = !!validateStep(1);
  els.step2Next.disabled = !!validateStep(2);
  els.step3Next.disabled = !!validateStep(3);
  els.submitBtn.disabled = !!validateStep(4) || state.submitting;
}

function selectProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  state.selectedProduct = product;
  setProductDefaults();
  renderProducts();
  renderConditionalFields();
  renderPeopleOptions();
  renderDetailCard();
  syncQuoteFromCache();
  updateStepButtons();
  queueQuoteRefresh();
}

async function goToCalendarStep() {
  const warning = validateStep(2);
  if (warning) {
    setStepWarning(2, warning);
    return;
  }
  if (!state.currentMonth) {
    const { year, monthIndex } = parseDateParts(state.promoStart);
    state.currentMonth = { year, monthIndex };
  }
  showStep(3);
  els.calendarHint.textContent = copy().calendarHintProduct(copy().groups[state.selectedProduct.id].title);
  await ensureMonthLoaded(state.currentMonth.year, state.currentMonth.monthIndex);
  updateStepButtons();
}

function renderSuccess(result) {
  const c = copy();
  const rows = [
    [c.customerName, result.name || els.form.elements.name.value],
    [c.customerEmail, result.email || els.form.elements.email.value],
    [c.bookingTime, `${result.date || state.selectedDate} ${result.time || state.selectedSlot}`],
    [c.packageName, copy().groups[state.selectedProduct.id].title],
    [c.price, `€${state.quote?.totalPrice || ''}`]
  ];
  els.successGrid.innerHTML = rows.map(([label, value]) => `
    <div class="success-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>`).join('');
  els.successGuide.textContent = c.successGuide;
  els.successPanel.classList.remove('hidden');
  els.step1.classList.add('hidden');
  els.step2.classList.add('hidden');
  els.step3.classList.add('hidden');
  els.step4.classList.add('hidden');
}

function buildSubmitPayload() {
  const meta = copy().groups[state.selectedProduct.id];
  return {
    itemId: state.selectedProduct.id,
    people: getPeopleValue(),
    date: state.selectedDate,
    time: state.selectedSlot,
    name: String(els.form.elements.name.value || '').trim(),
    phone: String(els.form.elements.phone.value || '').trim(),
    email: String(els.form.elements.email.value || '').trim(),
    address: String(els.form.elements.address.value || '').trim(),
    memo: String(els.form.elements.memo.value || '').trim(),
    gdprConsent: !!els.form.elements.gdprConsent.checked,
    aiConsent: !!els.form.elements.aiConsent?.checked,
    marketing: !!els.form.elements.marketing.checked,
    lang: state.lang,
    optionKeys: [],
    surveyKeys: [],
    meta: { promoType: meta.title }
  };
}

async function onSubmit(event) {
  event.preventDefault();
  const warning = validateStep(4);
  if (warning) {
    setStepWarning(4, warning);
    return;
  }
  state.submitting = true;
  renderStaticCopy();
  updateStepButtons();
  try {
    const result = await submitBooking(buildSubmitPayload(), createRequestId('promo'));
    renderSuccess(result || {});
    setStatus(copy().successTitle, 'ready');
  } catch (error) {
    setStatus(error.message || '예약 신청에 실패했습니다.', 'error');
  } finally {
    state.submitting = false;
    renderStaticCopy();
    updateStepButtons();
  }
}

function bindEvents() {
  els.langBtns.forEach((btn) => btn.addEventListener('click', () => {
    if (btn.dataset.lang) setLang(btn.dataset.lang);
  }));
  els.productGrid.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-product-id]');
    if (!btn) return;
    selectProduct(btn.dataset.productId);
  });
  els.peopleSelect.addEventListener('change', async () => {
    state.people = els.peopleSelect.value;
    if (state.people !== 'custom') state.customPeople = '';
    renderPeopleOptions();
    syncQuoteFromCache();
    updateStepButtons();
    queueQuoteRefresh();
  });
  els.peopleCustom.addEventListener('input', () => {
    state.customPeople = els.peopleCustom.value;
    syncQuoteFromCache();
    updateStepButtons();
    queueQuoteRefresh(QUOTE_REFRESH_DEBOUNCE_MS);
  });
  els.childAgeInput.addEventListener('input', () => {
    state.childAge = els.childAgeInput.value;
    updateReview();
    updateStepButtons();
  });
  els.familyInfoInput.addEventListener('input', () => {
    state.familyInfo = els.familyInfoInput.value;
    updateReview();
    updateStepButtons();
  });
  els.step1Next.addEventListener('click', () => {
    if (validateStep(1)) return;
    showStep(2);
  });
  els.step2Back.addEventListener('click', () => showStep(1));
  els.step2Next.addEventListener('click', goToCalendarStep);
  els.prevMonthBtn.addEventListener('click', async () => {
    if (!state.currentMonth) return;
    const next = new Date(state.currentMonth.year, state.currentMonth.monthIndex - 1, 1);
    if (`${next.getFullYear()}-${pad2(next.getMonth() + 1)}-01` < state.promoStart.slice(0, 8) + '01') return;
    state.currentMonth = { year: next.getFullYear(), monthIndex: next.getMonth() };
    state.selectedDate = '';
    state.selectedSlot = '';
    renderSlotLoading();
    await ensureMonthLoaded(state.currentMonth.year, state.currentMonth.monthIndex);
    renderSlots([]);
    updateReview();
    updateStepButtons();
  });
  els.nextMonthBtn.addEventListener('click', async () => {
    if (!state.currentMonth) return;
    const next = new Date(state.currentMonth.year, state.currentMonth.monthIndex + 1, 1);
    if (`${next.getFullYear()}-${pad2(next.getMonth() + 1)}-01` > PROMO_END_LIMIT.slice(0, 8) + '01') return;
    state.currentMonth = { year: next.getFullYear(), monthIndex: next.getMonth() };
    state.selectedDate = '';
    state.selectedSlot = '';
    renderSlotLoading();
    await ensureMonthLoaded(state.currentMonth.year, state.currentMonth.monthIndex);
    renderSlots([]);
    updateReview();
    updateStepButtons();
  });
  els.calendarGrid.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-date]');
    if (!btn || btn.disabled) return;
    state.selectedDate = btn.dataset.date;
    renderCalendar(state.monthCache[monthKey(state.currentMonth.year, state.currentMonth.monthIndex)]);
    await loadSlots(state.selectedDate);
    updateReview();
  });
  els.slotGrid.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-slot]');
    if (!btn) return;
    state.selectedSlot = btn.dataset.slot;
    renderSlots(Array.from(els.slotGrid.querySelectorAll('[data-slot]')).map((el) => el.dataset.slot));
    updateReview();
    updateStepButtons();
  });
  els.step3Back.addEventListener('click', () => showStep(2));
  els.step3Next.addEventListener('click', () => {
    if (validateStep(3)) return;
    showStep(4);
  });
  els.step4Back.addEventListener('click', () => showStep(3));
  els.form.addEventListener('input', updateStepButtons);
  els.form.addEventListener('change', updateStepButtons);
  els.submitBtn.addEventListener('click', onSubmit);
  els.restartBtn.addEventListener('click', () => window.location.reload());
}

async function init() {
  renderStaticCopy();
  bindEvents();
  try {
    setStatus(copy().statusLoading, 'loading');
    const initData = await fetchInitData();
    state.promoEnabled = !!initData?.settings?.promoEnabled;
    state.promoStart = initData?.settings?.promoStart || state.promoStart;
    state.promoEnd = initData?.settings?.promoEnd || state.promoEnd;
    state.promoContent = initData?.settings?.promoContent || {};
    state.products = Array.isArray(initData?.promoProducts) ? initData.promoProducts : [];
    if (!state.promoEnabled) {
      els.promoClosed.classList.remove('hidden');
      els.promoContent.classList.add('hidden');
      setStatus(copy().statusClosed, 'error');
      return;
    }
    els.promoClosed.classList.add('hidden');
    els.promoContent.classList.remove('hidden');
    state.currentMonth = parseDateParts(state.promoStart);
    state.currentMonth = { year: state.currentMonth.year, monthIndex: state.currentMonth.monthIndex };
    renderStaticCopy();
    renderProducts();
    renderPeopleOptions();
    renderConditionalFields();
    setStatus(copy().statusReady, 'ready');
    updateStepButtons();
  } catch (error) {
    els.promoClosed.classList.remove('hidden');
    els.promoContent.classList.add('hidden');
    setStatus(error.message || '프로모션 정보를 불러오지 못했습니다.', 'error');
  } finally {
    els.loadingScreen.classList.add('hidden');
  }
}

init();
