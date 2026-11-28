<script setup>
import { computed } from 'vue';
import { usePlatform } from './platform-state';

const { data } = usePlatform('luogu');

const groups = computed(() => {
  const raw = Array.isArray(data.value.groups) ? data.value.groups : [];
  const total = Math.max(1, raw.reduce((s, g) => s + (g.ids?.length || 0), 0));
  return raw.map((g) => ({
    name: g.name,
    color: g.color || '#80b86b',
    count: g.ids?.length || 0,
    pct: Math.round(((g.ids?.length || 0) / total) * 1000) / 10,
  }));
});

// Wide 84-day (12 weeks x 7 days) heatmap for the dedicated Luogu page
const heatmap = computed(() => {
  const counts = data.value.profile?.dailyCounts;
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
  const DAYS = 84;

  const todayMs = parseUtc(new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10));
  const latestMs = parseUtc(dates[dates.length - 1]);
  const endMs = todayMs - latestMs <= (DAYS - 1) * DAY && todayMs >= latestMs ? todayMs : latestMs;
  const startMs = endMs - (DAYS - 1) * DAY;

  const cells = [];
  let total = 0;
  let activeDays = 0;
  for (let i = 0; i < DAYS; i++) {
    const iso = fmtUtc(startMs + i * DAY);
    const count = Number(counts[iso]) || 0;
    total += count;
    if (count > 0) activeDays++;
    const level = count <= 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
    cells.push({ date: iso, count, level });
  }
  const short = (iso) => iso.slice(5).replace('-', '/');
  return {
    cells,
    total,
    activeDays,
    range: `${short(cells[0].date)} – ${short(cells[cells.length - 1].date)}`,
  };
});

function pickGroup(name) {
  window.dispatchEvent(new CustomEvent('luogu-filter-group', { detail: name }));
}
</script>

<template>
<div class="luogu-insights-grid" v-if="groups.length || heatmap">
  <section v-if="groups.length" class="luogu-insight-card">
    <header>
      <h3>难度分布</h3>
      <span>点击筛选题库</span>
    </header>
    <div class="luogu-stacked-bar" aria-hidden="true">
      <button
        v-for="g in groups"
        :key="g.name"
        type="button"
        :style="{ flex: g.count, background: g.color }"
        :title="`${g.name}：${g.count} 题 (${g.pct}%)`"
        @click="pickGroup(g.name)"
      ></button>
    </div>
    <div class="luogu-dist-list">
      <button v-for="g in groups" :key="g.name" type="button" class="luogu-dist-item" @click="pickGroup(g.name)">
        <i :style="{ background: g.color }" aria-hidden="true"></i>
        <span>{{ g.name }}</span>
        <b>{{ g.count }}</b>
        <small>{{ g.pct }}%</small>
      </button>
    </div>
  </section>

  <section v-if="heatmap" class="luogu-insight-card">
    <header>
      <h3>刷题活跃</h3>
      <span>{{ heatmap.range }}</span>
    </header>
    <div class="luogu-wide-heatmap" role="img" :aria-label="`洛谷 ${heatmap.range} 活跃 ${heatmap.activeDays} 天，共 ${heatmap.total} 题`">
      <span
        v-for="cell in heatmap.cells"
        :key="cell.date"
        class="oj-heat-cell"
        :class="'lv-' + cell.level"
        :title="`${cell.date} · ${cell.count} 题`"
      ></span>
    </div>
    <footer class="luogu-heat-foot">
      <span>共 <b>{{ heatmap.total }}</b> 题 · 活跃 <b>{{ heatmap.activeDays }}</b> 天</span>
      <span class="luogu-heat-legend" aria-hidden="true">
        少 <i class="oj-heat-cell lv-0"></i><i class="oj-heat-cell lv-1"></i><i class="oj-heat-cell lv-2"></i><i class="oj-heat-cell lv-3"></i><i class="oj-heat-cell lv-4"></i> 多
      </span>
    </footer>
  </section>
</div>
</template>
