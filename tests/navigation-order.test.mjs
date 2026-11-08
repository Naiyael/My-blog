import test from 'node:test';import assert from 'node:assert/strict';
import {reorderNavigation} from '../src/navigation-order.js';
import {normalizeNavigation,DEFAULT_NAVIGATION} from '../src/site-model.js';
test('navigation drag preserves links, visibility and whole dropdown groups',()=>{
  const input=structuredClone(DEFAULT_NAVIGATION);input[3].hidden=true;
  const original=JSON.stringify(input),result=reorderNavigation(input,'algorithms','home');
  assert.deepEqual(result.map(item=>item.id),['algorithms','home','journal','daily','about','external-cf']);
  assert.deepEqual(result[0].children,input[2].children);assert.equal(result[3].hidden,true);
  assert.equal(JSON.stringify(input),original);assert.doesNotThrow(()=>normalizeNavigation(result));
});
test('submenu drag moves before or after peers without mutating its saved parent',()=>{
  const group=structuredClone(DEFAULT_NAVIGATION[2]),result=reorderNavigation(group.children,'cf','luogu','after');
  assert.deepEqual(result.map(item=>item.id),['luogu','cf']);assert.deepEqual(group.children.map(item=>item.id),['cf','luogu']);
  assert.doesNotThrow(()=>normalizeNavigation([{...group,children:result}]));
});
test('navigation drag handles self drop and rejects missing IDs or invalid positions',()=>{
  assert.deepEqual(reorderNavigation(DEFAULT_NAVIGATION,'home','home'),DEFAULT_NAVIGATION);
  assert.throws(()=>reorderNavigation(DEFAULT_NAVIGATION,'missing','home'),/已变化/);
  assert.throws(()=>reorderNavigation(DEFAULT_NAVIGATION,'home','missing'),/已变化/);
  assert.throws(()=>reorderNavigation(DEFAULT_NAVIGATION,'home','about','invalid'),/位置不正确/);
});
