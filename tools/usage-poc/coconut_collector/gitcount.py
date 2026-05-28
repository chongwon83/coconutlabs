"""gitcount.py — device-local git commit count for the VES numerator.

Counts the operator's OWN commits across the repos they worked in during the
reporting window, returning a single integer (the VES numerator) — or None
when the count cannot be trusted.

PRIVACY (absolute): cwd, repo root, commit SHA, and author email are used
ONLY locally to compute one integer. None of them are ever emitted into the
Burn Summary envelope — build_envelope() copies only whitelisted fields and
attaches at most the bare integer `verifiedCommits`.

UNKNOWN != ZERO: a missing/shallow/unreadable repo, a git error, or no author
identity yields None ("unknown" → the collector omits the field → UI "—").
A real 0 means every inspected repo had zero matching commits in the window.

KNOWN LIMITATION (v1): commits are counted from HEAD only. If the operator made
in-window commits on a feature branch and checked out another branch before
running the collector, those commits are not reachable from HEAD and go
uncounted — so the numerator is checkout-dependent. Widening the ref scope to
local branches (`--branches`) is deferred to v2 (plan Q6, numerator
refinements), since it interacts with the unborn-HEAD probe (orphan branches)
and changes scoring semantics that the S3.5 design ratified as HEAD-only.
"""

import subprocess
from datetime import datetime, timezone

_GIT_TIMEOUT = 30  # seconds; a hung git invocation must not stall the CLI run


def _run_git(args: list[str]) -> "subprocess.CompletedProcess | None":
    """Run a git command, returning the completed process or None on failure
    to even launch (git missing, OS error, timeout)."""
    try:
        return subprocess.run(
            ["git", *args],
            capture_output=True, text=True, timeout=_GIT_TIMEOUT,
        )
    except (OSError, subprocess.SubprocessError):
        return None


def git_author_email() -> str | None:
    """The configured commit author email (`git config user.email`), or None.

    Used ONLY to filter the operator's own commits. Never uploaded.
    """
    proc = _run_git(["config", "user.email"])
    if proc is None or proc.returncode != 0:
        return None
    email = proc.stdout.strip()
    return email or None


def _repo_root(cwd: str) -> str | None:
    """Resolve the git top-level for `cwd`, or None when `cwd` is not inside a
    usable git work tree."""
    proc = _run_git(["-C", cwd, "rev-parse", "--show-toplevel"])
    if proc is None or proc.returncode != 0:
        return None
    root = proc.stdout.strip()
    return root or None


def _is_shallow(root: str) -> bool:
    """True when `root` is a shallow clone (truncated history) — its commit
    count cannot be trusted, so the caller treats it as unknown."""
    proc = _run_git(["-C", root, "rev-parse", "--is-shallow-repository"])
    if proc is None or proc.returncode != 0:
        return True
    return proc.stdout.strip() == "true"


def _head_state(root: str) -> "bool | None":
    """Tri-state probe of `root`'s HEAD.

    True  → HEAD resolves to at least one commit (proceed to count).
    False → unborn HEAD: a freshly-init'd repo, inspected, zero commits (real 0).
    None  → git could not answer (timeout, OS error, or an unexpected failure
            after the work tree was already resolved) → unknown, omit the field.

    `git rev-parse --verify --quiet HEAD` exits 0 with a born HEAD and 1 for an
    unborn HEAD; any other exit code (e.g. 128 from a corrupt/unreadable repo)
    or a failure to launch git is treated as unknown rather than a real 0 — a
    git error must not masquerade as "the operator made no commits."
    """
    proc = _run_git(["-C", root, "rev-parse", "--verify", "--quiet", "HEAD"])
    if proc is None:
        return None
    if proc.returncode == 0:
        return True
    if proc.returncode == 1:
        return False
    return None


def _parse_iso(value: str) -> "datetime | None":
    """Parse a git %aI author date (strict ISO-8601) into an aware UTC datetime."""
    try:
        dt = datetime.fromisoformat(value.strip())
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _repo_shas(root: str, author_email: str,
               since: datetime, until: datetime) -> "set[str] | None":
    """Distinct SHAs in `root` authored by `author_email` within the half-open
    window [since, until). None on git error.

    The window is enforced IN CODE on the parsed %aI author date rather than via
    `git log --since/--until`, whose fuzzy date parsing can drift by a second at
    the boundary. `--no-use-mailmap` keeps %ae the raw configured email so the
    exact-string author match is deterministic regardless of repo .mailmap.
    """
    head = _head_state(root)
    if head is None:
        return None   # git error after resolving the root → unknown
    if not head:
        return set()  # unborn HEAD: inspected, zero commits — a real 0
    proc = _run_git([
        "-C", root, "log", "--no-use-mailmap",
        "--pretty=format:%H%x09%ae%x09%aI", "HEAD",
    ])
    if proc is None or proc.returncode != 0:
        return None
    shas: set[str] = set()
    for line in proc.stdout.splitlines():
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        sha, email, authored = parts
        if email != author_email:
            continue
        dt = _parse_iso(authored)
        if dt is None:
            continue
        if since <= dt < until:
            shas.add(sha)
    return shas


def count_commits(repo_cwds, author_email: "str | None",
                  since_utc: datetime, until_utc: datetime) -> "int | None":
    """Distinct commits authored by `author_email` in [since_utc, until_utc)
    across the git repos containing `repo_cwds`.

    repo_cwds: iterable of working directories from the in-window sessions.
      Empty strings are ignored. Distinct repos are counted once even when many
      sessions share a repo; SHAs are de-duplicated across repos before summing.

    Returns None ("unknown", → omit the field) when:
      - author_email is missing (no git identity), or
      - no usable cwd was supplied at all, or
      - any supplied cwd is not inside a usable git repo, is a shallow clone,
        or git errors out.
    Returns an int (possibly 0) only when EVERY contributing repo was inspected
    cleanly.
    """
    if not author_email:
        return None
    roots: set[str] = set()
    saw_cwd = False
    for cwd in repo_cwds:
        if not cwd:
            continue
        saw_cwd = True
        root = _repo_root(cwd)
        if root is None:
            return None  # worked in a dir we can't verify → unknown
        if _is_shallow(root):
            return None  # truncated history → cannot trust the count
        roots.add(root)
    if not saw_cwd:
        return None  # no repo signal at all → unknown, not zero
    all_shas: set[str] = set()
    for root in roots:
        shas = _repo_shas(root, author_email, since_utc, until_utc)
        if shas is None:
            return None
        all_shas |= shas
    return len(all_shas)
