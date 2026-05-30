// burn-rawcwd-sidechannel.test.ts — C1 (VES browser numerator) privacy contract.
//
// Part B counts git commits in-browser, which means the form must learn WHERE
// the operator's repos live. The only source of that information during a scan
// is the raw slug/cwd each session carries — a codex `cwd` is a real absolute
// path, a claude project dir name is a path-encoded slug. Those values are
// privacy-sensitive and the whole collect/parse layer is built so they never
// leave it: only the 12-char salted hash crosses back into the envelope.
//
// C1 opens a NARROW, LOCAL-ONLY sidechannel: an optional `onRawCwd(raw, source)`
// callback that fires AT THE MOMENT OF HASHING, handing the raw value to the
// form's component-local state (used to grant the repo parent folder, then
// discarded). This test pins the two halves of that contract:
//   1. onRawCwd receives every raw slug/cwd, correctly tagged by source.
//   2. The raw values NEVER appear in the returned (and validated) envelope.
//
// If a future refactor ever lets a raw cwd leak into the envelope, assertion
// (2) fails loudly — that is the security regression guard this file exists for.

import { describe, it, expect } from "vitest";
import { buildEnvelope } from "@/lib/client/burn/collect";
import { runImport } from "@/lib/client/burn/import";

// 64 lowercase hex chars — the salt shape projectHash expects (token_hex(32)).
const VALID_SALT = "deadbeef" + "0".repeat(56);

// Distinctive raw values. If either string surfaces in the envelope JSON the
// privacy boundary has broken. They are chosen to be unmistakable substrings.
const CODEX_CWD = "/Users/secretuser/work/private-repo-XYZ";
const CLAUDE_SLUG = "-Users-secretuser-work-claude-only-ABC";

// ── fake FSA factory (mirrors burn-discovery.test.ts) ───────────────────────
type FakeFile = { kind: "file"; name: string; getFile: () => Promise<File> };
type FakeDir = {
  kind: "directory";
  name: string;
  children: [string, FakeDir | FakeFile][];
  entries: () => AsyncIterableIterator<[string, FakeDir | FakeFile]>;
};

function makeDir(name: string, children: [string, FakeDir | FakeFile][]): FakeDir {
  return {
    kind: "directory",
    name,
    children,
    entries: async function* () {
      for (const c of children) yield c;
    },
  };
}

function makeFile(name: string, content = "{}"): FakeFile {
  return {
    kind: "file",
    name,
    getFile: async () => new File([content], name, { type: "application/json" }),
  };
}

// One valid codex rollout line: carries the secret cwd + a final token_count
// event so the session survives the empty-token skip and produces a row.
const CODEX_ROLLOUT_LINE = JSON.stringify({
  timestamp: "2026-05-20T10:00:00Z",
  payload: {
    cwd: CODEX_CWD,
    model: "gpt-5",
    type: "token_count",
    info: { total_token_usage: { input_tokens: 200, output_tokens: 80, cached_input_tokens: 10 } },
  },
});

function claudeProjectsHandle(): FileSystemDirectoryHandle {
  // The claude slug is the PROJECT DIRECTORY NAME — findClaudeLogs hashes it
  // during the walk, before any file is parsed. So onRawCwd fires for the slug
  // even though this session file is deliberately unparseable (no claude row is
  // produced; the codex row keeps the envelope non-empty).
  const dir = makeDir("projects", [
    [CLAUDE_SLUG, makeDir(CLAUDE_SLUG, [["s.jsonl", makeFile("s.jsonl", "not valid json")]])],
  ]);
  return dir as unknown as FileSystemDirectoryHandle;
}

function codexSessionsHandle(): FileSystemDirectoryHandle {
  const dir = makeDir("sessions", [
    ["2026", makeDir("2026", [
      ["05", makeDir("05", [
        ["20", makeDir("20", [
          ["rollout-aaa.jsonl", makeFile("rollout-aaa.jsonl", CODEX_ROLLOUT_LINE)],
        ])],
      ])],
    ])],
  ]);
  return dir as unknown as FileSystemDirectoryHandle;
}

