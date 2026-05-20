// parsers.ts — browser-side JSONL parser (Phase 2 FSA flow).
//
// Ports coconut_collector/parsers.py to TS with semantic (not byte) parity.
// The browser cannot use Python's pathlib globs, so the equivalent of
//   ~/.claude/projects/*/*.jsonl
//   ~/.codex/sessions/*/*/*/rollout-*.jsonl
// is implemented as fixed-depth walks of a FileSystemDirectoryHandle the
// user picked with showDirectoryPicker(). No recursive descent is allowed
// — extra depth ≠ extra coverage, it just opens an attack surface where a
// malformed/symlinked tree could exfiltrate paths outside the narrow scope.
//
// SECURITY (codex audit hardened):
//   - parse* functions NEVER read, store, log, persist, or transmit raw line
//     text, the JSON `content` field, message payload prose, file paths, or
//     any unparsed bytes. Errors deliberately omit the offending line and
//     use schema-neutral phrasing so a malformed file cannot exfiltrate the
//     log schema or surrounding bytes via thrown error strings.
//   - Project slugs (claude directory name, codex `cwd`) NEVER leave this
//     module — they are consumed by an injected `hashSlug` callback and
//     only the resulting `projectHash` is exposed on SessionParse.
//   - Handles passed to findClaude/CodexLogs are checked against a small
//     allowlist of canonical directory names so a user who mistakenly
//     selects `$HOME` cannot have it walked.
//   - Only whitelisted scalar keys are pulled from parsed objects with
//     `Object.hasOwn` guards; everything else is discarded. This blocks
//     prototype-pollution-by-overlay attacks where a malicious log line
//     defines `__proto__` or `constructor` payloads.
//   - Token integer extraction goes through asInt(), which requires
//     `Number.isSafeInteger` so a log claiming 2^60 input_tokens cannot
//     silently drift the aggregate by losing the low bits.
//   - Cumulative token sums are guarded by safeAdd(); once a row would
//     exceed Number.MAX_SAFE_INTEGER the sum is clamped instead of wrapped.
//   - Lines larger than MAX_LINE_BYTES are skipped silently via a true
//     UTF-8 byte counter (Uint8Array.byteLength), not string.length, so a
//     malformed log cannot DoS the browser by ballooning a single line.
//     Once a line crosses the threshold we enter a discard state and skip
//     every subsequent chunk until the next 0x0A, which closes the prior
//     bypass where carry was reset mid-line and partial garbage then
//     concatenated with the post-newline tail.
//   - `decodeStream` uses fatal UTF-8 (no replacement chars) with BOM skip
//     so a tampered binary log fails fast instead of producing garbage
//     scalars, and a stray BOM doesn't yield a phantom first line.

import type { ClaudeRate, CodexRate } from "./pricing.generated";

// 1 MiB. A real session line is a few KB. Anything bigger is either a
// pathological log or an injection attempt — skip it. Measured in raw
// UTF-8 bytes via the Uint8Array stream, not in decoded JS string length.
const MAX_LINE_BYTES = 1_048_576;

// Mirrors parsers.py _MODEL_RE. fullmatch only — must not accept a trailing
// newline or any path separator. The {0,79} cap matches the schema regex
// `^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$`. Shape gate only — a payload that
// passes the regex still has to clear KNOWN_MODEL_PREFIXES below before we
// trust it as an upload value.
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

// Canonical model-family allowlist grounded in model-pricing.json. The
// regex above only checks character shape; without a prefix gate a log
// line could smuggle in an arbitrary 80-char string that matches no known
// provider but still survives validation. Each entry is either an exact
// match (e.g. "o3") or a hyphen-boundary prefix (e.g. "claude-opus-")
// mirroring matchModel's longest-prefix-at-hyphen-boundary rule. On miss
// safeModel returns null and the parser default ("unknown") takes over,
// which in turn forces matchModel → _default and verification.level →
// "Estimated" downstream. Update both this list and model-pricing.json
// together when a new family ships.
const KNOWN_MODEL_PREFIXES: ReadonlySet<string> = new Set([
  "claude-opus",
  "claude-sonnet",
  "claude-haiku",
  "gpt",
  "o3",
  "o4",
]);

// Allowed root-directory names for the two narrow pickers. The FSA picker
// can in principle return any directory; we restrict to canonical scopes
// so an accidental `$HOME` pick doesn't get walked. Codex audit finding:
// validate handle root name on findClaude/CodexLogs entry.
const CLAUDE_ROOT_NAMES: ReadonlySet<string> = new Set(["projects"]);
const CODEX_ROOT_NAMES: ReadonlySet<string> = new Set(["sessions"]);

export interface ClaudeTokens {
  input: number;
  output: number;
  cache_read: number;
  cache_write_5m: number;
  cache_write_1h: number;
}

