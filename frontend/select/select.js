import {
  fetchSelectPickupCalendar,
  fetchSelectPickupSlots,
  fetchSelectSession,
  submitSelectSession,
  updateSelectSession
} from '../shared/api-select.js';
import {
  PRINT_NONE_ID,
  getProductDeliveryLines,
  getProductDeliverySpec,
  getProductIncludedPrintQuota,
  getProductIncludedPrintSummary,
  productHasFixedDeliverySpec,
  productHasIncludedPrints
} from '../shared/product-delivery.js';
import { createRequestId, escapeHtml, formatMonthLabel, pad2 } from '../shared/utils.js';

const PRINT_OPTIONS = [
  { id: PRINT_NONE_ID, label: '출력 없음', retouched: 0, additional: 0 },
  { id: 'basic_10x15', label: '기본 10×15cm / 6×4 inch', retouched: 5, additional: 5 },
  { id: 'premium_10x15', label: '프리미엄 10×15cm', retouched: 3, additional: 8 },
  { id: 'photocard_single', label: '포토카드 프린트 (단면)', retouched: 5, additional: 5 },
  { id: 'photocard_double', label: '포토카드 프린트 (양면)', retouched: 8, additional: 8 },
  { id: 'basic_a4', label: '기본 A4', retouched: 10, additional: 15 },
  { id: 'premium_a4', label: '프리미엄 A4', retouched: 15, additional: 20 },
  { id: 'premium_a3', label: '프리미엄 A3', retouched: 35, additional: 50 },
  { id: 'premium_a3plus', label: '프리미엄 A3+', retouched: 45, additional: 60 }
];

