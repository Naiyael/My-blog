<script setup>
import Teek from 'vitepress-theme-teek';
import PublishedPosts from './components/PublishedPosts.vue';
import TechHero from './components/TechHero.vue';
import ContentStats from './components/ContentStats.vue';
import OjStatsCard from './components/OjStatsCard.vue';
import SiteNavigation from './components/SiteNavigation.vue';
import SiteSearch from './components/SiteSearch.vue';
import ThemeToggle from './components/ThemeToggle.vue';
</script>
<template>
  <Teek.Layout>
    <template #teek-home-before><h1 class="cms-sr-only">Naiyael 的个人主页</h1></template>
    <template #nav-bar-content-before><SiteSearch /></template>
    <template #nav-bar-content-after><SiteNavigation /><ThemeToggle /></template>
    <template #teek-home-post-before><PublishedPosts home /></template>
    <template #teek-home-card-my-after>
      <ContentStats mode="summary" />
      <OjStatsCard />
      <details class="wallpaper-tech-card">
        <summary>
          技术生态 <span>图标球</span>
          <i class="wallpaper-tech-plus" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"><path d="M8 3.25v9.5M3.25 8h9.5"/></svg>
          </i>
        </summary>
        <TechHero compact />
      </details>
    </template>
    <template #teek-home-card-category><ContentStats mode="categories" /></template>
    <template #teek-home-card-tag><ContentStats mode="tags" /></template>
  </Teek.Layout>
</template>
