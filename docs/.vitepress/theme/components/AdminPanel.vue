<script setup>
import {ref,computed,onMounted,onUnmounted} from 'vue';
import {api,renderMarkdown,categoryLabel,dateLabel} from './cms-client';
import CoverPreview from './CoverPreview.vue';
import NavigationEditor from './NavigationEditor.vue';
const authorized=ref(false),ready=ref(false),busy=ref(false),uploading=ref(false),loading=ref(false);
const message=ref(''),error=ref(''),posts=ref([]),filter=ref(''),category=ref(''),query=ref(''),search=ref('');
const page=ref(1),total=ref(0),counts=ref({}),editor=ref(null),base=ref(''),preview=ref(false);
const panel=ref('content'),navigationDirty=ref(false),knownCategories=ref([]);
const categoryOptions=computed(()=>[...new Set(['文章','题解','日常',...knownCategories.value.map(item=>categoryLabel(item.key))])]);
const bodyInput=ref(null),coverInput=ref(null),imageInput=ref(null),pending=ref(''),confirmTitle=ref('');
const statusNames={draft:'草稿',published:'已发布',archived:'已归档',trash:'回收站'};
const dirty=computed(()=>editor.value&&JSON.stringify(editor.value)!==base.value);
const rendered=computed(()=>renderMarkdown(editor.value?.content));
const locked=computed(()=>busy.value||uploading.value);
const inTrash=computed(()=>editor.value?.status==='trash');
let loadSequence=0;
function notify(text){message.value=text;error.value='';}
function setEditor(p){editor.value={...p,category:categoryLabel(p.category),tagsText:p.tags.join(', ')};base.value=JSON.stringify(editor.value);pending.value='';}
async function loadCategories(){knownCategories.value=(await api('/api/admin/categories')).categories;}
function changePanel(value){if(panel.value===value||locked.value)return;if((dirty.value||navigationDirty.value)&&!window.confirm('当前有未保存的修改，确定放弃并切换吗？'))return;if(dirty.value){editor.value=base.value?JSON.parse(base.value):null;}panel.value=value;navigationDirty.value=false;message.value='';error.value='';}
async function loadPosts(){const seq=++loadSequence;loading.value=true;try{const params=new URLSearchParams({page:String(page.value),status:filter.value,category:category.value,q:search.value});const d=await api('/api/admin/posts?'+params);if(seq!==loadSequence)return;posts.value=d.posts;total.value=d.total;counts.value=d.counts;if(page.value>1&&!d.posts.length){page.value--;return await loadPosts();}}finally{if(seq===loadSequence)loading.value=false;}}
async function refresh(){try{await loadPosts();}catch(e){error.value=e.message;}}
async function changeFilter(value){filter.value=value;page.value=1;await refresh();}
function runSearch(){search.value=query.value.trim();page.value=1;refresh();}
function leaveEditor(){return !dirty.value||window.confirm('当前内容还没有保存，确定放弃修改吗？');}
function create(){if(locked.value||!leaveEditor())return;editor.value={id:null,title:'',content:'',excerpt:'',category:'文章',status:'draft',tagsText:'',tags:[],cover:'',version:0};base.value=JSON.stringify(editor.value);preview.value=false;pending.value='';message.value='';error.value='';}
async function edit(post){if(locked.value||!leaveEditor())return;busy.value=true;try{setEditor((await api('/api/admin/posts/'+post.id)).post);preview.value=false;message.value='';error.value='';}catch(e){error.value=e.message;}finally{busy.value=false;}}
async function save(status){if(!editor.value||locked.value||inTrash.value)return;busy.value=true;error.value='';message.value='';try{const body={...editor.value,status,tags:editor.value.tagsText.split(/[,，]/).map(s=>s.trim()).filter(Boolean)};const d=await api('/api/admin/posts'+(body.id?'/'+body.id:''),{method:body.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});setEditor(d.post);notify(status==='published'?'已发布，网站已更新。':status==='archived'?'已归档，访客将看不到这篇内容。':'草稿已保存。');await Promise.all([loadPosts(),loadCategories()]);}catch(e){error.value=e.message;}finally{busy.value=false;}}
function askAction(action){if(locked.value||!leaveEditor())return;pending.value=action;confirmTitle.value='';}
async function executeAction(){if(!editor.value||locked.value)return;const action=pending.value;busy.value=true;error.value='';try{const d=await api('/api/admin/posts/'+editor.value.id,{method:action==='delete'?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,version:editor.value.version,confirmTitle:confirmTitle.value})});if(action==='delete'){editor.value=null;base.value='';notify('已彻底删除。');}else{setEditor(d.post);notify(action==='trash'?'已移到回收站，访客将看不到这篇内容。':'已恢复为'+statusNames[d.post.status]+'。');}pending.value='';await Promise.all([loadPosts(),loadCategories()]);}catch(e){error.value=e.message;}finally{busy.value=false;}}
function duplicate(){if(!editor.value||locked.value)return;const p=editor.value;editor.value={title:p.title+'（副本）',content:p.content,excerpt:p.excerpt,category:p.category,status:'draft',tags:[...p.tags],tagsText:p.tagsText,cover:p.cover,id:null,version:0};base.value='';pending.value='';preview.value=false;notify('已复制为新草稿，请保存。');}
async function exportBackup(){if(locked.value)return;busy.value=true;try{const data=await api('/api/admin/export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='naiyael-content-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('内容备份已导出，包含草稿和回收站中的内容；图片保留为原链接。');}catch(e){error.value=e.message;}finally{busy.value=false;}}
async function upload(event,isCover){const file=event.target.files?.[0];event.target.value='';if(!file||locked.value)return;if(file.size>5*1024*1024){error.value='图片不能超过 5 MB';return;}uploading.value=true;error.value='';try{const d=await api('/api/admin/uploads',{method:'POST',headers:{'Content-Type':file.type},body:file});if(isCover)editor.value.cover=d.url;else insert(`\n![图片说明](${d.url})\n`);notify(isCover?'封面已上传，请保存文章。':'图片已插入正文，请保存文章。');}catch(e){error.value=e.message;}finally{uploading.value=false;}}
function insert(text,before='',after=''){if(!editor.value)return;const el=bodyInput.value;if(!el){editor.value.content+=text;return;}const start=el.selectionStart,end=el.selectionEnd,selected=editor.value.content.slice(start,end);editor.value.content=editor.value.content.slice(0,start)+(before?before+(selected||text)+after:text)+editor.value.content.slice(end);}
function preventLeave(e){if(dirty.value||navigationDirty.value){e.preventDefault();e.returnValue='';}}
function shortcut(e){if(panel.value==='content'&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(editor.value&&!pending.value)save(editor.value.status);}}
onMounted(async()=>{window.addEventListener('beforeunload',preventLeave);window.addEventListener('keydown',shortcut);try{await api('/api/admin/session');authorized.value=true;await Promise.all([loadPosts(),loadCategories()]);}catch(e){if(e.status!==403)error.value=e.message;}finally{ready.value=true;}});
onUnmounted(()=>{loadSequence++;window.removeEventListener('beforeunload',preventLeave);window.removeEventListener('keydown',shortcut);});
</script>
<template>
<div class="cms-admin">
  <header class="cms-heading"><div><span class="cms-eyebrow">NAIYAEL / WORKSPACE</span><h1>内容管理</h1><p>写作、修改，也整理过去的记录。</p></div><div class="cms-heading-actions"><button v-if="authorized" @click="exportBackup" :disabled="locked">导出备份 ↓</button><a href="/" class="cms-text-link">查看网站 ↗</a></div></header>
  <p v-if="!ready" class="cms-muted">正在加载后台…</p>
  <div v-else-if="!authorized" class="cms-login"><h2>欢迎回来</h2><p>使用你的 ChatGPT 账号登录后管理网站内容。</p><a class="cms-primary" href="/signin-with-chatgpt?return_to=%2Fadmin.html" target="_top">登录管理后台 →</a><p v-if="error" class="cms-error">{{error}}</p></div>
  <template v-else>
    <nav class="cms-section-tabs" aria-label="管理功能"><button :class="{active:panel==='content'}" @click="changePanel('content')">文章与日常</button><button :class="{active:panel==='navigation'}" @click="changePanel('navigation')">顶部导航</button></nav>
    <div class="cms-notification" role="status" v-if="message">✓ {{message}}</div><div class="cms-error cms-notification" role="alert" v-if="error">{{error}}</div>
    <NavigationEditor v-if="panel==='navigation'" :categories="categoryOptions" @dirty-change="navigationDirty=$event" />
    <div class="cms-workspace" v-else>
      <aside class="cms-posts">
        <div class="cms-posts-header"><h2>我的内容 <small>{{total}}</small></h2><button class="cms-primary" @click="create" :disabled="locked">＋ 写一篇</button></div>
        <form class="cms-search" @submit.prevent="runSearch"><label><span class="cms-sr-only">搜索内容</span><input v-model="query" placeholder="搜索标题、摘要、标签" type="search"></label><button type="submit">搜索</button></form>
        <div class="cms-filter"><button v-for="(label,key) in {all:'全部',draft:'草稿',published:'已发布',archived:'归档',trash:'回收站'}" :key="key" :class="{active:filter===(key==='all'?'':key)}" @click="changeFilter(key==='all'?'':key)">{{label}}<small v-if="key!=='all'">{{counts[key]||0}}</small></button></div>
        <div class="cms-list-controls"><select v-model="category" @change="page=1;refresh()" aria-label="筛选分类"><option value="">所有分类</option><option v-for="label in categoryOptions" :key="label" :value="label">{{label}}</option></select><button @click="refresh" :disabled="loading">{{loading?'加载中…':'刷新列表'}}</button></div>
        <p v-if="loading&&!posts.length" class="cms-list-empty">正在加载…</p><p v-else-if="!posts.length" class="cms-list-empty">{{filter==='trash'?'回收站是空的。':search||category?'没有匹配的内容，试试其他关键词或分类。':'这里还没有内容，写下第一篇吧。'}}</p>
        <button v-for="post in posts" :key="post.id" class="cms-post-row" :class="{selected:editor?.id===post.id}" @click="edit(post)" :disabled="locked"><strong>{{post.title}} <small v-if="post.pageKey">网站页面</small></strong><span><i :class="post.status"></i>{{statusNames[post.status]}} · {{categoryLabel(post.category)}}<time>{{dateLabel(post.updatedAt)}}</time></span><em>点击编辑 →</em></button>
        <div class="cms-pagination" v-if="total>30"><button :disabled="page===1||loading" @click="page--;refresh()">←</button><span>{{page}} / {{Math.ceil(total/30)}}</span><button :disabled="page*30>=total||loading" @click="page++;refresh()">→</button></div>
      </aside>
      <section class="cms-editor" v-if="editor">
        <div class="cms-editor-top"><span :class="{'is-dirty':dirty}">{{inTrash?'已移到回收站':dirty?'有未保存的修改':editor.id?'已保存 · '+statusNames[editor.status]:'新草稿'}}</span><div v-if="!inTrash"><button @click="save('draft')" :disabled="locked">保存草稿</button><button class="cms-primary" @click="save('published')" :disabled="locked">{{busy?'保存中…':editor.status==='published'?'更新发布':'发布内容'}} ↗</button></div><button v-else class="cms-primary" @click="askAction('restore')" :disabled="locked">恢复内容</button></div>
        <div v-if="pending" class="cms-confirm" role="alertdialog" aria-labelledby="confirm-heading"><h2 id="confirm-heading">{{pending==='delete'?'彻底删除内容？':pending==='trash'?'移到回收站？':'恢复内容？'}}</h2><p>《{{editor.title}}》</p><p>{{pending==='delete'?'此操作无法撤销。请输入完整标题确认删除。':pending==='trash'?'移入后网站不再展示，可以在回收站恢复。':'将恢复为'+statusNames[editor.previousStatus||'draft']+'，已发布的内容会重新显示在网站上。'}}</p><input v-if="pending==='delete'" v-model="confirmTitle" aria-label="输入标题确认删除" :placeholder="editor.title"><div><button @click="pending=''" :disabled="locked">取消</button><button :class="pending==='delete'?'cms-danger':'cms-primary'" @click="executeAction" :disabled="locked||(pending==='delete'&&confirmTitle!==editor.title)">{{busy?'处理中…':pending==='delete'?'确认彻底删除':pending==='trash'?'确认移入':'确认恢复'}}</button></div></div>
        <p v-if="editor.pageKey&&!inTrash" class="cms-page-note">这是网站现有页面，可修改标题和正文。{{editor.pageKey!=='about'?'算法图表和自动同步会继续保留。':'头像会继续保留。'}}</p>
        <p v-if="inTrash" class="cms-page-note">移入时间：{{dateLabel(editor.trashedAt)}}。恢复后可以继续编辑。</p>
        <fieldset :disabled="locked||inTrash||!!pending" class="cms-fields">
          <label class="cms-field"><span>标题</span><input v-model="editor.title" placeholder="写一个标题" maxlength="160" aria-label="文章标题"></label>
          <div class="cms-field-row"><label class="cms-field"><span>分类</span><input v-model="editor.category" list="cms-category-options" maxlength="40" placeholder="如：学习笔记、旅行、比赛复盘" aria-label="文章分类"><small class="cms-field-help">直接输入新分类，也可选用已有分类。</small><datalist id="cms-category-options"><option v-for="label in categoryOptions" :key="label" :value="label" /></datalist></label><label class="cms-field"><span>标签</span><input v-model="editor.tagsText" placeholder="用逗号分隔，如 图论, 最短路" aria-label="文章标签"></label></div>
          <label class="cms-field"><span>摘要 <small>可留空，保存时自动生成</small></span><textarea v-model="editor.excerpt" rows="2" maxlength="400" aria-label="文章摘要"></textarea></label>
          <div class="cms-cover-field"><span>封面 <small>可选</small></span><p class="cms-field-help">列表卡片顶部显示封面，文章页显示横向大图。建议使用 16:9 横图；支持 JPG、PNG、WebP、GIF，最大 5 MB。</p><div class="cms-cover-actions"><button @click="coverInput.click()">{{uploading?'上传中…':editor.cover?'更换封面':'＋ 上传封面'}}</button><button v-if="editor.cover" @click="editor.cover=''">移除封面</button></div><CoverPreview :post="editor" /></div>
          <input ref="coverInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="upload($event,true)"><input ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="upload($event,false)">
          <div class="cms-body-heading"><span>正文 <small>支持 Markdown</small></span><div><button :class="{active:!preview}" @click="preview=false">编辑</button><button :class="{active:preview}" @click="preview=true">预览</button></div></div>
          <div class="cms-toolbar" v-if="!preview"><button @click="insert('小标题','\n## ','\n')">H₂ 标题</button><button @click="insert('加粗文字','**','**')"><b>B</b></button><button @click="insert('\n```cpp\n// 代码\n```\n')">&lt;/&gt; 代码</button><button @click="imageInput.click()">＋ 图片</button></div>
          <textarea v-if="!preview" ref="bodyInput" class="cms-body-input" v-model="editor.content" placeholder="从这里开始写…" aria-label="文章正文" spellcheck="false"></textarea><div v-else class="vp-doc cms-body-preview" v-html="rendered||'<p>正文预览会显示在这里。</p>'"></div>
        </fieldset>
        <div class="cms-editor-bottom"><span>{{editor.content.length}} 字符 · {{editor.id?'最后保存 '+dateLabel(editor.updatedAt):'尚未保存'}}</span><div><a v-if="editor.id&&editor.status==='published'" :href="editor.pageKey?`/${editor.pageKey}.html`:`/post.html?id=${editor.id}`" target="_blank" rel="noopener noreferrer">查看内容 ↗</a><button v-if="!inTrash" @click="duplicate" :disabled="locked">复制草稿</button><button v-if="editor.id&&!inTrash&&editor.status!=='archived'" @click="save('archived')" :disabled="locked">归档</button><button v-if="editor.id" class="cms-danger-text" @click="askAction(inTrash?'delete':'trash')" :disabled="locked">{{inTrash?'彻底删除':'移到回收站'}}</button></div></div>
      </section>
      <section class="cms-editor cms-start" v-else><span>✎</span><h2>从一篇记录开始</h2><p>点击左侧内容即可编辑，或新建题解、文章和日常。</p><button class="cms-primary" @click="create" :disabled="locked">开始写作 →</button></section>
    </div>
  </template>
</div>
</template>


