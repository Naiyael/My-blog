<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vitepress';
import { api, categoryLabel, dateLabel } from './cms-client';

const QUICK_PAGES = [
  { id: 'quick-journal', title: '全部文章', excerpt: '按分类或标签浏览所有文章、题解与日常记录', href: '/journal.html', badge: '归档', keywords: '文章 题解 日常 归档 journal 全部' },
  { id: 'quick-cf', title: 'Codeforces · qiushan233', excerpt: 'Rating 变化曲线、比赛记录与通过题目检索', href: '/codeforces.html', badge: 'OJ', keywords: 'codeforces cf qiushan233 rating 比赛 题目 算法' },
  { id: 'quick-luogu', title: '洛谷 · Naiyael', excerpt: '洛谷各难度通过题目与刷题统计', href: '/luogu.html', badge: 'OJ', keywords: 'luogu 洛谷 刷题 题库 ac' },
  { id: 'quick-categories', title: '文章分类', excerpt: '按文章、题解、日常等分类浏览内容', href: '/categories.html', badge: '索引', keywords: '分类 categories 目录' },
  { id: 'quick-tags', title: '热门标签', excerpt: '按标签云查看图论、动态规划等专题', href: '/tags.html', badge: '索引', keywords: '标签 tags 云' },
  { id: 'quick-about', title: '关于我', excerpt: 'Naiyael 的个人介绍与常用链接', href: '/about.html', badge: '页面', keywords: '关于 about naiyael 介绍 acmer' },
];

const router = useRouter();
const isOpen = ref(false);
const query = ref('');
const loading = ref(false);
const error = ref('');
const results = ref([]);
const totalMatches = ref(0);
const recentPosts = ref([]);
const activeIndex = ref(0);
const isMac = ref(false);
const inputRef = ref(null);
const listRef = ref(null);

let debounceTimer = null;
let activeController = null;
let recentLoaded = false;
let previousFocus = null;

const postLink = (post) => (post.pageKey ? `/${post.pageKey}.html` : `/post.html?id=${post.id}`);

function toSearchItem(post) {
  return {
    id: post.id,
    title: post.title,
    excerpt: post.excerpt || '',
    href: postLink(post),
    badge: categoryLabel(post.category),
    pinned: !!post.pinned,
    tags: Array.isArray(post.tags) ? post.tags.slice(0, 3) : [],
    date: dateLabel(post.publishedAt || post.updatedAt),
    isPost: true,
  };
}

const trimmedQuery = computed(() => query.value.trim());

const displayItems = computed(() => {
  const q = trimmedQuery.value.toLowerCase();
  if (!q) {
    const recent = recentPosts.value.slice(0, 5).map(toSearchItem);
    const seen = new Set(recent.map((i) => i.href));
    const quick = QUICK_PAGES.filter((p) => !seen.has(p.href));
    return [...recent, ...quick];
  }
  const postItems = results.value.map(toSearchItem);
  const seen = new Set(postItems.map((i) => i.href));
  const quickMatches = QUICK_PAGES.filter(
    (p) => !seen.has(p.href) && `${p.title} ${p.excerpt} ${p.keywords}`.toLowerCase().includes(q)
  );
  return [...postItems, ...quickMatches];
});

const hasRecentSection = computed(() => !trimmedQuery.value && recentPosts.value.length > 0);
const recentCount = computed(() => Math.min(5, recentPosts.value.length));

function highlightParts(text, q) {
  const str = String(text || '');
  const needle = String(q || '').trim();
  if (!needle || !str) return [{ text: str, match: false }];
  const lower = str.toLowerCase();
  const target = needle.toLowerCase();
  const parts = [];
  let start = 0;
  let idx = lower.indexOf(target, start);
  while (idx !== -1) {
    if (idx > start) parts.push({ text: str.slice(start, idx), match: false });
    parts.push({ text: str.slice(idx, idx + needle.length), match: true });
    start = idx + needle.length;
    idx = lower.indexOf(target, start);
  }
  if (start < str.length) parts.push({ text: str.slice(start), match: false });
  return parts.length ? parts : [{ text: str, match: false }];
}

async function ensureRecent() {
  if (recentLoaded) return;
  try {
    const data = await api('/api/posts?page=1');
    recentPosts.value = Array.isArray(data.posts) ? data.posts : [];
    recentLoaded = true;
  } catch {
    // Keep static quick links available even if network is offline.
  }
}

