// lib/client/burn/gitcount.ts
//
// Device-local git commit count for the VES numerator — the BROWSER analog of
// tools/usage-poc/coconut_collector/gitcount.py. Counts the operator's OWN
// commits (author email ∈ a selected set) reachable from HEAD across the
// granted repos, within the half-open reporting window [since, until),
// returning a single integer (the VES numerator) — or null when the count
// cannot be trusted.
//
// SEMANTICS are a faithful port of gitcount.py (the authoritative spec):
//   • HEAD ancestry ONLY. A commit made in-window on a feature branch the
//     operator later checked out of is not reachable from HEAD → uncounted.
//     v1 limitation by design (matches the Python collector).
//   • Author email EXACT match, NO mailmap (isomorphic-git applies none, which
//     matches the Python `git log --no-use-mailmap`).
//   • Window enforced IN CODE on each commit's author instant (epoch seconds →
//     ms), never via a fuzzy `git --since`, so the boundary is exact:
//     since <= t < until (half-open).
//   • SHAs de-duplicated GLOBALLY across repos: a commit is content-addressed,
//     so the same SHA seen in two granted repos is one commit (matches the
//     Python `all_shas |= shas`).
//   • UNKNOWN (null) != ZERO. null when: no author identity, OR no granted dir
//     resolves to a usable repo, OR a RESOLVED repo errors mid-count (poison).
//     A real 0 means at least one repo was inspected cleanly with no matching
//     commits (including an unborn HEAD — init'd, no commits).
//   • CONSERVATIVE UNDERCOUNT: a non-git / missing / shallow dir is SKIPPED
//     (its commits are unattributable), never a poison — the numerator is a
//     lower bound, never inflated, and non-gameable. Only a RESOLVED repo that
//     then errors poisons the whole count to null.
//
// PRIVACY (absolute): every input here — the granted directory path strings,
// the author emails, the commit SHAs — is used ONLY to compute one integer.
// NONE of them is ever emitted into the Burn Summary envelope, the POST body,
// or any log. The caller attaches at most the bare integer `verifiedCommits`
// plus the source tag "browser-fsa". See JoinBurnIndexForm.
//
// PERFORMANCE: repos are walked sequentially with an optional progress/abort
// hook. The full HEAD history is scanned per repo and filtered in code — there
// is NO early termination, because author dates are not monotonic along commit
// ancestry, so stopping early on a stale author date could silently undercount.
// Ref-SHA caching and windowed traversal are deferred (v2): correctness over
// speed for v1.
//
// BUNDLE: isomorphic-git is imported lazily (await import) the first time a
// count runs, so it never lands in the default client bundle — only a user who
// clicks "count commits" pays for it.

// --- isomorphic-git surface we use (structurally typed) --------------------
// Only the read-only functions are needed. Kept minimal so the lazy import is
// the single source of the real types at runtime.
interface GitAuthor {
  name: string;
  email: string;
  timestamp: number; // epoch SECONDS, UTC (timezoneOffset is display-only)
  timezoneOffset: number;
}
interface ReadCommitResult {
  oid: string;
  commit: { author: GitAuthor; committer: GitAuthor; message: string };
}
interface GitApi {
  findRoot(args: { fs: GitFs; filepath: string }): Promise<string>;
  resolveRef(args: { fs: GitFs; dir: string; ref: string }): Promise<string>;
  log(args: { fs: GitFs; dir: string; ref: string }): Promise<ReadCommitResult[]>;
  getConfig(args: { fs: GitFs; dir: string; path: string }): Promise<string | undefined>;
  Errors: { NotFoundError: new (...a: never[]) => Error };
}

// --- fs the adapter must present (validated by spike, 2026-05-30) ----------
// bindFs() binds the full command list at construction, so EVERY method name
// must EXIST as a function — but only readFile + stat are CALLED on the
// read-only log/findRoot/resolveRef path. Write ops are present-but-throwing.
export interface GitStats {
  type: "file" | "dir";
  mode: number;
  size: number;
  ino: number;
  dev: number;
  uid: number;
  gid: number;
  ctimeMs: number;
  mtimeMs: number;
  ctimeSeconds: number;
  ctimeNanoseconds: number;
  mtimeSeconds: number;
  mtimeNanoseconds: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}
