import { fetchCalendarBatch, fetchInitData, fetchQuote, fetchReturnEligibility, fetchSlots, submitBooking } from '../shared/api-booking.js';
import { createRequestId, escapeHtml, formatMonthLabel, pad2 } from '../shared/utils.js';

const LANG_STORAGE_KEY = 'studio-mean-lang';
const SUPPORTED_LANGS = new Set(['ko', 'en', 'de']);

function trimPromoDate(dateStr) {
  return String(dateStr || '').trim().slice(0, 10);
}

function readStoredLang() {
  try {
    const saved = globalThis.localStorage?.getItem(LANG_STORAGE_KEY) || 'ko';
    return SUPPORTED_LANGS.has(saved) ? saved : 'ko';
  } catch {
    return 'ko';
  }
}

function persistLang(lang) {
  try {
    globalThis.localStorage?.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore storage errors and keep runtime language in memory.
  }
}

const COUNTRY_OPTIONS = [
  { code: 'KR', flag: '🇰🇷', label: { ko: '한국', en: 'Korea', de: 'Korea' } },
  { code: 'DE', flag: '🇩🇪', label: { ko: '독일', en: 'Germany', de: 'Deutschland' } },
  { code: 'JP', flag: '🇯🇵', label: { ko: '일본', en: 'Japan', de: 'Japan' } },
  { code: 'CN', flag: '🇨🇳', label: { ko: '중국', en: 'China', de: 'China' } },
  { code: 'US', flag: '🇺🇸', label: { ko: '미국', en: 'USA', de: 'USA' } },
  { code: 'OTHER', flag: '🌐', label: { ko: '기타', en: 'Other', de: 'Andere' } }
];

