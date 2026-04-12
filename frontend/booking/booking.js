import { fetchCalendarBatch, fetchInitData, fetchQuote, fetchReturnEligibility, fetchSlots, submitBooking } from './shared/api.js';
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

const OPTION_META = {
  dog: {
    groups: ['stud', 'snap'],
    label: { ko: '반려동물 (+€15)', en: 'Pet (+€15)', de: 'Haustier (+€15)' }
  },
  bg: {
    groups: ['prof', 'stud'],
    label: { ko: '배경 추가 (+€20)', en: 'Extra background (+€20)', de: 'Zusätzlicher Hintergrund (+€20)' }
  },
  outfit: {
    groups: ['prof', 'stud', 'snap'],
    label: { ko: '의상 추가 (+€20)', en: 'Extra outfit (+€20)', de: 'Extra Outfit (+€20)' }
  }
};

const BUSINESS_MODE_META = [
  { key: 'photo', label: { ko: '행사 사진', en: 'Event Photo', de: 'Event Foto' } },
  { key: 'video', label: { ko: '행사 영상', en: 'Event Video', de: 'Event Video' } }
];

const BUSINESS_HOURS_META = [2, 3, 4, 5, 6, 7, 8];

const BUSINESS_VIDEO_EDIT_META = [
  { key: 'raw', label: { ko: '촬영만 · 원본 제공', en: 'Raw Footage Only', de: 'Nur Aufnahme / Rohmaterial' } },
  { key: 'basic', label: { ko: '기본 편집 · 2~5분', en: 'Basic Edit · 2–5 min', de: 'Basis-Schnitt · 2–5 Min.' } },
  { key: 'full', label: { ko: '풀 편집 · 10분 이상', en: 'Full Edit · 10+ min', de: 'Vollschnitt · 10+ Min.' } }
];

const BUSINESS_ADDON_META = [
  { key: 'sns', label: { ko: 'SNS 숏폼 요청', en: 'SNS Short Form Request', de: 'SNS Kurzformat Anfrage' } },
  { key: 'rush', label: { ko: '긴급 납품 요청', en: 'Rush Delivery Request', de: 'Express-Lieferung Anfrage' } },
  { key: 'branding', label: { ko: '자막/로고/BGM 요청', en: 'Subtitle / Logo / BGM Request', de: 'Untertitel / Logo / BGM Anfrage' } }
];

const BUSINESS_PRICE_META = {
  photo: { 2: 300, 3: 450, 4: 500, 5: 600, 6: 700, 7: 800, 8: 880 },
  video_raw: { 2: 400, 3: 550, 4: 700, 5: 850, 6: 1000, 7: 1150, 8: 1300 },
  video_basic: { 2: 600, 3: 800, 4: 1000, 5: 1200, 6: 1400, 7: 1600, 8: 1800 },
  video_full: { 2: 800, 3: 1100, 4: 1400, 5: 1700, 6: 2000, 7: 2300, 8: 2600 }
};

const AGE_META = [
  { key: 'baby', label: { ko: '영유아', en: 'Infant', de: 'Kleinkind' } },
  { key: 'kids', label: { ko: '키즈 (-€10)', en: 'Kids (-€10)', de: 'Kinder (-€10)' } },
  { key: 'adult', label: { ko: '성인', en: 'Adult', de: 'Erwachsene' } },
  { key: 'senior', label: { ko: '시니어', en: 'Senior', de: 'Senior' } }
];

const BABY_TYPE_META = [
  { key: 'baekil', label: { ko: '백일', en: '100 Days', de: '100 Tage' } },
  { key: 'dol', label: { ko: '돌', en: '1st Birthday', de: '1. Geburtstag' } }
];

const BG_META = [
  { key: 'white', color: '#f6f4ef', label: { ko: '화이트', en: 'White', de: 'Weiß' } },
  { key: 'grey', color: '#d9d9d6', label: { ko: '그레이', en: 'Grey', de: 'Grau' } },
  { key: 'black', color: '#2d2a26', label: { ko: '블랙', en: 'Black', de: 'Schwarz' } },
  { key: 'beige', color: '#d9c3a3', label: { ko: '베이지', en: 'Beige', de: 'Beige' } },
  { key: 'pink', color: '#efc9d1', label: { ko: '핑크', en: 'Pink', de: 'Pink' } },
  { key: 'sky', color: '#c9dff2', label: { ko: '하늘색', en: 'Sky Blue', de: 'Himmelblau' } }
];

const BG_REC_META = {
  white: {
    outfits: {
      ko: '올 화이트, 데님, 파스텔톤, 블랙',
      en: 'All white, denim, pastel tones, black',
      de: 'Ganz in Weiß, Denim, Pastelltöne, Schwarz'
    },
    desc: {
      ko: '가장 깨끗하고 화사한 느낌. 광고나 프로필 사진의 정석입니다.',
      en: 'The cleanest and brightest mood. A classic choice for advertising or profile photos.',
      de: 'Der sauberste und hellste Look. Ein Klassiker für Werbe- oder Profilfotos.'
    },
    guide: {
      ko: 'Classic & Clean',
      en: 'Classic & Clean',
      de: 'Klassisch & Clean'
    }
  },
  grey: {
    outfits: {
      ko: '무채색(블랙/화이트), 네이비, 버건디',
      en: 'Monotones (black/white), navy, burgundy',
      de: 'Monotöne (Schwarz/Weiß), Navy, Bordeaux'
    },
    desc: {
      ko: '도회적이고 지적인 분위기. 비즈니스 프로필에 잘 어울립니다.',
      en: 'Urban and intelligent mood. Works especially well for business profiles.',
      de: 'Urban und intelligent. Besonders passend für Business-Profile.'
    },
    guide: {
      ko: 'Classic & Clean',
      en: 'Classic & Clean',
      de: 'Klassisch & Clean'
    }
  },
  black: {
    outfits: {
      ko: '블랙, 다크 그레이, 골드/실버 포인트',
      en: 'Black, dark grey, gold/silver accents',
      de: 'Schwarz, Dunkelgrau, Gold-/Silber-Akzente'
    },
    desc: {
      ko: '시크하고 고급스러운 느낌. 인물의 윤곽과 표정에 집중하기 좋습니다.',
      en: 'Chic and luxurious. Great for emphasizing facial lines and expressions.',
      de: 'Schick und hochwertig. Ideal, um Konturen und Ausdruck zu betonen.'
    },
    guide: {
      ko: 'Classic & Clean',
      en: 'Classic & Clean',
      de: 'Klassisch & Clean'
    }
  },
  beige: {
    outfits: {
      ko: '브라운, 아이보리, 웜톤 그린',
      en: 'Brown, ivory, warm green tones',
      de: 'Braun, Elfenbein, warme Grüntöne'
    },
    desc: {
      ko: '따뜻하고 부드러운 감성. 자연스러운 라이프스타일 컷에 추천합니다.',
      en: 'Warm and soft. Recommended for natural lifestyle-style portraits.',
      de: 'Warm und weich. Ideal für natürliche Lifestyle-Aufnahmen.'
    },
    guide: {
      ko: 'Warm & Natural',
      en: 'Warm & Natural',
      de: 'Warm & Natürlich'
    }
  },
  pink: {
    outfits: {
      ko: '화이트, 라이트 그레이, 진한 로즈',
      en: 'White, light grey, deep rose',
      de: 'Weiß, Hellgrau, dunkles Rosé'
    },
    desc: {
      ko: '사랑스럽고 로맨틱한 연출. 소품을 활용한 컨셉 촬영에 좋습니다.',
      en: 'Lovely and romantic. Great for styled sessions with props.',
      de: 'Lieblich und romantisch. Passt gut zu Konzeptshootings mit Requisiten.'
    },
    guide: {
      ko: 'Cool & Fresh',
      en: 'Cool & Fresh',
      de: 'Kühl & Frisch'
    }
  },
  sky: {
    outfits: {
      ko: '화이트, 레몬 옐로우, 네이비',
      en: 'White, lemon yellow, navy',
      de: 'Weiß, Zitronengelb, Navy'
    },
    desc: {
      ko: '청량하고 깨끗한 이미지. 여름 시즌이나 스포티한 컨셉에 잘 어울립니다.',
      en: 'Clear and refreshing. Fits summer or sporty concepts very well.',
      de: 'Klar und frisch. Passt besonders gut zu sommerlichen oder sportlichen Konzepten.'
    },
    guide: {
      ko: 'Cool & Fresh',
      en: 'Cool & Fresh',
      de: 'Kühl & Frisch'
    }
  }
};

const SURVEY_META = [
  { key: 'clean', icon: '🪴', label: { ko: '깔끔/모던', en: 'Clean / Modern', de: 'Sauber / Modern' } },
  { key: 'warm', icon: '🌿', label: { ko: '따뜻/자연', en: 'Warm / Natural', de: 'Warm / Natürlich' } },
  { key: 'pro', icon: '💼', label: { ko: '전문/포멀', en: 'Professional / Formal', de: 'Professionell / Formal' } },
  { key: 'unique', icon: '✨', label: { ko: '트렌디/유니크', en: 'Trendy / Unique', de: 'Trendy / Einzigartig' } },
  { key: 'baby', icon: '👶', label: { ko: '백일/돌', en: 'Baby / Birthday', de: 'Baby / Geburtstag' } }
];

