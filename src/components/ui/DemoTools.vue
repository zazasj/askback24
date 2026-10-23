<script setup lang="ts">
/**
 * 오른쪽 아래 "시연 도구". 시연용 버튼을 본 화면에서 빼 두어 실제 서비스처럼 보이게 한다.
 * 화면별 버튼(useDemoToolActions)이 위, 공통 버튼(안내 다시 보기·시연 초기화)이 아래.
 */
import { nextTick, ref, useTemplateRef } from 'vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { useDemoStore } from '@/stores/demo'
import { useDemoToolsStore, type DemoToolAction } from '@/stores/demoTools'
import { useToastStore } from '@/stores/toast'

const tools = useDemoToolsStore()
const demo = useDemoStore()
const toast = useToastStore()
const router = useRouter()

const root = useTemplateRef<HTMLElement>('root')
const toggle = useTemplateRef<HTMLButtonElement>('toggle')
const busy = ref(false)

function close(returnFocus = false): void {
  if (!tools.open) return
  tools.open = false
  if (returnFocus) void nextTick(() => toggle.value?.focus())
}

onClickOutside(root, () => close())
onKeyStroke('Escape', () => close(true))

function run(action: DemoToolAction): void {
  close(true)
  action.run()
}

async function showGuideAgain(): Promise<void> {
  close(true)
  demo.showGuide()
  await router.push('/mypage/applications')
}

async function resetDemo(): Promise<void> {
  if (busy.value) return
  busy.value = true
  close(true)
  tools.resetAll()
  await router.push('/mypage/applications')
  toast.show('시연을 처음 상태로 되돌렸어요')
  busy.value = false
}
</script>

<template>
  <div ref="root" class="demo-tools">
    <div v-show="tools.open" id="demo-tools-panel" class="panel" role="group" aria-labelledby="demo-tools-title">
      <p id="demo-tools-title" class="panel-title">시연용 버튼</p>
      <ul v-if="tools.pageActions.length" class="actions">
        <li v-for="a in tools.pageActions" :key="a.id">
          <button type="button" class="action" @click="run(a)">{{ a.label }}</button>
        </li>
      </ul>
      <ul class="actions is-common">
        <li><button type="button" class="action" @click="showGuideAgain">안내 다시 보기</button></li>
        <li><button type="button" class="action" :disabled="busy" @click="resetDemo">시연 초기화</button></li>
      </ul>
    </div>
    <button
      ref="toggle"
      type="button"
      class="toggle"
      aria-controls="demo-tools-panel"
      :aria-expanded="tools.open"
      @click="tools.open = !tools.open"
    >
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path
          d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3M4 4l2.1 2.1M13.9 13.9L16 16M4 16l2.1-2.1M13.9 6.1L16 4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
      <span>시연 도구</span>
    </button>
  </div>
</template>

<style scoped>
.demo-tools {
  position: fixed;
  right: 2.4rem;
  bottom: 2.4rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.8rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: var(--rq-touch);
  padding: 0 1.6rem;
  border: 1px solid var(--krds-light-color-border-gray-dark);
  border-radius: var(--krds-radius-max);
  background: var(--krds-light-color-surface-white);
  box-shadow: var(--rq-shadow-pop);
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.toggle[aria-expanded='true'] {
  border-color: var(--krds-light-color-border-gray-darker);
}

.toggle svg {
  width: 2rem;
  height: 2rem;
}

.panel {
  width: 26rem;
  max-width: calc(100vw - 3.2rem);
  padding: 1.2rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
  box-shadow: var(--rq-shadow-pop);
}

.panel-title {
  padding: 0.4rem 0.8rem 0.8rem;
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-subtle);
}

.actions.is-common {
  margin-top: 0.4rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--krds-light-color-divider-gray-light);
}

.action {
  display: block;
  width: 100%;
  min-height: var(--rq-touch);
  padding: 0 0.8rem;
  border: 0;
  border-radius: var(--krds-radius-medium1);
  background: none;
  font-size: var(--krds-pc-font-size-body-small);
  text-align: left;
  color: var(--krds-light-color-text-basic);
}

.action:hover {
  background: var(--krds-light-color-surface-gray-subtler);
}

@media (max-width: 767px) {
  .demo-tools {
    right: 1.6rem;
    bottom: 1.6rem;
  }
}
</style>
