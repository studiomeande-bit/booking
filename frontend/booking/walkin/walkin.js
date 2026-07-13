import { fetchWalkinToken, submitWalkinIntake } from '../../shared/api-booking.js';

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
    detailPanelTitle: '예약 내용',
    detailPanelCopy: '선택한 촬영에 필요한 항목만 골라 주세요.',
    detailLabel: '예약 내용 / 상품명',
    detailPlaceholder: '예약 내용을 선택해 주세요.',
    preferredScheduleLabel: '희망 일정 / 시간',
    preferredSchedulePlaceholder: '희망 일정을 선택해 주세요.',
    passCountriesLabel: '필요 국가',
    passPurposeLabel: '사용 용도',
    passPeopleLabel: '촬영 인원',
    passPeoplePlaceholder: '인원을 선택해 주세요.',
    shootingLocationLabel: '촬영 / 행사 장소',
    shootingLocationPlaceholder: '장소를 선택해 주세요.',
    eventCompanyLabel: '주최 유형',
    eventCompanyPlaceholder: '주최 유형을 선택해 주세요.',
    eventDetailsLabel: '행사 구성',
    eventDetailsPlaceholder: '행사 구성을 선택해 주세요.',
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
    consentError: '필수 동의 항목을 체크해 주세요.',
    detailError: '예약 내용을 선택해 주세요.',
    passDetailError: '여권/비자는 필요 국가와 사용 용도를 선택해 주세요.',
    locationError: '촬영 또는 행사 장소를 선택해 주세요.',
    securityError: '보안 확인이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.'
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
    detailPanelTitle: 'Booking Details',
    detailPanelCopy: 'Only the fields needed for the selected service are shown.',
    detailLabel: 'Request / product',
    detailPlaceholder: 'Select a request',
    preferredScheduleLabel: 'Preferred date / time',
    preferredSchedulePlaceholder: 'Select a preferred time',
    passCountriesLabel: 'Required country',
    passPurposeLabel: 'Purpose',
    passPeopleLabel: 'Number of people',
    passPeoplePlaceholder: 'Select people',
    shootingLocationLabel: 'Shooting / event location',
    shootingLocationPlaceholder: 'Select a location',
    eventCompanyLabel: 'Host type',
    eventCompanyPlaceholder: 'Select a host type',
    eventDetailsLabel: 'Event scope',
    eventDetailsPlaceholder: 'Select event scope',
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
    consentError: 'Please check the required consent items.',
    detailError: 'Please select the booking details.',
    passDetailError: 'For passport / visa, please select the country and purpose.',
    locationError: 'Please select the shooting or event location.',
    securityError: 'Security check is not ready yet. Please try again shortly.'
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
    detailPanelTitle: 'Buchungsdetails',
    detailPanelCopy: 'Es werden nur die passenden Felder für die gewählte Leistung angezeigt.',
    detailLabel: 'Wunsch / Produkt',
    detailPlaceholder: 'Wunsch auswählen',
    preferredScheduleLabel: 'Wunschtermin / Uhrzeit',
    preferredSchedulePlaceholder: 'Wunschtermin auswählen',
    passCountriesLabel: 'Benötigtes Land',
    passPurposeLabel: 'Verwendungszweck',
    passPeopleLabel: 'Personenanzahl',
    passPeoplePlaceholder: 'Personenanzahl auswählen',
    shootingLocationLabel: 'Shooting- / Eventort',
    shootingLocationPlaceholder: 'Ort auswählen',
    eventCompanyLabel: 'Veranstaltertyp',
    eventCompanyPlaceholder: 'Veranstaltertyp auswählen',
    eventDetailsLabel: 'Eventumfang',
    eventDetailsPlaceholder: 'Eventumfang auswählen',
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
    consentError: 'Bitte bestätigen Sie die Pflichtangaben.',
    detailError: 'Bitte wählen Sie die Buchungsdetails aus.',
    passDetailError: 'Für Pass / Visum bitte Land und Verwendungszweck auswählen.',
    locationError: 'Bitte wählen Sie den Shooting- oder Eventort aus.',
    securityError: 'Die Sicherheitsprüfung ist noch nicht bereit. Bitte versuchen Sie es gleich erneut.'
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

