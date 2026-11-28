<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { usePlatform } from './platform-state';

const props = defineProps({ platform: { type: String, default: 'cf' } });
const { data } = usePlatform(props.platform);
const cf = computed(() => (props.platform === 'cf' ? data.value : { tags: {}, problems: [] }));
const groups = computed(() => (props.platform === 'luogu' ? data.value.groups : []));
const query = ref(''), selected = ref(''), page = ref(1);
const widgetRef = ref(null);

const labels = {
  graphs: '图论', dp: '动态规划', greedy: '贪心', 'data structures': '数据结构', strings: '字符串',
  math: '数学', 'shortest paths': '最短路', 'binary search': '二分', 'two pointers': '双指针',
  dsu: '并查集', 'dfs and similar': '搜索', 'number theory': '数论', 'constructive algorithms': '构造',
  implementation: '模拟', 'brute force': '枚举', sortings: '排序',
};

const tagOptions = [
  'greedy', 'math', 'strings', 'dp', 'graphs', 'data structures',
  'sortings', 'binary search', 'constructive algorithms', 'dfs and similar',
  'number theory', 'two pointers', 'shortest paths', 'dsu',
];

function cfDiffTier(rating) {
  const r = Number(rating) || 0;
  if (!r) return 'unrated';
  if (r >= 2400) return 'gm';
  if (r >= 2100) return 'master';
  if (r >= 1900) return 'cm';
  if (r >= 1600) return 'expert';
  if (r >= 1400) return 'specialist';
  if (r >= 1200) return 'pupil';
  return 'newbie';
}

const filtered = computed(() =>
  props.platform === 'cf'
    ? cf.value.problems.filter(
        (p) =>
          (!selected.value || p.tags.includes(selected.value)) &&
          `${p.id} ${p.name} ${p.tags.join(' ')} ${p.tags.map((t) => labels[t] || t).join(' ')}`
            .toLowerCase()
            .includes(query.value.trim().toLowerCase())
      )
    : data.value.problems.filter(
        (p) =>
          (!selected.value || p.group === selected.value) &&
          `${p.id} ${p.name}`.toLowerCase().includes(query.value.trim().toLowerCase())
      )
);

const size = computed(() => (props.platform === 'cf' ? 12 : 24));
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / size.value)));
const visible = computed(() => filtered.value.slice((page.value - 1) * size.value, page.value * size.value));
watch([query, selected], () => (page.value = 1));
watch(totalPages, (n) => { if (page.value > n) page.value = n; });
const reset = () => { query.value = ''; selected.value = ''; };
const url = (p) =>
  props.platform === 'cf'
    ? `https://codeforces.com/${p.gym ? 'gym' : 'contest'}/${p.contestId}/problem/${p.index}`
    : `https://www.luogu.com.cn/problem/${p.id}`;

