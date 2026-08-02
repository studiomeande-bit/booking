# Drehvertrag 계약 파이프라인 v1 (2026-08-02, @717~720)

대상(사장님 확정): **B2B·웨딩본식 등 €500 이상 건.**
조항: `계약서/2026/Drehvertrag_FisslerKorea_2026_draft.html`(12조)을 파라미터화한 `DV-v1 (2026-08-02)`. 계약서 언어는 ko(MVP) — de/en 후속.

## 흐름

1. `contract-create` — 견적(`quoteNumber`)/예약(`bookingRowIndex`+`expectName`)/수기(`data`)에서 초안 생성 + PDF (Drive `StudioMean_Contracts/`). 시트 `계약서`(신규, 37열).
2. `contract-send` ⚠️외부발송 — PDF 첨부 + **서명 링크**(HMAC `contract_sign`, 14일 TTL) 메일.
3. 고객이 링크에서 전문 확인 → 성명 입력 + 동의 체크 → **단순전자서명**(서명자명·일시·UA·조항해시 기록).
   - 제출은 공개 API `contract-sign-submit`(fetch) — google.script.run 미사용(카카오톡 인앱 브라우저 호환). HMAC/만료 재검증은 서버(`submitContractSignaturePublic`).
4. 서명 시: 상태 `서명완료` → **서명본 PDF 재생성**(서명블록 각인) → 고객·관리자 양측 메일 + 예약행 메모 스탬프.
5. `contract-pending` — 계약 필요 예약 목록: `biz`/예약유형 기업 · 상품명 본식/결혼식/암트/Hochzeit · 총액 ≥ €500 (상태 대기중/확정됨, 서명완료 계약 없는 건).
6. 기타: `contract-list` / `contract-cancel`(서명완료는 취소 불가 — 수동 합의 필요).

## 조항 설계 포인트

- **저작권귀속 파라미터** (`저작권귀속`): 기본 `스튜디오`(을 귀속 + 갑 사용범위 라이선스, 유료광고 별도협의) / `고객`(전부양도 — Fissler형 협상 케이스만).
- 제10조에 "고객 사유 취소 시 예약 시 고지된 취소·환불 규정 적용" 연결. 준거법 독일법, 관할 을 소재지.
- 원본 보존 최대 1년(제7조), 교정 1회 포함(제5조), IBAN/USt-IdNr 각인.

## 검증 (라이브 E2E, 합성 계약 DV-260802-BDM2)

- create→PDF, send→관리자 수신함 메일+링크, 서명 페이지 12조+금액표 렌더(날짜 정규화 확인), **변조 sig 거부**, 정상 서명→`서명완료`+서명본 PDF(`%PDF` 확인)+양측 메일, 재서명 시 `alreadySigned` 멱등.
- `contract-pending` 실데이터 3건 정확 검출: Anna(행사 €750)·휘슬러(€3,513)·Alice(본식 €1,300).
- 잡은 버그 2건: doGet 액션 화이트리스트 누락(@718), 시트 Date 재해석 원시노출(@719).

## 후속 완료 (2026-08-02 저녁, @721~722)

- ✅ **de/en 계약서** — 12조 전문 3개국어(ko/de/en) 사전화. 언어는 견적/예약 `언어` 필드에서 자동 파생(복합 언어는 ko), `data.lang`으로 덮어쓰기 가능. 서명 페이지·발송/서명완료 메일·서명블록·PDF 전부 현지화. de PDF 라이브 렌더 검증(합성 DV-260802-6BYD, 검증 후 취소).
- ✅ **아침 브리핑 노출** — `_buildDailyBriefingData_`에 `contractPending` 섹션(집계실패 가드 포함) + 브리핑 메일 "액션 필요"에 📝 계약서 필요 라인. 라이브 3건 검출 확인.
- ✅ **견적 수락 자동 초안** — `quote-accept` 시 B2B 또는 €500+ 견적이면 활성 계약 부재 시 초안 자동 생성(메일 없음), 응답에 `contractDraft{contractId,pdfUrl}` 포함.

## 테스트 기록

- 계약서 시트 행2 `DV-260802-BDM2`(서명완료) = E2E 검증 기록 유지, 행3 `DV-260802-6BYD`(취소) = de 렌더 검증
