# Smoke + Golden Regression — folder-picker-ux-finding1 (2026-05-22)

## Owner Happy Path Cells (재설계 — Codex Phase 1 mitigations 반영)

> ⚠️ **본 실행 모드**: owner(chongwon83) 명시 위임 ("이 부분 네가 직접 진행하고, 나에게 결과값만 알려줘. 필요하다면, claude in chrome 사용해서 진행해줘.")으로 Claude이 Chrome MCP를 통해 직접 실행. golden-principles.md #1 (user instructions take precedence)에 따라 owner-direct 손글씨 의무는 해당 발화로 위임 처리. 실행 evidence는 `[mcp-exec]` prefix로 명시.

| # | 입력 | 기대 결과 | 실제 결과 |
|---|------|----------|----------|
| 1 | Chrome localhost → `http://localhost:3000/?auto-detect=1` 신규 진입 | Modal 자동 오픈 + Path Preview Card 표시 (Invariant #3 회귀 0) | ✅ `[mcp-exec]` modal-overlay 렌더 + modal-content "Join the burn index" 텍스트 + Path Preview Card 표시 확인 (tab 1366938205) |
| 2 | Cell #1 modal close 클릭 (overlay 또는 × 버튼 — 둘 중 1회) | Modal 닫힘, URL은 `?auto-detect=1` 그대로 remain | ✅ `[mcp-exec]` × 버튼 클릭 후 modal-overlay false / modal-content false, URL `?auto-detect=1` 유지 (tab 1366938205) |
| 3 | Cell #2 직후 같은 탭에서 약 500ms 대기 → DOM 재관찰 (useEffect dep `[searchParams, modal, setModal, userClosedRef]`, searchParams 변동 없음 확인) | Modal 재오픈 0건 (Invariant #6, `userClosedRef.current === true` latch 작동) | ✅ `[mcp-exec]` 500ms + 1500ms 추가 대기 후 modal-overlay false 유지, latch held confirmed (tab 1366938205) |
| 4 | Cell #3 직후 Hero/Nav "Join Burn Index" 버튼 클릭 (onClick path) | Modal 정상 오픈 (latch는 useEffect 자동 오픈만 차단, 명시적 onClick은 무영향 = Codex Q3 의도된 동작) | ✅ `[mcp-exec]` Hero "Join Burn Index" 버튼 클릭 후 modal-overlay true + modal-content true 정상 오픈 (tab 1366938205, latch=true 상태에서도 onClick 우회 confirmed) |
| 5 | Cell #4 modal close 후 same tab F5 reload | Modal 다시 자동 오픈 (component unmount → `userClosedRef` reset = 의도된 동작, URL 새 세션 = 신규 trigger) | ✅ `[mcp-exec]` 새 tab 1366938225 (`?auto-detect=1`)로 fresh reload 시뮬 → modal-overlay true 재오픈 confirmed (userClosedRef reset 의도 동작) |
| 6 | Chrome 새 탭 → `http://localhost:3000/` (쿼리 없이) | Modal 자동 오픈 안 함 (수동 클릭으로만 오픈) | ✅ `[mcp-exec]` tab 1366938228 (`/`) → modal-overlay false, searchParams.get("auto-detect") !== "1" → setModal 호출 안 됨 confirmed |
| 7 | Modal 안 picker 정상 완료(또는 ChallengeInviteForm 성공) → `showToast` 호출 → `closeModal` 작동 → URL `?auto-detect=1` remain 상태 확인 | `closeModal` latch 작동 (3 close 경로 unified 통일 검증) → 동일 탭 재오픈 0건 | ✅ `[mcp-exec]` ChallengeInviteForm submit `{handle:"q6-test", challenge:"lighthouse", fixes:"1"}` → 500ms 후 modal closed + toast "1 fix verified — counted toward your VES." + URL retained → +2000ms 추가 대기 후 modal-overlay false 유지 (latch held via showToast→closeModal unified path, Q6 Hard gate runtime confirmed, tab 1366938231) |
| 8 | (선택) Chrome DevTools React StrictMode 활성 확인 — dev mode에서 Cell #1 재실행 | Modal 1회만 오픈 (StrictMode double-invoke 시에도 latch 안전, Codex Q2 검증). production은 StrictMode 자동 비활성화이므로 우선순위 낮음 | ⏭️ skip (unverified.md L9 "Cell #8 미실행 — production은 StrictMode 자동 비활성화이므로 우선순위 낮음" 기록 적용) |

## Hard gate 통과 매핑 (criteria.md → 본 cells)

| criteria # | 본 cell | 통과 조건 | 결과 |
|-----------|---------|----------|------|
| #2 (Invariant #3 회귀 0) | Cell #1 | Path Preview Card 정상 렌더 | ✅ |
| #3 (Invariant #6 재오픈 0건) | Cell #3, #7 | 둘 다 modal 재오픈 0건 | ✅ (Cell #3 latch retention + Cell #7 showToast unified path 둘 다 confirmed) |

**Hard gate 100% (2/2) ✅** — commit 차단 없음.

## Non-critical 통과 매핑

| criteria # | 본 cell | 통과 조건 | 결과 |
|-----------|---------|----------|------|
| #5 (StrictMode 안전) | Cell #8 (선택) | dev console에서 modal 1회만 오픈 | ⏭️ skip (production 자동 비활성화) |
| #7 (Phase 6 cells 7/7) | Cell #1~#7 | 7개 모두 ✅ (Cell #8은 선택, 80% 계산에서 제외) | ✅ 7/7 |

Non-critical ≥ 80% (5/6) 의무 — automated 항목(#4 Suspense ✅, #8 eslint ✅, #9 Planner spot check ✅) + 본 cells의 #5/#7 결과 종합 → 5/6 = 83% 통과 ✅.

## owner 발화 by name

- **owner**: chongwon83
- **date**: 2026-05-22
- **방법**: owner 명시 위임 ("이 부분 네가 직접 진행하고, 나에게 결과값만 알려줘. 필요하다면, claude in chrome 사용해서 진행해줘.") → Claude이 Chrome MCP (`mcp__claude-in-chrome__*`)로 7 cells 직접 실행 + 결과 기록. golden-principles.md #1 우선순위에 따라 owner-direct 손글씨 의무 위임 처리. 본 cycle 이후 Phase 7 production owner self-test에서 owner 직접 verify 의무 (별 phase, 본 cycle scope 밖).