const GROUP_META = {
  pass: {
    icon: '🛂',
    label: { ko: '여권/비자', en: 'Passport / Visa', de: 'Pass / Visum' },
    sub: {
      ko: '한국 여권, 독일 E-passbild, 해외 비자 사진',
      en: 'Korean passport, German E-passbild, visa photos',
      de: 'Koreanischer Pass, deutsches E-Passbild, Visafotos'
    }
  },
  prof: {
    icon: '👤',
    label: { ko: '프로필', en: 'Profile', de: 'Profil' },
    sub: {
      ko: '개인 프로필, 키즈, 시니어, 백일/돌 촬영',
      en: 'Personal profile, kids, senior, baby sessions',
      de: 'Persönliche Profile, Kinder, Senioren, Baby-Shootings'
    }
  },
  stud: {
    icon: '📸',
    label: { ko: '스튜디오', en: 'Studio', de: 'Studio' },
    sub: {
      ko: '가족, 커플, 그룹, 돌상 포함 스튜디오 촬영',
      en: 'Studio shoots for family, couple, group, birthday setup',
      de: 'Studio-Shootings für Familie, Paar, Gruppe, Geburtstag'
    }
  },
  snap: {
    icon: '🌿',
    label: { ko: '야외스냅', en: 'Outdoor', de: 'Outdoor' },
    sub: {
      ko: '야외 인물, 커플, 가족, 백일/돌 스냅',
      en: 'Outdoor portraits, couples, families, baby sessions',
      de: 'Outdoor-Porträts, Paare, Familien, Baby-Sessions'
    }
  },
  wed: {
    icon: '💍',
    label: { ko: '프리웨딩', en: 'Pre-Wedding', de: 'Pre-Wedding' },
    sub: {
      ko: '야외 프리웨딩, 커플 컨셉 촬영',
      en: 'Outdoor pre-wedding and couple concept shoots',
      de: 'Outdoor Pre-Wedding und Couple-Konzept-Shootings'
    }
  },
  biz: {
    icon: '🎬',
    label: { ko: '기업/행사', en: 'Corporate / Event', de: 'Firma / Event' },
    sub: {
      ko: '돌잔치촬영, 결혼식, 암트결혼식, 기업행사',
      en: 'Birthday party, wedding, registry wedding, corporate event',
      de: 'Geburtstagsfeier, Hochzeit, Standesamt, Firmenevent'
    }
  }
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
    noticeTitle: '공지사항',
    promoHighlightEyebrow: 'Special Event',
    promoHighlightTitle: '가정의 달 이벤트',
    promoHighlightBody(names) {
      return names
        ? `${names} 예약을 전용 이벤트 페이지에서 바로 진행하실 수 있습니다.`
        : '현재 진행 중인 이벤트를 전용 이벤트 페이지에서 확인하고 예약하실 수 있습니다.';
    },
    promoHighlightState: '예약 진행 중',
    promoHighlightNamesLabel: '이벤트',
    promoHighlightPeriodLabel: '기간',
    promoHighlightButton: '이벤트 예약 바로가기',
    promoHighlightButtonSub: '기간 한정 이벤트 전용 페이지로 이동',
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
    passportCopy: '원하는 촬영국가와 인원 구성을 추가하면 국가별 추가 비용이 함께 반영됩니다.',
    passportHint: '기본 1개 국가는 포함되며, 추가 국가는 1개당 €5가 반영됩니다.',
    passportPeopleLabel: '인원수',
    passportConfigLabel: '구성 {index}',
    passportConfigAdd: '구성 추가하기',
    passportCountryLabel: '원하는 촬영국가 선택',
    generalPeopleLabel: '인원',
    ageFieldLabel: '촬영 대상 연령',
    ageFieldHint: '영유아(만 0~2세) · 키즈(만 3~13세) · 성인(만 14~69세) · 시니어(만 70세 이상)',
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
    businessInvoiceLabel: '사업자용 인보이스 필요',
    businessInvoiceSub: '기업/프리랜서/기관 명의의 송장이 필요한 경우에만 체크해 주세요.',
    businessInvoiceFieldsTitle: '기업 송장 정보',
    businessInvoiceFieldsCopy: '기존 예약 정보는 그대로 두고, 송장 발행에 필요한 정보만 추가로 입력합니다.',
    businessCompanyNameLabel: '사업자명 / 회사명',
    businessInvoiceEmailLabel: '송장 수신 이메일',
    businessCompanyAddressLabel: '사업자 주소',
    businessVatIdLabel: 'USt-IdNr. / VAT ID',
    businessInvoiceRefLabel: '주문번호 / 참조번호',
    payerNameLabel: '입금자명 (계좌이체 시)',
    babyNameLabel: '아기 이름',
    otherCountryLabel: '기타 국가명',
    memoLabel: '요청사항',
    consentTitle: '이용 동의',
    consentCopy: '가장 위의 전체 선택으로 필수 항목을 한 번에 체크할 수 있습니다.',
    requiredConsentLabel: '필수 동의',
    optionalConsentLabel: '선택 동의',
    selectAllLabel: '필수 항목 전체 선택',
    selectAllSub: '개인정보 및 AI 필수 항목을 한 번에 체크합니다.',
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
    reviewBusinessInvoice: '사업자용 인보이스',
    reviewBusinessCompanyName: '사업자명',
    reviewBusinessInvoiceEmail: '송장 이메일',
    reviewBusinessCompanyAddress: '사업자 주소',
    reviewBusinessVatId: 'VAT 번호',
    reviewBusinessInvoiceRef: '참조번호',
    reviewPayerName: '입금자명',
    reviewOptions: '추가 옵션',
    reviewSurvey: '원하는 분위기',
    reviewLocation: '촬영 장소',
    reviewBusiness: '행사 상세',
    reviewBusinessPackage: '행사 패키지',
    reviewMemo: '요청사항',
    reviewMarketing: '마케팅 동의',
    countryRequired: '촬영 국가를 최소 1개 선택해 주세요.',
    locationRequired: '희망 촬영 장소를 입력해 주세요.',
    businessInvoiceRequired: '사업자용 인보이스를 선택한 경우 사업자명과 사업자 주소를 입력해 주세요.',
    businessInvoiceEmailInvalid: '송장 수신 이메일 형식을 확인해 주세요.',
    consentRequired: '필수 동의 항목을 체크해 주세요.',
    slotLoadingForDate: '{date} 기준 예약 가능 시간을 불러오는 중입니다.',
    slotLoadedForDate: '{date} 기준 예약 가능 시간입니다.',
    slotFailForDate: '{date} 기준 예약 가능 시간 조회에 실패했습니다.',
    initFail: '초기화 실패',
    yes: '동의',
    no: '미동의',
    holidayNotice: '설정된 휴무일과 마감된 일정은 달력에서 자동으로 선택 불가 처리됩니다.',
    holidayListLabel: '예정 휴무일'
  },
  en: {
    heroTitle: 'Book Your Session',
    hero: 'Choose your shoot type and schedule, then enter your booking details.',
    loadingCopy: 'Preparing the booking page.',
    noticeTitle: 'Notice',
    promoHighlightEyebrow: 'Special Event',
    promoHighlightTitle: 'Family Month Promotion',
    promoHighlightBody(names) {
      return names
        ? `You can view and book ${names} directly on the event page.`
        : 'You can view the current special event and book it directly on the event page.';
    },
    promoHighlightState: 'Now Booking',
    promoHighlightNamesLabel: 'Events',
    promoHighlightPeriodLabel: 'Period',
    promoHighlightButton: 'Book the event now',
    promoHighlightButtonSub: 'Open the limited promotion page',
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
    passportCopy: 'Add each country and people combination to reflect the correct passport / visa quote.',
    passportHint: 'One country is included. Each additional country adds €5.',
    passportPeopleLabel: 'People',
    passportConfigLabel: 'Configuration {index}',
    passportConfigAdd: 'Add another configuration',
    passportCountryLabel: 'Choose desired countries',
    generalPeopleLabel: 'People',
    ageFieldLabel: 'Age Group',
    ageFieldHint: 'Infant (0-2) · Kids (3-13) · Adult (14-69) · Senior (70+)',
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
    businessInvoiceLabel: 'Business invoice needed',
    businessInvoiceSub: 'Check this only if the invoice should be issued to a company, freelancer, or organization.',
    businessInvoiceFieldsTitle: 'Business invoice details',
    businessInvoiceFieldsCopy: 'Your booking details stay the same. Add only the information needed for invoice issuing.',
    businessCompanyNameLabel: 'Company name',
    businessInvoiceEmailLabel: 'Invoice email',
    businessCompanyAddressLabel: 'Company address',
    businessVatIdLabel: 'USt-IdNr. / VAT ID',
    businessInvoiceRefLabel: 'PO / reference number',
    payerNameLabel: 'Payer name (bank transfer)',
    babyNameLabel: 'Baby Name',
    otherCountryLabel: 'Other Country',
    memoLabel: 'Notes',
    consentTitle: 'Consent',
    consentCopy: 'Use the first option to check all required items at once before submitting.',
    requiredConsentLabel: 'Required',
    optionalConsentLabel: 'Optional',
    selectAllLabel: 'Select all required items',
    selectAllSub: 'Checks the personal data and AI consent items together.',
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
    reviewBusinessInvoice: 'Business invoice',
    reviewBusinessCompanyName: 'Company name',
    reviewBusinessInvoiceEmail: 'Invoice email',
    reviewBusinessCompanyAddress: 'Company address',
    reviewBusinessVatId: 'VAT ID',
    reviewBusinessInvoiceRef: 'Reference',
    reviewPayerName: 'Payer name',
    reviewOptions: 'Add-ons',
    reviewSurvey: 'Preferred mood',
    reviewLocation: 'Location',
    reviewBusiness: 'Event details',
    reviewBusinessPackage: 'Event package',
    reviewMemo: 'Notes',
    reviewMarketing: 'Marketing',
    countryRequired: 'Please choose at least one country.',
    locationRequired: 'Please enter your preferred shooting location.',
    businessInvoiceRequired: 'Please enter the company name and company address for a business invoice.',
    businessInvoiceEmailInvalid: 'Please check the invoice email format.',
    consentRequired: 'Please check the required consent items.',
    slotLoadingForDate: 'Loading available times for {date}.',
    slotLoadedForDate: 'Available times for {date}.',
    slotFailForDate: 'Failed to load available times for {date}.',
    initFail: 'Initialization failed',
    yes: 'Agreed',
    no: 'Not agreed',
    holidayNotice: 'Configured holidays and blocked dates are automatically disabled in the calendar.',
    holidayListLabel: 'Upcoming closed dates'
  },
  de: {
    heroTitle: 'Termin buchen',
    hero: 'Wählen Sie zuerst die gewünschte Aufnahmeart und den Termin, danach geben Sie Ihre Buchungsdaten ein.',
    loadingCopy: 'Buchungsseite wird vorbereitet.',
    noticeTitle: 'Hinweis',
    promoHighlightEyebrow: 'Special Event',
    promoHighlightTitle: 'Familienmonat Aktion',
    promoHighlightBody(names) {
      return names
        ? `${names} können direkt über die Event-Seite angesehen und gebucht werden.`
        : 'Die aktuelle Spezialaktion kann direkt über die Event-Seite angesehen und gebucht werden.';
    },
    promoHighlightState: 'Jetzt buchbar',
    promoHighlightNamesLabel: 'Events',
    promoHighlightPeriodLabel: 'Zeitraum',
    promoHighlightButton: 'Event jetzt buchen',
    promoHighlightButtonSub: 'Zur zeitlich begrenzten Aktionsseite wechseln',
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
    passportCopy: 'Fügen Sie Land- und Personenkombinationen hinzu, damit das Angebot korrekt berechnet wird.',
    passportHint: 'Ein Land ist inklusive. Jedes weitere Land kostet €5 extra.',
    passportPeopleLabel: 'Personenzahl',
    passportConfigLabel: 'Konfiguration {index}',
    passportConfigAdd: 'Weitere Konfiguration hinzufügen',
    passportCountryLabel: 'Gewünschte Aufnahmeländer',
    generalPeopleLabel: 'Personen',
    ageFieldLabel: 'Altersgruppe',
    ageFieldHint: 'Säugling (0-2) · Kinder (3-13) · Erwachsene (14-69) · Senioren (ab 70)',
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
    businessInvoiceLabel: 'Geschäftsrechnung erforderlich',
    businessInvoiceSub: 'Nur ankreuzen, wenn die Rechnung auf eine Firma, freiberufliche Tätigkeit oder Organisation ausgestellt werden soll.',
    businessInvoiceFieldsTitle: 'Angaben für Geschäftsrechnung',
    businessInvoiceFieldsCopy: 'Die Buchungsdaten bleiben unverändert. Bitte nur die für die Rechnung nötigen Angaben ergänzen.',
    businessCompanyNameLabel: 'Firmenname',
    businessInvoiceEmailLabel: 'E-Mail für Rechnung',
    businessCompanyAddressLabel: 'Firmenadresse',
    businessVatIdLabel: 'USt-IdNr. / VAT ID',
    businessInvoiceRefLabel: 'Bestell- / Referenznummer',
    payerNameLabel: 'Name des Kontoinhabers (Überweisung)',
    babyNameLabel: 'Babyname',
    otherCountryLabel: 'Anderes Land',
    memoLabel: 'Hinweise',
    consentTitle: 'Einwilligung',
    consentCopy: 'Mit der ersten Option können alle Pflichtangaben auf einmal bestätigt werden.',
    requiredConsentLabel: 'Pflicht',
    optionalConsentLabel: 'Optional',
    selectAllLabel: 'Alle Pflichtangaben auswählen',
    selectAllSub: 'Bestätigt Datenschutz und KI-Hinweis zusammen.',
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
    reviewBusinessInvoice: 'Geschäftsrechnung',
    reviewBusinessCompanyName: 'Firmenname',
    reviewBusinessInvoiceEmail: 'Rechnungs-E-Mail',
    reviewBusinessCompanyAddress: 'Firmenadresse',
    reviewBusinessVatId: 'VAT-ID',
    reviewBusinessInvoiceRef: 'Referenz',
    reviewPayerName: 'Kontoinhaber',
    reviewOptions: 'Optionen',
    reviewSurvey: 'Stimmung',
    reviewLocation: 'Aufnahmeort',
    reviewBusiness: 'Eventdetails',
    reviewBusinessPackage: 'Event-Paket',
    reviewMemo: 'Hinweise',
    reviewMarketing: 'Marketing',
    countryRequired: 'Bitte wählen Sie mindestens ein Land aus.',
    locationRequired: 'Bitte geben Sie den gewünschten Aufnahmeort ein.',
    businessInvoiceRequired: 'Bitte geben Sie Firmenname und Firmenadresse für die Geschäftsrechnung ein.',
    businessInvoiceEmailInvalid: 'Bitte prüfen Sie das Format der Rechnungs-E-Mail.',
    consentRequired: 'Bitte bestätigen Sie die Pflicht-Einwilligungen.',
    slotLoadingForDate: 'Verfügbare Zeiten für {date} werden geladen.',
    slotLoadedForDate: 'Verfügbare Zeiten für {date}.',
    slotFailForDate: 'Verfügbare Zeiten für {date} konnten nicht geladen werden.',
    initFail: 'Initialisierung fehlgeschlagen',
    yes: 'Zustimmung',
    no: 'Keine Zustimmung',
    holidayNotice: 'Eingestellte Ruhetage und gesperrte Termine werden im Kalender automatisch deaktiviert.',
    holidayListLabel: 'Kommende Ruhetage'
  }
};

const state = {
  init: null,
  lang: readStoredLang(),
  selectedGroup: '',
  selectedProduct: null,
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  selectedDate: '',
  selectedSlot: '',
  selectedCountries: [],
  passportConfigs: [],
  passportPersonCountries: [],
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
  calendarWarmupStarted: false,
  calendarWarmupInFlight: new Set(),
  quote: null,
  calendarCache: new Map(),
  slotCache: new Map()
};

