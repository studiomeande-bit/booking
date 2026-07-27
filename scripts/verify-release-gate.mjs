#!/usr/bin/env node
/**
 * verify-release-gate.mjs — Update 4 릴리스 게이트 중 "회귀" 항목 자동 검증
 *
 * 왜 필요한가: `docs/update-4-plan.md` 의 릴리스 게이트 5건 중 3건은 사람이 실제로
 * 예약/상담을 제출해야 하고(시트·캘린더·메일이 실제로 생김), 1건은 소유자만 가능하다
 * (GAS 200 버전 정리). 나머지 **회귀 항목만은 읽기 전용으로 기계 검증이 가능**하다.
 * 배포 전/후에 이 스크립트를 돌려 A1~A4 가 되돌아가지 않았는지 확인한다.
 *
 * 검사 항목
 *   [A1] GROUP_META 가 7타일이고 famevt/b2b 가 realGroup='biz', b2b 는 consultOnly
 *        → 백엔드 시맨틱 불변 + B2B 는 슬롯 미점유
 *   [A4] getDefaultSelectRetouchPrice_ 가 웨딩급 €20 / 그 외 €10
 *   [가격] getWeekendSurcharge_ 에 amtp:50, dolp:50 → 평일 €350 / 토요일 €400
 *   [Phase 1] 라이브 init API 에서 biz 상담견적 상품의 가격이 0 이어야 한다
 *        (고정가 amtp·dolp 만 노출) — 내부 단가표가 고객에게 새지 않는지
 *   [회귀] 라이브 init API 에 pass/prof/stud/snap/wed 그룹이 살아 있는지
 *   [셀렉] select 루트가 /v2/ 로 301 되고 쿼리스트링이 보존되는지 (v1 삭제 후속)
 *
 * 사용법
 *   node scripts/verify-release-gate.mjs              # 소스 + 라이브
 *   node scripts/verify-release-gate.mjs --offline    # 소스만 (네트워크 없이)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const OFFLINE = process.argv.includes('--offline');

const fails = [];
const passes = [];
const ok = (msg) => passes.push(msg);
const bad = (msg) => fails.push(msg);

/* ---------- [A1] 첫 메뉴 7타일 ---------- */
const bookingJs = read('frontend/booking/booking.js');
const groupMetaBlock = bookingJs.slice(
  bookingJs.indexOf('const GROUP_META = {'),
  bookingJs.indexOf('\n};', bookingJs.indexOf('const GROUP_META = {'))
);
/* 최상위 키만(2칸 들여쓰기) — 중첩 label/sub 키를 세지 않는다. */
const tiles = [...groupMetaBlock.matchAll(/^ {2}([a-z][a-z0-9]*):\s*\{/gm)].map((m) => m[1]);
const EXPECTED_TILES = ['pass', 'prof', 'stud', 'snap', 'wed', 'famevt', 'b2b'];
if (tiles.join(',') === EXPECTED_TILES.join(',')) {
  ok(`[A1] 첫 메뉴 7타일 순서 일치: ${tiles.join(' · ')}`);
} else {
  bad(`[A1] GROUP_META 타일이 기대와 다름\n     기대: ${EXPECTED_TILES.join(', ')}\n     실제: ${tiles.join(', ')}`);
}
for (const key of ['famevt', 'b2b']) {
  const seg = groupMetaBlock.slice(groupMetaBlock.indexOf(`  ${key}: {`));
  if (/realGroup:\s*'biz'/.test(seg.slice(0, 400))) ok(`[A1] ${key}.realGroup='biz' (백엔드 시맨틱 불변)`);
  else bad(`[A1] ${key} 에 realGroup='biz' 가 없다 — 백엔드 그룹 시맨틱이 바뀌었을 수 있음`);
}
{
  const seg = groupMetaBlock.slice(groupMetaBlock.indexOf('  b2b: {'));
  if (/consultOnly:\s*true/.test(seg.slice(0, 400))) ok('[A1] b2b.consultOnly=true (슬롯 미점유)');
  else bad('[A1] b2b.consultOnly 가 없다 — B2B 가 캘린더 슬롯을 점유할 수 있음');
}

/* ---------- [A4] 셀렉 리터칭 기본단가 ---------- */
const gs = read('appscript/Code.gs');
const retouchFn = gs.slice(
  gs.indexOf('function getDefaultSelectRetouchPrice_('),
  gs.indexOf('\n}', gs.indexOf('function getDefaultSelectRetouchPrice_('))
);
if (/g==='wed'\)\s*return\s*20/.test(retouchFn) && /return\s*10;?\s*$/.test(retouchFn.trim())) {
  ok('[A4] getDefaultSelectRetouchPrice_: wed→€20, 기본 €10');
} else {
  bad('[A4] 셀렉 리터칭 기본단가 규칙이 바뀌었다 (wed→20 / else 10 이어야 함)');
}
for (const kw of ['암트', '돌잔치', '가족파티', 'wedding', 'hochzeit']) {
  if (retouchFn.includes(kw)) ok(`[A4] 웨딩급 €20 패턴에 '${kw}' 포함`);
  else bad(`[A4] 웨딩급 €20 패턴에서 '${kw}' 가 빠졌다`);
}

