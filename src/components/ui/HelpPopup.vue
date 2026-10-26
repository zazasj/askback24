<script setup lang="ts">
/**
 * "도움말" 버튼과 그 팝업(HP-01~07). 팝업은 기본 <dialog>를 body로 옮겨 그린다(Teleport) — 카드 높이·격자를 건드리지 않게.
 * 데스크톱(768px 이상): show()로 버튼 위(안 들어가면 아래)에 뜨는 말풍선. 바깥을 누르면 닫히고 그 누르기는 그대로 간다.
 * 휴대폰(767px 이하): showModal()로 아래 시트 — 어두운 막, 뒤 화면 비활성·스크롤 잠금.
 * 열면 초점을 팝업으로, 닫기·Esc·바깥 누르기로 닫으면 버튼으로 돌린다. 화면 전체에서 한 번에 하나(helpPopupState).
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { activeHelp, releaseHelp, setActiveHelp } from './helpPopupState'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** 무엇의 도움말인지(카드 이름). 버튼·팝업 이름은 "<title> 도움말" */
    title: string
    /** 말풍선 왼끝·폭을 맞출 상자(카드). 없으면 버튼 기준 */
    boundary?: HTMLElement | null
  }>(),
  { boundary: null },
)

const HELP = '도움말'
const SHEET_QUERY = '(max-width: 767px)'
const LOCK_CLASS = 'is-scroll-locked'
/** 화면 끝·고정 바와 띄우는 거리, 버튼과 말풍선 사이(꼬리 자리) */
const EDGE = 8
const GAP = 10
const MIN_W = 280
const MAX_W = 400

const uid = useId()
const dialogId = `help-${uid}`
const titleId = `${dialogId}-title`
const name = computed(() => `${props.title} ${HELP}`)

const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const isOpen = computed(() => activeHelp.value === dialogId)
const sheet = ref(false)

async function open(): Promise<void> {
  setActiveHelp(dialogId)
  sheet.value = window.matchMedia(SHEET_QUERY).matches
  await nextTick()
  const el = dialog.value
  if (!el || !isOpen.value) return
  if (sheet.value) {
    // 앞서 데스크톱 폭에서 열었을 때 남은 자리 값을 지운다(시트는 CSS 로 아래에 붙는다)
    for (const p of ['top', 'left', 'width', '--help-max-h', '--help-arrow-x']) el.style.removeProperty(p)
    if (!el.open) el.showModal()
    document.documentElement.classList.add(LOCK_CLASS)
  } else {
    // show()는 안쪽 첫 버튼에 초점을 주며 그 자리로 스크롤한다. 자리 값이 없으면 dialog는 body 끝(문서 맨 아래)에 있어
    // 화면이 맨 아래로 튄다. 먼저 지금 보이는 곳 왼쪽 위에 두고 연 뒤 place()로 버튼 옆에 옮긴다
    el.style.top = `${Math.round(window.scrollY)}px`
    el.style.left = `${Math.round(window.scrollX)}px`
    if (!el.open) el.show()
    place()
    // 여는 click 은 이미 document 캡처 단계를 지났으므로 바로 달아도 그 click 에 닫히지 않는다
    document.addEventListener('click', onDocumentClick, true)
    window.addEventListener('resize', onResize)
  }
  // 팝업은 이미 화면 안에 놓였다(말풍선 place, 시트는 아래 고정). 초점 때문에 뒤 화면이 움직이지 않게
  el.focus({ preventScroll: true })
}

/** 팝업만 닫는다(초점은 건드리지 않음) */
function hide(): void {
  document.removeEventListener('click', onDocumentClick, true)
  window.removeEventListener('resize', onResize)
  if (sheet.value) document.documentElement.classList.remove(LOCK_CLASS)
  if (dialog.value?.open) dialog.value.close()
}

/**
 * 사용자가 닫음. 초점이 팝업 안이었거나 갈 곳을 잃었으면(바깥 빈 곳을 누름) "도움말" 버튼으로 돌린다.
 * 바깥의 다른 버튼·라디오를 눌러 닫았으면 초점은 그쪽에 둔다.
 */
