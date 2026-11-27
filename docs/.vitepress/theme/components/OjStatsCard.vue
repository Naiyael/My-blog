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

const VERDICT_MAP = {
  OK: { label: 'AC', cls: 'is-ac' },
  WRONG_ANSWER: { label: 'WA', cls: 'is-wa' },
  TIME_LIMIT_EXCEEDED: { label: 'TLE', cls: 'is-tle' },
  MEMORY_LIMIT_EXCEEDED: { label: 'MLE', cls: 'is-tle' },
  RUNTIME_ERROR: { label: 'RE', cls: 'is-wa' },
  COMPILATION_ERROR: { label: 'CE', cls: 'is-other' },
  TESTING: { label: 'RUN', cls: 'is-other' },
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

const recentSubs = computed(() =>
  (Array.isArray(cf.value.recentSubmissions) ? cf.value.recentSubmissions : []).slice(0, 4).map((sub) => {
    const v = VERDICT_MAP[sub.verdict] || { label: String(sub.verdict || '—').slice(0, 3), cls: 'is-other' };
    const date = sub.date
      ? new Date(sub.date).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit' })
      : '';
    return { ...sub, badge: v.label, badgeCls: v.cls, shortDate: date };
  })
);
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
      <span class="oj-split-name">洛谷通过</span>
      <strong>{{ luogu.solved }}</strong>
      <small v-if="luogu.attempted">尝试 {{ luogu.attempted }}</small>
    </a>
  </div>

  <!-- Segmented switch: Algorithm Profile (Option C) & Recent Submissions (Option D) -->
  <div v-if="topTopics.length || recentSubs.length" class="oj-insights">
    <div class="oj-tabs" role="tablist" aria-label="算法画像与最近提交">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'topics'"
        :class="{ 'is-active': activeTab === 'topics' }"
        @click="activeTab = 'topics'"
      >擅长专题</button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'recent'"
        :class="{ 'is-active': activeTab === 'recent' }"
        @click="activeTab = 'recent'"
      >最近提交</button>
    </div>

    <div v-if="activeTab === 'topics'" class="oj-topics-panel" role="tabpanel" aria-label="擅长算法专题">
      <a v-for="topic in topTopics" :key="topic.key" :href="topic.href" class="oj-topic-row" :title="`查看 ${topic.label} 相关通过题目`">
        <div class="oj-topic-meta">
          <span class="oj-topic-name">{{ topic.label }}</span>
          <span class="oj-topic-count">{{ topic.count }}</span>
        </div>
        <div class="oj-topic-track" aria-hidden="true">
          <span class="oj-topic-bar" :class="'tone-' + topic.tone" :style="{ width: topic.pct + '%' }"></span>
        </div>
      </a>
    </div>

    <div v-else class="oj-recent-panel" role="tabpanel" aria-label="最近 Codeforces 提交">
      <template v-if="recentSubs.length">
        <a
          v-for="sub in recentSubs"
          :key="sub.id"
          :href="sub.url"
          target="_blank"
          rel="noopener noreferrer"
          class="oj-sub-row"
          :title="`${sub.problemId} ${sub.name} (${sub.badge})`"
        >
          <span class="oj-sub-verdict" :class="sub.badgeCls">{{ sub.badge }}</span>
          <span class="oj-sub-title"><b>{{ sub.problemId }}</b> {{ sub.name }}</span>
          <time class="oj-sub-date">{{ sub.shortDate }}</time>
        </a>
        <a href="/codeforces.html" class="oj-panel-more">
          <span>全部记录</span>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg>
        </a>
      </template>
      <p v-else class="oj-empty-note">暂无最近提交记录</p>
    </div>
  </div>
</section>
</template>
