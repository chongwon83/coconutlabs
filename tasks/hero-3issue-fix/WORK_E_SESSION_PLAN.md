# Work E — 2-Session Split Plan

**작성일**: 2026-05-27
**Owner**: chongwon83 (scw0526)
**Trigger**: 이전 owner 세션 컨텍스트 과부하 → codex(`codex:codex-rescue`) 자문 후 2분할 채택
**원본 plan**: `~/.claude/plans/tasks-hero-3issue-fix-session-handoff-m-jaunty-eagle.md` (전체 8 step 절차)
**원본 cycle handoff**: `web/tasks/hero-3issue-fix/SESSION_HANDOFF.md` §3 "Work E"

---

## 0. 왜 2분할인가 (codex verdict 요약)

원본 plan 8 step을 그대로 한 세션에 몰아 실행하면 owner 컨텍스트가 verify·합성 단계에서 고갈됨 (이미 이전 세션에서 발생). codex(`codex:codex-rescue`) 자문 결과:

- **2분할 (a) 채택** — 인계 누락 / invariant drift / GO·BLOCK 무시 모두 2/5로 가장 낮음
- 3분할·5분할은 backup path·prefix variant·absent-target abort 조건이 중간 세션에서 누락될 위험 3~5/5
- 병렬 agent team 부적합 — 4 handle 순차 실행이 "4 target 외 HDEL 금지" 검증을 더 강하게 함
- `/codex` verdict는 세션 경계의 **hard artifact** — 세션 B는 verdict 부재·BLOCK·target mismatch·backup mismatch 중 하나라도 있으면 fail-closed

---

## 1. Session 분할 매핑

| Session | Steps | 산출물 | 종료 조건 |
|---------|-------|--------|-----------|
| **A** | Step 2 (backup) + Step 3 (dry-run × 4) + Step 4 (`/codex` pre-apply gate) | `work-e-backup-{TS}/` 폴더 + `work-e-handoff-packet.md` 완성 | codex verdict 확정 (GO 또는 BLOCK) + handoff packet 11개 슬롯 모두 채움 |
| **B** | Step 5 (apply × 4) + Step 6 (triple verify) + Step 7 (SESSION_HANDOFF.md §11) + Step 8 (decision-log, 선택) | Redis production 4 handle 제거 + verify 통과 + handoff doc 완료 마킹 | Triple verify 통과 + handoff packet의 verdict가 GO 였을 때만 |

---

## 2. Invariants (양 세션 공통, 절대 위반 금지)

1. **`@chongwon83` row 보존** — leaderboard에서 절대 건드리지 않음
2. **4개 target handle 외 어떤 handle도 HDEL 호출 금지** — 명시 4건만:
   - `contract-1779201784594-month`
   - `contract-1779201784594-dedup`
   - `contract-1779201784594-trend`
   - `contract-1779201784594-single`
   - (handle name에 `@` prefix 있는지는 Session A backup이 dynamic 탐지)
3. **backup 없이 --apply 금지** — Session B는 backup 폴더 존재 + manifest SHA-256 일치 검증 후 진입
4. **codex BLOCK 시 --apply 금지** — Session B는 `codex_verdict == "GO"` 일 때만 진행. BLOCK·부재·문자열 불일치는 모두 fail-closed

---

## 3. 환경 사전 조건 (양 세션 공통)

- 작업 디렉토리: `/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web`
- env 파일: `web/.env.local.prod` (이미 존재, owner가 plaintext paste 완료. 작업 종료 후 삭제)
- 재사용 destructive 스크립트: `web/scripts/cleanup-test-handle.mjs` (291줄, 수정 금지)
  - HDEL: `cleanup-test-handle.mjs:224`
  - DEL: `cleanup-test-handle.mjs:231`
  - LREM: `cleanup-test-handle.mjs:255` (JSON.stringify 7 field 순서 byte-identical)
  - HANDLE_RE: `cleanup-test-handle.mjs:46` — `^@[a-zA-Z0-9_-]+$` (⚠️ `@` prefix 필수!)
  - `KNOWN_TEST_HANDLES`에 `@coconut-verify-bot`만 등재 → 본 작업 4 handle은 모두 `--force` 필요