export interface GitFsPromises {
  readFile(path: string, options?: { encoding?: string } | string): Promise<Uint8Array | string>;
  stat(path: string): Promise<GitStats>;
  lstat(path: string): Promise<GitStats>;
  readdir(path: string): Promise<string[]>;
  readlink(path: string): Promise<string>;
  writeFile(...args: unknown[]): Promise<void>;
  mkdir(...args: unknown[]): Promise<void>;
  unlink(...args: unknown[]): Promise<void>;
  symlink(...args: unknown[]): Promise<void>;
  rmdir(path: string, options?: unknown): Promise<void>;
}
export interface GitFs {
  promises: GitFsPromises;
}

// --- lazy isomorphic-git loader --------------------------------------------
let gitModulePromise: Promise<GitApi> | null = null;

/** Lazily import isomorphic-git. The ESM build exports `default` (an object
 *  carrying all functions) AND named exports; the CJS build (Node/vitest) wraps
 *  module.exports under `default`. Pick whichever namespace actually has
 *  `.log`. Cache the resolved module; reset on failure so a transient import
 *  error does not poison every later call. */
export function loadGit(): Promise<GitApi> {
  if (gitModulePromise == null) {
    gitModulePromise = import("isomorphic-git")
      .then((mod) => {
        const ns = mod as unknown as Record<string, unknown> & { default?: Record<string, unknown> };
        const picked = ns.default && typeof ns.default.log === "function" ? ns.default : ns;
        return picked as unknown as GitApi;
      })
      .catch((err) => {
        gitModulePromise = null;
        throw err;
      });
  }
  return gitModulePromise;
}

// --- tiny POSIX path join (isomorphic-git builds paths with "/") -----------
function joinPath(...parts: string[]): string {
  return parts
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, "") : p.replace(/^\/+|\/+$/g, "")))
    .filter((p) => p.length > 0)
    .join("/");
}

