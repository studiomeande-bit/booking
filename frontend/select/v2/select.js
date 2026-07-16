import {
  fetchSelectPreviewPhotos,
  fetchSelectPhotos,
  fetchSelectPickupCalendar,
  fetchSelectPickupSlots,
  fetchSelectSession,
  submitSelectSession,
  updateSelectSession
} from '../../shared/api-select.js';
import {
  PRINT_NONE_ID,
  getProductDeliveryLines,
  getProductIncludedPrintQuota,
  getProductIncludedPrintSummary,
  productHasFixedDeliverySpec,
  productHasIncludedPrints
} from '../../shared/product-delivery.js';
import { createRequestId, escapeHtml, formatMonthLabel, pad2 } from '../../shared/utils.js';

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

// 보정 선택과 출력 선택을 분리한 모델. 서버에 이 플래그를 함께 보낸다.
const SELECT_PRINT_MODEL = 'decoupled';

function getPrintOption(id) {
  const norm = normalizePrintTypeId(id);
  return PRINT_OPTIONS.find((item) => item.id === norm) || PRINT_OPTIONS[0];
}
function printNumKey(num) {
  return stripExt(String(num || '')).trim().toLowerCase();
}
// 출력 대상 사진이 보정 리스트에도 있으면 보정본 단가(retouched), 없으면 추가 인화가(additional).
function isRetouchedPhotoNum(num) {
  const key = printNumKey(num);
  if (!key) return false;
  return state.photos.some((p) => printNumKey(p.num) === key);
}
// 출력 리스트를 순회하며 포함 쿼터를 사이즈별로 무료 소진하고, 각 행의 무료/과금 수량과 단가를 계산.
// 백엔드 computeSelectDecoupledPrints_ 와 동일한 규칙 (서버가 최종 판정).
function computePrintAnnotations() {
  const quota = getSessionIncludedPrintQuota().map((item) => ({ id: item.id, qty: Number(item.qty) || 0 }));
  // 서비스 컷: 서비스 슬롯 번호마다 인화 1건(1장)에 €5(기본 10×15 보정본가) 크레딧. 총 크레딧은 serviceCutCount로 상한.
  // 서버 computeSelectDecoupledPrints_ 와 완전히 동일한 규칙 — 유닛(장) 단위 적용 + 상한, 인화 행 순서대로 소진.
  const serviceCredit = {};
  state.photos.forEach((p) => {
    if (!p?.isService) return;
    const k = printNumKey(p.num);
    if (k) serviceCredit[k] = (serviceCredit[k] || 0) + 1;
  });
  let serviceCreditsRemaining = getServiceCutCount();
  const basicPrintCredit = Number(getPrintOption('basic_10x15').retouched) || 0;
  return state.prints.map((print) => {
    const typeId = normalizePrintTypeId(print.printId);
    const option = getPrintOption(typeId);
    const qty = Math.max(1, Number(print.qty) || 1);
    const isRetouched = isRetouchedPhotoNum(print.photoNum);
    const unit = isRetouched ? Number(option.retouched) || 0 : Number(option.additional) || 0;
    let includedQty = 0;
    for (let k = 0; k < qty; k += 1) {
      const match = quota.find((q) => q.id === typeId && q.qty > 0);
      if (!match) break;
      match.qty -= 1;
      includedQty += 1;
    }
    const chargedQty = qty - includedQty;
    const numKey = printNumKey(print.photoNum);
    let amount = 0;
    let serviceDiscount = 0;
    let serviceCreditUnits = 0;
    for (let u = 0; u < chargedQty; u += 1) {
      let unitCharge = unit;
      if (numKey && serviceCredit[numKey] > 0 && serviceCreditsRemaining > 0 && unit > 0) {
        const disc = Math.min(unit, basicPrintCredit);
        if (disc > 0) {
          unitCharge = Math.max(0, unit - disc);
          serviceDiscount += disc;
          serviceCreditUnits += 1;
          serviceCredit[numKey] -= 1;
          serviceCreditsRemaining -= 1;
        }
      }
      amount += unitCharge;
    }
    return { option, qty, isRetouched, unit, includedQty, chargedQty, amount, serviceDiscount, serviceCreditUnits };
  });
}
// 포함 쿼터 대비 현재 사용/잔여 요약 (출력 단계 안내용).
function getPrintQuotaSummary() {
  const quota = getSessionIncludedPrintQuota();
  const used = {};
  computePrintAnnotations().forEach((ann, i) => {
    const typeId = normalizePrintTypeId(state.prints[i].printId);
    used[typeId] = (used[typeId] || 0) + ann.includedQty;
  });
  return quota.map((q) => ({
    id: q.id,
    label: getPrintOption(q.id).label,
    total: Number(q.qty) || 0,
    used: used[q.id] || 0,
    remaining: Math.max(0, (Number(q.qty) || 0) - (used[q.id] || 0))
  }));
}

const TOTAL_STEPS = 5; // 0:welcome 1:gallery 2:retouch 3:print 4:review
const GALLERY_INITIAL_RENDER = 36;
const GALLERY_RENDER_INCREMENT = 60;
const GALLERY_BATCH_SIZE = 300;
const GALLERY_BATCH_DELAY_MS = 120;
const GALLERY_CACHE_VERSION = 'batch-300-v1';
const MAIL_POSTAL_CITY_PATTERN = /(?:^|[\s,])(?:[A-Z]{1,3}-)?\d{4,5}\s+[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 .'\-()/]{1,}/i;

const state = {
  sessionId: new URLSearchParams(globalThis.location.search).get('id') || '',
  testMode: new URLSearchParams(globalThis.location.search).get('test') === '1',
  previewMode: new URLSearchParams(globalThis.location.search).get('preview') === '1',
  previewFolder: new URLSearchParams(globalThis.location.search).get('folder') || '',
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
  studioA4Dismissed: false,
  step: 0,
  submitted: false,
  gallery: {
    loaded: false,
    loading: false,
    photos: [],
    byKey: new Map(),
    filter: '',
    starFilter: 'all',
    ratings: new Map(),     // key: stripExt(name) -> star (1~5)
    filteredList: [],
    focusIndex: -1,
    renderCount: GALLERY_INITIAL_RENDER,
    warmupStarted: false,
    loadedLimit: 0,
    loadedBatches: 0,
    nextCursor: '',
    fullLoaded: false,
    hasMore: false
  },
  lightbox: null,
  lightboxImageCache: new Map(),
  lightboxRenderToken: 0
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
  marketingBonusTag: document.getElementById('marketingBonusTag'),
  marketingCopy: document.getElementById('marketingCopy'),
  marketingYesBonusLabel: document.getElementById('marketingYesBonusLabel'),
  marketingYesCard: document.getElementById('marketingYesCard'),
  marketingNoCard: document.getElementById('marketingNoCard'),
  photoCounter: document.getElementById('photoCounter'),
  photoCounterSub: document.getElementById('photoCounterSub'),
  extraCost: document.getElementById('extraCost'),
  photoList: document.getElementById('photoList'),
  photocardBox: document.getElementById('photocardBox'),
  addPhotoBtn: document.getElementById('addPhotoBtn'),
  galleryGrid: document.getElementById('galleryGrid'),
  galleryLoadingHint: document.getElementById('galleryLoadingHint'),
  gallerySearch: document.getElementById('gallerySearch'),
  galleryStatus: document.getElementById('galleryStatus'),
  galleryCount: document.getElementById('galleryCount'),
  gallerySelectedSummary: document.getElementById('gallerySelectedSummary'),
  gallerySelectDownloadAllBtn: document.getElementById('gallerySelectDownloadAllBtn'),
  starFilters: Array.from(document.querySelectorAll('[data-star-filter]')),
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
  step3NextBtn: document.getElementById('step3NextBtn'),
  stepWarnings: {
    step1: document.getElementById('step1Warning'),
    step2: document.getElementById('step2Warning'),
    step3: document.getElementById('step3Warning'),
    step4: document.getElementById('step4Warning')
  },
  stepPanels: Array.from(document.querySelectorAll('.step-panel')),
  stepDots: [0, 1, 2, 3, 4].map((i) => document.getElementById(`dot${i}`)),
  navButtons: Array.from(document.querySelectorAll('[data-go]')),
  hoverPreview: document.getElementById('hoverPreview'),
  hpImg: document.getElementById('hp-img'),
  hpCaption: document.getElementById('hp-caption')
};

boot();

async function boot() {
  wireEvents();
  if (state.previewMode) {
    try {
      const mock = buildMockSession();
      hydrateSession(mock);
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
      showPreviewBanner();
    } catch (err) {
      console.error('[preview]', err);
      showError('미리보기 초기화 실패: ' + (err.message || err));
    }
    hideLoading();
    return;
  }
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
  if (els.gallerySearch) {
    els.gallerySearch.addEventListener('input', (ev) => {
      state.gallery.filter = String(ev.target.value || '').trim().toLowerCase();
      state.gallery.renderCount = GALLERY_INITIAL_RENDER;
      renderGallery();
    });
  }
  if (els.gallerySelectDownloadAllBtn) {
    els.gallerySelectDownloadAllBtn.addEventListener('click', downloadAllPhotos);
  }
  els.starFilters.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.gallery.starFilter = btn.dataset.starFilter;
      state.gallery.renderCount = GALLERY_INITIAL_RENDER;
      els.starFilters.forEach((b) => b.classList.toggle('active', b === btn));
      renderGallery();
    });
  });
  wireLightboxOnce();
  wireGalleryKeyboard();
  wireHoverPreview();
  wireGalleryScrollOnce();
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
  scheduleGalleryWarmup();
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
  const existingPhotos = Array.isArray(session.existingPhotos) ? session.existingPhotos : [];
  state.photos = state.editMode ? existingPhotos.map(normalizePhoto) : [];
  state.studioA4Dismissed = false;
  const existingPrints = Array.isArray(session.existingPrints) ? session.existingPrints : [];
  state.prints = state.editMode
    ? buildDecoupledPrintsFromExisting(existingPhotos, existingPrints)
    : [];
  state.photocard = normalizePhotocardSelection(session.existingPhotocard || extractPhotocardFromPrints(existingPrints));
  // 기존 수정 모드에서 이미 선택된 사진들은 갤러리 별점 5점으로 복원 (갤러리 로드 후 반영)
  if (session.bookingMarketing === 'Y') state.marketing = 'Y';
  syncMarketingBonusRows();
  syncServiceCutRows();
  renderServiceCutNotice();
  renderRetouchScopeNotice();
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

function getIncludedPrintPresetTypes(session, count) {
  const total = Number(count) || 0;
  const preset = [];
  const quota = getSessionIncludedPrintQuota(session);
  quota.forEach((item) => {
    for (let i = 0; i < item.qty; i += 1) preset.push(item.id);
  });
  while (preset.length < total) preset.push(PRINT_NONE_ID);
  return preset.slice(0, total);
}

