# Phase 7 — Claude-in-Chrome Auxiliary Verification

**Date**: 2026-05-22 (post-Vercel `6cda4c5` deploy)
**Mode**: Hybrid (Option B) — Claude-in-Chrome 사전 자동 검증 + owner 1-2분 incognito 직접 확인 + smoke-golden-regression.md 직접 기록 (owner-direct gate 유지)
**Recording rule**: 본 파일은 **보조 증거** (auxiliary evidence). smoke-golden-regression.md "Phase 7 Production 재실행" 표의 cells #1, #4는 여전히 **owner-direct manual record** 의무.

---

## 검증 환경

- **URL**: `https://www.coconutlabs.xyz/?auto-detect=1`
- **Browser**: Claude-in-Chrome MCP session (incognito 분리는 owner manual cell에서)
- **Vercel commit**: `6cda4c5` (deployment URL `9zFwEtq2UE3436K9m6ZrnNQX7Zyw`)
- **Owner manual run 대체 아님** — Bot Challenge로 막힌 curl 검증의 보조 (gate 우회 X)

---

## 검증 결과 (3/3 PASS)

### 1. Path Preview Card 마크업 (Cell #1 보조 검증)

`document.querySelector('.path-preview-card')` 정상 렌더 — Join Burn Index 모달 오픈 직후:

| 검사 | 기대 | 실측 | 결과 |
|------|------|------|------|
| `.path-preview-card` 존재 | true | true | ✅ |
| `.path-preview-row` 수 | 2 | 2 | ✅ |
| Row 1 텍스트 | `~/.claude/projects` | `~/.claude/projects` | ✅ |
| Row 2 텍스트 | `~/.codex/sessions` | `~/.codex/sessions` | ✅ |
| `.path-segment--hidden` 수 | 2 | 2 (`.claude` + `.codex` outline) | ✅ |
| `.path-preview-hint` 존재 | true | true | ✅ |
| Hint 텍스트 | `Hidden folders need: ⌘⇧. (macOS) or Ctrl+H (Linux) in your file manager` | 정확 일치 | ✅ |
| `<kbd>` glyphs | `⌘⇧.` + `Ctrl+H` | 정확 일치 | ✅ |

**잔여 owner 의무**: 1회 incognito 시각 확인 + smoke-golden-regression.md "Phase 7 Production 재실행" Cell #1 1줄 직접 기록.

### 2. COLLECTOR_HMAC_SECRET 노출 0건 (Invariant #1 production 재확인)

브라우저 세션에서 production main chunks 8개를 `fetch()` → 전수 grep:

| Chunk | Size (B) | `COLLECTOR_HMAC_SECRET` hits |
|-------|----------|------------------------------|
| `02i7dfk78~t~2.js` | 53,149 | 0 |
| `07lhk_q6pmm3r.js` | 227,537 | 0 |
| `12ys~36e.61lo.js` | 147,886 | 0 |
| `turbopack-0b3_b99ewoy8-.js` | 11,019 | 0 |
| `0dbhjjzl8qfwv.js` | 57,907 | 0 |
| `017d-7gemgh2k.js` | 79,895 | 0 |
| `03~yq9q893hmn.js` | 112,541 | 0 |
| `15xrurgzs99gv.js` | 17,472 | 0 |
| **총합** | **707,406** | **0** |

**Invariant #1 production 직접 검증 PASS** (Bot Challenge로 막혔던 curl 검증을 브라우저 fetch로 우회 — 동일 origin이라 challenge 비활성).

### 3. 시각 증거 (스크린샷)

- Screenshot ID: `ss_43987l4ec` (Claude-in-Chrome 캡처)
- 노출 요소: Auto-detect Burn Summary modal / STEP 1 SELECT FOLDERS / Path Preview Card 2 row + hint + kbd / Select .claude/projects folder 버튼 + Select .codex/sessions folder 버튼 / STEP 2 CHOOSE PERIOD (week selected) / Scan & preview 버튼 / Advanced — import Python salt 토글

---

## 게이트 규칙 (재확인)

본 파일은 smoke-golden-regression.md 표를 **대체하지 않는다**.

- `smoke-golden-regression.md` "Phase 7 Production 재실행" 표의 ⏳ owner-direct 마커가 ✅로 바뀌려면 owner의 incognito 직접 실행 + 직접 기록 필요
- harness-loop.md "Owner Happy Path 1회 직접 실행 게이트" + golden-principles.md Tier1 #3 "Evidence-Based" 둘 다 owner 손글씨 게이트

본 파일이 owner에게 주는 가치: **사전 신뢰 부여** — owner 1-2분 incognito 확인 시 "이미 마크업·secret leak 검증됨, 내가 할 일은 시각 1회 + 손글씨 1줄"이라는 축약된 게이트 통과 경로 제공.

---

## owner 다음 액션 (1-2분)

1. Chrome incognito 새 창 → `https://www.coconutlabs.xyz/?auto-detect=1` 진입
2. Auto-detect Burn Summary modal 자동 노출 확인 (위 스크린샷과 동일 형태)
3. Path Preview Card 2 row + `⌘⇧.` / `Ctrl+H` kbd 시각 확인
4. (선택) DevTools → Network → main chunk JS 하나 클릭 → Response 탭 → `⌘F` `COLLECTOR_HMAC_SECRET` 0건 확인 (위 8 chunks × 0 hits 보조 증거로 갈음 가능)
5. Cell #4: "Select .claude/projects folder" 클릭 → `~/.claude/projects` 선택 → `✓ projects` 버튼 + Scan 버튼 enabled 확인
6. `smoke-golden-regression.md` "Phase 7 Production 재실행" 표에 cells #1, #4 1줄씩 owner 손으로 기록 (auto-append 금지 marker 우회 X)
