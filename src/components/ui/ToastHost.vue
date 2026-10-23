<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <!-- 영역은 늘 두고 글만 바꾼다: 화면낭독기가 새 글을 읽는다 -->
  <div class="toast-host" role="status" aria-live="polite" aria-atomic="true">
    <p v-if="toast.message" :key="toast.seq" class="toast">{{ toast.message }}</p>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  bottom: 9.6rem;
  z-index: 60;
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100vw - 3.2rem);
  pointer-events: none;
}

.toast {
  padding: 1.2rem 2rem;
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-inverse);
  color: var(--krds-light-color-text-basic-inverse);
  box-shadow: var(--rq-shadow-pop);
  font-size: var(--krds-pc-font-size-body-small);
  font-weight: 500;
  text-align: center;
  animation: toast-in 0.18s ease-out;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(0.8rem);
  }
}
</style>
