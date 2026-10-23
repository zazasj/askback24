# 밤샘 개발 감사 보고서

2026-10-24 · 독립 감사(이 개발에 참여하지 않은 에이전트) · 대상 커밋 `d7d0074` ([Fix] r3 QA·디자인 반영)

## 결론

- **쓸 수 있나**: 시연에 쓸 수 있다. 감사자가 `npm run check`를 다시 돌렸고, Must 58개 · Should 9개 · [R] 10개가 모두 통과했다. 보안 검사에서 걸린 것도 없다.
- **가장 큰 문제**: 흐름이 막히는 곳은 없다. 시연 당일에 걸릴 수 있는 것은 README의 대체 경로 안내다. 적힌 대로 주소 끝에 `?apiFail=1`을 붙이면 대체 화면이 아니라 ①로 돌아간다(맞는 꼴은 `&apiFail=1`). 그다음은 최종 ③ "면접에 들고 갈 한 장 인쇄"가 A4 2쪽으로 나오는 것이다.
- **사람이 할 일**: 아래 「아침 할 일」 순서로 화면을 한 번 직접 돌려 본다. push·Vercel 배포·아이폰 사파리 확인을 한다. 10-25 회의에서 JSON 형식 가안(D-011)과 밤사이 바뀐 ACCEPTANCE API-05 문구(D-076)를 확정한다.

## 무엇을 다시 돌렸나

앞 단계 보고는 믿지 않고 처음부터 다시 돌렸다.

- `npm --prefix /d/Source/askback24 run check` → 종료 코드 0.
  - 빌드(타입 검사 포함) 통과. JS 273.96 kB(gzip 91.04 kB), CSS 134.23 kB(gzip 17.06 kB).
  - 단위 시험 13파일 129건 통과.
  - 화면 시험 184건: 175 통과, 9 건너뜀, 0 실패(1.9분).
- `npm --prefix /d/Source/askback24 run screens` → 28건 통과, 준비 실패 주석 0건. 캡처 28장을 `review/screens/`에 새로 찍었다(06:16).
- 건너뛴 9건은 모두 휴대폰 프로젝트에서 시험이 스스로 건너뛴 것이다. 파일 검사 6건(NF-01~04, API-05 화면 쪽, API-06)은 데스크톱에서 한 번만 돈다. G-04·S2-01은 휴대폰에서 왼쪽 메뉴가 선택 상자라서, S1-02는 휴대폰에서 표가 카드라서 건너뛴다.
- 앞 단계 숫자와 다르다. D-074(M6)는 단위 120건, 화면 172 통과 · 12 건너뜀이었다. r1~r3 수정에서 단위 시험이 9건 늘고 휴대폰 건너뛰기 3건이 없어져 지금 숫자가 됐다. 앞 단계 요약에 실패로 남아 있던 G-01~13(M1)과 API-05(M3)는 지금 모두 통과한다.
- 시험이 약해지지 않았는지 봤다. 시험 커밋(`225a21e`) 뒤 `e2e/`는 r2·r3에서 5파일이 바뀌었다. 지운 검사는 없고, 휴대폰 건너뛰기를 없애거나 비교를 더 엄격하게 바꾼 것뿐이다. `docs/SPEC-ISSUES.md`의 QA 판정과 맞는다.
- 자동 시험이 닿지 않는 곳은 감사자 임시 점검 `review/tmp/audit.spec.ts`(커밋 안 함, 포트 4193)로 쟀다. 점검 14개(AUD-01~14)가 모두 통과했다. 결과와 캡처는 `review/tmp/audit/`에 있다.

캡처 파일 이름은 `review/screens/<이름>-desktop.png`(1440) · `-mobile.png`(375)다. `review/`는 `.gitignore` 대상이라 커밋에는 없고 이 PC에만 있다.

## Must 통과 표

