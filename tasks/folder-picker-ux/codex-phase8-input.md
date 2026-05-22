# Codex Phase 8 Pre-Commit Fact-Check — Input Brief

**Date**: 2026-05-22
**Cycle**: folder-picker-ux Phase 8 (docs cycle)
**Reviewer**: Codex CLI gpt-5.5 (adversarial cross-model)

---

## Context

Phase 7.5.6 closure (commit `40cd00c`, owner production self-test "사이즈 괜찮음") 후 Phase 8 docs cycle 진입. 8.1A (3 기존 산출물 갱신) + 8.1B (3 신규 산출물 작성) + 8.2 (Finding 1 별 사이클 brief) 완료. 본 Phase 8.3은 **commit 전 fact-check** — 신규 산출물의 사실 정확성·overclaim 위험·frontmatter 준수·회고 패턴·invariant 정의를 적대적 검토.

## 입력 파일 (6종, 우선순위)

1. **신규 decision-log 엔트리** — `docs/decision/decision-log.md` 최하단 "2026-05-22 [Folder picker UX — Approach B...]" 블록 (5줄 + S10 회고 2줄)
2. **신규 memory file** — `~/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md` (frontmatter + 본문 ~70줄)
3. **갱신 memory file** — 동 디렉터리 `project_auto-detect-flip-procedure.md` 최하단 "UX iteration 1 (2026-05-22)..." 1줄 + MEMORY.md 인덱스 1행
4. **Finding 1 별 사이클 brief** — `tasks/folder-picker-ux-finding1/plan-brief.md` (전체)
5. **Cycle 4 commits git log** — 확인 명령: `git log --oneline 6cda4c5..40cd00c -- 'components/forms/JoinBurnIndexForm.tsx' 'app/globals.css'`
6. **B3 5종 산출물 final state** — `tasks/folder-picker-ux/` 안 criteria.md / criteria-execution-log.md / diff.md / unverified.md / smoke-golden-regression.md

---

## Codex Challenge Q1~Q5 (의무 응답)

### Q1. decision-log "강한 증거" 줄 — overclaim/누락 검증

본 cycle decision-log entry "강한 증거" 줄은 다음을 주장:
- "3 Codex 적대적 라운드 (Phase 1/6/7.5) 모두 의미 있는 결함 발견"
- "Owner Happy Path 12+ cells (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1) 직접 기록"
- "4 commits production deploy (`6cda4c5`/`b94d362`/`3756e83`/`40cd00c`) 각 build secret leak 0 hits"

**검증**:
- `tasks/folder-picker-ux/codex-phase{1,6,7}.md` 실제 verdict가 "needs-attention" 또는 "PARTIAL"인지, 본 entry가 "PASS"로 표현하지 않았는지
- `tasks/folder-picker-ux/smoke-golden-regression.md` 실제 owner-direct 손글씨 cells 카운트가 정확히 12+ 인지 (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1 합산 = 11)
- 11 cells면 entry 수정 의무 (12+ → 11+ 또는 정확 카운트). 12+면 추가 cells 누락 인용

### Q2. Memory 신규 frontmatter — C2 7필드 + expiry/source_link 적정성

신규 memory `project_folder-picker-ux-2026-05-22.md` frontmatter:
```yaml
name / description / metadata.type / role / domain / expiry / owner / source_link / usage_count / last_validated
```
- 7필드 누락 0건인가? (`role` / `domain` / `expiry` / `owner` / `source_link` / `usage_count` / `last_validated`)
- `expiry: 2026-08-20` (작성일 +90일) 적정성 — UX 패턴 메모리는 90일 만료 적절한가 vs 180일+ 필요한가?
- `source_link: ../../../../../Desktop/Project/Coconut Labs/web/tasks/folder-picker-ux/criteria-execution-log.md` — owner 가족 자산 등 시크릿 노출 위험 0건? 상대 경로가 retrieval 시 깨지지 않는가?
- 본 cycle은 동시에 갱신한 `project_auto-detect-flip-procedure.md` frontmatter가 **다른 패턴** (`metadata.node_type: memory` + `metadata.type: project`만, role/domain/expiry 등 없음) — 신규 memory와 기존 memory 사이 frontmatter 불일치가 owner 검색·만료 정책에서 문제 일으키는가?

### Q3. Memory 본문 — retrieval-friendly vs regurgitation/staleness

신규 memory `project_folder-picker-ux-2026-05-22.md` 본문은:
- 4 error.name 분기 표 (코드 스니펫 인용 0건, 패턴만)
- 2-row Path Preview Card 사양 (token 이름 인용: `--young-coconut-soft` `--font-mono` `--font-ui` `--fg` `--fg3` `--surface-muted` `--border`)
- count-based AbortError pivot 사양 (useRef 변수명 `abortCountRef` 인용)
- kbd 시인성 사양 (15px / 2px 8px / 0.5px / 1.4 / aria-hidden 라벨 — 구체 숫자 다수)
- WCAG AA contrast 값 인용 (`#0A0A0A` on `#FAFAFA` = 18.97:1, `#525252` on `#FFFFFF` = 7.81:1)
- 4 commit hash 인용 (`6cda4c5`/`b94d362`/`3756e83`/`40cd00c`)

