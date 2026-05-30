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
import {
  groupRepos,
  normalizeRaw,
  singleRepoGroup,
  grantCards,
  resolveGrant,
} from "@/lib/client/burn/repoGroups";

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

// ── PR1: single-repo orphan fix ───────────────────────────────────────────────
//
// A developer with no parent holding >= threshold(2) repos gets groups:[], so
// the form's grant step (gated on grantCards(scan).length > 0) never showed and
// their VES stayed permanently 0.0/Pending. These three pure helpers make the
// single-repo path reachable AND keep it honest:
//   - singleRepoGroup: one cwd → a grantable REPO-AS-ROOT group (grant the
//     project folder itself, count it as the root). Defensive: null unless the
//     path is absolute POSIX and not "/".
//   - grantCards: groups-first (multi-repo flow unchanged); only synthesize
//     single cards when there are NO groups (the orphan case).
//   - resolveGrant: basename-mismatch fallback bounded to a REAL ANCESTOR of the
//     logged cwd — so a nested-cwd grant recovers, but a user can never re-root
//     onto an unrelated repo (which would count commits that don't match the
//     AI-spend cwd → inflated VES, a gaming path).

describe("singleRepoGroup — one cwd → a grantable repo-as-root group", () => {
  it("turns a normal repo cwd into a group rooted at the repo itself", () => {
    expect(singleRepoGroup("/Users/me/work/repoA")).toEqual({
      root: "/Users/me/work/repoA",
      rootName: "repoA",
      repos: ["/Users/me/work/repoA"],
    });
  });

  it("uses the cwd's own basename as rootName (caller grants the project folder)", () => {
    // A cwd that is actually a nested subdir is taken at face value here — it is
    // resolveGrant's job (not this pure shaper's) to recover the real repo root
    // when the user grants an ancestor.
    expect(singleRepoGroup("/Users/me/repoA/src/components")).toEqual({
      root: "/Users/me/repoA/src/components",
      rootName: "components",
      repos: ["/Users/me/repoA/src/components"],
    });
  });

  it("normalizes a trailing/duplicate slash", () => {
    expect(singleRepoGroup("/Users/me/work/repoA/")).toEqual({
      root: "/Users/me/work/repoA",
      rootName: "repoA",
      repos: ["/Users/me/work/repoA"],
    });
  });

  it("grants a repo directly under '/' AS ITSELF (not '/', which Chrome blocks)", () => {
    // groupRepos rejects parent "/" → such a repo lands in ungrouped; as a
    // single-repo card it is grantable as the repo folder itself.
    expect(singleRepoGroup("/repoA")).toEqual({
      root: "/repoA",
      rootName: "repoA",
      repos: ["/repoA"],
    });
  });

  it("returns null for the filesystem root and the empty string", () => {
    expect(singleRepoGroup("/")).toBeNull();
    expect(singleRepoGroup("")).toBeNull();
    expect(singleRepoGroup("///")).toBeNull();
  });

  it("returns null for a non-absolute path (defensive — never trust the caller)", () => {
    expect(singleRepoGroup("foo")).toBeNull();
    expect(singleRepoGroup("relative/path")).toBeNull();
    expect(singleRepoGroup("C:\\Users\\me\\repo")).toBeNull();
  });
});

describe("grantCards — groups-first, synthesize singles only when no groups", () => {
  it("returns groups verbatim when any exist (multi-repo flow unchanged, no singles)", () => {
    const group = { root: "/Users/me/work", rootName: "work", repos: ["/Users/me/work/a", "/Users/me/work/b"] };
    const cards = grantCards({ groups: [group], ungrouped: ["/Users/me/solo/only"], skipped: [] });
    expect(cards).toEqual([group]);
  });

  it("synthesizes one single-repo card per ungrouped repo when there are NO groups", () => {
    const cards = grantCards({
      groups: [],
      ungrouped: ["/Users/me/work/repoA", "/Users/me/solo/repoB"],
      skipped: [],
    });
    expect(cards).toEqual([
      { root: "/Users/me/work/repoA", rootName: "repoA", repos: ["/Users/me/work/repoA"] },
      { root: "/Users/me/solo/repoB", rootName: "repoB", repos: ["/Users/me/solo/repoB"] },
    ]);
  });

  it("filters out an ungrouped entry that has no grantable folder (a literal '/')", () => {
    expect(grantCards({ groups: [], ungrouped: ["/"], skipped: [] })).toEqual([]);
  });

  it("returns [] when there is nothing to grant", () => {
    expect(grantCards({ groups: [], ungrouped: [], skipped: [] })).toEqual([]);
  });

  it("end-to-end: a single discovered repo flows groupRepos → grantCards → one card", () => {
    // The regression that broke single-repo devs: groupRepos returns groups:[]
    // for one repo, and the OLD form kept only .groups → no card → no VES.
    const scan = groupRepos([{ raw: "/Users/me/work/repoA", source: "codex" }]);
    expect(scan.groups).toEqual([]); // pins the orphan condition
    expect(grantCards(scan)).toEqual([
      { root: "/Users/me/work/repoA", rootName: "repoA", repos: ["/Users/me/work/repoA"] },
    ]);
  });
});

describe("resolveGrant — basename-mismatch fallback bounded to a real ancestor", () => {
  const singleNested = {
    root: "/Users/me/repoA/src/components",
    rootName: "components",
    repos: ["/Users/me/repoA/src/components"],
  };
  const multi = {
    root: "/Users/me/work",
    rootName: "work",
    repos: ["/Users/me/work/a", "/Users/me/work/b"],
  };

  it("accepts an exact basename match and keeps the original group", () => {
    const g = { root: "/a/repoA", rootName: "repoA", repos: ["/a/repoA"] };
    expect(resolveGrant(g, "repoA")).toEqual({ ok: true, group: g });
  });

  it("re-roots a single-repo grant onto a REAL ANCESTOR of the logged cwd", () => {
    // Card named the nested subdir "components/", but the user (correctly) grants
    // the repo root "repoA/". repoA IS an ancestor of the cwd → allowed; repos
    // stays the original cwd so findRoot walks up to repoA inside the grant.
    expect(resolveGrant(singleNested, "repoA")).toEqual({
      ok: true,
      group: {
        root: "/Users/me/repoA",
        rootName: "repoA",
        repos: ["/Users/me/repoA/src/components"],
      },
    });
  });

  it("REJECTS a single-repo grant onto a non-ancestor folder (anti-gaming guard)", () => {
    // "Downloads" is not on the path from / down to the logged cwd. Re-rooting
    // there could count an unrelated repo's commits → inflated VES. Reject.
    const res = resolveGrant(singleNested, "Downloads");
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Downloads");
  });

  it("does NOT re-root a multi-repo group on mismatch (strict check preserved)", () => {
    const res = resolveGrant(multi, "Downloads");
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Downloads");
  });

  it("accepts an exact match on a multi-repo group", () => {
    expect(resolveGrant(multi, "work")).toEqual({ ok: true, group: multi });
  });

  it("never re-roots onto '/' even if a path segment basename were empty", () => {
    // A repo directly under root: cwd "/repoA", grant something that is not an
    // ancestor → reject (there is no grantable ancestor above "/repoA").
    const single = { root: "/repoA", rootName: "repoA", repos: ["/repoA"] };
    expect(resolveGrant(single, "Users").ok).toBe(false);
  });
});
