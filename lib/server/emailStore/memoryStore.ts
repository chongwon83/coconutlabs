// emailStore/memoryStore.ts — EmailStore backed by an in-process Map.
//
// E2E-ONLY implementation, mirroring burnStore's MemoryBurnStore. Selected by
// getEmailStore() when BURN_STORE=memory. State is process-local and lost on
// shutdown; Playwright pins workers: 1 so a single process owns it.
//
// SECURITY: production must NEVER set BURN_STORE=memory — index.ts fails fast
// on that combination.

import { normalizeEmail } from "@/lib/email";
import type { EmailStore, EmailSubscription } from "@/lib/server/emailStore/types";

function project(sub: EmailSubscription): EmailSubscription {
  return {
    email: normalizeEmail(sub.email),
    handle: sub.handle ?? null,
    source: sub.source,
    subscribedAt: sub.subscribedAt,
  };
}

export class MemoryEmailStore implements EmailStore {
  #subs = new Map<string, EmailSubscription>();

  async addEmail(sub: EmailSubscription): Promise<void> {
    const row = project(sub);
    if (this.#subs.has(row.email)) return; // dedupe
    this.#subs.set(row.email, row);
  }

  async hasEmail(email: string): Promise<boolean> {
    return this.#subs.has(normalizeEmail(email));
  }
}
