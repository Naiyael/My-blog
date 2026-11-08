<script setup>
import{ref,onMounted}from'vue';import{api,categoryLabel,dateLabel}from'./cms-client';
import ArticleContent from './ArticleContent.vue';
const post=ref(null),error=ref(''),loading=ref(true);
onMounted(async()=>{try{const id=new URLSearchParams(location.search).get('id');if(!/^[a-f0-9-]{36}$/.test(id||''))throw new Error('文章不存在');post.value=(await api('/api/posts/'+id)).post;document.title=post.value.title+' | Naiyael';}catch(e){error.value=e.message;}finally{loading.value=false;}});
</script>
<template><article class="reading-page reading-outline-page"><p v-if="loading" class="cms-muted article-loading">正在加载…</p><ArticleContent v-else-if="post" :content="post.content"><template #header><a class="reading-back" href="/journal.html">← 全部文章</a><div class="reading-meta">{{categoryLabel(post.category)}} · {{dateLabel(post.publishedAt)}}</div><h1>{{post.title}}</h1><p class="reading-excerpt" v-if="post.excerpt">{{post.excerpt}}</p><img v-if="post.cover" :src="post.cover" :alt="post.title" class="reading-cover"></template><template #footer><div class="reading-tags" v-if="post.tags.length">{{post.tags.map(t=>'#'+t).join('  ')}}</div></template></ArticleContent><div v-else class="article-loading"><h1>暂时无法阅读</h1><p>{{error}}</p><a href="/journal.html">返回文章列表</a></div></article></template>

