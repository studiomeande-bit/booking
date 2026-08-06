# ERP 에이전트 전체 커버리지 기획

> 2026-08-02 작성 (ERP 운영 세션). 목표: **어드민 대시보드 없이 ERP 운영 세션(CLI)에서 전 업무 처리**.
> 전수 조사 기준: Code.gs 디스패치 `action===` 110개 vs `*Admin()` 함수 ~140개.

## 1. 현황 진단 (2026-08-02 전수 조사)

| 항목 | 상태 |
|---|---|
| 노출된 에이전트 액션 | **~110개** (이미 상당히 넓음) |
| SKILL.md에 문서화된 액션 | **~40개** → 문서 드리프트 심각 |
| 로컬 Code.gs vs 라이브 | **미배포 백로그 존재** — `booking-change-product`가 로컬엔 있고 라이브는 INVALid_ACTION (@712는 그 이전 HEAD) |
| 어드민 전용(미노출) 운영 함수 | 아래 도메인별 갭 |

**문서 드리프트의 실제 사고 사례**: `convertQuoteToBookingAdmin`(견적→예약 전환)이 백엔드에 있는데 미노출+미문서라, Alice 건을 booking-create-manual로 수작업 전환함. 기능이 있는데 모르는 상태가 최대 리스크.

## 2. 원칙 (이번 세션에서 검증된 것)

1. **새 비즈니스 로직 금지** — 기존 `*Admin()` 함수를 1~3줄로 래핑만 한다 (`if(action==='x') return jsonOk_(xAdmin(token,payload...))`).
2. **외부발송 가드** — 고객 메일이 나가는 액션은 SKILL.md에 ⚠️외부발송 표기, 세션은 명시 지시 때만 실행.
3. **변경계 가드** — 금액/상태 변경 액션에 `expectName` 검증 + 감사스탬프(기존 `[금액정정…] (agent)` 패턴) 일관 적용.
4. **배포 배치** — 페이즈당 clasp push + 라이브 redeploy **1회** (버전 200 한도 관리).
5. **하드삭제·보안은 확대 금지** — 아래 §5.

## 3. 페이즈 계획

### Phase 0 — 배포 백로그 + 자기서술 문서 (즉시 · 최우선 · ~반나절) ✅ 완료 2026-08-02 (@714)
가장 싸고 가장 가치 큼. 신규 개발 거의 없음.
- [x] 로컬 HEAD 1회 redeploy → `booking-change-product`(+백일상 문구) 라이브 반영, 프로브 검증. (@713이 구베이스 푸시로 지웠던 것을 @714로 복원)
- [x] **`actions-list` 액션 신규** (유일한 신규 코드): 디스패치에 등록된 전체 액션명 배열 반환 → 세션이 기능 존재를 스스로 확인 가능. INVALID_ACTION 응답에 "actions-list로 확인" 힌트 추가. (하드코딩 없이 `handlePublicApiRequest_.toString()` 소스 추출)
- [x] **SKILL.md 전면 재생성** — 107개 액션 전부: 액션명 · payload 스키마 1줄 · ⚠️외부발송/변경계 표기. (도메인별 표: 예약/견적/인보이스/회계/셀렉/상담/마케팅/MRT/인스타/시스템)
- [x] 검증: 세션에서 actions-list 호출 → SKILL.md와 대조 스크립트 1회. (라이브 107 = 문서 107, 양방향 누락 0)

### Phase 1 — 예약·견적 라이프사이클 완결 (~반나절) ✅ 완료 2026-08-02 (@714, 8종 전부 라이브 프로브 통과)
이번 주 실제로 부딪힌 갭. 전부 기존 함수 래핑.
확인된 외부발송(코드 grep): confirm-deposit(입금확인 메일, 억제 불가)·cancel(취소+대기자 알림, 억제 불가)·reschedule(변경 안내, 억제 불가)·pass-photos-send(전달 메일). convert 2종은 sendEmail 기본 false. expectName 가드 전 행단위 변경계 적용.
| 신규 액션 | 래핑 함수 | 비고 |
|---|---|---|
| `quote-reject` | markQuoteRejectedAdmin | 거절 + 가예약 캘린더 해제 |
| `quote-convert-booking` | convertQuoteToBookingAdmin | Alice 케이스 자동화 (수기 전환 대체) |
| `consult-convert-booking` | convertConsultationToBookingAdmin | 상담→예약 |
| `booking-confirm-deposit` | confirmBookingDepositAdmin | ⚠️입금확인 메일 자동발송 포함 — payload로 메일 억제 가능한지 확인, 불가하면 외부발송 표기 |
| `booking-cancel` | cancelBookingAdmin | 정식 취소 플로우(캘린더 해제·환불견적 연동). booking-delete(하드삭제)와 별개 |
| `booking-reschedule` | rescheduleBookingAdmin | 일정변경(캘린더+메일). booking-set-time보다 완전 |
| `booking-restore-autocancel` | restoreAutoCancelledBookingAdmin | 자동취소 복구 |
| `pass-photos-send` | sendPassportPhotosAdmin | ⚠️여권 최종본 전달 메일 |

### Phase 2 — 회계 운영 완결 ✅ 완료 2026-08-06 (@726 payment-csv-import 선행, @733 나머지 6종)

