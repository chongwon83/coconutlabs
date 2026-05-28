# Plan — git commit 기반 VES 분자 (실측 효율 분자)

S0: `docs/decision/decision-log.md` 2026-05-28 [S0] 엔트리. 위험 3축 3/3 → `/codex` 교차 리뷰 의무 + S8 게이트.

## 1. 문제 (요약)

VES = `verifiedFixes ÷ AI cost USD` (`computeVes`, lib/data.ts:298). 분모는 device 실측이나 분자는 self-reported — `triageChallenge` (lib/server/challenge.ts:116-124)가 `claimedFixes ≤ 5`를 무검증 `verified` 마킹. efficiency 포지셔닝 전체가 조작 가능한 분자 위에 있음. 분자를 **local git commit 개수**(device 실측)로 교체한다.

## 2. 확정 결정 (owner)

- **분자 정의 = session 보고 주(week) 동안 해당 프로젝트 repo에서 만든 git commit 개수.**
- **기존 self-reported 데이터 = 0 리셋** — v2 엔트리는 commit 데이터 없음 + challenge join 제거 → `fixes`/`ves` undefined → UI "—" 렌더. v3 CLI 재업로드해야 실측 숫자 부여.

## 3. 핵심 아키텍처 사실 (Explore 매핑 결과)

**`verifiedFixes`는 leaderboard 엔트리에 저장되지 않는다 — read-time join이다.**

- `app/api/burnindex/route.ts` GET(25-49): `readEntries()` + `verifiedFixesByHandle()`(challenge store 합산) + `trendByHandle()`를 join. `card.fixes = verifiedFixes.get(handle)` (line 34-36), `computeVes(fixes, cost)` (line 37).
- challenge store(`burn:challenges` LPUSH list)가 분자의 system of record. leaderboard 엔트리(`burn:leaderboard` HSET)는 cache-like, `fixes` 미저장.

**함의**: 서버는 git 접근 불가 → commit 개수는 반드시 **업로드 envelope를 통해** 들어와야 한다 → `schemaVersion` 2→3. 그리고 envelope에 실린 값이므로 import 시점에 엔트리에 **저장**하고, read 경로는 challenge join 대신 엔트리 자체 값을 쓴다(challenge join 제거 → hot path 단순화).

## 4. 분자 산식 명세

- **단위**: envelope-level 단일 정수 `verifiedCommits` (grandTotal 형제). **per-row 아님** — row는 (tool, model, projectHash)별이라 같은 repo를 Claude+Codex 둘 다 쓰면 row가 분리돼 commit 이중계산됨. repo 단위로 dedupe 후 합산해 envelope 1개 정수로.
- **윈도우**: envelope `periodWindow.{since, until}` (주간, closed-open [since, until)). 별도 per-session window 불필요 — 리더보드는 `period="week"`만 허용(route 게이트).
- **repo 정규화**: 각 projectHash의 `cwd`를 `git rev-parse --show-toplevel`로 canonical repo root 변환 → repo root로 dedupe(Claude/Codex 같은 repo면 1회만).
- **계산**: repo별 `git log --since=<since> --until=<until> [--author=<me>] --pretty=%H | sort -u | wc -l`, distinct SHA 합산.
- **누출 0**: `cwd`/repo root/SHA/author email은 device 메모리에만 — 업로드는 정수 1개. salt/hash 불변.

## 5. 변경 파일 목록 + 의존 순서

### A. CLI (Python) — 분자 수집
1. `tools/usage-poc/coconut_collector/parsers.py`
   - `SessionParse` (85-104)에 `cwd: str | None` 추가 (메모리 전용, NEVER emit).
   - `parse_claude` (152-197): message-type line에서 `cwd` 추출(257행 중 211행에 원본 절대경로 보존 — 실측 확인). slug는 hash용 유지.
   - `parse_codex` (200-249): 이미 `payload["cwd"]` 보유 → SessionParse.cwd에 전달.
2. `tools/usage-poc/coconut_collector/` 신규 `gitcount.py` (또는 collect.py 내 함수)
   - `count_commits(cwd, since, until, author) -> int`: subprocess git log, repo 아니면/실패면 0, distinct SHA.
   - repo root dedupe 헬퍼.