/* ---------- [가격] 토요일 할증 ---------- */
const surchargeFn = gs.slice(
  gs.indexOf('function getWeekendSurcharge_('),
  gs.indexOf('\n}', gs.indexOf('function getWeekendSurcharge_('))
);
for (const [id, amount] of [['amtp', 50], ['dolp', 50]]) {
  if (new RegExp(`${id}\\s*:\\s*${amount}`).test(surchargeFn)) {
    ok(`[가격] 토요일 할증 ${id}:+€${amount} → 평일 €350 / 토요일 €400`);
  } else {
    bad(`[가격] getWeekendSurcharge_ 에 ${id}:${amount} 이 없다 — 토요일 €400 이 깨졌을 수 있음`);
  }
}

/* ---------- 라이브 검사 ---------- */
const API_BASE = (read('frontend/shared/config.js').match(
  /'(https:\/\/script\.google\.com\/macros\/s\/[^']+\/exec)'/
) || [])[1];

/* 상담 견적으로만 안내하는 상품 — 가격이 0 이어야 한다(Phase 1).
   고정가 amtp/dolp 는 예외적으로 노출이 정상. */
const CONSULT_ONLY_IDS = ['biz', 'amtv', 'amtpr', 'amtvr', 'amtpp', 'amtvp', 'evp', 'evv'];
const FIXED_PRICE = { amtp: 350, dolp: 350 };

if (OFFLINE) {
  ok('[라이브] --offline 이라 API·리다이렉트 검사는 건너뜀');
} else if (!API_BASE) {
  bad('[라이브] shared/config.js 에서 API base URL 을 찾지 못했다');
} else {
  try {
    const res = await fetch(`${API_BASE}?api=init`, { redirect: 'follow' });
    const payload = await res.json();
    const products = payload?.data?.products || [];
    if (!products.length) throw new Error('products 가 비어 있다');

    const leaked = products.filter((p) => CONSULT_ONLY_IDS.includes(p.id) && Number(p.p) > 0);
    if (leaked.length === 0) {
      ok(`[Phase 1] 상담견적 상품 ${CONSULT_ONLY_IDS.length}종 전부 가격 0 — 단가표 미노출`);
    } else {
      bad(`[Phase 1] 🔴 내부 단가가 고객에게 노출됨: ${leaked.map((p) => `${p.id}=€${p.p}`).join(', ')}`);
    }

    for (const [id, expected] of Object.entries(FIXED_PRICE)) {
      const item = products.find((p) => p.id === id);
      if (!item) bad(`[회귀] 고정가 상품 ${id} 가 init 응답에서 사라졌다`);
      else if (Number(item.p) === expected) ok(`[회귀] ${id} 평일가 €${expected} 유지`);
      else bad(`[회귀] ${id} 가격이 €${expected} → €${item.p} 로 바뀌었다`);
    }

    const groups = new Set(products.map((p) => p.g));
    for (const g of ['pass', 'prof', 'stud', 'snap', 'wed', 'biz']) {
      if (groups.has(g)) ok(`[회귀] 그룹 ${g} 정상`);
      else bad(`[회귀] 그룹 ${g} 이 init 응답에 없다`);
    }
  } catch (err) {
    bad(`[라이브] init API 검사 실패: ${err.message}`);
  }

  /* select v1 삭제 후속 — 루트가 /v2/ 로 살아 넘어가는지 */
  try {
    const probe = 'RELEASEGATE';
    const res = await fetch(`https://select.studio-mean.com/?id=${probe}`, { redirect: 'manual' });
    const loc = res.headers.get('location') || '';
    if (res.status === 301 && loc.includes('/v2/')) {
      const followed = await fetch(`https://select.studio-mean.com/?id=${probe}`, { redirect: 'follow' });
      if (followed.url.includes('/v2/') && followed.url.includes(probe)) {
        ok('[셀렉] 루트 → /v2/ 301, 쿼리스트링 보존');
      } else {
        bad(`[셀렉] 리다이렉트는 되지만 쿼리가 사라졌다: ${followed.url}`);
      }
    } else {
      bad(`[셀렉] 🔴 루트 리다이렉트가 없다 (status=${res.status}, location=${loc || '없음'}) — 기존 v1 링크가 404`);
    }
  } catch (err) {
    bad(`[셀렉] 리다이렉트 검사 실패: ${err.message}`);
  }
}

/* ---------- 결과 ---------- */
console.log();
passes.forEach((m) => console.log(`  ✅ ${m}`));
if (fails.length) {
  console.log();
  fails.forEach((m) => console.log(`  ❌ ${m}`));
  console.log(`\n${fails.length}건 실패 / ${passes.length}건 통과\n`);
  process.exit(1);
}
console.log(`\n✅ 회귀 항목 ${passes.length}건 전부 통과.`);
console.log('\n⚠️  이 스크립트가 검증하지 못하는 릴리스 게이트 (사람이 해야 함):');
console.log('   · B2C 행사 예약 1건 실제 제출 (시트+캘린더+메일 생성됨)');
console.log('   · B2B 상담 제출 후 캘린더 이벤트가 안 생기는지 확인');
console.log('   · 사장님 미결 2건 (서비스컷 v2 실세션, 예약 수정 저장 @585)');
console.log('   · GAS 200 버전 정리 (소유자 권한)\n');
