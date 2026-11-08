<script setup>
import {ref,computed,onMounted,onUnmounted} from 'vue';
import {api,categoryLabel} from './cms-client';
const emit=defineEmits(['saved']);
const dialog=ref(null),rows=ref([]),orderedIds=ref([]),pinnedIds=ref([]),version=ref(0),base=ref(''),loading=ref(false),saving=ref(false),error=ref(''),announcement=ref(''),dragId=ref(''),overId=ref(''),highlight=ref('');
const serialize=()=>JSON.stringify({orderedIds:orderedIds.value,pinnedIds:pinnedIds.value});
const dirty=computed(()=>!!base.value&&serialize()!==base.value);
const pins=computed(()=>new Set(pinnedIds.value));
const sorted=computed(()=>{const rank=new Map(orderedIds.value.map((id,i)=>[id,i]));return [...rows.value].sort((a,b)=>Number(pins.value.has(b.id))-Number(pins.value.has(a.id))||(rank.get(a.id)??1e9)-(rank.get(b.id)??1e9)||String(b.publishedAt||b.updatedAt).localeCompare(String(a.publishedAt||a.updatedAt))||b.id.localeCompare(a.id));});
const names={draft:'草稿',published:'已发布',archived:'已归档'};
function apply(data){rows.value=data.posts;orderedIds.value=data.orderedIds;pinnedIds.value=data.pinnedIds;version.value=data.version;base.value=serialize();}
async function reload(){if(dirty.value&&!window.confirm('重新加载会放弃尚未保存的排序，继续吗？'))return;loading.value=true;error.value='';try{apply(await api('/api/admin/post-order'));}catch(e){error.value=e.message;}finally{loading.value=false;}}
async function open(id=''){highlight.value=id;error.value='';announcement.value='';base.value='';dialog.value.showModal();await reload();}
function close(){if(saving.value)return;if(dirty.value&&!window.confirm('排序还没有保存，确定放弃修改吗？'))return;dialog.value.close();}
function pin(post){if(saving.value)return;pinnedIds.value=pins.value.has(post.id)?pinnedIds.value.filter(id=>id!==post.id):[...pinnedIds.value,post.id];announcement.value=`${post.title}已${pins.value.has(post.id)?'置顶':'取消置顶'}，保存后生效。`;}
function movable(index,step){const next=sorted.value[index+step],post=sorted.value[index];return !!next&&pins.value.has(next.id)===pins.value.has(post.id);}
function move(index,step){if(saving.value||!movable(index,step))return;const ids=sorted.value.map(p=>p.id);[ids[index],ids[index+step]]=[ids[index+step],ids[index]];orderedIds.value=ids;announcement.value=`${sorted.value.find(p=>p.id===ids[index+step])?.title}已${step<0?'上移':'下移'}，保存后生效。`;}
function startDrag(event,post){if(saving.value)return;dragId.value=post.id;event.currentTarget.setPointerCapture(event.pointerId);}
function pointerTarget(event){return event.target?.ownerDocument?.elementFromPoint(event.clientX,event.clientY)?.closest('[data-order-id]')?.dataset.orderId;}
function pointerMove(event){if(dragId.value)overId.value=pointerTarget(event)||'';}
function pointerEnd(event){if(!dragId.value)return;const post=rows.value.find(p=>p.id===pointerTarget(event));if(post)drop(post);dragId.value='';overId.value='';}
function pointerCancel(){dragId.value='';overId.value='';}
function drop(post){overId.value='';const source=rows.value.find(p=>p.id===dragId.value);if(!source||source.id===post.id||saving.value)return;if(pins.value.has(source.id)!==pins.value.has(post.id)){announcement.value='请在同一分组内拖动；跨组请使用置顶按钮。';return;}const ids=sorted.value.map(p=>p.id).filter(id=>id!==source.id);ids.splice(ids.indexOf(post.id),0,source.id);orderedIds.value=ids;announcement.value=`已调整${source.title}的位置，保存后生效。`;dragId.value='';}
function reset(){orderedIds.value=[];announcement.value='已恢复按发布时间排序，置顶标记保留；保存后生效。';}
async function save(){if(saving.value||loading.value||!dirty.value)return;saving.value=true;error.value='';try{const data=await api('/api/admin/post-order',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:version.value,orderedIds:orderedIds.value,pinnedIds:pinnedIds.value})});apply(data);emit('saved');dialog.value.close();}catch(e){error.value=e.message;}finally{saving.value=false;}}
function beforeLeave(event){if(dialog.value?.open&&dirty.value){event.preventDefault();event.returnValue='';}}
onMounted(()=>{window.addEventListener('beforeunload',beforeLeave);document.addEventListener('pointermove',pointerMove);document.addEventListener('pointerup',pointerEnd);document.addEventListener('pointercancel',pointerCancel);});onUnmounted(()=>{window.removeEventListener('beforeunload',beforeLeave);document.removeEventListener('pointermove',pointerMove);document.removeEventListener('pointerup',pointerEnd);document.removeEventListener('pointercancel',pointerCancel);});
defineExpose({open});
</script>
<template>
<dialog ref="dialog" class="cms-edit-dialog cms-order-dialog" aria-labelledby="order-heading" @cancel.prevent="close" @click.self="close">
  <div class="cms-order-inner">
    <header class="cms-dialog-heading"><div><span class="cms-eyebrow">DISPLAY ORDER</span><h2 id="order-heading">排序与置顶</h2></div><button class="cms-dialog-close" @click="close" :disabled="saving" aria-label="关闭排序窗口">✕</button></header>
    <p class="cms-order-intro">置顶内容优先展示。拖动调整同组顺序，也可以使用上下按钮。</p>
    <div class="cms-order-tools"><span>{{pinnedIds.length}} 篇置顶 · {{rows.length}} 篇内容</span><div><button @click="reset" :disabled="saving||loading">恢复按时间排序</button><button @click="reload" :disabled="saving||loading">重新加载</button></div></div>
    <p v-if="error" class="cms-error cms-notification" role="alert">{{error}}</p><p v-if="loading" class="cms-muted">正在加载内容…</p>
    <p class="cms-sr-only" role="status">{{announcement}}</p>
    <ol v-if="!loading" class="cms-order-list" aria-label="文章展示顺序">
      <template v-for="(post,index) in sorted" :key="post.id">
        <li v-if="index===0||pins.has(post.id)!==pins.has(sorted[index-1].id)" class="cms-order-group" aria-hidden="true">{{pins.has(post.id)?'置顶内容':'其他内容'}}</li>
        <li class="cms-order-row" :data-order-id="post.id" :class="{'is-pinned':pins.has(post.id),'is-over':overId===post.id,'is-highlighted':highlight===post.id}">
          <span class="cms-drag-handle" aria-hidden="true" @pointerdown.prevent="startDrag($event,post)">⠿</span><span class="cms-order-number">{{index+1}}</span>
          <div class="cms-order-name"><strong>{{post.title}}</strong><span>{{categoryLabel(post.category)}} · {{names[post.status]}}</span></div>
          <div class="cms-order-actions"><button @click="pin(post)" :disabled="saving" :aria-pressed="pins.has(post.id)" :aria-label="(pins.has(post.id)?'取消置顶：':'置顶：')+post.title" class="cms-order-pin">{{pins.has(post.id)?'已置顶':'置顶'}}</button><button @click="move(index,-1)" :disabled="saving||!movable(index,-1)" :aria-label="'上移：'+post.title">↑</button><button @click="move(index,1)" :disabled="saving||!movable(index,1)" :aria-label="'下移：'+post.title">↓</button></div>
        </li>
      </template>
    </ol>
    <p v-if="!loading&&!rows.length" class="cms-muted">新建内容后，就可以在这里调整顺序。</p>
    <footer class="cms-order-footer"><span>{{dirty?'有未保存的调整':'前台按此顺序展示已发布内容'}}<small>草稿和归档内容不会公开。</small></span><div><button @click="close" :disabled="saving">取消</button><button class="cms-primary" @click="save" :disabled="saving||loading||!dirty">{{saving?'保存中…':'保存顺序'}}</button></div></footer>
  </div>
</dialog>
</template>
