# Decision Log

이 문서는 프로젝트의 설계 결정과 맥락을 기록한다.
S0에서 작성, S10에서 회고 2줄 추가.

## 엔트리 포맷

### YYYY-MM-DD [기능/결정 이름]
- 문제:
- 버린 대안:
- 핵심 트레이드오프:
- 선택 이유:
- 강한 증거(직접 겪음/유사 사례):

[S10 완료 후 추가]
- 무엇이 잘 됐나:
- 다음엔 무엇을 바꿀까:

---

### 2026-05-24 Burn Index leaderboard 9 → 5 컬럼 축소 + inline tier chip

- 문제: 챌린지 UI 제거 후 Fixes/VES는 import에서 항상 0 (challenge store 닫
  힘), Sparkline은 trendSeries 미주입 시 LCG 가짜 폴백, Verification 컬럼은
  업로드 경로 하드코딩으로 4-union 중 2종만 산출. 9컬럼 중 3컬럼이 stale
  data 가리킴. 정보 밀도 < 차지하는 컬럼 폭.
- 버린 대안: (a) Fixes/VES 백엔드까지 제거 — BurnIndexPanel·API·storage가
  의존, 다른 컴포넌트 깨짐 / (b) Verification 컬럼 유지 — 라벨 4종 중 2종만
  나와도 정보가치 없음 / (c) Sparkline LCG fallback 유지 — 시각 노이즈 +
  의미 없음 / (d) 라이트 fast-path로 처리 — 3축 위험 2/3(영향범위 +
  관찰가능성) 충족이라 검증 분리 의무.
- 핵심 트레이드오프: 백엔드 데이터 모델(V3_BUILDERS.fixes/ves,
  computeVes, VerifLevel 4-union literals)은 storage·API 계약이라 0줄 수정
  강제. UI 렌더에서만 빼서 wire format ↔ display label separation 패턴 적용.
  visual baseline 3 PNG 새로 잡아야 함 (maxDiffPixelRatio 0.02 한도 초과
  예상) → workflow_dispatch rebaseline 1회.
- 선택 이유: 5컬럼(`# | Builder | Tokens | Cost | Trend`)이 정보 밀도 ↔
  컬럼 폭 균형점. Imported 핸들 셀에 inline tier chip(✓/~/· + label)로
  WCAG color-not-alone 보존, Task D 3계층 섹션 헤더는 메인 그리드에서 유지.
  Codex C-1 hardening: `verifTierShort()` 입력 타입을 `VerifLevel`로 좁히고
  `verifTier()` 결과를 derive해 새 union 추가 시 컴파일 차단.
