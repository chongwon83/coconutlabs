# Next Cycle: 안전망 점검 + 환경 정리 + Playwright e2e

**작성일**: 2026-05-21 (burn-import 사이클 종료 직후)
**Owner**: chongwon83 (solo)
**대상 세션**: 다음 세션 (cold start)
**참조 회고**: `docs/decision/decision-log.md` 2026-05-21 엔트리 / `.context/retros/2026-05-21-1.json`
**현재 HEAD**: `3ab54f8` (main, 프로덕션 200 OK 검증 완료)

---

## Context

지난 사이클(2026-05-14 ~ 2026-05-21)에 burn-import 9-field whitelist 하드닝 + 코덱스 교차 리뷰
+ S10 회고까지 완료. retro 액션 아이템 중 다음 3개를 묶어서 다음 사이클 시작 작업으로 처리.

**우선 순서가 중요한 이유**:
- #2를 먼저 해야 #1 e2e 추가해도 안전망(rollout-gate)이 실제로 돌아가는 게 확인됨
- #3은 매 세션 시작 시 `UPGRADE_AVAILABLE` 노이즈 제거 — 5분 투자, 다음 모든 세션 정리
- #1이 본 작업 (1h+) — 위 둘 끝낸 깨끗한 상태에서 시작

**예상 총 소요**: 75~90분 (1세션 분량)

---

## Phase #2 — 프로덕션 rollout-gate 헬스 체크 (10분, MED)

**목적**: 7-axis production rollout gate가 실제로 돌아가는지 확인. 안 돌면 의미 없는 안전망.

### 산출물
- 이번 작업에서 변경하는 코드 없음 — **확인만**.
- 결과를 verification-report 또는 새 1줄 메모로 기록.

### 실행 절차

```bash
# 1. 워크플로우 파일 확인 (트리거 조건)
cat .github/workflows/production-rollout-gate.yml | head -40

# 2. 직전 run 상태 확인
gh run list --workflow=production-rollout-gate.yml --limit 5 --json status,conclusion,headBranch,headSha,createdAt,displayTitle

# 3. 가장 최근 run 상세 (실패면 로그)
LATEST=$(gh run list --workflow=production-rollout-gate.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run view $LATEST

# 4. 7개 axis 각각 PASS 여부 (workflow가 jobs를 axis별로 분리해 뒀는지 확인)
gh run view $LATEST --json jobs -q '.jobs[] | {name, conclusion}'
```

### 통과 조건 (3개 중 1개라도 미달이면 다음 페이즈로 진행하지 말 것)
1. 워크플로우가 main push에 트리거되도록 설정돼 있는가? (`on: push: branches: [main]` 또는 cron)
2. 최근 5개 run 중 최소 1개는 conclusion=success인가?
3. 모든 7-axis job이 정의돼 있는가? (workflow yml에서 카운트)

### 미통과 시 액션
- 트리거 누락 → workflow yml에 `on:` 추가 commit + PR
- 직전 run 실패 → 실패 로그 분석 후 fix 또는 owner 콜백
- axis 정의 누락 → 해당 axis job 추가 PR (별도 plan 필요시)

---

## Phase #3 — gstack 1.40.0.0 → 1.41.1.0 업그레이드 (5분, LOW)

**목적**: 매 세션 시작 시 `UPGRADE_AVAILABLE` 노이즈 제거.

### 실행 절차

```bash
# 1. 현재 버전 확인
~/.claude/skills/gstack/bin/gstack-update-check

# 2. 업그레이드 (gstack 표준 절차 — SKILL.md 참조)
# 옵션 A: 자동 업그레이드 스크립트가 있으면
~/.claude/skills/gstack/bin/gstack-self-upgrade 2>/dev/null || \
  echo "자동 업그레이드 없음 → 수동 절차로 진행"

# 옵션 B (수동): gstack 디렉토리에서 git pull
cd ~/.claude/skills/gstack && git pull --ff-only && cd -

# 3. 업그레이드 후 검증
~/.claude/skills/gstack/bin/gstack-update-check
# → "UPGRADE_AVAILABLE" 메시지 사라져야 함
```

### 통과 조건
- 다음 세션 preamble에서 `UPGRADE_AVAILABLE` 메시지 미출력
- gstack 스킬 정상 동작 (`/retro --help` 또는 임의 read-only 스킬 실행)

### 미통과 시
- 자동/수동 모두 실패 → gstack repo issue로 보고, 본 plan에서 #3 제외하고 #1 진행
- 코드 변경 없음 → commit 불필요

