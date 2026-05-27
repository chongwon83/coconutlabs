# CSO Security Audit — token-path-real-verify cycle

- **Date**: 2026-05-22 20:35:03 KST
- **Branch**: main
- **Scope (narrow per criteria.md security row)**: HMAC / `timingSafeEqual` / nonce invariant preservation on the collector-token authentication boundary newly exercised by `__tests__/burn-route-token-integration.test.ts`.
- **Cycle artifacts reviewed**:
  - NEW: `__tests__/burn-route-token-integration.test.ts` (10 route-integration cases)
  - NEW: `tasks/token-path-real-verify/` (criteria.md, criteria-execution-log.md)
  - MOD: `docs/decision/decision-log.md` (S0 entry append)
  - MOD: `tasks/hygiene-and-e2e/unverified.md` (#1 resolved marking)
  - UNCHANGED production code (verified via `git diff --stat HEAD`):
    - `lib/server/burn/token.ts`
    - `app/api/burnindex/route.ts`
    - `app/api/telemetry/auto-detect/route.ts`
    - `app/api/internal/issue-collector-token/route.ts`

---

## Phase 0 — Stack mental model

| Layer | Tech |
|-------|------|
| Runtime | Node 20+ (Next.js 16.2.6 App Router) |
| Crypto | `node:crypto` — `createHmac("sha256")`, `randomBytes(16)`, `timingSafeEqual` |
| Nonce store | `@upstash/redis` with TTL = token TTL + 60s |
| Token wire format | `<nonce>.<exp>.<kind>.<hmac>` (base64url for HMAC, ASCII dot delim) |

## Phase 1 — Attack surface (token boundary only)

| Endpoint | Token kind expected | Verifier |
|----------|--------------------|----------|
| POST `/api/burnindex` | `burnindex` | `verifyAndConsumeToken(raw, "burnindex")` (route.ts:59) |
| POST `/api/telemetry/auto-detect` | `telemetry` | `verifyAndConsumeToken(raw, "telemetry")` (route.ts:30) |
| POST `/api/internal/issue-collector-token` | (issuer) | calls `issueToken(kind)` |

All three remain the only producers/consumers — no new attack surface introduced by this cycle.

## Phase 2 — Secret handling

- `process.env.COLLECTOR_HMAC_SECRET` server-only — comment line 10 of `lib/server/burn/token.ts` explicitly forbids `NEXT_PUBLIC_` prefix. Preserved.
- `getSecret()` (line 37-41) throws when unset → **fail-closed** preserved.
- Test fixture hardcodes `test-secret-value-that-is-long-enough-32chars` inside `beforeEach` (test file line 108-109). **Not a finding** — env is set per test worker, never persisted, identical to existing `burn-token.test.ts:48`. Already covered by criteria item #9.

## Phase 9 — OWASP-aligned checks (auth/crypto focus)

### A02 Cryptographic Failures

| Invariant | Source | Status |
|-----------|--------|--------|
| HMAC algorithm = SHA-256 | `token.ts:50` `createHmac("sha256", secret)` | ✅ unchanged |
| HMAC encoding = base64url | `token.ts:52` `.digest("base64url")` | ✅ unchanged |
| Constant-time comparison | `token.ts:117` `timingSafeEqual(expectedBuf, actualBuf)` | ✅ unchanged |
| Length pre-check before timingSafeEqual | `token.ts:116` `expectedBuf.length !== actualBuf.length` (timingSafeEqual itself throws on length mismatch — pre-check avoids exception and keeps response shape stable; not a timing-leak) | ✅ unchanged |
| Nonce entropy ≥ 128 bits | `token.ts:79` `randomBytes(16).toString("hex")` (16 bytes = 128 bits) | ✅ unchanged |
| HMAC input deterministic & unambiguous | `${nonce}.${exp}.${kind}` — dot delimiter; nonce is hex (no dots), exp is digits, kind is enum — no collision surface | ✅ unchanged |

### A07 Identification & Authentication Failures

| Invariant | Source | Status |
|-----------|--------|--------|
| Single-use nonce | `token.ts:127-131` GET → reject if missing → DEL | ✅ unchanged |
| TTL enforced server-side | `token.ts:106-109` `nowSec > token.exp → 401` | ✅ unchanged |
| Kind boundary enforced | `token.ts:102-104` `token.kind !== expectedKind → 401` | ✅ unchanged |
| Fail-closed on Redis outage | `getRedis()` throws (no try/swallow); route handlers return 503 | ✅ unchanged |
| Pre-registered nonce blocks forged tokens | `token.ts:84` `redis.set(...)` on issue + `token.ts:128` rejects unknown nonce | ✅ unchanged |

### New test coverage hardens (does not weaken) the boundary

The 10 route-integration cases exercise every invariant above through the **real** `verifyAndConsumeToken` path. Sanity check from `criteria-execution-log.md` § ① confirms 7 cases break when token verification is mocked → file genuinely guards the boundary.

## Phase 10 — STRIDE on token boundary

| Threat | Mitigation in code | Status |
|--------|---------------------|--------|
| **S**poofing (forge token) | HMAC SHA-256 + 128-bit nonce + pre-registration | ✅ |
| **T**ampering (modify exp/kind) | HMAC covers `nonce.exp.kind` triple | ✅ |
| **R**epudiation | Out of scope (no audit log requirement on this boundary) | n/a |
| **I**nformation disclosure | Secret server-only; verify result returns generic `reason` strings (no token contents echoed) | ✅ |
| **D**enial of service | Redis SET on issuance + DEL on verify; no unbounded operations. Pre-existing rate-limit concerns are unchanged | ✅ (unchanged) |
| **E**levation of privilege | Kind boundary (`burnindex` ≠ `telemetry`) enforced + tested case 5/10 | ✅ |

## Phase 12-13 — Findings filter & report

### Production code changes: 0
This cycle added tests + docs only. No file under `lib/`, `app/`, `pages/`, `middleware*` was modified. All security invariants in `lib/server/burn/token.ts` are byte-for-byte unchanged.

### Test file invariants (criteria.md items 1-3, 8-9)
- `vi.mock("@/lib/server/burn/token", ...)` count in new file: **0** (grep verified).
- `verifyAndConsumeToken: vi.fn(...)` count in new file: **0**.
- Real `issueToken("burnindex" | "telemetry")` called in cases 1, 4, 5, 6, 7, 8, 9, 10.
- Test secret never logged.
- Downstream mocks (`store`, `challenge`, `trend`, `metrics`) match the period-gate.test.ts pattern; token module deliberately absent (file lines 70-88).

### Findings

| # | Severity | Title | Status |
|---|----------|-------|--------|
| F1 | **INFO** | GET-then-DEL nonce check is **not atomic** in Redis | **Pre-existing, NOT introduced by this cycle** |

#### F1 detail (informational, defer to backlog)

`lib/server/burn/token.ts:127-131`:
```ts
const exists = await redis.get(nonceKey);
if (!exists) return { ok: false, status: 401, reason: "nonce already used or not issued" };
await redis.del(nonceKey);
```

Two concurrent requests with the same valid token could both observe `exists=1` before either reaches `del`, allowing a single-use nonce to be consumed twice. The atomic alternative is `redis.del(nonceKey)` first and reject when the return value is 0 (Upstash supports `DEL` with reply count).

- **Why informational, not a blocker for this cycle**: pre-existing in `lib/server/burn/token.ts` before this cycle started; cycle scope is test-only additions; not within criteria.md scope.
- **Why worth recording**: this cycle's purpose is detecting token spec drift — if `verifyAndConsumeToken` is later refactored to atomic-DEL, the new integration test (case 6 + case 8 replay) will still pass, so this finding can be tackled independently without coupling to the present commit.
- **Recommended next action (owner)**: file as next-cycle backlog item alongside `unverified.md` follow-up #2.

### Anti-manipulation check
Skill-required: no instructions found in the codebase under audit attempted to influence audit methodology. None encountered.

## Phase 14 — Verdict

**APPROVE — security row obligation satisfied.**

- HMAC SHA-256, `timingSafeEqual`, nonce single-use, fail-closed: **all preserved (unchanged)**.
- Test invariants (criteria items 1, 2, 3, 8, 9): **all verified**.
- No new attack surface, no regression in existing surface.
- One informational note (F1) on **pre-existing** GET-then-DEL atomicity — recommend filing to backlog but **not blocking this cycle's commit**.

Confidence: 9/10 (deduction: F1 atomicity is a known pre-existing pattern; full concurrency proof would require a dedicated load test outside this cycle's scope).

---

**Read-only audit. No code modified.** Owner decision on F1 backlog filing pending.