const COPY = {
  ko: {
    heroTitle: '예약하기',
    hero: '원하시는 촬영 종류와 일정을 선택한 뒤 예약 정보를 입력해 주세요.',
    loadingCopy: '예약 페이지를 준비하고 있습니다.',
    step1Title: '1. 촬영 종류 선택',
    step2Title: '2. 세부 상품 선택',
    step3Title: '3. 날짜 및 시간 선택',
    step4Title: '4. 시간 선택',
    step5Title: '4. 예약 정보',
    groupHelp: '먼저 촬영 종류를 선택해 주세요.',
    initSuccess: '촬영 종류를 선택해 주세요.',
    loadCalendar: '달력을 불러오는 중입니다.',
    calendarLoaded: '예약 가능한 날짜를 확인해 주세요.',
    calendarFail: '달력 조회 실패',
    slotHintEmpty: '날짜를 선택하면 예약 가능 시간이 표시됩니다.',
    noSlots: '예약 가능한 시간이 없습니다.',
    invalidForm: '이름, 연락처, 이메일은 필수입니다.',
    submitDone: '예약 신청이 정상적으로 접수되었습니다.',
    submitCardTitle: '예약 신청이 접수되었습니다.',
    submitCardCopy: '확인 메일을 보내드렸습니다. 관리자 확인 후 순차적으로 안내드립니다.',
    submitCardName: '이름',
    submitCardEmail: '이메일',
    submitCardDateTime: '예약 일시',
    submitCardProduct: '상품',
    submitCardPrice: '예상 금액',
    submitCardNote: '메일이 보이지 않으면 스팸함도 함께 확인해 주세요.',
    submitCardReturn: '재방문 할인 대상 예약으로 접수되었습니다.',
    submitCardAction: '새 예약 시작',
    submitFail: '예약 제출 실패',
    productHelp: '상품을 선택하면 설명과 예약 가능 일정을 불러옵니다.',
    formHelp: '기본 예약 정보를 입력한 뒤 제출합니다.',
    generalTitle: '추가 설정',
    generalCopy: '인원이나 옵션을 선택하면 예상 금액이 다시 계산됩니다.',
    passportTitle: '여권/비자 옵션',
    passportCopy: '촬영 국가를 선택하면 국가별 추가 비용을 함께 반영합니다.',
    passportHint: '기본 1개 국가는 포함되며, 추가 국가는 1개당 €5가 반영됩니다.',
    passportPeopleLabel: '인원',
    generalPeopleLabel: '인원',
    ageFieldLabel: '촬영 대상 연령',
    babyTypeFieldLabel: '촬영 종류',
    reshootingTitle: '재촬영 약관 동의',
    passAddonTitle: '여권사진 추가 촬영',
    passAddonCopy: '프로필/스튜디오와 함께 여권사진을 추가합니다.',
    passAddonPeopleLabel: '여권 인원',
    locationLabel: '희망 촬영 장소',
    businessLabel: '행사 상세 내용',
    bizModeLabel: '촬영 유형',
    bizHoursLabel: '촬영 시간',
    bizEditLabel: '영상 편집',
    bizAddonLabel: '추가 요청',
    bizAddonHelp: '추가 요청은 예약 접수 후 세부 내용에 따라 별도 비용이 안내될 수 있습니다.',
    surveyFieldLabel: '원하는 분위기',
    bgFieldLabel: '배경 선택',
    nameLabel: '이름',
    phoneLabel: '연락처',
    emailLabel: '이메일',
    addressLabel: '주소 (인보이스용, 선택)',
    babyNameLabel: '아기 이름',
    otherCountryLabel: '기타 국가명',
    memoLabel: '요청사항',
    consentTitle: '이용 동의',
    consentCopy: '필수 항목을 체크해야 예약을 제출할 수 있습니다.',
    selectAllLabel: '[선택] 필수 항목 전체 선택',
    gdprLabel: '[필수] 개인정보 수집 및 이용에 동의합니다.',
    gdprSub: '서비스 예약 확인 및 촬영물 전달을 위한 최소한의 정보 처리에 동의합니다.',
    aiLabel: '[필수] AI 보정 및 처리 안내에 동의합니다.',
    aiSub: '촬영본 보정과 결과물 제작 과정에서 AI 기반 도구가 보조적으로 활용될 수 있음을 안내합니다.',
    marketingLabel: '[선택] 마케팅/SNS/포트폴리오 활용에 동의합니다.',
    marketingSub: '촬영 결과물을 Studio mean의 웹사이트 및 SNS 홍보 용도로 활용하는 것에 동의합니다.',
    submitLabel: '예약 제출',
    submitLoading: '제출 중...',
    calendarPrompt: '상품을 먼저 선택하세요.',
    calendarLoadedHint: '예약 가능 날짜를 선택해 주세요.',
    monthPrev: '이전 달',
    monthNext: '다음 달',
    slotPanelTitle: '예약 가능 시간',
    selectProductDetailEmpty: '상품을 선택하면 설명과 예상 금액이 여기에 표시됩니다.',
    selectCategoryEmpty: '카테고리를 먼저 선택해 주세요.',
    noOptions: '추가 옵션이 없습니다.',
    noCalendar: '달력 데이터가 없습니다.',
    calendarLoadError: '달력을 불러오지 못했습니다.',
    peopleUnit: '명',
    reviewEmpty: '상품, 날짜, 시간이 선택되면 예약 요약이 표시됩니다.',
    reviewPrice: '예상 금액',
    reviewProduct: '상품',
    reviewDate: '날짜',
    reviewTime: '시간',
    reviewPeople: '인원',
    reviewCountries: '촬영 국가',
    reviewOptions: '추가 옵션',
    reviewSurvey: '원하는 분위기',
    reviewLocation: '촬영 장소',
    reviewBusiness: '행사 상세',
    reviewBusinessPackage: '행사 패키지',
    reviewMemo: '요청사항',
    reviewMarketing: '마케팅 동의',
    countryRequired: '촬영 국가를 최소 1개 선택해 주세요.',
    locationRequired: '희망 촬영 장소를 입력해 주세요.',
    consentRequired: '필수 동의 항목을 체크해 주세요.',
    slotLoadingForDate: '{date} 기준 예약 가능 시간을 불러오는 중입니다.',
    slotLoadedForDate: '{date} 기준 예약 가능 시간입니다.',
    slotFailForDate: '{date} 기준 예약 가능 시간 조회에 실패했습니다.',
    initFail: '초기화 실패',
    yes: '동의',
    no: '미동의'
  },
  en: {
    heroTitle: 'Book Your Session',
    hero: 'Choose your shoot type and schedule, then enter your booking details.',
    loadingCopy: 'Preparing the booking page.',
    step1Title: '1. Choose Category',
    step2Title: '2. Choose Package',
    step3Title: '3. Select Date & Time',
    step4Title: '4. Select Time',
    step5Title: '4. Booking Details',
    groupHelp: 'Choose the main category first.',
    initSuccess: 'Please choose your shoot type.',
    loadCalendar: 'Loading the calendar.',
    calendarLoaded: 'Please review the available dates.',
    calendarFail: 'Calendar request failed',
    slotHintEmpty: 'Select a date to see available time slots.',
    noSlots: 'No available time slots.',
    invalidForm: 'Name, phone, and email are required.',
    submitDone: 'Your booking request was submitted successfully.',
    submitCardTitle: 'Your booking request has been received.',
    submitCardCopy: 'A confirmation email has been sent. We will follow up after reviewing the request.',
    submitCardName: 'Name',
    submitCardEmail: 'Email',
    submitCardDateTime: 'Booking time',
    submitCardProduct: 'Package',
    submitCardPrice: 'Estimated price',
    submitCardNote: 'If you do not see the email, please check your spam folder as well.',
    submitCardReturn: 'This booking was received as an eligible return-customer reservation.',
    submitCardAction: 'Start another booking',
    submitFail: 'Booking submission failed',
    productHelp: 'Choose a package to see the description and available schedule.',
    formHelp: 'Enter the basic booking details and submit.',
    generalTitle: 'Additional Settings',
    generalCopy: 'Changing people or options recalculates the estimated price.',
    passportTitle: 'Passport / Visa options',
    passportCopy: 'Choose the target country and we will include additional country charges.',
    passportHint: 'One country is included. Each additional country adds €5.',
    passportPeopleLabel: 'People',
    generalPeopleLabel: 'People',
    ageFieldLabel: 'Age Group',
    babyTypeFieldLabel: 'Session Type',
    reshootingTitle: 'Reshooting Consent',
    passAddonTitle: 'Passport Add-on',
    passAddonCopy: 'Add passport photos together with profile/studio.',
    passAddonPeopleLabel: 'Passport People',
    locationLabel: 'Preferred Location',
    businessLabel: 'Event Details',
    bizModeLabel: 'Session Type',
    bizHoursLabel: 'Coverage',
    bizEditLabel: 'Video Edit',
    bizAddonLabel: 'Optional Requests',
    bizAddonHelp: 'Optional requests are reviewed after booking and may require an extra quote.',
    surveyFieldLabel: 'Preferred Mood',
    bgFieldLabel: 'Background Selection',
    nameLabel: 'Name',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    addressLabel: 'Address (optional, for invoice)',
    babyNameLabel: 'Baby Name',
    otherCountryLabel: 'Other Country',
    memoLabel: 'Notes',
    consentTitle: 'Consent',
    consentCopy: 'Required items must be checked before submitting.',
    selectAllLabel: '[Optional] Select all required items',
    gdprLabel: '[Required] I agree to the collection and use of personal data.',
    gdprSub: 'I agree to the minimum data processing needed to confirm the booking and deliver the final images.',
    aiLabel: '[Required] I agree to the AI retouching and processing notice.',
    aiSub: 'AI-based tools may be used as supporting tools during the retouching and delivery workflow.',
    marketingLabel: '[Optional] I agree to marketing/SNS/portfolio usage.',
    marketingSub: 'I agree that the final images may be used on Studio mean website and social media for promotion.',
    submitLabel: 'Submit Booking',
    submitLoading: 'Submitting...',
    calendarPrompt: 'Choose a package first.',
    calendarLoadedHint: 'Choose an available date.',
    monthPrev: 'Previous month',
    monthNext: 'Next month',
    slotPanelTitle: 'Available Times',
    selectProductDetailEmpty: 'Select a package to see the description and estimated price.',
    selectCategoryEmpty: 'Please choose a category first.',
    noOptions: 'No additional options available.',
    noCalendar: 'No calendar data available.',
    calendarLoadError: 'Unable to load the calendar.',
    peopleUnit: ' person',
    reviewEmpty: 'A booking summary appears here after you choose product, date, and time.',
    reviewPrice: 'Estimated price',
    reviewProduct: 'Product',
    reviewDate: 'Date',
    reviewTime: 'Time',
    reviewPeople: 'People',
    reviewCountries: 'Country',
    reviewOptions: 'Add-ons',
    reviewSurvey: 'Preferred mood',
    reviewLocation: 'Location',
    reviewBusiness: 'Event details',
    reviewBusinessPackage: 'Event package',
    reviewMemo: 'Notes',
    reviewMarketing: 'Marketing',
    countryRequired: 'Please choose at least one country.',
    locationRequired: 'Please enter your preferred shooting location.',
    consentRequired: 'Please check the required consent items.',
    slotLoadingForDate: 'Loading available times for {date}.',
    slotLoadedForDate: 'Available times for {date}.',
    slotFailForDate: 'Failed to load available times for {date}.',
    initFail: 'Initialization failed',
    yes: 'Agreed',
    no: 'Not agreed'
  },
  de: {
    heroTitle: 'Termin buchen',
    hero: 'Wählen Sie zuerst die gewünschte Aufnahmeart und den Termin, danach geben Sie Ihre Buchungsdaten ein.',
    loadingCopy: 'Buchungsseite wird vorbereitet.',
    step1Title: '1. Hauptkategorie wählen',
    step2Title: '2. Paket wählen',
    step3Title: '3. Datum & Uhrzeit wählen',
    step4Title: '4. Uhrzeit wählen',
    step5Title: '4. Buchungsdaten',
    groupHelp: 'Wählen Sie zuerst die Hauptkategorie.',
    initSuccess: 'Bitte wählen Sie die gewünschte Aufnahmeart.',
    loadCalendar: 'Kalender wird geladen.',
    calendarLoaded: 'Bitte prüfen Sie die verfügbaren Termine.',
    calendarFail: 'Kalenderabfrage fehlgeschlagen',
    slotHintEmpty: 'Wählen Sie ein Datum, um verfügbare Zeiten zu sehen.',
    noSlots: 'Keine verfügbaren Termine.',
    invalidForm: 'Name, Telefon und E-Mail sind erforderlich.',
    submitDone: 'Ihre Buchungsanfrage wurde erfolgreich übermittelt.',
    submitCardTitle: 'Ihre Buchungsanfrage ist eingegangen.',
    submitCardCopy: 'Eine Bestätigungs-E-Mail wurde gesendet. Nach Prüfung melden wir uns bei Ihnen.',
    submitCardName: 'Name',
    submitCardEmail: 'E-Mail',
    submitCardDateTime: 'Termin',
    submitCardProduct: 'Paket',
    submitCardPrice: 'Geschätzter Preis',
    submitCardNote: 'Falls keine E-Mail sichtbar ist, prüfen Sie bitte auch den Spam-Ordner.',
    submitCardReturn: 'Diese Buchung wurde als berechtigte Stammkunden-Reservierung erfasst.',
    submitCardAction: 'Neue Buchung starten',
    submitFail: 'Buchung fehlgeschlagen',
    productHelp: 'Wählen Sie ein Paket, um Beschreibung und verfügbare Termine zu sehen.',
    formHelp: 'Geben Sie die Basisdaten ein und senden Sie die Anfrage ab.',
    generalTitle: 'Zusätzliche Einstellungen',
    generalCopy: 'Bei Änderung von Personen oder Optionen wird der geschätzte Preis neu berechnet.',
    passportTitle: 'Pass / Visum Optionen',
    passportCopy: 'Wählen Sie das Zielland. Zusätzliche Länder werden im Preis berücksichtigt.',
    passportHint: 'Ein Land ist inklusive. Jedes weitere Land kostet €5 extra.',
    passportPeopleLabel: 'Personen',
    generalPeopleLabel: 'Personen',
    ageFieldLabel: 'Altersgruppe',
    babyTypeFieldLabel: 'Aufnahmetyp',
    reshootingTitle: 'Einwilligung zum Nachshooting',
    passAddonTitle: 'Passfoto Zusatz',
    passAddonCopy: 'Passfotos zusammen mit Profil/Studio hinzufügen.',
    passAddonPeopleLabel: 'Passfoto Personen',
    locationLabel: 'Gewünschter Aufnahmeort',
    businessLabel: 'Eventdetails',
    bizModeLabel: 'Aufnahmetyp',
    bizHoursLabel: 'Stunden',
    bizEditLabel: 'Videoschnitt',
    bizAddonLabel: 'Zusatzanfragen',
    bizAddonHelp: 'Zusatzwünsche werden nach der Buchung geprüft und ggf. separat angeboten.',
    surveyFieldLabel: 'Gewünschte Stimmung',
    bgFieldLabel: 'Hintergrundauswahl',
    nameLabel: 'Name',
    phoneLabel: 'Telefon',
    emailLabel: 'E-Mail',
    addressLabel: 'Adresse (optional, für Rechnung)',
    babyNameLabel: 'Babyname',
    otherCountryLabel: 'Anderes Land',
    memoLabel: 'Hinweise',
    consentTitle: 'Einwilligung',
    consentCopy: 'Pflichtangaben müssen vor dem Absenden bestätigt werden.',
    selectAllLabel: '[Optional] Alle Pflichtfelder auswählen',
    gdprLabel: '[Pflicht] Ich stimme der Erhebung und Nutzung personenbezogener Daten zu.',
    gdprSub: 'Ich stimme der minimalen Datenverarbeitung zu, die für Buchungsbestätigung und Bildübergabe erforderlich ist.',
    aiLabel: '[Pflicht] Ich stimme dem Hinweis zur KI-Bearbeitung zu.',
    aiSub: 'KI-basierte Werkzeuge können unterstützend bei Retusche und Auslieferung eingesetzt werden.',
    marketingLabel: '[Optional] Ich stimme Marketing/SNS/Portfolio-Nutzung zu.',
    marketingSub: 'Ich bin einverstanden, dass die Ergebnisse zu Werbezwecken auf der Website und in sozialen Medien von Studio mean genutzt werden dürfen.',
    submitLabel: 'Buchung senden',
    submitLoading: 'Wird gesendet...',
    calendarPrompt: 'Bitte zuerst ein Paket wählen.',
    calendarLoadedHint: 'Bitte wählen Sie ein verfügbares Datum.',
    monthPrev: 'Vorheriger Monat',
    monthNext: 'Nächster Monat',
    slotPanelTitle: 'Verfügbare Zeiten',
    selectProductDetailEmpty: 'Wählen Sie ein Paket, um Beschreibung und geschätzten Preis zu sehen.',
    selectCategoryEmpty: 'Bitte zuerst eine Kategorie wählen.',
    noOptions: 'Keine zusätzlichen Optionen verfügbar.',
    noCalendar: 'Keine Kalenderdaten vorhanden.',
    calendarLoadError: 'Kalender konnte nicht geladen werden.',
    peopleUnit: ' Person',
    reviewEmpty: 'Hier erscheint eine Zusammenfassung, sobald Produkt, Datum und Uhrzeit gewählt wurden.',
    reviewPrice: 'Geschätzter Preis',
    reviewProduct: 'Produkt',
    reviewDate: 'Datum',
    reviewTime: 'Uhrzeit',
    reviewPeople: 'Personen',
    reviewCountries: 'Land',
    reviewOptions: 'Optionen',
    reviewSurvey: 'Stimmung',
    reviewLocation: 'Aufnahmeort',
    reviewBusiness: 'Eventdetails',
    reviewBusinessPackage: 'Event-Paket',
    reviewMemo: 'Hinweise',
    reviewMarketing: 'Marketing',
    countryRequired: 'Bitte wählen Sie mindestens ein Land aus.',
    locationRequired: 'Bitte geben Sie den gewünschten Aufnahmeort ein.',
    consentRequired: 'Bitte bestätigen Sie die Pflicht-Einwilligungen.',
    slotLoadingForDate: 'Verfügbare Zeiten für {date} werden geladen.',
    slotLoadedForDate: 'Verfügbare Zeiten für {date}.',
    slotFailForDate: 'Verfügbare Zeiten für {date} konnten nicht geladen werden.',
    initFail: 'Initialisierung fehlgeschlagen',
    yes: 'Zustimmung',
    no: 'Keine Zustimmung'
  }
};

const state = {
  init: null,
  lang: 'ko',
  selectedGroup: '',
  selectedProduct: null,
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  selectedDate: '',
  selectedSlot: '',
  selectedCountries: [],
  optionKeys: [],
  surveyKeys: [],
  ageGroup: 'adult',
  babyType: 'baekil',
  bgColors: [],
  businessMode: 'photo',
  businessHours: '2',
  businessVideoEdit: 'raw',
  businessAddonKeys: [],
  activeStep: 1,
  returnEligible: false,
  returnNoticeTimer: null,
  returnNoticeToken: 0,
  quoteToken: 0,
  calendarRequestToken: 0,
  slotRequestToken: 0,
  quote: null,
  calendarCache: new Map(),
  slotCache: new Map()
};

