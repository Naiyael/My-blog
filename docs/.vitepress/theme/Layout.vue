<script setup>
import Teek from 'vitepress-theme-teek';
import PublishedPosts from './components/PublishedPosts.vue';
import TechHero from './components/TechHero.vue';
import { useData } from 'vitepress';
const { frontmatter } = useData();
</script>
<template><Teek.Layout><template #teek-home-before><TechHero v-if="frontmatter.layout==='home'&&!frontmatter.categoriesPage&&!frontmatter.tagsPage" /></template><template #teek-home-post-before><PublishedPosts home /></template></Teek.Layout></template>