export interface CodexTokens {
  input: number;
  cached_input: number;
  output: number;
}

export type SessionTokens = ClaudeTokens | CodexTokens;

// One parsed session log. `projectHash` is the only project identifier on
// the public surface — the raw slug is hashed inside the parser via the
// injected callback and never exposed. `tool` is the PoC-internal name
// ("claude" / "codex"), not the Burn Summary `tool` enum.
export interface SessionParse<T extends SessionTokens = SessionTokens> {
  tool: "claude" | "codex";
  model: string;
  tokens: T;
  timestamp: string | null;
  projectHash: string;
}

// Two-stage gate: (1) charset/length shape regex, (2) canonical-family
// prefix allowlist. Returns null on either miss so callers (parseClaudeFile,
// parseCodexFile) keep their existing `if (m) model = m;` pattern — a
// rejected payload is treated as "absent" and the default "unknown" from
// the parser's initial assignment persists. Critically we do NOT return
// "unknown" here, because that would clobber a valid model captured earlier
// in the same session with whatever junk lex appears later. Caller-side
// fallthrough is the correct semantics.
export function safeModel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!MODEL_RE.test(raw)) return null;
  for (const prefix of KNOWN_MODEL_PREFIXES) {
    if (raw === prefix || raw.startsWith(prefix + "-")) return raw;
  }
  return null;
}

// Mirrors parsers.py _as_int. Rejects non-numbers, non-integers, negatives,
// and crucially also values outside JS's safe-integer range so a log line
// claiming 2^60 tokens cannot silently quantize to the wrong value and
// drift the aggregate. Booleans are excluded via the typeof check; NaN,
// Infinity, fractions, strings, null all coerce to 0.
//
// Float-lexeme caveat: Python's _as_int rejects `1000.0` and `1e3` because
// they parse to float in Python. JS JSON.parse collapses both to the
// integer 1000 with no surviving type information, so this layer cannot
// distinguish them from `1000`. The pre-JSON.parse lexeme inspector
// poisonedTokenKeys below closes the gap by returning the set of token
// keys that carried a float-shaped value on the raw line, so the caller
// can zero ONLY those fields while still capturing model/timestamp/other
// integer fields normally (per-field reject, not line skip).
export function asInt(v: unknown): number {
  if (typeof v !== "number") return 0;
  if (!Number.isSafeInteger(v)) return 0;
  return v >= 0 ? v : 0;
}

// Cumulative-sum guard. Aggregating thousands of usage entries can in
// principle push a column past Number.MAX_SAFE_INTEGER, after which `+`
// loses low-bit precision and the running total drifts. Clamp at the
// safe-integer boundary; downstream cost math then caps too rather than
// producing a silently-wrong number. Exported so collect.ts can reuse
// the same clamp on row totals and grand totals.
export function safeAdd(current: number, addend: number): number {
  const next = current + addend;
  return Number.isSafeInteger(next) ? next : Number.MAX_SAFE_INTEGER;
}

// Token-field float-lexeme guard. JS JSON.parse collapses `1000.0` and
// `1e3` into the integer 1000 with no surviving type information, so a
// tampered log that emits float-shaped values for token counts would
// diverge from Python where _as_int rejects floats and returns 0.
//
// The prior regex scanned the raw line for whitelisted key names without
// regard for where those keys appeared in the JSON tree. This caused two
// defects (F4, codex 4th-audit HIGH):
//   F4a — False positive: a tool_use line with content[].input.input_tokens: 5.5
//         poisoned the legitimate message.usage.input_tokens, silently zeroing
//         valid billing counts in normal MCP-tool Claude logs.
//   F4b — Escaped-key bypass: "input_tokens": 1000.0 decodes post-JSON.parse
//         to the integer 1000 (passing asInt), while Python _as_int sees the
//         float and returns 0 — a Python↔TS parity divergence.
//
// This path-aware mini tokenizer replaces the regex. It walks the raw line
// once, decoding object keys per RFC 8259 §7, and inspects number lexemes
// ONLY at the three exact whitelisted paths:
//   Claude:  message.usage.<TOKEN_KEY>
//            message.usage.cache_creation.<TOKEN_KEY>
//   Codex:   payload.info.total_token_usage.<TOKEN_KEY>
// All other paths (message.content, payload.extra, nested tool inputs, etc.)
// are byte-walked without key inspection — they cannot affect the poison set.
//
// Malformed JSON: on any tokenizer error the function returns the poison set
// accumulated so far. JSON.parse downstream rejects the malformed line and
// the caller's loop continues — same behaviour as the prior regex.
//
// Duplicate structural keys: when the same key (e.g. `usage`) appears twice
// in an object, both occurrences are scanned and their results accumulated.
// For leaf token fields last-write-wins semantics are enforced via Map.set.
// Duplicate structural keys are effectively impossible in real Claude/Codex
// logs and any over-zeroing is safe (conservative, consistent with a
// suspicious-log policy).

