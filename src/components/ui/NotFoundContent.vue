<script setup lang="ts">
import { NOT_FOUND_TITLE, usePageTitle } from '@/lib/title'

defineProps<{ detail?: string }>()
usePageTitle(NOT_FOUND_TITLE)
</script>

<template>
  <section class="not-found" aria-labelledby="not-found-title">
    <h1 id="not-found-title" class="page-title">{{ NOT_FOUND_TITLE }}</h1>
    <p class="text">{{ detail ?? '주소가 바뀌었거나 없는 화면이에요. 시연은 지원 내역에서 시작해요.' }}</p>
    <RouterLink to="/mypage/applications" class="btn btn-primary">알선/입사지원 내역으로</RouterLink>
  </section>
</template>

<style scoped>
.not-found {
  display: grid;
  justify-items: start;
  gap: 1.6rem;
  padding: 4.8rem 0;
}

.text {
  color: var(--krds-light-color-text-subtle);
}

.btn-primary,
.btn-primary:hover {
  color: var(--krds-light-color-text-basic-inverse);
}
</style>