const SERVICE_FIELD_MAP = {
  pass: ['passCountries', 'passPurpose', 'passPeople'],
  prof: ['serviceDetail', 'preferredSchedule'],
  stud: ['serviceDetail', 'preferredSchedule'],
  snap: ['serviceDetail', 'preferredSchedule', 'shootingLocation'],
  wed: ['serviceDetail', 'preferredSchedule', 'shootingLocation'],
  biz: ['serviceDetail', 'preferredSchedule', 'shootingLocation', 'eventCompany', 'eventDetails'],
  other: ['serviceDetail', 'preferredSchedule']
};

const SERVICE_DETAIL_COPY = {
  ko: {
    pass: ['여권 / 비자 정보', '필요 국가와 사용 용도를 선택해 주세요.'],
    prof: ['프로필 촬영 정보', '원하는 촬영 내용과 희망 시간을 선택해 주세요.'],
    stud: ['스튜디오 촬영 정보', '기본 상품과 희망 시간을 선택해 주세요.'],
    snap: ['야외 스냅 정보', '희망 장소와 시간을 선택해 주세요.'],
    wed: ['프리웨딩 정보', '촬영 장소와 희망 일정을 선택해 주세요.'],
    biz: ['기업 / 행사 정보', '행사 장소와 진행 구성을 선택해 주세요.'],
    other: ['예약 내용', '가까운 항목을 선택해 주세요.']
  },
  en: {
    pass: ['Passport / visa details', 'Select the country and purpose.'],
    prof: ['Profile details', 'Select the request and preferred time.'],
    stud: ['Studio details', 'Select the request and preferred time.'],
    snap: ['Outdoor details', 'Select the location and preferred time.'],
    wed: ['Pre-wedding details', 'Select the location and preferred date.'],
    biz: ['Corporate / event details', 'Select the venue and event scope.'],
    other: ['Booking details', 'Select the closest option.']
  },
  de: {
    pass: ['Pass / Visum Details', 'Bitte Land und Zweck auswählen.'],
    prof: ['Profil Details', 'Bitte Wunsch und Termin auswählen.'],
    stud: ['Studio Details', 'Bitte Wunsch und Termin auswählen.'],
    snap: ['Outdoor Details', 'Bitte Ort und Termin auswählen.'],
    wed: ['Pre-Wedding Details', 'Bitte Ort und Termin auswählen.'],
    biz: ['Firma / Event Details', 'Bitte Ort und Eventumfang auswählen.'],
    other: ['Buchungsdetails', 'Bitte die passende Option auswählen.']
  }
};

