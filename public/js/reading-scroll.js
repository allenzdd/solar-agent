// Touch and trackpad use browser scrolling. A mouse can also drag the simulated screen.
(function () {
  const root = document.getElementById('xiaoyuan') || document.querySelector('.sd-standalone');
  if (!root) return;
  const rail = '.om-compact-heading,.om-strip';
  const horizontal = rail + ',.markdown-table-scroll,.sd-data-scroll';
  const vertical = '.xy-chat,.xy-intro,.skill-sheet,.sd-scroll';
  let gesture, suppressClick = false;

  root.addEventListener('wheel', event => {
    const strip = event.target.closest(rail);
    if (!strip || event.deltaX || event.shiftKey || event.ctrlKey) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
    const before = strip.scrollLeft;
    strip.scrollLeft += event.deltaY * unit;
    if (before !== strip.scrollLeft) event.preventDefault();
  }, { passive: false });

  root.addEventListener('pointerdown', event => {
    suppressClick = false;
    if (document.body.dataset.view === 'desktop') return;
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.shiftKey || event.ctrlKey ||
        event.target.closest('input,select,textarea,[contenteditable=true],.pw-plot,.xy-voice-hold')) return;
    const x = event.target.closest(horizontal);
    const y = event.target.closest(vertical) || (root.matches('.sd-standalone') ? document.scrollingElement : null);
    if (!x && !y) return;
    if (y && event.target === y && event.offsetX >= y.clientWidth) return;
    gesture = {id:event.pointerId, startX:event.clientX, startY:event.clientY, x, y};
  });
  window.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (event.buttons !== 1) { finish(); return; }
    const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
    if (!gesture.target) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
      const across = Math.abs(dx) > Math.abs(dy);
      const target = across ? gesture.x : gesture.y;
      if (!target || (across ? target.scrollWidth <= target.clientWidth : target.scrollHeight <= target.clientHeight)) {
        finish(); return;
      }
      gesture.target = target;
      gesture.across = across;
      gesture.origin = across ? target.scrollLeft : target.scrollTop;
      gesture.scale = target.getBoundingClientRect().width / target.offsetWidth || 1;
      root.setPointerCapture(event.pointerId);
      root.classList.add('reading-drag');
      suppressClick = true;
    }
    event.preventDefault();
    if (gesture.across) gesture.target.scrollLeft = gesture.origin - dx / gesture.scale;
    else gesture.target.scrollTop = gesture.origin - dy / gesture.scale;
  }, {passive:false});
  function finish() {
    if (gesture && root.hasPointerCapture(gesture.id)) root.releasePointerCapture(gesture.id);
    gesture = null;
    root.classList.remove('reading-drag');
  }
  for (const name of ['pointerup','pointercancel']) window.addEventListener(name, event => {
    if (gesture?.id === event.pointerId) finish();
  });
  window.addEventListener('blur', finish);
  root.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
})();
