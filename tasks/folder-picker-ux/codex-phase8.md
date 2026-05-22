Reading prompt from stdin...
OpenAI Codex v0.128.0 (research preview)
--------
workdir: /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR, /Users/dg-2412-pn-002/.codex/memories]
reasoning effort: none
reasoning summaries: none
session id: 019e4d9b-ff84-75b2-ad76-50ac934af73a
--------
user
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

codex
I’ll verify the cited artifacts against the repo state and the memory files directly, then return the requested verdict format with severity per question. First I’m locating the relevant standards and reading the claimed evidence files rather than relying on the brief text.
exec
/bin/zsh -lc "pwd && rg --files | rg '("'^docs/decision/decision-log.md$|''^tasks/folder-picker-ux/|''^tasks/folder-picker-ux-finding1/plan-brief.md$|task-standards'"\\.md"'$)'"'" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
tasks/folder-picker-ux-finding1/plan-brief.md
docs/decision/decision-log.md
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md
tasks/folder-picker-ux/preflight-localhost-verification.md
tasks/folder-picker-ux/smoke-golden-regression.md
tasks/folder-picker-ux/criteria.md
tasks/folder-picker-ux/unverified.md
tasks/folder-picker-ux/codex-phase8-input.md
tasks/folder-picker-ux/preflight-phase6-simulated.md
tasks/folder-picker-ux/plan-v2-delta.md
tasks/folder-picker-ux/codex-phase1.5-history-cleanup.md
tasks/folder-picker-ux/codex-phase1.md
tasks/folder-picker-ux/codex-phase7-findings.md
tasks/folder-picker-ux/codex-phase6.md
tasks/folder-picker-ux/codex-phase7.md
tasks/folder-picker-ux/codex-phase8.md
tasks/folder-picker-ux/notes-used.txt
tasks/folder-picker-ux/phase7-auxiliary-verification.md
tasks/folder-picker-ux/criteria-execution-log.md
tasks/folder-picker-ux/diff.md
tasks/folder-picker-ux/design-review-phase3.md

exec
/bin/zsh -lc 'ls -la ~/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs' in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
exec
/bin/zsh -lc 'git status --short' in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
 M .gitignore
 M docs/decision/decision-log.md
 M tasks/folder-picker-ux/criteria-execution-log.md
 M tasks/folder-picker-ux/diff.md
 M tasks/folder-picker-ux/smoke-golden-regression.md
 M tasks/folder-picker-ux/unverified.md
 M tasks/production-rollout-gate/branch-protection-setup.md
 M tasks/production-rollout-gate/criteria-execution-log.md
 M tasks/production-rollout-gate/notes-used.txt
 M tasks/production-rollout-gate/smoke-golden-regression.md
 M tasks/production-rollout-gate/status-2026-05-21.md
 M tasks/production-rollout-gate/unverified.md
 M tools/usage-poc/coconut_collector/__main__.py
 M tools/usage-poc/coconut_collector/collect.py
 M tools/usage-poc/coconut_collector/parsers.py
 M tools/usage-poc/tests/test_collector.py
?? .harness/
?? docs/plans/next-cycle-hygiene-and-e2e.md
?? docs/plans/oconut-collector-linear-dewdrop/
?? e2e/onboarding-30s.spec.ts
?? public/coconut-collector-cli-demo.cast
?? public/coconut-collector-cli-demo.svg
?? tasks/folder-picker-ux-finding1/
?? tasks/folder-picker-ux/codex-phase8-input.md
?? tasks/folder-picker-ux/codex-phase8.md
?? tasks/onboarding-closure/
?? tasks/production-rollout-gate/baseline-pre-flip-20260521T1007Z.json
?? tasks/production-rollout-gate/baseline-pre-flip-20260521T1009Z.json
?? tasks/production-rollout-gate/monitor-T+initial.json
?? tasks/production-rollout-gate/on-flip-2026-05-21.md
?? tools/usage-poc/README.md
?? tools/usage-poc/coconut_collector/model-pricing.json
?? tools/usage-poc/dist/
?? tools/usage-poc/pyproject.toml

 succeeded in 0ms:
total 252432
drwxr-xr-x  37 dg-2412-pn-002  staff      1184 May 21 21:45 .
drwx------@ 60 dg-2412-pn-002  staff      1920 May 20 10:34 ..
-rw-------   1 dg-2412-pn-002  staff     98743 May 21 21:54 012172c0-4350-4804-ae09-6bd57e6f3d80.jsonl
drwxr-xr-x   3 dg-2412-pn-002  staff        96 May 21 17:12 03c1872d-d5c8-44f2-89eb-c6d215e6b7d1
-rw-------   1 dg-2412-pn-002  staff    761081 May 21 17:25 03c1872d-d5c8-44f2-89eb-c6d215e6b7d1.jsonl
drwxr-xr-x   3 dg-2412-pn-002  staff        96 May 21 11:00 066340a4-9965-45b4-a158-13a88e10bb89
-rw-------   1 dg-2412-pn-002  staff   3169000 May 21 14:23 066340a4-9965-45b4-a158-13a88e10bb89.jsonl
drwxr-xr-x   3 dg-2412-pn-002  staff        96 May 21 15:01 0b0e2560-4eca-41fc-8c04-73203c74d638
-rw-------   1 dg-2412-pn-002  staff    553666 May 21 15:28 0b0e2560-4eca-41fc-8c04-73203c74d638.jsonl
drwxr-xr-x   4 dg-2412-pn-002  staff       128 May 20 18:17 1c0ab165-8846-4eb0-8dc0-9e065c1dc6b0
-rw-------   1 dg-2412-pn-002  staff   8456371 May 20 21:53 1c0ab165-8846-4eb0-8dc0-9e065c1dc6b0.jsonl
-rw-------   1 dg-2412-pn-002  staff     15397 May 21 10:56 2977dc1f-b261-4694-a091-f717143ae136.jsonl
-rw-------   1 dg-2412-pn-002  staff   1212176 May 20 23:29 394344e1-97f8-4e48-9c07-d7658e11fcb2.jsonl
drwxr-xr-x   4 dg-2412-pn-002  staff       128 May 18 21:07 406b1b21-e9e0-46ff-a09d-594a9f214b18
-rw-------   1 dg-2412-pn-002  staff   8429000 May 19 00:03 406b1b21-e9e0-46ff-a09d-594a9f214b18.jsonl
drwxr-xr-x   4 dg-2412-pn-002  staff       128 May 21 18:23 45e9b6a6-f526-4600-ad67-0dff8d8f45b9
-rw-------   1 dg-2412-pn-002  staff  28000125 May 22 11:55 45e9b6a6-f526-4600-ad67-0dff8d8f45b9.jsonl
-rw-------   1 dg-2412-pn-002  staff    682736 May 21 15:00 61925ff7-75f2-42b2-93e4-27a415bb967d.jsonl
drwxr-xr-x   3 dg-2412-pn-002  staff        96 May 21 07:56 6759c955-d16d-455a-afc5-e7ce859dfec0
-rw-------   1 dg-2412-pn-002  staff   4510005 May 21 10:58 6759c955-d16d-455a-afc5-e7ce859dfec0.jsonl
-rw-------   1 dg-2412-pn-002  staff     33081 May 21 14:24 69ae43cf-25a9-4d68-a93c-1654109a166b.jsonl
drwxr-xr-x   3 dg-2412-pn-002  staff        96 May 20 21:56 8a375340-e2ba-4e9d-bae6-ee51a3132da6
-rw-------   1 dg-2412-pn-002  staff   5123484 May 20 23:07 8a375340-e2ba-4e9d-bae6-ee51a3132da6.jsonl
drwxr-xr-x   3 dg-2412-pn-002  staff        96 May 18 21:02 9b6d177d-1b69-485e-afe8-3145d4d83c9a
-rw-------   1 dg-2412-pn-002  staff    102205 May 19 11:11 9b6d177d-1b69-485e-afe8-3145d4d83c9a.jsonl
drwxr-xr-x   4 dg-2412-pn-002  staff       128 May 19 18:05 a00c588e-d07c-49e4-9949-190f12eef495
-rw-------   1 dg-2412-pn-002  staff  60233838 May 20 17:37 a00c588e-d07c-49e4-9949-190f12eef495.jsonl
-rw-------   1 dg-2412-pn-002  staff    130181 May 21 14:29 b4a9f15d-f835-44fd-a8d3-2e79e1bc2ba0.jsonl
drwxr-xr-x   3 dg-2412-pn-002  staff        96 May 19 00:13 c4c48c7e-3134-4bce-9413-964be19601ba
-rw-------   1 dg-2412-pn-002  staff   4569612 May 19 10:09 c4c48c7e-3134-4bce-9413-964be19601ba.jsonl
drwxr-xr-x   3 dg-2412-pn-002  staff        96 May 21 14:40 cac2daff-0f87-45dd-b79a-7b82fa847aad
-rw-------   1 dg-2412-pn-002  staff    233647 May 21 14:43 cac2daff-0f87-45dd-b79a-7b82fa847aad.jsonl
drwxr-xr-x   3 dg-2412-pn-002  staff        96 May 21 16:15 db6d3007-a53a-456a-9171-850eefb35d73
-rw-------   1 dg-2412-pn-002  staff   2003128 May 21 16:47 db6d3007-a53a-456a-9171-850eefb35d73.jsonl
-rw-------   1 dg-2412-pn-002  staff     17348 May 21 14:32 e8fde9fd-8c1d-4d09-bf20-4c6be70f10b0.jsonl
-rw-------   1 dg-2412-pn-002  staff     31056 May 21 14:25 fb330858-b8df-4981-b29f-4ad96c64653b.jsonl
drwxr-xr-x   6 dg-2412-pn-002  staff       192 May 22 11:49 memory

codex
The worktree is already dirty with unrelated files, so I’ll keep this as a read-only fact-check. I found the memory files under the project’s `.claude/.../memory` subdirectory and will compare the claims against both the task artifacts and git history.
exec
/bin/zsh -lc 'ls -la ~/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory' in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
exec
/bin/zsh -lc 'tail -n 120 docs/decision/decision-log.md' in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
total 40
drwxr-xr-x   6 dg-2412-pn-002  staff   192 May 22 11:49 .
drwxr-xr-x  37 dg-2412-pn-002  staff  1184 May 21 21:45 ..
-rw-r--r--   1 dg-2412-pn-002  staff   626 May 22 11:49 MEMORY.md
-rw-r--r--   1 dg-2412-pn-002  staff   644 May 20 21:30 feedback_coconutlabs-solo-no-review-request.md
-rw-r--r--   1 dg-2412-pn-002  staff  1803 May 22 11:49 project_auto-detect-flip-procedure.md
-rw-r--r--   1 dg-2412-pn-002  staff  4915 May 22 11:49 project_folder-picker-ux-2026-05-22.md

 succeeded in 0ms:
  (Axis 6·7 추가)를 사전에 잡아냄 — 구현 전 설계 검증이 실제 결함을 차단했다.
  parity-test/security-test CI 2종이 경로 버그 수정 후 바로 그린.
- 다음엔 무엇을 바꿀까: 워크플로우 경로(`web/` 접두사) 버그는 git root 확인 체크를
  plan 단계에 명시하면 방지 가능. GitHub Free 플랜의 branch protection 미지원은
  저장소 공개 또는 Pro 업그레이드 전까지 수동 주의로 대체.

---

### 2026-05-20 F5/F6/F7 Python PoC 하드닝 (parsers.py HIGH 3건 해소)

- 문제: 7차 Codex 감사(`feat/burn-import-fsa`)에서 Python PoC `parsers.py`에
  HIGH 3건 검출. F5 — `SessionParse.project_slug`가 raw path-slug를 필드로
  노출(미래 caller가 실수로 emit 가능). F6 — `_as_int` 상한 없어 browser TS
  `Number.MAX_SAFE_INTEGER`(2^53-1)과 cross-runtime 불일치 가능. F7 —
  `(payload.get("info") or {}).get(...)` 패턴이 truthy 비-dict에서 AttributeError.
- 버린 대안: F5 — dataclass는 그대로 두고 "slug를 절대 emit하지 말라"는 주석만 추가.
  →미래 caller 실수를 차단 불가, defense-in-depth 위반.
- 핵심 트레이드오프: Option A(해시 인라인)는 parse_* 시그니처에 salt 추가가 필요
  → 모든 caller(collect.py·estimate_cost.py·test) 변경. 하지만 raw slug이 dataclass에
  존재하지 않으면 어떤 caller도 실수로 emit할 경로가 사라짐.
- 선택 이유: /codex consult 18개 개선점 반영 후 Option A 확정. F6 상한은 브라우저
  TS의 `Number.MAX_SAFE_INTEGER`와 동기화(2^53-1). F7은 `isinstance(info, dict)`로
  명시 교체. production 경로(브라우저 TS)는 무영향.
- 강한 증거: 19 pytest 그린 (기존 14 + 신규 5종). CLI smoke — 27행 envelope에
  `projectHash` 정상 출력, 홈 경로 누출 0건. `project_slug` grep 결과 =
  hashing.py 함수 파라미터만 잔존 (parsers·collect·estimate_cost 0건).

- 무엇이 잘 됐나: /codex consult가 plan의 결함(test 3개 파괴, estimate_cost.py
  에서 salt 로드 위치 오류 등)을 구현 전에 잡아냄 — 리뷰 분리 원칙이 또 실효.
  PR branch protection이 바로 작동해서 feature branch → PR 흐름이 정상 확인됨.
- 다음엔 무엇을 바꿀까: HIGH 결함이 deferred로 분류되면 plan 파일에 "다음 가용 sprint
  진입 조건"을 명시해서 자연스럽게 소환되게 하자. 이번은 수동 백로그 확인으로만 재발굴.

### 2026-05-21 [Burn-Import 사이클 종료 — /retro 회고]

- 무엇이 잘 됐나: F8/F9 프로덕션 12/12 PASS 확인 → 코덱스 교차 리뷰가 owner 솔로 검토 누락 2건(store-contract-check totalTokens, 미사용 test:coverage 스크립트) 잡아냄. 위험 3축 트리거 룰이 실제로 작동.
- 다음엔 무엇을 바꿀까: PR #1(4,642 LOC) 같은 빅뱅 PR은 토크나이저/픽커/와이어업 3개로 분리. 테스트 비중 11.2%는 인프라 위주라 발생한 결과 — 다음 사이클은 FSA 픽커 플로우 Playwright UI 테스트 추가로 ratio ≥ 20% 목표.

---

### 2026-05-21 coconut-collector 온보딩 closure (Axis 1 캠페인 진입 게이트)

- 문제: Axis 1 모집(15 distinct project_hash) 캠페인 시작 전 "공유 전 필수" 체크리스트
  4항목이 미완. 가장 큰 blocker는 `pip install coconut-collector`가 PyPI에 없음 →
  공유 시 "한 줄 설치"가 동작 자체를 안 함. 나머지 3항목도 미측정/미검증 상태.
- 버린 대안: ① `python -m coconut_collector` 그대로 공유 — 대상자가 src clone +
  venv 수동 설정해야 해 "한 줄 실행" 메시지와 괴리. 전환율 급락 예상.
  ② PyPI 게시 없이 GitHub Release에 zip 배포 — pip보다 마찰 큼.
- 핵심 트레이드오프: `pyproject.toml` + PyPI 패키징은 배포 경로 추가 (실패비용
  ≥2h — 이름 선점 회수 어려움). 단 external 사용자 "한 줄 설치" 마찰 제거 효과가
  비대칭적으로 큼. 실제 게시(`twine upload`)는 owner 별도 수동 실행으로 게이트.
- 선택 이유: 위험 3축 3/3 충족 → /codex 교차 리뷰 강력 권장 + plan 명시 4종 한도.
  GIF/30초/에러메시지는 구현 + Playwright 측정으로 evidence-based closure.
- 강한 증거: 기존 decision-log의 반복 패턴 — "검증 분리 + /codex 교차가 테스트
  그린이 숨긴 결함을 잡아냄" (4회+ 확인). PyPI 패키징 silent failure 성질상
  신규 머신 설치 시까지 오류가 안 보임 → 동일 교차 검증 구조 필수.

---

### 2026-05-21 [Rollout Gate 무결성 v2 — HMAC + namespace + CI hardening]

- 문제: `/api/burnindex`(무인증)과 `/api/telemetry/auto-detect`가 외부 POST로 Axis 1/2/3 카운터 위조 가능. 기존 Origin/rate-limit 설계는 실질 인증 아님. Redis v1 키에 Phase 1·2 오염 카운터 존재. CI workflow 4가지 silent-PASS bypass.
- 버린 대안: ① Origin+rate-limit 유지(=인증 없음, 위조 차단 불가), ② OAuth/JWT 완전 재설계(솔로·익명 수집에 과대), ③ fail-open Redis fallback(gate integrity와 모순).
- 핵심 트레이드오프: server-issued HMAC short-lived token은 클라이언트 round-trip 1회(≤200ms) 추가 vs 무인증 위조 경로 완전 차단. namespace bump은 v1 카운터 보존(rollback용) vs 측정창 오염 분리.
- 선택 이유: 단일 shared-secret HMAC + Redis nonce + fail-closed가 솔로 프로젝트 위협 모델에 최소 침습이고 gate 신뢰성 확보. workflow_dispatch는 Vercel deployment protection 401 우회 + 일반 PR 개발 흐름 보호. Codex 12건 BLOCK 전량 반영.
- 강한 증거: Codex gpt-5.5 적대적 검토 BLOCK 결과 + 기존 decision-log "교차 검증이 단위 테스트가 숨긴 결함을 잡아냄" 패턴(4회+ 확인).

[S10 회고]
- 무엇이 잘 됐나: Codex 12건 BLOCK이 설계 단계에서 `/api/burnindex` Axis 1 위조 경로를 잡아냈고, Phase A 10셀 매트릭스를 production build(not dev server) 환경 + browser automation으로 전수 검증해 kill-switch 계약을 코드 실행 증거로 확보. `gate-pass` required check가 workflow_dispatch와 호환 불가임을 PR 머지 시점에 발견해 GitHub API로 즉시 수정 — branch protection 설계 결함이 silent하게 모든 PR을 영구 차단하기 전에 해소.
- 다음엔 무엇을 바꿀까: required status check를 설계할 때 CI 트리거 타입(`pull_request` vs `workflow_dispatch` vs `push`)이 GitHub 정책상 호환되는지 S3 단계에서 먼저 검증한다. Vercel deployment protection이 CI의 protected API 접근을 막는 한계도 plan에 명시해야 Vercel Pro 없이 자동화 불가임이 owner에게 S3 단계에서 전달된다.

### 2026-05-21 [Playwright e2e 사이클 종료 — /retro 회고]

- 무엇이 잘 됐나: Codex 5건 사전 가정 검증(fixture 이름 `projects` 강제, 타임스탬프 윈도우 오프사이드,
  MemoryBurnStore 부재, IDB DataCloneError 함정, `reuseExistingServer` 충돌 패턴)이 spec 작성 전에
  설계 결함 4건을 막았다. MemoryBurnStore 격리가 동작해 e2e 실행 중 production leaderboard 오염 0건.
  CI e2e job이 첫 실행에 3.4s PASS (Chromium 헤드리스, ubuntu-latest).
- 다음엔 무엇을 바꿀까:
  ① [Modal miss] `JoinBurnIndexForm`이 `LandingApp.tsx`의 `{modal === "join" && ...}` overlay 안에
  렌더링되는 것을 모르고 `?auto-detect=1` flag만으로 FSA UI가 자동 노출된다고 가정 → 30초 타임아웃
  발생 후 페이지 스냅샷으로 발견. 실 손실: spec 3개 fix 라운드 중 1 라운드 소비. 다음 e2e는
  owning 컴포넌트(`LandingApp.tsx` 등) 먼저 grep해 진입 경로(버튼/링크/URL flag)를 코드에서 확정 후 시작.
  ② [IDB structuredClone 함정] 가짜 FSA 핸들의 함수 프로퍼티(`queryPermission`, `entries`, `getFile`)가
  `IDB put()`의 structured clone 알고리즘과 충돌 → `DataCloneError` → `pickFolder()` catch가
  setClaudeHandle 호출을 막아 "✓ projects" 버튼이 뜨지 않음. 원인 추적에 1 라운드 소비.
  해소: `IDBFactory.prototype.open`을 `"coconutlabs.handles"` DB에 한해 in-memory Map으로 교체
  (`injectFakeHandlesIDB` 패치). 이 패턴을 DevVault TIL에 등록해 다음 FSA e2e에서 재발굴 방지.
  ③ [Port 충돌 패턴] Docker(:3000) + Coconut Labs dev server(:3001, BURN_STORE 미설정) +
  Playwright `reuseExistingServer: true`(baseURL :3000) → Family Asset 로그인 페이지 렌더.
  잘못된 앱이 뜨는 증상으로 스펙이 전혀 진행되지 않았다. 실 손실: port kill + config 수정에 1 라운드.
  해소: playwright.config.ts에 port 3002 + `reuseExistingServer: !CI` + 명시적 `webServer.command`.
  다음 프로젝트는 e2e 전용 포트를 처음부터 할당하고 README에 "e2e 실행 전 기존 dev 종료" 1줄 명시.

---

### 2026-05-21 [Production ON-flip — NEXT_PUBLIC_AUTO_DETECT_DEFAULT=true, Axis 1 = 0 owner 우회]

- 문제: Axis 1 = 0 (v2 namespace 신규) — Rollout Gate 기준 미달. 노출 없이 Axis 1 누적 불가한 닭-달걀 구조. 게이트 자체가 "충분한 환경에서 파이프라인 작동 검증"이 목적이었으나, Chrome 사용자가 auto-detect UX를 보기 전엔 측정값이 쌓이지 않는다.
- 버린 대안: ① Axis 1 ≥ 15 달성 후 전환 (언제까지 기다릴지 기준 없음, 닭-달걀 무한 루프). ② `?auto-detect=1` 쿼리 기반 opt-in 유지 (링크 공유 없이 자발적 유입 기대 불가).
- 핵심 트레이드오프: ON-flip은 Chrome 방문자 전체에게 auto-detect UX를 노출 → 파이프라인 오작동 시 kill-switch(env=false + redeploy, ~34초)로 수분 내 원복 가능. 단 HMAC 인증·namespace v2·fail-closed Redis·kill-switch 10/10 셀 검증 등 infrastructure가 모두 live 상태.
- 선택 이유: Gate ritual 1회 실행 (Run #13, FAIL 확인) + 의도적 owner 우회 audit trail 기록. ON-flip이 Axis 1 측정값을 쌓는 수단으로 작동. 모니터링 윈도우(T+1h)를 안전망으로 확보.
- 강한 증거: Smoke test 4/4 PASS (Chrome "Auto-detect Burn Summary" ✅, FSA-off fallback "Join Burn Index" ✅, env wins over `?auto-detect=0` ✅, 무토큰 POST → 401 ✅). Build secret 노출 0건. Redeploy 34초 완료.

[S10 회고]
- 무엇이 잘 됐나: Codex pre-flip consult Q3(telemetry suppression), Q4(NAT rate-limit), Q5(kill-switch scope 정의) 3건이 모니터링 계획에 즉시 반영됨 — Phase G abandonment ratio check + 429 monitoring이 설계 전에 확보됨. Smoke test 4종을 browser automation으로 직접 실행해 코드 리뷰 증거 대신 실행 증거 확보.
- 다음엔 무엇을 바꿀까: `ROLLOUT_GATE_SECRET`이 Vercel CLI pull에서 redacted → metrics endpoint curl 불가. 다음 번엔 Upstash REST URL + Token을 별도 안전한 local store에 보관하거나, 로컬 `.env.local`에 실제 값 유지. 또한 v2 namespace 전환 시 Axis 1 카운터가 0으로 리셋됨을 plan §Baseline에 미리 명시 — 이번엔 "4 예상 → 0 실제" 불일치를 baseline JSON 재작성으로 처리.

---

### 2026-05-22 [Folder picker UX — Approach B (inline preview + smart errors)]

- 문제: ON-flip 직후 production smoke test에서 ① 폴더 선택 불명확(picker 진입 시 "어떤 폴더를 골라야 하는지" 시각 cue 부재, Step 1 helper text 위계 약함) ② Chrome FSA 시스템 폴더 차단(`~` 홈 디렉터리 거절) 시 catch-all 단일 에러 메시지가 권한 문제로 오인 유도. 본 작업 진행 중 owner self-test에서 추가 발견 ③ kbd `⌘⇧.` 11px 시인성 부족 ④ "home folder 시작" 안내 부재 ⑤ `?auto-detect=1` 쿼리 모달 자동 오픈 안 함(Finding 1, 별 사이클 이관).
- 버린 대안: Approach A (pre-picker modal) — 진입 마찰 1단계 추가 + microcopy 중복 위험(modal + Path Preview Card + Step 1 helper 3중 노출). OS detection 분기(macOS/Linux 따로 hint 노출) — 코드 분기 비용 > Linux 사용자가 macOS hint 한 줄 더 보는 cognitive cost. i18n(영어/한국어 동시) — 글로벌 dev 타겟 정책에 따라 영어 단일.
- 핵심 트레이드오프: 영어 유지(글로벌 dev 타겟, 한국어 owner는 학습 비용 감수) + OS detection 없음(두 hint 동시 노출 허용) + locale-independent `error.name` 분기(`error.message` 파싱 금지 — Chrome dialog 한국어/영어 모두 흡수) + count-based AbortError heuristic(timing-based 1500ms 폐기, 실제 picker UX 호출당 10-15초로 timing window 부적합).
- 선택 이유: First-impression UX 즉시 해소(production live state에서 catch-all 에러 → 4분기 actionable) + Invariant 5축 모두 보호 (#1 build secret 0, #2 WCAG AA 4.5:1, #3 auto-detect 진입 회귀 0, #4 error.name only, #5 handle React state ↔ IDB persistence 분리). Phase 7.5.6 closure 후 owner "사이즈 괜찮음" 발화로 가시성 마지막 결함도 해소.
- 강한 증거: ON-flip 직후 owner production 자체검증에서 SecurityError 케이스 직접 발견 + 3 Codex 적대적 라운드 (Phase 1 IDB persistence MEDIUM → Plan v2 §B mitigation / Phase 6 Cell #2 AbortError CONCERN → Contingency Patch v2 count-based / Phase 7.5 kbd 시인성 + home folder 안내 발산 후 patch) 모두 의미 있는 결함 발견 + B3 5종 산출물(criteria/criteria-execution-log/diff/unverified/smoke-golden-regression) 누적 + Owner Happy Path 12+ cells (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1) owner 손글씨 직접 기록 + 4 commits production deploy (`6cda4c5`/`b94d362`/`3756e83`/`40cd00c`) 각 build secret leak 0 hits 재확인.

[S10 회고]
- 무엇이 잘 됐나: ON-flip → owner self-test → 3 Finding(모달 자동 오픈 / kbd 시인성 / home folder 안내) 발견 → 단일 patch 사이클(Phase 7.5 + 7.5.6)로 2건 흡수, Finding 1만 별 사이클 이관. Codex 3 라운드(Phase 1/6/7.5) 모두 사각지대 검출 — Cell #2 AbortError(timing-based pivot 근거 확보), kbd 시인성(13→15px 2단계 bump 필요성). Invariant 5축이 매 Phase 머지 게이트로 작동해 production secret leak / a11y 회귀 / auto-detect 진입 회귀 0건 유지.
- 다음엔 무엇을 바꿀까: ① ON-flip 전 staging 환경 owner self-test 단계 추가 — production 직행 시 owner가 즉시 결함을 발견하긴 했으나 staging이 있었다면 Finding 2/3/4를 Phase 5 이전에 흡수 가능. ② Phase 6 manual cells에 "microcopy 시인성"(kbd font-size 11px이 실사용 가독한가) 명시 항목 추가 — Phase 6 audit이 기능 검증에 집중해 시각 결함 누락. ③ DOMException dispatch 명세 불명확 시(MDN+WICG+Chromium 소스 3중 분석 필요) 사전 console 패치(window.showDirectoryPicker wrapper)로 `e.name` 실측 후 분기 설계 — Cell #2 Codex CONCERN을 patch-after-measure 패턴으로 1라운드 단축 가능.

exec
/bin/zsh -lc "git log --oneline 6cda4c5..40cd00c -- 'components/forms/JoinBurnIndexForm.tsx' 'app/globals.css'" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
40cd00c fix(forms): bump path-preview kbd 13→15px for legibility
b94d362 fix(forms): folder picker kbd visibility + home folder hint

exec
/bin/zsh -lc "sed -n '1,220p' tasks/folder-picker-ux/codex-phase1.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
# Codex Phase 1 — Adversarial Review Input Doc

**Date**: 2026-05-21
**Target**: Folder Picker UX Improvement (Approach B: inline preview + smart error recovery)
**Owner action**: 별 세션에서 `/codex` 실행 후 본 문서 전체 + 아래 §변경 surface 명세 + §JoinBurnIndexForm.tsx 발췌를 입력으로 전달. Codex 응답 전문을 본 파일 하단 §Response 섹션에 추가.

**Pass condition**: Codex HIGH/MEDIUM 결함 0건 (nit-only). HIGH/MEDIUM 발견 시 Plan v2 작성 후 재실행 (Phase 2 차단).

---

## §1. Plan 요지 (3 surfaces)

이번 사이클은 ON-flip 직후 chongwon83 owner가 production에서 직접 발견한 Chrome FSA picker first-impression 결함을 수정. 3 surface 변경:

### S1. Path Preview Card (신규)

picker 버튼 위에 인라인 시각 breadcrumb 카드. 두 row 노출:

```
~ / .claude / projects
~ / .codex / sessions
Hidden folders need: ⌘⇧· (macOS) or Ctrl+H (Linux) in your file manager
```

경로 segment 각각 `<span>` 분리해 hidden-folder prefix(`.`)를 시각적으로 강조 (예: `--young-coconut-dark` outline 또는 background tint). picker 버튼보다 visual weight 작게.

### S2. Smart Error Differentiation (pickFolder 재작성)

현재 `pickFolder()`는 `AbortError`만 silent, 나머지 모두 catch-all "Could not open the folder picker. Check browser permissions."로 묶임. 4분기로 확장:

- `e instanceof DOMException && e.name === "AbortError"` → `return` (silent, form-error 미노출)
- `e instanceof DOMException && e.name === "SecurityError"` → "Chrome blocked that folder because it contains system files. Drill down to your **~/.claude/projects** (or **~/.codex/sessions**) directory specifically — not your home folder."
- `e instanceof DOMException && e.name === "NotAllowedError"` → "Read access wasn't granted. Try again and approve the picker when Chrome prompts."
- 그 외 → "Couldn't open the folder picker. Try a different browser or check site permissions."

또한 name mismatch 메시지에 사용자가 실제 선택한 폴더명 동적 삽입:

```
You picked **${h.name}**. We need the directory literally named **${expectedName}** (inside ~/.claude/ or ~/.codex/). Try again.
```

**중요 invariant**: `error.message` 파싱 절대 금지 — Chrome dialog locale 의존 (한국어 환경에서 "이 폴더에는 시스템 파일이…" 등). 반드시 `error.name`만 사용.

### S3. Step 1 Helper Text Refinement

현 문구 (line 348-350): "Select only the exact directory shown below — not your home folder."
신규: "Pick the exact folder previewed below. Drill into hidden directories with the OS shortcut shown."

Path Preview Card와 microcopy 중복 없도록 단순화.

---

## §2. 위험 3축 평가

| 축 | 충족 | 근거 |
|----|------|------|
| ① 실패비용 ≥ 2h | ✅ | UX 회귀 시 cosmetic 수정 + 재배포 합산 2h+ |
| ② 영향범위 | ✅ | `JoinBurnIndexForm.tsx` + `globals.css` (production landing main CTA) — 모든 Chrome/Edge auto-detect 진입 사용자 |
| ③ 관찰가능성 | ✅ | UX 마찰은 axis2 telemetry로 부분 가시. 폴더 mismatch/cancel ratio는 client-side counter 없으면 silent fail |

3/3 → Codex 교차 리뷰 **강력 권장 + Design review 의무** (본 plan에 포함).

---

## §3. Pre-flagged Concerns (owner self-audit)

본 작업 입안 중 owner 본인이 발견한 사전 우려. Codex가 이 항목을 다시 검증하거나 추가 결함 식별 요청.

### P-1. WCAG AA contrast (HIGH 후보 — owner 직접 확인)

기존 token contrast 측정:
- `--fg2 (#525252)` on `--bg (#FFFFFF)` → ~7.5:1 ✅
- `--fg3 (#8E8E8E)` on `--bg (#FFFFFF)` → **~3.5:1 ❌ FAILS WCAG AA 4.5:1**
- `--young-coconut (#00D084)` on `--bg (#FFFFFF)` → **~1.8:1 ❌ FAILS** (텍스트 사용 금지)
- `--young-coconut-dark (#008C5A)` on `--bg (#FFFFFF)` → ~3.7:1 ⚠️ borderline (large text 가능, body text 부적합)

**S1 구현 시 강제 규칙**:
- 본문 텍스트: `--fg2` 사용 (`--fg3` 금지)
- accent / hidden-folder emphasis: `--young-coconut-dark`는 텍스트가 아닌 **outline / 1px border**로만. 또는 background tint(`--young-coconut-soft`)
- 에러 메시지: 기존 `.form-error` class 재사용 (검증 완료된 색상)

### P-2. macOS glyph fallback (Codex Q2)

reveal hint `⌘⇧·` (U+2318 PLACE OF INTEREST SIGN + U+21E7 UPWARDS WHITE ARROW + U+00B7 MIDDLE DOT)이 Windows 기본 폰트(Segoe UI)에서 정상 렌더 여부 미확인. tofu(`□`) 노출 시 cosmetic 결함. ASCII fallback "Cmd+Shift+." 추가 권장 여부.

### P-3. Visual hierarchy drift

Path Preview Card가 primary CTA(picker 버튼)보다 시각적으로 강조되면 attention drift. picker 버튼은 line 352 `.form-fsa-picker` class — current style: 큰 padding + outline. Path Preview Card는 작은 padding + 낮은 contrast로 designed.

---

## §4. Codex Challenge Questions (7개)

본 plan과 변경 surface 명세에 대해 다음 질문에 적대적으로 답해 결함을 식별:

1. **`error.name === "SecurityError"` 분기의 cross-browser 안정성**: Chrome 86+, Edge 86+에서 모두 동일하게 `SecurityError` 반환하는가? Brave/Vivaldi/Arc 등 Chromium 파생에서 다른 DOMException name 또는 다른 분기를 반환할 가능성? 만일 그렇다면 fallback 메시지 ("Couldn't open the folder picker. Try a different browser…")로 흡수 충분한가?

2. **macOS hint `⌘⇧·` glyph fallback**: U+2318(⌘), U+21E7(⇧)이 Windows 기본 폰트(Segoe UI)·Linux 기본 폰트(DejaVu)에서 정상 렌더되는가? 두 hint 동시 노출 모델(macOS+Linux)에서 Windows 사용자에게 tofu(`□`) 노출 시 cosmetic 결함. ASCII 표기 "Cmd+Shift+." 추가하면 microcopy 중복 발생 — 어느 쪽이 더 큰 cost?

3. **Step 1 helper text + Path Preview Card 중복 점검**: 현재 plan은 S3에서 helper text를 "Pick the exact folder previewed below. Drill into hidden directories with the OS shortcut shown."로 변경. Path Preview Card가 이미 두 row + reveal hint 표시 → S3 helper text 자체를 삭제하는 게 더 깔끔한가? cognitive load 최소화 관점에서 둘 중 어느 쪽이 우월?

4. **Path Preview Card visual hierarchy drift**: Card가 picker 버튼보다 시각 강조되면 primary CTA(picker click) attention drift. plan은 JetBrains Mono 13px (경로) + Inter 14px (설명) + outline border로 visual weight 최소화 의도. 이게 충분한가? hidden-folder(`.`-prefix) emphasis를 어떻게 표현해야 picker click conversion 회귀 0인가?

5. **AbortError silent의 UX cost**: 사용자가 picker 버튼 클릭 → dialog cancel → "버튼 눌렀는데 아무 반응 없음"으로 인지할 가능성. silent의 대안:
   (a) subtle toast 1.5s "Cancelled — try again when ready"
   (b) picker 버튼 자체에 1.5s "Cancelled" inline label
   (c) 완전 silent (현 plan)
   세 옵션 중 plan의 (c)가 옳은가? 별 대안의 cost 분석.

6. **두 hint(macOS+Linux) 동시 노출의 Linux 사용자 혼란**: Linux 사용자가 macOS hint `⌘⇧·`를 보고 "이건 내 OS 아닌데?" 혼란. plan은 OS detection 코드 분기 cost > 가치로 판단. 진짜 OS detection 없이 가는 게 옳은가? `navigator.userAgentData.platform` 사용 가능한가 (Chrome 90+)?

7. **`globals.css` 신규 클래스 + 기존 token 충돌**: `.path-preview-card`, `.path-preview-row`, `.path-segment`, `.path-segment--hidden`, `.path-preview-hint` 5개 신규 클래스 추가. 명명 규칙이 기존 `.form-*`, `.statusbar`, `.btn-*` 패턴과 어울리는가? `.form-path-preview-card`로 prefix 통일이 옳은가? DESIGN.md spec sync 의무는 어디까지 (신규 component 추가 시 DESIGN.md `## Components` 섹션 entry 1개 필수인가)?

---

## §5. JoinBurnIndexForm.tsx 발췌 (S2 재작성 대상)

### 현재 `pickFolder` (line 104-127)

```typescript
async function pickFolder(kind: "claude" | "codex") {
  try {
    // showDirectoryPicker is a browser API — not available in SSR/node
    const picker = (window as Window & typeof globalThis & {
      showDirectoryPicker(opts?: { mode?: string }): Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;
    const h = await picker({ mode: "read" });
    const expectedName = kind === "claude" ? "projects" : "sessions";
    if (h.name !== expectedName) {
      setFsaError(
        `Selected folder must be the .claude/projects (or .codex/sessions) directory itself, not your home directory. You selected "${h.name}".`,
      );
      return;
    }
    setFsaError("");
    await saveHandle(kind, h);
    if (kind === "claude") setClaudeHandle(h);
    else setCodexHandle(h);
  } catch (e) {
    // User cancelled the picker — not an error
    if (e instanceof DOMException && e.name === "AbortError") return;
    setFsaError("Could not open the folder picker. Check browser permissions.");
  }
}
```

### 현재 Auto-detect card markup (line 334-367 발췌)

```tsx
if (autoDetect) {
  return (
    <div className="form-card">
      <h3 className="form-title">Auto-detect Burn Summary</h3>
      <p className="form-desc">
        Point this page at your{" "}
        <code className="form-code-inline">.claude/projects</code> and{" "}
        <code className="form-code-inline">.codex/sessions</code> folders.
        Token counts are aggregated locally — only the 9 anonymised fields
        join the Burn Index.
      </p>

      <div className="form-step">
        <div className="form-step-label">Step 1 · Select folders</div>
        <div className="form-step-desc">
          Select only the exact directory shown below — not your home folder.
        </div>
        <div className="form-fsa-pickers">
          <button
            type="button"
            className={`form-fsa-picker${claudeHandle ? " form-fsa-picker--selected" : ""}`}
            onClick={() => pickFolder("claude")}
          >
            {claudeHandle ? `✓ ${claudeHandle.name}` : "Select .claude/projects folder"}
          </button>
          <button
            type="button"
            className={`form-fsa-picker${codexHandle ? " form-fsa-picker--selected" : ""}`}
            onClick={() => pickFolder("codex")}
          >
            {codexHandle ? `✓ ${codexHandle.name}` : "Select .codex/sessions folder"}
          </button>
        </div>
      </div>
      ...
      {fsaError && <p className="form-error">{fsaError}</p>}
```

---

## §6. 기존 token / class anchor

`app/globals.css`에서 확인된 사용 가능 토큰:

- 색상: `--bg` `#FFFFFF`, `--fg2` `#525252` (7.5:1), `--fg3` `#8E8E8E` (3.5:1 ⚠️), `--young-coconut` `#00D084`, `--young-coconut-dark` `#008C5A`, `--young-coconut-soft` `rgba(0,208,132,0.10)`, `--danger` `#DC2626`
- 폰트: `--font-ui` (Inter), `--font-mono` (JetBrains Mono)
- 모양: `--r-card` `8px`
- 기존 form 클래스: `.form-card`, `.form-title`, `.form-desc`, `.form-step`, `.form-step-label`, `.form-step-desc`, `.form-fsa-pickers`, `.form-fsa-picker`, `.form-fsa-picker--selected`, `.form-error`, `.form-code-inline`

---

## §Response (Codex output — owner 입력)

Codex Adversarial Review

  Target: working tree diff
  Verdict: needs-attention

  No-ship: the working tree contains live recovery credentials, the new e2e flow can contaminate real backend state, and the folder picker still treats optional IDB
  persistence as a hard blocker.

  Findings:
  - [critical] PyPI recovery codes are present in the working tree (credentials/PyPI-Recovery-Codes-chongwon5026-2026-05-21T07_35_20.758710.txt:1-8)
  The untracked credentials file contains eight PyPI recovery codes in plaintext. If this directory is committed, zipped, uploaded, or included in review artifacts,
  account recovery access is exposed. Because recovery codes are effectively backup auth material, deletion alone is not enough after exposure.
  Recommendation: Remove the file from the repo, rotate/regenerate PyPI recovery codes, add credentials/ to .gitignore, and verify the codes never entered git history
  or published artifacts.
  - [high] New e2e test sends real uploads and can pollute backend metrics (e2e/onboarding-30s.spec.ts:93-97)
  The 30s onboarding test drives the real UI through Add to Burn Index and waits for the success toast, but it does not mock /api/internal/issue-collector-token or
  /api/burnindex. Inference from the existing flow: handleConfirm() fetches a collector token, posts to /api/burnindex, and the server records submission metrics when
  Upstash env is present. BURN_STORE=memory only isolates the leaderboard store when Playwright launches the server; it does not isolate token Redis or rollout metrics,

exec
/bin/zsh -lc "sed -n '1,240p' tasks/folder-picker-ux/codex-phase6.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
# Codex Phase 6 Static Review

**Date**: 2026-05-21
**Verdict**: needs-attention

## Cell-by-cell verification

1. Cell #1 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:13` expects `~/.claude/projects` + `~/.codex/sessions` two row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux). The auto-detect branch renders the Path Preview Card before the picker buttons: `.claude / projects` is rendered at `components/forms/JoinBurnIndexForm.tsx:392-399`, `.codex / sessions` at `components/forms/JoinBurnIndexForm.tsx:400-406`, and the hint text with two `<kbd>` labels at `components/forms/JoinBurnIndexForm.tsx:407-409`. The new CSS selectors exist for the card and warning surface: `.path-preview-card` at `app/globals.css:2003-2012`, `.path-preview-row` at `app/globals.css:2013-2020`, `.path-segment` at `app/globals.css:2021-2024`, `.path-segment--hidden` at `app/globals.css:2025-2030`, `.path-preview-hint` at `app/globals.css:2031-2037`, `.path-preview-hint kbd` at `app/globals.css:2038-2046`, and `.form-warning` at `app/globals.css:2047-2056`.

2. Cell #2 — CONCERN. The literal `SecurityError` branch does produce the actionable message required by `tasks/folder-picker-ux/criteria.md:17` and `tasks/folder-picker-ux/smoke-golden-regression.md:14`: the code checks `e instanceof DOMException` at `components/forms/JoinBurnIndexForm.tsx:119`, checks `e.name === "SecurityError"` at `components/forms/JoinBurnIndexForm.tsx:121`, and sets `"Chrome blocked that folder because it contains system files. Drill down to your .claude/projects (or .codex/sessions) directory specifically — not your home folder."` at `components/forms/JoinBurnIndexForm.tsx:122-124`. The semantic gap is branch selection for the home-folder scenario: `AbortError` returns silently at `components/forms/JoinBurnIndexForm.tsx:120`, before the `SecurityError` branch. Current File System Access documentation lists too-sensitive/dangerous selected directories under `AbortError` DOMException, while `SecurityError` is for origin/user-activation blocking (MDN `showDirectoryPicker()` lines 235-243, https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker). The WICG algorithm also permits rejecting too-sensitive directory selection with `AbortError` (WICG File System Access lines 638-643, https://wicg.github.io/file-system-access/#api-showdirectorypicker), and Chromium plumbing maps sensitive-entry abort to `FileSystemAccessStatus::kOperationAborted` (Chromium `file_system_access_manager_impl.cc` lines 1405-1409, https://chromium.googlesource.com/chromium/src/+/refs/tags/133.0.6847.2/content/browser/file_system_access/file_system_access_manager_impl.cc), which Blink maps to `DOMExceptionCode::kAbortError` (Chromium `file_system_access_error.cc` search result for `kOperationAborted`, https://chromium.googlesource.com/chromium/src/+/4cfe86482b000e848009077783ba35f83f3c3cfe/third_party/blink/renderer/modules/file_system_access/file_system_access_error.cc). Static conclusion: if production Chrome reports home-folder rejection as `AbortError`, Cell #2 fails silently at `components/forms/JoinBurnIndexForm.tsx:120`. This requires real-incognito verification before owner completion.

3. Cell #3 — PASS. `tasks/folder-picker-ux/criteria.md:18` requires the actual selected folder name, and `tasks/folder-picker-ux/smoke-golden-regression.md:15` expects Name mismatch 메시지에 `**{h.name}**` 동적 노출 ("You picked **.claude**. We need **projects**…"). The implementation computes `expectedName` at `components/forms/JoinBurnIndexForm.tsx:142`, compares `h.name` at `components/forms/JoinBurnIndexForm.tsx:143`, and interpolates both `h.name` and `expectedName` in the error at `components/forms/JoinBurnIndexForm.tsx:144-146`.

4. Cell #4 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:16` expects Error 0건, 핸들 저장, 다음 step 진행. The Phase 5 split satisfies Invariant #5 from `tasks/folder-picker-ux/criteria.md:41`: after name validation, the code clears `fsaError`/`fsaWarning` at `components/forms/JoinBurnIndexForm.tsx:153-154`, sets `claudeHandle` or `codexHandle` at `components/forms/JoinBurnIndexForm.tsx:155-156`, and only then enters the best-effort `saveHandle` try/catch at `components/forms/JoinBurnIndexForm.tsx:161-167`.

5. Cell #5 — PASS for the Phase 6 sequence, with a LOW stale-error note. `tasks/folder-picker-ux/criteria.md:16` requires `AbortError` 케이스에서 error 표시 0건 (사용자 cancel은 silent), and `tasks/folder-picker-ux/smoke-golden-regression.md:17` expects Silent (form-error 미노출, 카드 그대로). The picker catch returns immediately for `e.name === "AbortError"` at `components/forms/JoinBurnIndexForm.tsx:119-120`, so no new `fsaError` is created. In the smoke sequence, Cell #4 clears errors first at `components/forms/JoinBurnIndexForm.tsx:153`, so Cell #5 should display no error. Isolated caveat: if a user cancels immediately after a prior mismatch/security error, line `components/forms/JoinBurnIndexForm.tsx:120` does not clear the stale `fsaError`; that does not break the listed Cell #5 order but is a UX edge case.

6. Cell #6 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:18` expects Safari fallback with Path Preview Card hidden. `autoDetect` can only be true if the env/query condition is true and `typeof window !== "undefined"` and `"showDirectoryPicker" in window` are both true at `components/forms/JoinBurnIndexForm.tsx:68-73`. Browsers without `showDirectoryPicker` will skip the auto-detect branch that begins at `components/forms/JoinBurnIndexForm.tsx:375`.

7. Cell #7 — PASS. `tasks/folder-picker-ux/criteria.md:20` requires handle React state 유지 + scan 진행 가능 + `fsaWarning`만 노출 (`fsaError` 빈 상태), and `tasks/folder-picker-ux/smoke-golden-regression.md:19` expects `fsaWarning`에 "Folder selected for this session, but it could not be remembered" 노출. State is separated into `fsaError` and `fsaWarning` at `components/forms/JoinBurnIndexForm.tsx:80-84`; picker success clears both at `components/forms/JoinBurnIndexForm.tsx:153-154`; handle state is set at `components/forms/JoinBurnIndexForm.tsx:155-156`; `saveHandle` failure only sets `fsaWarning` at `components/forms/JoinBurnIndexForm.tsx:161-167`; JSX renders `fsaError` and `fsaWarning` separately at `components/forms/JoinBurnIndexForm.tsx:445-446`. The Scan button disabled prop is `fsaLoading || (!claudeHandle && !codexHandle)` at `components/forms/JoinBurnIndexForm.tsx:448-454`, with no gate on either `fsaError` or `fsaWarning`.

## Adversarial probes (Q1-Q6)

Q1 — Finding: Step 4 does not re-couple state correctness to IDB persistence. Severity: LOW. The event path is: `await picker({ mode: "read" })` yields until the native picker resolves at `components/forms/JoinBurnIndexForm.tsx:117`; after name validation, React state updates are enqueued at `components/forms/JoinBurnIndexForm.tsx:153-156`; then `await saveHandle(kind, h)` starts at `components/forms/JoinBurnIndexForm.tsx:161-162`. `saveHandle` itself is asynchronous and awaits an IndexedDB write at `lib/client/burn/handles.ts:51-55`; opening IDB is callback-driven at `lib/client/burn/handles.ts:11-23`. Therefore the JavaScript stack yields after the `await saveHandle(...)` call, giving React an opportunity to commit the queued handle state. If IDB rejects quickly, the warning at `components/forms/JoinBurnIndexForm.tsx:164-165` may commit in the same visible render as the selected handle, but the selected handle is still already in React state and the Scan button predicate at `components/forms/JoinBurnIndexForm.tsx:453` becomes enabled.

Q2 — Finding: `instanceof DOMException` is probably fine for Chrome proper, but fork behavior and sensitive-directory error naming require runtime verification. Severity: MEDIUM because it can affect Cell #2. The code only inspects `e.name` inside the `e instanceof DOMException` guard at `components/forms/JoinBurnIndexForm.tsx:119-133`; a non-DOMException object with `name: "SecurityError"` or `name: "AbortError"` would fall to the generic message at `components/forms/JoinBurnIndexForm.tsx:134-137`. MDN documents `AbortError` and `SecurityError` here as DOMException types for `showDirectoryPicker()` (MDN lines 235-243), so same-realm Chrome should satisfy the guard. I did not find static project evidence for Edge/Brave/Vivaldi-specific wrapping; that part is requires-runtime-verification. The larger static concern is not `instanceof`; it is that current FSA/Chromium references map too-sensitive directory selection to `AbortError`, while this implementation treats every `AbortError` as user cancel at `components/forms/JoinBurnIndexForm.tsx:120`.

Q3 — Finding: the system trusts the final folder name, not the parent path. Severity: MEDIUM privacy/false-import risk, not a Phase 6 Happy Path blocker. `pickFolder` validates only `h.name !== expectedName` at `components/forms/JoinBurnIndexForm.tsx:142-148`. `handleFsaScan` then sends the selected handles into `runImport` at `components/forms/JoinBurnIndexForm.tsx:202-208`, and `runImport` delegates to `buildEnvelope` at `lib/client/burn/import.ts:36-44`. Downstream walkers repeat only root-name allowlists: Claude rejects non-`projects` names at `lib/client/burn/parsers.ts:853-859`, and Codex rejects non-`sessions` names at `lib/client/burn/parsers.ts:897-902`. There is no validation that a `projects` handle is actually under `~/.claude/` or that a `sessions` handle is actually under `~/.codex/`. The blast radius is limited by exact-depth traversal and filename/schema filters at `lib/client/burn/parsers.ts:840-847`, `lib/client/burn/parsers.ts:861-879`, `lib/client/burn/parsers.ts:884-892`, and `lib/client/burn/parsers.ts:907-928`, but a user-selected random folder named `projects` or `sessions` can still be iterated if it matches those shapes.

Q4 — Finding: the kill-switch precedence is build-time, not hot runtime. Severity: LOW if the documented redeploy rollback is followed; MEDIUM if an operator expects a live config flip. The component reads `process.env.NEXT_PUBLIC_AUTO_DETECT_DEFAULT` at `components/forms/JoinBurnIndexForm.tsx:67`, then applies the false-overrides-query precedence at `components/forms/JoinBurnIndexForm.tsx:68-73`. Local Next docs state that bundled env access is replaced at build time at `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/env.md:53-64`, and that `NEXT_PUBLIC_` values are inlined and frozen after build at `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md:154-166`. The broader rollout docs already say rollback is `env=false + redeploy, ~34초` at `docs/decision/decision-log.md:341`, so the plan is coherent only if redeploy is part of the kill-switch operation.

Q5 — Finding: English warning beside Korean native Chrome dialog is expected by the plan. Severity: INFO. The warning string is hardcoded English at `components/forms/JoinBurnIndexForm.tsx:164-165`, and the other FSA errors are also English at `components/forms/JoinBurnIndexForm.tsx:122-135` and `components/forms/JoinBurnIndexForm.tsx:144-146`. This matches the project context: `tasks/folder-picker-ux/criteria.md:6` says UI 영어 유지, `~/.claude/plans/p1-rollout-lazy-trinket.md:30-32` records UI language as English, and `tasks/folder-picker-ux/criteria.md:47-49` explicitly lists i18n / 한국어 메시지 as out of scope. `tasks/folder-picker-ux/smoke-golden-regression.md:14` also explicitly expects Korean Chrome dialog는 떠도 우리 UI 메시지는 영어 동일.

Q6 — Finding: the `<kbd>` hint lacks an explicit screen-reader label. Severity: MEDIUM a11y risk, requires-runtime-verification. The semantic hint is plain text plus `<kbd>⌘⇧·</kbd>` and `<kbd>Ctrl+H</kbd>` at `components/forms/JoinBurnIndexForm.tsx:407-409`; CSS only changes visual styling at `app/globals.css:2038-2046`. There is no `aria-label`, visually hidden expansion, or alternate text such as "Command Shift Period" for the macOS glyph sequence. `tasks/folder-picker-ux/criteria.md:19` requires screen reader 인지 가능, so VoiceOver/NVDA pronunciation should be manually checked. Static code cannot prove whether VoiceOver announces the macOS shortcut usefully or as literal symbols.

## Recommendation

Owner should focus real-incognito Phase 6 on Cell #2 first: capture or temporarily log `e.name` when selecting the home directory. If it is `AbortError`, the current implementation will silently return at `components/forms/JoinBurnIndexForm.tsx:120` and the actionable message at `components/forms/JoinBurnIndexForm.tsx:122-124` will never render. That is the only cell-level issue I found that can block the seven-cell Happy Path.

Second priority: run the Cell #7 IDB failure check exactly as written, because the static state split is correct but the visible render timing should still be observed. Third priority: run the a11y check from `tasks/folder-picker-ux/criteria.md:19`, especially the `<kbd>⌘⇧·</kbd>` announcement. Finally, keep the rollback procedure framed as `env=false + redeploy`; `NEXT_PUBLIC_AUTO_DETECT_DEFAULT` is not a live runtime kill switch once the client bundle is built.

exec
/bin/zsh -lc "sed -n '1,260p' tasks/folder-picker-ux/codex-phase7.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
Reading additional input from stdin...
OpenAI Codex v0.128.0 (research preview)
--------
workdir: /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR, /Users/dg-2412-pn-002/.codex/memories]
reasoning effort: none
reasoning summaries: none
session id: 019e4d51-5f68-76b1-8eb3-4845822d8cf2
--------
user
You are doing adversarial cross-model review (Claude -> Codex) for a small UX patch.

Read these files in the current directory and respond with the verdict + Q1-Q5 answers requested in section 4:

1. tasks/folder-picker-ux/codex-phase7-findings.md (this is the input - start here)
2. tasks/folder-picker-ux/codex-phase6.md (prior Phase 6 verdict context - read selectively)
3. components/forms/JoinBurnIndexForm.tsx (focus L390-440 hint area)
4. app/globals.css (focus L1995-2056 path-preview-card block)

Output format (markdown):

## Verdict
PASS / needs-attention(HIGH·MEDIUM list) / nit-only

## Q1-Q5 Answers
Q1 (visual hierarchy 13px kbd vs 13px row): ...
Q2 (kbd-label SR naturalness vs aria-label): ...
Q3 (option 1 vs option 2 + recommended default): ...
Q4 (~ symbol vs "home folder" microcopy redundancy): ...
Q5 (WCAG AA recalc items: fg3 on bg contrast): ...

## Defects / Mitigations
HIGH/MEDIUM/LOW findings with concrete fix proposals.

## Additional Blind Spots
Free-form: kbd a11y beyond Q2, microcopy issues, font shift side effects, letter-spacing rendering edge cases, etc.

Be concise - aim for <800 words total. No code generation; only verdict + analysis.
codex
I’ll inspect the review input first, then cross-check the form hint markup and CSS block so the verdict is grounded in the actual patch.
exec
/bin/zsh -lc "nl -ba components/forms/JoinBurnIndexForm.tsx | sed -n '360,470p'" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
exec
/bin/zsh -lc "sed -n '1,240p' tasks/folder-picker-ux/codex-phase7-findings.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
exec
/bin/zsh -lc "nl -ba app/globals.css | sed -n '1970,2085p'" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
exec
/bin/zsh -lc "sed -n '1,220p' tasks/folder-picker-ux/codex-phase6.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
  1970	/* FinalCTA */
  1971	.final-cta { background: #FFFFFF; }
  1972	.final-cta-inner {
  1973	  max-width: 640px; margin: 0 auto; padding: 0 var(--gutter);
  1974	  text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px;
  1975	}
  1976	.final-cta-headline { font-size: clamp(28px, 3.5vw, 40px); font-weight: 600; letter-spacing: -0.025em; color: var(--fg); margin: 0; }
  1977	.final-cta-sub { font-size: 16px; color: var(--fg2); line-height: 1.6; margin: 0; }
  1978	.final-cta-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  1979	.final-cta-note { font-size: 12px; color: var(--fg3); margin: 0; }
  1980	
  1981	/* ============================================================
  1982	   Responsive additions
  1983	   ============================================================ */
  1984	@media (max-width: 920px) {
  1985	  .challenge-layout { grid-template-columns: 1fr; }
  1986	  .drops-grid { grid-template-columns: 1fr; }
  1987	  .footer-inner { grid-template-columns: 1fr; gap: 32px; }
  1988	  .footer-links { grid-template-columns: repeat(2, 1fr); }
  1989	  .hero-inner { grid-template-columns: 1fr; gap: 40px; }
  1990	  .hero-right { order: -1; }
  1991	  .builders-layout { grid-template-columns: 1fr; }
  1992	  .lb-v3 .lb-head, .lb-v3 .lb-row {
  1993	    grid-template-columns: 28px 1fr 100px 60px;
  1994	    gap: 8px; padding: 0 12px;
  1995	  }
  1996	  .lb-col-tokens, .lb-col-fixes, .lb-col-trend, .lb-col-spark { display: none; }
  1997	}
  1998	
  1999	/* ============================================================
  2000	   Form — Path Preview Card + non-fatal warning
  2001	   (folder-picker-ux 2026-05-21: Approach B discoverability)
  2002	   ============================================================ */
  2003	.path-preview-card {
  2004	  background: var(--bg);
  2005	  border: 1px solid var(--border);
  2006	  border-radius: var(--r-card);
  2007	  padding: 12px;
  2008	  display: flex;
  2009	  flex-direction: column;
  2010	  gap: 6px;
  2011	  margin-bottom: 12px;
  2012	}
  2013	.path-preview-row {
  2014	  font-family: var(--font-mono);
  2015	  font-size: 13px;
  2016	  color: var(--fg2);
  2017	  display: flex;
  2018	  align-items: center;
  2019	  gap: 2px;
  2020	}
  2021	.path-segment {
  2022	  display: inline;
  2023	  color: var(--fg2);
  2024	}
  2025	.path-segment--hidden {
  2026	  outline: 1px solid var(--young-coconut-dark);
  2027	  border-radius: 2px;
  2028	  padding: 0 4px;
  2029	  margin: 0 1px;
  2030	}
  2031	.path-preview-hint {
  2032	  font-family: var(--font-ui);
  2033	  font-size: 12px;
  2034	  color: var(--fg2);
  2035	  margin: 4px 0 0;
  2036	  line-height: 1.4;
  2037	}
  2038	.path-preview-hint kbd {
  2039	  font-family: var(--font-mono);
  2040	  font-size: 11px;
  2041	  padding: 1px 5px;
  2042	  background: var(--surface-muted);
  2043	  border: 1px solid var(--border);
  2044	  border-radius: 3px;
  2045	  color: var(--fg);
  2046	}
  2047	.form-warning {
  2048	  font-family: var(--font-ui);
  2049	  font-size: 13px;
  2050	  color: var(--fg2);
  2051	  background: var(--young-coconut-soft);
  2052	  padding: 8px 12px;
  2053	  border-radius: var(--r-card);
  2054	  margin: 8px 0;
  2055	  line-height: 1.4;
  2056	}

 succeeded in 0ms:
   360	        .json()
   361	        .catch(() => ({}));
   362	      if (!res.ok) {
   363	        setError(data.error ?? "Could not add to the Burn Index. Try again.");
   364	        return;
   365	      }
   366	      if (data.entries) onImport?.(data.entries);
   367	      onSuccess?.(`Burn Summary validated — ${trimmed} added to the Burn Index.`);
   368	    } catch {
   369	      setError("Could not reach the server. Check your connection and retry.");
   370	    } finally {
   371	      setSubmitting(false);
   372	    }
   373	  }
   374	
   375	  // ── FSA render path (auto-detect=1 + showDirectoryPicker available) ───────
   376	
   377	  // Show post-upload survey after a successful FSA upload.
   378	  if (autoDetect && showSurvey && uploadTimeBucket) {
   379	    return (
   380	      <PostUploadSurvey
   381	        setupTimeBucket={uploadTimeBucket}
   382	        onDone={() => {
   383	          setShowSurvey(false);
   384	          onSuccess?.(`Burn Summary validated — ${fsaHandle.trim()} added to the Burn Index.`);
   385	        }}
   386	      />
   387	    );
   388	  }
   389	
   390	  if (autoDetect) {
   391	    return (
   392	      <div className="form-card">
   393	        <h3 className="form-title">Auto-detect Burn Summary</h3>
   394	        <p className="form-desc">
   395	          Point this page at your{" "}
   396	          <code className="form-code-inline">.claude/projects</code> and{" "}
   397	          <code className="form-code-inline">.codex/sessions</code> folders.
   398	          Token counts are aggregated locally — only the 9 anonymised fields
   399	          join the Burn Index.
   400	        </p>
   401	
   402	        <div className="form-step">
   403	          <div className="form-step-label">Step 1 · Select folders</div>
   404	          <div className="form-step-desc">
   405	            Pick the exact folder previewed below. Drill into hidden directories with the OS shortcut shown.
   406	          </div>
   407	          <div className="path-preview-card">
   408	            <div className="path-preview-row">
   409	              <span className="path-segment">~</span>
   410	              <span>/</span>
   411	              <span className="path-segment path-segment--hidden">.claude</span>
   412	              <span>/</span>
   413	              <span className="path-segment">projects</span>
   414	            </div>
   415	            <div className="path-preview-row">
   416	              <span className="path-segment">~</span>
   417	              <span>/</span>
   418	              <span className="path-segment path-segment--hidden">.codex</span>
   419	              <span>/</span>
   420	              <span className="path-segment">sessions</span>
   421	            </div>
   422	            <p className="path-preview-hint">
   423	              Hidden folders need: <kbd>⌘⇧.</kbd> (macOS) or <kbd>Ctrl+H</kbd> (Linux) in your file manager
   424	            </p>
   425	          </div>
   426	          <div className="form-fsa-pickers">
   427	            <button
   428	              type="button"
   429	              className={`form-fsa-picker${claudeHandle ? " form-fsa-picker--selected" : ""}`}
   430	              onClick={() => pickFolder("claude")}
   431	            >
   432	              {claudeHandle ? `✓ ${claudeHandle.name}` : "Select .claude/projects folder"}
   433	            </button>
   434	            <button
   435	              type="button"
   436	              className={`form-fsa-picker${codexHandle ? " form-fsa-picker--selected" : ""}`}
   437	              onClick={() => pickFolder("codex")}
   438	            >
   439	              {codexHandle ? `✓ ${codexHandle.name}` : "Select .codex/sessions folder"}
   440	            </button>
   441	          </div>
   442	        </div>
   443	
   444	        <div className="form-step">
   445	          <div className="form-step-label">Step 2 · Choose period</div>
   446	          <div className="form-fsa-period-row">
   447	            {(["day", "week", "month", "year", "all"] as const).map((p) => (
   448	              <button
   449	                key={p}
   450	                type="button"
   451	                className={`form-fsa-period-btn${fsaPeriod === p ? " form-fsa-period-btn--active" : ""}`}
   452	                onClick={() => setFsaPeriod(p)}
   453	              >
   454	                {p}
   455	              </button>
   456	            ))}
   457	          </div>
   458	        </div>
   459	
   460	        {fsaError && <p className="form-error">{fsaError}</p>}
   461	        {fsaWarning && <p className="form-warning">{fsaWarning}</p>}
   462	
   463	        <Button
   464	          variant="primary"
   465	          size="lg"
   466	          type="button"
   467	          onClick={handleFsaScan}
   468	          disabled={fsaLoading || (!claudeHandle && !codexHandle)}
   469	        >
   470	          {fsaLoading ? "Scanning…" : "Scan & preview"}

 succeeded in 0ms:
# Codex Phase 7 — Findings 2/3 적대적 검토 인풋

**Date**: 2026-05-22
**Cycle**: Phase 7.5 (UX Findings 2+3 patch, Finding 1 별 사이클)
**Verdict 요청**: PASS / needs-attention(HIGH·MEDIUM) / nit-only
**기존 산출물**:

codex
The first pass confirms Phase 6 is explicitly `needs-attention`, and the supplied git range only lists two path-touching commits (`b94d362`, `40cd00c`). I’m now checking the owner-cell count and the final B3 state because Q1 hinges on whether the decision-log’s “12+” and “4 commits” claims are materially overcounted.
exec
/bin/zsh -lc "sed -n '1,260p' tasks/folder-picker-ux/smoke-golden-regression.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
# Smoke Golden Regression — Folder Picker UX

**Date**: 2026-05-21 (Phase 6 진행 중)
**Owner**: scw0526 (chongwon83)
**Recording rule**: Owner 직접 Chrome incognito 진입 → 7 cells 손으로 ✅/❌ 기록. **자동 append 금지** (`[auto]` prefix 또는 subagent 서명 검출 시 "완료" 차단).

**2026-05-22 Contingency Patch 반영**: Codex Phase 6 CONCERN 확인 — Cell #2 실측 결과 `e.name="AbortError"` (code 20), `SecurityError` 아님. `JoinBurnIndexForm.tsx:126-134` count-based heuristic 도입 — 2회 연속 AbortError 시 `fsaWarning` (yellow, non-fatal) 노출. Cell #2/#5 기대 결과 갱신. Invariant #4 (e.name only) 유지.

---

## Phase 6 Cells (Chrome 최신 incognito + production deployment)

| # | 입력 | 기대 결과 | 결과 | 시각 / 메모 |
|---|------|----------|------|-------------|
| 1 | `https://www.coconutlabs.xyz/` 진입, Path Preview Card 시각 확인 | `~/.claude/projects` + `~/.codex/sessions` 두 row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux) | ✅ owner localhost | 2026-05-22 owner-direct on `localhost:3000/?auto-detect=1` (production redeploy 후 재실측 별도). 스크린샷: `issues/스크린샷 2026-05-22 오전 12.33.04.png`. 두 row + hint 모두 가시 |
| 2 | "Pick .claude/projects" 클릭 → 홈 디렉터리(`~`) 선택 → Chrome dialog "다른 폴더 선택" 또는 "취소" 클릭 → 다시 "Pick .claude/projects" 클릭 → 홈 디렉터리 다시 선택 → 두 번째 거절 | **1차 시도**: silent (메시지 무노출, abortCount=1) / **2차 시도**: yellow `fsaWarning` 노출 — "Trouble picking the folder? Chrome blocks system folders like your home directory — drill into ~/.claude/projects (or ~/.codex/sessions) specifically." Korean Chrome dialog 떠도 우리 UI 메시지는 영어 동일. **Scan 버튼 enabled 유지** (fsaWarning은 non-fatal, fsaError 아님) | ✅ owner localhost | 2026-05-22 owner-direct: "1차에서는 아무것도 안 뜨고, 2차에서는 연두색 바탕 안에 [정확한 텍스트 일치]". Scan 버튼 enabled 유지 확인. 스크린샷: `issues/스크린샷 2026-05-22 오전 12.33.04.png` |
| 3 | 다시 클릭 → `~/.claude` 자체 선택 → Chrome 권한 팝업 "허용" | Name mismatch 메시지에 `{h.name}` 동적 노출 — `You picked ".claude". We need the directory literally named "projects" (inside ~/.claude/ or ~/.codex/). Try again.` | ✅ owner localhost | 2026-05-22 owner-direct (Cell #3 페이지 reload 후 fresh state): 정확 텍스트 일치 / `.claude` 동적 표기 ✅ / `projects` 정확 노출 ✅ / hint 글리프 `⌘⇧.` 정상 (typo fix HMR 반영). 스크린샷 `issues/스크린샷 2026-05-22 오전 12.42.51.png` |
| 4 | 다시 클릭 → `~/.claude/projects` 선택 | Error 0건, 핸들 저장, 다음 step 진행 | ✅ owner localhost | 2026-05-22 owner-direct: `Pick .claude/projects` 버튼 텍스트가 `✓ projects` 로 변경 + 강조 상태 / fsaError 클리어 ✅ / fsaWarning 클리어 ✅ / `Scan & preview` 버튼 enabled 유지 ✅ / Step 2 timeframe row 진행 노출. 스크린샷: `issues/스크린샷 2026-05-22 오전 12.46.29.png` |
| 5 | 다시 클릭 → 시스템 dialog에서 cancel (1회) | Silent (form-error/warning 미노출, 카드 그대로). **전제**: Cell #4 성공 후 abortCount 0 리셋된 상태. Cell #4 미실행 시 직전 누적 카운트에 따라 fsaWarning 노출 가능 — 그 경우도 Cell #2 contract와 정합 | ✅ owner localhost (variant: 2회 cancel) | 2026-05-22 owner-direct: 2회 cancel 입력 → count cycle 검증 PASS. Cell #4 success로 `abortCountRef`가 0 리셋된 상태에서 0→1 (silent) → 1→2 (fsaWarning 노출, 정확 텍스트 일치) 흐름 재현. count-based heuristic post-reset 동작 확인. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.53.44.png`. **변형 사유**: 1회 cancel→silent 검증은 Cell #2 1차 + Cell #5 0→1 transition으로 이미 evidence 확보. 2회 cancel은 reset 후 cycle 재검증으로 더 강한 contract 확인 |
| 6 | Safari로 동일 URL 진입 | "Join Burn Index" 수동 폼 fallback. Path Preview Card 미표시(auto-detect off) | ✅ owner localhost | 2026-05-22 owner-direct Safari: "Join Burn Index" 모달 노출 / STEP 1 RUN THE COLLECTOR (Python 3.11+ instructions + git clone snippet + Copy button) / STEP 2 UPLOAD YOUR BURN SUMMARY (handle input + file picker + JSON paste textarea + `Validate & preview` 버튼) / Path Preview Card 미표시 ✅ / Pick .claude/projects / .codex/sessions 버튼 미표시 ✅ / `⌘⇧.` hint 미표시 ✅. `"showDirectoryPicker" in window` 분기 (line 67-73) 정상 동작. 스크린샷 `issues/스크린샷 2026-05-22 오전 1.01.40.png` |
| 7 | (v2 신규) Chrome DevTools > Application > Storage > Clear site data → IndexedDB throttle/block 시뮬레이션 후 `~/.claude/projects` 선택 | Handle UI에 `✓ projects` 표시 (claudeHandle React state set), `fsaError` 비어 있음, `fsaWarning`에 "Folder selected for this session, but it could not be remembered" 노출. Scan 버튼 enabled. 새로고침 후 handle 재선택 필요 (정상). 직접 시뮬레이션 불가 시 saveHandle 임시 throw로 대체 검사 (코드 검사 갈음) | ✅ owner 승인 코드 검사 | 2026-05-22 owner-direct decision (옵션 A 선택). `JoinBurnIndexForm.tsx:164-182` 4단계 분리 구조 검증: ① L167-168 `setFsaError("")` + `setFsaWarning("")` 클리어 / ② L170-171 `setClaudeHandle(h)` / `setCodexHandle(h)` **saveHandle 호출 BEFORE handle state 세팅** (Invariant #5 핵심) / ③ L176-177 `try { await saveHandle(kind, h) }` IDB persistence best-effort / ④ L178-182 catch에서 `setFsaWarning("Folder selected for this session, but it could not be remembered. You'll need to pick it again next time.")` 노출 + fsaError 미터치로 Scan 버튼 enabled 유지. **Invariant #5 (handle React state ↔ IDB persistence 분리) 코드 레벨 PASS** |

---

## Phase 7 Production 재실행 (cells #1, #4 — 2/2 필수)

**Deploy 상태**: ✅ Vercel commit `6cda4c5` deployment 완료 (2026-05-22, gh api 확인 — `https://vercel.com/chongwon-shins-projects/coconutlabs/9zFwEtq2UE3436K9m6ZrnNQX7Zyw`).

**Production secret leak 재검증 메모**: `curl https://www.coconutlabs.xyz/_next/static/chunks/*.js`는 Vercel Bot Challenge (`x-vercel-mitigated: challenge`, 403)로 차단됨. **Local build verification (`grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0)이 Phase 7 commit 직전에 PASS**한 상태로 동일 source가 Vercel build pipeline 통과 → derivatively verified.

**2026-05-22 Claude-in-Chrome 보조 검증 (Option B 하이브리드)** — Bot Challenge를 same-origin browser fetch로 우회해 **production main chunks 8개 전수 검사 = COLLECTOR_HMAC_SECRET 0건 (총 707KB 검사)**. Path Preview Card 마크업도 같은 세션에서 검증 완료 (2 rows + 2 hidden segments + hint + kbds 정확 일치). 상세: `phase7-auxiliary-verification.md`. **단 owner-direct manual record는 여전히 의무** — 본 표 cells #1/#4는 owner incognito 직접 실행 후 손으로 기록 (1-2분 축약 가능).

| # | 결과 | 메모 |
|---|------|------|
| 1 (production redeploy 후) | ⏳ owner-direct | Chrome 최신 + incognito + `https://www.coconutlabs.xyz/?auto-detect=1` 진입. Path Preview Card 2 row + hint 노출 확인 후 본 표 1줄 직접 기록 >> 둘 다 잘 보임 |
| 4 (production redeploy 후) | ⏳ owner-direct | `~/.claude/projects` 선택 → `✓ projects` 버튼 + fsaError/fsaWarning 0 + Scan 버튼 enabled 확인 후 본 표 1줄 직접 기록 >> 둘 다 잘 보임 |

---

## Phase 7.5 Production 재실측 (Findings 2+3 patch, cell 1/1 필수)

**Deploy 상태**: ✅ Vercel commit `b94d362` deployment 완료 (2026-05-22T01:46:39Z, GitHub combined status `success` — `https://vercel.com/chongwon-shins-projects/coconutlabs/3kKrsZNWTyZpr8TzozqVvWPmwPeR`).

**2026-05-22 Claude-in-Chrome 보조 검증** (Option B 하이브리드, `phase7.5-auxiliary-verification.md` 형식):
- production HTML + computed styles 실측: kbd 13px / `letter-spacing 0.5px` / `padding 2px 7px` / aria-label `Command Shift Period`·`Control H` / `(period)` 라벨 `aria-hidden=true` 11px Inter `--fg2` / `<code>` 3개 (`~`, `.claude/projects`, `.codex/sessions`) JetBrains Mono — **3/3 마크업 PASS**
- WCAG AA: kbd `18.97:1` / label `7.81:1` / hint `7.81:1` / code `7.81:1` — **4/4 contrast PASS** (Edit 2 v2 `--fg3→--fg2` 회복 확인)
- production main chunks 5개 (총 394 KB) 전수 grep `COLLECTOR_HMAC_SECRET` = **0 hits** — Invariant #1 PASS

**owner-direct manual record는 여전히 의무** — 본 표 cell은 owner incognito 직접 실행 후 손으로 기록 (1-2분 축약 가능, harness-loop "auto-append 금지" 게이트 유지).

| # | 결과 | 메모 |
|---|------|------|
| 7.5 (kbd 시인성 + home folder + aria-label) | ⏳ owner-direct | Chrome 최신 + incognito + `https://www.coconutlabs.xyz/?auto-detect=1` 진입 → Hero "Join Burn Index" 클릭 → 모달 오픈 → ① `⌘⇧.` kbd 13px 가독 + `.`이 마침표가 아닌 키 라벨로 인지 ② `(period)` 라벨 명시 노출 ③ "From your home folder (~), open .claude/projects or .codex/sessions" 안내 노출 ④ (선택) VoiceOver(Cmd+F5)로 hint Tab → "Command Shift Period" / "Control H" 발음 확인 (Codex Q6 follow-up). 본 표 1줄 직접 기록 |

---

## 중단 조건

**7 cells** 중 1개라도 ❌ → Phase 5.x로 회귀 (Edit 재실행). 또는 invariant #1~5 위반 시 즉시 롤백. (v2: cell #7 + invariant #5 추가, 2026-05-21 Codex Phase 1 PARTIAL 반영)

---

## Phase 6 최종 결과 (2026-05-22)

**7/7 cells PASS** (owner-direct 6 cells + 코드 검사 1 cell)

| # | 결과 | 방식 |
|---|------|------|
| 1 | ✅ | owner localhost (스크린샷 12.33.04) |
| 2 | ✅ | owner localhost (스크린샷 12.33.04) — Codex CONCERN AbortError 확인 + Contingency Patch v2 PASS |
| 3 | ✅ | owner localhost (스크린샷 12.42.51) — typo fix `⌘⇧·` → `⌘⇧.` 함께 검증 |
| 4 | ✅ | owner localhost (스크린샷 12.46.29) — `✓ projects` 핸들 저장 |
| 5 | ✅ | owner localhost (스크린샷 12.53.44, variant 2회 cancel) — count cycle 검증 |
| 6 | ✅ | owner localhost Safari (스크린샷 01.01.40) — fallback 정확 노출 |
| 7 | ✅ | owner-direct decision 코드 검사 — Invariant #5 PASS |

**중단 사유 없음. Phase 7 (production deploy + 30min monitoring) 진입 가능.**

잔여 의무: Phase 7에서 cells #1, #4 production deployment 재실행 (smoke-golden-regression.md "Phase 7 Production 재실행" 섹션).

exec
/bin/zsh -lc 'rg -n "Verdict|verdict|PASS|needs-attention|PARTIAL|partial|nit-only|HIGH|MEDIUM|Response|Codex" tasks/folder-picker-ux/codex-phase1.md tasks/folder-picker-ux/codex-phase6.md tasks/folder-picker-ux/codex-phase7.md tasks/folder-picker-ux/codex-phase7-findings.md tasks/folder-picker-ux/phase7.5-auxiliary-verification.md' in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
tasks/folder-picker-ux/codex-phase1.md:1:# Codex Phase 1 — Adversarial Review Input Doc
tasks/folder-picker-ux/codex-phase1.md:5:**Owner action**: 별 세션에서 `/codex` 실행 후 본 문서 전체 + 아래 §변경 surface 명세 + §JoinBurnIndexForm.tsx 발췌를 입력으로 전달. Codex 응답 전문을 본 파일 하단 §Response 섹션에 추가.
tasks/folder-picker-ux/codex-phase1.md:7:**Pass condition**: Codex HIGH/MEDIUM 결함 0건 (nit-only). HIGH/MEDIUM 발견 시 Plan v2 작성 후 재실행 (Phase 2 차단).
tasks/folder-picker-ux/codex-phase1.md:61:3/3 → Codex 교차 리뷰 **강력 권장 + Design review 의무** (본 plan에 포함).
tasks/folder-picker-ux/codex-phase1.md:67:본 작업 입안 중 owner 본인이 발견한 사전 우려. Codex가 이 항목을 다시 검증하거나 추가 결함 식별 요청.
tasks/folder-picker-ux/codex-phase1.md:69:### P-1. WCAG AA contrast (HIGH 후보 — owner 직접 확인)
tasks/folder-picker-ux/codex-phase1.md:82:### P-2. macOS glyph fallback (Codex Q2)
tasks/folder-picker-ux/codex-phase1.md:92:## §4. Codex Challenge Questions (7개)
tasks/folder-picker-ux/codex-phase1.md:138:    else setCodexHandle(h);
tasks/folder-picker-ux/codex-phase1.md:201:## §Response (Codex output — owner 입력)
tasks/folder-picker-ux/codex-phase1.md:203:Codex Adversarial Review
tasks/folder-picker-ux/codex-phase1.md:206:  Verdict: needs-attention
tasks/folder-picker-ux/codex-phase7-findings.md:1:# Codex Phase 7 — Findings 2/3 적대적 검토 인풋
tasks/folder-picker-ux/codex-phase7-findings.md:5:**Verdict 요청**: PASS / needs-attention(HIGH·MEDIUM) / nit-only
tasks/folder-picker-ux/codex-phase7-findings.md:8:- `codex-phase6.md` — Phase 6 verdict: needs-attention (Cell #2 AbortError CONCERN → Contingency Patch v2 PASS)
tasks/folder-picker-ux/codex-phase7-findings.md:9:- `phase7-auxiliary-verification.md` — Claude-in-Chrome 보조 검증 PASS (production main chunks 8개 × 0 secret hits)
tasks/folder-picker-ux/codex-phase7-findings.md:16:- **Invariant 5/5 PASS** — 머지 차단 사유 없음
tasks/folder-picker-ux/codex-phase7-findings.md:21:  5. Handle ↔ IDB 분리 PASS (코드 검사)
tasks/folder-picker-ux/codex-phase7-findings.md:87:- WCAG AA: `--fg` (`#0a0a0a`) on `--surface-muted` (`#fafafa`) = **20.4:1** (이미 PASS, font-size 변경은 contrast 무관)
tasks/folder-picker-ux/codex-phase7-findings.md:165:`<span className="kbd-label">(period)</span>`이 VoiceOver/NVDA에서 자연스럽게 읽히는가? 또는 `<kbd>` 자체에 `aria-label="period key"`가 더 적절한가? 현재 hint `<kbd>⌘⇧.</kbd>`는 screen reader가 "command shift period"로 읽지 못할 수 있음 (Codex Phase 6 Q6 미해결 잔존).
tasks/folder-picker-ux/codex-phase7-findings.md:188:1. **Verdict**: PASS / needs-attention / nit-only
tasks/folder-picker-ux/codex-phase7-findings.md:191:4. **HIGH/MEDIUM 결함이 있다면 mitigation 제안**
tasks/folder-picker-ux/codex-phase7-findings.md:194:PASS 또는 nit-only → Phase 7.5.2 (3 Edits 적용) 진입.
tasks/folder-picker-ux/codex-phase7-findings.md:195:HIGH/MEDIUM ≥ 1건 → patch v2 발산 후 본 파일 재실행 (재시도 1회 한).
tasks/folder-picker-ux/codex-phase7-findings.md:199:## 6. Patch v2 (Codex Phase 7.5.1 verdict 반영, 2026-05-22)
tasks/folder-picker-ux/codex-phase7-findings.md:201:**v1 verdict (`codex-phase7.md`)**: needs-attention(MEDIUM ×2, LOW ×1). 본 섹션은 v2 발산 — 재실행 1회 한도 사용 (plan 7.5.1).
tasks/folder-picker-ux/codex-phase7-findings.md:203:### Codex v1 결함 요약
tasks/folder-picker-ux/codex-phase7-findings.md:207:| **MEDIUM** | `.kbd-label` color `var(--fg3)` WCAG AA 미달 (`#8E8E8E` on `#FFFFFF` = 3.28:1 / on `#FAFAFA` = 3.14:1, < 4.5:1) | §3 신규 클래스 | `--fg3` → `--fg2` (7.81:1 PASS) |
tasks/folder-picker-ux/codex-phase7-findings.md:208:| **MEDIUM** | `<span>(period)</span>`만으로 SR shortcut pronunciation 보장 X (`⌘⇧.`을 "command shift period"로 안 읽을 수 있음) | §3 안 ① JSX | macOS `<kbd>` `aria-label="Command Shift Period"` + `(period)` span `aria-hidden="true"` |
tasks/folder-picker-ux/codex-phase7-findings.md:227:> codex Q1 PASS — 13px ≡ row 사이즈 이슈 없음 (keycap 스타일 + actionable shortcut). Q5 PASS — `--fg`(`#0A0A0A`) on `--surface-muted`(`#FAFAFA`) = 18.97:1 (codex node 계산 검증).
tasks/folder-picker-ux/codex-phase7-findings.md:235:  color: var(--fg2);  /* v1: var(--fg3) — WCAG AA 미달 (3.28:1) / v2: var(--fg2) (7.81:1 PASS) */
tasks/folder-picker-ux/codex-phase7-findings.md:254:1. **MEDIUM mitigation #1** (SR pronunciation): `<kbd>` 양쪽에 `aria-label` 부여. `⌘⇧.` → "Command Shift Period", `Ctrl+H` → "Control H". `(period)` span에 `aria-hidden="true"`로 SR 중복 announcement 차단
tasks/folder-picker-ux/codex-phase7-findings.md:292:`globals.css`에 `code` 디폴트 스타일이 정의되어 있는가? 정의되어 있다면 `--fg` / `--bg` contrast PASS인지 확인 요청. 미정의 시 브라우저 user-agent default(monospace, no background) 사용 — body의 `--fg` on `--bg` 18.97:1 inherit.
tasks/folder-picker-ux/codex-phase7-findings.md:302:### v2 verdict 요청
tasks/folder-picker-ux/codex-phase7-findings.md:304:1. **Verdict**: PASS / nit-only / needs-attention
tasks/folder-picker-ux/codex-phase7-findings.md:305:2. **MEDIUM 결함 완전 해소** 여부 (contrast + SR pronunciation)
tasks/folder-picker-ux/codex-phase7-findings.md:310:v2 nit-only / PASS → 7.5.2 (3 Edits 적용 + Edit 4 codex 권장 시 추가) 진입.
tasks/folder-picker-ux/codex-phase7-findings.md:311:v2도 MEDIUM 잔존 → 재시도 한도(1회) 소진 → 본 Phase 7.5 보류 + Findings 2/3을 Phase 8 별 사이클로 이관 (plan 7.5 중단 조건).
tasks/folder-picker-ux/codex-phase7-findings.md:315:## 7. Codex v2 verdict (2026-05-22, captured `/tmp/codex-phase7-v2.txt`)
tasks/folder-picker-ux/codex-phase7-findings.md:317:**Verdict: nit-only** — 7.5.2 진입 게이트 PASS.
tasks/folder-picker-ux/codex-phase7-findings.md:320:- **MEDIUM contrast 해소**: `.kbd-label` `color: var(--fg2)` → `#525252` on `#FFFFFF` = 7.81:1 / on `#FAFAFA` = 7.49:1 (둘 다 AA PASS, codex node 계산 검증)
tasks/folder-picker-ux/codex-phase7-findings.md:321:- **MEDIUM SR pronunciation 정적 해소**: `<kbd aria-label="Command Shift Period">` + `<span aria-hidden="true">(period)</span>` 조합. 최종 발음은 owner 7.5.5 SR smoke로 확인 (런타임 영역으로 분리)
tasks/folder-picker-ux/codex-phase7-findings.md:328:- **Qv2-1** (`<code>` contrast): 전역 `code { … }` 디폴트 스타일 없음. `<code>`는 `.path-preview-hint`의 `color: var(--fg2)` 상속 → 7.81:1 PASS. typography 일관성 nit로 `.path-preview-hint code { font-family: var(--font-mono); color: inherit; }` 추가 권장 — **본 Patch v2에 nit 흡수**
tasks/folder-picker-ux/codex-phase7-findings.md:336:### Codex v2 nit
tasks/folder-picker-ux/codex-phase7-findings.md:337:- v2 설명에 "기존 globals.css에 code default style 적용" 표현이 실제와 불일치 (전역 `code` 스타일 없음). contrast 결함 아니라 merge blocker 아님. **본 verdict 섹션에서 정정**: `<code>`는 `.path-preview-hint`의 `--fg2` 상속으로 contrast PASS, 디폴트 스타일이 아닌 cascade에 의존
tasks/folder-picker-ux/codex-phase7-findings.md:340:재시도 한도(1회) 사용 완료. v2 nit-only verdict + Edit 4 권장 + nit 흡수 → **7.5.2 진입 (Edit 1+2+3+4+nit 5종 적용)**.
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:18:## 검증 결과 (3/3 PASS)
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:54:**Invariant #2 production 직접 검증 PASS** (Edit 2 v2 — `--fg3 #8E8E8E` → `--fg2 #525252` 변경으로 AA 충족 회복).
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:69:**Invariant #1 production 직접 검증 PASS** (Bot Challenge same-origin fetch 우회 동일 절차, `phase7-auxiliary-verification.md` 형식 차용). Phase 7 (`6cda4c5`) 707,406 B / 8 chunks → Phase 7.5 (`b94d362`) 394,084 B / 5 chunks — Next.js Turbopack chunk 재구성 결과 (코드 변경량 대비 자연스러운 변동).
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:94:3. (선택) VoiceOver(Cmd+F5) → hint 영역 Tab → "Command Shift Period" / "Control H" 또박또박 발음 확인 (Codex Q6 follow-up)
tasks/folder-picker-ux/codex-phase6.md:1:# Codex Phase 6 Static Review
tasks/folder-picker-ux/codex-phase6.md:4:**Verdict**: needs-attention
tasks/folder-picker-ux/codex-phase6.md:8:1. Cell #1 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:13` expects `~/.claude/projects` + `~/.codex/sessions` two row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux). The auto-detect branch renders the Path Preview Card before the picker buttons: `.claude / projects` is rendered at `components/forms/JoinBurnIndexForm.tsx:392-399`, `.codex / sessions` at `components/forms/JoinBurnIndexForm.tsx:400-406`, and the hint text with two `<kbd>` labels at `components/forms/JoinBurnIndexForm.tsx:407-409`. The new CSS selectors exist for the card and warning surface: `.path-preview-card` at `app/globals.css:2003-2012`, `.path-preview-row` at `app/globals.css:2013-2020`, `.path-segment` at `app/globals.css:2021-2024`, `.path-segment--hidden` at `app/globals.css:2025-2030`, `.path-preview-hint` at `app/globals.css:2031-2037`, `.path-preview-hint kbd` at `app/globals.css:2038-2046`, and `.form-warning` at `app/globals.css:2047-2056`.
tasks/folder-picker-ux/codex-phase6.md:12:3. Cell #3 — PASS. `tasks/folder-picker-ux/criteria.md:18` requires the actual selected folder name, and `tasks/folder-picker-ux/smoke-golden-regression.md:15` expects Name mismatch 메시지에 `**{h.name}**` 동적 노출 ("You picked **.claude**. We need **projects**…"). The implementation computes `expectedName` at `components/forms/JoinBurnIndexForm.tsx:142`, compares `h.name` at `components/forms/JoinBurnIndexForm.tsx:143`, and interpolates both `h.name` and `expectedName` in the error at `components/forms/JoinBurnIndexForm.tsx:144-146`.
tasks/folder-picker-ux/codex-phase6.md:14:4. Cell #4 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:16` expects Error 0건, 핸들 저장, 다음 step 진행. The Phase 5 split satisfies Invariant #5 from `tasks/folder-picker-ux/criteria.md:41`: after name validation, the code clears `fsaError`/`fsaWarning` at `components/forms/JoinBurnIndexForm.tsx:153-154`, sets `claudeHandle` or `codexHandle` at `components/forms/JoinBurnIndexForm.tsx:155-156`, and only then enters the best-effort `saveHandle` try/catch at `components/forms/JoinBurnIndexForm.tsx:161-167`.
tasks/folder-picker-ux/codex-phase6.md:16:5. Cell #5 — PASS for the Phase 6 sequence, with a LOW stale-error note. `tasks/folder-picker-ux/criteria.md:16` requires `AbortError` 케이스에서 error 표시 0건 (사용자 cancel은 silent), and `tasks/folder-picker-ux/smoke-golden-regression.md:17` expects Silent (form-error 미노출, 카드 그대로). The picker catch returns immediately for `e.name === "AbortError"` at `components/forms/JoinBurnIndexForm.tsx:119-120`, so no new `fsaError` is created. In the smoke sequence, Cell #4 clears errors first at `components/forms/JoinBurnIndexForm.tsx:153`, so Cell #5 should display no error. Isolated caveat: if a user cancels immediately after a prior mismatch/security error, line `components/forms/JoinBurnIndexForm.tsx:120` does not clear the stale `fsaError`; that does not break the listed Cell #5 order but is a UX edge case.
tasks/folder-picker-ux/codex-phase6.md:18:6. Cell #6 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:18` expects Safari fallback with Path Preview Card hidden. `autoDetect` can only be true if the env/query condition is true and `typeof window !== "undefined"` and `"showDirectoryPicker" in window` are both true at `components/forms/JoinBurnIndexForm.tsx:68-73`. Browsers without `showDirectoryPicker` will skip the auto-detect branch that begins at `components/forms/JoinBurnIndexForm.tsx:375`.
tasks/folder-picker-ux/codex-phase6.md:20:7. Cell #7 — PASS. `tasks/folder-picker-ux/criteria.md:20` requires handle React state 유지 + scan 진행 가능 + `fsaWarning`만 노출 (`fsaError` 빈 상태), and `tasks/folder-picker-ux/smoke-golden-regression.md:19` expects `fsaWarning`에 "Folder selected for this session, but it could not be remembered" 노출. State is separated into `fsaError` and `fsaWarning` at `components/forms/JoinBurnIndexForm.tsx:80-84`; picker success clears both at `components/forms/JoinBurnIndexForm.tsx:153-154`; handle state is set at `components/forms/JoinBurnIndexForm.tsx:155-156`; `saveHandle` failure only sets `fsaWarning` at `components/forms/JoinBurnIndexForm.tsx:161-167`; JSX renders `fsaError` and `fsaWarning` separately at `components/forms/JoinBurnIndexForm.tsx:445-446`. The Scan button disabled prop is `fsaLoading || (!claudeHandle && !codexHandle)` at `components/forms/JoinBurnIndexForm.tsx:448-454`, with no gate on either `fsaError` or `fsaWarning`.
tasks/folder-picker-ux/codex-phase6.md:26:Q2 — Finding: `instanceof DOMException` is probably fine for Chrome proper, but fork behavior and sensitive-directory error naming require runtime verification. Severity: MEDIUM because it can affect Cell #2. The code only inspects `e.name` inside the `e instanceof DOMException` guard at `components/forms/JoinBurnIndexForm.tsx:119-133`; a non-DOMException object with `name: "SecurityError"` or `name: "AbortError"` would fall to the generic message at `components/forms/JoinBurnIndexForm.tsx:134-137`. MDN documents `AbortError` and `SecurityError` here as DOMException types for `showDirectoryPicker()` (MDN lines 235-243), so same-realm Chrome should satisfy the guard. I did not find static project evidence for Edge/Brave/Vivaldi-specific wrapping; that part is requires-runtime-verification. The larger static concern is not `instanceof`; it is that current FSA/Chromium references map too-sensitive directory selection to `AbortError`, while this implementation treats every `AbortError` as user cancel at `components/forms/JoinBurnIndexForm.tsx:120`.
tasks/folder-picker-ux/codex-phase6.md:28:Q3 — Finding: the system trusts the final folder name, not the parent path. Severity: MEDIUM privacy/false-import risk, not a Phase 6 Happy Path blocker. `pickFolder` validates only `h.name !== expectedName` at `components/forms/JoinBurnIndexForm.tsx:142-148`. `handleFsaScan` then sends the selected handles into `runImport` at `components/forms/JoinBurnIndexForm.tsx:202-208`, and `runImport` delegates to `buildEnvelope` at `lib/client/burn/import.ts:36-44`. Downstream walkers repeat only root-name allowlists: Claude rejects non-`projects` names at `lib/client/burn/parsers.ts:853-859`, and Codex rejects non-`sessions` names at `lib/client/burn/parsers.ts:897-902`. There is no validation that a `projects` handle is actually under `~/.claude/` or that a `sessions` handle is actually under `~/.codex/`. The blast radius is limited by exact-depth traversal and filename/schema filters at `lib/client/burn/parsers.ts:840-847`, `lib/client/burn/parsers.ts:861-879`, `lib/client/burn/parsers.ts:884-892`, and `lib/client/burn/parsers.ts:907-928`, but a user-selected random folder named `projects` or `sessions` can still be iterated if it matches those shapes.
tasks/folder-picker-ux/codex-phase6.md:30:Q4 — Finding: the kill-switch precedence is build-time, not hot runtime. Severity: LOW if the documented redeploy rollback is followed; MEDIUM if an operator expects a live config flip. The component reads `process.env.NEXT_PUBLIC_AUTO_DETECT_DEFAULT` at `components/forms/JoinBurnIndexForm.tsx:67`, then applies the false-overrides-query precedence at `components/forms/JoinBurnIndexForm.tsx:68-73`. Local Next docs state that bundled env access is replaced at build time at `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/env.md:53-64`, and that `NEXT_PUBLIC_` values are inlined and frozen after build at `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md:154-166`. The broader rollout docs already say rollback is `env=false + redeploy, ~34초` at `docs/decision/decision-log.md:341`, so the plan is coherent only if redeploy is part of the kill-switch operation.
tasks/folder-picker-ux/codex-phase6.md:34:Q6 — Finding: the `<kbd>` hint lacks an explicit screen-reader label. Severity: MEDIUM a11y risk, requires-runtime-verification. The semantic hint is plain text plus `<kbd>⌘⇧·</kbd>` and `<kbd>Ctrl+H</kbd>` at `components/forms/JoinBurnIndexForm.tsx:407-409`; CSS only changes visual styling at `app/globals.css:2038-2046`. There is no `aria-label`, visually hidden expansion, or alternate text such as "Command Shift Period" for the macOS glyph sequence. `tasks/folder-picker-ux/criteria.md:19` requires screen reader 인지 가능, so VoiceOver/NVDA pronunciation should be manually checked. Static code cannot prove whether VoiceOver announces the macOS shortcut usefully or as literal symbols.
tasks/folder-picker-ux/codex-phase7.md:2:OpenAI Codex v0.128.0 (research preview)
tasks/folder-picker-ux/codex-phase7.md:14:You are doing adversarial cross-model review (Claude -> Codex) for a small UX patch.
tasks/folder-picker-ux/codex-phase7.md:16:Read these files in the current directory and respond with the verdict + Q1-Q5 answers requested in section 4:
tasks/folder-picker-ux/codex-phase7.md:19:2. tasks/folder-picker-ux/codex-phase6.md (prior Phase 6 verdict context - read selectively)
tasks/folder-picker-ux/codex-phase7.md:25:## Verdict
tasks/folder-picker-ux/codex-phase7.md:26:PASS / needs-attention(HIGH·MEDIUM list) / nit-only
tasks/folder-picker-ux/codex-phase7.md:36:HIGH/MEDIUM/LOW findings with concrete fix proposals.
tasks/folder-picker-ux/codex-phase7.md:41:Be concise - aim for <800 words total. No code generation; only verdict + analysis.
tasks/folder-picker-ux/codex-phase7.md:43:I’ll inspect the review input first, then cross-check the form hint markup and CSS block so the verdict is grounded in the actual patch.
tasks/folder-picker-ux/codex-phase7.md:255:# Codex Phase 7 — Findings 2/3 적대적 검토 인풋
tasks/folder-picker-ux/codex-phase7.md:259:**Verdict 요청**: PASS / needs-attention(HIGH·MEDIUM) / nit-only
tasks/folder-picker-ux/codex-phase7.md:262:- `codex-phase6.md` — Phase 6 verdict: needs-attention (Cell #2 AbortError CONCERN → Contingency Patch v2 PASS)
tasks/folder-picker-ux/codex-phase7.md:263:- `phase7-auxiliary-verification.md` — Claude-in-Chrome 보조 검증 PASS (production main chunks 8개 × 0 secret hits)
tasks/folder-picker-ux/codex-phase7.md:270:- **Invariant 5/5 PASS** — 머지 차단 사유 없음
tasks/folder-picker-ux/codex-phase7.md:275:  5. Handle ↔ IDB 분리 PASS (코드 검사)
tasks/folder-picker-ux/codex-phase7.md:341:- WCAG AA: `--fg` (`#0a0a0a`) on `--surface-muted` (`#fafafa`) = **20.4:1** (이미 PASS, font-size 변경은 contrast 무관)
tasks/folder-picker-ux/codex-phase7.md:419:`<span className="kbd-label">(period)</span>`이 VoiceOver/NVDA에서 자연스럽게 읽히는가? 또는 `<kbd>` 자체에 `aria-label="period key"`가 더 적절한가? 현재 hint `<kbd>⌘⇧.</kbd>`는 screen reader가 "command shift period"로 읽지 못할 수 있음 (Codex Phase 6 Q6 미해결 잔존).
tasks/folder-picker-ux/codex-phase7.md:442:1. **Verdict**: PASS / needs-attention / nit-only
tasks/folder-picker-ux/codex-phase7.md:445:4. **HIGH/MEDIUM 결함이 있다면 mitigation 제안**
tasks/folder-picker-ux/codex-phase7.md:448:PASS 또는 nit-only → Phase 7.5.2 (3 Edits 적용) 진입.
tasks/folder-picker-ux/codex-phase7.md:449:HIGH/MEDIUM ≥ 1건 → patch v2 발산 후 본 파일 재실행 (재시도 1회 한).
tasks/folder-picker-ux/codex-phase7.md:452:# Codex Phase 6 Static Review
tasks/folder-picker-ux/codex-phase7.md:455:**Verdict**: needs-attention
tasks/folder-picker-ux/codex-phase7.md:459:1. Cell #1 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:13` expects `~/.claude/projects` + `~/.codex/sessions` two row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux). The auto-detect branch renders the Path Preview Card before the picker buttons: `.claude / projects` is rendered at `components/forms/JoinBurnIndexForm.tsx:392-399`, `.codex / sessions` at `components/forms/JoinBurnIndexForm.tsx:400-406`, and the hint text with two `<kbd>` labels at `components/forms/JoinBurnIndexForm.tsx:407-409`. The new CSS selectors exist for the card and warning surface: `.path-preview-card` at `app/globals.css:2003-2012`, `.path-preview-row` at `app/globals.css:2013-2020`, `.path-segment` at `app/globals.css:2021-2024`, `.path-segment--hidden` at `app/globals.css:2025-2030`, `.path-preview-hint` at `app/globals.css:2031-2037`, `.path-preview-hint kbd` at `app/globals.css:2038-2046`, and `.form-warning` at `app/globals.css:2047-2056`.
tasks/folder-picker-ux/codex-phase7.md:463:3. Cell #3 — PASS. `tasks/folder-picker-ux/criteria.md:18` requires the actual selected folder name, and `tasks/folder-picker-ux/smoke-golden-regression.md:15` expects Name mismatch 메시지에 `**{h.name}**` 동적 노출 ("You picked **.claude**. We need **projects**…"). The implementation computes `expectedName` at `components/forms/JoinBurnIndexForm.tsx:142`, compares `h.name` at `components/forms/JoinBurnIndexForm.tsx:143`, and interpolates both `h.name` and `expectedName` in the error at `components/forms/JoinBurnIndexForm.tsx:144-146`.
tasks/folder-picker-ux/codex-phase7.md:465:4. Cell #4 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:16` expects Error 0건, 핸들 저장, 다음 step 진행. The Phase 5 split satisfies Invariant #5 from `tasks/folder-picker-ux/criteria.md:41`: after name validation, the code clears `fsaError`/`fsaWarning` at `components/forms/JoinBurnIndexForm.tsx:153-154`, sets `claudeHandle` or `codexHandle` at `components/forms/JoinBurnIndexForm.tsx:155-156`, and only then enters the best-effort `saveHandle` try/catch at `components/forms/JoinBurnIndexForm.tsx:161-167`.
tasks/folder-picker-ux/codex-phase7.md:467:5. Cell #5 — PASS for the Phase 6 sequence, with a LOW stale-error note. `tasks/folder-picker-ux/criteria.md:16` requires `AbortError` 케이스에서 error 표시 0건 (사용자 cancel은 silent), and `tasks/folder-picker-ux/smoke-golden-regression.md:17` expects Silent (form-error 미노출, 카드 그대로). The picker catch returns immediately for `e.name === "AbortError"` at `components/forms/JoinBurnIndexForm.tsx:119-120`, so no new `fsaError` is created. In the smoke sequence, Cell #4 clears errors first at `components/forms/JoinBurnIndexForm.tsx:153`, so Cell #5 should display no error. Isolated caveat: if a user cancels immediately after a prior mismatch/security error, line `components/forms/JoinBurnIndexForm.tsx:120` does not clear the stale `fsaError`; that does not break the listed Cell #5 order but is a UX edge case.
tasks/folder-picker-ux/codex-phase7.md:469:6. Cell #6 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:18` expects Safari fallback with Path Preview Card hidden. `autoDetect` can only be true if the env/query condition is true and `typeof window !== "undefined"` and `"showDirectoryPicker" in window` are both true at `components/forms/JoinBurnIndexForm.tsx:68-73`. Browsers without `showDirectoryPicker` will skip the auto-detect branch that begins at `components/forms/JoinBurnIndexForm.tsx:375`.
tasks/folder-picker-ux/codex-phase7.md:471:7. Cell #7 — PASS. `tasks/folder-picker-ux/criteria.md:20` requires handle React state 유지 + scan 진행 가능 + `fsaWarning`만 노출 (`fsaError` 빈 상태), and `tasks/folder-picker-ux/smoke-golden-regression.md:19` expects `fsaWarning`에 "Folder selected for this session, but it could not be remembered" 노출. State is separated into `fsaError` and `fsaWarning` at `components/forms/JoinBurnIndexForm.tsx:80-84`; picker success clears both at `components/forms/JoinBurnIndexForm.tsx:153-154`; handle state is set at `components/forms/JoinBurnIndexForm.tsx:155-156`; `saveHandle` failure only sets `fsaWarning` at `components/forms/JoinBurnIndexForm.tsx:161-167`; JSX renders `fsaError` and `fsaWarning` separately at `components/forms/JoinBurnIndexForm.tsx:445-446`. The Scan button disabled prop is `fsaLoading || (!claudeHandle && !codexHandle)` at `components/forms/JoinBurnIndexForm.tsx:448-454`, with no gate on either `fsaError` or `fsaWarning`.
tasks/folder-picker-ux/codex-phase7.md:477:Q2 — Finding: `instanceof DOMException` is probably fine for Chrome proper, but fork behavior and sensitive-directory error naming require runtime verification. Severity: MEDIUM because it can affect Cell #2. The code only inspects `e.name` inside the `e instanceof DOMException` guard at `components/forms/JoinBurnIndexForm.tsx:119-133`; a non-DOMException object with `name: "SecurityError"` or `name: "AbortError"` would fall to the generic message at `components/forms/JoinBurnIndexForm.tsx:134-137`. MDN documents `AbortError` and `SecurityError` here as DOMException types for `showDirectoryPicker()` (MDN lines 235-243), so same-realm Chrome should satisfy the guard. I did not find static project evidence for Edge/Brave/Vivaldi-specific wrapping; that part is requires-runtime-verification. The larger static concern is not `instanceof`; it is that current FSA/Chromium references map too-sensitive directory selection to `AbortError`, while this implementation treats every `AbortError` as user cancel at `components/forms/JoinBurnIndexForm.tsx:120`.
tasks/folder-picker-ux/codex-phase7.md:479:Q3 — Finding: the system trusts the final folder name, not the parent path. Severity: MEDIUM privacy/false-import risk, not a Phase 6 Happy Path blocker. `pickFolder` validates only `h.name !== expectedName` at `components/forms/JoinBurnIndexForm.tsx:142-148`. `handleFsaScan` then sends the selected handles into `runImport` at `components/forms/JoinBurnIndexForm.tsx:202-208`, and `runImport` delegates to `buildEnvelope` at `lib/client/burn/import.ts:36-44`. Downstream walkers repeat only root-name allowlists: Claude rejects non-`projects` names at `lib/client/burn/parsers.ts:853-859`, and Codex rejects non-`sessions` names at `lib/client/burn/parsers.ts:897-902`. There is no validation that a `projects` handle is actually under `~/.claude/` or that a `sessions` handle is actually under `~/.codex/`. The blast radius is limited by exact-depth traversal and filename/schema filters at `lib/client/burn/parsers.ts:840-847`, `lib/client/burn/parsers.ts:861-879`, `lib/client/burn/parsers.ts:884-892`, and `lib/client/burn/parsers.ts:907-928`, but a user-selected random folder named `projects` or `sessions` can still be iterated if it matches those shapes.
tasks/folder-picker-ux/codex-phase7.md:481:Q4 — Finding: the kill-switch precedence is build-time, not hot runtime. Severity: LOW if the documented redeploy rollback is followed; MEDIUM if an operator expects a live config flip. The component reads `process.env.NEXT_PUBLIC_AUTO_DETECT_DEFAULT` at `components/forms/JoinBurnIndexForm.tsx:67`, then applies the false-overrides-query precedence at `components/forms/JoinBurnIndexForm.tsx:68-73`. Local Next docs state that bundled env access is replaced at build time at `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/env.md:53-64`, and that `NEXT_PUBLIC_` values are inlined and frozen after build at `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md:154-166`. The broader rollout docs already say rollback is `env=false + redeploy, ~34초` at `docs/decision/decision-log.md:341`, so the plan is coherent only if redeploy is part of the kill-switch operation.
tasks/folder-picker-ux/codex-phase7.md:485:Q6 — Finding: the `<kbd>` hint lacks an explicit screen-reader label. Severity: MEDIUM a11y risk, requires-runtime-verification. The semantic hint is plain text plus `<kbd>⌘⇧·</kbd>` and `<kbd>Ctrl+H</kbd>` at `components/forms/JoinBurnIndexForm.tsx:407-409`; CSS only changes visual styling at `app/globals.css:2038-2046`. There is no `aria-label`, visually hidden expansion, or alternate text such as "Command Shift Period" for the macOS glyph sequence. `tasks/folder-picker-ux/criteria.md:19` requires screen reader 인지 가능, so VoiceOver/NVDA pronunciation should be manually checked. Static code cannot prove whether VoiceOver announces the macOS shortcut usefully or as literal symbols.
tasks/folder-picker-ux/codex-phase7.md:607:## Verdict
tasks/folder-picker-ux/codex-phase7.md:608:needs-attention(MEDIUM: `.kbd-label` contrast fails AA; MEDIUM: span-only `(period)` does not reliably solve kbd SR pronunciation)
tasks/folder-picker-ux/codex-phase7.md:622:MEDIUM: `.kbd-label { color: var(--fg3); font-size: 11px; }` fails WCAG AA for normal text. Fix: use `var(--fg2)` or another color >= 4.5:1; `--fg2` is about 7.81:1 on white.
tasks/folder-picker-ux/codex-phase7.md:624:MEDIUM: `(period)` as visible text alone does not guarantee accessible shortcut pronunciation. Fix: add explicit `aria-label` to the macOS `<kbd>` and hide the visual clarification from SR if needed to avoid duplicate/awkward announcement.
tasks/folder-picker-ux/codex-phase7.md:636:## Verdict
tasks/folder-picker-ux/codex-phase7.md:637:needs-attention(MEDIUM: `.kbd-label` contrast fails AA; MEDIUM: span-only `(period)` does not reliably solve kbd SR pronunciation)
tasks/folder-picker-ux/codex-phase7.md:651:MEDIUM: `.kbd-label { color: var(--fg3); font-size: 11px; }` fails WCAG AA for normal text. Fix: use `var(--fg2)` or another color >= 4.5:1; `--fg2` is about 7.81:1 on white.
tasks/folder-picker-ux/codex-phase7.md:653:MEDIUM: `(period)` as visible text alone does not guarantee accessible shortcut pronunciation. Fix: add explicit `aria-label` to the macOS `<kbd>` and hide the visual clarification from SR if needed to avoid duplicate/awkward announcement.

exec
/bin/zsh -lc 'for c in 6cda4c5 b94d362 3756e83 40cd00c; do git show --stat --oneline --name-only --no-renames "$c" -- '"'components/forms/JoinBurnIndexForm.tsx' 'app/globals.css'; done" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
6cda4c5 feat(forms): folder picker discoverability + smart error recovery
app/globals.css
components/forms/JoinBurnIndexForm.tsx
b94d362 fix(forms): folder picker kbd visibility + home folder hint
app/globals.css
components/forms/JoinBurnIndexForm.tsx
40cd00c fix(forms): bump path-preview kbd 13→15px for legibility
app/globals.css

exec
/bin/zsh -lc "sed -n '261,520p' tasks/folder-picker-ux/smoke-golden-regression.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
exec
/bin/zsh -lc 'git show --stat --oneline --name-only --no-renames 3756e83' in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
3756e83 docs(folder-picker-ux): Phase 7.5 handoff — owner re-measure template
tasks/folder-picker-ux/criteria-execution-log.md
tasks/folder-picker-ux/phase7-auxiliary-verification.md
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md
tasks/folder-picker-ux/smoke-golden-regression.md

exec
/bin/zsh -lc 'git log --oneline --decorate --graph --max-count=12' in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
* 40cd00c (HEAD -> main, origin/main, origin/HEAD) fix(forms): bump path-preview kbd 13→15px for legibility
* 3756e83 docs(folder-picker-ux): Phase 7.5 handoff — owner re-measure template
* b94d362 fix(forms): folder picker kbd visibility + home folder hint
* 6cda4c5 feat(forms): folder picker discoverability + smart error recovery
*   fe42877 Merge pull request #12 from chongwon83/fix/rollout-gate-integrity-v2
|\  
| * 8e435d2 (origin/fix/rollout-gate-integrity-v2) feat(security): rollout gate integrity v2 — HMAC token auth + Redis v2 namespace + CI hardening
| * c1862a3 fix(burnindex): non-week upload 차단 + kill-switch env precedence 수정
|/  
* 6a1a52c docs(rollout): add gate status snapshot 2026-05-21 (#11)
* 884fbea feat(rollout): wire NEXT_PUBLIC_AUTO_DETECT_DEFAULT kill-switch (#10)
* 3ab2f1f docs(readme): add Testing section — e2e port-conflict warning (#9)
* 378c034 test(e2e): Playwright — FSA 픽커 해피패스 + 거부 + MemoryStore 격리 (#8)
* 3ab54f8 docs(decision): S10 회고 — burn-import 사이클 종료 엔트리 추가 (#7)

exec
/bin/zsh -lc "sed -n '1,240p' tasks/folder-picker-ux/criteria-execution-log.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
exec
/bin/zsh -lc 'wc -l tasks/folder-picker-ux/smoke-golden-regression.md && tail -n 80 tasks/folder-picker-ux/smoke-golden-regression.md' in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
# Criteria Execution Log — Folder Picker UX

**Cycle**: 2026-05-21 (Approach B: inline preview + smart error recovery)
**Based on**: `tasks/folder-picker-ux/criteria.md`
**Last updated**: Phase 7.5.6 closure (Vercel `40cd00c`) — 2026-05-22. Owner production direct check + "사이즈 괜찮음" 발화로 Owner Happy Path Gate 통과. 다음 단계: Phase 8 docs cycle (decision-log + memory + Finding 1 별 사이클 brief).

## Must-Pass Results (6/6 required)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Build secret 노출 0건 | ✅ (local build PASS + Vercel deploy success + production main chunks 8개 전수 0 hits) | Phase 5.3 + Phase 7 commit 직전 `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0. Vercel deploy `6cda4c5` success (gh api). **Production curl 검증은 Vercel Bot Challenge로 차단** (`x-vercel-mitigated: challenge`, 403) → **Claude-in-Chrome 보조 검증 (2026-05-22)**: same-origin browser `fetch()`로 production main chunks 8개 (총 707,406 B) 전수 grep → **COLLECTOR_HMAC_SECRET 0 hits**. 상세 `phase7-auxiliary-verification.md`. Invariant #1 production 직접 검증 PASS |
| 2 | Path Preview Card 시각 노출 | ✅ PASS (Phase 7.5.6 owner-direct closure) | `JoinBurnIndexForm.tsx:392-411` 마크업 삽입. globals.css 6 신규 클래스. **localhost:3000/?auto-detect=1 + Join modal 자동 검증 통과** (`preflight-localhost-verification.md`): 2 rows `~/.claude/projects` + `~/.codex/sessions`, 2 hidden segments outlined, hint + kbd labels rendered. **Phase 7 production (`6cda4c5`) Claude-in-Chrome 보조 검증** (`phase7-auxiliary-verification.md`): 2 rows + 2 hidden segments + hint + 2 kbds 정확 일치. **Phase 7.5 production (`b94d362`) 추가 검증** (`phase7.5-auxiliary-verification.md`): hint copy 갱신 ("From your home folder (~), open .claude/projects or .codex/sessions. Reveal hidden folders with ⌘⇧.(period) on macOS or Ctrl+H on Linux.") + `<code>` 3개 (`~`, `.claude/projects`, `.codex/sessions`) + `(period)` 라벨 + aria-label 2건 (`Command Shift Period`, `Control H`) 모두 정확 일치. **Phase 7.5.6 production deploy `40cd00c` (2026-05-22)**: mcp__claude-in-chrome computed style verify — font-size 15px / padding 2px 8px / line-height 21px; owner production direct check + 발화 "사이즈 괜찮음" → `smoke-golden-regression.md` Phase 7.5 row owner-direct 손글씨 기록 (Owner Happy Path Gate 통과). |
| 3 | AbortError silent | ✅ (code + Cell #5 owner localhost PASS) | `JoinBurnIndexForm.tsx:126-134` count-based — 1차 cancel silent (count 0→1), 2차 cancel fsaWarning 노출 (count 1→2). locale-independent (Invariant #4). **Cell #5 owner-direct (2026-05-22 localhost)**: 2회 cancel variant — Cell #4 success 직후 `abortCountRef`=0 리셋된 상태에서 0→1 silent + 1→2 fsaWarning 정확 텍스트 일치. count-based heuristic post-reset cycle 검증 PASS. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.53.44.png` |
| 4 | SecurityError actionable → AbortError count-based fsaWarning | ✅ (Cell #2 재실측 PASS, owner localhost) ⏳ (production cell #2 재실측) | **2026-05-22 Cell #2 1차 실측**: `[picker-rejection] {name: "AbortError", code: 20, message: "Failed to execute 'showDirectoryPicker' on 'Window': The user aborted a request."}` — Codex CONCERN 확인 CORRECT. Chrome은 홈 디렉터리 거절을 AbortError로 dispatch (SecurityError 아님). 단순 silent return이 SecurityError 분기를 preempt → 메시지 무노출. **Contingency Patch v2 (count-based) 적용** `JoinBurnIndexForm.tsx:99 + 126-134`: `abortCountRef = useRef<number>(0)` → 1회 silent / 2회 누적 시 `fsaWarning` (yellow, non-fatal). timing-based 1500ms 폐기 (picker 호출당 10-15초 → 1500ms 내 2회 불가능 → count-based pivot). Invariant #4 (e.name only) 유지. **검증 4종 PASS**: tsc / vitest 234/234 / build / `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0. **Cell #2 재실측 PASS (2026-05-22 owner-direct localhost)**: 1차 silent ✅ / 2차 연두색 fsaWarning 텍스트 정확 일치 ✅ / Scan 버튼 enabled 유지 ✅. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.33.04.png`. 잔여 = Phase 7 production redeploy 후 cell #2 재실측 |
| 5 | Name mismatch 동적 표기 | ✅ (code + Cell #3 owner localhost PASS) | `JoinBurnIndexForm.tsx:157-161` `You picked "${h.name}". We need the directory literally named "${expectedName}"…`. **Cell #3 owner-direct (2026-05-22 localhost)**: `~/.claude` 직접 선택 → 빨간 fsaError 노출, `.claude` 동적 + `projects` expected 정확 일치. typo fix `⌘⇧·` → `⌘⇧.` (line 423) 함께 검증. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.42.51.png` |
| 6 | a11y WCAG AA 4.5:1 + Tab order | ✅ (contrast + tab order + Phase 7.5 v2 회복 + Phase 7.5.6 font bump 재검증) ⏳ (Lighthouse + owner SR smoke 잔여) | Phase 3 self-audit + **localhost computed 재확인** (`preflight-localhost-verification.md`): `--fg2 rgb(82,82,82)` on `--bg rgb(255,255,255)` = **7.52:1** (helper/row/hint 모두 동일) / kbd `--fg rgb(10,10,10)` on `--surface-muted rgb(250,250,250)` = **20.4:1** / `--young-coconut-dark` outline-only(text 미사용). Tab 순서 10 tabbables: close 첫 → 2 pickers → 5 timeframe → 폼 필드 = 자연 순서. **Phase 7.5 v2 contrast 회복** (`phase7.5-auxiliary-verification.md`): Edit 2 v2 `.kbd-label` 색상을 `--fg3 #8E8E8E` (3.28:1 AA fail) → `--fg2 #525252` (codex v2 권장 반영)으로 변경 → **production 재계산 PASS**: kbd `18.97:1` / label `7.81:1` / hint `7.81:1` / code (inherit `--fg2`) `7.81:1`. **a11y 추가 강화** (Edit 3 v2 신규 클래스 `.path-preview-hint code` JetBrains Mono / Edit 4 inline `<kbd aria-label>` 2건 + `<span aria-hidden>` 1건): SR이 `⌘⇧.`을 "Command Shift Period"로, `Ctrl+H`를 "Control H"로 또박또박 발음 + `(period)` 시각 라벨은 SR 중복 announce 차단. **Phase 7.5.6 patch 후 contrast 재확인** (font-size 13→15px / padding 2px 7px → 2px 8px / line-height 1.4 신규): 15px kbd `#0A0A0A` on `#FAFAFA` = **18.97:1** ✅ (font-size 증가에도 색상 무변 → ratio 동일), `.kbd-label` `#525252` on `#FFFFFF` = **7.81:1** ✅. Lighthouse + owner VoiceOver smoke 잔여 (Codex Q6 follow-up — task #14) |

**Must-Pass 현 시점**: 5/6 code-side ✅ + #4 ⚠️ PARTIAL (Codex CONCERN on Cell #2 dispatch) + #2/#6 localhost auto-verification 강화 + #3/#5 dynamic simulation 강화 (`preflight-phase6-simulated.md` 7/7 cells PASS for synthetic inputs). **Codex Phase 6 verdict: needs-attention** — single critical concern: real Chrome may dispatch home-folder rejection as `AbortError` (not `SecurityError`), in which case `JoinBurnIndexForm.tsx:120` silent return preempts the actionable SecurityError branch. owner 실측 잔여 = **🔴 P1 Cell #2 real `~` pick + capture `e.name`** + 🟡 P2 Cell #7 real DevTools IDB clear + 🟢 P3 production cell #1 + remaining 5 cells real picker + Safari + Lighthouse/screen reader.

## Should-Pass Results (≥ 5/6 required)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 7 | Codex Phase 1 nit-only | ⚠️ PARTIAL→PASS (mitigation) | Codex verdict `needs-attention`. In-scope MEDIUM #3 (IDB persistence) → Plan v2 delta §B에서 4단계 분리 + `fsaWarning` + Invariant #5 추가. Out-of-scope critical #1/#2는 별 사이클 |
| 8 | /plan-design-review Phase 3 nit-only | ✅ PASS | HIGH/MEDIUM 0건, NIT 3건 (모두 Phase 5에 반영). 5축 + v2 추가 1축 (fsaError↔fsaWarning) 모두 통과 |
| 9 | tsc + vitest + eslint | ⚠️ PARTIAL→PASS (80% 룰) | `tsc --noEmit` ✅ exit 0 / `vitest run` ✅ 234/234 / `eslint --max-warnings=0` ❌ 15 warnings (모두 pre-existing, 본 변경 도입 0건). 3축 중 2.5 통과로 80% 룰 적용 → PASS |
| 10 | DESIGN.md lint error 0 | ⏸️ N/A | Phase 3 NIT #2: 현 DESIGN.md scope는 leaderboard tier 한정. forms 추가는 scope 확장이라 보류. 기존 lint state 유지. Phase 8 retro 재평가 후보 |
| 11 | Owner Happy Path 6 cells | ⏳ partial — 7/7 auto-simulated + Codex 검토 완료 (**needs-attention**) | **`preflight-phase6-simulated.md` 7/7 cells PASS (auto)**: Cell #1 inherited + Cell #2-#5 monkey-patched `showDirectoryPicker` 4분기 + Cell #6 no-query 네비게이션 manual form + Cell #7 `indexedDB.open` 패치 fsaWarning + Invariant #5. **Codex Phase 6 (`codex-phase6.md` 13261 bytes) 완료 — verdict: needs-attention**. Cell-by-cell: #1/#3/#4/#5/#6/#7 ✅ PASS / **#2 ⚠️ CONCERN MEDIUM** (AbortError vs SecurityError dispatch — MDN+WICG+Chromium source citations). Q1 LOW (Step 4 timing ✅) / Q2 MEDIUM (DOMException cross-Chromium 일부 unverified) / Q3 MEDIUM (parent-path validation gap, 별 사이클) / Q4 LOW (NEXT_PUBLIC build-time, redeploy 절차 정합) / Q5 INFO (English UI 영구) / Q6 MEDIUM (kbd SR 미검증). owner real-incognito + production은 여전히 의무 (smoke-golden-regression.md owner-직접-기록 invariant). **🔴 P1 = Cell #2 real `~` pick + `e.name` 로깅 (Phase 6 단일 차단 후보)**. |
| 12 | B3 5종 + decision-log + S10 | ⏳ partial | #1 criteria ✅ / #2 본 파일 ✅ / #3 diff ✅ / #4 unverified ✅ / #5 smoke-golden Phase 6 owner / **`preflight-localhost-verification.md` + `preflight-phase6-simulated.md` 보조 산출물 추가** / decision-log + S10 Phase 8 |

**Should-Pass 현 시점**: 3 PASS + 1 N/A (제외) + #11 partial (auto 7/7 ✅, owner real-incognito 잔여) + #12 partial → 5개 평가 대상 중 3 PASS + 2 partial. Phase 6/7/8 완료 후 80% 룰 (5/6+) 재평가. Codex Phase 6 verdict 도착 시 본 파일 + `preflight-phase6-simulated.md` 추가 갱신.

---

## Phase 5 Implementation Anchors

| Edit | 파일 | 라인 | 내용 |
|------|------|------|------|
| 1 | `JoinBurnIndexForm.tsx` | L66-71 | `fsaWarning` state + 4줄 설명 코멘트 (Invariant #5) |
| 2 | `JoinBurnIndexForm.tsx` | L108-157 | `pickFolder` 4단계 분리 (Step 1 picker / Step 2 name / Step 3 handle state / Step 4 IDB non-fatal) |
| 3a | `JoinBurnIndexForm.tsx` | L390 | Step 1 helper text 단순화 |
| 3b | `JoinBurnIndexForm.tsx` | L392-411 | Path Preview Card 마크업 |
| 4 | `JoinBurnIndexForm.tsx` | L445 | `{fsaWarning && <p className="form-warning">…</p>}` JSX |
| 5 | `app/globals.css` | L1999-2056 | 6 신규 클래스 |

## 갱신 절차

- Phase 6 6 cells 완료 → #2~#6, #11 owner 실측 결과 반영
- Phase 7 production deploy → #1 production 재검증
- Phase 8 종료 → #12 최종 확정

 succeeded in 0ms:
      79 tasks/folder-picker-ux/smoke-golden-regression.md
# Smoke Golden Regression — Folder Picker UX

**Date**: 2026-05-21 (Phase 6 진행 중)
**Owner**: scw0526 (chongwon83)
**Recording rule**: Owner 직접 Chrome incognito 진입 → 7 cells 손으로 ✅/❌ 기록. **자동 append 금지** (`[auto]` prefix 또는 subagent 서명 검출 시 "완료" 차단).

**2026-05-22 Contingency Patch 반영**: Codex Phase 6 CONCERN 확인 — Cell #2 실측 결과 `e.name="AbortError"` (code 20), `SecurityError` 아님. `JoinBurnIndexForm.tsx:126-134` count-based heuristic 도입 — 2회 연속 AbortError 시 `fsaWarning` (yellow, non-fatal) 노출. Cell #2/#5 기대 결과 갱신. Invariant #4 (e.name only) 유지.

---

## Phase 6 Cells (Chrome 최신 incognito + production deployment)

| # | 입력 | 기대 결과 | 결과 | 시각 / 메모 |
|---|------|----------|------|-------------|
| 1 | `https://www.coconutlabs.xyz/` 진입, Path Preview Card 시각 확인 | `~/.claude/projects` + `~/.codex/sessions` 두 row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux) | ✅ owner localhost | 2026-05-22 owner-direct on `localhost:3000/?auto-detect=1` (production redeploy 후 재실측 별도). 스크린샷: `issues/스크린샷 2026-05-22 오전 12.33.04.png`. 두 row + hint 모두 가시 |
| 2 | "Pick .claude/projects" 클릭 → 홈 디렉터리(`~`) 선택 → Chrome dialog "다른 폴더 선택" 또는 "취소" 클릭 → 다시 "Pick .claude/projects" 클릭 → 홈 디렉터리 다시 선택 → 두 번째 거절 | **1차 시도**: silent (메시지 무노출, abortCount=1) / **2차 시도**: yellow `fsaWarning` 노출 — "Trouble picking the folder? Chrome blocks system folders like your home directory — drill into ~/.claude/projects (or ~/.codex/sessions) specifically." Korean Chrome dialog 떠도 우리 UI 메시지는 영어 동일. **Scan 버튼 enabled 유지** (fsaWarning은 non-fatal, fsaError 아님) | ✅ owner localhost | 2026-05-22 owner-direct: "1차에서는 아무것도 안 뜨고, 2차에서는 연두색 바탕 안에 [정확한 텍스트 일치]". Scan 버튼 enabled 유지 확인. 스크린샷: `issues/스크린샷 2026-05-22 오전 12.33.04.png` |
| 3 | 다시 클릭 → `~/.claude` 자체 선택 → Chrome 권한 팝업 "허용" | Name mismatch 메시지에 `{h.name}` 동적 노출 — `You picked ".claude". We need the directory literally named "projects" (inside ~/.claude/ or ~/.codex/). Try again.` | ✅ owner localhost | 2026-05-22 owner-direct (Cell #3 페이지 reload 후 fresh state): 정확 텍스트 일치 / `.claude` 동적 표기 ✅ / `projects` 정확 노출 ✅ / hint 글리프 `⌘⇧.` 정상 (typo fix HMR 반영). 스크린샷 `issues/스크린샷 2026-05-22 오전 12.42.51.png` |
| 4 | 다시 클릭 → `~/.claude/projects` 선택 | Error 0건, 핸들 저장, 다음 step 진행 | ✅ owner localhost | 2026-05-22 owner-direct: `Pick .claude/projects` 버튼 텍스트가 `✓ projects` 로 변경 + 강조 상태 / fsaError 클리어 ✅ / fsaWarning 클리어 ✅ / `Scan & preview` 버튼 enabled 유지 ✅ / Step 2 timeframe row 진행 노출. 스크린샷: `issues/스크린샷 2026-05-22 오전 12.46.29.png` |
| 5 | 다시 클릭 → 시스템 dialog에서 cancel (1회) | Silent (form-error/warning 미노출, 카드 그대로). **전제**: Cell #4 성공 후 abortCount 0 리셋된 상태. Cell #4 미실행 시 직전 누적 카운트에 따라 fsaWarning 노출 가능 — 그 경우도 Cell #2 contract와 정합 | ✅ owner localhost (variant: 2회 cancel) | 2026-05-22 owner-direct: 2회 cancel 입력 → count cycle 검증 PASS. Cell #4 success로 `abortCountRef`가 0 리셋된 상태에서 0→1 (silent) → 1→2 (fsaWarning 노출, 정확 텍스트 일치) 흐름 재현. count-based heuristic post-reset 동작 확인. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.53.44.png`. **변형 사유**: 1회 cancel→silent 검증은 Cell #2 1차 + Cell #5 0→1 transition으로 이미 evidence 확보. 2회 cancel은 reset 후 cycle 재검증으로 더 강한 contract 확인 |
| 6 | Safari로 동일 URL 진입 | "Join Burn Index" 수동 폼 fallback. Path Preview Card 미표시(auto-detect off) | ✅ owner localhost | 2026-05-22 owner-direct Safari: "Join Burn Index" 모달 노출 / STEP 1 RUN THE COLLECTOR (Python 3.11+ instructions + git clone snippet + Copy button) / STEP 2 UPLOAD YOUR BURN SUMMARY (handle input + file picker + JSON paste textarea + `Validate & preview` 버튼) / Path Preview Card 미표시 ✅ / Pick .claude/projects / .codex/sessions 버튼 미표시 ✅ / `⌘⇧.` hint 미표시 ✅. `"showDirectoryPicker" in window` 분기 (line 67-73) 정상 동작. 스크린샷 `issues/스크린샷 2026-05-22 오전 1.01.40.png` |
| 7 | (v2 신규) Chrome DevTools > Application > Storage > Clear site data → IndexedDB throttle/block 시뮬레이션 후 `~/.claude/projects` 선택 | Handle UI에 `✓ projects` 표시 (claudeHandle React state set), `fsaError` 비어 있음, `fsaWarning`에 "Folder selected for this session, but it could not be remembered" 노출. Scan 버튼 enabled. 새로고침 후 handle 재선택 필요 (정상). 직접 시뮬레이션 불가 시 saveHandle 임시 throw로 대체 검사 (코드 검사 갈음) | ✅ owner 승인 코드 검사 | 2026-05-22 owner-direct decision (옵션 A 선택). `JoinBurnIndexForm.tsx:164-182` 4단계 분리 구조 검증: ① L167-168 `setFsaError("")` + `setFsaWarning("")` 클리어 / ② L170-171 `setClaudeHandle(h)` / `setCodexHandle(h)` **saveHandle 호출 BEFORE handle state 세팅** (Invariant #5 핵심) / ③ L176-177 `try { await saveHandle(kind, h) }` IDB persistence best-effort / ④ L178-182 catch에서 `setFsaWarning("Folder selected for this session, but it could not be remembered. You'll need to pick it again next time.")` 노출 + fsaError 미터치로 Scan 버튼 enabled 유지. **Invariant #5 (handle React state ↔ IDB persistence 분리) 코드 레벨 PASS** |

---

## Phase 7 Production 재실행 (cells #1, #4 — 2/2 필수)

**Deploy 상태**: ✅ Vercel commit `6cda4c5` deployment 완료 (2026-05-22, gh api 확인 — `https://vercel.com/chongwon-shins-projects/coconutlabs/9zFwEtq2UE3436K9m6ZrnNQX7Zyw`).

**Production secret leak 재검증 메모**: `curl https://www.coconutlabs.xyz/_next/static/chunks/*.js`는 Vercel Bot Challenge (`x-vercel-mitigated: challenge`, 403)로 차단됨. **Local build verification (`grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0)이 Phase 7 commit 직전에 PASS**한 상태로 동일 source가 Vercel build pipeline 통과 → derivatively verified.

**2026-05-22 Claude-in-Chrome 보조 검증 (Option B 하이브리드)** — Bot Challenge를 same-origin browser fetch로 우회해 **production main chunks 8개 전수 검사 = COLLECTOR_HMAC_SECRET 0건 (총 707KB 검사)**. Path Preview Card 마크업도 같은 세션에서 검증 완료 (2 rows + 2 hidden segments + hint + kbds 정확 일치). 상세: `phase7-auxiliary-verification.md`. **단 owner-direct manual record는 여전히 의무** — 본 표 cells #1/#4는 owner incognito 직접 실행 후 손으로 기록 (1-2분 축약 가능).

| # | 결과 | 메모 |
|---|------|------|
| 1 (production redeploy 후) | ⏳ owner-direct | Chrome 최신 + incognito + `https://www.coconutlabs.xyz/?auto-detect=1` 진입. Path Preview Card 2 row + hint 노출 확인 후 본 표 1줄 직접 기록 >> 둘 다 잘 보임 |
| 4 (production redeploy 후) | ⏳ owner-direct | `~/.claude/projects` 선택 → `✓ projects` 버튼 + fsaError/fsaWarning 0 + Scan 버튼 enabled 확인 후 본 표 1줄 직접 기록 >> 둘 다 잘 보임 |

---

## Phase 7.5 Production 재실측 (Findings 2+3 patch, cell 1/1 필수)

**Deploy 상태**: ✅ Vercel commit `b94d362` deployment 완료 (2026-05-22T01:46:39Z, GitHub combined status `success` — `https://vercel.com/chongwon-shins-projects/coconutlabs/3kKrsZNWTyZpr8TzozqVvWPmwPeR`).

**2026-05-22 Claude-in-Chrome 보조 검증** (Option B 하이브리드, `phase7.5-auxiliary-verification.md` 형식):
- production HTML + computed styles 실측: kbd 13px / `letter-spacing 0.5px` / `padding 2px 7px` / aria-label `Command Shift Period`·`Control H` / `(period)` 라벨 `aria-hidden=true` 11px Inter `--fg2` / `<code>` 3개 (`~`, `.claude/projects`, `.codex/sessions`) JetBrains Mono — **3/3 마크업 PASS**
- WCAG AA: kbd `18.97:1` / label `7.81:1` / hint `7.81:1` / code `7.81:1` — **4/4 contrast PASS** (Edit 2 v2 `--fg3→--fg2` 회복 확인)
- production main chunks 5개 (총 394 KB) 전수 grep `COLLECTOR_HMAC_SECRET` = **0 hits** — Invariant #1 PASS

**owner-direct manual record는 여전히 의무** — 본 표 cell은 owner incognito 직접 실행 후 손으로 기록 (1-2분 축약 가능, harness-loop "auto-append 금지" 게이트 유지).

| # | 결과 | 메모 |
|---|------|------|
| 7.5 (kbd 시인성 + home folder + aria-label) | ⏳ owner-direct | Chrome 최신 + incognito + `https://www.coconutlabs.xyz/?auto-detect=1` 진입 → Hero "Join Burn Index" 클릭 → 모달 오픈 → ① `⌘⇧.` kbd 13px 가독 + `.`이 마침표가 아닌 키 라벨로 인지 ② `(period)` 라벨 명시 노출 ③ "From your home folder (~), open .claude/projects or .codex/sessions" 안내 노출 ④ (선택) VoiceOver(Cmd+F5)로 hint Tab → "Command Shift Period" / "Control H" 발음 확인 (Codex Q6 follow-up). 본 표 1줄 직접 기록 |

---

## 중단 조건

**7 cells** 중 1개라도 ❌ → Phase 5.x로 회귀 (Edit 재실행). 또는 invariant #1~5 위반 시 즉시 롤백. (v2: cell #7 + invariant #5 추가, 2026-05-21 Codex Phase 1 PARTIAL 반영)

---

## Phase 6 최종 결과 (2026-05-22)

**7/7 cells PASS** (owner-direct 6 cells + 코드 검사 1 cell)

| # | 결과 | 방식 |
|---|------|------|
| 1 | ✅ | owner localhost (스크린샷 12.33.04) |
| 2 | ✅ | owner localhost (스크린샷 12.33.04) — Codex CONCERN AbortError 확인 + Contingency Patch v2 PASS |
| 3 | ✅ | owner localhost (스크린샷 12.42.51) — typo fix `⌘⇧·` → `⌘⇧.` 함께 검증 |
| 4 | ✅ | owner localhost (스크린샷 12.46.29) — `✓ projects` 핸들 저장 |
| 5 | ✅ | owner localhost (스크린샷 12.53.44, variant 2회 cancel) — count cycle 검증 |
| 6 | ✅ | owner localhost Safari (스크린샷 01.01.40) — fallback 정확 노출 |
| 7 | ✅ | owner-direct decision 코드 검사 — Invariant #5 PASS |

**중단 사유 없음. Phase 7 (production deploy + 30min monitoring) 진입 가능.**

잔여 의무: Phase 7에서 cells #1, #4 production deployment 재실행 (smoke-golden-regression.md "Phase 7 Production 재실행" 섹션).

exec
/bin/zsh -lc "sed -n '1,240p' tasks/folder-picker-ux/criteria.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
# Criteria — Folder Picker UX Improvement (Approach B: inline preview + smart error recovery)

**Date**: 2026-05-21
**Owner**: scw0526 (chongwon83)
**Source plan**: `~/.claude/plans/p1-rollout-lazy-trinket.md`
**Context**: ON-flip 2026-05-21 직후 production smoke test에서 발견된 Chrome FSA picker first-impression UX 결함 수정. 3 surfaces (S1 Path Preview Card 신규 / S2 Smart Error Differentiation / S3 Step 1 Helper Text Refinement). 모달 신설 X (Approach A 기각). UI 영어 유지.

---

## Must-Pass (≥ 7/7 — 단 1개라도 ❌ 시 owner "완료" 발화 금지)

| # | 영역 | 기준 | 검증 방법 |
|---|------|------|----------|
| 1 | security | Build secret 노출 0건 (재확인) | `curl -sS https://www.coconutlabs.xyz/_next/static/chunks/*.js \| grep -c COLLECTOR_HMAC_SECRET` → 0 |
| 2 | ux | Path Preview Card가 picker 버튼 위에 표시되고 `~/.claude/projects` + `~/.codex/sessions` 두 breadcrumb 시각 노출 | Phase 6 cell #1 — Chrome incognito 진입 직후 시각 확인 |
| 3 | error | `AbortError` 케이스에서 error 표시 0건 (사용자 cancel은 silent) | Phase 6 cell #5 — picker dialog cancel 후 form-error 미노출 |
| 4 | error | `SecurityError` 케이스에서 system-folder actionable 메시지 노출 (메시지 그대로일 필요는 없으나 locale-independent detection — `error.name`만 사용) | Phase 6 cell #2 — 홈(`~`) 선택 → 안내 메시지 노출 |
| 5 | error | Name mismatch 케이스에서 사용자가 실제 선택한 폴더명(`{h.name}`) inline 표시 (예: "You picked **.claude**...") | Phase 6 cell #3 — `~/.claude` 자체 선택 → 실제 폴더명 동적 표기 |
| 6 | a11y | 신규 Path Preview Card WCAG AA 4.5:1 통과 + Tab 순서 자연 + screen reader 인지 가능 | Chrome DevTools Lighthouse + 수동 Tab order 검수 |
| 7 | error | `saveHandle()` 실패 (IDB blocked/quota/DataCloneError) 시 handle React state 유지 (`claudeHandle`/`codexHandle` ≠ null) + scan 진행 가능 + `fsaWarning`만 노출 (`fsaError` 빈 상태) | Phase 6 cell #7 — DevTools IDB block 시뮬레이션 또는 saveHandle 임시 throw 검사 (v2 delta §E) |

## Should-Pass (≥ 5/6 통과 — 80% 기준)

| # | 영역 | 기준 | 검증 방법 |
|---|------|------|----------|
| 7 | review | Codex Phase 1 nit-only (HIGH/MEDIUM 결함 0건) | `tasks/folder-picker-ux/codex-phase1.md` |
| 8 | review | `/plan-design-review` Phase 3 nit-only | `tasks/folder-picker-ux/design-review-phase3.md` |
| 9 | build | `tsc --noEmit` + `vitest` + `eslint --max-warnings=0` 모두 통과 | `npx tsc --noEmit && npx vitest run && npm run lint -- --max-warnings=0` |
| 10 | design | DESIGN.md lint error 0 | `npx @google/design.md lint DESIGN.md` |
| 11 | smoke | Owner Happy Path 6 cells 모두 ✅ (Chrome cells 1-5 + Safari fallback cell 6) | `tasks/folder-picker-ux/smoke-golden-regression.md` (owner 직접 기록) |
| 12 | docs | B3 5종 산출물 + decision-log 엔트리 + S10 회고 작성 완료 | `tasks/folder-picker-ux/{criteria,criteria-execution-log,diff,unverified,smoke-golden-regression}.md` + `docs/decision/decision-log.md` |

---

## Invariants (위반 시 즉시 롤백 또는 머지 차단)

1. **Build secret 노출 ≥ 1건** → `env=false` 롤백 + `COLLECTOR_HMAC_SECRET` 회전
2. **a11y 회귀** (WCAG AA 4.5:1 미달 or Tab 순서 회귀) → 머지 차단
3. **Auto-detect 진입 회귀** (Chrome incognito + 쿼리 없음 → "Auto-detect Burn Summary" 카드 미표시) → 머지 차단
4. **Locale 의존 에러 분기** (`error.message` 파싱 발견) → 머지 차단. 반드시 `error.name`만 사용
5. **Handle React state ↔ IDB persistence 결합** (`pickFolder()`에서 `setClaudeHandle()`/`setCodexHandle()`이 `saveHandle()` 결과에 의존) → 머지 차단. 반드시 picker name 검증 직후 handle state set, IDB save는 별도 try-catch (v2 delta §B.2)

---

## Out-of-Scope (명시 제외)

- Pre-picker modal (Approach A 기각)
- i18n / 한국어 메시지 (영어 유지)
- OS detection 로직 (macOS + Linux 두 hint 모두 노출)
- A/B testing 인프라
- Client-side telemetry counter 추가 (cancel/mismatch ratio)
- API/HMAC/Redis 측 변경

---

## DevVault 사전 조회 매칭

| 노트 | 적용 | 사유 |
|------|------|------|
| `2026-05-21-idb-structuredclone-function-prop-dataclonerror-patch.md` | ① 직접 적용 | `pickFolder()` catch 블록 silent failure 패턴 정확히 일치. S2 재작성 시 함수 프로퍼티 핸들 IDB 저장 흐름 ↔ 본 작업 error.name 분기 분리 |
| `2026-04-13.md` (Dev-Log) | ③ 무관 | 본 작업과 무관한 일자 로그 |

## Memory 적용

| 메모리 | 적용 | 사유 |
|--------|------|------|
| `feedback_coconutlabs-solo-no-review-request.md` | ① 직접 적용 | Phase 7 머지 시 PR 리뷰 요청 없이 chongwon83 단독 squash-merge |
| `project_auto-detect-flip-procedure.md` | ② 참고만 | 현재 production 상태(env=true, deployment EUAHZpz1Z) 컨텍스트 |

exec
/bin/zsh -lc "sed -n '1,220p' ~/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
---
name: project-folder-picker-ux-2026-05-22
description: "FSA folder picker UX — Approach B (inline preview + smart errors). 4 error 분기 (Abort/Security/NotAllowed/mismatch), 2-row Path Preview Card, locale-independent error.name only."
metadata: 
  node_type: memory
  role: owner
  domain: web-ui-folder-picker
  expiry: 2026-08-20
  owner: scw0526
  source_link: ../../../../../Desktop/Project/Coconut Labs/web/tasks/folder-picker-ux/criteria-execution-log.md
  usage_count: 0
  last_validated: 2026-05-22
  type: project
  originSessionId: 45e9b6a6-f526-4600-ad67-0dff8d8f45b9
---

# Folder Picker UX — Approach B (2026-05-22)

## 결정 요약

Chrome/Edge File System Access API picker UX에 **Approach B = inline preview + smart errors** 적용.
Pre-picker modal(A) 기각 — 진입 마찰 + microcopy 중복 위험.

## 4 Error 분기 패턴 (locale-independent)

`error.name`(DOMException 표준)만 분기, `error.message`(Chrome locale 의존) 금지:

| `error.name` | UX 동작 |
|--------------|---------|
| `AbortError` | count-based heuristic — 1차 silent (exploration), 2차 누적 시 `fsaWarning`(yellow, non-fatal) 노출 |
| `SecurityError` | actionable: "Chrome blocked that folder because it contains system files. Drill down to your `.claude/projects`…" |
| `NotAllowedError` | 권한 재시도: "Read access wasn't granted. Try again and approve the picker when Chrome prompts." |
| fallback | "Couldn't open the folder picker. Try a different browser or check site permissions." |
| name mismatch | 동적 노출: `You picked **{h.name}**. We need the directory literally named **{expectedName}**…` |

> ⚠️ `error.message` 파싱 금지(Invariant #4). Chrome dialog 자체는 OS locale 따라 한국어/영어/기타 출력하지만 `error.name`은 표준 고정.

## Count-based AbortError Pivot (Phase 6 Contingency)

초안: timing-based 1500ms 임계(연속 2회 발생 시 시스템 폴더 안내).
실측 폐기: 실제 picker UX 호출당 10-15초 소요 → 1500ms window 내 2회 발생 불가능.
최종: `abortCountRef = useRef<number>(0)` — 1회 silent, 2회 누적 시 `fsaWarning` 노출. Invariant #4 유지.

## 2-row Path Preview Card

picker 버튼 위 inline 시각 breadcrumb:

- Row 1: `~ / .claude / projects`
- Row 2: `~ / .codex / sessions`
- Hidden-folder `.`-prefix segment에 `--young-coconut-soft` outline emphasis
- Reveal hint 1줄: `Start from your home folder. Reveal hidden folders with ⌘⇧. (period) on macOS or Ctrl+H on Linux.`

Visual hierarchy: Inter 14px 설명 + JetBrains Mono 13px 경로. picker 버튼보다 visual weight 낮춰 attention drift 방지.

## kbd 시인성 패턴 (Phase 7.5 + 7.5.6 누적)

`⌘⇧.` 글리프 가독성을 위한 최종 사양:

- `font-size: 15px` (Phase 5 11px → Phase 7.5 13px → Phase 7.5.6 15px 2단계 bump)
- `padding: 2px 8px` (1px 5px → 2px 7px → 2px 8px)
- `letter-spacing: 0.5px` (`.`이 `⌘⇧`와 결합돼 마침표로 보이는 현상 방지)
- `line-height: 1.4`
- `<span className="kbd-label" aria-hidden="true">(period)</span>` 명시 라벨 (screen reader 흡수)
- aria-label 2건: kbd 요소에 직접 부여

WCAG AA 재확인(Phase 7.5.6): 15px kbd `#0A0A0A` on `#FAFAFA` = 18.97:1 ✅, `.kbd-label` `#525252` on `#FFFFFF` = 7.81:1 ✅.

## Handle State ↔ IDB Persistence 분리 (Invariant #5)

S2 pickFolder 4단계 분리:

1. picker 호출 + catch 분기 (위 4 error.name 케이스)
2. name 검증 (mismatch 동적 메시지)
3. **handle React state 즉시 set** (`setClaudeHandle`/`setCodexHandle`)
4. **`saveHandle` 별도 try-catch** — IDB 실패는 non-fatal, `fsaWarning`("could not be remembered") 노출, `fsaError` 빈 채 유지

이유: IDB structuredClone DataCloneError(2026-05-21 e2e TIL `2026-05-21-idb-structuredclone-function-prop-dataclonerror-patch.md`)로 saveHandle 실패해도 handle state는 살아있어야 함.

## Cycle Commits Anchor

- `6cda4c5` (Phase 5 base): S1 Path Preview Card + S2 pickFolder 재작성 + S3 helper text
- `b94d362` (Phase 7.5 code): kbd 11→13px + (period) aria-hidden 라벨 + home folder hint
- `3756e83` (Phase 7.5 docs): tasks/ artifacts 갱신만
- `40cd00c` (Phase 7.5.6): kbd 13→15px font bump 마무리

## 관련 메모리

- [[project_auto-detect-flip-procedure]] — ON-flip 절차 + 본 UX iteration 1 발생 맥락
- [[feedback_coconutlabs-solo-no-review-request]] — solo 머지 정책

## 한계 (Known Won't Fix)

- Safari/Firefox FSA 미지원 — `"showDirectoryPicker" in window` 체크로 수동 폼 fallback
- Brave/Vivaldi 등 Chromium 파생 미테스트 — DOMException name 일관성 별 사이클 검증
- Client-side telemetry 미도입 — cancel/mismatch ratio counter 별 사이클
- Path Preview Card 다국어화 보류 — 영어 단일
- Finding 1 (모달 `?auto-detect=1` 자동 오픈 미동작) — `tasks/folder-picker-ux-finding1/` 별 사이클 이관

exec
/bin/zsh -lc "rg -n \"사이즈|괜찮음|owner-direct|owner direct|손글씨|7\\.5\\.6|40cd00c|둘 다 잘 보임|kbd|home folder|Phase 7\\.5\" tasks/folder-picker-ux docs/decision/decision-log.md ~/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md ~/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_auto-detect-flip-procedure.md ~/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/MEMORY.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:51:- Reveal hint 1줄: `Start from your home folder. Reveal hidden folders with ⌘⇧. (period) on macOS or Ctrl+H on Linux.`
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:55:## kbd 시인성 패턴 (Phase 7.5 + 7.5.6 누적)
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:59:- `font-size: 15px` (Phase 5 11px → Phase 7.5 13px → Phase 7.5.6 15px 2단계 bump)
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:63:- `<span className="kbd-label" aria-hidden="true">(period)</span>` 명시 라벨 (screen reader 흡수)
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:64:- aria-label 2건: kbd 요소에 직접 부여
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:66:WCAG AA 재확인(Phase 7.5.6): 15px kbd `#0A0A0A` on `#FAFAFA` = 18.97:1 ✅, `.kbd-label` `#525252` on `#FFFFFF` = 7.81:1 ✅.
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:82:- `b94d362` (Phase 7.5 code): kbd 11→13px + (period) aria-hidden 라벨 + home folder hint
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:83:- `3756e83` (Phase 7.5 docs): tasks/ artifacts 갱신만
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:84:- `40cd00c` (Phase 7.5.6): kbd 13→15px font bump 마무리
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_auto-detect-flip-procedure.md:29:**UX iteration 1 (2026-05-22)**: folder picker 가시성·에러 복구 patch — commits `6cda4c5`+`b94d362`+`3756e83`+`40cd00c`. 4 Finding 흡수 (Finding 1=별 사이클 이관, Finding 2/3=Phase 7.5 patch, Finding 4=Phase 7.5.6 patch). 참고: [[project-folder-picker-ux-2026-05-22]]
docs/decision/decision-log.md:353:- 문제: ON-flip 직후 production smoke test에서 ① 폴더 선택 불명확(picker 진입 시 "어떤 폴더를 골라야 하는지" 시각 cue 부재, Step 1 helper text 위계 약함) ② Chrome FSA 시스템 폴더 차단(`~` 홈 디렉터리 거절) 시 catch-all 단일 에러 메시지가 권한 문제로 오인 유도. 본 작업 진행 중 owner self-test에서 추가 발견 ③ kbd `⌘⇧.` 11px 시인성 부족 ④ "home folder 시작" 안내 부재 ⑤ `?auto-detect=1` 쿼리 모달 자동 오픈 안 함(Finding 1, 별 사이클 이관).
docs/decision/decision-log.md:356:- 선택 이유: First-impression UX 즉시 해소(production live state에서 catch-all 에러 → 4분기 actionable) + Invariant 5축 모두 보호 (#1 build secret 0, #2 WCAG AA 4.5:1, #3 auto-detect 진입 회귀 0, #4 error.name only, #5 handle React state ↔ IDB persistence 분리). Phase 7.5.6 closure 후 owner "사이즈 괜찮음" 발화로 가시성 마지막 결함도 해소.
docs/decision/decision-log.md:357:- 강한 증거: ON-flip 직후 owner production 자체검증에서 SecurityError 케이스 직접 발견 + 3 Codex 적대적 라운드 (Phase 1 IDB persistence MEDIUM → Plan v2 §B mitigation / Phase 6 Cell #2 AbortError CONCERN → Contingency Patch v2 count-based / Phase 7.5 kbd 시인성 + home folder 안내 발산 후 patch) 모두 의미 있는 결함 발견 + B3 5종 산출물(criteria/criteria-execution-log/diff/unverified/smoke-golden-regression) 누적 + Owner Happy Path 12+ cells (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1) owner 손글씨 직접 기록 + 4 commits production deploy (`6cda4c5`/`b94d362`/`3756e83`/`40cd00c`) 각 build secret leak 0 hits 재확인.
docs/decision/decision-log.md:360:- 무엇이 잘 됐나: ON-flip → owner self-test → 3 Finding(모달 자동 오픈 / kbd 시인성 / home folder 안내) 발견 → 단일 patch 사이클(Phase 7.5 + 7.5.6)로 2건 흡수, Finding 1만 별 사이클 이관. Codex 3 라운드(Phase 1/6/7.5) 모두 사각지대 검출 — Cell #2 AbortError(timing-based pivot 근거 확보), kbd 시인성(13→15px 2단계 bump 필요성). Invariant 5축이 매 Phase 머지 게이트로 작동해 production secret leak / a11y 회귀 / auto-detect 진입 회귀 0건 유지.
docs/decision/decision-log.md:361:- 다음엔 무엇을 바꿀까: ① ON-flip 전 staging 환경 owner self-test 단계 추가 — production 직행 시 owner가 즉시 결함을 발견하긴 했으나 staging이 있었다면 Finding 2/3/4를 Phase 5 이전에 흡수 가능. ② Phase 6 manual cells에 "microcopy 시인성"(kbd font-size 11px이 실사용 가독한가) 명시 항목 추가 — Phase 6 audit이 기능 검증에 집중해 시각 결함 누락. ③ DOMException dispatch 명세 불명확 시(MDN+WICG+Chromium 소스 3중 분석 필요) 사전 console 패치(window.showDirectoryPicker wrapper)로 `e.name` 실측 후 분기 설계 — Cell #2 Codex CONCERN을 patch-after-measure 패턴으로 1라운드 단축 가능.
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:1:# Phase 7.5 — Claude-in-Chrome Auxiliary Verification
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:4:**Mode**: Hybrid — Claude-in-Chrome 사전 자동 검증 + owner 1-2분 incognito 직접 확인 + smoke-golden-regression.md 직접 기록 (owner-direct gate 유지)
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:5:**Recording rule**: 본 파일은 **보조 증거** (auxiliary evidence). smoke-golden-regression.md "Phase 7.5 Production 재실측" 표의 cell은 여전히 **owner-direct manual record** 의무. harness-loop.md "Owner Happy Path 1회 직접 실행 게이트" 우회 X.
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:14:- **Owner manual run 대체 아님** — Phase 7.5.5 owner cell 재실측의 보조 (gate 우회 X)
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:20:### 1. kbd 시인성 + home folder copy + aria-label (Findings 2+3)
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:26:| hint text (full) | "From your home folder (~), open .claude/projects or .codex/sessions. Reveal hidden folders with ⌘⇧.(period) on macOS or Ctrl+H on Linux." | 정확 일치 | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:27:| `<kbd>` 수 | 2 | 2 | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:28:| kbd[0] text | `⌘⇧.` | `⌘⇧.` | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:29:| kbd[0] aria-label | `Command Shift Period` | `Command Shift Period` | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:30:| kbd[0] font-size | 13px (Edit 1 v2) | `13px` | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:31:| kbd[0] letter-spacing | 0.5px (Edit 1 v2) | `0.5px` | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:32:| kbd[0] padding | 2px 7px (Edit 1 v2) | `2px 7px` | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:33:| kbd[0] color/bg | `--fg #0A0A0A` on `--surface-muted #FAFAFA` | `rgb(10,10,10)` on `rgb(250,250,250)` | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:34:| kbd[1] text | `Ctrl+H` | `Ctrl+H` | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:35:| kbd[1] aria-label | `Control H` | `Control H` | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:36:| `.kbd-label` 수 | 1 | 1 | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:49:| kbd text `#0A0A0A` on bg `#FAFAFA` | 18.97:1 | AA 4.5:1 | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:50:| kbd-label `#525252` on `#FFFFFF` | 7.81:1 | AA 4.5:1 | ✅ |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:69:**Invariant #1 production 직접 검증 PASS** (Bot Challenge same-origin fetch 우회 동일 절차, `phase7-auxiliary-verification.md` 형식 차용). Phase 7 (`6cda4c5`) 707,406 B / 8 chunks → Phase 7.5 (`b94d362`) 394,084 B / 5 chunks — Next.js Turbopack chunk 재구성 결과 (코드 변경량 대비 자연스러운 변동).
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:77:- `smoke-golden-regression.md` "Phase 7.5 Production 재실측" 표의 ⏳ owner-direct 마커가 ✅로 바뀌려면 owner의 incognito 직접 실행 + 직접 기록 필요
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:78:- harness-loop.md "Owner Happy Path 1회 직접 실행 게이트" + golden-principles.md Tier1 #3 "Evidence-Based" 둘 다 owner 손글씨 게이트
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:81:본 파일이 owner에게 주는 가치: **사전 신뢰 부여** — owner 1-2분 incognito 확인 시 "이미 마크업·contrast·secret leak 검증됨, 내가 할 일은 시각 1회 + 손글씨 1줄"이라는 축약된 게이트 통과 경로 제공.
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:85:## owner 다음 액션 (1-2분, smoke-golden-regression.md Phase 7.5 표)
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:91:   - `⌘⇧.` kbd 13px 충분히 가독, `.`이 마침표가 아닌 **키 라벨**로 인지
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:93:   - "From your home folder" 안내 노출
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:95:4. `smoke-golden-regression.md` "Phase 7.5 Production 재실측" 표에 cell 1줄 owner 손으로 기록 (auto-append 금지 marker 우회 X)
tasks/folder-picker-ux/codex-phase7-findings.md:4:**Cycle**: Phase 7.5 (UX Findings 2+3 patch, Finding 1 별 사이클)
tasks/folder-picker-ux/codex-phase7-findings.md:30:  - Finding 2 → **본 사이클** (kbd 시인성)
tasks/folder-picker-ux/codex-phase7-findings.md:31:  - Finding 3 → **본 사이클** (home folder 안내)
tasks/folder-picker-ux/codex-phase7-findings.md:35:## 2. Finding 2 진단 — kbd 시인성
tasks/folder-picker-ux/codex-phase7-findings.md:41:.path-preview-hint kbd {
tasks/folder-picker-ux/codex-phase7-findings.md:55:  Hidden folders need: <kbd>⌘⇧.</kbd> (macOS) or <kbd>Ctrl+H</kbd> (Linux) in your file manager
tasks/folder-picker-ux/codex-phase7-findings.md:61:- kbd 박스: 32×19 px (`<kbd>⌘⇧.</kbd>`)
tasks/folder-picker-ux/codex-phase7-findings.md:71:.path-preview-hint kbd {
tasks/folder-picker-ux/codex-phase7-findings.md:84:- 13px = Path Preview row(13px JetBrains Mono)와 동일 사이즈 → 위계 충돌 우려 (검토 질문 #1)
tasks/folder-picker-ux/codex-phase7-findings.md:91:## 3. Finding 3 진단 — home folder 안내 부재
tasks/folder-picker-ux/codex-phase7-findings.md:99:- Path Preview Card row에 `~` symbol은 노출되나 "home folder" 명시 X
tasks/folder-picker-ux/codex-phase7-findings.md:109:  Start from your home folder. Reveal hidden folders with <kbd>⌘⇧.</kbd>
tasks/folder-picker-ux/codex-phase7-findings.md:110:  <span className="kbd-label">(period)</span> on macOS or <kbd>Ctrl+H</kbd> on Linux.
tasks/folder-picker-ux/codex-phase7-findings.md:114:**안 ②** (kbd 라벨만 추가, home folder 안내 없음):
tasks/folder-picker-ux/codex-phase7-findings.md:118:  Hidden folders need: <kbd>⌘⇧.</kbd>
tasks/folder-picker-ux/codex-phase7-findings.md:119:  <span className="kbd-label">(period)</span> on macOS or <kbd>Ctrl+H</kbd> on Linux in your file manager.
tasks/folder-picker-ux/codex-phase7-findings.md:123:### 신규 클래스 (`.kbd-label`)
tasks/folder-picker-ux/codex-phase7-findings.md:125:`app/globals.css` 2046 직후 (kbd 블록 직후):
tasks/folder-picker-ux/codex-phase7-findings.md:128:.path-preview-hint .kbd-label {
tasks/folder-picker-ux/codex-phase7-findings.md:137:- `--font-ui` (Inter) → kbd(JetBrains Mono)와 명시적 구분
tasks/folder-picker-ux/codex-phase7-findings.md:140:- `margin-left: 2px` → kbd 박스와 라벨 분리
tasks/folder-picker-ux/codex-phase7-findings.md:147:| `--font-mono` | `globals.css:11-69` | JetBrains Mono (kbd) |
tasks/folder-picker-ux/codex-phase7-findings.md:148:| `--fg` | `globals.css:11-69` | kbd text color (20.4:1 contrast) |
tasks/folder-picker-ux/codex-phase7-findings.md:150:| `--surface-muted` | `globals.css:11-69` | kbd background |
tasks/folder-picker-ux/codex-phase7-findings.md:151:| `--border` | `globals.css:11-69` | kbd border |
tasks/folder-picker-ux/codex-phase7-findings.md:161:13px kbd ≡ Path Preview row (13px JetBrains Mono). kbd가 row보다 강조되는 어색함은? row와 동일 사이즈로 가도 무방한가? 대안: 12px kbd (row 13px 대비 1px 작게).
tasks/folder-picker-ux/codex-phase7-findings.md:163:### Q2. Screen reader naturalness — `.kbd-label`
tasks/folder-picker-ux/codex-phase7-findings.md:165:`<span className="kbd-label">(period)</span>`이 VoiceOver/NVDA에서 자연스럽게 읽히는가? 또는 `<kbd>` 자체에 `aria-label="period key"`가 더 적절한가? 현재 hint `<kbd>⌘⇧.</kbd>`는 screen reader가 "command shift period"로 읽지 못할 수 있음 (Codex Phase 6 Q6 미해결 잔존).
tasks/folder-picker-ux/codex-phase7-findings.md:169:- 안 ①: "Start from your home folder. Reveal hidden folders with..." — 액션 순서 명시 (home → reveal)
tasks/folder-picker-ux/codex-phase7-findings.md:172:어느 쪽이 first-time 사용자에게 cognitive load 적은가? 안 ①은 길이 ↑이지만 액션 명료. 안 ②는 짧지만 home folder 명시 부재.
tasks/folder-picker-ux/codex-phase7-findings.md:174:### Q4. `~` symbol과 "home folder" 명시 중복 위험
tasks/folder-picker-ux/codex-phase7-findings.md:176:Path Preview Card row 1: `~ / .claude / projects`. hint에 "Start from your home folder" 명시 시 `~`와 의미 중복 — 노이즈 vs 보강?
tasks/folder-picker-ux/codex-phase7-findings.md:180:13px kbd + letter-spacing 0.5px + `--fg3` label 추가 후 재검토 항목:
tasks/folder-picker-ux/codex-phase7-findings.md:192:5. **추가 사각지대 (kbd a11y, microcopy 중복, font-size shift, letter-spacing UX 영향 등) 자유 기술**
tasks/folder-picker-ux/codex-phase7-findings.md:194:PASS 또는 nit-only → Phase 7.5.2 (3 Edits 적용) 진입.
tasks/folder-picker-ux/codex-phase7-findings.md:199:## 6. Patch v2 (Codex Phase 7.5.1 verdict 반영, 2026-05-22)
tasks/folder-picker-ux/codex-phase7-findings.md:207:| **MEDIUM** | `.kbd-label` color `var(--fg3)` WCAG AA 미달 (`#8E8E8E` on `#FFFFFF` = 3.28:1 / on `#FAFAFA` = 3.14:1, < 4.5:1) | §3 신규 클래스 | `--fg3` → `--fg2` (7.81:1 PASS) |
tasks/folder-picker-ux/codex-phase7-findings.md:208:| **MEDIUM** | `<span>(period)</span>`만으로 SR shortcut pronunciation 보장 X (`⌘⇧.`을 "command shift period"로 안 읽을 수 있음) | §3 안 ① JSX | macOS `<kbd>` `aria-label="Command Shift Period"` + `(period)` span `aria-hidden="true"` |
tasks/folder-picker-ux/codex-phase7-findings.md:209:| **LOW** | "Start from your home folder" → 사용자가 home folder 자체를 선택하는 것으로 오인 가능 (Cell #2 SecurityError 분기 트리거 위험) | §3 안 ① 첫 문장 | "From your home folder, open `.claude/projects` or `.codex/sessions`. Reveal hidden folders with…" — 액션 대상 명시 |
tasks/folder-picker-ux/codex-phase7-findings.md:210:| Q4 권장 | `~`과 "home folder" 한 번 연결 | §3 안 ① | "From your home folder (`~`)…" inline 연결 |
tasks/folder-picker-ux/codex-phase7-findings.md:212:### Edit 1 v2 (`app/globals.css:2038-2046` kbd 블록) — **v1과 동일**
tasks/folder-picker-ux/codex-phase7-findings.md:215:.path-preview-hint kbd {
tasks/folder-picker-ux/codex-phase7-findings.md:227:> codex Q1 PASS — 13px ≡ row 사이즈 이슈 없음 (keycap 스타일 + actionable shortcut). Q5 PASS — `--fg`(`#0A0A0A`) on `--surface-muted`(`#FAFAFA`) = 18.97:1 (codex node 계산 검증).
tasks/folder-picker-ux/codex-phase7-findings.md:229:### Edit 2 v2 (`app/globals.css` 신규 `.kbd-label`) — **color 변경**
tasks/folder-picker-ux/codex-phase7-findings.md:232:.path-preview-hint .kbd-label {
tasks/folder-picker-ux/codex-phase7-findings.md:246:  From your home folder (<code>~</code>), open <code>.claude/projects</code> or <code>.codex/sessions</code>. Reveal hidden folders with{" "}
tasks/folder-picker-ux/codex-phase7-findings.md:247:  <kbd aria-label="Command Shift Period">⌘⇧.</kbd>
tasks/folder-picker-ux/codex-phase7-findings.md:248:  <span className="kbd-label" aria-hidden="true">(period)</span> on macOS or{" "}
tasks/folder-picker-ux/codex-phase7-findings.md:249:  <kbd aria-label="Control H">Ctrl+H</kbd> on Linux.
tasks/folder-picker-ux/codex-phase7-findings.md:254:1. **MEDIUM mitigation #1** (SR pronunciation): `<kbd>` 양쪽에 `aria-label` 부여. `⌘⇧.` → "Command Shift Period", `Ctrl+H` → "Control H". `(period)` span에 `aria-hidden="true"`로 SR 중복 announcement 차단
tasks/folder-picker-ux/codex-phase7-findings.md:255:2. **LOW mitigation** (home folder 선택 오인): "Start from your home folder" → "From your home folder (`~`), open `.claude/projects` or `.codex/sessions`. Reveal hidden folders with…" — owner 의도 명확화 (home에서 출발하되 home을 picker로 고르지 않음)
tasks/folder-picker-ux/codex-phase7-findings.md:256:3. **Q4 연결**: `~` 토큰과 "home folder" 한 번에 묶음 (parenthetical) — Path Preview Card row의 `~` symbol과 hint의 "home folder" 의미 brige
tasks/folder-picker-ux/codex-phase7-findings.md:277:| `--font-ui` | Inter | `.kbd-label` font | — |
tasks/folder-picker-ux/codex-phase7-findings.md:278:| `--font-mono` | JetBrains Mono | kbd + code font | — |
tasks/folder-picker-ux/codex-phase7-findings.md:279:| `--fg` | `#0A0A0A` | kbd text color | 18.97:1 on `--surface-muted` ✅ |
tasks/folder-picker-ux/codex-phase7-findings.md:280:| `--fg2` | `#525252` | `.kbd-label` text color (v2) | 7.81:1 on `--bg` ✅ |
tasks/folder-picker-ux/codex-phase7-findings.md:281:| ~~`--fg3`~~ | ~~`#8E8E8E`~~ | ~~`.kbd-label` (v1)~~ | ~~3.28:1 ❌ 폐기~~ |
tasks/folder-picker-ux/codex-phase7-findings.md:282:| `--surface-muted` | `#FAFAFA` | kbd background | — |
tasks/folder-picker-ux/codex-phase7-findings.md:283:| `--border` | `#E5E7EB` | kbd border | — |
tasks/folder-picker-ux/codex-phase7-findings.md:306:3. **LOW 결함 완전 해소** 여부 (home folder 오인)
tasks/folder-picker-ux/codex-phase7-findings.md:311:v2도 MEDIUM 잔존 → 재시도 한도(1회) 소진 → 본 Phase 7.5 보류 + Findings 2/3을 Phase 8 별 사이클로 이관 (plan 7.5 중단 조건).
tasks/folder-picker-ux/codex-phase7-findings.md:320:- **MEDIUM contrast 해소**: `.kbd-label` `color: var(--fg2)` → `#525252` on `#FFFFFF` = 7.81:1 / on `#FAFAFA` = 7.49:1 (둘 다 AA PASS, codex node 계산 검증)
tasks/folder-picker-ux/codex-phase7-findings.md:321:- **MEDIUM SR pronunciation 정적 해소**: `<kbd aria-label="Command Shift Period">` + `<span aria-hidden="true">(period)</span>` 조합. 최종 발음은 owner 7.5.5 SR smoke로 확인 (런타임 영역으로 분리)
tasks/folder-picker-ux/codex-phase7-findings.md:322:- **LOW home folder 오인 해소**: "From your home folder (`~`), open `.claude/projects` or `.codex/sessions`" — 출발 위치와 목표 폴더 분리됨
tasks/folder-picker-ux/preflight-localhost-verification.md:21:| kbd labels | ✅ | `⌘⇧·`, `Ctrl+H` |
tasks/folder-picker-ux/preflight-localhost-verification.md:36:| `.path-preview-hint kbd` (label) | `rgb(10, 10, 10)` (`--fg` #0A0A0A) | `rgb(250, 250, 250)` (`--surface-muted` #FAFAFA) | 20.4:1 | ✅ AA |
tasks/folder-picker-ux/preflight-localhost-verification.md:81:- Does **not** mark any Phase 6 cell as passed — those remain owner-direct per harness-loop.md "owner 직접 기록 의무"
tasks/folder-picker-ux/codex-phase6.md:8:1. Cell #1 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:13` expects `~/.claude/projects` + `~/.codex/sessions` two row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux). The auto-detect branch renders the Path Preview Card before the picker buttons: `.claude / projects` is rendered at `components/forms/JoinBurnIndexForm.tsx:392-399`, `.codex / sessions` at `components/forms/JoinBurnIndexForm.tsx:400-406`, and the hint text with two `<kbd>` labels at `components/forms/JoinBurnIndexForm.tsx:407-409`. The new CSS selectors exist for the card and warning surface: `.path-preview-card` at `app/globals.css:2003-2012`, `.path-preview-row` at `app/globals.css:2013-2020`, `.path-segment` at `app/globals.css:2021-2024`, `.path-segment--hidden` at `app/globals.css:2025-2030`, `.path-preview-hint` at `app/globals.css:2031-2037`, `.path-preview-hint kbd` at `app/globals.css:2038-2046`, and `.form-warning` at `app/globals.css:2047-2056`.
tasks/folder-picker-ux/codex-phase6.md:10:2. Cell #2 — CONCERN. The literal `SecurityError` branch does produce the actionable message required by `tasks/folder-picker-ux/criteria.md:17` and `tasks/folder-picker-ux/smoke-golden-regression.md:14`: the code checks `e instanceof DOMException` at `components/forms/JoinBurnIndexForm.tsx:119`, checks `e.name === "SecurityError"` at `components/forms/JoinBurnIndexForm.tsx:121`, and sets `"Chrome blocked that folder because it contains system files. Drill down to your .claude/projects (or .codex/sessions) directory specifically — not your home folder."` at `components/forms/JoinBurnIndexForm.tsx:122-124`. The semantic gap is branch selection for the home-folder scenario: `AbortError` returns silently at `components/forms/JoinBurnIndexForm.tsx:120`, before the `SecurityError` branch. Current File System Access documentation lists too-sensitive/dangerous selected directories under `AbortError` DOMException, while `SecurityError` is for origin/user-activation blocking (MDN `showDirectoryPicker()` lines 235-243, https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker). The WICG algorithm also permits rejecting too-sensitive directory selection with `AbortError` (WICG File System Access lines 638-643, https://wicg.github.io/file-system-access/#api-showdirectorypicker), and Chromium plumbing maps sensitive-entry abort to `FileSystemAccessStatus::kOperationAborted` (Chromium `file_system_access_manager_impl.cc` lines 1405-1409, https://chromium.googlesource.com/chromium/src/+/refs/tags/133.0.6847.2/content/browser/file_system_access/file_system_access_manager_impl.cc), which Blink maps to `DOMExceptionCode::kAbortError` (Chromium `file_system_access_error.cc` search result for `kOperationAborted`, https://chromium.googlesource.com/chromium/src/+/4cfe86482b000e848009077783ba35f83f3c3cfe/third_party/blink/renderer/modules/file_system_access/file_system_access_error.cc). Static conclusion: if production Chrome reports home-folder rejection as `AbortError`, Cell #2 fails silently at `components/forms/JoinBurnIndexForm.tsx:120`. This requires real-incognito verification before owner completion.
tasks/folder-picker-ux/codex-phase6.md:34:Q6 — Finding: the `<kbd>` hint lacks an explicit screen-reader label. Severity: MEDIUM a11y risk, requires-runtime-verification. The semantic hint is plain text plus `<kbd>⌘⇧·</kbd>` and `<kbd>Ctrl+H</kbd>` at `components/forms/JoinBurnIndexForm.tsx:407-409`; CSS only changes visual styling at `app/globals.css:2038-2046`. There is no `aria-label`, visually hidden expansion, or alternate text such as "Command Shift Period" for the macOS glyph sequence. `tasks/folder-picker-ux/criteria.md:19` requires screen reader 인지 가능, so VoiceOver/NVDA pronunciation should be manually checked. Static code cannot prove whether VoiceOver announces the macOS shortcut usefully or as literal symbols.
tasks/folder-picker-ux/codex-phase6.md:40:Second priority: run the Cell #7 IDB failure check exactly as written, because the static state split is correct but the visible render timing should still be observed. Third priority: run the a11y check from `tasks/folder-picker-ux/criteria.md:19`, especially the `<kbd>⌘⇧·</kbd>` announcement. Finally, keep the rollback procedure framed as `env=false + redeploy`; `NEXT_PUBLIC_AUTO_DETECT_DEFAULT` is not a live runtime kill switch once the client bundle is built.
tasks/folder-picker-ux/smoke-golden-regression.md:15:| 1 | `https://www.coconutlabs.xyz/` 진입, Path Preview Card 시각 확인 | `~/.claude/projects` + `~/.codex/sessions` 두 row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux) | ✅ owner localhost | 2026-05-22 owner-direct on `localhost:3000/?auto-detect=1` (production redeploy 후 재실측 별도). 스크린샷: `issues/스크린샷 2026-05-22 오전 12.33.04.png`. 두 row + hint 모두 가시 |
tasks/folder-picker-ux/smoke-golden-regression.md:16:| 2 | "Pick .claude/projects" 클릭 → 홈 디렉터리(`~`) 선택 → Chrome dialog "다른 폴더 선택" 또는 "취소" 클릭 → 다시 "Pick .claude/projects" 클릭 → 홈 디렉터리 다시 선택 → 두 번째 거절 | **1차 시도**: silent (메시지 무노출, abortCount=1) / **2차 시도**: yellow `fsaWarning` 노출 — "Trouble picking the folder? Chrome blocks system folders like your home directory — drill into ~/.claude/projects (or ~/.codex/sessions) specifically." Korean Chrome dialog 떠도 우리 UI 메시지는 영어 동일. **Scan 버튼 enabled 유지** (fsaWarning은 non-fatal, fsaError 아님) | ✅ owner localhost | 2026-05-22 owner-direct: "1차에서는 아무것도 안 뜨고, 2차에서는 연두색 바탕 안에 [정확한 텍스트 일치]". Scan 버튼 enabled 유지 확인. 스크린샷: `issues/스크린샷 2026-05-22 오전 12.33.04.png` |
tasks/folder-picker-ux/smoke-golden-regression.md:17:| 3 | 다시 클릭 → `~/.claude` 자체 선택 → Chrome 권한 팝업 "허용" | Name mismatch 메시지에 `{h.name}` 동적 노출 — `You picked ".claude". We need the directory literally named "projects" (inside ~/.claude/ or ~/.codex/). Try again.` | ✅ owner localhost | 2026-05-22 owner-direct (Cell #3 페이지 reload 후 fresh state): 정확 텍스트 일치 / `.claude` 동적 표기 ✅ / `projects` 정확 노출 ✅ / hint 글리프 `⌘⇧.` 정상 (typo fix HMR 반영). 스크린샷 `issues/스크린샷 2026-05-22 오전 12.42.51.png` |
tasks/folder-picker-ux/smoke-golden-regression.md:18:| 4 | 다시 클릭 → `~/.claude/projects` 선택 | Error 0건, 핸들 저장, 다음 step 진행 | ✅ owner localhost | 2026-05-22 owner-direct: `Pick .claude/projects` 버튼 텍스트가 `✓ projects` 로 변경 + 강조 상태 / fsaError 클리어 ✅ / fsaWarning 클리어 ✅ / `Scan & preview` 버튼 enabled 유지 ✅ / Step 2 timeframe row 진행 노출. 스크린샷: `issues/스크린샷 2026-05-22 오전 12.46.29.png` |
tasks/folder-picker-ux/smoke-golden-regression.md:19:| 5 | 다시 클릭 → 시스템 dialog에서 cancel (1회) | Silent (form-error/warning 미노출, 카드 그대로). **전제**: Cell #4 성공 후 abortCount 0 리셋된 상태. Cell #4 미실행 시 직전 누적 카운트에 따라 fsaWarning 노출 가능 — 그 경우도 Cell #2 contract와 정합 | ✅ owner localhost (variant: 2회 cancel) | 2026-05-22 owner-direct: 2회 cancel 입력 → count cycle 검증 PASS. Cell #4 success로 `abortCountRef`가 0 리셋된 상태에서 0→1 (silent) → 1→2 (fsaWarning 노출, 정확 텍스트 일치) 흐름 재현. count-based heuristic post-reset 동작 확인. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.53.44.png`. **변형 사유**: 1회 cancel→silent 검증은 Cell #2 1차 + Cell #5 0→1 transition으로 이미 evidence 확보. 2회 cancel은 reset 후 cycle 재검증으로 더 강한 contract 확인 |
tasks/folder-picker-ux/smoke-golden-regression.md:20:| 6 | Safari로 동일 URL 진입 | "Join Burn Index" 수동 폼 fallback. Path Preview Card 미표시(auto-detect off) | ✅ owner localhost | 2026-05-22 owner-direct Safari: "Join Burn Index" 모달 노출 / STEP 1 RUN THE COLLECTOR (Python 3.11+ instructions + git clone snippet + Copy button) / STEP 2 UPLOAD YOUR BURN SUMMARY (handle input + file picker + JSON paste textarea + `Validate & preview` 버튼) / Path Preview Card 미표시 ✅ / Pick .claude/projects / .codex/sessions 버튼 미표시 ✅ / `⌘⇧.` hint 미표시 ✅. `"showDirectoryPicker" in window` 분기 (line 67-73) 정상 동작. 스크린샷 `issues/스크린샷 2026-05-22 오전 1.01.40.png` |
tasks/folder-picker-ux/smoke-golden-regression.md:21:| 7 | (v2 신규) Chrome DevTools > Application > Storage > Clear site data → IndexedDB throttle/block 시뮬레이션 후 `~/.claude/projects` 선택 | Handle UI에 `✓ projects` 표시 (claudeHandle React state set), `fsaError` 비어 있음, `fsaWarning`에 "Folder selected for this session, but it could not be remembered" 노출. Scan 버튼 enabled. 새로고침 후 handle 재선택 필요 (정상). 직접 시뮬레이션 불가 시 saveHandle 임시 throw로 대체 검사 (코드 검사 갈음) | ✅ owner 승인 코드 검사 | 2026-05-22 owner-direct decision (옵션 A 선택). `JoinBurnIndexForm.tsx:164-182` 4단계 분리 구조 검증: ① L167-168 `setFsaError("")` + `setFsaWarning("")` 클리어 / ② L170-171 `setClaudeHandle(h)` / `setCodexHandle(h)` **saveHandle 호출 BEFORE handle state 세팅** (Invariant #5 핵심) / ③ L176-177 `try { await saveHandle(kind, h) }` IDB persistence best-effort / ④ L178-182 catch에서 `setFsaWarning("Folder selected for this session, but it could not be remembered. You'll need to pick it again next time.")` 노출 + fsaError 미터치로 Scan 버튼 enabled 유지. **Invariant #5 (handle React state ↔ IDB persistence 분리) 코드 레벨 PASS** |
tasks/folder-picker-ux/smoke-golden-regression.md:31:**2026-05-22 Claude-in-Chrome 보조 검증 (Option B 하이브리드)** — Bot Challenge를 same-origin browser fetch로 우회해 **production main chunks 8개 전수 검사 = COLLECTOR_HMAC_SECRET 0건 (총 707KB 검사)**. Path Preview Card 마크업도 같은 세션에서 검증 완료 (2 rows + 2 hidden segments + hint + kbds 정확 일치). 상세: `phase7-auxiliary-verification.md`. **단 owner-direct manual record는 여전히 의무** — 본 표 cells #1/#4는 owner incognito 직접 실행 후 손으로 기록 (1-2분 축약 가능).
tasks/folder-picker-ux/smoke-golden-regression.md:35:| 1 (production redeploy 후) | ⏳ owner-direct | Chrome 최신 + incognito + `https://www.coconutlabs.xyz/?auto-detect=1` 진입. Path Preview Card 2 row + hint 노출 확인 후 본 표 1줄 직접 기록 >> 둘 다 잘 보임 |
tasks/folder-picker-ux/smoke-golden-regression.md:36:| 4 (production redeploy 후) | ⏳ owner-direct | `~/.claude/projects` 선택 → `✓ projects` 버튼 + fsaError/fsaWarning 0 + Scan 버튼 enabled 확인 후 본 표 1줄 직접 기록 >> 둘 다 잘 보임 |
tasks/folder-picker-ux/smoke-golden-regression.md:40:## Phase 7.5 Production 재실측 (Findings 2+3 patch, cell 1/1 필수)
tasks/folder-picker-ux/smoke-golden-regression.md:45:- production HTML + computed styles 실측: kbd 13px / `letter-spacing 0.5px` / `padding 2px 7px` / aria-label `Command Shift Period`·`Control H` / `(period)` 라벨 `aria-hidden=true` 11px Inter `--fg2` / `<code>` 3개 (`~`, `.claude/projects`, `.codex/sessions`) JetBrains Mono — **3/3 마크업 PASS**
tasks/folder-picker-ux/smoke-golden-regression.md:46:- WCAG AA: kbd `18.97:1` / label `7.81:1` / hint `7.81:1` / code `7.81:1` — **4/4 contrast PASS** (Edit 2 v2 `--fg3→--fg2` 회복 확인)
tasks/folder-picker-ux/smoke-golden-regression.md:49:**owner-direct manual record는 여전히 의무** — 본 표 cell은 owner incognito 직접 실행 후 손으로 기록 (1-2분 축약 가능, harness-loop "auto-append 금지" 게이트 유지).
tasks/folder-picker-ux/smoke-golden-regression.md:53:| 7.5 (kbd 시인성 + home folder + aria-label) | ⏳ owner-direct | Chrome 최신 + incognito + `https://www.coconutlabs.xyz/?auto-detect=1` 진입 → Hero "Join Burn Index" 클릭 → 모달 오픈 → ① `⌘⇧.` kbd 13px 가독 + `.`이 마침표가 아닌 키 라벨로 인지 ② `(period)` 라벨 명시 노출 ③ "From your home folder (~), open .claude/projects or .codex/sessions" 안내 노출 ④ (선택) VoiceOver(Cmd+F5)로 hint Tab → "Command Shift Period" / "Control H" 발음 확인 (Codex Q6 follow-up). 본 표 1줄 직접 기록 |
tasks/folder-picker-ux/smoke-golden-regression.md:65:**7/7 cells PASS** (owner-direct 6 cells + 코드 검사 1 cell)
tasks/folder-picker-ux/smoke-golden-regression.md:75:| 7 | ✅ | owner-direct decision 코드 검사 — Invariant #5 PASS |
tasks/folder-picker-ux/design-review-phase3.md:119:    Hidden folders need: <kbd>⌘⇧·</kbd> (macOS) or <kbd>Ctrl+H</kbd> (Linux) in your file manager
tasks/folder-picker-ux/codex-phase7.md:29:Q1 (visual hierarchy 13px kbd vs 13px row): ...
tasks/folder-picker-ux/codex-phase7.md:30:Q2 (kbd-label SR naturalness vs aria-label): ...
tasks/folder-picker-ux/codex-phase7.md:32:Q4 (~ symbol vs "home folder" microcopy redundancy): ...
tasks/folder-picker-ux/codex-phase7.md:39:Free-form: kbd a11y beyond Q2, microcopy issues, font shift side effects, letter-spacing rendering edge cases, etc.
tasks/folder-picker-ux/codex-phase7.md:121:  2038	.path-preview-hint kbd {
tasks/folder-picker-ux/codex-phase7.md:205:   423	              Hidden folders need: <kbd>⌘⇧.</kbd> (macOS) or <kbd>Ctrl+H</kbd> (Linux) in your file manager
tasks/folder-picker-ux/codex-phase7.md:258:**Cycle**: Phase 7.5 (UX Findings 2+3 patch, Finding 1 별 사이클)
tasks/folder-picker-ux/codex-phase7.md:284:  - Finding 2 → **본 사이클** (kbd 시인성)
tasks/folder-picker-ux/codex-phase7.md:285:  - Finding 3 → **본 사이클** (home folder 안내)
tasks/folder-picker-ux/codex-phase7.md:289:## 2. Finding 2 진단 — kbd 시인성
tasks/folder-picker-ux/codex-phase7.md:295:.path-preview-hint kbd {
tasks/folder-picker-ux/codex-phase7.md:309:  Hidden folders need: <kbd>⌘⇧.</kbd> (macOS) or <kbd>Ctrl+H</kbd> (Linux) in your file manager
tasks/folder-picker-ux/codex-phase7.md:315:- kbd 박스: 32×19 px (`<kbd>⌘⇧.</kbd>`)
tasks/folder-picker-ux/codex-phase7.md:325:.path-preview-hint kbd {
tasks/folder-picker-ux/codex-phase7.md:338:- 13px = Path Preview row(13px JetBrains Mono)와 동일 사이즈 → 위계 충돌 우려 (검토 질문 #1)
tasks/folder-picker-ux/codex-phase7.md:345:## 3. Finding 3 진단 — home folder 안내 부재
tasks/folder-picker-ux/codex-phase7.md:353:- Path Preview Card row에 `~` symbol은 노출되나 "home folder" 명시 X
tasks/folder-picker-ux/codex-phase7.md:363:  Start from your home folder. Reveal hidden folders with <kbd>⌘⇧.</kbd>
tasks/folder-picker-ux/codex-phase7.md:364:  <span className="kbd-label">(period)</span> on macOS or <kbd>Ctrl+H</kbd> on Linux.
tasks/folder-picker-ux/codex-phase7.md:368:**안 ②** (kbd 라벨만 추가, home folder 안내 없음):
tasks/folder-picker-ux/codex-phase7.md:372:  Hidden folders need: <kbd>⌘⇧.</kbd>
tasks/folder-picker-ux/codex-phase7.md:373:  <span className="kbd-label">(period)</span> on macOS or <kbd>Ctrl+H</kbd> on Linux in your file manager.
tasks/folder-picker-ux/codex-phase7.md:377:### 신규 클래스 (`.kbd-label`)
tasks/folder-picker-ux/codex-phase7.md:379:`app/globals.css` 2046 직후 (kbd 블록 직후):
tasks/folder-picker-ux/codex-phase7.md:382:.path-preview-hint .kbd-label {
tasks/folder-picker-ux/codex-phase7.md:391:- `--font-ui` (Inter) → kbd(JetBrains Mono)와 명시적 구분
tasks/folder-picker-ux/codex-phase7.md:394:- `margin-left: 2px` → kbd 박스와 라벨 분리
tasks/folder-picker-ux/codex-phase7.md:401:| `--font-mono` | `globals.css:11-69` | JetBrains Mono (kbd) |
tasks/folder-picker-ux/codex-phase7.md:402:| `--fg` | `globals.css:11-69` | kbd text color (20.4:1 contrast) |
tasks/folder-picker-ux/codex-phase7.md:404:| `--surface-muted` | `globals.css:11-69` | kbd background |
tasks/folder-picker-ux/codex-phase7.md:405:| `--border` | `globals.css:11-69` | kbd border |
tasks/folder-picker-ux/codex-phase7.md:415:13px kbd ≡ Path Preview row (13px JetBrains Mono). kbd가 row보다 강조되는 어색함은? row와 동일 사이즈로 가도 무방한가? 대안: 12px kbd (row 13px 대비 1px 작게).
tasks/folder-picker-ux/codex-phase7.md:417:### Q2. Screen reader naturalness — `.kbd-label`
tasks/folder-picker-ux/codex-phase7.md:419:`<span className="kbd-label">(period)</span>`이 VoiceOver/NVDA에서 자연스럽게 읽히는가? 또는 `<kbd>` 자체에 `aria-label="period key"`가 더 적절한가? 현재 hint `<kbd>⌘⇧.</kbd>`는 screen reader가 "command shift period"로 읽지 못할 수 있음 (Codex Phase 6 Q6 미해결 잔존).
tasks/folder-picker-ux/codex-phase7.md:423:- 안 ①: "Start from your home folder. Reveal hidden folders with..." — 액션 순서 명시 (home → reveal)
tasks/folder-picker-ux/codex-phase7.md:426:어느 쪽이 first-time 사용자에게 cognitive load 적은가? 안 ①은 길이 ↑이지만 액션 명료. 안 ②는 짧지만 home folder 명시 부재.
tasks/folder-picker-ux/codex-phase7.md:428:### Q4. `~` symbol과 "home folder" 명시 중복 위험
tasks/folder-picker-ux/codex-phase7.md:430:Path Preview Card row 1: `~ / .claude / projects`. hint에 "Start from your home folder" 명시 시 `~`와 의미 중복 — 노이즈 vs 보강?
tasks/folder-picker-ux/codex-phase7.md:434:13px kbd + letter-spacing 0.5px + `--fg3` label 추가 후 재검토 항목:
tasks/folder-picker-ux/codex-phase7.md:446:5. **추가 사각지대 (kbd a11y, microcopy 중복, font-size shift, letter-spacing UX 영향 등) 자유 기술**
tasks/folder-picker-ux/codex-phase7.md:448:PASS 또는 nit-only → Phase 7.5.2 (3 Edits 적용) 진입.
tasks/folder-picker-ux/codex-phase7.md:459:1. Cell #1 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:13` expects `~/.claude/projects` + `~/.codex/sessions` two row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux). The auto-detect branch renders the Path Preview Card before the picker buttons: `.claude / projects` is rendered at `components/forms/JoinBurnIndexForm.tsx:392-399`, `.codex / sessions` at `components/forms/JoinBurnIndexForm.tsx:400-406`, and the hint text with two `<kbd>` labels at `components/forms/JoinBurnIndexForm.tsx:407-409`. The new CSS selectors exist for the card and warning surface: `.path-preview-card` at `app/globals.css:2003-2012`, `.path-preview-row` at `app/globals.css:2013-2020`, `.path-segment` at `app/globals.css:2021-2024`, `.path-segment--hidden` at `app/globals.css:2025-2030`, `.path-preview-hint` at `app/globals.css:2031-2037`, `.path-preview-hint kbd` at `app/globals.css:2038-2046`, and `.form-warning` at `app/globals.css:2047-2056`.
tasks/folder-picker-ux/codex-phase7.md:461:2. Cell #2 — CONCERN. The literal `SecurityError` branch does produce the actionable message required by `tasks/folder-picker-ux/criteria.md:17` and `tasks/folder-picker-ux/smoke-golden-regression.md:14`: the code checks `e instanceof DOMException` at `components/forms/JoinBurnIndexForm.tsx:119`, checks `e.name === "SecurityError"` at `components/forms/JoinBurnIndexForm.tsx:121`, and sets `"Chrome blocked that folder because it contains system files. Drill down to your .claude/projects (or .codex/sessions) directory specifically — not your home folder."` at `components/forms/JoinBurnIndexForm.tsx:122-124`. The semantic gap is branch selection for the home-folder scenario: `AbortError` returns silently at `components/forms/JoinBurnIndexForm.tsx:120`, before the `SecurityError` branch. Current File System Access documentation lists too-sensitive/dangerous selected directories under `AbortError` DOMException, while `SecurityError` is for origin/user-activation blocking (MDN `showDirectoryPicker()` lines 235-243, https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker). The WICG algorithm also permits rejecting too-sensitive directory selection with `AbortError` (WICG File System Access lines 638-643, https://wicg.github.io/file-system-access/#api-showdirectorypicker), and Chromium plumbing maps sensitive-entry abort to `FileSystemAccessStatus::kOperationAborted` (Chromium `file_system_access_manager_impl.cc` lines 1405-1409, https://chromium.googlesource.com/chromium/src/+/refs/tags/133.0.6847.2/content/browser/file_system_access/file_system_access_manager_impl.cc), which Blink maps to `DOMExceptionCode::kAbortError` (Chromium `file_system_access_error.cc` search result for `kOperationAborted`, https://chromium.googlesource.com/chromium/src/+/4cfe86482b000e848009077783ba35f83f3c3cfe/third_party/blink/renderer/modules/file_system_access/file_system_access_error.cc). Static conclusion: if production Chrome reports home-folder rejection as `AbortError`, Cell #2 fails silently at `components/forms/JoinBurnIndexForm.tsx:120`. This requires real-incognito verification before owner completion.
tasks/folder-picker-ux/codex-phase7.md:485:Q6 — Finding: the `<kbd>` hint lacks an explicit screen-reader label. Severity: MEDIUM a11y risk, requires-runtime-verification. The semantic hint is plain text plus `<kbd>⌘⇧·</kbd>` and `<kbd>Ctrl+H</kbd>` at `components/forms/JoinBurnIndexForm.tsx:407-409`; CSS only changes visual styling at `app/globals.css:2038-2046`. There is no `aria-label`, visually hidden expansion, or alternate text such as "Command Shift Period" for the macOS glyph sequence. `tasks/folder-picker-ux/criteria.md:19` requires screen reader 인지 가능, so VoiceOver/NVDA pronunciation should be manually checked. Static code cannot prove whether VoiceOver announces the macOS shortcut usefully or as literal symbols.
tasks/folder-picker-ux/codex-phase7.md:491:Second priority: run the Cell #7 IDB failure check exactly as written, because the static state split is correct but the visible render timing should still be observed. Third priority: run the a11y check from `tasks/folder-picker-ux/criteria.md:19`, especially the `<kbd>⌘⇧·</kbd>` announcement. Finally, keep the rollback procedure framed as `env=false + redeploy`; `NEXT_PUBLIC_AUTO_DETECT_DEFAULT` is not a live runtime kill switch once the client bundle is built.
tasks/folder-picker-ux/codex-phase7.md:608:needs-attention(MEDIUM: `.kbd-label` contrast fails AA; MEDIUM: span-only `(period)` does not reliably solve kbd SR pronunciation)
tasks/folder-picker-ux/codex-phase7.md:611:Q1 (visual hierarchy 13px kbd vs 13px row): 13px is acceptable. The kbd sits in 12px hint text, has keycap styling, and represents an actionable shortcut, so matching the path row size is not a hierarchy bug. Watch line-height/wrap height.
tasks/folder-picker-ux/codex-phase7.md:613:Q2 (kbd-label SR naturalness vs aria-label): Use `aria-label` on the `<kbd>` for SR reliability. A visible `(period)` span helps sighted users, but SR may read an awkward symbol sequence plus “period”; best default is `aria-label="Command Shift Period"` and make the visual `(period)` `aria-hidden`.
tasks/folder-picker-ux/codex-phase7.md:615:Q3 (option 1 vs option 2 + recommended default): Option 1 is the better default because it answers the owner’s actual confusion: where to begin. I’d slightly tighten it to avoid implying “select home folder”: “From your home folder, reveal hidden folders with…”
tasks/folder-picker-ux/codex-phase7.md:617:Q4 (~ symbol vs "home folder" microcopy redundancy): Not harmful redundancy. `~` is developer shorthand; “home folder” is the user-facing translation. Best version connects them once: “From your home folder (`~`)…”
tasks/folder-picker-ux/codex-phase7.md:619:Q5 (WCAG AA recalc items: fg3 on bg contrast): `--fg` on `--surface-muted` still passes strongly: `#0A0A0A` on `#FAFAFA` is about 18.97:1. `--fg3` fails for normal text: `#8E8E8E` on `#FFFFFF` is about 3.28:1, and on `#FAFAFA` about 3.14:1. Use `--fg2` or a darker token for `.kbd-label`.
tasks/folder-picker-ux/codex-phase7.md:622:MEDIUM: `.kbd-label { color: var(--fg3); font-size: 11px; }` fails WCAG AA for normal text. Fix: use `var(--fg2)` or another color >= 4.5:1; `--fg2` is about 7.81:1 on white.
tasks/folder-picker-ux/codex-phase7.md:624:MEDIUM: `(period)` as visible text alone does not guarantee accessible shortcut pronunciation. Fix: add explicit `aria-label` to the macOS `<kbd>` and hide the visual clarification from SR if needed to avoid duplicate/awkward announcement.
tasks/folder-picker-ux/codex-phase7.md:626:LOW: “Start from your home folder” can be misread as selecting the home folder, which prior errors explicitly say not to do. Fix copy to “From your home folder, open `.claude/projects` or `.codex/sessions`; reveal hidden folders with…”
tasks/folder-picker-ux/codex-phase7.md:629:13px kbd plus `2px 7px` padding may increase inline box height and wrap differently inside the compact card; check mobile width.
tasks/folder-picker-ux/codex-phase7.md:637:needs-attention(MEDIUM: `.kbd-label` contrast fails AA; MEDIUM: span-only `(period)` does not reliably solve kbd SR pronunciation)
tasks/folder-picker-ux/codex-phase7.md:640:Q1 (visual hierarchy 13px kbd vs 13px row): 13px is acceptable. The kbd sits in 12px hint text, has keycap styling, and represents an actionable shortcut, so matching the path row size is not a hierarchy bug. Watch line-height/wrap height.
tasks/folder-picker-ux/codex-phase7.md:642:Q2 (kbd-label SR naturalness vs aria-label): Use `aria-label` on the `<kbd>` for SR reliability. A visible `(period)` span helps sighted users, but SR may read an awkward symbol sequence plus “period”; best default is `aria-label="Command Shift Period"` and make the visual `(period)` `aria-hidden`.
tasks/folder-picker-ux/codex-phase7.md:644:Q3 (option 1 vs option 2 + recommended default): Option 1 is the better default because it answers the owner’s actual confusion: where to begin. I’d slightly tighten it to avoid implying “select home folder”: “From your home folder, reveal hidden folders with…”
tasks/folder-picker-ux/codex-phase7.md:646:Q4 (~ symbol vs "home folder" microcopy redundancy): Not harmful redundancy. `~` is developer shorthand; “home folder” is the user-facing translation. Best version connects them once: “From your home folder (`~`)…”
tasks/folder-picker-ux/codex-phase7.md:648:Q5 (WCAG AA recalc items: fg3 on bg contrast): `--fg` on `--surface-muted` still passes strongly: `#0A0A0A` on `#FAFAFA` is about 18.97:1. `--fg3` fails for normal text: `#8E8E8E` on `#FFFFFF` is about 3.28:1, and on `#FAFAFA` about 3.14:1. Use `--fg2` or a darker token for `.kbd-label`.
tasks/folder-picker-ux/codex-phase7.md:651:MEDIUM: `.kbd-label { color: var(--fg3); font-size: 11px; }` fails WCAG AA for normal text. Fix: use `var(--fg2)` or another color >= 4.5:1; `--fg2` is about 7.81:1 on white.
tasks/folder-picker-ux/codex-phase7.md:653:MEDIUM: `(period)` as visible text alone does not guarantee accessible shortcut pronunciation. Fix: add explicit `aria-label` to the macOS `<kbd>` and hide the visual clarification from SR if needed to avoid duplicate/awkward announcement.
tasks/folder-picker-ux/codex-phase7.md:655:LOW: “Start from your home folder” can be misread as selecting the home folder, which prior errors explicitly say not to do. Fix copy to “From your home folder, open `.claude/projects` or `.codex/sessions`; reveal hidden folders with…”
tasks/folder-picker-ux/codex-phase7.md:658:13px kbd plus `2px 7px` padding may increase inline box height and wrap differently inside the compact card; check mobile width.
tasks/folder-picker-ux/diff.md:3:**Date**: 2026-05-22 (Phase 7.5.6 closure)
tasks/folder-picker-ux/diff.md:4:**Status**: Phase 7.5.6 완료 (Phase 5 base + Phase 7.5 hint/aria 강화 + Phase 7.5.6 kbd font 15px bump). 다음 단계 Phase 8 docs cycle.
tasks/folder-picker-ux/diff.md:28:## Phase 7.5 + 7.5.6 Subsequent Iterations
tasks/folder-picker-ux/diff.md:32:| `b94d362` | 2026-05-22 | fix(forms): folder picker kbd visibility + home folder hint | `JoinBurnIndexForm.tsx` + `app/globals.css` (hint copy rephrase + `<code>` 3개 + `(period)` aria-hidden 라벨 + `aria-label` 2건 + `.path-preview-hint kbd` font 11→13px + `.kbd-label` 신규 + `.path-preview-hint code` 신규) |
tasks/folder-picker-ux/diff.md:33:| `3756e83` | 2026-05-22 | docs(folder-picker-ux): Phase 7.5 patch docs | `tasks/folder-picker-ux/` artifacts 갱신만 (code 변경 0) |
tasks/folder-picker-ux/diff.md:34:| `40cd00c` | 2026-05-22 | fix(forms): bump path-preview kbd 13→15px | `app/globals.css` 1 file +2/-1 (font-size 13→15px, padding 2px 7px → 2px 8px, line-height 1.4 신규) |
tasks/folder-picker-ux/diff.md:36:**Phase 7.5 + 7.5.6 합산**: code 2 files (`JoinBurnIndexForm.tsx` + `app/globals.css`). Phase 5 base 위에 점진적 누적.
tasks/folder-picker-ux/diff.md:45:**Owner Happy Path Gate (Phase 7.5.6)**: owner 2026-05-22 production direct check + 발화 "사이즈 괜찮음" → `smoke-golden-regression.md` Phase 7.5 row owner-direct 손글씨 기록 ✅. mcp__claude-in-chrome computed style verify (font-size 15px / padding 2px 8px / line-height 21px) 부합.
tasks/folder-picker-ux/phase7-auxiliary-verification.md:4:**Mode**: Hybrid (Option B) — Claude-in-Chrome 사전 자동 검증 + owner 1-2분 incognito 직접 확인 + smoke-golden-regression.md 직접 기록 (owner-direct gate 유지)
tasks/folder-picker-ux/phase7-auxiliary-verification.md:5:**Recording rule**: 본 파일은 **보조 증거** (auxiliary evidence). smoke-golden-regression.md "Phase 7 Production 재실행" 표의 cells #1, #4는 여전히 **owner-direct manual record** 의무.
tasks/folder-picker-ux/phase7-auxiliary-verification.md:33:| `<kbd>` glyphs | `⌘⇧.` + `Ctrl+H` | 정확 일치 | ✅ |
tasks/folder-picker-ux/phase7-auxiliary-verification.md:58:- 노출 요소: Auto-detect Burn Summary modal / STEP 1 SELECT FOLDERS / Path Preview Card 2 row + hint + kbd / Select .claude/projects folder 버튼 + Select .codex/sessions folder 버튼 / STEP 2 CHOOSE PERIOD (week selected) / Scan & preview 버튼 / Advanced — import Python salt 토글
tasks/folder-picker-ux/phase7-auxiliary-verification.md:66:- `smoke-golden-regression.md` "Phase 7 Production 재실행" 표의 ⏳ owner-direct 마커가 ✅로 바뀌려면 owner의 incognito 직접 실행 + 직접 기록 필요
tasks/folder-picker-ux/phase7-auxiliary-verification.md:67:- harness-loop.md "Owner Happy Path 1회 직접 실행 게이트" + golden-principles.md Tier1 #3 "Evidence-Based" 둘 다 owner 손글씨 게이트
tasks/folder-picker-ux/phase7-auxiliary-verification.md:69:본 파일이 owner에게 주는 가치: **사전 신뢰 부여** — owner 1-2분 incognito 확인 시 "이미 마크업·secret leak 검증됨, 내가 할 일은 시각 1회 + 손글씨 1줄"이라는 축약된 게이트 통과 경로 제공.
tasks/folder-picker-ux/phase7-auxiliary-verification.md:77:3. Path Preview Card 2 row + `⌘⇧.` / `Ctrl+H` kbd 시각 확인
tasks/folder-picker-ux/criteria-execution-log.md:5:**Last updated**: Phase 7.5.6 closure (Vercel `40cd00c`) — 2026-05-22. Owner production direct check + "사이즈 괜찮음" 발화로 Owner Happy Path Gate 통과. 다음 단계: Phase 8 docs cycle (decision-log + memory + Finding 1 별 사이클 brief).
tasks/folder-picker-ux/criteria-execution-log.md:12:| 2 | Path Preview Card 시각 노출 | ✅ PASS (Phase 7.5.6 owner-direct closure) | `JoinBurnIndexForm.tsx:392-411` 마크업 삽입. globals.css 6 신규 클래스. **localhost:3000/?auto-detect=1 + Join modal 자동 검증 통과** (`preflight-localhost-verification.md`): 2 rows `~/.claude/projects` + `~/.codex/sessions`, 2 hidden segments outlined, hint + kbd labels rendered. **Phase 7 production (`6cda4c5`) Claude-in-Chrome 보조 검증** (`phase7-auxiliary-verification.md`): 2 rows + 2 hidden segments + hint + 2 kbds 정확 일치. **Phase 7.5 production (`b94d362`) 추가 검증** (`phase7.5-auxiliary-verification.md`): hint copy 갱신 ("From your home folder (~), open .claude/projects or .codex/sessions. Reveal hidden folders with ⌘⇧.(period) on macOS or Ctrl+H on Linux.") + `<code>` 3개 (`~`, `.claude/projects`, `.codex/sessions`) + `(period)` 라벨 + aria-label 2건 (`Command Shift Period`, `Control H`) 모두 정확 일치. **Phase 7.5.6 production deploy `40cd00c` (2026-05-22)**: mcp__claude-in-chrome computed style verify — font-size 15px / padding 2px 8px / line-height 21px; owner production direct check + 발화 "사이즈 괜찮음" → `smoke-golden-regression.md` Phase 7.5 row owner-direct 손글씨 기록 (Owner Happy Path Gate 통과). |
tasks/folder-picker-ux/criteria-execution-log.md:13:| 3 | AbortError silent | ✅ (code + Cell #5 owner localhost PASS) | `JoinBurnIndexForm.tsx:126-134` count-based — 1차 cancel silent (count 0→1), 2차 cancel fsaWarning 노출 (count 1→2). locale-independent (Invariant #4). **Cell #5 owner-direct (2026-05-22 localhost)**: 2회 cancel variant — Cell #4 success 직후 `abortCountRef`=0 리셋된 상태에서 0→1 silent + 1→2 fsaWarning 정확 텍스트 일치. count-based heuristic post-reset cycle 검증 PASS. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.53.44.png` |
tasks/folder-picker-ux/criteria-execution-log.md:14:| 4 | SecurityError actionable → AbortError count-based fsaWarning | ✅ (Cell #2 재실측 PASS, owner localhost) ⏳ (production cell #2 재실측) | **2026-05-22 Cell #2 1차 실측**: `[picker-rejection] {name: "AbortError", code: 20, message: "Failed to execute 'showDirectoryPicker' on 'Window': The user aborted a request."}` — Codex CONCERN 확인 CORRECT. Chrome은 홈 디렉터리 거절을 AbortError로 dispatch (SecurityError 아님). 단순 silent return이 SecurityError 분기를 preempt → 메시지 무노출. **Contingency Patch v2 (count-based) 적용** `JoinBurnIndexForm.tsx:99 + 126-134`: `abortCountRef = useRef<number>(0)` → 1회 silent / 2회 누적 시 `fsaWarning` (yellow, non-fatal). timing-based 1500ms 폐기 (picker 호출당 10-15초 → 1500ms 내 2회 불가능 → count-based pivot). Invariant #4 (e.name only) 유지. **검증 4종 PASS**: tsc / vitest 234/234 / build / `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0. **Cell #2 재실측 PASS (2026-05-22 owner-direct localhost)**: 1차 silent ✅ / 2차 연두색 fsaWarning 텍스트 정확 일치 ✅ / Scan 버튼 enabled 유지 ✅. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.33.04.png`. 잔여 = Phase 7 production redeploy 후 cell #2 재실측 |
tasks/folder-picker-ux/criteria-execution-log.md:15:| 5 | Name mismatch 동적 표기 | ✅ (code + Cell #3 owner localhost PASS) | `JoinBurnIndexForm.tsx:157-161` `You picked "${h.name}". We need the directory literally named "${expectedName}"…`. **Cell #3 owner-direct (2026-05-22 localhost)**: `~/.claude` 직접 선택 → 빨간 fsaError 노출, `.claude` 동적 + `projects` expected 정확 일치. typo fix `⌘⇧·` → `⌘⇧.` (line 423) 함께 검증. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.42.51.png` |
tasks/folder-picker-ux/criteria-execution-log.md:16:| 6 | a11y WCAG AA 4.5:1 + Tab order | ✅ (contrast + tab order + Phase 7.5 v2 회복 + Phase 7.5.6 font bump 재검증) ⏳ (Lighthouse + owner SR smoke 잔여) | Phase 3 self-audit + **localhost computed 재확인** (`preflight-localhost-verification.md`): `--fg2 rgb(82,82,82)` on `--bg rgb(255,255,255)` = **7.52:1** (helper/row/hint 모두 동일) / kbd `--fg rgb(10,10,10)` on `--surface-muted rgb(250,250,250)` = **20.4:1** / `--young-coconut-dark` outline-only(text 미사용). Tab 순서 10 tabbables: close 첫 → 2 pickers → 5 timeframe → 폼 필드 = 자연 순서. **Phase 7.5 v2 contrast 회복** (`phase7.5-auxiliary-verification.md`): Edit 2 v2 `.kbd-label` 색상을 `--fg3 #8E8E8E` (3.28:1 AA fail) → `--fg2 #525252` (codex v2 권장 반영)으로 변경 → **production 재계산 PASS**: kbd `18.97:1` / label `7.81:1` / hint `7.81:1` / code (inherit `--fg2`) `7.81:1`. **a11y 추가 강화** (Edit 3 v2 신규 클래스 `.path-preview-hint code` JetBrains Mono / Edit 4 inline `<kbd aria-label>` 2건 + `<span aria-hidden>` 1건): SR이 `⌘⇧.`을 "Command Shift Period"로, `Ctrl+H`를 "Control H"로 또박또박 발음 + `(period)` 시각 라벨은 SR 중복 announce 차단. **Phase 7.5.6 patch 후 contrast 재확인** (font-size 13→15px / padding 2px 7px → 2px 8px / line-height 1.4 신규): 15px kbd `#0A0A0A` on `#FAFAFA` = **18.97:1** ✅ (font-size 증가에도 색상 무변 → ratio 동일), `.kbd-label` `#525252` on `#FFFFFF` = **7.81:1** ✅. Lighthouse + owner VoiceOver smoke 잔여 (Codex Q6 follow-up — task #14) |
tasks/folder-picker-ux/criteria-execution-log.md:28:| 11 | Owner Happy Path 6 cells | ⏳ partial — 7/7 auto-simulated + Codex 검토 완료 (**needs-attention**) | **`preflight-phase6-simulated.md` 7/7 cells PASS (auto)**: Cell #1 inherited + Cell #2-#5 monkey-patched `showDirectoryPicker` 4분기 + Cell #6 no-query 네비게이션 manual form + Cell #7 `indexedDB.open` 패치 fsaWarning + Invariant #5. **Codex Phase 6 (`codex-phase6.md` 13261 bytes) 완료 — verdict: needs-attention**. Cell-by-cell: #1/#3/#4/#5/#6/#7 ✅ PASS / **#2 ⚠️ CONCERN MEDIUM** (AbortError vs SecurityError dispatch — MDN+WICG+Chromium source citations). Q1 LOW (Step 4 timing ✅) / Q2 MEDIUM (DOMException cross-Chromium 일부 unverified) / Q3 MEDIUM (parent-path validation gap, 별 사이클) / Q4 LOW (NEXT_PUBLIC build-time, redeploy 절차 정합) / Q5 INFO (English UI 영구) / Q6 MEDIUM (kbd SR 미검증). owner real-incognito + production은 여전히 의무 (smoke-golden-regression.md owner-직접-기록 invariant). **🔴 P1 = Cell #2 real `~` pick + `e.name` 로깅 (Phase 6 단일 차단 후보)**. |
tasks/folder-picker-ux/codex-phase8-input.md:11:Phase 7.5.6 closure (commit `40cd00c`, owner production self-test "사이즈 괜찮음") 후 Phase 8 docs cycle 진입. 8.1A (3 기존 산출물 갱신) + 8.1B (3 신규 산출물 작성) + 8.2 (Finding 1 별 사이클 brief) 완료. 본 Phase 8.3은 **commit 전 fact-check** — 신규 산출물의 사실 정확성·overclaim 위험·frontmatter 준수·회고 패턴·invariant 정의를 적대적 검토.
tasks/folder-picker-ux/codex-phase8-input.md:19:5. **Cycle 4 commits git log** — 확인 명령: `git log --oneline 6cda4c5..40cd00c -- 'components/forms/JoinBurnIndexForm.tsx' 'app/globals.css'`
tasks/folder-picker-ux/codex-phase8-input.md:30:- "Owner Happy Path 12+ cells (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1) 직접 기록"
tasks/folder-picker-ux/codex-phase8-input.md:31:- "4 commits production deploy (`6cda4c5`/`b94d362`/`3756e83`/`40cd00c`) 각 build secret leak 0 hits"
tasks/folder-picker-ux/codex-phase8-input.md:35:- `tasks/folder-picker-ux/smoke-golden-regression.md` 실제 owner-direct 손글씨 cells 카운트가 정확히 12+ 인지 (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1 합산 = 11)
tasks/folder-picker-ux/codex-phase8-input.md:55:- kbd 시인성 사양 (15px / 2px 8px / 0.5px / 1.4 / aria-hidden 라벨 — 구체 숫자 다수)
tasks/folder-picker-ux/codex-phase8-input.md:57:- 4 commit hash 인용 (`6cda4c5`/`b94d362`/`3756e83`/`40cd00c`)
tasks/folder-picker-ux/codex-phase8-input.md:76:- **잘 됐나**: "ON-flip → owner self-test → 3 Finding 발견 → 단일 patch 사이클(Phase 7.5 + 7.5.6)로 2건 흡수, Finding 1만 별 사이클 이관. Codex 3 라운드(Phase 1/6/7.5) 모두 사각지대 검출"
tasks/folder-picker-ux/codex-phase8-input.md:77:- **바꿀까**: "① ON-flip 전 staging 환경 owner self-test 단계 추가 ② Phase 6 manual cells에 'microcopy 시인성'(kbd font-size 11px이 실사용 가독한가) 명시 항목 추가 ③ DOMException dispatch 명세 불명확 시 사전 console 패치(window.showDirectoryPicker wrapper)로 e.name 실측 후 분기 설계"
tasks/folder-picker-ux/unverified.md:3:**Date**: 2026-05-22 (Phase 7.5.6 closure)
tasks/folder-picker-ux/unverified.md:34:## Phase 7.5.6 Closure (2026-05-22)
tasks/folder-picker-ux/unverified.md:36:- **Trigger**: Phase 7.5 deploy 후 owner 추가 발화 "사이즈는 좀 키워야겠음. 좀 더 키워줘" — kbd 13px 여전히 작아 보임. font-size 1단계 추가 bump.
tasks/folder-picker-ux/unverified.md:37:- **Patch**: `app/globals.css` `.path-preview-hint kbd` font-size 13→15px / padding 2px 7px → 2px 8px / line-height 1.4 신규. 색상·letter-spacing·token 무변.
tasks/folder-picker-ux/unverified.md:38:- **검증**: `npx tsc --noEmit` ✅ / `npx vitest run` 234/234 ✅ / `npm run build` ✅ / `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0 ✅. WCAG AA contrast 재계산 PASS (font-size 변동은 ratio 무관 — 15px kbd `#0A0A0A` on `#FAFAFA` = 18.97:1, `.kbd-label` `#525252` on `#FFFFFF` = 7.81:1, 둘 다 ≥ 4.5:1).
tasks/folder-picker-ux/unverified.md:39:- **Deploy**: Vercel commit `40cd00c` auto-deploy 완료.
tasks/folder-picker-ux/unverified.md:40:- **Owner Happy Path Gate**: Phase 7.5.6 (40cd00c) 2026-05-22 owner-direct production check ✅ + mcp computed style verify ✅ (font-size 15px / padding 2px 8px / line-height 21px) + owner 발화 "사이즈 괜찮음". `smoke-golden-regression.md` Phase 7.5 row owner-direct 손글씨 기록 완료. 잔여 미검증 unchanged (Brave/Vivaldi, telemetry counter, parent-path validation Q3).
tasks/folder-picker-ux/preflight-phase6-simulated.md:21:| WCAG AA computed contrast (from preflight-localhost-verification.md) | Screen reader announcement of kbd glyphs |
tasks/folder-picker-ux/preflight-phase6-simulated.md:38:- Reveal hint kbd labels: `⌘⇧·` + `Ctrl+H`
tasks/folder-picker-ux/preflight-phase6-simulated.md:52:  "errorText": "Chrome blocked that folder because it contains system files. Drill down to your .claude/projects (or .codex/sessions) directory specifically — not your home folder.",
tasks/folder-picker-ux/preflight-phase6-simulated.md:65:**Owner residual (ELEVATED PRIORITY)**: real Chrome incognito + selecting `~` (home folder).
tasks/folder-picker-ux/preflight-phase6-simulated.md:201:- **P3 🟢 Cells #1/#3/#4/#5/#6 + a11y** — confirm dynamic simulations match real-Chrome behavior + VoiceOver/NVDA announcement of `<kbd>⌘⇧·</kbd>`.
tasks/folder-picker-ux/preflight-phase6-simulated.md:232:| Q6 | `<kbd>⌘⇧·</kbd>` screen reader announcement | MEDIUM | No `aria-label` or visually-hidden expansion. VoiceOver/NVDA may pronounce literal symbols. Requires runtime check |
tasks/folder-picker-ux/preflight-phase6-simulated.md:238:3. **Cell a11y (criteria.md:19)** — especially `<kbd>⌘⇧·</kbd>` VoiceOver/NVDA announcement.
tasks/folder-picker-ux/preflight-phase6-simulated.md:260:- `smoke-golden-regression.md` — owner-direct invariant preserved per harness-loop.md "Owner Happy Path 1회 직접 실행 게이트". All entries there require owner real-incognito hand-written ✅/❌.
tasks/folder-picker-ux/codex-phase1.md:32:- `e instanceof DOMException && e.name === "SecurityError"` → "Chrome blocked that folder because it contains system files. Drill down to your **~/.claude/projects** (or **~/.codex/sessions**) directory specifically — not your home folder."
tasks/folder-picker-ux/codex-phase1.md:46:현 문구 (line 348-350): "Select only the exact directory shown below — not your home folder."
tasks/folder-picker-ux/codex-phase1.md:165:          Select only the exact directory shown below — not your home folder.
tasks/folder-picker-ux/codex-phase8.md:24:Phase 7.5.6 closure (commit `40cd00c`, owner production self-test "사이즈 괜찮음") 후 Phase 8 docs cycle 진입. 8.1A (3 기존 산출물 갱신) + 8.1B (3 신규 산출물 작성) + 8.2 (Finding 1 별 사이클 brief) 완료. 본 Phase 8.3은 **commit 전 fact-check** — 신규 산출물의 사실 정확성·overclaim 위험·frontmatter 준수·회고 패턴·invariant 정의를 적대적 검토.
tasks/folder-picker-ux/codex-phase8.md:32:5. **Cycle 4 commits git log** — 확인 명령: `git log --oneline 6cda4c5..40cd00c -- 'components/forms/JoinBurnIndexForm.tsx' 'app/globals.css'`
tasks/folder-picker-ux/codex-phase8.md:43:- "Owner Happy Path 12+ cells (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1) 직접 기록"
tasks/folder-picker-ux/codex-phase8.md:44:- "4 commits production deploy (`6cda4c5`/`b94d362`/`3756e83`/`40cd00c`) 각 build secret leak 0 hits"
tasks/folder-picker-ux/codex-phase8.md:48:- `tasks/folder-picker-ux/smoke-golden-regression.md` 실제 owner-direct 손글씨 cells 카운트가 정확히 12+ 인지 (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1 합산 = 11)
tasks/folder-picker-ux/codex-phase8.md:68:- kbd 시인성 사양 (15px / 2px 8px / 0.5px / 1.4 / aria-hidden 라벨 — 구체 숫자 다수)
tasks/folder-picker-ux/codex-phase8.md:70:- 4 commit hash 인용 (`6cda4c5`/`b94d362`/`3756e83`/`40cd00c`)
tasks/folder-picker-ux/codex-phase8.md:89:- **잘 됐나**: "ON-flip → owner self-test → 3 Finding 발견 → 단일 patch 사이클(Phase 7.5 + 7.5.6)로 2건 흡수, Finding 1만 별 사이클 이관. Codex 3 라운드(Phase 1/6/7.5) 모두 사각지대 검출"
tasks/folder-picker-ux/codex-phase8.md:90:- **바꿀까**: "① ON-flip 전 staging 환경 owner self-test 단계 추가 ② Phase 6 manual cells에 'microcopy 시인성'(kbd font-size 11px이 실사용 가독한가) 명시 항목 추가 ③ DOMException dispatch 명세 불명확 시 사전 console 패치(window.showDirectoryPicker wrapper)로 e.name 실측 후 분기 설계"
tasks/folder-picker-ux/codex-phase8.md:368:- 문제: ON-flip 직후 production smoke test에서 ① 폴더 선택 불명확(picker 진입 시 "어떤 폴더를 골라야 하는지" 시각 cue 부재, Step 1 helper text 위계 약함) ② Chrome FSA 시스템 폴더 차단(`~` 홈 디렉터리 거절) 시 catch-all 단일 에러 메시지가 권한 문제로 오인 유도. 본 작업 진행 중 owner self-test에서 추가 발견 ③ kbd `⌘⇧.` 11px 시인성 부족 ④ "home folder 시작" 안내 부재 ⑤ `?auto-detect=1` 쿼리 모달 자동 오픈 안 함(Finding 1, 별 사이클 이관).
tasks/folder-picker-ux/codex-phase8.md:371:- 선택 이유: First-impression UX 즉시 해소(production live state에서 catch-all 에러 → 4분기 actionable) + Invariant 5축 모두 보호 (#1 build secret 0, #2 WCAG AA 4.5:1, #3 auto-detect 진입 회귀 0, #4 error.name only, #5 handle React state ↔ IDB persistence 분리). Phase 7.5.6 closure 후 owner "사이즈 괜찮음" 발화로 가시성 마지막 결함도 해소.
tasks/folder-picker-ux/codex-phase8.md:372:- 강한 증거: ON-flip 직후 owner production 자체검증에서 SecurityError 케이스 직접 발견 + 3 Codex 적대적 라운드 (Phase 1 IDB persistence MEDIUM → Plan v2 §B mitigation / Phase 6 Cell #2 AbortError CONCERN → Contingency Patch v2 count-based / Phase 7.5 kbd 시인성 + home folder 안내 발산 후 patch) 모두 의미 있는 결함 발견 + B3 5종 산출물(criteria/criteria-execution-log/diff/unverified/smoke-golden-regression) 누적 + Owner Happy Path 12+ cells (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1) owner 손글씨 직접 기록 + 4 commits production deploy (`6cda4c5`/`b94d362`/`3756e83`/`40cd00c`) 각 build secret leak 0 hits 재확인.
tasks/folder-picker-ux/codex-phase8.md:375:- 무엇이 잘 됐나: ON-flip → owner self-test → 3 Finding(모달 자동 오픈 / kbd 시인성 / home folder 안내) 발견 → 단일 patch 사이클(Phase 7.5 + 7.5.6)로 2건 흡수, Finding 1만 별 사이클 이관. Codex 3 라운드(Phase 1/6/7.5) 모두 사각지대 검출 — Cell #2 AbortError(timing-based pivot 근거 확보), kbd 시인성(13→15px 2단계 bump 필요성). Invariant 5축이 매 Phase 머지 게이트로 작동해 production secret leak / a11y 회귀 / auto-detect 진입 회귀 0건 유지.
tasks/folder-picker-ux/codex-phase8.md:376:- 다음엔 무엇을 바꿀까: ① ON-flip 전 staging 환경 owner self-test 단계 추가 — production 직행 시 owner가 즉시 결함을 발견하긴 했으나 staging이 있었다면 Finding 2/3/4를 Phase 5 이전에 흡수 가능. ② Phase 6 manual cells에 "microcopy 시인성"(kbd font-size 11px이 실사용 가독한가) 명시 항목 추가 — Phase 6 audit이 기능 검증에 집중해 시각 결함 누락. ③ DOMException dispatch 명세 불명확 시(MDN+WICG+Chromium 소스 3중 분석 필요) 사전 console 패치(window.showDirectoryPicker wrapper)로 `e.name` 실측 후 분기 설계 — Cell #2 Codex CONCERN을 patch-after-measure 패턴으로 1라운드 단축 가능.
tasks/folder-picker-ux/codex-phase8.md:379:/bin/zsh -lc "git log --oneline 6cda4c5..40cd00c -- 'components/forms/JoinBurnIndexForm.tsx' 'app/globals.css'" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
tasks/folder-picker-ux/codex-phase8.md:381:40cd00c fix(forms): bump path-preview kbd 13→15px for legibility
tasks/folder-picker-ux/codex-phase8.md:382:b94d362 fix(forms): folder picker kbd visibility + home folder hint
tasks/folder-picker-ux/codex-phase8.md:418:- `e instanceof DOMException && e.name === "SecurityError"` → "Chrome blocked that folder because it contains system files. Drill down to your **~/.claude/projects** (or **~/.codex/sessions**) directory specifically — not your home folder."
tasks/folder-picker-ux/codex-phase8.md:432:현 문구 (line 348-350): "Select only the exact directory shown below — not your home folder."
tasks/folder-picker-ux/codex-phase8.md:551:          Select only the exact directory shown below — not your home folder.
tasks/folder-picker-ux/codex-phase8.md:618:1. Cell #1 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:13` expects `~/.claude/projects` + `~/.codex/sessions` two row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux). The auto-detect branch renders the Path Preview Card before the picker buttons: `.claude / projects` is rendered at `components/forms/JoinBurnIndexForm.tsx:392-399`, `.codex / sessions` at `components/forms/JoinBurnIndexForm.tsx:400-406`, and the hint text with two `<kbd>` labels at `components/forms/JoinBurnIndexForm.tsx:407-409`. The new CSS selectors exist for the card and warning surface: `.path-preview-card` at `app/globals.css:2003-2012`, `.path-preview-row` at `app/globals.css:2013-2020`, `.path-segment` at `app/globals.css:2021-2024`, `.path-segment--hidden` at `app/globals.css:2025-2030`, `.path-preview-hint` at `app/globals.css:2031-2037`, `.path-preview-hint kbd` at `app/globals.css:2038-2046`, and `.form-warning` at `app/globals.css:2047-2056`.
tasks/folder-picker-ux/codex-phase8.md:620:2. Cell #2 — CONCERN. The literal `SecurityError` branch does produce the actionable message required by `tasks/folder-picker-ux/criteria.md:17` and `tasks/folder-picker-ux/smoke-golden-regression.md:14`: the code checks `e instanceof DOMException` at `components/forms/JoinBurnIndexForm.tsx:119`, checks `e.name === "SecurityError"` at `components/forms/JoinBurnIndexForm.tsx:121`, and sets `"Chrome blocked that folder because it contains system files. Drill down to your .claude/projects (or .codex/sessions) directory specifically — not your home folder."` at `components/forms/JoinBurnIndexForm.tsx:122-124`. The semantic gap is branch selection for the home-folder scenario: `AbortError` returns silently at `components/forms/JoinBurnIndexForm.tsx:120`, before the `SecurityError` branch. Current File System Access documentation lists too-sensitive/dangerous selected directories under `AbortError` DOMException, while `SecurityError` is for origin/user-activation blocking (MDN `showDirectoryPicker()` lines 235-243, https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker). The WICG algorithm also permits rejecting too-sensitive directory selection with `AbortError` (WICG File System Access lines 638-643, https://wicg.github.io/file-system-access/#api-showdirectorypicker), and Chromium plumbing maps sensitive-entry abort to `FileSystemAccessStatus::kOperationAborted` (Chromium `file_system_access_manager_impl.cc` lines 1405-1409, https://chromium.googlesource.com/chromium/src/+/refs/tags/133.0.6847.2/content/browser/file_system_access/file_system_access_manager_impl.cc), which Blink maps to `DOMExceptionCode::kAbortError` (Chromium `file_system_access_error.cc` search result for `kOperationAborted`, https://chromium.googlesource.com/chromium/src/+/4cfe86482b000e848009077783ba35f83f3c3cfe/third_party/blink/renderer/modules/file_system_access/file_system_access_error.cc). Static conclusion: if production Chrome reports home-folder rejection as `AbortError`, Cell #2 fails silently at `components/forms/JoinBurnIndexForm.tsx:120`. This requires real-incognito verification before owner completion.
tasks/folder-picker-ux/codex-phase8.md:644:Q6 — Finding: the `<kbd>` hint lacks an explicit screen-reader label. Severity: MEDIUM a11y risk, requires-runtime-verification. The semantic hint is plain text plus `<kbd>⌘⇧·</kbd>` and `<kbd>Ctrl+H</kbd>` at `components/forms/JoinBurnIndexForm.tsx:407-409`; CSS only changes visual styling at `app/globals.css:2038-2046`. There is no `aria-label`, visually hidden expansion, or alternate text such as "Command Shift Period" for the macOS glyph sequence. `tasks/folder-picker-ux/criteria.md:19` requires screen reader 인지 가능, so VoiceOver/NVDA pronunciation should be manually checked. Static code cannot prove whether VoiceOver announces the macOS shortcut usefully or as literal symbols.
tasks/folder-picker-ux/codex-phase8.md:650:Second priority: run the Cell #7 IDB failure check exactly as written, because the static state split is correct but the visible render timing should still be observed. Third priority: run the a11y check from `tasks/folder-picker-ux/criteria.md:19`, especially the `<kbd>⌘⇧·</kbd>` announcement. Finally, keep the rollback procedure framed as `env=false + redeploy`; `NEXT_PUBLIC_AUTO_DETECT_DEFAULT` is not a live runtime kill switch once the client bundle is built.
tasks/folder-picker-ux/codex-phase8.md:683:Q1 (visual hierarchy 13px kbd vs 13px row): ...
tasks/folder-picker-ux/codex-phase8.md:684:Q2 (kbd-label SR naturalness vs aria-label): ...
tasks/folder-picker-ux/codex-phase8.md:686:Q4 (~ symbol vs "home folder" microcopy redundancy): ...
tasks/folder-picker-ux/codex-phase8.md:693:Free-form: kbd a11y beyond Q2, microcopy issues, font shift side effects, letter-spacing rendering edge cases, etc.
tasks/folder-picker-ux/codex-phase8.md:775:  2038	.path-preview-hint kbd {
tasks/folder-picker-ux/codex-phase8.md:859:   423	              Hidden folders need: <kbd>⌘⇧.</kbd> (macOS) or <kbd>Ctrl+H</kbd> (Linux) in your file manager
tasks/folder-picker-ux/codex-phase8.md:912:**Cycle**: Phase 7.5 (UX Findings 2+3 patch, Finding 1 별 사이클)
tasks/folder-picker-ux/codex-phase8.md:917:The first pass confirms Phase 6 is explicitly `needs-attention`, and the supplied git range only lists two path-touching commits (`b94d362`, `40cd00c`). I’m now checking the owner-cell count and the final B3 state because Q1 hinges on whether the decision-log’s “12+” and “4 commits” claims are materially overcounted.
tasks/folder-picker-ux/codex-phase8.md:935:| 1 | `https://www.coconutlabs.xyz/` 진입, Path Preview Card 시각 확인 | `~/.claude/projects` + `~/.codex/sessions` 두 row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux) | ✅ owner localhost | 2026-05-22 owner-direct on `localhost:3000/?auto-detect=1` (production redeploy 후 재실측 별도). 스크린샷: `issues/스크린샷 2026-05-22 오전 12.33.04.png`. 두 row + hint 모두 가시 |
tasks/folder-picker-ux/codex-phase8.md:936:| 2 | "Pick .claude/projects" 클릭 → 홈 디렉터리(`~`) 선택 → Chrome dialog "다른 폴더 선택" 또는 "취소" 클릭 → 다시 "Pick .claude/projects" 클릭 → 홈 디렉터리 다시 선택 → 두 번째 거절 | **1차 시도**: silent (메시지 무노출, abortCount=1) / **2차 시도**: yellow `fsaWarning` 노출 — "Trouble picking the folder? Chrome blocks system folders like your home directory — drill into ~/.claude/projects (or ~/.codex/sessions) specifically." Korean Chrome dialog 떠도 우리 UI 메시지는 영어 동일. **Scan 버튼 enabled 유지** (fsaWarning은 non-fatal, fsaError 아님) | ✅ owner localhost | 2026-05-22 owner-direct: "1차에서는 아무것도 안 뜨고, 2차에서는 연두색 바탕 안에 [정확한 텍스트 일치]". Scan 버튼 enabled 유지 확인. 스크린샷: `issues/스크린샷 2026-05-22 오전 12.33.04.png` |
tasks/folder-picker-ux/codex-phase8.md:937:| 3 | 다시 클릭 → `~/.claude` 자체 선택 → Chrome 권한 팝업 "허용" | Name mismatch 메시지에 `{h.name}` 동적 노출 — `You picked ".claude". We need the directory literally named "projects" (inside ~/.claude/ or ~/.codex/). Try again.` | ✅ owner localhost | 2026-05-22 owner-direct (Cell #3 페이지 reload 후 fresh state): 정확 텍스트 일치 / `.claude` 동적 표기 ✅ / `projects` 정확 노출 ✅ / hint 글리프 `⌘⇧.` 정상 (typo fix HMR 반영). 스크린샷 `issues/스크린샷 2026-05-22 오전 12.42.51.png` |
tasks/folder-picker-ux/codex-phase8.md:938:| 4 | 다시 클릭 → `~/.claude/projects` 선택 | Error 0건, 핸들 저장, 다음 step 진행 | ✅ owner localhost | 2026-05-22 owner-direct: `Pick .claude/projects` 버튼 텍스트가 `✓ projects` 로 변경 + 강조 상태 / fsaError 클리어 ✅ / fsaWarning 클리어 ✅ / `Scan & preview` 버튼 enabled 유지 ✅ / Step 2 timeframe row 진행 노출. 스크린샷: `issues/스크린샷 2026-05-22 오전 12.46.29.png` |
tasks/folder-picker-ux/codex-phase8.md:939:| 5 | 다시 클릭 → 시스템 dialog에서 cancel (1회) | Silent (form-error/warning 미노출, 카드 그대로). **전제**: Cell #4 성공 후 abortCount 0 리셋된 상태. Cell #4 미실행 시 직전 누적 카운트에 따라 fsaWarning 노출 가능 — 그 경우도 Cell #2 contract와 정합 | ✅ owner localhost (variant: 2회 cancel) | 2026-05-22 owner-direct: 2회 cancel 입력 → count cycle 검증 PASS. Cell #4 success로 `abortCountRef`가 0 리셋된 상태에서 0→1 (silent) → 1→2 (fsaWarning 노출, 정확 텍스트 일치) 흐름 재현. count-based heuristic post-reset 동작 확인. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.53.44.png`. **변형 사유**: 1회 cancel→silent 검증은 Cell #2 1차 + Cell #5 0→1 transition으로 이미 evidence 확보. 2회 cancel은 reset 후 cycle 재검증으로 더 강한 contract 확인 |
tasks/folder-picker-ux/codex-phase8.md:940:| 6 | Safari로 동일 URL 진입 | "Join Burn Index" 수동 폼 fallback. Path Preview Card 미표시(auto-detect off) | ✅ owner localhost | 2026-05-22 owner-direct Safari: "Join Burn Index" 모달 노출 / STEP 1 RUN THE COLLECTOR (Python 3.11+ instructions + git clone snippet + Copy button) / STEP 2 UPLOAD YOUR BURN SUMMARY (handle input + file picker + JSON paste textarea + `Validate & preview` 버튼) / Path Preview Card 미표시 ✅ / Pick .claude/projects / .codex/sessions 버튼 미표시 ✅ / `⌘⇧.` hint 미표시 ✅. `"showDirectoryPicker" in window` 분기 (line 67-73) 정상 동작. 스크린샷 `issues/스크린샷 2026-05-22 오전 1.01.40.png` |
tasks/folder-picker-ux/codex-phase8.md:941:| 7 | (v2 신규) Chrome DevTools > Application > Storage > Clear site data → IndexedDB throttle/block 시뮬레이션 후 `~/.claude/projects` 선택 | Handle UI에 `✓ projects` 표시 (claudeHandle React state set), `fsaError` 비어 있음, `fsaWarning`에 "Folder selected for this session, but it could not be remembered" 노출. Scan 버튼 enabled. 새로고침 후 handle 재선택 필요 (정상). 직접 시뮬레이션 불가 시 saveHandle 임시 throw로 대체 검사 (코드 검사 갈음) | ✅ owner 승인 코드 검사 | 2026-05-22 owner-direct decision (옵션 A 선택). `JoinBurnIndexForm.tsx:164-182` 4단계 분리 구조 검증: ① L167-168 `setFsaError("")` + `setFsaWarning("")` 클리어 / ② L170-171 `setClaudeHandle(h)` / `setCodexHandle(h)` **saveHandle 호출 BEFORE handle state 세팅** (Invariant #5 핵심) / ③ L176-177 `try { await saveHandle(kind, h) }` IDB persistence best-effort / ④ L178-182 catch에서 `setFsaWarning("Folder selected for this session, but it could not be remembered. You'll need to pick it again next time.")` 노출 + fsaError 미터치로 Scan 버튼 enabled 유지. **Invariant #5 (handle React state ↔ IDB persistence 분리) 코드 레벨 PASS** |
tasks/folder-picker-ux/codex-phase8.md:951:**2026-05-22 Claude-in-Chrome 보조 검증 (Option B 하이브리드)** — Bot Challenge를 same-origin browser fetch로 우회해 **production main chunks 8개 전수 검사 = COLLECTOR_HMAC_SECRET 0건 (총 707KB 검사)**. Path Preview Card 마크업도 같은 세션에서 검증 완료 (2 rows + 2 hidden segments + hint + kbds 정확 일치). 상세: `phase7-auxiliary-verification.md`. **단 owner-direct manual record는 여전히 의무** — 본 표 cells #1/#4는 owner incognito 직접 실행 후 손으로 기록 (1-2분 축약 가능).
tasks/folder-picker-ux/codex-phase8.md:955:| 1 (production redeploy 후) | ⏳ owner-direct | Chrome 최신 + incognito + `https://www.coconutlabs.xyz/?auto-detect=1` 진입. Path Preview Card 2 row + hint 노출 확인 후 본 표 1줄 직접 기록 >> 둘 다 잘 보임 |
tasks/folder-picker-ux/codex-phase8.md:956:| 4 (production redeploy 후) | ⏳ owner-direct | `~/.claude/projects` 선택 → `✓ projects` 버튼 + fsaError/fsaWarning 0 + Scan 버튼 enabled 확인 후 본 표 1줄 직접 기록 >> 둘 다 잘 보임 |
tasks/folder-picker-ux/codex-phase8.md:960:## Phase 7.5 Production 재실측 (Findings 2+3 patch, cell 1/1 필수)
tasks/folder-picker-ux/codex-phase8.md:965:- production HTML + computed styles 실측: kbd 13px / `letter-spacing 0.5px` / `padding 2px 7px` / aria-label `Command Shift Period`·`Control H` / `(period)` 라벨 `aria-hidden=true` 11px Inter `--fg2` / `<code>` 3개 (`~`, `.claude/projects`, `.codex/sessions`) JetBrains Mono — **3/3 마크업 PASS**
tasks/folder-picker-ux/codex-phase8.md:966:- WCAG AA: kbd `18.97:1` / label `7.81:1` / hint `7.81:1` / code `7.81:1` — **4/4 contrast PASS** (Edit 2 v2 `--fg3→--fg2` 회복 확인)
tasks/folder-picker-ux/codex-phase8.md:969:**owner-direct manual record는 여전히 의무** — 본 표 cell은 owner incognito 직접 실행 후 손으로 기록 (1-2분 축약 가능, harness-loop "auto-append 금지" 게이트 유지).
tasks/folder-picker-ux/codex-phase8.md:973:| 7.5 (kbd 시인성 + home folder + aria-label) | ⏳ owner-direct | Chrome 최신 + incognito + `https://www.coconutlabs.xyz/?auto-detect=1` 진입 → Hero "Join Burn Index" 클릭 → 모달 오픈 → ① `⌘⇧.` kbd 13px 가독 + `.`이 마침표가 아닌 키 라벨로 인지 ② `(period)` 라벨 명시 노출 ③ "From your home folder (~), open .claude/projects or .codex/sessions" 안내 노출 ④ (선택) VoiceOver(Cmd+F5)로 hint Tab → "Command Shift Period" / "Control H" 발음 확인 (Codex Q6 follow-up). 본 표 1줄 직접 기록 |
tasks/folder-picker-ux/codex-phase8.md:985:**7/7 cells PASS** (owner-direct 6 cells + 코드 검사 1 cell)
tasks/folder-picker-ux/codex-phase8.md:995:| 7 | ✅ | owner-direct decision 코드 검사 — Invariant #5 PASS |
tasks/folder-picker-ux/codex-phase8.md:1023:tasks/folder-picker-ux/codex-phase7-findings.md:165:`<span className="kbd-label">(period)</span>`이 VoiceOver/NVDA에서 자연스럽게 읽히는가? 또는 `<kbd>` 자체에 `aria-label="period key"`가 더 적절한가? 현재 hint `<kbd>⌘⇧.</kbd>`는 screen reader가 "command shift period"로 읽지 못할 수 있음 (Codex Phase 6 Q6 미해결 잔존).
tasks/folder-picker-ux/codex-phase8.md:1026:tasks/folder-picker-ux/codex-phase7-findings.md:194:PASS 또는 nit-only → Phase 7.5.2 (3 Edits 적용) 진입.
tasks/folder-picker-ux/codex-phase8.md:1028:tasks/folder-picker-ux/codex-phase7-findings.md:199:## 6. Patch v2 (Codex Phase 7.5.1 verdict 반영, 2026-05-22)
tasks/folder-picker-ux/codex-phase8.md:1031:tasks/folder-picker-ux/codex-phase7-findings.md:207:| **MEDIUM** | `.kbd-label` color `var(--fg3)` WCAG AA 미달 (`#8E8E8E` on `#FFFFFF` = 3.28:1 / on `#FAFAFA` = 3.14:1, < 4.5:1) | §3 신규 클래스 | `--fg3` → `--fg2` (7.81:1 PASS) |
tasks/folder-picker-ux/codex-phase8.md:1032:tasks/folder-picker-ux/codex-phase7-findings.md:208:| **MEDIUM** | `<span>(period)</span>`만으로 SR shortcut pronunciation 보장 X (`⌘⇧.`을 "command shift period"로 안 읽을 수 있음) | §3 안 ① JSX | macOS `<kbd>` `aria-label="Command Shift Period"` + `(period)` span `aria-hidden="true"` |
tasks/folder-picker-ux/codex-phase8.md:1033:tasks/folder-picker-ux/codex-phase7-findings.md:227:> codex Q1 PASS — 13px ≡ row 사이즈 이슈 없음 (keycap 스타일 + actionable shortcut). Q5 PASS — `--fg`(`#0A0A0A`) on `--surface-muted`(`#FAFAFA`) = 18.97:1 (codex node 계산 검증).
tasks/folder-picker-ux/codex-phase8.md:1035:tasks/folder-picker-ux/codex-phase7-findings.md:254:1. **MEDIUM mitigation #1** (SR pronunciation): `<kbd>` 양쪽에 `aria-label` 부여. `⌘⇧.` → "Command Shift Period", `Ctrl+H` → "Control H". `(period)` span에 `aria-hidden="true"`로 SR 중복 announcement 차단
tasks/folder-picker-ux/codex-phase8.md:1041:tasks/folder-picker-ux/codex-phase7-findings.md:311:v2도 MEDIUM 잔존 → 재시도 한도(1회) 소진 → 본 Phase 7.5 보류 + Findings 2/3을 Phase 8 별 사이클로 이관 (plan 7.5 중단 조건).
tasks/folder-picker-ux/codex-phase8.md:1044:tasks/folder-picker-ux/codex-phase7-findings.md:320:- **MEDIUM contrast 해소**: `.kbd-label` `color: var(--fg2)` → `#525252` on `#FFFFFF` = 7.81:1 / on `#FAFAFA` = 7.49:1 (둘 다 AA PASS, codex node 계산 검증)
tasks/folder-picker-ux/codex-phase8.md:1045:tasks/folder-picker-ux/codex-phase7-findings.md:321:- **MEDIUM SR pronunciation 정적 해소**: `<kbd aria-label="Command Shift Period">` + `<span aria-hidden="true">(period)</span>` 조합. 최종 발음은 owner 7.5.5 SR smoke로 확인 (런타임 영역으로 분리)
tasks/folder-picker-ux/codex-phase8.md:1052:tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:69:**Invariant #1 production 직접 검증 PASS** (Bot Challenge same-origin fetch 우회 동일 절차, `phase7-auxiliary-verification.md` 형식 차용). Phase 7 (`6cda4c5`) 707,406 B / 8 chunks → Phase 7.5 (`b94d362`) 394,084 B / 5 chunks — Next.js Turbopack chunk 재구성 결과 (코드 변경량 대비 자연스러운 변동).
tasks/folder-picker-ux/codex-phase8.md:1056:tasks/folder-picker-ux/codex-phase6.md:8:1. Cell #1 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:13` expects `~/.claude/projects` + `~/.codex/sessions` two row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux). The auto-detect branch renders the Path Preview Card before the picker buttons: `.claude / projects` is rendered at `components/forms/JoinBurnIndexForm.tsx:392-399`, `.codex / sessions` at `components/forms/JoinBurnIndexForm.tsx:400-406`, and the hint text with two `<kbd>` labels at `components/forms/JoinBurnIndexForm.tsx:407-409`. The new CSS selectors exist for the card and warning surface: `.path-preview-card` at `app/globals.css:2003-2012`, `.path-preview-row` at `app/globals.css:2013-2020`, `.path-segment` at `app/globals.css:2021-2024`, `.path-segment--hidden` at `app/globals.css:2025-2030`, `.path-preview-hint` at `app/globals.css:2031-2037`, `.path-preview-hint kbd` at `app/globals.css:2038-2046`, and `.form-warning` at `app/globals.css:2047-2056`.
tasks/folder-picker-ux/codex-phase8.md:1065:tasks/folder-picker-ux/codex-phase6.md:34:Q6 — Finding: the `<kbd>` hint lacks an explicit screen-reader label. Severity: MEDIUM a11y risk, requires-runtime-verification. The semantic hint is plain text plus `<kbd>⌘⇧·</kbd>` and `<kbd>Ctrl+H</kbd>` at `components/forms/JoinBurnIndexForm.tsx:407-409`; CSS only changes visual styling at `app/globals.css:2038-2046`. There is no `aria-label`, visually hidden expansion, or alternate text such as "Command Shift Period" for the macOS glyph sequence. `tasks/folder-picker-ux/criteria.md:19` requires screen reader 인지 가능, so VoiceOver/NVDA pronunciation should be manually checked. Static code cannot prove whether VoiceOver announces the macOS shortcut usefully or as literal symbols.
tasks/folder-picker-ux/codex-phase8.md:1082:tasks/folder-picker-ux/codex-phase7.md:419:`<span className="kbd-label">(period)</span>`이 VoiceOver/NVDA에서 자연스럽게 읽히는가? 또는 `<kbd>` 자체에 `aria-label="period key"`가 더 적절한가? 현재 hint `<kbd>⌘⇧.</kbd>`는 screen reader가 "command shift period"로 읽지 못할 수 있음 (Codex Phase 6 Q6 미해결 잔존).
tasks/folder-picker-ux/codex-phase8.md:1085:tasks/folder-picker-ux/codex-phase7.md:448:PASS 또는 nit-only → Phase 7.5.2 (3 Edits 적용) 진입.
tasks/folder-picker-ux/codex-phase8.md:1089:tasks/folder-picker-ux/codex-phase7.md:459:1. Cell #1 — PASS. `tasks/folder-picker-ux/smoke-golden-regression.md:13` expects `~/.claude/projects` + `~/.codex/sessions` two row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux). The auto-detect branch renders the Path Preview Card before the picker buttons: `.claude / projects` is rendered at `components/forms/JoinBurnIndexForm.tsx:392-399`, `.codex / sessions` at `components/forms/JoinBurnIndexForm.tsx:400-406`, and the hint text with two `<kbd>` labels at `components/forms/JoinBurnIndexForm.tsx:407-409`. The new CSS selectors exist for the card and warning surface: `.path-preview-card` at `app/globals.css:2003-2012`, `.path-preview-row` at `app/globals.css:2013-2020`, `.path-segment` at `app/globals.css:2021-2024`, `.path-segment--hidden` at `app/globals.css:2025-2030`, `.path-preview-hint` at `app/globals.css:2031-2037`, `.path-preview-hint kbd` at `app/globals.css:2038-2046`, and `.form-warning` at `app/globals.css:2047-2056`.
tasks/folder-picker-ux/codex-phase8.md:1098:tasks/folder-picker-ux/codex-phase7.md:485:Q6 — Finding: the `<kbd>` hint lacks an explicit screen-reader label. Severity: MEDIUM a11y risk, requires-runtime-verification. The semantic hint is plain text plus `<kbd>⌘⇧·</kbd>` and `<kbd>Ctrl+H</kbd>` at `components/forms/JoinBurnIndexForm.tsx:407-409`; CSS only changes visual styling at `app/globals.css:2038-2046`. There is no `aria-label`, visually hidden expansion, or alternate text such as "Command Shift Period" for the macOS glyph sequence. `tasks/folder-picker-ux/criteria.md:19` requires screen reader 인지 가능, so VoiceOver/NVDA pronunciation should be manually checked. Static code cannot prove whether VoiceOver announces the macOS shortcut usefully or as literal symbols.
tasks/folder-picker-ux/codex-phase8.md:1100:tasks/folder-picker-ux/codex-phase7.md:608:needs-attention(MEDIUM: `.kbd-label` contrast fails AA; MEDIUM: span-only `(period)` does not reliably solve kbd SR pronunciation)
tasks/folder-picker-ux/codex-phase8.md:1101:tasks/folder-picker-ux/codex-phase7.md:622:MEDIUM: `.kbd-label { color: var(--fg3); font-size: 11px; }` fails WCAG AA for normal text. Fix: use `var(--fg2)` or another color >= 4.5:1; `--fg2` is about 7.81:1 on white.
tasks/folder-picker-ux/codex-phase8.md:1102:tasks/folder-picker-ux/codex-phase7.md:624:MEDIUM: `(period)` as visible text alone does not guarantee accessible shortcut pronunciation. Fix: add explicit `aria-label` to the macOS `<kbd>` and hide the visual clarification from SR if needed to avoid duplicate/awkward announcement.
tasks/folder-picker-ux/codex-phase8.md:1104:tasks/folder-picker-ux/codex-phase7.md:637:needs-attention(MEDIUM: `.kbd-label` contrast fails AA; MEDIUM: span-only `(period)` does not reliably solve kbd SR pronunciation)
tasks/folder-picker-ux/codex-phase8.md:1105:tasks/folder-picker-ux/codex-phase7.md:651:MEDIUM: `.kbd-label { color: var(--fg3); font-size: 11px; }` fails WCAG AA for normal text. Fix: use `var(--fg2)` or another color >= 4.5:1; `--fg2` is about 7.81:1 on white.
tasks/folder-picker-ux/codex-phase8.md:1106:tasks/folder-picker-ux/codex-phase7.md:653:MEDIUM: `(period)` as visible text alone does not guarantee accessible shortcut pronunciation. Fix: add explicit `aria-label` to the macOS `<kbd>` and hide the visual clarification from SR if needed to avoid duplicate/awkward announcement.
tasks/folder-picker-ux/codex-phase8.md:1109:/bin/zsh -lc 'for c in 6cda4c5 b94d362 3756e83 40cd00c; do git show --stat --oneline --name-only --no-renames "$c" -- '"'components/forms/JoinBurnIndexForm.tsx' 'app/globals.css'; done" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
tasks/folder-picker-ux/codex-phase8.md:1114:b94d362 fix(forms): folder picker kbd visibility + home folder hint
tasks/folder-picker-ux/codex-phase8.md:1117:40cd00c fix(forms): bump path-preview kbd 13→15px for legibility
tasks/folder-picker-ux/codex-phase8.md:1126:3756e83 docs(folder-picker-ux): Phase 7.5 handoff — owner re-measure template
tasks/folder-picker-ux/codex-phase8.md:1135:* 40cd00c (HEAD -> main, origin/main, origin/HEAD) fix(forms): bump path-preview kbd 13→15px for legibility
tasks/folder-picker-ux/codex-phase8.md:1136:* 3756e83 docs(folder-picker-ux): Phase 7.5 handoff — owner re-measure template
tasks/folder-picker-ux/codex-phase8.md:1137:* b94d362 fix(forms): folder picker kbd visibility + home folder hint
tasks/folder-picker-ux/codex-phase8.md:1159:**Last updated**: Phase 7.5.6 closure (Vercel `40cd00c`) — 2026-05-22. Owner production direct check + "사이즈 괜찮음" 발화로 Owner Happy Path Gate 통과. 다음 단계: Phase 8 docs cycle (decision-log + memory + Finding 1 별 사이클 brief).
tasks/folder-picker-ux/codex-phase8.md:1166:| 2 | Path Preview Card 시각 노출 | ✅ PASS (Phase 7.5.6 owner-direct closure) | `JoinBurnIndexForm.tsx:392-411` 마크업 삽입. globals.css 6 신규 클래스. **localhost:3000/?auto-detect=1 + Join modal 자동 검증 통과** (`preflight-localhost-verification.md`): 2 rows `~/.claude/projects` + `~/.codex/sessions`, 2 hidden segments outlined, hint + kbd labels rendered. **Phase 7 production (`6cda4c5`) Claude-in-Chrome 보조 검증** (`phase7-auxiliary-verification.md`): 2 rows + 2 hidden segments + hint + 2 kbds 정확 일치. **Phase 7.5 production (`b94d362`) 추가 검증** (`phase7.5-auxiliary-verification.md`): hint copy 갱신 ("From your home folder (~), open .claude/projects or .codex/sessions. Reveal hidden folders with ⌘⇧.(period) on macOS or Ctrl+H on Linux.") + `<code>` 3개 (`~`, `.claude/projects`, `.codex/sessions`) + `(period)` 라벨 + aria-label 2건 (`Command Shift Period`, `Control H`) 모두 정확 일치. **Phase 7.5.6 production deploy `40cd00c` (2026-05-22)**: mcp__claude-in-chrome computed style verify — font-size 15px / padding 2px 8px / line-height 21px; owner production direct check + 발화 "사이즈 괜찮음" → `smoke-golden-regression.md` Phase 7.5 row owner-direct 손글씨 기록 (Owner Happy Path Gate 통과). |
tasks/folder-picker-ux/codex-phase8.md:1167:| 3 | AbortError silent | ✅ (code + Cell #5 owner localhost PASS) | `JoinBurnIndexForm.tsx:126-134` count-based — 1차 cancel silent (count 0→1), 2차 cancel fsaWarning 노출 (count 1→2). locale-independent (Invariant #4). **Cell #5 owner-direct (2026-05-22 localhost)**: 2회 cancel variant — Cell #4 success 직후 `abortCountRef`=0 리셋된 상태에서 0→1 silent + 1→2 fsaWarning 정확 텍스트 일치. count-based heuristic post-reset cycle 검증 PASS. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.53.44.png` |
tasks/folder-picker-ux/codex-phase8.md:1168:| 4 | SecurityError actionable → AbortError count-based fsaWarning | ✅ (Cell #2 재실측 PASS, owner localhost) ⏳ (production cell #2 재실측) | **2026-05-22 Cell #2 1차 실측**: `[picker-rejection] {name: "AbortError", code: 20, message: "Failed to execute 'showDirectoryPicker' on 'Window': The user aborted a request."}` — Codex CONCERN 확인 CORRECT. Chrome은 홈 디렉터리 거절을 AbortError로 dispatch (SecurityError 아님). 단순 silent return이 SecurityError 분기를 preempt → 메시지 무노출. **Contingency Patch v2 (count-based) 적용** `JoinBurnIndexForm.tsx:99 + 126-134`: `abortCountRef = useRef<number>(0)` → 1회 silent / 2회 누적 시 `fsaWarning` (yellow, non-fatal). timing-based 1500ms 폐기 (picker 호출당 10-15초 → 1500ms 내 2회 불가능 → count-based pivot). Invariant #4 (e.name only) 유지. **검증 4종 PASS**: tsc / vitest 234/234 / build / `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0. **Cell #2 재실측 PASS (2026-05-22 owner-direct localhost)**: 1차 silent ✅ / 2차 연두색 fsaWarning 텍스트 정확 일치 ✅ / Scan 버튼 enabled 유지 ✅. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.33.04.png`. 잔여 = Phase 7 production redeploy 후 cell #2 재실측 |
tasks/folder-picker-ux/codex-phase8.md:1169:| 5 | Name mismatch 동적 표기 | ✅ (code + Cell #3 owner localhost PASS) | `JoinBurnIndexForm.tsx:157-161` `You picked "${h.name}". We need the directory literally named "${expectedName}"…`. **Cell #3 owner-direct (2026-05-22 localhost)**: `~/.claude` 직접 선택 → 빨간 fsaError 노출, `.claude` 동적 + `projects` expected 정확 일치. typo fix `⌘⇧·` → `⌘⇧.` (line 423) 함께 검증. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.42.51.png` |
tasks/folder-picker-ux/codex-phase8.md:1170:| 6 | a11y WCAG AA 4.5:1 + Tab order | ✅ (contrast + tab order + Phase 7.5 v2 회복 + Phase 7.5.6 font bump 재검증) ⏳ (Lighthouse + owner SR smoke 잔여) | Phase 3 self-audit + **localhost computed 재확인** (`preflight-localhost-verification.md`): `--fg2 rgb(82,82,82)` on `--bg rgb(255,255,255)` = **7.52:1** (helper/row/hint 모두 동일) / kbd `--fg rgb(10,10,10)` on `--surface-muted rgb(250,250,250)` = **20.4:1** / `--young-coconut-dark` outline-only(text 미사용). Tab 순서 10 tabbables: close 첫 → 2 pickers → 5 timeframe → 폼 필드 = 자연 순서. **Phase 7.5 v2 contrast 회복** (`phase7.5-auxiliary-verification.md`): Edit 2 v2 `.kbd-label` 색상을 `--fg3 #8E8E8E` (3.28:1 AA fail) → `--fg2 #525252` (codex v2 권장 반영)으로 변경 → **production 재계산 PASS**: kbd `18.97:1` / label `7.81:1` / hint `7.81:1` / code (inherit `--fg2`) `7.81:1`. **a11y 추가 강화** (Edit 3 v2 신규 클래스 `.path-preview-hint code` JetBrains Mono / Edit 4 inline `<kbd aria-label>` 2건 + `<span aria-hidden>` 1건): SR이 `⌘⇧.`을 "Command Shift Period"로, `Ctrl+H`를 "Control H"로 또박또박 발음 + `(period)` 시각 라벨은 SR 중복 announce 차단. **Phase 7.5.6 patch 후 contrast 재확인** (font-size 13→15px / padding 2px 7px → 2px 8px / line-height 1.4 신규): 15px kbd `#0A0A0A` on `#FAFAFA` = **18.97:1** ✅ (font-size 증가에도 색상 무변 → ratio 동일), `.kbd-label` `#525252` on `#FFFFFF` = **7.81:1** ✅. Lighthouse + owner VoiceOver smoke 잔여 (Codex Q6 follow-up — task #14) |
tasks/folder-picker-ux/codex-phase8.md:1182:| 11 | Owner Happy Path 6 cells | ⏳ partial — 7/7 auto-simulated + Codex 검토 완료 (**needs-attention**) | **`preflight-phase6-simulated.md` 7/7 cells PASS (auto)**: Cell #1 inherited + Cell #2-#5 monkey-patched `showDirectoryPicker` 4분기 + Cell #6 no-query 네비게이션 manual form + Cell #7 `indexedDB.open` 패치 fsaWarning + Invariant #5. **Codex Phase 6 (`codex-phase6.md` 13261 bytes) 완료 — verdict: needs-attention**. Cell-by-cell: #1/#3/#4/#5/#6/#7 ✅ PASS / **#2 ⚠️ CONCERN MEDIUM** (AbortError vs SecurityError dispatch — MDN+WICG+Chromium source citations). Q1 LOW (Step 4 timing ✅) / Q2 MEDIUM (DOMException cross-Chromium 일부 unverified) / Q3 MEDIUM (parent-path validation gap, 별 사이클) / Q4 LOW (NEXT_PUBLIC build-time, redeploy 절차 정합) / Q5 INFO (English UI 영구) / Q6 MEDIUM (kbd SR 미검증). owner real-incognito + production은 여전히 의무 (smoke-golden-regression.md owner-직접-기록 invariant). **🔴 P1 = Cell #2 real `~` pick + `e.name` 로깅 (Phase 6 단일 차단 후보)**. |
tasks/folder-picker-ux/codex-phase8.md:1222:| 1 | `https://www.coconutlabs.xyz/` 진입, Path Preview Card 시각 확인 | `~/.claude/projects` + `~/.codex/sessions` 두 row 노출 + reveal hint 1줄 (`⌘⇧·` macOS / `Ctrl+H` Linux) | ✅ owner localhost | 2026-05-22 owner-direct on `localhost:3000/?auto-detect=1` (production redeploy 후 재실측 별도). 스크린샷: `issues/스크린샷 2026-05-22 오전 12.33.04.png`. 두 row + hint 모두 가시 |
tasks/folder-picker-ux/codex-phase8.md:1223:| 2 | "Pick .claude/projects" 클릭 → 홈 디렉터리(`~`) 선택 → Chrome dialog "다른 폴더 선택" 또는 "취소" 클릭 → 다시 "Pick .claude/projects" 클릭 → 홈 디렉터리 다시 선택 → 두 번째 거절 | **1차 시도**: silent (메시지 무노출, abortCount=1) / **2차 시도**: yellow `fsaWarning` 노출 — "Trouble picking the folder? Chrome blocks system folders like your home directory — drill into ~/.claude/projects (or ~/.codex/sessions) specifically." Korean Chrome dialog 떠도 우리 UI 메시지는 영어 동일. **Scan 버튼 enabled 유지** (fsaWarning은 non-fatal, fsaError 아님) | ✅ owner localhost | 2026-05-22 owner-direct: "1차에서는 아무것도 안 뜨고, 2차에서는 연두색 바탕 안에 [정확한 텍스트 일치]". Scan 버튼 enabled 유지 확인. 스크린샷: `issues/스크린샷 2026-05-22 오전 12.33.04.png` |
tasks/folder-picker-ux/codex-phase8.md:1224:| 3 | 다시 클릭 → `~/.claude` 자체 선택 → Chrome 권한 팝업 "허용" | Name mismatch 메시지에 `{h.name}` 동적 노출 — `You picked ".claude". We need the directory literally named "projects" (inside ~/.claude/ or ~/.codex/). Try again.` | ✅ owner localhost | 2026-05-22 owner-direct (Cell #3 페이지 reload 후 fresh state): 정확 텍스트 일치 / `.claude` 동적 표기 ✅ / `projects` 정확 노출 ✅ / hint 글리프 `⌘⇧.` 정상 (typo fix HMR 반영). 스크린샷 `issues/스크린샷 2026-05-22 오전 12.42.51.png` |
tasks/folder-picker-ux/codex-phase8.md:1225:| 4 | 다시 클릭 → `~/.claude/projects` 선택 | Error 0건, 핸들 저장, 다음 step 진행 | ✅ owner localhost | 2026-05-22 owner-direct: `Pick .claude/projects` 버튼 텍스트가 `✓ projects` 로 변경 + 강조 상태 / fsaError 클리어 ✅ / fsaWarning 클리어 ✅ / `Scan & preview` 버튼 enabled 유지 ✅ / Step 2 timeframe row 진행 노출. 스크린샷: `issues/스크린샷 2026-05-22 오전 12.46.29.png` |
tasks/folder-picker-ux/codex-phase8.md:1226:| 5 | 다시 클릭 → 시스템 dialog에서 cancel (1회) | Silent (form-error/warning 미노출, 카드 그대로). **전제**: Cell #4 성공 후 abortCount 0 리셋된 상태. Cell #4 미실행 시 직전 누적 카운트에 따라 fsaWarning 노출 가능 — 그 경우도 Cell #2 contract와 정합 | ✅ owner localhost (variant: 2회 cancel) | 2026-05-22 owner-direct: 2회 cancel 입력 → count cycle 검증 PASS. Cell #4 success로 `abortCountRef`가 0 리셋된 상태에서 0→1 (silent) → 1→2 (fsaWarning 노출, 정확 텍스트 일치) 흐름 재현. count-based heuristic post-reset 동작 확인. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.53.44.png`. **변형 사유**: 1회 cancel→silent 검증은 Cell #2 1차 + Cell #5 0→1 transition으로 이미 evidence 확보. 2회 cancel은 reset 후 cycle 재검증으로 더 강한 contract 확인 |
tasks/folder-picker-ux/codex-phase8.md:1227:| 6 | Safari로 동일 URL 진입 | "Join Burn Index" 수동 폼 fallback. Path Preview Card 미표시(auto-detect off) | ✅ owner localhost | 2026-05-22 owner-direct Safari: "Join Burn Index" 모달 노출 / STEP 1 RUN THE COLLECTOR (Python 3.11+ instructions + git clone snippet + Copy button) / STEP 2 UPLOAD YOUR BURN SUMMARY (handle input + file picker + JSON paste textarea + `Validate & preview` 버튼) / Path Preview Card 미표시 ✅ / Pick .claude/projects / .codex/sessions 버튼 미표시 ✅ / `⌘⇧.` hint 미표시 ✅. `"showDirectoryPicker" in window` 분기 (line 67-73) 정상 동작. 스크린샷 `issues/스크린샷 2026-05-22 오전 1.01.40.png` |
tasks/folder-picker-ux/codex-phase8.md:1228:| 7 | (v2 신규) Chrome DevTools > Application > Storage > Clear site data → IndexedDB throttle/block 시뮬레이션 후 `~/.claude/projects` 선택 | Handle UI에 `✓ projects` 표시 (claudeHandle React state set), `fsaError` 비어 있음, `fsaWarning`에 "Folder selected for this session, but it could not be remembered" 노출. Scan 버튼 enabled. 새로고침 후 handle 재선택 필요 (정상). 직접 시뮬레이션 불가 시 saveHandle 임시 throw로 대체 검사 (코드 검사 갈음) | ✅ owner 승인 코드 검사 | 2026-05-22 owner-direct decision (옵션 A 선택). `JoinBurnIndexForm.tsx:164-182` 4단계 분리 구조 검증: ① L167-168 `setFsaError("")` + `setFsaWarning("")` 클리어 / ② L170-171 `setClaudeHandle(h)` / `setCodexHandle(h)` **saveHandle 호출 BEFORE handle state 세팅** (Invariant #5 핵심) / ③ L176-177 `try { await saveHandle(kind, h) }` IDB persistence best-effort / ④ L178-182 catch에서 `setFsaWarning("Folder selected for this session, but it could not be remembered. You'll need to pick it again next time.")` 노출 + fsaError 미터치로 Scan 버튼 enabled 유지. **Invariant #5 (handle React state ↔ IDB persistence 분리) 코드 레벨 PASS** |
tasks/folder-picker-ux/codex-phase8.md:1238:**2026-05-22 Claude-in-Chrome 보조 검증 (Option B 하이브리드)** — Bot Challenge를 same-origin browser fetch로 우회해 **production main chunks 8개 전수 검사 = COLLECTOR_HMAC_SECRET 0건 (총 707KB 검사)**. Path Preview Card 마크업도 같은 세션에서 검증 완료 (2 rows + 2 hidden segments + hint + kbds 정확 일치). 상세: `phase7-auxiliary-verification.md`. **단 owner-direct manual record는 여전히 의무** — 본 표 cells #1/#4는 owner incognito 직접 실행 후 손으로 기록 (1-2분 축약 가능).
tasks/folder-picker-ux/codex-phase8.md:1242:| 1 (production redeploy 후) | ⏳ owner-direct | Chrome 최신 + incognito + `https://www.coconutlabs.xyz/?auto-detect=1` 진입. Path Preview Card 2 row + hint 노출 확인 후 본 표 1줄 직접 기록 >> 둘 다 잘 보임 |
tasks/folder-picker-ux/codex-phase8.md:1243:| 4 (production redeploy 후) | ⏳ owner-direct | `~/.claude/projects` 선택 → `✓ projects` 버튼 + fsaError/fsaWarning 0 + Scan 버튼 enabled 확인 후 본 표 1줄 직접 기록 >> 둘 다 잘 보임 |
tasks/folder-picker-ux/codex-phase8.md:1247:## Phase 7.5 Production 재실측 (Findings 2+3 patch, cell 1/1 필수)
tasks/folder-picker-ux/codex-phase8.md:1252:- production HTML + computed styles 실측: kbd 13px / `letter-spacing 0.5px` / `padding 2px 7px` / aria-label `Command Shift Period`·`Control H` / `(period)` 라벨 `aria-hidden=true` 11px Inter `--fg2` / `<code>` 3개 (`~`, `.claude/projects`, `.codex/sessions`) JetBrains Mono — **3/3 마크업 PASS**
tasks/folder-picker-ux/codex-phase8.md:1253:- WCAG AA: kbd `18.97:1` / label `7.81:1` / hint `7.81:1` / code `7.81:1` — **4/4 contrast PASS** (Edit 2 v2 `--fg3→--fg2` 회복 확인)
tasks/folder-picker-ux/codex-phase8.md:1256:**owner-direct manual record는 여전히 의무** — 본 표 cell은 owner incognito 직접 실행 후 손으로 기록 (1-2분 축약 가능, harness-loop "auto-append 금지" 게이트 유지).
tasks/folder-picker-ux/codex-phase8.md:1260:| 7.5 (kbd 시인성 + home folder + aria-label) | ⏳ owner-direct | Chrome 최신 + incognito + `https://www.coconutlabs.xyz/?auto-detect=1` 진입 → Hero "Join Burn Index" 클릭 → 모달 오픈 → ① `⌘⇧.` kbd 13px 가독 + `.`이 마침표가 아닌 키 라벨로 인지 ② `(period)` 라벨 명시 노출 ③ "From your home folder (~), open .claude/projects or .codex/sessions" 안내 노출 ④ (선택) VoiceOver(Cmd+F5)로 hint Tab → "Command Shift Period" / "Control H" 발음 확인 (Codex Q6 follow-up). 본 표 1줄 직접 기록 |
tasks/folder-picker-ux/codex-phase8.md:1272:**7/7 cells PASS** (owner-direct 6 cells + 코드 검사 1 cell)
tasks/folder-picker-ux/codex-phase8.md:1282:| 7 | ✅ | owner-direct decision 코드 검사 — Invariant #5 PASS |

exec
/bin/zsh -lc "sed -n '1,220p' ~/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_auto-detect-flip-procedure.md && sed -n '1,160p' ~/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/MEMORY.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
---
name: auto-detect-flip-procedure
description: "?auto-detect=1 FSA 기능을 전체 사용자에게 활성화하는 flip 절차 (Axis 1 ≥ 15 달성 후)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0b0e2560-4eca-41fc-8c04-73203c74d638
---

Axis 1 ≥ 15 달성 시 아래 절차로 FSA auto-detect를 전체 사용자에게 활성화.

**Why:** kill-switch env var `NEXT_PUBLIC_AUTO_DETECT_DEFAULT`가 `JoinBurnIndexForm.tsx`에 배선됨 (commit `535bd01`, 2026-05-21). 기존 URL query 게이트에서 env OR query 조합으로 확장.

**How to apply:**
1. Vercel dashboard → coconutlabs 프로젝트 → Settings → Environment Variables
2. `NEXT_PUBLIC_AUTO_DETECT_DEFAULT` 값을 `"true"`로 변경 (Production)
3. Redeploy → 즉시 전체 사용자 FSA UI 활성

**Kill-switch (긴급 OFF):**
- 위 env를 `"false"` 또는 삭제 후 Redeploy → 즉시 전 사용자 비활성

**현재 상태 (2026-05-21 업데이트)**:
- **ON-flip 실행됨 2026-05-21** — Axis 1 = 0이었으나 닭-달걀 문제로 owner 우회. `NEXT_PUBLIC_AUTO_DETECT_DEFAULT=true` Production live (deployment EUAHZpz1Z, 34초).
- T+1h 체크 ⏳ 미완 — axis2.started 아직 0 (유기 트래픽 대기).
- T+1h 후 axis2.started ≥ 1이면 success condition #5 충족. 미충족 시 axis1-recruitment-strategy.md 개시.
- Gate integrity v2 완료: 5대 결함 closed, 234 tests pass, HMAC 인증 live.
- 기록: `tasks/production-rollout-gate/on-flip-2026-05-21.md`, `status-2026-05-21.md`

**UX iteration 1 (2026-05-22)**: folder picker 가시성·에러 복구 patch — commits `6cda4c5`+`b94d362`+`3756e83`+`40cd00c`. 4 Finding 흡수 (Finding 1=별 사이클 이관, Finding 2/3=Phase 7.5 patch, Finding 4=Phase 7.5.6 patch). 참고: [[project-folder-picker-ux-2026-05-22]]
# Project Memory Index

| File | Type | Description |
|------|------|-------------|
| feedback_coconutlabs-solo-no-review-request.md | feedback | coconutlabs는 chongwon83 솔로 프로젝트 — PR 리뷰 요청 없이 바로 머지 |
| project_auto-detect-flip-procedure.md | project | ?auto-detect=1 전체 활성화 절차 — Axis 1 ≥ 15 후 Vercel env NEXT_PUBLIC_AUTO_DETECT_DEFAULT=true + Redeploy |
| project_folder-picker-ux-2026-05-22.md | project | FSA folder picker UX Approach B — 4 error.name 분기 (Abort/Security/NotAllowed/mismatch) + 2-row Path Preview Card + count-based AbortError heuristic 패턴 |

codex
The owner-cell evidence is weaker than the decision-log wording: the current smoke file has 7 Phase 6 rows, but Phase 7 and Phase 7.5 rows remain `⏳ owner-direct` despite memo text in the notes, and I do not see a separate 7.5.6 row there. I’m checking the Finding 1 brief and the stated “risk 3 axes” rule next.
exec
/bin/zsh -lc "sed -n '1,280p' tasks/folder-picker-ux-finding1/plan-brief.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
# Plan Brief — Finding 1 별 사이클: `?auto-detect=1` 모달 자동 오픈

**Date**: 2026-05-22
**Status**: 별 사이클 진입 trigger 역할 (실행 plan v1은 별 세션에서 S3 작성)
**Origin**: Phase 7 owner self-test에서 발견. 본 brief는 `folder-picker-ux` Phase 8.2 산출물

---

## 문제 (Verbatim from Phase 7)

Owner 2026-05-22 production self-test 발화:
> "Auto-detect Burn Summary 모달이 자동으로 뜨지는 않음"

`?auto-detect=1` 쿼리가 production landing 페이지에서 **modal 자동 오픈을 trigger하지 않는다**. 사용자는 Hero/Nav/DropsSection/FinalCTA의 "Join Burn Index" 버튼을 1회 클릭해야 modal이 열린다.

### 코드 anchor (Phase 7 verification 결과)

- `components/LandingApp.tsx:22` — `setModal` state. 유일한 trigger는 4곳 onClick handler (Nav L62 / Hero L66 / DropsSection L73 / FinalCTA L76)
- `components/LandingApp.tsx:28-41` — 유일 useEffect는 `/api/burnindex` fetch만 처리, URL 분리
- `components/forms/JoinBurnIndexForm.tsx:67-73` — `autoDetect` flag는 **모달 내부 콘텐츠**(Path Preview Card + picker 활성)만 제어. modal 자체 오픈은 LandingApp 책임

### Invariant #3 회귀가 아닌 이유

본 plan(`folder-picker-ux`)의 Invariant #3은 "auto-detect 진입 시 카드가 정상 렌더되는가" — modal이 열린 뒤를 보호. modal 자체 오픈은 별도 책임이며 본 plan 범위 밖이었음. Phase 7에서 owner 자체검증으로 발견된 UX gap.

---

## 변경 surface (예상 ~15줄)

**단일 파일**: `components/LandingApp.tsx`

```diff
- import { useState, useCallback, useEffect } from "react";
+ import { useState, useCallback, useEffect, useRef } from "react";
+ import { useSearchParams } from "next/navigation";

  export default function LandingApp() {
    const [toast, setToast] = useState({ visible: false, message: "" });
    const [modal, setModal] = useState<"join" | "challenge" | null>(null);
    const [imported, setImported] = useState<ImportedEntry[]>([]);
+   const userClosedRef = useRef<boolean>(false);
+   const searchParams = useSearchParams();

+   // 1회 trigger: ?auto-detect=1 진입 시 modal 자동 오픈
+   // 사용자가 close 클릭 후엔 query remain해도 재오픈 금지
+   useEffect(() => {
+     if (
+       searchParams?.get("auto-detect") === "1" &&
+       modal === null &&
+       !userClosedRef.current
+     ) {
+       setModal("join");
+     }
+   }, [searchParams, modal]);

    // ... 기존 코드 ...

-         <div className="modal-overlay" onClick={() => setModal(null)}>
+         <div
+           className="modal-overlay"
+           onClick={() => {
+             userClosedRef.current = true;
+             setModal(null);
+           }}
+         >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
-               onClick={() => setModal(null)}
+               onClick={() => {
+                 userClosedRef.current = true;
+                 setModal(null);
+               }}
                aria-label="Close"
              >
                ×
              </button>
```

> ⚠️ `useSearchParams`는 Next.js 16.2.6 (`node_modules/next/dist/docs/` 사전 확인 의무 — AGENTS.md). App Router client component에서 사용 가능하나 Suspense boundary 또는 hydration 동작 사전 검증 필요.

---

## 위험 3축 평가 (헤비 권장)

| 축 | 충족 여부 | 근거 |
|----|-----------|------|
| ① 실패비용 ≥ 2h | **충족** | Invariant #3 (auto-detect 진입 회귀) 위반 시 production rollback + Vercel re-deploy + smoke test 재실행 = 2h+. `?auto-detect=1` 사용자가 modal 못 보면 핵심 UX 동선 차단. |
| ② 영향범위 | **충족** | 1 module (LandingApp.tsx) + production landing route (모든 진입자) + `?auto-detect=1` 쿼리 사용자. 단일 파일이나 진입 페이지 routing이라 blast radius 큼 |
| ③ 관찰가능성 | **부분** | modal 오픈 trigger는 즉시 시각적. 단 `userClosedRef` latch 누락 시 사용자가 close → URL remain → re-render 시 modal 재오픈하는 silent loop는 첫 1회만으론 발견 어려움 |

**점수: 2/3 충족 → /codex 교차 리뷰 강력 권장** (검증 분리 원칙 1순위 검증자). 헤비 작업으로 분류, S3.5 design phase 생략 가능(JSX 변경만), S7 design lint 생략 가능(시각 토큰 무변).

---

## Invariant 후보 (별 plan v1에서 확정)

### 기존 (folder-picker-ux 보존)

- **#3**: Auto-detect 카드 렌더 — `?auto-detect=1` 진입 시 modal 자동 오픈 + Path Preview Card 정상 표시

### 신규

- **#6**: Close 후 재오픈 0건 — 동일 세션 내 사용자가 close 클릭하면 query param 그대로여도 modal 재오픈 0건. `userClosedRef.current = true` latch가 SPA 세션 동안 유지

> ⚠️ **#6 한계 명시 (별 plan v1 의무 기재)**: `userClosedRef`는 React component state — **페이지 reload 시 reset**. 즉 사용자가 close → reload 시 modal 재오픈 발생. 이는 의도된 동작 (URL이 still `?auto-detect=1` → 새 세션이라 신규 trigger). 사용자가 영구 dismiss를 원하면 별 사이클에서 sessionStorage 검토.

---

## Scope / Non-scope

**Scope**:
- LandingApp.tsx 단일 파일 modification
- useEffect 1개 신규 (modal auto-open)
- useRef 1개 신규 (userClosedRef latch)
- 2곳 onClick handler에 latch set 추가 (overlay + close button)

**Non-scope**:
- Modal close 후 URL query 제거 (별 사이클, router.replace 검토 필요)
- sessionStorage 영구 dismiss (별 사이클, UX 정책 결정 필요)
- challenge modal 자동 오픈 (본 cycle은 `?auto-detect=1` ↔ `join` modal만)
- Hero/Nav/DropsSection/FinalCTA button 행동 변경
- JoinBurnIndexForm.tsx 변경 (autoDetect flag 동작 그대로)

---

## 진입 시점 + 검증 의무

### 진입 trigger

owner 별 세션 발화로 별 plan v1 작성 시작. 본 brief는 trigger 역할만, 실행 plan은 별도.

### 별 plan v1 작성 시 의무 (Codex Phase 1 적대적 검토 포함)

위험 3축 2/3 충족 → /codex Phase 1 적대적 검토 의무. 다음 5묶음 질문 사전 검토:

1. `useSearchParams`가 Next.js 16.2.6 client component에서 hydration mismatch 없이 동작하는가? Suspense boundary 의무 사항?
2. `userClosedRef`가 React StrictMode double-invoke 시 false positive(close 안 했는데 close로 latch)를 일으키지 않는가?
3. Hero/Nav onClick으로 modal 연 사용자가 close 시 latch가 set됨 — 그 사용자가 같은 세션에서 다시 URL `?auto-detect=1` 추가/재로딩 안 한 채 다른 entry로 modal 열려고 하면 정상 동작하는가? (onClick은 latch에 영향받지 않는가 — 본 brief는 useEffect만 latch 체크하므로 OK 추정, 검증 의무)
4. `searchParams.get("auto-detect") === "1"`만으론 부족, 다른 truthy 값(`"true"` / `""` / `"yes"`) 허용 여부? `JoinBurnIndexForm.tsx:67-73` 의 autoDetect flag 분기 로직과 일치 시켜야 (코드 anchor 사전 확인 의무)
5. Invariant #6 ("close 후 재오픈 0건")의 실측 방법 — Playwright e2e 또는 owner manual cell. Phase 6 cells에 추가할 항목

### 검증 4종 (별 plan v1 Phase 5 의무)

- `npx tsc --noEmit` exit 0
- `npx vitest run` 그린 (LandingApp 관련 테스트 영향 확인)
- `npm run build` 성공
- `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0 (Invariant #1 본 cycle도 유지)

### Owner Happy Path Cells (별 plan v1 Phase 6 의무)

| # | 입력 | 기대 결과 |
|---|------|----------|
| 1 | `https://www.coconutlabs.xyz/?auto-detect=1` 진입 | Modal 자동 오픈 + Path Preview Card 표시 |
| 2 | 위 modal close 클릭 | Modal 닫힘, URL remain |
| 3 | 같은 탭에서 새로고침 없이 동일 페이지 anchor 클릭 또는 history 조작 | Modal 재오픈 0건 (latch 작동) |
| 4 | Same tab reload | Modal 다시 자동 오픈 (latch reset 정상) |
| 5 | `https://www.coconutlabs.xyz/` (쿼리 없이) | Modal 자동 오픈 안 함, 수동 클릭으로만 |
| 6 | Modal 안에서 picker 정상 완료 후 close → URL `?auto-detect=1` 추가 | Re-open behavior 명세 (별 plan v1에서 결정) |

---

## 추정 분량

단일 파일 + useRef latch + useEffect 1개 → **라이트~중급 작업**. S0~S6 압축 사이클 **1.5~2h** (S3.5 design phase 생략, S7 design lint 생략 — JSX 로직 변경만, 시각 토큰 무변).

---

## 관련 anchor

- 본 cycle 산출물: `tasks/folder-picker-ux/` (5종 산출물 + codex-phase{1,6,7,8}.md)
- Memory: [[project-folder-picker-ux-2026-05-22]] — 본 cycle의 패턴 (4 error 분기, count-based heuristic, kbd 시인성)
- Memory: [[project_auto-detect-flip-procedure]] — ON-flip 절차, UX iteration 1 anchor 포함
- Decision log: 2026-05-22 Folder picker UX — Approach B
- Plan: `~/.claude/plans/p1-rollout-lazy-trinket.md` Phase 8.2 (본 brief 작성 단계)

exec
/bin/zsh -lc "rg -n \"위험 3축|3축|실패비용|영향범위|관찰가능성|배포 경로|3\\+ 모듈|task-standards|standards\" . -g '*.md'" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
exec
/bin/zsh -lc "sed -n '1,220p' tasks/folder-picker-ux/diff.md && sed -n '1,220p' tasks/folder-picker-ux/unverified.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
./tasks/folder-picker-ux-finding1/plan-brief.md:87:## 위험 3축 평가 (헤비 권장)
./tasks/folder-picker-ux-finding1/plan-brief.md:91:| ① 실패비용 ≥ 2h | **충족** | Invariant #3 (auto-detect 진입 회귀) 위반 시 production rollback + Vercel re-deploy + smoke test 재실행 = 2h+. `?auto-detect=1` 사용자가 modal 못 보면 핵심 UX 동선 차단. |
./tasks/folder-picker-ux-finding1/plan-brief.md:92:| ② 영향범위 | **충족** | 1 module (LandingApp.tsx) + production landing route (모든 진입자) + `?auto-detect=1` 쿼리 사용자. 단일 파일이나 진입 페이지 routing이라 blast radius 큼 |
./tasks/folder-picker-ux-finding1/plan-brief.md:93:| ③ 관찰가능성 | **부분** | modal 오픈 trigger는 즉시 시각적. 단 `userClosedRef` latch 누락 시 사용자가 close → URL remain → re-render 시 modal 재오픈하는 silent loop는 첫 1회만으론 발견 어려움 |
./tasks/folder-picker-ux-finding1/plan-brief.md:138:위험 3축 2/3 충족 → /codex Phase 1 적대적 검토 의무. 다음 5묶음 질문 사전 검토:
./docs/decision/decision-log.md:277:- 무엇이 잘 됐나: F8/F9 프로덕션 12/12 PASS 확인 → 코덱스 교차 리뷰가 owner 솔로 검토 누락 2건(store-contract-check totalTokens, 미사용 test:coverage 스크립트) 잡아냄. 위험 3축 트리거 룰이 실제로 작동.
./docs/decision/decision-log.md:290:- 핵심 트레이드오프: `pyproject.toml` + PyPI 패키징은 배포 경로 추가 (실패비용
./docs/decision/decision-log.md:293:- 선택 이유: 위험 3축 3/3 충족 → /codex 교차 리뷰 강력 권장 + plan 명시 4종 한도.
./docs/plans/next-cycle-hygiene-and-e2e.md:221:### 위험 3축 평가 (코덱스 교차 리뷰 발동 임계)
./docs/plans/next-cycle-hygiene-and-e2e.md:222:- 실패비용 ②: e2e가 false negative면 다음 contract 변경 시 회귀 → 충족
./docs/plans/next-cycle-hygiene-and-e2e.md:223:- 영향범위 ③: e2e/ + ci.yml + package.json + .gitignore → 충족
./docs/plans/next-cycle-hygiene-and-e2e.md:224:- 관찰가능성 ①: CI에서 즉시 검출 → 미충족
./tasks/coconut-burn-import/verification-report.md:174:| D | Codex 교차 리뷰 (위험 3축 2/3 충족) | Owner 호출 대기 | `/codex` 1회 호출 — 가수금 슬래시는 owner-invoked |
./tasks/coconut-burn-import/verification-report.md:243:**근거**: 본 plan 위험 3축 평가 — 실패비용 ② (Redis 영속 데이터) + 영향범위 ③ (scripts/ + __tests__/ + tasks/, 3+ 모듈) = 2/3 충족 → 코덱스 교차 리뷰 강력 권장. `task-standards.md` "검증 분리 원칙" + 1순위 검증자 = `/codex`.
./tasks/production-rollout-gate/criteria.md:39:- [task-standards.md] 보안 민감 → codex 교차 리뷰 의무 + S8 /cso 병행 검토
./tasks/production-rollout-gate/codex-input-v1.md:90:### 1·2·3축 (외부 사용자·setup 시간·터미널 병목) — ❌ 측정 인프라 0
./tasks/production-rollout-gate/codex-input-v1.md:127:**R2**: 1·2·3축의 측정 임계값(6명·미확정·50%+)이 임의적인가? 통계적·운영적 근거?
./tasks/production-rollout-gate/codex-input-v1.md:130:**R3**: ON 전환 후 1·2·3축이 하락하면 자동 롤백(OFF 복귀) 트리거가 필요한가?
./tasks/folder-picker-ux/criteria-execution-log.md:26:| 9 | tsc + vitest + eslint | ⚠️ PARTIAL→PASS (80% 룰) | `tsc --noEmit` ✅ exit 0 / `vitest run` ✅ 234/234 / `eslint --max-warnings=0` ❌ 15 warnings (모두 pre-existing, 본 변경 도입 0건). 3축 중 2.5 통과로 80% 룰 적용 → PASS |
./tasks/folder-picker-ux/codex-phase8-input.md:61:### Q4. Finding 1 plan-brief — 위험 3축 + Invariant #6 정의
./tasks/folder-picker-ux/codex-phase8-input.md:64:- 위험 3축 평가 = 2/3 충족 (① 실패비용 충족 / ② 영향범위 충족 / ③ 관찰가능성 부분) → "/codex 교차 리뷰 강력 권장" 명시
./tasks/folder-picker-ux/codex-phase8-input.md:69:- 위험 3축 평가 타당성 — ② 영향범위가 "1 module + production landing route + 모든 진입자"인 것이 충족 기준에 맞는가? task-standards.md "3+ 모듈 OR 영속 데이터 OR 배포 경로 영향" 기준 — landing route 1개라도 모든 사용자 진입점이라 충족 처리한 것이 타당한가, 아니면 1 module이라 미충족인가?
./tasks/folder-picker-ux/codex-phase8-input.md:105:### Q4 [Finding 1 brief 위험 3축 + Invariant #6]
./tasks/folder-picker-ux/codex-phase1.md:53:## §2. 위험 3축 평가
./tasks/folder-picker-ux/codex-phase1.md:57:| ① 실패비용 ≥ 2h | ✅ | UX 회귀 시 cosmetic 수정 + 재배포 합산 2h+ |
./tasks/folder-picker-ux/codex-phase1.md:58:| ② 영향범위 | ✅ | `JoinBurnIndexForm.tsx` + `globals.css` (production landing main CTA) — 모든 Chrome/Edge auto-detect 진입 사용자 |
./tasks/folder-picker-ux/codex-phase1.md:59:| ③ 관찰가능성 | ✅ | UX 마찰은 axis2 telemetry로 부분 가시. 폴더 mismatch/cancel ratio는 client-side counter 없으면 silent fail |
./tasks/folder-picker-ux/codex-phase8.md:74:### Q4. Finding 1 plan-brief — 위험 3축 + Invariant #6 정의
./tasks/folder-picker-ux/codex-phase8.md:77:- 위험 3축 평가 = 2/3 충족 (① 실패비용 충족 / ② 영향범위 충족 / ③ 관찰가능성 부분) → "/codex 교차 리뷰 강력 권장" 명시
./tasks/folder-picker-ux/codex-phase8.md:82:- 위험 3축 평가 타당성 — ② 영향범위가 "1 module + production landing route + 모든 진입자"인 것이 충족 기준에 맞는가? task-standards.md "3+ 모듈 OR 영속 데이터 OR 배포 경로 영향" 기준 — landing route 1개라도 모든 사용자 진입점이라 충족 처리한 것이 타당한가, 아니면 1 module이라 미충족인가?
./tasks/folder-picker-ux/codex-phase8.md:118:### Q4 [Finding 1 brief 위험 3축 + Invariant #6]
./tasks/folder-picker-ux/codex-phase8.md:134:I’ll verify the cited artifacts against the repo state and the memory files directly, then return the requested verdict format with severity per question. First I’m locating the relevant standards and reading the claimed evidence files rather than relying on the brief text.
./tasks/folder-picker-ux/codex-phase8.md:136:/bin/zsh -lc "pwd && rg --files | rg '("'^docs/decision/decision-log.md$|''^tasks/folder-picker-ux/|''^tasks/folder-picker-ux-finding1/plan-brief.md$|task-standards'"\\.md"'$)'"'" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
./tasks/folder-picker-ux/codex-phase8.md:292:- 무엇이 잘 됐나: F8/F9 프로덕션 12/12 PASS 확인 → 코덱스 교차 리뷰가 owner 솔로 검토 누락 2건(store-contract-check totalTokens, 미사용 test:coverage 스크립트) 잡아냄. 위험 3축 트리거 룰이 실제로 작동.
./tasks/folder-picker-ux/codex-phase8.md:305:- 핵심 트레이드오프: `pyproject.toml` + PyPI 패키징은 배포 경로 추가 (실패비용
./tasks/folder-picker-ux/codex-phase8.md:308:- 선택 이유: 위험 3축 3/3 충족 → /codex 교차 리뷰 강력 권장 + plan 명시 4종 한도.
./tasks/folder-picker-ux/codex-phase8.md:439:## §2. 위험 3축 평가
./tasks/folder-picker-ux/codex-phase8.md:443:| ① 실패비용 ≥ 2h | ✅ | UX 회귀 시 cosmetic 수정 + 재배포 합산 2h+ |
./tasks/folder-picker-ux/codex-phase8.md:444:| ② 영향범위 | ✅ | `JoinBurnIndexForm.tsx` + `globals.css` (production landing main CTA) — 모든 Chrome/Edge auto-detect 진입 사용자 |
./tasks/folder-picker-ux/codex-phase8.md:445:| ③ 관찰가능성 | ✅ | UX 마찰은 axis2 telemetry로 부분 가시. 폴더 mismatch/cancel ratio는 client-side counter 없으면 silent fail |
./tasks/folder-picker-ux/codex-phase8.md:1180:| 9 | tsc + vitest + eslint | ⚠️ PARTIAL→PASS (80% 룰) | `tsc --noEmit` ✅ exit 0 / `vitest run` ✅ 234/234 / `eslint --max-warnings=0` ❌ 15 warnings (모두 pre-existing, 본 변경 도입 0건). 3축 중 2.5 통과로 80% 룰 적용 → PASS |
./tasks/folder-picker-ux/codex-phase8.md:1944:## 위험 3축 평가 (헤비 권장)
./tasks/folder-picker-ux/codex-phase8.md:1948:| ① 실패비용 ≥ 2h | **충족** | Invariant #3 (auto-detect 진입 회귀) 위반 시 production rollback + Vercel re-deploy + smoke test 재실행 = 2h+. `?auto-detect=1` 사용자가 modal 못 보면 핵심 UX 동선 차단. |
./tasks/folder-picker-ux/codex-phase8.md:1949:| ② 영향범위 | **충족** | 1 module (LandingApp.tsx) + production landing route (모든 진입자) + `?auto-detect=1` 쿼리 사용자. 단일 파일이나 진입 페이지 routing이라 blast radius 큼 |
./tasks/folder-picker-ux/codex-phase8.md:1950:| ③ 관찰가능성 | **부분** | modal 오픈 trigger는 즉시 시각적. 단 `userClosedRef` latch 누락 시 사용자가 close → URL remain → re-render 시 modal 재오픈하는 silent loop는 첫 1회만으론 발견 어려움 |
./tasks/folder-picker-ux/codex-phase8.md:1995:위험 3축 2/3 충족 → /codex Phase 1 적대적 검토 의무. 다음 5묶음 질문 사전 검토:

 succeeded in 0ms:
# Diff Summary — Folder Picker UX

**Date**: 2026-05-22 (Phase 7.5.6 closure)
**Status**: Phase 7.5.6 완료 (Phase 5 base + Phase 7.5 hint/aria 강화 + Phase 7.5.6 kbd font 15px bump). 다음 단계 Phase 8 docs cycle.

## 변경 파일 (실측, `git diff --stat`)

| 파일 | 변경 유형 | 실제 +/- 라인 | 예상 (v2) | 의도 |
|------|----------|---------------|----------|------|
| `components/forms/JoinBurnIndexForm.tsx` | Modify | **+93 / -16** | ~+105 / ~-15 | S1 Path Preview Card 삽입, S2 pickFolder 4단계 분리(IDB non-fatal 포함), S3 helper text 단순화, `fsaWarning` state + JSX slot |
| `app/globals.css` | Modify | **+59 / -0** | ~+38 / ~-0 | `.path-preview-card`, `.path-preview-row`, `.path-segment`, `.path-segment--hidden`, `.path-preview-hint`, **`.form-warning`** 신규 클래스 (실제 spacing/font 디테일이 예상보다 +20줄) |
| ~~`DESIGN.md`~~ | **Skip** (Phase 3 결정) | ~~+10 / -0~~ | — | ~~Path Preview Card + `.form-warning` component spec entries~~ → Phase 3 self-audit NIT #2: 현 DESIGN.md scope는 leaderboard tier 한정, forms 추가는 scope 확장. design.md lint도 forms 미정의 상태 error 0 유지. Phase 8 retro에서 재평가 |

**합계**: 2 files, +152 / -16

## Phase 5 검증 결과 (2026-05-21)

| 검증 | 명령 | 결과 |
|------|------|------|
| 타입 | `npx tsc --noEmit` | ✅ exit 0 |
| 유닛 | `npx vitest run` | ✅ 234/234 passed |
| 빌드 | `npm run build` | ✅ success, 7 routes |
| **Invariant #1** (HMAC 노출) | `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` | ✅ 0 hits |
| 린트 | `npm run lint -- --max-warnings=0` | ⚠️ 15 warnings (모두 pre-existing, 본 변경 도입 0건) |

**린트 warning 노트**: 15건 모두 본 작업 이전부터 존재 (확인: 본 변경 영향 파일은 `JoinBurnIndexForm.tsx:103` 의 `react-hooks/exhaustive-deps` 1건이나 useEffect L98-104는 본 작업 미터치 영역). Should-pass #9 80% 룰 적용 가능 — 5/6 통과로 간주.

## Phase 7.5 + 7.5.6 Subsequent Iterations

| Commit | 날짜 | 메시지 | 파일 변경 |
|--------|------|--------|-----------|
| `b94d362` | 2026-05-22 | fix(forms): folder picker kbd visibility + home folder hint | `JoinBurnIndexForm.tsx` + `app/globals.css` (hint copy rephrase + `<code>` 3개 + `(period)` aria-hidden 라벨 + `aria-label` 2건 + `.path-preview-hint kbd` font 11→13px + `.kbd-label` 신규 + `.path-preview-hint code` 신규) |
| `3756e83` | 2026-05-22 | docs(folder-picker-ux): Phase 7.5 patch docs | `tasks/folder-picker-ux/` artifacts 갱신만 (code 변경 0) |
| `40cd00c` | 2026-05-22 | fix(forms): bump path-preview kbd 13→15px | `app/globals.css` 1 file +2/-1 (font-size 13→15px, padding 2px 7px → 2px 8px, line-height 1.4 신규) |

**Phase 7.5 + 7.5.6 합산**: code 2 files (`JoinBurnIndexForm.tsx` + `app/globals.css`). Phase 5 base 위에 점진적 누적.

**검증** (각 commit 직후 동일 절차):
- `npx tsc --noEmit` ✅ exit 0
- `npx vitest run` ✅ 234/234 passed
- `npm run build` ✅ success
- `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` ✅ 0 hits (Invariant #1)
- Vercel auto-deploy ✅ 각 commit 완료 (production secret 재확인 same-origin fetch 보조 검증)

**Owner Happy Path Gate (Phase 7.5.6)**: owner 2026-05-22 production direct check + 발화 "사이즈 괜찮음" → `smoke-golden-regression.md` Phase 7.5 row owner-direct 손글씨 기록 ✅. mcp__claude-in-chrome computed style verify (font-size 15px / padding 2px 8px / line-height 21px) 부합.

## Phase별 변경 의도

- **S1 (Path Preview Card)**: picker 버튼 위 인라인 시각 breadcrumb. `~/.claude/projects` + `~/.codex/sessions` hidden-folder emphasis + macOS/Linux reveal hint. JetBrains Mono 13px / Inter 14px 분리. Primary CTA(picker) attention drift 방지를 위해 visual weight 낮게.
- **S2 (Smart Error Differentiation + IDB Persistence Split — v2)**:
  - Step 1: picker 호출. catch 블록 4분기 (`AbortError` silent / `SecurityError` / `NotAllowedError` / fallback)
  - Step 2: name 검증 — mismatch 시 `{h.name}` 동적 삽입
  - Step 3: **handle React state 즉시 set** (saveHandle 전) — claudeHandle/codexHandle ≠ null 보장
  - Step 4: **saveHandle 별도 try-catch** — 실패는 non-fatal. `fsaWarning`에 "could not be remembered" 노출, `fsaError`는 빈 채 유지
- **S3 (Step 1 Helper Text)**: 현 문구 단순화 — Path Preview Card와 microcopy 중복 제거.

---

## 갱신 절차

Phase 5 구현 완료 직후 actual +/- 라인 수로 갱신.
Phase 7 배포 후 `git log --stat HEAD~1..HEAD -- components/forms/JoinBurnIndexForm.tsx app/globals.css`로 검증.
# Unverified Items & Known Limitations — Folder Picker UX

**Date**: 2026-05-22 (Phase 7.5.6 closure)

## Planner Contract/Criteria Spot Check

Planner spot check: contract/criteria 섹션에 코드 스니펫·diff·라인 단위 지시 ✅ 없음 (본 plan은 scope / phase 분해 / criteria만 기술, S2 pickFolder 재작성 의도는 "어떻게"가 아닌 "무엇을·어떤 분기 기준으로"로만 기술). v2 delta §I 동일 확인.

## Design Phase 3 결과 (2026-05-21)

- **Verdict**: **PASS — HIGH/MEDIUM 결함 0건** (Claude self-audit, owner 권한 위임 모드)
- **5축 + v2 추가 1축** 모두 통과 — A 시각 hierarchy / B Mono↔Inter / C token reuse / D WCAG AA / E microcopy / F fsaError↔fsaWarning
- **NIT 3건** (Phase 5 구현 시 반영, 블로킹 아님):
  1. `.path-preview-card` border → `var(--border)` 사용 (globals.css 패턴 일관)
  2. DESIGN.md `## Components` 섹션 추가 → **보류** (현 DESIGN.md scope는 leaderboard tier 한정, forms 추가는 scope 확장. diff.md `DESIGN.md ~+10/-0 (조건부)` → **skip**)
  3. `.form-warning` 시각 표현 → bg tint (`--young-coconut-soft`) 단독 사용 (border는 `.form-error`와 weight 유사, bg tint가 non-fatal 의미 더 부드러움)
- **Phase 5 진입 가능**: ✅

## Codex Phase 1 결과 (2026-05-21)

- **Verdict**: `needs-attention` → **PARTIAL** 판정
- **In-scope MEDIUM #3 (IDB persistence failure → hard blocker)**: Plan v2 delta §B에서 mitigation 반영 — picker / name check / handle state set / IDB save 4단계 분리. `fsaWarning` 신규 channel 도입. Must-pass #7 + Invariant #5 추가. 본 사이클 Phase 5 구현 의무.
- **Out-of-scope critical #1 (PyPI recovery codes 평문 노출)**: 본 plan 범위 밖 — owner 즉시 처리 필요 (재발급 + 파일 삭제 + `credentials/` `.gitignore` + git history 검증). 본 plan 진행 차단 아님
- **Out-of-scope high #2 (e2e onboarding test 비-hermetic, 실 backend 오염 가능)**: 별 사이클 — token/burnindex mock + test Redis namespace. 본 plan 진행 차단 아님

## Phase 6 Cell #2 실측 + Contingency Patch v2 (2026-05-22)

- **Cell #2 owner 실측 결과**: `e.name="AbortError"` (code 20), UI 빨간 메시지 무노출. Codex Phase 6 CONCERN MEDIUM 적중. Chrome은 홈 디렉터리 거절을 AbortError로 dispatch (SecurityError 아님).
- **Plan v3 §Contingency Patch (timing-based 1500ms) 폐기**: 실제 picker UX 호출당 10-15초 소요 → 1500ms 내 2회 발생 불가능. self-correction 후 count-based로 pivot.
- **Contingency Patch v2 (count-based) 적용**: `JoinBurnIndexForm.tsx:99 + 126-134` — `abortCountRef = useRef<number>(0)`. 1회 AbortError silent (UX exploration), 2회 누적 시 `fsaWarning` (yellow, non-fatal) 노출. Invariant #4 (e.name only) 유지. **검증 4종 PASS**: tsc / vitest 234 / build / secret leak 0.
- **잔여**: owner Cell #2 재실측 (1차 silent + 2차 fsaWarning 노출 확인). dev 서버 HMR 적용된 상태에서 localhost:3000/?auto-detect=1 reload 후 진행.
- **fsaWarning 텍스트 카피 검증**: "Trouble picking the folder? Chrome blocks system folders…" — owner 실측 시 카피 적절성 (red error 대비 부드러움 vs 명확성) 확인 의무.

## Phase 7.5.6 Closure (2026-05-22)

- **Trigger**: Phase 7.5 deploy 후 owner 추가 발화 "사이즈는 좀 키워야겠음. 좀 더 키워줘" — kbd 13px 여전히 작아 보임. font-size 1단계 추가 bump.
- **Patch**: `app/globals.css` `.path-preview-hint kbd` font-size 13→15px / padding 2px 7px → 2px 8px / line-height 1.4 신규. 색상·letter-spacing·token 무변.
- **검증**: `npx tsc --noEmit` ✅ / `npx vitest run` 234/234 ✅ / `npm run build` ✅ / `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0 ✅. WCAG AA contrast 재계산 PASS (font-size 변동은 ratio 무관 — 15px kbd `#0A0A0A` on `#FAFAFA` = 18.97:1, `.kbd-label` `#525252` on `#FFFFFF` = 7.81:1, 둘 다 ≥ 4.5:1).
- **Deploy**: Vercel commit `40cd00c` auto-deploy 완료.
- **Owner Happy Path Gate**: Phase 7.5.6 (40cd00c) 2026-05-22 owner-direct production check ✅ + mcp computed style verify ✅ (font-size 15px / padding 2px 8px / line-height 21px) + owner 발화 "사이즈 괜찮음". `smoke-golden-regression.md` Phase 7.5 row owner-direct 손글씨 기록 완료. 잔여 미검증 unchanged (Brave/Vivaldi, telemetry counter, parent-path validation Q3).

## 잔여 미검증 (Phase 5 이후 갱신)

### Brave / Vivaldi / Arc 등 Chromium 파생 브라우저 미테스트 (Codex Q1)

DOMException `name` 일관성을 Chrome 86+/Edge 86+ 외에서 미확인. 본 작업은 Chrome/Edge 사용자 기준 — 파생 브라우저에서 다른 `error.name` 반환 시 fallback ("Couldn't open the folder picker. Try a different browser…") 메시지로 흡수 예상.

**Acceptance**: Codex Phase 1 응답에서 cross-browser 명시적 결함 지적 없음 (Finding #3은 IDB persistence 별 이슈) → 통과. owner 1주 운영 모니터링 후 별도 사이클.

### macOS `⌘⇧.` glyph 폰트 fallback (Codex Q2)

~~Path Preview Card hint에 `⌘⇧·` 사용~~. Windows 기본 폰트가 U+2318/U+21E7 결손 시 tofu(`□`) 노출 가능. fallback ASCII 표기 추가는 Phase 1 Codex 결함 시점에 결정.

**2026-05-22 Cell #3 owner 실측 발견**: Plan §S1 + 구현은 `⌘⇧·` (U+00B7 MIDDLE DOT) 사용. 이는 **macOS 실제 단축키 `⌘⇧.` (U+002E PERIOD)과 다른 문자** — Codex Phase 1 Q2 검토 시 문자 식별까지 명시했으나 typo 그대로 통과. owner Cell #3 시도 시 "search로 안 잡혀" 보고로 발견. **1자 fix 적용** `JoinBurnIndexForm.tsx:423`: `·` → `.`. 검증 4종 PASS (tsc / vitest 234/234 / build / secret leak 0). Cell #1 PASS는 시각 노출 기준이므로 retroactive 영향 없음. 잔여 Windows/Linux tofu 검증은 별 사이클.

### Client-side telemetry (cancel / mismatch ratio)

cancel / mismatch 횟수 카운터 미도입. 본 사이클 non-scope. 별도 사이클에서 axis3 또는 ux-instrumentation으로 도입 검토.

### OS detection 로직

본 작업은 macOS + Linux 두 hint 동시 노출. Linux 사용자가 macOS hint를 보는 cognitive cost vs OS detection 코드 분기 비용 → 후자 더 큼 판단. 1주 운영 후 user feedback 검토.

## Known Limitations (Won't Fix This Cycle)

### Safari / Firefox FSA 미지원

`showDirectoryPicker` Safari/Firefox 미지원. 현재 `autoDetect` 분기 (line 67-73)가 `"showDirectoryPicker" in window` 체크로 fallback "Join Burn Index" 수동 폼 노출 — 본 작업은 Chrome/Edge 사용자 UX만 다룸.

### Path Preview Card 다국어화

UI 영어 유지 결정. 한국어 owner 유저는 영어 microcopy 그대로 학습 비용 감수. i18n은 별 사이클.

exec
/bin/zsh -lc "rg --files -g '*task*standard*.md' -g '*standards*.md' ~/.claude /Users/dg-2412-pn-002/Desktop/Project/Coconut\\ Labs/web 2>/dev/null | head -50" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
/Users/dg-2412-pn-002/.claude/rules/task-standards.md

exec
/bin/zsh -lc "find ~/.claude -iname 'task-standards.md' -o -iname '*standards*.md' 2>/dev/null | head -50" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
exec
/bin/zsh -lc "find .. -iname 'task-standards.md' -o -iname '*standards*.md' 2>/dev/null | head -50" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 658ms:
 succeeded in 1209ms:
/Users/dg-2412-pn-002/.claude/rules/task-standards.md

exec
/bin/zsh -lc "sed -n '1,260p' ~/.claude/rules/task-standards.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
# task-standards.md

작업 수행 표준 — Subagent 선택, 완료 기준, 질문 규칙, 커뮤니케이션.
(10단계 프로세스 정의는 `workflow-10steps.md` 참조)

## Subagent 선택 기준

- **Read-only 분석** (코드 리뷰, 아키텍처 이해) → **Explore subagent**
- **계획 수립** (설계, 리팩토링 계획) → **Plan subagent**
- **코드 변경** (구현, 버그 수정, 테스트) → **General-purpose** (기본)
- **PRD 생성/검증** (아이디어 → 스펙 문서화) → `/prd` 스킬 또는 **prd-generator/prd-validator** 에이전트
- **평가기준 추출** → **Evaluator subagent** — 정의·발동 조건·산출물 형식 단일 정의: @~/.claude/rules/agent-team.md "Evaluator 서브에이전트"

---

## Skills & Subagents 전략

### 공식 문서 엄수 (임의 로직 금지)
- **Skills**: https://code.claude.com/docs/en/skills
- **Subagents**: https://code.claude.com/docs/en/sub-agents

### 스크립트 vs 스킬 분기 (Builder Josh 멘탈모델)

자동화 자산을 두 부류로 구분해 사용 정책을 다르게 적용한다. CLAUDE.md "Superpowers 스킬 사용 제한"이 둘을 묶어 과제한했던 부분 보정.

| 분류 | 정의 | 사용 정책 |
|------|------|-----------|
| **스크립트 (Script)** | 결정적·자동화 가능 (요청·파싱·파일 변환·체크포인트·헤드리스 호출 래퍼 등) | **자유롭게 작성·실행**. 반복 N≥3회면 즉시 코드화 권장 |
| **스킬 (Skill, gstack/superpowers)** | 판단·추론·게이트가 들어가는 행위 (`/brainstorm`, `/writing-plans`, `/plan-ceo-review` 등) | **명시 호출 시만**. 자동 트리거 금지(gstack 라우팅은 예외, 단 3-Axis 통과 필수) |

> 💡 헤드리스 `claude -p` 호출은 스크립트 측 도구 (owner의 손 연장). 새 owner를 만드는 게 아님 — 자세히는 @~/.claude/rules/agent-team.md "Headless 오케스트레이션".

### Claude Code 자동 제안 트리거
- 동일 형식 파일 3회 이상 생성
- 복잡한 워크플로우 2회 이상 반복
- 프로젝트 설계 단계에서 반복 패턴 명확

### 사용자 직접 제안
"이건 Skill로 만들자" → 즉시 공식 문서 기반 구현

---

## 작업 완료 기준 ("Done" definition)

**코드 변경이 있었다면:**
- [ ] 관련 테스트 실행 (pytest, unittest 등)
- [ ] 변경 내용 요약 제공
```
  변경 파일:
  1. main.py: API 재시도 로직 추가 (35-50줄)
  2. utils/logger.py: 로그 로테이션 설정
```
- [ ] 에러 처리 포함 확인
- [ ] 로깅 추가 확인
- [ ] **Review Harness 3종 출력**: 테스트 결과 / 평가기준 통과 표 / 미통과 사유 (golden-principles.md Tier1 #3)
- [ ] **독립 검증자 1패스**: 아래 "검증 분리 원칙" 통과 후 "완료" 선언

**문서/설정 변경이었다면:**
- [ ] README 업데이트 필요성 확인
- [ ] .env.example 업데이트 확인

### Fast-Path (라이트 작업 완료 기준)

다음 모두 충족하는 변경은 **Review Harness만 통과**하면 owner 단독 "완료" 발화 가능 (검증 분리 원칙 면제):

- 1파일 변경 (config·import·rename 등)
- 비핵심 로직 (외부 영향 없음, 새 의존성 없음)
- 테스트 1개 통과로 충분
- Evaluator 발동 불필요 (작업명에 ADR/PRD 매칭 0건)
- **위험 3축 0/3 충족** (아래 "코덱스 교차 리뷰 발동 임계" 위험 3축 점검 후 충족 0개일 때만 Fast-Path 가능. 로그 라인 삭제 등 ③ 관찰가능성 충족 시 Fast-Path 탈출)

> ⚠️ 모호하면 헤비로 간주. 라이트 fast-path 남용은 검증 우회의 지름길.

### 검증 분리 원칙 (구현자 ≠ 검증자)

코드 변경의 "완료"는 owner와 **다른 컨텍스트**의 1패스 reverify 후에만 선언한다. 영상1의 적대적 검증을 일반화한 안전장치.

- 발동 조건: 3개+ 파일 변경, 핵심 로직 수정, S8 직전, 또는 사용자 영향 큰 산출물
- 검증자 후보: ① 새로 띄운 Explore/Plan 서브에이전트, ② 새 Claude 세션, ③ `/codex` 교차 리뷰
- 검증 입력: `tasks/<id>/criteria.md` (A4 Evaluator 산출물). 구현자가 본 기준과 **동일 기준**을 검증자에게도 먹임
- 통과 기준: 평가기준 80%+ 통과 + 검증자가 "구현 의도와 산출물 일치" 명시
- 실패 시: 미통과 항목별 owner 후속 작업 + 재실행. 검증 없이는 owner 단독 "완료" 발화 금지
- **권한 경계 (One Owner 보존)**: 검증자는 의사결정권 없음. 통과/미통과 + 근거만 반환. "이렇게 고치자"의 채택은 owner 단독 권한 (@~/.claude/rules/golden-principles.md Tier2 #6)

### 코덱스 교차 리뷰 발동 임계 (위험 기반 3축)

검증 분리 원칙의 **선호 검증자 1순위 = `/codex`**. GPT 코덱스와 Claude는 다른 모델 → 한쪽이 짠 코드를 다른 쪽이 보면 사각지대 검출. 형식 정확성·결정성에서 코덱스 우위 (모델 라우팅 표 참조).

이전 "헤비/라이트 시간 기반" 분류는 실시간 판단이 어려워(작업 시작 시점에 30분+ 여부 추정 부정확) 위험 기반 3축으로 대체. 작업 시작 시점 owner가 다음 3축을 순서대로 점검 → 충족 개수로 발동 강도 결정.

**위험 3축 (각 축은 독립적으로 평가)**:

| 축 | 트리거 | 판정 방법 |
|-----|--------|-----------|
| **① 실패비용** | 버그 발견 후 수정·복구 합산 추정 **≥ 2시간** | **항상 충족 (고정)**: DB rollback / 사용자 통지 / 재배포·재수집. 그 외는 owner 추정 — 모호하면 충족 |
| **② 영향범위** | **3+ 모듈** OR **영속 데이터**(DB·파일·캐시) OR **배포 경로** 영향 | 변경 파일 수가 아니라 영향 받는 모듈 경계 기준. utils/는 모듈로 카운트 |
| **③ 관찰가능성** | **사일런트 실패** 가능 (테스트로 즉시 검출 불가, 로그 누락, off-by-one, 누적 drift) | 단위 테스트만으로 검출 가능하면 미충족. 통합·운영 데이터로만 드러나면 충족 |

**발동 강도**:

| 축 충족 | 코덱스 교차 리뷰 |
|---------|------------------|
| 0/3 (Fast-Path 필요조건. L62 라이트 작업과 정합) | 면제 |
| 1/3 | **권장** — owner 시간 여유 시 시도 |
| 2/3 이상 | **강력 권장** — 검증 분리 원칙의 1순위 검증자로 우선 시도 |
| **보안 민감 / 결제 / 인증 / DB 마이그레이션** | **의무 + S8 `/cso` 병행** — 축 충족 수와 무관. 미실행 시 owner 단독 "완료" 발화 금지 |

> 💡 보안 행은 사고비용이 검증비용을 압도하므로 위험 3축 평가 우회 (정책 안정성). 그 외는 owner가 매 작업 시작 시 3축 점검 → plan에 충족 축 명시 의무.

> 💡 모호하면 충족으로 간주 (안전쪽). 특히 ③ 관찰가능성은 "테스트로 검출 가능한가" 의심스러우면 충족 처리.

비용 인식: 강력 권장 작업당 +30~60분 추가. 운영 1개월 후 축별 발동 횟수·고유 결함 발견 수·false positive 측정 → 임계 미달 축은 다음 retro에서 완화 (메트릭은 `project_v3_retro_due.md` retro 항목 참조).

> 출처: Maker Evan 2026-05-05 영상 ("대다수 버그가 코덱스 교차 리뷰에서 발견" 7:41) + Codex gpt-5.5 적대적 검토(2026-05-11) "시간 기반 임계 실시간 판단 불가" 지적 반영.

---

## 질문 규칙 (Clarifying questions)

**최대 2개 질문만 허용**
- 핵심적인 불명확성만 질문
- 사소한 세부사항은 합리적 가정 후 진행
- 가정 내용은 주석/docstring에 명시
- **코드로 답할 수 있는 질문은 사용자에게 묻지 않는다** — 파일 경로/함수 시그니처/기존 패턴/import 구조는 grep/Read로 먼저 확인 후, 진짜 의사결정만 질문 (근거: Matt Pocock grill-with-docs SKILL.md)

**좋은 질문 예시:**
```
✅ "데이터 저장: CSV vs Excel 중 선호하시나요?"
✅ "API rate limit 있나요? (없으면 60/분 가정)"

❌ "함수명을 process_data로 할까요?" → 명명 규칙 따라 진행
❌ "로그 레벨은 INFO?" → 기본값 사용
```

**불명확한 요구사항 처리:**
1. 합리적 가정 선택
2. 코드 주석에 가정 내용 명시
3. 완료 시 "가정한 부분" 섹션으로 보고

---

## 스펙 정제 원칙: "빼는 것이 더 어렵다"

스펙 작성 시 default mode는 **추가**가 아니라 **제거**. 보통 다 넣고 싶어하지만, 끝까지 밀어붙여 빼야 할 건 빼라.

**기능 후보 6질문** (gstack `/office-hours` 내부 사용, YC 오피스아워 차용):
1. **누가 정말 원하나?** — 가상 페르소나 X, 실제 본 사람만
2. **지금은 어떻게 해결 중인가?** — 대안 부재면 needs 의심
3. **진짜 절박한 문제인가?** — "있으면 좋은" vs "없으면 망하는"
4. **가장 작은 단위가 무엇인가?** — MVP의 V
5. **직접 본 적 있는가?** — 1차 증거
6. **미래가 보이는가?** — 이 기능이 다음 어떤 기능을 부르나

**판정 규칙**:
- 3개 이상 ❌ → 해당 기능 스펙에서 제거
- 한 개라도 약함 → 명시 후 보류 (PRD에 기록)

> 출처: YC office hours 방식, Maker Evan 2026-05-05 영상에서 차용 (2:14~4:53). gstack `/office-hours` 공식 동작과 부분 중복 가능 — 1주 운영 후 중복 시 본 룰 삭제 조건부 (decision-log 2026-05-06 롤백 기준).

---

## 디버깅 시 자동 확장

"에러 남" / "안 돼" / "왜 이래" 같은 짧은 쿼리 시 자동 수행:
1. 터미널 에러 로그 확인
2. 최근 변경 파일 확인
3. 환경변수 누락 체크
4. package.json / 설정 파일 점검

상세 규칙: `query-expansion.md` 참조

---

## 커뮤니케이션 스타일

### 요청 시 (사용자 → Claude Code)
```
✅ 좋은 예:
"네이버 쇼핑 API에서 '아이폰' 검색 후
가격 10만원 이하만 Excel 저장"

❌ 나쁜 예:
"쇼핑 데이터 처리"
```

### 응답 시 (Claude Code → 사용자)
- 코드 먼저, 설명은 필요할 때만
- 선택지: 2-3개 옵션만
- Skills/Subagents 제안: 핵심 효과 중심

exec
/bin/zsh -lc "rg -n \"3\\+ 모듈|영속|배포 경로|영향범위|실패비용|관찰가능성|Codex|codex|교차\" ~/.claude/rules/task-standards.md" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
70:- **위험 3축 0/3 충족** (아래 "코덱스 교차 리뷰 발동 임계" 위험 3축 점검 후 충족 0개일 때만 Fast-Path 가능. 로그 라인 삭제 등 ③ 관찰가능성 충족 시 Fast-Path 탈출)
79:- 검증자 후보: ① 새로 띄운 Explore/Plan 서브에이전트, ② 새 Claude 세션, ③ `/codex` 교차 리뷰
85:### 코덱스 교차 리뷰 발동 임계 (위험 기반 3축)
87:검증 분리 원칙의 **선호 검증자 1순위 = `/codex`**. GPT 코덱스와 Claude는 다른 모델 → 한쪽이 짠 코드를 다른 쪽이 보면 사각지대 검출. 형식 정확성·결정성에서 코덱스 우위 (모델 라우팅 표 참조).
95:| **① 실패비용** | 버그 발견 후 수정·복구 합산 추정 **≥ 2시간** | **항상 충족 (고정)**: DB rollback / 사용자 통지 / 재배포·재수집. 그 외는 owner 추정 — 모호하면 충족 |
96:| **② 영향범위** | **3+ 모듈** OR **영속 데이터**(DB·파일·캐시) OR **배포 경로** 영향 | 변경 파일 수가 아니라 영향 받는 모듈 경계 기준. utils/는 모듈로 카운트 |
97:| **③ 관찰가능성** | **사일런트 실패** 가능 (테스트로 즉시 검출 불가, 로그 누락, off-by-one, 누적 drift) | 단위 테스트만으로 검출 가능하면 미충족. 통합·운영 데이터로만 드러나면 충족 |
101:| 축 충족 | 코덱스 교차 리뷰 |
110:> 💡 모호하면 충족으로 간주 (안전쪽). 특히 ③ 관찰가능성은 "테스트로 검출 가능한가" 의심스러우면 충족 처리.
114:> 출처: Maker Evan 2026-05-05 영상 ("대다수 버그가 코덱스 교차 리뷰에서 발견" 7:41) + Codex gpt-5.5 적대적 검토(2026-05-11) "시간 기반 임계 실시간 판단 불가" 지적 반영.

exec
/bin/zsh -lc "nl -ba components/forms/JoinBurnIndexForm.tsx | sed -n '70,190p;390,440p'" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
exec
/bin/zsh -lc "nl -ba app/globals.css | sed -n '1,80p;1998,2075p'" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
     1	@import "tailwindcss";
     2	
     3	/* ============================================================
     4	   Design Tokens — v4 "Sharp Developer Utility"
     5	   White surfaces · Neutral borders · Vivid green accent
     6	   ============================================================ */
     7	:root {
     8	  /* Surfaces */
     9	  --bg: #FFFFFF;
    10	  --surface: #FFFFFF;
    11	  --surface-muted: #FAFAFA;
    12	  --surface-hover: #F5F5F5;
    13	  --border: #E5E7EB;
    14	  --border-strong: #D4D4D8;
    15	  --divider: #F1F1F4;
    16	
    17	  /* Text */
    18	  --fg: #0A0A0A;
    19	  --fg2: #525252;
    20	  --fg3: #8E8E8E;
    21	
    22	  /* Accents */
    23	  --young-coconut: #00D084;
    24	  --young-coconut-dark: #008C5A;
    25	  --young-coconut-soft: rgba(0, 208, 132, 0.10);
    26	  --young-coconut-vivid: #16F2A5;
    27	  --coconut-husk: #525252;
    28	  --burn-warm: #525252;
    29	  --verified: #008C5A;
    30	  --verified-soft: rgba(0, 208, 132, 0.10);
    31	  --warning: #B45309;
    32	  --warning-soft: rgba(245, 158, 11, 0.08);
    33	  --danger: #DC2626;
    34	  --data-blue: #00C2FF;
    35	
    36	  /* Typography */
    37	  --font-ui: var(--font-inter), "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    38	  --font-mono: var(--font-jetbrains-mono), "JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    39	
    40	  /* Radii */
    41	  --r-card: 8px;
    42	  --r-badge: 4px;
    43	  --r-btn: 6px;
    44	  --r-modal: 16px;
    45	
    46	  /* Motion */
    47	  --dur-fast: 120ms;
    48	  --dur-base: 200ms;
    49	  --ease: cubic-bezier(0.22, 1, 0.36, 1);
    50	
    51	  /* Layout */
    52	  --max-w: 1200px;
    53	  --gutter: 28px;
    54	  --row-h: 52px;
    55	}
    56	
    57	/* ============================================================
    58	   Tailwind theme mapping
    59	   ============================================================ */
    60	@theme {
    61	  --color-bg: var(--bg);
    62	  --color-surface: var(--surface);
    63	  --color-surface-muted: var(--surface-muted);
    64	  --color-border: var(--border);
    65	  --color-fg: var(--fg);
    66	  --color-fg2: var(--fg2);
    67	  --color-fg3: var(--fg3);
    68	  --color-accent: var(--young-coconut);
    69	  --color-accent-dark: var(--young-coconut-dark);
    70	  --color-verified: var(--verified);
    71	  --color-warning: var(--warning);
    72	  --color-danger: var(--danger);
    73	  --font-sans: var(--font-ui);
    74	  --font-mono: var(--font-mono);
    75	}
    76	
    77	/* ============================================================
    78	   Base
    79	   ============================================================ */
    80	*, *::before, *::after { box-sizing: border-box; }
  1998	
  1999	/* ============================================================
  2000	   Form — Path Preview Card + non-fatal warning
  2001	   (folder-picker-ux 2026-05-21: Approach B discoverability)
  2002	   ============================================================ */
  2003	.path-preview-card {
  2004	  background: var(--bg);
  2005	  border: 1px solid var(--border);
  2006	  border-radius: var(--r-card);
  2007	  padding: 12px;
  2008	  display: flex;
  2009	  flex-direction: column;
  2010	  gap: 6px;
  2011	  margin-bottom: 12px;
  2012	}
  2013	.path-preview-row {
  2014	  font-family: var(--font-mono);
  2015	  font-size: 13px;
  2016	  color: var(--fg2);
  2017	  display: flex;
  2018	  align-items: center;
  2019	  gap: 2px;
  2020	}
  2021	.path-segment {
  2022	  display: inline;
  2023	  color: var(--fg2);
  2024	}
  2025	.path-segment--hidden {
  2026	  outline: 1px solid var(--young-coconut-dark);
  2027	  border-radius: 2px;
  2028	  padding: 0 4px;
  2029	  margin: 0 1px;
  2030	}
  2031	.path-preview-hint {
  2032	  font-family: var(--font-ui);
  2033	  font-size: 12px;
  2034	  color: var(--fg2);
  2035	  margin: 4px 0 0;
  2036	  line-height: 1.4;
  2037	}
  2038	.path-preview-hint kbd {
  2039	  font-family: var(--font-mono);
  2040	  font-size: 15px;
  2041	  padding: 2px 8px;
  2042	  background: var(--surface-muted);
  2043	  border: 1px solid var(--border);
  2044	  border-radius: 3px;
  2045	  color: var(--fg);
  2046	  letter-spacing: 0.5px;
  2047	  line-height: 1.4;
  2048	}
  2049	.path-preview-hint .kbd-label {
  2050	  font-family: var(--font-ui);
  2051	  font-size: 11px;
  2052	  color: var(--fg2);
  2053	  margin-left: 2px;
  2054	}
  2055	.path-preview-hint code {
  2056	  font-family: var(--font-mono);
  2057	  color: inherit;
  2058	}
  2059	.form-warning {
  2060	  font-family: var(--font-ui);
  2061	  font-size: 13px;
  2062	  color: var(--fg2);
  2063	  background: var(--young-coconut-soft);
  2064	  padding: 8px 12px;
  2065	  border-radius: var(--r-card);
  2066	  margin: 8px 0;
  2067	  line-height: 1.4;
  2068	}

 succeeded in 0ms:
    70	      ? false
    71	      : _envFlag === "true" || params.get("auto-detect") === "1") &&
    72	    typeof window !== "undefined" &&
    73	    "showDirectoryPicker" in window;
    74	
    75	  const [claudeHandle, setClaudeHandle] = useState<FileSystemDirectoryHandle | null>(null);
    76	  const [codexHandle, setCodexHandle] = useState<FileSystemDirectoryHandle | null>(null);
    77	  const [salt, setSalt] = useState<string>("");
    78	  const [fsaPeriod, setFsaPeriod] = useState<Period>("week");
    79	  const [fsaEnvelope, setFsaEnvelope] = useState<BurnSummaryEnvelope | null>(null);
    80	  const [fsaError, setFsaError] = useState("");
    81	  // Non-fatal warning channel (e.g., IDB persistence failure: folder selected
    82	  // for this session but could not be remembered). Distinct from fsaError so
    83	  // the picker flow continues — Codex Phase 1 PARTIAL mitigation (Invariant #5).
    84	  const [fsaWarning, setFsaWarning] = useState("");
    85	  const [fsaLoading, setFsaLoading] = useState(false);
    86	  const [fsaHandle, setFsaHandle] = useState("");
    87	  const [fsaSubmitting, setFsaSubmitting] = useState(false);
    88	  const [showAdvanced, setShowAdvanced] = useState(false);
    89	  const [saltInput, setSaltInput] = useState("");
    90	  const [saltMsg, setSaltMsg] = useState("");
    91	
    92	  // Telemetry state (Axes 2–3)
    93	  const durationTimerRef = useRef<(() => DurationBucket) | null>(null);
    94	  // Chrome dispatches home-folder block as AbortError (Cell #2 verified
    95	  // 2026-05-22: e.name="AbortError", code=20), indistinguishable from
    96	  // intentional cancel. Surface actionable guidance only after the second
    97	  // AbortError — single cancels are common UX exploration; repeated cancels
    98	  // signal real confusion. Invariant #4 preserved: e.name only.
    99	  const abortCountRef = useRef<number>(0);
   100	  const [uploadTimeBucket, setUploadTimeBucket] = useState<DurationBucket | null>(null);
   101	  const [showSurvey, setShowSurvey] = useState(false);
   102	
   103	  // Load persisted salt and handles from IndexedDB on mount (FSA path only).
   104	  useEffect(() => {
   105	    if (!autoDetect) return;
   106	    loadOrCreateSalt().then(setSalt).catch(() => {});
   107	    loadHandle("claude").then((h) => h && setClaudeHandle(h)).catch(() => {});
   108	    loadHandle("codex").then((h) => h && setCodexHandle(h)).catch(() => {});
   109	  // eslint-disable-next-line react-hooks/exhaustive-deps
   110	  }, [autoDetect]);
   111	
   112	  // ── FSA handlers ──────────────────────────────────────────────────────────
   113	
   114	  async function pickFolder(kind: "claude" | "codex") {
   115	    // Step 1 — Picker call. Errors classified by error.name only (Invariant #4:
   116	    // locale-independent). Branches: AbortError silent / SecurityError system
   117	    // folder block / NotAllowedError permission denied / fallback.
   118	    let h: FileSystemDirectoryHandle;
   119	    try {
   120	      const picker = (window as Window & typeof globalThis & {
   121	        showDirectoryPicker(opts?: { mode?: string }): Promise<FileSystemDirectoryHandle>;
   122	      }).showDirectoryPicker;
   123	      h = await picker({ mode: "read" });
   124	    } catch (e) {
   125	      if (e instanceof DOMException) {
   126	        if (e.name === "AbortError") {
   127	          abortCountRef.current += 1;
   128	          if (abortCountRef.current >= 2) {
   129	            setFsaWarning(
   130	              "Trouble picking the folder? Chrome blocks system folders like your home directory — drill into ~/.claude/projects (or ~/.codex/sessions) specifically.",
   131	            );
   132	          }
   133	          return;
   134	        }
   135	        if (e.name === "SecurityError") {
   136	          setFsaError(
   137	            "Chrome blocked that folder because it contains system files. Drill down to your .claude/projects (or .codex/sessions) directory specifically — not your home folder.",
   138	          );
   139	          return;
   140	        }
   141	        if (e.name === "NotAllowedError") {
   142	          setFsaError(
   143	            "Read access wasn't granted. Try again and approve the picker when Chrome prompts.",
   144	          );
   145	          return;
   146	        }
   147	      }
   148	      setFsaError(
   149	        "Couldn't open the folder picker. Try a different browser or check site permissions.",
   150	      );
   151	      return;
   152	    }
   153	
   154	    // Step 2 — Name validation. Dynamic h.name + expectedName for actionable
   155	    // error message (Phase 6 cell #3 contract).
   156	    const expectedName = kind === "claude" ? "projects" : "sessions";
   157	    if (h.name !== expectedName) {
   158	      setFsaError(
   159	        `You picked "${h.name}". We need the directory literally named "${expectedName}" (inside ~/.claude/ or ~/.codex/). Try again.`,
   160	      );
   161	      return;
   162	    }
   163	
   164	    // Step 3 — Handle React state set IMMEDIATELY (before saveHandle).
   165	    // Invariant #5: picker success ≠ IDB persistence success. The folder is
   166	    // usable for this session regardless of IDB save outcome.
   167	    setFsaError("");
   168	    setFsaWarning("");
   169	    abortCountRef.current = 0;
   170	    if (kind === "claude") setClaudeHandle(h);
   171	    else setCodexHandle(h);
   172	
   173	    // Step 4 — IDB persistence is best-effort (non-fatal). Failure surfaces as
   174	    // fsaWarning (distinct channel); fsaError stays empty so Scan button is
   175	    // enabled. Re-selection required on next session if save failed.
   176	    try {
   177	      await saveHandle(kind, h);
   178	    } catch {
   179	      setFsaWarning(
   180	        "Folder selected for this session, but it could not be remembered. You'll need to pick it again next time.",
   181	      );
   182	    }
   183	  }
   184	
   185	  async function handleFsaScan() {
   186	    if (!claudeHandle && !codexHandle) {
   187	      setFsaError("Select at least one folder before scanning.");
   188	      return;
   189	    }
   190	    if (!salt) {
   390	  if (autoDetect) {
   391	    return (
   392	      <div className="form-card">
   393	        <h3 className="form-title">Auto-detect Burn Summary</h3>
   394	        <p className="form-desc">
   395	          Point this page at your{" "}
   396	          <code className="form-code-inline">.claude/projects</code> and{" "}
   397	          <code className="form-code-inline">.codex/sessions</code> folders.
   398	          Token counts are aggregated locally — only the 9 anonymised fields
   399	          join the Burn Index.
   400	        </p>
   401	
   402	        <div className="form-step">
   403	          <div className="form-step-label">Step 1 · Select folders</div>
   404	          <div className="form-step-desc">
   405	            Pick the exact folder previewed below.
   406	          </div>
   407	          <div className="path-preview-card">
   408	            <div className="path-preview-row">
   409	              <span className="path-segment">~</span>
   410	              <span>/</span>
   411	              <span className="path-segment path-segment--hidden">.claude</span>
   412	              <span>/</span>
   413	              <span className="path-segment">projects</span>
   414	            </div>
   415	            <div className="path-preview-row">
   416	              <span className="path-segment">~</span>
   417	              <span>/</span>
   418	              <span className="path-segment path-segment--hidden">.codex</span>
   419	              <span>/</span>
   420	              <span className="path-segment">sessions</span>
   421	            </div>
   422	            <p className="path-preview-hint">
   423	              From your home folder (<code>~</code>), open <code>.claude/projects</code> or <code>.codex/sessions</code>. Reveal hidden folders with{" "}
   424	              <kbd aria-label="Command Shift Period">⌘⇧.</kbd>
   425	              <span className="kbd-label" aria-hidden="true">(period)</span> on macOS or{" "}
   426	              <kbd aria-label="Control H">Ctrl+H</kbd> on Linux.
   427	            </p>
   428	          </div>
   429	          <div className="form-fsa-pickers">
   430	            <button
   431	              type="button"
   432	              className={`form-fsa-picker${claudeHandle ? " form-fsa-picker--selected" : ""}`}
   433	              onClick={() => pickFolder("claude")}
   434	            >
   435	              {claudeHandle ? `✓ ${claudeHandle.name}` : "Select .claude/projects folder"}
   436	            </button>
   437	            <button
   438	              type="button"
   439	              className={`form-fsa-picker${codexHandle ? " form-fsa-picker--selected" : ""}`}
   440	              onClick={() => pickFolder("codex")}

exec
/bin/zsh -lc 'rg -n "COLLECTOR_HMAC_SECRET|secret|0 hits|40cd00c|3756e83|b94d362|6cda4c5" tasks/folder-picker-ux/criteria-execution-log.md tasks/folder-picker-ux/diff.md tasks/folder-picker-ux/unverified.md tasks/folder-picker-ux/phase7-auxiliary-verification.md tasks/folder-picker-ux/phase7.5-auxiliary-verification.md' in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
tasks/folder-picker-ux/criteria-execution-log.md:5:**Last updated**: Phase 7.5.6 closure (Vercel `40cd00c`) — 2026-05-22. Owner production direct check + "사이즈 괜찮음" 발화로 Owner Happy Path Gate 통과. 다음 단계: Phase 8 docs cycle (decision-log + memory + Finding 1 별 사이클 brief).
tasks/folder-picker-ux/criteria-execution-log.md:11:| 1 | Build secret 노출 0건 | ✅ (local build PASS + Vercel deploy success + production main chunks 8개 전수 0 hits) | Phase 5.3 + Phase 7 commit 직전 `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0. Vercel deploy `6cda4c5` success (gh api). **Production curl 검증은 Vercel Bot Challenge로 차단** (`x-vercel-mitigated: challenge`, 403) → **Claude-in-Chrome 보조 검증 (2026-05-22)**: same-origin browser `fetch()`로 production main chunks 8개 (총 707,406 B) 전수 grep → **COLLECTOR_HMAC_SECRET 0 hits**. 상세 `phase7-auxiliary-verification.md`. Invariant #1 production 직접 검증 PASS |
tasks/folder-picker-ux/criteria-execution-log.md:12:| 2 | Path Preview Card 시각 노출 | ✅ PASS (Phase 7.5.6 owner-direct closure) | `JoinBurnIndexForm.tsx:392-411` 마크업 삽입. globals.css 6 신규 클래스. **localhost:3000/?auto-detect=1 + Join modal 자동 검증 통과** (`preflight-localhost-verification.md`): 2 rows `~/.claude/projects` + `~/.codex/sessions`, 2 hidden segments outlined, hint + kbd labels rendered. **Phase 7 production (`6cda4c5`) Claude-in-Chrome 보조 검증** (`phase7-auxiliary-verification.md`): 2 rows + 2 hidden segments + hint + 2 kbds 정확 일치. **Phase 7.5 production (`b94d362`) 추가 검증** (`phase7.5-auxiliary-verification.md`): hint copy 갱신 ("From your home folder (~), open .claude/projects or .codex/sessions. Reveal hidden folders with ⌘⇧.(period) on macOS or Ctrl+H on Linux.") + `<code>` 3개 (`~`, `.claude/projects`, `.codex/sessions`) + `(period)` 라벨 + aria-label 2건 (`Command Shift Period`, `Control H`) 모두 정확 일치. **Phase 7.5.6 production deploy `40cd00c` (2026-05-22)**: mcp__claude-in-chrome computed style verify — font-size 15px / padding 2px 8px / line-height 21px; owner production direct check + 발화 "사이즈 괜찮음" → `smoke-golden-regression.md` Phase 7.5 row owner-direct 손글씨 기록 (Owner Happy Path Gate 통과). |
tasks/folder-picker-ux/criteria-execution-log.md:14:| 4 | SecurityError actionable → AbortError count-based fsaWarning | ✅ (Cell #2 재실측 PASS, owner localhost) ⏳ (production cell #2 재실측) | **2026-05-22 Cell #2 1차 실측**: `[picker-rejection] {name: "AbortError", code: 20, message: "Failed to execute 'showDirectoryPicker' on 'Window': The user aborted a request."}` — Codex CONCERN 확인 CORRECT. Chrome은 홈 디렉터리 거절을 AbortError로 dispatch (SecurityError 아님). 단순 silent return이 SecurityError 분기를 preempt → 메시지 무노출. **Contingency Patch v2 (count-based) 적용** `JoinBurnIndexForm.tsx:99 + 126-134`: `abortCountRef = useRef<number>(0)` → 1회 silent / 2회 누적 시 `fsaWarning` (yellow, non-fatal). timing-based 1500ms 폐기 (picker 호출당 10-15초 → 1500ms 내 2회 불가능 → count-based pivot). Invariant #4 (e.name only) 유지. **검증 4종 PASS**: tsc / vitest 234/234 / build / `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0. **Cell #2 재실측 PASS (2026-05-22 owner-direct localhost)**: 1차 silent ✅ / 2차 연두색 fsaWarning 텍스트 정확 일치 ✅ / Scan 버튼 enabled 유지 ✅. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.33.04.png`. 잔여 = Phase 7 production redeploy 후 cell #2 재실측 |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:3:**Date**: 2026-05-22 (post-Vercel `b94d362` deploy)
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:11:- **URL**: `https://www.coconutlabs.xyz/?auto-detect=1&cachebust=b94d362`
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:13:- **Vercel commit**: `b94d362` (deployment target_url `https://vercel.com/chongwon-shins-projects/coconutlabs/3kKrsZNWTyZpr8TzozqVvWPmwPeR`, GitHub combined status `success`, "Deployment has completed" 2026-05-22T01:46:39Z)
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:56:### 3. COLLECTOR_HMAC_SECRET 노출 0건 (Invariant #1 production 재확인)
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:60:| Chunk | Size (B) | `COLLECTOR_HMAC_SECRET` hits |
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:69:**Invariant #1 production 직접 검증 PASS** (Bot Challenge same-origin fetch 우회 동일 절차, `phase7-auxiliary-verification.md` 형식 차용). Phase 7 (`6cda4c5`) 707,406 B / 8 chunks → Phase 7.5 (`b94d362`) 394,084 B / 5 chunks — Next.js Turbopack chunk 재구성 결과 (코드 변경량 대비 자연스러운 변동).
tasks/folder-picker-ux/phase7.5-auxiliary-verification.md:81:본 파일이 owner에게 주는 가치: **사전 신뢰 부여** — owner 1-2분 incognito 확인 시 "이미 마크업·contrast·secret leak 검증됨, 내가 할 일은 시각 1회 + 손글씨 1줄"이라는 축약된 게이트 통과 경로 제공.
tasks/folder-picker-ux/unverified.md:30:- **Contingency Patch v2 (count-based) 적용**: `JoinBurnIndexForm.tsx:99 + 126-134` — `abortCountRef = useRef<number>(0)`. 1회 AbortError silent (UX exploration), 2회 누적 시 `fsaWarning` (yellow, non-fatal) 노출. Invariant #4 (e.name only) 유지. **검증 4종 PASS**: tsc / vitest 234 / build / secret leak 0.
tasks/folder-picker-ux/unverified.md:38:- **검증**: `npx tsc --noEmit` ✅ / `npx vitest run` 234/234 ✅ / `npm run build` ✅ / `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0 ✅. WCAG AA contrast 재계산 PASS (font-size 변동은 ratio 무관 — 15px kbd `#0A0A0A` on `#FAFAFA` = 18.97:1, `.kbd-label` `#525252` on `#FFFFFF` = 7.81:1, 둘 다 ≥ 4.5:1).
tasks/folder-picker-ux/unverified.md:39:- **Deploy**: Vercel commit `40cd00c` auto-deploy 완료.
tasks/folder-picker-ux/unverified.md:40:- **Owner Happy Path Gate**: Phase 7.5.6 (40cd00c) 2026-05-22 owner-direct production check ✅ + mcp computed style verify ✅ (font-size 15px / padding 2px 8px / line-height 21px) + owner 발화 "사이즈 괜찮음". `smoke-golden-regression.md` Phase 7.5 row owner-direct 손글씨 기록 완료. 잔여 미검증 unchanged (Brave/Vivaldi, telemetry counter, parent-path validation Q3).
tasks/folder-picker-ux/unverified.md:54:**2026-05-22 Cell #3 owner 실측 발견**: Plan §S1 + 구현은 `⌘⇧·` (U+00B7 MIDDLE DOT) 사용. 이는 **macOS 실제 단축키 `⌘⇧.` (U+002E PERIOD)과 다른 문자** — Codex Phase 1 Q2 검토 시 문자 식별까지 명시했으나 typo 그대로 통과. owner Cell #3 시도 시 "search로 안 잡혀" 보고로 발견. **1자 fix 적용** `JoinBurnIndexForm.tsx:423`: `·` → `.`. 검증 4종 PASS (tsc / vitest 234/234 / build / secret leak 0). Cell #1 PASS는 시각 노출 기준이므로 retroactive 영향 없음. 잔여 Windows/Linux tofu 검증은 별 사이클.
tasks/folder-picker-ux/diff.md:23:| **Invariant #1** (HMAC 노출) | `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` | ✅ 0 hits |
tasks/folder-picker-ux/diff.md:32:| `b94d362` | 2026-05-22 | fix(forms): folder picker kbd visibility + home folder hint | `JoinBurnIndexForm.tsx` + `app/globals.css` (hint copy rephrase + `<code>` 3개 + `(period)` aria-hidden 라벨 + `aria-label` 2건 + `.path-preview-hint kbd` font 11→13px + `.kbd-label` 신규 + `.path-preview-hint code` 신규) |
tasks/folder-picker-ux/diff.md:33:| `3756e83` | 2026-05-22 | docs(folder-picker-ux): Phase 7.5 patch docs | `tasks/folder-picker-ux/` artifacts 갱신만 (code 변경 0) |
tasks/folder-picker-ux/diff.md:34:| `40cd00c` | 2026-05-22 | fix(forms): bump path-preview kbd 13→15px | `app/globals.css` 1 file +2/-1 (font-size 13→15px, padding 2px 7px → 2px 8px, line-height 1.4 신규) |
tasks/folder-picker-ux/diff.md:42:- `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` ✅ 0 hits (Invariant #1)
tasks/folder-picker-ux/diff.md:43:- Vercel auto-deploy ✅ 각 commit 완료 (production secret 재확인 same-origin fetch 보조 검증)
tasks/folder-picker-ux/phase7-auxiliary-verification.md:3:**Date**: 2026-05-22 (post-Vercel `6cda4c5` deploy)
tasks/folder-picker-ux/phase7-auxiliary-verification.md:13:- **Vercel commit**: `6cda4c5` (deployment URL `9zFwEtq2UE3436K9m6ZrnNQX7Zyw`)
tasks/folder-picker-ux/phase7-auxiliary-verification.md:37:### 2. COLLECTOR_HMAC_SECRET 노출 0건 (Invariant #1 production 재확인)
tasks/folder-picker-ux/phase7-auxiliary-verification.md:41:| Chunk | Size (B) | `COLLECTOR_HMAC_SECRET` hits |
tasks/folder-picker-ux/phase7-auxiliary-verification.md:69:본 파일이 owner에게 주는 가치: **사전 신뢰 부여** — owner 1-2분 incognito 확인 시 "이미 마크업·secret leak 검증됨, 내가 할 일은 시각 1회 + 손글씨 1줄"이라는 축약된 게이트 통과 경로 제공.
tasks/folder-picker-ux/phase7-auxiliary-verification.md:78:4. (선택) DevTools → Network → main chunk JS 하나 클릭 → Response 탭 → `⌘F` `COLLECTOR_HMAC_SECRET` 0건 확인 (위 8 chunks × 0 hits 보조 증거로 갈음 가능)

exec
/bin/zsh -lc 'rg -n "source_link|expiry|role|domain|owner|usage_count|last_validated|metadata" ~/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/*.md' in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:4:metadata: 
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:6:  role: owner
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:7:  domain: web-ui-folder-picker
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:8:  expiry: 2026-08-20
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:9:  owner: scw0526
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:10:  source_link: ../../../../../Desktop/Project/Coconut Labs/web/tasks/folder-picker-ux/criteria-execution-log.md
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:11:  usage_count: 0
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_folder-picker-ux-2026-05-22.md:12:  last_validated: 2026-05-22
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_auto-detect-flip-procedure.md:4:metadata: 
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/project_auto-detect-flip-procedure.md:23:- **ON-flip 실행됨 2026-05-21** — Axis 1 = 0이었으나 닭-달걀 문제로 owner 우회. `NEXT_PUBLIC_AUTO_DETECT_DEFAULT=true` Production live (deployment EUAHZpz1Z, 34초).
/Users/dg-2412-pn-002/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory/feedback_coconutlabs-solo-no-review-request.md:4:metadata: 

exec
/bin/zsh -lc "cd ~/.claude/projects/-Users-dg-2412-pn-002-Desktop-Project-Coconut-Labs/memory && python3 - <<'PY'
from pathlib import Path
p=Path('../../../../../Desktop/Project/Coconut Labs/web/tasks/folder-picker-ux/criteria-execution-log.md')
print((Path.cwd()/p).resolve())
print((Path.cwd()/p).exists())
PY" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
exec
/bin/zsh -lc "node - <<'NODE'
function lum(hex){hex=hex.replace('#','');const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
function ratio(a,b){const A=lum(a),B=lum(b);return ((Math.max(A,B)+0.05)/(Math.min(A,B)+0.05)).toFixed(2)}
console.log('#0A0A0A on #FAFAFA', ratio('#0A0A0A','#FAFAFA'));
console.log('#525252 on #FFFFFF', ratio('#525252','#FFFFFF'));
console.log('#525252 on #FAFAFA', ratio('#525252','#FAFAFA'));
NODE" in /Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web
 succeeded in 0ms:
#0A0A0A on #FAFAFA 18.97
#525252 on #FFFFFF 7.81
#525252 on #FAFAFA 7.49

 succeeded in 269ms:
/Users/Desktop/Project/Coconut Labs/web/tasks/folder-picker-ux/criteria-execution-log.md
False

codex
## Verdict: NEEDS-ATTENTION

### Q1 [decision-log 강한 증거]
- CONCERN: **HIGH**. Codex Phase 1/6/7 실제 verdict는 `needs-attention`이고, entry가 PASS로 쓰지는 않아 이 부분은 OK. 하지만 `Owner Happy Path 12+ cells`는 산술상도 `7+2+1+1 = 11`이고, 현재 `smoke-golden-regression.md`에는 Phase 7/7.5 rows가 아직 `⏳ owner-direct`로 남아 있어 11개 완료도 primary artifact만으로는 불충분합니다. 또한 path-limited `git log 6cda4c5..40cd00c`는 `b94d362`, `40cd00c`만 반환하며, `3756e83`은 docs-only입니다. “4 commits 각 build secret leak 0 hits”도 per-commit 근거가 부족합니다.
- MITIGATION: decision-log를 “11 planned cells” 또는 실제 완료 row 기준으로 정정하고, smoke file result columns/7.5.6 row를 primary evidence로 맞추세요. Secret-leak 문구는 “code deploys checked: 6cda4c5/b94d362/40cd00c; 3756e83 docs-only”처럼 낮추거나 commit별 evidence를 추가해야 합니다.

### Q2 [memory frontmatter]
- CONCERN: **MEDIUM**. 신규 memory의 C2 7필드(`role/domain/expiry/owner/source_link/usage_count/last_validated`)는 모두 존재합니다. `expiry: 2026-08-20` 90일은 구현 토큰·변수명까지 포함한 UX memory라 적절합니다. 다만 `source_link`가 깨집니다. memory 디렉터리 기준 resolve 시 `/Users/Desktop/Project/...`로 풀리고 실제 파일이 없습니다. 시크릿 노출은 보이지 않지만 retrieval source로는 실패합니다. 기존 memory와 frontmatter schema 불일치는 정책상 LOW/NIT이나 만료 관리에는 약점입니다.
- MITIGATION: `source_link`를 `../../../../Desktop/Project/Coconut Labs/web/tasks/folder-picker-ux/criteria-execution-log.md` 또는 절대경로/프로젝트 상대경로로 고치세요. 기존 memory는 별도 hygiene로 expiry 등만 backfill하면 충분합니다.

### Q3 [memory 본문 retrieval]
- CONCERN: **MEDIUM**. 코드 라인 단위 복붙은 없어 retrieval-friendly한 편이지만, 현재 사실과 어긋난 구체값이 있습니다. 예: memory는 hidden segment에 `--young-coconut-soft` outline이라고 쓰지만 실제 CSS는 `--young-coconut-dark` outline입니다. hint copy도 “Start from your home folder…”로 stale이고 최종 코드는 “From your home folder (`~`), open …”입니다. 토큰명·변수명·hex·commit hash 자체는 anchor 가치가 있으나, stale facts가 future regurgitation 위험을 만듭니다.
- MITIGATION: 본문을 “패턴 + final-state facts”로 정정하고, commit hashes는 “Cycle anchors”에만 두세요. “토큰/변수명은 2026-05-22 기준, 재사용 전 source_link 검증” 문구를 추가하면 90일 expiry와 잘 맞습니다.

### Q4 [Finding 1 brief 위험 3축 + Invariant #6]
- CONCERN: **LOW**. 위험 ② 충족 처리는 타당합니다. `task-standards.md` 기준이 `3+ 모듈 OR 영속 데이터 OR 배포 경로 영향`이고, production landing entry/query flow는 단일 파일이어도 사용자 진입 경로 영향으로 볼 수 있습니다. Invariant #6도 Playwright로 충분히 실측 가능합니다. `userClosedRef` reload reset 한계도 brief에 명시되어 있어 sessionStorage 대안까지 brief 단계 의무는 아닙니다.
- MITIGATION: plan v1에서 Playwright cell을 명확히 쓰세요: query 진입 → modal visible → close → same-tab rerender/history action → 재오픈 0건 → reload 시 재오픈. sessionStorage는 계속 non-scope로 두면 됩니다.

### Q5 [S10 회고 추상도]
- CONCERN: **LOW**. “잘 됐나”는 과정 나열이 섞였지만 `ON-flip 후 owner self-test`, `Codex cross-review`, `Invariant gate`라는 재사용 가능한 패턴은 있습니다. “바꿀까”는 대체로 구체적이나 자동 적용 anchor가 부족합니다. 가장 추상적인 항목은 ① staging 환경 추가입니다. 현재 staging이 없다면 액션이 아니라 별도 infra cycle입니다.
- MITIGATION: ①은 “staging/preview owner self-test cycle 생성”으로 follow-up 분리. ②는 `smoke-golden-regression.md` 템플릿 또는 글로벌 checklist 위치를 지정. ③은 DOMException 작업 checklist/memory에 anchor를 추가해야 다음 cycle에서 자동 소환됩니다.

## Phase 8 통과 기준
- HIGH/MEDIUM 결함 0건 또는 nit-only → 8.4 진입
- HIGH/MEDIUM ≥ 1건 → draft 재작성 후 재실행 (재시도 1회 한)

현재는 **HIGH 1건 + MEDIUM 2건**이므로 8.4 진입 전 draft 재작성 필요입니다.
tokens used
106,152
## Verdict: NEEDS-ATTENTION

### Q1 [decision-log 강한 증거]
- CONCERN: **HIGH**. Codex Phase 1/6/7 실제 verdict는 `needs-attention`이고, entry가 PASS로 쓰지는 않아 이 부분은 OK. 하지만 `Owner Happy Path 12+ cells`는 산술상도 `7+2+1+1 = 11`이고, 현재 `smoke-golden-regression.md`에는 Phase 7/7.5 rows가 아직 `⏳ owner-direct`로 남아 있어 11개 완료도 primary artifact만으로는 불충분합니다. 또한 path-limited `git log 6cda4c5..40cd00c`는 `b94d362`, `40cd00c`만 반환하며, `3756e83`은 docs-only입니다. “4 commits 각 build secret leak 0 hits”도 per-commit 근거가 부족합니다.
- MITIGATION: decision-log를 “11 planned cells” 또는 실제 완료 row 기준으로 정정하고, smoke file result columns/7.5.6 row를 primary evidence로 맞추세요. Secret-leak 문구는 “code deploys checked: 6cda4c5/b94d362/40cd00c; 3756e83 docs-only”처럼 낮추거나 commit별 evidence를 추가해야 합니다.

### Q2 [memory frontmatter]
- CONCERN: **MEDIUM**. 신규 memory의 C2 7필드(`role/domain/expiry/owner/source_link/usage_count/last_validated`)는 모두 존재합니다. `expiry: 2026-08-20` 90일은 구현 토큰·변수명까지 포함한 UX memory라 적절합니다. 다만 `source_link`가 깨집니다. memory 디렉터리 기준 resolve 시 `/Users/Desktop/Project/...`로 풀리고 실제 파일이 없습니다. 시크릿 노출은 보이지 않지만 retrieval source로는 실패합니다. 기존 memory와 frontmatter schema 불일치는 정책상 LOW/NIT이나 만료 관리에는 약점입니다.
- MITIGATION: `source_link`를 `../../../../Desktop/Project/Coconut Labs/web/tasks/folder-picker-ux/criteria-execution-log.md` 또는 절대경로/프로젝트 상대경로로 고치세요. 기존 memory는 별도 hygiene로 expiry 등만 backfill하면 충분합니다.

### Q3 [memory 본문 retrieval]
- CONCERN: **MEDIUM**. 코드 라인 단위 복붙은 없어 retrieval-friendly한 편이지만, 현재 사실과 어긋난 구체값이 있습니다. 예: memory는 hidden segment에 `--young-coconut-soft` outline이라고 쓰지만 실제 CSS는 `--young-coconut-dark` outline입니다. hint copy도 “Start from your home folder…”로 stale이고 최종 코드는 “From your home folder (`~`), open …”입니다. 토큰명·변수명·hex·commit hash 자체는 anchor 가치가 있으나, stale facts가 future regurgitation 위험을 만듭니다.
- MITIGATION: 본문을 “패턴 + final-state facts”로 정정하고, commit hashes는 “Cycle anchors”에만 두세요. “토큰/변수명은 2026-05-22 기준, 재사용 전 source_link 검증” 문구를 추가하면 90일 expiry와 잘 맞습니다.

### Q4 [Finding 1 brief 위험 3축 + Invariant #6]
- CONCERN: **LOW**. 위험 ② 충족 처리는 타당합니다. `task-standards.md` 기준이 `3+ 모듈 OR 영속 데이터 OR 배포 경로 영향`이고, production landing entry/query flow는 단일 파일이어도 사용자 진입 경로 영향으로 볼 수 있습니다. Invariant #6도 Playwright로 충분히 실측 가능합니다. `userClosedRef` reload reset 한계도 brief에 명시되어 있어 sessionStorage 대안까지 brief 단계 의무는 아닙니다.
- MITIGATION: plan v1에서 Playwright cell을 명확히 쓰세요: query 진입 → modal visible → close → same-tab rerender/history action → 재오픈 0건 → reload 시 재오픈. sessionStorage는 계속 non-scope로 두면 됩니다.

### Q5 [S10 회고 추상도]
- CONCERN: **LOW**. “잘 됐나”는 과정 나열이 섞였지만 `ON-flip 후 owner self-test`, `Codex cross-review`, `Invariant gate`라는 재사용 가능한 패턴은 있습니다. “바꿀까”는 대체로 구체적이나 자동 적용 anchor가 부족합니다. 가장 추상적인 항목은 ① staging 환경 추가입니다. 현재 staging이 없다면 액션이 아니라 별도 infra cycle입니다.
- MITIGATION: ①은 “staging/preview owner self-test cycle 생성”으로 follow-up 분리. ②는 `smoke-golden-regression.md` 템플릿 또는 글로벌 checklist 위치를 지정. ③은 DOMException 작업 checklist/memory에 anchor를 추가해야 다음 cycle에서 자동 소환됩니다.

## Phase 8 통과 기준
- HIGH/MEDIUM 결함 0건 또는 nit-only → 8.4 진입
- HIGH/MEDIUM ≥ 1건 → draft 재작성 후 재실행 (재시도 1회 한)

현재는 **HIGH 1건 + MEDIUM 2건**이므로 8.4 진입 전 draft 재작성 필요입니다.

---

## Re-run Verdict (2026-05-22) — PASS

**재시도 1회 한도 소진**. 3 Mitigation 적용 후 재실행 PASS (Q1 NIT-only / Q2/Q3 NONE).

### 적용된 Mitigation

- **Q1 HIGH → NIT**: `decision-log.md:357` "강한 증거" 줄 정정 — "12+ cells" → "11 planned cells", evidence 상태 명시(`owner-direct localhost ✅ 손글씨` / `owner-notes evidence 컬럼 기록(marker 미flip)` / `verbal 확인`), "4 commits secret leak" → "code deploys 3건 + `3756e83` docs-only 분리"
- **Q2 MEDIUM → NONE**: memory `source_link` 5 `../` → 4 `../` (broken path 해소, `ls -la` 정상 resolve 검증)
- **Q3 MEDIUM → NONE**: memory 본문 staleness 2건 정정 + 재사용 전 source/code 재검증 caveat 추가 (line 86)
  - `--young-coconut-soft` → `--young-coconut-dark` (실제 `globals.css:2025-2026` 일치)
  - Reveal hint stale → final production copy 일치 (실제 `JoinBurnIndexForm.tsx:422-426` 일치)

### codex 응답 (verbatim)

## Verdict (re-run): PASS

### Q1 재검증 [decision-log overclaim 해소]
- 잔존 결함 severity: NIT
- 근거: `decision-log.md:357`의 `11 planned cells` 산술은 맞습니다. Phase 6 7/7은 `smoke-golden-regression.md:65`에 일치하고, Phase 7 #1/#4는 marker가 `⏳`인 채 notes에 owner 문구가 남은 상태라 "owner-notes evidence / marker 미flip" 표현과 맞습니다.
- `3756e83` docs-only 분리도 맞습니다. `git show` 기준 `6cda4c5`, `b94d362`, `40cd00c`만 code deploy이고, `3756e83`은 tasks 문서만 변경했습니다.
- NIT: Phase 7.5/7.5.6의 "사이즈 괜찮음" 근거는 smoke 원문보다는 `criteria-execution-log.md:5`, `unverified.md:40`에 더 직접적입니다. 하지만 decision-log가 "verbal 확인"으로 낮춰 썼으므로 overclaim은 아닙니다.
- S10 ①은 별 cycle brief, ON-flip 게이트, Vercel Preview deploy, owner 직접 진입 절차까지 명시되어 행동 가능한 액션으로 구체화됐습니다.

### Q2 재검증 [memory source_link]
- 잔존 결함 severity: NONE
- 근거: memory frontmatter line 10의 `../../../../Desktop/Project/Coconut Labs/web/...` 경로가 `/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web/tasks/folder-picker-ux`로 정상 resolve됩니다. frontmatter 필수 필드도 lines 4-12에 존재합니다.

### Q3 재검증 [memory 본문 staleness]
- 잔존 결함 severity: NONE
- 근거: memory의 `--young-coconut-dark` 설명은 `globals.css:2025`의 실제 `.path-segment--hidden` outline과 일치합니다. Reveal hint도 `JoinBurnIndexForm.tsx:422`의 현재 JSX 렌더 copy와 일치합니다.
- 재사용 전 source/code 재검증 caveat도 `memory line 86`에 있어 90일 expiry staleness 위험을 충분히 낮춥니다.

## Phase 8 진입 결정
- 재시도 1회 한도 소진 기준으로 최종 PASS.
- HIGH/MEDIUM 잔존 결함 0건, Q1은 nit-only입니다. Phase 8.4 진입 가능.

tokens used: 93,034

---

### Q1 NIT 후속 (재시도 한도 소진, 본 cycle 흡수 — 잔존 후속 처리)

Codex Q1 NIT의 핵심은 "Phase 7.5/7.5.6 사이즈 괜찮음 근거가 smoke-golden-regression.md 원문보다는 criteria-execution-log.md / unverified.md에 더 직접적"이라는 점. decision-log가 "verbal 확인"으로 낮춰 써서 overclaim은 아니나, 다음 cycle 재현성 위해 후속 action 1줄 logged:

> S10 회고 후보 추가: Phase 7.5/7.5.6 같은 "verbal-only owner approval" 발화는 smoke-golden-regression.md Phase row에 owner 손글씨 1줄 동치 기록 의무화. criteria-execution-log.md / unverified.md만으로는 primary smoke evidence 부족.
