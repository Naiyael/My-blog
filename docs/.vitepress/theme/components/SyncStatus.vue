<script setup>
import{computed}from'vue';import{usePlatform}from'./platform-state';const props=defineProps({platform:{type:String,default:'cf'}});const{data,busy,refresh}=usePlatform(props.platform);const stamp=computed(()=>data.value.syncedAt?new Date(data.value.syncedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'');
</script>
<template><div class="platform-sync" aria-live="polite"><span :class="{delayed:data.syncState==='delayed'}"><i></i>{{data.syncState==='delayed'?'更新暂缓':busy?'正在更新':'自动同步'}}<small v-if="stamp"> · {{stamp}}</small></span><button @click="refresh" :disabled="busy">{{busy?'更新中…':'刷新 ↻'}}</button></div></template>
