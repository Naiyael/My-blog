export function reorderNavigation(items,sourceId,targetId,side='before'){
  if(!['before','after'].includes(side))throw new Error('排序位置不正确');
  const source=items.find(item=>item.id===sourceId);
  if(!source||!items.some(item=>item.id===targetId))throw new Error('导航项目已变化，请重新加载');
  if(sourceId===targetId)return [...items];
  const next=items.filter(item=>item.id!==sourceId);
  next.splice(next.findIndex(item=>item.id===targetId)+(side==='after'?1:0),0,source);
  return next;
}
