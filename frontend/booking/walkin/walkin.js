import { submitWalkinIntake } from '../../shared/api-booking.js';

const LANG_KEY = 'studio-mean-walkin-lang';

const COPY = {
  ko: {
    pageTitle: 'Studio mean - 워크인 정보 입력',
    heroTitle: '워크인 고객 정보 작성',
    heroLead: '직원 안내에 따라 기본 정보와 송장 정보를 입력해 주세요.',
    statusReady: '현장 안내용 정보 입력 폼입니다. 예약 링크가 아니며 일정은 스튜디오에서 안내해 드립니다.',
    noteTitle: '입력 안내',
    noteCopy: '연락처와 송장 정보만 먼저 받아 두는 전용 링크입니다. 예약 생성은 스튜디오에서 별도로 진행합니다.',
    successTitle: '워크인 정보가 접수되었습니다.',
    successCopy: '스튜디오에서 내용을 확인해 현장 안내 또는 후속 연락에 반영하겠습니다.',
    restart: '다른 고객 정보 입력',
    serviceLabel: '촬영 종류',
    servicePlaceholder: '촬영 종류를 선택해 주세요.',
    nameLabel: '이름',
    phoneLabel: '연락처',
    emailLabel: '이메일 (선택)',
    addressLabel: '주소 (선택)',
    payerNameLabel: '입금자명 (선택)',
    babyNameLabel: '아기 이름 (선택)',
    memoLabel: '메모 / 요청사항',
    memoPlaceholder: '직원이 참고해야 할 내용을 적어 주세요.',
    businessInvoiceToggle: '사업자 송장 필요',
    businessInvoiceCopy: '사업자 송장이 필요하면 아래 정보를 추가로 입력해 주세요.',
    companyNameLabel: '사업자명',
    companyAddressLabel: '사업자 주소',
    vatIdLabel: 'VAT 번호',
    invoiceEmailLabel: '송장 받을 이메일',
    invoiceRefLabel: '참조 번호 / 메모',
    consentTitle: '동의',
    consentCopy: '현장 확인과 결과 안내를 위해 필요한 항목입니다.',
    gdprLabel: '[필수] 개인정보 수집 및 이용에 동의합니다.',
    gdprSub: '연락 및 송장 발행, 촬영 결과 안내를 위한 최소한의 정보를 처리합니다.',
    aiLabel: '[필수] AI 리터칭/보정 보조 사용 안내에 동의합니다.',
    aiSub: '리터칭 및 전달 과정에서 AI 보조 도구가 함께 사용될 수 있습니다.',
    marketingLabel: '[선택] 포트폴리오/SNS 활용에 동의합니다.',
    marketingSub: '완성본 일부가 웹사이트나 SNS 예시 이미지로 사용될 수 있습니다.',
    submit: '정보 보내기',
    submitting: '전송 중...',
    summarySubmittedAt: '접수 시각',
    summaryService: '촬영 종류',
    summaryContact: '연락처',
    summaryEmail: '이메일',
    summaryInvoice: '사업자 송장',
    invoiceYes: '필요',
    invoiceNo: '불필요',
    serviceError: '촬영 종류를 선택해 주세요.',
    requiredError: '이름과 연락처를 입력해 주세요.',
    emailError: '이메일 형식을 확인해 주세요.',
    invoiceError: '사업자 송장이 필요하면 사업자명을 입력해 주세요.',
    consentError: '필수 동의 항목을 체크해 주세요.'
  },
  en: {
    pageTitle: 'Studio mean - Walk-in Info',
    heroTitle: 'Walk-in Customer Form',
    heroLead: 'Please fill in your basic contact and invoice details as guided by our staff.',
    statusReady: 'This page is for on-site information intake only. It is not a booking link and the schedule will be handled by the studio.',
    noteTitle: 'Before You Start',
    noteCopy: 'This link is used only to collect customer information quickly. The actual booking entry is handled separately by Studio mean.',
    successTitle: 'Your walk-in information has been received.',
    successCopy: 'Studio mean will review it and use it for on-site guidance or follow-up communication if needed.',
    restart: 'Enter another customer',
    serviceLabel: 'Service',
    servicePlaceholder: 'Select a service',
    nameLabel: 'Name',
    phoneLabel: 'Phone',
    emailLabel: 'Email (optional)',
    addressLabel: 'Address (optional)',
    payerNameLabel: 'Payer name (optional)',
    babyNameLabel: 'Baby name (optional)',
    memoLabel: 'Notes / Requests',
    memoPlaceholder: 'Anything our staff should know in advance.',
    businessInvoiceToggle: 'Business invoice needed',
    businessInvoiceCopy: 'If you need a company invoice, please fill in the fields below as well.',
    companyNameLabel: 'Company name',
    companyAddressLabel: 'Company address',
    vatIdLabel: 'VAT ID',
    invoiceEmailLabel: 'Invoice email',
    invoiceRefLabel: 'Reference / memo',
    consentTitle: 'Consent',
    consentCopy: 'These items are needed for contact, invoice handling, and delivery guidance.',
    gdprLabel: '[Required] I agree to the collection and use of personal data.',
    gdprSub: 'We process only the minimum information needed for contact, invoice handling, and delivery guidance.',
    aiLabel: '[Required] I understand that AI-assisted retouching tools may be used.',
    aiSub: 'AI tools may be used as supporting tools during retouching and delivery.',
    marketingLabel: '[Optional] I agree to portfolio / social media usage.',
    marketingSub: 'Some final images may be used as examples on the website or social media.',
    submit: 'Send Information',
    submitting: 'Sending...',
    summarySubmittedAt: 'Submitted at',
    summaryService: 'Service',
    summaryContact: 'Phone',
    summaryEmail: 'Email',
    summaryInvoice: 'Business invoice',
    invoiceYes: 'Needed',
    invoiceNo: 'Not needed',
    serviceError: 'Please select a service.',
    requiredError: 'Please enter both name and phone number.',
    emailError: 'Please check the email format.',
    invoiceError: 'If a business invoice is needed, please enter the company name.',
    consentError: 'Please check the required consent items.'
  },
  de: {
    pageTitle: 'Studio mean - Walk-in Formular',
    heroTitle: 'Walk-in Kundenformular',
    heroLead: 'Bitte tragen Sie Ihre Kontakt- und Rechnungsdaten entsprechend der Anleitung unseres Teams ein.',
    statusReady: 'Diese Seite dient nur zur Erfassung der Kundendaten vor Ort. Es handelt sich nicht um einen Buchungslink.',
    noteTitle: 'Vor dem Ausfüllen',
    noteCopy: 'Über diesen Link werden nur die Kundendaten erfasst. Die eigentliche Buchung wird anschließend vom Studio angelegt.',
    successTitle: 'Ihre Walk-in-Informationen wurden übermittelt.',
    successCopy: 'Studio mean prüft die Angaben und nutzt sie bei Bedarf für die Betreuung vor Ort oder die weitere Kommunikation.',
    restart: 'Weitere Kundendaten eingeben',
    serviceLabel: 'Leistung',
    servicePlaceholder: 'Leistung auswählen',
    nameLabel: 'Name',
    phoneLabel: 'Telefon',
    emailLabel: 'E-Mail (optional)',
    addressLabel: 'Adresse (optional)',
    payerNameLabel: 'Kontoinhaber (optional)',
    babyNameLabel: 'Babyname (optional)',
    memoLabel: 'Hinweis / Wunsch',
    memoPlaceholder: 'Alles, was unser Team wissen sollte.',
    businessInvoiceToggle: 'Firmenrechnung benötigt',
    businessInvoiceCopy: 'Wenn Sie eine Firmenrechnung benötigen, ergänzen Sie bitte die folgenden Angaben.',
    companyNameLabel: 'Firmenname',
    companyAddressLabel: 'Firmenadresse',
    vatIdLabel: 'USt-IdNr.',
    invoiceEmailLabel: 'E-Mail für Rechnung',
    invoiceRefLabel: 'Referenz / Notiz',
    consentTitle: 'Einwilligung',
    consentCopy: 'Diese Angaben benötigen wir für Kontakt, Rechnungsstellung und weitere Hinweise.',
    gdprLabel: '[Pflicht] Ich stimme der Erhebung und Nutzung personenbezogener Daten zu.',
    gdprSub: 'Es werden nur die notwendigen Daten für Kontakt, Rechnung und weitere Hinweise verarbeitet.',
    aiLabel: '[Pflicht] Ich stimme dem Hinweis zur KI-gestützten Retusche zu.',
    aiSub: 'KI-Tools können unterstützend bei Retusche und Übergabe eingesetzt werden.',
    marketingLabel: '[Optional] Ich stimme der Nutzung für Portfolio / soziale Medien zu.',
    marketingSub: 'Einzelne Ergebnisse können als Referenz auf Website oder Social Media genutzt werden.',
    submit: 'Informationen senden',
    submitting: 'Wird gesendet...',
    summarySubmittedAt: 'Übermittelt am',
    summaryService: 'Leistung',
    summaryContact: 'Telefon',
    summaryEmail: 'E-Mail',
    summaryInvoice: 'Firmenrechnung',
    invoiceYes: 'Benötigt',
    invoiceNo: 'Nicht benötigt',
    serviceError: 'Bitte wählen Sie eine Leistung aus.',
    requiredError: 'Bitte geben Sie Name und Telefonnummer ein.',
    emailError: 'Bitte prüfen Sie das E-Mail-Format.',
    invoiceError: 'Wenn eine Firmenrechnung benötigt wird, tragen Sie bitte den Firmennamen ein.',
    consentError: 'Bitte bestätigen Sie die Pflichtangaben.'
  }
};

