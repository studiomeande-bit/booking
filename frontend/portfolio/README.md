# Studio mean Portfolio

`studio-mean.com`용 별도 정적 포트폴리오 사이트입니다.

## 구조
- `index.html` — 포트폴리오 랜딩/갤러리/라이트박스
- `about/` — 스튜디오 소개 페이지
- `contact/` — PHP 메일 전송 기반 문의 페이지
- `en/`, `ko/` — 영어/한국어 홈, 소개, 문의 페이지
- `impressum/` — 독일식 Impressum
- `datenschutz/` — DSGVO 기준 요약 Datenschutz
- `robots.txt`, `sitemap.xml` — 검색엔진 크롤링/인덱싱용 파일
- `portfolio.css` — 블랙/그레이/화이트 기반 에디토리얼 UI
- `portfolio.js` — 정적 JSON 기반 갤러리 렌더링
- `portfolio-data.json` — 갤러리 목록(파일명·분야·크기). 고객 이름은 넣지 않는다
- `assets/gallery/{1440,640}/` — 갤러리 사진(긴 변 1440·640px JPG, EXIF 제거)
- `studio-mean-logo.svg` — 공식 로고
- `contact/submit.php` — 문의 폼 메일 처리
- `.htaccess` — IONOS/Apache용 보안 헤더 및 캐시 설정
- `netlify.toml` — 별도 정적 사이트 배포 설정(보조용)

## 갤러리 사진
사진은 사이트가 직접 서빙한다(`assets/gallery/1440/<name>`, `assets/gallery/640/<name>`).
2026-10-15 까지는 공개 Google Drive 썸네일을 불러왔는데, 구글이 몰린 요청을 가끔 거절해 빈 칸이 생겼고
(한 번 로드에서 18장 중 15장 실패), 공개 JSON 에 Drive ID 와 고객 이름 파일명이 그대로 실렸다. 그래서 옮겼다.
점검할 때: srcset 이미지의 `naturalWidth` 는 픽셀 수가 아니라 칸 너비로 환산된 값이다(512 가 나와도 정상).
깨진 그림은 `img.decode()` 실패로 본다. 앱 브라우저 창이 숨겨져 있으면 스크린샷에 사진이 안 그려진다.

- 지금 갤러리: 2026-04 큐레이션 50장 + 2026-10-15 소급 43장. **다시 만들지 않는다**(예전 Drive 긁기 스크립트는 삭제됨).
- 새 사진: `~/Desktop/Studio_mean/automation/homepage_share.py` 가 인스타에 게시된 마케팅 동의 건의 보정본을
  `sm_<촬영일>_<해시>_<NN>.jpg` 로 넣고 `portfolio-data.json` 맨 앞에 덧붙여 main 에 푸시한다.
- 파일명·JSON 에 고객 이름을 넣지 않는다(공개 URL 이다). `portfolio.js` 는 이름 앞부분으로 같은 촬영을 묶는다.
- 내리기: JSON 항목과 `assets/gallery/{1440,640}/` 의 파일을 지워 main 에 푸시한다. 배포가 서버의
  `assets/gallery/` 에서도 지운다(이 폴더만 `--delete` 미러). 서비스 페이지가 그 파일을 쓰면
  (`grep -r <name> --include=index.html`) 그 사진도 바꾼다.
- 서비스 페이지(familienfotos 등)의 사진도 같은 파일(`assets/gallery/1440/`)을 쓴다.

## Kontakt 폼 메일 연결
문의 폼은 `contact/submit.php`를 통해 `studio.mean.de@gmail.com`으로 메일을 보냅니다.

IONOS 웹호스팅에서 확인할 항목:
- PHP 사용 가능 여부
- `mail()` 전송 허용 여부
- `noreply@studio-mean.com` 발신 주소 사용 가능 여부

발신 주소를 다른 도메인 메일로 바꾸려면 `contact/submit.php` 상단의
`STUDIO_SENDER_EMAIL` 값을 수정하시면 됩니다.

## SEO / 검색 노출
기본 SEO 설정은 코드에 반영되어 있습니다.
- 독일어 / 영어 / 한국어별 URL 분리
- `hreflang`, `canonical`, `Open Graph`, `twitter:card`
- `LocalBusiness` / `ProfessionalService` 구조화 데이터
- `robots.txt`
- `sitemap.xml`
- `www.studio-mean.com` 요청은 `https://studio-mean.com`으로 301 리다이렉트

배포 후 추가로 필요한 수동 작업:
- Google Search Console에 `https://studio-mean.com` 등록
- Naver Search Advisor에 `https://studio-mean.com` 등록
- 각 서비스에서 제공하는 사이트 소유 확인 메타 태그 또는 HTML 파일을 실제 토큰 값으로 추가
- Search Console / Search Advisor에 `https://studio-mean.com/sitemap.xml` 제출

## 로컬 미리보기

```bash
cd frontend/portfolio
python3 -m http.server 4322
```

브라우저에서 `http://127.0.0.1:4322`를 열면 됩니다.
