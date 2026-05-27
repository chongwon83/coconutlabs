# Work E Handoff Packet (Session A → Session B)

**Generated**: 2026-05-27T01:12:07Z (revised after Option B execution)
**Session A duration**: ~70분 누계 (backup + initial dry-run BLOCK + codex 자문 + Option B 스크립트 + 재dry-run + codex 재자문)
**Session A outcome**: **GO** — APPLY_AUTHORIZED=true. Session B 진입 가능.

> 본 packet은 Option B 실행 후 v2. 초기 v1 (APPLY_AUTHORIZED=false, BLOCK) 이력은 본 파일 끝 "Revision history" 절 참조.

---

## Slot 1: Backup Directory
BACKUP_DIR=web/tasks/hero-3issue-fix/work-e-backup-20260527T005523Z/

## Slot 2: Backup Timestamp
BACKUP_TS=20260527T005523Z

> 재사용 근거: 본 backup의 live 상태가 6분 후 dry-run 시점에 byte-identical (HLEN values match week_counts 0/2/3/1, leaderboard fields identical) — 새 backup 재생성 불필요. 신선도 검증 통과.

## Slot 3: Manifest SHA-256
MANIFEST_SHA256=05af0e1a893d5fdda7544372e374228c10910e98d67d8f17e0a10636b5ab85eb

## Slot 4: Env File Path
ENV_FILE=web/.env.local.prod

## Slot 5: Detected Target Handles
DETECTED_HANDLES:
- contract-1779201784594-month=contract-1779201784594-month  (NO @ prefix as stored)
- contract-1779201784594-dedup=contract-1779201784594-dedup  (NO @ prefix as stored)
- contract-1779201784594-trend=contract-1779201784594-trend  (NO @ prefix as stored)
- contract-1779201784594-single=contract-1779201784594-single  (NO @ prefix as stored)

> 4 target 모두 `@` prefix 없이 저장. v1에서는 이것이 cleanup-test-handle.mjs HANDLE_RE blocker였음. v2에서는 신규 `work-e-purge.mjs`가 hardcoded TARGET_BASE_NAMES로 직접 처리.

## Slot 6: Dry-Run Log Paths

**v2 evidence format**: JSON plan (schema=`work-e-purge-plan/1`) 단일 산출물로 통합.

DRYRUN_LOGS:
- web/tasks/hero-3issue-fix/work-e-backup-20260527T005523Z/dryrun-work-e-purge.log (work-e-purge.mjs 산출)

각 target이 dry-run에서 "planned for HDEL" 표시: **YES (4/4)**

JSON plan 핵심 추출:
```json
{
  "schema": "work-e-purge-plan/1",
  "leaderboard": {
    "total_hdel_planned": 4,
    "fields_preserved": ["@chongwon83"],
    "fields_to_hdel": [
      {"field": "contract-1779201784594-month",  "present_live": true, "backup_present": true},
      {"field": "contract-1779201784594-dedup",  "present_live": true, "backup_present": true},
      {"field": "contract-1779201784594-trend",  "present_live": true, "backup_present": true},
      {"field": "contract-1779201784594-single", "present_live": true, "backup_present": true}
    ]
  },
  "hist_to_del": [
    {"key": "burn:hist:contract-1779201784594-month",  "live_hlen": 0, "backup_week_count": 0},
    {"key": "burn:hist:contract-1779201784594-dedup",  "live_hlen": 2, "backup_week_count": 2},
    {"key": "burn:hist:contract-1779201784594-trend",  "live_hlen": 3, "backup_week_count": 3},
    {"key": "burn:hist:contract-1779201784594-single", "live_hlen": 1, "backup_week_count": 1}
  ],
  "challenges_lrem": {
    "live_match_count": 0,
    "backup_match_count": 0,
    "noop_if_zero_intent": true,
    "will_perform_lrem": false
  },
  "deny_list_assertion": {"defense_in_depth_passed": true, "target_intersection": []},
  "chongwon83_in_leaderboard_before": true,
  "all_planned_hdels_present": true,
  "ready_to_apply": true
}
```

