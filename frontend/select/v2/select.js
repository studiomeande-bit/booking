import {
  fetchSelectPreviewPhotos,
  fetchSelectPhotos,
  fetchSelectPickupCalendar,
  fetchSelectPickupSlots,
  fetchSelectSession,
  submitSelectSession,
  updateSelectSession
} from '../../shared/api-select.js';
import { createRequestId, escapeHtml, formatMonthLabel, pad2 } from '../../shared/utils.js';

const PRINT_OPTIONS = [
  { id: 'basic_10x15', label: '기본 10×15cm', retouched: 0, additional: 5 },
  { id: 'premium_10x15', label: '프리미엄 10×15cm', retouched: 3, additional: 8 },
  { id: 'photocard_single', label: '포토카드 프린트 (단면)', retouched: 5, additional: 5 },
  { id: 'photocard_double', label: '포토카드 프린트 (양면)', retouched: 8, additional: 8 },
  { id: 'basic_a4', label: '기본 A4', retouched: 10, additional: 15 },
  { id: 'premium_a4', label: '프리미엄 A4', retouched: 15, additional: 20 },
  { id: 'premium_a3', label: '프리미엄 A3', retouched: 35, additional: 50 }
];

const INCLUDED_PRINT_QUOTA = {
  stud: [{ id: 'basic_a4', qty: 1 }],
  wed: [{ id: 'premium_a3', qty: 1 }, { id: 'basic_a4', qty: 2 }, { id: 'basic_10x15', qty: 3 }],
  snap: [{ id: 'basic_10x15', qty: 5 }],
  pass: [],
  prof: [],
  biz: []
};

const TOTAL_STEPS = 5; // 0:welcome 1:gallery 2:retouch 3:print 4:review
const GALLERY_INITIAL_RENDER = 48;
const GALLERY_RENDER_INCREMENT = 72;

const state = {
  sessionId: new URLSearchParams(globalThis.location.search).get('id') || '',
  testMode: new URLSearchParams(globalThis.location.search).get('test') === '1',
  previewMode: new URLSearchParams(globalThis.location.search).get('preview') === '1',
  previewFolder: new URLSearchParams(globalThis.location.search).get('folder') || '',
  session: null,
  photos: [],
  prints: [],
  marketing: '',
  deliveryMethod: '',
  pickupDate: '',
  pickupTime: '',
  pickupSlots: [],
  pickupCalendarCache: new Map(),
  pickupCalendarYear: 0,
  pickupCalendarMonth: 0,
  pickupEventId: '',
  mailAddress: '',
  editMode: false,
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
    warmupStarted: false
  },
  lightbox: null
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
  reviewPrints: document.getElementById('reviewPrints'),
  reviewMarketing: document.getElementById('reviewMarketing'),
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
  state.mailAddress = session.existingMailAddress || session.bookingAddress || '';
  state.photos = state.editMode && Array.isArray(session.existingPhotos)
    ? session.existingPhotos.map(normalizePhoto)
    : [];
  state.prints = state.editMode && Array.isArray(session.existingPrints)
    ? session.existingPrints.map(normalizePrint).filter(hasMeaningfulPrint)
    : [];
  // 기존 수정 모드에서 이미 선택된 사진들은 갤러리 별점 5점으로 복원 (갤러리 로드 후 반영)
  if (session.bookingMarketing === 'Y') state.marketing = 'Y';
  syncMarketingUi();
  syncDeliveryUi();
  seedPickupCalendarCursor();
}

function getIncludedPrintPresetTypes(itemGroup, count) {
  const total = Number(count) || 0;
  const preset = [];
  const quota = INCLUDED_PRINT_QUOTA[itemGroup] || [];
  quota.forEach((item) => {
    for (let i = 0; i < item.qty; i += 1) preset.push(item.id);
  });
  while (preset.length < total) preset.push('basic_10x15');
  return preset.slice(0, total);
}

function getIncludedPrintSummary(itemGroup) {
  const quota = INCLUDED_PRINT_QUOTA[itemGroup] || [];
  if (!quota.length) return '';
  return quota.map((item) => {
    const option = PRINT_OPTIONS.find((print) => print.id === item.id);
    const label = option?.label || item.id;
    return `${label} ${item.qty}장`;
  }).join(' · ');
}

