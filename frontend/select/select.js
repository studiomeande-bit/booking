import { fetchSelectSession, submitSelect, updateSelect } from './shared/api.js';
import { createRequestId, escapeHtml } from './shared/utils.js';

const PRINT_OPTIONS = [
  { id: 'basic_10x15', label: '기본 10×15cm', retouched: 0, additional: 5 },
  { id: 'premium_10x15', label: '프리미엄 10×15cm', retouched: 3, additional: 8 },
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

const state = {
  sessionId: new URLSearchParams(globalThis.location.search).get('id') || '',
  session: null,
  photos: [],
  prints: [],
  marketing: '',
  editMode: false,
  step: 0
};

const els = {
  banner: document.getElementById('statusBanner'),
  errorPanel: document.getElementById('errorPanel'),
  errorMessage: document.getElementById('errorMessage'),
  appPanel: document.getElementById('appPanel'),
  sessionSummary: document.getElementById('sessionSummary'),
  packageSummary: document.getElementById('packageSummary'),
  driveLink: document.getElementById('driveLink'),
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
  printPriceGuide: document.getElementById('printPriceGuide'),
  printList: document.getElementById('printList'),
  addPrintBtn: document.getElementById('addPrintBtn'),
  reviewPhotos: document.getElementById('reviewPhotos'),
  reviewPrints: document.getElementById('reviewPrints'),
  reviewMarketing: document.getElementById('reviewMarketing'),
  reviewTotal: document.getElementById('reviewTotal'),
  submitHint: document.getElementById('submitHint'),
  submitBtn: document.getElementById('submitBtn'),
  resultBox: document.getElementById('resultBox'),
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
    renderPrints();
    updatePhotoCounter();
    updateReview();
    showApp();
    setBanner(state.editMode ? '기존 제출 내용을 불러왔습니다. 수정 후 다시 제출할 수 있습니다.' : '셀렉 세션을 불러왔습니다.', 'success');
  } catch (error) {
    console.error(error);
    showError(error.message);
  }
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
}

function showError(message) {
  setBanner(message, 'error');
  els.errorPanel.classList.remove('hidden');
  els.errorMessage.textContent = message;
  els.appPanel.classList.add('hidden');
}

function showApp() {
  els.errorPanel.classList.add('hidden');
  els.appPanel.classList.remove('hidden');
  goStep(0);
}

function hydrateSession(session) {
  state.session = session;
  state.editMode = !!session.canEdit;
  state.marketing = session.bookingMarketing || session.existingMarketing || '';
  state.photos = state.editMode && Array.isArray(session.existingPhotos)
    ? session.existingPhotos.map(normalizePhoto)
    : buildDefaultPhotos(session.baseRetouchCount || 0);
  state.prints = state.editMode && Array.isArray(session.existingPrints)
    ? session.existingPrints.map(normalizePrint)
    : [];
  if (session.bookingMarketing === 'Y') {
    state.marketing = 'Y';
  }
  syncMarketingUi();
}

function buildDefaultPhotos(count) {
  return Array.from({ length: Number(count) || 0 }, () => ({
    num: '',
    note: '',
    printType: 'basic_10x15',
    isBonus: false
  }));
}

function normalizePhoto(photo) {
  return {
    num: String(photo?.num || ''),
    note: String(photo?.note || ''),
    printType: String(photo?.printType || 'basic_10x15').replace(/_(r|e)$/, ''),
    isBonus: !!photo?.isBonus
  };
}

function normalizePrint(print) {
  return {
    photoNum: String(print?.photoNum ?? print?.num ?? ''),
    printId: String((print?.printId || print?.id || print?.printType || 'basic_10x15')).replace(/_(r|e)$/, ''),
    qty: Math.max(1, Number(print?.qty || 1) || 1)
  };
}

