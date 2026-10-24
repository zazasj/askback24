<script setup lang="ts">
/**
 * 마이페이지 왼쪽 메뉴. 고용24처럼 여러 묶음을 보이되 "구직(이력서) 관리"만 펼쳐 둔다.
 * 동작하는 두 링크 말고는 흐림 표시 + 누르면 범위 밖 알림(G-14).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { vDemoOff } from '@/lib/demoOff'
import { SIDE_LINKS } from './sideLinks'

const OTHER_GROUPS_BEFORE = ['회원정보 관리'] as const
const OTHER_GROUPS_AFTER = ['직업훈련 관리', '실업급여 관리', '취업지원 관리', '출산휴가·육아휴직 관리'] as const
const OTHER_ITEMS_BEFORE = ['구직신청'] as const
const OTHER_ITEMS_AFTER = ['e-채용마당'] as const

const route = useRoute()
const current = computed(() => route.meta.side)
</script>

<template>
  <nav class="side-nav" aria-label="마이페이지 메뉴">
    <h2 class="side-title">마이페이지(개인)</h2>
    <ul class="groups">
      <li v-for="g in OTHER_GROUPS_BEFORE" :key="g">
        <button v-demo-off type="button" class="group-btn">{{ g }}</button>
      </li>
      <li class="is-open">
        <span class="group-btn">구직(이력서) 관리</span>
        <ul class="items">
          <li v-for="i in OTHER_ITEMS_BEFORE" :key="i">
            <button v-demo-off type="button" class="item-link">{{ i }}</button>
          </li>
          <li v-for="link in SIDE_LINKS" :key="link.key">
            <!-- RouterLink 이 현재 화면 링크에 aria-current="page"를 단다. S4는 그 아래 화면이라 모양만 켠다 -->
            <RouterLink :to="link.to" class="item-link" :class="{ 'is-current': current === link.key }">
              {{ link.label }}
            </RouterLink>
          </li>
          <li v-for="i in OTHER_ITEMS_AFTER" :key="i">
            <button v-demo-off type="button" class="item-link">{{ i }}</button>
          </li>
        </ul>
      </li>
      <li v-for="g in OTHER_GROUPS_AFTER" :key="g">
        <button v-demo-off type="button" class="group-btn">{{ g }}</button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.side-nav {
  border-top: 2px solid var(--krds-light-color-border-gray-darker);
}

.side-title {
  padding: 2rem 0 1.6rem;
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
  font-size: var(--krds-pc-font-size-navigation-title-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.groups > li {
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
}

.group-btn {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 5.2rem;
  padding: 0 0.4rem;
  border: 0;
  background: none;
  font-size: var(--krds-pc-font-size-navigation-depth-medium-bold);
  font-weight: 700;
  text-align: left;
  color: var(--krds-light-color-text-bolder);
}

.group-btn.is-demo-off {
  font-weight: 500;
}

.items {
  padding: 0 0 1.2rem;
}

.item-link {
  display: block;
  width: 100%;
  padding: 0.8rem 1.2rem;
  border: 0;
  border-radius: var(--krds-radius-medium1);
  background: none;
  font-size: var(--krds-pc-font-size-navigation-depth-small);
  text-align: left;
  text-decoration: none;
  color: var(--krds-light-color-text-basic);
}

.item-link:not(.is-demo-off):hover {
  background: var(--krds-light-color-surface-gray-subtler);
  color: var(--krds-light-color-text-bolder);
}

.item-link[aria-current='page'],
.item-link.is-current {
  background: var(--krds-light-color-surface-primary-subtler);
  color: var(--krds-light-color-text-primary);
  font-weight: 700;
}
</style>
