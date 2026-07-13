# Studio Presence iPhone Shortcuts Setup

독일 스튜디오 운영 기준으로 가장 안정적인 방식은, 아이폰 단축어가 **캘린더에 직접 이벤트를 만들지 않고** 예약 시스템의 `studio-presence-open / close` URL을 호출하는 것입니다.

이 방식이 좋은 이유:

- 예약 엔진이 바로 읽는 `Studio Open` 이벤트를 정확한 캘린더에 생성합니다.
- 캐시를 함께 갱신해서 반영이 더 안정적입니다.
- 수동 캘린더 생성보다 오작동이 적습니다.

대상 예약:

- `여권 / 프로필 / 스튜디오`

## 1. 먼저 Open / Close URL 받기

아래 주소를 브라우저에서 한 번 열어 설정값을 확인합니다.

```text
https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec?api=studio-presence-config&password=ERP비밀번호
```

응답에 아래 값이 들어 있습니다.

- `openUrl`
- `closeUrl`
- `calendarName`
- `defaultMinutes`

이 중 `openUrl`, `closeUrl`을 단축어에 그대로 넣으면 됩니다.

## 2. 도착용 단축어 만들기

단축어 이름:

- `Studio Open`

권장 액션 순서:

1. `URL`
   - 값: 위에서 받은 `openUrl`
2. `URL의 내용 가져오기`
   - 방법: `GET`
3. 필요하면 `결과 보기`

## 3. 출발용 단축어 만들기

단축어 이름:

- `Studio Close`

권장 액션 순서:

1. `URL`
   - 값: 위에서 받은 `closeUrl`
2. `URL의 내용 가져오기`
   - 방법: `GET`
3. 필요하면 `결과 보기`

## 4. 위치 자동화 만들기

### 도착 자동화

1. 단축어 앱 → `자동화`
2. `개인용 자동화 생성`
3. `도착할 때`
4. 위치: `Holzweg-passage 3, 61440 Oberursel`
5. 실행 단축어: `Studio Open`

### 출발 자동화

1. 단축어 앱 → `자동화`
2. `개인용 자동화 생성`
3. `떠날 때`
4. 위치: `Holzweg-passage 3, 61440 Oberursel`
5. 실행 단축어: `Studio Close`

## 5. 운영 메모

- `Studio Open`이 열리면 기존 영업시간 밖이어도 예약 슬롯이 추가로 열립니다.
- 실제 예약/개인 일정과 충돌하는 시간은 계속 막힙니다.
- `야외 / 웨딩 / 기업행사`는 추가 오픈 대상이 아닙니다.
- 픽업 일정은 같은 시간이어도 허용됩니다.
- 반영은 보통 `1~2분` 안쪽입니다.

## 6. 추천 운영 방식

- 잠깐 들를 때: 기본 `2시간`
- 더 길게 있을 때: `openUrl`의 `minutes=` 값을 `240`으로 바꿔 `4시간`
- 퇴근할 때는 `Studio Close` 자동화로 바로 닫기
