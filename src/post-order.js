// Move against the full library, preserving items hidden by filters or pagination.
export function movePostOrder(library,sourceId,targetId,side='before'){
  const source=library.posts.find(post=>post.id===sourceId),target=library.posts.find(post=>post.id===targetId);
  if(!source||!target)throw new Error('内容列表已变化，请刷新后重试。');
  if(sourceId===targetId)throw new Error('请拖到另一张内容卡片上。');
  if(!['before','after'].includes(side))throw new Error('排序位置不正确。');
  const pins=new Set(library.pinnedIds);
  if(pins.has(sourceId)!==pins.has(targetId))throw new Error('置顶内容始终在前，请在同一分组内拖动。');
  const orderedIds=library.posts.map(post=>post.id).filter(id=>id!==sourceId);
  orderedIds.splice(orderedIds.indexOf(targetId)+(side==='after'?1:0),0,sourceId);
  return {version:library.version,orderedIds,pinnedIds:[...library.pinnedIds]};
}
