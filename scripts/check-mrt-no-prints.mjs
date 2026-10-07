#!/usr/bin/env node
/**
 * check-mrt-no-prints.mjs — 마이리얼트립 셀렉에는 출력(인화) 옵션이 없다
 *
 * 왜 필요한가(2026-09-29 사장님 확정): 마이리얼트립 촬영은 보정본 파일 전달로 끝난다. 그런데 셀렉 화면은
 *   서버가 requiresDelivery:false 를 보내도 고객이 **유료 인화를 직접 추가**할 수 있었고(그러면 수령방식·픽업
 *   메일까지 열렸다), 셀렉 링크 메일도 모든 고객에게 "인화 사이즈 설정" 을 안내했다.
 *   ① 판정(셀렉 촬영종류·상품 + 예약 결제수단 — 결제수단만 MRT 인 snap 행이 실재) ② 서버 거절(구 번들·조작 payload)
 *   ③ 화면(출력 단계·포토카드·수령방식 숨김) ④ 메일·승인 페이지 문구 — 넷 중 하나라도 빠지면 다시 새어 나간다.
 *
 * 어떻게: Code.gs 를 GAS 스텁과 함께 통째로 올려 진짜 selectRowIsMyRealTrip_·sendSelectLinkEmail_ 을 돌리고,
 *   제출 가드·세션 플래그·셀렉 화면·셔틀 생성본은 소스 구조로 대조한다.
 *
 * 사용법:  node scripts/check-mrt-no-prints.mjs       (불일치 시 exit 1)
 */
process.env.TZ = 'Europe/Berlin';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(ROOT, 'appscript', 'Code.gs'), 'utf8');
const pub = readFileSync(join(ROOT, 'appscript-public', 'Public.gs'), 'utf8');
const selectJs = readFileSync(join(ROOT, 'frontend', 'select', 'v2', 'select.js'), 'utf8');
const i18nSrc = readFileSync(join(ROOT, 'frontend', 'select', 'v2', 'i18n.js'), 'utf8');

const nope = (n) => new Proxy({}, { get: () => () => { throw new Error(`${n} 스텁 — 닿으면 안 되는 경로`); } });
const fmt = (d, tz, p) => {
  const q = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return p.replace('yyyy', q.year).replace('MM', q.month).replace('dd', q.day).replace('HH', q.hour).replace('mm', q.minute).replace('ss', q.second);
};
Object.assign(globalThis, {
  Utilities: { formatDate: fmt }, SpreadsheetApp: nope('SpreadsheetApp'), DriveApp: nope('DriveApp'),
  CalendarApp: nope('CalendarApp'), MailApp: nope('MailApp'), GmailApp: nope('GmailApp'), UrlFetchApp: nope('UrlFetchApp'),
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' }, Logger: { log() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'stub' }) }, HtmlService: {}, MimeType: {},
});
const dir = mkdtempSync(join(tmpdir(), 'mrtnp-'));
const modPath = join(dir, 'code.cjs');
writeFileSync(modPath, `${gs}
var __PAY__='';var __SENT__=[];
function getSelectBookingPayMethodFromRow_(row){return __PAY__;}
function getSettingsMap_(){return {};}
function getCachedProducts_(){return [];}
function getPromoProducts_(){return [];}
function sendTrackedEmail_(m){__SENT__.push(m);return true;}
module.exports={selectRowIsMyRealTrip_,sendSelectLinkEmail_,selectMrtNoPrintsMsg_,SELECT_HEADERS,SELECT_COL,
  __pay:function(v){__PAY__=v;},__sent:function(){return __SENT__;}};`);
const M = (await import(pathToFileURL(modPath).href)).default;
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (cond, label, got) => {
  if (cond) return;
  fail++;
  console.error(`  ✗ ${label}${got === undefined ? '' : ` — 실제: ${JSON.stringify(got)}`}`);
};
const body = (src, name) => { const i = src.indexOf(`function ${name}(`); return i < 0 ? '' : src.slice(i, src.indexOf('\nfunction ', i + 10)); };

