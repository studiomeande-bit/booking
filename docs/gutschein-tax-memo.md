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

## 결론 (2026-08-27) — SPV(Einzweck-Gutschein) 단일 체제

이 문서는 그동안 "세무사 검토를 전제로 한다"고만 적혀 있었다. 법령·행정해석 원문을 대조하고
**운영 방식(§ 20 Istversteuerung + EÜR)까지 반영해 결론을 확정한다.**

### 1. 판정 기준은 '상품권이냐 금액권이냐'가 아니다

`§ 3 Abs. 14 UStG` 원문:

> "…bei dem **der Ort** der Lieferung oder der sonstigen Leistung … **und die für diese Umsätze
> geschuldete Steuer** zum Zeitpunkt der Ausstellung des Gutscheins **feststehen**, ist ein
> Einzweck-Gutschein."

요건은 **장소와 세액의 확정** 두 가지뿐이다. 금액권이라서 MPV, 상품권이라서 SPV가 아니다.
"공급자가 하나면 SPV"라는 설명도 조문 요건이 아니다 — 백화점 상품권(공급자 하나, 7%/19% 혼재)이
MPV인 것이 반증이다.

그리고 `§ 3 Abs. 13 Nr. 2 UStG` 는 **"Bedingungen für die Nutzung"(이용 조건)** 도 굿샤인을 정의하는
요소로 명시한다. → **약관이 분류를 결정하는 지렛대다.**

### 2. 왜 SPV인가 — 운영(Ist + EÜR)이 결정적

Studio mean은 **`§ 20 UStG` Istversteuerung(입금기준)** + **EÜR(`§ 11 EStG` 현금기준)** 이다.
소득세도 부가세도 현금이 들어온 때를 본다.

| | MPV | **SPV** |
|---|---|---|
| 2026-12 €200 판매 | EÜR 수입 2026 / 부가세 **2028**(사용시) | EÜR 수입 2026 / 부가세 **2026** |
| 장부 | 같은 돈이 **두 해로 쪼개짐** → 선수금 관리 필요 | **한 사건·한 해로 종결** |
| 사용 시점 | 과세 이벤트 발생 | 회계상 아무 일 없음 |

MPV는 현금기준 장부에 **의도적으로 불일치를 만든다.** 회계 인덱스가 이미 같은 위험을 기록했다 —
*"연도를 넘겨 미상환으로 남는 굿샤인(입금연도 EÜR 수입 vs 상환연도 부가세) — 그때만 선수금 처리가
필요하다."* SPV는 그 상황 자체가 생기지 않는다.

**위험도 비대칭이다.** SPV로 보고 실제 MPV였다면 조기납부(국고 유리, 무해). MPV로 보고 실제
SPV였다면 **과소신고 → `§ 233a AO` 이자.** 틀릴 때 싼 쪽으로 틀리는 게 맞다.

### 3. SPV 요건을 약관으로 확정한다

ZDH 『Steuerliche Behandlung von Gutscheinen』 Merkblatt의 **Möbeltischlerei 사례**는 독일 단일 사업자·
전 품목 19%인데도 SPV가 *"zweifelhaft"* 라고 한다. 스위스 고객이 사면 면세 수출이 되기 때문이다.
같은 Merkblatt가 `§ 3a Abs. 2 UStG`(사업자 수령인 → 수령지 과세)를 장소 불확정 사유로 명시한다.

**그 구멍을 약관으로 막는다.** PDF에 인쇄되는 문구:

> - Gültig für Fotografie-Leistungen von Studio mean, **erbracht in Deutschland**.
> - **Nur für private Nutzung, nicht für unternehmerische Zwecke.**
> - Einlösung nur nach Terminvereinbarung. Keine Barauszahlung, nicht mit anderen Aktionen kombinierbar.
> - Restguthaben wird bei Teileinlösung als neuer Gutscheincode übertragen.
>
> (+ 세무 표기줄: `Einzweck-Gutschein · MwSt. 19% bei Ausgabe.`)

**"개인 전용" 한 줄이 핵심이다** — `§ 3a Abs. 2` 경로를 차단해 공급지를 독일로 고정한다.
운영상 잃는 것이 없다: 법인 고객(휘슬러·KOTRA·SkyinQ)은 굿샤인이 아니라 견적서·인보이스로 간다.