const PHOTOCARD_MODE_LABELS = {
  retouched: '양면 · 보정본 2장',
  mixed: '양면 · 보정본 1장 + 원본 1장',
  original: '양면 · 원본 2장'
};
const MAIL_POSTAL_CITY_PATTERN = /(?:^|[\s,])(?:[A-Z]{1,3}-)?\d{4,5}\s+[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 .'\-()/]{1,}/i;

const state = {
  sessionId: new URLSearchParams(globalThis.location.search).get('id') || '',
  testMode: new URLSearchParams(globalThis.location.search).get('test') === '1',
  session: null,
  photos: [],
  prints: [],
  photocard: defaultPhotocardSelection(),
  marketing: '',
  deliveryMethod: '',
  pickupDate: '',
  pickupTime: '',
  pickupSlots: [],
  pickupCalendarCache: new Map(),
  pickupCalendarYear: 0,
  pickupCalendarMonth: 0,
  pickupEventId: '',
  mailName: '',
  mailAddress: '',
  editMode: false,
  step: 0,
  submitted: false
};

const els = {
  loadingScreen: document.getElementById('loadingScreen'),
  banner: document.getElementById('statusBanner'),
  errorPanel: document.getElementById('errorPanel'),
  errorMessage: document.getElementById('errorMessage'),
  appPanel: document.getElementById('appPanel'),
  successPanel: document.getElementById('successPanel'),
  progressRow: document.querySelector('.progress-row'),
  sessionSummary: document.getElementById('sessionSummary'),
  packageSummary: document.getElementById('packageSummary'),
  driveLink: document.getElementById('driveLink'),
  successDriveLink: document.getElementById('successDriveLink'),
  welcomeTitle: document.getElementById('welcomeTitle'),
  welcomeSub: document.getElementById('welcomeSub'),
  startBtn: document.getElementById('startBtn'),
  marketingBox: document.getElementById('marketingBox'),
  marketingYesCard: document.getElementById('marketingYesCard'),
  marketingNoCard: document.getElementById('marketingNoCard'),
  photoCounter: document.getElementById('photoCounter'),
  photoCounterSub: document.getElementById('photoCounterSub'),
  extraCost: document.getElementById('extraCost'),
  photoList: document.getElementById('photoList'),
  photocardBox: document.getElementById('photocardBox'),
  addPhotoBtn: document.getElementById('addPhotoBtn'),
  printPriceGuide: document.getElementById('printPriceGuide'),
  printList: document.getElementById('printList'),
  addPrintBtn: document.getElementById('addPrintBtn'),
  reviewPhotos: document.getElementById('reviewPhotos'),
  reviewPhotocardBlock: document.getElementById('reviewPhotocardBlock'),
  reviewPhotocard: document.getElementById('reviewPhotocard'),
  reviewPrints: document.getElementById('reviewPrints'),
  reviewMarketing: document.getElementById('reviewMarketing'),
  deliveryReviewBlock: document.getElementById('deliveryReviewBlock'),
  deliveryPickupCard: document.getElementById('deliveryPickupCard'),
  deliveryMailCard: document.getElementById('deliveryMailCard'),
  pickupScheduler: document.getElementById('pickupScheduler'),
  pickupCalendarStatus: document.getElementById('pickupCalendarStatus'),
  pickupPrevMonthBtn: document.getElementById('pickupPrevMonthBtn'),
  pickupNextMonthBtn: document.getElementById('pickupNextMonthBtn'),
  pickupMonthLabel: document.getElementById('pickupMonthLabel'),
  pickupCalendarGrid: document.getElementById('pickupCalendarGrid'),
  pickupSlotHint: document.getElementById('pickupSlotHint'),
  pickupSlotGrid: document.getElementById('pickupSlotGrid'),
  mailAddressBox: document.getElementById('mailAddressBox'),
  mailNameInput: document.getElementById('mailNameInput'),
  mailAddressInput: document.getElementById('mailAddressInput'),
  reviewDelivery: document.getElementById('reviewDelivery'),
  reviewTotal: document.getElementById('reviewTotal'),
  submitHint: document.getElementById('submitHint'),
  submitBtn: document.getElementById('submitBtn'),
  successTitle: document.getElementById('successTitle'),
  successCopy: document.getElementById('successCopy'),
  successName: document.getElementById('successName'),
  successProduct: document.getElementById('successProduct'),
  successPhotoCount: document.getElementById('successPhotoCount'),
  successTotal: document.getElementById('successTotal'),
  successGuide: document.getElementById('successGuide'),
  step1NextBtn: document.getElementById('step1NextBtn'),
  step2NextBtn: document.getElementById('step2NextBtn'),
  stepWarnings: {
    step1: document.getElementById('step1Warning'),
    step2: document.getElementById('step2Warning'),
    step3: document.getElementById('step3Warning')
  },
  stepPanels: Array.from(document.querySelectorAll('.step-panel')),
  stepDots: [0, 1, 2, 3].map((index) => document.getElementById(`dot${index}`)),
  navButtons: Array.from(document.querySelectorAll('[data-go]'))
};

boot();

async function boot() {
  wireEvents();
  if (!state.sessionId) {
    showError('세션 ID가 없습니다. URL의 `?id=` 값을 확인해 주세요.');
    return;
  }
  try {
    const session = await fetchSelectSession(state.sessionId);
    hydrateSession(session);
    renderHeader();
    renderSessionSummary();
    renderPackageSummary();
    renderPriceGuide();
    renderPhotos();
    renderPhotocardBox();
    renderPrints();
    updatePhotoCounter();
    updateReview();
    updateSubmitState();
    showApp();
    if (state.deliveryMethod === 'pickup') {
      await ensurePickupCalendarLoaded();
      if (state.pickupDate) await loadPickupSlots(state.pickupDate);
      updateReview();
      updateSubmitState();
    }
    setBanner(state.editMode ? '기존 제출 내용을 불러왔습니다. 수정 후 다시 제출할 수 있습니다.' : '셀렉 세션을 불러왔습니다.', 'success');
  } catch (error) {
    console.error(error);
    showError(error.message);
  }
  hideLoading();
}

function wireEvents() {
  els.startBtn.addEventListener('click', () => goStep(1));
  els.addPhotoBtn.addEventListener('click', addPhotoRow);
  els.addPrintBtn.addEventListener('click', addPrintRow);
  els.submitBtn.addEventListener('click', onSubmit);
  els.navButtons.forEach((button) => {
    button.addEventListener('click', () => goStep(Number(button.dataset.go)));
  });
  document.querySelectorAll('input[name="marketing"]').forEach((input) => {
    input.addEventListener('change', () => setMarketing(input.value));
  });
  document.querySelectorAll('input[name="deliveryMethod"]').forEach((input) => {
    input.addEventListener('change', () => setDeliveryMethod(input.value));
  });
  els.mailNameInput?.addEventListener('input', () => {
    state.mailName = els.mailNameInput.value;
    updateReview();
  });
  els.mailAddressInput?.addEventListener('input', () => {
    state.mailAddress = els.mailAddressInput.value;
    updateReview();
  });
  els.pickupPrevMonthBtn?.addEventListener('click', () => movePickupMonth(-1));
  els.pickupNextMonthBtn?.addEventListener('click', () => movePickupMonth(1));
}

function showError(message) {
  setBanner(message, 'error');
  els.errorPanel.classList.remove('hidden');
  els.errorMessage.textContent = message;
  els.appPanel.classList.add('hidden');
  els.successPanel.classList.add('hidden');
  hideLoading();
}

function showApp() {
  els.errorPanel.classList.add('hidden');
  els.appPanel.classList.remove('hidden');
  els.successPanel.classList.add('hidden');
  els.progressRow.classList.remove('hidden');
  els.stepPanels.forEach((panel, index) => panel.classList.toggle('hidden', index !== 0));
  goStep(0);
}

function hideLoading() {
  els.loadingScreen.classList.add('hidden');
}

function hydrateSession(session) {
  state.session = session;
  state.editMode = !!session.canEdit;
  state.marketing = session.bookingMarketing || session.existingMarketing || '';
  state.deliveryMethod = session.existingDeliveryMethod || '';
  if (session.existingPickupAt) {
    const [pickupDate = '', pickupTime = ''] = String(session.existingPickupAt).trim().split(' ');
    state.pickupDate = pickupDate;
    state.pickupTime = pickupTime;
  }
  state.pickupEventId = session.existingPickupEventId || '';
  state.mailName = String(session.existingMailName || session.name || '').trim();
  state.mailAddress = normalizeMailAddressText(session.existingMailAddress || session.bookingAddress || '');
  state.photos = state.editMode && Array.isArray(session.existingPhotos)
    ? session.existingPhotos.map(normalizePhoto)
    : buildDefaultPhotos(session.baseRetouchCount || 0, session);
  const existingPrints = Array.isArray(session.existingPrints) ? session.existingPrints : [];
  state.prints = state.editMode
    ? existingPrints
        .filter((print) => !isPhotocardFallbackPrint(print))
        // 보너스/서비스 인화 업그레이드 차액 항목은 제출 시 자동 생성되므로 복원에서 제외 (중복 청구 방지)
        .filter((print) => !String(print?.printId || '').startsWith('uplift_'))
        .map(normalizePrint)
        .filter(hasMeaningfulPrint)
    : [];
  state.photocard = normalizePhotocardSelection(session.existingPhotocard || extractPhotocardFromPrints(existingPrints));
  if (session.bookingMarketing === 'Y') {
    state.marketing = 'Y';
  }
  syncMarketingBonusRows();
  syncServiceCutRows();
  renderServiceCutNotice();
  syncMarketingUi();
  syncDeliveryUi();
  seedPickupCalendarCursor();
}

function getSessionProductInput(session = state.session) {
  return {
    itemGroup: session?.itemGroup || '',
    product: session?.product || '',
    id: session?.productId || session?.itemId || ''
  };
}

function getSelectablePrintOptions() {
  return PRINT_OPTIONS.filter((option) => option.id !== PRINT_NONE_ID);
}

function normalizePrintTypeId(typeId) {
  return String(typeId || PRINT_NONE_ID).replace(/_(r|e)$/, '') || PRINT_NONE_ID;
}

function getSessionIncludedPrintQuota(session = state.session) {
  const validIds = new Set(PRINT_OPTIONS.map((option) => option.id));
  return getProductIncludedPrintQuota(getSessionProductInput(session))
    .filter((item) => validIds.has(item.id) && Number(item.qty) > 0)
    .map((item) => ({ id: item.id, qty: Number(item.qty) || 0 }));
}

function getDefaultPrintTypeForRegularIndex(index, session = state.session) {
  const preset = getIncludedPrintPresetTypes(session, Number(index) + 1);
  return preset[index] || PRINT_NONE_ID;
}

function buildDefaultPhotos(count, session) {
  const total = Number(count) || 0;
  const presetTypes = getIncludedPrintPresetTypes(session, total);
  return Array.from({ length: total }, (_, index) => ({
    num: '',
    note: '',
    printType: presetTypes[index] || PRINT_NONE_ID,
    isBonus: false
  }));
}

function getIncludedPrintPresetTypes(session, count) {
  const total = Number(count) || 0;
  const preset = [];
  const quota = getSessionIncludedPrintQuota(session);
  quota.forEach((item) => {
    for (let i = 0; i < item.qty; i += 1) {
      preset.push(item.id);
    }
  });
  while (preset.length < total) {
    preset.push(PRINT_NONE_ID);
  }
  return preset.slice(0, total);
}

function getIncludedPrintSummary(session = state.session) {
  return getProductIncludedPrintSummary(getSessionProductInput(session), 'ko');
}

function normalizePhoto(photo) {
  return {
    num: String(photo?.num || ''),
    note: String(photo?.note || ''),
    printType: normalizePrintTypeId(photo?.printType),
    isBonus: !!photo?.isBonus,
    isService: !!photo?.isService
  };
}

function normalizePrint(print) {
  const resolvedId = resolvePrintId(print);
  return {
    photoNum: String(
      print?.photoNum ??
      print?.photo ??
      print?.num ??
      print?.number ??
      print?.photoNumber ??
      ''
    ),
    printId: resolvedId,
    qty: Math.max(1, Number(print?.qty || 1) || 1)
  };
}

function resolvePrintId(print) {
  const raw = String(
    print?.printId ||
    print?.id ||
    print?.printType ||
    print?.type ||
    print?.paperType ||
    print?.size ||
    print?.label ||
    ''
  ).replace(/_(r|e)$/, '').trim();
  if (!raw) return 'basic_10x15';

  const exact = PRINT_OPTIONS.find((item) => item.id === raw);
  if (exact) return exact.id;

  const normalized = raw.toLowerCase().replace(/\s+/g, '');
  const labelMatch = PRINT_OPTIONS.find((item) => {
    const itemLabel = item.label.toLowerCase().replace(/\s+/g, '');
    return itemLabel === normalized || itemLabel.includes(normalized) || normalized.includes(itemLabel);
  });
  return labelMatch ? labelMatch.id : 'basic_10x15';
}

function hasMeaningfulPrint(print) {
  return !!String(print?.photoNum || '').trim() || Math.max(1, Number(print?.qty || 1) || 1) > 0;
}

function defaultPhotocardSelection() {
  return { mode: 'retouched', frontNum: '', backNum: '', note: '' };
}

function normalizePhotocardSelection(value) {
  const fallback = defaultPhotocardSelection();
  if (!value || typeof value !== 'object') return fallback;
  const mode = Object.keys(PHOTOCARD_MODE_LABELS).includes(String(value.mode || ''))
    ? String(value.mode)
    : fallback.mode;
  return {
    mode,
    frontNum: String(value.frontNum ?? value.front ?? '').trim(),
    backNum: String(value.backNum ?? value.back ?? '').trim(),
    note: String(value.note || '').trim()
  };
}

function hasIncludedPhotocard() {
  if (state.session && state.session.hasPhotocard !== undefined) return state.session.hasPhotocard === true;
  if (state.session?.hasPhotocard === true) return true;
  const itemGroup = String(state.session?.itemGroup || '').toLowerCase().trim();
  const text = `${state.session?.product || ''} ${state.session?.itemGroup || ''}`.toLowerCase();
  return /포토카드|photocard|photo card|fotokarte/.test(text);
}

function textSuggestsNoPhysicalDelivery(text) {
  return /myrealtrip|my real trip|마이리얼트립|출력물\s*없음|인화\s*없음|프린트\s*없음|디지털\s*(전용|만|only)|파일\s*(전용|만)|digital\s*only|files?\s*only|no\s*prints?|prints?\s*not\s*included|without\s*prints?|ohne\s*(druck|ausdruck|abzug)|kein(?:e|en)?\s*(druck|ausdruck|abzug)|nur\s*(digital|datei|dateien)/i.test(String(text || ''));
}

function textSuggestsPhysicalDelivery(text) {
  return /출력|인화|프린트|우편발송|배송|print|prints|printed|druck|ausdruck|abzug|fotokarte|포토카드|photocard|photo card|10\s*[×x]\s*15|6\s*[×x]\s*4|a[34]\b/i.test(String(text || ''));
}

function sessionHasIncludedDeliveryOutput() {
  if (!state.session) return true;
  if (state.session.requiresDelivery === false) return false;
  if (state.session.requiresDelivery === true) return true;
  const input = getSessionProductInput();
  if (productHasFixedDeliverySpec(input)) return productHasIncludedPrints(input);
  const text = [
    state.session.itemGroup,
    state.session.product,
    state.session.productDescription,
    state.session.description
  ].join(' ');
  if (textSuggestsNoPhysicalDelivery(text)) return false;
  return textSuggestsPhysicalDelivery(text);
}

function hasSelectedRetouchPrintOutput() {
  return state.photos.some((photo) => normalizePrintTypeId(photo.printType) !== PRINT_NONE_ID);
}

function hasRequestedDeliveryOutput() {
  return hasSelectedRetouchPrintOutput() || state.prints.length > 0 || hasIncludedPhotocard();
}

function requiresDeliverySelection() {
  return sessionHasIncludedDeliveryOutput() || hasRequestedDeliveryOutput();
}

function getIncludedPhotocardCount() {
  const product = String(state.session?.product || '').toLowerCase();
  return /가족사진|family photo|familienfoto|2장|2\s*(double|photo|포토카드|fotokarten)/.test(product) ? 2 : 1;
}

function getPhotocardModeLabel(mode = state.photocard.mode) {
  return PHOTOCARD_MODE_LABELS[mode] || PHOTOCARD_MODE_LABELS.retouched;
}

function getPhotocardPayload() {
  if (!hasIncludedPhotocard()) return null;
  const mode = Object.keys(PHOTOCARD_MODE_LABELS).includes(state.photocard.mode)
    ? state.photocard.mode
    : 'retouched';
  return {
    type: 'double_sided',
    included: true,
    qty: getIncludedPhotocardCount(),
    mode,
    modeLabel: getPhotocardModeLabel(mode),
    frontNum: String(state.photocard.frontNum || '').trim(),
    backNum: String(state.photocard.backNum || '').trim(),
    note: String(state.photocard.note || '').trim()
  };
}

function isPhotocardFallbackPrint(print) {
  return !!print?.includedPhotocard || String(print?.printId || '') === 'included_photocard';
}

function extractPhotocardFromPrints(prints) {
  const found = (prints || []).find(isPhotocardFallbackPrint);
  return found?.photocard || null;
}

function getPhotocardPrintFallbackPayload() {
  const payload = getPhotocardPayload();
  if (!payload || state.session?.photocardSupported === true) return null;
  return {
    photoNum: `앞면 ${payload.frontNum || '-'} / 뒷면 ${payload.backNum || '-'}`,
    printId: 'included_photocard',
    qty: payload.qty,
    label: `포함 양면 포토카드 (${payload.modeLabel})`,
    price: 0,
    isRetouched: false,
    includedPhotocard: true,
    photocard: payload
  };
}

function getPhotocardWarning() {
  if (!hasIncludedPhotocard()) return '';
  const payload = getPhotocardPayload();
  if (!payload.frontNum || !payload.backNum) {
    return '포토카드 앞면과 뒷면 사진 번호를 모두 입력해 주세요.';
  }
  return '';
}

function getPhotocardReviewText() {
  const payload = getPhotocardPayload();
  if (!payload) return '';
  const countText = payload.qty > 1 ? ` · ${payload.qty}장 제작` : '';
  const noteText = payload.note ? ` · ${payload.note}` : '';
  return `${payload.modeLabel}${countText} / 앞면 ${payload.frontNum || '-'} · 뒷면 ${payload.backNum || '-'}${noteText}`;
}

function normalizeMailAddressText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function normalizeMailNameText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getMailNameForSubmission() {
  return normalizeMailNameText(state.mailName);
}

function getMailAddressForSubmission() {
  return normalizeMailAddressText(state.mailAddress);
}

function hasMailAddressPostalCity(value) {
  return MAIL_POSTAL_CITY_PATTERN.test(normalizeMailAddressText(value).replace(/\n/g, ' '));
}

function formatMailAddressForReview(value) {
  return normalizeMailAddressText(value).replace(/\n/g, ' / ');
}

function renderHeader() {
  const name = state.session?.name || '';
  els.welcomeTitle.textContent = name ? `안녕하세요, ${name}님!` : '사진 셀렉';
  els.welcomeSub.textContent = state.editMode ? '이미 제출한 내용을 수정할 수 있습니다.' : '보정 선택과 추가 인화를 차례대로 진행해 주세요.';
  if (state.testMode) {
    els.submitHint.textContent = state.editMode
      ? '테스트 모드입니다. 고객 메일은 발송되지 않고 수정 제출만 검증합니다.'
      : '테스트 모드입니다. 고객 메일은 발송되지 않고 제출 흐름만 검증합니다.';
    return;
  }
  els.submitHint.textContent = state.editMode ? '수정 제출 모드입니다. 변경 후 다시 제출해 주세요.' : '모든 확인이 끝나면 제출해 주세요.';
}

function renderSessionSummary() {
  const s = state.session;
  els.sessionSummary.innerHTML = `
    <div class="summary-item"><div class="summary-label">고객명</div><div class="summary-value">${escapeHtml(s.name || '')}</div></div>
    <div class="summary-item"><div class="summary-label">상품</div><div class="summary-value">${escapeHtml(s.product || '')}</div></div>
    <div class="summary-item"><div class="summary-label">촬영일</div><div class="summary-value">${escapeHtml(s.date || '')}</div></div>
    <div class="summary-item"><div class="summary-label">기본 보정</div><div class="summary-value">${escapeHtml(s.baseRetouchCount || 0)}장</div></div>
    <div class="summary-item"><div class="summary-label">추가 보정 단가</div><div class="summary-value">€${escapeHtml(s.retouchPrice || 0)}</div></div>
    <div class="summary-item"><div class="summary-label">추가 인보이스</div><div class="summary-value">${escapeHtml(s.extraInvoiceNumber || '-')}</div></div>
  `;
}

function renderPackageSummary() {
  const s = state.session;
  const input = getSessionProductInput(s);
  const includedSummary = getIncludedPrintSummary(s);
  const hasFixedSpec = productHasFixedDeliverySpec(input);
  const includedLine = includedSummary
    ? `<div class="guide-copy">기본 제공 출력물: <b>${escapeHtml(includedSummary)}</b></div>`
    : hasFixedSpec
      ? '<div class="guide-copy">기본 제공 출력물: <b>포함 없음</b></div>'
      : '';
  const deliveryLines = getProductDeliveryLines(input, 'ko', { includeNoPrintLine: false })
    .filter((line) => !/보정본|retouched|retusch/i.test(line));
  const autoPrintNotice = includedSummary
    ? '<div class="guide-copy">상품에 포함된 출력 사이즈는 보정 사진 목록에 미리 적용되어 있습니다. 포함 수량 외 출력은 아래 <b>추가 인화</b>에서 입력해 주세요.</div>'
    : '';
  els.packageSummary.innerHTML = `
    <div class="detail-title">보정 패키지 안내</div>
    <div class="guide-copy">기본 보정 <b>${escapeHtml(s.baseRetouchCount || 0)}장</b> 포함 · 추가 보정 <b>€${escapeHtml(s.retouchPrice || 0)}/장</b></div>
    ${includedLine}
    ${autoPrintNotice}
    ${deliveryLines.length ? `<div class="guide-copy">${deliveryLines.map(escapeHtml).join(' · ')}</div>` : ''}
    ${s.deadline ? `<div class="guide-copy">셀렉 마감일: ${escapeHtml(String(s.deadline).slice(0, 10))}</div>` : ''}
    ${s.revisionCount ? `<div class="guide-copy">재수정 요청 횟수: ${escapeHtml(s.revisionCount)}회</div>` : ''}
  `;
  if (s.driveLink) {
    els.driveLink.href = s.driveLink;
    els.driveLink.classList.remove('hidden');
  }
}

function renderPriceGuide() {
  els.printPriceGuide.innerHTML = getSelectablePrintOptions().map((opt) => `
    <div class="review-item">
      <span>${escapeHtml(opt.label)}</span>
      <strong>€${opt.additional}</strong>
    </div>
  `).join('');
}

function getMarketingBonusCount() {
  const n = Number(state.session?.marketingBonusCount);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 2;
}

function getServiceCutCount() {
  const n = Number(state.session?.serviceCutCount);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function makeServicePhoto() {
  return { num: '', note: '', printType: 'basic_10x15', isBonus: true, isService: true };
}

// 서비스 컷: 어드민이 설정한 수량만큼 무료 슬롯 자동 유지 (0이면 아무 흔적 없음)
function syncServiceCutRows() {
  const desired = getServiceCutCount();
  const current = state.photos.filter((photo) => photo.isService).length;
  for (let i = current; i < desired; i += 1) state.photos.push(makeServicePhoto());
  if (current > desired) {
    let removeCount = current - desired;
    for (let i = state.photos.length - 1; i >= 0 && removeCount > 0; i -= 1) {
      const photo = state.photos[i];
      if (photo?.isService && !String(photo.num || '').trim() && !String(photo.note || '').trim()) {
        state.photos.splice(i, 1);
        removeCount -= 1;
      }
    }
  }
}

function renderServiceCutNotice() {
  const box = document.getElementById('serviceCutBox');
  if (!box) return;
  const count = getServiceCutCount();
  if (count <= 0) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.classList.remove('hidden');
  box.innerHTML = `<div class="service-cut-title">🎁 스튜디오 서비스 컷 ${count}장</div><div class="service-cut-copy">감사의 마음을 담아 준비했어요. 아래 보정 사진 목록의 <b>서비스 컷</b> 슬롯에 원하시는 사진 번호를 넣어 주세요. 각 서비스 컷에는 <b>기본 10×15cm 인화 1장</b>이 무료로 포함됩니다. 더 큰 사이즈로 바꾸시면 차액만 청구돼요.</div>`;
}

function makeBonusPhoto() {
  return { num: '', note: '', printType: 'basic_10x15', isBonus: true };
}

// 보너스/서비스 컷 공통: 기본 10×15cm 인화 무료 포함, 큰 사이즈 선택 시 차액만 청구
const BONUS_INCLUDED_PRINT_ID = 'basic_10x15';
function getBonusPrintUpcharge(photo) {
  const typeId = normalizePrintTypeId(photo?.printType);
  if (typeId === PRINT_NONE_ID) return 0;
  const option = PRINT_OPTIONS.find((item) => item.id === typeId);
  if (!option) return 0;
  const baseOption = PRINT_OPTIONS.find((item) => item.id === BONUS_INCLUDED_PRINT_ID);
  const basePrice = baseOption ? baseOption.retouched : 0;
  return Math.max(0, option.retouched - basePrice);
}

function syncMarketingBonusRows() {
  const desired = getMarketingBonusCount();
  const bonusCount = state.photos.filter((photo) => photo.isBonus && !photo.isService).length;
  if (state.marketing === 'Y') {
    for (let i = bonusCount; i < desired; i += 1) state.photos.push(makeBonusPhoto());
    if (bonusCount > desired) {
      let removeCount = bonusCount - desired;
      for (let i = state.photos.length - 1; i >= 0 && removeCount > 0; i -= 1) {
        const photo = state.photos[i];
        if (photo?.isBonus && !photo.isService && !String(photo.num || '').trim() && !String(photo.note || '').trim()) {
          state.photos.splice(i, 1);
          removeCount -= 1;
        }
      }
    }
  } else if (state.marketing === 'N') {
    state.photos = state.photos.filter((photo) => !photo.isBonus || photo.isService);
  }
}

function setMarketing(value) {
  state.marketing = value;
  syncMarketingBonusRows();
  syncMarketingUi();
  renderPhotos();
  updatePhotoCounter();
  updateReview();
}

function syncMarketingUi() {
  const value = state.marketing || 'N';
  document.querySelectorAll('input[name="marketing"]').forEach((input) => {
    input.checked = input.value === value;
  });
  els.marketingYesCard.classList.toggle('active', value === 'Y');
  els.marketingNoCard.classList.toggle('active', value === 'N');
  if (state.session?.bookingMarketing === 'Y') {
    els.marketingBox.querySelector('.detail-copy').textContent = '예약 단계에서 이미 포트폴리오 및 SNS 활용에 동의해 주셨어요. 아래에서 다시 한 번 확인만 해주시면 됩니다.';
  }
  updateSubmitState();
}

function seedPickupCalendarCursor() {
  if (state.pickupDate) {
    const seeded = new Date(`${state.pickupDate}T00:00:00`);
    if (!Number.isNaN(seeded.getTime())) {
      state.pickupCalendarYear = seeded.getFullYear();
      state.pickupCalendarMonth = seeded.getMonth();
      return;
    }
  }
  const today = new Date();
  state.pickupCalendarYear = today.getFullYear();
  state.pickupCalendarMonth = today.getMonth();
}

function setDeliveryMethod(value) {
  if (!requiresDeliverySelection()) {
    state.deliveryMethod = '';
    syncDeliveryUi();
    updateReview();
    return;
  }
  state.deliveryMethod = value;
  syncDeliveryUi();
  if (value === 'pickup') {
    ensurePickupCalendarLoaded()
      .then(() => {
        if (state.pickupDate) return loadPickupSlots(state.pickupDate).then(() => updateReview());
        renderPickupSlots([]);
        return null;
      })
      .catch((error) => {
        console.error(error);
        setBanner(`픽업 일정 조회 실패: ${error.message}`, 'error');
      });
  }
  updateReview();
}

function syncDeliveryUi() {
  const deliveryRequired = requiresDeliverySelection();
  if (!deliveryRequired) state.deliveryMethod = '';
  const method = deliveryRequired ? state.deliveryMethod : '';
  document.querySelectorAll('input[name="deliveryMethod"]').forEach((input) => {
    input.disabled = !deliveryRequired;
    input.checked = input.value === method;
  });
  els.deliveryReviewBlock?.classList.toggle('hidden', !deliveryRequired);
  els.deliveryPickupCard?.classList.toggle('active', method === 'pickup');
  els.deliveryMailCard?.classList.toggle('active', method === 'mail');
  els.pickupScheduler?.classList.toggle('hidden', !deliveryRequired || method !== 'pickup');
  els.mailAddressBox?.classList.toggle('hidden', !deliveryRequired || method !== 'mail');
  if (els.mailNameInput) els.mailNameInput.value = state.mailName || '';
  if (els.mailAddressInput) els.mailAddressInput.value = state.mailAddress || '';
  if (els.submitHint) {
    els.submitHint.textContent = deliveryRequired
      ? '신규 제출 또는 수정 제출이 세션 상태에 따라 자동 전환됩니다.'
      : '출력물 수령이 없는 상품입니다. 선택 내용을 확인한 뒤 제출해 주세요.';
  }
}

function getQuotaMap() {
  return getSessionIncludedPrintQuota().map((item) => ({ ...item }));
}

function getRegularPhotos() {
  return state.photos.filter((photo) => !photo.isBonus);
}

function getRetouchExtraCount() {
  const included = Number(state.session?.baseRetouchCount || 0);
  return Math.max(0, getRegularPhotos().length - included);
}

function isPrintFreeByQuota(index, printTypeId) {
  const targetTypeId = normalizePrintTypeId(printTypeId);
  if (targetTypeId === PRINT_NONE_ID) return false;
  const quota = getQuotaMap();
  for (let i = 0; i <= index; i += 1) {
    const photo = state.photos[i];
    if (photo?.isBonus) continue;
    const typeId = normalizePrintTypeId(photo.printType);
    const option = PRINT_OPTIONS.find((item) => item.id === typeId);
    if (!option || option.retouched === 0) continue;
    const match = quota.find((item) => item.id === typeId && item.qty > 0);
    if (match) {
      if (i === index && typeId === targetTypeId) return true;
      match.qty -= 1;
    }
  }
  return false;
}

function calcTotal() {
  const extraRetouch = getRetouchExtraCount() * Number(state.session?.retouchPrice || 0);
  const printUpgrade = state.photos.reduce((sum, photo, index) => {
    if (photo?.isBonus) return sum + getBonusPrintUpcharge(photo);
    const typeId = normalizePrintTypeId(photo.printType);
    const option = PRINT_OPTIONS.find((item) => item.id === typeId) || PRINT_OPTIONS[0];
    if (option.retouched === 0) return sum;
    return sum + (isPrintFreeByQuota(index, typeId) ? 0 : option.retouched);
  }, 0);
  const extraPrints = state.prints.reduce((sum, print) => {
    const option = getSelectablePrintOptions().find((item) => item.id === print.printId) || getSelectablePrintOptions()[0];
    return sum + option.additional * (Number(print.qty) || 1);
  }, 0);
  return extraRetouch + printUpgrade + extraPrints;
}

function addPhotoRow() {
  const bonusIndex = state.photos.findIndex((photo) => photo.isBonus);
  const regularIndex = state.photos.filter((photo) => !photo.isBonus).length;
  const newPhoto = { num: '', note: '', printType: getDefaultPrintTypeForRegularIndex(regularIndex), isBonus: false };
  if (bonusIndex >= 0) state.photos.splice(bonusIndex, 0, newPhoto);
  else state.photos.push(newPhoto);
  renderPhotos();
  updatePhotoCounter();
  updateReview();
}

function renderIncludedPrintNotice() {
  const includedSummary = getIncludedPrintSummary();
  if (!includedSummary) return '';
  return `
    <div class="included-print-callout">
      <strong>기본 제공 출력물: ${escapeHtml(includedSummary)}</strong>
      <span>기본 제공 사이즈가 보정 사진 목록에 미리 설정되어 있습니다. 포함 수량 외 출력은 아래 추가 인화에서 입력해 주세요.</span>
    </div>
  `;
}

function renderPhotos() {
  const includedPrintNotice = renderIncludedPrintNotice();
  if (!state.photos.length) {
    els.photoList.innerHTML = `${includedPrintNotice}<div class="empty-state">아직 선택된 보정 사진이 없습니다.</div>`;
    return;
  }
  const includedCount = Number(state.session?.baseRetouchCount || 0);
  const retouchPrice = Number(state.session?.retouchPrice || 0);
  els.photoList.innerHTML = includedPrintNotice + state.photos.map((photo, index) => {
    const typeId = normalizePrintTypeId(photo.printType);
    const option = PRINT_OPTIONS.find((item) => item.id === typeId) || PRINT_OPTIONS[0];
    const extra = !photo.isBonus && index >= includedCount ? `<span class="extra-badge">+€${retouchPrice}</span>` : '';
    const bonus = photo.isService ? '<span class="service-badge">서비스 컷</span>' : photo.isBonus ? '<span class="bonus-badge">보너스</span>' : '';
    const includedPrint = !photo.isBonus && isPrintFreeByQuota(index, typeId);
    const bonusUpcharge = photo.isBonus ? getBonusPrintUpcharge(photo) : 0;
    const free = photo.isBonus ? bonusUpcharge === 0 : (option.retouched === 0 || includedPrint);
    const includedPrintBadge = includedPrint ? '<span class="included-print-badge">기본 제공</span>' : '';
    return `
      <div class="entry-card${photo.isService ? ' service' : photo.isBonus ? ' bonus' : ''}">
        <div class="entry-head">
          <div class="entry-label">#${index + 1} ${bonus} ${extra}</div>
          ${photo.isBonus ? '' : `<button type="button" class="remove-btn" data-remove-photo="${index}">삭제</button>`}
        </div>
        <div class="entry-grid">
          <div class="field">
            <label>사진 번호</label>
            <input data-photo-num="${index}" value="${escapeHtml(photo.num || '')}" placeholder="예: 0023">
          </div>
          <div class="field-full">
            <label>보정 요청사항</label>
            <textarea data-photo-note="${index}" placeholder="예: 얼굴 라인을 자연스럽게 정리해 주세요.">${escapeHtml(photo.note || '')}</textarea>
          </div>
          <div class="field-full">
            <label>인화 사이즈</label>
            <select data-photo-print="${index}">
              ${PRINT_OPTIONS.map((item) => {
                const itemIncluded = item.id === typeId && includedPrint;
                const bonusKind = photo.isService ? '서비스 컷' : '마케팅 보너스';
                const itemUpcharge = Math.max(0, item.retouched - (PRINT_OPTIONS.find((x) => x.id === BONUS_INCLUDED_PRINT_ID)?.retouched || 0));
                const priceLabel = photo.isBonus
                  ? (item.retouched === 0
                      ? '선택 안 함'
                      : item.id === BONUS_INCLUDED_PRINT_ID
                        ? `무료(${bonusKind} · 기본 포함)`
                        : itemUpcharge === 0
                          ? `무료(${bonusKind})`
                          : `+€${itemUpcharge} (차액)`)
                  : itemIncluded
                  ? '무료(기본 제공)'
                  : item.retouched === 0
                    ? '선택 안 함'
                    : `+€${item.retouched}`;
                return `<option value="${item.id}"${item.id === typeId ? ' selected' : ''}>${escapeHtml(item.label)} — ${priceLabel}</option>`;
              }).join('')}
            </select>
          </div>
        </div>
        <div class="price-line">
          <span>출력 선택 ${includedPrintBadge}</span>
          <strong class="${free ? 'free' : 'paid'}">${free ? '무료' : `+€${photo.isBonus ? bonusUpcharge : option.retouched}`}</strong>
        </div>
      </div>
    `;
  }).join('');

  els.photoList.querySelectorAll('[data-photo-num]').forEach((input) => {
    input.addEventListener('input', () => {
      state.photos[Number(input.dataset.photoNum)].num = input.value;
      updatePhotoCounter();
      updateReview();
    });
  });
  els.photoList.querySelectorAll('[data-photo-note]').forEach((input) => {
    input.addEventListener('input', () => {
      state.photos[Number(input.dataset.photoNote)].note = input.value;
      updatePhotoCounter();
      updateReview();
    });
  });
  els.photoList.querySelectorAll('[data-photo-print]').forEach((select) => {
    select.addEventListener('change', () => {
      state.photos[Number(select.dataset.photoPrint)].printType = normalizePrintTypeId(select.value);
      renderPhotos();
      updatePhotoCounter();
      updateReview();
    });
  });
  els.photoList.querySelectorAll('[data-remove-photo]').forEach((button) => {
    button.addEventListener('click', () => {
      state.photos.splice(Number(button.dataset.removePhoto), 1);
      renderPhotos();
      updatePhotoCounter();
      updateReview();
    });
  });
}

function renderPhotocardBox() {
  if (!els.photocardBox) return;
  if (!hasIncludedPhotocard()) {
    els.photocardBox.classList.add('hidden');
    els.photocardBox.innerHTML = '';
    return;
  }
  const mode = Object.keys(PHOTOCARD_MODE_LABELS).includes(state.photocard.mode)
    ? state.photocard.mode
    : 'retouched';
  const countText = getIncludedPhotocardCount() > 1 ? `${getIncludedPhotocardCount()}장 제작` : '1장 제작';
  const modeCards = Object.entries(PHOTOCARD_MODE_LABELS).map(([value, label]) => {
    const help = value === 'retouched'
      ? '최종 보정본 중 2장을 앞면과 뒷면에 사용합니다.'
      : value === 'mixed'
        ? '한 면은 보정본, 한 면은 원본 사진으로 구성합니다.'
        : '원본 사진 2장을 보정 없이 사용합니다.';
    return `
      <label class="radio-card photocard-mode-card${mode === value ? ' active' : ''}">
        <input type="radio" name="photocardMode" value="${value}"${mode === value ? ' checked' : ''}>
        <span><b>${escapeHtml(label)}</b><small>${escapeHtml(help)}</small></span>
      </label>
    `;
  }).join('');

  els.photocardBox.classList.remove('hidden');
  els.photocardBox.innerHTML = `
    <div class="detail-title">포함 포토카드 사진 선택</div>
    <div class="guide-copy">프로모션에 포함된 양면 포토카드입니다. 앞면과 뒷면에 사용할 사진 번호를 입력해 주세요. (${countText})</div>
    <div class="photocard-mode-grid">${modeCards}</div>
    <div class="entry-grid photocard-fields">
      <div class="field">
        <label>앞면 사진 번호</label>
        <input data-photocard-side="frontNum" value="${escapeHtml(state.photocard.frontNum || '')}" placeholder="예: 0023">
      </div>
      <div class="field">
        <label>뒷면 사진 번호</label>
        <input data-photocard-side="backNum" value="${escapeHtml(state.photocard.backNum || '')}" placeholder="예: 0045">
      </div>
      <div class="field-full">
        <label>포토카드 메모</label>
        <textarea data-photocard-note placeholder="방향, 레터링, 보정/원본 면 지정 등 메모가 있으면 적어 주세요.">${escapeHtml(state.photocard.note || '')}</textarea>
      </div>
    </div>
  `;

  els.photocardBox.querySelectorAll('input[name="photocardMode"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.photocard.mode = input.value;
      renderPhotocardBox();
      updateReview();
    });
  });
  els.photocardBox.querySelectorAll('[data-photocard-side]').forEach((input) => {
    input.addEventListener('input', () => {
      state.photocard[input.dataset.photocardSide] = input.value;
      updateReview();
    });
  });
  els.photocardBox.querySelector('[data-photocard-note]')?.addEventListener('input', (event) => {
    state.photocard.note = event.target.value;
    updateReview();
  });
}

