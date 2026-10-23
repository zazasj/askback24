<script setup lang="ts">
// 경로 표시. 마지막 항목 = 화면 제목(G-05). 라우터 meta.crumbs 로 만든다.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { Crumb } from '@/types'

const route = useRoute()
const crumbs = computed<Crumb[]>(() => [{ label: '홈', to: '/' }, ...(route.meta.crumbs ?? [])])

/** 마지막 바로 앞의 링크(돌아갈 곳). 휴대폰에서 중간 경로를 접을 때 이것만 "‹ 이름"으로 남긴다 */
const parentIndex = computed(() => {
  for (let i = crumbs.value.length - 2; i >= 0; i--) if (crumbs.value[i].to) return i
  return -1
})
// 홈과 돌아갈 곳 사이에 경로가 더 있을 때만 접는다(S4: 홈 › 마이페이지 › 알선/입사지원 내역 › 면접 역질문 준비)
const collapsible = computed(() => parentIndex.value >= 2)
</script>

<template>
  <nav class="breadcrumb" :class="{ 'is-collapsible': collapsible }" aria-label="현재 위치">
    <ol>
      <li
        v-for="(c, i) in crumbs"
        :key="`${i}-${c.label}`"
        :class="{ 'is-before': i < parentIndex, 'is-parent': i === parentIndex, 'is-current': i === crumbs.length - 1 }"
      >
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

/* 휴대폰: 긴 경로가 두 줄이 되지 않게 "‹ 알선/입사지원 내역" 한 줄만(DR-r2-01).
   현재 화면 이름은 바로 아래 제목과 같아 화면낭독기에만 남긴다(G-05가 마지막 항목을 읽음) */
@media (max-width: 767px) {
  .is-collapsible .is-before {
    display: none;
  }

  .is-collapsible .is-parent::before {
    content: '‹';
    content: '‹' / '';
    margin: 0 0.6rem 0 0;
    font-size: var(--krds-pc-font-size-body-medium);
    line-height: 1;
    color: var(--krds-light-color-text-subtle);
  }

  .is-collapsible .is-current {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
}
</style>
