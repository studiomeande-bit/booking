# Update Roadmap

Updated: 2026-07-16 Europe/Berlin

## Immediate

1. Booking end-to-end verification
- Apps Script production deploy is pending version cleanup because the project reached the 200-version limit
- run Admin booking E2E diagnostics before a real customer-flow test
- Netlify booking submit
- Google Sheets row creation
- Google Calendar event creation
- Apple Calendar reflection check
- customer mail delivery
- admin notification mail
- admin edit / reschedule / cancel

2. ~~Lexware actual workflow validation~~ → 종결 (2026-07-16): Lexware 완전 은퇴(증빙 파이프라인으로 대체). 남은 운영 액션 1건: Lexware 계정 측 API 키 폐기

3. Receivables cleanup → 전수 검증 완료 (2026-07-16, @603): 미수 19건 €4,855.50 → 5건 €1,787.50
- 정리 13건: SumUp/은행 증거 6건(Jenna·최성열·정주희·황영목 288+10 분할이체·정채연·Kim yoonsuh) + 현금 완납 추정 7건(손유정·김진아·김수은·김영서·이세은·조미정·차수진, 상태완료+현장결제 관행, evidenceStatus로 구분 기록)
- 신규 에이전트 액션 `booking-confirm-balance` (paidDate/amount/payMethod/evidenceStatus) — confirmBookingBalanceAdmin 재사용
- 부수 효과: Jenna·Kim yoonsuh 결제수단 현금→카드 정정으로 현금장부 이중집계 €600 해소 (totalIn 4,608→4,008)
- ~~Sae-Jin Choi €210(카드 7/11)~~ → 사장님 확인(2026-07-16): GIROCARD €230 = 잔금 €210 + **팁 €20** — 잔금결제금액 230으로 확정(@606). 팁 €20은 사장님 지시로 수기 매출 행213 "Trinkgeld (카드결제 팁)"로 별도 등록(작업완료·sumup 증거) — 사업자 본인 수령 팁 과세 매출 처리 선례
- **미수는 HSAD €892.50 1건뿐 (2026-07-17 사장님 확인: "이것 외 미수 없음")**. STMIN-260013, payMethod "미결제(offen)" — daily-briefing/회계 openAmount 집계에도 유일 미수로 확인됨.
  - ~~사장님 확인 4건~~ → 전부 입금 완료로 종결(2026-07-17): 장진욱(행17 현금)·송영미(행9 카드)·조재연(행4 카드, 잔금 이미 €0)·박지은(행168 계좌이체) — 결제수단이 이미 찍혀 있어 **시스템 미수 집계에 애초 미포함**. SumUp 4~5월/은행 CSV 자동매칭 증거만 없던 것 → 사장님 확인으로 대체, 백필 불요. 장부 수정 없음(이미 결제 처리 상태)
- 정산(settlement) 리뷰 큐 140건 정리는 별도 트랙

## Next

6. ~~Gutschein V2 customer redemption design~~ → 전항목 배포 완료 (2026-07-14, Done Recently 참조). 실전 코드 적용 1회 확인만 남음

7. Calendar performance follow-up
- measure current month / next month / third month load gap
- tune month-summary cache TTL
- refine background prefetch order
- reduce visual confusion while loading later months

8. Select real-session verification
- open existing session link
- restore existing submission
- submit update flow
- extra prints / extra retouch totals
- success screen / invoice number / drive link confirmation
- ~~서비스컷이 v2에 미구현이던 버그~~ → v2 포팅 완료 (2026-07-15, 8f166ab): 무료 보정 슬롯+안내+복원+제출 왕복. **오너 확인 필요**: 어드민에서 serviceCutCount N 설정한 v2 세션 열어 서비스컷 N슬롯 표시 확인
- 서비스컷 perk 결정 대기: v1의 "서비스컷당 기본 10×15 인화 무료(차액청구)"는 v2 디커플드 모델상 미이식(v2 보너스도 인화 미포함) — 원하면 백엔드 작업으로 추가 가능

9. Mail content cleanup
- reduce repeated text across pending / confirmed / follow-up mails
- unify Korean / English / German tone
- verify pre-wedding / passport infant / dol guide content balance
- ~~보정 요청 가이드 예시가 "자연스럽게"(가이드가 경계하는 바로 그 모호어)를 사용~~ → 구체 문구로 재작성 완료 (2026-07-15, 8f166ab): 부위+방향+원본유지 경계. v1/v2 가이드·placeholder 5곳, BAD 예시는 의도적 유지

## Later

10. Corporate / Event product redesign (2026-07-15 Phase 1 배포 완료)
- proposal: `docs/biz-event-product-redesign.md` — 2트랙(B2C 예약형/B2B 상담형) 구조 사장님 확정
- ~~Phase 1~~: 단가표 노출 제거(프론트+백엔드) + 하이브리드 모드 + 어드민 수기입력 전환 — 라이브 검증 완료 (8a680be, @582)
- ~~① 가족파티 고정가~~ → dolp €350/토 €400 신설·배포 완료 (2026-07-15, 0a84f7b·@583). amt 변형은 상담 유지(사장님), 프리미엄 10×15 €3 유지(사장님)
- ~~④ 단가표 비노출 저장~~ → 스킬 레퍼런스 파일에 저장 완료 (2026-07-15). 견적 작성 시 netto×1.19
- Phase 2+3 → **Update 4로 확정** (2026-07-16 사장님 승인): `docs/update-4-plan.md` — 첫 메뉴 B2B/B2C 분리(사장님 지시), 프리웨딩↔웨딩본식 구분, 설명문 개선, B2B 상담형 전환(상담 설문 인프라 재사용), 견적 드래프트는 에이전트 경로만, 계약금 인보이스 명시 실행형, Drehvertrag→Update 5

11. Final design pass (2026-07-15 부분 완료)
- ~~booking success screen polish~~ → 2026-07-27 완료: 디자인 패스 세션이 이미 핵심(체크 원형·중앙 정렬, booking.css "성공 화면 폴리시" 블록)을 적용해 둔 상태였고, 남은 흠(홀수 개 요약 그리드에서 금액 옆 빈 칸)만 마지막 항목 전체폭 스팬으로 마감
- ~~select design alignment with booking~~ → 사장님 결정으로 종결: 셀렉은 크림+그린 톤 유지 (의도된 무드 구분)
- ~~spacing / typography consistency review~~ → 폰트 스택 통일 완료 (Noto Sans KR 우선)
- ~~mobile safe-area and in-app browser polish~~ → select viewport-fit=cover + safe-area insets 적용 완료

12. ~~Ops checklist refresh~~ → docs/ops-checklist.md 작성 완료 (2026-07-15: 배포 절차·주의사항·회귀 체크리스트)

13. Optional finance expansion
- decide whether instant card sales also create Lexware documents
- if needed, add SumUp or bank CSV import path
- otherwise keep those flows as local-ledger + summary export only

## Done Recently

- **월마감 대사 복구: 15분 동기화 재매칭 + 장부 1:1 선점 (2026-07-30, 배포 @698/@699/@700)** —
  중복행을 지운 뒤에도 7월 카드 18건 중 13건이 `review` 로 남아 있었다. 원인 두 개:
  - **15분 동기화가 매칭에 빈 장부를 넘기고 있었다** — `matchSettlementTransaction_(tx,[],…)`.
    예약 결제기록으로 잡히는 건만 matched 가 되고 나머지는 전부 review. CSV 로 넣은 1~6월이
    matched 인데 API 로 들어온 7월만 review 였던 이유. → 신규 행이 생긴 회차에만 장부(약 2초)를
    읽어 기간 재매칭. `getAccountingLedger` 를 인증 래퍼 + `buildAccountingLedger_` 본체로 분리해
    트리거에서도 쓸 수 있게 했다(토큰 위조 대신 계층 정리)
  - **매칭에 선점 개념이 없어 같은 예약을 여러 거래가 물었다** — 실측: 7/03·7/04 €30 이 둘 다
    예약행 180(김나윤), 3월엔 예약행 15 하나에 8건. 대사가 맞는 것처럼 보이는 게 review 보다 나쁘다.
    → 장부 건 1개 : 거래 1개. 1차로 각 거래의 최선 후보를 뽑고 **점수 높은 순으로 선점**, 밀린
    거래는 남은 후보로 재탐색(날짜가 딱 맞는 쪽이 이긴다). 카드·은행 결제기록 경로까지 동일 적용
  - 매칭 후보 장부 창을 대상 기간 ±14일로 넓혔다(결제일과 촬영일이 어긋난 경계 건 구제)
  - **실측(2026-01~07 전량 재매칭)**: 중복 매칭 18그룹 → **0**, matched 196→240, review 116→72,
    장부 총액 3종 모두 불변. 7월은 18건 전부 1:1 matched
  - `settlement-rematch` 액션 신설(기간 지정). 검증기 56 시나리오 + 구조 28 + 결함주입 16/16
  - **후속(@701)**: 15분 동기화의 행 갱신이 빈 장부 매칭으로 기존 matched 를 review 로 되돌리던
    강등 발견(재매칭 직후 3건 실측) → 판정은 좋아질 때만 덮어쓰기. CSV 임포트의 장부 읽기도
    ±14일 창으로 통일. 이후 재매칭→동기화 연속 실행에서 강등 0 확인
  - **7월 월마감 사전 점검 결과 (2026-07-30, 정정)**: `ready:true`, blocker 0. 실제 미수는
    **정다은 €150(7/24) 1건뿐** — 월마감 open_receivables 의 박지은 €180 은 7/17 사장님 입금
    확인 완료 건(잔금결제여부 플래그 미백필로 감사뷰에만 잡히는 오탐; 7월 은행 CSV 매칭 시 자동
    소거 예상). 7월 지출 €0 은 은행 CSV 미임포트+payout 수수료 미도착 때문. 매출 3,675.06 · VAT 586.78
  - **후속(@702~@704)**: 브리핑에 카드·은행 대사 검토 섹션(최근 14일, 0건이면 숨김) 추가.
    미수 잔금 판정을 플래그 기준으로 바꿨다가 **이미 받은 68건 €5,700+ 홍수 실측 후 원복** —
    결제수단 문구('미결제'/공란)가 이 시스템의 수납 완료 규칙이고(7/16 전수 정리로 확립),
    플래그 기준 감사뷰는 월마감 open_receivables 담당. 두 규칙은 의도적으로 다르다(주석 명문화)

