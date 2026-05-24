# Burn Index 5-Column Reduction — S3.5 Design

> 분기점: 현재 main / worktree `coconut-burn-5col` 예정 / branch `burn-5col-reduction`
> 상위 계획: `~/.claude/plans/nested-singing-whale.md`
> Data model 무변경. 백엔드 0줄. UI 렌더 5컬럼으로 축소 + imported inline tier chip.

## 1. 인터페이스 명세

`BurnIndexSection.tsx` 내부 신규 순수 함수 1개. 외부 export 없음.

### 신규: `verifTierShort(verif)` — inline chip용 short-form 헬퍼

```ts
type TierShort = "verified" | "estimated" | "selfrep";
type ChipMeta = { sym: string; label: string; cls: TierShort };

function verifTierShort(verif: VerifLevel): ChipMeta
```

- `Provider-synced` | `Device-synced` → `{ sym: "✓", label: "verified", cls: "verified" }`
- `Estimated` → `{ sym: "~", label: "estimated", cls: "estimated" }`
- `Self-reported` → `{ sym: "·", label: "manual", cls: "selfrep" }`
- 미지 문자열은 `Self-reported` 분기로 폴백 (TS exhaustive default).
- 순수 함수, 부수효과 0. Task D `verifTier()` 함수와 **별개 존재** — `TIER_META` 풀라벨 대신 5문자 이하 chip 전용 출력.

### 변경 없음 (보존 의무)

- `Filter` type, `matchesFilter()`, `verifTier()`, `groupByTier()`, `TIER_ORDER`, `TIER_META`, `periodLabel()` 그대로 유지.
- `lib/data.ts`(VerifLevel/V3_BUILDERS/computeVes/verifDisplayLabel/VERIF_DISPLAY) 0줄 수정.
- `primitives/index.tsx` `VerifBadge`/`Avatar`/`Trend`/`Icon` 무수정 — `VerifBadge`는 카드 섹션에서만 사용으로 좁아짐.

### 제거 (BurnIndexSection.tsx 한정)

- `import { Sparkline } from "@/components/Sparkline"` — 본 파일에서만 제거. `Sparkline.tsx`/`BuildersSection.tsx` 사용은 영향 없음.
- 두 그리드 헤더의 `<span class="lb-col-verif|fixes|ves|spark">` 4개씩 제거.
- 두 그리드 행의 verif/fixes/ves/spark 셀 4개씩 제거.
- V3 행의 `<VerifBadge level={b.verif} />` 셀 제거. imported 행의 `<VerifBadge level={e.verif} />` 셀도 제거 — imported는 핸들 옆 inline chip으로 대체.

## 2. 데이터 흐름

```
BurnIndexSection({ imported })
  → filtered = V3_BUILDERS.filter(matchesFilter(b.verif, filter))   (기존)
  → filteredImports = imported.filter(matchesFilter(e.verif, filter)) (기존)
  → grouped = groupByTier(filtered)   (Task D 그대로)
  → sortedImports = filteredImports.sort(verifTier verified-first) (기존)

  main grid (.lb-v3 메인):
    HEAD: # | Builder | Tokens | Cost | Trend                (5 col)
    TIER_ORDER.map(tier =>
      bucket 비어있지 않으면:
        <tier section header (label + caption + count)>      (Task D 유지)
        bucket.map(b =>
          ROW: rank | Avatar+handle | b.tokens | b.cost | <Trend b.trend b.trendVal>
        )
    )

  .lb-imported 블록 (imported.length > 0):
    HEAD: # | Builder | Tokens | Cost | Trend                (5 col)
    sortedImports.map(e =>
      ROW: "—" | Avatar+handle+chip+period | fmtTokensCompact(e.totalTokens) |
           fmtCostShort(e.estimatedCostUsd) | <Trend>|"—"
    )
    빈 결과 안내: 기존 .lb-imported-empty 그대로
```

### Builder 셀 구조 (imported 한정)

