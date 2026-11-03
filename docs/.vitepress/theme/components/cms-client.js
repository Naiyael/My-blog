import MarkdownIt from 'markdown-it';
const md=new MarkdownIt({html:false,linkify:true,breaks:true});
export const renderMarkdown=content=>md.render(content||'');
export const categoryNames={article:'文章',solution:'题解',daily:'日常'};
export const dateLabel=value=>value?new Date(value).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}):'';
export async function api(path,options={}){const r=await fetch(path,{credentials:'same-origin',...options});let body;try{body=await r.json();}catch{throw new Error('服务暂时不可用，请稍后再试');}if(!r.ok)throw Object.assign(new Error(body.error||'操作失败，请稍后再试'),{status:r.status});return body;}
