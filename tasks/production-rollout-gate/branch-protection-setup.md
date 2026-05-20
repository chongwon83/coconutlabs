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

## How the gate blocks the ON-flip PR

The ON-flip PR will touch `web/components/forms/JoinBurnIndexForm.tsx` (changing the `autoDetect` default or flag condition). The `production-rollout-gate.yml` path filter triggers on that file, causing `gate-pass` to run. If Axes 1-3 are below threshold, the check fails and GitHub prevents merge.

Axes 4-7 are always evaluated on every push (parity-test and security-test run on all branches), so their check results will already be present when the ON-flip PR is opened.

## Verification (owner manual step)

After configuring branch protection:

1. Open a dummy PR that touches `JoinBurnIndexForm.tsx` without meeting Axis 1 threshold
2. Confirm `gate-pass` check appears and fails
3. Confirm merge is blocked
4. Close the dummy PR without merging
