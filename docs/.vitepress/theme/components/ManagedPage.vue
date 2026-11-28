<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from './cms-client';
import { usePlatform } from './platform-state';
import ArticleContent from './ArticleContent.vue';
import SyncStatus from './SyncStatus.vue';
import StackIcon from './StackIcon.vue';
import { DEFAULT_TECH_STACK, visibleTechStack } from '../../../../src/site-model.js';

const props = defineProps({ pageKey: { type: String, required: true } });
const post = ref(null), loading = ref(true), error = ref('');
const stackItems = ref(visibleTechStack(DEFAULT_TECH_STACK));

const { data: cf } = usePlatform('cf');
const { data: luogu } = usePlatform('luogu');

const CF_TIER = computed(() => {
  const r = Number(cf.value.rating) || 0;
  if (r >= 2400) return 'gm';
  if (r >= 2100) return 'master';
  if (r >= 1900) return 'cm';
  if (r >= 1600) return 'expert';
  if (r >= 1400) return 'specialist';
  if (r >= 1200) return 'pupil';
  return 'newbie';
});

const cfRankLabel = computed(() =>
  cf.value.rank ? String(cf.value.rank).replace(/\b\w/g, (c) => c.toUpperCase()) : 'Rated'
);

const LUOGU_COLORS = {
  Gray: { label: '灰名', hex: '#94a3b8' },
  Blue: { label: '蓝名', hex: '#3b82f6' },
  Green: { label: '绿名', hex: '#22a06b' },
  Orange: { label: '橙名', hex: '#ea7b2e' },
  Red: { label: '红名', hex: '#e14d58' },
  Purple: { label: '紫名', hex: '#9333ea' },
  Cheater: { label: '棕名', hex: '#8b5a2b' },
};

const luoguBadge = computed(() => LUOGU_COLORS[luogu.value.profile?.color] || null);
const totalSolved = computed(() => (Number(cf.value.solved) || 0) + (Number(luogu.value.solved) || 0));

// Hide legacy single-line external link seed on CF/Luogu pages since the Hero banner renders a richer CTA button.
const displayContent = computed(() => {
  const raw = String(post.value?.content || '').trim();
  if (!raw) return '';
  if (
    (props.pageKey === 'codeforces' || props.pageKey === 'luogu') &&
    /^\[[^\]]+\]\(https:\/\/(?:codeforces\.com|www\.luogu\.com\.cn)\/[^)]+\)$/.test(raw)
  ) {
    return '';
  }
  return post.value.content;
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    post.value = (await api('/api/pages/' + props.pageKey)).post;
    document.title = post.value.title + ' | Naiyael';
  } catch (e) {
    error.value = e.status === 404 ? '这篇内容暂不可见。' : e.message;
  } finally {
    loading.value = false;
  }
}

async function loadStack() {
  if (props.pageKey !== 'about') return;
  try {
    const d = await api('/api/tech-stack');
    if (Array.isArray(d.techStack)) stackItems.value = d.techStack;
  } catch {}
}

const isExternal = (link) => /^https?:\/\//i.test(link || '');

onMounted(() => {
  load();
  loadStack();
});
</script>

