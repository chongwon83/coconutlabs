// atomic.ts — concurrency primitives shared by the JSON file stores.
//
// The stores do read-modify-write (read the whole file, mutate, write back).
// Two concurrent requests would each read the same old state and the second
// write would silently drop the first ("lost update"). withLock serializes
// the WHOLE read-modify-write per key so that cannot happen within this
// process. (Multi-instance writers still need a real DB — see design.md.)
//
// atomicWriteJson also gives every write a UNIQUE tmp filename: a fixed
// `<file>.tmp` shared by two in-flight writes lets one rename steal the
// other's tmp, causing ENOENT or a torn file.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const chains = new Map<string, Promise<unknown>>();

// Serialize fn against any other withLock call sharing the same key. Each key
// keeps a promise chain; a new call appends to the tail and awaits it.
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  // Keep the chain alive even if fn rejects, but never leak the rejection.
  chains.set(key, run.then(() => undefined, () => undefined));
  return run;
}

// Write JSON to a unique sibling tmp file, then rename over the target. A
// crash mid-write leaves the previous good file intact; the unique tmp name
// keeps concurrent writers from clobbering each other's tmp.
export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf-8");
    await fs.rename(tmp, filePath);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}
