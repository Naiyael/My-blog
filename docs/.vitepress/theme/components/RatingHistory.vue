<script setup>
import { computed, ref, watch } from 'vue';
import { usePlatform } from './platform-state';
const { data } = usePlatform('cf');
const selected=ref(data.value.history.length-1);
watch(()=>data.value.history.length,()=>selected.value=data.value.history.length-1);
const contest=computed(()=>data.value.history[selected.value]);
const delta=computed(()=>contest.value.newRating-contest.value.oldRating);
const ceiling=computed(()=>Math.max(1600,Math.ceil(Math.max(data.value.maxRating,...data.value.history.map(c=>c.newRating))/400)*400));
const ticks=computed(()=>Array.from({length:4},(_,i)=>ceiling.value*(i+1)/4));
const points=computed(()=>{const h=data.value.history,first=h[0]?.ratingUpdateTimeSeconds??0,last=h.at(-1)?.ratingUpdateTimeSeconds??1;return h.map(c=>({x:52+(c.ratingUpdateTimeSeconds-first)/Math.max(1,last-first)*650,y:210-c.newRating/ceiling.value*170}));});
const path=computed(()=>points.value.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' '));
const area=computed(()=>path.value+` L${points.value.at(-1)?.x??702},212 L52,212 Z`);
const rank=computed(()=>data.value.rank.replace(/\b\w/g,c=>c.toUpperCase()));
const month=c=>c?new Date(c.ratingUpdateTimeSeconds*1000).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}):'';
const date=c=>new Date(c.ratingUpdateTimeSeconds*1000).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
</script>
<template>
<div class="rating-widget" v-if="data.history.length">
  <div class="rating-totals"><div><strong>{{data.rating}}</strong><span>{{rank}}</span></div><p>最高 {{data.maxRating}} <span>·</span> {{data.history.length}} 场 Rated</p></div>
  <svg viewBox="0 0 750 245" class="history-chart" role="img" :aria-label="`Rating 变化，当前为 ${data.rating}`">
    <defs><linearGradient id="history-fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#5a9c92" stop-opacity=".22"/><stop offset="1" stop-color="#5a9c92" stop-opacity="0"/></linearGradient></defs>
    <g v-for="v in ticks" :key="v"><line x1="50" x2="710" :y1="210-v/ceiling*170" :y2="210-v/ceiling*170" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="3 5"/><text x="5" :y="214-v/ceiling*170">{{v}}</text></g>
    <path :d="area" fill="url(#history-fill)"/><path :d="path" fill="none" stroke="#4d9188" stroke-width="2.5" stroke-linejoin="round"/>
    <g v-for="(p,i) in points" :key="i"><circle :cx="p.x" :cy="p.y" :r="selected===i?6:4" fill="var(--vp-c-bg)" stroke="#4d9188" stroke-width="2"/><circle :cx="p.x" :cy="p.y" r="13" fill="transparent" role="button" tabindex="0" :aria-label="`${data.history[i].contestName}, Rating ${data.history[i].newRating}`" @mouseenter="selected=i" @focus="selected=i" @click="selected=i" @keydown.enter="selected=i"/></g>
    <text x="51" y="239">{{month(data.history[0])}}</text><text x="650" y="239">{{month(data.history.at(-1))}}</text>
  </svg>
  <div class="contest-selected" aria-live="polite"><div><span>{{date(contest)}}</span><a :href="`https://codeforces.com/contest/${contest.contestId}`" target="_blank" rel="noopener noreferrer">{{contest.contestName}} ↗</a></div><strong :class="{negative:delta<0}">{{delta>0?'+':''}}{{delta}} <small>→ {{contest.newRating}}</small></strong></div>
  <details><summary>查看全部比赛</summary><div class="contest-list"><a v-for="c in data.history" :key="c.contestId" :href="`https://codeforces.com/contest/${c.contestId}`" target="_blank" rel="noopener noreferrer"><time>{{date(c)}}</time><span>{{c.contestName}}</span><b>{{c.newRating}}</b></a></div></details>
</div>
</template>