Builder Josh "사실/패턴/결정만 등록" 원칙 부합 여부 — 코드 라인 단위 인용은 0건이나 **구체 토큰명·변수명·hex 색상·commit hash**가 다량. staleness 위험(향후 token rename / variable refactor / commit history rewrite)이 retrieval 가치 압도하지 않는가?

### Q4. Finding 1 plan-brief — 위험 3축 + Invariant #6 정의

`tasks/folder-picker-ux-finding1/plan-brief.md`:
- 위험 3축 평가 = 2/3 충족 (① 실패비용 충족 / ② 영향범위 충족 / ③ 관찰가능성 부분) → "/codex 교차 리뷰 강력 권장" 명시
- Invariant #6 신규: "Close 후 재오픈 0건 — 동일 세션 내 사용자가 close 클릭하면 query param 그대로여도 modal 재오픈 0건"
- `userClosedRef.current = true` latch 패턴 — **페이지 reload 시 reset됨을 brief에 명시**

**검증**:
- 위험 3축 평가 타당성 — ② 영향범위가 "1 module + production landing route + 모든 진입자"인 것이 충족 기준에 맞는가? task-standards.md "3+ 모듈 OR 영속 데이터 OR 배포 경로 영향" 기준 — landing route 1개라도 모든 사용자 진입점이라 충족 처리한 것이 타당한가, 아니면 1 module이라 미충족인가?
- Invariant #6 실측 가능한가 — Playwright e2e로 구현 가능한 사양인지, 또는 owner manual cell로만 가능한지
- `userClosedRef` reload reset 명시가 별 plan v1 의무 사항으로 표시됨 — 이것이 충분한가, 아니면 brief 단계에서 sessionStorage 대안 명시 의무인가?

### Q5. S10 회고 — 추상 vs 구체 액션

decision-log [S10 회고] 2줄:
- **잘 됐나**: "ON-flip → owner self-test → 3 Finding 발견 → 단일 patch 사이클(Phase 7.5 + 7.5.6)로 2건 흡수, Finding 1만 별 사이클 이관. Codex 3 라운드(Phase 1/6/7.5) 모두 사각지대 검출"
- **바꿀까**: "① ON-flip 전 staging 환경 owner self-test 단계 추가 ② Phase 6 manual cells에 'microcopy 시인성'(kbd font-size 11px이 실사용 가독한가) 명시 항목 추가 ③ DOMException dispatch 명세 불명확 시 사전 console 패치(window.showDirectoryPicker wrapper)로 e.name 실측 후 분기 설계"

**검증**:
- "잘 됐나"가 단순 과정 나열이 아니라 **재현 가능한 패턴**으로 추출됐는가 (cycle pattern → 다음 cycle에 적용 가능한 형태인가)
- "바꿀까" 3개 항목이 각각 **행동 변화 trigger 가능**한 구체 액션인가 — ① staging 환경이 현재 coconutlabs 인프라에 존재하지 않으면 staging 설정 자체가 별 cycle. ② Phase 6 manual cells 템플릿이 어디에 있는지(예: 본 cycle smoke-golden-regression.md 또는 글로벌 rule 파일) 명시되지 않음. ③ console 패치 패턴이 다음 DOMException 작업에서 자동 적용되는 메커니즘(예: AGENTS.md 또는 글로벌 rule에 anchor) 부재
- 어느 항목이 가장 추상적이고 다음 retro에서 follow-up 필요한가?

---

## Verdict 형식

다음 형식으로 응답 의무:

```
## Verdict: PASS / PARTIAL / NEEDS-ATTENTION

### Q1 [decision-log 강한 증거]
- CONCERN: ...
- MITIGATION: ...

### Q2 [memory frontmatter]
- CONCERN: ...
- MITIGATION: ...

### Q3 [memory 본문 retrieval]
- CONCERN: ...
- MITIGATION: ...

### Q4 [Finding 1 brief 위험 3축 + Invariant #6]
- CONCERN: ...
- MITIGATION: ...

### Q5 [S10 회고 추상도]
- CONCERN: ...
- MITIGATION: ...

## Phase 8 통과 기준
- HIGH/MEDIUM 결함 0건 또는 nit-only → 8.4 진입
- HIGH/MEDIUM ≥ 1건 → draft 재작성 후 재실행 (재시도 1회 한)
```

각 Q마다 결함 severity (HIGH / MEDIUM / LOW / NIT) 명시 의무.
