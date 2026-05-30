// burn-repogroups.test.ts — C2 repo-parent grouping (pure logic).
//
// groupRepos() turns the raw cwds/slugs C1 captured into the fewest FSA grants
// that cover the most repos. These tests pin the grouping contract that the
// grant UI and gitcount both depend on:
//   - immediate-parent grouping (NOT common-ancestor → no $HOME collapse)
//   - threshold suppresses one-off parents (singletons → ungrouped)
//   - dedup across sessions AND across sources
//   - claude slug decode (lossy, best-effort) + codex absolute passthrough
//   - "/" is never a recommended group root
//   - deterministic ordering (most repos first, ties by root asc)
//   - output shape feeds createFsaFs(root) / countCommits(repos) directly.

import { describe, it, expect } from "vitest";
import { groupRepos, normalizeRaw } from "@/lib/client/burn/repoGroups";

const codex = (raw: string) => ({ raw, source: "codex" as const });
const claude = (raw: string) => ({ raw, source: "claude" as const });

describe("normalizeRaw", () => {
  it("passes through an absolute codex cwd, stripping trailing/duplicate slashes", () => {
    expect(normalizeRaw("/Users/me/work/repoA", "codex")).toBe("/Users/me/work/repoA");
    expect(normalizeRaw("/Users/me/work/repoA/", "codex")).toBe("/Users/me/work/repoA");
    expect(normalizeRaw("/Users/me//work///repoA", "codex")).toBe("/Users/me/work/repoA");
  });

  it("rejects a non-absolute codex value (Windows drive / relative)", () => {
    expect(normalizeRaw("C:\\Users\\me\\repo", "codex")).toBeNull();
    expect(normalizeRaw("relative/path", "codex")).toBeNull();
    expect(normalizeRaw("", "codex")).toBeNull();
  });

  it("decodes a claude slug (dash-for-slash) into an absolute path", () => {
    expect(normalizeRaw("-Users-me-work-repoA", "claude")).toBe("/Users/me/work/repoA");
  });

  it("rejects a claude slug that does not start with '-'", () => {
    expect(normalizeRaw("Users-me-work", "claude")).toBeNull();
    expect(normalizeRaw("", "claude")).toBeNull();
  });

  it("lossily mis-decodes a claude slug with a literal dash (documented limitation)", () => {
    // "/Users/me/my-app" would have been encoded "-Users-me-my-app", which is
    // indistinguishable from "/Users/me/my/app". We accept the wrong decode;
    // downstream findRoot / leaf-name check skips it (conservative undercount).
    expect(normalizeRaw("-Users-me-my-app", "claude")).toBe("/Users/me/my/app");
  });
});

