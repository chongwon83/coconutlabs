"""CoconutLabs usage collector.

Aggregates Claude Code / Codex CLI local session logs into a Burn Summary
envelope (web/tools/usage-poc/burn-summary.schema.json).

SECURITY: only whitelisted numeric token keys, timestamps, and project-path
slugs are read. Path slugs are used solely as salted-hash input and never
emitted. content / message / payload text fields are never read or
serialized. See coconutlabs_project_master_handoff_ko.md §8.
"""