라이브 프로브: `settlement-match-board` 7월 SumUp 미매칭 4건·후보 25건 조회 정상 /
`settlement-refresh` 실행 시 **updated 2**(review 12→10 실제 해소) / `deposit-bulk-confirm` 은
confirm 없이 호출 시 차단(메일 대량발송 방지) / `cash-delete`·`settlement-apply-match`·`invoice-preview`
전부 유효성 가드 동작 확인.
아침 "결제 검토 필요 N건"을 세션에서 끝내는 게 핵심.
| 신규 액션 | 래핑 함수 | 비고 |
|---|---|---|
| `settlement-match-board` | getSettlementMatchBoardAdmin | 미매칭 거래 조회 |
| `settlement-apply-match` | applySettlementBookingMatchAdmin | 거래↔예약 수동 매칭 확정 |
| `settlement-refresh` | refreshSettlementMatchesAdmin | 재매칭 |
| `payment-csv-import` | importPaymentCsvAdmin | 은행 CSV 수기 임포트 |
| `cash-delete` | deleteCashLedgerManualEntryAdmin | 현금장부 정정 (가드: expect 필드) |
| `deposit-bulk-confirm` | bulkConfirmAllPendingDepositsAdmin | 계약금 일괄 확인 |
| `invoice-preview` | previewInvoicePricingAdmin | **STMIN 연번 소모 전 미리보기** — 번호 낭비 리스크 제거 |

### Phase 3 — Gutschein 도메인 ✅ 완료 2026-08-06 (@734, 8종 신규 + 기존 gutschein-list)

라이브 프로브: 가드 3종(없는 코드/금액 0/없는 예약행) 정확한 유효성 에러 /
**쓰기 왕복 검증** — 합성 굿샤인 생성(`KPDF-UJHA-9WGX`, €30) → `gutschein-get` 으로
`MPV`·`redeem`·세율 19·유효기한 2029-08-06(36개월) 자동 분류 확인 → 취소 →
**회계 장부에서 제외되는 것까지 확인**(8월 굿샤인 엔트리 0건).
`deleteGutscheinAdmin` 은 계획대로 **미노출 유지**(취소로 충분).
`gutschein-list/get/create/update/cancel/apply/apply-preview/send(⚠️)/release-hold`
← listGutscheinsAdmin, getGutscheinAdmin, createGutscheinAdmin, updateGutscheinAdmin, cancelGutscheinAdmin, applyGutscheinToBookingAdmin, previewGutscheinApplyAdmin, sendGutscheinEmailAdmin, releaseGutscheinHoldAdmin. (deleteGutscheinAdmin은 미노출 유지)

### Phase 4 — 고객 이력·커뮤니케이션 (~반나절)
| 신규 액션 | 래핑 함수 | 비고 |
|---|---|---|
| `message-log` | getMessageLogAdmin | "그 메일 나갔나?" 발송 이력 검증 |
| `contact-history` | lookupContactHistoryAdmin | 고객 통합 이력 |
| `booking-thread-list/get/reply` | listBookingThreadsAdmin/getBookingThreadAdmin/replyBookingThreadAdmin | reply는 ⚠️외부발송 |
| `consult-appointment-set/cancel/note` | scheduleConsultationAppointmentAdmin 등 | 상담 통화 일정 |
| `portfolio-lead-list/update` | listPortfolioLeadsAdmin/updatePortfolioLeadStatusAdmin | |

### Phase 5 — 모니터링 (~2시간)
`automation-health`(getAutomationHealthAdmin) · `ops-checklist`(getOperationsChecklistAdmin) · `ops-log`(getOperationsLogAdmin) → 브리핑에서 "자동화 죽었나"를 세션이 직접 진단.

## 4. 페이즈별 공통 완료 조건
1. 래퍼 + 디스패치 등록, 2) SKILL.md 표 갱신, 3) clasp push + **라이브 redeploy 1회**, 4) 액션별 라이브 프로브(빈 payload → 유효성 에러 확인, 외부발송은 라우팅 확인만), 5) 완료 보고에 액션·검증 결과.

## 5. 명시적 비대상 (안 한다)
- **하드삭제 확대 금지**: invoice-delete(연번 규정 — storno로 충분), gutschein-delete. 기존 booking/quote/select-delete는 현행 가드 유지.
- **보안/키 관리 미노출**: changeAdminPassword, issueAutomationKey/revoke, setStudioPin, MRT 파트너키.
- **어드민 대시보드 대체 UI 없음** — CLI+스킬 문서로 충분 (YAGNI).

## 6. 리스크
| 리스크 | 대응 |
|---|---|
| GAS 버전 200 한도 | 페이즈당 배포 1회 + 배포 전 버전 수 확인, 필요시 구버전 정리 |
| 외부발송 오발사 | SKILL.md ⚠️표기 + 세션 안전수칙(명시 지시 때만) — 기존 체계 유지 |
| 문서 재드리프트 | actions-list가 진실원장, SKILL.md는 대조 스크립트로 주기 검증 |
| 래핑 함수의 숨은 부작용(메일 등) | 페이즈 착수 시 함수별 send/create 호출 grep 후 SKILL.md에 명기 (booking-confirm-deposit 사례) |