function getIncludedPrintSummary(session = state.session) {
  return getProductIncludedPrintSummary(getSessionProductInput(session), 'ko');
}

function normalizePhoto(photo) {
  const isBonus = !!photo?.isBonus;
  // 서비스 컷: 저장된 isService 또는 source==='service' 로 식별 (무료 보정 슬롯, isBonus=true 로 과금 제외).
  const isService = !!photo?.isService || String(photo?.source || '') === 'service';
  // 기존 데이터 호환: source가 없으면 서비스→service, 보너스→bonus, 아니면 manual
  const source = photo?.source || (isService ? 'service' : isBonus ? 'bonus' : 'manual');
  return {
    num: String(photo?.num || ''),
    note: String(photo?.note || ''),
    printType: normalizePrintTypeId(photo?.printType),
    isBonus,
    isService,
    source
  };
}

function normalizePrintTypeId(typeId) {
  return String(typeId || PRINT_NONE_ID).replace(/_(r|e)$/, '') || PRINT_NONE_ID;
}

function isStudioSession() {
  return String(state.session?.itemGroup || '').toLowerCase().trim() === 'stud';
}

function hasStudioIncludedA4Applied() {
  return state.photos.some((photo) => !photo.isBonus && normalizePrintTypeId(photo.printType) === 'basic_a4');
}

function syncStudioIncludedA4Default() {
  return false;
}

function renderStudioIncludedA4Notice() {
  const includedSummary = getIncludedPrintSummary();
  if (!includedSummary) return '';
  return `
    <div class="included-print-callout">
      <strong>기본 제공 출력물: ${escapeHtml(includedSummary)}</strong>
      <span>상품에 포함된 출력 사이즈가 보정 사진 목록에 미리 설정되어 있습니다. 다른 사진으로 바꾸려면 해당 사진의 인화 사이즈를 조정해 주세요.</span>
    </div>
  `;
}

function normalizePrint(print) {
  const resolvedId = resolvePrintId(print);
  return {
    photoNum: String(
      print?.photoNum ?? print?.photo ?? print?.num ?? print?.number ?? print?.photoNumber ?? ''
    ),
    printId: resolvedId,
    qty: Math.max(1, Number(print?.qty || 1) || 1)
  };
}

// 수정 모드 진입 시 기존 제출 데이터를 분리형 출력 리스트로 복원.
// - 신규(분리형) 데이터: existingPrints 가 이미 통합 리스트 → 그대로 사용
// - 레거시 데이터: 보정 사진에 붙어있던 printType 을 출력 행으로 승격 + 기존 추가 인화 병합
function buildDecoupledPrintsFromExisting(existingPhotos, existingPrints) {
  const fromPhotos = (existingPhotos || [])
    .filter((p) => !p?.isBonus && normalizePrintTypeId(p?.printType) !== PRINT_NONE_ID)
    .map((p) => ({ photoNum: String(p?.num || ''), printId: normalizePrintTypeId(p?.printType), qty: 1 }));
  const fromPrints = (existingPrints || [])
    .filter((print) => !isPhotocardFallbackPrint(print))
    .map(normalizePrint)
    .filter(hasMeaningfulPrint);
  return fromPhotos.concat(fromPrints);
}

