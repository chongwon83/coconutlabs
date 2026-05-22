# CEO Review — Plan v1 Landing MVP-4 안 B (2026-05-22)

**Reviewer**: Claude (gstack `/plan-ceo-review` mode)
**Target**: `tasks/landing-mvp-4/plan-v1.md`
**Mode**: SELECTIVE EXPANSION (기존 랜딩 enhancement, greenfield 아님)
**위험 3축**: 2.5/3 충족 → /codex + /cso 의무 유지

---

## 0. Pre-Review Audit (compressed)

| 체크 | 상태 |
|------|------|
| Decision-log S0 entry | ✅ `2026-05-22 [Landing Page MVP-4 안 B]` |
| Design doc | ✅ DESIGN.md lint error 0 / warning 0 (Phase 2 통과) |
| PRD F-IDs | ⚠️ 임시 F-LANDING-001~004 (정식 PRD 없음 — F5 finding 참조) |
| Memory anchor | ✅ `project_landing-mvp-4-anB-2026-05-22` |
| Prior learnings | ✅ idb-structuredclone, codex-heavy-1pass 직접 적용 |
| Solo project | ✅ chongwon83 direct-push (no PR per memory) |

---

## 1. Premise Challenge (3 strategic gaps)

### G1. Methodology Proof Gap → **해소** (Owner D2 = 옵션 1)

**문제**: 4-섹션 흐름 = Hook(Hero) → Proof(Burn) → Reassurance(Trust). 빠진 것: "왜 VES가 옳은 지표인가". 삭제될 `ChallengeSection`은 경쟁 컨텍스트 = VES 정당화 anchor였음.

**Owner 결정 (D2 = 1)**: Burn Index 섹션 헤더에 1-2줄 methodology copy 추가 — 4-섹션 골격 유지하면서 정의자 톤 보강.

**Delta to plan v1**:
- §2.1 (변경 파일 목록): `components/BurnIndexSection.tsx` 추가 — section header에 methodology copy 1-2줄
- §3 Phase 4 (S6 구현): step 추가 — "BurnIndexSection 헤더에 methodology 카피 추가"
- DESIGN.md Typography: `burn-methodology-caption` 컴포넌트 spec 신규 추가 (12-13px, on-surface, opacity-70)
- 카피 제안: **"VES = LLM 토큰당 ship된 PR 수. 30일 rolling. 3-tier 검증 (Verified > Estimated > Self-reported)."**

### G2. Irreversibility Cost → **해소** (Owner D1 = B)

**문제**: Plan v1는 4 컴포넌트(`ChallengeSection.tsx`, `BuildersSection.tsx`, `DropsSection.tsx`, `FinalCTA.tsx`)를 영구 git rm. 12개월 로드맵에서 Challenges/Builders 부활 시 재구현 비용 = ~16hr (full S3-S8 × 4).

**Owner 결정 (D1 = B)**: Feature flag 전략. 4 컴포넌트 코드 보존 + LandingApp.tsx에서 env var/flag로 hide. Phase 3+ 부활 비용 ~2hr (toggle만).

**Delta to plan v1**:
- §1.4 (Non-scope)에서 "11섹션 콘텐츠를 `/about` prune-then-redirect"는 그대로 유지하되, §2.3 (삭제 대상) → §2.3 (feature-flag hide 대상)으로 rename
- §3 Phase 4 step 6 ("삭제: ChallengeSection.tsx / ...") → 변경: "**Hide via feature flag** — LandingApp.tsx에서 env var `NEXT_PUBLIC_SHOW_LEGACY_SECTIONS=false` 기본값 + JSX conditional rendering. 4 컴포넌트 파일 자체는 보존"
- §2.1 (직접 변경): `components/LandingApp.tsx` 변경 내용 수정 — "6 import 제거" → "**4 컴포넌트 import 보존** + JSX rendering을 env var conditional로 감싸기"
- Phase 1 step 2 (외부 참조 grep) 의미 변경 — 외부 참조 0건 확인은 여전히 필요 (LandingApp.tsx에서만 conditional)

### G3. Conviction Threshold for Indie Hacker → **부분 완화 (Burn Index methodology copy)**

**문제**: 솔로 개발자 / 인디해커 = 고-회의주의 타겟. 4섹션 + 1 trust card는 industry baseline(기술 SaaS 3-8%) 하단인 1-3% 전환 위험.

**완화책**: G1 해소(methodology copy)가 conviction 일부 보충. 추가 강화는 Phase 6 자체검증으로 (F4 finding 참조).

---

## 2. Additional Strategic Findings

### F3. Feature Flag Reactivation Trigger (medium severity)

**Plan v1 §8** 확장 트리거 = "Axis 1 visitors ≥ 15 → ?auto-detect=1 활성화" (auto-detect 한정). **삭제된(이제 flagged) 4 섹션의 부활 트리거는 명시 안 됨**.

**제안 추가** (plan v1 §8 또는 새 §10):

| 섹션 | 부활 트리거 (제안) | 검증 방법 |
|------|------|----------|
| Challenges | 정기 competition 회차 ≥ 1개 운영 결정 시 | 운영 결정 anchor |
| Builders | 등재 Builder ≥ 5명 도달 시 | DB 카운트 |
| Drops | 정기 발표 cadence 결정 시 | 운영 결정 anchor |
| FinalCTA | (TrustSection 흡수 영구, 부활 불필요) | — |

