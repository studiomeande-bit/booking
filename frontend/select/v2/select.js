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
import {
  getPrintMicrocopy,
  getPrintTier,
  getPrintTierCopy,
  getPrintTierName
} from '../../shared/print-tier-copy.js';
import { createRequestId, escapeHtml, formatMonthLabel, pad2 } from '../../shared/utils.js';
import { PRINT_CATALOG, printCatalogName } from '../../shared/print-catalog.js';
import { getCopy, normalizeLang } from './i18n.js';

// ⚠ additional(추가 인화 단가)은 예약 안내용 shared/print-catalog.js 와 동일하게 유지할 것(값 변경 시 함께 수정).
const PRINT_OPTIONS = [
  { id: PRINT_NONE_ID, label: '출력 없음', retouched: 0, additional: 0 },
  { id: 'basic_10x15', label: '시그니처 10×15cm', retouched: 3, additional: 4 },
  { id: 'premium_10x15', label: '파인아트 10×15cm', retouched: 6, additional: 8 },
  { id: 'photocard_single', label: '포토카드 프린트 (단면)', retouched: 5, additional: 5 },
  { id: 'photocard_double', label: '포토카드 프린트 (양면)', retouched: 8, additional: 8 },
  { id: 'basic_a4', label: '시그니처 A4', retouched: 10, additional: 15 },
  { id: 'premium_a4', label: '파인아트 A4', retouched: 15, additional: 20 },
  { id: 'premium_a3', label: '파인아트 A3', retouched: 35, additional: 50 },
  { id: 'premium_a3plus', label: '파인아트 A3+', retouched: 45, additional: 60 }
];

// 등급 비교 카드용 대표 SKU — 등급 카피는 print-tier-copy.js 가 단일 소스라 getPrintTierCopy(id)로만 읽는다.
const PRINT_TIER_SAMPLE_ID = { signature: 'basic_10x15', fineart: 'premium_10x15' };
// 같은 사이즈의 시그니처 ↔ 파인아트 대응 SKU. 차액 표시(표시 전용)에만 쓰고 계산에는 관여하지 않는다.

// 인화 사이즈(mm) — 가장자리 프리뷰의 용지 비율 계산용 (인화앱 PRINT_SIZE_MM와 일치)
const PRINT_SIZE_MM_V2 = {
  basic_10x15: [100, 150], premium_10x15: [100, 150],
  basic_a4: [210, 297], premium_a4: [210, 297],
  premium_a3: [297, 420], premium_a3plus: [329, 483],
  photocard_single: [55, 85], photocard_double: [55, 85],
};
function printAspect(printId) {
  const s = PRINT_SIZE_MM_V2[normalizePrintTypeId(printId)] || [100, 150];
  return s[0] / s[1]; // 세로 기준 w/h
}

/* Keys are the wire values sent to the server; the visible label and help text
   are looked up per language in i18n.js. */
const PHOTOCARD_MODES = ['retouched', 'mixed', 'original'];

function photocardModeLabel(mode) {
  const c = copy();
  return mode === 'mixed' ? c.pcModeMixed : mode === 'original' ? c.pcModeOriginal : c.pcModeRetouched;
}

function photocardModeHelp(mode) {
  const c = copy();
  return mode === 'mixed' ? c.pcHintMixed : mode === 'original' ? c.pcHintOriginal : c.pcHintRetouched;
}

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
/* 포함 쿼터 1장이 상쇄해 주는 금액 — 서버 selectQuotaCredit_ 와 동일 규칙.
   비교 맥락을 맞추려고, 그 행이 보정본이면 쿼터 SKU 의 보정본가를, 추가 인화면 추가 인화가를 쓴다. */
function getQuotaCreditValue(quotaId, isRetouched) {
  const opt = getPrintOption(quotaId);
  return isRetouched ? Number(opt.retouched) || 0 : Number(opt.additional) || 0;
}