function updatePhotoCounter() {
  const selected = state.photos.length;
  const base = Number(state.session?.baseRetouchCount || 0);
  const extra = getRetouchExtraCount();
  const retouchPrice = Number(state.session?.retouchPrice || 0);
  const serviceCuts = getServiceCutCount();
  els.photoCounter.textContent = `${selected}장 선택됨 / 기본 ${base}장${serviceCuts > 0 ? ` + 서비스 ${serviceCuts}장` : ''}`;
  els.photoCounterSub.textContent = '보너스 사진이 포함되면 총 선택 장수에 함께 표시됩니다.';
  els.extraCost.textContent = extra > 0 ? `추가 ${extra}장 × €${retouchPrice} = €${extra * retouchPrice}` : '추가 보정 비용 없음';
}

function addPrintRow() {
  state.prints.push({ photoNum: '', printId: 'basic_10x15', qty: 1 });
  renderPrints();
  updateReview();
}

function renderPrints() {
  if (!state.prints.length) {
    els.printList.innerHTML = '<div class="empty-state">추가 인화 주문이 없습니다.</div>';
    return;
  }
  els.printList.innerHTML = state.prints.map((print, index) => {
    const option = getSelectablePrintOptions().find((item) => item.id === print.printId) || getSelectablePrintOptions()[0];
    const total = option.additional * (Number(print.qty) || 1);
    return `
      <div class="entry-card">
        <div class="entry-head">
          <div class="entry-label">추가 인화 #${index + 1}</div>
          <button type="button" class="remove-btn" data-remove-print="${index}">삭제</button>
        </div>
        <div class="entry-grid">
          <div class="field">
            <label>사진 번호</label>
            <input data-print-photo="${index}" value="${escapeHtml(print.photoNum || '')}" placeholder="예: 0045">
          </div>
          <div class="field">
            <label>수량</label>
            <input data-print-qty="${index}" type="number" min="1" value="${escapeHtml(print.qty || 1)}">
          </div>
          <div class="field-full">
            <label>용지 종류</label>
            <select data-print-type="${index}">
              ${getSelectablePrintOptions().map((item) => `<option value="${item.id}"${item.id === print.printId ? ' selected' : ''}>${escapeHtml(item.label)} — €${item.additional}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="price-line">
          <span>추가 인화 비용</span>
          <strong class="paid">€${total}</strong>
        </div>
      </div>
    `;
  }).join('');

  els.printList.querySelectorAll('[data-print-photo]').forEach((input) => {
    input.addEventListener('input', () => {
      state.prints[Number(input.dataset.printPhoto)].photoNum = input.value;
      updateReview();
    });
  });
  els.printList.querySelectorAll('[data-print-qty]').forEach((input) => {
    input.addEventListener('input', () => {
      state.prints[Number(input.dataset.printQty)].qty = Math.max(1, Number(input.value) || 1);
      renderPrints();
      updateReview();
    });
  });
  els.printList.querySelectorAll('[data-print-type]').forEach((select) => {
    select.addEventListener('change', () => {
      state.prints[Number(select.dataset.printType)].printId = select.value;
      renderPrints();
      updateReview();
    });
  });
  els.printList.querySelectorAll('[data-remove-print]').forEach((button) => {
    button.addEventListener('click', () => {
      state.prints.splice(Number(button.dataset.removePrint), 1);
      renderPrints();
      updateReview();
    });
  });
}

function buildPickupCacheKey(year, month) {
  return `${year}_${month}`;
}

async function ensurePickupCalendarLoaded() {
  const key = buildPickupCacheKey(state.pickupCalendarYear, state.pickupCalendarMonth);
  if (!state.pickupCalendarCache.has(key)) {
    const calendar = await fetchSelectPickupCalendar(state.pickupCalendarYear, state.pickupCalendarMonth);
    state.pickupCalendarCache.set(key, calendar || { unavail: [], slotCounts: {}, slotsByDate: {} });
  }
  renderPickupCalendar();
}

async function movePickupMonth(offset) {
  const next = new Date(state.pickupCalendarYear, state.pickupCalendarMonth + offset, 1);
  state.pickupCalendarYear = next.getFullYear();
  state.pickupCalendarMonth = next.getMonth();
  await ensurePickupCalendarLoaded();
  if (state.pickupDate && !state.pickupDate.startsWith(`${state.pickupCalendarYear}-${pad2(state.pickupCalendarMonth + 1)}`)) {
    renderPickupSlots([]);
  }
}

function renderPickupCalendar() {
  if (!els.pickupMonthLabel || !els.pickupCalendarGrid) return;
  const key = buildPickupCacheKey(state.pickupCalendarYear, state.pickupCalendarMonth);
  const calendar = state.pickupCalendarCache.get(key) || { unavail: [], slotCounts: {}, slotsByDate: {} };
  const unavailable = new Set(Array.isArray(calendar.unavail) ? calendar.unavail : []);
  const slotCounts = calendar.slotCounts || {};
  const firstWeekday = new Date(state.pickupCalendarYear, state.pickupCalendarMonth, 1).getDay();
  const daysInMonth = new Date(state.pickupCalendarYear, state.pickupCalendarMonth + 1, 0).getDate();
  const cells = [];

  els.pickupMonthLabel.textContent = formatMonthLabel(state.pickupCalendarYear, state.pickupCalendarMonth);
  els.pickupCalendarStatus.textContent = '외부 일정으로 스튜디오에 있는 시간만 표시됩니다.';

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push('<div class="pickup-day is-empty" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = `${state.pickupCalendarYear}-${pad2(state.pickupCalendarMonth + 1)}-${pad2(day)}`;
    const isDisabled = unavailable.has(dateStr);
    const isSelected = state.pickupDate === dateStr;
    const slotCount = Number(slotCounts[dateStr] || 0);
    cells.push(`
      <button type="button" class="pickup-day${isDisabled ? ' is-disabled' : ''}${isSelected ? ' selected' : ''}" data-pickup-date="${dateStr}" ${isDisabled ? 'disabled' : ''}>
        <span>${day}</span>
        ${slotCount ? `<small>${slotCount}개</small>` : ''}
      </button>
    `);
  }

  els.pickupCalendarGrid.innerHTML = cells.join('');
  els.pickupCalendarGrid.querySelectorAll('[data-pickup-date]').forEach((button) => {
    button.addEventListener('click', () => selectPickupDate(button.dataset.pickupDate));
  });
}

async function selectPickupDate(date) {
  state.pickupDate = date;
  state.pickupTime = '';
  renderPickupCalendar();
  await loadPickupSlots(date);
  updateReview();
}

async function loadPickupSlots(date) {
  const key = buildPickupCacheKey(state.pickupCalendarYear, state.pickupCalendarMonth);
  const calendar = state.pickupCalendarCache.get(key) || {};
  const monthSlots = calendar.slotsByDate || {};
  const slots = monthSlots[date] || await fetchSelectPickupSlots(date, state.pickupEventId);
  state.pickupSlots = Array.isArray(slots) ? slots : [];
  if (state.pickupTime && !state.pickupSlots.includes(state.pickupTime)) {
    state.pickupTime = '';
  }
  if (calendar && !calendar.slotsByDate) {
    calendar.slotsByDate = monthSlots;
  }
  if (calendar && monthSlots && !monthSlots[date]) {
    monthSlots[date] = state.pickupSlots;
  }
  if (calendar) {
    const unavailable = Array.isArray(calendar.unavail) ? new Set(calendar.unavail) : new Set();
    const slotCounts = calendar.slotCounts || {};
    if (state.pickupSlots.length) {
      unavailable.delete(date);
      slotCounts[date] = state.pickupSlots.length;
    } else {
      unavailable.add(date);
      delete slotCounts[date];
    }
    calendar.unavail = Array.from(unavailable);
    calendar.slotCounts = slotCounts;
    state.pickupCalendarCache.set(key, calendar);
  }
  els.pickupSlotHint.textContent = state.pickupDate
    ? `${state.pickupDate} 픽업 가능 시간입니다.`
    : '날짜를 선택하면 픽업 가능한 시간이 표시됩니다.';
  renderPickupCalendar();
  renderPickupSlots(state.pickupSlots);
}

function renderPickupSlots(slots) {
  const list = Array.isArray(slots) ? slots : [];
  if (!list.length) {
    els.pickupSlotGrid.innerHTML = `<div class="empty-state">${state.pickupDate ? '선택한 날짜에 가능한 픽업 시간이 없습니다.' : '아직 선택한 날짜가 없습니다.'}</div>`;
    return;
  }
  els.pickupSlotGrid.innerHTML = list.map((time) => `
    <button type="button" class="pickup-slot-btn${state.pickupTime === time ? ' selected' : ''}" data-pickup-time="${escapeHtml(time)}">${escapeHtml(time)}</button>
  `).join('');
  els.pickupSlotGrid.querySelectorAll('[data-pickup-time]').forEach((button) => {
    button.addEventListener('click', () => {
      state.pickupTime = button.dataset.pickupTime;
      renderPickupSlots(state.pickupSlots);
      updateReview();
    });
  });
}

function getDeliveryReviewText() {
  if (!requiresDeliverySelection()) return '출력물 수령 없음';
  if (state.deliveryMethod === 'pickup') {
    if (state.pickupDate && state.pickupTime) return `스튜디오 픽업 · ${state.pickupDate} ${state.pickupTime}`;
    return '스튜디오 픽업 · 날짜와 시간을 선택해 주세요.';
  }
  if (state.deliveryMethod === 'mail') {
    const mailName = getMailNameForSubmission();
    const mailAddress = getMailAddressForSubmission();
    if (!mailName && !mailAddress) return '우편 수령 · 성함과 주소를 입력해 주세요.';
    if (!mailName) return '우편 수령 · 받으실 분 성함을 입력해 주세요.';
    if (!mailAddress) return '우편 수령 · 주소를 입력해 주세요.';
    return `우편 수령 · ${mailName} · ${formatMailAddressForReview(mailAddress)}`;
  }
  return '아직 수령 방식을 선택하지 않았습니다.';
}

function validateDeliverySelection() {
  if (!requiresDeliverySelection()) return true;
  if (!state.deliveryMethod) {
    setBanner('수령 방식을 먼저 선택해 주세요.', 'error');
    return false;
  }
  if (state.deliveryMethod === 'pickup') {
    if (!state.pickupDate || !state.pickupTime) {
      setBanner('픽업 날짜와 시간을 모두 선택해 주세요.', 'error');
      return false;
    }
    return true;
  }
  const mailName = getMailNameForSubmission();
  const mailAddress = getMailAddressForSubmission();
  if (!mailName) {
    setBanner('우편 수령 받으실 분 성함을 입력해 주세요.', 'error');
    return false;
  }
  if (!mailAddress) {
    setBanner('우편 수령 주소를 입력해 주세요.', 'error');
    return false;
  }
  if (!hasMailAddressPostalCity(mailAddress)) {
    setBanner('우편 주소에 우편번호와 도시를 함께 입력해 주세요. 예: 61440 Oberursel', 'error');
    return false;
  }
  state.mailName = mailName;
  state.mailAddress = mailAddress;
  if (els.mailNameInput) els.mailNameInput.value = mailName;
  if (els.mailAddressInput) els.mailAddressInput.value = mailAddress;
  return true;
}

function updateReview() {
  const base = Number(state.session?.baseRetouchCount || 0);
  const retouchPrice = Number(state.session?.retouchPrice || 0);

  els.reviewPhotos.innerHTML = state.photos.length
    ? state.photos.map((photo, index) => {
        const printType = normalizePrintTypeId(photo.printType);
        const option = PRINT_OPTIONS.find((item) => item.id === printType) || PRINT_OPTIONS[0];
        const extra = !photo.isBonus && index >= base ? `+€${retouchPrice}` : (photo.isBonus ? '보너스' : '포함');
        const includedPrint = !photo.isBonus && isPrintFreeByQuota(index, printType);
        const free = photo.isBonus || option.retouched === 0 || includedPrint;
        const printCostText = photo.isBonus ? '무료 · 마케팅 보너스' : (includedPrint ? '무료 · 기본 제공' : (free ? '무료' : `+€${option.retouched}`));
        return `
          <div class="review-item">
            <div>
              <strong>${escapeHtml(photo.num || `사진 ${index + 1}`)}</strong>
              <div class="review-note">${escapeHtml(photo.note || '')}</div>
            </div>
            <div style="text-align:right;">
              <div>${escapeHtml(option.label)}</div>
              <div class="review-note">${printCostText} / ${extra}</div>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state">선택된 보정 사진이 없습니다.</div>';

  els.reviewPrints.innerHTML = state.prints.length
    ? state.prints.map((print) => {
        const option = getSelectablePrintOptions().find((item) => item.id === print.printId) || getSelectablePrintOptions()[0];
        return `
          <div class="review-item">
            <span>${escapeHtml(print.photoNum || '-')} · ${escapeHtml(option.label)} × ${escapeHtml(print.qty || 1)}</span>
            <strong>€${option.additional * (Number(print.qty) || 1)}</strong>
          </div>
        `;
      }).join('')
    : '<div class="empty-state">추가 인화 없음</div>';

  if (els.reviewPhotocardBlock && els.reviewPhotocard) {
    const visible = hasIncludedPhotocard();
    els.reviewPhotocardBlock.classList.toggle('hidden', !visible);
    els.reviewPhotocard.textContent = visible ? getPhotocardReviewText() : '';
  }
  els.reviewMarketing.textContent = state.marketing === 'Y' ? '동의' : '미동의';
  syncDeliveryUi();
  if (els.reviewDelivery) els.reviewDelivery.textContent = requiresDeliverySelection() ? getDeliveryReviewText() : '';
  els.reviewTotal.textContent = calcTotal() === 0 ? '무료' : `€${calcTotal()}`;
  updateSubmitState();
  renderStepWarnings();
}

function validateStep1() {
  if (!state.marketing) {
    setBanner('마케팅 동의 여부를 먼저 선택해 주세요.', 'error');
    return false;
  }
  if (!state.photos.length) {
    setBanner('보정 사진을 최소 1장 선택해 주세요.', 'error');
    return false;
  }
  const invalid = state.photos.findIndex((photo) => !String(photo.num || '').trim() || !String(photo.note || '').trim());
  if (invalid >= 0) {
    setBanner(`${invalid + 1}번째 보정 사진의 번호와 요청사항을 입력해 주세요.`, 'error');
    return false;
  }
  const photocardWarning = getPhotocardWarning();
  if (photocardWarning) {
    setBanner(photocardWarning, 'error');
    return false;
  }
  return true;
}

function validateStep2() {
  const invalid = state.prints.findIndex((print) => !String(print.photoNum || '').trim());
  if (invalid >= 0) {
    setBanner(`${invalid + 1}번째 추가 인화의 사진 번호를 입력해 주세요.`, 'error');
    return false;
  }
  return true;
}

function goStep(step) {
  if (step === 2 && !validateStep1()) return;
  if (step === 3 && !validateStep2()) return;
  if (state.submitted) return;
  state.step = step;
  els.progressRow.classList.remove('hidden');
  els.stepPanels.forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.step) === step));
  els.stepPanels.forEach((panel) => panel.classList.remove('hidden'));
  els.stepDots.forEach((dot, index) => {
    dot.className = `step-dot${index === step ? ' active' : index < step ? ' done' : ''}`;
  });
  if (step === 3) updateReview();
  globalThis.scrollTo({ top: 0, behavior: 'smooth' });
}

