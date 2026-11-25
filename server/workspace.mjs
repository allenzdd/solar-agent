import { evaluateReminders, reminderFeed, setReminderScenario, resetReminders } from './reminders.mjs';
import { renderMonthlyReport } from './report.mjs';
import { enrichEnergySnapshot } from './energy.mjs';
import { applyInverterDrill } from './inverter-drill.mjs';
import { createManagerSessions } from './manager-auth.mjs';
import { handleStationData } from './station-data.mjs';
import { intentEventFor,applySeasonalShade } from './seasonal-shade.mjs';
import { savedTargetSoc,projectTargetSoc } from './target-soc.mjs';
import { handleAfterSales } from './after-sales.mjs';
// Shared workspace API. Store implementations provide atomic read/update operations.
export function createWorkspaceApi(store, { now = Date.now } = {}) {
  const managerSessions = createManagerSessions(store, now);
  let cachedHistory = null, historyReadAt = -Infinity;
  async function historyData() {
    if (now() - historyReadAt > 30000) { cachedHistory = await store.read('history'); historyReadAt = now(); }
    return cachedHistory;
  }
  const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const fresh = () => ({ revision: 0, config: null, lease: null, commands: [] });
  const authorized = (request, token) => Boolean(token && request.headers.get('Authorization') === 'Bearer ' + token);
  async function readBody(request, limit = 8000000) {
    if (Number(request.headers.get('content-length')) > limit) throw fail(413, '数据过大');
    const encoding = request.headers.get('content-encoding') || 'identity';
    if (!['identity','gzip'].includes(encoding)) throw fail(415, '不支持的请求压缩格式');
    const stream = encoding === 'gzip' ? request.body?.pipeThrough(new DecompressionStream('gzip')) : request.body;
    const reader = stream?.getReader(); if (!reader) throw fail(400, '缺少请求内容');
    const decoder = new TextDecoder(); let size = 0, text = '';
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw fail(413, '数据过大'); } text += decoder.decode(value, { stream: true }); } }
    catch (cause) { if (cause.status) throw cause; throw fail(400, '请求内容解码失败'); }
    finally { reader.releaseLock(); }
    try { const value = JSON.parse(text + decoder.decode()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; } catch { throw fail(400, 'JSON 格式无效'); }
  }
  function lease(document, owner) {
    if (!owner || document.lease?.owner !== owner || document.lease.expiresAt < now()) throw fail(409, '运行权已失效，请重新登录或接管运行');
  }
  return async function workspace(request, env = {}) {
    const path = new URL(request.url).pathname, method = request.method;
    try {
      if (!store) throw fail(503, '共享存储尚未配置');
      const bearerManager=authorized(request,env.MANAGER_TOKEN);
      const cookieManager=!bearerManager && await managerSessions.valid(request,env.MANAGER_TOKEN);
      const manager=bearerManager||cookieManager, control=manager||authorized(request,env.APP_CONTROL_TOKEN);
      if(cookieManager && !['GET','HEAD'].includes(method) && !managerSessions.sameOrigin(request)) throw fail(403,'请从本站管理页面操作');
      if(path.startsWith('/api/workspace/service/'))return handleAfterSales(request,now());
      if(path.startsWith('/api/workspace/data/'))return handleStationData(request,store,{now:now(),manager});
      if(path==='/api/workspace/intent-event'){
        if(method==='GET'){
          return json({event:intentEventFor(await store.read('workspace'),now())});
        }
        if(method!=='POST')return Response.json({error:{message:'仅支持GET或POST'}},{status:405,headers:{Allow:'GET, POST'}});
        if(!manager)throw fail(401,'请先登录管理端');
        const input=await readBody(request,2048);
        if(!['trigger','restore'].includes(input.action))throw fail(400,'不支持的场景操作');
        let event;
        await store.update('workspace',current=>{
          const document=current||fresh();
          if(input.action==='restore'){
            if(document.intentEvent){document.intentEvent.status='recovered';document.intentEvent.recoveredAt=now();}
            event=null;return document;
          }
          const plant=document.config?.find(p=>p.name==='苏州仿真电站')||document.config?.find(p=>/苏州/.test(p.name||''));
          if(!plant)throw fail(404,'请先创建苏州仿真电站');
          const generation=(document.intentEvent?.generation||0)+1;
          event={id:'seasonal-shade-'+now()+'-'+generation,generation,plantId:plant.id,plantName:plant.name,type:'seasonal-shade',status:'active',demo:true,source:'管理端触发的季节性遮挡场景，非现场实测诊断',createdAt:now(),expiresAt:now()+86400000,
            title:'晴天收益偏低，可能是冬季阴影变长了',
            explanation:'冬季太阳高度角较低，电站南侧建筑或树木的阴影变长，遮住了部分组件，导致上午发电和收益偏低。设备运行正常，这个场景没有设备故障。',
            outlook:'预计接近中午，太阳升高、遮挡减轻后，出力会有所回升；具体恢复情况仍需观察。',
            evidence:{period:'冬季上午',weather:'晴天',equipment:'正常',cause:'季节性遮挡'}};
          document.intentEvent=event;event=intentEventFor(document,now());return document;
        });
        return json({event,message:event?'冬季遮挡场景已触发：进入苏州电站详情页停留3秒，小源主动解释收益偏低原因。':'已恢复正常，苏州电站页的遮挡提醒将自动收起。'});
      }
      if(path === '/api/workspace/session' && method === 'POST') {
        if(!managerSessions.sameOrigin(request)) throw fail(403,'请从本站管理页面登录');
        if(!bearerManager) throw fail(401,'请输入正确的管理口令');
        const input=await readBody(request,2048);
        const cookie=await managerSessions.issue(request,env.MANAGER_TOKEN,input.remember!==false);
        return Response.json({role:'manager',appControlToken:env.APP_CONTROL_TOKEN||'',config:(await store.read('workspace'))?.config||null},{headers:{'Cache-Control':'no-store','Set-Cookie':cookie}});
      }
      if(path === '/api/workspace/session' && method === 'DELETE') {
        if(!managerSessions.sameOrigin(request)) throw fail(403,'请从本站管理页面退出');
        const cookie=await managerSessions.revoke(request);
        return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':cookie}});
      }
      if (path === '/api/workspace/history' && method === 'GET') {
        const history = await store.read('history');
        return json({ generatedAt: history?.generatedAt || null, window: history?.window || null, datasets: (history?.datasets || []).map(d => ({ plantId: d.plantId, plantName: d.plantName, month: d.month, totals: d.totals, daily: d.daily, days: d.daily.length, hours: d.hourly.length, stepMinutes: d.stepMinutes, completeMonth: d.completeMonth, simulation: true })) });
      }
      const historyMatch = /^\/api\/workspace\/history\/([\w-]+)\/(\d{4}-\d{2})(\.csv)?$/.exec(path);
      if (historyMatch && method === 'GET') {
        const d = (await store.read('history'))?.datasets.find(d => d.plantId === historyMatch[1] && d.month === historyMatch[2]);
        if (!d) throw fail(404, '该月份尚无历史仿真数据');
        if (!historyMatch[3]) return json(d);
        const header = 'UTC时间,当地日期,当地小时,时长分钟,平均光伏功率kW,光伏发电量kWh,负载用电kWh,电网取电kWh,余电上网kWh,储能充电kWh,储能放电kWh,收益,时段末SOC百分比,逆变器起始温度摄氏度,逆变器结束温度摄氏度,逆变器最高温度摄氏度';
        const rows = d.hourly.map(h => [new Date(h.utc).toISOString(), h.date, h.hour, h.minutes, h.pvKwAvg, ...['dayPv','dayLoad','dayImp','dayExp','dayChg','dayDis','dayRev'].map(k => h.totals[k]), h.socEnd, h.invTempStart ?? '', h.invTempEnd ?? '', h.invTempMax ?? ''].join(','));
        return new Response('\uFEFF' + [header, ...rows].join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="simulation-${d.plantId}-${d.month}.csv"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
      }
      if (path === '/api/workspace/reminders/reset' && method === 'POST') {
        if (!manager) throw fail(401, '需要管理口令');
        let count = 0;
        await store.update('workspace', current => { const document = current || fresh(); count = resetReminders(document, now()); if(document.intentEvent?.status==='active'){document.intentEvent.status='recovered';document.intentEvent.recoveredAt=now();} return document; });
        return json({ ok: true, archived: count, snapshot:(await store.read('workspace'))?.snapshot });
      }
      const reportMatch = /^\/api\/workspace\/reports\/([^/]+)$/.exec(path);
      if (reportMatch && method === 'GET') {
        const id = decodeURIComponent(reportMatch[1]);
        const event = (await store.read('workspace'))?.assistant?.events.find(e => e.id === id && e.type === 'monthly' && e.report);
        if (!event) throw fail(404, '报告不存在或已超出保留期');
        return new Response(renderMonthlyReport(event), { headers: {
          'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
          'Content-Disposition': `inline; filename="solar-report-${event.report.month.replace(/[^0-9-]/g, '')}.html"`,
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'",
        } });
      }
      if (path === '/api/workspace/reminders' && method === 'GET') return json(reminderFeed(await store.read('workspace'), now()));
      if (path === '/api/workspace/reminders/scenario' && method === 'POST') {
        if (!manager) throw fail(401, '需要管理口令');
        const input = await readBody(request, 2048);
        const scenarioHistory = input.type === 'monthly_report' ? await historyData() : null;
        await store.update('workspace', current => {
          const document = current || fresh();
          if(input.type==='clear'&&document.intentEvent?.plantId===input.plantId){document.intentEvent.status='recovered';document.intentEvent.recoveredAt=now();}
          setReminderScenario(document, input, now(), scenarioHistory); return document;
        });
        return json({ ok: true, snapshot:(await store.read('workspace'))?.snapshot });
      }
      if (path === '/api/workspace/state' && method === 'GET') {const document=await store.read('workspace');return json({snapshot:applySeasonalShade(document,projectTargetSoc(document,enrichEnergySnapshot(applyInverterDrill(document||{},document?.snapshot||null,now()),await historyData())),now()),serverTime:now()});}
      if (path === '/api/workspace/session' && method === 'GET') {
        if (!manager) throw fail(401, '请输入正确的管理口令');
        return json({ role: 'manager', appControlToken: env.APP_CONTROL_TOKEN || '', config: (await store.read('workspace'))?.config || null });
      }
      if (path === '/api/workspace/config' && method === 'GET') {
        if (!manager) throw fail(401, '需要管理口令');
        return json({ config: (await store.read('workspace'))?.config || null });
      }
      if (path === '/api/workspace/lease' && method === 'POST') {
        if (!manager) throw fail(401, '需要管理口令');
        const input = await readBody(request, 2048);
        if (typeof input.owner !== 'string' || !input.owner || input.owner.length > 100) throw fail(400, '运行标识无效');
        const result = await store.update('workspace', current => {
          const document = current || fresh();
          if (document.lease && document.lease.owner !== input.owner && document.lease.expiresAt > now() && input.takeover !== true) throw fail(409, '另一管理页正在运行，可点击“接管运行”');
          document.lease = { owner: input.owner, expiresAt: now() + 20000 }; return document;
        });
        return json({ lease: result.lease });
      }
      if (path === '/api/workspace/config' && method === 'PUT') {
        if (!manager) throw fail(401, '需要管理口令');
        const input = await readBody(request);
        if (!Array.isArray(input.plants) || input.plants.length > 100 || input.plants.some(p => !p || typeof p.id !== 'string' || typeof p.name !== 'string' || !Number.isFinite(p.invKw))) throw fail(400, '电站配置无效');
        const result = await store.update('workspace', current => { const document = current || fresh(); lease(document, input.owner); document.config = input.plants.map(p=>savedTargetSoc(document,{...p,inverterThermal:null})); document.revision++; return document; });
        return json({ revision: result.revision });
      }
      // POST supports upload paths whose intermediary does not reliably forward PUT bodies.
      if (path === '/api/workspace/state' && ['PUT', 'POST'].includes(method)) {
        if (!manager) throw fail(401, '需要管理口令');
        const input = await readBody(request);
        if (!input.snapshot || input.snapshot.v !== 3 || !Array.isArray(input.snapshot.plants) || input.snapshot.plants.length > 100 || !input.snapshot.time || !input.snapshot.agg) throw fail(400, '电站快照无效');
        const snapshot = enrichEnergySnapshot({ ...input.snapshot, ts: now(), source: 'server' }, await historyData());
        await store.update('workspace', current => { const document = current || fresh(); lease(document, input.owner); document.lease.expiresAt = now() + 20000; document.snapshot=projectTargetSoc(document,applyInverterDrill(document,snapshot,now())); evaluateReminders(document, document.snapshot, now()); return document; });
        return json({ updatedAt: snapshot.ts });
      }
      if (path === '/api/workspace/commands' && method === 'POST') {
        if (!control) throw fail(401, '需要 APP 控制口令');
        const input = await readBody(request, 16000);
        if (!input || !['soc', 'start', 'speed', 'config', 'power', 'delete','strategy','target-soc'].includes(input.type) || typeof input.id !== 'string' || !/^[\w-]{1,100}$/.test(input.id)) throw fail(400, '控制指令无效');
        if(input.type==='target-soc'&&(typeof input.plantId!=='string'||!Number.isInteger(input.target)||input.target<0||input.target>100||!['stop','charge','discharge'].includes(input.direction)))throw fail(400,'目标SOC或充放电方式无效');
        if(input.type==='strategy'){
          if(typeof input.plantId!=='string'||typeof input.planId!=='string'||!/^[\w-]{1,100}$/.test(input.planId))throw fail(400,'策略电站或方案编号无效');
          if(input.cancel!==undefined&&input.cancel!==true)throw fail(400,'撤销参数无效');
          if(!input.cancel&&(!Number.isFinite(input.min)||!Number.isFinite(input.max)||input.min<0||input.max>100||input.max-input.min<5||!Array.isArray(input.rows)||input.rows.length!==24||input.rows.some((r,i)=>r?.hour!==i||!Number.isFinite(r.batKw))))throw fail(400,'策略需包含有效SOC边界和24小时调度');
        }
        if (input.type === 'config' && (!input.patch || typeof input.patch !== 'object' || Array.isArray(input.patch))) throw fail(400, '参数格式无效');
        let command;
        await store.update('workspace', current => {
          const document = current || fresh();
          if (input.type!=='target-soc'&&(!document.lease || document.lease.expiresAt < now())) throw fail(409, '管理端未运行，暂时无法执行控制');
          document.commands = document.commands.filter(c => c.createdAt > now() - 300000);
          const previous = document.commands.find(c => c.id === input.id); if (previous) { command = previous; return document; }
          if (document.commands.length >= 100) throw fail(429, '控制队列已满，请稍后重试');
          if(input.type==='target-soc'){
            const plant=document.config?.find(p=>p.id===input.plantId);if(!plant)throw fail(404,'目标电站不存在');
            if(!(plant.batKw>0)||input.target<(plant.socMin??0)||input.target>(plant.socMax??100))throw fail(400,'目标SOC超出当前电站允许范围');
            const setting={plantId:input.plantId,target:input.target,direction:input.direction,commandId:input.id,updatedAt:now()};
            (document.targetSocSettings||={})[input.plantId]=setting;
            document.config=document.config.map(p=>savedTargetSoc(document,p));
            document.snapshot=projectTargetSoc(document,document.snapshot);
            document.revision=(document.revision||0)+1;
            command={...input,createdAt:now(),ts:now(),completedAt:now(),status:'done',ok:true,execution:'server-settings',msg:'目标 SOC 已设置为 '+input.target+'%，已保存到服务器；当前SOC未被改写'};
            document.commands.push(command);return document;
          }
          if(input.type==='strategy'){
            const plant=document.config?.find(p=>p.id===input.plantId);if(!plant)throw fail(404,'目标电站不存在');
            if(!input.cancel&&(!Number.isFinite(plant.batKw)||plant.batKw<=0||input.rows.some(r=>Math.abs(r.batKw)>plant.batKw+.001)))throw fail(400,'策略功率超过电站储能额定功率');
          }
          if (document.commands.length >= 100) throw fail(429, '控制队列已满，请稍后重试');
          command = { ...input, ts: Math.max(now(), ...document.commands.map(c => c.ts + 1)), createdAt: now(), expiresAt: now() + 30000, status: 'pending' };
          document.commands.push(command); return document;
        });
        return json({ command }, command.execution==='server-settings'?200:202);
      }
      if (path === '/api/workspace/commands' && method === 'GET') {
        if (!manager) throw fail(401, '需要管理口令');
        const document = await store.read('workspace') || fresh();
        return json({ commands: document.commands.filter(c => c.status === 'pending' && c.expiresAt > now()), targetSocSettings:Object.values(document.targetSocSettings||{}),thermal:applyInverterDrill(document,document.snapshot,now())?.plants.map(p=>({id:p.id,inverterThermal:p.inverterThermal,invTemp:p.invTemp}))||[] });
      }
      const match = /^\/api\/workspace\/commands\/([\w-]+)(\/ack)?$/.exec(path);
      if (match && !match[2] && method === 'GET') {
        if (!control) throw fail(401, '需要 APP 控制口令');
        const command = (await store.read('workspace'))?.commands.find(c => c.id === match[1]);
        if (!command) throw fail(404, '指令不存在');
        return json({ command: command.status === 'pending' && command.expiresAt < now() ? { ...command, status: 'expired', ok: false, msg: '指令已超时，请重新发送' } : command });
      }
      if (match?.[2] && method === 'POST') {
        if (!manager) throw fail(401, '需要管理口令');
        const input = await readBody(request, 4096);
        await store.update('workspace', current => {
          const document = current || fresh(); lease(document, input.owner);
          const command = document.commands.find(c => c.id === match[1]); if (!command) throw fail(404, '指令不存在');
          if (command.status === 'pending') { command.status = 'done'; command.ok = input.ok === true; command.msg = String(input.msg || '').slice(0, 500); command.completedAt = now(); }
          return document;
        });
        return json({ ok: true });
      }
      return json({ error: { message: '接口或请求方法不存在' } }, 404);
    } catch (cause) { return json({ error: { message: cause.status ? cause.message : '共享服务暂时不可用，请稍后重试' } }, cause.status || 503); }
  };
}

export function createR2WorkspaceStore(bucket) {
  const keyFor = key => 'solar-monitor/v1/' + key + '.json';
  return {
    async read(key) { const object = await bucket.get(keyFor(key)); return object ? object.json() : null; },
    async update(key, modify) {
      for (let retry = 0; retry < 5; retry++) {
        const object = await bucket.get(keyFor(key));
        const updated = modify(object ? await object.json() : null);
        const stored = await bucket.put(keyFor(key), JSON.stringify(updated), { onlyIf: object ? { etagMatches: object.etag } : { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } });
        if (stored) return updated;
      }
      throw Object.assign(new Error('数据正在更新，请重试'), { status: 409 });
    },
  };
}