function close(): void {
  if (!isOpen.value) return
  const a = document.activeElement
  const lost = !a || a === document.body || !!dialog.value?.contains(a)
  releaseHelp(dialogId)
  hide()
  if (lost) trigger.value?.focus()
}

function toggle(): void {
  if (isOpen.value) close()
  else void open()
}

// 다른 팝업이 열려 자리를 가져가면 초점은 새 팝업에 두고 이것만 닫는다
watch(isOpen, (v) => {
  if (!v) hide()
})

onBeforeUnmount(() => {
  releaseHelp(dialogId)
  hide()
})

function onDocumentClick(e: MouseEvent): void {
  const t = e.target as Node | null
  if (t && (dialog.value?.contains(t) || trigger.value?.contains(t))) return
  close()
}

/** 시트의 어두운 막(::backdrop)을 누르면 click 의 target 이 dialog 자신이다. 안쪽은 .help-pop-inner 가 덮는다 */
function onDialogClick(e: MouseEvent): void {
  if (sheet.value && e.target === dialog.value) close()
}

function onResize(): void {
  if (window.matchMedia(SHEET_QUERY).matches !== sheet.value) close()
  else place()
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Tab 은 팝업 안에서만 돈다(닫는 길은 닫기·Esc·바깥 누르기) */
function trapTab(e: KeyboardEvent): void {
  const el = dialog.value
  if (!el) return
  const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.getClientRects().length > 0)
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) {
    e.preventDefault()
    return
  }
  const a = document.activeElement
  if (e.shiftKey && (a === first || a === el)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && a === last) {
    e.preventDefault()
    first.focus()
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    // 이 팝업만 닫는다(바깥의 다른 Esc 처리로 번지지 않게)
    e.preventDefault()
    e.stopPropagation()
    close()
  } else if (e.key === 'Tab') {
    trapTab(e)
  }
}

/**
 * 데스크톱 말풍선 자리: 버튼 위가 먼저(같은 카드의 고르기 버튼을 가리지 않게), 안 들어가면 아래.
 * 위·아래 고정 바가 덮는 곳(html scroll-padding, base.css)을 먼저 피하고, 그래도 안 들어가면 화면 끝까지 쓴다.
 * 어느 쪽도 다 안 들어가면 넓은 쪽에 두고 높이를 줄여 안에서 스크롤한다. 문서 기준 위치라 스크롤해도 버튼에 붙어 있다.
 */