| ID | 결과 | 근거 |
|---|---|---|
| G-01 | 통과 | e2e 두 폭, 12화면 순회 · 모든 캡처 맨 위 띠 |
| G-02 | 통과 | e2e 두 폭 + 시연 도구 연 상태 · dist 검색 0건 |
| G-03 | 통과 | e2e 두 폭(휴대폰은 밀어 보이게 한 뒤 누름) |
| G-04 | 통과 | e2e 데스크톱 · 휴대폰 선택 상자 이동은 AUD-14 |
| G-05 | 통과 | e2e 두 폭 · `s4-first-1-posting-mobile.png`(휴대폰은 "‹ 알선/입사지원 내역"만 보임) |
| G-06 | 통과 | e2e 두 폭, 12화면 |
| G-07 | 통과 | e2e 두 폭 · AUD-07 320px에서도 scrollWidth 320 |
| G-08 | 통과 | e2e 2건 두 폭(주소로 열기·새로고침·404) |
| G-09 | 통과 | e2e 두 폭, 콘솔 오류·예외 0건 |
| G-10 | 통과 | e2e 두 폭, axe critical·serious 0건 |
| G-11 | 통과 | e2e 두 폭 · AUD-05 주민번호·카드번호·사업자번호 모양 0건 |
| G-12 | 통과 | e2e 두 폭 |
| G-13 | 통과 | e2e 두 폭(localStorage 접근 시 예외) |
| S1-01 | 통과 | e2e 두 폭 |
| S1-02 | 통과 | e2e 데스크톱 · `s1-applications-desktop.png` |
| S1-03 | 통과 | e2e 두 폭 · `s1-applications-*.png` |
| S1-04 | 통과 | e2e 두 폭 |
| S1-05 | 통과 | e2e 두 폭 |
| S1-06 | 통과 | e2e 두 폭 |
| S1-07 | 통과 | e2e 두 폭 |
| S1-08 | 통과 | e2e 두 폭 |
| S1-09 | 통과 | e2e 2건 두 폭(시계를 2027-03-15로 옮겨도 30일 안) |
| S2-01 | 통과 | e2e(메뉴 링크는 데스크톱, 주소로 열기는 두 폭) |
| S2-02 | 통과 | e2e 두 폭 · `s2-resume-desktop.png` |
| S2-03 | 통과 | e2e 두 폭 |
| S2-04 | 통과 | e2e 두 폭 |
| S4-01 | 통과 | e2e 두 폭 · `s4-first-1-posting-*.png` |
| S4-02 | 통과 | e2e 두 폭(뒤로 가기 포함) |
| S4-03 | 통과 | e2e 두 폭 |
| S4-04 | 통과 | e2e 두 폭 · AUD-09 말풍선 캡처 |
| S4-05 | 통과 | e2e 두 폭 |
| S4-06 | 통과 | e2e 두 폭 |
| S4-07 | 통과 | e2e 두 폭 |
| S4-08 | 통과 | e2e 두 폭 · `s4-first-2-cards-*.png` |
| S4-09 | 통과 | e2e 두 폭 |
| S4-10 | 통과 | e2e 두 폭 |
| S4-11 | 통과 | e2e 두 폭(칩마다 persona.json 문장과 같음) |
| S4-12 | 통과 | e2e 두 폭 · `s4-first-2-demo-tools-open-*.png` |
| S4-13 | 통과 | e2e 두 폭 · `s4-first-3-questions-A-*.png` |
| S4-14 | 통과 | e2e 두 폭 · `s4-first-3-why-open-*.png` |
| S4-15 | 통과 | e2e 두 폭 |
| S4-16 | 통과 | e2e 두 폭 |
| S4-17 | 통과 | e2e 두 폭 · `s4-first-3-fallback-*.png` |
| S4-18 | 통과 | e2e 두 폭 |
| S4-19 | 통과 | e2e 두 폭 |
| S4-20 | 통과 | e2e 두 폭 |
| S4-21 | 통과 | e2e 두 폭 |
| S4-23 | 통과 | e2e 두 폭 |
| API-01 | 통과 | 단위 `shared/rules.test.ts` |
| API-02 | 통과 | 단위 `shared/rules.test.ts` |
| API-03 | 통과 | 단위 `shared/validate.test.ts` |
| API-04 | 통과 | 단위 `shared/generate.test.ts` |
| API-05 | 통과 | 단위 `api/questions.test.ts` 4건 · e2e 콘솔 검사 · 서버 로그는 공급자 이름·개수만 |
| API-06 | 통과 | e2e(실제 모드 빌드) · 감사 검색 `dist/`·`review/tmp/api06-dist/` 0건 |
| NF-01 | 통과 | `npm run check` 빌드·단위 · e2e NF-01 |
| NF-02 | 통과 | e2e · 감사 검색 `src/`에 `v-html` 쓰임 0건(주석 1줄뿐) |
| NF-03 | 통과 | e2e · 감사가 git 기록 전체를 다시 봄(아래 보안) |
| NF-04 | 통과 | e2e · 감사 검색 `tokens.css` 밖 hex·rgb 0건 |

