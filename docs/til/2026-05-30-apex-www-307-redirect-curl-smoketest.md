# TIL — Apex→www 307 Redirect Breaks curl Smoke Tests

Date: 2026-05-30

## Context

Topic 3 (comms) 배포 후 프로덕션 스모크 테스트로 ① footer `mailto:` 노출 여부와
② 새 `/api/emails` 라우트 배포 여부를 `curl`로 확인하려 했다.

`coconutlabs.xyz`는 apex 도메인이고, Vercel이 이를 `www.coconutlabs.xyz`로
**307 (Temporary Redirect)** 시킨다. apex 자체는 콘텐츠를 서빙하지 않는다.

## Symptom

두 번 연속 거짓 신호에 속을 뻔했다.

1. `curl -s https://coconutlabs.xyz/ | grep -o 'mailto:...'` → **빈 결과**.
   apex가 돌려준 307 리다이렉트 stub HTML에는 footer가 없어서 grep이 아무것도
   못 찾음 → "footer 미반영"으로 오판할 뻔.
2. `curl -X POST https://coconutlabs.xyz/api/emails` → **HTTP 307**.
   401(정상 인증 게이트)이 아니라 307이 떠서 "라우트가 이상하다"로 오판할 뻔.

## Root Cause

- apex는 www로 307 리다이렉트만 한다 (307은 메서드·바디 보존).
- 리다이렉트 미추적 `curl` + `grep` / `-w "%{http_code}"`는 **리다이렉트 stub**에
  대해 실행돼서 실제 200/401 대신 307·빈 본문을 본다.
- `grep ... | head -N || echo NOT_FOUND` 패턴은 `head`가 항상 0을 반환해 `||`가
  안 터지므로 "빈 결과"가 에러로도 안 잡힌다 — 기존 학습
  `grep-head-exit-code-masks-conditional`와 같은 계열의 함정.

## Fix / Rule

프로덕션 스모크 테스트는 **둘 중 하나**로 한다:

- 정규 호스트(`www.`)로 **직접** 요청: `curl https://www.coconutlabs.xyz/...`
- 또는 `-L`로 리다이렉트 추적 (307 메서드 보존 → POST가 www로 재전송됨):
  `curl -L -X POST ...`

그리고 신뢰도 확보를 위해 **대조군**을 같이 찍는다:
- 존재하지 않는 라우트(`/api/does-not-exist`)가 404인지 확인 → 그래야 401이
  "라우트 존재 + 인증 게이트 정상"이라는 의미 있는 신호가 된다.

## Evidence

```
POST https://coconutlabs.xyz/api/emails            → 307  (apex redirect stub)
POST https://www.coconutlabs.xyz/api/emails        → 401  {"error":"Missing Authorization header."}
POST https://www.coconutlabs.xyz/api/does-not-exist → 404
GET  https://www.coconutlabs.xyz/  (-L 추적)        → 200, footer mailto:chongwon5026@gmail.com 노출
```
