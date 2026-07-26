# 인수인계 — 인화 리네이밍 완료 / 다음: 인화지 설명 카피 적용

작성 2026-07-26 · 이 문서만 읽으면 이어받을 수 있게 씀

---

## 🔴 2026-07-26 추가 — 카피 적용 중 발견한 **기획 문서의 사실오류** (반드시 읽을 것)

`인화지_설명_예약셀렉_적용안.md` **B-4** 는 쿼터 배너에 넣을 문구로
**"같은 사진을 파인아트로 바꾸시면 차액만 청구돼요."** 를 지정하며 *"(`computePrintAnnotations` 규칙상 사실)"* 이라고 적었다.
**사실이 아니다.** 포함 쿼터 매칭은 클라이언트·서버 **양쪽 모두 SKU id 완전일치**다:

- `select/v2/select.js` `computePrintAnnotations` → `quota.find((q) => q.id === typeId && q.qty > 0)`
- `appscript/Code.gs` `computeSelectDecoupledPrints_` → `quota.find(function(item){return item.id===printId&&item.qty>0;})`

따라서 `basic_10x15` 쿼터 보유자가 그 행을 `premium_10x15` 로 바꾸면 쿼터가 **안 붙고 전액**이 청구된다(차액 아님).
차액 크레딧이 존재하는 경로는 **서비스 컷뿐**이다. UWG §5 오인유발 + §434 BGB 청구 근거가 되므로:

- `shared/print-tier-copy.js` 에서 `quotaUpgradeNote` 를 **삭제**하고 자리에 경고 주석을 남겼다. 다시 넣지 말 것.
- 같은 이유로 **B-5 의 "파인아트로 바꾸면 +€N" 행별 힌트도 넣지 않았다.** 정확한 금액을 만들 수 없다:
  ① 그 행 단가는 보정본이면 `retouched`, 아니면 `additional` 이라 additional 차이는 틀린 값이고
  ② `includedQty>0` 인 행을 바꾸면 무료 쿼터가 통째로 사라져 실제 차액이 훨씬 커진다.
- 차액 과금을 **정말** 약속하려면 카피가 아니라 `computePrintAnnotations` + `computeSelectDecoupledPrints_` 양쪽에
  업그레이드 차액 규칙을 먼저 구현해야 한다. (미구현 = 향후 과제)

**교훈:** 가격을 서술하는 카피는 계산 코드로 검증한 뒤에만 넣는다.

---

## 1. 지금까지 (✅ 배포 완료 — 손댈 것 없음)

**인화 등급 리네이밍 + 10×15 가격 확정** — GAS `@657`, 커밋 `4e562c8` → `4b7255d` → `8201947`

| 등급 | 용지 | 사이즈 |
|---|---|---|
| **시그니처** (구 '기본') | Epson Premium Semigloss 251g/m² | 10×15 · A4 (동일 용지, 사이즈만 다름) |
| **파인아트** (구 '프리미엄') | Hahnemühle Photo Matt Fibre 200g/m² | 10×15 naturweiß · A4/A3/A3+ warmweiß |

가격(보정본 추가 / 원본 별도): 시그니처 10×15 **3/4** · 파인아트 10×15 **6/8** · 시그니처 A4 10/15 · 파인아트 A4 15/20 · A3 35/50 · A3+ 45/60 · 포토카드 단면5 양면8. 패키지 쿼터 내 €0.

---

## 2. 🔴 이 도메인의 함정 (재발 방지 — 반드시 읽을 것)

### (a) 가격 정의처가 **5곳**이다
`ops-checklist.md`는 3곳이라 적혀 있으나 **틀렸다.** 하나만 고치면 화면가와 청구가가 어긋난다.

1. `appscript/Code.gs` `PRINT_LABELS` (~16656) ← **과금 권위**
2. `appscript/AdminV2.html` `PRINT_PRICES` (~3114) ← 자주 누락됨
3. `frontend/select/select.js` `PRINT_OPTIONS` (~20)
4. `frontend/select/v2/select.js` `PRINT_OPTIONS` (~21)
5. `frontend/shared/print-catalog.js` `PRINT_CATALOG` (~11)

### (b) 라벨 문자열로 SKU를 역추론하는 곳이 2개
라벨을 바꾸면 **말없이 깨진다.**
- `frontend/print/app.js` `normPrintId()` (~496) — `PREMIUM_LABEL_RE`(`prem|프리미엄|파인아트|fine\s*art|fineart`)로 상위등급 판정. **여기 신규 명칭을 안 넣으면 파인아트 주문이 `basic_a4`로 인식되어 잘못된 용지로 자동 출력된다.**
- `frontend/select/select.js` `resolvePrintTypeId()` (~348) — 라벨 포함매칭. 구 라벨 보호용 `LEGACY_PRINT_LABEL_IDS` 별칭맵이 앞단에 있음. **라벨 바꾸면 여기 항목 추가할 것.**

