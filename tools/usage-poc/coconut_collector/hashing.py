"""hashing.py — device-local salted project hashing.

projectHash anonymises a project so the same project aggregates stably on
one device while its path/name cannot be recovered off-device.

  projectHash = sha256(salt + ":" + project_slug)[:12]

The salt is a random 32-byte value generated once per device and stored at
~/.coconutlabs/salt (0600). It NEVER leaves the device and is never written
into any Burn Summary. See web/docs/decision/coconutlabs-verification-model.md.
"""

import hashlib
import os
import secrets
from pathlib import Path

SALT_DIR = Path.home() / ".coconutlabs"
SALT_PATH = SALT_DIR / "salt"
_HASH_LEN = 12


def load_or_create_salt(salt_path: Path = SALT_PATH) -> str:
    """Return the device salt (hex), creating it once if absent.

    The salt file is created with 0600 permissions. A pre-existing file is
    left untouched so project hashes stay stable across runs.
    """
    if salt_path.is_file():
        existing = salt_path.read_text(encoding="utf-8").strip()
        if existing:
            # Tighten perms on a pre-existing file: O_CREAT mode never
            # applies to a file that already exists.
            os.chmod(salt_path, 0o600)
            return existing
    salt_path.parent.mkdir(parents=True, exist_ok=True)
    salt = secrets.token_hex(32)
    # Write 0600 atomically: create with restrictive mode, then write.
    fd = os.open(str(salt_path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(salt)
    # O_CREAT mode is masked by umask; chmod guarantees exactly 0600.
    os.chmod(salt_path, 0o600)
    return salt


def project_hash(project_slug: str, salt: str) -> str:
    """Compute the 12-hex salted hash of a project slug.

    project_slug is hash input only — callers must never emit it raw.
    """
    digest = hashlib.sha256(f"{salt}:{project_slug}".encode("utf-8")).hexdigest()
    return digest[:_HASH_LEN]