function resolvePrintId(print) {
  const raw = String(
    print?.printId || print?.id || print?.printType || print?.type ||
    print?.paperType || print?.size || print?.label || ''
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

function hasRequestedDeliveryOutput() {
  return state.prints.some((print) => String(print?.photoNum || '').trim() || Number(print?.qty || 0) > 0)
    || hasIncludedPhotocard();
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
  els.welcomeSub.textContent = state.editMode
    ? '이미 제출한 내용을 불러왔어요. 단계별로 다시 살펴보고 수정한 뒤 제출해 주세요.'
    : '아래 단계별 안내를 확인한 뒤 편하게 진행하시면 됩니다.';
  if (state.testMode) {
    els.submitHint.textContent = state.editMode
      ? '테스트 모드입니다. 고객 메일은 발송되지 않고 수정 제출만 검증합니다.'
      : '테스트 모드입니다. 고객 메일은 발송되지 않고 제출 흐름만 검증합니다.';
    return;
  }
  els.submitHint.textContent = state.editMode
    ? '수정 제출 모드입니다. 변경 내용을 확인한 뒤 다시 제출해 주세요.'
    : '모든 확인이 끝나면 제출해 주세요. 제출 이후에도 마감일 전까지는 수정이 가능합니다.';
}

function renderSessionSummary() {
  const s = state.session;
  els.sessionSummary.innerHTML = `
    <div class="summary-item"><div class="summary-label">고객명</div><div class="summary-value">${escapeHtml(s.name || '')}</div></div>
    <div class="summary-item"><div class="summary-label">상품</div><div class="summary-value">${escapeHtml(s.product || '')}</div></div>
    <div class="summary-item"><div class="summary-label">촬영일</div><div class="summary-value">${escapeHtml(s.date || '')}</div></div>
    <div class="summary-item"><div class="summary-label">기본 보정</div><div class="summary-value">${escapeHtml(s.baseRetouchCount || 0)}장</div></div>
    ${getServiceCutCount() > 0 ? `<div class="summary-item service"><div class="summary-label">서비스 컷</div><div class="summary-value">🎁 ${getServiceCutCount()}장 무료</div></div>` : ''}
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
    ${getServiceCutCount() > 0 ? `<div class="guide-copy service-cut-inline">🎁 스튜디오 <b>서비스 컷 ${getServiceCutCount()}장</b> 추가 증정 — 보정 무료 + 기본 10×15cm 인화 1장씩 포함 (보정 단계에서 사진 번호만 넣어 주세요)</div>` : ''}
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
  const raw = state.session?.marketingBonusCount;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 2;
}

function makeBonusPhoto() {
  return { num: '', note: '', printType: PRINT_NONE_ID, isBonus: true, source: 'bonus' };
}

function syncMarketingBonusRows() {
  const bonusCount = getMarketingBonusCount();
  const bonusIndexes = state.photos
    .map((photo, index) => (photo.isBonus && !photo.isService ? index : -1))
    .filter((index) => index >= 0);
  if (state.marketing === 'Y') {
    for (let i = bonusIndexes.length; i < bonusCount; i += 1) state.photos.push(makeBonusPhoto());
    if (bonusIndexes.length > bonusCount) {
      let removeCount = bonusIndexes.length - bonusCount;
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

function getServiceCutCount() {
  const n = Number(state.session?.serviceCutCount);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/* ===== 보정 범위 제한 (야외/홈스냅 · 마이리얼트립) =====
 * 스냅 계열은 간단 보정(피부·미백·잔머리·옷 라인·색감)만 기본 포함.
 * 신체 합성·하늘 합성·의상 주름 제거 등 디테일 작업은 기본 범위 밖 — 접수 후 개별 안내. */
const RETOUCH_SCOPE_LIMITED_GROUPS = ['snap', '마이리얼트립'];
const RETOUCH_SCOPE_WARN_RE = /합성|하늘|스카이|sky|체형|몸매|다리\s*길|비율\s*보정|주름/i;

function isRetouchScopeLimited() {
  const g = String(state.session?.itemGroup || '').trim().toLowerCase();
  return RETOUCH_SCOPE_LIMITED_GROUPS.some((k) => g === k.toLowerCase());
}

function retouchScopeNoticeHtml(compact) {
  return `
    <div class="detail-title">✂️ 보정 범위 안내 (야외/홈스냅·여행스냅)</div>
    <div class="guide-copy">스냅 촬영의 기본 보정은 <b>간단 보정</b> 기준이에요.</div>
    <div class="guide-examples">
      <div class="guide-ex good">
        <div class="guide-ex-head">기본 보정에 포함</div>
        <ul>
          <li>피부 보정 · 잡티 정리 · 미백(피부 톤)</li>
          <li>잔머리 정리</li>
          <li>옷 라인(실루엣) 정리</li>
          <li>전체 색감 · 밝기 보정</li>
        </ul>
      </div>
      <div class="guide-ex bad">
        <div class="guide-ex-head">기본 범위에서 제외 (디테일 작업)</div>
        <ul>
          <li>신체 비율·체형 보정(합성)</li>
          <li>하늘/배경 합성·교체</li>
          <li>의상 주름 제거 등 디테일 리터칭</li>
        </ul>
      </div>
    </div>
    ${compact ? '' : '<div class="guide-copy lettering-note">제외 항목이 꼭 필요하시면 요청사항에 적어 주세요 — <b>가능 여부와 추가 비용을 접수 후 개별 안내</b>드립니다.</div>'}
  `;
}

function renderRetouchScopeNotice() {
  const box1 = document.getElementById('retouchScopeBox');
  const box2 = document.getElementById('retouchScopeBox2');
  const limited = isRetouchScopeLimited();
  [box1, box2].forEach((box, i) => {
    if (!box) return;
    if (!limited) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    box.innerHTML = retouchScopeNoticeHtml(i === 1);
  });
  // 정적 가이드의 "옷 주름 펴기" 예시는 스냅 기본 범위 밖 — 허용 범위 예시로 교체
  if (limited) {
    document.querySelectorAll('.ex-good-wrinkle').forEach((li) => {
      li.textContent = li.textContent.includes('0031')
        ? '“0031번: 바람에 날린 잔머리를 정리하고, 전체 색감을 조금 따뜻하게 맞춰 주세요.”'
        : '“잔머리를 정리하고, 전체 색감을 따뜻하게 맞춰 주세요.”';
    });
  }
}

function retouchNotePlaceholder() {
  return isRetouchScopeLimited()
    ? '예: 피부 잡티 정리와 미백(원래 피부결 유지). / 잔머리 정리. / 전체 색감을 따뜻하게.'
    : '예: 턱선을 살짝만 갸름하게 정리(원래 얼굴형 유지). / 이마 번들거림 줄이고 피부 톤 고르게(점·주근깨 살리기). / 어깨·가슴 옷 주름 펴기(실루엣 유지).';
}

function syncRetouchScopeHint(textarea) {
  if (!isRetouchScopeLimited()) return;
  const row = textarea.closest('.field-full');
  if (!row) return;
  let hint = row.querySelector('.scope-hint');
  const flagged = RETOUCH_SCOPE_WARN_RE.test(String(textarea.value || ''));
  if (flagged && !hint) {
    hint = document.createElement('div');
    hint.className = 'scope-hint';
    hint.textContent = '⚠️ 신체·하늘 합성, 의상 주름 제거 등은 스냅 기본 보정 범위 밖이에요 — 접수 후 가능 여부와 추가 비용을 개별 안내드립니다.';
    row.appendChild(hint);
  } else if (!flagged && hint) {
    hint.remove();
  }
}

// 서비스 컷: 무료 보정 슬롯(디커플드 모델 — 출력 자동 포함 없음).
// isBonus=true 로 과금/기본장수에서 제외, isService=true 로 마케팅 보너스와 구분, source='service'.
function makeServicePhoto() {
  return { num: '', note: '', printType: PRINT_NONE_ID, isBonus: true, isService: true, source: 'service' };
}

// 어드민이 설정한 서비스컷수만큼 무료 슬롯 자동 유지 (0이면 아무 흔적 없음).
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
  box.innerHTML = `<div class="service-cut-title">🎁 스튜디오 서비스 컷 ${count}장</div><div class="service-cut-copy">감사의 마음을 담아 준비했어요. 아래 보정 목록의 <b>서비스 컷</b> 슬롯에 원하시는 사진 번호와 보정 요청사항을 넣어 주세요. 서비스 컷 보정은 <b>무료</b>이며 기본 보정 장수에 포함되지 않습니다.<br>또한 서비스 컷 사진마다 <b>기본 10×15cm 인화 1장이 무료로 포함</b>돼요. 다음 <b>출력 선택</b> 단계에서 같은 사진 번호로 인화를 주문하면 10×15는 무료, 더 큰 사이즈는 <b>차액만</b> 청구됩니다.</div>`;
}

function updateMarketingCopy() {
  const count = getMarketingBonusCount();
  const countLabel = count > 0 ? `${count}장` : '없음';
  if (els.marketingBonusTag) {
    els.marketingBonusTag.textContent = count > 0 ? `+ 보정 ${countLabel} 무료 추가` : '보너스 없음';
  }
  if (els.marketingYesBonusLabel) {
    els.marketingYesBonusLabel.textContent = count > 0 ? `(＋ 보너스 보정 ${countLabel} 무료)` : '(추가 보너스 없음)';
  }
  if (!els.marketingCopy) return;
  if (state.session?.bookingMarketing === 'Y') {
    els.marketingCopy.textContent = count > 0
      ? `예약 단계에서 이미 포트폴리오 및 SNS 활용에 동의해 주셨어요. 보너스 보정 ${countLabel}이 무료로 추가됩니다.`
      : '예약 단계에서 이미 포트폴리오 및 SNS 활용에 동의해 주셨어요. 아래에서 다시 한 번 확인만 해주시면 됩니다.';
    return;
  }
  els.marketingCopy.innerHTML = count > 0
    ? `선택해 주신 사진이 Studio mean의 포트폴리오·SNS 예시 이미지로 소개되어도 괜찮은지 편하게 선택해 주세요. <b>동의해 주시면 보너스 보정 ${countLabel}이 무료로 추가</b>됩니다. 원치 않으시면 미동의를 선택하시면 됩니다.`
    : '선택해 주신 사진이 Studio mean의 포트폴리오·SNS 예시 이미지로 소개되어도 괜찮은지 편하게 선택해 주세요. 원치 않으시면 미동의를 선택하시면 됩니다.';
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
  updateMarketingCopy();
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
      ? '선택 내용을 확인하고 수령 방식을 선택한 뒤 제출해 주세요. 제출 후에도 마감일 전까지는 수정 가능합니다.'
      : '출력물 수령이 없는 상품입니다. 선택 내용을 확인한 뒤 제출해 주세요. 제출 후에도 마감일 전까지는 수정 가능합니다.';
  }
}

function getQuotaMap() {
  return getSessionIncludedPrintQuota().map((item) => ({ ...item }));
}

function getRegularPhotos() {
  return state.photos.filter((photo) => !photo.isBonus);
}

// 마케팅 보너스를 제외한 보정 선택 수가 기본 포함 장수를 초과하면 유료.
// 갤러리 별점 선택과 직접 추가 모두 같은 기준으로 계산한다.
function getRetouchExtraCount() {
  const included = Number(state.session?.baseRetouchCount || 0);
  let nonBonusIndex = 0;
  let paid = 0;
  state.photos.forEach((p) => {
    if (p.isBonus) return;
    nonBonusIndex += 1;
    if (nonBonusIndex > included) paid += 1;
  });
  return paid;
}

// 해당 사진 항목이 유료(+€)인지 판정
function isPhotoPaid(photo, photoIndex) {
  if (photo.isBonus) return false;
  const included = Number(state.session?.baseRetouchCount || 0);
  let nonBonusPosition = 0;
  for (let i = 0; i <= photoIndex; i += 1) {
    if (!state.photos[i].isBonus) nonBonusPosition += 1;
  }
  return nonBonusPosition > included;
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
  const printCharge = computePrintAnnotations().reduce((sum, ann) => sum + ann.amount, 0);
  return extraRetouch + printCharge;
}

/* ========================================================================
 * 갤러리 (1차 셀렉 — 별점 분류)
 * ====================================================================== */

async function loadGallery(options = {}) {
  const force = !!options.force;
  if (state.gallery.loading) return;
  if (!force && state.gallery.loaded && state.gallery.fullLoaded) return;
  state.gallery.loading = true;
  if (force || !state.gallery.loaded) resetGalleryForLoad();
  updateGalleryLoadingNotice();
  try {
    const cacheKey = getGalleryCacheKey();
    const cached = cacheKey ? readGalleryCache(cacheKey) : null;
    if (cached?.photos?.length) {
      applyGalleryPayload(cached, { append: false });
      state.gallery.loadedBatches = Number(cached.loadedBatches || Math.ceil(state.gallery.photos.length / GALLERY_BATCH_SIZE) || 1);
      state.gallery.fullLoaded = true;
      state.gallery.hasMore = false;
      state.gallery.nextCursor = '';
      updateGalleryLoadingNotice({ done: true });
      return;
    }

    if (state.previewMode && !(state.previewFolder || state.session?.driveLink)) {
      applyGalleryPayload({ photos: buildMockGalleryPhotos(80), hasMore: false }, { append: false });
      state.gallery.loadedBatches = 1;
      state.gallery.fullLoaded = true;
      state.gallery.hasMore = false;
      state.gallery.nextCursor = '';
      updateGalleryLoadingNotice({ done: true });
      return;
    }

    let cursor = '';
    const seenCursors = new Set();
    while (true) {
      const res = state.previewMode
        ? await fetchSelectPreviewPhotos(state.previewFolder || state.session.driveLink, {
            limit: GALLERY_BATCH_SIZE,
            recursive: true,
            cursor
          })
        : await fetchSelectPhotos(state.sessionId, {
            limit: GALLERY_BATCH_SIZE,
            recursive: true,
            cursor
          });
      applyGalleryPayload(res, { append: state.gallery.loaded && state.gallery.photos.length > 0 });
      state.gallery.loadedBatches += 1;
      const nextCursor = String(res?.nextCursor || res?.cursor || '').trim();
      const hasMore = !!(res?.hasMore || nextCursor);
      state.gallery.hasMore = hasMore;
      state.gallery.nextCursor = hasMore ? nextCursor : '';
      state.gallery.fullLoaded = !hasMore;
      updateGalleryLoadingNotice({ done: !hasMore });
      if (!hasMore) break;
      if (!nextCursor) throw new Error('다음 사진 묶음 위치를 확인할 수 없습니다. 다시 불러와 주세요.');
      if (seenCursors.has(nextCursor)) throw new Error('같은 사진 묶음이 반복되어 갤러리 로딩을 중단했습니다. 다시 불러와 주세요.');
      seenCursors.add(nextCursor);
      cursor = nextCursor;
      await waitForGalleryBatchDelay();
    }
    if (cacheKey && state.gallery.photos.length) writeGalleryCache(cacheKey, buildGalleryCachePayload());
  } catch (err) {
    if (els.galleryLoadingHint) {
      els.galleryLoadingHint.style.display = '';
      els.galleryLoadingHint.innerHTML = `
        <div>갤러리 불러오기 실패: ${escapeHtml(err.message || err)}</div>
        <button type="button" class="gallery-more" data-gallery-retry style="margin-top:12px;">다시 불러오기</button>
      `;
      els.galleryLoadingHint.querySelector('[data-gallery-retry]')?.addEventListener('click', () => {
        state.gallery.loaded = false;
        state.gallery.loading = false;
        loadGallery({ force: true });
      });
    }
    if (els.galleryStatus) els.galleryStatus.textContent = '불러오기 실패';
  } finally {
    state.gallery.loading = false;
  }
}

function showGalleryPartialNotice(res) {
  if (!res?.partial && !res?.truncated && !res?.hasMore) return;
  updateGalleryLoadingNotice();
}

function resetGalleryForLoad() {
  state.gallery.photos = [];
  state.gallery.byKey = new Map();
  state.gallery.filteredList = [];
  state.gallery.focusIndex = -1;
  state.gallery.renderCount = GALLERY_INITIAL_RENDER;
  state.gallery.loaded = false;
  state.gallery.loadedLimit = 0;
  state.gallery.loadedBatches = 0;
  state.gallery.nextCursor = '';
  state.gallery.fullLoaded = false;
  state.gallery.hasMore = false;
}

function applyGalleryPayload(res, options = {}) {
  const incoming = normalizeGalleryPhotos(Array.isArray(res?.photos) ? res.photos : []);
  const append = !!options.append;
  const photos = append ? state.gallery.photos.slice() : [];
  const seen = new Set(photos.map((photo) => galleryPhotoUniqueKey(photo)));
  incoming.forEach((photo) => {
    const key = galleryPhotoUniqueKey(photo);
    if (!key || seen.has(key)) return;
    seen.add(key);
    photos.push(photo);
  });
  photos.sort(compareGalleryPhotos);
  state.gallery.photos = photos;
  state.gallery.byKey = new Map();
  photos.forEach((p) => state.gallery.byKey.set(stripExt(p.name), p));
  state.photos.forEach((ph) => {
    if (ph.isBonus) return;
    const key = stripExt(ph.num);
    if (key && state.gallery.byKey.has(key) && !state.gallery.ratings.has(key)) {
      state.gallery.ratings.set(key, 5);
    }
  });
  state.gallery.loaded = true;
  state.gallery.loadedLimit = photos.length;
  state.gallery.hasMore = galleryPayloadHasMore(res);
  state.gallery.fullLoaded = !state.gallery.hasMore;
  state.gallery.renderCount = append
    ? Math.min(Math.max(state.gallery.renderCount || GALLERY_INITIAL_RENDER, GALLERY_INITIAL_RENDER), photos.length || GALLERY_INITIAL_RENDER)
    : Math.min(GALLERY_INITIAL_RENDER, photos.length || GALLERY_INITIAL_RENDER);
  renderGallery();
  renderPhotos();
  renderPhotocardBox();
}

function galleryPayloadHasMore(res) {
  return !!(res?.hasMore || res?.nextCursor || res?.cursor || res?.partial || res?.truncated);
}

function galleryPhotoUniqueKey(photo) {
  const id = String(photo?.id || '').trim();
  if (id) return `id:${id}`;
  const name = stripExt(photo?.name || '');
  return name ? `name:${name}` : '';
}

function compareGalleryPhotos(a, b) {
  const ap = String(a?.folderPath || '');
  const bp = String(b?.folderPath || '');
  if (ap !== bp) return ap.localeCompare(bp, undefined, { numeric: true, sensitivity: 'base' });
  return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function updateGalleryLoadingNotice(options = {}) {
  const done = !!options.done;
  const count = state.gallery.photos.length;
  if (els.galleryStatus) {
    els.galleryStatus.textContent = done
      ? `전체 사진 ${count}장을 모두 불러왔습니다.`
      : count
        ? `사진 ${count}장 불러오는 중...`
        : '전체 사진 불러오는 중...';
  }
  if (!els.galleryLoadingHint) return;
  if (done) {
    els.galleryLoadingHint.style.display = 'none';
    return;
  }
  els.galleryLoadingHint.style.display = '';
  els.galleryLoadingHint.innerHTML = count
    ? `고객 폴더 전체 사진을 300장씩 자동으로 계속 불러오는 중입니다. 현재 ${escapeHtml(String(count))}장을 먼저 표시하고 있습니다.`
    : '고객 폴더 전체 사진을 300장씩 자동으로 불러오는 중입니다. 하위 폴더와 사진 수에 따라 잠시 걸릴 수 있습니다.';
}

function waitForGalleryBatchDelay() {
  return new Promise((resolve) => globalThis.setTimeout(resolve, GALLERY_BATCH_DELAY_MS));
}

function normalizeGalleryPhotos(photos) {
  return photos.map((photo) => {
    const id = String(photo?.id || '').trim();
    const name = String(photo?.name || '').trim();
    return {
      ...photo,
      id,
      name,
      thumb: photo?.thumb || buildDriveThumbUrl(id, 360),
      thumbSet: photo?.thumbSet || buildDriveThumbSrcSet(id),
      full: photo?.full || buildDriveThumbUrl(id, 1800),
      fallback: photo?.fallback || buildDriveFallbackUrl(id),
      view: photo?.view || (id ? `https://drive.google.com/file/d/${id}/view` : '#')
    };
  });
}