function isENOENT(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

// --- per-repo probes (faithful ports of the Python tri-states) -------------

/** Resolve `dir` to its repo root (analog of `git rev-parse --show-toplevel`),
 *  or null when `dir` is not inside a usable git work tree. ANY resolution
 *  failure (NotFoundError walking up, or an fs read error) is a SKIP, not a
 *  poison — mirrors Python `_repo_root` returning None → caller skips. */
async function findRepoRoot(git: GitApi, fs: GitFs, dir: string): Promise<string | null> {
  try {
    return await git.findRoot({ fs, filepath: dir });
  } catch {
    return null;
  }
}

/** Tri-state shallow probe of an ALREADY-RESOLVED root, by the existence of
 *  `<root>/.git/shallow`:
 *    true  → shallow clone (truncated history) → caller SKIPS this repo.
 *    false → full clone → caller counts it.
 *    null  → a non-ENOENT error on a resolved repo → caller POISONS (unknown).
 *  Matches Python `_is_shallow`: once `_repo_root` proves a usable work tree,
 *  any later git failure on it is a genuine error, never a benign skip. */
export async function isShallow(fs: GitFs, root: string): Promise<boolean | null> {
  const marker = joinPath(root, ".git", "shallow");
  try {
    await fs.promises.stat(marker);
    return true; // marker present → shallow
  } catch (err) {
    if (isENOENT(err)) return false; // marker absent → full history
    return null; // resolved repo errored on the probe → poison
  }
}

/** Tri-state HEAD probe of a resolved root:
 *    "born"   → HEAD resolves to a commit → proceed to count.
 *    "unborn" → freshly-init'd repo, no commits (real 0). isomorphic-git throws
 *               NotFoundError when HEAD's branch ref does not exist yet.
 *    "error"  → any OTHER failure on a resolved repo → poison (unknown). A git
 *               error must not masquerade as "the operator made no commits."
 *  Matches Python `_head_state` (exit 1 = unborn, other = unknown). */
export async function headState(
  git: GitApi,
  fs: GitFs,
  dir: string,
): Promise<"born" | "unborn" | "error"> {
  try {
    await git.resolveRef({ fs, dir, ref: "HEAD" });
    return "born";
  } catch (err) {
    // instanceof can fail across module realms (lazy import), so also match the
    // error code isomorphic-git stamps on its typed errors.
    if (err instanceof git.Errors.NotFoundError) return "unborn";
    if ((err as { code?: string } | null)?.code === "NotFoundError") return "unborn";
    return "error";
  }
}

/** Distinct SHAs in `root` authored by any email in `emails` within the
 *  half-open window [sinceMs, untilMs). null on a resolved-repo git error
 *  (poison). Faithful port of Python `_repo_shas`. */
async function repoShas(
  git: GitApi,
  fs: GitFs,
  root: string,
  emails: Set<string>,
  sinceMs: number,
  untilMs: number,
): Promise<Set<string> | null> {
  const head = await headState(git, fs, root);
  if (head === "error") return null; // git error after resolving root → unknown
  if (head === "unborn") return new Set(); // unborn HEAD: inspected, zero commits

  let commits: ReadCommitResult[];
  try {
    commits = await git.log({ fs, dir: root, ref: "HEAD" });
  } catch {
    return null; // born HEAD but the log walk errored → poison
  }

  const shas = new Set<string>();
  for (const entry of commits) {
    const author = entry.commit?.author;
    if (author == null) continue;
    if (!emails.has(author.email)) continue;
    const instantMs = author.timestamp * 1000; // epoch seconds → ms, absolute UTC
    if (!Number.isFinite(instantMs)) continue;
    if (sinceMs <= instantMs && instantMs < untilMs) shas.add(entry.oid);
  }
  return shas;
}

// --- public API ------------------------------------------------------------

export interface CountCommitsOptions {
  /** isomorphic-git-compatible fs: the FSA adapter (browser) or node:fs (test). */
  fs: GitFs;
  /** Candidate working directories from the granted repos (may be repo roots or
   *  subdirs — each is resolved with findRoot). Non-git / missing dirs skipped. */
  repoDirs: Iterable<string>;
  /** The operator's selected author emails. Empty → null (no identity). */
  authorEmails: Iterable<string>;
  /** Reporting window, half-open [since, until). */
  since: Date;
  until: Date;
  /** Optional progress hook, called once per resolved repo after it is counted. */
  onProgress?: (done: number, total: number) => void;
  /** Optional cancellation. An abort yields null (unknown), never a partial. */
  signal?: AbortSignal;
}

/** The VES numerator: distinct own-authored commits in [since, until) across
 *  the granted repos, or null when the count cannot be trusted. Faithful port
 *  of Python `count_commits`. */
export async function countCommits(options: CountCommitsOptions): Promise<number | null> {
  const emails = new Set([...options.authorEmails].filter((e) => e));
  if (emails.size === 0) return null; // no git identity → unknown

  const { fs, since, until, signal, onProgress } = options;
  const sinceMs = since.getTime();
  const untilMs = until.getTime();
  if (!Number.isFinite(sinceMs) || !Number.isFinite(untilMs)) return null;

  const git = await loadGit();

  // 1) Resolve granted dirs → repo roots. Skip non-git / shallow; poison only
  //    on a resolved-repo probe error. Dedup roots (many sessions, one repo).
  const roots = new Set<string>();
  for (const dir of options.repoDirs) {
    if (signal?.aborted) return null; // cancelled → unknown, not a partial
    if (!dir) continue; // missing cwd → unattributable, skip
    const root = await findRepoRoot(git, fs, dir);
    if (root == null) continue; // not a git work tree → skip
    const shallow = await isShallow(fs, root);
    if (shallow === null) return null; // resolved repo errored on probe → poison
    if (shallow) continue; // truncated history → cannot trust this repo, skip
    roots.add(root);
  }
  if (roots.size === 0) return null; // nothing verifiable → unknown, not zero

  // 2) Count distinct SHAs across roots; poison on any resolved-repo error.
  const allShas = new Set<string>();
  let done = 0;
  for (const root of roots) {
    if (signal?.aborted) return null;
    const shas = await repoShas(git, fs, root, emails, sinceMs, untilMs);
    if (shas === null) return null;
    for (const sha of shas) allShas.add(sha);
    onProgress?.(++done, roots.size);
  }
  return allShas.size;
}

export interface DiscoverAuthorsResult {
  /** Distinct `user.email` configured across the granted repos (preselect). */
  configured: string[];
  /** Distinct author emails seen in recent HEAD commits, most-frequent first
   *  (the chip choices). Bounded by `recentLimit` commits PER repo. */
  recent: string[];
}

/** Surface the candidate author emails for the chip picker: the locally
 *  configured `user.email`(s) to preselect, plus distinct recent HEAD authors
 *  to offer. Read-only; nothing here is uploaded. Resolution/probe failures are
 *  skipped silently (best-effort discovery, never poisons the UI). */
export async function discoverAuthors(options: {
  fs: GitFs;
  repoDirs: Iterable<string>;
  recentLimit?: number;
}): Promise<DiscoverAuthorsResult> {
  const limit = options.recentLimit ?? 200;
  const git = await loadGit();
  const { fs } = options;

  const roots = new Set<string>();
  for (const dir of options.repoDirs) {
    if (!dir) continue;
    const root = await findRepoRoot(git, fs, dir);
    if (root != null) roots.add(root);
  }

  const configured = new Set<string>();
  const freq = new Map<string, number>();
  for (const root of roots) {
    try {
      const email = await git.getConfig({ fs, dir: root, path: "user.email" });
      if (email) configured.add(email.trim());
    } catch {
      /* no local identity in this repo — skip */
    }
    if ((await headState(git, fs, root)) !== "born") continue;
    try {
      const commits = await git.log({ fs, dir: root, ref: "HEAD" });
      for (const entry of commits.slice(0, limit)) {
        const email = entry.commit?.author?.email;
        if (email) freq.set(email, (freq.get(email) ?? 0) + 1);
      }
    } catch {
      /* unreadable history — skip this repo's authors */
    }
  }

  const recent = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([email]) => email);
  return { configured: [...configured], recent };
}

