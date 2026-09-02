# Current Status

Updated: 2026-09-02 Europe/Berlin (@908 기준). **변경 이력은 여기 아님** — 최신 사실은 `docs/update-roadmap.md`의 "Done Recently" + `git log`가 정본. 이 파일은 구조 지도만 유지한다.

## Resume Order

1. 이 파일 (구조 지도)
2. `docs/update-roadmap.md` — Done Recently 섹션
3. `git log --oneline -15`

## Live Endpoints / IDs

- Booking: `https://booking.studio-mean.com` · Select: `https://select.studio-mean.com` · Portfolio: `https://studio-mean.com`
- 메인 GAS 웹앱: `https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec`
- 메인 Script ID: `1AETZGNAJEe2X1MKclKMmQv_Jr_Z2MgJIUAzlis-Y4HwQBbf11rFX1sJa` · Spreadsheet: `1STWAMt30xku--NnFDHp1WOgpdGNQCH8T9Y0mZP6H8fI`
- board-api(경량 GAS, 오늘촬영 보드 읽기 전용): `appscript-board/` — 재배포는 반드시 `clasp deploy -i AKfycbyuoQ1SyEi1AWllRt-1eFR9UDJFMUCjbaOSTOcqAFKHkQ2F2tAGWpQJmHZcMY8_sDzIGQ`
- GitHub: `https://github.com/studiomeande-bit/booking` (frontend/docs만 커밋 — appscript는 clasp push 전용, git 미커밋이 정상)

## Architecture Map

- **`appscript/Code.gs`** (~36k줄) — 백엔드/ERP 전부: 공개 예약·셀렉 API, 어드민(AdminV2.html), 자동화 트리거, erp-agent 액션 148+. 시트=DB, 구글캘린더=가용성 정본, 애플캘린더('사진촬영 일정' iCloud) 연동.
- **`appscript-board/`** — 오늘촬영 보드 고속 읽기 경로(1.4s vs 메인 4.5~8s 로드 고정비). `Board.gs`는 **생성 파일**(`node scripts/build-board-api.mjs`) — 직접 수정 금지, 보드 로직은 Code.gs가 정본.
- **`frontend/booking/`** — 예약 프론트(3개국어, 단계형). 번들 커밋물: `cd frontend && npm run build && npm run stamp` 후 push.
- **`frontend/select/v2/`** — 셀렉/보정/인화 플로우(v1 은퇴, 크림+그린 톤 확정). 보정본엔 시그니처 10×15 인화 쿼터 포함.
- **`frontend/portfolio/`** — 24페이지 3개국어 SEO/법정 사이트. 리디자인은 브랜치+PR 프리뷰 후 머지.
- **`scripts/erp-agent.mjs`** — 자동화 키 인증 CLI(키: `.secrets/erp-automation-key`, 출력 금지). 액션 정본은 `actions-list`. **`--json '{...}'` 외 플래그는 조용히 무시됨.**
- **git 밖 형제 시스템** (`../dashboard/`, `../photo-print/`): 오늘촬영 Swift 앱(mac), 인화 앱(런처 `인화프린트.app` → 로컬 헬퍼 127.0.0.1:17600이 서빙+lp 자동출력). 인화 앱 소스는 `../photo-print/index.html`, 배포는 `scripts/build-print.mjs`.

## Deployment

- 메인 GAS: `clasp push -f` 후 **라이브 배포 ID로 `clasp deploy -i AKfycbxnHuB2u4-...`** (push만으론 /exec 미반영, 트리거는 push만으로 반영). 버전 200개 한도 주의.
- board-api: 위의 -i 규칙 필수.
- 프론트: main push → Netlify 자체 빌드. 수동 `?v=` 캐시버스팅 금지.
- 상세: `docs/deployment.md`, 운영 점검: `docs/ops-checklist.md` + `erp-agent ops-checklist` 액션.

## 상주 자동화 (재제안 금지)

예약 E2E(시트+캘린더+3개국어 메일+.ics), 리마인더/촬영후감사/보정완료/돌추천 메일, D7 아침 브리핑(flow-gaps 자가진단 포함), D6 견적 팔로업, D8 인보이스 메일 수집, SumUp 15분 동기화, 은행 CSV 임포트+매칭, 계약금 5일 경고/10일 자동취소(+대기자 알림), Gutschein V2, MRT 메일 동기화, 일일 백업, 데이터 위생 감사(신원 쪼개짐·전화 위생). 로컬: Capture One 세션 동기화, RAW 셀렉 복사, 인스타 파이프라인(`../automation/`).

## 운영 철칙 (사고 이력 기반)

- 고객 메일은 **명시 지시 시에만**(⚠️외부발송 표기 액션 주의). booking-update 정정은 **notify:false + 사전 booking-get**.
- 열 접근은 인덱스로(`headers.indexOf` 금지), 새 열은 맨 뒤. STMIN 연번은 생성 즉시 소모.
- 가격·상품 문구는 '상품설정' 시트가 정본(Code.gs 상품배열은 dead seed).
- 세무·회계는 `../../2026년 kontoauszug/CLAUDE.md` 먼저. Lexware는 완전 은퇴(2026-07-16) — 재제안 금지.

## Known Open Items

- 인화앱 쓰기 라우트(print-auth/print-result-upload) — 보안 보강 선행, 미착수.
- 보류 메일 2건: 잔금 결제 확인 고객 메일, 굿샤인 본문 3개국어화 (사장님 결정 대기).
- 깨진 전화 5건(브리핑 감사가 매일 상기) — 실번호 확보 시 보정.
- 드레스 소품 사진 촬영 + EN/DE 문구 검수, 인화 실물 테스트 1장 (사장님 액션).
