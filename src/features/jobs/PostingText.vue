<script setup lang="ts">
/**
 * 공고 원문 글 블록(직무내용 같은 긴 글). 원문 줄을 한 줄씩 그리고 소제목·목록 기호는 글자 그대로 둔다.
 * 형광펜은 부르는 쪽이 #mark 슬롯으로 그린다(S4 ①). S3 상세는 text 만 넘겨 칠하지 않는다.
 */
import { computed } from 'vue'
import { plainSegments, postingLines, type PostingLine, type TextSegment } from './postingText'

const props = defineProps<{
  /** 형광펜 조각(splitByQuotes). 없으면 text 를 칠하지 않고 그린다 */
  segments?: readonly TextSegment[]
  text?: string
}>()

defineSlots<{
  mark(props: { seg: TextSegment; text: string }): unknown
  /** 줄 바로 아래 자리(S4 ① 형광펜 설명을 그 줄 밑에 펼친다) */
  after(props: { line: PostingLine }): unknown
}>()

const lines = computed(() => postingLines(props.segments ?? plainSegments(props.text ?? '')))
</script>

<template>
  <div class="posting-text">
    <template v-for="line in lines" :key="line.index">
      <p class="pt-line" :class="[`is-${line.kind}`, { 'is-sub': line.sub, 'has-gap': line.gap }]"
        ><template v-for="(piece, i) in line.pieces" :key="i"
          ><slot v-if="piece.seg.cardIds.length" name="mark" :seg="piece.seg" :text="piece.text">{{ piece.text }}</slot
          ><template v-else>{{ piece.text }}</template></template
        ></p
      >
      <slot name="after" :line="line" />
    </template>
  </div>
</template>

<style scoped>
.posting-text {
  min-width: 0;
}

.pt-line + .pt-line.has-gap {
  margin-top: 1.2rem;
}

.pt-line.is-head {
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

/* 목록·참고(※) 줄은 기호 뒤로 둘째 줄이 맞게 내어쓰기 */
.pt-line.is-item,
.pt-line.is-note {
  padding-left: 1.3em;
  text-indent: -1.3em;
}

.pt-line.is-sub {
  margin-left: 1em;
}
</style>
