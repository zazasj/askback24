# DECISIONS — 결정 기록

> 형식: `D-0xx · 날짜 · 결정 · 이유 · 누가`. 새 결정은 맨 아래에 추가한다. 뒤집을 때는 지우지 말고 새 줄로 "D-0yy가 D-0xx를 대체".

- D-001 · 2026-10-24 · 화면은 Vue 3 + Vite + TypeScript · HTML 모양 그대로 쓰는 템플릿, 입력 폼이 짧음(`v-model`), 데모 v0.2 이관이 쉬움. React와 크기 차이는 이 규모에서 작음 · 세진
- D-002 · 2026-10-24 · 서버 함수도 TypeScript(Vercel `api/`, Node) · 질문 순서 규칙·근거 검사·JSON 타입을 화면과 같이 씀 → 서버 실패 시 화면이 같은 규칙으로 대체 결과를 냄 · 세진
- D-003 · 2026-10-24 · 디자인은 KRDS(정부 디자인 시스템, `krds-uiux` 1.1.0, ISC) 토큰·글꼴·부품 모양 · 고용24와 닮되 복제하지 않음. masthead·identifier 부품은 사칭 방지로 쓰지 않음 · 세진
- D-004 · 2026-10-24 · 첫 화면 = 알선/입사지원 내역, 우리 기능은 표의 "면접 준비" 열에서 진입 · 10-23 팀 회의 · 팀
- D-005 · 2026-10-24 · 지원 내역·선택·결과는 브라우저 저장(localStorage), 서버 DB 없음, 시연 초기화 버튼 · 심사위원마다 자기 상태, 로그인 불필요 · 세진
- D-006 · 2026-10-24 · 가짜 응답 모드 우선(`VITE_API_MODE=mock`), 실제 LLM은 엔노이아 형식 확인 후 · OT·키 미확인, 화면이 서버를 기다리지 않게 · 세진
- D-007 · 2026-10-24 · 밤샘 범위 = ACCEPTANCE [M] + [S] + [R](1차 면접 정리 최소판). 실제 LLM·배포·push 제외 · 복기는 만들어 두면 팀이 A안(2주 안 포함)을 골라도 비용이 거의 없음. 넣을지 최종 결정은 팀(10-31 점검·운영사무국 답) · 세진
- D-008 · 2026-10-24 · S3용 추가 모의 공고 4~6건은 Claude가 공개 공고 문형을 참고해 만들고 `draft: true` 표시, 형원 데이터 오면 교체 · 화면 흐름 확인용 · 세진
- D-009 · 2026-10-24 · 화면 시험은 Chromium(데스크톱 1440, 휴대폰 375)만. 사파리는 사람이 아이폰으로 확인 · WebKit 미설치, 밤샘 중 내려받기 위험 줄임 · 세진
- D-010 · 2026-10-24 · 패키지 관리자 npm, Node 22 · 설치된 환경 그대로 · Claude
- D-011 · 2026-10-24 · (가안, 10-25 회의에서 형원과 확정) API JSON 키는 snake_case, 1차·최종은 `mode: "first" | "final"` 하나의 엔드포인트 `POST /api/questions`. 공고 필드는 고용24 API 명세 이름 그대로 · 「추가 개발 - 1차 면접 복기와 최종면접 맞춤 질문」 9절, 데모 v0.2 데이터 키와 맞춤 · Claude
- D-012 · 2026-10-24 · S4는 탭 2개가 아니라 단계형: 1차 준비엔 업무 질문만, 처우 질문은 1차 면접 정리 뒤 최종 단계에서 · 1차에서 처우를 물으면 감점 위험, 탭 2가 왜 있는지 화면이 설명 못 함(추가 개발 노트 1절) · 세진
- D-013 · 2026-10-24 · 최종 질문 순서에서 company_signal × 모르겠어요(또는 고르지 않은 카드) = signal "신호 확인" 1.2 · 추가 개발 노트 6절 표에 없는 칸을 채움. 걱정(1.0)과 범위 확인(1.5) 사이 · Claude
- D-014 · 2026-10-24 · 레포 이름 `askback24`(`D:\Source\askback24`), GitHub는 개인 계정 `zazasj`의 비공개 레포 `zazasj/askback24`. 커밋 작성자는 레포 로컬 설정 `Devjin` / `105793155+zazasj@users.noreply.github.com`. 원격은 HTTPS(`https://zazasj@github.com/…`) + Git Credential Manager · 해커톤은 개인 대외활동이라 회사 계정과 분리. SSH 키는 GitHub 인증이 안 돼 HTTPS로 · 세진
- D-015 · 2026-10-24 · 서버 함수는 웹 표준 형식(`export async function POST(request: Request): Promise<Response>`)으로 쓰고 `@vercel/node`는 설치하지 않음 · `@vercel/node` 27.0.1이 취약점 6건(high 4)을 끌고 옴. 웹 표준 형식은 Vercel 함수가 지원하고 타입 패키지가 필요 없음. 배포 동작은 아침 Vercel 배포 때 확인 · Claude
- D-016 · 2026-10-24 · `gap_rules`의 걱정돼요 × 공고에 없음 규칙 type을 `conflict` → `prevent`로 바꾸고, 유형 칩 글자는 `cards.backend.json`의 `type_labels`(충돌 확인·기회 확인·깊이 확인·충돌 예방·탐색)로 정함. 질문 틀은 `prevent`가 없는 카드면 `conflict` 틀을 씀 · API-02·S4-16의 "충돌 예방"과 contract `QType`의 `prevent`에 맞춤. v0.2 결과(순서·문장)는 그대로 · Claude(M1)
- D-017 · 2026-10-24 · KRDS 부품 CSS(`component.css` 541KB)는 넣지 않음. `krds_tokens.css`와 Pretendard GOV 3굵기(400·500·700)만 쓰고 부품 모양은 직접 CSS로 짬. M1 빌드 CSS 72.7KB(gzip 9.6KB, 대부분 토큰 변수) · 설계 노트 "토큰과 부품 HTML 구조만 참고", 동작은 Vue로 하므로 KRDS JS·부품 CSS가 필요 없음 · Claude(M1)
- D-018 · 2026-10-24 · `shared/`에서 JSON은 상대경로 + import 속성(`with { type: 'json' }`)으로 읽음(`shared/catalog.ts` 한 곳) · Vercel 함수가 번들 없이 Node ESM으로 돌아도 JSON을 읽게. 배포 동작은 아침 Vercel 배포 때 확인 · Claude(M1)
- D-019 · 2026-10-24 · 브라우저 저장은 VueUse `useStorage` 대신 직접 만든 `usePersisted`(`src/lib/storage.ts`)로 함. 읽기·쓰기·지우기를 모두 감싸고 실패하면 메모리로만 동작. 키는 `rq:v1:applications`, `rq:v1:guide-closed` · `localStorage` 접근 자체가 예외를 던지는 경우(G-13)를 확실히 막으려고 · Claude(M1)
- D-020 · 2026-10-24 · S4 단계와 면접 종류는 주소 쿼리 `?step=1|2|3&mode=first|final`에 둠. `mode`가 없으면 지원결과로 정함(1차 합격 → final). 라디오를 바꾸면 단계 번호는 그대로 두고 `mode`만 바꿈. 잘못된 `step`은 ①로 바꿈(replace) · 새로고침·뒤로 가기·저장 막힘에서도 같은 화면(G-08·S4-02). R-01 "면접 다녀왔어요"는 `mode=final&step=2`로 보내면 됨 · Claude(M1)
- D-021 · 2026-10-24 · PLAN상 M2 범위인 S4 머리(지원 건 요약·"준비할 면접" 라디오)와 단계 표시(주소 연동)를 M1에서 먼저 만듦. 단계 본문은 자리 글과 ① 다음 버튼만 둠 · S1-05·S1-06·G-05가 S4 머리·단계를 봄 · Claude(M1)
- D-022 · 2026-10-24 · S2 이력서, S3 목록·상세, `/about-ai`는 제목·경로 표시·문서 제목만 있는 틀로 둠(내용은 M4). `data/persona.json`(김00, 경험 칩 3개)은 데이터 이관 때 같이 만듦 · G-04·G-05가 S2 제목을, G-03이 `/jobs` 주소를 봄 · Claude(M1)
- D-023 · 2026-10-24 · 지원 내역 시드는 `apply_id` A-0001~A-0003, 지원일 10·16·4일 전, 열람일 9·15일 전·미열람. 새로 지원한 건은 `applied_on`(YYYY-MM-DD)을 저장함. 표의 날짜는 `2026.10.14` 꼴 · 시드는 늘 오늘 기준 30일 안(S1-09), 새 지원은 지원한 날짜 그대로 남게 · Claude(M1)
- D-024 · 2026-10-24 · S1 3행 (주)◇◇데이터 공고(`K-MOCK-0003`, `draft: true`)와 분석·회사 신호를 M1에서 만듦. 나머지 추가 모의 공고 3~5건은 M4 · 시드가 이 공고를 가리킴. 신호 출처 배지는 설계 노트대로 국민연금·강소기업 = "실제", 공고 이력·임금체불 명단·업종 유추 = "모의" · Claude(M1)
- D-025 · 2026-10-24 · 공고 JSON은 채용정보 API 상세 필드명(`corpNm` `wantedTitle` `jobCont` `pfCond` `empTpNm` `salTpNm` `sal` `workdayWorkhrCont` `enterTpNm` `workRegion` `receiptCloseDt` 등)을 쓰고, 빈 문자열 = 공고에 없음. 분석 `blanks`는 문자열 배열 대신 처우 질문 재료 객체(`topic` `status` `label` `basis` `evidence?` `question`)로 둠 · v0.2 `pay`(검수 처우 질문)를 그대로 옮기려면 질문 틀이 공고별로 필요함. M5 최종 질문의 "처우 확인" 재료 · Claude(M1)
- D-026 · 2026-10-24 · 휴대폰 폭(767px 이하) 기본 대응을 M1에서 넣음: 주 메뉴는 메뉴 줄만 가로로 밀어 보기, 왼쪽 메뉴는 제목 위 선택 상자, S1 표는 카드 목록. 다듬기는 M6 · 375px에서 가로 스크롤 0을 처음부터 지키려고 · Claude(M1)
- D-027 · 2026-10-24 · 경로 표시의 "마이페이지"에는 링크를 달지 않음 · 마이페이지 첫 화면이 따로 없고, 지원 내역으로 링크하면 S1에서 그 링크에 `aria-current="page"`가 잘못 붙음 · Claude(M1)
- D-028 · 2026-10-24 · 시연 도구의 화면별 버튼은 그 화면이 `useDemoToolActions()`로 올리고, 다른 저장소(prep 등)는 `onDemoReset()`으로 "시연 초기화"에 끼어듦(`src/stores/demoTools.ts`). 초기화는 `rq:v1:` 키를 모두 지우고 지원 내역으로 이동 · M2(예시 구직자 채우기)·M5(1차 면접 다녀온 것으로 채우기)가 같은 상자를 씀. 확인 창(confirm)은 띄우지 않음 · Claude(M1)
- D-029 · 2026-10-24 · M1 완료 확인 방법: G 순회 시험(G-01·02·06·07·08 순회·09·10·11)과 G-12·G-13은 M2~M4 화면(`/jobs` 상세 링크, S4 ②③, 입사지원)을 거쳐 M1에서는 통과할 수 없음. 같은 e2e 도우미로 M1 화면(S1·S2·S3 틀·404·S4 단계 틀)만 도는 임시 점검(`review/tmp/`, 커밋 안 함)으로 띠·문서 제목·가로 스크롤·콘솔 오류·axe·개인정보·새로고침을 확인함 · `e2e/`는 고치지 않음. 순회 시험은 M4·M5 뒤에 다시 돌림 · Claude(M1)
