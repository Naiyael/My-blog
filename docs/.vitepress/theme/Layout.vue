<script setup>
import Teek from 'vitepress-theme-teek';
import PublishedPosts from './components/PublishedPosts.vue';
import TechHero from './components/TechHero.vue';
import ContentStats from './components/ContentStats.vue';
import SiteNavigation from './components/SiteNavigation.vue';
</script>
<template><Teek.Layout><template #teek-home-before><h1 class="cms-sr-only">Naiyael 的个人主页</h1></template><template #nav-bar-content-after><SiteNavigation /></template><template #teek-home-post-before><PublishedPosts home /></template><template #teek-home-card-my-after><ContentStats mode="summary" /><details class="wallpaper-tech-card"><summary>技术生态 <span>图标球</span><i aria-hidden="true">＋</i></summary><TechHero compact /></details></template><template #teek-home-card-category><ContentStats mode="categories" /></template><template #teek-home-card-tag><ContentStats mode="tags" /></template></Teek.Layout></template>



