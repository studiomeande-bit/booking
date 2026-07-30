# 구현 프롬프트 — SumUp API 동기화 정산행 중복 생성 버그 픽스

> ## ✅ 해결 완료 (2026-07-30, 배포 @696/@697)
>
> **원인 확정:** 해시 base 의 `payoutDate`·`fee`·`net` 이 payout 확정 전후로 값이 바뀌어 같은 거래의
> dedup 키가 회차마다 달라졌다. 같은 해시를 **수수료 지출 ID(`sumup_fee:<hash>`)** 로도 써서
> 지출장부까지 이중계상됐다(문서 작성 시점엔 미인지 — 실측 114행 중 57행 중복 €47.02).
>
> **적용한 픽스**
> 1. `buildSettlementHash_` base = 불변 식별자만(`source·date·gross·paymentRef·bankRef·counterparty·description` + 배치 내 seq). 사후값 3개 제거
> 2. `getSettlementIndex_`/`findSettlementRow_` — SumUp 은 `source|ref` 1차 키, 해시는 폴백.
>    ⚠ **은행은 ref 키 금지**(결제참조가 IBAN/Mandatsreferenz 라 거래마다 고유하지 않다 — 적용하면 서로 다른 이체가 한 행으로 뭉개진다). 요구 2를 그대로 따르지 않은 유일한 지점
> 3. CSV 재임포트: 배치 내 동일 정체성은 seq 번호로 구분(같은 내용 2줄 = 2건 유지), 같은 파일 재임포트는 같은 seq → 덮어쓰기. replace-by-filename 은 채택하지 않음(기본 파일명 `upload.csv` 충돌 시 남의 임포트를 지운다)
> 4. `buildSettlementHashLegacy_` 조회 폴백 + 수수료 지출 설명(거래참조 포함) 인덱스 → **이관 작업 없이 자가치유**. 배포 직후 전량 신규행이 되는 사고를 막는다
> 5. 수수료 지출 ID 를 `sumup_fee:ref:<거래참조>` 로 전환, 은행출금 ID 는 구 해시 폴백 조회 추가
> 6. 정리 액션 `settlement-dedupe`(기본 dryRun, 참조 있는 SumUp 행만 삭제 후보 · 남는 행 전체 rehash)
>
> **실측 결과:** 정산 143→138행(팬텀 5행 €211 제거, SumUp gross 9,747→9,536) · 수수료 지출 114→57행
> (€47.02 과다계상 해소) · 매출 총액 22,224.00 **불변** · 비용 12,569.82→12,522.80 · 이익 +47.02.
> 회귀 테스트: 7일 lookback 동기화 2회 연속 `created=0/updated=5`, 재점검 시 중복 0·rehash 잔여 0.
> 검증기 `scripts/check-settlement-dedupe.mjs` (시나리오 46 + 구조 12 + 결함주입 13/13).
>
> **주의(다음 사람용):** `erp-agent.mjs` CLI 는 `--json '{...}'` 만 파싱한다. `--dryRun false` 같은
> 개별 플래그는 **조용히 무시**된다(이번에 30분 헤맴 — 액션 파라미터는 전부 `--json` 으로 넘길 것).
>
> ### 후속 — "review 큐 오염"(주의 §2)까지 해결 (배포 @698/@699/@700)
>
> 중복행을 지운 뒤에도 7월 18건 중 13건이 review 였다. 원인이 하나 더 있었다:
> **15분 동기화가 `matchSettlementTransaction_(tx,[],…)` 로 빈 장부를 넘겨** 장부 대조를 아예 못 했다
> (CSV 임포트만 `refreshSettlementMatchesForPeriod_` 를 돌렸다). → 신규 행이 생긴 회차에만 재매칭.
>
> 그리고 재매칭을 켜 보니 **같은 예약을 여러 거래가 물고 있었다**(7/03·7/04 €30 → 둘 다 예약행 180,
> 3월엔 예약행 15 하나에 8건). 대사가 맞는 것처럼 보이는 쪽이 review 보다 나쁘다 → **장부 1건 : 거래
> 1건 선점**(점수 높은 순 배정, 밀린 거래는 재탐색). 카드·은행 결제기록 경로에도 같은 규칙 적용.
>
> **실측(2026-01~07 전량 재매칭)**: 중복 매칭 18그룹 → **0** · matched 196→240 · review 116→72 ·
> 장부 총액 불변. `settlement-rematch --json '{"startDate":…,"endDate":…}'` 로 언제든 재실행 가능.
> ⚠ 월별로 나눠 돌리면 달을 걸친 중복이 남는다 — 정리 목적이면 **전 기간을 한 번에** 돌릴 것.

