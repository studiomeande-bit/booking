# 셀렉 보정/출력 분리 (Retouch ↔ Print Decoupling)

작성일: 2026-07-12 Europe/Berlin
대상: 셀렉 v2 (`frontend/select/v2`) + Apps Script 백엔드 (`appscript/Code.gs`)

## 배경

고객이 **보정할 사진**과 **출력할 사진**을 다르게 선택하고 싶어 하는 경우가 있었으나,
기존 셀렉은 "보정본은 무조건 출력되는" 결합 구조여서 불가능했다.

기존 모델의 문제:
- 선택한 사진 한 리스트(`photos`)가 보정과 출력을 동시에 지배 (각 보정 사진에 출력 사이즈가 얹힘)
- 포함 출력 쿼터는 보정 사진에만 적용됨
- 보정하지 않은 다른 사진을 출력하려면 → 추가 보정으로 잡히거나 비싼 추가 인화가로 과금
- 상품별로 보정 수 ≠ 출력 수인 경우(스튜디오/야외/웨딩) 반드시 어긋남

실제 사례(박지은, 스튜디오 Basic): 보정 3 + 출력 3(다른 사진)을 의도했으나
시스템이 사진 5장을 보정으로 계산 → 추가 보정 2장 €20 과금.

## 변경 결과 (결정: 고객 편의 우선)

보정 선택과 출력 선택을 **독립된 두 리스트**로 분리.

- **보정 선택**: 사진 + 요청사항만. 기본 보정 장수 초과분만 `추가보정 단가`.
- **출력 선택**: `사진 + 사이즈 + 수량`. 보정과 **다른 사진(원본)**도 선택 가능.
  - 상품 포함 출력 쿼터를 **사이즈별로 먼저 무료 소진**
  - 초과분만 과금. 단가 = 그 사진이 보정 리스트에 있으면 `보정본가(retouched)`, 없으면 `추가인화가(additional/price)`
  - 원본(비보정) 사진 출력 허용 — 포함 쿼터 내면 무료

박지은 케이스: 보정 3 + 포함 사이즈대로 다른 사진 출력 = **€0**.

## 구현

### 백엔드 (`appscript/Code.gs`)
- `computeSelectDecoupledPrints_(prints,row,retouchSet)` — 포함 쿼터 소진 + tier별 과금 (서버가 최종 판정)
- `mergeSelectPrintItems_`, `buildRetouchNumSet_`, `selectPhotoNumKey_`, `isDecoupledSelectSubmission_`, `priceSelectPrints_`
- `submitPhotoSelection` / `updatePhotoSelection` 이 `priceSelectPrints_`로 분기
- 과금 tier(보정본/원본)는 **클라이언트 플래그를 신뢰하지 않고** 서버가 보정 리스트 기준으로 재계산
- 무료 포함 출력물도 어드민/고객 안내 메일에 표시(`allPrints`, `formatSelectPrintItemHtml_`) — 과금·인보이스에는 미포함
- **하위호환**: 신규 프론트만 `selectPrintModel:'decoupled'` 전송 → 신규 경로. 레거시 payload·v1 셀렉·기존 제출 데이터는 기존 경로 그대로 (무손상)

### 프론트 (`frontend/select/v2/select.js`, `index.html`, `select.css`)
- 보정 단계: 출력 사이즈 컬럼 제거 (num + note만)
- 출력 단계: 포함 쿼터 인식 통합 리스트 + 잔여 쿼터 카운터 + 무료/유료·보정본/원본 배지
- `computePrintAnnotations` / `getPrintQuotaSummary` — 백엔드와 동일 규칙
- `calcTotal` 재작성. 제출 payload에 `selectPrintModel` + `isRetouched`
- 수정 모드 레거시 데이터 마이그레이션(`buildDecoupledPrintsFromExisting`): 옛 보정사진의 printType을 출력 행으로 승격 + 기존 추가 인화 병합

### 검증
- 프론트 esbuild 번들 성공, 미리보기 로드 시 런타임/콘솔 오류 없음
- 가격 알고리즘 단위 검증(프론트/백엔드 동일 결과):
  - 보정3 + 10×15 3장(다른 사진, 포함 2) = €5 (초과 1장)
  - 보정3 + 포함 사이즈대로(A4×1+10×15×2) 다른 사진 = €0
  - 보정본 premium 10×15 초과 = €3 / 원본 = €8 (tier 정확)
  - 출력 미포함 상품 10×15 = €5

## 배포 순서 / 검증 체크리스트

프론트(Netlify)와 백엔드(Apps Script)는 독립 배포이며, 신규 프론트만 플래그를 보내므로
**어느 쪽을 먼저 올려도 안전**하다(레거시 경로가 그대로 살아 있음). 권장:

1. `appscript/`: `clasp push` + 새 버전 배포 (Project History 200버전 정리 필요할 수 있음)
2. `frontend/`: `npm run build:select-site` 후 GitHub main push → Netlify 자동 배포
3. 실세션 검증:
   - `select.studio-mean.com/v2/?id=...` 신규 제출: 보정≠출력 다른 사진, 포함 쿼터 내 €0 확인
   - 포함 쿼터 초과 시 초과분만 과금
   - 수정 제출(기존 데이터 복원 → 두 리스트로 분리되는지)
   - 어드민 제출 메일에 무료 포함 출력물까지 표시되는지
   - 사업자 송장 예약이면 추가금 인보이스에 무료 항목 미포함 확인
   - `인화주문` 시트 금액/항목 정합성

## 기록 정책 (2026-07-12 확정)

- **인화주문 시트 + 인보이스**: 유료 항목(추가 인화·추가 보정)만 기록. 완전 무료 주문은 행을 만들지 않음.
- **무료 포함 출력물(작업 지시서)**: 셀렉 시트 `추가인화` 컬럼과 메일로만 전달.
  - 셀렉 시트에는 주석 포함 통합 리스트 저장: `{photoNum, printId, label, qty, price, isRetouched, included}` — 무료분은 `included:true, price:0`
  - AdminV2 셀렉 상세 모달 "출력 작업 지시서 · 추가 주문": 사진번호 · 사이즈 · 보정본/원본 · 무료(기본제공)/금액 표시
  - 어드민 제출/수정 메일 "출력 작업 지시서" 섹션: 무료 포함분까지 전체 목록
  - 고객 접수 메일 "출력물 목록": 동일 목록 (무료 표기)
- **가격**: 기존 가격표(`PRINT_LABELS`) 그대로 — 포함 쿼터 무료 소진 후 초과분만, 보정본 출력=`retouchedPrice`, 원본/추가 인화=`price`. 서버가 보정 리스트 기준으로 tier 재판정(클라이언트 플래그 미신뢰, 위조 방지 검증 완료).
- 포토카드 폴백(`included_photocard`)은 무료 작업 항목으로 통과 (label/photocard 필드 보존, 쿼터·과금 미적용).

## 알려진 후속(선택)
- `select.js`의 구 결합 모델 헬퍼(`renderStudioIncludedA4Notice`, `isPrintFreeByQuota`, `syncStudioIncludedA4Default`, `hasStudioIncludedA4Applied`)는 미사용 상태로 남아 있음(무해). 정리 가능.
- v1 셀렉(`frontend/select/`)은 기존 결합 모델 유지. v2로 일원화 시 폐기 검토.
