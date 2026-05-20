# CoconutLabs — Codex Review Input Package (Production Rollout Gate)

작성일: 2026-05-20
목적: 5-axis production rollout gate를 codex와 적대적으로 검토하기 위한 입력 패키지.

---

## 1. Product Context (5줄 요약)

CoconutLabs는 AI 코딩 도구(Claude Code CLI, Codex CLI) 사용자의 **로컬 로그에서 원본 prompt/code 없이 토큰 사용량 요약만 추출**하여 공개 리더보드(Burn Index)에 업로드하는 서비스다. 핵심 슬로건: "Tiny tokens. Big ships."

보안 약속: 업로드되는 데이터는 **9개 필드만** (tool, model, tokenCount, estimatedCostUsd, sessionCount, activeDays, projectHash, verification, weekKey). raw prompt / response / source code / file path는 절대 업로드 금지.

기술 경로 (Phase 2, FSA): 사용자가 브라우저에서 `.claude/projects` + `.codex/sessions` 폴더를 선택하면, **클라이언트에서만** JSONL 파싱 → 9-field envelope 생성 → 서버 측 validateSummary 통과 후 저장. 원본 파일은 서버에 도달 불가.

Feature flag: `?auto-detect=1` — URL에 이 파라미터 + Chrome/Edge의 `showDirectoryPicker` 존재 시에만 FSA UI 노출. 현재 **기본 OFF (dogfood only)**. 기본 ON 전환은 "5-axis Gate" 별도 PR.

본 작업: 5축을 자동 측정하는 CI/서버 인프라를 구축하여, **5축 미달 시 ON 전환 PR이 GitHub Action으로 자동 차단**되도록 만든다.

---

## 2. `?auto-detect=1` Flag 현재 구현

파일: `web/components/forms/JoinBurnIndexForm.tsx:48-57`

```tsx
const params = useSearchParams();
const autoDetect =
  params.get("auto-detect") === "1" &&
  typeof window !== "undefined" &&
  "showDirectoryPicker" in window;
```

3중 AND 조건: (1) URL param `?auto-detect=1`, (2) 브라우저 환경, (3) Chrome/Edge FSA 지원.

**Gate 조건 자체는 본 작업에서 변경 금지.** ON 전환은 별도 PR.

---

## 3. Privacy Invariants (위반 시 commit blocker)

handoff §10 원문에서:

1. `burn-summary.schema.json` keeps `additionalProperties: false` on root AND on every row. 9 required row fields unchanged. Schema-version stays `"2"`.
2. `~/.coconutlabs/salt` (browser IndexedDB equivalent 포함) NEVER appears in any network payload.
3. Per-field zeroing: poisoned key zeroes ONLY that field. `model`, `timestamp`, other valid fields survive.
4. `model` failing either regex OR family-prefix gate collapses to `"unknown"` in BOTH implementations.
5. Server `redisStore` typed-only `JSON.stringify` — no spread of arbitrary objects; all keys whitelisted explicitly.
6. `import-history.json` record shape: `{handle, weekKey, totalTokens, importedAt}` only.
7. DESIGN.md 6 invariants preserved. New UI tokens must pass `npx @google/design.md lint DESIGN.md`.
8. FSA pickers reject folder whose `.name` does not end in `projects` or `sessions`. No home-dir picker.
9. Salt import: validate hex/base64 shape + length. Reject API key prefixes (`sk-`, `xoxb-`, `ghp_`, `eyJ`).
10. NO raw `content`/`message.content`/payload-text read OR serialized. JSON.parse filtered synchronously.
11. NO live pricing fetch. Build-time codegen only.
12. Production default stays Phase 1 quickstart. `?auto-detect=1` dogfood until 5-axis Gate passes.

---

## 4. 기존 5축 원안 (modular-bubbling-ember.md §"Production rollout Gate")

```
Production rollout Gate (5축, 전부 충족):
  1. 6+ 외부 사용자가 Phase 1으로 burn summary 업로드 완료
  2. 평균 setup 시간·실패 사유 측정 (질문 폼 또는 로그)
  3. 터미널 단계가 진짜 병목임이 증거로 확인
     (50%+ 사용자가 "터미널 설정이 가장 어려웠다" 응답
     OR 측정된 drop-off가 quickstart 단계에서 발생)
  4. Fixture parity 통과: TS 출력 ≡ Python 출력 (semantic equality;
     generatedAt·세션 순서 제외)
  5. 자동 보안 테스트 통과: fetch/XHR 인터셉트 → 9-field 외 키·raw text
     가 네트워크로 나가지 않음 증명
```