> 발견: 2026-07-26 일일 회계 마감(`studio-mean-daily-close`). 근거 로그: `~/Desktop/Studio_mean/스튜디오자료/2026년 kontoauszug/02_원장_Ledgers/2026-07-일일마감로그.md` (2026-07-26 항목, 이상 4).
> 이 파일을 reservation 레포에서 코딩 에이전트에게 그대로 주면 되는 자기완결 프롬프트다.

## 증상 (재현된 사실)

SumUp 카드거래 1건이 **정산장부(Settlement 시트)에 2행**으로 들어간다. 15분 동기화가 결제 당일 1행을 만들고, SumUp payout이 확정된 뒤의 동기화가 **같은 거래를 새 행으로 또 append** 한다.

실증 (2026-07-25 €43 거래):

| 시트행 | payoutDate | type | counterparty | gross | paymentRef | 원본해시 | importedAt |
|---|---|---|---|---:|---|---|---|
| 416 | (공백) | PAYMENT · SUCCESSFUL | VISA | 43 | TAAA4EQ2BV6 | `797be35d…` | 2026-07-26 06:18 |
| 417 | 2026-07-26 | PAYMENT · SUCCESSFUL | VISA | 43 | TAAA4EQ2BV6 | `de31e56b…` | 2026-07-26 13:18 |

gross·ref·counterparty·description 전부 동일하고 **payoutDate와 해시만 다르다.**

### 규모 (2026-07-26 시점, 정산장부 SumUp 소스 235행)

| 월 | 실제 거래 | 장부 gross | 실제 gross | 팬텀 |
|---|---:|---:|---:|---:|
| 2026-06 | 17건 | 4.264,00 | 2.293,00 | **1.971,00** (6월 Verkaufsbericht CSV 2회 임포트까지 겹침) |
| 2026-07 | 16건 | 2.498,00 | 1.264,00 | **1.159,00** |

2026-07-01 거래부터 관측되며 **현재도 매 동기화마다 발생**(2026-07-26 13:18 동기화가 5행 추가 생성).

## 근본원인 (코드 확정)

`appscript/Code.gs`

1. `buildSettlementHash_(source,tx,raw)` (≈L14761) 의 해시 base:
   ```js
   const base=[source,tx.date,tx.payoutDate,tx.gross,tx.fee,tx.net,tx.paymentRef,tx.bankRef,tx.counterparty,tx.description].join('|');
   ```
   → **`payoutDate`가 포함**되어 있다. 결제 시점에는 공백, payout 확정 후에는 날짜가 채워지므로 **같은 거래의 해시가 시간에 따라 변한다.** (`fee`/`net`도 payout 후 채워질 수 있어 같은 위험.)
2. SumUp API 동기화 루프(≈L19597~19620)는 `getSettlementHashMap_`의 `'sumup|'+tx.hash` 키로만 기존 행을 찾는다. 해시가 바뀌면 dedup 미스 → `sh.appendRow(rowValues)`로 신규 행.

### 추가 관측 (2026-07-27 일일 마감) — ⚠️ 위 "payoutDate만 다르다"는 부분 설명이다

정리(cleanup)는 실행되어 SumUp 정산행이 235→139행으로 줄었고 6월은 중복 0이 됐다. **그러나 픽스가 배포되지 않아 정리 직후 동기화부터 다시 쌓인다** — 07-26 14:03 이후 ~24시간 동안 팬텀 3행 / €106 (약 3행/일):

| 원거래 | 원본행 | 중복행 | 중복 생성 |
|---|---|---|---|
| TAAA4D7TKKY (07-24, €30) | 317 | 322 | 07-27 15:18 |
| TAAA4EQ2BV6 (07-25, €43) | 318 | 320 | 07-27 22:03 |
| TAAA4EPNCHC (07-25, €33) | 319 | 321 | 07-27 22:03 |

**핵심:** 행 318과 행 320은 **payoutDate가 둘 다 `2026-07-26`인데 해시가 다르다** (`76caafa3…` vs `de31e56b…`). date·gross·fee·net·paymentRef·counterparty·description도 시트상 전부 동일하다. 같은 거래가 지금까지 최소 3개 해시를 만들었다: `797be35d`(payoutDate 공백) → `76caafa3` → `de31e56b`.

