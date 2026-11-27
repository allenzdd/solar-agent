(() => {
  function fitPhone(){
    const slot = document.getElementById('phone-slot');
    const phone = slot.querySelector('.phone');
    const reserved = document.body.hasAttribute('data-handset') ? 44 : 104;
    const s = document.body.dataset.view === 'desktop' ? 1 :
      Math.max(0.1, Math.min(1, (window.innerHeight - reserved) / 852, (window.innerWidth - 44) / 393));
    phone.style.transform = s < 1 ? 'scale(' + s + ')' : '';
    slot.style.width  = s < 1 ? (393 * s) + 'px' : '';
    slot.style.height = s < 1 ? (852 * s) + 'px' : '';
  }
  window.addEventListener('resize', fitPhone);
  fitPhone();
  function tickSbTime(){
    const el = document.getElementById('sb-time');
    if (!el) return;
    const d = new Date();
    const txt = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (el.childNodes[0] && el.childNodes[0].nodeType === 3) el.childNodes[0].nodeValue = txt + ' ';
    else el.insertBefore(document.createTextNode(txt + ' '), el.firstChild);
  }
  tickSbTime();
  setInterval(tickSbTime, 15000);
  const options = document.querySelectorAll('.view-options button');
  const key = 'fs_monitor_view';
  const handset = document.body.hasAttribute('data-handset');
  function select(view) {
    if (document.body.dataset.view !== view) {
      const ball = document.getElementById('xy-ball');
      ball.style.removeProperty('left');
      ball.style.removeProperty('top');
    }
    document.body.dataset.view = view;
    options.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === view)));
    window.dispatchEvent(new Event('resize'));
  }
  select(document.body.dataset.view);
  for (const button of options) button.addEventListener('click', () => {
    if (handset) return;
    select(button.dataset.layout);
    globalThis.ChatHistory?.syncLayout();
    try { localStorage.setItem(key, button.dataset.layout); } catch {}
  });
  for (const tab of document.querySelectorAll('.tabbar .tab')) {
    tab.tabIndex = 0;
    tab.setAttribute('role', 'button');
    tab.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      tab.click();
    });
    tab.addEventListener('click', () => {
      if (document.body.dataset.view === 'desktop' && document.querySelector('#xiaoyuan.open')) closeXY();
    });
  }
})();
