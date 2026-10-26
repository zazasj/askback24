<script setup lang="ts">
/**
 * 만드는 중: 세 줄이 차례로 켜지고 아래에 질문 카드 모양 빈 틀. 세 줄은 처음부터 다 보이고 상태만 바뀐다.
 * 가짜 응답 모드 태그는 이 화면을 품은 ③ 제목 옆에 이미 있어 여기에는 달지 않는다(DA-05).
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ count?: number; stages?: readonly string[] }>(), {
  count: 5,
  stages: () => ['공고 근거 확인', '질문 순서 정하기', 'AI가 문장 쓰는 중'],
})
const STAGE_MS = 450

const active = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    if (active.value < props.stages.length - 1) active.value++
    else if (timer) clearInterval(timer)
  }, STAGE_MS)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const stateOf = (i: number) => (i < active.value ? 'done' : i === active.value ? 'active' : 'wait')
</script>

<template>
  <div class="generating" aria-busy="true">
    <div class="stages" role="status" aria-live="polite">
      <div class="stages-head">
        <p class="stages-title">질문을 만들고 있어요</p>
      </div>
      <ol class="stage-list">
        <li v-for="(s, i) in props.stages" :key="s" class="stage" :data-state="stateOf(i)">
          <span class="dot" aria-hidden="true"></span>
          <span class="stage-text">{{ s }}</span>
          <span class="sr-only">{{ stateOf(i) === 'done' ? '(완료)' : stateOf(i) === 'active' ? '(진행 중)' : '' }}</span>
        </li>
      </ol>
    </div>
    <div class="skeletons" aria-hidden="true">
      <div v-for="n in props.count" :key="n" class="skeleton">
        <span class="bar bar-chip"></span>
        <span class="bar bar-line"></span>
        <span class="bar bar-line short"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.generating {
  display: grid;
  gap: 1.6rem;
}

.stages {
  display: grid;
  gap: 1.2rem;
  padding: 2rem 2.4rem;
  border: 1px solid var(--rq-accent-border);
  border-radius: var(--krds-radius-large1);
  background: var(--rq-accent-subtler);
}

.stages-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1.2rem;
}

.stages-title {
  font-size: var(--krds-pc-font-size-label-large);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.stage-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 2.4rem;
}

.stage {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  font-size: var(--krds-pc-font-size-body-medium);
  color: var(--krds-light-color-text-subtle);
}

.dot {
  flex: none;
  width: 1.2rem;
  height: 1.2rem;
  border: 2px solid var(--krds-light-color-border-gray);
  border-radius: 50%;
  background: var(--krds-light-color-surface-white);
}

.stage[data-state='active'] {
  font-weight: 700;
  color: var(--rq-accent-strong);
}

.stage[data-state='active'] .dot {
  border-color: var(--rq-accent);
  animation: pulse 0.9s ease-in-out infinite alternate;
}

.stage[data-state='done'] {
  color: var(--krds-light-color-text-basic);
}

.stage[data-state='done'] .dot {
  border-color: var(--rq-accent);
  background: var(--rq-accent);
}

.skeletons {
  display: grid;
  gap: 1.2rem;
}

.skeleton {
  display: grid;
  gap: 1rem;
  padding: 1.8rem 2rem;
  border: 1px solid var(--krds-light-color-border-gray-light);
  border-radius: var(--krds-radius-large1);
  background: var(--krds-light-color-surface-white);
}

.bar {
  display: block;
  height: 1.4rem;
  border-radius: var(--krds-radius-small1);
  background: var(--krds-light-color-surface-gray-subtle);
  animation: fade 1.2s ease-in-out infinite alternate;
}

.bar-chip {
  width: 9rem;
  height: 2.4rem;
  border-radius: var(--krds-radius-max);
}

.bar-line {
  width: 92%;
  height: 1.8rem;
}

.bar-line.short {
  width: 58%;
}

@keyframes pulse {
  from {
    transform: scale(0.85);
  }
  to {
    transform: scale(1.1);
  }
}

@keyframes fade {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stage[data-state='active'] .dot,
  .bar {
    animation: none;
  }
}

/* 고대비(forced-colors)에서 진행·완료 단계 점이 구분되게 시스템 강조색(A3-r2-06) */
@media (forced-colors: active) {
  .stage[data-state='active'] .dot {
    border-color: Highlight;
  }

  .stage[data-state='done'] .dot {
    border-color: Highlight;
    background-color: Highlight;
  }
}

@media (max-width: 767px) {
  .stages {
    padding: 1.6rem;
  }

  .stage-list {
    flex-direction: column;
  }
}
</style>
