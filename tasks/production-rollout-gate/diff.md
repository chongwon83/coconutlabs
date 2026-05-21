# Diff Summary — Rollout Gate Integrity v2 (2026-05-21)

## New Files (+11)

| File | Lines | Purpose |
|------|-------|---------|
| `lib/server/burn/token.ts` | ~120 | HMAC token issuance/verification/nonce |
| `lib/server/burn/rateLimiter.ts` | ~60 | Sliding window rate limiter (Upstash sorted-set) |
| `lib/client/burn/token.ts` | ~25 | Client fetch wrapper for token issuance |
| `app/api/internal/issue-collector-token/route.ts` | ~45 | Token issuance endpoint with rate-limit |
| `__tests__/burn-token.test.ts` | ~160 | 7 vitest cases: happy path, expired, tampered, nonce, kind |
| `__tests__/burn-metrics-v2-namespace.test.ts` | ~110 | 7 cases: v1 keys never touched, v2 keys used |
| `__tests__/burn-axis2-abandonment.test.ts` | ~80 | 5 cases: abandonment = max(0, started-completed-failed) |
| `tasks/production-rollout-gate/criteria.md` | ~50 | 10 must-pass + 6 should-pass criteria |
| `tasks/production-rollout-gate/notes-used.txt` | 1 | S10 usage_count tracking placeholder |
| `tasks/production-rollout-gate/criteria-execution-log.md` | ~50 | Phase D results table |
| `tasks/production-rollout-gate/diff.md` | (this file) | File-by-file change summary |

## Modified Files (+12)

| File | Change | Key Lines |
|------|--------|-----------|
| `lib/server/burn/metrics.ts` | Namespace v1→v2; abandoned field added | AXIS1_KEY, AGG_KEY constants; getMetricsSnapshot calculation |
| `app/api/burnindex/route.ts` | HMAC token gate added; NextRequest type | Lines 51-66 (header check + verifyAndConsumeToken) |
| `app/api/telemetry/auto-detect/route.ts` | HMAC token gate added; removed "NOT authenticated" comment | Same pattern as burnindex |
| `lib/client/burn/telemetry.ts` | sendBeacon→fetch migration; token issuance in sendTelemetryEvent | sendBeacon replaced with async IIFE + fetch keepalive:true |
| `components/forms/JoinBurnIndexForm.tsx` | Token attach on burnindex POST | fetchCollectorToken("burnindex") + Authorization header |
| `.github/workflows/production-rollout-gate.yml` | workflow_dispatch; set -euo pipefail; result allowlist; secrets fail-closed | Full rewrite of trigger + run blocks |
| `.env.example` | 3 new vars: COLLECTOR_HMAC_SECRET, TTL, RATE | Comments included |
| `__tests__/burn-api-period-gate.test.ts` | Token mock + NextRequest cast + Authorization header | vi.mock token; makeRequest cast fix |
| `eslint.config.mjs` | .next.*/** added to globalIgnores | Stale build artifact exclusion |
| `tasks/production-rollout-gate/status-2026-05-21.md` | 5대 결함 closed (this update) | — |
| `tasks/production-rollout-gate/branch-protection-setup.md` | workflow_dispatch change noted | — |
| `docs/decision/decision-log.md` | 2026-05-21 entry added | — |

## Totals

- New files: 11
- Modified files: 12
- Net new test cases: 19 (7 token + 7 namespace + 5 abandonment)
- Total test count: 234 (was 215 before)
- TypeScript errors: 0
- ESLint errors: 0 (15 pre-existing warnings unchanged)
