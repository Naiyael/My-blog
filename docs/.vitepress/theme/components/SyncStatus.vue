<script setup>
import { computed } from 'vue';
import { usePlatform } from './platform-state';
const props = defineProps({ platform: { type: String, default: 'cf' } });
const { data, busy, refresh } = usePlatform(props.platform);
const stamp = computed(() =>
  data.value.syncedAt
    ? new Date(data.value.syncedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''
);
</script>
<template>
<div class="platform-sync" aria-live="polite">
  <span :class="{delayed:data.syncState==='delayed'}"><i></i>{{ data.syncState==='delayed' ? '更新暂缓' : busy ? '正在更新' : '自动同步' }}<small v-if="stamp"> · {{ stamp }}</small></span>
  <button class="platform-sync-btn" @click="refresh" :disabled="busy">
    <svg class="ui-refresh-icon" :class="{'is-spinning':busy}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.2 8a5.2 5.2 0 1 1-1.35-3.5M13.2 2.8v2.7h-2.7"/></svg>
    <span>{{ busy ? '更新中…' : '刷新' }}</span>
  </button>
</div>
</template>
