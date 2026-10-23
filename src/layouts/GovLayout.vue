<script setup lang="ts">
/**
 * 공통 틀: 시연 띠 → 헤더 → 주 메뉴 → (마이페이지면 왼쪽 메뉴 +) 본문 2단 → 경로 → 화면.
 * 고용24 화면과 구조만 닮게 하고 색·로고·장식은 KRDS 토큰으로 다시 짠다(D-003).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DemoBanner from '@/components/gov/DemoBanner.vue'
import GovBreadcrumb from '@/components/gov/GovBreadcrumb.vue'
import GovFooter from '@/components/gov/GovFooter.vue'
import GovHeader from '@/components/gov/GovHeader.vue'
import MainMenu from '@/components/gov/MainMenu.vue'
import SideNav from '@/components/gov/SideNav.vue'
import SideSelect from '@/components/gov/SideSelect.vue'
import DemoTools from '@/components/ui/DemoTools.vue'
import ToastHost from '@/components/ui/ToastHost.vue'

const route = useRoute()
const withSide = computed(() => route.meta.side !== undefined)
</script>

<template>
  <a class="skip-link" href="#main-content">본문 바로가기</a>
  <header class="site-header">
    <DemoBanner />
    <GovHeader />
    <MainMenu />
  </header>
  <div class="page-body" :class="{ 'with-side': withSide }">
    <aside v-if="withSide" class="page-side" aria-label="마이페이지">
      <SideNav />
    </aside>
    <main id="main-content" class="page-main" tabindex="-1">
      <GovBreadcrumb />
      <SideSelect v-if="withSide" />
      <slot />
    </main>
  </div>
  <GovFooter />
  <DemoTools />
  <ToastHost />
</template>

<style scoped>
.skip-link {
  position: absolute;
  left: 1.6rem;
  top: -10rem;
  z-index: 100;
  padding: 1.2rem 1.6rem;
  border-radius: var(--krds-radius-medium2);
  background: var(--krds-light-color-surface-inverse);
  color: var(--krds-light-color-text-basic-inverse);
  font-weight: 700;
}

.skip-link:focus {
  top: 1.6rem;
}

.page-body {
  flex: 1 0 auto;
  width: 100%;
  max-width: var(--rq-container);
  margin: 0 auto;
  padding: 3.2rem var(--rq-gutter) 0;
}

.page-body.with-side {
  display: grid;
  grid-template-columns: var(--rq-side-width) minmax(0, 1fr);
  gap: 4.8rem;
}

.page-main {
  min-width: 0;
}

.page-main:focus {
  outline: none;
}

@media (max-width: 1023px) {
  .page-body.with-side {
    grid-template-columns: 20rem minmax(0, 1fr);
    gap: 2.4rem;
  }
}

@media (max-width: 767px) {
  .page-body {
    padding-top: 2rem;
  }

  .page-body.with-side {
    display: block;
  }

  .page-side {
    display: none;
  }
}
</style>
