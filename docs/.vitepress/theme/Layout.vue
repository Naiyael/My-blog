<script setup>
import Teek from 'vitepress-theme-teek';
import PublishedPosts from './components/PublishedPosts.vue';
import TechHero from './components/TechHero.vue';
import ContentStats from './components/ContentStats.vue';
import { useData } from 'vitepress';
const { frontmatter } = useData();
</script>
<template><Teek.Layout><template #teek-home-before><TechHero v-if="frontmatter.layout==='home'&&!frontmatter.categoriesPage&&!frontmatter.tagsPage" /></template><template #teek-home-post-before><PublishedPosts home /></template><template #teek-home-card-my-after><ContentStats mode="summary" /></template><template #teek-home-card-category><ContentStats mode="categories" /></template><template #teek-home-card-tag><ContentStats mode="tags" /></template></Teek.Layout></template>
