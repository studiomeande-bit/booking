# 여권 → 프로필 콤보 (profAddon) 기획

작성일: 2026-08-27 Europe/Berlin
대상: `appscript/Code.gs`, `frontend/booking/`, `website/dashboard/오늘촬영.app`

## 1. 왜 만드나

2026-01-01~07-31 회계장부 204건 + 예약장부 조인 마진 분석 결과:

| 상품 | 건수 | 건당 net | 소요 | 공헌 €/h | 완전원가 마진율 |
|---|--:|--:|--:|--:|--:|
| 여권/비자 | 139 | 39.14 | 22.8분 | 91.7 | +15.3% |
| 프로필 Basic | 2 | 54.63 | 50.5분 | 63.4 | −19.4% |
| 프로필 Business | 8 | 74.89 | 72분 | 65.9 | −14.9% |
| 프로필 Professional | 4 | 99.37 | 104분 | 59.2 | −27.7% |

> **위 표의 '소요'는 원가 계산용 실측치**(여권 = 촬영 10분 + 보정 6.5분/인, 평균 1.38인)이고,
> §3 이하에서 쓰는 15분·25분은 **예약 슬롯 시간**(상품표 값, 최대치 기준)이다. 둘은 다른 숫자이며
> 상품표는 이 기획에서 **수정하지 않는다**.

프로필 라인은 **촬영 15분에 오버헤드 37분**(준비 10 + 셀렉 3 + Evoto 배치 6 + 검수 + 납품 15)이 붙는 구조라 단독으로는 손익분기(75.95 €/h 배부 + 인건비 20 = 95.95 €/h)를 못 넘는다. 가격을 올리거나 오버헤드를 줄이는 건 별개 과제고, **이 기획이 노리는 건 세 번째 길** — 이미 문 앞에 온 여권 139명에게 **획득비용 0으로** 프로필을 얹는 것.

attach율 15%(≈21건/7개월) 기준 공헌이익 **+€1,113** (연환산 €1,908). 원가 절감이 아니라 유휴 슬롯 활용이 값어치의 원천이다 — 가동률이 25%라 빈 시간은 넘친다.

### 지금 막혀 있는 것

`passAddon`(여권콤보)이 **이미 구현돼 있으나 방향이 반대다.** `calculateQuote_`의 조건이
`(item.g==='prof'||item.g==='stud') && !!request.passAddon` (Code.gs:8404) 이라,
프로필/스튜디오를 예약할 때만 "여권사진 추가" 체크박스가 뜬다. 정작 사람이 몰리는
여권 예약(139건)에서는 아무것도 안 보인다.

## 2. 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 데이터 모델 | **예약 1행 + 애드온 필드** (`passAddon` 미러) | 결제 자동매칭이 금액 일치(±0.01)로 돌아서(Code.gs:30063), 2행으로 쪼개면 €85 카드 1건이 €30/€55 어느 행에도 안 붙는다. SumUp 15분 동기화·DB CSV 매칭이 상시 깨진다 |
| 제안 상품 | **프로필 Basic(`pb`) 하나만** | 15분 증명사진 손님에게 3단계는 과함. 결정 부담 최소 |
| 인원 | **1명분 고정** | 여권 인원(1~4)과 무관. 여러 명은 사장님이 어드민에서 처리 |
| 가격 | **정가 €55** (할인 없음) | 마진 여유가 없다. 묶음 할인은 attach율이 확인된 뒤에 검토 |
| 추가 소요 | **+25분** (촬영 15 + 세팅 전환 10) | 상품표 준비 15분은 **최대치이므로 손대지 않는다**. 콤보는 여권 세팅에서 이어 찍으므로 전환만 필요 → 코드 상수 `PROF_COMBO_SWITCH_MIN=10` |
| 계약금 | **없음** | `isDeposit`의 `item.g!=='pass'` 조건이 그대로 걸린다. 현장 결제 |
| 콤보 해제 | **만들지 않음** | 기존 `passAddon`도 해제가 없다(Code.gs:14506 주석). 실제로 필요하면 `booking-set-amount`로 처리 |

### 비목표