function computePrintAnnotations() {
  const quota = getSessionIncludedPrintQuota().map((item) => ({ id: item.id, qty: Number(item.qty) || 0 }));
  // 서비스 컷: 서비스 슬롯 번호마다 인화 1건(1장)에 €3(시그니처 10×15 보정본가) 크레딧. 총 크레딧은 serviceCutCount로 상한.
  // 서버 computeSelectDecoupledPrints_ 와 완전히 동일한 규칙 — 유닛(장) 단위 적용 + 상한, 인화 행 순서대로 소진.
  const serviceCredit = {};
  state.photos.forEach((p) => {
    if (!p?.isService) return;
    const k = printNumKey(p.num);
    if (k) serviceCredit[k] = (serviceCredit[k] || 0) + 1;
  });
  let serviceCreditsRemaining = getServiceCutCount();
  const basicPrintCredit = Number(getPrintOption('basic_10x15').retouched) || 0;
  /* 쿼터 배정은 행 순서와 무관해야 한다 — 서버 computeSelectDecoupledPrints_ 와 **동일한 2-pass**.
     그리디로 행마다 처리하면 같은 주문이 입력 순서에 따라 총액이 달라진다(파인아트10×15 가 A4 쿼터를 먼저 삼킴).
     ① 1차 전역 정확일치(무료) ② 2차 남은 장을 단가 높은 순으로 최대 크레딧 쿼터에 배정. */
  const rows = state.prints.map((print) => {
    const typeId = normalizePrintTypeId(print.printId);
    const option = getPrintOption(typeId);
    const qty = Math.max(1, Number(print.qty) || 1);
    const isRetouched = isRetouchedPhotoNum(print.photoNum);
    const unit = isRetouched ? Number(option.retouched) || 0 : Number(option.additional) || 0;
    return { print, typeId, option, qty, isRetouched, unit, numKey: printNumKey(print.photoNum) };
  });
  const units = [];
  rows.forEach((r, rowIndex) => {
    /* '출력 없음' 행은 아예 참여시키지 않는다 — 서버 computeSelectDecoupledPrints_ 도 print_none 을 건너뛴다.
       유닛으로 펼치면 단가 0이라 2차 배정에서 남은 포함 쿼터를 집어가고, 리뷰 화면에 그 빈 행이
       '포함'으로 표시된다(서버 청구엔 없는 항목). 금액은 0이라 총액으로는 드러나지 않는다. */
    if (r.typeId === PRINT_NONE_ID) return;
    // 포토카드는 포함 쿼터 대상 밖(사장님 확정 2026-07-26) — 쿼터를 소진하지도, 상쇄받지도 않고 항상 정가.
    // 서버 computeSelectDecoupledPrints_ 의 skipQuota 와 동일 규칙.
    const skipQuota = /^photocard_/.test(r.typeId);
    for (let k = 0; k < r.qty; k += 1) {
      units.push({ rowIndex, typeId: r.typeId, unit: r.unit, isRetouched: r.isRetouched, credit: 0, matched: false, skipQuota });
    }
  });
  units.forEach((u) => {
    if (u.skipQuota) return;
    const m = quota.find((q) => q.id === u.typeId && q.qty > 0);
    if (m) { m.qty -= 1; u.credit = u.unit; u.matched = true; }
  });
  units.filter((u) => !u.matched && !u.skipQuota)
    .slice()
    .sort((a, b) => b.unit - a.unit)
    .forEach((u) => {
      let best = null;
      let bestCredit = -1;
      quota.forEach((q) => {
        if (!(q.qty > 0)) return;
        const c = getQuotaCreditValue(q.id, u.isRetouched);
        if (c > bestCredit) { bestCredit = c; best = q; }
      });
      if (best) { best.qty -= 1; u.credit = Math.max(0, bestCredit); u.matched = true; }
    });

  const acc = rows.map(() => ({ includedQty: 0, quotaDiffQty: 0, quotaCredit: 0, amount: 0, serviceDiscount: 0, serviceCreditUnits: 0 }));
  // 서비스 컷 크레딧은 서버와 같은 순서(행→장)로 적용해야 결과가 일치한다.
  units.forEach((u) => {
    const r = rows[u.rowIndex];
    const a = acc[u.rowIndex];
    let unitCharge = u.matched ? Math.max(0, u.unit - u.credit) : u.unit;
    if (u.matched) {
      if (unitCharge <= 0) a.includedQty += 1;
      else { a.quotaDiffQty += 1; a.quotaCredit += u.credit; }
    }
    if (unitCharge > 0 && r.numKey && serviceCredit[r.numKey] > 0 && serviceCreditsRemaining > 0) {
      const disc = Math.min(unitCharge, basicPrintCredit);
      if (disc > 0) {
        unitCharge = Math.max(0, unitCharge - disc);
        a.serviceDiscount += disc;
        a.serviceCreditUnits += 1;
        serviceCredit[r.numKey] -= 1;
        serviceCreditsRemaining -= 1;
      }
    }
    a.amount += unitCharge;
  });

  return rows.map((r, idx) => {
    const a = acc[idx];
    return {
      option: r.option, qty: r.qty, isRetouched: r.isRetouched, unit: r.unit,
      includedQty: a.includedQty, chargedQty: r.qty - a.includedQty,
      quotaDiffQty: a.quotaDiffQty, quotaCredit: a.quotaCredit,
      amount: a.amount, serviceDiscount: a.serviceDiscount, serviceCreditUnits: a.serviceCreditUnits
    };
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
    label: printOptionLabel(getPrintOption(q.id)),
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

const LANG_STORAGE_KEY = 'studio-mean-lang';

function readStoredLang() {
  try {
    return normalizeLang(globalThis.localStorage?.getItem(LANG_STORAGE_KEY));
  } catch {
    return '';
  }
}

const state = {
  sessionId: new URLSearchParams(globalThis.location.search).get('id') || '',
  lang: normalizeLang(new URLSearchParams(globalThis.location.search).get('lang')) || readStoredLang() || 'ko',
  /* true once the customer picks a language by hand — stops the session's
     booking language from overriding their choice on a later render. */
  langChosen: !!normalizeLang(new URLSearchParams(globalThis.location.search).get('lang')) || !!readStoredLang(),
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
  langButtons: Array.from(document.querySelectorAll('.lang-btn')),
  loadingScreen: document.getElementById('loadingScreen'),
  banner: document.getElementById('statusBanner'),
  errorPanel: document.getElementById('errorPanel'),
  donePanel: document.getElementById('donePanel'),
  doneTitle: document.getElementById('doneTitle'),
  doneBody: document.getElementById('doneBody'),
  doneDriveBtn: document.getElementById('doneDriveBtn'),
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
  pickupDeferredNote: document.getElementById('pickupDeferredNote'),
  pickupExistingLine: document.getElementById('pickupExistingLine'),
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

/* ---------------------------------------------------------------- i18n ----
 * Static copy is marked up in index.html and swapped here:
 *   data-i18n="key"                    -> textContent
 *   data-i18n-html="key"               -> innerHTML (constants in i18n.js only)
 *   data-i18n-attr="attr:key,attr:key" -> attributes (placeholder, aria-label, title)
 */
function copy() {
  return getCopy(state.lang);
}

function applyCopy() {
  const c = copy();
  document.documentElement.lang = state.lang;
  document.title = c.docTitle;
  /* site-analytics.js renders the cookie prompt before the session language is
     known, so tell it to re-apply its copy. */
  document.dispatchEvent(new CustomEvent('studiomean:langchange'));

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = c[el.dataset.i18n];
    if (typeof value === 'string') el.textContent = value;
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const value = c[el.dataset.i18nHtml];
    if (typeof value === 'string') el.innerHTML = value;
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((part) => part.trim());
      const value = c[key];
      if (attr && typeof value === 'string') el.setAttribute(attr, value);
    });
  });

  /* Created once at boot, before the session language is known. */
  const previewBanner = document.getElementById('previewBanner');
  if (previewBanner) previewBanner.textContent = c.previewBanner;

  const weekdays = document.getElementById('pickupWeekdays');
  if (weekdays) {
    weekdays.querySelectorAll('span').forEach((cell, index) => {
      if (c.weekdays[index]) cell.textContent = c.weekdays[index];
    });
  }

  els.langButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === state.lang);
  });
}

function setLang(lang) {
  const next = normalizeLang(lang);
  if (!next || next === state.lang) return;
  state.lang = next;
  state.langChosen = true;
  try {
    globalThis.localStorage?.setItem(LANG_STORAGE_KEY, next);
  } catch {
    // Ignore storage errors and keep the runtime language in memory.
  }
  applyCopy();
  rerenderForLang();
}

/* Re-runs the renderers that emit copy. Dynamic strings inside these
   still come from Korean literals in this file — migrating those is the
   next batch — but the static surface and anything already keyed updates. */
function rerenderForLang() {
  // 완료 화면은 state.session 없이 떠 있으므로 아래 가드보다 먼저 처리해야 언어 전환이 먹는다
  if (state.doneSession) { renderDoneScreen(); return; }
  if (!state.session) return;
  renderHeader();
  renderSessionSummary();
  renderPackageSummary();
  updateMarketingCopy();
  renderPriceGuide();
  renderPhotos();
  renderPhotocardBox();
  renderPrints();
  updatePhotoCounter();
  updateReview();
  updateSubmitState();
  syncDeliveryUi();
  renderStepWarnings();
  renderServiceCutNotice();
  renderRetouchScopeNotice();
  /* The gallery grid and its status line are built once when photos arrive,
     so they need an explicit redraw on a language change. */
  if (state.gallery.photos.length) {
    renderGallery();
    renderGalleryCounts();
    updateGalleryLoadingNotice({ done: !!state.gallery.fullLoaded });
  }
  /* Skip while a submit is in flight — the button then shows a progress label
     that onSubmit owns. updateSubmitState() re-derives disabled separately. */
  if (els.submitBtn && !els.submitBtn.disabled) {
    els.submitBtn.textContent = state.editMode ? copy().submitLabelEdit : copy().submitLabel;
  }
}

function wireLanguageSwitcher() {
  els.langButtons.forEach((button) => {
    button.addEventListener('click', () => setLang(button.dataset.lang));
  });
}

/* Deferred so the whole module body finishes evaluating first: boot() runs
   before the module-level consts below are initialised otherwise, which
   broke ?preview=1 (the customer path only survived because
   `await fetchSelectSession` happened to yield first). */
queueMicrotask(boot);