const els = {
  shell: document.querySelector('.shell'),
  hero: document.querySelector('.hero'),
  heroTitle: document.getElementById('heroTitle'),
  banner: document.getElementById('statusBanner'),
  heroLead: document.getElementById('heroLead'),
  loadingCopy: document.getElementById('loadingCopy'),
  groupHelp: document.getElementById('groupHelp'),
  groupGrid: document.getElementById('groupGrid'),
  productHelp: document.getElementById('productHelp'),
  productGrid: document.getElementById('productGrid'),
  productDetail: document.getElementById('productDetail'),
  passportPanel: document.getElementById('passportPanel'),
  passportCountries: document.getElementById('passportCountries'),
  passportPeople: document.getElementById('passportPeople'),
  passportHint: document.getElementById('passportHint'),
  generalPanel: document.getElementById('generalPanel'),
  ageField: document.getElementById('ageField'),
  ageGrid: document.getElementById('ageGrid'),
  seniorWarning: document.getElementById('seniorWarning'),
  babyTypeField: document.getElementById('babyTypeField'),
  babyTypeGrid: document.getElementById('babyTypeGrid'),
  reshootingField: document.getElementById('reshootingField'),
  reshootingConsent: document.getElementById('reshootingConsent'),
  reshootingText: document.getElementById('reshootingText'),
  peopleField: document.getElementById('peopleField'),
  generalPeople: document.getElementById('generalPeople'),
  optionGrid: document.getElementById('optionGrid'),
  passAddonField: document.getElementById('passAddonField'),
  passAddonToggle: document.getElementById('passAddonToggle'),
  passAddonPeopleField: document.getElementById('passAddonPeopleField'),
  passAddonPeople: document.getElementById('passAddonPeople'),
  passAddonPriceTag: document.getElementById('passAddonPriceTag'),
  bgField: document.getElementById('bgField'),
  bgHelp: document.getElementById('bgHelp'),
  bgGrid: document.getElementById('bgGrid'),
  bgRecList: document.getElementById('bgRecList'),
  calendarHint: document.getElementById('calendarHint'),
  monthLabel: document.getElementById('monthLabel'),
  calendarWeekdays: document.getElementById('calendarWeekdays'),
  calendarGrid: document.getElementById('calendarGrid'),
  slotPanelTitle: document.getElementById('slotPanelTitle'),
  slotHint: document.getElementById('slotHint'),
  slotGrid: document.getElementById('slotGrid'),
  reviewBox: document.getElementById('reviewBox'),
  formHelp: document.getElementById('formHelp'),
  form: document.getElementById('bookingForm'),
  otherCountryField: document.getElementById('otherCountryField'),
  locationField: document.getElementById('locationField'),
  locationInfo: document.getElementById('locationInfo'),
  locationInput: document.getElementById('locationInput'),
  businessField: document.getElementById('businessField'),
  bizMode: document.getElementById('bizMode'),
  bizHours: document.getElementById('bizHours'),
  bizEdit: document.getElementById('bizEdit'),
  bizEditField: document.getElementById('bizEditField'),
  bizAddonGrid: document.getElementById('bizAddonGrid'),
  bizAddonHelp: document.getElementById('bizAddonHelp'),
  businessInput: document.getElementById('businessInput'),
  surveyField: document.getElementById('surveyField'),
  surveyGrid: document.getElementById('surveyGrid'),
  babyNameField: document.getElementById('babyNameField'),
  submitBtn: document.getElementById('submitBtn'),
  resultBox: document.getElementById('resultBox'),
  successPanel: document.getElementById('successPanel'),
  loadingScreen: document.getElementById('loadingScreen'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn'),
  langButtons: Array.from(document.querySelectorAll('.lang-btn')),
  wizardButtons: {
    step1Next: document.getElementById('step1NextBtn'),
    step2Back: document.getElementById('step2BackBtn'),
    step2Next: document.getElementById('step2NextBtn'),
    step3Back: document.getElementById('step3BackBtn'),
    step3Next: document.getElementById('step3NextBtn'),
    step5Back: document.getElementById('step5BackBtn')
  },
  stepPanels: {
    step1: document.getElementById('stepPanel1'),
    step2: document.getElementById('stepPanel2'),
    step3: document.getElementById('stepPanel3'),
    step5: document.getElementById('stepPanel5')
  }
};

boot();

async function boot() {
  wireEvents();
  applyCopy();
  try {
    const initData = await fetchInitData();
    state.init = initData;
    renderGroups();
    renderProducts([]);
    renderPassportCountries();
    renderSurveyChips();
    renderProductDetail();
    renderReview();
    syncStepPanels();
    setBanner(getCopy().initSuccess, 'success');
  } catch (error) {
    console.error(error);
    setBanner(`${getCopy().initFail}: ${error.message}`, 'error');
  } finally {
    hideLoadingScreen();
  }
}

function hideLoadingScreen() {
  if (!els.loadingScreen) return;
  window.setTimeout(() => {
    els.loadingScreen.classList.add('is-hidden');
  }, 180);
}

function wireEvents() {
  els.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
  els.nextMonthBtn.addEventListener('click', () => changeMonth(1));
  els.form.addEventListener('submit', onSubmit);
  els.wizardButtons.step1Next?.addEventListener('click', () => {
    if (!state.selectedGroup) {
      setBanner(
        state.lang === 'en'
          ? 'Please choose a shoot category first.'
          : state.lang === 'de'
            ? 'Bitte wählen Sie zuerst eine Aufnahmekategorie.'
            : '촬영 종류를 먼저 선택해 주세요.',
        'error'
      );
      return;
    }
    goToStep(2);
  });
  els.wizardButtons.step2Back?.addEventListener('click', () => goToStep(1));
  els.wizardButtons.step2Next?.addEventListener('click', async () => {
    if (!state.selectedProduct) {
      setBanner(
        state.lang === 'en'
          ? 'Please choose a package first.'
          : state.lang === 'de'
            ? 'Bitte wählen Sie zuerst ein Paket.'
            : '세부 상품을 먼저 선택해 주세요.',
        'error'
      );
      return;
    }
    if (state.selectedProduct.g === 'pass' && !state.selectedCountries.length) {
      setBanner(getCopy().countryRequired, 'error');
      return;
    }
    if (state.selectedProduct.g === 'pass' && state.selectedCountries.includes('OTHER') && !String(els.form.elements.otherCountry?.value || '').trim()) {
      setBanner(
        state.lang === 'en'
          ? 'Please enter the other country name.'
          : state.lang === 'de'
            ? 'Bitte geben Sie den Namen des anderen Landes ein.'
            : '기타 국가명을 입력해 주세요.',
        'error'
      );
      return;
    }
    if ((state.selectedProduct.g === 'snap' || state.selectedProduct.g === 'wed') && !String(els.locationInput?.value || '').trim()) {
      setBanner(getCopy().locationRequired, 'error');
      return;
    }
    if (getMaxUnlockedStep() < 3) return;
    goToStep(3);
    await refreshQuote();
    els.calendarHint.textContent = `${getProductLabel(state.selectedProduct)} · ${getCopy().calendarLoadedHint}`;
    setBanner(getCopy().loadCalendar, 'loading');
    await loadCalendar();
  });
  els.wizardButtons.step3Back?.addEventListener('click', () => goToStep(2));
  els.wizardButtons.step3Next?.addEventListener('click', () => {
    if (!state.selectedDate) {
      setBanner(
        state.lang === 'en'
          ? 'Please choose a date first.'
          : state.lang === 'de'
            ? 'Bitte wählen Sie zuerst ein Datum.'
            : '날짜를 먼저 선택해 주세요.',
        'error'
      );
      return;
    }
    if (!state.selectedSlot) {
      setBanner(
        state.lang === 'en'
          ? 'Please choose an available time first.'
          : state.lang === 'de'
            ? 'Bitte wählen Sie zuerst eine verfügbare Uhrzeit.'
            : '예약 가능한 시간을 먼저 선택해 주세요.',
        'error'
      );
      return;
    }
    goToStep(5);
  });
  els.wizardButtons.step5Back?.addEventListener('click', () => goToStep(3));
  els.form.elements.otherCountry?.addEventListener('input', async () => {
    await handleQuoteInputChange();
    refreshStepLocks();
  });
  els.form.elements.marketing?.addEventListener('change', handleMarketingChange);
  els.form.elements.gdprConsent?.addEventListener('change', () => { syncSelectAllRequired(); refreshStepLocks(); });
  els.form.elements.aiConsent?.addEventListener('change', () => { syncSelectAllRequired(); refreshStepLocks(); });
  els.form.elements.name?.addEventListener('input', () => { renderReturnNotice(); refreshStepLocks(); });
  els.form.elements.phone?.addEventListener('input', () => { renderReturnNotice(); refreshStepLocks(); });
  els.form.elements.email?.addEventListener('input', () => { renderReturnNotice(); refreshStepLocks(); });
  els.form.elements.address?.addEventListener('input', refreshStepLocks);
  els.form.elements.babyName?.addEventListener('input', () => { renderReview(); refreshStepLocks(); });
  els.reshootingConsent?.addEventListener('change', refreshStepLocks);
  document.getElementById('selectAllRequired')?.addEventListener('change', (event) => { toggleAllRequired(event); refreshStepLocks(); });
  els.locationInput?.addEventListener('input', () => { renderReview(); refreshStepLocks(); });
  els.businessInput?.addEventListener('input', () => { renderReview(); refreshStepLocks(); });
  els.bizMode?.addEventListener('change', async () => {
    state.businessMode = els.bizMode.value || 'photo';
    if (state.businessMode !== 'video') state.businessVideoEdit = 'raw';
    renderBusinessOptions();
    await handleQuoteInputChange();
    refreshStepLocks();
  });
  els.bizHours?.addEventListener('change', async () => {
    state.businessHours = els.bizHours.value || '2';
    await handleQuoteInputChange();
    refreshStepLocks();
  });
  els.bizEdit?.addEventListener('change', async () => {
    state.businessVideoEdit = els.bizEdit.value || 'raw';
    await handleQuoteInputChange();
    refreshStepLocks();
  });
  els.form.elements.memo?.addEventListener('input', () => { renderReview(); refreshStepLocks(); });
  els.passportPeople.addEventListener('change', () => {
    handleQuoteInputChange();
  });
  els.generalPeople.addEventListener('change', handleQuoteInputChange);
  els.passAddonToggle?.addEventListener('change', () => {
    els.passAddonPeopleField?.classList.toggle('hidden-field', !els.passAddonToggle.checked);
    handleQuoteInputChange();
  });
  els.passAddonPeople?.addEventListener('change', handleQuoteInputChange);
  els.langButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.lang = button.dataset.lang;
      els.langButtons.forEach((item) => item.classList.toggle('active', item === button));
      applyCopy();
      renderGroups();
      renderProducts((state.init?.products || []).filter((item) => !state.selectedGroup || item.g === state.selectedGroup));
      renderPassportCountries();
      renderSurveyChips();
      renderGeneralPanel();
      renderProductDetail();
      renderReview();
      refreshStepLocks();
      if (state.selectedProduct) {
        els.calendarHint.textContent = `${getProductLabel(state.selectedProduct)} · ${getCopy().calendarLoadedHint}`;
      }
    });
  });
}

function getCopy() {
  return COPY[state.lang] || COPY.ko;
}

function fillCopy(template, vars = {}) {
  return Object.entries(vars).reduce((acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)), template);
}

