<script setup lang="ts">
/**
 * 단계 머리띠(PLAN-4 T6, D-394). ③ 질문 화면의 단계 표시줄 위에서 지금 준비하는 면접과 이 단계에서 묻는 질문을 한 줄로 알린다.
 * ①②에는 두지 않는다(첫 화면 기준 V-06·F-03, 세진 11-02). 띠 바탕은 단계마다 다르다(1차 보라 · 최종 청록, tokens.css).
 * 첫 화면에서 질문이 덜 내려가도록 띠는 얇게 둔다. 인쇄하지 않는다. id는 휴대폰에서 ③으로 옮길 때 스크롤할 자리(router.ts)
 */
import type { Mode } from '@shared/contract'
import { STAGE_BANDS } from './steps'

defineProps<{ mode: Mode }>()
</script>

<template>
  <p id="prep-stage-band" class="stage-band" :data-band="mode" data-print="hide">
    <svg class="band-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <!-- 1차: 묻는 말풍선 · 최종: 확인하는 문서(근로 조건) -->
      <template v-if="mode === 'first'">
        <path
          d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
        <path d="M9.9 8.7a2.2 2.2 0 1 1 3.1 2c-.6.3-1 .8-1 1.4v.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="12" cy="14.7" r="1" fill="currentColor" />
      </template>
      <template v-else>
        <path
          d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
        <path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M8.5 14.2l2.4 2.4 4.6-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </template>
    </svg>
    <span class="band-text">
      <strong class="band-name">{{ STAGE_BANDS[mode].name }}</strong>
      <span class="band-dash"> — </span>
      <span class="band-purpose">{{ STAGE_BANDS[mode].purpose }}</span>
    </span>
  </p>
</template>

<style scoped>
/* 움직임 없음(단계를 바꾸면 색·글이 바로 바뀐다). 머리띠 바탕 대비는 이름 8.5:1 · 목적 14:1 이상(D-387) */
.stage-band {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 1.2rem;
  border-left: 0.3rem solid var(--rq-band-line);
  border-radius: var(--krds-radius-medium2);
  background: var(--rq-band-bg);
  font-size: var(--krds-pc-font-size-body-small);
  line-height: 1.5;
  color: var(--krds-light-color-text-basic);
}

.band-icon {
  flex: none;
  width: 1.8rem;
  height: 1.8rem;
  color: var(--rq-band-ink);
}

.band-text {
  min-width: 0;
}

.band-name {
  font-weight: 700;
  color: var(--rq-band-ink);
}

.band-dash {
  color: var(--krds-light-color-text-subtle);
}

/* 휴대폰: 이름·목적을 한 문단으로 흘려 높이를 줄인다. 긴 글은 줄을 바꿔 가로로 넘치지 않는다 */
@media (max-width: 767px) {
  .stage-band {
    padding: 0.4rem 1rem;
  }

  .band-icon {
    width: 1.6rem;
    height: 1.6rem;
  }
}

/* 고대비(forced-colors)에서는 바탕색이 사라지므로 테두리로 띠를 보인다 */
@media (forced-colors: active) {
  .stage-band {
    border: 1px solid CanvasText;
    border-left: 0.3rem solid CanvasText;
  }
}
</style>
