(function () {
  'use strict';
  const range = document.getElementById('mh-range'), charts = document.getElementById('mh-charts');
  const picker = document.getElementById('mh-date'), detail = document.getElementById('mh-day');
  const table = document.getElementById('mh-table');
  let feed = null, busy = false, groups = [];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  function dayDetail() {
    detail.replaceChildren();
    for (const g of groups) {
      const d = g.days.find(d => d.date === picker.value);
      detail.append(make('span', '', `${g.name}：${d ? fmt(d.totals.dayPv) + ' kWh' + (d.complete === false ? '（截至截止时间）' : '') : '无数据'}`));
    }
  }
  function graph(g, color) {
    const width = 720, height = 228, left = 64, right = 20, top = 28, bottom = 38, w = width - left - right, h = height - top - bottom;
    const max = Math.max(1, ...g.days.map(d => d.totals.dayPv)), factor = max >= 10000 ? 1000 : 1, unit = factor === 1000 ? 'MWh' : 'kWh';
    const magnitude = Math.pow(10, Math.floor(Math.log10(max / 4))), step = Math.ceil(max / 4 / magnitude) * magnitude, ymax = Math.ceil(max / step) * step;
    const x = i => left + w * i / Math.max(1, g.days.length - 1), y = v => top + h - h * v / ymax;
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(g.name)} 每日发电量曲线，${g.days.length}天，单位${unit}"><text x="${left}" y="16" fill="currentColor" font-size="11">${unit}</text>`;
    for (let value = 0; value <= ymax + step / 2; value += step) svg += `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}" stroke="currentColor" opacity=".12"/><text x="${left - 9}" y="${y(value) + 4}" fill="currentColor" opacity=".7" font-size="11" text-anchor="end">${fmt(value / factor)}</text>`;
    const points = g.days.map((d, i) => `${x(i)},${y(d.totals.dayPv)}`).join(' ');
    svg += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>`;
    g.days.forEach((d, i) => {
      svg += `<circle cx="${x(i)}" cy="${y(d.totals.dayPv)}" r="${d.complete === false ? 4.5 : 2.3}" fill="${d.complete === false ? 'var(--sim-warning,#d69736)' : color}"><title>${esc(d.date)}：${fmt(d.totals.dayPv)} kWh${d.complete === false ? '（截止时间前累计）' : ''}</title></circle>`;
      if (i % 15 === 0 || i === g.days.length - 1) svg += `<text x="${x(i)}" y="${height - 12}" font-size="11" fill="currentColor" opacity=".7" text-anchor="middle">${esc(d.date.slice(5))}</text>`;
    });
    return svg + '</svg>';
  }
  function render() {
    const map = new Map();
    for (const d of feed.datasets || []) {
      if (!map.has(d.plantId)) map.set(d.plantId, { id: d.plantId, name: d.plantName, days: [] });
      map.get(d.plantId).days.push(...(d.daily || []));
    }
    groups = [...map.values()]; groups.forEach(g => g.days.sort((a, b) => a.date.localeCompare(b.date)));
    const window = feed.window;
    const time = window ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(window.asOf)) : '';
    range.textContent = window ? `${window.startDate} 至 ${window.endDate} · 每站连续 ${window.days} 天 · 北京时间截至 ${time}。今天仅累计至截止时间；模型仿真，非真实历史天气与电表。历史按真实日历，与加速仿真时钟独立。` : '模型仿真历史数据，非真实历史观测。';
    charts.replaceChildren();
    if (!groups.length) { charts.append(make('p', 'sp-tip', '暂无历史数据，请先完成历史仿真。')); return; }
    groups.forEach((g, i) => {
      const card = make('article', 'mh-card'); card.append(make('h3', '', g.name));
      card.append(make('p', 'sp-tip', `${g.days.length} 天数据 · 区间发电量 ${fmt(g.days.reduce((s, d) => s + d.totals.dayPv, 0))} kWh`));
      const plot = make('div', 'mh-plot'); plot.innerHTML = graph(g, i % 2 ? 'var(--sim-history-b,#30b98a)' : 'var(--sim-history-a,#5997e8)'); card.append(plot); charts.append(card);
    });
    const dates = [...new Set(groups.flatMap(g => g.days.map(d => d.date)))].sort();
    picker.min = dates[0]; picker.max = dates.at(-1);
    if (!picker.value || picker.value < picker.min || picker.value > picker.max) picker.value = picker.max;
    dayDetail();
    table.innerHTML = '<table><thead><tr><th>日期</th>' + groups.map(g => `<th>${esc(g.name)}（kWh）</th>`).join('') + '</tr></thead><tbody>' + dates.map(date => '<tr><td>' + esc(date) + '</td>' + groups.map(g => { const d = g.days.find(d => d.date === date); return '<td>' + (d ? fmt(d.totals.dayPv) + (d.complete === false ? ' *' : '') : '无数据') + '</td>'; }).join('') + '</tr>').join('') + '</tbody></table><p class="sp-tip">* 当天截至批次截止时间的累计发电量，非全天值。悬停曲线数据点或选择日期可查看具体电量。</p>';
  }
  async function refresh() {
    if (busy) return; busy = true;
    try { feed = await WorkspaceClient.request('history', { signal: AbortSignal.timeout(12000) }); render(); }
    catch { range.textContent = '历史数据加载失败，请点击刷新重试。' + (feed ? '下方保留上次加载结果。' : ''); }
    finally { busy = false; }
  }
  picker.addEventListener('change', dayDetail);
  document.getElementById('mh-refresh').addEventListener('click', refresh);
  void refresh(); setInterval(refresh, 60000);
})();
