# Update Roadmap

Updated: 2026-07-15 Europe/Berlin

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

2. Lexware actual workflow validation
- run `점검/전송` preflight on one real invoice
- send one real invoice only after the preflight confirms customer / amount / address / contact state
- sync payment status via `💶 상태`
- verify booking ledger / invoice sheet / accounting tab update consistently
- confirm receivables are driven by Lexware status when available

3. Receivables cleanup
- verify which rows should truly remain `미수금`
- remove false positives from local-only completed payments
- confirm contract deposit / balance payments show consistently

## Next

6. Gutschein V2 customer redemption design
- add `예약중` hold state
- customer-side code validation in booking final step
- hold release on timeout / cancel / failed submit
- finalize voucher on successful booking submit only
- add admin hold monitor and release tools

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
- Phase 2 (대기): 하이브리드 상담상품 신설 · "기업 출장 촬영" 포괄상품(② 확정) · 구조화 상담 페이로드 상담시트 단일화
- Phase 3 (대기): 상담접수 → 견적 드래프트 자동화 (단가표 저장 완료로 준비됨)

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