function formatDateLabel(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return String(dateKey || '');
  const date = new Date(year, month - 1, day);
  if (state.lang === 'en') {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }
  if (state.lang === 'de') {
    return new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function applyCopy() {
  const copy = getCopy();
  if (els.heroTitle) els.heroTitle.textContent = copy.heroTitle;
  els.heroLead.textContent = copy.hero;
  if (els.loadingCopy) els.loadingCopy.textContent = copy.loadingCopy;
  setText('step1Title', copy.step1Title);
  setText('step2Title', copy.step2Title);
  setText('step3Title', copy.step3Title);
  setText('step4Title', copy.step4Title);
  setText('step5Title', copy.step5Title);
  if (els.groupHelp) els.groupHelp.textContent = copy.groupHelp;
  els.productHelp.textContent = copy.productHelp;
  els.formHelp.textContent = copy.formHelp;
  setText('generalTitle', copy.generalTitle);
  setText('generalCopy', copy.generalCopy);
  setText('passportTitle', copy.passportTitle);
  setText('passportPeopleLabel', copy.passportPeopleLabel);
  setText('generalPeopleLabel', copy.generalPeopleLabel);
  setText('ageFieldLabel', copy.ageFieldLabel);
  setText('babyTypeFieldLabel', copy.babyTypeFieldLabel);
  setText('reshootingTitle', copy.reshootingTitle);
  setText('passAddonTitle', copy.passAddonTitle);
  setText('passAddonCopy', copy.passAddonCopy);
  setText('passAddonPeopleLabel', copy.passAddonPeopleLabel);
  setText('locationLabel', copy.locationLabel);
  setText('businessLabel', copy.businessLabel);
  setText('surveyFieldLabel', copy.surveyFieldLabel);
  setText('bgFieldLabel', copy.bgFieldLabel);
  setText('nameLabel', copy.nameLabel);
  setText('phoneLabel', copy.phoneLabel);
  setText('emailLabel', copy.emailLabel);
  setText('addressLabel', copy.addressLabel);
  setText('babyNameLabel', copy.babyNameLabel);
  setText('otherCountryLabel', copy.otherCountryLabel);
  setText('memoLabel', copy.memoLabel);
  setText('consentTitle', copy.consentTitle);
  setText('consentCopy', copy.consentCopy);
  setText('selectAllLabel', copy.selectAllLabel);
  setText('gdprLabel', copy.gdprLabel);
  setText('gdprSub', copy.gdprSub);
  setText('aiLabel', copy.aiLabel);
  setText('aiSub', copy.aiSub);
  setText('marketingLabel', copy.marketingLabel);
  setText('marketingSub', copy.marketingSub);
  els.passportHint.textContent = copy.passportHint;
  els.prevMonthBtn.textContent = copy.monthPrev;
  els.nextMonthBtn.textContent = copy.monthNext;
  els.monthLabel.textContent = formatMonthLabel(state.calendarYear, state.calendarMonth, state.lang);
  if (els.slotPanelTitle) els.slotPanelTitle.textContent = copy.slotPanelTitle;
  els.submitBtn.textContent = copy.submitLabel;
  const prevLabel = state.lang === 'en' ? 'Back' : state.lang === 'de' ? 'Zurück' : '이전';
  const nextLabel = state.lang === 'en' ? 'Next' : state.lang === 'de' ? 'Weiter' : '다음';
  setText('step1NextBtn', nextLabel);
  setText('step2BackBtn', prevLabel);
  setText('step2NextBtn', nextLabel);
  setText('step3BackBtn', prevLabel);
  setText('step3NextBtn', nextLabel);
  setText('step5BackBtn', prevLabel);
  if (state.selectedDate) {
    const template = state.selectedSlot ? copy.slotLoadedForDate : copy.slotLoadingForDate;
    els.slotHint.textContent = fillCopy(template, { date: formatDateLabel(state.selectedDate) });
  } else {
    els.slotHint.textContent = copy.slotHintEmpty;
  }
  if (!state.selectedProduct && !els.reviewBox.querySelector('.review-list')) {
    els.reviewBox.textContent = copy.reviewEmpty;
  }
  if (!state.selectedProduct) els.calendarHint.textContent = copy.calendarPrompt;
  if (els.locationInfo) {
    els.locationInfo.textContent = state.lang === 'en'
      ? 'Shoots within 50 km of Frankfurt are included in the base price. Additional travel costs may apply outside this area.'
      : state.lang === 'de'
        ? 'Aufnahmen im Umkreis von 50 km um Frankfurt sind im Grundpreis enthalten. Außerhalb dieses Radius können zusätzliche Fahrtkosten anfallen.'
        : '프랑크푸르트 기준 50km 이내 촬영은 기본 비용에 포함됩니다. 이외 지역은 왕복 유류비가 추가될 수 있습니다.';
  }
  if (els.reshootingText) {
    els.reshootingText.textContent = state.lang === 'en'
      ? 'Reshooting Policy (Required) — If the child cannot continue due to shyness or condition issues, a reshoot may be arranged within 4 weeks at 30% of the original shoot fee.'
      : state.lang === 'de'
        ? 'Nachshooting-Einwilligung (Pflicht) — Wenn das Kind am Drehtag wegen Schüchternheit oder Verfassung nicht normal mitmachen kann, kann innerhalb von 4 Wochen ein Nachshooting für 30% des Ursprungspreises vereinbart werden.'
        : '재촬영 약관 동의 (필수) — 촬영 당일 아이의 낯가림이나 컨디션 난조로 정상 진행이 어려울 경우, 원 촬영 비용의 30%를 추가 지불하고 4주 이내 재촬영 일정을 잡을 수 있습니다.';
  }
  renderPeopleOptions();
  renderWeekdayHeader();
  renderReturnNotice();
  syncConsentVisibility();
  syncSelectAllRequired();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function toggleAllRequired(event) {
  const checked = !!event?.target?.checked;
  if (els.form.elements.gdprConsent) els.form.elements.gdprConsent.checked = checked;
  if (state.selectedGroup !== 'pass' && els.form.elements.aiConsent) els.form.elements.aiConsent.checked = checked;
  syncSelectAllRequired();
}

function syncSelectAllRequired() {
  const el = document.getElementById('selectAllRequired');
  if (!el) return;
  const gdpr = !!els.form.elements.gdprConsent?.checked;
  const ai = state.selectedGroup === 'pass' ? true : !!els.form.elements.aiConsent?.checked;
  el.checked = gdpr && ai;
}

function syncConsentVisibility() {
  const isPass = state.selectedGroup === 'pass' || state.selectedProduct?.g === 'pass';
  const consentBox = document.getElementById('consentBox');
  const marketingRow = document.getElementById('marketingRow');
  const aiRow = document.getElementById('aiRow');
  const selectAllRow = document.getElementById('selectAllRow');
  if (consentBox) consentBox.classList.toggle('pass-mode', isPass);
  const toggleRow = (row, hidden) => {
    if (!row) return;
    row.classList.toggle('hidden-field', hidden);
    row.hidden = hidden;
    row.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    row.style.display = hidden ? 'none' : '';
    row.querySelectorAll('input').forEach((input) => {
      input.disabled = hidden;
    });
  };
  toggleRow(marketingRow, isPass);
  toggleRow(aiRow, isPass);
  toggleRow(selectAllRow, isPass);
  if (isPass) {
    if (els.form.elements.marketing) els.form.elements.marketing.checked = false;
    if (els.form.elements.aiConsent) els.form.elements.aiConsent.checked = false;
    const selectAll = document.getElementById('selectAllRequired');
    if (selectAll) selectAll.checked = false;
  }
  syncSelectAllRequired();
}

function renderReturnNotice() {
  const box = document.getElementById('returnNotice');
  if (!box) return;
  const name = String(els.form.elements.name?.value || '').trim();
  const phone = String(els.form.elements.phone?.value || '').trim();
  const email = String(els.form.elements.email?.value || '').trim();
  const show = !!(name && phone && email);
  box.classList.toggle('hidden-field', !show);
  if (!show) {
    box.textContent = '';
    state.returnEligible = false;
    if (state.returnNoticeTimer) clearTimeout(state.returnNoticeTimer);
    return;
  }
  box.textContent = state.lang === 'en'
    ? 'Checking return-customer eligibility...'
    : state.lang === 'de'
      ? 'Prüfe Stammkundenberechtigung...'
      : '재방문 할인 대상 여부를 확인하는 중입니다...';
  if (state.returnNoticeTimer) clearTimeout(state.returnNoticeTimer);
  const token = ++state.returnNoticeToken;
  state.returnNoticeTimer = setTimeout(async () => {
    try {
      const result = await fetchReturnEligibility({ name, phone, email });
      if (token !== state.returnNoticeToken) return;
      const nextEligible = !!result?.eligible;
      const changed = state.returnEligible !== nextEligible;
      state.returnEligible = nextEligible;
      if (!state.returnEligible) {
        box.classList.add('hidden-field');
        box.textContent = '';
        if (changed && state.selectedProduct) await refreshQuote();
        return;
      }
      box.classList.remove('hidden-field');
      box.textContent = state.lang === 'en'
        ? 'Return-customer discount is available if you are rebooking after finishing today’s shoot.'
        : state.lang === 'de'
          ? 'Der Stammkundenrabatt ist verfügbar, wenn Sie nach dem heutigen Shooting erneut buchen.'
          : '오늘 촬영을 마친 뒤 같은 날 재예약하는 경우, 재방문 할인이 자동 적용됩니다.';
      if (changed && state.selectedProduct) await refreshQuote();
    } catch (error) {
      if (token !== state.returnNoticeToken) return;
      const changed = state.returnEligible;
      state.returnEligible = false;
      box.classList.add('hidden-field');
      box.textContent = '';
      if (changed && state.selectedProduct) await refreshQuote();
    }
  }, 350);
}

function renderGroups() {
  const groups = Object.keys(GROUP_META);
  els.groupGrid.innerHTML = groups.map((groupKey) => {
    const meta = GROUP_META[groupKey];
    const label = meta.label[state.lang] || meta.label.ko;
    const sub = state.lang === 'en'
      ? 'Choose category'
      : state.lang === 'de'
        ? 'Kategorie wählen'
        : '카테고리 선택';
    const selected = state.selectedGroup === groupKey ? ' selected' : '';
    return `
      <button type="button" class="group-card${selected}" data-group="${escapeHtml(groupKey)}">
        <div class="group-card-icon">${meta.icon}</div>
        <div class="group-card-title">${escapeHtml(label)}</div>
        <div class="group-card-sub">${escapeHtml(sub)}</div>
      </button>
    `;
  }).join('');
  els.groupGrid.querySelectorAll('[data-group]').forEach((button) => {
    button.addEventListener('click', () => selectGroup(button.dataset.group));
  });
}

function renderWeekdayHeader() {
  const labels = state.lang === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : state.lang === 'de'
      ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
      : ['일', '월', '화', '수', '목', '금', '토'];
  els.calendarWeekdays.innerHTML = labels.map((label) => `<div class="calendar-weekday">${escapeHtml(label)}</div>`).join('');
}

function syncStepPanels() {
  const maxStep = getMaxUnlockedStep();
  if (state.activeStep > maxStep) state.activeStep = maxStep;
  Object.entries(els.stepPanels).forEach(([key, panel]) => {
    const step = Number(key.replace('step', ''));
    if (!panel) return;
    panel.classList.toggle('hidden-step', step !== state.activeStep || step > maxStep);
  });
  updateWizardButtons(maxStep);
}

function refreshStepLocks() {
  syncStepPanels();
  updateSubmitState();
}

function getMaxUnlockedStep() {
  const hasGroup = !!state.selectedGroup;
  const hasProduct = !!state.selectedProduct;
  const isPass = state.selectedProduct?.g === 'pass';
  const hasRequiredStep2 = !hasProduct ? false : (
    (isPass
      ? state.selectedCountries.length > 0 && (!state.selectedCountries.includes('OTHER') || !!String(els.form.elements.otherCountry?.value || '').trim())
      : !((state.selectedProduct?.g === 'snap' || state.selectedProduct?.g === 'wed') && !String(els.locationInput?.value || '').trim()))
  );
  const hasDate = !!state.selectedDate;
  const hasSlot = !!state.selectedSlot;
  if (!hasGroup) return 1;
  if (!hasProduct) return 2;
  if (!hasRequiredStep2) return 2;
  if (!hasDate || !hasSlot) return 3;
  return 5;
}

function goToStep(step) {
  const next = Math.max(1, Math.min(5, step));
  const maxStep = getMaxUnlockedStep();
  state.activeStep = Math.min(next, maxStep);
  syncStepPanels();
  els.stepPanels[`step${state.activeStep}`]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateWizardButtons(maxStep) {
  if (els.wizardButtons.step1Next) els.wizardButtons.step1Next.disabled = maxStep < 2;
  if (els.wizardButtons.step2Next) els.wizardButtons.step2Next.disabled = maxStep < 3;
  if (els.wizardButtons.step3Next) els.wizardButtons.step3Next.disabled = maxStep < 5;
}

function renderSurveyChips() {
  const surveyItems = SURVEY_META.filter((item) => {
    if (item.key !== 'baby') return true;
    return state.selectedProduct?.g === 'prof' || state.selectedProduct?.g === 'stud' || state.selectedProduct?.g === 'snap';
  });
  els.surveyGrid.innerHTML = surveyItems.map((item) => {
    const label = item.label[state.lang] || item.label.ko;
    const selected = state.surveyKeys.includes(item.key) ? ' selected' : '';
    return `<button type="button" class="survey-chip${selected}" data-survey="${item.key}">${item.icon} ${escapeHtml(label)}</button>`;
  }).join('');
  els.surveyGrid.querySelectorAll('[data-survey]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.survey;
      const index = state.surveyKeys.indexOf(key);
      if (index >= 0) state.surveyKeys.splice(index, 1);
      else state.surveyKeys.push(key);
      renderSurveyChips();
      renderReview();
      refreshStepLocks();
    });
  });
}

function renderAgeChips() {
  const isPb = state.selectedProduct?.id === 'pb';
  const isPbus = state.selectedProduct?.id === 'pbus';
  const isPp = state.selectedProduct?.id === 'pp';
  els.ageGrid.innerHTML = AGE_META.map((item) => {
    let label = item.label[state.lang] || item.label.ko;
    const disabled = isPb && item.key === 'baby';
    if (isPb && item.key === 'senior') {
      label += state.lang === 'en'
        ? ' · Weekday Free'
        : state.lang === 'de'
          ? ' · Werktags kostenlos'
          : ' · 평일 무료';
    } else if ((isPbus || isPp) && item.key === 'senior') {
      label += state.lang === 'en'
        ? ' · Weekday -€50'
        : state.lang === 'de'
          ? ' · Werktags -50€'
          : ' · 평일 -50€';
    }
    if (disabled) {
      label += state.lang === 'en'
        ? ' · Not available'
        : state.lang === 'de'
          ? ' · Nicht verfügbar'
          : ' · 선택 불가';
    }
    const selected = state.ageGroup === item.key ? ' subtle-selected' : '';
    return `<button type="button" class="survey-chip${selected}" data-age="${item.key}" ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`;
  }).join('');
  els.ageGrid.querySelectorAll('[data-age]').forEach((button) => {
    button.addEventListener('click', () => {
      state.ageGroup = button.dataset.age;
      if (state.ageGroup !== 'baby') state.babyType = 'baekil';
      renderAgeChips();
      renderBabyTypeChips();
      renderSeniorWarning();
      handleQuoteInputChange();
      refreshStepLocks();
    });
  });
  renderSeniorWarning();
}

function renderSeniorWarning() {
  if (!els.seniorWarning) return;
  const product = state.selectedProduct;
  const show = product?.id === 'pb' && state.ageGroup === 'senior' && !!state.selectedDate;
  if (!show) {
    els.seniorWarning.style.display = 'none';
    els.seniorWarning.textContent = '';
    return;
  }
  const d = new Date(`${state.selectedDate}T12:00:00`);
  const day = d.getDay();
  if (day >= 2 && day <= 5) {
    els.seniorWarning.style.display = 'none';
    els.seniorWarning.textContent = '';
    return;
  }
  els.seniorWarning.style.display = 'block';
  els.seniorWarning.textContent = state.lang === 'en'
    ? 'The senior solo profile free benefit is only available on weekdays (Tue-Fri). A regular rate applies for weekend bookings.'
    : state.lang === 'de'
      ? 'Das kostenlose Senior-Profil gilt nur an Wochentagen (Di-Fr). Für Wochenenden gilt der reguläre Preis.'
      : '시니어 단독 프로필 무료 혜택은 평일(화-금)에만 제공됩니다.\n주말로 예약하실 경우 정상가가 적용됩니다.';
}

function getPreviewQuote() {
  const item = state.selectedProduct;
  if (!item) return null;
  const people = getPeopleCount();
  const optionKeys = [...state.optionKeys];
  const passCountries = item.g === 'pass' ? state.selectedCountries.filter((code) => code !== 'OTHER') : [];
  const otherCountry = item.g === 'pass' ? String(els.form.elements.otherCountry?.value || '').trim() : '';
  const totalCountries = passCountries.length + (otherCountry ? 1 : 0);
  let total = Number(item.p || 0);

  if (item.g === 'biz') {
    const business = getBusinessSelection();
    return {
      itemId: item.id,
      itemGroup: item.g,
      itemType: item.t,
      people: 1,
      totalPrice: business.price,
      duration: business.duration,
      prep: Number(item.prep || 0),
      totalDuration: business.duration + Number(item.prep || 0),
      product: item,
      marketingDiscount: 0,
      passAddon: false,
      passAddonPeople: 0,
      passAddonDur: 0,
      passAddonPrice: 0,
      passCountries: [],
      otherCountry: '',
      totalCountries: 0,
      optionKeys: [],
      businessMode: business.mode,
      businessHours: business.hours,
      businessVideoEdit: business.edit,
      businessAddonKeys: [...state.businessAddonKeys],
      businessLabel: business.label
    };
  }

  if (item.t === 'passport') total = (total + Math.max(totalCountries - 1, 0) * 5) * people;
  else if (item.t === 'group' && people > 2) total += (people - 2) * 30;
  else if (item.t === 'snap' && people > 2) total += (people - 2) * 30;
  else if (item.t === 'snap' && people === 1) total -= 30;

  const optMeta = { dog: 15, bg: 20, outfit: 20 };
  optionKeys.forEach((key) => {
    if (optMeta[key]) total += optMeta[key];
  });

  const ageGroup = item.g === 'prof' ? state.ageGroup : 'adult';
  let seniorFree = false;
  let seniorDiscApplied = false;

  if (item.g === 'prof') {
    if (ageGroup === 'kids') total = Math.max(0, total - 10);
    else if (ageGroup === 'senior' && state.selectedDate) {
      const d = new Date(`${state.selectedDate}T12:00:00`);
      const day = d.getDay();
      if (item.id === 'pb') {
        if (day >= 2 && day <= 5) {
          seniorFree = true;
          total = 0;
        }
      } else if (item.id === 'pbus' || item.id === 'pp') {
        if (day >= 2 && day <= 5) {
          total = Math.max(0, total - 50);
          seniorDiscApplied = true;
        } else if (day === 6 && item.id === 'pp') {
          total = Math.max(0, total - 30);
          seniorDiscApplied = true;
        }
      }
    }
  }

  let marketingDiscount = 0;
  const marketing = els.form.elements.marketing?.checked || false;
  if (item.g === 'wed' && marketing) {
    marketingDiscount = 50;
    total -= 50;
  }
  let passAddonDur = 0;
  let passAddonPrice = 0;
  const passAddon = (item.g === 'prof' || item.g === 'stud') && !!els.passAddonToggle?.checked;
  const passAddonPeople = Number(els.passAddonPeople?.value || 1);
  if (passAddon) {
    const passItem = (state.init?.products || []).find((prod) => prod.g === 'pass');
    passAddonPrice = Number(passItem?.p || 0) * passAddonPeople;
    total += passAddonPrice;
    passAddonDur = ([0, 15, 20, 30, 40][Math.min(passAddonPeople, 4)] || 40);
  }

  const duration = item.t === 'passport'
    ? ([0, 15, 20, 30, 40][Math.min(people, 4)] || 40)
    : Number(item.d || 0);
  const prep = Number(item.prep || 0);
  return {
    itemId: item.id,
    itemGroup: item.g,
    itemType: item.t,
    people,
    totalPrice: Math.max(0, total),
    duration,
    prep,
    totalDuration: duration + prep + passAddonDur,
    product: item,
    marketingDiscount,
    passAddon,
    passAddonPeople,
    passAddonDur,
    passAddonPrice,
    passCountries,
    otherCountry,
    totalCountries,
    optionKeys
  };
}

function renderBabyTypeChips() {
  els.babyTypeGrid.innerHTML = BABY_TYPE_META.map((item) => {
    const label = item.label[state.lang] || item.label.ko;
    const selected = state.babyType === item.key ? ' subtle-selected' : '';
    return `<button type="button" class="survey-chip${selected}" data-baby-type="${item.key}">${escapeHtml(label)}</button>`;
  }).join('');
  els.babyTypeGrid.querySelectorAll('[data-baby-type]').forEach((button) => {
    button.addEventListener('click', () => {
      state.babyType = button.dataset.babyType;
      renderBabyTypeChips();
      renderReview();
      refreshStepLocks();
    });
  });
}

function getBgSelectionLimit(product) {
  if (!product || (product.g !== 'prof' && product.g !== 'stud')) return 0;
  const desc = `${product.descKo || ''}\n${product.descEn || ''}\n${product.descDe || ''}`;
  if (/제한 없음|Unlimited|unlimited|unbegrenzt/i.test(desc)) return -1;
  const match = desc.match(/(\d+)\s*(개|배경|background|backgrounds|Hintergrund|Hintergründe)/i);
  let limit = match ? (Number(match[1]) || 1) : 1;
  if (state.optionKeys.includes('bg')) limit += 1;
  return limit;
}

function renderBgChips() {
  const limit = getBgSelectionLimit(state.selectedProduct);
  if (limit === -1) {
    els.bgHelp.textContent = state.lang === 'en'
      ? 'This package supports unlimited background selections.'
      : state.lang === 'de'
        ? 'Dieses Paket unterstützt unbegrenzte Hintergrundauswahl.'
        : '이 상품은 배경 선택 개수 제한이 없습니다.';
  } else {
    els.bgHelp.textContent = state.lang === 'en'
      ? `You can select up to ${Math.max(limit, 1)} background${limit > 1 ? 's' : ''}.`
      : state.lang === 'de'
        ? `Sie können bis zu ${Math.max(limit, 1)} Hintergründe wählen.`
        : `이 상품은 최대 ${Math.max(limit, 1)}개의 배경을 선택할 수 있습니다.`;
  }
  els.bgGrid.innerHTML = BG_META.map((item) => {
    const label = item.label[state.lang] || item.label.ko;
    const selected = state.bgColors.includes(item.key) ? ' subtle-selected' : '';
    return `<button type="button" class="survey-chip${selected}" data-bg="${item.key}"><span class="bg-chip-preview" style="background:${item.color};${item.key==='black' ? 'border-color:#555;' : ''}"></span>${escapeHtml(label)}</button>`;
  }).join('');
  els.bgGrid.querySelectorAll('[data-bg]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.bg;
      const idx = state.bgColors.indexOf(key);
      if (idx >= 0) state.bgColors.splice(idx, 1);
      else if (limit === 1) state.bgColors = [key];
      else if (limit > 1 && state.bgColors.length >= limit) {
        setBanner(
          state.lang === 'en'
            ? `You can only choose ${limit} backgrounds for this package.`
            : state.lang === 'de'
              ? `Für dieses Paket können nur ${limit} Hintergründe gewählt werden.`
              : `이 상품은 배경을 ${limit}개까지만 선택할 수 있습니다.`,
          'error'
        );
        return;
      } else state.bgColors.push(key);
      renderBgChips();
      renderReview();
      refreshStepLocks();
    });
  });
  renderBgRecommendations();
}

function renderBgRecommendations() {
  if (!els.bgRecList) return;
  if (!state.bgColors.length) {
    els.bgRecList.innerHTML = '';
    return;
  }
  const titleBase = state.lang === 'en'
    ? 'Background'
    : state.lang === 'de'
      ? 'Hintergrund'
      : '배경';
  const outfitPrefix = state.lang === 'en'
    ? 'Recommended outfit'
    : state.lang === 'de'
      ? 'Empfohlenes Outfit'
      : '추천 의상';
  const guideLead = state.lang === 'en'
    ? 'Choosing clothes one tone lighter or darker than the background usually gives the cleanest result.'
    : state.lang === 'de'
      ? 'Kleidung in einem Ton heller oder dunkler als der Hintergrund ergibt meist das sauberste Ergebnis.'
      : '배경보다 한 톤 밝거나 어두운 톤온톤 의상을 선택하시면 실패 없는 결과물을 얻기 좋습니다.';
  els.bgRecList.innerHTML = state.bgColors.map((key, index) => {
    const bg = BG_META.find((item) => item.key === key);
    const rec = BG_REC_META[key];
    if (!bg || !rec) return '';
    const label = bg.label[state.lang] || bg.label.ko;
    const outfits = rec.outfits[state.lang] || rec.outfits.ko;
    const desc = rec.desc[state.lang] || rec.desc.ko;
    const guide = rec.guide[state.lang] || rec.guide.ko;
    return `
      <div class="bg-rec-card">
        <div class="bg-rec-title">${escapeHtml(titleBase)} ${index + 1} · ${escapeHtml(label)}</div>
        <div class="bg-rec-outfits">👗 ${escapeHtml(outfitPrefix)}: ${escapeHtml(outfits)}</div>
        <div class="bg-rec-desc">${escapeHtml(desc)}</div>
        <div class="bg-rec-guide">💡 <strong>${escapeHtml(guide)}</strong><br>${escapeHtml(guideLead)}</div>
      </div>
    `;
  }).join('');
}

function getProductLabel(product) {
  if (!product) return '';
  if (state.lang === 'en') return product.nameEn || product.nameKo;
  if (state.lang === 'de') return product.nameDe || product.nameKo;
  return product.nameKo || product.nameEn || product.nameDe;
}

function getBusinessSelection() {
  const mode = state.businessMode || 'photo';
  const hours = Number(state.businessHours || 2);
  const edit = state.businessVideoEdit || 'raw';
  const tableKey = mode === 'video' ? `video_${edit}` : 'photo';
  const price = BUSINESS_PRICE_META[tableKey]?.[hours] || 0;
  const modeLabel = BUSINESS_MODE_META.find((item) => item.key === mode)?.label[state.lang]
    || BUSINESS_MODE_META.find((item) => item.key === mode)?.label.ko
    || mode;
  const editLabel = mode === 'video'
    ? (BUSINESS_VIDEO_EDIT_META.find((item) => item.key === edit)?.label[state.lang]
      || BUSINESS_VIDEO_EDIT_META.find((item) => item.key === edit)?.label.ko
      || edit)
    : '';
  const label = mode === 'video'
    ? `${modeLabel} · ${hours}${state.lang === 'en' ? 'h' : state.lang === 'de' ? ' Std.' : '시간'} · ${editLabel}`
    : `${modeLabel} · ${hours}${state.lang === 'en' ? 'h' : state.lang === 'de' ? ' Std.' : '시간'}`;
  return { mode, hours, edit, tableKey, price, label, duration: hours * 60 };
}

function getProductDescription(product) {
  if (!product) return '';
  if (state.lang === 'en') return product.descEn || product.descKo || '';
  if (state.lang === 'de') return product.descDe || product.descKo || '';
  return product.descKo || product.descEn || '';
}

function getShootDuration() {
  if (state.quote?.duration) return Number(state.quote.duration) || 0;
  if (!state.selectedProduct) return 0;
  return Number(state.selectedProduct.d || 0);
}

