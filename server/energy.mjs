// Reconcile persisted PV energy with the same historical intervals used by reports.
// Instantaneous power and battery discharge are never used as PV generation counters.
export function enrichEnergySnapshot(snapshot, history) {
  if (!snapshot || !history?.datasets?.length || !Number.isFinite(snapshot.time?.utc)) return snapshot;
  const utc = snapshot.time.utc;
  const fields = ['dayPv','dayLoad','dayImp','dayExp','dayChg','dayDis','dayRev','daySelf'];
  const plants = snapshot.plants.map(original => {
    const p = { ...original }, tz = p.tz || 'Asia/Shanghai';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(utc);
    const date = ['year','month','day'].map(k => parts.find(part => part.type === k).value).join('-');
    const month = date.slice(0, 7), year = date.slice(0, 4);
    const datasets = history.datasets.filter(d => d.plantId === p.id);
    if (!datasets.length) return p;
    const known = Object.fromEntries(fields.map(k => [k, 0])), hourly = new Array(24).fill(0), completeHours = new Set();
    for (const d of datasets) for (const h of d.hourly || []) {
      if (h.date !== date || h.utc + h.minutes * 60000 > utc + 1) continue;
      for (const k of fields) known[k] += Number(h.totals[k]) || 0;
      hourly[h.hour] += Number(h.totals.dayPv) || 0;
      if (h.minutes >= 60) completeHours.add(h.hour);
    }
    for (const k of fields) p[k] = Math.max(Number(p[k]) || 0, known[k]);
    // Completed historical hours are authoritative. Maxing against rounded UI samples inflates energy.
    p.hourly = hourly.map((v, i) => completeHours.has(i) ? v : Math.max(v, Number(original.hourly?.[i]) || 0));
    const days = datasets.flatMap(d => d.daily).filter(d => d.date < date);
    const sum = list => list.reduce((s, d) => s + (Number(d.totals.dayPv) || 0), 0);
    p.energyTotals = { date, monthPvKwh: sum(days.filter(d => d.date.startsWith(month))) + p.dayPv,
      yearPvKwh: sum(days.filter(d => d.date.startsWith(year))) + p.dayPv,
      knownPvKwh: sum(days) + p.dayPv, fromDate: history.window?.startDate || days[0]?.date || date,
      historyCutoffUtc: history.end, partial: true };
    return p;
  });
  const agg = { ...snapshot.agg, hourly: new Array(24).fill(0) };
  for (const key of fields) agg[key] = plants.reduce((sum, p) => sum + (Number(p[key]) || 0), 0);
  agg.revenue = agg.dayRev;
  agg.totalKwh = plants.reduce((sum, p) => sum + (Number(p.totalBase) || 0) + (Number(p.dayPv) || 0), 0);
  for (const p of plants) p.hourly?.forEach((value, i) => { agg.hourly[i] += value; });
  return { ...snapshot, plants, agg };
}