- 강한 증거: 6620c19 refactor + 90165e6 codex C-1 hardening + CI run
  26363202448 visual baseline 생성 → 기존 commit 6620c19 baseline과 md5
  3/3 일치(`08e928…`, `6ce1c6…`, `79c85d…`) 확인 → PR #16 3 job(test 34s/
  e2e/visual) ✅ → squash merge `7c4ee6a`. Codex review blocking 0건,
  Low 1건(C-1) 반영, False positive 1건(--warning #B45309 amber-700 —
  codex가 #D97706로 오인식, contrast 5.0:1 AA 통과) 문서화.

- 무엇이 잘 됐나: S3.5 design.md gate(인터페이스/데이터흐름/파일경계/불변조건
  4섹션)가 S6 진입 차단 게이트로 작동 → BurnIndexSection 9→5 변경 시 lib/
  data.ts·validateSummary.ts 무수정 invariant이 owner+codex 양쪽에서 자동
  점검됨. Codex가 wire format(VerifLevel 4-union)과 display label(3-tier)
  분리 안 깨졌는지 1차 검증 = 인간 owner 1패스로 못 잡을 영역. CI baseline
  preservation(md5 match)으로 추가 rebaseline 사이클 1개 절감.
- 다음엔 무엇을 바꿀까: design.md 4섹션에 "백엔드 0줄 수정 매트릭스"
  필드를 추가해서 보존 대상 파일을 명시적 인벤토리로 굳히자(이번엔 plan
  표로만 적시했는데, S6 중 1회 owner가 "lib/server/도 안 건드린다고
  했나?" 재확인 필요했음). 또 codex review 결과의 False positive 1건(L1
  --warning 색상)을 unverified.md에 1줄 spot check로 남기는 패턴을 표준
  화 — Phase 2 Q4 권장과 정합.

---

### 2026-05-24 Track 4 — Playwright visual regression baseline lock (3 viewport × CI Linux PNG)

- 문제: 2026-05-23 DOM invariant gate(`hero-fold.spec.ts` 9 tests)는 layout/
  display는 잡지만 색·간격·typography/font raster·hero-right ProductShot 침범
  같은 시각 회귀를 못 잡음. mobile-375 above-fold 침범과 desktop sticky-header
  nav wrap을 PR 머지 전 자동 차단할 deterministic gate가 필요. 매 deploy 전
  owner 수동 검수 부담 + 야간/주말 자동 머지 시 회귀 탐지 불가.
- 버린 대안: (a) DOM invariant gate 확장(boundingBox 비교만)으로 시각 검출
  대체 — typography/색 회귀를 영원히 못 잡음 / (b) 로컬 macOS PNG baseline
  commit — first-green-baseline 안티패턴 + Linux CI raster diff로 100%
  false positive / (c) Percy/Chromatic SaaS — 솔로 프로젝트에 비용/계정
  오버헤드 과대 / (d) dev mode baseline — Turbopack content hash가 매 run
  drift, 결정성 0.
- 핵심 트레이드오프: baseline이 잘못 잡히면 "잘못된 상태가 정상으로 굳음"
  (Risk 3축 ① 충족). 복구는 `git revert` + 재캡처. maxDiffPixelRatio 0.02
  (codex 권장 시작값)로 시작해 6주 운영 후 0.01로 강화 검토. 동적 데이터
  (VES/spend 카운트)는 `[data-mask="dynamic"]` mask로 통과, 본질 변경은 차단.
- 선택 이유: `next build && next start` prod mode + CI Linux artifact baseline
  + dedicated `playwright.config.visual.ts` 분리로 dev/prod 모드 conflation
  제거. 3 step(A: config+8 invariants / B: 18 testid attach / C: baseline
  lock + `visual-baseline-lock.yml` workflow_dispatch rebaseline 절차)으로
  쪼개 각 step Codex 적대적 검토 1회씩 총 3회 통과. CI permanent guard
  (`ci.yml` visual job)로 향후 PR 시각 회귀 자동 차단.
- 강한 증거: 첫 CI Linux baseline 생성(run `26346826095`, artifact 다운로드
  → `e2e/visual.spec.ts-snapshots/*-chromium-linux.png` 3개 commit `ff34678`)
  → comparison mode CI run `26346958195` visual job ✅ 1m12s pass. INV-2
  regression(`Inter Fallback`/`JetBrains Mono Fallback` status=`error`)
  발견 → next/font 메트릭 매칭 Fallback FontFace는 `src` descriptor 없어
  CI Linux에서 by-design `error` 상태(`fix` commit `df380f4`로 ` Fallback$`
  family 제외) → CI run `26347081198` 3 job 모두 ✅ (test 34s / visual 59s
  / e2e 86s). R1-R9 9/9 통과.

[S10 회고]
- 무엇이 잘 됐나: A/B/C 3 step 분리 후 각 step Codex 사전 적대적 검토 1회씩
  (총 3회) 의무화한 게 정답. C-0 검토에서 "macOS local PNG commit 금지, CI
  Linux artifact만 commit" 단호하게 lock한 덕에 first-green-baseline 함정
  100% 회피. dedicated `playwright.config.visual.ts` + `testIgnore: []`로
  base config의 `testIgnore: /visual\.spec\.ts/` 상속 끊어 dev/prod 모드
  conflation 제거한 것도 결정적. workflow_dispatch rebaseline workflow를
  C-6에서 폐기하지 않고 영구 보존한 덕에 향후 폰트 업그레이드/의도된 layout
  변경 시 동일 절차(dispatch → artifact → commit) 반복 가능.
- 다음엔 무엇을 바꿀까: ① Step A `10회 dry-run flake 검증`이 INV-2 next/font
  Fallback `error` 상태를 못 잡음 — 로컬 macOS 환경에서만 검증해서 CI Linux
  font subsystem 차이를 놓침. 다음 cycle부터 preflight 신규 invariant는
  `act` 또는 임시 CI workflow_dispatch로 Linux runner에서 1회 smoke 의무.
  ② maxDiffPixelRatio 0.02 → 0.01 강화 timing은 6주 운영 false-positive
  카운트(`gh run list --workflow=CI --jq '[.[]|select(.conclusion=="failure")
  ]|length'`) 기반 결정. ③ 시각 invariant axis 분리 원칙 유지 — layout/font
  baseline은 visual.spec.ts, color/typography token regression은 별도 axis
  (DESIGN.md lint 또는 vitest snapshot)로 분리해 통합 spec 금지.

---

### 2026-05-23 Above-fold + Sticky-header DOM invariant gate (Playwright, screenshot baseline deferred)

- 문제: HYBRID lock 3 invariants(mobile 375 fold=H+sub+CTA / cta_bottom≤640 /
  hero-right hidden ≤920px) + sticky-header nav wrap·overlap 0건은 모두 CSS
  driven layout이라 vitest 단위 테스트로 검출 불가. "Drops"→"Workflow Drops"
  14자 변경 + display:none 조건이 3번 사이클에 걸쳐 silent drift됐던 영역.
- 버린 대안: (a) Playwright `toHaveScreenshot` baseline lock — codex Track 4
  검토에서 "Linux CI vs macOS local font raster 차이가 first-green-baseline
  안티패턴의 가장 큰 진입로"로 지적 / (b) 단위 컴포넌트 테스트 — CSS @media
  query 적용 후 actual `display` value를 못 봄 / (c) E2E를 prod build로
  돌려서 `next dev`와 분리 — DOM gate는 dev/prod 양쪽에서 결정적이므로 불필요
- 핵심 트레이드오프: DOM gate만 lock하면 색·간격·typography 회귀를 못 잡지만,
  HYBRID lock의 3 invariants는 모두 `display`/`boundingBox.height`/horizontal
  rect 비교로 충분 검증 가능. baseline screenshot은 Linux Chromium font 환경
  lock 후 next cycle에서 추가.
- 선택 이유: 영구 invariant 3개를 다음 사이클에 미루지 말고 즉시 deterministic
  gate로 lock(`e2e/hero-fold.spec.ts` 9 tests, ~9s). codex 6 corrections 반영
  — fonts.ready/animation disable global(addInitScript) / 920 boundary 포함 /
  nav-link rect/lineHeight 비교 폐기(`.nav-link` padding 6px 12px가
  rect=lineHeight+12px로 false positive) → `scrollWidth ≤ clientWidth` +
  nav-container right vs CTA left gap ≥ -1px.
- 강한 증거: Track 1 실측 cta_bottom=467.19 → 임계 640까지 173px 헤드룸.
  9 tests 첫 실행 100% pass(current main HEAD). Next 16 official Playwright
  docs `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`
  L136-138 "production code로 돌리라" 권고는 screenshot baseline용이고 DOM
  invariant gate에는 적용 안 됨(dev server에서도 동일 결과). 기존 ci.yml e2e
  job L51 `npx playwright test`(필터 없음)이 본 spec 자동 픽업.

[S10 회고]
- 무엇이 잘 됐나: codex Track 4 사전 검토에서 "first-green-baseline 안티패턴"
  지적 → screenshot baseline을 다음 사이클로 미루고 DOM invariant gate만 단독
  lock한 판단이 정확. nav-link wrap 검출 시 `rectHeight > lineHeight*1.25`
  heuristic을 폐기하고 `scrollWidth ≤ clientWidth`로 단순화한 것도 codex 6
  corrections 중 false-positive 회피의 핵심. 9 tests 첫 실행 100% pass + ci.yml
  무수정 auto-pickup으로 추가 운영 비용 0.
- 다음엔 무엇을 바꿀까: screenshot baseline은 Linux Chromium font 환경을 CI에서
  먼저 lock한 뒤 다음 cycle에 추가(현 cycle에서 무리하게 합치면 font raster diff
  flake가 누적). hero-secondary-card 동적 카운트(VES/spend)는 baseline 도입 시
  `mask` 의무. DOM gate는 invariant 3개에 한정 — typography/color 회귀는 별도
  axis로 분리(통합 spec 금지).

---

### 2026-05-23 Turbopack root 상위 디렉토리 지정 (symlink guard 적용)

- 문제: web-landing-mvp-4/node_modules가 sister web/로의 symlink. Next.js 16
  Turbopack이 filesystem root 밖 symlink를 거부 (FATAL panic
  `Symlink invalid, it points out of the filesystem root`). dev/build 전면 차단.
- 버린 대안: (a) node_modules symlink 제거 + 로컬 npm install — sister 동기화
  추적 부담 / (b) `next dev --webpack` fallback — Next 16 신기능 못 씀
- 핵심 트레이드오프: `turbopack.root: path.join(__dirname, "..")` 상위 지정 시
  filesystem watching perimeter 확장 (Next docs cache miss 증가 경고) vs
  symlink 유지로 sister 디렉토리 동기화 이점 보존.
- 선택 이유: codex 적대적 검토에서 "dependency ownership drift" 지적 →
  `fs.lstatSync().isSymbolicLink()` guard로 symlink 일 때만 옵션 적용. CI
  환경(npm ci로 실재 node_modules 설치)에서는 자동 no-op. AGENTS.md 의무 read 후
  official docs L113-120 패턴 차용.
- 강한 증거: Next.js 16 release notes `turbopack.root` 옵션 공식 등재. 4축
  검증 — 라우트 `200 OK` / `.hero-headline` 렌더 / Playwright 1.60.0 가용 /
  `Ready in 282ms` (FATAL 0건).

[S10 회고]
- 무엇이 잘 됐나: codex 적대적 검토에서 "dependency ownership drift" 지적을
  받자마자 `fs.lstatSync().isSymbolicLink()` guard로 conditional 적용한 패턴이
  로컬 sister-symlink ↔ CI npm-ci 환경 양쪽에서 자동 분기 작동. AGENTS.md "NOT
  the Next.js you know" 의무 read를 우회하지 않고 Next 16 official docs 패턴을
  그대로 차용해 추측 0건. Track 0 decision-log entry를 사이클 종료까지 보류하지
  않고 즉시 작성한 codex 비판 #7 반영도 후속 Track의 컨텍스트 손실 차단에 기여.
- 다음엔 무엇을 바꿀까: monorepo `pnpm`/`turborepo` 정식 도입 시 sister-symlink
  workaround는 폐기 대상 — turbopack.root 상위 지정 자체가 cache miss 증가
  trade-off라 영구 해법 아님. CI 환경에서 `next build` 실측이 본 cycle에 누락
  (Track 0-7 미완료 위험으로 기록만) → 다음 사이클 의무 추가. Next 16 minor
  업그레이드 시 `turbopack.root` API 변경 가능성을 release notes diff로 체크.

---

### 2026-05-18 usage PoC — 단가표 확장 + estimate_cost.py

- 문제: `estimate_cost.py`가 cost를 추정하려면 전 모델 단가표가 필요한데, 초기
  `model-pricing.json`은 claude 3행·codex 1행 + PoC 추정치라 대부분 `_default`
  fallback(`price_confidence: low`)으로 떨어지고 Opus 단가가 3배 과대였다.
- 버린 대안: 와일드카드 키(`claude-opus-4-x`) — minor 버전별 단가가 갈려
  (Opus 4.7~4.5=$5 vs 4.1~4.0=$15) 잘못된 단가를 적용하게 됨.
- 핵심 트레이드오프: minor 버전 단위 명시 키 30행 = 유지보수 부담 ↑ vs 정확도.
- 선택 이유: 정확도 우선. `match_model` longest-prefix가 minor 키를 정확 분기.
- 강한 증거: `/codex` 교차 리뷰가 pro 모델 cached_input 오류를 실제로 검출.
  공식 페이지 + 제3자 2사이트 교차검증으로 30행 전수 확인.

- 무엇이 잘 됐나: "정말 확실하냐" 압박에 거짓 확신 대신 live WebFetch 재검증.
  `/codex` 교차 리뷰가 실 결함 1건(pro cached 할인 오적용) 검출.
- 다음엔 무엇을 바꿀까: 신규 트랙 시작 시 S0(decision-log)·Pre-S0(vault) 게이트를
  거를 것. 단가표는 `_pricing_as_of` 기준 분기별 재검증 필요 — 일정화.

---

### 2026-05-19 usage PoC — 전 세션 누적 집계 (`--all`)

- 문제: `estimate_cost.py`가 단일 세션만 추정. 사용자 전체 토큰/비용을 보려면
  세션 로그를 수동으로 일일이 합산해야 했다.
- 버린 대안: 외부 합산 스크립트 별도 작성 — `parse_claude`/`parse_codex` 파싱
  로직이 중복되고 단가 매칭도 재구현해야 함.
- 핵심 트레이드오프: `estimate_cost.py` 비대화(+117줄) vs 단일 진입점 일관성.
- 선택 이유: 기존 파서·`match_model`·`cost_breakdown` 전부 재사용 → 코드 중복 0.
  `find_logs` + `aggregate_sessions`만 신규.
- 강한 증거: `--all` 실행 중 `<synthetic>` 그룹이 318M 토큰/$287를 `_default`
  단가로 오분류한 것을 직접 발견. 단일 세션 테스트로는 안 보이던
  last-seen-model 미스어트리뷰션 버그를 누적 집계가 노출시킴.

- 무엇이 잘 됐나: 누적 집계가 미스어트리뷰션 버그를 표면화. 구조 점검
  (`<synthetic>` 28라인 = 0토큰 확인)으로 추측 아닌 증거 기반 수정.
- 다음엔 무엇을 바꿀까: `parse_claude`는 세션당 단일 모델을 가정(파일 전체를
  마지막 비-synthetic 모델로 합산). 한 세션이 모델을 바꾸면 여전히 한 모델로
  몰림 — 알려진 한계. 정확도 필요 시 라인 단위 모델 귀속으로 전환.

---

### 2026-05-19 collector S8 검증 — Codex 교차 리뷰 P2-4 잔여 이견

- 문제: `parsers.py`의 `ValueError(f"...{path.name}")` 예외 메시지에 파일명이
  들어가는 것을 Codex가 "경로 노출 유출 경로 후보"(P2-4)로 지적.
- 버린 대안: 예외 메시지에서 `path.name`을 완전 제거 — 디버깅 시 어느 로그
  파일이 깨졌는지 추적 불가, 운영성 저하.
- 핵심 트레이드오프: 예외 메시지 디버깅 정보 vs 이론적 유출 표면.
- 선택 이유 (owner 최종 판정, 2라운드 한도 도달): 핸드오프 §8 금칙 대상은
  **업로드되는 envelope**. `path.name`은 UUID 파일명(경로 아님) + 로컬 stderr
  전용이라 envelope에 직렬화되지 않음. `PRICING_PATH`는 고정 패키지 경로로
  사용자 데이터 무관. envelope-only 정책상 유출 아님 → by-design 유지.
- 강한 증거: A3 금칙어 grep이 실 로그 기반 envelope(`/tmp/cc_env.json`)에서
  `/Users/`·경로·content 토큰 0건 확인. Codex도 "scope-dependent 잔여 이견"
  으로 분류 — 정책 경계(envelope vs 프로세스 전체) 차이일 뿐 결함 아님.

- 무엇이 잘 됐나: 합성 fixture 테스트(test #6)보다 실 로그 기반 A3 grep이
  더 강한 음성 검증이었음 — 실제 환경 유출 0건을 직접 입증. Codex 교차 리뷰가
  Claude 단독 리뷰가 놓친 8건을 검출(7건 수정), 검증 분리 원칙의 실효 확인.
- 다음엔 무엇을 바꿀까: P2-4 같은 "정책 경계" 이견은 2라운드 토론 전에 owner가
  검증 범위(envelope-only vs 프로세스 전체)를 먼저 못박으면 라운드 절약 가능.
  교차 리뷰 시작 시 scope 선언을 plan에 명시하는 절차 추가 검토.

---

### 2026-05-19 collector `--period` 캘린더 기간 필터

- 문제: collector가 디스크의 모든 세션을 무조건 집계 → "이번 주 누가 제일
  많이 썼나"를 가릴 수 없어 주간 리더보드가 불가능.
- 버린 대안: 롤링 윈도우(업로드 시점 기준 최근 N일). 업로드 시각마다 구간이
  달라져 빌더 간 순위 비교가 불공정 — 대회는 모두가 같은 구간이어야 함.
- 핵심 트레이드오프: 캘린더 버킷의 경계 산술 복잡도(월/년 롤오버) vs 공정한
  비교 가능성. 세션-시작 귀속의 편향 vs 줄 단위 usage 파싱의 구현 비용.
- 선택 이유: 캘린더 버킷 + UTC 단일 기준 + 닫힘-열림 `[since, until)`. 행
  9-필드 계약은 불변으로 두고 envelope에 `periodWindow` 메타만 추가
  (schemaVersion v1→v2). 세션-시작 귀속은 `week` 이상에서 편향이 경미해 수용.
- 강한 증거: Codex(gpt-5.5) 교차 리뷰가 캘린더 산술·경계·보안 무누출을 정상
  확인하면서, `Z`-only 픽스처가 못 잡은 `_utc_day` 비정규화(offset 타임스탬프
  버킷 불일치)를 검출 — 단일 입력 분포 테스트의 사각지대를 교차 모델이 노출.

- 무엇이 잘 됐나: plan 단계에서 롤링 vs 캘린더를 미리 갈라 공정성 결함을 설계
  단계에 차단. Codex 교차 리뷰가 15-테스트 그린이 숨긴 latent 버그를 잡아냄.
- 다음엔 무엇을 바꿀까: 픽스처를 한 형태(`Z`)로만 만들면 다른 형태의 버그가
  영원히 안 보임 — 타임스탬프 다루는 코드는 픽스처에 offset 변형을 1건 섞자.

---

### 2026-05-19 리더보드 v2 envelope 연동 + 라이브 반영

- 문제: collector가 v2(`schemaVersion "2"` + `periodWindow`)만 emit하는데
  웹 소비 측은 v1만 알아 collector 산출 파일이 import에서 전부 거부됨. import된
  envelope도 미리보기까지만 도달, 실제 리더보드엔 미반영.
- 버린 대안: v1 backward-compat shim. collector가 v2만 emit하므로 v1은 구버전
  산출물 — shim은 미사용 코드. v2 전용 하드 스위치로 결정.
- 핵심 트레이드오프: envelope에 fixes/VES/7d-trend가 없어 import 빌더를 mock
  VES 랭킹에 섞으면 거짓 순위 → 별도 "Your imports" 블록으로 분리(rank/ves `—`).
- 선택 이유: 검증·타입 v2화 + 라이브 반영(localStorage 영속)까지. 신뢰 경계인
  import 경로에 `additionalProperties:false` 6레벨 미러 유지.
- 강한 증거: Codex 교차 리뷰가 tsc/eslint 그린 + 브라우저 E2E가 놓친 결함 3건
  검출 — ① `checkPeriodWindow` 편측 경계 통과(week+한쪽만 null → "All time"
  오표시) ② `grandTotal.estimatedCostUsd` 미대조(변조 비용 표시 가능)
  ③ `isImportedEntry` shape guard 느슨(verif 임의 문자열·period 불변식 미강제).

- 무엇이 잘 됐나: Codex가 "통과한 경로"(tsc/eslint/E2E 5종 거부 확인)가 숨긴
  논리 결함 3건을 검출 — 음성 테스트가 커버한 케이스의 인접 변형(both-null은
  막되 one-sided는 누락)을 교차 모델이 노출. 검증 분리 원칙 실효 재확인.
- 다음엔 무엇을 바꿀까: 불변식("A iff B")을 코드로 강제할 땐 음성 픽스처를
  양극단(둘 다 위반)만이 아니라 편측(한쪽만 위반)까지 만들자 — `bothNull`
  단일 플래그가 one-sided를 통과시킨 게 정확히 이 누락.

---

### 2026-05-19 실제 리더보드 서버 + fixes/VES/7d-trend 파이프라인 (S0)

- 문제: import이 `localStorage`에만 저장돼 다른 기기·시크릿 창에서 안 보임 —
  "리더보드"가 사실상 1인용. import 빌더의 fixes/VES/7d-trend는 envelope에
  데이터가 없어 `—`로 고정.
- 버린 대안: ① 별도 백엔드 서비스(Express 등) — 인프라·배포 비용 과대, 프로토
  타입 부적정. ② Vercel KV/Postgres — 신규 의존성·계정 결합, 로컬 검증 단계엔
  과함. ③ 자동 fixes 검증(제출자 CI 연동) — 저장소·CI 접근 없이 자동 판정 불가.
- 핵심 트레이드오프: JSON 파일 store는 신규 의존성 0·인프라 0이지만 단일 서버
  인스턴스 공유에 한정(배포 시 ephemeral FS → KV 전환 필요). fixes 자동 검증
  불가 → owner 수동 CLI 게이트로 정직하게 한정.
- 선택 이유: Next.js Route Handlers(`app/api/`) + 서버 JSON 파일 store
  (`web/.data/`, atomic write). 신규 npm 의존성 0. POST 시 서버에서
  `validateSummary` 재실행 → 클라 우회 불가능한 신뢰 경계. fixes는 challenge
  제출(unverified) → owner CLI 검증(verified) → VES = verifiedFixes/cost.
- 강한 증거: 직전 v2 연동 사이클 decision-log가 "백엔드 없음 → localStorage,
  실제 서버는 후속 과제"로 명시 — 본 작업이 그 후속. Codex 교차 리뷰가 v2
  연동에서 음성 테스트 사각지대 3건을 검출한 선례 → 서버 신뢰 경계도 교차 리뷰.

[S10 회고]
- 무엇이 잘 됐나: 신규 의존성 0으로 3-Phase(서버 store / challenge 검증 / 7d-
  trend) 완주. Codex 교차 리뷰가 "atomic write" 표현에 가려 놓친 결함 2건(동시
  read-modify-write 미직렬화·고정 tmp 이름 / 같은 챌린지 재검증 이중 합산)을
  정확히 검출 — 검증 분리 원칙이 또 실효.
- 다음엔 무엇을 바꿀까: "atomic write 했으니 동시성 안전"이라 단정한 게 함정 —
  파일 rename은 원자적이어도 read→write 구간은 직렬화돼야 한다. 단일 fs 연산의
  원자성과 트랜잭션의 원자성을 다음부터 분리해서 본다.

---

### 2026-05-19 collector week를 직전 완료 주로 변경 (S10)

- 무엇이 잘 됐나: `/review` 게이트가 "week가 진행 중인 주를 잡으면 import 요일에
  따라 1~6일로 불공정 + until이 generatedAt보다 미래"라는 의미 결함을 코드 라인
  1줄 변경(`_calendar_window` week 분기)으로 정확히 좁혀 잡음. 단일 함수 수정이
  `collect()`·`build_envelope()` 양쪽 호출자에 자동 전파 — 영향면 작게 유지.
- 다음엔 무엇을 바꿀까: 캘린더 윈도우를 처음 설계할 때 day/week/month/year를
  "now가 속한 버킷"으로 일괄 통일한 게 week에만 어긋났다. 리더보드처럼 "완료된
  기간끼리 경쟁"이 요구사항이면 윈도우 시맨틱을 기간 종류별로 먼저 못박는다.

---

### 2026-05-19 A-2 trend를 주간 import 이력 모델로 재설계 (S0)

- 문제: `lib/server/trend.ts`의 7d-trend가 죽은 일일 cron(`scripts/snapshot.mjs`)에
  묶여 있었다. cron이 package.json·crontab·CI 어디에도 등록 안 됨 → 스냅샷
  미누적 → `WINDOW=7` 미달로 trend는 영구히 빈 Map → UI 항상 `—`.
- 버린 대안: ① A-1 일일 cron 유지(snapshot.mjs를 launchd/CI에 등록) — 새 제품
  흐름(유저 주간 원클릭 import)과 데이터 단위가 불일치, 불필요한 인프라.
  ② trend metric을 totalTokens 외 지표로 동시 교체 — 범위 과대, 별도 후속 과제.
- 핵심 트레이드오프: 추이의 자연 단위를 "서버 일일 스냅샷"에서 "유저 주간 import"로
  옮기면 cron 인프라가 사라지고 모델이 제품 흐름과 정렬되지만, "최근 7 import ≠
  연속 7주"라는 PoC 한계가 남는다 — 정직하게 문서화로만 한정.
- 선택 이유: trend를 handle별 주간 import 이력(신규 `.data/import-history.json`)
  에서 파생. 각 주간 import = sparkline 한 점. `recordImportHistory`를
  `upsertEntry`의 `withLock` 안에서 호출(두 파일 쓰기 일관성). non-week import는
  이력에서 제외. `trendByHandle()` 시그니처·pct 공식·dir 임계 불변 → route.ts·UI
  무변경.
- 강한 증거: 직전 "리더보드 서버" 사이클 decision-log가 "snapshot.mjs cron 미등록
  → 7d-trend 데이터 누적 안 됨"을 미해결 concern으로 명시 — 본 작업이 그 해소.
  Codex gpt-5.5 적대적 리뷰가 비-week import 혼입·두 파일 비원자성 쓰기를 사전 검출.

[S10 회고]
- 무엇이 잘 됐나: `trendByHandle()` 계약(시그니처·pct 공식·dir 임계)을 그대로 둔 채
  데이터 소스만 교체 → route.ts·Sparkline UI 무변경으로 영향면을 5개 파일에 가둠.
  Codex 교차 리뷰가 month/year import의 주간 추이선 혼입을 짚어 `period !== "week"`
  스킵 가드를 설계 단계에서 확보 — 검증 분리 원칙이 또 실효.
- 다음엔 무엇을 바꿀까: 죽은 cron을 첫 구현 때 등록했다고 가정한 게 함정이었다.
  "스냅샷을 쌓는다"는 코드가 있으면 그 트리거(cron/CI/launchd)가 실제 등록됐는지를
  파이프라인 완성 시점에 grep 한 번으로 확인한다. 또 trend가 totalTokens 기반이라
  "burn 증가 = 추이 상승"으로 읽히는 프레이밍은 'usage trend' 재라벨 후속 과제로 남김.

---

### 2026-05-20 주간 회고 — E+C+D 묶음 배포 (worktree 병렬)

- 무엇이 잘 됐나: Codex 6건 사전 적대적 리뷰가 HIGH 3건(LIST "newest-first" 계약
  파괴, file/redis rate-limit 발산, fast-forward 머지로 인한 revert 불가)을 코드
  작성 0줄 시점에서 차단. C·D를 worktree로 분리해 파일 충돌 0 + `--no-ff`로
  개별 revert 가능 상태로 한 번에 배포 — 5/20 01:30 머지 → push → production
  HTTP 200까지 의도한 동선 그대로 흘러감. `lib/data.ts`·store 계층·package.json
  무수정 계약이 1주 35커밋 동안 회귀 0건으로 유지됨.
- 다음엔 무엇을 바꿀까: ① 헤비 작업(B/C/D 모두 3파일+ / 영속 데이터)인데
  `tasks/<id>/criteria.md` Evaluator 산출물을 분리하지 않아 Review Harness #2
  평가기준 통과 표가 plan 본문에 섞여 검증 분리 1패스가 흐릿했다. 다음 헤비부터
  criteria.md 분리 의무. ② Pre-S0 Vault 조회 보고 누락 — `INDEX-by-stack.md`
  매칭이 적은 신생 스택이라도 명시적 "0건" 보고가 있어야 C2 `usage_count`
  데이터가 쌓인다. ③ 22~01시 야간 집중(25/35 = 71%) 패턴에서 owner 세션 2시간
  점검 룰이 자가준수에 의존 — 다음 헤비는 plan에 시간 박스 명시 후 시작.

---

### 2026-05-20 Production rollout gate (7-axis) 자동화 인프라

- 문제: `?auto-detect=1` flag ON 전환을 owner 직감으로 결정하면 privacy invariant
  (9-field) 위반 위험. 5축은 plan에 정의돼 있으나 측정 인프라 0. Codex 5라운드
  적대적 검토를 통해 5축 → 7축(Axis 6 서버 화이트리스트, Axis 7 텔레메트리
  프라이버시)으로 보강하고 완전 자동 측정으로 확정.
- 버린 대안: ① 수동 체크리스트 — owner 자기준수 의존 → 솔로에서 가장 흔한
  실패 패턴. ② 게이트 + ON 전환 PR 동시 진행 — Axis 1~3 데이터 없이 결정은
  게이트의 존재 의미 부정.
- 핵심 트레이드오프: 완전 자동화 vs 측정 인프라 구축 비용(텔레메트리 자체가
  9-field 위반 가능 — Codex R4 메타-프라이버시 invariant 추가 필요).
- 선택 이유: 사용자 영향(privacy 침해 시 raw data 유출) 비대칭적으로 큼.
  게이트의 존재 의미는 owner 직감을 강제로 제약하는 것. 텔레메트리도
  `additionalProperties:false` 화이트리스트로 측정 자체가 유출 경로가 되지 않도록.
- 강한 증거: Codex R4 "측정 자체가 9-field 위반 가능"을 구조 설계 전에 검출 →
  telemetry.ts `FORBIDDEN_KEY_RE` + per-event ALLOWED_KEYS 화이트리스트로 차단.
  7축 98 vitest 테스트 — 6·7축 64건이 서버/텔레메트리 경계를 코드 실행 증거로 검증.
- 무엇이 잘 됐나: Codex 5라운드 적대적 검토가 R4(텔레메트리 메타-프라이버시)와 R1
  (Axis 6·7 추가)를 사전에 잡아냄 — 구현 전 설계 검증이 실제 결함을 차단했다.
  parity-test/security-test CI 2종이 경로 버그 수정 후 바로 그린.
- 다음엔 무엇을 바꿀까: 워크플로우 경로(`web/` 접두사) 버그는 git root 확인 체크를
  plan 단계에 명시하면 방지 가능. GitHub Free 플랜의 branch protection 미지원은
  저장소 공개 또는 Pro 업그레이드 전까지 수동 주의로 대체.

---

### 2026-05-20 F5/F6/F7 Python PoC 하드닝 (parsers.py HIGH 3건 해소)

- 문제: 7차 Codex 감사(`feat/burn-import-fsa`)에서 Python PoC `parsers.py`에
  HIGH 3건 검출. F5 — `SessionParse.project_slug`가 raw path-slug를 필드로
  노출(미래 caller가 실수로 emit 가능). F6 — `_as_int` 상한 없어 browser TS
  `Number.MAX_SAFE_INTEGER`(2^53-1)과 cross-runtime 불일치 가능. F7 —
  `(payload.get("info") or {}).get(...)` 패턴이 truthy 비-dict에서 AttributeError.
- 버린 대안: F5 — dataclass는 그대로 두고 "slug를 절대 emit하지 말라"는 주석만 추가.
  →미래 caller 실수를 차단 불가, defense-in-depth 위반.
- 핵심 트레이드오프: Option A(해시 인라인)는 parse_* 시그니처에 salt 추가가 필요
  → 모든 caller(collect.py·estimate_cost.py·test) 변경. 하지만 raw slug이 dataclass에
  존재하지 않으면 어떤 caller도 실수로 emit할 경로가 사라짐.
- 선택 이유: /codex consult 18개 개선점 반영 후 Option A 확정. F6 상한은 브라우저
  TS의 `Number.MAX_SAFE_INTEGER`와 동기화(2^53-1). F7은 `isinstance(info, dict)`로
  명시 교체. production 경로(브라우저 TS)는 무영향.
- 강한 증거: 19 pytest 그린 (기존 14 + 신규 5종). CLI smoke — 27행 envelope에
  `projectHash` 정상 출력, 홈 경로 누출 0건. `project_slug` grep 결과 =
  hashing.py 함수 파라미터만 잔존 (parsers·collect·estimate_cost 0건).

- 무엇이 잘 됐나: /codex consult가 plan의 결함(test 3개 파괴, estimate_cost.py
  에서 salt 로드 위치 오류 등)을 구현 전에 잡아냄 — 리뷰 분리 원칙이 또 실효.
  PR branch protection이 바로 작동해서 feature branch → PR 흐름이 정상 확인됨.
- 다음엔 무엇을 바꿀까: HIGH 결함이 deferred로 분류되면 plan 파일에 "다음 가용 sprint
  진입 조건"을 명시해서 자연스럽게 소환되게 하자. 이번은 수동 백로그 확인으로만 재발굴.

### 2026-05-21 [Burn-Import 사이클 종료 — /retro 회고]

- 무엇이 잘 됐나: F8/F9 프로덕션 12/12 PASS 확인 → 코덱스 교차 리뷰가 owner 솔로 검토 누락 2건(store-contract-check totalTokens, 미사용 test:coverage 스크립트) 잡아냄. 위험 3축 트리거 룰이 실제로 작동.
- 다음엔 무엇을 바꿀까: PR #1(4,642 LOC) 같은 빅뱅 PR은 토크나이저/픽커/와이어업 3개로 분리. 테스트 비중 11.2%는 인프라 위주라 발생한 결과 — 다음 사이클은 FSA 픽커 플로우 Playwright UI 테스트 추가로 ratio ≥ 20% 목표.

---

### 2026-05-21 coconut-collector 온보딩 closure (Axis 1 캠페인 진입 게이트)

- 문제: Axis 1 모집(15 distinct project_hash) 캠페인 시작 전 "공유 전 필수" 체크리스트
  4항목이 미완. 가장 큰 blocker는 `pip install coconut-collector`가 PyPI에 없음 →
  공유 시 "한 줄 설치"가 동작 자체를 안 함. 나머지 3항목도 미측정/미검증 상태.
- 버린 대안: ① `python -m coconut_collector` 그대로 공유 — 대상자가 src clone +
  venv 수동 설정해야 해 "한 줄 실행" 메시지와 괴리. 전환율 급락 예상.
  ② PyPI 게시 없이 GitHub Release에 zip 배포 — pip보다 마찰 큼.
- 핵심 트레이드오프: `pyproject.toml` + PyPI 패키징은 배포 경로 추가 (실패비용
  ≥2h — 이름 선점 회수 어려움). 단 external 사용자 "한 줄 설치" 마찰 제거 효과가
  비대칭적으로 큼. 실제 게시(`twine upload`)는 owner 별도 수동 실행으로 게이트.
- 선택 이유: 위험 3축 3/3 충족 → /codex 교차 리뷰 강력 권장 + plan 명시 4종 한도.
  GIF/30초/에러메시지는 구현 + Playwright 측정으로 evidence-based closure.
- 강한 증거: 기존 decision-log의 반복 패턴 — "검증 분리 + /codex 교차가 테스트
  그린이 숨긴 결함을 잡아냄" (4회+ 확인). PyPI 패키징 silent failure 성질상
  신규 머신 설치 시까지 오류가 안 보임 → 동일 교차 검증 구조 필수.

---

### 2026-05-21 [Rollout Gate 무결성 v2 — HMAC + namespace + CI hardening]

- 문제: `/api/burnindex`(무인증)과 `/api/telemetry/auto-detect`가 외부 POST로 Axis 1/2/3 카운터 위조 가능. 기존 Origin/rate-limit 설계는 실질 인증 아님. Redis v1 키에 Phase 1·2 오염 카운터 존재. CI workflow 4가지 silent-PASS bypass.
- 버린 대안: ① Origin+rate-limit 유지(=인증 없음, 위조 차단 불가), ② OAuth/JWT 완전 재설계(솔로·익명 수집에 과대), ③ fail-open Redis fallback(gate integrity와 모순).
- 핵심 트레이드오프: server-issued HMAC short-lived token은 클라이언트 round-trip 1회(≤200ms) 추가 vs 무인증 위조 경로 완전 차단. namespace bump은 v1 카운터 보존(rollback용) vs 측정창 오염 분리.
- 선택 이유: 단일 shared-secret HMAC + Redis nonce + fail-closed가 솔로 프로젝트 위협 모델에 최소 침습이고 gate 신뢰성 확보. workflow_dispatch는 Vercel deployment protection 401 우회 + 일반 PR 개발 흐름 보호. Codex 12건 BLOCK 전량 반영.
- 강한 증거: Codex gpt-5.5 적대적 검토 BLOCK 결과 + 기존 decision-log "교차 검증이 단위 테스트가 숨긴 결함을 잡아냄" 패턴(4회+ 확인).

[S10 회고]
- 무엇이 잘 됐나: Codex 12건 BLOCK이 설계 단계에서 `/api/burnindex` Axis 1 위조 경로를 잡아냈고, Phase A 10셀 매트릭스를 production build(not dev server) 환경 + browser automation으로 전수 검증해 kill-switch 계약을 코드 실행 증거로 확보. `gate-pass` required check가 workflow_dispatch와 호환 불가임을 PR 머지 시점에 발견해 GitHub API로 즉시 수정 — branch protection 설계 결함이 silent하게 모든 PR을 영구 차단하기 전에 해소.
- 다음엔 무엇을 바꿀까: required status check를 설계할 때 CI 트리거 타입(`pull_request` vs `workflow_dispatch` vs `push`)이 GitHub 정책상 호환되는지 S3 단계에서 먼저 검증한다. Vercel deployment protection이 CI의 protected API 접근을 막는 한계도 plan에 명시해야 Vercel Pro 없이 자동화 불가임이 owner에게 S3 단계에서 전달된다.

### 2026-05-21 [Playwright e2e 사이클 종료 — /retro 회고]

- 무엇이 잘 됐나: Codex 5건 사전 가정 검증(fixture 이름 `projects` 강제, 타임스탬프 윈도우 오프사이드,
  MemoryBurnStore 부재, IDB DataCloneError 함정, `reuseExistingServer` 충돌 패턴)이 spec 작성 전에
  설계 결함 4건을 막았다. MemoryBurnStore 격리가 동작해 e2e 실행 중 production leaderboard 오염 0건.
  CI e2e job이 첫 실행에 3.4s PASS (Chromium 헤드리스, ubuntu-latest).
- 다음엔 무엇을 바꿀까:
  ① [Modal miss] `JoinBurnIndexForm`이 `LandingApp.tsx`의 `{modal === "join" && ...}` overlay 안에
  렌더링되는 것을 모르고 `?auto-detect=1` flag만으로 FSA UI가 자동 노출된다고 가정 → 30초 타임아웃
  발생 후 페이지 스냅샷으로 발견. 실 손실: spec 3개 fix 라운드 중 1 라운드 소비. 다음 e2e는
  owning 컴포넌트(`LandingApp.tsx` 등) 먼저 grep해 진입 경로(버튼/링크/URL flag)를 코드에서 확정 후 시작.
  ② [IDB structuredClone 함정] 가짜 FSA 핸들의 함수 프로퍼티(`queryPermission`, `entries`, `getFile`)가
  `IDB put()`의 structured clone 알고리즘과 충돌 → `DataCloneError` → `pickFolder()` catch가
  setClaudeHandle 호출을 막아 "✓ projects" 버튼이 뜨지 않음. 원인 추적에 1 라운드 소비.
  해소: `IDBFactory.prototype.open`을 `"coconutlabs.handles"` DB에 한해 in-memory Map으로 교체
  (`injectFakeHandlesIDB` 패치). 이 패턴을 DevVault TIL에 등록해 다음 FSA e2e에서 재발굴 방지.
  ③ [Port 충돌 패턴] Docker(:3000) + Coconut Labs dev server(:3001, BURN_STORE 미설정) +
  Playwright `reuseExistingServer: true`(baseURL :3000) → Family Asset 로그인 페이지 렌더.
  잘못된 앱이 뜨는 증상으로 스펙이 전혀 진행되지 않았다. 실 손실: port kill + config 수정에 1 라운드.
  해소: playwright.config.ts에 port 3002 + `reuseExistingServer: !CI` + 명시적 `webServer.command`.
  다음 프로젝트는 e2e 전용 포트를 처음부터 할당하고 README에 "e2e 실행 전 기존 dev 종료" 1줄 명시.

---

### 2026-05-21 [Production ON-flip — NEXT_PUBLIC_AUTO_DETECT_DEFAULT=true, Axis 1 = 0 owner 우회]

- 문제: Axis 1 = 0 (v2 namespace 신규) — Rollout Gate 기준 미달. 노출 없이 Axis 1 누적 불가한 닭-달걀 구조. 게이트 자체가 "충분한 환경에서 파이프라인 작동 검증"이 목적이었으나, Chrome 사용자가 auto-detect UX를 보기 전엔 측정값이 쌓이지 않는다.
- 버린 대안: ① Axis 1 ≥ 15 달성 후 전환 (언제까지 기다릴지 기준 없음, 닭-달걀 무한 루프). ② `?auto-detect=1` 쿼리 기반 opt-in 유지 (링크 공유 없이 자발적 유입 기대 불가).
- 핵심 트레이드오프: ON-flip은 Chrome 방문자 전체에게 auto-detect UX를 노출 → 파이프라인 오작동 시 kill-switch(env=false + redeploy, ~34초)로 수분 내 원복 가능. 단 HMAC 인증·namespace v2·fail-closed Redis·kill-switch 10/10 셀 검증 등 infrastructure가 모두 live 상태.
- 선택 이유: Gate ritual 1회 실행 (Run #13, FAIL 확인) + 의도적 owner 우회 audit trail 기록. ON-flip이 Axis 1 측정값을 쌓는 수단으로 작동. 모니터링 윈도우(T+1h)를 안전망으로 확보.
- 강한 증거: Smoke test 4/4 PASS (Chrome "Auto-detect Burn Summary" ✅, FSA-off fallback "Join Burn Index" ✅, env wins over `?auto-detect=0` ✅, 무토큰 POST → 401 ✅). Build secret 노출 0건. Redeploy 34초 완료.

[S10 회고]
- 무엇이 잘 됐나: Codex pre-flip consult Q3(telemetry suppression), Q4(NAT rate-limit), Q5(kill-switch scope 정의) 3건이 모니터링 계획에 즉시 반영됨 — Phase G abandonment ratio check + 429 monitoring이 설계 전에 확보됨. Smoke test 4종을 browser automation으로 직접 실행해 코드 리뷰 증거 대신 실행 증거 확보.
- 다음엔 무엇을 바꿀까: `ROLLOUT_GATE_SECRET`이 Vercel CLI pull에서 redacted → metrics endpoint curl 불가. 다음 번엔 Upstash REST URL + Token을 별도 안전한 local store에 보관하거나, 로컬 `.env.local`에 실제 값 유지. 또한 v2 namespace 전환 시 Axis 1 카운터가 0으로 리셋됨을 plan §Baseline에 미리 명시 — 이번엔 "4 예상 → 0 실제" 불일치를 baseline JSON 재작성으로 처리.

---

### 2026-05-22 [Folder picker UX — Approach B (inline preview + smart errors)]

- 문제: ON-flip 직후 production smoke test에서 ① 폴더 선택 불명확(picker 진입 시 "어떤 폴더를 골라야 하는지" 시각 cue 부재, Step 1 helper text 위계 약함) ② Chrome FSA 시스템 폴더 차단(`~` 홈 디렉터리 거절) 시 catch-all 단일 에러 메시지가 권한 문제로 오인 유도. 본 작업 진행 중 owner self-test에서 추가 발견 ③ kbd `⌘⇧.` 11px 시인성 부족 ④ "home folder 시작" 안내 부재 ⑤ `?auto-detect=1` 쿼리 모달 자동 오픈 안 함(Finding 1, 별 사이클 이관).
- 버린 대안: Approach A (pre-picker modal) — 진입 마찰 1단계 추가 + microcopy 중복 위험(modal + Path Preview Card + Step 1 helper 3중 노출). OS detection 분기(macOS/Linux 따로 hint 노출) — 코드 분기 비용 > Linux 사용자가 macOS hint 한 줄 더 보는 cognitive cost. i18n(영어/한국어 동시) — 글로벌 dev 타겟 정책에 따라 영어 단일.
- 핵심 트레이드오프: 영어 유지(글로벌 dev 타겟, 한국어 owner는 학습 비용 감수) + OS detection 없음(두 hint 동시 노출 허용) + locale-independent `error.name` 분기(`error.message` 파싱 금지 — Chrome dialog 한국어/영어 모두 흡수) + count-based AbortError heuristic(timing-based 1500ms 폐기, 실제 picker UX 호출당 10-15초로 timing window 부적합).
- 선택 이유: First-impression UX 즉시 해소(production live state에서 catch-all 에러 → 4분기 actionable) + Invariant 5축 모두 보호 (#1 build secret 0, #2 WCAG AA 4.5:1, #3 auto-detect 진입 회귀 0, #4 error.name only, #5 handle React state ↔ IDB persistence 분리). Phase 7.5.6 closure 후 owner "사이즈 괜찮음" 발화로 가시성 마지막 결함도 해소.
- 강한 증거: ON-flip 직후 owner production 자체검증에서 SecurityError 케이스 직접 발견 + 3 Codex 적대적 라운드 (Phase 1 IDB persistence MEDIUM → Plan v2 §B mitigation / Phase 6 Cell #2 AbortError CONCERN → Contingency Patch v2 count-based / Phase 7.5 kbd 시인성 + home folder 안내 발산 후 patch) 모두 의미 있는 결함 발견 + B3 5종 산출물(criteria/criteria-execution-log/diff/unverified/smoke-golden-regression) 누적 + Owner Happy Path 11 planned cells (Phase 6×7 + Phase 7×2 + Phase 7.5×1 + Phase 7.5.6×1) 중 Phase 6 7/7 owner-direct localhost ✅ 손글씨 기록 / Phase 7 #1·#4 production owner-notes evidence 컬럼 기록(marker 미flip) / Phase 7.5·7.5.6 owner 발화 "사이즈 괜찮음" verbal 확인 + code deploys 3건 (`6cda4c5`/`b94d362`/`40cd00c`) 각 build secret leak 0 hits 재확인 (`3756e83`은 docs-only commit — code chunks 변경 0건이라 secret leak 점검 대상 아님).

[S10 회고]
- 무엇이 잘 됐나: ON-flip → owner self-test → 3 Finding(모달 자동 오픈 / kbd 시인성 / home folder 안내) 발견 → 단일 patch 사이클(Phase 7.5 + 7.5.6)로 2건 흡수, Finding 1만 별 사이클 이관. Codex 3 라운드(Phase 1/6/7.5) 모두 사각지대 검출 — Cell #2 AbortError(timing-based pivot 근거 확보), kbd 시인성(13→15px 2단계 bump 필요성). Invariant 5축이 매 Phase 머지 게이트로 작동해 production secret leak / a11y 회귀 / auto-detect 진입 회귀 0건 유지.
- 다음엔 무엇을 바꿀까: ① staging/preview 환경 owner self-test 사이클 신설(별 cycle 분리) — coconutlabs 인프라에 staging 부재라 본 사이클 흡수 불가. 별 사이클 brief에 ON-flip 게이트 추가·Vercel Preview deploy 활용·owner 직접 진입 절차 정의 후 v2 이후 모든 production 변경에 적용. ② Phase 6 manual cells 글로벌 템플릿(`~/.claude/rules/task-standards.md` "Owner Happy Path Cells" 후보 섹션)에 "microcopy 시인성"(kbd font-size·padding·line-height) + "WCAG AA contrast 실측" 의무 항목 추가 — Phase 6 audit이 기능 검증에 집중해 시각 결함 누락. 본 cycle에서 발생한 kbd 11→13→15px 2단계 bump가 패턴화 trigger. ③ DOMException dispatch 명세 불명확 시(MDN+WICG+Chromium 소스 3중 분석 필요) AGENTS.md "WebKit/Blink API 사전 측정" 신규 anchor 추가 — `window.showDirectoryPicker` wrapper로 `e.name` 실측 후 분기 설계 의무화. Cell #2 Codex CONCERN을 patch-after-measure 패턴으로 1라운드 단축 가능. 향후 DOMException-heavy 작업(FSA / Clipboard API / Storage API)에서 자동 적용.

---

### 2026-05-22 [Next cycle — Hygiene + e2e (rollout-gate 헬스 체크 + gstack 업그레이드 + Playwright e2e)]

- 문제: 직전 사이클(folder-picker-ux Phase 0~8 + Finding 1) 종료 직후 retro 액션 아이템 3종이 누적 — ① test ratio 11.2% (목표 ≥ 20% 미달, Playwright e2e 1 spec 추가 시 15~18% 상승) ② 7-axis production rollout-gate workflow가 실제로 트리거·통과하는지 미검증 (안전망이 작동하지 않으면 e2e 추가해도 의미 없음) ③ 매 세션 preamble의 `UPGRADE_AVAILABLE` 노이즈 (gstack 1.40 → 1.41.1). 우선순위 명확: Phase #2(안전망 확인) → #3(노이즈 제거) → #1(e2e 본 작업).
- 버린 대안: ① Phase #1을 먼저 진행 — rollout-gate가 안 돌면 e2e가 CI에서 게이트 되지 못해 안전망 0. ② #1을 독립 사이클로 분리 — 75~90분 단일 세션 분량이라 묶는 게 컨텍스트 단편화 0. ③ gstack 업그레이드 무시 — 매 세션 5초 손실 + warning blindness 위험.
- 핵심 트레이드오프: 단일 세션 75~90분 사이클로 3 Phase 묶음 vs 각 Phase 독립 commit. Phase #2/#3은 코드 변경 0(읽기·환경)이라 묶어도 무해. Phase #1은 헤비(5+ 파일 + 새 인프라 + CI 통합) — 위험 3축 2/3 충족(① 실패비용 ≥ 2h ② 영향범위 CI+e2e 인프라+5+ 파일)이라 /codex 교차 리뷰 의무 발동.
- 선택 이유: plan(`docs/plans/next-cycle-hygiene-and-e2e.md`)이 이미 작성·commit(`c408b51`)됨 + 진입 명령 명시 + 완료 기준(Review Harness 5항목) 명문화. Phase 순서가 안전망 → 환경 → 본 작업의 자연 의존성을 반영. 본 사이클은 휴면 retro 액션 정리 + 다음 contract 변경의 회귀 비용을 0으로 만드는 인프라 투자 성격.
- 강한 증거: 직전 사이클 SESSION_HANDOFF.md Section 3 "다음 사이클 후보" 4건 중 owner 채택 결정 — Hygiene + e2e가 1순위. plan §의존성 상태 검증 완료 (`@playwright/test ^1.60.0` ✅ devDep, `playwright.config.ts` ❌ 신규 필요, `e2e/` ❌ 신규 필요, CI 통합 ❌ 신규 필요). 위험 3축 plan-brief에 점검 안 됨 → S0 본 엔트리에서 명문화: Phase #2/#3 라이트(0/3 충족, Fast-Path 가능), Phase #1 헤비(2/3 충족, /codex 의무 + 검증 분리).

[S10 회고 — 본 사이클 완료 후 추가]

---

### 2026-05-22 [folder-picker-ux Finding 1 — `?auto-detect=1` 모달 자동 오픈 별 사이클 진입]

- 문제: Phase 7 production owner self-test에서 발견 — `?auto-detect=1` URL 쿼리가 modal 자동 오픈을 trigger하지 않음. 사용자는 Hero/Nav/DropsSection/FinalCTA "Join Burn Index" 버튼 1회 클릭 필수. URL 공유 기반 진입 동선 차단 → 핵심 UX gap.
- 버린 대안: ① folder-picker-ux 본체에 흡수 — 변경 surface 다른 파일(LandingApp.tsx vs JoinBurnIndexForm.tsx) + Invariant #3 contract 별개("modal 열린 뒤" vs "modal 오픈 자체")라 묶으면 책임 경계 흐림 ② Hero onClick handler에 useEffect-style 자동 호출 — onClick handler 분기 복잡도 증가 + StrictMode double-invoke 우려.
- 핵심 트레이드오프: LandingApp.tsx 단일 파일 + `useSearchParams` 추가 + `userClosedRef` latch 1개. App Router client component 패턴 그대로. 페이지 reload 시 latch reset은 의도된 동작(URL 새 세션 = 신규 trigger). sessionStorage 영구 dismiss는 별 사이클 검토 — 본 사이클 scope 밖.
- 선택 이유: 단일 파일 + 명확한 책임 분리(LandingApp = modal 오픈 / JoinBurnIndexForm = modal 내부 콘텐츠) + Invariant #3과 신규 Invariant #6("close 후 재오픈 0건")이 contract 모순 없음. 위험 3축 2/3 충족이라 /codex Phase 1 적대적 검토로 사각지대 1차 확보.
- 강한 증거: plan-brief.md §위험 3축 평가에서 ① 실패비용 ≥ 2h(rollback + re-deploy + smoke test) ② 영향범위(LandingApp = 진입 페이지 routing, blast radius 큼) ③ 관찰가능성 부분(latch 누락 silent loop 첫 회 검출 어려움) 모두 명문화. plan-brief.md §진입 시점에서 /codex 5묶음 질문 사전 정의 완료(Suspense boundary / StrictMode double-invoke / onClick path / truthy value 분기 / e2e 실측 방법).

[S10 회고]
- 무엇이 잘 됐나: /codex Phase 1 6묶음 질문(Q1-Q6)이 plan-brief.md §진입 시점에서 사전 정의되어 있어 owner가 Codex 응답을 채택/거부할 때 판단 기준 명확. Q6 비-버튼 close 경로 누락 Hard gate가 `showToast` 내부 `setModal(null)` 경로 식별 → `closeModal` useCallback 단일 close path 통일로 Invariant #6 latch 우회 차단(Cell #7 runtime 검증으로 confirmed). 위험 3축 2/3 충족이 명문화돼 검증 분리 의무가 자동 발동, Suspense Option A(AutoDetectListener 자식 분리)로 `/` Static prerender 유지.
- 다음엔 무엇을 바꿀까: ① `useSearchParams` 같은 Next.js client-only API 사용 시 AGENTS.md `node_modules/next/dist/docs/` 사전 확인 의무를 plan v1 작성 단계(S3)에 명시 — 본 사이클은 Phase 3 구현 단계(Task C.6 Step 1)에 검증해 plan revision risk 있었음 (Suspense boundary 의무 사실을 Phase 3에서야 확인). ② Phase 6 cells 표 작성 시 "비-버튼 close 경로 인벤토리" 1줄 의무 항목 추가 — 본 사이클은 Q6 Codex 적대적 검토로 `showToast` 경로를 사후 발견. close path가 N개인 컴포넌트는 모두 단일 useCallback 통일을 plan-brief 단계 패턴화.

---

### 2026-05-22 [Hygiene + e2e Phase #1 — 핸드오프 stale 발견 + CI e2e 3-spec fixup]

- 문제: 핸드오프(`tasks/hygiene-and-e2e/SESSION_HANDOFF.md`)는 "Phase #1 미완료, 신규 인프라 60~75분 헤비"라고 주장했으나 실제 git에는 산출물(`playwright.config.ts`, `e2e/burn-import-fsa-picker.spec.ts`, fixtures, `ci.yml` e2e job)이 commits `edff1c7` + `378c034` (PR #8, 2026-05-21)로 모두 머지됨. CI는 5연속 fail — 3 specs 전부 빨강: ① happy path `waitForResponse` 30s timeout (POST 미발사) ② reject 문자열 mismatch (실제 `JoinBurnIndexForm.tsx:159` "You picked ..." vs 기대 "Selected folder must be ...") ③ onboarding-30s toast 120s timeout. 핸드오프 작성자가 plan만 보고 working tree·HEAD·CI 상태 누락.
- 버린 대안: ① audit-only 종료 — CI 빨강을 다른 사이클로 미루면 다음 머지에서 false alarm fatigue ② 2 spec + 1 spec 분리 사이클 — 같은 컴포넌트 변경(folder-picker-ux finding 1)에서 파생된 desync이므로 분리 시 root cause 중복 분석 + commit history 노이즈 ③ 컴포넌트 메시지/selector를 spec에 맞게 조정 — 회귀 위험(folder-picker-ux 의도된 UX 변경 무효화).
- 핵심 트레이드오프: 한 commit에 3 specs + B3 5종 + 2 codex input 묶음(blast radius ↑) vs spec-only invariant 엄수로 component 회귀 0 (책임 경계 명확). 결과적으로 +910/-15 lines 중 코드 변경은 +84/-15 (`e2e/*` only), 나머지는 audit trail.
- 선택 이유: 동일 root cause(folder-picker-ux finding 1 component drift) → 단일 fixup이 일관성 ↑. spec-only invariant + Codex 2-phase 적대적 검토 + B3 5종 + owner happy path 손기록 게이트가 자동 우회 위험 차단. CI 그린이 머지 가능 조건이므로 fixup 자체는 reversible.
- 강한 증거: ① CI run `26276170000` 3 spec 모두 component message/selector 변경 영향 직접 확인 ② Codex Phase 1 NEEDS_REVISION → 6 mitigations (P0 token verify path bypass + Q2-Q6 P2/P3) ③ Phase 2 mid-execution에서 `?auto-detect=1` modal-overlay click-intercept regression 추가 발견 → overlay-first hardening (Codex Q2 P3) 채택 → CONDITIONAL APPROVE ④ 최종 CI run `26279720906` test/e2e job + parity-test + security-test 3 워크플로우 모두 success.

[S10 회고]
- 무엇이 잘 됐나: 핸드오프 stale 의심 → git HEAD/working tree/CI 상태 3종 cross-check가 5분 안에 root cause 확정. /codex 2-phase가 mid-execution 회귀(auto-detect modal-overlay)를 Phase 2에서 추가 검출 — Phase 1만 했으면 spec PASS 후 prod 사각지대 남음. spec-only invariant가 9-field whitelist 보안 경계 + folder-picker-ux UX 의도 양쪽 보존. B3 5종 산출물 + smoke-golden-regression.md owner 직접 손기록 게이트가 자동 우회 차단을 실제로 강제.
- 다음엔 무엇을 바꿀까: ① 핸드오프 stale 검증을 plan v1 작성 단계(S3) 첫 5분 의무 항목으로 패턴화 — `git status` + `git log --oneline -5` + `gh run list --limit 3` 3종 + `plan vs HEAD diff` 확인 후 plan 진입. ② Component 변경 사이클(folder-picker-ux finding 1)이 끝나면 영향 받는 e2e specs를 plan-brief.md §retro에 명시 — 본 사이클은 spec sync 누락이 별 사이클(이번 fixup)로 분리되어 commit history 분기 발생. ③ Phase 2 input에 component 정확한 경로(`!process.env.CI` vs `!!process.env.CI`) 직접 grep 후 작성 — typo 시 Codex 응답 결론 자체는 유지됐으나 future-self 혼동 위험.

## 2026-05-22 [Token-path real verify integration test — Codex Phase 2 follow-up #1 이행]

- 문제: `tasks/hygiene-and-e2e/unverified.md` #1이 지적한 token 스펙 drift 사일런트 위험. ① e2e (`onboarding-30s.spec.ts:75,94`, `burn-import-fsa-picker.spec.ts:239,263,358`)가 `route.fulfill`로 `/api/burnindex` POST + `/api/telemetry/auto-detect` POST 응답 자체를 stub → `verifyAndConsumeToken` (`lib/server/burn/token.ts:94`) 호출되기 전에 우회. ② `__tests__/burn-api-period-gate.test.ts:28-30`이 `vi.mock("@/lib/server/burn/token")`로 token 모듈을 통째 무력화. 결과: token 스펙(kind 추가/exp 검증 강화/header parsing 변경 등)이 바뀌어도 unit + e2e 모두 그린이지만 prod는 401/500 — 핵심 인증 경계가 미검증 상태로 drift.
- 버린 대안: (A) unverified.md 액면가 — `__tests__/burn-token-verify.test.ts` 신규 작성. 사전 조사에서 `__tests__/burn-token.test.ts` (commit 8e435d2, rollout gate integrity v2)가 이미 happy/malformed/expired/tampered/nonce reuse/kind mismatch 6 케이스를 `verifyAndConsumeToken` 직접 import로 커버 — 100% 중복. (B) no-op closure — burn-token.test.ts는 단위 함수 ok만 막음. e2e `route.fulfill` 우회 + period-gate `vi.mock` 우회 시나리오 잔존 → 부분 충족.
- 핵심 트레이드오프: integration test 1건의 유지 비용(다운스트림 mock 5종 + Redis in-memory mock + downstream API 변경 시 mock signature drift) vs token 스펙 변경 시 prod 401/500 사전 차단. 본 통합은 `verifyAndConsumeToken`을 절대 mock하지 않는다는 invariant가 본 사이클 가치의 전부 — 위반 시 burn-token.test.ts 중복으로 회귀.
- 선택 이유: 진짜 gap이 함수 레이어가 아니라 **route 레이어**에 있음. burn-token.test.ts는 함수 단위 정합성(올바른 입력 → 올바른 출력)만 검증, route handler가 그 함수를 실제로 부르는지는 미검증. Option C는 `new Request(...) as unknown as NextRequest` + `POST = await import(...)`로 route handler를 진짜 호출하고 `issueToken` real → Authorization header → real `verifyAndConsumeToken` → store 통과 전체 경로를 1 케이스로 묶음. 사이클 추가 cost는 신규 파일 1개 + unverified.md 1줄 마킹.
- 강한 증거: ① 사전 grep 결과 `__tests__/burn-token.test.ts:13` 이 `issueToken, verifyAndConsumeToken, parseToken, serializeToken` 4개를 real import → unverified.md #1 5케이스 전부 cover 직접 확인. ② `__tests__/burn-api-period-gate.test.ts:28-30` token mock anti-pattern 직접 확인. ③ e2e 우회 위치 `e2e/onboarding-30s.spec.ts:75,94` + `e2e/burn-import-fsa-picker.spec.ts:239,263,358` route.fulfill 직접 확인. ④ Plan: `~/.claude/plans/rosy-greeting-crab.md` Option C 8+2 케이스 + sanity check 절차(임시 mock 추가 → FAIL 확인 → revert)로 본 invariant가 진짜 token 경로를 검증함을 자체 증명 가능.

[S10 회고]
- 무엇이 잘 됐나: Plan Option C가 unverified.md 액면가(burn-token.test.ts와 100% 중복될 unit test 추가) + no-op closure(route.fulfill 우회 잔존) 두 함정을 모두 회피하고 진짜 gap(route layer)을 통합 테스트 1건으로 정확히 묶음. Sanity check 절차(임시 `vi.mock` → 7 케이스 FAIL → revert) 가 "본 파일이 진짜 token 경로를 검증한다"는 invariant를 자체 증명 — 테스트가 테스트를 검증하는 메타 게이트 확보. 보안 행 의무로 `/codex` 적대적 검증 + `/cso` 감사 양쪽 실행돼 HMAC SHA-256 / `timingSafeEqual` / 128-bit nonce / fail-closed 4종 invariant 보존 확인 + F1 INFO(`token.ts:127-131` GET-then-DEL 비원자성, pre-existing) 발견까지 도달. Production code 0 변경(`git diff --stat HEAD`로 verify) → blast radius 0, reversible test-only addition.
- 다음엔 무엇을 바꿀까: ① F1 INFO(nonce GET-then-DEL race) 를 별 사이클로 분리 — Upstash Redis Lua script atomic check-and-delete 또는 DEL-first reply-count 패턴 검토. 본 사이클 통합 테스트 case 6 + 8-replay 가 atomic 전환 후에도 그대로 PASS 해야 하므로 회귀 가드로 재사용 가능. ② `__tests__/burn-api-period-gate.test.ts:28-30` token 모듈 mock anti-pattern 은 period gate 책임 경계상 현재 정당하지만, "토큰 모듈 mock 은 본 도메인 책임이 token 일 때만" 룰을 plan template (`docs/plans/*.md` 첫 섹션) 에 명시 — 향후 신규 unit test 가 무심코 token mock 채택해 본 통합 테스트 신뢰도를 우회하지 않도록. ③ Pre-S0 vault note logging 절차(`tasks/<id>/notes-used.txt`)가 본 사이클에서 누락(파일 부재) — C2 `usage_count` auto-increment 운영이 자기준수 의존도 너무 높음. Phase 3 hook 도입 전엔 plan S3 첫 단계 "vault 사전 조회" 출력을 `notes-used.txt` 로 즉시 파일화 의무 항목으로 강제 (workflow-10steps.md Pre-S0 절차 보강 안건).

---

### 2026-05-22 [Landing Page MVP-4 안 B — 11섹션 → Header/Hero/Burn Index/Trust+CTA 4섹션 축소] [SUPERSEDED 2026-05-23 → 안 2 (3섹션 절충)]

- 문제: coconutlabs.xyz 랜딩이 런칭 단계인데도 11섹션으로 비대 — owner 자체 진단 ① 섹션 시각 위계가 디자인적으로 희미함(spacing/contrast/typography rhythm 약함) ② 인지부하 과다(솔로 개발자/인디해커 타겟이 한 화면에 11개 메시지 소화 부담) ③ 핵심 CTA(waitlist) 도달까지 스크롤 깊이 과다. /senior advisory(5섹션 contract → DAG dispatch 3 rounds: 5-expert 병렬 → marketing-skills:page-cro 7축 audit → DESIGN.md anchor offline lint)에서 owner 옵션 a 채택. 안 A(2섹션 Burn+Challenges)와 안 C(6섹션 confidence-preserving) 사이에서 안 B(4섹션) 선택 — Brand Director 권고로 Challenges도 DEFER.
- 버린 대안: ① 안 A 2섹션(Burn Index + Challenges만) — Header/Hero 없으면 카테고리 정의자 톤(VES 메트릭) 도입 anchor 부재 + waitlist CTA 위계 약화. ② 안 C 6섹션(How we measure + FAQ 유지) — 인지부하 감소 효과 약함(11→6도 여전히 과다). ③ 11섹션 그대로 두고 시각 위계만 보강 — 콘텐츠 양 자체가 본 문제, 시각 patch로 미봉. ④ /about 등 보조 페이지로 7섹션 분리(prune + redirect) vs 신규 페이지 전면 작성 — S3에서 owner 결정 위임.
- 핵심 트레이드오프: 콘텐츠 정보량 보존(VES 메트릭 신뢰도, How we measure 투명성, Challenges 사회적 증명) vs 인지부하 감소(런칭 단계 첫인상은 단일 메시지 명확성이 본체). 4섹션 압축은 정보 보강을 /about·docs anchor link로 위임 — 호기심 유발 + 보조 페이지로 신뢰 근거 deferral. Trust 섹션 teal contrast 보정 필요(advisory offline lint에서 #0D9488 → #0F766E AA 4.5:1 PASS 확인).
- 선택 이유: 솔로 개발자/인디해커 타겟의 의사결정 패턴(빠른 스캔 → 단일 가치 명제 흡수 → waitlist 결정)에 맞는 정보 밀도. Brand Director(VES 메트릭이 카테고리 정의자 톤의 핵심 anchor → Burn Index 섹션 보존 의무) + page-cro 7축(Visual Hierarchy 가장 취약 → 4섹션 압축으로 80px spacing/alt-background/per-section accent 5 패턴 적용 가능) + Brand Copywriter("Tiny tokens. Big ships." invariant 보존 + CTA "Start My Burn Index" outcome-focused 발산) 3축 합의. 위험 3축 2.5/3 충족(① 첫인상 회복 어려움 ② 4섹션 전면 개편 = 3+ 모듈 ③ waitlist 전환율 silent 실패 가능)이라 /codex 교차 리뷰 + /cso(이메일 수집) 의무.
- 강한 증거: /senior advisory 3 rounds — Round 1 5-expert(brand-creative-director-ko / brand-copywriter-ko / analyst-market / voc-strategist / fa-devils-advocate) 병렬 결과 "4~6섹션 적정" 만장일치 + 섹션 3+7 redundancy 직접 지적 / Round 2 marketing-skills:page-cro 7축 진단에서 Visual Hierarchy가 가장 취약(spacing/contrast/typography rhythm 약함) 직접 확인 + Visual Hierarchy 5 패턴(80px section spacing / alt-background 2개 / H2 48px 균일화 / max-width 1200px container / per-section accent) 도출 / Round 3 DESIGN.md anchor offline lint 시뮬레이션에서 7 룰 중 1건(`tertiary #0D9488` Trust 섹션 contrast 3.4:1 AA 미달) 사전 검출 → `#0F766E` 보정안 도출. AGENTS.md 경고 "This is NOT the Next.js you know — breaking changes" 인지 → S3 plan v1 첫 단계에 `node_modules/next/dist/docs/` 사전 확인 의무 명시 예정.

[S10 회고 — 본 사이클 완료 후 추가 / SUPERSEDED 2026-05-23: 본 안 B는 안 2 (3섹션 절충)로 교체됨. 아래 2026-05-23 엔트리 참조]

---

### 2026-05-23 [Landing Page MVP-4 안 2 — 4섹션 안 B supersede → Sticky Header + Hero + Burn Index(with Trust subsection) 3섹션 절충]

- 문제: 2026-05-22 안 B(4섹션 Header/Hero/Burn/Trust+CTA) 머지 직후 owner self-review에서 ① 여전히 정보 밀도 높음 ② Trust 섹션이 위계상 본 메시지(Burn Index) 약화 ③ 1차 page-cro 평가에서 Burn Index 산출물 형태(메트릭? 리더보드? 점수?)가 fold 5초 안에 인지 안 됨 — 3건 잔류 의심 발생. 4섹션 유지는 owner 명시 거부 → 3차 /senior option (a) dispatch로 2섹션(과압축) vs 3섹션(절충) 1안 lock 목표.
- 버린 대안: ① 안 1 2섹션 압축(Hero에 Burn 통합 + Trust micro-proof로 흡수) — page-cro 1차 평가 3축 모두 FAIL(5초 명료성 / CTA hierarchy / mobile fold ~532px > 528px overflow). 정체성 anchor 약화 + Trust 면적 소실. ② 4섹션 유지(현 운영) — owner 명시 거부(HANDOFF.md §안티패턴). ③ Hero 카피 Option B(은유 우선) — devil's advocate 시나리오 4(Hero 라인업 충돌, 인지 실패율 42-50%) High Severity로 폐기. ④ alt-BG contrast 전역 #FAFAFA → #F5F5F5 — 영향범위 광역, 본 사이클 scope 외(L806 #burn 단일 lock으로 축소). ⑤ #safety 302 redirect 유지 — 외부 인바운드 silent 잔존, 4섹션 invariant 흔적 → 404 fallback + GSC 모니터링으로 완전 제거.
- 핵심 트레이드오프: Trust 콘텐츠 100% 보존(V3_TRUST → BurnIndexSection prop 흡수) vs Trust 분리 위계 약화(-12~22% waitlist 전환 잠재 영향). Burn Index 단일 메시지 축 강화 + score+rank 산출물 명시(5초 명료성 회복) vs BurnIndexSection 비대화(260L → 320~340L, Tier1 #10 코드↔도메인 1:1 위반 후보, 350L 한도 lock). teal #008C5A(4.29:1 AA FAIL) → #0F766E(5.47:1 AA PASS) 보정으로 Trust 카드 contrast 정합 회복.
- 선택 이유: 솔로 dev/indie hacker cold traffic의 5초 스캔 패턴 + Burn Index 단일 anchor 명료성 우선. Phase 1 brand-creative-director-ko 안 2 권고 + Phase 2a fa-devils-advocate 시나리오 4 (Hero 라인업 충돌 High) → Option A 직설 카피("Burn Index puts a number on your drag.") 채택 + Phase 2b /codex 정적 검증(DESIGN.md token PASS, above-fold invariant PASS, teal #0F766E WCAG AA PASS) + Phase 2c gemini cross-file(-58L~-20L, Next.js 16 SSR 영향 없음) + Phase 3 page-cro 회귀(3축 모두 PASS, 1축 S6 구현 조건부) 5단계 합의. 위험 3축 2/3 충족(② 5+ 모듈 영향 / ③ 첫인상 회복 어려움 silent fallback) → /codex 교차 리뷰 + S6 13항목 체크리스트 + GA `waitlist_signup_rate` 4주 모니터링 의무.
- 강한 증거: 3차 /senior option (a) dispatch 5단계 — Phase 1 brand-creative-director-ko/copywriter-ko 안 2 + Option A 카피 권고 / Phase 2a fa-devils-advocate 시나리오 4 High(42-50% 인지 실패율) 정량화 + Option A 채택 권고 / Phase 2b /codex(`codex exec --sandbox read-only --skip-git-repo-check`, default gpt-5.5) DESIGN.md token PASS + above-fold invariant PASS + teal #0F766E WCAG AA 5.47:1 PASS / Phase 2c /cc-gemini-plugin:gemini cross-file -58L~-20L + Next.js 16 routing/SSR 영향 없음 + Suspense 격리 유지 / Phase 3 marketing-skills:page-cro 회귀 3축 PASS(5초 명료성 ✅ / CTA hierarchy ✅ / above-fold 30초 ✅ 조건부). Owner Happy Path Gate 통과: 4 항목 verbal lock 확정 + 5 의견 충돌 일괄 수용("이렇게 가자") + DESIGN.md prose 4섹션 invariant ↔ 안 2 FAIL → S6 동시 개정 의무 인지. AGENTS.md 경고 "This is NOT the Next.js you know" → S6 진입 전 `node_modules/next/dist/docs/` 사전 참조 의무 재확인.

[S6 구현 의무 13항목 체크리스트]
1. Hero 카피 3건 lock: value prop "Burn Index puts a number on your drag." / subhead "Get your burn score. See where you rank against verified solo devs." / CTA "Join Burn Index"(현행 유지)
2. Sticky Header anchor lock: "Measure the burn. Own the ship."
3. globals.css teal #0F766E 4 위치(L24:25 `--young-coconut-dark` / L29:15 `--verified` / L30 `--verified-soft` rgba 동기화 / L1090 SVG fill `%230F766E`)
4. #safety 5 위치 완전 제거(lib/data.ts L52 V3_NAV / Footer.tsx L20 / globals.css L1105-1106 selectors / TrustSection.tsx L18 / LegacySections.tsx fallback)
5. V3_TRUST → BurnIndexSection prop 흡수 + TrustSection.tsx + FinalCTA.tsx 파일 삭제
6. LegacySections.tsx FinalCTA import 제거 + return null fallback
7. DESIGN.md ## Overview 동시 개정(L100-106 "four vertical sections" → "three vertical sections — Sticky Header, Hero, and a combined Burn Index + Trust section" / L226-227 "Do keep the four landing sections" → "Do keep the three landing sections in order: Sticky Header, Hero, Burn Index (with embedded Trust subsection)")
8. hairline divider class 신규(globals.css +5L)
9. alt-BG contrast L806 #burn 단일 스코프(#FAFAFA → #F5F5F5)
10. Sticky Header height 56px 압축
11. Hero padding 24px 압축
12. Sticky CTA outline/ghost 처리(Hero primary 차별)
13. Mobile 375x667 viewport 실측(≤ 528px fold fit 확인) + `npx @google/design.md lint DESIGN.md` error 0 통과(S8 진입 게이트)

[S10 회고]
- 무엇이 잘 됐나: 3차 /senior 5단계 dispatch(brand-creative-director-ko + brand-copywriter-ko + fa-devils-advocate + /codex + /cc-gemini-plugin:gemini + marketing-skills:page-cro)가 안 2 lock 근거를 5축으로 교차검증 — 특히 devil 시나리오 4(Hero 라인업 충돌 42-50% 인지 실패율) 정량화가 Option A 직설 카피("Burn Index puts a number on your drag.") 채택 hard gate가 됨. /codex 정적 검증으로 teal #0F766E WCAG AA 5.47:1 PASS + DESIGN.md token PASS + above-fold invariant PASS 3종 모두 사전 확인 → S6 구현 단계에서 lint 회귀 0건. 13항목 체크리스트가 6단계 Phase A-F로 자연 분할돼 owner Happy Path Gate(verbal "확인했어 통과") 작동, DESIGN.md ## Overview + Do's/Don'ts 동시 개정으로 prose 4섹션 invariant ↔ 안 2 FAIL 사전 해소. BurnIndexSection 260L → 296L (350L 한도 내) + TrustSection/FinalCTA 삭제로 cross-file -58L 추정치 부합.
- 다음엔 무엇을 바꿀까: ① Mobile 375x667 fold fit 검증을 plan v1 단계(S3)에 의무 항목으로 명시 — 본 사이클은 Phase F 직전에야 nav-tagline 가용 폭 한계(140px max-width + ellipsis fallback) 발견 후 Option 2(축소 노출) 결정. ② Turbopack 16.2 cross-worktree symlink 한계(`Symlink ... points out of the filesystem root`)는 `npx next dev --webpack` fallback 사용 — 다음 worktree 작업 시 dev server 명령 default를 webpack으로 두고 plan template에 명시. ③ V3_NAV "Challenges"/"Drops" 링크가 안 2 IA에서 anchor 없는 silent 404 → 별 사이클로 정리(본 사이클 scope 외, GA `nav_link_click_404` 모니터링 후 결정). ④ smoke-golden-regression.md owner 직접 손기록은 verbal confirmation으로 대체했음 — 다음 헤비 사이클부터 Owner Happy Path Gate 직접 파일 기록 강제(harness-loop B3 자동 우회 차단).


---

### 2026-05-23 [Track 3 — Nav width Gate A no-op (mobile premise refuted)]

- 문제: 2026-05-23 안 2 머지 사이클에서 V3_NAV "Drops"(5자) → "Workflow Drops"(14자) 변경. 375x667 모바일 sticky-header에서 nav-links + "Join Burn Index" CTA가 동시 표시될 경우 width overflow / wrap 가능성. 단계별 plan(`~/.claude/plans/context-precious-flute.md` Track 3)에서 Playwright 9개 viewport(375/390/430/767/768/920/921/1024/1280) 실측 후 wrap·overlap 발생 시 `V3_NAV.shortLabel?: string` + a11y(`aria-label` long) + analytics(`data-analytics-label` long) 분리 도입 예정.
- 버린 대안: ① 즉시 `shortLabel: "Drops"` 추가(premise 검증 없이) — codex Track 3 적대적 검토(`/tmp/codex-track-3.txt`)에서 a11y 함정 3건 지적: 스크린리더 의미 손실 / analytics funnel 혼재 / desktop ≥768px viewport branching 누락. 본 안 동시 채택 위험 High. ② `.nav-link { white-space: nowrap }` 방어 추가 — 본 사이클은 실측 후 결정으로 보류, Track 5 retro 안건으로 이월. ③ Footer.tsx hardcoded "Workflow Drops" → V3_NAV consumer 100% 통일(codex 제안) — drift TIL의 "Footer는 desktop 공간 충분 + semantic 분리" owner 결정 존중하여 미채택.
- 핵심 트레이드오프: shortLabel 도입 시 시각 표시(short) ↔ a11y/analytics(long) 분리로 SSOT 위반 위험 vs 모바일 viewport 실측 0 회귀 보존(no-op). Playwright 9 viewport 실측의 약 15분 cost vs premise 미검증 채택 시 retro에서 rollback 부담. codex 사전 검토 1회 비용으로 premise mismatch 사전 검출.
- 선택 이유: codex 적대적 검토에서 **premise mismatch 직접 검출** — `app/globals.css` L1242 `@media (max-width: 920px) { .nav-links { display: none; } }` 가 모바일(≤920px)에서 nav-links 전체를 숨김. 따라서 "Workflow Drops" 라벨 변경은 모바일 렌더 자체에 영향 없음(zero visual impact). 실측 대상은 desktop ≥921px로 이동. Playwright 9 viewport 실측 결과 desktop(921/1024/1280)에서 `scrollWidth == clientWidth`(91/91, 93/93, 124/124) → 텍스트 1-line 적합 + nav-links right ↔ cta left gap 139-498px → wrap·overlap 모두 0건. `.nav-link { padding: 6px 12px; font-size: 13px }`로 rectHeight 31.5px = lineHeight 19.5 + padding 12 누적은 padding-induced bloat이지 실제 wrap이 아님. Gate A 통과 → Step 3-3 shortLabel 구현 / Step 3-4 재측정 / Step 3-7 머지 전부 skip(no-op verdict). 위험 3축 0/3 충족(① 실패비용 < 2시간 ② 영향범위 0 ③ 관찰가능성 충족 — Playwright 실측 직접 검출).
- 강한 증거: ① codex Track 3 사전 검토(`codex exec --sandbox read-only --skip-git-repo-check` default gpt-5.5, `/tmp/codex-track-3.txt`)에서 "shortLabel은 기본 해법으로 두지 않는 게 맞다" 결론 + 모바일 nav-links display:none 직접 지적 / ② globals.css L1240-1254 mobile breakpoint 직접 read 확인 / ③ Nav.tsx L18-29 nav-links + nav-actions DOM 구조 직접 read 확인 / ④ Playwright 측정 스크립트(`scripts/measure-nav.mjs`) 9 viewport 실행 결과: 375-920에서 navLinkCount=0 또는 navLinksContainer.width=0 (mobile hidden), 921-1280에서 scrollWidth==clientWidth + gap ≥139px(desktop OK) / ⑤ 검증 게이트 3종 통과 — `npx tsc --noEmit` 0 errors / `npx @google/design.md lint DESIGN.md` error 0 warning 0 / `wc -l components/BurnIndexSection.tsx` 296 ≤ 350(Tier1 #10 invariant). AGENTS.md 의무 read 후 Next.js 16 routing 영향 없음 재확인.

[S10 회고]
- 무엇이 잘 됐나: codex 사전 검토 1회로 premise mismatch(모바일 nav-links 이미 hidden)를 실측 전 검출 → shortLabel 도입 + a11y/analytics 분리 + Footer hardcoded 정합 등 약 3 파일·40+ 라인 변경을 사전 회피. Playwright 측정 스크립트(`scripts/measure-nav.mjs` 9 viewport + wrap/overlap detection)가 1회 실행으로 Gate A/B 판정 자동화 — 향후 nav label 변경 회귀 가드로 재사용 가능(Track 4 visual baseline 후보). 위험 3축 0/3 충족 + Fast-Path 진입 조건 부합으로 검증 분리 원칙 면제, owner 단독 "no-op 완료" 발화 정당.
- 다음엔 무엇을 바꿀까: ① `scripts/measure-nav.mjs` 의 wrap detection heuristic `rectHeight > lineHeight*1.25`는 padding-induced bloat에서 false positive(desktop 3 viewport 전부 wrap=WRAP 오판) — heuristic을 `scrollWidth > clientWidth` 단일 신호로 단순화하거나 padding 차감 후 비교로 정정. Track 4 visual baseline 도입 시 본 스크립트를 e2e/nav-width.spec.ts로 승격하면 자동 갱신 후보. ② Track 3 plan의 premise("모바일 375에서 14자 라벨 overflow 가능")는 owner 직관 기반 — 안 2 사이클 후속이라 mobile breakpoint 검토 누락. plan template에 "premise validation step 0"(grep 대상 selector의 CSS visibility 확인) 항목 추가 안건. ③ `.nav-link { white-space: nowrap }` 방어 패턴은 본 사이클 미채택(실측 통과) — Track 5 retro 안건으로 이월, 향후 V3_NAV 라벨 추가 시 일괄 적용 검토.



---

### 2026-05-23 잔존 로컬 브랜치 마무리 + cherry vs ancestry 검증
- 문제: 4 local branches 잔존. ancestry로만 분류 시 C(chore/ci) 4 unique → 미머지 오판
- 버린 대안: (a) ancestry 단독 → squash-merge 놓침 / (b) `gh pr list --state all` 단독 → 로컬 브랜치 컨텍스트 부족
- 핵심 트레이드오프: cherry -v 추가 1 step vs 잘못된 보존/삭제 위험
- 선택 이유: codex 적대적 검토 "가장 큰 사각지대" 즉시 적용. C는 squash-merged stale, D는 진짜 WIP로 분리
- 강한 증거: `git cherry -v origin/main chore/ci-github-actions` 4개 commit 전부 `-` (content-equivalent). PR #2 머지 2026-05-20 확인

[S10 회고]
- 무엇이 잘 됐나: ancestry+cherry+PR 삼중 검증으로 C(squash-merged stale, `-D` retire)와 D(post-merge WIP 8 commits, default keep)를 정반대 결정으로 분리. archive tag 4개(`archive/<name>-2026-05-23`) 사전 작성으로 reflog 90일 만료 후에도 복구 가능. owner per-branch delegation("/codex와 토론해서 네가 결정해줘") + Tier 1 #4 destructive 명시 게이트(default=keep)로 D는 보존 — codex 권고 "기본값은 keep" 그대로 적용. Track 1 archive → Track 2 detach(`git switch --detach origin/main`, sister web/ main 점유 우회) → Track 4 local delete(-d×2 + -D×1) → Track 5 remote delete(A/C ALIVE, B GONE no-op) 7 Track 순차 0 회귀 통과. plan 예측 vs 실측 1건 발산(A remote ALIVE — plan은 GONE 예측)도 ls-remote 사전 점검으로 흡수.
- 다음엔 무엇을 바꿀까: ① branch 정리 routine에 `git cherry -v origin/main <branch>` 단계를 default로 편입 — owner 분류표 제시 전 자동 실행, ancestry-merged ≠ content-merged 함정 사전 차단. ② multi-worktree 환경에서 현재 worktree HEAD가 삭제 대상 branch에 걸린 경우 `git switch --detach origin/main` default 패턴화 — `git checkout main` 차단 회피 + workflow state pollution 0. ③ archive tag 6개월 미참조 cleanup 정책은 harness-loop.md "페이즈별 git tag" §와 정합 — 2026-11-23 점검 backlog 등록 안건.

---

### 2026-05-24 Burn Index 라벨 cross-domain 충돌 해소 — wire/display 분리 (Option A)
- 문제: `VerifLevel` 4-union(`Provider-synced`/`Device-synced`/`Estimated`/`Self-reported`)이 Apple Health·Strava의 fitness 도메인 라벨과 **verbatim 동일**. owner의 "Burn Index 5분류가 무슨 뜻이냐" 질문에 Claude가 fitness tracker로 환각 → cross-domain collision이 LLM·신규 visitor 양쪽에 동일하게 작동. 또한 5필터(all/provider/device/estimated/selfrep)는 verified 2종 분리 노출로 trust hierarchy를 평탄화.
- 버린 대안: (a) `VerifLevel` union 자체를 rename(예: `Api-verified`/`Cli-verified`) — `validateSummary.ts:52` Zod 리터럴 + Redis/localStorage 영속 + 8 test 파일 도합 70+ literal occurrence 마이그레이션 필요, schema v2 → v3 break / (b) raw literal 유지 + 툴팁만 추가 — passive·우회 가능, hallucination 차단 불충분 / (c) prefix 추가(`Token: Provider-synced`) — collision 미해소, "Provider-synced" 자체가 여전히 fitness와 표면 충돌 / (d) Option B `Verified/Manual/Skipped` 2단 — codex 비판 "Skipped는 의미 손실 + 3-tier 시각 hierarchy 깨짐".
- 핵심 트레이드오프: wire/display 분리는 모든 render 경로에 `verifDisplayLabel()` mapper 1단계 추가(추상화 비용). 대신 storage 계약 무변경 + `Record<VerifLevel, string>` 강제 exhaustiveness로 누락 케이스 컴파일 타임 차단 + ~5 render site 집중 변경(70+ 리터럴 무손).
- 선택 이유: Option A(wire format 유지 + display label 매퍼 도입). 필터 라벨은 codex 권고 **"Source-verified"** 채택(identity-verified / result-verified와 명확히 분리, "data source 수준의 검증"으로 disambiguate). 5필터 → 4필터(All / Source-verified / Estimated / Manual)로 verified 2종 묶음 + 3-tier hierarchy 시각 일관. 필터·캡션·badge·footer 도합 5 render site만 변경. `Single PR` 전략으로 코드+visual baseline atomic. /codex 2 round 검토(diagnosis + plan review) 사전 통과.
- 강한 증거: `f73ec78` commit 8 files +127/-41 main 직커밋. CI run `26361088576` 19 unit suites/247 tests + 23 e2e + 3 visual 모두 ✅(visual job 12.1s). 신규 `__tests__/burn-display-labels.test.ts` 3 케이스(매핑 exhaustiveness / wire literal 미반환 / fitness 도메인 단어 미반환) 그린. `visual-baseline-lock.yml` workflow_dispatch run `26361090630` 재캡처한 3 linux PNG가 직전 commit `ff34678` baseline과 **byte-identical**(sha256 일치) → visual 회귀 가드 사각지대 발견.

[S10 회고]
- 무엇이 잘 됐나: wire format(`VerifLevel`)은 Zod·Redis·localStorage 영속 계약으로 무변경 유지, display label만 render 시점 매핑하는 **wire/display 분리 아키텍처**로 70+ literal migration 회피 + ~5 render site 집중 변경. `Record<VerifLevel, string>` 매퍼가 컴파일 타임 exhaustiveness 강제 → tsc가 누락 케이스 자동 검출(라벨 4종 추가/변경 시 매핑 누락 → 빌드 실패). owner 첫 발화("Option A로 진행해줘. /codex와 토론하며 플랜짜줘") 단계에서 codex diagnosis 1라운드 + plan review 1라운드로 적대적 검토 사전 흡수 → 본 사이클 중 BLOCK·CONCERN 0건. `Source-verified` 라벨도 codex 권고 그대로 채택(owner Q에 "filter 라벨 verified 단독은 identity/result-verified와 충돌 가능 → Source-verified로 disambiguate"). DESIGN.md L110-113에 wire/display split 명시(라벨 도메인 충돌 발생 시 1차 안내 노트). 솔로 atomic Single PR + `gh api -X PUT /merge` 대신 main 직커밋(memory `feedback_coconutlabs-solo-no-review-request` 부합).
- 다음엔 무엇을 바꿀까: ① **visual.spec.ts scope에 Burn Index 영역 추가 검토** — 이번 사이클에서 재캡처 PNG가 기존 baseline과 byte-identical이라는 사실은 plan의 "label width shift > 2% → baseline 깨짐" 가설 자체를 reject. 즉 mobile-375(viewport above-fold = hero) + desktop sticky-header clip 어느 쪽도 Burn Index 라벨을 캡처하지 않음 → 시각 회귀 가드 **사각지대** 통과한 게 운빨, 의도된 sweep 아님. mobile-fullPage 또는 별도 burn-index clip 추가가 Track 5 backlog 후보. ② **cross-domain label collision 자동 식별 게이트** — `Provider-synced`/`Device-synced`/`Self-reported`처럼 도메인 중립 표현은 검색 1회로 fitness·health·activity 도메인 충돌 가능성이 드러남. CLAUDE.md memory `feedback_cross-domain-label-collision`("답변 전 product context 1차 확인")을 PRD/plan 작성 시 단방향 lint rule 후보(예: 신규 wire-format literal 등장 시 owner에게 "이 라벨이 다른 도메인과 표면 충돌하나?" 1문항 prompt). ③ /senior advisory + codex diagnosis 사전 진단 패턴이 본 사이클의 BLOCK 0건에 결정적 — **label/copy 변경 작업의 default 진입점**으로 편입 검토. owner 직관("이 라벨 무슨 뜻?")이 hallucination 신호로 작동하는 경우 plan 작성 전 codex 1라운드 의무화 안건.

---

### 2026-05-25 Burn Index 4-tab 필터 전체 제거 (Option A)
- 문제: BurnIndexSection 4-tab 필터(All / Source-verified / Estimated / Manual)가 실제 데이터와 어긋남. CLI 업로더(`lib/client/burn/collect.ts:230-239`)는 `tokenSource:"device"` + `costBasis:"estimated"` 하드코딩 → VerifLevel 4-union 중 `Device-synced`·`Estimated` 두 값만 산출. `Provider-synced`(API 커넥터 미구현) + `Self-reported`(manual entry UI 미구현)는 실제 import에서 **영구 빈값**. V3 시드 5명이 4분류 다 채우는 건 메서드러지 데모일 뿐, 사용자에게 "4 카테고리 다 채워질 것" 잘못된 약속 전달. 또한 Tier 헤더(`TIER_META`/`verifTier()`)가 이미 3-tier 분류를 시각화 → 필터는 UI 중복.
- 버린 대안: (a) Option B 필터를 2-tab(All/Estimated)로 축소 — 부분 제거지만 UI 중복은 그대로, "왜 2종만 있나" 질문 유발 / (b) Option C 필터 유지 + tooltip으로 "데이터 미수집 분류" 안내 — passive·복잡도 증가, hidden categories를 표시하는 anti-pattern / (c) 직전 burn-label-rename 사이클에 묶기 — atomic 1 PR 강제로 cross-domain collision fix와 필터 제거가 섞여 revert 위험 증가, 별도 사이클 결정.
- 핵심 트레이드오프: 전체 제거 시 V3 시드 self-reported 행을 사용자가 "왜 직접 필터 못 해?" 질문할 가능성 (Low). 대신 TIER_META 캡션 "Submitted by the builder, not yet confirmed."가 명시 → 별도 액션 없이 흡수. CLI 업로더가 향후 provider/self-reported를 지원하면 필터 다시 필요할 가능성도 있으나, 그 시점에서 데이터 분포 기반 재설계가 더 정확.
- 선택 이유: Option A(전체 제거). 위험 3축 0/3 (실패비용 < 30분, 영향범위 4모듈 UI-only 영속 데이터 무영향, 관찰가능성 visual baseline 가드) → Fast-Path 라이트 작업. /codex 사전 교차 검토 1회로 발견된 추가 항목 2건(DESIGN.md L276 "active-filter" prose 잔재 / 필터 제거 후 빈 imports copy 컨텍스트 부적합)도 반영. Single PR + `gh api -X PUT /merge` worktree-safe 패턴.
- 강한 증거: PR #18 `c267103` squash-merge. 3 files +5/-59 (`DESIGN.md` -1+1, `app/globals.css` -11, `components/BurnIndexSection.tsx` -47+3). 9 status checks 전부 green (test/parity x2/security x2/e2e/visual/Vercel preview x2). CI workflow run `26364786540` linux 3 PNG 재캡처 후 직전 baseline과 byte-identical 확인 → 직전 사이클 retro에서 식별한 Burn Index visual blind spot 재확인.

[S10 회고]
- 무엇이 잘 됐나: 백엔드 storage 계약 0줄 수정(`lib/validateSummary.ts:52` VerifLevel 4-union literal 무변경, V3_BUILDERS.verif 시드 데이터 무변경, `VERIF_DISPLAY` mapper 무변경, TIER_META/TIER_ORDER/verifTier/verifTierShort/groupByTier 5 헬퍼 무변경) → preservation contract 완벽 보존. /codex 사전 검토 1회로 plan에 누락된 항목 2건 사전 발굴(DESIGN.md L276 active-filter prose / empty copy 컨텍스트 부적합) → 본 사이클 중 BLOCK·CONCERN 0건. cross-reference grep(`Filter` type import / `matchesFilter` 호출)이 0건 사전 확인되어 단일 컴포넌트 격리 변경으로 안전. 위험 3축 0/3 → Fast-Path 라이트 작업으로 검증 분리 원칙 면제 + owner 단독 "완료" 발화 정당. `gh api -X PUT /merge` 패턴(memory `feedback_gh-pr-merge-worktree-conflict`)으로 worktree 충돌 무사 회피. main fast-forward `b789af6..c267103` 후 worktree/local branch/remote branch 3종 cleanup 완료.
- 다음엔 무엇을 바꿀까: ① **visual.spec.ts Burn Index blind spot 재확인** — 직전 burn-label-rename 사이클에서 식별된 사각지대(mobile-375 above-fold + desktop sticky-header clip이 burn section 미캡처)가 본 사이클에서도 동일하게 재현. 필터 4 버튼 + CSS 11줄 제거가 visual baseline에 0 byte 영향. Track 5 backlog `mobile-fullPage` 또는 `burn-index clip` 추가가 2 사이클 연속 동일 안건 → 우선순위 격상 검토. ② **CLI 업로더의 wire literal hardcoding 일관성 점검 backlog** — `tokenSource:"device"` + `costBasis:"estimated"`가 `lib/client/burn/collect.ts:230-239`에 하드코딩되어 있어 4-union 중 2종만 실제 사용. UI 필터 제거로 표면은 정합되었으나 **wire format 4-union 자체가 over-provisioned** 가능성. CLI 업로더가 향후 provider/self-reported 산출 능력을 가지지 않을 거라면 schema v3 마이그레이션 시 2-union으로 축소 검토. 단 storage 영속 데이터 호환을 위해 `Provider-synced`/`Self-reported` 입력 수용은 유지(read-back 호환). ③ **plan 단계 codex 사전 검토 패턴 정착** — 직전 burn-label-rename + 본 사이클 모두 plan 단계에서 codex 1라운드가 BLOCK 0 사이클의 결정적 요인. label/copy/UI removal 작업의 default 진입점으로 편입 검토 안건 직전 사이클에서 등장 → 본 사이클 재확인. 2 사이클 연속 효과로 다음 retro(분기별 점검)에서 CLAUDE.md 단방향 룰화 후보.

---

### 2026-05-25 Burn Index 카피 정직성 정리 (Hybrid Honesty)

- 문제: 직전 4-tab 필터 제거 사이클 후 5개 문구가 **남은 over-promise** 형성. (1) section-sub "Verified Efficiency Score" 약어 풀이가 마치 사용자 fix가 검증된 것처럼 읽힘 (2) methodology caption "Source-verified costs rank above estimates" — CLI 업로더(`lib/client/burn/collect.ts:230-239`)는 `tokenSource:"device"`/`costBasis:"estimated"` 하드코딩 → **실제 import에 source-verified 행 0건 영구**. 헤더는 "올라간다"고 약속하지만 비교 대상이 없음 (3) `TIER_META.selfrep.caption` "Submitted by the builder, not yet confirmed." — manual entry UI 미구현, V3 시드 1행(@sora)만 표시되는데 사용자에겐 "곧 confirm될 것" 인상 (4) section-note "Trust order" — 4 wire literal의 *도메인 라벨*은 trust지만, 실제 import 분포(verified·estimated 2종)로는 *evidence depth* 정도가 정확 (5) "Manual entry1" 시각 artifact — `.lb-tier-count` pill bg `#FAFAFA` on tier-head bg `#FFFFFF` = ~1.04:1 contrast로 pill 경계 invisible → label+count가 단일 문자열로 읽힘 (CSS 버그).
- 버린 대안: (a) **A: 완전 정직 (CLI 업로더 pipeline 수정 동반)** — `Provider-synced`/`Self-reported` 실제 산출 능력 추가 후 카피 그대로 유지. 견적 ~3사이클, multi-PR. 카피 정직성 cycle과 atomic 분리가 안 됨 → 검증 표면 폭발 (b) **B: 텍스트만 정직** — TIER_META.selfrep 캡션 + section-sub만 수정, "Source-verified" 헤더 prose는 유지. CSS 1.04:1 contrast bug 미수정 시 "Manual entry1" 그대로. 솔로 1 PR에 합쳐서 처리 가능한 사소한 fix를 다음 사이클로 미루는 게 비합리 (c) 디자인 시스템 전면 rebrand("Evidence Index" 등) — 5 phrase 수정 범위 초과, S-1 advisory 재진입 필요.
- 핵심 트레이드오프: 옵션 C(하이브리드 정직)로 카피만 정직 정렬 + CSS 1줄 fix + Footer 1단어 rename + DESIGN.md 1 prose 동기화. 단점: "Source-verified" 그룹 헤더는 메서드러지 데모이므로 V3 시드 외 사용자 import에는 영구 빈 그룹으로 남음. 별도 액션 없이 **V3 시드 행은 카테고리 정의자 역할**로 정당화. 향후 provider/self-reported 산출이 실제 출시되면 그룹 헤더가 자연스럽게 채워짐 — forward-compatible.
- 선택 이유: Option C(하이브리드 정직). 위험 3축 0/3 (실패비용 < 30분 UI/copy-only rollback git revert / 영향범위 4파일 BurnIndexSection+Footer+globals.css+DESIGN.md, 영속 데이터·storage 계약·wire literal 0줄 수정 / 관찰가능성 visual baseline가 카피 변경 잡음). Fast-Path 라이트 작업. 결정 단계에서 `/codex:rescue`(approach validation) + `/codex:adversarial-review`(5-phrase wording challenge) 2-round 토론으로 (A) demo seed가 헤더에 카테고리 정의자 역할 한다는 정당화 (B) "Trust" → "Evidence" rename은 도메인 중립성·정직성 양립으로 합의. 솔로 1 PR + `gh api -X PUT /merge` 패턴.
- 강한 증거: PR #19 `f15d060` squash-merge. 6 files +231/-10 (`DESIGN.md` +9/-2, `app/globals.css` +1, `components/BurnIndexSection.tsx` +5/-5, `components/Footer.tsx` +1/-1, `docs/decision/decision-log.md` +23, `docs/plans/burn-copy-honesty.md` +193 신규). 9 status checks 전부 green (test/parity x2/security x2/e2e/visual/Vercel preview x2). 특이: visual baseline `26375701635` Burn Index section 변경에도 baseline diff 0 byte 재확인 → 직전 2 사이클(burn-label-rename + burn-filter-removal)에서 식별된 사각지대(mobile-375 above-fold + desktop sticky-header clip)가 본 사이클에서도 동일 재현. **3 사이클 연속 동일 backlog 안건**.

[S10 회고]
- 무엇이 잘 됐나: ① **storage 계약 + wire literal + 시드 데이터 0줄 수정** preservation contract 완벽 보존 (lib/validateSummary.ts:52 VerifLevel 4-union / lib/data.ts V3_BUILDERS.verif / VERIF_DISPLAY / verifDisplayLabel / 5 helper 무변경). CLI 업로더 pipeline fix는 별도 사이클로 분리 → atomic 1 PR 유지. ② plan 단계에서 `/codex:rescue` + `/codex:adversarial-review` 2-round 토론으로 (a) demo seed가 카테고리 정의자 역할 정당화 (b) "Trust" → "Evidence" rename이 도메인 중립성·정직성 양립 합의 → 사이클 중 BLOCK·CONCERN·revert 0건. ③ 위험 3축 0/3 → Fast-Path 라이트 + 검증 분리 면제 정당. ④ Manual entry 카운트 pill contrast 1.04:1 bug를 사이클 결정 단계(시각 artifact 탐지)에서 발견 → 카피 정직성 PR에 atomic 묶음 처리(별도 PR 1개 절약). ⑤ `gh api -X PUT /merge` 패턴(memory `feedback_gh-pr-merge-worktree-conflict`)으로 worktree 충돌 무사 회피. main fast-forward `c267103..f15d060` 후 worktree/local branch/remote branch 3종 cleanup 완료.
- 다음엔 무엇을 바꿀까: ① **visual.spec.ts Burn Index 사각지대 — 3 사이클 연속 backlog 안건 격상**. burn-label-rename / burn-filter-removal / 본 사이클 모두 Burn Index 섹션 카피·CSS·필터 변경에도 visual baseline 0 byte 영향. 사각지대가 (a) mobile-375 above-fold가 Hero에서 끊김 (b) desktop sticky-header clip이 Burn Index 캡처 못함. 다음 사이클은 **콘텐츠 변경이 아니라 visual.spec.ts에 burn-index dedicated clip 또는 mobile-fullPage 추가**가 우선. 본 backlog가 격상 결정 후 deferred 2 사이클째 → S-1 advisory 진입 또는 즉시 plan 작성 검토. ② **CLI 업로더 hardcoding pipeline 정직 정렬** — `lib/client/burn/collect.ts:230-239` `tokenSource:"device"` + `costBasis:"estimated"` 하드코딩이 본 사이클 카피 정직 정렬의 *원인 자체*. 카피로 "오늘 모든 실제 import는 token-collected estimated"를 정직 명시했으므로 **표면 정합**은 달성. 다음 단계는 (a) Provider-synced 실제 산출 능력 추가(API 커넥터 구현) OR (b) wire format 4-union을 2-union으로 축소(schema v3 마이그레이션). 본 사이클은 (a)/(b) 미실행 상태로 카피 정직성만 달성 → 진정한 정합은 다음 사이클의 본질적 backlog. ③ **plan 단계 codex 사전 검토 패턴 — 3 사이클 연속 효과 확인**. burn-label-rename + burn-filter-removal + 본 사이클 모두 plan 단계 codex 1라운드가 BLOCK 0 사이클의 결정적 요인. 본 사이클은 `/codex:rescue` + `/codex:adversarial-review` 2-round 형식으로 확장 — wording 결정에 특히 효과적(다른 모델의 적대적 시각이 over-promise 탐지에 유리). label/copy/wording 작업의 default 진입점으로 편입 강력 후보 → 분기별 retro에서 CLAUDE.md 단방향 룰화 결정 안건.


---

### 2026-05-26 B.4 Success state lift-up + 3-stack a11y 정합 (Additive lift-up)

- 문제: A.12에서 Codex가 deferred한 MAJOR 2건이 B.4로 이관. (1) MAJOR #1: `JoinBurnIndexForm`이 `showSuccess`·`successHandle` state를 직접 보유 → 모달 unmount 시 success card도 동시 소실. 사용자가 import 직후 모달을 닫으면 시각적 피드백이 사라짐. lift-up이 권고됨. (2) MAJOR #2: FSA path에서 `PostUploadSurvey` + `UploadSuccessCard`가 inline 스택. 시각은 작동하나 focus order / TAB 순서 / SR(screen reader) announcement 우선순위가 미스펙. 두 row 모두 aria-live="polite" 동일 우선순위로 announce → race condition 가능.
- 버린 대안: (a) **State 완전 치환** — `JoinBurnIndexForm`의 `showSuccess` state를 LandingApp으로 lift-up하고 form 내부 success card를 제거. 모달 안에서는 success 피드백 사라지고 모달 닫힌 후에만 배너 표시 → 기존 `e2e/upload-success-card.spec.ts` 4 baseline 테스트 전부 깨짐, A.12 invariant 위반(`onSuccess`/`onImport` 2-prop 변경 불가). (b) **모달 닫힘 차단 + success card 유지** — POST 200 후 사용자가 close button을 disable. UX 안티패턴(escape 차단), 한 손가락이라도 모달 밖 클릭하면 stuck. (c) **Toast로 대체** — closeModal 시 자동 toast가 화면 띄움. 이미 `showToast`는 `closeModal()` 호출 시 표시되지만, toast는 3-4초 후 사라짐. lasting visual feedback 부족.
- 핵심 트레이드오프: Additive lift-up은 **2 success surface 공존** (모달 내부 카드 + 페이지 배너). 모달이 열려 있을 땐 카드, 닫힌 후엔 배너 — 시각 중복 같지만 timing은 mutual exclusive. 단점: 코드 surface가 1 → 2로 증가 (UploadSuccessBanner.tsx 신규). 대신 기존 e2e 4 baseline 무회귀 + A.12 invariant 7종 전부 보존 + lift-up 효과(모달 닫혀도 success 잔존) 동시 달성.
- 선택 이유: **Option D Additive lift-up**. 기존 `.upload-success-card`(in-modal)는 zero-touch, 새 `.upload-success-banner`(page-level)를 별도 className으로 추가. `handleImport` 시그니처를 `(entries, handle?: string) => void` backward-compat 확장으로 invariant 보존. 모달 unmount 시 `lastSuccess` state는 LandingApp이 보유 → modal === null && lastSuccess 조건에서만 배너 렌더. MAJOR #2는 code change 없이 `docs/a11y/upload-stack-review-2026-05-26.md` review-only로 분리 — focus order / TAB sequence / SR priority를 문서화. 위험 3축 3/3 충족 (실패비용 충족: success 누락 시 confusion / 영향범위 충족: 5파일 + 모든 사용자 success flow / 관찰가능성 충족: modal close timing race condition은 unit test로 못 잡음 — e2e만 가능) → `/codex` 교차 리뷰 강력 권장 임계.
- 강한 증거: 기존 `e2e/upload-success-card.spec.ts` 4 tests 전수 분석 — selector `.upload-success-card`가 page-wide unique → 신규 banner는 distinct className `.upload-success-banner`로 충돌 차단. `JoinBurnIndexForm.tsx` L286 (FSA path) + L387 (manual path) 2 콜사이트에서 `onImport?.(data.entries)` 호출 → `onImport?.(data.entries, trimmed)` 2nd arg 확장만 추가. `LandingApp.tsx` L151-154 `handleImport`는 `(entries: ImportedEntry[]) => void` → `(entries, handle?: string) => void` 확장. A.12 invariant 7종 (props 2-arity / handle raw payload / aria-live=polite / scrollIntoView block:nearest + reduced-motion instant / Korean copy / CTA window.location.hash="#burn" / scope #burn 단독) 전부 보존.