대조군으로, 같은 Merkblatt의 **Fleischerei 사례**(점심 전용·매장 내 소비 한정)가 SPV로 인정되는 이유도
정확히 **약관 제한** 때문이다. 우리는 같은 방식을 쓴다.

### 4. 감수하는 것 (정직하게)

- **미상환이어도 과세는 되돌릴 수 없다** — Merkblatt: *"Auch bei Nichtausführung … wird die Besteuerung
  aus systematischen Gründen nicht rückgängig gemacht werden können."* 다만 Ist 기준이라 **현금은 이미
  손에 있다** → 자금 부담 없음. (Soll 과세 사업자였다면 이 선택은 위험했다.)
- **판매 후 취소·환불의 소급 정정 엔트리는 미구현** — 취소 상태 행을 장부에서 제외할 뿐. 발생 시 수기 정정.
- 약관 문구가 PDF·메일에서 빠지면 SPV 근거가 약해진다. **문구를 지우지 말 것.**

### 5. 유효기한 — 실제로 틀려 있었다 (수정 완료)

- `§ 195 BGB` 3년, **`§ 199 Abs. 1 BGB` 기산점은 "청구권이 생긴 **해의 말**"**.
  → 2026-08-13 발행분의 법정 기한은 **2029-12-31**, 2029-08-13이 아니다.
- 기존 `발행일 + 36개월` 은 법정보다 **4.5개월 짧았고**, 법정보다 짧은 기한은 `§ 307 Abs.1 S.1 BGB` 로
  **무효** → 결국 법정기간이 적용된다. 짧게 적어 봐야 효력 없고 분쟁 소지만 남는다.
- **수정**: `_buildDefaultGutscheinValidUntil_` → `발행연도 + 3년`의 `12-31`.

### 6. 잔액 이월 — 이월하되 이중과세하지 않는다

부분 사용 잔액을 소멸시키는 약관은 `§ 307 BGB` 무효 소지가 크므로 **SPV에서도 이월한다.**
다만 상위 코드가 발행 시점에 전액 과세됐으므로, 이월행(`발행방식='residual'`)은
`buildAccountingLedger_` 굿샤인 패스에서 **제외**한다. 이 가드가 없으면 부분 사용 한 번에
잔액만큼 매출이 부풀려진다.

### 7. 기존 건 영향

발행 2건뿐이고 미상환 잔액 0. `T9Z7-5RKQ-RMG6`(왕예원 €185)의 장부 귀속일이
**2026-08-23(사용일) → 2026-08-13(발행일)** 로 이동했다. **둘 다 Q3/2026이라 분기 UStVA 영향 없음**
(Q3는 미제출 상태). 유효기한도 소급 대상 없음.

### 남은 것

- 세무사 확인은 **선택**으로 내린다. 판단 근거는 굿샤인 행마다 `세무판단근거` 열에 저장된다.
- MPV로 되돌리려면 약관에서 "개인 전용"·"독일 내 제공"을 빼야 한다 — 그때는 반대로 장소가
  불확정해지므로 MPV가 맞다. **약관과 분류는 한 몸이다.**

### 8. 상품권 구성(인원·옵션) — 2026-08-27 추가

상품권은 `상품 + 인원 + 옵션` 조합으로 발행한다. 액면가는 `calculateQuote_` 가 계산하되
**촬영일을 넘기지 않는다** — 주말할증·이벤트할인·시니어·얼리버드가 붙으면 발행 시점 액면가가
흔들리는데, SPV는 **발행 시점에 세액이 확정**돼야 하기 때문이다(§ 3 Abs. 14 UStG).

세율은 인원·옵션과 무관하게 전부 19%라 SPV 요건에 영향이 없다.

PDF에는 **금액을 인쇄하지 않고 구성만** 표기한다(`Studio Basic` / `3 Personen · mit Haustier`).
액수를 찍으면 '크레딧'으로 읽혀 부분 사용·잔액 논쟁을 부르는데, 상품권을 쓰는 이유가 그 논쟁을
없애는 것이다. 액면가는 시트에 저장돼 과세·장부에 쓰인다.

**출처**: `§ 3 Abs. 13–15 UStG` · `§ 20 UStG` · `§§ 195, 199, 307, 812 BGB` · `§ 233a AO` ·
`UStAE 3.17` (BMF-Schreiben 2020-11-02) · ZDH Merkblatt "Steuerliche Behandlung von Gutscheinen".
