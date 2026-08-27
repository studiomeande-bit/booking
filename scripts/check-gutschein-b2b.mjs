#!/usr/bin/env node
/**
 * check-gutschein-b2b.mjs — 굿샤인 SPV 체제 보강 검증기
 *
 * 두 가지를 잠근다.
 *
 * ① **B2B 사용 차단** — 우리 굿샤인은 SPV(Einzweck, §3 Abs.14 UStG)라 발행 시점에 전액 과세한다.
 *    그 전제는 공급지가 독일로 확정돼 있다는 것인데, 수령자가 사업자면 §3a Abs.2 로 공급지가
 *    사업자 소재지로 넘어가 **그 건의 SPV 근거가 사후에 무너진다.** 약관에만 '개인 전용'이라
 *    적어 두고 코드가 안 막으면 실효성이 없다.
 *    ⚠️ 'wed'(웨딩)는 일부러 통과시킨다 — 개인 웨딩이 정상적으로 들어가는 그룹이고
 *    우리 계약 체계도 B2C Fotografenvertrag 로 다룬다. 막으면 선물용 굿샤인이 죽는다.
 *
 * ② **매칭보드 오매칭 차단** — 2026-08-13 SumUp €185(TAAA4RS7U33)은 굿샤인 T9Z7-5RKQ-RMG6
 *    판매대금인데 매칭보드가 예약 후보 8건을 전부 1순위로 올렸다(굿샤인↔결제대조 연결 부재).
 *    반대로 08-14 €170(TAAA4SME7RE)은 진짜 예약 입금이라 굿샤인 후보가 0건이어야 한다.
 *
 * 재구현이 아니라 Code.gs **원본 소스를 떼어내** 돌린다.
 * 사용법:  node scripts/check-gutschein-b2b.mjs        (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript/Code.gs'), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} 을 찾지 못했습니다.`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`${name} 본문 끝을 찾지 못했습니다.`);
}
function extractLine(src, needle) {
  const line = src.split('\n').find((l) => l.includes(needle));
  if (!line) throw new Error(`${needle} 선언을 찾지 못했습니다.`);
  return line;
}

const FNS = [
  '_detectBookingBusinessSignal_', '_assertGutscheinAllowedForBooking_',
  'getSettlementGutscheinCandidatesForTx_',
  'normalizeVatMode_', 'isVatExempt_', '_dayCloseBucket_', 'isCashPayMethod_',
  'daysBetweenDates_', 'parseDateOnly_', 'parseDateSafe_',
  'roundCurrency_', 'parseMoneyValue_', 'extractGutscheinCode_', 'isLikelySumupBankIn_',
];

const src = `
const CONFIG={TIMEZONE:'Europe/Berlin',
${extractLine(gs, "BOOKING_HEADERS: ['예약일시'")}
};
const BOOKING_COL=CONFIG.BOOKING_HEADERS.reduce((acc,h,i)=>{acc[h]=i;return acc;},{});
${extractLine(gs, "const GUTSCHEIN_HEADERS=['코드'")}
${extractLine(gs, 'const GUTSCHEIN_COL=GUTSCHEIN_HEADERS.reduce')}
${extractLine(gs, 'const GUTSCHEIN_STATUS=')}
${extractLine(gs, "const VAT_MODE_STANDARD=")}
${extractLine(gs, "const VAT_MODE_EXEMPT_THIRD_COUNTRY=")}
const Logger={log(){}};
/* 날짜 포매터만 스텁 — 원본 formatDateMinute_ 는 모듈 전역 캐시(_fastDateFmtOk_)에 의존한다.
   검증 대상 로직이 아니고, 프로세스 TZ 를 Europe/Berlin 으로 고정했으므로 결과는 동일하다. */
