# 운영 로그 탭 (Operations Log Tab)

작성일: 2026-07-12 Europe/Berlin
대상: Apps Script 어드민 (`appscript/Code.gs`, `appscript/AdminV2.html`)

## 배경

이전 기획서(`studio-platform-master-plan.md`)의 "가장 먼저 할 일" #1: MessageLog/AutomationLog 추가.
조사 결과 **백엔드는 이미 완성되어 있었고, UI도 존재했지만 대시보드 아코디언에 최근 4건만 잘려서
숨겨져 있는 상태**였다 (`운영 점검, 로그, 진단` details, 기본 접힘).

기존 자산:
- `logMessage_` / `sendTrackedEmail_` — 이미 44곳 이상의 발신 메일 호출부에서 자동 기록 중
- `logAutomationRun_` / `runLoggedAutomation_` — `dailyTasks()`의 12개 예약 작업이 이미 기록 중
- `getOperationsLogAdmin` — 로그 조회 RPC (기존, 최근 20~30건만)
- `getOperationsChecklistAdmin` — 실시간 헬스체크 RPC (기존, 변경 없음)

## 변경 결과

### 신규 탭: "운영 로그" (`switchTab('logs')`, 견적서와 설정 사이)

**1) 자동화 상태보드** — `dailyTasks()`의 12개 작업을 고정 순서로 나열, 작업별 **최신 실행 1건**만 표시
(성공/실패/기록없음 배지, 마지막 실행 시각, 처리건수, 소요시간, 요약/오류).
"기록 없음"으로 뜨는 작업은 트리거가 아직 한 번도 안 돌았거나 이름이 바뀐 신호로 바로 알아챌 수 있음.

**2) 자동화 실행 이력** — 최근 실행 전체(최대 300건) 원본 테이블.

**3) 메일 발송 로그** — 최근 최대 300건을 불러와 클라이언트에서 검색/필터
(상태: 전체/성공만/실패만, 유형: 데이터에서 동적 추출, 자유 텍스트 검색: 수신자/제목/고객명/이메일).
"더 불러오기"로 조회 범위를 100건씩 확장(최대 300).

### 백엔드 (`Code.gs`)
- `_readLatestRowsByHeader_` 상한 100→300 (기존 호출부는 `limit||30`이라 동작 무변화)
- `AUTOMATION_JOB_NAMES_` — `dailyTasks()` 작업명 12개 상수 (표시 순서 고정)
- `getAutomationHealthAdmin(token, options)` — 작업별 최신 상태 보드 + 원본 이력
- `getMessageLogAdmin(token, options)` — 메일로그 원본 목록(필터는 프론트에서 처리)

### 프론트 (`AdminV2.html`)
- 탭 nav/`switchTab` 배열/content div 3곳에 `logs` 추가 (기존 14개 탭과 동일 패턴)
- 대시보드 위젯(`renderOpsLogPanel`)에 "전체 로그 보기" 버튼 추가 → 새 탭으로 이동
- `gotoOpsChecklistTarget('logs')`가 아코디언 스크롤 대신 새 탭으로 이동하도록 변경

## 알려진 제약 (의도된 단순화)

- 필터는 **서버에서 가져온 최근 N건(최대 300) 안에서만** 동작. 진짜 "전체 기간 실패만 검색"은 아님 —
  UI에 "최근 N건 중 필터링"이라고 명시. 소규모 스튜디오 운영 볼륨(하루 수~수십 통)에서는
  300건이면 수 주~수개월 커버 가능.
- **재발송(retry) 버튼은 넣지 않음.** 실패 원인/수신자가 로그에 남지만, 임의 이메일 재구성은
  중복발송 위험이 있어 스코프 제외. 예약별 기존 "재발송" 버튼(확정메일/셀렉링크 등)을 그대로 사용.

## 검증
- `Code.gs` 구문 검사 통과 (`node --check`)
- `AdminV2.html` 인라인 스크립트 전체 추출 후 구문 검사 통과
- 신규 탭 삽입 구간 div 태그 균형 확인
- 작업별 최신-상태 그룹핑 로직 단위 테스트(순수 함수 추출) 통과:
  중복 작업명 중 최신만 채택 / 실패 상태·오류 보존 / 기록 없는 작업 "기록 없음" 처리

## 배포
- `clasp push` (Code.gs, AdminV2.html) — 어드민 전용 변경이라 고객 프론트 영향 없음
- 배포 후 확인: 어드민 로그인 → "운영 로그" 탭 → 12개 작업 보드 표시 / 메일 로그 검색·필터 동작 확인