function renderHeader() {
  const name = state.session?.name || '';
  els.welcomeTitle.textContent = name ? `안녕하세요, ${name}님!` : '사진 셀렉';
  els.welcomeSub.textContent = state.editMode ? '이미 제출한 내용을 수정할 수 있습니다.' : '보정 선택과 추가 인화를 차례대로 진행해 주세요.';
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
  els.packageSummary.innerHTML = `
    <div class="detail-title">보정 패키지 안내</div>
    <div class="guide-copy">기본 보정 <b>${escapeHtml(s.baseRetouchCount || 0)}장</b> 포함 · 추가 보정 <b>€${escapeHtml(s.retouchPrice || 0)}/장</b></div>
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
      { num: '', note: '', printType: 'basic_10x15', isBonus: true },
      { num: '', note: '', printType: 'basic_10x15', isBonus: true }
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
    els.marketingBox.querySelector('.detail-copy').textContent = '예약 단계에서 이미 마케팅 활용에 동의한 상태입니다.';
  }
}

function getQuotaMap() {
  return (INCLUDED_PRINT_QUOTA[state.session?.itemGroup] || []).map((item) => ({ ...item }));
}

function getRegularPhotos() {
  return state.photos.filter((photo) => !photo.isBonus);
}

function getRetouchExtraCount() {
  const included = Number(state.session?.baseRetouchCount || 0);
  return Math.max(0, getRegularPhotos().length - included);
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

function addPhotoRow() {
  const bonusIndex = state.photos.findIndex((photo) => photo.isBonus);
  const newPhoto = { num: '', note: '', printType: 'basic_10x15', isBonus: false };
  if (bonusIndex >= 0) state.photos.splice(bonusIndex, 0, newPhoto);
  else state.photos.push(newPhoto);
  renderPhotos();
  updatePhotoCounter();
  updateReview();
}

function renderPhotos() {
  if (!state.photos.length) {
    els.photoList.innerHTML = '<div class="empty-state">아직 선택된 보정 사진이 없습니다.</div>';
    return;
  }
  const includedCount = Number(state.session?.baseRetouchCount || 0);
  const retouchPrice = Number(state.session?.retouchPrice || 0);
  els.photoList.innerHTML = state.photos.map((photo, index) => {
    const typeId = (photo.printType || 'basic_10x15').replace(/_(r|e)$/, '');
    const option = PRINT_OPTIONS.find((item) => item.id === typeId) || PRINT_OPTIONS[0];
    const extra = !photo.isBonus && index >= includedCount ? `<span class="extra-badge">+€${retouchPrice}</span>` : '';
    const bonus = photo.isBonus ? '<span class="bonus-badge">보너스</span>' : '';
    const free = option.retouched === 0 || isPrintFreeByQuota(index, typeId);
    return `
      <div class="entry-card${photo.isBonus ? ' bonus' : ''}">
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
      state.photos.splice(Number(button.dataset.removePhoto), 1);
      renderPhotos();
      updatePhotoCounter();
      updateReview();
    });
  });
}

function updatePhotoCounter() {
  const selected = state.photos.length;
  const base = Number(state.session?.baseRetouchCount || 0);
  const extra = getRetouchExtraCount();
  const retouchPrice = Number(state.session?.retouchPrice || 0);
  els.photoCounter.textContent = `${selected}장 선택됨 / 기본 ${base}장`;
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
            <input data-print-photo="${index}" value="${escapeHtml(print.photoNum || '')}" placeholder="예: 0045">
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

function updateReview() {
  const base = Number(state.session?.baseRetouchCount || 0);
  const retouchPrice = Number(state.session?.retouchPrice || 0);

  els.reviewPhotos.innerHTML = state.photos.length
    ? state.photos.map((photo, index) => {
        const option = PRINT_OPTIONS.find((item) => item.id === photo.printType) || PRINT_OPTIONS[0];
        const extra = !photo.isBonus && index >= base ? `+€${retouchPrice}` : (photo.isBonus ? '보너스' : '포함');
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
  els.reviewTotal.textContent = calcTotal() === 0 ? '무료' : `€${calcTotal()}`;
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
  state.step = step;
  els.stepPanels.forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.step) === step));
  els.stepDots.forEach((dot, index) => {
    dot.className = `step-dot${index === step ? ' active' : index < step ? ' done' : ''}`;
  });
  if (step === 3) updateReview();
  globalThis.scrollTo({ top: 0, behavior: 'smooth' });
}

async function onSubmit() {
  if (!validateStep1() || !validateStep2()) return;
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = state.editMode ? '수정 제출 중...' : '제출 중...';
  const payload = {
    photos: state.photos,
    prints: state.prints.map((print) => {
      const option = PRINT_OPTIONS.find((item) => item.id === print.printId) || PRINT_OPTIONS[0];
      return {
        ...print,
        label: option.label,
        price: option.additional,
        isRetouched: false
      };
    }),
    marketing: state.marketing
  };
  try {
    const requestId = createRequestId(state.editMode ? 'select_update' : 'select_submit');
    const result = state.editMode
      ? await updateSelect(state.sessionId, payload, requestId)
      : await submitSelect(state.sessionId, payload, requestId);
    els.resultBox.hidden = false;
    els.resultBox.textContent = JSON.stringify(result, null, 2);
    setBanner(state.editMode ? '수정 제출이 완료됐습니다.' : '셀렉 제출이 완료됐습니다.', 'success');
  } catch (error) {
    console.error(error);
    setBanner(`셀렉 제출 실패: ${error.message}`, 'error');
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = state.editMode ? '수정 제출' : '제출';
  }
}

function setBanner(message, variant) {
  els.banner.textContent = message;
  els.banner.className = `banner ${variant}`;
}