> v1 슬롯 6은 cleanup-test-handle.mjs HANDLE_RE error로 4 dryrun 모두 실패였음. v2는 work-e-purge.mjs JSON plan으로 명시적 "4 fields planned" evidence 산출 — codex 권고 mitigation #5 충족.

## Slot 7: /codex Verdict
CODEX_VERDICT=GO

## Slot 8: /codex Verdict Timestamp
CODEX_VERDICT_TS=2026-05-27T01:11:30Z

## Slot 9: /codex Verdict Rationale (1줄 요약)
CODEX_RATIONALE=Option B closes original HANDLE_RE blocker. work-e-purge.mjs uses hardcoded TARGET_BASE_NAMES (no CLI/env override) and cleanup-test-handle.mjs is unmodified. Dry-run evidence: manifest hash validated, deny-list excludes @chongwon83/chongwon83 from targets, exactly 4 HDELs + 4 hist DELs planned, live state matches backup byte-identical, ready_to_apply=true, after-readback preserves @chongwon83.

## Slot 10: @chongwon83 Preservation Check
CHONGWON83_IN_BACKUP=yes  (leaderboard.json contains "@chongwon83" field; manifest.chongwon83_in_leaderboard=true)
CHONGWON83_IN_DRYRUN_AS_TARGET=no  (JSON plan: deny_list_assertion.target_intersection=[], fields_to_hdel=4 targets, fields_preserved=["@chongwon83"])
CHONGWON83_LIVE_BEFORE=true  (JSON plan: chongwon83_in_leaderboard_before=true)

## Slot 11: Apply Authorization
APPLY_AUTHORIZED=true

**판정 근거** (Slot 11 rule chain):
- CODEX_VERDICT == "GO" → ✅ true
- CHONGWON83_IN_BACKUP == "yes" → ✅ true
- CHONGWON83_IN_DRYRUN_AS_TARGET == "no" → ✅ true (deny-list intersection empty)
- DRYRUN PLAN shows total_hdel_planned == 4 AND all_planned_hdels_present == true AND ready_to_apply == true → ✅ true

판정 규칙 AND chain 모두 충족. Session B 진입 가능.

### Plan Invariants 4종 충족 확인

| INV | 내용 | 충족 근거 |
|-----|------|-----------|
| INV-1 | @chongwon83 보존 | deny-list intersection empty + chongwon83_in_leaderboard_before=true + AFTER-readback assertion (`verifyAfter()`) |
| INV-2 | 4 target만 처리 | TARGET_BASE_NAMES `Object.freeze`, no `--handle` CLI arg, no env override |
| INV-3 | backup required | `--backup-dir` + `--expected-manifest-sha256` 필수, manifest sha256 일치 검증 |
| INV-4 | cleanup-test-handle.mjs unmodified | git diff 0건 (work-e-purge.mjs 신규 작성, 기존 스크립트 무변경) |

### Codex 7항목 Mitigation 충족 확인

| # | Mitigation | 충족 근거 |
|---|-----------|----------|
| 1 | wildcard 금지 | `TARGET_BASE_NAMES = Object.freeze([4 hardcoded names])`, no CLI override |
| 2 | @chongwon83 deny-list | `OWNER_DENY_HANDLES = Object.freeze(["@chongwon83", "chongwon83"])` + intersection check pre-plan |
| 3 | manifest hash assertion | sha256 + schema_version + target_base_names array eq + chongwon83_in_leaderboard=true + abort_reason="" 일치 |
| 4 | before/after invariant | `chongwon83_in_leaderboard_before=true` logged + `verifyAfter()` asserts post-apply preservation, exit 2 on violation |
| 5 | dry-run JSON | schema="work-e-purge-plan/1" stdout output (Slot 6 참조) — "4 fields planned" evidence 명시 |
| 6 | LREM 0건 명시 처리 | `challenges_lrem.noop_if_zero_intent=true`, `will_perform_lrem=false` — explicit audited noop, not silent drift |
| 7 | sequential apply | per-target for-loop: HDEL → DEL (HLEN>0 only). LREM after all targets if matches>0 (currently 0) |

---

