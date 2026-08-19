import { buildGutscheinReleaseUrl, fetchCalendarBatch, fetchInitData, fetchQuote, fetchReturnEligibility, fetchSlots, holdGutschein, joinWaitlist, lookupAddress, lookupContact, pingPartnerClick, submitBooking } from '../shared/api-booking.js';
import { getProductDeliveryLines, getProductIncludedPrintQuota, productHasFixedDeliverySpec } from '../shared/product-delivery.js';
import { groupPrintCatalogByGrade, printCatalogGradeLabel, printCatalogName } from '../shared/print-catalog.js';
import { PRINT_METHOD_POINTS, PRINT_TIERS, getPrintMicrocopy, getPrintTier } from '../shared/print-tier-copy.js';
import { createRequestId, escapeHtml, formatMonthLabel, pad2 } from '../shared/utils.js';

const LANG_STORAGE_KEY = 'studio-mean-lang';
const SUPPORTED_LANGS = new Set(['ko', 'en', 'de']);
const WEDDING_EARLY_BOOKING_MONTHS = 6;
const WEDDING_EARLY_BOOKING_DISCOUNT_RATE = 10;
const WEDDING_MARKETING_DISCOUNT_RATE = 5;
const WEDDING_TOTAL_MAX_DISCOUNT_RATE = WEDDING_EARLY_BOOKING_DISCOUNT_RATE + WEDDING_MARKETING_DISCOUNT_RATE;
const CONTRACT_TERMS_VERSION = 'studio_mean_standard_shooting_contract_v1';
const DEFAULT_SHOOTING_LOCATION = 'Holzweg-Passage 3, 61440 Oberursel';
const INIT_CACHE_KEY = 'studioMeanBookingInit:v2';
/* 첫 화면 즉시 렌더용 스냅샷 TTL.
   실측(2026-07-27): 라이브 init 응답이 3.7~4.6초인데 그중 3.5초는 Apps Script 웹앱의
   디스패치·302 오버헤드다(아무 일도 안 하는 경로도 3.5~4.1초). 서버로는 줄일 수 없으므로
   체감은 이 캐시로만 좋아진다. sessionStorage(탭 닫으면 소멸)에서 localStorage 로 옮기고
   TTL 을 12시간으로 늘려, 재방문 고객이 로딩 화면을 보지 않게 한다.
   스냅샷은 화면을 먼저 그리기 위한 것일 뿐 — 부팅은 항상 서버를 다시 불러 덮어쓰고(boot()),
   최종 금액은 견적·제출 시점에 서버가 다시 계산한다(가격은 서버가 권위). */
