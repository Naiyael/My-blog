<script setup>
import {ref,computed} from 'vue';
import {categoryLabel,dateLabel} from './cms-client';
const props=defineProps({post:{type:Object,required:true}}),mode=ref('list');
const demo=computed(()=>!props.post.cover),src=computed(()=>props.post.cover||'/images/mountain-lake.jpg');
</script>
<template>
<div class="cms-cover-preview">
  <div class="cms-cover-preview-heading"><span>{{demo?'效果示例':'当前封面预览'}}</span><div><button :class="{active:mode==='list'}" @click="mode='list'" type="button">文章列表</button><button :class="{active:mode==='page'}" @click="mode='page'" type="button">文章页</button></div></div>
  <article v-if="mode==='list'" class="cms-cover-list-example"><img :src="src" :alt="demo?'封面效果示例':'当前封面缩略图'"><div><small>{{categoryLabel(post.category)}} · {{dateLabel(post.publishedAt||new Date())}}</small><h3>{{post.title||'这里显示文章标题'}}</h3><p>{{post.excerpt||'这里显示文章摘要，封面会显示在文章卡片顶部。'}}</p></div></article>
  <div v-else class="cms-cover-page-example"><h3>{{post.title||'这里显示文章标题'}}</h3><p>{{post.excerpt||'文章页中，封面会显示在摘要下方、正文上方。'}}</p><img :src="src" :alt="demo?'文章页封面效果示例':'当前文章页封面'"><span>正文从这里开始…</span></div>
  <p class="cms-cover-preview-note">{{demo?'当前未上传封面。上图仅用于展示效果，不会保存为你的封面。':'保存后生效。列表卡片顶部会居中裁切封面，文章页显示横向大图；图片文件本身不会被裁剪。'}}</p>
</div>
</template>