---

## 5. 현재 진척도 (2026-05-20 기준)

### 4축 (Fixture parity) — ✅ 이미 통과

`web/__tests__/burn-parity.test.ts` 존재 + 42/42 vitest PASS.
Python↔TS `Number(value.toFixed(decimals))` 3015-case parity sweep 완료.
단, **CI에서 자동 실행 workflow 없음** (GitHub Actions 미설정).

### 5축 (Security test) — ✅ 이미 통과

`web/__tests__/burn-security.test.ts` 존재 + 42/42 vitest PASS.
SECRET_SENTINEL_XYZ_2026 leak test + forbidden-key regex + 9-field 화이트리스트 검증.
단, **CI workflow 없음**.

### 1·2·3축 (외부 사용자·setup 시간·터미널 병목) — ❌ 측정 인프라 0

- 현재 `web/app/api/burnindex/route.ts` POST 핸들러에 distinct count 없음.
- 클라이언트 telemetry 이벤트 없음.
- 후속 survey 폼 없음.

### `unresolved_risks` (handoff §7 기준)

- **Risk 3**: "No automated security test exists yet" — Step C.5로 해소됐으나 CI 미등록.
- **Risk 2**: Codex 4th audit not yet run (별도 작업, handoff Step B).
- **Risk 5**: Browser-only salt identity divergence (python vs browser, distinct hash).

---

## 6. 자동화 목표 (본 작업)

| 축 | 측정 방법 | 임계값 | 자동화 형태 |
|-----|---------|--------|------------|
| ① 외부 사용자 | `/api/burnindex` POST distinct project_hash count | ≥ 6 | metrics API + CI |
| ② setup 시간·실패 | 클라이언트 start/complete/fail 이벤트 (9-field 준수) | 미확정 | telemetry + survey |
| ③ 터미널 병목 | funnel drop-off OR survey "어느 쪽이 어려웠나?" | ≥ 50% | telemetry + survey |
| ④ Fixture parity | 기존 vitest 재사용 | 42/42 PASS | GitHub Action |
| ⑤ Security test | 기존 vitest 재사용 | 42/42 PASS | GitHub Action |

게이트 자동화: `.github/workflows/production-rollout-gate.yml`
- Trigger: `JoinBurnIndexForm.tsx`의 `autoDetect` 초깃값 변경 PR
- Job: 5축 조회 → 모두 PASS면 `gate-pass` check ✅, 미달 시 ❌ + PR comment

---

## 7. Codex 검토 요청 사항 (5라운드)

각 라운드에서 codex가 답해야 할 질문:

**R1**: 5축이 privacy invariant(9-field whitelist) 위반을 막기에 충분한가? 빠진 축은?
→ 특히 측정 telemetry 자체가 raw data 유출 경로가 될 수 있는지 (meta-privacy)

**R2**: 1·2·3축의 측정 임계값(6명·미확정·50%+)이 임의적인가? 통계적·운영적 근거?
→ "외부 사용자" 정의: distinct project_hash vs distinct handle vs distinct session_id

**R3**: ON 전환 후 1·2·3축이 하락하면 자동 롤백(OFF 복귀) 트리거가 필요한가?
→ rollback 조건 설계 가이드

**R4**: 측정 telemetry 이벤트 페이로드가 9-field invariant를 위반할 수 있는가?
→ 이벤트에 어떤 필드가 들어가면 안 되는지 명문화

**R5**: 4축 "semantic equality" 정의 — `generatedAt`·세션 순서 외에 무시할 필드는?
→ `weekKey` 계산 방식 차이, activeDays 집계 방식 차이, float 정밀도 임계값

---

## 8. 기술 스택 컨텍스트

```
Next.js 16.2.6 (AGENTS.md 주의: 훈련 데이터와 다름)
TypeScript strict
Vercel 배포 (Upstash Redis, 로컬은 FileBurnStore)
vitest (현재 42 tests)
@upstash/redis ^1.38.0
No session auth (handle = plain text, no login)
```

Account: `chongwon83 / chongwon5026@gmail.com` (solo, no PR review required)
