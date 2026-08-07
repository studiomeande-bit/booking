#!/usr/bin/env node
/**
 * 회계 월마감 기록 — 순수 로직 검증 (스냅샷 정규화 · 행 왕복 · drift 대조)
 *
 * Code.gs 에서 대상 함수 소스를 그대로 뽑아 GAS 스텁 위에서 실행한다.
 * 돈이 걸린 비교(0.01 허용오차)와 시트가 날짜/숫자를 Date·number 로 재해석하는 경우를 특히 본다.
 *
 * new Function 입력은 **이 저장소의 Code.gs 뿐**이다(외부 입력 없음) — 다른 check-*.mjs 와 동일한
 * 로컬 개발 전용 하네스. 사본을 두면 원본과 어긋나므로 소스를 직접 읽는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'appscript/Code.gs'), 'utf8');

function grab(name, kind = 'function') {
  const marker = kind === 'function' ? `function ${name}(` : `const ${name}=`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`not found in Code.gs: ${name}`);
  if (kind === 'const') {
    // 선언 한 줄(혹은 배열 리터럴 블록) — 다음 최상위 선언 직전까지
    const end = src.indexOf('\nconst ', start + 1);
    const alt = src.indexOf('\nfunction ', start + 1);
    return src.slice(start, Math.min(...[end, alt].filter((n) => n > 0)));
  }
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces: ${name}`);
}

// ── GAS 스텁 ───────────────────────────────────────────────────────────────
const CONFIG = { TIMEZONE: 'Europe/Berlin' };
const roundCurrency_ = (n) => Math.round((Number(n) || 0) * 100) / 100;
const parseMoneyValue_ = (v) => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.');
  return Number(s) || 0;
};
const parseDateSafe_ = (v) => {
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0');
    return { str: `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())} ${p(v.getHours())}:${p(v.getMinutes())}` };
  }
  return { str: String(v ?? '').trim() };
};
const Utilities = {
  formatDate(d, _tz, pattern) {
    const p = (n) => String(n).padStart(2, '0');
    return pattern
      .replace('yyyy', d.getFullYear())
      .replace('MM', p(d.getMonth() + 1))
      .replace('dd', p(d.getDate()))
      .replace('HH', p(d.getHours()))
      .replace('mm', p(d.getMinutes()));
  },
};

const ctx = { CONFIG, roundCurrency_, parseMoneyValue_, parseDateSafe_, Utilities };
const pieces = [
  grab('ACCOUNTING_CLOSE_HEADERS', 'const'),
  grab('ACCOUNTING_CLOSE_COL', 'const'),
  grab('ACCOUNTING_CLOSE_FIELDS', 'const'),
  grab('ACCOUNTING_FP_CODE_', 'const'),
  grab('ACCOUNTING_FP_MAX_', 'const'),
  grab('accountingCloseSnapshot_'),
  grab('findAccountingCloseRow_'),
  grab('accountingCloseRowToObject_'),
  grab('diffAccountingCloseSnapshot_'),
  grab('accountingRowFpKey_'),
  grab('buildAccountingRowFp_'),
  grab('parseAccountingRowFp_'),
  grab('diffAccountingRowFp_'),
];
const loaded = new Function(
  ...Object.keys(ctx),
  `${pieces.join('\n')}
   return {ACCOUNTING_CLOSE_HEADERS,ACCOUNTING_CLOSE_COL,accountingCloseSnapshot_,findAccountingCloseRow_,accountingCloseRowToObject_,diffAccountingCloseSnapshot_,
           accountingRowFpKey_,buildAccountingRowFp_,parseAccountingRowFp_,diffAccountingRowFp_,ACCOUNTING_FP_MAX_};`
)(...Object.values(ctx));

const {
  ACCOUNTING_CLOSE_HEADERS, ACCOUNTING_CLOSE_COL,
  accountingCloseSnapshot_, findAccountingCloseRow_, accountingCloseRowToObject_, diffAccountingCloseSnapshot_,
  accountingRowFpKey_, buildAccountingRowFp_, parseAccountingRowFp_, diffAccountingRowFp_, ACCOUNTING_FP_MAX_,
} = loaded;

// 시트 스텁 — getLastRow / getRange(...).getValues()
const sheetOf = (rows) => ({
  getLastRow: () => rows.length + 1,
  getRange: (r, c, numR, numC) => ({
    getValues: () => rows.slice(r - 2, r - 2 + numR).map((row) => row.slice(c - 1, c - 1 + numC)),
  }),
});

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

const JULY = {
  incomeGross: 5566, expenseGross: 2012.18, profitGross: 3553.82,
  vatPayable: 888.7, entryCount: 51, incomeCount: 32, expenseCount: 19,
};
const rowFor = (period, snap, closedAt = '2026-08-06 21:00', warnings = 3, forced = '', memo = '',
                fp = 'b4:24000;e172:4109:656') => ([
  period[0], period[1], closedAt,
  snap.incomeGross, snap.expenseGross, snap.profitGross, snap.vatPayable,
  snap.entryCount, snap.incomeCount, snap.expenseCount, warnings, forced, memo, fp,
]);

console.log('\n── 스냅샷 정규화 ──');
{
  const s = accountingCloseSnapshot_({ incomeGross: '5566.004', expenseGross: 2012.176, entryCount: '51' });
  t('돈은 센트 반올림', s.incomeGross === 5566 && s.expenseGross === 2012.18, JSON.stringify(s));
  t('건수는 정수', s.entryCount === 51 && typeof s.entryCount === 'number');
  t('빠진 필드는 0', s.vatPayable === 0 && s.expenseCount === 0);
}

console.log('\n── 행 왕복 ──');
{
  const rows = [rowFor(['2026-07-01', '2026-07-31'], JULY, '2026-08-06 21:00', 3, '', 'Q3 준비')];
  const found = findAccountingCloseRow_(sheetOf(rows), '2026-07-01', '2026-07-31');
  t('기간 정확 일치로 찾음', found.rowIndex === 2, `rowIndex=${found.rowIndex}`);
  const obj = accountingCloseRowToObject_(found.row, found.rowIndex);
  t('스냅샷 원복', JSON.stringify(obj.snapshot) === JSON.stringify(accountingCloseSnapshot_(JULY)), JSON.stringify(obj.snapshot));
  t('메모·경고수 보존', obj.memo === 'Q3 준비' && obj.warnings === 3);
  t('강제마감 플래그 off', obj.forced === false);
  t('행 지문 원복', obj.rowFp === 'b4:24000;e172:4109:656', obj.rowFp);
  t('헤더 수 = 행 길이', ACCOUNTING_CLOSE_HEADERS.length === rows[0].length);
}
{
  // 시트가 날짜 문자열을 Date 로 재해석한 경우 (계약서에서 실제로 터졌던 케이스)
  const rows = [rowFor([new Date(2026, 6, 1), new Date(2026, 6, 31)], JULY)];
  t('Date 로 저장돼도 찾음', findAccountingCloseRow_(sheetOf(rows), '2026-07-01', '2026-07-31').rowIndex === 2);
}
{
  const rows = [
    rowFor(['2026-06-01', '2026-06-30'], JULY),
    rowFor(['2026-07-01', '2026-07-31'], JULY),
  ];
  t('다른 달은 안 잡음', findAccountingCloseRow_(sheetOf(rows), '2026-07-01', '2026-07-31').rowIndex === 3);
  t('시작만 같고 종료 다르면 미일치', findAccountingCloseRow_(sheetOf(rows), '2026-07-01', '2026-07-15').rowIndex === -1);
  t('빈 시트는 -1', findAccountingCloseRow_(sheetOf([]), '2026-07-01', '2026-07-31').rowIndex === -1);
}

console.log('\n── drift 대조 ──');
{
  t('동일하면 변동 없음', diffAccountingCloseSnapshot_(accountingCloseSnapshot_(JULY), accountingCloseSnapshot_(JULY)).length === 0);

  // 오늘 실제로 벌어진 일: 7/28·7/30 입금을 8/6에 소급 기록 → 7월 수입이 €100 늘어난다
  const after = accountingCloseSnapshot_({ ...JULY, incomeGross: 5666, profitGross: 3653.82, incomeCount: 32 });
  const d = diffAccountingCloseSnapshot_(accountingCloseSnapshot_(JULY), after);
  t('수입·손익 2건 검출', d.length === 2, JSON.stringify(d.map((x) => x.key)));
  const inc = d.find((x) => x.key === 'incomeGross');
  t('delta 정확', inc && inc.delta === 100, JSON.stringify(inc));
  t('표시 문구에 화살표+부호', inc && inc.text === '€5566.00 → €5666.00 (+100.00)', inc && inc.text);

  // 1센트 미만은 반올림 잡음 — blocker 로 세우면 안 된다
  const noise = accountingCloseSnapshot_({ ...JULY, incomeGross: 5566.004 });
  t('서브센트 차이는 무시', diffAccountingCloseSnapshot_(accountingCloseSnapshot_(JULY), noise).length === 0);
  const cent = diffAccountingCloseSnapshot_(accountingCloseSnapshot_(JULY), accountingCloseSnapshot_({ ...JULY, incomeGross: 5566.02 }));
  t('2센트 차이는 검출', cent.length === 1 && cent[0].delta === 0.02, JSON.stringify(cent));

  /* 딱 1센트 — 부동소수 허용오차 방식이면 방향에 따라 잡히기도 안 잡히기도 했다(라이브에서 실제 발생).
     정수 센트 비교로 바꾼 뒤 양방향 모두 잡혀야 한다. */
  const up = diffAccountingCloseSnapshot_(accountingCloseSnapshot_(JULY), accountingCloseSnapshot_({ ...JULY, expenseGross: 2012.19 }));
  t('+1센트 검출', up.length === 1 && up[0].delta === 0.01, JSON.stringify(up));
  const dn = diffAccountingCloseSnapshot_(accountingCloseSnapshot_(JULY), accountingCloseSnapshot_({ ...JULY, profitGross: 3553.81 }));
  t('-1센트 검출', dn.length === 1 && dn[0].delta === -0.01, JSON.stringify(dn));
  t('1센트 문구 정확', up[0].text === '€2012.18 → €2012.19 (+0.01)', up[0].text);

  // 라이브 재현: €0.01 테스트 지출 1건 추가 → 지출·손익·회계건수·지출건수 4항목이 움직인다
  const live = diffAccountingCloseSnapshot_(accountingCloseSnapshot_(JULY), accountingCloseSnapshot_({
    ...JULY, expenseGross: 2012.19, profitGross: 3553.81, entryCount: 52, expenseCount: 20,
  }));
  t('라이브 €0.01 지출 시나리오 4항목', live.length === 4, JSON.stringify(live.map((x) => x.key)));

  // 금액은 그대로인데 건수만 바뀌는 경우 = 취소+동액 신규 (금액 대조만으로는 안 잡힘)
  const swap = diffAccountingCloseSnapshot_(accountingCloseSnapshot_(JULY), accountingCloseSnapshot_({ ...JULY, entryCount: 52, incomeCount: 33 }));
  t('금액 동일·건수 변동도 검출', swap.length === 2 && swap.every((x) => !x.money), JSON.stringify(swap.map((x) => x.key)));
  t('건수 문구는 건 단위', swap[0].text === '51건 → 52건 (+1)', swap[0].text);

  // 감소 방향
  const down = diffAccountingCloseSnapshot_(accountingCloseSnapshot_(JULY), accountingCloseSnapshot_({ ...JULY, expenseGross: 1812.18 }));
  t('지출 감소도 부호 정확', down.length === 1 && down[0].delta === -200 && down[0].text.includes('(-200.00)'), JSON.stringify(down));
}

