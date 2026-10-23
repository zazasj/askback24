<script setup lang="ts">
// 사칭 방지 띠. 모든 화면 맨 위에 둔다(G-01). 공식 누리집 표시(masthead)를 대신하는 자리다.
</script>

<template>
  <div class="demo-banner" role="note" aria-label="시연 안내">
    <p class="inner">
      <span class="chip" aria-hidden="true">시연</span>
      <span><strong>해커톤 시연용 모의 서비스</strong> · 고용24 탑재를 가정한 화면이며 <strong>실제 고용24가 아닙니다</strong></span>
    </p>
  </div>
</template>

<style scoped>
.demo-banner {
  background: var(--krds-color-light-gray-80);
  color: var(--krds-color-light-gray-0);
}

.inner {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  max-width: var(--rq-container);
  margin: 0 auto;
  padding: 0.7rem var(--rq-gutter);
  font-size: var(--krds-pc-font-size-body-xsmall);
  line-height: 1.5;
}

.chip {
  flex: none;
  padding: 0.1rem 0.6rem;
  border: 1px solid var(--krds-color-light-gray-30);
  border-radius: var(--krds-radius-small1);
  font-size: 1.2rem;
  font-weight: 700;
}

strong {
  font-weight: 700;
}
</style>