function canSubmit() {
  if (!state.marketing) return false;
  if (!state.photos.length) return false;
  if (state.photos.some((photo) => !String(photo.num || '').trim() || !String(photo.note || '').trim())) return false;
  if (getPhotocardWarning()) return false;
  if (state.prints.some((print) => !String(print.photoNum || '').trim())) return false;
  if (!requiresDeliverySelection()) return true;
  if (!state.deliveryMethod) return false;
  if (state.deliveryMethod === 'pickup' && (!state.pickupDate || !state.pickupTime)) return false;
  if (state.deliveryMethod === 'mail') {
    const mailName = getMailNameForSubmission();
    const mailAddress = getMailAddressForSubmission();
    if (!mailName || !mailAddress || !hasMailAddressPostalCity(mailAddress)) return false;
  }
  return true;
}

function updateSubmitState() {
  if (els.step1NextBtn) els.step1NextBtn.disabled = !canProceedStep1();
  if (els.step2NextBtn) els.step2NextBtn.disabled = !canProceedStep2();
  els.submitBtn.disabled = !canSubmit() || state.submitted;
  renderStepWarnings();
}

function canProceedStep1() {
  return !!state.marketing
    && state.photos.length > 0
    && !state.photos.some((photo) => !String(photo.num || '').trim() || !String(photo.note || '').trim())
    && !getPhotocardWarning();
}

