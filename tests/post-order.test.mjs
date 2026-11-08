import test from 'node:test';
import assert from 'node:assert/strict';
import {movePostOrder} from '../src/post-order.js';
const library=()=>({version:7,pinnedIds:['p1','p2'],orderedIds:[],posts:['p1','p2','a','hidden','b','c','off-page'].map(id=>({id}))});
test('drag before a filtered target preserves hidden and off-page posts',()=>{
  const data=library(),result=movePostOrder(data,'c','a');
  assert.deepEqual(result.orderedIds,['p1','p2','c','a','hidden','b','off-page']);
  assert.equal(result.version,7);assert.deepEqual(result.pinnedIds,['p1','p2']);
  assert.deepEqual(data.posts.map(p=>p.id),['p1','p2','a','hidden','b','c','off-page']);
});
test('drag after another card moves downward without dropping any post',()=>{
  assert.deepEqual(movePostOrder(library(),'a','c','after').orderedIds,['p1','p2','hidden','b','c','a','off-page']);
});
test('pinned cards can be dragged within their group without changing pin flags',()=>{
  assert.deepEqual(movePostOrder(library(),'p2','p1').orderedIds,['p2','p1','a','hidden','b','c','off-page']);
  assert.throws(()=>movePostOrder(library(),'c','p1'),/同一分组/);
});
test('drag rejects vanished targets, self drops and invalid positions',()=>{
  assert.throws(()=>movePostOrder(library(),'c','deleted'),/列表已变化/);
  assert.throws(()=>movePostOrder(library(),'c','c'),/另一张/);
  assert.throws(()=>movePostOrder(library(),'a','c','invalid'),/位置不正确/);
});
