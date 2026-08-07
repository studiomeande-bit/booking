export const PRINT_NONE_ID = 'print_none';
export const BASIC_10X15_ID = 'basic_10x15';

const PRINT_SIZE_LABELS = {
  none: {
    ko: '출력 없음',
    en: 'No print',
    de: 'Kein Druck'
  },
  basic10x15: {
    ko: '6×4 inch / 10×15cm',
    en: '6×4 inch / 10×15cm',
    de: '6×4 inch / 10×15cm'
  },
  a4: {
    ko: 'A4',
    en: 'A4',
    de: 'A4'
  },
  a3: {
    ko: 'A3',
    en: 'A3',
    de: 'A3'
  }
};

const ORIGINALS_COPY = {
  allCloud: {
    ko: '원본 전체 클라우드 전송',
    en: 'All originals delivered via cloud',
    de: 'Alle Originale per Cloud'
  },
  colorCloud: {
    ko: '원본 색보정본 전체 클라우드 전송',
    en: 'All color-corrected originals delivered via cloud',
    de: 'Alle farbkorrigierten Originale per Cloud'
  },
  allDelivered: {
    ko: '원본 전체 전달',
    en: 'All originals delivered',
    de: 'Alle Originale inklusive'
  },
  digitalFile: {
    ko: '디지털 파일 포함',
    en: 'Digital file included',
    de: 'Digitale Datei inklusive'
  }
};

const VIDEO_COPY = {
  threeMinute: {
    ko: '3분 영상 1편',
    en: 'One 3-minute video',
    de: 'Ein 3-Minuten-Video'
  }
};

