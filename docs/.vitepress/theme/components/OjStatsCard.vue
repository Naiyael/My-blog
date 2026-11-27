<script setup>
import { computed } from 'vue';
import { usePlatform } from './platform-state';

const { data: cf } = usePlatform('cf');
const { data: luogu } = usePlatform('luogu');

const tier = computed(() => {
  const r = Number(cf.value.rating) || 0;
  if (r >= 2400) return 'gm';
  if (r >= 2100) return 'master';
  if (r >= 1900) return 'cm';
  if (r >= 1600) return 'expert';
  if (r >= 1400) return 'specialist';
  if (r >= 1200) return 'pupil';
  return 'newbie';
});

const rankLabel = computed(() =>
  cf.value.rank ? String(cf.value.rank).replace(/\b\w/g, (c) => c.toUpperCase()) : 'Rated'
);

const ratedCount = computed(() => (Array.isArray(cf.value.history) ? cf.value.history.length : 0));
const totalSolved = computed(() => (Number(cf.value.solved) || 0) + (Number(luogu.value.solved) || 0));
const syncDelayed = computed(() => cf.value.syncState === 'delayed' && luogu.value.syncState === 'delayed');
</script>

<template>
<section class="oj-stats-card" aria-label="ACMer 实时 OJ 战绩">
  <header class="oj-stats-head">
    <div class="oj-stats-title">
      <span class="oj-live-dot" :class="{ delayed: syncDelayed }" aria-hidden="true"></span>
      <h2>OJ 战绩</h2>
    </div>
    <span class="oj-total-pill" :title="`Codeforces ${cf.solved} + 洛谷 ${luogu.solved}`">{{ totalSolved }} AC</span>
  </header>

  <a class="oj-cf-banner" :class="'tier-' + tier" href="/codeforces.html" :aria-label="`Codeforces ${cf.handle || 'qiushan233'} Rating ${cf.rating}`">
    <div class="oj-cf-main">
      <span class="oj-cf-label">Codeforces · {{ cf.handle || 'qiushan233' }}</span>
      <div class="oj-cf-rating-row">
        <strong class="oj-cf-rating">{{ cf.rating }}</strong>
        <span class="oj-cf-rank">{{ rankLabel }}</span>
      </div>
      <span class="oj-cf-sub">最高 {{ cf.maxRating }}<template v-if="ratedCount"> · {{ ratedCount }} 场 Rated</template></span>
    </div>
    <svg class="oj-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>
  </a>

  <div class="oj-split">
    <a class="oj-split-item" href="/codeforces.html">
      <span class="oj-split-name">CF 通过</span>
      <strong>{{ cf.solved }}</strong>
      <small v-if="cf.maxDifficulty">最高 *{{ cf.maxDifficulty }}</small>
    </a>
    <a class="oj-split-item" href="/luogu.html">
      <span class="oj-split-name">洛谷通过</span>
      <strong>{{ luogu.solved }}</strong>
      <small v-if="luogu.attempted">尝试 {{ luogu.attempted }}</small>
    </a>
  </div>
</section>
</template>
