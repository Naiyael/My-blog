import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import cpp from 'highlight.js/lib/languages/cpp';
import c from 'highlight.js/lib/languages/c';
import python from 'highlight.js/lib/languages/python';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import java from 'highlight.js/lib/languages/java';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import plaintext from 'highlight.js/lib/languages/plaintext';

hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', c);
hljs.registerLanguage('python', python);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('java', java);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('plaintext', plaintext);

const LANG_ALIASES = {
  'c++': 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  py: 'python',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  html: 'xml',
  vue: 'xml',
  svg: 'xml',
  rs: 'rust',
  txt: 'plaintext',
  text: 'plaintext',
  plain: 'plaintext',
};

const LANG_LABELS = {
  cpp: 'C++',
  c: 'C',
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  bash: 'Bash',
  json: 'JSON',
  sql: 'SQL',
  css: 'CSS',
  xml: 'HTML',
  java: 'Java',
  go: 'Go',
  rust: 'Rust',
  plaintext: 'Text',
};

const COPY_BTN_HTML =
  '<button type="button" class="code-copy-btn" aria-label="复制代码">' +
  '<svg class="code-copy-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h2"/></svg>' +
  '<svg class="code-check-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5"/></svg>' +
  '<span>复制</span></button>';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const rawLang = (token.info || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  const safeLang = rawLang.replace(/[^a-z0-9_+-]/g, '');
  const resolved = LANG_ALIASES[safeLang] || safeLang;
  const label = LANG_LABELS[resolved] || (safeLang ? safeLang.toUpperCase() : 'Code');
  const code = token.content || '';
  let highlighted;
  if (resolved && hljs.getLanguage(resolved)) {
    try {
      highlighted = hljs.highlight(code, { language: resolved, ignoreIllegals: true }).value;
    } catch {
      highlighted = md.utils.escapeHtml(code);
    }
  } else {
    highlighted = md.utils.escapeHtml(code);
  }
  const classAttr = safeLang ? ` class="language-${md.utils.escapeHtml(safeLang)}"` : '';
  return (
    `<div class="code-block">` +
    `<div class="code-block-head"><span class="code-block-lang">${md.utils.escapeHtml(label)}</span>${COPY_BTN_HTML}</div>` +
    `<pre class="hljs"><code${classAttr}>${highlighted}</code></pre>` +
    `</div>\n`
  );
};

export function headingSlug(text) {
  return (
    'section-' +
    (text
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'heading')
  );
}

function inlineText(tokens) {
  return (tokens || [])
    .map((token) =>
      token.type === 'image'
        ? inlineText(token.children) || token.content
        : token.type === 'softbreak' || token.type === 'hardbreak'
          ? ' '
          : token.type === 'text' || token.type === 'code_inline'
            ? token.content
            : token.children
              ? inlineText(token.children)
              : ''
    )
    .join('');
}

export function renderMarkdownDocument(content) {
  const env = {};
  const tokens = md.parse(content || '', env);
  const headings = [];
  const ids = new Set();
  tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') return;
    const title = inlineText(tokens[index + 1]?.children).replace(/\s+/g, ' ').trim();
    if (!title) return;
    const base = headingSlug(title);
    let id = base;
    let suffix = 2;
    while (ids.has(id)) id = base + '-' + suffix++;
    ids.add(id);
    token.attrSet('id', id);
    headings.push({ id, title, level: Number(token.tag.slice(1)) });
  });
  return { html: md.renderer.render(tokens, md.options, env), headings };
}

export const renderMarkdown = (content) => md.render(content || '');

export function readingStats(content) {
  const plain = String(content || '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*/g, ' '))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`~_|=-]+/g, ' ');
  const cjk = (plain.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const words = (plain.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
  const total = cjk + words;
  const minutes = Math.max(1, Math.round(total / 380));
  const countLabel = total >= 10000 ? `${(total / 10000).toFixed(1)} 万字` : `${total.toLocaleString('en-US')} 字`;
  return { total, minutes, countLabel, label: `约 ${countLabel} · 阅读约 ${minutes} 分钟` };
}

export { categoryNames, categoryLabel, canonicalCategory } from '../../../../src/site-model.js';

export const dateLabel = (value) =>
  value
    ? new Date(value).toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '';

export async function api(path, options = {}) {
  const r = await fetch(path, { credentials: 'same-origin', ...options });
  let body;
  try {
    body = await r.json();
  } catch {
    throw new Error('服务暂时不可用，请稍后再试');
  }
  if (!r.ok) throw Object.assign(new Error(body.error || '操作失败，请稍后再试'), { status: r.status });
  return body;
}
