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
`website/photo-print/index.html`을 수정하면 `frontend/print/`도 다시 생성해야 함(스크립트를 app.js로 분리):
```
node scripts/build-print.mjs   # (또는 split 로직 재실행)
```
현재는 수동 분리(split.js) 사용. 정식 빌드 스크립트는 추후.
