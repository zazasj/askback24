<script setup lang="ts">
// 가짜 응답 모드(VITE_API_MODE=mock)에서는 질문 문장을 LLM이 아니라 규칙과 예시 문장으로 만든다.
// 화면의 "AI" 표시만 보고 AI 결과로 받아들이지 않게 결과·만드는 중 제목 옆에 단다(DR-r1-06).
import { API_MODE } from '@/api/client'

const isMock = API_MODE === 'mock'
</script>

<template>
  <span v-if="isMock" class="mock-tag">가짜 응답 모드 · AI 대신 규칙과 예시 문장</span>
</template>

<style scoped>
.mock-tag {
  display: inline-flex;
  align-items: center;
  min-height: 2.4rem;
  padding: 0.2rem 0.8rem;
  border: 1px solid var(--krds-light-color-border-gray);
  border-radius: var(--krds-radius-small2);
  background: var(--krds-light-color-surface-gray-subtler);
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 500;
  line-height: 1.4;
  color: var(--krds-light-color-text-basic);
}
</style>