Must 58개 중 58개 통과.

## Should·[R] 통과 표

| ID | 결과 | 근거 |
|---|---|---|
| S2-05 | 통과 | e2e 두 폭(window.print 호출) |
| S3-01 | 통과 | e2e 2건 두 폭(7건, 모두 상세로) · `s3-jobs-*.png` |
| S3-02 | 통과 | e2e 두 폭 · `s3-job-detail-*.png` |
| S3-03 | 통과 | e2e 두 폭 |
| S3-04 | 통과 | e2e 두 폭 |
| S3-05 | 통과 | e2e 두 폭 |
| S3-06 | 통과 | e2e 두 폭 · AUD-12 휴대폰 카드 7개 본문을 눌러도 상세로 감 |
| S4-22 | 통과 | e2e 두 폭 · AUD-06 1차 ③ 인쇄 A4 1쪽 |
| S4-24 | 통과 | e2e 2건 두 폭 · `about-ai-*.png` |
| R-01 | 통과 | e2e 두 폭 |
| R-02 | 통과 | e2e 두 폭 |
| R-03 | 통과 | e2e 두 폭 |
| R-04 | 통과 | e2e 두 폭 · `s4-final-2-review-R04-*.png` |
| R-05 | 통과 | e2e 2건 두 폭(요약 2·1·2·1, 7개) · `s4-final-3-questions-*.png` |
| R-06 | 통과 | e2e 두 폭 |
| R-07 | 통과 | e2e 두 폭 · AUD-03 △△커머스 시드로 최종 질문 7개까지 |
| R-08 | 통과 | e2e 두 폭 |
| R-09 | 통과 | e2e 두 폭 · AUD-02 sessionStorage·쿠키·IndexedDB에도 없음 |
| API-07 | 통과 | 단위 `shared/final.test.ts` 4건 |

Should 9개 중 9개, [R] 10개 중 10개 통과.

## 보안

걸린 것은 없다.

