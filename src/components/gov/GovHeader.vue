<script setup lang="ts">
// 로고는 직접 만든 단순한 마크(둥근 사각형 안 말풍선 = 역질문). 태극·공식 로고 이미지는 쓰지 않는다(CLAUDE.md 사칭 금지).
// 고용24의 파란 띠·개인/기업 탭 장식은 따라 하지 않고, "시연" 배지를 로고와 같은 무게로 둔다(DR-r1-04).
</script>

<template>
  <div class="gov-header">
    <div class="inner">
      <RouterLink to="/" class="logo">
        <svg class="logo-mark" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
          <rect class="mark-bg" x="1" y="1" width="30" height="30" rx="8" />
          <path class="mark-bubble" d="M11 9h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-5.5L11 24v-4a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3z" />
          <path class="mark-lines" d="M12 13h8M12 16.2h5" />
        </svg>
        <span class="logo-text">고용24</span>
        <span class="logo-badge">시연</span>
      </RouterLink>
      <div class="utility">
        <span class="user"><strong>김00</strong>님</span>
        <RouterLink to="/mypage/applications" class="utility-link">마이페이지</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
  max-width: var(--rq-container);
  margin: 0 auto;
  padding: 0 var(--rq-gutter);
}

.gov-header {
  border-bottom: 1px solid var(--krds-light-color-divider-gray-light);
  background: var(--krds-light-color-surface-white);
}

.gov-header .inner {
  min-height: 7.2rem;
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  min-height: var(--rq-touch);
  color: var(--krds-light-color-text-bolder);
  text-decoration: none;
}

.logo:hover {
  color: var(--krds-light-color-text-bolder);
}

.logo-mark {
  width: 3.2rem;
  height: 3.2rem;
}

.mark-bg {
  fill: var(--krds-color-light-primary-50);
}

.mark-bubble {
  fill: var(--krds-color-light-gray-0);
}

.mark-lines {
  fill: none;
  stroke: var(--krds-color-light-primary-50);
  stroke-width: 1.8;
  stroke-linecap: round;
}

.logo-text {
  font-size: 2.4rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* 시연 띠와 같은 진한 회색: 띠 아래만 잘라 봐도 실제 고용24 헤더로 읽히지 않게 */
.logo-badge {
  padding: 0.3rem 0.8rem;
  border-radius: var(--krds-radius-small2);
  background: var(--krds-color-light-gray-80);
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--krds-color-light-gray-0);
}

.utility {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  font-size: var(--krds-pc-font-size-body-small);
}

.utility-link {
  color: var(--krds-light-color-text-subtle);
  text-decoration: none;
}

.utility-link:hover {
  color: var(--krds-light-color-text-basic);
  text-decoration: underline;
}

@media (max-width: 767px) {
  .gov-header .inner {
    min-height: 5.6rem;
  }

  .logo-text {
    font-size: 2rem;
  }

  .utility-link {
    display: none;
  }
}
</style>
