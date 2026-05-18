# CoconutLabs Usage PoC — B-5 Results

> Hypothesis #2 validation: "Can personal CLI usage be collected device-side with verifiable trust?"
> Procedure: `docs/usage-poc.md` (B-1 → B-5). This file records the outcome.
>
> **Security:** field names, paths, and formats only — no log file contents.

```
=== CoconutLabs Usage PoC Results ===
Date: 2026-05-18
Marker: COCONUTLABS_USAGE_POC_2026_05_18

--- Environment ---
OS:                  Darwin 25.4.0 arm64 (macOS 26.4.1)
Claude Code version: 2.1.143
Codex version:       codex-cli 0.128.0
Python:              3.11.9
Git:                 2.50.1

--- Claude Code ---
Usable:                          yes
Marker found in logs:            yes
Candidate log path format:       ~/.claude/projects/<path-slug>/<uuid>.jsonl
File format:                     JSONL (text, line-delimited JSON)
Detected fields:                 input_tokens, output_tokens, cache_read_input_tokens,
                                 cache_creation_input_tokens, ephemeral_5m/1h_input_tokens,
                                 model, timestamp, sessionId, usage, service_tier,
                                 stop_reason, gitBranch, cwd, version
CLI showed usage/cost at end:    no (headless `claude -p` printed no usage summary)
Notes: No native cost field — token counts only. Raw prompt/response text DOES
       live in the file (content/message fields), but field-name extraction
       cleanly avoids it: inspect-fields.sh listed keys without any values.

--- Codex ---
Usable:                          yes
Marker found in logs:            yes
Candidate log path format:       ~/.codex/sessions/YYYY/MM/DD/rollout-<ISO8601>-<uuid>.jsonl
File format:                     JSONL (text, line-delimited JSON)
Detected fields:                 input_tokens, output_tokens, total_tokens,
                                 cached_input_tokens, reasoning_output_tokens, model,
                                 timestamp, rate_limits, used_percent, plan_type,
                                 credits, model_context_window
CLI showed usage/cost at end:    yes ("tokens used: 16,514" printed inline)
Notes: No native cost-USD field, but plan_type + rate_limits + credits make cost
       derivable. Raw text lives in payload/text/content — same as Claude.

--- Assessment ---
Easier to track:                 Codex (richer token schema + inline usage echo),
                                 but both are equally machine-parseable
Summary-without-raw-content:     yes — both are JSONL with discrete token/model/
                                 timestamp keys; a key-whitelist parser extracts
                                 efficiency signals without ever reading content fields
Recommendation:                  Go
```

## Verdict: Go — device-side collection is viable

| Criterion | Result |
|-----------|--------|
| Marker found | Yes — both Claude Code & Codex |
| Format not binary | Yes — both plain JSONL |
| Fields include token + cost | Partial — token native; cost not native, **derived** from `tokens x model price` |
| No raw prompt in *extracted* data | Yes — `inspect-fields.sh` proved key-only extraction works; raw text exists in the file but a whitelist parser never touches it |

**Why Go and not Hold:** the only gap vs. the strict criterion is that neither CLI
writes a `cost_usd` field. That is not ambiguity or a binary-format blocker — cost is
a deterministic function of `model` + token counts, which both logs carry. This is
exactly what the **"Estimated"** verification badge tier exists for.

## Hard constraint for the real collector

Both log files **do** contain raw prompts, responses, and source code in
`content` / `message` / `payload` / `text` fields. The collector must parse
specific whitelisted keys (`input_tokens`, `output_tokens`, `model`, `timestamp`,
`sessionId`) — never serialize whole objects or scan content fields.

## Next-day implications

- Build the collector as a key-whitelist JSONL reader.
  - Claude Code: `~/.claude/projects/*/*.jsonl`
  - Codex: `~/.codex/sessions/**/rollout-*.jsonl`
- Cost = **Estimated** tier (`tokens x model price`).
- A **Provider-synced** tier would require an actual billing API — out of scope today.

## PoC notes — bugs fixed during execution

- `docs/usage-poc.md` B-1: `test_divide_by_zero` rewritten so it genuinely fails
  initially (`assert divide(5, 0) is None`), giving the agent a real bug to fix.
- `tools/usage-poc/inspect-fields.sh` line 65: macOS BSD `grep -coi` emits
  multi-line counts; replaced with `grep -oi ... | wc -l | tr -d ' '`.
