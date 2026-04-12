# Current Status

Updated: 2026-04-13 Europe/Berlin

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
- Apps Script backend/admin:
  - `appscript/Code.gs`
  - `appscript/Admin.html`

## Compressed Progress

- 고객 예약/셀렉 화면은 Netlify 정적 프론트로 분리됨
- 관리자 ERP, 시트, 캘린더, 메일은 Apps Script 유지
- booking은 단계형 흐름으로 재구성됨
  - 1. 촬영 종류
  - 2. 세부 상품/옵션
  - 3. 날짜 및 시간
  - 4. 예약 정보
- 날짜와 시간은 한 화면에서 선택
- 실제 Google Calendar 기반 시간 슬롯 표시 복구
- booking submit은 Apps Script 공개 API로 연결됨
- 성공 화면은 별도 완료 카드로 전환됨
- 상품별 완료 안내 추가
  - 여권/비자 상세 안내
  - 프리웨딩 상세 안내
  - 돌상 무료 셋팅 안내
  - 공통 오시는 길 / 주차 안내
- 예약 메일 안내문도 확장됨
- booking 디자인 정리 진행
  - 초기 로딩 화면 추가
  - 폰트 두께 완화
  - 카드/버튼/완료 화면 스타일 정리
  - 실제 업로드된 PNG 로고 연결

## Booking Rules Implemented

- Passport
  - 국가 선택 필수
  - 기타 국가명 입력 필수
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
- Common
  - 인보이스용 주소는 선택 입력
  - 재방문 할인은 백엔드 검증 기반

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
- Admin update / reschedule / cancel flows remain on Apps Script

## Latest Important Deploy State

- GitHub `main` latest booking/logo commit reflected
- Apps Script existing web app updated through deployment `@250`
- Booking frontend live checks already confirmed:
  - calendar renders
  - time slots render for valid dates
  - logo loading screen markup present

## Remaining Work

### 1. Booking final parity

- 상품별 원본 안내문/예외 규칙 마지막 대조
- 기업/행사 상품 구조 재설계
- 완료 화면 문구 다국어 정리
- 모바일 spacing / hierarchy 마감

### 2. End-to-end verification

- Netlify booking submit -> sheet save
- customer mail delivery
- admin notification
- admin edit/reschedule/cancel on Netlify-created booking

### 3. Select parity

- 실 세션 링크 검증
- 기존 제출 복원 / 수정 제출
- 추가 인화 / 추가 보정 UI 최종 점검

## Resume Order

1. `docs/current-status.md`
2. `git log --oneline -10`
3. `frontend/booking/booking.js`
4. `appscript/Code.gs`
5. Continue with booking final parity, then end-to-end verification, then select parity
