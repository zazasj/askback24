# PLAN — 개발 계획 (밤샘 자율 개발용)

> 화면 설계의 원본: `D:/Obsidian/50_대외활동/2026_고용24_AI해커톤/프론트 설계 - 고용24 재현 화면과 역질문 메이커.md` (S1~S4 와이어프레임, 김00 이력서, 코드 뼈대).
> 완료 기준: `docs/ACCEPTANCE.md`. 결정 기록: `docs/DECISIONS.md`. 디자인 검토 기준: `docs/DESIGN-REVIEW.md`.
> 레포 경로: Windows `D:/Source/askback24`, Git Bash `/d/Source/askback24`.

## 밤샘 범위

- 포함: ACCEPTANCE의 [M] 전부 + [S](S3 채용정보·입사지원, 경험 칩, 인쇄, 신뢰 페이지) + [R](1차 면접 정리 → 최종 질문 최소판).
- 제외: 실제 LLM(엔노이아) 연결, Vercel 배포, GitHub push, 이용 기록 서버 저장. 복기 완성판(받은 질문 자유 입력, 소감 자유 서술, "내가 채운 공고" 3열 화면).
- 서버 함수 `api/questions.ts`는 만들되 공급자는 `LLM_PROVIDER=mock`(기본)으로 동작. 엔노이아 공급자는 형식 미확인이라 자리만(`throw new Error('not configured')`).

## S4 구조 — 단계형 (설계 노트의 탭 2개를 대체)

설계 노트(「프론트 설계」)의 S4 ③ 와이어프레임은 탭 2개(1차 질문 / 처우 질문)였지만, 「추가 개발 - 1차 면접 복기와 최종면접 맞춤 질문」(`D:/Obsidian/50_대외활동/2026_고용24_AI해커톤/추가 개발 - 1차 면접 복기와 최종면접 맞춤 질문.md`)에 따라 **단계형**으로 만든다. 그 노트의 2·3·4·6·7·9·10(최소판)·12·13절이 [R] 범위의 설계 원본이다.

- 머리의 라디오 "준비할 면접"(1차·기술 / 최종·처우)이 흐름을 고른다. 지원결과가 "1차 합격"이면 최종으로 연다.
- 1차: ① 공고 확인 → ② 내 기대·걱정 → ③ 질문 받기(업무 질문 5개만, 처우 질문 없음, 아래에 "면접 다녀왔어요" 상자).
- 최종: ① 공고 확인 → ② 1차 면접 정리(복기 입력 4종 최소판) → ③ 최종 질문 받기(요약 개수 + 순서 규칙대로 최종·처우 질문).
- 최종 질문 순서(노트 6절) + 이번 결정: `company_signal` × 모르겠어요(또는 고르지 않은 카드) = `signal` "신호 확인" 1.2. 결과 질문은 8개 이하.
- 표현 단계(노트 7절): 분위기 "압박이 있었어요" → 완충 문장, "편했어요" → 완충 없음. 1차 면접관 말 인용 금지.
- 가짜 응답 모드의 판정: R-04 예시 세트는 고정값(BE07 = mismatch 포함), 그 밖은 단순 규칙(ACCEPTANCE R 절 머리).
- 시드: S1 2행((주)△△커머스, 1차 합격)은 예시 구직자 A 선택과 1차 결과를 가진 채로 시작한다(R-07).
- 들은 답·분위기는 브라우저에 저장하지 않는다(R-09). 최종 질문 결과만 저장.

## JSON 형식 (가안 — 10-25 회의에서 형원과 확정)

- 설계 노트 「핵심 코드 뼈대 1」의 타입 구성을 쓰되, **키는 snake_case**로 하고 1차·최종은 `stage` 대신 **`mode: "first" | "final"`** 하나의 엔드포인트(`POST /api/questions`)로 받는다(추가 개발 노트 9절과 맞춤). 최종 요청은 `review`(asked·not_asked·received·impression), 응답은 `card_states`·`final_questions`·`summary`.
- 공고 필드는 고용24 채용정보 API 명세 이름 그대로(`wantedAuthNo`, `jobCont` …). 우리 쪽 키만 snake_case.
- 결정을 `docs/DECISIONS.md` D-011로 남긴다.