function getCalendarDuration() {
  if (state.quote?.totalDuration) return Number(state.quote.totalDuration) || 0;
  if (!state.selectedProduct) return 0;
  return Number(state.selectedProduct.d || 0) + Number(state.selectedProduct.prep || 0);
}

function getPrepDuration() {
  if (state.quote?.prep !== undefined) return Number(state.quote.prep) || 0;
  if (!state.selectedProduct) return 0;
  return Number(state.selectedProduct.prep || 0);
}

function getEstimatedPrice() {
  if (state.quote?.totalPrice !== undefined) return Number(state.quote.totalPrice) || 0;
  if (!state.selectedProduct) return 0;
  if (state.selectedProduct.g === 'biz') return getBusinessSelection().price;
  return Number(state.selectedProduct.p || 0);
}

function getPeopleCount() {
  if (!state.selectedProduct) return 1;
  if (state.selectedProduct.g === 'biz') return 1;
  return state.selectedProduct.g === 'pass'
    ? Number(els.passportPeople.value || 1)
    : Number(els.generalPeople.value || 1);
}

function getDefaultPeopleForProduct(product) {
  if (!product) return 1;
  if (product.g === 'stud' || product.g === 'snap') return 2;
  return 1;
}

function getPeopleOptionLabel(count, product) {
  const copy = getCopy();
  const baseLabel = state.lang === 'en'
    ? `${count}${count > 1 ? ' people' : copy.peopleUnit}`
    : state.lang === 'de'
      ? `${count} ${count > 1 ? 'Personen' : 'Person'}`
      : `${count}${copy.peopleUnit}`;
  if (!product) return baseLabel;
  let surcharge = 0;
  if (product.t === 'group' && count > 2) surcharge = (count - 2) * 30;
  if (product.t === 'snap' && count > 2) surcharge = (count - 2) * 30;
  if (surcharge > 0) return `${baseLabel} (+€${surcharge})`;
  return baseLabel;
}

function getPassAddonPeopleLabel(count) {
  const extraDur = { 1: 15, 2: 20, 3: 30, 4: 40 }[count] || 40;
  const baseLabel = state.lang === 'en'
    ? `${count}${count > 1 ? ' people' : ' person'}`
    : state.lang === 'de'
      ? `${count} ${count > 1 ? 'Personen' : 'Person'}`
      : `${count}명`;
  return `${baseLabel} (+${extraDur}분)`;
}

function renderPeopleOptions() {
  const product = state.selectedProduct;
  const generalDefault = String(getDefaultPeopleForProduct(product));
  const generalValue = String(els.generalPeople?.value || generalDefault);
  const passportValue = String(els.passportPeople?.value || '1');
  const addonValue = String(els.passAddonPeople?.value || '1');

  if (els.generalPeople) {
    els.generalPeople.innerHTML = [1, 2, 3, 4, 5]
      .map((count) => `<option value="${count}">${escapeHtml(getPeopleOptionLabel(count, product))}</option>`)
      .join('');
    els.generalPeople.value = generalValue;
  }
  if (els.passportPeople) {
    els.passportPeople.innerHTML = [1, 2, 3, 4, 5]
      .map((count) => `<option value="${count}">${escapeHtml(getPeopleOptionLabel(count, { t: 'pass' }))}</option>`)
      .join('');
    els.passportPeople.value = passportValue;
  }
  if (els.passAddonPeople) {
    els.passAddonPeople.innerHTML = [1, 2, 3, 4]
      .map((count) => `<option value="${count}">${escapeHtml(getPassAddonPeopleLabel(count))}</option>`)
      .join('');
    els.passAddonPeople.value = addonValue;
  }
}

function renderBusinessOptions() {
  if (!els.bizMode || !els.bizHours || !els.bizEdit || !els.bizAddonGrid || !els.bizAddonHelp) return;
  const isBiz = state.selectedProduct?.g === 'biz';
  if (!isBiz) {
    els.bizEditField?.classList.add('hidden-field');
    els.bizAddonGrid.innerHTML = '';
    return;
  }
  els.bizMode.innerHTML = BUSINESS_MODE_META
    .map((item) => `<option value="${item.key}">${escapeHtml(item.label[state.lang] || item.label.ko)}</option>`)
    .join('');
  els.bizHours.innerHTML = BUSINESS_HOURS_META
    .map((hours) => {
      const label = state.lang === 'en'
        ? `${hours} hours`
        : state.lang === 'de'
          ? `${hours} Stunden`
          : `${hours}시간`;
      return `<option value="${hours}">${escapeHtml(label)}</option>`;
    })
    .join('');
  els.bizEdit.innerHTML = BUSINESS_VIDEO_EDIT_META
    .map((item) => `<option value="${item.key}">${escapeHtml(item.label[state.lang] || item.label.ko)}</option>`)
    .join('');
  els.bizMode.value = state.businessMode;
  els.bizHours.value = state.businessHours;
  els.bizEdit.value = state.businessVideoEdit;
  els.bizEditField?.classList.toggle('hidden-field', state.businessMode !== 'video');
  els.bizAddonHelp.textContent = getCopy().bizAddonHelp;
  els.bizAddonGrid.innerHTML = BUSINESS_ADDON_META.map((item) => {
    const selected = state.businessAddonKeys.includes(item.key) ? ' selected' : '';
    return `<button type="button" class="chip-btn toggle-chip${selected}" data-biz-addon="${item.key}">${escapeHtml(item.label[state.lang] || item.label.ko)}</button>`;
  }).join('');
  els.bizAddonGrid.querySelectorAll('[data-biz-addon]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.bizAddon;
      const index = state.businessAddonKeys.indexOf(key);
      if (index >= 0) state.businessAddonKeys.splice(index, 1);
      else state.businessAddonKeys.push(key);
      renderBusinessOptions();
      renderReview();
      refreshStepLocks();
    });
  });
}

function getPeoplePricingNote(product, people) {
  if (!product) return '';
  if (product.t === 'group') {
    if (people <= 2) {
      return state.lang === 'en'
        ? 'Base price includes up to 2 people. From the 3rd person: +€30 each.'
        : state.lang === 'de'
          ? 'Der Grundpreis gilt für bis zu 2 Personen. Ab der 3. Person: +€30 pro Person.'
          : '기본가는 2인 기준입니다. 3인부터 1인당 €30가 추가됩니다.';
    }
    const extra = (people - 2) * 30;
    return state.lang === 'en'
      ? `${people} people selected: +€${extra} extra person fee applied.`
      : state.lang === 'de'
        ? `${people} Personen gewählt: Aufpreis +€${extra} angewendet.`
        : `${people}명 선택: 인원 추가비 €${extra}가 반영되었습니다.`;
  }
  if (product.t === 'snap') {
    if (people === 2) {
      return state.lang === 'en'
        ? 'Base price includes 2 people. 1 person gets -€30, 3+ people add +€30 each.'
        : state.lang === 'de'
          ? 'Der Grundpreis gilt für 2 Personen. 1 Person: -€30, ab 3 Personen: +€30 pro Person.'
          : '기본가는 2인 기준입니다. 1인은 -€30, 3인부터 1인당 €30가 추가됩니다.';
    }
    if (people === 1) {
      return state.lang === 'en'
        ? 'Solo outdoor booking discount -€30 applied.'
        : state.lang === 'de'
          ? 'Outdoor-Einzelbuchung: Rabatt -30€ angewendet.'
          : '야외스냅 1인 할인 -€30이 적용되었습니다.';
    }
    const extra = (people - 2) * 30;
    return state.lang === 'en'
      ? `${people} people selected: +€${extra} extra person fee applied.`
      : state.lang === 'de'
        ? `${people} Personen gewählt: Aufpreis +€${extra} angewendet.`
        : `${people}명 선택: 인원 추가비 €${extra}가 반영되었습니다.`;
  }
  if (product.g === 'pass') {
    return state.lang === 'en'
      ? `Current quote is based on ${people} applicant${people > 1 ? 's' : ''}.`
      : state.lang === 'de'
        ? `Das aktuelle Angebot basiert auf ${people} Antragsteller${people > 1 ? 'n' : ''}.`
        : `현재 금액은 ${people}명 기준으로 계산되었습니다.`;
  }
  return '';
}

function getProductPolicyNote(product) {
  if (!product) return '';
  if (product.id === 'pb') {
    return state.lang === 'en'
      ? 'Profile Basic seniors are free on weekdays (Tue-Fri).'
      : state.lang === 'de'
        ? 'Profile Basic ist für Senioren an Werktagen (Di-Fr) kostenlos.'
        : '프로필 Basic은 시니어 고객 평일(화-금) 무료입니다.';
  }
  if (product.id === 'pbus' || product.id === 'pp') {
    return state.lang === 'en'
      ? (product.id === 'pp'
        ? 'Profile Professional seniors get -€50 on weekdays and -€30 on Saturdays after selecting the date.'
        : 'Profile Business seniors get -€50 on weekdays after selecting the date.')
      : state.lang === 'de'
        ? (product.id === 'pp'
          ? 'Für Senioren gilt bei Profile Professional nach Datumswahl werktags -50€ und samstags -30€.'
          : 'Für Senioren gilt bei Profile Business nach Datumswahl werktags -50€.')
        : (product.id === 'pp'
          ? '프로필 Professional은 날짜 선택 후 시니어 평일 -50€, 토요일 -30€가 적용됩니다.'
          : '프로필 Business는 날짜 선택 후 시니어 평일 -50€가 적용됩니다.');
  }
  return '';
}

function getProductGuideList(product) {
  if (!product) return [];
  if (product.g === 'pass') {
    return state.lang === 'en'
      ? ['Bring your passport or ID information to avoid mismatches.', 'Please check the exact visa photo requirements before visiting.', 'Additional countries are charged automatically in the quote.']
      : state.lang === 'de'
        ? ['Bitte bringen Sie Ihre Pass- oder Ausweisdaten korrekt mit.', 'Prüfen Sie vorab die genauen Visumfoto-Anforderungen des Ziellandes.', 'Zusätzliche Länder werden automatisch im Angebot berechnet.']
        : ['여권/신분증 정보가 정확한지 미리 확인해 주세요.', '비자 사진은 국가별 규격을 방문 전 다시 확인해 주세요.', '추가 국가는 견적에 자동 반영됩니다.'];
  }
  if (product.g === 'prof') {
    return state.lang === 'en'
      ? ['Please prepare one or two outfits that match the selected background and mood.', 'Simple accessories work best for profile sessions.', 'If you add passport photos, the total session time increases automatically.']
      : state.lang === 'de'
        ? ['Bitte bereiten Sie ein bis zwei Outfits passend zum Hintergrund und zur Stimmung vor.', 'Schlichte Accessoires funktionieren bei Profilshootings am besten.', 'Bei zusätzlichem Passfoto verlängert sich die Gesamtzeit automatisch.']
        : ['선택한 배경과 분위기에 맞는 의상 1~2벌을 준비해 주세요.', '프로필 촬영은 심플한 액세서리가 가장 잘 어울립니다.', '여권사진 추가 촬영을 선택하면 전체 시간이 자동으로 늘어납니다.'];
  }
  if (product.g === 'stud') {
    return state.lang === 'en'
      ? ['Background and outfit options change the styling, not the shoot flow itself.', 'Please arrive a few minutes early if multiple people are included.', 'Studio family/group sessions are priced for two people by default.']
      : state.lang === 'de'
        ? ['Hintergrund- und Outfitoptionen verändern den Stil, nicht den grundsätzlichen Ablauf.', 'Bitte kommen Sie bei mehreren Personen ein paar Minuten früher.', 'Studio-Familien/Gruppen-Sessions sind standardmäßig für zwei Personen kalkuliert.']
        : ['배경/의상 옵션은 촬영 스타일에만 영향을 주고 진행 흐름은 그대로 유지됩니다.', '여러 명이 함께 촬영하는 경우 약간 일찍 도착해 주세요.', '스튜디오 가족/그룹 촬영은 기본 2인 기준으로 계산됩니다.'];
  }
  if (product.g === 'snap' || product.g === 'wed') {
    return state.lang === 'en'
      ? ['Please enter the preferred location in step 2 before checking the calendar.', 'Travel outside the Frankfurt 50km area may require an extra transportation fee.', 'Outdoor sessions are weather-sensitive, so we may suggest alternatives after review.']
      : state.lang === 'de'
        ? ['Bitte geben Sie den gewünschten Ort in Schritt 2 ein, bevor Sie den Kalender prüfen.', 'Außerhalb des 50-km-Radius von Frankfurt können zusätzliche Fahrtkosten entstehen.', 'Outdoor-Shootings sind wetterabhängig; nach Prüfung können Alternativen vorgeschlagen werden.']
        : ['달력 확인 전 2단계에서 희망 촬영 장소를 먼저 입력해 주세요.', '프랑크푸르트 50km 외 지역은 추가 이동 비용이 발생할 수 있습니다.', '야외 촬영은 날씨 영향을 받아 검토 후 대체안을 안내드릴 수 있습니다.'];
  }
  if (product.g === 'biz') {
    const business = getBusinessSelection();
    return state.lang === 'en'
      ? [
          `${business.label} package is currently selected.`,
          'Please describe the event purpose, schedule, and required deliverables in detail.',
          'SNS, rush delivery, and branding requests are reviewed after booking.'
        ]
      : state.lang === 'de'
        ? [
            `${business.label} ist aktuell ausgewählt.`,
            'Bitte beschreiben Sie Zweck, Ablauf und gewünschte Deliverables des Events möglichst genau.',
            'SNS, Express-Lieferung und Branding-Wünsche werden nach der Buchung einzeln geprüft.'
          ]
        : [
            `${business.label} 패키지가 현재 선택되어 있습니다.`,
            '행사 목적, 시간대, 필요한 결과물을 가능한 자세히 적어 주세요.',
            'SNS, 긴급 납품, 자막/로고/BGM 요청은 예약 접수 후 개별 검토됩니다.'
          ];
  }
  return [];
}

function getVisitGuideList(product) {
  if (!product) return [];
  if (product.g === 'pass' || product.g === 'prof' || product.g === 'stud') {
    return state.lang === 'en'
      ? ['Studio mean, Holzwegpassage 3, 61440 Oberursel', 'Detailed arrival instructions are sent again in the confirmation email.', 'If you need an invoice, please fill in the address field before submitting.']
      : state.lang === 'de'
        ? ['Studio mean, Holzwegpassage 3, 61440 Oberursel', 'Die genaue Anfahrtsinformation wird in der Bestätigungs-E-Mail erneut gesendet.', 'Wenn Sie eine Rechnung benötigen, tragen Sie bitte vor dem Absenden Ihre Adresse ein.']
        : ['Studio mean, Holzwegpassage 3, 61440 Oberursel', '정확한 방문 안내는 확인 메일에서 다시 보내드립니다.', '인보이스가 필요하시면 제출 전 주소를 입력해 주세요.'];
  }
  return state.lang === 'en'
    ? ['The final meeting location is confirmed after review and via email.', 'Please keep your phone number available in case we need to coordinate quickly.']
    : state.lang === 'de'
      ? ['Der endgültige Treffpunkt wird nach Prüfung per E-Mail bestätigt.', 'Bitte halten Sie Ihre Telefonnummer für eine kurzfristige Abstimmung bereit.']
      : ['최종 만남 장소는 예약 검토 후 메일로 다시 안내드립니다.', '빠른 조율이 필요할 수 있으니 연락 가능한 번호를 정확히 남겨 주세요.'];
}

function isEventPeriodActive() {
  const settings = state.init?.settings || {};
  if (!settings.eventRate || !settings.eventStart || !settings.eventEnd) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  return todayStr >= String(settings.eventStart) && todayStr <= String(settings.eventEnd);
}

function getEventPeriodLabel() {
  const settings = state.init?.settings || {};
  const rate = Number(settings.eventRate || 0);
  if (!rate || !isEventPeriodActive()) return '';
  return state.lang === 'en'
    ? `Event ${rate}% Off`
    : state.lang === 'de'
      ? `Aktion ${rate}% Rabatt`
      : `이벤트 ${rate}% 할인`;
}