const SERVICES = [
  { key: 'pass', label: { ko: '여권 / 비자', en: 'Passport / Visa', de: 'Pass / Visum' } },
  { key: 'prof', label: { ko: '프로필', en: 'Profile', de: 'Profil' } },
  { key: 'stud', label: { ko: '스튜디오', en: 'Studio', de: 'Studio' } },
  { key: 'snap', label: { ko: '야외 스냅', en: 'Outdoor', de: 'Outdoor' } },
  { key: 'wed', label: { ko: '프리웨딩', en: 'Pre-Wedding', de: 'Pre-Wedding' } },
  { key: 'biz', label: { ko: '기업 / 행사', en: 'Corporate / Event', de: 'Firma / Event' } },
  { key: 'other', label: { ko: '기타', en: 'Other', de: 'Andere' } }
];

const elements = {
  form: document.getElementById('walkinForm'),
  formPanel: document.getElementById('formPanel'),
  successPanel: document.getElementById('successPanel'),
  successSummary: document.getElementById('successSummary'),
  restartBtn: document.getElementById('restartBtn'),
  statusBanner: document.getElementById('statusBanner'),
  submitBtn: document.getElementById('submitBtn'),
  serviceGroup: document.getElementById('serviceGroup'),
  businessInvoiceNeeded: document.getElementById('businessInvoiceNeeded'),
  businessFields: document.getElementById('businessFields'),
  businessCompanyName: document.getElementById('businessCompanyName'),
  email: document.getElementById('email'),
  heroTitle: document.getElementById('heroTitle'),
  heroLead: document.getElementById('heroLead'),
  noteTitle: document.getElementById('noteTitle'),
  noteCopy: document.getElementById('noteCopy'),
  successTitle: document.getElementById('successTitle'),
  successCopy: document.getElementById('successCopy'),
  serviceLabel: document.getElementById('serviceLabel'),
  nameLabel: document.getElementById('nameLabel'),
  phoneLabel: document.getElementById('phoneLabel'),
  emailLabel: document.getElementById('emailLabel'),
  addressLabel: document.getElementById('addressLabel'),
  payerNameLabel: document.getElementById('payerNameLabel'),
  babyNameLabel: document.getElementById('babyNameLabel'),
  memoLabel: document.getElementById('memoLabel'),
  memo: document.getElementById('memo'),
  businessInvoiceToggle: document.getElementById('businessInvoiceToggle'),
  businessInvoiceCopy: document.getElementById('businessInvoiceCopy'),
  companyNameLabel: document.getElementById('companyNameLabel'),
  companyAddressLabel: document.getElementById('companyAddressLabel'),
  vatIdLabel: document.getElementById('vatIdLabel'),
  invoiceEmailLabel: document.getElementById('invoiceEmailLabel'),
  invoiceRefLabel: document.getElementById('invoiceRefLabel'),
  consentTitle: document.getElementById('consentTitle'),
  consentCopy: document.getElementById('consentCopy'),
  gdprLabel: document.getElementById('gdprLabel'),
  gdprSub: document.getElementById('gdprSub'),
  aiLabel: document.getElementById('aiLabel'),
  aiSub: document.getElementById('aiSub'),
  marketingLabel: document.getElementById('marketingLabel'),
  marketingSub: document.getElementById('marketingSub'),
  langButtons: Array.from(document.querySelectorAll('.lang-btn'))
};

