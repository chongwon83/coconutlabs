// burn-handles.test.ts — IndexedDB-backed handle persistence (smoke + guards).
//
// SCOPE NOTE: handles.ts uses the BROWSER IndexedDB API. vitest runs with
// `environment: "node"` and we don't ship fake-indexeddb as a devDep, so this
// file deliberately does NOT exercise the full round-trip. Instead it locks
// in three things that don't require IndexedDB:
//
//   1. The public surface is exactly { saveHandle, loadHandle, ensurePermission }
//      with the expected arity.
//   2. ensurePermission's graceful-denial path: a handle that lacks
//      queryPermission (older browsers or non-FSA mock objects) MUST resolve
//      to "denied" rather than throwing — that's how the UI keeps working
//      when the API is partially supported.
//   3. ensurePermission returns "granted" when queryPermission already says
//      so (no requestPermission call needed).
//
// Full IndexedDB round-trip coverage is an e2e/playwright concern — leaving
// a TODO marker rather than smuggling a node shim that diverges from the
// browser semantics.

import { describe, it, expect, vi } from "vitest";
import {
  saveHandle,
  loadHandle,
  ensurePermission,
} from "@/lib/client/burn/handles";

describe("handles — public surface", () => {
  it("exports the three documented functions", () => {
    expect(typeof saveHandle).toBe("function");
    expect(typeof loadHandle).toBe("function");
    expect(typeof ensurePermission).toBe("function");
  });

  it("saveHandle has arity 2 (kind, handle)", () => {
    expect(saveHandle.length).toBe(2);
  });

  it("loadHandle has arity 1 (kind)", () => {
    expect(loadHandle.length).toBe(1);
  });

  it("ensurePermission has arity 1 (handle)", () => {
    expect(ensurePermission.length).toBe(1);
  });
});

describe("ensurePermission — graceful-denial path (queryPermission absent)", () => {
  it("returns 'denied' when the handle has no queryPermission method", async () => {
    const fakeHandle = {
      kind: "directory",
      name: "projects",
      // No queryPermission / requestPermission — older lib.dom or non-FSA mock.
    } as unknown as FileSystemDirectoryHandle;

    const result = await ensurePermission(fakeHandle);
    expect(result).toBe("denied");
  });

  it("does not throw when handle is a minimal object lacking FSA methods", async () => {
    // An accidental null-ish handle would surface as a thrown error in a
    // looser implementation. The spec says we resolve to "denied" instead.
    const minimal = { kind: "directory", name: "projects" };
    await expect(
      ensurePermission(minimal as unknown as FileSystemDirectoryHandle),
    ).resolves.toBe("denied");
  });
});

describe("ensurePermission — already-granted shortcut", () => {
  it("returns 'granted' without calling requestPermission when query says granted", async () => {
    const requestSpy = vi.fn(async () => "granted" as const);
    const querySpy = vi.fn(async () => "granted" as const);
    const handle = {
      kind: "directory",
      name: "projects",
      queryPermission: querySpy,
      requestPermission: requestSpy,
    } as unknown as FileSystemDirectoryHandle;

    const result = await ensurePermission(handle);
    expect(result).toBe("granted");
    expect(querySpy).toHaveBeenCalledOnce();
    expect(querySpy).toHaveBeenCalledWith({ mode: "read" });
    // Shortcut: never escalates to requestPermission when already granted.
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("falls through to requestPermission when query says 'prompt' and user grants", async () => {
    const handle = {
      kind: "directory",
      name: "projects",
      queryPermission: vi.fn(async () => "prompt" as PermissionState),
      requestPermission: vi.fn(async () => "granted" as PermissionState),
    } as unknown as FileSystemDirectoryHandle;
    const result = await ensurePermission(handle);
    expect(result).toBe("granted");
  });

  it("returns 'denied' when query=prompt and user refuses requestPermission", async () => {
    const handle = {
      kind: "directory",
      name: "projects",
      queryPermission: vi.fn(async () => "prompt" as PermissionState),
      requestPermission: vi.fn(async () => "denied" as PermissionState),
    } as unknown as FileSystemDirectoryHandle;
    const result = await ensurePermission(handle);
    expect(result).toBe("denied");
  });

  it("returns 'denied' when query=prompt and requestPermission is absent", async () => {
    const handle = {
      kind: "directory",
      name: "projects",
      queryPermission: vi.fn(async () => "prompt" as PermissionState),
      // requestPermission missing — older browser
    } as unknown as FileSystemDirectoryHandle;
    const result = await ensurePermission(handle);
    expect(result).toBe("denied");
  });
});

// TODO: saveHandle/loadHandle IndexedDB round-trip requires fake-indexeddb
// (devDep) or a playwright browser env. Leave that to the e2e suite — adding a
// node shim here would diverge from browser semantics (the very thing the
// happy-path test should be guarding).
