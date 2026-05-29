"""TDD suite for gitcount — the device-local VES numerator.

Builds REAL throwaway git repos in tmp_path (no network, no shared state) so
the half-open window, exact-author filter, repo dedup, and the contract
(non-git/shallow cwds skipped → conservative undercount; only no-verifiable-repo
or a genuine git error yields unknown=None) are exercised against actual
`git log` output rather than mocks.

Privacy is structural here: count_commits only ever returns an int or None,
so there is nothing for a test to assert about leaked cwd/SHA/email — the
function has no other output channel.
"""

import subprocess
from datetime import datetime, timezone

import pytest

from coconut_collector import gitcount
from coconut_collector.gitcount import count_commits


class _FakeProc:
    """Minimal stand-in for subprocess.CompletedProcess used to simulate a
    specific git exit code without spawning git."""

    def __init__(self, returncode: int, stdout: str = ""):
        self.returncode = returncode
        self.stdout = stdout

UTC = timezone.utc
ME = "me@example.com"
OTHER = "someone-else@example.com"

# Window used by most tests: half-open [SINCE, UNTIL).
SINCE = datetime(2026, 5, 18, 0, 0, 0, tzinfo=UTC)
UNTIL = datetime(2026, 5, 25, 0, 0, 0, tzinfo=UTC)


# --- helpers -------------------------------------------------------------

def _git(repo, *args, env=None):
    subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True, capture_output=True, text=True, env=env,
    )


def _init_repo(path):
    path.mkdir(parents=True, exist_ok=True)
    _git(path, "init", "-q")
    # Local identity so commits succeed even on a machine with no global config.
    _git(path, "config", "user.name", "Test")
    _git(path, "config", "user.email", ME)
    return path


def _commit(repo, email, when, msg):
    """Create one commit authored by `email` at `when` (aware datetime)."""
    when_iso = when.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    (repo / "f.txt").write_text(msg, encoding="utf-8")
    env = {
        "GIT_AUTHOR_NAME": "Author", "GIT_AUTHOR_EMAIL": email,
        "GIT_COMMITTER_NAME": "Author", "GIT_COMMITTER_EMAIL": email,
        "GIT_AUTHOR_DATE": when_iso, "GIT_COMMITTER_DATE": when_iso,
    }
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", msg, env=env)


# --- counting & dedup ----------------------------------------------------

def test_counts_own_commits_in_window(tmp_path):
    repo = _init_repo(tmp_path / "r")
    _commit(repo, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "a")
    _commit(repo, ME, datetime(2026, 5, 20, 9, 0, tzinfo=UTC), "b")
    assert count_commits([str(repo)], ME, SINCE, UNTIL) == 2


def test_other_author_excluded(tmp_path):
    repo = _init_repo(tmp_path / "r")
    _commit(repo, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "mine")
    _commit(repo, OTHER, datetime(2026, 5, 20, 9, 0, tzinfo=UTC), "theirs")
    assert count_commits([str(repo)], ME, SINCE, UNTIL) == 1


def test_same_repo_many_cwds_counts_once(tmp_path):
    repo = _init_repo(tmp_path / "r")
    sub = repo / "pkg"
    sub.mkdir()
    _commit(repo, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "a")
    # Two sessions: one at repo root, one in a subdir — same toplevel.
    assert count_commits([str(repo), str(sub)], ME, SINCE, UNTIL) == 1


def test_distinct_shas_summed_across_repos(tmp_path):
    r1 = _init_repo(tmp_path / "r1")
    r2 = _init_repo(tmp_path / "r2")
    _commit(r1, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "a")
    _commit(r2, ME, datetime(2026, 5, 20, 9, 0, tzinfo=UTC), "b")
    _commit(r2, ME, datetime(2026, 5, 21, 9, 0, tzinfo=UTC), "c")
    assert count_commits([str(r1), str(r2)], ME, SINCE, UNTIL) == 3


# --- half-open window boundaries ----------------------------------------

def test_boundary_at_since_included(tmp_path):
    repo = _init_repo(tmp_path / "r")
    _commit(repo, ME, SINCE, "at-since")
    assert count_commits([str(repo)], ME, SINCE, UNTIL) == 1


def test_boundary_just_before_until_included(tmp_path):
    repo = _init_repo(tmp_path / "r")
    # 2026-05-24T23:59:59Z is < UNTIL (2026-05-25T00:00:00Z) → included.
    _commit(repo, ME, datetime(2026, 5, 24, 23, 59, 59, tzinfo=UTC), "edge")
    assert count_commits([str(repo)], ME, SINCE, UNTIL) == 1