function place(): void {
  const el = dialog.value
  const btn = trigger.value
  if (!el || !btn || sheet.value) return
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const rootStyle = getComputedStyle(document.documentElement)
  const safeTop = Math.max(EDGE, parseFloat(rootStyle.scrollPaddingTop) || 0)
  const safeBottom = vh - Math.max(EDGE, parseFloat(rootStyle.scrollPaddingBottom) || 0)
  const b = btn.getBoundingClientRect()
  const area = (props.boundary ?? btn).getBoundingClientRect()
  const width = Math.min(Math.max(Math.min(area.width, MAX_W), MIN_W), vw - EDGE * 2)
  el.style.width = `${width}px`
  el.style.setProperty('--help-max-h', 'none')
  const h = el.offsetHeight
  const room = { above: b.top - GAP - safeTop, below: safeBottom - b.bottom - GAP }
  const roomAll = { above: b.top - GAP - EDGE, below: vh - EDGE - b.bottom - GAP }
  let side: 'above' | 'below'
  let maxH = h
  if (h <= room.above) side = 'above'
  else if (h <= room.below) side = 'below'
  else if (h <= roomAll.above) side = 'above'
  else if (h <= roomAll.below) side = 'below'
  else {
    side = roomAll.above >= roomAll.below ? 'above' : 'below'
    maxH = Math.max(roomAll[side], 120)
  }
  const used = Math.min(h, maxH)
  const top = side === 'above' ? b.top - GAP - used : b.bottom + GAP
  const left = Math.min(Math.max(area.left, EDGE), vw - EDGE - width)
  const arrow = Math.min(Math.max(b.left + b.width / 2 - left, 16), width - 16)
  el.dataset.side = side
  el.style.top = `${Math.round(top + window.scrollY)}px`
  el.style.left = `${Math.round(left + window.scrollX)}px`
  el.style.setProperty('--help-max-h', used < h ? `${Math.floor(used)}px` : 'none')
  el.style.setProperty('--help-arrow-x', `${Math.round(arrow)}px`)
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="help-btn"
    v-bind="$attrs"
    :aria-label="name"
    aria-haspopup="dialog"
    :aria-expanded="isOpen"
    :aria-controls="dialogId"
    @click="toggle"
  >
    <svg class="help-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M7.6 7.7a2.45 2.45 0 1 1 3.4 2.25c-.6.26-1 .8-1 1.45v.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      <circle cx="10" cy="14.4" r="1" fill="currentColor" />
    </svg>
    <span>{{ HELP }}</span>
  </button>
  <Teleport to="body">
    <dialog
      :id="dialogId"
      ref="dialog"
      class="help-pop"
      :class="{ 'is-sheet': sheet }"
      :aria-labelledby="titleId"
      tabindex="-1"
      @keydown="onKeydown"
      @cancel.prevent="close"
      @click="onDialogClick"
    >
      <span v-if="!sheet" class="help-pop-arrow" aria-hidden="true"></span>
      <div class="help-pop-inner">
        <div class="help-pop-head">
          <!-- 이름 "<title> 도움말"이 되게 두 조각 사이 띄어쓰기를 한 줄 안에 둔다(줄바꿈이 있으면 Vue가 지운다) -->
          <h2 :id="titleId" class="help-pop-title"><span class="help-pop-name">{{ title }}</span> <span class="help-pop-kind">{{ HELP }}</span></h2>
          <button type="button" class="help-pop-close" aria-label="닫기" @click="close">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div class="help-pop-body">
          <slot />
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
/*
 * ── "도움말" 버튼: 글자 링크 모양(물음표 + 글). 데스크톱은 옆 NCS 글 한 줄 높이를 넘지 않게 해 카드 높이를 늘리지 않는다
 * (1440×900 첫 화면 카드 4개 F-03이 몇 px 차이로 갈림). 휴대폰은 44px ──
 */
.help-btn {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.4rem;
  margin-left: -0.4rem;
  padding: 0 0.6rem 0 0.4rem;
  border: 0;
  border-radius: var(--krds-radius-small2);
  background: none;
  font: inherit;
  font-size: var(--krds-pc-font-size-body-xsmall);
  font-weight: 700;
  line-height: 1.4;
  color: var(--krds-light-color-text-primary);
  cursor: pointer;
}

/*
 * 누르는 영역만 위아래로 넓힌다(A3-r1-18). 데스크톱 글자 줄 높이 약 18px → 26px. 카드 높이·NCS 줄 자리는 그대로(HP-05·F-03).
 * 위는 설명 글, 아래는 고르기 칩과 0.8rem 떨어져 있어 다른 컨트롤과 겹치지 않는다
 */
.help-btn {
  position: relative;
}

.help-btn::before {
  content: '';
  position: absolute;
  inset: -0.4rem 0;
}

.help-btn:hover {
  background: var(--krds-light-color-surface-primary-subtler);
}

.help-btn[aria-expanded='true'] {
  background: var(--krds-light-color-surface-primary-subtler);
}

.help-btn:focus-visible {
  outline: 0.3rem solid var(--krds-light-color-border-primary);
  outline-offset: 0.1rem;
}

.help-icon {
  flex: none;
}

/* ── 팝업(기본 <dialog>). 닫힌 dialog 는 UA 의 display:none 을 써야 하므로 display 는 [open] 에만 준다 ── */
.help-pop {
  position: absolute;
  inset: auto;
  z-index: 30;
  max-width: none;
  max-height: var(--help-max-h, none);
  margin: 0;
  padding: 0;
  overflow: visible;
  border: 1px solid var(--krds-light-color-border-gray);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
  color: var(--krds-light-color-text-basic);
  box-shadow: var(--rq-shadow-pop);
}

.help-pop[open] {
  display: flex;
  flex-direction: column;
  animation: help-fade 0.12s ease-out;
}

.help-pop:focus {
  outline: none;
}

.help-pop:focus-visible {
  outline: 0.3rem solid var(--krds-light-color-border-primary);
  outline-offset: 0.2rem;
}

/* 말풍선 꼬리: 위에 뜨면 아래로, 아래에 뜨면 위로 버튼을 가리킨다 */
.help-pop-arrow {
  position: absolute;
  left: calc(var(--help-arrow-x, 2.4rem) - 0.7rem);
  width: 1.4rem;
  height: 1.4rem;
  border: 1px solid var(--krds-light-color-border-gray);
  background: var(--krds-light-color-surface-white);
  transform: rotate(45deg);
}

.help-pop[data-side='above'] .help-pop-arrow {
  bottom: -0.75rem;
  border-top: 0;
  border-left: 0;
}

.help-pop[data-side='below'] .help-pop-arrow {
  top: -0.75rem;
  border-right: 0;
  border-bottom: 0;
}

/* 안쪽이 dialog 를 꽉 채워 바깥 누르기(target = dialog)와 구분된다. 길면 여기서 스크롤(닫기 버튼도 이 안이라 초점이 닿는다) */
.help-pop-inner {
  position: relative;
  min-height: 0;
  overflow-y: auto;
  border-radius: inherit;
  padding: 1.4rem 1.6rem 1.6rem;
}

.help-pop-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.help-pop-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.6rem;
  padding-top: 0.4rem;
  font-size: var(--krds-pc-font-size-heading-xxsmall);
  font-weight: 700;
  line-height: 1.4;
  color: var(--krds-light-color-text-bolder);
}

