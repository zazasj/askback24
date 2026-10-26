/**
 * 안내 글(TR-01·02). 화면 글이라 해요체로 짧게, 이 사이트는 "시연 사이트"라고 부른다(사칭 금지).
 * target 은 화면 요소의 data-tour 이름(앞에서부터 그 폭에서 보이는 것). 시험은 이 이름을 쓰지 않는다.
 */
import type { TourStep } from '@/stores/tour'

/** S1 서비스 안내: 이 사이트에 만들어진 기능 전체(지원 → 1차 질문 → 1차 정리 → 최종 질문, 이력서, 시연 도구) */
export const S1_TOUR: readonly TourStep[] = [
  {
    title: '면접 역질문 준비 시연 사이트예요',
    text: '이미 지원한 공고로 면접 끝에 내가 물어볼 질문을 준비하는 서비스예요. 어디서 무엇을 하는지 차례로 보여 드릴게요.',
  },
  {
    title: '채용정보',
    text: '모의 공고를 보고 입사지원하면 이 화면의 지원 현황에 한 줄이 더해져요.',
    target: ['main-jobs'],
  },
  {
    title: '지원 현황',
    text: '지원한 공고가 여기 모여요. 지원 건마다 면접 준비 버튼으로 질문을 준비해요.',
    target: ['s1-table', 's1-card-top'],
  },
  {
    title: '1차 면접 준비',
    text: '"면접 역질문 준비"를 누르면 공고 확인 → 기대·걱정 고르기 → 1차 질문 받기 순서로 가요.',
    target: ['s1-prep-top'],
  },
  {
    title: '최종 면접 준비',
    text: '1차에 합격한 지원 건은 "최종 면접 준비"로 열려요. 1차 면접에서 들은 답을 정리하면 최종 면접·처우 협의 때 물을 질문을 만들어요.',
    target: ['s1-prep-final'],
  },
  {
    title: '이력서',
    text: '김00 이력서의 경험을 "경험 한 줄"로 질문에 붙일 수 있어요. 이력서는 마이페이지 메뉴의 이력서/자기소개서 관리에 있어요.',
    target: ['side-resume', 'side-select'],
  },
  {
    title: '시연 도구',
    text: '시연 띠 오른쪽 시연 도구에서 예시로 채우기·시연 초기화·안내 다시 보기를 쓸 수 있어요. 안내 끄기도 여기 있어요.',
    target: ['demo-tools'],
  },
]

export const JOBS_TOUR: readonly TourStep[] = [
  { title: '채용정보 목록', text: '백엔드 신입 모의 공고예요. 회사명과 공고는 예시예요.', target: ['jobs-table', 'jobs-card-top'] },
  { title: '공고 열기', text: '채용제목을 누르면 공고 상세가 열리고, 거기서 입사지원할 수 있어요.', target: ['jobs-title'] },
]

export const JOB_TOUR: readonly TourStep[] = [
  { title: '공고 상세', text: '공고 요약 아래로 모집요강·근무조건·기업정보가 이어져요.', target: ['job-summary'] },
  {
    title: '입사지원',
    text: '입사지원을 누르면 지원 현황(알선/입사지원 내역)에 한 줄이 더해지고, 거기서 면접 역질문을 준비할 수 있어요.',
    target: ['job-apply'],
  },
]

export const RESUME_TOUR: readonly TourStep[] = [
  { title: '김00 이력서', text: '김00은 시연용 가상 인물이에요. 연락처와 주소는 예시 값이에요.', target: ['resume-owner'] },
  {
    title: '경험이 질문에 붙어요',
    text: '직업훈련·프로젝트에 적은 경험은 면접 준비 ② 단계의 "이력서에서 가져오기"로 질문 앞에 붙일 수 있어요.',
    target: ['resume-exp'],
  },
]

/** ① 공고 확인. 다음 단계 버튼 이름은 면접 종류마다 다르다("내 기대·걱정 고르기"·"1차 면접 정리하기") */
export function postingTour(nextLabel: string): TourStep[] {
  return [
    {
      title: 'AI 분석 요약',
      text: 'AI가 이 공고에서 면접 때 확인할 곳을 미리 찾아 두었어요. 먼저 볼 곳을 누르면 공고의 그 문구로 가요.',
      target: ['posting-summary', 'posting-checks'],
    },
    { title: '형광펜', text: '노란 형광펜을 누르면 AI가 그 문구를 어떤 업무와 연결했는지 보여요.', target: ['posting-mark', 'posting-checks'] },
    { title: '다음 단계', text: `공고를 다 봤으면 아래 바의 "${nextLabel}"를 눌러요.`, target: ['posting-next'] },
  ]
}

export const PICK_TOUR: readonly TourStep[] = [
  {
    title: '기대·걱정 고르기',
    text: '업무 카드마다 기대돼요·걱정돼요·모르겠어요 중 하나를 골라요. 고른 것을 다시 누르면 풀려요.',
    target: ['pick-card'],
  },
  { title: '도움말', text: '낯선 업무는 "도움말"에서 예시와 용어 풀이를 볼 수 있어요.', target: ['card-help'] },
  {
    title: '질문 만들기',
    text: '경험 한 줄을 적으면 질문에 붙여요. 다 골랐으면 "질문 만들기"를 눌러 1차 질문 5개를 받아요.',
    target: ['pick-bar'],
  },
]

export const FIRST_RESULT_TOUR: readonly TourStep[] = [
  {
    title: '1차 질문',
    text: '공고 근거와 내가 고른 것으로 만든 질문이에요. "왜 이 질문인가요"를 펼치면 근거와 주의할 답이 보여요.',
    target: ['result-question'],
  },
  { title: '복사·인쇄', text: '"전체 복사"나 "면접에 들고 갈 한 장 인쇄"로 질문을 챙겨 가요.', target: ['result-tools'] },
  { title: '면접 다녀왔어요', text: '1차 면접에 다녀온 뒤 "면접 다녀왔어요"를 누르면 1차 면접 정리로 가요.', target: ['result-went'] },
]

export const REVIEW_TOUR: readonly TourStep[] = [
  {
    title: '1차 면접 정리',
    text: '가져간 질문마다 물어봤는지 고르고, 들은 답을 한 줄로 적어요. 회사가 물어본 업무와 면접 분위기도 골라요.',
    target: ['review-item'],
  },
  {
    title: '최종 질문 만들기',
    text: '"최종 질문 만들기"를 누르면 최종 면접·처우 협의 때 물을 질문을 만들어요. 들은 답은 저장하지 않아요.',
    target: ['review-make'],
  },
]

export const FINAL_RESULT_TOUR: readonly TourStep[] = [
  {
    title: '최종 면접·처우 질문',
    text: '1차 면접 정리에서 확인된 것은 빼고, 최종 면접에서 물을 것과 처우 협의 때 물을 것을 나눠 골랐어요.',
    target: ['final-summary'],
  },
  {
    title: '챙겨 가기',
    text: '"전체 복사"나 "면접에 들고 갈 한 장 인쇄"로 챙겨 가요. 표준근로계약서 안내도 이 화면에 있어요.',
    target: ['result-tools'],
  },
]
