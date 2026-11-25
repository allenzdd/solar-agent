(function () {
  'use strict';
  const prefix = 'xiaoyuan-chat-v1:';
  const chat = document.getElementById('xy-chat');
  const page = document.getElementById('xy-history');
  const trigger = document.getElementById('xy-history-open');
  const query = document.getElementById('xy-history-query');
  const create = document.getElementById('xy-history-new');
  const body = document.getElementById('xy-history-body');
  const unsaved = new Map();
  let previousSnapshot = '', timer, warned = false;

  const designs = new WeakMap();
  let restoredSession, restoredId;
  const recordId = () => convoId === restoredSession ? restoredId : convoId;

  // Preserve document structure without saving executable markup or controls.
  function staticMarkup(html) {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','strong','em','del','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','pre','code','hr','table','caption','thead','tbody','tr','th','td','div','span','section','small','dl','dt','dd','details','summary','a'],
      ALLOWED_ATTR: ['colspan','rowspan','start','href','title'], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false
    });
  }

  function collect() {
    const messages = [];
    for (const row of chat.children) {
      const bubble = row.querySelector('.bubble');
      if (!bubble || bubble.classList.contains('typing')) continue;
      const text = (bubble.innerText || bubble.textContent).trim() ||
        (bubble.querySelector('video') ? '［视频］' : bubble.querySelector('img') ? '［图片］' : '');
      if (!text) continue;
      const message = { role: row.classList.contains('user') ? 'user' : 'assistant', text };
      if (designs.has(row)) message.design = designs.get(row);
      else if (message.role === 'assistant' && bubble.childElementCount) message.markup = staticMarkup(bubble.innerHTML);
      messages.push(message);
    }
    return messages;
  }

  function save() {
    clearTimeout(timer);
    const messages = collect();
    if (!messages.length) return;
    const id = recordId();
    const snapshot = JSON.stringify([id, messages]);
    if (snapshot === previousSnapshot && !unsaved.has(id)) return;
    const record = { id, updated: Date.now(), messages };
    try {
      localStorage.setItem(prefix + id, JSON.stringify(record));
      unsaved.delete(id);
    } catch {
      unsaved.set(id, record);
      if (!warned) toast('浏览器存储不可用，对话历史仅在当前页面保留');
      warned = true;
    }
    previousSnapshot = snapshot;
  }

  function records() {
    const result = new Map(unsaved);
    try {
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith(prefix)) continue;
        let record;
        try { record = JSON.parse(localStorage.getItem(key)); } catch { continue; }
        if (record && key === prefix + record.id && !result.has(record.id) &&
            Array.isArray(record.messages) && record.messages.length &&
            record.messages.every(m => m && typeof m.text === 'string')) result.set(record.id, record);
      }
    } catch { /* In-memory records remain available. */ }
    return [...result.values()].sort((a, b) => b.updated - a.updated);
  }

  function title(record) {
    return (record.messages.find(m => m.role === 'user') || record.messages[0]).text.slice(0, 64);
  }

  function closeDrawer() {
    page.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus({ preventScroll: true });
  }

  function openRecord(record) {
    closeDrawer();
    if (record.id === recordId()) return;
    resetChat();
    restoredSession = convoId;
    restoredId = record.id;
    document.getElementById('xy-intro').classList.add('hide');
    chat.classList.add('on');
    for (const message of record.messages) {
      if (message.role === 'assistant' && message.design && typeof message.design === 'object') {
        SimpleDesign.generate(message.design);
      } else if (message.role === 'assistant' && typeof message.markup === 'string') {
        const row = addMsgHTML('ai', staticMarkup(message.markup));
        const bubble = row.querySelector('.bubble');
        bubble.classList.add('markdown-body');
        for (const link of bubble.querySelectorAll('a[href]')) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      } else {
        addMsg(message.role === 'user' ? 'user' : 'ai', message.text);
      }
    }
    convo.history = record.messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    lastAsk = convo.history.filter(m => m.role === 'user').at(-1)?.content || '';
    previousSnapshot = JSON.stringify([record.id, collect()]);
    chat.scrollTop = chat.scrollHeight;
  }

  function showList() {
    body.replaceChildren();
    const term = query.value.trim().toLocaleLowerCase();
    let previousDay;
    for (const record of records()) {
      if (!record.messages.some(m => m.text.toLocaleLowerCase().includes(term))) continue;
      const day = new Date(record.updated).toLocaleDateString('sv-SE');
      if (day !== previousDay) {
        const label = document.createElement('h3');
        label.textContent = day;
        body.append(label);
        previousDay = day;
      }
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.textContent = title(record);
      entry.title = entry.textContent;
      if (record.id === recordId()) entry.setAttribute('aria-current', 'true');
      entry.addEventListener('click', () => openRecord(record));
      body.append(entry);
    }
    if (!body.childElementCount) body.textContent = term ? '未找到匹配的对话' : '暂无对话历史';
    body.scrollTop = 0;
  }

  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(save, 500);
  }).observe(chat, { childList: true, subtree: true, characterData: true });
  window.addEventListener('pagehide', save);
  trigger.addEventListener('click', () => {
    save();
    query.value = '';
    showList();
    page.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    create.focus({ preventScroll: true });
  });
  page.addEventListener('click', event => { if (event.target === page) closeDrawer(); });
  page.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); }
    if (event.key !== 'Tab') return;
    const last = body.querySelector('button:last-child') || create;
    if (event.shiftKey && document.activeElement === query) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); query.focus(); }
  });
  query.addEventListener('input', showList);
  create.addEventListener('click', () => { closeDrawer(); newChat(); });
  globalThis.ChatHistory = Object.freeze({ save, rememberDesign(row, parameters) { designs.set(row, parameters); } });
})();