function getAppliedDiscountNote() {
  const item = state.selectedProduct;
  if (!item || !state.quote) return '';
  if (state.quote.eventDiscount > 0) {
    return state.lang === 'en'
      ? `Event discount -€${state.quote.eventDiscount} applied.`
      : state.lang === 'de'
        ? `Aktionsrabatt -${state.quote.eventDiscount}€ angewendet.`
        : `이벤트 할인 -€${state.quote.eventDiscount}가 적용되었습니다.`;
  }
  if (item.g === 'prof') {
    if (state.ageGroup === 'kids') {
      return state.lang === 'en'
        ? 'Kids discount -€10 applied.'
        : state.lang === 'de'
          ? 'Kinderrabatt -10€ angewendet.'
          : '키즈 할인 -€10이 적용되었습니다.';
    }
    if (state.ageGroup === 'senior' && state.selectedDate) {
      const d = new Date(`${state.selectedDate}T12:00:00`);
      const day = d.getDay();
      const isWd = day >= 2 && day <= 5;
      const isSat = day === 6;
      if (item.id === 'pb' && isWd && state.quote.totalPrice === 0) {
        return state.lang === 'en'
          ? 'Senior weekday free benefit applied.'
          : state.lang === 'de'
            ? 'Senioren-Vorteil werktags kostenlos angewendet.'
            : '시니어 평일 무료 혜택이 적용되었습니다.';
      }
      if ((item.id === 'pbus' || item.id === 'pp') && isWd) {
        return state.lang === 'en'
          ? 'Senior weekday discount -€50 applied.'
          : state.lang === 'de'
            ? 'Seniorenrabatt werktags -50€ angewendet.'
            : '시니어 평일 할인 -€50이 적용되었습니다.';
      }
      if (item.id === 'pp' && isSat) {
        return state.lang === 'en'
          ? 'Senior Saturday discount -€30 applied.'
          : state.lang === 'de'
            ? 'Seniorenrabatt Samstag -30€ angewendet.'
            : '시니어 토요일 할인 -€30이 적용되었습니다.';
      }
    }
  }
  if (item.t === 'snap' && getPeopleCount() === 1) {
    return state.lang === 'en'
      ? 'Solo outdoor discount -€30 applied.'
      : state.lang === 'de'
        ? 'Solo-Outdoor-Rabatt -30€ angewendet.'
        : '야외 1인 촬영 할인 -€30이 적용되었습니다.';
  }
  if (item.g === 'wed' && (els.form.elements.marketing?.checked || false)) {
    return state.lang === 'en'
      ? 'Marketing consent discount -€50 applied.'
      : state.lang === 'de'
        ? 'Rabatt für Marketing-Einwilligung -50€ angewendet.'
        : '마케팅 동의 할인 -€50이 적용되었습니다.';
  }
  if ((item.g === 'prof' || item.g === 'stud') && els.passAddonToggle?.checked) {
    return state.lang === 'en'
      ? `Passport add-on applied (+€${state.quote.passAddonPrice || 0}).`
      : state.lang === 'de'
        ? `Passfoto-Zusatz wurde angewendet (+€${state.quote.passAddonPrice || 0}).`
        : `여권 추가촬영이 적용되었습니다 (+€${state.quote.passAddonPrice || 0}).`;
  }
  return '';
}

function getSecondaryPriceNote() {
  const item = state.selectedProduct;
  if (!item) return '';
  const discountNote = getAppliedDiscountNote();
  const peopleNote = getPeoplePricingNote(item, getPeopleCount());
  if (!discountNote) return peopleNote;
  if (!peopleNote) return '';
  if (item.t === 'snap' && getPeopleCount() === 1) return '';
  return peopleNote;
}

function renderProducts(products) {
  const cards = (products || []).map((product) => {
    const duration = Number(product.d || 0);
    const selected = state.selectedProduct?.id === product.id ? ' selected' : '';
    const eventBadge = getEventPeriodLabel()
      ? `<div class="product-badge">${escapeHtml(getEventPeriodLabel())}</div>`
      : '';
    return `
      <button type="button" class="product-card${selected}" data-id="${escapeHtml(product.id)}">
        ${eventBadge}
        <h3>${escapeHtml(getProductLabel(product))}</h3>
        <div class="product-meta">
          <div>${escapeHtml(product.nameEn || '')}</div>
          <div>€${escapeHtml(product.p)} · ${state.lang === 'en' ? `${escapeHtml(duration)} min` : state.lang === 'de' ? `${escapeHtml(duration)} Min` : `촬영 ${escapeHtml(duration)}분`}</div>
        </div>
      </button>
    `;
  }).join('');
  els.productGrid.innerHTML = cards || `<div class="empty-state">${escapeHtml(getCopy().selectCategoryEmpty)}</div>`;
  els.productGrid.querySelectorAll('.product-card').forEach((button) => {
    button.addEventListener('click', () => selectProduct(button.dataset.id));
  });
}

function selectGroup(groupKey) {
  clearSubmitResult();
  state.selectedGroup = groupKey;
  state.activeStep = 2;
  state.selectedProduct = null;
  state.selectedDate = '';
  state.selectedSlot = '';
  state.quote = null;
  state.selectedCountries = [];
  state.optionKeys = [];
  state.surveyKeys = [];
  state.ageGroup = 'adult';
  state.babyType = 'baekil';
  state.bgColors = [];
  state.businessMode = 'photo';
  state.businessHours = '2';
  state.businessVideoEdit = 'raw';
  state.businessAddonKeys = [];
  els.form.reset();
  els.generalPeople.value = '1';
  els.passportPeople.value = '1';
  renderPeopleOptions();
  els.submitBtn.disabled = true;
  renderGroups();
  renderProducts((state.init?.products || []).filter((item) => item.g === groupKey));
  renderPassportPanel();
  renderSurveyChips();
  renderAgeChips();
  renderBabyTypeChips();
  renderBgChips();
  renderGeneralPanel();
  renderProductDetail();
  renderReview();
  clearCalendarSelection();
  syncStepPanels();
  syncConsentVisibility();
}

async function selectProduct(productId) {
  clearSubmitResult();
  state.activeStep = 2;
  state.selectedProduct = (state.init?.products || []).find((item) => item.id === productId) || null;
  state.selectedGroup = state.selectedProduct?.g || state.selectedGroup;
  state.selectedDate = '';
  state.selectedSlot = '';
  state.quote = null;
  state.optionKeys = [];
  if (state.selectedProduct?.g !== 'pass') {
    state.selectedCountries = [];
  }
  state.surveyKeys = [];
  state.ageGroup = 'adult';
  state.babyType = 'baekil';
  state.bgColors = [];
  state.businessMode = 'photo';
  state.businessHours = '2';
  state.businessVideoEdit = 'raw';
  state.businessAddonKeys = [];
  els.form.reset();
  els.generalPeople.value = String(getDefaultPeopleForProduct(state.selectedProduct));
  els.passportPeople.value = '1';
  renderPeopleOptions();
  els.submitBtn.disabled = true;
  renderGroups();
  renderProducts((state.init?.products || []).filter((item) => item.g === state.selectedGroup));
  renderPassportPanel();
  renderSurveyChips();
  renderAgeChips();
  renderBabyTypeChips();
  renderBgChips();
  renderGeneralPanel();
  syncStepPanels();
  syncConsentVisibility();
  await refreshQuote();
  refreshStepLocks();
  if (!state.selectedProduct) return;
  els.calendarHint.textContent = `${getProductLabel(state.selectedProduct)} · ${getCopy().calendarLoadedHint}`;
  setBanner(getCopy().initSuccess, 'success');
}

function renderPassportPanel() {
  const isPass = state.selectedProduct?.g === 'pass';
  els.passportPanel.classList.toggle('hidden', !isPass);
  if (isPass) {
    renderPassportCountries();
  }
}

function renderGeneralPanel() {
  const product = state.selectedProduct;
  const showGeneral = !!product && product.g !== 'pass';
  els.generalPanel.classList.toggle('hidden', !showGeneral);
  if (!showGeneral) {
    els.optionGrid.innerHTML = '';
    syncConditionalFields();
    return;
  }
  const showPeople = !(product.g === 'prof' || product.g === 'wed' || product.g === 'biz');
  els.peopleField.classList.toggle('hidden', !showPeople);
  const showPassAddon = product.g === 'prof' || product.g === 'stud';
  els.passAddonField.classList.toggle('hidden-field', !showPassAddon);
  els.passAddonPeopleField.classList.toggle('hidden-field', !(showPassAddon && els.passAddonToggle?.checked));
  if (els.passAddonPriceTag) {
    els.passAddonPriceTag.textContent = showPassAddon && els.passAddonToggle?.checked
      ? `+€${state.quote?.passAddonPrice || getPreviewQuote()?.passAddonPrice || 0}`
      : '';
  }
  renderAgeChips();
  renderBabyTypeChips();
  renderBgChips();
  renderBusinessOptions();
  const options = Object.entries(OPTION_META)
    .filter(([, meta]) => meta.groups.includes(product.g))
    .map(([key, meta]) => {
      const label = meta.label[state.lang] || meta.label.ko;
      const selected = state.optionKeys.includes(key) ? ' selected' : '';
      return `<button type="button" class="chip-btn toggle-chip${selected}" data-option="${key}">${escapeHtml(label)}</button>`;
    }).join('');
  els.optionGrid.innerHTML = options || `<div class="muted-copy">${escapeHtml(getCopy().noOptions)}</div>`;
  renderPeopleOptions();
  els.optionGrid.querySelectorAll('[data-option]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.option;
      const index = state.optionKeys.indexOf(key);
      if (index >= 0) state.optionKeys.splice(index, 1);
      else state.optionKeys.push(key);
      handleQuoteInputChange();
      refreshStepLocks();
    });
  });
  syncConditionalFields();
  syncConsentVisibility();
}

function syncConditionalFields() {
  const group = state.selectedProduct?.g || '';
  const needsBabyName = (group === 'prof' && state.selectedProduct?.id === 'pp' && state.ageGroup === 'baby')
    || state.surveyKeys.includes('baby');
  els.otherCountryField.classList.toggle('hidden-field', !(group === 'pass' && state.selectedCountries.includes('OTHER')));
  els.locationField.classList.toggle('hidden-field', !(group === 'snap' || group === 'wed'));
  els.businessField.classList.toggle('hidden-field', group !== 'biz');
  els.surveyField.classList.toggle('hidden-field', !group || group === 'pass' || group === 'biz');
  els.ageField.classList.toggle('hidden-field', group !== 'prof');
  els.babyTypeField.classList.toggle('hidden-field', !(group === 'prof' && state.selectedProduct?.id === 'pp' && state.ageGroup === 'baby'));
  els.babyNameField.classList.toggle('hidden-field', !needsBabyName);
  els.reshootingField.classList.toggle('hidden-field', !(group === 'prof' && (state.ageGroup === 'kids' || state.ageGroup === 'baby')));
  els.bgField.classList.toggle('hidden-field', !(group === 'prof' || group === 'stud'));
  if (group === 'biz') renderBusinessOptions();
  syncMemoPlaceholder();
}

function syncMemoPlaceholder() {
  const memo = els.form?.elements?.memo;
  if (!memo) return;
  if (state.surveyKeys.includes('baby') || (state.selectedProduct?.g === 'prof' && state.selectedProduct?.id === 'pp' && state.ageGroup === 'baby')) {
    memo.placeholder = state.lang === 'en'
      ? "Please write the baby's name in Korean or English. Add any requests here as well."
      : state.lang === 'de'
        ? 'Bitte den Namen des Kindes auf Koreanisch oder Englisch angeben. Weitere Wünsche bitte ebenfalls hier notieren.'
        : '아기 이름을 한글 또는 영문으로 적어주세요. 기타 요청사항도 함께 작성해 주세요.';
    return;
  }
  memo.placeholder = state.lang === 'en'
    ? 'Share any requests or notes for the shoot.'
    : state.lang === 'de'
      ? 'Bitte teilen Sie uns besondere Wünsche oder Hinweise zum Shooting mit.'
      : '촬영 전에 전달할 요청사항이 있다면 적어 주세요.';
}

function getQuoteRequest() {
  const product = state.selectedProduct;
  if (!product) return null;
  return {
    itemId: product.id,
    people: product.g === 'pass' ? Number(els.passportPeople.value || 1) : Number(els.generalPeople.value || 1),
    optionKeys: [...state.optionKeys],
    passCountries: product.g === 'pass' ? state.selectedCountries.filter((code) => code !== 'OTHER') : [],
    otherCountry: product.g === 'pass' ? String(els.form.elements.otherCountry?.value || '').trim() : '',
    date: state.selectedDate || '',
    marketing: els.form.elements.marketing?.checked || false,
    isReturn: state.returnEligible,
    ageGroup: product.g === 'prof' ? state.ageGroup : 'adult',
    babyType: product.g === 'prof' && state.ageGroup === 'baby' ? state.babyType : '',
    bgColors: [...state.bgColors],
    businessMode: product.g === 'biz' ? state.businessMode : '',
    businessHours: product.g === 'biz' ? Number(state.businessHours || 2) : '',
    businessVideoEdit: product.g === 'biz' ? state.businessVideoEdit : '',
    businessAddonKeys: product.g === 'biz' ? [...state.businessAddonKeys] : [],
    passAddon: (product.g === 'prof' || product.g === 'stud') && !!els.passAddonToggle?.checked,
    passAddonPeople: Number(els.passAddonPeople?.value || 1)
  };
}

async function refreshQuote() {
  if (!state.selectedProduct) return;
  const token = ++state.quoteToken;
  state.quote = getPreviewQuote();
  renderGeneralPanel();
  renderProductDetail();
  renderReview();
  try {
    const nextQuote = await fetchQuote(getQuoteRequest());
    if (token !== state.quoteToken) return;
    state.quote = nextQuote;
  } catch (error) {
    console.error(error);
  }
  renderGeneralPanel();
  renderProductDetail();
  renderReview();
}

async function handleQuoteInputChange() {
  const prevDuration = getCalendarDuration();
  await refreshQuote();
  const nextDuration = getCalendarDuration();
  const shouldReloadCalendar = !state.selectedDate || prevDuration !== nextDuration;
  if (shouldReloadCalendar) clearCalendarSelection();
  if (state.selectedProduct && shouldReloadCalendar && state.activeStep >= 3) {
    els.calendarHint.textContent = `${getProductLabel(state.selectedProduct)} · ${getCopy().calendarLoadedHint}`;
    setBanner(getCopy().loadCalendar, 'loading');
    await loadCalendar();
  }
}

async function handleMarketingChange() {
  await refreshQuote();
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
  renderPassportCountries();
  syncConditionalFields();
  handleQuoteInputChange().then(() => refreshStepLocks());
}

