/** 화면에서만 쓰는 데이터 모양(서버와 주고받는 형식은 shared/contract.ts). */

export type ApplyResult = '서류합격' | '1차 합격' | '최종 합격' | '불합격' | '-'

/** 알선/입사지원 내역 한 건. 시드는 applied_days_ago, 새로 지원한 건은 applied_on 을 쓴다 */
export interface Application {
  apply_id: string
  wantedAuthNo: string
  applied_days_ago?: number
  /** YYYY-MM-DD */
  applied_on?: string
  /** null = 아직 열람 안 함 */
  viewed_days_ago: number | null
  result: ApplyResult
  /** 시드만: 이 예시 구직자의 ② 선택과 1차 결과(검수 문장)를 가진 채로 시작한다(R-07) */
  prep_seed?: 'A' | 'B'
}

export interface Persona {
  name: string
  basic: {
    name: string
    gender: string
    birth_year: number
    age: number
    address: string
    phone: string
    email: string
    military: string
  }
  hope: { job: string; career: string; region: string; salary: string; employment: string; workdays: string }
  education: Array<{ school: string; major: string; degree: string; graduated: string }>
  careers: Array<{ company: string; role: string; period: string; summary: string }>
  trainings: Array<{ name: string; period: string; summary: string }>
  projects: Array<{ name: string; stack: string; summary: string }>
  certificates: Array<{ name: string; date: string }>
  skills: string[]
  self_intro: Array<{ title: string; body: string }>
  /** S4 ② "이력서에서 가져오기" 칩 */
  experience_chips: Array<{ card_id: string; label: string; text: string }>
}

export interface Crumb {
  label: string
  to?: string
}