def test_boundary_exactly_until_excluded(tmp_path):
    repo = _init_repo(tmp_path / "r")
    _commit(repo, ME, UNTIL, "at-until")
    assert count_commits([str(repo)], ME, SINCE, UNTIL) == 0


def test_before_since_excluded(tmp_path):
    repo = _init_repo(tmp_path / "r")
    _commit(repo, ME, datetime(2026, 5, 17, 23, 59, 59, tzinfo=UTC), "early")
    assert count_commits([str(repo)], ME, SINCE, UNTIL) == 0


# --- unknown (no verifiable repo) != zero --------------------------------
# A cwd we can't attribute (non-git / missing / shallow) is SKIPPED. The count
# is None only when NOTHING verifiable remains; a real 0 needs a clean repo.

def test_non_git_cwd_is_unknown(tmp_path):
    # Lone non-git cwd → skipped → no verifiable repo → unknown (None), not 0.
    plain = tmp_path / "not-a-repo"
    plain.mkdir()
    assert count_commits([str(plain)], ME, SINCE, UNTIL) is None


def test_missing_cwd_is_unknown(tmp_path):
    # Lone missing dir → skipped → no verifiable repo → unknown (None).
    missing = tmp_path / "does-not-exist"
    assert count_commits([str(missing)], ME, SINCE, UNTIL) is None


def test_no_cwd_at_all_is_unknown(tmp_path):
    assert count_commits([], ME, SINCE, UNTIL) is None
    assert count_commits(["", "   " if False else ""], ME, SINCE, UNTIL) is None


def test_only_non_git_cwds_is_unknown(tmp_path):
    # Several cwds, none a git repo → no verifiable repo → unknown (None).
    a = tmp_path / "a"
    b = tmp_path / "b"
    a.mkdir()
    b.mkdir()
    assert count_commits([str(a), str(b)], ME, SINCE, UNTIL) is None


def test_shallow_repo_is_unknown(tmp_path):
    # Lone shallow clone → skipped (untrusted history) → no verifiable repo → None.
    origin = _init_repo(tmp_path / "origin")
    _commit(origin, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "a")
    _commit(origin, ME, datetime(2026, 5, 20, 9, 0, tzinfo=UTC), "b")
    shallow = tmp_path / "shallow"
    subprocess.run(
        ["git", "clone", "-q", "--depth", "1",
         f"file://{origin}", str(shallow)],
        check=True, capture_output=True, text=True,
    )
    assert count_commits([str(shallow)], ME, SINCE, UNTIL) is None


# --- partial attribution: skip the unattributable, count the verifiable -----
# Reversal of codex [P1] (2026-05-28): a non-git/shallow cwd alongside a real
# repo no longer poisons the count — it is skipped, the repo is counted. VES
# becomes a conservative lower bound rather than perpetually "—".

def test_non_git_cwd_skipped_real_repo_counted(tmp_path):
    repo = _init_repo(tmp_path / "r")
    _commit(repo, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "a")
    plain = tmp_path / "plain"
    plain.mkdir()
    # One good repo + one non-repo cwd (e.g. a workspace parent dir or a removed
    # worktree) → the non-repo is skipped, the repo's commit IS counted.
    assert count_commits([str(repo), str(plain)], ME, SINCE, UNTIL) == 1


def test_shallow_skipped_real_repo_counted(tmp_path):
    full = _init_repo(tmp_path / "full")
    _commit(full, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "a")
    origin = _init_repo(tmp_path / "origin")
    _commit(origin, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "x")
    _commit(origin, ME, datetime(2026, 5, 20, 9, 0, tzinfo=UTC), "y")
    shallow = tmp_path / "shallow"
    subprocess.run(
        ["git", "clone", "-q", "--depth", "1",
         f"file://{origin}", str(shallow)],
        check=True, capture_output=True, text=True,
    )
    # Shallow (untrusted) is skipped; only the full repo's commit is counted.
    assert count_commits([str(full), str(shallow)], ME, SINCE, UNTIL) == 1


def test_no_author_identity_is_unknown(tmp_path):
    repo = _init_repo(tmp_path / "r")
    _commit(repo, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "a")
    assert count_commits([str(repo)], None, SINCE, UNTIL) is None
    assert count_commits([str(repo)], "", SINCE, UNTIL) is None


