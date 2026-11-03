import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createLocalDB,localBucket} from './local-bindings.mjs';
fs.mkdirSync('.local-state',{recursive:true});
const db=createLocalDB('.local-state/content.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS __local_migrations (name TEXT PRIMARY KEY)');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){
  if(!(await db.prepare('SELECT name FROM __local_migrations WHERE name=?').bind(file).first())){db.exec('BEGIN');try{db.exec(fs.readFileSync(path.join('drizzle',file),'utf8'));await db.prepare('INSERT INTO __local_migrations(name) VALUES(?)').bind(file).run();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
}
const {default:worker}=await import('../dist/server/index.js?dev='+Date.now());
const env={DB:db,BUCKET:localBucket('.local-state/uploads'),SITE_ADMIN_EMAIL:'owner@sites.test'};
const server=http.createServer(async(req,res)=>{try{
  const origin='http://127.0.0.1:4173';const url=new URL(req.url,origin);
  // Development identity simulation exists only in this loopback server, never in the deployed Worker.
  if(url.pathname==='/signin-with-chatgpt'){
    const returnTo=url.searchParams.get('return_to')||'/admin.html';
    res.writeHead(302,{'Set-Cookie':'local_owner=1; HttpOnly; SameSite=Lax; Path=/','Location':returnTo.startsWith('/')&&!returnTo.startsWith('//')?returnTo:'/admin.html'});res.end();return;
  }
  const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(!key.startsWith('oai-')&&value)headers.set(key,Array.isArray(value)?value.join(','):value);
  if((req.headers.cookie||'').split(';').some(s=>s.trim()==='local_owner=1')){headers.set('oai-authenticated-user-email',env.SITE_ADMIN_EMAIL);headers.set('oai-authenticated-user-id','local_owner');}
  const body=['GET','HEAD'].includes(req.method)?undefined:req;
  const request=new Request(url,{method:req.method,headers,body,...(body?{duplex:'half'}:{})});
  const response=await worker.fetch(request,env,{waitUntil:p=>p.catch(()=>{})});
  res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body)for await(const chunk of response.body)res.write(chunk);res.end();
}catch{res.writeHead(500,{'Content-Type':'text/plain'}).end('Local preview error');}});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173\nAdmin: http://127.0.0.1:4173/admin.html'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
