<script setup>
import {ref,computed,onMounted} from 'vue';
import {api,categoryLabel,dateLabel,readingStats} from './cms-client';
import ArticleContent from './ArticleContent.vue';
const post=ref(null),error=ref(''),loading=ref(true);
const stats=computed(()=>post.value?readingStats(post.value.content):null);
const tagLink=tag=>'/journal.html?tag='+encodeURIComponent(tag);
onMounted(async()=>{try{const id=new URLSearchParams(location.search).get('id');if(!/^[a-f0-9-]{36}$/.test(id||''))throw new Error('文章不存在');post.value=(await api('/api/posts/'+id)).post;document.title=post.value.title+' | Naiyael';}catch(e){error.value=e.message;}finally{loading.value=false;}});
</script>
<template>
<article class="reading-page reading-outline-page">
  <div v-if="loading" class="article-loading reading-skeleton" role="status" aria-label="正在加载文章">
    <span class="skeleton-bar w-24 h-4"></span>
    <span class="skeleton-bar w-48 h-4 mt-7"></span>
    <span class="skeleton-bar w-3/4 h-9 mt-3"></span>
    <span class="skeleton-bar w-full h-4 mt-6"></span>
    <span class="skeleton-bar w-11/12 h-4 mt-3"></span>
    <span class="skeleton-bar w-5/6 h-4 mt-3"></span>
    <span class="skeleton-bar w-full h-36 mt-7 rounded-lg"></span>
    <span class="skeleton-bar w-full h-4 mt-6"></span>
    <span class="skeleton-bar w-2/3 h-4 mt-3"></span>
  </div>
  <ArticleContent v-else-if="post" :content="post.content">
    <template #header>
      <a class="reading-back" href="/journal.html"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 8h-9M7.5 4l-4 4 4 4"/></svg><span>全部文章</span></a>
      <div class="reading-meta"><span class="reading-cat-pill">{{categoryLabel(post.category)}}</span><time :datetime="post.publishedAt">{{dateLabel(post.publishedAt)}}</time><span v-if="stats" class="reading-stats">{{stats.label}}</span></div>
      <h1>{{post.title}}</h1>
      <p class="reading-excerpt" v-if="post.excerpt">{{post.excerpt}}</p>
      <img v-if="post.cover" :src="post.cover" :alt="post.title" class="reading-cover">
    </template>
    <template #footer>
      <nav class="reading-tags" v-if="post.tags.length" aria-label="文章标签"><a v-for="t in post.tags" :key="t" :href="tagLink(t)">{{t}}</a></nav>
    </template>
  </ArticleContent>
  <div v-else class="article-loading"><h1>暂时无法阅读</h1><p>{{error}}</p><a class="reading-back" href="/journal.html"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 8h-9M7.5 4l-4 4 4 4"/></svg><span>返回文章列表</span></a></div>
</article>
</template>
