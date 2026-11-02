/**
 * 모드마다 사실이 다른 화면 글(무엇이 어디로 가는지 · 처리 단계 · 대기 시간). 실제 모드는 지금 시연에서도
 * 엔노이아로 넘어가고(D-371), 가짜 응답 모드는 브라우저 밖으로 나가는 것이 없어 지난 글 그대로 둔다(PLAN-4 T4).
 * 화면과 단위 시험이 같은 값을 쓰도록 한 곳에 둔다. 모드는 부르는 쪽이 API_MODE 로 넘긴다.
 */
import { EXPERIENCE_LEAD } from '@shared/rules'

export interface ModeCopy {
  /** /about-ai 머리 첫 문단 */
  aboutLead: string
  /** /about-ai 처리 단계 아래 최종 면접 문단 */
  aboutFinal: string
  /** /about-ai 개인정보: 우리 서버로 보내는 것 */
  privacySend: string
  /** /about-ai 개인정보: AI 처리 기관으로 넘기는 것(api/_agent/prompts 의 요청 값과 맞춘다) */
  privacyAi: string
  /** /about-ai 개인정보: 서버에 남기지 않는 것 */
  privacyServer: string
  /** ② 경험 한 줄 입력칸 아래 */
  experiencePrivacy: string
  /** 1차 면접 정리 머리 */
  reviewPrivacy: string
  /** 모든 화면 바닥글 둘째 줄 */
  footerPrivacy: string
  /** ③·최종 ③ 만드는 중 제목 아래. 가짜 응답 모드는 1.5초라 없음 */
  generatingWait: string
  /** ③·최종 ③ 전부 검수 문장일 때 다음 할 일 */
  remakeHint: string
}

const REAL: ModeCopy = {
  aboutLead:
    '면접 역질문 준비는 AI 혼자 질문을 정하지 않아요. 공고 근거와 정해 둔 순서 규칙이 먼저 질문을 고르고, AI는 그 질문의 문장을 써요. ' +
    '1차 면접 정리에서는 들은 답이 내 기대와 맞는지도 AI가 판정해요. 지금 시연도 실제 AI(엔노이아)가 쓰고, AI가 쓴 문장과 판정은 검사를 통과해야 화면에 나와요.',
  aboutFinal:
    '1차 면접을 다녀와 물어본 질문과 들은 답을 정리하면, AI가 들은 답이 내 기대·걱정과 맞는지(확인됨·기대와 다름·아직 모름) 판정하고, ' +
    '아직 모르는 것과 처우(임금·근무시간·수습) 질문을 최종 면접용으로 다시 골라요. 판정은 내 기대와 맞는지만 보고 회사를 평가하지 않아요. ' +
    'AI 응답을 받지 못하면 답이 구체적이었는지만 보는 단순 규칙으로 판정해요.',
  privacySend:
    '질문을 만들 때 우리 서버로 보내는 것은 고른 카드·경험 한 줄이고, 최종 면접 준비 때는 1차 면접 정리(들은 답·못 물은 이유·면접 분위기·회사가 물어본 업무)까지예요. 이력서 전체는 보내지 않아요.',
  // 공고 원문은 1차·판정·최종 문장 세 요청 모두에 실린다(prompts/first·judge·final.py <공고>)
  privacyAi:
    '우리 서버는 이 가운데 필요한 것만 AI 처리 기관(엔노이아)에 넘겨요. 지금 시연에서도 실제로 넘어가요. 공고 원문은 늘 함께 넘기고, ' +
    '1차 질문 때는 질문에 쓸 상위 5개 카드와 그 카드의 기대·걱정, 붙일 질문이 있을 때의 경험 한 줄을 넘겨요. ' +
    '최종 면접 준비 때 답 판정에는 들은 답·구체적이었는지·기대·걱정을, 질문 문장에는 물어봤는지·회사가 물어본 업무·1차 판정 결과·면접 분위기에 맞춘 말투를 넘기고, 들은 답은 넘기지 않아요.',
  privacyServer: '우리 서버와 AI 서버는 경험 한 줄·들은 답·면접 분위기를 저장하거나 기록하지 않아요.',
  experiencePrivacy: '이름·학교·회사 이름은 빼고 적어 주세요. 적은 글은 이 브라우저에 저장되고, 질문을 만들 때 AI로 보내요.',
  reviewPrivacy:
    '들은 답과 면접 분위기는 저장하지 않아요. 새로고침하면 지워지고, 만든 최종 질문만 이 브라우저에 남아요. ' +
    '"최종 질문 만들기"를 누르면 들은 답을 AI에 보내 내 기대·걱정과 맞는지(확인됨·기대와 다름·아직 모름) 판정하는 데만 쓰고, 질문 문장을 쓸 때는 보내지 않아요. ' +
    '면접관 이름이나 회사 내부 이야기는 빼고 적어 주세요.',
  footerPrivacy: '실제 개인정보는 입력하지 마세요. 고른 내용과 결과는 이 브라우저에만 저장되고, 질문을 만들 때는 AI로 보내요.',
  generatingWait: '보통 10~25초 걸려요. 늦어지면 미리 검수한 문장으로 보여 드려요.',
  remakeHint: '"AI로 다시 만들기"를 누르면 AI 문장을 다시 받아 볼 수 있어요.',
}

