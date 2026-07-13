# 고객 예약 상태 포털

작성일: 2026-07-12 Europe/Berlin
대상: `appscript/Code.gs` (백엔드) + `frontend/booking/status/` (신규 페이지)

## 배경

마스터플랜이 "가장 큰 공백"으로 꼽은 항목 — 고객이 예약 후 자기 예약 상태를 볼 수 있는 포털이 없었음.
조사 결과 **변경/취소 셀프서비스는 이미 존재**(확정/접수 메일의 HMAC 서명 링크 → `customerRescheduleForm_`/`customerCancelRequest_`)했고,
행+HMAC 토큰(`createBookingRowActionRef_`)도 이미 있었음. 빠진 건 "상태를 한눈에 보는 페이지"뿐.

## 구현 (신규 컬럼 없음, 기존 흐름 재사용)

### 백엔드 (`Code.gs`)
- `getBookingStatusForCustomer_(ref)` — 토큰(`row:N:hmac`)으로 예약행을 찾아 **고객 안전 뷰** 반환:
  상태/상태라벨(다국어), 상품(현지화), 일시·인원·장소, 총액·계약금·잔금 + 입금여부, 결제수단, 요청사항, 재방문,
  그리고 **변경/취소 서명 URL**(기존 `createActionLink_` 재사용, `대기중/확정됨/변경대기`일 때만)
- `getBookingPortalUrl_(eventId)` / `getBookingPortalRefByEventId_` — 메일에 넣을 포털 링크 생성 (row+HMAC 토큰)
- `getBookingStatusCustomerLabel_` — 상태값 → ko/en/de 친절 라벨
- 공개 라우트 **`booking-status`** 추가 (읽기 전용, GET/POST)
- **읽기 전용**: 변경/취소는 별도 mutation을 추가하지 않고 검증된 기존 서명 링크로 이동 → blast radius 최소

### 이메일
- 접수(pending) / 확정(confirmed) 고객 메일의 셀프서비스 버튼 줄에 **"🔎 내 예약 확인·관리"** 버튼 추가 (기존 변경/취소 버튼 앞)

### 프론트 (`frontend/booking/status/`)
- `index.html` + `status.js` + `status.css` — **빌드 불필요한 순수 JS** (contact-lead.js와 동일 방식)
- `?ref=<토큰>` 조회 → 상태 카드 / 결제 카드(입금 칩) / 변경·취소 / 오시는길·문의
- ko/en/de 전환, 상태 라벨·요약·배지 모두 클라이언트 현지화
- 잘못/만료 링크 → 안내 카드(이메일 재안내). noindex.
- netlify.toml에 `/status` 리다이렉트 + noindex 헤더 추가

## 검증

- 백엔드 구문 검사 통과, 심볼 존재 확인, 프로덕션 라우트 프로브(배포 후)
- 프론트 로컬 브라우저: 성공 렌더(상태·결제·재방문·요청사항), 언어 전환(ko/en/de) 배지·라벨 반영, 변경/취소 버튼, 잘못된 링크 에러 카드 — 모두 확인

## 배포

1. `appscript/`: `clasp push` + `clasp deploy` (booking-status 라우트 + 메일 링크)
2. `frontend/`: git push → Netlify (booking 사이트에 /status 추가)
   - 순서 무관하나, 메일에 포털 링크가 나가므로 **프론트가 먼저/동시** 배포되는 게 좋음
3. 검증: 실예약 1건의 확정 메일 → "내 예약 확인·관리" 클릭 → 상태 페이지 정상 표시 + 변경/취소 링크 동작

## 후속(선택)
- "안내 메일 다시 받기" 버튼(현재 없음 — 새 mutation 필요)
- 셀렉 링크가 있으면 포털에서 바로 잇기
- 촬영 전 준비 체크리스트 노출