# --- real zero -----------------------------------------------------------

def test_inspected_but_no_matching_commits_is_zero(tmp_path):
    repo = _init_repo(tmp_path / "r")
    # Commit exists but outside the window → inspected, genuine 0.
    _commit(repo, ME, datetime(2026, 5, 1, 9, 0, tzinfo=UTC), "old")
    assert count_commits([str(repo)], ME, SINCE, UNTIL) == 0


def test_unborn_head_is_zero(tmp_path):
    repo = _init_repo(tmp_path / "r")  # init'd, no commits yet
    assert count_commits([str(repo)], ME, SINCE, UNTIL) == 0


# --- unborn HEAD vs git error (codex [P2]) -------------------------------

def test_head_state_unborn_is_false(tmp_path):
    repo = _init_repo(tmp_path / "r")  # no commits → unborn HEAD (exit 1)
    assert gitcount._head_state(str(repo)) is False


def test_head_state_born_is_true(tmp_path):
    repo = _init_repo(tmp_path / "r")
    _commit(repo, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "a")
    assert gitcount._head_state(str(repo)) is True


def test_head_state_git_error_is_unknown(tmp_path, monkeypatch):
    """A non-0/non-1 git exit (e.g. 128 from a corrupt repo) must NOT be read
    as a real zero — it is unknown so the field is omitted."""
    repo = _init_repo(tmp_path / "r")
    monkeypatch.setattr(gitcount, "_run_git", lambda args: _FakeProc(128))
    assert gitcount._head_state(str(repo)) is None


def test_head_state_git_unlaunchable_is_unknown(tmp_path, monkeypatch):
    """git failing to launch (timeout / OS error → _run_git None) is unknown,
    never a real zero."""
    repo = _init_repo(tmp_path / "r")
    monkeypatch.setattr(gitcount, "_run_git", lambda args: None)
    assert gitcount._head_state(str(repo)) is None


def test_git_error_probing_head_poisons_count_to_none(tmp_path, monkeypatch):
    """An otherwise countable repo whose HEAD probe errors poisons the whole
    count to None (unknown), not a partial/real number."""
    repo = _init_repo(tmp_path / "r")
    _commit(repo, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "a")
    monkeypatch.setattr(gitcount, "_head_state", lambda root: None)
    assert count_commits([str(repo)], ME, SINCE, UNTIL) is None


# --- shallow probe is tri-state, not skip-on-error (codex [P1] 2026-05-29) ----
# _repo_root() is THE resolution gate (its failure = "not a usable repo" = skip).
# Once a repo HAS resolved, any later git failure on it — including the shallow
# probe — is a genuine error and must POISON, never silently drop the repo.

def test_is_shallow_git_error_is_none(tmp_path, monkeypatch):
    """A git error on the shallow probe (unlaunchable or non-0 exit) returns
    None (poison), not True (which would silently skip a resolved repo)."""
    repo = _init_repo(tmp_path / "r")
    monkeypatch.setattr(gitcount, "_run_git", lambda args: None)
    assert gitcount._is_shallow(str(repo)) is None
    monkeypatch.setattr(gitcount, "_run_git", lambda args: _FakeProc(128))
    assert gitcount._is_shallow(str(repo)) is None


def test_is_shallow_full_repo_is_false(tmp_path):
    repo = _init_repo(tmp_path / "r")
    assert gitcount._is_shallow(str(repo)) is False


def test_shallow_probe_error_poisons_even_with_valid_repo(tmp_path, monkeypatch):
    """The hole codex flagged: a resolved repo whose shallow probe errors must
    poison the whole count even when ANOTHER valid repo is present — never
    silently drop the errored repo and emit a misleading partial number."""
    good = _init_repo(tmp_path / "good")
    _commit(good, ME, datetime(2026, 5, 19, 9, 0, tzinfo=UTC), "a")
    bad = _init_repo(tmp_path / "bad")
    _commit(bad, ME, datetime(2026, 5, 20, 9, 0, tzinfo=UTC), "b")
    real_is_shallow = gitcount._is_shallow

    def _flaky(root):
        # Simulate a git error on the shallow probe for the 'bad' repo only,
        # after it already resolved cleanly at _repo_root().
        if root.rstrip("/").endswith("bad"):
            return None
        return real_is_shallow(root)

    monkeypatch.setattr(gitcount, "_is_shallow", _flaky)
    assert count_commits([str(good), str(bad)], ME, SINCE, UNTIL) is None
