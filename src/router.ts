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

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.afterEach((to) => {
  if (to.meta.title) setDocumentTitle(to.meta.title)
})
