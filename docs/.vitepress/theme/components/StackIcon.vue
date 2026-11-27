<script>
export const STACK_ICON_PRESETS = [
  { key: 'cpp', label: 'C++', img: '/icons/tech/cplusplus.svg', match: ['c++', 'cpp', 'stl', 'g++', 'clang'] },
  { key: 'python', label: 'Python', img: '/icons/tech/python.svg', match: ['python', 'py', 'conda', 'pip'] },
  { key: 'c', label: 'C 语言', color: '#2b6cb0', monogram: 'C', match: ['c语言', 'gcc'] },
  { key: 'rust', label: 'Rust', color: '#c05621', monogram: 'Rs', match: ['rust', 'cargo'] },
  { key: 'go', label: 'Go', color: '#00a2c7', monogram: 'Go', match: ['golang', 'go'] },
  { key: 'java', label: 'Java', color: '#d96b27', monogram: 'Jv', match: ['java', 'spring', 'jvm'] },
  { key: 'js', label: 'JavaScript', color: '#ca8a04', monogram: 'JS', match: ['javascript', 'js'] },
  { key: 'ts', label: 'TypeScript', color: '#2563eb', monogram: 'TS', match: ['typescript', 'ts'] },
  { key: 'vue', label: 'Vue', color: '#16a374', kind: 'vue', match: ['vue', 'vitepress', 'nuxt'] },
  { key: 'react', label: 'React', color: '#0ea5c6', kind: 'react', match: ['react', 'next'] },
  { key: 'node', label: 'Node.js', color: '#2f855a', monogram: 'Nd', match: ['node', 'bun', 'deno', 'npm'] },
  { key: 'git', label: 'Git', img: '/icons/tech/git.svg', match: ['git'] },
  { key: 'github', label: 'GitHub', color: '#475569', kind: 'github', match: ['github', 'gitlab'] },
  { key: 'linux', label: 'Linux / 终端', color: '#7860a4', kind: 'terminal', match: ['linux', 'ubuntu', 'arch', 'wsl', 'bash', 'shell', 'zsh'] },
  { key: 'docker', label: 'Docker', color: '#0284c7', kind: 'docker', match: ['docker', 'k8s', 'kubernetes'] },
  { key: 'vscode', label: 'VS Code', img: '/icons/tech/vscode.svg', match: ['vscode', 'vs code'] },
  { key: 'jetbrains', label: 'CLion / IDE', color: '#9333ea', kind: 'ide', match: ['clion', 'jetbrains', 'pycharm', 'idea', 'ide'] },
  { key: 'vim', label: 'Vim / Neovim', color: '#15803d', kind: 'vim', match: ['vim', 'neovim', 'nvim'] },
  { key: 'cloudflare', label: 'Cloudflare', img: '/icons/tech/cloudflare.svg', match: ['cloudflare', 'workers', 'wrangler', 'd1'] },
  { key: 'database', label: '数据库 / SQL', color: '#0d7e92', kind: 'database', match: ['sql', 'sqlite', 'mysql', 'postgres', 'redis', 'mongo', 'db'] },
  { key: 'algorithm', label: '算法 / OJ', color: '#ac4d84', kind: 'algorithm', match: ['acm', 'algo', '算法', 'oi', 'cf', 'codeforces', 'luogu', '洛谷', 'cmake'] },
  { key: 'ai', label: 'AI / 机器学习', color: '#8b5cf6', kind: 'ai', match: ['ai', 'pytorch', 'torch', 'ml', 'llm', 'tensorflow', 'numpy'] },
  { key: 'code', label: '通用代码', color: '#087589', kind: 'code', match: [] },
];

const PRESET_MAP = Object.fromEntries(STACK_ICON_PRESETS.map((p) => [p.key, p]));

export function isPresetIconKey(icon) {
  return !!PRESET_MAP[icon];
}

