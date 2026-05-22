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
