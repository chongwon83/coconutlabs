// burn-telemetry-privacy.test.ts — Axis 7 telemetry privacy schema tests.
//
// Verifies the telemetry event schema against the privacy invariant defined in
// codex-r4-meta-privacy.md:
//
//  1. All 4 event types produce valid payloads from typed constructors.
//  2. Forbidden fields (path, stack, prompt, error, salt, etc.) are rejected.
//  3. Extra fields beyond the per-event whitelist are rejected.
//  4. session_id must be a 32-char lowercase hex random value (NOT from logs).
//  5. Constructed events contain no forbidden key patterns (network payload
//     simulation — forbidden regex matches nothing in the serialized output).

import { describe, it, expect } from "vitest";
import {
  validateTelemetryEvent,
  makeAutoDetectStartedEvent,
  makeAutoDetectCompletedEvent,
  makeAutoDetectFailedEvent,
  makeSurveyRespondedEvent,
} from "@/lib/client/burn/telemetry";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Builds a minimal valid auto_detect_started event as a plain object.
function validStarted(): Record<string, unknown> {
  return {
    event: "auto_detect_started",
    schemaVersion: 1,
    weekKey: "2026-05-20",
    session_id: "a".repeat(32),
    fsaSupported: true,
  };
}

function validCompleted(): Record<string, unknown> {
  return {
    event: "auto_detect_completed",
    schemaVersion: 1,
    weekKey: "2026-05-20",
    session_id: "b".repeat(32),
    durationBucket: "1-3m",
    result: "upload_accepted",
  };
}

function validFailed(): Record<string, unknown> {
  return {
    event: "auto_detect_failed",
    schemaVersion: 1,
    weekKey: "2026-05-20",
    session_id: "c".repeat(32),
    durationBucket: "3-5m",
    failureCode: "parse_failed",
    failureStage: "parse",
  };
}

function validSurvey(): Record<string, unknown> {
  return {
    event: "survey_responded",
    schemaVersion: 1,
    weekKey: "2026-05-20",
    session_id: "d".repeat(32),
    hardestStep: "terminal_setup",
    setupTimeBucket: "5-10m",
  };
}

// ── Axis 7.1 — all 4 typed constructors produce valid events ─────────────────

describe("typed constructors — produce valid events", () => {
  it("makeAutoDetectStartedEvent passes schema validation", () => {
    const event = makeAutoDetectStartedEvent(true);
    const r = validateTelemetryEvent(event);
    expect(r.ok).toBe(true);
  });

  it("makeAutoDetectCompletedEvent passes schema validation", () => {
    const event = makeAutoDetectCompletedEvent("3-5m", "upload_accepted");
    const r = validateTelemetryEvent(event);
    expect(r.ok).toBe(true);
  });

  it("makeAutoDetectFailedEvent passes schema validation", () => {
    const event = makeAutoDetectFailedEvent("5-10m", "parse_failed", "parse");
    const r = validateTelemetryEvent(event);
    expect(r.ok).toBe(true);
  });

  it("makeSurveyRespondedEvent passes schema validation", () => {
    const event = makeSurveyRespondedEvent("terminal_setup", "10-20m");
    const r = validateTelemetryEvent(event);
    expect(r.ok).toBe(true);
  });
});

// ── Axis 7.2 — all 4 event types validate with plain objects ─────────────────

describe("validateTelemetryEvent — valid event types", () => {
  it("auto_detect_started valid", () => {
    expect(validateTelemetryEvent(validStarted()).ok).toBe(true);
  });
  it("auto_detect_completed valid", () => {
    expect(validateTelemetryEvent(validCompleted()).ok).toBe(true);
  });
  it("auto_detect_failed valid", () => {
    expect(validateTelemetryEvent(validFailed()).ok).toBe(true);
  });
  it("survey_responded valid", () => {
    expect(validateTelemetryEvent(validSurvey()).ok).toBe(true);
  });
});

// ── Axis 7.3 — forbidden fields are rejected ─────────────────────────────────

// The forbidden field list covers the major privacy-sensitive categories from
// codex-r4-meta-privacy.md.

const FORBIDDEN_FIELDS: Record<string, unknown>[] = [
  { content: "user: hello world" },
  { message: "some message" },
  { prompt: "do this task" },
  { response: "here is the answer" },
  { path: "/home/user/.claude/projects" },
  { folderPath: "/Users/user/project" },
  { stack: "Error\n  at parse (/app/parser.ts:42)" },
  { error: "unexpected token" },
  { salt: "deadbeef1234" },
  { projectHashInput: "my-project-slug" },
  { projectSlug: "my-project" },
  { rawLine: '{"type":"assistant",...}' },
  { payload: '{"type":"token_count",...}' },
  { sessionId: "abc123" }, // the SOURCE-tool sessionId, not telemetry session_id
  { metadata: { anything: true } },
  { context: "some context" },
  { extra: {} },
];

describe("validateTelemetryEvent — forbidden fields rejected", () => {
  for (const forbidden of FORBIDDEN_FIELDS) {
    const key = Object.keys(forbidden)[0];
    it(`rejects event with forbidden field "${key}"`, () => {
      const payload = { ...validStarted(), ...forbidden };
      const r = validateTelemetryEvent(payload);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/forbidden|unexpected/i);
    });
  }
});