async function runSearch(term) {
  activeController?.abort();
  const q = term.trim();
  if (!q) {
    results.value = [];
    totalMatches.value = 0;
    error.value = '';
    loading.value = false;
    return;
  }
  const controller = new AbortController();
  activeController = controller;
  loading.value = true;
  error.value = '';
  try {
    const data = await api('/api/posts?q=' + encodeURIComponent(q), { signal: controller.signal });
    if (activeController !== controller) return;
    results.value = Array.isArray(data.posts) ? data.posts : [];
    totalMatches.value = Number(data.total) || results.value.length;
    activeIndex.value = 0;
  } catch (e) {
    if (e?.name === 'AbortError') return;
    if (activeController === controller) {
      error.value = e?.message || '搜索失败，请稍后重试';
      results.value = [];
      totalMatches.value = 0;
    }
  } finally {
    if (activeController === controller) loading.value = false;
  }
}

watch(query, (val) => {
  clearTimeout(debounceTimer);
  activeIndex.value = 0;
  if (!val.trim()) {
    activeController?.abort();
    results.value = [];
    totalMatches.value = 0;
    error.value = '';
    loading.value = false;
    return;
  }
  loading.value = true;
  debounceTimer = setTimeout(() => runSearch(val), 160);
});

watch(displayItems, (items) => {
  if (activeIndex.value >= items.length) activeIndex.value = Math.max(0, items.length - 1);
});

function open() {
  if (isOpen.value) return;
  previousFocus = document.activeElement;
  isOpen.value = true;
  activeIndex.value = 0;
  document.documentElement.classList.add('site-search-open');
  ensureRecent();
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
}

function close() {
  if (!isOpen.value) return;
  isOpen.value = false;
  clearTimeout(debounceTimer);
  activeController?.abort();
  document.documentElement.classList.remove('site-search-open');
  if (previousFocus && typeof previousFocus.focus === 'function') {
    nextTick(() => previousFocus?.focus());
  }
}

function toggle() {
  if (isOpen.value) close();
  else open();
}

function go(item) {
  if (!item?.href) return;
  const target = item.href;
  close();
  router.go(target);
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = listRef.value?.querySelector('[data-search-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  });
}

function onModalKeydown(e) {
  const len = displayItems.value.length;
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
    return;
  }
  if (!len) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % len;
    scrollActiveIntoView();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + len) % len;
    scrollActiveIntoView();
  } else if (e.key === 'Enter') {
    const current = displayItems.value[activeIndex.value];
    if (current) {
      e.preventDefault();
      go(current);
    }
  }
}

function isEditableTarget(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function onGlobalKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    toggle();
    return;
  }
  if (!isOpen.value && e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (isEditableTarget(e.target) || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    open();
  }
}

onMounted(() => {
  isMac.value = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  window.addEventListener('keydown', onGlobalKeydown);
});

onUnmounted(() => {
  clearTimeout(debounceTimer);
  activeController?.abort();
  document.documentElement.classList.remove('site-search-open');
  window.removeEventListener('keydown', onGlobalKeydown);
});
</script>

