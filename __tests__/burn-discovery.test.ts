// burn-discovery.test.ts — findClaudeLogs / findCodexLogs handle-root guards.
//
// Both walkers receive a FileSystemDirectoryHandle from the FSA picker. The
// picker has no concept of "kind of folder" — a user could in principle hand
// us $HOME and we'd recurse the entire home directory. The two name guards
// (CLAUDE_ROOT_NAMES = {"projects"}, CODEX_ROOT_NAMES = {"sessions"}) are the
// single defence against that. These tests prove the guards are wired and
// that the happy-path walks emit the expected entries.
//
// We mock FSA entries() with a hand-rolled async iterator that returns plain
// objects shaped like FileSystemDirectoryHandle / FileSystemFileHandle. The
// walkers cast through unknown to call .entries(), so structural typing is
// all we need.

import { describe, it, expect } from "vitest";
import { findClaudeLogs, findCodexLogs } from "@/lib/client/burn/parsers";

// ── fake FSA factory ────────────────────────────────────────────────────────
// Children is an array of [name, handle] tuples — same shape the real FSA
// async entries() iterator yields. We make .entries() return an async
// generator to match the spec.
type FakeFile = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
};
type FakeDir = {
  kind: "directory";
  name: string;
  children: [string, FakeDir | FakeFile][];
  entries: () => AsyncIterableIterator<[string, FakeDir | FakeFile]>;
};

function makeDir(name: string, children: [string, FakeDir | FakeFile][]): FakeDir {
  const dir: FakeDir = {
    kind: "directory",
    name,
    children,
    entries: async function* () {
      for (const c of children) yield c;
    },
  };
  return dir;
}

function makeFile(name: string, content = "{}"): FakeFile {
  return {
    kind: "file",
    name,
    // Real File constructor works in node test env (vitest provides DOM types).
    getFile: async () => new File([content], name, { type: "application/json" }),
  };
}

// ── Claude: name === "projects" guard ───────────────────────────────────────
describe("findClaudeLogs — handle-root validation", () => {
  const hashSlug = async (slug: string) => `hash-${slug}`;

  it("throws 'invalid claude directory' when root name !== 'projects'", async () => {
    const wrong = makeDir("random-folder", []);
    await expect(
      findClaudeLogs(wrong as unknown as FileSystemDirectoryHandle, hashSlug),
    ).rejects.toThrow(/invalid claude directory/);
  });

  it("throws 'invalid claude directory' even when name is similar ('Projects', 'project')", async () => {
    for (const bad of ["Projects", "project", "PROJECTS", "projectss", ""]) {
      const wrong = makeDir(bad, []);
      await expect(
        findClaudeLogs(wrong as unknown as FileSystemDirectoryHandle, hashSlug),
      ).rejects.toThrow(/invalid claude directory/);
    }
  });

  it("happy path: emits {file, projectHash} per .jsonl in each per-project dir", async () => {
    const projects = makeDir("projects", [
      ["alpha", makeDir("alpha", [
        ["session-1.jsonl", makeFile("session-1.jsonl")],
        ["session-2.jsonl", makeFile("session-2.jsonl")],
        ["README.md", makeFile("README.md")], // ignored — wrong extension
      ])],
      ["beta", makeDir("beta", [
        ["s.jsonl", makeFile("s.jsonl")],
      ])],
      ["loose.txt", makeFile("loose.txt")], // ignored — not a directory
    ]);

    const out = await findClaudeLogs(
      projects as unknown as FileSystemDirectoryHandle,
      hashSlug,
    );

    expect(out).toHaveLength(3);
    // Project slug 'alpha' should be hashed; the slug never appears in output.
    expect(out.every((e) => e.projectHash.startsWith("hash-"))).toBe(true);
    const hashes = new Set(out.map((e) => e.projectHash));
    expect(hashes).toEqual(new Set(["hash-alpha", "hash-beta"]));
  });

  it("returns [] for an empty 'projects' directory", async () => {
    const empty = makeDir("projects", []);
    const out = await findClaudeLogs(
      empty as unknown as FileSystemDirectoryHandle,
      hashSlug,
    );
    expect(out).toEqual([]);
  });

  it("ignores non-.jsonl files inside per-project dirs", async () => {
    const projects = makeDir("projects", [
      ["p", makeDir("p", [
        ["a.txt", makeFile("a.txt")],
        ["b.log", makeFile("b.log")],
        ["c.jsonl.bak", makeFile("c.jsonl.bak")], // endsWith check, not exact
      ])],
    ]);
    const out = await findClaudeLogs(
      projects as unknown as FileSystemDirectoryHandle,
      hashSlug,
    );
    expect(out).toEqual([]);
  });
});

// ── Codex: name === "sessions" guard + YYYY/MM/DD/rollout-*.jsonl ───────────
describe("findCodexLogs — handle-root validation + nested depth walk", () => {
  it("throws 'invalid codex directory' when root name !== 'sessions'", async () => {
    const wrong = makeDir("logs", []);
    await expect(
      findCodexLogs(wrong as unknown as FileSystemDirectoryHandle),
    ).rejects.toThrow(/invalid codex directory/);
  });

  it("rejects similar-but-wrong names ('session', 'Sessions')", async () => {
    for (const bad of ["session", "Sessions", "SESSIONS", ""]) {
      const wrong = makeDir(bad, []);
      await expect(
        findCodexLogs(wrong as unknown as FileSystemDirectoryHandle),
      ).rejects.toThrow(/invalid codex directory/);
    }
  });

  it("happy path: walks YYYY/MM/DD/rollout-*.jsonl exactly", async () => {
    const sessions = makeDir("sessions", [
      ["2026", makeDir("2026", [
        ["05", makeDir("05", [
          ["20", makeDir("20", [
            ["rollout-aaa.jsonl", makeFile("rollout-aaa.jsonl")],
            ["rollout-bbb.jsonl", makeFile("rollout-bbb.jsonl")],
            ["other.jsonl", makeFile("other.jsonl")], // ignored — no rollout- prefix
          ])],
        ])],
      ])],
    ]);

    const out = await findCodexLogs(
      sessions as unknown as FileSystemDirectoryHandle,
    );
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.file != null)).toBe(true);
  });

  it("ignores files placed at wrong depth (e.g. directly under sessions/)", async () => {
    const sessions = makeDir("sessions", [
      ["rollout-shallow.jsonl", makeFile("rollout-shallow.jsonl")], // ignored
      ["2026", makeDir("2026", [
        ["rollout-mid.jsonl", makeFile("rollout-mid.jsonl")], // ignored — wrong depth
      ])],
    ]);
    const out = await findCodexLogs(
      sessions as unknown as FileSystemDirectoryHandle,
    );
    expect(out).toEqual([]);
  });

  it("skips non-jsonl files even with rollout- prefix", async () => {
    const sessions = makeDir("sessions", [
      ["2026", makeDir("2026", [
        ["05", makeDir("05", [
          ["20", makeDir("20", [
            ["rollout-abc.txt", makeFile("rollout-abc.txt")], // ignored — wrong ext
            ["rollout-xyz.jsonl", makeFile("rollout-xyz.jsonl")], // kept
          ])],
        ])],
      ])],
    ]);
    const out = await findCodexLogs(
      sessions as unknown as FileSystemDirectoryHandle,
    );
    expect(out).toHaveLength(1);
  });

  it("returns [] for an empty 'sessions' directory", async () => {
    const empty = makeDir("sessions", []);
    const out = await findCodexLogs(
      empty as unknown as FileSystemDirectoryHandle,
    );
    expect(out).toEqual([]);
  });
});
