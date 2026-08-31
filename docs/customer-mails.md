# 고객 발송 이메일 전수 인벤토리

작성: 2026-08-31 (Code.gs @899 기준 전수 조사 — sendTrackedEmail_ 호출 68곳).
⚠️ 라이브가 정본이다 — 이 문서는 스냅샷이며, 메일 문구를 고치면 여기도 갱신할 것.
라인 번호는 근사치(±10).

메일 발송은 전부 `sendTrackedEmail_()`(내부적으로 MailApp + 메일로그 시트 기록) 경유.
예외 2곳만 직접 MailApp: 고객 출력주문 관리자 알림, 좀비트리거 정리(둘 다 관리자 수신).

## 2026-08-31 수리 내역 (@897–@899)

- 🔴 **C4 셀렉 접수확인 메일 — 8/9부터 매번 조용히 미발송이던 버그 수리**: 본문이 미선언
  `volumeDiscount`를 참조(호출부 12번째 인자 vs 시그니처 11개) → ReferenceError → catch가 삼킴.
  영향 6건(김지훈 8/10 · Annielyn 8/18 · 조은지 8/22 · 현주현 8/26 · 강예슬 8/27 · 류진주 8/29).
- **C5 셀렉 수정 제출 고객 무통지** → `isUpdate` 변형("✏️ 사진 셀렉 수정 접수")으로 발송 추가.
- 접수확인 푸터·수량 단위, 리마인더 버튼 라벨 3개국어화 + **추가금 결제 안내 1줄**("수령 시 현금·카드") 추가.
- 실패 가시화: 두 catch가 메일로그에 `상태=실패`로 기록(@898) — 재발 시 failedCount에 잡힘.
- 독일어 오타 4곳: möchten·geändert·Bestätigt·So geht's (@899).

---

## [A. 예약 단계]

### A1. 포트폴리오 문의 접수 확인
- **트리거**: studio-mean.com 포트폴리오 문의 폼 제출(`createPortfolioLead_`) 직후 자동. 억제 없음.
- **제목**: ko `[Studio mean] 문의가 접수되었습니다` / en `Your inquiry has been received` / de `Ihre Anfrage ist angekommen`
- **본문**: 1-2 영업일 내 답변 예고 + 보낸 내용 에코 표(문의종류·희망일정·장소·연락처+원문). 버튼/금액/기한 없음.
- **위치**: `_sendPortfolioLeadCustomerEmail_` :4284

### A2. 상담 설문 접수 확인 (/contact)
- **트리거**: 상담 설문 제출(`createConsultation_`) 직후 자동.
- **제목**: ko `상담 설문이 접수되었습니다 — ${name}님` / en `Consultation form received` / de `Beratungsformular erhalten`
- **본문**: 접수 확인 + (상담시간 선택 시) 예약된 상담일정, 아니면 1-2 영업일 안내. 설문 에코+원문.
- **위치**: `_sendConsultationCustomerEmail_` :5591

### A3. 상담 일정 등록/취소 안내
- **트리거**: 고객이 설문에서 상담시간 선택 시 자동; 어드민 등록/취소는 `sendEmail:true` 옵트인.
- **제목**: ko `상담 일정 ${취소|안내} — ${name}님` / en `Consultation appointment ${cancelled|scheduled}` / de `Beratungstermin ${abgesagt|vereinbart}`
- **본문**: 상담 일정·방식·장소/링크, 변경은 회신 유도.
- **위치**: `_sendConsultationAppointmentUpdateEmail_` :5557

### A4. 워크인 정보 접수 확인
- **트리거**: 워크인 링크 폼 제출(`submitWalkinIntake_`) 직후, 이메일 있으면 자동.
- **제목**: ko `워크인 정보가 접수되었습니다` / en `Your walk-in information has been received` / de `Ihre Walk-in-Informationen sind eingegangen`
- **본문**: 제출 내용 전체 에코(서비스·희망일정·연락처·주소·입금자명·사업자송장·요청사항).
- **위치**: `sendWalkinCustomerReceipt_` :11699

### A5. 예약 신청 접수(대기) 메일
- **트리거**: 공개 예약 폼 제출 직후 자동.
- **제목**(EMAIL_I18N.pending_subject): ko `예약 신청이 접수되었습니다` / en `Booking Request Received` / de `Buchungsanfrage erhalten`
- **본문**: 신청 내역(상품·일시·총금액·계약금 강조·잔금·할인·재촬영 배지), biz 견적전용이면 "맞춤 견적 발송 예정". 결제 안내+인보이스 문구, 계약금 있으면 환불규정 박스(웨딩 별도). 여권만 촬영 가이드·오시는길 전문, 그 외 티저. 버튼 3: 포털·일정 변경·취소 요청.
- **위치**: `sendCustomerPendingEmail_` :11829