export const PRODUCT_DELIVERY_SPECS = [
  {
    id: 'pass',
    group: 'pass',
    aliases: ['여권/비자', 'passport/visa', 'passfoto/visum'],
    originals: ORIGINALS_COPY.digitalFile,
    printSummary: {
      ko: '한국 8장 · 독일 QR 코드 또는 출력 8장 · 기타 국가는 국가마다 상이',
      en: 'Korea: 8 prints · Germany: E-passbild QR code or 8 prints · Other countries: varies by country',
      de: 'Korea: 8 Ausdrucke · Deutschland: E-Passbild-QR-Code oder 8 Ausdrucke · andere Länder: je nach Land unterschiedlich'
    },
    prints: [
      { id: 'passport_country', qty: 1, label: { ko: '국가별 규격 출력', en: 'Country-specific print set', de: 'Länderspezifisches Druckset' } }
    ]
  },
  {
    id: 'pb',
    group: 'prof',
    aliases: ['프로필 basic', 'profile basic', 'profil basic'],
    originals: ORIGINALS_COPY.allCloud,
    retouchCount: 1,
    prints: [{ id: BASIC_10X15_ID, qty: 1, label: PRINT_SIZE_LABELS.basic10x15 }]
  },
  {
    id: 'pbus',
    group: 'prof',
    aliases: ['프로필 business', 'profile business', 'profil business'],
    originals: ORIGINALS_COPY.allCloud,
    retouchCount: 2,
    prints: [{ id: BASIC_10X15_ID, qty: 2, label: PRINT_SIZE_LABELS.basic10x15 }]
  },
  {
    id: 'pp',
    group: 'prof',
    aliases: ['프로필 professional', 'profile professional', 'profil professional'],
    originals: ORIGINALS_COPY.allCloud,
    retouchCount: 3,
    prints: [{ id: BASIC_10X15_ID, qty: 3, label: PRINT_SIZE_LABELS.basic10x15 }]
  },
  {
    id: 'sb',
    group: 'stud',
    aliases: ['스튜디오 basic', 'studio basic'],
    originals: ORIGINALS_COPY.allCloud,
    retouchCount: 3,
    prints: [
      { id: 'basic_a4', qty: 1, label: PRINT_SIZE_LABELS.a4 },
      { id: BASIC_10X15_ID, qty: 2, label: PRINT_SIZE_LABELS.basic10x15 }
    ]
  },
  {
    id: 'sp',
    group: 'stud',
    aliases: ['스튜디오 plus', 'studio plus'],
    originals: ORIGINALS_COPY.allCloud,
    retouchCount: 5,
    prints: [
      { id: 'basic_a4', qty: 1, label: PRINT_SIZE_LABELS.a4 },
      { id: BASIC_10X15_ID, qty: 4, label: PRINT_SIZE_LABELS.basic10x15 }
    ]
  },
  {
    id: 'sprm',
    group: 'stud',
    aliases: ['스튜디오 premium', 'studio premium'],
    originals: ORIGINALS_COPY.allCloud,
    retouchCount: 7,
    prints: [
      { id: 'basic_a4', qty: 1, label: PRINT_SIZE_LABELS.a4 },
      { id: BASIC_10X15_ID, qty: 6, label: PRINT_SIZE_LABELS.basic10x15 }
    ]
  },
  {
    id: 'ob',
    group: 'snap',
    aliases: ['야외/홈스냅 basic', 'outdoor/home basic'],
    originals: ORIGINALS_COPY.colorCloud,
    retouchCount: 7,
    prints: [{ id: BASIC_10X15_ID, qty: 5, label: { ko: '10×15cm', en: '10×15cm', de: '10×15cm' } }]
  },
  {
    id: 'op',
    group: 'snap',
    aliases: ['야외/홈스냅 plus', 'outdoor/home plus'],
    originals: ORIGINALS_COPY.colorCloud,
    retouchCount: 10,
    prints: [{ id: BASIC_10X15_ID, qty: 7, label: PRINT_SIZE_LABELS.basic10x15 }]
  },
  {
    id: 'oprm',
    group: 'snap',
    aliases: ['야외/홈스냅 premium', 'outdoor/home premium'],
    originals: ORIGINALS_COPY.colorCloud,
    retouchCount: 20,
    prints: [{ id: BASIC_10X15_ID, qty: 10, label: PRINT_SIZE_LABELS.basic10x15 }]
  },
  {
    id: 'wp',
    group: 'wed',
    aliases: ['프리웨딩 plus', 'pre-wedding plus'],
    originals: ORIGINALS_COPY.colorCloud,
    retouchCount: 30,
    prints: [
      { id: 'premium_a3', qty: 1, label: PRINT_SIZE_LABELS.a3 },
      { id: 'basic_a4', qty: 2, label: PRINT_SIZE_LABELS.a4 },
      { id: BASIC_10X15_ID, qty: 3, label: PRINT_SIZE_LABELS.basic10x15 }
    ]
  },
  {
    id: 'wprm',
    group: 'wed',
    aliases: ['프리웨딩 premium', 'pre-wedding premium'],
    originals: ORIGINALS_COPY.colorCloud,
    retouchCount: 40,
    video: VIDEO_COPY.threeMinute,
    prints: [
      { id: 'premium_a3', qty: 1, label: PRINT_SIZE_LABELS.a3 },
      { id: 'basic_a4', qty: 2, label: PRINT_SIZE_LABELS.a4 },
      { id: BASIC_10X15_ID, qty: 3, label: PRINT_SIZE_LABELS.basic10x15 }
    ]
  },
  {
    id: 'amtp',
    group: 'biz',
    aliases: ['암트 결혼식 사진촬영', 'civil wedding photo', 'standesamt foto'],
    originals: ORIGINALS_COPY.allDelivered,
    retouchCount: 15,
    prints: [{ id: BASIC_10X15_ID, qty: 15, label: { ko: '10×15cm', en: '10×15cm', de: '10×15cm' } }]
  }
];

function normalizeProductToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[._\-()［］\[\]{}+]/g, '');
}

function localize(value, lang = 'ko') {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.ko || value.en || value.de || '';
}

