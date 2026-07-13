# 고객 예약 포털 후속 기능 (안내 메일 재발송 · 셀렉 링크 · 준비 체크리스트)

작성일: 2026-07-13 Europe/Berlin
대상: `appscript/Code.gs` (백엔드) + `frontend/booking/status/` (포털)
배경: [[customer-booking-portal.md]]가 "후속(선택)"으로 남겨둔 항목 3개를 구현. 모두 기존 흐름 재사용, 신규 시트/컬럼 없음, blast radius 최소.

## 1) 안내 메일 다시 받기 (확정 예약 한정)

- **왜 확정만**: 계약금 계좌·`.ics`·오시는 길이 담긴 확정 메일이 "다시 받을" 실질 가치가 있는 케이스. 미확정 예약은 포털에 모든 정보가 이미 떠 있고 계좌 정보도 아직 없음.
- **백엔드** `resendBookingInfoEmailForCustomer_(ref)`
  - 포털 ref(HMAC)로 예약행 인증 → 상태가 `확정됨`이 아니면 `{ok:false,reason:'not_confirmed'}`
  - 이메일 유효성 검사(`no_email`), 예약행 단위 **90초 쿨다운**(`resend_info_<행>`, `cooldown`)
  - `confirmBookingAndSendEmailAdmin`과 동일한 방식으로 행에서 인자를 복원해 **기존 `_sendConfirmEmail` 재사용** — 단, 상태/캘린더 변경 같은 **부작용 없음**
- **공개 라우트** `booking-status-resend` (POST, `requestId` 중복방지) — 소프트 실패는 `reason` 코드로 반환해 프런트에서 현지화
- **포털 UI**: 결제 카드 하단 "📧 안내 메일 다시 받기" 버튼(`data.canResend`일 때만) + 결과 힌트(성공/쿨다운/미확정/실패, ko·en·de)

## 2) 셀렉(사진 선택) 링크 연결

- **백엔드**: `getBookingStatusForCustomer_`가 `findSelectSessionForBookingRow_(ss, 예약행)`로 예약에 연결된 셀렉 세션(세션ID 있는 최근 행)을 찾아 `selectUrl` / `selectSubmitted` 반환. 세션 없으면 노출 안 함.
- **포털 UI**: 세션이 있으면 "📷 사진 선택" 카드 노출 — 미제출이면 "사진 선택하러 가기", 제출됨이면 "선택 확인·수정" (`select.studio-mean.com` v1/v2 URL 자동 판별)

## 3) 촬영 준비 체크리스트

- **프론트 전용**(백엔드 불필요). `data.itemGroup`(pass/prof/stud/snap/wed/biz) 기준으로 status.js의 `PREP` 사전에서 4항목 내외 체크리스트를 ko·en·de로 렌더.
- **다가오는 촬영만**: 상태가 `대기중/확정됨/변경대기`일 때만 노출. 촬영완료 이후엔 숨김. 미지정 종류는 `_default`.

## 검증

- Code.gs `node --check` 통과, 참조 심볼(`_sendConfirmEmail`, `findBookingRowByActionRef_`, `buildSelectSessionUrl_`, `parseMoneyValue_` 등) 존재 확인
- 프론트 로컬 브라우저(fetch 목 하네스, 440×1500)에서 시나리오별 확인:
  - 확정+세션: 재발송 버튼 노출→클릭→성공 힌트, 셀렉 "사진 선택하러 가기", stud 체크리스트
  - 미확정+제출됨(pass): 재발송 숨김, 셀렉 "선택 확인·수정", 여권 체크리스트 노출
  - 촬영완료(wed): 재발송·체크리스트 숨김, 셀렉 카드 유지
  - 세션 없음(sel=0): 셀렉 카드 숨김
  - ko/en/de 라벨·체크리스트 모두 현지화, biz 체크리스트 확인
- 프로덕션 라우트 프로브(`booking-status-resend`)는 배포 후 확인

## 배포

- 프론트: git push → Netlify(booking). status 페이지 자산 캐시버전 `20260713-status2`로 상향.
- 백엔드: `clasp push` 후 **버전 200한도 정리 → `clasp deploy`** 필요. 배포 전까지 신규 라우트/필드가 프로덕션에 없으므로 포털은 기존 필드만 사용(안전).
