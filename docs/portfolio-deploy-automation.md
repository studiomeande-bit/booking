# 포트폴리오 IONOS 자동 배포 (GitHub Actions)

작성일: 2026-07-12 Europe/Berlin
파일: `.github/workflows/deploy-portfolio.yml`

## 동작

- `main` 브랜치에 `frontend/portfolio/**` 변경이 push되면 → IONOS로 **SFTP(포트 22) 증분 업로드** (lftp `mirror --only-newer`, 바뀐 파일만)
- IONOS 웹호스팅 계정은 SFTP만 제공하므로 FTPS가 아닌 SFTP 사용. `--delete` 미사용(원격 파일 보존)
- GitHub → Actions 탭 → "Deploy portfolio to IONOS" → **Run workflow**로 수동 실행 가능
  - `dry_run` 체크 시: 실제 업로드 없이 "무엇이 올라갈지" 목록만 로그로 확인
- 업로드 제외: README, netlify.toml, 스크립트(.sh/.py), .netlify 등 서버에 불필요한 파일
- `.htaccess`는 포함(서버에 필요)

## 최초 1회 설정 (직접 하셔야 하는 부분)

### 1. IONOS FTP 접속 정보 확인
IONOS 로그인 → 호스팅 → **SFTP & SSH** (또는 FTP 계정) 메뉴에서:
- 서버 주소 (예: `access-5017xxxxxx.webspace-host.com` 또는 `ftp.studio-mean.com`)
- 사용자명 / 비밀번호 (없으면 새 FTP 계정 생성)
- 웹 루트 경로 (studio-mean.com 도큐먼트 루트가 계정 루트가 아니라 하위 폴더면 그 경로)

### 2. GitHub 시크릿 등록
`github.com/studiomeande-bit/booking` → Settings → Secrets and variables → **Actions** → New repository secret:

| 시크릿 이름 | 값 |
|---|---|
| `IONOS_FTP_HOST` | SFTP 서버 주소 (예: `access-5018383375.webspace-host.com`) |
| `IONOS_FTP_USERNAME` | SFTP 사용자명 (예: `a2515000`) |
| `IONOS_FTP_PASSWORD` | 해당 SFTP 계정 비밀번호 |
| `IONOS_SERVER_DIR` | (선택) 웹 루트 경로, 반드시 `/`로 끝나야 함. 계정 루트가 곧 웹 루트면 생략 |

> IONOS 연결정보 화면: SFTP · Port 22. 비밀번호를 모르면 그 화면의 **Passwort vergessen/ändern**으로 재설정 후 그 값을 시크릿에 넣으세요.

### 3. 워크플로 커밋 & 푸시
`.github/workflows/deploy-portfolio.yml` + 포트폴리오 변경 파일을 커밋 후 main에 push.
(시크릿을 먼저 등록한 뒤 push해야 첫 실행이 성공합니다)

### 4. 첫 실행 확인
- 첫 실행은 전체 파일(34개, ~1.5MB)을 올리고 서버에 동기화 상태 파일(`.ftp-deploy-sync-state.json`)을 만듭니다
- 이후 push부터는 바뀐 파일만 올라갑니다
- 처음엔 Actions 탭에서 수동 **dry_run**으로 목록을 먼저 확인하는 것을 권장

## 주의

- FTPS가 안 되는 계정이면(드묾) 워크플로의 `protocol: ftps`를 조정 필요 — 그 경우 알려주세요
- push 시 Netlify(booking/select)도 빌드가 돌지만, 해당 폴더 내용이 안 바뀌었으면 결과물 동일(무해)
- FTP 비밀번호는 GitHub 시크릿에만 저장되고 로그에 노출되지 않습니다