function canProceedStep2() {
  return !state.prints.some((print) => !String(print.photoNum || '').trim());
}

function renderStepWarnings() {
  const step1Message = canProceedStep1()
    ? ''
    : !state.marketing
      ? '마케팅 동의 여부를 먼저 선택해 주세요.'
      : !state.photos.length
        ? '보정 사진을 최소 1장 추가해야 다음 단계로 이동할 수 있습니다.'
        : getPhotocardWarning()
          ? getPhotocardWarning()
          : '보정 사진의 번호와 요청사항을 모두 입력해야 다음 버튼이 활성화됩니다.';
  const step2Message = canProceedStep2()
    ? ''
    : '추가 인화의 사진 번호를 모두 입력해야 다음 단계로 이동할 수 있습니다.';
  const step3Message = canSubmit()
    ? ''
    : !requiresDeliverySelection()
      ? '제출 전 보정 선택, 추가 인화, 마케팅 동의 상태를 다시 확인해 주세요.'
      : !state.deliveryMethod
      ? '수령 방식을 선택해야 제출할 수 있습니다.'
      : state.deliveryMethod === 'pickup' && (!state.pickupDate || !state.pickupTime)
        ? '픽업 날짜와 시간을 선택해야 제출할 수 있습니다.'
        : state.deliveryMethod === 'mail' && !getMailNameForSubmission()
          ? '우편 수령 받으실 분 성함을 입력해야 제출할 수 있습니다.'
        : state.deliveryMethod === 'mail' && !getMailAddressForSubmission()
          ? '우편 수령 주소를 입력해야 제출할 수 있습니다.'
          : state.deliveryMethod === 'mail' && !hasMailAddressPostalCity(getMailAddressForSubmission())
            ? '우편 주소에 우편번호와 도시를 함께 입력해 주세요. 예: 61440 Oberursel'
            : '제출 전 보정 선택, 추가 인화, 마케팅 동의 상태를 다시 확인해 주세요.';

  if (els.stepWarnings.step1) els.stepWarnings.step1.textContent = step1Message;
  if (els.stepWarnings.step2) els.stepWarnings.step2.textContent = step2Message;
  if (els.stepWarnings.step3) els.stepWarnings.step3.textContent = step3Message;
}