function buildDriveThumbUrl(id, width) {
  if (!id) return '';
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`;
}

function buildDriveFallbackUrl(id) {
  if (!id) return '';
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;
}

function buildDriveThumbSrcSet(id) {
  if (!id) return '';
  return [240, 360, 480, 720, 960, 1280]
    .map((width) => `${buildDriveThumbUrl(id, width)} ${width}w`)
    .join(', ');
}

function getGalleryCacheKey() {
  if (state.previewMode) return `${GALLERY_CACHE_VERSION}:preview:${state.previewFolder || state.session?.driveLink || 'mock'}`;
  return state.sessionId ? `${GALLERY_CACHE_VERSION}:session:${state.sessionId}` : '';
}

function readGalleryCache(cacheKey) {
  try {
    const raw = globalThis.sessionStorage?.getItem(`selectGallery:${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.photos?.length) return null;
    if (parsed.hasMore || parsed.partial || parsed.truncated || parsed.fullLoaded === false) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeGalleryCache(cacheKey, payload) {
  try {
    globalThis.sessionStorage?.setItem(`selectGallery:${cacheKey}`, JSON.stringify({
      photos: Array.isArray(payload?.photos) ? payload.photos : [],
      count: Number(payload?.count || payload?.photos?.length || 0),
      batchSize: GALLERY_BATCH_SIZE,
      loadedBatches: Number(payload?.loadedBatches || state.gallery.loadedBatches || 0),
      fullLoaded: true,
      hasMore: false,
      partial: false,
      truncated: false
    }));
  } catch {}
}

function buildGalleryCachePayload() {
  return {
    photos: state.gallery.photos,
    count: state.gallery.photos.length,
    loadedBatches: state.gallery.loadedBatches,
    fullLoaded: state.gallery.fullLoaded,
    hasMore: state.gallery.hasMore
  };
}

function scheduleGalleryWarmup() {
  if (state.gallery.warmupStarted || state.gallery.loaded || state.gallery.loading) return;
  state.gallery.warmupStarted = true;
  const startWarmup = () => {
    if (!state.gallery.loaded && !state.gallery.loading) loadGallery();
  };
  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(startWarmup, { timeout: 1200 });
  } else {
    globalThis.setTimeout(startWarmup, 180);
  }
}

function getStarOf(photoKey) {
  return state.gallery.ratings.get(photoKey) || 0;
}

function setStarFor(photoKey, star) {
  if (!photoKey) return;
  const s = Math.max(0, Math.min(5, Number(star) || 0));
  const prev = getStarOf(photoKey);
  if (s === 0) state.gallery.ratings.delete(photoKey);
  else state.gallery.ratings.set(photoKey, s);
  syncPhotosFromRatings(photoKey, prev, s);
  renderGalleryCell(photoKey);
  renderGalleryCounts();
  renderPhotos();
  renderPhotocardBox();
  updatePhotoCounter();
  updateReview();
}

// 별점 변경 시 보정 사진 목록(state.photos)을 동기화.
// - 신규 별점 → state.photos에 해당 사진 항목 추가 (보너스 슬롯 앞에 삽입)
// - 별점 0 → state.photos에서 해당 항목 제거 (보너스 제외)
function syncPhotosFromRatings(photoKey, prev, next) {
  const existingIdx = state.photos.findIndex((p) => !p.isBonus && stripExt(p.num) === photoKey);
  if (next > 0 && existingIdx < 0) {
    const bonusIndex = state.photos.findIndex((p) => p.isBonus);
    const regularIndex = state.photos.filter((photo) => !photo.isBonus).length;
    // 갤러리에서 선택한 사진. 기본 수량 초과 여부는 전체 보정 선택 순서로 계산된다.
    const entry = { num: photoKey, note: '', printType: getDefaultPrintTypeForRegularIndex(regularIndex), isBonus: false, source: 'gallery' };
    if (bonusIndex >= 0) state.photos.splice(bonusIndex, 0, entry);
    else state.photos.push(entry);
  } else if (next === 0 && existingIdx >= 0) {
    state.photos.splice(existingIdx, 1);
  }
}

function renderGallery() {
  if (!els.galleryGrid) return;
  const searchTerm = state.gallery.filter;
  const starFilter = state.gallery.starFilter;
  const all = state.gallery.photos;
  let list = all;
  if (searchTerm) {
    list = list.filter((p) => String(p.name || '').toLowerCase().includes(searchTerm));
  }
  if (starFilter && starFilter !== 'all') {
    if (starFilter === 'rated') list = list.filter((p) => getStarOf(stripExt(p.name)) > 0);
    else if (starFilter === 'unrated') list = list.filter((p) => getStarOf(stripExt(p.name)) === 0);
    else list = list.filter((p) => getStarOf(stripExt(p.name)) === Number(starFilter));
  }
  state.gallery.filteredList = list;
  if (state.gallery.focusIndex >= list.length) state.gallery.focusIndex = list.length - 1;
  const visibleCount = Math.min(state.gallery.renderCount || GALLERY_INITIAL_RENDER, list.length);
  const visible = list.slice(0, visibleCount);
  const html = visible.map((p, idx) => galleryCellHtml(p, idx)).join('');
  const moreHtml = visibleCount < list.length
    ? `<button type="button" class="gallery-more" data-gallery-more>사진 더 보기 · ${visibleCount} / ${list.length}</button>`
    : '';
  els.galleryGrid.innerHTML = html
    ? `${html}${moreHtml}`
    : '<div class="empty-state" style="grid-column:1/-1;">표시할 사진이 없습니다.</div>';
  bindGalleryCellEvents();
  renderGalleryCounts();
}

function galleryCellHtml(p, idx) {
  const key = stripExt(p.name);
  const star = getStarOf(key);
  const selected = star > 0 ? ' has-star' : '';
  const focused = idx === state.gallery.focusIndex ? ' focused' : '';
  const layoutClass = galleryLayoutClass(p, idx);
  const sizes = galleryImageSizes(layoutClass);
  const starsHtml = [1, 2, 3, 4, 5].map((i) => `<button type="button" class="cell-star${i <= star ? ' on' : ''}" data-set-star="${i}" data-key="${escapeHtml(key)}" aria-label="별 ${i}">★</button>`).join('');
  return `<div class="gallery-cell ${layoutClass}${selected}${focused}" data-gallery-key="${escapeHtml(key)}" data-gallery-idx="${idx}" title="${escapeHtml(p.name)}">
      <img src="${escapeHtml(p.thumb)}" srcset="${escapeHtml(p.thumbSet || '')}" sizes="${escapeHtml(sizes)}" data-full="${escapeHtml(p.full || p.thumb)}" data-fallback="${escapeHtml(p.fallback || '')}" alt="" loading="lazy" decoding="async" fetchpriority="${idx < 8 ? 'high' : 'low'}" referrerpolicy="no-referrer">
      <button type="button" class="gallery-zoom" data-zoom-key="${escapeHtml(key)}" aria-label="크게 보기" title="크게 보기 (Space)">보기</button>
      ${star > 0 ? `<div class="cell-star-badge">${star}점</div>` : ''}
      <div class="cell-stars">${starsHtml}</div>
      <div class="gallery-name">${escapeHtml(p.name)}</div>
    </div>`;
}

function handleGalleryImageLoad(img) {
  if (!img) return;
  img.closest('.gallery-cell')?.classList.remove('is-broken');
  img.style.opacity = '1';
}

function handleGalleryImageError(img) {
  if (!img) return;
  const fallback = String(img.dataset.fallback || '').trim();
  if (!img.dataset.fallbackTried && fallback) {
    img.dataset.fallbackTried = '1';
    img.removeAttribute('srcset');
    img.src = fallback;
    return;
  }
  img.style.opacity = '0';
  img.closest('.gallery-cell')?.classList.add('is-broken');
}

function galleryLayoutClass(photo, idx) {
  const seed = `${stripExt(photo?.name || '')}:${idx}`;
  const value = hashString(seed) % 12;
  if (value === 0 || value === 7) return 'size-hero';
  if (value === 1 || value === 5 || value === 10) return 'size-tall';
  if (value === 2 || value === 8) return 'size-wide';
  if (value === 3 || value === 11) return 'size-small';
  return 'size-square';
}

function galleryImageSizes(layoutClass) {
  if (layoutClass === 'size-wide' || layoutClass === 'size-hero') {
    return '(max-width: 680px) 96vw, (max-width: 1100px) 62vw, 38vw';
  }
  return '(max-width: 680px) 48vw, (max-width: 1100px) 31vw, 19vw';
}

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function renderGalleryCell(photoKey) {
  renderGallery();
}

function cssEscape(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}