<template>
<section class="managed-page reading-page reading-outline-page" :class="'page-' + pageKey">
  <div v-if="loading" class="article-loading reading-skeleton" role="status" aria-label="正在加载页面">
    <span class="skeleton-bar w-24 h-4"></span>
    <span class="skeleton-bar w-48 h-8 mt-6"></span>
    <span class="skeleton-bar w-full h-4 mt-6"></span>
    <span class="skeleton-bar w-5/6 h-4 mt-3"></span>
    <span class="skeleton-bar w-full h-36 mt-7 rounded-lg"></span>
  </div>
  <div v-else-if="error" class="article-loading">
    <p class="cms-muted">{{ error }}</p>
    <button @click="load">重新加载</button>
  </div>
  <ArticleContent v-else :content="displayContent">
    <template #header>
      <a class="reading-back" href="/">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 8h-9M7.5 4l-4 4 4 4"/></svg>
        返回首页
      </a>

      <!-- About Page Hero -->
      <div v-if="pageKey === 'about'" class="managed-hero is-about">
        <div class="about-hero-avatar">
          <img src="/images/avatar.jpg" alt="Naiyael" width="92" height="92">
        </div>
        <div class="about-hero-main">
          <div class="about-hero-top">
            <h1>{{ post.title }}</h1>
            <span class="about-role-pill">ACMer · qiushan233</span>
          </div>
          <p v-if="post.excerpt" class="managed-hero-desc">{{ post.excerpt }}</p>
          <div class="about-hero-links">
            <a href="https://codeforces.com/profile/qiushan233" target="_blank" rel="noopener noreferrer" class="managed-action-pill is-cf">
              <span>Codeforces</span>
              <svg class="ui-ext-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg>
            </a>
            <a href="https://www.luogu.com.cn/user/1589332" target="_blank" rel="noopener noreferrer" class="managed-action-pill is-lg">
              <span>洛谷</span>
              <svg class="ui-ext-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg>
            </a>
            <a href="/journal.html" class="managed-action-pill">
              <span>文章归档</span>
              <svg class="ui-arrow-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg>
            </a>
          </div>
        </div>
      </div>

      <!-- Codeforces Page Hero -->
      <div v-else-if="pageKey === 'codeforces'" class="managed-hero is-oj is-cf" :class="'tier-' + CF_TIER">
        <div class="oj-hero-main">
          <div class="oj-hero-eyebrow">
            <span class="oj-hero-badge is-cf">CF</span>
            <span>CODEFORCES PROFILE</span>
            <span class="oj-hero-handle">{{ cf.handle || 'qiushan233' }}</span>
          </div>
          <div class="oj-hero-title-row">
            <h1>{{ post.title }}</h1>
            <span class="oj-hero-rank-pill">{{ cfRankLabel }} · {{ cf.rating }}</span>
          </div>
          <p v-if="post.excerpt" class="managed-hero-desc">{{ post.excerpt }}</p>
        </div>
        <div class="oj-hero-side">
          <a href="https://codeforces.com/profile/qiushan233" target="_blank" rel="noopener noreferrer" class="oj-hero-cta">
            <span>访问主页</span>
            <svg class="ui-ext-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg>
          </a>
          <SyncStatus platform="cf" />
        </div>
      </div>

      <!-- Luogu Page Hero -->
      <div v-else-if="pageKey === 'luogu'" class="managed-hero is-oj is-lg">
        <div class="oj-hero-main">
          <div class="oj-hero-eyebrow">
            <span class="oj-hero-badge is-lg">LG</span>
            <span>LUOGU PRACTICE</span>
            <span class="oj-hero-handle">UID 1589332</span>
          </div>
          <div class="oj-hero-title-row">
            <h1>{{ post.title }}</h1>
            <span v-if="luoguBadge" class="oj-lg-hero-pill" :style="{ '--lg-color': luoguBadge.hex }">
              <i aria-hidden="true"></i>{{ luoguBadge.label }}
            </span>
            <span v-if="luogu.profile?.gu" class="oj-lg-hero-pill is-metric">咕值 {{ luogu.profile.gu }}</span>
          </div>
          <p v-if="post.excerpt" class="managed-hero-desc">{{ post.excerpt }}</p>
        </div>
        <div class="oj-hero-side">
          <a href="https://www.luogu.com.cn/user/1589332" target="_blank" rel="noopener noreferrer" class="oj-hero-cta">
            <span>访问主页</span>
            <svg class="ui-ext-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg>
          </a>
          <SyncStatus platform="luogu" />
        </div>
      </div>

      <h1 v-else>{{ post.title }}</h1>
      <img v-if="post.cover" class="reading-cover" :src="post.cover" :alt="post.title">
    </template>

    <!-- Extra rich live showcase cards on About page -->
    <div v-if="pageKey === 'about'" class="about-showcase">
      <div class="about-panel">
        <header class="about-panel-head">
          <h3>实时算法档案</h3>
          <span class="about-panel-pill">{{ totalSolved }} AC</span>
        </header>
        <div class="about-oj-grid">
          <a href="/codeforces.html" class="about-oj-tile" :class="'tier-' + CF_TIER">
            <span class="about-oj-platform">Codeforces · {{ cf.handle || 'qiushan233' }}</span>
            <div class="about-oj-val">
              <strong>{{ cf.rating }}</strong>
              <span>{{ cfRankLabel }}</span>
            </div>
            <small>通过 {{ cf.solved }} 题 · 最高 *{{ cf.maxDifficulty }}</small>
          </a>
          <a href="/luogu.html" class="about-oj-tile is-lg">
            <span class="about-oj-platform">洛谷 · {{ luogu.handle || 'Naiyael' }}</span>
            <div class="about-oj-val">
              <strong>{{ luogu.solved }}</strong>
              <span v-if="luoguBadge" :style="{ color: luoguBadge.hex }">{{ luoguBadge.label }}</span>
            </div>
            <small>
              <template v-if="luogu.profile?.gu">咕值 {{ luogu.profile.gu }}</template>
              <template v-if="luogu.profile?.gu && luogu.profile?.elo"> · </template>
              <template v-if="luogu.profile?.elo">等级分 {{ luogu.profile.elo }}</template>
              <template v-if="!luogu.profile?.gu && !luogu.profile?.elo">尝试 {{ luogu.attempted }} 题</template>
            </small>
          </a>
        </div>
      </div>

      <div v-if="stackItems.length" class="about-panel">
        <header class="about-panel-head">
          <h3>常用语言与工具</h3>
          <span class="about-panel-pill">{{ stackItems.length }} 项</span>
        </header>
        <div class="about-stack-grid">
          <template v-for="item in stackItems" :key="item.id">
            <a
              v-if="item.link"
              class="about-stack-item is-link"
              :class="{ 'is-primary': item.primary }"
              :href="item.link"
              :target="isExternal(item.link) ? '_blank' : undefined"
              :rel="isExternal(item.link) ? 'noopener noreferrer' : undefined"
            >
              <StackIcon :icon="item.icon" :name="item.name" />
              <div><strong>{{ item.name }}</strong><small v-if="item.note">{{ item.note }}</small></div>
            </a>
            <div v-else class="about-stack-item" :class="{ 'is-primary': item.primary }">
              <StackIcon :icon="item.icon" :name="item.name" />
              <div><strong>{{ item.name }}</strong><small v-if="item.note">{{ item.note }}</small></div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <slot />
  </ArticleContent>
</section>
</template>
