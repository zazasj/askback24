<script setup lang="ts">
// S3 채용정보 상세 — M1은 틀(채용제목·모의 공고 배지·문서 제목)만. 모집요강·근무조건·기업정보·입사지원은 M4.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getPosting } from '@shared/catalog'
import NotFoundContent from '@/components/ui/NotFoundContent.vue'
import { usePageTitle } from '@/lib/title'

const route = useRoute()
const posting = computed(() => getPosting(String(route.params.wantedAuthNo ?? '')))
usePageTitle(() => posting.value?.wantedTitle)
</script>

<template>
  <NotFoundContent v-if="!posting" detail="이 공고를 찾을 수 없어요." />
  <div v-else class="s3-detail">
    <p class="corp">{{ posting.corpNm }}</p>
    <h1 class="page-title">
      {{ posting.wantedTitle }}
      <span class="badge">모의 공고</span>
    </h1>
    <p class="pending-note">공고 상세 내용은 다음 작업에서 채워요.</p>
  </div>
</template>

<style scoped>
.corp {
  margin-bottom: 0.4rem;
  font-weight: 700;
  color: var(--krds-light-color-text-subtle);
}

.page-title {
  margin-bottom: 2.4rem;
}
</style>
