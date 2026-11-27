<script setup>
import { usePlatform } from './platform-state';
import SyncStatus from './SyncStatus.vue';
const props = defineProps({ platform: { type: String, default: 'cf' } });
const { data } = usePlatform(props.platform);
</script>
<template>
<div>
  <div class="platform-totals" v-if="platform==='cf'">
    <div><strong>{{ data.solved }}</strong><span>通过题目</span></div>
    <div><strong>{{ data.maxDifficulty }}</strong><span>最高已解难度</span></div>
    <div><strong>{{ data.totalSubmissions }}</strong><span>提交记录</span></div>
  </div>
  <div class="platform-totals" v-else>
    <div><strong>{{ data.solved }}</strong><span>通过题目</span></div>
    <div><strong>{{ data.attempted }}</strong><span>尝试题目</span></div>
    <div>
      <a class="ui-inline-link" href="https://www.luogu.com.cn/user/1589332" target="_blank" rel="noopener noreferrer">
        Naiyael<svg class="ui-ext-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg>
      </a>
      <span>洛谷主页</span>
    </div>
  </div>
  <SyncStatus :platform="platform" />
</div>
</template>
