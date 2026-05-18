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
- `tools/usage-poc/estimate_cost.py` (커밋 `78c2598`): cost round 6 → 4자리.
  `json.dumps`가 1e-4 미만 float을 지수 표기(`7.5e-05`)로 직렬화 → plain decimal 보장.

---

## 오늘 스펙 결과 (item 8)

> 2026-05-18 스펙 item 7의 고정 필드 목록(12개)을 marker 로그에 대조한 결과.
> 필드명·경로·형식만 기록 — 로그 본문/raw prompt/source 미포함.

```
[환경]
- OS:               macOS 26.4.1 (Darwin 25.4.0, arm64)
- claude --version: 2.1.143
- codex --version:  codex-cli 0.128.0

[Claude Code]
- marker 포함 파일 발견 여부: 발견
- 후보 파일 경로:            ~/.claude/projects/<path-slug>/<uuid>.jsonl
- 파일 형식:                 JSONL (line-delimited JSON, 텍스트)
- 발견된 usage 필드:         input_tokens, output_tokens,
                             cache_read(_input_tokens), cache_creation(_input_tokens),
                             model, session(Id), usage
- 미발견 (item 7 목록 중):   cached_tokens, total_tokens, tokens, cost, usd
- CLI 화면 usage/cost 표시:  없음 (headless `claude -p` 출력에 요약 없음)

[Codex]
- marker 포함 파일 발견 여부: 발견
- 후보 파일 경로:            ~/.codex/sessions/YYYY/MM/DD/rollout-<ISO8601>-<uuid>.jsonl
- 파일 형식:                 JSONL (line-delimited JSON, 텍스트)
- 발견된 usage 필드:         input_tokens, output_tokens, total_tokens, tokens,
                             model, session
                             (목록 외: cached_input_tokens, reasoning_output_tokens,
                              rate_limits, plan_type, credits 도 존재)
- 미발견 (item 7 목록 중):   cache_read, cache_creation, cached_tokens, cost, usd, usage
- CLI 화면 usage/cost 표시:  있음 ("tokens used: 16,514" 인라인 출력)
```

### 성공/실패 판정

**성공 기준 충족** — Claude Code·Codex 양쪽 모두 로컬 로그에 usage 필드(토큰/모델/세션)
보유. JSONL 텍스트 포맷이라 키 단위 파싱으로 원본 prompt/code 없이 summary 추출 가능.

- `cost`/`usd` 직접 필드는 양쪽 모두 없음 → 토큰 수 × 모델 단가로 **추정**
  (랜딩 페이지의 "Estimated" 검증 등급에 해당).
- 두 로그 파일 모두 본문(content/message/payload)에 raw text를 포함하므로,
  collector는 반드시 화이트리스트 키만 파싱하고 객체 통째 직렬화는 금지.

---

## 단가표 검증 (model-pricing.json, 2026-05-18)

> "Estimated" 등급의 cost 추정은 `tools/usage-poc/model-pricing.json` 단가표에 의존.
> 사용자가 Claude·ChatGPT의 다양한 현행/레거시 모델을 쓰므로 전 모델 단가를
> 공식 페이지 + 제3자 집계 사이트로 교차검증한 결과.

### 검증 방법

- **1차(공식)**: Anthropic·OpenAI 공식 가격 페이지 직접 대조
- **2차(교차)**: 공식 페이지 미게재 레거시 모델은 modelpricing.ai + pricepertoken.com
  2개 출처로 교차확인 (다수결 + 공식 정합 기준)
- 단가 수치만 기록 — 로그 본문/raw prompt/source 미포함

### Claude — 11행, 공식 페이지 100% 일치