async function onSubmit() {
  if (!validateStep1() || !validateStep2() || !validateDeliverySelection()) return;
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = state.editMode ? '수정 제출 중...' : '제출 중...';
  const deliveryRequired = requiresDeliverySelection();
  const payload = {
    photos: state.photos,
    prints: [
      ...state.prints.map((print) => {
        const option = getSelectablePrintOptions().find((item) => item.id === print.printId) || getSelectablePrintOptions()[0];
        return {
          ...print,
          label: option.label,
          price: option.additional,
          isRetouched: false
        };
      }),
      ...(() => {
        const fallback = getPhotocardPrintFallbackPayload();
        return fallback ? [fallback] : [];
      })(),
      ...state.photos
        .filter((photo) => photo.isBonus && getBonusPrintUpcharge(photo) > 0)
        .map((photo) => {
          const typeId = normalizePrintTypeId(photo.printType);
          const option = PRINT_OPTIONS.find((item) => item.id === typeId);
          return {
            photoNum: String(photo.num || '-').trim() || '-',
            printId: `uplift_${typeId}`,
            label: `${option ? option.label : typeId} 업그레이드 차액 (${photo.isService ? '서비스 컷' : '마케팅 보너스'})`,
            price: getBonusPrintUpcharge(photo),
            qty: 1,
            isRetouched: true
          };
        })
    ],
    marketing: state.marketing,
    deliveryMethod: deliveryRequired ? state.deliveryMethod : 'none',
    pickupDate: deliveryRequired && state.deliveryMethod === 'pickup' ? state.pickupDate : '',
    pickupTime: deliveryRequired && state.deliveryMethod === 'pickup' ? state.pickupTime : '',
    mailName: deliveryRequired && state.deliveryMethod === 'mail' ? getMailNameForSubmission() : '',
    mailAddress: deliveryRequired && state.deliveryMethod === 'mail' ? getMailAddressForSubmission() : '',
    photocard: getPhotocardPayload(),
    suppressCustomerEmail: state.testMode
  };
  try {
    const requestId = createRequestId(state.editMode ? 'select_update' : 'select_submit');
    const result = state.editMode
      ? await updateSelectSession(state.sessionId, payload, requestId)
      : await submitSelectSession(state.sessionId, payload, requestId);
    setBanner(state.editMode ? '수정 제출이 완료됐습니다.' : '셀렉 제출이 완료됐습니다.', 'success');
    renderSuccess(result);
  } catch (error) {
    console.error(error);
    setBanner(`셀렉 제출 실패: ${error.message}`, 'error');
  } finally {
    if (!state.submitted) {
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = state.editMode ? '수정 제출' : '제출';
    }
  }
}