// Path-specific token-field name sets. Separate sets per path eliminate
// key-name collisions between sibling objects — the commit loop in each
// scanner can only write keys from its own path's set, so no scanner can
// clobber a sibling scanner's result in `out`.
//   POISON_USAGE_KEYS     — keys read from message.usage directly
//   POISON_CC_KEYS        — keys read from message.usage.cache_creation
//   POISON_TTU_KEYS       — keys read from payload.info.total_token_usage
// The sets are disjoint by design: POISON_USAGE_KEYS ∩ POISON_CC_KEYS = ∅.
const POISON_USAGE_KEYS: ReadonlySet<string> = new Set([
  "input_tokens",
  "output_tokens",
  "cache_read_input_tokens",
]);
const POISON_CC_KEYS: ReadonlySet<string> = new Set([
  "ephemeral_5m_input_tokens",
  "ephemeral_1h_input_tokens",
]);
const POISON_TTU_KEYS: ReadonlySet<string> = new Set([
  "input_tokens",
  "cached_input_tokens",
  "output_tokens",
]);

type PoisonedKeys = { usage: ReadonlySet<string>; cc: ReadonlySet<string>; ttu: ReadonlySet<string> };

function poisonedTokenKeys(line: string): PoisonedKeys {
  const usageOut = new Set<string>();
  const ccOut = new Set<string>();
  const ttuOut = new Set<string>();
  let bailed = false;
  let i = 0;
  const n = line.length;

  // Returns path-scoped poison sets. On depth-overflow bail, returns the full
  // key set for every path so an attacker cannot benefit from incomplete scans.
  function result(): PoisonedKeys {
    return bailed
      ? { usage: new Set(POISON_USAGE_KEYS), cc: new Set(POISON_CC_KEYS), ttu: new Set(POISON_TTU_KEYS) }
      : { usage: usageOut, cc: ccOut, ttu: ttuOut };
  }

  function ws(): void {
    while (i < n && (line[i] === " " || line[i] === "\t" || line[i] === "\r" || line[i] === "\n")) i++;
  }

  // Decode a JSON string at i (i must be on `"`). Returns null on error.
  // Handles the full RFC 8259 §7 escape set including \uXXXX.
  function decodeStr(): string | null {
    if (i >= n || line[i] !== '"') return null;
    i++;
    let s = "";
    while (i < n) {
      const c = line[i];
      if (c === '"') { i++; return s; }
      if (c !== "\\") { s += c; i++; continue; }
      i++;
      if (i >= n) return null;
      const e = line[i++];
      switch (e) {
        case '"': case "\\": case "/": s += e; break;
        case "b": s += "\b"; break;
        case "f": s += "\f"; break;
        case "n": s += "\n"; break;
        case "r": s += "\r"; break;
        case "t": s += "\t"; break;
        case "u": {
          if (i + 4 > n) return null;
          const cp = parseInt(line.slice(i, i + 4), 16);
          if (isNaN(cp)) return null;
          s += String.fromCharCode(cp);
          i += 4;
          break;
        }
        default: return null;
      }
    }
    return null; // unterminated string
  }

  // Skip a string value (i on `"`) without decoding.
  function skipStr(): void {
    if (i >= n || line[i] !== '"') return;
    i++;
    while (i < n) {
      const c = line[i++];
      if (c === '"') return;
      if (c === "\\") i++; // consume the next char (any escape)
    }
  }

  // Skip any JSON value. d is the current recursion depth — returns false on
  // depth overflow (> 64) or parse error, allowing the caller to bail safely.
  function skipVal(d: number): boolean {
    ws();
    if (i >= n) return false;
    const c = line[i];
    if (c === '"') { skipStr(); return true; }
    if (c === "{") return skipObj(d + 1);
    if (c === "[") return skipArr(d + 1);
    if (c === "t") { if (line.slice(i, i + 4) === "true")  { i += 4; return true; } return false; }
    if (c === "f") { if (line.slice(i, i + 5) === "false") { i += 5; return true; } return false; }
    if (c === "n") { if (line.slice(i, i + 4) === "null")  { i += 4; return true; } return false; }
    if (c === "-" || (c >= "0" && c <= "9")) { skipNum(); return true; }
    return false;
  }

  function skipNum(): void {
    if (i < n && line[i] === "-") i++;
    while (i < n && line[i] >= "0" && line[i] <= "9") i++;
    if (i < n && line[i] === ".") { i++; while (i < n && line[i] >= "0" && line[i] <= "9") i++; }
    if (i < n && (line[i] === "e" || line[i] === "E")) {
      i++;
      if (i < n && (line[i] === "+" || line[i] === "-")) i++;
      while (i < n && line[i] >= "0" && line[i] <= "9") i++;
    }
  }

  function skipObj(d: number): boolean {
    if (d > 64) { bailed = true; return false; }
    if (i >= n || line[i] !== "{") return false;
    i++; ws();
    if (i < n && line[i] === "}") { i++; return true; }
    while (i < n) {
      if (line[i] !== '"') return false;
      skipStr(); // key
      ws();
      if (i >= n || line[i] !== ":") return false;
      i++;
      if (!skipVal(d)) return false;
      ws();
      if (i >= n) return false;
      if (line[i] === "}") { i++; return true; }
      if (line[i] === ",") { i++; ws(); } else return false;
    }
    return false;
  }

  function skipArr(d: number): boolean {
    if (d > 64) { bailed = true; return false; }
    if (i >= n || line[i] !== "[") return false;
    i++; ws();
    if (i < n && line[i] === "]") { i++; return true; }
    while (i < n) {
      if (!skipVal(d)) return false;
      ws();
      if (i >= n) return false;
      if (line[i] === "]") { i++; return true; }
      if (line[i] === ",") { i++; ws(); } else return false;
    }
    return false;
  }

  // Inspect the value at i. If it is a number whose lexeme contains `.`/`e`/`E`
  // (float-shaped), return true. For any other value type return false. In all
  // cases advance i past the value.
  function isFloatLexeme(): boolean {
    ws();
    if (i >= n) return false;
    const c = line[i];
    if (c !== "-" && (c < "0" || c > "9")) { skipVal(0); return false; }
    let float = false;
    if (line[i] === "-") i++;
    while (i < n && line[i] >= "0" && line[i] <= "9") i++;
    if (i < n && line[i] === ".") { float = true; i++; while (i < n && line[i] >= "0" && line[i] <= "9") i++; }
    if (i < n && (line[i] === "e" || line[i] === "E")) {
      float = true; i++;
      if (i < n && (line[i] === "+" || line[i] === "-")) i++;
      while (i < n && line[i] >= "0" && line[i] <= "9") i++;
    }
    return float;
  }

  // Scan a leaf token object (cache_creation or total_token_usage).
  // Only keys in `keys` are checked for float lexemes; all others skipped.
  // Callers pass a path-specific key set so scans for sibling objects cannot
  // clobber each other's entries in `out` (disjoint key sets guarantee this).
  // Uses last-write-wins semantics for any duplicate key occurrences.
  function scanLeaf(keys: ReadonlySet<string>, target: Set<string>): void {
    if (i >= n || line[i] !== "{") { skipVal(0); return; }
    i++; ws();
    if (i < n && line[i] === "}") { i++; return; }
    const res = new Map<string, boolean>();
    while (i < n) {
      if (line[i] !== '"') return;
      const k = decodeStr();
      if (k === null) return;
      ws();
      if (i >= n || line[i] !== ":") return;
      i++; ws();
      if (keys.has(k)) {
        res.set(k, isFloatLexeme()); // last-write-wins for duplicate keys
      } else {
        if (!skipVal(2)) return;
      }
      ws();
      if (i >= n) return;
      if (line[i] === "}") { i++; break; }
      if (line[i] === ",") { i++; ws(); } else return;
    }
    // Commit: add to target if float, remove if integer (last-write-wins clears
    // any prior accumulation from a duplicate-key earlier occurrence).
    for (const [k, f] of res) { if (f) target.add(k); else target.delete(k); }
  }

  // Scan message.usage: direct token keys + cache_creation descent.
  // POISON_USAGE_KEYS and POISON_CC_KEYS are disjoint, so the commit loop
  // for usage-level keys can never delete entries that scanLeaf wrote for
  // cache_creation (and vice-versa).
  function scanUsage(): void {
    if (i >= n || line[i] !== "{") { skipVal(0); return; }
    i++; ws();
    if (i < n && line[i] === "}") { i++; return; }
    const res = new Map<string, boolean>();
    while (i < n) {
      if (line[i] !== '"') return;
      const k = decodeStr();
      if (k === null) return;
      ws();
      if (i >= n || line[i] !== ":") return;
      i++; ws();
      if (k === "cache_creation") {
        scanLeaf(POISON_CC_KEYS, ccOut);
      } else if (POISON_USAGE_KEYS.has(k)) {
        res.set(k, isFloatLexeme());
      } else {
        if (!skipVal(2)) return;
      }
      ws();
      if (i >= n) return;
      if (line[i] === "}") { i++; break; }
      if (line[i] === ",") { i++; ws(); } else return;
    }
    for (const [k, f] of res) { if (f) usageOut.add(k); else usageOut.delete(k); }
  }

  // Scan message object: descend into usage, skip everything else.
  // message.content (the array of tool-use blocks) is byte-walked via
  // skipVal without any key inspection — this closes F4a.
  function scanMessage(): void {
    if (i >= n || line[i] !== "{") { skipVal(0); return; }
    i++; ws();
    if (i < n && line[i] === "}") { i++; return; }
    while (i < n) {
      if (line[i] !== '"') return;
      const k = decodeStr();
      if (k === null) return;
      ws();
      if (i >= n || line[i] !== ":") return;
      i++; ws();
      if (k === "usage") { scanUsage(); } else { if (!skipVal(1)) return; }
      ws();
      if (i >= n) return;
      if (line[i] === "}") { i++; return; }
      if (line[i] === ",") { i++; ws(); } else return;
    }
  }

  // Scan payload.info: descend into total_token_usage, skip everything else.
  function scanInfo(): void {
    if (i >= n || line[i] !== "{") { skipVal(0); return; }
    i++; ws();
    if (i < n && line[i] === "}") { i++; return; }
    while (i < n) {
      if (line[i] !== '"') return;
      const k = decodeStr();
      if (k === null) return;
      ws();
      if (i >= n || line[i] !== ":") return;
      i++; ws();
      if (k === "total_token_usage") { scanLeaf(POISON_TTU_KEYS, ttuOut); } else { if (!skipVal(2)) return; }
      ws();
      if (i >= n) return;
      if (line[i] === "}") { i++; return; }
      if (line[i] === ",") { i++; ws(); } else return;
    }
  }

  // Scan payload object: descend into info, skip everything else.
  // payload.extra (and any other sibling keys) are byte-walked — this closes F4a
  // for Codex lines that carry extra fields with token-like names.
  function scanPayload(): void {
    if (i >= n || line[i] !== "{") { skipVal(0); return; }
    i++; ws();
    if (i < n && line[i] === "}") { i++; return; }
    while (i < n) {
      if (line[i] !== '"') return;
      const k = decodeStr();
      if (k === null) return;
      ws();
      if (i >= n || line[i] !== ":") return;
      i++; ws();
      if (k === "info") { scanInfo(); } else { if (!skipVal(1)) return; }
      ws();
      if (i >= n) return;
      if (line[i] === "}") { i++; return; }
      if (line[i] === ",") { i++; ws(); } else return;
    }
  }

  // Root object: only `message` and `payload` keys trigger descent.
  ws();
  if (i >= n || line[i] !== "{") return result();
  i++; ws();
  if (i < n && line[i] === "}") return result();
  while (i < n) {
    if (line[i] !== '"') return result();
    const k = decodeStr();
    if (k === null) return result();
    ws();
    if (i >= n || line[i] !== ":") return result();
    i++; ws();
    if (k === "message") { scanMessage(); }
    else if (k === "payload") { scanPayload(); }
    else { if (!skipVal(0)) return result(); }
    ws();
    if (i >= n) return result();
    if (line[i] === "}") { i++; return result(); }
    if (line[i] === ",") { i++; ws(); } else return result();
  }
  return result();
}

