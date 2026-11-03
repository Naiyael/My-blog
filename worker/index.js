import { routeAPI, serveMedia } from './api.mjs';
import { fetchCodeforces, fetchLuogu } from './platforms.mjs';
const STATIC_ASSETS=/*__ASSETS__*/ {};
const SEEDS=/*__SEEDS__*/ {};
const memory=new Map(),pending=new Map();
async function platformData(name,request,ctx){
  const key=new Request(new URL('/__platform-cache-v2/'+name,request.url));
  let saved=memory.get(name);
  if(!saved&&typeof caches!=='undefined'){try{const cached=await caches.default.match(key);if(cached)saved=await cached.json();}catch{}}
  if(saved&&Date.now()-Date.parse(saved.syncedAt)<60000)return saved;
  if(pending.has(name))return pending.get(name);
  const operation=(async()=>{try{const fresh=await (name==='cf'?fetchCodeforces():fetchLuogu());memory.set(name,fresh);if(typeof caches!=='undefined'){const task=caches.default.put(key,new Response(JSON.stringify(fresh),{headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=2592000'}}));if(ctx?.waitUntil)ctx.waitUntil(task);else await task;}return fresh;}catch{return {...(saved??SEEDS[name]),syncState:'delayed'};}finally{pending.delete(name);}})();pending.set(name,operation);return operation;
}
export default {
  async fetch(request,env,ctx){
    try{
      const url=new URL(request.url);
      if(url.pathname==='/api/platforms/cf'||url.pathname==='/api/platforms/luogu'){
        if(request.method!=='GET')return new Response('Method not allowed',{status:405});
        return Response.json(await platformData(url.pathname.endsWith('/cf')?'cf':'luogu',request,ctx),{headers:{'Cache-Control':'no-store'}});
      }
      if(url.pathname.startsWith('/api/'))return await routeAPI(request,env);
      if(url.pathname.startsWith('/media/'))return await serveMedia(request,env);
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
      let path;try{path=decodeURIComponent(url.pathname);}catch{return new Response('Bad request',{status:400});}
      if(path==='/')path='/index.html';
      let asset=STATIC_ASSETS[path]??STATIC_ASSETS[path+'.html'];
      let status=200;if(!asset){asset=STATIC_ASSETS['/404.html'];status=404;}if(!asset)return new Response('Not found',{status:404});
      const headers={'Content-Type':asset.mime,'Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache','ETag':asset.etag,'X-Content-Type-Options':'nosniff'};
      if(request.headers.get('if-none-match')===asset.etag)return new Response(null,{status:304,headers});
      const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
      return new Response(request.method==='HEAD'?null:new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),{status,headers});
    }catch(error){console.error('Site request failed:',error?.name||'Error');return Response.json({error:'服务暂时不可用，请稍后重试'},{status:500,headers:{'Cache-Control':'no-store'}});}
  }
};