- **정산·수수료 dedup 키를 불변 식별자로 — 팬텀행 재발 차단 + 기존 오염 정리 (2026-07-30, 배포 @696/@697)** —
  SumUp 거래 1건이 정산장부에 2~3행씩 쌓이던 사고의 근본원인은 dedup 해시 base 에 **payout 확정 후
  채워지는 값**(입금예정일·수수료·순입금액)이 들어 있던 것. 같은 해시를 수수료 지출 ID 로도 써서
  **지출장부까지 이중계상**되고 있었다(문서에 없던 피해 — 실측 114행 중 57행 중복).
  - 해시는 불변 식별자만(+배치 내 seq), SumUp 은 거래참조 1차 키, 은행은 참조가 IBAN 이라 **금지**
  - 구 해시·구 ID 조회 폴백으로 **이관 없이 자가치유**(배포 직후 전량 신규행 사고 방지)
  - `settlement-dedupe` 액션(기본 dryRun) 신설 — 참조 있는 SumUp 행만 삭제 후보, 남는 행 rehash
  - **실측**: 정산 143→138행(€211 팬텀 제거) · 수수료 114→57행(€47.02) · **매출 22,224 불변** ·
    비용 12,569.82→12,522.80 · 동기화 2회 연속 created=0. 검증기 46+12, 결함주입 13/13
  - 함정 기록: `erp-agent.mjs` 는 `--json '{...}'` 만 파싱 — `--dryRun false` 류 플래그는 조용히 무시된다
  - 상세: `docs/fix-sumup-settlement-duplicates.md` 상단 해결 섹션

