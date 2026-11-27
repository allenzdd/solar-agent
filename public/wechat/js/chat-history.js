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
  const wide = matchMedia('(min-width: 760px)');
  const drawer = page.querySelector('.xy-history-drawer');
  let pinned = false;
  let previousSnapshot = '', timer, warned = false;

  const archives = new WeakMap();
  const designs = new WeakMap();
  const healthCards = new WeakMap();
  let restoredSession, restoredId;
  const recordId = () => convoId === restoredSession ? restoredId : convoId;

  // Archive the rendered layout, without handlers, identifiers or live form actions.
  function staticMarkup(html) {
    const fragment = DOMPurify.sanitize(html, {
      RETURN_DOM_FRAGMENT: true,
      ALLOWED_TAGS: ['p','br','strong','b','i','em','del','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','pre','code','hr','table','caption','thead','tbody','tr','th','td','div','span','section','article','header','footer','figure','figcaption','img','small','dl','dt','dd','details','summary','a','button','label','input','output','svg','g','path','polyline','polygon','rect','circle','line','text'],
      ALLOWED_ATTR: ['class','style','src','alt','colspan','rowspan','start','href','title','open','type','value','min','max','step','checked','viewBox','width','height','d','x','y','rx','ry','x1','x2','y1','y2','cx','cy','r','points','transform','stroke','fill','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','opacity','font-size','text-anchor','aria-label'],
      ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false
    });
    for (const node of fragment.querySelectorAll('[style]')) {
      const style = node.style;
      const allowed = [];
      for (const key of Array.from(style)) {
        const value = style.getPropertyValue(key).trim();
        if (/^(width|height|max-width|background-color|color|--score)$/.test(key) &&
            /^(?:[\d.]+(?:%|px)|#[\da-f]{3,8}|rgba?\([\d., %]+\))$/i.test(value)) allowed.push(key+':'+value);
      }
      node.removeAttribute('style');
      if (allowed.length) node.setAttribute('style', allowed.join(';'));
    }
    for (const node of fragment.querySelectorAll('[fill],[stroke]')) {
      for (const attr of ['fill','stroke']) if (/url\s*\(/i.test(node.getAttribute(attr))) node.removeAttribute(attr);
    }
    for (const node of fragment.querySelectorAll('[href]')) {
      if (node.localName !== 'a' || !/^https?:\/\//i.test(node.getAttribute('href'))) node.removeAttribute('href');
    }
    for (const image of fragment.querySelectorAll('img')) {
      const src = image.getAttribute('src') || '';
      let permitted = false;
      try {
        const url = new URL(src, document.baseURI);
        permitted = url.origin === location.origin && /^\/(images|图片)\//.test(decodeURI(url.pathname));
      } catch {}
      if (!permitted) image.replaceWith(document.createTextNode(image.alt || '［图片］'));
    }
    for (const field of fragment.querySelectorAll('input')) {
      if (!['text','number','range','checkbox','radio'].includes(field.type)) field.type='text';
      field.disabled=true;
    }
    for (const button of fragment.querySelectorAll('button')) {
      button.type='button';
      button.disabled=true;
      button.title='历史操作记录';
    }
    const container = document.createElement('div');
    container.append(fragment);
    return container.innerHTML;
  }

  function captureBubble(bubble) {
    const copy = bubble.cloneNode(true);
    const fields = bubble.querySelectorAll('input,select,textarea');
    copy.querySelectorAll('input,select,textarea').forEach((node,index) => {
      const field = fields[index];
      if (['password','file','hidden'].includes(field.type)) { node.remove(); return; }
      const frozen=document.createElement('input');
      frozen.type=['number','range','checkbox','radio'].includes(field.type) ? field.type : 'text';
      frozen.className=field.className;
      for(const attr of ['min','max','step','aria-label']) {
        if(field.hasAttribute(attr)) frozen.setAttribute(attr,field.getAttribute(attr));
      }
      frozen.setAttribute('value',field.tagName==='SELECT' ? (field.selectedOptions[0]?.textContent||'') : field.value);
      if(field.checked) frozen.setAttribute('checked','');
      frozen.disabled=true;
      node.replaceWith(frozen);
    });
    for (const form of copy.querySelectorAll('form')) {
      const group=document.createElement('div');
      group.className=form.className;
      group.append(...form.childNodes);
      form.replaceWith(group);
    }
    return staticMarkup(copy.innerHTML);
  }

  function collect() {
    const messages = [];
    for (const row of chat.children) {
      const bubble = row.querySelector('.bubble');
      if (!bubble || bubble.classList.contains('typing')) continue;
      if (archives.has(row)) {
        messages.push(archives.get(row));
        continue;
      }
      const text = (bubble.innerText || bubble.textContent).trim() ||
        (bubble.querySelector('video') ? '［视频］' : bubble.querySelector('img') ? '［图片］' : bubble.querySelector('svg') ? '［图表］' : '');
      if (!text) continue;
      const message = { role: row.classList.contains('user') ? 'user' : 'assistant', text };
      const timing = row.querySelector(':scope > .xy-answer-status');
      if (timing) message.timing = staticMarkup(timing.outerHTML);
      if (healthCards.has(row)) message.health = healthCards.get(row);
      else if (designs.has(row)) message.design = designs.get(row);
      else if (message.role === 'assistant' && bubble.childElementCount) {
        message.markup = captureBubble(bubble);
        message.markdown = bubble.classList.contains('markdown-body');
      }
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
    if (pinned) showList();
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
    if (pinned) return;
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
      if (message.role === 'assistant' && Array.isArray(message.health?.items)) {
        HealthDemo.restore(message.health);
      } else if (message.role === 'assistant' && message.design && typeof message.design === 'object') {
        SimpleDesign.generate(message.design);
      } else if (message.role === 'assistant') {
        const source = document.createElement('div');
        if (typeof message.markup === 'string') source.innerHTML = staticMarkup(message.markup);
        const restored = SimpleDesign.restoreLegacy(message, source) ||
          StrategyDemo.restoreLegacy(message, source) || HealthDemo.recoverLegacy(source) ||
          (!source.childElementCount && HealthDemo.recoverText(message.text));
        if (!restored && source.childNodes.length) {
          const row = addMsgHTML('ai', source.innerHTML);
          const bubble = row.querySelector('.bubble');
          bubble.classList.toggle('markdown-body', message.markdown !== false);
          for (const link of bubble.querySelectorAll('a[href]')) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
          }
        } else if (!restored) addMsg('ai', message.text);
        // A later reply must not overwrite historical evidence with a second DOM transcription.
        archives.set(chat.lastElementChild, message);
      } else addMsg('user', message.text);
      if (message.role === 'assistant' && typeof message.timing === 'string') {
        const container = document.createElement('div');
        container.innerHTML = staticMarkup(message.timing);
        const status = container.querySelector('details.xy-answer-status');
        if (status) {
          const row = chat.lastElementChild;
          row.classList.add('xy-timed-answer');
          row.prepend(status);
        }
      }
    }
    convo.history = record.messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    lastAsk = convo.history.filter(m => m.role === 'user').at(-1)?.content || '';
    previousSnapshot = JSON.stringify([record.id, collect()]);
    chat.scrollTop = chat.scrollHeight;
    if (pinned) showList();
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
    if (pinned) return;
    if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); }
    if (event.key !== 'Tab') return;
    const last = body.querySelector('button:last-child') || create;
    if (event.shiftKey && document.activeElement === query) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); query.focus(); }
  });
  query.addEventListener('input', showList);
  create.addEventListener('click', () => {
    closeDrawer();
    newChat();
    if (pinned) showList();
    document.getElementById('xy-input').focus();
  });
  function syncLayout() {
    const next = wide.matches && document.body.dataset.view === 'desktop';
    if (next === pinned) return;
    pinned = next;
    page.hidden = !pinned;
    drawer.setAttribute('role', pinned ? 'navigation' : 'dialog');
    if (pinned) drawer.removeAttribute('aria-modal');
    else drawer.setAttribute('aria-modal', 'true');
    trigger.setAttribute('aria-expanded', String(pinned));
    if (pinned) showList();
  }
  wide.addEventListener('change', syncLayout);
  globalThis.ChatHistory = Object.freeze({ save, syncLayout, rememberHealth(row, data) { healthCards.set(row, data); }, rememberDesign(row, parameters) { designs.set(row, parameters); } });
})();