- 프로필 Business/Professional 애드온 — Basic 하나로 시작
- 콤보 전용 상품 ID 신설 — 여권 인원이 가변이라 상품표 한 줄로 표현 불가
- 프로필 라인 가격 개편 — 별개 과제
- 예약장부 시트에서의 물리적 2행 분리 — §7 한계 참조

## 3. 핵심 엔진

`calculateQuote_` (Code.gs:8404 부근)에 `passAddon`의 대칭을 추가한다.

```js
const PROF_COMBO_SWITCH_MIN = 10;   // 여권 세팅 → 프로필 전환 (풀 세팅 아님)

const profAddon = (item.g === 'pass') && !!request.profAddon;
const profItem  = profAddon ? getCachedProducts_().find(x => x.id === 'pb') : null;
const profAddonPrice = profItem ? profItem.p : 0;
const profAddonDur   = profAddon && profItem ? profItem.d + PROF_COMBO_SWITCH_MIN : 0;
if (profAddon) total += profAddonPrice;
```

- `totalDuration`에 `profAddonDur` 합산
- 반환 객체에 `profAddon`, `profAddonPrice`, `profAddonDur` 추가
- 가격·촬영시간은 **상품표에서 읽는다**(하드코딩 금지). 상품표가 바뀌면 따라간다
- 예약 저장 시 메모에 `[프로필콤보]` 토큰 (`passAddon`의 `[여권콤보:N명]`과 같은 방식, Code.gs:11361)

### 공유 액션 `booking-add-prof-addon`

세 표면이 전부 이 액션 하나를 호출한다. 로직이 갈라지지 않게 하는 것이 목적.

```
payload: { rowIndex, expectName? }
동작:
  1. 행 조회 → 여권 예약인지 확인 (아니면 BAD_REQUEST)
  2. 이미 콤보면 거절 (중복 방지)
  3. calculateQuote_ 재실행 (profAddon: true)
  4. checkBookingTimeConflict_ 로 연장된 소요시간 검사
     → 충돌이면 CONFLICT 반환 + 여유 분수 동봉 (예약 미변경)
  5. 총액·잔금·소요시간·메모 토큰 갱신, 캘린더 이벤트 sync
반환: { ok, total, durationMin, profAddonPrice }
고객 메일은 보내지 않는다 (필요하면 사장님이 booking-confirm-mail 별도 발송)
```

## 4. 표면 셋

### ① 온라인 예약 폼 (`frontend/booking/`)

`passAddonField`(index.html:177)의 대칭으로 `profAddonField`를 만들고 **여권 선택 시에만** 노출.
문구는 `voice.md` 규칙 — 감성 1~2줄 뒤에 조건을 목록으로 명확히. 3개국어(KO/EN/DE)를
`booking.js`의 copy 테이블(760/982/1204행 부근)에 나란히 추가.

```
여권사진 찍으시는 김에, 프로필도 한 장 남기시겠어요?
보정본 1장 · 6×4 출력 1장 · 촬영 약 15분 추가 · €55
```

**⚠️ 슬롯 증발 함정.** 체크하면 소요시간이 15분 → 40분이 되어 고르려던 시간대가 사라질 수 있다.
체크 → 슬롯 없어짐 → 당황 흐름은 반드시 막는다:

1. 토글 시 `calendar-batch`를 새 `totalDur`로 재조회
2. 현재 선택한 시각이 새 소요시간으로 안 들어가면 **체크를 되돌리고** 안내:
   "이 시간에는 붙이기 어려워요 — 다른 시간을 보시겠어요?"
3. 되돌린 뒤 슬롯 목록은 여권 단독 기준으로 복구

빌드: `npm run build:booking` (esbuild). `booking.js`가 원본, `booking.min.js`는 산출물.

### ② 확정메일 + 고객 포털

- 여권 **단독** 예약 확정메일 하단에 같은 블록을 한 번. 링크는 포털(`/status/?ref=`)
- 포털에 "프로필 추가하기" 버튼 → `booking-add-prof-addon`
- **촬영 전날까지만** 노출. 당일부터는 현장 몫
- 이미 콤보면 버튼 자체를 숨김
- 충돌이면 "그날 현장에서 여쭤볼게요"로 닫고 예약은 안 건드림
- 예약 세부내역 표에 `profileAddon` 라벨 3개국어 추가 (Code.gs:11105~11107의 `passportAddon` 옆)