function renderProductDetail() {
  if (!state.selectedProduct) {
    els.productDetail.className = 'detail-box empty-state';
    els.productDetail.textContent = getCopy().selectProductDetailEmpty;
    return;
  }
  const business = state.selectedProduct.g === 'biz' ? getBusinessSelection() : null;
  const desc = business
    ? (state.lang === 'en'
      ? `${business.label}. Original files are included. Optional requests are reviewed after booking.`
      : state.lang === 'de'
        ? `${business.label}. Originaldateien sind inklusive. Zusatzwünsche werden nach der Buchung geprüft.`
        : `${business.label}. 원본 제공이 포함되며, 추가 요청은 예약 접수 후 검토됩니다.`)
    : getProductDescription(state.selectedProduct);
  const price = getEstimatedPrice();
  const productGuideList = getProductGuideList(state.selectedProduct);
  const visitGuideList = getVisitGuideList(state.selectedProduct);
  const eventBadge = state.quote?.eventDiscount > 0
    ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:#dc2626;color:#fff;font-weight:800;font-size:13px;margin:0 0 12px 0;">
        ${state.lang === 'en'
          ? `EVENT DISCOUNT LIVE · -€${state.quote.eventDiscount}`
          : state.lang === 'de'
            ? `AKTION LÄUFT · -${state.quote.eventDiscount}€`
            : `이벤트 진행중 · -€${state.quote.eventDiscount}`}
      </div>
      <div class="muted-copy" style="margin:0 0 10px 0;font-weight:700;color:#b91c1c;">
        ${state.lang === 'en'
          ? 'The discounted event price is currently applied to this package.'
          : state.lang === 'de'
            ? 'Für dieses Paket wird aktuell der Aktionspreis angewendet.'
            : '현재 이 상품에는 이벤트 할인가가 적용되고 있습니다.'}
      </div>`
    : '';
  els.productDetail.className = 'detail-box';
  els.productDetail.innerHTML = `
    <div class="detail-title">${escapeHtml(getProductLabel(state.selectedProduct))}</div>
    <div class="detail-copy">${escapeHtml(desc)}</div>
    ${eventBadge}
    <div class="price-hero">
      <div class="price-hero-label">${state.lang === 'en' ? 'Estimated price' : state.lang === 'de' ? 'Geschätzter Preis' : '예상 금액'}</div>
      <div class="price-hero-value">€${price}</div>
      <div class="price-hero-copy">${state.selectedProduct.g === 'biz'
        ? (state.lang === 'en'
          ? `${business.hours} hours selected`
          : state.lang === 'de'
            ? `${business.hours} Stunden ausgewählt`
            : `${business.hours}시간 선택`)
        : (state.lang === 'en'
          ? `About ${getShootDuration()} min`
          : state.lang === 'de'
            ? `Ca. ${getShootDuration()} Min`
            : `촬영 약 ${getShootDuration()}분`)}</div>
    </div>
    ${getAppliedDiscountNote() ? `<div class="muted-copy" style="margin-top:10px;font-weight:700;color:#2563eb;">${escapeHtml(getAppliedDiscountNote())}</div>` : ''}
    ${getProductPolicyNote(state.selectedProduct) ? `<div class="muted-copy" style="margin-top:10px;">${escapeHtml(getProductPolicyNote(state.selectedProduct))}</div>` : ''}
    ${getSecondaryPriceNote() ? `<div class="muted-copy" style="margin-top:8px;">${escapeHtml(getSecondaryPriceNote())}</div>` : ''}
    <div class="guide-grid">
      <div class="guide-box">
        <div class="guide-title">${state.lang === 'en' ? 'Booking Guide' : state.lang === 'de' ? 'Buchungshinweise' : '예약 안내'}</div>
        <ul class="guide-list">
          ${productGuideList.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
        </ul>
      </div>
      <div class="guide-box">
        <div class="guide-title">${state.lang === 'en' ? 'Arrival Guide' : state.lang === 'de' ? 'Besuch / Anfahrt' : '오시는 길 안내'}</div>
        <ul class="guide-list">
          ${visitGuideList.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

async function loadCalendar() {
  if (!state.selectedProduct) return;
  const token = ++state.calendarRequestToken;
  const duration = getCalendarDuration();
  const cacheKey = `${state.calendarYear}_${state.calendarMonth}_${state.selectedProduct.g}_${duration}`;
  let batch = state.calendarCache.get(cacheKey);
  els.monthLabel.textContent = formatMonthLabel(state.calendarYear, state.calendarMonth, state.lang);
  if (!batch) {
    try {
      const monthBatch = await fetchAndStoreCalendarBatch(state.calendarYear, state.calendarMonth, duration, state.selectedProduct.g);
      if (token !== state.calendarRequestToken) return;
      batch = state.calendarCache.get(cacheKey) || monthBatch;
    } catch (error) {
      if (token !== state.calendarRequestToken) return;
      console.error(error);
      setBanner(`${getCopy().calendarFail}: ${error.message}`, 'error');
      els.calendarGrid.innerHTML = `<div class="empty-state">${escapeHtml(getCopy().calendarLoadError)}. ${escapeHtml(error.message)}</div>`;
      return;
    }
  }
  if (token !== state.calendarRequestToken) return;
  renderCalendar(batch);
  setBanner(getCopy().calendarLoaded, 'success');
  prefetchNextCalendarMonth();
}

async function fetchAndStoreCalendarBatch(year, month, duration, itemGroup) {
  const batch = await fetchCalendarBatch({
    year,
    month,
    totalDur: duration,
    itemGroup
  });
  Object.entries(batch || {}).forEach(([monthKey, data]) => {
    const fullKey = `${monthKey}_${itemGroup}_${duration}`;
    state.calendarCache.set(fullKey, data);
  });
  return batch?.[`${year}_${month}`] || Object.values(batch || {})[0] || null;
}

async function prefetchNextCalendarMonth() {
  if (!state.selectedProduct) return;
  const next = new Date(state.calendarYear, state.calendarMonth + 1, 1);
  const duration = getCalendarDuration();
  const nextKey = `${next.getFullYear()}_${next.getMonth()}_${state.selectedProduct.g}_${duration}`;
  if (state.calendarCache.has(nextKey)) return;
  try {
    await fetchAndStoreCalendarBatch(next.getFullYear(), next.getMonth(), duration, state.selectedProduct.g);
  } catch (error) {
    console.error(error);
  }
}

async function loadSlotsForDate(dateKey) {
  const token = ++state.slotRequestToken;
  const duration = getCalendarDuration();
  const slotKey = `${dateKey}_${state.selectedProduct.g}_${duration}`;
  const dateLabel = formatDateLabel(dateKey);
  els.slotHint.textContent = fillCopy(getCopy().slotLoadingForDate, { date: dateLabel });
  els.slotGrid.classList.add('empty-state');
  els.slotGrid.innerHTML = `<div class="empty-state">${escapeHtml(getCopy().loadCalendar)}</div>`;
  let slots = [];
  try {
    slots = await fetchSlots({ date: dateKey, totalDur: duration, itemGroup: state.selectedProduct.g });
    if (token !== state.slotRequestToken) return;
    state.slotCache.set(slotKey, slots);
  } catch (error) {
    if (token !== state.slotRequestToken) return;
    console.error(error);
    els.slotHint.textContent = fillCopy(getCopy().slotFailForDate, { date: dateLabel });
    renderSlots([]);
    return;
  }
  if (token !== state.slotRequestToken) return;
  els.slotHint.textContent = fillCopy(getCopy().slotLoadedForDate, { date: dateLabel });
  renderSlots(slots);
}

function renderCalendar(data) {
  const safeData = data && typeof data === 'object' ? data : {};
  const unavailSource = Array.isArray(safeData.unavail) ? safeData.unavail : [];
  els.calendarGrid.classList.remove('empty-state');
  const unavail = new Set(unavailSource);
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

async function selectDate(dateKey) {
  state.slotRequestToken += 1;
  state.selectedDate = dateKey;
  state.activeStep = 3;
  state.selectedSlot = '';
  els.slotHint.textContent = fillCopy(getCopy().slotLoadingForDate, { date: formatDateLabel(dateKey) });
  els.slotGrid.classList.add('empty-state');
  els.slotGrid.innerHTML = `<div class="empty-state">${escapeHtml(getCopy().loadCalendar)}</div>`;
  renderSeniorWarning();
  const duration = getCalendarDuration();
  renderCalendar(state.calendarCache.get(`${state.calendarYear}_${state.calendarMonth}_${state.selectedProduct.g}_${duration}`));
  await loadSlotsForDate(dateKey);
  refreshQuote();
  renderReview();
  syncStepPanels();
  goToStep(3);
}

function renderSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    els.slotGrid.classList.add('empty-state');
    els.slotGrid.innerHTML = `<div class="empty-state">${getCopy().noSlots}</div>`;
    els.submitBtn.disabled = true;
    return;
  }
  els.slotGrid.classList.remove('empty-state');
  els.slotGrid.innerHTML = slots.map((slot) => {
    const value = typeof slot === 'string' ? slot : slot.time;
    return `<button type="button" class="slot-btn${state.selectedSlot === value ? ' selected' : ''}" data-time="${escapeHtml(value)}">${escapeHtml(value)}</button>`;
  }).join('');
  els.slotGrid.querySelectorAll('.slot-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSlot = button.dataset.time;
      state.activeStep = 5;
      els.slotGrid.querySelectorAll('.slot-btn').forEach((item) => item.classList.toggle('selected', item.dataset.time === state.selectedSlot));
      updateSubmitState();
      renderReview();
      syncStepPanels();
      goToStep(5);
    });
  });
  updateSubmitState();
}

function renderReview() {
  syncConsentVisibility();
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
    rows.push([copy.reviewPeople, getPeopleOptionLabel(Number(els.passportPeople.value || 1), { t: 'pass' })]);
    if (state.selectedCountries.length) {
      const countries = state.selectedCountries.map((code) => {
        const item = COUNTRY_OPTIONS.find((entry) => entry.code === code);
        return item ? item.label[state.lang] || item.label.ko : code;
      }).join(', ');
      rows.push([copy.reviewCountries, countries]);
    }
  } else if (!els.peopleField.classList.contains('hidden')) {
    rows.push([copy.reviewPeople, getPeopleOptionLabel(Number(els.generalPeople.value || 1), state.selectedProduct)]);
  }
  if (state.selectedProduct.g === 'prof') {
    const ageLabel = AGE_META.find((item) => item.key === state.ageGroup)?.label[state.lang] || AGE_META.find((item) => item.key === state.ageGroup)?.label.ko || state.ageGroup;
    rows.push([state.lang === 'en' ? 'Age Group' : state.lang === 'de' ? 'Altersgruppe' : '연령대', ageLabel]);
    if (state.ageGroup === 'baby') {
      const babyTypeLabel = BABY_TYPE_META.find((item) => item.key === state.babyType)?.label[state.lang] || BABY_TYPE_META.find((item) => item.key === state.babyType)?.label.ko || state.babyType;
      rows.push([state.lang === 'en' ? 'Session Type' : state.lang === 'de' ? 'Aufnahmetyp' : '촬영 종류', babyTypeLabel]);
    }
  }
  if (state.surveyKeys.includes('baby') && !(state.selectedProduct.g === 'prof' && state.ageGroup === 'baby')) {
    rows.push([
      state.lang === 'en' ? 'Session Type' : state.lang === 'de' ? 'Aufnahmetyp' : '촬영 종류',
      state.lang === 'en' ? 'Baby / Birthday' : state.lang === 'de' ? 'Baby / Geburtstag' : '백일/돌'
    ]);
  }
  const babyName = String(els.form.elements.babyName?.value || '').trim();
  if (babyName) rows.push([state.lang === 'en' ? 'Baby Name' : state.lang === 'de' ? 'Babyname' : '아기 이름', babyName]);
  if (state.optionKeys.length) {
    const optionLabels = state.optionKeys.map((key) => OPTION_META[key]?.label[state.lang] || OPTION_META[key]?.label.ko || key).join(', ');
    rows.push([copy.reviewOptions, optionLabels]);
  }
  if (state.surveyKeys.length) {
    const surveyLabels = state.surveyKeys
      .map((key) => SURVEY_META.find((item) => item.key === key))
      .filter(Boolean)
      .map((item) => item.label[state.lang] || item.label.ko)
      .join(', ');
    rows.push([copy.reviewSurvey, surveyLabels]);
  }
  const location = String(els.locationInput?.value || '').trim();
  if (location) rows.push([copy.reviewLocation, location]);
  const businessDetails = String(els.businessInput?.value || '').trim();
  if (state.selectedProduct.g === 'biz') {
    rows.push([copy.reviewBusinessPackage, state.quote?.businessLabel || getBusinessSelection().label]);
    if (state.businessAddonKeys.length) {
      const addonLabels = state.businessAddonKeys
        .map((key) => BUSINESS_ADDON_META.find((item) => item.key === key))
        .filter(Boolean)
        .map((item) => item.label[state.lang] || item.label.ko)
        .join(', ');
      rows.push([copy.reviewOptions, addonLabels]);
    }
  }
  if (businessDetails) rows.push([copy.reviewBusiness, businessDetails]);
  if (state.bgColors.length) {
    const bgLabels = state.bgColors
      .map((key) => BG_META.find((item) => item.key === key))
      .filter(Boolean)
      .map((item) => item.label[state.lang] || item.label.ko)
      .join(', ');
    rows.push([state.lang === 'en' ? 'Background' : state.lang === 'de' ? 'Hintergrund' : '배경', bgLabels]);
  }
  const memo = String(els.form.elements.memo?.value || '').trim();
  if (memo) rows.push([copy.reviewMemo, memo]);
  if (state.selectedProduct?.g !== 'pass') {
    rows.push([copy.reviewMarketing, els.form.elements.marketing?.checked ? copy.yes : copy.no]);
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
  syncConsentVisibility();
  const product = state.selectedProduct;
  if (!product || !state.selectedDate || !state.selectedSlot) {
    els.submitBtn.disabled = true;
    return;
  }
  const formData = new FormData(els.form);
  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const emailOk = /\S+@\S+\.\S+/.test(email);
  const isPass = product.g === 'pass';
  const gdprOk = formData.get('gdprConsent') === 'on';
  const aiOk = isPass ? true : formData.get('aiConsent') === 'on';
  const passCountriesOk = !isPass || state.selectedCountries.length > 0;
  const otherCountryOk = !isPass || !state.selectedCountries.includes('OTHER') || !!String(formData.get('otherCountry') || '').trim();
  const locationOk = (product.g === 'snap' || product.g === 'wed') ? !!String(els.locationInput?.value || '').trim() : true;
  const businessOk = product.g !== 'biz' || !!String(els.businessInput?.value || '').trim();
  const babyName = String(formData.get('babyName') || '').trim();
  const babyNameOk = !((product.g === 'prof' && product.id === 'pp' && state.ageGroup === 'baby') || state.surveyKeys.includes('baby')) || !!babyName;
  const reshootingOk = !(product.g === 'prof' && (state.ageGroup === 'kids' || state.ageGroup === 'baby')) || !!els.reshootingConsent?.checked;
  els.submitBtn.disabled = !(name && phone && emailOk && gdprOk && aiOk && passCountriesOk && otherCountryOk && locationOk && businessOk && babyNameOk && reshootingOk);
}

function clearCalendarSelection() {
  clearSubmitResult();
  state.slotRequestToken += 1;
  state.selectedDate = '';
  state.selectedSlot = '';
  els.slotGrid.innerHTML = `<div class="empty-state">${getCopy().slotHintEmpty}</div>`;
  els.slotHint.textContent = getCopy().slotHintEmpty;
  updateSubmitState();
  syncStepPanels();
}

async function changeMonth(offset) {
  const next = new Date(state.calendarYear, state.calendarMonth + offset, 1);
  state.calendarYear = next.getFullYear();
  state.calendarMonth = next.getMonth();
  clearCalendarSelection();
  if (state.selectedProduct && state.activeStep >= 3) {
    els.calendarHint.textContent = `${getProductLabel(state.selectedProduct)} · ${getCopy().calendarLoadedHint}`;
    setBanner(getCopy().loadCalendar, 'loading');
    await loadCalendar();
  }
}

async function onSubmit(event) {
  event.preventDefault();
  if (!state.selectedProduct || !state.selectedDate || !state.selectedSlot) return;
  const formData = new FormData(els.form);
  const isPass = state.selectedProduct.g === 'pass';
  const payload = {
    requestId: createRequestId('booking'),
    itemId: state.selectedProduct.id,
    date: state.selectedDate,
    time: state.selectedSlot,
    people: state.selectedProduct.g === 'pass' ? Number(els.passportPeople.value || 1) : Number(els.generalPeople.value || 1),
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    address: String(formData.get('address') || '').trim(),
    babyName: String(formData.get('babyName') || '').trim(),
    memo: String(formData.get('memo') || '').trim(),
    website: String(formData.get('website') || ''),
    lang: state.lang,
    optionKeys: [...state.optionKeys],
    passCountries: state.selectedProduct.g === 'pass' ? state.selectedCountries.filter((code) => code !== 'OTHER') : [],
    otherCountry: state.selectedProduct.g === 'pass' ? String(formData.get('otherCountry') || '').trim() : '',
    surveyKeys: [...state.surveyKeys],
    businessDetails: state.selectedProduct.g === 'biz' ? String(els.businessInput?.value || '').trim() : '',
    businessMode: state.selectedProduct.g === 'biz' ? state.businessMode : '',
    businessHours: state.selectedProduct.g === 'biz' ? Number(state.businessHours || 2) : '',
    businessVideoEdit: state.selectedProduct.g === 'biz' ? state.businessVideoEdit : '',
    businessAddonKeys: state.selectedProduct.g === 'biz' ? [...state.businessAddonKeys] : [],
    location: (state.selectedProduct.g === 'snap' || state.selectedProduct.g === 'wed') ? String(els.locationInput?.value || '').trim() : '',
    marketing: !isPass && formData.get('marketing') === 'on',
    gdprConsent: formData.get('gdprConsent') === 'on',
    aiConsent: isPass ? true : formData.get('aiConsent') === 'on',
    isReturn: state.returnEligible,
    ageGroup: state.selectedProduct.g === 'prof' ? state.ageGroup : 'adult',
    babyType: state.selectedProduct.g === 'prof' && state.ageGroup === 'baby' ? state.babyType : '',
    bgColors: [...state.bgColors],
    passAddon: (state.selectedProduct.g === 'prof' || state.selectedProduct.g === 'stud') && !!els.passAddonToggle?.checked,
    passAddonPeople: Number(els.passAddonPeople?.value || 1)
  };
  if (!payload.name || !payload.phone || !payload.email) {
    setBanner(getCopy().invalidForm, 'error');
    return;
  }
  if (state.selectedProduct.g === 'pass' && !state.selectedCountries.length) {
    setBanner(getCopy().countryRequired, 'error');
    return;
  }
  if (state.selectedProduct.g === 'prof' && state.selectedProduct.id === 'pp' && state.ageGroup === 'baby' && !payload.babyName) {
    setBanner(
      state.lang === 'en'
        ? 'Please enter the baby name for the 100-day / 1st birthday session.'
        : state.lang === 'de'
          ? 'Bitte geben Sie den Babynamen für das 100-Tage-/1. Geburtstags-Shooting ein.'
          : '백일/돌 촬영은 아기 이름을 입력해 주세요.',
      'error'
    );
    return;
  }
  if (state.surveyKeys.includes('baby') && !payload.babyName) {
    setBanner(
      state.lang === 'en'
        ? 'Please enter the baby name for the baby / birthday session.'
        : state.lang === 'de'
          ? 'Bitte geben Sie den Babynamen für das Baby-/Geburtstags-Shooting ein.'
          : '백일/돌 촬영은 아기 이름을 입력해 주세요.',
      'error'
    );
    return;
  }
  if ((state.selectedProduct.g === 'snap' || state.selectedProduct.g === 'wed') && !payload.location) {
    setBanner(getCopy().locationRequired, 'error');
    return;
  }
  if (state.selectedProduct.g === 'biz' && !payload.businessDetails) {
    setBanner(
      state.lang === 'en'
        ? 'Please describe the event details before submitting.'
        : state.lang === 'de'
          ? 'Bitte beschreiben Sie das Event vor dem Absenden.'
          : '행사 상세 내용을 입력해 주세요.',
      'error'
    );
    return;
  }
  if (!payload.gdprConsent || (!isPass && !payload.aiConsent)) {
    setBanner(getCopy().consentRequired, 'error');
    return;
  }
  if (state.selectedProduct.g === 'prof' && (state.ageGroup === 'kids' || state.ageGroup === 'baby') && !els.reshootingConsent?.checked) {
    setBanner(
      state.lang === 'en'
        ? 'Please agree to the reshooting policy.'
        : state.lang === 'de'
          ? 'Bitte stimmen Sie der Nachshooting-Richtlinie zu.'
          : '재촬영 약관에 동의해 주세요.',
      'error'
    );
    return;
  }
  if (payload.babyName) {
    payload.memo = `[아기 이름: ${payload.babyName}] ${payload.memo}`.trim();
  }
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = getCopy().submitLoading;
  try {
    const result = await submitBooking(payload, payload.requestId);
    renderSubmitResult(payload, result);
    setBanner(getCopy().submitDone, 'success');
    els.form.reset();
    state.selectedSlot = '';
    renderReview();
    updateSubmitState();
  } catch (error) {
    console.error(error);
    setBanner(`${getCopy().submitFail}: ${error.message}`, 'error');
  } finally {
    els.submitBtn.textContent = getCopy().submitLabel;
    updateSubmitState();
    renderReturnNotice();
    syncSelectAllRequired();
  }
}

