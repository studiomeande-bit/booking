# Current Status

Updated: 2026-05-08 Europe/Berlin

## Live Endpoints

- Booking frontend: `https://booking.studio-mean.com`
- Select frontend: `https://select.studio-mean.com`
- Apps Script web app: `https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec`

## Repositories / IDs

- GitHub repo: `https://github.com/studiomeande-bit/booking`
- Apps Script Script ID: `1AETZGNAJEe2X1MKclKMmQv_Jr_Z2MgJIUAzlis-Y4HwQBbf11rFX1sJa`
- Spreadsheet ID: `1STWAMt30xku--NnFDHp1WOgpdGNQCH8T9Y0mZP6H8fI`

## Current Structure

- Frontend booking:
  - `frontend/booking/index.html`
  - `frontend/booking/booking.js`
  - `frontend/booking/booking.css`
  - `frontend/booking/studio-mean-logo.png`
- Frontend select:
  - `frontend/select/index.html`
  - `frontend/select/select.js`
  - `frontend/select/select.css`
  - `frontend/select/studio-mean-logo.png`
- Apps Script backend/admin:
  - `appscript/Code.gs`
  - `appscript/Admin.html`

## Compressed Progress

- 고객 예약/셀렉 화면은 Netlify 정적 프론트로 분리됨
- 관리자 ERP, 시트, 캘린더, 메일은 Apps Script 유지
- Booking은 단계형 흐름으로 재구성됨
  - 1. 촬영 종류
  - 2. 세부 상품/옵션
  - 3. 날짜 및 시간
  - 4. 예약 정보
- 날짜와 시간은 한 화면에서 선택
- 상품 선택 후 현재 달 즉시 로딩, 다음 달과 다다음 달은 백그라운드로 프리패치
- 월 API는 해당 월의 불가 날짜만 내려주는 경량 구조로 변경됨
- 슬롯은 날짜 클릭 시 별도 조회
- Booking submit은 Apps Script 공개 API로 연결됨
- 성공 화면은 별도 완료 카드로 전환됨
- 상품별 완료 안내가 추가됨
  - 여권/비자 안내
  - 영유아 여권/비자 안내
  - 프리웨딩 안내
  - 돌상 무료 셋팅 안내
  - 공통 오시는 길 / 주차 안내
- 예약 메일 안내문도 확장됨
- 예약 확정 메일에 고객용 `.ics` 캘린더 파일 첨부가 추가됨
  - 캘린더 메모에는 시간, 장소, 상품, 인원, 총금액, 계약금, 잔금, 결제/입금 안내, 지도 링크, 연락처, 요청사항 포함
- Select는 운영형 성공 화면, 인보이스 번호, 추가 비용 요약까지 반영됨
- 촬영 후 감사 메일 / 보정본 완료 후 메일 / 백일 촬영 후 돌촬영 추천 메일 자동화가 추가됨
- 기본 구글 리뷰 링크와 인스타 태그 링크가 메일에 반영됨

## Booking Rules Implemented

- Passport
  - 카테고리 선택 후 단일 상품이 자동 선택됨
  - 1명 기본 선택
  - 사람별로 복수 국가 선택 가능
  - 리뷰와 제출 메모에 사람별 국가 정보 반영
  - AI/마케팅/전체선택 동의 숨김
- Profile
  - Kids 할인 `-10€`
  - Basic: 영유아 비활성, 시니어 평일 무료
  - Business: 시니어 평일 `-50€`
  - Professional: 시니어 평일 `-50€`, 토요일 `-30€`
- Studio
  - 기본 2인
  - 배경 선택 지원
- Outdoor
  - 기본 2인
  - 1인 `-30€`
  - 3인부터 `+30€`씩
  - 의상 추가 / 반려동물 옵션
- Baby / Birthday
  - 필요 시 아기 이름 필수
  - 돌상 무료 셋팅 안내 추가
- Business / Event
  - 카드 설명에 돌잔치촬영, 결혼식, 암트결혼식, 기업행사 포함
  - 고객 화면은 상담형 견적 구조
  - 상세 패널과 완료 안내는 시간별 가격 노출 대신 상담 견적 문구로 정리됨
