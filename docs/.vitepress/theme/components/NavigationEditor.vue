<script setup>
import {ref,computed,watch,onMounted,onUnmounted} from 'vue';
import {api} from './cms-client';
import {normalizeNavigation,canonicalCategory} from '../../../../src/site-model.js';
const props=defineProps({categories:{type:Array,default:()=>[]}}),emit=defineEmits(['dirty-change']);
const items=ref([]),version=ref(0),base=ref('[]'),ready=ref(false),busy=ref(false),error=ref(''),message=ref('');
const dirty=computed(()=>JSON.stringify(items.value)!==base.value);
const targets=computed(()=>[
  {label:'首页',link:'/'},{label:'全部文章',link:'/journal.html'},{label:'Codeforces 记录',link:'/codeforces.html'},{label:'洛谷记录',link:'/luogu.html'},{label:'日常',link:'/daily.html'},{label:'关于我',link:'/about.html'},
  ...props.categories.map(label=>({label:'分类 · '+label,link:'/journal.html?category='+encodeURIComponent(canonicalCategory(label))})),
]);
watch(dirty,value=>emit('dirty-change',value));
function accept(data){items.value=data.navigation;version.value=data.version;base.value=JSON.stringify(items.value);}
async function load(confirm=false){if(confirm&&dirty.value&&!window.confirm('放弃未保存的导航修改，重新加载吗？'))return;busy.value=true;try{accept(await api('/api/admin/navigation'));error.value='';}catch(e){error.value=e.message;}finally{busy.value=false;ready.value=true;}}
async function save(){if(busy.value)return;error.value='';message.value='';let navigation;try{navigation=normalizeNavigation(items.value);}catch(e){error.value=e.message;return;}busy.value=true;try{accept(await api('/api/admin/navigation',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({navigation,version:version.value})}));window.dispatchEvent(new Event('site-navigation-updated'));message.value='顶部导航已更新。当前页面立即生效，其他已打开页面将在一分钟内更新。';}catch(e){error.value=e.message;}finally{busy.value=false;}}
const newLink=()=>({id:crypto.randomUUID(),text:'新导航',link:'/journal.html',hidden:false,newTab:false});
function add(group=false){const item=newLink();if(group){item.text='新菜单';delete item.link;delete item.newTab;item.children=[newLink()];}items.value.push(item);}
function setType(item,value){if(value==='group'&&!item.children){delete item.link;delete item.newTab;item.children=[newLink()];}else if(value==='link'&&item.children){delete item.children;item.link='/journal.html';item.newTab=false;}}
function move(array,index,delta){const target=index+delta;if(target<0||target>=array.length)return;array.splice(target,0,array.splice(index,1)[0]);}
function selectTarget(item,event){if(event.target.value)item.link=event.target.value;event.target.value='';}
function shortcut(event){if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save();}}
onMounted(()=>{load();window.addEventListener('keydown',shortcut);});
onUnmounted(()=>{emit('dirty-change',false);window.removeEventListener('keydown',shortcut);});
</script>
<template>
<section class="cms-navigation-editor">
  <div class="cms-navigation-heading"><div><h2>顶部导航</h2><p>修改网站顶部的名称、顺序和跳转位置；支持一级下拉菜单。</p></div><div><span :class="{'is-dirty':dirty}">{{dirty?'有未保存的修改':'已保存'}}</span><button @click="load(true)" :disabled="busy">重新加载</button><button class="cms-primary" @click="save" :disabled="busy||!ready">{{busy?'处理中…':'保存导航'}}</button></div></div>
  <p v-if="error" role="alert" class="cms-error cms-notification">{{error}}</p><p v-if="message" role="status" class="cms-notification">{{message}}</p>
  <p v-if="!ready" class="cms-muted">正在加载导航…</p>
  <template v-else>
    <div class="cms-nav-preview"><span>导航预览</span><div><template v-for="item in items.filter(item=>!item.hidden)" :key="item.id"><details v-if="item.children"><summary>{{item.text||'未命名'}} ⌄</summary><div><span v-for="child in item.children.filter(c=>!c.hidden)" :key="child.id">{{child.text||'未命名'}}</span></div></details><span v-else>{{item.text||'未命名'}}<small v-if="item.newTab">↗</small></span></template><em v-if="!items.some(item=>!item.hidden)">暂无显示的导航项目</em></div></div>
    <fieldset :disabled="busy" class="cms-fields">
      <p v-if="!items.length" class="cms-muted">还没有导航项目，可以添加链接或下拉菜单。</p>
      <section v-for="(item,index) in items" :key="item.id" class="cms-nav-row" :class="{'is-hidden':item.hidden}">
        <div class="cms-nav-row-heading"><strong>{{index+1}} <span>{{item.text||'未命名导航'}}</span></strong><div><button @click="move(items,index,-1)" :disabled="index===0" :aria-label="`上移第 ${index+1} 项`">↑</button><button @click="move(items,index,1)" :disabled="index===items.length-1" :aria-label="`下移第 ${index+1} 项`">↓</button><button @click="items.splice(index,1)" class="cms-danger-text" :aria-label="`移除第 ${index+1} 项`">移除</button></div></div>
        <div class="cms-nav-row-fields"><label class="cms-field"><span>显示名称</span><input v-model="item.text" maxlength="24" :aria-label="`第 ${index+1} 项名称`"></label><label class="cms-field"><span>类型</span><select :value="item.children?'group':'link'" @change="setType(item,$event.target.value)" :aria-label="`第 ${index+1} 项类型`"><option value="link">直接链接</option><option value="group">下拉菜单</option></select></label><label class="cms-nav-checkbox"><input type="checkbox" v-model="item.hidden" :aria-label="`隐藏第 ${index+1} 项`">隐藏此项</label></div>
        <template v-if="!item.children"><div class="cms-nav-link-fields"><label class="cms-field"><span>链接地址</span><input v-model="item.link" maxlength="500" placeholder="/journal.html 或 https://example.com" :aria-label="`第 ${index+1} 项链接`"></label><label class="cms-field"><span>选择站内页面或分类</span><select value="" @change="selectTarget(item,$event)" :aria-label="`第 ${index+1} 项快捷目标`"><option value="">选择后填入链接</option><option v-for="target in targets" :key="target.label" :value="target.link">{{target.label}}</option></select></label></div><label class="cms-nav-checkbox"><input type="checkbox" v-model="item.newTab" :aria-label="`第 ${index+1} 项在新标签页打开`">在新标签页打开</label></template>
        <div v-else class="cms-nav-children"><section v-for="(child,childIndex) in item.children" :key="child.id" class="cms-nav-child"><div class="cms-nav-row-heading"><strong>子项目 {{childIndex+1}}</strong><div><button @click="move(item.children,childIndex,-1)" :disabled="childIndex===0" :aria-label="`上移第 ${index+1} 项的子项目 ${childIndex+1}`">↑</button><button @click="move(item.children,childIndex,1)" :disabled="childIndex===item.children.length-1" :aria-label="`下移第 ${index+1} 项的子项目 ${childIndex+1}`">↓</button><button @click="item.children.splice(childIndex,1)" :aria-label="`移除第 ${index+1} 项的子项目 ${childIndex+1}`">移除</button></div></div><div class="cms-nav-link-fields"><label class="cms-field"><span>显示名称</span><input v-model="child.text" maxlength="24" :aria-label="`第 ${index+1} 项子项目 ${childIndex+1} 名称`"></label><label class="cms-field"><span>链接地址</span><input v-model="child.link" maxlength="500" :aria-label="`第 ${index+1} 项子项目 ${childIndex+1} 链接`"></label><label class="cms-field"><span>站内快捷目标</span><select value="" @change="selectTarget(child,$event)" :aria-label="`第 ${index+1} 项子项目 ${childIndex+1} 快捷目标`"><option value="">选择后填入链接</option><option v-for="target in targets" :key="target.label" :value="target.link">{{target.label}}</option></select></label></div><div class="cms-nav-child-options"><label class="cms-nav-checkbox"><input type="checkbox" v-model="child.hidden">隐藏子项目</label><label class="cms-nav-checkbox"><input type="checkbox" v-model="child.newTab">在新标签页打开</label></div></section><button @click="item.children.push(newLink())" :disabled="item.children.length>=12" class="cms-add-link">＋ 添加子项目</button></div>
      </section>
      <div class="cms-nav-add-actions"><button @click="add(false)" :disabled="items.length>=12">＋ 添加链接</button><button @click="add(true)" :disabled="items.length>=12">＋ 添加下拉菜单</button><small>调整后点击“保存导航”生效；移除导航入口不会删除文章。</small></div>
    </fieldset>
  </template>
</section>
</template>
