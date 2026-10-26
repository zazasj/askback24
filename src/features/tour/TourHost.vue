<script setup lang="ts">
/**
 * 앱 전체에 하나 있는 안내 틀(스포트라이트, TR-01~09). 화면이 useScreenTour 로 올린 단계를 차례로 비춘다. 새 의존성 없이 직접 만든다.
 * - 비춤: 화면 전체 어두운 막 + 대상 둘레(구멍)만 밝게. 막은 구멍의 그림자로 그린다. 화면 바뀜·스크롤·크기 바뀜마다 다시 잰다.
 * - 설명 상자: 기본 <dialog>를 showModal()로 — 뒤 화면이 눌리지 않고 초점이 들어가지 않는다. Tab 은 상자 안에서만, Esc = 건너뛰기.
 * - 휴대폰(767px 이하)은 화면 아래 시트, 구멍은 시트 위에만. 대상이 그 폭에서 숨어 있으면 대상 없는 상자.
 * - 시연 도구 메뉴·도움말 팝업·① 로딩·형광펜 칠하기가 끝나고 화면이 자리 잡은 뒤 시작한다(TR-08).
 */
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { helpPopupOpen } from '@/components/ui/helpPopupState'
import { useDemoToolsStore } from '@/stores/demoTools'
import { usePostingIntroStore } from '@/stores/postingIntro'
import { useToastStore } from '@/stores/toast'
import { TOUR_OFF_TOAST, testTourOff, useTourStore, type ScreenTour, type TourKey, type TourStep } from '@/stores/tour'
import { boxWidth, placeDesktop, placeSheet, scrollDelta, sheetScrollDelta, type Rect, type View } from './tourLayout'

const tour = useTourStore()
const tools = useDemoToolsStore()
const intro = usePostingIntroStore()
const toast = useToastStore()
const route = useRoute()

/** 화면이 바뀐 뒤 자리 잡을 시간(라우터 스크롤·초점 이동이 끝난 다음) */
const SETTLE_MS = 450
/** 다른 대화상자가 떠 있으면 다시 볼 간격 */
const RETRY_MS = 300
/** 구멍이 다음 대상으로 옮겨 가는 시간(움직임 줄이기면 없음) */
const MOVE_MS = 200
const SHEET_QUERY = '(max-width: 767px)'

interface Active {
  key: TourKey
  screenId: number
  steps: TourStep[]
  /** 안내 전 초점 자리(닫히면 돌려놓는다) */
  before: HTMLElement | null
  titleId?: string
}

const active = shallowRef<Active | null>(null)
const index = ref(0)
const hole = ref<Rect | null>(null)
const sheet = ref(false)
const moving = ref(false)
/** 단계가 바뀔 때 화면낭독기에 읽어 줄 글(초점은 누른 버튼에 그대로 둔다) */
const announce = ref('')

const uid = useId()
const titleId = `tour-${uid}-title`
const textId = `tour-${uid}-text`
const box = useTemplateRef<HTMLDialogElement>('box')
const mainBtn = useTemplateRef<HTMLButtonElement>('mainBtn')

const step = computed(() => active.value?.steps[index.value])
const total = computed(() => active.value?.steps.length ?? 0)
const isLast = computed(() => index.value >= total.value - 1)
/** S1 서비스 안내는 "시작하기", 화면 안내는 "닫기" */
const doneLabel = computed(() => (active.value?.key === 's1' ? '시작하기' : '닫기'))

const holeStyle = computed(() => {
  const h = hole.value
  return h ? { top: `${h.top}px`, left: `${h.left}px`, width: `${h.right - h.left}px`, height: `${h.bottom - h.top}px` } : undefined
})

const reduceMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── 언제 띄우나 ──────────────────────────────────────
/** 다른 것이 떠 있거나 움직이는 중(TR-08). ① 형광펜 말풍선은 dialog 가 아니라 따로 본다(A3-r1-14) */
const blocked = computed(() => tools.open || helpPopupOpen.value || intro.busy || intro.bubble)

