/** 왼쪽 메뉴 중 실제로 동작하는 두 화면. 휴대폰 선택 상자와 같이 쓴다. */
export type SideKey = 'resume' | 'applications'

export const SIDE_LINKS: ReadonlyArray<{ key: SideKey; label: string; to: string }> = [
  { key: 'resume', label: '이력서/자기소개서 관리', to: '/mypage/resume' },
  { key: 'applications', label: '알선/입사지원 내역', to: '/mypage/applications' },
]