---

## 4. Session A — Entry Brief (새 세션 진입 시 owner 입력용)

새 Claude 세션 열고 다음 prompt 그대로 붙여넣기:

```
@web/tasks/hero-3issue-fix/WORK_E_SESSION_PLAN.md §4-§5 진입.
Work E Session A 시작 — backup 스크립트 작성 + dry-run + /codex pre-apply 게이트.
완료 조건: §5 handoff packet의 11개 슬롯 모두 채워 web/tasks/hero-3issue-fix/work-e-handoff-packet.md로 저장.
```

### Session A 작업 순서

**A-1. Backup 스크립트 작성** (`web/tasks/hero-3issue-fix/scripts/work-e-backup.mjs`)

책임:
1. `--env-file <path>` arg로 env 로드 (또는 process.env 직접 읽기. dotenv 미사용 — `Redis.fromEnv()` 패턴 위해 `process.env` 직접 set)
2. `Redis.fromEnv()` 사용 (lib/server/burnStore/index.ts 패턴 동일)
3. **Handle prefix dynamic detection**:
   - 먼저 `HGETALL burn:leaderboard` 1회 호출
   - 4 target base name(`contract-1779201784594-{month,dedup,trend,single}`)에 대해:
     - `contract-...` (no prefix) 필드 존재 OR `@contract-...` (with prefix) 필드 존재 확인
     - 둘 다 부재 시 → **abort + manifest에 abort 사유 기록**
     - 둘 중 하나만 존재 → 그 형식을 "detected handle"로 채택
4. `HGETALL burn:hist:<detected-handle>` × 4 (없으면 빈 객체로 기록, abort 아님)
5. `LRANGE burn:challenges 0 -1` → 전체 덤프
6. SHA-256 hash all output files in `manifest.json`
7. 출력 폴더: `web/tasks/hero-3issue-fix/work-e-backup-{ISO-timestamp-safe}/`
   - 파일: `leaderboard.json` + `hist-<detected-handle>.json` × 4 + `challenges.json` + `manifest.json`
8. stdout에 다음 라인 출력 (Session A 진행자가 handoff packet에 복사):
   - `BACKUP_DIR=...`
   - `BACKUP_TS=...`
   - `MANIFEST_SHA256=<sha256 of manifest.json>`
   - `DETECTED_HANDLES=<4 lines, 1 per handle, 형식: target_name=detected_form>` (예: `contract-1779201784594-month=@contract-1779201784594-month`)
   - `ABORT_REASON=<empty or text>`

**Abort 트리거**: 4 target 중 1개라도 leaderboard 부재 → 즉시 abort, manifest에 사유, owner 보고

**A-2. Backup 실행**

```bash
cd "/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web"
node tasks/hero-3issue-fix/scripts/work-e-backup.mjs --env-file .env.local.prod
```

stdout 라인을 §5 handoff packet 슬롯 1-5에 기록.

**A-3. Dry-run × 4 (--apply 없이)**

각 detected handle에 대해:

```bash
node scripts/cleanup-test-handle.mjs --handle "<detected-handle>" --force 2>&1 \
  | tee "tasks/hero-3issue-fix/work-e-backup-${BACKUP_TS}/dryrun-${target_name}.log"
```

각 로그에서 다음 확인:
- BEFORE 섹션에 PRESENT 표시
- plan 섹션에 "(will remove 1 field)" 또는 "(will remove N weekKey(s))" 또는 "(will remove N row(s))" 표시
- `[dry-run]` 마커 (실제 write 안 일어남)

`[noop]` 표시되면 abort (handle 부재 = backup이 빠뜨림). 4 로그 경로를 §5 packet 슬롯 6에 기록.