async function boot() {
  wireEvents();
  wireLanguageSwitcher();
  applyCopy();
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
    showError(copy().errNoSessionId);
    return;
  }
  try {
    const session = await fetchSelectSession(state.sessionId);
    /* 최종작업완료로 마감된 세션 — 오류가 아니라 '끝났습니다' 안내다.
       hydrate 하면 canEdit 이 없어 신규 제출 모드로 열리고, 고객이 다 채운 뒤 제출에서 거절당한다. */
    if (session?.finalLocked) {
      showDoneScreen(session);
      hideLoading();
      return;
    }
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
    // 출력 후 픽업예약 흐름: 제출 단계에서 달력을 더 이상 열지 않는다.
    // (구흐름에서 이미 잡힌 픽업일시는 state에 하이드레이션되어 안내문에 표시만 한다)
    setBanner(state.editMode ? copy().bannerLoadedEdit : copy().bannerLoaded, 'success');
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

/* 마감된 세션의 완료 화면 — 고객 입장에선 잘못된 게 아니라 다 끝난 것이다. */
function showDoneScreen(session) {
  state.doneSession = session;
  // 세션 언어로 먼저 맞춘다(고객이 URL/저장값으로 직접 고른 경우는 그쪽이 우선).
  if (!state.langChosen) {
    const sessionLang = normalizeLang(session.lang);
    if (sessionLang && sessionLang !== state.lang) {
      state.lang = sessionLang;
      applyCopy();
    }
  }
  els.errorPanel.classList.add('hidden');
  els.appPanel.classList.add('hidden');
  els.successPanel.classList.add('hidden');
  els.progressRow?.classList.add('hidden');
  els.donePanel.classList.remove('hidden');
  renderDoneScreen();
}

function renderDoneScreen() {
  const session = state.doneSession;
  if (!session) return;
  const c = copy();
  /* 수령 여부를 단정하지 않는다 — 어드민에서 '출력 → 최종작업완료'로 먼저 마감하는 경우가 있어,
     아직 찾아가지 않은 고객에게 '수령하셨습니다'라고 말하면 거짓말이 된다. */
  const handedOver = !!String(session.handoverAt || '').trim();
  els.doneTitle.textContent = c.doneTitle;
  els.doneBody.textContent = handedOver ? c.doneBodyHandedOver : c.doneBody;
  setBanner(c.doneTitle, 'success');
  const link = String(session.driveLink || '').trim();
  els.doneDriveBtn.classList.toggle('hidden', !link);
  if (link) {
    els.doneDriveBtn.href = link;
    els.doneDriveBtn.textContent = c.doneDrive;
  }
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
  /* The customer booked in some language; open the page in it. An explicit
     ?lang= or a stored manual choice takes precedence. */
  if (!state.langChosen) {
    const sessionLang = normalizeLang(session.lang);
    if (sessionLang && sessionLang !== state.lang) {
      state.lang = sessionLang;
      applyCopy();
    }
  }
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
  // 갤러리 프리페치: 고객이 스텝0 안내를 읽는 동안 Drive 사진 목록(수 초)을 미리 받아
  // 1차 셀렉 진입이 즉시 열리도록 한다 (진입 시 loadGallery 가드가 중복 호출 방지)
  setTimeout(() => {
    try { if (!state.gallery.loaded && !state.gallery.loading) loadGallery(); } catch (e) {}
  }, 250);
}

function getSessionProductInput(session = state.session) {
  return {
    itemGroup: session?.itemGroup || '',
    product: session?.product || '',
    id: session?.productId || session?.itemId || ''
  };
}

/* Prices live in PRINT_OPTIONS above (billed values — do not move them).
   Display names come from shared/print-catalog.js, which already carries
   ko/en/de, so the label follows the customer's language. */
function printOptionLabel(option) {
  const item = PRINT_CATALOG.find((entry) => entry.id === option.id);
  return (item && printCatalogName(item, state.lang)) || option.label;
}

function getSelectablePrintOptions() {
  return PRINT_OPTIONS
    .filter((option) => option.id !== PRINT_NONE_ID)
    .map((option) => ({ ...option, label: printOptionLabel(option) }));
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
  return getProductIncludedPrintSummary(getSessionProductInput(session), state.lang);
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
  const c = copy();
  return `
    <div class="included-print-callout">
      <strong>${escapeHtml(c.includedPrintStrong(includedSummary))}</strong>
      <span>${escapeHtml(c.includedPrintNote)}</span>
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
    qty: Math.max(1, Number(print?.qty || 1) || 1),
    finish: (String(print?.finish || (print?.border ? 'border' : '')) === 'border') ? 'border' : 'full'
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
  const mode = PHOTOCARD_MODES.includes(String(value.mode || ''))
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
  return photocardModeLabel(mode);
}

function getPhotocardPayload() {
  if (!hasIncludedPhotocard()) return null;
  const mode = PHOTOCARD_MODES.includes(state.photocard.mode)
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
    photoNum: copy().pcPhotoNumField(payload.frontNum || '-', payload.backNum || '-'),
    printId: 'included_photocard',
    qty: payload.qty,
    label: copy().pcPrintLabel(payload.modeLabel),
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
    return copy().errPhotocardSides;
  }
  return '';
}

function getPhotocardReviewText() {
  const payload = getPhotocardPayload();
  if (!payload) return '';
  const countText = payload.qty > 1 ? ` · ${copy().pcCount(payload.qty)}` : '';
  const noteText = payload.note ? ` · ${payload.note}` : '';
  return copy().pcReview(payload.modeLabel, countText, payload.frontNum || '-', payload.backNum || '-', noteText);
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
  const c = copy();
  const name = state.session?.name || '';
  els.welcomeTitle.textContent = name ? c.greeting(name) : c.heroTitle;
  els.welcomeSub.textContent = state.editMode ? c.welcomeSubEdit : c.welcomeSubNew;
  if (state.testMode) {
    els.submitHint.textContent = state.editMode ? c.submitHintTestEdit : c.submitHintTestNew;
    return;
  }
  els.submitHint.textContent = state.editMode ? c.submitHintEdit : c.submitHintNew;
}

function renderSessionSummary() {
  const s = state.session;
  const c = copy();
  els.sessionSummary.innerHTML = `
    <div class="summary-item"><div class="summary-label">${escapeHtml(c.sumName)}</div><div class="summary-value">${escapeHtml(s.name || '')}</div></div>
    <div class="summary-item"><div class="summary-label">${escapeHtml(c.sumProduct)}</div><div class="summary-value">${escapeHtml(s.product || '')}</div></div>
    <div class="summary-item"><div class="summary-label">${escapeHtml(c.sumDate)}</div><div class="summary-value">${escapeHtml(s.date || '')}</div></div>
    <div class="summary-item"><div class="summary-label">${escapeHtml(c.sumBaseRetouch)}</div><div class="summary-value">${escapeHtml(c.photosUnit(s.baseRetouchCount || 0))}</div></div>
    ${getServiceCutCount() > 0 ? `<div class="summary-item service"><div class="summary-label">${escapeHtml(c.sumServiceCut)}</div><div class="summary-value">${escapeHtml(c.sumServiceCutValue(getServiceCutCount()))}</div></div>` : ''}
    <div class="summary-item"><div class="summary-label">${escapeHtml(c.sumRetouchPrice)}</div><div class="summary-value">€${escapeHtml(s.retouchPrice || 0)}</div></div>
    <div class="summary-item"><div class="summary-label">${escapeHtml(c.sumExtraInvoice)}</div><div class="summary-value">${escapeHtml(s.extraInvoiceNumber || '-')}</div></div>
  `;
}

function renderPackageSummary() {
  const s = state.session;
  const input = getSessionProductInput(s);
  const includedSummary = getIncludedPrintSummary(s);
  const hasFixedSpec = productHasFixedDeliverySpec(input);
  // 포함 인화의 등급명만 병기(설명 문장은 붙이지 않는다 — Step 3에서 안내한다).
  const includedTierSuffix = (() => {
    const names = [...new Set(getSessionIncludedPrintQuota(s).map((q) => getPrintTier(q.id)).filter(Boolean))]
      .map((tier) => getPrintTierName(tier, state.lang))
      .filter(Boolean);
    return names.length ? ` (${names.join(' · ')})` : '';
  })();
  const c = copy();
  const includedLine = includedSummary
    ? `<div class="guide-copy">${c.pkgIncludedHtml(escapeHtml(includedSummary), includedTierSuffix)}</div>`
    : hasFixedSpec
      ? `<div class="guide-copy">${c.pkgIncludedNoneHtml}</div>`
      : '';
  const deliveryLines = getProductDeliveryLines(input, state.lang, { includeNoPrintLine: false })
    .filter((line) => !/보정본|retouched|retusch/i.test(line));
  const autoPrintNotice = includedSummary
    ? `<div class="guide-copy">${c.pkgAutoPrintHtml}</div>`
    : '';
  els.packageSummary.innerHTML = `
    <div class="detail-title">${escapeHtml(c.pkgTitle)}</div>
    <div class="guide-copy">${c.pkgBaseHtml(escapeHtml(s.baseRetouchCount || 0), escapeHtml(s.retouchPrice || 0))}</div>
    ${getServiceCutCount() > 0 ? `<div class="guide-copy service-cut-inline">${c.pkgServiceCutHtml(getServiceCutCount())}</div>` : ''}
    ${includedLine}
    ${autoPrintNotice}
    ${deliveryLines.length ? `<div class="guide-copy">${deliveryLines.map(escapeHtml).join(' · ')}</div>` : ''}
    ${s.deadline ? `<div class="guide-copy">${escapeHtml(c.pkgDeadline(String(s.deadline).slice(0, 10)))}</div>` : ''}
    ${s.revisionCount ? `<div class="guide-copy">재수정 요청 횟수: ${escapeHtml(s.revisionCount)}회</div>` : ''}
  `;
  if (s.driveLink) {
    els.driveLink.href = s.driveLink;
    els.driveLink.classList.remove('hidden');
  }
}

// 등급 비교 카드 — 두 등급은 시각적으로 대등해야 한다(우열 표현 금지). 카피는 전부 print-tier-copy.js 원문.
function printTierCardsHtml() {
  const cards = ['signature', 'fineart'].map((tier) => {
    const tierCard = getPrintTierCopy(PRINT_TIER_SAMPLE_ID[tier], state.lang);
    if (!tierCard) return '';
    return `
      <div class="tier-card">
        <div class="tier-card-name">${tierCard.tierName}</div>
        <div class="tier-card-line">${tierCard.paperSpec}</div>
        <div class="tier-card-line">${tierCard.character}</div>
        <div class="tier-card-line">${tierCard.bestFor}</div>
      </div>`;
  }).join('');
  return cards ? `<div class="paper-tiers">${cards}</div>` : '';
}

function renderPriceGuide() {
  const priceRows = getSelectablePrintOptions().map((opt) => `
    <div class="review-item">
      <span>${escapeHtml(opt.label)}</span>
      <strong>€${opt.additional}</strong>
    </div>
  `).join('');
  els.printPriceGuide.innerHTML = printTierCardsHtml() + priceRows;
  // Step 3 안내 문장은 정적 HTML 에 박지 않고 모듈에서 주입한다 — 카피가 개정되면 여기 한 곳만 바뀐다.
  const tierNote = document.getElementById('printStepTierNote');
  if (tierNote) tierNote.textContent = getPrintMicrocopy('selectStepNote', state.lang);
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
const RETOUCH_SCOPE_WARN_RE = /합성|하늘|스카이|sky|체형|몸매|다리\s*길|비율\s*보정|주름|사람\s*(제거|지워|삭제)|행인|인물\s*(제거|지워|삭제)|지워\s*주/i;

function isRetouchScopeLimited() {
  const g = String(state.session?.itemGroup || '').trim().toLowerCase();
  return RETOUCH_SCOPE_LIMITED_GROUPS.some((k) => g === k.toLowerCase());
}

function retouchScopeNoticeHtml(compact) {
  const c = copy();
  const items = (list) => list.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  return `
    <div class="detail-title">${escapeHtml(c.scopeTitle)}</div>
    <div class="guide-copy">${c.scopeLeadHtml}</div>
    <div class="guide-examples">
      <div class="guide-ex good">
        <div class="guide-ex-head">${escapeHtml(c.scopeInHead)}</div>
        <ul>${items(c.scopeIn)}</ul>
      </div>
      <div class="guide-ex bad">
        <div class="guide-ex-head">${escapeHtml(c.scopeOutHead)}</div>
        <ul>${items(c.scopeOut)}</ul>
      </div>
    </div>
    ${compact ? '' : `<div class="guide-copy lettering-note">${c.scopeFootHtml}</div>`}
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
        ? copy().scopeSwapGood1
        : copy().scopeSwapGood2;
    });
  }
}

