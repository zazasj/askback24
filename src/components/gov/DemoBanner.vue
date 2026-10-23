<script setup lang="ts">
// 사칭 방지 띠. 모든 화면 맨 위에 둔다(G-01). 공식 누리집 표시(masthead)를 대신하는 자리다.
// 시연 도구도 이 띠 오른쪽 끝에 둔다(떠 있는 버튼이 본문을 가리지 않게, DR-r1-01).
// "모의 데이터 · 회사명과 공고는 예시"도 이 띠에 둔다(CLAUDE.md 모의 표시 유지).
import DemoTools from '@/components/ui/DemoTools.vue'
</script>

<template>
  <div class="demo-banner">
    <div class="inner">
      <p class="message" role="note" aria-label="시연 안내">
        <span class="chip" aria-hidden="true">시연</span>
        <span>
          <strong>해커톤 시연용 모의 서비스</strong> · <span class="wide-only">고용24 탑재를 가정한 화면이며 </span
          ><strong>실제 고용24가 아닙니다</strong> <span class="data-note">(모의 데이터 · 회사명과 공고는 예시)</span>
        </span>
      </p>
      <DemoTools />
    </div>
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
  justify-content: space-between;
  gap: 1.2rem;
  max-width: var(--rq-container);
  margin: 0 auto;
  padding: 0.6rem var(--rq-gutter);
}

.message {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
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

/* 헤더 위 파란 띠에 있던 모의 데이터 표시를 옮겨 왔다(DR-r1-04) */
.data-note {
  color: var(--krds-color-light-gray-20);
}

/* 휴대폰은 띠가 여러 줄로 커지지 않게 꼭 필요한 두 문구만 남긴다 */
@media (max-width: 767px) {
  .wide-only {
    display: none;
  }
}
</style>
