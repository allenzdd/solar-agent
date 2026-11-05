import {applyInverterDrill} from './inverter-drill.mjs';
import {enrichEnergySnapshot} from './energy.mjs';

const scopes=['catalog','current','config','history','samples','reminders','reports','operations','storage'];
const properties={
 scope:{type:'string',enum:scopes},
 lastDays:{type:'integer',minimum:1,maximum:365,description:'最近N天必须填N，含末日。默认末日是真实北京时间今天，不是最后保存日。'},
 dayOffset:{type:'integer',minimum:-365,maximum:0,description:'相对今天的日偏移：昨天=-1，前天=-2，今天=0；单日查询只填此字段。'},
 monthOffset:{type:'integer',minimum:-24,maximum:0,description:'相对当前月：上个月=-1，本月=0。'},
 calendar:{type:'string',enum:['real','simulation','last_saved'],description:'默认real真实北京时间；仅用户明确说仿真日期或最后保存日时，才选择simulation或last_saved。'},
 plantIds:{type:'array',items:{type:'string'},description:'电站ID，来自目录。省略表示全部电站。'},
 from:{type:'string',description:'开始日期，YYYY-MM-DD，北京时间，包含当天。'},
 to:{type:'string',description:'结束日期，YYYY-MM-DD，北京时间，包含当天。'},
 month:{type:'string',description:'YYYY-MM，历史或报告月份。'},
 resolution:{type:'string',enum:['summary','daily','hourly'],description:'历史分辨率。summary只返回全范围汇总，daily逐日，hourly逐小时。'},
 startHour:{type:'integer',minimum:0,maximum:23,description:'起始小时，包含。'},endHour:{type:'integer',minimum:0,maximum:23,description:'结束小时，包含此小时。查询10:00到12:00应使用startHour=10,endHour=11，共2条小时记录。'},
 status:{type:'string',enum:['active','archived','recovered','all']},
 type:{type:'string',description:'提醒类型，如inverter-risk、temperature、monthly、weather。'},
 fields:{type:'array',items:{type:'string',enum:['dayPv','dayLoad','dayImp','dayExp','dayChg','dayDis','dayRev','daySelf','pvKwAvg','socEnd','invTempStart','invTempEnd','invTempMax','pv','load','bat','grid','invTemp']},description:'可选字段，如dayPv、dayRev、socEnd、invTempEnd、pv、soc、invTemp、batTemp。缺失字段返回null。'},
 offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:240}
};
export const workspaceTool={type:'function',function:{name:'query_workspace',description:'只读查询服务器保存的光储电站数据。可一次查询多个类别或日期。current含仿真时钟、功率、SOC、温度、电量收益；config含设备和电价；history含逐日逐小时历史及全范围精确汇总；samples仅有限近期运行采样；reminders/reports查预警依据和月报；operations需管理登录，仅返回非敏感运行和指令状态。不能修改数据、读取密码或任意文件。',parameters:{type:'object',properties:{queries:{type:'array',minItems:1,maxItems:6,items:{type:'object',properties,required:['scope'],additionalProperties:false}}},required:['queries'],additionalProperties:false}}};

