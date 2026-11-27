<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { api } from './cms-client';
import StackIcon from './StackIcon.vue';
import { DEFAULT_TECH_STACK, visibleTechStack } from '../../../../src/site-model.js';

const items = ref(visibleTechStack(DEFAULT_TECH_STACK));
let pending = null;

async function refresh() {
  if (pending) return pending;
  pending = (async () => {
    try {
      const data = await api('/api/tech-stack');
      if (Array.isArray(data.techStack)) items.value = data.techStack;
    } catch {
      // Keep default/cached stack visible if offline.
    } finally {
      pending = null;
    }
  })();
  return pending;
}

function onVisible() {
  if (!document.hidden) refresh();
}

const isExternal = (link) => /^https?:\/\//i.test(link || '');

onMounted(() => {
  refresh();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('site-tech-stack-updated', refresh);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('site-tech-stack-updated', refresh);
});
</script>

<template>
<section v-if="items.length" class="stack-card" aria-label="常用技术栈">
  <header class="stack-card-head">
    <h2>常用栈</h2>
    <span>{{ items.length }} 项</span>
  </header>
  <ul class="stack-grid">
    <li v-for="item in items" :key="item.id">
      <a
        v-if="item.link"
        class="stack-chip is-link"
        :class="{ 'is-primary': item.primary }"
        :href="item.link"
        :target="isExternal(item.link) ? '_blank' : undefined"
        :rel="isExternal(item.link) ? 'noopener noreferrer' : undefined"
        :title="item.note ? `${item.name} · ${item.note}` : item.name"
      >
        <StackIcon :icon="item.icon" :name="item.name" />
        <span>{{ item.name }}</span>
      </a>
      <div
        v-else
        class="stack-chip"
        :class="{ 'is-primary': item.primary }"
        :title="item.note ? `${item.name} · ${item.note}` : item.name"
      >
        <StackIcon :icon="item.icon" :name="item.name" />
        <span>{{ item.name }}</span>
      </div>
    </li>
  </ul>
</section>
</template>
