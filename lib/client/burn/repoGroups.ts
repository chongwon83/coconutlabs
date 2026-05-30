// repoGroups.ts — C2: group discovered repo cwds into grantable parent folders.
//
// Part B counts git commits in-browser over File System Access (FSA) handles.
// FSA grants ONE directory per picker action, so to count N repos we want the
// user to grant the fewest folders that cover the most repos. The raw cwds (and
// claude project slugs) captured by C1's `onRawCwd` are absolute-ish paths;
// this module groups them BY IMMEDIATE PARENT so a single grant of e.g. ~/work
// covers every repo directly inside it.
//
// Why immediate-parent and NOT common-ancestor: the common ancestor of all a
// user's repos is usually $HOME (or "/"), which Chrome blocks as a system folder
// and which would over-grant. Immediate-parent grouping is inherently
// collapse-resistant — ~/work and ~/personal stay separate groups even though
// both live under ~/. A `threshold` (default 2) keeps one-off parents out of the
// recommended set; singletons are returned separately so the UI can still offer
// them or skip them.
//
// The output shape feeds gitcount directly: `root` is the createFsaFs rootPath,
// `rootName` is the basename to verify against the granted handle.name, and
// `repos` are the countCommits `repoDirs`.
//
// PURE: no I/O, no FSA, no env. Raw paths stay client-local (the C1 privacy
// invariant) — this module only reshapes them for the grant UI and its output
// is NEVER serialized into the envelope or POST body.
//
// LIMITATIONS (conservative undercount, by design — never overcount / game):
//   - A cwd nested deeper than one level below its group root (e.g.
//     ~/work/nested/repo) lands in its own parent group (~/work/nested) and may
//     fall below threshold → skipped. A ~/work grant can still cover it once
//     granted (createFsaFs walks child segments), but we don't auto-roll it up,
//     to avoid drifting toward $HOME collapse.
//   - claude slugs decode lossily: a literal "-" inside a path segment is
//     indistinguishable from the "/" separator. A mis-decoded path simply fails
//     the post-grant leaf-name check / findRoot downstream and is skipped.
//   - Non-POSIX-absolute raws (Windows drive paths, relative paths) are skipped.

export interface GroupReposInput {
  raw: string;
  source: "claude" | "codex";
}

export interface RepoGroup {
  /** Absolute parent path the user grants once; pass as createFsaFs rootPath. */
  root: string;
  /** basename(root) — verify the granted handle.name matches before walking. */
  rootName: string;
  /** Absolute repo cwds directly under `root` (deduped, sorted); the
   *  countCommits `repoDirs`. */
  repos: string[];
}

export interface GroupReposResult {
  /** Parent folders with ≥ threshold repos, most repos first (then root asc). */
  groups: RepoGroup[];
  /** Repo cwds whose parent fell below threshold (offer individually / skip). */
  ungrouped: string[];
  /** Raw values that could not be normalized to an absolute POSIX path. */
  skipped: string[];
}

export interface GroupReposOptions {
  /** Min repos under a parent for it to be a recommended group. Default 2. */
  threshold?: number;
}

// Collapse repeated slashes and strip the trailing slash (but keep root "/").
function cleanPosix(p: string): string {
  const collapsed = p.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return collapsed === "" ? "/" : collapsed;
}

function posixDirname(p: string): string {
  const i = p.lastIndexOf("/");
  if (i <= 0) return "/"; // "/repoA" → "/"
  return p.slice(0, i);
}

function posixBasename(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? p : p.slice(i + 1);
}

/** Decode a captured raw value into an absolute POSIX path, or null if it isn't
 *  one we can use. A codex `cwd` is already an absolute path; a claude project
 *  dir name is the cwd with "/" replaced by "-" (lossy to reverse — see
 *  LIMITATIONS at the top of this file). */
export function normalizeRaw(raw: string, source: "claude" | "codex"): string | null {
  if (!raw) return null;
  if (source === "codex") {
    if (!raw.startsWith("/")) return null; // not POSIX-absolute (Windows / relative)
    return cleanPosix(raw);
  }
  // claude: a slug like "-Users-me-work-repoA" → "/Users/me/work/repoA".
  if (!raw.startsWith("-")) return null; // unexpected encoding
  return cleanPosix(raw.replace(/-/g, "/"));
}

/** Group discovered repo cwds by their immediate parent directory so the UI can
 *  request the fewest FSA grants that cover the most repos. Deterministic and
 *  pure. */
export function groupRepos(
  inputs: Iterable<GroupReposInput>,
  options: GroupReposOptions = {},
): GroupReposResult {
  const threshold = options.threshold ?? 2;
  const skipped: string[] = [];
  // Distinct absolute repo paths (dedup across sessions and across sources).
  const repoSet = new Set<string>();
  for (const { raw, source } of inputs) {
    const abs = normalizeRaw(raw, source);
    if (abs === null) {
      skipped.push(raw);
      continue;
    }
    repoSet.add(abs);
  }

  // Bucket by immediate parent.
  const byParent = new Map<string, string[]>();
  for (const repo of repoSet) {
    const parent = posixDirname(repo);
    const arr = byParent.get(parent);
    if (arr) arr.push(repo);
    else byParent.set(parent, [repo]);
  }

  const groups: RepoGroup[] = [];
  const ungrouped: string[] = [];
  for (const [parent, repos] of byParent) {
    const sortedRepos = [...repos].sort();
    // Granting "/" (filesystem root) is the $HOME-collapse hazard and Chrome
    // blocks it anyway — never a recommended group, regardless of count.
    if (parent !== "/" && sortedRepos.length >= threshold) {
      groups.push({ root: parent, rootName: posixBasename(parent), repos: sortedRepos });
    } else {
      ungrouped.push(...sortedRepos);
    }
  }
  // Most repos first; ties broken by root path ascending for stable UI order.
  groups.sort(
    (a, b) =>
      b.repos.length - a.repos.length ||
      (a.root < b.root ? -1 : a.root > b.root ? 1 : 0),
  );
  ungrouped.sort();
  return { groups, ungrouped, skipped };
}
