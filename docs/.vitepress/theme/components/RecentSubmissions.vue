<script setup>
import{usePlatform}from'./platform-state';const{data}=usePlatform('cf');const verdict={OK:'AC',WRONG_ANSWER:'WA',TIME_LIMIT_EXCEEDED:'TLE',MEMORY_LIMIT_EXCEEDED:'MLE',RUNTIME_ERROR:'RE',COMPILATION_ERROR:'CE',TESTING:'评测中'};const date=s=>new Date(s).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
</script>
<template><div class="submission-list"><a v-for="s in (data.recentSubmissions||[]).slice(0,6)" :key="s.id" :href="s.url" target="_blank" rel="noopener noreferrer"><span class="submission-verdict" :class="{ok:s.verdict==='OK'}">{{verdict[s.verdict]||s.verdict}}</span><span><b>{{s.problemId}}</b> {{s.name}}</span><time>{{date(s.date)}}</time></a></div></template>