const DETAIL_OPTIONS = {
  prof: [
    { value: 'profile_basic', label: { ko: '프로필 베이직', en: 'Profile basic', de: 'Profil Basic' } },
    { value: 'profile_business', label: { ko: '비즈니스 / 링크드인', en: 'Business / LinkedIn', de: 'Business / LinkedIn' } },
    { value: 'profile_actor', label: { ko: '배우 / 아티스트 프로필', en: 'Actor / artist profile', de: 'Schauspiel / Artist Profil' } },
    { value: 'profile_consult', label: { ko: '상담 후 결정', en: 'Decide after guidance', de: 'Nach Beratung entscheiden' } }
  ],
  stud: [
    { value: 'studio_family', label: { ko: '가족사진', en: 'Family studio', de: 'Familienfoto' } },
    { value: 'studio_baby_100', label: { ko: '백일 촬영', en: '100 days baby', de: '100 Tage Baby' } },
    { value: 'studio_baby_first', label: { ko: '돌 촬영', en: 'First birthday', de: '1. Geburtstag' } },
    { value: 'studio_couple', label: { ko: '커플 / 개인 촬영', en: 'Couple / individual', de: 'Paar / Einzel' } },
    { value: 'studio_consult', label: { ko: '상담 후 결정', en: 'Decide after guidance', de: 'Nach Beratung entscheiden' } }
  ],
  snap: [
    { value: 'snap_1h', label: { ko: '야외 스냅 1시간', en: 'Outdoor 1 hour', de: 'Outdoor 1 Stunde' } },
    { value: 'snap_2h', label: { ko: '야외 스냅 2시간', en: 'Outdoor 2 hours', de: 'Outdoor 2 Stunden' } },
    { value: 'snap_home', label: { ko: '홈스냅', en: 'Home session', de: 'Home Shooting' } },
    { value: 'snap_consult', label: { ko: '상담 후 결정', en: 'Decide after guidance', de: 'Nach Beratung entscheiden' } }
  ],
  wed: [
    { value: 'wed_standesamt', label: { ko: 'Standesamt / 시민 결혼식', en: 'Standesamt / civil wedding', de: 'Standesamt / Trauung' } },
    { value: 'wed_pre', label: { ko: '프리웨딩', en: 'Pre-wedding', de: 'Pre-Wedding' } },
    { value: 'wed_day', label: { ko: '본식 스냅', en: 'Wedding day coverage', de: 'Hochzeitstag Begleitung' } },
    { value: 'wed_consult', label: { ko: '상담 후 결정', en: 'Decide after guidance', de: 'Nach Beratung entscheiden' } }
  ],
  biz: [
    { value: 'biz_photo', label: { ko: '행사 사진', en: 'Event photography', de: 'Eventfotografie' } },
    { value: 'biz_video', label: { ko: '행사 영상', en: 'Event video', de: 'Eventvideo' } },
    { value: 'biz_photo_video', label: { ko: '사진 + 영상', en: 'Photo + video', de: 'Foto + Video' } },
    { value: 'biz_team_profile', label: { ko: '단체 프로필', en: 'Team profile', de: 'Teamprofil' } },
    { value: 'biz_consult', label: { ko: '상담 후 결정', en: 'Decide after guidance', de: 'Nach Beratung entscheiden' } }
  ],
  other: [
    { value: 'other_consult', label: { ko: '상담 필요', en: 'Guidance needed', de: 'Beratung nötig' } },
    { value: 'other_undecided', label: { ko: '상품 미정', en: 'Product undecided', de: 'Produkt unklar' } },
    { value: 'other_custom', label: { ko: '기타 촬영', en: 'Other shooting', de: 'Anderes Shooting' } }
  ]
};

const SCHEDULE_OPTIONS = [
  { value: 'today_asap', label: { ko: '오늘 가능하면 바로', en: 'Today if possible', de: 'Heute wenn möglich' } },
  { value: 'today_morning', label: { ko: '오늘 오전', en: 'Today morning', de: 'Heute Vormittag' } },
  { value: 'today_afternoon', label: { ko: '오늘 오후', en: 'Today afternoon', de: 'Heute Nachmittag' } },
  { value: 'this_week', label: { ko: '이번 주', en: 'This week', de: 'Diese Woche' } },
  { value: 'next_week', label: { ko: '다음 주', en: 'Next week', de: 'Nächste Woche' } },
  { value: 'studio_guidance', label: { ko: '스튜디오 안내 필요', en: 'Need studio guidance', de: 'Beratung durch Studio' } }
];

const PASS_COUNTRY_OPTIONS = [
  { value: 'de', label: { ko: '독일', en: 'Germany', de: 'Deutschland' } },
  { value: 'us', label: { ko: '미국', en: 'USA', de: 'USA' } },
  { value: 'kr', label: { ko: '한국', en: 'Korea', de: 'Korea' } },
  { value: 'eu', label: { ko: 'EU / 쉥겐', en: 'EU / Schengen', de: 'EU / Schengen' } },
  { value: 'other_multi', label: { ko: '기타 / 복수 국가', en: 'Other / multiple', de: 'Andere / mehrere' } }
];

const PASS_PURPOSE_OPTIONS = [
  { value: 'passport', label: { ko: '여권', en: 'Passport', de: 'Pass' } },
  { value: 'visa', label: { ko: '비자', en: 'Visa', de: 'Visum' } },
  { value: 'resident', label: { ko: '체류증 / Aufenthaltstitel', en: 'Residence permit', de: 'Aufenthaltstitel' } },
  { value: 'application', label: { ko: '지원 / Bewerbungsfoto', en: 'Application photo', de: 'Bewerbungsfoto' } },
  { value: 'document', label: { ko: '기타 증명사진', en: 'Other ID photo', de: 'Anderes Ausweisfoto' } }
];

