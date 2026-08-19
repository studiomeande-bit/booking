# Fotografenvertrag (B2C 소비자용) — 표준 조항 스펙

> 2026-08-18 작성. 기존 Drehvertrag(B2B)는 소비자 계약에 부적합 — 별도 계약종류로 분기한다.
> 근거 사례: DV-260818-M273 (Jin Hee Choi 웨딩, 견적 AN-260011). 검토에서 4건 결함 확인.

## 1. 왜 분기가 필요한가 (실제 결함)

| 조항 | B2B 현행 | 소비자 계약에서의 문제 |
|---|---|---|
| 제목 | `Vertrag über Foto- und Videoproduktion (Drehvertrag)` | 견적서엔 "Fotografenvertrag" 약속. 영상 없는 건에 "Videoproduktionsleistungen" 문구 |
| § 9 Vertraulichkeit | 영업비밀 상호 비밀유지 | 개인 고객에게 영업비밀 의무 부과 — 무의미·부적절 |
| § 10 Kündigung | 강제집행·도산·폐업 사유 | 사업자 전제. "예약 시 안내된 취소규칙" 참조가 공허(웨딩엔 없음) |
| § 12 Gerichtsstand | 수급인 소재지 관할 | **소비자 상대 무효** (§§ 12·13 ZPO), 약관이면 § 307 BGB 위반 소지 |
| — | 없음 | **Widerrufsbelehrung 누락** → 미고지 시 철회기간 14일 → **12개월+14일** (§ 356 Abs. 3 BGB) |

## 2. 계약종류 분기

`contractType` 에 `Fotografenvertrag` (또는 `b2c`) 추가. 판정 기준:
- 고객이 개인(회사명·VAT번호 없음) → B2C
- itemGroup 이 wed/stud/snap/prof/pass → B2C 성향
- 명시 지정(`contractKind:"b2c"`)이 최우선

기존 B2B 계약은 **현행 그대로 유지**(하위호환 필수).

## 3. B2C 표준 조항 (독일어 정본 / 한국어 병기)

제목: **Fotografenvertrag**
당사자: `… schließen den folgenden Vertrag über fotografische Leistungen.`
(고객이 여성이면 Auftraggeberin, 남성이면 Auftraggeber — 성별 필드 없으면 중립 `Auftraggeber:in` 또는 이름 직접 사용)

- **§ 1 Vertragsgegenstand** — 촬영 및 사진 제작 용역. (현행 유지, "Produktionsleistungen"→"fotografische Leistungen")
- **§ 2 Laufzeit** — 현행 유지.
- **§ 3 Leistungsumfang** — 견적에서 자동 구성(아래 §5 참조).
- **§ 4 Vergütung und Zahlung** — 견적 금액·계약금·잔금 자동. 금액은 **독일식 표기**(1.950,00 €).
- **§ 5 Abnahme und Korrekturen** — 현행 유지.
- **§ 6 Mitwirkung** — 소비자용으로 완화: 촬영 진행에 필요한 정보(일정, 원하는 단체사진 목록 등)를 적시 제공.
- **§ 7 Nutzungsrechte und Urheberrecht** — 저작권은 사진가 귀속. 고객은 **사적·비상업적 목적의 무기한·무제한 이용권**. 상업적 이용은 별도 합의.
  ※ 보관기간은 B2B 기본값(1년)을 쓰지 말고 계약별 값(웨딩 권장 12개월 이상) 사용.
- **§ 8 Abtretung** — 현행 유지.
- **§ 9 Datenschutz** ← *Vertraulichkeit 대체*
  `Der Auftragnehmer verarbeitet personenbezogene Daten ausschließlich zur Durchführung dieses Vertrags (Art. 6 Abs. 1 lit. b DSGVO). Aufnahmen werden nicht ohne gesonderte Einwilligung veröffentlicht. Der Auftraggeber:in stehen die Rechte nach Art. 15–21 DSGVO zu.`
- **§ 10 Stornierung und Terminverlegung** ← *Kündigung 대체* — 스토노 스태플을 **본문에** 명시(특약으로 빼지 않는다):
  - 12개월 초과 전 취소: 계약금 몰수
  - 6~12개월 전: 총액 50 %
  - 1개월 이내: 총액 80 %
  - 대체일 합의(12개월 내): 계약금 전액 이월
  - 수급인 귀책 불이행(질병·사고·불가항력): 동급 대체 사진가 주선, 불가 시 **기지급액 전액 환불**
