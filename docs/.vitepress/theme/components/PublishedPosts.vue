<script setup>
import {ref,onMounted,onUnmounted,watch} from 'vue';
import {useRouter} from 'vitepress';
import {api,categoryNames,dateLabel} from './cms-client';
const props=defineProps({category:{type:String,default:''},home:{type:Boolean,default:false}});
const router=useRouter();
const posts=ref([]),total=ref(0),page=ref(1),loading=ref(true),error=ref(''),category=ref(props.category),tag=ref('');
const postLink=post=>post.pageKey?`/${post.pageKey}.html`:`/post.html?id=${post.id}`;
let sequence=0,mounted=false,previousRouteHook,routeHook;
async function load(){const seq=++sequence;loading.value=true;error.value='';try{const params=new URLSearchParams({page:String(page.value),category:category.value,tag:tag.value});const d=await api('/api/posts?'+params);if(seq!==sequence)return;posts.value=d.posts;total.value=d.total;}catch(e){if(seq===sequence)error.value=e.message;}finally{if(seq===sequence)loading.value=false;}}
function readFilters(){if(props.home)return;const params=new URLSearchParams(window.location.search),requested=params.get('category');category.value=props.category||(['article','solution','daily'].includes(requested)?requested:'');tag.value=params.get('tag')||'';page.value=1;}
function updateURL(){if(props.home)return;const url=new URL(window.location.href);if(category.value)url.searchParams.set('category',category.value);else url.searchParams.delete('category');if(tag.value)url.searchParams.set('tag',tag.value);else url.searchParams.delete('tag');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);}
function chooseCategory(value){category.value=value;page.value=1;updateURL();}
function clearTag(){tag.value='';page.value=1;updateURL();}
watch([page,category,tag],()=>{if(mounted)load();});
onMounted(()=>{readFilters();mounted=true;load();previousRouteHook=router.onAfterRouteChange;routeHook=async(to)=>{await previousRouteHook?.(to);if(mounted){readFilters();load();}};router.onAfterRouteChange=routeHook;});
onUnmounted(()=>{mounted=false;sequence++;if(router.onAfterRouteChange===routeHook)router.onAfterRouteChange=previousRouteHook;});
</script>
<template>
<section class="journal-feed" v-if="!home||posts.length">
  <div v-if="!home&&!props.category" class="journal-filter"><button v-for="(label,key) in {all:'全部',article:'文章',solution:'题解',daily:'日常'}" :key="key" :class="{active:category===(key==='all'?'':key)}" @click="chooseCategory(key==='all'?'':key)">{{label}}</button></div>
  <p v-if="tag&&!home" class="journal-selected-tag">标签：<strong>{{tag}}</strong><button @click="clearTag" aria-label="清除标签筛选">清除 ×</button></p>
  <p class="cms-muted" v-if="loading">正在加载…</p><p class="cms-error" v-else-if="error">{{error}} <button @click="load">重试</button></p><p class="cms-muted journal-empty" v-else-if="!posts.length">暂无{{tag?'相关内容':categoryNames[category]||'内容'}}。</p>
  <div v-else class="journal-items"><a class="journal-card" v-for="post in posts" :key="post.id" :href="postLink(post)"><img v-if="post.cover" :src="post.cover" :alt="post.title" loading="lazy"><div><span class="journal-meta">{{categoryNames[post.category]}} · {{dateLabel(post.publishedAt)}}</span><h2>{{post.title}}</h2><p>{{post.excerpt}}</p><span v-if="post.tags.length" class="journal-tags">{{post.tags.map(t=>'#'+t).join('  ')}}</span></div><span class="journal-arrow">↗</span></a></div>
  <div class="journal-pagination" v-if="total>12"><button :disabled="page===1" @click="page--">上一页</button><span>{{page}} / {{Math.ceil(total/12)}}</span><button :disabled="page*12>=total" @click="page++">下一页</button></div>
</section>
</template>