export function suggestIconKey(name) {
  const lower = String(name || '').trim().toLowerCase();
  if (!lower) return 'code';
  if (lower === 'c') return 'c';
  for (const preset of STACK_ICON_PRESETS) {
    if (preset.match.some((kw) => lower === kw || (kw.length >= 2 && lower.includes(kw)))) {
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

const preset = computed(() => PRESET_MAP[props.icon] || null);
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
    :src="imageSrc"
    :alt="name"
    width="16"
    height="16"
    loading="lazy"
    decoding="async"
    @error="broken = true"
  />
  <span
    v-else-if="preset?.monogram"
    class="stack-icon-mono"
    :style="{ '--stack-brand': preset.color }"
    aria-hidden="true"
  >{{ preset.monogram }}</span>
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
    v-else-if="preset?.kind === 'vue'"
    class="stack-icon-svg"
    :style="{ color: preset.color }"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.55"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M2 3h2.6L8 9.2 11.4 3H14L8 13.5 2 3Z"/>
    <path d="M5.2 3 8 7.8 10.8 3"/>
  </svg>
  <svg
    v-else-if="preset?.kind === 'react'"
    class="stack-icon-svg"
    :style="{ color: preset.color }"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.35"
    aria-hidden="true"
  >
    <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/>
    <ellipse cx="8" cy="8" rx="6" ry="2.4"/>
    <ellipse cx="8" cy="8" rx="6" ry="2.4" transform="rotate(60 8 8)"/>
    <ellipse cx="8" cy="8" rx="6" ry="2.4" transform="rotate(120 8 8)"/>
  </svg>
  <svg
    v-else-if="preset?.kind === 'github'"
    class="stack-icon-svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M8 1.5a6.5 6.5 0 0 0-2.05 12.67c.32.06.44-.14.44-.31v-1.1c-1.8.39-2.18-.77-2.18-.77-.3-.75-.72-.95-.72-.95-.59-.4.04-.4.04-.4.65.05.99.67.99.67.58.99 1.52.7 1.89.54.06-.42.23-.7.41-.86-1.44-.16-2.95-.72-2.95-3.2 0-.71.25-1.29.67-1.74-.07-.16-.29-.82.06-1.71 0 0 .55-.18 1.8.67a6.2 6.2 0 0 1 3.28 0c1.25-.85 1.8-.67 1.8-.67.35.89.13 1.55.06 1.71.42.45.67 1.03.67 1.74 0 2.49-1.51 3.04-2.96 3.2.23.2.44.6.44 1.2v1.78c0 .17.12.37.45.31A6.5 6.5 0 0 0 8 1.5Z"/>
  </svg>
  <svg
    v-else-if="preset?.kind === 'docker'"
    class="stack-icon-svg"
    :style="{ color: preset.color }"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.45"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M2.2 8.5h11.6c-.4 3-2.5 4.7-6 4.7-3.4 0-5.4-1.6-5.6-4.7Z"/>
    <path d="M4.5 6.3h1.8v2.2H4.5zM6.9 6.3h1.8v2.2H6.9zM9.3 6.3h1.8v2.2H9.3zM6.9 4.1h1.8v2.2H6.9z"/>
  </svg>
  <svg
    v-else-if="preset?.kind === 'ide'"
    class="stack-icon-svg"
    :style="{ color: preset.color }"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.4"/>
    <path d="M5 10.8h4.2M5 6.2l1.8 1.4L5 9"/>
  </svg>
  <svg
    v-else-if="preset?.kind === 'vim'"
    class="stack-icon-svg"
    :style="{ color: preset.color }"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 3.2h3.4L6.4 9.5 11.4 3.2H13.5L6.2 13H4.6V4.5H3Z"/>
  </svg>
  <svg
    v-else-if="preset?.kind === 'database'"
    class="stack-icon-svg"
    :style="{ color: preset.color }"
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
    :style="{ color: preset.color }"
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
    :style="{ color: preset.color }"
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
