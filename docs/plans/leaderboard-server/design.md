# Design — 실제 리더보드 서버 (S3.5)

S3 plan(`modular-bubbling-ember.md`)의 Phase 1 아키텍처 단계.
"무엇을"은 plan, 여기는 "어떻게" — 인터페이스·데이터흐름·파일경계·불변조건.

## 1. 인터페이스 명세

### `lib/server/store.ts` — 서버 사이드 JSON 파일 store

```ts
// 전체 import 목록을 읽는다. 파일 없음/깨짐 → [] (서버 첫 기동 안전).
function readEntries(): Promise<ImportedEntry[]>

// entry를 upsert: 같은 handle이 있으면 교체, newest-first 정렬 후 저장.
// 반환값은 저장 후의 전체 목록.
function upsertEntry(entry: ImportedEntry): Promise<ImportedEntry[]>
```

- 저장 위치: `web/.data/leaderboard.json` — `ImportedEntry[]` JSON 배열.
- 쓰기: `leaderboard.json.tmp`에 쓴 뒤 `fs.rename` → atomic.
  중간 크래시에도 직전 정상본 보존 (harness-loop atomic write 규칙).
- 동시성: 단일 Node 프로세스 내 직렬화. 다중 인스턴스는 범위 밖(알려진 한계).
- 예외: `readEntries`는 절대 throw 안 함 (없음/깨짐 → `[]`).
  `upsertEntry`의 쓰기 실패는 throw → route가 500으로 변환.

### `app/api/burnindex/route.ts` — Route Handler

```ts
// 전체 리더보드 목록.
export async function GET(): Promise<Response>
//   200 → { entries: ImportedEntry[] }

// raw Burn Summary envelope JSON을 받아 검증·저장.
export async function POST(request: Request): Promise<Response>
//   body: { handle: string, raw: string }   (raw = envelope JSON 문자열)
//   201 → { entry: ImportedEntry, entries: ImportedEntry[] }
//   400 → { error: string }   (handle 누락 / validateSummary 실패)
//   500 → { error: string }   (store 쓰기 실패)
```

- `export const dynamic = "force-dynamic"` — store는 매 요청 최신이어야 하므로
  GET 프리렌더 금지.

## 2. 데이터 흐름

```
[import 모달] JoinBurnIndexForm
  사용자 → 파일/붙여넣기(raw) + handle 입력
  → "Validate & preview": validateSummary(raw) 클라 1차 검증 → 미리보기
  → "Add to Burn Index": POST /api/burnindex { handle, raw }
                                  │
                          route POST
                          ├─ handle.trim() 검사 → 빈값 400
                          ├─ validateSummary(raw) 서버 재실행 ← 신뢰 경계
                          │     실패 → 400 { error }
                          ├─ buildImportedEntry(envelope, handle)
                          └─ store.upsertEntry(entry)
                                  └─ web/.data/leaderboard.json (atomic)
                          → 201 { entry, entries }
  → onImport(entries): LandingApp state 갱신 → 리더보드 즉시 반영

[페이지 로드] LandingApp useEffect
  → GET /api/burnindex → { entries } → setImported(entries)
```

클라의 `validateSummary`는 UX(즉시 미리보기)용. **신뢰 경계는 서버 재실행** —
클라를 우회한 직접 POST도 서버 검증을 통과해야만 저장된다.

## 3. 파일 경계

| 파일 | 책임 | 변경 |
|------|------|------|
| `lib/server/store.ts` | 파일 I/O + atomic write + dedupe 정렬 | 신규 |
| `app/api/burnindex/route.ts` | HTTP 경계 + 서버 검증 호출 | 신규 |
| `lib/validateSummary.ts` | envelope 검증 (순수, DOM 무의존) | 재사용 |
| `lib/data.ts` `buildImportedEntry` | envelope → ImportedEntry | 재사용 |
| `components/LandingApp.tsx` | localStorage 제거 → API GET/POST 연동 | 수정 |
| `components/forms/JoinBurnIndexForm.tsx` | onImport → POST 호출 | 수정 |

- `lib/server/`는 서버 전용 — 클라 컴포넌트에서 import 금지 (`node:fs` 의존).
- dedupe·정렬 로직은 store 한 곳. LandingApp의 클라 dedupe는 제거(서버가 권위).

## 4. 불변 조건 (invariants)

1. **서버 store에는 파생 데이터만**: `ImportedEntry`(handle, avatar, verif,
   totalTokens, cost, period, since/until, importedAt)만 저장. raw envelope·
   raw content·파일경로·secret 절대 저장 금지.
2. **서버 검증은 클라보다 약하지 않다**: route POST는 동일 `validateSummary`를
   재실행. 클라가 통과시킨 것을 서버가 거부할 순 있어도 그 반대는 불가.
3. **handle 유일**: store 내 `handle`은 유일. 재import는 기존 카드 교체.
4. **newest-first**: store 반환 목록은 `importedAt` 내림차순.
5. **atomic write**: `leaderboard.json`은 절대 부분 기록 상태로 남지 않음
   (`.tmp` → `rename`).
6. **읽기는 안전**: 파일 없음/JSON 깨짐 → `[]`. 서버 첫 기동·수동 삭제에도
   500 안 남.