console.log('\n── 행 지문 (어느 행이 바뀌었나) ──');
{
  const E = (source, flow, rowIndex, gross, tax, name, date) =>
    ({ source, flow, rowIndex, gross, tax, name, date });
  const base = [
    E('booking', 'income', 4, 240, 38.32, '조재연', '2026-04-18'),
    E('booking', 'income', 215, 149.94, 23.94, '쪼울', '2026-07-30'),
    E('print', 'income', 12, 30, 4.79, '인화', '2026-07-05'),
    E('expense', 'expense', 172, 41.09, 0, 'AMAZON EU', '2026-07-15'),
  ];
  const fp = buildAccountingRowFp_(base);

  t('키가 소스별로 구분됨', accountingRowFpKey_(base[0]) === 'b4'
    && accountingRowFpKey_(base[2]) === 'p12' && accountingRowFpKey_(base[3]) === 'e172',
    [base[0], base[2], base[3]].map(accountingRowFpKey_).join(','));
  t('예약행4 와 지출행4 가 충돌하지 않음',
    accountingRowFpKey_(E('booking', 'income', 4)) !== accountingRowFpKey_(E('expense', 'expense', 4)));
  t('지출만 세액 포함', fp.includes('e172:4109:0') && fp.includes('b4:24000') && !fp.includes('b4:24000:'));
  t('변동 없으면 0건', diffAccountingRowFp_(fp, base).changes.length === 0);

  // 오늘 실제로 겪은 사건: 합계 +€5.35, 건수 그대로 → 어느 행인지 특정 불가였다
  const moved = base.map(e => e.rowIndex === 215 ? { ...e, gross: 155.29 } : e);
  const d = diffAccountingRowFp_(fp, moved);
  t('금액 바뀐 행 1건 지목', d.changes.length === 1 && d.changes[0].key === 'b215', JSON.stringify(d.changes));
  t('지목된 행에 이름·날짜 포함', d.changes[0].label === '쪼울' && d.changes[0].date === '2026-07-30');
  t('변동폭 표기 정확', d.changes[0].text === '금액 €149.94 → €155.29 (+5.35)', d.changes[0].text);

  // 오늘 기장한 매입세액 — 지출은 총액 그대로인데 세액만 움직인다
  const taxed = base.map(e => e.rowIndex === 172 && e.flow === 'expense' ? { ...e, tax: 6.56 } : e);
  const dt = diffAccountingRowFp_(fp, taxed).changes;
  t('총액 동일·세액만 변동도 검출', dt.length === 1 && dt[0].text === '세액 €0.00 → €6.56 (+6.56)', JSON.stringify(dt));

  // 합계가 상쇄돼 0인 경우 — 이게 합계 대조만으로는 절대 안 잡히는 케이스
  const offset = base.map(e => e.rowIndex === 4 ? { ...e, gross: 140 }
    : e.rowIndex === 215 ? { ...e, gross: 249.94 } : e);
  const off = diffAccountingRowFp_(fp, offset);
  const sumBefore = base.reduce((s, e) => s + e.gross, 0);
  const sumAfter = offset.reduce((s, e) => s + e.gross, 0);
  t('합계 상쇄(총액 동일)인데 행 변동 2건 검출',
    Math.abs(sumBefore - sumAfter) < 0.01 && off.changes.length === 2, `${sumBefore}/${sumAfter}`);

  const added = diffAccountingRowFp_(fp, [...base, E('booking', 'income', 999, 50, 7.98, '신규', '2026-07-31')]).changes;
  t('신규 행 검출', added.length === 1 && added[0].kind === 'added' && added[0].key === 'b999');
  const removed = diffAccountingRowFp_(fp, base.filter(e => e.rowIndex !== 12)).changes;
  t('사라진 행 검출', removed.length === 1 && removed[0].kind === 'removed' && removed[0].key === 'p12');

  t('센트 왕복 정확(부동소수 흔들림 없음)',
    parseAccountingRowFp_(buildAccountingRowFp_([E('booking', 'income', 1, 1234.56)])).rows.b1.gross === 1234.56);
  t('지문 없으면 available=false', diffAccountingRowFp_('', base).available === false);

  // 셀 5만자 한도 방어
  const many = Array.from({ length: 8000 }, (_, i) => E('booking', 'income', i, 100 + i));
  const big = buildAccountingRowFp_(many);
  t('한도 초과 시 잘리고 표식', big.length <= ACCOUNTING_FP_MAX_ + 8 && big.endsWith(';~TRUNC'), `len=${big.length}`);
  t('잘린 지문도 파싱되고 truncated 표시', parseAccountingRowFp_(big).truncated === true);
  t('100행 지문은 2KB 미만',
    buildAccountingRowFp_(Array.from({ length: 100 }, (_, i) => E('booking', 'income', i, 199.99))).length < 2048);
}

console.log(`\n${fail ? '❌' : '✅'} ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