// ── Axis 7.4 — extra (non-forbidden) fields are rejected ─────────────────────

describe("validateTelemetryEvent — extra fields rejected", () => {
  it("started event with extra unknown field", () => {
    const payload = { ...validStarted(), unknownField: "value" };
    const r = validateTelemetryEvent(payload);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unexpected field/i);
  });

  it("failed event with extra fileCountBucket field (not in schema)", () => {
    const payload = { ...validFailed(), fileCountBucket: "1-10" };
    const r = validateTelemetryEvent(payload);
    expect(r.ok).toBe(false);
  });
});

// ── Axis 7.5 — session_id constraints ────────────────────────────────────────

describe("validateTelemetryEvent — session_id validation", () => {
  it("rejects session_id shorter than 32 chars", () => {
    const payload = { ...validStarted(), session_id: "abc123" };
    const r = validateTelemetryEvent(payload);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("session_id");
  });

  it("rejects session_id with uppercase chars", () => {
    const payload = { ...validStarted(), session_id: "A".repeat(32) };
    const r = validateTelemetryEvent(payload);
    expect(r.ok).toBe(false);
  });

  it("rejects session_id with non-hex chars", () => {
    const payload = { ...validStarted(), session_id: "g".repeat(32) };
    const r = validateTelemetryEvent(payload);
    expect(r.ok).toBe(false);
  });

  it("accepts session_id of exactly 32 lowercase hex chars", () => {
    const payload = { ...validStarted(), session_id: "0123456789abcdef".repeat(2) };
    const r = validateTelemetryEvent(payload);
    expect(r.ok).toBe(true);
  });
});

// ── Axis 7.6 — enum value enforcement ────────────────────────────────────────

describe("validateTelemetryEvent — enum validation", () => {
  it("rejects unknown durationBucket", () => {
    const payload = { ...validCompleted(), durationBucket: "2-4m" };
    expect(validateTelemetryEvent(payload).ok).toBe(false);
  });

  it("rejects unknown failureCode", () => {
    const payload = { ...validFailed(), failureCode: "wifi_disconnected" };
    expect(validateTelemetryEvent(payload).ok).toBe(false);
  });

  it("rejects unknown failureStage", () => {
    const payload = { ...validFailed(), failureStage: "preprocessing" };
    expect(validateTelemetryEvent(payload).ok).toBe(false);
  });

  it("rejects unknown hardestStep", () => {
    const payload = { ...validSurvey(), hardestStep: "writing_code" };
    expect(validateTelemetryEvent(payload).ok).toBe(false);
  });

  it("rejects unknown event type", () => {
    const payload = { ...validStarted(), event: "page_view" };
    expect(validateTelemetryEvent(payload).ok).toBe(false);
  });
});

// ── Axis 7.7 — network payload simulation (forbidden key absence) ─────────────
//
// Simulates what the server would see by serializing a constructed event and
// verifying that no forbidden key regex matches the serialized output.
// This is the analog of the fetch/XHR interception tests in Axis 5.

const FORBIDDEN_KEY_REGEX =
  /\b(content|message|prompt|response|rawLine|payload|path|folderPath|stack|error|exception|salt|projectHashInput|projectSlug|hashPreimage|metadata|context|extra)\b/;

const CONSTRUCTED_EVENTS = [
  makeAutoDetectStartedEvent(true),
  makeAutoDetectCompletedEvent("1-3m", "upload_accepted"),
  makeAutoDetectFailedEvent("3-5m", "parse_failed", "parse"),
  makeSurveyRespondedEvent("terminal_setup", "5-10m"),
];

describe("network payload simulation — forbidden keys absent in serialized events", () => {
  for (const event of CONSTRUCTED_EVENTS) {
    it(`${event.event} serialization contains no forbidden keys`, () => {
      const serialized = JSON.stringify(event);
      expect(serialized).not.toMatch(FORBIDDEN_KEY_REGEX);
    });
  }

  it("SECRET_SENTINEL is never present in any serialized event", () => {
    const SECRET_SENTINEL = "SECRET_SENTINEL_XYZ_2026";
    for (const event of CONSTRUCTED_EVENTS) {
      expect(JSON.stringify(event)).not.toContain(SECRET_SENTINEL);
    }
  });
});

// ── Axis 7.8 — schemaVersion constraints ─────────────────────────────────────

describe("validateTelemetryEvent — schemaVersion enforcement", () => {
  it("rejects schemaVersion: 2", () => {
    const payload = { ...validStarted(), schemaVersion: 2 };
    expect(validateTelemetryEvent(payload).ok).toBe(false);
  });

  it("rejects schemaVersion: '1' (string)", () => {
    const payload = { ...validStarted(), schemaVersion: "1" };
    expect(validateTelemetryEvent(payload).ok).toBe(false);
  });

  it("rejects missing schemaVersion", () => {
    const { schemaVersion: _, ...noVersion } = validStarted() as { schemaVersion: unknown } & Record<string, unknown>;
    expect(validateTelemetryEvent(noVersion).ok).toBe(false);
  });
});
