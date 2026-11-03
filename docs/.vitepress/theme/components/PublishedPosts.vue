<script setup>
import {ref,onMounted,watch}from'vue';import{api,categoryNames,dateLabel}from'./cms-client';
const props=defineProps({category:{type:String,default:''},home:{type:Boolean,default:false}});
const posts=ref([]),total=ref(0),page=ref(1),loading=ref(true),error=ref(''),category=ref(props.category);
const postLink=post=>post.pageKey?`/${post.pageKey}.html`:`/post.html?id=${post.id}`;
async function load(){loading.value=true;error.value='';try{const d=await api(`/api/posts?page=${page.value}&category=${category.value}`);posts.value=d.posts;total.value=d.total;}catch(e){error.value=e.message;}finally{loading.value=false;}}
watch(page,load);watch(category,()=>{if(page.value!==1)page.value=1;else load();});onMounted(load);
</script>
<template><section class="journal-feed" v-if="!home||posts.length"><div v-if="!home&&!props.category" class="journal-filter"><button v-for="(label,key) in {all:'全部',article:'文章',solution:'题解',daily:'日常'}" :key="key" :class="{active:category===(key==='all'?'':key)}" @click="category=key==='all'?'':key">{{label}}</button></div><p class="cms-muted" v-if="loading">正在加载…</p><p class="cms-error" v-else-if="error">{{error}} <button @click="load">重试</button></p><p class="cms-muted journal-empty" v-else-if="!posts.length">暂无{{categoryNames[category]||'内容'}}。</p><div v-else class="journal-items"><a class="journal-card" v-for="post in posts" :key="post.id" :href="postLink(post)"><img v-if="post.cover" :src="post.cover" :alt="post.title" loading="lazy"><div><span class="journal-meta">{{categoryNames[post.category]}} · {{dateLabel(post.publishedAt)}}</span><h2>{{post.title}}</h2><p>{{post.excerpt}}</p><span v-if="post.tags.length" class="journal-tags">{{post.tags.map(t=>'#'+t).join('  ')}}</span></div><span class="journal-arrow">↗</span></a></div><div class="journal-pagination" v-if="total>12"><button :disabled="page===1" @click="page--">上一页</button><span>{{page}} / {{Math.ceil(total/12)}}</span><button :disabled="page*12>=total" @click="page++">下一页</button></div></section></template>