## M0 — 뼈대 (셋업, 사람이 깨어 있을 때 메인 세션이 수행)

- Vite + Vue 3 + TypeScript 프로젝트를 **직접 파일로** 만든다(대화형 `npm create` 금지).
- 의존성: `vue` `vue-router` `pinia` `@vueuse/core` `krds-uiux` / 개발: `vite` `@vitejs/plugin-vue` `typescript` `vue-tsc` `vitest` `@playwright/test` `@axe-core/playwright` `@types/node` (`@vercel/node`는 D-015로 제외).
- `npm --prefix /d/Source/askback24 exec playwright install chromium`.
- `package.json` 스크립트:
  - `dev`: `vite` · `build`: `vue-tsc --noEmit && vite build` · `build:mock`: `vue-tsc --noEmit && vite build --mode mock` · `preview`: `vite preview --port 4173 --strictPort`
  - `typecheck`: `vue-tsc --noEmit` · `test:unit`: `vitest run` · `test:e2e`: `playwright test` · `screens`: `playwright test e2e/screens.spec.ts` · `check`: `npm run build && npm run test:unit && npm run test:e2e`
- `.env.mock`: `VITE_API_MODE=mock` (Windows에서 `VAR=x cmd`가 안 되므로 mode로 바꾼다). `.env.example`: `LLM_PROVIDER=mock`, `ENNOIA_API_KEY=`.
- `playwright.config.ts`: `webServer` = `npm run build:mock && npm run preview`, 포트 4173, `reuseExistingServer: false`. 프로젝트 2개: `desktop`(1440×900), `mobile`(375×812, chromium). 실패 시 스크린샷·trace. 결과는 `test-results/`, 캡처는 `review/screens/`.
- `vite.config.ts` 별칭: `@` → `src`, `@shared` → `shared`, `@data` → `data`. `vitest`는 `shared/**/*.test.ts`, `api/**/*.test.ts`, `src/**/*.test.ts`.
- `.gitignore`: `node_modules` `dist` `.env` `.env.local` `test-results` `playwright-report` `review/screens` `review/tmp` `.vercel`.
- `vercel.json`: `{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }`.
- 문서 복사: `CLAUDE.md`, `docs/PLAN.md` `docs/ACCEPTANCE.md` `docs/DESIGN-REVIEW.md` `docs/DECISIONS.md`. 빈 `docs/SPEC-ISSUES.md`.
- 자리표시 `App.vue`로 `npm run build` 통과 → `git init` → 첫 커밋.

## 폴더 구조

```
api/questions.ts            Vercel 함수: 요청 검사 → shared/generate → 응답 (키는 process.env에서만)
shared/contract.ts          JSON 형식 타입 (설계 노트 「핵심 코드 뼈대 1」)
shared/rules.ts             gap_rules · classify · pickTop5 (데모 v0.2 classify/build 이관)
shared/validate.ts          근거 인용 검사 · absent 전제 표현 · 금지어 · 길이
shared/generate.ts          pickTop5 → 공급자(LlmProvider) → validate → 실패분 검수 문장 대체
shared/providers/mock.ts    가짜 공급자: 검수 틀 + 경험 문장을 자연스럽게 붙여 "AI가 쓴 듯한" 문장
shared/providers/ennoia.ts  자리만 (미설정 시 예외)
data/cards.backend.json     카드 17개 + 질문 틀 + 주의할 답/좋은 신호 + preference_options + gap_rules
data/postings.json          모의 공고 (채용정보 API 상세 필드명)
data/analysis/*.json        공고 분석 (PostingAnalysis)
data/signals.json           회사 신호 + 출처(실제/모의)
data/persona.json           김00 이력서
data/applications.seed.json 지원 내역 3건 (daysAgo 상대 날짜)
data/presets.json           예시 구직자 A·B
src/                        설계 노트 「소스 구조」 그대로
e2e/                        Playwright 시험 (시험 작성자만 수정)
review/                     화면 캡처·임시 스크립트 (커밋 안 함)
```