const INIT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CONTACT_COUNTRY_PRESETS = [
  { value: '+49', label: 'DE +49' },
  { value: '+82', label: 'KR +82' },
  { value: '+1', label: 'US +1' },
  { value: '+44', label: 'UK +44' },
  { value: '+33', label: 'FR +33' },
  { value: '+31', label: 'NL +31' },
  { value: '+43', label: 'AT +43' },
  { value: '+41', label: 'CH +41' }
];
const EMAIL_DOMAIN_PRESETS = ['@gmail.com', '@googlemail.com', '@yahoo.com', '@naver.com', '@icloud.com', '@outlook.com', '@hotmail.com', '@kakao.com'];

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatEuroAmount(value) {
  const rounded = roundCurrency(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function trimPromoDate(dateStr) {
  return String(dateStr || '').trim().slice(0, 10);
}

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

/* Keeps <html lang> in sync so screen readers pick the right voice and
   Chrome does not offer to translate a page that is already in the user's language. */
function syncDocumentLang(lang) {
  document.documentElement.lang = lang;
  /* site-analytics.js captured the language before the switch; let it re-apply. */
  document.dispatchEvent(new CustomEvent('studiomean:langchange'));
}

function persistLang(lang) {
  try {
    globalThis.localStorage?.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore storage errors and keep runtime language in memory.
  }
}

function parseLocalDateOnly(dateStr) {
  const match = String(dateStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
}

function addMonthsClamped(date, months) {
  const result = new Date(date.getTime());
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

function isWeddingEarlyBookingEligible(dateStr, baseDate = new Date()) {
  const shootDate = parseLocalDateOnly(dateStr);
  if (!shootDate) return false;
  const thresholdBase = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 12, 0, 0, 0);
  const threshold = addMonthsClamped(thresholdBase, WEDDING_EARLY_BOOKING_MONTHS);
  return shootDate.getTime() >= threshold.getTime();
}

function getWeddingCopy() {
  if (state.lang === 'en') {
    return {
      benefitEyebrow: 'Wedding Benefit',
      benefitTitle: `Reserve early and save up to ${WEDDING_TOTAL_MAX_DISCOUNT_RATE}% on your wedding booking.`,
      benefitBody: `Book at least ${WEDDING_EARLY_BOOKING_MONTHS} months ahead for ${WEDDING_EARLY_BOOKING_DISCOUNT_RATE}% off, and receive another ${WEDDING_MARKETING_DISCOUNT_RATE}% off when you agree to marketing / portfolio usage.`,
      earlyTitle: 'Early booking discount',
      earlyBody: 'Automatically applies when the selected shoot date is at least 6 months away from today.',
      earlyPendingNoDate: 'Select the shoot date to check this benefit.',
      earlyPendingDate: `Available for bookings made ${WEDDING_EARLY_BOOKING_MONTHS} months or more in advance.`,
      earlyActive: `Scheduled · ${WEDDING_EARLY_BOOKING_DISCOUNT_RATE}% off`,
      marketingTitle: 'Marketing consent discount',
      marketingBody: 'Agree to website / SNS / portfolio usage and receive an additional wedding discount.',
      marketingPending: `Agree to receive an extra ${WEDDING_MARKETING_DISCOUNT_RATE}% off.`,
      marketingActive: `Scheduled · ${WEDDING_MARKETING_DISCOUNT_RATE}% off`,
      refundTitle: 'Deposit refund guide',
      refundBody: 'Wedding deposit refunds are handled according to the cancellation timing below.',
      refundRanges: [
        '60+ days before the shoot: 100% refund',
        '59 to 30 days before: 70% refund',
        '29 to 14 days before: 50% refund',
        '13 to 7 days before: 30% refund',
        '6 days before to same day: no refund'
      ],
      refundSub: 'The refund is calculated based on the date when the cancellation request is received.',
      appliedLabel: 'Current estimated savings',
      marketingLabel: `[Optional] Agree to marketing / SNS / portfolio usage for an extra ${WEDDING_MARKETING_DISCOUNT_RATE}% wedding discount.`,
      marketingSub: 'If you agree, the final images may be used for Studio mean website, social media, and portfolio promotion.',
      reviewDiscounts: 'Applied discounts'
    };
  }
  if (state.lang === 'de') {
    return {
      benefitEyebrow: 'Wedding Benefit',
      benefitTitle: `Früh buchen und bis zu ${WEDDING_TOTAL_MAX_DISCOUNT_RATE}% Hochzeitsrabatt sichern.`,
      benefitBody: `Bei einer Reservierung mindestens ${WEDDING_EARLY_BOOKING_MONTHS} Monate im Voraus erhalten Sie ${WEDDING_EARLY_BOOKING_DISCOUNT_RATE}% Rabatt. Mit Marketing-/Portfolio-Einwilligung kommen weitere ${WEDDING_MARKETING_DISCOUNT_RATE}% dazu.`,
      earlyTitle: 'Frühbucher-Rabatt',
      earlyBody: 'Wird automatisch angewendet, wenn der gewählte Shooting-Termin mindestens 6 Monate ab heute entfernt ist.',
      earlyPendingNoDate: 'Bitte zuerst das Shooting-Datum wählen.',
      earlyPendingDate: `Gilt bei Buchungen mindestens ${WEDDING_EARLY_BOOKING_MONTHS} Monate im Voraus.`,
      earlyActive: `Vorgemerkt · ${WEDDING_EARLY_BOOKING_DISCOUNT_RATE}% Rabatt`,
      marketingTitle: 'Marketing-Einwilligungsrabatt',
      marketingBody: 'Bei Einwilligung für Website / SNS / Portfolio gibt es zusätzlich einen Hochzeitsrabatt.',
      marketingPending: `Mit Einwilligung zusätzliche ${WEDDING_MARKETING_DISCOUNT_RATE}% Rabatt.`,
      marketingActive: `Vorgemerkt · ${WEDDING_MARKETING_DISCOUNT_RATE}% Rabatt`,
      refundTitle: 'Info zur Anzahlung & Rückerstattung',
      refundBody: 'Für die Hochzeits-Anzahlung gelten je nach Stornozeitpunkt folgende Erstattungsstufen.',
      refundRanges: [
        'Ab 60 Tagen vor dem Shooting: 100% Rückerstattung',
        '59 bis 30 Tage vorher: 70% Rückerstattung',
        '29 bis 14 Tage vorher: 50% Rückerstattung',
        '13 bis 7 Tage vorher: 30% Rückerstattung',
        'Ab 6 Tagen vorher bis am Shootingtag: keine Rückerstattung'
      ],
      refundSub: 'Maßgeblich ist das Datum, an dem die Stornierungsanfrage bei uns eingeht.',
      appliedLabel: 'Aktuell geplanter Rabatt',
      marketingLabel: `[Optional] Marketing / SNS / Portfolio-Nutzung zustimmen und zusätzliche ${WEDDING_MARKETING_DISCOUNT_RATE}% Hochzeitsrabatt erhalten.`,
      marketingSub: 'Bei Zustimmung dürfen die finalen Bilder für die Website, Social Media und das Portfolio von Studio mean verwendet werden.',
      reviewDiscounts: 'Angewendete Rabatte'
    };
  }
  return {
    benefitEyebrow: 'Wedding Benefit',
    benefitTitle: `웨딩은 미리 예약하면 최대 ${WEDDING_TOTAL_MAX_DISCOUNT_RATE}%까지 할인됩니다.`,
    benefitBody: `촬영일이 오늘 기준 ${WEDDING_EARLY_BOOKING_MONTHS}개월 이상 남아 있으면 ${WEDDING_EARLY_BOOKING_DISCOUNT_RATE}% 할인, 마케팅/포트폴리오 활용에 동의하면 추가 ${WEDDING_MARKETING_DISCOUNT_RATE}% 할인이 더해집니다.`,
    earlyTitle: '얼리 예약 할인',
    earlyBody: '선택한 촬영일이 오늘 기준 6개월 이상 남아 있으면 자동 적용됩니다.',
    earlyPendingNoDate: '촬영 날짜를 선택하면 적용 여부를 바로 확인할 수 있습니다.',
    earlyPendingDate: `촬영일이 ${WEDDING_EARLY_BOOKING_MONTHS}개월 이상 남아 있으면 적용됩니다.`,
    earlyActive: `적용 예정 · ${WEDDING_EARLY_BOOKING_DISCOUNT_RATE}% 할인`,
    marketingTitle: '마케팅 동의 할인',
    marketingBody: '웹사이트 / SNS / 포트폴리오 활용에 동의하시면 웨딩 예약에 추가 할인이 적용됩니다.',
    marketingPending: `동의 시 추가 ${WEDDING_MARKETING_DISCOUNT_RATE}% 할인`,
    marketingActive: `적용 예정 · ${WEDDING_MARKETING_DISCOUNT_RATE}% 할인`,
    refundTitle: '예약금 환불 안내',
    refundBody: '웨딩 예약금은 취소 접수 시점에 따라 아래 기준으로 환불됩니다.',
    refundRanges: [
      '촬영일 60일 전까지: 100% 환불',
      '촬영일 59~30일 전: 70% 환불',
      '촬영일 29~14일 전: 50% 환불',
      '촬영일 13~7일 전: 30% 환불',
      '촬영일 6일 전부터 당일: 환불 불가'
    ],
    refundSub: '환불 금액은 실제 취소 요청이 접수된 날짜를 기준으로 계산됩니다.',
    appliedLabel: '현재 예상 할인',
    marketingLabel: `[선택] 마케팅/SNS/포트폴리오 활용 동의 시 추가 ${WEDDING_MARKETING_DISCOUNT_RATE}% 할인`,
    marketingSub: '동의하시면 촬영 결과물을 Studio mean 웹사이트, SNS, 포트폴리오 홍보 용도로 활용할 수 있으며 웨딩 추가 할인도 함께 적용됩니다.',
    reviewDiscounts: '적용 할인'
  };
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
    label: { ko: '여권/비자', en: 'Passport / Visa', de: 'Pass / Visum' },
    sub: {
      ko: '한국 여권, 독일 E-passbild, 해외 비자 사진',
      en: 'Korean passport, German E-passbild, visa photos',
      de: 'Koreanischer Pass, deutsches E-Passbild, Visafotos'
    }
  },
  prof: {
    label: { ko: '프로필', en: 'Profile', de: 'Profil' },
    sub: {
      ko: '개인 프로필, 키즈, 시니어, 백일/돌 촬영',
      en: 'Personal profile, kids, senior, baby sessions',
      de: 'Persönliche Profile, Kinder, Senioren, Baby-Shootings'
    }
  },
  stud: {
    label: { ko: '스튜디오', en: 'Studio', de: 'Studio' },
    sub: {
      ko: '가족, 커플, 그룹, 돌상 포함 스튜디오 촬영',
      en: 'Studio shoots for family, couple, group, birthday setup',
      de: 'Studio-Shootings für Familie, Paar, Gruppe, Geburtstag'
    }
  },
  snap: {
    label: { ko: '야외/홈스냅', en: 'Outdoor/Home', de: 'Outdoor/Home' },
    sub: {
      ko: '야외 또는 홈스냅, 커플, 가족, 백일/돌 스냅',
      en: 'Outdoor or home snap, couples, families, baby sessions',
      de: 'Outdoor oder Home-Shooting, Paare, Familien, Baby-Sessions'
    }
  },
  wed: {
    label: { ko: '프리웨딩 (커플 화보)', en: 'Pre-Wedding (Couple Shoot)', de: 'Pre-Wedding (Paarshooting)' },
    sub: {
      ko: '결혼 전에 찍는 커플 컨셉 화보입니다. 결혼식 당일 촬영은 "웨딩·가족 행사"에서 예약해 주세요.',
      en: 'A styled couple shoot before your wedding day. For wedding-day coverage, choose "Wedding & Family Events".',
      de: 'Ein Paarshooting vor der Hochzeit. Für die Begleitung am Hochzeitstag bitte "Hochzeit & Familienfeiern" wählen.'
    }
  },
  // famevt/b2b는 UI 전용 타일 — 실제 데이터 그룹은 'biz' (realGroup). 백엔드/상품 시맨틱 불변.
  famevt: {
    realGroup: 'biz',
    label: { ko: '웨딩 · 가족 행사', en: 'Wedding & Family Events', de: 'Hochzeit & Familienfeiern' },
    sub: {
      ko: '결혼식(암트) 당일, 피로연·파티, 돌잔치 — 행사 현장을 촬영합니다.',
      en: 'Civil wedding day, reception or party, first-birthday (dol) — we cover your event as it happens.',
      de: 'Standesamtliche Trauung, Empfang oder Party, Familienfeiern — wir begleiten Ihr Fest vor Ort.'
    }
  },
  b2b: {
    realGroup: 'biz',
    consultOnly: true,
    label: { ko: '기업 · 단체 촬영 (B2B)', en: 'Business & Corporate (B2B)', de: 'Business & Firmen (B2B)' },
    sub: {
      ko: '기업 행사, 공연·전시, 출장 촬영(임직원 프로필·공간·제품) — 상담 후 맞춤 견적을 드립니다.',
      en: 'Corporate events, performances & exhibitions, on-site shoots (staff portraits, spaces, products) — custom quote after a short consultation.',
      de: 'Firmenevents, Auftritte & Ausstellungen, Vor-Ort-Shootings (Mitarbeiterporträts, Räume, Produkte) — individuelles Angebot nach kurzer Beratung.'
    }
  }
};

const GROUP_QUICK_FACTS = {
  pass: {
    delivery: { ko: '당일 전달', en: 'Same day', de: 'Am selben Tag' },
    place: { ko: '오버우어젤 스튜디오', en: 'Studio in Oberursel', de: 'Studio in Oberursel' }
  },
  prof: {
    delivery: { ko: '원본 1주 이내 · 셀렉 후 2~3주', en: 'Originals within 1 week · finals 2–3 weeks after selection', de: 'Originale innerhalb 1 Woche · finale Bilder 2–3 Wochen nach Rückmeldung' },
    place: { ko: '오버우어젤 스튜디오', en: 'Studio in Oberursel', de: 'Studio in Oberursel' }
  },
  stud: {
    delivery: { ko: '원본 1주 이내 · 셀렉 후 2~3주', en: 'Originals within 1 week · finals 2–3 weeks after selection', de: 'Originale innerhalb 1 Woche · finale Bilder 2–3 Wochen nach Rückmeldung' },
    place: { ko: '오버우어젤 스튜디오', en: 'Studio in Oberursel', de: 'Studio in Oberursel' }
  },
  snap: {
    delivery: { ko: '원본 1주 이내 · 셀렉 후 2~3주', en: 'Originals within 1 week · finals 2–3 weeks after selection', de: 'Originale innerhalb 1 Woche · finale Bilder 2–3 Wochen nach Rückmeldung' },
    place: { ko: '스튜디오 기준 30km 무료 · 이후 지역별 출장비', en: 'Free within 30 km of the studio · zone fee beyond', de: 'Bis 30 km ab Studio kostenlos · danach Zonenpauschale' }
  },
  wed: {
    delivery: { ko: '원본 1주 이내 · 셀렉 후 2~3주', en: 'Originals within 1 week · finals 2–3 weeks after selection', de: 'Originale innerhalb 1 Woche · finale Bilder 2–3 Wochen nach Rückmeldung' },
    place: { ko: '스튜디오 기준 30km 무료 · 이후 지역별 출장비', en: 'Free within 30 km of the studio · zone fee beyond', de: 'Bis 30 km ab Studio kostenlos · danach Zonenpauschale' }
  },
  biz: {
    delivery: { ko: '납품 일정 별도 협의', en: 'Delivery by agreement', de: 'Lieferung nach Absprache' },
    place: { ko: '출장 / 현장 진행', en: 'On location', de: 'Vor Ort' }
  },
  famevt: {
    delivery: { ko: '납품 일정 협의', en: 'Delivery by agreement', de: 'Lieferung nach Absprache' },
    place: { ko: '행사 장소로 출장', en: 'At your venue', de: 'An Ihrem Veranstaltungsort' }
  },
  b2b: {
    delivery: { ko: '1–2 영업일 내 맞춤 견적', en: 'Custom quote within 1–2 business days', de: 'Angebot innerhalb von 1–2 Werktagen' },
    place: { ko: '출장 / 현장 진행', en: 'On location', de: 'Vor Ort' }
  }
};

const EVENT_PRODUCT_CATEGORIES = [
  {
    key: 'civil',
    track: 'famevt',
    title: { ko: '암트 결혼식 (본식)', en: 'Civil wedding ceremony', de: 'Standesamtliche Trauung' },
    sub: { ko: '결혼식 당일, 암트(관청)에서 진행되는 본식을 촬영합니다.', en: 'We photograph your civil ceremony on the wedding day itself.', de: 'Wir fotografieren Ihre standesamtliche Trauung am Hochzeitstag.' }
  },
  {
    key: 'wedparty',
    track: 'famevt',
    title: { ko: '웨딩 피로연 · 파티', en: 'Wedding reception & party', de: 'Hochzeitsempfang & Party' },
    sub: { ko: '본식 후 이어지는 식사 자리나 파티까지 함께 촬영합니다.', en: 'Coverage that continues into your dinner, reception or party after the ceremony.', de: 'Begleitung beim Essen, Empfang oder der Party nach der Trauung.' }
  },
  {
    key: 'family',
    track: 'famevt',
    title: { ko: '돌잔치 / 가족 파티', en: 'First birthday & family party', de: 'Dol & Familienfeier' },
    sub: { ko: '돌잔치, 생일, 가족 모임 — 가족이 주인공인 파티를 촬영합니다.', en: 'First birthdays (dol), birthdays and family gatherings.', de: 'Erster Geburtstag (Dol), Geburtstage und Familienfeiern.' }
  },
  {
    key: 'private',
    track: 'b2b',
    title: { ko: '일반 행사', en: 'General event', de: 'Allgemeines Event' },
    sub: { ko: '공연, 전시, 커뮤니티 행사, 개인 이벤트입니다.', en: 'Performances, exhibitions, community events and private events.', de: 'Auftritte, Ausstellungen, Community-Events und private Veranstaltungen.' }
  },
  {
    key: 'corporate',
    track: 'b2b',
    title: { ko: '기업 행사', en: 'Corporate event', de: 'Firmenevent' },
    sub: { ko: '세미나, 컨퍼런스, 브랜드 행사, 사내 행사입니다.', en: 'Seminars, conferences, brand events and company gatherings.', de: 'Seminare, Konferenzen, Brand Events und Firmenfeiern.' }
  }
];

const EVENT_PRODUCT_SECTIONS = [
  {
    key: 'civil-core',
    category: 'civil',
    title: { ko: '암트 결혼식만', en: 'Ceremony only', de: 'Nur Trauung' },
    sub: { ko: '암트 결혼식만 진행하는 기본 구성입니다.', en: 'Coverage for the civil ceremony only.', de: 'Begleitung nur für die standesamtliche Trauung.' },
    ids: ['amtp', 'amtv']
  },
  {
    key: 'civil-after',
    category: 'wedparty',
    title: { ko: '본식 + 피로연 / 파티', en: 'Ceremony + reception / party', de: 'Trauung + Empfang / Party' },
    sub: { ko: '본식부터 이어지는 자리까지 하루를 함께 기록합니다.', en: 'We stay with you from the ceremony into the celebration.', de: 'Wir begleiten Sie von der Trauung bis in die Feier.' },
    ids: ['amtpr', 'amtvr', 'amtpp', 'amtvp']
  },
  {
    key: 'family',
    category: 'family',
    title: { ko: '돌잔치 / 가족 파티', en: 'First birthday & family party', de: 'Dol & Familienfeier' },
    sub: { ko: '돌상, 케이크, 가족 단체사진, 행사 순간들을 담습니다.', en: 'Dol table, cake, family group shots and the moments in between.', de: 'Dol-Tisch, Kuchen, Familienfotos und die Momente dazwischen.' },
    ids: ['dolp', 'evp', 'evv']
  },
  {
    key: 'private',
    category: 'private',
    title: { ko: '일반 행사', en: 'General event', de: 'Allgemeines Event' },
    sub: { ko: '공연, 전시, 커뮤니티 행사, 개인 이벤트를 위한 맞춤 견적입니다.', en: 'Custom quotes for performances, exhibitions, community events and private events.', de: 'Individuelle Angebote für Auftritte, Ausstellungen, Community-Events und private Veranstaltungen.' },
    ids: ['evp', 'evv', 'biz']
  },
  {
    key: 'corporate',
    category: 'corporate',
    title: { ko: '기업 행사', en: 'Corporate event', de: 'Firmenevent' },
    sub: { ko: '세미나, 컨퍼런스, 브랜드 행사, 사내 행사를 위한 맞춤 견적입니다.', en: 'Custom quotes for seminars, conferences, brand events and company gatherings.', de: 'Individuelle Angebote für Seminare, Konferenzen, Brand Events und Firmenfeiern.' },
    ids: ['evp', 'evv', 'biz']
  }
];

const EVENT_PRODUCT_CATEGORY_OVERRIDES = {
  family: {
    evp: {
      title: { ko: '가족 파티 사진 (맞춤 상담)', en: 'Family party photo (custom)', de: 'Familienfeier Foto (individuell)' },
      kicker: { ko: '2시간 초과 · 대규모', en: 'Longer or larger events', de: 'Längere / größere Feiern' },
      summary: { ko: '2시간이 넘거나 인원·장소가 큰 파티는 내용을 보고 견적을 드립니다.', en: 'For parties longer than 2 hours or with many guests — we quote after checking the details.', de: 'Für längere Feiern oder viele Gäste — Angebot nach Absprache.' }
    },
    evv: {
      title: { ko: '가족 파티 영상 (맞춤 상담)', en: 'Family party video (custom)', de: 'Familienfeier Video (individuell)' },
      kicker: { ko: '돌잔치 / 가족 파티', en: 'Family party', de: 'Familienfeier' },
      summary: { ko: '행사 시간과 편집 범위를 확인한 뒤 견적을 드립니다.', en: 'We quote after checking event length and editing scope.', de: 'Angebot nach Dauer und Schnittumfang.' }
    },
    biz: {
      title: { ko: '돌잔치/가족 파티 상담', en: 'Family party consultation', de: 'Familienfeier Beratung' },
      kicker: { ko: '돌잔치 / 가족 파티', en: 'Family party', de: 'Familienfeier' },
      summary: { ko: '돌상/장소/진행 순서부터 정리', en: 'Start with setup, venue and schedule', de: 'Dekoration, Ort und Ablauf zuerst klären' }
    }
  },
  private: {
    evp: {
      title: { ko: '일반 행사 사진', en: 'General event photo', de: 'Event Foto' },
      kicker: { ko: '일반 행사', en: 'General event', de: 'Allgemeines Event' },
      summary: { ko: '공연, 전시, 커뮤니티 행사, 개인 이벤트', en: 'Performance, exhibition, community event, private event', de: 'Auftritt, Ausstellung, Community-Event, private Veranstaltung' }
    },
    evv: {
      title: { ko: '일반 행사 영상', en: 'General event video', de: 'Event Video' },
      kicker: { ko: '일반 행사', en: 'General event', de: 'Allgemeines Event' },
      summary: { ko: '촬영 시간과 편집 범위 확인 후 견적', en: 'Quote after hours and edit scope check', de: 'Angebot nach Dauer und Schnittumfang' }
    },
    biz: {
      title: { ko: '일반 행사 상담', en: 'General event consultation', de: 'Event Beratung' },
      kicker: { ko: '일반 행사', en: 'General event', de: 'Allgemeines Event' }
    }
  },
  corporate: {
    evp: {
      title: { ko: '기업 행사 사진', en: 'Corporate event photo', de: 'Firmenevent Foto' },
      kicker: { ko: '기업 행사', en: 'Corporate event', de: 'Firmenevent' },
      summary: { ko: '세미나, 컨퍼런스, 브랜드 행사, 사내 행사', en: 'Seminar, conference, brand event, company gathering', de: 'Seminar, Konferenz, Brand Event, Firmenfeier' }
    },
    evv: {
      title: { ko: '기업 행사 영상', en: 'Corporate event video', de: 'Firmenevent Video' },
      kicker: { ko: '기업 행사', en: 'Corporate event', de: 'Firmenevent' },
      summary: { ko: '촬영 시간과 편집 범위 확인 후 견적', en: 'Quote after hours and edit scope check', de: 'Angebot nach Dauer und Schnittumfang' }
    },
    biz: {
      title: { ko: '기업 행사 상담', en: 'Corporate event consultation', de: 'Firmenevent Beratung' },
      kicker: { ko: '기업 행사', en: 'Corporate event', de: 'Firmenevent' },
      summary: { ko: '행사 규모와 납품 목적부터 정리', en: 'Start with event scale and delivery goals', de: 'Umfang und Lieferziel zuerst klären' }
    }
  }
};

const EVENT_PRODUCT_CARD_META = {
  biz: {
    title: { ko: '상담 먼저', en: 'Consultation first', de: 'Beratung zuerst' },
    kicker: { ko: '맞춤 상담', en: 'Custom', de: 'Individuell' },
    type: { ko: '사진 · 영상 · 사진+영상', en: 'Photo · Video · Hybrid', de: 'Foto · Video · Hybrid' },
    summary: { ko: '어떤 상품이 맞을지 애매할 때', en: 'For requests that need sorting first', de: 'Wenn der Umfang zuerst geklärt werden soll' }
  },
  amtp: {
    title: { ko: '암트 결혼식 사진', en: 'Civil wedding photo', de: 'Standesamt Foto' },
    kicker: { ko: '암트 결혼식만', en: 'Ceremony only', de: 'Nur Trauung' },
    type: { ko: '사진', en: 'Photo', de: 'Foto' },
    summary: { ko: '90분 · 원본 전체 · 보정본 15장', en: '90 min · all originals · 15 retouched', de: '90 Min. · alle Originale · 15 retuschiert' }
  },
  dolp: {
    title: { ko: '돌잔치/가족파티 사진', en: 'Family party photo', de: 'Familienfeier Foto' },
    kicker: { ko: '돌잔치 / 가족 파티', en: 'Family party', de: 'Familienfeier' },
    type: { ko: '사진', en: 'Photo', de: 'Foto' },
    summary: { ko: '2시간 · 원본 전체 · 보정본 15장', en: '2h · all originals · 15 retouched', de: '2 Std. · alle Originale · 15 retuschiert' }
  },
  amtv: {
    title: { ko: '암트 결혼식 영상', en: 'Civil wedding video', de: 'Standesamt Video' },
    kicker: { ko: '암트 결혼식만', en: 'Ceremony only', de: 'Nur Trauung' },
    type: { ko: '영상', en: 'Video', de: 'Video' },
    summary: { ko: '동선 확인 후 견적', en: 'Quote after schedule check', de: 'Angebot nach Ablaufprüfung' }
  },
  amtpr: {
    title: { ko: '피로연 포함 사진', en: 'Reception photo', de: 'Empfang Foto' },
    kicker: { ko: '암트 + 피로연', en: 'Ceremony + reception', de: 'Trauung + Empfang' },
    type: { ko: '사진', en: 'Photo', de: 'Foto' },
    summary: { ko: '간단한 식사/축하 자리까지', en: 'For a simple reception after the ceremony', de: 'Für kleinen Empfang nach der Trauung' }
  },
  amtvr: {
    title: { ko: '피로연 포함 영상', en: 'Reception video', de: 'Empfang Video' },
    kicker: { ko: '암트 + 피로연', en: 'Ceremony + reception', de: 'Trauung + Empfang' },
    type: { ko: '영상', en: 'Video', de: 'Video' },
    summary: { ko: '동선과 편집 범위 확인 후 견적', en: 'Quote after route and edit scope check', de: 'Angebot nach Ablauf und Schnittumfang' }
  },
  amtpp: {
    title: { ko: '파티 포함 사진', en: 'Party photo', de: 'Party Foto' },
    kicker: { ko: '암트 + 파티', en: 'Ceremony + party', de: 'Trauung + Party' },
    type: { ko: '사진', en: 'Photo', de: 'Foto' },
    summary: { ko: '리셉션/파티까지 길게 기록', en: 'Longer coverage through reception or party', de: 'Längere Begleitung bis Empfang oder Party' }
  },
  amtvp: {
    title: { ko: '파티 포함 영상', en: 'Party video', de: 'Party Video' },
    kicker: { ko: '암트 + 파티', en: 'Ceremony + party', de: 'Trauung + Party' },
    type: { ko: '영상', en: 'Video', de: 'Video' },
    summary: { ko: '행사 규모와 편집 범위 확인 후 견적', en: 'Quote after event scale and edit scope check', de: 'Angebot nach Umfang und Schnittumfang' }
  },
  evp: {
    title: { ko: '행사 사진', en: 'Event photo', de: 'Event Foto' },
    kicker: { ko: '일반 행사', en: 'General event', de: 'Allgemeines Event' },
    type: { ko: '사진', en: 'Photo', de: 'Foto' },
    summary: { ko: '돌잔치, 기업행사, 공연, 파티', en: 'Birthday, corporate, performance, party', de: 'Geburtstag, Firma, Auftritt, Party' }
  },
  evv: {
    title: { ko: '행사 영상', en: 'Event video', de: 'Event Video' },
    kicker: { ko: '일반 행사', en: 'General event', de: 'Allgemeines Event' },
    type: { ko: '영상', en: 'Video', de: 'Video' },
    summary: { ko: '촬영 시간과 편집 범위 확인 후 견적', en: 'Quote after hours and edit scope check', de: 'Angebot nach Dauer und Schnittumfang' }
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
  { key: 'video', label: { ko: '행사 영상', en: 'Event Video', de: 'Event Video' } },
  { key: 'hybrid', label: { ko: '사진+영상 (하이브리드)', en: 'Photo + Video (Hybrid)', de: 'Foto + Video (Hybrid)' } }
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

// 행사/기업 촬영 가격은 상담 후 견적으로만 안내한다 — 단가표를 프론트 번들에 싣지 않는다 (roadmap #10 Phase 1).

const AGE_META = [
  { key: 'baby', label: { ko: '영유아', en: 'Infant', de: 'Kleinkind' } },
  { key: 'kids', label: { ko: '키즈 (-€10)', en: 'Kids (-€10)', de: 'Kinder (-€10)' } },
  { key: 'adult', label: { ko: '성인', en: 'Adult', de: 'Erwachsene' } },
  { key: 'senior', label: { ko: '시니어', en: 'Senior', de: 'Senior' } }
];

const BABY_TYPE_META = [
  { key: 'infant', label: { ko: '일반 영유아', en: 'General Infant', de: 'Allgemeines Baby' } },
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
  { key: 'clean', label: { ko: '깔끔/모던', en: 'Clean / Modern', de: 'Sauber / Modern' } },
  { key: 'warm', label: { ko: '따뜻/자연', en: 'Warm / Natural', de: 'Warm / Natürlich' } },
  { key: 'pro', label: { ko: '전문/포멀', en: 'Professional / Formal', de: 'Professionell / Formal' } },
  { key: 'unique', label: { ko: '트렌디/유니크', en: 'Trendy / Unique', de: 'Trendy / Einzigartig' } },
  { key: 'baby', label: { ko: '백일/돌', en: 'Baby / Birthday', de: 'Baby / Geburtstag' } }
];

const COPY = {
  ko: {
    heroTitle: '예약하기',
    hero: '원하시는 촬영 종류와 일정을 선택한 뒤 예약 정보를 입력해 주세요.',
    loadingCopy: '예약 페이지를 준비하고 있습니다.',
    noticeTitle: '공지사항',
    closureTitle: '한국 일정으로 잠시 쉬어갑니다',
    closureBody: '2026년 10월 21일(수)부터 11월 25일(수)까지는 한국 일정으로 스튜디오 촬영이 어렵습니다.',
    closureMeta: '11월 26일(수)부터 정상 촬영을 재개합니다. 그 이후 일정은 지금도 예약·문의하실 수 있어요.',
    promoHighlightEyebrow: 'Studio mean Schultüte Portrait Event 2026',
    promoHighlightTitle: 'Schultüte Portrait Event 2026',
    promoHighlightBody(names) {
      return names
        ? `${names} 예약을 전용 이벤트 페이지에서 바로 진행하실 수 있습니다.`
        : '입학 예정 아이를 위한 시즌 한정 촬영을 전용 이벤트 페이지에서 예약하실 수 있습니다.';
    },
    promoHighlightState: '예약 가능',
    promoHighlightNamesLabel: '패키지',
    promoHighlightPeriodLabel: '기간',
    promoHighlightButton: 'Schultüte 이벤트 예약',
    promoHighlightButtonSub: 'Mini / Classic / Family 패키지 보기',
    consultationCtaTitle: '상담이 필요한 촬영은 먼저 알려주세요',
    consultationCtaBody: '웨딩, 기업행사, 영상 촬영, 방문/전화 상담은 상담 설문으로 일정과 촬영 범위를 보내 주세요.',
    consultationCtaMeta: '내용 확인 후 견적과 실제 예약 전환을 안내드립니다.',
    consultationCtaButton: '상담 설문 작성하기',
    quoteConsultationCopy: '일정, 장소, 촬영 범위를 먼저 정리하면 더 정확한 견적과 상담 예약을 바로 받을 수 있습니다.',
    quoteConsultationButton: '상담 설문으로 이동',
    groupMetaPriceLabel: '시작가',
    groupMetaDurationLabel: '소요',
    groupMetaDeliveryLabel: '전달',
    groupMetaPlaceLabel: '장소',
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
    voucherPromoTitle: '소중한 추억을 선물하세요 🎁',
    voucherPromoBody: '사랑하는 분께 Studio mean에서의 특별한 하루를 선물해 보세요. 기프트 바우처는 이메일 또는 인스타 DM으로 편하게 문의해 주세요.',
    voucherPromoCta: '기프트 바우처 문의',
    submitCardName: '이름',
    submitCardEmail: '이메일',
    submitCardDateTime: '예약 일시',
    submitCardProduct: '상품',
    submitCardPrice: '예상 금액',
    submitCardNote: '메일이 보이지 않으면 스팸함도 함께 확인해 주세요.',
    submitCardReturn: '재촬영 할인 대상 예약으로 접수되었습니다.',
    submitCardAction: '새 예약 시작',
    submitFail: '예약 제출 실패',
    productHelp: '상품을 선택하면 설명과 예약 가능 일정을 불러옵니다.',
    formHelp: '기본 예약 정보를 입력한 뒤 제출합니다.',
    earliestSlotTitle: '가장 빠른 예약 가능',
    earliestSlotLoading: '상품에 맞는 가장 빠른 예약 가능 시간을 찾고 있습니다.',
    earliestSlotEmpty: '현재 바로 안내할 수 있는 빠른 슬롯이 없습니다. 달력에서 다른 날짜를 확인해 주세요.',
    earliestSlotAction: '선택 후 바로 날짜와 시간을 이어서 고르실 수 있습니다.',
    generalTitle: '추가 설정',
    generalCopy: '인원이나 옵션을 선택하면 예상 금액이 다시 계산됩니다.',
    passportTitle: '여권/비자 옵션',
    passportCopy: '원하는 촬영국가와 인원 구성을 추가하면 국가별 추가 비용이 함께 반영됩니다.',
    passportHint: '기본 1개 국가는 포함되며, 추가 국가는 1개당 €5가 반영됩니다.',
    passportPeopleLabel: '인원수',
    peopleCustomPlaceholder: '6명 이상 직접입력',
    passportConfigLabel: '구성 {index}',
    passportConfigAdd: '구성 추가하기',
    passportCountryLabel: '원하는 촬영국가 선택',
    generalPeopleLabel: '인원',
    ageFieldLabel: '촬영 대상 연령',
    ageFieldHint: '영유아(만 0~2세) · 키즈(만 3~13세) · 성인(만 14~69세) · 시니어(만 70세 이상)',
    profileAgeLabel: '나이',
    profileAgePlaceholder: '예: 만 7세 / 72세',
    babyTypeFieldLabel: '백일/돌 구분',
    babyTypeHint: '분위기에서 백일/돌을 고르셨어요. 어느 쪽인지 선택해 주세요.',
    studioFamilyLabel: '가족 구성',
    studioFamilyPlaceholder: '예: 부모님 2명 + 아이 2명',
    optionFieldLabel: '추가 옵션',
    reshootingTitle: '재촬영 약관 동의',
    passAddonTitle: '여권사진 추가 촬영',
    passAddonCopy: '프로필/스튜디오와 함께 여권사진을 추가합니다.',
    passAddonPeopleLabel: '여권 인원',
    locationLabel: '희망 촬영 장소',
    locationPlaceholder: '예: Frankfurt Römer, Heidelberg Old Town',
    businessLabel: '행사 상세 내용',
    bizModeLabel: '촬영 유형',
    bizHoursLabel: '촬영 시간',
    bizEditLabel: '영상 편집',
    bizAddonLabel: '추가 요청',
    bizAddonHelp: '추가 요청은 예약 접수 후 세부 내용에 따라 별도 비용이 안내될 수 있습니다.',
    businessPlaceholder: '예: 돌잔치촬영 / 결혼식 / 암트결혼식 / 기업행사 · 예상 인원, 필요한 결과물을 적어 주세요.',
    surveyFieldLabel: '원하는 분위기',
    bgFieldLabel: '배경 선택',
    nameLabel: '이름',
    phoneLabel: '연락처',
    emailLabel: '이메일',
    emailGmailHint: '사진 전달은 Google Drive 링크로 이루어지므로 <b>Gmail 주소</b>를 권장드립니다.',
    emailGmailWarn: 'Gmail이 아니면 Drive 링크 수신에 문제가 생길 수 있습니다. 가능하면 Gmail 주소를 사용해 주세요.',
    requiredInfoLabel: '필수 예약 정보',
    requiredInfoCopy: '이름, 연락처, 이메일만 먼저 입력하시면 예약을 계속 진행할 수 있습니다.',
    optionalInfoLabel: '선택 입력',
    optionalInfoCopy: '송장, 추가 요청, 세부 정보는 필요한 경우에만 적어 주세요.',
    addressLabel: '주소 (인보이스용, 선택)',
    addressPlaceholder: '인보이스가 필요한 경우만 입력해 주세요',
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
    payerNamePlaceholder: '예약금 입금 시 사용할 예금주명을 적어 주세요',
    babyNameLabel: '아기 이름',
    babyNamePlaceholder: '백일/돌 촬영 아기 이름',
    otherCountryLabel: '기타 국가명',
    otherCountryPlaceholder: '예: France, Canada',
    memoLabel: '요청사항',
    consentTitle: '표준 촬영 계약서 및 예약 조건',
    consentCopy: '예약을 완료하기 전 아래 표준 촬영 계약 조건을 확인해 주세요. 본 조건은 예약 시 선택 또는 입력한 촬영 상품, 일정, 장소, 비용, 납품 방식 및 별도 합의사항과 함께 적용됩니다.',
    requiredConsentLabel: '필수 동의',
    optionalConsentLabel: '선택 동의',
    selectAllLabel: '필수 항목 전체 선택',
    selectAllSub: '표준 계약 및 개인정보 필수 항목을 한 번에 체크합니다.',
    contractTerms: [
      { t: '계약 당사자', p: '촬영자: Studio mean<br>의뢰자: 예약 시 입력한 고객 정보 기준' },
      { t: '촬영 계약 내용', p: '본 계약은 예약 시 선택 또는 입력한 촬영 상품, 촬영일, 촬영 시간, 촬영 장소, 비용, 납품 방식 및 별도 요청사항을 기준으로 합니다.<br>Studio mean은 해당 예약 내용에 따라 촬영을 준비하고 진행합니다.<br>촬영 전 필요한 예식 순서, 동선, 현장 담당자 정보, 촬영 제한 사항 또는 장소 규정은 의뢰자가 사전에 공유해야 합니다.' },
      { t: '비용 및 결제', p: '모든 금액은 brutto 기준입니다.<br>계약금이 있는 상품의 경우 계약금 입금 후 예약이 확정됩니다.<br>잔금은 촬영 당일 또는 촬영 후 7일 이내, 원본 또는 결과물 전달 전까지 지급합니다.<br>세금 표기는 최종 Rechnung 기준으로 처리합니다.' },
      { t: '납품 및 원본 전달', p: '납품 내용과 방식은 선택한 상품 또는 별도 합의 내용을 기준으로 합니다.<br>원본 전달이 포함된 경우, 기술적으로 사용 가능한 촬영 원본 디지털 파일을 전달합니다.<br>테스트 컷, 심한 중복 컷, 초점 실패, 노출 실패, 카메라 오류 등 납품 가치가 없는 파일은 제외될 수 있습니다.<br>RAW 파일은 상품 또는 별도 합의에 포함된 경우에만 제공됩니다.<br>RAW 파일 전달이 포함된 경우, 저장매체는 의뢰자가 준비하며 수령은 방문 수령으로 진행합니다.' },
      { t: '포함되지 않는 항목', p: '각 상품에 기본 포함된 인화는 상품 설명에 표시된 만큼 제공됩니다. 별도 합의가 없는 한 상세 보정, 색감 보정본, 피부 보정, 합성, 앨범, <b>기본 포함분 외 추가 인화</b>, 영상 촬영, 영상 편집, 추가 촬영 시간, 별도 출장비, 주차비, 입장료, 장소 촬영 허가비는 포함되지 않습니다.' },
      { t: '취소 및 환불', p: '촬영 30일 전까지 취소: 계약금 100% 환불<br>촬영 29~8일 전 취소: 계약금의 50% 환불<br>촬영 7~2일 전 취소: 계약금의 25% 환불<br>촬영 전날·당일 취소 또는 노쇼: 환불 불가<br>웨딩·프리웨딩 촬영에는 별도 환불 규정(촬영일 60/30/14/7일 기준)이 적용됩니다.' },
      { t: '저작권 및 이용권', p: '촬영물의 저작권 및 원저작권은 Studio mean에 있습니다.<br>고객은 전달받은 사진 또는 영상을 개인 보관, 가족 및 지인 공유, 개인 SNS 게시, 개인 인화 목적으로 사용할 수 있습니다.<br>상업적 사용, 재판매, 제3자 브랜드 또는 매체 제공, 대량 편집 및 2차 제작은 별도 서면 동의가 필요합니다.' },
      { t: '외부 공개 및 마케팅 사용', p: '본 표준 계약 동의에는 Studio mean이 식별 가능한 사진 또는 영상을 포트폴리오, SNS, 웹사이트, 광고 또는 홍보 자료로 사용하는 허락이 포함되지 않습니다.<br>외부 공개가 필요한 경우 별도 서면 동의를 받습니다.' },
      { t: '개인정보 및 보관', p: '개인정보와 이미지 파일은 예약, 계약 이행, 커뮤니케이션, 청구, 납품, 보관 목적에 한해 처리됩니다.<br>전달 파일은 납품 후 3개월 동안 보관될 수 있으며 이후 삭제될 수 있습니다.' }
    ],
    contractTermsSummary: '전체 계약 조건 보기',
    contractTermsSummaryHint: '필수 동의 전 필요한 경우 펼쳐서 확인해 주세요.',
    contractTermsLabel: '[필수] 표준 촬영 계약서 및 예약 조건에 동의합니다.',
    contractTermsSub: '예약 시 선택한 상품·일정·장소·비용과 위 표준 계약 조건이 함께 적용됩니다.',
    gdprLabel: '[필수] 개인정보가 예약, 결제, 촬영 진행, 파일 전달 목적으로 처리되는 것에 동의합니다.',
    gdprSub: '수집 항목은 예약·결제·촬영 진행·파일 전달에 필요한 범위로 한정되며, 별도 동의 없이 외부에 공개되지 않습니다.',
    aiLabel: '[필수] AI 보정 및 처리 안내에 동의합니다.',
    aiSub: '촬영본 보정과 결과물 제작 과정에서 AI 기반 도구가 보조적으로 활용될 수 있음을 안내합니다.',
    marketingLabel: '[선택] 마케팅/SNS/포트폴리오 활용에 동의합니다.',
    marketingSub: '촬영 결과물을 Studio mean의 웹사이트 및 SNS 홍보 용도로 활용하는 것에 동의합니다.',
    submitLabel: '예약 제출',
    submitLoading: '제출 중...',
    calendarPrompt: '상품을 먼저 선택하세요.',
    calendarEmpty: '상품 선택 후 달력을 불러옵니다.',
    calendarLoadedHint: '예약 가능 날짜를 선택해 주세요.',
    calendarMonthEmpty: '이 달에는 예약 가능한 날짜가 없어요. 다른 달을 확인해 주세요.',
    calendarMonthEmptyHint: '다른 달에서 예약 가능한 날짜를 선택해 주세요.',
    monthPrev: '이전 달',
    monthNext: '다음 달',
    slotPanelTitle: '예약 가능 시간',
    slotGridEmpty: '아직 선택된 날짜가 없습니다.',
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
    reviewProfileAge: '나이',
    reviewStudioFamily: '가족 구성',
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
    slotSectionRecommended: '추천 시간',
    slotSectionFastConfirm: '추천 시간',
    slotSectionMore: '추가 가능 시간',
    slotFastConfirmLabel: '추천',
    slotFastConfirmCopy: '스튜디오가 이 시간대에 가장 자연스럽게 준비되어 있습니다.',
    slotRequestOnlyLabel: '일반 시간',
    slotRequestOnlyCopy: '운영 확인 후 예약 확정이 진행됩니다.',
    slotMoreToggle: '다른 시간 더 보기',
    slotMoreHide: '추천 시간만 보기',
    slotUntilLabel: '예상 종료',
    slotNearLabel: '기준 예약과 {distance}분 간격',
    initFail: '초기화 실패',
    yes: '동의',
    no: '미동의',
    holidayNotice: '설정된 휴무일과 마감된 일정은 달력에서 자동으로 선택 불가 처리됩니다.',
    holidayListLabel: '예정 휴무일',
    legendFullLabel: '마감 (대기 등록)',
    legendClosedLabel: '휴무일',
    calendarFullShort: '마감',
    calendarClosedShort: '휴무'
  },
  en: {
    heroTitle: 'Book Your Session',
    hero: 'Choose your shoot type and schedule, then enter your booking details.',
    loadingCopy: 'Preparing the booking page.',
    noticeTitle: 'Notice',
    closureTitle: 'Away Oct 21 – Nov 25, back on Nov 26',
    closureBody: 'From Wednesday 21 October to Wednesday 25 November 2026 we are in Korea, so no shoots take place at the studio.',
    closureMeta: 'We are back for you from Wednesday 26 November. Dates after that can already be booked and enquired about today.',
    promoHighlightEyebrow: 'Studio mean Schultüte Portrait Event 2026',
    promoHighlightTitle: 'Schultüte Portrait Event 2026',
    promoHighlightBody(names) {
      return names
        ? `You can view and book ${names} directly on the event page.`
        : 'Book the limited Schultüte portrait event for children starting school.';
    },
    promoHighlightState: 'Now Booking',
    promoHighlightNamesLabel: 'Packages',
    promoHighlightPeriodLabel: 'Period',
    promoHighlightButton: 'Book Schultüte event',
    promoHighlightButtonSub: 'View Mini / Classic / Family packages',
    consultationCtaTitle: 'Need a consultation first?',
    consultationCtaBody: 'For weddings, corporate events, video work, phone calls, or studio visits, please start with the consultation form.',
    consultationCtaMeta: 'After consultation, the request can be converted into an actual booking.',
    consultationCtaButton: 'Open consultation form',
    quoteConsultationCopy: 'Share the schedule, location and scope first so we can prepare a clearer quote and consultation appointment.',
    quoteConsultationButton: 'Go to consultation form',
    groupMetaPriceLabel: 'Starting at',
    groupMetaDurationLabel: 'Duration',
    groupMetaDeliveryLabel: 'Delivery',
    groupMetaPlaceLabel: 'Place',
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
    voucherPromoTitle: 'Gift a cherished memory 🎁',
    voucherPromoBody: 'Give someone you love a special day at Studio mean. For gift vouchers, just reach out by email or Instagram DM.',
    voucherPromoCta: 'Ask about gift vouchers',
    submitCardName: 'Name',
    submitCardEmail: 'Email',
    submitCardDateTime: 'Booking time',
    submitCardProduct: 'Package',
    submitCardPrice: 'Estimated price',
    submitCardNote: 'If you do not see the email, please check your spam folder as well.',
    submitCardReturn: 'This booking was received with the same-day reshoot discount.',
    submitCardAction: 'Start another booking',
    submitFail: 'Booking submission failed',
    productHelp: 'Choose a package to see the description and available schedule.',
    formHelp: 'Enter the basic booking details and submit.',
    earliestSlotTitle: 'Earliest available booking',
    earliestSlotLoading: 'Checking the earliest available time for this package.',
    earliestSlotEmpty: 'No quick slot is available right now. Please review the calendar for other dates.',
    earliestSlotAction: 'After choosing the package, you can continue straight to the date and time.',
    generalTitle: 'Additional Settings',
    generalCopy: 'Changing people or options recalculates the estimated price.',
    passportTitle: 'Passport / Visa options',
    passportCopy: 'Add each country and people combination to reflect the correct passport / visa quote.',
    passportHint: 'One country is included. Each additional country adds €5.',
    passportPeopleLabel: 'People',
    peopleCustomPlaceholder: '6+ people (enter manually)',
    passportConfigLabel: 'Configuration {index}',
    passportConfigAdd: 'Add another configuration',
    passportCountryLabel: 'Choose desired countries',
    generalPeopleLabel: 'People',
    ageFieldLabel: 'Age Group',
    ageFieldHint: 'Infant (0-2) · Kids (3-13) · Adult (14-69) · Senior (70+)',
    profileAgeLabel: 'Age',
    profileAgePlaceholder: 'e.g. 7 years old / 72 years old',
    babyTypeFieldLabel: 'Baby Session Type',
    babyTypeHint: 'You chose Baby / Birthday as the mood. Please pick which one.',
    studioFamilyLabel: 'Family members',
    studioFamilyPlaceholder: 'e.g. 2 parents + 2 children',
    optionFieldLabel: 'Additional Options',
    reshootingTitle: 'Reshooting Consent',
    passAddonTitle: 'Passport Add-on',
    passAddonCopy: 'Add passport photos together with profile/studio.',
    passAddonPeopleLabel: 'Passport People',
    locationLabel: 'Preferred Location',
    locationPlaceholder: 'e.g. Frankfurt Römer, Heidelberg Old Town',
    businessLabel: 'Event Details',
    bizModeLabel: 'Session Type',
    bizHoursLabel: 'Coverage',
    bizEditLabel: 'Video Edit',
    bizAddonLabel: 'Optional Requests',
    bizAddonHelp: 'Optional requests are reviewed after booking and may require an extra quote.',
    businessPlaceholder: 'e.g. birthday party / wedding / city hall wedding / corporate event · expected guests and required deliverables',
    surveyFieldLabel: 'Preferred Mood',
    bgFieldLabel: 'Background Selection',
    nameLabel: 'Name',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    emailGmailHint: 'Photos are delivered via a Google Drive link, so a <b>Gmail address</b> is recommended.',
    emailGmailWarn: 'A non-Gmail address may have trouble receiving the Drive link. Please use Gmail if possible.',
    requiredInfoLabel: 'Required details',
    requiredInfoCopy: 'Only name, phone, and email are needed to keep going with the booking.',
    optionalInfoLabel: 'Optional details',
    optionalInfoCopy: 'Invoice details and extra notes are only needed if they matter for this booking.',
    addressLabel: 'Address (optional, for invoice)',
    addressPlaceholder: 'Enter only if you need an invoice',
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
    payerNamePlaceholder: 'Enter the account holder name used for the deposit transfer',
    babyNameLabel: 'Baby Name',
    babyNamePlaceholder: 'Baby name for baby / first birthday session',
    otherCountryLabel: 'Other Country',
    otherCountryPlaceholder: 'e.g. France, Canada',
    memoLabel: 'Notes',
    consentTitle: 'Standard photography contract and booking terms',
    consentCopy: 'Please read the standard contract terms below before completing your booking. They apply together with the shooting package, date, location, price, delivery method and any separate agreements selected or entered at booking.',
    requiredConsentLabel: 'Required',
    optionalConsentLabel: 'Optional',
    selectAllLabel: 'Select all required items',
    selectAllSub: 'Checks the standard contract and privacy consent items together.',
    contractTerms: [
      { t: 'Contracting parties', p: 'Photographer: Studio mean<br>Client: as per the customer details entered at booking' },
      { t: 'Scope of the shoot', p: 'This agreement is based on the shooting package, date, time, location, price, delivery method and any special requests selected or entered at booking.<br>Studio mean prepares and carries out the shoot on the basis of those booking details.<br>The client shares the schedule, routes, on-site contact person, photographic restrictions or venue rules in good time before the shoot.' },
      { t: 'Fees and payment', p: 'All amounts are gross (incl. VAT).<br>For packages with a deposit, the booking is confirmed once the deposit has been received.<br>The balance is due on the day of the shoot or within 7 days after it, and in any case before the files or results are delivered.<br>Tax is shown as stated on the final invoice (Rechnung).' },
      { t: 'Delivery and original files', p: 'The content and method of delivery follow the booked package or a separate agreement.<br>Where original files are included, technically usable original digital files are delivered.<br>Test shots, heavy duplicates, out-of-focus or clearly mis-exposed frames, camera errors and files with no delivery value may be sorted out.<br>RAW files are provided only if they are included in the package or in a separate agreement.<br>Where RAW files are delivered, the client provides the storage medium and collection takes place in person at the studio.' },
      { t: 'Services not included', p: 'The prints included in each package are as stated in the package description. Unless separately agreed, detailed retouching, colour-graded selects, skin retouching, composings, albums, <b>prints beyond the quantity included in the package</b>, video recording, video editing, additional shooting time, separate travel costs, parking fees, entrance fees or venue permit fees are not included.' },
      { t: 'Cancellation and refund', p: 'Cancellation up to 30 days before the shoot: 100% of the deposit refunded<br>29-8 days before the shoot: 50% of the deposit<br>7-2 days before the shoot: 25% of the deposit<br>Cancellation on the previous day, on the day of the shoot, or no-show: no refund<br>A separate refund schedule applies to wedding and prewedding shoots (60/30/14/7 days before the shoot).' },
      { t: 'Copyright and usage rights', p: 'The copyright and related rights in the images remain with Studio mean.<br>The client receives a simple right of use for private archiving, sharing with family and friends, private social media use and private prints.<br>Commercial use, resale, provision to third-party brands or media, and extensive editing or derivative work require separate written consent.' },
      { t: 'Publication and marketing use', p: 'This standard contract consent does not include permission for Studio mean to use identifiable photos or videos for portfolio, social media, website, advertising or self-promotion.<br>If external publication is desired, separate written consent is obtained for it.' },
      { t: 'Data protection and storage', p: 'Personal data and image files are processed only for booking, performance of the contract, communication, invoicing, delivery and storage.<br>Delivered files may be retained for 3 months after delivery and may be deleted thereafter.' }
    ],
    contractTermsSummary: 'View all contract terms',
    contractTermsSummaryHint: 'Expand to read them before giving the required consent.',
    contractTermsLabel: '[Required] I agree to the standard photography contract and booking terms.',
    contractTermsSub: 'The package, date, location and price selected at booking apply together with the standard terms above.',
    gdprLabel: '[Required] I agree that my personal data is processed for booking, payment, carrying out the shoot and delivering the files.',
    gdprSub: 'Data is limited to what is needed for booking, payment, carrying out the shoot and delivering files, and is not published without separate consent.',
    aiLabel: '[Required] I agree to the AI retouching and processing notice.',
    aiSub: 'AI-based tools may be used as supporting tools during the retouching and delivery workflow.',
    marketingLabel: '[Optional] I agree to marketing/SNS/portfolio usage.',
    marketingSub: 'I agree that the final images may be used on Studio mean website and social media for promotion.',
    submitLabel: 'Submit Booking',
    submitLoading: 'Submitting...',
    calendarPrompt: 'Choose a package first.',
    calendarEmpty: 'Choose a package to load the calendar.',
    calendarLoadedHint: 'Choose an available date.',
    calendarMonthEmpty: 'No open dates this month. Please check another month.',
    calendarMonthEmptyHint: 'Choose an available date in another month.',
    monthPrev: 'Previous month',
    monthNext: 'Next month',
    slotPanelTitle: 'Available Times',
    slotGridEmpty: 'No date selected yet.',
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
    reviewProfileAge: 'Age',
    reviewStudioFamily: 'Family members',
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
    slotSectionRecommended: 'Recommended times',
    slotSectionFastConfirm: 'Recommended times',
    slotSectionMore: 'More available times',
    slotFastConfirmLabel: 'Recommended',
    slotFastConfirmCopy: 'The studio is best prepared around this time.',
    slotRequestOnlyLabel: 'Standard',
    slotRequestOnlyCopy: 'We will confirm this time after a quick review.',
    slotMoreToggle: 'Show more times',
    slotMoreHide: 'Show recommended times only',
    slotUntilLabel: 'Estimated end',
    slotNearLabel: '{distance} min from the nearest booking',
    initFail: 'Initialization failed',
    yes: 'Agreed',
    no: 'Not agreed',
    holidayNotice: 'Configured holidays and blocked dates are automatically disabled in the calendar.',
    holidayListLabel: 'Upcoming closed dates',
    legendFullLabel: 'Fully booked (waitlist)',
    legendClosedLabel: 'Closed day',
    calendarFullShort: 'Full',
    calendarClosedShort: 'Closed'
  },
  de: {
    heroTitle: 'Termin buchen',
    hero: 'Wählen Sie zuerst die gewünschte Aufnahmeart und den Termin, danach geben Sie Ihre Buchungsdaten ein.',
    loadingCopy: 'Buchungsseite wird vorbereitet.',
    noticeTitle: 'Hinweis',
    closureTitle: '21.10.–25.11. keine Shootings, ab 26.11. wieder für euch da',
    closureBody: 'Von Mittwoch, 21. Oktober bis Mittwoch, 25. November 2026 sind wir in Korea – in dieser Zeit finden keine Shootings im Studio statt.',
    closureMeta: 'Ab Mittwoch, 26. November sind wir wieder für euch da. Termine danach könnt ihr schon jetzt buchen und anfragen.',
    promoHighlightEyebrow: 'Studio mean Schultüte Portrait Event 2026',
    promoHighlightTitle: 'Schultüten-Portraits zur Einschulung 2026',
    promoHighlightBody(names) {
      return names
        ? `${names} können direkt über die Event-Seite angesehen und gebucht werden.`
        : 'Buchen Sie die saisonale Schultüten-Portraitaktion zur Einschulung.';
    },
    promoHighlightState: 'Jetzt buchbar',
    promoHighlightNamesLabel: 'Pakete',
    promoHighlightPeriodLabel: 'Zeitraum',
    promoHighlightButton: 'Schultüten-Event buchen',
    promoHighlightButtonSub: 'Mini / Classic / Family Pakete ansehen',
    consultationCtaTitle: 'Erst Beratung gewünscht?',
    consultationCtaBody: 'Für Hochzeiten, Firmenevents, Video, Telefontermine oder Studiobesuche nutzen Sie bitte zuerst das Beratungsformular.',
    consultationCtaMeta: 'Nach der Beratung kann die Anfrage direkt in eine Buchung umgewandelt werden.',
    consultationCtaButton: 'Beratungsformular öffnen',
    quoteConsultationCopy: 'Mit Ablauf, Ort und Umfang vorab können wir ein klareres Angebot und einen Beratungstermin vorbereiten.',
    quoteConsultationButton: 'Zum Beratungsformular',
    groupMetaPriceLabel: 'Ab',
    groupMetaDurationLabel: 'Dauer',
    groupMetaDeliveryLabel: 'Lieferung',
    groupMetaPlaceLabel: 'Ort',
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
    voucherPromoTitle: 'Verschenken Sie eine schöne Erinnerung 🎁',
    voucherPromoBody: 'Schenken Sie einem lieben Menschen einen besonderen Tag bei Studio mean. Gutscheine gerne per E-Mail oder Instagram-DM anfragen.',
    voucherPromoCta: 'Gutschein anfragen',
    submitCardName: 'Name',
    submitCardEmail: 'E-Mail',
    submitCardDateTime: 'Termin',
    submitCardProduct: 'Paket',
    submitCardPrice: 'Geschätzter Preis',
    submitCardNote: 'Falls keine E-Mail sichtbar ist, prüfen Sie bitte auch den Spam-Ordner.',
    submitCardReturn: 'Diese Buchung wurde mit Rabatt für erneute Aufnahme erfasst.',
    submitCardAction: 'Neue Buchung starten',
    submitFail: 'Buchung fehlgeschlagen',
    productHelp: 'Wählen Sie ein Paket, um Beschreibung und verfügbare Termine zu sehen.',
    formHelp: 'Geben Sie die Basisdaten ein und senden Sie die Anfrage ab.',
    earliestSlotTitle: 'Frühester verfügbarer Termin',
    earliestSlotLoading: 'Der früheste verfügbare Termin für dieses Paket wird geprüft.',
    earliestSlotEmpty: 'Im Moment ist kein schneller Termin verfügbar. Bitte prüfen Sie weitere Daten im Kalender.',
    earliestSlotAction: 'Nach der Auswahl können Sie direkt mit Datum und Uhrzeit weitergehen.',
    generalTitle: 'Zusätzliche Einstellungen',
    generalCopy: 'Bei Änderung von Personen oder Optionen wird der geschätzte Preis neu berechnet.',
    passportTitle: 'Pass / Visum Optionen',
    passportCopy: 'Fügen Sie Land- und Personenkombinationen hinzu, damit das Angebot korrekt berechnet wird.',
    passportHint: 'Ein Land ist inklusive. Jedes weitere Land kostet €5 extra.',
    passportPeopleLabel: 'Personenzahl',
    peopleCustomPlaceholder: 'Ab 6 Personen direkt eingeben',
    passportConfigLabel: 'Konfiguration {index}',
    passportConfigAdd: 'Weitere Konfiguration hinzufügen',
    passportCountryLabel: 'Gewünschte Aufnahmeländer',
    generalPeopleLabel: 'Personen',
    ageFieldLabel: 'Altersgruppe',
    ageFieldHint: 'Säugling (0-2) · Kinder (3-13) · Erwachsene (14-69) · Senioren (ab 70)',
    profileAgeLabel: 'Alter',
    profileAgePlaceholder: 'z. B. 7 Jahre / 72 Jahre',
    babyTypeFieldLabel: 'Baby-Aufnahmetyp',
    babyTypeHint: 'Sie haben Baby / Geburtstag als Stimmung gewählt. Bitte wählen Sie, welches.',
    studioFamilyLabel: 'Familienmitglieder',
    studioFamilyPlaceholder: 'z. B. 2 Eltern + 2 Kinder',
    optionFieldLabel: 'Zusätzliche Optionen',
    reshootingTitle: 'Einwilligung zum Nachshooting',
    passAddonTitle: 'Passfoto Zusatz',
    passAddonCopy: 'Passfotos zusammen mit Profil/Studio hinzufügen.',
    passAddonPeopleLabel: 'Passfoto Personen',
    locationLabel: 'Gewünschter Aufnahmeort',
    locationPlaceholder: 'z. B. Frankfurt Römer, Heidelberger Altstadt',
    businessLabel: 'Eventdetails',
    bizModeLabel: 'Aufnahmetyp',
    bizHoursLabel: 'Stunden',
    bizEditLabel: 'Videoschnitt',
    bizAddonLabel: 'Zusatzanfragen',
    bizAddonHelp: 'Zusatzwünsche werden nach der Buchung geprüft und ggf. separat angeboten.',
    businessPlaceholder: 'z. B. Geburtstag / Hochzeit / standesamtliche Trauung / Firmenevent · erwartete Personenzahl und gewünschte Ergebnisse',
    surveyFieldLabel: 'Gewünschte Stimmung',
    bgFieldLabel: 'Hintergrundauswahl',
    nameLabel: 'Name',
    phoneLabel: 'Telefon',
    emailLabel: 'E-Mail',
    emailGmailHint: 'Die Bildübergabe erfolgt per Google-Drive-Link, daher empfehlen wir eine <b>Gmail-Adresse</b>.',
    emailGmailWarn: 'Mit anderen E-Mail-Adressen kann es Probleme beim Empfang des Drive-Links geben. Wenn möglich, bitte Gmail verwenden.',
    requiredInfoLabel: 'Pflichtangaben',
    requiredInfoCopy: 'Name, Telefon und E-Mail reichen zunächst aus, um mit der Buchung weiterzugehen.',
    optionalInfoLabel: 'Optionale Angaben',
    optionalInfoCopy: 'Rechnungsdaten und zusätzliche Hinweise nur ergänzen, wenn sie für diese Buchung nötig sind.',
    addressLabel: 'Adresse (optional, für Rechnung)',
    addressPlaceholder: 'Nur eingeben, wenn eine Rechnung benötigt wird',
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
    payerNamePlaceholder: 'Bitte den Kontoinhaber für die Anzahlung per Überweisung eintragen',
    babyNameLabel: 'Babyname',
    babyNamePlaceholder: 'Babyname für Baby- / 1. Geburtstag-Shooting',
    otherCountryLabel: 'Anderes Land',
    otherCountryPlaceholder: 'z. B. Frankreich, Kanada',
    memoLabel: 'Hinweise',
    consentTitle: 'Standard-Fotovertrag und Buchungsbedingungen',
    consentCopy: 'Bitte prüfen Sie vor Abschluss der Buchung die folgenden Standard-Vertragsbedingungen. Diese Bedingungen gelten zusammen mit dem bei der Buchung ausgewählten oder eingegebenen Shooting-Paket, Termin, Ort, Preis, Lieferart und gesonderten Vereinbarungen.',
    requiredConsentLabel: 'Pflicht',
    optionalConsentLabel: 'Optional',
    selectAllLabel: 'Alle Pflichtangaben auswählen',
    selectAllSub: 'Bestätigt Standardvertrag und Datenschutz zusammen.',
    contractTerms: [
      { t: 'Vertragsparteien', p: 'Auftragnehmer: Studio mean<br>Auftraggeberin bzw. Auftraggeber: gemäß den bei der Buchung eingegebenen Kundendaten' },
      { t: 'Vertragsinhalt', p: 'Dieser Vertrag richtet sich nach dem bei der Buchung ausgewählten oder eingegebenen Shooting-Paket, Termin, Zeitraum, Ort, Preis, Lieferart und besonderen Wünschen.<br>Studio mean bereitet das Shooting auf Grundlage dieser Buchungsdaten vor und führt es entsprechend durch.<br>Ablaufplan, Wege, Ansprechpartner vor Ort, fotografische Einschränkungen oder Regeln der Location teilt die Auftraggeberin bzw. der Auftraggeber rechtzeitig vor dem Termin mit.' },
      { t: 'Vergütung und Zahlung', p: 'Alle Beträge verstehen sich brutto.<br>Bei Buchungen mit Anzahlung ist der Termin nach Eingang der Anzahlung verbindlich reserviert.<br>Der Restbetrag ist am Shootingtag oder innerhalb von 7 Tagen nach dem Termin, jedenfalls vor Lieferung der Dateien oder Ergebnisse, fällig.<br>Die steuerliche Ausweisung erfolgt gemäß Rechnung.' },
      { t: 'Lieferung und Originaldateien', p: 'Inhalt und Art der Lieferung richten sich nach dem gebuchten Paket oder einer gesonderten Vereinbarung.<br>Wenn Originaldateien enthalten sind, werden technisch verwertbare digitale Originaldateien geliefert.<br>Testaufnahmen, starke Dubletten, unscharfe oder deutlich fehlbelichtete Aufnahmen, Kamerafehler und Dateien ohne Lieferwert können aussortiert werden.<br>RAW-Dateien werden nur geliefert, wenn sie im Paket oder in einer gesonderten Vereinbarung enthalten sind.<br>Wenn RAW-Dateien geliefert werden, stellt die Auftraggeberin bzw. der Auftraggeber das Speichermedium bereit. Die Übergabe erfolgt persönlich bei Abholung vor Ort.' },
      { t: 'Nicht enthaltene Leistungen', p: 'Die im jeweiligen Paket enthaltenen Abzüge sind in der Paketbeschreibung angegeben. Soweit nicht gesondert vereinbart, sind Detailretusche, farblich bearbeitete Auswahlbilder, Hautretusche, Composings, Alben, <b>Abzüge über die im Paket enthaltene Menge hinaus</b>, Videoaufnahmen, Videoschnitt, zusätzliche Shootingzeit, gesonderte Reisekosten, Parkgebühren, Eintrittsgebühren oder Genehmigungsgebühren der Location nicht enthalten.' },
      { t: 'Stornierung und Erstattung', p: 'Bis 30 Tage vor dem Termin: 100% der Anzahlung wird erstattet<br>29-8 Tage vor dem Termin: 50% der Anzahlung<br>7-2 Tage vor dem Termin: 25% der Anzahlung<br>Stornierung am Vortag, am Shootingtag oder Nichterscheinen: keine Erstattung<br>Für Hochzeits- und Prewedding-Shootings gilt eine gesonderte Erstattungsstaffel (60/30/14/7 Tage vor dem Termin).' },
      { t: 'Urheberrecht und Nutzungsrecht', p: 'Die Urheber- und Leistungsschutzrechte an den Aufnahmen verbleiben bei Studio mean.<br>Die Kundin bzw. der Kunde erhält ein einfaches Nutzungsrecht für private Archivierung, Weitergabe an Familie und Freunde, private Social-Media-Nutzung und private Prints.<br>Kommerzielle Nutzung, Weiterverkauf, Weitergabe an Marken oder Medien sowie umfangreiche Bearbeitung oder Weiterverarbeitung bedürfen einer gesonderten schriftlichen Zustimmung.' },
      { t: 'Veröffentlichung und Werbung', p: 'Diese Standard-Vertragszustimmung enthält keine Einwilligung, identifizierbare Fotos oder Videos für Portfolio, Social Media, Website, Werbung oder Eigenwerbung von Studio mean zu verwenden.<br>Falls eine externe Veröffentlichung gewünscht wird, wird dafür eine gesonderte schriftliche Einwilligung eingeholt.' },
      { t: 'Datenschutz und Speicherung', p: 'Personenbezogene Daten und Bilddateien werden zur Buchung, Vertragsdurchführung, Kommunikation, Abrechnung, Lieferung und Speicherung verarbeitet.<br>Gelieferte Dateien können nach Lieferung 3 Monate gesichert und danach gelöscht werden.' }
    ],
    contractTermsSummary: 'Alle Vertragsbedingungen anzeigen',
    contractTermsSummaryHint: 'Bei Bedarf vor der Pflichtzustimmung ausklappen.',
    contractTermsLabel: '[Pflicht] Ich stimme dem Standard-Fotovertrag und den Buchungsbedingungen zu.',
    contractTermsSub: 'Das bei der Buchung gewählte Paket, der Termin, der Ort und der Preis gelten zusammen mit den obigen Standardbedingungen.',
    gdprLabel: '[Pflicht] Ich stimme zu, dass meine personenbezogenen Daten für Buchung, Zahlung, Durchführung des Shootings und Lieferung der Dateien verarbeitet werden.',
    gdprSub: 'Die Daten beschränken sich auf das, was für Buchung, Zahlung, Durchführung des Shootings und Lieferung nötig ist, und werden ohne gesonderte Einwilligung nicht veröffentlicht.',
    aiLabel: '[Pflicht] Ich stimme dem Hinweis zur KI-Bearbeitung zu.',
    aiSub: 'KI-basierte Werkzeuge können unterstützend bei Retusche und Auslieferung eingesetzt werden.',
    marketingLabel: '[Optional] Ich stimme Marketing/SNS/Portfolio-Nutzung zu.',
    marketingSub: 'Ich bin einverstanden, dass die Ergebnisse zu Werbezwecken auf der Website und in sozialen Medien von Studio mean genutzt werden dürfen.',
    submitLabel: 'Buchung senden',
    submitLoading: 'Wird gesendet...',
    calendarPrompt: 'Bitte zuerst ein Paket wählen.',
    calendarEmpty: 'Bitte zuerst ein Paket wählen, um den Kalender zu laden.',
    calendarLoadedHint: 'Bitte wählen Sie ein verfügbares Datum.',
    calendarMonthEmpty: 'In diesem Monat sind keine Termine frei. Bitte prüfen Sie einen anderen Monat.',
    calendarMonthEmptyHint: 'Bitte wählen Sie einen freien Termin in einem anderen Monat.',
    monthPrev: 'Vorheriger Monat',
    monthNext: 'Nächster Monat',
    slotPanelTitle: 'Verfügbare Zeiten',
    slotGridEmpty: 'Noch kein Datum ausgewählt.',
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
    reviewProfileAge: 'Alter',
    reviewStudioFamily: 'Familienmitglieder',
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
    slotSectionRecommended: 'Empfohlene Zeiten',
    slotSectionFastConfirm: 'Empfohlene Zeiten',
    slotSectionMore: 'Weitere Zeiten',
    slotFastConfirmLabel: 'Empfohlen',
    slotFastConfirmCopy: 'Das Studio ist rund um diese Zeit optimal vorbereitet.',
    slotRequestOnlyLabel: 'Weitere Zeiten',
    slotRequestOnlyCopy: 'Diese Zeit wird nach einer kurzen Prüfung bestätigt.',
    slotMoreToggle: 'Weitere Zeiten anzeigen',
    slotMoreHide: 'Nur empfohlene Zeiten anzeigen',
    slotUntilLabel: 'Voraussichtliches Ende',
    slotNearLabel: '{distance} Min. Abstand zur nächsten Buchung',
    initFail: 'Initialisierung fehlgeschlagen',
    yes: 'Zustimmung',
    no: 'Keine Zustimmung',
    holidayNotice: 'Eingestellte Ruhetage und gesperrte Termine werden im Kalender automatisch deaktiviert.',
    holidayListLabel: 'Kommende Ruhetage',
    legendFullLabel: 'Ausgebucht (Warteliste)',
    legendClosedLabel: 'Ruhetag',
    calendarFullShort: 'Voll',
    calendarClosedShort: 'Ruhe'
  }
};

const state = {
  init: null,
  lang: readStoredLang(),
  selectedGroup: '',
  bizTrack: '',
  selectedProduct: null,
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  selectedDate: '',
  selectedSlot: '',
  selectedSlotMeta: null,
  showAllSlots: false,
  selectedCountries: [],
  passportConfigs: [],
  passportPersonCountries: [],
  optionKeys: [],
  surveyKeys: [],
  ageGroup: 'adult',
  babyType: 'infant',
  bgColors: [],
  businessMode: 'photo',
  businessHours: '2',
  businessVideoEdit: 'raw',
  businessAddonKeys: [],
  eventCategory: '',
  activeStep: 1,
  returnEligible: false,
  returnNoticeTimer: null,
  returnNoticeToken: 0,
  quoteToken: 0,
  earliestSlotToken: 0,
  calendarRequestToken: 0,
  slotRequestToken: 0,
  calendarWarmupStarted: false,
  calendarWarmupInFlight: new Set(),
  quote: null,
  earliestSlotInfo: null,
  calendarCache: new Map(),
  slotCache: new Map(),
  slotPrefetchInFlight: new Map(),
  gutschein: null,
  gutscheinDraftId: '',
  gutscheinTimer: null
};

const els = {
  shell: document.querySelector('.shell'),
  hero: document.querySelector('.hero'),
  heroLangPanel: document.getElementById('heroLangPanel'),
  heroTitle: document.getElementById('heroTitle'),
  banner: document.getElementById('statusBanner'),
  noticePanel: document.getElementById('noticePanel'),
  noticeTitle: document.getElementById('noticeTitle'),
  noticeBody: document.getElementById('noticeBody'),
  noticeMeta: document.getElementById('noticeMeta'),
  closureBanner: document.getElementById('closureBanner'),
  closureBannerTitle: document.getElementById('closureBannerTitle'),
  closureBannerBody: document.getElementById('closureBannerBody'),
  closureBannerMeta: document.getElementById('closureBannerMeta'),
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
  quickSlotBox: document.getElementById('quickSlotBox'),
  passportPanel: document.getElementById('passportPanel'),
  passportCountries: document.getElementById('passportCountries'),
  passportAddConfigBtn: document.getElementById('passportAddConfigBtn'),
  passportHint: document.getElementById('passportHint'),
  generalPanel: document.getElementById('generalPanel'),
  generalCopy: document.getElementById('generalCopy'),
  ageField: document.getElementById('ageField'),
  ageGrid: document.getElementById('ageGrid'),
  seniorWarning: document.getElementById('seniorWarning'),
  profileAgeField: document.getElementById('profileAgeField'),
  profileAgeInput: document.getElementById('profileAgeInput'),
  babyTypeField: document.getElementById('babyTypeField'),
  babyTypeHint: document.getElementById('babyTypeHint'),
  babyTypeGrid: document.getElementById('babyTypeGrid'),
  optionField: document.getElementById('optionField'),
  reshootingField: document.getElementById('reshootingField'),
  reshootingConsent: document.getElementById('reshootingConsent'),
  reshootingText: document.getElementById('reshootingText'),
  peopleField: document.getElementById('peopleField'),
  generalPeople: document.getElementById('generalPeople'),
  generalPeopleCustom: document.getElementById('generalPeopleCustom'),
  studioFamilyField: document.getElementById('studioFamilyField'),
  studioFamilyInput: document.getElementById('studioFamilyInput'),
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
  bizConfigField: document.getElementById('bizConfigField'),
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

/* ⚠ boot() 호출은 이 파일 **맨 끝**에 있다. 여기서 부르면 안 된다.
   boot() 의 캐시 분기는 첫 await 이전에 동기로 renderInitData 까지 실행하는데, 그 시점엔 이 아래에
   선언된 모듈 최상위 const 들이 아직 TDZ 라 ReferenceError 로 죽는다(실측: FAMEVT_PRODUCT_IDS,
   booking.js:2917 → getGroupProducts → renderGroups). 캐시가 없을 땐 await 뒤에 렌더해서 안 터졌기에
   "같은 탭에서 5분 내 새로고침한 고객만 로딩 화면에서 멈추는" 형태로 오래 숨어 있었다. */
async function boot() {
  wireEvents();
  applyCopy();
  const cachedInit = readInitDataCache();
  if (cachedInit) {
    renderInitData(cachedInit);
    setBanner(getCopy().initSuccess, 'success');
    hideLoadingScreen();
  }
  try {
    const initData = await fetchInitData();
    const normalizedInitData = normalizeInitData(initData);
    if (hasUsableProductData(normalizedInitData)) writeInitDataCache(normalizedInitData);
    renderInitData(normalizedInitData);
    setBanner(getCopy().initSuccess, 'success');
  } catch (error) {
    console.error(error);
    if (!cachedInit) setBanner(`${getCopy().initFail}: ${error.message}`, 'error');
  } finally {
    if (!cachedInit) hideLoadingScreen();
  }
}

function renderInitData(initData) {
  state.init = normalizeInitData(initData);
  syncSelectedProductWithInitData();
  const visibleProducts = getVisibleProductsForSelectedGroup();
  renderGroups();
  renderProducts(visibleProducts);
  renderPassportCountries();
  renderSurveyChips();
  renderGeneralPanel();
  renderProductDetail();
  renderReview();
  refreshStepLocks();
  renderNoticePanel();
  renderPromoHighlightPanel();
}

function getInitProducts(initData = state.init) {
  return Array.isArray(initData?.products) ? initData.products : [];
}

function hasUsableProductData(initData) {
  return getInitProducts(initData).length > 0;
}

function mergeProductsById(primaryProducts, fallbackProducts) {
  const merged = [];
  const seen = new Set();
  [...(primaryProducts || []), ...(fallbackProducts || [])].forEach((product) => {
    const key = String(product?.id || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(product);
  });
  return merged;
}

function normalizeInitData(initData) {
  const normalized = initData && typeof initData === 'object' ? { ...initData } : {};
  const incomingProducts = getInitProducts(normalized);
  const fallbackProducts = getInitProducts(state.init);
  let products = incomingProducts;
  if (!products.length && fallbackProducts.length) {
    products = fallbackProducts;
  } else if (fallbackProducts.length) {
    const selectedGroupProducts = state.selectedGroup
      ? fallbackProducts.filter((product) => product.g === state.selectedGroup)
      : [];
    const selectedProductGroup = state.selectedProduct?.g || state.selectedGroup;
    const selectedProductProducts = selectedProductGroup
      ? fallbackProducts.filter((product) => product.g === selectedProductGroup)
      : [];
    if (selectedGroupProducts.length && !products.some((product) => product.g === state.selectedGroup)) {
      products = mergeProductsById(products, selectedGroupProducts);
    }
    if (state.selectedProduct?.id && !products.some((product) => product.id === state.selectedProduct.id)) {
      products = mergeProductsById(products, selectedProductProducts);
    }
  }
  normalized.products = products;
  return normalized;
}

function getVisibleProductsForSelectedGroup(initData = state.init) {
  const products = getInitProducts(initData);
  if (!state.selectedGroup) return [];
  return products.filter((item) => item.g === state.selectedGroup);
}

function syncSelectedProductWithInitData() {
  if (!state.selectedProduct?.id) return;
  const products = getInitProducts();
  const latestProduct = products.find((item) => item.id === state.selectedProduct.id);
  if (latestProduct) {
    state.selectedProduct = latestProduct;
    state.selectedGroup = latestProduct.g || state.selectedGroup;
    return;
  }
  state.selectedProduct = null;
  state.selectedDate = '';
  state.selectedSlot = '';
  state.selectedSlotMeta = null;
  state.quote = null;
  state.earliestSlotInfo = null;
}

function readInitDataCache() {
  try {
    const raw = globalThis.localStorage?.getItem(INIT_CACHE_KEY)
      // 이전 배포에서 sessionStorage 에 남은 스냅샷도 한 번은 살려 쓴다(전환 시 빈 화면 방지)
      || globalThis.sessionStorage?.getItem(INIT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - Number(parsed.savedAt) > INIT_CACHE_TTL_MS) return null;
    return hasUsableProductData(parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeInitDataCache(data) {
  try {
    globalThis.localStorage?.setItem(INIT_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      data
    }));
  } catch {}
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
  setupBookingContactHelpers();
  document.getElementById('gutscheinApplyBtn')?.addEventListener('click', applyGutscheinCode);
  document.getElementById('gutscheinCodeInput')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); applyGutscheinCode(); }
  });
  window.addEventListener('pagehide', () => {
    if (state.gutschein) fireGutscheinRelease(state.gutschein.code, state.gutschein.holdToken);
  });
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
    els.calendarGrid.classList.remove('empty-state');
    els.calendarGrid.innerHTML = renderPanelLoading(getCopy().loadCalendar);
    els.slotGrid.classList.add('empty-state');
    els.slotGrid.innerHTML = `<div class="empty-state">${escapeHtml(getCopy().slotGridEmpty)}</div>`;
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
  els.form.elements.contractTermsConsent?.addEventListener('change', () => { syncSelectAllRequired(); refreshStepLocks(); });
  els.form.elements.gdprConsent?.addEventListener('change', () => { syncSelectAllRequired(); refreshStepLocks(); });
  els.form.elements.name?.addEventListener('input', () => { renderReturnNotice(); refreshStepLocks(); });
  els.form.elements.phone?.addEventListener('input', () => { renderReturnNotice(); refreshStepLocks(); scheduleContactLookup(); });
  els.form.elements.email?.addEventListener('input', () => { renderReturnNotice(); refreshStepLocks(); scheduleContactLookup(); });
  els.form.elements.email?.addEventListener('change', maybeLookupContact);
  els.form.elements.phone?.addEventListener('change', maybeLookupContact);
  els.form.elements.address?.addEventListener('input', refreshStepLocks);
  els.form.elements.businessInvoiceNeeded?.addEventListener('change', () => {
    syncConditionalFields();
    renderReview();
    refreshStepLocks();
  });
  ['businessCompanyName', 'businessCompanyAddress', 'businessVatId', 'businessInvoiceEmail', 'businessInvoiceRef'].forEach((fieldName) => {
    els.form.elements[fieldName]?.addEventListener('input', () => { renderReview(); refreshStepLocks(); });
  });
  els.profileAgeInput?.addEventListener('input', () => { renderReview(); refreshStepLocks(); });
  els.studioFamilyInput?.addEventListener('input', () => { renderReview(); refreshStepLocks(); });
  els.form.elements.babyName?.addEventListener('input', () => { renderReview(); refreshStepLocks(); });
  els.reshootingConsent?.addEventListener('change', refreshStepLocks);
  document.getElementById('selectAllRequired')?.addEventListener('change', (event) => { toggleAllRequired(event); refreshStepLocks(); });
  els.locationInput?.addEventListener('input', () => { renderReview(); refreshStepLocks(); });
  els.businessInput?.addEventListener('input', () => { renderReview(); refreshStepLocks(); });
  els.bizMode?.addEventListener('change', async () => {
    state.businessMode = els.bizMode.value || 'photo';
    if (!businessModeUsesVideo(state.businessMode)) state.businessVideoEdit = 'raw';
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

function getContactHelperCopy() {
  if (state.lang === 'en') {
    return {
      emailDomain: 'Email domain',
      addressPlaceholder: 'Postcode or address',
      addressButton: 'Check address',
      addressEmpty: 'Enter a postcode or address.',
      addressChecking: 'Checking address...',
      addressDone: 'Address checked',
      addressFail: 'Could not find the address.'
    };
  }
  if (state.lang === 'de') {
    return {
      emailDomain: 'E-Mail-Domain',
      addressPlaceholder: 'PLZ oder Adresse',
      addressButton: 'Adresse prüfen',
      addressEmpty: 'Bitte PLZ oder Adresse eingeben.',
      addressChecking: 'Adresse wird geprüft...',
      addressDone: 'Adresse geprüft',
      addressFail: 'Adresse wurde nicht gefunden.'
    };
  }
  return {
    emailDomain: '이메일 도메인',
    addressPlaceholder: '우편번호 또는 주소',
    addressButton: '주소 확인',
    addressEmpty: '우편번호나 주소를 입력해 주세요.',
    addressChecking: '주소 확인 중...',
    addressDone: '주소 확인 완료',
    addressFail: '주소를 찾지 못했습니다.'
  };
}

function splitPhoneValue(value, fallbackCountryCode = '+49') {
  let clean = String(value || '').trim().replace(/[^\d+]/g, '');
  if (!clean) return { code: '', rest: '', value: '' };
  if (clean.startsWith('00')) clean = `+${clean.slice(2)}`;
  const fallback = String(fallbackCountryCode || '+49').trim().replace(/[^\d+]/g, '') || '+49';
  if (!clean.startsWith('+')) {
    clean = clean.startsWith('0') ? `${fallback}${clean.slice(1)}` : `${fallback}${clean}`;
  }
  const knownCodes = CONTACT_COUNTRY_PRESETS.map((item) => item.value).sort((a, b) => b.length - a.length);
  let code = knownCodes.find((candidate) => clean.startsWith(candidate)) || '';
  let rest = '';
  if (code) {
    rest = clean.slice(code.length);
  } else {
    const match = clean.match(/^(\+\d{1,3})(\d+)$/);
    if (!match) return { code: '', rest: '', value: clean };
    code = match[1];
    rest = match[2];
  }
  return { code, rest, value: clean };
}

function formatPhoneDisplay(value, fallbackCountryCode = '+49') {
  const parsed = splitPhoneValue(value, fallbackCountryCode);
  if (!parsed.code) return parsed.value || String(value || '').trim();
  let rest = parsed.rest || '';
  const chunks = [];
  if (rest.length > 6) {
    chunks.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  while (rest.length > 4) {
    chunks.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  if (rest) chunks.push(rest);
  return `${parsed.code}${chunks.length ? ` ${chunks.join(' ')}` : ''}`;
}

function dispatchContactFieldInput(field) {
  try {
    field.dispatchEvent(new Event('input', { bubbles: true }));
  } catch {}
}

function getPhoneCountrySelect(input) {
  return input?.closest('.contact-helper-control')?.querySelector('[data-role="phone-country"]') || null;
}

function applyPhoneCountryPreset(input, countryCode) {
  if (!input) return;
  const formatted = formatPhoneDisplay(input.value, countryCode || '+49');
  input.value = formatted;
  const parsed = splitPhoneValue(formatted, countryCode || '+49');
  const select = getPhoneCountrySelect(input);
  if (select && parsed.code && CONTACT_COUNTRY_PRESETS.some((item) => item.value === parsed.code)) {
    select.value = parsed.code;
  }
  dispatchContactFieldInput(input);
}

function normalizeEmailInput(input) {
  if (!input) return;
  input.value = String(input.value || '').trim().replace(/\s+/g, '').toLowerCase();
  dispatchContactFieldInput(input);
}

function enhanceBookingPhoneInput(input) {
  if (!input || input.dataset.contactEnhanced === 'phone') return;
  input.dataset.contactEnhanced = 'phone';
  input.setAttribute('inputmode', 'tel');
  input.placeholder = input.placeholder || '+49 176 60939400';

  const wrapper = document.createElement('div');
  wrapper.className = 'contact-helper-control contact-helper-phone';
  const select = document.createElement('select');
  select.dataset.role = 'phone-country';
  select.setAttribute('aria-label', 'Phone country code');
  CONTACT_COUNTRY_PRESETS.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  });
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(select);
  wrapper.appendChild(input);

  input.addEventListener('blur', () => applyPhoneCountryPreset(input, select.value));
  select.addEventListener('change', () => applyPhoneCountryPreset(input, select.value));
}

function enhanceBookingEmailInput(input) {
  if (!input || input.dataset.contactEnhancedEmail === '1') return;
  input.dataset.contactEnhancedEmail = '1';

  const wrapper = document.createElement('div');
  wrapper.className = 'contact-helper-control contact-helper-email';
  const select = document.createElement('select');
  select.dataset.role = 'email-domain';
  select.setAttribute('aria-label', getContactHelperCopy().emailDomain);
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = getContactHelperCopy().emailDomain;
  select.appendChild(emptyOption);
  EMAIL_DOMAIN_PRESETS.forEach((domain) => {
    const option = document.createElement('option');
    option.value = domain;
    option.textContent = domain;
    select.appendChild(option);
  });
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);
  wrapper.appendChild(select);

  input.addEventListener('blur', () => normalizeEmailInput(input));
  select.addEventListener('change', () => {
    const domain = select.value;
    if (!domain) return;
    const local = String(input.value || '').trim().split('@')[0];
    if (local) {
      input.value = `${local}${domain}`;
      normalizeEmailInput(input);
    } else {
      input.focus();
    }
    select.value = '';
  });
}

function enhanceBookingAddressInput(field) {
  if (!field || field.dataset.addressEnhanced === '1') return;
  field.dataset.addressEnhanced = '1';
  const copy = getContactHelperCopy();
  const row = document.createElement('div');
  row.className = 'contact-helper-address';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.autocomplete = 'postal-code';
  searchInput.placeholder = copy.addressPlaceholder;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = copy.addressButton;
  const message = document.createElement('div');
  message.className = 'contact-helper-message';
  row.appendChild(searchInput);
  row.appendChild(button);
  row.appendChild(message);
  field.parentNode.insertBefore(row, field.nextSibling);

  const runLookup = async () => {
    const query = String(searchInput.value || field.value || '').trim();
    if (!query) {
      message.textContent = getContactHelperCopy().addressEmpty;
      message.classList.remove('is-success');
      return;
    }
    button.disabled = true;
    message.textContent = getContactHelperCopy().addressChecking;
    message.classList.remove('is-success');
    try {
      const res = await lookupAddress({ query });
      if (res?.found) {
        field.value = res.formattedAddress || res.displayAddress || query;
        message.textContent = [res.postalCode, res.city, res.countryCode].filter(Boolean).join(' · ') || getContactHelperCopy().addressDone;
        message.classList.add('is-success');
        dispatchContactFieldInput(field);
        renderReview();
        refreshStepLocks();
      } else {
        message.textContent = res?.message || getContactHelperCopy().addressFail;
      }
    } catch (error) {
      message.textContent = error?.message || getContactHelperCopy().addressFail;
    } finally {
      button.disabled = false;
    }
  };

  button.addEventListener('click', runLookup);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runLookup();
    }
  });
}

function normalizeBookingContactFields() {
  const fields = els.form?.elements;
  if (!fields) return;
  const phone = fields.phone;
  if (phone) {
    const select = getPhoneCountrySelect(phone);
    applyPhoneCountryPreset(phone, select?.value || '+49');
  }
  normalizeEmailInput(fields.email);
  normalizeEmailInput(fields.businessInvoiceEmail);
}

function setupBookingContactHelpers() {
  const fields = els.form?.elements;
  if (!fields) return;
  enhanceBookingPhoneInput(fields.phone);
  enhanceBookingEmailInput(fields.email);
  enhanceBookingAddressInput(fields.address);
  enhanceBookingEmailInput(fields.businessInvoiceEmail);
  enhanceBookingAddressInput(fields.businessCompanyAddress);
}

function getCopy() {
  return COPY[state.lang] || COPY.ko;
}

function getConsultationUrl() {
  const url = new URL('/consultation/', globalThis.location.origin);
  url.searchParams.set('lang', state.lang);
  if (state.selectedGroup) url.searchParams.set('from', state.selectedGroup);
  if (state.eventCategory) url.searchParams.set('event', state.eventCategory);
  if (state.selectedProduct?.id) url.searchParams.set('product', state.selectedProduct.id);
  return `${url.pathname}${url.search}`;
}

function syncConsultationLinks() {
  const href = getConsultationUrl();
  document.querySelectorAll('[data-consultation-link], #consultationCtaLink').forEach((link) => {
    link.setAttribute('href', href);
  });
}

function syncLanguageControls() {
  els.langButtons.forEach((item) => item.classList.toggle('active', item.dataset.lang === state.lang));
  syncDocumentLang(state.lang);
}

function setLang(lang) {
  if (!SUPPORTED_LANGS.has(lang)) return;
  state.lang = lang;
  persistLang(lang);
  updateLangQueryParam(lang);
  syncLanguageControls();
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

function updateLangQueryParam(lang) {
  try {
    const url = new URL(globalThis.location.href);
    url.searchParams.set('lang', lang);
    globalThis.history?.replaceState(null, '', url.toString());
  } catch {
    // Keep language switching functional even if history state is unavailable.
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

function formatDateTimeLabel(dateKey, timeLabel) {
  const datePart = formatDateLabel(dateKey);
  const timePart = String(timeLabel || '').trim();
  return timePart ? `${datePart} · ${timePart}` : datePart;
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
  document.documentElement.lang = state.lang;
  syncLanguageControls();
  if (els.heroTitle) els.heroTitle.textContent = copy.heroTitle;
  if (els.noticeTitle) els.noticeTitle.textContent = copy.noticeTitle;
  renderClosureBanner();
  els.heroLead.textContent = copy.hero;
  if (els.loadingCopy) els.loadingCopy.textContent = copy.loadingCopy;
  setText('consultationCtaTitle', copy.consultationCtaTitle);
  setText('consultationCtaBody', copy.consultationCtaBody);
  setText('consultationCtaMeta', copy.consultationCtaMeta);
  setText('consultationCtaLink', copy.consultationCtaButton);
  setText('voucherPromoTitle', copy.voucherPromoTitle);
  setText('voucherPromoBody', copy.voucherPromoBody);
  setText('voucherPromoCta', copy.voucherPromoCta);
  setText('voucherPromoTitle2', copy.voucherPromoTitle);
  setText('voucherPromoBody2', copy.voucherPromoBody);
  setText('voucherPromoCta2', copy.voucherPromoCta);
  syncConsultationLinks();
  setText('requiredInfoLabel', copy.requiredInfoLabel);
  setText('requiredInfoCopy', copy.requiredInfoCopy);
  setText('optionalInfoLabel', copy.optionalInfoLabel);
  setText('optionalInfoCopy', copy.optionalInfoCopy);
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
  setText('passportCopy', copy.passportCopy);
  setText('passportPeopleLabel', copy.passportPeopleLabel);
  setText('passportCountryLabel', copy.passportCountryLabel);
  setText('passportAddConfigBtn', copy.passportConfigAdd);
  setText('generalPeopleLabel', copy.generalPeopleLabel);
  setText('ageFieldLabel', copy.ageFieldLabel);
  setText('ageFieldHint', copy.ageFieldHint);
  setText('profileAgeLabel', copy.profileAgeLabel);
  if (els.profileAgeInput) els.profileAgeInput.placeholder = copy.profileAgePlaceholder;
  setText('babyTypeFieldLabel', copy.babyTypeFieldLabel);
  setText('babyTypeHint', copy.babyTypeHint);
  setText('studioFamilyLabel', copy.studioFamilyLabel);
  if (els.studioFamilyInput) els.studioFamilyInput.placeholder = copy.studioFamilyPlaceholder;
  setText('optionFieldLabel', copy.optionFieldLabel);
  setText('reshootingTitle', copy.reshootingTitle);
  setText('passAddonTitle', copy.passAddonTitle);
  setText('passAddonCopy', copy.passAddonCopy);
  setText('passAddonPeopleLabel', copy.passAddonPeopleLabel);
  setText('locationLabel', copy.locationLabel);
  setText('businessLabel', copy.businessLabel);
  setText('bizModeLabel', copy.bizModeLabel);
  setText('bizHoursLabel', copy.bizHoursLabel);
  setText('bizEditLabel', copy.bizEditLabel);
  setText('bizAddonLabel', copy.bizAddonLabel);
  setText('surveyFieldLabel', copy.surveyFieldLabel);
  setText('bgFieldLabel', copy.bgFieldLabel);
  setText('nameLabel', copy.nameLabel);
  setText('phoneLabel', copy.phoneLabel);
  setText('emailLabel', copy.emailLabel);
  const emailGmailHint = document.getElementById('emailGmailHint');
  const emailGmailWarn = document.getElementById('emailGmailWarn');
  if (emailGmailHint) emailGmailHint.innerHTML = copy.emailGmailHint;
  if (emailGmailWarn) emailGmailWarn.textContent = copy.emailGmailWarn;
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
  renderContractTerms(copy);
  setText('requiredConsentLabel', copy.requiredConsentLabel);
  setText('optionalConsentLabel', copy.optionalConsentLabel);
  setText('selectAllLabel', copy.selectAllLabel);
  setText('selectAllSub', copy.selectAllSub);
  setText('contractTermsLabel', copy.contractTermsLabel);
  setText('contractTermsSub', copy.contractTermsSub);
  setText('gdprLabel', copy.gdprLabel);
  setText('gdprSub', copy.gdprSub);
  syncMarketingConsentCopy(copy);
  els.passportHint.textContent = copy.passportHint;
  els.prevMonthBtn.textContent = copy.monthPrev;
  els.nextMonthBtn.textContent = copy.monthNext;
  els.monthLabel.textContent = formatMonthLabel(state.calendarYear, state.calendarMonth, state.lang);
  if (els.slotPanelTitle) els.slotPanelTitle.textContent = copy.slotPanelTitle;
  setText('legendFullLabel', copy.legendFullLabel);
  setText('legendClosedLabel', copy.legendClosedLabel);
  els.submitBtn.textContent = copy.submitLabel;
  if (els.generalPeopleCustom) els.generalPeopleCustom.placeholder = copy.peopleCustomPlaceholder;
  if (els.locationInput) els.locationInput.placeholder = copy.locationPlaceholder;
  if (els.businessInput) els.businessInput.placeholder = copy.businessPlaceholder;
  if (els.form?.elements?.address) els.form.elements.address.placeholder = copy.addressPlaceholder;
  if (els.form?.elements?.payerName) els.form.elements.payerName.placeholder = copy.payerNamePlaceholder;
  if (els.form?.elements?.babyName) els.form.elements.babyName.placeholder = copy.babyNamePlaceholder;
  if (els.form?.elements?.otherCountry) els.form.elements.otherCountry.placeholder = copy.otherCountryPlaceholder;
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
  if (!state.selectedProduct) {
    els.calendarHint.textContent = copy.calendarPrompt;
    els.calendarGrid.classList.add('empty-state');
    els.calendarGrid.innerHTML = `<div class="empty-state">${escapeHtml(copy.calendarEmpty)}</div>`;
    els.slotGrid.classList.add('empty-state');
    els.slotGrid.innerHTML = `<div class="empty-state">${escapeHtml(copy.slotGridEmpty)}</div>`;
  } else if (!state.selectedDate && els.slotGrid.classList.contains('empty-state')) {
    els.slotGrid.innerHTML = `<div class="empty-state">${escapeHtml(copy.slotGridEmpty)}</div>`;
  }
  renderEarliestSlotBox();
  if (els.locationInfo) {
    els.locationInfo.textContent = state.lang === 'en'
      ? 'Travel is free within 30 km of our studio (Oberursel) — this covers all of Frankfurt. 30–60 km +€30, 60–100 km +€70, beyond 100 km by consultation. Any travel fee is confirmed with your booking confirmation.'
      : state.lang === 'de'
        ? 'Bis 30 km ab Studio (Oberursel) ist die Anfahrt kostenlos — ganz Frankfurt inklusive. 30–60 km +30 €, 60–100 km +70 €, über 100 km nach Absprache. Eine etwaige Anfahrtspauschale bestätigen wir mit der Buchungsbestätigung.'
        : '스튜디오(오버우어젤) 기준 30km까지 출장비 무료입니다 — 프랑크푸르트 전 지역 포함. 30–60km +€30, 60–100km +€70, 100km 초과는 상담으로 안내드려요. 출장비는 예약 확정 메일에서 함께 확정됩니다.';
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
  renderContractPriceSummary();
  refreshBannerCopy();
}

function syncMarketingConsentCopy(copy = getCopy()) {
  const weddingCopy = getWeddingCopy();
  const isWedding = state.selectedProduct?.g === 'wed';
  setText('marketingLabel', isWedding ? weddingCopy.marketingLabel : copy.marketingLabel);
  setText('marketingSub', isWedding ? weddingCopy.marketingSub : copy.marketingSub);
}

function getLocalizedNoticeText() {
  const settings = state.init?.settings || {};
  if (state.lang === 'en') return String(settings.en || '').trim();
  if (state.lang === 'de') return String(settings.de || '').trim();
  return String(settings.ko || '').trim();
}

/* 한국 일정 휴무 공지 — 종료일이 지나면 자동으로 사라진다(수동 정리 불필요).
 * 슬롯 자체는 백엔드 custom_holidays 로 이미 막혀 있고, 이 배너는 그 이유를 알리는 안내다. */
const CLOSURE_NOTICE = { until: '2026-11-25' };

function berlinTodayStr() {
  // 브라우저 로컬이 아니라 스튜디오 기준(Europe/Berlin)으로 판단해야 해외 접속자도 같은 날짜를 본다
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch (err) {
    return new Date().toISOString().slice(0, 10);
  }
}

function renderClosureBanner() {
  if (!els.closureBanner) return;
  const copy = COPY[state.lang] || COPY.ko;
  const expired = berlinTodayStr() > CLOSURE_NOTICE.until;
  if (expired || !copy.closureTitle) {
    els.closureBanner.classList.add('hidden-field');
    return;
  }
  els.closureBanner.classList.remove('hidden-field');
  if (els.closureBannerTitle) els.closureBannerTitle.textContent = copy.closureTitle;
  if (els.closureBannerBody) els.closureBannerBody.textContent = copy.closureBody;
  if (els.closureBannerMeta) els.closureBannerMeta.textContent = copy.closureMeta;
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

function isHeroIntroStepVisible() {
  return !els.hero?.classList.contains('hidden-step') && state.activeStep === 1;
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
  els.promoHighlightPanel.querySelector('.promo-highlight-button')?.setAttribute('href', `/promo/?lang=${encodeURIComponent(state.lang)}`);
  const settings = state.init?.settings || {};
  if (!settings.promoEnabled || !isHeroIntroStepVisible()) {
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

function syncHeroIntroPanels() {
  const isIntroStep = isHeroIntroStepVisible();
  els.heroLangPanel?.classList.toggle('hidden-field', !isIntroStep);
  renderPromoHighlightPanel();
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
  syncConsultationLinks();
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

function getContractQuoteLabel() {
  return '상담 후 견적 / Angebot nach Beratung';
}

function formatContractBruttoAmount(value) {
  return `€${formatEuroAmount(value)} brutto`;
}

function getContractPriceSnapshot() {
  const item = state.selectedProduct;
  if (!item) {
    return {
      quoteOnly: false,
      total: 0,
      deposit: 0,
      balance: 0,
      location: DEFAULT_SHOOTING_LOCATION
    };
  }
  const quote = state.quote || getPreviewQuote() || {};
  const quoteOnly = !!quote.isQuoteOnly || isQuoteOnlyProduct(item);
  const total = roundCurrency(Number(quote.totalPrice ?? getEstimatedPrice()) || 0);
  let deposit = quote.depositAmount !== undefined && quote.depositAmount !== null
    ? roundCurrency(quote.depositAmount)
    : 0;
  if (!quoteOnly && quote.depositAmount === undefined && total > 100 && item.g !== 'pass' && item.g !== 'biz' && item.g !== 'promo') {
    deposit = item.g === 'wed' ? roundCurrency(total * 0.20) : 50;
  }
  const balance = quote.balanceAmount !== undefined && quote.balanceAmount !== null
    ? roundCurrency(quote.balanceAmount)
    : roundCurrency(Math.max(0, total - deposit));
  const typedLocation = String(els.locationInput?.value || '').trim();
  const location = needsBookingLocation(item) ? (typedLocation || DEFAULT_SHOOTING_LOCATION) : DEFAULT_SHOOTING_LOCATION;
  const gs = quoteOnly ? null : getActiveGutschein();
  if (gs) {
    const discountedTotal = roundCurrency(Math.max(0, total - gs.discountAmount));
    const adjustedDeposit = Math.min(deposit, discountedTotal);
    return {
      quoteOnly,
      total: discountedTotal,
      deposit: adjustedDeposit,
      balance: roundCurrency(Math.max(0, discountedTotal - adjustedDeposit)),
      location,
      gutschein: { code: gs.code, discountAmount: gs.discountAmount, originalTotal: total }
    };
  }
  return {
    quoteOnly,
    total,
    deposit,
    balance,
    location,
    gutschein: null
  };
}

const GUTSCHEIN_MSG = {
  ko: {
    empty: '상품권 코드를 입력해 주세요.',
    noProduct: '상품과 일정을 먼저 선택해 주세요.',
    noPrice: '상담 후 견적 상품에는 온라인으로 적용할 수 없습니다. 상담 시 말씀해 주세요.',
    checking: '확인 중…',
    NOT_FOUND: '코드를 찾을 수 없습니다. 다시 확인해 주세요.',
    USED: '이미 사용된 상품권입니다.',
    CANCELLED: '취소된 상품권입니다.',
    INACTIVE: '아직 활성화되지 않은 상품권입니다. 스튜디오에 문의해 주세요.',
    EXPIRED: '유효기간이 지난 상품권입니다.',
    HELD: '다른 예약에서 사용 중인 코드입니다. 15분 후 다시 시도해 주세요.',
    PRODUCT_MISMATCH: '이 상품에는 사용할 수 없는 상품권입니다.',
    error: '적용에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    applied: (code, d) => `✅ ${code} 적용됨 — 할인 -€${d}`,
    holdNote: '예약 제출 전까지 아래 시간 동안 코드가 확보됩니다.',
    holdExpired: '⏳ 적용 시간이 만료되었습니다. [적용]을 다시 눌러 주세요.',
    consumed: '✅ 상품권이 예약에 적용되었습니다. 감사합니다!',
    remove: '제거'
  },
  en: {
    empty: 'Please enter a voucher code.',
    noProduct: 'Please choose a service and time first.',
    noPrice: 'This service is quoted after consultation — the voucher can be applied during the consultation.',
    checking: 'Checking…',
    NOT_FOUND: 'Code not found. Please check again.',
    USED: 'This voucher has already been used.',
    CANCELLED: 'This voucher has been cancelled.',
    INACTIVE: 'This voucher is not activated yet. Please contact the studio.',
    EXPIRED: 'This voucher has expired.',
    HELD: 'This code is currently in use by another booking. Please try again in 15 minutes.',
    PRODUCT_MISMATCH: 'This voucher cannot be used for the selected service.',
    error: 'Could not apply the voucher. Please try again shortly.',
    applied: (code, d) => `✅ ${code} applied — discount −€${d}`,
    holdNote: 'The code is reserved for you for the time below until you submit.',
    holdExpired: '⏳ The reservation time expired. Please press [Apply] again.',
    consumed: '✅ Your voucher was applied to the booking. Thank you!',
    remove: 'Remove'
  },
  de: {
    empty: 'Bitte geben Sie einen Gutscheincode ein.',
    noProduct: 'Bitte wählen Sie zuerst Leistung und Termin.',
    noPrice: 'Diese Leistung wird nach Beratung angeboten — der Gutschein kann bei der Beratung angerechnet werden.',
    checking: 'Wird geprüft…',
    NOT_FOUND: 'Code nicht gefunden. Bitte erneut prüfen.',
    USED: 'Dieser Gutschein wurde bereits eingelöst.',
    CANCELLED: 'Dieser Gutschein wurde storniert.',
    INACTIVE: 'Dieser Gutschein ist noch nicht aktiviert. Bitte kontaktieren Sie das Studio.',
    EXPIRED: 'Dieser Gutschein ist abgelaufen.',
    HELD: 'Dieser Code wird gerade in einer anderen Buchung verwendet. Bitte in 15 Minuten erneut versuchen.',
    PRODUCT_MISMATCH: 'Dieser Gutschein gilt nicht für die gewählte Leistung.',
    error: 'Der Gutschein konnte nicht angewendet werden. Bitte später erneut versuchen.',
    applied: (code, d) => `✅ ${code} angewendet — Rabatt −€${d}`,
    holdNote: 'Der Code ist bis zum Absenden für die unten angezeigte Zeit reserviert.',
    holdExpired: '⏳ Die Reservierungszeit ist abgelaufen. Bitte erneut auf [Anwenden] klicken.',
    consumed: '✅ Ihr Gutschein wurde auf die Buchung angewendet. Vielen Dank!',
    remove: 'Entfernen'
  }
};

function gutscheinMsg() {
  return GUTSCHEIN_MSG[state.lang] || GUTSCHEIN_MSG.ko;
}

function getActiveGutschein() {
  const gs = state.gutschein;
  if (!gs) return null;
  if (Date.now() >= gs.expireMs) {
    removeGutschein(false, { reason: 'expired', silentRender: true });
    return null;
  }
  if (state.selectedProduct && gs.productId && state.selectedProduct.id !== gs.productId) {
    removeGutschein(true, { silentRender: true });
    return null;
  }
  return gs;
}

function renderGutscheinResult(kind, extra) {
  const box = document.getElementById('gutscheinResult');
  if (!box) return;
  const t = gutscheinMsg();
  if (kind === 'hidden') {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  if (kind === 'applied' && state.gutschein) {
    const gs = state.gutschein;
    box.className = 'gutschein-result is-applied';
    box.innerHTML = `
      <div class="gs-line gs-strong">${escapeHtml(t.applied(gs.code, formatEuroAmount(gs.discountAmount)))}</div>
      <div class="gs-line">${escapeHtml(t.holdNote)}</div>
      <div class="gs-line gs-timer">⏳ <span id="gutscheinCountdown">--:--</span>
        <button type="button" id="gutscheinRemoveBtn" class="gs-remove">${escapeHtml(t.remove)}</button>
      </div>`;
    document.getElementById('gutscheinRemoveBtn')?.addEventListener('click', () => removeGutschein(true));
    updateGutscheinCountdownLabel();
    return;
  }
  const messageMap = {
    empty: t.empty, noProduct: t.noProduct, noPrice: t.noPrice, checking: t.checking,
    expired: t.holdExpired, consumed: t.consumed, error: t.error
  };
  const reasonText = extra && t[extra] ? t[extra] : null;
  const text = reasonText || messageMap[kind] || t.error;
  const good = kind === 'consumed';
  box.className = `gutschein-result ${good ? 'is-applied' : (kind === 'checking' ? 'is-checking' : 'is-error')}`;
  box.innerHTML = `<div class="gs-line">${escapeHtml(text)}</div>`;
}

function updateGutscheinCountdownLabel() {
  const label = document.getElementById('gutscheinCountdown');
  const gs = state.gutschein;
  if (!label || !gs) return;
  const remainMs = Math.max(0, gs.expireMs - Date.now());
  const mm = String(Math.floor(remainMs / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remainMs % 60000) / 1000)).padStart(2, '0');
  label.textContent = `${mm}:${ss}`;
}

function startGutscheinCountdown() {
  stopGutscheinCountdown();
  state.gutscheinTimer = window.setInterval(() => {
    const gs = state.gutschein;
    if (!gs) { stopGutscheinCountdown(); return; }
    if (Date.now() >= gs.expireMs) {
      removeGutschein(false, { reason: 'expired' });
      return;
    }
    updateGutscheinCountdownLabel();
  }, 1000);
}

function stopGutscheinCountdown() {
  if (state.gutscheinTimer) {
    window.clearInterval(state.gutscheinTimer);
    state.gutscheinTimer = null;
  }
}

function fireGutscheinRelease(code, holdToken) {
  try {
    fetch(buildGutscheinReleaseUrl({ code, holdToken }), { keepalive: true, cache: 'no-store' }).catch(() => {});
  } catch { /* ignore */ }
}

function removeGutschein(fireRelease = true, opts = {}) {
  const gs = state.gutschein;
  stopGutscheinCountdown();
  state.gutschein = null;
  if (gs && fireRelease) fireGutscheinRelease(gs.code, gs.holdToken);
  renderGutscheinResult(opts.reason === 'expired' ? 'expired' : 'hidden');
  if (!opts.silentRender) renderContractPriceSummary();
}

async function applyGutscheinCode() {
  const input = document.getElementById('gutscheinCodeInput');
  const btn = document.getElementById('gutscheinApplyBtn');
  const code = String(input?.value || '').trim().toUpperCase();
  if (!code) { renderGutscheinResult('empty'); return; }
  if (!state.selectedProduct) { renderGutscheinResult('noProduct'); return; }
  const quote = state.quote || getPreviewQuote() || {};
  if (quote.isQuoteOnly || isQuoteOnlyProduct(state.selectedProduct)) { renderGutscheinResult('noPrice'); return; }
  const quoteTotal = roundCurrency(Number(quote.totalPrice ?? getEstimatedPrice()) || 0);
  const depositAmount = roundCurrency(Number(quote.depositAmount || 0) || 0);
  if (!state.gutscheinDraftId) state.gutscheinDraftId = createRequestId('gsdraft');
  const previous = state.gutschein;
  if (btn) { btn.disabled = true; }
  renderGutscheinResult('checking');
  try {
    const res = await holdGutschein({
      code,
      productId: state.selectedProduct.id,
      quoteTotal,
      depositAmount,
      bookingDraftId: state.gutscheinDraftId,
      holdToken: previous && previous.code === code ? previous.holdToken : ''
    }, createRequestId('gshold'));
    if (!res || !res.ok) {
      renderGutscheinResult('error', res && res.reason);
      return;
    }
    if (previous && previous.code !== res.code) fireGutscheinRelease(previous.code, previous.holdToken);
    state.gutschein = {
      code: res.code,
      holdToken: res.holdToken,
      discountAmount: roundCurrency(Number(res.discountAmount || 0)),
      adjustedTotal: roundCurrency(Number(res.adjustedTotal || 0)),
      holdExpiresAt: res.holdExpiresAt || '',
      expireMs: Date.now() + (Number(res.holdTtlSec || 900)) * 1000,
      productId: state.selectedProduct.id
    };
    renderGutscheinResult('applied');
    startGutscheinCountdown();
    renderContractPriceSummary();
  } catch (error) {
    console.error(error);
    renderGutscheinResult('error');
  } finally {
    if (btn) { btn.disabled = false; }
  }
}

function renderContractPriceSummary() {
  const box = document.getElementById('contractPriceSummary');
  if (!box) return;
  if (!state.selectedProduct) {
    box.innerHTML = '';
    return;
  }
  const snapshot = getContractPriceSnapshot();
  const quoteLabel = getContractQuoteLabel();
  const value = (amount) => snapshot.quoteOnly ? quoteLabel : formatContractBruttoAmount(amount);
  const rows = [];
  if (snapshot.gutschein) {
    rows.push(['정상가 / Regulär', formatContractBruttoAmount(snapshot.gutschein.originalTotal)]);
    rows.push([`상품권 / Gutschein (${snapshot.gutschein.code})`, `-${formatContractBruttoAmount(snapshot.gutschein.discountAmount)}`]);
  }
  rows.push(['총 비용 / Gesamtbetrag', value(snapshot.total)]);
  rows.push(['계약금 / Anzahlung', value(snapshot.deposit)]);
  rows.push(['잔금 / Restbetrag', value(snapshot.balance)]);
  box.innerHTML = rows.map(([label, amount]) => `<div><span>${escapeHtml(label)}:</span> ${escapeHtml(amount)}</div>`).join('');
}

function getContractSubmissionData(formData = new FormData(els.form)) {
  const snapshot = getContractPriceSnapshot();
  return {
    contract_terms_version: CONTRACT_TERMS_VERSION,
    contract_terms_accepted: formData.get('contractTermsConsent') === 'on',
    privacy_terms_accepted: formData.get('gdprConsent') === 'on',
    accepted_at: new Date().toISOString(),
    accepted_language: state.lang || 'ko',
    selected_service: getDisplayProductTitle(state.selectedProduct) || getProductLabel(state.selectedProduct),
    shooting_date: state.selectedDate || '',
    shooting_time: state.selectedSlot || '',
    shooting_location: snapshot.location,
    total_price_brutto: snapshot.quoteOnly ? '' : snapshot.total,
    deposit_price_brutto: snapshot.quoteOnly ? '' : snapshot.deposit,
    balance_price_brutto: snapshot.quoteOnly ? '' : snapshot.balance
  };
}

function toggleAllRequired(event) {
  const checked = !!event?.target?.checked;
  if (els.form.elements.contractTermsConsent) els.form.elements.contractTermsConsent.checked = checked;
  if (els.form.elements.gdprConsent) els.form.elements.gdprConsent.checked = checked;
  syncSelectAllRequired();
}

function syncSelectAllRequired() {
  const el = document.getElementById('selectAllRequired');
  if (!el) return;
  const contract = !!els.form.elements.contractTermsConsent?.checked;
  const gdpr = !!els.form.elements.gdprConsent?.checked;
  el.checked = contract && gdpr;
}

function syncConsentVisibility() {
  const isPass = state.selectedGroup === 'pass' || state.selectedProduct?.g === 'pass';
  const consentBox = document.getElementById('consentBox');
  const marketingRow = document.getElementById('marketingRow');
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
  if (optionalConsentGroup) optionalConsentGroup.classList.toggle('hidden-field', isPass);
  if (isPass) {
    if (els.form.elements.marketing) els.form.elements.marketing.checked = false;
  }
  syncSelectAllRequired();
}

function renderReturnNotice() {
  const box = document.getElementById('returnNotice');
  if (!box) return;
  const selected = state.selectedProduct;
  const isPassportProduct = selected?.g === 'pass' || selected?.t === 'passport';
  const name = String(els.form.elements.name?.value || '').trim();
  const phone = String(els.form.elements.phone?.value || '').trim();
  const email = String(els.form.elements.email?.value || '').trim();
  const show = !!(name && phone && email && !isPassportProduct);
  box.classList.toggle('hidden-field', !show);
  if (!show) {
    box.textContent = '';
    state.returnEligible = false;
    if (state.returnNoticeTimer) clearTimeout(state.returnNoticeTimer);
    return;
  }
  box.textContent = state.lang === 'en'
    ? 'Checking same-day reshoot discount eligibility...'
    : state.lang === 'de'
      ? 'Prüfe Rabatt für erneute Aufnahme...'
      : '재촬영 할인 대상 여부를 확인하는 중입니다...';
  if (state.returnNoticeTimer) clearTimeout(state.returnNoticeTimer);
  const token = ++state.returnNoticeToken;
  state.returnNoticeTimer = setTimeout(async () => {
    try {
      const result = await fetchReturnEligibility({ name, phone, email, itemGroup: selected?.g || '', product: selected?.nameKo || selected?.nameDe || selected?.nameEn || '' });
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
        ? 'Same-day discount is available after any finished shoot today, including passport photos, when the new booking is not passport / visa.'
        : state.lang === 'de'
          ? 'Der Tagesrabatt gilt nach einem heutigen Shooting, auch nach Passfotos, wenn die neue Buchung kein Pass-/Visafoto ist.'
          : '당일 촬영을 마친 뒤 여권/비자가 아닌 상품을 새로 예약하면 할인이 자동 적용됩니다. 이전 촬영이 여권/비자인 경우도 가능합니다.';
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

/* 계약 조건 본문의 최소 서식(<br> 줄바꿈, <b> 강조)만 노드로 만든다.
   HTML 문자열을 그대로 주입하지 않고 텍스트 노드로 조립해, 문구가 나중에 어디서 오든 주입 경로가 없다. */
function appendContractText(target, raw) {
  String(raw || '').split(/<br\s*\/?>/i).forEach((segment, index) => {
    if (index > 0) target.appendChild(document.createElement('br'));
    segment.split(/(<b>.*?<\/b>)/i).forEach((part) => {
      if (!part) return;
      const bold = /^<b>/i.test(part);
      const text = bold ? part.replace(/^<b>/i, '').replace(/<\/b>$/i, '') : part;
      if (bold) {
        const strong = document.createElement('strong');
        strong.textContent = text;
        target.appendChild(strong);
      } else {
        target.appendChild(document.createTextNode(text));
      }
    });
  });
}

/* 표준 촬영 계약 조건 — 선택한 언어로만 렌더한다.
   예전에는 index.html 에 KO+DE 를 그대로 박아 두어 **영어 고객이 자기가 체크하는 필수 동의문과
   계약 전문을 한 글자도 읽을 수 없었다**(동의 없이는 예약 자체가 불가능한 항목이다).
   조건 본문은 COPY[lang].contractTerms 한 곳에만 두고, 언어 전환 때 이 함수가 다시 그린다. */
function renderContractTerms(copy = getCopy()) {
  setText('contractTermsSummary', copy.contractTermsSummary);
  setText('contractTermsSummaryHint', copy.contractTermsSummaryHint);
  const list = document.getElementById('contractTermsList');
  if (!list) return;
  list.replaceChildren();
  (Array.isArray(copy.contractTerms) ? copy.contractTerms : []).forEach((item) => {
    const li = document.createElement('li');
    const title = document.createElement('span');
    title.textContent = item.t || '';
    const body = document.createElement('p');
    appendContractText(body, item.p);
    li.append(title, body);
    list.appendChild(li);
  });
  const section = document.getElementById('contractTermsSection');
  if (section) section.setAttribute('aria-label', copy.consentTitle || '');
}

function renderGroups() {
  const groups = Object.keys(GROUP_META);
  els.groupGrid.innerHTML = groups.map((groupKey) => {
    const meta = GROUP_META[groupKey];
    const label = meta.label[state.lang] || meta.label.ko;
    const sub = meta.sub?.[state.lang] || meta.sub?.ko || '';
    const facts = GROUP_QUICK_FACTS[groupKey] || {};
    const isSelected = meta.realGroup
      ? (state.selectedGroup === meta.realGroup && state.bizTrack === groupKey)
      : state.selectedGroup === groupKey;
    const selected = isSelected ? ' selected' : '';
    const quickItems = [
      [getCopy().groupMetaPriceLabel, getGroupPriceMeta(groupKey)],
      [getCopy().groupMetaDurationLabel, getGroupDurationMeta(groupKey)],
      [getCopy().groupMetaDeliveryLabel, facts.delivery?.[state.lang] || facts.delivery?.ko || ''],
      [getCopy().groupMetaPlaceLabel, facts.place?.[state.lang] || facts.place?.ko || '']
    ].filter(([, value]) => value);
    return `
      <button type="button" class="group-card${selected}" data-group="${escapeHtml(groupKey)}">
        <div class="group-card-title">${escapeHtml(label)}</div>
        <div class="group-card-sub">${escapeHtml(sub)}</div>
        <div class="group-card-meta">
          ${quickItems.map(([metaLabel, value]) => `<span class="group-card-meta-item"><span class="group-card-meta-label">${escapeHtml(metaLabel)}</span><strong>${escapeHtml(value)}</strong></span>`).join('')}
        </div>
      </button>
    `;
  }).join('');
  els.groupGrid.querySelectorAll('[data-group]').forEach((button) => {
    button.addEventListener('click', () => selectGroup(button.dataset.group));
  });
}

// 웨딩·가족 행사(famevt) 타일이 커버하는 biz 상품 (B2C 예약형)
const FAMEVT_PRODUCT_IDS = ['amtp', 'amtv', 'amtpr', 'amtvr', 'amtpp', 'amtvp', 'dolp', 'evp', 'evv'];

function getGroupProducts(groupKey) {
  const tileMeta = GROUP_META[groupKey] || {};
  const realKey = tileMeta.realGroup || groupKey;
  let list = (state.init?.products || []).filter((product) => product?.g === realKey);
  if (groupKey === 'famevt') list = list.filter((product) => FAMEVT_PRODUCT_IDS.includes(product.id));
  if (groupKey === 'b2b') list = []; // 상담형 — 가격/시간 메타는 "상담 견적/유동적" 폴백
  return list;
}

function getGroupPriceMeta(groupKey) {
  const prices = getGroupProducts(groupKey)
    .map((product) => Number(product?.p || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!prices.length) {
    if (state.lang === 'en') return 'Quote on request';
    if (state.lang === 'de') return 'Angebot auf Anfrage';
    return '상담 견적';
  }

  const minPrice = formatEuroAmount(prices[0]);
  const hasRange = prices.length > 1 && prices[0] !== prices[prices.length - 1];
  if (!hasRange) return `€${minPrice}`;
  if (state.lang === 'en') return `From €${minPrice}`;
  if (state.lang === 'de') return `Ab €${minPrice}`;
  return `€${minPrice}부터`;
}

function getGroupDurationMeta(groupKey) {
  const durations = getGroupProducts(groupKey)
    .map((product) => Number(product?.d || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!durations.length) {
    if (state.lang === 'en') return 'Flexible';
    if (state.lang === 'de') return 'Flexibel';
    return '유동적';
  }

  const minDuration = durations[0];
  const maxDuration = durations[durations.length - 1];
  if (minDuration === maxDuration) {
    if (state.lang === 'en') return `${minDuration} min`;
    if (state.lang === 'de') return `${minDuration} Min.`;
    return `촬영 ${minDuration}분`;
  }

  if (state.lang === 'en') return `${minDuration}–${maxDuration} min`;
  if (state.lang === 'de') return `${minDuration}–${maxDuration} Min.`;
  return `촬영 ${minDuration}~${maxDuration}분`;
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
  syncHeroIntroPanels();
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

function needsBookingLocation(product = state.selectedProduct) {
  return !!product && (product.g === 'snap' || product.g === 'wed' || product.g === 'biz');
}

function needsBusinessDetails(product = state.selectedProduct) {
  return !!product && product.g === 'biz';
}

function isBabyBirthdayType(value = state.babyType) {
  return value === 'baekil' || value === 'dol';
}

function needsBabyTypeChoice(product = state.selectedProduct) {
  if (!product) return false;
  return (product.g === 'prof' && state.ageGroup === 'baby') || state.surveyKeys.includes('baby');
}

/* '백일/돌 구분'을 요구한 쪽이 연령인지 분위기인지 — 이 필드를 어디에 둘지 결정한다. */
function babyTypeAskedBySurvey() {
  return state.surveyKeys.includes('baby')
    && !(state.selectedProduct?.g === 'prof' && state.ageGroup === 'baby');
}

/* '백일/돌 구분'은 마크업상 '촬영 대상 연령' 바로 아래에 있는데, 분위기에서 백일/돌을 고르면
   그 필드는 화면 한참 위라 고객이 다시 위로 올라가 골라야 했다(사장님 지적).
   선택을 유발한 컨트롤 바로 아래로 옮겨서, 고른 자리에서 이어서 답하게 한다. */
function placeBabyTypeField() {
  if (!els.babyTypeField) return;
  const bySurvey = babyTypeAskedBySurvey();
  const anchor = bySurvey ? els.surveyField : els.ageField;
  // 분위기 필드가 숨겨져 있으면(여권·기업) 옮길 자리가 아니다 — 원래 자리를 지킨다.
  if (anchor && !(bySurvey && anchor.classList.contains('hidden-field'))
      && anchor.nextElementSibling !== els.babyTypeField) {
    anchor.insertAdjacentElement('afterend', els.babyTypeField);
  }
  els.babyTypeHint?.classList.toggle('hidden-field', !bySurvey);
}

/* 분위기에서 백일/돌을 막 고른 순간, 이어서 답해야 할 칸으로 시선을 옮겨 준다.
   강조(field-attention)는 건드리지 않는다 — 미입력 표시는 syncStep2RequiredFieldState 가 단독으로 관리한다. */
function focusBabyTypeField() {
  const field = els.babyTypeField;
  if (!field || field.classList.contains('hidden-field')) return;
  try { field.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { field.scrollIntoView(); }
}

function requiresExplicitBabyBirthdayType(product = state.selectedProduct) {
  return !!product && state.surveyKeys.includes('baby') && !isBabyBirthdayType(state.babyType);
}

function getActiveBabyType(product = state.selectedProduct) {
  if (!needsBabyTypeChoice(product)) return '';
  if (state.surveyKeys.includes('baby') && !isBabyBirthdayType(state.babyType)) return '';
  return state.babyType || '';
}

function needsBabyNameForBooking(product = state.selectedProduct) {
  if (!product) return false;
  return (product.g === 'prof' && state.ageGroup === 'baby' && isBabyBirthdayType(state.babyType))
    || state.surveyKeys.includes('baby');
}

function needsProfileAgeField(product = state.selectedProduct) {
  return !!product && product.g === 'prof' && ['baby', 'kids', 'senior'].includes(state.ageGroup);
}

function needsStudioFamilyField(product = state.selectedProduct) {
  return !!product && product.g === 'stud';
}

function getProfileAgeValue(product = state.selectedProduct) {
  if (!needsProfileAgeField(product)) return '';
  return String(els.profileAgeInput?.value || '').trim();
}

function getStudioFamilyValue(product = state.selectedProduct) {
  if (!needsStudioFamilyField(product)) return '';
  return String(els.studioFamilyInput?.value || '').trim();
}

function getBabyTypeLabel(key = state.babyType, lang = state.lang) {
  const item = BABY_TYPE_META.find((meta) => meta.key === key);
  return item?.label?.[lang] || item?.label?.ko || key || '';
}

function getStep2MissingFields(product = state.selectedProduct) {
  if (!product) return [];
  const missing = [];
  if (product.g === 'biz' && !state.eventCategory) missing.push('eventCategory');
  if (requiresExplicitBabyBirthdayType(product)) missing.push('babyType');
  if (needsBookingLocation(product) && !String(els.locationInput?.value || '').trim()) missing.push('location');
  if (needsBusinessDetails(product) && !String(els.businessInput?.value || '').trim()) missing.push('business');
  return missing;
}

function getBusinessDetailsRequiredMessage() {
  return state.lang === 'en'
    ? 'Enter event details to continue.'
    : state.lang === 'de'
      ? 'Geben Sie die Veranstaltungsdetails ein.'
      : '행사 상세 내용을 입력해야 다음으로 넘어갈 수 있습니다.';
}

function getStep2MissingMessage(missingFields) {
  const missing = new Set(missingFields || []);
  if (missing.has('eventCategory')) {
    return state.lang === 'en'
      ? 'Choose the event type first.'
      : state.lang === 'de'
        ? 'Wählen Sie zuerst den Event-Typ aus.'
        : '행사 유형을 먼저 선택해 주세요.';
  }
  if (missing.has('babyType')) {
    return state.lang === 'en'
      ? 'Choose whether this is a 100-day session or a 1st birthday session.'
      : state.lang === 'de'
        ? 'Bitte wählen Sie, ob es ein 100-Tage- oder 1. Geburtstags-Shooting ist.'
        : '백일 촬영인지 돌 촬영인지 선택해 주세요.';
  }
  if (missing.has('location') && missing.has('business')) {
    return state.lang === 'en'
      ? 'Enter the shooting location and event details to continue.'
      : state.lang === 'de'
        ? 'Geben Sie den Aufnahmeort und die Veranstaltungsdetails ein.'
        : '촬영 장소와 행사 상세 내용을 입력해야 다음으로 넘어갈 수 있습니다.';
  }
  if (missing.has('location')) return getCopy().locationRequired;
  if (missing.has('business')) return getBusinessDetailsRequiredMessage();
  return '';
}

function syncStep2RequiredFieldState(product = state.selectedProduct) {
  const missing = new Set(getStep2MissingFields(product));
  els.babyTypeField?.classList.toggle('field-attention', missing.has('babyType'));
  els.locationInput?.classList.toggle('field-attention', missing.has('location'));
  els.businessInput?.classList.toggle('field-attention', missing.has('business'));
}

function getMaxUnlockedStep() {
  const hasGroup = !!state.selectedGroup;
  const hasProduct = !!state.selectedProduct;
  const isPass = state.selectedProduct?.g === 'pass';
  const hasRequiredStep2 = !hasProduct ? false : (
    (isPass
      ? hasPassportCountrySelections() && (!state.selectedCountries.includes('OTHER') || !!String(els.form.elements.otherCountry?.value || '').trim())
      : getStep2MissingFields(state.selectedProduct).length === 0)
  );
  const hasDate = !!state.selectedDate;
  const hasSlot = !!state.selectedSlot;
  if (!hasGroup) return 1;
  if (state.bizTrack === 'b2b') return 2; // B2B는 상담 연결 카드(스텝2)까지만 — 날짜/슬롯 예약 스텝 잠금 (슬롯 미점유)
  if (!hasProduct) return 2;
  if (!hasRequiredStep2) return 2;
  if (!hasDate || !hasSlot) return 3;
  return 5;
}

function scrollToStepTop(step = state.activeStep) {
  const panel = els.stepPanels[`step${step}`];
  const target = panel || document.querySelector('.hero') || document.querySelector('.shell');
  if (!target) return;
  const offset = window.innerWidth <= 768 ? 12 : 24;
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
  window.scrollTo({ top, behavior: 'smooth' });
}

function goToStep(step) {
  const next = Math.max(1, Math.min(5, step));
  const maxStep = getMaxUnlockedStep();
  state.activeStep = Math.min(next, maxStep);
  syncStepPanels();
  scrollToStepTop(state.activeStep);
}

function updateWizardButtons(maxStep) {
  if (els.wizardButtons.step1Next) els.wizardButtons.step1Next.disabled = maxStep < 2;
  if (els.wizardButtons.step2Next) els.wizardButtons.step2Next.disabled = maxStep < 3;
  if (els.wizardButtons.step3Next) els.wizardButtons.step3Next.disabled = maxStep < 5;
}

function renderStepWarnings() {
  const product = state.selectedProduct;
  const isPass = product?.g === 'pass';
  syncStep2RequiredFieldState(product);
  const step1Message = state.selectedGroup ? '' : (
    state.lang === 'en'
      ? 'Choose the main shoot category to continue.'
      : state.lang === 'de'
        ? 'Wählen Sie zuerst die Hauptkategorie aus.'
        : '촬영 종류를 선택해야 다음으로 넘어갈 수 있습니다.'
  );
  let step2Message = '';
  if (state.bizTrack === 'b2b') {
    step2Message = state.lang === 'en'
      ? 'Business shoots are quoted individually — please continue with the consultation form above.'
      : state.lang === 'de'
        ? 'Business-Shootings werden individuell angeboten — bitte über das Beratungsformular oben fortfahren.'
        : '기업·단체 촬영은 맞춤 견적으로 진행됩니다 — 위의 상담 설문으로 이어서 작성해 주세요.';
  } else if (state.selectedGroup === 'biz' && !state.eventCategory) {
    step2Message = state.lang === 'en'
      ? 'Choose the event type first.'
      : state.lang === 'de'
        ? 'Wählen Sie zuerst den Event-Typ aus.'
        : '행사 유형을 먼저 선택해 주세요.';
  } else if (state.selectedGroup && !product) {
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
  } else {
    step2Message = getStep2MissingMessage(getStep2MissingFields(product));
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
  const contractOk = formData.get('contractTermsConsent') === 'on';
  const gdprOk = formData.get('gdprConsent') === 'on';
  const babyNameOk = !needsBabyNameForBooking(product) || !!String(formData.get('babyName') || '').trim();
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
  } else if (!contractOk || !gdprOk) {
    step5Message = state.lang === 'en'
      ? 'Required consent items must be checked.'
      : state.lang === 'de'
        ? 'Die erforderlichen Zustimmungspunkte müssen aktiviert werden.'
        : '필수 동의 항목을 체크해야 예약 제출이 가능합니다.';
  } else if (!babyNameOk) {
    step5Message = state.lang === 'en'
      ? 'Enter the baby name for 100-day / 1st birthday sessions.'
      : state.lang === 'de'
        ? 'Geben Sie den Babynamen für 100-Tage- oder 1. Geburtstags-Shootings ein.'
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
  const allowBabySurvey = state.selectedProduct?.g === 'stud' || state.selectedProduct?.g === 'snap';
  if (!allowBabySurvey) {
    state.surveyKeys = state.surveyKeys.filter((key) => key !== 'baby');
  }
  const surveyItems = SURVEY_META.filter((item) => {
    if (item.key !== 'baby') return true;
    return allowBabySurvey;
  });
  els.surveyGrid.innerHTML = surveyItems.map((item) => {
    const label = item.label[state.lang] || item.label.ko;
    const selected = state.surveyKeys.includes(item.key) ? ' selected' : '';
    return `<button type="button" class="survey-chip${selected}" data-survey="${item.key}">${escapeHtml(label)}</button>`;
  }).join('');
  els.surveyGrid.querySelectorAll('[data-survey]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.survey;
      const index = state.surveyKeys.indexOf(key);
      if (index >= 0) state.surveyKeys.splice(index, 1);
      else {
        state.surveyKeys.push(key);
        if (key === 'baby' && !isBabyBirthdayType(state.babyType)) state.babyType = '';
      }
      if (key === 'baby' && index >= 0 && !(state.selectedProduct?.g === 'prof' && state.ageGroup === 'baby')) {
        state.babyType = 'infant';
      }
      renderSurveyChips();
      renderBabyTypeChips();
      syncConditionalFields();
      renderReview();
      refreshStepLocks();
      // 백일/돌을 방금 켰고 아직 어느 쪽인지 안 골랐으면, 그 칸으로 바로 데려간다.
      if (key === 'baby' && index < 0 && !isBabyBirthdayType(state.babyType)) focusBabyTypeField();
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
      if (state.ageGroup !== 'baby') state.babyType = 'infant';
      else if (!state.babyType) state.babyType = 'infant';
      renderAgeChips();
      renderBabyTypeChips();
      renderSeniorWarning();
      syncConditionalFields();
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

  if (isGenericBusinessProduct(item)) {
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
      returnDiscount: 0,
      passAddon: false,
      passAddonPeople: 0,
      passAddonDur: 0,
      passAddonPrice: 0,
      passCountries: [],
      otherCountry: '',
      totalCountries: 0,
      optionKeys: [],
      isQuoteOnly: true,
      weekendSurcharge: 0,
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

  const weekendSurcharge = getWeekendSurcharge(item, state.selectedDate);
  if (weekendSurcharge) total += weekendSurcharge;

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

  const weddingDiscountBase = item.g === 'wed' ? roundCurrency(Math.max(0, total)) : 0;
  let earlyBirdDiscount = 0;
  if (item.g === 'wed' && state.selectedDate && isWeddingEarlyBookingEligible(state.selectedDate)) {
    earlyBirdDiscount = roundCurrency(weddingDiscountBase * (WEDDING_EARLY_BOOKING_DISCOUNT_RATE / 100));
  }

  let marketingDiscount = 0;
  const marketing = els.form.elements.marketing?.checked || false;
  if (item.g === 'wed' && marketing) {
    marketingDiscount = roundCurrency(weddingDiscountBase * (WEDDING_MARKETING_DISCOUNT_RATE / 100));
  }
  if (item.g === 'wed') total = roundCurrency(total - earlyBirdDiscount - marketingDiscount);
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
    totalPrice: roundCurrency(Math.max(0, total)),
    duration,
    prep,
    totalDuration: duration + prep + passAddonDur,
    product: item,
    earlyBirdDiscount,
    marketingDiscount,
    returnDiscount: 0,
    passAddon,
    passAddonPeople,
    passAddonDur,
    passAddonPrice,
    passCountries,
    passPersonCountries,
    otherCountry,
    totalCountries,
    optionKeys,
    weekendSurcharge,
    isQuoteOnly: isQuoteOnlyProduct(item)
  };
}

function renderBabyTypeChips() {
  const forceBirthdayChoice = state.surveyKeys.includes('baby') && !(state.selectedProduct?.g === 'prof' && state.ageGroup === 'baby');
  const items = forceBirthdayChoice ? BABY_TYPE_META.filter((item) => item.key !== 'infant') : BABY_TYPE_META;
  els.babyTypeGrid.innerHTML = items.map((item) => {
    const label = item.label[state.lang] || item.label.ko;
    const selected = state.babyType === item.key ? ' subtle-selected' : '';
    return `<button type="button" class="survey-chip${selected}" data-baby-type="${item.key}">${escapeHtml(label)}</button>`;
  }).join('');
  els.babyTypeGrid.querySelectorAll('[data-baby-type]').forEach((button) => {
    button.addEventListener('click', () => {
      state.babyType = button.dataset.babyType;
      renderBabyTypeChips();
      syncConditionalFields();
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

function getLocalizedText(value, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value[state.lang] || value.ko || value.en || value.de || fallback;
}

function getProductDurationLabel(duration) {
  const minutes = Number(duration || 0);
  if (state.lang === 'en') return `${minutes} min`;
  if (state.lang === 'de') return `${minutes} Min`;
  return `촬영 ${minutes}분`;
}

function getCompositionCopy() {
  if (state.lang === 'en') {
    return {
      title: 'Package Includes',
      included: 'Included',
      notes: 'Options / conditions',
      price: 'Price',
      shootTime: 'Shoot time',
      studioA4: '1 A4 print included',
      printGradeNote: getPrintMicrocopy('bookingGradeNote', 'en'),
      printGradeNoteMixed: getPrintMicrocopy('bookingGradeNoteMixed', 'en')
    };
  }
  if (state.lang === 'de') {
    return {
      title: 'Paketumfang',
      included: 'Inklusive',
      notes: 'Optionen / Bedingungen',
      price: 'Preis',
      shootTime: 'Shootingzeit',
      studioA4: '1 A4-Abzug inklusive',
      printGradeNote: getPrintMicrocopy('bookingGradeNote', 'de'),
      printGradeNoteMixed: getPrintMicrocopy('bookingGradeNoteMixed', 'de')
    };
  }
  return {
    title: '상품 기본 구성',
    included: '포함',
    notes: '추가 / 조건',
    price: '금액',
    shootTime: '촬영 시간',
    studioA4: '시그니처 A4 1장 포함',
    printGradeNote: getPrintMicrocopy('bookingGradeNote', 'ko'),
    printGradeNoteMixed: getPrintMicrocopy('bookingGradeNoteMixed', 'ko')
  };
}

// 포함 인화 등급 캡션. 상품 id 하드코딩 대신 product-delivery 스펙의 prints[] → 등급 매핑으로 판정한다.
// 포함 인화가 없거나(op·oprm) 등급 체계 밖 규격(여권 pass)이면 캡션을 붙이지 않는다 — 사실오류 방지.
function getCompositionPrintGradeNote(product, copy) {
  const quota = getProductIncludedPrintQuota(product);
  if (!quota.length) return '';
  const tiers = quota.map((item) => getPrintTier(item.id));
  if (tiers.some((tier) => !tier || tier === 'photocard')) return '';
  const fineart = quota.filter((item) => getPrintTier(item.id) === 'fineart');
  if (!fineart.length) return copy.printGradeNote;
  /* Mixed 문구는 "A3 1장은 파인아트"라고 **문자 그대로** 말한다(print-tier-copy.js bookingGradeNoteMixed).
     조건을 'fineart 가 하나라도 있으면'으로 두면, product-delivery.js 에 premium_a4 나 A3 2장을 추가하는 순간
     코드 변경 없이 예약 페이지가 거짓말을 한다. 카피가 서술하는 구성(premium_a3 정확히 1장)일 때만 쓴다. */
  const isSingleA3 = fineart.length === 1 && fineart[0].id === 'premium_a3' && Number(fineart[0].qty) === 1;
  return isSingleA3 ? copy.printGradeNoteMixed : '';
}

function normalizeCompositionPart(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\u2713\u2714\u2705]\ufe0f?\s*/u, '')
    .replace(/^\[(?:상세|detail|details?)\]\s*/i, '')
    .replace(/^includes?:\s*/i, '')
    .replace(/^inkl\.?\s*/i, '')
    .replace(/^포함\s*[:：]?\s*/i, '')
    .trim();
}

function splitCompositionLine(line) {
  return String(line || '')
    .split(/\s*\|\s*|(?:\s+\/\s+|\s+\/|\/\s+)/)
    .map(normalizeCompositionPart)
    .filter(Boolean);
}

function isCompositionDurationPart(value) {
  const text = String(value || '').toLowerCase();
  if (/studio|스튜디오|studio/.test(text) && /incl|포함|inkl|included/.test(text)) return false;
  return /^촬영\s*(약\s*)?\d+/.test(value)
    || /^약\s*\d+\s*(분|시간)/.test(value)
    || /^ca\.?\s*\d+/.test(text)
    || /^\d+\s*(min|std|hour|hours)\b/.test(text);
}

function isCompositionConditionPart(value) {
  const text = String(value || '').toLowerCase();
  const includedPattern = /포함|included|incl\.?|inklusive|inkl\.?/i;
  if (includedPattern.test(value)) return false;
  return /추가|인원 추가|평일|토요일|할인|add-?on|additional|weekday|saturday|wochentag|samstag|\+€|\+\s*\d+\s*(?:€|eur|euro|분|min|시간|h|std|명|person|personen)\b/.test(text);
}

function isCompositionDeliveryPart(value) {
  return /원본|클라우드|구글|보정본|편집본|출력|인화|프린트|우편발송|배송|디지털|파일|qr\s*코드|e-?passbild|original|originale|cloud|retouch|retouched|bearbeitung|retusch|print|prints?|druck|ausdruck|abzug|digital|datei|a[34]\b|10\s*[×x]\s*15|6\s*[×x]\s*4|video|영상/i.test(String(value || ''));
}

function uniqueCompositionParts(parts) {
  const seen = new Set();
  return parts.filter((part) => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getProductComposition(product) {
  if (!product) return { included: [], notes: [] };
  const hasFixedDeliverySpec = productHasFixedDeliverySpec(product);
  const lines = getProductDescription(product)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const included = getProductDeliveryLines(product, state.lang, { includeNoPrintLine: true });
  const notes = [];

  lines.forEach((line) => {
    const parts = splitCompositionLine(line);
    (parts.length ? parts : [normalizeCompositionPart(line)]).forEach((part) => {
      if (!part || isCompositionDurationPart(part)) return;
      if (hasFixedDeliverySpec && isCompositionDeliveryPart(part)) return;
      if (isCompositionConditionPart(part)) notes.push(part);
      else included.push(part);
    });
  });

  return {
    included: uniqueCompositionParts(included),
    notes: uniqueCompositionParts(notes)
  };
}

function getProductCardCompositionItems(product) {
  const composition = getProductComposition(product);
  const priority = composition.included.filter((part) => !/google|cloud|구글|클라우드|원본|originale|originals/i.test(part));
  const fallback = composition.included.filter((part) => !priority.includes(part));
  const rank = (part) => {
    if (/보정본|retouched|retuschierte/i.test(part)) return 1;
    if (/출력물|인화|print|prints?|druck|abzug|a[34]|10\s*[×x]\s*15|6\s*[×x]\s*4/i.test(part)) return 2;
    if (/배경|의상|background|outfit|hintergrund/i.test(part)) return 3;
    if (isCompositionPeopleBasisPart(product, part)) return 4;
    return 8;
  };
  return [...priority, ...fallback]
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 4);
}

function renderProductCardComposition(product) {
  const items = getProductCardCompositionItems(product);
  if (!items.length) return '';
  return `
    <div class="product-card-summary" aria-label="${escapeHtml(getCompositionCopy().included)}">
      ${items.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
    </div>
  `;
}

function getCompositionPartKey(value) {
  return normalizeCompositionPart(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

// 스냅 계열(야외/홈스냅·마이리얼트립) 기본 보정 = 간단 보정 — 예약 전 안내 (셀렉 정책과 동일 문구)
function getSnapRetouchScopeNote(product) {
  const g = String(product?.g || '').trim().toLowerCase();
  if (g !== 'snap' && g !== '마이리얼트립') return '';
  if (state.lang === 'en') {
    return '✂️ Retouching scope: basic retouching covers simple work only (skin, brightening, stray hairs, clothing silhouette, color/tone). Detailed compositing — body reshaping, sky replacement, removing people, wrinkle removal on clothing — is not included; we quote it separately if needed.';
  }
  if (state.lang === 'de') {
    return '✂️ Retusche-Umfang: Die Basis-Retusche umfasst nur einfache Arbeiten (Haut, Aufhellung, fliegende Haare, Silhouette, Farbstimmung). Detailarbeiten wie Körper-/Himmelscompositing, Entfernen von Personen oder Faltenretusche an Kleidung sind nicht enthalten — auf Wunsch bieten wir sie separat an.';
  }
  return '✂️ 보정 안내: 기본 보정은 간단 보정(피부·미백·잔머리·옷 라인·색감) 기준입니다. 신체·하늘 합성, 사람 제거(합성), 의상 주름 제거 같은 디테일 작업은 포함되지 않아요 — 필요하시면 개별 안내드립니다.';
}

function getProductDetailIntro(product, desc, composition) {
  const raw = String(desc || '').trim();
  if (!raw) return '';
  const hasFixedDeliverySpec = productHasFixedDeliverySpec(product);
  const captured = new Set([...(composition?.included || []), ...(composition?.notes || [])].map(getCompositionPartKey));
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const remaining = lines.filter((line) => {
    const parts = splitCompositionLine(line);
    const meaningfulParts = parts.length ? parts : [normalizeCompositionPart(line)];
    if (hasFixedDeliverySpec && meaningfulParts.every((part) => !part || isCompositionDeliveryPart(part) || isCompositionDurationPart(part))) return false;
    const allCaptured = meaningfulParts.every((part) => {
      if (!part || isCompositionDurationPart(part)) return true;
      if (product?.g === 'stud' && /a4/i.test(part)) return true;
      return captured.has(getCompositionPartKey(part));
    });
    if (allCaptured) return false;
    if (isCompositionDurationPart(line) || isCompositionConditionPart(line)) return false;
    return line.length >= 16;
  });
  return uniqueCompositionParts(remaining).slice(0, 2).join('\n');
}

function isCompositionPeopleBasisPart(product, part) {
  if (!(product?.t === 'group' || product?.t === 'snap' || product?.g === 'stud' || product?.g === 'snap')) return false;
  const text = String(part || '').toLowerCase();
  return /\d+\s*인\s*기준/.test(text)
    || /base price.*\d+\s*people/.test(text)
    || /\d+\s*people.*included/.test(text)
    || /\d+\s*personen/.test(text);
}

function renderProductCompositionPanel(product) {
  if (!product) return '';
  const copy = getCompositionCopy();
  const composition = getProductComposition(product);
  const detailIncluded = composition.included.filter((part) => !isCompositionPeopleBasisPart(product, part));
  const detailNotes = composition.notes.filter((part) => !isCompositionPeopleBasisPart(product, part));
  const quoteOnly = !!state.quote?.isQuoteOnly || isQuoteOnlyProduct(product);
  const priceLabel = `€${formatEuroAmount(getEstimatedPrice())} brutto`;
  const shootDuration = getShootDuration() || Number(product.d || 0);
  const metaItems = quoteOnly
    ? [[copy.shootTime, getProductDurationLabel(shootDuration)]]
    : [
        [copy.price, priceLabel],
        [copy.shootTime, getProductDurationLabel(shootDuration)]
      ];
  if (!detailIncluded.length && !detailNotes.length) return '';
  const printGradeNote = getCompositionPrintGradeNote(product, copy);
  const printGradeNoteHtml = printGradeNote
    ? `<div class="package-composition-note">${printGradeNote}</div>`
    : '';
  return `
    <section class="package-composition-panel">
      <div class="package-composition-title">${escapeHtml(copy.title)}</div>
      <div class="package-composition-meta">
        ${metaItems.map(([label, value]) => `
          <div class="package-composition-meta-item">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join('')}
      </div>
      ${detailIncluded.length ? `
        <div class="package-composition-section">
          <div class="package-composition-label">${escapeHtml(copy.included)}</div>
          <ul class="package-composition-list">
            ${detailIncluded.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
          ${printGradeNoteHtml}
        </div>
      ` : printGradeNoteHtml}
      ${detailNotes.length ? `
        <div class="package-composition-section muted">
          <div class="package-composition-label">${escapeHtml(copy.notes)}</div>
          <ul class="package-composition-list">
            ${detailNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </section>
  `;
}

function getProductPriceLabel(product) {
  if (!product) return '';
  if (product.id === 'amtp') {
    if (state.lang === 'en') return 'Weekday €350 brutto · Sat €400 brutto';
    if (state.lang === 'de') return 'Wochentag 350€ brutto · Sa 400€ brutto';
    return '평일 €350 brutto · 토 €400 brutto';
  }
  return isQuoteOnlyProduct(product) ? getQuotePriceLabel() : `€${formatEuroAmount(product.p)} brutto`;
}

function getEventProductCardTimingLabel(product) {
  if (!product) return '';
  if (isQuoteOnlyProduct(product)) {
    if (state.lang === 'en') return 'Schedule checked after request';
    if (state.lang === 'de') return 'Ablauf nach Anfrage';
    return '일정 확인 후 안내';
  }
  return getProductDurationLabel(product.d);
}

function getSelectedEventCategoryMeta() {
  return EVENT_PRODUCT_CATEGORIES.find((item) => item.key === state.eventCategory) || null;
}

function getSelectedEventCategoryLabel() {
  const meta = getSelectedEventCategoryMeta();
  return meta ? getLocalizedText(meta.title) : '';
}

function getEventProductCardMeta(product) {
  if (!product) return {};
  const base = EVENT_PRODUCT_CARD_META[product.id] || {};
  const override = EVENT_PRODUCT_CATEGORY_OVERRIDES[state.eventCategory]?.[product.id] || {};
  return { ...base, ...override };
}

function getDisplayProductTitle(product) {
  if (product?.g === 'biz' && state.eventCategory) {
    const eventTitle = getLocalizedText(getEventProductCardMeta(product).title, '');
    if (eventTitle) return eventTitle;
  }
  return getProductLabel(product);
}

function businessModeUsesVideo(mode) {
  return mode === 'video' || mode === 'hybrid';
}

function getBusinessSelection() {
  const mode = state.businessMode || 'photo';
  const hours = Number(state.businessHours || 2);
  const edit = state.businessVideoEdit || 'raw';
  const modeLabel = BUSINESS_MODE_META.find((item) => item.key === mode)?.label[state.lang]
    || BUSINESS_MODE_META.find((item) => item.key === mode)?.label.ko
    || mode;
  const editLabel = businessModeUsesVideo(mode)
    ? (BUSINESS_VIDEO_EDIT_META.find((item) => item.key === edit)?.label[state.lang]
      || BUSINESS_VIDEO_EDIT_META.find((item) => item.key === edit)?.label.ko
      || edit)
    : '';
  const label = businessModeUsesVideo(mode)
    ? `${modeLabel} · ${hours}${state.lang === 'en' ? 'h' : state.lang === 'de' ? ' Std.' : '시간'} · ${editLabel}`
    : `${modeLabel} · ${hours}${state.lang === 'en' ? 'h' : state.lang === 'de' ? ' Std.' : '시간'}`;
  return { mode, hours, edit, price: 0, label, duration: hours * 60 };
}

function isGenericBusinessProduct(product) {
  return !!product && product.g === 'biz' && product.id === 'biz';
}

function isQuoteOnlyProduct(product) {
  return !!product && (product.t === 'custom' || Number(product.p || 0) <= 0);
}

function getSaturdaySurcharge(product) {
  if (!product) return 0;
  return { amtp: 50, dolp: 50, ob: 20, op: 30, oprm: 40 }[product.id] || 0;
}

function isSaturdayDate(dateStr) {
  return !!dateStr && new Date(`${dateStr}T12:00:00`).getDay() === 6;
}

function getWeekendSurcharge(product, dateStr) {
  return isSaturdayDate(dateStr) ? getSaturdaySurcharge(product) : 0;
}

function getQuotePriceLabel() {
  if (state.lang === 'en') return 'Custom quote';
  if (state.lang === 'de') return 'Angebot nach Beratung';
  return '상담 후 견적';
}

function getGeneralPanelHelpCopy(product) {
  if (product?.g === 'biz' || state.selectedGroup === 'biz') {
    if (state.lang === 'en') return 'Event details and optional requests update the consultation summary.';
    if (state.lang === 'de') return 'Eventdetails und Zusatzwünsche aktualisieren die Beratungsübersicht.';
    return '행사 정보와 추가 요청을 선택하면 상담 요약이 갱신됩니다.';
  }
  return getCopy().generalCopy;
}

function getProductDetailEmptyCopy() {
  if (state.selectedGroup === 'biz') {
    if (state.lang === 'en') return 'Select an event option to see the consultation guide.';
    if (state.lang === 'de') return 'Wählen Sie eine Event-Option, um die Beratungshinweise zu sehen.';
    return '행사 옵션을 선택하면 상담 안내가 여기에 표시됩니다.';
  }
  return getCopy().selectProductDetailEmpty;
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
  if (isGenericBusinessProduct(state.selectedProduct)) return getBusinessSelection().price;
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
  const showConfig = isGenericBusinessProduct(state.selectedProduct);
  if (!showConfig) {
    els.bizConfigField?.classList.add('hidden-field');
    els.bizEditField?.classList.add('hidden-field');
    els.bizAddonGrid.innerHTML = '';
    els.bizAddonHelp.textContent = '';
    return;
  }
  els.bizConfigField?.classList.remove('hidden-field');
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
  els.bizEditField?.classList.toggle('hidden-field', !businessModeUsesVideo(state.businessMode));
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

function scrollSlotPanelIntoView() {
  if (window.innerWidth > 960) return;
  const panel = document.querySelector('.slot-panel');
  if (!panel) return;
  const offset = 12;
  const top = Math.max(0, panel.getBoundingClientRect().top + window.scrollY - offset);
  window.scrollTo({ top, behavior: 'smooth' });
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
      ? ['Background and outfit options change the styling, not the shoot flow itself.', 'Please arrive a few minutes early if multiple people are included.']
      : state.lang === 'de'
        ? ['Hintergrund- und Outfitoptionen verändern den Stil, nicht den grundsätzlichen Ablauf.', 'Bitte kommen Sie bei mehreren Personen ein paar Minuten früher.']
        : ['배경/의상 옵션은 촬영 스타일에만 영향을 주고 진행 흐름은 그대로 유지됩니다.', '여러 명이 함께 촬영하는 경우 약간 일찍 도착해 주세요.'];
  }
  if (product.g === 'snap' || product.g === 'wed') {
    return state.lang === 'en'
      ? ['Please enter the preferred location in step 2 before checking the calendar.', 'Travel outside the Frankfurt 50km area may require an extra transportation fee.', 'Outdoor sessions are weather-sensitive, so we may suggest alternatives after review.']
      : state.lang === 'de'
        ? ['Bitte geben Sie den gewünschten Ort in Schritt 2 ein, bevor Sie den Kalender prüfen.', 'Außerhalb des 50-km-Radius von Frankfurt können zusätzliche Fahrtkosten entstehen.', 'Outdoor-Shootings sind wetterabhängig; nach Prüfung können Alternativen vorgeschlagen werden.']
        : ['달력 확인 전 2단계에서 희망 촬영 장소를 먼저 입력해 주세요.', '프랑크푸르트 50km 외 지역은 추가 이동 비용이 발생할 수 있습니다.', '야외 촬영은 날씨 영향을 받아 검토 후 대체안을 안내드릴 수 있습니다.'];
  }
  if (product.g === 'biz') {
    const business = isGenericBusinessProduct(product) ? getBusinessSelection() : null;
    return state.lang === 'en'
      ? [
          `${business ? business.label : getProductLabel(product)} is currently selected.`,
          'Please describe the event purpose, schedule, and required deliverables in detail.',
          'SNS, rush delivery, and branding requests are reviewed after booking.'
        ]
      : state.lang === 'de'
        ? [
            `${business ? business.label : getProductLabel(product)} ist aktuell ausgewählt.`,
            'Bitte beschreiben Sie Zweck, Ablauf und gewünschte Deliverables des Events möglichst genau.',
            'SNS, Express-Lieferung und Branding-Wünsche werden nach der Buchung einzeln geprüft.'
          ]
        : [
            `${business ? business.label : getProductLabel(product)} 상품이 현재 선택되어 있습니다.`,
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

function getAppliedDiscountLines() {
  const item = state.selectedProduct;
  if (!item || !state.quote) return [];
  const lines = [];
  if (state.quote.eventDiscount > 0) {
    lines.push(state.lang === 'en'
      ? `Event discount -€${state.quote.eventDiscount} applied.`
      : state.lang === 'de'
        ? `Aktionsrabatt -${state.quote.eventDiscount}€ angewendet.`
        : `이벤트 할인 -€${state.quote.eventDiscount}가 적용되었습니다.`);
  }
  if (state.quote.returnDiscount > 0) {
    const rate = Number(state.init?.settings?.returnDiscount || 10) || 10;
    lines.push(state.lang === 'en'
      ? `Same-day reshoot discount ${rate}% (-€${formatEuroAmount(state.quote.returnDiscount)}) applied.`
      : state.lang === 'de'
        ? `Rabatt für erneute Aufnahme ${rate}% (-${formatEuroAmount(state.quote.returnDiscount)}€) angewendet.`
        : `당일 재촬영 할인 ${rate}% (-€${formatEuroAmount(state.quote.returnDiscount)})가 적용되었습니다.`);
  }
  if (item.g === 'prof') {
    if (state.ageGroup === 'kids') {
      lines.push(state.lang === 'en'
        ? 'Kids discount -€10 applied.'
        : state.lang === 'de'
          ? 'Kinderrabatt -10€ angewendet.'
          : '키즈 할인 -€10이 적용되었습니다.');
    }
    if (state.ageGroup === 'senior' && state.selectedDate) {
      const d = new Date(`${state.selectedDate}T12:00:00`);
      const day = d.getDay();
      const isWd = day >= 2 && day <= 5;
      const isSat = day === 6;
      if (item.id === 'pb' && isWd && state.quote.totalPrice === 0) {
        lines.push(state.lang === 'en'
          ? 'Senior weekday free benefit applied.'
          : state.lang === 'de'
            ? 'Senioren-Vorteil werktags kostenlos angewendet.'
            : '시니어 평일 무료 혜택이 적용되었습니다.');
      }
      if ((item.id === 'pbus' || item.id === 'pp') && isWd) {
        lines.push(state.lang === 'en'
          ? 'Senior weekday discount -€50 applied.'
          : state.lang === 'de'
            ? 'Seniorenrabatt werktags -50€ angewendet.'
            : '시니어 평일 할인 -€50이 적용되었습니다.');
      }
      if (item.id === 'pp' && isSat) {
        lines.push(state.lang === 'en'
          ? 'Senior Saturday discount -€30 applied.'
          : state.lang === 'de'
            ? 'Seniorenrabatt Samstag -30€ angewendet.'
            : '시니어 토요일 할인 -€30이 적용되었습니다.');
      }
    }
  }
  if (item.t === 'snap' && getPeopleCount() === 1) {
    lines.push(state.lang === 'en'
      ? 'Solo outdoor discount -€30 applied.'
      : state.lang === 'de'
        ? 'Solo-Outdoor-Rabatt -30€ angewendet.'
        : '야외 1인 촬영 할인 -€30이 적용되었습니다.');
  }
  if (item.g === 'wed' && state.quote.earlyBirdDiscount > 0) {
    lines.push(state.lang === 'en'
      ? `Early booking discount ${WEDDING_EARLY_BOOKING_DISCOUNT_RATE}% (-€${formatEuroAmount(state.quote.earlyBirdDiscount)}) applied.`
      : state.lang === 'de'
        ? `Frühbucher-Rabatt ${WEDDING_EARLY_BOOKING_DISCOUNT_RATE}% (-${formatEuroAmount(state.quote.earlyBirdDiscount)}€) angewendet.`
        : `얼리 예약 할인 ${WEDDING_EARLY_BOOKING_DISCOUNT_RATE}% (-€${formatEuroAmount(state.quote.earlyBirdDiscount)})가 적용되었습니다.`);
  }
  if (item.g === 'wed' && state.quote.marketingDiscount > 0) {
    lines.push(state.lang === 'en'
      ? `Marketing consent discount ${WEDDING_MARKETING_DISCOUNT_RATE}% (-€${formatEuroAmount(state.quote.marketingDiscount)}) applied.`
      : state.lang === 'de'
        ? `Marketing-Einwilligungsrabatt ${WEDDING_MARKETING_DISCOUNT_RATE}% (-${formatEuroAmount(state.quote.marketingDiscount)}€) angewendet.`
        : `마케팅 동의 할인 ${WEDDING_MARKETING_DISCOUNT_RATE}% (-€${formatEuroAmount(state.quote.marketingDiscount)})가 적용되었습니다.`);
  }
  if ((item.g === 'prof' || item.g === 'stud') && els.passAddonToggle?.checked) {
    lines.push(state.lang === 'en'
      ? `Passport add-on applied (+€${state.quote.passAddonPrice || 0}).`
      : state.lang === 'de'
        ? `Passfoto-Zusatz wurde angewendet (+€${state.quote.passAddonPrice || 0}).`
        : `여권 추가촬영이 적용되었습니다 (+€${state.quote.passAddonPrice || 0}).`);
  }
  return lines;
}

function getAppliedDiscountNote() {
  return getAppliedDiscountLines().join(' ');
}

function getWeddingBenefitBoxHtml() {
  if (state.selectedProduct?.g !== 'wed') return '';
  const copy = getWeddingCopy();
  const earlyActive = Number(state.quote?.earlyBirdDiscount || 0) > 0;
  const marketingActive = Number(state.quote?.marketingDiscount || 0) > 0;
  const totalDiscount = Number(state.quote?.earlyBirdDiscount || 0) + Number(state.quote?.marketingDiscount || 0);
  const appliedLine = totalDiscount > 0
    ? `<div class="wedding-benefit-applied">${escapeHtml(copy.appliedLabel)} <strong>-€${formatEuroAmount(totalDiscount)}</strong></div>`
    : '';
  const earlyStatus = !state.selectedDate
    ? copy.earlyPendingNoDate
    : earlyActive
      ? copy.earlyActive
      : copy.earlyPendingDate;
  const marketingStatus = marketingActive ? copy.marketingActive : copy.marketingPending;
  const refundRanges = Array.isArray(copy.refundRanges) && copy.refundRanges.length
    ? `<ul class="wedding-refund-list">${copy.refundRanges.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
    : '';
  return `
    <section class="wedding-benefit-box">
      <div class="wedding-benefit-eyebrow">${escapeHtml(copy.benefitEyebrow)}</div>
      <div class="wedding-benefit-title">${escapeHtml(copy.benefitTitle)}</div>
      <div class="wedding-benefit-body">${escapeHtml(copy.benefitBody)}</div>
      ${appliedLine}
      <div class="wedding-benefit-grid">
        <article class="wedding-benefit-card${earlyActive ? ' active' : ''}">
          <div class="wedding-benefit-card-title">${escapeHtml(copy.earlyTitle)}</div>
          <div class="wedding-benefit-card-body">${escapeHtml(copy.earlyBody)}</div>
          <div class="wedding-benefit-status${earlyActive ? ' active' : ''}">${escapeHtml(earlyStatus)}</div>
        </article>
        <article class="wedding-benefit-card${marketingActive ? ' active' : ''}">
          <div class="wedding-benefit-card-title">${escapeHtml(copy.marketingTitle)}</div>
          <div class="wedding-benefit-card-body">${escapeHtml(copy.marketingBody)}</div>
          <div class="wedding-benefit-status${marketingActive ? ' active' : ''}">${escapeHtml(marketingStatus)}</div>
        </article>
      </div>
      <div class="wedding-refund-box">
        <div class="wedding-refund-title">${escapeHtml(copy.refundTitle)}</div>
        <div class="wedding-refund-copy">${escapeHtml(copy.refundBody)}</div>
        ${refundRanges}
        <div class="wedding-refund-sub">${escapeHtml(copy.refundSub)}</div>
      </div>
    </section>
  `;
}

function getSecondaryPriceNote() {
  const item = state.selectedProduct;
  if (!item) return '';
  const sat = getSaturdaySurcharge(item);
  if (sat && !state.selectedDate) {
    if (state.lang === 'en') return `Weekday base price. Saturday adds +€${sat}.`;
    if (state.lang === 'de') return `Basispreis für Wochentage. Samstag +${sat}€.`;
    return `평일 기준 금액입니다. 토요일 선택 시 +${sat}€가 적용됩니다.`;
  }
  if (state.quote?.weekendSurcharge || getWeekendSurcharge(item, state.selectedDate)) {
    const amount = state.quote?.weekendSurcharge || getWeekendSurcharge(item, state.selectedDate);
    if (state.lang === 'en') return `Saturday surcharge +€${amount} applied.`;
    if (state.lang === 'de') return `Samstagszuschlag +${amount}€ angewendet.`;
    return `토요일 요금 +${amount}€가 적용되었습니다.`;
  }
  const discountNote = getAppliedDiscountLines();
  const peopleNote = getPeoplePricingNote(item, getPeopleCount());
  if (!discountNote.length) return peopleNote;
  if (!peopleNote) return '';
  if (item.t === 'snap' && getPeopleCount() === 1) return '';
  return peopleNote;
}

function renderProducts(products) {
  els.productGrid.className = state.selectedGroup === 'biz' ? 'product-grid event-product-grid' : 'product-grid';
  let safeProducts = Array.isArray(products) ? products : [];
  if (!safeProducts.length && state.selectedGroup) {
    const fallbackProducts = getVisibleProductsForSelectedGroup();
    if (fallbackProducts.length) safeProducts = fallbackProducts;
  }
  if (state.selectedGroup === 'biz') {
    renderEventProducts(safeProducts);
    return;
  }
  const cards = safeProducts.map((product) => {
    const duration = Number(product.d || 0);
    const selected = state.selectedProduct?.id === product.id ? ' selected' : '';
    const priceLabel = getProductPriceLabel(product);
    const eventBadge = getEventPeriodLabel()
      ? `<div class="product-badge">${escapeHtml(getEventPeriodLabel())}</div>`
      : '';
    const subtitle = state.lang === 'ko' && product.nameEn ? product.nameEn : '';
    return `
      <button type="button" class="product-card${selected}" data-id="${escapeHtml(product.id)}">
        ${eventBadge}
        <div class="product-card-head">
          <h3>${escapeHtml(getProductLabel(product))}</h3>
          <strong class="product-card-price">${escapeHtml(priceLabel)}</strong>
        </div>
        ${subtitle ? `<div class="product-card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        ${renderProductCardComposition(product)}
        <div class="product-meta">
          <span>${escapeHtml(getProductDurationLabel(duration))}</span>
        </div>
      </button>
    `;
  }).join('');
  els.productGrid.innerHTML = cards || `<div class="empty-state">${escapeHtml(getCopy().selectCategoryEmpty)}</div>`;
  els.productGrid.querySelectorAll('.product-card').forEach((button) => {
    button.addEventListener('click', () => selectProduct(button.dataset.id));
  });
}

function renderEventProducts(products) {
  // B2B 트랙: 상품 카드 대신 상담 연결 카드 (슬롯 예약 없음)
  if (state.bizTrack === 'b2b') {
    renderB2bConsultCards();
    return;
  }
  if (els.generalCopy) els.generalCopy.textContent = getGeneralPanelHelpCopy({ g: 'biz' });
  const productById = new Map((products || []).map((product) => [product.id, product]));
  const trackCategories = EVENT_PRODUCT_CATEGORIES.filter((category) => !state.bizTrack || category.track === state.bizTrack);
  const selectLabel = state.lang === 'en' ? 'Event type' : state.lang === 'de' ? 'Event-Typ' : '행사 유형';
  const selectPlaceholder = state.lang === 'en' ? 'Please choose an event type' : state.lang === 'de' ? 'Bitte Event-Typ wählen' : '행사 유형을 선택해 주세요';
  const selectorHtml = `
    <div class="event-type-panel">
      <label class="event-type-field">
        <span>${escapeHtml(selectLabel)}</span>
        <select id="eventCategorySelect">
          <option value="">${escapeHtml(selectPlaceholder)}</option>
          ${trackCategories.map((category) => `
            <option value="${escapeHtml(category.key)}"${category.key === state.eventCategory ? ' selected' : ''}>
              ${escapeHtml(getLocalizedText(category.title))}
            </option>
          `).join('')}
        </select>
      </label>
      ${state.eventCategory ? `<p>${escapeHtml(getLocalizedText(getSelectedEventCategoryMeta()?.sub))}</p>` : `<p>${escapeHtml(state.lang === 'en'
        ? 'Only related photo/video options will appear after this choice.'
        : state.lang === 'de'
          ? 'Danach werden nur passende Foto-/Video-Optionen angezeigt.'
          : '선택 후 관련 사진/영상 옵션만 표시됩니다.')}</p>`}
    </div>
  `;
  if (!state.eventCategory) {
    els.productGrid.innerHTML = `${selectorHtml}<div class="empty-state">${escapeHtml(selectPlaceholder)}</div>`;
    wireEventCategorySelect();
    return;
  }

  const sections = EVENT_PRODUCT_SECTIONS.filter((section) => section.category === state.eventCategory).map((section) => {
    const cards = section.ids.map((id) => productById.get(id)).filter(Boolean).map((product) => {
      const cardMeta = getEventProductCardMeta(product);
      const selected = state.selectedProduct?.id === product.id ? ' selected' : '';
      const priceLabel = getProductPriceLabel(product);
      const title = getLocalizedText(cardMeta.title, getProductLabel(product));
      const kicker = getLocalizedText(cardMeta.kicker, '');
      const type = getLocalizedText(cardMeta.type, '');
      const summary = getLocalizedText(cardMeta.summary, getProductDescription(product));
      return `
        <button type="button" class="product-card event-product-card${selected}" data-id="${escapeHtml(product.id)}">
          <div class="event-product-top">
            <span class="event-product-kicker">${escapeHtml(kicker)}</span>
            ${type ? `<span class="event-product-type">${escapeHtml(type)}</span>` : ''}
          </div>
          <h3>${escapeHtml(title)}</h3>
          <div class="event-product-summary">${escapeHtml(summary)}</div>
          ${renderProductCardComposition(product)}
          <div class="event-product-meta">
            <strong>${escapeHtml(priceLabel)}</strong>
            <span>${escapeHtml(getEventProductCardTimingLabel(product))}</span>
          </div>
        </button>
      `;
    }).join('');
    if (!cards) return '';
    return `
      <section class="event-product-section">
        <div class="event-product-section-head">
          <div>
            <div class="event-product-section-title">${escapeHtml(getLocalizedText(section.title))}</div>
            <p>${escapeHtml(getLocalizedText(section.sub))}</p>
          </div>
        </div>
        <div class="event-product-list">${cards}</div>
      </section>
    `;
  }).join('');

  els.productGrid.innerHTML = `${selectorHtml}${sections || `<div class="empty-state">${escapeHtml(getCopy().selectCategoryEmpty)}</div>`}`;
  wireEventCategorySelect();
  els.productGrid.querySelectorAll('.product-card').forEach((button) => {
    button.addEventListener('click', () => selectProduct(button.dataset.id));
  });
}

// B2B 상담 연결 카드 — 상품/슬롯 예약 없이 상담 설문으로 딥링크 (type 프리셀렉트)
const B2B_CONSULT_CARDS = [
  {
    key: 'corporate-event',
    type: 'event',
    title: { ko: '기업 행사', en: 'Corporate event', de: 'Firmenevent' },
    summary: {
      ko: '세미나, 컨퍼런스, 브랜드 행사, 사내 행사를 사진·영상으로 기록합니다.',
      en: 'Photo and video coverage for seminars, conferences, brand and company events.',
      de: 'Foto- und Videobegleitung für Seminare, Konferenzen, Brand- und Firmenevents.'
    }
  },
  {
    key: 'onsite',
    type: 'corporate',
    title: { ko: '기업 출장 촬영', en: 'On-site business shoot', de: 'Business Vor-Ort-Shooting' },
    summary: {
      ko: '임직원 프로필, 팀 단체사진, 사무실·매장 공간, 제품, 인터뷰 영상 — 회사로 찾아가 촬영합니다.',
      en: 'Staff portraits, team photos, office and store spaces, products, interview videos — we come to you.',
      de: 'Mitarbeiterporträts, Teamfotos, Büro- und Ladenräume, Produkte, Interviewvideos — wir kommen zu Ihnen.'
    }
  },
  {
    key: 'general-event',
    type: 'event',
    title: { ko: '공연 · 전시 · 일반 행사', en: 'Performance, exhibition & events', de: 'Auftritte, Ausstellungen & Events' },
    summary: {
      ko: '공연, 전시, 커뮤니티·개인 이벤트의 현장을 촬영합니다.',
      en: 'Coverage for performances, exhibitions, community and private events.',
      de: 'Begleitung von Auftritten, Ausstellungen, Community- und Privatevents.'
    }
  }
];

function renderB2bConsultCards() {
  const heading = state.lang === 'en'
    ? 'Tell us about your project — we reply with a custom quote within 1–2 business days.'
    : state.lang === 'de'
      ? 'Erzählen Sie uns von Ihrem Projekt — Sie erhalten innerhalb von 1–2 Werktagen ein individuelles Angebot.'
      : '어떤 촬영이 필요한지 알려주시면, 1–2 영업일 내에 맞춤 견적을 보내드립니다.';
  const ctaLabel = state.lang === 'en' ? 'Start consultation →' : state.lang === 'de' ? 'Beratung starten →' : '상담 설문 작성 →';
  const priceNote = state.lang === 'en' ? 'Custom quote' : state.lang === 'de' ? 'Individuelles Angebot' : '상담 후 맞춤 견적';
  const cards = B2B_CONSULT_CARDS.map((card) => {
    const url = `/consultation/?lang=${encodeURIComponent(state.lang)}&type=${encodeURIComponent(card.type)}&from=b2b&topic=${encodeURIComponent(card.key)}`;
    return `
      <a class="product-card event-product-card b2b-consult-card" href="${escapeHtml(url)}">
        <div class="event-product-top">
          <span class="event-product-kicker">B2B</span>
          <span class="event-product-type">${escapeHtml(priceNote)}</span>
        </div>
        <h3>${escapeHtml(getLocalizedText(card.title))}</h3>
        <div class="event-product-summary">${escapeHtml(getLocalizedText(card.summary))}</div>
        <div class="event-product-meta">
          <strong>${escapeHtml(ctaLabel)}</strong>
        </div>
      </a>
    `;
  }).join('');
  els.productGrid.innerHTML = `
    <div class="event-type-panel"><p>${escapeHtml(heading)}</p></div>
    <div class="event-product-list b2b-consult-list">${cards}</div>
  `;
}

function wireEventCategorySelect() {
  const select = document.getElementById('eventCategorySelect');
  if (!select) return;
  select.addEventListener('change', () => changeEventCategory(select.value));
}

function changeEventCategory(categoryKey) {
  state.eventCategory = categoryKey;
  state.selectedProduct = null;
  state.selectedDate = '';
  state.selectedSlot = '';
  state.selectedSlotMeta = null;
  state.showAllSlots = false;
  state.quote = null;
  state.earliestSlotInfo = null;
  state.businessMode = 'photo';
  state.businessHours = '2';
  state.businessVideoEdit = 'raw';
  state.businessAddonKeys = [];
  if (els.businessInput) els.businessInput.value = '';
  renderProducts((state.init?.products || []).filter((item) => item.g === 'biz'));
  renderGeneralPanel();
  renderProductDetail();
  renderEarliestSlotBox();
  renderReview();
  clearCalendarSelection();
  refreshStepLocks();
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

// 현재 달은 가용성 변동에 민감해 짧게, 미래 달은 서버 캐시(30분)와 정렬해 길게 유지
const MONTH_CACHE_TTL_CURRENT_MS = 4 * 60 * 1000;
const MONTH_CACHE_TTL_FUTURE_MS = 20 * 60 * 1000;
const MAX_BOOKING_MONTH = { year: 2026, month: 11 };

function getMonthCacheTtlMs(year, month) {
  const now = new Date();
  return (year === now.getFullYear() && month === now.getMonth())
    ? MONTH_CACHE_TTL_CURRENT_MS
    : MONTH_CACHE_TTL_FUTURE_MS;
}

function getMonthStorageKey(year, month, itemGroup, duration) {
  return `booking:month:v2:${year}_${month}_${itemGroup}_${duration}`;
}

function readMonthStorage(year, month, itemGroup, duration) {
  try {
    const raw = window.localStorage.getItem(getMonthStorageKey(year, month, itemGroup, duration));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.savedAt || !parsed.data) return null;
    if (Date.now() - Number(parsed.savedAt) > getMonthCacheTtlMs(year, month)) return null;
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
  // famevt/b2b는 UI 타일 — 실제 그룹은 biz. bizTrack으로 트랙만 구분 (백엔드 시맨틱 불변)
  const tileMeta = GROUP_META[groupKey] || {};
  const realGroupKey = tileMeta.realGroup || groupKey;
  state.bizTrack = tileMeta.realGroup ? groupKey : '';
  const groupProducts = (state.init?.products || []).filter((item) => item.g === realGroupKey);
  if (groupProducts.length === 1 && !tileMeta.realGroup) {
    state.selectedGroup = realGroupKey;
    selectProduct(groupProducts[0].id);
    return;
  }
  state.selectedGroup = realGroupKey;
  state.activeStep = 2;
  state.selectedProduct = null;
  state.selectedDate = '';
  state.selectedSlot = '';
  state.selectedSlotMeta = null;
  state.showAllSlots = false;
  state.quote = null;
  state.earliestSlotInfo = null;
  state.selectedCountries = [];
  state.passportConfigs = [];
  state.passportPersonCountries = [];
  state.optionKeys = [];
  state.surveyKeys = [];
  state.ageGroup = 'adult';
  state.babyType = 'infant';
  state.bgColors = [];
  state.businessMode = 'photo';
  state.businessHours = '2';
  state.businessVideoEdit = 'raw';
  state.businessAddonKeys = [];
  state.eventCategory = '';
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
  renderEarliestSlotBox();
  renderReview();
  clearCalendarSelection();
  refreshStepLocks();
  syncConsentVisibility();
}

async function selectProduct(productId) {
  clearSubmitResult();
  state.activeStep = 2;
  state.selectedProduct = (state.init?.products || []).find((item) => item.id === productId) || null;
  state.selectedGroup = state.selectedProduct?.g || state.selectedGroup;
  state.selectedDate = '';
  state.selectedSlot = '';
  state.selectedSlotMeta = null;
  state.showAllSlots = false;
  state.quote = null;
  state.earliestSlotInfo = null;
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
  state.babyType = 'infant';
  state.bgColors = [];
  state.businessMode = 'photo';
  state.businessHours = '2';
  state.businessVideoEdit = 'raw';
  state.businessAddonKeys = [];
  if (state.selectedProduct?.g !== 'biz') state.eventCategory = '';
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
  refreshStepLocks();
  syncConsentVisibility();
  await refreshQuote();
  updateEarliestSlotBox().catch((error) => console.error(error));
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
    els.optionField?.classList.add('hidden-field');
    syncConditionalFields();
    return;
  }
  if (els.generalCopy) els.generalCopy.textContent = getGeneralPanelHelpCopy(product);
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
  const optionMarkup = Object.entries(OPTION_META)
    .filter(([, meta]) => meta.groups.includes(product.g))
    .map(([key, meta]) => {
      const label = meta.label[state.lang] || meta.label.ko;
      const selected = state.optionKeys.includes(key) ? ' selected' : '';
      return `<button type="button" class="chip-btn toggle-chip${selected}" data-option="${key}">${escapeHtml(label)}</button>`;
    }).join('');
  const hasOptions = !!optionMarkup;
  els.optionField?.classList.toggle('hidden-field', !hasOptions);
  els.optionGrid.innerHTML = optionMarkup;
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

function listAvailableDatesForMonthData(data, year, month) {
  const safeData = data && typeof data === 'object' ? data : {};
  const unavail = new Set(Array.isArray(safeData.unavail) ? safeData.unavail : []);
  const closed = new Set(Array.isArray(safeData.closed) ? safeData.closed : []);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    if (dateKey < todayKey) continue;
    if (closed.has(dateKey) || unavail.has(dateKey)) continue;
    result.push(dateKey);
  }
  return result;
}

function renderEarliestSlotBox() {
  if (!els.quickSlotBox) return;
  if (!state.selectedProduct) {
    els.quickSlotBox.classList.add('hidden-field');
    els.quickSlotBox.innerHTML = '';
    return;
  }
  const copy = getCopy();
  const info = state.earliestSlotInfo;
  const value = info?.dateKey && info?.time ? formatDateTimeLabel(info.dateKey, info.time) : '—';
  const body = info?.loading
    ? copy.earliestSlotLoading
    : info?.dateKey && info?.time
      ? copy.earliestSlotAction
      : copy.earliestSlotEmpty;
  els.quickSlotBox.className = `detail-box quick-slot-box${info?.loading ? ' is-loading' : ''}`;
  els.quickSlotBox.classList.remove('hidden-field');
  els.quickSlotBox.innerHTML = `
    <div class="quick-slot-label">${escapeHtml(copy.earliestSlotTitle)}</div>
    <div class="quick-slot-value">${escapeHtml(info?.loading ? copy.earliestSlotLoading : value)}</div>
    <div class="quick-slot-copy">${escapeHtml(body)}</div>
  `;
}

async function getCalendarMonthData(year, month, duration, itemGroup) {
  const cacheKey = `${year}_${month}_${itemGroup}_${duration}`;
  let batch = state.calendarCache.get(cacheKey);
  if (!batch) {
    batch = readMonthStorage(year, month, itemGroup, duration);
    if (batch) state.calendarCache.set(cacheKey, batch);
  }
  if (batch) return batch;
  const fetched = await fetchAndStoreCalendarBatch(year, month, duration, itemGroup);
  return state.calendarCache.get(cacheKey) || fetched || null;
}

async function findEarliestAvailableSlot(product, duration) {
  if (!product) return null;
  const months = [{ year: state.calendarYear, month: state.calendarMonth }];
  const next = new Date(state.calendarYear, state.calendarMonth + 1, 1);
  if (next.getFullYear() < MAX_BOOKING_MONTH.year || (next.getFullYear() === MAX_BOOKING_MONTH.year && next.getMonth() <= MAX_BOOKING_MONTH.month)) {
    months.push({ year: next.getFullYear(), month: next.getMonth() });
  }
  for (const ref of months) {
    const batch = await getCalendarMonthData(ref.year, ref.month, duration, product.g);
    const candidateDates = listAvailableDatesForMonthData(batch, ref.year, ref.month).slice(0, 6);
    for (const dateKey of candidateDates) {
      const slotKey = `${dateKey}_${product.g}_${duration}`;
      let slots = state.slotCache.get(slotKey);
      if (!Array.isArray(slots)) {
        try {
          slots = await fetchSlots({ date: dateKey, totalDur: duration, itemGroup: product.g });
          state.slotCache.set(slotKey, slots);
        } catch (error) {
          console.error(error);
          slots = [];
        }
      }
      if (Array.isArray(slots) && slots.length) {
        const first = typeof slots[0] === 'string' ? slots[0] : slots[0]?.time;
        if (first) return { dateKey, time: first };
      }
    }
  }
  return null;
}

async function updateEarliestSlotBox() {
  if (!state.selectedProduct || !els.quickSlotBox) {
    state.earliestSlotInfo = null;
    renderEarliestSlotBox();
    return;
  }
  const token = ++state.earliestSlotToken;
  state.earliestSlotInfo = { loading: true };
  renderEarliestSlotBox();
  const nextInfo = await findEarliestAvailableSlot(state.selectedProduct, getCalendarDuration());
  if (token !== state.earliestSlotToken) return;
  state.earliestSlotInfo = nextInfo || null;
  renderEarliestSlotBox();
}

function syncConditionalFields() {
  const group = state.selectedProduct?.g || '';
  const needsBabyType = needsBabyTypeChoice(state.selectedProduct);
  const needsBabyName = needsBabyNameForBooking(state.selectedProduct);
  const needsPayerName = Number(state.quote?.depositAmount || getPreviewQuote()?.depositAmount || 0) > 0;
  const needsBusinessInvoice = !!els.form?.elements?.businessInvoiceNeeded?.checked;
  syncPassportPersonCountries();
  els.addressField?.classList.toggle('hidden-field', needsBusinessInvoice);
  els.businessInvoiceFields?.classList.toggle('hidden-field', !needsBusinessInvoice);
  els.otherCountryField.classList.toggle('hidden-field', !(group === 'pass' && state.selectedCountries.includes('OTHER')));
  els.locationField.classList.toggle('hidden-field', !(group === 'snap' || group === 'wed' || group === 'biz'));
  els.businessField.classList.toggle('hidden-field', group !== 'biz');
  els.surveyField.classList.toggle('hidden-field', !group || group === 'pass' || group === 'biz');
  els.ageField.classList.toggle('hidden-field', group !== 'prof');
  els.profileAgeField?.classList.toggle('hidden-field', !needsProfileAgeField());
  els.babyTypeField.classList.toggle('hidden-field', !needsBabyType);
  // 숨김 여부를 정한 뒤에 자리를 잡는다 — 분위기 필드가 아직 숨겨져 있으면 그 아래로 옮기지 않는다.
  placeBabyTypeField();
  els.babyNameField.classList.toggle('hidden-field', !needsBabyName);
  els.studioFamilyField?.classList.toggle('hidden-field', !needsStudioFamilyField());
  els.payerNameField.classList.toggle('hidden-field', !needsPayerName);
  els.reshootingField.classList.toggle('hidden-field', !needsReshootingConsent(state.selectedProduct));
  els.bgField.classList.toggle('hidden-field', !(group === 'prof' || group === 'stud'));
  if (group === 'biz') renderBusinessOptions();
  syncMarketingConsentCopy();
  syncMemoPlaceholder();
}

function syncMemoPlaceholder() {
  const memo = els.form?.elements?.memo;
  if (!memo) return;
  if (state.surveyKeys.includes('baby') || (state.selectedProduct?.g === 'prof' && state.ageGroup === 'baby')) {
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
    isReturn: product.g !== 'pass' && product.t !== 'passport' && !!state.returnEligible,
    ageGroup: product.g === 'prof' ? state.ageGroup : 'adult',
    babyType: getActiveBabyType(product),
    bgColors: [...state.bgColors],
    businessMode: isGenericBusinessProduct(product) ? state.businessMode : '',
    businessHours: isGenericBusinessProduct(product) ? Number(state.businessHours || 2) : '',
    businessVideoEdit: isGenericBusinessProduct(product) ? state.businessVideoEdit : '',
    businessAddonKeys: isGenericBusinessProduct(product) ? [...state.businessAddonKeys] : [],
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

// 예약 때 인화(출력) 안내 — 사진촬영 계열(프로필/스튜디오/스냅/웨딩)만. 사이즈(cm)·추가 단가·수령방식을
// 촬영 전에 미리 보여준다. 실제 주문은 촬영 후 셀렉 단계에서. (여권/기업/견적형은 별도 흐름이라 제외)
const PRINT_INFO_GROUPS = new Set(['prof', 'stud', 'snap', 'wed']);
function renderPrintInfoSection(product) {
  if (!product || !PRINT_INFO_GROUPS.has(product.g)) return '';
  const lang = state.lang;
  const t = (ko, en, de) => (lang === 'en' ? en : lang === 'de' ? de : ko);
  // print-tier-copy.js 의 고정 카피는 법률 검수를 통과한 원문이라 그대로 raw 보간한다
  // (PRINT_METHOD_POINTS.body 에는 의도된 <br> 이 들어있어 escapeHtml 하면 태그가 노출된다).
  const pick = (field) => (field && (field[lang] || field.ko)) || '';
  const tierCompare = ['signature', 'fineart'].map((grade) => {
    const tier = PRINT_TIERS[grade];
    if (!tier) return '';
    return `
        <div class="print-tier-compare-item">
          <div class="print-tier-compare-name">${printCatalogGradeLabel(grade, lang)}</div>
          <p class="print-tier-compare-line">${pick(tier.character)}</p>
          <p class="print-tier-compare-line print-tier-compare-best">${pick(tier.bestFor)}</p>
        </div>`;
  }).join('');
  // 등급별 섹션. 포토카드처럼 paperSpec 이 없는 등급은 용지 줄을 생략한다.
  const groups = groupPrintCatalogByGrade().map((group) => {
    const paperSpec = pick(PRINT_TIERS[group.grade]?.paperSpec);
    const rows = group.items.map((item) => `
            <div class="print-info-row">
              <span>${escapeHtml(printCatalogName(item, lang))} <span class="print-info-row-cm">· ${escapeHtml(item.cm)}</span></span>
              <strong>€${item.additional}</strong>
            </div>`).join('');
    return `
          <div class="print-info-group">
            <div class="print-info-group-head">
              <span class="print-info-group-name">${escapeHtml(printCatalogGradeLabel(group.grade, lang))}</span>
              ${paperSpec ? `<span class="print-info-group-paper">${paperSpec}</span>` : ''}
            </div>
            ${rows}
          </div>`;
  }).join('');
  const method = PRINT_METHOD_POINTS[lang] || PRINT_METHOD_POINTS.ko;
  const methodHtml = `
        <div class="print-method">
          <div class="print-method-title">${method.title}</div>
          ${method.points.map((point) => `
            <div class="print-method-point">
              <div class="print-method-head">${point.head}</div>
              <p class="print-method-body">${point.body}</p>
            </div>`).join('')}
        </div>`;
  return `
    <details class="print-info-box">
      <summary class="print-info-summary">📷 ${t('인화(출력) 사이즈·가격 안내', 'Print sizes & prices', 'Abzüge – Größen & Preise')}</summary>
      <div class="print-info-body">
        <p class="print-info-lead">${t(
          '기본 포함 인화 외에 원하시면 아래 사이즈로 추가 인화하실 수 있어요. 사이즈·수량은 <b>촬영 후 사진 선택 단계</b>에서 정하시면 됩니다.',
          'Beyond the prints included in your package, you can order extra prints in the sizes below. You choose sizes and quantities <b>after the shoot, at the photo-selection step</b>.',
          'Zusätzlich zu den enthaltenen Abzügen können Sie weitere Abzüge in den Größen unten bestellen. Größe und Menge wählen Sie <b>nach dem Shooting im Auswahlschritt</b>.'
        )}</p>
        <div class="print-tier-compare">
          ${tierCompare}
        </div>
        <div class="print-info-table">
          ${groups}
        </div>
        <p class="print-info-foot">${t(
          '가격은 추가 인화 1장 기준이에요. 수령은 <b>스튜디오 픽업</b> 또는 <b>우편</b> 중 선택 — 인화가 완료되면 안내 링크를 보내드려요.',
          'Prices are per extra print. Delivery: choose <b>studio pickup</b> or <b>post</b> — we email you a link once printing is done.',
          'Preise gelten pro zusätzlichem Abzug. Zustellung: <b>Abholung im Studio</b> oder <b>Post</b> — nach dem Druck senden wir Ihnen einen Link.'
        )}</p>
        ${methodHtml}
      </div>
    </details>`;
}

function renderProductDetail() {
  if (!state.selectedProduct) {
    els.productDetail.className = 'detail-box empty-state';
    els.productDetail.textContent = getProductDetailEmptyCopy();
    syncConsultationLinks();
    return;
  }
  const business = isGenericBusinessProduct(state.selectedProduct) ? getBusinessSelection() : null;
  const desc = business
    ? (state.lang === 'en'
      ? `${business.label}. Original files are included. Optional requests are reviewed after booking.`
      : state.lang === 'de'
        ? `${business.label}. Originaldateien sind inklusive. Zusatzwünsche werden nach der Buchung geprüft.`
        : `${business.label}. 원본 제공이 포함되며, 추가 요청은 예약 접수 후 검토됩니다.`)
    : getProductDescription(state.selectedProduct);
  const quoteOnly = !!state.quote?.isQuoteOnly || isQuoteOnlyProduct(state.selectedProduct);
  const quoteHeroLabel = state.lang === 'en'
    ? 'Consultation quote'
    : state.lang === 'de'
      ? 'Beratungsangebot'
      : '상담 견적';
  const quoteHeroCopy = state.lang === 'en'
    ? 'We review the event purpose, schedule, location and deliverables, then send a clear quote by email.'
    : state.lang === 'de'
      ? 'Wir prüfen Zweck, Ablauf, Ort und gewünschte Lieferung und senden danach ein klares Angebot per E-Mail.'
      : '행사 목적, 시간대, 장소, 필요한 결과물을 확인한 뒤 이메일로 맞춤 견적을 안내드립니다.';
  const discountLines = getAppliedDiscountLines();
  const discountHtml = discountLines.length
    ? `<div class="discount-note-list">${discountLines.map((line) => `<div class="discount-note-item">${escapeHtml(line)}</div>`).join('')}</div>`
    : '';
  const weddingBenefitHtml = getWeddingBenefitBoxHtml();
  const composition = getProductComposition(state.selectedProduct);
  const detailIntro = getProductDetailIntro(state.selectedProduct, desc, composition);
  const compositionHtml = renderProductCompositionPanel(state.selectedProduct);
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
        ${businessModeUsesVideo(state.businessMode) ? `<div class="biz-summary-item">
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
    <div class="detail-title">${escapeHtml(getDisplayProductTitle(state.selectedProduct))}</div>
    ${detailIntro ? `<div class="detail-copy product-detail-intro">${escapeHtml(detailIntro)}</div>` : ''}
    ${getSnapRetouchScopeNote(state.selectedProduct) ? `<div class="detail-copy snap-scope-note">${escapeHtml(getSnapRetouchScopeNote(state.selectedProduct))}</div>` : ''}
    ${businessSummary}
    ${compositionHtml}
    ${renderPrintInfoSection(state.selectedProduct)}
    ${eventBadge}
    ${quoteOnly ? `
      <div class="price-hero">
        <div class="price-hero-label">${quoteHeroLabel}</div>
        <div class="price-hero-value" style="font-size:26px;">${escapeHtml(getQuotePriceLabel())}</div>
        <div class="price-hero-copy">${quoteHeroCopy}</div>
      </div>
      <div class="consultation-inline-card">
        <p class="consultation-inline-copy">${escapeHtml(getCopy().quoteConsultationCopy)}</p>
        <a class="consultation-inline-link" data-consultation-link href="${escapeHtml(getConsultationUrl())}">${escapeHtml(getCopy().quoteConsultationButton)}</a>
      </div>
    ` : `
      ${discountHtml}
      ${getProductPolicyNote(state.selectedProduct) ? `<div class="muted-copy" style="margin-top:10px;">${escapeHtml(getProductPolicyNote(state.selectedProduct))}</div>` : ''}
      ${getSecondaryPriceNote() ? `<div class="muted-copy" style="margin-top:8px;">${escapeHtml(getSecondaryPriceNote())}</div>` : ''}
    `}
    ${weddingBenefitHtml}
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
    els.calendarGrid.innerHTML = renderCalendarSkeleton();
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
  const nearestDate = getNearestAvailableDate(batch);
  if (!nearestDate && !state.selectedDate) {
    // 이 달엔 예약 가능한 날짜가 하나도 없음 — '가능 날짜를 고르라'는 기본 안내는 오히려
    // 없는 날짜를 찾아 헤매게 만든다. 명확히 '다른 달을 보라'고 안내한다.
    setBanner(getCopy().calendarMonthEmpty, 'info');
    els.calendarHint.textContent = `${getProductLabel(state.selectedProduct)} · ${getCopy().calendarMonthEmptyHint}`;
  } else {
    setBanner(getCopy().calendarLoaded, 'success');
    els.calendarHint.textContent = `${getProductLabel(state.selectedProduct)} · ${getCopy().calendarLoadedHint}`;
    if (!state.selectedDate) await selectDate(nearestDate, { auto: true });
  }
  prefetchNextCalendarMonth();
}

async function fetchAndStoreCalendarBatch(year, month, duration, itemGroup) {
  const t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  const batch = await fetchCalendarBatch({
    year,
    month,
    totalDur: duration,
    itemGroup
  });
  const ms = ((window.performance && performance.now) ? performance.now() : Date.now()) - t0;
  recordCalendarTiming(year, month, ms);   // #10 계측: 월별 로드타임 수집 (TTL·프리페치 튜닝 근거)
  Object.entries(batch || {}).forEach(([monthKey, data]) => {
    const fullKey = `${monthKey}_${itemGroup}_${duration}`;
    state.calendarCache.set(fullKey, data);
    const [yearPart, monthPart] = monthKey.split('_');
    writeMonthStorage(Number(yearPart), Number(monthPart), itemGroup, duration, data);
  });
  return batch?.[`${year}_${month}`] || Object.values(batch || {})[0] || null;
}

// #10 캘린더 성능 계측 — 현재/다음/셋째 달 로드타임 갭을 실측 수집.
// 롤링 통계를 localStorage(booking:calperf)에 저장. 콘솔에서 __calPerf() 로 열람.
function recordCalendarTiming(year, month, ms) {
  try {
    const now = new Date();
    const offset = (year - now.getFullYear()) * 12 + (month - now.getMonth());  // 0=현재달
    const bucket = offset <= 0 ? 'cur' : (offset === 1 ? 'next' : (offset === 2 ? 'third' : 'far'));
    const raw = window.localStorage.getItem('booking:calperf');
    const s = raw ? JSON.parse(raw) : {};
    const b = s[bucket] || { n: 0, sum: 0, max: 0 };
    b.n += 1; b.sum += ms; b.max = Math.max(b.max, Math.round(ms));
    s[bucket] = b; s.updatedAt = Date.now();
    window.localStorage.setItem('booking:calperf', JSON.stringify(s));
    if (ms > 1500) console.warn(`[calperf] ${bucket} 달 로드 ${Math.round(ms)}ms (느림)`);
  } catch (e) { /* 계측 실패는 무시 */ }
}
if (typeof window !== 'undefined') {
  window.__calPerf = function () {   // 콘솔 열람용: 버킷별 평균/최대/샘플수
    try {
      const s = JSON.parse(window.localStorage.getItem('booking:calperf') || '{}');
      ['cur', 'next', 'third', 'far'].forEach((k) => {
        const b = s[k]; if (b) console.log(`${k}: 평균 ${Math.round(b.sum / b.n)}ms · 최대 ${b.max}ms · n=${b.n}`);
      });
      return s;
    } catch (e) { return null; }
  };
}

async function prefetchNextCalendarMonth() {
  // 보이는 달 기준 +1, +2달을 순차 프리페치 — 달을 연속으로 넘겨도 로딩 갭이 생기지 않게 함
  if (!state.selectedProduct) return;
  const duration = getCalendarDuration();
  const tasks = [];
  for (let offset = 1; offset <= 2; offset += 1) {
    const next = new Date(state.calendarYear, state.calendarMonth + offset, 1);
    if (next.getFullYear() > MAX_BOOKING_MONTH.year || (next.getFullYear() === MAX_BOOKING_MONTH.year && next.getMonth() > MAX_BOOKING_MONTH.month)) break;
    const nextKey = `${next.getFullYear()}_${next.getMonth()}_${state.selectedProduct.g}_${duration}`;
    if (state.calendarCache.has(nextKey)) continue;
    tasks.push({ year: next.getFullYear(), month: next.getMonth(), itemGroup: state.selectedProduct.g, totalDur: duration });
  }
  if (tasks.length) await warmCalendarRange(tasks);
}

/* 슬롯 프리페치 — 고객이 클릭하기 전에 그 날짜의 슬롯을 백그라운드로 당겨 slotCache 에 넣는다.
   서버 슬롯 계산이 느린 그룹(스튜디오 자동오픈 ~8초)에서 클릭 지연을 숨긴다. loadSlotsForDate 가
   캐시를 먼저 보므로, 프리페치된 날짜는 클릭 즉시 렌더된다. 이미 캐시/진행중이면 no-op(중복 방지).
   실패는 조용히 무시 — 실제 클릭 시 loadSlotsForDate 가 다시 시도한다. 렌더/토큰은 건드리지 않음. */
function prefetchSlotsForDate(dateKey) {
  if (!state.selectedProduct || !dateKey) return null;
  const duration = getCalendarDuration();
  const slotKey = `${dateKey}_${state.selectedProduct.g}_${duration}`;
  if (state.slotCache.has(slotKey)) return Promise.resolve(state.slotCache.get(slotKey));
  const existing = state.slotPrefetchInFlight.get(slotKey);
  if (existing) return existing;   // 이미 진행 중이면 그 프로미스를 재사용(중복 요청 방지)
  const promise = fetchSlots({ date: dateKey, totalDur: duration, itemGroup: state.selectedProduct.g })
    .then((slots) => { if (!state.slotCache.has(slotKey)) state.slotCache.set(slotKey, slots); return slots; })
    .finally(() => { state.slotPrefetchInFlight.delete(slotKey); });
  state.slotPrefetchInFlight.set(slotKey, promise);
  return promise;
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
    // 프리페치(호버/터치)가 진행 중이면 그 요청에 올라타 중복 조회를 피한다. 실패 시 신선 재시도.
    const inflight = state.slotPrefetchInFlight.get(slotKey);
    if (inflight) {
      try { slots = await inflight; }
      catch (e) { slots = await fetchSlots({ date: dateKey, totalDur: duration, itemGroup: state.selectedProduct.g }); }
    } else {
      slots = await fetchSlots({ date: dateKey, totalDur: duration, itemGroup: state.selectedProduct.g });
    }
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

function renderCalendarSkeleton() {
  // 로딩 중에도 달력 구조(요일 오프셋 + 날짜 숫자)를 유지해 화면 흔들림과 혼란을 줄임
  const firstDay = new Date(state.calendarYear, state.calendarMonth, 1).getDay();
  const daysInMonth = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push('<div class="calendar-cell muted"></div>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`<div class="calendar-cell skeleton" aria-hidden="true">${day}</div>`);
  }
  return cells.join('');
}

function renderCalendar(data) {
  const copy = getCopy();
  const safeData = data && typeof data === 'object' ? data : {};
  const unavailSource = Array.isArray(safeData.unavail) ? safeData.unavail : [];
  const closedSource = Array.isArray(safeData.closed) ? safeData.closed : [];
  els.calendarGrid.classList.remove('empty-state');
  const unavail = new Set(unavailSource);
  const closed = new Set(closedSource);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const firstDay = new Date(state.calendarYear, state.calendarMonth, 1).getDay();
  const daysInMonth = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push('<div class="calendar-cell muted"></div>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${state.calendarYear}-${pad2(state.calendarMonth + 1)}-${pad2(day)}`;
    const isPast = dateKey < todayKey;
    const isClosed = closed.has(dateKey) && !isPast;
    const isFull = !isClosed && unavail.has(dateKey) && !isPast;
    const disabled = isPast || isClosed;
    const selected = state.selectedDate === dateKey;
    const classes = ['calendar-cell'];
    if (disabled) classes.push('muted');
    if (isClosed) classes.push('closed');
    if (isFull) classes.push('full');
    if (selected) classes.push('selected');
    const statusLabel = isClosed ? copy.calendarClosedShort : isFull ? copy.calendarFullShort : '';
    cells.push(`
      <button type="button" class="${classes.join(' ')}" data-date="${dateKey}" ${disabled ? 'disabled' : ''}${isFull ? ' data-full="1"' : ''}${isClosed ? ' data-closed="1"' : ''}${statusLabel ? ` data-status-label="${escapeHtml(statusLabel)}"` : ''}>
        ${day}
      </button>
    `);
  }
  els.calendarGrid.innerHTML = cells.join('');
  els.calendarGrid.querySelectorAll('.calendar-cell[data-date]').forEach((button) => {
    button.addEventListener('click', () => selectDate(button.dataset.date));
    // 예약 가능 날짜(마감/휴무/과거 아님)만 호버·터치 시 슬롯 프리페치 — 클릭 지연 숨김
    if (!button.disabled && !button.dataset.full && !button.dataset.closed) {
      const pf = () => prefetchSlotsForDate(button.dataset.date);
      button.addEventListener('mouseenter', pf);
      button.addEventListener('touchstart', pf, { passive: true });
    }
  });
  const legendFull = document.getElementById('legendFullLabel');
  const legendClosed = document.getElementById('legendClosedLabel');
  if (legendFull && legendClosed) {
    legendFull.textContent = copy.legendFullLabel;
    legendClosed.textContent = copy.legendClosedLabel;
  }
}

function getNearestAvailableDate(data) {
  const safeData = data && typeof data === 'object' ? data : {};
  const unavail = new Set(Array.isArray(safeData.unavail) ? safeData.unavail : []);
  const closed = new Set(Array.isArray(safeData.closed) ? safeData.closed : []);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const daysInMonth = new Date(state.calendarYear, state.calendarMonth + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${state.calendarYear}-${pad2(state.calendarMonth + 1)}-${pad2(day)}`;
    if (dateKey < todayKey) continue;
    if (closed.has(dateKey)) continue;   // 휴무/예약범위 밖 — 예약 불가라 자동선택 대상 아님
    if (unavail.has(dateKey)) continue;  // 마감(full)
    return dateKey;
  }
  return '';   // 이 달엔 예약 가능한 날짜가 하나도 없음(과거·휴무·마감뿐)
}

async function selectDate(dateKey, options = {}) {
  state.slotRequestToken += 1;
  state.selectedDate = dateKey;
  state.activeStep = 3;
  state.selectedSlot = '';
  state.selectedSlotMeta = null;
  state.showAllSlots = false;
  els.slotHint.textContent = fillCopy(getCopy().slotLoadingForDate, { date: formatDateLabel(dateKey) });
  els.slotGrid.classList.add('empty-state');
  els.slotGrid.innerHTML = renderPanelLoading(getCopy().loadCalendar);
  renderSeniorWarning();
  const duration = getCalendarDuration();
  renderCalendar(state.calendarCache.get(`${state.calendarYear}_${state.calendarMonth}_${state.selectedProduct.g}_${duration}`));
  await loadSlotsForDate(dateKey);
  if (!options.auto) scrollSlotPanelIntoView();
  refreshQuote().catch((error) => console.error(error));
  renderReview();
  syncStepPanels();
}

function normalizeSlotEntry(slot) {
  if (typeof slot === 'string') {
    return {
      time: slot,
      endTime: '',
      status: 'request_only',
      confirmationMode: 'manual_review_required',
      fastConfirm: false,
      manualReviewRequired: true,
      distanceMin: '',
      anchorWindow: '',
      recommendationSource: ''
    };
  }
  const entry = slot && typeof slot === 'object' ? slot : {};
  return {
    time: String(entry.time || ''),
    endTime: String(entry.endTime || ''),
    status: String(entry.status || 'request_only'),
    confirmationMode: String(entry.confirmationMode || 'manual_review_required'),
    fastConfirm: !!entry.fastConfirm,
    manualReviewRequired: entry.manualReviewRequired !== false,
    distanceMin: entry.distanceMin === 0 || entry.distanceMin ? String(entry.distanceMin) : '',
    anchorWindow: String(entry.anchorWindow || ''),
    recommendationSource: String(entry.recommendationSource || '')
  };
}

function renderSlotButton(entry) {
  const copy = getCopy();
  const selected = state.selectedSlot === entry.time;
  const isRecommended = entry.status === 'recommended';
  const badge = isRecommended ? `<span class="slot-badge">${escapeHtml(copy.slotFastConfirmLabel)}</span>` : '';
  return `
    <button type="button" class="slot-btn slot-btn-card${selected ? ' selected' : ''}${isRecommended ? ' recommended' : ' request-only'}" data-time="${escapeHtml(entry.time)}">
      <span class="slot-time-row">
        <span class="slot-time">${escapeHtml(entry.time)}</span>
        ${badge}
      </span>
    </button>
  `;
}

function bindSlotButtons(entries) {
  const entryMap = new Map(entries.map((entry) => [entry.time, entry]));
  els.slotGrid.querySelectorAll('.slot-btn[data-time]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSlot = button.dataset.time;
      state.selectedSlotMeta = entryMap.get(state.selectedSlot) || null;
      els.slotGrid.querySelectorAll('.slot-btn[data-time]').forEach((item) => item.classList.toggle('selected', item.dataset.time === state.selectedSlot));
      els.slotHint.textContent = fillCopy(getCopy().slotLoadedForDate, { date: formatDateLabel(state.selectedDate) });
      updateSubmitState();
      renderReview();
      syncStepPanels();
      renderStepWarnings();
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
}

function renderSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    els.slotGrid.classList.add('empty-state');
    els.slotGrid.innerHTML = `<div class="empty-state">${getCopy().noSlots}</div>${renderWaitlistBlock()}`;
    bindWaitlistHandlers();
    els.submitBtn.disabled = true;
    return;
  }
  const entries = slots
    .map(normalizeSlotEntry)
    .filter((entry) => entry.time)
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
  els.slotGrid.classList.remove('empty-state');
  els.slotGrid.innerHTML = `<div class="slot-list slot-list-unified">${entries.map(renderSlotButton).join('')}</div>`;
  bindSlotButtons(entries);
  updateSubmitState();
}

function getWaitlistCopy() {
  const lang = state.lang;
  if (lang === 'en') {
    return {
      intro: 'Fully booked — join the waitlist and we will email you the moment a slot opens.',
      nameLbl: 'Name', emailLbl: 'Email', phoneLbl: 'Phone (optional)',
      submit: 'Join waitlist', submitting: 'Submitting…',
      success: 'You are on the list. We will notify you as soon as a slot opens.',
      duplicate: 'You are already on the waitlist for this date.',
      fail: 'Could not register your waitlist entry. Please try again.',
      requireFields: 'Please enter name and a valid email address.'
    };
  }
  if (lang === 'de') {
    return {
      intro: 'Dieser Tag ist ausgebucht. Lassen Sie sich auf die Warteliste setzen — wir schreiben Ihnen, sobald ein Termin frei wird.',
      nameLbl: 'Name', emailLbl: 'E-Mail', phoneLbl: 'Telefon (optional)',
      submit: 'Auf Warteliste setzen', submitting: 'Wird gesendet…',
      success: 'Sie stehen auf der Warteliste. Wir informieren Sie, sobald ein Termin frei wird.',
      duplicate: 'Sie stehen für diesen Tag bereits auf der Warteliste.',
      fail: 'Eintrag konnte nicht gespeichert werden. Bitte erneut versuchen.',
      requireFields: 'Bitte Name und eine gültige E-Mail-Adresse eingeben.'
    };
  }
  return {
    intro: '이 날짜는 예약이 마감되었습니다. 대기 등록을 남겨 두시면 취소 발생 시 즉시 메일로 안내드립니다.',
    nameLbl: '이름', emailLbl: '이메일', phoneLbl: '연락처 (선택)',
    submit: '대기 등록 신청', submitting: '등록 중…',
    success: '대기 등록이 완료되었습니다. 자리가 열리면 즉시 안내드리겠습니다.',
    duplicate: '이미 해당 날짜에 대기 등록이 되어 있습니다.',
    fail: '대기 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    requireFields: '이름과 올바른 이메일을 입력해 주세요.'
  };
}

function renderWaitlistBlock() {
  if (!state.selectedProduct || !state.selectedDate) return '';
  const c = getWaitlistCopy();
  return `
    <div class="waitlist-box" data-role="waitlist-box" style="margin-top:16px;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
      <p style="margin:0 0 12px;font-size:13px;color:#475569;line-height:1.5;">${escapeHtml(c.intro)}</p>
      <div style="display:grid;gap:8px;">
        <input type="text" data-role="wl-name" placeholder="${escapeHtml(c.nameLbl)}" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;">
        <input type="email" data-role="wl-email" placeholder="${escapeHtml(c.emailLbl)}" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;">
        <input type="tel" data-role="wl-phone" placeholder="${escapeHtml(c.phoneLbl)}" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;">
      </div>
      <button type="button" data-role="wl-submit" style="margin-top:12px;padding:10px 16px;background:#0f172a;color:#fff;border:0;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">${escapeHtml(c.submit)}</button>
      <p data-role="wl-msg" style="margin:10px 0 0;font-size:13px;min-height:18px;"></p>
    </div>`;
}

function bindWaitlistHandlers() {
  const box = els.slotGrid.querySelector('[data-role="waitlist-box"]');
  if (!box) return;
  const btn = box.querySelector('[data-role="wl-submit"]');
  const msg = box.querySelector('[data-role="wl-msg"]');
  const c = getWaitlistCopy();
  // Pre-fill from contact form if already typed
  try {
    const formName = String(els.form?.elements?.name?.value || '').trim();
    const formEmail = String(els.form?.elements?.email?.value || '').trim();
    const formPhone = String(els.form?.elements?.phone?.value || '').trim();
    if (formName) box.querySelector('[data-role="wl-name"]').value = formName;
    if (formEmail) box.querySelector('[data-role="wl-email"]').value = formEmail;
    if (formPhone) box.querySelector('[data-role="wl-phone"]').value = formPhone;
  } catch {}
  btn?.addEventListener('click', async () => {
    const name = String(box.querySelector('[data-role="wl-name"]').value || '').trim();
    const email = String(box.querySelector('[data-role="wl-email"]').value || '').trim();
    const phone = String(box.querySelector('[data-role="wl-phone"]').value || '').trim();
    if (!name || !/\S+@\S+\.\S+/.test(email)) {
      msg.textContent = c.requireFields;
      msg.style.color = '#dc2626';
      return;
    }
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = c.submitting;
    msg.textContent = '';
    try {
      const product = state.selectedProduct;
      const res = await joinWaitlist({
        name, email, phone,
        lang: state.lang || 'ko',
        date: state.selectedDate,
        itemGroup: product?.g || '',
        product: getProductLabel(product) || '',
        totalDur: getSelectedDuration() || 0
      }, createRequestId());
      if (res?.duplicate) {
        msg.textContent = c.duplicate;
        msg.style.color = '#b45309';
      } else if (res?.ok) {
        msg.textContent = c.success;
        msg.style.color = '#047857';
        btn.disabled = true;
      } else {
        msg.textContent = res?.message || c.fail;
        msg.style.color = '#dc2626';
        btn.disabled = false;
      }
    } catch (err) {
      msg.textContent = err?.message || c.fail;
      msg.style.color = '#dc2626';
      btn.disabled = false;
    } finally {
      if (!btn.disabled) btn.textContent = originalLabel;
    }
  });
}

let _contactLookupTimer = null;
let _contactLookupLastKey = '';
let _contactLookupApplied = false;

function getContactLookupCopy() {
  const lang = state.lang;
  if (lang === 'en') {
    return {
      hi: (name, visits) => `Welcome back, ${name}. We found ${visits} previous session${visits === 1 ? '' : 's'} on file.`,
      apply: 'Autofill name, phone & address',
      applied: 'Contact details filled in from your last booking.',
      dismiss: 'Dismiss'
    };
  }
  if (lang === 'de') {
    return {
      hi: (name, visits) => `Willkommen zurück, ${name}. Wir finden ${visits} frühere${visits === 1 ? 's' : ''} Termin${visits === 1 ? '' : 'e'} auf Ihrem Namen.`,
      apply: 'Name, Telefon & Adresse übernehmen',
      applied: 'Kontaktdaten aus Ihrem letzten Termin wurden übernommen.',
      dismiss: 'Ausblenden'
    };
  }
  return {
    hi: (name, visits) => `${name}님, 다시 만나 반갑습니다. 지난 방문 기록 ${visits}건을 찾았습니다.`,
    apply: '이름·연락처·주소 자동 채우기',
    applied: '지난 예약 정보로 연락처가 자동 채워졌습니다.',
    dismiss: '닫기'
  };
}

function ensureContactSuggestionBox() {
  let box = document.getElementById('contactSuggestion');
  if (box) return box;
  const emailInput = els.form?.elements?.email;
  if (!emailInput) return null;
  box = document.createElement('div');
  box.id = 'contactSuggestion';
  box.setAttribute('role', 'status');
  box.style.cssText = 'margin:8px 0 12px;padding:12px 14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;font-size:13px;color:#1e3a8a;display:none;';
  const container = emailInput.closest('.form-row') || emailInput.parentElement;
  container?.parentElement?.insertBefore(box, container);
  return box;
}

function hideContactSuggestion() {
  const box = document.getElementById('contactSuggestion');
  if (box) box.style.display = 'none';
}

function applyContactSuggestion(contact) {
  if (!contact) return;
  try {
    const form = els.form?.elements;
    if (form) {
      if (contact.name && form.name && !form.name.value) form.name.value = contact.name;
      if (contact.phone && form.phone && !form.phone.value) form.phone.value = contact.phone;
      if (contact.address && form.address && !form.address.value) form.address.value = contact.address;
      ['name', 'phone', 'address'].forEach((k) => {
        try { form[k]?.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
      });
    }
    _contactLookupApplied = true;
    const c = getContactLookupCopy();
    const box = document.getElementById('contactSuggestion');
    if (box) {
      box.style.background = '#ecfdf5';
      box.style.borderColor = '#a7f3d0';
      box.style.color = '#065f46';
      box.textContent = c.applied;
      setTimeout(hideContactSuggestion, 4000);
    }
  } catch {}
}

function showContactSuggestion(contact) {
  const box = ensureContactSuggestionBox();
  if (!box) return;
  const c = getContactLookupCopy();
  const visits = Math.max(1, Number(contact.visitCount) || 1);
  const safeName = escapeHtml(contact.name || '');
  box.style.display = '';
  box.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;">
      <span>${escapeHtml(c.hi(safeName, visits))}</span>
      <span style="display:flex;gap:8px;">
        <button type="button" data-role="cl-apply" style="padding:6px 12px;background:#1d4ed8;color:#fff;border:0;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">${escapeHtml(c.apply)}</button>
        <button type="button" data-role="cl-close" style="padding:6px 10px;background:transparent;color:#1e3a8a;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;cursor:pointer;">${escapeHtml(c.dismiss)}</button>
      </span>
    </div>`;
  box.querySelector('[data-role="cl-apply"]')?.addEventListener('click', () => applyContactSuggestion(contact));
  box.querySelector('[data-role="cl-close"]')?.addEventListener('click', hideContactSuggestion);
}

async function maybeLookupContact() {
  if (_contactLookupApplied) return;
  try {
    const emailRaw = String(els.form?.elements?.email?.value || '').trim();
    const phoneRaw = String(els.form?.elements?.phone?.value || '').trim();
    const email = emailRaw && /\S+@\S+\.\S+/.test(emailRaw) ? emailRaw.toLowerCase() : '';
    const phone = phoneRaw.replace(/[\s\-()]/g, '');
    if (!email && (!phone || phone.length < 6)) return;
    const key = email + '|' + phone;
    if (key === _contactLookupLastKey) return;
    _contactLookupLastKey = key;
    const res = await lookupContact({ email, phone });
    if (res?.found) {
      showContactSuggestion(res);
    } else {
      hideContactSuggestion();
    }
  } catch {
    // Silent fail - suggestion is purely optional
  }
}

function scheduleContactLookup() {
  if (_contactLookupTimer) clearTimeout(_contactLookupTimer);
  _contactLookupTimer = setTimeout(maybeLookupContact, 500);
}

function getSelectedDuration() {
  const p = state.selectedProduct;
  if (!p) return 0;
  return Number(p.totalDur || p.duration || p.dur || 0) || 0;
}

function renderReview() {
  syncConsentVisibility();
  renderContractPriceSummary();
  if (!state.selectedProduct) {
    els.reviewBox.className = 'detail-box empty-state';
    els.reviewBox.textContent = getCopy().reviewEmpty;
    return;
  }
  const copy = getCopy();
  const rows = [[copy.reviewProduct, getProductLabel(state.selectedProduct)]];
  rows.push([copy.reviewPrice, (state.quote?.isQuoteOnly || isQuoteOnlyProduct(state.selectedProduct)) ? getQuotePriceLabel() : `€${formatEuroAmount(getEstimatedPrice())} brutto`]);
  const discountLines = getAppliedDiscountLines();
  if (discountLines.length) {
    const label = state.selectedProduct.g === 'wed'
      ? getWeddingCopy().reviewDiscounts
      : (state.lang === 'en' ? 'Applied discounts' : state.lang === 'de' ? 'Angewendete Rabatte' : '적용 할인');
    rows.push([label, discountLines.join(' / ')]);
  }
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
    const profileAge = getProfileAgeValue();
    if (profileAge) rows.push([copy.reviewProfileAge, profileAge]);
    if (state.ageGroup === 'baby') {
      const babyTypeLabel = getBabyTypeLabel(state.babyType);
      rows.push([state.lang === 'en' ? 'Session Type' : state.lang === 'de' ? 'Aufnahmetyp' : '촬영 종류', babyTypeLabel]);
    }
  }
  const studioFamily = getStudioFamilyValue();
  if (studioFamily) rows.push([copy.reviewStudioFamily, studioFamily]);
  if (state.surveyKeys.includes('baby') && !(state.selectedProduct.g === 'prof' && state.ageGroup === 'baby')) {
    rows.push([
      state.lang === 'en' ? 'Session Type' : state.lang === 'de' ? 'Aufnahmetyp' : '촬영 종류',
      getBabyTypeLabel(state.babyType) || (state.lang === 'en' ? 'Please choose 100 Days or 1st Birthday' : state.lang === 'de' ? 'Bitte 100 Tage oder 1. Geburtstag wählen' : '백일/돌 중 선택 필요')
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
  if (state.selectedProduct.g === 'biz' && getSelectedEventCategoryLabel()) {
    rows.push([state.lang === 'en' ? 'Event type' : state.lang === 'de' ? 'Event-Typ' : '행사 유형', getSelectedEventCategoryLabel()]);
  }
  if (isGenericBusinessProduct(state.selectedProduct)) {
    rows.push([copy.reviewBusinessPackage, state.quote?.businessLabel || getBusinessSelection().label]);
    rows.push([copy.bizModeLabel, BUSINESS_MODE_META.find((item) => item.key === state.businessMode)?.label[state.lang] || BUSINESS_MODE_META.find((item) => item.key === state.businessMode)?.label.ko || state.businessMode]);
    rows.push([copy.bizHoursLabel, `${state.businessHours || 2}${state.lang === 'en' ? 'h' : state.lang === 'de' ? ' Std.' : '시간'}`]);
    if (businessModeUsesVideo(state.businessMode)) {
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
  const contractOk = formData.get('contractTermsConsent') === 'on';
  const gdprOk = formData.get('gdprConsent') === 'on';
  const passCountriesOk = !isPass || hasPassportCountrySelections();
  const otherCountryOk = !isPass || !state.selectedCountries.includes('OTHER') || !!String(formData.get('otherCountry') || '').trim();
  const locationOk = !needsBookingLocation(product) || !!String(els.locationInput?.value || '').trim();
  const businessOk = !needsBusinessDetails(product) || !!String(els.businessInput?.value || '').trim();
  const babyName = String(formData.get('babyName') || '').trim();
  const babyNameOk = !needsBabyNameForBooking(product) || !!babyName;
  const reshootingOk = !needsReshootingConsent(product) || !!els.reshootingConsent?.checked;
  const businessInvoice = getBusinessInvoiceFormData(formData);
  const businessInvoiceOk = !businessInvoice.needed
    || (businessInvoice.companyName
      && businessInvoice.companyAddress
      && (!businessInvoice.invoiceEmail || /\S+@\S+\.\S+/.test(businessInvoice.invoiceEmail)));
  els.submitBtn.disabled = !(name && phone && emailOk && contractOk && gdprOk && passCountriesOk && otherCountryOk && locationOk && businessOk && babyNameOk && reshootingOk && businessInvoiceOk);
}

function clearCalendarSelection() {
  clearSubmitResult();
  state.slotRequestToken += 1;
  state.selectedDate = '';
  state.selectedSlot = '';
  state.selectedSlotMeta = null;
  state.showAllSlots = false;
  els.slotGrid.innerHTML = `<div class="empty-state">${getCopy().slotGridEmpty}</div>`;
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
  normalizeBookingContactFields();
  const formData = new FormData(els.form);
  const isPass = state.selectedProduct.g === 'pass' || state.selectedProduct.t === 'passport';
  const businessInvoice = getBusinessInvoiceFormData(formData);
  const eventCategoryLabel = state.selectedProduct.g === 'biz' ? getSelectedEventCategoryLabel() : '';
  const businessDetailsText = state.selectedProduct.g === 'biz' ? String(els.businessInput?.value || '').trim() : '';
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
    profileAge: getProfileAgeValue(),
    studioFamilyMembers: getStudioFamilyValue(),
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
    eventCategory: state.selectedProduct.g === 'biz' ? state.eventCategory : '',
    businessDetails: state.selectedProduct.g === 'biz'
      ? [eventCategoryLabel ? `[행사유형: ${eventCategoryLabel}]` : '', businessDetailsText].filter(Boolean).join('\n')
      : '',
    businessMode: isGenericBusinessProduct(state.selectedProduct) ? state.businessMode : '',
    businessHours: isGenericBusinessProduct(state.selectedProduct) ? Number(state.businessHours || 2) : '',
    businessVideoEdit: isGenericBusinessProduct(state.selectedProduct) ? state.businessVideoEdit : '',
    businessAddonKeys: isGenericBusinessProduct(state.selectedProduct) ? [...state.businessAddonKeys] : [],
    location: (state.selectedProduct.g === 'snap' || state.selectedProduct.g === 'wed' || state.selectedProduct.g === 'biz') ? String(els.locationInput?.value || '').trim() : '',
    marketing: !isPass && formData.get('marketing') === 'on',
    gdprConsent: formData.get('gdprConsent') === 'on',
    aiConsent: false,
    ...getContractSubmissionData(formData),
    businessInvoiceNeeded: businessInvoice.needed,
    businessCompanyName: businessInvoice.companyName,
    businessCompanyAddress: businessInvoice.companyAddress,
    businessVatId: businessInvoice.vatId,
    businessInvoiceEmail: businessInvoice.invoiceEmail,
    businessInvoiceRef: businessInvoice.reference,
    isReturn: !isPass && !!state.returnEligible,
    ageGroup: state.selectedProduct.g === 'prof' ? state.ageGroup : 'adult',
    babyType: getActiveBabyType(state.selectedProduct),
    bgColors: [...state.bgColors],
    passAddon: (state.selectedProduct.g === 'prof' || state.selectedProduct.g === 'stud') && !!els.passAddonToggle?.checked,
    passAddonPeople: Number(els.passAddonPeople?.value || 1),
    slotRecommendationStatus: state.selectedSlotMeta?.status || '',
    slotConfirmationMode: state.selectedSlotMeta?.confirmationMode || '',
    slotFastConfirm: state.selectedSlotMeta?.fastConfirm ? 'Y' : 'N',
    slotDistanceMin: state.selectedSlotMeta?.distanceMin || '',
    slotAnchorWindow: state.selectedSlotMeta?.anchorWindow || '',
    gutschein: (() => {
      const gs = getActiveGutschein();
      return gs ? { code: gs.code, holdToken: gs.holdToken } : null;
    })()
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
  if (requiresExplicitBabyBirthdayType(state.selectedProduct)) {
    setBanner(
      state.lang === 'en'
        ? 'Please choose whether this is a 100-day session or a 1st birthday session.'
        : state.lang === 'de'
          ? 'Bitte wählen Sie, ob es ein 100-Tage- oder 1. Geburtstags-Shooting ist.'
          : '백일 촬영인지 돌 촬영인지 선택해 주세요.',
      'error'
    );
    return;
  }
  if (state.selectedProduct.g === 'prof' && state.ageGroup === 'baby' && isBabyBirthdayType(state.babyType) && !payload.babyName) {
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
  if (needsBookingLocation(state.selectedProduct) && !payload.location) {
    setBanner(getCopy().locationRequired, 'error');
    return;
  }
  if (state.selectedProduct.g === 'biz' && !businessDetailsText) {
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
  if (!payload.contract_terms_accepted || !payload.privacy_terms_accepted) {
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
    if (state.gutschein) {
      // 제출 성공 → 서버에서 최종 확정됨. hold 해제 호출 없이 정리만.
      stopGutscheinCountdown();
      state.gutschein = null;
      renderGutscheinResult(result?.gutschein && result.gutschein.ok === false ? 'error' : 'consumed');
    }
    renderSubmitResult(payload, result);
    setBanner(getCopy().submitDone, 'success');
    els.form.reset();
    state.selectedSlot = '';
    state.selectedSlotMeta = null;
    syncConditionalFields();
    renderReview();
    renderContractPriceSummary();
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
  syncHeroIntroPanels();
}

function resetBookingFlow() {
  clearSubmitResult();
  state.activeStep = 1;
  state.selectedGroup = '';
  state.bizTrack = '';
  state.selectedProduct = null;
  state.selectedDate = '';
  state.selectedSlot = '';
  state.selectedSlotMeta = null;
  state.showAllSlots = false;
  state.selectedCountries = [];
  state.passportPersonCountries = [];
  state.optionKeys = [];
  state.surveyKeys = [];
  state.ageGroup = 'adult';
  state.babyType = 'infant';
  state.bgColors = [];
  state.businessMode = 'photo';
  state.businessHours = '2';
  state.businessVideoEdit = 'raw';
  state.businessAddonKeys = [];
  state.eventCategory = '';
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

// 독일어 성공 가이드 — 그룹별 핵심 안내 (한/영 상세 가이드의 컴팩트 독일어판)
function buildGermanSuccessGuideHtml(product) {
  const g = String(product?.g || '');
  const bullets = [];
  if (g === 'pass') {
    bullets.push('Ihre Passbilder werden direkt im Termin aufgenommen und in der Regel am selben Tag übergeben (E-Passbild-QR-Code für deutsche Dokumente, Ausdrucke je nach Land).');
    bullets.push('Bitte bringen Sie ggf. die Vorgaben Ihres Amts/Konsulats mit — wir richten uns nach den aktuellen biometrischen Anforderungen.');
    bullets.push('Bezahlung bequem vor Ort (bar oder Karte).');
  } else if (g === 'wed') {
    bullets.push('Wir melden uns mit der Bestätigungs-E-Mail und stimmen Ablauf, Orte und Outfits mit Ihnen ab.');
    bullets.push('Die Buchung wird mit der Anzahlung verbindlich — alle Details (Betrag, Bankverbindung) stehen in der Bestätigung.');
    bullets.push('Originale erhalten Sie innerhalb ca. 1 Woche, die finale Auswahl und Retusche 2–3 Wochen nach Ihrer Rückmeldung.');
  } else if (g === 'biz') {
    bullets.push('Ihre Anfrage ist eingegangen — wir prüfen Termin und Umfang und melden uns kurzfristig mit der Bestätigung bzw. einem individuellen Angebot.');
    bullets.push('Ablauf, Ort und Ergebnisse (Fotos/Video) stimmen wir vor dem Termin gemeinsam ab.');
    bullets.push('Bei Fragen antworten Sie einfach auf die Bestätigungs-E-Mail.');
  } else {
    bullets.push('Sie erhalten in Kürze unsere Bestätigungs-E-Mail mit allen Details (Adresse, Anfahrt, ggf. Anzahlung).');
    bullets.push('Outfit-Tipps und Hinweise zur Vorbereitung finden Sie ebenfalls in der Bestätigung — bei Kindern planen wir gern rund um Schlaf- und Essenszeiten.');
    bullets.push('Originale innerhalb ca. 1 Woche, finale retuschierte Bilder 2–3 Wochen nach Ihrer Auswahl.');
  }
  if (PRINT_INFO_GROUPS.has(g)) {
    bullets.push('Abzüge: Zusätzlich zu den enthaltenen Abzügen können Sie im Auswahlschritt weitere Größen bestellen (10×15cm, A4, A3, A3+ …) — Preise pro Abzug sehen Sie auf der Buchungsseite unter „Abzüge – Größen & Preise". Zustellung per Abholung im Studio oder per Post.');
  }
  bullets.push('Änderungen oder Fragen? Antworten Sie einfach auf unsere E-Mail oder schreiben Sie an studio.mean.de@gmail.com.');
  return `
    <section class="result-guide-box">
      <h4 class="result-guide-title">✅ Nächste Schritte</h4>
      <div class="result-guide-body"><ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul></div>
    </section>
  `;
}

const PARTNER_CTA_COPY = {
  kakao: { ko: '카카오톡으로 바로 상담', en: 'Chat on KakaoTalk', de: 'Per KakaoTalk anfragen' },
  instagram: { ko: '인스타그램으로 문의', en: 'Message on Instagram', de: 'Per Instagram anfragen' },
  whatsapp: { ko: 'WhatsApp으로 문의', en: 'Message on WhatsApp', de: 'Per WhatsApp anfragen' },
  email: { ko: '메일로 문의', en: 'Send an email', de: 'Per E-Mail anfragen' },
  phone: { ko: '전화로 문의', en: 'Call', de: 'Anrufen' },
  web: { ko: '바로 상담하기', en: 'Get in touch', de: 'Kontakt aufnehmen' }
};
const PARTNER_BLOCK_COPY = {
  title: { ko: '함께 준비하시면 좋은 곳', en: 'Recommended partners', de: 'Empfohlene Partner' },
  note: {
    ko: 'Studio mean은 소개만 드리며 각 업체의 예약·결제에는 관여하지 않습니다.',
    en: 'Studio mean only makes the introduction and is not involved in each partner’s booking or payment.',
    de: 'Studio mean vermittelt lediglich den Kontakt und ist an Buchung oder Zahlung der Partner nicht beteiligt.'
  }
};

/* 협력업체 노출 조건 — 서버 buildPartnerMailBlockHtml_ 과 같은 규칙을 쓴다.
   'baby' 토큰은 백일·돌, 나머지는 itemGroup 또는 상품 id 매칭. */
function getPartnersForSuccess(payload) {
  const partners = Array.isArray(state.init?.partners) ? state.init.partners : [];
  const product = state.selectedProduct;
  if (!partners.length || !product) return [];
  const group = String(product.g || '').toLowerCase();
  const productId = String(product.id || '').toLowerCase();
  /* 상품명 텍스트도 본다 — 서버(partnerContextFrom_)와 같은 규칙. 돌잔치/가족파티(dolp)처럼
     설문 없이 상품 자체가 돌·백일인 경우를 성공화면과 메일이 똑같이 잡게 하기 위함. */
  const productText = [product.nameKo, product.nameEn, product.nameDe, product.id].filter(Boolean).join(' ');
  const isBaby = !!(
    payload.surveyKeys?.includes('baby') ||
    payload.babyType === 'baekil' ||
    payload.babyType === 'dol' ||
    /돌\s*촬영|돌상|돌잔치|백일|1st\s*Birthday|1\.\s*Geburtstag|100.?day/i.test(productText)
  );
  return partners.filter((p) => {
    const placements = Array.isArray(p.placements) ? p.placements : [];
    if (placements.length && !placements.includes('success')) return false;
    const groups = Array.isArray(p.groups) ? p.groups : [];
    return groups.some((t) => (t === 'baby' ? isBaby : t === group || (!!productId && t === productId)));
  });
}

function buildPartnerSectionHtml(payload) {
  const list = getPartnersForSuccess(payload);
  if (!list.length) return '';
  const lang = state.lang === 'en' || state.lang === 'de' ? state.lang : 'ko';
  const rows = list.map((p) => {
    const desc = (lang === 'en' ? p.descEn : lang === 'de' ? p.descDe : p.descKo) || p.descKo || '';
    const meta = [p.langs ? (lang === 'ko' ? `상담 ${p.langs}` : p.langs) : '', p.area].filter(Boolean).join(' · ');
    const cta = (PARTNER_CTA_COPY[p.linkKind] || PARTNER_CTA_COPY.web)[lang];
    return `
      <div class="partner-item">
        <div class="partner-name">${escapeHtml(p.name)}${meta ? `<span class="partner-meta">${escapeHtml(meta)}</span>` : ''}</div>
        ${desc ? `<div class="partner-desc">${escapeHtml(desc)}</div>` : ''}
        <a class="partner-cta" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" data-partner-id="${escapeHtml(p.id)}">${escapeHtml(cta)} →</a>
      </div>
    `;
  }).join('');
  return `
    <section class="result-guide-box">
      <h4 class="result-guide-title">${PARTNER_BLOCK_COPY.title[lang]}</h4>
      <div class="result-guide-body">
        ${rows}
        <p class="partner-note">${PARTNER_BLOCK_COPY.note[lang]}</p>
      </div>
    </section>
  `;
}

/* 클릭 집계는 위임으로 한 번만 건다. 링크는 target=_blank 로 바로 열리고, 핑은 뒤따라간다 —
   기다리지 않으므로 체감 지연이 없다. */
document.addEventListener('click', (event) => {
  const link = event.target?.closest?.('a.partner-cta[data-partner-id]');
  if (!link) return;
  pingPartnerClick({
    partnerId: link.getAttribute('data-partner-id'),
    source: 'web',
    lang: state.lang || '',
    itemGroup: state.selectedProduct?.g || ''
  });
});

function getSuccessGuideHtml(payload) {
  if (state.lang === 'de') return buildGermanSuccessGuideHtml(state.selectedProduct) + buildPartnerSectionHtml(payload);
  const product = state.selectedProduct;
  if (!product) return '';
  const isKo = state.lang === 'ko';
  const hasBabyBirthday = payload.surveyKeys?.includes('baby') || payload.babyType === 'baekil' || payload.babyType === 'dol';
  const sections = [];

  if (product.g === 'pass') {
    sections.push(`
      <section class="result-guide-box">
        <h4 class="result-guide-title">${isKo ? (hasBabyBirthday ? '영유아 여권 / 비자사진 촬영 조건 안내' : '[예약 안내] 한국 여권 & 독일 비자(E-passbild) 촬영') : 'Passport / Visa Shoot Guide'}</h4>
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
            <h5>[필독] 눈썹 노출 및 반려 주의</h5>
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
    const business = isGenericBusinessProduct(product) ? (state.quote || getBusinessSelection()) : null;
    sections.push(`
      <section class="result-guide-box">
        <h4 class="result-guide-title">${isKo ? '📸 행사/이벤트 촬영 안내' : 'Event Booking Guide'}</h4>
        <div class="result-guide-body">
          ${business ? (isKo ? `
            <p><b>${escapeHtml(business.businessLabel || business.label || '')}</b> 기준으로 예약이 접수되었습니다.</p>
            <h5>선택 내용</h5>
            <ul>
              <li>촬영 유형: ${escapeHtml(BUSINESS_MODE_META.find((item) => item.key === state.businessMode)?.label.ko || state.businessMode)}</li>
              <li>촬영 시간: ${escapeHtml(String(state.businessHours || 2))}시간</li>
              ${businessModeUsesVideo(state.businessMode) ? `<li>편집 옵션: ${escapeHtml((BUSINESS_VIDEO_EDIT_META.find((item) => item.key === state.businessVideoEdit)?.label.ko) || state.businessVideoEdit)}</li>` : ''}
              ${state.businessAddonKeys.length ? `<li>추가 요청: ${escapeHtml(state.businessAddonKeys.map((key) => BUSINESS_ADDON_META.find((item) => item.key === key)?.label.ko || key).join(', '))}</li>` : ''}
            </ul>
            <h5>제공 방식</h5>
            <ul>
              <li>최종 금액은 행사 목적, 진행 시간, 장소, 예상 인원, 납품 범위를 확인한 뒤 안내드립니다.</li>
              <li>사진은 원본/JPG 및 기본 색보정 범위를, 영상은 촬영/편집 범위를 확정 메일에서 정리합니다.</li>
              <li>SNS 숏폼, 긴급 납품, 자막/로고/BGM 요청은 일정과 사용 목적에 따라 개별 검토 후 안내드립니다.</li>
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
              <li>${state.businessMode === 'video' ? 'Video production' : state.businessMode === 'hybrid' ? 'Photo + video coverage' : 'Event photography'} · ${escapeHtml(String(state.businessHours || 2))}${isKo ? '시간' : ' hours'}</li>
              <li>We will review the event purpose, timeline, location, guest count, deliverables, and any optional requests before sending the final quote.</li>
              <li>SNS short-form, rush delivery, and branding requests are confirmed after schedule and usage review.</li>
              <li>We may contact you again to coordinate timing, location flow, and delivery expectations.</li>
            </ul>
          `) : (isKo ? `
            <p><b>${escapeHtml(getProductLabel(product))}</b> 상품으로 예약이 접수되었습니다.</p>
            <ul>
              <li>사진과 영상은 택1 기준으로 진행됩니다.</li>
              <li>장소, 진행 시간, 피로연/파티 포함 여부를 확인한 뒤 최종 안내드립니다.</li>
              <li>상담 견적 상품은 세부 확인 후 이메일로 금액을 안내드립니다.</li>
            </ul>
          ` : `
            <p><b>${escapeHtml(getProductLabel(product))}</b> has been requested.</p>
            <ul>
              <li>Photo and video are offered as separate choices.</li>
              <li>We will confirm the location, schedule, and reception/party coverage after review.</li>
              <li>For custom quote packages, pricing will be sent by email after consultation.</li>
            </ul>
          `)}
        </div>
      </section>
    `);
  }

  // 무료 돌상은 프로필 프로페셔널(€130)부터 — 스튜디오/스냅은 전 상품 해당, 프로필은 pp만
  const dolTableFree = product.g !== 'prof' || product.id === 'pp';
  if (hasBabyBirthday && (product.g === 'stud' || product.g === 'snap' || product.g === 'prof')) {
    sections.push(`
      <section class="result-guide-box">
        <h4 class="result-guide-title">${isKo ? (dolTableFree ? '🎂 돌상/백일상 무료 셋팅 안내' : '🎂 돌상/백일상 셋팅 안내') : 'Dol / 100-Day Table Setup'}</h4>
        <div class="result-guide-body">
          ${isKo ? `
            <p>${dolTableFree ? '돌상/백일상은 기본 구성으로 무료 셋팅해 드립니다.' : '무료 돌상/백일상 셋팅은 <b>프로필 프로페셔널(€130) 이상</b> 상품부터 제공됩니다. 현재 선택하신 상품에는 포함되지 않으니, 돌상/백일상을 원하시면 프로페셔널 이상으로 예약해 주세요.'} 기본 셋팅은 촬영용 연출 목적이며 음식 제공이나 식사 형태의 돌잔치는 포함되지 않습니다.</p>
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
            <p>${dolTableFree ? 'A simple dol / 100-day table setup is included for free.' : 'The free dol / 100-day table setup is included from <b>Profile Professional (€130)</b> and up — it is not part of your current package, so please book Professional or higher if you would like it.'} Please share reference images in advance if you have a specific theme in mind.</p>
          `}
        </div>
      </section>
    `);
  }

  if (PRINT_INFO_GROUPS.has(product.g)) {
    sections.push(`
      <section class="result-guide-box">
        <h4 class="result-guide-title">${isKo ? '📷 사진 · 인화 진행 안내' : '📷 Photos & Prints — what happens next'}</h4>
        <div class="result-guide-body">
          ${isKo ? `
            <p>촬영 이후는 이렇게 진행됩니다:</p>
            <ul>
              <li><b>사진 선택(셀렉)</b> — 촬영본 링크를 보내드리면 보정 받으실 사진을 고르세요.</li>
              <li><b>보정본 전달</b> — 선택하신 사진을 보정해 전달드립니다.</li>
              <li><b>인화</b> — 기본 포함분 외 추가 인화는 셀렉 때 사이즈(10×15cm · A4 · A3 · A3+ 등)와 수량을 정하시면 됩니다. 추가 단가는 예약 화면의 <b>인화 안내</b>에서 미리 확인하실 수 있어요.</li>
              <li><b>수령</b> — 스튜디오 픽업 또는 우편 중 선택. 인화가 완료되면 예약/발송 안내 링크를 보내드려요.</li>
            </ul>
          ` : `
            <p>After the shoot, the flow is:</p>
            <ul>
              <li><b>Photo selection</b> — we send your gallery link; pick the photos to retouch.</li>
              <li><b>Retouched finals</b> — we retouch your chosen photos and deliver them.</li>
              <li><b>Prints</b> — beyond the included prints, order extras at the selection step (10×15cm, A4, A3, A3+ …). Per-print prices are shown on the booking screen under <b>Print sizes &amp; prices</b>.</li>
              <li><b>Delivery</b> — studio pickup or post; we email a link once printing is finished.</li>
            </ul>
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

  const partnerHtml = buildPartnerSectionHtml(payload);
  if (partnerHtml) sections.push(partnerHtml);

  return `<div class="result-guide-stack">${sections.join('')}</div>`;
}

function renderSubmitResult(payload, result) {
  const copy = getCopy();
  const totalPrice = result?.quote?.totalPrice ?? getEstimatedPrice();
  const quoteOnly = !!result?.quote?.isQuoteOnly || !!state.quote?.isQuoteOnly || isQuoteOnlyProduct(state.selectedProduct);
  const returnNote = result?.isReturn ? `<div class="result-note">${escapeHtml(copy.submitCardReturn)}</div>` : '';
  const successGuideHtml = getSuccessGuideHtml(payload);
  els.hero?.classList.add('hidden-step');
  Object.values(els.stepPanels).forEach((panel) => panel?.classList.add('hidden-step'));
  els.successPanel?.classList.remove('hidden-step');
  syncHeroIntroPanels();
  els.resultBox.hidden = false;
  const travelNote = (['snap','wed','biz'].includes(String(state.selectedProduct?.g||'')) && String(els.locationInput?.value||'').trim())
    ? `<div class="result-note">${escapeHtml(state.lang==='en'
        ? 'On-location shoot: any travel fee (free within 30 km of the studio) is confirmed together with your booking confirmation.'
        : state.lang==='de'
          ? 'Vor-Ort-Termin: eine etwaige Anfahrtspauschale (bis 30 km ab Studio kostenlos) bestätigen wir mit der Buchungsbestätigung.'
          : '출장 촬영은 확정 메일에서 출장비(스튜디오 기준 30km 무료, 이후 존별)와 함께 최종 안내드립니다.')}</div>`
    : '';
  els.resultBox.innerHTML = `
    <div class="result-check" aria-hidden="true">✓</div>
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
        <span>${quoteOnly ? escapeHtml(getQuotePriceLabel()) : escapeHtml(`€${formatEuroAmount(totalPrice)} brutto`)}</span>
      </div>
    </div>
    ${returnNote}
    ${travelNote}
    <div class="result-note">${escapeHtml(copy.submitCardNote)}</div>
    ${successGuideHtml}
    <div class="result-actions">
      <button type="button" id="resultResetBtn" class="result-action-btn">${escapeHtml(copy.submitCardAction)}</button>
    </div>
  `;
  document.getElementById('resultResetBtn')?.addEventListener('click', resetBookingFlow);
}

/* 모듈 최상위 const 가 전부 초기화된 뒤에 부팅한다 — 위쪽에서 부르면 캐시 분기의 동기 렌더가
   아래 선언 const 들의 TDZ 를 밟는다(위 boot() 주석 참조). 함수 선언은 호이스팅되므로 안전. */
boot();
