# Photo Print (print.studio-mean.com)

Studio mean 사진 인화 웹앱. 정적 사이트(빌드 없음): `index.html` + `app.js`.
개발 원본은 `website/photo-print/index.html`(단일 파일). 배포본은 CSP(`script-src 'self'`)를 지키려 스크립트를 `app.js`로 분리한 것.

## 배포 (사용자 = 스튜디오 계정 필요)
1. 이 폴더(`frontend/print/`)를 커밋·푸시 (레포: studiomeande-bit/booking).
2. Netlify에서 **새 사이트** 생성 → 같은 GitHub 레포 연결 → **Base directory = `frontend/print`**, publish = `.`, 빌드 명령 없음(정적).
3. 도메인 **print.studio-mean.com** 서브도메인 추가(DNS: 기존 booking/select와 동일 방식).
4. 배포 후 앱 열기 → 주문 인화 모드 ④ ERP 직결에 GAS `/exec` URL은 이미 기본 입력됨(app.js `ERP_BASE`) → 셀렉 세션ID 입력 → 주문 자동 로드.

## 동작
- 읽기 전용(select-session `existingPrints` → 주문 라인). **automation key 불필요**.
- 사진 원본은 **로컬 파일 매칭 권장**(고해상 · 내보내기 canvas taint 회피). Drive 사진은 표시용.
- ERP URL은 `app.js`의 `ERP_BASE` 상수(= 기존 `frontend/shared/config.js`의 공개 /exec).

## 원본 갱신 시
`website/photo-print/index.html`을 수정하면 이 폴더를 재생성한다(인라인 `<script>`를 `app.js`로 분리 + `index.html`은 `<script src="app.js">`로 치환). `netlify.toml`·`README.md`는 손관리라 건드리지 않는다.
```
node scripts/build-print.mjs           # 재생성
node scripts/build-print.mjs --check   # 원본과 배포본이 동기화됐는지만 검증(쓰기 X, exit 0=동기화)
```
빌드 후 `git status`로 변경 확인 → 커밋·푸시하면 Netlify가 자동 배포. 스크립트는 ERP_BASE가 공개 GAS `/exec` 형식인지, 인라인 스크립트가 남지 않았는지 자체 검증한다.
