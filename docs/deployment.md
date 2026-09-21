# Deployment

## Netlify sites

This repository is used by three separate Netlify sites. Each site folder has its own `netlify.toml` whose build command runs the same esbuild + `stamp` script as local (`npm --prefix .. run build:<site>-site`), so a `git push` to `main` rebuilds the bundles on Netlify. The committed bundles are still rebuilt locally before pushing (`cd frontend && npm run build:booking-site` / `build:select-site` / `build:portfolio-site`) — `stamp` writes a content-hash `?v=` on asset references, so never hand-edit `?v=`.

### Booking site

- Domain: `booking.studio-mean.com`
- Netlify site: `friendly-cucurucho-15e97a`
- GitHub repo: `studiomeande-bit/booking`
- Branch: `main`
- Base directory: `frontend/booking`
- Publish directory: `.`
- Build command: `npm --prefix .. install && npm --prefix .. run build:booking-site` (from `frontend/booking/netlify.toml`)

### Select site

- Domain: `select.studio-mean.com`
- Netlify site: `iridescent-biscotti-e27dfb`
- GitHub repo: `studiomeande-bit/booking`
- Branch: `main`
- Base directory: `frontend/select`
- Publish directory: `.`
- Build command: `npm --prefix .. install && npm --prefix .. run build:select-site` (from `frontend/select/netlify.toml`)

### Portfolio site

- Domain: `studio-mean.com`
- GitHub repo: `studiomeande-bit/booking`
- Branch: `main`
- Base directory: `frontend/portfolio`
- Publish directory: `.`
- Build command: `npm --prefix .. install && npm --prefix .. run build:portfolio-site` (from `frontend/portfolio/netlify.toml`)

## Netlify environment variables

Set on both sites:

- `API_BASE_URL=https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec`
- `SITE_MODE=production`

## Apps Script deployment

Run from the **repo root** — `.clasp.json` lives there with `rootDir: appscript` (there is no `appscript/.clasp.json`):

```bash
node scripts/check-sheet-date-compare.mjs   # 배포 전 게이트 — 시트 날짜셀 slice 패턴 적발(위반 시 exit 1)
clasp push -f                               # HEAD 업로드 — 트리거는 이것만으로 반영, /exec 웹앱은 미반영
clasp deploy -i AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w -d "@NNN 설명"
```

- `-i` 없이 `clasp deploy` 금지 — 새 배포 ID가 생겨 /exec 은 그대로, 버전 슬롯(200 한도)만 소모. 트리거는 push 만으로 반영.
- 이 배포 ID 하나가 유일한 라이브(프론트 `API_BASE_URL`·문서·메일 링크 전부 이것). 2026-09-20 현재 @969, 버전 슬롯 136/200 사용 — 한도에 닿으면 Apps Script 편집기 프로젝트 기록에서 옛 버전 수동 삭제.
- 배포 전 회귀 검증기·회귀 체크리스트는 `docs/ops-checklist.md` 가 정본 (여기서 중복 관리하지 않음).

### public-api (`appscript-public/`) — 예약 조회 셔틀

- 역할: 예약·셀렉 페이지 조회 `api=init · quote · calendar-batch · slots · slots-month · warm-months · select-session · select-photos` 만 서빙. `slots-month` 는 셔틀 전용(월 시더 dryRun — 캐시 무기록, 메인엔 없는 라우트라 프런트가 폴백하지 않고 날짜별 `slots` 로 동작). 제출·홀드·별점 저장은 메인.
- 스코프: calendar·spreadsheets(readonly 는 `openById` 거부) + **drive.readonly**(셀렉 사진 목록). 읽기 전용은 코드로 보장 — 생성기가 시트/속성 쓰기 호출을 스캔해 실패시킨다.
  Drive 의 `setSharing`(폴더 공유 넓히기)만 예외: Code.gs `listDriveFolderPhotosPublic_` 가 이미 공개된 폴더는 쓰지 않고, 셔틀(Shim 의 `PUBLIC_API_READONLY_`)에서 넓혀야 하면 `ok:false` 를 돌려 프런트가 메인으로 넘어간다.
