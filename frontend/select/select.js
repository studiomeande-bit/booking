import { fetchSelectSession, submitSelect, updateSelect } from './shared/api.js';
import { createRequestId, escapeHtml } from './shared/utils.js';

const PRINT_OPTIONS = [
  { id: 'basic_10x15', label: '기본 10×15cm' },
  { id: 'premium_10x15', label: '프리미엄 10×15cm' },
  { id: 'basic_a4', label: '기본 A4' },
  { id: 'premium_a4', label: '프리미엄 A4' },
  { id: 'premium_a3', label: '프리미엄 A3' }
];

const state = {
  sessionId: new URLSearchParams(globalThis.location.search).get('id') || '',
  session: null,
  photos: [],
  prints: [],
  marketing: '',
  editMode: false
};

const els = {
  banner: document.getElementById('statusBanner'),
  sessionMeta: document.getElementById('sessionMeta'),
  sessionSummary: document.getElementById('sessionSummary'),
  photoList: document.getElementById('photoList'),
  printList: document.getElementById('printList'),
  addPhotoBtn: document.getElementById('addPhotoBtn'),
  addPrintBtn: document.getElementById('addPrintBtn'),
  submitBtn: document.getElementById('submitBtn'),
  submitHint: document.getElementById('submitHint'),
  resultBox: document.getElementById('resultBox')
};

boot();

async function boot() {
  wireEvents();
  if (!state.sessionId) {
    setBanner('세션 ID가 없습니다. URL의 `?id=` 값을 확인해 주세요.', 'error');
    els.sessionSummary.textContent = '잘못된 진입 링크입니다.';
    return;
  }
  els.sessionMeta.textContent = `세션 ID: ${state.sessionId}`;
  try {
    const session = await fetchSelectSession(state.sessionId);
    hydrateSession(session);
    renderSessionSummary();
    renderPhotos();
    renderPrints();
    updateSubmitState();
    setBanner('셀렉 세션을 불러왔습니다.', 'success');
  } catch (error) {
    console.error(error);
    setBanner(`세션 조회 실패: ${error.message}`, 'error');
    els.sessionSummary.textContent = error.message;
  }
}

function wireEvents() {
  els.addPhotoBtn.addEventListener('click', () => {
    state.photos.push({ num: '', note: '', printType: 'basic_10x15' });
    renderPhotos();
    updateSubmitState();
  });
  els.addPrintBtn.addEventListener('click', () => {
    state.prints.push({ photoNum: '', printId: 'basic_10x15', qty: 1 });
    renderPrints();
  });
  document.querySelectorAll('input[name="marketing"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.marketing = input.value;
      updateSubmitState();
    });
  });
  els.submitBtn.addEventListener('click', onSubmit);
}

function hydrateSession(session) {
  state.session = session;
  state.editMode = !!session.canEdit;
  state.marketing = session.bookingMarketing || session.existingMarketing || '';
  if (state.editMode) {
    state.photos = Array.isArray(session.existingPhotos) ? session.existingPhotos.map(normalizePhoto) : [];
    state.prints = Array.isArray(session.existingPrints) ? session.existingPrints.map(normalizePrint) : [];
    els.submitHint.textContent = '이미 제출된 세션입니다. 수정 제출로 처리됩니다.';
  } else {
    state.photos = [];
    state.prints = [];
  }
  const target = document.querySelector(`input[name="marketing"][value="${state.marketing || 'N'}"]`);
  if (target) target.checked = true;
}

