import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {routeAPI,serveMedia}from'../worker/api.mjs';import{createLocalDB}from'../scripts/local-bindings.mjs';
import{renderMarkdown}from'../docs/.vitepress/theme/components/cms-client.js';
const migration=fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync('drizzle/'+f,'utf8')).join('\n');
function fixture(){const DB=createLocalDB();DB.exec(migration);const objects=new Map();return {DB,SITE_ADMIN_EMAIL:'owner@site.test',BUCKET:{async put(k,b,o){objects.set(k,{body:new Blob([b]).stream(),bytes:b,options:o});},async get(k){const v=objects.get(k);return v?{body:new Blob([v.bytes]).stream()}:null;},async delete(k){objects.delete(k);}}};}
function req(path,method='GET',body,auth=true,origin='https://site.test'){const headers=new Headers();if(auth){headers.set('oai-authenticated-user-email','owner@site.test');headers.set('oai-authenticated-user-id','owner-id');}if(method!=='GET'){headers.set('origin',origin);headers.set('content-type','application/json');}return new Request('https://site.test'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});}
const draft={title:'测试题解',content:'## 解题思路\n\n测试正文。',category:'solution',status:'draft',tags:['图论'],excerpt:'',cover:''};
test('draft privacy, publication, conflict detection and reversible archive',async()=>{const env=fixture();try{
  const created=await routeAPI(req('/api/admin/posts','POST',draft),env);assert.equal(created.status,201);const p=(await created.json()).post;
  assert.equal((await(await routeAPI(req('/api/posts', 'GET',undefined,false),env)).json()).total,3);
  assert.equal((await routeAPI(req('/api/posts/'+p.id,'GET',undefined,false),env)).status,404);
  const published=await routeAPI(req('/api/admin/posts/'+p.id,'PUT',{...p,status:'published'}),env);assert.equal(published.status,200);const live=(await published.json()).post;assert.equal(live.version,2);
  assert.equal((await(await routeAPI(req('/api/posts/'+p.id,'GET',undefined,false),env)).json()).post.content,draft.content);
  assert.equal((await routeAPI(req('/api/admin/posts/'+p.id,'PUT',{...p,title:'stale update',status:'published'}),env)).status,409);
  const archived=await routeAPI(req('/api/admin/posts/'+p.id,'PUT',{...live,status:'archived'}),env);assert.equal(archived.status,200);
  assert.equal((await routeAPI(req('/api/posts/'+p.id,'GET',undefined,false),env)).status,404);
  assert.equal((await(await routeAPI(req('/api/admin/posts/'+p.id),env)).json()).post.content,draft.content);
}finally{env.DB.close();}});
test('admin authorization and cross-origin write rejection',async()=>{const env=fixture();try{
  assert.equal((await routeAPI(req('/api/admin/posts','GET',undefined,false),env)).status,403);
  const other=req('/api/admin/posts');other.headers.set('oai-authenticated-user-email','someone@site.test');assert.equal((await routeAPI(other,env)).status,403);
  assert.equal((await routeAPI(req('/api/admin/posts','POST',draft,true,'https://other.test'),env)).status,403);
  assert.equal((await routeAPI(req('/api/admin/posts','POST',{...draft,title:''}),env)).status,400);
}finally{env.DB.close();}});
test('image uploads are typed and draft-only media stays private',async()=>{const env=fixture();try{
  const bytes=fs.readFileSync('docs/public/images/avatar.jpg');const headers={'origin':'https://site.test','content-type':'image/jpeg','oai-authenticated-user-email':'owner@site.test','oai-authenticated-user-id':'owner-id'};
  const response=await routeAPI(new Request('https://site.test/api/admin/uploads',{method:'POST',headers,body:bytes}),env);assert.equal(response.status,201);const image=(await response.json()).url;
  assert.equal((await serveMedia(req(image,'GET',undefined,false),env)).status,404);
  const p=(await(await routeAPI(req('/api/admin/posts','POST',{...draft,status:'published',cover:image}),env)).json()).post;assert.ok(p.id);
  const served=await serveMedia(req(image,'GET',undefined,false),env);assert.equal(served.status,200);assert.deepEqual(Buffer.from(await served.arrayBuffer()),bytes);
  const invalid=await routeAPI(new Request('https://site.test/api/admin/uploads',{method:'POST',headers:{...headers,'content-type':'image/svg+xml'},body:'<svg onload="alert(1)" />'}),env);assert.equal(invalid.status,400);
}finally{env.DB.close();}});
test('Markdown preview escapes HTML and rejects script links',()=>{const html=renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1))');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(renderMarkdown('## 标题\n\n**内容**').includes('<h2>标题</h2>'));});
test('saved content survives reopening the database',async()=>{fs.mkdirSync('.local-state/tests',{recursive:true});const file='.local-state/tests/'+crypto.randomUUID()+'.sqlite';const env=fixture();env.DB.close();env.DB=createLocalDB(file);env.DB.exec(migration);const p=(await(await routeAPI(req('/api/admin/posts','POST',draft),env)).json()).post;env.DB.close();env.DB=createLocalDB(file);assert.equal((await(await routeAPI(req('/api/admin/posts/'+p.id),env)).json()).post.title,draft.title);env.DB.close();});