// Longest-prefix-at-hyphen-boundary wins. A "-x" suffix on a pricing key
// is wildcard sugar ("claude-opus-4-x" matches every "claude-opus-4-N").
// Falls back to _default with low confidence — that low confidence is what
// downstream uses to downgrade the displayed verification level.
export function matchModel<T>(
  providerTable: Record<string, T> & { _default: T },
  model: string,
): { rate: T; confidence: "high" | "low" } {
  const candidates: Array<{ prefixLen: number; rate: T }> = [];
  for (const [key, row] of Object.entries(providerTable)) {
    if (key === "_default") continue;
    const prefix = key.endsWith("-x") ? key.slice(0, -2) : key;
    if (model === prefix || model.startsWith(prefix + "-")) {
      candidates.push({ prefixLen: prefix.length, rate: row });
    }
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.prefixLen - a.prefixLen);
    return { rate: candidates[0].rate, confidence: "high" };
  }
  return { rate: providerTable._default, confidence: "low" };
}

// tokens × USD-per-1M-tokens. Mirrors parsers.py cost_breakdown: a token
// category that has no matching price entry is dropped, not zero-billed,
// so an unknown cache tier silently ignores instead of underbilling.
// `Object.hasOwn` blocks prototype lookup (a malicious caller-injected
// price table that proxies through Object.prototype) and the finiteness
// check refuses NaN/Infinity rates that would poison rawCost downstream.
export function costBreakdown(
  tok: Record<string, number>,
  price: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cat of Object.keys(tok)) {
    if (!Object.hasOwn(price, cat)) continue;
    const rate = price[cat];
    if (typeof rate !== "number" || !Number.isFinite(rate)) continue;
    out[cat] = (tok[cat] * rate) / 1_000_000;
  }
  return out;
}

