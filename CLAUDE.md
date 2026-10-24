# CLAUDE.md — 면접 역질문 준비 시연 사이트

고용24 해커톤(팀 레인보우 가이즈) 2차 MVP. 고용24 마이페이지를 닮은 **시연 사이트**에 "면접 역질문 준비" 기능을 붙인다. 계획 `docs/PLAN.md`, 완료 기준 `docs/ACCEPTANCE.md`, 결정 `docs/DECISIONS.md`, 디자인 기준 `docs/DESIGN-REVIEW.md`. 일을 시작하기 전에 네 문서를 읽는다.

## 명령 (Bash에서 `cd` 금지 — 훅이 막는다)

레포 경로를 인자로 준다. `/d/Source/askback24` = 이 레포 절대경로.

- 빌드(타입 검사 포함): `npm --prefix /d/Source/askback24 run build`
- 단위 시험: `npm --prefix /d/Source/askback24 run test:unit`
- 화면 시험: `npm --prefix /d/Source/askback24 run test:e2e` (특정 ID만: `… run test:e2e -- --grep "S4-1"`)
- 화면 캡처: `npm --prefix /d/Source/askback24 run screens` → `review/screens/*.png`
- 전체: `npm --prefix /d/Source/askback24 run check`
- git: `git -C /d/Source/askback24 status`, `git -C /d/Source/askback24 add <경로>`, `git -C /d/Source/askback24 commit -m "…"`
- 파일은 절대경로로 읽고 쓴다.

## 스택

Vue 3 (`<script setup lang="ts">`, Composition API) · Vite · TypeScript · Vue Router · Pinia · VueUse · KRDS(`krds-uiux` 토큰·글꼴) · Vitest · Playwright · Vercel 함수(`api/*.ts`, Node).

## 코드 규칙

- `v-html` 금지. 형광펜은 문자열을 조각으로 나눠 `v-for`로 그린다.
- 색은 KRDS 토큰 변수나 `src/styles/tokens.css`의 `--rq-*` 변수만. 컴포넌트 안에 색 값을 직접 쓰지 않는다.
- 화면 문구와 버튼 이름은 `docs/ACCEPTANCE.md` 「정확한 문구」를 글자 그대로 쓴다(시험이 이 문구로 찾는다).
- 라디오·탭·대화상자·펼침은 기본 HTML 요소와 ARIA로 만든다(키보드·화면낭독기).
- 브라우저 저장은 `rq:v1:` 접두사, 읽고 쓸 때 예외를 잡는다(저장 막힌 브라우저에서도 동작).
- 공용 로직(`shared/`)은 화면과 서버 함수가 같이 쓴다. 질문 순서 규칙을 화면 코드에 따로 만들지 않는다.
- `api/`와 `shared/` 안에서는 별칭(`@shared` 등) 대신 상대경로로 import 한다(Vercel 함수 빌드가 별칭을 못 읽을 수 있음). `api/_lib`처럼 `_`로 시작하는 파일·폴더는 Vercel이 주소로 만들지 않는다.
- 주석은 "왜"만, 짧게.

## 지켜야 할 것

- **사칭 금지**: 시연 띠를 모든 화면에. 태극 문양·공식 로고·"공식 전자정부 누리집" 문구·KRDS `masthead`·`identifier` 부품을 쓰지 않는다.
- **개인정보 금지**: 사람은 가상 인물 김00뿐. 이메일 `kim00@example.com`, 전화 `010-0000-0000`. 회사명은 `(주)OO소프트` 같은 가명. 실제 사람·회사 정보를 넣지 않는다.
- **키 보호**: LLM 키는 `api/` 안에서 `process.env`로만 읽는다. `VITE_` 접두사 변수에 키를 넣지 않는다. `.env`는 커밋하지 않는다.
- **경험 한 줄**은 서버에서 저장·로그하지 않는다.
- 모의 데이터라는 표시("모의 공고", "회사명과 공고는 예시")를 지우지 않는다.

## 시험 규칙

- `e2e/`는 시험 작성자·검증자가 소유한다. 개발 중 시험이 틀렸다고 생각되면 고치지 말고 `docs/SPEC-ISSUES.md`에 `ID · 이유 · 제안`을 적는다.
- 구현이 시험을 통과하도록 시험을 약하게 만들지 않는다.

## git

- 작업 브랜치는 **staging**이다. 커밋은 staging에만 한다. **main에는 커밋·push 하지 않는다**(main merge는 세진이 GitHub에서 한다).
- push는 `git -C /d/Source/askback24 push origin staging`만 허용한다. 밤샘 루프에서는 릴리스 단계가 마지막에 한 번만 한다.
- 서버(dev·preview)를 백그라운드로 남기지 않는다. 화면 확인은 Playwright webServer가 띄우고 끈다.
- 작성자는 레포 로컬 설정(`Devjin` / zazasj noreply)을 쓴다. 전역 git 설정을 바꾸거나 `--author`로 덮어쓰지 않는다.
- 메시지: `[Feat] M2 공고 형광펜과 업무 카드` / `[Fix] r1 S4-13 유형 순서` / `[Chore] …` / `[Docs] …`
- 메시지 끝에 빈 줄 후 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `git add -A` 대신 바꾼 경로를 적어서 add 한다.

## 결정 기록

구현 중 내린 판단(라이브러리 선택, 범위 조정, 문구 변경 등)은 `docs/DECISIONS.md`에 한 줄씩 추가한다: `D-0xx · 날짜 · 결정 · 이유 · 누가(에이전트 이름)`.
