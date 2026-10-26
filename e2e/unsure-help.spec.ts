/**
 * U — "모르겠어요" 돕기(2026-10-25, D-175·176). ACCEPTANCE 「3차 추가분」.
 * ③ 1차 결과의 "더 알아볼 질문".
 *
 * 6차(2026-10-26) 「바뀐 기존 항목」대로 아래 시험은 없앴다(ID는 ACCEPTANCE에 남음):
 * - U-01·U-02·U-06 → HP-01~05(카드 안 "예를 들면" 펼침 대신 늘 보이는 "도움말" 팝업, "모르겠어요"에 저절로 열기 없음, 카드 높이 모두 같음)
 * - U-05 → RS-01·RS-04(더 알아볼 질문에 복사 버튼 없음, 문장은 "전체 복사" 글 끝)
 * 새 시험은 e2e/overnight3.spec.ts.
 */
import { expect, test } from '@playwright/test'
import { cardGroup, goToCardsStep, heading, makeFirstQuestions, makeQuestionsButton, openPrep, pickRadio, questionItems, waitFirstResults } from './helpers'

test.use({ actionTimeout: 10_000, permissions: ['clipboard-read', 'clipboard-write'] })

test('U-03 ③ 예시 A × OO소프트: 질문 5개 아래 "더 알아볼 질문" 3개(공고에 나온 모르겠어요 카드 순), 5개와 겹치지 않음', async ({ page }) => {
  await makeFirstQuestions(page, 'oo')
  await expect(questionItems(page)).toHaveCount(5)
  await expect(heading(page, '더 알아볼 질문')).toBeVisible()
  await expect(page.getByText('배우려는 태도')).toBeVisible()
  const list = page.getByRole('list', { name: '더 알아볼 질문 목록' })
  const items = list.getByRole('listitem')
  await expect(items).toHaveCount(3)
  // H2-07 ③(세진 승인 2026-10-25): 공고에 적힌 카드(산출물 작성)가 유추한 카드(SQL·요구사항 협의)보다 먼저
  const expected = ['개발 문서·산출물 작성', 'SQL 작성·쿼리 개선', '요구사항 협의']
  for (const [i, name] of expected.entries()) {
    await expect(items.nth(i)).toContainText(name)
    await expect(items.nth(i)).toContainText('탐색')
  }
  const fiveText = (await questionItems(page).allInnerTexts()).join('\n')
  for (const name of expected) expect(fiveText, `${name}이 질문 5개에도 있다`).not.toContain(name)
})

test('U-04 ③ "모르겠어요"를 고르지 않으면 "더 알아볼 질문"이 없다', async ({ page }) => {
  const base = await openPrep(page, 'oo')
  await goToCardsStep(page, base)
  await pickRadio(cardGroup(page, '신규 API 개발'), '기대돼요')
  await pickRadio(cardGroup(page, '기존 시스템 유지보수'), '걱정돼요')
  await makeQuestionsButton(page).click()
  await waitFirstResults(page)
  await expect(heading(page, '더 알아볼 질문')).toHaveCount(0)
})