| 모델 키 | input / 5m / 1h / cache_read / output | 판정 |
|---------|---------------------------------------|------|
| claude-opus-4-7 / -4-6 / -4-5 | 5 / 6.25 / 10 / 0.5 / 25 | 공식 일치 |
| claude-opus-4-1 / claude-opus-4 (deprecated) | 15 / 18.75 / 30 / 1.5 / 75 | 공식 일치 |
| claude-sonnet-4-6 / -4-5 / -4 (deprecated) | 3 / 3.75 / 6 / 0.3 / 15 | 공식 일치 |
| claude-haiku-4-5 | 1 / 1.25 / 2 / 0.1 / 5 | 공식 일치 |
| claude-haiku-3-5 (retired) | 0.8 / 1 / 1.6 / 0.08 / 4 | 공식 일치 |

- cache 배수(5m=1.25×, 1h=2×, read=0.1× base input)도 공식 명시 규칙과 일치.
- minor 버전별 단가 분리 확인: Opus 4.7~4.5=$5 vs 4.1~4.0=$15 (3배 차) →
  와일드카드 키 폐기, `match_model` longest-prefix로 정확 분기.

### OpenAI/Codex — 19행, 교차검증 완료

| 모델 키 | input / cached_input / output | 검증 출처 |
|---------|-------------------------------|-----------|
| gpt-5.5 | 5 / 0.5 / 30 | 공식 |
| gpt-5.5-pro | 30 / 30 / 180 | 공식 (cached 할인 없음) |
| gpt-5.4 | 2.5 / 0.25 / 15 | 공식 |
| gpt-5.4-pro | 30 / 30 / 180 | 공식 (cached 할인 없음) |
| gpt-5.4-mini | 0.75 / 0.075 / 4.5 | 공식 |
| gpt-5.4-nano | 0.2 / 0.02 / 1.25 | 공식 |
| gpt-5.3-codex | 1.75 / 0.175 / 14 | 공식 |
| gpt-5.2-codex | 1.75 / 0.175 / 14 | modelpricing.ai |
| gpt-5-codex | 1.25 / 0.125 / 10 | modelpricing + pricepertoken |
| gpt-5 | 1.25 / 0.125 / 10 | 2개 출처 일치 |
| gpt-5-mini | 0.25 / 0.025 / 2 | 2개 출처 일치 |
| gpt-5-nano | 0.05 / 0.005 / 0.4 | 2개 출처 일치 |
| gpt-4.1 | 2 / 0.5 / 8 | 3개 출처 일치 |
| gpt-4.1-mini | 0.4 / 0.1 / 1.6 | modelpricing + WebSearch |
| gpt-4.1-nano | 0.1 / 0.025 / 0.4 | modelpricing + WebSearch |
| gpt-4o | 2.5 / 1.25 / 10 | 2개 출처 일치 |
| o3 | 2 / 0.5 / 8 | 3개 출처 일치 |
| o4-mini | 1.1 / 0.275 / 4.4 | 2개 출처 일치 |

- `pro` 모델(gpt-5.5-pro / 5.4-pro)은 공식 표기 "Cached Input —"(할인 없음) →
  `cached_input == input`(=30)으로 설정. naive 10% 적용 시 가짜 90% 할인 발생.
- gpt-5 세대는 `cached_input = input × 0.1`(공식 10% 룰). gpt-4 세대(4.1/4o/o3/
  o4-mini)는 10% 룰 이전 모델로 자체 공식 cached 가격(25~50%) 사용.

### 검증 중 발견한 출처 충돌 1건

`pricepertoken.com`이 gpt-4.1-mini를 `0.2/0.8`, gpt-4.1-nano를 `0.05/0.2`로 표기
(내 표의 약 절반). modelpricing.ai·WebSearch·공식 정합 모두 `0.4/1.6`·`0.1/0.4`로
일치 → `pricepertoken.com`을 outlier(오류)로 판정, 다수결 값 채택.

### 판정

**전 30행(claude 11 + codex 19) 검증 통과 — 수정할 단가 없음.** 커밋 `c72ecb0`
(`fix(usage-poc): correct and expand model pricing table`)이 공식 기준 최신 상태.

- 출처: `model-pricing.json._source` 2개 URL (공식 페이지) + 교차검증 2개 사이트
- 재검증 주기: 단가 변동 가능 → `_pricing_as_of` 날짜 기준 분기별 재대조 권장

