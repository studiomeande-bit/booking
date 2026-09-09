# Studio mean Reservation Platform

예약·셀렉·ERP 플랫폼 모노레포. **현재 상태와 구조 지도는 [docs/current-status.md](./docs/current-status.md)가 정본** — 여기서부터 읽을 것.

## Structure

- `frontend/` — Netlify 고객 프론트 (booking / select / portfolio)
- `appscript/` — 메인 GAS 백엔드 + 어드민 ERP (clasp push 전용, git 미커밋이 정상)
- `appscript-board/` — 오늘촬영 보드용 경량 GAS (Board.gs는 생성 파일)
- `scripts/` — erp-agent CLI, 빌드/생성 스크립트
- `docs/` — 기능별 문서. 진입: [current-status.md](./docs/current-status.md) → [update-roadmap.md](./docs/update-roadmap.md)

## Key docs

- [Current Status](./docs/current-status.md) · [Update Roadmap](./docs/update-roadmap.md)
- [Architecture](./docs/architecture.md) · [API Spec](./docs/api-spec.md) · [Deployment](./docs/deployment.md) · [Ops Checklist](./docs/ops-checklist.md)
