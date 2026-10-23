<script setup lang="ts">
// 로고는 직접 만든 단순 원형 마크. 태극·공식 로고 이미지는 쓰지 않는다(CLAUDE.md 사칭 금지).
</script>

<template>
  <div class="notice-bar">
    <div class="inner">
      <span class="member-type" aria-hidden="true"><span class="on">개인</span><span>기업</span></span>
      <p class="notice">모의 데이터 · 회사명과 공고는 예시</p>
    </div>
  </div>
  <div class="gov-header">
    <div class="inner">
      <RouterLink to="/" class="logo">
        <svg class="logo-mark" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
          <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="4" />
          <path d="M16 3a13 13 0 0 1 0 26z" fill="currentColor" />
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

.notice-bar {
  background: var(--krds-color-light-primary-60);
  color: var(--krds-color-light-gray-0);
  font-size: var(--krds-pc-font-size-body-xsmall);
}

.notice-bar .inner {
  justify-content: flex-start;
  min-height: 3.6rem;
}

.member-type {
  display: inline-flex;
  gap: 0.2rem;
}

.member-type span {
  padding: 0.2rem 1rem;
  border-radius: var(--krds-radius-small2);
  opacity: 0.85;
}

.member-type .on {
  background: var(--krds-color-light-primary-80);
  font-weight: 700;
  opacity: 1;
}

.notice {
  font-weight: 500;
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
  color: var(--krds-color-light-primary-50);
}

.logo-text {
  font-size: 2.4rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.logo-badge {
  padding: 0.2rem 0.7rem;
  border: 1px solid var(--krds-light-color-border-gray-dark);
  border-radius: var(--krds-radius-small2);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--krds-light-color-text-subtle);
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
  .notice-bar .inner {
    min-height: 3.2rem;
  }

  .member-type {
    display: none;
  }

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