- Common
  - 인보이스용 주소는 선택 입력
  - 당일 재촬영 할인은 백엔드 검증 기반
  - 새 예약이 여권/비자면 할인 제외
  - 이전 촬영이 여권/비자이고 새 예약이 프로필/스튜디오 등 다른 상품이면 할인 가능
  - 모바일 캘린더는 날짜/시간 선택 단계 안에서 유지되도록 조정됨
  - 현재 시각 기준 3시간 이내 슬롯 차단
  - 2026년까지만 예약 허용

## Backend Status

- Apps Script public APIs in use:
  - `init`
  - `quote`
  - `calendar-batch`
  - `slots`
  - `return-check`
  - `booking`
  - `select-session`
  - `select-submit`
  - `select-update`
- Customer booking still saves to sheet, creates calendar event, sends customer/admin emails
- Confirmed booking email now attaches `studio-mean-booking.ics`
- Admin dashboard booking E2E diagnostics are implemented in Apps Script HEAD
  - base check verifies public booking API, booking frontend, product loading, return-discount calculation, booking sheet headers, Calendar access, mail quota, and latest booking linkage
  - optional probes can create/delete a temporary Calendar event or send an admin-only test mail
  - production deployment is pending Apps Script Project History version cleanup
- Select link sending supports per-booking marketing bonus quantity
  - MyRealTrip bookings default to 5 bonus retouches
  - regular bookings default to 2 bonus retouches
  - Apps Script HEAD preserves edited base retouch and marketing bonus counts on select-link resend
  - production deployment is pending Apps Script Project History version cleanup
- Admin settings includes same-day reshoot discount audit / repair
- Reshoot discount audit / repair excludes passport / visa only as the target booking; passport / visa can be the source booking
  - scans recent bookings by submission time, not only the current day
  - verifies name plus phone suffix or email match
  - applies missing discount to total, balance, return flag, memo, and calendar memo
- Gutschein V1 ledger now includes tax-safe tracking fields
  - `발행시점세율`, `세무판단근거`, `실제사용상품ID`, `실제사용상품명`, `실제사용일시`
  - Admin Gutschein tab has a `세무필드 보정` action for existing voucher rows
  - voucher PDF includes visible SPV / MPV tax timing wording
- Admin update / reschedule / cancel flows remain on Apps Script
- Follow-up mail related columns added:
  - 예약장부: `촬영후감사메일발송일시`, `돌촬영추천메일발송일시`
  - 사진셀렉: `보정후안내메일발송일시`

## Calendar / Performance Status

- 월 API는 `slotsByDate` 사전 계산을 제거한 경량 버전임
- 월 데이터는 프론트 `localStorage` 캐시와 서버 `CacheService`를 같이 사용
- 상품 선택 시 현재 달 먼저 로딩하고 이후 두 달을 백그라운드로 채움
- 모바일 달력/시간 패널 레이아웃은 여러 차례 보정됨
- 남은 성능 이슈:
  - 다다음 달 이후 로딩 체감이 여전히 느릴 수 있음
  - 모바일 달력 헤더와 로딩 카드의 미세 조정 필요

## Apple Calendar Status

- 코드상 연동 함수는 존재:
  - `fetchAppleCalendarEvents_()`
  - `createAppleCalendarEvent_()`
  - `getIcloudCalUrl_()`
- 실제 동작 여부는 Script Properties 값 필요:
  - `APPLE_ID`
  - `APPLE_APP_PASSWORD`
  - `ICLOUD_CAL_URL` 또는 `ICLOUD_CAL_URL_1...`
- 코드 보완은 끝났지만 실운영 데이터 기준 회귀 점검은 필요

## Select Status

- 로딩 오버레이 추가
- PNG 로고 적용
- raw JSON 결과 제거
- 성공 화면 추가
- 추가 비용 / 인보이스 번호 / 드라이브 링크 요약 반영
- 기존 제출 복원 / 수정 제출 경로 반영
- 갤러리 로딩 안정화 반영
  - Apps Script Drive 목록 API는 900장 제한, 24초 time budget, 부분 응답, CacheService v3 사용
  - Drive 폴더 공유 권한은 파일별 반복 변경 대신 루트 폴더 기준으로 1회만 확인
  - 고객 화면은 28초 timeout, 재시도 버튼, 부분 로딩 안내를 제공
  - Drive thumbnail endpoint와 CSP-safe image event listener로 운영 미리보기 161장 로딩 확인
- 실세션 기준 최종 회귀 점검은 아직 필요

