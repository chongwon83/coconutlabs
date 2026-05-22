# Unverified Items — onboarding-closure

## 미검증 항목 + 차후 액션

| # | 항목 | 상태 | 차후 액션 |
|---|------|------|-----------|
| 1 | Phase 3: 30초 업로드 흐름 측정 | ❌ 미완 | `e2e/onboarding-30s.spec.ts` 작성 + 5회 측정 |
| 2 | Phase 5: CLI demo GIF/asciinema | ❌ 미완 | owner 결정: asciinema 또는 정적 스크린샷 3컷 |
| 3 | PyPI 실제 게시 (`twine upload`) | ❌ 범위 밖 | owner 별도 확인 후 수동 실행 |
| 4 | `find_logs()` invalid tool name silent fallback | ⚠️ 미수정 | 내부 함수라 위험 낮음; 명시 assert 추가 검토 가능 |
| 5 | axis1-recruitment-strategy.md 체크박스 업데이트 | ❌ 미완 | Phase 3+5 완료 후 close |
| 6 | smoke-golden-regression.md | ❌ owner 기록 필요 | owner가 새 venv에서 직접 실행 후 손기록 |

## Planner contract/criteria spot check

Planner spot check: contract/criteria 섹션에 코드 스니펫·diff·라인 단위 지시 ✅ 없음

## /codex cross-review 불일치 주석

- Codex CRITICAL #1 (model-pricing.json 미포함): **false positive** — hatchling dry-run으로 반증. `packages=["coconut_collector"]`는 비Python 파일 자동 포함.
- Claude Code disagrees: hatchling이 packages 목록 디렉토리의 모든 파일을 포함하므로 `artifacts` 명시 불필요.
