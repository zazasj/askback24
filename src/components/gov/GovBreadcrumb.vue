<script setup lang="ts">
// 경로 표시. 마지막 항목 = 화면 제목(G-05). 라우터 meta.crumbs 로 만든다.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { Crumb } from '@/types'

const route = useRoute()
const crumbs = computed<Crumb[]>(() => [{ label: '홈', to: '/' }, ...(route.meta.crumbs ?? [])])
</script>

<template>
  <nav class="breadcrumb" aria-label="현재 위치">
    <ol>
      <li v-for="(c, i) in crumbs" :key="`${i}-${c.label}`">
        <RouterLink v-if="c.to && i < crumbs.length - 1" :to="c.to" class="tap-target">{{ c.label }}</RouterLink>
        <span v-else :aria-current="i === crumbs.length - 1 ? 'location' : undefined">{{ c.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.breadcrumb {
  margin-bottom: 2.4rem;
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

ol {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0;
}

li {
  display: inline-flex;
  align-items: center;
}

li + li::before {
  content: '›';
  margin: 0 0.8rem;
  color: var(--krds-light-color-icon-gray-light);
}

a {
  color: var(--krds-light-color-text-subtle);
  text-decoration: none;
}

a:hover {
  color: var(--krds-light-color-text-basic);
  text-decoration: underline;
}

span[aria-current] {
  font-weight: 700;
  color: var(--krds-light-color-text-basic);
}
</style>