### A6. 대기자 등록 확인
- **트리거**: 마감 슬롯 대기 등록(`joinWaitlist_`) 직후.
- **제목**: ko `대기 등록 접수 안내 — ${name}님` / en `Waitlist confirmation` / de `Warteliste – Bestätigung`
- **본문**: 날짜·상품, 취소 발생 시 즉시 메일 예고, 선착순. 등록 취소는 회신.
- **위치**: `_sendWaitlistConfirmEmail_` :31971

### A7. 대기자 슬롯 오픈 알림
- **트리거**: 취소 2경로(고객 원클릭·어드민 취소) 후 같은 날짜+그룹 대기자 전원. ⚠ **자동취소 경로에는 없음**.
- **제목**: ko `대기 중이던 ${date} 일정이 열렸습니다` / en `A slot opened on ${date}` / de `Ein Termin am ${date} ist freigeworden`
- **본문**: 선착순 + 예약 페이지 텍스트 링크.
- **위치**: `notifyWaitlistForDate_` :31987

## [B. 예약 확정~촬영 전]

### B1. 예약 확정 메일 (.ics 첨부)
- **트리거**: ① 관리자 메일 "예약 확정하기" ② `booking-confirm-mail` ③ 포털 "예약 정보 다시 받기"(확정 상태만, 쿨다운).
- **제목**: ko `촬영 예약이 최종 확정되었습니다! 🎉` / en `Your Booking is Confirmed! 🎉` / de `Ihre Buchung ist bestätigt! 🎉`
- **본문**: 상품·일시·금액 3종. 계약금>0이면 계좌 박스(IBAN/BIC/송금사유+10일 자동취소 경고)+환불규정. .ics 첨부. /prep 설문 블록+촬영 가이드+협력업체+오시는길. 버튼 3.
- **위치**: `_sendConfirmEmail` :12254

### B2. 예약금(계약금) 입금 확인
- **트리거**: 어드민/에이전트 `booking-confirm-deposit`. **notify:false/skipMail 억제 가능**. 정산 매칭 일괄확인도 수렴.
- **제목**: ko `예약금 입금 확인 안내 — ${name}님` / en `Deposit received` / de `Anzahlung erhalten`
- **본문**: 상품·촬영일시·확인 금액·확인일·잔금 표. "잔금은 당일 현장 결제".
- **위치**: `sendDepositConfirmationEmail_` :17039

### B3. 계약금 미입금 리마인더 (확정 D+5, 1회)
- **제목**: ko `예약금 입금 리마인더` / en `Deposit payment reminder` / de `Erinnerung Anzahlung`
- **본문**: 금액·경과일·잔여일 내 미입금 시 자동취소 경고 + 계좌 박스. "이미 입금/현장결제 협의 시 무시".
- **위치**: `sendDepositReminderEmail_` :31371

### B4. 예약 자동취소 통지 (D+10) ⚠ 한국어 단일
- **제목**: `예약이 자동 취소되었습니다` — **3개국어 없음, 본문도 ko뿐** (en/de 고객도 한국어 수신).
- **위치**: `autoCancelBookingForMissingDeposit_` :31428

### B5. 예약 변경 안내 (diff 메일)
- **트리거**: 어드민 저장·`booking-update`·`booking-change-product` — diff 있을 때만 기본 발송, `notify:false` 억제.
- **제목**: ko `${name}님, 예약 내용이 변경되었습니다` / en `your booking has been updated` / de `Ihre Buchung wurde geändert`
- **본문**: 변경 전(취소선)/후(파랑) 표. 잔금 변경 시 초록 박스 재고지. 포털 버튼.
- **위치**: `sendBookingChangeNoticeEmail_` :17489

### B6. 일정 변경 요청 결과 (승인/거절)
- **본문**: 기존/요청/확정 3줄+상품+**총금액·당일 잔금**(유일 통지일 수 있어 필수)+메모. 거절 시 기존 유지+회신 유도.
- **위치**: `sendRescheduleDecisionEmail_` :13209