const els = {
  shell: document.querySelector('.shell'),
  hero: document.querySelector('.hero'),
  heroTitle: document.getElementById('heroTitle'),
  banner: document.getElementById('statusBanner'),
  noticePanel: document.getElementById('noticePanel'),
  noticeTitle: document.getElementById('noticeTitle'),
  noticeBody: document.getElementById('noticeBody'),
  noticeMeta: document.getElementById('noticeMeta'),
  promoHighlightPanel: document.getElementById('promoHighlightPanel'),
  promoHighlightEyebrow: document.getElementById('promoHighlightEyebrow'),
  promoHighlightTitle: document.getElementById('promoHighlightTitle'),
  promoHighlightBody: document.getElementById('promoHighlightBody'),
  promoHighlightState: document.getElementById('promoHighlightState'),
  promoHighlightNames: document.getElementById('promoHighlightNames'),
  promoHighlightPeriod: document.getElementById('promoHighlightPeriod'),
  promoHighlightButton: document.getElementById('promoHighlightButton'),
  promoHighlightButtonSub: document.getElementById('promoHighlightButtonSub'),
  heroLead: document.getElementById('heroLead'),
  loadingCopy: document.getElementById('loadingCopy'),
  groupHelp: document.getElementById('groupHelp'),
  groupGrid: document.getElementById('groupGrid'),
  productHelp: document.getElementById('productHelp'),
  productGrid: document.getElementById('productGrid'),
  productDetail: document.getElementById('productDetail'),
  passportPanel: document.getElementById('passportPanel'),
  passportCountries: document.getElementById('passportCountries'),
  passportAddConfigBtn: document.getElementById('passportAddConfigBtn'),
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
  generalPeopleCustom: document.getElementById('generalPeopleCustom'),
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
  addressField: document.getElementById('addressField'),
  businessInvoiceFields: document.getElementById('businessInvoiceFields'),
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
  payerNameField: document.getElementById('payerNameField'),
  submitBtn: document.getElementById('submitBtn'),
  stepWarnings: {
    step1: document.getElementById('step1Warning'),
    step2: document.getElementById('step2Warning'),
    step3: document.getElementById('step3Warning'),
    step5: document.getElementById('step5Warning')
  },
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
    refreshStepLocks();
    renderNoticePanel();
    renderPromoHighlightPanel();
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
    if (state.selectedProduct.g === 'pass' && !hasPassportCountrySelections()) {
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
  els.form.elements.businessInvoiceNeeded?.addEventListener('change', () => {
    syncConditionalFields();
    renderReview();
    refreshStepLocks();
  });
  ['businessCompanyName', 'businessCompanyAddress', 'businessVatId', 'businessInvoiceEmail', 'businessInvoiceRef'].forEach((fieldName) => {
    els.form.elements[fieldName]?.addEventListener('input', () => { renderReview(); refreshStepLocks(); });
  });
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
  els.passportAddConfigBtn?.addEventListener('click', () => {
    syncPassportConfigs();
    state.passportConfigs.push(createDefaultPassportConfig());
    renderPassportCountries();
    handleQuoteInputChange();
  });
  els.generalPeople.addEventListener('change', () => {
    els.generalPeopleCustom?.classList.toggle('hidden-field', els.generalPeople.value !== 'custom');
    handleQuoteInputChange();
  });
  els.generalPeopleCustom?.addEventListener('input', handleQuoteInputChange);
  els.passAddonToggle?.addEventListener('change', () => {
    els.passAddonPeopleField?.classList.toggle('hidden-field', !els.passAddonToggle.checked);
    handleQuoteInputChange();
  });
  els.passAddonPeople?.addEventListener('change', handleQuoteInputChange);
  els.langButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.lang) setLang(button.dataset.lang);
    });
  });
}

function getCopy() {
  return COPY[state.lang] || COPY.ko;
}

function setLang(lang) {
  if (!SUPPORTED_LANGS.has(lang)) return;
  state.lang = lang;
  persistLang(lang);
  els.langButtons.forEach((item) => item.classList.toggle('active', item.dataset.lang === lang));
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
}

function createDefaultPassportConfig(defaultCountries = []) {
  return { countries: [...defaultCountries], people: 1 };
}

function syncPassportConfigs() {
  if (!Array.isArray(state.passportConfigs) || !state.passportConfigs.length) {
    state.passportConfigs = [createDefaultPassportConfig(['KR'])];
  }
  state.passportConfigs = state.passportConfigs.map((config, index) => {
    const countries = Array.isArray(config?.countries) ? config.countries.filter(Boolean) : [];
    const people = Math.max(1, Number(config?.people || 1));
    if (index === 0 && !countries.length) return { countries: ['KR'], people };
    return { countries, people };
  });
}

function getPassportPeopleCount() {
  syncPassportConfigs();
  return state.passportConfigs.reduce((sum, config) => sum + Number(config.people || 1), 0);
}

