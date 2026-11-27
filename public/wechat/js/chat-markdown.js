// Render model text as Markdown while keeping model HTML and unsafe URLs inert.
function renderChatMarkdown(bubble, text) {
  const html = marked.parse(String(text || ''), { gfm: true, breaks: true });
  bubble.classList.add('markdown-body');
  bubble.innerHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p','br','strong','em','del','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','pre','code','hr','table','thead','tbody','tr','th','td','a'],
    ALLOWED_ATTR: ['href','title','align','start']
  });
  bubble.querySelectorAll('table').forEach(table => {
    const wrap = document.createElement('div');
    wrap.className = 'markdown-table-scroll';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', '数据表格，可横向滑动');
    table.before(wrap); wrap.appendChild(table);
  });
  bubble.querySelectorAll('a').forEach(link => {
    link.target = '_blank'; link.rel = 'noopener noreferrer';
  });
}
