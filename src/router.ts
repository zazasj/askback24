import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import type { SideKey } from '@/components/gov/sideLinks'
import { NOT_FOUND_TITLE, setDocumentTitle } from '@/lib/title'
import type { Crumb } from '@/types'
import AboutAiPage from '@/pages/AboutAiPage.vue'
import ApplicationsPage from '@/pages/ApplicationsPage.vue'
import InterviewPrepPage from '@/pages/InterviewPrepPage.vue'
import JobDetailPage from '@/pages/JobDetailPage.vue'
import JobListPage from '@/pages/JobListPage.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'
import ResumePage from '@/pages/ResumePage.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** 문서 제목 "<title> | 고용24 (시연)". 화면마다 바뀌면 비워 두고 화면이 usePageTitle 로 정한다 */
    title?: string
    /** 홈 다음부터의 경로 표시. 마지막 항목 = 화면 제목 */
    crumbs?: Crumb[]
    /** 마이페이지 왼쪽 메뉴를 보일 때 현재 메뉴 */
    side?: SideKey
  }
}

// 마이페이지 첫 화면이 따로 없어 링크를 달지 않는다(지원 내역 링크와 겹쳐 aria-current 가 잘못 붙음)
const MYPAGE: Crumb[] = [{ label: '마이페이지' }, { label: '구직(이력서) 관리' }]

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/mypage/applications' },
  {
    path: '/mypage/applications',
    name: 'applications',
    component: ApplicationsPage,
    meta: { title: '알선/입사지원 내역', crumbs: [...MYPAGE, { label: '알선/입사지원 내역' }], side: 'applications' },
  },
  {
    path: '/mypage/applications/:applyId/prep',
    name: 'prep',
    component: InterviewPrepPage,
    meta: {
      title: '면접 역질문 준비',
      crumbs: [...MYPAGE, { label: '알선/입사지원 내역', to: '/mypage/applications' }, { label: '면접 역질문 준비' }],
      side: 'applications',
    },
  },
  {
    path: '/mypage/resume',
    name: 'resume',
    component: ResumePage,
    meta: { title: '이력서/자기소개서 관리', crumbs: [...MYPAGE, { label: '이력서/자기소개서 관리' }], side: 'resume' },
  },
  { path: '/jobs', name: 'jobs', component: JobListPage, meta: { title: '채용정보', crumbs: [{ label: '채용정보' }] } },
  {
    path: '/jobs/:wantedAuthNo',
    name: 'job',
    component: JobDetailPage,
    meta: { crumbs: [{ label: '채용정보', to: '/jobs' }, { label: '채용정보 상세' }] },
  },
  {
    path: '/about-ai',
    name: 'about-ai',
    component: AboutAiPage,
    meta: {
      title: '이 질문은 어떻게 만들어지나요',
      crumbs: [{ label: '면접 역질문 준비' }, { label: '이 질문은 어떻게 만들어지나요' }],
    },
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage, meta: { title: NOT_FOUND_TITLE, crumbs: [{ label: NOT_FOUND_TITLE }] } },
]

/** S4 단계 표시(StepNav.vue) */
const PREP_STEPS = '#prep-steps'

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => {
    if (saved) return saved
    // 휴대폰이나 낮은 화면(높이 860px 미만: 1366×768 노트북·브라우저 확대)에서 S4 단계·면접 종류(쿼리)만 바뀌면
    // 머리 대신 단계 표시부터 보이게 한다. 맨 위로 가면 고용24 틀과 머리가 첫 화면을 거의 다 차지해
    // 만드는 중·카드·질문이 보이지 않는다(DR-r1-02, H1-02 나). 1440×900 같은 높은 화면은 회사 맥락을 남겨 맨 위(D-078)
    const sameScreen = to.name === 'prep' && to.path === from.path
    if (sameScreen && window.matchMedia('(max-width: 767px), (max-height: 859px)').matches && document.querySelector(PREP_STEPS))
      return { el: PREP_STEPS, top: 8 }
    return { top: 0 }
  },
})

router.afterEach((to) => {
  if (to.meta.title) setDocumentTitle(to.meta.title)
})