const PASS_PEOPLE_OPTIONS = [
  { value: '1', label: { ko: '1명', en: '1 person', de: '1 Person' } },
  { value: '2', label: { ko: '2명', en: '2 people', de: '2 Personen' } },
  { value: '3', label: { ko: '3명', en: '3 people', de: '3 Personen' } },
  { value: '4', label: { ko: '4명', en: '4 people', de: '4 Personen' } },
  { value: '5plus', label: { ko: '5명 이상', en: '5+ people', de: 'Ab 5 Personen' } }
];

const LOCATION_OPTIONS = [
  { value: 'studio_mean', label: { ko: 'Studio mean', en: 'Studio mean', de: 'Studio mean' } },
  { value: 'frankfurt', label: { ko: 'Frankfurt', en: 'Frankfurt', de: 'Frankfurt' } },
  { value: 'oberursel_bad_homburg', label: { ko: 'Oberursel / Bad Homburg', en: 'Oberursel / Bad Homburg', de: 'Oberursel / Bad Homburg' } },
  { value: 'customer_location', label: { ko: '고객 지정 장소', en: 'Customer location', de: 'Ort des Kunden' } },
  { value: 'undecided', label: { ko: '장소 미정', en: 'Location undecided', de: 'Ort noch offen' } }
];

const EVENT_COMPANY_OPTIONS = [
  { value: 'company', label: { ko: '회사 / 기업', en: 'Company', de: 'Firma' } },
  { value: 'agency', label: { ko: '에이전시 / 기관', en: 'Agency / organization', de: 'Agentur / Organisation' } },
  { value: 'private_event', label: { ko: '개인 행사', en: 'Private event', de: 'Private Veranstaltung' } },
  { value: 'brand_project', label: { ko: '브랜드 / 프로젝트', en: 'Brand / project', de: 'Brand / Projekt' } },
  { value: 'undecided', label: { ko: '미정', en: 'Undecided', de: 'Noch offen' } }
];