function normalizePhoto(photo) {
  const isBonus = !!photo?.isBonus;
  // 기존 데이터 호환: source가 없으면 isBonus→bonus, 아니면 manual로 기본
  // (gallery는 새 별점 부여 시 별도로 설정됨)
  const source = photo?.source || (isBonus ? 'bonus' : 'manual');
  return {
    num: String(photo?.num || ''),
    note: String(photo?.note || ''),
    printType: String(photo?.printType || 'basic_10x15').replace(/_(r|e)$/, ''),
    isBonus,
    source
  };
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
    <div class="summary-item"><div class="summary-label">추가 보정 단가</div><div class="summary-value">€${escapeHtml(s.retouchPrice || 0)}</div></div>
    <div class="summary-item"><div class="summary-label">추가 인보이스</div><div class="summary-value">${escapeHtml(s.extraInvoiceNumber || '-')}</div></div>
  `;
}

function renderPackageSummary() {
  const s = state.session;
  const includedSummary = getIncludedPrintSummary(s.itemGroup);
  const studioNotice = s.itemGroup === 'stud'
    ? '<div class="guide-copy"><b>스튜디오 상품은 기본 A4 1장이 무료로 포함됩니다.</b></div>'
    : '';
  els.packageSummary.innerHTML = `
    <div class="detail-title">보정 패키지 안내</div>
    <div class="guide-copy">기본 보정 <b>${escapeHtml(s.baseRetouchCount || 0)}장</b> 포함 · 추가 보정 <b>€${escapeHtml(s.retouchPrice || 0)}/장</b></div>
    ${includedSummary ? `<div class="guide-copy">기본 인화 구성: <b>${escapeHtml(includedSummary)}</b></div>` : ''}
    ${studioNotice}
    ${s.deadline ? `<div class="guide-copy">셀렉 마감일: ${escapeHtml(String(s.deadline).slice(0, 10))}</div>` : ''}
    ${s.revisionCount ? `<div class="guide-copy">재수정 요청 횟수: ${escapeHtml(s.revisionCount)}회</div>` : ''}
  `;
  if (s.driveLink) {
    els.driveLink.href = s.driveLink;
    els.driveLink.classList.remove('hidden');
  }
}

function renderPriceGuide() {
  els.printPriceGuide.innerHTML = PRINT_OPTIONS.map((opt) => `
    <div class="review-item">
      <span>${escapeHtml(opt.label)}</span>
      <strong>€${opt.additional}</strong>
    </div>
  `).join('');
}

function setMarketing(value) {
  state.marketing = value;
  syncMarketingUi();
  const hasBonus = state.photos.some((photo) => photo.isBonus);
  if (value === 'Y' && !hasBonus && !state.session?.bookingMarketing) {
    state.photos.push(
      { num: '', note: '', printType: 'basic_10x15', isBonus: true, source: 'bonus' },
      { num: '', note: '', printType: 'basic_10x15', isBonus: true, source: 'bonus' }
    );
  }
  if (value === 'N' && hasBonus && !state.session?.bookingMarketing) {
    state.photos = state.photos.filter((photo) => !photo.isBonus);
  }
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
    els.marketingBox.querySelector('.detail-copy').textContent =
      '예약 단계에서 이미 포트폴리오 및 SNS 활용에 동의해 주셨어요. 아래에서 다시 한 번 확인만 해주시면 됩니다.';
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
  const method = state.deliveryMethod;
  document.querySelectorAll('input[name="deliveryMethod"]').forEach((input) => {
    input.checked = input.value === method;
  });
  els.deliveryPickupCard?.classList.toggle('active', method === 'pickup');
  els.deliveryMailCard?.classList.toggle('active', method === 'mail');
  els.pickupScheduler?.classList.toggle('hidden', method !== 'pickup');
  els.mailAddressBox?.classList.toggle('hidden', method !== 'mail');
  if (els.mailAddressInput) els.mailAddressInput.value = state.mailAddress || '';
}

function getQuotaMap() {
  return (INCLUDED_PRINT_QUOTA[state.session?.itemGroup] || []).map((item) => ({ ...item }));
}

function getRegularPhotos() {
  return state.photos.filter((photo) => !photo.isBonus);
}

// 수동 추가(source='manual')된 사진 중, 기본 포함 장수를 초과한 것만 유료.
// 갤러리(source='gallery')에서 선택한 사진은 장수를 초과해도 자동 무료.
function getRetouchExtraCount() {
  const included = Number(state.session?.baseRetouchCount || 0);
  let nonBonusIndex = 0; // 1-based position among non-bonus photos
  let paid = 0;
  state.photos.forEach((p) => {
    if (p.isBonus) return;
    nonBonusIndex += 1;
    const source = p.source || 'manual';
    if (source === 'gallery') return; // 갤러리 선택 — 무조건 무료
    if (nonBonusIndex > included) paid += 1;
  });
  return paid;
}

// 해당 사진 항목이 유료(+€)인지 판정
function isPhotoPaid(photo, photoIndex) {
  if (photo.isBonus) return false;
  const source = photo.source || 'manual';
  if (source === 'gallery') return false; // 갤러리 선택 = 무료
  const included = Number(state.session?.baseRetouchCount || 0);
  // 해당 사진 앞에 있는 non-bonus 사진 수 세기
  let nonBonusPosition = 0;
  for (let i = 0; i <= photoIndex; i += 1) {
    if (!state.photos[i].isBonus) nonBonusPosition += 1;
  }
  return nonBonusPosition > included;
}

function isPrintFreeByQuota(index, printTypeId) {
  const quota = getQuotaMap();
  for (let i = 0; i <= index; i += 1) {
    const photo = state.photos[i];
    const typeId = (photo.printType || 'basic_10x15').replace(/_(r|e)$/, '');
    const option = PRINT_OPTIONS.find((item) => item.id === typeId);
    if (!option || option.retouched === 0) continue;
    const match = quota.find((item) => item.id === typeId && item.qty > 0);
    if (match) {
      if (i === index && typeId === printTypeId) return true;
      match.qty -= 1;
    }
  }
  return false;
}

function calcTotal() {
  const extraRetouch = getRetouchExtraCount() * Number(state.session?.retouchPrice || 0);
  const printUpgrade = state.photos.reduce((sum, photo, index) => {
    const typeId = (photo.printType || 'basic_10x15').replace(/_(r|e)$/, '');
    const option = PRINT_OPTIONS.find((item) => item.id === typeId) || PRINT_OPTIONS[0];
    if (option.retouched === 0) return sum;
    return sum + (isPrintFreeByQuota(index, typeId) ? 0 : option.retouched);
  }, 0);
  const extraPrints = state.prints.reduce((sum, print) => {
    const option = PRINT_OPTIONS.find((item) => item.id === print.printId) || PRINT_OPTIONS[0];
    return sum + option.additional * (Number(print.qty) || 1);
  }, 0);
  return extraRetouch + printUpgrade + extraPrints;
}

/* ========================================================================
 * 갤러리 (1차 셀렉 — 별점 분류)
 * ====================================================================== */

async function loadGallery() {
  if (state.gallery.loading || state.gallery.loaded) return;
  state.gallery.loading = true;
  if (els.galleryStatus) els.galleryStatus.textContent = '불러오는 중...';
  try {
    const cacheKey = getGalleryCacheKey();
    const cached = cacheKey ? readGalleryCache(cacheKey) : null;
    if (cached?.photos?.length) {
      applyGalleryPayload(cached);
      if (els.galleryLoadingHint) els.galleryLoadingHint.style.display = 'none';
      if (els.galleryStatus) els.galleryStatus.textContent = '빠르게 불러왔습니다.';
      return;
    }
    let res;
    if (state.previewMode) {
      if (state.previewFolder || state.session?.driveLink) {
        res = await fetchSelectPreviewPhotos(state.previewFolder || state.session.driveLink);
      } else {
        res = { photos: buildMockGalleryPhotos(80) };
      }
    } else {
      res = await fetchSelectPhotos(state.sessionId);
    }
    applyGalleryPayload(res);
    if (cacheKey && res?.photos?.length) writeGalleryCache(cacheKey, res);
    if (els.galleryStatus) els.galleryStatus.textContent = '';
    if (els.galleryLoadingHint) els.galleryLoadingHint.style.display = 'none';
  } catch (err) {
    if (els.galleryLoadingHint) {
      els.galleryLoadingHint.textContent = '갤러리 불러오기 실패: ' + (err.message || err);
    }
  } finally {
    state.gallery.loading = false;
  }
}

function applyGalleryPayload(res) {
  const photos = normalizeGalleryPhotos(Array.isArray(res?.photos) ? res.photos : []);
  state.gallery.photos = photos;
  state.gallery.byKey = new Map();
  state.gallery.renderCount = Math.min(GALLERY_INITIAL_RENDER, photos.length || GALLERY_INITIAL_RENDER);
  photos.forEach((p) => state.gallery.byKey.set(stripExt(p.name), p));
  state.photos.forEach((ph) => {
    if (ph.isBonus) return;
    const key = stripExt(ph.num);
    if (key && state.gallery.byKey.has(key) && !state.gallery.ratings.has(key)) {
      state.gallery.ratings.set(key, 5);
    }
  });
  state.gallery.loaded = true;
  renderGallery();
  renderPhotos();
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
      view: photo?.view || (id ? `https://drive.google.com/file/d/${id}/view` : '#')
    };
  });
}