**A-4. /codex pre-apply 게이트**

`codex:codex-rescue` 서브에이전트 발동. 다음 prompt:

```
[ADVISORY MODE — pre-apply destructive op review, NO file writes, NO bash]

## 컨텍스트
Coconut Labs Work E Step 4 — production Upstash Redis 4 handle destructive 삭제 직전 게이트.

## 검토 대상
- Plan: ~/.claude/plans/tasks-hero-3issue-fix-session-handoff-m-jaunty-eagle.md
- Backup manifest: web/tasks/hero-3issue-fix/work-e-backup-{TS}/manifest.json
- Backup files (6개): leaderboard.json + hist-*.json × 4 + challenges.json
- Dry-run logs (4개): web/tasks/hero-3issue-fix/work-e-backup-{TS}/dryrun-*.log
- Cleanup script: web/scripts/cleanup-test-handle.mjs (수정 금지, 291줄)

## 질문 (4축)
1. 4 handle 외 부수 삭제 위험 — cleanup-test-handle.mjs가 다른 handle 건드릴 path 있나?
2. @chongwon83 데이터 무결성 위협 — backup leaderboard.json에 @chongwon83 entry 보존됐나, dry-run plan에 등장하나?
3. Cache/aggregate key 누락 — leaderboard + hist + challenges 외에 burn:* 키스페이스에 4 handle 흔적 남는 곳 있나?
4. Script crash 중간 실패 → partial-delete 위험 — handle별 sequential 실행이 partial state 복구 가능한가?

## Verdict 요구
"GO" / "BLOCK + 구체 사유". 200~400단어. 코드/파일 작성 금지.
```

codex 응답에서 verdict 문자열(`GO` 또는 `BLOCK`) + timestamp + 핵심 사유 1줄을 §5 packet 슬롯 7-9에 기록.

**A-5. Handoff packet 저장**

§5 템플릿 그대로 채워 `web/tasks/hero-3issue-fix/work-e-handoff-packet.md`로 저장. Session A 종료.

---

## 5. Handoff Packet Template

Session A가 채워 `web/tasks/hero-3issue-fix/work-e-handoff-packet.md`로 저장하는 11-slot artifact. Session B는 시작 시 이 파일을 읽고 11개 슬롯 모두 검증 통과 시에만 진행.

```markdown
# Work E Handoff Packet (Session A → Session B)

**Generated**: <ISO-8601 timestamp, Session A 완료 시각>
**Session A duration**: <분>

## Slot 1: Backup Directory
BACKUP_DIR=web/tasks/hero-3issue-fix/work-e-backup-<TS>/

## Slot 2: Backup Timestamp
BACKUP_TS=<ISO-safe TS, 예: 20260527T103000>

## Slot 3: Manifest SHA-256
MANIFEST_SHA256=<64-char hex>

## Slot 4: Env File Path
ENV_FILE=web/.env.local.prod

## Slot 5: Detected Target Handles
DETECTED_HANDLES:
- contract-1779201784594-month=<actual form e.g. @contract-... or contract-...>
- contract-1779201784594-dedup=<actual form>
- contract-1779201784594-trend=<actual form>
- contract-1779201784594-single=<actual form>

## Slot 6: Dry-Run Log Paths (4개)
DRYRUN_LOGS:
- web/tasks/hero-3issue-fix/work-e-backup-<TS>/dryrun-contract-1779201784594-month.log
- web/tasks/hero-3issue-fix/work-e-backup-<TS>/dryrun-contract-1779201784594-dedup.log
- web/tasks/hero-3issue-fix/work-e-backup-<TS>/dryrun-contract-1779201784594-trend.log
- web/tasks/hero-3issue-fix/work-e-backup-<TS>/dryrun-contract-1779201784594-single.log

각 로그가 "(will remove 1 field)" 표시 확인: yes/no

## Slot 7: /codex Verdict
CODEX_VERDICT=<exact one of: GO | BLOCK>

## Slot 8: /codex Verdict Timestamp
CODEX_VERDICT_TS=<ISO-8601>

## Slot 9: /codex Verdict Rationale (1줄 요약)
CODEX_RATIONALE=<core reason>

## Slot 10: @chongwon83 Preservation Check
CHONGWON83_IN_BACKUP=<yes/no — leaderboard.json에 @chongwon83 field 존재 확인>
CHONGWON83_IN_DRYRUN=<yes/no — 4 dry-run log 중 어디에도 @chongwon83 등장 안 함 확인. "no" 가 정상>

## Slot 11: Apply Authorization
APPLY_AUTHORIZED=<true | false>
판정 규칙: CODEX_VERDICT == "GO" AND CHONGWON83_IN_BACKUP == "yes" AND CHONGWON83_IN_DRYRUN == "no" AND DRYRUN_LOGS 4개 모두 "will remove 1 field" 표시 → true. 그 외 → false.
```

