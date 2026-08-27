# Gutschein Tax Memo

Updated: 2026-04-22 Europe/Berlin

## Purpose

이 문서는 Studio mean 굿샤인(Gutschein) 1차 구현 전에, 독일 부가가치세 관점에서 운영상 꼭 구분해야 할 사항을 정리한 내부 메모다.

이 문서는 구현과 장부 설계를 위한 운영 기록이며, 최종 세무 처리 확정은 세무사 검토를 전제로 한다.

## Primary Sources

공식 자료 기준으로 정리했다.

- `§ 3 Abs. 14, 15 UStG`
  - https://www.gesetze-im-internet.de/ustg_1980/__3.html
- `UStAE 3.17 Einzweck- und Mehrzweck-Gutscheine`
  - https://ao.bundesfinanzministerium.de/usth/2024/A-Umsatzsteuergesetz/I-Steuergegenstand-und-Geltungsbereich/Paragraf-3/ae-3-17.html
- BMF Umsatzsteuer-Anwendungserlass PDF
  - https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/Umsatzsteuer-Anwendungserlass/Umsatzsteuer-Anwendungserlass-31-12-2025.pdf?__blob=publicationFile&v=3

## Core Distinction

독일 부가세상 굿샤인은 반드시 아래 둘 중 하나로 분류해야 한다.

- `Einzweck-Gutschein` (SPV, single-purpose voucher)
- `Mehrzweck-Gutschein` (MPV, multi-purpose voucher)

이 분류에 따라 부가세가 언제 발생하는지가 달라진다.

## Official Rules

### 1. Gutschein definition

UStAE 3.17에 따르면 굿샤인은 종이 또는 전자 형태 모두 가능하며, 일부 금액만 충당하고 나중에 고객이 추가 결제하는 구조도 Gutschein으로 볼 수 있다.

실무상 의미:

- 굿샤인이 예약 총액의 일부만 차감되고 나머지는 고객이 결제해도 Gutschein으로 처리 가능

### 2. Einzweck-Gutschein

공식 기준:

- 발행 시점에
  - 공급 장소
  - 적용 부가세
  - 공급자
  - 공급 대상의 종류
  가 확정되어 있어야 한다.

중요한 포인트:

- 발행 시점에 이미 세액을 확정할 수 있어야 함
- 가급적 Gutschein에 `Einzweck-Gutschein`으로 표시하는 것이 권장됨
- 실제 사용 시점이 아니라 `발행/최초 이전 시점`에 매출세가 발생

실무상 의미:

- 특정 상품에만 쓸 수 있고
- 공급자가 Studio mean으로 고정되어 있고
- 독일 내 과세와 19% 세율이 확정되는 경우
  `Einzweck-Gutschein`으로 볼 여지가 큼

### 3. Mehrzweck-Gutschein

공식 기준:

- 발행 시점에 세액을 확정할 수 없으면 `Mehrzweck-Gutschein`

예:

- 어느 국가에서 쓰일지 모름
- 공급자 또는 공급 종류가 확정되지 않음
- 서로 다른 세율 상품/서비스에 폭넓게 쓸 수 있음

중요한 포인트:

- 발행 시점과 중간 이전은 부가세상 중립
- 실제 사용 시점에만 과세
- 가급적 Gutschein에 `Mehrzweck-Gutschein`으로 표시하는 것이 권장됨

## Studio mean Operational Recommendation

현재 시스템은 인보이스/견적서 전반에서 `19% MwSt.`를 전제로 하고 있다.

코드상 근거:

- `CONFIG.QUOTE_VAT_RATE: 0.19`
- 인보이스/견적서 표기 모두 `MwSt. 19%`

이 전제를 바탕으로 운영상 권장 분류는 아래와 같다.

### A. Product voucher

다음 조건을 모두 충족하면 `Einzweck-Gutschein` 후보로 본다.

