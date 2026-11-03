const notes = {
  binary: { title: '二分的边界，和一点直觉', category: 'ALGORITHM / 二分查找', content: `<p>二分查找的关键，往往不在那一行 <code>mid</code>，而在于：当前区间究竟代表什么？</p><h3>先给区间一个明确的含义</h3><p>假设数组已经按升序排列，我们要找第一个大于等于目标值的位置。使用左闭右开的区间 [l, r)，初始时 l = 0，r = n。</p><p>保持不变量：l 左侧的元素都小于目标值，r 及右侧的元素都大于等于目标值。当 l 与 r 相遇，答案的位置也就确定了。</p><pre><code>int lower_bound_index(const vector&lt;int&gt;&amp; a, int x) {
    int l = 0, r = (int)a.size();
    while (l &lt; r) {
        int mid = l + (r - l) / 2;
        if (a[mid] &lt; x) l = mid + 1;
        else r = mid;
    }
    return l;
}</code></pre><h3>边界也属于答案</h3><p>空数组、目标值比全部元素都小、或比全部元素都大，这些情形都值得单独想一遍。返回 n 表示不存在满足条件的元素，读取数组前需要检查。</p><p>先明确区间语义，再写更新规则。每次舍弃哪一半，就会自然很多。</p>` },
  ordinary: { title: '屏幕之外，也有好风景', category: 'DAILY LIFE / 日常碎片', content: `<p>一个个人小站，不一定只记录完成了多少事情。它也可以给普通的一天留一个角落。</p><h3>留意那些很小的事</h3><p>窗边的光换了方向，走过熟悉的路时看见一棵树，或者在忙碌之后安静地坐一会儿。这些片段不需要结论，也可以被记录。</p><h3>让日常保持自己的样子</h3><p>可以是一张照片，一段短句，或者一首想再听一次的歌。记录不必像报告，只需要留下那个瞬间。</p><p>这里预留给 Naiyael 真实的日常故事。这篇示例展示了阅读页的样子，之后可以替换为自己的文字。</p>` },
  graph: { title: '从一个点出发：BFS 与 DFS', category: 'ALGORITHM / 图论与搜索', content: `<p>同一张图，可以有不同的探索方式。BFS 逐层向外扩展，DFS 则沿一条路径深入，再回溯到岔路口。</p><h3>BFS：一层一层向外走</h3><p>使用队列维护待访问节点。对于无权图或所有边权相同的图，BFS 可以求起点到各个可达节点的最少边数。</p><pre><code>queue&lt;int&gt; q;
vector&lt;int&gt; dist(n, -1);
dist[s] = 0;
q.push(s);
while (!q.empty()) {
    int u = q.front(); q.pop();
    for (int v : adj[u]) {
        if (dist[v] != -1) continue;
        dist[v] = dist[u] + 1;
        q.push(v);
    }
}</code></pre><h3>DFS：先沿一条路走下去</h3><p>DFS 可以通过递归或显式栈实现，适合连通性、树结构遍历等问题。递归深度很大时，应考虑使用显式栈以避免调用栈溢出。</p><p>使用邻接表并正确标记已访问节点时，两者遍历全图的时间复杂度都为 O(V + E)。选哪一种，要回到问题本身。</p>` },
  record: { title: '关于记录这件小事', category: 'DAILY LIFE / 记录与随想', content: `<p>写下一个想法，不需要等到它足够完整。一个还没解决的问题，或者一个刚刚理解的概念，都可以成为开头。</p><h3>让记录足够轻</h3><p>算法笔记可以只回答三个问题：卡在了哪里？关键的转折是什么？下次遇到类似问题，应该先想到什么？</p><h3>给以后的自己留一条线索</h3><p>比起堆满术语，清楚地解释一个例子更有用。记录当时怎么想，也记录哪里想错了，之后再读时就能接上思路。</p><p>这里是给未来内容留出的空间。这篇文章是示例；真正让小站有意思的，会是 Naiyael 自己留下的片段。</p>` }
};
const filterButtons = document.querySelectorAll('[data-filter]');
filterButtons.forEach(button => button.addEventListener('click', () => {
  const category = button.dataset.filter;
  filterButtons.forEach(item => { const selected = item === button; item.classList.toggle('active', selected); item.setAttribute('aria-pressed', String(selected)); });
  let count = 0;
  document.querySelectorAll('[data-note]').forEach(card => { card.hidden = category !== 'all' && card.dataset.category !== category; if (!card.hidden) count++; });
  document.querySelector('.filter-status').textContent = `已显示 ${count} 篇笔记`;
}));
const dialog = document.querySelector('#article-dialog');
document.querySelectorAll('[data-note]').forEach(card => card.addEventListener('click', () => {
  const note = notes[card.dataset.note];
  document.querySelector('#article-title').textContent = note.title;
  document.querySelector('#article-category').textContent = note.category;
  document.querySelector('#article-content').innerHTML = note.content;
  dialog.showModal(); dialog.scrollTop = 0; document.body.classList.add('modal-open');
}));
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
document.querySelector('#year').textContent = new Date().getFullYear();