// JSONL streamer. Reads the file's raw bytes (Uint8Array) so MAX_LINE_BYTES
// is a true UTF-8 byte limit, not a string-length approximation. A line
// that overruns the byte cap is silently dropped; once we are mid-line and
// already over budget we stay in `discarding` state and keep skipping
// every subsequent chunk until the next 0x0A. This closes the prior
// vulnerability where carry was reset mid-line and the rest of the line
// (now <2*MAX) was concatenated with the post-newline tail, yielding a
// frankenstein "line" that could pass JSON.parse with attacker payload.
//
// BOM handling: the decoder is constructed with `ignoreBOM: true`, so a
// leading UTF-8 BOM (EF BB BF) is consumed without producing a phantom
// character on the first decoded line. `fatal: true` keeps the parser
// strict — a tampered binary file aborts via thrown TypeError instead of
// silently producing U+FFFD replacement characters.
async function* streamLines(file: File): AsyncGenerator<string> {
  const reader = (file.stream() as ReadableStream<Uint8Array>).getReader();
  // `let` (not `const`) so we can recreate after discarding mid-line bytes —
  // a fatal-mode decoder retains partial multi-byte state internally, and
  // skipping bytes mid-character would otherwise poison the next decode.
  let decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let carry = "";
  let currentLineBytes = 0;
  let discarding = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value as Uint8Array;
      let segStart = 0;
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] !== 0x0A) continue;
        // Line boundary at byte i. Bytes [segStart, i) belong to this line.
        const segment = chunk.subarray(segStart, i);
        if (discarding) {
          // Skip this line entirely — we crossed MAX_LINE_BYTES earlier.
          // Recreate decoder: any partial multi-byte state from before the
          // overrun is now poisoned, since we threw away bytes in the middle
          // of a possible UTF-8 sequence.
          decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
          discarding = false;
          currentLineBytes = 0;
          carry = "";
        } else if (currentLineBytes + segment.byteLength > MAX_LINE_BYTES) {
          // Just crossed the cap on the closing chunk — drop this line.
          // No bytes were ever fed to decoder for this segment, but carry
          // might hold partial state from earlier chunks of the same line.
          // Reset decoder to clear that state cleanly.
          decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
          currentLineBytes = 0;
          carry = "";
        } else {
          // Decode the tail of this line and yield carry + tail.
          const tail = decoder.decode(segment, { stream: false });
          const line = (carry + tail).replace(/\r$/, "");
          carry = "";
          currentLineBytes = 0;
          if (line.length > 0) yield line;
        }
        segStart = i + 1;
      }
      // Partial line: remainder bytes after the last newline (or whole
      // chunk if no newline). Either grow carry or enter discard mode.
      const remainder = chunk.subarray(segStart);
      if (discarding) {
        // Keep skipping; do not decode.
      } else if (currentLineBytes + remainder.byteLength > MAX_LINE_BYTES) {
        // Now oversize. Discard everything until next 0x0A.
        // Recreate decoder so any in-flight multi-byte state from carry is
        // dropped — we'll be skipping arbitrary bytes until newline.
        decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
        discarding = true;
        currentLineBytes = 0;
        carry = "";
      } else {
        currentLineBytes += remainder.byteLength;
        // stream:true so a multi-byte char split across chunks is held
        // back inside the decoder and emitted on the next decode.
        carry += decoder.decode(remainder, { stream: true });
      }
    }
    // EOF: flush any buffered multi-byte state and emit the final line if
    // we weren't mid-discard.
    const flushed = decoder.decode(new Uint8Array(0), { stream: false });
    if (flushed) carry += flushed;
    if (!discarding && carry.length > 0) {
      const tail = carry.replace(/\r$/, "");
      if (tail.length > 0) yield tail;
    }
  } finally {
    reader.releaseLock();
  }
}

