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
  - 상세 패널에 시간별 가격표가 아직 남아 있어 제거 필요
- Common
  - 인보이스용 주소는 선택 입력
  - 재방문 할인은 백엔드 검증 기반
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
- 실세션 기준 최종 회귀 점검은 아직 필요

## Known Open Items

1. 기업/행사 상세 패널의 시간별 가격표 제거
2. Booking 모바일 하단 버튼 / 경고문 / 달력 헤더 최종 마감
3. Booking 단계별 로딩 카드 디자인 일관성 개선
4. 실예약 1건 기준 end-to-end 검증
   - 시트 저장
   - Google Calendar 생성
   - Apple Calendar 반영 여부
   - 고객 메일 수신
   - 관리자 수정
5. Select 실세션 기준 신규 제출 / 수정 제출 / 추가 인화 검증

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