function formatDateMinute_(d){
  const p=(n)=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
}
${FNS.map((n) => extractFn(gs, n)).join('\n')}
export {
  BOOKING_COL, CONFIG, GUTSCHEIN_HEADERS, GUTSCHEIN_COL, GUTSCHEIN_STATUS,
  _detectBookingBusinessSignal_, _assertGutscheinAllowedForBooking_,
  getSettlementGutscheinCandidatesForTx_,
};
`;

const mod = await import(`data:text/javascript;base64,${Buffer.from(src, 'utf8').toString('base64')}`);
const {
  BOOKING_COL, GUTSCHEIN_HEADERS, GUTSCHEIN_COL, GUTSCHEIN_STATUS,
  _detectBookingBusinessSignal_, _assertGutscheinAllowedForBooking_,
  getSettlementGutscheinCandidatesForTx_,
} = mod;

let fail = 0, pass = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass += 1; } else {
    fail += 1;
    console.error(`❌ ${label}\n   기대: ${JSON.stringify(expected)}\n   실제: ${JSON.stringify(actual)}`);
  }
}
function checkTruthy(label, actual) {
  if (actual) { pass += 1; } else { fail += 1; console.error(`❌ ${label} — 값이 비었습니다`); }
}

/* ===================== ① B2B 사용 차단 ===================== */
function mkBooking(fields) {
  const row = new Array(Object.keys(BOOKING_COL).length).fill('');
  Object.keys(fields).forEach((k) => {
    if (BOOKING_COL[k] == null) throw new Error(`알 수 없는 예약 열: ${k}`);
    row[BOOKING_COL[k]] = fields[k];
  });
  return row;
}
const blocked = (f) => _detectBookingBusinessSignal_(mkBooking(f)) !== '';

check('개인 스튜디오 예약은 통과', blocked({ 고객명: '김민', 촬영종류: 'stud' }), false);
check('개인 웨딩(wed)은 통과 — B2C 다', blocked({ 고객명: '이슬', 촬영종류: 'wed' }), false);
check('여권(pass)도 통과', blocked({ 고객명: '박', 촬영종류: 'pass' }), false);
check('기업·행사(biz)는 차단', blocked({ 고객명: 'SkyinQ', 촬영종류: 'biz' }), true);
check('사업자송장필요=Y 는 차단', blocked({ 고객명: '휘슬러', 촬영종류: 'stud', 사업자송장필요: 'Y' }), true);
check('사업자송장필요 빈값은 통과', blocked({ 고객명: '김', 촬영종류: 'stud', 사업자송장필요: '' }), false);
check('사업자명 있으면 차단', blocked({ 고객명: '담당자', 촬영종류: 'stud', 사업자명: '호민상사' }), true);
check('USt-IdNr 있으면 차단', blocked({ 고객명: '담당자', 촬영종류: 'stud', 사업자VAT번호: 'LU12345678' }), true);
check('§3a 면세(netto) 발행건은 차단',
  blocked({ 고객명: '해외기업', 촬영종류: 'stud', 부가세모드: 'exempt_third_country' }), true);
check('일반 부가세모드는 통과', blocked({ 고객명: '김', 촬영종류: 'stud', 부가세모드: 'standard' }), false);

// 사유 문구가 고객에게 나가는 형태인지
const bizMsg = (() => {
  try { _assertGutscheinAllowedForBooking_(mkBooking({ 고객명: 'X', 촬영종류: 'biz' })); return ''; }
  catch (e) { return e.message; }
})();
checkTruthy('biz 차단 시 throw', bizMsg);
check('에러 문구에 약관 근거 포함', bizMsg.includes('개인 고객 전용'), true);
check('에러 문구에 사유 포함', bizMsg.includes('기업·행사'), true);
check('wed 은 throw 하지 않는다', (() => {
  try { _assertGutscheinAllowedForBooking_(mkBooking({ 고객명: '이슬', 촬영종류: 'wed' })); return 'ok'; }
  catch (e) { return e.message; }
})(), 'ok');

/* ===================== ② 매칭보드 오매칭 차단 ===================== */
function mkG(fields) {
  const row = new Array(GUTSCHEIN_HEADERS.length).fill('');
  Object.keys(fields).forEach((k) => {
    if (GUTSCHEIN_COL[k] == null) throw new Error(`알 수 없는 굿샤인 열: ${k}`);
    row[GUTSCHEIN_COL[k]] = fields[k];
  });
  return row;
}
const ROWS = [
  // 실제 사고 건 — 왕예원 €185 판매, 카드
  { row: mkG({ 코드: 'T9Z7-5RKQ-RMG6', 상태: GUTSCHEIN_STATUS.SOLD, '발행금액(€)': 185,
    판매등록일: '2026-08-13', 결제수단: '카드', 구매자명: '왕예원' }), rowIndex: 2 },
  // 취소된 합성 테스트 건 — 후보로 잡히면 안 된다
  { row: mkG({ 코드: 'KPDF-0000-0000', 상태: GUTSCHEIN_STATUS.CANCELLED, '발행금액(€)': 30,
    판매등록일: '2026-08-13', 결제수단: '카드' }), rowIndex: 3 },
  // 잔액 이월행 — 입금이 존재하지 않는다
  { row: mkG({ 코드: 'RESI-0000-0000', 상태: GUTSCHEIN_STATUS.SOLD, '발행금액(€)': 185,
    판매등록일: '2026-08-13', 결제수단: '카드', 발행방식: 'residual' }), rowIndex: 4 },
  // 이미 정산행에 연결된 건
  { row: mkG({ 코드: 'DONE-0000-0000', 상태: GUTSCHEIN_STATUS.SOLD, '발행금액(€)': 185,
    판매등록일: '2026-08-13', 결제수단: '카드', 정산행: 9 }), rowIndex: 5 },
  // 재고(미판매)
  { row: mkG({ 코드: 'STOK-0000-0000', 상태: GUTSCHEIN_STATUS.STOCK, '발행금액(€)': 185,
    발행일: '2026-08-13', 결제수단: '카드' }), rowIndex: 6 },
];
const tx = (o) => Object.assign({ source: 'sumup', date: '', gross: 0, paymentRef: '', counterparty: '', description: '' }, o);

const hit185 = getSettlementGutscheinCandidatesForTx_(
  tx({ date: '2026-08-13', gross: 185, paymentRef: 'TAAA4RS7U33' }), ROWS);
check('08-13 €185 → 굿샤인 후보 정확히 1건', hit185.length, 1);
check('08-13 €185 → 그 후보가 T9Z7 이다', hit185[0] && hit185[0].code, 'T9Z7-5RKQ-RMG6');
check('취소·이월·연결완료·재고는 후보에서 제외',
  hit185.map((c) => c.code).filter((c) => c !== 'T9Z7-5RKQ-RMG6'), []);

// 오탐 방지 — 08-14 €170 은 진짜 예약 입금(Annielyn Martin row242)
const hit170 = getSettlementGutscheinCandidatesForTx_(
  tx({ date: '2026-08-14', gross: 170, paymentRef: 'TAAA4SME7RE' }), ROWS);
check('08-14 €170 → 굿샤인 후보 0건 (오탐 방지)', hit170.length, 0);

check('±3일 밖이면 후보 아님',
  getSettlementGutscheinCandidatesForTx_(tx({ date: '2026-08-20', gross: 185 }), ROWS).length, 0);
check('±3일 안이면 후보',
  getSettlementGutscheinCandidatesForTx_(tx({ date: '2026-08-16', gross: 185 }), ROWS).length, 1);
check('결제수단 계열 불일치(은행 tx vs 카드 굿샤인)면 후보 아님',
  getSettlementGutscheinCandidatesForTx_(
    tx({ source: 'deutschebank', date: '2026-08-13', gross: 185 }), ROWS).length, 0);
check('SumUp 묶음 payout 은 개별 굿샤인에 붙지 않는다',
  getSettlementGutscheinCandidatesForTx_(
    tx({ source: 'deutschebank', date: '2026-08-13', gross: 185, counterparty: 'SumUp Payments Limited' }), ROWS).length, 0);
check('출금(gross<=0)은 후보 아님',
  getSettlementGutscheinCandidatesForTx_(tx({ date: '2026-08-13', gross: -185 }), ROWS).length, 0);

// 결제참조 정확일치는 금액이 달라도 잡아야 한다 (수수료 차감 등)
const REF_ROWS = [{ row: mkG({ 코드: 'REFX-0000-0000', 상태: GUTSCHEIN_STATUS.SOLD, '발행금액(€)': 185,
  판매등록일: '2026-08-13', 결제수단: '카드', 결제참조: 'TAAA4RS7U33' }), rowIndex: 2 }];
const refHit = getSettlementGutscheinCandidatesForTx_(
  tx({ date: '2026-09-30', gross: 180.5, paymentRef: 'TAAA4RS7U33' }), REF_ROWS);
check('결제참조 정확일치는 금액·날짜가 달라도 잡는다', refHit.length, 1);
check('정확일치 후보는 exactRef 표시', refHit[0] && refHit[0].exactRef, true);

/* ===================== ③ 헤더 append 안전성 ===================== */
check('결제참조·정산행은 맨 뒤 2칸', GUTSCHEIN_HEADERS.slice(-2), ['결제참조', '정산행']);
check('중복 컬럼 없음', new Set(GUTSCHEIN_HEADERS).size, GUTSCHEIN_HEADERS.length);
// 기존 컬럼 인덱스가 밀리지 않았는지 — 밀리면 실데이터가 깨진다
check('코드 idx 불변', GUTSCHEIN_COL['코드'], 0);
check('최종사용확정일시 idx 불변', GUTSCHEIN_COL['최종사용확정일시'], 49);
check('옵션키 idx 불변(동시세션 @872~874)', GUTSCHEIN_COL['옵션키'], 50);
check('인원 idx 불변(동시세션 @872~874)', GUTSCHEIN_COL['인원'], 51);
check('결제참조 idx', GUTSCHEIN_COL['결제참조'], 52);
check('정산행 idx', GUTSCHEIN_COL['정산행'], 53);

/* ===================== ④ 이중계상 방지 (SPV) ===================== */
// 상환 시점에 매출을 다시 잡으면 이중계상이다. 장부 패스가 recognition==='issue' 에서
// 판매등록일 기준으로만 매출을 만들고, 이월행은 제외하는지 소스로 확인한다.
check('장부: 이월행(residual)은 매출에서 제외',
  /발행방식[^\n]*==='residual'\)\s*return;/.test(gs), true);
check('장부: SPV 는 판매등록일 기준 발행시점 과세',
  gs.includes("gLabel='굿샤인판매'"), true);
check('정산 매칭 회계분류는 굿샤인 매출 (비매출입금 아님)',
  gs.includes("accountingClass:'굿샤인 매출',\n    memo:['굿샤인 판매대금'"), true);

console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
