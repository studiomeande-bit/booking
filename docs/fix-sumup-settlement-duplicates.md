# 구현 프롬프트 — SumUp API 동기화 정산행 중복 생성 버그 픽스

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