function renderSessionSummary() {
  const s = state.session;
  els.sessionSummary.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item"><div class="summary-label">고객명</div><div class="summary-value">${escapeHtml(s.name || '')}</div></div>
      <div class="summary-item"><div class="summary-label">상품</div><div class="summary-value">${escapeHtml(s.product || '')}</div></div>
      <div class="summary-item"><div class="summary-label">촬영일</div><div class="summary-value">${escapeHtml(s.date || '')}</div></div>
      <div class="summary-item"><div class="summary-label">기본 보정</div><div class="summary-value">${escapeHtml(s.baseRetouchCount || 0)}장</div></div>
      <div class="summary-item"><div class="summary-label">추가 보정 단가</div><div class="summary-value">€${escapeHtml(s.retouchPrice || 0)}</div></div>
      <div class="summary-item"><div class="summary-label">추가 인보이스</div><div class="summary-value">${escapeHtml(s.extraInvoiceNumber || '-')}</div></div>
    </div>
  `;
}

function renderPhotos() {
  if (!state.photos.length) {
    els.photoList.innerHTML = '<div class="empty-state">아직 선택된 보정 사진이 없습니다.</div>';
    return;
  }
  els.photoList.innerHTML = state.photos.map((photo, index) => `
    <div class="entry-card">
      <div class="entry-grid">
        <input data-kind="photo-num" data-index="${index}" placeholder="사진 번호" value="${escapeHtml(photo.num || '')}">
        <textarea data-kind="photo-note" data-index="${index}" placeholder="보정 요청사항">${escapeHtml(photo.note || '')}</textarea>
        <select data-kind="photo-print" data-index="${index}">
          ${PRINT_OPTIONS.map((opt) => `<option value="${opt.id}"${opt.id === (photo.printType || 'basic_10x15') ? ' selected' : ''}>${opt.label}</option>`).join('')}
        </select>
        <button type="button" class="remove-btn" data-kind="photo-remove" data-index="${index}">삭제</button>
      </div>
    </div>
  `).join('');
  bindPhotoInputs();
}

function bindPhotoInputs() {
  els.photoList.querySelectorAll('[data-kind="photo-num"]').forEach((input) => {
    input.addEventListener('input', () => {
      state.photos[Number(input.dataset.index)].num = input.value;
      updateSubmitState();
    });
  });
  els.photoList.querySelectorAll('[data-kind="photo-note"]').forEach((input) => {
    input.addEventListener('input', () => {
      state.photos[Number(input.dataset.index)].note = input.value;
      updateSubmitState();
    });
  });
  els.photoList.querySelectorAll('[data-kind="photo-print"]').forEach((select) => {
    select.addEventListener('change', () => {
      state.photos[Number(select.dataset.index)].printType = select.value;
    });
  });
  els.photoList.querySelectorAll('[data-kind="photo-remove"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.photos.splice(Number(button.dataset.index), 1);
      renderPhotos();
      updateSubmitState();
    });
  });
}

function renderPrints() {
  if (!state.prints.length) {
    els.printList.innerHTML = '<div class="empty-state">추가 인화 주문이 없습니다.</div>';
    return;
  }
  els.printList.innerHTML = state.prints.map((print, index) => `
    <div class="entry-card">
      <div class="entry-grid">
        <input data-kind="print-photo" data-index="${index}" placeholder="사진 번호" value="${escapeHtml(print.photoNum || '')}">
        <select data-kind="print-type" data-index="${index}">
          ${PRINT_OPTIONS.map((opt) => `<option value="${opt.id}"${opt.id === (print.printId || 'basic_10x15') ? ' selected' : ''}>${opt.label}</option>`).join('')}
        </select>
        <input data-kind="print-qty" data-index="${index}" type="number" min="1" value="${escapeHtml(print.qty || 1)}">
        <button type="button" class="remove-btn" data-kind="print-remove" data-index="${index}">삭제</button>
      </div>
    </div>
  `).join('');
  bindPrintInputs();
}

function bindPrintInputs() {
  els.printList.querySelectorAll('[data-kind="print-photo"]').forEach((input) => {
    input.addEventListener('input', () => {
      state.prints[Number(input.dataset.index)].photoNum = input.value;
    });
  });
  els.printList.querySelectorAll('[data-kind="print-type"]').forEach((select) => {
    select.addEventListener('change', () => {
      state.prints[Number(select.dataset.index)].printId = select.value;
    });
  });
  els.printList.querySelectorAll('[data-kind="print-qty"]').forEach((input) => {
    input.addEventListener('input', () => {
      state.prints[Number(input.dataset.index)].qty = Math.max(1, Number(input.value) || 1);
    });
  });
  els.printList.querySelectorAll('[data-kind="print-remove"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.prints.splice(Number(button.dataset.index), 1);
      renderPrints();
    });
  });
}

function normalizePhoto(photo) {
  return {
    num: String(photo?.num || ''),
    note: String(photo?.note || ''),
    printType: String(photo?.printType || 'basic_10x15'),
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

function updateSubmitState() {
  const validPhotos = state.photos.every((photo) => String(photo.num || '').trim() && String(photo.note || '').trim());
  const hasMarketing = !!state.marketing;
  els.submitBtn.disabled = !hasMarketing || !state.photos.length || !validPhotos;
  els.submitBtn.textContent = state.editMode ? '수정 제출' : '제출';
}

async function onSubmit() {
  if (!state.sessionId || !state.session) return;
  const submission = {
    photos: state.photos,
    prints: state.prints.map((print) => ({
      ...print,
      label: PRINT_OPTIONS.find((opt) => opt.id === print.printId)?.label || print.printId,
      price: 0,
      isRetouched: false
    })),
    marketing: state.marketing
  };
  const requestId = createRequestId(state.editMode ? 'select_update' : 'select_submit');
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = '제출 중...';
  try {
    const result = state.editMode
      ? await updateSelect(state.sessionId, submission, requestId)
      : await submitSelect(state.sessionId, submission, requestId);
    els.resultBox.hidden = false;
    els.resultBox.textContent = JSON.stringify(result, null, 2);
    setBanner(state.editMode ? '수정 제출이 완료됐습니다.' : '셀렉 제출이 완료됐습니다.', 'success');
  } catch (error) {
    console.error(error);
    setBanner(`셀렉 제출 실패: ${error.message}`, 'error');
  } finally {
    updateSubmitState();
  }
}

function setBanner(message, variant) {
  els.banner.textContent = message;
  els.banner.className = `banner ${variant}`;
}