- **manifest(스코프)를 바꾸면 사장님이 편집기에서 `setup()` 을 다시 실행**해야 한다(재승인) — **탭 새로고침 후** 실행(오래 연 탭은 '실행' 자동 저장으로 옛 코드·manifest 를 HEAD 에 되돌린다, 2026-09-20 사고). 그 전엔 새 스코프가 필요한 라우트만 실패하고 프런트는 메인으로 폴백한다.
- 셔틀 전용 캐시(Code.gs 가 `PUBLIC_API_READONLY_` 로 분기): 설정 맵 60초(`settings_map:v1`), 사진 목록 gzip 15분. 가용성 버전 `cal_cache_ver` 는 Shim `getCalCacheVer_` 가 설정 시트 셀을 직접 읽는다(캐시 지연 없음).
- `api=warm-months[&offset=0|1|2]`: 월 이벤트 캐시 선워밍(상품 무관). 예약 페이지가 열릴 때 3개월을 병렬로 쏜다 — 예약 직후(캐시 버전 상승)의 콜드 달력 7~12초를 방문자 고민 시간에 흡수. `getCachedMonthEvents_` 는 셔틀에서만 표식 기반 단일 비행(같은 월 중복 읽기 방지).
- **선요청 파일**: `frontend/booking/early-init.js`(api=init)·`frontend/select/v2/early-session.js`(api=select-session, `?id=`)가 `<head>` 맨 앞에서 셔틀 URL 을 **하드코딩**해 요청을 먼저 띄운다(`api-core.js takeEarlyResponse` 가 소비). 셔틀 배포 ID 는 `-i` 재배포라 바뀌지 않지만, 바꾸게 되면 `shared/config.js` 와 이 두 파일을 같이 고칠 것. CSP(`script-src 'self'`) 때문에 인라인 불가 — 파일로 두고 `npm run stamp`.
- 속성 동기화: `node scripts/erp-agent.mjs public-api-sync-props --json '{}'` — 메인 → 셔틀 POST `sync-props`(TOFU 다이제스트). Apple ICS 4종 + `ACTION_SECRET`(셀렉 세션의 철회 링크 서명이 메인과 같아야 함). 값은 구글↔구글로만 오가고 출력엔 키 이름만.
- 생성 파일: `Public.gs` ← `node scripts/build-public-api.mjs` (정본 Code.gs, 직접 수정 금지). `Shim.gs` 가 DB 해석·라우팅·워밍 트리거.
- 배포: `node scripts/build-public-api.mjs && cd appscript-public && clasp push -f && clasp deploy -i AKfycbyb1y964F-MAO4-043gq3LdIg9fPqXb-My_1iV1qcjQwQIiZnfMl17i0wAnRBn6tAj6`
- 스크립트 ID `1uu8qRws0kjbFN6B75Au_x4MfzOZCZ0RasPEJzWTIM-wpc8UwJnQk_iLN` · 최초 1회 편집기에서 `setup()` 실행(권한 승인 + 5분 워밍 트리거).
- 캐시 버전 브리지: 메인 `bumpCalCacheVer_` 가 설정 시트 `cal_cache_ver` 도 올린다 — 셔틀은 이것으로 가용성 캐시를 무효화한다.
- 프런트 `frontend/shared/config.js` `readApiBaseUrl` 이 셔틀 URL. `api-core.js` `readViaShuttle`(예약·셀렉 공용): 셔틀 실패(미승인 HTML·12초 초과·오류·`ok:false`)는 메인으로 자동 폴백. 셀렉 사진 목록만 셔틀에도 60초 단발(Drive 열거가 수 초).
- Code.gs 의 조회 경로를 고치면 **board-api 와 마찬가지로 재생성·재배포**해야 한다.

### board-api (`appscript-board/`)

오늘촬영 보드용 경량 GAS 프로젝트(별도 Script ID, `appscript-board/.clasp.json`). **`Board.gs` 는 생성 파일 — 직접 수정 금지**, 보드 로직은 `appscript/Code.gs` 가 정본이고 `build-board-api.mjs` 가 다시 뽑는다.

```bash
node scripts/build-board-api.mjs && cd appscript-board && clasp push -f && clasp deploy -i AKfycbyuoQ1SyEi1AWllRt-1eFR9UDJFMUCjbaOSTOcqAFKHkQ2F2tAGWpQJmHZcMY8_sDzIGQ -d "@NN 설명"
```

- 2026-09-20 현재 @11. 메인과 마찬가지로 `-i` 없는 deploy 금지.

## Notes

- `booking` and `select` are intentionally self-contained static folders so each Netlify site can publish independently
- shared frontend helpers are duplicated per site on purpose at this stage to avoid cross-directory publish issues

- 배포 전 체크: `node scripts/check-sheet-date-compare.mjs` — 시트 날짜셀을 parseDateSafe_ 없이 slice 하는 패턴 적발(위반 시 exit 1).
