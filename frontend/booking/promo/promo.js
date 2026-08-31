import { fetchCalendarBatch, fetchInitData, fetchQuote, fetchSlots, submitBooking } from '../../shared/api-booking.js';
import { createRequestId, escapeHtml, formatMonthLabel, pad2 } from '../../shared/utils.js';

const LANG_STORAGE_KEY = 'studio-mean-lang';
const SUPPORTED_LANGS = new Set(['ko', 'en', 'de']);

function readStoredLang() {
  const urlLang = readUrlLang();
  if (urlLang) {
    persistLang(urlLang);
    return urlLang;
  }
  try {
    const saved = globalThis.localStorage?.getItem(LANG_STORAGE_KEY) || 'ko';
    return SUPPORTED_LANGS.has(saved) ? saved : 'ko';
  } catch {
    return 'ko';
  }
}

function readUrlLang() {
  try {
    const params = new URLSearchParams(globalThis.location?.search || '');
    return normalizeLang(params.get('lang') || params.get('language') || params.get('locale'));
  } catch {
    return '';
  }
}

function normalizeLang(value) {
  const lang = String(value || '').trim().toLowerCase().slice(0, 2);
  return SUPPORTED_LANGS.has(lang) ? lang : '';
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
const SCHULTUETE_IDS = {
  mini: 'promo_schultuete_mini_2026',
  classic: 'promo_schultuete_classic_2026',
  family: 'promo_schultuete_family_2026'
};
const SCHULTUETE_BASE_PRICES = {
  [SCHULTUETE_IDS.mini]: 69,
  [SCHULTUETE_IDS.classic]: 119,
  [SCHULTUETE_IDS.family]: 159
};

function trimPromoDate(dateStr) {
  return String(dateStr || '').trim().slice(0, 10);
}

const COPY = {
  ko: {
    loading: '프로모션 예약 페이지를 준비하고 있습니다.',
    statusLoading: '프로모션 정보를 불러오는 중입니다.',
    statusReady: '프로모션 예약이 가능합니다.',
    statusClosed: '현재 프로모션 예약이 비활성화되어 있습니다.',
    closedTitle: '프로모션 예약이 현재 비활성화되어 있습니다.',
    closedBody: '운영 공지 후 다시 열릴 예정입니다.',
    eyebrow: 'Studio mean Schultüte Portrait Event 2026',
    heroTitle: 'Schultüte Portrait Event 2026',
    heroLead: '첫 등교의 설렘을 자연스럽고 따뜻하게 기록합니다. Schultüte 또는 Schulranzen과 함께 아이의 지금 표정과 가족의 분위기를 따뜻하게 남겨드립니다.',
    periodLabel: '진행 기간',
    limitLabel: '예약 안내',
    limitValue: '선착순 일정 마감',
    step1Title: '1. 패키지 선택',
    step1Lead: '희망 패키지를 선택해 주세요.',
    step2Title: '2. 촬영 구성',
    step2Lead: '입학 예정 아이와 가족 촬영 정보를 입력해 주세요.',
    step3Title: '3. 날짜 및 시간 선택',
    step4Title: '4. 예약 정보',
    step4Lead: '예약자 정보를 입력하고 신청을 완료해 주세요.',
    peopleLabel: '촬영 인원',
    childNameLabel: '입학 예정 아이 이름',
    schoolChildCountLabel: '입학 예정 아이 수',
    siblingOptionLabel: '형제/자매 촬영 여부',
    familyIncludedLabel: '가족 촬영 포함 여부',
    propsLabel: 'Schultüte 또는 Schulranzen 지참 가능 여부',
    extraRetouchLabel: '추가 보정본',
    childAgeLabel: '아이 나이',
    familyInfoLabel: '가족 구성',
    photocardTitle: '포토카드 사진 선택',
    photocardLead: '기본 포토카드는 양면입니다. 앞면과 뒷면에 들어갈 사진 방향을 선택해 주세요.',
    photocardNote: '포토카드에는 총 2장의 사진이 들어갑니다.',
    photocardRetouchedLabel: '보정본 2장 사용',
    photocardRetouchedSub: '기존 보정본 중에서 앞면/뒷면 사진을 선택합니다.',
    photocardMixedLabel: '보정본 1장 + 무보정 1장',
    photocardMixedSub: '앞면 또는 뒷면 한 장은 보정본, 한 장은 원본으로 구성합니다.',
    photocardOriginalLabel: '보정 없이 2장 사용',
    photocardOriginalSub: '원본에서 2장을 선택해 양면 포토카드로 제작합니다.',
    photocardReviewLabel: '포토카드',
    photocardSummaryRetouched: '양면 · 보정본 2장',
    photocardSummaryMixed: '양면 · 보정본 1장 + 무보정 1장',
    photocardSummaryOriginal: '양면 · 무보정 2장',
    nameLabel: '이름',
    phoneLabel: '연락처',
    emailLabel: '이메일',
    addressLabel: '주소 (인보이스용, 선택)',
    memoLabel: '요청사항',
    consentTitle: '이용 동의',
    consentLead: '가장 위의 전체 선택으로 필수 항목을 한 번에 체크할 수 있습니다.',
    requiredConsentLabel: '필수 동의',
    optionalConsentLabel: '선택 동의',
    selectAllLabel: '필수 항목 전체 선택',
    selectAllSub: '개인정보, 예약 조건 및 AI 필수 항목을 한 번에 체크합니다.',
    gdprLabel: '[필수] 개인정보 수집 및 예약 조건에 동의합니다.',
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
    periodValue(start, end) { return `현재 예약 가능 - ${trimPromoDate(end).replaceAll('-', '.')}까지`; },
    packageSummary: '포함 구성',
    dateHint: '예약 가능한 날짜와 시간을 선택해 주세요.',
    loadingCalendar: '달력을 불러오는 중입니다.',
    loadingSlots: '시간 정보를 불러오는 중입니다.',
    slotTitle: '예약 가능 시간',
    slotEmpty: '날짜를 선택하면 예약 가능한 시간이 표시됩니다.',
    slotNone: '예약 가능한 시간이 없습니다.',
    step1Warning: '희망 패키지를 선택해 주세요.',
    childNameRequired: '입학 예정 아이 이름을 입력해 주세요.',
    childAgeRequired: '아이 나이를 입력해 주세요.',
    familyInfoRequired: '가족 구성을 입력해 주세요.',
    step3WarningDate: '날짜를 먼저 선택해 주세요.',
    step3WarningTime: '시간을 먼저 선택해 주세요.',
    formRequired: '이름, 연락처, 이메일과 필수 동의를 확인해 주세요.',
    invalidEmail: '이메일 형식을 확인해 주세요.',
    successTitle: '예약 신청이 접수되었습니다.',
    successLead: '확인 메일을 보내드렸습니다. 순차적으로 안내드릴게요.',
    successGuide: '예약 가능 여부와 요청 옵션을 확인한 뒤 개별 안내드립니다.',
    bookingTime: '예약 일시',
    packageName: '상품',
    price: '예상 금액',
    customerName: '이름',
    customerEmail: '이메일',
    calendarFullShort: '마감',
    calendarClosedShort: '휴무',
    calendarHintProduct(name) { return `${name} · 예약 가능한 날짜와 시간을 선택해 주세요.`; },
    peopleCustomPlaceholder: '5명 이상 직접입력',
    childNamePlaceholder: '예: Mina',
    childAgePlaceholder: '예: 6세',
    familyInfoPlaceholder: '예: 부모 + 아이 2명',
    schoolChildCountOptions: [
      ['1', '1명'],
      ['2', '2명 (+40€, 보정본 2장 추가 포함)']
    ],
    siblingOptions: [
      ['none', '없음'],
      ['together', '형제/자매 함께 촬영 (+20€)'],
      ['solo', '형제/자매 단독 컷 추가 (+30€)'],
      ['both', '함께 촬영 + 단독 컷 추가 (+50€)']
    ],
    familyIncludedOptions: [
      ['yes', '포함'],
      ['no', '미포함'],
      ['consult', '상담 후 결정']
    ],
    propsOptions: [
      ['yes', '지참 가능'],
      ['no', '지참 어려움'],
      ['unsure', '아직 미정']
    ],
    extraRetouchOption(count) { return count ? `${count}장 (+${count * 15}€)` : '없음'; },
    memoPlaceholder: '전달할 요청사항이 있다면 적어 주세요.',
    addressPlaceholder: '인보이스가 필요한 경우만 입력해 주세요',
    groups: {
      promo_schultuete_mini_2026: {
        badge: 'Mini · 69€',
        title: 'Mini',
        desc: ['입학 예정 아이 1명 단독', '촬영 20분', '보정본 2장', 'Schultüte 또는 Schulranzen 지참 추천'],
        note: '아이 단독으로 짧고 자연스럽게 남기는 패키지입니다.'
      },
      promo_schultuete_classic_2026: {
        badge: 'Classic · 119€ · 추천',
        title: 'Classic',
        desc: ['입학 예정 아이 1명 + 가족 짧은 컷', '촬영 30분', '보정본 4장', '가장 추천드리는 기본 패키지'],
        note: '아이 단독 컷과 가족 짧은 컷을 함께 남깁니다.'
      },
      promo_schultuete_family_2026: {
        badge: 'Family · 159€',
        title: 'Family',
        desc: ['가족 최대 4인', '촬영 40분', '보정본 5장', '5인 이상은 1인 추가당 +20€'],
        note: '가족 분위기까지 충분히 남기고 싶은 분께 추천드립니다.'
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
    eyebrow: 'Studio mean Schultüte Portrait Event 2026',
    heroTitle: 'Schultüte Portrait Event 2026',
    heroLead: 'Natural and warm portraits for children starting school, with their Schultüte or Schulranzen and the feeling of this family season.',
    periodLabel: 'Promotion Period',
    limitLabel: 'Booking note',
    limitValue: 'Limited slots, first come first served',
    step1Title: '1. Choose your package',
    step1Lead: 'Select the package you would like to book.',
    step2Title: '2. Session details',
    step2Lead: 'Share the school starter and family photo details.',
    step3Title: '3. Select date and time',
    step4Title: '4. Booking details',
    step4Lead: 'Enter your contact details and submit the request.',
    peopleLabel: 'People in the shoot',
    childNameLabel: 'School starter child name',
    schoolChildCountLabel: 'Number of school starter children',
    siblingOptionLabel: 'Sibling photo option',
    familyIncludedLabel: 'Family photos included',
    propsLabel: 'Can you bring a Schultüte or Schulranzen?',
    extraRetouchLabel: 'Extra retouched photos',
    childAgeLabel: 'Child age',
    familyInfoLabel: 'Family members',
    photocardTitle: 'Photocard image option',
    photocardLead: 'The included photocard is double-sided. Choose how the front and back images should be prepared.',
    photocardNote: 'A total of 2 images are used for the photocard.',
    photocardRetouchedLabel: 'Use 2 retouched photos',
    photocardRetouchedSub: 'Select the front and back images from the final retouched set.',
    photocardMixedLabel: 'Use 1 retouched + 1 original photo',
    photocardMixedSub: 'One side uses a retouched image and the other uses an original image.',
    photocardOriginalLabel: 'Use 2 photos without retouching',
    photocardOriginalSub: 'Choose 2 original photos for the double-sided photocard.',
    photocardReviewLabel: 'Photocard',
    photocardSummaryRetouched: 'Double-sided · 2 retouched photos',
    photocardSummaryMixed: 'Double-sided · 1 retouched + 1 original photo',
    photocardSummaryOriginal: 'Double-sided · 2 unretouched photos',
    nameLabel: 'Name',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    addressLabel: 'Address (optional, for invoice)',
    memoLabel: 'Notes',
    consentTitle: 'Consent',
    consentLead: 'Use the first option to check all required items at once before submitting.',
    requiredConsentLabel: 'Required',
    optionalConsentLabel: 'Optional',
    selectAllLabel: 'Select all required items',
    selectAllSub: 'Checks the personal data, booking terms, and AI consent items together.',
    gdprLabel: '[Required] I agree to personal data processing and the booking terms.',
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
    periodValue(start, end) { return `Bookable now - ${trimPromoDate(end)}`; },
    packageSummary: 'What is included',
    dateHint: 'Choose an available date and time.',
    loadingCalendar: 'Loading calendar...',
    loadingSlots: 'Loading available times...',
    slotTitle: 'Available times',
    slotEmpty: 'Select a date to view available times.',
    slotNone: 'No available time for this date.',
    step1Warning: 'Please choose a package first.',
    childNameRequired: 'Please enter the school starter child name.',
    childAgeRequired: 'Please enter the child age.',
    familyInfoRequired: 'Please enter the family members.',
    step3WarningDate: 'Please choose a date first.',
    step3WarningTime: 'Please choose a time first.',
    formRequired: 'Please complete name, phone, email and required consent.',
    invalidEmail: 'Please check the email format.',
    successTitle: 'Your booking request has been received.',
    successLead: 'We have sent a confirmation email and will follow up shortly.',
    successGuide: 'We will review the selected date, package and options, then follow up personally.',
    bookingTime: 'Booking time',
    packageName: 'Package',
    price: 'Estimated price',
    customerName: 'Name',
    customerEmail: 'Email',
    calendarFullShort: 'Full',
    calendarClosedShort: 'Closed',
    calendarHintProduct(name) { return `${name} · Choose an available date and time.`; },
    peopleCustomPlaceholder: '5+ custom input',
    childNamePlaceholder: 'e.g. Mina',
    childAgePlaceholder: 'e.g. 6 years old',
    familyInfoPlaceholder: 'e.g. parents + 2 children',
    schoolChildCountOptions: [
      ['1', '1 child'],
      ['2', '2 children (+40€, includes 2 extra retouched photos)']
    ],
    siblingOptions: [
      ['none', 'No sibling photos'],
      ['together', 'Sibling together photos (+20€)'],
      ['solo', 'Extra sibling solo portraits (+30€)'],
      ['both', 'Together + solo sibling portraits (+50€)']
    ],
    familyIncludedOptions: [
      ['yes', 'Included'],
      ['no', 'Not included'],
      ['consult', 'Decide after consultation']
    ],
    propsOptions: [
      ['yes', 'Yes, we can bring one'],
      ['no', 'No, we cannot bring one'],
      ['unsure', 'Not sure yet']
    ],
    extraRetouchOption(count) { return count ? `${count} photo${count > 1 ? 's' : ''} (+${count * 15}€)` : 'None'; },
    memoPlaceholder: 'Share any requests or notes for the shoot.',
    addressPlaceholder: 'Enter only if you need an invoice',
    groups: {
      promo_schultuete_mini_2026: {
        badge: 'Mini · 69€',
        title: 'Mini',
        desc: ['One school starter child only', '20 min session', '2 retouched photos', 'Schultüte or Schulranzen recommended'],
        note: 'A short and natural portrait session for the child alone.'
      },
      promo_schultuete_classic_2026: {
        badge: 'Classic · 119€ · Recommended',
        title: 'Classic',
        desc: ['One school starter child + short family portraits', '30 min session', '4 retouched photos', 'Recommended package'],
        note: 'Includes child portraits plus a short family portrait moment.'
      },
      promo_schultuete_family_2026: {
        badge: 'Family · 159€',
        title: 'Family',
        desc: ['Family up to 4 people', '40 min session', '5 retouched photos', 'For 5+ people, +20€ per extra person'],
        note: 'Best if you want to include the family atmosphere more fully.'
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
    eyebrow: 'Studio mean Schultüte Portrait Event 2026',
    heroTitle: 'Schultüten-Portraits zur Einschulung 2026',
    heroLead: 'Natürliche und warme Erinnerungen an den ersten Schultag mit Schultüte oder Schulranzen.',
    periodLabel: 'Aktionszeitraum',
    limitLabel: 'Buchungshinweis',
    limitValue: 'Begrenzte Termine, nach Eingang',
    step1Title: '1. Paket wählen',
    step1Lead: 'Wählen Sie das gewünschte Paket aus.',
    step2Title: '2. Shooting-Konfiguration',
    step2Lead: 'Bitte Angaben zum Einschulungskind und zur Familienaufnahme eintragen.',
    step3Title: '3. Datum und Uhrzeit wählen',
    step4Title: '4. Buchungsdaten',
    step4Lead: 'Bitte Kontaktdaten eingeben und die Anfrage absenden.',
    peopleLabel: 'Personenzahl beim Shooting',
    childNameLabel: 'Name des Einschulungskindes',
    schoolChildCountLabel: 'Anzahl der Einschulungskinder',
    siblingOptionLabel: 'Geschwisterfotos',
    familyIncludedLabel: 'Familienfotos enthalten',
    propsLabel: 'Schultüte oder Schulranzen vorhanden?',
    extraRetouchLabel: 'Zusätzliche bearbeitete Bilder',
    childAgeLabel: 'Alter des Kindes',
    familyInfoLabel: 'Familienkonstellation',
    photocardTitle: 'Fotokarten-Bildauswahl',
    photocardLead: 'Die enthaltene Fotokarte ist doppelseitig. Bitte wählen Sie, wie Vorder- und Rückseite vorbereitet werden sollen.',
    photocardNote: 'Für die Fotokarte werden insgesamt 2 Bilder verwendet.',
    photocardRetouchedLabel: '2 bearbeitete Bilder verwenden',
    photocardRetouchedSub: 'Vorder- und Rückseite werden aus den bearbeiteten Bildern gewählt.',
    photocardMixedLabel: '1 bearbeitetes + 1 Originalbild',
    photocardMixedSub: 'Eine Seite nutzt ein bearbeitetes Bild, die andere ein Originalbild.',
    photocardOriginalLabel: '2 Bilder ohne Retusche verwenden',
    photocardOriginalSub: 'Zwei Originalbilder werden für die doppelseitige Fotokarte verwendet.',
    photocardReviewLabel: 'Fotokarte',
    photocardSummaryRetouched: 'Doppelseitig · 2 bearbeitete Bilder',
    photocardSummaryMixed: 'Doppelseitig · 1 bearbeitetes + 1 Originalbild',
    photocardSummaryOriginal: 'Doppelseitig · 2 unretuschierte Bilder',
    nameLabel: 'Name',
    phoneLabel: 'Telefon',
    emailLabel: 'E-Mail',
    addressLabel: 'Adresse (optional, für Rechnung)',
    memoLabel: 'Hinweise',
    consentTitle: 'Einwilligung',
    consentLead: 'Mit der ersten Option können alle Pflichtangaben auf einmal bestätigt werden.',
    requiredConsentLabel: 'Pflicht',
    optionalConsentLabel: 'Optional',
    selectAllLabel: 'Alle Pflichtangaben auswählen',
    selectAllSub: 'Bestätigt Datenschutz, Buchungsbedingungen und KI-Hinweis zusammen.',
    gdprLabel: '[Pflicht] Ich stimme der Datenverarbeitung und den Buchungsbedingungen zu.',
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
    periodValue(start, end) { return `Buchbar bis ${trimPromoDate(end).split('-').reverse().join('.')}`; },
    packageSummary: 'Leistungsumfang',
    dateHint: 'Wählen Sie ein verfügbares Datum und eine Uhrzeit.',
    loadingCalendar: 'Kalender wird geladen...',
    loadingSlots: 'Verfügbare Zeiten werden geladen...',
    slotTitle: 'Verfügbare Zeiten',
    slotEmpty: 'Bitte wählen Sie ein Datum, um verfügbare Zeiten zu sehen.',
    slotNone: 'Für dieses Datum ist keine Uhrzeit verfügbar.',
    step1Warning: 'Bitte wählen Sie zuerst ein Paket.',
    childNameRequired: 'Bitte geben Sie den Namen des Einschulungskindes ein.',
    childAgeRequired: 'Bitte geben Sie das Alter des Kindes ein.',
    familyInfoRequired: 'Bitte geben Sie die Familienkonstellation ein.',
    step3WarningDate: 'Bitte wählen Sie zuerst ein Datum.',
    step3WarningTime: 'Bitte wählen Sie zuerst eine Uhrzeit.',
    formRequired: 'Bitte Name, Telefon, E-Mail und die Pflicht-Einwilligung ausfüllen.',
    invalidEmail: 'Bitte prüfen Sie das E-Mail-Format.',
    successTitle: 'Ihre Buchungsanfrage wurde empfangen.',
    successLead: 'Wir haben eine Bestätigungsmail gesendet und melden uns zeitnah.',
    successGuide: 'Wir prüfen Termin, Paket und Optionen und melden uns persönlich zurück.',
    bookingTime: 'Buchungszeit',
    packageName: 'Paket',
    price: 'Voraussichtlicher Preis',
    customerName: 'Name',
    customerEmail: 'E-Mail',
    calendarFullShort: 'Voll',
    calendarClosedShort: 'Ruhe',
    calendarHintProduct(name) { return `${name} · Wählen Sie ein verfügbares Datum und eine Uhrzeit.`; },
    peopleCustomPlaceholder: 'Ab 5 Personen direkt eingeben',
    childNamePlaceholder: 'z. B. Mina',
    childAgePlaceholder: 'z. B. 6 Jahre',
    familyInfoPlaceholder: 'z. B. Eltern + 2 Kinder',
    schoolChildCountOptions: [
      ['1', '1 Kind'],
      ['2', '2 Kinder (+40€, inkl. 2 zusätzliche bearbeitete Bilder)']
    ],
    siblingOptions: [
      ['none', 'Keine Geschwisterfotos'],
      ['together', 'Geschwister gemeinsam (+20€)'],
      ['solo', 'Zusätzliche Geschwister-Einzelbilder (+30€)'],
      ['both', 'Gemeinsam + Einzelbilder (+50€)']
    ],
    familyIncludedOptions: [
      ['yes', 'Enthalten'],
      ['no', 'Nicht enthalten'],
      ['consult', 'Nach Beratung entscheiden']
    ],
    propsOptions: [
      ['yes', 'Ja, wir bringen etwas mit'],
      ['no', 'Nein, leider nicht'],
      ['unsure', 'Noch unklar']
    ],
    extraRetouchOption(count) { return count ? `${count} Bild${count > 1 ? 'er' : ''} (+${count * 15}€)` : 'Keine'; },
    memoPlaceholder: 'Notieren Sie Wünsche oder Hinweise zum Shooting.',
    addressPlaceholder: 'Nur eingeben, wenn eine Rechnung benötigt wird',
    groups: {
      promo_schultuete_mini_2026: {
        badge: 'Mini · 69€',
        title: 'Mini',
        desc: ['Ein Einschulungskind allein', '20 Min. Shooting', '2 bearbeitete Bilder', 'Schultüte oder Schulranzen empfohlen'],
        note: 'Kurze und natürliche Portraits nur für das Kind.'
      },
      promo_schultuete_classic_2026: {
        badge: 'Classic · 119€ · Empfehlung',
        title: 'Classic',
        desc: ['Ein Einschulungskind + kurze Familienbilder', '30 Min. Shooting', '4 bearbeitete Bilder', 'Empfohlenes Paket'],
        note: 'Enthält Kinderportraits und einen kurzen Familienmoment.'
      },
      promo_schultuete_family_2026: {
        badge: 'Family · 159€',
        title: 'Family',
        desc: ['Familie bis 4 Personen', '40 Min. Shooting', '5 bearbeitete Bilder', 'Ab 5 Personen +20€ pro weitere Person'],
        note: 'Ideal, wenn auch die Familienatmosphäre vollständig festgehalten werden soll.'
      }
    }
  }
};

const state = {
  lang: readStoredLang(),
  promoEnabled: false,
  promoStart: '2026-06-23',
  promoEnd: '2026-08-15',
  promoContent: {},
  products: [],
  selectedProduct: null,
  people: 1,
  customPeople: '',
  childName: '',
  schoolChildCount: '1',
  siblingOption: 'none',
  familyIncluded: 'yes',
  propsAvailable: 'yes',
  extraRetouchCount: '0',
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
  childNameField: document.getElementById('childNameField'),
  childNameInput: document.getElementById('childNameInput'),
  schoolChildCountSelect: document.getElementById('schoolChildCountSelect'),
  siblingOptionSelect: document.getElementById('siblingOptionSelect'),
  familyIncludedSelect: document.getElementById('familyIncludedSelect'),
  propsSelect: document.getElementById('propsSelect'),
  extraRetouchSelect: document.getElementById('extraRetouchSelect'),
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

function scrollToStepTop(step = activeStep) {
  const target = step === 1
    ? els.step1
    : step === 2
      ? els.step2
      : step === 3
        ? els.step3
        : els.step4;
  if (!target) return;
  const offset = window.innerWidth <= 768 ? 12 : 24;
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
  window.scrollTo({ top, behavior: 'smooth' });
}

function showStep(step) {
  activeStep = step;
  els.step1.classList.toggle('hidden', step !== 1);
  els.step2.classList.toggle('hidden', step !== 2);
  els.step3.classList.toggle('hidden', step !== 3);
  els.step4.classList.toggle('hidden', step !== 4);
  scrollToStepTop(step);
}

function setProductDefaults() {
  if (!state.selectedProduct) return;
  if (state.selectedProduct.id === SCHULTUETE_IDS.family) state.people = 4;
  else if (state.selectedProduct.id === SCHULTUETE_IDS.classic) state.people = 3;
  else state.people = 1;
  state.customPeople = '';
  state.childName = '';
  state.schoolChildCount = '1';
  state.siblingOption = 'none';
  state.familyIncluded = state.selectedProduct.id === SCHULTUETE_IDS.mini ? 'no' : 'yes';
  state.propsAvailable = 'yes';
  state.extraRetouchCount = '0';
  state.childAge = '';
  state.familyInfo = '';
  state.selectedDate = '';
  state.selectedSlot = '';
}

function getPeopleValue() {
  if (String(state.people) === 'custom') {
    return Math.max(5, Number(state.customPeople || 0) || 0);
  }
  return Number(state.people || 0) || 0;
}

function getSelectedOptionLabel(options, value) {
  const found = (options || []).find(([optionValue]) => String(optionValue) === String(value));
  return found ? found[1] : '';
}

function getExtraRetouchCount() {
  return Math.max(0, Math.min(10, parseInt(state.extraRetouchCount, 10) || 0));
}

function buildPromoOptionKeys() {
  const keys = [];
  if (String(state.schoolChildCount) === '2') keys.push('school_child_2');
  if (state.siblingOption === 'together' || state.siblingOption === 'both') keys.push('sibling_together');
  if (state.siblingOption === 'solo' || state.siblingOption === 'both') keys.push('sibling_solo');
  const extraRetouchCount = getExtraRetouchCount();
  if (extraRetouchCount) keys.push(`extra_retouch_${extraRetouchCount}`);
  return keys;
}

function getPromoExtraPrice() {
  const people = getPeopleValue();
  let total = 0;
  if (String(state.schoolChildCount) === '2') total += 40;
  if (state.siblingOption === 'together' || state.siblingOption === 'both') total += 20;
  if (state.siblingOption === 'solo' || state.siblingOption === 'both') total += 30;
  if (people > 4) total += (people - 4) * 20;
  total += getExtraRetouchCount() * 15;
  return total;
}

function buildQuotePayload() {
  if (!state.selectedProduct) return null;
  return {
    itemId: state.selectedProduct.id,
    people: getPeopleValue() || undefined,
    schoolChildCount: state.schoolChildCount,
    siblingOption: state.siblingOption,
    familyIncluded: state.familyIncluded,
    propsAvailable: state.propsAvailable,
    extraRetouchCount: getExtraRetouchCount(),
    surveyKeys: [],
    optionKeys: buildPromoOptionKeys()
  };
}

function selectedProductTitle(c = copy()) {
  if (!state.selectedProduct) return '';
  return getProductMeta(state.selectedProduct, c).title;
}

function getProductDisplayName(product) {
  if (!product) return '';
  return product.nameKo || product.nameEn || product.nameDe || product.id || '';
}

function getProductDescription(product) {
  if (!product) return [];
  return [product.descKo || product.descEn || product.descDe || ''].filter(Boolean);
}

function getProductMeta(product, c = copy()) {
  const fallbackTitle = getProductDisplayName(product);
  const sourceMeta = product?.id && c.groups[product.id] && typeof c.groups[product.id] === 'object'
    ? c.groups[product.id]
    : {};
  const desc = Array.isArray(sourceMeta.desc) && sourceMeta.desc.length
    ? sourceMeta.desc
    : getProductDescription(product);
  return {
    badge: sourceMeta.badge || fallbackTitle,
    title: sourceMeta.title || fallbackTitle,
    desc,
    note: sourceMeta.note || ''
  };
}

function setLang(lang) {
  if (!SUPPORTED_LANGS.has(lang)) return;
  state.lang = lang;
  persistLang(lang);
  updateLangQueryParam(lang);
  renderStaticCopy();
  renderProducts();
  renderDetailCard();
  renderPeopleOptions();
  renderPriceCard();
  updateReview();
  if (state.selectedProduct) {
    const c = copy();
    els.calendarHint.textContent = c.calendarHintProduct(selectedProductTitle(c));
  } else {
    els.calendarHint.textContent = copy().dateHint;
  }
  if (state.currentMonth) {
    renderCalendar(state.monthCache[monthKey(state.currentMonth.year, state.currentMonth.monthIndex)]);
  }
  if (state.selectedDate) {
    const cachedSlots = state.slotCache.get(`${state.selectedDate}_${getCalendarDuration()}`);
    renderSlots(Array.isArray(cachedSlots) ? cachedSlots : []);
  }
  if (!state.promoEnabled) {
    setStatus(copy().statusClosed, 'error');
  } else if (els.statusBanner.classList.contains('loading')) {
    setStatus(copy().statusLoading, 'loading');
  } else if (!els.statusBanner.classList.contains('error')) {
    setStatus(copy().statusReady, 'ready');
  }
  updateStepButtons();
}

function updateLangQueryParam(lang) {
  try {
    const url = new URL(globalThis.location.href);
    url.searchParams.set('lang', lang);
    globalThis.history?.replaceState(null, '', url.toString());
  } catch {
    // Keep language switching functional even if history state is unavailable.
  }
}

function getPromoPreviewQuote() {
  if (!state.selectedProduct) return null;
  const people = getPeopleValue();
  if (!people) return null;
  const basePrice = SCHULTUETE_BASE_PRICES[state.selectedProduct.id];
  if (basePrice === undefined) return null;
  const totalPrice = basePrice + getPromoExtraPrice();
  const duration = Number(state.selectedProduct?.d || 0);
  const prep = Number(state.selectedProduct?.prep || 0);
  return {
    itemId: state.selectedProduct.id,
    people,
    totalPrice,
    duration,
    prep,
    totalDuration: duration + prep,
    optionKeys: buildPromoOptionKeys()
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

function renderOptionSelect(select, options, value) {
  if (!select) return;
  select.innerHTML = (options || [])
    .map(([optionValue, label]) => `<option value="${escapeHtml(optionValue)}">${escapeHtml(label)}</option>`)
    .join('');
  select.value = String(value);
}

function renderPromoOptionControls() {
  const c = copy();
  renderOptionSelect(els.schoolChildCountSelect, c.schoolChildCountOptions, state.schoolChildCount);
  renderOptionSelect(els.siblingOptionSelect, c.siblingOptions, state.siblingOption);
  renderOptionSelect(els.familyIncludedSelect, c.familyIncludedOptions, state.familyIncluded);
  renderOptionSelect(els.propsSelect, c.propsOptions, state.propsAvailable);
  if (els.extraRetouchSelect) {
    els.extraRetouchSelect.innerHTML = Array.from({ length: 6 }, (_, count) => (
      `<option value="${count}">${escapeHtml(c.extraRetouchOption(count))}</option>`
    )).join('');
    els.extraRetouchSelect.value = String(getExtraRetouchCount());
  }
}

function syncPromoInputValues() {
  if (els.childNameInput) els.childNameInput.value = state.childName;
  if (els.familyInfoInput) els.familyInfoInput.value = state.familyInfo;
  renderPromoOptionControls();
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
  setText('childNameLabel', c.childNameLabel);
  setText('schoolChildCountLabel', c.schoolChildCountLabel);
  setText('siblingOptionLabel', c.siblingOptionLabel);
  setText('familyIncludedLabel', c.familyIncludedLabel);
  setText('propsLabel', c.propsLabel);
  setText('extraRetouchLabel', c.extraRetouchLabel);
  setText('childAgeLabel', c.childAgeLabel);
  setText('familyInfoLabel', c.familyInfoLabel);
  setText('nameLabel', c.nameLabel);
  setText('phoneLabel', c.phoneLabel);
  setText('emailLabel', c.emailLabel);
  setText('addressLabel', c.addressLabel);
  setText('memoLabel', c.memoLabel);
  setText('consentTitle', c.consentTitle);
  setText('consentLead', c.consentLead);
  setText('requiredConsentLabel', c.requiredConsentLabel);
  setText('optionalConsentLabel', c.optionalConsentLabel);
  setText('selectAllLabel', c.selectAllLabel);
  setText('selectAllSub', c.selectAllSub);
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
  els.peopleCustom.placeholder = c.peopleCustomPlaceholder;
  els.slotTitle.textContent = c.slotTitle;
  els.slotHint.textContent = state.selectedDate ? `${c.bookingTime}: ${state.selectedDate}` : c.slotEmpty;
  els.calendarHint.textContent = state.selectedProduct
    ? c.calendarHintProduct(selectedProductTitle(c))
    : c.dateHint;
  els.calendarGrid.textContent = c.loadingCalendar;
  els.slotGrid.textContent = c.loadingSlots;
  els.form.elements.address.placeholder = c.addressPlaceholder;
  els.form.elements.memo.placeholder = c.memoPlaceholder;
  if (els.childNameInput) els.childNameInput.placeholder = c.childNamePlaceholder;
  if (els.childAgeInput) els.childAgeInput.placeholder = c.childAgePlaceholder;
  els.familyInfoInput.placeholder = c.familyInfoPlaceholder;
  renderPromoOptionControls();
  document.getElementById('successTitle').textContent = c.successTitle;
  document.getElementById('successLead').textContent = c.successLead;
  els.successGuide.textContent = c.successGuide;
  document.getElementById('periodValue').textContent = c.periodValue(state.promoStart, state.promoEnd);
  els.langBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.lang === state.lang));
}

function renderProducts() {
  const c = copy();
  els.productGrid.innerHTML = state.products.map((product) => {
    const meta = getProductMeta(product, c);
    const active = state.selectedProduct?.id === product.id ? ' active' : '';
    return `<button type="button" class="product-card${active}" data-product-id="${product.id}">
      <span class="card-badge">${escapeHtml(meta.badge)}</span>
      <strong>${escapeHtml(meta.title)}</strong>
      <ul class="feature-list compact">${meta.desc.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      ${meta.note ? `<div class="product-note">${escapeHtml(meta.note)}</div>` : ''}
    </button>`;
  }).join('');
}

function renderDetailCard() {
  const c = copy();
  if (!state.selectedProduct) {
    els.detailCard.innerHTML = '';
    return;
  }
  const meta = getProductMeta(state.selectedProduct, c);
  els.detailCard.innerHTML = `
    <div class="card-badge">${escapeHtml(meta.badge)}</div>
    <h3>${escapeHtml(meta.title)}</h3>
    <div class="detail-grid">
      <div>
        <div class="meta-label">${escapeHtml(c.packageSummary)}</div>
        <ul class="feature-list">${meta.desc.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
      ${meta.note ? `<div class="note-box"><strong>${escapeHtml(meta.badge)}</strong><p>${escapeHtml(meta.note)}</p></div>` : ''}
    </div>`;
}

function renderPeopleOptions() {
  const c = copy();
  const base = 1;
  const options = [];
  for (let i = base; i <= 5; i += 1) {
    let label = `${i}${state.lang === 'de' ? ' Personen' : state.lang === 'en' ? ' people' : '인'}`;
    if (i > 4) label += ' (+20€)';
    options.push(`<option value="${i}">${escapeHtml(label)}</option>`);
  }
  options.push(`<option value="custom">${escapeHtml(c.peopleCustomPlaceholder)}</option>`);
  els.peopleSelect.innerHTML = options.join('');
  els.peopleSelect.value = String(state.people);
  els.peopleCustom.classList.toggle('hidden', String(state.people) !== 'custom');
}

function renderConditionalFields() {
  els.childAgeField?.classList.add('hidden');
}

function peopleText() {
  return `${getPeopleValue()}${state.lang === 'de' ? ' Personen' : state.lang === 'en' ? ' people' : '인'}`;
}

function promoDetailRows(c, includeEmpty = false) {
  const rows = [
    [c.childNameLabel, state.childName],
    [c.schoolChildCountLabel, getSelectedOptionLabel(c.schoolChildCountOptions, state.schoolChildCount)],
    [c.siblingOptionLabel, getSelectedOptionLabel(c.siblingOptions, state.siblingOption)],
    [c.familyIncludedLabel, getSelectedOptionLabel(c.familyIncludedOptions, state.familyIncluded)],
    [c.propsLabel, getSelectedOptionLabel(c.propsOptions, state.propsAvailable)],
    [c.extraRetouchLabel, c.extraRetouchOption(getExtraRetouchCount())],
    [c.familyInfoLabel, state.familyInfo]
  ];
  return includeEmpty ? rows : rows.filter(([, value]) => String(value || '').trim());
}

function renderPriceCard() {
  const c = copy();
  const quote = state.quote || getPromoPreviewQuote();
  if (!quote || !state.selectedProduct) {
    els.priceCard.innerHTML = '';
    return;
  }
  const meta = getProductMeta(state.selectedProduct, c);
  const detailRows = [];
  if (String(state.schoolChildCount) === '2') {
    detailRows.push([c.schoolChildCountLabel, getSelectedOptionLabel(c.schoolChildCountOptions, state.schoolChildCount)]);
  }
  if (state.siblingOption && state.siblingOption !== 'none') {
    detailRows.push([c.siblingOptionLabel, getSelectedOptionLabel(c.siblingOptions, state.siblingOption)]);
  }
  if (getExtraRetouchCount()) {
    detailRows.push([c.extraRetouchLabel, c.extraRetouchOption(getExtraRetouchCount())]);
  }
  els.priceCard.innerHTML = `
    <div class="price-label">${escapeHtml(c.price)}</div>
    <div class="price-main">€${escapeHtml(quote.totalPrice)}</div>
    <div class="price-sub">${escapeHtml(meta.title)}</div>
    <div class="price-meta">
      <div class="price-meta-item">
        <span class="price-meta-label">${escapeHtml(c.packageName)}</span>
        <strong class="price-meta-value">${escapeHtml(meta.title)}</strong>
      </div>
      <div class="price-meta-item">
        <span class="price-meta-label">${escapeHtml(c.peopleLabel)}</span>
        <strong class="price-meta-value">${escapeHtml(peopleText())}</strong>
      </div>
      ${detailRows.map(([label, value]) => `
        <div class="price-meta-item">
          <span class="price-meta-label">${escapeHtml(label)}</span>
          <strong class="price-meta-value">${escapeHtml(value)}</strong>
        </div>
      `).join('')}
    </div>
    ${meta.note ? `<div class="price-note">${escapeHtml(meta.note)}</div>` : ''}
  `;
}

function scrollSlotPanelIntoView() {
  if (window.innerWidth > 960) return;
  const panel = document.querySelector('.slot-panel');
  if (!panel) return;
  const offset = 12;
  const top = Math.max(0, panel.getBoundingClientRect().top + window.scrollY - offset);
  window.scrollTo({ top, behavior: 'smooth' });
}

function monthKey(year, monthIndex) {
  return `${year}-${pad2(monthIndex + 1)}`;
}

function weekdayLabels() {
  if (state.lang === 'en') return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (state.lang === 'de') return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return ['일', '월', '화', '수', '목', '금', '토'];
}

function isDateAllowed(dateStr, unavailSet, closedSet = new Set()) {
  const today = todayDateStr();
  return dateStr >= today &&
    dateStr >= state.promoStart &&
    dateStr <= state.promoEnd &&
    dateStr <= PROMO_END_LIMIT &&
    !unavailSet.has(dateStr) &&
    !closedSet.has(dateStr);
}

function renderCalendar(batchData) {
  const { year, monthIndex } = state.currentMonth;
  const key = monthKey(year, monthIndex);
  const unavail = new Set((batchData?.unavail || state.monthCache[key]?.unavail || []).map(String));
  const closed = new Set((batchData?.closed || state.monthCache[key]?.closed || []).map(String));
  const c = copy();
  els.monthLabel.textContent = formatMonthLabel(year, monthIndex, state.lang);
  els.calendarWeekdays.innerHTML = weekdayLabels().map((label) => `<span>${escapeHtml(label)}</span>`).join('');
  const first = new Date(year, monthIndex, 1);
  const startWeekday = first.getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push('<span class="day-spacer"></span>');
  for (let day = 1; day <= days; day += 1) {
    const dateStr = `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
    const isClosed = closed.has(dateStr);
    const isFull = !isClosed && unavail.has(dateStr);
    const allowed = isDateAllowed(dateStr, unavail, closed);
    const classes = ['day-btn'];
    if (state.selectedDate === dateStr) classes.push('active');
    if (!allowed) classes.push('disabled');
    if (isFull) classes.push('full');
    if (isClosed) classes.push('closed');
    const statusLabel = isClosed ? c.calendarClosedShort : isFull ? c.calendarFullShort : '';
    cells.push(`<button type="button" class="${classes.join(' ')}" data-date="${dateStr}" ${allowed ? '' : 'disabled'}${statusLabel ? ` data-status-label="${escapeHtml(statusLabel)}"` : ''}>${day}</button>`);
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
    const value = typeof slot === 'string' ? slot : String(slot?.time || '');
    const active = state.selectedSlot === value ? ' active' : '';
    return `<button type="button" class="slot-btn${active}" data-slot="${escapeHtml(value)}">${escapeHtml(value)}</button>`;
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
  const meta = getProductMeta(state.selectedProduct, c);
  const rows = [
    [c.packageName, meta.title],
    [c.price, `€${quote.totalPrice}`],
    [c.peopleLabel, peopleText()],
    ...promoDetailRows(c)
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
    if (!String(state.childName || '').trim()) return c.childNameRequired;
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

function toggleAllRequired(event) {
  const checked = !!event?.target?.checked;
  if (els.form.elements.gdprConsent) els.form.elements.gdprConsent.checked = checked;
  if (els.form.elements.aiConsent) els.form.elements.aiConsent.checked = checked;
  syncSelectAllRequired();
  updateStepButtons();
}

function syncSelectAllRequired() {
  const selectAll = document.getElementById('selectAllRequired');
  if (!selectAll) return;
  selectAll.checked = !!els.form.elements.gdprConsent?.checked && !!els.form.elements.aiConsent?.checked;
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
  syncPromoInputValues();
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
  const c = copy();
  els.calendarHint.textContent = c.calendarHintProduct(selectedProductTitle(c));
  await ensureMonthLoaded(state.currentMonth.year, state.currentMonth.monthIndex);
  updateStepButtons();
}

function renderSuccess(result) {
  const c = copy();
  const meta = getProductMeta(state.selectedProduct, c);
  const rows = [
    [c.customerName, result.name || els.form.elements.name.value],
    [c.customerEmail, result.email || els.form.elements.email.value],
    [c.bookingTime, `${result.date || state.selectedDate} ${result.time || state.selectedSlot}`],
    [c.packageName, meta.title],
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
  const c = copy();
  const meta = getProductMeta(state.selectedProduct, c);
  const userMemo = String(els.form.elements.memo.value || '').trim();
  const detailMemo = [
    '[Schultüte Portrait Event 2026]',
    `${c.childNameLabel}: ${state.childName || '-'}`,
    `${c.schoolChildCountLabel}: ${getSelectedOptionLabel(c.schoolChildCountOptions, state.schoolChildCount) || '-'}`,
    `${c.siblingOptionLabel}: ${getSelectedOptionLabel(c.siblingOptions, state.siblingOption) || '-'}`,
    `${c.familyIncludedLabel}: ${getSelectedOptionLabel(c.familyIncludedOptions, state.familyIncluded) || '-'}`,
    `${c.propsLabel}: ${getSelectedOptionLabel(c.propsOptions, state.propsAvailable) || '-'}`,
    `${c.peopleLabel}: ${peopleText()}`,
    `${c.familyInfoLabel}: ${state.familyInfo || '-'}`,
    `${c.extraRetouchLabel}: ${c.extraRetouchOption(getExtraRetouchCount())}`,
    userMemo ? `${c.memoLabel}: ${userMemo}` : ''
  ].filter(Boolean).join('\n');
  return {
    itemId: state.selectedProduct.id,
    people: getPeopleValue(),
    date: state.selectedDate,
    time: state.selectedSlot,
    name: String(els.form.elements.name.value || '').trim(),
    phone: String(els.form.elements.phone.value || '').trim(),
    phoneCountry: /^\s*0?10[-\s.]?\d/.test(String(els.form.elements.phone.value || '')) ? '+82' : '+49',
    email: String(els.form.elements.email.value || '').trim(),
    address: String(els.form.elements.address.value || '').trim(),
    memo: detailMemo,
    gdprConsent: !!els.form.elements.gdprConsent.checked,
    privacy_terms_accepted: !!els.form.elements.gdprConsent.checked,
    contract_terms_accepted: !!els.form.elements.gdprConsent.checked && !!els.form.elements.aiConsent?.checked,
    aiConsent: !!els.form.elements.aiConsent?.checked,
    marketing: !!els.form.elements.marketing.checked,
    lang: state.lang,
    schoolChildCount: state.schoolChildCount,
    siblingOption: state.siblingOption,
    familyIncluded: state.familyIncluded,
    propsAvailable: state.propsAvailable,
    extraRetouchCount: getExtraRetouchCount(),
    optionKeys: buildPromoOptionKeys(),
    surveyKeys: [],
    meta: {
      promoType: meta.title,
      childName: state.childName,
      schoolChildCount: state.schoolChildCount,
      siblingOption: state.siblingOption,
      familyIncluded: state.familyIncluded,
      propsAvailable: state.propsAvailable,
      extraRetouchCount: getExtraRetouchCount()
    }
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
  els.childNameInput?.addEventListener('input', () => {
    state.childName = els.childNameInput.value;
    updateReview();
    updateStepButtons();
  });
  [
    ['schoolChildCountSelect', 'schoolChildCount'],
    ['siblingOptionSelect', 'siblingOption'],
    ['familyIncludedSelect', 'familyIncluded'],
    ['propsSelect', 'propsAvailable'],
    ['extraRetouchSelect', 'extraRetouchCount']
  ].forEach(([elKey, stateKey]) => {
    els[elKey]?.addEventListener('change', () => {
      state[stateKey] = els[elKey].value;
      syncQuoteFromCache();
      updateReview();
      updateStepButtons();
      queueQuoteRefresh();
    });
  });
  els.childAgeInput?.addEventListener('input', () => {
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
    scrollSlotPanelIntoView();
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
  document.getElementById('selectAllRequired')?.addEventListener('change', toggleAllRequired);
  els.form.elements.gdprConsent?.addEventListener('change', syncSelectAllRequired);
  els.form.elements.aiConsent?.addEventListener('change', syncSelectAllRequired);
  els.form.addEventListener('input', updateStepButtons);
  els.form.addEventListener('change', updateStepButtons);
  els.submitBtn.addEventListener('click', onSubmit);
  els.restartBtn.addEventListener('click', () => window.location.reload());
}

async function init() {
  renderStaticCopy();
  syncSelectAllRequired();
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
