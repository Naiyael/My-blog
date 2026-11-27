<script setup>
import { watch, onMounted } from 'vue';
import { useData } from 'vitepress';

const { isDark } = useData();

function syncThemeColor(dark) {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0d1829' : '#e8f5f9');
}

watch(isDark, syncThemeColor);
onMounted(() => syncThemeColor(isDark.value));

function toggleTheme(event) {
  const next = !isDark.value;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (typeof document === 'undefined' || !document.startViewTransition || reduced) {
    isDark.value = next;
    return;
  }
  const x = event?.clientX ?? window.innerWidth - 32;
  const y = event?.clientY ?? 32;
  const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  try {
    const transition = document.startViewTransition(() => {
      isDark.value = next;
    });
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
        },
        {
          duration: 380,
          easing: 'cubic-bezier(.22, 1, .36, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    }).catch(() => {});
  } catch {
    isDark.value = next;
  }
}
</script>

<template>
<button
  type="button"
  class="folio-theme-toggle"
  @click="toggleTheme"
  :aria-label="isDark ? '切换到浅色模式' : '切换到暗色毛玻璃模式'"
  :title="isDark ? '切换到浅色模式' : '切换到暗色毛玻璃模式'"
  :aria-pressed="isDark"
>
  <svg v-if="isDark" class="theme-icon-sun" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="10" cy="10" r="3.6"/>
    <path d="M10 2.2v1.6M10 16.2v1.6M2.2 10h1.6M16.2 10h1.6M4.5 4.5l1.1 1.1M14.4 14.4l1.1 1.1M15.5 4.5l-1.1 1.1M5.6 14.4l-1.1 1.1"/>
  </svg>
  <svg v-else class="theme-icon-moon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M16.2 12.1A6.5 6.5 0 0 1 7.9 3.8a6.8 6.8 0 1 0 8.3 8.3Z"/>
  </svg>
</button>
</template>