// Pull a string field defensively. `Object.hasOwn` blocks prototype-chain
// reads (a malicious `__proto__` overlay can't expose attacker data
// through inherited Object.prototype properties).
function readString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  if (!Object.hasOwn(obj, key)) return undefined;
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function readObject(
  obj: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  if (!Object.hasOwn(obj, key)) return undefined;
  const v = obj[key];
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

// Read a whitelisted integer field. `Object.hasOwn` blocks prototype reads;
// asInt enforces the safe-integer range. Same defensive pattern as
// readString/readObject so the asInt call sites in parseClaude/CodexFile
// don't repeat the hasOwn dance inline. When `poisoned` carries this `key`,
// the source line emitted a float lexeme for it — coerce to 0 rather than
// trust the post-JSON.parse number (the int/float distinction is erased
// by then). Adjacent untainted keys on the same line are still read.
function readInt(
  obj: Record<string, unknown>,
  key: string,
  poisoned?: ReadonlySet<string>,
): number {
  if (poisoned?.has(key)) return 0;
  if (!Object.hasOwn(obj, key)) return 0;
  return asInt(obj[key]);
}

// parse_claude port. Sums per-message usage across every assistant line
// (Anthropic bills per-message, not per-session). The first line-level
// `timestamp` wins. The model field is overwritten by every assistant
// line that carries a valid model id, so the last one observed is what
// the row reports — same as the Python.
export async function parseClaudeFile(
  file: File,
  projectHash: string,
): Promise<SessionParse<ClaudeTokens>> {
  let model = "unknown";
  let timestamp: string | null = null;
  const tok: ClaudeTokens = {
    input: 0,
    output: 0,
    cache_read: 0,
    cache_write_5m: 0,
    cache_write_1h: 0,
  };
  for await (const line of streamLines(file)) {
    // Pre-JSON.parse float-lexeme scan. JSON.parse erases the int/float
    // distinction, so a tampered log emitting `1000.0` for input_tokens
    // would silently survive asInt where Python's _as_int would reject it.
    // Collect the set of poisoned token keys for THIS line, then thread it
    // through readInt so only the poisoned fields zero out — untainted
    // keys on the same line are still read. Raw line never logged.
    const poisoned = poisonedTokenKeys(line);
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      // Never log the line — see SECURITY note at top of file.
      continue;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      continue;
    }
    const obj = parsed as Record<string, unknown>;
    if (timestamp === null) {
      const ts = readString(obj, "timestamp");
      if (ts !== undefined) timestamp = ts;
    }
    // Object.hasOwn guard before reading discriminant — blocks a malicious
    // `__proto__` overlay that defines `type: "assistant"` at proto level.
    if (!Object.hasOwn(obj, "type") || obj.type !== "assistant") continue;
    const msg = readObject(obj, "message");
    if (!msg) continue;
    const usage = readObject(msg, "usage");
    if (!usage) continue;
    const m = Object.hasOwn(msg, "model") ? safeModel(msg.model) : null;
    if (m) model = m;
    const cc = readObject(usage, "cache_creation") ?? {};
    tok.input = safeAdd(tok.input, readInt(usage, "input_tokens", poisoned.usage));
    tok.output = safeAdd(tok.output, readInt(usage, "output_tokens", poisoned.usage));
    tok.cache_read = safeAdd(
      tok.cache_read,
      readInt(usage, "cache_read_input_tokens", poisoned.usage),
    );
    tok.cache_write_5m = safeAdd(
      tok.cache_write_5m,
      readInt(cc, "ephemeral_5m_input_tokens", poisoned.cc),
    );
    tok.cache_write_1h = safeAdd(
      tok.cache_write_1h,
      readInt(cc, "ephemeral_1h_input_tokens", poisoned.cc),
    );
  }
  return { tool: "claude", model, tokens: tok, timestamp, projectHash };
}

