import { fetchPartners, pingPartnerClick, submitConsultation } from '../../shared/api-booking.js';

const SUPPORTED_LANGS = ['de', 'en', 'ko'];
const APPOINTMENT_METHODS = ['phone', 'video', 'studio'];

const I18N = {
  de: {
    pageTitle: 'Studio mean Beratung',
    metaDescription: 'Beratungsformular fur Hochzeiten, Events, Unternehmen und Content-Produktionen bei Studio mean.',
    home: 'Buchungsseite',
    railKicker: 'Consultation',
    heroTitle: 'Beratung',
    heroLead: 'Fur Shootings mit Termin-, Ablauf- oder Umfangsfragen teilen Sie uns bitte zuerst die wichtigsten Details mit.',
    steps: ['Formular', 'Beratung', 'Angebot', 'Buchung'],
    stepAria: 'Ablauf der Beratung',
    sectionType: 'Beratungsart',
    sectionBasic: 'Kontaktdaten',
    sectionSchedule: 'Termin und Ort',
    sectionDetails: 'Detailfragen',
    sectionPriority: 'Wichtigster Punkt',
    labelName: 'Name oder Ansprechpartner *',
    labelEmail: 'E-Mail *',
    labelPhone: 'Telefon *',
    labelCompany: 'Firma / Organisation',
    labelLang: 'Kundensprache',
    labelContactMethod: 'Art der Beratung',
    labelConsultationDate: 'Beratungstermin Datum',
    labelConsultationTime: 'Beratungstermin Uhrzeit',
    labelConsultationDuration: 'Dauer der Beratung',
    labelPreferredSchedule: 'Hinweis zum Beratungstermin',
    labelShootDate: 'Geplanter Shooting- oder Eventtermin',
    labelLocation: 'Shooting- oder Veranstaltungsort',
    labelBudget: 'Budgetrahmen',
    labelMessage: 'Weitere Angaben',
    placeholderPreferredSchedule: 'z. B. weitere mogliche Zeiten oder telefonische Erreichbarkeit',
    placeholderShootDate: 'z. B. 2026-08-22 oder noch offen',
    placeholderLocation: 'z. B. Frankfurt Standesamt, Buro, Eventlocation',
    placeholderMessage: 'Ziel, wichtige Motive, offene Fragen, Sorgen oder Referenzlinks.',
    marketingConsent: 'Ich habe Interesse daran, dass ausgewahlte Ergebnisse im Studio mean Portfolio oder auf Social Media gezeigt werden.',
    privacyConsent: 'Ich stimme der Verarbeitung meiner Daten zur Beratung und Buchungsabwicklung zu. *',
    submit: 'Beratung absenden',
    sending: 'Das Beratungsformular wird gesendet...',
    successTitle: 'Ihre Anfrage ist angekommen.',
    successText: 'Wir haben Ihnen eine Bestatigung per E-Mail gesendet. Studio mean pruft die Angaben und meldet sich in der Regel innerhalb von 1–2 Werktagen mit Beratung, Angebot oder dem nachsten Schritt.',
    successLink: 'Zur Buchungsseite',
    errorType: 'Bitte wahlen Sie eine Beratungsart aus.',
    errorName: 'Bitte geben Sie Ihren Namen oder Ansprechpartner ein.',
    errorEmail: 'Bitte geben Sie eine gultige E-Mail-Adresse ein.',
    errorPhone: 'Bitte geben Sie eine Telefonnummer ein.',
    errorAppointment: 'Fur Telefon-, Video- oder Studio-Beratung wahlen Sie bitte Datum und Uhrzeit aus.',
    errorPrivacy: 'Bitte stimmen Sie der Datenverarbeitung fur Beratung und Kontaktaufnahme zu.',
    errorGeneric: 'Beim Senden ist ein Fehler aufgetreten.',
    durationSuffix: 'Min.',
    languageOptions: { de: 'Deutsch', en: 'English', ko: '한국어' }
  },
  en: {
    pageTitle: 'Studio mean Consultation',
    metaDescription: 'Consultation form for weddings, events, business projects and content shoots at Studio mean.',
    home: 'Booking page',
    railKicker: 'Consultation',
    heroTitle: 'Consultation',
    heroLead: 'For shoots that need timing, scope or planning details, please share the key information first.',
    steps: ['Form received', 'Call/meeting', 'Quote prepared', 'Booking'],
    stepAria: 'Consultation steps',
    sectionType: 'Consultation type',
    sectionBasic: 'Basic details',
    sectionSchedule: 'Schedule and location',
    sectionDetails: 'Details',
    sectionPriority: 'Main priority',
    labelName: 'Name or contact person *',
    labelEmail: 'Email *',
    labelPhone: 'Phone *',
    labelCompany: 'Company / organization',
    labelLang: 'Customer language',
    labelContactMethod: 'Consultation method',
    labelConsultationDate: 'Consultation date',
    labelConsultationTime: 'Consultation time',
    labelConsultationDuration: 'Consultation duration',
    labelPreferredSchedule: 'Schedule note',
    labelShootDate: 'Planned shoot or event date',
    labelLocation: 'Shoot or event location',
    labelBudget: 'Budget range',
    labelMessage: 'Additional message',
    placeholderPreferredSchedule: 'e.g. other possible times or when you are reachable by phone',
    placeholderShootDate: 'e.g. 2026-08-22 or still open',
    placeholderLocation: 'e.g. Frankfurt Standesamt, office, event venue',
    placeholderMessage: 'Goals, must-have shots, concerns, open questions, or reference links.',
    marketingConsent: 'I am interested in allowing selected final images or videos to be used in the Studio mean portfolio or social media.',
    privacyConsent: 'I agree to the use of my data for consultation and booking communication. *',
    submit: 'Send consultation',
    sending: 'Sending your consultation form...',
    successTitle: 'Your consultation form has been received.',
    successText: 'We have sent you a confirmation email. Studio mean will review the details and follow up with the consultation, quote, or next step — usually within 1–2 business days.',
    successLink: 'Go to booking page',
    errorType: 'Please choose a consultation type.',
    errorName: 'Please enter your name or contact person.',
    errorEmail: 'Please enter a valid email address.',
    errorPhone: 'Please enter a phone number.',
    errorAppointment: 'For phone, video or studio consultations, please choose both date and time.',
    errorPrivacy: 'Please agree to the data use for consultation and contact.',
    errorGeneric: 'Something went wrong while sending.',
    durationSuffix: 'min',
    languageOptions: { de: 'Deutsch', en: 'English', ko: '한국어' }
  },
  ko: {
    pageTitle: 'Studio mean 상담',
    metaDescription: '웨딩, 기업행사, 브랜드 콘텐츠 촬영 상담 설문을 작성해 주세요.',
    home: '예약 페이지',
    railKicker: 'Consultation',
    heroTitle: '상담 설문',
    heroLead: '웨딩, 기업행사, 브랜드 콘텐츠처럼 일정과 범위 확인이 필요한 촬영은 먼저 상담 내용을 남겨 주세요.',
    steps: ['설문 접수', '상담/회의', '견적 정리', '예약 전환'],
    stepAria: '상담 진행 단계',
    sectionType: '상담 유형',
    sectionBasic: '기본 정보',
    sectionSchedule: '일정과 장소',
    sectionDetails: '세부 설문',
    sectionPriority: '중요한 점',
    labelName: '이름 또는 담당자명 *',
    labelEmail: '이메일 *',
    labelPhone: '연락처 *',
    labelCompany: '회사/단체명',
    labelLang: '고객 언어',
    labelContactMethod: '상담 방식',
    labelConsultationDate: '상담 예약 날짜',
    labelConsultationTime: '상담 예약 시간',
    labelConsultationDuration: '상담 소요 시간',
    labelPreferredSchedule: '상담 일정 메모',
    labelShootDate: '촬영/행사 예정일',
    labelLocation: '촬영 장소',
    labelBudget: '예산 범위',
    labelMessage: '추가로 남길 내용',
    placeholderPreferredSchedule: '예: 다른 가능한 시간, 전화 가능 시간대',
    placeholderShootDate: '예: 2026-08-22 또는 아직 미정',
    placeholderLocation: '예: Frankfurt Standesamt, 사무실, 외부 행사장',
    placeholderMessage: '촬영 목적, 꼭 필요한 장면, 걱정되는 부분, 레퍼런스 링크 등을 적어 주세요.',
    marketingConsent: '완성본 일부를 Studio mean 포트폴리오/SNS에 활용하는 것에 관심이 있습니다.',
    privacyConsent: '상담과 예약 진행을 위한 개인정보 수집 및 연락에 동의합니다. *',
    submit: '상담 설문 보내기',
    sending: '상담 설문을 전송하는 중입니다...',
    successTitle: '상담 설문이 접수되었습니다.',
    successText: '확인 메일을 보내드렸습니다. Studio mean에서 내용을 검토한 뒤 보통 1–2 영업일 안에 상담 또는 견적 안내를 드리겠습니다.',
    successLink: '예약 페이지로 이동',
    errorType: '상담 유형을 선택해 주세요.',
    errorName: '이름 또는 담당자명을 입력해 주세요.',
    errorEmail: '이메일을 정확히 입력해 주세요.',
    errorPhone: '연락처를 입력해 주세요.',
    errorAppointment: '전화/화상/방문 상담 예약은 상담 날짜와 시간을 선택해 주세요.',
    errorPrivacy: '개인정보 수집 및 연락 동의가 필요합니다.',
    errorGeneric: '전송 중 오류가 발생했습니다.',
    durationSuffix: '분',
    languageOptions: { de: 'Deutsch', en: 'English', ko: '한국어' }
  }
};