### B7. 촬영연기 재예약 링크 — 새 일정 선택 버튼, "예약금/결제 내역 유지" 명시. :17836
### B8. 촬영 24시간 전 리마인더 — 일시·상품·오시는길/주차, "10분 전 도착". `sendBookingReminders_` :31515
### B9. 문의 스레드 답장 알림 — 답장 원문+"대화 이어서 보기" 포털 버튼. :12847
### B10. 계약서 서명 요청 (PDF) — 계약 표+서명 버튼(HMAC 14일). `sendContractForAgent_` :36428
### B11. 서명 완료 계약서 (PDF) — 서명자·일시+서명본 첨부. :36698

## [C. 촬영 후~셀렉]

### C1. 촬영 미리보기 샘플
- **트리거**: `booking-sample-send`(오늘보드 원탭). dryRun 확인, 재발송 force, 빈 폴더 차단.
- **제목**: ko `촬영 미리보기 샘플을 보내드립니다` / en `A first look at your photos` / de `Ein erster Blick auf Ihre Bilder`
- **본문**: 샘플 보기 버튼 + **"보정 전 미리보기"** 기대치 문구 + 자유 메시지.
- **위치**: `sendBookingSampleAdmin` :27222

### C2. 사진 셀렉 안내 (셀렉 링크)
- **트리거**: `select-create` / `select-link-resend`([재발송] 접두) / 재촬영([재촬영본 추가] 접두).
- **제목**: ko `📷 사진 셀렉 안내 — ${name}님` / en `📷 Photo Selection — Dear ${name}` / de `📷 Fotoauswahl — ${name}`
- **본문**: 진행 5단계, 기본보정 n장·보너스·추가보정 단가, 기본 출력물, 픽업/우편. **법정 마감 고지**(3개월 체계·약관 연동) + "보정 2-3주". 버튼 2: 사진 보기·셀렉 시작.
- **위치**: `_sendSelectLinkEmail` :23624

### C3. 셀렉 리마인더 1차 / 최종통지(2·3차)
- **트리거**: 일일 잡 — 대기중 상태, 알림일 도달 시 단계별 1회. 종료된 예약 스킵(좀비 가드).
- **제목**: 1차 `사진 셀렉 리마인드`; 2차부터 `사진 셀렉 최종 안내 (마감 ${date})` / `Final notice` / `Letzte Erinnerung`
- **본문**: 최종은 **마감 미접수 시 약관에 따라 파일 삭제·보정 의무 종료**(§643 BGB 취지) + "회신 시 기한 조정". 버튼 라벨 3개국어(8/31 수리).
- **위치**: `_sendSelectReminderEmail_` :26378

### C4. 셀렉 제출 접수 확인 (고객 영수증) — ✅ 8/31 수리 완료 (그 전 3주 미발송)
- **트리거**: 고객 셀렉 제출 직후. `suppressCustomerEmail` 억제 가능.
- **제목**: ko `📷 사진 셀렉 접수 완료 — ${name}님` / en `Photo Selection Received` / de `Fotoauswahl erhalten`
- **본문**: 접수 내역(보정·추가금·포토카드·출력물·볼륨할인·수령방식·마케팅·총 추가금액+**결제 안내**)+선택 사진·출력물 목록+2-3주 소요 푸터(3개국어).
- **위치**: `_sendCustomerSelectReceipt` :26322

### C5. 셀렉 수정 제출 확인 — ✅ 8/31 신설 (그 전엔 고객 무통지)
- **제목**: ko `✏️ 사진 셀렉 수정 접수` / en `Photo Selection Updated` / de `Fotoauswahl aktualisiert`. C4와 같은 본문, "최종 기준" 문구.

## [D. 셀렉 제출 후~작업]

### D1. 보정본 완성 안내 — `select-retouch-send`. "보정본 확인" 버튼+✅최종 승인/✏️재수정(2회 한도, 링크 60일). :27314
### D2. 재수정 요청 접수 확인 — 횟수(n/2)·요청 내용 에코. :13576
### D3. 최종 승인 — 고객 메일 없음(웹 화면만; 관리자 통지만).
### D4. 당일 완결 납품 — 원본+보정본 버튼 2, **"보관 3개월"** 고지, dryRun·ALREADY_SENT 가드. `sendFinalDeliveryAdmin` :35303
### D5. 여권사진 전달 — `pass-photos-send`. 폴더 링크+**"유효기간 6개월(독일 관공서 기준)"**. :35182

## [E. 인화/수령]

