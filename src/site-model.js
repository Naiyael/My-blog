export const categoryNames={article:'文章',solution:'题解',daily:'日常'};
export const categoryLabel=value=>Object.hasOwn(categoryNames,value)?categoryNames[value]:value||'未分类';
export function canonicalCategory(value){if(typeof value!=='string')return '';const text=value.trim().normalize('NFC');return Object.keys(categoryNames).find(key=>categoryNames[key]===text)||text;}
export const DEFAULT_NAVIGATION=[
  {id:'home',text:'首页',link:'/',hidden:false,newTab:false},
  {id:'journal',text:'文章',link:'/journal.html',hidden:false,newTab:false},
  {id:'algorithms',text:'算法',hidden:false,children:[{id:'cf',text:'Codeforces',link:'/codeforces.html',hidden:false,newTab:false},{id:'luogu',text:'洛谷',link:'/luogu.html',hidden:false,newTab:false}]},
  {id:'daily',text:'日常',link:'/daily.html',hidden:false,newTab:false},
  {id:'about',text:'关于',link:'/about.html',hidden:false,newTab:false},
  {id:'external-cf',text:'Codeforces',link:'https://codeforces.com/profile/qiushan233',hidden:false,newTab:true},
];
export function validNavLink(value){
  if(typeof value!=='string'||!value||value.length>500||/[\s\\\u0000-\u001f\u007f]/u.test(value))return false;
  if(value.startsWith('/'))return !value.startsWith('//');
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password;}catch{return false;}
}
export function validImageUrl(value){
  if(typeof value!=='string'||!value||value.length>500||/[\s\\\u0000-\u001f\u007f]/u.test(value))return false;
  if(/^\/media\/[a-f0-9-]{36}\.(jpg|png|webp|gif)$/.test(value))return true;
  if(/^\/images\/[a-zA-Z0-9._/-]+$/.test(value))return !value.includes('..')&&!value.includes('//');
  try{const url=new URL(value);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password;}catch{return false;}
}
export function normalizeNavigation(input){
  if(!Array.isArray(input)||input.length>12)throw new Error('顶部导航最多可设置 12 项');
  const ids=new Set();
  function item(raw,depth){
    if(!raw||typeof raw!=='object'||typeof raw.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(raw.id)||ids.has(raw.id))throw new Error('导航项目标识重复或格式不正确');
    ids.add(raw.id);
    if(typeof raw.text!=='string'||!raw.text.trim()||raw.text.trim().length>24)throw new Error('请填写不超过 24 字的导航名称');
    if(raw.hidden!=null&&typeof raw.hidden!=='boolean')throw new Error('导航显示状态不正确');
    const result={id:raw.id,text:raw.text.trim(),hidden:!!raw.hidden};
    if(raw.children!=null){
      if(depth||!Array.isArray(raw.children)||!raw.children.length||raw.children.length>12)throw new Error('下拉菜单需要 1 至 12 个子项目，暂支持一级下拉菜单');
      result.children=raw.children.map(child=>item(child,1));
    }else{
      if(!validNavLink(raw.link))throw new Error('链接请填写站内路径（如 /journal.html）或完整的 http(s) 地址');
      if(raw.newTab!=null&&typeof raw.newTab!=='boolean')throw new Error('链接打开方式不正确');
      result.link=raw.link;result.newTab=!!raw.newTab;
    }
    return result;
  }
  return input.map(raw=>item(raw,0));
}
export function visibleNavigation(items){return items.filter(item=>!item.hidden).map(item=>item.children?{id:item.id,text:item.text,children:visibleNavigation(item.children)}:{id:item.id,text:item.text,link:item.link,newTab:!!item.newTab}).filter(item=>!item.children||item.children.length);}