const CONTACT_METHODS = [
  { id: 'email', labels: { de: 'Beratung per E-Mail', en: 'Email consultation', ko: '이메일 상담' } },
  { id: 'phone', labels: { de: 'Telefontermin', en: 'Phone consultation appointment', ko: '전화 상담 예약' } },
  { id: 'video', labels: { de: 'Video-Beratungstermin', en: 'Video consultation appointment', ko: '화상 상담 예약' } },
  { id: 'studio', labels: { de: 'Beratung im Studio', en: 'Studio visit consultation appointment', ko: '스튜디오 방문 상담 예약' } }
];

const BUDGET_OPTIONS = [
  { id: '', labels: { de: 'Noch offen', en: 'Still open', ko: '아직 미정' } },
  { id: 'under300', labels: { de: 'Unter €300', en: 'Under €300', ko: '€300 이하' } },
  { id: '300-700', labels: { de: '€300-700', en: '€300-700', ko: '€300-700' } },
  { id: '700-1500', labels: { de: '€700-1,500', en: '€700-1,500', ko: '€700-1,500' } },
  { id: '1500-3000', labels: { de: '€1,500-3,000', en: '€1,500-3,000', ko: '€1,500-3,000' } },
  { id: 'over3000', labels: { de: 'Mehr als €3,000', en: 'Over €3,000', ko: '€3,000 이상' } }
];

const PRIORITIES = [
  { id: 'date', labels: { de: 'Termin sichern', en: 'Confirming the date', ko: '일정 확정' } },
  { id: 'budget', labels: { de: 'Budget abstimmen', en: 'Budget alignment', ko: '예산 조율' } },
  { id: 'photoStyle', labels: { de: 'Bildstil', en: 'Photo mood', ko: '사진 분위기' } },
  { id: 'video', labels: { de: 'Video einbeziehen', en: 'Whether to include video', ko: '영상 포함 여부' } },
  { id: 'delivery', labels: { de: 'Schnelle Lieferung', en: 'Fast delivery', ko: '빠른 납품' } },
  { id: 'local', labels: { de: 'Ablauf in Deutschland', en: 'Local process in Germany', ko: '독일 현지 진행' } },
  { id: 'korean', labels: { de: 'Koreanische Kommunikation', en: 'Korean communication', ko: '한국어 커뮤니케이션' } }
];

