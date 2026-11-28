<script setup>
import { ref, computed } from 'vue';
import { usePlatform } from './platform-state';

const { data: cf } = usePlatform('cf');
const { data: luogu } = usePlatform('luogu');

const activeTab = ref('topics');

const TOPIC_META = [
  { key: 'greedy', label: '贪心', tone: 'cyan' },
  { key: 'dp', label: '动态规划', tone: 'rose' },
  { key: 'graphs', label: '图论', tone: 'violet' },
  { key: 'math', label: '数学', tone: 'indigo' },
  { key: 'strings', label: '字符串', tone: 'teal' },
  { key: 'data structures', label: '数据结构', tone: 'cyan' },
  { key: 'binary search', label: '二分', tone: 'indigo' },
  { key: 'sortings', label: '排序', tone: 'teal' },
  { key: 'number theory', label: '数论', tone: 'violet' },
  { key: 'dfs and similar', label: '搜索', tone: 'rose' },
  { key: 'dsu', label: '并查集', tone: 'cyan' },
  { key: 'shortest paths', label: '最短路', tone: 'violet' },
  { key: 'two pointers', label: '双指针', tone: 'teal' },
  { key: 'constructive algorithms', label: '构造', tone: 'indigo' },
];

const LUOGU_COLORS = {
  Gray: { label: '灰名', hex: '#94a3b8' },
  Blue: { label: '蓝名', hex: '#3b82f6' },
  Green: { label: '绿名', hex: '#22a06b' },
  Orange: { label: '橙名', hex: '#ea7b2e' },
  Red: { label: '红名', hex: '#e14d58' },
  Purple: { label: '紫名', hex: '#9333ea' },
  Cheater: { label: '棕名', hex: '#8b5a2b' },
};

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