function retouchNotePlaceholder() {
  const c = copy();
  return isRetouchScopeLimited() ? c.notePlaceholderLimited : c.notePlaceholderFull;
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
    hint.textContent = copy().scopeHint;
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
  const c = copy();
  box.innerHTML = `<div class="service-cut-title">${escapeHtml(c.serviceCutTitle(count))}</div><div class="service-cut-copy">${c.serviceCutCopyHtml}</div>`;
}

function updateMarketingCopy() {
  const c = copy();
  const count = getMarketingBonusCount();
  const countLabel = c.photosUnit(count);
  if (els.marketingBonusTag) {
    els.marketingBonusTag.textContent = count > 0 ? c.marketingBonusTagOn(countLabel) : c.marketingBonusTagOff;
  }
  if (els.marketingYesBonusLabel) {
    els.marketingYesBonusLabel.textContent = count > 0 ? c.marketingYesBonusOn(countLabel) : c.marketingYesBonusOff;
  }
  if (!els.marketingCopy) return;
  if (state.session?.bookingMarketing === 'Y') {
    els.marketingCopy.textContent = count > 0 ? c.marketingAlreadyOn(countLabel) : c.marketingAlreadyOff;
    return;
  }
  els.marketingCopy.innerHTML = count > 0 ? c.marketingCopyOnHtml(countLabel) : c.marketingCopyOffHtml;
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
  // 출력 후 픽업예약 흐름: 픽업을 선택해도 여기서 시간을 예약하지 않는다.
  // 인화 완료 후 이메일로 받는 예약 페이지에서 일정을 신청한다.
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
  els.pickupScheduler?.classList.add('hidden'); // 출력 후 픽업예약: 제출 단계 스케줄러 비활성
  els.pickupDeferredNote?.classList.toggle('hidden', !deliveryRequired || method !== 'pickup');
  if (els.pickupExistingLine) {
    const hasExisting = method === 'pickup' && state.pickupDate && state.pickupTime;
    els.pickupExistingLine.classList.toggle('hidden', !hasExisting);
    els.pickupExistingLine.textContent = hasExisting ? copy().pickupExisting(state.pickupDate, state.pickupTime) : '';
  }
  els.mailAddressBox?.classList.toggle('hidden', !deliveryRequired || method !== 'mail');
  if (els.mailNameInput) els.mailNameInput.value = state.mailName || '';
  if (els.mailAddressInput) els.mailAddressInput.value = state.mailAddress || '';
  if (els.submitHint) {
    const c = copy();
    els.submitHint.textContent = deliveryRequired ? c.submitHintDelivery : c.submitHintNoDelivery;
  }
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
      if (!nextCursor) throw new Error(copy().errCursorMissing);
      if (seenCursors.has(nextCursor)) throw new Error(copy().errCursorRepeat);
      seenCursors.add(nextCursor);
      cursor = nextCursor;
      await waitForGalleryBatchDelay();
    }
    if (cacheKey && state.gallery.photos.length) writeGalleryCache(cacheKey, buildGalleryCachePayload());
    state.gallery.failCount = 0;
  } catch (err) {
    // 재시도 실패가 반복되면(2회+) 재시도 버튼만으로는 막다른 길 — 연락 탈출구를 함께 보여준다
    state.gallery.failCount = (state.gallery.failCount || 0) + 1;
    if (els.galleryLoadingHint) {
      const contactHtml = state.gallery.failCount >= 2
        ? `<div style="margin-top:10px;font-size:13px;color:#6b6b60;">${escapeHtml(copy().galleryContactFallback)}<br><a href="mailto:studio.mean.de@gmail.com" style="color:inherit;font-weight:600;">studio.mean.de@gmail.com</a></div>`
        : '';
      els.galleryLoadingHint.style.display = '';
      els.galleryLoadingHint.innerHTML = `
        <div>${escapeHtml(copy().errGalleryLoadHtml(err.message || err))}</div>
        <button type="button" class="gallery-more" data-gallery-retry style="margin-top:12px;">${escapeHtml(copy().galleryRetry)}</button>
        ${contactHtml}
      `;
      els.galleryLoadingHint.querySelector('[data-gallery-retry]')?.addEventListener('click', () => {
        state.gallery.loaded = false;
        state.gallery.loading = false;
        loadGallery({ force: true });
      });
    }
    if (els.galleryStatus) els.galleryStatus.textContent = copy().galleryLoadFailedShort;
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
  const c = copy();
  if (els.galleryStatus) {
    els.galleryStatus.textContent = done
      ? c.galleryAllLoaded(count)
      : count
        ? c.galleryLoadingCount(count)
        : c.galleryLoadingStart;
  }
  if (!els.galleryLoadingHint) return;
  if (done) {
    els.galleryLoadingHint.style.display = 'none';
    return;
  }
  els.galleryLoadingHint.style.display = '';
  els.galleryLoadingHint.innerHTML = count
    ? escapeHtml(c.galleryHintWithCount(count))
    : escapeHtml(c.galleryHintStart);
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
    ? `<button type="button" class="gallery-more" data-gallery-more>${escapeHtml(copy().galleryMore(visibleCount, list.length))}</button>`
    : '';
  els.galleryGrid.innerHTML = html
    ? `${html}${moreHtml}`
    : `<div class="empty-state" style="grid-column:1/-1;">${escapeHtml(copy().galleryNoPhotos)}</div>`;
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
  const c = copy();
  const starsHtml = [1, 2, 3, 4, 5].map((i) => `<button type="button" class="cell-star${i <= star ? ' on' : ''}" data-set-star="${i}" data-key="${escapeHtml(key)}" aria-label="${escapeHtml(c['lbStar' + i])}">★</button>`).join('');
  return `<div class="gallery-cell ${layoutClass}${selected}${focused}" data-gallery-key="${escapeHtml(key)}" data-gallery-idx="${idx}" title="${escapeHtml(p.name)}">
      <img src="${escapeHtml(p.thumb)}" srcset="${escapeHtml(p.thumbSet || '')}" sizes="${escapeHtml(sizes)}" data-full="${escapeHtml(p.full || p.thumb)}" data-fallback="${escapeHtml(p.fallback || '')}" alt="" loading="lazy" decoding="async" fetchpriority="${idx < 8 ? 'high' : 'low'}" referrerpolicy="no-referrer">
      <button type="button" class="gallery-zoom" data-zoom-key="${escapeHtml(key)}" aria-label="${escapeHtml(c.galleryZoomAria)}" title="${escapeHtml(c.galleryZoomTitle)}">${escapeHtml(c.galleryZoom)}</button>
      ${star > 0 ? `<div class="cell-star-badge">${escapeHtml(c.starBadge(star))}</div>` : ''}
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
  const c = copy();
  if (els.galleryCount) {
    els.galleryCount.textContent = c.galleryRatedOf(rated, total);
  }
  if (els.gallerySelectedSummary) {
    els.gallerySelectedSummary.innerHTML = rated
      ? c.galleryDistributionHtml(byStar, rated)
      : escapeHtml(c.galleryNoRatings);
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
    alert(copy().downloadPreviewAlert);
    return;
  }
  const driveLink = state.session?.driveLink || '';
  if (!driveLink) { alert(copy().downloadNoLink); return; }
  if (!confirm(copy().downloadConfirm)) return;
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
  const c = copy();
  if (!key) return `<div class="entry-thumb placeholder">${escapeHtml(c.thumbEmpty)}</div>`;
  const p = state.gallery.byKey.get(key);
  if (!p) return `<div class="entry-thumb placeholder">${c.thumbNotFoundHtml(escapeHtml(key))}</div>`;
  return `<div class="entry-thumb" data-zoom-entry="${escapeHtml(key)}">
    <img src="${escapeHtml(p.full || p.thumb)}" data-full="${escapeHtml(p.full || p.thumb)}" alt="${escapeHtml(p.name)}" referrerpolicy="no-referrer" loading="lazy" decoding="async">
    <button type="button" class="entry-thumb-zoom" data-zoom-entry="${escapeHtml(key)}" aria-label="${escapeHtml(c.thumbZoomAria)}" title="${escapeHtml(c.thumbZoomAria)}">${escapeHtml(c.thumbZoom)}</button>
  </div>`;
}

// 가장자리 마감(풀프레임/테두리) 토글 + 용지 비율 프리뷰. 인화앱 주문모드가 이 값대로 자동 셋팅한다.
function printFinishHtml(index, print) {
  const finish = print.finish === 'border' ? 'border' : 'full';
  const asp = printAspect(print.printId);
  // 저장된 값에 _r/_e 접미어가 붙어 있을 수 있어 등급 조회 전에 정규화한다.
  const tierId = normalizePrintTypeId(print.printId);
  const tier = getPrintTier(tierId);
  const tierClass = tier === 'signature' || tier === 'fineart' ? ` is-${tier}` : '';
  const tierCopy = getPrintTierCopy(tierId, state.lang);
  const key = stripExt(print.photoNum || '');
  const g = key ? state.gallery.byKey.get(key) : null;
  const src = g ? (g.thumb || g.full) : '';
  const inner = src
    ? `<img src="${escapeHtml(src)}" referrerpolicy="no-referrer" alt="" loading="lazy" decoding="async">`
    : `<span class="finish-preview-empty">${escapeHtml(copy().finishPreviewEmpty)}</span>`;
  const c = copy();
  return `
    <div class="field-full finish-field">
      <label>${escapeHtml(c.finishLabel)}</label>
      <div class="finish-toggle" role="group" aria-label="${escapeHtml(c.finishGroupAria)}">
        <button type="button" class="finish-opt${finish === 'full' ? ' active' : ''}" data-finish-idx="${index}" data-finish="full">${escapeHtml(c.finishFull)}</button>
        <button type="button" class="finish-opt${finish === 'border' ? ' active' : ''}" data-finish-idx="${index}" data-finish="border">${escapeHtml(c.finishBorder)}</button>
      </div>
      <div class="finish-preview finish-${finish}">
        <div class="finish-paper${tierClass}" style="aspect-ratio:${asp.toFixed(4)}">${inner}</div>
      </div>
      <div class="finish-help">${escapeHtml(finish === 'border' ? c.finishHelpBorder : c.finishHelpFull)}</div>
      ${tierCopy?.texture ? `<div class="finish-help">${tierCopy.texture}</div>` : ''}
    </div>`;
}

function renderPhotocardBox() {
  if (!els.photocardBox) return;
  if (!hasIncludedPhotocard()) {
    els.photocardBox.classList.add('hidden');
    els.photocardBox.innerHTML = '';
    return;
  }
  const mode = PHOTOCARD_MODES.includes(state.photocard.mode)
    ? state.photocard.mode
    : 'retouched';
  const c = copy();
  const countText = c.pcCount(Math.max(1, getIncludedPhotocardCount()));
  const modeCards = PHOTOCARD_MODES.map((value) => `
      <label class="radio-card photocard-mode-card${mode === value ? ' active' : ''}">
        <input type="radio" name="photocardMode" value="${value}"${mode === value ? ' checked' : ''}>
        <span><b>${escapeHtml(photocardModeLabel(value))}</b><small>${escapeHtml(photocardModeHelp(value))}</small></span>
      </label>
    `).join('');

  els.photocardBox.classList.remove('hidden');
  els.photocardBox.innerHTML = `
    <div class="detail-title">${escapeHtml(c.pcTitle)}</div>
    <div class="guide-copy">${escapeHtml(c.pcCopy(countText))}</div>
    <div class="photocard-mode-grid">${modeCards}</div>
    <div class="entry-grid photocard-fields">
      <div class="field field-photo">
        <label>${escapeHtml(c.pcFront)}</label>
        <input data-photocard-side="frontNum" value="${escapeHtml(state.photocard.frontNum || '')}" placeholder="${escapeHtml(c.entryPhotoNumPlaceholder)}">
        ${thumbHtmlForNum(state.photocard.frontNum || '')}
      </div>
      <div class="field field-photo">
        <label>${escapeHtml(c.pcBack)}</label>
        <input data-photocard-side="backNum" value="${escapeHtml(state.photocard.backNum || '')}" placeholder="${escapeHtml(c.printPhotoNumPlaceholder)}">
        ${thumbHtmlForNum(state.photocard.backNum || '')}
      </div>
      <div class="field-full">
        <label>${escapeHtml(c.pcNote)}</label>
        <textarea data-photocard-note placeholder="${escapeHtml(c.pcNotePlaceholder)}">${escapeHtml(state.photocard.note || '')}</textarea>
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
  const c = copy();
  const retouchIntro = `<div class="included-print-callout"><strong>${escapeHtml(c.retouchIntroTitle)}</strong><span>${escapeHtml(c.retouchIntroCopy)}</span></div>`;
  if (!state.photos.length) {
    els.photoList.innerHTML = `${retouchIntro}<div class="empty-state">${escapeHtml(c.retouchEmpty)}</div>`;
    return;
  }
  const retouchPrice = Number(state.session?.retouchPrice || 0);
  els.photoList.innerHTML = retouchIntro + state.photos.map((photo, index) => {
    const paid = isPhotoPaid(photo, index);
    const source = photo.source || (photo.isBonus ? 'bonus' : 'manual');
    const extra = paid ? `<span class="extra-badge">+€${retouchPrice}</span>` : '';
    const bonus = photo.isService
      ? `<span class="service-badge">${escapeHtml(c.badgeService)}</span>`
      : photo.isBonus
        ? `<span class="bonus-badge">${escapeHtml(c.badgeBonus)}</span>`
        : source === 'gallery'
          ? `<span class="gallery-badge">${escapeHtml(c.badgeGallery)}</span>`
          : `<span class="manual-badge">${escapeHtml(c.badgeManual)}</span>`;
    const key = stripExt(photo.num);
    const star = key ? getStarOf(key) : 0;
    const starChip = star ? `<span class="entry-star-chip">${escapeHtml(c.starBadge(star))}</span>` : '';
    return `
      <div class="entry-card${photo.isService ? ' service' : photo.isBonus ? ' bonus' : ''}">
        <div class="entry-head">
          <div class="entry-label">#${index + 1} ${starChip} ${bonus} ${extra}</div>
          ${photo.isBonus ? '' : `<button type="button" class="remove-btn" data-remove-photo="${index}">${escapeHtml(c.entryRemove)}</button>`}
        </div>
        <div class="entry-grid">
          <div class="field field-photo field-full">
            <label>${escapeHtml(c.entryPhotoNum)}</label>
            <input data-photo-num="${index}" value="${escapeHtml(photo.num || '')}" placeholder="${escapeHtml(c.entryPhotoNumPlaceholder)}">
            ${thumbHtmlForNum(photo.num || '')}
          </div>
          <div class="field-full">
            <label>${escapeHtml(c.entryNoteLabel)} <small style="color:#8e6235;">${escapeHtml(c.entryNoteHint)}</small></label>
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
  const c = copy();
  els.photoCounter.textContent = c.counterMain(selected, base, serviceCount);
  const parts = [];
  if (galleryCount) parts.push(c.counterGallery(galleryCount));
  if (manualCount) parts.push(c.counterManual(manualCount));
  if (bonusCount) parts.push(c.counterBonus(bonusCount));
  if (serviceCount) parts.push(c.counterService(serviceCount));
  els.photoCounterSub.textContent = parts.length
    ? parts.join(' · ') + (extra > 0 ? c.counterOverBase(base) : c.counterNoExtra)
    : c.counterEmpty;
  els.extraCost.textContent = extra > 0
    ? c.extraCostLine(extra, retouchPrice, extra * retouchPrice)
    : c.extraCostNone;
}

/* ========================================================================
 * 추가 인화 (Step 3)
 * ====================================================================== */
function addPrintRow() {
  // 기본값: 아직 남은 포함 쿼터 사이즈를 우선 제안, 없으면 시그니처 10×15
  const remaining = getPrintQuotaSummary().find((q) => q.remaining > 0);
  state.prints.push({ photoNum: '', printId: remaining ? remaining.id : 'basic_10x15', qty: 1, finish: 'full' });
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
  const c = copy();
  const target = nums ? c.serviceCutPrintTargetHtml(escapeHtml(nums)) : escapeHtml(c.serviceCutPrintTargetNone);
  const sizeName = escapeHtml(printOptionLabel(getPrintOption('basic_10x15')));
  return `<div class="service-cut-print-note">${c.serviceCutPrintNoteHtml(used, total, target, sizeName)}</div>`;
}

function renderPrintQuotaBanner() {
  const summary = getPrintQuotaSummary();
  const serviceNote = renderServiceCutPrintNote();
  if (!summary.length) {
    return `<div class="included-print-callout"><strong>${escapeHtml(copy().quotaNoneTitle)}</strong><span>${escapeHtml(copy().quotaNoneCopy)}</span>${serviceNote}</div>`;
  }
  const chips = summary.map((q) => {
    const done = q.remaining === 0;
    return `<span class="quota-chip${done ? ' used' : ''}">${escapeHtml(q.label)} <b>${q.used}/${q.total}</b></span>`;
  }).join('');
  // 포함/추가(차액) 관계를 말하는 유일한 자리 — 등급 라벨이나 옵션 텍스트에는 넣지 않는다.
  const c = copy();
  return `<div class="included-print-callout"><strong>${escapeHtml(c.quotaTitle)}</strong><span>${escapeHtml(c.quotaCopy)}</span><span>${getPrintMicrocopy('quotaUpgradeNote', state.lang)}</span><div class="quota-chips">${chips}</div>${serviceNote}</div>`;
}

function renderPrints() {
  const c = copy();
  const banner = renderPrintQuotaBanner();
  if (!state.prints.length) {
    els.printList.innerHTML = `${banner}<div class="empty-state">${escapeHtml(copy().printEmpty)}</div>`;
    return;
  }
  const annotations = computePrintAnnotations();
  els.printList.innerHTML = banner + state.prints.map((print, index) => {
    const ann = annotations[index];
    const option = ann.option;
    const priceRight = ann.amount === 0
      ? `<strong class="free">${escapeHtml(ann.serviceDiscount > 0 ? c.printFreeService : c.printFree)}</strong>`
      : `<strong class="paid">€${ann.amount}</strong>`;
    const tierBadge = ann.isRetouched
      ? `<span class="included-print-badge">${escapeHtml(c.printBadgeRetouched)}</span>`
      : `<span class="manual-badge">${escapeHtml(c.printBadgeOriginal)}</span>`;
    const serviceLine = ann.serviceDiscount > 0
      ? `<div class="review-note">${escapeHtml(c.printServiceLine(ann.serviceDiscount, ann.amount > 0))}</div>`
      : '';
    /* 쿼터 차액이 섞인 행은 '추가 N × €단가'가 성립하지 않는다(장마다 상쇄액이 다를 수 있다).
       그럴 땐 장수와 실제 합계만 말한다. */
    const breakdown = (ann.quotaDiffQty > 0
      ? `<div class="review-note">${escapeHtml(c.printQuotaDiffLine(ann.includedQty, ann.quotaDiffQty, Math.max(0, ann.chargedQty - ann.quotaDiffQty), ann.amount))}</div>`
      : ann.includedQty > 0 && ann.chargedQty > 0
        ? `<div class="review-note">${escapeHtml(c.printIncludedPlusExtra(ann.includedQty, ann.chargedQty, ann.unit))}</div>`
        : ann.includedQty > 0
          ? `<div class="review-note">${escapeHtml(c.printIncludedFree)}</div>`
          : `<div class="review-note">${escapeHtml(c.printExtraLine(ann.qty, ann.unit))}</div>`) + serviceLine;
    return `
      <div class="entry-card">
        <div class="entry-head">
          <div class="entry-label">${escapeHtml(c.printEntryLabel(index + 1))} ${tierBadge}</div>
          <button type="button" class="remove-btn" data-remove-print="${index}">${escapeHtml(c.entryRemove)}</button>
        </div>
        <div class="entry-grid">
          <div class="field">
            <label>${escapeHtml(c.printPhotoNum)}</label>
            <input data-print-photo="${index}" value="${escapeHtml(print.photoNum || '')}" placeholder="${escapeHtml(c.printPhotoNumPlaceholder)}">
            ${thumbHtmlForNum(print.photoNum || '')}
          </div>
          <div class="field">
            <label>${escapeHtml(c.printQty)}</label>
            <input data-print-qty="${index}" type="number" min="1" value="${escapeHtml(print.qty || 1)}">
          </div>
          <div class="field-full">
            <label>${escapeHtml(c.printPaperType)}</label>
            <select data-print-type="${index}">
              ${getSelectablePrintOptions().map((item) => `<option value="${item.id}"${item.id === print.printId ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
            </select>
            ${getPrintTierCopy(normalizePrintTypeId(print.printId), state.lang)?.paper ? `<div class="finish-help print-paper-note">${getPrintTierCopy(normalizePrintTypeId(print.printId), state.lang).paper}</div>` : ''}
          </div>
        </div>
        ${printFinishHtml(index, print)}
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
  els.printList.querySelectorAll('[data-finish-idx]').forEach((button) => {
    button.addEventListener('click', () => {
      const i = Number(button.dataset.finishIdx);
      state.prints[i].finish = button.dataset.finish === 'border' ? 'border' : 'full';
      renderPrints();
      updateReview();
    });
  });
  // 프리뷰 용지 방향을 실제 사진 방향에 맞춰(가로 사진→가로 용지) 인화앱 자동 셋팅과 동일하게 보이도록.
  els.printList.querySelectorAll('.finish-paper img').forEach((img) => {
    const orient = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const paper = img.closest('.finish-paper');
      if (!paper) return;
      const asp = Number(paper.style.aspectRatio) || 0.66;
      const portrait = asp <= 1;
      const wantLandscape = img.naturalWidth > img.naturalHeight;
      paper.style.aspectRatio = (wantLandscape === portrait) ? (1 / asp).toFixed(4) : asp.toFixed(4);
    };
    if (img.complete) orient(); else img.addEventListener('load', orient);
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
  els.pickupCalendarStatus.textContent = copy().pickupOnSiteOnly;

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
    ? copy().pickupSlotsFor(state.pickupDate)
    : copy().pickupSlotHint;
  renderPickupCalendar();
  renderPickupSlots(state.pickupSlots);
}

function renderPickupSlots(slots) {
  const list = Array.isArray(slots) ? slots : [];
  if (!list.length) {
    els.pickupSlotGrid.innerHTML = `<div class="empty-state">${escapeHtml(state.pickupDate ? copy().pickupNoSlots : copy().pickupNoDate)}</div>`;
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
  const c = copy();
  if (!requiresDeliverySelection()) return c.deliveryNone;
  if (state.deliveryMethod === 'pickup') {
    if (state.pickupDate && state.pickupTime) return c.deliveryPickupAt(state.pickupDate, state.pickupTime);
    return c.deliveryPickupLater;
  }
  if (state.deliveryMethod === 'mail') {
    const mailName = getMailNameForSubmission();
    const mailAddress = getMailAddressForSubmission();
    if (!mailName && !mailAddress) return c.deliveryMailNeedBoth;
    if (!mailName) return c.deliveryMailNeedName;
    if (!mailAddress) return c.deliveryMailNeedAddress;
    return c.deliveryMailFull(mailName, formatMailAddressForReview(mailAddress));
  }
  return c.deliveryNotChosen;
}

function validateDeliverySelection() {
  if (!requiresDeliverySelection()) return true;
  if (!state.deliveryMethod) { setBanner(copy().errPickDelivery, 'error'); return false; }
  if (state.deliveryMethod === 'pickup') {
    // 출력 후 픽업예약: 제출 시 일정 불필요 — 인화 완료 후 예약 페이지에서 신청
    return true;
  }
  const mailName = getMailNameForSubmission();
  const mailAddress = getMailAddressForSubmission();
  if (!mailName) { setBanner(copy().warnMailName, 'error'); return false; }
  if (!mailAddress) { setBanner(copy().warnMailAddress, 'error'); return false; }
  if (!hasMailAddressPostalCity(mailAddress)) { setBanner(copy().warnMailPostal, 'error'); return false; }
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
  const c = copy();
  const base = Number(state.session?.baseRetouchCount || 0);
  const retouchPrice = Number(state.session?.retouchPrice || 0);

  els.reviewPhotos.innerHTML = state.photos.length
    ? state.photos.map((photo, index) => {
        const source = photo.source || (photo.isBonus ? 'bonus' : 'manual');
        const paid = isPhotoPaid(photo, index);
        const extra = paid
          ? `+€${retouchPrice}`
          : photo.isService
            ? c.badgeService
            : photo.isBonus
              ? c.badgeBonus
              : source === 'gallery'
                ? c.badgeGallery
                : c.reviewIncluded;
        return `
          <div class="review-item">
            <div>
              <strong>${escapeHtml(photo.num || c.reviewPhotoFallback(index + 1))}</strong>
              <div class="review-note">${escapeHtml(photo.note || '')}</div>
            </div>
            <div style="text-align:right;">
              <div class="review-note">${extra}</div>
            </div>
          </div>
        `;
      }).join('')
    : `<div class="empty-state">${escapeHtml(c.reviewNoRetouch)}</div>`;

  const printAnnotations = computePrintAnnotations();
  els.reviewPrints.innerHTML = state.prints.length
    ? state.prints.map((print, index) => {
        const ann = printAnnotations[index];
        const tier = ann.isRetouched ? c.reviewTierRetouched : c.reviewTierOriginal;
        const priceText = ann.amount === 0 ? c.printFree : `€${ann.amount}`;
        const detail = (ann.includedQty > 0 && ann.chargedQty > 0
          ? c.reviewIncludedPlusExtra(ann.includedQty, ann.chargedQty)
          : ann.includedQty > 0
            ? c.reviewIncludedOnly
            : '') + (ann.serviceDiscount > 0 ? c.reviewServiceTag : '');
        return `
          <div class="review-item">
            <span>${escapeHtml(print.photoNum || '-')} · ${escapeHtml(ann.option.label)} × ${escapeHtml(print.qty || 1)} · ${tier}${detail}</span>
            <strong>${priceText}</strong>
          </div>
        `;
      }).join('')
    : `<div class="empty-state">${escapeHtml(c.reviewNoPrints)}</div>`;
  // 출력이 전부 시그니처일 때만 되돌아가는 방법을 한 줄로 안내(버튼·강조 없음).
  if (state.prints.length && state.prints.every((print) => getPrintTier(normalizePrintTypeId(print.printId)) === 'signature')) {
    els.reviewPrints.insertAdjacentHTML('beforeend', `<div class="review-note">${getPrintMicrocopy('reviewBackNote', state.lang)}</div>`);
  }

  if (els.reviewPhotocardBlock && els.reviewPhotocard) {
    const visible = hasIncludedPhotocard();
    els.reviewPhotocardBlock.classList.toggle('hidden', !visible);
    els.reviewPhotocard.textContent = visible ? getPhotocardReviewText() : '';
  }
  els.reviewMarketing.textContent = state.marketing === 'Y' ? c.marketingYes : c.marketingNo;
  syncDeliveryUi();
  if (els.reviewDelivery) els.reviewDelivery.textContent = requiresDeliverySelection() ? getDeliveryReviewText() : '';
  const total = calcTotal();
  els.reviewTotal.textContent = total === 0 ? c.printFree : `€${total}`;
  updateSubmitState();
  renderStepWarnings();
}

function validateStep1() {
  if (!state.marketing) {
    setBanner(copy().errPickMarketing, 'error');
    return false;
  }
  // 갤러리: 최소 1장은 별점을 주거나 직접 추가돼 있어야 다음으로 이동 가능
  const regularCount = state.photos.filter((p) => !p.isBonus).length;
  if (regularCount < 1) {
    setBanner(copy().errRateAtLeastOne, 'error');
    return false;
  }
  return true;
}

function validateStep2() {
  if (!state.photos.length) { setBanner(copy().errRetouchAtLeastOne, 'error'); return false; }
  const invalid = state.photos.findIndex((photo) => !String(photo.num || '').trim() || !String(photo.note || '').trim());
  if (invalid >= 0) {
    setBanner(copy().errRetouchRow(invalid + 1), 'error');
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
  if (invalid >= 0) { setBanner(copy().errPrintRow(invalid + 1), 'error'); return false; }
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
  const c = copy();
  const bonusCount = getMarketingBonusCount();
  const step1Message = canProceedStep1()
    ? ''
    : !state.marketing
      ? c.warnMarketing(bonusCount)
      : c.warnNoStars;
  const step2Message = canProceedStep2()
    ? ''
    : !state.photos.length
      ? c.warnNoRetouch
      : getPhotocardWarning()
        ? getPhotocardWarning()
        : c.warnRetouchIncomplete;
  const step3Message = canProceedStep3() ? '' : c.warnPrintNumbers;
  const step4Message = canSubmit()
    ? ''
    : !requiresDeliverySelection()
      ? c.warnReviewAgain
      : !state.deliveryMethod
      ? c.warnDeliveryMethod
      : state.deliveryMethod === 'mail' && !getMailNameForSubmission()
        ? c.warnMailName
      : state.deliveryMethod === 'mail' && !getMailAddressForSubmission()
        ? c.warnMailAddress
        : state.deliveryMethod === 'mail' && !hasMailAddressPostalCity(getMailAddressForSubmission())
          ? c.warnMailPostal
          : c.warnReviewAgain;

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
  el.id = 'previewBanner';
  /* was white on #f59e0b (Tailwind amber, outside the palette) at 2.15:1.
     Palette warning surface with body text instead, and the amber kept as
     a bottom rule so the strip still reads as a warning. */
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:var(--sm-warn-bg);color:var(--sm-text);border-bottom:2px solid var(--sm-warn);padding:8px 14px;text-align:center;font-weight:700;font-size:13px;z-index:10000;box-shadow:0 2px 6px rgba(0,0,0,.15);';
  el.innerHTML = escapeHtml(copy().previewBanner);
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
    alert(copy().previewSubmitAlert);
    return;
  }
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = state.editMode ? copy().submittingEdit : copy().submitting;
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
          price: ann.unit,
          finish: print.finish === 'border' ? 'border' : 'full'
        };
      }),
      ...(() => {
        const fallback = getPhotocardPrintFallbackPayload();
        return fallback ? [fallback] : [];
      })()
    ],
    marketing: state.marketing,
    deliveryMethod: deliveryRequired ? state.deliveryMethod : 'none',
    // 출력 후 픽업예약: 제출 시 일정을 보내지 않는다(백엔드가 연기 처리·구흐름 예약 보존).
    // 과거 슬롯 재검증 오류도 함께 회피된다.
    pickupDate: '',
    pickupTime: '',
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
    setBanner(state.editMode ? copy().submitDoneEdit : copy().submitDone, 'success');
    renderSuccess(result);
  } catch (error) {
    console.error(error);
    setBanner(copy().submitFailed(error.message), 'error');
  } finally {
    if (!state.submitted) {
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = state.editMode ? copy().submitLabelEdit : copy().submitLabel;
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
  const c = copy();
  els.successTitle.textContent = state.editMode ? c.successTitleEdit : c.successTitle;
  els.successCopy.textContent = calcTotal() > 0 ? c.successCopyPaid : c.successCopyFree;
  els.successName.textContent = state.session?.name || '-';
  els.successProduct.textContent = state.session?.product || '-';
  els.successPhotoCount.textContent = c.photosUnit(state.photos.length);
  const finalTotal = Number(result?.totalExtra ?? calcTotal());
  els.successTotal.textContent = finalTotal === 0 ? c.successFree : `€${finalTotal}`;
  const deliverySummaryLine = requiresDeliverySelection()
    ? `<div class="guide-copy">${escapeHtml(c.successDeliveryLine(getDeliveryReviewText()))}</div>`
    : '';
  els.successGuide.innerHTML = `
    <div class="detail-title">${escapeHtml(c.successSummaryTitle)}</div>
    <div class="guide-copy">${escapeHtml(c.successSummaryLine(state.photos.length, state.prints.length, state.marketing === 'Y' ? c.consentYes : c.consentNo))}</div>
    ${deliverySummaryLine}
    ${result?.invoiceNumber ? `<div class="guide-copy">${c.successInvoiceHtml(escapeHtml(result.invoiceNumber))}</div>` : ''}
  `;
  if (state.session?.driveLink) {
    els.successDriveLink.href = state.session.driveLink;
    els.successDriveLink.classList.remove('hidden');
  }
  globalThis.scrollTo({ top: 0, behavior: 'smooth' });
}