3. `tools/usage-poc/coconut_collector/collect.py`
   - `collect()` (165): projectHash→cwd 매핑 수집.
   - `build_envelope()` (184-): repo 단위 commit 합산 → envelope-level `verifiedCommits` emit. `schemaVersion` "2"→"3" (184, 237, 255).

### B. 스키마 계약 — v2→v3
4. `tools/usage-poc/burn-summary.schema.json` — top-level `verifiedCommits` (integer ≥0) 추가, `schemaVersion` const 3, `additionalProperties:false` 유지.
5. `lib/data.ts`
   - `BurnSummaryEnvelope` (243-249): `schemaVersion: "3"`, `verifiedCommits: number` 추가.
   - `ImportedEntry` (267-293): `fixes?`/`ves?` 의미 변경(commit 유래) — 주석 갱신(현 262-266 "challenge join" 설명 교체).
   - `computeVes` (298-301): param 이름 `verifiedCommits`로(semantic), 로직 동일.
6. `lib/validateSummary.ts`
   - `ENVELOPE_KEYS` (23-25)에 `verifiedCommits` 추가.
   - schemaVersion 체크 (162-168): "2" reject, "3" require로 이동(v2 정중히 reject 메시지).
   - top-level `verifiedCommits` integer≥0 validator(`isIntAtLeastZero` 66-68 재사용).
7. `lib/client/burn/collect.ts` (381, 488): client assembler `schemaVersion "3"` + `verifiedCommits` 조립.

### C. 서버 — 저장 + read 경로
8. `lib/server/burnStore/redisStore.ts`
   - `projectEntry()` (79-100): import 시 envelope `verifiedCommits` → 엔트리 `fixes` 저장(+ `ves` precompute 또는 read에서). lazy migration: v2 엔트리 `fixes` 없으면 undefined.
9. `app/api/burnindex/route.ts`
   - POST (51-111): v3 envelope에서 `verifiedCommits` 추출 → 엔트리에 반영.
   - GET (25-49): `verifiedFixesByHandle()` join **제거**, `card.fixes = entry.fixes`(저장값) 직접 사용, `computeVes(entry.fixes, cost)`. trend join은 유지.

### D. challenge flow 처분 — **A+ decommission** (codex 교차 리뷰 합의, 2026-05-28)
코드 제거는 지금, Redis 데이터 삭제는 v3 배포 검증 후 owner 단독으로 분리 → 롤백 윈도우 1회 보존.
10. `app/api/burnindex/route.ts` GET — `verifiedFixesByHandle()` import + join 제거(route.ts:17, 27, 34-38).
11. `lib/server/challenge.ts` — 제거. `triageChallenge`/`TRIAGE_THRESHOLD=5`는 중립 dead code가 아니라 "나쁜 신뢰 결정 그 자체"라 존치 불가.
12. `app/api/challenge/route.ts` — 제거. **unauthenticated/public**이며 upload의 `verifyAndConsumeToken` 미공유(auth 안전, codex 확인) → 존치 시 `burn:challenges`를 계속 채우는 오해 유발 write surface.
13. `components/...ChallengeInviteForm` — `/api/challenge` POST 잔존. SHOW_LEGACY ON 시 깨지지 않게 **hard-disable/제거**(codex 발견 coupling).
14. store/테스트 참조 정리: `store-contract-check.mjs`, `burn-server-memorystore`, `burn-server-whitelist`, `burn-route-token-integration.test.ts`, `burn-api-period-gate.test.ts`, challenge owner scripts.
15. `burn:challenges` Redis 데이터 — orphaned. **같은 배포에서 `DEL` 금지**. v3 검증 + 백업 후 owner 콘솔 단독 정리(production 파괴 prohibited).

> **(c) repurpose-as-override 기각 이유** (codex): 기존 challenge primitive는 public + unauthenticated + self-reported + "fixes" 의미 결합 → override의 잘못된 그릇. 향후 보정이 필요하면 **새 owner-only 인증 경로**(`commitOverride`/`overrideReason`/`overrideBy`/`overrideAt`)를 별도 신설, `ChallengeRecord` 재사용 금지.

