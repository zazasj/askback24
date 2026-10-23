<script setup lang="ts">
/**
 * 시연 띠 오른쪽 끝의 "시연 도구". 시연용 버튼을 본 화면에서 빼 두어 실제 서비스처럼 보이게 하고,
 * 띠 안에 두어 본문을 가리지 않으면서 "시연용"이라는 뜻을 함께 보인다(DR-r1-01).
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
  if (returnFocus) void nextTick(() => toggle.value?.focus({ preventScroll: true }))
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
  // 이미 지원 내역에 있으면 이동이 없어 안내 띠가 화면 밖에 남을 수 있다
  window.scrollTo({ top: 0 })
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
    <button
      id="demo-tools-toggle"
      ref="toggle"
      type="button"
      class="toggle tap-target"
      aria-controls="demo-tools-panel"
      :aria-expanded="tools.open"
      @click="tools.open = !tools.open"
    >
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
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
  </div>
</template>

<style scoped>
.demo-tools {
  position: relative;
  flex: none;
}

/* 어두운 시연 띠 위의 버튼: 띠와 같은 회색 계열, 테두리로만 구분 */
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 3.2rem;
  padding: 0 1.2rem;
  border: 1px solid var(--krds-color-light-gray-30);
  border-radius: var(--krds-radius-max);
  background: transparent;
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  color: var(--krds-color-light-gray-0);
}

.toggle:hover {
  background: var(--krds-color-light-gray-70);
}

.toggle[aria-expanded='true'] {
  border-color: var(--krds-color-light-gray-0);
  background: var(--krds-color-light-gray-0);
  color: var(--krds-color-light-gray-90);
}

.toggle:focus-visible {
  outline-color: var(--krds-color-light-gray-0);
}

.toggle svg {
  width: 1.6rem;
  height: 1.6rem;
}

/* 패널은 띠 바로 아래로 펼친다(본문 위에 겹치지만 열었을 때만) */
.panel {
  position: absolute;
  top: calc(100% + 1rem);
  right: 0;
  z-index: 60;
  width: 26rem;
  max-width: calc(100vw - 3.2rem);
  padding: 1.2rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
  box-shadow: var(--rq-shadow-pop);
  color: var(--krds-light-color-text-basic);
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
</style>
