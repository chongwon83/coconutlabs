// emailStore/fileStore.ts — EmailStore backed by a JSON file under .data/.
//
// Local-dev implementation (no account, no network), mirroring burnStore's
// FileBurnStore: getEmailStore() picks this when no Upstash env vars are set.
// Vercel's filesystem is ephemeral/per-instance, so this is NOT used in prod.
//
// SECURITY: persists ONLY the EmailSubscription projection — never the raw
// request body. The route validates email + consent before this layer is hit.

import { promises as fs } from "node:fs";
import path from "node:path";
import { withLock, atomicWriteJson } from "@/lib/server/atomic";
import { normalizeEmail } from "@/lib/email";
import type { EmailStore, EmailSubscription } from "@/lib/server/emailStore/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const EMAILS_PATH = path.join(DATA_DIR, "emails.json");

// Read the JSON array. A missing or corrupt file yields [] rather than throwing
// — first boot or a hand-deleted .data/ must not 500.
async function readAll(): Promise<EmailSubscription[]> {
  try {
    const raw = await fs.readFile(EMAILS_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EmailSubscription[]) : [];
  } catch {
    return [];
  }
}

// Explicit field-by-field projection: guarantees only the declared
// EmailSubscription fields are persisted, never an extra property that rode in
// on the object. Email is stored normalized so dedupe is casing-insensitive.
function project(sub: EmailSubscription): EmailSubscription {
  return {
    email: normalizeEmail(sub.email),
    handle: sub.handle ?? null,
    source: sub.source,
    subscribedAt: sub.subscribedAt,
  };
}

export class FileEmailStore implements EmailStore {
  async addEmail(sub: EmailSubscription): Promise<void> {
    const row = project(sub);
    await withLock(EMAILS_PATH, async () => {
      const prev = await readAll();
      if (prev.some((p) => normalizeEmail(p.email) === row.email)) return; // dedupe
      await atomicWriteJson(EMAILS_PATH, [...prev, row]);
    });
  }

  async hasEmail(email: string): Promise<boolean> {
    const key = normalizeEmail(email);
    const all = await readAll();
    return all.some((p) => normalizeEmail(p.email) === key);
  }
}
