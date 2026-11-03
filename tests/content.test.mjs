import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {routeAPI,serveMedia}from'../worker/api.mjs';import{createLocalDB}from'../scripts/local-bindings.mjs';
import{renderMarkdown}from'../docs/.vitepress/theme/components/cms-client.js';
const migration=fs.readFileSync('drizzle/0000_workable_celestials.sql','utf8');
function fixture(){const DB=createLocalDB();DB.exec(migration);const objects=new Map();return {DB,SITE_ADMIN_EMAIL:'owner@site.test',BUCKET:{async put(k,b,o){objects.set(k,{body:new Blob([b]).stream(),bytes:b,options:o});},async get(k){const v=objects.get(k);return v?{body:new Blob([v.bytes]).stream()}:null;},async delete(k){objects.delete(k);}}};}
function req(path,method='GET',body,auth=true,origin='https://site.test'){const headers=new Headers();if(auth){headers.set('oai-authenticated-user-email','owner@site.test');headers.set('oai-authenticated-user-id','owner-id');}if(method!=='GET'){headers.set('origin',origin);headers.set('content-type','application/json');}return new Request('https://site.test'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});}
const draft={title:'测试题解',content:'## 解题思路\n\n测试正文。',category:'solution',status:'draft',tags:['图论'],excerpt:'',cover:''};
test('draft privacy, publication, conflict detection and reversible archive',async()=>{const env=fixture();try{
  const created=await routeAPI(req('/api/admin/posts','POST',draft),env);assert.equal(created.status,201);const p=(await created.json()).post;
  assert.equal((await(await routeAPI(req('/api/posts', 'GET',undefined,false),env)).json()).total,0);
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