let timer: ReturnType<typeof setTimeout> | undefined

function schedule(): void {
  clearTimeout(timer)
  timer = undefined
  if (active.value || !tour.due || blocked.value) return
  timer = setTimeout(tryStart, SETTLE_MS)
}

function otherDialogOpen(): boolean {
  return Array.from(document.querySelectorAll('dialog[open]')).some((d) => d !== box.value)
}

function tryStart(): void {
  timer = undefined
  const s = tour.screen
  const key = tour.due
  if (active.value || !s || key !== s.key || blocked.value) return
  // 시험 스위치는 저절로 뜨는 것만 막는다(다시 보기는 사람이 누른 것)
  if (tour.replay !== key && testTourOff()) return
  if (otherDialogOpen()) {
    timer = setTimeout(tryStart, RETRY_MS)
    return
  }
  void start(s)
}

watch([() => tour.due, blocked, () => route.fullPath, () => tour.screen?.id], schedule, { immediate: true })

// 주소 ?tour=off 는 "안내 끄기"와 같다(이 브라우저에 저장, TR-05). ?tour=on 은 다시 켠다
watch(
  () => route.query.tour,
  (v) => {
    if (v === 'off') tour.setOff(true)
    else if (v === 'on') tour.setOff(false)
  },
  { immediate: true },
)

// 안내 중에 화면이 바뀌면(브라우저 뒤로 가기 등) 본 것으로 두지 않고 닫는다
watch(
  () => tour.screen?.id,
  (id) => {
    const a = active.value
    if (a && id !== a.screenId) close(false)
  },
)

// ── 열고 닫기 ────────────────────────────────────────
async function start(s: ScreenTour): Promise<void> {
  const steps = s.steps()
  if (!steps.length) return
  const before = document.activeElement
  active.value = {
    key: s.key,
    screenId: s.id,
    steps,
    before: before instanceof HTMLElement && before !== document.body ? before : null,
    titleId: s.titleId,
  }
  index.value = 0
  announce.value = ''
  sheet.value = window.matchMedia(SHEET_QUERY).matches
  tour.started(s.key)
  await nextTick()
  const el = box.value
  if (!el || !active.value) return
  if (!el.open) el.showModal()
  mainBtn.value?.focus({ preventScroll: true })
  listen(true)
  reveal()
}

/** 끝까지 봤거나 "건너뛰기"·Esc: 이 화면은 다시 띄우지 않는다(TR-03) */
function finish(): void {
  const a = active.value
  if (!a) return
  tour.markSeen(a.key)
  close(true)
}

function close(restore: boolean): void {
  const a = active.value
  if (!a) return
  listen(false)
  active.value = null
  hole.value = null
  tour.ended()
  if (box.value?.open) box.value.close()
  if (restore) restoreFocus(a)
  // 화면이 바뀌어 닫았으면 새 화면 안내가 기다리고 있을 수 있다
  schedule()
}

/** 브라우저가 대화상자를 닫았으면(Esc 를 거듭 누름 등) 건너뛰기로 본다 */
function onNativeClose(): void {
  if (active.value) finish()
}

function focusable(el: HTMLElement): boolean {
  return el.isConnected && el.getClientRects().length > 0 && !el.closest('[inert]') && !(el as HTMLButtonElement).disabled
}

