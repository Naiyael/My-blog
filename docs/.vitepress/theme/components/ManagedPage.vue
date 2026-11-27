<script setup>
import {ref,onMounted} from 'vue';
import {api} from './cms-client';
import ArticleContent from './ArticleContent.vue';
const props=defineProps({pageKey:{type:String,required:true}});
const post=ref(null),loading=ref(true),error=ref('');
async function load(){loading.value=true;error.value='';try{post.value=(await api('/api/pages/'+props.pageKey)).post;document.title=post.value.title+' | Naiyael';}catch(e){error.value=e.status===404?'这篇内容暂不可见。':e.message;}finally{loading.value=false;}}
onMounted(load);
</script>
<template><section class="managed-page reading-page reading-outline-page"><div v-if="loading" class="article-loading reading-skeleton" role="status" aria-label="正在加载页面"><span class="skeleton-bar w-48 h-8"></span><span class="skeleton-bar w-full h-4 mt-6"></span><span class="skeleton-bar w-5/6 h-4 mt-3"></span><span class="skeleton-bar w-full h-36 mt-7 rounded-lg"></span></div><div v-else-if="error" class="article-loading"><p class="cms-muted">{{error}}</p><button @click="load">重新加载</button></div><ArticleContent v-else :content="post.content"><template #header><h1>{{post.title}}</h1><img v-if="post.cover" class="reading-cover" :src="post.cover" :alt="post.title"><img v-if="pageKey==='about'" class="about-photo" src="/images/avatar.jpg" alt="Naiyael" width="124" height="124"></template><slot /></ArticleContent></section></template>

