// gitcount.test.ts — the browser VES numerator, ported from
// tools/usage-poc/tests/test_gitcount.py.
//
// Like the Python suite, this builds REAL throwaway git repos in tmpdirs (no
// network, no shared state) and drives the SAME counting logic the browser
// runs — countCommits() over isomorphic-git — but with node:fs as the fs
// instead of the FSA adapter. The half-open window, exact-author filter, repo
// dedup, and the unknown(null) != zero contract are exercised against actual
// git history rather than mocks.
//
// The FSA→fs adapter (createFsaFs) is browser-only and validated separately by
// the local Chrome flow + e2e; here we prove the fs-agnostic core. node:fs is a
// valid isomorphic-git fs, so the only browser-specific piece left untested by
// this file is the path→handle walk, which the adapter spike already validated.

import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { promises as nodeFsPromises } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { countCommits, headState, isShallow, loadGit, type GitFs } from "@/lib/client/burn/gitcount";

// A minimal isomorphic-git stand-in for headState's two catch branches. The
// real git resolveRef can't be made to throw a non-NotFound error on demand
// (its FileSystem.read swallows fs errors to null), so — exactly as
// test_gitcount.py monkeypatches _head_state — we inject at the git boundary.
// headState only touches resolveRef + Errors.NotFoundError.
class FakeNotFoundError extends Error {}
function fakeGit(resolveRef: () => Promise<string>) {
  return {
    resolveRef,
    Errors: { NotFoundError: FakeNotFoundError },
  } as unknown as Awaited<ReturnType<typeof loadGit>>;
}
const reject = (err: unknown) => () => Promise.reject(err);
const withCode = (name: string, code: string) => Object.assign(new Error(name), { code });

// node:fs is the canonical isomorphic-git fs in Node; cast to our stricter type.
const fs = { promises: nodeFsPromises } as unknown as GitFs;

const ME = "me@example.com";
const OTHER = "someone-else@example.com";
const SINCE = new Date(Date.UTC(2026, 4, 18, 0, 0, 0)); // 2026-05-18T00:00:00Z
const UNTIL = new Date(Date.UTC(2026, 4, 25, 0, 0, 0)); // 2026-05-25T00:00:00Z

let workspace: string;

beforeAll(() => {
  workspace = mkdtempSync(path.join(tmpdir(), "gitcount-"));
  return () => rmSync(workspace, { recursive: true, force: true });
});

