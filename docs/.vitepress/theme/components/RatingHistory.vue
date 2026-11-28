<script setup>
import { computed, ref, watch } from 'vue';
import { usePlatform } from './platform-state';

const { data } = usePlatform('cf');
const selected = ref(data.value.history.length - 1);
watch(() => data.value.history.length, () => (selected.value = data.value.history.length - 1));

const contest = computed(() => data.value.history[selected.value]);
const delta = computed(() => contest.value.newRating - contest.value.oldRating);
const ceiling = computed(() => Math.max(1600, Math.ceil(Math.max(data.value.maxRating, ...data.value.history.map((c) => c.newRating)) / 400) * 400));
const ticks = computed(() => Array.from({ length: 4 }, (_, i) => (ceiling.value * (i + 1)) / 4));
const points = computed(() => {
  const h = data.value.history, first = h[0]?.ratingUpdateTimeSeconds ?? 0, last = h.at(-1)?.ratingUpdateTimeSeconds ?? 1;
  return h.map((c) => ({ x: 52 + ((c.ratingUpdateTimeSeconds - first) / Math.max(1, last - first)) * 650, y: 210 - (c.newRating / ceiling.value) * 170 }));
});
const path = computed(() => points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '));
const area = computed(() => path.value + ` L${points.value.at(-1)?.x ?? 702},212 L52,212 Z`);
const rank = computed(() => data.value.rank.replace(/\b\w/g, (c) => c.toUpperCase()));
const tier = computed(() => {
  const r = Number(data.value.rating) || 0;
  if (r >= 2400) return 'gm';
  if (r >= 2100) return 'master';
  if (r >= 1900) return 'cm';
  if (r >= 1600) return 'expert';
  if (r >= 1400) return 'specialist';
  if (r >= 1200) return 'pupil';
  return 'newbie';
});
const reversedHistory = computed(() => [...data.value.history].reverse());
const month = (c) => (c ? new Date(c.ratingUpdateTimeSeconds * 1000).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }) : '');
const date = (c) => new Date(c.ratingUpdateTimeSeconds * 1000).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
</script>

<template>
<div class="rating-widget" :class="'tier-' + tier" v-if="data.history.length">
  <div class="rating-totals">
    <div>
      <strong class="rating-big-num">{{ data.rating }}</strong>
      <span class="rating-tier-pill">{{ rank }}</span>
    </div>
    <p>最高 <b>{{ data.maxRating }}</b> <span>·</span> {{ data.history.length }} 场 Rated</p>
  </div>

  <svg viewBox="0 0 750 245" class="history-chart" role="img" :aria-label="`Rating 变化，当前为 ${data.rating}`">
    <defs>
      <linearGradient id="history-fill" x1="0" x2="0" y1="0" y2="1">
        <stop stop-color="var(--folio-accent, #087589)" stop-opacity=".26"/>
        <stop offset="1" stop-color="var(--folio-accent, #087589)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g v-for="v in ticks" :key="v">
      <line x1="50" x2="710" :y1="210-v/ceiling*170" :y2="210-v/ceiling*170" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="3 5"/>
      <text x="5" :y="214-v/ceiling*170">{{ v }}</text>
    </g>
    <path :d="area" fill="url(#history-fill)"/>
    <path :d="path" fill="none" stroke="var(--folio-accent, #087589)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <g v-for="(p, i) in points" :key="i">
      <circle v-if="selected === i" :cx="p.x" :cy="p.y" r="10.5" fill="var(--folio-accent, #087589)" fill-opacity=".16"/>
      <circle :cx="p.x" :cy="p.y" :r="selected === i ? 5.5 : 3.8" :fill="selected === i ? 'var(--folio-accent, #087589)' : 'var(--folio-paper, var(--vp-c-bg))'" stroke="var(--folio-accent, #087589)" stroke-width="2.2"/>
      <circle :cx="p.x" :cy="p.y" r="14" fill="transparent" role="button" tabindex="0" :aria-label="`${data.history[i].contestName}, Rating ${data.history[i].newRating}`" @mouseenter="selected = i" @focus="selected = i" @click="selected = i" @keydown.enter="selected = i"/>
    </g>
    <text x="51" y="239">{{ month(data.history[0]) }}</text>
    <text x="650" y="239">{{ month(data.history.at(-1)) }}</text>
  </svg>

  <div class="contest-selected" aria-live="polite">
    <div>
      <span class="contest-meta-line">{{ date(contest) }}<template v-if="contest.rank"> · Rank #{{ contest.rank }}</template></span>
      <a class="ui-inline-link" :href="`https://codeforces.com/contest/${contest.contestId}`" target="_blank" rel="noopener noreferrer">
        <span>{{ contest.contestName }}</span>
        <svg class="ui-ext-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg>
      </a>
    </div>
    <div class="contest-delta-box">
      <strong class="contest-delta-pill" :class="{ negative: delta < 0 }">{{ delta > 0 ? '+' : '' }}{{ delta }}</strong>
      <small class="contest-arrow-val">
        <svg class="ui-arrow-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg>
        <b>{{ contest.newRating }}</b>
      </small>
    </div>
  </div>

  <details class="contest-history-details">
    <summary>
      <svg class="contest-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>
      <span>查看全部 {{ data.history.length }} 场比赛记录</span>
    </summary>
    <div class="contest-list">
      <a v-for="c in reversedHistory" :key="c.contestId" :href="`https://codeforces.com/contest/${c.contestId}`" target="_blank" rel="noopener noreferrer">
        <time>{{ date(c) }}</time>
        <span class="contest-list-name">{{ c.contestName }}</span>
        <em class="contest-list-delta" :class="{ negative: c.newRating - c.oldRating < 0 }">{{ c.newRating - c.oldRating > 0 ? '+' : '' }}{{ c.newRating - c.oldRating }}</em>
        <b>{{ c.newRating }}</b>
      </a>
    </div>
  </details>
</div>
</template>