function getInputGroup(input) {
  if (!input || typeof input === 'string') return '';
  return String(input.group || input.g || input.itemGroup || input.category || '').trim().toLowerCase();
}

function getInputTokens(input) {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  return [
    input.id,
    input.itemId,
    input.productId,
    input.product,
    input.productName,
    input.nameKo,
    input.nameEn,
    input.nameDe,
    input.label,
    input.title
  ].filter(Boolean);
}

export function getProductDeliverySpec(input) {
  const tokens = getInputTokens(input);
  const group = getInputGroup(input);
  const normalizedTokens = tokens.map(normalizeProductToken).filter(Boolean);
  const idMatch = normalizedTokens.find((token) => PRODUCT_DELIVERY_SPECS.some((spec) => normalizeProductToken(spec.id) === token));
  if (idMatch) {
    return PRODUCT_DELIVERY_SPECS.find((spec) => normalizeProductToken(spec.id) === idMatch) || null;
  }
  const haystack = normalizedTokens.join(' ');
  return PRODUCT_DELIVERY_SPECS.find((spec) => {
    if (group && spec.group && spec.group !== group) return false;
    const aliases = [spec.id, ...(spec.aliases || [])].map(normalizeProductToken).filter(Boolean);
    return aliases.some((alias) => haystack.includes(alias));
  }) || null;
}

export function productHasFixedDeliverySpec(input) {
  return !!getProductDeliverySpec(input);
}

export function getProductIncludedPrintQuota(input) {
  const spec = getProductDeliverySpec(input);
  if (!spec || !Array.isArray(spec.prints)) return [];
  return spec.prints
    .filter((item) => item.id && item.qty > 0)
    .map((item) => ({ id: item.id, qty: Number(item.qty) || 0 }));
}

export function productHasIncludedPrints(input) {
  return getProductIncludedPrintQuota(input).length > 0;
}

export function formatPrintQuantity(qty, lang = 'ko') {
  const count = Number(qty) || 0;
  if (lang === 'en') return `×${count}`;
  if (lang === 'de') return `×${count}`;
  return `${count}장`;
}

export function formatPrintItem(item, lang = 'ko') {
  const label = localize(item.label, lang) || item.id;
  return `${label} ${formatPrintQuantity(item.qty, lang)}`;
}

export function getProductIncludedPrintSummary(input, lang = 'ko') {
  const spec = getProductDeliverySpec(input);
  if (!spec) return '';
  if (spec.printSummary) return localize(spec.printSummary, lang);
  if (!Array.isArray(spec.prints) || !spec.prints.length) return '';
  return spec.prints.map((item) => formatPrintItem(item, lang)).join(lang === 'ko' ? ' + ' : ' + ');
}

export function getProductDeliveryLines(input, lang = 'ko', options = {}) {
  const spec = getProductDeliverySpec(input);
  if (!spec) return [];
  const lines = [];
  if (spec.originals) lines.push(localize(spec.originals, lang));
  if (spec.retouchCount > 0) {
    lines.push(lang === 'en'
      ? `${spec.retouchCount} retouched photos`
      : lang === 'de'
        ? `${spec.retouchCount} retuschierte Fotos`
        : `보정본 ${spec.retouchCount}장`);
  }
  if (spec.video) lines.push(localize(spec.video, lang));
  const printSummary = getProductIncludedPrintSummary(input, lang);
  if (printSummary) {
    lines.push(lang === 'en'
      ? `Prints included: ${printSummary}`
      : lang === 'de'
        ? `Drucke inklusive: ${printSummary}`
        : `출력물: ${printSummary}`);
  } else if (options.includeNoPrintLine) {
    lines.push(lang === 'en'
      ? 'No prints included'
      : lang === 'de'
        ? 'Keine Drucke inklusive'
        : '출력물: 포함 없음');
  }
  return lines.filter(Boolean);
}

export function getPrintNoneLabel(lang = 'ko') {
  return localize(PRINT_SIZE_LABELS.none, lang);
}
