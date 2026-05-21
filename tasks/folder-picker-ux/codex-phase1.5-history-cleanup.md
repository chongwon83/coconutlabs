# Codex Phase 1.5 — `~/.zsh_history` Cleanup Strategy Review

**Date**: 2026-05-21
**Target**: macOS zsh history sanitization after PyPI token rotation
**Owner action**: 별 세션에서 `/codex` 실행 후 본 문서 전문 + §Context + §Failed Approaches + §Real vs False Positive + §Questions 입력. 응답을 §Response 섹션에 paste.

**선행조건**: Folder Picker UX Codex Phase 1 PARTIAL 판정 후 #1 (PyPI recovery codes plaintext) mitigation 진행 중. 토큰 자체는 이미 rotation 완료 → **dead credential**. 본 cleanup은 hygiene 차원.

**Pass condition**: HIGH/MEDIUM 결함 0건 (nit-only). 또는 "현 상태(dead token) 청소 불필요" 명시 결론.

---

## §1. Context

### 1.1 발단

- 2026-05-21 PyPI API token 회전 발생 (사용자가 우발적으로 기존 token 폐기 + 신규 발급)
- 신규 token은 macOS Keychain (`python -m keyring set https://upload.pypi.org/legacy/ __token__`)에만 저장
- 사용자 home의 `~/.zsh_history`에 **이전 dead token**이 평문으로 기록되어 있음 (twine upload + security add-generic-password 명령 흔적)

### 1.2 정확한 실측 데이터 (2026-05-21 22:29 KST)

```
~/.zsh_history file size: 114,539 bytes
file format: "Python script text executable, Non-ISO extended-ASCII text, with very long lines (582)"
  → BSD `grep` 기본 동작은 binary 인식 → silent fail (사용자 카운트 vs 진단 카운트 불일치 원인)
  → `grep -a` (treat as text) 필요

매칭 카운트 (grep -a 사용 시):
- broad 'pypi-Ag' literal:        16건
- strict 'pypi-Ag[A-Za-z0-9_-]{40,}':  3건
- strict 'pypi-Ag[A-Za-z0-9_-]{100,}': 3건 (실제 PyPI token shape)

3 strict matches (token 부분 마스킹):
- Line 1652: `python -m twine upload ... --password pypi-Ag***MASKED***`
- Line 1659: `security add-generic-password -a "$USER" -s "pypi-token" -w "pypi-Ag***MASKED***"`
- Line 1669: `security add-generic-password -a "$USER" -s "pypi-token" -w "pypi-Ag***MASKED***"`

13 noise matches: diagnostic commands containing literal 'pypi-Ag' string
  (e.g., `grep -E 'pypi-Ag'`, `sed ... 'pypi-Ag/d'`, `perl -i -ne 'print unless /pypi-Ag/'`)
```

### 1.3 보안 위협 평가

| 자원 | 상태 |
|------|------|
| 3 strict-match 라인의 토큰 | **DEAD** (이미 회전, PyPI에서 unauthorized) |
| 신규 토큰 | macOS Keychain only, `~/.pypirc` 없음, 환경변수 없음 (sole source) |
| `~/.zsh_history` git 추적 | 없음 (home dir, working tree 외부) |
| Stale Keychain entry `pypi-token` | 삭제 시도 시 exit 44 (존재하지 않거나 이미 삭제됨) |
| Workspace `credentials/PyPI-Recovery-Codes-*.txt` | **여전히 평문** (135 bytes, 8 codes) — 별도 mitigation 진행 중. `.gitignore`에 `credentials/` 추가 완료 (line 65). `git ls-files credentials/` = empty (한 번도 commit 안 됨). git history 노출 0 |

**라이브 위협**: 0건 (모든 토큰 dead, 신규 토큰은 Keychain only)
**잔여 hygiene 부담**: zsh history에 dead token 흔적 + diagnostic noise

---

## §2. Failed Approaches (정확한 실패 메커니즘)

### Attempt 1: `sed -i ''`

```bash
sed -i '' '/pypi-Ag/d' ~/.zsh_history
```

**실패**: `sed: RE error: illegal byte sequence` — macOS BSD sed가 `~/.zsh_history`의 non-ISO extended-ASCII bytes 처리 못 함. GNU sed였다면 OK이지만 macOS 기본은 BSD.