- 특정 `productId`에만 사용 가능
- 공급자는 Studio mean으로 고정
- 독일 내 제공 서비스
- 세율이 19%로 명확

권장:

- 상품권은 시스템상 기본값을 `Einzweck-Gutschein 후보`로 저장
- 다만 실제 세무 확정은 세무사와 한 번 확인

### B. Flexible amount voucher

다음과 같은 금액권은 보수적으로 `Mehrzweck-Gutschein`으로 관리하는 것이 안전하다.

- 여러 촬영군 / 추가 인화 / 추가 보정 등 다양한 항목에 폭넓게 사용 가능
- 나중에 적용 대상이 달라질 수 있음
- 향후 상품 구성이 바뀌어 세무 분류 논점이 생길 수 있음

권장:

- 범용 금액권은 기본값을 `Mehrzweck-Gutschein`으로 둔다.

### C. Conservative default

1차 버전 운영 원칙:

- `product` 타입 굿샤인
  - 기본: `SPV 후보`
- `amount` 타입 굿샤인
  - 기본: `MPV 후보`

이렇게 저장해 두면, 나중에 세무사 확인 후 실제 회계 처리 방식을 쉽게 바꿀 수 있다.

## VAT Timing

### Einzweck-Gutschein

- 부가세는 발행 시점에 발생
- 나중에 실제 예약에 적용되는 시점은 부가세상 별도 독립 거래가 아님
- 나중에 고객이 추가 결제를 하면 그 `차액`만 별도로 과세

### Mehrzweck-Gutschein

- 발행 시점에는 부가세 과세가 아님
- 실제 예약/서비스 제공 시점에 과세

## Non-redemption

공식 자료상 차이는 아래와 같다.

### Einzweck-Gutschein

- 발행 시 이미 과세가 끝났기 때문에
- 고객이 유효기간 내에 쓰지 않아도 원칙적으로 추가 부가세 조정은 없음
- 예외적으로 금액을 환불하면 별도 수정 논점이 생김

### Mehrzweck-Gutschein

- 발행 시 과세가 없기 때문에
- 고객이 끝내 쓰지 않으면 원칙적으로 부가세상 별도 과세도 없음

## Remonetarisierung / refund

공식 자료상 환불 처리도 달라진다.

### Einzweck-Gutschein 환불

- 원래 과세된 거래를 되돌리는 구조가 될 수 있으므로 수정이 필요할 수 있음

### Mehrzweck-Gutschein 환불

- 단순히 지급수단을 되돌리는 효과로 보아 부가세상 직접 영향이 없다는 취지

## Required Tax Fields In DB

1차 버전에서 반드시 저장해야 할 세무 필드:

- `세무분류`
  - `SPV`
  - `MPV`
  - `TBD`
- `발행시점세율`
  - 예: `19`
- `과세시점`
  - `issue`
  - `redeem`
- `세무판단근거`
  - 사람이 읽는 메모
- `실제사용상품ID`
- `실제사용상품명`
- `실제사용일시`

이유:

- 나중에 세무사 요청 시 분류 근거를 복기할 수 있어야 함
- SPV/MPV에 따라 Lexware 또는 수기 회계 처리 시점이 달라질 수 있음

## Recommendation For V1 System Design

### 1. 시스템 분류 필드 선반영

실제 회계 자동화 전이라도 DB에는 아래를 먼저 넣는다.

- `taxVoucherType`
- `taxRecognitionPoint`
- `taxRateAtIssue`
- `taxNote`

### 2. 장부/화면에 표기

어드민 목록과 상세에서 아래를 바로 보이게 한다.

- `SPV / MPV`
- `발행 시 과세 / 사용 시 과세`

### 3. 발행 템플릿 문구

PDF 또는 상세에 아래 중 하나를 넣는 것이 좋다.

- `Einzweck-Gutschein`
- `Mehrzweck-Gutschein`

