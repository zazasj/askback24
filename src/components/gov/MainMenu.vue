<script setup lang="ts">
// 고용24와 같은 다섯 메뉴. 채용정보만 동작하고 나머지는 "시연 범위 밖" 알림만 띄운다(G-03).
import { useToastStore } from '@/stores/toast'

const OTHERS = ['취업지원', '실업급여', '직업 능력 개발', '출산휴가·육아휴직'] as const
const toast = useToastStore()
</script>

<template>
  <nav class="main-menu" aria-label="주 메뉴">
    <div class="inner">
      <ul class="menu-list">
        <li>
          <RouterLink to="/jobs" class="menu-item" active-class="is-active">
            <span>채용정보</span>
            <svg class="chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" />
            </svg>
          </RouterLink>
        </li>
        <li v-for="name in OTHERS" :key="name">
          <button type="button" class="menu-item" @click="toast.outOfScope()">
            <span>{{ name }}</span>
            <svg class="chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" />
            </svg>
          </button>
        </li>
      </ul>
      <button type="button" class="all-menu" @click="toast.outOfScope()">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="1.6" />
        </svg>
        <span>전체 메뉴</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.main-menu {
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
  background: var(--krds-light-color-surface-white);
}

.inner {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 1.6rem;
  max-width: var(--rq-container);
  margin: 0 auto;
  padding: 0 var(--rq-gutter);
}

.menu-list {
  display: flex;
  gap: 0.4rem;
  min-width: 0;
}

.menu-item {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 5.6rem;
  padding: 0 1.6rem;
  border: 0;
  border-bottom: 3px solid transparent;
  background: none;
  font-size: var(--krds-pc-font-size-navigation-depth-medium);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
  text-decoration: none;
  white-space: nowrap;
}

.menu-item:hover,
.menu-item.is-active {
  border-bottom-color: var(--krds-light-color-border-primary);
  color: var(--krds-light-color-text-primary);
}

.chev {
  width: 1.2rem;
  height: 1.2rem;
  color: var(--krds-light-color-icon-gray-light);
}

.all-menu {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  flex: none;
  border: 0;
  background: none;
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 500;
  color: var(--krds-light-color-text-subtle);
}

@media (max-width: 1023px) {
  .menu-item {
    padding: 0 1rem;
    font-size: var(--krds-pc-font-size-navigation-depth-small);
  }
}

/* 휴대폰: 메뉴 줄만 옆으로 밀어 보게 한다(페이지 전체 가로 스크롤은 생기지 않음) */
@media (max-width: 767px) {
  .inner {
    padding: 0;
  }

  .menu-list {
    overflow-x: auto;
    padding: 0 var(--rq-gutter);
    scrollbar-width: none;
  }

  .menu-item {
    min-height: var(--rq-touch);
    padding: 0 0.8rem;
  }

  .chev,
  .all-menu {
    display: none;
  }
}
</style>
