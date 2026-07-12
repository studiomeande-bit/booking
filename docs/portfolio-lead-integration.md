# 포트폴리오 문의 → 어드민 리드 통합

작성일: 2026-07-12 Europe/Berlin
대상: `frontend/portfolio/` (백엔드 무변경 — Apps Script `portfolio-lead` API·어드민 리드 탭은 기존 것 사용)

## 배경

마스터플랜 3단계. 포트폴리오 문의폼이 PHP `mail()`로 메일만 보내서 어드민 CRM(문의 리드 탭)에 리드가 남지 않았음.
백엔드(`createPortfolioLead_`: 리드 시트 저장 + 관리자 알림 + 고객 자동답장 + 허니팟/중복 방어)와
어드민 UI는 이미 완성돼 있었으므로, **폼 연결만** 추가.

## 구현: 점진적 개선(Progressive Enhancement)

새 파일 `contact-lead.js` — 3개 언어 컨택트 페이지(`/contact`, `/en/contact`, `/ko/contact`)에 포함.

동작:
1. `form[name="portfolio-contact"]` 제출을 가로채 Apps Script `?api=portfolio-lead`로 POST (text/plain JSON, booking 프론트와 동일 방식)
2. 페이로드: 폼 필드 전체 + `requestId`(중복 방지) + `bot-field`(허니팟) + `sourceUrl` + **URL의 utm_* 파라미터 자동 수집** + userAgent
3. 성공 → 서버가 주는 언어별 success 페이지로 이동 (`successPath`)
4. **실패/12초 타임아웃 → 기존 PHP(submit.php) 경로로 자동 폴백** — JS가 죽어도 문의가 유실되지 않음

메일 흐름: API 경로 성공 시 관리자 알림 + 고객 자동답장(신규). 폴백 시 기존과 동일(관리자 메일만).

## 검증 (로컬 브라우저 + 프로덕션)

- 인터셉트 → 페이로드 형태 캡처 검증: requestId/utm/site_language/허니팟/개인정보동의 모두 API 계약과 일치
- 성공 응답 → `/contact/success/` 리다이렉트 확인
- fetch 실패 주입 → `submit.php` 네이티브 폴백 확인
- 프로덕션 API 프로브(필수값 누락) → `문의 필수 항목이 누락되었습니다` 정상 검증 응답 (라우트 라이브 확인)

## 배포 (IONOS 수동 업로드)

포트폴리오는 IONOS 웹호스팅(수동 업로드)이므로 다음 4개 파일을 올리면 됨:

1. `contact-lead.js` (신규, 사이트 루트)
2. `contact/index.html`
3. `en/contact/index.html`
4. `ko/contact/index.html`

배포 후 확인: 문의 1건 테스트 제출 → 어드민 "문의 리드" 탭에 신규 리드 + 대시보드 "문의·상담" 카드 카운트 + 고객 자동답장 메일.
