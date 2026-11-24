# Threads 자동 게시

포트폴리오(studio-mean.com)에 새 촬영 세션이 올라오면 Threads 에 영어 글과 독일어 글을 하나씩 자동으로 올린다.

## 흐름

1. `homepage_share.py` (로컬 Mac) 가 인스타에 게시된 **마케팅 동의 건**만 `portfolio-data.json` 맨 앞에 붙여 main 에 푸시한다.
   그래서 Threads 에 올라가는 사진도 동의받은 건뿐이다.
2. `deploy-portfolio.yml` 이 사진을 studio-mean.com 에 올린다. Threads 는 이 공개 URL 에서 사진을 가져간다.
3. `threads-post.yml` 이 하루 두 번(베를린 오전 9~10시, 저녁 5~6시) `scripts/threads-post.mjs` 를 돌린다. 한 번에 글 하나만 올린다.
   - 새 세션 → **영어 글**(오래된 세션부터)
   - 영어 글 20시간 뒤 → 같은 세션 **독일어 글**(같은 사진, 같은 템플릿)
   - 사진이 아직 사이트에 없으면(배포 전) 건너뛰고 다음 실행에서 다시 본다.
4. 올린 기록은 `scripts/threads-state.json` 에 남겨 main 에 커밋한다(포트폴리오 재배포는 일어나지 않는다).

세션 = 파일명 앞부분 `sm_<촬영일>_<해시>` 가 같은 사진 묶음. 사진은 번호 순, 첫 장은 세로 사진, 최대 10장.

## 문구

`scripts/lib/threads-templates.mjs` — 분야(portrait·family·kids·maternity·wedding·snap)마다 3개씩 돌려 쓴다.
`months` 가 붙은 시즌 문구(예: 11~12월 크리스마스 마켓 스냅)는 그 달에만 후보에 들어간다.
규칙(500자 이하·해시태그 하나·댓글 유도·스튜디오 이름)은 `node scripts/check-threads-post.mjs` 가 검사한다.
문구를 고치거나 늘리면 이 검사를 돌린다(`check-all.mjs` 에도 포함).

## 처음 설정 (한 번)

> 이 문서를 쓸 때 Meta 개발자 문서에 접속할 수 없어 화면 이름은 기억에 기대어 적었다. 메뉴 이름이 다르면 비슷한 항목을 찾는다.
> 실제 동작은 아래 5번의 수동 실행으로 확인한다.

1. https://developers.facebook.com → **앱 만들기** → 사용 사례에서 **Threads API 액세스** 선택.
2. 권한: `threads_basic`, `threads_content_publish`.
3. 앱 역할 → **Threads 테스터**에 스튜디오 Threads 계정 추가 → Threads 앱 **설정 → 계정 → 웹사이트 권한 → 초대**에서 수락.
4. 액세스 토큰 발급(대시보드의 토큰 생성기 또는 OAuth). 단기 토큰이면 장기 토큰(60일)으로 교환:
   `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=<앱 시크릿>&access_token=<단기 토큰>`
5. GitHub 저장소 **Settings → Secrets and variables → Actions** 에 시크릿 추가:
   - `THREADS_ACCESS_TOKEN` — 장기 토큰 (필수)
   - `THREADS_USER_ID` — Threads 사용자 ID (선택, 없으면 `/me` 로 알아낸다)
6. **Actions → Threads auto post → Run workflow**
   - `session` 에 `1a5419` 같은 ID, `dry_run` 켜고 실행 → 문구·사진 URL 확인
   - `dry_run` 끄고 한 번 실행 → Threads 에 실제로 올라가는지 확인. 여기서 실패하면 로그의 API 오류 메시지를 본다.

## 토큰 갱신 (60일마다)

장기 토큰은 60일 뒤 만료된다. 만료되면 워크플로가 `code 190` 오류와 함께 실패한다(GitHub 이 실패 메일을 보낸다).
만료 전에 로컬에서:

```bash
THREADS_ACCESS_TOKEN=<지금 토큰> node scripts/threads-post.mjs --refresh-token
```

출력된 새 토큰으로 GitHub 시크릿 `THREADS_ACCESS_TOKEN` 을 바꾼다. 캘린더에 50일 주기 알림을 걸어 두면 편하다.

## 자주 쓰는 명령

```bash
node scripts/threads-post.mjs --plan                  # 대기열(자동 대상 세션과 en/de 게시 여부)
node scripts/threads-post.mjs --session 1a5419 --dry-run
node scripts/threads-post.mjs --pack 1a5419 --out ~/Desktop/threads   # 수동 게시용 사진+문구 내보내기
node scripts/threads-post.mjs --baseline              # 지금 있는 세션 전부 자동 대상에서 제외
```

- **기존 세션**: 도입 시점(2026-11-24)의 44개 세션은 베이스라인으로 빠져 있다. 올리고 싶으면 Actions 수동 실행에서 `session` 을 지정한다.
- **자동 게시 멈추기**: Actions 탭에서 워크플로를 Disable 하거나, 시크릿을 지운다(토큰 없음 오류로 실패).
- **글 내리기**: Threads 앱에서 직접 지운다. 상태 파일은 그대로 두면 다시 올리지 않는다.
- **중복 방지**: 게시 후 상태 커밋이 실패해도, 다음 실행이 최근 24시간 글과 같은 문구면 새로 올리지 않고 기록만 한다.
