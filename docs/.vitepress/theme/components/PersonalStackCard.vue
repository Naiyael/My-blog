<script setup>
const STACK_ITEMS = [
  { name: 'C++', note: '主力 · 算法', icon: '/icons/tech/cplusplus.svg', primary: true },
  { name: 'Python', note: '脚本 · 工具', icon: '/icons/tech/python.svg', primary: true },
  { name: 'Git', note: '版本管理', icon: '/icons/tech/git.svg' },
  { name: 'Linux', note: '开发环境', svg: 'terminal' },
  { name: 'VS Code', note: '主力编辑器', icon: '/icons/tech/vscode.svg' },
  { name: 'Cloudflare', note: '边缘部署', icon: '/icons/tech/cloudflare.svg' },
];
</script>

<template>
<section class="stack-card" aria-label="常用技术栈">
  <header class="stack-card-head">
    <h2>常用栈</h2>
    <span>{{ STACK_ITEMS.length }} 项</span>
  </header>
  <ul class="stack-grid">
    <li v-for="item in STACK_ITEMS" :key="item.name" class="stack-chip" :class="{ 'is-primary': item.primary }" :title="`${item.name} · ${item.note}`">
      <img v-if="item.icon" :src="item.icon" :alt="item.name" width="16" height="16" loading="lazy" decoding="async" />
      <svg v-else class="stack-terminal-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="2.75" width="12" height="10.5" rx="2"/>
        <path d="m5 6.5 2 1.75L5 10M8.5 10h2.5"/>
      </svg>
      <span>{{ item.name }}</span>
    </li>
  </ul>
</section>
</template>
