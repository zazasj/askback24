<script setup lang="ts">
// 휴대폰 폭: 왼쪽 메뉴 대신 페이지 제목 위 선택 상자(설계 노트 「공통 틀」).
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SIDE_LINKS } from './sideLinks'

const route = useRoute()
const router = useRouter()

const value = computed({
  get: () => SIDE_LINKS.find((l) => l.key === route.meta.side)?.to ?? '',
  set: (to: string) => {
    if (to && to !== route.path) void router.push(to)
  },
})
</script>

<template>
  <!-- 휴대폰 S1 서비스 안내 "이력서" 단계가 왼쪽 메뉴 대신 비추는 곳(TR-07) -->
  <div class="side-select" data-tour="side-select">
    <label for="side-select" class="label">마이페이지 메뉴</label>
    <select id="side-select" v-model="value" class="input">
      <option v-for="l in SIDE_LINKS" :key="l.key" :value="l.to">{{ l.label }}</option>
    </select>
  </div>
</template>

<style scoped>
.side-select {
  display: none;
}

@media (max-width: 767px) {
  .side-select {
    display: grid;
    gap: 0.4rem;
    margin-bottom: 1.6rem;
  }
}

.label {
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-subtle);
}

.input {
  width: 100%;
}
</style>