function setBanner(message, variant) {
  els.banner.textContent = message;
  els.banner.className = `banner ${variant}`;
}

function renderSuccess(result) {
  state.submitted = true;
  els.progressRow.classList.add('hidden');
  els.stepPanels.forEach((panel) => panel.classList.add('hidden'));
  els.successPanel.classList.remove('hidden');
  els.successTitle.textContent = state.editMode ? '셀렉 수정이 완료되었습니다.' : '셀렉 제출이 완료되었습니다.';
  els.successCopy.textContent = calcTotal() > 0
    ? '추가 비용이 포함된 선택 내용이 저장되었습니다. 인보이스와 함께 후속 안내를 보내드립니다.'
    : '선택 내용이 정상적으로 저장되었습니다. 담당자가 순서대로 확인한 뒤 안내를 보내드립니다.';
  els.successName.textContent = state.session?.name || '-';
  els.successProduct.textContent = state.session?.product || '-';
  els.successPhotoCount.textContent = `${state.photos.length}장`;
  const finalTotal = Number(result?.totalExtra ?? calcTotal());
  els.successTotal.textContent = finalTotal === 0 ? '무료' : `€${finalTotal}`;
  const deliverySummaryLine = requiresDeliverySelection()
    ? `<div class="guide-copy">수령 방식: ${escapeHtml(getDeliveryReviewText())}</div>`
    : '';
  els.successGuide.innerHTML = `
    <div class="detail-title">선택 요약</div>
    <div class="guide-copy">보정 선택 ${state.photos.length}장 · 추가 인화 ${state.prints.length}건 · 마케팅 동의 ${state.marketing === 'Y' ? '동의' : '미동의'}</div>
    ${deliverySummaryLine}
    ${result?.invoiceNumber ? `<div class="guide-copy">추가 비용 인보이스: <b>${escapeHtml(result.invoiceNumber)}</b></div>` : ''}
  `;
  if (state.session?.driveLink) {
    els.successDriveLink.href = state.session.driveLink;
    els.successDriveLink.classList.remove('hidden');
  }
  globalThis.scrollTo({ top: 0, behavior: 'smooth' });
}