// --- browser FSA → fs read-only adapter ------------------------------------
// Browser-only (uses File System Access handles). Not exercised by the Node
// unit tests, which pass node:fs directly; validated by the local Chrome flow
// and e2e. Maps the path strings isomorphic-git builds (`${rootPath}/.git/...`)
// onto a granted FileSystemDirectoryHandle by walking child handles. Read-only:
// write ops throw, so a bug can never mutate the user's repo.

function enoent(path: string): Error & { code: string } {
  const err = new Error(`ENOENT: no such file or directory, '${path}'`) as Error & { code: string };
  err.code = "ENOENT";
  return err;
}

function readonlyError(): never {
  const err = new Error("EROFS: gitcount fs adapter is read-only") as Error & { code: string };
  err.code = "EROFS";
  throw err;
}

function makeStat(kind: "file" | "dir", size: number): GitStats {
  const isDir = kind === "dir";
  return {
    type: kind,
    mode: isDir ? 0o040000 : 0o100644,
    size: isDir ? 0 : size,
    ino: 0,
    dev: 0,
    uid: 0,
    gid: 0,
    ctimeMs: 0,
    mtimeMs: 0,
    ctimeSeconds: 0,
    ctimeNanoseconds: 0,
    mtimeSeconds: 0,
    mtimeNanoseconds: 0,
    isFile: () => !isDir,
    isDirectory: () => isDir,
    isSymbolicLink: () => false,
  };
}

