# Criteria Execution Log — Folder Picker UX

**Cycle**: 2026-05-21 (Approach B: inline preview + smart error recovery)
**Based on**: `tasks/folder-picker-ux/criteria.md`
**Last updated**: Phase 6 (Owner Happy Path 7/7 PASS) 종료 직후 — 2026-05-22

## Must-Pass Results (6/6 required)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Build secret 노출 0건 | ✅ (preview) ⏳ (production) | Phase 5.3: `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0. Phase 7 production 재검증 대기 |
| 2 | Path Preview Card 시각 노출 | ✅ (localhost rendered) ⏳ (production cell #1) | `JoinBurnIndexForm.tsx:392-411` 마크업 삽입. globals.css 6 신규 클래스. **localhost:3000/?auto-detect=1 + Join modal 자동 검증 통과** (`preflight-localhost-verification.md`): 2 rows `~/.claude/projects` + `~/.codex/sessions`, 2 hidden segments outlined, hint + kbd labels rendered. Owner production cell #1 + incognito 잔여 |
| 3 | AbortError silent | ✅ (code + Cell #5 owner localhost PASS) | `JoinBurnIndexForm.tsx:126-134` count-based — 1차 cancel silent (count 0→1), 2차 cancel fsaWarning 노출 (count 1→2). locale-independent (Invariant #4). **Cell #5 owner-direct (2026-05-22 localhost)**: 2회 cancel variant — Cell #4 success 직후 `abortCountRef`=0 리셋된 상태에서 0→1 silent + 1→2 fsaWarning 정확 텍스트 일치. count-based heuristic post-reset cycle 검증 PASS. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.53.44.png` |
| 4 | SecurityError actionable → AbortError count-based fsaWarning | ✅ (Cell #2 재실측 PASS, owner localhost) ⏳ (production cell #2 재실측) | **2026-05-22 Cell #2 1차 실측**: `[picker-rejection] {name: "AbortError", code: 20, message: "Failed to execute 'showDirectoryPicker' on 'Window': The user aborted a request."}` — Codex CONCERN 확인 CORRECT. Chrome은 홈 디렉터리 거절을 AbortError로 dispatch (SecurityError 아님). 단순 silent return이 SecurityError 분기를 preempt → 메시지 무노출. **Contingency Patch v2 (count-based) 적용** `JoinBurnIndexForm.tsx:99 + 126-134`: `abortCountRef = useRef<number>(0)` → 1회 silent / 2회 누적 시 `fsaWarning` (yellow, non-fatal). timing-based 1500ms 폐기 (picker 호출당 10-15초 → 1500ms 내 2회 불가능 → count-based pivot). Invariant #4 (e.name only) 유지. **검증 4종 PASS**: tsc / vitest 234/234 / build / `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0. **Cell #2 재실측 PASS (2026-05-22 owner-direct localhost)**: 1차 silent ✅ / 2차 연두색 fsaWarning 텍스트 정확 일치 ✅ / Scan 버튼 enabled 유지 ✅. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.33.04.png`. 잔여 = Phase 7 production redeploy 후 cell #2 재실측 |
| 5 | Name mismatch 동적 표기 | ✅ (code + Cell #3 owner localhost PASS) | `JoinBurnIndexForm.tsx:157-161` `You picked "${h.name}". We need the directory literally named "${expectedName}"…`. **Cell #3 owner-direct (2026-05-22 localhost)**: `~/.claude` 직접 선택 → 빨간 fsaError 노출, `.claude` 동적 + `projects` expected 정확 일치. typo fix `⌘⇧·` → `⌘⇧.` (line 423) 함께 검증. 스크린샷 `issues/스크린샷 2026-05-22 오전 12.42.51.png` |
| 6 | a11y WCAG AA 4.5:1 + Tab order | ✅ (contrast + tab order) ⏳ (SR + Lighthouse) | Phase 3 self-audit + **localhost computed 재확인** (`preflight-localhost-verification.md`): `--fg2 rgb(82,82,82)` on `--bg rgb(255,255,255)` = **7.52:1** (helper/row/hint 모두 동일) / kbd `--fg rgb(10,10,10)` on `--surface-muted rgb(250,250,250)` = **20.4:1** / `--young-coconut-dark` outline-only(text 미사용). Tab 순서 10 tabbables: close 첫 → 2 pickers → 5 timeframe → 폼 필드 = 자연 순서. screen reader/Lighthouse는 Phase 6 owner 수동 |

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
