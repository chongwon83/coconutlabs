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
