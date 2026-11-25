(() => {
  const options = document.querySelectorAll('.view-options button');
  const key = 'fs_monitor_view';
  const handset = matchMedia('(pointer: coarse) and (max-width: 767px), (pointer: coarse) and (orientation: landscape) and (max-height: 540px)');
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
  let preferred = 'phone';
  try { if (localStorage.getItem(key) === 'desktop') preferred = 'desktop'; } catch {}
  function applyPreference() {
    document.body.toggleAttribute('data-handset', handset.matches);
    select(handset.matches ? 'phone' : preferred);
    globalThis.ChatHistory?.syncLayout();
  }
  handset.addEventListener('change', applyPreference);
  applyPreference();
  for (const button of options) button.addEventListener('click', () => {
    preferred = button.dataset.layout;
    applyPreference();
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
