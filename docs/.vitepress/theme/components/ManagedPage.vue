<script setup>
import {ref,onMounted} from 'vue';
import {api,renderMarkdown} from './cms-client';
const props=defineProps({pageKey:{type:String,required:true}});
const post=ref(null),loading=ref(true),error=ref('');
async function load(){loading.value=true;error.value='';try{post.value=(await api('/api/pages/'+props.pageKey)).post;document.title=post.value.title+' | Naiyael';}catch(e){error.value=e.status===404?'这篇内容暂不可见。':e.message;}finally{loading.value=false;}}
onMounted(load);
</script>
<template><section class="managed-page reading-page vp-doc"><p v-if="loading" class="cms-muted">正在加载…</p><div v-else-if="error"><p class="cms-muted">{{error}}</p><button @click="load">重新加载</button></div><template v-else><h1>{{post.title}}</h1><img v-if="post.cover" class="reading-cover" :src="post.cover" :alt="post.title"><img v-if="pageKey==='about'" class="about-photo" src="/images/avatar.jpg" alt="Naiyael" width="124" height="124"><div v-html="renderMarkdown(post.content)"></div><slot /></template></section></template>