const EVENT_DETAILS_OPTIONS = [
  { value: 'photo_only', label: { ko: '사진만', en: 'Photo only', de: 'Nur Foto' } },
  { value: 'video_only', label: { ko: '영상만', en: 'Video only', de: 'Nur Video' } },
  { value: 'photo_video', label: { ko: '사진 + 영상', en: 'Photo + video', de: 'Foto + Video' } },
  { value: 'short_event', label: { ko: '짧은 행사 / 2시간 내외', en: 'Short event / around 2 hours', de: 'Kurzes Event / ca. 2 Stunden' } },
  { value: 'full_event', label: { ko: '반나절 이상', en: 'Half day or longer', de: 'Halbtags oder länger' } },
  { value: 'quote_needed', label: { ko: '견적 상담 필요', en: 'Quote guidance needed', de: 'Angebot nach Beratung' } }
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
  formToken: document.getElementById('formToken'),
  formStartedAt: document.getElementById('formStartedAt'),
  serviceDetailPanel: document.getElementById('serviceDetailPanel'),
  serviceDetailTitle: document.getElementById('serviceDetailTitle'),
  serviceDetailCopy: document.getElementById('serviceDetailCopy'),
  serviceDetail: document.getElementById('serviceDetail'),
  preferredSchedule: document.getElementById('preferredSchedule'),
  passCountries: document.getElementById('passCountries'),
  passCountriesGrid: document.getElementById('passCountriesGrid'),
  passPurpose: document.getElementById('passPurpose'),
  passPurposeGrid: document.getElementById('passPurposeGrid'),
  passPeople: document.getElementById('passPeople'),
  shootingLocation: document.getElementById('shootingLocation'),
  eventCompany: document.getElementById('eventCompany'),
  eventDetails: document.getElementById('eventDetails'),
  babyNameField: document.getElementById('babyNameField'),
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
  serviceDetailLabel: document.getElementById('serviceDetailLabel'),
  preferredScheduleLabel: document.getElementById('preferredScheduleLabel'),
  passCountriesLabel: document.getElementById('passCountriesLabel'),
  passPurposeLabel: document.getElementById('passPurposeLabel'),
  passPeopleLabel: document.getElementById('passPeopleLabel'),
  shootingLocationLabel: document.getElementById('shootingLocationLabel'),
  eventCompanyLabel: document.getElementById('eventCompanyLabel'),
  eventDetailsLabel: document.getElementById('eventDetailsLabel'),
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
  serviceGroup: normalizeServiceParam(new URLSearchParams(window.location.search).get('service')) || '',
  formToken: '',
  formStartedAt: Date.now()
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

function getOptionLabel(option, lang = state.lang) {
  return option?.label?.[lang] || option?.label?.ko || String(option?.value || '');
}

function findOption(options, value) {
  return (options || []).find((option) => String(option.value) === String(value));
}

function getFieldOptions(field, serviceGroup = state.serviceGroup) {
  if (field === 'serviceDetail') return DETAIL_OPTIONS[serviceGroup] || [];
  if (field === 'preferredSchedule') return SCHEDULE_OPTIONS;
  if (field === 'passCountries') return PASS_COUNTRY_OPTIONS;
  if (field === 'passPurpose') return PASS_PURPOSE_OPTIONS;
  if (field === 'passPeople') return PASS_PEOPLE_OPTIONS;
  if (field === 'shootingLocation') return LOCATION_OPTIONS;
  if (field === 'eventCompany') return EVENT_COMPANY_OPTIONS;
  if (field === 'eventDetails') return EVENT_DETAILS_OPTIONS;
  return [];
}

function getSelectedOptionLabel(field, value, serviceGroup = state.serviceGroup) {
  const option = findOption(getFieldOptions(field, serviceGroup), value);
  return option ? getOptionLabel(option) : String(value || '').trim();
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

function setFieldText(labelEl, inputEl, label, placeholder) {
  if (labelEl) labelEl.textContent = label;
  if (inputEl) inputEl.placeholder = placeholder || '';
}

function renderSelectControl(selectEl, options, placeholder) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = [`<option value="">${escapeHtml(placeholder)}</option>`]
    .concat(options.map((option) => (
      `<option value="${escapeHtml(option.value)}"${String(option.value) === current ? ' selected' : ''}>${escapeHtml(getOptionLabel(option))}</option>`
    )))
    .join('');
  if (current && !options.some((option) => String(option.value) === current)) {
    selectEl.value = '';
  }
}

function renderChoiceButtons(gridEl, inputEl, options) {
  if (!gridEl || !inputEl) return;
  const current = inputEl.value;
  gridEl.innerHTML = options.map((option) => {
    const selected = String(option.value) === current ? ' selected' : '';
    return `<button type="button" class="choice-btn${selected}" data-value="${escapeHtml(option.value)}">${escapeHtml(getOptionLabel(option))}</button>`;
  }).join('');
  gridEl.querySelectorAll('.choice-btn').forEach((button) => {
    button.addEventListener('click', () => {
      inputEl.value = button.dataset.value || '';
      renderChoiceButtons(gridEl, inputEl, options);
    });
  });
}

function renderDetailControls() {
  const copy = getCopy();
  const serviceGroup = state.serviceGroup || elements.serviceGroup.value || '';
  renderSelectControl(elements.serviceDetail, getFieldOptions('serviceDetail', serviceGroup), copy.detailPlaceholder);
  renderSelectControl(elements.preferredSchedule, getFieldOptions('preferredSchedule', serviceGroup), copy.preferredSchedulePlaceholder);
  renderSelectControl(elements.passPeople, getFieldOptions('passPeople', serviceGroup), copy.passPeoplePlaceholder);
  renderSelectControl(elements.shootingLocation, getFieldOptions('shootingLocation', serviceGroup), copy.shootingLocationPlaceholder);
  renderSelectControl(elements.eventCompany, getFieldOptions('eventCompany', serviceGroup), copy.eventCompanyPlaceholder);
  renderSelectControl(elements.eventDetails, getFieldOptions('eventDetails', serviceGroup), copy.eventDetailsPlaceholder);
  renderChoiceButtons(elements.passCountriesGrid, elements.passCountries, getFieldOptions('passCountries', serviceGroup));
  renderChoiceButtons(elements.passPurposeGrid, elements.passPurpose, getFieldOptions('passPurpose', serviceGroup));
}

function getVisibleDetailFields(serviceGroup) {
  return new Set(SERVICE_FIELD_MAP[serviceGroup] || []);
}

function clearHiddenDetailFields(visibleFields) {
  ['serviceDetail', 'preferredSchedule', 'passCountries', 'passPurpose', 'passPeople', 'shootingLocation', 'eventCompany', 'eventDetails'].forEach((key) => {
    if (!visibleFields.has(key) && elements[key]) elements[key].value = '';
  });
  if (state.serviceGroup !== 'stud' && elements.babyNameField) {
    const babyInput = document.getElementById('babyName');
    if (babyInput) babyInput.value = '';
  }
}

function clearAllDetailFields() {
  ['serviceDetail', 'preferredSchedule', 'passCountries', 'passPurpose', 'passPeople', 'shootingLocation', 'eventCompany', 'eventDetails'].forEach((key) => {
    if (elements[key]) elements[key].value = '';
  });
  const babyInput = document.getElementById('babyName');
  if (babyInput) babyInput.value = '';
}

function renderServiceDetailPanel({ clearHidden = false } = {}) {
  const copy = getCopy();
  const serviceGroup = state.serviceGroup || elements.serviceGroup.value || '';
  const visibleFields = getVisibleDetailFields(serviceGroup);
  const hasService = !!serviceGroup;
  const detailCopy = (SERVICE_DETAIL_COPY[state.lang] || SERVICE_DETAIL_COPY.ko)[serviceGroup] || [copy.detailPanelTitle, copy.detailPanelCopy];

  elements.serviceDetailPanel.classList.toggle('hidden-field', !hasService);
  elements.serviceDetailTitle.textContent = detailCopy[0];
  elements.serviceDetailCopy.textContent = detailCopy[1];
  document.querySelectorAll('[data-detail-field]').forEach((field) => {
    field.classList.toggle('hidden-field', !visibleFields.has(field.dataset.detailField));
  });
  if (elements.babyNameField) elements.babyNameField.classList.toggle('hidden-field', serviceGroup !== 'stud');
  if (clearHidden) clearHiddenDetailFields(visibleFields);
  renderDetailControls();
}

async function refreshSecurityToken() {
  state.formStartedAt = Date.now();
  state.formToken = '';
  elements.formStartedAt.value = String(state.formStartedAt);
  elements.formToken.value = '';
  try {
    const result = await fetchWalkinToken();
    state.formToken = String(result?.token || '');
    elements.formToken.value = state.formToken;
  } catch (_) {
    setStatus(getCopy().securityError, 'error');
  }
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
  setFieldText(elements.serviceDetailLabel, elements.serviceDetail, copy.detailLabel, copy.detailPlaceholder);
  setFieldText(elements.preferredScheduleLabel, elements.preferredSchedule, copy.preferredScheduleLabel, copy.preferredSchedulePlaceholder);
  setFieldText(elements.passCountriesLabel, elements.passCountries, copy.passCountriesLabel, copy.passCountriesPlaceholder);
  setFieldText(elements.passPurposeLabel, elements.passPurpose, copy.passPurposeLabel, copy.passPurposePlaceholder);
  setFieldText(elements.passPeopleLabel, elements.passPeople, copy.passPeopleLabel, copy.passPeoplePlaceholder);
  setFieldText(elements.shootingLocationLabel, elements.shootingLocation, copy.shootingLocationLabel, copy.shootingLocationPlaceholder);
  setFieldText(elements.eventCompanyLabel, elements.eventCompany, copy.eventCompanyLabel, copy.eventCompanyPlaceholder);
  setFieldText(elements.eventDetailsLabel, elements.eventDetails, copy.eventDetailsLabel, copy.eventDetailsPlaceholder);
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
  renderServiceDetailPanel();
  if (!state.submitting && elements.successPanel.classList.contains('hidden-field')) {
    setStatus(copy.statusReady, 'info');
  }
}

function collectPayload() {
  const formData = new FormData(elements.form);
  const serviceGroup = formData.get('serviceGroup') || state.serviceGroup || '';
  const rawDetail = {
    serviceDetail: String(formData.get('serviceDetail') || '').trim(),
    preferredSchedule: String(formData.get('preferredSchedule') || '').trim(),
    passCountries: String(formData.get('passCountries') || '').trim(),
    passPurpose: String(formData.get('passPurpose') || '').trim(),
    passPeople: String(formData.get('passPeople') || '').trim(),
    shootingLocation: String(formData.get('shootingLocation') || '').trim(),
    eventCompany: String(formData.get('eventCompany') || '').trim(),
    eventDetails: String(formData.get('eventDetails') || '').trim()
  };
  return {
    name: String(formData.get('name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    email: String(formData.get('email') || '').trim(),
    address: String(formData.get('address') || '').trim(),
    payerName: String(formData.get('payerName') || '').trim(),
    babyName: String(formData.get('babyName') || '').trim(),
    serviceDetail: getSelectedOptionLabel('serviceDetail', rawDetail.serviceDetail, serviceGroup),
    preferredSchedule: getSelectedOptionLabel('preferredSchedule', rawDetail.preferredSchedule, serviceGroup),
    passCountries: getSelectedOptionLabel('passCountries', rawDetail.passCountries, serviceGroup),
    passPurpose: getSelectedOptionLabel('passPurpose', rawDetail.passPurpose, serviceGroup),
    passPeople: getSelectedOptionLabel('passPeople', rawDetail.passPeople, serviceGroup),
    shootingLocation: getSelectedOptionLabel('shootingLocation', rawDetail.shootingLocation, serviceGroup),
    eventCompany: getSelectedOptionLabel('eventCompany', rawDetail.eventCompany, serviceGroup),
    eventDetails: getSelectedOptionLabel('eventDetails', rawDetail.eventDetails, serviceGroup),
    detailCodes: rawDetail,
    memo: String(formData.get('memo') || '').trim(),
    lang: state.lang,
    serviceGroup,
    serviceLabel: getServiceLabel(serviceGroup),
    formToken: String(formData.get('formToken') || state.formToken || '').trim(),
    formStartedAt: String(formData.get('formStartedAt') || state.formStartedAt || '').trim(),
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
  if (!payload.formToken) return copy.securityError;
  if (payload.serviceGroup === 'pass' && (!payload.passCountries || !payload.passPurpose)) return copy.passDetailError;
  if (['snap', 'wed', 'biz'].includes(payload.serviceGroup) && !payload.shootingLocation) return copy.locationError;
  if (payload.serviceGroup === 'other' && !payload.serviceDetail) return copy.detailError;
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
    payload.serviceDetail ? `<b>${escapeHtml(copy.detailLabel)}</b>: ${escapeHtml(payload.serviceDetail)}` : '',
    payload.preferredSchedule ? `<b>${escapeHtml(copy.preferredScheduleLabel)}</b>: ${escapeHtml(payload.preferredSchedule)}` : '',
    payload.shootingLocation ? `<b>${escapeHtml(copy.shootingLocationLabel)}</b>: ${escapeHtml(payload.shootingLocation)}` : '',
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
  renderServiceDetailPanel({ clearHidden: true });
  refreshSecurityToken();
  elements.formPanel.classList.remove('hidden-field');
  elements.successPanel.classList.add('hidden-field');
  render();
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.submitting) return;
  if (!state.formToken) await refreshSecurityToken();
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
    refreshSecurityToken();
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
    clearAllDetailFields();
    renderServiceDetailPanel({ clearHidden: true });
  });

  elements.businessInvoiceNeeded.addEventListener('change', toggleBusinessFields);
  elements.form.addEventListener('submit', handleSubmit);
  elements.restartBtn.addEventListener('click', resetForm);
}

bindEvents();
toggleBusinessFields();
elements.formStartedAt.value = String(state.formStartedAt);
refreshSecurityToken();
render();
