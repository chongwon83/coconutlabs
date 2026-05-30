# 핸드오프 — Topic 3 (comms) 인바운드 contact + 옵션 이메일 옵트인 세션 종료 (2026-05-30)

## 완료된 작업

| commit | 내용 |
|--------|------|
| `765694f` | feat(comms): inbound contact mailto + 옵션 consent-gated 이메일 옵트인 + 병렬 EmailStore / `/api/emails` / `"emails"` 토큰 kind + legacy "Notify me" 제거 (PR #38, rebase merge) |

Vercel Production: `success` (sha `765694f`, 2026-05-29T16:05 UTC) — `www.coconutlabs.xyz` 라이브 직접 확인.

이 사이클로 `/refine`(2026-05-29) 3-topic 사이클 종료: Topic 1 (WCAG teal) + Topic 2
(VES de-emphasis)는 `5d6af4f`, Topic 3 (comms)가 본 핸드오프.

## 현재 상태

- **인바운드** — footer `Contact` → `mailto:chongwon5026@gmail.com` (`lib/data.ts` `CONTACT_EMAIL`
  상수, 임시 — coconutlabs.xyz alias로 **1줄 교체** 예정).
- **아웃바운드** — `PostUploadSurvey` step 2 = 옵션 이메일 옵트인 (valid email **AND** consent
  체크박스 게이트, FSA 경로에서만 렌더). 병렬 `EmailStore`(File/Redis/Memory, `getEmailStore()`
  factory — BurnStore는 리더보드 하드코딩이라 별도 store), Redis key `burn:emails:v1`, 정규화
  이메일 dedupe. 새 `/api/emails` POST: Bearer → `verifyAndConsumeToken("emails")` → 400
  (invalid email / `consent!==true`) → fire-and-forget store write. `"emails"` `TokenKind` 추가.
- **레거시 정리** — 오해 소지 "Notify me" 버튼 제거 (prod 트리쉐이크, 라이브 count 0 확인).
- **프라이버시** — 이메일 = 유일한 consented PII carve-out. "Zero / aggregated only"
  (code/prompts/paths) 카피 **불변**. 옵트인 카피는 handle 연동을 명시. PII 사인오프는
  `docs/decision/decision-log.md`에 기록.

## 검증 (Evidence)

| Gate | 결과 |
|------|------|
| tsc | clean |
| vitest | 386/386 (34 files) |
| build | OK (`/api/emails` dynamic route) |
| e2e topic3 | 3/3 (footer mailto · opt-in 게이팅+payload · decline no-POST) |
| PR #38 CI | parity · security · test · e2e · visual · Vercel 전부 green |
| main post-merge CI | security-test · parity-test · CI(test/e2e/visual) green |
| visual baseline | **no rebaseline** (footer·모달 모두 above-fold clip 밖, visual green) |
| prod 라이브 | footer mailto + `/api/emails` 401 게이트 직접 확인 (TIL 2026-05-30 참조) |

## codex adversarial review (4 findings + owner 판정)

1. PII write (inherited token trust — 누구나 emails 토큰 발급) → **ship MVP-accepted + documented**
   (메일러 없음 = 증폭 없음; private store + dedupe; double opt-in은 메일러 생기면).
2. nonce GET-then-DEL race (token.ts, "atomic" 주석은 거짓) → **pre-existing**, 전 kind 공유,
   emails는 dedupe로 idempotent → benign. flag-only.
3. opt-in copy honesty (handle 연동 미고지) → **FIXED** (카피 강화).
4. silent opt-in fail at rate limit (emails 토큰이 5/min 중 5번째 발급 → 추가 telemetry/retry가
   429 트립 → 무음 drop → onDone가 성공처럼 보임) → **accept for MVP, documented**.

## 정직한 한계 / 다음 사이클 후보

1. 메일러/ESP 미연결 → 이메일은 수집만 되고 발송 없음. double opt-in defer.
2. unauthenticated `emails`-token 발급 accepted (하드닝 = 발급 인증 또는 라우트별 strict limit).
3. `CONTACT_EMAIL` → coconutlabs.xyz alias 교체 (owner, 1줄).
4. nonce GET-then-DEL race 진짜 atomic화 (Redis Lua/`GETDEL`) — 전 kind 공통 개선.

## 참고

- 이 세션 TIL: `docs/til/2026-05-30-apex-www-307-redirect-curl-smoketest.md` (프로덕션 스모크
  테스트 시 apex 307 리다이렉트 함정).
- 메모리 핸드오프: `project_topic3-comms-shipped-2026-05-30`.
