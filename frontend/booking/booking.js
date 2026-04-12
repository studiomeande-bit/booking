import { fetchCalendarBatch, fetchInitData, submitBooking } from './shared/api.js';
import { createRequestId, escapeHtml, formatMonthLabel, pad2 } from './shared/utils.js';

const COUNTRY_OPTIONS = [
  { code: 'KR', flag: '🇰🇷', label: { ko: '한국', en: 'Korea', de: 'Korea' } },
  { code: 'DE', flag: '🇩🇪', label: { ko: '독일', en: 'Germany', de: 'Deutschland' } },
  { code: 'JP', flag: '🇯🇵', label: { ko: '일본', en: 'Japan', de: 'Japan' } },
  { code: 'CN', flag: '🇨🇳', label: { ko: '중국', en: 'China', de: 'China' } },
  { code: 'US', flag: '🇺🇸', label: { ko: '미국', en: 'USA', de: 'USA' } },
  { code: 'OTHER', flag: '🌐', label: { ko: '기타', en: 'Other', de: 'Andere' } }
];

const GROUP_META = {
  pass: { icon: '🛂', label: { ko: '여권/비자', en: 'Passport / Visa', de: 'Pass / Visum' } },
  prof: { icon: '👤', label: { ko: '프로필', en: 'Profile', de: 'Profil' } },
  stud: { icon: '📸', label: { ko: '스튜디오', en: 'Studio', de: 'Studio' } },
  snap: { icon: '🌿', label: { ko: '야외스냅', en: 'Outdoor', de: 'Outdoor' } },
  wed: { icon: '💍', label: { ko: '프리웨딩', en: 'Pre-Wedding', de: 'Pre-Wedding' } },
  biz: { icon: '🎬', label: { ko: '기업/행사', en: 'Corporate / Event', de: 'Firma / Event' } }
};

const COPY = {
  ko: {
    hero: '이 페이지는 Netlify 정적 프론트의 예약 API 연결 버전입니다. 이번 단계에서는 기존 예약 UX를 순차적으로 이식합니다.',
    initSuccess: '상품 데이터를 불러왔습니다. 원하는 상품을 선택해 주세요.',
    loadCalendar: '달력을 불러오는 중입니다.',
    calendarLoaded: '달력 데이터를 불러왔습니다.',
    calendarFail: '달력 조회 실패',
    slotHintEmpty: '날짜를 선택하면 예약 가능 시간이 표시됩니다.',
    noSlots: '예약 가능한 시간이 없습니다.',
    invalidForm: '이름, 연락처, 이메일은 필수입니다.',
    submitDone: '예약 API 제출이 완료되었습니다.',
    submitFail: '예약 제출 실패',
    productHelp: '상품을 선택하면 설명과 예약 가능 일정을 불러옵니다.',
    formHelp: '기본 예약 정보를 입력한 뒤 제출합니다.',
    passportTitle: '여권/비자 옵션',
    passportCopy: '촬영 국가를 선택하면 국가별 추가 비용을 함께 반영합니다.',
    passportHint: '기본 1개 국가는 포함되며, 추가 국가는 1개당 €5가 반영됩니다.',
    reviewEmpty: '상품, 날짜, 시간이 선택되면 예약 요약이 표시됩니다.',
    reviewPrice: '예상 금액',
    reviewProduct: '상품',
    reviewDate: '날짜',
    reviewTime: '시간',
    reviewPeople: '인원',
    reviewCountries: '촬영 국가',
    yes: '동의',
    no: '미동의'
  },
  en: {
    hero: 'This Netlify frontend is now connected to the booking API. In this phase we are rebuilding the original reservation UX step by step.',
    initSuccess: 'Products loaded. Please choose a package.',
    loadCalendar: 'Loading the calendar.',
    calendarLoaded: 'Calendar data loaded.',
    calendarFail: 'Calendar request failed',
    slotHintEmpty: 'Select a date to see available time slots.',
    noSlots: 'No available time slots.',
    invalidForm: 'Name, phone, and email are required.',
    submitDone: 'Booking request was submitted successfully.',
    submitFail: 'Booking submission failed',
    productHelp: 'Choose a package to see the description and available schedule.',
    formHelp: 'Enter the basic booking details and submit.',
    passportTitle: 'Passport / Visa options',
    passportCopy: 'Choose the target country and we will include additional country charges.',
    passportHint: 'One country is included. Each additional country adds €5.',
    reviewEmpty: 'A booking summary appears here after you choose product, date, and time.',
    reviewPrice: 'Estimated price',
    reviewProduct: 'Product',
    reviewDate: 'Date',
    reviewTime: 'Time',
    reviewPeople: 'People',
    reviewCountries: 'Country',
    yes: 'Agreed',
    no: 'Not agreed'
  },
  de: {
    hero: 'Dieses Netlify-Frontend ist jetzt mit der Buchungs-API verbunden. In dieser Phase bauen wir die ursprüngliche Buchungs-UX Schritt für Schritt nach.',
    initSuccess: 'Produkte geladen. Bitte wählen Sie ein Paket.',
    loadCalendar: 'Kalender wird geladen.',
    calendarLoaded: 'Kalenderdaten geladen.',
    calendarFail: 'Kalenderabfrage fehlgeschlagen',
    slotHintEmpty: 'Wählen Sie ein Datum, um verfügbare Zeiten zu sehen.',
    noSlots: 'Keine verfügbaren Termine.',
    invalidForm: 'Name, Telefon und E-Mail sind erforderlich.',
    submitDone: 'Die Buchung wurde erfolgreich übermittelt.',
    submitFail: 'Buchung fehlgeschlagen',
    productHelp: 'Wählen Sie ein Paket, um Beschreibung und verfügbare Termine zu sehen.',
    formHelp: 'Geben Sie die Basisdaten ein und senden Sie die Anfrage ab.',
    passportTitle: 'Pass / Visum Optionen',
    passportCopy: 'Wählen Sie das Zielland. Zusätzliche Länder werden im Preis berücksichtigt.',
    passportHint: 'Ein Land ist inklusive. Jedes weitere Land kostet €5 extra.',
    reviewEmpty: 'Hier erscheint eine Zusammenfassung, sobald Produkt, Datum und Uhrzeit gewählt wurden.',
    reviewPrice: 'Geschätzter Preis',
    reviewProduct: 'Produkt',
    reviewDate: 'Datum',
    reviewTime: 'Uhrzeit',
    reviewPeople: 'Personen',
    reviewCountries: 'Land',
    yes: 'Zustimmung',
    no: 'Keine Zustimmung'
  }
};