→ env var `NEXT_PUBLIC_SHOW_LEGACY_SECTIONS=true` 1회 변경 + Vercel redeploy ≈ 5분 작업.

### F4. Trust Signal Sufficiency Check (low-medium severity)

**Plan v1**: 1 trust card + 장식적 Trust 섹션 = MVP 최소. 솔로 개발자 타겟이 conviction에 도달하는지 **검증 게이트 없음**.

**제안 추가 (plan v1 §3 Phase 7 또는 §10 신규)**:

> **출시 후 1주 self-check**: waitlist 전환율 측정 →
> - ≥ 5% 도달: 4섹션 MVP 검증 완료
> - 3~5%: trust card 1개 추가 (Trust 섹션 1 → 2 카드)
> - < 3%: Challenges 섹션 flag 해제 검토 + AskUserQuestion 필요

→ 전환율 측정은 기존 `JoinBurnIndexForm` submit telemetry로 가능 (Plan v1 §6 ③ 관찰가능성 보강 가능).

### F5. PRD 정식화 결정 (low severity, 후속 사이클 안건)

**Plan v1 §8** "본 프로젝트에 공식 PRD 파일 없음. 임시 F-LANDING-001~004 매핑". S4 review 후 prd-generator 활용 검토 명시.

**CEO 권고**: 본 사이클은 임시 매핑으로 진행. 출시 후 1주 self-check (F4)와 함께 prd-generator로 정식 PRD 생성 검토. F-ID는 그대로 유지하면 호환.

→ **본 사이클에서는 액션 없음. 다음 사이클 backlog 등재.**

---

## 3. Plan v1 Delta 종합 (작성 후 plan-v1.1.md 또는 amendment로 적용)

| Section | Change | 영향 |
|---------|--------|------|
| §2.1 (변경 파일) | `components/BurnIndexSection.tsx` 행 신규 추가 (methodology copy) + LandingApp.tsx 변경 내용 수정 (delete → flag) | +1 row, modify 1 row |
| §2.3 (삭제 → flag) | "삭제 대상 (4 파일)" → "**Feature-flag hide 대상 (4 파일)**" + 제거 사유 → hide 사유로 rephrase | rename + content |
| §3 Phase 1 | step 2 "외부 참조 grep" 의미 명확화: LandingApp.tsx 외 0건은 여전히 의무 | 명확화 |
| §3 Phase 4 | step 6 "삭제" → "**Feature flag hide**" + step 0.5 추가 "BurnIndexSection methodology copy" | reorder + content |
| §3 Phase 5 | DESIGN.md `burn-methodology-caption` spec 추가 검증 | +1 verification |
| §3 Phase 7 | Owner Happy Path에 "Burn Index methodology copy 시각 확인" 1줄 추가 | +1 check |
| §8 신규 §8.1 | F3 부활 트리거 표 4행 추가 | new subsection |
| §10 신규 (or §3 Phase 8 확장) | F4 "출시 후 1주 self-check" 절차 명문화 | new section |

**Owner 확인 필요**: 이 delta를 별도 amendment file로 만들지 (`plan-v1-amendment-ceo.md`), plan v1.1로 새 버전 생성할지, plan v1 내 인라인 수정할지 — Plan-as-Artifact 정책상 **별도 파일 권장** (불변성 보존).

---

## 4. 최종 권고 (CEO 모드)

### 4.1 진행 권고: **plan v1 + 본 delta 적용 후 진입**

| 진입 조건 | 상태 |
|----------|------|
| Premise challenge 해소 | ✅ G1/G2 owner 결정 반영 |
| Strategic risks 식별 | ✅ F3/F4/F5 backlog 등재 |
| 위험 3축 의무 (codex + cso) | ✅ Phase 6에 명시되어 있음 |
| Delta 산출 (S4 의무) | ✅ 본 review 자체가 Delta |

### 4.2 다음 단계

1. **Delta 적용 결정**: amendment file 작성 vs plan v1.1 vs 인라인 → owner 선택
2. **`/plan-eng-review` 진입** (기술 검증): Hero `onChallenge` contract 변경, Suspense boundary 보존, 8 파일 변경 영향, feature flag 구현 패턴
3. /plan-eng-review 통과 후 → S5 worktree 분리 (단일 파일 아님 — 8 파일+ 변경, worktree 권장)
4. → Phase 4 S6 구현 진입

### 4.3 Mode 최종 판정

**SELECTIVE EXPANSION**:
- ✅ EXPANSION (추가): Burn Index methodology copy + feature flag pattern
- ✅ HOLD (유지): 4섹션 골격, Brand color invariants, VES 메트릭, E2E spec
- ✅ REDUCTION (축소 — 단 feature flag로 reversible): Challenge/Builders/Drops/FinalCTA hide

3 mode가 균형적으로 적용된 healthy plan.

---

## 5. CEO Review Self-Check

- [x] Premise challenge 수행 (G1/G2/G3)
- [x] Strategic alternatives 제시 (Section 1 AskUserQuestion 2건)
- [x] Dream state mapping (12개월)
- [x] Mode selection (SELECTIVE EXPANSION 정당화)
- [x] Plan delta 산출 (Section 3)
- [x] Solo project 정책 반영 (no PR, direct-push)
- [x] 위험 3축 의무 보존
- [x] Owner Happy Path 게이트 유지

**Verdict**: Plan v1은 **delta 적용 후 진입 가능** (HOLD with modifications).
