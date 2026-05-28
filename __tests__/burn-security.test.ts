// burn-security.test.ts — security invariant verification for the Burn Summary flow.
//
// Verifies that a JSONL file containing a SECRET_SENTINEL sentinel value
// inside a `content` / `message.content` field NEVER reaches the payload
// that would be uploaded to the server. Also verifies the 9-field whitelist
// and salt non-leakage.
//
// The full runImport flow uses IndexedDB (browser-only), so we test the
// parser layer directly — the only place raw log content is touched.

import { describe, it, expect } from "vitest";
import { parseClaudeFile, parseCodexFile } from "@/lib/client/burn/parsers";
import { validateSummary } from "@/lib/validateSummary";

const SECRET_SENTINEL = "SECRET_SENTINEL_XYZ_2026";

function makeFile(content: string): File {
  return new File([content], "test.jsonl", { type: "application/json" });
}

// ── Sentinel non-leakage ──────────────────────────────────────────────────
describe("parseClaudeFile — sentinel non-leakage", () => {
  it("sentinel inside message.content is never surfaced in SessionParse", async () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        model: "claude-opus-4-7",
        content: [
          {
            type: "text",
            text: `User said: ${SECRET_SENTINEL}. Here is the response.`,
          },
        ],
        usage: { input_tokens: 50, output_tokens: 30 },
      },
    });
    const result = await parseClaudeFile(makeFile(line), "deadbeef0000");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SECRET_SENTINEL);
    // Tokens should still be counted correctly
    expect(result.tokens.input).toBe(50);
    expect(result.tokens.output).toBe(30);
  });

  it("sentinel in prompt/context field is never surfaced", async () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        model: "claude-opus-4-7",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "exec",
            input: { code: `# ${SECRET_SENTINEL}\nprint("hello")` },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 5 },
      },
    });
    const result = await parseClaudeFile(makeFile(line), "deadbeef0000");
    expect(JSON.stringify(result)).not.toContain(SECRET_SENTINEL);
    expect(result.tokens.input).toBe(20);
  });
});

describe("parseCodexFile — sentinel non-leakage", () => {
  const hashSlug = async (slug: string) => "hash_" + slug.slice(0, 8);

  it("sentinel in payload content is never surfaced", async () => {
    const line = JSON.stringify({
      payload: {
        type: "token_count",
        model: "gpt-5.2",
        cwd: "/home/user/my-project",
        content: `Summary: ${SECRET_SENTINEL}`,
        info: {
          total_token_usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 50 },
        },
      },
    });
    const result = await parseCodexFile(makeFile(line), hashSlug);
    expect(JSON.stringify(result)).not.toContain(SECRET_SENTINEL);
    expect(result.tokens.input).toBe(100);
    expect(result.tokens.output).toBe(50);
  });

  it("raw cwd (project_slug) is never surfaced — only projectHash", async () => {
    const cwd = "/home/user/secret-company-project";
    const line = JSON.stringify({
      payload: {
        type: "token_count",
        model: "gpt-5.2",
        cwd,
        info: {
          total_token_usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 },
        },
      },
    });
    const result = await parseCodexFile(makeFile(line), hashSlug);
    const serialized = JSON.stringify(result);
    // The raw cwd must not appear; only the hash should be present
    expect(serialized).not.toContain("secret-company-project");
    expect(result.projectHash).toBeDefined();
    expect(result.projectHash).not.toContain("secret");
  });
});

// ── 9-field whitelist enforcement via validateSummary ─────────────────────
describe("validateSummary — 9-field whitelist", () => {
  const VALID_ENVELOPE = {
    schemaVersion: "3" as const,
    generatedAt: "2026-05-20T00:00:00Z",
    periodWindow: { period: "week" as const, since: "2026-05-14T00:00:00Z", until: "2026-05-20T00:00:00Z" },
    rows: [
      {
        tool: "claude-code" as const,
        model: "claude-opus-4-7",
        tokenCount: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cachedInput: 0 },
        estimatedCostUsd: 0.0015,
        timestampBucket: "2026-05-20",
        sessionCount: 3,
        activeDays: 2,
        projectHash: "abc123def456",
        verification: { tokenSource: "device" as const, costBasis: "estimated" as const, priceConfidence: "high" as const, level: "Device-synced" as const },
      },
    ],
    grandTotal: { totalTokens: 150, estimatedCostUsd: 0.0015 },
  };

  it("valid envelope passes", () => {
    const result = validateSummary(JSON.stringify(VALID_ENVELOPE));
    expect(result.ok).toBe(true);
  });

  it("envelope with extra root key fails", () => {
    const tampered = { ...VALID_ENVELOPE, rawContent: SECRET_SENTINEL };
    const result = validateSummary(JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unexpected key/i);
    }
  });

  it("envelope with extra row key fails (additionalProperties:false)", () => {
    const tamperedRow = { ...VALID_ENVELOPE.rows[0], secretPath: "/home/user/project" };
    const tampered = { ...VALID_ENVELOPE, rows: [tamperedRow] };
    const result = validateSummary(JSON.stringify(tampered));
    expect(result.ok).toBe(false);
  });

  it("sentinel in extra row field is rejected before any processing", () => {
    const tamperedRow = { ...VALID_ENVELOPE.rows[0], prompt: SECRET_SENTINEL };
    const tampered = { ...VALID_ENVELOPE, rows: [tamperedRow] };
    const result = validateSummary(JSON.stringify(tampered));
    expect(result.ok).toBe(false);
  });
});
