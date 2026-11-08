import test from 'node:test';import assert from 'node:assert/strict';
import {renderMarkdownDocument,renderMarkdown} from '../docs/.vitepress/theme/components/cms-client.js';
test('outline recognizes all six heading levels and plain labels from inline formatting',()=>{
  const result=renderMarkdownDocument('# 总览\n## **Kruskal** 算法\n### `DSU` 与 [路径压缩](https://example.com)\n#### 正确性\n##### 复杂度\n###### 小结');
  assert.deepEqual(result.headings.map(h=>[h.level,h.title]),[[1,'总览'],[2,'Kruskal 算法'],[3,'DSU 与 路径压缩'],[4,'正确性'],[5,'复杂度'],[6,'小结']]);
  for(const item of result.headings)assert.ok(result.html.includes(`id="${item.id}"`));
});
test('duplicate and punctuation-only headings get deterministic distinct anchors',()=>{
  const content='## 题解\n## 题解\n## !!!\n## ???\n## 题解-2\n## 题解';
  const result=renderMarkdownDocument(content);assert.equal(new Set(result.headings.map(h=>h.id)).size,6);
  assert.equal(result.headings[0].id,'section-题解');assert.equal(result.headings[1].id,'section-题解-2');
  assert.deepEqual(renderMarkdownDocument(content),result);
});
test('fenced code, indented code and regular paragraphs do not produce false headings',()=>{
  const result=renderMarkdownDocument('普通文字\n\n```cpp\n# include <bits/stdc++.h>\n## 代码里的标题\n```\n\n    # 也是代码\n\n## 真正的标题');
  assert.deepEqual(result.headings.map(h=>h.title),['真正的标题']);assert.ok(result.html.includes('language-cpp'));
  assert.deepEqual(renderMarkdownDocument('').headings,[]);assert.deepEqual(renderMarkdownDocument('没有标题的正文').headings,[]);
});
test('setext headings, entities and image alt text retain readable labels',()=>{
  const result=renderMarkdownDocument('算法总览\n=====\n\nA &amp; B\n-----\n\n### ![并查集](diagram.png) 与合并');
  assert.deepEqual(result.headings.map(h=>[h.level,h.title]),[[1,'算法总览'],[2,'A & B'],[3,'并查集 与合并']]);
});
test('outline rendering preserves Markdown HTML and script-link escaping',()=>{
  const content='## <script>alert(1)</script>\n\n[跳转](javascript:alert(1))';
  for(const html of [renderMarkdown(content),renderMarkdownDocument(content).html]){assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('&lt;script&gt;'));}
});