function bindGalleryCellEvents() {
  els.galleryGrid.querySelectorAll('.gallery-cell img').forEach((img) => {
    img.addEventListener('load', () => handleGalleryImageLoad(img));
    img.addEventListener('error', () => handleGalleryImageError(img));
    if (img.complete) {
      if (img.naturalWidth > 0) handleGalleryImageLoad(img);
      else handleGalleryImageError(img);
    }
  });
  els.galleryGrid.querySelectorAll('.gallery-cell').forEach((cell) => {
    cell.addEventListener('click', (ev) => {
      if (ev.target.closest('.gallery-zoom') || ev.target.closest('.cell-star')) return;
      state.gallery.focusIndex = Number(cell.dataset.galleryIdx || 0);
      els.galleryGrid.querySelectorAll('.gallery-cell.focused').forEach((c) => c.classList.remove('focused'));
      cell.classList.add('focused');
      openLightboxByKey(cell.dataset.galleryKey);
    });
  });
  els.galleryGrid.querySelectorAll('.gallery-zoom').forEach((btn) => {
    btn.addEventListener('click', (ev) => { ev.stopPropagation(); openLightboxByKey(btn.dataset.zoomKey); });
  });
  els.galleryGrid.querySelectorAll('.cell-star').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const key = btn.dataset.key;
      const val = Number(btn.dataset.setStar);
      const curr = getStarOf(key);
      setStarFor(key, curr === val ? 0 : val); // 같은 별 누르면 해제
    });
  });
  els.galleryGrid.querySelectorAll('[data-gallery-more]').forEach((button) => {
    button.addEventListener('click', () => expandGalleryRenderCount());
  });
}

function expandGalleryRenderCount() {
  const total = state.gallery.filteredList.length;
  if ((state.gallery.renderCount || 0) >= total) return;
  state.gallery.renderCount = Math.min(total, (state.gallery.renderCount || GALLERY_INITIAL_RENDER) + GALLERY_RENDER_INCREMENT);
  renderGallery();
}

function wireGalleryScrollOnce() {
  if (state._galleryScrollWired || !els.galleryGrid) return;
  state._galleryScrollWired = true;
  els.galleryGrid.addEventListener('scroll', () => {
    const remaining = els.galleryGrid.scrollHeight - (els.galleryGrid.scrollTop + els.galleryGrid.clientHeight);
    if (remaining < 520) expandGalleryRenderCount();
  }, { passive: true });
}

function renderGalleryCounts() {
  const total = state.gallery.photos.length;
  const rated = state.gallery.ratings.size;
  const byStar = [0, 0, 0, 0, 0, 0];
  state.gallery.ratings.forEach((v) => { byStar[v] = (byStar[v] || 0) + 1; });
  if (els.galleryCount) {
    els.galleryCount.textContent = `${rated} / ${total}장 평점 선택 완료`;
  }
  if (els.gallerySelectedSummary) {
    els.gallerySelectedSummary.innerHTML = rated
      ? `<b>현재 평점 분포:</b> 5점 ${byStar[5]}장 · 4점 ${byStar[4]}장 · 3점 ${byStar[3]}장 · 2점 ${byStar[2]}장 · 1점 ${byStar[1]}장 &nbsp;→&nbsp; 다음 단계에서 총 <b>${rated}장</b>이 보정 목록에 자동으로 담깁니다.`
      : '아직 평점을 준 사진이 없습니다. 마음에 드는 사진에 1~5 숫자키 또는 아래 평점 버튼으로 표시해 주세요.';
  }
  // 필터 버튼 카운트 업데이트
  els.starFilters.forEach((btn) => {
    const key = btn.dataset.starFilter;
    let count = 0;
    if (key === 'all') count = total;
    else if (key === 'rated') count = rated;
    else if (key === 'unrated') count = total - rated;
    else count = byStar[Number(key)] || 0;
    const baseLabel = btn.textContent.replace(/\s*\(\d+\)\s*$/, '');
    btn.textContent = `${baseLabel} (${count})`;
  });
}

/* ========================================================================
 * 키보드 단축키 — 갤러리 포커스 기반
 * ====================================================================== */
function wireGalleryKeyboard() {
  document.addEventListener('keydown', (ev) => {
    if (state.step !== 1) return;
    if (document.getElementById('lightbox')?.classList.contains('open')) return;
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const list = state.gallery.filteredList;
    if (!list.length) return;
    const cols = computeGalleryCols();
    if (ev.key >= '0' && ev.key <= '5') {
      const focused = list[state.gallery.focusIndex];
      if (!focused) return;
      ev.preventDefault();
      setStarFor(stripExt(focused.name), Number(ev.key));
      return;
    }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); moveGalleryFocus(1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); moveGalleryFocus(-1); }
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); moveGalleryFocus(cols); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveGalleryFocus(-cols); }
    else if (ev.key === ' ') {
      ev.preventDefault();
      const focused = list[state.gallery.focusIndex];
      if (focused) openLightboxByKey(stripExt(focused.name));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const focused = list[state.gallery.focusIndex];
      if (focused) openLightboxByKey(stripExt(focused.name));
    }
  });
}

function computeGalleryCols() {
  if (!els.galleryGrid) return 1;
  const gridWidth = els.galleryGrid.clientWidth;
  const sample = els.galleryGrid.querySelector('.gallery-cell');
  if (!sample) return 1;
  const cellWidth = sample.clientWidth || 120;
  const cs = globalThis.getComputedStyle(els.galleryGrid);
  const gap = parseFloat(cs.gap || '6') || 6;
  return Math.max(1, Math.floor((gridWidth + gap) / (cellWidth + gap)));
}

function moveGalleryFocus(delta) {
  const list = state.gallery.filteredList;
  if (!list.length) return;
  const prev = state.gallery.focusIndex < 0 ? 0 : state.gallery.focusIndex;
  const next = Math.max(0, Math.min(list.length - 1, prev + delta));
  state.gallery.focusIndex = next;
  while (state.gallery.renderCount <= next) {
    state.gallery.renderCount = Math.min(list.length, state.gallery.renderCount + GALLERY_RENDER_INCREMENT);
  }
  renderGallery();
  els.galleryGrid.querySelectorAll('.gallery-cell.focused').forEach((c) => c.classList.remove('focused'));
  const target = els.galleryGrid.querySelector(`[data-gallery-idx="${next}"]`);
  if (target) {
    target.classList.add('focused');
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/* ========================================================================
 * 마우스오버 프리뷰
 * ====================================================================== */
function wireHoverPreview() {
  if (!els.hoverPreview || !els.galleryGrid) return;
  let rafId = null;
  let lastEvent = null;
  const apply = () => {
    rafId = null;
    if (!lastEvent) return;
    const hp = els.hoverPreview;
    const pad = 16;
    const vw = globalThis.innerWidth;
    const vh = globalThis.innerHeight;
    const rect = hp.getBoundingClientRect();
    let x = lastEvent.clientX + 20;
    let y = lastEvent.clientY + 20;
    if (x + rect.width + pad > vw) x = lastEvent.clientX - rect.width - 20;
    if (y + rect.height + pad > vh) y = Math.max(pad, vh - rect.height - pad);
    if (y < pad) y = pad;
    hp.style.left = `${x}px`;
    hp.style.top = `${y}px`;
  };
  els.galleryGrid.addEventListener('mouseover', (ev) => {
    const cell = ev.target.closest('.gallery-cell');
    if (!cell) return;
    if ('ontouchstart' in globalThis) return; // 터치 환경에선 프리뷰 비활성화
    const img = cell.querySelector('img');
    if (!img) return;
    els.hpImg.src = img.dataset.full || img.src;
    els.hpCaption.textContent = cell.getAttribute('title') || '';
    els.hoverPreview.classList.add('visible');
    lastEvent = ev;
    if (rafId == null) rafId = requestAnimationFrame(apply);
  });
  els.galleryGrid.addEventListener('mousemove', (ev) => {
    if (!els.hoverPreview.classList.contains('visible')) return;
    lastEvent = ev;
    if (rafId == null) rafId = requestAnimationFrame(apply);
  });
  els.galleryGrid.addEventListener('mouseout', (ev) => {
    const to = ev.relatedTarget;
    if (to && to.closest && to.closest('.gallery-cell')) return;
    els.hoverPreview.classList.remove('visible');
    els.hpImg.src = '';
  });
  document.addEventListener('scroll', () => {
    els.hoverPreview.classList.remove('visible');
  }, { passive: true });
}

/* ========================================================================
 * 라이트박스 (크게보기)
 * ====================================================================== */
function openLightboxByKey(key) {
  const list = state.gallery.filteredList.length ? state.gallery.filteredList : state.gallery.photos;
  const idx = list.findIndex((p) => stripExt(p.name) === key);
  if (idx < 0) return;
  state.lightbox = { list, index: idx };
  renderLightbox();
  document.getElementById('lightbox')?.classList.add('open');
  els.hoverPreview?.classList.remove('visible');
}

function getLightboxImageRecord(url) {
  return state.lightboxImageCache.get(url) || null;
}

function markLightboxImageRecord(url, patch) {
  if (!url) return null;
  const current = state.lightboxImageCache.get(url) || { status: 'idle', promise: null, img: null };
  const next = { ...current, ...patch };
  state.lightboxImageCache.set(url, next);
  return next;
}

function preloadLightboxUrl(url) {
  if (!url) return Promise.reject(new Error('missing-url'));
  const existing = getLightboxImageRecord(url);
  if (existing?.status === 'loaded') return Promise.resolve(url);
  if (existing?.status === 'loading' && existing.promise) return existing.promise;

  const loader = new Image();
  loader.decoding = 'async';
  loader.referrerPolicy = 'no-referrer';

  const promise = new Promise((resolve, reject) => {
    loader.onload = async () => {
      try {
        if (typeof loader.decode === 'function') await loader.decode().catch(() => {});
      } catch {}
      markLightboxImageRecord(url, { status: 'loaded', promise: Promise.resolve(url), img: loader });
      resolve(url);
    };
    loader.onerror = () => {
      markLightboxImageRecord(url, { status: 'error', promise: null, img: null });
      reject(new Error(`image-load-failed:${url}`));
    };
  });

  markLightboxImageRecord(url, { status: 'loading', promise, img: loader });
  loader.src = url;
  return promise;
}

function primeLightboxPhoto(photo) {
  if (!photo) return Promise.reject(new Error('missing-photo'));
  const candidates = [photo.full, photo.fallback, photo.thumb].filter(Boolean);
  let chain = Promise.reject();
  candidates.forEach((url) => {
    chain = chain.catch(() => preloadLightboxUrl(url));
  });
  return chain;
}

function warmLightboxNeighbors(list, index) {
  if (!Array.isArray(list) || !list.length) return;
  [-2, -1, 1, 2].forEach((offset) => {
    const photo = list[index + offset];
    if (photo) primeLightboxPhoto(photo).catch(() => {});
  });
}

function renderLightbox() {
  const lb = state.lightbox;
  if (!lb) return;
  const p = lb.list[lb.index];
  if (!p) return;
  const img = document.getElementById('lb-img');
  if (img) {
    const primary = p.full || p.thumb || '';
    const fallback = p.fallback || p.thumb || primary;
    const thumb = p.thumb || fallback || primary;
    const primaryReady = primary ? getLightboxImageRecord(primary)?.status === 'loaded' : false;
    const fallbackReady = fallback ? getLightboxImageRecord(fallback)?.status === 'loaded' : false;
    const initialSrc = primaryReady ? primary : (fallbackReady ? fallback : (thumb || primary || fallback));
    const token = String(++state.lightboxRenderToken);
    img.dataset.renderToken = token;
    img.dataset.fullTarget = primary;
    img.dataset.fallbackTarget = fallback;
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.onerror = null;
    img.src = initialSrc;

    primeLightboxPhoto(p)
      .then((resolvedUrl) => {
        if (!state.lightbox || state.lightbox.list !== lb.list || state.lightbox.index !== lb.index) return;
        if (img.dataset.renderToken !== token) return;
        if (img.src !== resolvedUrl) img.src = resolvedUrl;
      })
      .catch(() => {
        if (!state.lightbox || state.lightbox.list !== lb.list || state.lightbox.index !== lb.index) return;
        if (img.dataset.renderToken !== token) return;
        if (fallback && img.src !== fallback) img.src = fallback;
      });

    warmLightboxNeighbors(lb.list, lb.index);
  }
  const nameEl = document.getElementById('lb-name');
  if (nameEl) nameEl.textContent = `${stripExt(p.name)} · ${lb.index + 1} / ${lb.list.length}`;
  const key = stripExt(p.name);
  const star = getStarOf(key);
  document.querySelectorAll('#lb-stars .lb-star').forEach((btn) => {
    btn.classList.toggle('on', Number(btn.dataset.lbStar) <= star);
  });
  const prev = document.getElementById('lb-prev');
  const next = document.getElementById('lb-next');
  if (prev) prev.disabled = lb.index === 0;
  if (next) next.disabled = lb.index >= lb.list.length - 1;
}

function closeLightbox() {
  document.getElementById('lightbox')?.classList.remove('open');
  state.lightbox = null;
}

function lightboxStep(delta) {
  const lb = state.lightbox;
  if (!lb) return;
  const ni = lb.index + delta;
  if (ni < 0 || ni >= lb.list.length) return;
  lb.index = ni;
  renderLightbox();
}

function wireLightboxOnce() {
  if (state._lightboxWired) return;
  state._lightboxWired = true;
  document.getElementById('lb-close')?.addEventListener('click', closeLightbox);
  document.getElementById('lightbox')?.addEventListener('click', (ev) => { if (ev.target.id === 'lightbox') closeLightbox(); });
  document.getElementById('lb-prev')?.addEventListener('click', () => lightboxStep(-1));
  document.getElementById('lb-next')?.addEventListener('click', () => lightboxStep(1));
  document.querySelectorAll('#lb-stars .lb-star').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lb = state.lightbox; if (!lb) return;
      const p = lb.list[lb.index]; if (!p) return;
      const key = stripExt(p.name);
      const val = Number(btn.dataset.lbStar);
      const curr = getStarOf(key);
      setStarFor(key, curr === val ? 0 : val);
      renderLightbox();
    });
  });
  document.addEventListener('keydown', (ev) => {
    if (!document.getElementById('lightbox')?.classList.contains('open')) return;
    if (ev.key === 'Escape') closeLightbox();
    else if (ev.key === 'ArrowLeft') lightboxStep(-1);
    else if (ev.key === 'ArrowRight') lightboxStep(1);
    else if (ev.key >= '0' && ev.key <= '5') {
      ev.preventDefault();
      const lb = state.lightbox; if (!lb) return;
      const p = lb.list[lb.index]; if (!p) return;
      setStarFor(stripExt(p.name), Number(ev.key));
      renderLightbox();
    }
  });
}