### Attempt 2: `history -c`

```bash
history -c
```

**실패**: `history: -c: bad option` — `history -c`는 bash 명령. zsh는 `-c` 옵션 지원 안 함. zsh equivalent는 `fc -p` 또는 `local HISTSIZE=0; HISTSIZE=...` 등.

### Attempt 3: `perl -i -ne ... && exit`

```bash
perl -i -ne 'print unless /pypi-Ag/' ~/.zsh_history
exit  # 새 셸 시작 의도
```

**실패 (가장 미묘)**:
- Perl in-place edit는 성공 (UTF-8 safe + 파일 정상 청소)
- 하지만 `exit` 시점에 **zsh의 `APPEND_HISTORY` (default) + `INC_APPEND_HISTORY` 미설정** 환경:
  - 현재 셸 in-memory history 버퍼에는 cleanup 명령들(`grep -E 'pypi-Ag'`, `sed ... 'pypi-Ag'`, `perl ... 'pypi-Ag'`)이 그대로 남아있음
  - `exit` 시 in-memory 버퍼가 **방금 Perl이 청소한 파일에 그대로 APPEND**됨
  - 결과: 파일 청소했지만 **dirty in-memory가 다시 쓰여서 history 파일 더 더러워짐**

### Attempt 4: 새 Terminal 탭 열기

```bash
# attempt 3 후 새 탭에서
grep -c 'pypi-Ag' ~/.zsh_history
# → 16
```

**실패**: 새 셸이 시작될 때 `HISTFILE`을 읽어들이는데, 그 파일은 Attempt 3에서 dirty buffer가 append된 상태. 또한 새 셸에서 입력한 진단 명령(`grep -c 'pypi-Ag'`)도 in-memory에 추가됨 → 다음 exit 시 또 append.

### 자기참조 함정 (meta-problem)

```
diagnostic command contains literal 'pypi-Ag'
  → 명령 자체가 history에 기록됨
  → 다음 grep 매칭 카운트 증가
  → 사용자가 "더 더러워졌다" 인식
  → 또 다른 diagnostic command 입력
  → ...무한 증식
```

이전 청소 횟수: 3회. 카운트 변화: 3 → 6 → 16.

---

## §3. Real vs False Positive 구분

### 3.1 Real (3건)

```regex
pypi-Ag[A-Za-z0-9_-]{100,}
```

PyPI API token은 `pypi-Ag` prefix + base64url-like 100+ char suffix. 위 패턴은 실제 토큰 shape만 매칭.

### 3.2 False Positive (13건)

```
grep -E 'pypi-Ag'                     # 짧음, 후행 없음
sed -i '' '/pypi-Ag/d' ~/.zsh_history # 후행 4 chars (/d ~)
perl -i -ne 'print unless /pypi-Ag/'  # 후행 1 char (/)
echo 'pypi-Ag matching test'          # 후행 alphanumeric short
grep -ac 'pypi-Ag' $f                 # 짧음
```

이들은 모두 `pypi-Ag` 직후 100+ chars의 token suffix 없음. strict pattern으로 자동 분리 가능.

### 3.3 권장 verification pattern

```bash
# 라이브 위협 검사 (이 결과 0건이면 안전):
grep -aEc 'pypi-Ag[A-Za-z0-9_-]{40,}' ~/.zsh_history

# 또는 실제 토큰 길이 기준:
grep -aEc 'pypi-Ag[A-Za-z0-9_-]{100,}' ~/.zsh_history
```

`-a` 플래그 의무 (Non-ISO extended-ASCII 처리).

---

## §4. Questions for Codex

### Q1. 비용/이득 평가

토큰이 dead 상태라면 history cleanup에 추가 시간 투자가 정당화되는가? 또는 다음 경우 청소가 의미 있는가:
- 미래 시스템 침해 시 history 파일 유출 가능성 (forensic clean-up)
- macOS Spotlight/Time Machine 백업에 포함되는 문제
- 다른 OS·셸과의 정합성

### Q2. zsh self-pollution 없는 cleanup 방법 (가장 핵심)

다음 후보 중 어느 것이 robust하고 macOS 기본 환경에서 즉시 사용 가능한가?

