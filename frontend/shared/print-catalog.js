// 인화 사이즈·추가 단가 카탈로그 — 예약(booking) 안내용 단일 소스.
// cm 표기는 여기에만 있다(예약 때 고객에게 사이즈를 cm로 미리 안내하기 위함).
//
// ⚠ 가격(additional)은 주문 계산의 실제 출처인 select/v2/select.js 의 PRINT_OPTIONS[].additional 와
//    반드시 동일해야 한다. **정의처는 6곳**이고 scripts/check-print-prices.mjs 가 전수 대조한다
//    (Code.gs PRINT_LABELS · AdminV2 PRINT_PRICES · select v2 PRINT_OPTIONS · 이 파일 ·
//     인보이스 라벨 서버↔어드민 쌍 · print-tier-copy PRINT_ID_TIER). 배포 전 반드시 실행할 것.
//    external:true = 외주 발주 항목. 인화앱 로컬 출력 큐에서 제외된다(2026-09-10 월아트 Phase 0).
//    (셀렉 PRINT_OPTIONS 를 이 모듈로 통합하는 리팩터는 후속 과제 — 지금은 셀렉 주문 흐름을 건드리지 않음)
//
// 포토카드 실측: 지갑 카드(ID-1) 크기 = 8.6 × 5.4 cm (사장님 확인, 2026-07-26).
// A4=21×29.7 · A3=29.7×42 · A3+=32.9×48.3 cm (표준 규격).

import { getPrintTier, getPrintTierName } from './print-tier-copy.js';

export const PRINT_CATALOG = [
  { id: 'basic_10x15',     cm: '10 × 15 cm',    additional: 4,  name: { ko: '시그니처 10×15cm', en: 'Signature 10×15cm',      de: 'Signature-Abzug 10×15cm' } },
  { id: 'premium_10x15',   cm: '10 × 15 cm',    additional: 8,  name: { ko: '파인아트 10×15cm', en: 'Fine Art 10×15cm',        de: 'FineArt-Druck 10×15cm' } },
  { id: 'photocard_single', cm: '8.6 × 5.4 cm', additional: 6,  name: { ko: '포토카드 (단면)',  en: 'Photocard (single-side)', de: 'Fotokarte (einseitig)' } },
  { id: 'photocard_double', cm: '8.6 × 5.4 cm', additional: 9,  name: { ko: '포토카드 (양면)',  en: 'Photocard (double-side)', de: 'Fotokarte (beidseitig)' } },
  { id: 'basic_a4',        cm: '21 × 29.7 cm',  additional: 15, name: { ko: '시그니처 A4',     en: 'Signature A4',            de: 'Signature-Abzug A4' } },
  { id: 'premium_a4',      cm: '21 × 29.7 cm',  additional: 20, name: { ko: '파인아트 A4',      en: 'Fine Art A4',             de: 'FineArt-Druck A4' } },
  { id: 'premium_a3',      cm: '29.7 × 42 cm',  additional: 38, name: { ko: '파인아트 A3',      en: 'Fine Art A3',             de: 'FineArt-Druck A3' } },
  { id: 'premium_a3plus',  cm: '32.9 × 48.3 cm', additional: 48, name: { ko: '파인아트 A3+',    en: 'Fine Art A3+',            de: 'FineArt-Druck A3+' } },
  // 액자(추가금) — 인화 위에 얹는 완성품. cm 는 프레임 외곽 규격이다.
  { id: 'frame_a4',        cm: '30 × 40 cm',    additional: 29, name: { ko: '액자 (A4 인화용)',  en: 'Frame (for A4 print)',    de: 'Rahmen (für A4-Druck)' } },
  { id: 'frame_a3',        cm: '40 × 50 cm',    additional: 35, name: { ko: '액자 (A3 인화용)',  en: 'Frame (for A3 print)',    de: 'Rahmen (für A3-Druck)' } },
  // 대형·특별 규격(견적형). cm 는 고정 규격이 없어 '상담' 으로 둔다 — 업체 카탈로그가 규격을 정한다.
  { id: 'wallart_custom',  cm: '상담 후 확정',    additional: 0,  external: true, name: { ko: '대형·특별 규격 (견적)', en: 'Large format (quote)', de: 'Großformat (Angebot)' } }
];

// 카탈로그 항목의 현지화된 이름.
export function printCatalogName(item, lang) {
  return (item && item.name && (item.name[lang] || item.name.ko)) || '';
}

/* 등급(grade)은 여기에 리터럴로 복제하지 않고 print-tier-copy.js 의 PRINT_ID_TIER 에서 파생시킨다.
   이 도메인은 이미 가격 정의처가 5곳이라 드리프트로 여러 번 깨졌다 — 등급 매핑까지 2벌이 되면
   리네이밍 때 또 어긋난다. 단일 소스는 print-tier-copy.js. */
export function printCatalogGrade(item) {
  return getPrintTier(item && item.id);
}

// 등급 라벨('시그니처 인화' 등) — 예약 아코디언의 섹션 헤더용.
export function printCatalogGradeLabel(grade, lang) {
  return getPrintTierName(grade, lang);
}

// 등급별로 묶은 카탈로그. 품목이 늘어도 템플릿을 건드리지 않도록 데이터 주도로 그룹핑한다.
export function groupPrintCatalogByGrade() {
  const order = ['signature', 'fineart', 'photocard'];
  return order
    .map((grade) => ({ grade, items: PRINT_CATALOG.filter((item) => printCatalogGrade(item) === grade) }))
    .filter((group) => group.items.length > 0);
}
