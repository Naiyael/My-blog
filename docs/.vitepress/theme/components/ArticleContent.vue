<script setup>
import {ref,computed,watch,onMounted,onUnmounted,nextTick} from 'vue';
import {renderMarkdownDocument,headingSlug} from './cms-client';
const props=defineProps({content:{type:String,default:''},compact:{type:Boolean,default:false}});
const documentData=computed(()=>renderMarkdownDocument(props.content));
const body=ref(null),headings=ref([]),active=ref(''),mobileToc=ref(null),desktopToc=ref(null),progress=ref(0);
const minLevel=computed(()=>headings.value.length?Math.min(...headings.value.map(item=>item.level)):1);
let observer,collectFrame=0,scrollFrame=0,initialHashApplied=false,mounted=false;
const copyTimers=new WeakMap();
function titleOf(element){const clone=element.cloneNode(true);clone.querySelectorAll('.header-anchor').forEach(node=>node.remove());clone.querySelectorAll('img').forEach(node=>node.replaceWith(document.createTextNode(node.alt)));return clone.textContent.replace(/\s+/g,' ').trim();}
function collect(){
  if(!body.value)return;const ids=new Set(),entries=[];
  body.value.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(element=>{const title=titleOf(element);if(!title)return;const base=element.id||headingSlug(title);let id=base,suffix=2;while(ids.has(id))id=base+'-'+suffix++;ids.add(id);if(element.id!==id)element.id=id;entries.push({id,title,level:Number(element.tagName.slice(1))});});
  if(JSON.stringify(entries)!==JSON.stringify(headings.value))headings.value=entries;
  updateActive();if(!initialHashApplied&&entries.length){initialHashApplied=true;followHash();}
}
function scheduleCollect(){cancelAnimationFrame(collectFrame);collectFrame=requestAnimationFrame(collect);}
function updateProgress(){
  if(props.compact||typeof window==='undefined')return;
  const max=document.documentElement.scrollHeight-window.innerHeight;
  progress.value=max>40?Math.min(1,Math.max(0,window.scrollY/max)):0;
}
function updateActive(){
  scrollFrame=0;updateProgress();if(!body.value||!headings.value.length)return;let id=headings.value[0].id;
  for(const heading of headings.value){const element=body.value.querySelector('[id="'+CSS.escape(heading.id)+'"]');if(element?.getBoundingClientRect().top<=120)id=heading.id;else break;}
  active.value=id;
}
function onScroll(){if(!scrollFrame)scrollFrame=requestAnimationFrame(updateActive);}
function elementFor(id){return body.value?.querySelector('[id="'+CSS.escape(id)+'"]');}
function jump(heading){
  const target=elementFor(heading.id);if(!target)return;if(mobileToc.value)mobileToc.value.open=false;
  history.replaceState(history.state,'',location.pathname+location.search+'#'+encodeURIComponent(heading.id));active.value=heading.id;
  nextTick(()=>{target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});});
}
function followHash(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=elementFor(id);if(target){active.value=id;nextTick(()=>target.scrollIntoView({block:'start',behavior:'auto'}));}}
function indent(heading){return {'--toc-level':Math.max(0,heading.level-minLevel.value)};}
async function copyText(text){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
  const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.cssText='position:fixed;opacity:0;pointer-events:none';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
}
async function onProseClick(event){
  const button=event.target.closest?.('.code-copy-btn');if(!button)return;
  const code=button.closest('.code-block')?.querySelector('code')?.textContent;if(code==null)return;
  const label=button.querySelector('span');
  try{
    await copyText(code);
    button.classList.add('is-copied');if(label)label.textContent='已复制';
    clearTimeout(copyTimers.get(button));
    copyTimers.set(button,setTimeout(()=>{button.classList.remove('is-copied');if(label)label.textContent='复制';},1800));
  }catch{if(label)label.textContent='复制失败';}
}
watch(()=>props.content,()=>{if(mounted){initialHashApplied=false;nextTick(scheduleCollect);}},{flush:'post'});
watch(active,()=>nextTick(()=>{const list=desktopToc.value?.querySelector('ol'),link=list?.querySelector('.is-active');if(!list||!link)return;const bounds=list.getBoundingClientRect(),entry=link.getBoundingClientRect();if(entry.top<bounds.top)list.scrollTop+=entry.top-bounds.top-8;else if(entry.bottom>bounds.bottom)list.scrollTop+=entry.bottom-bounds.bottom+8;}));
onMounted(()=>{mounted=true;collect();observer=new MutationObserver(scheduleCollect);observer.observe(body.value,{childList:true,subtree:true,characterData:true});window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',onScroll);window.addEventListener('hashchange',followHash);});
onUnmounted(()=>{mounted=false;observer?.disconnect();cancelAnimationFrame(collectFrame);cancelAnimationFrame(scrollFrame);window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll);window.removeEventListener('hashchange',followHash);});
</script>
<template>
<div class="article-reader" :class="{'has-outline':headings.length,'is-compact':compact}">
  <div v-if="!compact&&progress>0.004" class="reading-progress" aria-hidden="true"><span :style="{transform:`scaleX(${progress})`}"></span></div>
  <div class="article-main">
    <header v-if="$slots.header" class="article-header"><slot name="header" /></header>
    <details v-if="headings.length" ref="mobileToc" class="article-toc-mobile"><summary><span>本文目录</span><small>{{headings.length}} 个标题</small><svg class="article-toc-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><nav aria-label="文章目录"><ol><li v-for="heading in headings" :key="heading.id" :style="indent(heading)"><a :href="'#'+encodeURIComponent(heading.id)" :class="{'is-active':active===heading.id}" :aria-current="active===heading.id?'location':undefined" @click.prevent="jump(heading)">{{heading.title}}</a></li></ol></nav></details>
    <div ref="body" class="article-prose" @click="onProseClick"><div class="vp-doc reading-body" v-html="documentData.html"></div><div v-if="$slots.default" class="vp-doc article-extra-body"><slot /></div></div>
    <footer v-if="$slots.footer" class="article-footer"><slot name="footer" /></footer>
  </div>
  <aside v-if="headings.length&&!compact" ref="desktopToc" class="article-toc-desktop"><nav class="article-toc-card" aria-label="文章目录"><header><strong>本文目录</strong><span>{{headings.length}}</span></header><ol><li v-for="heading in headings" :key="heading.id" :style="indent(heading)"><a :href="'#'+encodeURIComponent(heading.id)" :class="{'is-active':active===heading.id}" :aria-current="active===heading.id?'location':undefined" @click.prevent="jump(heading)">{{heading.title}}</a></li></ol><span class="article-toc-note">随阅读定位到当前章节</span></nav></aside>
</div>
</template>