**Candidate A**: `unset HISTFILE` 후 청소

```bash
unset HISTFILE                  # 현재 셸 history 비활성화 (in-memory 버퍼 유지하되 파일에는 안 씀)
perl -i -ne 'print unless /pypi-Ag[A-Za-z0-9_-]{40,}/' ~/.zsh_history
# 셸 종료 시 HISTFILE empty → 파일 변경 없음
```

질문: `unset HISTFILE`이 정말로 모든 write를 막는가? `setopt NO_APPEND_HISTORY`도 추가해야 하는가? `INC_APPEND_HISTORY`가 켜진 경우는?

**Candidate B**: 별도 (zsh 외) 도구로 처리

```bash
# bash 또는 외부 script로 처리 (zsh history와 무관)
bash -c "perl -i -ne 'print unless /pypi-Ag[A-Za-z0-9_-]{40,}/' ~/.zsh_history"
# bash 자체는 ~/.bash_history에 기록되지만 pypi-Ag literal이 매칭되지 않으면 안전?
```

질문: bash가 자신의 history에 명령을 기록할 텐데, 그 history는 zsh의 ~/.zsh_history와 별개? 다른 bash 세션이 그 명령을 보는 위협은?

**Candidate C**: 임시 파일 + atomic swap

```bash
# 파이프 + 새 셸로 격리
HISTFILE=/dev/null exec zsh -c '
  perl -ne "print unless /pypi-Ag[A-Za-z0-9_-]{40,}/" ~/.zsh_history > ~/.zsh_history.clean
  mv ~/.zsh_history.clean ~/.zsh_history
'
```

질문: `exec zsh -c` 안에서의 in-memory history는 외부 셸과 어떻게 격리되는가? `HISTFILE=/dev/null`은 setopt와 별개인가?

**Candidate D**: 가장 단순 — `:r` 또는 `nano`로 직접 편집

```bash
nano ~/.zsh_history  # GUI 에디터로 line 1652/1659/1669 삭제
```

질문: 에디터 안에서 작업하는 동안 그 자체는 history에 기록되지 않는가?

### Q3. Diagnostic noise 청소

13개 false positive 라인도 같이 청소하는 게 깔끔하지만, 청소 명령 자체가 또 noise 추가 위험. 다음이 옳은 trade-off인가?

> "Real token 3건만 strict pattern으로 청소하고, 13개 diagnostic noise는 그대로 둠 — strict pattern 검증으로 라이브 위협 0건이면 충분"

또는 다음이 더 나은가?

> "broad pattern 'pypi-Ag'로 전부 청소하되, 청소 명령은 `HISTFILE=/dev/null exec zsh -c '...'`로 격리"

### Q4. 향후 동일 함정 방지

비밀 값을 cli에 직접 입력하는 행위가 history 노출의 근원. 다음 학습 룰을 `~/.claude/rules/security.md`에 추가하는 게 옳은가?

```markdown
## Shell history 노출 방지

- 비밀 값 (token, password, secret)을 cli 인자로 직접 입력 금지
- 대신: `keyring`/`security` 명령 + `$(...)` 명령 치환만 사용
- 예: ❌ `twine upload --password pypi-Ag...` → ✅ `TWINE_PASSWORD=$(python -m keyring get ...) twine upload`
- `setopt HIST_IGNORE_SPACE` 활성화 + 비밀 명령은 공백 prefix
- macOS BSD sed는 UTF-8 multibyte chars 처리 못 함 — `perl -i -ne` 또는 `python` 사용
```

---

## §5. 검수 항목 체크리스트

owner가 `/codex` 응답에서 다음을 확인:

- [ ] Q1: dead token이지만 청소 가치 있는가 명확한 결론 (PASS / DEFER 명시)
- [ ] Q2: 4개 candidate 중 robust한 것 선정 + 근거
- [ ] Q3: noise vs real만 청소 trade-off 결정
- [ ] Q4: security.md 학습 룰 채택 여부 + 보강안

---

## §Response (Codex output — owner 입력)

> Owner: `/codex` 실행 후 응답 전문을 아래에 paste. HIGH/MEDIUM 결함 발견 시 procedure 수정. nit-only면 "PASS — HIGH/MEDIUM 결함 없음" 1줄.

(미실행)
