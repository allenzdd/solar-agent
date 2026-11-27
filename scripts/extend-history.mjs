// Stop the application before applying. Preview is read-only; --apply creates backups.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulateHistory } from './simulate-history.mjs';
import { createFileWorkspaceStore } from '../server/file-store.mjs';

const metrics = ['dayPv','dayLoad','dayImp','dayExp','dayChg','dayDis','dayRev','daySelf'];
const localDate = utc => new Date(utc + 8 * 3600000).toISOString().slice(0, 10);
function totals(a, b) { return Object.fromEntries(metrics.map(k => [k, Math.round(((a?.[k] || 0) + (b?.[k] || 0)) * 1e6) / 1e6])); }
function mergeRows(oldRows, newRows, hourly) {
  const key = r => hourly ? `${r.date}:${r.hour}` : r.date;
  const map = new Map(oldRows.map(r => [key(r), structuredClone(r)]));
  for (const row of newRows) {
    const previous = map.get(key(row));
    if (!previous) { map.set(key(row), structuredClone(row)); continue; }
    const merged = { ...previous, ...row, totals: totals(previous.totals, row.totals) };
    if (hourly) {
      merged.utc = previous.utc;
      merged.minutes = previous.minutes + row.minutes;
      merged.pvKwAvg = merged.totals.dayPv / (merged.minutes / 60);
      merged.invTempStart = previous.invTempStart;
      merged.invTempMax = Math.max(previous.invTempMax ?? -Infinity, row.invTempMax ?? -Infinity);
    } else {
      merged.socMin = Math.min(previous.socMin, row.socMin);
      merged.socMax = Math.max(previous.socMax, row.socMax);
    }
    map.set(key(row), merged);
  }
  return [...map.values()].sort((a,b) => hourly ? a.utc-b.utc : a.date.localeCompare(b.date));
}
export async function extendHistory(history, configs, asOf) {
  if (history?.version !== 1 || !history.datasets?.length || !configs?.length || !Number.isFinite(asOf) || asOf > Date.now()) throw Error('Valid history, configuration and non-future cutoff required');
  const result = structuredClone(history), changed = [];
  for (const config of configs) {
    const existing = result.datasets.filter(d => d.plantId === config.id).sort((a,b) => a.endUtc-b.endUtc);
    const last = existing.at(-1), tail = last?.hourly?.at(-1);
    if (!last || !tail || !Number.isFinite(tail.socEnd)) throw Error('Saved SOC/history missing: ' + config.id);
    if (asOf <= last.endUtc) continue;
    const batch = await simulateHistory([config], { start: last.endUtc, end: asOf, stepMinutes: last.stepMinutes || 5, initialSocByPlant: { [config.id]: tail.socEnd } });
    for (const fresh of batch.datasets) {
      const index = result.datasets.findIndex(d => d.plantId === config.id && d.month === fresh.month);
      let merged = fresh;
      if (index >= 0) {
        const old = result.datasets[index];
        if (old.endUtc !== fresh.startUtc) throw Error('History overlap or gap: ' + config.id);
        const [year, month] = fresh.month.split('-').map(Number);
        merged = { ...old, endUtc: fresh.endUtc, steps: old.steps + fresh.steps, totals: totals(old.totals, fresh.totals),
          daily: mergeRows(old.daily, fresh.daily, false), hourly: mergeRows(old.hourly, fresh.hourly, true),
          completeMonth: old.startUtc === Date.UTC(year, month-1, 1)-8*3600000 && fresh.endUtc === Date.UTC(year, month, 1)-8*3600000 };
        result.datasets[index] = merged;
      } else result.datasets.push(structuredClone(merged));
      changed.push({ plantId: config.id, month: fresh.month });
    }
  }
  if (!changed.length) return { history: result, changed };
  result.end = Math.max(...result.datasets.map(d => d.endUtc)); result.generatedAt = Date.now();
  result.configs = structuredClone(configs);
  const startDate = localDate(result.start), endDate = localDate(result.end - 1);
  result.window = { kind: 'continuous-days', days: Math.round((Date.parse(endDate)-Date.parse(startDate))/86400000)+1, startDate, endDate, asOf: new Date(result.end).toISOString(), timezone:'Asia/Shanghai' };
  for (const config of configs) {
    const records = result.datasets.filter(d=>d.plantId===config.id), days = records.flatMap(d=>d.daily).sort((a,b)=>a.date.localeCompare(b.date));
    if (new Set(days.map(d=>d.date)).size !== days.length || days.some((d,i)=>i && Date.parse(d.date)-Date.parse(days[i-1].date)!==86400000)) throw Error('Missing/duplicate dates: '+config.id);
    for (const d of records) {
      if (d.hourly.some(h=>h.minutes>60.000001 || h.utc+h.minutes*60000>d.endUtc+1)) throw Error('Invalid hourly coverage');
      for (const k of metrics) {
        const sum = rows=>rows.reduce((s,r)=>s+r.totals[k],0);
        if (Math.abs(sum(d.daily)-d.totals[k])>.002 || Math.abs(sum(d.hourly)-d.totals[k])>.002) throw Error('Energy totals mismatch: '+config.id+' '+k);
      }
    }
  }
  return { history: result, changed };
}

