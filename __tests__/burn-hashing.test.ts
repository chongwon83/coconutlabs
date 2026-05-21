// burn-hashing.test.ts — pure projectHash byte-parity + salt-shape validation.
//
// Why these tests exist: projectHash is the only identifier emitted to the
// server for a given project. Two different (slug, salt) inputs MUST land at
// two different hashes, the same inputs MUST be deterministic, and the output
// MUST be exactly 12 lowercase hex characters (validateSummary's schema
// invariant). A drift here would either collapse two projects into one row or
// silently leak slug entropy through ASCII case quirks.
//
// IndexedDB-backed helpers (loadOrCreateSalt / importSalt / clearSalt) are
// not covered here — vitest's `environment: "node"` has no IndexedDB. Their
// SALT_RE validation is exercised indirectly via burn-security tests where
// the parsers receive hex-shaped salts directly.

import { describe, it, expect } from "vitest";
import { projectHash } from "@/lib/client/burn/hashing";

// A valid Python-style salt — 64 lowercase hex chars (secrets.token_hex(32)).
const SALT_A = "deadbeef" + "0".repeat(56);
const SALT_B = "0123456789abcdef" + "0".repeat(48);

describe("projectHash — deterministic + isolated", () => {
  it("same (slug, salt) returns the same hash twice", async () => {
    const h1 = await projectHash("my-project", SALT_A);
    const h2 = await projectHash("my-project", SALT_A);
    expect(h1).toBe(h2);
  });

  it("different slug under the same salt returns a different hash", async () => {
    const a = await projectHash("project-a", SALT_A);
    const b = await projectHash("project-b", SALT_A);
    expect(a).not.toBe(b);
  });

  it("different salt under the same slug returns a different hash", async () => {
    const a = await projectHash("project", SALT_A);
    const b = await projectHash("project", SALT_B);
    expect(a).not.toBe(b);
  });

  it("output is exactly 12 lowercase hex characters (validateSummary invariant)", async () => {
    const h = await projectHash("any-slug", SALT_A);
    expect(h).toMatch(/^[0-9a-f]{12}$/);
    expect(h.length).toBe(12);
  });
});

describe("projectHash — input handling", () => {
  it("handles UTF-8 multi-byte slug characters", async () => {
    const h = await projectHash("프로젝트-한글", SALT_A);
    expect(h).toMatch(/^[0-9a-f]{12}$/);
  });

  it("empty slug still produces a 12-char hex (consumer guards emptiness)", async () => {
    const h = await projectHash("", SALT_A);
    expect(h).toMatch(/^[0-9a-f]{12}$/);
  });

  it("treats slug case as significant (no normalisation)", async () => {
    const lower = await projectHash("project", SALT_A);
    const upper = await projectHash("PROJECT", SALT_A);
    expect(lower).not.toBe(upper);
  });
});
