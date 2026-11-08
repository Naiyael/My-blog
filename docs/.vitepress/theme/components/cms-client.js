import MarkdownIt from 'markdown-it';
const md=new MarkdownIt({html:false,linkify:true,breaks:true});
export function headingSlug(text){return 'section-'+(text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}_-]+/gu,'-').replace(/^-+|-+$/g,'')||'heading');}
function inlineText(tokens){return (tokens||[]).map(token=>token.type==='image'?inlineText(token.children)||token.content:token.type==='softbreak'||token.type==='hardbreak'?' ':token.type==='text'||token.type==='code_inline'?token.content:token.children?inlineText(token.children):'').join('');}
export function renderMarkdownDocument(content){
  const env={},tokens=md.parse(content||'',env),headings=[],ids=new Set();
  tokens.forEach((token,index)=>{if(token.type!=='heading_open')return;const title=inlineText(tokens[index+1]?.children).replace(/\s+/g,' ').trim();if(!title)return;const base=headingSlug(title);let id=base,suffix=2;while(ids.has(id))id=base+'-'+suffix++;ids.add(id);token.attrSet('id',id);headings.push({id,title,level:Number(token.tag.slice(1))});});
  return {html:md.renderer.render(tokens,md.options,env),headings};
}
export const renderMarkdown=content=>md.render(content||'');
export {categoryNames,categoryLabel,canonicalCategory} from '../../../../src/site-model.js';
export const dateLabel=value=>value?new Date(value).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}):'';
export async function api(path,options={}){const r=await fetch(path,{credentials:'same-origin',...options});let body;try{body=await r.json();}catch{throw new Error('服务暂时不可用，请稍后再试');}if(!r.ok)throw Object.assign(new Error(body.error||'操作失败，请稍后再试'),{status:r.status});return body;}