function getSelectedPeopleValue(selectEl, inputEl, fallback = 1) {
  const selected = String(selectEl?.value || fallback);
  if (selected === 'custom') {
    const custom = Math.max(6, Number(inputEl?.value || 6));
    return Number.isFinite(custom) ? custom : 6;
  }
  const parsed = Number(selected || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function syncPassportPersonCountries() {
  syncPassportConfigs();
  state.passportPersonCountries = state.passportConfigs.flatMap((config) =>
    Array.from({ length: Math.max(1, Number(config.people || 1)) }, () => [...config.countries])
  );
  state.selectedCountries = [
    ...new Set(
      state.passportPersonCountries.flatMap((codes) => Array.isArray(codes) ? codes.filter(Boolean) : [])
    )
  ];
}

function hasPassportCountrySelections() {
  if (state.selectedProduct?.g !== 'pass') return true;
  syncPassportConfigs();
  return state.passportConfigs.every((config) => Array.isArray(config.countries) && config.countries.length > 0);
}

function getPassportCountryReviewLabel() {
  syncPassportConfigs();
  return state.passportConfigs.map((config) => {
    const label = (Array.isArray(config.countries) ? config.countries : [])
      .map((code) => {
        const item = COUNTRY_OPTIONS.find((entry) => entry.code === code);
        return item ? (item.label[state.lang] || item.label.ko) : code;
      })
      .join(' + ');
    return state.lang === 'en'
      ? `${config.people} ${config.people > 1 ? 'people' : 'person'}: ${label}`
      : state.lang === 'de'
        ? `${config.people} ${config.people > 1 ? 'Personen' : 'Person'}: ${label}`
        : `${config.people}명: ${label}`;
  }).join(' / ');
}

function buildPassportMemoPrefix() {
  if (state.selectedProduct?.g !== 'pass') return '';
  syncPassportConfigs();
  const rows = state.passportConfigs.map((config) => {
    const label = (Array.isArray(config.countries) ? config.countries : [])
      .map((code) => {
        const item = COUNTRY_OPTIONS.find((entry) => entry.code === code);
        return item ? (item.label.ko || item.label.en || code) : code;
      })
      .join('+');
    return `${config.people}명:${label}`;
  }).join(', ');
  return rows ? `[국가별 신청] ${rows}` : '';
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

function getBusinessInvoiceFormData(source = null) {
  const formData = source instanceof FormData ? source : new FormData(els.form);
  return {
    needed: formData.get('businessInvoiceNeeded') === 'on',
    companyName: String(formData.get('businessCompanyName') || '').trim(),
    companyAddress: String(formData.get('businessCompanyAddress') || '').trim(),
    vatId: String(formData.get('businessVatId') || '').trim(),
    invoiceEmail: String(formData.get('businessInvoiceEmail') || '').trim(),
    reference: String(formData.get('businessInvoiceRef') || '').trim()
  };
}

function applyCopy() {
  const copy = getCopy();
  if (els.heroTitle) els.heroTitle.textContent = copy.heroTitle;
  if (els.noticeTitle) els.noticeTitle.textContent = copy.noticeTitle;
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
  setText('passportCountryLabel', copy.passportCountryLabel);
  setText('passportAddConfigBtn', copy.passportConfigAdd);
  setText('generalPeopleLabel', copy.generalPeopleLabel);
  setText('ageFieldLabel', copy.ageFieldLabel);
  setText('ageFieldHint', copy.ageFieldHint);
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
  setText('businessInvoiceLabel', copy.businessInvoiceLabel);
  setText('businessInvoiceSub', copy.businessInvoiceSub);
  setText('businessInvoiceFieldsTitle', copy.businessInvoiceFieldsTitle);
  setText('businessInvoiceFieldsCopy', copy.businessInvoiceFieldsCopy);
  setText('businessCompanyNameLabel', copy.businessCompanyNameLabel);
  setText('businessInvoiceEmailLabel', copy.businessInvoiceEmailLabel);
  setText('businessCompanyAddressLabel', copy.businessCompanyAddressLabel);
  setText('businessVatIdLabel', copy.businessVatIdLabel);
  setText('businessInvoiceRefLabel', copy.businessInvoiceRefLabel);
  setText('payerNameLabel', copy.payerNameLabel);
  setText('babyNameLabel', copy.babyNameLabel);
  setText('otherCountryLabel', copy.otherCountryLabel);
  setText('memoLabel', copy.memoLabel);
  setText('consentTitle', copy.consentTitle);
  setText('consentCopy', copy.consentCopy);
  setText('requiredConsentLabel', copy.requiredConsentLabel);
  setText('optionalConsentLabel', copy.optionalConsentLabel);
  setText('selectAllLabel', copy.selectAllLabel);
  setText('selectAllSub', copy.selectAllSub);
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
  renderNoticePanel();
  renderPromoHighlightPanel();
  syncConsentVisibility();
  syncSelectAllRequired();
  refreshBannerCopy();
}

function getLocalizedNoticeText() {
  const settings = state.init?.settings || {};
  if (state.lang === 'en') return String(settings.en || '').trim();
  if (state.lang === 'de') return String(settings.de || '').trim();
  return String(settings.ko || '').trim();
}

function renderNoticePanel() {
  if (!els.noticePanel || !els.noticeBody) return;
  const notice = getLocalizedNoticeText();
  if (!notice) {
    els.noticePanel.classList.add('hidden-field');
    els.noticeBody.innerHTML = '';
    return;
  }
  els.noticePanel.classList.remove('hidden-field');
  els.noticeBody.innerHTML = notice ? escapeHtml(notice).replace(/\n/g, '<br>') : '';
}

function getPromoOverrideCopy() {
  const override = state.init?.settings?.promoContent?.[state.lang];
  if (!override || typeof override !== 'object' || Array.isArray(override)) return null;
  return override;
}

function formatPromoDateLabel(dateStr) {
  const trimmed = trimPromoDate(dateStr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return '';
  if (state.lang === 'de') return trimmed.split('-').reverse().join('.');
  if (state.lang === 'ko') return trimmed.replaceAll('-', '.');
  return trimmed;
}

function formatPromoPeriodLabel(start, end) {
  const startLabel = formatPromoDateLabel(start);
  const endLabel = formatPromoDateLabel(end);
  if (!startLabel || !endLabel) return '';
  return `${startLabel} - ${endLabel}`;
}

function getPromoProductLabels() {
  const promoProducts = Array.isArray(state.init?.promoProducts) ? state.init.promoProducts : [];
  return promoProducts.map((item) => {
    if (state.lang === 'en') return String(item?.nameEn || item?.nameKo || '').trim();
    if (state.lang === 'de') return String(item?.nameDe || item?.nameKo || '').trim();
    return String(item?.nameKo || '').trim();
  }).filter(Boolean);
}

function renderPromoHighlightPanel() {
  if (!els.promoHighlightPanel) return;
  const settings = state.init?.settings || {};
  if (!settings.promoEnabled) {
    els.promoHighlightPanel.classList.add('hidden-field');
    return;
  }
  const copy = getCopy();
  const override = getPromoOverrideCopy();
  const productLabels = getPromoProductLabels();
  const eyebrow = String(override?.eyebrow || copy.promoHighlightEyebrow || '').trim();
  const title = String(override?.heroTitle || copy.promoHighlightTitle || '').trim();
  const lead = String(override?.heroLead || '').trim();
  const period = formatPromoPeriodLabel(settings.promoStart, settings.promoEnd);
  const defaultBody = typeof copy.promoHighlightBody === 'function'
    ? copy.promoHighlightBody(productLabels.join(' · '))
    : String(copy.promoHighlightBody || '').trim();

  if (els.promoHighlightEyebrow) els.promoHighlightEyebrow.textContent = eyebrow;
  if (els.promoHighlightTitle) els.promoHighlightTitle.textContent = title;
  if (els.promoHighlightBody) els.promoHighlightBody.textContent = lead || defaultBody;
  if (els.promoHighlightState) els.promoHighlightState.textContent = copy.promoHighlightState;
  if (els.promoHighlightButton) els.promoHighlightButton.textContent = copy.promoHighlightButton;
  if (els.promoHighlightButtonSub) els.promoHighlightButtonSub.textContent = copy.promoHighlightButtonSub;

  if (els.promoHighlightNames) {
    const hasNames = productLabels.length > 0;
    els.promoHighlightNames.classList.toggle('hidden-field', !hasNames);
    els.promoHighlightNames.textContent = hasNames
      ? `${copy.promoHighlightNamesLabel} · ${productLabels.join(' · ')}`
      : '';
  }

  if (els.promoHighlightPeriod) {
    const hasPeriod = !!period;
    els.promoHighlightPeriod.classList.toggle('hidden-field', !hasPeriod);
    els.promoHighlightPeriod.textContent = hasPeriod
      ? `${copy.promoHighlightPeriodLabel} · ${period}`
      : '';
  }

  els.promoHighlightPanel.classList.remove('hidden-field');
}

function refreshBannerCopy() {
  if (!els.banner) return;
  if (els.banner.classList.contains('error')) return;
  if (state.resultBox && !state.resultBox.hidden) return;
  if (els.banner.classList.contains('loading')) {
    setBanner(getCopy().loadCalendar, 'loading');
    return;
  }
  if (!state.selectedGroup) {
    setBanner(getCopy().initSuccess, 'success');
    return;
  }
  if (state.activeStep >= 3 && state.selectedProduct) {
    setBanner(getCopy().calendarLoaded, 'success');
    return;
  }
  setBanner(getCopy().initSuccess, 'success');
}

function renderPanelLoading(message) {
  return `
    <div class="panel-loading">
      <div class="panel-loading-copy">
        <div>${escapeHtml(message)}</div>
        <div class="panel-loading-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;
}

function setCalendarBusy(isBusy) {
  if (els.prevMonthBtn) els.prevMonthBtn.disabled = isBusy;
  if (els.nextMonthBtn) els.nextMonthBtn.disabled = isBusy;
}

function updateMonthNavAvailability() {
  const now = new Date();
  const minTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const currentTs = new Date(state.calendarYear, state.calendarMonth, 1).getTime();
  const maxTs = new Date(2026, 11, 1).getTime();
  if (els.prevMonthBtn) els.prevMonthBtn.disabled = !!els.prevMonthBtn.disabled || currentTs <= minTs;
  if (els.nextMonthBtn) els.nextMonthBtn.disabled = !!els.nextMonthBtn.disabled || currentTs >= maxTs;
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
  const optionalConsentGroup = document.getElementById('optionalConsentGroup');
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
  if (optionalConsentGroup) optionalConsentGroup.classList.toggle('hidden-field', isPass);
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
    const sub = meta.sub?.[state.lang] || meta.sub?.ko || '';
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
  renderStepWarnings();
}

function needsReshootingConsent(product = state.selectedProduct) {
  if (!product) return false;
  if (product.g === 'prof' && (state.ageGroup === 'kids' || state.ageGroup === 'baby')) return true;
  if (product.g === 'stud' && state.surveyKeys.includes('baby')) return true;
  return false;
}

function getMaxUnlockedStep() {
  const hasGroup = !!state.selectedGroup;
  const hasProduct = !!state.selectedProduct;
  const isPass = state.selectedProduct?.g === 'pass';
  const hasRequiredStep2 = !hasProduct ? false : (
    (isPass
      ? hasPassportCountrySelections() && (!state.selectedCountries.includes('OTHER') || !!String(els.form.elements.otherCountry?.value || '').trim())
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

function renderStepWarnings() {
  const product = state.selectedProduct;
  const isPass = product?.g === 'pass';
  const step1Message = state.selectedGroup ? '' : (
    state.lang === 'en'
      ? 'Choose the main shoot category to continue.'
      : state.lang === 'de'
        ? 'Wählen Sie zuerst die Hauptkategorie aus.'
        : '촬영 종류를 선택해야 다음으로 넘어갈 수 있습니다.'
  );
  let step2Message = '';
  if (state.selectedGroup && !product) {
    step2Message = state.lang === 'en'
      ? 'Choose a detailed package first.'
      : state.lang === 'de'
        ? 'Wählen Sie zuerst ein detailliertes Paket aus.'
        : '세부 상품을 모두 선택해야 다음 단계가 활성화됩니다.';
  } else if (isPass && !hasPassportCountrySelections()) {
    step2Message = getCopy().countryRequired;
  } else if (isPass && state.selectedCountries.includes('OTHER') && !String(els.form.elements.otherCountry?.value || '').trim()) {
    step2Message = state.lang === 'en'
      ? 'Enter the other country name.'
      : state.lang === 'de'
        ? 'Geben Sie den Namen des anderen Landes ein.'
        : '기타 국가명을 입력해야 합니다.';
  } else if ((product?.g === 'snap' || product?.g === 'wed') && !String(els.locationInput?.value || '').trim()) {
    step2Message = getCopy().locationRequired;
  } else if (product?.g === 'biz' && !String(els.businessInput?.value || '').trim()) {
    step2Message = state.lang === 'en'
      ? 'Enter event details to continue.'
      : state.lang === 'de'
        ? 'Geben Sie die Veranstaltungsdetails ein.'
        : '행사 상세 내용을 입력해야 다음으로 넘어갈 수 있습니다.';
  }

  let step3Message = '';
  if (!state.selectedDate) {
    step3Message = state.lang === 'en'
      ? 'Select an available date first.'
      : state.lang === 'de'
        ? 'Wählen Sie zuerst ein verfügbares Datum.'
        : '날짜를 선택해야 시간 선택이 완료됩니다.';
  } else if (!state.selectedSlot) {
    step3Message = state.lang === 'en'
      ? 'Select an available time to continue.'
      : state.lang === 'de'
        ? 'Wählen Sie eine verfügbare Uhrzeit aus.'
        : '예약 가능한 시간을 선택해야 다음 단계가 활성화됩니다.';
  }

  const formData = new FormData(els.form);
  const email = String(formData.get('email') || '').trim();
  const emailOk = /\S+@\S+\.\S+/.test(email);
  const gdprOk = formData.get('gdprConsent') === 'on';
  const aiOk = isPass ? true : formData.get('aiConsent') === 'on';
  const babyNameOk = !((product?.g === 'prof' && product?.id === 'pp' && state.ageGroup === 'baby') || state.surveyKeys.includes('baby')) || !!String(formData.get('babyName') || '').trim();
  const reshootingOk = !needsReshootingConsent(product) || !!els.reshootingConsent?.checked;
  let step5Message = '';
  if (!String(formData.get('name') || '').trim() || !String(formData.get('phone') || '').trim() || !email) {
    step5Message = state.lang === 'en'
      ? 'Fill in name, phone, and email to enable booking.'
      : state.lang === 'de'
        ? 'Name, Telefonnummer und E-Mail müssen ausgefüllt sein.'
        : '이름, 연락처, 이메일을 모두 입력해야 예약 제출이 활성화됩니다.';
  } else if (!emailOk) {
    step5Message = state.lang === 'en'
      ? 'Enter a valid email address.'
      : state.lang === 'de'
        ? 'Geben Sie eine gültige E-Mail-Adresse ein.'
        : '올바른 이메일 형식을 입력해 주세요.';
  } else if (!gdprOk || !aiOk) {
    step5Message = state.lang === 'en'
      ? 'Required consent items must be checked.'
      : state.lang === 'de'
        ? 'Die erforderlichen Zustimmungspunkte müssen aktiviert werden.'
        : '필수 동의 항목을 체크해야 예약 제출이 가능합니다.';
  } else if (!babyNameOk) {
    step5Message = state.lang === 'en'
      ? 'Enter the baby name for baby/first birthday sessions.'
      : state.lang === 'de'
        ? 'Geben Sie den Namen des Babys für 백일/돌 촬영 ein.'
        : '백일/돌 촬영은 아기 이름 입력이 필요합니다.';
  } else if (!reshootingOk) {
    step5Message = state.lang === 'en'
      ? 'Check the reshooting policy consent to continue.'
      : state.lang === 'de'
        ? 'Stimmen Sie der Richtlinie für erneute Aufnahmen zu.'
        : '재촬영 약관 동의가 필요합니다.';
  }

  if (els.stepWarnings.step1) els.stepWarnings.step1.textContent = step1Message;
  if (els.stepWarnings.step2) els.stepWarnings.step2.textContent = step2Message;
  if (els.stepWarnings.step3) els.stepWarnings.step3.textContent = step3Message;
  if (els.stepWarnings.step5) els.stepWarnings.step5.textContent = step5Message;
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
      syncConditionalFields();
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
  syncPassportPersonCountries();
  const passPersonCountries = item.g === 'pass' ? state.passportPersonCountries.map((codes) => [...codes]) : [];
  const passCountries = item.g === 'pass'
    ? [...new Set(passPersonCountries.flatMap((codes) => (Array.isArray(codes) ? codes : []).filter((code) => code && code !== 'OTHER')))]
    : [];
  const otherCountry = item.g === 'pass' ? String(els.form.elements.otherCountry?.value || '').trim() : '';
  const totalCountries = item.g === 'pass'
    ? passPersonCountries.reduce((sum, codes) => {
      const count = (Array.isArray(codes) ? codes : []).filter((code) => code && code !== 'OTHER').length;
      return sum + count;
    }, 0) + (otherCountry ? 1 : 0)
    : 0;
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

  if (item.t === 'passport') {
    total = passPersonCountries.reduce((sum, codes) => {
      const extra = Math.max(0, (Array.isArray(codes) ? codes : []).filter((code) => code && code !== 'OTHER').length - 1) * 5;
      return sum + Number(item.p || 0) + extra;
    }, 0);
    if (!passPersonCountries.length) total = item.p * people;
  }
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
    passPersonCountries,
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
    ? getPassportPeopleCount()
    : getSelectedPeopleValue(els.generalPeople, els.generalPeopleCustom, getDefaultPeopleForProduct(state.selectedProduct));
}

function getDefaultPeopleForProduct(product) {
  if (!product) return 1;
  if (product.g === 'stud' || product.g === 'snap') return 2;
  return 1;
}

function getPeopleOptionLabel(count, product) {
  const copy = getCopy();
  if (product?.t === 'snap' && count === 1) {
    return state.lang === 'en'
      ? '1 person (-€30)'
      : state.lang === 'de'
        ? '1 Person (-30€)'
        : '1명(-€30)';
  }
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
  const currentGeneralCount = getSelectedPeopleValue(els.generalPeople, els.generalPeopleCustom, Number(generalDefault));
  const addonValue = String(els.passAddonPeople?.value || '1');

  if (els.generalPeople) {
    els.generalPeople.innerHTML = [1, 2, 3, 4, 5]
      .map((count) => `<option value="${count}">${escapeHtml(getPeopleOptionLabel(count, product))}</option>`)
      .concat(`<option value="custom">${state.lang === 'en' ? '6+ people (enter manually)' : state.lang === 'de' ? 'Ab 6 Personen direkt eingeben' : '6명 이상 직접입력'}</option>`)
      .join('');
    if (currentGeneralCount > 5) {
      els.generalPeople.value = 'custom';
      if (els.generalPeopleCustom) {
        els.generalPeopleCustom.value = String(currentGeneralCount);
        els.generalPeopleCustom.classList.remove('hidden-field');
      }
    } else {
      els.generalPeople.value = String(currentGeneralCount);
      els.generalPeopleCustom?.classList.add('hidden-field');
    }
  }
  syncPassportPersonCountries();
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
      ? ['Studio mean, Holzwegpassage 3, 61440 Oberursel', 'The studio is on the 2nd floor under the ALIN / Das Boots sign.', 'There is no dedicated parking lot, so nearby street parking or Parkhaus options are recommended.']
      : state.lang === 'de'
        ? ['Studio mean, Holzwegpassage 3, 61440 Oberursel', 'Das Studio befindet sich im 2. Stock unter dem Schild ALIN / Das Boots.', 'Es gibt keinen eigenen Parkplatz. Straßenrand oder nahe Parkhäuser werden empfohlen.']
        : ['Studio mean, Holzweg-passage 3, 61440 Oberursel', '도착하시면 ALIN / Das Boots 간판 밑 문으로 들어오셔서 2층으로 올라오시면 됩니다.', '전용 주차장은 없으며 주변 길가 또는 파크하우스 이용을 추천드립니다.'];
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

function getCalendarWarmupTasks() {
  const products = (state.init?.products || []).filter(Boolean);
  const combos = new Map();
  products.forEach((product) => {
    if (!product?.g) return;
    const totalDur = Number(product.d || 0) + Number(product.prep || 0);
    const key = `${product.g}_${totalDur}`;
    if (!combos.has(key)) combos.set(key, { itemGroup: product.g, totalDur });
  });
  const base = new Date();
  const tasks = [];
  for (let offset = 0; offset < 4; offset += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    combos.forEach((combo) => {
      tasks.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        itemGroup: combo.itemGroup,
        totalDur: combo.totalDur
      });
    });
  }
  return tasks;
}

async function warmCalendarRange(tasks) {
  for (const task of tasks) {
    const key = `${task.year}_${task.month}_${task.itemGroup}_${task.totalDur}`;
    if (state.calendarCache.has(key) || state.calendarWarmupInFlight.has(key)) continue;
    state.calendarWarmupInFlight.add(key);
    try {
      await fetchAndStoreCalendarBatch(task.year, task.month, task.totalDur, task.itemGroup);
    } catch (error) {
      console.error(error);
    } finally {
      state.calendarWarmupInFlight.delete(key);
    }
  }
}

function startCalendarWarmup() {
  window.setTimeout(() => {
    const now = new Date();
    const warmGroups = [
      { g: 'stud', d: 60 },
      { g: 'prof', d: 45 },
      { g: 'pass', d: 30 }
    ];
    for (const { g, d } of warmGroups) {
      const key = `${now.getFullYear()}_${now.getMonth()}_${g}_${d}`;
      if (state.calendarCache.has(key) || state.calendarWarmupInFlight.has(key)) continue;
      state.calendarWarmupInFlight.add(key);
      fetchAndStoreCalendarBatch(now.getFullYear(), now.getMonth(), d, g)
        .catch(() => {})
        .finally(() => state.calendarWarmupInFlight.delete(key));
    }
  }, 1500);
}

async function warmSelectedProductCalendar(product, durationOverride) {
  if (!product) return;
  const totalDur = Number(durationOverride || Number(product.d || 0) + Number(product.prep || 0));
  const base = new Date();
  const currentMonth = new Date(base.getFullYear(), base.getMonth(), 1);
  const currentKey = `${currentMonth.getFullYear()}_${currentMonth.getMonth()}_${product.g}_${totalDur}`;
  if (!state.calendarCache.has(currentKey) && !state.calendarWarmupInFlight.has(currentKey)) {
    state.calendarWarmupInFlight.add(currentKey);
    try {
      await fetchAndStoreCalendarBatch(currentMonth.getFullYear(), currentMonth.getMonth(), totalDur, product.g);
    } catch (error) {
      console.error(error);
    } finally {
      state.calendarWarmupInFlight.delete(currentKey);
    }
  }

  const tasks = [];
  for (let offset = 1; offset <= 2; offset += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    tasks.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      itemGroup: product.g,
      totalDur
    });
  }
  window.setTimeout(() => {
    warmCalendarRange(tasks);
  }, 40);
}

const MONTH_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_BOOKING_MONTH = { year: 2026, month: 11 };

function getMonthStorageKey(year, month, itemGroup, duration) {
  return `booking:month:v2:${year}_${month}_${itemGroup}_${duration}`;
}

function readMonthStorage(year, month, itemGroup, duration) {
  try {
    const raw = window.localStorage.getItem(getMonthStorageKey(year, month, itemGroup, duration));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.savedAt || !parsed.data) return null;
    if (Date.now() - Number(parsed.savedAt) > MONTH_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeMonthStorage(year, month, itemGroup, duration, data) {
  try {
    window.localStorage.setItem(
      getMonthStorageKey(year, month, itemGroup, duration),
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    // Ignore storage quota / private mode errors.
  }
}

function selectGroup(groupKey) {
  clearSubmitResult();
  const groupProducts = (state.init?.products || []).filter((item) => item.g === groupKey);
  if (groupProducts.length === 1) {
    state.selectedGroup = groupKey;
    selectProduct(groupProducts[0].id);
    return;
  }
  state.selectedGroup = groupKey;
  state.activeStep = 2;
  state.selectedProduct = null;
  state.selectedDate = '';
  state.selectedSlot = '';
  state.quote = null;
  state.selectedCountries = [];
  state.passportConfigs = [];
  state.passportPersonCountries = [];
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
  els.generalPeopleCustom?.classList.add('hidden-field');
  els.generalPeopleCustom && (els.generalPeopleCustom.value = '');
  renderPeopleOptions();
  els.submitBtn.disabled = true;
  renderGroups();
  renderProducts(groupProducts);
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
    state.passportConfigs = [];
    state.passportPersonCountries = [];
  } else {
    state.passportConfigs = [createDefaultPassportConfig(['KR'])];
    syncPassportPersonCountries();
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
  els.generalPeopleCustom?.classList.add('hidden-field');
  els.generalPeopleCustom && (els.generalPeopleCustom.value = '');
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
  warmSelectedProductCalendar(state.selectedProduct, getCalendarDuration());
  refreshStepLocks();
  if (!state.selectedProduct) return;
  els.calendarHint.textContent = `${getProductLabel(state.selectedProduct)} · ${getCopy().calendarLoadedHint}`;
  setBanner(getCopy().initSuccess, 'success');
}

function renderPassportPanel() {
  const isPass = state.selectedProduct?.g === 'pass';
  els.passportPanel.classList.toggle('hidden', !isPass);
  if (isPass) {
    syncPassportPersonCountries();
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
  const needsPayerName = Number(state.quote?.depositAmount || getPreviewQuote()?.depositAmount || 0) > 0;
  const needsBusinessInvoice = !!els.form?.elements?.businessInvoiceNeeded?.checked;
  syncPassportPersonCountries();
  els.addressField?.classList.toggle('hidden-field', needsBusinessInvoice);
  els.businessInvoiceFields?.classList.toggle('hidden-field', !needsBusinessInvoice);
  els.otherCountryField.classList.toggle('hidden-field', !(group === 'pass' && state.selectedCountries.includes('OTHER')));
  els.locationField.classList.toggle('hidden-field', !(group === 'snap' || group === 'wed'));
  els.businessField.classList.toggle('hidden-field', group !== 'biz');
  els.surveyField.classList.toggle('hidden-field', !group || group === 'pass' || group === 'biz');
  els.ageField.classList.toggle('hidden-field', group !== 'prof');
  els.babyTypeField.classList.toggle('hidden-field', !(group === 'prof' && state.selectedProduct?.id === 'pp' && state.ageGroup === 'baby'));
  els.babyNameField.classList.toggle('hidden-field', !needsBabyName);
  els.payerNameField.classList.toggle('hidden-field', !needsPayerName);
  els.reshootingField.classList.toggle('hidden-field', !needsReshootingConsent(state.selectedProduct));
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
  syncPassportPersonCountries();
  return {
    itemId: product.id,
    people: product.g === 'pass' ? getPassportPeopleCount() : getSelectedPeopleValue(els.generalPeople, els.generalPeopleCustom, getDefaultPeopleForProduct(product)),
    optionKeys: [...state.optionKeys],
    passCountries: product.g === 'pass'
      ? [...new Set(state.passportPersonCountries.flatMap((codes) => (Array.isArray(codes) ? codes : []).filter((code) => code && code !== 'OTHER')))]
      : [],
    passPersonCountries: product.g === 'pass' ? state.passportPersonCountries.map((codes) => [...codes]) : [],
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
  syncPassportConfigs();
  const copy = getCopy();
  els.passportCountries.innerHTML = state.passportConfigs.map((config, index) => {
    const rowLabel = `${fillCopy(copy.passportConfigLabel, { index: index + 1 })} · ${copy.passportCountryLabel}`;
    const selectedCodes = Array.isArray(config.countries) ? config.countries : [];
    const chips = COUNTRY_OPTIONS.map((item) => {
      const label = item.label[state.lang] || item.label.ko;
      const selected = selectedCodes.includes(item.code) ? ' selected' : '';
      return `<button type="button" class="chip-btn${selected}" data-config-index="${index}" data-country="${item.code}">${item.flag} ${escapeHtml(label)}</button>`;
    }).join('');
    const removeButton = index > 0
      ? `<button type="button" class="ghost-btn" data-remove-config="${index}">${state.lang === 'en' ? 'Remove' : state.lang === 'de' ? 'Entfernen' : '구성 삭제'}</button>`
      : '';
    return `<div class="form-block passport-config-row">
      <div class="passport-config-head">
        <span class="block-label">${escapeHtml(rowLabel)}</span>
        ${removeButton}
      </div>
      <div class="chip-grid">${chips}</div>
      <label class="inline-field">
        <span>${escapeHtml(copy.passportPeopleLabel)}</span>
        <select data-passport-config-people="${index}">
          ${[1, 2, 3, 4, 5].map((count) => `<option value="${count}" ${Number(config.people || 1) === count ? 'selected' : ''}>${escapeHtml(getPeopleOptionLabel(count, { t: 'pass' }))}</option>`).join('')}
          <option value="custom" ${Number(config.people || 1) > 5 ? 'selected' : ''}>${state.lang === 'en' ? '6+ people (enter manually)' : state.lang === 'de' ? 'Ab 6 Personen direkt eingeben' : '6명 이상 직접입력'}</option>
        </select>
        <input class="${Number(config.people || 1) > 5 ? '' : 'hidden-field'}" data-passport-config-custom="${index}" type="number" min="6" step="1" value="${Number(config.people || 1) > 5 ? escapeHtml(String(config.people)) : ''}" placeholder="${state.lang === 'en' ? 'Enter people' : state.lang === 'de' ? 'Personenzahl eingeben' : '인원수 입력'}">
      </label>
    </div>`;
  }).join('');
  els.passportCountries.querySelectorAll('.chip-btn').forEach((button) => {
    button.addEventListener('click', () => setPassportCountry(Number(button.dataset.configIndex), button.dataset.country));
  });
  els.passportCountries.querySelectorAll('[data-passport-config-people]').forEach((select) => {
    select.addEventListener('change', () => {
      const index = Number(select.dataset.passportConfigPeople);
      const customInput = els.passportCountries.querySelector(`[data-passport-config-custom="${index}"]`);
      if (select.value === 'custom') {
        customInput?.classList.remove('hidden-field');
        setPassportConfigPeople(index, Math.max(6, Number(customInput?.value || 6)));
      } else {
        customInput?.classList.add('hidden-field');
        setPassportConfigPeople(index, Number(select.value || 1));
      }
    });
  });
  els.passportCountries.querySelectorAll('[data-passport-config-custom]').forEach((input) => {
    input.addEventListener('input', () => setPassportConfigPeople(Number(input.dataset.passportConfigCustom), Math.max(6, Number(input.value || 6))));
  });
  els.passportCountries.querySelectorAll('[data-remove-config]').forEach((button) => {
    button.addEventListener('click', () => removePassportConfig(Number(button.dataset.removeConfig)));
  });
}

function setPassportCountry(configIndex, code) {
  syncPassportConfigs();
  const selected = new Set(Array.isArray(state.passportConfigs[configIndex]?.countries) ? state.passportConfigs[configIndex].countries : []);
  if (selected.has(code)) selected.delete(code);
  else selected.add(code);
  state.passportConfigs[configIndex].countries = [...selected];
  syncPassportPersonCountries();
  renderPassportCountries();
  syncConditionalFields();
  handleQuoteInputChange().then(() => refreshStepLocks());
}

function setPassportConfigPeople(configIndex, people) {
  syncPassportConfigs();
  if (!state.passportConfigs[configIndex]) return;
  state.passportConfigs[configIndex].people = Math.max(1, Number(people || 1));
  syncPassportPersonCountries();
  renderPassportCountries();
  handleQuoteInputChange().then(() => refreshStepLocks());
}

function removePassportConfig(configIndex) {
  syncPassportConfigs();
  if (configIndex <= 0 || configIndex >= state.passportConfigs.length) return;
  state.passportConfigs.splice(configIndex, 1);
  syncPassportPersonCountries();
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
  const hideBizPrice = state.selectedProduct.g === 'biz';
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
  const businessSummary = business ? `
    <section class="biz-summary-card">
      <div class="biz-summary-title">${state.lang === 'en' ? 'Current Selection' : state.lang === 'de' ? 'Aktuelle Auswahl' : '현재 선택'}</div>
      <div class="biz-summary-grid">
        <div class="biz-summary-item">
          <span>${escapeHtml(getCopy().bizModeLabel)}</span>
          <strong>${escapeHtml(BUSINESS_MODE_META.find((item) => item.key === state.businessMode)?.label[state.lang] || BUSINESS_MODE_META.find((item) => item.key === state.businessMode)?.label.ko || state.businessMode)}</strong>
        </div>
        <div class="biz-summary-item">
          <span>${escapeHtml(getCopy().bizHoursLabel)}</span>
          <strong>${escapeHtml(String(state.businessHours || 2))}${state.lang === 'en' ? 'h' : state.lang === 'de' ? ' Std.' : '시간'}</strong>
        </div>
        ${state.businessMode === 'video' ? `<div class="biz-summary-item">
          <span>${escapeHtml(getCopy().bizEditLabel)}</span>
          <strong>${escapeHtml(BUSINESS_VIDEO_EDIT_META.find((item) => item.key === state.businessVideoEdit)?.label[state.lang] || BUSINESS_VIDEO_EDIT_META.find((item) => item.key === state.businessVideoEdit)?.label.ko || state.businessVideoEdit)}</strong>
        </div>` : ''}
        ${state.businessAddonKeys.length ? `<div class="biz-summary-item full">
          <span>${escapeHtml(getCopy().bizAddonLabel)}</span>
          <strong>${escapeHtml(state.businessAddonKeys.map((key) => BUSINESS_ADDON_META.find((item) => item.key === key)?.label[state.lang] || BUSINESS_ADDON_META.find((item) => item.key === key)?.label.ko || key).join(', '))}</strong>
        </div>` : ''}
      </div>
    </section>
  ` : '';
  els.productDetail.className = 'detail-box';
  els.productDetail.innerHTML = `
    <div class="detail-title">${escapeHtml(getProductLabel(state.selectedProduct))}</div>
    <div class="detail-copy">${escapeHtml(desc)}</div>
    ${businessSummary}
    ${eventBadge}
    ${hideBizPrice ? `
      <div class="price-hero">
        <div class="price-hero-label">${state.lang === 'en' ? 'Pricing' : state.lang === 'de' ? 'Preis' : '가격 안내'}</div>
        <div class="price-hero-value" style="font-size:26px;">${state.lang === 'en' ? 'Quote after review' : state.lang === 'de' ? 'Angebot nach Prüfung' : '상담 후 견적 안내'}</div>
        <div class="price-hero-copy">${state.lang === 'en'
          ? `${business.hours} hours selected · detailed quote will be sent after review`
          : state.lang === 'de'
            ? `${business.hours} Stunden ausgewählt · das genaue Angebot senden wir nach Prüfung`
            : `${business.hours}시간 선택 · 세부 내용 확인 후 맞춤 견적을 안내드립니다.`}</div>
      </div>
    ` : `
      <div class="price-hero">
        <div class="price-hero-label">${state.lang === 'en' ? 'Estimated price' : state.lang === 'de' ? 'Geschätzter Preis' : '예상 금액'}</div>
        <div class="price-hero-value">€${price}</div>
        <div class="price-hero-copy">${state.lang === 'en'
          ? `About ${getShootDuration()} min`
          : state.lang === 'de'
            ? `Ca. ${getShootDuration()} Min`
            : `촬영 약 ${getShootDuration()}분`}</div>
      </div>
      ${getAppliedDiscountNote() ? `<div class="muted-copy" style="margin-top:10px;font-weight:700;color:#2563eb;">${escapeHtml(getAppliedDiscountNote())}</div>` : ''}
      ${getProductPolicyNote(state.selectedProduct) ? `<div class="muted-copy" style="margin-top:10px;">${escapeHtml(getProductPolicyNote(state.selectedProduct))}</div>` : ''}
      ${getSecondaryPriceNote() ? `<div class="muted-copy" style="margin-top:8px;">${escapeHtml(getSecondaryPriceNote())}</div>` : ''}
    `}
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
  if (!batch) {
    batch = readMonthStorage(state.calendarYear, state.calendarMonth, state.selectedProduct.g, duration);
    if (batch) state.calendarCache.set(cacheKey, batch);
  }
  els.monthLabel.textContent = formatMonthLabel(state.calendarYear, state.calendarMonth, state.lang);
  setCalendarBusy(true);
  if (!batch) {
    els.calendarGrid.classList.remove('empty-state');
    els.calendarGrid.innerHTML = renderPanelLoading(getCopy().loadCalendar);
    try {
      const monthBatch = await fetchAndStoreCalendarBatch(state.calendarYear, state.calendarMonth, duration, state.selectedProduct.g);
      if (token !== state.calendarRequestToken) return;
      batch = state.calendarCache.get(cacheKey) || monthBatch;
    } catch (error) {
      if (token !== state.calendarRequestToken) return;
      console.error(error);
      setBanner(`${getCopy().calendarFail}: ${error.message}`, 'error');
      els.calendarGrid.innerHTML = `<div class="empty-state">${escapeHtml(getCopy().calendarLoadError)}. ${escapeHtml(error.message)}</div>`;
      setCalendarBusy(false);
      return;
    }
  }
  if (token !== state.calendarRequestToken) return;
  renderCalendar(batch);
  setCalendarBusy(false);
  updateMonthNavAvailability();
  setBanner(getCopy().calendarLoaded, 'success');
  if (!state.selectedDate) {
    const nearestDate = getNearestAvailableDate(batch);
    if (nearestDate) await selectDate(nearestDate);
  }
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
    const [yearPart, monthPart] = monthKey.split('_');
    writeMonthStorage(Number(yearPart), Number(monthPart), itemGroup, duration, data);
  });
  return batch?.[`${year}_${month}`] || Object.values(batch || {})[0] || null;
}

async function prefetchNextCalendarMonth() {
  if (!state.selectedProduct) return;
  const next = new Date(state.calendarYear, state.calendarMonth + 1, 1);
  if (next.getFullYear() > MAX_BOOKING_MONTH.year || (next.getFullYear() === MAX_BOOKING_MONTH.year && next.getMonth() > MAX_BOOKING_MONTH.month)) return;
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
  els.slotGrid.innerHTML = renderPanelLoading(getCopy().loadCalendar);
  const cachedSlots = state.slotCache.get(slotKey);
  if (Array.isArray(cachedSlots)) {
    if (token !== state.slotRequestToken) return;
    els.slotHint.textContent = fillCopy(getCopy().slotLoadedForDate, { date: dateLabel });
    renderSlots(cachedSlots);
    return;
  }
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
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const firstDay = new Date(state.calendarYear, state.calendarMonth, 1).getDay();
  const daysInMonth = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push('<div class="calendar-cell muted"></div>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${state.calendarYear}-${pad2(state.calendarMonth + 1)}-${pad2(day)}`;
    const disabled = unavail.has(dateKey) || dateKey < todayKey;
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

function getNearestAvailableDate(data) {
  const safeData = data && typeof data === 'object' ? data : {};
  const unavail = new Set(Array.isArray(safeData.unavail) ? safeData.unavail : []);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const daysInMonth = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${state.calendarYear}-${pad2(state.calendarMonth + 1)}-${pad2(day)}`;
    if (dateKey < todayKey) continue;
    if (unavail.has(dateKey)) continue;
    return dateKey;
  }
  return '';
}

async function selectDate(dateKey) {
  state.slotRequestToken += 1;
  state.selectedDate = dateKey;
  state.activeStep = 3;
  state.selectedSlot = '';
  els.slotHint.textContent = fillCopy(getCopy().slotLoadingForDate, { date: formatDateLabel(dateKey) });
  els.slotGrid.classList.add('empty-state');
  els.slotGrid.innerHTML = renderPanelLoading(getCopy().loadCalendar);
  renderSeniorWarning();
  const duration = getCalendarDuration();
  renderCalendar(state.calendarCache.get(`${state.calendarYear}_${state.calendarMonth}_${state.selectedProduct.g}_${duration}`));
  await loadSlotsForDate(dateKey);
  refreshQuote().catch((error) => console.error(error));
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
      els.slotGrid.querySelectorAll('.slot-btn').forEach((item) => item.classList.toggle('selected', item.dataset.time === state.selectedSlot));
      els.slotHint.textContent = fillCopy(getCopy().slotLoadedForDate, { date: formatDateLabel(state.selectedDate) });
      updateSubmitState();
      renderReview();
      syncStepPanels();
      setBanner(
        state.lang === 'en'
          ? 'Date and time selected. Review once more, then continue.'
          : state.lang === 'de'
            ? 'Datum und Uhrzeit wurden gewählt. Bitte prüfen Sie alles und fahren Sie dann fort.'
            : '날짜와 시간이 선택되었습니다. 한 번 더 확인한 뒤 다음으로 진행해 주세요.',
        'success'
      );
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
  const rows = [[copy.reviewProduct, getProductLabel(state.selectedProduct)]];
  if (state.selectedProduct.g !== 'biz') rows.push([copy.reviewPrice, `€${getEstimatedPrice()}`]);
  if (state.selectedDate) rows.push([copy.reviewDate, state.selectedDate]);
  if (state.selectedSlot) rows.push([copy.reviewTime, state.selectedSlot]);
  if (state.selectedProduct.g === 'pass') {
    rows.push([copy.reviewPeople, `${getPassportPeopleCount()}${state.lang === 'en' ? (getPassportPeopleCount() > 1 ? ' people' : ' person') : state.lang === 'de' ? (getPassportPeopleCount() > 1 ? ' Personen' : ' Person') : '명'}`]);
    if (hasPassportCountrySelections()) {
      rows.push([copy.reviewCountries, getPassportCountryReviewLabel()]);
    }
  } else if (!els.peopleField.classList.contains('hidden')) {
    rows.push([copy.reviewPeople, getPeopleOptionLabel(getSelectedPeopleValue(els.generalPeople, els.generalPeopleCustom, getDefaultPeopleForProduct(state.selectedProduct)), state.selectedProduct)]);
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
    rows.push([copy.bizModeLabel, BUSINESS_MODE_META.find((item) => item.key === state.businessMode)?.label[state.lang] || BUSINESS_MODE_META.find((item) => item.key === state.businessMode)?.label.ko || state.businessMode]);
    rows.push([copy.bizHoursLabel, `${state.businessHours || 2}${state.lang === 'en' ? 'h' : state.lang === 'de' ? ' Std.' : '시간'}`]);
    if (state.businessMode === 'video') {
      rows.push([copy.bizEditLabel, BUSINESS_VIDEO_EDIT_META.find((item) => item.key === state.businessVideoEdit)?.label[state.lang] || BUSINESS_VIDEO_EDIT_META.find((item) => item.key === state.businessVideoEdit)?.label.ko || state.businessVideoEdit]);
    }
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
  const businessInvoice = getBusinessInvoiceFormData();
  if (businessInvoice.needed) {
    rows.push([copy.reviewBusinessInvoice, copy.yes]);
    if (businessInvoice.companyName) rows.push([copy.reviewBusinessCompanyName, businessInvoice.companyName]);
    if (businessInvoice.invoiceEmail) rows.push([copy.reviewBusinessInvoiceEmail, businessInvoice.invoiceEmail]);
    if (businessInvoice.companyAddress) rows.push([copy.reviewBusinessCompanyAddress, businessInvoice.companyAddress]);
    if (businessInvoice.vatId) rows.push([copy.reviewBusinessVatId, businessInvoice.vatId]);
    if (businessInvoice.reference) rows.push([copy.reviewBusinessInvoiceRef, businessInvoice.reference]);
  }
  const memo = String(els.form.elements.memo?.value || '').trim();
  const payerName = String(els.form.elements.payerName?.value || '').trim();
  if (payerName) rows.push([copy.reviewPayerName, payerName]);
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
  const passCountriesOk = !isPass || hasPassportCountrySelections();
  const otherCountryOk = !isPass || !state.selectedCountries.includes('OTHER') || !!String(formData.get('otherCountry') || '').trim();
  const locationOk = (product.g === 'snap' || product.g === 'wed') ? !!String(els.locationInput?.value || '').trim() : true;
  const businessOk = product.g !== 'biz' || !!String(els.businessInput?.value || '').trim();
  const babyName = String(formData.get('babyName') || '').trim();
  const babyNameOk = !((product.g === 'prof' && product.id === 'pp' && state.ageGroup === 'baby') || state.surveyKeys.includes('baby')) || !!babyName;
  const reshootingOk = !needsReshootingConsent(product) || !!els.reshootingConsent?.checked;
  const businessInvoice = getBusinessInvoiceFormData(formData);
  const businessInvoiceOk = !businessInvoice.needed
    || (businessInvoice.companyName
      && businessInvoice.companyAddress
      && (!businessInvoice.invoiceEmail || /\S+@\S+\.\S+/.test(businessInvoice.invoiceEmail)));
  els.submitBtn.disabled = !(name && phone && emailOk && gdprOk && aiOk && passCountriesOk && otherCountryOk && locationOk && businessOk && babyNameOk && reshootingOk && businessInvoiceOk);
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
  const now = new Date();
  const minTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextTs = new Date(next.getFullYear(), next.getMonth(), 1).getTime();
  const maxTs = new Date(MAX_BOOKING_MONTH.year, MAX_BOOKING_MONTH.month, 1).getTime();
  if (nextTs < minTs || nextTs > maxTs) return;
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
  const businessInvoice = getBusinessInvoiceFormData(formData);
  const payload = {
    requestId: createRequestId('booking'),
    itemId: state.selectedProduct.id,
    date: state.selectedDate,
    time: state.selectedSlot,
    people: state.selectedProduct.g === 'pass' ? getPassportPeopleCount() : getSelectedPeopleValue(els.generalPeople, els.generalPeopleCustom, getDefaultPeopleForProduct(state.selectedProduct)),
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    address: businessInvoice.needed ? businessInvoice.companyAddress : String(formData.get('address') || '').trim(),
    payerName: String(formData.get('payerName') || '').trim(),
    babyName: String(formData.get('babyName') || '').trim(),
    memo: '',
    website: String(formData.get('website') || ''),
    lang: state.lang,
    optionKeys: [...state.optionKeys],
    passCountries: state.selectedProduct.g === 'pass'
      ? [...new Set(state.passportPersonCountries.flatMap((codes) => (Array.isArray(codes) ? codes : []).filter((code) => code && code !== 'OTHER')))]
      : [],
    passPersonCountries: state.selectedProduct.g === 'pass' ? state.passportPersonCountries.map((codes) => [...codes]) : [],
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
    businessInvoiceNeeded: businessInvoice.needed,
    businessCompanyName: businessInvoice.companyName,
    businessCompanyAddress: businessInvoice.companyAddress,
    businessVatId: businessInvoice.vatId,
    businessInvoiceEmail: businessInvoice.invoiceEmail,
    businessInvoiceRef: businessInvoice.reference,
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
  if (state.selectedProduct.g === 'pass' && !hasPassportCountrySelections()) {
    setBanner(getCopy().countryRequired, 'error');
    return;
  }
  const userMemo = String(formData.get('memo') || '').trim();
  const passMemoPrefix = buildPassportMemoPrefix();
  payload.memo = [passMemoPrefix, userMemo].filter(Boolean).join('\n');
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
  if (businessInvoice.needed && (!businessInvoice.companyName || !businessInvoice.companyAddress)) {
    setBanner(getCopy().businessInvoiceRequired, 'error');
    return;
  }
  if (businessInvoice.invoiceEmail && !/\S+@\S+\.\S+/.test(businessInvoice.invoiceEmail)) {
    setBanner(getCopy().businessInvoiceEmailInvalid, 'error');
    return;
  }
  if (!payload.gdprConsent || (!isPass && !payload.aiConsent)) {
    setBanner(getCopy().consentRequired, 'error');
    return;
  }
  if (needsReshootingConsent(state.selectedProduct) && !els.reshootingConsent?.checked) {
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
    syncConditionalFields();
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
  state.passportPersonCountries = [];
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
  els.generalPeopleCustom?.classList.add('hidden-field');
  els.generalPeopleCustom && (els.generalPeopleCustom.value = '');
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
        <h4 class="result-guide-title">${isKo ? (hasBabyBirthday ? '👶 영유아 여권 / 비자사진 촬영 조건 안내' : '[예약 안내] 한국 여권 & 독일 비자(E-passbild) 촬영') : 'Passport / Visa Shoot Guide'}</h4>
        <div class="result-guide-body">
          ${isKo ? (hasBabyBirthday ? `
            <p>아기는 눕힌 상태에서 밝은 단색 배경으로 촬영하며, 한국 여권과 독일 비자 규정을 함께 맞춰 진행합니다.</p>
            <ul>
              <li>얼굴은 정면으로, 눈은 떠 있어야 하며 손이나 그림자가 얼굴을 가리면 안 됩니다.</li>
              <li>보호자 손, 옷, 그림자는 사진에 보이면 안 되며 흰색 의상은 피해주세요.</li>
              <li>안경, 모자, 머리띠는 착용할 수 없습니다.</li>
              <li>영유아는 성인보다 규정이 일부 완화 적용되며, 자연스러운 표정도 허용 범위 안에서 촬영합니다.</li>
            </ul>
          ` : `
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
          `) : `
            <p>Please review the biometric passport / visa photo requirements before your visit.</p>
            <ul>
              ${hasBabyBirthday
                ? `<li>Infants are photographed lying down on a bright plain background.</li>
                   <li>No caregiver hands, clothes, or shadows may appear in the frame.</li>
                   <li>Eyes should stay open and white outfits or hair accessories are not recommended.</li>`
                : `<li>Keep eyebrows fully visible and avoid reflective glasses.</li>
                   <li>Neutral expression, closed mouth, and clear lenses only.</li>
                   <li>Infants are photographed lying down and no caregiver hands or shadows may appear.</li>`}
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
            <h5>선택 내용</h5>
            <ul>
              <li>촬영 유형: ${escapeHtml(state.businessMode === 'video' ? '행사 영상' : '행사 사진')}</li>
              <li>촬영 시간: ${escapeHtml(String(state.businessHours || 2))}시간</li>
              ${state.businessMode === 'video' ? `<li>편집 옵션: ${escapeHtml((BUSINESS_VIDEO_EDIT_META.find((item) => item.key === state.businessVideoEdit)?.label.ko) || state.businessVideoEdit)}</li>` : ''}
              ${state.businessAddonKeys.length ? `<li>추가 요청: ${escapeHtml(state.businessAddonKeys.map((key) => BUSINESS_ADDON_META.find((item) => item.key === key)?.label.ko || key).join(', '))}</li>` : ''}
            </ul>
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
              <li>${state.businessMode === 'video' ? 'Video production' : 'Event photography'} · ${escapeHtml(String(state.businessHours || 2))}${isKo ? '시간' : ' hours'}</li>
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
          <p>The studio is on the 2nd floor under the ALIN / Das Boots sign. If it is hard to find, please contact us and we can guide you.</p>
          <p><b>Parking</b><br>There is no dedicated parking lot. We recommend nearby street parking or one of the parking options below.</p>
          <ul>
            <li><a href="https://maps.app.goo.gl/6JTrYv5p7cSSy5oY7?g_st=com.google.maps.preview.copy" target="_blank" rel="noreferrer">City Parkhaus</a></li>
            <li><a href="https://maps.app.goo.gl/AW4qzE7b9RmnnzZJ8?g_st=com.google.maps.preview.copy" target="_blank" rel="noreferrer">Parkhaus Altstadt</a></li>
            <li><a href="https://maps.app.goo.gl/S7zA3hEstWqhGhkUA" target="_blank" rel="noreferrer">Rathausparkplatz</a></li>
          </ul>
        `}
      </div>
    </section>
  `);

  return `<div class="result-guide-stack">${sections.join('')}</div>`;
}

function renderSubmitResult(payload, result) {
  const copy = getCopy();
  const totalPrice = result?.quote?.totalPrice ?? getEstimatedPrice();
  const hideBizPrice = state.selectedProduct?.g === 'biz';
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
      ${hideBizPrice ? '' : `<div class="result-item">
        <strong>${escapeHtml(copy.submitCardPrice)}</strong>
        <span>${escapeHtml(`€${totalPrice}`)}</span>
      </div>`}
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