// ── 1) 판정 ────────────────────────────────────────────────────────────────
{
  const C = M.SELECT_COL;
  const row = (group, product) => { const r = new Array(M.SELECT_HEADERS.length).fill(''); r[C['촬영종류']] = group; r[C['상품']] = product; r[C['예약장부행']] = 157; return r; };
  ok(M.selectRowIsMyRealTrip_(row('마이리얼트립', '1인스냅 60분'), ''), "촬영종류 '마이리얼트립'(자동 등록) → MRT");
  ok(M.selectRowIsMyRealTrip_(row('snap', '마이리얼트립'), ''), "상품 '마이리얼트립'(구 행) → MRT");
  ok(M.selectRowIsMyRealTrip_(row('snap', '2인스냅 45분'), '마이리얼트립'), '촬영종류 snap 이어도 예약 결제수단이 마이리얼트립이면 MRT(유성현 사례)');
  M.__pay('마이리얼트립');
  ok(M.selectRowIsMyRealTrip_(row('snap', '2인스냅 45분')), '결제수단을 안 넘기면 예약행에서 읽는다(제출 가드 경로)');
  M.__pay('');
  ok(!M.selectRowIsMyRealTrip_(row('snap', '야외 스냅 Basic'), '카드'), '일반 스냅 → MRT 아님');
  ok(!M.selectRowIsMyRealTrip_(row('stud', '스튜디오 Basic'), ''), '스튜디오 → MRT 아님');
  for (const [L, re] of [['ko', /출력\(인화\) 옵션이 없습니다/], ['en', /do not include prints/], ['de', /enthalten keine Abzüge/]]) {
    const rr = row('마이리얼트립', '1인스냅 60분'); rr[C['언어']] = L;
    ok(re.test(M.selectMrtNoPrintsMsg_(rr)), `${L}: 거절 문구가 고객 언어로 나간다`, M.selectMrtNoPrintsMsg_(rr));
  }
  ok(!M.selectRowIsMyRealTrip_(row('reprint', '재인화'), '마이리얼트립'), '재인화 세션은 사장님이 만든 예외 — 출력 허용(안 그러면 보정·출력 둘 다 없는 빈 세션)');
}

// ── 2) 셀렉 링크 메일 ───────────────────────────────────────────────────────
{
  const send = (data) => { M.sendSelectLinkEmail_(Object.assign({ name: '테스트', email: 't@example.com', lang: 'ko' }, data), 'https://select.example/x', 'https://drive.example/x', 5, 10, 5); return M.__sent().pop(); };
  for (const lang of ['ko', 'en', 'de']) {
    const mrt = send({ lang, itemGroup: '마이리얼트립', product: '1인스냅 60분', payMethod: '마이리얼트립', isResend: true });
    const txt = String(mrt && mrt.htmlBody || '').replace(/<[^>]+>/g, ' ');
    const stripped = txt.replace(/출력물\(인화\) 없이|do not include prints|enthalten keine Abzüge/g, '');   // '출력 없음' 고지 자체는 허용
    ok(mrt && !/인화|print|Druck|Abzug|Abzüge/i.test(stripped), `${lang}: MRT 링크 메일에 인화 안내·단계 없음`, (stripped.match(/.{0,40}(인화|print|Druck|Abz).{0,40}/i) || [''])[0]);
    ok(/출력물\(인화\) 없이|do not include prints|enthalten keine Abzüge/.test(txt), `${lang}: MRT 링크 메일이 '출력물 없음·파일 전달' 을 알린다`);
    const stud = send({ lang, itemGroup: 'stud', product: '스튜디오 Basic', payMethod: '' });
    const stxt = String(stud && stud.htmlBody || '').replace(/<[^>]+>/g, ' ');
    ok(/인화|print|Druck/i.test(stxt), `${lang}: 일반 세션 링크 메일은 인화 안내 그대로`);
  }
  const snapPay = send({ itemGroup: 'snap', product: '2인스냅 45분', payMethod: '마이리얼트립' });
  ok(!/인화 사이즈|추가 인화 입력/.test(String(snapPay && snapPay.htmlBody || '')), '결제수단만 MRT 인 snap 세션도 링크 메일에서 인화 안내 없음');
}