- 빌드 결과물: 가짜 응답 모드 빌드(`dist/`)와 실제 모드 빌드(`review/tmp/api06-dist/`)에서 `ENNOIA` `process.env` `apiKey` `api_key` `LLM_PROVIDER` `Bearer` `Authorization` `sk-ant` `VITE_`를 찾았다. 둘 다 0건이다. 소스 지도(.map) 파일도 없다.
- git 기록: 모든 브랜치에서 `.env` 파일이 커밋된 적이 없다. 커밋된 env 파일은 `.env.example`(값이 빈칸)과 `.env.mock`(`VITE_API_MODE=mock` 한 줄)뿐이다. 키 모양 문자열(`sk-` `AKIA` `ghp_` `-----BEGIN` 등)도 기록 전체에 없다.
- 키 읽는 곳: `process.env`는 `api/questions.ts` 한 곳에서만 읽는다. 화면 코드가 읽는 환경변수는 `VITE_API_MODE` 하나다.
- 개인정보 모양: `data/`·`src/`·`shared/`에 `@example.com` 밖 이메일, `010-0000-0000` 밖 전화번호, 주민번호 모양이 없다. 회사 7곳은 모두 `(주)OO소프트` `(주)△△커머스`처럼 기호 가명이다. 인물은 김00, 학교는 ○○대학교, 경력 회사는 (주)□□랩이다.
- 브라우저 저장: 최종 질문까지 만든 뒤 저장 키는 `rq:v1:questions` `rq:v1:prep` `rq:v1:final-questions` 셋뿐이다. 들은 답은 어디에도 없다. 가짜 응답 모드에서 `/api` 호출은 0건이다(AUD-02).
- 사칭 요소: `src/` `public/` `index.html` 빌드 결과에 "누리집"·태극·`masthead`·`identifier`가 없다(설명 주석만 있음). 로고는 직접 그린 말풍선 마크에 회색 "시연" 배지를 붙였다. 모든 화면 맨 위에 시연 띠가 있고, 바닥글과 `og:description`에도 "실제 고용24가 아니"라고 적었다. `robots`는 `noindex, nofollow`다.

## 남은 디자인 지적

`docs/DESIGN-REVIEW.md` 기준으로 다시 셌다. high는 0개다.

r3에서 나온 high(DR-r3-01, 형광펜 말풍선이 아래 고정 바에 가림)는 고친 뒤 다시 검토한 적이 없어서 감사자가 쟀다. 말풍선 아래끝이 1440에서 800px, 375에서 728px이다. 고정 바 위끝(810px · 738px)보다 위에 있어 가리지 않는다. 같은 라운드의 DR-r3-02(Tab 초점이 바 밑에 숨음)는 ①·② 45번씩 눌러 0번이었다. DR-r3-03·06도 고친 대로 동작한다(AUD-09~12).

medium 3개:

- DA-01 · medium · D8 · 최종 ③ 데스크톱 · `review/tmp/audit/print-final.pdf` — "면접에 들고 갈 한 장 인쇄"를 누르면 최종 질문 7개가 A4 2쪽으로 나온다. 1차 ③은 1쪽이다(`print-first.pdf`). 버튼 이름은 ACCEPTANCE 정확한 문구라 바꾸기 어렵다. 최종 인쇄의 "들은 답" 칸 높이를 줄이거나 2쪽을 받아들일지 정해야 한다.
- DA-02 · medium · D8 · 최종 ③ · `s4-final-3-questions-desktop.png` — (주)OO소프트 최종 1번 질문이 "신입이 고객사 상주 프로젝트에 투입되는 경우도 있나요?"로 시작한다. 공고 우대조건에 "고객사 상주 가능자"가 있고, 1차에서 이미 비율과 기간을 물었다. 최종에서 "있나요?"부터 다시 물으면 공고를 안 읽은 사람처럼 들린다. 원인은 D-061에서 다시 확인 문장에 공고를 전제하지 않는 충돌 예방 틀을 먼저 쓰기로 한 것이다.
- DA-03 · medium · 문서 · `README.md` 「시연 순서」 끝 — "S4 주소 끝에 `?apiFail=1`을 붙이고"라고 적혀 있다. S4 주소에는 이미 `?step=`이 있어서 그대로 붙이면 플래그가 사라지고 ①로 돌아간다(AUD-13 실측). `…/prep?step=2&apiFail=1`처럼 `&`로 붙여야 한다. ACCEPTANCE 「정확한 문구」 아래 설명도 같은 꼴이다.

low 5개:

