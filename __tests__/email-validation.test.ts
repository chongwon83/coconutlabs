// email-validation.test.ts — isValidEmail / normalizeEmail edge cases.
//
// isValidEmail is the SINGLE shared check imported by both the client opt-in UI
// and the server /api/emails endpoint (server is authoritative). This file pins
// its accept/reject boundary so the two sides can never silently diverge.

import { describe, it, expect } from "vitest";
import { isValidEmail, normalizeEmail } from "@/lib/email";

describe("isValidEmail — accepts plausible addresses", () => {
  it.each([
    "user@example.com",
    "a.b+tag@sub.domain.io",
    "name_surname@company.co.uk",
    "  spaces@trimmed.dev  ", // trimmed before testing
    "UPPER@CASE.COM",
  ])("accepts %j", (value) => {
    expect(isValidEmail(value)).toBe(true);
  });
});

describe("isValidEmail — rejects malformed / unsafe input", () => {
  it.each([
    ["", "empty string"],
    ["   ", "whitespace only"],
    ["plainaddress", "no @"],
    ["@no-local.com", "missing local part"],
    ["no-domain@", "missing domain"],
    ["no-tld@domain", "no dot / TLD"],
    ["short@tld.x", "1-char TLD"],
    ["spaces in@email.com", "internal whitespace"],
    ["two@@at.com", "double @"],
  ])("rejects %j (%s)", ([value]) => {
    expect(isValidEmail(value)).toBe(false);
  });

  it("rejects an address longer than 254 chars", () => {
    const local = "a".repeat(250);
    expect(isValidEmail(`${local}@ex.com`)).toBe(false);
  });

  it.each([null, undefined, 42, {}, [], true])(
    "rejects non-string input %j",
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );
});

describe("normalizeEmail — canonical dedupe key", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("is idempotent", () => {
    const once = normalizeEmail("User@Example.com");
    expect(normalizeEmail(once)).toBe(once);
  });

  it("collapses casing/whitespace variants to one key", () => {
    const variants = ["a@b.com", "A@B.com", " a@b.COM ", "A@B.COM"];
    const keys = new Set(variants.map(normalizeEmail));
    expect(keys.size).toBe(1);
  });
});