---

## Phase #1 — Playwright e2e: FSA 픽커 해피패스 + 거부 트랜스크립트 (60~75분, HIGH)

**목적**: retro 액션 "test ratio ≥ 20% 목표" 달성. 현재 11.2% → e2e 1 spec 추가로 약 15~18%로 상승.
12/12 PASS 수동 Chrome 검증을 자동화로 승격하면 다음 contract 변경 시 회귀 비용 0.

### 의존성 상태 (확인됨, 2026-05-21)
- `@playwright/test ^1.60.0` ✅ devDep
- `playwright ^1.60.0` ✅ devDep
- `playwright.config.ts` ❌ 없음 (신규 생성 필요)
- `e2e/` 디렉토리 ❌ 없음 (신규 생성 필요)
- CI 워크플로우 통합 ❌ 없음 (`ci.yml` 수정 필요)

### 신규 생성 파일

```
playwright.config.ts                                    # config
e2e/burn-import-fsa-picker.spec.ts                       # 1 happy path + 1 rejection
e2e/fixtures/test-claude-projects/                        # 폴더명 = 'projects' (수락 케이스)
e2e/fixtures/test-claude-projects/proj-a/session-2026-05-21.jsonl  # 가짜 세션 1개
e2e/fixtures/test-random-folder/                          # 폴더명 = 'random-folder' (거부 케이스)
```

### 수정 파일

```
.github/workflows/ci.yml             # e2e job 추가
package.json                         # "test:e2e" script + 가능하면 "test:all"
.gitignore                           # /test-results/, /playwright-report/, /.playwright-cache/
```

### Spec 작성 핵심 검증 (반드시 포함)

1. **해피패스**:
   - `e2e/fixtures/test-claude-projects/`를 picker에 전달
   - F8 9-field 행 1개 이상 envelope에 잡힘
   - rowTotalTokens 합산이 grandTotal과 일치
   - leaderboard에 핸들이 표시됨
2. **거부 트랜스크립트**:
   - `e2e/fixtures/test-random-folder/`를 picker에 전달
   - 거부 메시지가 노출됨 (`.name`이 `projects`/`sessions`로 끝나야 한다는 명시)
   - envelope 전송 0건 (network mock 또는 store readback으로 확인)
3. **9-field 위반 패닉 (음성 케이스)**:
   - 임의 prompt/rawContent 필드가 절대 envelope에 누출되지 않음을 stringify 결과 grep으로 검증

### 실행 절차

```bash
# 1. Playwright config 생성
npx playwright install --with-deps chromium  # 헤드리스 실행 환경 준비

# 2. config 작성 (아래 골격 참조)
# 3. fixture 작성 (~/.claude/projects/ 또는 ~/.codex/sessions/ 패턴 따라하기)
# 4. spec 작성
# 5. 로컬 실행
npx playwright test

# 6. dev server 띄우고 실행 (config의 webServer 항목 활용)
# package.json: "test:e2e": "playwright test"
npm run test:e2e

# 7. 리포트 확인 (실패 시)
npx playwright show-report
```

### `playwright.config.ts` 골격

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,        // FSA 픽커는 single tab 가정
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                  // burn-import는 leaderboard 공유 상태 의존
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

### CI 통합 (`.github/workflows/ci.yml` 추가 job)

```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### 통과 조건 (Review Harness 3종)
1. **테스트 결과**: `npx playwright test` → 모든 spec PASS
2. **평가기준 통과 표**:
   - ✅ 해피패스 envelope 9-field만 포함 (rawContent/prompt 0건)
   - ✅ 거부 트랜스크립트 정확 출력
   - ✅ test ratio 측정 (vitest LOC + e2e LOC) / 전체 LOC ≥ 15% (목표 20% 미달이면 다음 사이클 추가)
   - ✅ CI에서 e2e job 통과
3. **미통과 사유 + 액션**: 실패한 spec별 원인 + 후속 수정

### 보안 가드 (필수 준수)
- e2e fixture에 실제 API 키/실제 세션 파일 절대 포함 금지
- `~/.coconutlabs/salt` 경로 mock 또는 임시 디렉토리 사용
- Upstash REST token은 e2e env에서 빈 값 또는 메모리 store로 분기 (`getStore()` 팩토리 분기 활용)
- 프로덕션 leaderboard에 e2e 테스트 entry 절대 쓰지 말 것 — `cleanup-test-handle.mjs` 다시 돌릴 일 만들지 말 것

### 위험 3축 평가 (코덱스 교차 리뷰 발동 임계)
- 실패비용 ②: e2e가 false negative면 다음 contract 변경 시 회귀 → 충족
- 영향범위 ③: e2e/ + ci.yml + package.json + .gitignore → 충족
- 관찰가능성 ①: CI에서 즉시 검출 → 미충족
- **2/3 충족 → 코덱스 교차 리뷰 강력 권장** (PR 머지 전 `/codex` 1회 호출)

### PR 분할 (retro 액션 #1 적용)
이번에는 단일 PR로 가지만, 다음 빅뱅 PR이 생길 것 같으면 다음으로 분할:
- (a) config + fixture (인프라)
- (b) spec 작성 (테스트 본문)
- (c) CI 통합 (워크플로우)
지금은 합쳐도 3 모듈 × 작은 LOC라 단일 PR OK.

---

## 전체 검증 (end-to-end)

```bash
cd web