/** Build a read-only isomorphic-git fs over a granted directory handle.
 *  `rootPath` is the path string that corresponds to `root` (the same prefix
 *  the caller uses when building repoDirs, e.g. "/grant"). Paths outside
 *  `rootPath` (a walk above the grant) resolve to ENOENT — which makes
 *  findRoot terminate and the dir get skipped, the correct behavior. */
export function createFsaFs(root: FileSystemDirectoryHandle, rootPath: string): GitFs {
  const base = rootPath.replace(/\/+$/, "");

  // Segments of `path` relative to base, or null if path escapes the grant.
  function relSegments(path: string): string[] | null {
    const norm = path.replace(/\/+$/, "");
    if (norm === base) return [];
    if (!norm.startsWith(base + "/")) return null; // above/outside the grant
    return norm
      .slice(base.length + 1)
      .split("/")
      .filter((s) => s.length > 0 && s !== ".");
  }

  function mapFsaError(err: unknown, path: string): Error {
    // FSA throws DOMException NotFoundError/TypeMismatchError; isomorphic-git
    // keys off err.code === 'ENOENT'. Translate the absence cases.
    const name = (err as { name?: string } | null)?.name;
    if (name === "NotFoundError" || name === "TypeMismatchError") return enoent(path);
    return err as Error;
  }

  async function resolveDir(segments: string[], path: string): Promise<FileSystemDirectoryHandle> {
    let handle = root;
    for (const seg of segments) {
      try {
        handle = await handle.getDirectoryHandle(seg);
      } catch (err) {
        throw mapFsaError(err, path);
      }
    }
    return handle;
  }

  const promises: GitFsPromises = {
    async readFile(path, optionsArg) {
      const segments = relSegments(path);
      if (segments == null || segments.length === 0) throw enoent(path);
      const name = segments[segments.length - 1];
      const dir = await resolveDir(segments.slice(0, -1), path);
      let file: File;
      try {
        const fileHandle = await dir.getFileHandle(name);
        file = await fileHandle.getFile();
      } catch (err) {
        throw mapFsaError(err, path);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const encoding = typeof optionsArg === "string" ? optionsArg : optionsArg?.encoding;
      if (encoding === "utf8" || encoding === "utf-8") return new TextDecoder().decode(bytes);
      return bytes;
    },

    async stat(path) {
      const segments = relSegments(path);
      if (segments == null) throw enoent(path);
      if (segments.length === 0) return makeStat("dir", 0); // the grant root itself
      const name = segments[segments.length - 1];
      const parent = await resolveDir(segments.slice(0, -1), path);
      // Try file first, then directory; neither → ENOENT.
      try {
        const fileHandle = await parent.getFileHandle(name);
        const file = await fileHandle.getFile();
        return makeStat("file", file.size);
      } catch {
        /* not a file — fall through to directory probe */
      }
      try {
        await parent.getDirectoryHandle(name);
        return makeStat("dir", 0);
      } catch (err) {
        throw mapFsaError(err, path);
      }
    },

    async lstat(path) {
      return promises.stat(path); // FSA exposes no symlinks
    },

    async readdir(path) {
      const segments = relSegments(path);
      if (segments == null) throw enoent(path);
      const dir = await resolveDir(segments, path);
      const names: string[] = [];
      // FileSystemDirectoryHandle is async-iterable over its entry keys.
      for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) {
        names.push(name);
      }
      return names;
    },

    async readlink() {
      const err = new Error("EINVAL: not a symlink") as Error & { code: string };
      err.code = "EINVAL";
      throw err;
    },

    // Write ops: present so isomorphic-git's bindFs can bind them, but the
    // adapter is strictly read-only — invoking any of these throws.
    writeFile: () => readonlyError(),
    mkdir: () => readonlyError(),
    unlink: () => readonlyError(),
    symlink: () => readonlyError(),
    rmdir: () => readonlyError(),
  };

  return { promises };
}
