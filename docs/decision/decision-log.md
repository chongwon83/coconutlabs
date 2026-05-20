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