가짜 응답 모드(`VITE_API_MODE=mock`)에서 화면은 `/api/questions`를 부르지 않고 브라우저 안에서 `shared/generate.ts` + 가짜 공급자를 돌린다(1.5초 지연). `?apiFail=1`이면 공급자가 예외를 던져 대체 경로를 탄다. 실제 모드는 `fetch('/api/questions')`, 12초 시간 초과·오류 시 화면에서 `shared/generate.ts`의 검수 문장 결과로 대체.

## 데이터 이관 (데모 v0.2 → JSON)

원본: `D:/Obsidian/50_대외활동/2026_고용24_AI해커톤/데모/면접 역질문 메이커 v0.2.html` (151행 `const DATA = {...}`, 그 아래 `POSTINGS` `PRESETS` `classify()` `build()`). 파일 끝 Cloudflare 스크립트는 가져오지 않는다.

| v0.2 | 새 위치 | 비고 |
|---|---|---|
| `DATA.cards` `DATA.gap_rules` `DATA.preference_options` `DATA.posting_states` | `data/cards.backend.json` | BE15의 `prevent` 틀 포함 |
| `POSTINGS.p1` `POSTINGS.p2` | `data/postings.json` | 필드명 바꾸기: 담당 업무→`jobCont`, 우대 사항→`pfCond`, 고용 형태→`empTpNm`, 급여→`sal`(+`salTpNm`), 근무 시간→`workdayWorkhrCont`, 팀 구성→`etcPfCond` 또는 `jobCont`에 포함. 회사 → `corpNm` `indTpNm` `totPsncnt`. `wantedAuthNo`는 `K-MOCK-0001` 형식 |
| `POSTINGS.*.states` `marks` | `data/analysis/<wantedAuthNo>.json` | `evidence.quote`는 원문 필드 값의 **글자 그대로 일부**여야 한다 |
| `POSTINGS.*.signals` | `data/signals.json` | 문장 + `source: "실제"|"모의"` + 출처 이름 |
| `POSTINGS.*.pay` | 분석 JSON `blanks` + 검수 처우 질문 틀 | 최종 단계의 "처우 확인" 질문 재료 |
| `PRESETS.A/B` | `data/presets.json` | |

S3용 추가 모의 공고 4~6건(밤샘 결정 D-008): 백엔드 신입 공고. 고용24 공개 공고의 흔한 문형(임금 "회사내규에 따름"/"면접 후 결정", 근무시간 빈칸, "기타 업무", 상주·파견, 소규모 팀, 24시간 운영 등)을 섞어 만들고 회사명은 `(주)□□○○` 꼴 가명. 각 공고에 분석 JSON을 같이 만든다. `postings.json`에 `"draft": true` 표시(형원 데이터 오면 교체). (주)◇◇데이터도 이 중 하나.

## 마일스톤 (빌드 에이전트 1명당 1개, 순서대로)

