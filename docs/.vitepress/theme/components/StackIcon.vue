<script>
import catalog from '../../../../src/data/stack-icons.json';
import { resolveStackIconKey } from '../../../../src/site-model.js';

export const STACK_ICON_CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'lang', label: '编程语言' },
  { key: 'frontend', label: '前端与移动' },
  { key: 'backend', label: '后端与框架' },
  { key: 'data', label: '数据库与消息' },
  { key: 'ai', label: 'AI 与图形' },
  { key: 'cloud', label: '云与运维' },
  { key: 'tools', label: '工具与 IDE' },
  { key: 'os', label: '系统与硬件' },
  { key: 'general', label: '通用' },
];

export const STACK_ICON_PRESETS = catalog;

const PRESET_MAP = Object.fromEntries(STACK_ICON_PRESETS.map((p) => [p.key, p]));

export function isPresetIconKey(icon) {
  return !!PRESET_MAP[resolveStackIconKey(icon)];
}

export function getPresetMeta(icon) {
  return PRESET_MAP[resolveStackIconKey(icon)] || null;
}

export function suggestIconKey(name) {
  const lower = String(name || '').trim().toLowerCase();
  if (!lower) return 'code';
  if (lower === 'c') return 'c';
  if (lower === 'r') return 'r';
  // First pass: exact key, label, or alias match
  for (const preset of STACK_ICON_PRESETS) {
    if (
      preset.key === lower ||
      preset.label.toLowerCase() === lower ||
      (Array.isArray(preset.match) && preset.match.some((kw) => kw.toLowerCase() === lower))
    ) {
      return preset.key;
    }
  }
  // Second pass: substring match on aliases >= 2 chars
  for (const preset of STACK_ICON_PRESETS) {
    if (
      (preset.key.length >= 2 && lower.includes(preset.key)) ||
      (Array.isArray(preset.match) && preset.match.some((kw) => kw.length >= 2 && lower.includes(kw.toLowerCase())))
    ) {
      return preset.key;
    }
  }
  return 'code';
}
</script>

<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  icon: { type: String, default: 'code' },
  name: { type: String, default: '' },
});

const broken = ref(false);
watch(() => props.icon, () => { broken.value = false; });

const preset = computed(() => getPresetMeta(props.icon));
const imageSrc = computed(() => {
  if (broken.value) return '';
  if (preset.value?.img) return preset.value.img;
  if (!preset.value && props.icon && (props.icon.startsWith('https://') || props.icon.startsWith('/'))) {
    return props.icon;
  }
  return '';
});
</script>

<template>
  <img
    v-if="imageSrc"
    class="stack-icon-img"
    :class="{ 'is-mono-icon': !!preset?.mono }"
    :src="imageSrc"
    :alt="name"
    width="16"
    height="16"
    loading="lazy"
    decoding="async"
    @error="broken = true"
  />
  <svg
    v-else-if="preset?.kind === 'terminal'"
    class="stack-icon-svg"
    :style="{ color: 'var(--folio-violet)' }"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="2.75" width="12" height="10.5" rx="2"/>
    <path d="m5 6.5 2 1.75L5 10M8.5 10h2.5"/>
  </svg>
  <svg
    v-else-if="preset?.kind === 'database'"
    class="stack-icon-svg"
    :style="{ color: '#0d7e92' }"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <ellipse cx="8" cy="4.2" rx="4.8" ry="1.8"/>
    <path d="M3.2 4.2v7.6c0 1 2.15 1.8 4.8 1.8s4.8-.8 4.8-1.8V4.2"/>
    <path d="M3.2 8c0 1 2.15 1.8 4.8 1.8s4.8-.8 4.8-1.8"/>
  </svg>
  <svg
    v-else-if="preset?.kind === 'algorithm'"
    class="stack-icon-svg"
    :style="{ color: 'var(--folio-rose)' }"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="8" cy="3.5" r="1.6"/>
    <circle cx="3.6" cy="12" r="1.6"/>
    <circle cx="12.4" cy="12" r="1.6"/>
    <path d="M7.1 4.9 4.4 10.5M8.9 4.9l2.7 5.6M5.2 12h5.6"/>
  </svg>
  <svg
    v-else-if="preset?.kind === 'ai'"
    class="stack-icon-svg"
    :style="{ color: 'var(--folio-violet)' }"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M8 2.2 9.4 6.2 13.5 7.5 9.4 8.8 8 12.8 6.6 8.8 2.5 7.5 6.6 6.2Z"/>
    <circle cx="12.5" cy="3.3" r=".9" fill="currentColor" stroke="none"/>
  </svg>
  <svg
    v-else
    class="stack-icon-svg"
    :style="{ color: 'var(--folio-accent)' }"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="m5.5 4.5-3.2 3.5 3.2 3.5M10.5 4.5l3.2 3.5-3.2 3.5M9 3.5 7 12.5"/>
  </svg>
</template>
