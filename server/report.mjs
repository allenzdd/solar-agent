// A standalone, printable HTML attachment made only from a persisted report event.
export function renderMonthlyReport(event) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = value => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const date = value => new Date(value).toISOString().slice(0, 16).replace('T', ' ');
  const r = event.report, t = r.totals;
  const full = r.partial === false;
  const historical = r.historical === true;
  const scope = r.demoFixture ? '固定演示样例，非该电站历史统计；仅用于卡片与报告流程演示。' : full ? `完整自然月模型仿真，${r.stepMinutes || 5} 分钟步长积分。` : historical ? `连续90天窗口内时段，${r.stepMinutes || 5} 分钟步长积分；本月与窗口首月不一定覆盖整月，今天仅累计至截止时间。` : '非完整自然月统计，不补算未观测时段。';
  const daily = r.daily?.length ? `<h2>逐日发电量</h2><p class="note">光伏功率（kW）× 仿真时长（h），累计得到发电量（kWh）。</p><table><thead><tr><th>日期</th><th>发电量 kWh</th><th>用电量 kWh</th><th>收益 ${escape(r.currency)}</th></tr></thead><tbody>${r.daily.map(d => `<tr><td>${escape(d.date)}</td><td>${escape(number(d.totals.dayPv))}</td><td>${escape(number(d.totals.dayLoad))}</td><td>${escape(number(d.totals.dayRev))}</td></tr>`).join('')}</tbody></table><p><a href="/api/workspace/history/${encodeURIComponent(event.plantId)}/${encodeURIComponent(r.month)}.csv">下载逐小时仿真数据（CSV）</a></p>` : '';
  const rows = [
    ['光伏发电', number(t.dayPv), 'kWh'], ['负载用电', number(t.dayLoad), 'kWh'],
    ['电网取电', number(t.dayImp), 'kWh'], ['余电上网', number(t.dayExp), 'kWh'],
    ['储能充电', number(t.dayChg), 'kWh'], ['储能放电', number(t.dayDis), 'kWh'],
    ['光伏自用电量', number(t.daySelf), 'kWh'], ['光伏自用率', r.selfUsePercent === null ? '—' : number(r.selfUsePercent), '%'],
    ['运营收益', number(t.dayRev), r.currency],
  ];
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(event.plantName)} · ${escape(r.month)} 运营报告</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f1f4f8;color:#243247;font:15px/1.8 system-ui,"Microsoft YaHei",sans-serif}.toolbar{max-width:860px;margin:24px auto 12px;display:flex;justify-content:space-between;align-items:center;padding:0 20px;gap:12px}button{background:#dcecff;color:#315d8c;border:0;border-radius:10px;padding:10px 16px;cursor:pointer;font:inherit}.paper{max-width:820px;margin:0 auto 36px;padding:48px;background:#fff;border-radius:20px;box-shadow:0 8px 32px #1f37510a}.brand{font-size:12px;letter-spacing:2px;color:#708297}h1{font-size:28px;margin:12px 0 0;line-height:1.4}.subtitle{font-size:18px;margin:8px 0 16px}.tag{display:inline-block;padding:3px 10px;border-radius:6px;background:#eaf3ff;color:#52769b;font-size:12px}h2{font-size:17px;margin:28px 0 10px}p{white-space:pre-line}.meta{padding:16px;background:#f6f8fb;border-radius:12px;color:#66758b;font-size:13px}.hero{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}.hero div{padding:18px;border-radius:12px;background:#f3f7fc}.hero strong{display:block;font-size:24px;color:#315d8c;overflow-wrap:anywhere}.hero span{font-size:12px;color:#6d7b8d}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px 12px;border-bottom:1px solid #e6ebf1}th{background:#f6f8fb;font-size:13px}td:nth-child(2){font-variant-numeric:tabular-nums}.note{font-size:13px;color:#69798d;border-left:3px solid #bbd4ed;padding-left:14px}footer{border-top:1px solid #e6ebf1;margin-top:28px;padding-top:14px;font-size:11px;color:#8390a0;overflow-wrap:anywhere}@media(max-width:600px){.toolbar{font-size:12px}.paper{padding:24px 18px;border-radius:0}h1{font-size:23px}.hero{gap:8px}.hero div{padding:12px}.hero strong{font-size:20px}th,td{padding:10px 7px}}@page{size:A4;margin:16mm}@media print{body{background:white;font-size:11pt}.toolbar{display:none}.paper{padding:0;margin:0;max-width:none;box-shadow:none;border-radius:0}.hero,table,tr,.meta{break-inside:avoid}h2{break-after:avoid}a{color:inherit}}</style></head><body>
<div class="toolbar"><span>小源 · HTML 报告附件</span><button type="button" onclick="window.print()">打印 / 保存为 PDF</button></div>
<main class="paper"><div class="brand">SOLAR & STORAGE · 小源运营报告</div><h1>光储电站运营报告</h1><p class="subtitle">${escape(event.plantName)} · ${escape(r.month)}</p><span class="tag">${r.demoFixture ? '固定演示样例 · 非历史统计' : full ? '模型仿真 · 完整月份' : historical ? '模型仿真 · 90天窗口内时段' : '仿真数据 · 观测汇总'}</span>
<div class="hero"><div><strong>${escape(number(t.dayPv))} kWh</strong><span>${historical ? '仿真发电量' : '观测发电量'}</span></div><div><strong>${escape(r.currency)}${escape(number(t.dayRev))}</strong><span>${historical ? '仿真运营收益' : '观测运营收益'}</span></div></div>
<h2>报告范围</h2><div class="meta">统计时间（UTC）：${escape(date(r.observedFrom))} 至 ${escape(date(r.observedUntil))}<br>${historical ? '仿真积分步数' : '有效观测快照'}：${escape(r.samples)} 个<br>统计性质：${escape(scope)}</div>
<h2>运营数据</h2><table><thead><tr><th>指标</th><th>${full ? '仿真值' : '观测值'}</th><th>单位</th></tr></thead><tbody>${rows.map(row => '<tr>' + row.map(value => '<td>' + escape(value) + '</td>').join('') + '</tr>').join('')}</tbody></table>
${daily}<h2>小源提醒</h2><p>${escape(event.summary)}</p><p>${escape(event.advice)}</p>
<h2>数据说明</h2><p class="note">${historical ? escape(r.method || '按设备配置与模型天气回算所选时段，非真实历史气象观测。') : '本报告为仿真电站已观测数据汇总；系统从首个快照建立基线，累计随后观测到的正增量，缺失时段不补算。'}不代表真实电站运行结果，请勿将本报告视为真实月度结算、收益承诺或设备检修依据。</p>
<footer>报告编号：${escape(event.id)}<br>生成于仿真时间（UTC）：${escape(date(event.simUtc))} · 小源</footer></main></body></html>`;
}
