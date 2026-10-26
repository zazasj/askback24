# e2e — 화면 시험 (시험 작성자·검증자 소유)

시험은 `docs/ACCEPTANCE.md`만 보고 쓴다. 제목은 ACCEPTANCE ID로 시작한다. 구현자는 이 폴더를 고치지 않고 `docs/SPEC-ISSUES.md`에 적는다.

- 돌리기: `npm --prefix /d/SejinSource/askback24 run test:e2e` (ID만: `… run test:e2e -- --grep "TR-0"`), 목록만: `… run test:e2e -- --list`
- 화면 캡처: `npm --prefix /d/SejinSource/askback24 run screens` → `review/screens/*.png`
- 서버는 `playwright.config.ts`의 webServer가 가짜 응답 모드로 빌드해 4173에 띄우고 끈다.

## 시험 스위치 `rq:test:tour-off` (TR-09)

- localStorage `rq:test:tour-off` = `"1"`이면 처음 온 사람 안내(스포트라이트)가 저절로 뜨지 않는다. "시연 초기화"는 이 키를 지우지 않는다.
- `playwright.config.ts`의 `use.storageState`(origin `http://localhost:4173`)가 모든 시험에 이 스위치를 켠다. 이 설정을 펼쳐 쓰는 심사위원용 다른 포트 설정에는 들어가지 않는다(origin이 다름).
- 안내 시험(`overnight3.spec.ts`의 TR, `screens.spec.ts`의 `6-s1-tour-*`)만 `test.use({ storageState: { cookies: [], origins: [] } })`로 스위치 없는 새 context에서 돈다.
- 저장소가 막힌 시험(G-13 `blockStorage`)은 스위치를 읽을 수 없어 안내가 뜨면 "건너뛰기"로 넘긴다.

## 도우미

- `helpers.ts` 공용(1차), `helpers2.ts` 2차 추가분, `helpers3.ts` 6차 추가분(결과 화면 상자·도움말 팝업·로딩 기록·안내 단계·화면 밝기로 비춤 읽기·md 절 읽기).
- 질문 항목은 질문마다 남는 펼침 "왜 이 질문인가요"로 찾는다(6차 RS-01로 질문마다의 "복사"가 없어짐). `copyQuestion`은 화면의 질문 문장을 읽는 예전 이름이다.
- ① "공고 확인"으로 갈 때 `openPrep`·`expectCurrentStep(page, '공고 확인')`은 공고 분석 로딩(LD-01, 최대 2.5초)이 끝나 ① 내용이 보일 때까지 기다린다. 로딩 자체를 보는 시험(LD)은 이 도우미를 쓰지 않는다.
- 찾기는 역할·이름·「정확한 문구」만 쓴다. CSS 클래스·`data-testid`·`data-tour`는 쓰지 않는다(ACCEPTANCE에 적힌 `aria-*`·`role=dialog/status`·`<mark data-drawn>`·`data-active`만).
