<script setup>
import {ref,computed,watch,onMounted,onUnmounted,nextTick} from 'vue';
import {api,categoryLabel,dateLabel,readingStats} from './cms-client';
import ArticleContent from './ArticleContent.vue';
import CoverPreview from './CoverPreview.vue';
import NavigationEditor from './NavigationEditor.vue';
import StackEditor from './StackEditor.vue';
import {movePostOrder} from '../../../../src/post-order.js';
import {validImageUrl} from '../../../../src/site-model.js';
const authorized=ref(false),ready=ref(false),busy=ref(false),uploading=ref(false),loading=ref(false);
const authMode=ref(null),authMethods=ref({password:false,access:false}),uploadsEnabled=ref(false);
const loginPassword=ref(''),loggingIn=ref(false);
const imageInsertOpen=ref(false),imageUrl=ref(''),imageAlt=ref(''),imageInsertError=ref('');
const message=ref(''),error=ref(''),posts=ref([]),filter=ref(''),category=ref(''),query=ref(''),search=ref('');
const page=ref(1),total=ref(0),counts=ref({}),editor=ref(null),base=ref(''),editorMode=ref('edit');
const panel=ref('content'),navigationDirty=ref(false),knownCategories=ref([]);
const categoryOptions=computed(()=>[...new Set(['文章','题解','日常',...knownCategories.value.map(item=>categoryLabel(item.key))])]);
const parsedTags=computed(()=>(editor.value?.tagsText||'').split(/[,，]/).map(s=>s.trim()).filter(Boolean).slice(0,10));
const editorStats=computed(()=>readingStats(editor.value?.content||''));
const bodyInput=ref(null),coverInput=ref(null),imageInput=ref(null),importInput=ref(null),pending=ref(''),confirmTitle=ref('');
const editorDialog=ref(null),titleInput=ref(null);
const statusNames={draft:'草稿',published:'已发布',archived:'已归档',trash:'回收站'};
const dirty=computed(()=>editor.value&&JSON.stringify(editor.value)!==base.value);
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
function closeEditor(){if(locked.value||!leaveEditor())return;editorDialog.value?.close();editor.value=null;base.value='';pending.value='';error.value='';imageInsertOpen.value=false;imageInsertError.value='';}
let loadSequence=0;
function notify(text){message.value=text;error.value='';}
function setEditor(p){editor.value={...p,pinned:!!p.pinned,category:categoryLabel(p.category),tagsText:p.tags.join(', ')};base.value=JSON.stringify(editor.value);pending.value='';imageInsertOpen.value=false;imageInsertError.value='';}
async function loadCategories(){knownCategories.value=(await api('/api/admin/categories')).categories;}
function changePanel(value){if(panel.value===value||locked.value)return;if((dirty.value||navigationDirty.value)&&!window.confirm('当前有未保存的修改，确定放弃并切换吗？'))return;if(dirty.value){editor.value=base.value?JSON.parse(base.value):null;}panel.value=value;navigationDirty.value=false;message.value='';error.value='';}
async function loadPosts(){const seq=++loadSequence;loading.value=true;try{const params=new URLSearchParams({page:String(page.value),status:filter.value,category:category.value,q:search.value});const d=await api('/api/admin/posts?'+params);if(seq!==loadSequence)return;posts.value=d.posts;total.value=d.total;counts.value=d.counts;if(page.value>1&&!d.posts.length){page.value--;return await loadPosts();}}finally{if(seq===loadSequence)loading.value=false;}}
async function refresh(){try{await loadPosts();}catch(e){error.value=e.message;}}
async function changeFilter(value){filter.value=value;page.value=1;await refresh();}
function runSearch(){search.value=query.value.trim();page.value=1;refresh();}
function leaveEditor(){return !dirty.value||window.confirm('当前内容还没有保存，确定放弃修改吗？');}
function create(){if(locked.value||!leaveEditor())return;editor.value={id:null,title:'',content:'',excerpt:'',category:'文章',status:'draft',tagsText:'',tags:[],cover:'',version:0,pinned:false};base.value=JSON.stringify(editor.value);editorMode.value='edit';pending.value='';imageInsertOpen.value=false;imageInsertError.value='';message.value='';error.value='';}
async function edit(post){if(locked.value||!leaveEditor())return;busy.value=true;try{setEditor((await api('/api/admin/posts/'+post.id)).post);editorMode.value='edit';message.value='';error.value='';}catch(e){error.value=e.message;}finally{busy.value=false;}}
async function save(status){if(!editor.value||locked.value||inTrash.value)return;busy.value=true;error.value='';message.value='';try{const body={...editor.value,cover:(editor.value.cover||'').trim(),status,tags:editor.value.tagsText.split(/[,，]/).map(s=>s.trim()).filter(Boolean)};const d=await api('/api/admin/posts'+(body.id?'/'+body.id:''),{method:body.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});setEditor(d.post);notify(status==='published'?'已发布，网站已更新。':status==='archived'?'已归档，访客将看不到这篇内容。':'草稿已保存。');await Promise.all([loadPosts(),loadCategories()]);}catch(e){error.value=e.message;}finally{busy.value=false;}}
function askAction(action){if(locked.value||!leaveEditor())return;pending.value=action;confirmTitle.value='';}
async function executeAction(){if(!editor.value||locked.value)return;const action=pending.value;busy.value=true;error.value='';try{const d=await api('/api/admin/posts/'+editor.value.id,{method:action==='delete'?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,version:editor.value.version,confirmTitle:confirmTitle.value})});if(action==='delete'){editorDialog.value?.close();editor.value=null;base.value='';notify('已彻底删除。');}else{setEditor(d.post);notify(action==='trash'?'已移到回收站，访客将看不到这篇内容。':'已恢复为'+statusNames[d.post.status]+'。');}pending.value='';await Promise.all([loadPosts(),loadCategories()]);}catch(e){error.value=e.message;}finally{busy.value=false;}}
function duplicate(){if(!editor.value||locked.value)return;const p=editor.value;editor.value={title:p.title+'（副本）',content:p.content,excerpt:p.excerpt,category:p.category,status:'draft',tags:[...p.tags],tagsText:p.tagsText,cover:p.cover,id:null,version:0,pinned:false};base.value='';pending.value='';editorMode.value='edit';notify('已复制为新草稿，请保存。');}
async function exportBackup(){if(locked.value)return;busy.value=true;try{const data=await api('/api/admin/export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='naiyael-content-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('内容备份已导出，包含草稿和回收站中的内容；图片保留为原链接。');}catch(e){error.value=e.message;}finally{busy.value=false;}}
async function importBackup(event){const file=event.target.files?.[0];event.target.value='';if(!file||locked.value)return;if(file.size>2*1024*1024){error.value='备份文件不能超过 2 MB';return;}busy.value=true;error.value='';message.value='';try{const text=await file.text();const res=await api('/api/admin/import',{method:'POST',headers:{'Content-Type':'application/json'},body:text});notify(`备份导入完成：新增 ${res.imported} 篇${res.skipped?`，跳过 ${res.skipped} 篇已存在内容`:''}。`);await Promise.all([loadPosts(),loadCategories()]);}catch(e){error.value=e.message;}finally{busy.value=false;}}
async function upload(event,isCover){const file=event.target.files?.[0];event.target.value='';if(!file||locked.value)return;if(file.size>5*1024*1024){error.value='图片不能超过 5 MB';return;}uploading.value=true;error.value='';try{const d=await api('/api/admin/uploads',{method:'POST',headers:{'Content-Type':file.type},body:file});if(isCover)editor.value.cover=d.url;else insert(`\n![图片说明](${d.url})\n`);notify(isCover?'封面已上传，请保存文章。':'图片已插入正文，请保存文章。');}catch(e){error.value=e.message;}finally{uploading.value=false;}}
function toggleImageInsert(){if(editorMode.value==='preview')editorMode.value='edit';imageInsertOpen.value=!imageInsertOpen.value;imageInsertError.value='';if(imageInsertOpen.value){imageUrl.value='';imageAlt.value='';}}
function confirmInsertImage(){const url=imageUrl.value.trim();if(!validImageUrl(url)){imageInsertError.value='请填写有效的 https:// 图片链接，或站内 /images/ 路径';return;}const alt=(imageAlt.value.trim()||'图片说明').replace(/[\[\]]/g,'');insert(`\n![${alt}](${url})\n`);imageInsertOpen.value=false;imageUrl.value='';imageAlt.value='';imageInsertError.value='';}
function insert(text,before='',after=''){if(!editor.value)return;if(editorMode.value==='preview')editorMode.value='edit';nextTick(()=>{const el=bodyInput.value;if(!el){editor.value.content+=before?before+text+after:text;return;}const start=el.selectionStart,end=el.selectionEnd,selected=editor.value.content.slice(start,end);const chunk=before?before+(selected||text)+after:text;editor.value.content=editor.value.content.slice(0,start)+chunk+editor.value.content.slice(end);const pos=start+chunk.length;nextTick(()=>{el.focus();el.setSelectionRange(pos,pos);});});}
function handleBodyTab(e){if(!editor.value)return;const el=bodyInput.value;if(!el)return;const start=el.selectionStart,end=el.selectionEnd;editor.value.content=editor.value.content.slice(0,start)+'  '+editor.value.content.slice(end);nextTick(()=>el.setSelectionRange(start+2,start+2));}
async function submitLogin(){if(loggingIn.value||!loginPassword.value)return;loggingIn.value=true;error.value='';try{const d=await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:loginPassword.value})});loginPassword.value='';authorized.value=true;authMode.value=d.authMode||'password';uploadsEnabled.value=!!d.uploadsEnabled;await Promise.all([loadPosts(),loadCategories()]);}catch(e){error.value=e.message;}finally{loggingIn.value=false;}}
async function logout(){if(locked.value)return;if((dirty.value||navigationDirty.value)&&!window.confirm('当前有未保存的修改，确定退出登录吗？'))return;if(authMode.value==='access'){window.location.href='/cdn-cgi/access/logout';return;}busy.value=true;try{await api('/api/auth/logout',{method:'POST'});editorDialog.value?.close();editor.value=null;base.value='';authorized.value=false;authMode.value=null;posts.value=[];message.value='';error.value='';}catch(e){error.value=e.message;}finally{busy.value=false;}}
function preventLeave(e){if(dirty.value||navigationDirty.value||busy.value){e.preventDefault();e.returnValue='';}}
function shortcut(e){if(e.key==='Escape'&&draggingId.value){suppressCardClickUntil=Date.now()+500;cancelCardDrag();return;}if(panel.value==='content'&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(editor.value&&!pending.value)save(editor.value.status);}}
onMounted(async()=>{window.addEventListener('beforeunload',preventLeave);window.addEventListener('keydown',shortcut);document.addEventListener('pointermove',moveCardPointer,{passive:false});document.addEventListener('pointerup',endCardPointer);document.addEventListener('pointercancel',cancelCardDrag);try{const status=await api('/api/auth/status');authMethods.value=status.methods||{password:false,access:false};uploadsEnabled.value=!!status.uploadsEnabled;if(status.authenticated){authorized.value=true;authMode.value=status.authMode||null;await Promise.all([loadPosts(),loadCategories()]);}}catch(e){error.value=e.message;}finally{ready.value=true;}});
onUnmounted(()=>{loadSequence++;cancelCardDrag();window.removeEventListener('beforeunload',preventLeave);window.removeEventListener('keydown',shortcut);document.removeEventListener('pointermove',moveCardPointer);document.removeEventListener('pointerup',endCardPointer);document.removeEventListener('pointercancel',cancelCardDrag);});
</script>
<template>
<div class="cms-admin cms-card-admin">
  <header class="cms-heading"><div><span class="cms-eyebrow">NAIYAEL / WORKSPACE</span><h1>内容管理</h1><p>点击卡片编辑，拖动卡片或右上角手柄排序 · 松手自动保存。</p></div><div class="cms-heading-actions"><input v-if="authorized" ref="importInput" type="file" accept="application/json,.json" hidden @change="importBackup"><button v-if="authorized" class="cms-inline-action" @click="importInput.click()" :disabled="locked"><svg class="ui-btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 10.5V3M5 5.8 8 2.8l3 3M3 12.5h10"/></svg><span>导入备份</span></button><button v-if="authorized" class="cms-inline-action" @click="exportBackup" :disabled="locked"><svg class="ui-btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.8v7.5M5 7.5l3 3 3-3M3 12.5h10"/></svg><span>导出备份</span></button><button v-if="authorized" @click="logout" :disabled="locked">退出登录</button><a href="/" class="cms-text-link cms-view-site">查看网站<svg class="site-nav-ext" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg></a></div></header>
  <p v-if="!ready" class="cms-muted">正在加载后台…</p>
  <div v-else-if="!authorized" class="cms-login">
    <h2>欢迎回来</h2>
    <template v-if="authMethods.password">
      <p>输入管理密码登录后台，在线管理文章、草稿与站点导航。</p>
      <form class="cms-login-form" @submit.prevent="submitLogin">
        <label class="cms-field"><span>管理密码</span><input v-model="loginPassword" type="password" autocomplete="current-password" placeholder="请输入管理密码" :disabled="loggingIn" required></label>
        <button class="cms-primary cms-inline-action" type="submit" :disabled="loggingIn||!loginPassword"><span>{{loggingIn?'正在验证…':'登录管理后台'}}</span><svg v-if="!loggingIn" class="ui-arrow-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg></button>
      </form>
    </template>
    <div v-if="authMethods.access" class="cms-access-login" :class="{'has-divider':authMethods.password}">
      <p>{{authMethods.password?'或通过 Cloudflare Zero Trust Access 验证登录：':'使用 Cloudflare Zero Trust Access 登录后管理网站内容。'}}</p>
      <a :class="[authMethods.password?'cms-access-link':'cms-primary','cms-inline-action']" href="/cdn-cgi/access/login?redirect_url=%2Fadmin.html"><span>使用 Cloudflare Access 登录</span><svg class="ui-arrow-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg></a>
    </div>
    <p v-if="!authMethods.password&&!authMethods.access">后台尚未配置登录凭证。请在 Cloudflare Worker 密钥中设置 <code>ADMIN_PASSWORD</code>（本地开发请在 <code>.dev.vars</code> 中配置），或配置 Cloudflare Access。</p>
    <p v-if="error" class="cms-error">{{error}}</p>
  </div>
  <template v-else>
    <nav class="cms-section-tabs" aria-label="管理功能"><button :class="{active:panel==='content'}" @click="changePanel('content')">文章与日常</button><button :class="{active:panel==='navigation'}" @click="changePanel('navigation')">顶部导航</button><button :class="{active:panel==='stack'}" @click="changePanel('stack')">常用栈</button></nav>
    <div class="cms-notification" role="status" v-if="message&&!editor">✓ {{message}}</div><div class="cms-error cms-notification" role="alert" v-if="error&&!editor">{{error}}</div>
    <NavigationEditor v-if="panel==='navigation'" :categories="categoryOptions" @dirty-change="navigationDirty=$event" />
    <StackEditor v-else-if="panel==='stack'" @dirty-change="navigationDirty=$event" />
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
          <button class="cms-create-card" @click="create" :disabled="locked" aria-label="新建内容"><span class="cms-create-plus" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 4.5v11M4.5 10h11"/></svg></span><strong>写一篇新的</strong><span>文章、题解，或一段日常</span></button>
          <article v-for="post in posts" :key="post.id" class="cms-admin-post" :data-post-id="post.id" :class="{'is-pinned':post.pinned,'is-dragging':draggingId===post.id,'is-drop-before':dropId===post.id&&dropSide==='before'&&!invalidDrop,'is-drop-after':dropId===post.id&&dropSide==='after'&&!invalidDrop}" @pointerdown="startCardDrag($event,post)" @click.capture="captureCardClick" @dragstart.prevent @keydown.alt.up.prevent="moveByKeyboard(post,-1)" @keydown.alt.down.prevent="moveByKeyboard(post,1)"><button class="cms-content-card" @click="edit(post)" :disabled="locked" :aria-label="'编辑：'+post.title" aria-describedby="cms-sort-help">
            <img v-if="post.cover" :src="post.cover" alt="" loading="lazy">
            <span class="cms-card-copy"><span class="cms-card-meta" :class="{'has-grip':post.status!=='trash'&&!post.cover}"><span class="cms-card-category">{{categoryLabel(post.category)}}</span><span v-if="post.pinned" class="post-pin-badge">置顶</span><time>{{dateLabel(post.updatedAt)}}</time><span class="cms-card-status" :class="post.status">{{statusNames[post.status]}}</span></span><strong class="cms-card-title">{{post.title}}</strong><span class="cms-card-excerpt">{{post.excerpt||'还没有摘要，点开继续写。'}}</span><span class="cms-card-bottom"><span v-if="post.tags.length" class="cms-card-tags"><span v-for="tag in post.tags.slice(0,3)" :key="tag"># {{tag}}</span></span><span class="cms-card-edit-hint" aria-hidden="true">{{post.status==='trash'?'查看':'编辑'}}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg></span></span></span>
          </button><button v-if="post.status!=='trash'" class="cms-card-grip" :class="{'on-cover':!!post.cover}" @pointerdown.stop.prevent="startCardDrag($event,post,true)" @click.stop="notify('按住卡片或右上角手柄拖动排序，也支持 Alt + 上下方向键；松手自动保存。')" :disabled="locked" :aria-label="'拖动排序：'+post.title" aria-describedby="cms-sort-help" title="按住拖动排序"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="3.5" r="1.25"/><circle cx="10.5" cy="3.5" r="1.25"/><circle cx="5.5" cy="8" r="1.25"/><circle cx="10.5" cy="8" r="1.25"/><circle cx="5.5" cy="12.5" r="1.25"/><circle cx="10.5" cy="12.5" r="1.25"/></svg></button></article>
        </div>
        <p v-if="loading&&!posts.length" class="cms-library-empty" role="status">正在加载内容…</p><p v-else-if="!posts.length" class="cms-library-empty">{{filter==='trash'?'回收站是空的。':search||category?'没有匹配的内容，试试其他关键词或分类。':'点击加号，写下第一篇记录。'}}</p>
        <div class="cms-pagination" v-if="total>30"><button class="ui-page-btn" :disabled="page===1||loading" @click="page--;refresh()" aria-label="上一页"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8 10 12.5"/></svg></button><span>{{page}} / {{Math.ceil(total/30)}}</span><button class="ui-page-btn" :disabled="page*30>=total||loading" @click="page++;refresh()" aria-label="下一页"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg></button></div>
      </section>
      <dialog v-if="editor" ref="editorDialog" class="cms-edit-dialog cms-studio-dialog" :class="{'is-split':editorMode==='split'}" aria-labelledby="cms-dialog-title" @cancel.prevent="closeEditor" @click.self="closeEditor">
      <section class="cms-editor cms-studio-editor">
        <header class="cms-studio-bar">
          <div class="cms-studio-bar-left">
            <h2 id="cms-dialog-title">{{editor.id?'编辑内容':'新建内容'}}</h2>
            <span class="cms-status-pill" :class="inTrash?'is-trash':dirty?'is-dirty':editor.id?'is-'+editor.status:'is-draft'">
              <i aria-hidden="true"></i>{{inTrash?'回收站':dirty?'未保存修改':editor.id?statusNames[editor.status]:'新草稿'}}
            </span>
          </div>
          <div class="cms-studio-bar-right">
            <template v-if="!inTrash">
              <button type="button" class="cms-secondary-btn" @click="save('draft')" :disabled="locked">保存草稿</button>
              <button type="button" class="cms-primary cms-inline-action" @click="save('published')" :disabled="locked">
                <span>{{busy?'保存中…':editor.status==='published'?'更新发布':'发布内容'}}</span>
                <svg v-if="!busy" class="ui-arrow-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5"/></svg>
              </button>
            </template>
            <button v-else type="button" class="cms-primary" @click="askAction('restore')" :disabled="locked">恢复内容</button>
            <button type="button" class="cms-dialog-close" @click="closeEditor" :disabled="locked" aria-label="关闭编辑窗口" title="关闭 (ESC)">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>
            </button>
          </div>
        </header>

        <div class="cms-studio-body">
          <div class="cms-notification" role="status" v-if="message">✓ {{message}}</div>
          <div class="cms-error cms-notification" role="alert" v-if="error">{{error}}</div>
          <div v-if="pending" class="cms-confirm" role="alertdialog" aria-labelledby="confirm-heading">
            <h2 id="confirm-heading">{{pending==='delete'?'彻底删除内容？':pending==='trash'?'移到回收站？':'恢复内容？'}}</h2>
            <p>《{{editor.title}}》</p>
            <p>{{pending==='delete'?'此操作无法撤销。请输入完整标题确认删除。':pending==='trash'?'移入后网站不再展示，可以在回收站恢复。':'将恢复为'+statusNames[editor.previousStatus||'draft']+'，已发布的内容会重新显示在网站上。'}}</p>
            <input v-if="pending==='delete'" v-model="confirmTitle" aria-label="输入标题确认删除" :placeholder="editor.title">
            <div><button type="button" @click="pending=''" :disabled="locked">取消</button><button type="button" :class="pending==='delete'?'cms-danger':'cms-primary'" @click="executeAction" :disabled="locked||(pending==='delete'&&confirmTitle!==editor.title)">{{busy?'处理中…':pending==='delete'?'确认彻底删除':pending==='trash'?'确认移入':'确认恢复'}}</button></div>
          </div>
          <p v-if="editor.pageKey&&!inTrash" class="cms-page-note">这是网站内置页面，可自由修改标题与正文。{{editor.pageKey!=='about'?'算法图表和自动同步会继续保留。':'头像会继续保留。'}}</p>
          <p v-if="inTrash" class="cms-page-note">移入时间：{{dateLabel(editor.trashedAt)}}。恢复后可以继续编辑。</p>

          <fieldset :disabled="locked||inTrash||!!pending" class="cms-fields">
            <!-- Hero Title -->
            <div class="cms-title-hero">
              <input ref="titleInput" class="cms-title-input" v-model="editor.title" placeholder="输入文章标题…" maxlength="160" aria-label="文章标题">
            </div>

            <!-- Compact Metadata Grid: Category + Tags + Pin -->
            <div class="cms-meta-grid">
              <label class="cms-meta-field">
                <span>分类</span>
                <input v-model="editor.category" list="cms-category-options" maxlength="40" placeholder="文章 / 题解 / 日常…" aria-label="文章分类">
                <datalist id="cms-category-options"><option v-for="label in categoryOptions" :key="label" :value="label" /></datalist>
              </label>

              <label class="cms-meta-field">
                <span>标签 <small>逗号分隔</small></span>
                <input v-model="editor.tagsText" placeholder="图论, 最短路, C++" aria-label="文章标签">
              </label>

              <label class="cms-pin-compact" title="保存后生效，仅已发布内容会在前台置顶">
                <span class="cms-pin-compact-copy"><strong>置顶</strong><small>前台优先</small></span>
                <input type="checkbox" role="switch" v-model="editor.pinned" aria-label="置顶这篇内容">
              </label>
            </div>

            <div v-if="parsedTags.length" class="cms-tag-preview" aria-label="已识别标签预览">
              <span v-for="t in parsedTags" :key="t"># {{t}}</span>
            </div>

            <!-- Collapsible Excerpt & Cover -->
            <details class="cms-extra-fields cms-extra-panel">
              <summary>
                <svg class="cms-extra-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>
                <strong>摘要与封面</strong>
                <span class="cms-extra-badges">
                  <em v-if="editor.excerpt">已填摘要</em>
                  <em v-if="editor.cover">已设封面</em>
                  <em v-if="!editor.excerpt&&!editor.cover" class="is-muted">可选 · 摘要留空自动生成</em>
                </span>
              </summary>
              <div class="cms-extra-content">
                <label class="cms-field"><span>摘要 <small>可留空，保存时自动取正文前 130 字</small></span><textarea v-model="editor.excerpt" rows="2" maxlength="400" placeholder="简短概括文章核心内容…" aria-label="文章摘要"></textarea></label>
                <div class="cms-cover-field"><span>封面 <small>可选 · 建议 16:9 横图</small></span><p class="cms-field-help">填写 <code>https://</code> 图床链接或站内 <code>/images/</code> 路径{{uploadsEnabled?'，或直接本地上传（最大 5 MB）':''}}。</p><div class="cms-cover-url-row"><input v-model.trim="editor.cover" type="url" maxlength="500" placeholder="https://example.com/cover.jpg 或 /images/mountain-lake.jpg" aria-label="封面图片链接"><button v-if="uploadsEnabled" type="button" @click="coverInput.click()">{{uploading?'上传中…':editor.cover?'更换上传':'上传'}}</button><button v-if="editor.cover" type="button" @click="editor.cover=''">移除封面</button></div><CoverPreview :post="editor" /></div>
              </div>
            </details>

            <input v-if="uploadsEnabled" ref="coverInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="upload($event,true)">
            <input v-if="uploadsEnabled" ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="upload($event,false)">

            <!-- Integrated Markdown Composer -->
            <div class="cms-composer">
              <div class="cms-composer-bar">
                <div class="cms-composer-tools" role="toolbar" aria-label="Markdown 格式工具">
                  <button type="button" title="二级标题" aria-label="插入二级标题" @click="insert('小标题','\n## ','\n')">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 3.5v9M8 3.5v9M2.5 8H8M11 6.8a1.5 1.5 0 0 1 2.6 1c0 1.4-2.6 2.5-2.6 4.7h3"/></svg>
                  </button>
                  <button type="button" title="加粗" aria-label="加粗" @click="insert('加粗文字','**','**')">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 3.5h4a2.2 2.2 0 0 1 0 4.4h-4V3.5Zm0 4.4h4.7a2.3 2.3 0 0 1 0 4.6H4.5V7.9Z"/></svg>
                  </button>
                  <button type="button" title="斜体" aria-label="斜体" @click="insert('斜体文字','*','*')">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6.5 3.5h5M4.5 12.5h5M9.5 3.5l-3 9"/></svg>
                  </button>
                  <button type="button" title="引用" aria-label="插入引用" @click="insert('引用内容','\n> ','\n')">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4v8M6.5 5.5h6.5M6.5 8.5h5M6.5 11.5h6"/></svg>
                  </button>
                  <button type="button" title="无序列表" aria-label="插入无序列表" @click="insert('列表项','\n- ','\n')">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" aria-hidden="true"><circle cx="3" cy="4.5" r=".9" fill="currentColor" stroke="none"/><circle cx="3" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="3" cy="11.5" r=".9" fill="currentColor" stroke="none"/><path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5"/></svg>
                  </button>
                  <span class="cms-tool-sep" aria-hidden="true"></span>
                  <button type="button" title="行内代码" aria-label="插入行内代码" @click="insert('code','`','`')">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5.5 5-3 3 3 3M10.5 5l3 3-3 3"/></svg>
                  </button>
                  <button type="button" title="C++ 代码块" aria-label="插入代码块" @click="insert('\n```cpp\n// 代码\n```\n')">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2.8" width="12" height="10.4" rx="2"/><path d="m5.8 6.2-1.8 1.8 1.8 1.8M10.2 6.2 12 8l-1.8 1.8M8.7 5.8 7.3 10.2"/></svg>
                    <span>代码块</span>
                  </button>
                  <button type="button" title="插入链接" aria-label="插入链接" @click="insert('链接文字','[','](https://)')">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.8 9.2a3 3 0 0 0 4.2 0l1.8-1.8a3 3 0 0 0-4.2-4.2L7.5 4.3M9.2 6.8a3 3 0 0 0-4.2 0L3.2 8.6a3 3 0 0 0 4.2 4.2l1.1-1.1"/></svg>
                  </button>
                  <button type="button" :class="{'is-active':imageInsertOpen}" title="插入图片链接" aria-label="插入图片链接" @click="toggleImageInsert">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2.8" width="12" height="10.4" rx="2"/><circle cx="5.6" cy="6.2" r="1"/><path d="m2.5 11.5 3.4-3.2 2.4 2.2 1.8-1.6 3.4 2.6"/></svg>
                    <span>图片</span>
                  </button>
                  <button v-if="uploadsEnabled" type="button" title="本地上传图片" aria-label="本地上传图片" @click="imageInput.click()">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 10.5V3M5 5.8 8 2.8l3 3M3 12.5h10"/></svg>
                    <span>上传</span>
                  </button>
                </div>

                <div class="cms-mode-switch" role="tablist" aria-label="编辑视图模式">
                  <button type="button" role="tab" :aria-selected="editorMode==='edit'" :class="{active:editorMode==='edit'}" @click="editorMode='edit'">编辑</button>
                  <button type="button" role="tab" class="cms-mode-split-btn" :aria-selected="editorMode==='split'" :class="{active:editorMode==='split'}" @click="editorMode='split'">分屏</button>
                  <button type="button" role="tab" :aria-selected="editorMode==='preview'" :class="{active:editorMode==='preview'}" @click="editorMode='preview'">预览</button>
                </div>
              </div>

              <div v-if="editorMode!=='preview'&&imageInsertOpen" class="cms-image-insert">
                <input v-model="imageUrl" type="url" placeholder="图片链接：https://... 或 /images/..." aria-label="插入图片链接" @keydown.enter.prevent="confirmInsertImage">
                <input v-model="imageAlt" type="text" placeholder="图片说明（可选）" aria-label="图片说明" @keydown.enter.prevent="confirmInsertImage">
                <button type="button" class="cms-primary" @click="confirmInsertImage">插入</button>
                <button type="button" @click="imageInsertOpen=false">取消</button>
                <p v-if="imageInsertError" class="cms-error">{{imageInsertError}}</p>
              </div>

              <div class="cms-composer-panes" :class="'mode-'+editorMode">
                <textarea
                  v-if="editorMode!=='preview'"
                  ref="bodyInput"
                  class="cms-body-input"
                  v-model="editor.content"
                  placeholder="从这里开始写作… 支持 Markdown、代码高亮与自动目录"
                  aria-label="文章正文"
                  spellcheck="false"
                  @keydown.tab.prevent="handleBodyTab"
                ></textarea>
                <div v-if="editorMode!=='edit'" class="cms-body-preview">
                  <ArticleContent v-if="editor.content" :content="editor.content" compact />
                  <p v-else class="cms-muted">实时预览会显示在这里…</p>
                </div>
              </div>
            </div>
          </fieldset>
        </div>

        <footer class="cms-studio-foot">
          <div class="cms-studio-stats">
            <span>{{editorStats.label}}</span>
            <span class="cms-foot-dot" aria-hidden="true">·</span>
            <span>{{editor.id?'最后保存 '+dateLabel(editor.updatedAt):'尚未保存'}}</span>
            <span class="cms-foot-kbd">Ctrl + S 保存</span>
          </div>
          <div class="cms-studio-actions">
            <a v-if="editor.id&&editor.status==='published'" class="ui-inline-link" :href="editor.pageKey?`/${editor.pageKey}.html`:`/post.html?id=${editor.id}`" target="_blank" rel="noopener noreferrer">查看线上<svg class="ui-ext-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5H12.5V9.5M12.5 3.5L6 10"/><path d="M10.5 11.5v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/></svg></a>
            <button v-if="!inTrash" type="button" @click="duplicate" :disabled="locked">复制草稿</button>
            <button v-if="editor.id&&!inTrash&&editor.status!=='archived'" type="button" @click="save('archived')" :disabled="locked">归档</button>
            <button v-if="editor.id" type="button" class="cms-danger-text" @click="askAction(inTrash?'delete':'trash')" :disabled="locked">{{inTrash?'彻底删除':'移到回收站'}}</button>
          </div>
        </footer>
      </section>
      </dialog>
    </div>
  </template>
  <Teleport to="body"><div v-if="dragPost" class="cms-card-drag-ghost" :class="{'is-invalid':invalidDrop}" :style="dragGhostStyle" aria-hidden="true"><svg class="ui-grip-icon" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="3.5" r="1.25"/><circle cx="10.5" cy="3.5" r="1.25"/><circle cx="5.5" cy="8" r="1.25"/><circle cx="10.5" cy="8" r="1.25"/><circle cx="5.5" cy="12.5" r="1.25"/><circle cx="10.5" cy="12.5" r="1.25"/></svg><div><strong>{{dragPost.title}}</strong><small>{{invalidDrop?'请拖到同一置顶分组':dropId?'松手，自动保存':'拖到另一张卡片旁边'}}</small></div></div></Teleport>
</div>
</template>