export function updateHistoryReports(workspace, history, changed) {
  const document = structuredClone(workspace);
  for (const {plantId,month} of changed) {
    const d=history.datasets.find(d=>d.plantId===plantId&&d.month===month), a=document.assistant ||= {version:1,events:[],plants:{},scenarios:{}};
    a.events ||= [];
    const id=`month:${plantId}:${month}`, old=a.events.find(e=>e.id===id);
    const event={...old,id,createdAt:old?.createdAt||history.generatedAt,updatedAt:history.generatedAt,status:old?.status||'active',plantId,plantName:d.plantName,type:'monthly',level:'info',simulation:true,simUtc:d.endUtc,
      title:`${month} ${d.completeMonth?'月度':'时段'}运营报告`,
      summary:`${d.plantName} ${month} 历史仿真：发电 ${d.totals.dayPv.toLocaleString('zh-CN',{maximumFractionDigits:2})} kWh。`,
      advice:'使用现有电站模型连续补算，非真实历史观测；当天仅累计至批次截止时间。',
      report:{month,observedFrom:d.startUtc,observedUntil:d.endUtc-1,samples:d.steps,totals:d.totals,selfUsePercent:d.totals.dayPv?Math.round(d.totals.daySelf/d.totals.dayPv*10000)/100:null,currency:d.tariff.sym,partial:!d.completeMonth,historical:true,window:history.window,stepMinutes:d.stepMinutes,daily:d.daily,method:d.method}};
    a.events=a.events.filter(e=>e.id!==id); a.events.push(event);
  }
  return document;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2), apply=args.includes('--apply');
  const [directory,cutoff = new Date().toISOString(),extra] = args.filter(a=>a!=='--apply');
  if (!directory || extra || args.some(a=>a.startsWith('--')&&a!=='--apply')) throw Error('Usage: node scripts/extend-history.mjs DATA_DIR [CUTOFF_ISO] [--apply]; stop service before applying');
  const store=createFileWorkspaceStore(directory), original=await store.read('history'), workspace=await store.read('workspace');
  const {history,changed}=await extendHistory(original,workspace?.config,Date.parse(cutoff));
  const summary={window:history.window,changed,stations:workspace.config.map(p=>({id:p.id,name:p.name,days:history.datasets.filter(d=>d.plantId===p.id).flatMap(d=>d.daily).length}))};
  if (apply && changed.length) {
    // Detect writes that occurred while the batch was calculating.
    if (JSON.stringify(await store.read('history'))!==JSON.stringify(original) || JSON.stringify(await store.read('workspace'))!==JSON.stringify(workspace)) throw Error('Data changed; stop the application before applying');
    const backup=path.join(directory,'history-extension-backup-'+Date.now()); await fs.mkdir(backup,{mode:0o700});
    for (const [key,data] of [['history',original],['workspace',workspace]]) await fs.writeFile(path.join(backup,key+'.json'),JSON.stringify(data),{mode:0o600});
    try {
      await store.update('history',()=>history);
      await store.update('workspace',()=>updateHistoryReports(workspace,history,changed));
    } catch(error) {
      await store.update('history',()=>original); await store.update('workspace',()=>workspace); throw error;
    }
    summary.backup=backup; summary.applied=true;
  } else summary.applied=false;
  console.log(JSON.stringify(summary));
}
