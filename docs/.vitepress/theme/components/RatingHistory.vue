<script setup>
import { computed, ref } from 'vue';
import data from '../../../../src/data/codeforces.json';
const selected=ref(data.history.length-1);
const contest=computed(()=>data.history[selected.value]);
const delta=computed(()=>contest.value.newRating-contest.value.oldRating);
const first=data.history[0].ratingUpdateTimeSeconds,last=data.history.at(-1).ratingUpdateTimeSeconds;
const points=data.history.map(c=>({x:52+(c.ratingUpdateTimeSeconds-first)/(last-first)*650,y:210-c.newRating/1600*170}));
const path=points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
const date=c=>new Date(c.ratingUpdateTimeSeconds*1000).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
</script>
<template>
<div class="rating-widget">
  <div class="rating-totals"><div><strong>{{data.rating}}</strong><span>Specialist</span></div><p>最高 {{data.maxRating}} <span>·</span> {{data.history.length}} 场 Rated</p></div>
  <svg viewBox="0 0 750 245" class="history-chart" role="img" aria-label="七场 Rated 比赛的 Rating 变化，最后为 1410">
    <defs><linearGradient id="history-fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#5a9c92" stop-opacity=".22"/><stop offset="1" stop-color="#5a9c92" stop-opacity="0"/></linearGradient></defs>
    <g v-for="v in [400,800,1200,1600]" :key="v"><line x1="50" x2="710" :y1="210-v/1600*170" :y2="210-v/1600*170" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="3 5"/><text x="5" :y="214-v/1600*170">{{v}}</text></g>
    <path :d="path+' L702,212 L52,212 Z'" fill="url(#history-fill)"/><path :d="path" fill="none" stroke="#4d9188" stroke-width="2.5" stroke-linejoin="round"/>
    <g v-for="(p,i) in points" :key="i"><circle :cx="p.x" :cy="p.y" :r="selected===i?6:4" fill="var(--vp-c-bg)" stroke="#4d9188" stroke-width="2"/><circle :cx="p.x" :cy="p.y" r="13" fill="transparent" role="button" tabindex="0" :aria-label="`${data.history[i].contestName}, Rating ${data.history[i].newRating}`" @mouseenter="selected=i" @focus="selected=i" @click="selected=i" @keydown.enter="selected=i"/></g>
    <text x="51" y="239">2025.07</text><text x="650" y="239">2026.04</text>
  </svg>
  <div class="contest-selected" aria-live="polite"><div><span>{{date(contest)}}</span><a :href="`https://codeforces.com/contest/${contest.contestId}`" target="_blank" rel="noopener noreferrer">{{contest.contestName}} ↗</a></div><strong :class="{negative:delta<0}">{{delta>0?'+':''}}{{delta}} <small>→ {{contest.newRating}}</small></strong></div>
  <details><summary>查看全部比赛</summary><div class="contest-list"><a v-for="c in data.history" :key="c.contestId" :href="`https://codeforces.com/contest/${c.contestId}`" target="_blank" rel="noopener noreferrer"><time>{{date(c)}}</time><span>{{c.contestName}}</span><b>{{c.newRating}}</b></a></div></details>
</div>
</template>