## Known Open Items

1. Booking 모바일 하단 버튼 / 경고문 / 달력 헤더 최종 마감
2. Booking 단계별 로딩 카드 디자인 일관성 개선
3. 실예약 1건 기준 end-to-end 검증
   - Apps Script Project History에서 미사용 버전 삭제 후 운영 배포
   - 먼저 Admin `예약 E2E 진단` 기본 점검 / 캘린더 쓰기 / 메일 점검 실행
   - 시트 저장
   - Google Calendar 생성
   - Apple Calendar 반영 여부
   - 고객 메일 수신
   - 관리자 수정
4. Select 실세션 기준 신규 제출 / 수정 제출 / 추가 인화 검증

## Accounting / Lexware Status

- Lexware 연결 방식은 OAuth 앱이 아니라 `Public API key` 기준으로 구성됨
- `organization id`는 필수 입력값이 아니라 연결 테스트 시 `/v1/profile`에서 자동 확인/보정
- 확보 및 설정 완료:
  - `LEXWARE_API_KEY`
  - `LEXWARE_ORGANIZATION_ID`
  - `LEXWARE_ENABLED`
- AdminV2에 반영된 UI:
  - 설정 탭 `📚 Lexware 연동`
  - 인보이스 탭 `점검/전송`, `💶 상태`
  - 예약장부 `💶결제`
  - 회계 장부 `🔗 Lexware 대조`, `⬇️ Lexware 가져오기`, `🩺 Lexware 진단`
- Lexware 전송은 실제 외부 문서를 생성하므로, 신규 인보이스 생성 직후 자동 전송은 기본 비활성화
- `점검/전송` 클릭 시 서버에서 Lexware 설정, 연결, 고객, 이메일, 주소, 품목, 금액, 연락처 상태를 먼저 확인하고 전송 불가 항목이 있으면 실제 전송을 막음

## Lexware Diagnostic Result

- 연결 테스트는 성공
- 2026-05-06 HTTP smoke test:
  - Company: `Taewoong Min (Studio_mean)`
  - Tax type: `net`
  - Contacts: `4`
- 진단 결과:
  - `Contacts: 4`
  - `Invoices: 0`
  - `Voucherlist: 0`
- 결론:
  - 현재 Lexware Public API에서 읽히는 `invoice/voucher`가 없음
  - 따라서 `⬇️ Lexware 가져오기`로 예약/회계 자료를 역으로 자동 매칭할 대상이 없음
  - Lexware 화면에 보이는 SumUp/은행 흐름이 있어도, Public API 기준 invoice/voucher 문서가 아니면 현재 구조로는 가져오지 못함

## Lexware Integration Decision

- 현재 프로젝트의 주 흐름은 아래로 정리됨
  1. 우리 시스템에서 예약/추가금 인보이스를 먼저 Lexware로 생성
  2. 인보이스는 `finalize=true`로 생성해서 Lexware 결제 상태 조회가 가능한 `open` 문서로 만듦
  3. 이후 `💶 상태`로 Lexware 결제 상태를 읽어옴
  4. 예약장부/인보이스/회계장부의 계약금, 잔금, 미수금을 갱신
- 즉 `Lexware -> admin 역가져오기`는 보조 기능이고,
- 핵심 자동화는 `admin -> Lexware -> payment status back` 구조임
- 기존에 draft로 생성된 문서는 결제 조회가 406으로 막힐 수 있으므로 `재전송`으로 새 open 문서를 생성하고 행의 Lexware ID를 교체

## Receivables Logic Decision

- 이전에는 로컬 입금 필드가 비어 있으면 미수금처럼 보이는 문제가 있었음
- 현재는 아래 우선순위로 판정
  1. Lexware `openAmount / paymentStatus`가 있으면 그것을 우선
  2. 없을 때만 로컬 `미결제/부분결제` 신호 사용
  3. 단순히 결제수단이 `현금/카드/계좌이체`이고 미결제 표시가 없으면 자동 미수로 보지 않음
- 아직 사용자가 체감하는 미수금/완납 상태 검수는 더 필요

## Accounting Direction Agreed

- UI는 한국어로 보여도
- 회계 내보내기 값은 독일어 기준으로 정리
- 월별 / 분기별 / 반기별 / 연도별 보기 유지
- DATEV/세무사 CSV와 요약 CSV 제공
- 계약금 있는 상품:
  - 확정 후 입금 확인
  - 5일 미입금 경고
  - 10일 미입금 자동 취소