/** 안내 전 자리로. 그 자리가 사라졌으면(누른 버튼이 없어짐·처음 들어옴) 화면 제목으로(TR-06) */
function restoreFocus(a: Active): void {
  const b = a.before
  if (b && focusable(b)) {
    b.focus({ preventScroll: true })
    if (document.activeElement === b) return
  }
  const title = (a.titleId ? document.getElementById(a.titleId) : null) ?? document.querySelector<HTMLElement>('#main-content h1')
  if (!title) return
  if (!title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1')
  title.focus({ preventScroll: true })
}

async function go(i: number): Promise<void> {
  if (!active.value || i < 0 || i >= total.value) return
  index.value = i
  const s = step.value
  announce.value = s ? `${total.value}단계 중 ${i + 1}단계. ${s.title}. ${s.text}` : ''
  await nextTick()
  // "이전"이 사라지면(1단계로 돌아옴) 초점을 "다음"으로
  const a = document.activeElement
  if (!a || a === document.body || !box.value?.contains(a)) mainBtn.value?.focus({ preventScroll: true })
  reveal()
}

function onMain(): void {
  if (isLast.value) finish()
  else void go(index.value + 1)
}

/**
 * "다른 화면 안내도 그만 보기" = 시연 도구 "안내 끄기"(A3-r1-10). 끄는 길이 시연 도구 안에만 있어 상자 안에서 찾을 수 없었다.
 * 지금 안내는 본 것으로 닫는다. "시연 초기화"도 끄기를 풀지 않는다(H3-r1-03)
 */
function stopAll(): void {
  tour.setOff(true)
  finish()
  toast.show(TOUR_OFF_TOAST)
}

// ── 키보드 ───────────────────────────────────────────
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

function trapTab(e: KeyboardEvent): void {
  const el = box.value
  if (!el) return
  const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.getClientRects().length > 0)
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) {
    e.preventDefault()
    return
  }
  const a = document.activeElement
  const inside = !!a && el.contains(a) && a !== el
  if (e.shiftKey && (a === first || !inside)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (a === last || !inside)) {
    e.preventDefault()
    first.focus()
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    // 안내만 닫는다(시연 도구·형광펜 말풍선의 Esc 처리로 번지지 않게)
    e.preventDefault()
    e.stopPropagation()
    finish()
  } else if (e.key === 'Tab') {
    trapTab(e)
  }
}

// ── 자리 재기 ────────────────────────────────────────
function view(): View {
  return { vw: document.documentElement.clientWidth, vh: window.innerHeight }
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
}

function shown(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 1 && r.height > 1 && el.checkVisibility({ visibilityProperty: true, opacityProperty: true })
}

