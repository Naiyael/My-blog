<script setup>
import {ref,onMounted,onUnmounted,watch} from 'vue';
import {useRoute} from 'vitepress';
import {api} from './cms-client';
import {DEFAULT_NAVIGATION,visibleNavigation} from '../../../../src/site-model.js';
const route=useRoute(),root=ref(null),toggle=ref(null),measure=ref(null),navPanel=ref(null),compact=ref(false),mobileOpen=ref(false),items=ref(visibleNavigation(DEFAULT_NAVIGATION));
let timer,pending,resizeObserver;
async function refresh(){if(pending)return pending;pending=(async()=>{try{items.value=(await api('/api/site-settings')).navigation;}catch{}finally{pending=null;}})();return pending;}
function closeMenus(){mobileOpen.value=false;navPanel.value?.querySelectorAll('details[open]').forEach(el=>el.open=false);}
function outside(event){if(root.value&&!root.value.contains(event.target)&&!navPanel.value?.contains(event.target))closeMenus();}
function escape(event){if(event.key==='Escape'){closeMenus();toggle.value?.focus();}}
function visibleRefresh(){if(!document.hidden)refresh();}
function active(item){return item.children?item.children.some(active):item.link?.split('?')[0]===route.path;}
function measureLayout(){const available=root.value?.parentElement?.getBoundingClientRect().width||0;const preferred=measure.value?.getBoundingClientRect().width||0;compact.value=window.innerWidth<768||preferred>Math.max(0,available-245);}
watch(()=>route.path,closeMenus);
watch(items,measureLayout,{flush:'post'});watch(compact,closeMenus);
onMounted(()=>{refresh();measureLayout();resizeObserver=new ResizeObserver(measureLayout);if(root.value?.parentElement)resizeObserver.observe(root.value.parentElement);timer=setInterval(visibleRefresh,60000);document.addEventListener('click',outside);document.addEventListener('keydown',escape);document.addEventListener('visibilitychange',visibleRefresh);window.addEventListener('resize',measureLayout);window.addEventListener('site-navigation-updated',refresh);});
onUnmounted(()=>{clearInterval(timer);resizeObserver?.disconnect();document.removeEventListener('click',outside);document.removeEventListener('keydown',escape);document.removeEventListener('visibilitychange',visibleRefresh);window.removeEventListener('resize',measureLayout);window.removeEventListener('site-navigation-updated',refresh);});
</script>
<template>
<div class="site-nav" :class="{'is-compact':compact}" ref="root">
  <div ref="measure" class="site-nav-measure" aria-hidden="true"><span v-for="item in items" :key="item.id">{{item.text}}<i v-if="item.children">⌄</i><i v-else-if="item.newTab" class="site-nav-measure-ext"></i></span></div>
  <button ref="toggle" class="site-nav-toggle" @click="mobileOpen=!mobileOpen" :aria-expanded="mobileOpen" aria-controls="managed-main-nav" :aria-label="mobileOpen?'关闭导航菜单':'打开导航菜单'"><svg viewBox="0 0 20 20" aria-hidden="true"><path v-if="mobileOpen" d="m5 5 10 10M15 5 5 15"/><path v-else d="M3 5h14M3 10h14M3 15h14"/></svg></button>
  <Teleport to="body" :disabled="!compact"><nav ref="navPanel" id="managed-main-nav" class="site-nav-items" :class="{'is-open':mobileOpen,'is-compact':compact}" aria-label="主导航">
    <template v-for="item in items" :key="item.id">
      <details v-if="item.children" class="site-nav-dropdown"><summary :class="{active:active(item)}">{{item.text}} <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div class="site-nav-submenu"><a v-for="child in item.children" :key="child.id" :href="child.link" :target="child.newTab?'_blank':undefined" :rel="child.newTab?'noopener noreferrer':undefined" :class="{active:active(child)}" @click="closeMenus">{{child.text}}<svg v-if="child.newTab" class="site-nav-ext" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg></a></div></details>
      <a v-else :href="item.link" :target="item.newTab?'_blank':undefined" :rel="item.newTab?'noopener noreferrer':undefined" :class="{active:active(item)}" @click="closeMenus">{{item.text}}<svg v-if="item.newTab" class="site-nav-ext" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg></a>
    </template>
  </nav></Teleport>
</div>
</template>
