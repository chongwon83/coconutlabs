# Phase 7.5 — Claude-in-Chrome Auxiliary Verification

**Date**: 2026-05-22 (post-Vercel `b94d362` deploy)
**Mode**: Hybrid — Claude-in-Chrome 사전 자동 검증 + owner 1-2분 incognito 직접 확인 + smoke-golden-regression.md 직접 기록 (owner-direct gate 유지)
**Recording rule**: 본 파일은 **보조 증거** (auxiliary evidence). smoke-golden-regression.md "Phase 7.5 Production 재실측" 표의 cell은 여전히 **owner-direct manual record** 의무. harness-loop.md "Owner Happy Path 1회 직접 실행 게이트" 우회 X.

---

## 검증 환경

- **URL**: `https://www.coconutlabs.xyz/?auto-detect=1&cachebust=b94d362`
- **Browser**: Claude-in-Chrome MCP session (incognito 분리는 owner manual cell에서)
- **Vercel commit**: `b94d362` (deployment target_url `https://vercel.com/chongwon-shins-projects/coconutlabs/3kKrsZNWTyZpr8TzozqVvWPmwPeR`, GitHub combined status `success`, "Deployment has completed" 2026-05-22T01:46:39Z)
- **Owner manual run 대체 아님** — Phase 7.5.5 owner cell 재실측의 보조 (gate 우회 X)

---

## 검증 결과 (3/3 PASS)

### 1. kbd 시인성 + home folder copy + aria-label (Findings 2+3)

production HTML 마크업 + computed styles 실측:

| 검사 | 기대 | 실측 | 결과 |
|------|------|------|------|
| hint text (full) | "From your home folder (~), open .claude/projects or .codex/sessions. Reveal hidden folders with ⌘⇧.(period) on macOS or Ctrl+H on Linux." | 정확 일치 | ✅ |
| `<kbd>` 수 | 2 | 2 | ✅ |
| kbd[0] text | `⌘⇧.` | `⌘⇧.` | ✅ |
| kbd[0] aria-label | `Command Shift Period` | `Command Shift Period` | ✅ |
| kbd[0] font-size | 13px (Edit 1 v2) | `13px` | ✅ |
| kbd[0] letter-spacing | 0.5px (Edit 1 v2) | `0.5px` | ✅ |
| kbd[0] padding | 2px 7px (Edit 1 v2) | `2px 7px` | ✅ |
| kbd[0] color/bg | `--fg #0A0A0A` on `--surface-muted #FAFAFA` | `rgb(10,10,10)` on `rgb(250,250,250)` | ✅ |
| kbd[1] text | `Ctrl+H` | `Ctrl+H` | ✅ |
| kbd[1] aria-label | `Control H` | `Control H` | ✅ |
| `.kbd-label` 수 | 1 | 1 | ✅ |
| label text | `(period)` | `(period)` | ✅ |
| label aria-hidden | `true` (SR duplicate 방지) | `true` | ✅ |
| label font-size / family | 11px / Inter (Edit 2) | `11px` / Inter chain | ✅ |
| label color | `--fg2 #525252` (codex v2 권장) | `rgb(82,82,82)` | ✅ |
| `<code>` 수 | 3 (`~` + `.claude/projects` + `.codex/sessions`) | 3 — `~` / `.claude/projects` / `.codex/sessions` | ✅ |
| code font-family | `var(--font-mono)` (Edit 3 신규 클래스) | JetBrains Mono chain | ✅ |
| code color (inherit) | `rgb(82,82,82)` (hint 부모 색 상속) | `rgb(82,82,82)` | ✅ |

### 2. WCAG AA contrast 재계산 (Invariant #2 production 재확인)

| 페어 | 비율 | 기준 | 결과 |
|------|------|------|------|
| kbd text `#0A0A0A` on bg `#FAFAFA` | 18.97:1 | AA 4.5:1 | ✅ |
| kbd-label `#525252` on `#FFFFFF` | 7.81:1 | AA 4.5:1 | ✅ |
| hint base `#525252` on `#FFFFFF` | 7.81:1 | AA 4.5:1 | ✅ |
| code (inherit `#525252`) on `#FFFFFF` | 7.81:1 | AA 4.5:1 | ✅ |

**Invariant #2 production 직접 검증 PASS** (Edit 2 v2 — `--fg3 #8E8E8E` → `--fg2 #525252` 변경으로 AA 충족 회복).

### 3. COLLECTOR_HMAC_SECRET 노출 0건 (Invariant #1 production 재확인)

브라우저 세션에서 production main chunks를 `fetch()` → 전수 grep:

| Chunk | Size (B) | `COLLECTOR_HMAC_SECRET` hits |
|-------|----------|------------------------------|
| `15xrurgzs99gv.js` | 17,472 | 0 |
| `07lhk_q6pmm3r.js` | 227,537 | 0 |
| `turbopack-0b3_b99ewoy8-.js` | 11,019 | 0 |
| `0dbhjjzl8qfwv.js` | 57,907 | 0 |
| `0.3-f2eo1o0qp.js` | 80,149 | 0 |
| **총합** | **394,084** | **0** |

**Invariant #1 production 직접 검증 PASS** (Bot Challenge same-origin fetch 우회 동일 절차, `phase7-auxiliary-verification.md` 형식 차용). Phase 7 (`6cda4c5`) 707,406 B / 8 chunks → Phase 7.5 (`b94d362`) 394,084 B / 5 chunks — Next.js Turbopack chunk 재구성 결과 (코드 변경량 대비 자연스러운 변동).

---

## 게이트 규칙 (재확인)

본 파일은 smoke-golden-regression.md 표를 **대체하지 않는다**.

- `smoke-golden-regression.md` "Phase 7.5 Production 재실측" 표의 ⏳ owner-direct 마커가 ✅로 바뀌려면 owner의 incognito 직접 실행 + 직접 기록 필요
- harness-loop.md "Owner Happy Path 1회 직접 실행 게이트" + golden-principles.md Tier1 #3 "Evidence-Based" 둘 다 owner 손글씨 게이트
- 자동 산출은 검증의 입력일 뿐, 완료 선언의 증거 아님 (auto-append 금지)

본 파일이 owner에게 주는 가치: **사전 신뢰 부여** — owner 1-2분 incognito 확인 시 "이미 마크업·contrast·secret leak 검증됨, 내가 할 일은 시각 1회 + 손글씨 1줄"이라는 축약된 게이트 통과 경로 제공.

---

## owner 다음 액션 (1-2분, smoke-golden-regression.md Phase 7.5 표)

Plan 7.5.5 verbatim:

1. Chrome incognito 새 창 → `https://www.coconutlabs.xyz/?auto-detect=1` 진입 → Hero "Join Burn Index" 클릭 → 모달 오픈
2. 시각 확인 (3종):
   - `⌘⇧.` kbd 13px 충분히 가독, `.`이 마침표가 아닌 **키 라벨**로 인지
   - `(period)` 라벨 명시 노출
   - "From your home folder" 안내 노출
3. (선택) VoiceOver(Cmd+F5) → hint 영역 Tab → "Command Shift Period" / "Control H" 또박또박 발음 확인 (Codex Q6 follow-up)
4. `smoke-golden-regression.md` "Phase 7.5 Production 재실측" 표에 cell 1줄 owner 손으로 기록 (auto-append 금지 marker 우회 X)
