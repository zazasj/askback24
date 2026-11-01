<script setup lang="ts">
// 운영 기관 식별자(identifier) 자리. 공식 기관 표시는 쓰지 않고 시연 사이트임을 다시 밝힌다.
// 둘째 줄은 저장만 말하면 "밖으로 나가지 않는다"로 읽혀, 실제 모드는 AI로 보낸다는 것도 적는다(lib/modeCopy)
import { API_MODE } from '@/api/client'
import { modeCopy } from '@/lib/modeCopy'

const privacy = modeCopy(API_MODE === 'mock').footerPrivacy
</script>

<template>
  <footer class="gov-footer">
    <div class="inner">
      <p>2026 고용24 AI 해커톤 시연용으로 만든 모의 화면이에요. 회사·공고·인물 정보는 모두 예시예요.</p>
      <p class="muted">{{ privacy }}</p>
    </div>
  </footer>
</template>

<style scoped>
.gov-footer {
  margin-top: 8rem;
  border-top: 1px solid var(--krds-light-color-divider-gray-light);
  background: var(--krds-light-color-surface-gray-subtler);
}

.inner {
  display: grid;
  gap: 0.4rem;
  max-width: var(--rq-container);
  margin: 0 auto;
  padding: 3.2rem var(--rq-gutter) 9.6rem;
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}
</style>