test('existing pages can be edited, trashed, restored and permanently removed without resurrection',async()=>{const env=fixture();try{
  const list=(await(await routeAPI(req('/api/admin/posts'),env)).json()).posts;
  assert.equal(list.length,3);const id=list.find(p=>p.pageKey==='about').id;
  const original=(await(await routeAPI(req('/api/admin/posts/'+id),env)).json()).post;
  assert.ok(original.content.includes('Naiyael'));
  const edited=await routeAPI(req('/api/admin/posts/'+id,'PUT',{...original,title:'新的介绍',content:'## 最近在做什么\n\n学习算法。'}),env);
  assert.equal(edited.status,200);const p=(await edited.json()).post;
  assert.equal((await(await routeAPI(req('/api/pages/about','GET',undefined,false),env)).json()).post.title,'新的介绍');
  assert.equal((await routeAPI(req('/api/admin/posts/'+id,'DELETE',{version:p.version,confirmTitle:p.title}),env)).status,409);
  const trash=(await(await routeAPI(req('/api/admin/posts/'+id,'PATCH',{action:'trash',version:p.version}),env)).json()).post;
  assert.equal(trash.previousStatus,'published');assert.equal(trash.status,'trash');assert.ok(trash.trashedAt);
  assert.equal((await routeAPI(req('/api/pages/about','GET',undefined,false),env)).status,404);
  assert.equal((await routeAPI(req('/api/admin/posts/'+id,'PUT',{...p,version:trash.version}),env)).status,409);
  assert.equal((await routeAPI(req('/api/admin/posts/'+id,'PATCH',{action:'restore',version:p.version}),env)).status,409);
  const restored=(await(await routeAPI(req('/api/admin/posts/'+id,'PATCH',{action:'restore',version:trash.version}),env)).json()).post;
  assert.equal(restored.status,'published');assert.equal(restored.trashedAt,null);
  assert.equal((await routeAPI(req('/api/pages/about','GET',undefined,false),env)).status,200);
  const t=(await(await routeAPI(req('/api/admin/posts/'+id,'PATCH',{action:'trash',version:restored.version}),env)).json()).post;
  assert.equal((await routeAPI(req('/api/admin/posts/'+id,'DELETE',{version:t.version,confirmTitle:'wrong'}),env)).status,400);
  assert.equal((await routeAPI(req('/api/admin/posts/'+id,'DELETE',{version:t.version,confirmTitle:t.title}),env)).status,200);
  assert.equal((await routeAPI(req('/api/admin/posts/'+id),env)).status,404);
  assert.equal((await routeAPI(req('/api/admin/posts/'+id,'PUT',{...original,version:t.version+1}),env)).status,404);
  assert.equal((await routeAPI(req('/api/pages/about','GET',undefined,false),env)).status,404);
  assert.equal((await(await routeAPI(req('/api/posts','GET',undefined,false),env)).json()).total,2);
  const exported=await(await routeAPI(req('/api/admin/export'),env)).json();assert.ok(!exported.posts.some(p=>p.id===id));
}finally{env.DB.close();}});