describe("C1 raw-cwd sidechannel — buildEnvelope", () => {
  it("forwards each raw slug/cwd to onRawCwd, tagged by source", async () => {
    const seen: { raw: string; source: "claude" | "codex" }[] = [];
    const env = await buildEnvelope(
      {
        claudeProjectsHandle: claudeProjectsHandle(),
        codexSessionsHandle: codexSessionsHandle(),
        salt: VALID_SALT,
        period: "all",
        onRawCwd: (raw, source) => seen.push({ raw, source }),
      },
      { generatedAt: "2026-05-20T12:00:00Z" },
    );

    // Codex cwd captured with the "codex" tag.
    expect(seen).toContainEqual({ raw: CODEX_CWD, source: "codex" });
    // Claude project dir name captured with the "claude" tag.
    expect(seen).toContainEqual({ raw: CLAUDE_SLUG, source: "claude" });

    // Sanity: the envelope did get built (codex row present).
    expect(env.rows.length).toBeGreaterThanOrEqual(1);
    expect(env.rows.some((r) => r.tool === "codex")).toBe(true);
  });

  it("never leaks a raw slug/cwd into the returned envelope", async () => {
    const env = await buildEnvelope(
      {
        claudeProjectsHandle: claudeProjectsHandle(),
        codexSessionsHandle: codexSessionsHandle(),
        salt: VALID_SALT,
        period: "all",
        onRawCwd: () => {}, // sink present, but irrelevant to this assertion
      },
      { generatedAt: "2026-05-20T12:00:00Z" },
    );

    const json = JSON.stringify(env);
    expect(json).not.toContain(CODEX_CWD);
    expect(json).not.toContain(CLAUDE_SLUG);
    // Also reject any partial leak of the absolute path or the slug stem.
    expect(json).not.toContain("secretuser");
    expect(json).not.toContain("private-repo-XYZ");

    // The cwd survives only as its salted 12-hex hash on the codex row.
    const codexRow = env.rows.find((r) => r.tool === "codex")!;
    expect(codexRow.projectHash).toMatch(/^[0-9a-f]{12}$/);
    expect(codexRow.projectHash).not.toContain(CODEX_CWD);
  });

  it("is a transparent passthrough when no onRawCwd sink is supplied", async () => {
    // The default (CLI/preview) path passes no sink — behaviour must be
    // byte-identical to before C1, and obviously capture nothing.
    const withSink: string[] = [];
    const a = await buildEnvelope(
      {
        claudeProjectsHandle: claudeProjectsHandle(),
        codexSessionsHandle: codexSessionsHandle(),
        salt: VALID_SALT,
        period: "all",
        onRawCwd: (raw) => withSink.push(raw),
      },
      { generatedAt: "2026-05-20T12:00:00Z" },
    );
    const b = await buildEnvelope(
      {
        claudeProjectsHandle: claudeProjectsHandle(),
        codexSessionsHandle: codexSessionsHandle(),
        salt: VALID_SALT,
        period: "all",
        // onRawCwd omitted
      },
      { generatedAt: "2026-05-20T12:00:00Z" },
    );
    expect(withSink.length).toBeGreaterThan(0);
    // Same salt + same inputs → identical envelope regardless of the sink.
    expect(JSON.stringify(b)).toEqual(JSON.stringify(a));
  });
});

describe("C1 raw-cwd sidechannel — runImport threads the sink", () => {
  it("forwards onRawCwd through to the walk and still returns a validated envelope", async () => {
    const seen: { raw: string; source: "claude" | "codex" }[] = [];
    const env = await runImport({
      claudeHandle: claudeProjectsHandle(),
      codexHandle: codexSessionsHandle(),
      salt: VALID_SALT,
      period: "all",
      onRawCwd: (raw, source) => seen.push({ raw, source }),
    });

    expect(seen).toContainEqual({ raw: CODEX_CWD, source: "codex" });
    expect(seen).toContainEqual({ raw: CLAUDE_SLUG, source: "claude" });

    // runImport runs the envelope back through validateSummary
    // (additionalProperties:false). A raw cwd would have been rejected there,
    // but assert the absence explicitly too.
    const json = JSON.stringify(env);
    expect(json).not.toContain(CODEX_CWD);
    expect(json).not.toContain(CLAUDE_SLUG);
    expect(json).not.toContain("secretuser");
  });
});
