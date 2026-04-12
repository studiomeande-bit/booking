import { fetchCalendarBatch, fetchInitData, submitBooking } from './shared/api.js';
import { createRequestId, escapeHtml, formatMonthLabel, pad2 } from './shared/utils.js';

const state = {
  init: null,
  selectedProduct: null,
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  selectedDate: '',
  selectedSlot: '',
  calendarCache: new Map(),
  slotCache: new Map()
};

const els = {
  banner: document.getElementById('statusBanner'),
  productGrid: document.getElementById('productGrid'),
  calendarHint: document.getElementById('calendarHint'),
  monthLabel: document.getElementById('monthLabel'),
  calendarGrid: document.getElementById('calendarGrid'),
  slotHint: document.getElementById('slotHint'),
  slotGrid: document.getElementById('slotGrid'),
  form: document.getElementById('bookingForm'),
  submitBtn: document.getElementById('submitBtn'),
  resultBox: document.getElementById('resultBox'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn')
};

boot();

async function boot() {
  wireEvents();
  try {
    const initData = await fetchInitData();
    state.init = initData;
    renderProducts(initData.products || []);
    setBanner('상품 데이터를 불러왔습니다. 이제 예약 플로우를 API 기반으로 분리합니다.', 'success');
  } catch (error) {
    console.error(error);
    setBanner(`초기화 실패: ${error.message}`, 'error');
  }
}

function wireEvents() {
  els.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
  els.nextMonthBtn.addEventListener('click', () => changeMonth(1));
  els.form.addEventListener('submit', onSubmit);
}

function renderProducts(products) {
  els.productGrid.innerHTML = products.map((product) => {
    const duration = Number(product.d || 0) + Number(product.prep || 0);
    return `
      <button type="button" class="product-card" data-id="${escapeHtml(product.id)}">
        <h3>${escapeHtml(product.nameKo)}</h3>
        <div class="product-meta">
          <div>${escapeHtml(product.nameEn || '')}</div>
          <div>€${escapeHtml(product.p)} · ${escapeHtml(duration)}분</div>
        </div>
      </button>
    `;
  }).join('');
  els.productGrid.querySelectorAll('.product-card').forEach((button) => {
    button.addEventListener('click', () => selectProduct(button.dataset.id));
  });
}

async function selectProduct(productId) {
  state.selectedProduct = (state.init?.products || []).find((item) => item.id === productId) || null;
  state.selectedDate = '';
  state.selectedSlot = '';
  els.submitBtn.disabled = true;
  els.productGrid.querySelectorAll('.product-card').forEach((button) => {
    button.classList.toggle('selected', button.dataset.id === productId);
  });
  if (!state.selectedProduct) return;
  const totalDur = getTotalDuration();
  els.calendarHint.textContent = `${state.selectedProduct.nameKo} · ${totalDur}분 기준으로 예약 가능 날짜를 조회합니다.`;
  setBanner('달력을 불러오는 중입니다.', 'loading');
  await loadCalendar();
}

function getTotalDuration() {
  if (!state.selectedProduct) return 0;
  return Number(state.selectedProduct.d || 0) + Number(state.selectedProduct.prep || 0);
}

async function loadCalendar() {
  if (!state.selectedProduct) return;
  const cacheKey = `${state.calendarYear}_${state.calendarMonth}_${state.selectedProduct.g}_${getTotalDuration()}`;
  let batch = state.calendarCache.get(cacheKey);
  els.monthLabel.textContent = formatMonthLabel(state.calendarYear, state.calendarMonth);
  if (!batch) {
    try {
      batch = await fetchCalendarBatch({
        year: state.calendarYear,
        month: state.calendarMonth,
        totalDur: getTotalDuration(),
        itemGroup: state.selectedProduct.g
      });
      Object.entries(batch || {}).forEach(([monthKey, data]) => {
        const fullKey = `${monthKey}_${state.selectedProduct.g}_${getTotalDuration()}`;
        state.calendarCache.set(fullKey, data);
        Object.entries(data?.slotsByDate || {}).forEach(([dateKey, slots]) => {
          state.slotCache.set(`${dateKey}_${state.selectedProduct.g}_${getTotalDuration()}`, slots);
        });
      });
      batch = state.calendarCache.get(cacheKey);
    } catch (error) {
      console.error(error);
      setBanner(`달력 조회 실패: ${error.message}`, 'error');
      els.calendarGrid.innerHTML = `<div class="empty-state">달력을 불러오지 못했습니다. ${escapeHtml(error.message)}</div>`;
      return;
    }
  }
  renderCalendar(batch);
  setBanner('달력 데이터를 불러왔습니다.', 'success');
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
  for (let i = 0; i < firstDay; i += 1) {
    cells.push('<div class="calendar-cell muted"></div>');
  }
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
  renderCalendar(state.calendarCache.get(`${state.calendarYear}_${state.calendarMonth}_${state.selectedProduct.g}_${getTotalDuration()}`));
  const slotKey = `${dateKey}_${state.selectedProduct.g}_${getTotalDuration()}`;
  const slots = state.slotCache.get(slotKey) || [];
  els.slotHint.textContent = `${dateKey} 기준 예약 가능 시간입니다.`;
  renderSlots(slots);
}

function renderSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    els.slotGrid.innerHTML = '<div class="empty-state">예약 가능한 시간이 없습니다.</div>';
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
    });
  });
  updateSubmitState();
}

function updateSubmitState() {
  const ready = state.selectedProduct && state.selectedDate && state.selectedSlot;
  els.submitBtn.disabled = !ready;
}

function changeMonth(offset) {
  const next = new Date(state.calendarYear, state.calendarMonth + offset, 1);
  state.calendarYear = next.getFullYear();
  state.calendarMonth = next.getMonth();
  state.selectedDate = '';
  state.selectedSlot = '';
  els.slotGrid.innerHTML = '<div class="empty-state">날짜를 다시 선택해 주세요.</div>';
  els.slotHint.textContent = '날짜를 선택하면 예약 가능 시간이 표시됩니다.';
  updateSubmitState();
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
    people: 1,
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    address: String(formData.get('address') || '').trim(),
    memo: String(formData.get('memo') || '').trim(),
    website: String(formData.get('website') || ''),
    lang: 'ko',
    optionKeys: [],
    passCountries: [],
    surveyKeys: [],
    businessDetails: '',
    location: '',
    marketing: false,
    gdprConsent: true,
    aiConsent: true,
    bgColors: [],
    passAddon: false,
    passAddonPeople: 1
  };
  if (!payload.name || !payload.phone || !payload.email) {
    setBanner('이름, 연락처, 이메일은 필수입니다.', 'error');
    return;
  }
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = '제출 중...';
  try {
    const result = await submitBooking(payload, payload.requestId);
    els.resultBox.hidden = false;
    els.resultBox.textContent = JSON.stringify(result, null, 2);
    setBanner('예약 API 제출이 완료되었습니다. 다음 단계에서 기존 고급 옵션을 순차적으로 옮깁니다.', 'success');
    els.form.reset();
    state.selectedSlot = '';
    updateSubmitState();
  } catch (error) {
    console.error(error);
    setBanner(`예약 제출 실패: ${error.message}`, 'error');
  } finally {
    els.submitBtn.textContent = '예약 제출';
    updateSubmitState();
  }
}

function setBanner(message, variant) {
  els.banner.textContent = message;
  els.banner.className = `banner ${variant}`;
}