const state = {
  init: null,
  lang: 'ko',
  selectedProduct: null,
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  selectedDate: '',
  selectedSlot: '',
  selectedCountries: [],
  calendarCache: new Map(),
  slotCache: new Map()
};

const els = {
  banner: document.getElementById('statusBanner'),
  heroLead: document.getElementById('heroLead'),
  productHelp: document.getElementById('productHelp'),
  productGrid: document.getElementById('productGrid'),
  productDetail: document.getElementById('productDetail'),
  passportPanel: document.getElementById('passportPanel'),
  passportCountries: document.getElementById('passportCountries'),
  passportPeople: document.getElementById('passportPeople'),
  passportHint: document.getElementById('passportHint'),
  calendarHint: document.getElementById('calendarHint'),
  monthLabel: document.getElementById('monthLabel'),
  calendarGrid: document.getElementById('calendarGrid'),
  slotHint: document.getElementById('slotHint'),
  slotGrid: document.getElementById('slotGrid'),
  reviewBox: document.getElementById('reviewBox'),
  formHelp: document.getElementById('formHelp'),
  form: document.getElementById('bookingForm'),
  submitBtn: document.getElementById('submitBtn'),
  resultBox: document.getElementById('resultBox'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn'),
  langButtons: Array.from(document.querySelectorAll('.lang-btn'))
};

boot();

async function boot() {
  wireEvents();
  applyCopy();
  try {
    const initData = await fetchInitData();
    state.init = initData;
    renderProducts(initData.products || []);
    renderPassportCountries();
    renderProductDetail();
    renderReview();
    setBanner(getCopy().initSuccess, 'success');
  } catch (error) {
    console.error(error);
    setBanner(`초기화 실패: ${error.message}`, 'error');
  }
}

function wireEvents() {
  els.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
  els.nextMonthBtn.addEventListener('click', () => changeMonth(1));
  els.form.addEventListener('submit', onSubmit);
  els.passportPeople.addEventListener('change', () => {
    clearCalendarSelection();
    renderProductDetail();
    renderReview();
  });
  els.langButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.lang = button.dataset.lang;
      els.langButtons.forEach((item) => item.classList.toggle('active', item === button));
      applyCopy();
      renderProducts(state.init?.products || []);
      renderPassportCountries();
      renderProductDetail();
      renderReview();
      if (state.selectedProduct) {
        els.calendarHint.textContent = `${getProductLabel(state.selectedProduct)} · ${getDisplayDuration()}분`;
      }
    });
  });
}

function getCopy() {
  return COPY[state.lang] || COPY.ko;
}