// parse_codex port. The final `token_count` event carries cumulative usage
// (total_token_usage); earlier events are partial. Iterating to EOF and
// keeping the last one is the only way to get the session's final tally
// — matches Python exactly. `cwd` is read once (first non-empty value)
// and hashed via the injected callback before leaving this function; the
// raw cwd value never escapes the closure. `payload.model` is overwritten
// across the session so the last value wins.
export async function parseCodexFile(
  file: File,
  hashSlug: (slug: string) => Promise<string>,
): Promise<SessionParse<CodexTokens>> {
  let model = "unknown";
  let timestamp: string | null = null;
  let cwd = "";
  let final: Record<string, unknown> | null = null;
  // Travels with `final`: the per-line poison set captured at the moment
  // we accepted that line's total_token_usage frame. Because Codex semantics
  // are "last token_count event wins", this snapshot must be updated
  // atomically with `final` so the post-loop readInt calls zero the right
  // keys for the surviving frame (not whichever poison set the loop ended
  // on after subsequent unrelated lines).
  let finalPoisoned: PoisonedKeys | null = null;
  for await (const line of streamLines(file)) {
    // Per-field poison: scan the raw line for whitelisted token keys that
    // carry a float-shaped number BEFORE JSON.parse collapses the
    // int/float distinction. Adjacent untainted keys on the same line
    // remain readable; only the poisoned fields zero out.
    const poisoned = poisonedTokenKeys(line);
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      continue;
    }
    const obj = parsed as Record<string, unknown>;
    if (timestamp === null) {
      const ts = readString(obj, "timestamp");
      if (ts !== undefined) timestamp = ts;
    }
    const payload = readObject(obj, "payload");
    if (!payload) continue;
    if (!cwd) {
      const cwdValue = readString(payload, "cwd");
      if (cwdValue) cwd = cwdValue;
    }
    const m = Object.hasOwn(payload, "model") ? safeModel(payload.model) : null;
    if (m) model = m;
    if (Object.hasOwn(payload, "type") && payload.type === "token_count") {
      const info = readObject(payload, "info");
      const ttu = info ? readObject(info, "total_token_usage") : undefined;
      if (ttu) {
        final = ttu;
        finalPoisoned = poisoned;
      }
    }
  }
  if (final === null) {
    // Schema-neutral phrasing: avoid echoing event names in errors so a
    // log schema isn't leaked into thrown messages a UI might display.
    throw new Error("invalid codex session");
  }
  const poisonForFinal = finalPoisoned?.ttu ?? undefined;
  const cached = readInt(final, "cached_input_tokens", poisonForFinal);
  // input_tokens already includes cached_input_tokens as a subset; subtract
  // so the two categories don't double-bill the cached portion.
  const tok: CodexTokens = {
    input: Math.max(readInt(final, "input_tokens", poisonForFinal) - cached, 0),
    cached_input: cached,
    output: readInt(final, "output_tokens", poisonForFinal),
  };
  const projectHash = await hashSlug(cwd);
  return { tool: "codex", model, tokens: tok, timestamp, projectHash };
}

