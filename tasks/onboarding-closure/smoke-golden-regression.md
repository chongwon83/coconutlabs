# Smoke Golden Regression — coconut-collector

## 실행 기록 (owner 직접 실행)

**날짜**: 2026-05-21  
**환경**: macOS, 새 venv (`/tmp/coconut-smoke-venv`), Python 3.x  
**명령**: `pip install -e . -q` → `coconut-collector --help` → `coconut-collector ~/` → `--json`

---

**결과 1줄 (owner 기록)**:
```
2026-05-21 | pip install -e . → coconut-collector ~/ | 28 rows, 1,692,162,090 tokens, $1872.4054 | 정상 종료 0
```

---

## 항목별 체크

- [x] `pip install -e .` 에러 없음
- [x] `coconut-collector --help` exit 0, PATH/period 옵션 표시
- [x] `coconut-collector ~/` 정상 실행, schemaVersion 2, 28개 row 출력
- [x] `--json` envelope JSON 구조 정상 (schemaVersion/rows/grandTotal)
- [x] claude-code + codex 양쪽 로그 인식
- [x] Device-synced verification level 표시

## 관찰 사항

- `gpt-5-codex`, `gpt-5.5`, `o4-mini` 모두 인식됨 (Device-synced)
- week 기간: 28 rows / all 기간: row 수 더 많음 (--json head -30으로 첫 row만 확인)
- 총 소비: 1.69B tokens / $1,872 (주간 기준)