const state = {
  lang: getInitialLang(),
  submitting: false,
  serviceGroup: normalizeServiceParam(new URLSearchParams(window.location.search).get('service')) || ''
};

function getInitialLang() {
  const params = new URLSearchParams(window.location.search);
  const queryLang = String(params.get('lang') || '').trim().toLowerCase();
  if (queryLang === 'en' || queryLang === 'de' || queryLang === 'ko') return queryLang;
  try {
    const saved = window.localStorage.getItem(LANG_KEY) || 'ko';
    if (saved === 'en' || saved === 'de' || saved === 'ko') return saved;
  } catch (_) {}
  return 'ko';
}

function setSavedLang(lang) {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch (_) {}
}

function normalizeServiceParam(value) {
  const raw = String(value || '').trim().toLowerCase();
  const aliases = {
    passport: 'pass',
    visa: 'pass',
    profile: 'prof',
    studio: 'stud',
    outdoor: 'snap',
    wedding: 'wed',
    prewedding: 'wed',
    event: 'biz',
    corporate: 'biz'
  };
  return SERVICES.some((service) => service.key === raw) ? raw : aliases[raw] || '';
}

function getCopy() {
  return COPY[state.lang] || COPY.ko;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getServiceLabel(key) {
  const service = SERVICES.find((entry) => entry.key === key) || SERVICES[SERVICES.length - 1];
  return service.label[state.lang] || service.label.ko;
}

function createRequestId(prefix = 'walkin') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function setStatus(message, mode = 'info') {
  elements.statusBanner.className = `status-banner ${mode}`;
  elements.statusBanner.textContent = message;
}

function renderServiceOptions() {
  const copy = getCopy();
  const selected = state.serviceGroup || elements.serviceGroup.value || '';
  const options = [`<option value="">${escapeHtml(copy.servicePlaceholder)}</option>`]
    .concat(
      SERVICES.map((service) => (
        `<option value="${service.key}"${service.key === selected ? ' selected' : ''}>${escapeHtml(getServiceLabel(service.key))}</option>`
      ))
    );
  elements.serviceGroup.innerHTML = options.join('');
  if (!elements.serviceGroup.value) elements.serviceGroup.value = selected;
}

function toggleBusinessFields() {
  const visible = !!elements.businessInvoiceNeeded.checked;
  elements.businessFields.classList.toggle('hidden-field', !visible);
}

function render() {
  const copy = getCopy();
  document.documentElement.lang = state.lang;
  document.title = copy.pageTitle;

  elements.langButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === state.lang);
  });

  elements.heroTitle.textContent = copy.heroTitle;
  elements.heroLead.textContent = copy.heroLead;
  elements.noteTitle.textContent = copy.noteTitle;
  elements.noteCopy.textContent = copy.noteCopy;
  elements.successTitle.textContent = copy.successTitle;
  elements.successCopy.textContent = copy.successCopy;
  elements.restartBtn.textContent = copy.restart;
  elements.serviceLabel.textContent = copy.serviceLabel;
  elements.nameLabel.textContent = copy.nameLabel;
  elements.phoneLabel.textContent = copy.phoneLabel;
  elements.emailLabel.textContent = copy.emailLabel;
  elements.addressLabel.textContent = copy.addressLabel;
  elements.payerNameLabel.textContent = copy.payerNameLabel;
  elements.babyNameLabel.textContent = copy.babyNameLabel;
  elements.memoLabel.textContent = copy.memoLabel;
  elements.memo.placeholder = copy.memoPlaceholder;
  elements.businessInvoiceToggle.textContent = copy.businessInvoiceToggle;
  elements.businessInvoiceCopy.textContent = copy.businessInvoiceCopy;
  elements.companyNameLabel.textContent = copy.companyNameLabel;
  elements.companyAddressLabel.textContent = copy.companyAddressLabel;
  elements.vatIdLabel.textContent = copy.vatIdLabel;
  elements.invoiceEmailLabel.textContent = copy.invoiceEmailLabel;
  elements.invoiceRefLabel.textContent = copy.invoiceRefLabel;
  elements.consentTitle.textContent = copy.consentTitle;
  elements.consentCopy.textContent = copy.consentCopy;
  elements.gdprLabel.textContent = copy.gdprLabel;
  elements.gdprSub.textContent = copy.gdprSub;
  elements.aiLabel.textContent = copy.aiLabel;
  elements.aiSub.textContent = copy.aiSub;
  elements.marketingLabel.textContent = copy.marketingLabel;
  elements.marketingSub.textContent = copy.marketingSub;
  elements.submitBtn.textContent = state.submitting ? copy.submitting : copy.submit;
  renderServiceOptions();
  if (!state.submitting && elements.successPanel.classList.contains('hidden-field')) {
    setStatus(copy.statusReady, 'info');
  }
}