### E. UI 카피
12. `components/BurnIndexSection.tsx` — section-note "VES = verified fixes ÷ AI cost (USD)" → "verified commits". `fixes` 컬럼 헤더 → "commits". (정렬은 별도 — S0가 sort flip을 폐기했으므로 default sort 변경은 OOS, 분자 정직해진 후 별도 사이클.)
13. `components/Hero.tsx` — ProductShot challenge 탭은 `SHOW_LEGACY` 게이트라 영향 최소. "verified fixes" 문구 있으면 교체.

### F. 테스트
14. `__tests__/burn-schema.test.ts` (14-69) — v3 fixture, `verifiedCommits` 필드, additionalProperties.
15. `__tests__/burn-import-flow.test.ts`, `burn-route-token-integration.test.ts`, `burn-api-period-gate.test.ts`, `data-builders.test.ts` — v2 fixture → v3 + 신규 필드.
16. `e2e/upload-success-card.spec.ts`, `onboarding-30s.spec.ts` (29, 20) — v3 fixture.
17. `tools/usage-poc/tests/test_collector.py` (372-384) — schemaVersion "3", `verifiedCommits` assertion + git count 단위 테스트(tmp repo fixture).
18. **신규**: `computeVes` 단위 테스트(현재 없음 — 분자가 load-bearing해졌으니 추가), gitcount 단위 테스트.

## 6. S4 review 결정 대기 (sub-decisions)

- **a. author 필터**: `--author=<git config user.email>`로 본인 commit만 vs repo 전체 commit. 권장: **author 필터**(정직, solo 친화, email 미업로드). 멀티 contributor repo 과대계산 방지.
- **b. challenge flow 처분 → 해결됨**: **A+ decommission** (codex 합의). 코드 제거 now + Redis 삭제 defer. 상세 §5.D. S4에서 최종 승인만.
- **c. Goodhart cap**: commit 분할 게이밍 방어. v1 = **cap 없음**(owner가 commit-count 채택), net-lines/squash-detect를 v2 업그레이드 경로로 문서화. 선택: 일 soft cap.

## 7. Invariants (S3.5 Design Phase에서 확정)

- **Privacy**: `cwd`/repo root/SHA/author email NEVER 업로드 — 정수 1개만. salt 0600 불변. `additionalProperties:false` 유지.
- **결정성**: 같은 repo+윈도우+author → 항상 같은 count(git log 결정적).
- **하위호환**: v2 엔트리는 `fixes` undefined로 hydrate → "—". v2 envelope 업로드는 정중히 reject("schemaVersion must be '3'") + CLI 업그레이드 안내.
- **도메인 일관성**: 분자 산식은 gitcount 모듈 단일 책임(I/O 어댑터, 도메인 1:1 강제 예외).

## 8. 검증 계획

- Python: `pytest tools/usage-poc/tests -q` (collector + gitcount, tmp git repo fixture).
- TS unit: `vitest run` (schema v3, computeVes, validateSummary v2 reject).
- E2E: `playwright test` (upload-success, onboarding v3 fixture).
- Linux smoke 1회(preflight invariant 변경 시).
- `/codex` 교차 리뷰(의무): schema v3 migration, 분자 결정성, privacy invariant, Goodhart.
- Claude-in-Chrome: localhost에서 v3 업로드 → 카드 commit/VES 렌더 확인.

## 9. 롤백

- **git revert + 재배포**가 1차 안전장치: challenge.ts/route 제거 커밋을 revert하면 GET join + v2 수용 복원.
- **`burn:challenges` Redis 미삭제**(§5.D-15)가 롤백 윈도우 보장 — revert 후 join이 옛 데이터를 즉시 다시 읽음. 검증 완료 전까지 `DEL` 금지.
- Redis 엔트리는 append-only(import가 덮어쓰기), v2 엔트리 `fixes` undefined로 hydrate(하위호환) → 롤백 시 손실 0.
