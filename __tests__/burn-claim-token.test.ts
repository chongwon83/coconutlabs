// burn-claim-token.test.ts — browser claim-token mint + key derivation.
//
// SCOPE NOTE: claimToken.ts persists tokens in the BROWSER IndexedDB. vitest
// runs with `environment: "node"` and we don't ship fake-indexeddb as a devDep
// (mirroring burn-handles.test.ts / burn-hashing.test.ts), so this file does
// NOT exercise the IDB round-trip — loadOrCreateClaimToken / peek / clear /
// getLastClaimedHandle persistence is an e2e/playwright concern (PR step 13).
//
// It DOES lock in the two contracts that don't need IndexedDB and that, if
// broken, fail silently in production:
//   1. mintClaimToken() output must satisfy the SERVER's isValidTokenFormat
//      gate. A drift here 400s every upload before the claim logic runs — the
//      test imports the real server validator to bind the two modules together.
//   2. claimTokenStorageKey() collapses @-prefix / casing aliases onto ONE key
//      (per-canonical-handle identity) and namespaces away from the salt key.

import { describe, it, expect } from "vitest";
import {
  mintClaimToken,
  claimTokenStorageKey,
  loadOrCreateClaimToken,
  peekClaimToken,
  getLastClaimedHandle,
  clearClaimToken,
} from "@/lib/client/burn/claimToken";
// The SERVER-side gate the minted token must pass. Importing it (node:crypto is
// fine under the node test env) is the whole point — it binds client mint to
// server acceptance so they can never drift apart unnoticed.
import { isValidTokenFormat } from "@/lib/server/claim";

describe("mintClaimToken — server-acceptable format", () => {
  it("produces a 43-char base64url token", () => {
    const t = mintClaimToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("every minted token passes the server's isValidTokenFormat gate", () => {
    // 256 samples — catches an off-by-one length or a stray '=' / '+' / '/' that
    // a single sample could miss (padding only appears for some byte patterns).
    for (let i = 0; i < 256; i++) {
      const t = mintClaimToken();
      expect(isValidTokenFormat(t)).toBe(true);
    }
  });

  it("never contains base64 padding or non-url characters", () => {
    for (let i = 0; i < 64; i++) {
      const t = mintClaimToken();
      expect(t).not.toContain("=");
      expect(t).not.toContain("+");
      expect(t).not.toContain("/");
    }
  });

  it("is effectively unique across many mints (CSPRNG, not constant)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(mintClaimToken());
    expect(seen.size).toBe(1000);
  });
});

describe("claimTokenStorageKey — per-canonical-handle aliasing", () => {
  it("collapses @-prefix and casing variants onto ONE key", () => {
    const keys = ["@Foo", "Foo", "foo", "  @FOO  ", "@@foo"].map(
      claimTokenStorageKey,
    );
    const unique = new Set(keys);
    expect(unique.size).toBe(1);
    expect([...unique][0]).toBe("claimToken:foo");
  });

  it("gives distinct handles distinct keys", () => {
    expect(claimTokenStorageKey("@alice")).not.toBe(
      claimTokenStorageKey("@bob"),
    );
  });

  it("namespaces under claimToken: so it can't collide with the salt key", () => {
    const key = claimTokenStorageKey("@someone");
    expect(key.startsWith("claimToken:")).toBe(true);
    expect(key).not.toBe("salt");
  });

  it("falls back to a loose lowercased key for an uncanonicalizable handle", () => {
    // Underscore is rejected by the canonical charset (parity with the server);
    // the server 400s such a handle, but the key derivation stays total.
    expect(claimTokenStorageKey("@foo_bar")).toBe("claimToken:foo_bar");
    expect(claimTokenStorageKey("@FOO_BAR")).toBe("claimToken:foo_bar");
  });

  it("throws on a handle that normalizes to empty", () => {
    expect(() => claimTokenStorageKey("@@@")).toThrow();
    expect(() => claimTokenStorageKey("   ")).toThrow();
  });
});

describe("public surface", () => {
  it("exports the documented functions", () => {
    expect(typeof mintClaimToken).toBe("function");
    expect(typeof claimTokenStorageKey).toBe("function");
    expect(typeof loadOrCreateClaimToken).toBe("function");
    expect(typeof peekClaimToken).toBe("function");
    expect(typeof getLastClaimedHandle).toBe("function");
    expect(typeof clearClaimToken).toBe("function");
  });

  it("IDB-backed reads resolve to null (never throw) when IndexedDB is absent", async () => {
    // Under node there is no global indexedDB; the read-only helpers swallow the
    // ReferenceError and resolve to null rather than rejecting (callers treat
    // null as 'no token yet').
    expect(typeof globalThis.indexedDB).toBe("undefined");
    await expect(peekClaimToken("@nobody")).resolves.toBeNull();
    await expect(getLastClaimedHandle()).resolves.toBeNull();
  });

  it("loadOrCreateClaimToken REJECTS (never silently resolves) when IndexedDB is absent", async () => {
    // The I4 abort contract: unlike the read-only peeks, loadOrCreateClaimToken
    // does NOT swallow a storage failure — it must reject so the form aborts the
    // upload instead of POSTing token-less (which would 400 the handle or mint a
    // competing claim). A blocked/private-mode store is the production analogue;
    // node's missing global indexedDB exercises the same reject path. The full
    // durable-commit + corrupt-value paths need a real IDB → e2e/playwright.
    expect(typeof globalThis.indexedDB).toBe("undefined");
    await expect(loadOrCreateClaimToken("@nobody")).rejects.toThrow();
  });
});