### ③ 오늘촬영 보드 (`website/dashboard/오늘촬영.app`)

`today-board-plan.md`의 관측된 구멍 **"D. 여권 건 특수 흐름이 없다"**에 얹는다.

여권 카드에 "프로필 추가" 버튼. **누르기 전에 판정을 먼저 표시** — `gapToNextMin`이
이미 계산돼 있다(Code.gs:4830):

- 여유 ≥ 25분 → `다음까지 42분 · 프로필 가능`
- 여유 < 25분 → `여유 12분 · 오늘은 불가 — 별도 예약으로`

버튼은 같은 `booking-add-prof-addon`을 호출하고 낙관적 갱신으로 카드를 즉시 반영한다
(GAS 왕복 5~6초는 구조적 한계이므로 클라이언트에서 덮는다 — 보드의 기존 방식).

## 5. 회계 2분해 — 이게 없으면 마진 추적이 죽는다

`classifyBookingAccounting_`(Code.gs:6066)은 `itemGroup`만 본다. 손대지 않으면 콤보 €85가
통째로 '여권/비자 매출'이 되고 프로필이 장부에서 사라진다.

장부 income 엔트리 생성 지점(**Code.gs:17596**) 한 곳에서 콤보 예약을 두 엔트리로 분해한다:

| 엔트리 | 금액 | accountingClass |
|---|--:|---|
| 여권분 | 총액 − 애드온가 | 여권/비자 매출 |
| 애드온분 | 애드온가 | 프로필 매출 |

**같은 분해를 기존 `passAddon`에도 적용한다.** 지금은 프로필 예약에 붙은 여권 €30이
'프로필 매출'로 잡히고 있다 — 양방향을 한 함수로 고친다.

```js
/* 콤보 예약을 매출 성격대로 2엔트리로 나눈다. 총액은 보존한다(합 = 원래 총액).
   방향 무관: 여권 예약 + 프로필콤보 / 프로필·스튜디오 예약 + 여권콤보 둘 다. */
function splitComboBookingIncome_(row, baseEntry) { ... }
```

**세금 영향 없음.** 총액이 안 바뀌므로 UStVA·부가세는 그대로고, EÜR 계정 분류만 정확해진다.
장부가 예약행에서 파생되므로 **과거 `passAddon` 건도 자동 재분류**된다. 배포 후
`accounting-ledger`로 분기 총액이 센트 단위로 동일한지 확인할 것.

## 6. 하류 프로세스 — 콤보를 "여권 단독"으로 오해하는 6곳

`촬영종류='pass'`로 갈라지는 지점 전수 조사 결과:

| # | 위치 | 하는 일 | 콤보일 때 현재 | 조치 |
|---|---|---|---|---|
| 1 | Code.gs:8439 `isReturnDiscountEligibleBookingRow_` | 재방문 10% 할인 자격 | 제외됨 | **해제** |
| 2 | Code.gs:8500 `checkReturnCustomer_` | 재방문 손님 판정 | false | **해제** |
| 3 | Code.gs:16010 | 촬영 후 감사메일 | 발송 안 함 | **해제** |
| 4 | Code.gs:15147 `getDashboardSelectStatus_` | 어드민 셀렉 상태 | 여권 취급 = 셀렉 없음 | **해제** |
| 5 | Code.gs:25802 | 주간 브리핑 셀렉 파이프라인 | 여권 취급 | **해제** |
| 6 | Code.gs:21423 `PREP_TARGET_GROUPS_` | 준비설문 대상 | `pass` 없음 → 설문 안 감 | **포함** |
| 7 | Code.gs:8762 | 제휴사 할인 = 여권 예약만 | 허용 | 유지 ✅ |
| 8 | Code.gs:29316 | 계약금 0 | 0 | 유지 ✅ |

**4·5번이 가장 위험하다** — 프로필 보정본을 납품해야 하는데 셀렉 파이프라인에서 안 보인다.
손님이 사진을 못 받는 사고로 이어진다.

`isPassportBookingItem_`을 통째로 바꾸면 안 된다(7·8은 콤보여도 여권 취급이 맞다).
판별을 하나 더 만들고 **1~5번 호출부만** 갈아끼운다:

