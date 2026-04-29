# Studio mean Portfolio

`www.studio-mean.com`용 별도 정적 포트폴리오 사이트입니다.

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
- `portfolio-data.json` — Google Drive 공개 폴더에서 생성한 이미지 데이터
- `studio-mean-logo.svg` — 공식 로고
- `contact/submit.php` — 문의 폼 메일 처리
- `.htaccess` — IONOS/Apache용 보안 헤더 및 캐시 설정
- `netlify.toml` — 별도 정적 사이트 배포 설정(보조용)

## 이미지 소스
- 루트 폴더: `1OPRMHbnh6ctci8jmLjlOb7dlHMReG1jT`
- 현재 사용하는 하위 폴더:
  - 가족사진
  - 만삭
  - 스냅
  - 웨딩
  - 키즈
  - 프로필

## Drive 데이터 새로고침
포트폴리오에 새 사진을 반영할 때:

```bash
cd frontend
npm run refresh:portfolio-data
npm run build:portfolio-site
```

이 스크립트는 공개 Drive 폴더 HTML을 다시 내려받아 `portfolio-data.json`을 갱신합니다.
중복처럼 보이는 `copy`, `(1)`, `(2)`, `final` 류 파일명은 보수적으로 1장만 남기도록 정리합니다.

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
- `ProfessionalService` 구조화 데이터
- `robots.txt`
- `sitemap.xml`

배포 후 추가로 필요한 수동 작업:
- Google Search Console에 `https://www.studio-mean.com` 등록
- Naver Search Advisor에 `https://www.studio-mean.com` 등록
- 각 서비스에서 제공하는 사이트 소유 확인 메타 태그 또는 HTML 파일을 실제 토큰 값으로 추가
- Search Console / Search Advisor에 `https://www.studio-mean.com/sitemap.xml` 제출

## 로컬 미리보기

```bash
cd frontend/portfolio
python3 -m http.server 4322
```

브라우저에서 `http://127.0.0.1:4322`를 열면 됩니다.
