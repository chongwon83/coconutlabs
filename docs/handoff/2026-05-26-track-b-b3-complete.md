# Track B B.1-B.3 Complete — Handoff (2026-05-26)

이 문서는 Track B 진행 중 B.1-B.3 완료 후 다음 세션에서 이어가기 위한 단일 진입점이다.

---

## 새 세션 첫 메시지

```text
docs/handoff/2026-05-26-track-b-b3-complete.md를 먼저 읽고,
"다음 1 action"부터 이어줘.

현재 main은 B.1, B.2, B.3 완료 및 Production 배포 성공 상태.
안전하게 다음 Track B 작업으로 진입해줘.
```

---

## 현재 상태

| 항목 | 상태 |
|------|------|
| Branch | `main` |
| Latest main commit | `36b868d feat(hero): wire stat bar to Burn Index stats` |
| B.1 Hero CTA redesign | 완료, PR #23 squash merge |
| B.2 Burn Index SWR polling | 완료, PR #24 squash merge |
| B.3 Hero stat bar real-data wiring | 완료, PR #25 squash merge |
| Vercel Production | success |
| Production deployment URL | `https://coconutlabs-c3ukgmnn3-chongwon-shins-projects.vercel.app` |

GitHub Actions on latest `main`:

- `test`: success
- `e2e`: success
- `visual`: success
- `security`: success
- `parity`: success

---

## B.1-B.3 완료 요약

### B.1 Hero CTA redesign

- Hero CTA를 green + black + XL 방향으로 재디자인.
- Linux visual baseline drift를 CI artifact 기반으로 갱신.
- PR #23 merge commit on main: `7487f52`.

### B.2 Burn Index SWR polling

- `components/LandingApp.tsx`의 `/api/burnindex` 로딩을 one-shot fetch에서 SWR polling으로 변경.
- refresh interval: 30초.
- failed refresh 시 마지막 정상 leaderboard rows 유지.
- `swr` dependency 추가.
- PR #24 merge commit on main: `da9fa17`.

### B.3 Hero stat bar real-data wiring

- Hero secondary stat bar가 `/api/burnindex/stats`를 SWR로 30초 polling.
- empty store fallback:
  - Builders: `Be first`
  - Tokens collected: `0 tokens`
  - AI spend: `$0 spent`
- import 성공 직후 `mutateStats(statsFromEntries(entries), { revalidate: false })`로 Hero stats 즉시 반영.
- failed stats refresh 시 마지막 정상 stats 유지.
- PR #25 merge commit on main: `36b868d`.

주요 변경 파일:

- `components/Hero.tsx`
- `components/LandingApp.tsx`
- `e2e/live-badge-polling.spec.ts`
- `e2e/preflight.spec.ts`

---

## 검증 증거

Local verification:

```bash
npm run typecheck
npm run lint
npm test
npx playwright test
npm run build
```

결과:

- typecheck: pass
- lint: pass, 기존 warning 17개 유지
- unit: 267 passed
- e2e: 42 passed
- build: pass

CI:

- PR #25 checks: all green
- latest `main` push checks: all green
- Vercel Production deployment: success

---

## 중요한 CI 실패와 수정

B.3에서 Hero stat bar까지 SWR polling을 추가한 뒤, PR #25 첫 CI e2e가 실패했다.

실패 지점:

```ts
await page.reload({ waitUntil: "networkidle" });
```

파일:

- `e2e/preflight.spec.ts`

원인:

- 페이지는 정상 렌더링됐지만 live SWR polling 때문에 dev-mode에서 `networkidle`이 안정적인 readiness signal이 아니게 됐다.
- 실패한 테스트는 새 B.3 동작 테스트가 아니라 기존 preflight viewport invariant였다.

수정:

```ts
await page.reload({ waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
```

CSS 상태는 기존처럼 `toHaveCSS(...)`로 직접 검증한다.

관련 TIL:

- `docs/til/2026-05-26-swr-polling-networkidle.md`

---

## 다음 1 action

Track B 권장 순서상 다음은 **B.4**다.

B.4 범위:

- Success state lift-up architecture 검토 및 구현.
- FSA + PostUploadSurvey + UploadSuccessCard stack/focus/a11y 정합 검토.

주의:

- B.4는 A.12에서 이관된 Codex MAJOR #1, #2와 연결된다.
- `JoinBurnIndexForm`의 기존 success card 회귀를 먼저 읽고 시작한다.
- B.4 전에는 `e2e/upload-success-card.spec.ts`를 baseline으로 삼는다.

첫 read 대상:

- `docs/handoff/2026-05-25-track-b-entry.md`
- `components/forms/JoinBurnIndexForm.tsx`
- `e2e/upload-success-card.spec.ts`
- `components/LandingApp.tsx`
- `components/Hero.tsx`

---

## 보존해야 할 현재 untracked items

이번 B.3 작업 중 아래 파일들은 건드리지 않았다. 다음 세션도 별도 지시 없으면 보존한다.

- `.gstack/`
- `tasks/F1-nonce-atomic-del-backlog.md`
- `tasks/folder-picker-ux-finding1/SESSION_HANDOFF.md`
- `tasks/token-path-real-verify/SESSION_HANDOFF.md`

---

## 운영 메모

- PR merge는 계속 squash merge 사용.
- macOS local visual PNG commit 금지. visual baseline 갱신은 Linux CI artifact 기반으로만 진행.
- `networkidle`은 polling이 있는 페이지에서 generic readiness로 쓰지 않는다.
- live URL 확인은 commit SHA의 Vercel Production deployment status를 기준으로 판단한다.