```
<span class="lb-col-builder">
  <Avatar initials={e.avatar} size="sm" />
  <span class="lb-imported-builder">
    <span class="lb-imported-handle-row">
      <span class="lb-handle">{e.handle}</span>
      <span class={`lb-imported-tier-chip lb-imported-tier-${meta.cls}`}>
        <span class="lb-imported-tier-sym">{meta.sym}</span>
        {meta.label}
      </span>
    </span>
    <span class="lb-imported-period">{periodLabel(e)}</span>
  </span>
</span>
```

V3 메인 그리드 Builder 셀에는 chip을 두지 않는다 — 섹션 헤더(verified/estimated/selfrep)가 이미 분류 역할을 한다.

### 행의 tier-tone 클래스는 유지

`.lb-row-${tier}` (V3) / `.lb-row-${verifTier(e.verif)}` (imported) 그대로. CSS에서 tone 색만 적용.

## 3. 파일 경계

| 파일 | 변경 | 내용 |
|------|------|------|
| `components/BurnIndexSection.tsx` | MODIFY | (1) Sparkline import 제거 (2) `verifTierShort` 추가 (3) 두 그리드 헤더 9→5 (4) V3 행 9→5 (5) imported 행 9→5 + 핸들 옆 chip (6) `TrustIcon` 등 무관 타입 유지 |
| `app/globals.css` | MODIFY | (1) `.lb-v3 .lb-head/.lb-row` grid-template-columns 9 → 5 (`32px 1.4fr 80px 80px 70px`) (2) 잉여 column 클래스 제거 (`.lb-col-verif`, `-fixes`, `-ves`, `-spark`) (3) 모바일 breakpoint 재조정 (4) `.lb-imported-tier-chip` + `.lb-imported-handle-row` 신규 |
| `docs/plans/burn-5col-reduction/design.md` | CREATE | 본 문서 (S3.5 게이트) |
| `e2e/visual.spec.ts-snapshots/*-linux.png` (3) | REBASELINE (CI) | Linux runner `visual-baseline-lock.yml` 트리거 |
| `lib/data.ts` | **무수정** | 백엔드 계약 보존 — VerifLevel union, V3_BUILDERS.fixes/ves, computeVes, verifDisplayLabel 다른 모듈 의존 |
| `lib/server/challenge.ts` | **무수정** | challenge store 닫혔으나 함수 시그니처 유지 |
| `app/api/burnindex/route.ts` | **무수정** | API 응답 스키마 무변경 |
| `lib/validateSummary.ts` | **무수정** | VerifLevel 4-union literals = Redis/localStorage 영속 계약 |
| `components/Sparkline.tsx` | **무수정** | BuildersSection이 여전히 사용 |
| `components/BuildersSection.tsx` | **무수정** | 카드 섹션 — 본 변경 스코프 외 |
| `components/primitives/index.tsx` | **무수정** | VerifBadge는 BuildersSection에서만 사용으로 좁아짐. dead-export 아님 |
| `DESIGN.md` | **무수정** | 9컬럼 명시 없음 |
| `docs/plans/task-d/design.md` | **무수정** | 컬럼 enumeration 없음 |

## 4. 불변 조건 (invariants)

