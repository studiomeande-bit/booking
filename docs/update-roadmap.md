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
- booking success screen polish (남음)
- ~~select design alignment with booking~~ → 사장님 결정으로 종결: 셀렉은 크림+그린 톤 유지 (의도된 무드 구분)
- ~~spacing / typography consistency review~~ → 폰트 스택 통일 완료 (Noto Sans KR 우선)
- ~~mobile safe-area and in-app browser polish~~ → select viewport-fit=cover + safe-area insets 적용 완료

12. ~~Ops checklist refresh~~ → docs/ops-checklist.md 작성 완료 (2026-07-15: 배포 절차·주의사항·회귀 체크리스트)

13. Optional finance expansion
- decide whether instant card sales also create Lexware documents
- if needed, add SumUp or bank CSV import path
- otherwise keep those flows as local-ledger + summary export only

## Done Recently

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