# Phase 2 결과 메모
gh run list --workflow=production-rollout-gate.yml --limit 3

# Phase 3 결과 메모
~/.claude/skills/gstack/bin/gstack-update-check

# Phase 1 로컬 검증
npm run typecheck && npm test && npm run test:e2e

# Phase 1 PR 생성
git checkout -b feat/playwright-e2e-fsa-picker
git push -u origin feat/playwright-e2e-fsa-picker
gh pr create --title "test(e2e): Playwright — FSA 픽커 해피패스 + 거부 트랜스크립트"

# (선택) 코덱스 교차 리뷰
# /codex 발동 → P2 이상 캐치 시 fix-up commit 후 재push
```

---

## Critical Files

**Phase 2 (수정 없음, 읽기만)**:
- `.github/workflows/production-rollout-gate.yml`

**Phase 3 (수정 없음)**:
- `~/.claude/skills/gstack/` (외부 디렉토리, 본 repo 영향 없음)

**Phase 1 신규**:
- `playwright.config.ts`
- `e2e/burn-import-fsa-picker.spec.ts`
- `e2e/fixtures/test-claude-projects/proj-a/session-2026-05-21.jsonl`
- `e2e/fixtures/test-random-folder/.keep`

**Phase 1 수정**:
- `.github/workflows/ci.yml` (e2e job 추가)
- `package.json` (`"test:e2e"` script 추가)
- `.gitignore` (`/test-results/`, `/playwright-report/`, `/.playwright-cache/`)

**참조 (수정 없음)**:
- `components/forms/JoinBurnIndexForm.tsx:62-66` (FSA 픽커 거부 로직 source)
- `lib/client/burn/collect.ts` (buildEnvelope)
- `lib/validateSummary.ts` (9-field validator)
- `lib/server/burnStore/index.ts` (getStore 팩토리 분기 — e2e에서 memoryStore 분기 활용)
- `__tests__/burn-server-whitelist.test.ts` (9-field VALID_ROW 상수 — fixture 작성 참고)
- `tasks/coconut-burn-import/handoff.md` §4 (12개 verification criteria)
- `tasks/coconut-burn-import/verification-report.md` (직전 12/12 PASS 증거)

---

## 재사용 자산

- **9-field 상수**: `__tests__/burn-server-whitelist.test.ts`의 `VALID_ENVELOPE` / `VALID_ROW` 그대로 import
- **거부 메시지 문자열**: `JoinBurnIndexForm.tsx`에서 grep해서 동일 문자열로 assertion
- **메모리 store 분기**: `lib/server/burnStore/index.ts` `getStore()` env 미설정 시 fileStore 분기 → e2e에서 `BURN_STORE=memory` env 추가하면 격리 가능 (또는 신규 분기 추가)

---

## 완료 기준 (Review Harness)

- ✅ Phase 2: rollout-gate workflow ON + 최근 run conclusion=success (기록만 남기면 PASS, 수정 시 별도 PR)
- ✅ Phase 3: 다음 세션 preamble에 `UPGRADE_AVAILABLE` 없음
- ✅ Phase 1: `npm run test:e2e` 로컬 PASS + CI e2e job PASS + PR 머지 + 프로덕션 회귀 없음
- ✅ test ratio: 측정 결과 ≥ 15% (20% 미달이면 다음 사이클 추가 spec plan 작성)
- ✅ 코덱스 교차 리뷰 1회 (Phase 1만 해당, P2 이상 0 또는 fix-up 머지)

---

## 다음 세션 진입 명령

```
이 plan 읽고 Phase #2 → #3 → #1 순서로 진행해.
docs/plans/next-cycle-hygiene-and-e2e.md
```
