# Codex Phase 8 Re-run Fact-Check — Input Brief (재시도 1회)

**Date**: 2026-05-22
**Cycle**: folder-picker-ux Phase 8 (docs cycle)
**Reviewer**: Codex CLI gpt-5.5 (재시도 1회 한)
**Trigger**: 첫 round verdict NEEDS-ATTENTION — HIGH 1 (Q1) + MEDIUM 2 (Q2/Q3) + LOW 2 (Q4/Q5). 3 결함 redraft 적용 후 재검증.

---

## Context

이전 라운드 verdict 요약:
- **Q1 HIGH overclaim**: "12+ cells" (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1 = 합 11, 12+ 아님) + "4 commits secret leak 0 hits" (3756e83은 docs-only — code chunks 0건)
- **Q2 MEDIUM (frontmatter)**: `source_link` 5 `../` → `/Users/Desktop/...` (broken, `dg-2412-pn-002/` 누락)
- **Q3 MEDIUM (body stale)**: ① `--young-coconut-soft` outline 인용 — 실제 코드는 `--young-coconut-dark` (`globals.css:2025-2026` 확인) / ② Reveal hint "Start from your home folder…" 인용 — 실제 production 카피는 "From your home folder (~), open .claude/projects or .codex/sessions. Reveal hidden folders with ⌘⇧.(period) on macOS or Ctrl+H on Linux." (`JoinBurnIndexForm.tsx:422-426` 확인)

각 결함에 대한 적용 fix는 다음 §Applied Fixes 참조.

---

## Applied Fixes (전수 적용 후 현재 상태)

### Fix A — Q1 HIGH (decision-log "강한 증거" + S10 "바꿀까" ①)

`docs/decision/decision-log.md:357` "강한 증거" 줄 변경 후 final:
> ... + Owner Happy Path 11 planned cells (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1) 중 Phase 6 7/7 owner-direct localhost ✅ 손글씨 기록 / Phase 7 #1·#4 production owner-notes evidence 컬럼 기록(marker 미flip) / Phase 7.5·7.5.6 owner 발화 "사이즈 괜찮음" verbal 확인 + code deploys 3건 (`6cda4c5`/`b94d362`/`40cd00c`) 각 build secret leak 0 hits 재확인 (`3756e83`은 docs-only commit — code chunks 변경 0건이라 secret leak 점검 대상 아님).

`docs/decision/decision-log.md:361` S10 "바꿀까" ① 변경 후 final:
> ① staging/preview 환경 owner self-test 사이클 신설(별 cycle 분리) — coconutlabs 인프라에 staging 부재라 본 사이클 흡수 불가. 별 사이클 brief에 ON-flip 게이트 추가·Vercel Preview deploy 활용·owner 직접 진입 절차 정의 후 v2 이후 모든 production 변경에 적용. ② Phase 6 manual cells 글로벌 템플릿(`~/.claude/rules/task-standards.md` "Owner Happy Path Cells" 후보 섹션)에 "microcopy 시인성"(kbd font-size·padding·line-height) + "WCAG AA contrast 실측" 의무 항목 추가… ③ DOMException dispatch 명세 불명확 시 AGENTS.md "WebKit/Blink API 사전 측정" 신규 anchor 추가…

### Fix B — Q2 MEDIUM (memory frontmatter source_link)

`~/.claude/projects/.../memory/project_folder-picker-ux-2026-05-22.md` 라인 10:
```yaml
source_link: ../../../../Desktop/Project/Coconut Labs/web/tasks/folder-picker-ux/criteria-execution-log.md
```

검증 명령 (방금 실행, 정상 resolve):
```
$ cd .../memory && ls -la "../../../../Desktop/Project/Coconut Labs/web/tasks/folder-picker-ux/criteria-execution-log.md"
-rw-r--r--  1 dg-2412-pn-002  staff  10598 May 22 11:43 ...
```

### Fix C — Q3 MEDIUM (memory 본문 stale 2건)

`project_folder-picker-ux-2026-05-22.md` 2-row Path Preview Card 섹션 변경 후 final:
- Hidden-folder `.`-prefix segment에 `--young-coconut-dark` outline emphasis (`globals.css:2025-2026` `.path-segment--hidden { outline: 1px solid var(--young-coconut-dark); }`)
- Reveal hint 1줄 (production final, `JoinBurnIndexForm.tsx:422-426`): `From your home folder (~), open .claude/projects or .codex/sessions. Reveal hidden folders with ⌘⇧.(period) on macOS or Ctrl+H on Linux.`

Cycle Commits Anchor 직후 caveat 신규:
> ⚠️ 본 메모리의 토큰명·hex 색상·변수명·commit hash는 2026-05-22 cycle 종료 시점 final state. 재사용 전 `source_link`(criteria-execution-log.md) + `app/globals.css` + `components/forms/JoinBurnIndexForm.tsx` 현행 일치 검증 의무. expiry 2026-08-20까지 90일 유효 가정.

---

## 재검증 의무 (Q1·Q2·Q3 한정)

**Q1 재검증**: decision-log "강한 증거" 줄 — overclaim 0건? "11 planned cells" + "Phase 7/7.5/7.5.6 evidence 상태 명시(owner-notes / verbal)" + "code deploys 3건 (docs-only 3756e83 분리)" 표현이 smoke-golden-regression.md 실제 기록과 일치하는지. S10 "바꿀까" ①도 행동 변화 가능한 별 사이클 액션으로 구체화됐는지.

**Q2 재검증**: memory frontmatter `source_link` 4-`../` 경로가 `/Users/dg-2412-pn-002/Desktop/...`로 정상 resolve하는지(위 ls 출력 참조). 다른 7필드(role/domain/expiry/owner/usage_count/last_validated) 누락 0건은 이미 첫 라운드 PASS — 재확인만.

**Q3 재검증**: ① outline 토큰 `--young-coconut-dark`가 `globals.css:2025-2026` 실제 코드와 일치 / ② Reveal hint copy가 `JoinBurnIndexForm.tsx:422-426` 실제 markup과 일치 / ③ "재사용 전 source_link 검증" caveat이 90일 expiry staleness 위험을 충분히 mitigate.

**Q4/Q5는 LOW** — 첫 라운드 verdict 그대로 유지하되 변경 사항 없으므로 별도 재검증 불필요. S10 "바꿀까" ① staging 항목이 별 cycle 분리로 구체화됐다는 점만 추가 인지.

---

## Verdict 형식 (재실행)

```
## Verdict (re-run): PASS / PARTIAL / NEEDS-ATTENTION

### Q1 재검증 [decision-log overclaim 해소]
- 잔존 결함 severity: NONE / NIT / LOW / MEDIUM / HIGH
- 근거: ...

### Q2 재검증 [memory source_link]
- 잔존 결함 severity: NONE / NIT / LOW / MEDIUM / HIGH
- 근거: ...

### Q3 재검증 [memory 본문 staleness]
- 잔존 결함 severity: NONE / NIT / LOW / MEDIUM / HIGH
- 근거: ...

## Phase 8 진입 결정
- 재시도 1회 한도 소진. 이번 verdict로 Phase 8.4 진입 / 부분 완료 / 부분 회귀 결정.
```

통과 기준: HIGH/MEDIUM 결함 0건 또는 nit-only → 8.4 진입.
재시도 한도 1회 소진 — 본 verdict로 최종 판정.