.help-pop-kind {
  font-size: var(--krds-pc-font-size-body-xsmall);
  font-weight: 500;
  color: var(--krds-light-color-text-subtle);
}

.help-pop-close {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 3.2rem;
  height: 3.2rem;
  margin: -0.4rem -0.8rem 0 0;
  border: 0;
  border-radius: var(--krds-radius-medium2);
  background: none;
  color: var(--krds-light-color-text-subtle);
  cursor: pointer;
}

.help-pop-close:hover {
  background: var(--krds-light-color-surface-gray-subtler);
  color: var(--krds-light-color-text-bolder);
}

.help-pop-close:focus-visible {
  outline: 0.3rem solid var(--krds-light-color-border-primary);
  outline-offset: 0;
}

.help-pop-body {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.4rem;
}

/* ── 휴대폰 아래 시트: 폭 전체, 아래끝 = 화면 아래끝. 위치가 흔들리지 않게 움직임은 투명도만 ── */
.help-pop.is-sheet {
  position: fixed;
  inset: auto 0 0;
  width: 100%;
  max-height: 85dvh;
  overflow: hidden;
  border-width: 1px 0 0;
  border-radius: var(--krds-radius-xlarge1) var(--krds-radius-xlarge1) 0 0;
}

.help-pop.is-sheet::backdrop {
  background: var(--rq-scrim);
  animation: help-fade 0.15s ease-out;
}

.help-pop.is-sheet .help-pop-inner {
  padding: 1.2rem 1.6rem 2.4rem;
}

/* 엄지로 닫을 수 있게 닫기 44px(DESIGN-REVIEW D18) */
.help-pop.is-sheet .help-pop-close {
  width: var(--rq-touch);
  height: var(--rq-touch);
  margin: -0.4rem -0.8rem 0 0;
}

.help-pop.is-sheet .help-pop-title {
  padding-top: 0.8rem;
}

@media (max-width: 767px) {
  .help-btn {
    min-height: var(--rq-touch);
  }
}

@keyframes help-fade {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .help-pop[open],
  .help-pop.is-sheet::backdrop {
    animation: none;
  }
}
</style>
