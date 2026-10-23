<script setup lang="ts">
/**
 * S3 "입사지원" 대화상자. 기본 <dialog>(showModal)로 띄워 초점 가두기·Esc·배경 비활성을 브라우저에 맡긴다.
 * 모양은 KRDS modal(머리 · 내용 · 버튼 줄 · 닫기)을 토큰으로 다시 짰다.
 */
import { onMounted, useTemplateRef, watch } from 'vue'
import { PERSONA } from '@/demoData'

const props = defineProps<{ open: boolean; corpNm: string; wantedTitle: string }>()
const emit = defineEmits<{ cancel: []; submit: [] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')

function sync(open: boolean): void {
  const el = dialog.value
  if (!el) return
  if (open && !el.open) el.showModal()
  if (!open && el.open) el.close()
}

watch(() => props.open, sync, { flush: 'post' })
onMounted(() => sync(props.open))

// Esc 로 브라우저가 닫은 경우: 부모 상태도 닫힘으로 맞춘다
function onClose(): void {
  if (props.open) emit('cancel')
}

// 배경(대화상자 바깥 여백)을 누르면 닫는다. 안쪽 상자는 대화상자 전체를 덮어 target 이 다르다
function onClick(e: MouseEvent): void {
  if (e.target === dialog.value) emit('cancel')
}
</script>

<template>
  <dialog ref="dialog" class="apply-dialog" aria-labelledby="apply-title" aria-describedby="apply-desc" @close="onClose" @click="onClick">
    <div class="modal">
      <div class="modal-header">
        <h2 id="apply-title" class="modal-title">입사지원</h2>
      </div>
      <div class="modal-body">
        <p id="apply-desc" class="lead">아래 공고에 이 이력서로 지원해요.</p>
        <dl class="apply-info">
          <div class="info-row">
            <dt>지원할 공고</dt>
            <dd>
              <strong class="corp">{{ corpNm }}</strong>
              <span>{{ wantedTitle }}</span>
            </dd>
          </div>
          <div class="info-row">
            <dt>지원할 이력서</dt>
            <dd class="resume">
              <span class="resume-name">{{ PERSONA.name }} 이력서</span>
              <span class="resume-meta">희망직종 {{ PERSONA.hope.job }} · {{ PERSONA.hope.career }}</span>
            </dd>
          </div>
        </dl>
        <p class="note">시연이라 실제 회사에는 지원되지 않아요. 지원하면 알선/입사지원 내역 맨 위에 한 줄이 늘어요.</p>
      </div>
      <div class="modal-btn">
        <button type="button" class="btn btn-tertiary" @click="emit('cancel')">취소</button>
        <button type="button" class="btn btn-primary" @click="emit('submit')">지원하기</button>
      </div>
      <button type="button" class="modal-close" aria-label="닫기" @click="emit('cancel')">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </dialog>
</template>

<style scoped>
.apply-dialog {
  width: min(56rem, calc(100vw - 3.2rem));
  max-width: none;
  max-height: calc(100vh - 3.2rem);
  padding: 0;
  border: 0;
  border-radius: var(--krds-radius-xlarge1);
  background: var(--krds-light-color-surface-white);
  color: var(--krds-light-color-text-basic);
  box-shadow: var(--rq-shadow-pop);
}

.apply-dialog::backdrop {
  background: var(--rq-scrim);
}

.modal {
  position: relative;
  display: grid;
  gap: 2rem;
  padding: 3.2rem;
}

.modal-title {
  padding-right: 4.4rem;
  font-size: var(--krds-pc-font-size-heading-small);
  font-weight: 700;
  line-height: 1.4;
  color: var(--krds-light-color-text-bolder);
}

.modal-body {
  display: grid;
  gap: 1.6rem;
}

.lead {
  color: var(--krds-light-color-text-basic);
}

.apply-info {
  border-top: 2px solid var(--krds-light-color-border-gray-darker);
}

.info-row {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr);
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
  font-size: var(--krds-pc-font-size-body-small);
}

.info-row dt {
  padding: 1.2rem 1.4rem;
  background: var(--krds-light-color-surface-gray-subtler);
  font-weight: 700;
  color: var(--krds-light-color-text-bolder);
}

.info-row dd {
  display: grid;
  gap: 0.2rem;
  padding: 1.2rem 1.4rem;
}

.corp {
  color: var(--krds-light-color-text-bolder);
}

.resume-name {
  font-weight: 700;
  color: var(--krds-light-color-text-primary);
}

.resume-meta {
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.note {
  padding: 1.2rem 1.4rem;
  border-radius: var(--krds-radius-medium3);
  background: var(--krds-light-color-surface-gray-subtler);
  font-size: var(--krds-pc-font-size-body-xsmall);
  color: var(--krds-light-color-text-subtle);
}

.modal-btn {
  display: flex;
  justify-content: flex-end;
  gap: 0.8rem;
}

.modal-close {
  position: absolute;
  top: 2rem;
  right: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rq-touch);
  height: var(--rq-touch);
  border: 0;
  border-radius: var(--krds-radius-medium2);
  background: none;
  color: var(--krds-light-color-text-subtle);
}

.modal-close:hover {
  background: var(--krds-light-color-surface-gray-subtler);
  color: var(--krds-light-color-text-bolder);
}

@media (max-width: 767px) {
  .modal {
    gap: 1.6rem;
    padding: 2.4rem 1.6rem 1.6rem;
  }

  .modal-close {
    top: 1.2rem;
    right: 0.8rem;
  }

  .info-row {
    grid-template-columns: 8.8rem minmax(0, 1fr);
  }

  .modal-btn .btn {
    flex: 1;
  }
}
</style>