즉 **payoutDate는 원인의 일부일 뿐**이고, 해시 base의 다른 사후값 필드도 회차마다 값이 바뀐다. 유력 후보는 `fee`/`net`의 **빈문자열 `''` → 숫자 `0`** 전이(payout 확정 전후) — 시트에 쓰고 읽으면 둘 다 `0`으로 보여 육안 대조로는 구분되지 않지만 `join('|')` 결과는 `…||43|…` vs `…|0|43|…`로 달라진다.

→ **함의: payoutDate만 base에서 빼는 부분수정으로는 막히지 않는다.** 아래 요구 픽스 1(payoutDate·fee·net 3개 모두 제거)과 2(paymentRef 1차 dedup 키)를 **함께** 적용해야 한다. 회귀 테스트(요구 5)는 "payout 확정 전 상태로 1회 → 확정 후 상태로 1회 동기화해도 `created=0`"까지 확인할 것.

## 요구 픽스

1. **해시를 불변 식별자만으로 계산.** `payoutDate`, `fee`, `net`을 base에서 제거(거래 정체성이 아니라 사후 상태값). `date`·`gross`·`paymentRef`·`counterparty`·`description`·`bankRef`는 유지.
2. **paymentRef 우선 dedup.** `paymentRef`가 있으면 `source|paymentRef`를 1차 키로 기존 행을 찾고(해시 키는 폴백으로 유지), 찾으면 append 대신 **덮어쓰기(update)** — payoutDate/fee/net/matchStatus가 최신값으로 갱신되게. `getSettlementHashMap_`에 ref 인덱스를 함께 만들거나 별도 `getSettlementRefMap_`를 추가.
3. **CSV 임포트 경로도 같은 문제.** 6월 `Verkaufsbericht-2026-06-01_2026-06-30.csv`가 2회 임포트되어 27행이 됐다(CSV 행에는 paymentRef가 비어 있어 ref 키가 안 먹는다). CSV 경로는 `filename + date + gross + counterparty + description + 파일 내 행번호`처럼 **파일 재임포트를 흡수하는 키**로 dedup하거나, 같은 filename 재임포트 시 기존 행을 지우고 다시 넣는(replace-by-filename) 전략을 쓸 것. 어느 쪽이든 **같은 파일을 두 번 넣어도 총액이 안 변해야** 한다.
4. **기존 중복행 정리(one-off).** 어드민 또는 erp-agent 액션으로:
   - SumUp 소스 행을 `paymentRef`(없으면 `date|gross|counterparty|description`) 기준으로 묶고,
   - 그룹당 **payoutDate가 채워진 최신 행 1개만 남기고 나머지 삭제**,
   - 삭제 건수·금액을 리턴(감사 로그용). 실행 전 `dryRun:true` 지원 필수.
5. **회귀 방지 테스트/검증:** 같은 기간을 2회 연속 동기화해도 `created=0`, 총 gross 불변임을 확인. 6월 CSV를 2회 임포트해도 행수·총액 불변임을 확인.

## 주의 (회계 영향 범위)

- **매출(Kz81)·부가세는 직접 영향 없음** — 회계장부 gross는 예약 `총결제액`에서 파생되고, 정산장부는 대사용이다. 잘못된 신고가 나간 건 아니다.
- 실제 피해는 **월마감(SOP §3)의 카드↔매출 대사와 "review 큐" 오염**이다. 7월 카드 16건 중 10건이 대응 예약이 있는데도 `review`로 남아, 진짜 미귀속 건(2026-07-25 VISA €43, 예약 자체가 없는 워크인 매출)이 노이즈에 묻혔다. 4번 정리까지 끝내야 월마감 대사가 신뢰 가능해진다.
- 픽스 후 `01_은행_Bank`/`08_SumUp` 월 대사 수치가 바뀌므로, 8/1 월마감 전에 적용하는 것이 좋다.

## 참고

- 유사 선례: `docs/fix-passport-print-amount.md` (인화옵션 매출누락, 2026-07-21 픽스 fd6fde8).
- 배포: `clasp push` — `appscript/` 전체가 올라가므로 의도치 않은 `Admin.html` 변경 여부 먼저 확인(`docs/ops-checklist.md`).
