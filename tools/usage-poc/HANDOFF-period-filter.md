# 핸드오프 — collector `--period` 캘린더 기간 필터

> 생성: 2026-05-19 KST | 상태: 구현 완료, 검증 통과, 커밋됨
> 계획서: `~/.claude/plans/modular-bubbling-ember.md`

## 무엇을 했나

collector에 `--period` 옵션을 추가했다. 로컬 CLI 세션 로그를 **세션 시작
시각**(첫 줄 ISO-8601)으로 캘린더 윈도우에 귀속시켜 기간별 Burn Summary를
만든다. 주간 리더보드가 "이번 주 누가 제일 많이 썼나"를 가릴 수 있게 됐다.

- 기간: `day` / `week` / `month` / `year` / `all` (기본 `week`)
- 윈도우: **캘린더 버킷** (롤링 아님) — 모두가 같은 구간으로 비교돼야 공정
- 타임존: **UTC** 단일 기준 (글로벌 대회)
- 구간: 닫힘-열림 `[since, until)` — 경계 세션 이중 집계 방지

## 변경 파일 (4개, schemaVersion v1→v2)

| 파일 | 변경 |
|------|------|
| `coconut_collector/collect.py` | 윈도우 헬퍼 3종(`_parse_instant`/`_calendar_window`/`_in_window`), `collect()`·`build_envelope()`에 `period` 관통, envelope에 `periodWindow` 추가, 빈 결과 `ValueError`, `generatedAt` 정규화 |
| `coconut_collector/__main__.py` | raw argv → `argparse`, `--period` choices |
| `burn-summary.schema.json` | v2 bump, `periodWindow` 필드 추가. 행(row) 9-필드 계약은 불변 |
| `tests/test_collector.py` | 기간 필터 신규 테스트 8종 + 기존 테스트 `period` 명시 보정 |

## 검증 결과

- `pytest tests/ -q` → **15 passed**
- `python -m coconut_collector --json` → `schemaVersion 2`, `periodWindow.period: week`
- `--period all` → `since`/`until` `null`, `--period bogus` → argparse exit 2
- 빈 윈도우 → stderr 안내 + exit 1 (스택트레이스 없음)
- jsonschema v2 검증 통과, `estimate_cost.py --all` 영향 없음 확인
- **Codex(gpt-5.5) 교차 리뷰**: 핵심 로직(캘린더 산술·경계·보안 무누출) 정상.
  판정 SHIP-WITH-NITS — nit 3건 중 #2 수정 완료, #1·#3은 plan "알려진 한계"에 문서화.

## 보안 계약 (불변 — 위반 시 롤백)

행(row)은 9개 익명 필드만. raw prompt/response/source/원본 경로/repo명/secret
절대 미포함. `periodWindow`는 `period` + ISO 타임스탬프 2개만 추가. project
slug은 `project_hash()` 입력으로만 쓰이고 emit 안 됨. salt는 device-local.

## 알려진 한계 (수용)

- **세션-시작 귀속**: 세션 전체가 첫 줄 시각의 윈도우에 계상. `day`에선 편향
  유의미, `week` 이상은 경미. 정밀 공정성 필요 시 줄 단위 usage 파싱이 후속 과제.
- **`_utc_day` 비정규화** (Codex nit #1): `timestampBucket`은 날짜 접두사
  정규식, 윈도우 필터는 offset-aware 파싱 — 비-`Z` 로그에서 버킷 불일치. 실제
  로그는 항상 `Z`라 latent.
- **스키마 조건부 미강제** (Codex nit #3): `since/until` null은 `all`일 때만
  emit하지만 스키마가 강제 안 함. 코드가 위반 envelope를 안 만들어 PoC 수용.

## 다음 작업 후보

1. 리더보드 백엔드가 `schemaVersion "2"` + `periodWindow` 소비하도록 연동
2. envelope 업로드 경로(consented upload) — onboarding은 `npx coconutlabs`
   one-command 방향 (Codex 2차 의견: seamless OAuth account linking은 불가)
3. nit #1 해소: `_utc_day`를 `_parse_instant` 기반으로 교체 (비-`Z` 로그 관측 시)