function applyCopy() {
  const copy = getCopy();
  els.heroLead.textContent = copy.hero;
  els.productHelp.textContent = copy.productHelp;
  els.formHelp.textContent = copy.formHelp;
  els.passportHint.textContent = copy.passportHint;
  els.slotHint.textContent = state.selectedDate ? els.slotHint.textContent : copy.slotHintEmpty;
  if (!state.selectedProduct && !els.reviewBox.querySelector('.review-list')) {
    els.reviewBox.textContent = copy.reviewEmpty;
  }
}

function getProductLabel(product) {
  if (!product) return '';
  if (state.lang === 'en') return product.nameEn || product.nameKo;
  if (state.lang === 'de') return product.nameDe || product.nameKo;
  return product.nameKo || product.nameEn || product.nameDe;
}

function getProductDescription(product) {
  if (!product) return '';
  if (state.lang === 'en') return product.descEn || product.descKo || '';
  if (state.lang === 'de') return product.descDe || product.descKo || '';
  return product.descKo || product.descEn || '';
}

function getDisplayDuration() {
  if (!state.selectedProduct) return 0;
  let duration = Number(state.selectedProduct.d || 0) + Number(state.selectedProduct.prep || 0);
  if (state.selectedProduct.g === 'pass') {
    const people = Number(els.passportPeople.value || 1);
    const passDur = [0, 15, 20, 30, 40, 50];
    duration = passDur[people] || 50;
  }
  return duration;
}

function getEstimatedPrice() {
  if (!state.selectedProduct) return 0;
  let price = Number(state.selectedProduct.p || 0);
  if (state.selectedProduct.g === 'pass') {
    const extra = Math.max(0, state.selectedCountries.length - 1) * 5;
    price += extra;
  }
  return price;
}

function renderProducts(products) {
  const groups = [];
  const seen = new Set();
  (products || []).forEach((product) => {
    if (!seen.has(product.g)) {
      seen.add(product.g);
      groups.push(product.g);
    }
  });
  els.productGrid.innerHTML = groups.map((groupKey) => {
    const meta = GROUP_META[groupKey] || { icon: '📷', label: { ko: groupKey, en: groupKey, de: groupKey } };
    const groupLabel = meta.label[state.lang] || meta.label.ko;
    const cards = products.filter((product) => product.g === groupKey).map((product) => {
      const duration = Number(product.d || 0) + Number(product.prep || 0);
      const selected = state.selectedProduct?.id === product.id ? ' selected' : '';
      return `
        <button type="button" class="product-card${selected}" data-id="${escapeHtml(product.id)}">
          <h3>${escapeHtml(getProductLabel(product))}</h3>
          <div class="product-meta">
            <div>${escapeHtml(product.nameEn || '')}</div>
            <div>€${escapeHtml(product.p)} · ${escapeHtml(duration)}분</div>
          </div>
        </button>
      `;
    }).join('');
    return `<div class="product-group-title">${meta.icon} ${escapeHtml(groupLabel)}</div>${cards}`;
  }).join('');
  els.productGrid.querySelectorAll('.product-card').forEach((button) => {
    button.addEventListener('click', () => selectProduct(button.dataset.id));
  });
}

async function selectProduct(productId) {
  state.selectedProduct = (state.init?.products || []).find((item) => item.id === productId) || null;
  state.selectedDate = '';
  state.selectedSlot = '';
  if (state.selectedProduct?.g !== 'pass') {
    state.selectedCountries = [];
  }
  els.submitBtn.disabled = true;
  renderProducts(state.init?.products || []);
  renderPassportPanel();
  renderProductDetail();
  renderReview();
  if (!state.selectedProduct) return;
  els.calendarHint.textContent = `${getProductLabel(state.selectedProduct)} · ${getDisplayDuration()}분 기준으로 예약 가능 날짜를 조회합니다.`;
  setBanner(getCopy().loadCalendar, 'loading');
  await loadCalendar();
}

function renderPassportPanel() {
  const isPass = state.selectedProduct?.g === 'pass';
  els.passportPanel.classList.toggle('hidden', !isPass);
  if (isPass) {
    renderPassportCountries();
  }
}

function renderPassportCountries() {
  els.passportCountries.innerHTML = COUNTRY_OPTIONS.map((item) => {
    const label = item.label[state.lang] || item.label.ko;
    const selected = state.selectedCountries.includes(item.code) ? ' selected' : '';
    return `<button type="button" class="chip-btn${selected}" data-country="${item.code}">${item.flag} ${escapeHtml(label)}</button>`;
  }).join('');
  els.passportCountries.querySelectorAll('.chip-btn').forEach((button) => {
    button.addEventListener('click', () => toggleCountry(button.dataset.country));
  });
}

