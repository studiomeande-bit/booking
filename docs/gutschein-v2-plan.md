# Gutschein V2 Plan

Updated: 2026-04-22 Europe/Berlin

## Goal

2차 버전의 목표는 고객이 예약 단계에서 직접 굿샤인을 적용할 수 있게 만드는 것이다.

단, 1차 관리자 전용 방식과 달리 고객 입력은 다음 리스크가 있다.

- 코드만 넣고 예약을 끝까지 완료하지 않는 이탈
- 동일 코드의 동시 사용 경쟁
- 예약 실패인데 굿샤인만 사용 처리되는 문제

따라서 2차는 단순히 입력창만 추가하는 것이 아니라, `hold 상태 + 만료 해제 + 최종 확정 시 사용 처리`가 핵심이다.

## Prerequisites

2차는 아래가 먼저 완료되어 있어야 한다.

- `docs/gutschein-v1-plan.md` 기준의 1차 기능 운영 시작
- Gutschein 시트와 랜덤 코드/QR 구조 안정화
- 예약장부 차감 계산 로직 운영 검증 완료
- 관리자용 발행 / 사용 / 취소 기록이 안정적으로 축적됨

## Scope

2차에서 추가할 범위:

- 고객 예약 페이지 마지막 단계에 `굿샤인 코드 입력` UI 추가
- 코드 검증 API
- 임시 hold API
- hold 만료 해제 API / 배치 정리
- 예약 완료 시 최종 사용 확정
- 예약 실패 / 중단 시 자동 해제
- 고객용 조회 페이지 또는 최소한의 상태 확인 페이지

2차에서도 제외:

- 부분 사용 / 잔액 이월
- 고객이 직접 잔액 조회 후 복수 예약에 나눠 쓰는 기능
- 고객 셀프 환불 / 복원

## New State Model

1차 상태에 아래를 추가한다.

- `재고`
- `판매완료`
- `예약중`
- `사용완료`
- `만료`
- `취소`

보조 필드:

- `holdToken`
- `holdStartedAt`
- `holdExpiresAt`
- `holdBookingDraftId`
- `holdChannel`
- `holdReleasedAt`

의미:

- `예약중`
  - 고객이 예약 화면에서 코드를 입력해 임시로 잡아둔 상태
- `사용완료`
  - 예약 제출까지 성공해서 최종 사용 처리된 상태

## Hold Strategy

고객이 예약 화면에서 코드를 입력하면 즉시 `사용완료`로 바꾸지 않는다.

흐름:

1. 고객이 상품/일시/기본 정보 입력 완료
2. 마지막 단계에서 굿샤인 코드 입력
3. 서버가 코드 검증
4. 유효하면 `holdToken` 생성 후 상태를 `예약중`으로 전환
5. 클라이언트에는 할인 금액과 만료 시각 표시
6. 예약 제출 성공 시 `사용완료`
7. 예약 제출 실패 또는 창 이탈 시 `hold` 해제

권장 hold 시간:

- `15분`

이유:

- 너무 짧으면 고객 경험이 나빠짐
- 너무 길면 재고 잠금이 길어짐

## Public Booking UX

굿샤인 입력은 예약 마지막 단계에만 노출한다.

권장 이유:

- 날짜/시간/상품 선택 전에는 실제 차감 금액이 확정되지 않음
- 최종 가격이 계산된 뒤 보여주는 것이 혼선이 적음

UI 구성:

- `굿샤인 코드 입력` 필드
- `적용` 버튼
- 검증 결과 박스
  - 코드 상태
  - 할인 금액
  - 최종 총액
  - 예약금
  - 잔금
  - hold 남은 시간
- `굿샤인 제거` 버튼

## Public Booking APIs

새 공개 API를 추가한다.

### 1. `POST /exec/api/gutschein-validate`

역할:

- 코드 존재 여부 확인
- 상태 / 만료 / 사용 여부 확인
- 적용 가능한 할인 금액 계산

입력:

- `code`
- `itemGroup`
- `productId`
- `quoteTotal`
- `depositAmount`

응답:

- `ok`
- `voucherType`
- `status`
- `discountAmount`
- `adjustedTotal`
- `remainingBalanceAfterDeposit`
- `expiresAt`
- `taxVoucherType`

### 2. `POST /exec/api/gutschein-hold`

역할:

- 검증된 코드를 임시 hold

입력:

- `code`
- `bookingDraftId`
- `productId`
- `quoteTotal`

응답:

- `ok`
- `holdToken`
- `holdExpiresAt`
- `discountAmount`
- `adjustedTotal`

### 3. `POST /exec/api/gutschein-release`

역할:

- 고객이 코드 제거 또는 예약 중단 시 hold 해제

입력:

- `code`
- `holdToken`

### 4. `POST /exec/api/gutschein-finalize`

역할:

- 예약 제출 직후 최종 사용 완료 처리

입력:

- `code`
- `holdToken`
- `bookingRowIndex`
- `finalTotal`
- `depositAmount`

## DB Additions

기존 Gutschein 시트에 아래 컬럼 추가를 가정한다.

- `holdToken`
- `holdStartedAt`
- `holdExpiresAt`
- `holdBookingDraftId`
- `holdChannel`
- `holdReleasedAt`
- `예약중차감금액(€)`
- `최종사용확정일시`

예약장부에는 아래가 추가되면 좋다.

- `굿샤인hold토큰`
- `굿샤인검증일시`
- `굿샤인확정일시`

## Pricing Rule In V2

금액 계산은 1차와 동일하다.

- `조정총액 = max(0, 원래총액 - 굿샤인차감액)`
- `최종잔금 = max(0, 조정총액 - 이미받은예약금)`

2차에서도 잔액 이월은 하지 않는다.

## Concurrency / Safety

2차는 동시성 방어가 중요하다.

필수 규칙:

- `gutschein-hold`
  - `LockService` 사용
- `gutschein-finalize`
  - 다시 한 번 `LockService` 사용
- 만료된 hold는 재사용 가능 상태로 자동 해제
- 유효한 hold가 걸린 코드는 다른 고객이 잡을 수 없음

## Release Rules

hold는 아래 경우 자동 해제한다.

- 예약 제출 실패
- 고객이 `굿샤인 제거` 버튼 클릭
- hold 시간 초과
- 관리자 수동 해제

이를 위해 배치 정리 함수를 추가한다.

- `cleanupExpiredGutscheinHolds_()`

권장 실행:

- `time-driven trigger`
- 10분 또는 15분 간격

## Admin Tools Needed For V2

어드민에서도 아래 기능이 있어야 한다.

- `예약중` 상태 목록 보기
- hold 만료 예정 보기
- hold 강제 해제
- 잘못 확정된 코드 수동 복원
- 어떤 예약 draft 또는 예약행에 연결되었는지 확인

## Customer Status Check

고객용 최소 조회 페이지를 추가하는 것이 좋다.

예:

- `https://booking.studio-mean.com/gutschein/check?code=...`

노출 정보는 최소화한다.

- 유효 / 사용완료 / 예약중 / 만료
- 금액 전체 공개 여부는 선택

권장:

- 보안과 선물성 이슈 때문에 전체 구매자 정보는 절대 노출하지 않음

## Migration Plan

2차 전환 시 기존 1차 데이터는 아래 규칙으로 마이그레이션한다.

- `사용여부=Y`
  - 상태를 `사용완료`로 매핑
- `사용여부=N` and `구매자등록여부=Y`
  - 상태를 `판매완료`로 유지
- `사용여부=N` and `구매자등록여부=N`
  - 상태를 `재고`로 유지
- hold 관련 신규 컬럼은 빈 값으로 시작

## Recommended Implementation Order

1. Gutschein 상태 모델 확장
2. hold/release/finalize API 추가
3. 예약 마지막 단계 UI 추가
4. 실패/이탈 시 해제 로직 추가
5. 배치 hold cleanup 추가
6. 어드민 hold 모니터링 UI 추가
7. 고객 상태 조회 페이지 추가

## Release Checklist

2차 배포 전 확인 항목:

- 동일 코드 동시 입력 테스트
- 코드 입력 후 브라우저 종료 테스트
- 예약 성공 직후 finalize 정상 처리 확인
- 예약 실패 시 release 정상 처리 확인
- hold 만료 후 재사용 가능 여부 확인
- 모바일 Safari / 카카오 인앱 브라우저 동작 확인

## Future V3 Candidates

2차 이후 검토:

- 고객 셀프 적용 오픈 범위 확대
- 부분 사용 / 잔액 이월
- 고객 로그인 없이 링크 기반 잔액 조회
- 온라인 결제 연동형 디지털 기프트카드