const TYPE_CONFIG = {
  wedding: {
    labels: {
      de: { label: 'Hochzeit / Standesamt', desc: 'Standesamt, Empfang, Paarshooting sowie Foto- und Videoumfang.' },
      en: { label: 'Wedding / civil ceremony', desc: 'Civil ceremony, reception, couple session, photo and video scope.' },
      ko: { label: '웨딩 / 암트 결혼식', desc: '암트, 피로연, 커플 세션, 사진/영상 범위를 정리합니다.' }
    },
    groups: {
      coverage: {
        titles: { de: 'Benotigter Umfang', en: 'Coverage needed', ko: '필요한 촬영 범위' },
        choices: [
          { id: 'civilCeremony', labels: { de: 'Standesamt', en: 'Civil ceremony', ko: '암트 본식' } },
          { id: 'reception', labels: { de: 'Empfang / Feier', en: 'Reception', ko: '피로연' } },
          { id: 'coupleSession', labels: { de: 'Paarshooting', en: 'Couple session', ko: '커플 촬영' } },
          { id: 'familyGroups', labels: { de: 'Familien- und Gruppenfotos', en: 'Family / guest group photos', ko: '가족/하객 단체사진' } },
          { id: 'videoCoverage', labels: { de: 'Videoaufnahme', en: 'Video coverage', ko: '영상 촬영' } },
          { id: 'highlightFilm', labels: { de: 'Highlightfilm', en: 'Highlight film', ko: '하이라이트 영상' } }
        ]
      },
      deliverables: {
        titles: { de: 'Gewunschte Ergebnisse', en: 'Deliverables needed', ko: '필요한 결과물' },
        choices: [
          { id: 'editedPhotos', labels: { de: 'Bearbeitete Fotos', en: 'Edited photos', ko: '보정 사진' } },
          { id: 'allOriginals', labels: { de: 'Alle Originaldateien', en: 'All originals', ko: '전체 원본' } },
          { id: 'printsAlbum', labels: { de: 'Prints / Album', en: 'Prints / album', ko: '인화/앨범' } },
          { id: 'shortReels', labels: { de: 'Kurze Reels', en: 'Short reels', ko: '짧은 릴스 영상' } },
          { id: 'highlight3to5', labels: { de: '3-5 Min. Highlight', en: '3-5 min highlight', ko: '3-5분 하이라이트' } },
          { id: 'longDocumentary', labels: { de: 'Langere Dokumentation', en: 'Long-form documentary', ko: '장시간 기록 영상' } }
        ]
      },
      style: {
        titles: { de: 'Gewunschte Stimmung', en: 'Preferred mood', ko: '원하는 분위기' },
        choices: [
          { id: 'documentary', labels: { de: 'Naturlich dokumentarisch', en: 'Natural documentary', ko: '자연스러운 다큐멘터리' } },
          { id: 'classic', labels: { de: 'Klar und klassisch', en: 'Clean classic', ko: '깔끔한 클래식' } },
          { id: 'bright', labels: { de: 'Hell und freundlich', en: 'Bright and airy', ko: '화사하고 밝게' } },
          { id: 'cinematic', labels: { de: 'Cinematic', en: 'Cinematic', ko: '시네마틱' } },
          { id: 'familyFocused', labels: { de: 'Familienfokus', en: 'Family-focused', ko: '가족 중심' } },
          { id: 'detailFocused', labels: { de: 'Details sind wichtig', en: 'Detail shots matter', ko: '디테일 컷 중요' } }
        ]
      }
    }
  },
  corporate: {
    labels: {
      de: { label: 'Unternehmen / Marke', desc: 'Businessportraits, Teamfotos, Recruiting- und Kampagnencontent.' },
      en: { label: 'Business / brand', desc: 'Corporate portraits, team photos, recruiting content and campaigns.' },
      ko: { label: '기업 / 브랜드', desc: '기업 프로필, 팀 촬영, 채용/홍보 콘텐츠, 캠페인 범위를 확인합니다.' }
    },
    groups: {
      coverage: {
        titles: { de: 'Projektziel', en: 'Project goal', ko: '프로젝트 목적' },
        choices: [
          { id: 'staffPortraits', labels: { de: 'Mitarbeiterportraits', en: 'Staff portraits', ko: '임직원 프로필' } },
          { id: 'teamGroup', labels: { de: 'Teamgruppenfoto', en: 'Team group photos', ko: '팀 단체사진' } },
          { id: 'websiteRecruiting', labels: { de: 'Website / Recruiting', en: 'Website / recruiting images', ko: '웹사이트/채용 이미지' } },
          { id: 'brandCampaign', labels: { de: 'Markenkampagne', en: 'Brand campaign', ko: '브랜드 캠페인' } },
          { id: 'productService', labels: { de: 'Produkt / Service vor Ort', en: 'Product / service in context', ko: '제품/서비스 현장' } },
          { id: 'interviewVideo', labels: { de: 'Interviewvideo', en: 'Interview video', ko: '인터뷰 영상' } }
        ]
      },
      deliverables: {
        titles: { de: 'Lieferformat', en: 'Delivery format', ko: '납품 형태' },
        choices: [
          { id: 'webSocialPhotos', labels: { de: 'Fotos fur Web / Social', en: 'Photos for web / social', ko: '웹/SNS용 사진' } },
          { id: 'printHighRes', labels: { de: 'Hochauflosend fur Druck', en: 'High-res for print', ko: '인쇄용 고해상도' } },
          { id: 'shortFormClips', labels: { de: 'Kurzformat-Clips', en: 'Short-form clips', ko: '숏폼 클립' } },
          { id: 'interviewEdit', labels: { de: 'Geschnittenes Interview', en: 'Edited interview', ko: '인터뷰 편집본' } },
          { id: 'rawBackup', labels: { de: 'Backup der Rohdaten', en: 'Raw backup', ko: '촬영 원본 백업' } },
          { id: 'fastDelivery', labels: { de: 'Schnelle Lieferung', en: 'Fast delivery', ko: '빠른 납품' } }
        ]
      },
      style: {
        titles: { de: 'Markenton', en: 'Brand tone', ko: '브랜드 톤' },
        choices: [
          { id: 'corporateClean', labels: { de: 'Klar und professionell', en: 'Clean corporate image', ko: '정돈된 기업 이미지' } },
          { id: 'warmTeam', labels: { de: 'Warme Teamatmosphare', en: 'Warm team feeling', ko: '따뜻한 팀 분위기' } },
          { id: 'premium', labels: { de: 'Premium / hochwertig', en: 'Premium / elevated', ko: '프리미엄/고급' } },
          { id: 'activeCasual', labels: { de: 'Aktiv / casual', en: 'Active / casual', ko: '활동적/캐주얼' } },
          { id: 'minimal', labels: { de: 'Minimal', en: 'Minimal', ko: '미니멀' } },
          { id: 'editorial', labels: { de: 'Editorial', en: 'Editorial', ko: '에디토리얼' } }
        ]
      }
    }
  },
  dol: {
    labels: {
      de: { label: 'Dol / Baekil (1. Geburtstag)', desc: 'Doljanchi, Baekil, Hanbok, Doljabi und Familienfeier im Studio oder vor Ort.' },
      en: { label: 'Dol / Baekil (1st birthday)', desc: 'Doljanchi, baekil, hanbok, doljabi and family celebration, in studio or on location.' },
      ko: { label: '돌잔치 / 백일', desc: '돌상, 돌잡이, 한복, 가족 단체사진 등 준비 범위를 정리합니다.' }
    },
    groups: {
      coverage: {
        titles: { de: 'Benotigter Umfang', en: 'Coverage needed', ko: '필요한 촬영 범위' },
        choices: [
          { id: 'dolTableSetup', labels: { de: 'Dol-Tisch / Baekil-Tisch', en: 'Dol / baekil table setting', ko: '돌상/백일상 세팅' } },
          { id: 'doljabi', labels: { de: 'Doljabi-Zeremonie', en: 'Doljabi ceremony', ko: '돌잡이' } },
          { id: 'hanbokPortrait', labels: { de: 'Hanbok-Portrait', en: 'Hanbok portrait', ko: '한복 촬영' } },
          { id: 'familyGroups', labels: { de: 'Familien- und Gruppenfotos', en: 'Family / guest group photos', ko: '가족/하객 단체사진' } },
          { id: 'partyProgram', labels: { de: 'Feier und Programm', en: 'Party and program', ko: '행사 진행/케이크 커팅' } },
          { id: 'videoCoverage', labels: { de: 'Videoaufnahme', en: 'Video coverage', ko: '영상 촬영' } }
        ]
      },
      deliverables: {
        titles: { de: 'Gewunschte Ergebnisse', en: 'Deliverables needed', ko: '필요한 결과물' },
        choices: [
          { id: 'editedPhotos', labels: { de: 'Bearbeitete Fotos', en: 'Edited photos', ko: '보정 사진' } },
          { id: 'allOriginals', labels: { de: 'Alle Originaldateien', en: 'All originals', ko: '전체 원본' } },
          { id: 'printsAlbum', labels: { de: 'Prints / Album', en: 'Prints / album', ko: '인화/액자/앨범' } },
          { id: 'shortReels', labels: { de: 'Kurze Reels', en: 'Short reels', ko: '짧은 릴스 영상' } },
          { id: 'growthVideo', labels: { de: 'Wachstumsvideo', en: 'Growth video', ko: '성장 영상' } },
          { id: 'fullRecord', labels: { de: 'Gesamtdokumentation', en: 'Full event record', ko: '행사 전체 기록' } }
        ]
      },
      style: {
        titles: { de: 'Gewunschte Stimmung', en: 'Preferred mood', ko: '원하는 분위기' },
        choices: [
          { id: 'babyExpressions', labels: { de: 'Gesichter des Kindes', en: 'Baby expressions first', ko: '아기 표정 중심' } },
          { id: 'familyFocused', labels: { de: 'Familienfokus', en: 'Family-focused', ko: '가족 중심' } },
          { id: 'brightAiry', labels: { de: 'Hell und freundlich', en: 'Bright and airy', ko: '화사하고 밝게' } },
          { id: 'traditionalHanbok', labels: { de: 'Traditionell mit Hanbok', en: 'Traditional hanbok mood', ko: '전통 한복 느낌' } },
          { id: 'documentary', labels: { de: 'Naturlich dokumentarisch', en: 'Natural documentary', ko: '자연스러운 기록' } },
          { id: 'detailFocused', labels: { de: 'Details sind wichtig', en: 'Detail shots matter', ko: '돌상/소품 디테일 컷' } }
        ]
      }
    }
  },
  event: {
    labels: {
      de: { label: 'Event / Veranstaltung', desc: 'Konferenz, Party, Ausstellung, Familienfeier oder Buhnenprogramm.' },
      en: { label: 'Event', desc: 'Conference, party, exhibition, family event or stage program coverage.' },
      ko: { label: '행사 / 이벤트', desc: '컨퍼런스, 파티, 전시, 가족행사 등 현장 기록 범위를 정리합니다.' }
    },
    groups: {
      coverage: {
        titles: { de: 'Art der Veranstaltung', en: 'Event type', ko: '행사 종류' },
        choices: [
          { id: 'conference', labels: { de: 'Konferenz / Seminar', en: 'Conference / seminar', ko: '컨퍼런스/세미나' } },
          { id: 'networkingParty', labels: { de: 'Networking / Party', en: 'Networking / party', ko: '네트워킹/파티' } },
          { id: 'exhibitionPopup', labels: { de: 'Ausstellung / Pop-up', en: 'Exhibition / pop-up', ko: '전시/팝업' } },
          { id: 'familyEvent', labels: { de: 'Familienfeier', en: 'Family event', ko: '돌잔치/가족행사' } },
          { id: 'performanceStage', labels: { de: 'Performance / Buhne', en: 'Performance / stage', ko: '공연/무대' } },
          { id: 'awardCeremony', labels: { de: 'Preisverleihung', en: 'Award ceremony', ko: '시상식' } }
        ]
      },
      deliverables: {
        titles: { de: 'Gewunschte Ergebnisse', en: 'Deliverables needed', ko: '필요한 결과물' },
        choices: [
          { id: 'eventSketch', labels: { de: 'Eventreportage Fotos', en: 'Event documentary photos', ko: '현장 스케치 사진' } },
          { id: 'keyPeople', labels: { de: 'Key People / Speaker', en: 'Key people / speakers', ko: '주요 인물/스피커' } },
          { id: 'groupPhoto', labels: { de: 'Gruppenfoto', en: 'Group photo', ko: '단체사진' } },
          { id: 'sameDaySocial', labels: { de: 'Social-Media Auswahl am selben Tag', en: 'Same-day social media cuts', ko: 'SNS 당일 컷' } },
          { id: 'eventHighlight', labels: { de: 'Highlightvideo', en: 'Highlight video', ko: '하이라이트 영상' } },
          { id: 'fullRecord', labels: { de: 'Gesamtdokumentation', en: 'Full event record', ko: '행사 전체 기록' } }
        ]
      },
      style: {
        titles: { de: 'Wichtige Arbeitsweise', en: 'Important coverage style', ko: '중요한 기록 방식' },
        choices: [
          { id: 'unobtrusive', labels: { de: 'Unauffallig und ruhig', en: 'Quiet and unobtrusive', ko: '방해 없이 조용히' } },
          { id: 'keyMoments', labels: { de: 'Fokus auf Schlussszenen', en: 'Key moments first', ko: '주요 순간 중심' } },
          { id: 'guestExpressions', labels: { de: 'Gesichter der Gaste', en: 'Guest expressions', ko: '참석자 표정 중심' } },
          { id: 'spaceBranding', labels: { de: 'Raum- und Brandingdetails', en: 'Space / branding details', ko: '공간/브랜딩 디테일' } },
          { id: 'fastDelivery', labels: { de: 'Schnelle Lieferung', en: 'Fast delivery', ko: '빠른 납품' } },
          { id: 'videoFirst', labels: { de: 'Videoclips zuerst', en: 'Video clips first', ko: '영상 클립 우선' } }
        ]
      }
    }
  },
  content: {
    labels: {
      de: { label: 'Content / Personal Branding', desc: 'Profil-, Social-Media-, Website-, Kurs- und Contentfotos oder Videos.' },
      en: { label: 'Content / personal branding', desc: 'Profile, social media, website, course and content photos or videos.' },
      ko: { label: '콘텐츠 / 개인 브랜딩', desc: '프로필, SNS, 웹사이트, 강의/콘텐츠용 사진과 영상을 설계합니다.' }
    },
    groups: {
      coverage: {
        titles: { de: 'Verwendungszweck', en: 'Usage goal', ko: '사용 목적' },
        choices: [
          { id: 'personalProfile', labels: { de: 'Personliches Profil', en: 'Personal profile', ko: '개인 프로필' } },
          { id: 'websiteIntro', labels: { de: 'Website Vorstellung', en: 'Website introduction', ko: '웹사이트 소개' } },
          { id: 'socialContent', labels: { de: 'Social-Media Content', en: 'Social media content', ko: 'SNS 콘텐츠' } },
          { id: 'coachingPromo', labels: { de: 'Kurs / Coaching Promotion', en: 'Course / coaching promotion', ko: '강의/코칭 홍보' } },
          { id: 'pressProfile', labels: { de: 'Buch / Presseprofil', en: 'Book / press profile', ko: '책/언론 프로필' } },
          { id: 'introVideo', labels: { de: 'Vorstellungsvideo', en: 'Intro video', ko: '영상 자기소개' } }
        ]
      },
      deliverables: {
        titles: { de: 'Benotigte Bausteine', en: 'Needed components', ko: '필요한 구성' },
        choices: [
          { id: 'editedSet', labels: { de: 'Set bearbeiteter Fotos', en: 'Edited photo set', ko: '보정 사진 세트' } },
          { id: 'multipleLooks', labels: { de: 'Mehrere Hintergrunde / Outfits', en: 'Multiple backgrounds / outfits', ko: '배경/의상 여러 버전' } },
          { id: 'shortVideo', labels: { de: 'Kurzes Video', en: 'Short video', ko: '짧은 영상' } },
          { id: 'thumbnailImages', labels: { de: 'Thumbnailbilder', en: 'Thumbnail images', ko: '썸네일 이미지' } },
          { id: 'brandColors', labels: { de: 'Brandfarben einbeziehen', en: 'Reflect brand colors', ko: '브랜드 컬러 반영' } },
          { id: 'planningConsult', labels: { de: 'Contentplanung Beratung', en: 'Content planning consultation', ko: '콘텐츠 기획 상담' } }
        ]
      },
      style: {
        titles: { de: 'Gewunschter Eindruck', en: 'Preferred impression', ko: '원하는 인상' },
        choices: [
          { id: 'professional', labels: { de: 'Professionell', en: 'Professional', ko: '전문적' } },
          { id: 'friendly', labels: { de: 'Sympathisch', en: 'Friendly', ko: '친근한' } },
          { id: 'calm', labels: { de: 'Ruhig', en: 'Calm', ko: '차분한' } },
          { id: 'boldClear', labels: { de: 'Klar und stark', en: 'Bold and clear', ko: '선명하고 강한' } },
          { id: 'natural', labels: { de: 'Naturlich', en: 'Natural', ko: '자연스러운' } },
          { id: 'creative', labels: { de: 'Kreativ', en: 'Creative', ko: '창의적인' } }
        ]
      }
    }
  }
};