<template>
<div class="site-search-wrap">
  <button
    type="button"
    class="site-search-trigger"
    @click="open"
    aria-label="搜索全站文章与页面"
    aria-haspopup="dialog"
    :aria-expanded="isOpen"
  >
    <svg class="site-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="7.25" cy="7.25" r="4.75"/>
      <path d="m13.5 13.5-2.8-2.8"/>
    </svg>
    <span class="site-search-placeholder">搜索文章…</span>
    <kbd class="site-search-kbd" aria-hidden="true">{{ isMac ? '⌘K' : 'Ctrl K' }}</kbd>
  </button>

  <Teleport to="body">
    <div
      v-if="isOpen"
      class="site-search-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="全站搜索"
      @click.self="close"
      @keydown="onModalKeydown"
    >
      <div class="site-search-modal">
        <div class="site-search-bar">
          <svg v-if="!loading" class="site-search-bar-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="7.25" cy="7.25" r="4.75"/>
            <path d="m13.5 13.5-2.8-2.8"/>
          </svg>
          <span v-else class="site-search-spinner" aria-hidden="true"></span>
          <input
            ref="inputRef"
            v-model="query"
            type="search"
            class="site-search-input"
            placeholder="搜索文章标题、正文、标签或页面…"
            aria-label="搜索关键词"
            autocomplete="off"
            spellcheck="false"
          >
          <button
            v-if="query"
            type="button"
            class="site-search-clear"
            @click="query = ''; inputRef?.focus()"
            aria-label="清除搜索词"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" aria-hidden="true"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>
          </button>
          <button type="button" class="site-search-esc" @click="close" aria-label="关闭搜索">ESC</button>
        </div>

        <div ref="listRef" class="site-search-body">
          <p v-if="error" class="site-search-state is-error" role="alert">{{ error }}</p>
          <div v-else-if="loading && trimmedQuery && !displayItems.length" class="site-search-skeletons" role="status" aria-label="正在搜索">
            <div class="site-search-skeleton-row" v-for="n in 3" :key="n">
              <span class="skeleton-bar" style="width: 48%; height: 15px;"></span>
              <span class="skeleton-bar" style="width: 82%; height: 12px; margin-top: 8px;"></span>
            </div>
          </div>
          <div v-else-if="!displayItems.length && trimmedQuery" class="site-search-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7"/>
              <path d="m20 20-3.5-3.5M8.5 11h5"/>
            </svg>
            <p>没有找到与「<strong>{{ trimmedQuery }}</strong>」相关的内容</p>
            <span>试试搜索算法名称（如 最小生成树、图论、DP）或标签关键词</span>
          </div>
          <ul v-else class="site-search-list" role="listbox" aria-label="搜索结果">
            <template v-for="(item, idx) in displayItems" :key="item.id">
              <li v-if="hasRecentSection && idx === 0" class="site-search-group" role="presentation">最近更新</li>
              <li v-if="hasRecentSection && idx === recentCount" class="site-search-group" role="presentation">快速直达</li>
              <li v-if="!hasRecentSection && !trimmedQuery && idx === 0" class="site-search-group" role="presentation">快速直达</li>
              <li v-if="trimmedQuery && idx === 0" class="site-search-group" role="presentation">匹配结果</li>
              <li role="option" :aria-selected="activeIndex === idx">
                <a
                  :href="item.href"
                  class="site-search-item"
                  :class="{ 'is-active': activeIndex === idx }"
                  :data-search-active="activeIndex === idx ? 'true' : undefined"
                  @mouseenter="activeIndex = idx"
                  @click.prevent="go(item)"
                >
                  <div class="site-search-item-main">
                    <div class="site-search-item-top">
                      <span class="site-search-badge" :class="{ 'is-quick': !item.isPost }">{{ item.badge }}</span>
                      <span v-if="item.pinned" class="post-pin-badge">置顶</span>
                      <strong class="site-search-item-title">
                        <template v-for="(part, pi) in highlightParts(item.title, trimmedQuery)" :key="pi">
                          <mark v-if="part.match">{{ part.text }}</mark>
                          <template v-else>{{ part.text }}</template>
                        </template>
                      </strong>
                    </div>
                    <p v-if="item.excerpt" class="site-search-item-excerpt">
                      <template v-for="(part, pi) in highlightParts(item.excerpt, trimmedQuery)" :key="pi">
                        <mark v-if="part.match">{{ part.text }}</mark>
                        <template v-else>{{ part.text }}</template>
                      </template>
                    </p>
                    <div v-if="(item.tags && item.tags.length) || item.date" class="site-search-item-meta">
                      <span v-for="t in item.tags" :key="t" class="site-search-tag">#{{ t }}</span>
                      <time v-if="item.date">{{ item.date }}</time>
                    </div>
                  </div>
                  <svg class="site-search-enter" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3.5 8h9M8.5 4l4 4-4 4"/>
                  </svg>
                </a>
              </li>
            </template>
          </ul>
        </div>

        <footer class="site-search-foot">
          <div class="site-search-hints">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
            <span><kbd>↵</kbd> 打开</span>
            <span><kbd>ESC</kbd> 关闭</span>
          </div>
          <span class="site-search-count" aria-live="polite">
            <template v-if="trimmedQuery && !loading">共 {{ Math.max(totalMatches, displayItems.length) }} 项</template>
            <template v-else-if="trimmedQuery && loading">检索中…</template>
            <template v-else>动态全文检索</template>
          </span>
        </footer>
      </div>
    </div>
  </Teleport>
</div>
</template>