---

## 6. Session B — Entry Brief (handoff packet 확인 후)

새 Claude 세션 열고 다음 prompt 그대로 붙여넣기:

```
@web/tasks/hero-3issue-fix/WORK_E_SESSION_PLAN.md §6-§7 진입.
@web/tasks/hero-3issue-fix/work-e-handoff-packet.md 검증 후 Session B 시작 — apply + triple verify + handoff doc 마킹.
완료 조건: handoff packet의 APPLY_AUTHORIZED=true 일 때만 진행. Triple verify 통과 후 SESSION_HANDOFF.md §11 추가.
```

### Session B 작업 순서

**B-0. Pre-flight 검증** (fail-closed)

handoff packet 11개 슬롯 모두 읽고:
1. `APPLY_AUTHORIZED == "true"` 확인 → 아니면 **즉시 중단 + owner 보고**
2. `BACKUP_DIR` 폴더 존재 확인 → `manifest.json`의 SHA-256 재계산 → `MANIFEST_SHA256`과 일치 확인
3. `CODEX_VERDICT == "GO"` literal 확인
4. backup 폴더 내 `leaderboard.json`에서 `@chongwon83` field 재확인
5. 4 dry-run log 재읽기 → "will remove 1 field" 모두 확인

위 5개 중 1개라도 실패 → **fail-closed 중단** (Plan invariant #3, #4 보존).

**B-1. Apply × 4 (sequential, NOT parallel)**

각 detected handle에 대해 (병렬 금지 — partial-failure 검증 보존):

```bash
node scripts/cleanup-test-handle.mjs --handle "<detected-handle>" --apply --force 2>&1 \
  | tee "tasks/hero-3issue-fix/work-e-backup-${BACKUP_TS}/apply-${target_name}.log"
```

각 실행 후:
- exit code 0 확인
- `[ok] handle "<H>" fully purged.` 라인 확인
- 실패 시 → **중단 + owner 보고 + restore.mjs 수동 실행 옵션 제시** (자동 rollback 금지)

**B-2. Triple post-verify**

(a) **Redis 직접 readback**:
```bash
node -e "
import('@upstash/redis').then(async ({Redis}) => {
  process.env.UPSTASH_REDIS_REST_URL = '<from .env.local.prod>';
  process.env.UPSTASH_REDIS_REST_TOKEN = '<from .env.local.prod>';
  const r = Redis.fromEnv();
  const lb = await r.hgetall('burn:leaderboard');
  console.log('LB fields:', Object.keys(lb || {}));
  // @chongwon83 단독 확인. 4 target 부재 확인.
})"
```

(b) **Production HTTP 확인**:
- Claude in Chrome으로 `https://www.coconutlabs.xyz/#burn` 접속
- 새로고침 → leaderboard 1행 (`@chongwon83`)
- Hero stats: builders=1, totalTokens≈2.6B, AI spend ≈ $3,767
- §7 handoff fingerprint 7-row grid와 대조 (단 contract row 4건 부재가 의도된 변화)
- 주의: PII filter 회피 위해 "tokens" 키워드 직접 검색 금지 (TIL `claude-in-chrome-pii-filter-tokens-keyword`)

(c) **Diff vs handoff §7**:
- 변경 zero이거나 "4 contract test row 사라짐"으로 설명 가능
- 그 외 차이 발견 → 중단 + owner 보고

**B-3. SESSION_HANDOFF.md §11 추가**

`web/tasks/hero-3issue-fix/SESSION_HANDOFF.md` 끝에 `## 11. Work E 완료` 섹션 추가:
- timestamp
- 4 handle 제거 확인 (detected handle form 명시)
- backup 폴더 경로 (90일 보관)
- codex verdict reference (`work-e-handoff-packet.md` slot 7-9)
- triple verify 결과 (3/3 통과)
- §3 헤더에 "✅ COMPLETED 2026-05-27" 마킹

**B-4. (선택) Decision-log entry**

`web/docs/decision/decision-log.md` 또는 글로벌 decision log에 1엔트리:
- destructive production op + owner Claude authorization + 2-session split + codex pre-apply gate 패턴 기록

**B-5. Cleanup**

- `.env.local.prod` 삭제 (`rm`)
- backup 폴더는 90일 후 archive (handoff §11에 기록)

---

## 7. 운영 가이드 (양 세션 owner용)

### 새 세션 진입 시 minimal context
- 이 파일 (`WORK_E_SESSION_PLAN.md`) — self-contained brief
- 원본 plan은 reference만 (전체 절차는 본 파일이 모두 포함)
- 원본 cycle handoff는 reference만 (§7 fingerprint만 verify 시 필요)

### Owner 검수 게이트
- Session A 종료 시: handoff packet 11개 슬롯 owner 1분 시각 확인
- Session B B-0 통과 시: APPLY_AUTHORIZED 라인 owner 확인 후 B-1 진입
- Session B B-2 triple verify: owner가 (b) production HTTP 확인 직접 실행

### Fail-closed 원칙
- Session A에서 backup abort → owner 보고, plan 재작성
- Session A codex BLOCK → handoff packet `APPLY_AUTHORIZED=false` 저장, Session B 진입 시 즉시 중단
- Session B B-0 검증 실패 → 어떤 슬롯이 실패했는지 owner 보고, Session A 재실행 고려

### 분할이 보존하는 것 (codex 핵심 권고)
- **Codex verdict 우회 불가**: Session B가 packet의 `CODEX_VERDICT` 문자열을 기계적으로 대조 (memory 의존 X)
- **Backup 무결성 우회 불가**: Session B가 manifest SHA-256 재계산
- **Target 우회 불가**: detected handle 형식을 backup이 결정 → cleanup script가 그대로 사용

---

## 8. 변경 파일 추적 (양 세션 합산)

신규 (5종):
1. `web/tasks/hero-3issue-fix/WORK_E_SESSION_PLAN.md` (본 파일)
2. `web/tasks/hero-3issue-fix/scripts/work-e-backup.mjs` (Session A 작성)
3. `web/tasks/hero-3issue-fix/work-e-backup-<TS>/` (Session A 산출 폴더, 6 파일 + manifest)
4. `web/tasks/hero-3issue-fix/work-e-handoff-packet.md` (Session A 산출 artifact)
5. (선택) `web/tasks/hero-3issue-fix/scripts/work-e-restore.mjs` (Session A 작성, 사용은 incident 시)

수정 (1종):
6. `web/tasks/hero-3issue-fix/SESSION_HANDOFF.md` (Session B §11 추가)

재사용 (수정 금지):
7. `web/scripts/cleanup-test-handle.mjs`

삭제 (Session B 종료 시):
8. `web/.env.local.prod`
