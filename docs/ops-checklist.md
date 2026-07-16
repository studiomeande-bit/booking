# Ops Checklist

Updated: 2026-07-15 Europe/Berlin

운영·배포·회귀 점검을 한 페이지로. (로드맵 #12)

## 1. 배포 절차

### 백엔드 (Apps Script)

```bash
cd appscript
clasp push                                   # HEAD 업로드 (이것만으론 웹앱 미반영!)
clasp deploy -i AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w -d "설명"
```

- **이 배포 ID가 유일한 라이브** — 프론트·문서·이메일 링크 전부 이것만 참조. 절대 `clasp undeploy` 금지, 새 배포 생성 금지 (항상 `-i` 갱신).
- **버전 200개 한도**: deploy마다 버전이 쌓임. "Cannot create more versions" 에러 시 → Apps Script 편집기 → 프로젝트 기록에서 옛 버전 수동 삭제 (API 없음, 소유자만 가능).
- 로직만 바뀌면 push로 충분한 경우도 있지만, **HTML(AdminV2)·웹앱 동작 변경은 반드시 redeploy**.

### 프론트엔드 (Netlify)

```bash
cd frontend
npm run build:booking-site        # 또는 build:select-site / 개별 빌드
# index.html의 ?v= 캐시버스트 갱신 (필수!)
git add -A && git commit && git push origin main   # Netlify 자동 배포 (1~2분)
```

- min.js/min.css를 수정 후 **캐시버스트(?v=)를 안 올리면 CDN이 구버전 서빙** — 반드시 함께.
- booking과 select는 별도 Netlify 사이트 (booking.studio-mean.com / select.studio-mean.com).

### ERP 에이전트 (Claude)

- 키 파일: `reservation/.secrets/erp-automation-key` (gitignore) — 어드민 → 설정 → 자동화 API 키에서 발급/폐기.
- 스킬: `website/.claude/skills/studio-erp/SKILL.md` — 액션 목록·워크플로 문서.

## 2. Known Caveats

| 항목 | 내용 |
|---|---|
| GAS 버전 한도 | 200개 도달 시 배포 차단 — 정기적으로 프로젝트 기록에서 버전 정리 |
| **Utilities.formatDate 금지 (핫루프)** | GAS 서비스 호출이라 호출당 수십 ms — 시트 전 행을 도는 루프에 넣으면 수십 초가 된다 (2026-07-15 장부 107s→13s 사례). 분 단위 포맷은 `formatDateMinute_`(순수 JS, TZ 가드 내장) 사용. `getAccountingLedger` 응답의 `_timing`으로 페이즈별 진단 가능 |
| 캘린더 = 가용성 원본 | 캘린더에 이벤트를 넣으면 그 시간대 공개 슬롯이 막힘 (가예약 포함). 외부에서 직접 지운 이벤트는 시트와 어긋날 수 있음 |
| 셀렉 세션 중복 | 한 예약에 셀렉 세션이 2개 생길 수 있음 (재발송 이력) — 어드민 표시는 원본 세션 기준, 상태 변경은 `selectRowIndex` 지정 가능 |
| select 페이지 v1/v2 | `페이지버전` 컬럼으로 분기. 신규 발송 기본 v2. 카탈로그(PRINT_OPTIONS)는 **3곳 동기화 필요**: Code.gs PRINT_LABELS · AdminV2 PRINT_PRICES · select.js(v1+v2) PRINT_OPTIONS |
| **v1 삭제 불가 (2026-07-15 확인)** | v1은 아직 비활성이 아님 — `sendPassportPhotosAdmin`(여권 직접발송)이 classic 세션 생성(Code.gs~22578), `buildSelectSessionUrl_`이 classic을 루트 `/?id=`로 링크(10곳), resend legacy 기본값 classic(~16394), 기존 classic 링크 존재. **v1 프론트 삭제 시 이들 404.** 지우려면 먼저 마이그레이션: 여권발송+resend를 v2로 전환 + 루트 `/?id=`→`/v2/` 리다이렉트 후 제거. 현재는 휴면 폴백으로 유지 권장 |
| 보너스/서비스 인화 차액 | `uplift_` printId 항목으로 제출됨 — 수정 모드 복원 시 자동 제외 (중복 청구 방지 로직 존재) |
| Lexware | 완전 비활성 (LEXWARE_ENABLED=false + 스텁). 코드에 잔재 있으나 죽은 코드. Lexware 계정 측 API 키 폐기 권장 |
| 일일 자동화 | D1~D8 + B/C/L/M/P/T 시리즈 — dailyTasks() 트리거. 운영 로그 탭에서 상태 확인 |
| 재수정 요청 | 락+중복감지+같은라운드 병합으로 보호됨. 횟수는 "보정본 발송 → 재수정" 사이클당 1회만 소진 |
| 시크릿 | `.secrets/`(자동화 키), Script Properties(ADMIN_PASSWORD_HASH, ACTION_SECRET, AUTOMATION_API_KEY, EXPENSE_MAIL_QUERY 등) — git에 절대 없음 |

## 3. 회귀 체크리스트 (주요 변경 후)

**예약 플로우**
- [ ] booking.studio-mean.com 상품 선택 → 날짜/슬롯 로드 → 제출 → 시트 행+캘린더 이벤트+대기 메일
- [ ] **어드민 예약 수정 저장 (2026-07-15 배치쓰기 전환 @585)**: 이름/금액/일시/장소 수정 → 저장 → 시트 반영 + 캘린더 이동 + 세부내역 갱신 확인 (개별 setValue ~30회 → 1회 setValues, ensureSheets_ 실행당 1회 메모이즈)
- [ ] 굿샤인 코드 적용(15분 홀드) → 제출 시 확정, 이탈 시 해제
- [ ] 어드민 확정 → 고객 확정 메일 (가이드+오시는길 포함)

**셀렉 플로우**
- [ ] 발송 모달 (기본 보정/마케팅 보너스/서비스컷 수량) → 링크 발송
- [ ] 갤러리 별점 → 자동 입력 → 제출 → 어드민 수신
- [ ] **서비스컷 v2**: serviceCutCount N 설정 세션 → ①시작화면 요약(🎁 N장 무료)+패키지안내 ②보정 단계 안내박스+슬롯 ③출력 단계 초록배너(사용현황 N/M + 대상 번호) ④인화 시 10×15 무료·차액만 — 미리보기 `?preview=1`로 확인 가능
- [ ] **스냅 보정범위 제한 (2026-07-16, @597)**: snap/마이리얼트립만 ①셀렉 범위 안내(제외: 신체·하늘 합성, **사람 제거(합성)**, 의상 주름) ②허용범위 placeholder·예시 ③범위밖 키워드 실시간 힌트 ④관리자 접수메일 "⚠️ 기본범위 확인" 배지 ⑤**예약페이지 상품 상세에도 동일 안내(ko/en/de)** — 다른 상품군엔 흔적 없음
- [ ] 서비스컷(v1): 설정 세션에만 표시, 10×15 무료, 업그레이드 차액
- [ ] 보정 요청 가이드 예시가 구체 문구("자연스럽게" 없음)로 표시
- [ ] 보정본 발송 → 승인/재수정 버튼 → 재수정 접수(중복 클릭 안전)
- [ ] **셀렉 재발송·수령 경고 (2026-07-16, @600)**: 재발송 메일 제목 [재발송]+빠른제출 안내(마감일 포함) · 접수 알림에 재발송 N회 표기 · 인화물(기본 포함분 포함) 있는데 수령 미선택이면 빨간 ⚠️ 경고 + 지시서에 기본 포함분도 표시

**행사/B2C·B2B (2026-07-16 메뉴 분리 후)**
- [ ] 첫 메뉴 7타일: …프리웨딩(커플 화보) / 웨딩·가족 행사 / 기업·단체 촬영(B2B)
- [ ] 웨딩·가족 행사 → 카테고리 3종(암트 본식/피로연·파티/돌잔치) → dolp €350/토 €400 → 위치·상세 입력 → 날짜/슬롯 → 제출(예약형)
- [ ] 기업·단체(B2B) → 상담 카드 3종 → 클릭 시 /consultation/?type= 프리셀렉트 → **날짜 스텝 잠김(슬롯 미점유)** → 설문 제출 → 상담시트+메일
- [ ] 행사 상품에 시간제 단가표 미노출(상담 견적) · generic 시간제 카드 메뉴 미노출
- [ ] 웨딩급(암트/돌잔치/프리웨딩) 셀렉 발송 시 리터칭단가 기본 €20 (@589)

**견적/회계**
- [ ] 견적 생성(다국어) → PDF → 보류+가예약 → 캘린더 슬롯 차단 확인
- [ ] erp-agent: daily-briefing, quote-list 응답 정상
- [ ] 잔금확인 버튼 → 시트 기록 → 브리핑 미수 목록에서 제거
- [ ] 영수증 정리: 인박스 파일 → 기장 → 아카이브

**어드민 큐 (2026-07-16 정리 후)**
- [ ] 대시보드: 워크인/수동확인/문의상담 큐에 완료 건 잔존 없는지 (수동확인은 '대기중'만 표시되도록 수정 @599; 워크인은 walkin-update-status로 처리완료 전환 가능)
- [ ] 셀렉 초기 로딩: 세션 ~4초 내 + 1차 셀렉 진입 즉시(갤러리 프리페치) — 세션 응답 `_timing`으로 서버 시간 진단

**자동화**
- [ ] 아침 브리핑 메일 수신 (D7)
- [ ] 운영 로그 탭에서 D1~D8 성공 상태

## 4. 문제 발생 시

- 웹앱 변경이 안 보임 → redeploy 했는지 + 캐시버스트 확인
- 배포 실패 "200 versions" → 버전 정리 (위 참조)
- ERP 에이전트 UNAUTHORIZED → 키 재발급 후 `.secrets/erp-automation-key` 갱신
- 견적/굿샤인 캘린더 이벤트 고아 발생 → 어드민 해제 버튼 또는 일일 배치가 정리
