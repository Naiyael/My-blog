<script setup>
import Teek from 'vitepress-theme-teek';
import PublishedPosts from './components/PublishedPosts.vue';
</script>
<template><Teek.Layout><template #teek-home-post-before><PublishedPosts home /></template></Teek.Layout></template>
