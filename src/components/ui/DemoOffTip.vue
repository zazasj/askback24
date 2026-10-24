<script setup lang="ts">
/**
 * 흐린 컨트롤(.is-demo-off)의 설명 "시연 범위 밖이에요". 화면에 하나만 두고 문서 이벤트로 띄운다(G-14).
 * 마우스를 올리거나 키보드로 초점이 가면 보이고, Esc 로 닫히며, 설명 위로 마우스를 옮겨도 남는다(WCAG 1.4.13).
 * 터치는 누르면 알림이 바로 뜨므로 설명을 띄우지 않는다. 흐린 컨트롤의 aria-describedby 가 이 요소를 가리켜
 * 화면낭독기는 숨어 있을 때도 설명을 읽는다.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { DEMO_OFF_CLASS, DEMO_OFF_TIP, DEMO_OFF_TIP_ID } from '@/lib/demoOff'

const GAP = 8
const EDGE = 8

const hoverEl = ref<HTMLElement | null>(null)
const focusEl = ref<HTMLElement | null>(null)
const dismissed = ref<HTMLElement | null>(null)
const target = computed(() => {
  const el = hoverEl.value ?? focusEl.value
  return el && el !== dismissed.value ? el : null
})

const tip = useTemplateRef<HTMLElement>('tip')
const pos = ref({ left: 0, top: 0, arrow: 0, above: false })

function demoOffOf(node: EventTarget | null): HTMLElement | null {
  return node instanceof Element ? node.closest<HTMLElement>(`.${DEMO_OFF_CLASS}`) : null
}

async function place(): Promise<void> {
  await nextTick()
  const el = target.value
  const box = tip.value
  if (!el || !box) return
  const r = el.getBoundingClientRect()
  const w = box.offsetWidth
  const h = box.offsetHeight
  const vw = document.documentElement.clientWidth
  const cx = r.left + r.width / 2
  const left = Math.min(Math.max(cx - w / 2, EDGE), Math.max(EDGE, vw - w - EDGE))
  // 아래 자리가 모자라면 위로
  const above = r.bottom + GAP + h > window.innerHeight - EDGE && r.top - GAP - h >= EDGE
  pos.value = {
    left,
    top: above ? r.top - GAP - h : r.bottom + GAP,
    arrow: Math.min(Math.max(cx - left, 12), w - 12),
    above,
  }
}

function onPointerOver(e: PointerEvent): void {
  if (e.pointerType === 'touch') return
  const el = demoOffOf(e.target)
  if (!el || el === hoverEl.value) return
  hoverEl.value = el
  dismissed.value = null
  void place()
}

function onPointerOut(e: PointerEvent): void {
  const from = hoverEl.value
  if (!from) return
  const to = e.relatedTarget
  // 같은 컨트롤 안이나 설명 위로 옮겨 가면 그대로 둔다(설명 위에 마우스를 올릴 수 있게)
  if (to instanceof Node && (from.contains(to) || tip.value?.contains(to))) return
  hoverEl.value = null
}

function onTipLeave(e: PointerEvent): void {
  const to = e.relatedTarget
  if (to instanceof Node && hoverEl.value?.contains(to)) return
  hoverEl.value = null
}

// 눌러서 생긴 초점에는 띄우지 않는다(마우스는 올림으로 이미 보이고, 터치는 알림만). 누름 → 초점 → 뗌 순서라 뗄 때 지운다
let pressed: HTMLElement | null = null

function onPointerDown(e: PointerEvent): void {
  pressed = demoOffOf(e.target)
}

function onPointerUp(): void {
  pressed = null
}

function onFocusIn(e: FocusEvent): void {
  const el = demoOffOf(e.target)
  focusEl.value = el && el !== pressed ? el : null
  dismissed.value = null
  if (focusEl.value) void place()
}

function onFocusOut(e: FocusEvent): void {
  if (focusEl.value && !(e.relatedTarget instanceof Node && focusEl.value.contains(e.relatedTarget))) focusEl.value = null
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && target.value) dismissed.value = target.value
}

function onViewportChange(): void {
  if (target.value) void place()
}

// 화면이 바뀌면 가리키던 컨트롤이 사라질 수 있다(사라진 요소에는 pointerout·focusout 이 안 올 수 있음)
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    hoverEl.value = null
    focusEl.value = null
  },
)

onMounted(() => {
  document.addEventListener('pointerover', onPointerOver)
  document.addEventListener('pointerout', onPointerOut)
  document.addEventListener('pointerdown', onPointerDown, { capture: true })
  document.addEventListener('pointerup', onPointerUp, { capture: true })
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('scroll', onViewportChange, { passive: true, capture: true })
  window.addEventListener('resize', onViewportChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerover', onPointerOver)
  document.removeEventListener('pointerout', onPointerOut)
  document.removeEventListener('pointerdown', onPointerDown, { capture: true })
  document.removeEventListener('pointerup', onPointerUp, { capture: true })
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('focusout', onFocusOut)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('scroll', onViewportChange, { capture: true })
  window.removeEventListener('resize', onViewportChange)
})
</script>

<template>
  <div
    v-show="target"
    :id="DEMO_OFF_TIP_ID"
    ref="tip"
    class="demo-off-tip"
    :class="{ 'is-above': pos.above }"
    role="tooltip"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px`, '--arrow-x': `${pos.arrow}px` }"
    @pointerleave="onTipLeave"
  >
    {{ DEMO_OFF_TIP }}
  </div>
</template>

<style scoped>
.demo-off-tip {
  position: fixed;
  z-index: 70;
  padding: 0.6rem 1.2rem;
  border-radius: var(--krds-radius-medium2);
  background: var(--krds-light-color-surface-inverse);
  box-shadow: var(--rq-shadow-pop);
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
  color: var(--krds-light-color-text-basic-inverse);
}

/* 컨트롤 쪽을 가리키는 작은 화살표 */
.demo-off-tip::before {
  content: '';
  position: absolute;
  left: var(--arrow-x);
  top: -0.5rem;
  border: 0.6rem solid transparent;
  border-top: 0;
  border-bottom-color: var(--krds-light-color-surface-inverse);
  transform: translateX(-50%);
}

.demo-off-tip.is-above::before {
  top: auto;
  bottom: -0.5rem;
  border-top: 0.6rem solid var(--krds-light-color-surface-inverse);
  border-bottom: 0;
}

@media print {
  .demo-off-tip {
    display: none !important;
  }
}
</style>
