<script setup>
import {useContentStats} from './content-stats';
import {categoryNames} from './cms-client';
defineProps({mode:{type:String,default:'summary'}});
const {state,refresh}=useContentStats();
const categoryLink=key=>'/journal.html?category='+encodeURIComponent(key);
const tagLink=name=>'/journal.html?tag='+encodeURIComponent(name);
</script>
<template>
<section class="content-stats-card" :class="'content-stats-'+mode" :aria-label="mode==='summary'?'内容统计':mode==='tags'?'热门标签':'文章分类'">
  <template v-if="mode==='summary'">
    <nav v-if="state.data" class="content-stat-totals" aria-label="内容数量"><a href="/journal.html"><strong>{{state.data.total}}</strong><span>文章</span></a><a href="/categories.html"><strong>{{state.data.categories.length}}</strong><span>分类</span></a><a href="/tags.html"><strong>{{state.data.tags.length}}</strong><span>标签</span></a></nav>
    <p v-else-if="!state.error" class="content-stats-hint">正在加载统计…</p>
  </template>
  <template v-else>
    <header><h2><a :href="mode==='tags'?'/tags.html':'/categories.html'">{{mode==='tags'?'热门标签':'文章分类'}}</a></h2><span v-if="state.data">{{mode==='tags'?state.data.tags.length:state.data.categories.length}}</span></header>
    <template v-if="state.data">
      <div v-if="mode==='categories'" class="content-category-list"><a v-for="item in state.data.categories" :key="item.key" :href="categoryLink(item.key)"><span>{{categoryNames[item.key]||item.key}}</span><b>{{item.count}}</b></a><p v-if="!state.data.categories.length" class="content-stats-hint">暂无已发布分类</p></div>
      <div v-else class="content-tag-cloud"><a v-for="item in state.data.tags" :key="item.name" :href="tagLink(item.name)" :title="item.name+' · '+item.count+' 篇内容'">{{item.name}}<small>{{item.count}}</small></a><p v-if="!state.data.tags.length" class="content-stats-hint">暂无已发布标签</p></div>
    </template>
    <p v-else-if="!state.error" class="content-stats-hint">正在加载…</p>
  </template>
  <p v-if="state.error" class="content-stats-hint" role="status">{{state.error}} <button @click="refresh" :disabled="state.loading">重试</button></p>
</section>
</template>