1. **백엔드 0줄 수정**: `lib/data.ts` / `lib/server/` / `app/api/` / `lib/validateSummary.ts` 모두 0줄. `git diff --stat` 으로 검증. `computeVes`/`VERIF_DISPLAY`/`V3_BUILDERS.fixes`/`V3_BUILDERS.ves` 심볼 그대로.
2. **VerifLevel 4-union 보존**: `"Provider-synced" | "Device-synced" | "Estimated" | "Self-reported"` 그대로. wire format = storage contract.
3. **Task D 3계층 보존**: `TIER_META` / `TIER_ORDER` / `groupByTier` / `verifTier` 무변경. 메인 그리드 섹션 헤더(label+caption+count) 그대로 렌더.
4. **Sparkline 잔재 0**: `grep -n "Sparkline" components/BurnIndexSection.tsx` → 0 hits. import·태그·sparkFor 호출 모두 없음.
5. **그리드 컬럼 일관성**: V3 메인 그리드와 imported 그리드의 `grid-template-columns` 동일 — `32px 1.4fr 80px 80px 70px` (총 5트랙). 헤더와 행이 같은 트랙 정의 공유.
6. **잉여 column 클래스 0**: `grep -nE "lb-col-(verif|fixes|ves|spark)" web/` → 0 hits. 컴포넌트와 CSS 동시 제거.
7. **빈 상태 행위 유지**: `imported.length === 0` 시 `.lb-imported` 블록 미렌더. `sortedImports.length === 0` 시 `.lb-imported-empty` 카피 유지. 메인 그리드는 기존 그대로 — 모든 tier bucket이 비면 헤더도 행도 렌더 안 함.
8. **inline chip은 imported 전용**: V3 메인 그리드의 Builder 셀에 chip 없음. 메인 그리드 tier 분류는 섹션 헤더가, imported는 inline chip이 담당 — 책임 분리.
9. **WCAG AA 4.5:1**: tier chip 색상 (verified=teal-700, estimated=amber-600, selfrep=zinc-500 톤 — 실제 토큰은 globals.css에서 확정) 모두 본문 배경 대비 4.5:1 이상. `.lb-imported-tier-sym` 단독으로도 의미 전달 (✓/~/·) — 색 단독 의존 금지.
10. **Mobile breakpoint 일관**: 좁은 폭에서 트랙 축소 시 5트랙 → 4트랙 또는 3트랙 모두 빈 셀 없이 정렬. 기존 `.lb-col-tokens/fixes/trend/spark` display:none 룰은 제거된 클래스가 없도록 정리.

## 5. /codex 교차 리뷰 게이트 (위험 3축 2/3 fuzzy)

- ① 실패비용: < 2시간 (rollback 쉬움) — 미충족
- ② 영향범위: BurnIndexSection + globals.css + 3 visual snapshots — **충족 (fuzzy)**
- ③ 관찰가능성: 모바일 회귀 사일런트 가능 — **충족 (fuzzy)**
- 판정: 2/3 → **/codex 강력 권장** (의무는 아님). S8 직전 1패스.

## 6. 검증 게이트

| Gate | 명령 | 통과 기준 |
|------|------|----------|
| S3.5 design.md | 본 파일 존재 | 4섹션 모두 작성 |
| AGENTS.md | `node_modules/next/dist/docs/` 관련 가이드 1회 확인 | 컴포넌트/CSS 가이드 deprecation 없음 |
| Typecheck | `npx tsc --noEmit` | 0 errors |
| Unit/Integration | `npx vitest run` | burn 관련 테스트 green (storage/validator 무변경) |
| E2E | `npx playwright test e2e/onboarding-30s.spec.ts` | green |
| Visual (local dry-run) | `npx playwright test --grep visual --reporter=line` | diff 발견 → CI rebaseline 트리거 |
| Visual (CI rebaseline) | `gh workflow run visual-baseline-lock.yml -f reason="burn 5-col reduction"` | 3 Linux PNG 업데이트 artifact |
| Grep — Sparkline | `grep -n "Sparkline" web/components/BurnIndexSection.tsx` | 0 hits |
| Grep — 잉여 클래스 | `grep -rnE "lb-col-(verif\|fixes\|ves\|spark)" web/` | 0 hits |
| 백엔드 0줄 | `git diff --stat main -- web/lib web/app/api` | 0 lines |
| /codex 교차 리뷰 | `/codex review` | 결함 0 또는 owner 승인 |
| Manual smoke | `pnpm dev` → 페이지 로드 + 4개 필터 클릭 + imported hover | 5컬럼 표시, tier chip 보임, sparkline 없음 |

> 본 design.md는 S6 진입 게이트. 4섹션 작성 완료 = S5 worktree로 진행 허용.