function buildDriveThumbUrl(id, width) {
  if (!id) return '';
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`;
}

function buildDriveThumbSrcSet(id) {
  if (!id) return '';
  return [240, 360, 480, 720, 960, 1280]
    .map((width) => `${buildDriveThumbUrl(id, width)} ${width}w`)
    .join(', ');
}

function getGalleryCacheKey() {
  if (state.previewMode) return `preview:${state.previewFolder || state.session?.driveLink || 'mock'}`;
  return state.sessionId ? `session:${state.sessionId}` : '';
}

function readGalleryCache(cacheKey) {
  try {
    const raw = globalThis.sessionStorage?.getItem(`selectGallery:${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.photos?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeGalleryCache(cacheKey, payload) {
  try {
    globalThis.sessionStorage?.setItem(`selectGallery:${cacheKey}`, JSON.stringify({
      photos: Array.isArray(payload?.photos) ? payload.photos : []
    }));
  } catch {}
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
    // 갤러리에서 선택한 사진 → source='gallery' (초과해도 무료)
    const entry = { num: photoKey, note: '', printType: 'basic_10x15', isBonus: false, source: 'gallery' };
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
      <img src="${escapeHtml(p.thumb)}" srcset="${escapeHtml(p.thumbSet || '')}" sizes="${escapeHtml(sizes)}" data-full="${escapeHtml(p.full || p.thumb)}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async" fetchpriority="${idx < 8 ? 'high' : 'low'}" referrerpolicy="no-referrer" onerror="this.style.opacity=0.3;">
      <button type="button" class="gallery-zoom" data-zoom-key="${escapeHtml(key)}" aria-label="크게 보기" title="크게 보기 (Space)">보기</button>
      ${star > 0 ? `<div class="cell-star-badge">${star}점</div>` : ''}
      <div class="cell-stars">${starsHtml}</div>
      <div class="gallery-name">${escapeHtml(p.name)}</div>
    </div>`;
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
    els.galleryCount.textContent = `${rated} / ${total}장 별점 부여됨`;
  }
  if (els.gallerySelectedSummary) {
    els.gallerySelectedSummary.innerHTML = rated
      ? `<b>현재 별점 분포:</b> ⭐5 ${byStar[5]}장 · ⭐4 ${byStar[4]}장 · ⭐3 ${byStar[3]}장 · ⭐2 ${byStar[2]}장 · ⭐1 ${byStar[1]}장 &nbsp;→&nbsp; 다음 단계에서 총 <b>${rated}장</b>이 보정 목록에 자동으로 담깁니다.`
      : '아직 별점을 준 사진이 없습니다. 마음에 드는 사진에 1~5 숫자키 또는 별 아이콘으로 별점을 주세요.';
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

function renderLightbox() {
  const lb = state.lightbox;
  if (!lb) return;
  const p = lb.list[lb.index];
  if (!p) return;
  const img = document.getElementById('lb-img');
  if (img) img.src = p.full || p.thumb;
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
  // 수동 추가 = source='manual' (기본 장수 초과 시 유료)
  const newPhoto = { num: '', note: '', printType: 'basic_10x15', isBonus: false, source: 'manual' };
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

function renderPhotos() {
  if (!state.photos.length) {
    els.photoList.innerHTML = '<div class="empty-state">아직 선택된 보정 사진이 없습니다. 1차 셀렉에서 별점을 준 사진이 이곳에 자동으로 채워지거나, 아래 버튼으로 직접 추가할 수 있습니다.</div>';
    return;
  }
  const retouchPrice = Number(state.session?.retouchPrice || 0);
  els.photoList.innerHTML = state.photos.map((photo, index) => {
    const typeId = (photo.printType || 'basic_10x15').replace(/_(r|e)$/, '');
    const option = PRINT_OPTIONS.find((item) => item.id === typeId) || PRINT_OPTIONS[0];
    const paid = isPhotoPaid(photo, index);
    const source = photo.source || (photo.isBonus ? 'bonus' : 'manual');
    const extra = paid ? `<span class="extra-badge">+€${retouchPrice}</span>` : '';
    const bonus = photo.isBonus
      ? '<span class="bonus-badge">마케팅 보너스</span>'
      : source === 'gallery'
        ? '<span class="gallery-badge">갤러리 · 무료</span>'
        : '<span class="manual-badge">직접 추가</span>';
    const free = option.retouched === 0 || isPrintFreeByQuota(index, typeId);
    const key = stripExt(photo.num);
    const star = key ? getStarOf(key) : 0;
    const starChip = star ? `<span class="entry-star-chip">${star}점</span>` : '';
    return `
      <div class="entry-card${photo.isBonus ? ' bonus' : ''}">
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
            <textarea data-photo-note="${index}" placeholder="예: 얼굴 라인을 자연스럽게 정리해 주세요. / 이마 번들거림을 줄이고 피부 톤을 균일하게 해주세요. / 옷 주름(어깨/가슴)을 자연스럽게 정리해 주세요.">${escapeHtml(photo.note || '')}</textarea>
          </div>
          <div class="field-full">
            <label>인화 사이즈</label>
            <select data-photo-print="${index}">
              ${PRINT_OPTIONS.map((item) => `<option value="${item.id}"${item.id === typeId ? ' selected' : ''}>${escapeHtml(item.label)} — ${item.retouched === 0 ? '무료' : `+€${item.retouched}`}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="price-line">
          <span>인화 업그레이드 비용</span>
          <strong class="${free ? 'free' : 'paid'}">${free ? '무료' : `+€${option.retouched}`}</strong>
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
      state.photos[Number(select.dataset.photoPrint)].printType = select.value;
      renderPhotos();
      updatePhotoCounter();
      updateReview();
    });
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
  const bonusCount = state.photos.filter((p) => p.isBonus).length;
  els.photoCounter.textContent = `${selected}장 선택됨 / 기본 ${base}장 포함`;
  const parts = [];
  if (galleryCount) parts.push(`갤러리 ${galleryCount}장(무료)`);
  if (manualCount) parts.push(`직접 추가 ${manualCount}장`);
  if (bonusCount) parts.push(`마케팅 보너스 ${bonusCount}장(무료)`);
  els.photoCounterSub.textContent = parts.length
    ? parts.join(' · ') + (extra > 0 ? ` · ${base + 1}번째 이후 직접 추가분이 유료로 계산됩니다.` : ' · 추가 보정 비용 없음')
    : '별점을 주거나 직접 항목을 추가하면 여기에 구성이 표시됩니다.';
  els.extraCost.textContent = extra > 0 ? `추가 ${extra}장 × €${retouchPrice} = €${extra * retouchPrice}` : '추가 보정 비용 없음';
}

/* ========================================================================
 * 추가 인화 (Step 3)
 * ====================================================================== */
function addPrintRow() {
  state.prints.push({ photoNum: '', printId: 'basic_10x15', qty: 1 });
  renderPrints();
  updateReview();
}

function renderPrints() {
  if (!state.prints.length) {
    els.printList.innerHTML = '<div class="empty-state">추가 인화 주문이 없습니다. 필요한 경우 아래 버튼으로 추가해 주세요.</div>';
    return;
  }
  els.printList.innerHTML = state.prints.map((print, index) => {
    const option = PRINT_OPTIONS.find((item) => item.id === print.printId) || PRINT_OPTIONS[0];
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
              ${PRINT_OPTIONS.map((item) => `<option value="${item.id}"${item.id === print.printId ? ' selected' : ''}>${escapeHtml(item.label)} — €${item.additional}</option>`).join('')}
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
  if (state.deliveryMethod === 'pickup') {
    if (state.pickupDate && state.pickupTime) return `스튜디오 픽업 · ${state.pickupDate} ${state.pickupTime}`;
    return '스튜디오 픽업 · 날짜와 시간을 선택해 주세요.';
  }
  if (state.deliveryMethod === 'mail') {
    return state.mailAddress ? `우편 수령 · ${state.mailAddress}` : '우편 수령 · 주소를 입력해 주세요.';
  }
  return '아직 수령 방식을 선택하지 않았습니다.';
}

function validateDeliverySelection() {
  if (!state.deliveryMethod) { setBanner('수령 방식을 먼저 선택해 주세요.', 'error'); return false; }
  if (state.deliveryMethod === 'pickup') {
    if (!state.pickupDate || !state.pickupTime) { setBanner('픽업 날짜와 시간을 모두 선택해 주세요.', 'error'); return false; }
    return true;
  }
  if (!String(state.mailAddress || '').trim()) { setBanner('우편 수령 주소를 입력해 주세요.', 'error'); return false; }
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
        const option = PRINT_OPTIONS.find((item) => item.id === photo.printType) || PRINT_OPTIONS[0];
        const source = photo.source || (photo.isBonus ? 'bonus' : 'manual');
        const paid = isPhotoPaid(photo, index);
        const extra = paid
          ? `+€${retouchPrice}`
          : photo.isBonus
            ? '마케팅 보너스'
            : source === 'gallery'
              ? '갤러리 · 무료'
              : '포함';
        const free = option.retouched === 0 || isPrintFreeByQuota(index, photo.printType);
        return `
          <div class="review-item">
            <div>
              <strong>${escapeHtml(photo.num || `사진 ${index + 1}`)}</strong>
              <div class="review-note">${escapeHtml(photo.note || '')}</div>
            </div>
            <div style="text-align:right;">
              <div>${escapeHtml(option.label)}</div>
              <div class="review-note">${free ? '무료' : `+€${option.retouched}`} / ${extra}</div>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state">선택된 보정 사진이 없습니다.</div>';

  els.reviewPrints.innerHTML = state.prints.length
    ? state.prints.map((print) => {
        const option = PRINT_OPTIONS.find((item) => item.id === print.printId) || PRINT_OPTIONS[0];
        return `
          <div class="review-item">
            <span>${escapeHtml(print.photoNum || '-')} · ${escapeHtml(option.label)} × ${escapeHtml(print.qty || 1)}</span>
            <strong>€${option.additional * (Number(print.qty) || 1)}</strong>
          </div>
        `;
      }).join('')
    : '<div class="empty-state">추가 인화 없음</div>';

  els.reviewMarketing.textContent = state.marketing === 'Y' ? '동의' : '미동의';
  els.reviewDelivery.textContent = getDeliveryReviewText();
  els.reviewTotal.textContent = calcTotal() === 0 ? '무료' : `€${calcTotal()}`;
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
  if (step === 4) updateReview();
  globalThis.scrollTo({ top: 0, behavior: 'smooth' });
}

function canSubmit() {
  if (!state.marketing) return false; // Step 1에서 이미 체크됨
  if (!state.photos.length) return false;
  if (state.photos.some((photo) => !String(photo.num || '').trim() || !String(photo.note || '').trim())) return false;
  if (state.prints.some((print) => !String(print.photoNum || '').trim())) return false;
  if (!state.deliveryMethod) return false;
  if (state.deliveryMethod === 'pickup' && (!state.pickupDate || !state.pickupTime)) return false;
  if (state.deliveryMethod === 'mail' && !String(state.mailAddress || '').trim()) return false;
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
  return !state.photos.some((photo) => !String(photo.num || '').trim() || !String(photo.note || '').trim());
}

function canProceedStep3() {
  return !state.prints.some((print) => !String(print.photoNum || '').trim());
}

function renderStepWarnings() {
  const step1Message = canProceedStep1()
    ? ''
    : !state.marketing
      ? '마케팅 동의 여부(동의 / 미동의)를 먼저 선택해 주세요. 동의 시 보너스 보정 2장이 무료로 추가됩니다.'
      : '1차 셀렉에서 별점을 준 사진이 아직 없어요. 마음에 드는 사진에 별을 부여해 주세요.';
  const step2Message = canProceedStep2()
    ? ''
    : !state.photos.length
      ? '보정 사진을 최소 1장 추가해야 다음 단계로 이동할 수 있습니다.'
      : '모든 사진의 번호와 보정 요청사항(구체적으로)을 입력해야 다음 버튼이 활성화됩니다.';
  const step3Message = canProceedStep3() ? '' : '추가 인화의 사진 번호를 모두 입력해야 다음 단계로 이동할 수 있습니다.';
  const step4Message = canSubmit()
    ? ''
    : !state.deliveryMethod
      ? '수령 방식을 선택해야 제출할 수 있습니다.'
      : state.deliveryMethod === 'pickup' && (!state.pickupDate || !state.pickupTime)
        ? '픽업 날짜와 시간을 선택해야 제출할 수 있습니다.'
        : state.deliveryMethod === 'mail' && !String(state.mailAddress || '').trim()
          ? '우편 수령 주소를 입력해야 제출할 수 있습니다.'
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
    baseRetouchCount: 10,
    retouchPrice: 10,
    lang: 'ko',
    driveLink: state.previewFolder || 'https://drive.google.com/drive/folders/1J3p6L1xmYnGSi4TzxzOz5Ket2uvkGMLP?usp=drive_link',
    bookingMarketing: '',
    bookingAddress: '',
    deadline: '',
    revisionCount: 0,
    extraInvoiceNumber: '',
    existingDeliveryMethod: '',
    existingPickupAt: '',
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
  const payload = {
    photos: state.photos,
    prints: state.prints.map((print) => {
      const option = PRINT_OPTIONS.find((item) => item.id === print.printId) || PRINT_OPTIONS[0];
      return { ...print, label: option.label, price: option.additional, isRetouched: false };
    }),
    marketing: state.marketing,
    deliveryMethod: state.deliveryMethod,
    pickupDate: state.deliveryMethod === 'pickup' ? state.pickupDate : '',
    pickupTime: state.deliveryMethod === 'pickup' ? state.pickupTime : '',
    mailAddress: state.deliveryMethod === 'mail' ? String(state.mailAddress || '').trim() : '',
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
  els.successGuide.innerHTML = `
    <div class="detail-title">선택 요약</div>
    <div class="guide-copy">보정 선택 ${state.photos.length}장 · 추가 인화 ${state.prints.length}건 · 마케팅 동의 ${state.marketing === 'Y' ? '동의' : '미동의'}</div>
    <div class="guide-copy">수령 방식: ${escapeHtml(getDeliveryReviewText())}</div>
    ${result?.invoiceNumber ? `<div class="guide-copy">추가 비용 인보이스: <b>${escapeHtml(result.invoiceNumber)}</b></div>` : ''}
  `;
  if (state.session?.driveLink) {
    els.successDriveLink.href = state.session.driveLink;
    els.successDriveLink.classList.remove('hidden');
  }
  globalThis.scrollTo({ top: 0, behavior: 'smooth' });
}
