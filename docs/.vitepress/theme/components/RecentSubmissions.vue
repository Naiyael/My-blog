<script setup>
import { usePlatform } from './platform-state';

const { data } = usePlatform('cf');

const verdictMap = {
  OK: { label: 'AC', cls: 'is-ac' },
  WRONG_ANSWER: { label: 'WA', cls: 'is-wa' },
  TIME_LIMIT_EXCEEDED: { label: 'TLE', cls: 'is-tle' },
  MEMORY_LIMIT_EXCEEDED: { label: 'MLE', cls: 'is-tle' },
  RUNTIME_ERROR: { label: 'RE', cls: 'is-wa' },
  COMPILATION_ERROR: { label: 'CE', cls: 'is-other' },
  TESTING: { label: 'RUN', cls: 'is-other' },
};

const shortLang = (lang) => {
  const s = String(lang || '');
  if (/c\+\+23/i.test(s)) return 'C++23';
  if (/c\+\+20/i.test(s)) return 'C++20';
  if (/c\+\+17/i.test(s)) return 'C++17';
  if (/c\+\+/i.test(s)) return 'C++';
  if (/pypy/i.test(s)) return 'PyPy';
  if (/python/i.test(s)) return 'Python';
  if (/java/i.test(s)) return 'Java';
  if (/rust/i.test(s)) return 'Rust';
  return s.slice(0, 12);
};

const date = (s) =>
  new Date(s).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
</script>

<template>
<div class="submission-card">
  <div class="submission-list">
    <a
      v-for="s in (data.recentSubmissions || []).slice(0, 8)"
      :key="s.id"
      :href="s.url"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span class="submission-verdict" :class="(verdictMap[s.verdict] || { cls: 'is-other' }).cls">
        {{ (verdictMap[s.verdict] || { label: s.verdict }).label }}
      </span>
      <span class="submission-problem">
        <b>{{ s.problemId }}</b>
        <span>{{ s.name }}</span>
      </span>
      <span v-if="s.language" class="submission-lang">{{ shortLang(s.language) }}</span>
      <time>{{ date(s.date) }}</time>
    </a>
  </div>
</div>
</template>