/** 단계의 대상: 이름 순서대로 그 폭에서 보이는 첫 요소(데스크톱 표·휴대폰 카드처럼 둘 다 있는 것은 보이는 쪽) */
function findTarget(names: readonly string[] | undefined): HTMLElement | null {
  for (const name of names ?? []) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-tour~="${name}"]`))) if (shown(el)) return el
  }
  return null
}

/** 화면에 붙어 스크롤해도 자리가 그대로인 대상(아래 고정 바 안 버튼 등) */
function isPinned(el: Element): boolean {
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n)
    if (cs.position === 'fixed') return true
    if (cs.position === 'sticky' && cs.bottom !== 'auto') return true
  }
  return false
}

/** 화면 아래 고정 바가 덮는 높이(base.css 의 scroll-padding-bottom 과 같은 값) */
function bottomCover(): number {
  return parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0
}

let moveTimer: ReturnType<typeof setTimeout> | undefined

/** "다음"·"이전": 대상을 화면 안(상자와 함께 들어가는 자리)으로 옮기고 비춘다. 스크롤은 바로(측정이 흔들리지 않게) */
function reveal(): void {
  const el = box.value
  if (!el || !active.value) return
  if (!reduceMotion()) {
    moving.value = true
    clearTimeout(moveTimer)
    moveTimer = setTimeout(() => (moving.value = false), MOVE_MS + 50)
  }
  const t = findTarget(step.value?.target)
  tour.spot = t
  if (t && !isPinned(t)) {
    t.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    const v = view()
    let delta: number
    if (sheet.value) {
      delta = sheetScrollDelta(rectOf(t), v, el.offsetHeight)
    } else {
      const bw = boxWidth(v.vw)
      el.style.width = `${bw}px`
      delta = scrollDelta(rectOf(t), v, bw, el.offsetHeight, bottomCover())
    }
    if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: 'instant' })
  }
  place()
}

/** 지금 자리에서 구멍과 상자를 놓는다(스크롤하지 않음) */
function place(): void {
  const el = box.value
  if (!el || !active.value) return
  const mode = window.matchMedia(SHEET_QUERY).matches
  if (mode !== sheet.value) {
    sheet.value = mode
    void nextTick(place)
    return
  }
  const v = view()
  const t = findTarget(step.value?.target)
  const r = t ? rectOf(t) : null
  if (sheet.value) {
    for (const p of ['top', 'left', 'width']) el.style.removeProperty(p)
    hole.value = placeSheet(r, v, el.offsetHeight)
    return
  }
  const bw = boxWidth(v.vw)
  el.style.width = `${bw}px`
  const p = placeDesktop(r, v, bw, el.offsetHeight)
  hole.value = p.hole
  el.style.top = `${p.box.top}px`
  el.style.left = `${p.box.left}px`
}

let raf = 0
function schedulePlace(): void {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    place()
  })
}

const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedulePlace)

function listen(on: boolean): void {
  if (on) {
    window.addEventListener('scroll', schedulePlace, { capture: true, passive: true })
    window.addEventListener('resize', schedulePlace)
    resizeObserver?.observe(document.body)
    if (box.value) resizeObserver?.observe(box.value)
  } else {
    window.removeEventListener('scroll', schedulePlace, { capture: true })
    window.removeEventListener('resize', schedulePlace)
    resizeObserver?.disconnect()
    cancelAnimationFrame(raf)
    raf = 0
  }
}

onBeforeUnmount(() => {
  close(false)
  clearTimeout(timer)
  clearTimeout(moveTimer)
})
</script>

<template>
  <Teleport to="body">
    <!-- 어두운 막과 구멍(꾸밈이라 화면낭독기에서 뺀다). 누르기는 모달 상자가 막는다 -->
    <div v-if="active" class="tour-layer" :class="{ 'is-full': !hole }" aria-hidden="true">
      <div v-if="hole" class="tour-hole" :class="{ 'is-moving': moving }" :style="holeStyle"></div>
    </div>
    <dialog
      ref="box"
      class="tour-box"
      :class="{ 'is-sheet': sheet }"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="textId"
      @keydown="onKeydown"
      @cancel.prevent="finish"
      @close="onNativeClose"
    >
      <div v-if="step" class="tour-inner">
        <p class="tour-count">이용 안내 <span class="tour-n">{{ index + 1 }}/{{ total }}</span></p>
        <h2 :id="titleId" class="tour-title">{{ step.title }}</h2>
        <p :id="textId" class="tour-text">{{ step.text }}</p>
        <p class="sr-only" aria-live="polite">{{ announce }}</p>
        <div class="tour-actions">
          <button v-if="!isLast" type="button" class="tour-skip" @click="finish">건너뛰기</button>
          <div class="tour-nav">
            <button v-if="index > 0" type="button" class="btn btn-tertiary" @click="go(index - 1)">이전</button>
            <button ref="mainBtn" type="button" class="btn btn-primary" @click="onMain">{{ isLast ? doneLabel : '다음' }}</button>
          </div>
        </div>
        <button type="button" class="tour-off" @click="stopAll">다른 화면 안내도 그만 보기</button>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
/*
 * ── 어두운 막 + 구멍: 구멍의 바깥 그림자가 화면 전체를 덮는다. 구멍 안쪽 흰 테두리로 비춘 곳의 끝을 보인다.
 *    구멍 안은 아주 옅은 막(--rq-spot-veil)만 — 대상은 거의 그대로 밝고, 가장 밝은 것은 테두리 한 덩어리다 ──
 */
.tour-layer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  pointer-events: none;
}

.tour-layer.is-full {
  background: var(--rq-scrim);
}

.tour-hole {
  position: absolute;
  border-radius: var(--krds-radius-medium2);
  background: var(--rq-spot-veil);
  box-shadow:
    inset 0 0 0 0.2rem var(--rq-spot-ring),
    0 0 0 200vmax var(--rq-scrim);
}

.tour-hole.is-moving {
  transition:
    top 0.2s ease-out,
    left 0.2s ease-out,
    width 0.2s ease-out,
    height 0.2s ease-out;
}

/* ── 설명 상자(기본 <dialog>, 모달). 자리는 place()가 top·left 로 준다. 닫힌 dialog 는 UA 의 display:none 그대로 ── */
.tour-box {
  position: fixed;
  inset: auto;
  top: 0;
  left: 0;
  width: 38rem;
  max-width: none;
  max-height: calc(100dvh - 3.2rem);
  margin: 0;
  padding: 0;
  overflow: auto;
  border: 1px solid var(--krds-light-color-border-gray);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
  color: var(--krds-light-color-text-basic);
  box-shadow: var(--rq-shadow-pop);
}

/* 막은 위 .tour-layer 가 그린다(구멍을 내야 해서) */
.tour-box::backdrop {
  background: transparent;
}

.tour-box[open] {
  animation: tour-in 0.15s ease-out;
}

.tour-box:focus {
  outline: none;
}

.tour-inner {
  display: grid;
  gap: 0.6rem;
  padding: 1.6rem 2rem;
}

.tour-count {
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 700;
  color: var(--krds-light-color-text-subtle);
}

.tour-n {
  margin-left: 0.4rem;
  color: var(--krds-light-color-text-primary);
}

.tour-title {
  font-size: var(--krds-pc-font-size-heading-xsmall);
  font-weight: 700;
  line-height: 1.4;
  color: var(--krds-light-color-text-bolder);
}

.tour-text {
  font-size: var(--krds-pc-font-size-body-small);
  line-height: 1.6;
  color: var(--krds-light-color-text-basic);
}

.tour-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-top: 0.6rem;
}

.tour-nav {
  display: flex;
  gap: 0.8rem;
  margin-left: auto;
}

.tour-skip {
  min-height: 4rem;
  padding: 0 0.4rem;
  border: 0;
  border-radius: var(--krds-radius-small2);
  background: none;
  font-size: var(--krds-pc-font-size-label-small);
  font-weight: 500;
  color: var(--krds-light-color-text-subtle);
  text-decoration: underline;
  text-underline-offset: 0.3rem;
}

.tour-skip:hover {
  color: var(--krds-light-color-text-basic);
}

/* "건너뛰기"보다 한 단계 작은 글자 버튼(이 화면만이 아니라 모든 안내를 끈다). 누르는 높이는 24px 이상 */
.tour-off {
  justify-self: start;
  min-height: 2.8rem;
  padding: 0 0.4rem;
  margin-left: -0.4rem;
  border: 0;
  border-radius: var(--krds-radius-small2);
  background: none;
  font-size: var(--krds-pc-font-size-label-xsmall);
  font-weight: 500;
  color: var(--krds-light-color-text-subtle);
  text-decoration: underline;
  text-underline-offset: 0.3rem;
}

.tour-off:hover {
  color: var(--krds-light-color-text-basic);
}

/* ── 휴대폰: 화면 아래 시트(폭 전체, 아래끝 = 화면 아래끝). 엄지 닿는 버튼 44px ── */
.tour-box.is-sheet {
  inset: auto 0 0;
  width: 100%;
  max-height: 70dvh;
  border-width: 1px 0 0;
  border-radius: var(--krds-radius-xlarge1) var(--krds-radius-xlarge1) 0 0;
}

.tour-box.is-sheet .tour-inner {
  padding: 1.6rem 1.6rem calc(2rem + env(safe-area-inset-bottom, 0px));
}

.tour-box.is-sheet .tour-skip,
.tour-box.is-sheet .tour-off {
  min-height: var(--rq-touch);
}

@keyframes tour-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tour-box[open] {
    animation: none;
  }

  .tour-hole.is-moving {
    transition: none;
  }
}

/* 고대비(forced-colors)에서는 box-shadow 가 없어져 어디를 비추는지 사라진다 → 시스템 강조색 테두리(A3-r2-06) */
@media (forced-colors: active) {
  .tour-hole {
    outline: 0.3rem solid Highlight;
    outline-offset: -0.3rem;
  }
}

@media print {
  .tour-layer,
  .tour-box {
    display: none !important;
  }
}
</style>