export async function queryWorkspace(store,args,{now=Date.now(),manager=false,origin=''}={}){
 const pick=(p,keys)=>Object.fromEntries(keys.map(k=>[k,p?.[k]??null]));
 const number=n=>typeof n==='number'&&Number.isFinite(n)?n:0;
 const round=n=>Math.round(n*1000000)/1000000;
 const metrics=['dayPv','dayLoad','dayImp','dayExp','dayChg','dayDis','dayRev','daySelf'];
 const date=ms=>new Date(ms+8*3600000).toISOString().slice(0,10);
 const beijing=ms=>Number.isFinite(ms)?new Date(ms+8*3600000).toISOString().slice(0,19).replace('T',' ')+' UTC+08:00':null;
 const times=(p,keys)=>Object.fromEntries(keys.map(k=>[k+'Beijing',beijing(p?.[k])]));
 const [document,history]=await Promise.all([store.read('workspace'),store.read('history')]);
 const w=document||{},snapshot=enrichEnergySnapshot(applyInverterDrill(w,w.snapshot||null,now),history);
 const config=w.config||[],plants=snapshot?.plants||[],datasets=history?.datasets||[];
 const names=new Map([...config,...plants].map(p=>[p.id,p.name]));
 const coverage=datasets.map(d=>({plantId:d.plantId,plantName:d.plantName,month:d.month,from:d.daily?.[0]?.date,to:d.daily?.at(-1)?.date,days:d.daily?.length||0,hours:d.hourly?.length||0,completeMonth:!!d.completeMonth,temperatureStored:!!d.hourly?.some(h=>Number.isFinite(h.invTempEnd))}));
 const meta={source:'服务器持久化仿真数据，非现场实测',queriedAt:new Date(now).toISOString(),queriedAtBeijing:beijing(now),lastSnapshotAtBeijing:beijing(snapshot?.ts),lastSnapshotAtISO:Number.isFinite(snapshot?.ts)?new Date(snapshot.ts).toISOString():null,snapshotAgeSeconds:Number.isFinite(snapshot?.ts)?Math.max(0,Math.round((now-snapshot.ts)/1000)):null,serverDateBeijing:date(now),simulationTime:snapshot?.time||null,lastSnapshotAt:snapshot?.ts||null,stale:!snapshot||now-snapshot.ts>30000,units:{power:'kW',pvCapacity:'kWp',energy:'kWh',temperature:'℃',soc:'%',revenue:'按电站tariff.cur货币'},historyCutoffUtc:history?.end||null,historyCutoffBeijing:beijing(history?.end)};
 const queries=Array.isArray(args?.queries)?args.queries:args?.scope?[args]:[];
 if(!queries.length||queries.length>6)return {...meta,error:'一次需提供1–6个查询。'};
 function run(q){
  if(!q||!scopes.includes(q.scope))return {error:'不支持的数据类别',availableScopes:scopes};
  if(q.plantIds!==undefined&&(!Array.isArray(q.plantIds)||q.plantIds.length>100||q.plantIds.some(id=>typeof id!=='string')))return {error:'电站ID格式无效'};
  if(q.fields!==undefined&&(!Array.isArray(q.fields)||q.fields.length>60||q.fields.some(k=>typeof k!=='string')))return {error:'字段列表格式无效'};
  q={...q};
  const ids=q.plantIds?.length?q.plantIds:[...names.keys()];
  const unknown=ids.filter(id=>!names.has(id));if(unknown.length)return {error:'未找到指定电站',unknown,availablePlants:[...names].map(([id,name])=>({id,name}))};
  if(q.lastDays!==undefined||q.dayOffset!==undefined||q.monthOffset!==undefined){
    if(q.lastDays!==undefined&&(!Number.isInteger(q.lastDays)||q.lastDays<1||q.lastDays>365))return {error:'最近天数须为1–365'};
    if(q.dayOffset!==undefined&&(!Number.isInteger(q.dayOffset)||q.dayOffset< -365||q.dayOffset>0))return {error:'相对日期偏移无效'};
    if(q.monthOffset!==undefined&&(!Number.isInteger(q.monthOffset)||q.monthOffset< -24||q.monthOffset>0))return {error:'相对月份偏移无效'};
    const savedDates=datasets.filter(d=>ids.includes(d.plantId)).flatMap(d=>d.daily||[]).map(d=>d.date).sort();
    const baseDate=q.calendar==='simulation'&&snapshot?date(snapshot.time.utc):q.calendar==='last_saved'&&savedDates.length?savedDates.at(-1):date(now);
    const base=Date.parse(baseDate+'T00:00:00+08:00');
    if(q.monthOffset!==undefined){const [y,m]=baseDate.split('-').map(Number),offset=q.monthOffset;q.from=date(Date.UTC(y,m-1+offset,1));q.to=offset===0?baseDate:date(Date.UTC(y,m+offset,0));}
    else{q.to=date(base+(q.dayOffset||0)*86400000);q.from=date(base+((q.dayOffset||0)-(q.lastDays||1)+1)*86400000);}
    delete q.month;
  }
  for(const k of ['from','to'])if(q[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(q[k])||!Number.isFinite(Date.parse(q[k]+'T00:00:00Z'))||new Date(q[k]+'T00:00:00Z').toISOString().slice(0,10)!==q[k]))return {error:'日期须为有效的YYYY-MM-DD'};
  if(q.month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(q.month))return {error:'月份须为YYYY-MM'};
  if(q.from&&q.to&&q.from>q.to)return {error:'开始日期不能晚于结束日期'};
  for(const k of ['startHour','endHour'])if(q[k]!==undefined&&(!Number.isInteger(q[k])||q[k]<0||q[k]>23))return {error:'小时须为0–23'};
  if(q.startHour!==undefined&&q.endHour!==undefined&&q.startHour>q.endHour)return {error:'起始小时不能晚于结束小时'};
  const limit=Number.isInteger(q.limit)?Math.min(240,Math.max(1,q.limit)):100,offset=Number.isInteger(q.offset)?Math.max(0,q.offset):0;
  const matches=p=>ids.includes(p.id??p.plantId);
  const inDate=d=>(!q.from||d>=q.from)&&(!q.to||d<=q.to)&&(!q.month||d.startsWith(q.month));
  const page=rows=>({totalRows:rows.length,offset,limit,hasMore:offset+limit<rows.length,rows:rows.slice(offset,offset+limit)});
  const filtered=rows=>q.fields?.length?rows.map(row=>{
    const aliases={invTemp:'invTempEnd',soc:'socEnd',energy:'dayPv',pvKwh:'dayPv',revenue:'dayRev'};
    const wanted=q.fields.map(k=>row.date&&row.hour!==undefined?(aliases[k]||k):k);
    return {...pick(row,['plantId','plantName','date','hour','utc','timeBeijing']),...Object.fromEntries([...new Set([...wanted,...(row.date?['dayPv']:[])])].filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]))};
  }):rows;
  if(q.scope==='catalog')return {plants:[...names].map(([id,name])=>({id,name})),categories:scopes,coverage,retention:'实时仅最新快照和最多200个近期采样；历史按实际已保存范围，缺失温度或未来日期不可补造。',historyWindow:history?.window||null};
  if(q.scope==='config')return {plants:config.filter(matches).map(p=>({...pick(p,['id','name','country','city','tz','geo','type','mode','invKw','ratio','batKw','batHours','socMin','socMax','tariff','start','created','closed','cloud','loadScale','batMode','gridOut','useLoadFile']),derived:pick(plants.find(x=>x.id===p.id)?.cfg,['pvKwp','batKwh','invKw','batKw','loadPeak','gridKw','pr','eff'])}))};
  if(q.scope==='current')return {plants:plants.filter(matches).map(p=>pick(p,['id','name','city','tz','local','cfg','invKw','ratio','batKw','batHours','pv','load','demand','bat','grid','shed','curtail','soc','socMin','socMax','invTemp','batTemp','inverterThermal','dayPv','dayLoad','dayImp','dayExp','dayChg','dayDis','dayRev','daySelf','totalBase','totalRev','energyTotals','tariff','closed','gridOut','batMode','cloud','loadScale'])),note:'以上为仿真时钟对应的最新快照，不一定是现实今天；dayPv为当日kWh，pv为瞬时kW。totalBase为日初累计基数，不能直接当作当前累计发电量。'};
  if(q.scope==='history'){
   const resolution=q.resolution||'daily';if(!['summary','daily','hourly'].includes(resolution))return {error:'不支持的历史分辨率'};
   const selected=datasets.filter(d=>ids.includes(d.plantId));
   const hourly=resolution==='hourly'||q.startHour!==undefined||q.endHour!==undefined;
   const rows=selected.flatMap(d=>(hourly?d.hourly||[]:d.daily||[]).filter(h=>inDate(h.date)&&(!hourly||(q.startHour===undefined||h.hour>=q.startHour)&&(q.endHour===undefined||h.hour<=q.endHour))).map(h=>({plantId:d.plantId,plantName:d.plantName,date:h.date,...(hourly?pick(h,['hour','utc','minutes','pvKwAvg','socEnd','invTempStart','invTempEnd','invTempMax']):pick(h,['complete','socMin','socMax'])),...Object.fromEntries(metrics.map(k=>[k,h.totals?.[k]??null]))}))).sort((a,b)=>a.date.localeCompare(b.date)||(a.hour||0)-(b.hour||0)||a.plantId.localeCompare(b.plantId));
   const byPlant=ids.map(id=>{const rr=rows.filter(r=>r.plantId===id);return {plantId:id,plantName:names.get(id),currency:config.find(p=>p.id===id)?.tariff?.cur||selected.find(d=>d.plantId===id)?.tariff?.cur||null,currencySymbol:config.find(p=>p.id===id)?.tariff?.sym||selected.find(d=>d.plantId===id)?.tariff?.sym||null,coverage:(()=>{const days=[...new Set(rr.map(r=>r.date))],span=q.from&&q.to?Math.round((Date.parse(q.to)-Date.parse(q.from))/86400000)+1:null;return {requestedFrom:q.from||null,requestedTo:q.to||null,requestedCalendarDays:span,daysWithRecords:days.length,missingCalendarDayCount:span===null?null:Math.max(0,span-days.length),missingDates:span!==null&&span<=366?Array.from({length:span},(_,i)=>date(Date.parse(q.from+'T00:00:00+08:00')+i*86400000)).filter(d=>!days.includes(d)):null,incompleteDates:[...new Set(rr.filter(r=>r.complete===false||r.minutes!==undefined&&r.minutes<60).map(r=>r.date))]};})(),records:rr.length,from:rr[0]?.date||null,to:rr.at(-1)?.date||null,totals:Object.fromEntries(metrics.map(k=>[k,round(rr.reduce((s,r)=>s+number(r[k]),0))])),temperatureSamples:rr.filter(r=>Number.isFinite(r.invTempEnd)).length,temperatureSummary:(()=>{const tt=rr.map(r=>r.invTempEnd).filter(Number.isFinite),max=rr.map(r=>r.invTempMax).filter(Number.isFinite);return tt.length?{minEndC:Math.min(...tt),maxC:Math.max(...tt,...max),averageEndC:round(tt.reduce((s,v)=>s+v,0)/tt.length)}:null;})(),socSummary:(()=>{const ss=rr.flatMap(r=>[r.socEnd,r.socMin,r.socMax]).filter(Number.isFinite);return ss.length?{minPercent:Math.min(...ss),maxPercent:Math.max(...ss)}:null;})()};});
   return {resolution:hourly?'hourly':resolution,requestedRange:pick(q,['from','to','month','startHour','endHour','calendar','lastDays','dayOffset','monthOffset']),hourBounds:'startHour和endHour均包含；例如10至12点应匹配10和11时，不包含12至13时。',byPlant,totalsIncludeAllMatchingRows:true,...(resolution==='summary'?{totalRows:rows.length,rows:[]}:page(filtered(rows))),coverage:coverage.filter(d=>ids.includes(d.plantId)),downloads:selected.filter(d=>(!q.month||d.month===q.month)&&(!q.from||d.month>=q.from.slice(0,7))&&(!q.to||d.month<=q.to.slice(0,7))).map(d=>({plantId:d.plantId,month:d.month,csv:origin+'/api/workspace/history/'+d.plantId+'/'+d.month+'.csv'})),note:'汇总仅涵盖已保存的匹配记录；无记录不等于发电量为0，分页不影响完整汇总。日汇总没有逆变器逐日温度字段；小时温度字段缺失为null。'};
  }
  if(q.scope==='samples')return {...page(filtered(plants.filter(matches).flatMap(p=>(p.hist||[]).filter(h=>Number.isFinite(h.utc)&&inDate(date(h.utc))).map(h=>({plantId:p.id,plantName:p.name,...pick(h,['utc','pv','load','bat','grid','invTemp']),timeBeijing:beijing(h.utc)}))).sort((a,b)=>a.utc-b.utc))),note:'仅最新快照中的有限近期采样；不覆盖整段历史，也没有历史SOC逐分钟数据。'};
  if(q.scope==='reminders'||q.scope==='reports'){
   const events=(w.assistant?.events||[]).filter(e=>ids.includes(e.plantId)&&(q.scope!=='reports'||e.report)&&(!q.status||q.status==='all'||e.status===q.status)&&(!q.type||e.type===q.type)&&(e.report?(!q.from||date(e.report.observedUntil||e.simUtc||e.createdAt)>=q.from)&&(!q.to||date(e.report.observedFrom||e.simUtc||e.createdAt)<=q.to)&&(!q.month||e.report.month===q.month):inDate(date(e.simUtc||e.createdAt)))).map(e=>({...pick(e,['id','plantId','plantName','deviceId','type','status','level','simulation','demo','title','summary','advice','createdAt','updatedAt','simUtc','evidence','risk']),...times(e,['createdAt','updatedAt','simUtc']),...(e.risk?{risk:{...e.risk,forecastTimeBeijing:beijing(e.risk.forecastUtc),points:(e.risk.points||[]).map(p=>({...p,timeBeijing:beijing(p.utc)}))}}:{}),...(e.report?{report:{...(q.scope==='reports'?e.report:pick(e.report,['month','partial','historical','totals','stepMinutes','observedFrom','observedUntil'])),...times(e.report,['observedFrom','observedUntil'])},reportUrl:origin+'/api/workspace/reports/'+encodeURIComponent(e.id)}:{})})).sort((a,b)=>b.updatedAt-a.updatedAt);
   return {...page(events),alarms:q.scope==='reminders'?(snapshot?.alarms||[]).filter(a=>!a.st||ids.some(id=>names.get(id)===a.st)).map(a=>pick(a,['title','lv','dev','st','t'])):undefined,note:'提醒状态来自服务器；本设备的已处理/稍后提醒偏好仅保存在浏览器，不是服务器处理工单。'};
  }
  if(q.scope==='operations'){
   if(!manager)return {error:'此类管理数据需先在同一浏览器登录仿真管理页；不能通过对话读取登录凭证。',requiresManager:true};
   return {publisherConnected:!!w.lease&&w.lease.expiresAt>now,leaseExpiresAt:w.lease?.expiresAt||null,leaseExpiresAtBeijing:beijing(w.lease?.expiresAt),activeLoginSessionCount:(w.managerSessions||[]).filter(s=>s.expiresAt>now).length,...page((w.commands||[]).filter(c=>!c.plantId||ids.includes(c.plantId)).map(c=>({...pick(c,['id','plantId','type','status','ok','msg','createdAt','completedAt','expiresAt']),status:c.status==='pending'&&c.expiresAt<now?'expired':c.status,...times(c,['createdAt','completedAt','expiresAt'])}))),drills:Object.entries(w.assistant?.scenarios||{}).filter(([id])=>ids.includes(id)).map(([plantId,s])=>({plantId,...pick(s,['type','startUtc','untilUtc','expiresAt']),...times(s,['startUtc','untilUtc','expiresAt']),active:now<=s.expiresAt&&snapshot?.time?.utc>=s.startUtc&&snapshot?.time?.utc<=s.untilUtc})),note:'不返回会话ID、哈希、口令、Cookie、运行者标识或控制密钥。'};
  }
  if(q.scope==='storage')return {primary:'阿里云服务器本地JSON持久化',files:['workspace.json：配置、最新快照、提醒、演练、管理会话','history.json：历史仿真逐日逐小时记录'],counts:{plants:config.length,historicalDatasets:datasets.length,dailyRows:datasets.reduce((s,d)=>s+(d.daily?.length||0),0),hourlyRows:datasets.reduce((s,d)=>s+(d.hourly?.length||0),0),reminders:w.assistant?.events?.length||0},coverage,notStored:['完整逐秒运行历史','不存在的温度历史','浏览器本机已处理/稍后提醒偏好'],note:'当前查询未读取备份目录；不能声称具体备份文件已存在或给出其内容。'};
 }
 return {...meta,results:queries.map(q=>({query:q,data:run(q)}))};
}
