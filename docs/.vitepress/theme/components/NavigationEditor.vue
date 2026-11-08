<script setup>
import {ref,computed,watch,onMounted,onUnmounted,nextTick} from 'vue';
import {api} from './cms-client';
import {normalizeNavigation,canonicalCategory} from '../../../../src/site-model.js';
import {reorderNavigation} from '../../../../src/navigation-order.js';
const props=defineProps({categories:{type:Array,default:()=>[]}}),emit=defineEmits(['dirty-change']);
const items=ref([]),version=ref(0),ready=ref(false),busy=ref(false),error=ref(''),message=ref('');
const draft=ref(null),draftBase=ref(''),dialog=ref(null),nameInput=ref(null),childEditing=ref(''),removing=ref(false);
const dirty=computed(()=>!!draft.value&&JSON.stringify(draft.value)!==draftBase.value);
const isNew=computed(()=>!!draft.value&&!items.value.some(item=>item.id===draft.value.id));
const visible=computed(()=>items.value.filter(item=>!item.hidden&&(!item.children||item.children.some(child=>!child.hidden))));
const targets=computed(()=>[
  {label:'首页',link:'/'},{label:'全部文章',link:'/journal.html'},{label:'Codeforces 记录',link:'/codeforces.html'},{label:'洛谷记录',link:'/luogu.html'},{label:'日常',link:'/daily.html'},{label:'关于我',link:'/about.html'},
  ...props.categories.map(label=>({label:'分类 · '+label,link:'/journal.html?category='+encodeURIComponent(canonicalCategory(label))})),
]);
watch([dirty,busy],()=>emit('dirty-change',dirty.value||busy.value));
const clone=value=>JSON.parse(JSON.stringify(value));
const newLink=()=>({id:crypto.randomUUID(),text:'',link:'/journal.html',hidden:false,newTab:false});
function accept(data){items.value=data.navigation;version.value=data.version;}
async function load(){if(busy.value)return;busy.value=true;try{accept(await api('/api/admin/navigation'));error.value='';}catch(e){error.value=e.message;}finally{busy.value=false;ready.value=true;}}
async function persist(candidate,text){
  if(busy.value)return false;let navigation;try{navigation=normalizeNavigation(candidate);}catch(e){error.value=e.message;return false;}
  busy.value=true;error.value='';message.value='';
  try{accept(await api('/api/admin/navigation',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({navigation,version:version.value})}));window.dispatchEvent(new Event('site-navigation-updated'));message.value=text;return true;}
  catch(e){error.value=e.message;return false;}finally{busy.value=false;}
}
function edit(item=null,childId=''){
  if(busy.value)return;draft.value=item?clone(item):newLink();draftBase.value=JSON.stringify(draft.value);childEditing.value=childId;removing.value=false;error.value='';
  nextTick(()=>{dialog.value.showModal();nameInput.value?.focus();});
}
function close(force=false){if(!force&&(busy.value||dirty.value&&!window.confirm('导航修改尚未保存，确定放弃吗？')))return;dialog.value?.close();draft.value=null;draftBase.value='';removing.value=false;error.value='';}
function setType(value){if(value==='group'&&!draft.value.children){delete draft.value.link;delete draft.value.newTab;draft.value.children=[{...newLink(),text:'新链接'}];childEditing.value=draft.value.children[0].id;}else if(value==='link'&&draft.value.children){delete draft.value.children;draft.value.link='/journal.html';draft.value.newTab=false;childEditing.value='';}}
function selectTarget(item,event){if(event.target.value)item.link=event.target.value;event.target.value='';}
async function saveItem(){if(!draft.value||busy.value)return;const candidate=clone(items.value),index=candidate.findIndex(item=>item.id===draft.value.id);if(index<0)candidate.push(clone(draft.value));else candidate[index]=clone(draft.value);if(await persist(candidate,'导航已保存，网站顶部已更新。'))close(true);}
async function removeItem(){if(!draft.value||busy.value)return;if(await persist(items.value.filter(item=>item.id!==draft.value.id),'导航入口已移除，文章内容保留。'))close(true);}
function addChild(){if(draft.value.children.length>=12)return;const child=newLink();draft.value.children.push(child);childEditing.value=child.id;}
function removeChild(id){draft.value.children=draft.value.children.filter(item=>item.id!==id);if(childEditing.value===id)childEditing.value='';}
async function keyboardMove(item,step,scope='top'){
  if(busy.value)return;const list=scope==='top'?items.value:draft.value.children,index=list.findIndex(value=>value.id===item.id),target=list[index+step];if(!target)return;
  const next=reorderNavigation(list,item.id,target.id,step<0?'before':'after');
  if(scope==='child')draft.value.children=next;else{await persist(next,'导航顺序已自动保存。');await nextTick();document.querySelector(`[data-nav-card="${item.id}"] .cms-nav-card-main`)?.focus();}
}
const drag=ref(null),drop=ref(null),point=ref({x:0,y:0});let pointer=null,suppressUntil=0,scrollFrame=0;
const dragTitle=computed(()=>{const list=drag.value?.scope==='child'?draft.value?.children:items.value;return list?.find(item=>item.id===drag.value?.id)?.text||'未命名导航';});
const ghostStyle=computed(()=>({left:Math.max(8,Math.min(point.value.x+14,window.innerWidth-260))+'px',top:Math.max(8,Math.min(point.value.y+14,window.innerHeight-80))+'px'}));
function startDrag(event,item,scope='top',handle=false){if(busy.value||event.button!==0||event.pointerType==='touch'&&!handle)return;if(!handle&&!event.target.closest('.cms-nav-card-main'))return;pointer={id:item.id,scope,pointerId:event.pointerId,x:event.clientX,y:event.clientY,element:event.currentTarget.closest(scope==='top'?'[data-nav-card]':'[data-nav-child]')};}
function updateDrop(x,y){const selector=drag.value.scope==='top'?'[data-nav-card]':'[data-nav-child]',element=document.elementFromPoint(x,y)?.closest(selector),id=element?.getAttribute(drag.value.scope==='top'?'data-nav-card':'data-nav-child');if(!id||id===drag.value.id){drop.value=null;return;}const rect=element.getBoundingClientRect(),single=drag.value.scope==='child'||element.parentElement.clientWidth<rect.width*1.5;drop.value={id,side:(single?y<rect.top+rect.height/2:x<rect.left+rect.width/2)?'before':'after'};}
function scrollDrag(){if(!drag.value){scrollFrame=0;return;}if(drag.value.scope==='top'){const y=point.value.y;if(y<90||y>innerHeight-90){window.scrollBy(0,y<90?-12:12);updateDrop(point.value.x,y);}}scrollFrame=requestAnimationFrame(scrollDrag);}
function movePointer(event){if(!pointer||event.pointerId!==pointer.pointerId)return;if(!drag.value&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)<8)return;if(!drag.value){drag.value={id:pointer.id,scope:pointer.scope};pointer.element.setPointerCapture(event.pointerId);document.documentElement.classList.add('cms-card-dragging');scrollFrame=requestAnimationFrame(scrollDrag);}event.preventDefault();point.value={x:event.clientX,y:event.clientY};updateDrop(event.clientX,event.clientY);}
function cancelDrag(){if(pointer?.element?.hasPointerCapture(pointer.pointerId))pointer.element.releasePointerCapture(pointer.pointerId);pointer=null;drag.value=null;drop.value=null;cancelAnimationFrame(scrollFrame);document.documentElement.classList.remove('cms-card-dragging');}
async function endPointer(event){if(!pointer||event.pointerId!==pointer.pointerId)return;if(!drag.value){cancelDrag();return;}updateDrop(event.clientX,event.clientY);const source=drag.value,target=drop.value;suppressUntil=Date.now()+500;cancelDrag();if(!target)return;const next=reorderNavigation(source.scope==='top'?items.value:draft.value.children,source.id,target.id,target.side);if(source.scope==='child')draft.value.children=next;else await persist(next,'导航顺序已自动保存。');}
function captureClick(event){if(Date.now()<suppressUntil){event.preventDefault();event.stopPropagation();}}
function shortcut(event){if(event.key==='Escape'&&drag.value){event.preventDefault();suppressUntil=Date.now()+500;cancelDrag();}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();if(draft.value&&!removing.value)saveItem();else if(!draft.value)message.value='拖动后的导航顺序会自动保存。';}}
onMounted(()=>{load();window.addEventListener('keydown',shortcut);document.addEventListener('pointermove',movePointer,{passive:false});document.addEventListener('pointerup',endPointer);document.addEventListener('pointercancel',cancelDrag);});
onUnmounted(()=>{cancelDrag();emit('dirty-change',false);window.removeEventListener('keydown',shortcut);document.removeEventListener('pointermove',movePointer);document.removeEventListener('pointerup',endPointer);document.removeEventListener('pointercancel',cancelDrag);});
</script>
<template>
<section class="cms-navigation-library">
  <header class="cms-nav-library-heading"><div><h2>顶部导航 <small>{{items.length}} 项</small></h2><p>点击卡片编辑，拖动调整顺序 · 松手自动保存。</p></div><button @click="load" :disabled="busy">{{busy?'保存 / 加载中…':'刷新导航'}}</button></header>
  <p v-if="error&&!draft" class="cms-error cms-notification" role="alert">{{error}}</p><p v-if="message&&!draft" class="cms-notification" role="status">✓ {{message}}</p>
  <p v-if="!ready" class="cms-muted">正在加载导航…</p>
  <template v-else>
    <div class="cms-nav-live-preview"><span>当前导航</span><nav aria-label="导航预览"><template v-for="item in visible" :key="item.id"><details v-if="item.children"><summary>{{item.text}} <span>⌄</span></summary><div><button v-for="child in item.children.filter(value=>!value.hidden)" :key="child.id" @click="edit(item,child.id)">{{child.text}}</button></div></details><button v-else @click="edit(item)">{{item.text}}<small v-if="item.newTab">↗</small></button></template><em v-if="!visible.length">还没有显示中的导航</em></nav></div>
    <p class="cms-sr-only" id="nav-card-help">点击编辑；拖动排序，或使用 Alt 加上下方向键。顺序自动保存。</p>
    <div class="cms-nav-card-grid">
      <button class="cms-create-card cms-nav-create" @click="edit()" :disabled="busy||items.length>=12" aria-label="新增导航"><span class="cms-create-plus" aria-hidden="true">＋</span><strong>添加导航</strong><span>{{items.length>=12?'已达到 12 项上限':'链接，或一个下拉菜单'}}</span></button>
      <article v-for="(item,index) in items" :key="item.id" class="cms-nav-card" :data-nav-card="item.id" :class="{'is-hidden':item.hidden,'is-dragging':drag?.scope==='top'&&drag.id===item.id,'is-drop-before':drag?.scope==='top'&&drop?.id===item.id&&drop.side==='before','is-drop-after':drag?.scope==='top'&&drop?.id===item.id&&drop.side==='after'}" @pointerdown="startDrag($event,item)" @click.capture="captureClick" @dragstart.prevent @keydown.alt.up.prevent="keyboardMove(item,-1)" @keydown.alt.down.prevent="keyboardMove(item,1)">
        <button class="cms-nav-card-main" @click="edit(item)" :disabled="busy" :aria-label="'编辑导航：'+item.text" aria-describedby="nav-card-help"><span class="cms-nav-card-meta"><span>{{item.children?'下拉菜单':item.newTab?'外部链接':'导航链接'}}</span><span>{{item.hidden?'已隐藏':String(index+1).padStart(2,'0')}}</span></span><strong>{{item.text}}</strong><span v-if="item.children" class="cms-nav-card-children"><span v-for="child in item.children.slice(0,3)" :key="child.id">{{child.text}}</span><small v-if="item.children.length>3">+{{item.children.length-3}}</small></span><span v-else class="cms-nav-card-url">{{item.link}}</span><span class="cms-nav-card-caption">{{item.children?item.children.length+' 个子项目':'点击修改名称和链接'}} <span aria-hidden="true">↗</span></span></button>
        <footer><button class="cms-inline-drag" @pointerdown.stop.prevent="startDrag($event,item,'top',true)" @click="message='按住卡片拖动，或使用 Alt + 上下方向键；顺序自动保存。'" :disabled="busy" :aria-label="'拖动导航：'+item.text"><span aria-hidden="true">⠿</span> 拖动排序</button><span>自动保存</span></footer>
      </article>
    </div>
  </template>
  <dialog v-if="draft" ref="dialog" class="cms-edit-dialog cms-nav-edit-dialog" aria-labelledby="nav-edit-title" @cancel.prevent="close()" @click.self="close()">
    <div class="cms-nav-edit-body">
      <header class="cms-dialog-heading"><div><span class="cms-eyebrow">NAVIGATION</span><h2 id="nav-edit-title">{{isNew?'添加导航':'编辑导航'}}</h2></div><button class="cms-dialog-close" @click="close()" :disabled="busy" aria-label="关闭导航编辑">✕</button></header>
      <p class="cms-nav-editor-note">设置名称和跳转位置，保存后更新网站顶部导航。</p><p v-if="error" class="cms-error cms-notification" role="alert">{{error}}</p>
      <div v-if="removing" class="cms-confirm" role="alertdialog" aria-labelledby="nav-remove-title"><h2 id="nav-remove-title">移除“{{draft.text}}”？</h2><p>只移除导航入口，不会删除文章或页面。</p><div><button @click="removing=false" :disabled="busy">取消</button><button class="cms-danger" @click="removeItem" :disabled="busy">确认移除入口</button></div></div>
      <fieldset class="cms-fields" :disabled="busy||removing">
        <div class="cms-field-row"><label class="cms-field"><span>显示名称</span><input ref="nameInput" v-model="draft.text" maxlength="24" placeholder="例如：学习笔记" aria-label="导航名称"></label><label class="cms-field"><span>类型</span><select :value="draft.children?'group':'link'" @change="setType($event.target.value)" aria-label="导航类型"><option value="link">直接链接</option><option value="group">下拉菜单</option></select></label></div>
        <label class="cms-pin-setting"><span><strong>显示在顶部导航</strong><small>关闭后保留配置，访客看不到此入口。</small></span><input type="checkbox" role="switch" :checked="!draft.hidden" @change="draft.hidden=!$event.target.checked" aria-label="显示在顶部导航"></label>
        <template v-if="!draft.children"><label class="cms-field"><span>链接地址</span><input v-model="draft.link" maxlength="500" placeholder="/journal.html 或 https://example.com" aria-label="导航链接"></label><label class="cms-field"><span>快捷选择站内页面或分类</span><select value="" @change="selectTarget(draft,$event)" aria-label="导航快捷目标"><option value="">选择后填入链接</option><option v-for="target in targets" :key="target.label" :value="target.link">{{target.label}}</option></select></label><label class="cms-nav-checkbox"><input type="checkbox" v-model="draft.newTab" aria-label="在新标签页打开导航">在新标签页打开</label></template>
        <div v-else class="cms-nav-child-library"><div class="cms-nav-child-heading"><h3>下拉子项目 <small>{{draft.children.length}} / 12</small></h3><span>拖动或使用上下按钮调整，保存后生效。</span></div>
          <article v-for="(child,index) in draft.children" :key="child.id" :data-nav-child="child.id" class="cms-nav-child-card" :class="{'is-dragging':drag?.scope==='child'&&drag.id===child.id,'is-drop-before':drag?.scope==='child'&&drop?.id===child.id&&drop.side==='before','is-drop-after':drag?.scope==='child'&&drop?.id===child.id&&drop.side==='after'}" @click.capture="captureClick" @dragstart.prevent>
            <header><span class="cms-nav-child-grip" @pointerdown.prevent="startDrag($event,child,'child',true)" aria-hidden="true">⠿</span><button class="cms-nav-child-summary" @click="childEditing=childEditing===child.id?'':child.id" :aria-expanded="childEditing===child.id" :aria-label="'编辑子项目：'+(child.text||'未命名')"><strong>{{child.text||'未命名子项目'}}<small v-if="child.hidden">已隐藏</small></strong><span>{{child.link}}</span></button><div class="cms-nav-child-controls"><button @click="keyboardMove(child,-1,'child')" :disabled="index===0" :aria-label="'上移子项目：'+child.text">↑</button><button @click="keyboardMove(child,1,'child')" :disabled="index===draft.children.length-1" :aria-label="'下移子项目：'+child.text">↓</button><button @click="removeChild(child.id)" :aria-label="'移除子项目：'+child.text">✕</button></div></header>
            <div v-if="childEditing===child.id" class="cms-nav-child-fields"><label class="cms-field"><span>显示名称</span><input v-model="child.text" maxlength="24" aria-label="子项目名称"></label><label class="cms-field"><span>链接地址</span><input v-model="child.link" maxlength="500" aria-label="子项目链接"></label><label class="cms-field"><span>站内快捷目标</span><select value="" @change="selectTarget(child,$event)" aria-label="子项目快捷目标"><option value="">选择后填入链接</option><option v-for="target in targets" :key="target.label" :value="target.link">{{target.label}}</option></select></label><div class="cms-nav-child-options"><label class="cms-nav-checkbox"><input type="checkbox" v-model="child.hidden" aria-label="隐藏此子项目">隐藏此子项目</label><label class="cms-nav-checkbox"><input type="checkbox" v-model="child.newTab" aria-label="子项目在新标签页打开">在新标签页打开</label></div></div>
          </article>
          <button class="cms-nav-add-child" @click="addChild" :disabled="draft.children.length>=12">＋ 添加子项目</button>
        </div>
      </fieldset>
      <footer class="cms-nav-edit-footer"><button v-if="!isNew" class="cms-danger-text" @click="removing=true" :disabled="busy||removing">移除入口</button><span v-else>最多 12 项导航，支持一级下拉菜单。</span><div><button @click="close()" :disabled="busy">取消</button><button class="cms-primary" @click="saveItem" :disabled="busy||removing">{{busy?'保存中…':'保存导航项'}}</button></div></footer>
    </div>
  </dialog>
  <Teleport to="body"><div v-if="drag?.scope==='top'" class="cms-card-drag-ghost" :style="ghostStyle" aria-hidden="true"><span>⠿</span><div><strong>{{dragTitle}}</strong><small>松手，自动保存导航顺序</small></div></div></Teleport>
</section>
</template>