### (c) SKU id는 절대 불변
`basic_10x15` / `premium_a4` 등. 쿼터(`SELECT_INCLUDED_PRINT_QUOTA` ~16007)·인화주문 시트·인보이스·인화앱이 전부 id로 걸림.

### (d) 배포 절차
```bash
# 1) 백엔드 먼저 (프론트가 먼저 나가면 가격 불일치)
clasp push -f
clasp deploy -i AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w -d "설명"
#    ※ 새 배포 생성 금지, 항상 -i. 200버전 한도 시 편집기에서 수동 정리
# 2) 프론트: main 푸시 → Netlify 자동 (1~2분)
cd frontend && npm run build:select-site && npm run build:booking
#    ※ min.js 수정 시 index.html의 ?v= 캐시버스트 필수 (현재 20260726-print1)
```

---

## 3. 다음 작업 — 인화지 설명 카피 적용

**카피·문구는 이미 완성됨.** 소스: `스튜디오자료/2026년이벤트/인화지_설명_예약셀렉_적용안.md`
(3개국어 등급비교표 / "저희가 인화하는 방식" 4포인트 / 마이크로카피 세트 / 적용 위치 / 개발 프롬프트 / 금지어 블랙리스트)

### 넣을 곳
- **예약 페이지**: 상품 상세의 포함 구성 표시 근처 — 인화 포함 상품에만 "인화가 포함된 패키지는 시그니처 인화로 나갑니다" 캡션. 프리웨딩(`wp`/`wprm`)은 A3가 파인아트라 전용 문구 별도.
- **셀렉 페이지**: 용지 드롭다운(`v2/select.js` ~2214 `<select data-print-type>`) 닫는 태그 직후 **인라인 캡션**(`.finish-help` 문법: 11.5px / #8b7f70). 선택된 printId에 대응하는 용지 캡션. `renderPrints()`가 change마다 전체 재렌더라 상태 동기화 비용 0.
- 옵션 텍스트 자체를 늘리면 모바일에서 잘림 → **반드시 캡션 분리**.

### 🔴 카피 작성 시 법률 제약 (UWG)
- **§5 오인유발**: "원본 비율 그대로", "The whole frame" 류 **크롭 없음 주장 금지** — 실제로 규격 크롭이 발생한다(10×15=0%, A4·A3=긴 변 5.71%, A3+=2.13%. **A3+가 A4보다 덜 잘림**).
- **결과 보장(Erfolgszusage) 금지**: "인물이 잘리지 않게 맞춥니다" 같은 무조건 약속도 §5 + §434 BGB로 재인화·환불 청구 근거가 된다. → **공정 서술 + 정량 수치 + 예외 고지** 구조로만.
- **§6 비교광고**: dm/Rossmann 등 실명·식별 지목 금지, "자동 기계와 달리" 류 대비 표현 금지. 섹션 제목도 "일반 출력과의 차이"가 아니라 **"저희가 인화하는 방식"**.
- EN `by eye`(대충 뉘앙스)·DE `von Hand`(수작업 연상)·`Archivpapier`(DIN ISO 인증 연상) 금지.

---

## 4. 미해결 / 확인 필요

| 항목 | 내용 |
|---|---|
| **실물 테스트 (권장)** | 파인아트 A4 1장 출력 — §2(b) 정규식 수정이 실제 용지까지 맞는지. **아직 미확인** |
| **셀렉 E2E 미검증** | 포함€0 / 보정본 / 원본 3경로. 실고객 세션 필요해 코드 시뮬레이션까지만 함 |
| **판단 필요** | AdminV2 `basic_10x15.priceRetouched=0` vs select `3` 불일치. **리네이밍 이전부터 있던 드리프트**라 의미 보존 위해 그대로 둠. 의도된 것이면 유지, 아니면 3으로 |
| 파인아트 A3 색조 | 카피에 warmweiß로 적음(A4·A3+와 동일 가정). 실물 확인 시 정정 |
| Epson A4 Archival Matte | 판매 SKU 아님 — 테스트용이었고 스튜디오 디스플레이용 예정 |

## 5. 손대지 말 것
- `frontend/print/app.js` `MEDIA` 프리셋("프리미엄 인화지" 등) — SKU 등급이 아니라 **물리 용지별 색보정 프리셋**. 별개 개념.
  (참고: Hahnemühle 전용 프리셋이 없음. 추가하려면 실제 출력 색을 보고 값을 정해야 함 — 사장님 판단 영역)
- ~~select v1 — 아직 삭제 불가~~ → **2026-07-26 삭제 완료**(루트 → `/v2/` 301 리다이렉트, `ops-checklist` §48 참조)
