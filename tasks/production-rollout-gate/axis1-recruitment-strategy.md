# Axis 1 모집 전략 — 외부 사용자 15명 (distinct project_hash)

**목표**: `burn:metrics:axis1` Redis SET에 distinct project_hash 15개 도달 → ON 전환 PR 게이트 통과

**전제**: 15명 모집이 아니라 15개 **distinct project_hash** 달성. 1인 1업로드 기준으로 접근.

---

## 최단 경로 (목표: 1~2주)

### Tier 1 — 직접 아는 개발자 (목표 5명)

가장 빠른 경로. Claude Code / Cursor / Copilot 쓰는 지인에게 1:1 직접 요청.

**메시지 템플릿:**
> "AI 코딩 도구 쓰는 거 알아서 — 이거 한번 써줄 수 있어? 터미널에서
> `pip install coconut-collector && coconut-collector ~/` 한 줄 실행하고
> coconutlabs.xyz 에 업로드하면 끝이야. 내 사이드 프로젝트 테스트 중인데
> 실제 데이터가 필요해."

예상 전환율: 요청 5명 → 실제 완료 3~4명

---

### Tier 2 — 커뮤니티 공유 (목표 10명)

| 채널 | 포스팅 방식 | 예상 전환 |
|------|------------|---------|
| **Twitter/X** | "AI 코딩 도구에 이번 달 얼마 썼는지 아세요?" + 스크린샷 | 3~5명 |
| **Reddit r/ClaudeAI** | Show HN 스타일: "I built a leaderboard for AI coding tool spend" | 3~5명 |
| **Discord (Anthropic / Cursor)** | `#show-and-tell` 채널에 링크 | 2~3명 |
| **Hacker News** | Show HN 포스트 (주말 아침 미국 시간 9~10am EST) | 5~10명 (편차 큼) |

---

## 후킹 메시지 (효과 순)

1. **궁금증**: "AI 코딩 도구에 이번 달 얼마 썼는지 모르는 개발자 많음 — 자동으로 계산해주는 leaderboard 만들었음"
2. **비교**: "Burn Index — 다른 개발자들이 Claude/Codex에 얼마 쓰는지 순위 확인"
3. **무서움**: "Claude Code heavy user인데 이번 달 $XX 썼다는 걸 이 툴 쓰고 처음 알았음"

---

## Show HN 초안

```
Show HN: I built a leaderboard for AI coding tool spend (coconutlabs.xyz)

After a few months of using Claude Code + Codex heavily, I realized
I had no idea what I was actually spending. Built a CLI collector that
reads your local session logs (never uploads prompts/code — only token
counts and cost estimates) and a public leaderboard to compare with
other developers.

GitHub: https://github.com/chongwon83/coconutlabs
Try it: pip install coconut-collector && coconut-collector ~/
```

---

## 온보딩 체크리스트 (공유 전 필수)

copy-paste 한 줄로 동작하는지 직접 확인:

- [x] `pip install coconut-collector && coconut-collector ~/` 신규 머신에서 동작 (2026-05-21 smoke ✅, PyPI 게시 완료 ✅)
- [x] README에 GIF 또는 스크린샷 있음 (2026-05-21 asciinema SVG demo ✅)
- [x] coconutlabs.xyz 업로드 흐름 30초 내 완료 가능 (2026-05-21 Playwright e2e 163ms median ✅)
- [x] 에러 메시지가 친절한 한국어/영어로 나옴 (2026-05-21 Phase 4 + /codex 교차 리뷰 ✅)

---

## 우선순위 실행 순서

1. **지금 당장** — 아는 개발자 5명에게 직접 메시지
2. **이번 주** — Twitter + Reddit 포스팅 1회씩
3. **다음 주** — Hacker News Show HN (5명+ 전환 가능, 타이밍이 관건)

HN이 터지면 15명은 하루 만에 달성 가능. 그 전까지는 지인 + SNS로 채워가는 방식.

---

## 진행 추적

Axis 1 현재값 확인:

```bash
curl -s -H "x-gate-secret: $ROLLOUT_GATE_SECRET" \
  https://www.coconutlabs.xyz/api/internal/rollout-gate-metrics \
  | python3 -m json.tool | grep -A3 axis1
```

목표: `"distinctProjectHashes": 15` 이상 → ON 전환 PR 진행 가능