function toggleCountry(code) {
  const index = state.selectedCountries.indexOf(code);
  if (index >= 0) state.selectedCountries.splice(index, 1);
  else state.selectedCountries.push(code);
  clearCalendarSelection();
  renderPassportCountries();
  renderProductDetail();
  renderReview();
}

function renderProductDetail() {
  if (!state.selectedProduct) {
    els.productDetail.className = 'detail-box empty-state';
    els.productDetail.textContent = '상품을 선택하면 설명과 예상 금액이 여기에 표시됩니다.';
    return;
  }
  const desc = getProductDescription(state.selectedProduct);
  const price = getEstimatedPrice();
  els.productDetail.className = 'detail-box';
  els.productDetail.innerHTML = `
    <div class="detail-title">${escapeHtml(getProductLabel(state.selectedProduct))}</div>
    <div class="detail-copy">${escapeHtml(desc)}</div>
    <div class="detail-price">€${price} · ${getDisplayDuration()}분</div>
  `;
}

async function loadCalendar() {
  if (!state.selectedProduct) return;
  const duration = getDisplayDuration();
  const cacheKey = `${state.calendarYear}_${state.calendarMonth}_${state.selectedProduct.g}_${duration}`;
  let batch = state.calendarCache.get(cacheKey);
  els.monthLabel.textContent = formatMonthLabel(state.calendarYear, state.calendarMonth);
  if (!batch) {
    try {
      batch = await fetchCalendarBatch({
        year: state.calendarYear,
        month: state.calendarMonth,
        totalDur: duration,
        itemGroup: state.selectedProduct.g
      });
      Object.entries(batch || {}).forEach(([monthKey, data]) => {
        const fullKey = `${monthKey}_${state.selectedProduct.g}_${duration}`;
        state.calendarCache.set(fullKey, data);
        Object.entries(data?.slotsByDate || {}).forEach(([dateKey, slots]) => {
          state.slotCache.set(`${dateKey}_${state.selectedProduct.g}_${duration}`, slots);
        });
      });
      batch = state.calendarCache.get(cacheKey);
    } catch (error) {
      console.error(error);
      setBanner(`${getCopy().calendarFail}: ${error.message}`, 'error');
      els.calendarGrid.innerHTML = `<div class="empty-state">달력을 불러오지 못했습니다. ${escapeHtml(error.message)}</div>`;
      return;
    }
  }
  renderCalendar(batch);
  setBanner(getCopy().calendarLoaded, 'success');
}

function renderCalendar(data) {
  if (!data) {
    els.calendarGrid.innerHTML = '<div class="empty-state">달력 데이터가 없습니다.</div>';
    return;
  }
  const unavail = new Set(data.unavail || []);
  const firstDay = new Date(state.calendarYear, state.calendarMonth, 1).getDay();
  const daysInMonth = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push('<div class="calendar-cell muted"></div>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${state.calendarYear}-${pad2(state.calendarMonth + 1)}-${pad2(day)}`;
    const disabled = unavail.has(dateKey);
    const selected = state.selectedDate === dateKey;
    cells.push(`
      <button type="button" class="calendar-cell${disabled ? ' muted' : ''}${selected ? ' selected' : ''}" data-date="${dateKey}" ${disabled ? 'disabled' : ''}>
        ${day}
      </button>
    `);
  }
  els.calendarGrid.innerHTML = cells.join('');
  els.calendarGrid.querySelectorAll('.calendar-cell[data-date]').forEach((button) => {
    button.addEventListener('click', () => selectDate(button.dataset.date));
  });
}

function selectDate(dateKey) {
  state.selectedDate = dateKey;
  state.selectedSlot = '';
  renderCalendar(state.calendarCache.get(`${state.calendarYear}_${state.calendarMonth}_${state.selectedProduct.g}_${getDisplayDuration()}`));
  const slotKey = `${dateKey}_${state.selectedProduct.g}_${getDisplayDuration()}`;
  const slots = state.slotCache.get(slotKey) || [];
  els.slotHint.textContent = `${dateKey} 기준 예약 가능 시간입니다.`;
  renderSlots(slots);
  renderReview();
}

function renderSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    els.slotGrid.innerHTML = `<div class="empty-state">${getCopy().noSlots}</div>`;
    els.submitBtn.disabled = true;
    return;
  }
  els.slotGrid.innerHTML = slots.map((slot) => {
    const value = typeof slot === 'string' ? slot : slot.time;
    return `<button type="button" class="slot-btn${state.selectedSlot === value ? ' selected' : ''}" data-time="${escapeHtml(value)}">${escapeHtml(value)}</button>`;
  }).join('');
  els.slotGrid.querySelectorAll('.slot-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSlot = button.dataset.time;
      els.slotGrid.querySelectorAll('.slot-btn').forEach((item) => item.classList.toggle('selected', item.dataset.time === state.selectedSlot));
      updateSubmitState();
      renderReview();
    });
  });
  updateSubmitState();
}

function renderReview() {
  if (!state.selectedProduct) {
    els.reviewBox.className = 'detail-box empty-state';
    els.reviewBox.textContent = getCopy().reviewEmpty;
    return;
  }
  const copy = getCopy();
  const rows = [
    [copy.reviewProduct, getProductLabel(state.selectedProduct)],
    [copy.reviewPrice, `€${getEstimatedPrice()}`]
  ];
  if (state.selectedDate) rows.push([copy.reviewDate, state.selectedDate]);
  if (state.selectedSlot) rows.push([copy.reviewTime, state.selectedSlot]);
  if (state.selectedProduct.g === 'pass') {
    rows.push([copy.reviewPeople, `${els.passportPeople.value}명`]);
    if (state.selectedCountries.length) {
      const countries = state.selectedCountries.map((code) => {
        const item = COUNTRY_OPTIONS.find((entry) => entry.code === code);
        return item ? item.label[state.lang] || item.label.ko : code;
      }).join(', ');
      rows.push([copy.reviewCountries, countries]);
    }
  }
  els.reviewBox.className = 'detail-box';
  els.reviewBox.innerHTML = rows.map(([key, val]) => `
    <div class="summary-item" style="margin-top:10px;">
      <div class="summary-label">${escapeHtml(key)}</div>
      <div class="summary-value">${escapeHtml(val)}</div>
    </div>
  `).join('');
}

function updateSubmitState() {
  const ready = state.selectedProduct && state.selectedDate && state.selectedSlot;
  els.submitBtn.disabled = !ready;
}

function clearCalendarSelection() {
  state.selectedDate = '';
  state.selectedSlot = '';
  els.slotGrid.innerHTML = `<div class="empty-state">${getCopy().slotHintEmpty}</div>`;
  els.slotHint.textContent = getCopy().slotHintEmpty;
  updateSubmitState();
}

function changeMonth(offset) {
  const next = new Date(state.calendarYear, state.calendarMonth + offset, 1);
  state.calendarYear = next.getFullYear();
  state.calendarMonth = next.getMonth();
  clearCalendarSelection();
  if (state.selectedProduct) loadCalendar();
}

async function onSubmit(event) {
  event.preventDefault();
  if (!state.selectedProduct || !state.selectedDate || !state.selectedSlot) return;
  const formData = new FormData(els.form);
  const payload = {
    requestId: createRequestId('booking'),
    itemId: state.selectedProduct.id,
    date: state.selectedDate,
    time: state.selectedSlot,
    people: state.selectedProduct.g === 'pass' ? Number(els.passportPeople.value || 1) : 1,
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    address: String(formData.get('address') || '').trim(),
    memo: String(formData.get('memo') || '').trim(),
    website: String(formData.get('website') || ''),
    lang: state.lang,
    optionKeys: [],
    passCountries: state.selectedProduct.g === 'pass' ? state.selectedCountries.filter((code) => code !== 'OTHER') : [],
    surveyKeys: [],
    businessDetails: '',
    location: '',
    marketing: formData.get('marketing') === 'on',
    gdprConsent: true,
    aiConsent: true,
    bgColors: [],
    passAddon: false,
    passAddonPeople: 1
  };
  if (!payload.name || !payload.phone || !payload.email) {
    setBanner(getCopy().invalidForm, 'error');
    return;
  }
  if (state.selectedProduct.g === 'pass' && !state.selectedCountries.length) {
    setBanner('촬영 국가를 최소 1개 선택해 주세요.', 'error');
    return;
  }
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = '제출 중...';
  try {
    const result = await submitBooking(payload, payload.requestId);
    els.resultBox.hidden = false;
    els.resultBox.textContent = JSON.stringify(result, null, 2);
    setBanner(getCopy().submitDone, 'success');
    els.form.reset();
    state.selectedSlot = '';
    renderReview();
    updateSubmitState();
  } catch (error) {
    console.error(error);
    setBanner(`${getCopy().submitFail}: ${error.message}`, 'error');
  } finally {
    els.submitBtn.textContent = '예약 제출';
    updateSubmitState();
  }
}

function setBanner(message, variant) {
  els.banner.textContent = message;
  els.banner.className = `banner ${variant}`;
}