const state = {
  lang: detectInitialLanguage(),
  type: detectInitialType(),
  selected: {
    coverage: new Set(),
    deliverables: new Set(),
    style: new Set(),
    priority: ''
  }
};

const els = {
  form: document.getElementById('consultationForm'),
  typeGrid: document.getElementById('typeGrid'),
  dynamicQuestions: document.getElementById('dynamicQuestions'),
  priorityGroup: document.getElementById('priorityGroup'),
  status: document.getElementById('formStatus'),
  submit: document.getElementById('submitBtn'),
  formPanel: document.getElementById('formPanel'),
  successPanel: document.getElementById('successPanel'),
  homeLink: document.querySelector('.ghost-link'),
  railKicker: document.querySelector('.rail-kicker'),
  heroTitle: document.querySelector('.consult-rail h1'),
  heroLead: document.querySelector('.consult-rail p'),
  railSteps: document.querySelector('.rail-steps'),
  langButtons: document.querySelectorAll('[data-lang]')
};

function normalizeLang(value) {
  const lang = String(value || '').trim().toLowerCase().slice(0, 2);
  return SUPPORTED_LANGS.includes(lang) ? lang : '';
}

function detectInitialLanguage() {
  const params = new URLSearchParams(window.location.search);
  const paramLang = normalizeLang(params.get('lang') || params.get('locale') || params.get('lng'));
  if (paramLang) return paramLang;
  const pathLang = normalizeLang((window.location.pathname.match(/\/(ko|en|de)(?:\/|$)/i) || [])[1]);
  if (pathLang) return pathLang;
  return normalizeLang(document.documentElement.lang) || normalizeLang(navigator.language) || 'de';
}