function collectPayload() {
  const formData = new FormData(elements.form);
  const serviceGroup = formData.get('serviceGroup') || state.serviceGroup || '';
  return {
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    address: String(formData.get('address') || '').trim(),
    payerName: String(formData.get('payerName') || '').trim(),
    babyName: String(formData.get('babyName') || '').trim(),
    memo: String(formData.get('memo') || '').trim(),
    lang: state.lang,
    serviceGroup,
    serviceLabel: getServiceLabel(serviceGroup),
    businessInvoiceNeeded: !!formData.get('businessInvoiceNeeded'),
    businessCompanyName: String(formData.get('businessCompanyName') || '').trim(),
    businessCompanyAddress: String(formData.get('businessCompanyAddress') || '').trim(),
    businessVatId: String(formData.get('businessVatId') || '').trim(),
    businessInvoiceEmail: String(formData.get('businessInvoiceEmail') || '').trim(),
    businessInvoiceRef: String(formData.get('businessInvoiceRef') || '').trim(),
    gdprConsent: !!formData.get('gdprConsent'),
    aiConsent: !!formData.get('aiConsent'),
    marketing: !!formData.get('marketing'),
    website: String(formData.get('website') || '')
  };
}

function validatePayload(payload) {
  const copy = getCopy();
  if (!payload.serviceGroup) return copy.serviceError;
  if (!payload.name || !payload.phone) return copy.requiredError;
  if (payload.email && !payload.email.includes('@')) return copy.emailError;
  if (payload.businessInvoiceNeeded && !payload.businessCompanyName) return copy.invoiceError;
  if (!payload.gdprConsent || !payload.aiConsent) return copy.consentError;
  return '';
}