function stripExt(name) {
  return String(name || '').replace(/\.[a-zA-Z0-9]{2,5}$/, '');
}

/* ========================================================================
 * 다운로드
 * ====================================================================== */
function downloadAllPhotos() {
  if (state.previewMode) {
    alert('[미리보기] 실제 배포 시 Google Drive 폴더가 새 탭에서 열리고, 우측 상단 메뉴 "다운로드"로 ZIP 일괄 다운로드가 가능합니다.');
    return;
  }
  const driveLink = state.session?.driveLink || '';
  if (!driveLink) { alert('Drive 폴더 링크가 연결되어 있지 않습니다.'); return; }
  if (!confirm('Google Drive 폴더가 새 탭에서 열립니다.\n우측 상단 메뉴(⋮) → "다운로드"를 누르면 전체 사진이 ZIP으로 다운로드됩니다.\n\n계속할까요?')) return;
  globalThis.open(driveLink, '_blank', 'noopener');
}

/* ========================================================================
 * 보정 사진 목록 (Step 2)
 * ====================================================================== */
function addPhotoRow() {
  const bonusIndex = state.photos.findIndex((photo) => photo.isBonus);
  const regularIndex = state.photos.filter((photo) => !photo.isBonus).length;
  // 수동 추가 = source='manual' (기본 장수 초과 시 유료)
  const newPhoto = { num: '', note: '', printType: getDefaultPrintTypeForRegularIndex(regularIndex), isBonus: false, source: 'manual' };
  if (bonusIndex >= 0) state.photos.splice(bonusIndex, 0, newPhoto);
  else state.photos.push(newPhoto);
  renderPhotos();
  updatePhotoCounter();
  updateReview();
}

function thumbHtmlForNum(num) {
  const key = stripExt(num);
  if (!key) return '<div class="entry-thumb placeholder">사진 번호를 입력하면 썸네일이 표시됩니다</div>';
  const p = state.gallery.byKey.get(key);
  if (!p) return `<div class="entry-thumb placeholder">갤러리에서 ${escapeHtml(key)}를 찾지 못했습니다 <br><small>(갤러리를 먼저 불러오면 미리보기가 표시됩니다)</small></div>`;
  return `<div class="entry-thumb" data-zoom-entry="${escapeHtml(key)}">
    <img src="${escapeHtml(p.full || p.thumb)}" data-full="${escapeHtml(p.full || p.thumb)}" alt="${escapeHtml(p.name)}" referrerpolicy="no-referrer" loading="lazy" decoding="async">
    <button type="button" class="entry-thumb-zoom" data-zoom-entry="${escapeHtml(key)}" aria-label="크게 보기" title="크게 보기">보기</button>
  </div>`;
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
      <div class="field field-photo">
        <label>앞면 사진 번호</label>
        <input data-photocard-side="frontNum" value="${escapeHtml(state.photocard.frontNum || '')}" placeholder="예: IMG_0023 또는 0023">
        ${thumbHtmlForNum(state.photocard.frontNum || '')}
      </div>
      <div class="field field-photo">
        <label>뒷면 사진 번호</label>
        <input data-photocard-side="backNum" value="${escapeHtml(state.photocard.backNum || '')}" placeholder="예: IMG_0045 또는 0045">
        ${thumbHtmlForNum(state.photocard.backNum || '')}
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
      const row = input.closest('.field');
      if (row) {
        const thumb = row.querySelector('.entry-thumb, .entry-thumb.placeholder');
        if (thumb) {
          const wrap = document.createElement('div');
          wrap.innerHTML = thumbHtmlForNum(input.value);
          thumb.replaceWith(wrap.firstElementChild);
        }
      }
      wirePhotocardZoom();
      updateReview();
    });
  });
  els.photocardBox.querySelector('[data-photocard-note]')?.addEventListener('input', (event) => {
    state.photocard.note = event.target.value;
    updateReview();
  });
  wirePhotocardZoom();
}

function wirePhotocardZoom() {
  if (!els.photocardBox) return;
  els.photocardBox.querySelectorAll('[data-zoom-entry]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openLightboxByKey(btn.dataset.zoomEntry);
    });
  });
  els.photocardBox.querySelectorAll('.entry-thumb[data-zoom-entry]').forEach((thumb) => {
    thumb.addEventListener('click', () => openLightboxByKey(thumb.dataset.zoomEntry));
  });
}

function renderPhotos() {
  const retouchIntro = `<div class="included-print-callout"><strong>보정 선택</strong><span>보정할 사진과 요청사항만 선택하세요. 출력물은 다음 단계에서 따로 고르며, 보정과 다른 사진도 출력할 수 있습니다.</span></div>`;
  if (!state.photos.length) {
    els.photoList.innerHTML = `${retouchIntro}<div class="empty-state">아직 선택된 보정 사진이 없습니다. 1차 셀렉에서 별점을 준 사진이 이곳에 자동으로 채워지거나, 아래 버튼으로 직접 추가할 수 있습니다.</div>`;
    return;
  }
  const retouchPrice = Number(state.session?.retouchPrice || 0);
  els.photoList.innerHTML = retouchIntro + state.photos.map((photo, index) => {
    const paid = isPhotoPaid(photo, index);
    const source = photo.source || (photo.isBonus ? 'bonus' : 'manual');
    const extra = paid ? `<span class="extra-badge">+€${retouchPrice}</span>` : '';
    const bonus = photo.isService
      ? '<span class="service-badge">서비스 컷</span>'
      : photo.isBonus
        ? '<span class="bonus-badge">마케팅 보너스</span>'
        : source === 'gallery'
          ? '<span class="gallery-badge">갤러리 선택</span>'
          : '<span class="manual-badge">직접 추가</span>';
    const key = stripExt(photo.num);
    const star = key ? getStarOf(key) : 0;
    const starChip = star ? `<span class="entry-star-chip">${star}점</span>` : '';
    return `
      <div class="entry-card${photo.isService ? ' service' : photo.isBonus ? ' bonus' : ''}">
        <div class="entry-head">
          <div class="entry-label">#${index + 1} ${starChip} ${bonus} ${extra}</div>
          ${photo.isBonus ? '' : `<button type="button" class="remove-btn" data-remove-photo="${index}">삭제</button>`}
        </div>
        <div class="entry-grid">
          <div class="field field-photo field-full">
            <label>사진 번호</label>
            <input data-photo-num="${index}" value="${escapeHtml(photo.num || '')}" placeholder="예: IMG_0023 또는 0023">
            ${thumbHtmlForNum(photo.num || '')}
          </div>
          <div class="field-full">
            <label>보정 요청사항 <small style="color:#9a6a3a;">(구체적으로 작성해 주세요)</small></label>
            <textarea data-photo-note="${index}" placeholder="${escapeHtml(retouchNotePlaceholder())}">${escapeHtml(photo.note || '')}</textarea>
          </div>
        </div>
      </div>
    `;
  }).join('');

  els.photoList.querySelectorAll('[data-photo-num]').forEach((input) => {
    input.addEventListener('input', () => {
      state.photos[Number(input.dataset.photoNum)].num = input.value;
      // 썸네일만 갱신하기 위해 해당 row만 교체
      const row = input.closest('.field');
      if (row) {
        const thumb = row.querySelector('.entry-thumb, .entry-thumb.placeholder');
        if (thumb) {
          const wrap = document.createElement('div');
          wrap.innerHTML = thumbHtmlForNum(input.value);
          thumb.replaceWith(wrap.firstElementChild);
        }
      }
      updatePhotoCounter();
      if (state.prints.length) renderPrints(); // 보정본/원본 단가 판정이 바뀔 수 있음
      updateReview();
    });
  });
  els.photoList.querySelectorAll('[data-photo-note]').forEach((input) => {
    input.addEventListener('input', () => {
      state.photos[Number(input.dataset.photoNote)].note = input.value;
      syncRetouchScopeHint(input);
      updatePhotoCounter();
      updateReview();
    });
    syncRetouchScopeHint(input); // 복원 시 기존 요청에도 즉시 표시
  });
  els.photoList.querySelectorAll('[data-remove-photo]').forEach((button) => {
    button.addEventListener('click', () => {
      const i = Number(button.dataset.removePhoto);
      const removed = state.photos[i];
      // 갤러리 별점도 해제
      if (removed && !removed.isBonus) {
        const k = stripExt(removed.num);
        if (k && state.gallery.ratings.has(k)) {
          state.gallery.ratings.delete(k);
          if (state.step === 1 || state.gallery.loaded) renderGallery();
        }
      }
      state.photos.splice(i, 1);
      renderPhotos();
      updatePhotoCounter();
      if (state.prints.length) renderPrints();
      updateReview();
    });
  });
  // 엔트리 썸네일 확대
  els.photoList.querySelectorAll('[data-zoom-entry]').forEach((btn) => {
    btn.addEventListener('click', (ev) => { ev.stopPropagation(); openLightboxByKey(btn.dataset.zoomEntry); });
  });
  els.photoList.querySelectorAll('.entry-thumb[data-zoom-entry]').forEach((thumb) => {
    thumb.addEventListener('click', () => openLightboxByKey(thumb.dataset.zoomEntry));
  });
}

