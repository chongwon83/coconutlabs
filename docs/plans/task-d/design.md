# Task D — 검증 등급 3계층 리더보드 (S3.5 Design)

> 분기점 `8ceb3ff` / worktree `coconut-task-d` / branch `task-d-leaderboard`
> 상위 계획: `~/.claude/plans/modular-bubbling-ember.md`
> 데이터 모델 무변경 — 기존 `verif`(VerifLevel) 값만 재배치.

## 1. 인터페이스 명세

`lib/data.ts` **무수정**. 공유 타입(`VerifLevel`·`Builder`·`ImportedEntry`·
`V3_BUILDERS`·`VERIF_RANK`)은 읽기만 한다. 신규 로직은 전부 컴포넌트 내부
순수 함수 + CSS 클래스.

### 신규: `verifTier(verif)` — `BurnIndexSection.tsx` 내부 순수 함수

```ts
type Tier = "verified" | "estimated" | "selfrep";
function verifTier(verif: string): Tier
```

- `Provider-synced` | `Device-synced` → `"verified"`
- `Estimated` → `"estimated"`
- 그 외(`Self-reported` 포함) → `"selfrep"`
- 순수 함수 — 부수효과 없음. 미지 문자열은 `"selfrep"`로 폴백(안전쪽).

### 신규: `TIER_META` — 계층별 표시 메타 상수

```ts
const TIER_ORDER: Tier[] = ["verified", "estimated", "selfrep"];
const TIER_META: Record<Tier, { label: string; caption: string }>
```

| tier | label | caption |
|------|-------|---------|
| `verified` | "Verified" | "Provider or device-synced — measured at the source." |
| `estimated` | "Estimated" | "Derived from partial signals." |
| `selfrep` | "Self-reported" | "Submitted by the builder, not yet confirmed." |

### 신규: `groupByTier(rows)` — bucket 분류 헬퍼

```ts
function groupByTier<T extends { verif: string }>(rows: T[]): Record<Tier, T[]>
```

- 입력 배열을 3 bucket으로 분배. 각 bucket은 입력 순서(= VES/rank 정렬) 보존.
- 빈 bucket도 키는 존재(`[]`).

### 변경 없음

- `matchesFilter`·`periodLabel` — 기존 시그니처·동작 유지.
- `VerifBadge`·`Trend`·`Avatar` — `primitives/index.tsx` 무수정 (톤은 CSS로).

## 2. 데이터 흐름

```
BurnIndexSection({ imported })
  → filtered      = V3_BUILDERS.filter(matchesFilter(verif, filter))
  → filteredImports = imported.filter(matchesFilter(verif, filter))   (기존)
  → groupByTier(filtered)  →  { verified:[], estimated:[], selfrep:[] }
  → TIER_ORDER.map(tier =>
       bucket 비어있지 않으면:
         <tier 섹션 헤더 (label + caption + count)>
         bucket.map(<lb-row>)  )
  → .lb-imported 블록: filteredImports 를 verifTier 기준 정렬(verified 우선)
       후 기존 단일 그리드로 렌더 (서브헤더 없음)
```

- V3 리더보드(`.lb-v3` 메인 그리드)에만 3계층 **섹션 헤더**를 둔다.
- imported 블록은 별도 섹션 — tier 정렬만 적용(verified 행이 위로), 서브헤더는
  없음. 행 수가 적고 "Imported this week" 자체가 이미 별도 그룹이므로 헤더 중첩
  회피.
- 필터가 활성일 때도 동일 — 필터 통과 행만 groupByTier에 들어간다. 한 tier만
  남으면 그 헤더 1개만 보인다.
- 정렬: bucket 내부는 `V3_BUILDERS` 원본 순서(rank 1→5) 유지 = VES 내림차순.
  tier 간 순서는 `TIER_ORDER`(verified→estimated→selfrep) 고정.

## 3. 파일 경계

| 파일 | 변경 | 내용 |
|------|------|------|
| `components/BurnIndexSection.tsx` | MODIFY | `verifTier`·`TIER_META`·`groupByTier` 추가, 메인 그리드 3계층 렌더, imported tier 정렬 |
| `app/globals.css` | MODIFY | `.lb-tier-head`·`.lb-tier-*` 톤 클래스 추가 |
| `components/forms/ChallengeInviteForm.tsx` | MODIFY | triage 결과 반영한 성공 카피 (codex #4) |
| `components/primitives/index.tsx` | 무수정 | VerifBadge 톤은 CSS로 충분 — 구현 중 재평가 |
| `components/BuildersSection.tsx` | 무수정 | 카드 섹션 — 리더보드 3계층과 무관, 범위 외 |
| `lib/data.ts` | read-only | 공유 타입·`V3_BUILDERS`·`VERIF_RANK` |
| `DESIGN.md` (신규) | CREATE | S7 게이트 — google-labs YAML + 6축 prose |

> codex #4 ID 불일치 기록: `ChallengeInviteForm`의 challenge `<option>` 값은
> `lighthouse`/`zero-token`/`bug-hunt`. 계획서가 언급한 `c1/c2/c3`는 존재하지
> 않음 — 폼·route 양쪽이 같은 slug를 쓰므로 **불일치 없음**. 별도 수정 불요.

## 4. 불변 조건 (invariants)

1. **행 무손실**: `groupByTier(filtered)` 3 bucket 길이 합 = `filtered.length`.
   모든 행은 정확히 1개 bucket에 속한다 (`verifTier`는 전역 함수 — 누락·중복 0).
2. **필터 동작 유지**: 5개 필터 버튼(all/provider/device/estimated/selfrep)의
   판정은 `matchesFilter` 무변경. 3계층은 필터 **이후** 단계 — 필터 결과를
   재배치만 한다.
3. **데이터 모델 무변경**: `lib/data.ts` 0줄 수정. `verif` 필드를 읽기만 한다.
4. **정렬 안정성**: bucket 내부 순서 = 입력 순서. `V3_BUILDERS` rank 정렬이
   곧 VES 내림차순이므로 bucket 안에서 VES 순서가 깨지지 않는다.
5. **빈 상태**: 필터 결과 bucket이 비면 그 tier 헤더는 렌더 안 함. 전체가 0행
   이면 기존 빈 상태 처리에 위임 (행 없는 그리드).
6. **imported 블록 독립**: `.lb-imported`는 tier 정렬만 — `imported.length === 0`
   일 때 블록 자체 미렌더(기존 동작) 유지.

## 5. ChallengeInviteForm 카피 보정 (codex #4)

기존 성공 카피는 모든 제출을 "pending owner verification"으로 단정한다. Task C
머지 후 `claimedFixes ≤ 5`는 즉시 `verified`로 승급되므로 작은 claim에서 카피가
stale.

- route는 `201 { record }` 반환, `record.status`는 `"verified"|"unverified"`.
- 폼은 응답에서 `record.status`를 읽어 분기:
  - `verified` → "N fix(es) verified — counted toward your VES."
  - `unverified` → "N fix(es) submitted — pending owner verification."
  - status 누락(구버전/파싱 실패) → 중립 카피 "Submission received — N fix(es) recorded."
- triage 임계값(5)은 폼에 하드코딩하지 않는다 — 서버 응답의 status만 신뢰.