const topTopics = computed(() => {
  const tags = cf.value.tags || {};
  const list = TOPIC_META.map((item) => ({ ...item, count: Number(tags[item.key]) || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const max = Math.max(1, list[0]?.count || 1);
  return list.map((item) => ({
    ...item,
    pct: Math.max(14, Math.round((item.count / max) * 100)),
    href: `/codeforces.html?tag=${encodeURIComponent(item.key)}#problems`,
  }));
});

const luoguProfile = computed(() => luogu.value.profile || {});
const luoguBadge = computed(() => LUOGU_COLORS[luoguProfile.value.color] || null);

const luoguGroups = computed(() => {
  const raw = Array.isArray(luogu.value.groups) ? luogu.value.groups : [];
  const max = Math.max(1, ...raw.map((g) => (Array.isArray(g.ids) ? g.ids.length : 0)));
  return raw.map((g) => {
    const count = Array.isArray(g.ids) ? g.ids.length : 0;
    return {
      name: g.name,
      color: g.color || '#80b86b',
      count,
      pct: Math.max(12, Math.round((count / max) * 100)),
      href: `/luogu.html?group=${encodeURIComponent(g.name)}#problems`,
    };
  });
});

// Build a compact 42-day (14 x 3) activity heatmap from Luogu dailyCounts.
const luoguHeatmap = computed(() => {
  const counts = luoguProfile.value.dailyCounts;
  if (!counts || typeof counts !== 'object') return null;
  const dates = Object.keys(counts)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Number(counts[k]) > 0)
    .sort();
  if (!dates.length) return null;

  const parseUtc = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const fmtUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
  const DAY = 86400000;
  const DAYS = 42;

  const todayMs = parseUtc(new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10));
  const latestMs = parseUtc(dates[dates.length - 1]);
  const endMs = todayMs - latestMs <= (DAYS - 1) * DAY && todayMs >= latestMs ? todayMs : latestMs;
  const startMs = endMs - (DAYS - 1) * DAY;

  const cells = [];
  let windowTotal = 0;
  for (let i = 0; i < DAYS; i++) {
    const iso = fmtUtc(startMs + i * DAY);
    const count = Number(counts[iso]) || 0;
    windowTotal += count;
    const level = count <= 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
    cells.push({ date: iso, count, level });
  }
  const short = (iso) => iso.slice(5).replace('-', '/');
  return {
    cells,
    windowTotal,
    range: `${short(cells[0].date)}–${short(cells[cells.length - 1].date)}`,
  };
});
</script>

<template>
<section class="oj-stats-card" aria-label="ACMer 实时 OJ 看板">
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
      <span class="oj-split-name">
        洛谷通过
        <i v-if="luoguBadge" class="oj-lg-color-dot" :style="{ background: luoguBadge.hex }" :title="`洛谷${luoguBadge.label}`"></i>
      </span>
      <strong>{{ luogu.solved }}</strong>
      <small v-if="luogu.attempted">尝试 {{ luogu.attempted }}</small>
    </a>
  </div>

  <!-- 2-tab symmetric insights: CF Algorithm Topics & Luogu Difficulty + Profile + Heatmap -->
  <div v-if="topTopics.length || luoguGroups.length" class="oj-insights">
    <div class="oj-tabs" role="tablist" aria-label="Codeforces 与洛谷刷题画像">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'topics'"
        :class="{ 'is-active': activeTab === 'topics' }"
        @click="activeTab = 'topics'"
      >CF 专题</button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'luogu'"
        :class="{ 'is-active': activeTab === 'luogu' }"
        @click="activeTab = 'luogu'"
      >洛谷难度</button>
    </div>

    <!-- Tab 1: Codeforces Top Topics -->
    <div v-if="activeTab === 'topics'" class="oj-topics-panel" role="tabpanel" aria-label="Codeforces 擅长专题">
      <a v-for="topic in topTopics" :key="topic.key" :href="topic.href" class="oj-topic-row" :title="`查看 Codeforces ${topic.label} 相关通过题目`">
        <div class="oj-topic-meta">
          <span class="oj-topic-name">{{ topic.label }}</span>
          <span class="oj-topic-count">{{ topic.count }}</span>
        </div>
        <div class="oj-topic-track" aria-hidden="true">
          <span class="oj-topic-bar" :class="'tone-' + topic.tone" :style="{ width: topic.pct + '%' }"></span>
        </div>
      </a>
      <a href="/codeforces.html" class="oj-panel-more">
        <span>CF 题库</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg>
      </a>
    </div>

    <!-- Tab 2: Luogu Profile + Difficulty Distribution + Activity Heatmap -->
    <div v-else class="oj-luogu-panel" role="tabpanel" aria-label="洛谷难度分布与刷题活跃度">
      <div v-if="luoguBadge || luoguProfile.gu || luoguProfile.elo" class="oj-lg-badges">
        <span v-if="luoguBadge" class="oj-lg-pill" :style="{ '--lg-color': luoguBadge.hex }">
          <i aria-hidden="true"></i>{{ luoguBadge.label }}
        </span>
        <span v-if="luoguProfile.gu" class="oj-lg-pill is-metric">咕值 <b>{{ luoguProfile.gu }}</b></span>
        <span v-if="luoguProfile.elo" class="oj-lg-pill is-metric" :title="luoguProfile.eloContest || '洛谷等级分'">等级分 <b>{{ luoguProfile.elo }}</b></span>
      </div>

      <div class="oj-topics-panel">
        <a v-for="g in luoguGroups" :key="g.name" :href="g.href" class="oj-topic-row" :title="`查看洛谷「${g.name}」难度通过题目`">
          <div class="oj-topic-meta">
            <span class="oj-topic-name oj-lg-diff-name"><i :style="{ background: g.color }" aria-hidden="true"></i>{{ g.name }}</span>
            <span class="oj-topic-count">{{ g.count }}</span>
          </div>
          <div class="oj-topic-track" aria-hidden="true">
            <span class="oj-topic-bar" :style="{ width: g.pct + '%', background: g.color }"></span>
          </div>
        </a>
      </div>

      <div v-if="luoguHeatmap" class="oj-heatmap">
        <div class="oj-heatmap-head">
          <span>刷题活跃</span>
          <small>{{ luoguHeatmap.range }} · {{ luoguHeatmap.windowTotal }} 题</small>
        </div>
        <div class="oj-heatmap-grid" role="img" :aria-label="`洛谷 ${luoguHeatmap.range} 共通过 ${luoguHeatmap.windowTotal} 题`">
          <span
            v-for="cell in luoguHeatmap.cells"
            :key="cell.date"
            class="oj-heat-cell"
            :class="'lv-' + cell.level"
            :title="`${cell.date} · ${cell.count} 题`"
          ></span>
        </div>
      </div>

      <a href="/luogu.html" class="oj-panel-more">
        <span>洛谷题库</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg>
      </a>
    </div>
  </div>
</section>
</template>
