<script setup>
import {ref,computed,onMounted,onUnmounted,watch} from 'vue';
import {useRouter} from 'vitepress';
import {api,categoryLabel,dateLabel} from './cms-client';
import {useContentStats} from './content-stats';
const props=defineProps({category:{type:String,default:''},home:{type:Boolean,default:false}});
const router=useRouter();
const posts=ref([]),total=ref(0),page=ref(1),loading=ref(true),error=ref(''),category=ref(props.category),tag=ref('');
const {state:taxonomy}=useContentStats();
const categoryOptions=computed(()=>[...new Set(['article','solution','daily',...(taxonomy.data?.categories||[]).map(c=>c.key),category.value].filter(Boolean))]);
const postLink=post=>post.pageKey?`/${post.pageKey}.html`:`/post.html?id=${post.id}`;
let sequence=0,mounted=false,previousRouteHook,routeHook;
async function load(){const seq=++sequence;loading.value=true;error.value='';try{const params=new URLSearchParams({page:String(page.value),category:category.value,tag:tag.value});const d=await api('/api/posts?'+params);if(seq!==sequence)return;posts.value=d.posts;total.value=d.total;}catch(e){if(seq===sequence)error.value=e.message;}finally{if(seq===sequence)loading.value=false;}}
function readFilters(){if(props.home)return;const params=new URLSearchParams(window.location.search);category.value=props.category||(params.get('category')||'').slice(0,100);tag.value=params.get('tag')||'';page.value=1;}
function updateURL(){if(props.home)return;const url=new URL(window.location.href);if(category.value)url.searchParams.set('category',category.value);else url.searchParams.delete('category');if(tag.value)url.searchParams.set('tag',tag.value);else url.searchParams.delete('tag');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);}
function chooseCategory(value){category.value=value;page.value=1;updateURL();}
function clearTag(){tag.value='';page.value=1;updateURL();}
watch([page,category,tag],()=>{if(mounted)load();});
onMounted(()=>{readFilters();mounted=true;load();previousRouteHook=router.onAfterRouteChange;routeHook=async(to)=>{await previousRouteHook?.(to);if(mounted){readFilters();load();}};router.onAfterRouteChange=routeHook;});
onUnmounted(()=>{mounted=false;sequence++;if(router.onAfterRouteChange===routeHook)router.onAfterRouteChange=previousRouteHook;});
</script>
<template>
<section class="journal-feed" :class="{'journal-archive':!home}" v-if="!home||posts.length">
  <header v-if="!home" class="journal-archive-heading"><div><span>文章 · 题解 · 日常</span><h1>{{props.category?categoryLabel(props.category):'文章'}}</h1></div><span v-if="!loading">{{total}} 篇记录</span></header>
  <header v-if="home" class="journal-home-heading"><div><span>文章 · 题解 · 日常</span><h2>我的记录 <small>{{total}}</small></h2></div><a class="journal-home-all" href="/journal.html">全部内容<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg></a></header>
  <div v-if="!home&&!props.category" class="journal-filter"><button :class="{active:!category}" @click="chooseCategory('')">全部</button><button v-for="key in categoryOptions" :key="key" :class="{active:category===key}" @click="chooseCategory(key)">{{categoryLabel(key)}}</button></div>
  <p v-if="tag&&!home" class="journal-selected-tag">标签：<strong>{{tag}}</strong><button @click="clearTag" aria-label="清除标签筛选">清除 ×</button></p>
  <p class="cms-muted" v-if="loading">正在加载…</p><p class="cms-error" v-else-if="error">{{error}} <button @click="load">重试</button></p><p class="cms-muted journal-empty" v-else-if="!posts.length">暂无{{tag?'相关内容':category?categoryLabel(category):'内容'}}。</p>
  <div v-else class="journal-items"><a class="journal-card" v-for="post in posts" :key="post.id" :class="{'is-pinned':post.pinned}" :href="postLink(post)"><img v-if="post.cover" :src="post.cover" :alt="post.title" loading="lazy"><div><span class="journal-meta"><span class="journal-category">{{categoryLabel(post.category)}}</span><span v-if="post.pinned" class="post-pin-badge"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 2 6 0-1 4 2 3H9v3l-1 2-1-2V9H4l2-3z"/></svg>置顶</span><time :datetime="post.publishedAt">{{dateLabel(post.publishedAt)}}</time></span><h2>{{post.title}}</h2><p>{{post.excerpt}}</p><div class="journal-card-foot"><span v-if="post.tags.length" class="journal-tags"><span v-for="label in post.tags" :key="label">{{label}}</span></span><span class="journal-read-hint" aria-hidden="true">阅读<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg></span></div></div></a></div>
  <div class="journal-pagination" v-if="total>12"><button :disabled="page===1" @click="page--">上一页</button><span>{{page}} / {{Math.ceil(total/12)}}</span><button :disabled="page*12>=total" @click="page++">下一页</button></div>
</section>
</template>