공식 자료에서도 발행자가 가시적으로 표시하는 것을 권장한다.

## Internal Operational Position

현 시점 내부 권고:

- 특정 상품에만 쓰는 상품권은 `SPV` 후보
- 범용 금액권은 `MPV` 후보
- 다만 Studio mean의 실제 사용 범위가 모두 독일 19% 과세로 완전히 고정된다면, 범용권도 SPV가 가능한지 세무사 확인 여지가 있음

즉, 구현은 유연하게 하되 운영 기본값은 보수적으로 두는 것이 안전하다.

## Open Questions For Tax Advisor

세무사 확인 질문 목록:

1. Studio mean의 `product voucher`는 모두 `Einzweck-Gutschein`으로 처리해도 되는지
2. Studio mean의 범용 `amount voucher`를 `Mehrzweck-Gutschein`으로 두는 것이 맞는지
3. 현재 서비스/인화/추가 보정이 모두 19%라면 범용권도 `Einzweck-Gutschein`으로 볼 수 있는지
4. 만료된 `amount voucher`의 회계상 잔존 처리 방식
5. 환불 또는 취소 시점의 분개 기준

## Implementation Note

1차 버전 구현은 세무 자동화보다 `증빙 가능한 데이터 구조 확보`를 우선한다.

즉, 시스템은 아래를 반드시 남겨야 한다.

- 무엇을 팔았는지
- 언제 팔았는지
- 누구에게 팔았는지
- 얼마를 받았는지
- 세무상 어떤 분류로 보았는지
- 언제 실제 사용되었는지

이 6가지만 정확히 남으면, 이후 세무사 검토와 회계 반영이 훨씬 쉬워진다.

---

## 결론 (2026-08-27) — MPV 단일 체제 확정

이 문서는 그동안 "세무사 검토를 전제로 한다"고만 적혀 있었다. 법령·행정해석 원문을 직접 대조해
**결론을 확정한다.** 세무사 확인은 여전히 권장이지만, 운영을 멈출 이유는 없다.

### 1. 판정 기준은 '공급자 수'가 아니라 '장소 + 세액'

`§ 3 Abs. 14 UStG` 원문:

> "…bei dem **der Ort** der Lieferung oder der sonstigen Leistung … **und die für diese Umsätze
> geschuldete Steuer** zum Zeitpunkt der Ausstellung des Gutscheins **feststehen**, ist ein
> Einzweck-Gutschein."

즉 SPV 요건은 **두 가지가 모두** 발행 시점에 확정돼 있을 것이다. "단일 공급자면 무조건 SPV"라는
설명이 돌아다니지만 조문에 그런 요건은 없다 — 백화점 상품권(공급자 하나, 세율 7%/19% 혼재)이
MPV인 것이 그 반증이다.

### 2. Studio mean 금액권은 MPV — 장소가 확정되지 않는다

ZDH 『Steuerliche Behandlung von Gutscheinen』 Merkblatt의 **Möbeltischlerei 사례**가 우리와 같은 구조다
(독일 소재 단일 사업자, 전 품목 19%):

> "Ob hier ein Einzweck-Gutschein vorliegt, **kann zweifelhaft sein**, da Möbel zwar grundsätzlich dem
> Regelsteuersatz unterliegen, die Ware aber auch **von Kunden aus der Schweiz gekauft werden könnte**,
> was dann in Deutschland zu einer **steuerfreien Ausfuhrlieferung** führen würde."

같은 Merkblatt는 `§ 3a Abs. 2 UStG`(사업자 수령인 → 수령인 소재지 과세)를 장소 불확정 사유로 명시한다.

우리 사정은 이 사례보다 **더 강하다.** 가정이 아니라 실제로 국외 비과세 매출이 있다
(2025년 6.062,50 € — 제3국 법인 고객). 굿샤인은 양도 가능(`übertragbar`)하므로 발행 시점에
최종 사용자가 개인인지 제3국 사업자인지 알 수 없다 → **공급 장소가 확정되지 않는다 → MPV.**

