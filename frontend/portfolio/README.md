# Studio mean Portfolio

`www.studio-mean.com`용 별도 정적 포트폴리오 사이트입니다.

## 구조
- `index.html` — 포트폴리오 랜딩/갤러리/라이트박스
- `portfolio.css` — 블랙/그레이/화이트 기반 에디토리얼 UI
- `portfolio.js` — 정적 JSON 기반 갤러리 렌더링
- `portfolio-data.json` — Google Drive 공개 폴더에서 생성한 이미지 데이터
- `studio-mean-logo.svg` — 공식 로고
- `netlify.toml` — 별도 정적 사이트 배포 설정

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

## 로컬 미리보기

```bash
cd frontend/portfolio
python3 -m http.server 4322
```

브라우저에서 `http://127.0.0.1:4322`를 열면 됩니다.