describe("groupRepos — immediate-parent grouping", () => {
  it("groups repos directly under one parent into a single grant target", () => {
    const res = groupRepos([
      codex("/Users/me/work/repoA"),
      codex("/Users/me/work/repoB"),
      codex("/Users/me/work/repoC"),
    ]);
    expect(res.groups).toHaveLength(1);
    expect(res.groups[0]).toEqual({
      root: "/Users/me/work",
      rootName: "work",
      repos: ["/Users/me/work/repoA", "/Users/me/work/repoB", "/Users/me/work/repoC"],
    });
    expect(res.ungrouped).toEqual([]);
    expect(res.skipped).toEqual([]);
  });

  it("does NOT collapse sibling parents to a common ancestor (no $HOME collapse)", () => {
    // ~/work (2 repos) and ~/personal (2 repos) both live under ~/me, but a
    // common-ancestor grouper would grant ~/me. Immediate-parent keeps them
    // separate — the whole point of the design.
    const res = groupRepos([
      codex("/Users/me/work/a"),
      codex("/Users/me/work/b"),
      codex("/Users/me/personal/c"),
      codex("/Users/me/personal/d"),
    ]);
    expect(res.groups.map((g) => g.root).sort()).toEqual([
      "/Users/me/personal",
      "/Users/me/work",
    ]);
    // No group is rooted at the common ancestor.
    expect(res.groups.some((g) => g.root === "/Users/me")).toBe(false);
  });

  it("puts a sub-threshold (singleton) parent's repo in ungrouped, not a group", () => {
    const res = groupRepos([
      codex("/Users/me/work/a"),
      codex("/Users/me/work/b"),
      codex("/Users/me/solo/only"),
    ]);
    expect(res.groups).toHaveLength(1);
    expect(res.groups[0].root).toBe("/Users/me/work");
    expect(res.ungrouped).toEqual(["/Users/me/solo/only"]);
  });

  it("honors a custom threshold", () => {
    const inputs = [codex("/Users/me/work/a"), codex("/Users/me/work/b")];
    // threshold 3 → the 2-repo parent is no longer a group.
    const strict = groupRepos(inputs, { threshold: 3 });
    expect(strict.groups).toEqual([]);
    expect(strict.ungrouped).toEqual(["/Users/me/work/a", "/Users/me/work/b"]);
    // threshold 1 → even a singleton parent becomes a group.
    const loose = groupRepos([codex("/Users/me/solo/only")], { threshold: 1 });
    expect(loose.groups).toHaveLength(1);
    expect(loose.groups[0].root).toBe("/Users/me/solo");
  });
});

describe("groupRepos — dedup, sources, and skips", () => {
  it("dedups the same cwd seen across many sessions", () => {
    const res = groupRepos([
      codex("/Users/me/work/repoA"),
      codex("/Users/me/work/repoA"),
      codex("/Users/me/work/repoA"),
      codex("/Users/me/work/repoB"),
    ]);
    expect(res.groups[0].repos).toEqual(["/Users/me/work/repoA", "/Users/me/work/repoB"]);
  });

  it("dedups a codex cwd and a claude slug that decode to the same path", () => {
    const res = groupRepos([
      codex("/Users/me/work/repoA"),
      claude("-Users-me-work-repoA"),
      codex("/Users/me/work/repoB"),
    ]);
    expect(res.groups).toHaveLength(1);
    expect(res.groups[0].repos).toEqual(["/Users/me/work/repoA", "/Users/me/work/repoB"]);
  });

  it("collects un-normalizable raws into `skipped` without affecting groups", () => {
    const res = groupRepos([
      codex("/Users/me/work/a"),
      codex("/Users/me/work/b"),
      codex("relative/not/absolute"),
      claude("no-leading-slash-equivalent"),
    ]);
    expect(res.groups).toHaveLength(1);
    expect(res.groups[0].root).toBe("/Users/me/work");
    expect(res.skipped.sort()).toEqual([
      "no-leading-slash-equivalent",
      "relative/not/absolute",
    ]);
  });

  it("never recommends '/' as a group root even at/above threshold", () => {
    const res = groupRepos([codex("/repoA"), codex("/repoB")]);
    expect(res.groups).toEqual([]);
    expect(res.ungrouped).toEqual(["/repoA", "/repoB"]);
  });
});

describe("groupRepos — deterministic ordering", () => {
  it("orders groups by repo count desc, then root path asc", () => {
    const res = groupRepos([
      // 3 repos under /a/big
      codex("/a/big/1"),
      codex("/a/big/2"),
      codex("/a/big/3"),
      // 2 repos under /a/med and /z/med (tie → root asc)
      codex("/z/med/1"),
      codex("/z/med/2"),
      codex("/a/med/1"),
      codex("/a/med/2"),
    ]);
    expect(res.groups.map((g) => g.root)).toEqual(["/a/big", "/a/med", "/z/med"]);
    // rootName is always the basename, for the post-grant handle.name check.
    expect(res.groups.map((g) => g.rootName)).toEqual(["big", "med", "med"]);
  });

  it("returns empty results for no inputs", () => {
    expect(groupRepos([])).toEqual({ groups: [], ungrouped: [], skipped: [] });
  });
});