- 계약금 없는 상품:
  - 환불 규정 메일 제외

## Bank CSV Import Decision

- Deutsche Bank CSV는 `결제대조`에 입금/출금을 모두 원장 그대로 저장
- 은행 출금:
  - `은행 출금 지출장부 자동 반영` 옵션으로 지출장부에 `bank_out:` 로컬 증빙 ID 생성
  - 대표자/개인 이체, 사적 이체로 보이는 건은 비용 자동반영 제외
- 은행 입금:
  - `은행 입금 예약금/잔금 자동 확인` 옵션으로 고객 계좌이체를 예약장부의 계약금/잔금과 자동 매칭
  - 금액 + 입금자/고객명 + 촬영일 관계로 점수화하고, 애매한 입금은 검토 항목 유지
  - SumUp 정산 입금, 대표자 이체, 세무 환급은 예약금 자동확인 대상에서 제외

## Payment Matching Direction

- 예약페이지에는 결제 시스템을 연결하지 않음
- 예약페이지는 접수/견적/일정 선택까지만 담당
- 실제 결제 흐름은 어드민에서 아래 3개 채널로 관리
  1. 현장 카드: SumUp 거래내역 API를 15분 간격으로 조회해 `결제대조`에 저장하고 예약장부 잔금/전액과 자동 매칭
  2. 현금: 외부 데이터가 없으므로 데일리 검토 메일에 `현금 수납 확인` 항목으로 표시하고 현장 확인 후 수동 반영
  3. 계좌입금: Deutsche Bank CSV 기준으로 입금/출금을 대조하고, 입금은 예약장부 계약금/잔금과 자동 매칭
- AdminV2 설정 탭에 `SumUp 카드결제 대조` 카드 추가
  - `SUMUP_API_KEY`
  - `SUMUP_MERCHANT_CODE`
  - `SUMUP_ENABLED`
  - `SUMUP_LAST_SYNC_AT`
- API key 입력 후 Merchant Code가 비어 있으면 `/v0.1/me` 프로필 조회로 Merchant Code 자동 확인/저장을 시도
- 자동화:
  - `syncRecentSumupTransactionsTrigger`: 15분마다 SumUp 최근 거래 동기화
  - `dailyTasks`: SumUp 동기화 후 결제 일일검토 메일 발송
- SumUp 카드 매칭은 금액 + 촬영일 + 결제수단 + 이름 단서로 점수화
  - 이름 단서가 없어도 같은 날/같은 금액의 유일 후보면 매칭 가능
  - 후보가 애매하면 예약장부를 자동 수정하지 않고 검토 항목으로 유지

## Important Lexware Limitation

- `인보이스 없는 일반 카드 결제건`은 Lexware와 완전 자동 동기화가 어려움
- 이유:
  - Public API가 안정적으로 연결 가능한 기준은 주로 `invoice / voucher`
  - 단순 카드 결제/은행 흐름만 있고 대응 문서가 없으면 예약과 자동 연결 불가
- 향후 선택지:
  1. 즉시결제 건에도 Lexware 문서를 생성
  2. 그렇지 않으면 집계형 회계 처리만 수행

## Recommended Next Step

1. Lexware 인보이스 `📚 전송 -> 💶 상태` 실제 1건 검증
2. 계약금/잔금/미수금이 예약장부와 회계장부에서 어떻게 바뀌는지 확인
3. 그 다음 필요 시
   - 즉시결제 카드 매출의 Lexware 문서화
   - SumUp 또는 은행 CSV 연동

## Important Operational Note

- 로컬에는 `appscript/Admin.html` 사용자 변경이 남아 있음
- Git 커밋에는 포함하지 않았더라도 `clasp push`는 `appscript` 전체를 올리므로 운영 Apps Script에는 함께 반영될 수 있음
- 다음 배포 전 `appscript/Admin.html` 변경이 의도된 것인지 확인 필요

## Resume Order

1. `docs/current-status.md`
2. `docs/update-roadmap.md`
3. `git log --oneline -15`
4. `frontend/booking/booking.js`
5. `appscript/Code.gs`
6. Continue with open items in this order:
   - remove business price table
   - booking mobile/layout polish
   - end-to-end verification
   - select real-session verification