function updatePhotoCounter() {
  const selected = state.photos.length;
  const base = Number(state.session?.baseRetouchCount || 0);
  const extra = getRetouchExtraCount();
  const retouchPrice = Number(state.session?.retouchPrice || 0);
  const galleryCount = state.photos.filter((p) => p.source === 'gallery' && !p.isBonus).length;
  const manualCount = state.photos.filter((p) => (p.source || 'manual') === 'manual' && !p.isBonus).length;
  const bonusCount = state.photos.filter((p) => p.isBonus && !p.isService).length;
  const serviceCount = state.photos.filter((p) => p.isService).length;
  els.photoCounter.textContent = `${selected}장 선택됨 / 기본 ${base}장 포함${serviceCount > 0 ? ` + 서비스 ${serviceCount}장` : ''}`;
  const parts = [];
  if (galleryCount) parts.push(`갤러리 ${galleryCount}장`);
  if (manualCount) parts.push(`직접 추가 ${manualCount}장`);
  if (bonusCount) parts.push(`마케팅 보너스 ${bonusCount}장(무료)`);  if (serviceCount) parts.push(`서비스 컷 ${serviceCount}장(무료)`);
  els.photoCounterSub.textContent = parts.length
    ? parts.join(' · ') + (extra > 0 ? ` · 기본 ${base}장 초과분이 유료로 계산됩니다.` : ' · 추가 보정 비용 없음')
    : '별점을 주거나 직접 항목을 추가하면 여기에 구성이 표시됩니다.';
  els.extraCost.textContent = extra > 0 ? `추가 ${extra}장 × €${retouchPrice} = €${extra * retouchPrice}` : '추가 보정 비용 없음';
}

/* ========================================================================
 * 추가 인화 (Step 3)
 * ====================================================================== */
function addPrintRow() {
  // 기본값: 아직 남은 포함 쿼터 사이즈를 우선 제안, 없으면 기본 10×15
  const remaining = getPrintQuotaSummary().find((q) => q.remaining > 0);
  state.prints.push({ photoNum: '', printId: remaining ? remaining.id : 'basic_10x15', qty: 1 });
  renderPrints();
  updateReview();
}

function renderServiceCutPrintNote() {
  const total = getServiceCutCount();
  if (total <= 0) return '';
  const used = computePrintAnnotations().reduce((n, ann) => n + (ann.serviceCreditUnits || 0), 0);
  const nums = state.photos
    .filter((p) => p?.isService && String(p.num || '').trim())
    .map((p) => stripExt(p.num))
    .join(', ');
  const target = nums ? `서비스 컷 사진 번호(<b>${escapeHtml(nums)}</b>)` : '서비스 컷으로 정한 사진 번호';
  return `<div class="service-cut-print-note">🎁 <b>서비스 컷 무료 인화 ${used}/${total}장 사용</b> — ${target}로 인화를 추가하면 기본 10×15cm는 <b>무료</b>, 더 큰 사이즈는 <b>차액만</b> 청구돼요.</div>`;
}

function renderPrintQuotaBanner() {
  const summary = getPrintQuotaSummary();
  const serviceNote = renderServiceCutPrintNote();
  if (!summary.length) {
    return `<div class="included-print-callout"><strong>출력 선택</strong><span>이 상품은 기본 제공 출력물이 없습니다. 필요한 사진을 아래에서 인화 주문할 수 있어요. 보정과 다른 사진도 선택할 수 있습니다.</span>${serviceNote}</div>`;
  }
  const chips = summary.map((q) => {
    const done = q.remaining === 0;
    return `<span class="quota-chip${done ? ' used' : ''}">${escapeHtml(q.label)} <b>${q.used}/${q.total}</b></span>`;
  }).join('');
  return `<div class="included-print-callout"><strong>기본 제공 출력물 (무료)</strong><span>포함된 사이즈는 무료입니다. 보정과 다른 사진을 출력해도 됩니다. 포함 수량을 넘으면 초과분만 요금이 붙어요.</span><div class="quota-chips">${chips}</div>${serviceNote}</div>`;
}