- DA-04 · low · D5 · `s4-final-3-questions-desktop.png` — 1차를 다녀와 최종 흐름으로 넘어가도 머리 요약은 "지원결과 서류합격" 그대로다. 심사위원이 "서류합격인데 최종 면접?"으로 읽을 수 있다.
- DA-05 · low · D11 · `review/tmp/audit/v-s4-loading-mobile.png` — 만드는 중 화면에 "가짜 응답 모드 · AI 대신 규칙과 예시 문장" 태그가 두 번 보인다(제목 옆, 상자 안).
- DA-06 · low · D12 · `s3-jobs-desktop.png` — 채용정보 표의 임금 칸이 "3,400만 / 원", "(협의 / 가능)"처럼 끝 한 단어만 다음 줄로 떨어진다.
- DA-07 · low · D5 · `review/tmp/audit/v-s1-mobile.png` — 휴대폰 S1 첫 화면에 "면접 역질문 준비" 버튼이 보이지 않는다. 안내 띠의 "맨 위 지원 건으로 가기"가 대신한다(D-083).
- DA-08 · low · D3 · `s4-first-3-questions-A-desktop.png` — 1차 ③에 채운 버튼이 둘이다(오른쪽 "전체 복사" 연보라, 아래 "면접 다녀왔어요" 보라).

## 알려진 한계

- 모의 데이터: 공고 7건, 회사 신호 값, 지원 내역 3건, 김00 이력서가 모두 예시다. 공고 5건(`K-MOCK-0003`~`0007`)은 `draft: true`라 형원 데이터가 오면 바꾼다. "실제" 배지가 붙은 신호도 출처 종류만 실제이고 값은 예시다.
- 공고 분석도 미리 만든 데이터다. 형광펜과 "AI가 찾은 확인할 점"은 `data/analysis/*.json`을 읽어 그린다. 실행 중에 AI가 공고를 분석하지 않고, 실제 모드에서도 같다.
- LLM 미연결: 엔노이아 공급자는 자리만 있고, 부르면 예외가 나서 검수 문장으로 바뀐다. 가짜 응답 모드의 문장은 규칙과 틀로 만든다. 화면 제목 옆 회색 태그와 `/about-ai`에 그렇게 적혀 있다. "기대와 다름" 판정은 R-04 예시 세트(BE07 고정값)에서만 나온다. `?apiFail=1`로 최종까지 가면 확인됨 3 · 기대와 다름 0으로 바뀌고 "단순 규칙" 안내가 뜬다(AUD-04).
- Vercel 미배포: `api/questions.ts`(웹 표준 형식, D-015)와 `shared/`의 JSON import 속성(D-018)이 Vercel에서 도는지 확인하지 않았다. 로컬 `npm run dev`(실제 모드)에는 서버 함수가 없어 늘 검수 문장으로 대체된다.
- 사파리 미시험: 화면 시험은 Chromium 1440·375만 돌았다(감사에서 320 폭 가로 스크롤만 더 봄). 아이폰에서 볼 것은 세 가지다.
  - 입력칸 높이 자동 맞춤(`field-sizing`)은 사파리가 지원하지 않는 것으로 보인다. 2줄 고정으로 보일 것이다.
  - 휴대폰 주 메뉴 오른쪽 흐림(`mask-image`)이 보이는지 본다.
  - 같은 와이파이에서 `http://<PC 주소>:4173`으로 열면 클립보드 API를 못 쓴다. 이때 "복사"는 안내 알림만 띄운다. 복사까지 보려면 https(배포 뒤)에서 확인한다.

## 아침 할 일

1. 띄우기. Git Bash에서 아래 두 줄을 차례로 돌리고 `http://localhost:4173`을 연다.

   ```bash
   npm --prefix /d/Source/askback24 run build:mock
   npm --prefix /d/Source/askback24 run preview
   ```