function showSuccess(result, payload) {
  const copy = getCopy();
  const submittedAt = result?.submittedAt || '-';
  const serviceLabel = payload.serviceLabel;
  elements.successSummary.innerHTML = [
    `<b>${escapeHtml(copy.summarySubmittedAt)}</b>: ${escapeHtml(submittedAt)}`,
    `<b>${escapeHtml(copy.summaryService)}</b>: ${escapeHtml(serviceLabel)}`,
    `<b>${escapeHtml(copy.summaryContact)}</b>: ${escapeHtml(payload.phone)}`,
    payload.email ? `<b>${escapeHtml(copy.summaryEmail)}</b>: ${escapeHtml(payload.email)}` : '',
    `<b>${escapeHtml(copy.summaryInvoice)}</b>: ${escapeHtml(payload.businessInvoiceNeeded ? copy.invoiceYes : copy.invoiceNo)}`
  ].filter(Boolean).join('<br>');
  elements.formPanel.classList.add('hidden-field');
  elements.successPanel.classList.remove('hidden-field');
  setStatus(copy.successTitle, 'success');
}

function resetForm() {
  elements.form.reset();
  state.serviceGroup = normalizeServiceParam(new URLSearchParams(window.location.search).get('service')) || '';
  elements.serviceGroup.value = state.serviceGroup;
  elements.businessInvoiceNeeded.checked = false;
  toggleBusinessFields();
  elements.formPanel.classList.remove('hidden-field');
  elements.successPanel.classList.add('hidden-field');
  render();
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.submitting) return;
  const payload = collectPayload();
  const error = validatePayload(payload);
  if (error) {
    setStatus(error, 'error');
    return;
  }

  state.submitting = true;
  render();
  elements.submitBtn.disabled = true;
  setStatus(getCopy().submitting, 'info');

  try {
    const result = await submitWalkinIntake(payload, createRequestId('walkin'));
    showSuccess(result, payload);
  } catch (err) {
    setStatus(err?.message || 'Submit failed', 'error');
  } finally {
    state.submitting = false;
    elements.submitBtn.disabled = false;
    render();
  }
}

function bindEvents() {
  elements.langButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextLang = button.dataset.lang;
      if (!nextLang || nextLang === state.lang) return;
      state.lang = nextLang;
      setSavedLang(nextLang);
      render();
    });
  });

  elements.serviceGroup.addEventListener('change', () => {
    state.serviceGroup = elements.serviceGroup.value || '';
  });

  elements.businessInvoiceNeeded.addEventListener('change', toggleBusinessFields);
  elements.form.addEventListener('submit', handleSubmit);
  elements.restartBtn.addEventListener('click', resetForm);
}

bindEvents();
toggleBusinessFields();
render();
