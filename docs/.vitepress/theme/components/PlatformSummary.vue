<script setup>
import { computed } from 'vue';
import { usePlatform } from './platform-state';

const props = defineProps({ platform: { type: String, default: 'cf' } });
const { data } = usePlatform(props.platform);

const cfTier = computed(() => {
  const r = Number(data.value.rating) || 0;
  if (r >= 2400) return 'gm';
  if (r >= 2100) return 'master';
  if (r >= 1900) return 'cm';
  if (r >= 1600) return 'expert';
  if (r >= 1400) return 'specialist';
  if (r >= 1200) return 'pupil';
  return 'newbie';
});

const maxDiffTier = computed(() => {
  const r = Number(data.value.maxDifficulty) || 0;
  if (r >= 2400) return 'gm';
  if (r >= 2100) return 'master';
  if (r >= 1900) return 'cm';
  if (r >= 1600) return 'expert';
  if (r >= 1400) return 'specialist';
  if (r >= 1200) return 'pupil';
  return 'newbie';
});

const passRate = computed(() => {
  const s = Number(data.value.solved) || 0;
  const a = Number(data.value.attempted) || 0;
  return a > 0 ? Math.min(100, Math.round((s / a) * 1000) / 10) + '%' : '—';
});
</script>

<template>
<div class="platform-kpi-grid" v-if="platform === 'cf'">
  <div class="platform-kpi-card" :class="'tier-' + cfTier">
    <span class="kpi-label">当前 Rating</span>
    <strong class="kpi-val is-tier">{{ data.rating }}</strong>
    <small>最高 {{ data.maxRating }}</small>
  </div>
  <div class="platform-kpi-card">
    <span class="kpi-label">通过题目</span>
    <strong class="kpi-val">{{ data.solved }}</strong>
    <small>{{ (data.history || []).length }} 场 Rated</small>
  </div>
  <div class="platform-kpi-card" :class="'tier-' + maxDiffTier">
    <span class="kpi-label">最高已解难度</span>
    <strong class="kpi-val is-tier">*{{ data.maxDifficulty }}</strong>
    <small>Codeforces 难度分</small>
  </div>
  <div class="platform-kpi-card is-lilac">
    <span class="kpi-label">累计提交</span>
    <strong class="kpi-val">{{ data.totalSubmissions }}</strong>
    <small>历史提交记录</small>
  </div>
</div>

<div class="platform-kpi-grid" v-else>
  <div class="platform-kpi-card">
    <span class="kpi-label">通过题目</span>
    <strong class="kpi-val">{{ data.solved }}</strong>
    <small>尝试 {{ data.attempted }} 题</small>
  </div>
  <div class="platform-kpi-card is-lilac">
    <span class="kpi-label">题目通过率</span>
    <strong class="kpi-val">{{ passRate }}</strong>
    <small>已 AC / 已尝试</small>
  </div>
  <div class="platform-kpi-card">
    <span class="kpi-label">当前咕值</span>
    <strong class="kpi-val">{{ data.profile?.gu ?? '—' }}</strong>
    <small v-if="data.profile?.ranking">全站 #{{ data.profile.ranking.toLocaleString('en-US') }}</small>
    <small v-else>洛谷综合活跃</small>
  </div>
  <div class="platform-kpi-card is-lilac">
    <span class="kpi-label">月赛等级分</span>
    <strong class="kpi-val">{{ data.profile?.elo ?? '—' }}</strong>
    <small>{{ data.profile?.elo ? '洛谷等级分' : '暂未参评' }}</small>
  </div>
</div>
</template>