- **§ 11 Haftung** — 소비자용: 고의·중과실 및 생명·신체·건강 침해는 무제한, 그 밖의 경과실은 계약전형적 예견가능 손해로 제한.
- **§ 12 Anwendbares Recht** — 독일법. **관할합의 조항 삭제** → `Es gelten die gesetzlichen Gerichtsstände.`
- **§ 13 Widerrufsbelehrung** (신규, 필수) — 아래 §4.
- **Besondere Vereinbarungen** — 견적별 옵션(포트폴리오 동의, 추가시간 단가 등) 자동 주입.

## 4. Widerrufsbelehrung (법정 양식 — 문구 임의변경 금지)

**Widerrufsrecht**
`Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses. Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Studio mean, Inhaber Taewoong Min, Holzweg-Passage 3, 61440 Oberursel, Tel. +49 176 6093 9400, studio.mean.de@gmail.com) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.`

**Folgen des Widerrufs**
`Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.`

**Vorzeitige Leistungserbringung (§ 356 Abs. 4 BGB)** — 촬영일이 계약일로부터 14일 이내인 경우에만 삽입:
`Haben Sie verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so erlischt Ihr Widerrufsrecht mit vollständiger Erbringung der Dienstleistung.`

**Muster-Widerrufsformular** (Anlage 2 zu Art. 246a § 1 Abs. 2 S. 1 Nr. 1 EGBGB) — 계약서 마지막 장에 별도 페이지로 첨부:
```
An: Studio mean, Inhaber Taewoong Min, Holzweg-Passage 3, 61440 Oberursel, studio.mean.de@gmail.com
Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung (*)
Bestellt am (*)/erhalten am (*): ______
Name des/der Verbraucher(s): ______
Anschrift des/der Verbraucher(s): ______
Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ______
Datum: ______
(*) Unzutreffendes streichen.
```

**중요**: 철회 기간(14일) 내에는 § 10 스토노 규정보다 **법정 철회권이 우선**한다 — 전액 환불. 계약서에 이 우선순위를 명시할 것.

## 5. 견적 연동 — 내용 자동 구성

현행은 `deliverables` 가 견적 품목의 **첫 줄만** 이어붙인다. 개선:

- **§ 3 Leistungsumfang** 을 견적 `items` 에서 구성 — 품목명(첫 줄)은 `Leistung`, 나머지 줄은 그 하위 설명으로. 다국어 `//` 구분자는 계약 언어에 맞는 쪽만 사용.
- **금액 0원 라인**(이용권리 등)은 Leistungsumfang 에는 넣되 Vergütung 표에서는 제외.
- **§ 4** 는 견적 netto/vat/total/deposit 그대로. `vatMode:exempt_third_country` 면 부가세 행 대신 면제 문구(견적과 동일 처리).
- **Besondere Vereinbarungen** 에 견적 `terms` 중 옵션·조건 항목 자동 이관(수기 입력 없이도 기본 채움). 수기 `specialTerms` 가 오면 그것이 우선.
- 촬영일·장소는 견적 `shootDate` + `product`/`terms` 에서. 값이 없으면 빈칸이 아니라 `nach Absprache`.

## 6. 그 밖의 수정

- **금액 포맷**: 계약서 PDF가 `€ 1950` 로 출력됨 → 견적서와 같은 독일식 `1.950,00 €` 로 통일.
- **당사자 주소**: 고객 주소가 비면 계약서 당사자 표기가 약하다. 견적/예약에서 상속하고, 없으면 생성 시 경고.
- **성별 표기**: 본문 `Auftraggeber` 와 특약 `Auftraggeberin` 혼재. 한 문서 안에서 통일.

## 7. 검증

1. Jin Hee Choi 건(AN-260011)으로 B2C 계약 재생성 → 제목 `Fotografenvertrag`, § 9 Datenschutz, § 10 스토노 스태플 본문, § 12 관할합의 없음, § 13 Widerrufsbelehrung + 별지 서식 확인.
2. 기존 B2B 계약(휘슬러 등) 재생성 → **현행과 완전히 동일**(하위호환 회귀 확인).
3. 금액 포맷·부가세 면제 모드 양쪽 렌더 확인.

## 8. 법률 확인 필요 (개발 범위 밖)

Widerrufsbelehrung 문구와 스토노 스태플 비율은 변호사 검토를 받는 것이 안전하다. 특히 스토노 비율은 과도하면 § 309 Nr. 5 BGB(위약금 상한) 문제가 될 수 있다.
