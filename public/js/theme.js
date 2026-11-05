/* Shared appearance preference; loaded before styles to avoid a theme flash. */
(function (global) {
  'use strict';
  const key = 'solar_theme';
  let current = 'dark';
  try { if (localStorage.getItem(key) === 'light') current = 'light'; } catch {}
  function sync() {
    document.documentElement.dataset.theme = current;
    const label = document.getElementById('theme-label');
    if (label) label.textContent = current === 'light' ? '浅色模式' : '深色模式';
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      const selected = button.dataset.themeChoice === current;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('selected', selected);
    });
  }
  function close() {
    document.getElementById('theme-mask')?.classList.remove('on');
    document.getElementById('theme-sheet')?.classList.remove('on');
    document.getElementById('theme-trigger')?.setAttribute('aria-expanded', 'false');
  }
  function set(value) {
    if (value !== 'light' && value !== 'dark') return;
    current = value;
    try { localStorage.setItem(key, current); } catch {}
    sync(); close();
  }
  function open() {
    sync();
    document.getElementById('theme-mask')?.classList.add('on');
    document.getElementById('theme-sheet')?.classList.add('on');
    document.getElementById('theme-trigger')?.setAttribute('aria-expanded', 'true');
  }
  document.documentElement.dataset.theme = current;
  document.addEventListener('DOMContentLoaded', sync);
  global.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { current = event.newValue === 'light' ? 'light' : 'dark'; sync(); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  global.SolarTheme = Object.freeze({ set, open, close, get: () => current });
})(globalThis);