2. 시작 전에 시연 띠 오른쪽 "시연 도구 → 시연 초기화"를 누른다.
3. 화면을 이 순서로 본다. 괄호는 비교할 캡처다.
   1. 알선/입사지원 내역 (`s1-applications-desktop.png`)
   2. 1행 (주)OO소프트 "면접 역질문 준비" → ① 형광펜 "기타 업무 지원" 누르기 (`s4-first-1-posting-desktop.png`)
   3. "내 기대·걱정 고르기" → ② "시연 도구 열기" → "예시 구직자 A로 채우기" (`s4-first-2-demo-tools-open-desktop.png`)
   4. "질문 만들기" → ③ 질문 5개. 인쇄 미리보기가 1쪽인지 본다 (`s4-first-3-questions-A-desktop.png`)
   5. "면접 다녀왔어요" → 시연 도구 "1차 면접 다녀온 것으로 채우기" (`s4-final-2-review-R04-desktop.png`)
   6. "최종 질문 만들기" → 최종 ③. 1번 질문 문장(DA-02)과 인쇄 미리보기 2쪽(DA-01)을 직접 보고 판단한다 (`s4-final-3-questions-desktop.png`)
   7. 대체 경로: 주소를 `…/prep?step=2&apiFail=1`로 바꿔 질문을 만든다 (`s4-first-3-fallback-desktop.png`)
   8. 주 메뉴 "채용정보" → 공고 상세 → "입사지원" → 지원 내역 맨 위 새 행 (`s3-jobs-desktop.png`, `s3-job-detail-desktop.png`)
   9. ③의 "이 질문은 어떻게 만들어지나요" (`about-ai-desktop.png`)
   10. 크롬 개발자 도구 375 폭으로 1~6을 한 번 더 (`*-mobile.png`, 첫 화면은 `review/tmp/audit/v-*-mobile.png`)
4. 전체 시험을 다시 돌리려면 preview를 끄고(4173 포트를 비움) `npm --prefix /d/Source/askback24 run check`를 돌린다. 약 2분 걸린다.
5. README의 `?apiFail=1` 안내(DA-03)를 `&apiFail=1`로 고친다. 한 줄이다.
6. `git -C /d/Source/askback24 push`로 `zazasj/askback24`에 올리고 Vercel에 배포한다. 배포 뒤 `POST /api/questions`가 `LLM_PROVIDER=mock`으로 답하는지, 아이폰 사파리에서 복사가 되는지 본다.

## 사람이 정할 것

- ACCEPTANCE API-05 문구 변경(D-076)을 받아들일지. 원래 문구는 "응답·로그 어디에도 경험 한 줄 원문이 없다"였다. 이것이 S4-13과 부딪혀, 밤사이 QA 에이전트 판정으로 "요청 값을 되돌려 주는 필드가 없다"로 바뀌었다. 정본 문서가 사람 없이 바뀐 곳은 여기 하나다.
- JSON 형식 가안을 10-25 회의에서 형원과 확정한다. snake_case 키와 `mode: "first" | "final"`(D-011), `Question.basis` 추가(D-039), `InterviewReview`·`CardState` 변경(D-062)이 들어 있다.
- 공고 분석은 미리 만든 데이터인데 화면에는 "AI가 찾은 확인할 점", "AI가 공고 문장을 업무 카드와 맞춰 봤어요"라고 적혀 있다. 이것을 발표에서 어떻게 말할지 정한다. 실제 서비스에서 이 분석도 LLM이 할지, 팀이 미리 만들어 둘지도 정해야 한다.
- 최종 다시 확인 질문의 문장 틀(DA-02). 공고를 전제하지 않는 지금 틀을 둘지, 1차 질문을 이어 받는 문장으로 바꿀지.
- 최종 ③ 인쇄를 1쪽으로 줄일지, 2쪽을 받아들일지(DA-01).
- 추가 모의 공고 5건(`draft: true`)을 언제 형원 데이터로 바꿀지(D-008, D-050).
- 1차 면접 정리 → 최종 질문([R])을 2주 안 범위에 넣을지. 10-31 점검과 운영사무국 답을 보고 정한다(D-007).