// ── 3) 서버 배선(소스 구조) ─────────────────────────────────────────────────
{
  const guard = /if\(\(\(printsToStore\|\|\[\]\)\.length\|\|photocard\|\|\(\(printUpgrade&&printUpgrade\.items\)\|\|\[\]\)\.length\)&&selectRowIsMyRealTrip_\(row\)\) return\{ok:false,message:selectMrtNoPrintsMsg_\(row\)\};/;
  for (const fn of ['submitPhotoSelection', 'updatePhotoSelection']) {
    const b = body(gs, fn);
    const gi = b.search(guard), vi = b.indexOf('validateSelectDelivery_('), wi = b.indexOf("getRange(rowNum,SELECT_COL['제출일시']+1,1,9)");
    ok(gi > -1 && gi < vi && gi < wi, `${fn}: 출력·포토카드가 실린 MRT 제출은 수령방식 검증·시트 쓰기 전에 거절`, [gi, vi, wi]);
  }
  ok(/printsDisabled:selectRowIsMyRealTrip_\(row,bookingPayMethod\)/.test(body(gs, 'getSelectSession')), '셀렉 세션 payload 에 printsDisabled');
  ok(/printsDisabled:selectRowIsMyRealTrip_\(row,bookingPayMethod\)/.test(body(pub, 'getSelectSession')) && /function selectRowIsMyRealTrip_\(/.test(pub), '셔틀(Public.gs 생성본)도 printsDisabled 를 싣는다 — build-public-api 재생성 필요');
  ok(/if\(selectRowIsMyRealTrip_\(rows\[idx\+1\]\)\) return\{ok:false,message:selectMrtNoPrintsMsg_\(rows\[idx\+1\]\)\}/.test(body(gs, 'submitCustomerPrintOrder_')), '고객 셀프 출력주문(공개 경로)도 MRT 거절');
  ok(/if\(b2bRow>=2&&!String\(data\.payMethod\|\|''\)\.trim\(\)\)\{\s*try\{ data\.payMethod=String\(getDbSheet\(\)\.getRange\(b2bRow,BOOKING_COL\['결제수단'\]\+1\)/.test(body(gs, 'createSelectSession')), '셀렉 링크 생성: 결제수단을 안 넘기면 예약행에서 채운다(결제수단만 MRT 인 스냅 → 링크 메일 인화 안내 없음)');
  ok(/selectRowIsMyRealTrip_\(row\)\s*\?\s*\{ko:'<h2[^']*최종 승인이 완료되었습니다!<\/h2><p>보정본 전달을 마쳤습니다/.test(body(gs, 'approveRetouch_')), "보정본 승인 페이지: MRT 에 '인화 작업을 진행' 이라고 하지 않는다");
}

// ── 4) 셀렉 화면(소스 구조) ─────────────────────────────────────────────────
{
  const np = body(selectJs, 'isNoPrintSession');
  ok(/hasOwnProperty\.call\(session, 'printsDisabled'\)\) return session\.printsDisabled === true;/.test(np) && /isReprintSession\(\)\) return false;/.test(np), '화면 판정: 서버 printsDisabled 정본, 재인화 제외');
  const go = body(selectJs, 'goStep');
  ok(/if \(step === 3 && isNoPrintSession\(\)\) \{\s*if \(state\.step > 3\) return goStep\(2\);\s*if \(!validateStep2\(\)\) \{ showBlockedModal\(collectStepProblems\(2\)\); return; \}\s*return goStep\(4\);/.test(go), '출력 단계 건너뛰기 — 앞으로 갈 땐 2단계 검사 먼저');
  ok(/noPrint && index === 3 \? ' hidden' : ''/.test(go), '진행 점: 출력 단계 점 숨김(goStep 이 className 을 다시 써도)');
  ok(/if \(isNoPrintSession\(\)\) \{ state\.prints = \[\]; state\.photocard = normalizePhotocardSelection\(null\); \}/.test(body(selectJs, 'hydrateSession')), '세션 로드: 저장된 출력·포토카드 비움');
  ok(/^function hasIncludedPhotocard\(\) \{\n  if \(isNoPrintSession\(\)\) return false;/m.test(selectJs), '포함 포토카드 없음');
  ok(/if \(isReprintSession\(\) \|\| isNoPrintSession\(\)\) return false;/.test(body(selectJs, 'requiresDeliverySelection')), '수령방식(픽업·우편) 선택 없음');
  ok(/^function getSessionIncludedPrintQuota\(session = state\.session\) \{\n  if \(isNoPrintSession\(\)\) return \[\];/m.test(selectJs), '포함 출력 쿼터 없음(최종 확인의 미사용 경고 포함)');
  ok(/\.\.\.\(isNoPrintSession\(\) \? \[\] : state\.prints\)\.map\(/.test(body(selectJs, 'onSubmit')), '제출 payload 에 출력 줄 없음');
  const ui = body(selectJs, 'applyNoPrintUi');
  ok(/swap\(document\.getElementById\('step2NextBtn'\), 'i18n', 'step3Next'\)/.test(ui) && /'heroLedeNoPrint'/.test(ui) && /'s2CopyHtmlNoPrint'/.test(ui) && /'process4HtmlNoPrint'/.test(ui), "화면 문구: 다음 버튼·안내가 '출력' 을 말하지 않는다(i18n 키 교체 — 언어 전환에도 유지)");
  ok(/printPickerMode === 'assign' \? c\.assignPickerTitle : c\.printPickerTitle/.test(selectJs), "보정 칸 픽커 제목이 '출력할 사진 선택' 이 아니다");
  ok(/applyNoPrintUi\(\);/.test(body(selectJs, 'hydrateSession')), 'applyNoPrintUi 를 세션 로드 때 부른다');
  ok(/swap\(document\.querySelector\('\[data-i18n-html="s1CopyHtml"\]'\), 'i18nHtml', 's1CopyHtmlNoPrint'\)/.test(ui), "1단계 안내(ko '보정·출력은 다음 단계에서')도 교체");
  /* 결제수단만 MRT 인 스냅 행은 상품명으로는 '출력 포함 상품'(야외/홈스냅 Basic → 10×15 5장) — 요약·패키지 안내가 이름으로 출력을 약속하면 안 된다 */
  ok(/^function getIncludedPrintSummary\(session = state\.session\) \{\n  if \(isNoPrintSession\(\)\) return '';/m.test(selectJs), '포함 출력 요약 없음(패키지 안내·포함 출력 콜아웃)');
  const pkg = body(selectJs, 'renderPackageSummary');
  ok(/const hasFixedSpec = !isNoPrintSession\(\) && productHasFixedDeliverySpec\(input\);/.test(pkg), "패키지 안내: '기본 제공 출력물' 줄 없음");
  ok(/\.filter\(\(line\) => !isNoPrintSession\(\) \|\| !\/\^\(출력물\|Prints included\|Drucke inklusive\|No prints included\|Keine Drucke\)\/i\.test\(line\)\)/.test(pkg), "패키지 안내: 상품 전달 줄에서 '출력물:' 제거");
}

// ── 5) 문구 3개국어 ────────────────────────────────────────────────────────
{
  const keys = ['s1CopyHtmlNoPrint', 'heroLedeNoPrint', 'process4HtmlNoPrint', 's2CopyHtmlNoPrint', 'retouchIntroCopyNoPrint', 'errNothingSelectedNoPrint', 'warnReviewAgainNoPrint', 'successSummaryLineNoPrint', 'star3DescNoPrint', 'pkgServiceCutHtmlNoPrint', 'serviceCutCopyHtmlNoPrint'];
  const { COPY } = await import(pathToFileURL(join(ROOT, 'frontend', 'select', 'v2', 'i18n.js')).href);
  for (const L of ['ko', 'en', 'de']) {
    const missing = keys.filter((k) => COPY[L][k] === undefined);
    ok(!missing.length, `${L}: 출력 없는 세션 문구 키`, missing);
    ok(typeof COPY[L].assignPickerTitle === 'string' && !/인화|출력|print|Druck/i.test(COPY[L].assignPickerTitle), `${L}: 보정 칸 픽커 제목`);
    ok(!/carried into the retouch list|in die Retusche-Liste übernommen/.test(COPY[L].s1CopyHtml + COPY[L].s1CopyHtmlNoPrint), `${L}: 1단계 안내가 '별점 = 찜 저장만' 과 맞다(별점 사진이 전부 보정 목록으로 가지 않는다)`);
    const all = keys.map((k) => (typeof COPY[L][k] === 'function' ? COPY[L][k](2, 'Y') : String(COPY[L][k] || ''))).join(' ')
      .replace(/출력물\(인화\) 없이|출력물\(인화\)이 없고|do not include prints|has no prints|enthalten keine Abzüge|enthält keine Abzüge/g, '');   // '출력 없음' 고지는 허용
    ok(!/인화|print|Druck|Abzug|Abzüge|10×15/i.test(all), `${L}: 출력 없는 세션 문구가 인화를 약속·권유하지 않는다(서비스 컷 무료 인화 포함)`, (all.match(/.{0,30}(인화|print|Druck|Abz|10×15).{0,30}/i) || [''])[0]);
  }
  ok(/c\[npKey\('pkgServiceCutHtml'\)\]\(getServiceCutCount\(\)\)/.test(selectJs) && /c\[npKey\('serviceCutCopyHtml'\)\]/.test(selectJs), '서비스 컷 안내: 출력 없는 세션엔 무료 인화 문구 없음');
  ok(i18nSrc.includes('successSummaryLineNoPrint: (photos, consent) =>'), '성공 요약: 출력 건수 없는 형태');
}

if (fail) { console.error(`\n✗ 마이리얼트립 출력 없음 검사 실패 ${fail}건`); process.exit(1); }
console.log('✓ 마이리얼트립 출력 없음 — 판정·서버 거절·세션 플래그(셔틀 포함)·화면·메일·승인 페이지 전부 일치');
