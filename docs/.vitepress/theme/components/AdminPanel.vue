<script setup>
import {ref,computed,watch,onMounted,onUnmounted,nextTick} from 'vue';
import {api,renderMarkdown,categoryLabel,dateLabel} from './cms-client';
import CoverPreview from './CoverPreview.vue';
import NavigationEditor from './NavigationEditor.vue';
import {movePostOrder} from '../../../../src/post-order.js';
const authorized=ref(false),ready=ref(false),busy=ref(false),uploading=ref(false),loading=ref(false);
const message=ref(''),error=ref(''),posts=ref([]),filter=ref(''),category=ref(''),query=ref(''),search=ref('');
const page=ref(1),total=ref(0),counts=ref({}),editor=ref(null),base=ref(''),preview=ref(false);
const panel=ref('content'),navigationDirty=ref(false),knownCategories=ref([]);
const categoryOptions=computed(()=>[...new Set(['文章','题解','日常',...knownCategories.value.map(item=>categoryLabel(item.key))])]);
const bodyInput=ref(null),coverInput=ref(null),imageInput=ref(null),pending=ref(''),confirmTitle=ref('');
const editorDialog=ref(null),titleInput=ref(null);
const statusNames={draft:'草稿',published:'已发布',archived:'已归档',trash:'回收站'};
const dirty=computed(()=>editor.value&&JSON.stringify(editor.value)!==base.value);
const rendered=computed(()=>renderMarkdown(editor.value?.content));
const locked=computed(()=>busy.value||uploading.value);
const draggingId=ref(''),dropId=ref(''),dropSide=ref('before'),dragPoint=ref({x:0,y:0});
const dragPost=computed(()=>posts.value.find(post=>post.id===draggingId.value));
const dragGhostStyle=computed(()=>({left:Math.max(8,Math.min(dragPoint.value.x+15,window.innerWidth-260))+'px',top:Math.max(8,Math.min(dragPoint.value.y+15,window.innerHeight-80))+'px'}));
const invalidDrop=computed(()=>{const target=posts.value.find(post=>post.id===dropId.value);return target&&dragPost.value&&!!target.pinned!==!!dragPost.value.pinned;});
let cardDrag=null,dragScrollFrame=0,suppressCardClickUntil=0;
function startCardDrag(event,post,handle=false){
  if(locked.value||loading.value||post.status==='trash'||event.button!==0||(!handle&&event.pointerType==='touch'))return;
  if(!handle&&!event.target.closest('.cms-content-card'))return;
  const element=event.currentTarget.closest('[data-post-id]');
  cardDrag={id:post.id,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,element,snapshot:null};
}
function updateCardDrop(x,y){
  const element=document.elementFromPoint(x,y)?.closest('[data-post-id]');
  if(!element||element.dataset.postId===draggingId.value){dropId.value='';return;}
  const rect=element.getBoundingClientRect(),single=element.parentElement.clientWidth<rect.width*1.5;
  dropId.value=element.dataset.postId;dropSide.value=(single?y<rect.top+rect.height/2:x<rect.left+rect.width/2)?'before':'after';
}
function scrollWhileDragging(){
  if(!draggingId.value){dragScrollFrame=0;return;}
  const y=dragPoint.value.y,amount=y<90?-12:y>window.innerHeight-90?12:0;
  if(amount){window.scrollBy(0,amount);updateCardDrop(dragPoint.value.x,y);}
  dragScrollFrame=requestAnimationFrame(scrollWhileDragging);
}
function moveCardPointer(event){
  if(!cardDrag||event.pointerId!==cardDrag.pointer)return;
  if(!draggingId.value&&Math.hypot(event.clientX-cardDrag.startX,event.clientY-cardDrag.startY)<8)return;
  if(!draggingId.value){draggingId.value=cardDrag.id;cardDrag.element.setPointerCapture(event.pointerId);cardDrag.snapshot=api('/api/admin/post-order').then(data=>({data}),error=>({error}));document.documentElement.classList.add('cms-card-dragging');dragScrollFrame=requestAnimationFrame(scrollWhileDragging);}
  event.preventDefault();dragPoint.value={x:event.clientX,y:event.clientY};updateCardDrop(event.clientX,event.clientY);
}
function cancelCardDrag(){if(cardDrag?.element?.hasPointerCapture(cardDrag.pointer))cardDrag.element.releasePointerCapture(cardDrag.pointer);cardDrag=null;draggingId.value='';dropId.value='';cancelAnimationFrame(dragScrollFrame);dragScrollFrame=0;document.documentElement.classList.remove('cms-card-dragging');}
async function endCardPointer(event){
  if(!cardDrag||event.pointerId!==cardDrag.pointer)return;
  const state=cardDrag,active=!!draggingId.value;let targetId='',side='before';
  if(active){updateCardDrop(event.clientX,event.clientY);targetId=dropId.value;side=dropSide.value;suppressCardClickUntil=Date.now()+500;}
  cancelCardDrag();if(!active||!targetId)return;
  busy.value=true;error.value='';message.value='正在保存顺序…';
  try{const result=await state.snapshot;if(result.error)throw result.error;const body=movePostOrder(result.data,state.id,targetId,side);
    // Keep the grid responsive while the version-checked update is being saved.
    const ranks=new Map(body.orderedIds.map((id,index)=>[id,index]));posts.value=[...posts.value].sort((a,b)=>ranks.get(a.id)-ranks.get(b.id));
    await api('/api/admin/post-order',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});notify('顺序已自动保存。');await loadPosts();
  }catch(e){message.value='';error.value=e.message;await refresh();}finally{busy.value=false;}
}
function captureCardClick(event){if(Date.now()<suppressCardClickUntil){event.preventDefault();event.stopPropagation();}}
async function moveByKeyboard(post,step){
  if(locked.value||loading.value||post.status==='trash')return;busy.value=true;error.value='';
  try{const data=await api('/api/admin/post-order'),pins=new Set(data.pinnedIds),group=data.posts.filter(p=>pins.has(p.id)===pins.has(post.id)),target=group[group.findIndex(p=>p.id===post.id)+step];
    if(!target){notify(step<0?'已经是本组第一篇。':'已经是本组最后一篇。');return;}
    await api('/api/admin/post-order',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(movePostOrder(data,post.id,target.id,step<0?'before':'after'))});notify('顺序已自动保存。');await loadPosts();
  }catch(e){error.value=e.message;await refresh();}finally{busy.value=false;await nextTick();document.querySelector(`[data-post-id="${post.id}"] .cms-content-card`)?.focus();}
}
const inTrash=computed(()=>editor.value?.status==='trash');
watch(()=>!!editor.value,open=>{if(open&&editorDialog.value&&!editorDialog.value.open){editorDialog.value.showModal();titleInput.value?.focus();}},{flush:'post'});
function closeEditor(){if(locked.value||!leaveEditor())return;editorDialog.value?.close();editor.value=null;base.value='';pending.value='';error.value='';}
let loadSequence=0;
function notify(text){message.value=text;error.value='';}
function setEditor(p){editor.value={...p,pinned:!!p.pinned,category:categoryLabel(p.category),tagsText:p.tags.join(', ')};base.value=JSON.stringify(editor.value);pending.value='';}
async function loadCategories(){knownCategories.value=(await api('/api/admin/categories')).categories;}
function changePanel(value){if(panel.value===value||locked.value)return;if((dirty.value||navigationDirty.value)&&!window.confirm('当前有未保存的修改，确定放弃并切换吗？'))return;if(dirty.value){editor.value=base.value?JSON.parse(base.value):null;}panel.value=value;navigationDirty.value=false;message.value='';error.value='';}
async function loadPosts(){const seq=++loadSequence;loading.value=true;try{const params=new URLSearchParams({page:String(page.value),status:filter.value,category:category.value,q:search.value});const d=await api('/api/admin/posts?'+params);if(seq!==loadSequence)return;posts.value=d.posts;total.value=d.total;counts.value=d.counts;if(page.value>1&&!d.posts.length){page.value--;return await loadPosts();}}finally{if(seq===loadSequence)loading.value=false;}}
async function refresh(){try{await loadPosts();}catch(e){error.value=e.message;}}
async function changeFilter(value){filter.value=value;page.value=1;await refresh();}
function runSearch(){search.value=query.value.trim();page.value=1;refresh();}
function leaveEditor(){return !dirty.value||window.confirm('当前内容还没有保存，确定放弃修改吗？');}
function create(){if(locked.value||!leaveEditor())return;editor.value={id:null,title:'',content:'',excerpt:'',category:'文章',status:'draft',tagsText:'',tags:[],cover:'',version:0,pinned:false};base.value=JSON.stringify(editor.value);preview.value=false;pending.value='';message.value='';error.value='';}
async function edit(post){if(locked.value||!leaveEditor())return;busy.value=true;try{setEditor((await api('/api/admin/posts/'+post.id)).post);preview.value=false;message.value='';error.value='';}catch(e){error.value=e.message;}finally{busy.value=false;}}
async function save(status){if(!editor.value||locked.value||inTrash.value)return;busy.value=true;error.value='';message.value='';try{const body={...editor.value,status,tags:editor.value.tagsText.split(/[,，]/).map(s=>s.trim()).filter(Boolean)};const d=await api('/api/admin/posts'+(body.id?'/'+body.id:''),{method:body.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});setEditor(d.post);notify(status==='published'?'已发布，网站已更新。':status==='archived'?'已归档，访客将看不到这篇内容。':'草稿已保存。');await Promise.all([loadPosts(),loadCategories()]);}catch(e){error.value=e.message;}finally{busy.value=false;}}
function askAction(action){if(locked.value||!leaveEditor())return;pending.value=action;confirmTitle.value='';}
async function executeAction(){if(!editor.value||locked.value)return;const action=pending.value;busy.value=true;error.value='';try{const d=await api('/api/admin/posts/'+editor.value.id,{method:action==='delete'?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,version:editor.value.version,confirmTitle:confirmTitle.value})});if(action==='delete'){editorDialog.value?.close();editor.value=null;base.value='';notify('已彻底删除。');}else{setEditor(d.post);notify(action==='trash'?'已移到回收站，访客将看不到这篇内容。':'已恢复为'+statusNames[d.post.status]+'。');}pending.value='';await Promise.all([loadPosts(),loadCategories()]);}catch(e){error.value=e.message;}finally{busy.value=false;}}
function duplicate(){if(!editor.value||locked.value)return;const p=editor.value;editor.value={title:p.title+'（副本）',content:p.content,excerpt:p.excerpt,category:p.category,status:'draft',tags:[...p.tags],tagsText:p.tagsText,cover:p.cover,id:null,version:0,pinned:false};base.value='';pending.value='';preview.value=false;notify('已复制为新草稿，请保存。');}
async function exportBackup(){if(locked.value)return;busy.value=true;try{const data=await api('/api/admin/export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='naiyael-content-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('内容备份已导出，包含草稿和回收站中的内容；图片保留为原链接。');}catch(e){error.value=e.message;}finally{busy.value=false;}}
async function upload(event,isCover){const file=event.target.files?.[0];event.target.value='';if(!file||locked.value)return;if(file.size>5*1024*1024){error.value='图片不能超过 5 MB';return;}uploading.value=true;error.value='';try{const d=await api('/api/admin/uploads',{method:'POST',headers:{'Content-Type':file.type},body:file});if(isCover)editor.value.cover=d.url;else insert(`\n![图片说明](${d.url})\n`);notify(isCover?'封面已上传，请保存文章。':'图片已插入正文，请保存文章。');}catch(e){error.value=e.message;}finally{uploading.value=false;}}
function insert(text,before='',after=''){if(!editor.value)return;const el=bodyInput.value;if(!el){editor.value.content+=text;return;}const start=el.selectionStart,end=el.selectionEnd,selected=editor.value.content.slice(start,end);editor.value.content=editor.value.content.slice(0,start)+(before?before+(selected||text)+after:text)+editor.value.content.slice(end);}
function preventLeave(e){if(dirty.value||navigationDirty.value||busy.value){e.preventDefault();e.returnValue='';}}
function shortcut(e){if(e.key==='Escape'&&draggingId.value){suppressCardClickUntil=Date.now()+500;cancelCardDrag();return;}if(panel.value==='content'&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(editor.value&&!pending.value)save(editor.value.status);}}
onMounted(async()=>{window.addEventListener('beforeunload',preventLeave);window.addEventListener('keydown',shortcut);document.addEventListener('pointermove',moveCardPointer,{passive:false});document.addEventListener('pointerup',endCardPointer);document.addEventListener('pointercancel',cancelCardDrag);try{await api('/api/admin/session');authorized.value=true;await Promise.all([loadPosts(),loadCategories()]);}catch(e){if(e.status!==403)error.value=e.message;}finally{ready.value=true;}});
onUnmounted(()=>{loadSequence++;cancelCardDrag();window.removeEventListener('beforeunload',preventLeave);window.removeEventListener('keydown',shortcut);document.removeEventListener('pointermove',moveCardPointer);document.removeEventListener('pointerup',endCardPointer);document.removeEventListener('pointercancel',cancelCardDrag);});
</script>
<template>
<div class="cms-admin cms-card-admin">
  <header class="cms-heading"><div><span class="cms-eyebrow">NAIYAEL / WORKSPACE</span><h1>内容管理</h1><p>点击卡片编辑，拖动卡片排序 · 松手自动保存。</p></div><div class="cms-heading-actions"><button v-if="authorized" @click="exportBackup" :disabled="locked">导出备份 ↓</button><a href="/" class="cms-text-link">查看网站 ↗</a></div></header>
  <p v-if="!ready" class="cms-muted">正在加载后台…</p>
  <div v-else-if="!authorized" class="cms-login"><h2>欢迎回来</h2><p>使用你的 ChatGPT 账号登录后管理网站内容。</p><a class="cms-primary" href="/signin-with-chatgpt?return_to=%2Fadmin.html" target="_top">登录管理后台 →</a><p v-if="error" class="cms-error">{{error}}</p></div>
  <template v-else>
    <nav class="cms-section-tabs" aria-label="管理功能"><button :class="{active:panel==='content'}" @click="changePanel('content')">文章与日常</button><button :class="{active:panel==='navigation'}" @click="changePanel('navigation')">顶部导航</button></nav>
    <div class="cms-notification" role="status" v-if="message&&!editor">✓ {{message}}</div><div class="cms-error cms-notification" role="alert" v-if="error&&!editor">{{error}}</div>
    <NavigationEditor v-if="panel==='navigation'" :categories="categoryOptions" @dirty-change="navigationDirty=$event" />
    <div class="cms-card-workspace" v-else>
      <section class="cms-library" aria-label="我的内容">
        <div class="cms-library-toolbar"><h2>我的内容 <small>{{total}}</small></h2>
        <div class="cms-library-actions"><form class="cms-search" @submit.prevent="runSearch"><label><span class="cms-sr-only">搜索内容</span><input v-model="query" :disabled="locked" placeholder="搜索标题、摘要、标签" type="search"></label><button type="submit" :disabled="locked">搜索</button></form></div>
        </div>
        <div class="cms-library-filters"><div class="cms-filter"><button v-for="(label,key) in {all:'全部',draft:'草稿',published:'已发布',archived:'归档',trash:'回收站'}" :key="key" :class="{active:filter===(key==='all'?'':key)}" :aria-pressed="filter===(key==='all'?'':key)" @click="changeFilter(key==='all'?'':key)">{{label}}<small v-if="key!=='all'">{{counts[key]||0}}</small></button></div>
        <div class="cms-list-controls"><select v-model="category" @change="page=1;refresh()" aria-label="筛选分类"><option value="">所有分类</option><option v-for="label in categoryOptions" :key="label" :value="label">{{label}}</option></select><button @click="refresh" :disabled="loading">{{loading?'加载中…':'刷新列表'}}</button></div>
        </div>
        <p class="cms-sr-only" id="cms-sort-help">点击编辑；按住拖动排序，或使用 Alt 加上下方向键调整同组顺序。顺序自动保存。</p>
        <div class="cms-content-grid" :aria-busy="loading">
          <button class="cms-create-card" @click="create" :disabled="locked" aria-label="新建内容"><span class="cms-create-plus" aria-hidden="true">＋</span><strong>写一篇新的</strong><span>文章、题解，或一段日常</span></button>
          <article v-for="post in posts" :key="post.id" class="cms-admin-post" :data-post-id="post.id" :class="{'is-pinned':post.pinned,'is-dragging':draggingId===post.id,'is-drop-before':dropId===post.id&&dropSide==='before'&&!invalidDrop,'is-drop-after':dropId===post.id&&dropSide==='after'&&!invalidDrop}" @pointerdown="startCardDrag($event,post)" @click.capture="captureCardClick" @dragstart.prevent @keydown.alt.up.prevent="moveByKeyboard(post,-1)" @keydown.alt.down.prevent="moveByKeyboard(post,1)"><button class="cms-content-card" @click="edit(post)" :disabled="locked" :aria-label="'编辑：'+post.title" aria-describedby="cms-sort-help">
            <img v-if="post.cover" :src="post.cover" alt="" loading="lazy">
            <span class="cms-card-copy"><span class="cms-card-meta"><span class="cms-card-category">{{categoryLabel(post.category)}}</span><span v-if="post.pinned" class="post-pin-badge">置顶</span><time>{{dateLabel(post.updatedAt)}}</time><span class="cms-card-status" :class="post.status">{{statusNames[post.status]}}</span></span><strong class="cms-card-title">{{post.title}}</strong><span class="cms-card-excerpt">{{post.excerpt||'还没有摘要，点开继续写。'}}</span><span class="cms-card-tags"><span v-for="tag in post.tags.slice(0,3)" :key="tag"># {{tag}}</span></span><span class="cms-card-foot"><span>{{post.pageKey?'网站页面':'内容'}}</span><span>{{post.status==='trash'?'查看与恢复':'点击编辑'}} <span aria-hidden="true">↗</span></span></span></span>
          </button><footer class="cms-card-actions" v-if="post.status!=='trash'"><button class="cms-inline-drag" @pointerdown.stop.prevent="startCardDrag($event,post,true)" @click="notify('按住拖动排序，或使用 Alt + 上下方向键；顺序自动保存。')" :disabled="locked" :aria-label="'拖动排序：'+post.title" aria-describedby="cms-sort-help"><span aria-hidden="true">⠿</span> 拖动排序</button><span class="cms-card-autosave-hint">松手自动保存</span></footer></article>
        </div>
        <p v-if="loading&&!posts.length" class="cms-library-empty" role="status">正在加载内容…</p><p v-else-if="!posts.length" class="cms-library-empty">{{filter==='trash'?'回收站是空的。':search||category?'没有匹配的内容，试试其他关键词或分类。':'点击加号，写下第一篇记录。'}}</p>
        <div class="cms-pagination" v-if="total>30"><button :disabled="page===1||loading" @click="page--;refresh()" aria-label="上一页">←</button><span>{{page}} / {{Math.ceil(total/30)}}</span><button :disabled="page*30>=total||loading" @click="page++;refresh()" aria-label="下一页">→</button></div>
      </section>
      <dialog v-if="editor" ref="editorDialog" class="cms-edit-dialog" aria-labelledby="cms-dialog-title" @cancel.prevent="closeEditor" @click.self="closeEditor">
      <section class="cms-editor">
        <header class="cms-dialog-heading"><div><span class="cms-eyebrow">{{editor.id?'继续记录':'新的记录'}}</span><h2 id="cms-dialog-title">{{editor.id?'编辑内容':'新建内容'}}</h2></div><button class="cms-dialog-close" @click="closeEditor" :disabled="locked" aria-label="关闭编辑窗口">✕</button></header>
        <div class="cms-editor-top"><span :class="{'is-dirty':dirty}">{{inTrash?'已移到回收站':dirty?'有未保存的修改':editor.id?'已保存 · '+statusNames[editor.status]:'新草稿'}}</span><div v-if="!inTrash"><button @click="save('draft')" :disabled="locked">保存草稿</button><button class="cms-primary" @click="save('published')" :disabled="locked">{{busy?'保存中…':editor.status==='published'?'更新发布':'发布内容'}} ↗</button></div><button v-else class="cms-primary" @click="askAction('restore')" :disabled="locked">恢复内容</button></div>
        <div class="cms-notification" role="status" v-if="message">✓ {{message}}</div><div class="cms-error cms-notification" role="alert" v-if="error">{{error}}</div>
        <div v-if="pending" class="cms-confirm" role="alertdialog" aria-labelledby="confirm-heading"><h2 id="confirm-heading">{{pending==='delete'?'彻底删除内容？':pending==='trash'?'移到回收站？':'恢复内容？'}}</h2><p>《{{editor.title}}》</p><p>{{pending==='delete'?'此操作无法撤销。请输入完整标题确认删除。':pending==='trash'?'移入后网站不再展示，可以在回收站恢复。':'将恢复为'+statusNames[editor.previousStatus||'draft']+'，已发布的内容会重新显示在网站上。'}}</p><input v-if="pending==='delete'" v-model="confirmTitle" aria-label="输入标题确认删除" :placeholder="editor.title"><div><button @click="pending=''" :disabled="locked">取消</button><button :class="pending==='delete'?'cms-danger':'cms-primary'" @click="executeAction" :disabled="locked||(pending==='delete'&&confirmTitle!==editor.title)">{{busy?'处理中…':pending==='delete'?'确认彻底删除':pending==='trash'?'确认移入':'确认恢复'}}</button></div></div>
        <p v-if="editor.pageKey&&!inTrash" class="cms-page-note">这是网站现有页面，可修改标题和正文。{{editor.pageKey!=='about'?'算法图表和自动同步会继续保留。':'头像会继续保留。'}}</p>
        <p v-if="inTrash" class="cms-page-note">移入时间：{{dateLabel(editor.trashedAt)}}。恢复后可以继续编辑。</p>
        <fieldset :disabled="locked||inTrash||!!pending" class="cms-fields">
          <label class="cms-field"><span>标题</span><input ref="titleInput" v-model="editor.title" placeholder="写一个标题" maxlength="160" aria-label="文章标题"></label>
          <label class="cms-pin-setting"><span><strong>置顶这篇内容</strong><small>保存后生效，仅已发布内容会在前台展示。</small></span><input type="checkbox" role="switch" v-model="editor.pinned" aria-label="置顶这篇内容"></label>
          <div class="cms-field-row"><label class="cms-field"><span>分类</span><input v-model="editor.category" list="cms-category-options" maxlength="40" placeholder="如：学习笔记、旅行、比赛复盘" aria-label="文章分类"><small class="cms-field-help">直接输入新分类，也可选用已有分类。</small><datalist id="cms-category-options"><option v-for="label in categoryOptions" :key="label" :value="label" /></datalist></label><label class="cms-field"><span>标签</span><input v-model="editor.tagsText" placeholder="用逗号分隔，如 图论, 最短路" aria-label="文章标签"></label></div>
          <details class="cms-extra-fields"><summary>摘要与封面 <span>{{editor.cover?'已设置封面':'可选'}}</span></summary>
          <label class="cms-field"><span>摘要 <small>可留空，保存时自动生成</small></span><textarea v-model="editor.excerpt" rows="2" maxlength="400" aria-label="文章摘要"></textarea></label>
          <div class="cms-cover-field"><span>封面 <small>可选</small></span><p class="cms-field-help">列表卡片顶部显示封面，文章页显示横向大图。建议使用 16:9 横图；支持 JPG、PNG、WebP、GIF，最大 5 MB。</p><div class="cms-cover-actions"><button @click="coverInput.click()">{{uploading?'上传中…':editor.cover?'更换封面':'＋ 上传封面'}}</button><button v-if="editor.cover" @click="editor.cover=''">移除封面</button></div><CoverPreview :post="editor" /></div>
          </details>
          <input ref="coverInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="upload($event,true)"><input ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="upload($event,false)">
          <div class="cms-body-heading"><span>正文 <small>支持 Markdown</small></span><div><button :class="{active:!preview}" @click="preview=false">编辑</button><button :class="{active:preview}" @click="preview=true">预览</button></div></div>
          <div class="cms-toolbar" v-if="!preview"><button @click="insert('小标题','\n## ','\n')">H₂ 标题</button><button @click="insert('加粗文字','**','**')"><b>B</b></button><button @click="insert('\n```cpp\n// 代码\n```\n')">&lt;/&gt; 代码</button><button @click="imageInput.click()">＋ 图片</button></div>
          <textarea v-if="!preview" ref="bodyInput" class="cms-body-input" v-model="editor.content" placeholder="从这里开始写…" aria-label="文章正文" spellcheck="false"></textarea><div v-else class="vp-doc cms-body-preview" v-html="rendered||'<p>正文预览会显示在这里。</p>'"></div>
        </fieldset>
        <div class="cms-editor-bottom"><span>{{editor.content.length}} 字符 · {{editor.id?'最后保存 '+dateLabel(editor.updatedAt):'尚未保存'}}</span><div><a v-if="editor.id&&editor.status==='published'" :href="editor.pageKey?`/${editor.pageKey}.html`:`/post.html?id=${editor.id}`" target="_blank" rel="noopener noreferrer">查看内容 ↗</a><button v-if="!inTrash" @click="duplicate" :disabled="locked">复制草稿</button><button v-if="editor.id&&!inTrash&&editor.status!=='archived'" @click="save('archived')" :disabled="locked">归档</button><button v-if="editor.id" class="cms-danger-text" @click="askAction(inTrash?'delete':'trash')" :disabled="locked">{{inTrash?'彻底删除':'移到回收站'}}</button></div></div>
        <button class="cms-return-library" @click="closeEditor" :disabled="locked">完成，返回卡片</button>
      </section>
      </dialog>
    </div>
  </template>
  <Teleport to="body"><div v-if="dragPost" class="cms-card-drag-ghost" :class="{'is-invalid':invalidDrop}" :style="dragGhostStyle" aria-hidden="true"><span>⠿</span><div><strong>{{dragPost.title}}</strong><small>{{invalidDrop?'请拖到同一置顶分组':dropId?'松手，自动保存':'拖到另一张卡片旁边'}}</small></div></div></Teleport>
</div>
</template>


