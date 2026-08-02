# 굿샤인 회계 반영 + 잔액 이월 (2026-08-02, @715~716)

배경: [[gutschein-tax-memo]] 재검토 결과, 세무 필드(SPV/MPV·과세시점)는 저장되지만 **장부 빌더가 굿샤인 시트를 아예 안 읽어** 굿샤인 대금이 매출/부가세에서 통째로 빠지는 구조였음 (예약행 총결제액은 차감 후 금액).

## 반영 내용 (Code.gs)

1. **장부 패스 추가** — `buildAccountingLedger_` 에 굿샤인 수입 엔트리 (UStG §3 Abs.14/15):
   - SPV(상품권·과세시점 issue): 판매등록일(없으면 발행일)에 발행금액 전액. 구매자등록/판매등록된 행만.
   - MPV(금액권·과세시점 redeem): 사용일시에 사용금액. 사용여부 Y만.
   - 재고/취소 상태 제외. `accountingClass:'굿샤인 매출'`, `source:'gutschein'` — 기존 flow/class 집계에 그대로 흡수.
   - ponytail: 판매 후 취소/환불 소급 정정 엔트리는 미구현(취소 행 제외만) — 발생 시 수기 정정.
2. **MPV 잔액 이월** — `_applyGutscheinToBookingCore_`: 사용액<발행액이면 차액을 **새 굿샤인 행으로 자동 발급**(`_issueResidualGutschein_`, 발행방식 residual·판매채널 잔액이월·유효기한 상속). 소멸 금지. SPV는 발행 시 전액 과세라 이월하면 이중과세 → 제외. 부모/예약 메모에 이월 기록, 결과에 `residualCode/Amount`.
3. **PDF**: 빈 필름 창에 로고 워터마크(16%), 문구 정비 — "keine Barauszahlung" + 금액권에 "Restguthaben wird bei Teileinlösung als neuer Gutscheincode übertragen."
4. **erp-agent `gutschein-list`** (조회 전용) 추가 — 에이전트에 굿샤인 액션이 하나도 없던 공백 해소 + 검증용.

## 검증

- 라이브 장부 재계산(forceRefresh) 정상, 굿샤인 엔트리 0건 = **시트가 실제로 0행(빈 상태)이라 정상**.
- `gutschein-list`로 확인: 등록된 굿샤인이 한 건도 없음.

## ⚠️ 운영 후속 (사장님)

- 4월에 PDF 굿샤인/A3 포스터를 만들었으므로 **오프라인으로 판매된 굿샤인이 있다면 시스템 미등록 상태** — 어드민 굿샤인 탭에서 소급 등록해야 장부·세무에 잡힘.
- 세무사 확인 질문 5건은 [[gutschein-tax-memo]] 그대로 유효.