function renderPrints() {
  const banner = renderPrintQuotaBanner();
  if (!state.prints.length) {
    els.printList.innerHTML = `${banner}<div class="empty-state">아직 출력 주문이 없습니다. 아래 버튼으로 출력할 사진을 추가하세요.</div>`;
    return;
  }
  const annotations = computePrintAnnotations();
  els.printList.innerHTML = banner + state.prints.map((print, index) => {
    const ann = annotations[index];
    const option = ann.option;
    const priceRight = ann.amount === 0
      ? `<strong class="free">${ann.serviceDiscount > 0 ? '무료 (서비스 컷)' : '무료'}</strong>`
      : `<strong class="paid">€${ann.amount}</strong>`;
    const tierBadge = ann.isRetouched
      ? '<span class="included-print-badge">보정본 출력</span>'
      : '<span class="manual-badge">원본 출력</span>';
    const serviceLine = ann.serviceDiscount > 0
      ? `<div class="review-note">🎁 서비스 컷 인화 −€${ann.serviceDiscount}${ann.amount > 0 ? ' (차액만 청구)' : ' (무료)'}</div>`
      : '';
    const breakdown = (ann.includedQty > 0 && ann.chargedQty > 0
      ? `<div class="review-note">포함 ${ann.includedQty} · 추가 ${ann.chargedQty} × €${ann.unit}</div>`
      : ann.includedQty > 0
        ? '<div class="review-note">기본 제공 (무료)</div>'
        : `<div class="review-note">추가 인화 ${ann.qty} × €${ann.unit}</div>`) + serviceLine;
    return `
      <div class="entry-card">
        <div class="entry-head">
          <div class="entry-label">출력 #${index + 1} ${tierBadge}</div>
          <button type="button" class="remove-btn" data-remove-print="${index}">삭제</button>
        </div>
        <div class="entry-grid">
          <div class="field">
            <label>사진 번호</label>
            <input data-print-photo="${index}" value="${escapeHtml(print.photoNum || '')}" placeholder="예: IMG_0045 또는 0045">
            ${thumbHtmlForNum(print.photoNum || '')}
          </div>
          <div class="field">
            <label>수량</label>
            <input data-print-qty="${index}" type="number" min="1" value="${escapeHtml(print.qty || 1)}">
          </div>
          <div class="field-full">
            <label>용지 종류</label>
            <select data-print-type="${index}">
              ${getSelectablePrintOptions().map((item) => `<option value="${item.id}"${item.id === print.printId ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="price-line">
          <span>${breakdown}</span>
          ${priceRight}
        </div>
      </div>
    `;
  }).join('');

  els.printList.querySelectorAll('[data-print-photo]').forEach((input) => {
    input.addEventListener('input', () => {
      state.prints[Number(input.dataset.printPhoto)].photoNum = input.value;
      const row = input.closest('.field');
      if (row) {
        const thumb = row.querySelector('.entry-thumb, .entry-thumb.placeholder');
        if (thumb) {
          const wrap = document.createElement('div');
          wrap.innerHTML = thumbHtmlForNum(input.value);
          thumb.replaceWith(wrap.firstElementChild);
        }
      }
      updateReview();
    });
    // 입력을 마치면 보정본/원본 단가 판정을 반영해 행을 다시 그린다 (타이핑 중 포커스 유지)
    input.addEventListener('change', () => { renderPrints(); updateReview(); });
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
  els.printList.querySelectorAll('[data-zoom-entry]').forEach((btn) => {
    btn.addEventListener('click', (ev) => { ev.stopPropagation(); openLightboxByKey(btn.dataset.zoomEntry); });
  });
  els.printList.querySelectorAll('.entry-thumb[data-zoom-entry]').forEach((thumb) => {
    thumb.addEventListener('click', () => openLightboxByKey(thumb.dataset.zoomEntry));
  });
}

/* ========================================================================
 * 픽업 캘린더
 * ====================================================================== */
function buildPickupCacheKey(year, month) { return `${year}_${month}`; }

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
  if (state.pickupTime && !state.pickupSlots.includes(state.pickupTime)) state.pickupTime = '';
  if (calendar && !calendar.slotsByDate) calendar.slotsByDate = monthSlots;
  if (calendar && monthSlots && !monthSlots[date]) monthSlots[date] = state.pickupSlots;
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
  if (!state.deliveryMethod) { setBanner('수령 방식을 먼저 선택해 주세요.', 'error'); return false; }
  if (state.deliveryMethod === 'pickup') {
    if (!state.pickupDate || !state.pickupTime) { setBanner('픽업 날짜와 시간을 모두 선택해 주세요.', 'error'); return false; }
    return true;
  }
  const mailName = getMailNameForSubmission();
  const mailAddress = getMailAddressForSubmission();
  if (!mailName) { setBanner('우편 수령 받으실 분 성함을 입력해 주세요.', 'error'); return false; }
  if (!mailAddress) { setBanner('우편 수령 주소를 입력해 주세요.', 'error'); return false; }
  if (!hasMailAddressPostalCity(mailAddress)) { setBanner('우편 주소에 우편번호와 도시를 함께 입력해 주세요. 예: 61440 Oberursel', 'error'); return false; }
  state.mailName = mailName;
  state.mailAddress = mailAddress;
  if (els.mailNameInput) els.mailNameInput.value = mailName;
  if (els.mailAddressInput) els.mailAddressInput.value = mailAddress;
  return true;
}

/* ========================================================================
 * 검토 단계
 * ====================================================================== */
function updateReview() {
  const base = Number(state.session?.baseRetouchCount || 0);
  const retouchPrice = Number(state.session?.retouchPrice || 0);

  els.reviewPhotos.innerHTML = state.photos.length
    ? state.photos.map((photo, index) => {
        const source = photo.source || (photo.isBonus ? 'bonus' : 'manual');
        const paid = isPhotoPaid(photo, index);
        const extra = paid
          ? `+€${retouchPrice}`
          : photo.isService
            ? '서비스 컷'
            : photo.isBonus
              ? '마케팅 보너스'
              : source === 'gallery'
                ? '갤러리 선택'
                : '포함';
        return `
          <div class="review-item">
            <div>
              <strong>${escapeHtml(photo.num || `사진 ${index + 1}`)}</strong>
              <div class="review-note">${escapeHtml(photo.note || '')}</div>
            </div>
            <div style="text-align:right;">
              <div class="review-note">${extra}</div>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state">선택된 보정 사진이 없습니다.</div>';

  const printAnnotations = computePrintAnnotations();
  els.reviewPrints.innerHTML = state.prints.length
    ? state.prints.map((print, index) => {
        const ann = printAnnotations[index];
        const tier = ann.isRetouched ? '보정본' : '원본';
        const priceText = ann.amount === 0 ? '무료' : `€${ann.amount}`;
        const detail = (ann.includedQty > 0 && ann.chargedQty > 0
          ? ` (포함 ${ann.includedQty} · 추가 ${ann.chargedQty})`
          : ann.includedQty > 0
            ? ' (기본 제공)'
            : '') + (ann.serviceDiscount > 0 ? ' 🎁서비스 컷' : '');
        return `
          <div class="review-item">
            <span>${escapeHtml(print.photoNum || '-')} · ${escapeHtml(ann.option.label)} × ${escapeHtml(print.qty || 1)} · ${tier}${detail}</span>
            <strong>${priceText}</strong>
          </div>
        `;
      }).join('')
    : '<div class="empty-state">출력 선택 없음</div>';

  if (els.reviewPhotocardBlock && els.reviewPhotocard) {
    const visible = hasIncludedPhotocard();
    els.reviewPhotocardBlock.classList.toggle('hidden', !visible);
    els.reviewPhotocard.textContent = visible ? getPhotocardReviewText() : '';
  }
  els.reviewMarketing.textContent = state.marketing === 'Y' ? '동의' : '미동의';
  syncDeliveryUi();
  if (els.reviewDelivery) els.reviewDelivery.textContent = requiresDeliverySelection() ? getDeliveryReviewText() : '';
  const total = calcTotal();
  els.reviewTotal.textContent = total === 0 ? '무료' : `€${total}`;
  updateSubmitState();
  renderStepWarnings();
}

function validateStep1() {
  if (!state.marketing) {
    setBanner('마케팅 동의 여부를 먼저 선택해 주세요.', 'error');
    return false;
  }
  // 갤러리: 최소 1장은 별점을 주거나 직접 추가돼 있어야 다음으로 이동 가능
  const regularCount = state.photos.filter((p) => !p.isBonus).length;
  if (regularCount < 1) {
    setBanner('1차 셀렉에서 최소 1장 이상 별점을 주세요.', 'error');
    return false;
  }
  return true;
}

function validateStep2() {
  if (!state.photos.length) { setBanner('보정 사진을 최소 1장 선택해 주세요.', 'error'); return false; }
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

function validateStep3() {
  const invalid = state.prints.findIndex((print) => !String(print.photoNum || '').trim());
  if (invalid >= 0) { setBanner(`${invalid + 1}번째 추가 인화의 사진 번호를 입력해 주세요.`, 'error'); return false; }
  return true;
}

function goStep(step) {
  if (step === 2 && !validateStep1()) return;
  if (step === 3 && !validateStep2()) return;
  if (step === 4 && !validateStep3()) return;
  if (state.submitted) return;
  state.step = step;
  els.progressRow.classList.remove('hidden');
  els.stepPanels.forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.step) === step));
  els.stepPanels.forEach((panel) => panel.classList.remove('hidden'));
  els.stepDots.forEach((dot, index) => {
    dot.className = `step-dot${index === step ? ' active' : index < step ? ' done' : ''}`;
  });
  if (step === 1 && !state.gallery.loaded && !state.gallery.loading) loadGallery();
  if (step === 3) renderPrints(); // 보정 리스트 기준 포함 쿼터/단가 최신화
  if (step === 4) updateReview();
  globalThis.scrollTo({ top: 0, behavior: 'smooth' });
}

function canSubmit() {
  if (!state.marketing) return false; // Step 1에서 이미 체크됨
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
  if (els.step3NextBtn) els.step3NextBtn.disabled = !canProceedStep3();
  els.submitBtn.disabled = !canSubmit() || state.submitted;
  renderStepWarnings();
}

function canProceedStep1() {
  if (!state.marketing) return false;
  const regularCount = state.photos.filter((p) => !p.isBonus).length;
  return regularCount >= 1;
}

function canProceedStep2() {
  if (!state.photos.length) return false;
  return !state.photos.some((photo) => !String(photo.num || '').trim() || !String(photo.note || '').trim())
    && !getPhotocardWarning();
}

function canProceedStep3() {
  return !state.prints.some((print) => !String(print.photoNum || '').trim());
}

function renderStepWarnings() {
  const bonusCount = getMarketingBonusCount();
  const step1Message = canProceedStep1()
    ? ''
    : !state.marketing
      ? `마케팅 동의 여부(동의 / 미동의)를 먼저 선택해 주세요.${bonusCount > 0 ? ` 동의 시 보너스 보정 ${bonusCount}장이 무료로 추가됩니다.` : ''}`
      : '1차 셀렉에서 별점을 준 사진이 아직 없어요. 마음에 드는 사진에 별을 부여해 주세요.';
  const step2Message = canProceedStep2()
    ? ''
    : !state.photos.length
      ? '보정 사진을 최소 1장 추가해야 다음 단계로 이동할 수 있습니다.'
      : getPhotocardWarning()
        ? getPhotocardWarning()
        : '모든 사진의 번호와 보정 요청사항(구체적으로)을 입력해야 다음 버튼이 활성화됩니다.';
  const step3Message = canProceedStep3() ? '' : '추가 인화의 사진 번호를 모두 입력해야 다음 단계로 이동할 수 있습니다.';
  const step4Message = canSubmit()
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
  if (els.stepWarnings.step4) els.stepWarnings.step4.textContent = step4Message;
}

/* ========================================================================
 * 미리보기 모드
 * ====================================================================== */
function buildMockSession() {
  return {
    name: '데모 고객',
    email: 'demo@studio-mean.com',
    date: '2026-04-15',
    itemGroup: 'stud',
    product: '스튜디오 Basic',
    baseRetouchCount: 3,
    retouchPrice: 10,
    marketingBonusCount: 2,
    serviceCutCount: 2,
    lang: 'ko',
    driveLink: state.previewFolder || 'https://drive.google.com/drive/folders/1J3p6L1xmYnGSi4TzxzOz5Ket2uvkGMLP?usp=drive_link',
    bookingMarketing: '',
    bookingAddress: '',
    deadline: '',
    revisionCount: 0,
    extraInvoiceNumber: '',
    existingDeliveryMethod: '',
    existingPickupAt: '',
    existingMailName: '',
    existingMailAddress: '',
    existingPickupEventId: ''
  };
}

function showPreviewBanner() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f59e0b;color:#fff;padding:8px 14px;text-align:center;font-weight:700;font-size:13px;z-index:10000;box-shadow:0 2px 6px rgba(0,0,0,.15);';
  el.innerHTML = '미리보기 모드 — 실제 예약 데이터가 아니며, 제출/다운로드는 동작하지 않습니다.';
  document.body.appendChild(el);
  document.body.style.paddingTop = '36px';
}

function buildMockGalleryPhotos(n) {
  return Array.from({ length: n }, (_, i) => {
    const num = String(i + 1).padStart(4, '0');
    const seed = `smean${i}`;
    return {
      id: 'mock-' + num,
      name: `IMG_${num}.jpg`,
      thumb: `https://picsum.photos/seed/${seed}/240/240`,
      full: `https://picsum.photos/seed/${seed}/1200/1200`,
      view: '#'
    };
  });
}

/* ========================================================================
 * 제출
 * ====================================================================== */
async function onSubmit() {
  if (!validateStep2() || !validateStep3() || !validateDeliverySelection()) return;
  if (state.previewMode) {
    alert('[미리보기] 실제 배포에서는 이 시점에 서버로 제출되고 확인 이메일이 발송됩니다.');
    return;
  }
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = state.editMode ? '수정 제출 중...' : '제출 중...';
  const deliveryRequired = requiresDeliverySelection();
  const printAnnotations = computePrintAnnotations();
  const payload = {
    selectPrintModel: SELECT_PRINT_MODEL,
    // 보정 리스트는 출력 정보를 담지 않는다 (분리형)
    photos: state.photos.map((photo) => ({
      num: String(photo.num || ''),
      note: String(photo.note || ''),
      isBonus: !!photo.isBonus,
      isService: !!photo.isService,
      source: photo.source || (photo.isService ? 'service' : photo.isBonus ? 'bonus' : 'manual')
    })),
    // 출력 리스트: 통합. 서버가 포함 쿼터/과금을 최종 판정하므로 price 는 참고용.
    prints: [
      ...state.prints.map((print, index) => {
        const ann = printAnnotations[index];
        return {
          photoNum: String(print.photoNum || ''),
          printId: normalizePrintTypeId(print.printId),
          qty: Math.max(1, Number(print.qty) || 1),
          isRetouched: ann.isRetouched,
          label: ann.option.label,
          price: ann.unit
        };
      }),
      ...(() => {
        const fallback = getPhotocardPrintFallbackPayload();
        return fallback ? [fallback] : [];
      })()
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
