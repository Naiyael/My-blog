<script setup>
import {ref,computed,watch} from 'vue';
import cf from '../../../../src/data/codeforces.json';
import { groups } from '../../../../src/data/luogu';
const props=defineProps({platform:{type:String,default:'cf'}});
const query=ref(''),selected=ref(''),page=ref(1);
const labels={'graphs':'图论','dp':'动态规划','greedy':'贪心','data structures':'数据结构','strings':'字符串','math':'数学','shortest paths':'最短路','binary search':'二分','two pointers':'双指针','dsu':'并查集','dfs and similar':'搜索','number theory':'数论','constructive algorithms':'构造','implementation':'模拟','brute force':'枚举','sortings':'排序'};
const tagOptions=['graphs','dp','data structures','greedy','math','strings','binary search','shortest paths','dsu'];
const luogu=groups.flatMap(g=>g.ids.map(id=>({id,group:g.name,color:g.color})));
const filtered=computed(()=>props.platform==='cf'?cf.problems.filter(p=>(!selected.value||p.tags.includes(selected.value))&&`${p.id} ${p.name} ${p.tags.join(' ')} ${p.tags.map(t=>labels[t]||t).join(' ')}`.toLowerCase().includes(query.value.trim().toLowerCase())):luogu.filter(p=>(!selected.value||p.group===selected.value)&&p.id.toLowerCase().includes(query.value.trim().toLowerCase())));
const size=computed(()=>props.platform==='cf'?10:30);
const totalPages=computed(()=>Math.max(1,Math.ceil(filtered.value.length/size.value)));
const visible=computed(()=>filtered.value.slice((page.value-1)*size.value,page.value*size.value));
watch([query,selected],()=>page.value=1);
const reset=()=>{query.value='';selected.value='';};
const url=p=>props.platform==='cf'?`https://codeforces.com/${p.gym?'gym':'contest'}/${p.contestId}/problem/${p.index}`:`https://www.luogu.com.cn/problem/${p.id}`;
</script>
<template>
<div class="archive-widget">
  <div class="archive-controls"><label class="archive-search"><span>⌕</span><input v-model="query" :aria-label="platform==='cf'?'搜索 Codeforces 题目':'搜索洛谷题号'" :placeholder="platform==='cf'?'搜索题号、题名或标签':'输入题号，如 P1196'"><button v-if="query" @click="query=''" aria-label="清除搜索">×</button></label><select v-model="selected" :aria-label="platform==='cf'?'按算法筛选':'按难度筛选'"><option value="">{{platform==='cf'?'全部算法':'全部难度'}}</option><template v-if="platform==='cf'"><option v-for="tag in tagOptions" :key="tag" :value="tag">{{labels[tag]}} · {{cf.tags[tag]}}</option></template><template v-else><option v-for="g in groups" :key="g.name" :value="g.name">{{g.name}} · {{g.ids.length}}</option></template></select></div>
  <div v-if="platform==='cf'" class="archive-topics"><button v-for="tag in tagOptions.slice(0,6)" :key="tag" :class="{active:selected===tag}" @click="selected=selected===tag?'':tag">{{labels[tag]}} <span>{{cf.tags[tag]}}</span></button></div>
  <div v-else class="luogu-legend"><span v-for="g in groups" :key="g.name"><i :style="{background:g.color}"></i>{{g.name}} <b>{{g.ids.length}}</b></span></div>
  <template v-if="visible.length"><div v-if="platform==='cf'" class="archive-rows"><div class="archive-row archive-head"><span>题目</span><span>标签</span><span>难度</span></div><a v-for="p in visible" :key="p.id" :href="url(p)" target="_blank" rel="noopener noreferrer" class="archive-row"><div><span class="archive-id">{{p.id}}</span><span class="archive-name">{{p.name}} <small v-if="p.gym">Gym</small></span></div><span class="archive-tags">{{p.tags.slice(0,2).map(t=>labels[t]||t).join(' / ')||'—'}}</span><span class="archive-rating" :class="{high:p.rating>=1900}">{{p.rating||'—'}} <span>↗</span></span></a></div><div class="luogu-problems" v-else><a v-for="p in visible" :key="p.id" :href="url(p)" :style="{'--difficulty':p.color}" target="_blank" rel="noopener noreferrer"><i></i>{{p.id}}<span>↗</span></a></div></template>
  <div class="archive-empty" v-else><p>没有匹配的题目。</p><button @click="reset">清除筛选</button></div>
  <div class="archive-footer"><span aria-live="polite">{{filtered.length}} 道题目</span><div><button :disabled="page===1" @click="page--" aria-label="上一页">←</button><span>{{page}} / {{totalPages}}</span><button :disabled="page===totalPages" @click="page++" aria-label="下一页">→</button></div></div>
</div>
</template>
