(function () {
  'use strict';
  const DAY = 86400000;
  const LIMIT = 2 * 1024 * 1024;
  const KEY = 'xy-production-strategy:';
  const header = ['日期', '开始时间', '结束时间', '班次 / 工序', '预计负荷（kW）'];
  let attached = null;

  async function workbookRows(file) {
    if (!/\.xlsx$/i.test(file.name) || file.size > LIMIT) throw Error('请选择 2 MB 以内的 .xlsx 排产文件。');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const u16 = offset => view.getUint16(offset, true);
    const u32 = offset => view.getUint32(offset, true);
    let end = bytes.length - 22;
    const start = Math.max(0, end - 65535);
    while (end >= start && (u32(end) !== 0x06054b50 || end + 22 + u16(end + 20) !== bytes.length)) end--;
    if (end < start) throw Error('文件不是可读取的 Excel 工作簿。');
    const entries = new Map();
    const decode = new TextDecoder();
    for (let n = 0, at = u32(end + 16); n < u16(end + 10) && at + 46 <= end; n++) {
      if (u32(at) !== 0x02014b50) throw Error('Excel 文件目录无法读取。');
      const length = u16(at + 28);
      const name = decode.decode(bytes.subarray(at + 46, at + 46 + length));
      entries.set(name, {offset:u32(at + 42), size:u32(at + 20), expanded:u32(at + 24), method:u16(at + 10)});
      at += 46 + length + u16(at + 30) + u16(at + 32);
    }
    async function xml(name) {
      const entry = entries.get(name);
      if (!entry) return null;
      const {offset,size,expanded,method} = entry;
      if (expanded > LIMIT || offset + 30 > end || u32(offset) !== 0x04034b50 || ![0,8].includes(method)) throw Error('Excel 文件内容超出读取范围。');
      const pos = offset + 30 + u16(offset + 26) + u16(offset + 28);
      if (pos + size > end) throw Error('Excel 文件内容不完整。');
      const compressed = bytes.subarray(pos,pos + size);
      let content = compressed;
      if (method === 8) {
        const reader = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
        content = new Uint8Array(expanded);
        let written = 0;
        try {
          while (true) {
            const {done,value} = await reader.read();
            if (done) break;
            if (written + value.length > expanded) throw Error('Excel 文件解压后超出限制。');
            content.set(value,written);
            written += value.length;
          }
          if (written !== expanded) throw Error('Excel 文件内容不完整。');
        } finally { await reader.cancel(); }
      }
      const doc = new DOMParser().parseFromString(decode.decode(content),'application/xml');
      if (doc.querySelector('parsererror')) throw Error('Excel 工作表内容无法读取。');
      return doc;
    }
    const [sheet,strings] = await Promise.all([xml('xl/worksheets/sheet1.xml'),xml('xl/sharedStrings.xml')]);
    if (!sheet) throw Error('请把排产计划放在工作簿的第一张表。');
    const shared = [...(strings?.getElementsByTagNameNS('*','si') || [])].map(item =>
      [...item.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join(''));
    return [...sheet.getElementsByTagNameNS('*','row')].map(row => {
      const cells = {};
      for (const cell of row.getElementsByTagNameNS('*','c')) {
        const column = cell.getAttribute('r')?.match(/^[A-G](?=\d)/)?.[0];
        if (!column) continue;
        const value = cell.getElementsByTagNameNS('*','v')[0]?.textContent;
        const type = cell.getAttribute('t');
        cells[column] = type === 's' ? shared[Number(value)] : type === 'inlineStr'
          ? [...cell.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('') : value;
      }
      return cells;
    });
  }

  function parseSchedule(rows) {
    const start = rows.findIndex(row => header.every((label,i) => row['ABCDE'[i]]?.trim() === label));
    if (start < 0) throw Error('找不到排产表头，请使用下周排产样例的列名。');
    const days = new Map();
    const names = new Set();
    const hour = text => /^\d{1,2}:00$/.test(text) ? Number(text.split(':')[0]) : Number(text) * 24;
    for (const row of rows.slice(start + 1)) {
      if (!row.A || row.A === '全周合计') continue;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(row.A) ? row.A : new Date(Date.UTC(1899,11,30) + Number(row.A) * DAY).toJSON()?.slice(0,10);
      const day = Date.parse(date + 'T00:00:00Z');
      const from = Math.round(hour(row.B)), to = Math.round(hour(row.C)), load = Number(row.E);
      if (!Number.isFinite(day) || !row.B || !row.C || !row.E || !Number.isFinite(load) || load < 0 || load > 100000 ||
          Math.abs(from-hour(row.B)) > 1e-6 || Math.abs(to-hour(row.C)) > 1e-6 || !(from >= 0 && to <= 24 && from < to)) {
        throw Error('请检查日期、整点时段及预计负荷。负荷需为 0–100000 kW。');
      }
      if (row.G?.trim()) names.add(row.G.trim());
      if (!days.has(date)) days.set(date, new Array(24).fill(null));
      const profile = days.get(date);
      for (let h = from; h < to; h++) {
        if (profile[h] !== null) throw Error(date + ' 有重叠时段，请先核对排产表。');
        profile[h] = load;
      }
    }
    const dates = [...days.keys()].sort();
    if (!dates.length || dates.length > 7 || dates.some((date,i) =>
      days.get(date).includes(null) || Date.parse(date) !== Date.parse(dates[0]) + i * DAY)) {
      throw Error('请提供 1–7 个连续日期，每日覆盖 00:00–24:00 的负荷。');
    }
    if (names.size > 1) throw Error('请按电站分别上传排产文件。');
    return {dates, days, name:[...names][0]};
  }

  function windows(rows,key) {
    const groups = [];
    for (const row of rows.filter(row => row[key] >= .05)) {
      const last = groups.at(-1);
      if (last?.end === row.hour) last.end++;
      else groups.push({start:row.hour,end:row.hour+1});
    }
    const format = h => String(h).padStart(2,'0') + ':00';
    return groups.map(g => format(g.start)+'–'+format(g.end)).join('、') || '待机';
  }

  function planFor(schedule,plant) {
    const model = StrategyDemoModel;
    const params = model.defaults('arbitrage');
    params.min = plant.socMin ?? params.min;
    params.max = plant.socMax ?? params.max;
    params.initialSOC = Math.min(params.max,Math.max(params.min,plant.soc ?? 50));
    const equipment = {batKwh:plant.cfg?.batKwh ?? plant.batKw * plant.batHours,batKw:plant.batKw,pvKwp:plant.cfg?.pvKwp,loadPeak:plant.cfg?.loadPeak};
    if (!(equipment.batKwh > 0 && equipment.batKw > 0 && Number.isFinite(equipment.pvKwp))) throw Error('目标电站缺少有效的光伏或储能参数。');
    const daily = [];
    for (const date of schedule.dates) {
      const loadProfile = schedule.days.get(date);
      const result = model.solve({...params,loadProfile},equipment);
      if (result.errors.length) throw Error(result.errors.join('。'));
      const round = value => Math.round(value * 10) / 10;
      daily.push({date, charge:windows(result.rows,'charge'), discharge:windows(result.rows,'discharge'),
        load:round(loadProfile.reduce((sum,kw)=>sum+kw,0)), peak:Math.max(...loadProfile),
        chargeKwh:round(result.rows.reduce((sum,row)=>sum+row.charge,0)),
        dischargeKwh:round(result.rows.reduce((sum,row)=>sum+row.discharge,0)), finalSOC:round(result.finalSOC)});
      params.initialSOC = result.finalSOC;
    }
    return {daily,min:params.min,max:params.max,plantId:plant.id,plantName:plant.name};
  }

  function renderPlan(plan, started) {
    const row = addMsg('ai','已根据「'+plan.plantName+'」的排产负荷生成 AI 光储策略。');
    const box = document.createElement('section');
    box.className = 'so-card production-plan';
    const add = (parent,tag,value) => {
      const node = document.createElement(tag);
      node.textContent = value;
      parent.append(node);
      return node;
    };
    add(box,'strong','AI 光储排产策略');
    add(box,'p',plan.daily[0].date+' 至 '+plan.daily.at(-1).date+' · SOC '+plan.min+'%–'+plan.max+'%');
    const peak = plan.daily.reduce((highest,day)=>day.peak>highest.peak?day:highest);
    add(box,'p','排产最高负荷 '+peak.peak+' kW · '+peak.date.slice(5)+' · '+plan.daily.length+' 天');
    const details = add(box,'details','');
    add(details,'summary','查看每日充放电计划');
    for (const day of plan.daily) {
      const entry = add(details,'div','');
      add(entry,'strong',day.date.slice(5)+' · 用电 '+day.load+' kWh · 峰值 '+day.peak+' kW');
      add(entry,'div','充电 '+day.charge+' · '+day.chargeKwh+' kWh');
      add(entry,'div','放电 '+day.discharge+' · '+day.dischargeKwh+' kWh');
      add(entry,'small','日末 SOC '+day.finalSOC+'%');
    }
    add(box,'small','以排产负荷、演示光伏出力与峰谷电价测算，确认后保存为本浏览器的演示策略。');
    const apply = add(box,'button','确认应用策略');
    apply.type = 'button';
    apply.className = 'xy-plant-chart-link';
    apply.onclick = () => {
      try { localStorage.setItem(KEY+plan.plantId,JSON.stringify(plan)); }
      catch { toast('当前浏览器无法保存策略'); return; }
      apply.disabled = true;
      apply.textContent = '已应用演示策略';
      if (stations[pdIdx]?.pid === plan.plantId) pdRender();
    };
    row.querySelector('.bubble').append(box);
    showAnswerTime(row,started);
  }

  async function run(file,question) {
    const started = performance.now();
    const conversation = convoId;
    const row = addMsg('ai','正在读取排产计划并测算充放电策略…');
    try {
      const schedule = parseSchedule(await workbookRows(file));
      if (conversation !== convoId) return;
      const named = PLANTS.filter(plant=>question.includes(plant.name));
      const plant = named.length === 1 ? named[0] : PLANTS.find(plant=>plant.name===schedule.name);
      if (!plant || named.length > 1) throw Error('请在排产表或对话中指定一个已接入的电站。');
      if (schedule.name && plant.name !== schedule.name) throw Error('对话指定的电站与排产表不一致，请核对后重新发送。');
      const plan = planFor(schedule,plant);
      row.remove();
      renderPlan(plan,started);
    } catch(error) {
      if (conversation === convoId) setBubbleText(row,error instanceof RangeError ? 'Excel 文件内容无法读取。' : error.message);
    }
  }

  document.getElementById('file-production').addEventListener('change',event=>{
    const file = event.target.files[0];
    if (!file) return;
    attached = file;
    renderAttach();
  });
  globalThis.ProductionStrategy = Object.freeze({
    hasFile:()=>!!attached,
    clear(){attached=null;},
    renderAttachment(box) {
      if (!attached) return;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'xy-plant-chart-link';
      chip.textContent = 'Excel · '+attached.name+' ×';
      chip.title = '移除排产附件';
      chip.onclick = () => {attached=null;renderAttach();};
      box.append(chip);
    },
    send(question) {
      const file = attached;
      attached = null;
      renderAttach();
      const row = addMsg('user', question);
      const bubble = row.querySelector('.bubble');
      const attachment = document.createElement('div');
      attachment.className = 'xy-excel-file';
      attachment.innerHTML = '<span class="xy-excel-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M12 9v12"/></svg></span><span class="xy-excel-info"><strong></strong><small></small></span>';
      attachment.querySelector('strong').textContent = file.name;
      attachment.querySelector('small').textContent = 'Excel 工作簿 · ' + Math.max(0.1, file.size / 1024).toFixed(1) + ' KB';
      if (question) bubble.classList.add('xy-excel-with-text');
      bubble.prepend(attachment);
      void run(file,question);
    },
    stationCard(pid) {
      try {
        const plan = JSON.parse(localStorage.getItem(KEY+pid));
        if (!plan?.daily?.length) return '';
        return '<section class="pd-sec"><div class="t">AI 光储排产策略</div><div class="pd-note">已应用演示策略 · '+
          esc(plan.daily[0].date)+' 至 '+esc(plan.daily.at(-1).date)+'</div></section>';
      } catch {return '';}
    }
  });
})();
