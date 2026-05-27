# 핸드오프 — BurnIndexSection Cost→API cost + Hero 빈 상태 copy (2026-05-27)

## 완료된 작업

| commit | 내용 |
|--------|------|
| `79895be` | feat: BurnIndexSection Cost→API cost (SORT_COLS + e2e 5 call site lockstep) + Hero empty state outcome-led copy |
| `92b4f62` | chore(visual-baseline): Linux mobile-375 rebaseline after Cost→API cost + empty copy |
| `5622bf0` | docs(decision-log): S10 retro BurnIndexSection Cost→API cost + Hero empty state copy cycle |

Vercel Production: `success` (sha `5622bf0`, 2026-05-27T08:13 UTC)

## 현재 상태

- `BurnIndexSection` 4번째 컬럼 헤더: `Cost` → **`API cost`** (hero 미니 리더보드와 어휘 통일)
- Hero 미니 리더보드 빈 상태: CTA 제거 → outcome-led 2줄 ("Your burn score will appear here. / First card claims rank #1.")
- Linux visual baseline: mobile-375 갱신 완료. desktop-921/1280 불변 (sticky-header clip 영역)
- section-note "AI cost (USD)": **의도적 OOS** — methodology footnote로 별도 컨텍스트

## pre-existing CI 실패

`e2e/hero-fold.spec.ts` — `.nav-links` element not found (921px / 1024px 브레이크포인트)

- **내 변경 책임 아님**: commit `92b4f62` 이전 run (26499030721)에서도 동일 실패 확인
- Nav 리팩토링 시 classname 변경 추정. 다음 사이클에서 처리 필요

## 다음 사이클 후보

1. `e2e/hero-fold.spec.ts` `.nav-links` 실패 수정 (classname 확인 후 selector 교체 또는 컴포넌트 수정)
2. `BurnIndexSection` section-note "AI cost (USD)" → "API cost" 통일 (OOS였던 것, 언어 완전 통일 원하면)
3. Node.js 20 → 24 GitHub Actions 마이그레이션 (2026-06-02 강제 전환, `actions/checkout@v4` + `actions/setup-node@v4`)

## 핵심 패턴 메모

- Playwright union literal label rename: `grep '"OldLabel"' spec.ts` → 0 hits 게이트 필수 (tsc로 못 잡음)
- Vercel 배포 확인: `gh api repos/{owner}/{repo}/deployments` + `/{id}/statuses` (CLI/token 없이 가능)
- CI pre-existing 여부: `gh run list --branch main --workflow CI --limit 3` baseline 먼저