| M | 범위 | 관련 ACCEPTANCE |
|---|---|---|
| **M1 틀과 메인** | `shared/contract.ts` `rules.ts` + 데이터 이관 + `rules.test.ts`(API-01·02) · KRDS 스타일 연결(`tokens.css`·글꼴) · GovLayout(시연 띠·헤더·주 메뉴·왼쪽 메뉴·경로·알림·시연 도구 틀) · 라우터·문서 제목·404 · S1 지원 내역(seed·상대 날짜·검색·안내 띠) · Pinia `demo` 저장소(저장 실패 대비) | G-01~13, S1-*, API-01·02, NF-02·04 |
| **M2 공고와 카드** | S4 머리·단계 표시(주소 연동) · ① 공고 원문 + 형광펜(`splitByQuotes`, `v-html` 금지) + 설명 말풍선 + 확인할 점 + 신호 배지 · ② 카드 17개(12+5)·라디오 그룹·다시 눌러 해제·카운터·경험 입력·이력서 칩·예시 구직자 채우기 · `prep` 저장소 | S4-01~12, S4-19 |
| **M3 질문과 서버** | `validate.ts` `generate.ts` 공급자(mock·ennoia 자리) + 시험(API-03~05) · `api/questions.ts`(`mode` 분기 자리) · `src/api/client.ts`(mock/실제/대체) · 만드는 중 화면 · ③ 1차 결과(질문 카드·펼침·복사·👍·근거 보기·전체 복사·인쇄·다시 만들기·선택 바꾸기·저장 복원·"면접 다녀왔어요" 상자 — 버튼은 M5에서 연결) | S4-13~23, API-03~06 |
| **M4 이력서·채용정보·신뢰** | S2 이력서(김00, 설계 노트 표 그대로) · 추가 모의 공고 4~6건 + 분석 · S3 목록·상세·입사지원 대화상자·지원 내역 추가·지원 완료 · `/about-ai` | S2-*, S3-*, S4-24 |
| **M5 1차 면접 정리 → 최종 질문** | 최종 흐름 단계 표시 · 1차 면접 정리 화면(복기 입력 4종 최소판, R-04 예시 세트) · `mode: "final"` 생성(카드 상태 판정 → 순서 규칙 → 표현 단계 → 검사) + 시험(API-07) · 최종 결과(요약 개수·최종·처우 질문) · S1 2행 시드 1차 결과 · 1차 결과 없을 때 안내 · 들은 답 미저장 | R-*, S1-06, API-07 |
| **M6 마감** | 375px 반응형 전 화면(왼쪽 메뉴 → 선택 상자, 표 → 카드) · 접근성(axe, 포커스, 키보드) · 첫 방문 안내 다듬기 · 파비콘·메타 · `README.md`(실행·시연 방법·제한 사항) · 전체 `npm run check` | G-07·09·10, 전체 |

각 마일스톤 완료 조건: `npm run build` · `npm run test:unit` 통과 + 관련 ID의 e2e(`npm --prefix /d/Source/askback24 run test:e2e -- --grep "<ID 접두>"`) 통과 + 커밋.

## KRDS 사용법

- `krds-uiux` 패키지의 `resources/css/token/krds_tokens.css`(색·간격 토큰)와 `resources/fonts/PretendardGOV-*.woff2`(Regular·Medium·Bold)를 쓴다. 글꼴은 `@font-face`로 직접 선언.
- 부품 모양은 `node_modules/krds-uiux/html/code/*.html`을 참고해 Vue 컴포넌트로 다시 짠다: `header` `main_menu_pc` `main_menu_mobile` `side_navigation` `breadcrumb` `tab` `table` `structured_list` `step_indicator` `radio_chip` `disclosure` `tooltip` `modal` `badge` `tag` `coach_mark` `spinner` `text_input` `textarea` `button*`.
- KRDS 부품 CSS(`component.css`, 약 540KB)를 통째로 넣을지는 M1 빌더가 정한다. 넣으면 빠르고, 빼면 가볍다. 넣는다면 gzip 후 CSS 크기를 `docs/DECISIONS.md`에 적는다.
- **쓰지 않는 부품**: `masthead`(공식 누리집 표시), `identifier`(운영 기관 식별자), `language_switcher`, `tts`. 사칭 방지.
- KRDS JS(`krds.min.js`)는 쓰지 않는다. 동작은 Vue로.
- 기본 파랑은 KRDS `primary` 토큰. 우리 기능(S1 "면접 준비" 열, S4)만 `tokens.css`의 강조색 변수(`--rq-accent*`, 연한 보라 계열)와 "AI" 라벨로 구분.

## 화면 문구 원칙

- 해요체로 통일("~해요", "~예요"). 버튼은 동사형("질문 만들기"). 번역투·명사 나열 금지.
- 용어 고정: 기대돼요 · 걱정돼요 · 모르겠어요 / 주의할 답 · 좋은 신호 / 근거 / 검수 문장 / 모의 공고.
- 회사를 평가하는 말 금지("나쁜 회사", "위험" 등). 신호는 "면접에서 확인할 근거"로만.
- 한국어 줄바꿈 `word-break: keep-all`.