**따라서 MPV 분류는 '보수적 선택'이 아니라 법적으로 옳은 분류다.**

### 3. 상품 지정권(SPV)을 접은 이유

같은 Merkblatt의 Fleischerei 사례(점심 식사 전용·매장 내 소비 한정 상품권)는 진짜 SPV다 —
급부가 계약상 못 박혀 있어 장소·세액이 확정되기 때문. Studio mean의 상품 지정권도 이에 가까워
SPV로 판정될 여지가 크고, 그 경우:

> "Auch bei **Nichtausführung** der sich aus dem Gutschein ergebenden Leistung wird die Besteuerung
> aus systematischen Gründen **nicht rückgängig gemacht** werden können."

= 팔린 분기에 부가세가 확정되고, 고객이 끝내 안 써도 **되돌릴 수 없다.** 현금은 안 들어왔는데
세금이 먼저 나가는 구조. 그래서 **상품 지정권 발행을 차단**하고 금액권(MPV)만 남긴다.
`_guessGutscheinTaxType_` / `_normalizeGutscheinTaxType_` 가 항상 `MPV`를 반환하고,
`voucherType:'product'` 는 발행 단계에서 거부된다.

미사용 MPV는 **매출이 아니라 부채**다. 사용 시점에만 장부에 오른다(`buildAccountingLedger_` 굿샤인 패스).

### 4. ⚠️ 유효기한 — 실제로 틀려 있었다 (수정 완료)

- `§ 195 BGB` 일반 소멸시효 3년, **`§ 199 Abs. 1 BGB` 기산점은 "청구권이 생긴 **해의 말**"**.
- 따라서 2026-08-13 발행 굿샤인의 법정 사용 가능 기한은 **2029-12-31** 이다. 2029-08-13이 아니다.
- 기존 구현은 `발행일 + 36개월` → 법정 시효보다 **4개월 반 짧았다.**
- 법정 시효보다 짧은 AGB상 기한은 `§ 307 Abs. 1 S. 1 BGB` 로 **무효**이고, 무효가 되면 결국
  법정기간이 적용된다. 짧게 적어 놓아 봐야 효력이 없고 분쟁 소지만 남는다.
- **수정**: `_buildDefaultGutscheinValidUntil_` → `발행연도 + 3년`의 `12-31`.
  PDF 문구 `'3 Jahre gültig …'` → `'Einlösung nur nach Terminvereinbarung.'`
  (구체적 날짜는 이미 `Gültig bis` 로 인쇄된다).
- 발행 잔액이 0인 상태(발행 2건 = 사용완료 1·취소 1)라 **소급 대상 없음.**

### 5. 그대로 둬도 되는 것

- `keine Barauszahlung` — 상품권 일반 관행, 유효.
- 부분 사용 시 잔액을 새 코드로 이월 — 잔액 소멸은 분쟁 소지가 크므로 현재 구현이 맞다.
- 유효기한 경과 후에도 `§ 812 BGB` 로 가액반환(일실이익 공제)을 청구당할 수 있다 — 만료를
  '공짜 수익'으로 계산하지 말 것.

### 남은 것

- 세무사 확인은 **선택**으로 내린다. 위 근거로 자체 판단을 문서화했고, 판단 근거는 굿샤인 행마다
  `세무판단근거` 열에 저장된다.
- 상품 지정권을 다시 팔고 싶어지면 그때는 SPV 체제(발행 시 과세)를 함께 켜야 한다 — 지금은 막혀 있다.

**출처**: `§ 3 Abs. 13–15 UStG` · `§§ 195, 199, 307, 812 BGB` · `UStAE 3.17` (BMF-Schreiben 2020-11-02) ·
ZDH Merkblatt "Steuerliche Behandlung von Gutscheinen".
