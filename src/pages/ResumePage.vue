<script setup lang="ts">
// S2 이력서/자기소개서 관리 — M1은 틀(제목·경로·왼쪽 메뉴)만. 이력서 표는 M4에서 data/persona.json 으로 채운다.
import { PERSONA } from '@/demoData'
</script>

<template>
  <div class="s2">
    <h1 class="page-title">이력서/자기소개서 관리</h1>
    <p class="owner"><strong>{{ PERSONA.name }}</strong>님의 이력서입니다</p>
    <p class="pending-note">이력서 세부 내용은 다음 작업에서 채워요.</p>
  </div>
</template>

<style scoped>
.page-title {
  margin-bottom: 2.4rem;
}

.owner {
  margin-bottom: 2.4rem;
  padding: 2rem 2.4rem;
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-gray-subtler);
  font-size: var(--krds-pc-font-size-body-large);
}
</style>