test('ordinary post deletion, search, filters, counts and private content backup',async()=>{const env=fixture();try{
  const p=(await(await routeAPI(req('/api/admin/posts','POST',{...draft,title:'100%_ 图论日记',category:'daily'}),env)).json()).post;
  const search=await(await routeAPI(req('/api/admin/posts?q='+encodeURIComponent('%_')+'&category=daily'),env)).json();
  assert.equal(search.total,1);assert.equal(search.posts[0].id,p.id);assert.equal(search.counts.draft,1);assert.equal(search.counts.published,3);
  assert.equal((await(await routeAPI(req('/api/admin/posts?q='+encodeURIComponent("' OR 1=1 --")),env)).json()).total,0);
  assert.equal((await(await routeAPI(req('/api/posts?q='+encodeURIComponent('图论日记'),'GET',undefined,false),env)).json()).total,0);
  const backup=await(await routeAPI(req('/api/admin/export'),env)).json();assert.equal(backup.posts.find(x=>x.id===p.id).content,draft.content);
  assert.equal((await routeAPI(req('/api/admin/export','GET',undefined,false),env)).status,403);
  assert.equal((await routeAPI(req('/api/admin/posts/'+p.id,'PATCH',{action:'trash',version:p.version},true,'https://other.test'),env)).status,403);
  const t=(await(await routeAPI(req('/api/admin/posts/'+p.id,'PATCH',{action:'trash',version:p.version}),env)).json()).post;
  assert.equal((await(await routeAPI(req('/api/admin/posts'),env)).json()).total,3);
  assert.equal((await(await routeAPI(req('/api/admin/posts?status=trash'),env)).json()).total,1);
  const restored=(await(await routeAPI(req('/api/admin/posts/'+p.id,'PATCH',{action:'restore',version:t.version}),env)).json()).post;assert.equal(restored.status,'draft');
  const t2=(await(await routeAPI(req('/api/admin/posts/'+p.id,'PATCH',{action:'trash',version:restored.version}),env)).json()).post;
  assert.equal((await routeAPI(req('/api/admin/posts/'+p.id,'DELETE',{version:t2.version,confirmTitle:p.title}),env)).status,200);
  assert.equal(await env.DB.prepare('SELECT id FROM posts WHERE id=?').bind(p.id).first(),null);
}finally{env.DB.close();}});

test('public taxonomy counts only published content and follows edits, trash and restore',async()=>{const env=fixture();try{
  const stats=async()=>await(await routeAPI(req('/api/content-stats','GET',undefined,false),env)).json();
  const initial=await stats();assert.equal(initial.total,3);assert.deepEqual(initial.categories,[{key:'article',count:3}]);assert.equal(initial.tags.find(t=>t.name==='图论').count,1);
  const p=(await(await routeAPI(req('/api/admin/posts','POST',{...draft,tags:['私密草稿标签']}),env)).json()).post;
  assert.equal((await stats()).total,3);assert.ok(!(await stats()).tags.some(t=>t.name==='私密草稿标签'));
  const published=(await(await routeAPI(req('/api/admin/posts/'+p.id,'PUT',{...p,status:'published',tags:['图论','图论','最短路']}),env)).json()).post;
  const after=await stats();assert.equal(after.total,4);assert.equal(after.categories.find(c=>c.key==='solution').count,1);assert.equal(after.tags.find(t=>t.name==='图论').count,2);assert.equal(after.tags.find(t=>t.name==='最短路').count,1);
  const tagged=await(await routeAPI(req('/api/posts?tag='+encodeURIComponent('图论'),'GET',undefined,false),env)).json();assert.equal(tagged.total,2);
  const filtered=await(await routeAPI(req('/api/posts?category=solution&tag='+encodeURIComponent('图论'),'GET',undefined,false),env)).json();assert.equal(filtered.total,1);assert.equal(filtered.posts[0].id,p.id);
  assert.equal((await(await routeAPI(req('/api/posts?tag='+encodeURIComponent('图'),'GET',undefined,false),env)).json()).total,0);
  assert.equal((await(await routeAPI(req('/api/posts?tag='+encodeURIComponent("' OR 1=1 --"),'GET',undefined,false),env)).json()).total,0);
  const trashed=(await(await routeAPI(req('/api/admin/posts/'+p.id,'PATCH',{action:'trash',version:published.version}),env)).json()).post;
  assert.equal((await stats()).total,3);assert.ok(!(await stats()).tags.some(t=>t.name==='最短路'));
  const restored=(await(await routeAPI(req('/api/admin/posts/'+p.id,'PATCH',{action:'restore',version:trashed.version}),env)).json()).post;assert.equal((await stats()).total,4);
  await routeAPI(req('/api/admin/posts/'+p.id,'PUT',{...restored,status:'archived'}),env);assert.equal((await stats()).total,3);
}finally{env.DB.close();}});
