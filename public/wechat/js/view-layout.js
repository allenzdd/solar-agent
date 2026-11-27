(() => {
  for (const tab of document.querySelectorAll('.tabbar .tab')) {
    tab.tabIndex = 0;
    tab.setAttribute('role', 'button');
    tab.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      tab.click();
    });
  }
})();
