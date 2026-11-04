import {canonicalCategory,categoryLabel,DEFAULT_NAVIGATION,normalizeNavigation,visibleNavigation} from '../src/site-model.js';
export const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function readNavigation(db){const row=await db.prepare("SELECT value,version,updated_at FROM site_settings WHERE id='navigation'").first();return row?{navigation:JSON.parse(row.value),version:row.version,updatedAt:row.updated_at}:{navigation:structuredClone(DEFAULT_NAVIGATION),version:0,updatedAt:null};}
const postFields='id,title,excerpt,category,status,tags,cover,created_at AS createdAt,updated_at AS updatedAt,published_at AS publishedAt,version,page_key AS pageKey,trashed_at AS trashedAt,previous_status AS previousStatus';
// Existing static entries remain available without a write on public requests.
// The first owner edit materializes the entry; tombstones prevent resurrection.
const initialPages=[
  {id:'f0000000-0000-4000-8000-000000000001',key:'codeforces',title:'Codeforces',content:'[qiushan233 ↗](https://codeforces.com/profile/qiushan233)',excerpt:'qiushan233 的比赛记录、Rating 曲线和算法练习。',tags:['Codeforces','图论','动态规划']},
  {id:'f0000000-0000-4000-8000-000000000002',key:'luogu',title:'洛谷',content:'[Naiyael ↗](https://www.luogu.com.cn/user/1589332)',excerpt:'我的洛谷练习记录与通过题目。',tags:['洛谷','练习记录']},
  {id:'f0000000-0000-4000-8000-000000000003',key:'about',title:'关于我',content:'你好，我是 **Naiyael**，一名 ACMer。\n\n喜欢算法和编程，主要使用 C++，也写 Python。\n\n这个小站记录我的练习、比赛，以及代码之外的日常。\n\n## 在其他地方找到我\n\n- [Codeforces · qiushan233](https://codeforces.com/profile/qiushan233)\n- [洛谷 · Naiyael](https://www.luogu.com.cn/user/1589332)',excerpt:'Naiyael，ACMer。记录算法、编程和日常。',tags:['我']},
];
const columns='id,title,content,excerpt,category,status,tags,cover,author_id,created_at,updated_at,published_at,version,page_key,trashed_at,previous_status';
const sqlValue=v=>v==null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const seedValues=p=>[p.id,p.title,p.content,p.excerpt,'article','published',JSON.stringify(p.tags),'','owner','2026-11-03T12:00:00.000Z','2026-11-03T12:00:00.000Z','2026-11-03T12:00:00.000Z',1,p.key,null,null];
const contentCTE='WITH content_posts AS (SELECT '+columns+' FROM posts '+initialPages.map(p=>'UNION ALL SELECT '+seedValues(p).map(sqlValue).join(',')+' WHERE NOT EXISTS (SELECT 1 FROM posts WHERE id='+sqlValue(p.id)+')').join(' ')+') ';
async function materialize(db,id){const p=initialPages.find(p=>p.id===id);if(p)await db.prepare('INSERT OR IGNORE INTO posts ('+columns+') VALUES ('+seedValues(p).map(()=>'?').join(',')+')').bind(...seedValues(p)).run();}
const decode=p=>p?{...p,tags:JSON.parse(p.tags||'[]')}:null;
export function canAdmin(request,env){const email=request.headers.get('oai-authenticated-user-email');return !!(email&&env.SITE_ADMIN_EMAIL&&email.toLowerCase().trim()===env.SITE_ADMIN_EMAIL.toLowerCase().trim());}
export function checkWrite(request){return request.headers.get('origin')===new URL(request.url).origin;}
export function validatePost(input){
  if(!input||typeof input!=='object')return '内容格式不正确';
  if(typeof input.title!=='string'||!input.title.trim()||input.title.length>160)return '请填写不超过 160 字的标题';
  if(typeof input.content!=='string'||input.content.length>200000)return '正文过长或格式不正确';
  if(typeof input.category!=='string'||!canonicalCategory(input.category)||canonicalCategory(input.category).length>40||/[\u0000-\u001f\u007f]/u.test(input.category))return '请填写不超过 40 字的分类名称';
  if(!['draft','published','archived'].includes(input.status))return '发布状态不正确';
  if(input.status==='published'&&!input.content.trim())return '发布前请填写正文';
  if(input.excerpt!=null&&(typeof input.excerpt!=='string'||input.excerpt.length>400))return '摘要不能超过 400 字';
  if(input.tags!=null&&(!Array.isArray(input.tags)||input.tags.length>10||input.tags.some(t=>typeof t!=='string'||t.length>30)))return '标签格式不正确';
  if(input.cover&&!(typeof input.cover==='string'&&/^\/media\/[a-f0-9-]{36}\.(jpg|png|webp|gif)$/.test(input.cover)))return '请使用后台上传的封面';
  return null;
}
export function imageExtension(bytes,mime){
  if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
  if(mime==='image/png'&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'png';
  const ascii=new TextDecoder().decode(bytes.slice(0,12));
  if(mime==='image/webp'&&ascii.startsWith('RIFF')&&ascii.slice(8)==='WEBP')return 'webp';
  if(mime==='image/gif'&&/^GIF8[79]a/.test(ascii))return 'gif';return null;
}
export async function routeAPI(request,env){
  const url=new URL(request.url), path=url.pathname, method=request.method;
  const admin=path.startsWith('/api/admin/');
  if(admin&&!canAdmin(request,env))return json({error:'此页面仅供站点管理者使用'},403);
  if(admin&&!['GET','HEAD'].includes(method)&&!checkWrite(request))return json({error:'请求来源不正确'},403);
  if(path==='/api/admin/session'&&method==='GET')return json({authenticated:true,name:'Naiyael'});
  if(path==='/api/health')return json({ok:true,database:!!env.DB,uploads:!!env.BUCKET});
  if(!env.DB)return json({error:'服务暂不可用，请稍后再试'},503);
  const db=env.DB;
  if((path==='/api/site-settings'||path==='/api/admin/navigation')&&method==='GET'){
    const data=await readNavigation(db);return json(admin?data:{...data,navigation:visibleNavigation(data.navigation)});
  }
  if(path==='/api/admin/navigation'&&method==='PUT'){
    if(Number(request.headers.get('content-length')||0)>64000)return json({error:'导航配置过大'},413);
    let input;try{input=await request.json();}catch{return json({error:'请求格式不正确'},400);}
    if(!Number.isInteger(input?.version)||input.version<0)return json({error:'请重新加载导航配置'},400);
    let navigation;try{navigation=normalizeNavigation(input.navigation);}catch(e){return json({error:e.message},400);}
    const value=JSON.stringify(navigation),now=new Date().toISOString();
    const result=input.version===0?await db.prepare("INSERT OR IGNORE INTO site_settings(id,value,version,updated_at) VALUES('navigation',?,1,?)").bind(value,now).run():await db.prepare("UPDATE site_settings SET value=?,version=version+1,updated_at=? WHERE id='navigation' AND version=?").bind(value,now,input.version).run();
    if(!result.meta?.changes)return json({error:'导航已在其他窗口修改，请重新加载后再保存'},409);
    return json(await readNavigation(db));
  }
  if(path==='/api/admin/categories'&&method==='GET'){
    const rows=await db.prepare(contentCTE+"SELECT category AS key,COUNT(*) AS count FROM content_posts WHERE status NOT IN ('trash','deleted') GROUP BY category ORDER BY count DESC,category").all();
    return json({categories:rows.results.map(item=>({...item,label:categoryLabel(item.key)}))});
  }
  if(path==='/api/content-stats'&&method==='GET'){
    const [categories,tags]=await Promise.all([
      db.prepare(contentCTE+"SELECT category AS key,COUNT(*) AS count FROM content_posts WHERE status='published' GROUP BY category ORDER BY count DESC,category").all(),
      db.prepare(contentCTE+"SELECT trim(t.value) AS name,COUNT(DISTINCT p.id) AS count FROM content_posts p,json_each(p.tags) t WHERE p.status='published' AND t.type='text' AND trim(t.value) != '' GROUP BY trim(t.value) ORDER BY count DESC,name").all(),
    ]);
    return json({total:categories.results.reduce((sum,c)=>sum+c.count,0),categories:categories.results,tags:tags.results});
  }
  if(path==='/api/admin/export'&&method==='GET'){
    const data=await db.prepare(contentCTE+`SELECT ${postFields},content FROM content_posts WHERE status != 'deleted' ORDER BY created_at,id`).all();
    return json({format:'naiyael-content-backup',version:2,exportedAt:new Date().toISOString(),posts:data.results.map(decode),siteSettings:await readNavigation(db)});
  }
  const pageMatch=path.match(/^\/api\/pages\/(codeforces|luogu|about)$/);
  if(pageMatch&&method==='GET'){
    const row=await db.prepare(contentCTE+`SELECT ${postFields},content FROM content_posts WHERE page_key=? AND status='published'`).bind(pageMatch[1]).first();
    return row?json({post:decode(row)}):json({error:'这篇内容暂不可见'},404);
  }
  if((path==='/api/posts'||path==='/api/admin/posts')&&method==='GET'){
    const category=url.searchParams.get('category');const requestedStatus=url.searchParams.get('status');
    const page=Math.max(1,Math.min(10000,Number.parseInt(url.searchParams.get('page'))||1));
    const size=admin?30:12;const conditions=[],args=[];
    if(!admin){conditions.push('status = ?');args.push('published');}
    else if(['draft','published','archived','trash'].includes(requestedStatus)){conditions.push('status = ?');args.push(requestedStatus);}
    else{conditions.push("status NOT IN ('trash','deleted')");}
    if(category){conditions.push('category = ?');args.push(canonicalCategory(category).slice(0,100));}
    const tag=url.searchParams.get('tag');
    if(tag){conditions.push('EXISTS (SELECT 1 FROM json_each(content_posts.tags) t WHERE trim(t.value) = ?)');args.push(tag.trim().slice(0,100));}
    const search=(url.searchParams.get('q')||'').trim().slice(0,100);
    if(search){conditions.push("(title LIKE ? ESCAPE '\\' OR excerpt LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')");const q='%'+search.replace(/[\\%_]/g,'\\$&')+'%';args.push(q,q,q);}
    const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
    const sort=admin?'updated_at DESC,id DESC':'COALESCE(published_at,updated_at) DESC,id DESC';
    const [rows,total,counts]=await Promise.all([db.prepare(contentCTE+`SELECT ${postFields} FROM content_posts${where} ORDER BY ${sort} LIMIT ? OFFSET ?`).bind(...args,size,(page-1)*size).all(),db.prepare(contentCTE+`SELECT COUNT(*) AS total FROM content_posts${where}`).bind(...args).first(),admin?db.prepare(contentCTE+"SELECT status,COUNT(*) AS count FROM content_posts WHERE status != 'deleted' GROUP BY status").all():null]);
    return json({posts:rows.results.map(decode),total:total.total,page,pageSize:size,...(admin?{counts:Object.fromEntries(counts.results.map(r=>[r.status,r.count]))}:{})});
  }
  const match=path.match(/^\/api\/(admin\/)?posts\/([a-f0-9-]{36})$/);
  if(match&&method==='GET'){
    const row=await db.prepare(contentCTE+`SELECT ${postFields},content FROM content_posts WHERE id = ?${admin?" AND status != 'deleted'":' AND status = ?'}`).bind(...(admin?[match[2]]:[match[2],'published'])).first();
    return row?json({post:decode(row)}):json({error:'文章不存在或尚未发布'},404);
  }
  if((path==='/api/admin/posts'&&method==='POST')||(match&&admin&&method==='PUT')){
    if(Number(request.headers.get('content-length')||0)>220000)return json({error:'正文过长'},413);
    let input;try{input=await request.json();}catch{return json({error:'内容格式不正确'},400);}
    const invalid=validatePost(input);if(invalid)return json({error:invalid},400);
    input.category=canonicalCategory(input.category);
    const now=new Date().toISOString(),id=match?.[2]??crypto.randomUUID();
    const tags=JSON.stringify([...new Set(input.tags??[])]),excerpt=(input.excerpt||input.content.replace(/[#*`>\[\]()!]/g,'').replace(/\s+/g,' ').trim().slice(0,130));
    if(method==='POST'){
      await db.prepare('INSERT INTO posts (id,title,content,excerpt,category,status,tags,cover,author_id,created_at,updated_at,published_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,input.title.trim(),input.content,excerpt,input.category,input.status,tags,input.cover||'',request.headers.get('oai-authenticated-user-id')||'owner',now,now,input.status==='published'?now:null,1).run();
    }else{
      if(!Number.isInteger(input.version)||input.version<1)return json({error:'请先重新加载文章'},400);
      await materialize(db,id);
      const existing=await db.prepare('SELECT published_at,status FROM posts WHERE id = ?').bind(id).first();if(!existing||existing.status==='deleted')return json({error:'文章不存在'},404);
      if(existing.status==='trash')return json({error:'请先从回收站恢复这篇内容'},409);
      const result=await db.prepare('UPDATE posts SET title=?,content=?,excerpt=?,category=?,status=?,tags=?,cover=?,updated_at=?,published_at=?,version=version+1 WHERE id=? AND version=?').bind(input.title.trim(),input.content,excerpt,input.category,input.status,tags,input.cover||'',now,input.status==='published'?(existing.published_at||now):existing.published_at,id,input.version).run();
      if(!result.meta?.changes)return json({error:'文章已在其他页面更新，请重新加载后再编辑'},409);
    }
    const post=await db.prepare(`SELECT ${postFields},content FROM posts WHERE id = ?`).bind(id).first();return json({post:decode(post)},method==='POST'?201:200);
  }
  if(match&&admin&&['PATCH','DELETE'].includes(method)){
    let input;try{input=await request.json();}catch{return json({error:'请求格式不正确'},400);}
    if(!Number.isInteger(input?.version)||input.version<1)return json({error:'请重新加载内容后操作'},400);
    const id=match[2];await materialize(db,id);
    const existing=await db.prepare('SELECT * FROM posts WHERE id=?').bind(id).first();
    if(!existing||existing.status==='deleted')return json({error:'文章不存在'},404);
    if(existing.version!==input.version)return json({error:'内容已在其他页面更新，请重新加载后操作'},409);
    const now=new Date().toISOString();let result;
    if(method==='DELETE'){
      if(existing.status!=='trash')return json({error:'请先将内容移到回收站'},409);
      if(input.confirmTitle!==existing.title)return json({error:'标题不匹配，未执行删除'},400);
      result=existing.page_key?await db.prepare("UPDATE posts SET title='',content='',excerpt='',tags='[]',cover='',status='deleted',previous_status=NULL,updated_at=?,version=version+1 WHERE id=? AND version=? AND status='trash'").bind(now,id,input.version).run():await db.prepare("DELETE FROM posts WHERE id=? AND version=? AND status='trash'").bind(id,input.version).run();
    }else if(input.action==='trash'){
      if(existing.status==='trash')return json({error:'内容已在回收站中'},409);
      result=await db.prepare("UPDATE posts SET previous_status=status,status='trash',trashed_at=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND status NOT IN ('trash','deleted')").bind(now,now,id,input.version).run();
    }else if(input.action==='restore'){
      if(existing.status!=='trash')return json({error:'这篇内容不在回收站中'},409);
      result=await db.prepare("UPDATE posts SET status=COALESCE(previous_status,'draft'),previous_status=NULL,trashed_at=NULL,updated_at=?,version=version+1 WHERE id=? AND version=? AND status='trash'").bind(now,id,input.version).run();
    }else return json({error:'操作不正确'},400);
    if(!result.meta?.changes)return json({error:'内容已更新，请重新加载后操作'},409);
    if(method==='DELETE')return json({deleted:true});
    const post=await db.prepare(`SELECT ${postFields},content FROM posts WHERE id=?`).bind(id).first();return json({post:decode(post)});
  }
  if(path==='/api/admin/uploads'&&method==='POST'){
    if(!env.BUCKET)return json({error:'图片服务暂不可用'},503);
    if(Number(request.headers.get('content-length')||0)>5*1024*1024)return json({error:'图片不能超过 5 MB'},413);
    const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length>5*1024*1024)return json({error:'图片不能超过 5 MB'},413);
    const mime=(request.headers.get('content-type')||'').split(';')[0];const ext=imageExtension(bytes,mime);if(!ext)return json({error:'请选择 JPG、PNG、WebP 或 GIF 图片'},400);
    const id=crypto.randomUUID()+'.'+ext,key='images/'+id;
    await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
    try{await db.prepare('INSERT INTO uploads (id,object_key,mime,size,author_id,created_at) VALUES (?,?,?,?,?,?)').bind(id,key,mime,bytes.length,request.headers.get('oai-authenticated-user-id')||'owner',new Date().toISOString()).run();}catch(error){await env.BUCKET.delete(key);throw error;}
    return json({url:'/media/'+id},201);
  }
  return json({error:'接口不存在'},404);
}
export async function serveMedia(request,env){
  const id=new URL(request.url).pathname.slice('/media/'.length);if(!/^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/.test(id)||!env.DB||!env.BUCKET)return new Response('Not found',{status:404});
  const row=await env.DB.prepare('SELECT object_key,mime FROM uploads WHERE id = ?').bind(id).first();if(!row)return new Response('Not found',{status:404});
  if(!canAdmin(request,env)){const path='/media/'+id;const used=await env.DB.prepare("SELECT id FROM posts WHERE status = 'published' AND (cover = ? OR instr(content, ?) > 0) LIMIT 1").bind(path,path).first();if(!used)return new Response('Not found',{status:404});}
  const object=await env.BUCKET.get(row.object_key);if(!object)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':row.mime,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
}
