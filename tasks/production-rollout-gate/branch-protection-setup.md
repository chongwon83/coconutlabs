# Branch Protection Setup

Apply these settings via GitHub UI at:
`github.com/<owner>/coconut-labs/settings/branches`

## Required checks for the ON-flip PR

Add a branch protection rule for `main` (or your default branch) with:

### Required status checks (must pass before merge)

| Check name | Workflow | Purpose |
|------------|----------|---------|
| `gate / gate-pass` | `production-rollout-gate.yml` | Axes 1-3 live metrics gate |
| `parity / parity` | `parity-test.yml` | Axis 4 fixture parity |
| `security / security` | `security-test.yml` | Axes 5/6/7 privacy tests |

### Settings

- **Require status checks to pass before merging**: ✅ ON
- **Require branches to be up to date before merging**: ✅ ON (ensures metrics are evaluated against latest main)
- **Do not allow bypassing the above settings**: ✅ ON (prevents owner from bypassing their own gate)

## GitHub Actions secrets to configure

Set these under `github.com/<owner>/coconut-labs/settings/secrets/actions`:

| Secret | Value | Purpose |
|--------|-------|---------|
| `ROLLOUT_GATE_SECRET` | Random 32+ char string | Auth for `/api/internal/rollout-gate-metrics` |
| `GATE_METRICS_URL` | `https://<your-vercel-domain>` | Base URL for the metrics endpoint |

The `ROLLOUT_GATE_SECRET` value must match the `ROLLOUT_GATE_SECRET` environment variable set in Vercel.

## How the gate blocks the ON-flip PR (v2: workflow_dispatch)

**Changed 2026-05-21**: The gate workflow now uses `workflow_dispatch` instead of `pull_request`.

Rationale:
- Vercel Deployment Protection returns 401 for CI, making automated metrics calls infeasible
- General PRs were being blocked when Axis 1 < 15 (development friction for non-ON-flip work)
- Solo project: owner manually triggers the gate as a ritual before merging the ON-flip PR

### v2 ON-flip Procedure

1. Ensure Axis 1 ≥ 15 AND all should-pass criteria met
2. Owner runs locally: `curl -H "x-gate-secret: $ROLLOUT_GATE_SECRET" $GATE_METRICS_URL/api/internal/rollout-gate-metrics`
3. Copy JSON response
4. GitHub → Actions → "production-rollout-gate" → Run workflow → paste JSON as `metrics_json` input
5. Review job summary — merge only if PASS

Axes 4-7 are evaluated on every push (parity-test and security-test), so their checks are already present when the ON-flip PR is opened.
