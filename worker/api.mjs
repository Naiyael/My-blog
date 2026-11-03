export const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const postFields='id,title,excerpt,category,status,tags,cover,created_at AS createdAt,updated_at AS updatedAt,published_at AS publishedAt,version';
const decode=p=>p?{...p,tags:JSON.parse(p.tags||'[]')}:null;
export function canAdmin(request,env){const email=request.headers.get('oai-authenticated-user-email');return !!(email&&env.SITE_ADMIN_EMAIL&&email.toLowerCase().trim()===env.SITE_ADMIN_EMAIL.toLowerCase().trim());}
export function checkWrite(request){return request.headers.get('origin')===new URL(request.url).origin;}
export function validatePost(input){
  if(!input||typeof input!=='object')return '内容格式不正确';
  if(typeof input.title!=='string'||!input.title.trim()||input.title.length>160)return '请填写不超过 160 字的标题';
  if(typeof input.content!=='string'||input.content.length>200000)return '正文过长或格式不正确';
  if(!['article','solution','daily'].includes(input.category))return '请选择内容分类';
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
  if((path==='/api/posts'||path==='/api/admin/posts')&&method==='GET'){
    const category=url.searchParams.get('category');const requestedStatus=url.searchParams.get('status');
    const page=Math.max(1,Math.min(10000,Number.parseInt(url.searchParams.get('page'))||1));
    const size=admin?30:12;const conditions=[],args=[];
    if(!admin){conditions.push('status = ?');args.push('published');}
    else if(['draft','published','archived'].includes(requestedStatus)){conditions.push('status = ?');args.push(requestedStatus);}
    if(['article','solution','daily'].includes(category)){conditions.push('category = ?');args.push(category);}
    const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
    const [rows,total]=await Promise.all([db.prepare(`SELECT ${postFields} FROM posts${where} ORDER BY COALESCE(published_at,updated_at) DESC LIMIT ? OFFSET ?`).bind(...args,size,(page-1)*size).all(),db.prepare(`SELECT COUNT(*) AS total FROM posts${where}`).bind(...args).first()]);
    return json({posts:rows.results.map(decode),total:total.total,page,pageSize:size});
  }
  const match=path.match(/^\/api\/(admin\/)?posts\/([a-f0-9-]{36})$/);
  if(match&&method==='GET'){
    const row=await db.prepare(`SELECT ${postFields},content FROM posts WHERE id = ?${admin?'':' AND status = ?'}`).bind(...(admin?[match[2]]:[match[2],'published'])).first();
    return row?json({post:decode(row)}):json({error:'文章不存在或尚未发布'},404);
  }
  if((path==='/api/admin/posts'&&method==='POST')||(match&&admin&&method==='PUT')){
    if(Number(request.headers.get('content-length')||0)>220000)return json({error:'正文过长'},413);
    let input;try{input=await request.json();}catch{return json({error:'内容格式不正确'},400);}
    const invalid=validatePost(input);if(invalid)return json({error:invalid},400);
    const now=new Date().toISOString(),id=match?.[2]??crypto.randomUUID();
    const tags=JSON.stringify([...new Set(input.tags??[])]),excerpt=(input.excerpt||input.content.replace(/[#*`>\[\]()!]/g,'').replace(/\s+/g,' ').trim().slice(0,130));
    if(method==='POST'){
      await db.prepare('INSERT INTO posts (id,title,content,excerpt,category,status,tags,cover,author_id,created_at,updated_at,published_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,input.title.trim(),input.content,excerpt,input.category,input.status,tags,input.cover||'',request.headers.get('oai-authenticated-user-id')||'owner',now,now,input.status==='published'?now:null,1).run();
    }else{
      if(!Number.isInteger(input.version)||input.version<1)return json({error:'请先重新加载文章'},400);
      const existing=await db.prepare('SELECT published_at FROM posts WHERE id = ?').bind(id).first();if(!existing)return json({error:'文章不存在'},404);
      const result=await db.prepare('UPDATE posts SET title=?,content=?,excerpt=?,category=?,status=?,tags=?,cover=?,updated_at=?,published_at=?,version=version+1 WHERE id=? AND version=?').bind(input.title.trim(),input.content,excerpt,input.category,input.status,tags,input.cover||'',now,input.status==='published'?(existing.published_at||now):existing.published_at,id,input.version).run();
      if(!result.meta?.changes)return json({error:'文章已在其他页面更新，请重新加载后再编辑'},409);
    }
    const post=await db.prepare(`SELECT ${postFields},content FROM posts WHERE id = ?`).bind(id).first();return json({post:decode(post)},method==='POST'?201:200);
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