let repoSeq = 0;
function git(repo: string, args: string[], env?: Record<string, string>): void {
  execFileSync("git", ["-C", repo, ...args], {
    stdio: "pipe",
    env: env ? { ...process.env, ...env } : process.env,
  });
}
function initRepo(name: string): string {
  const repo = path.join(workspace, `${name}-${repoSeq++}`);
  mkdirSync(repo, { recursive: true });
  execFileSync("git", ["-C", repo, "init", "-q"]);
  git(repo, ["config", "user.name", "Test"]);
  git(repo, ["config", "user.email", ME]);
  return repo;
}
function commit(repo: string, email: string, whenIso: string, msg: string): void {
  writeFileSync(path.join(repo, "f.txt"), msg, "utf-8");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", msg], {
    GIT_AUTHOR_NAME: "Author",
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: "Author",
    GIT_COMMITTER_EMAIL: email,
    GIT_AUTHOR_DATE: whenIso,
    GIT_COMMITTER_DATE: whenIso,
  });
}
function emptyDir(name: string): string {
  const dir = path.join(workspace, `${name}-${repoSeq++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}
function shallowClone(origin: string, name: string): string {
  const dest = path.join(workspace, `${name}-${repoSeq++}`);
  execFileSync("git", ["clone", "-q", "--depth", "1", `file://${origin}`, dest], { stdio: "pipe" });
  return dest;
}

// An fs that delegates to node:fs but rejects with a chosen non-ENOENT error
// for paths/methods matching `fail` — the TS analog of the Python monkeypatch
// that forces a git error on a RESOLVED repo (must poison, never silently skip).
function failingFs(fail: (method: string, p: string) => Error | null): GitFs {
  const real = nodeFsPromises as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const wrap = (method: string) => (p: string, ...rest: unknown[]) => {
    const err = fail(method, p);
    if (err) return Promise.reject(err);
    return real[method](p, ...rest);
  };
  return {
    promises: {
      readFile: wrap("readFile"),
      stat: wrap("stat"),
      lstat: wrap("lstat"),
      readdir: wrap("readdir"),
      readlink: real.readlink,
      writeFile: real.writeFile,
      mkdir: real.mkdir,
      unlink: real.unlink,
      symlink: real.symlink,
      rmdir: real.rmdir,
    },
  } as unknown as GitFs;
}
const eio = () => Object.assign(new Error("EIO: simulated git error"), { code: "EIO" });

// --- counting & dedup ------------------------------------------------------

describe("countCommits — counting & dedup", () => {
  it("counts own commits in window", async () => {
    const repo = initRepo("r");
    commit(repo, ME, "2026-05-19T09:00:00+00:00", "a");
    commit(repo, ME, "2026-05-20T09:00:00+00:00", "b");
    expect(await countCommits({ fs, repoDirs: [repo], authorEmails: [ME], since: SINCE, until: UNTIL })).toBe(2);
  });

  it("excludes other authors", async () => {
    const repo = initRepo("r");
    commit(repo, ME, "2026-05-19T09:00:00+00:00", "mine");
    commit(repo, OTHER, "2026-05-20T09:00:00+00:00", "theirs");
    expect(await countCommits({ fs, repoDirs: [repo], authorEmails: [ME], since: SINCE, until: UNTIL })).toBe(1);
  });

  it("counts a repo once even across many cwds (subdir resolves to root)", async () => {
    const repo = initRepo("r");
    const sub = path.join(repo, "pkg");
    mkdirSync(sub);
    commit(repo, ME, "2026-05-19T09:00:00+00:00", "a");
    expect(
      await countCommits({ fs, repoDirs: [repo, sub], authorEmails: [ME], since: SINCE, until: UNTIL }),
    ).toBe(1);
  });

  it("sums distinct SHAs across repos", async () => {
    const r1 = initRepo("r1");
    const r2 = initRepo("r2");
    commit(r1, ME, "2026-05-19T09:00:00+00:00", "a");
    commit(r2, ME, "2026-05-20T09:00:00+00:00", "b");
    commit(r2, ME, "2026-05-21T09:00:00+00:00", "c");
    expect(await countCommits({ fs, repoDirs: [r1, r2], authorEmails: [ME], since: SINCE, until: UNTIL })).toBe(3);
  });
});

// --- half-open window boundaries -------------------------------------------

describe("countCommits — half-open [since, until) boundaries", () => {
  it("includes a commit exactly at since", async () => {
    const repo = initRepo("r");
    commit(repo, ME, "2026-05-18T00:00:00+00:00", "at-since");
    expect(await countCommits({ fs, repoDirs: [repo], authorEmails: [ME], since: SINCE, until: UNTIL })).toBe(1);
  });

  it("includes a commit just before until", async () => {
    const repo = initRepo("r");
    commit(repo, ME, "2026-05-24T23:59:59+00:00", "edge");
    expect(await countCommits({ fs, repoDirs: [repo], authorEmails: [ME], since: SINCE, until: UNTIL })).toBe(1);
  });

  it("excludes a commit exactly at until", async () => {
    const repo = initRepo("r");
    commit(repo, ME, "2026-05-25T00:00:00+00:00", "at-until");
    expect(await countCommits({ fs, repoDirs: [repo], authorEmails: [ME], since: SINCE, until: UNTIL })).toBe(0);
  });

  it("excludes a commit before since", async () => {
    const repo = initRepo("r");
    commit(repo, ME, "2026-05-17T23:59:59+00:00", "early");
    expect(await countCommits({ fs, repoDirs: [repo], authorEmails: [ME], since: SINCE, until: UNTIL })).toBe(0);
  });
});

// --- unknown (no verifiable repo) != zero ----------------------------------

describe("countCommits — unknown(null) vs real zero", () => {
  it("a lone non-git cwd is unknown (null)", async () => {
    const plain = emptyDir("plain");
    expect(await countCommits({ fs, repoDirs: [plain], authorEmails: [ME], since: SINCE, until: UNTIL })).toBeNull();
  });

  it("a lone missing cwd is unknown (null)", async () => {
    const missing = path.join(workspace, "does-not-exist");
    expect(await countCommits({ fs, repoDirs: [missing], authorEmails: [ME], since: SINCE, until: UNTIL })).toBeNull();
  });

  it("no cwd at all (and only empty strings) is unknown (null)", async () => {
    expect(await countCommits({ fs, repoDirs: [], authorEmails: [ME], since: SINCE, until: UNTIL })).toBeNull();
    expect(await countCommits({ fs, repoDirs: ["", ""], authorEmails: [ME], since: SINCE, until: UNTIL })).toBeNull();
  });

  it("only non-git cwds is unknown (null)", async () => {
    expect(
      await countCommits({ fs, repoDirs: [emptyDir("a"), emptyDir("b")], authorEmails: [ME], since: SINCE, until: UNTIL }),
    ).toBeNull();
  });

  it("a lone shallow clone is unknown (null) — skipped, nothing verifiable", async () => {
    const origin = initRepo("origin");
    commit(origin, ME, "2026-05-19T09:00:00+00:00", "a");
    commit(origin, ME, "2026-05-20T09:00:00+00:00", "b");
    const shallow = shallowClone(origin, "shallow");
    expect(await countCommits({ fs, repoDirs: [shallow], authorEmails: [ME], since: SINCE, until: UNTIL })).toBeNull();
  });

  it("missing author identity is unknown (null)", async () => {
    const repo = initRepo("r");
    commit(repo, ME, "2026-05-19T09:00:00+00:00", "a");
    expect(await countCommits({ fs, repoDirs: [repo], authorEmails: [], since: SINCE, until: UNTIL })).toBeNull();
    expect(await countCommits({ fs, repoDirs: [repo], authorEmails: [""], since: SINCE, until: UNTIL })).toBeNull();
  });
});

// --- partial attribution: skip the unattributable, count the verifiable ----

describe("countCommits — conservative undercount (skip, don't poison)", () => {
  it("skips a non-git cwd but counts a real repo alongside it", async () => {
    const repo = initRepo("r");
    commit(repo, ME, "2026-05-19T09:00:00+00:00", "a");
    const plain = emptyDir("plain");
    expect(
      await countCommits({ fs, repoDirs: [repo, plain], authorEmails: [ME], since: SINCE, until: UNTIL }),
    ).toBe(1);
  });

  it("skips a shallow clone but counts a full repo alongside it", async () => {
    const full = initRepo("full");
    commit(full, ME, "2026-05-19T09:00:00+00:00", "a");
    const origin = initRepo("origin");
    commit(origin, ME, "2026-05-19T09:00:00+00:00", "x");
    commit(origin, ME, "2026-05-20T09:00:00+00:00", "y");
    const shallow = shallowClone(origin, "shallow");
    expect(
      await countCommits({ fs, repoDirs: [full, shallow], authorEmails: [ME], since: SINCE, until: UNTIL }),
    ).toBe(1);
  });
});

// --- real zero -------------------------------------------------------------

describe("countCommits — genuine zero", () => {
  it("inspected repo with no matching commits is 0 (not null)", async () => {
    const repo = initRepo("r");
    commit(repo, ME, "2026-05-01T09:00:00+00:00", "old"); // outside window
    expect(await countCommits({ fs, repoDirs: [repo], authorEmails: [ME], since: SINCE, until: UNTIL })).toBe(0);
  });

  it("an unborn HEAD (init'd, no commits) is 0 (not null)", async () => {
    const repo = initRepo("r"); // no commit
    expect(await countCommits({ fs, repoDirs: [repo], authorEmails: [ME], since: SINCE, until: UNTIL })).toBe(0);
  });
});

// --- headState tri-state (codex [P2] unborn vs error) ----------------------

describe("headState", () => {
  it("unborn HEAD → 'unborn'", async () => {
    const git = await loadGit();
    const repo = initRepo("r"); // no commits
    expect(await headState(git, fs, repo)).toBe("unborn");
  });

  it("born HEAD → 'born'", async () => {
    const git = await loadGit();
    const repo = initRepo("r");
    commit(repo, ME, "2026-05-19T09:00:00+00:00", "a");
    expect(await headState(git, fs, repo)).toBe("born");
  });

  it("an arbitrary (non-NotFound) resolveRef error → 'error' (not a real zero)", async () => {
    // A git error must never masquerade as "the operator made no commits."
    const git = fakeGit(reject(withCode("InternalError: object db corrupt", "InternalError")));
    expect(await headState(git, fs, "/any")).toBe("error");
  });

  it("a NotFoundError instance → 'unborn' (cross-realm instanceof branch)", async () => {
    const git = fakeGit(reject(new FakeNotFoundError("HEAD points to a non-existent ref")));
    expect(await headState(git, fs, "/any")).toBe("unborn");
  });

  it("a NotFoundError-by-code → 'unborn' (lazy-import realm-safe branch)", async () => {
    // After a lazy import the thrown error can be from another module realm, so
    // instanceof fails; headState falls back to matching err.code.
    const git = fakeGit(reject(withCode("HEAD ref missing", "NotFoundError")));
    expect(await headState(git, fs, "/any")).toBe("unborn");
  });
});

// --- isShallow tri-state (codex [P1] skip-on-error is wrong) ----------------

describe("isShallow", () => {
  it("a full repo → false", async () => {
    const repo = initRepo("r");
    expect(await isShallow(fs, repo)).toBe(false);
  });

  it("a repo with a .git/shallow marker → true", async () => {
    const repo = initRepo("r");
    writeFileSync(path.join(repo, ".git", "shallow"), "deadbeef\n", "utf-8");
    expect(await isShallow(fs, repo)).toBe(true);
  });

  it("a non-ENOENT git error on the shallow probe → null (poison, not skip)", async () => {
    const repo = initRepo("r");
    const badFs = failingFs((method, p) => (method === "stat" && p.endsWith("/.git/shallow") ? eio() : null));
    expect(await isShallow(badFs, repo)).toBeNull();
  });
});

// --- resolved-repo error poisons the whole count ---------------------------

describe("countCommits — a resolved-repo error poisons to null", () => {
  it("a corrupt object on the HEAD log walk poisons to null (born, then errors mid-count)", async () => {
    // HEAD still resolves (born), but the commit object won't inflate, so the
    // git.log walk throws on an already-RESOLVED repo → poison, never a false 0.
    const repo = initRepo("r");
    commit(repo, ME, "2026-05-19T09:00:00+00:00", "a");
    const sha = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim();
    const objPath = path.join(repo, ".git", "objects", sha.slice(0, 2), sha.slice(2));
    chmodSync(objPath, 0o644); // loose objects are written read-only
    writeFileSync(objPath, Buffer.from("not a valid zlib-deflated git object"));
    expect(await countCommits({ fs, repoDirs: [repo], authorEmails: [ME], since: SINCE, until: UNTIL })).toBeNull();
  });

  it("a shallow-probe error poisons even when another valid repo is present", async () => {
    const good = initRepo("good");
    commit(good, ME, "2026-05-19T09:00:00+00:00", "a");
    const bad = initRepo("bad");
    commit(bad, ME, "2026-05-20T09:00:00+00:00", "b");
    // Fail only the 'bad' repo's shallow probe, AFTER it resolves cleanly.
    const badFs = failingFs((method, p) =>
      method === "stat" && p.includes(`${path.sep}bad-`) && p.endsWith("/.git/shallow") ? eio() : null,
    );
    expect(
      await countCommits({ fs: badFs, repoDirs: [good, bad], authorEmails: [ME], since: SINCE, until: UNTIL }),
    ).toBeNull();
  });
});