```js
/* 여권 '단독' 예약. 콤보(프로필 포함)는 여권 전용 취급에서 빠진다.
   ⚠️ 새로 itemGroup==='pass' 분기를 만들 때: 여권 전용 트랙(사진 전달·국가 검증·계약금)이면
      isPassportBookingItem_, 손님 응대 트랙(메일·셀렉·할인·설문)이면 이 함수를 쓸 것. */
function isPassportOnlyBookingRow_(row) {
  return isPassportBookingItem_(row[BOOKING_COL['촬영종류']], row[BOOKING_COL['상품']])
      && !hasProfAddon_(row);
}
function hasProfAddon_(row) {   // 메모/옵션열의 [프로필콤보] 토큰
  return /\[프로필콤보\]/.test(String(row[BOOKING_COL['요청사항']] || ''));
}
```

6번은 배열 상수라 함수로 못 바꾼다. 호출부 `isPrepTargetGroup_(row[...])`(Code.gs:15501)를
`isPrepTargetBookingRow_(row)`로 바꿔 콤보면 true를 반환하게 한다.

## 7. 알려진 한계 (안 A를 고르며 감수한 것)

- **예약장부 시트는 1행.** `촬영종류='pass'`, `상품='여권/비자'`, 총액 €85. 프로필은
  메모 토큰으로만 보인다. 시트에서 상품별 건수를 세면 프로필이 0으로 잡힌다 —
  **회계장부에서 세면 정확하다.**
- 캘린더 이벤트도 1개 (제목에 콤보 표기는 넣는다)
- 콤보 해제 액션 없음 (§2)

이 한계가 문제가 되면 예약 2행 모델로 갈 수 있으나, 결제 자동매칭이 깨진다(§2 근거).

## 8. 테스트

`scripts/check-prof-addon.mjs` — 기존 `check-doc-preview.mjs`·`check-extra-days.mjs`와 같은 자리.
assert 기반, 프레임워크 없음.

1. **견적**: 여권 1인 + 콤보 → 총액 85, `totalDuration` = 15 + 25 = 40분
2. **여권 다인**: 여권 3인(30분) + 콤보 → 총액 145, 소요 55분 (프로필은 1명분 고정)
3. **비대상 거절**: 프로필 예약에 `profAddon: true` → 무시(총액 불변)
4. **회계 2분해**: 콤보 예약의 income 엔트리가 2개, 합계 = 총액, class가 각각 여권/프로필
5. **역방향 회귀**: 기존 `passAddon` 예약도 2분해되고 합계 보존
6. **충돌**: 여유 부족 시 `booking-add-prof-addon`이 CONFLICT 반환 + **예약 미변경**
7. **중복**: 이미 콤보인 행에 재호출 → 거절
8. **하류 판별**: 콤보 행에 `isPassportOnlyBookingRow_` = false, `isPassportBookingItem_` = true

## 9. 배포 단계

| 단계 | 범위 | 효과 |
|---|---|---|
| **1차** | §5 회계 2분해 + §3 엔진 + §6 하류 판별 + §4-③ 보드 | 그날부터 현장 업셀 가능. 기존 `passAddon` 오분류도 동시 해소 |
| **2차** | §4-① 온라인 폼 | 139명 전원에게 노출. 슬롯 재조회 UX가 붙어 손이 가장 많이 감 |
| **3차** | §4-② 확정메일 + 포털 | 예약 후 재접점 |

배포 절차는 `docs/ops-checklist.md`·`docs/deployment.md`를 따른다.
`clasp push`는 `appscript/` 전체를 밀므로 `Admin.html` 의도치 않은 변경을 먼저 확인할 것.

## 10. 성공 기준

배포 3개월 뒤 `accounting-ledger`로 측정:

- **attach율** = (프로필콤보 건수) / (여권 예약 건수). 목표 10%, 손익 유의미 구간 15%
- 프로필 매출 건수가 회계장부에서 콤보분과 단독분으로 **나뉘어 보일 것** (§5가 동작한다는 증거)
- 콤보 손님의 촬영 후 감사메일·셀렉 발송 누락 **0건** (§6이 동작한다는 증거)

attach율이 3개월 뒤 5% 미만이면 문구·노출 위치를 재검토하고, 그래도 안 오르면
묶음 할인(€75 등)을 검토한다 — 순서를 뒤집지 않는다.
