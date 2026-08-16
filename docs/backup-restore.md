# 백업 · 복구 런북

Updated: 2026-08-14 Europe/Berlin
Status: **검증 완료** — `backup-verify` 액션 신설(@770~@772), 일일 브리핑에 연결

## 현재 구성

| 항목 | 값 |
|---|---|
| 백업 주체 | `backupSpreadsheetDaily_()` — 일일 트리거, 스프레드시트 전체를 Drive 로 복사 |
| 저장 위치 | Drive 폴더 `Studio mean DB Backups` (스크립트 속성 `BACKUP_FOLDER_ID`) |
| 파일명 | `StudioMeanDB_YYYY-MM-DD` (같은 날 재실행하면 건너뜀 — 멱등) |
| 보관 | 30일 (`BACKUP_RETENTION_DAYS`), 초과분 자동 휴지통 이동 |
| 실패 시 | 사장님께 "⚠️ 일일 DB 백업 실패" 메일 |

## 2026-08-14 복구 리허설 결과 — 이상 없음

**백업이 매일 만들어지는 것만 확인하고 한 번도 열어본 적이 없었다.** 검증하지 않은 백업은 백업이 아니므로 실제로 열어 대조했다.

- 백업 31개 보관, 최신 `StudioMeanDB_2026-08-14` (당일 08:04 생성) — **열기 성공**
- 시트 12종 행수 대조 전부 일치 (사진셀렉만 −1행: 백업 이후 추가된 세션, 정상)
- **값 단위 대조**: 예약장부 243행 `Seo hee Park / 30` — 백업·라이브 동일

```bash
cd "/Users/taewoongmin/Desktop/Studio_mean/스튜디오자료/website/reservation" && node scripts/erp-agent.mjs backup-verify --json '{}'
```

이 검증은 **일일 브리핑에 연결**되어 있다. 문제가 있을 때만 `backupHealth` 가 실린다(정상이면 조용). 백업은 조용히 멈추는 게 최악이라, 사람이 기억해서 돌리는 구조로 두지 않았다.

## 복구 절차

1. Drive `Studio mean DB Backups` 에서 복구할 날짜의 `StudioMeanDB_YYYY-MM-DD` 를 찾는다.
2. **그 파일을 복사**한다(원본 백업은 보존 — 복구 중 망가뜨리면 되돌릴 게 없다).
3. Apps Script 편집기 → 프로젝트 설정 → 스크립트 속성 → **`DB_SHEET_ID` 를 복사본 ID 로 교체**.
4. `ensureSheets_` 는 10분 캐시가 있으므로 즉시 반영이 필요하면 아무 액션이나 한 번 호출해 캐시를 밀어낸다.
5. **라이브 원본 스프레드시트는 지우지 않는다.** 복구 후 대조가 필요하고, 잘못된 복구를 되돌릴 유일한 수단이다.

> `DB_SHEET_ID` 만 바꾸면 되는 구조라 복구 자체는 단순하다. 위험한 지점은 3번이 아니라 **2번을 건너뛰는 것** — 백업 파일을 직접 라이브로 쓰면 그 백업이 그날부터 오염된다.

## 검증에서 잡아내는 것

| 신호 | 의미 |
|---|---|
| 백업 0개 | 일일 트리거가 죽었다 |
| 최신 백업 2일 이상 전 | 백업이 멈췄다 |
| 백업 열기 실패 | 그 시점에 이미 복구 불가 |
| 시트 행수 10% 이상 부족 | 부분 복사 — 못 쓰는 백업 |
| 마지막 행 값 불일치 / 고객명 공란 | 행수만 맞는 빈 껍데기 백업 |

## 남은 약점 (2026-08-16 갱신)

- ~~백업이 같은 Google 계정 Drive 안에만 있다~~ → **오프사이트(로컬) 백업 신설 (@784)**:
  `backup-export` 액션이 핵심 시트 12종을 CSV 로 내보내고, launchd `com.studiomean.erp-backup` 이
  **매주 일요일 09:30** `~/Desktop/Studio_mean/백업/erp/YYYY-MM-DD/` 에 저장(최근 10개 스냅샷 보존).
  수동 실행: `/bin/zsh ~/Desktop/Studio_mean/automation/erp_local_backup.zsh` ·
  로그: `automation/logs/erp_backup_YYYYMM.log`. 첫 실행 2026-08-16: 12시트 1,015행 ~800KB.
  로컬 디스크가 다시 맥 한 대에 있으므로, 맥 자체의 Time Machine/클라우드 백업이 2차 방어선이다.
- Apps Script 코드 자체는 git(`studiomeande-bit/booking`)에 있으나, **스크립트 속성**(자동화 키·ACTION_SECRET·
  APPLE 자격증명·`DB_SHEET_ID`·폴더 ID)은 어디에도 백업되지 않는다(비밀값이라 CSV 백업에도 **의도적으로 미포함**).
  계정 복구 시 수동 재설정 필요 — 재발급 절차는 각 서비스(어드민 설정, Apple ID 앱 암호)에서.
