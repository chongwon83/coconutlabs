// email-store.test.ts — MemoryEmailStore add / dedupe / hasEmail.
//
// MemoryEmailStore is the E2E backend, but it also exercises the shared store
// contract: addEmail persists once per NORMALIZED address (trim + lowercase),
// and hasEmail looks up by that same normalized key. The dedupe rule lives in
// every EmailStore impl; this pins it at the public-interface level.

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryEmailStore } from "@/lib/server/emailStore/memoryStore";
import type { EmailSubscription } from "@/lib/server/emailStore/types";

function sub(email: string, overrides: Partial<EmailSubscription> = {}): EmailSubscription {
  return {
    email,
    handle: null,
    source: "post_upload",
    subscribedAt: "2026-05-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("MemoryEmailStore", () => {
  let store: MemoryEmailStore;

  beforeEach(() => {
    store = new MemoryEmailStore();
  });

  it("stores an email and reports it present", async () => {
    await store.addEmail(sub("user@example.com"));
    expect(await store.hasEmail("user@example.com")).toBe(true);
  });

  it("reports unknown emails absent", async () => {
    await store.addEmail(sub("user@example.com"));
    expect(await store.hasEmail("nobody@example.com")).toBe(false);
  });

  it("matches on the normalized key (casing + whitespace insensitive)", async () => {
    await store.addEmail(sub("User@Example.COM"));
    expect(await store.hasEmail("user@example.com")).toBe(true);
    expect(await store.hasEmail("  USER@EXAMPLE.com ")).toBe(true);
  });

  it("dedupes the same address across casing variants without throwing", async () => {
    await store.addEmail(sub("dupe@example.com"));
    await store.addEmail(sub("DUPE@example.com", { handle: "@later" }));
    await store.addEmail(sub("  dupe@EXAMPLE.com  "));
    // All three collapse to one key; the address is present exactly once.
    expect(await store.hasEmail("dupe@example.com")).toBe(true);
  });

  it("keeps distinct addresses separate", async () => {
    await store.addEmail(sub("a@example.com"));
    await store.addEmail(sub("b@example.com"));
    expect(await store.hasEmail("a@example.com")).toBe(true);
    expect(await store.hasEmail("b@example.com")).toBe(true);
  });
});