- **A안 채택: 메인 구글 캘린더 직접 공유 + 캘린더소실 fail-closed 은퇴 (2026-07-29, 배포 @695)** —
  와이프와의 일정 공유를 "iCloud '사진촬영 일정'에 사본 유지" 대신 **메인 구글 캘린더
  (studio.mean.de@gmail.com)를 와이프 Gmail 에 직접 공유**하는 방식으로 확정(사장님 A안 선택).
  이에 따라 @691의 "대상 캘린더 소실 시 예약 전체 마감(fail-closed)" 로직을 **보고-전용으로 하향**
  — 확정 예약은 항상 메인에도 있으므로(실측 13/13 양쪽 등록) 가용성은 메인만으로 완결이고,
  fail-closed 로 두면 나중에 '사진촬영 일정' 정리(공유 해제/구독 해제) 순간 예약 전체가 막히는
  지뢰였다. 정합점검 보고 문구도 "의도한 정리면 무시 가능"으로 교체. 개인 캘린더 감지·보고는 유지.
  검증기 66+19, 결함주입 25/25, 라이브 audit failures 0 + slots ok 확인.
  - 후속: 사본 관행은 은퇴 수순 — 와이프 공유가 자리 잡으면 '사진촬영 일정' iCloud 구독을
    정리해도 안전(브리핑에 보고 1회 뜨고, CONFIG 이름 제거 시 그마저 사라짐). 자동 사본 기능
    (@692/@693)은 휴면 유지
  - **사장님 액션 완료 (2026-07-29)**: 메인 캘린더를 `ehda910@googlemail.com`("모든 일정 세부정보
    보기")에 공유, 와이프 기기 표시까지 확인. 함정 2개 기록 — 공유받은 캘린더는 이름이
    "studio_mean"이 아니라 "studio.mean.de@gmail.com"으로 표시되고, 아이폰 기본 캘린더 앱은
    calendar.google.com/calendar/syncselect 에서 체크해야 나타난다(기본 꺼짐)

- **'사진촬영 일정' 자동 사본 — 배선 완료·가동 대기 (2026-07-29, 배포 @692/@693)** —
  확정 예약을 사장님이 손으로 '사진촬영 일정'에 복사하던 양쪽 등록 관행을 자동화했다:
  확정 시 사본 생성(ensure 경로), 취소/삭제 7개 경로에서 사본 정리, 일일 정합점검이 누락분 백필
  (멱등 — 수동 사본과 공존). 검증기 66+19, 결함주입 25/25.
  - **실측 결과 현재는 가동 불가**: '사진촬영 일정'이 iCloud 구독형이라 이 구글 계정에서 쓰기
    불가("Aktion nicht zulässig"). 권한 오류를 영구 학습(PHOTO_COPY_UNSUPPORTED 프로퍼티)해
    재시도·브리핑 노이즈를 끊었다 — E2E 로 생성 시도→실패 감지→학습→정리까지 전부 확인
  - **가동 조건(사장님 결정)**: '사진촬영 일정'을 iCloud 대신 **구글 캘린더로 신설**(아이폰
    캘린더 앱에 구글 계정 캘린더로 동일하게 표시됨)하면 → Script Properties 의
    PHOTO_COPY_UNSUPPORTED 삭제 한 번으로 즉시 가동. 이후 수동 복사 작업이 사라진다
  - 부수 확인: **GAS 200 한도는 배포 기준이었고 현재 배포는 2개뿐**(-i 재사용 덕) — 어제의
    버전 181/200 경고는 과잉, 당장 조치 불요 (버전 생성이 실패하는 날이 오면 그때 에디터 정리)

- **대기자 경쟁 완화 + 공유 캘린더 소실 감지 (2026-07-29, 배포 @691)** —
  - **예약 잠금 조기 해제**: processForm 이 고객·관리자 메일 2통(수 초 I/O)까지 잠금 안에서 보내
    대기자 선착순 경쟁 때 뒤 요청들이 waitLock(15초) 초과로 '동시 처리 중' 거절을 받았다 →
    트랜잭션(중복검사→슬롯→캘린더→시트→캐시) 종료 직후 해제, 메일은 잠금 밖(실패해도 예약 성립,
    ok 반환). lockHeld 플래그로 finally 이중 해제 방지
  - **공유 캘린더 소실 감지(fail-closed)**: 확정 촬영이 사는 '사진촬영 일정'(구글 공유·이름
    정확일치)의 공유가 풀리면 그 일정 전체가 가용성에서 조용히 빠져 이중예약 직행이었다 →
    getBusyCalendarMeta_ 가 구성 이름 소실을 감지해 대상 캘린더 소실 시 CAL_READ_FAILED_(마감
    응답), 정합점검이 원인을 브리핑으로 보고. 개인 캘린더는 표기 변형(스케줄/스케쥴) 정규화로
    오탐 방지, 보고만. 캐시 v2→v3 (missing 동봉)
  - 검증: 캘린더 검증기 63+21(구조), 결함주입 24/24. 실서버: 정합점검 오탐 0·슬롯 API 정상

- **셀렉 v2 모바일 개선 + 배포 파이프라인 규명 (2026-07-29, Netlify 배포) —**
  - **모바일 별점 탭 타깃**: 터치 기기에서 19×17px(오탭 유발)이던 별을 ~31×41px 로 확대
    (갤러리 셀·라이트박스 모두, `touch-action:manipulation` 포함, 데스크톱 크기는 유지)
  - **갤러리 로딩 실패 탈출구**: 재시도 2회+ 실패 시 재시도 버튼 아래 이메일 연락 폴백(3개국어) —
    재시도만으로 막다른 길이던 케이스 해소. 성공 시 카운터 리셋
  - **ICS 피드 판별 종결**: 류진주 8/8 사례 실측 — ICS 3개는 죽었지만(0건) 공개 슬롯 API 가
    그 시간을 정확히 차단 = 가용성은 구글 공유 캘린더 경로로 완결. 재조사 불필요
  - **배포 파이프라인 규명(중요)**: 프런트 배포 = push main → Netlify 자체 빌드(esbuild+
    `stamp-assets.mjs` 콘텐츠 해시 스탬프). 수동 ?v= 스탬프는 빌드가 덮어씀 — 라이브 검증은
    해시 비교가 아니라 내용 토큰 grep 으로 (메모리 netlify-frontend-deploy 기록)
  - 라이브 확인: select.min.css 에 touch-action 규칙, select.min.js 에 galleryContactFallback ✓

- **예약 오류 메시지 다국어 + 운영 정리 (2026-07-29, 배포 @690)** —
  - **오류 다국어(서버측)**: booking.js 는 서버 메시지를 배너에 그대로 띄우는데, 마감/동시처리/
    동의필요 등 고객 노출 오류 10종이 전부 한국어였다 → `PUBLIC_BOOKING_ERR_I18N_` 맵 +
    `localizePublicBookingError_` 로 booking 라우트에서 payload.lang 기준 번역(EN/DE). 맵 밖
    메시지는 원문 유지. 프런트 재배포 불필요. 단위검증 10종×2언어 + 실서버 EN/DE 응답 확인
  - **requestId 재시도 차단 의혹 종결(비버그)**: onSubmit 이 클릭마다 새 payload+requestId 를
    만들므로 실패 후 재시도가 막히지 않음을 소스로 확인 — 수정 불요
  - **강예슬 8/15 시간 확정 종결**: 사장님이 직접 09:00 등록·장부 반영 → 정합점검 drift 0
  - ⚠ **GAS 버전 181/200**: 이번 주 배포 페이스면 수일 내 한도 도달 → 에디터 Project History 에서
    구버전 정리 필요(전례 있음). 당분간 배포는 묶어서 최소화

- **다일정 작업 + 공식 로고 + 픽업 수기 등록 (2026-07-29, 배포 @688/@689)** —
  - **다일정(2일+ 작업, 휘슬러 건)**: 예약 모델이 단일 날짜뿐이라 2일짜리 행사를 등록할 수 없었다.
    → 예약행 하나(매출 1회) + 날짜별 캘린더 이벤트("(2/N일차)")로 모델링. `추가일정JSON` 컬럼
    신설, 수기등록·견적전환 모달에 "추가 촬영일" 입력(한 줄=하루, 충돌검사 포함). 정합점검이
    추가 이벤트를 인지(knownIds — 고아 오탐 방지), 증발 시 재생성, 취소/삭제 7개 경로에서 함께 정리.
    실서버 E2E: 2일 등록 → 고아 0 → 2일차 시간 충돌 거부(이벤트가 실제로 막음) → 삭제 → 같은 시간
    통과(정리 증명)
  - **공식 로고 (사장님 지시: 로고 자리엔 항상 공식 로고)**: 견적서·인보이스가 `LOGO_B64` 미정의로
    텍스트 워드마크 폴백 상태였다 → `appscript/Logo.gs` 신설(.ai 원본→트림→480px→base64 data URI,
    재생성 절차 주석). `.claspignore` 가 화이트리스트라 Logo.gs 추가 필요했음(주의). 렌더 검증 완료
  - **픽업 수기 등록**: 전화로 정한 픽업 시간을 어드민 셀렉탭 `픽업시간` 버튼으로 직접 기록 —
    고객 페이지와 같은 쓰기(픽업일시+픽업캘린더ID+이벤트 동기화), 완료건·우편건 차단, 고객 확인
    메일은 선택. `setSelectPickupTime` RPC + `select-pickup-set` 에이전트 액션
  - 검증기: check-calendar-consistency 59+19(구조), 결함주입 23/23 (다일정 3종 포함)

- **견적 전환 디테일화 + 견적서 디자인 인보이스 통일 (2026-07-29, 배포 @687)** —
  - **전환 모달 확장**: 날짜/시간/소요/인원만 받던 것을 → 상품명(장부 표기)·촬영종류·장소·계약금
    (잔금 실시간 힌트, 총액 초과 경고)·예약 상태(확정됨/대기중)·추가 메모·**확정 메일 발송 체크**
    (계좌 안내 포함, '대기중'이면 비활성)까지. 견적 요약 박스에 항목 리스트·할인·언어 표시.
    비운 필드는 견적서 값 그대로(기존 동작 보존). 서버 오버라이드 + `_sendConfirmEmail` 재사용,
    반환에 status/deposit/balance/mailSent 포함
  - **견적서(Angebot) = 인보이스 디자인**: buildQuoteHtml_ 의 CSS·구조를 buildInvoiceHtml_ 와 동일
    세트로 교체(헤더/발신라인/고객블록/메타 17px 행/얇은 표 헤더/우측정렬 금액/260px 합계/번호 푸터).
    견적 전용 요소는 유지 — 유효기한·촬영예정일 메타, netto 문구, 할인(빨강)·계약금 행, 약관은
    인보이스 메모박스와 같은 라운드 박스, 다국어 합본(.pbreak). DE 수량 라벨 Qty→Menge 통일.
    두 파일에 상호 동기화 주석 명시(한쪽 디자인 변경 시 다른 쪽도)
  - **검증**: 원본 함수 추출 → 샘플 견적·인보이스 나란히 실렌더 → 브라우저 육안 대조로 디자인 일치
    확인(할인·계약금·약관 포함). 구문·기존 검증기 3종 회귀 없음. 실사용 첫 전환 시 확정메일 수신만
    한 번 확인 권장

- **캘린더 운영 모델 확정 — 양쪽 등록 관행 반영 (2026-07-29, 배포 @684~@686)** —
  사장님 확인으로 실제 모델이 확정됐다: 애플 캘린더 3종(**사진촬영 일정·태웅 개인스케쥴·여보랑나랑**)은
  **구글 캘린더에 공유**되어 이름 매칭(getBusyCalendarMeta_)으로 가용성에 이미 반영되고 있었다.
  확정 예약은 메인 구글 + 사진촬영 일정 **양쪽 등록(복사)이 정상**(실측 활성 13건 중 12건).
  - **개인 캘린더 표기 오타 발견**: CONFIG 는 '태웅 개인스케줄', 실제는 '개인스케쥴' — 정확일치
    매칭이라 개인 일정이 슬롯을 못 막고 있었을 가능성 → 두 표기 모두 등록
  - 정합점검 이관 판별을 죽은 ICS 피드에서 **공유 캘린더 직접 스캔**으로 교체(실시간). ICS 는 보조
  - **dupBoth(양쪽 존재)를 정상 관행으로 강등** — problemCount·브리핑에서 제외(가짜 경보 12건 방지),
    진단 필드로만 유지. appleLinger(취소건 사본 잔존)·orphans 는 계속 보고
  - CalDAV PROPFIND 자동탐색은 GAS UrlFetchApp 미지원으로 실행 불가 확인 → 잔재 제거
  - **강예슬 8/15 09:00 장부 확정**(force — 충돌 경고는 본인 사진촬영 사본과의 셀프충돌로 판명).
    최종 정합점검: **problemCount 0** (drift·linger·orphan 전무)

- **환불 취소(무효화) 기능 (2026-07-29, 배포 @682)** —
  기록된 환불을 되돌리는 경로가 없었다(잘못 기록·실제 미지급 시 대응 불가). **삭제가 아니라
  무효화**: 이벤트 `type`을 `refund_voided`로 바꿔 집계 3곳(bookingRefundTotal_·현금장부·매출
  음수 파생, 모두 `type==='refund'`만 셈)에서 자동 제외하되 이력엔 '취소됨'으로 남긴다(감사 흔적).
  - `voidBookingRefundAdmin` — 단건이면 자동, 다건이면 `eventTs` 지정. `expectName`+`expectAmount`
    이중확인, 인보이스 연결 건은 `force` 없이 차단(세금계산서 취소 별도). 에이전트 `booking-refund-void`
  - AdminV2 환불 모달 이력에 건별 **`환불취소`** 버튼(유효 환불에만), 취소된 건은 취소선+'취소됨'
  - 검증: check-refund-rules 에 취소 시나리오 13종 추가(단건·다건ts·이름/금액불일치·인보이스가드·
    무효화후 재환불 가능·감사흔적 보존) 전부 통과
  - **이동욱 €15 실처리(row217)**: 여권 미흡 50% 환불을 사장님이 취소 요청 → 무효화 완료.
    실서버 확인: alreadyRefunded 15→0, 7월 환불 엔트리 0건, 장부에 원매출 €30만 남음(이체 미실행
    이라 실제 자금이동 없었음), 이벤트는 refund_voided 로 사유와 함께 보존

- **가예약 슬롯 차단 + 역방향 고아 탐지 (2026-07-28~29, 배포 @680/@681)** —
  - **가예약이 슬롯을 못 막던 갭**: 시간 미지정 가예약을 `createAllDayEvent` 로 만드는데
    `getEventsForRange_` 가 `isAllDayEvent()` 로 건너뛰어, 가예약해 둔 날에 일반 예약이 그대로
    들어왔다. → 종일 대신 **당일 전체(00:00~23:59) 시간 이벤트**로 생성해 모든 슬롯 차단.
    부작용으로 견적전환이 자기 가예약과 충돌 판정되던 것 → `_clearQuoteTentativeHold_` 를
    충돌 검사 **전에** 실행하도록 순서 교정
  - **역방향 고아 탐지**: 지금까지 정합점검은 '시트엔 있는데 캘린더에 없음'만 봤다. 반대 방향
    (캘린더엔 예약형 이벤트가 있는데 시트엔 근거 없음 — 생성 도중 실패·삭제 실패 잔재)은 슬롯을
    영구히 막으며 매출만 조용히 샜다. 향후 60일 캘린더를 역스캔해 보고(자동 삭제 안 함 — 사장님이
    손으로 넣은 일정일 수 있음). 픽업·가예약·상담·상주오픈·개인메모는 제외. 실서버에서 상담
    이벤트 1건을 오탐 → `[상담` 접두사 제외로 수정(@681), 재확인 0건
  - 검증: 고아·가예약·상담제외 시나리오 추가(행동 50+구조 19), 결함주입 20/20
  - **강예슬 8/15 시간 확정 시도 → 09:00 이 다른 캘린더 일정과 충돌**로 잡혀 강제하지 않음
    (새 충돌 가드가 실동작). 09:00 은 사장님이 캘린더에 넣은 값이라 개인 일정과의 겹침 여부
    확인 필요 — 장부는 00:00 유지(드리프트 계속 표시). **사장님 판단 대기**

- **쓰기 경로 충돌검사 — 이중예약 사전 차단 (2026-07-28, 배포 @679)** —
  공개 예약(processForm)만 락+슬롯검증이 있고 **수기등록·견적전환·일정변경·에이전트 시간설정은
  아무 검사 없이** 캘린더에 이벤트를 만들던 갭(조사 high 3건)을 닫았다. 정합점검이 '사후 그물'이라면
  이건 '사전 차단'.
  - 공용 `checkBookingTimeConflict_`: 영업시간·리드타임은 안 보고(사장님은 일요일 저녁도 잡는다)
    **물리적 겹침만**(버퍼 규칙 포함) 검사. 조회 실패 = fail-closed. 자기 이벤트 제외(이동 시 가짜
    충돌 방지)
  - 배선 5곳: `addManualBookingAdmin`(+ScriptLock — 공개 예약과 직렬화, MRT·시간미정 자동 통과,
    강행 시 `[충돌확인필요]` 메모 스탬프) · `convertQuoteToBookingAdmin` · `rescheduleBookingAdmin`
    (자기 이벤트 제외 + **애플 이관 건 안내**: 구글에 원 이벤트가 없으면 "애플 옛 일정 직접 정리"
    응답) · `submitRescheduleRequest`(고객 제출 시 재검증, 3개국어 거부 메시지, 쓰기 전 차단) ·
    `setBookingTimeForAgent_`(force 강행 옵션)
  - AdminV2: 수기등록·견적전환·상세편집 일정변경 3곳에 "겹칩니다. 그래도 진행?" confirm → 강행
    재호출 흐름. 사장님이 의도적으로 겹치게 잡는 경우를 막지 않는다
  - 코드리뷰 이월분 처리: 일괄삭제에 `repairRefsAfterBookingRowDelete_`(booking-delete 의 ④ 참조
    보정을 공용 헬퍼로 추출) 연결 — 셀렉/출장/결제연결행 밀림 사고 방지
  - 검증: check-calendar-consistency 47+19(구조), 결함주입 17/17. **실서버 E2E**: 이예인 7/29 16:15
    겹침 시도 → 거부(행 미생성 확인), 공개 슬롯 API 가 빈 시간(7/30 17:00) → 통과·생성 → booking-delete
    정리(refsFixed.select:1 로 신규 헬퍼 동작 확인)

- **애플 이원 캘린더 인지 (2026-07-28, 배포 @677/@678)** —
  운영 관행 확인(사장님): **확정 전=구글, 확정 후=애플 '사진 촬영' 캘린더로 이관**. 이 관행을 모르는
  자가치유가 이관된 확정 예약을 '증발'로 오판해 구글에 재생성하면 구글+애플 중복이 생긴다.
  - 정합점검 개편: 구글에 없으면 **애플 피드(이름+같은날 매칭)를 먼저 확인** → 있으면 재생성 금지
    (appleMoved), 양쪽에 있으면 dupBoth 보고, 취소건이 애플에 남으면 appleLinger 보고(시스템은
    애플에 못 쓰므로 수동 삭제 안내), 애플 피드 실패 중엔 재생성 전면 보류(중복 폭탄 방지)
  - **애플 피드 fail-closed**: fetchAppleCalendar* 가 오류를 내부에서 삼켜 피드 실패 시 이관된
    확정 예약 전체가 가용으로 보이던 구멍 → 피드 단위 실패를 CAL_READ_FAILED_ 로 승격
  - 7/27 치유했던 현주현·김수정 건은 dupBoth 0 으로 **정당한 복구였음이 확인**됨(애플에도 없었음)
  - `icloud-status` 진단 액션 신설(시크릿 비반환) — 실측: ICS 피드 3개·인증 OK·**향후 30일 이벤트 0건**
    → '사진 촬영' 캘린더가 피드에 포함돼 있는지 사장님 확인 필요. 미포함이면 이관된 확정 예약이
    슬롯을 못 막는다(다음날 아침 정합점검이 구글 재생성으로 보완하지만 수 시간 창이 남음)
  - 검증기: 애플 시나리오 12건 추가(행동 42+구조 13), 결함주입 15/15 감지. 배포 후 실서버 정합점검
    정상(problemCount 1 = 강예슬 시간확정 대기뿐)
  - 상세편집 날짜 변경(P3 후보)은 UI가 이미 rescheduleBookingAdmin 을 연쇄 호출함을 확인 — 별도
    수정 불요, reschedule 자체의 충돌검사·실패삼킴은 #84 범위로 흡수

- **이중예약 방지: 캘린더 fail-closed + 일일 정합점검 (2026-07-28, 배포 @675)** —
  5렌즈 병렬 조사로 확인한 사실: 가용성 판정은 **캘린더만 읽고 예약 시트를 전혀 안 본다**. 그래서
  '시트에는 있는데 캘린더에 없는' 활성 예약은 시스템에 없는 예약이 되어 그 슬롯이 공개 페이지에
  다시 열린다. 원래 전제(캘린더 생성 실패 후 시트 저장)는 공개 예약에선 성립 안 함(캘린더 먼저).
  - **fail-open 차단(최상위 갭)**: `getEventsForRange_` 가 캘린더별 예외를 삼키고 빈 목록을 반환
    → '이벤트 0건 = 전부 가용'으로 화면·제출 가드가 동시에 열리던 구조. `CAL_READ_FAILED_` 플래그
    신설, 소비자 5곳(slotAvailable_/getPublicSlots_/getUnavailableDays/getAvailableSlots/상담예약)이
    읽기 실패 시 **마감으로 응답하고 캐시를 심지 않는다**(오염된 '전부 가용'이 30분 굳는 게 최악).
    processForm 은 '마감'과 '일시 오류(재시도 안내)'를 구분해 던진다
  - **일일 정합점검 + 자가치유**: `auditBookingCalendarConsistency_` — 매 브리핑마다 오늘~+60일
    전수 대조. 활성인데 이벤트 없음 → 즉시 재생성(치유), 취소인데 이벤트 잔존 → 삭제 재시도,
    시간 불일치(캘린더 드래그) → **보고만**(자동 원위치는 사장님 의도를 되돌리는 꼴), 활성끼리
    시간 겹침 → 이중예약 의심 보고. 에이전트 `calendar-audit` 온디맨드 실행 가능
  - **취소 3경로(고객링크·어드민·자동취소) ID 보존**: 삭제 실패 시 캘린더ID를 지우지 않는다 —
    지우면 살아있는 이벤트를 가리키는 포인터가 사라져 복구 불가(슬롯 영구 잠김). 자동취소에
    누락됐던 캐시 무효화 추가(풀린 슬롯이 최대 30분 안 보이던 문제)
  - **일괄삭제 고아 이벤트 차단**: batchUpdateAdvanced delete 가 행만 지우고 이벤트를 남기던 것
    → 행 삭제 전 이벤트 정리 + 캐시 무효화
  - **검증**: `scripts/check-calendar-consistency.mjs` 신설 — 가짜 캘린더/시트에서 원본 소스로
    행동 26 + 구조 13 시나리오, **결함주입 9/9 감지** (개발 중 overlapsCount 필드명 버그를 이
    검증기가 잡음). 기존 검증기 4종 회귀 없음
  - **실서버 첫 실행이 실제 사고 2건을 즉시 복구**: 현주현(8/14 16:30)·김수정(8/30 16:00) 활성
    예약의 캘린더 이벤트가 사라져 슬롯이 열려 있었음 → 재생성 확인(재실행 0건). 강예슬(8/15)은
    장부 00:00 ↔ 캘린더 09:00 불일치 보고됨(시간 확정은 사장님 판단 대기)
  - **후속(#84)**: 쓰기 경로 자체의 충돌검사 부재(수기등록·견적전환·일정변경엔 락/슬롯검증이
    없음)는 별도 태스크 — 그전까지는 일일 점검의 겹침 보고가 그물

- **셀렉 추가금 수납 원클릭 + 인화장부 누수 3건 차단 (2026-07-27, 배포 @673/@674)** —
  추가금 행은 `syncSelectPrintOrder_` 가 `미결제/대기중`으로 만든다. 범용 행 편집(updatePrintOrderAdmin/
  인화내역 수정 모달)으로 개별 수정은 가능했지만 **미수 집계·수납일 기록·행 밀림 방어가 없어** 셀렉
  추가금 행은 사실상 방치되는 구조 — 매출·부가세만 인식되고 수납 여부는 아무도 추적하지 않던 누수 지점.
  (최초 서술 "바꾸는 경로가 코드 전체에 없었다"는 2026-07-28 코드리뷰에서 반증되어 정정)
  - **수납 경로 신설**: `listUnpaidSelectExtras_`(코어) / `listUnpaidSelectExtrasAdmin` /
    `markSelectExtraPaidAdmin`, 어드민 셀렉탭 **`추가금 수납` 버튼 + 미수 건수 배지**,
    에이전트 `select-extra-unpaid` · `select-extra-paid`, 장부 엔트리에 `openAmount` 부여
  - 🔴 **적대적 검토에서 이 기능이 열어젖힌 함정 3개를 잡아 같이 고쳤다** (전부 배포 전 발견):
    ① **수납된 행이 삭제되던 경로** — 고객이 결제 후 셀렉을 다시 열어 추가분을 빼면 `totalExtra=0` →
       예전 코드가 행을 그냥 지워 **수납기록·매출·부가세가 통째로 증발**(환불 판단 근거조차 소멸).
       → 미수 행일 때만 삭제, 기수납 행은 `[주문취소·기수납]` 표시만 남긴다
    ② **메모 스탬프가 행찾기를 깨뜨림** — `findSelectPrintOrderRow_` 가 메모 **전체 정확일치**라
       `[수납]` 스탬프가 붙는 순간 같은 세션을 못 찾아 **중복 행**이 생긴다 → 선두 `셀렉:xxx` 태그만 비교
    ③ **재동기화가 수납기록·매출날짜를 초기화** — 행 전체를 덮어써 이미 받은 돈이 `미결제`로 되살아나고
       매출날짜가 오늘로 밀려 분기를 넘나들었다 → 금액이 같으면 수납상태·메모·매출날짜 보존,
       금액이 바뀌면 미수로 환원 + 매출날짜는 오늘로(옛 분기 금액 불변)
  - **미수 판정을 예약 행과 대칭으로**: 결제수단 **빈칸은 미수가 아니다**(옛/워크인 행 다수가 빈칸 →
    빈칸을 미수로 치면 이미 받은 돈이 전부 미수금으로 되살아난다). 명시 `미결제`만 미수
  - **브리핑 60일 롤링 윈도** — 창 밖 잔량은 버리지 않고 `olderCount/olderTotal` 로 함께 표기
    (조용히 사라지면 그게 또 다른 누수). #79 아침브리핑 신뢰도 기준과 동일한 원칙
  - **현금 시재 날짜 교정**: 3월 주문을 7월에 현금으로 받으면 7월 시재가 늘어야 한다 →
    메모의 `[수납] yyyy-MM-dd` 스탬프를 `printRowPaidDate_` 로 되읽어 현금장부 날짜로 사용
  - **행 밀림(TOCTOU) 방어**: 목록을 본 뒤 프롬프트를 읽는 사이 행이 밀릴 수 있고, 밀린 행이 하필
    **같은 고객의 다른 추가금**이면 이름 대조로 못 걸러낸다 → `sessionId` 1순위 + `expectAmount` 대조
  - `print-row-delete` 가드형 액션 신설(`expectName`+`confirm:'DELETE'`, 삭제 내용 스냅샷 반환).
    기존 `deletePrintOrderAdmin` 은 행번호만 받는 무가드 함수여서 자동화 경로에 그대로 쓸 수 없었다
  - **검증**: `scripts/check-print-payment.mjs` 신설 — Code.gs 원본 소스를 떼어내 가짜 시트에서
    **83 시나리오 + 결함주입 17/17 감지**. 기존 검증기 3종(금액 4011건·수령마감·환불) 회귀 없음
  - **실서버 E2E**: 수납 → 멱등(alreadyPaid) → 금액가드 거부 → 현금장부 날짜=수납일 확인,
    테스트행 2건 정리 완료. 현재 인화장부 미수 **0건**(실행 3건 전부 계좌이체 수납완료)

- **색상 드리프트 정리 — 지각적 중복 병합 (2026-07-26, ⚠️ 미배포·미커밋)** —
  "~~컴포넌트 내부 하드코딩 hex 토큰화~~ → **2026-07-26 재정의 후 완료**(지각적 중복 병합)" 항목을 착수했는데, 측정해 보니 **전제가 틀렸다**:
  hex 584개 중 토큰 값과 정확히 일치하는 건 46개뿐이고 나머지는 일회성 색이었다
  (booking.css만 distinct 140개). 전부 토큰화하면 "한 번만 쓰는 토큰 140개"가 되어 드리프트가 줄지 않는다.
  - 대신 **CIELAB ΔE < 1.6(육안 식별 한계 ~2.3 아래) 군집**을 찾았다 → distinct 332개 중 **62개 군집**.
    최대 군집은 오프화이트 7종(`#f4f1ea`…`#f8f5ef`)이 4개 스타일시트에서 **54회**. 구분이 불가능한데
    각각 따로 관리되고 있었다 — 앞서 발견한 `#f7f1e7` vs `#f7f1e6` 와 같은 종류의 누적 드리프트
  - **기존 토큰 값이 이미 멤버인 군집만** 그 토큰으로 수렴(값을 새로 발명하지 않음) +
    최대 군집에만 `--sm-surface-tint: #f6f3ed` 신설. **189곳 치환 / 6파일**, distinct hex **332 → 304**
  - 🔴 **회귀 검증**: 색을 미세하게 움직였으므로 대비가 4.5 아래로 떨어질 수 있다.
    전 페이지 재감사 결과 booking 6p·portfolio 실질 위반 **0**.
    select v2 에서 4건이 잡혔으나 **각 요소를 병합 전 이웃값들에 대해 계산해 전부 `bestPreMerge < 기준`
    임을 확인 → 병합이 원인이 아닌 기존 문제**(오히려 병합 후 수치가 조금 개선됨)
  - 그 4건은 **갤러리가 렌더된 상태에서만 보이던 것**으로 이전 감사가 놓친 것 — 함께 수정:
    ① select v2 비활성 버튼 1.91 → 3.32(booking 과 동일 기준) ② `<small>` 중첩으로 **8.33px**까지
    줄던 것 → 절대 하한 11px ③ `.review-note` 4.16 → 4.8 ④ 보정요청 힌트 `#9a6a3a` 4.22 → 4.8
    ⑤ preview 배너의 팔레트 밖 `#f59e0b`(Tailwind amber) 흰 글자 2.15 → `--sm-warn-bg`+`--sm-text`
  - `.cell-star`(사진 위 별 아이콘)는 배경이 이미지라 이 방식으로 대비 측정 불가 — **오탐으로 분류**.
    다만 34% 흰색이라 밝은 사진에서 안 보일 수 있다(라이트박스 별은 앞서 0.3→0.46 로 올림) → 후속 검토 대상
  - 남은 60개 군집은 자동 병합하지 않았다 — 정식 값 선택이 판단을 요하고 픽셀이 바뀐다. 목록은 재현 가능:
    ΔE<1.6 군집 스크립트로 언제든 다시 뽑을 수 있다

- **select v1 삭제 (2026-07-26, ⚠️ 미배포·미커밋)** —
  `select/{index.html,select.js,select.css,select.min.js,select.min.css,test.html,gallery-demo.html}` 제거
  (`git rm` 사용 — 히스토리에서 복구 가능). 빈 `select/shared/` 디렉토리도 제거.
  - 🔴 **`ops-checklist` §48이 "v1 삭제 불가"로 막아둔 항목이었다.** 이유: `normalizeSelectPageVersion_`이
    `'v2'`가 아닌 **모든 값(빈 셀 포함)을 `classic`으로** 판정하고, `buildSelectSessionUrl_`이 classic 을
    루트 `/?id=`로 링크한다(10곳). `페이지버전` 컬럼 생성 이전 세션은 전부 빈 값 → **파일만 지우면
    고객 메일의 기존 링크가 404**
  - **해결: 마이그레이션 대신 리다이렉트.** `select/netlify.toml` 에 `/`·`/index.html` → `/v2/`
    (301, `force=true`). Netlify 가 쿼리스트링을 전달하므로 `?id=` 가 살아서 v2 로 착지한다.
    → **Apps Script 수정 불필요** (CLAUDE.md 의 200 버전 한계를 건드리지 않음)
  - 체크리스트가 전제로 걸었던 "여권발송 v2 전환"은 불필요함을 확인:
    `sendPassportPhotosAdmin`의 `pageVersion:'classic'` 행은 `상태='최종작업완료'` **기록용**이고
    셀렉 링크를 발송하지 않는다(코드 주석 "셀렉 생략") → 고객에게 v1 링크가 나간 적 없음
  - 헬스체크 `select-frontend`(Code.gs~2799)는 `followRedirects:true` 이고 v2 본문이 판정 조건
    (`select.min.js` / `Studio mean` / `셀렉`)을 모두 만족 → 통과
  - `package.json` 의 죽은 타깃 `build:select`·`build:css:select` 제거,
    `build:select-site` = `build:select:v2 && build:css:select:v2 && stamp`.
    스탬프 대상 81참조/40페이지 → **75참조/37페이지**, 잔여 참조 0
  - 문서 갱신: `ops-checklist` §48(삭제 불가 → 삭제 완료) · §47(가격 정의처 **5곳 → 4곳**,
    라벨→SKU 역추론 2곳 → 1곳) · `handoff-print-explainer` · `current-status`
  - ⚠️ **배포 후 확인 필요**: 리다이렉트는 Netlify 기능이라 로컬에서 검증 불가.
    배포 직후 `select.studio-mean.com/?id=<실제세션ID>` 가 `/v2/?id=...` 로 301 되는지 1회 확인
  - 선택 정리(불필요, 미실행): `normalizeSelectPageVersion_` 기본값을 `v2` 로 뒤집으면
    루트 링크 자체가 더는 생성되지 않는다. 리다이렉트가 있으므로 기능상 차이는 없다

- **포트폴리오 진입 모션 (2026-07-26, ⚠️ 미배포·미커밋)** —
  CSS transition 4개(전부 hover)·JS 진입 애니메이션 0으로, 사진 52장이 한 블록으로 들어오고 있었다.
  - **JS를 쓰지 않았다.** IntersectionObserver 방식을 만들었다가 폐기 —
    가시성을 스크립트에 의존시키면 옵저버가 한 프레임도 못 받는 상황에서 **사진 52장이 아예 안 보인다.**
    갤러리는 `animation-timeline: view()`(`@supports` 게이트, 스크롤 구동, JS 0),
    페이지 로드는 `@starting-style` + transition. 기능 미지원 브라우저는 최종 상태로 그냥 렌더된다
  - 🔴 **`opacity`는 애니메이션하지 않는다 — 작업 중 실측으로 확인한 실패 모드**:
    `animation-fill-mode: both` + `from{opacity:0}` 로 만들었을 때 렌더링이 정지된 환경에서
    **h1과 카드 52장이 opacity 0에 영구 고정**됐다. `@starting-style` + opacity 전환도 동일.
    그래서 **transform만** 애니메이션한다 → 최악의 경우 "18px 아래에 머문다"이고 "안 보인다"는 없다
  - 검증(모션이 정지된 환경에서 의도적으로 측정): 검사 요소 **65개 중 안 보이는 것 0개**,
    index(데스크톱/모바일)·랜딩·법적고지·about·en 랜딩 전 유형에서 invisible 0 / 가로스크롤 0.
    적용 대상 100%에 모션 붙음
  - 히어로 스태거: eyebrow 0.05s → h1 0.14s → visual 0.2s → text 0.26s → actions 0.36s → meta 0.46s.
    `.lp-hero`·`.page-header`까지 확장해 JS 없는 랜딩 8개 페이지도 동일하게 적용
  - ⚠️ **이 환경의 한계**: 브라우저 패널이 실제로 합성(composite)되지 않아 IntersectionObserver도
    CSS transition도 발화하지 않는다. 화면 밖 iframe(`left:-9999px`)은 렌더링이 중단돼 측정 자체가 무효였다.
    → 애니메이션이 "실제로 재생되는지"는 여기서 검증할 수 없다. 대신 **재생되지 않아도 안전한지**를 검증했다.
    실제 브라우저에서 모션이 의도대로 보이는지는 오너 확인 필요

- **포트폴리오 모바일 내비·히어로 개선 (2026-07-26, ⚠️ 미배포·미커밋)** —
  375×812 실측 기준 sticky 헤더가 **164px = 화면의 20.2%를 스크롤 내내 점유**하고 있었고,
  내비 링크 9개 전부가 44px 미달(언어 코드는 15×18px)이었다.
  - **햄버거를 넣지 않았다 — 이유**: 헤더를 공유하는 20개 페이지 중 **8개(frankfurt-snap /
    germany-wedding / passport-photo × de·en·ko)가 JS를 전혀 로드하지 않는다.** 햄버거는
    (a) 그 페이지들에 스크립트를 새로 넣거나 (b) `<details>` 기반 취약한 CSS 디스클로저를 써야 하는데,
    둘 다 얻는 것보다 비용이 크다. 대신 **모바일에서 sticky 해제** → 영구 점유 **20.2% → 0%**
    (스크롤하면 사라지고, 상단과 푸터에서 접근 가능)
  - 탭 타깃: `.site-nav a { min-height/min-width }` — 모바일 44px, 데스크톱 32px.
    언어 링크 3개는 `<span class="nav-langs">`로 묶고 구분선 추가(20개 중 18개 파일; 법적고지 2개는
    언어 링크가 없는 축약 내비라 대상 아님). 겹침 0, 가로스크롤 0
  - **모바일 히어로**: 첫 사진이 **711px** 지점에 있어 812px 화면에서 사진이 접힘 아래였다.
    `grid-template-areas`를 visual→copy로 재배치(**DOM 순서는 유지** → 스크린리더·SEO 읽기 순서 불변),
    히어로 서포트 썸네일 2장은 모바일에서 숨김(아래 갤러리에 같은 카테고리가 있다).
    결과: 사진 242px·제목 661px 모두 첫 화면, CTA 1426px → 962px
  - 데스크톱 회귀 없음(1280px iframe 실측): 헤더 108px sticky·내비 1행·24px 미달 0.
    랜딩/법적고지/about/ko 페이지도 정상
  - ⚠️ **이전 보고 정정 — 포트폴리오 이미지 `width`/`height` 누락은 CLS 문제가 아니었다.**
    갤러리가 `grid-auto-rows: 127.5px` + `grid-row: span N`으로 카드 높이를 고정하므로 이미지가
    레이아웃을 밀지 못한다. PerformanceObserver로 실측한 **CLS = 0** (시프트 이벤트 0건,
    이미지 61장 중 59장에 dims 없음). 해당 항목은 로드맵에서 제거

- **셀렉 페이지 3개국어화 — 완료 (2026-07-26, ⚠️ 미배포·미커밋)** —
  독일어로 예약한 고객이 셀렉 단계에서 한국어 벽을 만나던 문제. **백엔드 변경 불필요**:
  `getSelectSession`이 이미 `lang`(셀렉 시트 `언어` 컬럼)을 내려주고 있었고 프론트만 무시하던 상태였음.
  - 신규 `frontend/select/v2/i18n.js` — ko/en/de 사전. 마크업 규약:
    `data-i18n`(textContent) / `data-i18n-html`(innerHTML, **i18n.js 상수 전용** — 사용자 입력 금지) /
    `data-i18n-attr="placeholder:key,aria-label:key"`(속성)
  - ⚠️ `<b>` 강조가 문장을 쪼개던 곳이 다수 — 어순이 다른 독/영에서는 조각 번역이 불가능하므로
    번역값이 인라인 태그를 포함하는 방식(`*Html` 키)으로 처리. 마크업 재구성 없이 해결
  - 언어 결정 우선순위: `?lang=` → 수동 선택(localStorage) → **세션의 예약 언어** → ko.
    `state.langChosen` 플래그가 있어 고객이 직접 고른 언어를 세션 언어가 덮지 않음
  - 검증(브라우저 실측): 3개 언어 전환 시 textContent·innerHTML·속성·요일·`<html lang>`·`document.title`
    전부 정상, **URL/저장값 없이 세션 언어만으로 독일어로 열림 확인**(목 세션 lang을 임시로 de로 바꿔 실제 경로 통과),
    5회 반복 전환 후 `<b>`/`<kbd>` 마크업 무손실, 대비 위반 0 / iOS 확대 0 / 가로스크롤 0
  - 언어 전환 UI 신설(`.lang-panel`) — 탭 타깃 44px, active 색 대비 통과
  - **완료 범위**: HTML 정적 표면 126개 마커(스텝 0~4 제목·안내문·가이드·예시·내비·수령방식·픽업·주소·
    성공 패널·라이트박스 라벨·속성) × 3개 언어
  - 2차에서 마이그레이션 완료: 헤더/인사말, 세션 요약, 패키지 안내, 마케팅 동의(보너스 수량 분기 포함),
    보정 카운터, **스텝 경고 전체**(마케팅 미선택·별점 없음·번호 누락·수령방식·우편 성함/주소/PLZ),
    수령 방식 리뷰 문구, 성공 화면 전체, 제출 안내(수령 유무 분기). 사전 키 ko/en/de **199개 파리티 일치**
  - 공유 모듈에 언어 미전달이던 8곳 수정 — `getProductDeliveryLines(input, 'ko')`,
    `getPrintTierCopy/getPrintTierName/getPrintMicrocopy/getProductIncludedPrintSummary`.
    두 모듈 모두 ko/en/de를 이미 지원하는데 셀렉만 'ko'를 하드코딩하고 있었음
    (`print-tier-copy.js:225`의 "셀렉은 KO 전용" 주석은 이제 사실이 아님 — 정리 대상)
  - **JS 렌더 함수까지 전부 마이그레이션 완료** — 사전 키 ko/en/de **329개 파리티 일치**.
    갤러리(셀·상태·필터·페이징·실패/재시도), 보정 엔트리 카드, 인화 항목·용지·가장자리 마감,
    포토카드 박스(모드 3종+메모), 스냅 보정범위 안내, 리뷰 라인, 배너·검증 메시지, 제출 상태 전부
  - **실측 검증**: DE·EN 모드에서 `document.body` 전체 텍스트 노드 스캔 결과 **한국어 0건**, JS 에러 0건,
    한국어 모드 정상. select.js에 남은 한글 13개는 전부 내부 데이터(`마이리얼트립` 매처, 목 세션,
    `PRINT_OPTIONS`의 ko 폴백 라벨)로 화면에 나오지 않음
  - ⚠️ **처음 "0건"으로 보고했던 것은 목 세션 기본 경로만 본 결과였음** — 포토카드 박스·스냅 안내·
    픽업 슬롯·검증 알림은 조건부 렌더라 스캔에 안 잡혔다. 숨은 패널까지 포함해 재측정 후 마무리
  - `PRINT_OPTIONS` 라벨을 `shared/print-catalog.js`(이미 ko/en/de 보유)에서 가져오도록 변경 —
    **가격(billed value)은 select.js에 그대로 두고 이름만** 공유 소스로. `PHOTOCARD_MODE_LABELS`도
    wire 값(`retouched`/`mixed`/`original`)과 표시 라벨을 분리
  - 🔴 **쿠키 동의 배너가 3개 사이트 전부 한국어로 고정돼 있었음** (기존 버그).
    `site-analytics.js`는 de/en/ko를 이미 갖고 있었지만 **스크립트 로드 시점의 `<html lang>`(정적 `ko`)을
    한 번만 캡처**했다. 언어를 지연 조회하도록 바꾸고 `studiomean:langchange` 이벤트로 재적용 —
    booking·select 양쪽에서 dispatch. **독일 방문자가 한국어 쿠키 동의를 받던 GDPR 이슈 해소**
  - 🔴 **작업 중 발견한 기존 버그 (제 변경 아님, 커밋된 코드에도 존재)**: `boot()`이 384행에서
    호출되는데 `RETOUCH_SCOPE_LIMITED_GROUPS`는 975행 선언 → 모듈 평가 중 boot이 돌아 상수가 미초기화.
    고객 경로는 `await fetchSelectSession`이 먼저 양보해 우연히 살아있었고 **`?preview=1`은 await가 없어
    항상 터지고 있었음**(`Cannot read properties of undefined (reading 'some')`).
    `queueMicrotask(boot)`으로 수정 — 이제 preview도 정상 부팅
  - 독일어는 오너 검토 대기 대신 직접 재작성(2026-07-26 지시): 관청식 어휘·어색한 직역 16곳 교체
    (`Einwilligung zur Veröffentlichung`, `Schriftzüge`, `Erhalt der Abzüge`, `etwaig`→평문, 장문 분할).
    Sie-형 유지, 명사화 과다 표현 정리
  - **오너 확인 권장**: 실제 세션 링크(`?id=`)를 독일어 예약 건으로 한 번 열어 확인.
    preview 모드는 목 데이터라 포토카드/스냅 분기가 기본값으로만 렌더된다
  - v1(`select/select.js`)은 i18n 미적용 — 삭제/리다이렉트 대상이라 의도적으로 제외

- **프론트엔드 디자인·접근성 점검 패스 (2026-07-26, ⚠️ 미배포 · 커밋 전)** —
  포트폴리오 / 예약 / 셀렉 9개 페이지를 브라우저 실측(대비비·탭타깃·오버플로)으로 점검 후 수정.
  - 🔴 **`alt`에 원본 파일명이 들어가 고객 실명이 공개 노출** (`250502_임예지_무용프로필0379.jpg` 등, 61장 중 58장).
    스크린리더·Google Images·페이지 소스에 그대로 나감 → GDPR 이슈. `copy.photoAlt(label)` 3개국어 문구로 교체
  - **iOS 포커스 확대**: `font-size < 16px`인 폼 컨트롤 31개(예약 11·셀렉 6·상담 16 등) → 0.
    `.gallery-search`는 `@media (max-width:820px)`에서만 14px이라 데스크톱 점검으로는 안 잡히던 유형.
    `consultation.css`의 `button,input,select,textarea{font:inherit}`가 font-size까지 리셋해 라벨 13px을 물려받고 있었음
  - **대비 위반 24건 → 0건** (비활성 버튼 예외 2건은 2.09→3.3으로 상향).
    `.calendar-weekday` `.empty-state` `.muted-copy` 등 갈색 4종이 같은 역할이라 `--muted` 하나로 수렴.
    ⚠️ 알파 합성(`rgba()` 전경) 미검사 시 놓치는 위반이 많음 — `.lang-btn` 3.23 / `.site-footer-eyebrow` 2.58 등 7건이 그 유형
  - **`<html lang>`이 언어 전환을 안 따라감** (항상 `ko`) → `syncLanguageControls()`에서 갱신
  - **Space Grotesk 제거** — `스튜디오자료/CLAUDE.md`의 브랜드 정식 토큰은 Cormorant Garamond + Noto Sans KR.
    booking / promo / select v2 / 법적고지 4p 전부 통일 (한글 제목은 Noto Sans KR로 폴백되므로 실제 변화는 가격·숫자·영문)
  - **`frontend/shared/tokens.css` 신설** — 색·간격·폰트 단일 정의. 9개 스타일시트의 `:root`는 별칭만 유지해
    기존 `var()` 호출부를 건드리지 않음. CSS 빌드 스크립트에 `--bundle` 추가(→ `@import` 인라인, `url()` 0건이라 안전).
    수렴 과정에서 잠재 위반 2건 발견: status `--mute` 3.85, gutschein `--muted` 4.39.
    walkin `#f7f1e6` vs gutschein `#f7f1e7`(1 hex 차이)도 `--sm-surface-warm`으로 통합
  - **캐시버스팅 자동화** `scripts/stamp-assets.mjs` — 콘텐츠 sha256으로 `?v=` 스탬프, 3개 빌드 체인 말미에 연결.
    `--check`는 CI용. 🔴 이게 필요한 이유: Netlify가 css/js를 `immutable`로 주므로 `?v=`를 수동으로 안 올리면
    **배포해도 기존 방문자에게 영구히 반영 안 됨**. 작업 중 실제로 이 함정에 빠져 확인이 지연됨
  - `status.css`가 유일하게 미니파이 없이 원본 서빙되던 것 → `build:css:status` 신설, `status.min.css`로 전환
  - 부수 수정: walkin `.lang-panel` 246px가 375px 뷰포트를 넘겨 가로스크롤 유발(기존 버그) → `flex-wrap`,
    `outline:none` 3곳에 `:focus-visible` 대체 추가, `color-scheme` 9/9, `prefers-reduced-motion` 전역화,
    팔레트 밖 `#94a3b8`(Tailwind slate) 인라인 4곳 제거
  - **남은 것**: 셀렉 3개국어화(한글 문자열 134개 하드코딩 + `lang:'ko'`), 포트폴리오 모바일 햄버거
    (sticky 헤더 164px = 화면 20%, nav 9개 2줄 랩 → **2026-07-26 해결**), ~~포트폴리오 스크롤 리빌 모션~~
    → **2026-07-26 해결**, ~~이미지 width/height 누락(CLS)~~ → **오측정, CLS=0 확인**,
    ~~select v1 삭제 또는 `/v2/` 리다이렉트~~ → **2026-07-26 완료**, ~~컴포넌트 내부 하드코딩 hex 토큰화~~ → **2026-07-26 재정의 후 완료**(지각적 중복 병합)
  - ⚠️ **커밋 시 주의**: 작업 트리에 병행 중인 print-tier 작업(`booking.js` 신규 import, `select*.js`,
    `shared/print-catalog.js`, `shared/print-tier-copy.js`)이 섞여 있음. 이 패스의 변경만 분리 필요

- **인화 등급 리네이밍 시그니처/파인아트 + 10×15 가격 확정 (2026-07-26, ✅ 배포 @657 · 커밋 `4e562c8`,`4b7255d`)** —
  '기본/프리미엄'이 실제 용지(Epson Premium Semigloss 251g / Hahnemühle Photo Matt Fibre 200g)를 저평가하던 문제와,
  10×15에서 **파인아트(€3)가 시그니처(€5)보다 싸던 가격 역전**을 함께 해소.
  - 가격: `basic_10x15` 보정본 5→3·원본 5→4, `premium_10x15` 보정본 3→6 (그 외 사이즈 불변, **SKU id 전부 불변**)
  - **가격 정의가 5곳에 중복** — Code.gs `PRINT_LABELS` · AdminV2 `PRINT_PRICES` · select.js · v2/select.js ·
    shared/print-catalog.js. 하나만 고치면 화면가와 청구가가 어긋난다 (ops-checklist §46은 3곳으로 기재 → 5곳으로 갱신 필요)
  - 🔴 **리네이밍이 깨뜨리는 2곳을 함께 수정** (이게 이 작업의 핵심 리스크였음)
    - `print/app.js normPrintId()`: `/prem|프리미엄/`으로 라벨→SKU를 역추론 → '파인아트 A4'가 `basic_a4`로 오인식되어
      **잘못된 용지로 자동 출력**될 뻔함. `PREMIUM_LABEL_RE`(`파인아트|fine art|fineart` 포함)로 분리
    - `select.js resolvePrintTypeId()`: 라벨 포함매칭이라 진행 중 세션의 구 라벨('프리미엄 A4')이 `basic_10x15`로 폴백 →
      `LEGACY_PRINT_LABEL_IDS` 별칭맵 추가
  - 부수: `getInvoicePrintLabelCatalog_`에 누락돼 있던 `premium_a3plus` 추가 / 고객 노출 서비스컷 문구 4곳 /
    서비스컷 크레딧 주석 €5→€3 / 캐시버스트 `?v=20260726-print1`
  - ⚠️ **미검증**: 실제 셀렉→인화 주문 E2E(포함 €0 / 보정본 / 원본 3경로)는 실고객 세션이 필요해 미확인.
    **파인아트 A4 실물 1장 출력 테스트 권장** (정규식 수정이 실제 용지까지 맞는지)
  - ⚠️ AdminV2 `basic_10x15.priceRetouched=0`은 select(3)와 불일치하나 **기존 값 그대로 유지**(수동주문 의미 보존) — 판단 필요

- **수령 완결 — 인화물 전달 기록 (2026-07-23, ✅ 배포 @650 · 커밋 `3cedf15`)** — 인화가 끝난 뒤 인화물이 실제로 고객에게
  갔는지를 시스템이 전혀 모르던 구멍을 닫음. **상태값이 아니라 컬럼**으로 모델링(상태로 만들면 `최종작업완료`와 배타적이라
  둘 중 클릭 적은 쪽만 쓰이고, `isSelectFinalLockedStatus_`에 들어가면 픽업 페이지가 죽음).
  - 사진셀렉 +5컬럼(끝에 append): `수령완료일시`/`수령방법`/`수령메모`/`픽업리마인드발송일시`/`픽업리마인드횟수`
  - **주 입력면 = `print.studio-mean.com/handover/`** — 카운터에서 한 손으로 쓰는 모바일 페이지, 인화앱 PIN
    (`smphoto:printListPasscode`) 재사용. 어드민 셀렉탭 16열 중 버튼은 보조 경로. 전달 순간은 고객과 대화하는 60초라는 판단.
  - 우편발송 기록 시 3개국어 발송 안내 메일(`_sendSelectShippedEmail_`) — 시스템이 이미 약속해 두고 안 보내던 메일
  - `C4 픽업 미예약 리마인드`(dailyTasks): 안내 후 5~30일·**평생 1회**(카운터 게이트)·일요일 제외·실행당 8건·쿼터 프리플라이트
  - 아침 리포트 `handoverPending` 섹션(픽업노쇼/미수령/발송대기), 어드민 `수령완료` 칩+경과일, 에이전트 액션 4종
    (`select-handover-pending|done|undo`, `select-pickup-reminder-run`)
  - **부수 수정(기존 결함)**: `ensureSelectSheet_`가 그리드 여유 없이 `getLastColumn()+1`에 헤더를 써서 컬럼 추가 시 throw →
    인화앱·픽업페이지·어드민 셀렉탭·아침리포트 동시 사망 가능이었음. 고정폭 시트 읽기 5곳도 마이그레이션 창에서 throw
    (특히 `verifySelectSubmissionSaved_`는 **고객 제출 경로**라 제출 셀을 다 쓴 뒤 터져 예약장부 동기화·추가금 인보이스·알림메일이
    통째로 스킵될 수 있었음). `resendSelectLinkAdmin` 전체행 덮어쓰기에 수령 기록 이월. B5를 `AUTOMATION_JOB_NAMES_`에 등록.
  - 배포 직후 `daily-briefing`으로 마이그레이션 강제 실행해 노출 창 폐쇄. 합성 세션 E2E(제출→기록→멱등→정정→우편전환→
    발송메일→상태롤백) 통과. 첫 실데이터: **Tabea Krug 픽업 예약 2026-07-11 노쇼 12일 경과** — 사장님 확인 필요.
  - 남은 것: 수령 후 픽업 재예약 차단 가드는 `출력완료일시`가 있어야 도달하는 경로라 코드 검증만 함(실인화 때 확인).

- **기프트 바우처 상시 광고 (2026-07-18)** — 예약 사이트에 선물용 바우처 프로모 2곳: 페이지 하단 상시 스트립
  (`#voucherPromoStrip`) + 예약완료 패널 카드(`#voucherPromoSuccess`). 3개국어(booking.js COPY `voucherPromo*` +
  applyCopy setText), CTA=이메일 문의(자가구매 페이지 없음·바우처는 admin 발행). booking.min.js 재빌드+캐시버스트 u7a.
  라이브 검증(스트립 1100×89px 렌더·ko/de/en 전환·mailto href). 기존 Gutschein 시스템 무변경 — 판촉 레이어만 추가.
  다음: 시즌 인스타 캠페인(이벤트 카드 생성기와 묶기)·바우처 발행 시 판매채널 태깅.
- **강화 백로그 4건 (2026-07-18, @609·@610)** — 코드로 검증 후 부가 구현·배포:
  - `lead-add` 에이전트 액션(리드 시트 적재, ref 중복방지) + `automation/comment_guard.py` 연동
    (문의성 댓글 → ERP 리드 시트 자동 기록). 스모크테스트 완료(추가+중복스킵). *리드 시트에 "TEST-스모크" 행 1개 = 삭제 가능.*
  - `sendAnniversaryRecommendationEmails_`(크론 B5): 가족/아기/돌/키즈/만삭 작업완료 촬영 1년(350~400일) 후
    재촬영 넛지 3개국어. 신규 컬럼 `기념일추천메일발송일시`(끝에 추가, ensureHeaderSheet_ 자동 마이그레이션).
  - D6 `_quoteHoldDailyCheck_`에 "발송 후 무응답 7일+·유효" 냉각 세그먼트 추가(어드민 팔로업 다이제스트).
  - ELSTER: 블라인드 자동생성은 세금 오류 위험(입력·재조정 필요) → **분기 마감 리마인더**를 D7 브리핑에 추가
    (분기 말25일~초20일 창, "감사팩 요청" 유도). 실제 산출은 입력 확보 후 요청(오너 게이트 유지).
- **서비스별 SEO 랜딩 9페이지 (2026-07-17)** — `frontend/portfolio/{,en/,ko/}{frankfurt-snap,germany-wedding,passport-photo}/index.html`.
  3서비스(프랑크푸르트 스냅 €150~ / 독일 웨딩·프리웨딩 €650~ / 여권·비자 €30) × 3언어. studio-mean.com 다크
  에디토리얼 디자인 재사용(portfolio.min.css), 언어별 키워드 title·desc, hreflang 4개 상호연결(de/en/ko+x-default),
  JSON-LD Service+FAQPage(리치결과), 무JS(FAQ=`<details>`, CSP 준수). sitemap 20 URL. 이미지=포트폴리오 Drive(lh3).
  **홈페이지 3언어 "촬영 분야" 섹션에 랜딩 3개 키워드 앵커 내부링크** 추가(`./slug/` 언어별 자동해석). 전 페이지 라이브 검증(HTTP 200).
  생성기: 세션 스크래치패드 `lp_gen.py`/`lp_gen2.py`(KO style 재사용, 콘텐츠 config만 교체) — 확장 시 재사용.
  남은 선택: 랜딩↔랜딩 상호링크, 서치콘솔 sitemap 제출(색인), 여권 히어로 이미지 교체.
- **캘린더 성능 계측 배포 (2026-07-17)** — `booking.js recordCalendarTiming`: 월별(현재/다음/셋째) 로드타임 localStorage 수집,
  콘솔 `__calPerf()` 열람, >1.5s 경고. 라이브(booking.min.js 재빌드+캐시버스트 u6a).
  - **2026-07-27 실측으로 종결 — 서버 최적화는 무의미하다는 결론.** 라이브 웹앱 curl 측정:
    `?api=init` 3.7~4.6s, `?api=calendar-batch`(캐시 히트) 2.9~3.7s, **아무 일도 안 하는 경로
    (`?api=__nope__` → 즉시 jsonError_) 3.5~4.1s**. 구간 분해: DNS 6ms · TCP 25ms · TLS 80~180ms ·
    **첫 바이트 3.4s(그중 리다이렉트 2.9~3.5s)**. 즉 3.5초는 Apps Script 웹앱의 디스패치·302 오버헤드이고
    우리 코드(시트 읽기+직렬화)는 그 위 **0.3초 남짓**이다. TTL·프리페치·쿼리 튜닝으로 얻을 수 있는 최대치가
    전체의 8% 미만이라 착수하지 않는다. 체감 개선은 **클라이언트 캐시 쪽**에만 남아 있었다
    → 2026-07-27 처리 완료(커밋 9155df6): `readInitDataCache` 를 sessionStorage·5분 →
    localStorage·12시간으로, **재방문 4초 → 65ms**. 이 과정에서 캐시 히트 시 부팅이 TDZ 오류로
    죽던 **라이브 버그**도 발견·수정(같은 탭 5분 내 새로고침한 고객이 로딩 화면에 갇혔다).
  - **⚠ 단, `/api/slots` 는 별개였다 — 여기는 실제로 우리 코드가 느렸다 (2026-07-27 완료, 커밋 ebe54df).**
    날짜 클릭 시 중앙값 9.6초·최대 17초, 닫힌 날짜는 22.8초였는데 `getPublicSlots_` 에 캐시가 전혀 없었다.
    바로 옆 `getPublicCalendarBatch_` 의 버전키 캐시를 복사해 **9.9초 → 3.6초**(= 플랫폼 바닥, 더 줄일 여지 없음).
    무효화는 기존 `bumpCalCacheVer_` 가 그대로 담당하고, 예약 제출의 서버 재검증만 `skipCache` 로 우회한다.
    교훈: "Apps Script 라 느리다"는 결론을 엔드포인트 단위로 재검증할 것 — init 은 맞았고 slots 는 틀렸다.
- **아침 브리핑 마케팅 섹션 (2026-07-17, ✅ 배포 @608)** — `Code.gs _buildDailyBriefingData_`에 marketing 블록
  (마케팅 스케줄 시트 예정게시 7일+최근 성과) + D7 메일에 "📣 마케팅(인스타)" 섹션. 부가 구현(기존 필드 불변).
  clasp push+redeploy @607→@608, daily-briefing 에이전트로 스모크테스트(marketing 필드 반환 확인, 현재 데이터 0/0은 정상). git 커밋됨.
- **미수금 전수 정리 (2026-07-16, @603)** — Immediate #3 참조: 19건→6건, `booking-confirm-balance` 에이전트 액션 신설, 현금장부 이중집계 €600 해소
- **Drehvertrag 파이프라인 (2026-07-16)** — `scripts/make_drehvertrag.py`: DEAL 설정→HTML→Chrome PDF→견적 합본(pypdf). 2025 휘슬러 계약(12조) 구조 미러 + 2026 갱신(19% MwSt·USt-IdNr, 교정 1회, 사용범위 웹/SNS/사내·유료광고 별도, 인보이스 기준 지급). 휘슬러 2026 초안 생성: `계약서/2026/Drehvertrag_FisslerKorea_2026_draft*.pdf`. **2026-07-17 종결: 휘슬러(갑) 측이 자체 계약서를 전달하기로 함 → 우리 초안은 발송 안 함(내부 참고·타사 견적 합본 템플릿으로만 보존).** 상대 계약서 수령 시 조건 리뷰만 하면 됨. 계약금 €300 인보이스는 계약 확정 후 지시 시 발행.
- **Update 4 전체 배포 (2026-07-16)** — `docs/update-4-plan.md`
  - Wave A: 첫 메뉴 7타일 B2C/B2B 분리(웨딩·가족 행사 / 기업·단체 B2B 상담형), 프리웨딩↔본식 구분 문안, B2B 상담 딥링크(?type= 프리셀렉트)+SLA, 날짜 스텝 잠금(슬롯 미점유)
  - Wave B: consult-list/get/update 에이전트 액션, 브리핑 미처리 상담 섹션, "상담 견적 초안"·"계약금 인보이스" 스킬 워크플로
- 인보이스 로컬↔ERP 동기화 (2026-07-16): STMIN-260001~005 마이그레이션(센트 단위 일치), 260006 PDF 재생성→로컬, 260008/9 결번 Storno(발행취소 €0), 연번 15건 완결. invoice-update(상태 발행취소·PDF 재생성)/invoice-create data 패스스루 액션
- HSAD 매출/미수 등록 (2026-07-16): 예약장부 수기행 212(€892.50, offen) — 장부 openAmount·브리핑 추적, booking-create-manual/booking-set-type 액션, 브리핑 미수 필터 정규식 정합(@595)
- 스냅 보정범위 제한 (2026-07-16, @597): 셀렉 안내(포함/제외+사람제거 합성)+키워드 힌트+관리자 배지+예약페이지 상품 상세 3개 국어
- 출장비 정책+자동계산 (2026-07-16): 스튜디오 기준 존제(B2C 30km 무료/+30/+70) 제안, B2B 공식(구간+조명 +€30, KOTRA·휘슬러 캘리브레이션), 도시 거리표(웹 검증: Koblenz 125km 등 정정) — rate card §3
- ERP 성능 (2026-07-15~16): ensureSheets_ 메모이즈, 예약저장 배치쓰기, 장부 107s→13s(formatDate), select-session 9.1s→~4.2s(getSheetsReadonly_)+_timing, 갤러리 프리페치(1차 셀렉 즉시)
- 어드민 큐 정리 (2026-07-16, @599): manualReview 대기중만 표시, walkin-list/update-status 액션, 잔존 완료건 정리(워크인 이준경·상담 고도영), 돌잔치/가족파티 분류 개인 전환(신규 규칙+기존 행 정정)
- 셀렉 재발송·수령 경고 (2026-07-16, @600): [재발송] 제목+빠른제출 안내, 알림에 기본 포함 인화 표시+수령 미선택 빨간 경고+지시서 포함분 표시
- 셀렉 v2 서비스컷+무료인화 차액 (2026-07-15~16): v2 포팅(무료 보정 슬롯), 10×15 크레딧(차액), 4단계 가시화, 발송 후 수량 수정(select-set-counts+어드민 버튼)
- 휘슬러 계약 확정 처리 (2026-07-16): quote-accept(가예약 10/22-23 유지), 계약 세부 메모

- ERP agent platform shipped (2026-07-15)
  - erp-agent public API (automation-key auth, admin-issued/revocable) + scripts/erp-agent.mjs CLI + studio-erp skill
  - domains: quotes (create/update/send/hold/snooze/extend), invoices, bookings (search/status/confirm-mail), select (search/retouch-send/status), accounting (ledger/settlement/close/expense/cash/sumup/bank)
  - first production runs: 조미정 재보정 발송, revision status cleanup, AN-260001~005 quote migration, Fissler Korea hold with 10/22-23 tentative block
- Quote hold pipeline + tentative calendar blocks (2026-07-15)
  - 보류 status excluded from auto-expiry; reason/follow-up/held-at fields; D6 daily follow-up (due reminders + 60d stale closure)
  - multi-day all-day 가예약 events block public slots via calendar source-of-truth; auto-released on convert/reject/expire/release
  - validity extension + PDF regen; admin hold controls
- Daily ops automation (2026-07-15)
  - D7 morning briefing email: week schedule, action items, unpaid balances (auto-detected), quote follow-ups, select pipeline, evidence inbox
  - D8 invoice-mail collector → Drive 회계증빙/인박스; agent evidence upload/list/archive; local 회계/인박스 folder — Lexware fully retired (key revocation on Lexware side pending)
- Select enhancements (2026-07-15)
  - private service cuts: admin-set per-session free slots, zero-trace when 0; basic 10x15 print included
  - bonus/service print upgrades charge difference only (uplift_ print entries keep server totals consistent)
  - premium A3+ print size (retouched 45 / extra 60) across catalogs
  - balance quick-confirm button in ledger with shoot-day date default
- Security hardening (2026-07-15)
  - '1234' auth fallback removed (verified rejected live); admin password change UI added; automation key rotated after chat exposure
- Mail copy cleanup shipped (2026-07-15): payment-block dedupe, DE umlauts, pending-mail diet (1B), locale-appropriate greetings, wed/pass guide parity

- Gutschein V2 customer redemption shipped (2026-07-14)
  - booking final step has voucher code input with 15-min hold, live discount preview, countdown, and remove button
  - public APIs: gutschein-validate / gutschein-hold / gutschein-release (LockService-serialized, expired holds lazily released)
  - finalize runs inside processForm right after the booking row is created; failure alerts admin instead of blocking the booking
  - hold released on page exit (keepalive), product change, expiry, or manual remove; daily trigger sweeps expired holds
  - admin Gutschein tab shows 예약중 status with hold expiry, draft id, and force-release button
- Quote module upgrades shipped (2026-07-14)
  - quote PDFs follow the AN-260003 layout; per-quote PDF display toggles; multiline items
  - languages: de/ko/en single or combined multi-page PDFs with `//` per-language text split
- Retouch revision double-submit hardened (2026-07-14)
  - button lock + script lock + duplicate detection + same-round addendum (no double count consumption) + failsafe relay mail
  - retouch action links extended to 60 days; revision form re-signs on open
- Select flow overhaul deployed (star-rating gallery pre-select, gallery-sourced photos always free, backend extraRetouch aligned)
- Admin booking E2E diagnostics added to Apps Script HEAD
  - checks booking API, booking frontend, product loading, return-discount rules, booking sheet headers, Google Calendar access, mail quota, and recent booking log linkage
  - optional calendar write/delete probe and admin-only test mail probe are available from the dashboard
  - production deployment is pending Project History version cleanup
- Select retouch count persistence fixed in Apps Script HEAD
  - resend now preserves edited base retouch count and marketing bonus count instead of recalculating product defaults
  - Admin select table edit action now updates both base count and marketing bonus count
  - production deployment is pending Project History version cleanup
- Booking mobile and calendar polish completed
  - tightened mobile footer spacing, month header sizing, and loading card hierarchy
  - selecting a time now stays inside the date/time step without pushing the user into another section
  - production mobile check passed at 390px width
- reshoot discount rule corrected
  - current passport / visa bookings cannot receive the discount
  - passport / visa bookings can be used as the source booking when the new booking is profile, studio, outdoor, wedding, or event
  - booking page, admin labels, quote API, submit API, and audit / repair tools use the same exclusion rule
- Gutschein V1 tax-safe ledger fields completed
  - added `발행시점세율`, `세무판단근거`, `실제사용상품ID`, `실제사용상품명`, `실제사용일시`
  - Admin Gutschein tab now has `세무필드 보정` for existing rows
  - redeem flow records actual booking product into the Gutschein ledger
  - PDF notes now display Einzweck / Mehrzweck Gutschein tax timing wording
- reshoot discount audit / repair added to Admin settings
  - audit uses booking submission time, so same-day reshoot bookings can still be found after midnight
  - passport / visa bookings are excluded only as target bookings; they can be source bookings
  - verified source booking is shown before applying
  - repair updates booking total, balance, discount flag, memo, and calendar memo
- select gallery loading stabilized for large Drive folders
  - Apps Script API now caps/list-times Drive photos and returns retry-safe responses
  - v2 select page now has gallery timeout, retry UI, partial-load notice, cache-busted script, and CSP-safe image handlers
  - production preview verified at `select.studio-mean.com/v2/?preview=1` with 161 photos
- booking confirmation email now attaches a customer calendar `.ics` file with schedule, location, total, deposit, balance, payment notes, map link, and request memo
- select link marketing bonus quantity can be adjusted per booking, with MyRealTrip defaulting to 5 bonus retouches
- Business / Event customer UI cleanup
  - removed customer-facing hour-price wording from the booking detail panel
  - event quote cards now show consultation/schedule-review wording instead of duration as a price anchor
  - success guide wording now points to email quote review instead of direct price exposure
- booking/select split to Netlify
- booking wizard flow rebuilt
- month/day slot split
- product-specific guides added
- follow-up mails automated
- review + instagram links wired
- passport multi-country per person support
- passport single-product auto-open
- booking/select success screens rebuilt
- Lexware API key integration
- Lexware settings / connection test / invoice send / payment sync
- Lexware invoice preflight guard and manual-by-default sending
- accounting summaries, DATEV/summary CSV, German export labels
- Lexware import diagnostics confirming `contacts exist but invoices/vouchers are currently 0`
