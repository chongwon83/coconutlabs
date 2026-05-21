# Unverified Items & Known Limitations — Rollout Gate Integrity v2

**Date**: 2026-05-21

## Planner Contract/Criteria Spot Check

Planner spot check: contract/criteria 섹션에 코드 스니펫·diff·라인 단위 지시 ✅ 없음 (plan v2는 설계 의도만 기술, 구현 힌트 없음)

## Phase A — Kill-Switch Matrix

**Status**: ✅ COMPLETE (2026-05-21)

10/10 cells verified via 3 production builds (`next build && next start`) with Chrome browser automation.
Results recorded in `tasks/production-rollout-gate/smoke-golden-regression.md`.
Critical cell #4 (env=false + ?auto-detect=1 → OFF) confirmed.

## Known Limitations (Won't Fix This Cycle)

### Vercel Deployment Protection (Workaround)

The gate workflow cannot call the production metrics API from CI due to Vercel Deployment Protection (401). The adopted workaround:

1. Owner runs `curl -H "x-gate-secret: $SECRET" $URL/api/internal/rollout-gate-metrics` locally
2. Pastes JSON result as `metrics_json` input when triggering `workflow_dispatch`
3. CI evaluates the pasted JSON without calling production directly

**Limitation**: CI trusts owner-provided input; metrics could be faked. Acceptable for solo project. Full automation requires Vercel Pro or bypass token.

### HMAC Secret Rotation (Manual)

No automatic secret rotation. If `COLLECTOR_HMAC_SECRET` is compromised:

1. Owner must immediately revoke by generating a new secret (`openssl rand -hex 32`)
2. Update Vercel env → Redeploy
3. All in-flight tokens from old secret will fail gracefully (HMAC mismatch → 401)

### Rate-Limit Distributed Attack

The token issuance rate-limit (`COLLECTOR_TOKEN_ISSUE_RATE_PER_MIN=5`) is per-IP using `x-forwarded-for`. A distributed botnet can bypass by rotating IPs. Acceptable for current threat model (Axis 1 forgery requires 15+ tokens, not mass-scale).

### Phase A α-cells Not Auto-Tested

Cells α1-α4 (uppercase query, duplicate param, empty value, `01` variant) require Chrome browser manual check. These edge cases are not covered by unit tests because they exercise URL parsing in the browser, not server logic.

## Verification Gaps Accepted

| Gap | Acceptance Reason |
|-----|------------------|
| Phase A kill-switch matrix | ✅ CLOSED — 10/10 cells verified 2026-05-21 |
| Vercel production API unreachable from CI | Solo project, owner local workaround documented |
| Token rotation policy absent | Out of scope for this cycle; manual procedure documented above |