// 가짜 응답 모드: 바꾸지 않는다(시연 밖의 "실제 서비스" 시점으로 말함, A3-r2-05)
const MOCK: ModeCopy = {
  aboutLead:
    '면접 역질문 준비는 AI 혼자 질문을 정하지 않아요. 공고 근거와 정해 둔 순서 규칙이 먼저 질문을 고르고, AI는 그 질문의 문장을 써요. AI가 쓴 문장도 검사를 통과해야 화면에 나와요.',
  aboutFinal:
    '1차 면접을 다녀와 물어본 질문과 들은 답을 정리하면, 아직 모르는 것과 처우(임금·근무시간·수습) 질문을 최종 면접용으로 다시 골라요. ' +
    '들은 답은 구체적이었는지만 보고 회사를 평가하지 않아요. 걱정한 업무는 답이 구체적이어도 걱정이 풀렸는지 알 수 없어 아직 모름으로 남겨요.',
  privacySend:
    '실제 서비스에서 우리 서버로 보내는 것은 고른 카드·경험 한 줄이고, 최종 면접 준비 때는 1차 면접 정리(들은 답·못 물은 이유·면접 분위기·회사가 물어본 업무)까지예요. 이력서 전체는 보내지 않아요.',
  privacyAi:
    '실제 서비스에서 AI로 넘기는 것은 공고 원문과, 1차 질문 때는 질문에 쓸 상위 5개 카드와 그 카드의 기대·걱정, 붙일 질문이 있을 때의 경험 한 줄이에요. ' +
    '최종 면접 준비 때 답 판정에는 들은 답·구체적이었는지·기대·걱정을, 질문 문장에는 물어봤는지·회사가 물어본 업무·1차 판정 결과·면접 분위기에 맞춘 말투를 넘기고, 들은 답은 넘기지 않아요.',
  privacyServer: '서버는 경험 한 줄·들은 답·면접 분위기를 저장하거나 기록하지 않아요.',
  experiencePrivacy: '이름·학교·회사 이름은 빼고 적어 주세요. 적은 글은 이 브라우저에 저장되고, 실제 서비스에서는 질문을 만들 때 AI로 보내요.',
  reviewPrivacy:
    '들은 답과 면접 분위기는 저장하지 않아요. 새로고침하면 지워지고, 만든 최종 질문만 이 브라우저에 남아요. ' +
    '실제 서비스에서는 들은 답을 AI에 보내 내 기대·걱정과 맞는지(확인됨·기대와 다름·아직 모름)를 판정하는 데만 쓰고, 질문 문장을 쓸 때는 보내지 않아요. ' +
    '면접관 이름이나 회사 내부 이야기는 빼고 적어 주세요.',
  footerPrivacy: '실제 개인정보는 입력하지 마세요. 고른 내용과 결과는 이 브라우저에만 저장돼요.',
  generatingWait: '',
  // 가짜 공급자 문장을 AI 문장이라 부르지 않는다(1차 ③ 예시 지원 건 안내와 같은 기준)
  remakeHint: '"AI로 다시 만들기"를 누르면 새 문장을 받아 볼 수 있어요.',
}

export function modeCopy(mock: boolean): ModeCopy {
  return mock ? MOCK : REAL
}

/** ② 경험 한 줄 입력칸 아래 안내가 다루는 경우(picks.ts experienceTarget · rules.ts experienceAnchor) */
export type ExperienceHintCase =
  | { kind: 'empty' }
  | { kind: 'no-target' }
  /** 끝말을 이을 수 없어 검수 문장에는 경험 글 대신 EXPERIENCE_LEAD 가 붙는다(A2-06) */
  | { kind: 'lead'; label: string }
  | { kind: 'quoted'; label: string }

/** 붙이는 규칙을 그대로 적고, 어디에 남고 어디로 가는지를 늘 같이 적는다(A1-07) */
export function experienceHintText(mock: boolean, c: ExperienceHintCase): string {
  const privacy = modeCopy(mock).experiencePrivacy
  const lead = EXPERIENCE_LEAD.trim()
  const ending = '"…해 봤습니다"나 "…했는데"처럼 끝내 주세요.'
  switch (c.kind) {
    case 'empty':
      return `"기대돼요"를 고른 질문 하나 앞에 붙여요. 이력서에서 가져온 경험은 그 경험과 이어진 업무를 "기대돼요"로 골랐다면 그 질문에 붙어요. 비워 둬도 돼요. ${privacy}`
    case 'no-target':
      return `"기대돼요"를 고른 카드가 있으면 그 질문 앞에 붙여요. ${privacy}`
    case 'lead':
      // 실제 모드는 끝말과 상관없이 AI가 경험 글을 살려 쓰고(prompts/first.py has_exp), 검수 문장만 앞말로 바뀐다
      return mock
        ? `"${c.label}" 질문 앞에 "${lead}"로 이어요. 경험을 그대로 넣으려면 ${ending} ${privacy}`
        : `"${c.label}" 질문에 붙여요. AI 응답을 받지 못하면 검수 문장에는 경험 글 대신 "${lead}"가 붙어요. 경험 글을 그대로 넣으려면 ${ending} ${privacy}`
    case 'quoted':
      return `"${c.label}" 질문 앞에 붙여요. ${privacy}`
  }
}