function setBanner(message, variant) {
  els.banner.textContent = message;
  els.banner.className = `banner ${variant}`;
}

function clearSubmitResult() {
  if (!els.resultBox) return;
  els.resultBox.hidden = true;
  els.resultBox.innerHTML = '';
  els.successPanel?.classList.add('hidden-step');
  els.hero?.classList.remove('hidden-step');
  Object.values(els.stepPanels).forEach((panel) => panel?.classList.remove('hidden-step'));
}

function resetBookingFlow() {
  clearSubmitResult();
  state.activeStep = 1;
  state.selectedGroup = '';
  state.selectedProduct = null;
  state.selectedDate = '';
  state.selectedSlot = '';
  state.selectedCountries = [];
  state.optionKeys = [];
  state.surveyKeys = [];
  state.ageGroup = 'adult';
  state.babyType = 'baekil';
  state.bgColors = [];
  state.businessMode = 'photo';
  state.businessHours = '2';
  state.businessVideoEdit = 'raw';
  state.businessAddonKeys = [];
  state.quote = null;
  state.returnEligible = false;
  state.returnNoticeToken += 1;
  if (state.returnNoticeTimer) clearTimeout(state.returnNoticeTimer);
  els.form.reset();
  els.generalPeople.value = '1';
  els.passportPeople.value = '1';
  if (els.passAddonPeople) els.passAddonPeople.value = '1';
  renderGroups();
  renderProducts([]);
  renderPassportPanel();
  renderPassportCountries();
  renderSurveyChips();
  renderAgeChips();
  renderBabyTypeChips();
  renderGeneralPanel();
  renderProductDetail();
  renderReview();
  clearCalendarSelection();
  syncConsentVisibility();
  syncStepPanels();
  setBanner(getCopy().initSuccess, 'success');
  els.stepPanels.step1?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getSuccessGuideHtml(payload) {
  const product = state.selectedProduct;
  if (!product) return '';
  const isKo = state.lang === 'ko';
  const hasBabyBirthday = payload.surveyKeys?.includes('baby') || payload.babyType === 'baekil' || payload.babyType === 'dol';
  const sections = [];

  if (product.g === 'pass') {
    sections.push(`
      <section class="result-guide-box">
        <h4 class="result-guide-title">${isKo ? '[예약 안내] 한국 여권 & 독일 비자(E-passbild) 촬영' : 'Passport / Visa Shoot Guide'}</h4>
        <div class="result-guide-body">
          ${isKo ? `
            <p>고객님, 예약을 환영합니다. 독일의 디지털 생체인식(E-passbild) 규정과 한국 여권 규정에 맞춰 안전하게 촬영해 드립니다.</p>
            <h5>⚠️ [필독] 눈썹 노출 및 반려 주의</h5>
            <ul>
              <li>눈썹 전체가 보여야 합니다. 앞머리가 눈썹을 조금이라도 가리면 반려될 확률이 매우 높습니다.</li>
              <li>귀 노출은 필수는 아니지만 얼굴 윤곽 확인을 위해 가급적 권장드립니다.</li>
            </ul>
            <h5>📋 촬영 전 체크리스트</h5>
            <ul>
              <li>흰색 상의나 연한 파스텔톤은 피하고, 진한 계열 상의를 추천드립니다.</li>
              <li>안경은 렌즈 반사나 테가 눈을 가릴 수 있어 벗고 촬영하는 것을 권장합니다. 렌즈는 투명 렌즈만 가능합니다.</li>
              <li>입을 다문 무표정으로 촬영하며, 유분기나 글리터는 매트하게 정리해 주세요.</li>
            </ul>
            <h5>✅ 유효기간 및 규격</h5>
            <ul>
              <li>촬영일로부터 6개월 사용 가능합니다.</li>
              <li>사진 규격은 35mm × 45mm, 얼굴 크기는 32~36mm 기준입니다.</li>
            </ul>
            <h5>👶 영유아 촬영 시</h5>
            <ul>
              <li>아기를 눕힌 상태에서 촬영하며, 눈은 떠 있어야 하고 손이나 그림자가 얼굴을 가리면 안 됩니다.</li>
              <li>보호자 손, 옷, 그림자는 사진에 보이면 안 되며 흰색 의상은 피해주세요.</li>
              <li>안경, 모자, 머리띠는 착용할 수 없습니다.</li>
            </ul>
          ` : `
            <p>Please review the biometric passport / visa photo requirements before your visit.</p>
            <ul>
              <li>Keep eyebrows fully visible and avoid reflective glasses.</li>
              <li>Neutral expression, closed mouth, and clear lenses only.</li>
              <li>Infants are photographed lying down and no caregiver hands or shadows may appear.</li>
            </ul>
          `}
        </div>
      </section>
    `);
  }

  if (product.g === 'wed') {
    sections.push(`
      <section class="result-guide-box">
        <h4 class="result-guide-title">${isKo ? '프리웨딩 촬영 전 안내사항 (예약 확정 후)' : 'Pre-Wedding Preparation Guide'}</h4>
        <div class="result-guide-body">
          ${isKo ? `
            <h5>1) 촬영 목적/무드 사전 공유</h5>
            <p>원하시는 분위기와 사용 목적에 따라 촬영 구도와 보정 톤이 달라집니다. 레퍼런스 사진 1~5장이나 선호하는 색감이 있다면 미리 공유해 주세요.</p>
            <h5>2) 일정/로케이션(동선) 확인</h5>
            <ul>
              <li>촬영 날짜, 시작/종료 시간</li>
              <li>장소명과 이동 동선</li>
              <li>우천·강풍 시 대체 장소 여부</li>
            </ul>
            <p>야외 촬영은 보통 해 질 무렵 골든아워 시간대 결과가 가장 좋습니다.</p>
            <h5>3) 복장 가이드</h5>
            <ul>
              <li>크림/베이지/화이트 또는 네이비/블랙처럼 톤을 맞추면 훨씬 고급스럽게 보입니다.</li>
              <li>큰 로고, 강한 패턴, 잔줄무늬는 피해주세요.</li>
              <li>가능하다면 포멀 1벌 + 캐주얼 1벌처럼 2벌 구성을 추천드립니다.</li>
            </ul>
            <h5>4) 준비물 체크리스트</h5>
            <ul>
              <li>신부: 누브라/테이프, 누드톤 속옷, 여분 스타킹</li>
              <li>신랑: 검정/네이비 양말, 벨트, 가능 시 셔츠 여분</li>
              <li>이동용 편한 신발, 물, 간단 간식, 부케/반지/청첩장 같은 소품</li>
            </ul>
            <h5>5) 헤어·메이크업 안내</h5>
            <p>야외 촬영은 바람과 습기 영향이 있으니 헤어 스프레이, 핀, 수정 메이크업 용품을 함께 준비해 주세요. 원하시면 출장 헤어·메이크업 연결도 가능합니다.</p>
            <h5>6) 도착 권장 시간</h5>
            <p>촬영 시작 10~15분 전 도착을 권장드립니다. 지각 시 다음 일정에 따라 촬영 구성이 일부 조정될 수 있습니다.</p>
            <h5>7) 촬영 진행 방식</h5>
            <p>포즈, 표정, 시선은 모두 디렉션해 드리며, 핵심 컷부터 디테일 컷 순으로 자연스럽게 진행합니다.</p>
            <h5>8) 결과물/보정 안내</h5>
            <p>밝은 톤 또는 무드 톤으로 맞춤 보정해 드리며, 제공 장수와 원본 제공 여부는 예약하신 패키지 기준으로 진행됩니다.</p>
          ` : `
            <p>Please share references, outfit tones, and location flow before the shoot.</p>
            <ul>
              <li>1–5 reference images are helpful.</li>
              <li>Two outfits are recommended.</li>
              <li>Please arrive 10–15 minutes early.</li>
            </ul>
          `}
        </div>
      </section>
    `);
  }

  if (product.g === 'biz') {
    const business = state.quote || getBusinessSelection();
    sections.push(`
      <section class="result-guide-box">
        <h4 class="result-guide-title">${isKo ? '📸 기업/행사 촬영 안내' : 'Corporate / Event Booking Guide'}</h4>
        <div class="result-guide-body">
          ${isKo ? `
            <p><b>${escapeHtml(business.businessLabel || business.label || '')}</b> 기준으로 예약이 접수되었습니다.</p>
            <h5>제공 방식</h5>
            <ul>
              <li>행사 사진은 촬영 시간별 투명한 가격으로 진행되며 JPG 원본과 기본 색보정본이 제공됩니다.</li>
              <li>행사 영상은 촬영만 / 기본 편집 / 풀 편집 중 선택하신 기준으로 진행됩니다.</li>
              <li>SNS 숏폼, 긴급 납품, 자막/로고/BGM 요청은 행사 목적과 일정에 따라 개별 검토 후 안내드립니다.</li>
            </ul>
            <h5>예약 후 진행</h5>
            <ul>
              <li>행사 목적, 시작/종료 시간, 장소, 예상 인원, 필요한 결과물을 기준으로 최종 내용을 확인합니다.</li>
              <li>필요 시 이메일 또는 전화로 동선, 납품 일정, 추가 요청을 다시 조율합니다.</li>
              <li>긴급 납품이나 브랜드 삽입 요청은 확정 메일에서 최종 비용과 가능 여부를 안내드립니다.</li>
            </ul>
          ` : `
            <p><b>${escapeHtml(business.businessLabel || business.label || '')}</b> has been requested.</p>
            <ul>
              <li>We will review the event purpose, timeline, deliverables, and any optional requests.</li>
              <li>SNS short-form, rush delivery, and branding requests are confirmed after internal review.</li>
              <li>We may contact you again to coordinate timing, location flow, and delivery expectations.</li>
            </ul>
          `}
        </div>
      </section>
    `);
  }

  if (hasBabyBirthday && (product.g === 'stud' || product.g === 'snap' || product.g === 'prof')) {
    sections.push(`
      <section class="result-guide-box">
        <h4 class="result-guide-title">${isKo ? '🎂 돌상 무료 셋팅 안내' : 'Baby / Birthday Setup Guide'}</h4>
        <div class="result-guide-body">
          ${isKo ? `
            <p>돌상은 기본 구성으로 무료 셋팅해 드립니다. 기본 셋팅은 촬영용 연출 목적이며 음식 제공이나 식사 형태의 돌잔치는 포함되지 않습니다.</p>
            <h5>포함 항목</h5>
            <ul>
              <li>돌상 테이블 기본 구성 및 소품 연출</li>
              <li>배경과 톤에 맞춘 기본 배치</li>
            </ul>
            <h5>준비해 오시면 좋은 항목</h5>
            <ul>
              <li>아기 한복/의상, 신발, 머리띠/헤어 소품</li>
              <li>원하실 경우 떡, 케이크, 과일 같은 실제 음식</li>
              <li>돌잡이 소품이나 의미 있는 개인 소품</li>
            </ul>
            <h5>사전 요청 및 유의사항</h5>
            <ul>
              <li>원하시는 스타일이 있다면 참고 이미지 1~3장을 미리 보내주세요.</li>
              <li>특정 색감/테마가 있으면 예약 시 알려주시면 맞춰 준비합니다.</li>
              <li>특수 테마, 대형 장식, 풍선/꽃장식, 맞춤 제작 소품은 추가 비용이 발생할 수 있습니다.</li>
              <li>셋팅을 위해 촬영 당일 10분 일찍 도착해 주시면 좋습니다.</li>
            </ul>
          ` : `
            <p>A simple birthday setup is included for baby / birthday sessions. Please share reference images in advance if you have a specific theme in mind.</p>
          `}
        </div>
      </section>
    `);
  }

  sections.push(`
    <section class="result-guide-box">
      <h4 class="result-guide-title">${isKo ? '오시는 길 / 주차 안내' : 'Arrival & Parking'}</h4>
      <div class="result-guide-body">
        ${isKo ? `
          <p><b>주소:</b> Holzweg-passage 3, 61440 Oberursel<br><a href="https://maps.app.goo.gl/pVtCh1R4WWGUMfD67?g_st=com.google.maps.preview.copy" target="_blank" rel="noreferrer">Google Maps 열기</a></p>
          <p>도착하시면 2층에 스튜디오가 있습니다. <b>ALIN / Das Boots</b> 간판 밑 문으로 들어오셔서 계단을 올라오시면 됩니다. 찾기 어려우시면 연락 주세요.</p>
          <p><b>주차 안내</b><br>전용 주차장은 없으며 주변 길가 또는 파크하우스를 이용해 주세요.</p>
          <ul>
            <li><a href="https://maps.app.goo.gl/6JTrYv5p7cSSy5oY7?g_st=com.google.maps.preview.copy" target="_blank" rel="noreferrer">City Parkhaus</a></li>
            <li><a href="https://maps.app.goo.gl/AW4qzE7b9RmnnzZJ8?g_st=com.google.maps.preview.copy" target="_blank" rel="noreferrer">Parkhaus Altstadt</a></li>
            <li><a href="https://maps.app.goo.gl/S7zA3hEstWqhGhkUA" target="_blank" rel="noreferrer">Rathausparkplatz</a></li>
          </ul>
        ` : `
          <p>Holzweg-passage 3, 61440 Oberursel<br><a href="https://maps.app.goo.gl/pVtCh1R4WWGUMfD67?g_st=com.google.maps.preview.copy" target="_blank" rel="noreferrer">Open in Google Maps</a></p>
          <p>The studio is on the 2nd floor under the ALIN / Das Boots sign. There is no dedicated parking lot nearby.</p>
        `}
      </div>
    </section>
  `);

  return `<div class="result-guide-stack">${sections.join('')}</div>`;
}

function renderSubmitResult(payload, result) {
  const copy = getCopy();
  const totalPrice = result?.quote?.totalPrice ?? getEstimatedPrice();
  const returnNote = result?.isReturn ? `<div class="result-note">${escapeHtml(copy.submitCardReturn)}</div>` : '';
  const successGuideHtml = getSuccessGuideHtml(payload);
  els.hero?.classList.add('hidden-step');
  Object.values(els.stepPanels).forEach((panel) => panel?.classList.add('hidden-step'));
  els.successPanel?.classList.remove('hidden-step');
  els.resultBox.hidden = false;
  els.resultBox.innerHTML = `
    <h3>${escapeHtml(copy.submitCardTitle)}</h3>
    <p>${escapeHtml(copy.submitCardCopy)}</p>
    <div class="result-grid">
      <div class="result-item">
        <strong>${escapeHtml(copy.submitCardName)}</strong>
        <span>${escapeHtml(payload.name)}</span>
      </div>
      <div class="result-item">
        <strong>${escapeHtml(copy.submitCardEmail)}</strong>
        <span>${escapeHtml(payload.email)}</span>
      </div>
      <div class="result-item">
        <strong>${escapeHtml(copy.submitCardDateTime)}</strong>
        <span>${escapeHtml(`${payload.date} ${payload.time}`)}</span>
      </div>
      <div class="result-item">
        <strong>${escapeHtml(copy.submitCardProduct)}</strong>
        <span>${escapeHtml(getProductLabel(state.selectedProduct))}</span>
      </div>
      <div class="result-item">
        <strong>${escapeHtml(copy.submitCardPrice)}</strong>
        <span>${escapeHtml(`€${totalPrice}`)}</span>
      </div>
    </div>
    ${returnNote}
    <div class="result-note">${escapeHtml(copy.submitCardNote)}</div>
    ${successGuideHtml}
    <div class="result-actions">
      <button type="button" id="resultResetBtn" class="result-action-btn">${escapeHtml(copy.submitCardAction)}</button>
    </div>
  `;
  document.getElementById('resultResetBtn')?.addEventListener('click', resetBookingFlow);
}