// Walker for Claude's `~/.claude/projects/*/*.jsonl` layout. The picked
// directory IS the `projects` dir; one level down is per-project dirs;
// inside each is `.jsonl` files. No recursive descent — extra depth =
// extra attack surface, not extra coverage.
//
// Returns only {file, projectHash}: the raw slug (directory name) is
// hashed via the injected callback inside this function and never exposed
// to callers. Throws a generic "invalid claude directory" if the handle's
// name doesn't match the allowlist (codex audit: handle root validation).
export interface ClaudeLogEntry {
  file: File;
  projectHash: string;
}

export async function findClaudeLogs(
  projectsHandle: FileSystemDirectoryHandle,
  hashSlug: (slug: string) => Promise<string>,
): Promise<ClaudeLogEntry[]> {
  if (!CLAUDE_ROOT_NAMES.has(projectsHandle.name)) {
    throw new Error("invalid claude directory");
  }
  const out: ClaudeLogEntry[] = [];
  // entries() iterator: yields [name, FileSystemHandle].
  for await (const [name, entry] of (
    projectsHandle as unknown as {
      entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    }
  ).entries()) {
    if (entry.kind !== "directory") continue;
    const dir = entry as FileSystemDirectoryHandle;
    const hashed = await hashSlug(name);
    for await (const [fname, fentry] of (
      dir as unknown as {
        entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
      }
    ).entries()) {
      if (fentry.kind !== "file") continue;
      if (!fname.endsWith(".jsonl")) continue;
      const f = await (fentry as FileSystemFileHandle).getFile();
      out.push({ file: f, projectHash: hashed });
    }
  }
  return out;
}

// Walker for Codex's `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
// layout. Three nested date dirs, then rollout-*.jsonl files. The picked
// directory IS `sessions`. Exact-depth walk — files at the wrong depth
// are ignored, not flattened, so a stray rollout-x.jsonl at the wrong
// nesting level (e.g. attacker-placed) doesn't get parsed.
//
// Unlike Claude's layout, the codex slug (cwd) lives inside each file's
// JSONL events, not in the directory name. Hashing happens inside
// parseCodexFile via its hashSlug arg; this walker emits only {file}.
export interface CodexLogEntry {
  file: File;
}

export async function findCodexLogs(
  sessionsHandle: FileSystemDirectoryHandle,
): Promise<CodexLogEntry[]> {
  if (!CODEX_ROOT_NAMES.has(sessionsHandle.name)) {
    throw new Error("invalid codex directory");
  }
  const out: CodexLogEntry[] = [];
  const root = sessionsHandle as unknown as {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  };
  for await (const [, yearEntry] of root.entries()) {
    if (yearEntry.kind !== "directory") continue;
    const yearIter = yearEntry as unknown as {
      entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    };
    for await (const [, monthEntry] of yearIter.entries()) {
      if (monthEntry.kind !== "directory") continue;
      const monthIter = monthEntry as unknown as {
        entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
      };
      for await (const [, dayEntry] of monthIter.entries()) {
        if (dayEntry.kind !== "directory") continue;
        const dayIter = dayEntry as unknown as {
          entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
        };
        for await (const [fname, fentry] of dayIter.entries()) {
          if (fentry.kind !== "file") continue;
          if (!fname.startsWith("rollout-")) continue;
          if (!fname.endsWith(".jsonl")) continue;
          const f = await (fentry as FileSystemFileHandle).getFile();
          out.push({ file: f });
        }
      }
    }
  }
  return out;
}

// Re-export the rate shapes so callers don't need to dig into pricing.generated.
export type { ClaudeRate, CodexRate };