### E1. 인화 완료 픽업 예약 안내 — 인화 완료 기록 시 자동 1회. 픽업 예약 버튼+영업시간+**미결제 추가금 수령 시 결제** 안내. `maybeSendSelectPickupInvite_` :24918
### E2. 픽업 예약/변경 확인 — 고객 예약 직후 자동; 어드민 수기는 notify 옵트인. :24893
### E3. 픽업 미예약 리마인더 — 5~30일 창, 평생 1회, 실행당 8건. 3갈래 안내(방문/예약/우편 전환). :25346
### E4. 우편 수령 전환 확인 — 주소 에코, 픽업 취소 고지. :25876
### E5. 인화물 우편 발송 완료 — handover 기록 시(notify:false 억제). 2-4 영업일, 미도착 시 회신. :25314

## [F. 취소/변경/환불]

### F1. 예약 취소 통지 (원클릭) — 환불액 표기 없음. :12928
### F2. 예약 취소 통지 (어드민 `booking-cancel`) — F1+**환불 금액** 조건부. :31021
### F3. 환불 처리 확인 — `booking-refund` **notify:true 옵트인**. 환불일·금액·방법·1-3 영업일. :30730
- 고객 취소요청·일정변경 신청 자체는 웹 화면 응답(고객 메일 없음, 관리자만 통지).

## [G. 마케팅/추천] (일일 잡, 1회 멱등, 기업 제외)

### G1. 촬영 후 감사 — 작업완료, 촬영 후 1~14일. 리뷰(구글/MRT)·인스타·바우처 공통 블록. :31669
### G2. 돌촬영 추천 — 백일 완료 후 150~240일. 10~11개월 권장·**€130+ 돌상 무료**·협력업체. :31705
### G3. 기념일 재촬영 — 가족 계열 완료 후 350~400일. :31742
### G4. 보정 후 후속 — 최종작업완료+발송 3~30일. 만족 확인+폴더 재링크. :31783

## [H. 견적/인보이스/굿샤인]

### H1. 견적서 발송 (PDF) — `quote-send`, 재발송 가드(force). 번호·총액·유효기한. :33431
### H2. 인보이스 발송 (PDF) ⚠ — `effectiveLang='de'` 하드코딩 + **전달받은 subject/body 무시**(:29930-29938). ko/en 고객도 항상 독일어, 어드민 커스텀 문구 무효. :30554
### H3. 굿샤인 발송 (PDF) ⚠ — 기본 본문 독일어 단일(버튼 라벨만 3개국어). 모바일 티켓 버튼+PDF. :34731

## [I. 관리자 내부 알림] (수신 ADMIN_EMAIL — 제목 접두 목록)

[포트폴리오 문의] · [상담] · [굿샤인 자동적용 실패] · [워크인 접수] · [새 예약(⭐재촬영)](확정/취소 원클릭) · [문의] 새 메시지 · [취소요청](바로 취소 버튼) · [일정변경요청] · [셀렉] 최종 승인 · [재수정요청](n/2) · [브리핑](D7) · [회계 인박스](D8) · [픽업예약/수령전환] · [사진셀렉]/[셀렉수정](Capture One 검색문자열) · 🖨️ 고객 출력 주문 · 아침 리포트/결제 일일검토(+주간 KPI) · [여권 발송]/[당일 납품] 사본 · [계약서명] · [견적 팔로업](D6) · 백업 실패 경고

---

## 남은 개선 후보 (우선순위순 — 사장님 결정 대기)

1. **B4 자동취소 통지 한국어 단일** — en/de 고객이 취소 사실을 못 알아들을 수 있음. 3개국어화 권장.
2. **H2 인보이스 메일 de 하드코딩 + subject/body 인자 무시** — ko/en 정의가 있는데 도달 불가. 언어 분기 복원 + 커스텀 문구 반영.
3. **잔금 결제 확인 고객 메일 없음** — 계약금 확인(B2)과 비대칭. 현장 대면 결제가 대부분이라 불필요할 수도(결정 필요).
4. **용어 통일**: 같은 돈이 확정 메일에선 "계약금", 입금확인·리마인더에선 "예약금".
5. **H3 굿샤인 본문 독일어 단일** — ko 구매자 대응 3개국어화.
6. 언어 폴백 혼재(ko 폴백 vs de 폴백 혼용), en 셀렉 제목 "— Dear ${name}" 어색.
7. A7: **자동취소 시 대기자 알림이 안 나감** — 취소 2경로에만 연결됨.