// 예약 페이지 딥링크로 상담 유형 프리셀렉트.
// 1순위 ?type=wedding|corporate|dol|event|content (B2B 카드), 2순위 기존 CTA의 ?from=/&event= 매핑.
function detectInitialType() {
  const params = new URLSearchParams(window.location.search);
  const raw = String(params.get('type') || '').trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(TYPE_CONFIG, raw)) return raw;
  const from = String(params.get('from') || '').trim().toLowerCase();
  const event = String(params.get('event') || '').trim().toLowerCase();
  if (from === 'wed' || event === 'civil' || event === 'wedparty') return 'wedding';
  if (event === 'corporate') return 'corporate';
  if (from === 'dolp' || from === 'dol' || event === 'dol' || event === 'baekil') return 'dol';
  if (from === 'biz' || from === 'famevt' || from === 'b2b' || event) return 'event';
  return 'wedding';
}

function tr(key) {
  return I18N[state.lang][key] || I18N.de[key] || key;
}

function labelFor(item) {
  return item.labels[state.lang] || item.labels.de || item.labels.en || item.labels.ko || '';
}

function escapeHTML(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function requestId() {
  return ['consult', Date.now(), Math.random().toString(36).slice(2)].join('-');
}

function setStatus(message, type = '') {
  els.status.textContent = message || '';
  els.status.className = `form-status ${type}`.trim();
}

function setText(selector, value) {
  const node = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (node) node.textContent = value;
}

function setFieldLabel(name, text) {
  const field = els.form.elements[name];
  const label = field && field.closest('label');
  if (!label) return;
  const textNode = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
  if (textNode) {
    textNode.nodeValue = `${text}\n                `;
  }
}

function setPlaceholder(name, text) {
  const field = els.form.elements[name];
  if (field) field.setAttribute('placeholder', text);
}

function selectOptions(select, options, fallbackValue) {
  if (!select) return;
  const current = select.value || fallbackValue || '';
  select.innerHTML = options.map((option) => (
    `<option value="${escapeHTML(option.value)}">${escapeHTML(option.label)}</option>`
  )).join('');
  select.value = options.some((option) => option.value === current) ? current : (fallbackValue || options[0]?.value || '');
}

function renderStaticOptions() {
  const langSelect = els.form.elements.lang;
  selectOptions(langSelect, SUPPORTED_LANGS.map((lang) => ({
    value: lang,
    label: I18N[state.lang].languageOptions[lang]
  })), state.lang);
  langSelect.value = state.lang;

  selectOptions(els.form.elements.contactMethod, CONTACT_METHODS.map((method) => ({
    value: method.id,
    label: labelFor(method)
  })), 'email');

  selectOptions(els.form.elements.consultationDuration, [30, 45, 60].map((minutes) => ({
    value: String(minutes),
    label: `${minutes}${state.lang === 'ko' ? '' : ' '}${tr('durationSuffix')}`
  })), '30');

  selectOptions(els.form.elements.budget, BUDGET_OPTIONS.map((budget) => ({
    value: budget.id,
    label: labelFor(budget)
  })), '');
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.title = tr('pageTitle');
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', tr('metaDescription'));

  setText(els.homeLink, tr('home'));
  setText(els.railKicker, tr('railKicker'));
  setText(els.heroTitle, tr('heroTitle'));
  setText(els.heroLead, tr('heroLead'));
  if (els.railSteps) {
    els.railSteps.setAttribute('aria-label', tr('stepAria'));
    els.railSteps.innerHTML = tr('steps').map((step) => `<span>${escapeHTML(step)}</span>`).join('');
  }

  const sectionTitles = [tr('sectionType'), tr('sectionBasic'), tr('sectionSchedule'), tr('sectionDetails'), tr('sectionPriority')];
  document.querySelectorAll('.form-section .section-head h2').forEach((heading, index) => {
    heading.textContent = sectionTitles[index] || heading.textContent;
  });

  [
    ['name', 'labelName'],
    ['email', 'labelEmail'],
    ['phone', 'labelPhone'],
    ['company', 'labelCompany'],
    ['lang', 'labelLang'],
    ['contactMethod', 'labelContactMethod'],
    ['consultationDate', 'labelConsultationDate'],
    ['consultationTime', 'labelConsultationTime'],
    ['consultationDuration', 'labelConsultationDuration'],
    ['preferredSchedule', 'labelPreferredSchedule'],
    ['shootDate', 'labelShootDate'],
    ['location', 'labelLocation'],
    ['budget', 'labelBudget'],
    ['message', 'labelMessage']
  ].forEach(([name, key]) => setFieldLabel(name, tr(key)));

  setPlaceholder('preferredSchedule', tr('placeholderPreferredSchedule'));
  setPlaceholder('shootDate', tr('placeholderShootDate'));
  setPlaceholder('location', tr('placeholderLocation'));
  setPlaceholder('message', tr('placeholderMessage'));

  const marketingText = els.form.elements.marketingConsent?.closest('label')?.querySelector('span');
  const privacyText = els.form.elements.privacyConsent?.closest('label')?.querySelector('span');
  setText(marketingText, tr('marketingConsent'));
  setText(privacyText, tr('privacyConsent'));
  setText(els.submit, tr('submit'));
  setText(document.querySelector('.success-card h2'), tr('successTitle'));
  setText(document.querySelector('.success-card p'), tr('successText'));
  setText(document.querySelector('.success-card a'), tr('successLink'));

  els.langButtons.forEach((button) => {
    const active = button.dataset.lang === state.lang;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateLanguageUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', state.lang);
  window.history.replaceState({}, '', url.toString());
}

function setLanguage(nextLang, updateUrl = true) {
  const normalized = normalizeLang(nextLang);
  if (!normalized) return;
  state.lang = normalized;
  applyLanguage();
  renderStaticOptions();
  renderTypeGrid();
  renderDynamicQuestions();
  renderPriorityGroup();
  setStatus('');
  if (updateUrl) updateLanguageUrl();
}

function toggleSet(name, value, button) {
  const set = state.selected[name];
  if (set.has(value)) {
    set.delete(value);
    button.classList.remove('active');
  } else {
    set.add(value);
    button.classList.add('active');
  }
}

function renderTypeGrid() {
  els.typeGrid.innerHTML = Object.entries(TYPE_CONFIG).map(([key, item]) => {
    const text = item.labels[state.lang] || item.labels.de;
    return `
      <button type="button" class="type-card ${key === state.type ? 'active' : ''}" data-type="${key}">
        <strong>${escapeHTML(text.label)}</strong>
        <span>${escapeHTML(text.desc)}</span>
      </button>
    `;
  }).join('');
  els.typeGrid.querySelectorAll('.type-card').forEach((button) => {
    button.addEventListener('click', () => {
      state.type = button.dataset.type;
      state.selected.coverage.clear();
      state.selected.deliverables.clear();
      state.selected.style.clear();
      renderTypeGrid();
      renderDynamicQuestions();
    });
  });
}

function renderChoiceGroup(name, title, choices) {
  return `
    <div class="question-block">
      <div class="question-title">${escapeHTML(title)}</div>
      <div class="choice-group" data-group="${name}">
        ${choices.map((choice) => {
          const active = state.selected[name].has(choice.id) ? ' active' : '';
          return `<button type="button" class="choice-pill${active}" data-value="${escapeHTML(choice.id)}">${escapeHTML(labelFor(choice))}</button>`;
        }).join('')}
      </div>
    </div>
  `;
}

function bindChoiceGroup(root, name) {
  root.querySelectorAll(`[data-group="${name}"] .choice-pill`).forEach((button) => {
    button.addEventListener('click', () => toggleSet(name, button.dataset.value, button));
  });
}

function renderDynamicQuestions() {
  const config = TYPE_CONFIG[state.type].groups;
  els.dynamicQuestions.innerHTML = [
    renderChoiceGroup('coverage', config.coverage.titles[state.lang] || config.coverage.titles.de, config.coverage.choices),
    renderChoiceGroup('deliverables', config.deliverables.titles[state.lang] || config.deliverables.titles.de, config.deliverables.choices),
    renderChoiceGroup('style', config.style.titles[state.lang] || config.style.titles.de, config.style.choices)
  ].join('');
  bindChoiceGroup(els.dynamicQuestions, 'coverage');
  bindChoiceGroup(els.dynamicQuestions, 'deliverables');
  bindChoiceGroup(els.dynamicQuestions, 'style');
}

function renderPriorityGroup() {
  els.priorityGroup.innerHTML = PRIORITIES.map((choice) => {
    const active = state.selected.priority === choice.id ? ' active' : '';
    return `<button type="button" class="choice-pill${active}" data-value="${escapeHTML(choice.id)}">${escapeHTML(labelFor(choice))}</button>`;
  }).join('');
  els.priorityGroup.querySelectorAll('.choice-pill').forEach((button) => {
    button.addEventListener('click', () => {
      els.priorityGroup.querySelectorAll('.choice-pill').forEach((el) => el.classList.remove('active'));
      state.selected.priority = button.dataset.value;
      button.classList.add('active');
    });
  });
}

function formValue(name) {
  return String(new FormData(els.form).get(name) || '').trim();
}

function selectedLabels(groupName) {
  const group = TYPE_CONFIG[state.type].groups[groupName];
  const selected = state.selected[groupName];
  return group.choices.filter((choice) => selected.has(choice.id)).map(labelFor);
}

function priorityLabel() {
  const item = PRIORITIES.find((choice) => choice.id === state.selected.priority);
  return item ? labelFor(item) : '';
}

function optionLabel(options, id) {
  const item = options.find((option) => option.id === id);
  return item ? labelFor(item) : '';
}

function validate() {
  if (!state.type) return tr('errorType');
  if (!formValue('name')) return tr('errorName');
  if (!formValue('email') || !formValue('email').includes('@')) return tr('errorEmail');
  if (!formValue('phone')) return tr('errorPhone');
  if (APPOINTMENT_METHODS.includes(formValue('contactMethod')) && (!formValue('consultationDate') || !formValue('consultationTime'))) {
    return tr('errorAppointment');
  }
  if (!els.form.elements.privacyConsent.checked) return tr('errorPrivacy');
  return '';
}

function payload() {
  const data = new FormData(els.form);
  const typeConfig = TYPE_CONFIG[state.type];
  const typeText = typeConfig.labels[state.lang] || typeConfig.labels.de;
  const contactMethodCode = formValue('contactMethod') || 'email';
  const budgetCode = formValue('budget');
  return {
    consultationType: typeText.label,
    type: state.type,
    typeLabel: typeText.label,
    name: formValue('name'),
    email: formValue('email'),
    phone: formValue('phone'),
    company: formValue('company'),
    lang: state.lang,
    siteLanguage: state.lang,
    language: state.lang,
    locale: state.lang,
    contactMethod: optionLabel(CONTACT_METHODS, contactMethodCode),
    contactMethodCode,
    consultationDate: formValue('consultationDate'),
    consultationTime: formValue('consultationTime'),
    consultationDuration: formValue('consultationDuration') || '30',
    preferredSchedule: formValue('preferredSchedule'),
    shootDate: formValue('shootDate'),
    location: formValue('location'),
    budget: optionLabel(BUDGET_OPTIONS, budgetCode),
    priority: priorityLabel(),
    coverage: selectedLabels('coverage'),
    deliverables: selectedLabels('deliverables'),
    style: selectedLabels('style'),
    message: formValue('message'),
    marketingConsent: !!data.get('marketingConsent'),
    privacyConsent: !!data.get('privacyConsent'),
    source: 'booking-consultation',
    sourceUrl: window.location.href,
    website: formValue('website')
  };
}

async function handleSubmit(event) {
  event.preventDefault();
  const error = validate();
  if (error) {
    setStatus(error, 'error');
    return;
  }
  els.submit.disabled = true;
  setStatus(tr('sending'));
  try {
    await submitConsultation(payload(), requestId());
    els.formPanel.hidden = true;
    els.successPanel.hidden = false;
    renderConsultPartners();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    setStatus(err.message || tr('errorGeneric'), 'error');
    els.submit.disabled = false;
  }
}

/* ===== 협력업체 소개 (상담 접수 완료 화면) =====
   상담 페이지는 init 데이터를 쓰지 않으므로 별도로 목록을 받아온다.
   상담 유형 → 예약 상품군으로 옮겨 예약 성공화면과 같은 규칙으로 고른다. */
const CONSULT_TYPE_TO_GROUP = { wedding: 'wed', corporate: 'biz', dol: 'baby', event: 'biz', content: 'biz' };
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

function escapePartnerHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function renderConsultPartners() {
  const host = document.getElementById('consultPartners');
  if (!host) return;
  const group = CONSULT_TYPE_TO_GROUP[state.type] || '';
  if (!group) return;
  let partners = [];
  try {
    const res = await fetchPartners();
    partners = Array.isArray(res?.partners) ? res.partners : [];
  } catch {
    return; // 목록을 못 받으면 조용히 생략 — 접수 완료 화면을 깨뜨리지 않는다
  }
  const list = partners.filter((p) => {
    const placements = Array.isArray(p.placements) ? p.placements : [];
    if (placements.length && !placements.includes('consult')) return false;
    return (Array.isArray(p.groups) ? p.groups : []).includes(group);
  });
  if (!list.length) return;
  const lang = state.lang === 'en' || state.lang === 'de' ? state.lang : 'ko';
  const rows = list.map((p) => {
    const desc = (lang === 'en' ? p.descEn : lang === 'de' ? p.descDe : p.descKo) || p.descKo || '';
    const meta = [p.langs ? (lang === 'ko' ? `상담 ${p.langs}` : p.langs) : '', p.area].filter(Boolean).join(' · ');
    const links = Array.isArray(p.links) && p.links.length ? p.links : (p.url ? [{ kind: p.linkKind || 'web', url: p.url }] : []);
    const ctas = links.map((l) => {
      const label = (PARTNER_CTA_COPY[l.kind] || PARTNER_CTA_COPY.web)[lang];
      return `<a class="partner-cta" href="${escapePartnerHtml(l.url)}" target="_blank" rel="noopener noreferrer" data-partner-id="${escapePartnerHtml(p.id)}" data-partner-link="${escapePartnerHtml(l.kind)}">${escapePartnerHtml(label)} →</a>`;
    }).join('<span class="partner-sep">|</span>');
    return `<div class="partner-item">
        <div class="partner-name">${escapePartnerHtml(p.name)}${meta ? `<span class="partner-meta">${escapePartnerHtml(meta)}</span>` : ''}</div>
        ${desc ? `<div class="partner-desc">${escapePartnerHtml(desc)}</div>` : ''}
        <div class="partner-ctas">${ctas}</div>
      </div>`;
  }).join('');
  host.innerHTML = `<h3 class="partner-title">${PARTNER_BLOCK_COPY.title[lang]}</h3>${rows}<p class="partner-note">${PARTNER_BLOCK_COPY.note[lang]}</p>`;
  host.hidden = false;
}

document.addEventListener('click', (event) => {
  const link = event.target?.closest?.('a.partner-cta[data-partner-id]');
  if (!link) return;
  pingPartnerClick({
    partnerId: link.getAttribute('data-partner-id'),
    linkKind: link.getAttribute('data-partner-link') || '',
    source: 'consult',
    lang: state.lang || '',
    itemGroup: CONSULT_TYPE_TO_GROUP[state.type] || ''
  });
});

function bindLanguageControls() {
  els.langButtons.forEach((button) => {
    button.addEventListener('click', () => setLanguage(button.dataset.lang));
  });
  els.form.elements.lang.addEventListener('change', (event) => setLanguage(event.target.value));
}

function init() {
  bindLanguageControls();
  applyLanguage();
  renderStaticOptions();
  renderTypeGrid();
  renderDynamicQuestions();
  renderPriorityGroup();
  els.form.addEventListener('submit', handleSubmit);
}

init();