## Session B 진입 절차

새 세션에서 다음 brief 입력:

```
@web/tasks/hero-3issue-fix/WORK_E_SESSION_PLAN.md §6 진입. Work E Session B 시작.
Session A handoff packet 확인 (web/tasks/hero-3issue-fix/work-e-handoff-packet.md) — APPLY_AUTHORIZED=true.
B-0 step 1 통과 후 B-1 (apply) → B-2 (AFTER readback) → B-3 (cleanup) 순차 실행.
사용 스크립트: tasks/hero-3issue-fix/scripts/work-e-purge.mjs (NOT cleanup-test-handle.mjs)
Apply 명령: node tasks/hero-3issue-fix/scripts/work-e-purge.mjs --env-file .env.local.prod --backup-dir tasks/hero-3issue-fix/work-e-backup-20260527T005523Z --expected-manifest-sha256 05af0e1a893d5fdda7544372e374228c10910e98d67d8f17e0a10636b5ab85eb --apply --confirm-purge
```

### Session B B-0 precondition checks (handoff packet 재검증)

1. ✅ `APPLY_AUTHORIZED=true` (Slot 11)
2. ✅ `CODEX_VERDICT=GO` (Slot 7)
3. ✅ `MANIFEST_SHA256` matches backup directory manifest.json sha256 — Session B에서 재계산 후 비교 의무
4. ✅ `ENV_FILE=web/.env.local.prod` 존재 확인
5. ✅ `BACKUP_TS=20260527T005523Z` directory 존재 확인

위 5개 중 하나라도 위반 시 Session B 즉시 중단 (fail-closed).

### Session B post-apply 의무 (B-2, B-3)

- AFTER readback: `verifyAfter()` 통과 (@chongwon83 still present, all 4 targets absent, 0 residual challenges)
- exit code 0 확인 (1=precondition fail, 2=corruption detected)
- `.env.local.prod` 삭제
- backup directory는 90일 보관 후 archive

---

## Session A 산출물 목록 (v2 최종)

### 신규 파일
1. `web/tasks/hero-3issue-fix/scripts/work-e-backup.mjs` (~250 LoC) — v1에서 작성, v2에서도 유효
2. `web/tasks/hero-3issue-fix/scripts/work-e-purge.mjs` (~700 LoC) — **v2 핵심 산출물**, Option B 7-mitigation 모두 구현
3. `web/tasks/hero-3issue-fix/work-e-backup-20260527T005523Z/` (13 files):
   - manifest.json + leaderboard.json + challenges.json + 4 hist-*.json (v1)
   - 4 dryrun-contract-*.log (v1, HANDLE_RE error 증거 — 역사적 보존)
   - `dryrun-work-e-purge.log` (**v2 핵심 evidence**, JSON plan)
   - BLOCKER-ANALYSIS.md (v1, Option B 결정 근거 보존)
4. `web/tasks/hero-3issue-fix/work-e-handoff-packet.md` (본 파일, v2 GO)

### 수정 파일
- 없음 (cleanup-test-handle.mjs unmodifiable invariant 준수)

### 삭제 예정 (Session B 종료 후)
- `web/.env.local.prod` (operational hygiene)

---

## Revision history

### v2 (2026-05-27T01:12:07Z, 본 packet)
- Option B 실행 후 재작성
- work-e-purge.mjs dry-run JSON 산출 → codex 재자문 → GO 판정
- APPLY_AUTHORIZED=false → true
- Slot 6 evidence: HANDLE_RE error logs → JSON plan
- Session B 진입 가능

### v1 (2026-05-27T01:03:01Z, archived inline below)
- Initial Session A 결과 BLOCK
- 원인: cleanup-test-handle.mjs HANDLE_RE rejects no-prefix handles
- codex verdict: BLOCK + Option B 권고
- APPLY_AUTHORIZED=false
- Option A/B/C/D owner decision 대기 상태로 lock
- owner 결정: Option B (work-e-purge.mjs 작성)
- 상세: `web/tasks/hero-3issue-fix/work-e-backup-20260527T005523Z/BLOCKER-ANALYSIS.md` 참조