function syncFromUrl() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (props.platform === 'cf') {
    const tagParam = params.get('tag');
    if (tagParam && tagOptions.includes(tagParam)) {
      selected.value = tagParam;
      if (window.location.hash === '#problems') {
        requestAnimationFrame(() => widgetRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    }
  } else if (props.platform === 'luogu') {
    const groupParam = params.get('group');
    if (groupParam && groups.value.some((g) => g.name === groupParam)) {
      selected.value = groupParam;
      if (window.location.hash === '#problems') {
        requestAnimationFrame(() => widgetRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    }
  }
}

function onLuoguFilterGroup(e) {
  if (props.platform === 'luogu' && typeof e.detail === 'string') {
    selected.value = selected.value === e.detail ? '' : e.detail;
    widgetRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

onMounted(() => {
  syncFromUrl();
  window.addEventListener('luogu-filter-group', onLuoguFilterGroup);
});

onUnmounted(() => {
  window.removeEventListener('luogu-filter-group', onLuoguFilterGroup);
});
</script>

<template>
<div id="problems" ref="widgetRef" class="archive-widget">
  <div class="archive-controls">
    <label class="archive-search">
      <svg class="archive-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.25" cy="7.25" r="4.75"/><path d="m13.5 13.5-2.8-2.8"/></svg>
      <input v-model="query" :aria-label="platform==='cf'?'搜索 Codeforces 题目':'搜索洛谷题号或题名'" :placeholder="platform==='cf'?'搜索题号、题名或算法标签…':'搜索题号或题目名称，如 P1196、并查集…'">
      <button v-if="query" class="archive-clear-btn" @click="query=''" aria-label="清除搜索">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" aria-hidden="true"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>
      </button>
    </label>
    <select v-model="selected" :aria-label="platform==='cf'?'按算法筛选':'按难度筛选'">
      <option value="">{{ platform==='cf' ? '全部算法' : '全部难度' }}</option>
      <template v-if="platform==='cf'">
        <option v-for="tag in tagOptions" :key="tag" :value="tag">{{ labels[tag] }} · {{ cf.tags[tag] || 0 }}</option>
      </template>
      <template v-else>
        <option v-for="g in groups" :key="g.name" :value="g.name">{{ g.name }} · {{ g.ids.length }}</option>
      </template>
    </select>
  </div>

  <div v-if="platform==='cf'" class="archive-topics">
    <button v-for="tag in tagOptions.slice(0, 7)" :key="tag" :class="{ active: selected === tag }" @click="selected = selected === tag ? '' : tag">{{ labels[tag] }} <span>{{ cf.tags[tag] || 0 }}</span></button>
  </div>
  <div v-else class="luogu-legend is-interactive">
    <button
      v-for="g in groups"
      :key="g.name"
      type="button"
      class="luogu-diff-chip"
      :class="{ active: selected === g.name }"
      :style="{ '--difficulty': g.color }"
      @click="selected = selected === g.name ? '' : g.name"
    >
      <i :style="{ background: g.color }" aria-hidden="true"></i>
      <span>{{ g.name }}</span>
      <b>{{ g.ids.length }}</b>
    </button>
  </div>

  <template v-if="visible.length">
    <div v-if="platform==='cf'" class="archive-rows">
      <div class="archive-row archive-head"><span>题目</span><span>标签</span><span>难度</span></div>
      <a v-for="p in visible" :key="p.id" :href="url(p)" target="_blank" rel="noopener noreferrer" class="archive-row">
        <div>
          <span class="archive-id">{{ p.id }}</span>
          <span class="archive-name">{{ p.name }} <small v-if="p.gym">Gym</small></span>
        </div>
        <span class="archive-tags">
          <template v-if="p.tags.length">
            <em v-for="t in p.tags.slice(0, 2)" :key="t">{{ labels[t] || t }}</em>
          </template>
          <template v-else>—</template>
        </span>
        <span class="archive-rating" :class="'tier-' + cfDiffTier(p.rating)">
          <b class="archive-rating-pill">{{ p.rating ? '*' + p.rating : '—' }}</b>
          <svg class="ui-ext-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg>
        </span>
      </a>
    </div>
    <div class="luogu-problems is-rich" v-else>
      <a
        v-for="p in visible"
        :key="p.id"
        :href="url(p)"
        :style="{ '--difficulty': p.color }"
        :title="`${p.id} ${p.name}（${p.group}）`"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="lg-prob-top">
          <i></i>
          <b>{{ p.id }}</b>
          <svg class="ui-ext-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg>
        </span>
        <span class="lg-prob-name">{{ p.name }}</span>
      </a>
    </div>
  </template>
  <div class="archive-empty" v-else><p>没有匹配的题目。</p><button @click="reset">清除筛选</button></div>

  <div class="archive-footer">
    <span aria-live="polite">{{ filtered.length }} 道题目<template v-if="selected"> · 当前筛选「{{ platform === 'cf' ? (labels[selected] || selected) : selected }}」</template></span>
    <div>
      <button class="ui-page-btn" :disabled="page===1" @click="page--" aria-label="上一页"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8 10 12.5"/></svg></button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button class="ui-page-btn" :disabled="page===totalPages" @click="page++" aria-label="下一页"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg></button>
    </div>
  </div>
</div>
</template>
